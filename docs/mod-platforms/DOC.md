# Mod Platforms

## Vue d'ensemble

MineSync integre deux plateformes de mods Minecraft : **CurseForge** et **Modrinth**. Un client unifie (`UnifiedModClient`) permet de rechercher et telecharger des mods depuis les deux sources en parallele.

## Fichiers concernes

| Fichier | Role |
|---------|------|
| `src-tauri/src/services/mod_platform/mod.rs` | UnifiedModClient + trait ModPlatform |
| `src-tauri/src/services/mod_platform/curseforge.rs` | CurseForgeClient |
| `src-tauri/src/services/mod_platform/modrinth.rs` | ModrinthClient |
| `src-tauri/src/commands/mods.rs` | search_mods, get_mod_details, get_mod_versions |
| `src/pages/BrowseMods.tsx` | Interface de recherche unifiee |

## Trait ModPlatform

Les deux clients implementent un trait commun :

```rust
#[async_trait]
pub trait ModPlatform {
    async fn search_mods(&self, filters: &SearchFilters) -> AppResult<SearchResponse>;
    async fn get_mod(&self, project_id: &str) -> AppResult<ModDetails>;
    async fn get_versions(
        &self,
        project_id: &str,
        game_version: Option<&str>,
        loader: Option<&str>,
    ) -> AppResult<Vec<ModVersionInfo>>;
}
```

## CurseForge

### API

- **Base URL :** `https://api.curseforge.com`
- **Authentification :** API Key requise (header `x-api-key`)
- **Game ID Minecraft :** `432`
- **Class ID Mods :** `6`

### Endpoints utilises

| Endpoint | Usage |
|----------|-------|
| `GET /v1/mods/search` | Recherche de mods avec filtres |
| `GET /v1/mods/{modId}` | Details d'un mod |
| `GET /v1/mods/{modId}/files` | Versions/fichiers d'un mod |

### Parametres de recherche

```
?gameId=432
&classId=6
&searchFilter={query}
&gameVersion={mc_version}
&modLoaderType={loader_id}
&sortField={sort}
&sortOrder=desc
&index={offset}
&pageSize={limit}
```

Mapping des loaders CurseForge :
| Loader | modLoaderType |
|--------|---------------|
| Forge | 1 |
| Fabric | 4 |
| Quilt | 5 |
| NeoForge | 6 |

## Modrinth

### API

- **Base URL :** `https://api.modrinth.com`
- **Authentification :** Pas de cle requise, mais User-Agent obligatoire
- **Header :** `User-Agent: MineSync/1.0`

### Endpoints utilises

| Endpoint | Usage |
|----------|-------|
| `GET /v2/search` | Recherche de mods |
| `GET /v2/project/{id}` | Details d'un mod |
| `GET /v2/project/{id}/version` | Versions d'un mod |

### Parametres de recherche

```
?query={query}
&facets=[["categories:{loader}"],["versions:{mc_version}"],["project_type:mod"]]
&index={sort}
&offset={offset}
&limit={limit}
```

## UnifiedModClient

Le client unifie lance les recherches en parallele sur les deux plateformes :

```rust
pub struct UnifiedModClient {
    curseforge: CurseForgeClient,
    modrinth: ModrinthClient,
}

impl UnifiedModClient {
    pub async fn search(&self, filters: &SearchFilters) -> AppResult<SearchResponse> {
        // Lance les deux recherches en parallele via tokio::join!
        // Fusionne et deduplique les resultats
    }
}
```

## Types communs

```rust
pub struct ModDetails {
    pub id: String,
    pub slug: String,
    pub name: String,
    pub description: String,
    pub author: String,
    pub downloads: u64,
    pub icon_url: Option<String>,
    pub source: String,          // "curseforge" | "modrinth"
    pub categories: Vec<String>,
    pub game_versions: Vec<String>,
    pub loaders: Vec<String>,
}

pub struct ModVersionInfo {
    pub id: String,
    pub version_number: String,
    pub game_versions: Vec<String>,
    pub loaders: Vec<String>,
    pub file_name: String,
    pub file_size: u64,
    pub file_url: String,
    pub file_hash: Option<String>,
}

pub struct SearchFilters {
    pub query: Option<String>,
    pub game_version: Option<String>,
    pub loader: Option<String>,
    pub category: Option<String>,
    pub sort: Option<String>,     // "relevance" | "downloads" | "updated" | "newest"
    pub offset: Option<u32>,
    pub limit: Option<u32>,
}
```

## Configuration

La cle API CurseForge est optionnelle. Sans elle, seul Modrinth est utilise :

```rust
// La cle est lue depuis l'env var CURSEFORGE_API_KEY
UnifiedModClient::new(curseforge_api_key: Option<String>)
```

## Interface utilisateur

La page `BrowseMods.tsx` affiche :
1. Barre de recherche avec debounce (300ms)
2. Filtres : version Minecraft, loader, tri
3. Grille de resultats avec badge de source (CurseForge/Modrinth)
4. Details du mod avec versions disponibles
5. Bouton d'installation vers une instance
