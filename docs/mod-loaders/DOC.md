# Mod Loaders

## Vue d'ensemble

MineSync supporte 4 mod loaders pour Minecraft Java Edition. Chaque loader a son propre systeme d'installation mais produit un `LoaderProfile` uniforme qui s'integre au processus de lancement.

## Fichiers concernes

| Fichier | Role |
|---------|------|
| `src-tauri/src/services/loader/mod.rs` | LoaderService - dispatch vers le bon installeur |
| `src-tauri/src/services/loader/fabric.rs` | FabricInstaller |
| `src-tauri/src/services/loader/quilt.rs` | QuiltInstaller |
| `src-tauri/src/services/loader/forge.rs` | ForgeInstaller |
| `src-tauri/src/services/loader/neoforge.rs` | NeoForgeInstaller |
| `src-tauri/src/commands/loader.rs` | Commands IPC (list_loader_versions, install_loader) |

## Loaders supportes

### Fabric

- **API :** `https://meta.fabricmc.net/`
- **Installation :** Telecharge le loader JAR + les libraries depuis Maven
- **Approche :** API REST simple, pas d'installeur complexe
- **Specificite :** Leger, demarrage rapide, API bien documentee

### Quilt

- **API :** `https://meta.quiltmc.org/`
- **Installation :** Similaire a Fabric (fork compatible)
- **Approche :** Meme structure que Fabric avec ses propres libraries
- **Specificite :** Fork de Fabric avec des ameliorations

### Forge

- **API :** `https://maven.minecraftforge.net/`
- **Installation :** Telecharge l'installeur JAR, extraction du profil
- **Approche :** Plus complexe, necessite le base_dir pour extraire les fichiers
- **Specificite :** Le plus ancien, large ecosysteme de mods

### NeoForge

- **API :** `https://maven.neoforged.net/`
- **Installation :** Similaire a Forge (fork moderne)
- **Approche :** Remplacement moderne de Forge
- **Specificite :** Fork de Forge avec meilleur support des versions recentes

## LoaderProfile

Chaque installeur produit un `LoaderProfile` qui modifie le lancement :

```rust
pub struct LoaderProfile {
    pub main_class: String,           // Remplace la mainClass vanilla
    pub libraries: Vec<LoaderLib>,    // Libraries additionnelles
    pub jvm_args: Vec<String>,        // Arguments JVM supplementaires
    pub game_args: Vec<String>,       // Arguments de jeu supplementaires
}

pub struct LoaderLib {
    pub name: String,     // Maven coordinate (group:artifact:version)
    pub url: String,      // URL de telechargement
    pub path: String,     // Chemin local relatif dans libraries/
}
```

## LoaderService (dispatch)

Le `LoaderService` centralise l'acces aux installeurs :

```rust
pub struct LoaderService {
    fabric: FabricInstaller,
    quilt: QuiltInstaller,
    forge: ForgeInstaller,
    neoforge: NeoForgeInstaller,
}

impl LoaderService {
    pub async fn list_versions(
        &self,
        loader: &str,
        mc_version: &str,
    ) -> AppResult<Vec<LoaderVersionEntry>>

    pub async fn install_loader(
        &self,
        loader: &str,
        loader_version: &str,
        mc_version: &str,
    ) -> AppResult<LoaderProfile>
}
```

## Integration avec le lancement

Le `LaunchService` fusionne le `LoaderProfile` avec les arguments vanilla :

1. **main_class** : remplace celle de `VersionDetail`
2. **libraries** : ajoutees au classpath apres les libraries vanilla
3. **jvm_args** : prepended aux arguments JVM vanilla
4. **game_args** : appended aux arguments de jeu vanilla

## Versions supportees

Le frontend affiche les versions disponibles pour chaque loader via `list_loader_versions`. L'utilisateur choisit :
1. Le loader (Fabric, Quilt, Forge, NeoForge, ou Vanilla)
2. La version du loader compatible avec sa version Minecraft

Pour Vanilla, aucun loader n'est installe et le `LoaderProfile` est vide.
