use serde::{Deserialize, Serialize};

/// Current state of the game process.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum GameStatus {
    Idle,
    Preparing,
    Running { pid: u32 },
    Crashed { exit_code: Option<i32>, message: String },
}

/// Info returned when a game launch succeeds.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchInfo {
    pub instance_id: String,
    pub pid: u32,
    pub minecraft_version: String,
}

/// Configuration for launching a Minecraft instance.
#[derive(Debug, Clone)]
pub struct LaunchConfig {
    pub java_path: String,
    pub main_class: String,
    pub classpath: Vec<String>,
    pub game_args: Vec<String>,
    pub jvm_args: Vec<String>,
    pub game_dir: String,
    pub natives_dir: String,
}
