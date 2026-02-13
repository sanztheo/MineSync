# Game Launch

## Vue d'ensemble

Le `LaunchService` orchestre le lancement de Minecraft Java Edition. Il construit le classpath, les arguments JVM et de jeu, demarre le processus Java, et gere son cycle de vie (monitoring, kill, play time).

## Fichiers concernes

| Fichier | Role |
|---------|------|
| `src-tauri/src/services/launch.rs` | LaunchService - construction config + spawn + monitoring |
| `src-tauri/src/commands/launch.rs` | launch_instance, get_game_status, kill_game |

## Processus de lancement

### 1. Arret du P2P

Avant de lancer le jeu, le P2P est arrete pour liberer les ressources reseau :

```rust
p2p_service.stop().await;
```

### 2. Construction du LaunchConfig

```rust
pub struct LaunchConfig {
    pub java_path: String,
    pub main_class: String,
    pub classpath: String,
    pub jvm_args: Vec<String>,
    pub game_args: Vec<String>,
    pub game_dir: PathBuf,
    pub natives_dir: PathBuf,
}
```

### 3. Construction du classpath

Le classpath combine :
1. **Libraries vanilla** : depuis `VersionDetail.libraries`, filtrees par OS
2. **Libraries du loader** : depuis `LoaderProfile.libraries` (si loader installe)
3. **Client JAR** : `versions/{version}/{version}.jar`

Separateur : `:` sur Unix, `;` sur Windows.

### 4. Arguments JVM

Les arguments JVM incluent :

| Argument | Source |
|----------|--------|
| `-Xmx{ram}m` / `-Xms{ram}m` | Parametres utilisateur (Settings) |
| `-Djava.library.path={natives}` | Chemin des libraries natives |
| `-Dminecraft.launcher.brand=MineSync` | Branding du launcher |
| `-Dminecraft.launcher.version=1.0` | Version du launcher |
| Arguments du `VersionDetail.arguments.jvm` | Depuis Mojang |
| Arguments du `LoaderProfile.jvm_args` | Depuis le loader |

**Deduplication** : Si un argument apparait en double (ex: deux `-Xmx`), seule la derniere occurrence est gardee.

### 5. Arguments de jeu

Les arguments utilisent un systeme de **substitution de variables** :

| Variable | Valeur |
|----------|--------|
| `${auth_player_name}` | Nom du joueur (depuis le compte) |
| `${auth_uuid}` | UUID Minecraft (depuis le compte) |
| `${auth_access_token}` | Token d'acces Minecraft |
| `${version_name}` | ID de la version (ex: "1.21.4") |
| `${game_directory}` | Chemin de l'instance |
| `${assets_root}` | Chemin du dossier assets |
| `${assets_index_name}` | ID de l'index des assets |
| `${user_type}` | "msa" (Microsoft Account) |
| `${version_type}` | "release" ou "snapshot" |
| `${natives_directory}` | Chemin du dossier natives |

### 6. Spawn du processus

```rust
let child = Command::new(&config.java_path)
    .args(&config.jvm_args)
    .arg("-cp")
    .arg(&config.classpath)
    .arg(&config.main_class)
    .args(&config.game_args)
    .current_dir(&config.game_dir)
    .spawn()?;
```

### 7. Monitoring

Un `tokio::spawn` surveille le processus en arriere-plan :

```rust
tokio::select! {
    // Le jeu se termine naturellement
    status = child.wait() => {
        // Enregistrer le temps de jeu
        // Redemarrer le P2P
        // Mettre a jour GameStatus
    }
    // L'utilisateur demande un kill
    _ = kill_rx.changed() => {
        child.kill().await;
    }
}
```

## GameStatus

```rust
pub enum GameStatus {
    Idle,
    Preparing,
    Running { pid: u32 },
    Crashed { exit_code: Option<i32>, message: String },
}
```

Le frontend peut query `get_game_status` pour afficher l'etat du jeu et `kill_game` pour forcer l'arret.

## Gestion du temps de jeu

A la fin du processus, le temps de jeu est calcule et enregistre :

```rust
let elapsed = start_time.elapsed().as_secs();
database.update_play_time(&instance_id, elapsed).await;
```

Le temps est affiche sur la carte d'instance dans Home.tsx.

## Cycle P2P autour du jeu

```
Avant lancement : P2P stop()
Jeu en cours    : P2P OFF
Jeu termine     : P2P start() (si necessaire)
```

Cela libere les ressources reseau pendant le jeu pour de meilleures performances.
