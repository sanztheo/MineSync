use std::path::Path;

use crate::errors::{AppError, AppResult};
use crate::models::instance::{MinecraftInstance, ModLoader};
use crate::services::database::DatabaseService;
use crate::services::minecraft::MinecraftService;

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
    mc_service: tauri::State<'_, MinecraftService>,
    name: String,
    minecraft_version: String,
    loader: Option<String>,
    loader_version: Option<String>,
) -> AppResult<MinecraftInstance> {
    let loader = loader
        .map(|s| s.parse::<ModLoader>())
        .transpose()
        .map_err(|e| AppError::Custom(e))?
        .unwrap_or(ModLoader::Vanilla);

    let instance = build_instance(
        name,
        minecraft_version,
        loader,
        loader_version,
        mc_service.base_dir(),
    )?;
    std::fs::create_dir_all(Path::new(&instance.instance_path).join("mods"))?;

    db.create_instance(&instance)?;
    Ok(instance)
}

#[tauri::command]
pub async fn delete_instance(db: tauri::State<'_, DatabaseService>, id: String) -> AppResult<()> {
    // Fetch instance path before soft-deleting so we can remove files on disk
    if let Some(instance) = db.get_instance(&id)? {
        let path = Path::new(&instance.instance_path);
        if path.exists() {
            tokio::fs::remove_dir_all(path).await.map_err(|e| {
                AppError::Custom(format!(
                    "Failed to remove instance directory {}: {e}",
                    instance.instance_path
                ))
            })?;
        }
    }
    db.delete_instance(&id)
}

fn build_instance(
    name: String,
    minecraft_version: String,
    loader: ModLoader,
    loader_version: Option<String>,
    base_dir: &Path,
) -> AppResult<MinecraftInstance> {
    let now = chrono::Utc::now();
    let instance_id = uuid::Uuid::new_v4().to_string();
    let instance_path = base_dir
        .join("instances")
        .join(&instance_id)
        .to_string_lossy()
        .to_string();

    Ok(MinecraftInstance {
        id: instance_id,
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
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn build_instance_generates_isolated_path_in_app_dir() -> AppResult<()> {
        let base_dir = PathBuf::from("/tmp/minesync-test");
        let first = build_instance(
            "Pack A".to_string(),
            "1.21.1".to_string(),
            ModLoader::Fabric,
            Some("0.16.0".to_string()),
            &base_dir,
        )?;
        let second = build_instance(
            "Pack B".to_string(),
            "1.21.1".to_string(),
            ModLoader::Fabric,
            Some("0.16.0".to_string()),
            &base_dir,
        )?;

        assert_ne!(first.id, second.id, "Each instance must get a unique id");
        assert_ne!(
            first.instance_path, second.instance_path,
            "Each instance must get an isolated path"
        );
        assert_eq!(
            first.instance_path,
            base_dir
                .join("instances")
                .join(&first.id)
                .to_string_lossy()
                .to_string()
        );
        assert_eq!(
            second.instance_path,
            base_dir
                .join("instances")
                .join(&second.id)
                .to_string_lossy()
                .to_string()
        );
        Ok(())
    }
}
