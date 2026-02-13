# Download Manager - Index

## Ce module

- [DOC.md](./DOC.md) - Telechargements paralleles, SHA1, retry, progression

## Liens vers les autres modules

| Module | Relation |
|--------|----------|
| [Minecraft Engine](../minecraft-engine/DOC.md) | Genere les DownloadTask pour client JAR, libraries, assets |
| [Sync Protocol](../sync-protocol/DOC.md) | Telecharge les mods lors de l'application du diff |
| [Mod Platforms](../mod-platforms/DOC.md) | Les URLs de telechargement viennent de CurseForge/Modrinth |
| [Frontend](../frontend/DOC.md) | Affiche la progression via get_download_progress |

## Fichier cle

| Fichier | Role |
|---------|------|
| `src-tauri/src/services/download.rs` | DownloadService complet |
| `src/lib/types.ts` | DownloadProgress, DownloadState interfaces |
