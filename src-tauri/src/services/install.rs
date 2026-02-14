use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};

use chrono::Utc;

use crate::errors::{AppError, AppResult};
use crate::models::install::{CfManifest, InstallProgress, InstallStage, MrIndex};
use crate::models::instance::{MinecraftInstance, ModLoader};
use crate::models::mod_info::{ModInfo, ModSource};
use crate::services::database::DatabaseService;
use crate::services::download::{DownloadService, DownloadTask};
use crate::services::loader::LoaderService;
use crate::services::minecraft::MinecraftService;
use crate::services::mod_platform::UnifiedModClient;

/// Orchestrates mod and modpack installation.
pub struct InstallService {
    progress: Arc<Mutex<InstallProgress>>,
    install_in_progress: AtomicBool,
}

struct InstallGuard<'a> {
    flag: &'a AtomicBool,
}

impl Drop for InstallGuard<'_> {
    fn drop(&mut self) {
        self.flag.store(false, Ordering::Release);
    }
}

impl InstallService {
    pub fn new() -> Self {
        Self {
            progress: Arc::new(Mutex::new(InstallProgress::idle())),
            install_in_progress: AtomicBool::new(false),
        }
    }

    pub fn get_progress(&self) -> AppResult<InstallProgress> {
        Ok(self.lock_progress()?.clone())
    }

    /// Install a single mod into an existing instance.
    pub async fn install_mod(
        &self,
        db: &DatabaseService,
        mod_client: &UnifiedModClient,
        download_service: &DownloadService,
        instance_id: &str,
        source: &ModSource,
        project_id: &str,
        version_id: &str,
    ) -> AppResult<ModInfo> {
        let _install_guard = self.begin_install()?;

        // Validate instance exists
        let instance = db
            .get_instance(instance_id)?
            .ok_or_else(|| AppError::Custom(format!("Instance not found: {instance_id}")))?;

        self.set_progress_fresh(InstallStage::FetchingInfo, 10.0)?;

        // Fetch versions and find the requested one
        let versions = mod_client
            .get_versions(source, project_id, None, None)
            .await?;

        let version = versions
            .into_iter()
            .find(|v| v.id == version_id)
            .ok_or_else(|| AppError::Custom(format!("Version not found: {version_id}")))?;

        let file = version
            .files
            .iter()
            .find(|f| f.primary)
            .or_else(|| version.files.first())
            .ok_or_else(|| AppError::Custom("No files in version".to_string()))?;

        self.set_progress(InstallStage::DownloadingMods { current: 1, total: 1 }, 40.0)?;

        // Download the mod JAR
        let mods_dir = PathBuf::from(&instance.instance_path).join("mods");
        let dest = mods_dir.join(&file.filename);

        let task = DownloadTask {
            url: file.url.clone(),
            dest,
            sha1: file.hashes.get("sha1").cloned(),
            size: file.size,
        };

        download_service.download_all(vec![task]).await?;

        self.set_progress(InstallStage::RegisteringMods, 80.0)?;

        // Register in DB
        let mod_info = ModInfo {
            id: uuid::Uuid::new_v4().to_string(),
            instance_id: instance.id.clone(),
            name: version.name.clone(),
            slug: None,
            version: version.version_number.clone(),
            file_name: file.filename.clone(),
            file_hash: file.hashes.get("sha1").cloned(),
            source: source.clone(),
            source_project_id: Some(project_id.to_string()),
            source_version_id: Some(version_id.to_string()),
            is_active: true,
            installed_at: Utc::now(),
        };

        db.add_mod_to_instance(&mod_info)?;

        self.set_progress(InstallStage::Completed, 100.0)?;
        Ok(mod_info)
    }

    /// Remove a mod from an instance: delete file from disk, then disable it in DB.
    pub fn remove_mod(&self, db: &DatabaseService, mod_id: &str) -> AppResult<()> {
        let mod_info = db
            .get_mod_by_id(mod_id)?
            .ok_or_else(|| AppError::Custom(format!("Mod not found: {mod_id}")))?;

        let instance = db
            .get_instance(&mod_info.instance_id)?
            .ok_or_else(|| AppError::Custom(format!("Instance not found: {}", mod_info.instance_id)))?;

        let mod_path = PathBuf::from(instance.instance_path)
            .join("mods")
            .join(&mod_info.file_name);

        if let Err(e) = std::fs::remove_file(&mod_path) {
            if e.kind() != std::io::ErrorKind::NotFound {
                return Err(AppError::Custom(format!(
                    "Failed to remove mod file {}: {e}",
                    mod_path.display()
                )));
            }
        }

        db.remove_mod_from_instance(mod_id)
    }

    /// Install a modpack: creates a complete new instance with MC + loader + all mods.
    pub async fn install_modpack(
        &self,
        db: &DatabaseService,
        mod_client: &UnifiedModClient,
        download_service: &DownloadService,
        mc_service: &MinecraftService,
        loader_service: &LoaderService,
        source: &ModSource,
        project_id: &str,
        version_id: &str,
        modpack_name: Option<String>,
        modpack_icon_url: Option<String>,
        modpack_description: Option<String>,
    ) -> AppResult<MinecraftInstance> {
        let _install_guard = self.begin_install()?;

        // Initialize progress with modpack metadata from the start
        {
            let mut progress = self.lock_progress()?;
            *progress = InstallProgress::new(InstallStage::FetchingInfo, 0.0);
            progress.modpack_name = modpack_name.clone();
            progress.modpack_icon_url = modpack_icon_url.clone();
        }

        let temp_dir = std::env::temp_dir().join(format!("minesync_modpack_{}", uuid::Uuid::new_v4()));
        tokio::fs::create_dir_all(&temp_dir).await?;

        let instance_id = uuid::Uuid::new_v4().to_string();
        let base_dir = mc_service.base_dir();
        let instance_path = base_dir.join("instances").join(&instance_id);
        let mut maybe_instance_path = Some(instance_path.clone());

        let install_result: AppResult<(MinecraftInstance, Vec<ModDownloadInfo>)> = async {
            // 1. Fetch version info to get the modpack download URL
            self.set_progress(InstallStage::FetchingInfo, 2.0)?;
            let versions = mod_client
                .get_versions(source, project_id, None, None)
                .await?;
            let version = versions
                .into_iter()
                .find(|v| v.id == version_id)
                .ok_or_else(|| AppError::Custom(format!("Modpack version not found: {version_id}")))?;
            let file = version
                .files
                .iter()
                .find(|f| f.primary)
                .or_else(|| version.files.first())
                .ok_or_else(|| AppError::Custom("No files in modpack version".to_string()))?;

            // 2. Download the modpack ZIP
            self.set_progress(InstallStage::DownloadingPack, 5.0)?;
            let zip_path = temp_dir.join(&file.filename);
            let dl_task = DownloadTask {
                url: file.url.clone(),
                dest: zip_path.clone(),
                sha1: file.hashes.get("sha1").cloned(),
                size: file.size,
            };
            download_service.download_all(vec![dl_task]).await?;

            // 3. Extract the ZIP
            self.set_progress(InstallStage::ExtractingPack, 12.0)?;
            let extract_dir = temp_dir.join("extracted");
            extract_zip(&zip_path, &extract_dir)?;

            // 4. Parse manifest and build instance metadata
            let pack_info = parse_modpack_manifest(&extract_dir)?;
            self.set_progress(InstallStage::CreatingInstance, 18.0)?;
            // Set instance_id in progress so frontend can track which instance is installing
            {
                let mut p = self.lock_progress()?;
                p.instance_id = Some(instance_id.clone());
            }
            tokio::fs::create_dir_all(instance_path.join("mods")).await?;

            let now = Utc::now();
            let instance = MinecraftInstance {
                id: instance_id.clone(),
                name: pack_info.name.clone(),
                minecraft_version: pack_info.mc_version.clone(),
                loader: pack_info.loader,
                loader_version: pack_info.loader_version.clone(),
                instance_path: instance_path.to_string_lossy().to_string(),
                icon_path: None,
                icon_url: modpack_icon_url.clone(),
                description: modpack_description.clone(),
                last_played_at: None,
                total_play_time: 0,
                is_active: true,
                created_at: now,
                updated_at: now,
            };

            // 5. Download Minecraft version
            self.set_progress(InstallStage::DownloadingMinecraft, 22.0)?;
            mc_service.fetch_version_manifest().await?;
            let detail = mc_service.fetch_version_detail(&pack_info.mc_version).await?;
            let mc_tasks = mc_service.resolve_downloads(&detail).await?;
            download_service.download_all(mc_tasks).await?;

            // 6. Install mod loader (if not Vanilla) + download loader libraries
            if instance.loader != ModLoader::Vanilla {
                self.set_progress(InstallStage::InstallingLoader, 35.0)?;
                if let Some(ref lv) = pack_info.loader_version {
                    let loader_profile = loader_service
                        .install_loader(&instance.loader, &pack_info.mc_version, lv)
                        .await?;

                    loader_service
                        .download_loader_libraries(&loader_profile, download_service)
                        .await?;
                }
            }

            // 7. Resolve mod download URLs
            self.set_progress(InstallStage::ResolvingMods, 42.0)?;
            let mod_downloads = match pack_info.format {
                PackFormat::CurseForge(ref manifest) => resolve_cf_mods(mod_client, manifest).await?,
                PackFormat::Modrinth(ref index) => resolve_mr_mods(index),
            };

            // 8. Download all mods
            let total_mods = mod_downloads.len() as u32;
            self.set_progress(
                InstallStage::DownloadingMods { current: 0, total: total_mods },
                50.0,
            )?;
            let mod_tasks: Vec<DownloadTask> = mod_downloads
                .iter()
                .map(|m| {
                    // Use the full relative path when available (Modrinth packs
                    // place files in mods/, shaderpacks/, resourcepacks/, etc.).
                    // CurseForge packs always go into mods/.
                    //
                    // Defence-in-depth: validate again at download time even though
                    // resolve_mr_mods already sanitises.  If the path is rejected
                    // here, fall back to mods/ to avoid skipping the file entirely.
                    let dest = match m.relative_path {
                        Some(ref rp) => match safe_relative_path(rp) {
                            Some(safe) => instance_path.join(safe),
                            None => instance_path.join("mods").join(&m.filename),
                        },
                        None => instance_path.join("mods").join(&m.filename),
                    };
                    DownloadTask {
                        url: m.url.clone(),
                        dest,
                        sha1: m.sha1.clone(),
                        size: m.size,
                    }
                })
                .collect();
            download_service.download_all(mod_tasks).await?;

            // 9. Copy overrides
            self.set_progress(InstallStage::CopyingOverrides, 85.0)?;
            let overrides_dir = extract_dir.join(&pack_info.overrides_folder);
            if overrides_dir.exists() {
                copy_dir_recursive(&overrides_dir, &instance_path).await?;
            }

            // 9b. Copy client-overrides (Modrinth packs — takes priority over overrides)
            let client_overrides_dir = extract_dir.join("client-overrides");
            if client_overrides_dir.exists() {
                copy_dir_recursive(&client_overrides_dir, &instance_path).await?;
            }

            Ok((instance, mod_downloads))
        }
        .await;

        let (instance, mod_downloads) = match install_result {
            Ok(ok) => ok,
            Err(e) => {
                let _ = tokio::fs::remove_dir_all(&temp_dir).await;
                if let Some(path) = &maybe_instance_path {
                    let _ = tokio::fs::remove_dir_all(path).await;
                }
                let _ = self.set_progress(
                    InstallStage::Failed {
                        message: e.to_string(),
                    },
                    100.0,
                );
                return Err(e);
            }
        };

        // 10. Persist in DB after successful downloads to avoid partial DB state.
        self.set_progress(InstallStage::RegisteringMods, 92.0)?;
        if let Err(e) = db.create_instance(&instance) {
            let _ = tokio::fs::remove_dir_all(&temp_dir).await;
            if let Some(path) = maybe_instance_path.take() {
                let _ = tokio::fs::remove_dir_all(path).await;
            }
            let _ = self.set_progress(
                InstallStage::Failed {
                    message: e.to_string(),
                },
                100.0,
            );
            return Err(e);
        }

        for m in &mod_downloads {
            let mod_info = ModInfo {
                id: uuid::Uuid::new_v4().to_string(),
                instance_id: instance.id.clone(),
                name: m.name.clone(),
                slug: None,
                version: String::new(),
                file_name: m.filename.clone(),
                file_hash: m.sha1.clone(),
                source: m.source.clone(),
                source_project_id: m.project_id.clone(),
                source_version_id: None,
                is_active: true,
                installed_at: Utc::now(),
            };
            if let Err(e) = db.add_mod_to_instance(&mod_info) {
                log::warn!("Failed to register mod {}: {e}", m.filename);
            }
        }

        let _ = tokio::fs::remove_dir_all(&temp_dir).await;
        self.set_progress(InstallStage::Completed, 100.0)?;
        Ok(instance)
    }

    // --- Private helpers ---

    fn begin_install(&self) -> AppResult<InstallGuard<'_>> {
        match self.install_in_progress.compare_exchange(
            false,
            true,
            Ordering::AcqRel,
            Ordering::Acquire,
        ) {
            Ok(_) => Ok(InstallGuard {
                flag: &self.install_in_progress,
            }),
            Err(_) => Err(AppError::Custom(
                "Another installation is already in progress".to_string(),
            )),
        }
    }

    fn set_progress_fresh(&self, stage: InstallStage, percent: f32) -> AppResult<()> {
        let mut progress = self.lock_progress()?;
        *progress = InstallProgress::new(stage, percent);
        Ok(())
    }

    fn set_progress(&self, stage: InstallStage, percent: f32) -> AppResult<()> {
        let mut progress = self.lock_progress()?;
        // Preserve metadata across progress updates
        let instance_id = progress.instance_id.clone();
        let modpack_name = progress.modpack_name.clone();
        let modpack_icon_url = progress.modpack_icon_url.clone();
        *progress = InstallProgress::new(stage, percent);
        progress.instance_id = instance_id;
        progress.modpack_name = modpack_name;
        progress.modpack_icon_url = modpack_icon_url;
        Ok(())
    }

    fn lock_progress(&self) -> AppResult<MutexGuard<'_, InstallProgress>> {
        self.progress
            .lock()
            .map_err(|e| AppError::Custom(format!("Install progress lock poisoned: {e}")))
    }
}

// --- Modpack parsing ---

#[derive(Debug)]
struct ModDownloadInfo {
    url: String,
    filename: String,
    /// Relative path inside the instance directory (e.g. "mods/sodium.jar",
    /// "shaderpacks/BSL.zip"). Used to place files in the correct subdirectory.
    /// When `None`, falls back to `mods/{filename}`.
    relative_path: Option<String>,
    size: u64,
    sha1: Option<String>,
    name: String,
    source: ModSource,
    project_id: Option<String>,
}

#[derive(Debug)]
enum PackFormat {
    CurseForge(CfManifest),
    Modrinth(MrIndex),
}

#[derive(Debug)]
struct ParsedPackInfo {
    name: String,
    mc_version: String,
    loader: ModLoader,
    loader_version: Option<String>,
    overrides_folder: String,
    format: PackFormat,
}

fn parse_modpack_manifest(extract_dir: &Path) -> AppResult<ParsedPackInfo> {
    // Try CurseForge first
    let cf_manifest_path = extract_dir.join("manifest.json");
    if cf_manifest_path.exists() {
        let data = std::fs::read_to_string(&cf_manifest_path)?;
        let manifest: CfManifest = serde_json::from_str(&data)?;

        let (loader, loader_version) = parse_cf_loader(&manifest);

        return Ok(ParsedPackInfo {
            name: manifest.name.clone(),
            mc_version: manifest.minecraft.version.clone(),
            loader,
            loader_version,
            overrides_folder: manifest.overrides.clone(),
            format: PackFormat::CurseForge(manifest),
        });
    }

    // Try Modrinth
    let mr_index_path = extract_dir.join("modrinth.index.json");
    if mr_index_path.exists() {
        let data = std::fs::read_to_string(&mr_index_path)?;
        let index: MrIndex = serde_json::from_str(&data)?;

        let (loader, loader_version) = parse_mr_loader(&index.dependencies);
        let mc_version = index
            .dependencies
            .get("minecraft")
            .cloned()
            .unwrap_or_default();

        return Ok(ParsedPackInfo {
            name: index.name.clone(),
            mc_version,
            loader,
            loader_version,
            overrides_folder: "overrides".to_string(),
            format: PackFormat::Modrinth(index),
        });
    }

    Err(AppError::Custom(
        "No valid modpack manifest found (expected manifest.json or modrinth.index.json)".to_string(),
    ))
}

/// Parse CurseForge loader string like "forge-47.3.0" or "fabric-0.15.0"
fn parse_cf_loader(manifest: &CfManifest) -> (ModLoader, Option<String>) {
    let primary = manifest
        .minecraft
        .mod_loaders
        .iter()
        .find(|l| l.primary)
        .or_else(|| manifest.minecraft.mod_loaders.first());

    let Some(loader_info) = primary else {
        return (ModLoader::Vanilla, None);
    };

    let id = &loader_info.id;

    if let Some(version) = id.strip_prefix("forge-") {
        return (ModLoader::Forge, Some(version.to_string()));
    }
    if let Some(version) = id.strip_prefix("fabric-") {
        return (ModLoader::Fabric, Some(version.to_string()));
    }
    if let Some(version) = id.strip_prefix("neoforge-") {
        return (ModLoader::NeoForge, Some(version.to_string()));
    }
    if let Some(version) = id.strip_prefix("quilt-") {
        return (ModLoader::Quilt, Some(version.to_string()));
    }

    (ModLoader::Vanilla, None)
}

/// Parse Modrinth dependencies map for loader info
fn parse_mr_loader(deps: &HashMap<String, String>) -> (ModLoader, Option<String>) {
    if let Some(v) = deps.get("fabric-loader") {
        return (ModLoader::Fabric, Some(v.clone()));
    }
    if let Some(v) = deps.get("forge") {
        return (ModLoader::Forge, Some(v.clone()));
    }
    if let Some(v) = deps.get("neoforge") {
        return (ModLoader::NeoForge, Some(v.clone()));
    }
    if let Some(v) = deps.get("quilt-loader") {
        return (ModLoader::Quilt, Some(v.clone()));
    }
    (ModLoader::Vanilla, None)
}

// --- CurseForge mod resolution ---

async fn resolve_cf_mods(
    mod_client: &UnifiedModClient,
    manifest: &CfManifest,
) -> AppResult<Vec<ModDownloadInfo>> {
    let file_ids: Vec<u32> = manifest.files.iter().map(|f| f.file_i_d).collect();

    let resolved = mod_client.get_cf_files_batch(&file_ids).await?;

    // Build a lookup: file_id -> project_id from manifest
    let file_to_project: HashMap<u32, u32> = manifest
        .files
        .iter()
        .map(|f| (f.file_i_d, f.project_i_d))
        .collect();

    let mut downloads = Vec::with_capacity(resolved.len());
    for f in resolved {
        let project_id = file_to_project.get(&f.file_id).copied().unwrap_or(0);
        downloads.push(ModDownloadInfo {
            url: f.download_url,
            filename: f.file_name.clone(),
            relative_path: None,
            size: f.file_size,
            sha1: f.sha1,
            name: f.file_name,
            source: ModSource::CurseForge,
            project_id: Some(project_id.to_string()),
        });
    }

    Ok(downloads)
}

// --- Modrinth mod resolution ---

fn resolve_mr_mods(index: &MrIndex) -> Vec<ModDownloadInfo> {
    index
        .files
        .iter()
        .filter_map(|f| {
            let url = f.downloads.first()?;
            let filename = f
                .path
                .rsplit('/')
                .next()
                .unwrap_or(&f.path)
                .to_string();

            // Validate path to prevent traversal (CVE-2023-25303 / CVE-2023-25307)
            let validated_path = safe_relative_path(&f.path)?;

            Some(ModDownloadInfo {
                url: url.clone(),
                filename: filename.clone(),
                relative_path: Some(validated_path.to_string_lossy().to_string()),
                size: f.file_size,
                sha1: Some(f.hashes.sha1.clone()),
                name: filename,
                source: ModSource::Modrinth,
                project_id: None,
            })
        })
        .collect()
}

// --- Path safety ---

/// Sanitise a relative path from an untrusted source (e.g. Modrinth `path`
/// field in `modrinth.index.json`).
///
/// Rejects absolute paths, `..` components and any sequence that would escape
/// the target directory — the same class of vulnerability as CVE-2023-25303
/// (ATLauncher) and CVE-2023-25307 (mrpack-install).
///
/// Returns `None` if the path is malicious or empty.
fn safe_relative_path(raw: &str) -> Option<PathBuf> {
    let candidate = Path::new(raw);

    // Reject absolute paths
    if candidate.has_root() {
        return None;
    }

    // Rebuild component-by-component, rejecting `..` and empty segments
    let mut sanitised = PathBuf::new();
    for component in candidate.components() {
        match component {
            std::path::Component::Normal(seg) => sanitised.push(seg),
            // Allow `.` (current dir) — harmless
            std::path::Component::CurDir => {}
            // Reject `..`, prefix (`C:\`), and root (`/`)
            _ => return None,
        }
    }

    if sanitised.as_os_str().is_empty() {
        return None;
    }

    Some(sanitised)
}

// --- ZIP extraction ---

fn extract_zip(zip_path: &Path, dest: &Path) -> AppResult<()> {
    let file = std::fs::File::open(zip_path)?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| AppError::Custom(format!("Failed to open ZIP: {e}")))?;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| AppError::Custom(format!("Failed to read ZIP entry: {e}")))?;

        // Prevent path traversal / absolute path extraction.
        let Some(enclosed_path) = entry.enclosed_name().map(|p| p.to_path_buf()) else {
            continue;
        };
        if entry.is_dir() {
            continue;
        }

        let out_path = dest.join(enclosed_path);
        if let Some(parent) = out_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let mut outfile = std::fs::File::create(&out_path)?;
        std::io::copy(&mut entry, &mut outfile)?;
    }

    Ok(())
}

// --- Directory copy ---

async fn copy_dir_recursive(src: &Path, dst: &Path) -> AppResult<()> {
    let src = src.to_path_buf();
    let dst = dst.to_path_buf();

    // Run blocking FS walk in a spawned blocking task
    tokio::task::spawn_blocking(move || copy_dir_sync(&src, &dst))
        .await
        .map_err(|e| AppError::Custom(format!("Copy task panicked: {e}")))?
}

fn copy_dir_sync(src: &Path, dst: &Path) -> AppResult<()> {
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let dest_path = dst.join(entry.file_name());

        if file_type.is_dir() {
            std::fs::create_dir_all(&dest_path)?;
            copy_dir_sync(&entry.path(), &dest_path)?;
        } else {
            if let Some(parent) = dest_path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::copy(entry.path(), &dest_path)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    use crate::models::instance::MinecraftInstance;
    use crate::models::mod_info::ModInfo;

    fn temp_path(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!("minesync_test_{label}_{}", uuid::Uuid::new_v4()))
    }

    #[test]
    fn extract_zip_skips_absolute_paths() -> AppResult<()> {
        let root = temp_path("zip_slip");
        std::fs::create_dir_all(&root)?;

        let zip_path = root.join("pack.zip");
        let outside_file = root.join("outside.txt");

        {
            let file = std::fs::File::create(&zip_path)?;
            let mut zip = zip::ZipWriter::new(file);
            let options = zip::write::SimpleFileOptions::default();
            zip.start_file(outside_file.to_string_lossy(), options)
                .map_err(|e| AppError::Custom(format!("zip start_file failed: {e}")))?;
            zip.write_all(b"owned")?;
            zip.finish()
                .map_err(|e| AppError::Custom(format!("zip finish failed: {e}")))?;
        }

        let extract_dir = root.join("extract");
        extract_zip(&zip_path, &extract_dir)?;

        assert!(
            !outside_file.exists(),
            "Absolute ZIP entry should not be extracted outside destination"
        );

        let _ = std::fs::remove_dir_all(root);
        Ok(())
    }

    #[test]
    fn remove_mod_deletes_file_and_disables_db_row() -> AppResult<()> {
        let root = temp_path("remove_mod");
        std::fs::create_dir_all(&root)?;
        let db = DatabaseService::new(&root.join("test.db"))?;

        let instance_path = root.join("instance");
        std::fs::create_dir_all(instance_path.join("mods"))?;

        let now = Utc::now();
        let instance = MinecraftInstance {
            id: uuid::Uuid::new_v4().to_string(),
            name: "Test".to_string(),
            minecraft_version: "1.20.1".to_string(),
            loader: ModLoader::Fabric,
            loader_version: Some("0.15.0".to_string()),
            instance_path: instance_path.to_string_lossy().to_string(),
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

        let mod_info = ModInfo {
            id: uuid::Uuid::new_v4().to_string(),
            instance_id: instance.id.clone(),
            name: "Test Mod".to_string(),
            slug: None,
            version: "1.0.0".to_string(),
            file_name: "test-mod.jar".to_string(),
            file_hash: None,
            source: ModSource::Local,
            source_project_id: None,
            source_version_id: None,
            is_active: true,
            installed_at: Utc::now(),
        };
        db.add_mod_to_instance(&mod_info)?;

        let mod_file = instance_path.join("mods").join(&mod_info.file_name);
        std::fs::write(&mod_file, b"jar-bytes")?;

        let service = InstallService::new();
        service.remove_mod(&db, &mod_info.id)?;

        assert!(
            !mod_file.exists(),
            "Removing a mod should delete the mod file from disk"
        );
        let mods = db.list_instance_mods(&instance.id)?;
        assert!(mods.is_empty(), "Removed mod should be inactive in DB");

        let _ = std::fs::remove_dir_all(root);
        Ok(())
    }

    #[test]
    fn begin_install_blocks_concurrent_installations() -> AppResult<()> {
        let service = InstallService::new();

        let guard = service.begin_install()?;
        assert!(
            service.begin_install().is_err(),
            "A second install must be rejected while one is active"
        );

        drop(guard);

        assert!(
            service.begin_install().is_ok(),
            "A new install should be allowed after the previous one completes"
        );
        Ok(())
    }

    #[test]
    fn set_progress_fresh_clears_stale_metadata() -> AppResult<()> {
        let service = InstallService::new();
        {
            let mut progress = service.lock_progress()?;
            progress.instance_id = Some("instance-123".to_string());
            progress.modpack_name = Some("Old Pack".to_string());
            progress.modpack_icon_url = Some("https://example.com/old.png".to_string());
        }

        service.set_progress_fresh(InstallStage::FetchingInfo, 10.0)?;
        let progress = service.get_progress()?;

        assert_eq!(progress.overall_percent, 10.0);
        assert!(progress.instance_id.is_none());
        assert!(progress.modpack_name.is_none());
        assert!(progress.modpack_icon_url.is_none());
        Ok(())
    }
}
