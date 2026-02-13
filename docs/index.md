# MineSync Documentation

MineSync est un launcher Minecraft desktop avec synchronisation P2P de modpacks entre joueurs via un code de partage.

**Stack :** Tauri v2 (Rust) + React + TypeScript + libp2p + SQLite

---

## Modules

| Module | Description | Lien |
|--------|-------------|------|
| [Architecture](./architecture/INDEX.md) | Vue d'ensemble du projet, structure des fichiers, flux de donnees | [DOC](./architecture/DOC.md) |
| [Authentication](./authentication/INDEX.md) | Connexion Microsoft OAuth (Device Code Flow) pour Minecraft | [DOC](./authentication/DOC.md) |
| [Minecraft Engine](./minecraft-engine/INDEX.md) | Gestion des versions, telechargement du client, assets et libraries | [DOC](./minecraft-engine/DOC.md) |
| [Mod Loaders](./mod-loaders/INDEX.md) | Installation de Fabric, Quilt, Forge et NeoForge | [DOC](./mod-loaders/DOC.md) |
| [Mod Platforms](./mod-platforms/INDEX.md) | Recherche unifiee CurseForge + Modrinth | [DOC](./mod-platforms/DOC.md) |
| [P2P Network](./p2p-network/INDEX.md) | Reseau libp2p, share codes, NAT traversal | [DOC](./p2p-network/DOC.md) |
| [Sync Protocol](./sync-protocol/INDEX.md) | Diff de manifeste, confirmation, application des syncs | [DOC](./sync-protocol/DOC.md) |
| [Game Launch](./game-launch/INDEX.md) | Construction du classpath, arguments JVM, lancement du processus | [DOC](./game-launch/DOC.md) |
| [Database](./database/INDEX.md) | Schema SQLite, CRUD instances/mods/comptes/sessions | [DOC](./database/DOC.md) |
| [Download Manager](./download-manager/INDEX.md) | Telechargements paralleles, SHA1, retry, progression | [DOC](./download-manager/DOC.md) |
| [Frontend](./frontend/INDEX.md) | Pages React, composants UI, hooks, types TypeScript | [DOC](./frontend/DOC.md) |

---

## Arborescence du projet

```
MineSync/
├── src-tauri/                    # Backend Rust (Tauri v2)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   └── src/
│       ├── lib.rs                # Point d'entree, enregistrement des commandes
│       ├── errors.rs             # Types d'erreurs (AppError)
│       ├── commands/             # Handlers IPC Tauri (frontend -> rust)
│       └── services/             # Logique metier
│           ├── auth.rs
│           ├── database.rs
│           ├── download.rs
│           ├── java.rs
│           ├── launch.rs
│           ├── minecraft.rs
│           ├── loader/           # Fabric, Quilt, Forge, NeoForge
│           ├── mod_platform/     # CurseForge, Modrinth
│           ├── p2p/              # libp2p, share codes
│           └── sync_protocol/    # Diff, apply, pending syncs
├── src/                          # Frontend React + TypeScript
│   ├── main.tsx
│   ├── App.tsx
│   ├── pages/                    # Home, Auth, BrowseMods, SyncHub, Settings
│   ├── components/               # UI library + layout
│   ├── hooks/                    # useTauriCommand, useDebounce, useGameStatus, useJavaRuntime
│   └── lib/                      # types.ts, tauri.ts (IPC wrappers)
├── docs/                         # Cette documentation
└── package.json
```

---

## Flux principaux

### Lancement d'une partie

```
Home -> Creer instance -> Choisir version MC -> Choisir loader
     -> Telecharger (client.jar + libs + assets + loader)
     -> Lancer (build classpath + JVM args -> spawn Java)
```

### Synchronisation P2P

```
Host: Partager modpack -> Generer share code (MINE-XXXXXX)
Receiver: Entrer code -> Connexion P2P -> Recevoir manifeste
        -> Preview diff -> Confirmer -> Appliquer (download/delete mods)
```

### Authentification

```
Demarrer Device Code Flow -> Afficher code + URL
-> User se connecte sur microsoft.com/link
-> Poll token -> Xbox Live -> XSTS -> Minecraft -> Profil
```
