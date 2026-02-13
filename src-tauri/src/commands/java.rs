use crate::errors::AppResult;
use crate::models::java::{JavaInstallResult, JavaRuntimeStatus};
use crate::services::java::JavaService;

#[tauri::command]
pub fn get_java_status(java: tauri::State<'_, JavaService>) -> AppResult<JavaRuntimeStatus> {
    java.status()
}

#[tauri::command]
pub fn get_java_install_progress(
    java: tauri::State<'_, JavaService>,
) -> AppResult<JavaRuntimeStatus> {
    java.status()
}

#[tauri::command]
pub async fn install_java_runtime(
    java: tauri::State<'_, JavaService>,
) -> AppResult<JavaInstallResult> {
    java.install_runtime().await
}

#[tauri::command]
pub async fn get_java_path(java: tauri::State<'_, JavaService>) -> AppResult<String> {
    java.get_java_path().await
}
