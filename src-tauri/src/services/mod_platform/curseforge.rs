use std::collections::HashMap;

use serde::Deserialize;

use crate::errors::{AppError, AppResult};
use crate::models::mod_info::ModSource;
use crate::models::mod_platform::{
    DependencyType, ModDependency, ModDetails, ModSearchResult, ModVersionFile, ModVersionInfo,
    SearchFilters, SearchResponse, SearchSort,
};

const BASE_URL: &str = "https://api.curseforge.com";
const MINECRAFT_GAME_ID: u32 = 432;
const CLASS_ID_MODS: u32 = 6;

// CurseForge download URL fallback when API returns null
const CDN_BASE: &str = "https://edge.forgecdn.net/files";

pub struct CurseForgeClient {
    client: reqwest::Client,
    api_key: String,
}

// --- CurseForge API response types ---

#[derive(Deserialize)]
struct CfSearchResponse {
    data: Vec<CfMod>,
    pagination: CfPagination,
}

#[derive(Deserialize)]
struct CfPagination {
    #[serde(rename = "totalCount")]
    total_count: u32,
    index: u32,
    #[serde(rename = "pageSize")]
    page_size: u32,
}

#[derive(Deserialize)]
struct CfModResponse {
    data: CfMod,
}

#[derive(Deserialize)]
struct CfFilesResponse {
    data: Vec<CfFile>,
}

#[derive(Deserialize)]
struct CfMod {
    id: u32,
    name: String,
    slug: String,
    summary: String,
    #[serde(rename = "downloadCount")]
    download_count: u64,
    authors: Vec<CfAuthor>,
    logo: Option<CfLogo>,
    categories: Vec<CfCategory>,
    #[serde(rename = "latestFilesIndexes")]
    latest_files_indexes: Option<Vec<CfFileIndex>>,
    #[serde(rename = "dateCreated")]
    date_created: String,
    #[serde(rename = "dateModified")]
    date_modified: String,
    links: Option<CfModLinks>,
}

#[derive(Deserialize)]
struct CfAuthor {
    name: String,
}

#[derive(Deserialize)]
struct CfLogo {
    #[serde(rename = "thumbnailUrl")]
    thumbnail_url: Option<String>,
}

#[derive(Deserialize)]
struct CfCategory {
    name: String,
}

#[derive(Deserialize)]
struct CfFileIndex {
    #[serde(rename = "gameVersion")]
    game_version: String,
    #[serde(rename = "modLoader")]
    mod_loader: Option<u32>,
}

#[derive(Deserialize)]
struct CfModLinks {
    #[serde(rename = "sourceUrl")]
    source_url: Option<String>,
    #[serde(rename = "issuesUrl")]
    issues_url: Option<String>,
}

#[derive(Deserialize)]
struct CfFile {
    id: u32,
    #[serde(rename = "displayName")]
    display_name: String,
    #[serde(rename = "fileName")]
    file_name: String,
    #[serde(rename = "fileLength")]
    file_length: u64,
    #[serde(rename = "downloadUrl")]
    download_url: Option<String>,
    #[serde(rename = "gameVersions")]
    game_versions: Vec<String>,
    hashes: Vec<CfFileHash>,
    dependencies: Option<Vec<CfDependency>>,
    #[serde(rename = "fileDate")]
    file_date: String,
}

#[derive(Deserialize)]
struct CfFileHash {
    value: String,
    algo: u32, // 1 = sha1, 2 = md5
}

#[derive(Deserialize)]
struct CfDependency {
    #[serde(rename = "modId")]
    mod_id: u32,
    #[serde(rename = "relationType")]
    relation_type: u32,
}

impl CurseForgeClient {
    pub fn new(api_key: String) -> Self {
        let client = reqwest::Client::builder()
            .user_agent("MineSync/1.0.0")
            .build()
            .unwrap_or_default();

        Self { client, api_key }
    }

    pub async fn search_mods(&self, filters: &SearchFilters) -> AppResult<SearchResponse> {
        let sort_field = match filters.sort {
            SearchSort::Relevance => 1,
            SearchSort::Downloads => 6,
            SearchSort::Updated => 3,
            SearchSort::Newest => 3,
        };
        let sort_order = match filters.sort {
            SearchSort::Newest => "asc",
            _ => "desc",
        };

        let mut params: Vec<(&str, String)> = vec![
            ("gameId", MINECRAFT_GAME_ID.to_string()),
            ("classId", CLASS_ID_MODS.to_string()),
            ("searchFilter", filters.query.clone()),
            ("sortField", sort_field.to_string()),
            ("sortOrder", sort_order.to_string()),
            ("index", filters.offset.to_string()),
            ("pageSize", filters.limit.min(50).to_string()),
        ];

        if let Some(ref gv) = filters.game_version {
            params.push(("gameVersion", gv.clone()));
        }
        if let Some(ref loader) = filters.loader {
            if let Some(loader_type) = loader_to_cf_type(loader) {
                params.push(("modLoaderType", loader_type.to_string()));
            }
        }

        let response = self
            .client
            .get(format!("{BASE_URL}/v1/mods/search"))
            .header("x-api-key", &self.api_key)
            .query(&params)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(AppError::Custom(format!(
                "CurseForge search failed: HTTP {}",
                response.status()
            )));
        }

        let cf_response: CfSearchResponse = response.json().await?;

        let hits = cf_response
            .data
            .into_iter()
            .map(cf_mod_to_search_result)
            .collect();

        Ok(SearchResponse {
            hits,
            total_hits: cf_response.pagination.total_count,
            offset: cf_response.pagination.index,
            limit: cf_response.pagination.page_size,
        })
    }

    pub async fn get_mod(&self, project_id: &str) -> AppResult<ModDetails> {
        let response = self
            .client
            .get(format!("{BASE_URL}/v1/mods/{project_id}"))
            .header("x-api-key", &self.api_key)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(AppError::Custom(format!(
                "CurseForge get_mod failed for {project_id}: HTTP {}",
                response.status()
            )));
        }

        let cf_response: CfModResponse = response.json().await?;
        Ok(cf_mod_to_details(cf_response.data))
    }

    pub async fn get_versions(
        &self,
        project_id: &str,
        game_version: Option<&str>,
        loader: Option<&str>,
    ) -> AppResult<Vec<ModVersionInfo>> {
        let mut params: Vec<(&str, String)> = Vec::new();

        if let Some(gv) = game_version {
            params.push(("gameVersion", gv.to_string()));
        }
        if let Some(l) = loader {
            if let Some(loader_type) = loader_to_cf_type(l) {
                params.push(("modLoaderType", loader_type.to_string()));
            }
        }

        let response = self
            .client
            .get(format!("{BASE_URL}/v1/mods/{project_id}/files"))
            .header("x-api-key", &self.api_key)
            .query(&params)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(AppError::Custom(format!(
                "CurseForge get_versions failed for {project_id}: HTTP {}",
                response.status()
            )));
        }

        let cf_response: CfFilesResponse = response.json().await?;

        let versions = cf_response
            .data
            .into_iter()
            .map(|f| cf_file_to_version(f, project_id))
            .collect();

        Ok(versions)
    }
}

// --- Converters ---

fn cf_mod_to_search_result(m: CfMod) -> ModSearchResult {
    let author = m
        .authors
        .first()
        .map(|a| a.name.clone())
        .unwrap_or_default();

    let icon_url = m.logo.and_then(|l| l.thumbnail_url);

    let (game_versions, loaders) = extract_versions_and_loaders(&m.latest_files_indexes);

    ModSearchResult {
        id: m.id.to_string(),
        slug: m.slug,
        name: m.name,
        description: m.summary,
        author,
        downloads: m.download_count,
        icon_url,
        source: ModSource::CurseForge,
        game_versions,
        loaders,
        date_updated: m.date_modified,
        date_created: m.date_created,
    }
}

fn cf_mod_to_details(m: CfMod) -> ModDetails {
    let author = m
        .authors
        .first()
        .map(|a| a.name.clone())
        .unwrap_or_default();

    let icon_url = m.logo.and_then(|l| l.thumbnail_url);
    let categories = m.categories.iter().map(|c| c.name.clone()).collect();
    let (game_versions, loaders) = extract_versions_and_loaders(&m.latest_files_indexes);

    let (source_url, issues_url) = m
        .links
        .map(|l| (l.source_url, l.issues_url))
        .unwrap_or((None, None));

    ModDetails {
        id: m.id.to_string(),
        slug: m.slug,
        name: m.name,
        description: m.summary,
        body: String::new(), // CurseForge doesn't return body in the mod endpoint
        author,
        downloads: m.download_count,
        icon_url,
        source: ModSource::CurseForge,
        categories,
        game_versions,
        loaders,
        date_updated: m.date_modified,
        date_created: m.date_created,
        source_url,
        issues_url,
    }
}

fn cf_file_to_version(f: CfFile, project_id: &str) -> ModVersionInfo {
    let mut hashes = HashMap::new();
    for h in &f.hashes {
        let algo = match h.algo {
            1 => "sha1",
            2 => "md5",
            _ => continue,
        };
        hashes.insert(algo.to_string(), h.value.clone());
    }

    let download_url = f
        .download_url
        .unwrap_or_else(|| build_cf_download_url(f.id, &f.file_name));

    let file = ModVersionFile {
        url: download_url,
        filename: f.file_name,
        size: f.file_length,
        hashes,
        primary: true,
    };

    let loaders = extract_loaders_from_game_versions(&f.game_versions);

    // Filter game_versions to only actual MC versions (not loader names)
    let game_versions: Vec<String> = f
        .game_versions
        .into_iter()
        .filter(|v| looks_like_mc_version(v))
        .collect();

    let dependencies = f
        .dependencies
        .unwrap_or_default()
        .into_iter()
        .filter_map(|d| {
            let dependency_type = match d.relation_type {
                3 => DependencyType::Required,
                2 => DependencyType::Optional,
                5 => DependencyType::Incompatible,
                4 => DependencyType::Embedded,
                _ => return None,
            };
            Some(ModDependency {
                project_id: d.mod_id.to_string(),
                dependency_type,
            })
        })
        .collect();

    ModVersionInfo {
        id: f.id.to_string(),
        project_id: project_id.to_string(),
        name: f.display_name,
        version_number: String::new(), // CurseForge doesn't have a separate version_number
        game_versions,
        loaders,
        files: vec![file],
        dependencies,
        date_published: f.file_date,
        source: ModSource::CurseForge,
    }
}

fn extract_versions_and_loaders(indexes: &Option<Vec<CfFileIndex>>) -> (Vec<String>, Vec<String>) {
    let indexes = match indexes {
        Some(idx) => idx,
        None => return (Vec::new(), Vec::new()),
    };

    let mut versions = Vec::new();
    let mut loaders = Vec::new();

    for idx in indexes {
        if !versions.contains(&idx.game_version) {
            versions.push(idx.game_version.clone());
        }
        if let Some(loader_type) = idx.mod_loader {
            let loader_name = cf_type_to_loader(loader_type);
            if !loader_name.is_empty() && !loaders.contains(&loader_name) {
                loaders.push(loader_name);
            }
        }
    }

    (versions, loaders)
}

fn extract_loaders_from_game_versions(versions: &[String]) -> Vec<String> {
    let known_loaders = ["forge", "fabric", "neoforge", "quilt"];
    versions
        .iter()
        .filter(|v| known_loaders.contains(&v.to_lowercase().as_str()))
        .map(|v| v.to_lowercase())
        .collect()
}

fn looks_like_mc_version(v: &str) -> bool {
    // MC versions start with a digit (1.20.1, 24w01a, etc.)
    v.chars().next().is_some_and(|c| c.is_ascii_digit())
}

fn loader_to_cf_type(loader: &str) -> Option<u32> {
    match loader.to_lowercase().as_str() {
        "forge" => Some(1),
        "fabric" => Some(4),
        "neoforge" => Some(6),
        "quilt" => Some(5),
        _ => None,
    }
}

fn cf_type_to_loader(t: u32) -> String {
    match t {
        1 => "forge".to_string(),
        4 => "fabric".to_string(),
        5 => "quilt".to_string(),
        6 => "neoforge".to_string(),
        _ => String::new(),
    }
}

/// Build the download URL when CurseForge returns null
fn build_cf_download_url(file_id: u32, file_name: &str) -> String {
    let segment1 = file_id / 1000;
    let segment2 = file_id % 1000;
    format!("{CDN_BASE}/{segment1}/{segment2}/{file_name}")
}
