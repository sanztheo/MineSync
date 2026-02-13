# Architecture Overview

MineSync is built with a modern, performant architecture using Tauri v2 for the desktop framework, Rust for the backend, and React for the frontend.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           MineSync App                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     Frontend (React)                         │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │   │
│  │  │  Home   │ │  Mods   │ │  Sync   │ │Settings │           │   │
│  │  │  Page   │ │ Browser │ │   Hub   │ │  Page   │           │   │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘           │   │
│  │       │           │           │           │                 │   │
│  │       └───────────┴─────┬─────┴───────────┘                 │   │
│  │                         │                                   │   │
│  │                    lib/tauri.ts (IPC Wrappers)              │   │
│  └─────────────────────────┼───────────────────────────────────┘   │
│                            │                                       │
│                     Tauri IPC Bridge                               │
│                            │                                       │
│  ┌─────────────────────────┼───────────────────────────────────┐   │
│  │                  Backend (Rust)                              │   │
│  │                         │                                    │   │
│  │              ┌──────────┴──────────┐                        │   │
│  │              │     Commands (48)    │                        │   │
│  │              └──────────┬──────────┘                        │   │
│  │                         │                                    │   │
│  │  ┌──────────────────────┼──────────────────────┐            │   │
│  │  │                  Services                    │            │   │
│  │  │                                              │            │   │
│  │  │  ┌────────┐ ┌────────┐ ┌────────┐          │            │   │
│  │  │  │  Auth  │ │Database│ │Download│          │            │   │
│  │  │  └────────┘ └────────┘ └────────┘          │            │   │
│  │  │                                              │            │   │
│  │  │  ┌────────┐ ┌────────┐ ┌────────┐          │            │   │
│  │  │  │Minecraft│ │ Loader │ │  Mods  │          │            │   │
│  │  │  └────────┘ └────────┘ └────────┘          │            │   │
│  │  │                                              │            │   │
│  │  │  ┌────────┐ ┌────────┐ ┌────────┐          │            │   │
│  │  │  │  P2P   │ │  Sync  │ │ Launch │          │            │   │
│  │  │  └────────┘ └────────┘ └────────┘          │            │   │
│  │  │                                              │            │   │
│  │  └──────────────────────────────────────────────┘            │   │
│  │                                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           ▼                  ▼                  ▼
    ┌──────────┐      ┌──────────┐      ┌──────────┐
    │  SQLite  │      │  libp2p  │      │   APIs   │
    │    DB    │      │ Network  │      │CF/MR/MOJ │
    └──────────┘      └──────────┘      └──────────┘
```

## Project Structure

```
MineSync/
├── src/                          # Frontend (React + TypeScript)
│   ├── components/
│   │   ├── layout/              # App shell components
│   │   │   ├── TitleBar.tsx     # Custom window title bar
│   │   │   └── Sidebar.tsx      # Navigation sidebar
│   │   ├── java/                # Java runtime setup UI
│   │   │   └── JavaSetupModal.tsx
│   │   └── ui/                  # Reusable UI components
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Input.tsx
│   │       ├── Modal.tsx
│   │       ├── Badge.tsx
│   │       ├── Toggle.tsx
│   │       └── Slider.tsx
│   ├── pages/                   # Route pages
│   │   ├── Home.tsx             # Instance grid
│   │   ├── BrowseMods.tsx       # Mod search
│   │   ├── SyncHub.tsx          # P2P sync interface
│   │   ├── InstanceDetail.tsx   # Instance management
│   │   ├── Settings.tsx         # App configuration
│   │   └── Auth.tsx             # Microsoft sign-in
│   ├── hooks/
│   │   ├── use-tauri.ts         # Generic Tauri fetch hook
│   │   ├── use-game-status.ts   # Launch orchestration + game polling
│   │   ├── use-java-runtime.ts  # Global Java runtime status
│   │   └── use-debounce.ts      # Debounce utility
│   └── lib/
│       ├── types.ts             # TypeScript types (mirrors Rust)
│       └── tauri.ts             # IPC wrapper functions
│
├── src-tauri/                    # Backend (Rust)
│   └── src/
│       ├── lib.rs               # Tauri entry point
│       ├── main.rs              # Binary entry
│       ├── errors.rs            # Error types (thiserror)
│       ├── models/              # Data structures
│       │   ├── account.rs       # Microsoft account
│       │   ├── auth.rs          # Auth tokens
│       │   ├── instance.rs      # Minecraft instance
│       │   ├── mod_info.rs      # Mod metadata
│       │   ├── mod_platform.rs  # CF/Modrinth types
│       │   ├── java.rs          # Java runtime status/install types
│       │   ├── loader.rs        # Mod loader profiles
│       │   ├── launch.rs        # Launch configuration
│       │   └── sync.rs          # Sync session/manifest
│       ├── services/            # Business logic
│       │   ├── auth.rs          # Microsoft OAuth
│       │   ├── database.rs      # SQLite operations
│       │   ├── download.rs      # File downloads
│       │   ├── java.rs          # Java runtime manager (Temurin 21)
│       │   ├── minecraft.rs     # Mojang API
│       │   ├── launch.rs        # Game launcher
│       │   ├── loader/          # Mod loader installers
│       │   ├── mod_platform/    # Mod APIs
│       │   ├── p2p/             # libp2p networking
│       │   └── sync_protocol/   # Sync logic
│       └── commands/            # Tauri IPC handlers
│           ├── auth.rs
│           ├── instance.rs
│           ├── java.rs
│           ├── minecraft.rs
│           ├── mods.rs
│           ├── p2p.rs
│           ├── sync.rs
│           ├── sync_protocol.rs
│           ├── account.rs
│           ├── install.rs
│           ├── loader.rs
│           └── launch.rs
│
└── docs/                         # Documentation
```

## Backend Services

### Auth Service (`services/auth.rs`)

Handles Microsoft authentication using Device Code Flow:

```
┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐
│  User   │      │MineSync │      │Microsoft│      │  Xbox   │
└────┬────┘      └────┬────┘      └────┬────┘      └────┬────┘
     │                │                │                │
     │  Start Auth    │                │                │
     │───────────────►│                │                │
     │                │  Device Code   │                │
     │                │───────────────►│                │
     │                │◄───────────────│                │
     │  Display Code  │                │                │
     │◄───────────────│                │                │
     │                │                │                │
     │  (User enters code in browser)  │                │
     │                │                │                │
     │                │  Poll Token    │                │
     │                │───────────────►│                │
     │                │  Access Token  │                │
     │                │◄───────────────│                │
     │                │                │                │
     │                │     Xbox Auth  │                │
     │                │────────────────────────────────►│
     │                │     XSTS Token │                │
     │                │◄────────────────────────────────│
     │                │                │                │
     │                │  Minecraft Auth (Mojang API)   │
     │                │                │                │
     │  Auth Complete │                │                │
     │◄───────────────│                │                │
```

### Database Service (`services/database.rs`)

SQLite with WAL mode for concurrent access:

- **Connection pooling** via `Arc<Mutex<Connection>>`
- **Migrations** applied on startup
- **Foreign keys** enforced
- **Soft delete** pattern (is_active flag)

### Download Service (`services/download.rs`)

Parallel file downloads with integrity verification:

- **Semaphore** limits concurrent downloads (default: 4)
- **SHA1 verification** for all downloaded files
- **Progress tracking** via broadcast channels
- **Resume support** for interrupted downloads

### Java Runtime Service (`services/java.rs`)

Automatic Java setup for launch reliability:

- **Single runtime policy**: Java 21
- **Managed runtime** in app data directory (`java-runtime/temurin-21`)
- **Auto-install workflow**:
  - download from Adoptium API,
  - checksum verification (`SHA-256`),
  - archive extraction (`zip`/`tar.gz`),
  - `java -version` validation.
- **Startup UX**:
  - frontend provider polls `get_java_status`,
  - blocking modal prompts install when Java is missing,
  - Launch buttons stay disabled until Java is ready.

### P2P Service (`services/p2p/`)

libp2p-based peer-to-peer networking:

```
┌─────────────────────────────────────────────────────────────┐
│                     P2P Service                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│  │   Swarm     │    │  Behaviour  │    │   Codec     │    │
│  │  (Network)  │◄──►│  (Protocol) │◄──►│   (CBOR)    │    │
│  └─────────────┘    └─────────────┘    └─────────────┘    │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Transport Stack                    │   │
│  │  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ │   │
│  │  │  TCP  │ │ QUIC  │ │ Noise │ │ Yamux │ │ Relay │ │   │
│  │  └───────┘ └───────┘ └───────┘ └───────┘ └───────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Frontend Architecture

### Component Pattern

All UI components follow a consistent pattern:

```typescript
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ 
  variant = 'primary', 
  size = 'md',
  children,
  ...props 
}: ButtonProps): ReactNode {
  // Implementation
}
```

### IPC Communication

All Tauri commands are wrapped in `lib/tauri.ts`:

```typescript
// lib/tauri.ts
export async function listInstances(): Promise<Instance[]> {
  return invoke<Instance[]>('list_instances');
}

// Usage in component
const { data, loading, error } = useTauriCommand(listInstances);
```

### State Management

- **Local state** via `useState` (no global state manager)
- **Server state** via `useTauriCommand` hook
- **URL state** via React Router

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Data Flow Example                       │
│                   (Installing a Mod)                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  User clicks "Install"                                      │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐                                           │
│  │ BrowseMods  │  → invoke('install_mod', { modId, ... })  │
│  │    Page     │                                           │
│  └─────────────┘                                           │
│         │                                                   │
│         ▼ (IPC)                                            │
│  ┌─────────────┐                                           │
│  │   Command   │  → Validate input                         │
│  │install_mod()│  → Check dependencies                     │
│  └─────────────┘                                           │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐                                           │
│  │Mod Platform │  → Fetch mod details from CF/Modrinth     │
│  │  Service    │  → Resolve dependencies                   │
│  └─────────────┘                                           │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐                                           │
│  │  Download   │  → Download mod + dependencies            │
│  │  Service    │  → Verify SHA1 checksums                  │
│  └─────────────┘                                           │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐                                           │
│  │  Database   │  → Save mod info to instance_mods         │
│  │  Service    │                                           │
│  └─────────────┘                                           │
│         │                                                   │
│         ▼                                                   │
│  Return Result → UI updates                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Error Handling

### Rust Backend

All errors use `thiserror` for type-safe error handling:

```rust
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),
    
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),
    
    #[error("Authentication failed: {0}")]
    Auth(String),
    
    // ... more variants
}
```

### Frontend

Errors are caught and displayed via the `useTauriCommand` hook:

```typescript
const { data, error, loading } = useTauriCommand(fetchData);

if (error) {
  return <ErrorMessage error={error} />;
}
```

## Performance Considerations

1. **Async Operations**: All I/O operations use `tokio::spawn()`
2. **Connection Pooling**: Database connections are reused
3. **Parallel Downloads**: Semaphore-controlled concurrent downloads
4. **Lazy Loading**: Routes are loaded on demand
5. **Event Streaming**: P2P events use broadcast channels

## Security

1. **No Electron**: Tauri's Rust core has smaller attack surface
2. **CSP**: Content Security Policy configured
3. **Token Storage**: Auth tokens stored in secure SQLite
4. **P2P Encryption**: All P2P traffic encrypted with noise protocol
5. **API Keys**: Environment variables, never committed

## Next Steps

- [P2P Protocol](P2P-Protocol.md) - Deep dive into networking
- [Database Schema](Database-Schema.md) - Data model reference
- [API Reference](API-Reference.md) - All Tauri commands
