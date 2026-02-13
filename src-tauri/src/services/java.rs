use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use flate2::read::GzDecoder;
use futures_util::StreamExt;
use sha2::{Digest, Sha256};
use tokio::io::AsyncReadExt;
use tokio::io::AsyncWriteExt;

use crate::errors::{AppError, AppResult};
use crate::models::java::{JavaInstallResult, JavaRuntimeStatus};

const REQUIRED_JAVA_MAJOR: u32 = 21;
const RUNTIME_VENDOR: &str = "temurin";

pub struct JavaService {
    app_dir: PathBuf,
    client: reqwest::Client,
    status: Arc<Mutex<JavaRuntimeStatus>>,
    install_lock: Arc<tokio::sync::Mutex<()>>,
}

impl JavaService {
    pub fn new(app_dir: PathBuf) -> Self {
        Self {
            app_dir,
            client: reqwest::Client::new(),
            status: Arc::new(Mutex::new(JavaRuntimeStatus::Missing)),
            install_lock: Arc::new(tokio::sync::Mutex::new(())),
        }
    }

    pub fn status(&self) -> AppResult<JavaRuntimeStatus> {
        let current = self.lock_status()?.clone();
        if matches!(current, JavaRuntimeStatus::Installing { .. }) {
            // "Installing" is only valid while install_runtime() holds the install lock.
            // If the lock is free, we are stuck in a stale state and must recover.
            if self.install_lock.try_lock().is_err() {
                return Ok(current);
            }
        }

        if let Some((java_path, major, source)) = self.resolve_existing_java()? {
            let ready = JavaRuntimeStatus::Ready {
                java_path,
                major_version: major,
                source,
            };
            self.set_status(ready.clone())?;
            return Ok(ready);
        }

        match current {
            JavaRuntimeStatus::Error { .. } => Ok(current),
            _ => {
                let missing = JavaRuntimeStatus::Missing;
                self.set_status(missing.clone())?;
                Ok(missing)
            }
        }
    }

    pub async fn install_runtime(&self) -> AppResult<JavaInstallResult> {
        let _guard = self.install_lock.lock().await;

        let result = self.install_runtime_locked().await;
        if let Err(err) = &result {
            let _ = self.set_status(JavaRuntimeStatus::Error {
                message: err.to_string(),
            });
        }
        result
    }

    async fn install_runtime_locked(&self) -> AppResult<JavaInstallResult> {

        if let Some((java_path, major, source)) = self.resolve_existing_java()? {
            let ready = JavaRuntimeStatus::Ready {
                java_path: java_path.clone(),
                major_version: major,
                source,
            };
            self.set_status(ready)?;
            return Ok(JavaInstallResult {
                java_path,
                major_version: major,
                install_dir: self.install_root().to_string_lossy().to_string(),
            });
        }

        self.set_status(JavaRuntimeStatus::Installing {
            stage: "preparing".to_string(),
            percent: 0.0,
            downloaded_bytes: 0,
            total_bytes: None,
        })?;

        let download_url = self.adoptium_binary_url()?;
        let archive_ext = if download_url.contains("/windows/") {
            "zip"
        } else {
            "tar.gz"
        };

        let install_root = self.install_root();
        tokio::fs::create_dir_all(&install_root).await?;

        let archive_path = install_root.join(format!("java21.{archive_ext}"));
        let extract_root = install_root.join("extract");
        let marker_path = install_root.join("java_path.txt");

        self.download_archive(&download_url, &archive_path).await?;
        self.verify_checksum(&archive_path, &download_url).await?;

        self.set_status(JavaRuntimeStatus::Installing {
            stage: "extracting".to_string(),
            percent: 92.0,
            downloaded_bytes: 0,
            total_bytes: None,
        })?;

        if extract_root.exists() {
            tokio::fs::remove_dir_all(&extract_root).await?;
        }
        tokio::fs::create_dir_all(&extract_root).await?;

        if archive_ext == "zip" {
            extract_zip_archive(&archive_path, &extract_root).await?;
        } else {
            extract_tar_gz_archive(&archive_path, &extract_root).await?;
        }

        let java_path = find_java_binary(&extract_root).ok_or_else(|| {
            AppError::Custom(
                "Java runtime extracted but executable was not found".to_string(),
            )
        })?;

        let java_str = java_path.to_string_lossy().to_string();
        let major = probe_java_major(&java_str)?.ok_or_else(|| {
            AppError::Custom("Unable to read Java version after installation".to_string())
        })?;
        if major < REQUIRED_JAVA_MAJOR {
            return Err(AppError::Custom(format!(
                "Installed Java {major} is below required {REQUIRED_JAVA_MAJOR}"
            )));
        }

        tokio::fs::write(&marker_path, &java_str).await?;

        let result = JavaInstallResult {
            java_path: java_str.clone(),
            major_version: major,
            install_dir: install_root.to_string_lossy().to_string(),
        };
        self.set_status(JavaRuntimeStatus::Ready {
            java_path: java_str,
            major_version: major,
            source: "managed".to_string(),
        })?;
        Ok(result)
    }

    pub async fn get_java_path(&self) -> AppResult<String> {
        if let Some((java_path, major, source)) = self.resolve_existing_java()? {
            self.set_status(JavaRuntimeStatus::Ready {
                java_path: java_path.clone(),
                major_version: major,
                source,
            })?;
            return Ok(java_path);
        }

        Err(AppError::Custom(
            "Java 21 runtime is missing. Install Java from the startup modal.".to_string(),
        ))
    }

    fn resolve_existing_java(&self) -> AppResult<Option<(String, u32, String)>> {
        if let Some((path, major)) = self.resolve_managed_java()? {
            return Ok(Some((path, major, "managed".to_string())));
        }

        if let Some(major) = probe_java_major("java")? {
            if major >= REQUIRED_JAVA_MAJOR {
                return Ok(Some(("java".to_string(), major, "system".to_string())));
            }
        }

        Ok(None)
    }

    fn resolve_managed_java(&self) -> AppResult<Option<(String, u32)>> {
        let marker = self.install_root().join("java_path.txt");
        if !marker.exists() {
            return Ok(None);
        }

        let path = std::fs::read_to_string(marker)?.trim().to_string();
        if path.is_empty() {
            return Ok(None);
        }

        let Some(major) = probe_java_major(&path)? else {
            return Ok(None);
        };
        if major < REQUIRED_JAVA_MAJOR {
            return Ok(None);
        }

        Ok(Some((path, major)))
    }

    fn install_root(&self) -> PathBuf {
        self.app_dir
            .join("java-runtime")
            .join(format!("{RUNTIME_VENDOR}-{REQUIRED_JAVA_MAJOR}"))
    }

    fn adoptium_binary_url(&self) -> AppResult<String> {
        let os = platform_os()?;
        let arch = platform_arch()?;
        Ok(format!(
            "https://api.adoptium.net/v3/binary/latest/{REQUIRED_JAVA_MAJOR}/ga/{os}/{arch}/jdk/hotspot/normal/eclipse"
        ))
    }

    async fn download_archive(&self, download_url: &str, archive_path: &Path) -> AppResult<()> {
        let response = self.client.get(download_url).send().await?;
        let response = response.error_for_status()?;
        let total = response.content_length();
        let mut downloaded: u64 = 0;
        let mut stream = response.bytes_stream();
        let mut file = tokio::fs::File::create(archive_path).await?;

        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            file.write_all(&chunk).await?;
            downloaded += chunk.len() as u64;

            let percent = match total {
                Some(t) if t > 0 => (downloaded as f32 / t as f32) * 90.0,
                _ => 0.0,
            };

            self.set_status(JavaRuntimeStatus::Installing {
                stage: "downloading".to_string(),
                percent,
                downloaded_bytes: downloaded,
                total_bytes: total,
            })?;
        }

        file.flush().await?;
        Ok(())
    }

    async fn verify_checksum(&self, archive_path: &Path, download_url: &str) -> AppResult<()> {
        self.set_status(JavaRuntimeStatus::Installing {
            stage: "verifying".to_string(),
            percent: 91.0,
            downloaded_bytes: 0,
            total_bytes: None,
        })?;

        let checksum_url = format!("{download_url}.sha256.txt");
        let checksum_body = self
            .client
            .get(&checksum_url)
            .send()
            .await?
            .error_for_status()?
            .text()
            .await?;

        let expected = checksum_body
            .split_whitespace()
            .next()
            .ok_or_else(|| AppError::Custom("Invalid checksum response".to_string()))?
            .to_lowercase();

        let actual = compute_sha256(archive_path).await?.to_lowercase();
        if actual != expected {
            return Err(AppError::Custom(format!(
                "Java archive checksum mismatch: expected {expected}, got {actual}"
            )));
        }

        Ok(())
    }

    fn lock_status(&self) -> AppResult<std::sync::MutexGuard<'_, JavaRuntimeStatus>> {
        self.status
            .lock()
            .map_err(|e| AppError::Custom(format!("Java status lock poisoned: {e}")))
    }

    fn set_status(&self, status: JavaRuntimeStatus) -> AppResult<()> {
        let mut guard = self.lock_status()?;
        *guard = status;
        Ok(())
    }
}

fn platform_os() -> AppResult<&'static str> {
    #[cfg(target_os = "windows")]
    {
        return Ok("windows");
    }

    #[cfg(target_os = "macos")]
    {
        return Ok("mac");
    }

    #[allow(unreachable_code)]
    Err(AppError::Custom(
        "Automatic Java setup is supported only on macOS and Windows".to_string(),
    ))
}

fn platform_arch() -> AppResult<&'static str> {
    #[cfg(target_arch = "x86_64")]
    {
        return Ok("x64");
    }

    #[cfg(target_arch = "aarch64")]
    {
        return Ok("aarch64");
    }

    #[allow(unreachable_code)]
    Err(AppError::Custom(
        "Unsupported CPU architecture for automatic Java setup".to_string(),
    ))
}

fn probe_java_major(java_cmd: &str) -> AppResult<Option<u32>> {
    let output = std::process::Command::new(java_cmd)
        .arg("-version")
        .output();

    let output = match output {
        Ok(out) => out,
        Err(_) => return Ok(None),
    };

    let mut text = String::new();
    text.push_str(&String::from_utf8_lossy(&output.stdout));
    text.push('\n');
    text.push_str(&String::from_utf8_lossy(&output.stderr));

    Ok(parse_java_major(&text))
}

fn parse_java_major(version_text: &str) -> Option<u32> {
    let start = version_text.find('"')?;
    let end = version_text[start + 1..].find('"')?;
    let quoted = &version_text[start + 1..start + 1 + end];

    let parts: Vec<&str> = quoted.split('.').collect();
    if parts.first().copied() == Some("1") {
        return parts.get(1)?.parse::<u32>().ok();
    }

    parts.first()?.parse::<u32>().ok()
}

async fn compute_sha256(path: &Path) -> AppResult<String> {
    let mut file = tokio::fs::File::open(path).await?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 64 * 1024];

    loop {
        let n = file.read(&mut buffer).await?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

async fn extract_zip_archive(archive: &Path, dest: &Path) -> AppResult<()> {
    let archive = archive.to_path_buf();
    let dest = dest.to_path_buf();
    tokio::task::spawn_blocking(move || {
        let file = std::fs::File::open(&archive)?;
        let mut zip = zip::ZipArchive::new(file)
            .map_err(|e| AppError::Custom(format!("Failed to open Java ZIP: {e}")))?;

        for i in 0..zip.len() {
            let mut entry = zip
                .by_index(i)
                .map_err(|e| AppError::Custom(format!("Failed to read ZIP entry: {e}")))?;

            let Some(enclosed) = entry.enclosed_name().map(|p| p.to_path_buf()) else {
                continue;
            };
            if entry.is_dir() {
                continue;
            }

            let out_path = dest.join(enclosed);
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent)?;
            }

            let mut outfile = std::fs::File::create(out_path)?;
            std::io::copy(&mut entry, &mut outfile)?;
        }

        Ok::<(), AppError>(())
    })
    .await
    .map_err(|e| AppError::Custom(format!("ZIP extraction task failed: {e}")))?
}

async fn extract_tar_gz_archive(archive: &Path, dest: &Path) -> AppResult<()> {
    let archive = archive.to_path_buf();
    let dest = dest.to_path_buf();
    tokio::task::spawn_blocking(move || {
        let file = std::fs::File::open(&archive)?;
        let decoder = GzDecoder::new(file);
        let mut tar = tar::Archive::new(decoder);

        for entry in tar.entries()? {
            let mut entry = entry?;
            let path = entry.path()?.to_path_buf();
            if path.is_absolute() {
                continue;
            }
            if path
                .components()
                .any(|c| matches!(c, std::path::Component::ParentDir))
            {
                continue;
            }

            let out_path = dest.join(path);
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            entry.unpack(out_path)?;
        }

        Ok::<(), AppError>(())
    })
    .await
    .map_err(|e| AppError::Custom(format!("TAR extraction task failed: {e}")))?
}

fn find_java_binary(root: &Path) -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    let java_name = "java.exe";
    #[cfg(not(target_os = "windows"))]
    let java_name = "java";

    let direct_candidates = [
        root.join("bin").join(java_name),
        root.join("Contents").join("Home").join("bin").join(java_name),
    ];

    for candidate in &direct_candidates {
        if candidate.is_file() {
            return Some(candidate.clone());
        }
    }

    let entries = std::fs::read_dir(root).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let nested = [
            path.join("bin").join(java_name),
            path.join("Contents").join("Home").join("bin").join(java_name),
        ];
        for candidate in &nested {
            if candidate.is_file() {
                return Some(candidate.clone());
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_service() -> JavaService {
        let app_dir = std::env::temp_dir().join(format!("minesync-java-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&app_dir).expect("create temp app dir");
        JavaService::new(app_dir)
    }

    #[test]
    fn status_does_not_keep_stale_installing() {
        let service = make_service();

        service
            .set_status(JavaRuntimeStatus::Installing {
                stage: "downloading".to_string(),
                percent: 42.0,
                downloaded_bytes: 10,
                total_bytes: Some(100),
            })
            .expect("set status");

        let status = service.status().expect("status");
        assert!(
            !matches!(status, JavaRuntimeStatus::Installing { .. }),
            "expected stale installing state to recover from installing, got: {status:?}"
        );
    }

    #[test]
    fn status_keeps_installing_while_install_is_in_progress() {
        let service = make_service();
        let _install_guard = service
            .install_lock
            .try_lock()
            .expect("acquire install lock");

        service
            .set_status(JavaRuntimeStatus::Installing {
                stage: "downloading".to_string(),
                percent: 42.0,
                downloaded_bytes: 10,
                total_bytes: Some(100),
            })
            .expect("set status");

        let status = service.status().expect("status");
        assert!(
            matches!(status, JavaRuntimeStatus::Installing { .. }),
            "expected installing while lock is held, got: {status:?}"
        );
    }
}
