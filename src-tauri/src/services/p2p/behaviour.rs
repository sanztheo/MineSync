use libp2p::swarm::NetworkBehaviour;
use libp2p::{autonat, dcutr, identify, ping, relay, request_response};
use serde::{Deserialize, Serialize};

use crate::models::sync::SyncManifest;

/// Protocol messages exchanged between peers for manifest sync.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ManifestRequest {
    /// Request the host's current manifest.
    GetManifest,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ManifestResponse {
    /// The host's current manifest.
    Manifest(SyncManifest),
    /// Host has no active manifest to share.
    NoManifest,
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
