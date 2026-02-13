mod behaviour;
mod share_code;
mod swarm_loop;
mod types;

pub use share_code::generate_share_code;
pub use types::{P2pCommand, P2pEvent, P2pStatus};

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use libp2p::PeerId;
use tokio::sync::{broadcast, mpsc};

use crate::errors::{AppError, AppResult};
use crate::models::sync::SyncManifest;

const COMMAND_CHANNEL_SIZE: usize = 64;
const EVENT_CHANNEL_SIZE: usize = 128;

/// Core P2P service managing the libp2p swarm lifecycle.
///
/// Communicates with the background swarm task via channels:
/// - `command_tx`: send commands (connect, share, stop)
/// - `event_tx`: receive events (peer connected, manifest received)
pub struct P2pService {
    command_tx: mpsc::Sender<P2pCommand>,
    event_tx: broadcast::Sender<P2pEvent>,
    local_peer_id: PeerId,
    is_running: Arc<AtomicBool>,
}

impl P2pService {
    /// Start the P2P service and spawn the swarm background task.
    pub async fn start(app_data_dir: std::path::PathBuf) -> AppResult<Self> {
        let (command_tx, command_rx) = mpsc::channel(COMMAND_CHANNEL_SIZE);
        let (event_tx, _) = broadcast::channel(EVENT_CHANNEL_SIZE);
        let is_running = Arc::new(AtomicBool::new(true));

        let (local_peer_id, swarm) = swarm_loop::build_swarm(&app_data_dir)?;

        let running_flag = Arc::clone(&is_running);
        let events = event_tx.clone();

        tokio::spawn(async move {
            swarm_loop::run(swarm, command_rx, events, running_flag).await;
        });

        log::info!("P2P service started with PeerId: {local_peer_id}");

        Ok(Self {
            command_tx,
            event_tx,
            local_peer_id,
            is_running,
        })
    }

    /// Stop the P2P service gracefully.
    pub async fn stop(&self) -> AppResult<()> {
        if !self.is_running.load(Ordering::SeqCst) {
            return Ok(());
        }

        self.command_tx
            .send(P2pCommand::Shutdown)
            .await
            .map_err(|e| AppError::P2p(format!("Failed to send shutdown command: {e}")))?;

        self.is_running.store(false, Ordering::SeqCst);
        log::info!("P2P service stopped");
        Ok(())
    }

    pub fn is_running(&self) -> bool {
        self.is_running.load(Ordering::SeqCst)
    }

    pub fn local_peer_id(&self) -> &PeerId {
        &self.local_peer_id
    }

    /// Subscribe to P2P events (new receiver each call).
    pub fn subscribe_events(&self) -> broadcast::Receiver<P2pEvent> {
        self.event_tx.subscribe()
    }

    /// Share a modpack: generate a share code and start listening.
    pub async fn share_modpack(&self, manifest: SyncManifest) -> AppResult<String> {
        let code = generate_share_code(&self.local_peer_id);

        self.send_command(P2pCommand::ShareModpack {
            manifest,
            code: code.clone(),
        })
        .await?;

        Ok(code)
    }

    /// Join a host via share code.
    pub async fn join_via_code(&self, code: &str) -> AppResult<()> {
        let peer_id = share_code::decode_share_code(code)
            .map_err(|e| AppError::P2p(format!("Invalid share code: {e}")))?;

        self.send_command(P2pCommand::ConnectToPeer(peer_id)).await
    }

    /// Get current P2P status for the frontend.
    pub fn status(&self) -> P2pStatus {
        P2pStatus {
            is_running: self.is_running(),
            peer_id: self.local_peer_id.to_string(),
        }
    }

    async fn send_command(&self, cmd: P2pCommand) -> AppResult<()> {
        self.command_tx
            .send(cmd)
            .await
            .map_err(|e| AppError::P2p(format!("Failed to send P2P command: {e}")))
    }
}
