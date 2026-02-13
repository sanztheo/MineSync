pub mod curseforge;
pub mod modrinth;

use std::collections::HashSet;

use crate::errors::AppResult;
use crate::models::mod_info::ModSource;
use crate::models::mod_platform::{
    DependencyType, ModDetails, ModSearchResult, ModVersionInfo, SearchFilters, SearchResponse,
};

use self::curseforge::CurseForgeClient;
use self::modrinth::ModrinthClient;

// --- Trait ---

/// Unified interface for mod platform clients.
///
/// Both CurseForge and Modrinth implement this contract, and the
/// `UnifiedModClient` orchestrates parallel queries across both.
#[allow(dead_code)]
pub trait ModPlatform: Send + Sync {
    fn search_mods(
        &self,
        filters: &SearchFilters,
    ) -> impl std::future::Future<Output = AppResult<SearchResponse>> + Send;

    fn get_mod(
        &self,
        project_id: &str,
    ) -> impl std::future::Future<Output = AppResult<ModDetails>> + Send;

    fn get_versions(
        &self,
        project_id: &str,
        game_version: Option<&str>,
        loader: Option<&str>,
    ) -> impl std::future::Future<Output = AppResult<Vec<ModVersionInfo>>> + Send;
}

impl ModPlatform for CurseForgeClient {
    async fn search_mods(&self, filters: &SearchFilters) -> AppResult<SearchResponse> {
        self.search_mods(filters).await
    }

    async fn get_mod(&self, project_id: &str) -> AppResult<ModDetails> {
        self.get_mod(project_id).await
    }

    async fn get_versions(
        &self,
        project_id: &str,
        game_version: Option<&str>,
        loader: Option<&str>,
    ) -> AppResult<Vec<ModVersionInfo>> {
        self.get_versions(project_id, game_version, loader).await
    }
}

impl ModPlatform for ModrinthClient {
    async fn search_mods(&self, filters: &SearchFilters) -> AppResult<SearchResponse> {
        self.search_mods(filters).await
    }

    async fn get_mod(&self, project_id: &str) -> AppResult<ModDetails> {
        self.get_mod(project_id).await
    }

    async fn get_versions(
        &self,
        project_id: &str,
        game_version: Option<&str>,
        loader: Option<&str>,
    ) -> AppResult<Vec<ModVersionInfo>> {
        self.get_versions(project_id, game_version, loader).await
    }
}

// --- Unified Client ---

/// Orchestrates CurseForge and Modrinth in parallel, deduplicates results.
pub struct UnifiedModClient {
    curseforge: Option<CurseForgeClient>,
    modrinth: ModrinthClient,
}

impl UnifiedModClient {
    /// Create a new unified client.
    ///
    /// CurseForge requires an API key; if `None` is passed, only Modrinth is queried.
    pub fn new(curseforge_api_key: Option<String>) -> Self {
        let curseforge = curseforge_api_key.map(CurseForgeClient::new);
        let modrinth = ModrinthClient::new();
        Self {
            curseforge,
            modrinth,
        }
    }

    /// Search both platforms in parallel, merge and deduplicate results by slug.
    pub async fn search_mods(&self, filters: &SearchFilters) -> AppResult<SearchResponse> {
        let mr_future = self.modrinth.search_mods(filters);

        match &self.curseforge {
            Some(cf) => {
                let cf_future = cf.search_mods(filters);
                let (mr_result, cf_result) = tokio::join!(mr_future, cf_future);

                let mr = mr_result.unwrap_or_else(|e| {
                    log::warn!("Modrinth search failed: {e}");
                    empty_response(filters)
                });

                let cf = cf_result.unwrap_or_else(|e| {
                    log::warn!("CurseForge search failed: {e}");
                    empty_response(filters)
                });

                let total_hits = mr.total_hits + cf.total_hits;
                let merged = deduplicate_results(mr.hits, cf.hits);

                Ok(SearchResponse {
                    hits: merged,
                    total_hits,
                    offset: filters.offset,
                    limit: filters.limit,
                })
            }
            None => self.modrinth.search_mods(filters).await,
        }
    }

    /// Get mod details from a specific platform.
    pub async fn get_mod(&self, source: &ModSource, project_id: &str) -> AppResult<ModDetails> {
        match source {
            ModSource::CurseForge => {
                let cf = self.curseforge.as_ref().ok_or_else(|| {
                    crate::errors::AppError::Custom("CurseForge API key not configured".to_string())
                })?;
                cf.get_mod(project_id).await
            }
            ModSource::Modrinth => self.modrinth.get_mod(project_id).await,
            ModSource::Local => Err(crate::errors::AppError::Custom(
                "Cannot fetch details for local mods".to_string(),
            )),
        }
    }

    /// Get versions from a specific platform.
    pub async fn get_versions(
        &self,
        source: &ModSource,
        project_id: &str,
        game_version: Option<&str>,
        loader: Option<&str>,
    ) -> AppResult<Vec<ModVersionInfo>> {
        match source {
            ModSource::CurseForge => {
                let cf = self.curseforge.as_ref().ok_or_else(|| {
                    crate::errors::AppError::Custom("CurseForge API key not configured".to_string())
                })?;
                cf.get_versions(project_id, game_version, loader).await
            }
            ModSource::Modrinth => {
                self.modrinth
                    .get_versions(project_id, game_version, loader)
                    .await
            }
            ModSource::Local => Err(crate::errors::AppError::Custom(
                "Cannot fetch versions for local mods".to_string(),
            )),
        }
    }

    /// Resolve all required dependencies for a given version, recursively.
    ///
    /// Returns a flat list of all transitive required dependencies.
    pub async fn resolve_dependencies(
        &self,
        version: &ModVersionInfo,
        game_version: Option<&str>,
        loader: Option<&str>,
    ) -> AppResult<Vec<ModVersionInfo>> {
        let mut resolved: Vec<ModVersionInfo> = Vec::new();
        let mut visited: HashSet<String> = HashSet::new();
        let mut queue: Vec<(String, ModSource)> = Vec::new();

        // Seed from the initial version's required dependencies
        for dep in &version.dependencies {
            if matches!(dep.dependency_type, DependencyType::Required) {
                queue.push((dep.project_id.clone(), version.source.clone()));
            }
        }

        while let Some((project_id, source)) = queue.pop() {
            if visited.contains(&project_id) {
                continue;
            }
            visited.insert(project_id.clone());

            let versions = match self
                .get_versions(&source, &project_id, game_version, loader)
                .await
            {
                Ok(v) => v,
                Err(e) => {
                    log::warn!("Failed to resolve dependency {project_id}: {e}");
                    continue;
                }
            };

            // Pick the first (latest) compatible version
            if let Some(best) = versions.into_iter().next() {
                // Enqueue transitive dependencies
                for dep in &best.dependencies {
                    if matches!(dep.dependency_type, DependencyType::Required)
                        && !visited.contains(&dep.project_id)
                    {
                        queue.push((dep.project_id.clone(), best.source.clone()));
                    }
                }
                resolved.push(best);
            }
        }

        Ok(resolved)
    }
}

// --- Helpers ---

fn empty_response(filters: &SearchFilters) -> SearchResponse {
    SearchResponse {
        hits: Vec::new(),
        total_hits: 0,
        offset: filters.offset,
        limit: filters.limit,
    }
}

/// Deduplicate results from two platforms by slug.
///
/// If the same mod exists on both platforms, prefer the Modrinth version
/// (it has better metadata — body, loaders, etc.).
fn deduplicate_results(
    modrinth: Vec<ModSearchResult>,
    curseforge: Vec<ModSearchResult>,
) -> Vec<ModSearchResult> {
    let mut seen_slugs: HashSet<String> = HashSet::new();
    let mut merged: Vec<ModSearchResult> = Vec::new();

    // Modrinth results first (preferred)
    for hit in modrinth {
        let slug = hit.slug.to_lowercase();
        seen_slugs.insert(slug);
        merged.push(hit);
    }

    // CurseForge results, skip duplicates
    for hit in curseforge {
        let slug = hit.slug.to_lowercase();
        if !seen_slugs.contains(&slug) {
            seen_slugs.insert(slug);
            merged.push(hit);
        }
    }

    // Sort merged results by downloads descending
    merged.sort_by(|a, b| b.downloads.cmp(&a.downloads));
    merged
}
