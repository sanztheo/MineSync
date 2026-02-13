use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use libp2p::futures::StreamExt;
use libp2p::identity::Keypair;
use libp2p::request_response::{self, ProtocolSupport};
use libp2p::swarm::SwarmEvent;
use libp2p::{autonat, identify, noise, tcp, yamux, Multiaddr, PeerId, Swarm, SwarmBuilder};
use tokio::sync::{broadcast, mpsc};

use super::behaviour::{ManifestRequest, ManifestResponse, MineSyncBehaviour, MineSyncBehaviourEvent};
use super::types::{P2pCommand, P2pEvent};
use crate::errors::{AppError, AppResult};
use crate::models::sync::SyncManifest;

const PROTOCOL_VERSION: &str = "/minesync/manifest/1.0.0";
const IDENTIFY_AGENT: &str = "minesync/0.1.0";
const LISTEN_PORT: u16 = 0; // OS-assigned port
const IDLE_TIMEOUT_SECS: u64 = 120;

/// Build a libp2p Swarm with the MineSync behaviour.
///
/// Loads or generates a persistent Ed25519 keypair from `app_data_dir/p2p_key`.
pub fn build_swarm(app_data_dir: &Path) -> AppResult<(PeerId, Swarm<MineSyncBehaviour>)> {
    let keypair = load_or_generate_keypair(app_data_dir)?;
    let local_peer_id = keypair.public().to_peer_id();

    let swarm = SwarmBuilder::with_existing_identity(keypair.clone())
        .with_tokio()
        .with_tcp(
            tcp::Config::default(),
            noise::Config::new,
            yamux::Config::default,
        )
        .map_err(|e| AppError::P2p(format!("TCP transport setup failed: {e}")))?
        .with_relay_client(noise::Config::new, yamux::Config::default)
        .map_err(|e| AppError::P2p(format!("Relay client setup failed: {e}")))?
        .with_behaviour(|key, relay_client| {
            build_behaviour(key, relay_client, local_peer_id)
        })
        .map_err(|e| AppError::P2p(format!("Behaviour setup failed: {e}")))?
        .with_swarm_config(|cfg| {
            cfg.with_idle_connection_timeout(Duration::from_secs(IDLE_TIMEOUT_SECS))
        })
        .build();

    Ok((local_peer_id, swarm))
}

fn build_behaviour(
    key: &Keypair,
    relay_client: libp2p::relay::client::Behaviour,
    local_peer_id: PeerId,
) -> MineSyncBehaviour {
    let identify = identify::Behaviour::new(identify::Config::new(
        PROTOCOL_VERSION.to_string(),
        key.public(),
    ).with_agent_version(IDENTIFY_AGENT.to_string()));

    let ping = libp2p::ping::Behaviour::default();

    let manifest_protocol = request_response::cbor::Behaviour::new(
        [(
            libp2p::StreamProtocol::new(PROTOCOL_VERSION),
            ProtocolSupport::Full,
        )],
        request_response::Config::default(),
    );

    let autonat = autonat::Behaviour::new(
        local_peer_id,
        autonat::Config {
            boot_delay: Duration::from_secs(15),
            refresh_interval: Duration::from_secs(60),
            ..Default::default()
        },
    );

    let dcutr = libp2p::dcutr::Behaviour::new(local_peer_id);

    MineSyncBehaviour {
        identify,
        ping,
        relay_client,
        dcutr,
        autonat,
        manifest_exchange: manifest_protocol,
    }
}

/// Main swarm event loop running in a background tokio task.
pub async fn run(
    mut swarm: Swarm<MineSyncBehaviour>,
    mut commands: mpsc::Receiver<P2pCommand>,
    events: broadcast::Sender<P2pEvent>,
    is_running: Arc<AtomicBool>,
) {
    // Listen on an OS-assigned TCP port
    let listen_addr: Multiaddr = format!("/ip4/0.0.0.0/tcp/{LISTEN_PORT}")
        .parse()
        .expect("static multiaddr is valid");

    if let Err(e) = swarm.listen_on(listen_addr) {
        log::error!("Failed to start listening: {e}");
        let _ = events.send(P2pEvent::Error {
            message: format!("Failed to start listening: {e}"),
        });
        return;
    }

    // Active manifests being shared, keyed by share code
    let mut shared_manifests: HashMap<String, SyncManifest> = HashMap::new();

    loop {
        if !is_running.load(Ordering::SeqCst) {
            log::info!("Swarm loop shutting down (flag cleared)");
            break;
        }

        tokio::select! {
            // Process incoming commands from the application
            cmd = commands.recv() => {
                match cmd {
                    Some(command) => {
                        handle_command(command, &mut shared_manifests, &events);
                    }
                    None => {
                        log::info!("Command channel closed, shutting down swarm");
                        break;
                    }
                }
            }
            // Process swarm events
            event = swarm.select_next_some() => {
                handle_swarm_event(event, &mut swarm, &shared_manifests, &events);
            }
        }
    }

    is_running.store(false, Ordering::SeqCst);
    log::info!("Swarm loop exited");
}

fn handle_command(
    command: P2pCommand,
    shared_manifests: &mut HashMap<String, SyncManifest>,
    events: &broadcast::Sender<P2pEvent>,
) {
    match command {
        P2pCommand::ShareModpack { manifest, code } => {
            log::info!("Sharing modpack with code: {code}");
            shared_manifests.insert(code.clone(), manifest);
            let _ = events.send(P2pEvent::ShareCodeReady { code });
        }
        P2pCommand::ConnectToPeer(peer_id) => {
            log::info!("Connect to peer requested: {peer_id}");
            // Dialing will be handled when we have relay addresses
        }
        P2pCommand::RequestManifest(peer_id) => {
            log::info!("Manifest request for peer: {peer_id}");
        }
        P2pCommand::Shutdown => {
            log::info!("Shutdown command received");
        }
    }
}

fn handle_swarm_event(
    event: SwarmEvent<MineSyncBehaviourEvent>,
    swarm: &mut Swarm<MineSyncBehaviour>,
    shared_manifests: &HashMap<String, SyncManifest>,
    events: &broadcast::Sender<P2pEvent>,
) {
    match event {
        SwarmEvent::NewListenAddr { address, .. } => {
            log::info!("Listening on {address}");
        }
        SwarmEvent::ConnectionEstablished { peer_id, .. } => {
            log::info!("Connected to peer: {peer_id}");
            let _ = events.send(P2pEvent::PeerConnected {
                peer_id: peer_id.to_string(),
            });
        }
        SwarmEvent::ConnectionClosed { peer_id, .. } => {
            log::info!("Disconnected from peer: {peer_id}");
            let _ = events.send(P2pEvent::PeerDisconnected {
                peer_id: peer_id.to_string(),
            });
        }
        SwarmEvent::Behaviour(behaviour_event) => {
            handle_behaviour_event(behaviour_event, swarm, shared_manifests, events);
        }
        _ => {}
    }
}

fn handle_behaviour_event(
    event: MineSyncBehaviourEvent,
    _swarm: &mut Swarm<MineSyncBehaviour>,
    shared_manifests: &HashMap<String, SyncManifest>,
    events: &broadcast::Sender<P2pEvent>,
) {
    match event {
        MineSyncBehaviourEvent::Identify(identify::Event::Received { peer_id, info, .. }) => {
            log::info!(
                "Identified peer {peer_id}: agent={}, protocols={:?}",
                info.agent_version,
                info.protocols
            );
        }
        MineSyncBehaviourEvent::Autonat(autonat::Event::StatusChanged { old, new }) => {
            log::info!("NAT status changed: {old:?} -> {new:?}");
            let is_public = matches!(new, autonat::NatStatus::Public(_));
            let _ = events.send(P2pEvent::NatStatusDetected { is_public });
        }
        MineSyncBehaviourEvent::ManifestExchange(
            request_response::Event::Message { peer, message }
        ) => {
            handle_manifest_message(peer, message, shared_manifests, events);
        }
        _ => {}
    }
}

fn handle_manifest_message(
    peer: PeerId,
    message: request_response::Message<ManifestRequest, ManifestResponse>,
    shared_manifests: &HashMap<String, SyncManifest>,
    events: &broadcast::Sender<P2pEvent>,
) {
    match message {
        request_response::Message::Request { request, channel, .. } => {
            match request {
                ManifestRequest::GetManifest => {
                    // Return the first shared manifest (MVP: single active share)
                    let response = shared_manifests
                        .values()
                        .next()
                        .map(|m| ManifestResponse::Manifest(m.clone()))
                        .unwrap_or(ManifestResponse::NoManifest);

                    log::info!("Manifest requested by {peer}, responding");
                    // Response is sent via the channel
                    let _ = channel;
                    // Note: actual send requires swarm.behaviour_mut().manifest_exchange.send_response(channel, response)
                    // This will be wired when we pass &mut swarm properly
                    let _ = response;
                }
            }
        }
        request_response::Message::Response { response, .. } => {
            match response {
                ManifestResponse::Manifest(manifest) => {
                    log::info!("Received manifest from {peer}");
                    let _ = events.send(P2pEvent::ManifestReceived {
                        peer_id: peer.to_string(),
                        manifest,
                    });
                }
                ManifestResponse::NoManifest => {
                    log::info!("Peer {peer} has no manifest to share");
                }
            }
        }
    }
}

// --- Keypair persistence ---

const KEYPAIR_FILE: &str = "p2p_keypair.bin";

fn load_or_generate_keypair(app_data_dir: &Path) -> AppResult<Keypair> {
    let key_path = app_data_dir.join(KEYPAIR_FILE);

    if key_path.exists() {
        load_keypair(&key_path)
    } else {
        let keypair = Keypair::generate_ed25519();
        save_keypair(&keypair, &key_path)?;
        Ok(keypair)
    }
}

fn load_keypair(path: &Path) -> AppResult<Keypair> {
    let bytes = std::fs::read(path)?;
    Keypair::from_protobuf_encoding(&bytes)
        .map_err(|e| AppError::P2p(format!("Failed to decode keypair from {}: {e}", path.display())))
}

fn save_keypair(keypair: &Keypair, path: &Path) -> AppResult<()> {
    let bytes = keypair
        .to_protobuf_encoding()
        .map_err(|e| AppError::P2p(format!("Failed to encode keypair: {e}")))?;
    std::fs::write(path, bytes)?;
    Ok(())
}
