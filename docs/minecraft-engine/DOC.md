# Minecraft Engine

## Vue d'ensemble

Le Minecraft Engine gere tout ce qui touche aux versions officielles de Minecraft : le manifeste de versions Mojang, le telechargement du client JAR, des libraries et des assets. C'est le coeur du launcher.

## Fichiers concernes

| Fichier | Role |
|---------|------|
| `src-tauri/src/services/minecraft.rs` | MinecraftService - manifeste, version detail, resolution des downloads |
| `src-tauri/src/commands/minecraft.rs` | Commands IPC (list_mc_versions, download_version, get_download_progress) |

## API Mojang

### Version Manifest

```
GET https://piston-meta.mojang.com/mc/game/version_manifest_v2.json
```

Retourne la liste de toutes les versions (release, snapshot, old_beta, old_alpha) avec pour chaque version :
- `id` : identifiant (ex: "1.21.4")
- `type` : "release" ou "snapshot"
- `url` : lien vers le JSON de detail de cette version
- `releaseTime` : date de sortie

Le manifeste est cache en memoire (`Mutex<Option<Vec<VersionEntry>>>`) pour eviter des appels repetes.

### Version Detail

Chaque version a un JSON detaille contenant :

| Champ | Contenu |
|-------|---------|
| `downloads.client` | URL + SHA1 + taille du client.jar |
| `libraries[]` | Liste des libraries Java necessaires |
| `assetIndex` | URL de l'index des assets |
| `javaVersion.majorVersion` | Version Java requise (ex: 21) |
| `mainClass` | Classe Java a lancer |
| `arguments.game` | Arguments du jeu (username, version, etc.) |
| `arguments.jvm` | Arguments JVM (-Xmx, natives, etc.) |

### Assets

L'asset index mappe chaque fichier (sons, textures, langues) a un hash SHA1. Les fichiers sont stockes dans :

```
assets/
├── indexes/
│   └── {version}.json    # Index des assets
└── objects/
    ├── 00/
    │   └── 00abc...      # Fichier asset (nomme par son hash)
    ├── 01/
    └── ...
```

URL de telechargement : `https://resources.download.minecraft.net/{hash[0:2]}/{hash}`

## Resolution des telechargements

La methode `resolve_downloads()` construit la liste complete des `DownloadTask` :

### 1. Client JAR

```
versions/{version_id}/{version_id}.jar
```

### 2. Libraries

Chaque library a des regles OS (`rules`) qui filtrent par plateforme :

```rust
fn should_include_library(lib: &Library) -> bool {
    // Si pas de rules -> inclure
    // Sinon, evaluer action "allow"/"disallow" par OS
}
```

Les libraries natives (`.dll`, `.dylib`, `.so`) sont gerees separement via le champ `natives` + `classifiers`.

Mapping OS :
| `cfg!(target_os)` | Mojang OS name |
|--------------------|----------------|
| windows | "windows" |
| macos | "osx" |
| linux | "linux" |

### 3. Assets

L'index des assets est telecharge et parse. Chaque objet genere un `DownloadTask` avec le hash comme nom de fichier.

## Structure locale

```
~/.minesync/
├── versions/
│   └── 1.21.4/
│       ├── 1.21.4.json    # Version detail JSON
│       └── 1.21.4.jar     # Client JAR
├── libraries/
│   └── com/mojang/...     # Libraries Java
└── assets/
    ├── indexes/
    └── objects/
```

## Types cles

```rust
pub struct VersionEntry {
    pub id: String,              // "1.21.4"
    pub version_type: String,    // "release" | "snapshot"
    pub url: String,             // URL du JSON de detail
    pub release_time: String,    // Date de sortie
}

pub struct VersionDetail {
    pub id: String,
    pub downloads: VersionDownloads,  // client.jar info
    pub libraries: Vec<Library>,       // Dependencies Java
    pub asset_index: AssetIndexInfo,   // Index des assets
    pub java_version: Option<JavaVersion>,
    pub main_class: String,            // Classe d'entree
    pub arguments: Option<VersionArguments>,
}

pub struct DownloadArtifact {
    pub sha1: String,
    pub size: u64,
    pub url: String,
    pub path: Option<String>,  // Chemin relatif dans libraries/
}
```

## Serde : alias vs rename

Les champs JSON Mojang utilisent du camelCase (`releaseTime`, `type`) mais les structs Rust utilisent du snake_case. On utilise `#[serde(alias = "type")]` (pas `rename`) car :

- `alias` : n'affecte que la **deserialisation** (JSON Mojang -> Rust)
- `rename` : affecte serialisation ET deserialisation

Comme ces structs sont aussi serialisees vers le frontend via Tauri IPC, `rename` causerait une incompatibilite avec les types TypeScript qui attendent `version_type`, pas `type`.
