use libp2p::swarm::NetworkBehaviour;
use libp2p::{autonat, dcutr, identify, ping, relay, request_response};
use serde::{Deserialize, Serialize};

use crate::models::sync::SyncManifest;
use crate::services::sync_protocol::ManifestDiff;

/// Protocol messages exchanged between peers for manifest sync.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ManifestRequest {
    /// Request the host's current manifest.
    GetManifest,
    /// Request the host's current status (online peers, manifest version).
    GetStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ManifestResponse {
    /// The host's current manifest.
    Manifest(SyncManifest),
    /// Host has no active manifest to share.
    NoManifest,
    /// Host status info.
    Status {
        online_peers: u32,
        manifest_version: u32,
    },
    /// Notification that a new manifest version is available.
    UpdateAvailable {
        manifest_version: u32,
        changes: ManifestDiff,
    },
}

/// Composite NetworkBehaviour for MineSync P2P.
///
/// Each sub-behaviour handles a specific concern:
/// - `identify`: exchange peer info (public key, protocols, addresses)
/// - `ping`: liveness detection
/// - `relay_client`: connect through relay servers when behind NAT
/// - `dcutr`: upgrade relayed connections to direct (hole punching)
/// - `autonat`: detect whether we're behind NAT
/// - `manifest_exchange`: request/response for SyncManifest data
#[derive(NetworkBehaviour)]
pub struct MineSyncBehaviour {
    pub identify: identify::Behaviour,
    pub ping: ping::Behaviour,
    pub relay_client: relay::client::Behaviour,
    pub dcutr: dcutr::Behaviour,
    pub autonat: autonat::Behaviour,
    pub manifest_exchange: request_response::cbor::Behaviour<ManifestRequest, ManifestResponse>,
}
