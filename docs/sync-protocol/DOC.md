# Sync Protocol

## Vue d'ensemble

Le Sync Protocol gere la logique de synchronisation des modpacks entre joueurs. Il ne gere pas le transport (c'est le role du P2P Network) mais se concentre sur :
- Le calcul du **diff** entre deux manifestes de modpacks
- La **confirmation** explicite par l'utilisateur avant toute modification
- L'**application** du diff (telechargement/suppression de mods)

## Fichiers concernes

| Fichier | Role |
|---------|------|
| `src-tauri/src/services/sync_protocol/mod.rs` | SyncProtocolService, PendingSync |
| `src-tauri/src/services/sync_protocol/manifest_diff.rs` | compute_diff(), ManifestDiff |
| `src-tauri/src/services/sync_protocol/apply_diff.rs` | apply_diff(), ApplyResult |
| `src-tauri/src/commands/sync_protocol.rs` | preview_sync, confirm_sync, reject_sync, apply_sync |
| `src-tauri/src/commands/sync.rs` | create_sync_session, join_sync_session |

## Concept : Manifeste

Un manifeste est la description complete d'un modpack :

```rust
pub struct SyncManifest {
    pub instance_id: String,
    pub minecraft_version: String,
    pub loader_type: String,
    pub loader_version: Option<String>,
    pub mods: Vec<SyncModEntry>,
}

pub struct SyncModEntry {
    pub mod_name: String,
    pub mod_slug: String,
    pub version: String,
    pub file_name: String,
    pub file_hash: Option<String>,
    pub source: String,          // "curseforge" | "modrinth"
    pub download_url: String,
}
```

## Calcul du diff

La fonction `compute_diff()` compare deux manifestes et produit un `ManifestDiff` :

### Algorithme

1. Indexer les mods du manifeste local par `mod_name`
2. Indexer les mods du manifeste distant par `mod_name`
3. Pour chaque mod distant :
   - Si absent localement -> `to_add`
   - Si present mais hash different -> `to_update`
   - Si present et hash identique -> rien
4. Pour chaque mod local :
   - Si absent dans le distant -> `to_remove`
5. Comparer les versions Minecraft et loader -> `version_mismatch`

### Comparaison des mods

La comparaison se fait en deux niveaux :
1. **Hash d'abord** : Si `file_hash` est disponible des deux cotes, comparer les hashs
2. **Version ensuite** : Si les hashs ne sont pas disponibles, comparer les version strings

```rust
pub struct ManifestDiff {
    pub to_add: Vec<SyncModEntry>,      // Mods a telecharger
    pub to_remove: Vec<SyncModEntry>,   // Mods a supprimer
    pub to_update: Vec<ModUpdate>,      // Mods a mettre a jour
    pub version_mismatch: Option<VersionMismatch>,
}

pub struct ModUpdate {
    pub name: String,
    pub local_version: String,
    pub remote_version: String,
    pub remote_file_name: String,
    pub remote_file_hash: Option<String>,
    pub remote_download_url: String,
}

pub struct VersionMismatch {
    pub local_mc_version: String,
    pub remote_mc_version: String,
    pub local_loader: String,
    pub remote_loader: String,
    pub local_loader_version: Option<String>,
    pub remote_loader_version: Option<String>,
}
```

## Flow de synchronisation

### Etape 1 : Reception du manifeste

Quand un receiver se connecte via P2P et recoit le manifeste du host :

```rust
service.create_pending_sync(
    session_id,
    remote_peer_id,
    local_manifest,
    remote_manifest,
) -> PendingSync
```

Le diff est calcule et stocke. Le status est `AwaitingConfirmation`.

### Etape 2 : Preview (frontend)

Le frontend affiche le diff a l'utilisateur :
- Nombre de mods a ajouter / supprimer / mettre a jour
- Avertissement si version Minecraft ou loader differents
- Details de chaque modification

### Etape 3 : Confirmation ou rejet

L'utilisateur choisit explicitement :

```rust
// Confirmer
service.confirm_sync(session_id) -> PendingSync { status: Syncing }

// Rejeter
service.reject_sync(session_id) -> PendingSync { status: Rejected }
```

**Aucune modification n'est faite sans confirmation explicite.**

### Etape 4 : Application

Si confirme, `apply_diff()` execute les modifications :

```rust
pub struct ApplyResult {
    pub mods_added: u32,
    pub mods_removed: u32,
    pub mods_updated: u32,
    pub errors: Vec<String>,
}
```

1. **to_add** : Telecharge chaque mod depuis son `download_url` dans le dossier `mods/` de l'instance
2. **to_remove** : Supprime les fichiers correspondants
3. **to_update** : Supprime l'ancien fichier, telecharge le nouveau

Les telechargements utilisent le `DownloadService` pour beneficier du retry et de la verification SHA1.

## PendingSyncStatus

```rust
pub enum PendingSyncStatus {
    AwaitingConfirmation,  // Diff calcule, en attente de decision
    Syncing,               // Confirmation recue, application en cours
    Completed,             // Sync terminee avec succes
    Rejected,              // Utilisateur a rejete le sync
}
```

## Principe important : pas d'auto-sync

Le design de MineSync impose que **chaque synchronisation soit confirmee par le receveur**. Le host ne peut pas forcer un sync. Cela garantit que :
- L'utilisateur garde le controle de ses mods
- Pas de modification surprise pendant une partie
- L'utilisateur peut inspecter les changements avant de les appliquer
