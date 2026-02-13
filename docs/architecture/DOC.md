# Architecture

## Vue d'ensemble

MineSync est une application desktop construite avec **Tauri v2** : un backend Rust qui gere toute la logique metier et un frontend React/TypeScript pour l'interface utilisateur. La communication entre les deux se fait via le systeme IPC de Tauri (`invoke` / events).

## Stack technique

| Couche | Technologie | Role |
|--------|-------------|------|
| Backend | Rust + Tauri v2 | Logique metier, I/O, reseau |
| Frontend | React 19 + TypeScript | Interface utilisateur |
| Styling | Tailwind CSS v4 | Design system dark theme |
| Base de donnees | SQLite (rusqlite) | Persistence locale |
| Reseau P2P | libp2p | Connexion directe entre launchers |
| HTTP | reqwest + rustls-tls | Appels API externes |
| Icones | Lucide React | Iconographie |

## Architecture backend

Le backend est organise en deux couches :

### Commands (`src-tauri/src/commands/`)

Les **commands** sont les handlers IPC exposes au frontend via `#[tauri::command]`. Chaque command :
- Recoit les parametres du frontend (deserialises automatiquement)
- Accede aux services via `tauri::State<T>`
- Retourne un `Result<T, String>` serialise en JSON

```
commands/
├── auth.rs           # start_auth, poll_auth, get_profile, logout
├── account.rs        # get_active_account, save_account
├── instance.rs       # list_instances, get_instance, create_instance, delete_instance
├── java.rs           # get_java_status, get_java_install_progress, install_java_runtime, get_java_path
├── minecraft.rs      # list_mc_versions, download_version, get_download_progress
├── loader.rs         # list_loader_versions, install_loader
├── launch.rs         # launch_instance, get_game_status, kill_game
├── mods.rs           # search_mods, search_modpacks, get_mod_details, get_mod_versions, resolve_mod_dependencies
├── p2p.rs            # start_p2p, stop_p2p, get_p2p_status, share_modpack, join_via_code
├── sync.rs           # create_sync_session, join_sync_session
├── install.rs        # install_mod, install_modpack, get_install_progress, list_instance_mods, remove_mod
└── sync_protocol.rs  # preview_sync, get_pending_sync, confirm_sync, reject_sync, apply_sync
```

### Services (`src-tauri/src/services/`)

Les **services** contiennent la logique metier pure. Chaque service est un `struct` avec ses methodes. Ils sont enregistres comme `tauri::State` dans `lib.rs` et partages entre les commands.

```
services/
├── auth.rs           # AuthService : Microsoft OAuth
├── database.rs       # DatabaseService : SQLite CRUD
├── download.rs       # DownloadService : telechargements paralleles
├── java.rs           # JavaService : runtime Java 21 portable
├── launch.rs         # LaunchService : lancement du jeu
├── minecraft.rs      # MinecraftService : versions Mojang
├── loader/           # LoaderService : Fabric, Quilt, Forge, NeoForge
├── mod_platform/     # UnifiedModClient : CurseForge + Modrinth
├── p2p/              # P2pService : reseau libp2p
└── sync_protocol/    # SyncProtocolService : diff + apply
```

## Architecture frontend

```
src/
├── main.tsx          # Point d'entree React
├── App.tsx           # Router (react-router-dom)
├── pages/            # Pages de l'application
│   ├── Home.tsx      # Liste des instances + creation
│   ├── Auth.tsx      # Connexion Microsoft
│   ├── BrowseMods.tsx# Recherche de mods
│   ├── InstanceDetail.tsx # Gestion d'une instance
│   ├── SyncHub.tsx   # Hub de synchronisation P2P
│   └── Settings.tsx  # Parametres (RAM, reseau, Java)
├── components/
│   ├── layout/       # TitleBar, Sidebar
│   ├── java/         # JavaSetupModal
│   └── ui/           # Button, Card, Badge, Input, Modal, etc.
├── hooks/
│   ├── use-tauri.ts  # useTauriCommand<T> (fetch + state)
│   ├── use-game-status.ts
│   ├── use-java-runtime.ts
│   └── use-debounce.ts
└── lib/
    ├── types.ts      # Interfaces TypeScript (miroir des types Rust)
    └── tauri.ts      # Wrappers invoke() pour chaque commande
```

## Communication IPC

Le frontend communique avec le backend Rust via deux mecanismes :

### Commands (Frontend -> Rust)

```typescript
// src/lib/tauri.ts
import { invoke } from "@tauri-apps/api/core";

export function listInstances(): Promise<MinecraftInstance[]> {
  return invoke("list_instances");
}
```

### Events (Rust -> Frontend)

```typescript
import { listen } from "@tauri-apps/api/event";

listen<DownloadProgress>("download-progress", (event) => {
  updateProgress(event.payload);
});
```

## Gestion d'etat

- **Backend** : Chaque service est un `struct` stocke dans `tauri::State<Arc<T>>` ou `tauri::State<Mutex<T>>`
- **Frontend** : Le hook `useTauriCommand<T>` gere automatiquement loading/data/error/refetch pour chaque appel IPC

## Gestion d'erreurs

Le type `AppError` dans `errors.rs` centralise toutes les erreurs :

```rust
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("P2P error: {0}")]
    P2p(String),
    #[error("{0}")]
    Custom(String),
}
```

Toutes les erreurs sont converties en `String` pour le transport IPC vers le frontend.

## Dependances entre services

```
LaunchService
├── DatabaseService    (play time, account tokens)
├── MinecraftService   (classpath, version detail)
└── P2pService         (pause/resume autour du jeu)

JavaService
├── reqwest            (download Temurin 21)
├── sha2               (verification checksum)
└── zip/tar            (extraction runtime portable)

SyncProtocolService
└── DownloadService    (appliquer les diffs)

LoaderService
└── reqwest            (APIs Fabric/Quilt/Forge/NeoForge)

UnifiedModClient
├── CurseForgeClient   (API CurseForge)
└── ModrinthClient     (API Modrinth)
```
