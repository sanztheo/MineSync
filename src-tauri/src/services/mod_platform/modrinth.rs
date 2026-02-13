use std::collections::HashMap;

use serde::Deserialize;

use crate::errors::{AppError, AppResult};
use crate::models::mod_info::ModSource;
use crate::models::mod_platform::{
    DependencyType, ModDependency, ModDetails, ModSearchResult, ModVersionFile, ModVersionInfo,
    SearchFilters, SearchResponse, SearchSort,
};

const BASE_URL: &str = "https://api.modrinth.com/v2";
const USER_AGENT: &str = "MineSync/1.0.0 (contact@minesync.dev)";

pub struct ModrinthClient {
    client: reqwest::Client,
}

// --- Modrinth API response types ---

#[derive(Deserialize)]
struct MrSearchResponse {
    hits: Vec<MrSearchHit>,
    total_hits: u32,
    offset: u32,
    limit: u32,
}

#[derive(Deserialize)]
struct MrSearchHit {
    project_id: String,
    slug: String,
    title: String,
    description: String,
    author: String,
    downloads: u64,
    icon_url: Option<String>,
    categories: Vec<String>,
    versions: Vec<String>,
    date_modified: String,
    date_created: String,
}

#[derive(Deserialize)]
struct MrProject {
    id: String,
    slug: String,
    title: String,
    description: String,
    body: String,
    downloads: u64,
    icon_url: Option<String>,
    categories: Vec<String>,
    game_versions: Vec<String>,
    loaders: Vec<String>,
    updated: String,
    published: String,
    source_url: Option<String>,
    issues_url: Option<String>,
    team: String,
}

#[derive(Deserialize)]
struct MrVersion {
    id: String,
    project_id: String,
    name: String,
    version_number: String,
    game_versions: Vec<String>,
    loaders: Vec<String>,
    files: Vec<MrFile>,
    dependencies: Vec<MrDependency>,
    date_published: String,
}

#[derive(Deserialize)]
struct MrFile {
    url: String,
    filename: String,
    size: u64,
    hashes: MrHashes,
    primary: bool,
}

#[derive(Deserialize)]
struct MrHashes {
    sha1: Option<String>,
    sha512: Option<String>,
}

#[derive(Deserialize)]
struct MrDependency {
    project_id: Option<String>,
    dependency_type: String,
}

#[derive(Deserialize)]
struct MrTeamMember {
    user: MrUser,
    role: String,
}

#[derive(Deserialize)]
struct MrUser {
    username: String,
}

impl ModrinthClient {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .user_agent(USER_AGENT)
            .build()
            .unwrap_or_default();

        Self { client }
    }

    pub async fn search_mods(&self, filters: &SearchFilters) -> AppResult<SearchResponse> {
        let index = match filters.sort {
            SearchSort::Relevance => "relevance",
            SearchSort::Downloads => "downloads",
            SearchSort::Updated => "updated",
            SearchSort::Newest => "newest",
        };

        let facets = build_facets(
            filters.game_version.as_deref(),
            filters.loader.as_deref(),
            filters.category.as_deref(),
        );

        let mut params: Vec<(&str, String)> = vec![
            ("query", filters.query.clone()),
            ("index", index.to_string()),
            ("offset", filters.offset.to_string()),
            ("limit", filters.limit.min(100).to_string()),
        ];

        if !facets.is_empty() {
            params.push(("facets", facets));
        }

        let response = self
            .client
            .get(format!("{BASE_URL}/search"))
            .query(&params)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(AppError::Custom(format!(
                "Modrinth search failed: HTTP {}",
                response.status()
            )));
        }

        let mr_response: MrSearchResponse = response.json().await?;

        let hits = mr_response
            .hits
            .into_iter()
            .map(mr_hit_to_search_result)
            .collect();

        Ok(SearchResponse {
            hits,
            total_hits: mr_response.total_hits,
            offset: mr_response.offset,
            limit: mr_response.limit,
        })
    }

    pub async fn get_mod(&self, project_id: &str) -> AppResult<ModDetails> {
        let response = self
            .client
            .get(format!("{BASE_URL}/project/{project_id}"))
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(AppError::Custom(format!(
                "Modrinth get_mod failed for {project_id}: HTTP {}",
                response.status()
            )));
        }

        let project: MrProject = response.json().await?;

        // Fetch team members to get the author name
        let author = self.fetch_author(&project.team).await.unwrap_or_default();

        Ok(mr_project_to_details(project, author))
    }

    pub async fn get_versions(
        &self,
        project_id: &str,
        game_version: Option<&str>,
        loader: Option<&str>,
    ) -> AppResult<Vec<ModVersionInfo>> {
        let mut params: Vec<(&str, String)> = Vec::new();

        if let Some(gv) = game_version {
            params.push(("game_versions", format!("[\"{gv}\"]")));
        }
        if let Some(l) = loader {
            params.push(("loaders", format!("[\"{l}\"]")));
        }

        let response = self
            .client
            .get(format!("{BASE_URL}/project/{project_id}/version"))
            .query(&params)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(AppError::Custom(format!(
                "Modrinth get_versions failed for {project_id}: HTTP {}",
                response.status()
            )));
        }

        let versions: Vec<MrVersion> = response.json().await?;

        let result = versions.into_iter().map(mr_version_to_info).collect();

        Ok(result)
    }

    async fn fetch_author(&self, team_id: &str) -> AppResult<String> {
        let response = self
            .client
            .get(format!("{BASE_URL}/team/{team_id}/members"))
            .send()
            .await?;

        if !response.status().is_success() {
            return Ok(String::new());
        }

        let members: Vec<MrTeamMember> = response.json().await?;

        // The owner is the primary author
        let author = members
            .iter()
            .find(|m| m.role == "Owner")
            .or_else(|| members.first())
            .map(|m| m.user.username.clone())
            .unwrap_or_default();

        Ok(author)
    }
}

// --- Converters ---

fn mr_hit_to_search_result(hit: MrSearchHit) -> ModSearchResult {
    let loaders = extract_loaders_from_categories(&hit.categories);

    ModSearchResult {
        id: hit.project_id,
        slug: hit.slug,
        name: hit.title,
        description: hit.description,
        author: hit.author,
        downloads: hit.downloads,
        icon_url: hit.icon_url,
        source: ModSource::Modrinth,
        game_versions: hit.versions,
        loaders,
        date_updated: hit.date_modified,
        date_created: hit.date_created,
    }
}

fn mr_project_to_details(p: MrProject, author: String) -> ModDetails {
    ModDetails {
        id: p.id,
        slug: p.slug,
        name: p.title,
        description: p.description,
        body: p.body,
        author,
        downloads: p.downloads,
        icon_url: p.icon_url,
        source: ModSource::Modrinth,
        categories: p.categories,
        game_versions: p.game_versions,
        loaders: p.loaders,
        date_updated: p.updated,
        date_created: p.published,
        source_url: p.source_url,
        issues_url: p.issues_url,
    }
}

fn mr_version_to_info(v: MrVersion) -> ModVersionInfo {
    let files = v
        .files
        .into_iter()
        .map(|f| {
            let mut hashes = HashMap::new();
            if let Some(sha1) = f.hashes.sha1 {
                hashes.insert("sha1".to_string(), sha1);
            }
            if let Some(sha512) = f.hashes.sha512 {
                hashes.insert("sha512".to_string(), sha512);
            }

            ModVersionFile {
                url: f.url,
                filename: f.filename,
                size: f.size,
                hashes,
                primary: f.primary,
            }
        })
        .collect();

    let dependencies = v
        .dependencies
        .into_iter()
        .filter_map(|d| {
            let project_id = d.project_id?;
            let dependency_type = match d.dependency_type.as_str() {
                "required" => DependencyType::Required,
                "optional" => DependencyType::Optional,
                "incompatible" => DependencyType::Incompatible,
                "embedded" => DependencyType::Embedded,
                _ => return None,
            };
            Some(ModDependency {
                project_id,
                dependency_type,
            })
        })
        .collect();

    ModVersionInfo {
        id: v.id,
        project_id: v.project_id,
        name: v.name,
        version_number: v.version_number,
        game_versions: v.game_versions,
        loaders: v.loaders,
        files,
        dependencies,
        date_published: v.date_published,
        source: ModSource::Modrinth,
    }
}

// --- Helpers ---

/// Build Modrinth facets filter string
///
/// Facets use AND between groups, OR within groups:
/// `[["project_type:mod"],["versions:1.20.1"],["categories:fabric"]]`
fn build_facets(
    game_version: Option<&str>,
    loader: Option<&str>,
    category: Option<&str>,
) -> String {
    let mut groups: Vec<String> = vec!["[\"project_type:mod\"]".to_string()];

    if let Some(gv) = game_version {
        groups.push(format!("[\"versions:{gv}\"]"));
    }
    if let Some(l) = loader {
        groups.push(format!("[\"categories:{l}\"]"));
    }
    if let Some(cat) = category {
        groups.push(format!("[\"categories:{cat}\"]"));
    }

    format!("[{}]", groups.join(","))
}

fn extract_loaders_from_categories(categories: &[String]) -> Vec<String> {
    let known_loaders = ["forge", "fabric", "neoforge", "quilt"];
    categories
        .iter()
        .filter(|c| known_loaders.contains(&c.to_lowercase().as_str()))
        .map(|c| c.to_lowercase())
        .collect()
}
