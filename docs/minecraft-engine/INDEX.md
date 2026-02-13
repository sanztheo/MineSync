# Minecraft Engine - Index

## Ce module

- [DOC.md](./DOC.md) - Gestion des versions Minecraft, telechargements, assets

## Liens vers les autres modules

| Module | Relation |
|--------|----------|
| [Download Manager](../download-manager/DOC.md) | Execute les DownloadTask generes par resolve_downloads() |
| [Game Launch](../game-launch/DOC.md) | Utilise VersionDetail pour construire classpath et arguments |
| [Mod Loaders](../mod-loaders/DOC.md) | Les loaders ajoutent des libraries au classpath vanilla |
| [Database](../database/DOC.md) | Stocke les instances avec leur version Minecraft |

## Fichiers cles

| Fichier | Role |
|---------|------|
| `src-tauri/src/services/minecraft.rs` | MinecraftService (manifeste, detail, resolution) |
| `src-tauri/src/commands/minecraft.rs` | list_mc_versions, download_version, get_download_progress |
| `src/lib/types.ts` | VersionEntry, DownloadProgress interfaces |

## APIs externes

| API | URL | Role |
|-----|-----|------|
| Version Manifest | `piston-meta.mojang.com/mc/game/version_manifest_v2.json` | Liste des versions |
| Version Detail | Varie par version (URL dans le manifest) | Detail complet d'une version |
| Assets | `resources.download.minecraft.net/{hash[0:2]}/{hash}` | Fichiers assets (sons, textures) |
