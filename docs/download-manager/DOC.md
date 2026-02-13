# Download Manager

## Vue d'ensemble

Le `DownloadService` gere les telechargements de fichiers avec parallelisme, retry, verification de hash et suivi de progression. Il est utilise par le Minecraft Engine (client JAR, libraries, assets) et le Sync Protocol (telechargement de mods).

## Fichier concerne

| Fichier | Role |
|---------|------|
| `src-tauri/src/services/download.rs` | DownloadService + DownloadTask + DownloadProgress |

## DownloadTask

Chaque fichier a telecharger est represente par un `DownloadTask` :

```rust
pub struct DownloadTask {
    pub url: String,
    pub dest: PathBuf,
    pub sha1: Option<String>,
    pub size: u64,
}
```

## Telechargement parallele

Les telechargements sont executes en parallele avec une limite de concurrence :

```rust
const MAX_CONCURRENT: usize = 4;

let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT));

for task in tasks {
    let permit = semaphore.clone().acquire_owned().await?;
    tokio::spawn(async move {
        download_file(&task).await;
        drop(permit);  // Libere le slot
    });
}
```

## Retry avec backoff

Chaque fichier a droit a 3 tentatives avec backoff exponentiel :

| Tentative | Delai avant retry |
|-----------|-------------------|
| 1ere | 0s (immediate) |
| 2eme | 1s |
| 3eme | 2s |

Si les 3 tentatives echouent, le fichier est marque comme "failed" dans la progression.

## Cache

Avant de telecharger, le service verifie si le fichier existe deja avec la bonne taille :

```rust
fn filter_cached(tasks: &[DownloadTask]) -> Vec<&DownloadTask> {
    tasks.iter()
        .filter(|t| {
            if let Ok(meta) = std::fs::metadata(&t.dest) {
                meta.len() != t.size  // Telecharger seulement si taille differente
            } else {
                true  // Fichier n'existe pas -> telecharger
            }
        })
        .collect()
}
```

## Verification SHA1

Apres telechargement, le hash SHA1 du fichier est compare au hash attendu :

```rust
use sha1::{Sha1, Digest};

fn verify_sha1(path: &Path, expected: &str) -> bool {
    let mut hasher = Sha1::new();
    let mut file = File::open(path)?;
    io::copy(&mut file, &mut hasher)?;
    let result = format!("{:x}", hasher.finalize());
    result == expected
}
```

Si le hash ne correspond pas, le fichier est supprime et le telechargement est retente.

## Suivi de progression

La progression est trackee via un `Arc<Mutex<DownloadProgress>>` :

```rust
pub struct DownloadProgress {
    pub total_files: u32,
    pub completed_files: u32,
    pub failed_files: u32,
    pub total_bytes: u64,
    pub completed_bytes: u64,
    pub state: DownloadState,
}

pub enum DownloadState {
    Idle,
    Downloading,
    Completed,
    Failed,
}
```

Le frontend peut interroger `get_download_progress` a tout moment pour afficher une barre de progression.

## Utilisation

### Par le Minecraft Engine

```rust
let tasks = minecraft_service.resolve_downloads(&version_detail).await?;
download_service.download_all(tasks).await?;
```

### Par le Sync Protocol

```rust
// Lors de l'application d'un diff
for mod_entry in diff.to_add {
    download_service.download_file(&DownloadTask {
        url: mod_entry.download_url,
        dest: instance_path.join("mods").join(&mod_entry.file_name),
        sha1: mod_entry.file_hash,
        size: 0,  // Taille inconnue pour les mods
    }).await?;
}
```

## Dependances

| Crate | Usage |
|-------|-------|
| `reqwest` | Client HTTP avec rustls-tls |
| `sha1` | Verification de hash |
| `tokio` | Async runtime + semaphore |
