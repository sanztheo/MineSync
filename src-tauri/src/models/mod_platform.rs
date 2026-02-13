use serde::{Deserialize, Serialize};

use super::mod_info::ModSource;

// --- Search ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchFilters {
    pub query: String,
    pub game_version: Option<String>,
    pub loader: Option<String>,
    pub category: Option<String>,
    pub sort: SearchSort,
    pub offset: u32,
    pub limit: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SearchSort {
    Relevance,
    Downloads,
    Updated,
    Newest,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResponse {
    pub hits: Vec<ModSearchResult>,
    pub total_hits: u32,
    pub offset: u32,
    pub limit: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModSearchResult {
    pub id: String,
    pub slug: String,
    pub name: String,
    pub description: String,
    pub author: String,
    pub downloads: u64,
    pub icon_url: Option<String>,
    pub source: ModSource,
    pub game_versions: Vec<String>,
    pub loaders: Vec<String>,
    pub date_updated: String,
    pub date_created: String,
}

// --- Mod Details ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModDetails {
    pub id: String,
    pub slug: String,
    pub name: String,
    pub description: String,
    pub body: String,
    pub author: String,
    pub downloads: u64,
    pub icon_url: Option<String>,
    pub source: ModSource,
    pub categories: Vec<String>,
    pub game_versions: Vec<String>,
    pub loaders: Vec<String>,
    pub date_updated: String,
    pub date_created: String,
    pub source_url: Option<String>,
    pub issues_url: Option<String>,
}

// --- Versions ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModVersionInfo {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub version_number: String,
    pub game_versions: Vec<String>,
    pub loaders: Vec<String>,
    pub files: Vec<ModVersionFile>,
    pub dependencies: Vec<ModDependency>,
    pub date_published: String,
    pub source: ModSource,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModVersionFile {
    pub url: String,
    pub filename: String,
    pub size: u64,
    pub hashes: std::collections::HashMap<String, String>,
    pub primary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModDependency {
    pub project_id: String,
    pub dependency_type: DependencyType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DependencyType {
    Required,
    Optional,
    Incompatible,
    Embedded,
}
