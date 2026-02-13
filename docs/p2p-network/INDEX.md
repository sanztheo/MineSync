# P2P Network - Index

## Ce module

- [DOC.md](./DOC.md) - Reseau P2P libp2p, share codes, NAT traversal

## Liens vers les autres modules

| Module | Relation |
|--------|----------|
| [Sync Protocol](../sync-protocol/DOC.md) | Utilise le P2P pour echanger les manifestes de modpacks |
| [Game Launch](../game-launch/DOC.md) | Arrete/redemarre le P2P autour du cycle de vie du jeu |
| [Database](../database/DOC.md) | Stocke les sessions sync et share codes |
| [Frontend](../frontend/DOC.md) | SyncHub.tsx pour l'interface P2P |

## Fichiers cles

| Fichier | Role |
|---------|------|
| `src-tauri/src/services/p2p/mod.rs` | P2pService (start, stop, lifecycle) |
| `src-tauri/src/services/p2p/types.rs` | P2pCommand, P2pEvent enums |
| `src-tauri/src/services/p2p/behaviour.rs` | Configuration du comportement libp2p |
| `src-tauri/src/services/p2p/swarm_loop.rs` | Boucle d'evenements en arriere-plan |
| `src-tauri/src/services/p2p/share_code.rs` | Generation MINE-XXXXXX |
| `src-tauri/src/commands/p2p.rs` | start_p2p, stop_p2p, share_modpack, join_via_code |

## Dependances cles

```toml
libp2p = { version = "0.54", features = [
    "tokio", "tcp", "noise", "yamux",
    "identify", "ping", "relay", "dcutr",
    "autonat", "request-response", "cbor",
    "macros", "dns", "quic",
] }
```
