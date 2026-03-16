// src-tauri/src/skills.rs - Skills search and installation functionality
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// GitHub API 响应结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubSearchResponse {
    pub total_count: u32,
    pub incomplete_results: bool,
    pub items: Vec<GitHubSearchItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubSearchItem {
    pub name: String,
    pub path: String,
    pub sha: String,
    pub url: String,
    pub html_url: String,
    pub repository: GitHubRepository,
    pub score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubRepository {
    pub id: u64,
    pub name: String,
    pub full_name: String,
    pub owner: GitHubOwner,
    pub description: Option<String>,
    pub html_url: String,
    pub stargazers_count: u32,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubOwner {
    pub login: String,
    pub id: u64,
    pub avatar_url: String,
}

/// Skills 市场项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillItem {
    pub name: String,
    pub description: String,
    pub author: Option<String>,
    pub repository: Option<String>,
    #[serde(rename = "repoUrl")]
    pub repo_url: Option<String>,
    pub path: Option<String>,
    pub installed: bool,
    pub stars: Option<u32>,
    pub updated_at: Option<String>,
}

/// Skills 搜索响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillSearchResponse {
    pub success: bool,
    pub error: Option<String>,
    pub items: Option<Vec<SkillItem>>,
}

/// Skills 安装响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillInstallResponse {
    pub success: bool,
    pub error: Option<String>,
    pub message: Option<String>,
    pub skill_path: Option<String>,
}

/// GitHub 文件内容响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubFileContent {
    pub name: String,
    pub path: String,
    pub sha: String,
    pub content: Option<String>,
    pub encoding: Option<String>,
    pub download_url: Option<String>,
}

/// 从 GitHub API 搜索 Skills
pub async fn search_skills_from_github(query: &str) -> Result<Vec<SkillItem>, String> {
    // 构建 GitHub API 搜索 URL
    // 搜索包含 SKILL.md 文件的仓库
    let search_url = format!(
        "https://api.github.com/search/code?q={}+filename:SKILL.md+in:path",
        urlencoding::encode(query)
    );

    let client = reqwest::Client::builder()
        .user_agent("FlowHub-Skills-Search/1.0")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client
        .get(&search_url)
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| format!("GitHub API request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("GitHub API error: {} - {}", status, body));
    }

    let search_result: GitHubSearchResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse GitHub response: {}", e))?;

    // 转换为 SkillItem
    let skills: Vec<SkillItem> = search_result
        .items
        .into_iter()
        .filter_map(|item| {
            // 从路径中提取 skill 名称
            let skill_name = item.path.split('/').next().unwrap_or(&item.name).to_string();
            
            Some(SkillItem {
                name: skill_name,
                description: item.repository.description.clone().unwrap_or_default(),
                author: Some(item.repository.owner.login),
                repository: Some(item.repository.html_url.clone()),
                repo_url: Some(item.repository.html_url),
                path: Some(item.path),
                installed: false,
                stars: Some(item.repository.stargazers_count),
                updated_at: Some(item.repository.updated_at),
            })
        })
        .collect();

    Ok(skills)
}

/// 获取本地已安装的 Skills
pub fn get_installed_skills(workspace_path: &str) -> Result<Vec<SkillItem>, String> {
    let skills_dir = PathBuf::from(workspace_path)
        .join(".iflow")
        .join("skills");

    if !skills_dir.exists() {
        return Ok(Vec::new());
    }

    let mut skills = Vec::new();

    if let Ok(entries) = std::fs::read_dir(&skills_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let skill_md = path.join("SKILL.md");
                if skill_md.exists() {
                    if let Ok(content) = std::fs::read_to_string(&skill_md) {
                        // 解析 SKILL.md 文件
                        let name = extract_frontmatter(&content, "name")
                            .unwrap_or_else(|| path.file_name().unwrap().to_string_lossy().to_string());
                        let description = extract_frontmatter(&content, "description")
                            .unwrap_or_default();

                        skills.push(SkillItem {
                            name,
                            description,
                            author: None,
                            repository: None,
                            repo_url: None,
                            path: Some(skill_md.to_string_lossy().to_string()),
                            installed: true,
                            stars: None,
                            updated_at: None,
                        });
                    }
                }
            }
        }
    }

    Ok(skills)
}

/// 卸载已安装的 Skill
pub fn uninstall_skill(workspace_path: &str, skill_name: &str) -> Result<(), String> {
    let skill_dir = PathBuf::from(workspace_path)
        .join(".iflow")
        .join("skills")
        .join(skill_name);

    if !skill_dir.exists() {
        return Err(format!("Skill '{}' not found", skill_name));
    }

    // 删除整个 skill 目录
    std::fs::remove_dir_all(&skill_dir)
        .map_err(|e| format!("Failed to remove skill directory: {}", e))?;

    Ok(())
}

/// 从 SKILL.md 内容中提取 frontmatter 字段
fn extract_frontmatter(content: &str, field: &str) -> Option<String> {
    let in_frontmatter = content.starts_with("---");
    if !in_frontmatter {
        return None;
    }

    let lines: Vec<&str> = content.lines().collect();
    let mut found_first = false;
    
    for line in &lines {
        if line.trim() == "---" {
            if found_first {
                break;
            }
            found_first = true;
            continue;
        }
        
        if found_first {
            if line.starts_with(&format!("{}:", field)) {
                let value = line[field.len() + 1..].trim();
                return Some(value.to_string());
            }
        }
    }

    None
}

/// 从本地文件安装 Skill
pub fn install_skill_from_local(
    workspace_path: &str,
    skill_name: &str,
    content: &str,
) -> Result<String, String> {
    // 创建目标目录
    let target_dir = PathBuf::from(workspace_path)
        .join(".iflow")
        .join("skills")
        .join(skill_name);

    std::fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Failed to create skill directory: {}", e))?;

    // 保存 SKILL.md 文件
    let skill_md_path = target_dir.join("SKILL.md");
    std::fs::write(&skill_md_path, content)
        .map_err(|e| format!("Failed to write skill file: {}", e))?;

    Ok(skill_md_path.to_string_lossy().to_string())
}

/// 从 GitHub 下载并安装 Skill（支持多个镜像源）
pub async fn install_skill_from_github(
    workspace_path: &str,
    repo_url: &str,
    skill_path: &str,
    skill_name: &str,
) -> Result<String, String> {
    // 创建目标目录
    let target_dir = PathBuf::from(workspace_path)
        .join(".iflow")
        .join("skills")
        .join(skill_name);

    std::fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Failed to create skill directory: {}", e))?;

    // 获取多个镜像 URL
    let raw_urls = get_raw_urls_with_mirrors(repo_url, skill_path);

    let client = reqwest::Client::builder()
        .user_agent("FlowHub-Skills-Install/1.0")
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let mut last_error = String::new();
    
    // 尝试多个镜像源
    for raw_url in raw_urls {
        match client.get(&raw_url).send().await {
            Ok(response) => {
                if response.status().is_success() {
                    match response.text().await {
                        Ok(content) => {
                            // 保存 SKILL.md 文件
                            let skill_md_path = target_dir.join("SKILL.md");
                            std::fs::write(&skill_md_path, &content)
                                .map_err(|e| format!("Failed to write skill file: {}", e))?;
                            return Ok(skill_md_path.to_string_lossy().to_string());
                        }
                        Err(e) => {
                            last_error = format!("Failed to read content: {}", e);
                        }
                    }
                } else {
                    last_error = format!("HTTP {}", response.status());
                }
            }
            Err(e) => {
                last_error = format!("{}", e);
            }
        }
    }

    Err(format!("Failed to download from all mirrors: {}", last_error))
}

/// 获取多个镜像 URL（支持 GitHub 镜像站点）
fn get_raw_urls_with_mirrors(repo_url: &str, skill_path: &str) -> Vec<String> {
    let repo_url = repo_url.trim_end_matches('/');
    let mut urls = Vec::new();
    
    if repo_url.contains("github.com") {
        let parts: Vec<&str> = repo_url.split("github.com/").collect();
        if parts.len() > 1 {
            let repo_path = parts[1];
            
            // 原始 GitHub raw URL
            urls.push(format!(
                "https://raw.githubusercontent.com/{}/main/{}",
                repo_path, skill_path
            ));
            
            // FastGit 镜像
            urls.push(format!(
                "https://raw.fastgit.org/{}/main/{}",
                repo_path, skill_path
            ));
            
            // GitClone 镜像
            urls.push(format!(
                "https://gitclone.com/github.com/{}/raw/main/{}",
                repo_path, skill_path
            ));
            
            // jsDelivr CDN
            urls.push(format!(
                "https://cdn.jsdelivr.net/gh/{}/{}",
                repo_path, skill_path
            ));
        }
    } else {
        urls.push(format!("{}/{}", repo_url, skill_path));
    }
    
    urls
}

/// 将 GitHub URL 转换为 raw 内容 URL
fn convert_to_raw_url(repo_url: &str, skill_path: &str) -> String {
    let urls = get_raw_urls_with_mirrors(repo_url, skill_path);
    urls.first().cloned().unwrap_or_default()
}

/// 列出热门 Skills（从预定义列表）
pub fn get_popular_skills() -> Vec<SkillItem> {
    vec![
        SkillItem {
            name: "workspace-guide".to_string(),
            description: "Workspace guide to introduce iFlow and onboard new users.".to_string(),
            author: Some("iFlow".to_string()),
            repository: Some("https://github.com/iflow-ai/skills".to_string()),
            repo_url: Some("https://github.com/iflow-ai/skills".to_string()),
            path: Some("workspace-guide/SKILL.md".to_string()),
            installed: false,
            stars: Some(100),
            updated_at: None,
        },
        SkillItem {
            name: "code-reviewer".to_string(),
            description: "Comprehensive code review skill for multiple programming languages.".to_string(),
            author: Some("iFlow".to_string()),
            repository: Some("https://github.com/iflow-ai/skills".to_string()),
            repo_url: Some("https://github.com/iflow-ai/skills".to_string()),
            path: Some("code-reviewer/SKILL.md".to_string()),
            installed: false,
            stars: Some(80),
            updated_at: None,
        },
        SkillItem {
            name: "git-expert".to_string(),
            description: "Git workflow and best practices expert skill.".to_string(),
            author: Some("iFlow".to_string()),
            repository: Some("https://github.com/iflow-ai/skills".to_string()),
            repo_url: Some("https://github.com/iflow-ai/skills".to_string()),
            path: Some("git-expert/SKILL.md".to_string()),
            installed: false,
            stars: Some(75),
            updated_at: None,
        },
        SkillItem {
            name: "api-designer".to_string(),
            description: "REST API design and documentation skill.".to_string(),
            author: Some("iFlow".to_string()),
            repository: Some("https://github.com/iflow-ai/skills".to_string()),
            repo_url: Some("https://github.com/iflow-ai/skills".to_string()),
            path: Some("api-designer/SKILL.md".to_string()),
            installed: false,
            stars: Some(60),
            updated_at: None,
        },
        SkillItem {
            name: "test-writer".to_string(),
            description: "Unit test and integration test generation skill.".to_string(),
            author: Some("iFlow".to_string()),
            repository: Some("https://github.com/iflow-ai/skills".to_string()),
            repo_url: Some("https://github.com/iflow-ai/skills".to_string()),
            path: Some("test-writer/SKILL.md".to_string()),
            installed: false,
            stars: Some(55),
            updated_at: None,
        },
        SkillItem {
            name: "docker-expert".to_string(),
            description: "Docker and containerization expert skill.".to_string(),
            author: Some("iFlow".to_string()),
            repository: Some("https://github.com/iflow-ai/skills".to_string()),
            repo_url: Some("https://github.com/iflow-ai/skills".to_string()),
            path: Some("docker-expert/SKILL.md".to_string()),
            installed: false,
            stars: Some(50),
            updated_at: None,
        },
        SkillItem {
            name: "sql-optimizer".to_string(),
            description: "SQL query optimization and database design skill.".to_string(),
            author: Some("iFlow".to_string()),
            repository: Some("https://github.com/iflow-ai/skills".to_string()),
            repo_url: Some("https://github.com/iflow-ai/skills".to_string()),
            path: Some("sql-optimizer/SKILL.md".to_string()),
            installed: false,
            stars: Some(45),
            updated_at: None,
        },
        SkillItem {
            name: "security-auditor".to_string(),
            description: "Security audit and vulnerability detection skill.".to_string(),
            author: Some("iFlow".to_string()),
            repository: Some("https://github.com/iflow-ai/skills".to_string()),
            repo_url: Some("https://github.com/iflow-ai/skills".to_string()),
            path: Some("security-auditor/SKILL.md".to_string()),
            installed: false,
            stars: Some(40),
            updated_at: None,
        },
    ]
}
