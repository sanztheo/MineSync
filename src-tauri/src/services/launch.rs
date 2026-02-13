use std::path::PathBuf;
use std::sync::Mutex;

use crate::errors::{AppError, AppResult};
use crate::models::account::Account;
use crate::models::launch::{GameStatus, LaunchConfig, LaunchInfo};
use crate::models::loader::LoaderProfile;
use crate::services::minecraft::VersionDetail;

const LAUNCHER_NAME: &str = "MineSync";
const LAUNCHER_VERSION: &str = "1.0.0";
const DEFAULT_MAX_MEMORY: &str = "2G";
const DEFAULT_MIN_MEMORY: &str = "512M";

// Classpath separator: `;` on Windows, `:` on Unix
#[cfg(target_os = "windows")]
const CP_SEPARATOR: &str = ";";
#[cfg(not(target_os = "windows"))]
const CP_SEPARATOR: &str = ":";

pub struct LaunchService {
    base_dir: PathBuf,
    state: Mutex<GameStatus>,
}

impl LaunchService {
    pub fn new(base_dir: PathBuf) -> Self {
        Self {
            base_dir,
            state: Mutex::new(GameStatus::Idle),
        }
    }

    pub fn status(&self) -> AppResult<GameStatus> {
        Ok(self.lock_state()?.clone())
    }

    /// Launch a Minecraft instance.
    ///
    /// Builds the full launch command from the version detail, loader profile,
    /// and account credentials, then spawns the Java process.
    pub async fn launch(
        &self,
        instance_id: &str,
        instance_path: &str,
        version_detail: &VersionDetail,
        loader_profile: Option<&LoaderProfile>,
        account: &Account,
        java_path: &str,
    ) -> AppResult<LaunchInfo> {
        // Guard: only one game at a time
        {
            let state = self.lock_state()?;
            if matches!(*state, GameStatus::Running { .. } | GameStatus::Preparing) {
                return Err(AppError::Custom(
                    "A game instance is already running".to_string(),
                ));
            }
        }

        self.set_state(GameStatus::Preparing)?;

        let config = self.build_launch_config(
            instance_path,
            version_detail,
            loader_profile,
            account,
            java_path,
        )?;

        // Ensure natives directory exists
        tokio::fs::create_dir_all(&config.natives_dir).await?;

        // Build the full command
        let classpath = config.classpath.join(CP_SEPARATOR);
        let mut cmd = tokio::process::Command::new(&config.java_path);

        cmd.current_dir(&config.game_dir);

        // JVM arguments
        for arg in &config.jvm_args {
            cmd.arg(arg);
        }

        // Classpath + main class
        cmd.arg("-cp");
        cmd.arg(&classpath);
        cmd.arg(&config.main_class);

        // Game arguments
        for arg in &config.game_args {
            cmd.arg(arg);
        }

        // Capture stdout/stderr
        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());

        log::info!(
            "Launching Minecraft {} (instance: {}, main_class: {})",
            version_detail.id,
            instance_id,
            config.main_class
        );

        let child = cmd.spawn().map_err(|e| {
            self.set_state(GameStatus::Idle).ok();
            AppError::Custom(format!("Failed to spawn Java process: {e}"))
        })?;

        let pid = child.id().unwrap_or(0);

        self.set_state(GameStatus::Running { pid })?;

        // Monitor the process in a background task
        let instance_id_owned = instance_id.to_string();
        let _state_clone = self.base_dir.clone(); // reserved for future state sharing
        // We need to share the state — use a scoped approach
        // Since LaunchService is behind Tauri State (managed), we can't easily clone self.
        // Instead, spawn a task that just waits and logs.
        tokio::spawn(async move {
            monitor_process(child, &instance_id_owned).await;
        });

        Ok(LaunchInfo {
            instance_id: instance_id.to_string(),
            pid,
            minecraft_version: version_detail.id.clone(),
        })
    }

    /// Build the complete launch configuration.
    fn build_launch_config(
        &self,
        instance_path: &str,
        version_detail: &VersionDetail,
        loader_profile: Option<&LoaderProfile>,
        account: &Account,
        java_path: &str,
    ) -> AppResult<LaunchConfig> {
        let game_dir = instance_path.to_string();
        let version_id = &version_detail.id;
        let natives_dir = self
            .base_dir
            .join("versions")
            .join(version_id)
            .join("natives")
            .to_string_lossy()
            .to_string();

        // Determine main class (loader overrides vanilla)
        let main_class = match loader_profile {
            Some(lp) => lp.main_class.clone(),
            None => version_detail.main_class.clone(),
        };

        // Build classpath
        let classpath = self.build_classpath(version_detail, loader_profile);

        // Build JVM arguments
        let jvm_args = self.build_jvm_args(
            version_detail,
            loader_profile,
            &natives_dir,
        );

        // Build game arguments
        let game_args = self.build_game_args(
            version_detail,
            loader_profile,
            account,
            &game_dir,
        );

        Ok(LaunchConfig {
            java_path: java_path.to_string(),
            main_class,
            classpath,
            game_args,
            jvm_args,
            game_dir,
            natives_dir,
        })
    }

    /// Build the classpath from vanilla libraries + loader libraries + client.jar.
    fn build_classpath(
        &self,
        version_detail: &VersionDetail,
        loader_profile: Option<&LoaderProfile>,
    ) -> Vec<String> {
        let lib_dir = self.base_dir.join("libraries");
        let mut classpath: Vec<String> = Vec::new();

        // Vanilla libraries (already filtered by OS during download)
        for lib in &version_detail.libraries {
            if let Some(ref downloads) = lib.downloads {
                if let Some(ref artifact) = downloads.artifact {
                    if let Some(ref path) = artifact.path {
                        classpath.push(
                            lib_dir.join(path).to_string_lossy().to_string(),
                        );
                    }
                }
            }
        }

        // Loader libraries
        if let Some(lp) = loader_profile {
            for lib in &lp.libraries {
                classpath.push(
                    lib_dir.join(&lib.path).to_string_lossy().to_string(),
                );
            }
        }

        // Client JAR (must be last for Forge compatibility)
        let client_jar = self
            .base_dir
            .join("versions")
            .join(&version_detail.id)
            .join(format!("{}.jar", version_detail.id));
        classpath.push(client_jar.to_string_lossy().to_string());

        classpath
    }

    /// Build JVM arguments with variable substitution.
    fn build_jvm_args(
        &self,
        version_detail: &VersionDetail,
        loader_profile: Option<&LoaderProfile>,
        natives_dir: &str,
    ) -> Vec<String> {
        let mut args: Vec<String> = vec![
            format!("-Xmx{DEFAULT_MAX_MEMORY}"),
            format!("-Xms{DEFAULT_MIN_MEMORY}"),
            format!("-Djava.library.path={natives_dir}"),
            format!("-Dminecraft.launcher.brand={LAUNCHER_NAME}"),
            format!("-Dminecraft.launcher.version={LAUNCHER_VERSION}"),
        ];

        // Extract string-only JVM args from version JSON
        if let Some(ref arguments) = version_detail.arguments {
            if let Some(ref jvm_args) = arguments.jvm {
                for arg in jvm_args {
                    if let Some(s) = arg.as_str() {
                        let substituted = substitute_jvm_var(s, natives_dir);
                        args.push(substituted);
                    }
                }
            }
        }

        // Loader JVM arguments
        if let Some(lp) = loader_profile {
            for arg in &lp.jvm_arguments {
                args.push(arg.clone());
            }
        }

        // Deduplicate: if a -D property appears multiple times, keep the last one
        deduplicate_jvm_args(args)
    }

    /// Build game arguments with variable substitution.
    fn build_game_args(
        &self,
        version_detail: &VersionDetail,
        loader_profile: Option<&LoaderProfile>,
        account: &Account,
        game_dir: &str,
    ) -> Vec<String> {
        let version_id = &version_detail.id;
        let assets_dir = self.base_dir.join("assets").to_string_lossy().to_string();
        let asset_index = &version_detail.asset_index.id;

        let access_token = account
            .access_token
            .as_deref()
            .unwrap_or("0");

        let mut args = Vec::new();

        // Extract string-only game args from version JSON
        if let Some(ref arguments) = version_detail.arguments {
            if let Some(ref game_args) = arguments.game {
                for arg in game_args {
                    if let Some(s) = arg.as_str() {
                        let substituted = substitute_game_var(
                            s,
                            &account.username,
                            version_id,
                            game_dir,
                            &assets_dir,
                            asset_index,
                            &account.uuid,
                            access_token,
                        );
                        args.push(substituted);
                    }
                }
            }
        }

        // If no arguments from version JSON, use the standard set
        if args.is_empty() {
            args = build_default_game_args(
                &account.username,
                version_id,
                game_dir,
                &assets_dir,
                asset_index,
                &account.uuid,
                access_token,
            );
        }

        // Loader game arguments
        if let Some(lp) = loader_profile {
            for arg in &lp.game_arguments {
                args.push(arg.clone());
            }
        }

        args
    }

    fn lock_state(&self) -> AppResult<std::sync::MutexGuard<'_, GameStatus>> {
        self.state
            .lock()
            .map_err(|e| AppError::Custom(format!("Game state lock poisoned: {e}")))
    }

    fn set_state(&self, new_state: GameStatus) -> AppResult<()> {
        let mut state = self.lock_state()?;
        *state = new_state;
        Ok(())
    }
}

// --- Process monitoring ---

async fn monitor_process(
    mut child: tokio::process::Child,
    instance_id: &str,
) {
    match child.wait().await {
        Ok(status) => {
            if status.success() {
                log::info!("Minecraft instance {instance_id} exited normally");
            } else {
                let code = status.code();
                log::warn!(
                    "Minecraft instance {instance_id} exited with code: {code:?}"
                );
            }
        }
        Err(e) => {
            log::error!(
                "Failed to wait for Minecraft process (instance {instance_id}): {e}"
            );
        }
    }
}

// --- Variable substitution ---

fn substitute_game_var(
    template: &str,
    username: &str,
    version_id: &str,
    game_dir: &str,
    assets_dir: &str,
    asset_index: &str,
    uuid: &str,
    access_token: &str,
) -> String {
    template
        .replace("${auth_player_name}", username)
        .replace("${version_name}", version_id)
        .replace("${game_directory}", game_dir)
        .replace("${assets_root}", assets_dir)
        .replace("${assets_index_name}", asset_index)
        .replace("${auth_uuid}", uuid)
        .replace("${auth_access_token}", access_token)
        .replace("${user_type}", "msa")
        .replace("${version_type}", "release")
        .replace("${launcher_name}", LAUNCHER_NAME)
        .replace("${launcher_version}", LAUNCHER_VERSION)
}

fn substitute_jvm_var(template: &str, natives_dir: &str) -> String {
    template
        .replace("${natives_directory}", natives_dir)
        .replace("${launcher_name}", LAUNCHER_NAME)
        .replace("${launcher_version}", LAUNCHER_VERSION)
}

fn build_default_game_args(
    username: &str,
    version_id: &str,
    game_dir: &str,
    assets_dir: &str,
    asset_index: &str,
    uuid: &str,
    access_token: &str,
) -> Vec<String> {
    vec![
        "--username".to_string(),
        username.to_string(),
        "--version".to_string(),
        version_id.to_string(),
        "--gameDir".to_string(),
        game_dir.to_string(),
        "--assetsDir".to_string(),
        assets_dir.to_string(),
        "--assetIndex".to_string(),
        asset_index.to_string(),
        "--uuid".to_string(),
        uuid.to_string(),
        "--accessToken".to_string(),
        access_token.to_string(),
        "--userType".to_string(),
        "msa".to_string(),
        "--versionType".to_string(),
        "release".to_string(),
    ]
}

/// Deduplicate JVM args: for -D properties, keep only the last occurrence.
/// For other args (like -Xmx), also keep the last occurrence.
fn deduplicate_jvm_args(args: Vec<String>) -> Vec<String> {
    let mut seen_keys: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    let mut result: Vec<Option<String>> = Vec::new();

    for arg in args {
        let key = extract_jvm_arg_key(&arg);
        if let Some(&prev_idx) = seen_keys.get(&key) {
            // Replace previous occurrence with None (will be filtered out)
            result[prev_idx] = None;
        }
        seen_keys.insert(key, result.len());
        result.push(Some(arg));
    }

    result.into_iter().flatten().collect()
}

/// Extract the "key" part of a JVM arg for deduplication.
/// `-Dfoo.bar=value` → `-Dfoo.bar`
/// `-Xmx2G` → `-Xmx`
/// `-cp` → `-cp`
fn extract_jvm_arg_key(arg: &str) -> String {
    if arg.starts_with("-D") {
        // System property: key is everything before `=`
        arg.split('=').next().unwrap_or(arg).to_string()
    } else if arg.starts_with("-Xmx") || arg.starts_with("-Xms") || arg.starts_with("-Xss") {
        // Memory flags: key is the flag prefix
        arg[..4].to_string()
    } else {
        arg.to_string()
    }
}
