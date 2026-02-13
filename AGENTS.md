# Repository Guidelines

## Project Structure & Module Organization
MineSync est une application desktop Tauri avec frontend React/TypeScript et backend Rust.
- `src/` : UI React (`components/`, `pages/`, `hooks/`, `lib/`).
- `src-tauri/src/` : cœur Rust (`commands/`, `services/`, `models/`, `errors.rs`, `lib.rs`).
- `docs/` : documentation technique par domaine (`*/DOC.md`, `*/INDEX.md`).
- `assets/` : visuels statiques; `dist/` : build frontend généré.

Ajoute une page React dans `src/pages/` (ex: `MyFeature.tsx`) et les appels IPC uniquement via `src/lib/tauri.ts`.

## Build, Test, and Development Commands
- `npm install` : installe les dépendances JS.
- `npm run dev` : lance Vite (frontend seul).
- `npm run tauri dev` : lance l’app desktop complète (frontend + backend).
- `npm run lint` : exécute ESLint sur `ts/tsx`.
- `npm run build` : compile TypeScript puis build Vite.
- `cd src-tauri && cargo check` : validation rapide du backend Rust.
- `cd src-tauri && cargo test` : exécute les tests Rust.
- `npm run tauri build` : build de production (bundles desktop).

## Coding Style & Naming Conventions
- Frontend : TypeScript strict, indentation 2 espaces, composants en `PascalCase`, hooks en `useXxx`.
- Imports : privilégier l’alias `@/*` (ex: `@/components/ui/Button`).
- Backend Rust : modules/fichiers en `snake_case`, types en `CamelCase`.
- Erreurs Rust : utiliser `thiserror`; éviter `.unwrap()` hors tests/prototypes.
- Qualité : passer `npm run lint` avant toute PR.

## Testing Guidelines
Les tests automatiques sont principalement côté Rust (`#[test]` dans les modules `services/*`).
- Nommer les tests de façon descriptive (ex: `parse_share_code_rejects_invalid_prefix`).
- Exécuter au minimum `cd src-tauri && cargo test` avant PR.
- Pour le frontend, faire un smoke test manuel sur les flux clés (`Auth`, `BrowseMods`, `SyncHub`).

## Commit & Pull Request Guidelines
L’historique suit des messages impératifs en anglais : `Add ...`, `Refactor ...`, `Update ...`, `Implement ...`.
- Commits courts, ciblés, un sujet par commit.
- Format recommandé : `Verb + scope + intent` (ex: `Refactor loader version parsing`).
- PR : inclure contexte, changements principaux, commandes de vérification exécutées, et captures d’écran pour tout changement UI.
- Lier l’issue concernée et signaler les variables d’environnement requises (`CURSEFORGE_API_KEY`).

## Security & Configuration Tips
Ne commite jamais `.env` réel ni secrets API. Utilise `.env.example` comme modèle.
Vérifie les permissions Tauri dans `src-tauri/capabilities/default.json` lors de l’ajout de nouvelles commandes/plugins.
