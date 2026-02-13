# Building from Source

This guide covers building MineSync for development and production on all supported platforms.

## Prerequisites

### All Platforms

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | >= 18 | Frontend build |
| npm | >= 9 | Package management |
| Rust | >= 1.77 | Backend compilation |
| Git | Latest | Source control |

### Platform-Specific

<details>
<summary><strong>Windows</strong></summary>

1. **Visual Studio Build Tools**
   ```powershell
   winget install Microsoft.VisualStudio.2022.BuildTools
   ```
   
   Or download from [visualstudio.microsoft.com](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   
   Required components:
   - MSVC v143 - VS 2022 C++ x64/x86 build tools
   - Windows 10/11 SDK

2. **WebView2**
   
   Usually pre-installed on Windows 10/11. If not:
   ```powershell
   winget install Microsoft.EdgeWebView2Runtime
   ```

</details>

<details>
<summary><strong>macOS</strong></summary>

1. **Xcode Command Line Tools**
   ```bash
   xcode-select --install
   ```

2. **Homebrew** (optional, for additional tools)
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

</details>

<details>
<summary><strong>Linux (Ubuntu/Debian)</strong></summary>

```bash
sudo apt update
sudo apt install -y \
    libwebkit2gtk-4.1-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libgtk-3-dev
```

</details>

<details>
<summary><strong>Linux (Fedora)</strong></summary>

```bash
sudo dnf install -y \
    webkit2gtk4.1-devel \
    openssl-devel \
    curl \
    wget \
    file \
    libappindicator-gtk3-devel \
    librsvg2-devel \
    gtk3-devel
```

</details>

<details>
<summary><strong>Linux (Arch)</strong></summary>

```bash
sudo pacman -S --needed \
    webkit2gtk-4.1 \
    base-devel \
    curl \
    wget \
    file \
    openssl \
    libappindicator-gtk3 \
    librsvg \
    gtk3
```

</details>

## Clone Repository

```bash
git clone https://github.com/your-username/MineSync.git
cd MineSync
```

## Install Dependencies

### Frontend

```bash
npm install
```

### Backend

Rust dependencies are installed automatically on first build.

## Development Build

### Run Development Server

```bash
npm run tauri dev
```

This command:
1. Starts Vite dev server (frontend)
2. Compiles Rust code
3. Launches the app with hot reload

### Frontend Only

```bash
npm run dev
```

Opens at `http://localhost:5173`

### Backend Only

```bash
cd src-tauri
cargo check    # Check for errors
cargo build    # Build debug binary
cargo test     # Run tests
```

## Production Build

### Full Build

```bash
npm run tauri build
```

Build artifacts location:

| Platform | Location |
|----------|----------|
| Windows | `src-tauri/target/release/bundle/msi/` |
| macOS | `src-tauri/target/release/bundle/dmg/` |
| Linux | `src-tauri/target/release/bundle/deb/` or `appimage/` |

### Build Specific Target

```bash
# Windows MSI only
npm run tauri build -- --target x86_64-pc-windows-msvc

# macOS DMG only  
npm run tauri build -- --target x86_64-apple-darwin

# Linux AppImage only
npm run tauri build -- --bundles appimage
```

### Build Options

| Flag | Description |
|------|-------------|
| `--debug` | Include debug symbols |
| `--verbose` | Verbose output |
| `--bundles <type>` | Specific bundle type |
| `--target <triple>` | Cross-compile target |

## Cross-Compilation

### From macOS

```bash
# Build for Apple Silicon
npm run tauri build -- --target aarch64-apple-darwin

# Build for Intel Mac
npm run tauri build -- --target x86_64-apple-darwin

# Universal binary (both architectures)
npm run tauri build -- --target universal-apple-darwin
```

### From Linux

```bash
# Build AppImage
npm run tauri build -- --bundles appimage

# Build .deb package
npm run tauri build -- --bundles deb

# Build .rpm package (requires rpm tools)
npm run tauri build -- --bundles rpm
```

### Windows Cross-Compilation

Cross-compiling for Windows from Linux/macOS is complex. Recommended to use GitHub Actions for Windows builds.

## CI/CD Build

### GitHub Actions Example

```yaml
name: Build

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: ubuntu-latest
            target: x86_64-unknown-linux-gnu
          - os: macos-latest
            target: x86_64-apple-darwin
          - os: macos-latest
            target: aarch64-apple-darwin
          - os: windows-latest
            target: x86_64-pc-windows-msvc

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - name: Install dependencies (Ubuntu)
        if: matrix.os == 'ubuntu-latest'
        run: |
          sudo apt update
          sudo apt install -y libwebkit2gtk-4.1-dev libayatana-appindicator3-dev

      - name: Install frontend deps
        run: npm ci

      - name: Build
        run: npm run tauri build -- --target ${{ matrix.target }}
        env:
          CURSEFORGE_API_KEY: ${{ secrets.CURSEFORGE_API_KEY }}

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: minesync-${{ matrix.target }}
          path: src-tauri/target/${{ matrix.target }}/release/bundle/
```

## Build Optimization

### Release Profile

The `Cargo.toml` release profile:

```toml
[profile.release]
lto = true           # Link-time optimization
opt-level = 3        # Maximum optimization
codegen-units = 1    # Better optimization
strip = true         # Strip symbols
panic = "abort"      # Smaller binary
```

### Binary Size

Approximate sizes:

| Platform | Debug | Release |
|----------|-------|---------|
| Windows | ~150 MB | ~15 MB |
| macOS | ~120 MB | ~12 MB |
| Linux | ~100 MB | ~10 MB |

### Further Size Reduction

```toml
# Cargo.toml
[profile.release]
strip = "symbols"    # Strip debug symbols
lto = "fat"          # Aggressive LTO
```

## Troubleshooting

### Common Build Errors

<details>
<summary><strong>Rust compilation fails</strong></summary>

```bash
# Update Rust
rustup update

# Clear build cache
cd src-tauri
cargo clean
```

</details>

<details>
<summary><strong>Missing system libraries (Linux)</strong></summary>

```bash
# Ubuntu/Debian
sudo apt install libwebkit2gtk-4.1-dev

# Check pkg-config
pkg-config --libs webkit2gtk-4.1
```

</details>

<details>
<summary><strong>Node modules issues</strong></summary>

```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
```

</details>

<details>
<summary><strong>Tauri CLI version mismatch</strong></summary>

```bash
# Update Tauri CLI
npm update @tauri-apps/cli
```

</details>

### Build Logs

Enable verbose logging:

```bash
RUST_BACKTRACE=1 npm run tauri build -- --verbose
```

## Signing & Notarization

### Windows Code Signing

1. Obtain a code signing certificate
2. Set environment variables:
   ```powershell
   $env:TAURI_SIGNING_PRIVATE_KEY = "path/to/key.pfx"
   $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "password"
   ```

### macOS Notarization

1. Enroll in Apple Developer Program
2. Create App-specific password
3. Configure in `tauri.conf.json`:
   ```json
   {
     "bundle": {
       "macOS": {
         "signingIdentity": "Developer ID Application: Your Name",
         "providerShortName": "TEAM_ID"
       }
     }
   }
   ```
4. Set environment variables:
   ```bash
   export APPLE_ID="your@email.com"
   export APPLE_PASSWORD="app-specific-password"
   export APPLE_TEAM_ID="TEAM_ID"
   ```

## Next Steps

- [Getting Started](Getting-Started.md) - Run the app
- [Contributing](Contributing.md) - Development workflow
- [Architecture](Architecture.md) - Project structure
