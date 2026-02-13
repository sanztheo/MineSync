# API Reference

MineSync exposes 38 Tauri IPC commands for frontend-backend communication. All commands are invoked via `@tauri-apps/api`.

## Command Categories

| Category | Commands | Description |
|----------|----------|-------------|
| [Authentication](#authentication) | 5 | Microsoft OAuth flow |
| [Instances](#instances) | 4 | Modpack management |
| [Minecraft](#minecraft) | 3 | Version management |
| [Mods](#mods) | 4 | Mod search & install |
| [P2P](#p2p) | 5 | Peer-to-peer networking |
| [Sync](#sync) | 6 | Modpack synchronization |
| [Loaders](#loaders) | 2 | Mod loader installation |
| [Launch](#launch) | 3 | Game launching |
| [Settings](#settings) | 6 | App configuration |

---

## Authentication

### `start_auth`

Initiates Microsoft Device Code Flow authentication.

**Parameters:** None

**Returns:**
```typescript
interface DeviceCodeResponse {
  device_code: string;
  user_code: string;       // Code to display to user
  verification_uri: string; // URL for user to visit
  expires_in: number;      // Seconds until expiration
  interval: number;        // Polling interval
}
```

**Example:**
```typescript
const response = await invoke<DeviceCodeResponse>('start_auth');
// Display response.user_code and response.verification_uri to user
```

---

### `poll_auth`

Polls for authentication completion after user enters code.

**Parameters:**
```typescript
interface PollAuthParams {
  device_code: string;  // From start_auth response
}
```

**Returns:**
```typescript
interface AuthResult {
  status: 'pending' | 'completed' | 'expired' | 'error';
  account?: Account;
  error?: string;
}
```

**Example:**
```typescript
const result = await invoke<AuthResult>('poll_auth', { 
  device_code: deviceCode 
});
if (result.status === 'completed') {
  // User authenticated successfully
}
```

---

### `get_profile`

Gets the currently authenticated user profile.

**Parameters:** None

**Returns:**
```typescript
interface Account {
  id: string;
  uuid: string;
  username: string;
  created_at: string;
}
```

**Throws:** Error if not authenticated

---

### `logout`

Signs out the current user.

**Parameters:** None

**Returns:** `void`

---

### `refresh_auth`

Refreshes expired access tokens.

**Parameters:** None

**Returns:**
```typescript
interface RefreshResult {
  success: boolean;
  error?: string;
}
```

---

## Instances

### `list_instances`

Lists all user instances (modpacks).

**Parameters:** None

**Returns:**
```typescript
interface Instance {
  id: string;
  name: string;
  mc_version: string;
  loader_type: 'vanilla' | 'fabric' | 'forge' | 'neoforge' | 'quilt';
  loader_version: string | null;
  mod_count: number;
  sync_status: 'inactive' | 'active' | 'syncing';
  last_played: string | null;
  created_at: string;
  updated_at: string;
}

// Returns: Instance[]
```

---

### `get_instance`

Gets detailed information about a specific instance.

**Parameters:**
```typescript
interface GetInstanceParams {
  id: string;
}
```

**Returns:** `Instance` with full details including mods list

---

### `create_instance`

Creates a new Minecraft instance.

**Parameters:**
```typescript
interface CreateInstanceParams {
  name: string;
  mc_version: string;
  loader_type?: 'vanilla' | 'fabric' | 'forge' | 'neoforge' | 'quilt';
  loader_version?: string;
}
```

**Returns:** `Instance` - The created instance

---

### `delete_instance`

Soft-deletes an instance.

**Parameters:**
```typescript
interface DeleteInstanceParams {
  id: string;
}
```

**Returns:** `void`

---

## Minecraft

### `list_mc_versions`

Lists available Minecraft versions from Mojang.

**Parameters:**
```typescript
interface ListVersionsParams {
  include_snapshots?: boolean;  // Default: false
}
```

**Returns:**
```typescript
interface McVersion {
  id: string;           // e.g., "1.20.4"
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha';
  release_time: string;
}

// Returns: McVersion[]
```

---

### `download_version`

Downloads a Minecraft version (client JAR, libraries, assets).

**Parameters:**
```typescript
interface DownloadVersionParams {
  version: string;
}
```

**Returns:**
```typescript
interface DownloadResult {
  success: boolean;
  path: string;         // Path to downloaded version
  error?: string;
}
```

**Note:** Progress events emitted via Tauri events.

---

### `get_download_progress`

Gets current download progress.

**Parameters:** None

**Returns:**
```typescript
interface DownloadProgress {
  status: 'idle' | 'downloading' | 'completed' | 'error';
  current_file: string;
  downloaded_bytes: number;
  total_bytes: number;
  files_completed: number;
  files_total: number;
}
```

---

## Mods

### `search_mods`

Searches for mods across CurseForge and Modrinth.

**Parameters:**
```typescript
interface SearchModsParams {
  query: string;
  mc_version?: string;
  loader?: 'fabric' | 'forge' | 'neoforge' | 'quilt';
  source?: 'curseforge' | 'modrinth' | 'all';
  limit?: number;        // Default: 20
  offset?: number;       // Default: 0
}
```

**Returns:**
```typescript
interface ModSearchResult {
  id: string;
  name: string;
  slug: string;
  summary: string;
  author: string;
  downloads: number;
  icon_url: string | null;
  source: 'curseforge' | 'modrinth';
  categories: string[];
}

// Returns: ModSearchResult[]
```

---

### `get_mod_details`

Gets detailed information about a specific mod.

**Parameters:**
```typescript
interface GetModDetailsParams {
  source: 'curseforge' | 'modrinth';
  project_id: string;
}
```

**Returns:**
```typescript
interface ModDetails {
  id: string;
  name: string;
  slug: string;
  description: string;    // Full description (markdown)
  author: string;
  downloads: number;
  icon_url: string | null;
  source: 'curseforge' | 'modrinth';
  categories: string[];
  links: {
    website?: string;
    source?: string;
    wiki?: string;
  };
  created_at: string;
  updated_at: string;
}
```

---

### `get_mod_versions`

Gets available versions for a mod.

**Parameters:**
```typescript
interface GetModVersionsParams {
  source: 'curseforge' | 'modrinth';
  project_id: string;
  mc_version?: string;
  loader?: string;
}
```

**Returns:**
```typescript
interface ModVersion {
  id: string;
  version_number: string;
  name: string;
  mc_versions: string[];
  loaders: string[];
  download_url: string;
  file_name: string;
  file_size: number;
  file_hash: string;
  release_type: 'release' | 'beta' | 'alpha';
  dependencies: ModDependency[];
  uploaded_at: string;
}

interface ModDependency {
  project_id: string;
  type: 'required' | 'optional' | 'incompatible';
}

// Returns: ModVersion[]
```

---

### `resolve_mod_dependencies`

Resolves all dependencies for a mod.

**Parameters:**
```typescript
interface ResolveDepsParams {
  source: 'curseforge' | 'modrinth';
  project_id: string;
  version_id: string;
  mc_version: string;
  loader: string;
}
```

**Returns:**
```typescript
interface DependencyResolution {
  mod: ModVersion;
  dependencies: ModVersion[];
  conflicts: string[];     // List of incompatible mods
}
```

---

## P2P

### `start_p2p`

Starts the P2P networking service.

**Parameters:** None

**Returns:**
```typescript
interface P2PStatus {
  running: boolean;
  peer_id: string;
  listening_addresses: string[];
}
```

---

### `stop_p2p`

Stops the P2P networking service.

**Parameters:** None

**Returns:** `void`

---

### `get_p2p_status`

Gets current P2P service status.

**Parameters:** None

**Returns:** `P2PStatus`

---

### `share_modpack`

Generates a share code for an instance.

**Parameters:**
```typescript
interface ShareModpackParams {
  instance_id: string;
}
```

**Returns:**
```typescript
interface ShareResult {
  share_code: string;     // e.g., "MINE-ABC123"
  session_id: string;
}
```

---

### `join_via_code`

Joins a shared modpack via code.

**Parameters:**
```typescript
interface JoinParams {
  share_code: string;     // e.g., "MINE-ABC123"
}
```

**Returns:**
```typescript
interface JoinResult {
  success: boolean;
  session_id?: string;
  manifest?: ModpackManifest;
  error?: string;
}
```

---

## Sync

### `preview_sync`

Previews changes before applying sync.

**Parameters:**
```typescript
interface PreviewSyncParams {
  session_id: string;
}
```

**Returns:**
```typescript
interface SyncPreview {
  additions: ManifestMod[];
  removals: ManifestMod[];
  updates: ModUpdate[];
}

interface ModUpdate {
  mod: ManifestMod;
  old_version: string;
  new_version: string;
}
```

---

### `get_pending_sync`

Gets pending sync request details.

**Parameters:**
```typescript
interface GetPendingSyncParams {
  session_id: string;
}
```

**Returns:**
```typescript
interface PendingSync {
  id: string;
  session_id: string;
  status: 'awaiting_confirmation' | 'syncing' | 'completed' | 'rejected';
  preview: SyncPreview;
  received_at: string;
}
```

---

### `confirm_sync`

Confirms and applies a pending sync.

**Parameters:**
```typescript
interface ConfirmSyncParams {
  pending_sync_id: string;
}
```

**Returns:** `void`

---

### `reject_sync`

Rejects a pending sync request.

**Parameters:**
```typescript
interface RejectSyncParams {
  pending_sync_id: string;
}
```

**Returns:** `void`

---

### `apply_sync`

Manually triggers sync with host.

**Parameters:**
```typescript
interface ApplySyncParams {
  session_id: string;
}
```

**Returns:**
```typescript
interface ApplySyncResult {
  success: boolean;
  changes_applied: number;
  error?: string;
}
```

---

### `compute_manifest_diff`

Computes diff between local and remote manifests.

**Parameters:**
```typescript
interface ComputeDiffParams {
  local_instance_id: string;
  remote_manifest: ModpackManifest;
}
```

**Returns:** `SyncPreview`

---

## Loaders

### `list_loader_versions`

Lists available versions for a mod loader.

**Parameters:**
```typescript
interface ListLoaderVersionsParams {
  loader: 'fabric' | 'forge' | 'neoforge' | 'quilt';
  mc_version: string;
}
```

**Returns:**
```typescript
interface LoaderVersion {
  version: string;
  stable: boolean;
  mc_version: string;
}

// Returns: LoaderVersion[]
```

---

### `install_loader`

Installs a mod loader for an instance.

**Parameters:**
```typescript
interface InstallLoaderParams {
  instance_id: string;
  loader: 'fabric' | 'forge' | 'neoforge' | 'quilt';
  version: string;
}
```

**Returns:**
```typescript
interface InstallResult {
  success: boolean;
  error?: string;
}
```

---

## Launch

### `launch_instance`

Launches Minecraft with the specified instance.

**Parameters:**
```typescript
interface LaunchParams {
  instance_id: string;
}
```

**Returns:**
```typescript
interface LaunchResult {
  success: boolean;
  pid?: number;
  error?: string;
}
```

---

### `get_game_status`

Gets current game running status.

**Parameters:** None

**Returns:**
```typescript
type GameStatus = 
  | { status: 'idle' }
  | { status: 'preparing' }
  | { status: 'running'; pid: number }
  | { status: 'crashed'; exit_code: number; message: string };
```

---

### `kill_game`

Forcefully terminates the running game.

**Parameters:** None

**Returns:** `void`

---

## Settings

### `get_settings`

Gets all application settings.

**Returns:**
```typescript
interface AppSettings {
  ram_min: number;
  ram_max: number;
  java_path: string | null;
  close_on_launch: boolean;
  theme: 'dark' | 'light' | 'system';
}
```

---

### `update_settings`

Updates application settings.

**Parameters:** `Partial<AppSettings>`

**Returns:** `void`

---

## Error Handling

All commands may throw errors with this structure:

```typescript
interface TauriError {
  message: string;
  kind: string;
}
```

**Example error handling:**
```typescript
try {
  const instances = await invoke<Instance[]>('list_instances');
} catch (error) {
  console.error('Failed to load instances:', error);
}
```

## Events

MineSync emits events for async operations:

| Event | Payload | Description |
|-------|---------|-------------|
| `download-progress` | `DownloadProgress` | Download status update |
| `p2p-peer-connected` | `{ peer_id: string }` | Peer connected |
| `p2p-peer-disconnected` | `{ peer_id: string }` | Peer disconnected |
| `sync-update` | `SyncPreview` | New sync available |
| `game-status` | `GameStatus` | Game status changed |

**Listening to events:**
```typescript
import { listen } from '@tauri-apps/api/event';

const unlisten = await listen<DownloadProgress>('download-progress', (event) => {
  console.log('Progress:', event.payload);
});

// Later: cleanup
unlisten();
```

## Next Steps

- [Architecture](Architecture.md) - How commands fit in
- [Database Schema](Database-Schema.md) - Data model
- [Contributing](Contributing.md) - Add new commands
