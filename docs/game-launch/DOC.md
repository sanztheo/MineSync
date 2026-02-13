# Game Launch

## Vue d'ensemble

Le lancement du jeu dans MineSync est compose de deux blocs :

1. **Java Runtime Manager** (Java 21 portable, auto-install)  
2. **LaunchService** (classpath, args JVM/jeu, spawn Java, monitoring, kill)

Le frontend ne lance plus directement avec `java` hardcode. Il recupere d'abord un `java_path` valide via le manager Java, puis appelle `launch_instance`.

## Fichiers concernes

| Fichier | Role |
|---------|------|
| `src-tauri/src/services/java.rs` | Detection, installation et statut du runtime Java 21 |
| `src-tauri/src/commands/java.rs` | `get_java_status`, `get_java_install_progress`, `install_java_runtime`, `get_java_path` |
| `src-tauri/src/services/launch.rs` | Construction config + spawn + monitoring + kill |
| `src-tauri/src/commands/launch.rs` | `launch_instance`, `get_game_status`, `kill_game` |
| `src/hooks/use-java-runtime.ts` | Etat Java global cote frontend |
| `src/hooks/use-game-status.ts` | Flux de lancement + polling statut jeu |
| `src/components/java/JavaSetupModal.tsx` | Popup bloquante d'installation Java |

## Processus complet de lancement

### 1) Verification Java au demarrage

Au demarrage de l'app :
- `JavaRuntimeProvider` interroge `get_java_status`.
- Si Java 21 n'est pas pret, `JavaSetupModal` s'affiche en mode bloquant.
- L'utilisateur clique **Installer Java 21**.

### 2) Installation Java portable (si necessaire)

`JavaService` :
- detecte un runtime deja disponible (managed ou systeme >= 21),
- sinon telecharge Temurin 21 via Adoptium (macOS/Windows),
- verifie le SHA-256 (`.sha256.txt`),
- extrait l'archive (`zip` ou `tar.gz`),
- localise `bin/java[.exe]`,
- valide la version avec `java -version`,
- stocke le chemin dans `app_data_dir/java-runtime/temurin-21/java_path.txt`.

### 3) Preparation de l'instance

Dans `use-game-status` :
- recuperation de l'instance,
- pre-download MC via `download_version`,
- suivi de progression `get_download_progress`,
- recuperation du `java_path` avec `get_java_path`.

### 4) Lancement du process Java

`launch_instance` recoit maintenant :
- `instance_id`
- `java_path`

Puis `LaunchService` :
- stoppe le P2P avant launch,
- construit classpath + arguments JVM + arguments de jeu,
- spawn le process Java,
- passe le statut a `Running { pid }`,
- demarre le monitoring async.

### 5) Fin de process et cleanup

Le monitor :
- detecte sortie normale, crash, ou kill utilisateur,
- met a jour `GameStatus` (`Idle` / `Crashed`),
- enregistre le temps de jeu,
- redemarre le P2P si necessaire.

## Contrats IPC importants

### Java Runtime

- `get_java_status() -> JavaRuntimeStatus`
- `get_java_install_progress() -> JavaRuntimeStatus`
- `install_java_runtime() -> JavaInstallResult`
- `get_java_path() -> String`

### Game Launch

- `launch_instance(instance_id, java_path) -> LaunchInfo`
- `get_game_status() -> GameStatus`
- `kill_game() -> ()`

## Types principaux

### `JavaRuntimeStatus`

- `ready { java_path, major_version, source }`
- `missing`
- `installing { stage, percent, downloaded_bytes, total_bytes }`
- `error { message }`

### `GameStatus`

- `idle`
- `preparing`
- `{ running: { pid } }`
- `{ crashed: { exit_code, message } }`

## UX frontend

- Popup bloquante si Java 21 absent.
- Boutons Launch desactives tant que Java n'est pas pret.
- Statut jeu affiche en temps reel (`Preparing`, `Running`, `Crashed`).
- Progression de pre-download persistante entre pages.
- Bouton Kill visible en `Running`.
