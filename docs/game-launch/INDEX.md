# Game Launch - Index

## Ce module

- [DOC.md](./DOC.md) - Construction du classpath, arguments JVM, lancement et monitoring du processus

## Liens vers les autres modules

| Module | Relation |
|--------|----------|
| [Minecraft Engine](../minecraft-engine/DOC.md) | Fournit VersionDetail pour classpath et arguments |
| [Mod Loaders](../mod-loaders/DOC.md) | LoaderProfile modifie mainClass, classpath et arguments |
| [Authentication](../authentication/DOC.md) | Access token et UUID pour les arguments de jeu |
| [P2P Network](../p2p-network/DOC.md) | Arrete/redemarre autour du lancement |
| [Database](../database/DOC.md) | Enregistre le temps de jeu et lit les tokens du compte |

## Fichiers cles

| Fichier | Role |
|---------|------|
| `src-tauri/src/services/launch.rs` | LaunchService (config, spawn, monitor, kill) |
| `src-tauri/src/commands/launch.rs` | launch_instance, get_game_status, kill_game |
| `src/pages/Home.tsx` | Bouton Play sur les cartes d'instance |
