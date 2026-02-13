# Configuration

This document covers all configuration options available in MineSync.

## Environment Variables

Create a `.env` file in the project root:

```env
# Required
CURSEFORGE_API_KEY=your_api_key_here

# Optional
RUST_LOG=info                    # Logging level
MINESYNC_DATA_DIR=/custom/path   # Custom data directory
```

### Getting API Keys

#### CurseForge

1. Visit [console.curseforge.com](https://console.curseforge.com/)
2. Sign in or create an account
3. Create a new project/organization
4. Generate an API key
5. Copy the key to your `.env` file

**Note:** CurseForge API has rate limits. For development, the free tier is sufficient.

#### Modrinth

Modrinth API is **free and doesn't require an API key** for public endpoints.

## Application Settings

Settings are stored in the SQLite database and can be modified via the Settings page.

### Memory (RAM)

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| `ram_min` | 1024 MB | 512-16384 | Minimum RAM allocation |
| `ram_max` | 4096 MB | 1024-32768 | Maximum RAM allocation |

**Recommendations:**
- Vanilla: 2-4 GB
- Light modpacks (< 50 mods): 4-6 GB
- Heavy modpacks (100+ mods): 6-8 GB
- Shader packs: 8+ GB

### Java Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `java_path` | Auto-detect | Path to Java executable |

MineSync auto-detects Java in these locations:
- `JAVA_HOME` environment variable
- System PATH
- Common installation directories

**Manual Java path:**
- Windows: `C:\Program Files\Java\jdk-17\bin\javaw.exe`
- macOS: `/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home/bin/java`
- Linux: `/usr/lib/jvm/java-17/bin/java`

### Java Version Requirements

| Minecraft Version | Required Java |
|-------------------|---------------|
| 1.7.10 - 1.16.5 | Java 8 |
| 1.17 - 1.20.4 | Java 17 |
| 1.20.5+ | Java 21 |

### Launch Behavior

| Setting | Default | Description |
|---------|---------|-------------|
| `close_on_launch` | `false` | Close MineSync when game starts |

### Theme

| Setting | Default | Options |
|---------|---------|---------|
| `theme` | `dark` | `dark`, `light`, `system` |

Currently only dark theme is fully implemented.

## Instance Settings

Each instance can have custom settings that override global defaults.

### Per-Instance RAM

```typescript
interface InstanceSettings {
    ram_min?: number;    // Override global minimum
    ram_max?: number;    // Override global maximum
    java_path?: string;  // Use specific Java version
}
```

### JVM Arguments

Custom JVM arguments can be added per-instance:

```
-XX:+UseG1GC
-XX:MaxGCPauseMillis=50
-XX:+UnlockExperimentalVMOptions
-XX:G1NewSizePercent=20
-XX:G1ReservePercent=20
```

## P2P Network Settings

### Port Configuration

MineSync uses random available ports by default. For NAT traversal issues, you can configure:

| Setting | Default | Description |
|---------|---------|-------------|
| `p2p_port` | Random | Preferred listening port |

### Relay Servers

Default public relays are used for NAT traversal. Custom relays can be added:

```env
MINESYNC_RELAY_ADDRS=/ip4/1.2.3.4/tcp/4001/p2p/QmRelay...
```

## Data Directory

### Default Locations

| Platform | Path |
|----------|------|
| Windows | `%APPDATA%\minesync\` |
| macOS | `~/Library/Application Support/minesync/` |
| Linux | `~/.local/share/minesync/` |

### Directory Structure

```
minesync/
├── minesync.db              # SQLite database
├── instances/
│   └── {uuid}/
│       ├── mods/            # Installed mods
│       ├── config/          # Mod configs
│       ├── saves/           # World saves
│       └── logs/            # Game logs
├── versions/
│   └── {version}/
│       ├── {version}.json   # Version manifest
│       └── {version}.jar    # Client JAR
├── libraries/               # Shared libraries
├── assets/                  # Game assets
│   ├── indexes/
│   ├── objects/
│   └── skins/
├── loaders/                 # Mod loaders
│   ├── fabric/
│   ├── forge/
│   ├── neoforge/
│   └── quilt/
└── logs/                    # Application logs
```

### Custom Data Directory

Set via environment variable:

```bash
export MINESYNC_DATA_DIR=/path/to/custom/dir
```

Or on Windows:

```powershell
$env:MINESYNC_DATA_DIR = "D:\Games\MineSync"
```

## Logging

### Log Levels

| Level | Description |
|-------|-------------|
| `error` | Errors only |
| `warn` | Warnings and errors |
| `info` | General information (default) |
| `debug` | Detailed debugging |
| `trace` | Very verbose |

### Configure Logging

```bash
# Set log level
export RUST_LOG=debug

# Module-specific logging
export RUST_LOG=minesync=debug,libp2p=warn

# Run with logging
npm run tauri dev
```

### Log Files

Application logs are stored in:
- `{data_dir}/logs/minesync.log`

Game logs per instance:
- `{data_dir}/instances/{uuid}/logs/latest.log`

## Tauri Configuration

The `src-tauri/tauri.conf.json` file contains app-level configuration:

```json
{
  "productName": "MineSync",
  "version": "0.1.0",
  "identifier": "dev.minesync.app",
  "app": {
    "windows": [
      {
        "title": "MineSync",
        "width": 1200,
        "height": 800,
        "minWidth": 900,
        "minHeight": 600,
        "resizable": true,
        "decorations": false
      }
    ]
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

### Window Settings

| Setting | Description |
|---------|-------------|
| `decorations: false` | Custom title bar (frameless) |
| `resizable: true` | Allow window resizing |
| `minWidth/minHeight` | Minimum window dimensions |

## Advanced Configuration

### Database Pragmas

SQLite is configured with:

```sql
PRAGMA journal_mode = WAL;    -- Write-Ahead Logging
PRAGMA foreign_keys = ON;     -- Enforce foreign keys
PRAGMA synchronous = NORMAL;  -- Balance speed/safety
```

### Download Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Concurrent downloads | 4 | Parallel download limit |
| Retry attempts | 3 | Failed download retries |
| Timeout | 30s | Per-file timeout |

### P2P Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Connection timeout | 10s | Peer connection timeout |
| Keep-alive interval | 15s | Connection heartbeat |
| Max peers | 50 | Maximum connected peers |

## Configuration Files Reference

| File | Purpose |
|------|---------|
| `.env` | Environment variables |
| `tauri.conf.json` | Tauri app configuration |
| `minesync.db` | Runtime settings (SQLite) |

## Resetting Configuration

### Reset Settings

Delete the database to reset all settings:

```bash
# Backup first!
rm ~/.local/share/minesync/minesync.db

# Or on macOS
rm ~/Library/Application\ Support/minesync/minesync.db
```

### Clear Cache

Remove downloaded files:

```bash
rm -rf ~/.local/share/minesync/versions/
rm -rf ~/.local/share/minesync/libraries/
rm -rf ~/.local/share/minesync/assets/
```

## Next Steps

- [Getting Started](Getting-Started.md) - Initial setup
- [Architecture](Architecture.md) - How config is used
- [Troubleshooting](Getting-Started.md#troubleshooting) - Common issues
