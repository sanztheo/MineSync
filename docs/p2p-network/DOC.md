# P2P Network

## Vue d'ensemble

MineSync utilise **libp2p** pour etablir des connexions directes entre launchers. Le reseau P2P permet aux joueurs de partager leurs modpacks via un code de partage (share code) sans serveur central.

## Fichiers concernes

| Fichier | Role |
|---------|------|
| `src-tauri/src/services/p2p/mod.rs` | P2pService - lifecycle management |
| `src-tauri/src/services/p2p/types.rs` | P2pCommand, P2pEvent, P2pStatus |
| `src-tauri/src/services/p2p/behaviour.rs` | Comportement libp2p (protocoles) |
| `src-tauri/src/services/p2p/swarm_loop.rs` | Boucle de fond du swarm |
| `src-tauri/src/services/p2p/share_code.rs` | Generation/validation des codes de partage |
| `src-tauri/src/commands/p2p.rs` | start_p2p, stop_p2p, share_modpack, join_via_code |

## libp2p : composants utilises

| Composant | Role |
|-----------|------|
| `tcp` | Transport TCP |
| `quic` | Transport QUIC (UDP, plus rapide) |
| `noise` | Chiffrement des connexions |
| `yamux` | Multiplexage de streams |
| `identify` | Identification des peers |
| `ping` | Detection de connexion active |
| `relay` | Relais pour traversee NAT |
| `dcutr` | Direct Connection Upgrade through Relay (hole punching) |
| `autonat` | Detection automatique du type de NAT |
| `request-response` | Echange de messages requete/reponse |
| `dns` | Resolution DNS |

## Architecture du service

```
P2pService
├── command_tx: mpsc::Sender<P2pCommand>    # Envoi de commandes au swarm
├── event_tx: broadcast::Sender<P2pEvent>   # Reception d'evenements
├── local_peer_id: PeerId                   # Identifiant unique du noeud
└── is_running: Arc<AtomicBool>             # Etat du service

Swarm Loop (tokio::spawn)
├── Ecoute les P2pCommand (ShareModpack, ConnectToPeer, etc.)
├── Traite les evenements swarm (peer connected, message recu, etc.)
└── Emettre des P2pEvent au service
```

## Share Codes

Le code de partage (`MINE-XXXXXX`) encode les informations necessaires pour se connecter au host :

```rust
// Generation
fn generate_share_code() -> String {
    // 6 caracteres alphanumeriques aleatoires
    let code: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(6)
        .map(char::from)
        .collect();
    format!("MINE-{}", code.to_uppercase())
}
```

Le code est associe a une session de sync en base de donnees. Quand un receiver entre le code, le service cherche la session correspondante et utilise le `peer_id` du host pour etablir la connexion.

## Commands P2P

```rust
pub enum P2pCommand {
    ShareModpack {
        instance_id: String,
        manifest: SyncManifest,
    },
    ConnectToPeer {
        peer_id: String,
        share_code: String,
    },
    RequestManifest {
        peer_id: String,
    },
    Shutdown,
}
```

## Events P2P

```rust
pub enum P2pEvent {
    PeerConnected { peer_id: String },
    PeerDisconnected { peer_id: String },
    ManifestReceived {
        peer_id: String,
        manifest: SyncManifest,
    },
    ShareCodeReady { share_code: String },
    NatStatusDetected { is_public: bool },
    Error { message: String },
}
```

## Cycle de vie

```
App demarre        -> P2P OFF
User ouvre SyncHub -> P2P demarre (start_p2p)
User lance le jeu  -> P2P s'arrete (libere ressources)
Jeu se ferme       -> P2P redemarre (si SyncHub actif)
User ferme l'app   -> P2P s'arrete (shutdown)
```

Le `LaunchService` gere automatiquement l'arret/redemarrage du P2P autour du cycle de vie du jeu.

## NAT Traversal

La traversee NAT est geree par trois mecanismes complementaires :

1. **AutoNAT** : Detecte si le peer est directement accessible (public) ou derriere un NAT
2. **Relay** : Si les deux peers sont derriere un NAT, un relay public sert d'intermediaire
3. **DCUtR** : Tente un "hole punch" pour etablir une connexion directe apres le relay

Sequence de connexion :
```
1. Peer A et Peer B se connectent au relay
2. Peer B envoie sa requete via le relay
3. DCUtR tente un hole punch
4. Si reussi : connexion directe (meilleure performance)
5. Si echoue : reste sur le relay (fonctionne toujours)
```

## Frontend

La page `SyncHub.tsx` affiche :
- Statut P2P (actif/inactif, PeerId)
- Bouton Start/Stop P2P
- Generation de share code pour un modpack
- Champ pour entrer un code recu
- Liste des peers connectes
