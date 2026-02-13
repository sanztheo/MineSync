use libp2p::PeerId;
use serde::{Deserialize, Serialize};

use crate::models::sync::SyncManifest;

/// Commands sent from the application to the swarm background task.
#[derive(Debug)]
pub enum P2pCommand {
    /// Start sharing a modpack with the given manifest and code.
    ShareModpack {
        manifest: SyncManifest,
        code: String,
    },
    /// Connect to a remote peer by their PeerId.
    ConnectToPeer(PeerId),
    /// Request the manifest from a connected peer.
    RequestManifest(PeerId),
    /// Gracefully shut down the swarm.
    Shutdown,
}

/// Events emitted by the swarm background task to the application.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum P2pEvent {
    PeerConnected {
        peer_id: String,
    },
    PeerDisconnected {
        peer_id: String,
    },
    ManifestReceived {
        peer_id: String,
        manifest: SyncManifest,
    },
    ShareCodeReady {
        code: String,
    },
    NatStatusDetected {
        is_public: bool,
    },
    Error {
        message: String,
    },
}

/// Lightweight status for frontend display.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct P2pStatus {
    pub is_running: bool,
    pub peer_id: String,
}
