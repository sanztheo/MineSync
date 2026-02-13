# MineSync

Launcher Minecraft open-source avec synchronisation de modpacks en P2P. Partage tes mods avec un simple code, sans serveur.

## Concept

1. Tu crées un modpack dans MineSync
2. Tu cliques "Partager" → un code `MINE-XXXXXX` est généré
3. Ton pote entre le code → il reçoit la liste des mods et les télécharge automatiquement depuis CurseForge/Modrinth
4. Quand tu modifies le modpack → tes potes voient la mise à jour et synchronisent en un clic

Seul le **manifeste** (liste des mods) transite en P2P. Les fichiers sont téléchargés directement depuis les plateformes officielles.

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Desktop | [Tauri v2](https://tauri.app/) |
| Backend | Rust (tokio, reqwest, rusqlite) |
| Frontend | React 19, TypeScript, Tailwind CSS v4 |
| P2P | [libp2p](https://libp2p.io/) (noise, yamux, relay, hole punching) |
| Base de données | SQLite (locale) |
| APIs | CurseForge, Modrinth, Mojang |

## Fonctionnalites

- **Gestion d'instances** — Crée des modpacks avec version Minecraft + mod loader
- **Browse Mods** — Recherche unifiee CurseForge + Modrinth avec filtres
- **Mod Loaders** — Fabric, Quilt, Forge, NeoForge
- **Sync P2P** — Partage de modpacks via code, diff preview, confirmation manuelle
- **Auth Microsoft** — Device Code Flow (pas de navigateur embarque)
- **Download Manager** — Telechargements paralleles avec verification SHA1
- **Lancement du jeu** — Detection Java, arguments Mojang, support mod loaders

## Architecture

```
src-tauri/src/
├── lib.rs                    # Entry point Tauri
├── errors.rs                 # Types d'erreur (thiserror)
├── models/
│   ├── account.rs            # Compte Microsoft
│   ├── auth.rs               # Device Code, tokens
│   ├── instance.rs           # Instance Minecraft
│   ├── launch.rs             # Config de lancement
│   ├── loader.rs             # Profils mod loaders
│   ├── mod_info.rs           # Info mod (DB)
│   ├── mod_platform.rs       # Types unifies CF/Modrinth
│   └── sync.rs               # Session/manifest sync
├── services/
│   ├── auth.rs               # Auth Microsoft (6 etapes)
│   ├── database.rs           # SQLite (5 tables, migrations)
│   ├── download.rs           # Download parallele + SHA1
│   ├── launch.rs             # Lancement Minecraft
│   ├── minecraft.rs          # Version Manager Mojang
│   ├── loader/               # Fabric, Quilt, Forge, NeoForge
│   ├── mod_platform/         # CurseForge + Modrinth unifies
│   ├── p2p/                  # libp2p (swarm, behaviour, share codes)
│   └── sync_protocol/        # Manifest diff, apply, pending syncs
└── commands/                 # Commandes Tauri (IPC)

src/
├── components/
│   ├── layout/               # TitleBar, Sidebar
│   └── ui/                   # Button, Card, Input, Badge, Modal, Toggle, Slider
├── pages/
│   ├── Home.tsx              # Grille d'instances
│   ├── BrowseMods.tsx        # Recherche mods
│   ├── SyncHub.tsx           # Partage P2P + diff preview
│   ├── InstanceDetail.tsx    # Detail instance + onglets
│   ├── Settings.tsx          # Configuration
│   └── Auth.tsx              # Auth Microsoft
├── hooks/                    # useTauriCommand, useDebounce
└── lib/                      # Types, IPC helpers
```

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://rustup.rs/) >= 1.77
- Dependances systeme Tauri : voir [tauri.app/start/prerequisites](https://v2.tauri.app/start/prerequisites/)

## Installation

```bash
git clone https://github.com/your-username/MineSync.git
cd MineSync
npm install
```

## Developpement

```bash
# Lancer en mode dev (frontend + backend)
npm run tauri dev

# Build frontend uniquement
npm run build

# Check Rust uniquement
cd src-tauri && cargo check

# Tests Rust
cd src-tauri && cargo test
```

## Build production

```bash
npm run tauri build
```

Le binaire sera dans `src-tauri/target/release/bundle/`.

## Configuration

| Variable | Description |
|----------|-------------|
| `CURSEFORGE_API_KEY` | Cle API CurseForge ([console.curseforge.com](https://console.curseforge.com/)) |

L'API Modrinth ne necessite pas de cle.

## Schema de la base de donnees

5 tables SQLite :

| Table | Description |
|-------|-------------|
| `accounts` | Comptes Microsoft (tokens, profil) |
| `instances` | Instances Minecraft (modpacks) |
| `instance_mods` | Mods installes par instance |
| `sync_sessions` | Sessions P2P actives |
| `sync_history` | Historique des synchronisations |

## Licence

MIT
