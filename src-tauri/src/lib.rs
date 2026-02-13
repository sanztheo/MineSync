mod commands;
mod errors;
mod models;
mod services;

use commands::{account, auth, instance, minecraft, mods, p2p, sync, sync_protocol};
use services::auth::AuthService;
use services::database::DatabaseService;
use services::download::DownloadService;
use services::minecraft::MinecraftService;
use services::mod_platform::UnifiedModClient;
use services::sync_protocol::SyncProtocolService;
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

            let app_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_dir)?;

            // SQLite database
            let db_path = app_dir.join("minesync.db");
            let db = DatabaseService::new(&db_path)?;
            app.manage(db);

            // Auth service
            app.manage(AuthService::new());

            // Minecraft version manager
            app.manage(MinecraftService::new(app_dir.clone()));

            // Download manager
            app.manage(DownloadService::new());

            // Mod platform client (CurseForge + Modrinth)
            // CurseForge API key is optional — pass None to use Modrinth only
            let cf_key = std::env::var("CURSEFORGE_API_KEY").ok();
            app.manage(UnifiedModClient::new(cf_key));

            // P2P service (starts as None, activated via command)
            let p2p_state: p2p::P2pState = std::sync::Arc::new(tokio::sync::Mutex::new(None));
            app.manage(p2p_state);

            // Sync protocol service (manages pending syncs)
            app.manage(SyncProtocolService::new());

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
            auth::start_auth,
            auth::poll_auth,
            auth::get_profile,
            auth::logout,
            auth::refresh_auth,
            minecraft::list_mc_versions,
            minecraft::download_version,
            minecraft::get_download_progress,
            p2p::start_p2p,
            p2p::stop_p2p,
            p2p::get_p2p_status,
            p2p::share_modpack,
            p2p::join_via_code,
            mods::search_mods,
            mods::get_mod_details,
            mods::get_mod_versions,
            mods::resolve_mod_dependencies,
            sync_protocol::preview_sync,
            sync_protocol::get_pending_sync,
            sync_protocol::confirm_sync,
            sync_protocol::reject_sync,
            sync_protocol::complete_sync,
            sync_protocol::compute_manifest_diff,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
