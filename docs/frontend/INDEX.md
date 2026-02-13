# Frontend - Index

## Ce module

- [DOC.md](./DOC.md) - Pages React, composants UI, hooks, types TypeScript, design system

## Liens vers les autres modules

| Module | Relation |
|--------|----------|
| [Architecture](../architecture/DOC.md) | Communication IPC (invoke/listen) avec le backend Rust |
| [Authentication](../authentication/DOC.md) | Page Auth.tsx consomme startAuth, pollAuth |
| [Minecraft Engine](../minecraft-engine/DOC.md) | Home.tsx liste les versions MC pour la creation d'instance |
| [Mod Platforms](../mod-platforms/DOC.md) | BrowseMods.tsx consomme searchMods |
| [P2P Network](../p2p-network/DOC.md) | SyncHub.tsx consomme start/stop P2P |
| [Sync Protocol](../sync-protocol/DOC.md) | SyncHub.tsx consomme preview/confirm/reject sync |
| [Game Launch](../game-launch/DOC.md) | Home/InstanceDetail consomment launch + game status + Java status |
| [Download Manager](../download-manager/DOC.md) | Affiche la progression des telechargements |

## Fichiers cles

| Fichier | Role |
|---------|------|
| `src/App.tsx` | Router principal |
| `src/pages/Home.tsx` | Page d'accueil (instances) |
| `src/pages/Auth.tsx` | Connexion Microsoft |
| `src/pages/BrowseMods.tsx` | Recherche de mods |
| `src/pages/InstanceDetail.tsx` | Detail d'une instance |
| `src/pages/SyncHub.tsx` | Hub P2P |
| `src/pages/Settings.tsx` | Parametres |
| `src/components/java/JavaSetupModal.tsx` | Popup Java 21 au demarrage |
| `src/components/layout/TitleBar.tsx` | Barre de titre Tauri |
| `src/components/layout/Sidebar.tsx` | Navigation |
| `src/hooks/use-tauri.ts` | Hook generique IPC |
| `src/hooks/use-game-status.ts` | Hook Play/Kill + polling GameStatus |
| `src/hooks/use-java-runtime.ts` | Hook global Java runtime |
| `src/lib/types.ts` | Interfaces TypeScript |
| `src/lib/tauri.ts` | Wrappers invoke() |
