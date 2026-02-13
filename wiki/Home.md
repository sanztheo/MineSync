# MineSync Wiki

Welcome to the MineSync wiki! This documentation covers everything you need to know about the project.

## What is MineSync?

MineSync is an open-source Minecraft launcher with peer-to-peer modpack synchronization. Share your mods with friends using a simple code — no server required.

## Quick Links

### Getting Started
- [Installation Guide](Getting-Started.md)
- [Configuration](Configuration.md)
- [Your First Modpack](Getting-Started.md#creating-your-first-modpack)

### Core Concepts
- [Architecture Overview](Architecture.md)
- [P2P Protocol](P2P-Protocol.md)
- [Sync Mechanism](Sync-Protocol.md)

### Technical Reference
- [Tauri Commands API](API-Reference.md)
- [Database Schema](Database-Schema.md)
- [Mod Loaders](Mod-Loaders.md)

### Development
- [Contributing Guide](Contributing.md)
- [Building from Source](Building.md)
- [Testing](Testing.md)

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                         MineSync Flow                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Create Modpack    2. Share           3. Friend Joins       │
│  ┌─────────────┐      ┌─────────────┐    ┌─────────────┐       │
│  │ + Minecraft │      │   Generate  │    │ Enter Code  │       │
│  │ + Mods      │ ──►  │ MINE-XXXXXX │ ──►│ MINE-XXXXXX │       │
│  │ + Loader    │      │   Code      │    │             │       │
│  └─────────────┘      └─────────────┘    └─────────────┘       │
│                                                 │               │
│                                                 ▼               │
│  4. Sync Updates      5. Download        6. Play Together      │
│  ┌─────────────┐      ┌─────────────┐    ┌─────────────┐       │
│  │ Manifest    │      │ Fetch from  │    │  Launch     │       │
│  │ Diff + ──────────► │ CurseForge/ │ ──►│  Minecraft  │       │
│  │ Confirm     │      │ Modrinth    │    │             │       │
│  └─────────────┘      └─────────────┘    └─────────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Key Features

| Feature | Description |
|---------|-------------|
| **P2P Sync** | Share modpacks via code, no central server |
| **Multi-Platform Mods** | Unified search across CurseForge & Modrinth |
| **All Mod Loaders** | Fabric, Forge, NeoForge, Quilt support |
| **Microsoft Auth** | Secure Device Code Flow authentication |
| **Native Performance** | Built with Tauri + Rust, ~15MB binary |
| **Manual Sync** | Preview changes before applying |

## Technology Stack

| Layer | Technology |
|-------|------------|
| Desktop Framework | Tauri v2 |
| Backend | Rust (tokio, reqwest, rusqlite) |
| Frontend | React 19, TypeScript, Tailwind CSS v4 |
| P2P Network | libp2p (noise, yamux, relay, dcutr) |
| Database | SQLite (WAL mode) |
| APIs | CurseForge, Modrinth, Mojang |

## Support

- [GitHub Issues](https://github.com/your-username/MineSync/issues)
- [Discussions](https://github.com/your-username/MineSync/discussions)

---

*MineSync is open-source software licensed under MIT.*
