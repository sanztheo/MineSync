# Mod Loaders

MineSync supports all major Minecraft mod loaders. This document explains how each loader is installed and configured.

## Supported Loaders

| Loader | Description | API |
|--------|-------------|-----|
| **Fabric** | Lightweight, modern loader | [fabricmc.net](https://fabricmc.net/) |
| **Forge** | Classic loader, huge mod ecosystem | [files.minecraftforge.net](https://files.minecraftforge.net/) |
| **NeoForge** | Forge fork, modern development | [neoforged.net](https://neoforged.net/) |
| **Quilt** | Fabric-compatible, community-driven | [quiltmc.org](https://quiltmc.org/) |

## Loader Comparison

```
┌─────────────────────────────────────────────────────────────────┐
│                     Mod Loader Ecosystem                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    ┌─────────────┐                             │
│                    │  Minecraft  │                             │
│                    └──────┬──────┘                             │
│                           │                                     │
│           ┌───────────────┼───────────────┐                    │
│           │               │               │                    │
│           ▼               ▼               ▼                    │
│    ┌──────────┐    ┌──────────┐    ┌──────────┐               │
│    │  Fabric  │    │  Forge   │    │   Quilt  │               │
│    └────┬─────┘    └────┬─────┘    └────┬─────┘               │
│         │               │               │                      │
│         │               ▼               │                      │
│         │        ┌──────────┐           │                      │
│         │        │ NeoForge │           │                      │
│         │        └──────────┘           │                      │
│         │                               │                      │
│         └───────────┬───────────────────┘                      │
│                     │                                          │
│                     ▼                                          │
│              (Quilt can load                                   │
│               Fabric mods)                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Fabric

### Overview

Fabric is a lightweight, modular mod loader focused on:
- Fast updates for new Minecraft versions
- Clean API design
- Minimal overhead

### Installation Process

```
┌─────────────────────────────────────────────────────────────────┐
│                   Fabric Installation                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Fetch loader versions                                       │
│     GET https://meta.fabricmc.net/v2/versions/loader/{mc}      │
│                                                                 │
│  2. Get profile JSON                                            │
│     GET https://meta.fabricmc.net/v2/versions/loader/          │
│         {mc}/{loader}/profile/json                              │
│                                                                 │
│  3. Download required libraries                                 │
│     - fabric-loader-{version}.jar                              │
│     - intermediary-{mc}.jar                                    │
│                                                                 │
│  4. Generate launch profile                                     │
│     - Main class: net.fabricmc.loader.impl.launch.knot.       │
│                   KnotClient                                    │
│     - Add libraries to classpath                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Required Files

| File | Purpose |
|------|---------|
| `fabric-loader-{version}.jar` | Loader core |
| `intermediary-{mc}.jar` | Mappings |
| `fabric-api-{version}.jar` | Core API (most mods require) |

### Launch Arguments

```
-Dfabric.gameVersion={mc_version}
-Dfabric.loader.version={loader_version}
```

## Forge

### Overview

Forge is the oldest and most established mod loader:
- Huge ecosystem of mods
- Powerful event system
- Extensive API

### Installation Process

```
┌─────────────────────────────────────────────────────────────────┐
│                    Forge Installation                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Fetch available versions                                    │
│     GET https://files.minecraftforge.net/maven/net/            │
│         minecraftforge/forge/maven-metadata.xml                 │
│                                                                 │
│  2. Download installer                                          │
│     forge-{mc}-{version}-installer.jar                         │
│                                                                 │
│  3. Run installer programmatically                              │
│     - Extract libraries                                         │
│     - Patch Minecraft JAR (older versions)                     │
│     - Generate version JSON                                     │
│                                                                 │
│  4. Launch with Forge                                           │
│     - Main class varies by version                             │
│     - 1.17+: cpw.mods.bootstraplauncher.BootstrapLauncher     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Version-Specific Handling

| MC Version | Main Class | Notes |
|------------|------------|-------|
| 1.12.2 | `net.minecraft.launchwrapper.Launch` | Legacy |
| 1.13-1.16 | `cpw.mods.modlauncher.Launcher` | ModLauncher |
| 1.17+ | `cpw.mods.bootstraplauncher.BootstrapLauncher` | Bootstrap |

### Launch Arguments

```
--launchTarget forgeclient
--fml.forgeVersion {forge_version}
--fml.mcVersion {mc_version}
--fml.forgeGroup net.minecraftforge
--fml.mcpVersion {mcp_version}
```

## NeoForge

### Overview

NeoForge is a community fork of Forge (post-1.20.1):
- Active development
- Modern practices
- Forge mod compatibility (mostly)

### Installation Process

Similar to Forge, but uses different Maven repository:

```
┌─────────────────────────────────────────────────────────────────┐
│                   NeoForge Installation                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Fetch versions                                              │
│     GET https://maven.neoforged.net/releases/net/              │
│         neoforged/neoforge/maven-metadata.xml                   │
│                                                                 │
│  2. Download installer                                          │
│     neoforge-{version}-installer.jar                           │
│                                                                 │
│  3. Run installer (same as Forge)                              │
│                                                                 │
│  4. Launch with NeoForge main class                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Differences from Forge

- Package names: `net.neoforged` vs `net.minecraftforge`
- Maven repository: `maven.neoforged.net`
- Some API changes for modern practices

## Quilt

### Overview

Quilt is a Fabric fork with additional features:
- Fabric mod compatibility
- Enhanced modding API
- Community governance

### Installation Process

```
┌─────────────────────────────────────────────────────────────────┐
│                    Quilt Installation                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Fetch loader versions                                       │
│     GET https://meta.quiltmc.org/v3/versions/loader            │
│                                                                 │
│  2. Get profile                                                 │
│     GET https://meta.quiltmc.org/v3/versions/loader/           │
│         {loader}/profile/json                                   │
│                                                                 │
│  3. Download libraries                                          │
│     - quilt-loader-{version}.jar                               │
│     - hashed-{mc}.jar (mappings)                               │
│                                                                 │
│  4. Launch                                                      │
│     - Main class: org.quiltmc.loader.impl.launch.knot.        │
│                   KnotClient                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Fabric Compatibility

Quilt can load most Fabric mods:
- Fabric API mods work with Quilted Fabric API
- Some Fabric-specific features may differ
- Check mod documentation for Quilt support

## Loader Storage

Installed loaders are tracked in the `loader_installations` table:

```sql
SELECT * FROM loader_installations
WHERE loader_type = 'fabric'
  AND mc_version = '1.20.4';
```

Directory structure:
```
~/.local/share/minesync/
└── loaders/
    ├── fabric/
    │   └── 0.15.7-1.20.4/
    ├── forge/
    │   └── 49.0.19-1.20.4/
    ├── neoforge/
    │   └── 20.4.80/
    └── quilt/
        └── 0.23.1-1.20.4/
```

## Mod Compatibility Matrix

| Loader | Fabric Mods | Forge Mods | Quilt Mods |
|--------|-------------|------------|------------|
| Fabric | ✅ Native | ❌ No | ❌ No |
| Forge | ❌ No | ✅ Native | ❌ No |
| NeoForge | ❌ No | ⚠️ Most* | ❌ No |
| Quilt | ✅ Most* | ❌ No | ✅ Native |

*Compatibility varies by mod

## Troubleshooting

### Fabric Issues

| Problem | Solution |
|---------|----------|
| Mods not loading | Ensure Fabric API is installed |
| Crash on startup | Check mod version compatibility |
| Missing mappings | Redownload intermediary |

### Forge Issues

| Problem | Solution |
|---------|----------|
| Failed to install | Run as administrator (Windows) |
| Java runtime missing | Install/Reinstall Java 21 from MineSync startup modal or Settings |
| Out of memory | Increase RAM allocation |

### NeoForge Issues

| Problem | Solution |
|---------|----------|
| Forge mod not working | Check NeoForge compatibility |
| Missing libraries | Reinstall NeoForge |

### Quilt Issues

| Problem | Solution |
|---------|----------|
| Fabric mod crash | Try Quilted Fabric API |
| Loader not found | Update Quilt loader |

## API Endpoints

### Fabric

```
Base: https://meta.fabricmc.net/v2

GET /versions/loader
GET /versions/loader/{mc_version}
GET /versions/loader/{mc_version}/{loader_version}/profile/json
```

### Forge

```
Base: https://files.minecraftforge.net

Maven: /maven/net/minecraftforge/forge/
Promotions: /net/minecraftforge/forge/promotions_slim.json
```

### NeoForge

```
Base: https://maven.neoforged.net

Maven: /releases/net/neoforged/neoforge/
```

### Quilt

```
Base: https://meta.quiltmc.org/v3

GET /versions/loader
GET /versions/loader/{loader_version}/profile/json
```

## Next Steps

- [Getting Started](Getting-Started.md) - Create your first modpack
- [API Reference](API-Reference.md) - Loader commands
- [Architecture](Architecture.md) - How loaders integrate
