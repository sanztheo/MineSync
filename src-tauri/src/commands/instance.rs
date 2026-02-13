use crate::errors::{AppError, AppResult};
use crate::models::instance::{MinecraftInstance, ModLoader};
use crate::services::database::DatabaseService;

#[tauri::command]
pub fn list_instances(db: tauri::State<'_, DatabaseService>) -> AppResult<Vec<MinecraftInstance>> {
    db.list_instances()
}

#[tauri::command]
pub fn get_instance(
    db: tauri::State<'_, DatabaseService>,
    id: String,
) -> AppResult<Option<MinecraftInstance>> {
    db.get_instance(&id)
}

#[tauri::command]
pub fn create_instance(
    db: tauri::State<'_, DatabaseService>,
    name: String,
    minecraft_version: String,
    loader: Option<String>,
    loader_version: Option<String>,
    instance_path: String,
) -> AppResult<MinecraftInstance> {
    let loader = loader
        .map(|s| s.parse::<ModLoader>())
        .transpose()
        .map_err(|e| AppError::Custom(e))?
        .unwrap_or(ModLoader::Vanilla);

    let now = chrono::Utc::now();
    let instance = MinecraftInstance {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        minecraft_version,
        loader,
        loader_version,
        instance_path,
        icon_path: None,
        icon_url: None,
        description: None,
        last_played_at: None,
        total_play_time: 0,
        is_active: true,
        created_at: now,
        updated_at: now,
    };

    db.create_instance(&instance)?;
    Ok(instance)
}

#[tauri::command]
pub fn delete_instance(db: tauri::State<'_, DatabaseService>, id: String) -> AppResult<()> {
    db.delete_instance(&id)
}
