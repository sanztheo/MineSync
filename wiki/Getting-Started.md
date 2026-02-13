# Getting Started

This guide will help you set up MineSync and create your first synchronized modpack.

## Prerequisites

Before installing MineSync, ensure you have:

| Requirement | Version | Download |
|-------------|---------|----------|
| Node.js | >= 18 | [nodejs.org](https://nodejs.org/) |
| Rust | >= 1.77 | [rustup.rs](https://rustup.rs/) |
| Java | Auto-managed (Java 21) | Installed by MineSync if missing |

> Sur Linux, l'installation automatique Java n'est pas encore prise en charge: installe Java 21 systeme manuellement.

### Platform-Specific Dependencies

<details>
<summary><strong>Windows</strong></summary>

- Microsoft Visual Studio C++ Build Tools
- WebView2 (usually pre-installed on Windows 10/11)

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools
```
</details>

<details>
<summary><strong>macOS</strong></summary>

- Xcode Command Line Tools

```bash
xcode-select --install
```
</details>

<details>
<summary><strong>Linux (Ubuntu/Debian)</strong></summary>

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libssl-dev libayatana-appindicator3-dev librsvg2-dev
```
</details>

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/your-username/MineSync.git
cd MineSync

# Install dependencies
npm install

# Run in development mode
npm run tauri dev
```

### Build for Production

```bash
npm run tauri build
```

Binaries will be in `src-tauri/target/release/bundle/`

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
CURSEFORGE_API_KEY=your_api_key_here
```

Get your CurseForge API key at [console.curseforge.com](https://console.curseforge.com/)

> **Note:** Modrinth API doesn't require an API key.

## Creating Your First Modpack

### Step 1: Sign In

1. Launch MineSync
2. If prompted, install Java 21 from the startup modal
3. Click **Sign In** in the sidebar
4. Follow the Microsoft Device Code Flow:
   - A code will be displayed
   - Open the provided URL in your browser
   - Enter the code and sign in with your Microsoft account

### Step 2: Create an Instance

1. Go to **Home** (grid icon)
2. Click **+ New Instance**
3. Configure your instance:
   - **Name**: Give it a memorable name
   - **Minecraft Version**: Select your desired version
   - **Mod Loader**: Choose Fabric, Forge, NeoForge, or Quilt
   - **Loader Version**: Select the loader version

### Step 3: Add Mods

1. Open your instance
2. Go to the **Mods** tab
3. Click **Browse Mods**
4. Search for mods (searches both CurseForge and Modrinth)
5. Click **Install** on desired mods
6. Dependencies are resolved automatically

### Step 4: Launch the Game

1. Click **Play** on your instance
2. MineSync will:
   - Ensure Java 21 is available (managed runtime)
   - Download the Minecraft version (if needed)
   - Install the mod loader (if needed)
   - Launch the game with your mods
3. During pre-launch download, progress is kept visible even if you navigate to other pages
4. While the game is running, launch actions and mod edition actions are locked

## Sharing Your Modpack

### Generate a Share Code

1. Open your instance
2. Click **Share** button
3. A unique code is generated: `MINE-XXXXXX`
4. Share this code with your friends

### Join a Shared Modpack

1. Go to **Sync Hub** in the sidebar
2. Enter the share code
3. Preview the modpack contents
4. Click **Join** to sync

### Sync Updates

When the host updates their modpack:

1. You'll see a notification in Sync Hub
2. Review the changes (added/removed/updated mods)
3. Click **Confirm** to apply changes
4. Or **Reject** to keep your current setup

## Troubleshooting

### Common Issues

<details>
<summary><strong>Game won't launch</strong></summary>

1. Verify Java status in startup modal or **Settings > Java Runtime**
2. If needed, click **Install / Reinstall Java 21**
3. Confirm no active pre-launch download is already running
4. Check logs in `{data_dir}/logs/`
</details>

<details>
<summary><strong>Mods not loading</strong></summary>

1. Ensure mod loader is installed correctly
2. Check mod compatibility with your Minecraft version
3. Verify all dependencies are installed
</details>

<details>
<summary><strong>P2P connection failed</strong></summary>

1. Check your firewall settings
2. Ensure ports are not blocked
3. Try using a relay (automatic fallback)
</details>

## Next Steps

- [Architecture Overview](Architecture.md) - Understand how MineSync works
- [P2P Protocol](P2P-Protocol.md) - Learn about the sync mechanism
- [Contributing](Contributing.md) - Help improve MineSync
