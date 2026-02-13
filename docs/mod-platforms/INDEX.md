# Mod Platforms - Index

## Ce module

- [DOC.md](./DOC.md) - Integration CurseForge + Modrinth pour la recherche et le telechargement de mods

## Liens vers les autres modules

| Module | Relation |
|--------|----------|
| [Database](../database/DOC.md) | Stocke les mods installes (instance_mods) avec leur source |
| [Download Manager](../download-manager/DOC.md) | Telecharge les fichiers de mods |
| [Mod Loaders](../mod-loaders/DOC.md) | Filtre les mods par loader compatible |
| [Sync Protocol](../sync-protocol/DOC.md) | Le manifeste sync contient les references aux mods (source + file_hash) |
| [Frontend](../frontend/DOC.md) | BrowseMods.tsx pour la recherche unifiee |

## Fichiers cles

| Fichier | Role |
|---------|------|
| `src-tauri/src/services/mod_platform/mod.rs` | UnifiedModClient + trait ModPlatform |
| `src-tauri/src/services/mod_platform/curseforge.rs` | Client CurseForge API |
| `src-tauri/src/services/mod_platform/modrinth.rs` | Client Modrinth API |
| `src-tauri/src/commands/mods.rs` | search_mods, get_mod_details, get_mod_versions |
| `src/pages/BrowseMods.tsx` | UI de recherche |

## APIs externes

| Plateforme | Base URL | Auth |
|------------|----------|------|
| CurseForge | `api.curseforge.com` | API Key (header x-api-key) |
| Modrinth | `api.modrinth.com` | Aucune (User-Agent requis) |
