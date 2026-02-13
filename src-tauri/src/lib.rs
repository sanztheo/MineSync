mod commands;
mod errors;
mod models;
mod services;

use commands::{account, instance, sync};
use services::database::DatabaseService;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize SQLite database in app data directory
            let app_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_dir)?;
            let db_path = app_dir.join("minesync.db");
            let db = DatabaseService::new(&db_path)?;
            app.manage(db);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            instance::list_instances,
            instance::get_instance,
            instance::create_instance,
            instance::delete_instance,
            sync::create_sync_session,
            sync::join_sync_session,
            account::get_active_account,
            account::save_account,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
