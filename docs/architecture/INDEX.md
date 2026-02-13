# Architecture - Index

## Ce module

- [DOC.md](./DOC.md) - Vue d'ensemble de l'architecture MineSync

## Liens vers les autres modules

| Module | Relation |
|--------|----------|
| [Database](../database/DOC.md) | Couche de persistence partagee par tous les services |
| [Authentication](../authentication/DOC.md) | Service d'auth injecte dans les commands |
| [Minecraft Engine](../minecraft-engine/DOC.md) | Service central pour les versions et telechargements |
| [Game Launch](../game-launch/DOC.md) | Orchestre Launch + gestion du runtime Java 21 portable |
| [Frontend](../frontend/DOC.md) | Couche UI qui consomme les commands via IPC |
| [Download Manager](../download-manager/DOC.md) | Service de telechargement utilise par Minecraft et Sync |

## Fichiers cles

| Fichier | Role |
|---------|------|
| `src-tauri/src/lib.rs` | Point d'entree, registration des states et commands |
| `src-tauri/src/errors.rs` | Type d'erreur centralise AppError |
| `src-tauri/tauri.conf.json` | Configuration Tauri (fenetre, identifiant, plugins) |
| `src-tauri/capabilities/default.json` | Permissions de l'application |
| `src/App.tsx` | Router principal React |
