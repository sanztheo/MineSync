use std::path::PathBuf;
use std::sync::{Arc, Mutex, MutexGuard};

use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};

use crate::errors::{AppError, AppResult};

const MAX_RETRIES: usize = 3;
const DEFAULT_CONCURRENT: usize = 4;

// --- Public types ---

#[derive(Debug, Clone)]
pub struct DownloadTask {
    pub url: String,
    pub dest: PathBuf,
    pub sha1: Option<String>,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub total_files: usize,
    pub completed_files: usize,
    pub total_bytes: u64,
    pub downloaded_bytes: u64,
    pub failed_files: Vec<String>,
    pub state: DownloadState,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum DownloadState {
    Idle,
    Downloading,
    Completed,
    Failed { message: String },
}

// --- DownloadService ---

#[derive(Clone)]
pub struct DownloadService {
    client: reqwest::Client,
    progress: Arc<Mutex<DownloadProgress>>,
    max_concurrent: usize,
}

impl DownloadService {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
            progress: Arc::new(Mutex::new(DownloadProgress {
                total_files: 0,
                completed_files: 0,
                total_bytes: 0,
                downloaded_bytes: 0,
                failed_files: Vec::new(),
                state: DownloadState::Idle,
            })),
            max_concurrent: DEFAULT_CONCURRENT,
        }
    }

    pub fn get_progress(&self) -> AppResult<DownloadProgress> {
        Ok(self.lock_progress()?.clone())
    }

    pub fn is_downloading(&self) -> AppResult<bool> {
        Ok(self.lock_progress()?.state == DownloadState::Downloading)
    }

    /// Download all tasks with parallel execution and progress tracking
    pub async fn download_all(&self, tasks: Vec<DownloadTask>) -> AppResult<()> {
        let total_bytes: u64 = tasks.iter().map(|t| t.size).sum();
        let total_files = tasks.len();

        // Initialize progress
        {
            let mut progress = self.lock_progress()?;
            *progress = DownloadProgress {
                total_files,
                completed_files: 0,
                total_bytes,
                downloaded_bytes: 0,
                failed_files: Vec::new(),
                state: DownloadState::Downloading,
            };
        }

        // Skip already cached files
        let pending = self.filter_cached(tasks).await;
        let skipped = total_files - pending.len();
        if skipped > 0 {
            let mut progress = self.lock_progress()?;
            progress.completed_files = skipped;
        }

        // Download with concurrency limit
        let semaphore = Arc::new(tokio::sync::Semaphore::new(self.max_concurrent));
        let mut handles = Vec::with_capacity(pending.len());

        for task in pending {
            let sem = Arc::clone(&semaphore);
            let service = self.clone();

            handles.push(tokio::spawn(async move {
                let _permit = sem
                    .acquire_owned()
                    .await
                    .map_err(|e| AppError::Custom(format!("Semaphore error: {e}")))?;
                service.download_file(&task).await
            }));
        }

        // Await all tasks
        for handle in handles {
            match handle.await {
                Ok(Ok(())) => {}
                Ok(Err(e)) => log::error!("Download error: {e}"),
                Err(e) => log::error!("Download task panicked: {e}"),
            }
        }

        // Finalize state
        {
            let mut progress = self.lock_progress()?;
            if progress.failed_files.is_empty() {
                progress.state = DownloadState::Completed;
            } else {
                progress.state = DownloadState::Failed {
                    message: format!("{} files failed", progress.failed_files.len()),
                };
            }
        }

        Ok(())
    }

    // --- Private methods ---

    /// Download a single file with retry logic
    async fn download_file(&self, task: &DownloadTask) -> AppResult<()> {
        if let Some(parent) = task.dest.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        for attempt in 1..=MAX_RETRIES {
            match self.try_download(task).await {
                Ok(()) => {
                    let mut progress = self.lock_progress()?;
                    progress.completed_files += 1;
                    return Ok(());
                }
                Err(e) if attempt < MAX_RETRIES => {
                    log::warn!(
                        "Download attempt {attempt}/{MAX_RETRIES} failed for {}: {e}",
                        task.url
                    );
                    let backoff = std::time::Duration::from_secs(attempt as u64);
                    tokio::time::sleep(backoff).await;
                }
                Err(e) => {
                    let mut progress = self.lock_progress()?;
                    progress.failed_files.push(task.url.clone());
                    return Err(e);
                }
            }
        }

        Err(AppError::Custom(format!(
            "Download failed after {MAX_RETRIES} attempts: {}",
            task.url
        )))
    }

    /// Attempt a single download + SHA1 verification
    async fn try_download(&self, task: &DownloadTask) -> AppResult<()> {
        let response = self.client.get(&task.url).send().await?;

        if !response.status().is_success() {
            return Err(AppError::Custom(format!(
                "HTTP {} for {}",
                response.status(),
                task.url
            )));
        }

        let bytes = response.bytes().await?;

        // SHA1 verification
        if let Some(ref expected) = task.sha1 {
            let actual = compute_sha1(&bytes);
            if actual != *expected {
                return Err(AppError::Custom(format!(
                    "SHA1 mismatch for {}: expected {expected}, got {actual}",
                    task.dest.display()
                )));
            }
        }

        // Update progress
        {
            let mut progress = self.lock_progress()?;
            progress.downloaded_bytes += bytes.len() as u64;
        }

        tokio::fs::write(&task.dest, &bytes).await?;
        Ok(())
    }

    /// Skip files that already exist with correct size
    async fn filter_cached(&self, tasks: Vec<DownloadTask>) -> Vec<DownloadTask> {
        let mut pending = Vec::new();

        for task in tasks {
            if is_file_cached(&task).await {
                continue;
            }
            pending.push(task);
        }

        pending
    }

    fn lock_progress(&self) -> AppResult<MutexGuard<'_, DownloadProgress>> {
        self.progress
            .lock()
            .map_err(|e| AppError::Custom(format!("Progress lock poisoned: {e}")))
    }
}

// --- Helpers ---

async fn is_file_cached(task: &DownloadTask) -> bool {
    let meta = match tokio::fs::metadata(&task.dest).await {
        Ok(m) => m,
        Err(_) => return false,
    };

    if meta.len() != task.size || task.size == 0 {
        return false;
    }

    // Verify SHA1 when available to detect corrupted/tampered files
    if let Some(ref expected_sha1) = task.sha1 {
        let bytes = match tokio::fs::read(&task.dest).await {
            Ok(b) => b,
            Err(_) => return false,
        };
        let actual = compute_sha1(&bytes);
        if actual != *expected_sha1 {
            log::warn!(
                "Cache SHA1 mismatch for {}, re-downloading",
                task.dest.display()
            );
            return false;
        }
    }

    true
}

fn compute_sha1(data: &[u8]) -> String {
    let hash = Sha1::digest(data);
    format!("{hash:x}")
}
