# P2P Protocol

MineSync uses libp2p for peer-to-peer modpack synchronization. This document explains how the protocol works.

## Overview

The P2P system enables direct modpack sharing between users without a central server. Only the **manifest** (mod list) is transferred via P2P — actual mod files are downloaded from CurseForge/Modrinth.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        P2P Architecture                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                      ┌─────────────────┐                       │
│                      │  Bootstrap/Relay│                       │
│                      │     Nodes       │                       │
│                      └────────┬────────┘                       │
│                               │                                 │
│           ┌───────────────────┼───────────────────┐            │
│           │                   │                   │            │
│           ▼                   ▼                   ▼            │
│    ┌──────────┐        ┌──────────┐        ┌──────────┐       │
│    │  Host    │◄──────►│  Relay   │◄──────►│  Guest   │       │
│    │  Peer    │        │  (TURN)  │        │  Peer    │       │
│    └──────────┘        └──────────┘        └──────────┘       │
│         │                                        │             │
│         │          Direct Connection             │             │
│         │◄──────────────────────────────────────►│             │
│         │        (after hole punching)           │             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Share Code System

### Code Format

Share codes follow the format: `MINE-XXXXXX`

- Prefix: `MINE-` (constant)
- Suffix: 6 characters, base62 encoded PeerId

### Code Generation

```rust
// Simplified code generation
fn generate_share_code(peer_id: &PeerId) -> String {
    let bytes = peer_id.to_bytes();
    let encoded = base62::encode(&bytes[..6]);
    format!("MINE-{}", encoded.to_uppercase())
}
```

### Code Resolution

When a user enters a share code:

1. Decode base62 to get partial PeerId
2. Query DHT for full PeerId
3. Attempt direct connection
4. Fallback to relay if needed

## Connection Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Connection Sequence                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Host                                        Guest              │
│    │                                           │                │
│    │  1. Start P2P Service                     │                │
│    │  ──────────────────►                      │                │
│    │  (Listen on random port)                  │                │
│    │                                           │                │
│    │  2. Generate Share Code                   │                │
│    │  MINE-ABC123                              │                │
│    │                                           │                │
│    │                    3. Enter Code          │                │
│    │                    ◄──────────────────────│                │
│    │                                           │                │
│    │  4. Connection Request                    │                │
│    │  ◄────────────────────────────────────────│                │
│    │                                           │                │
│    │  5. Hole Punching (DCUtR)                 │                │
│    │  ◄───────────────────────────────────────►│                │
│    │                                           │                │
│    │  6. Direct Connection Established         │                │
│    │  ◄═══════════════════════════════════════►│                │
│    │                                           │                │
│    │  7. Send Manifest                         │                │
│    │  ════════════════════════════════════════►│                │
│    │                                           │                │
│    │  8. Sync Complete                         │                │
│    │                                           │                │
└─────────────────────────────────────────────────────────────────┘
```

## Transport Stack

MineSync uses a layered transport stack:

| Layer | Protocol | Purpose |
|-------|----------|---------|
| Transport | TCP + QUIC | Base connectivity |
| Security | Noise | Encryption |
| Multiplexing | Yamux | Multiple streams |
| NAT Traversal | DCUtR + Relay | Hole punching |
| Discovery | AutoNAT + Identify | Peer discovery |

### TCP/QUIC

- **TCP**: Primary transport, most compatible
- **QUIC**: Used when available for better performance

### Noise Protocol

All connections are encrypted using the Noise XX handshake pattern:

```
Initiator                        Responder
    │                                │
    │  → e                           │
    │  ← e, ee, s, es                │
    │  → s, se                       │
    │                                │
    │  [Encrypted Channel]           │
    │  ◄════════════════════════════►│
```

### Yamux Multiplexing

Enables multiple logical streams over a single connection:

- Stream 0: Control messages
- Stream 1+: Data transfer

## NAT Traversal

### The NAT Problem

Most users are behind NAT (Network Address Translation), making direct connections difficult:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User A    │     │   Router    │     │  Internet   │
│ 192.168.1.5 │────►│ NAT: 1.2.3.4│────►│             │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               │ Can't reach
                                               │ 192.168.1.5
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User B    │     │   Router    │     │  Internet   │
│ 192.168.0.10│◄────│ NAT: 5.6.7.8│◄────│             │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Solution: DCUtR (Direct Connection Upgrade through Relay)

1. Both peers connect to a public relay
2. Relay coordinates hole punching
3. Peers attempt simultaneous connection
4. If successful, direct connection established
5. If failed, continue through relay

```
┌─────────────────────────────────────────────────────────────────┐
│                      DCUtR Flow                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Peer A              Relay              Peer B                  │
│    │                   │                   │                    │
│    │  Connect          │                   │                    │
│    │──────────────────►│                   │                    │
│    │                   │  Connect          │                    │
│    │                   │◄──────────────────│                    │
│    │                   │                   │                    │
│    │  CONNECT Request  │                   │                    │
│    │──────────────────►│  CONNECT Request  │                    │
│    │                   │──────────────────►│                    │
│    │                   │                   │                    │
│    │         Hole Punch Attempt            │                    │
│    │◄═════════════════════════════════════►│                    │
│    │                   │                   │                    │
│    │        Direct Connection              │                    │
│    │◄═════════════════════════════════════►│                    │
│    │       (Relay no longer needed)        │                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### AutoNAT

Automatically detects NAT type and reachability:

| NAT Type | Description | Direct Connection |
|----------|-------------|-------------------|
| None | Public IP | Always possible |
| Full Cone | Most permissive NAT | Usually possible |
| Restricted | Port-restricted | Sometimes possible |
| Symmetric | Most restrictive | Relay required |

## Sync Protocol

### Message Types

```rust
#[derive(Serialize, Deserialize)]
pub enum SyncMessage {
    // Request manifest from host
    RequestManifest,
    
    // Host sends manifest
    Manifest(ModpackManifest),
    
    // Guest requests specific mod info
    RequestModInfo(Vec<String>),
    
    // Host sends mod details
    ModInfo(Vec<ModDetails>),
    
    // Sync status updates
    SyncStatus(SyncStatusUpdate),
}
```

### Manifest Structure

```rust
#[derive(Serialize, Deserialize)]
pub struct ModpackManifest {
    pub version: u32,
    pub instance_name: String,
    pub minecraft_version: String,
    pub loader: ModLoader,
    pub loader_version: String,
    pub mods: Vec<ManifestMod>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize)]
pub struct ManifestMod {
    pub name: String,
    pub source: ModSource,      // CurseForge or Modrinth
    pub project_id: String,
    pub version_id: String,
    pub file_hash: String,      // SHA1
}
```

### Sync Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Sync Flow                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Host                                        Guest              │
│    │                                           │                │
│    │              RequestManifest              │                │
│    │◄──────────────────────────────────────────│                │
│    │                                           │                │
│    │              Manifest                     │                │
│    │──────────────────────────────────────────►│                │
│    │                                           │                │
│    │                          Compute Diff     │                │
│    │                          ┌────────────┐   │                │
│    │                          │ + mod_a    │   │                │
│    │                          │ - mod_b    │   │                │
│    │                          │ ~ mod_c    │   │                │
│    │                          └────────────┘   │                │
│    │                                           │                │
│    │                          User Confirms    │                │
│    │                          ─────────────    │                │
│    │                                           │                │
│    │                          Download Mods    │                │
│    │                          from CF/Modrinth │                │
│    │                          ─────────────    │                │
│    │                                           │                │
│    │              SyncStatus(Complete)         │                │
│    │◄──────────────────────────────────────────│                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Security Considerations

### Encryption

- All P2P traffic encrypted with Noise protocol
- Perfect Forward Secrecy (PFS)
- No plain-text data transfer

### Trust Model

- No central authority
- Peer identity verified via PeerId
- Users must explicitly accept sync requests

### Manifest Validation

Before applying a sync:

1. Validate manifest structure
2. Verify mod sources (only CF/Modrinth allowed)
3. Check version compatibility
4. Display diff for user approval

### Rate Limiting

- Connection attempts limited per peer
- Manifest size limited (prevent DoS)
- Request rate limited

## Auto-Stop on Game Launch

When the Minecraft game is launched:

1. P2P service gracefully stops
2. All connections closed
3. Manifests saved to database
4. Service restarts when game exits

This prevents network interference with gameplay.

## Troubleshooting

### Connection Issues

| Issue | Possible Cause | Solution |
|-------|----------------|----------|
| Can't connect | Firewall blocking | Allow MineSync in firewall |
| Slow connection | Symmetric NAT | Using relay (normal) |
| Frequent disconnects | Unstable network | Check internet connection |
| Code not working | Peer offline | Ensure host is running MineSync |

### Debug Logging

Enable debug logs to troubleshoot P2P issues:

```bash
RUST_LOG=libp2p=debug npm run tauri dev
```

## Next Steps

- [Sync Protocol](Sync-Protocol.md) - Detailed sync algorithm
- [Architecture](Architecture.md) - Overall system design
- [API Reference](API-Reference.md) - P2P commands
