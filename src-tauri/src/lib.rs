#[cfg(not(target_os = "android"))]
use tauri_plugin_shell::{process::CommandEvent, ShellExt};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{BTreeSet, HashMap};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
#[cfg(target_os = "android")]
use jni::objects::{JObject, JValue};
#[cfg(target_os = "android")]
use jni::JavaVM;
#[cfg(not(target_os = "android"))]
use std::net::TcpListener;
#[cfg(not(target_os = "android"))]
use std::sync::OnceLock;
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Manager};
#[cfg(not(target_os = "android"))]
use tauri::Emitter;
#[cfg(not(target_os = "android"))]
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

fn resolve_project_root() -> PathBuf {
    std::env::current_dir()
        .map(|mut p| {
            if p.ends_with("src-tauri") {
                p.pop();
            }
            p
        })
        .unwrap_or_else(|_| PathBuf::from("."))
}

fn resolve_default_kb_path() -> String {
    let mut root = resolve_project_root();
    root.push("Knowledge_Base");
    root.to_string_lossy().to_string()
}

fn ensure_directory(path: &Path) {
    if let Err(err) = fs::create_dir_all(path) {
        eprintln!("[Rust] Failed to create directory '{}': {}", path.to_string_lossy(), err);
    }
}

fn normalize_display_path(path: PathBuf) -> PathBuf {
    #[cfg(windows)]
    {
        let text = path.to_string_lossy();
        if let Some(stripped) = text.strip_prefix(r"\\?\") {
            return PathBuf::from(stripped);
        }
    }

    path
}

fn app_config_path() -> PathBuf {
    if let Ok(custom_file) = std::env::var("NOTE_CONNECTION_CONFIG_PATH") {
        let path = PathBuf::from(custom_file);
        if let Some(parent) = path.parent() {
            ensure_directory(parent);
        }
        return path;
    }

    if let Ok(custom_dir) = std::env::var("NOTE_CONNECTION_CONFIG_DIR") {
        let mut base = PathBuf::from(custom_dir);
        ensure_directory(&base);
        base.push("kb_config.json");
        return base;
    }

    let mut base = dirs::data_local_dir().unwrap_or_else(resolve_project_root);
    base.push("NoteConnection");
    ensure_directory(&base);
    base.push("kb_config.json");
    base
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct StoredConfig {
    #[serde(rename = "knowledgeBasePath")]
    knowledge_base_path: Option<String>,
    #[serde(rename = "userLanguage")]
    user_language: Option<String>,
}

fn load_stored_config() -> StoredConfig {
    let config_path = app_config_path();
    if !config_path.exists() {
        return StoredConfig::default();
    }

    match fs::read_to_string(&config_path) {
        Ok(content) => serde_json::from_str::<StoredConfig>(&content).unwrap_or_else(|err| {
            eprintln!(
                "[Rust] Failed to parse config '{}': {}",
                config_path.to_string_lossy(),
                err
            );
            StoredConfig::default()
        }),
        Err(err) => {
            eprintln!(
                "[Rust] Failed to read config '{}': {}",
                config_path.to_string_lossy(),
                err
            );
            StoredConfig::default()
        }
    }
}

fn save_stored_config(config: &StoredConfig) -> Result<(), String> {
    let config_path = app_config_path();
    if let Some(parent) = config_path.parent() {
        ensure_directory(parent);
    }

    let content = serde_json::to_string_pretty(config).map_err(|err| err.to_string())?;
    fs::write(&config_path, content).map_err(|err| err.to_string())
}

#[cfg(not(target_os = "android"))]
fn file_has_content(path: &Path) -> bool {
    fs::metadata(path)
        .map(|meta| meta.is_file() && meta.len() > 0)
        .unwrap_or(false)
}

#[cfg(not(target_os = "android"))]
const GODOT_MIN_BINARY_BYTES: u64 = 1 * 1024 * 1024;

#[cfg(not(target_os = "android"))]
fn is_valid_godot_binary(path: &Path) -> bool {
    fs::metadata(path)
        .map(|meta| meta.is_file() && meta.len() >= GODOT_MIN_BINARY_BYTES)
        .unwrap_or(false)
}

fn normalize_kb_root_path(raw_path: &str) -> Option<PathBuf> {
    let raw = PathBuf::from(raw_path);
    if !raw.exists() || !raw.is_dir() {
        return None;
    }

    let resolved = normalize_display_path(fs::canonicalize(&raw).unwrap_or(raw));

    for ancestor in resolved.ancestors() {
        let Some(name) = ancestor.file_name().and_then(|value| value.to_str()) else {
            continue;
        };

        if name.eq_ignore_ascii_case("Knowledge_Base") {
            return Some(ancestor.to_path_buf());
        }
    }

    let nested = resolved.join("Knowledge_Base");
    if nested.exists() && nested.is_dir() {
        return Some(nested);
    }

    Some(resolved)
}

fn normalize_existing_dir(raw_path: &str) -> Option<String> {
    normalize_kb_root_path(raw_path).map(|resolved| resolved.to_string_lossy().to_string())
}

fn ensure_default_kb_root_exists() -> String {
    let default_path = resolve_default_kb_path();
    ensure_directory(Path::new(&default_path));
    default_path
}

fn resolve_kb_path_from_config() -> String {
    let config = load_stored_config();
    if let Some(saved) = config.knowledge_base_path {
        if let Some(valid) = normalize_existing_dir(&saved) {
            if valid != saved {
                if let Err(err) = persist_kb_path(valid.as_str()) {
                    eprintln!("[Rust] Failed to normalize persisted KB path '{}': {}", saved, err);
                }
            }
            return valid;
        }
    }
    ensure_default_kb_root_exists()
}

fn persist_kb_path(kb_path: &str) -> Result<String, String> {
    let Some(normalized_path) = normalize_kb_root_path(kb_path) else {
        return Err(format!("Invalid knowledge base path: {}", kb_path));
    };
    let normalized = normalized_path.to_string_lossy().to_string();

    let mut config = load_stored_config();
    config.knowledge_base_path = Some(normalized.clone());
    if config.user_language.is_none() {
        config.user_language = Some("en".to_string());
    }
    save_stored_config(&config)?;
    Ok(normalized)
}

fn normalize_menu_lang(lang: &str) -> &'static str {
    if lang == "zh" {
        "zh"
    } else {
        "en"
    }
}

fn resolve_user_language_from_config() -> String {
    let config = load_stored_config();
    let lang = config.user_language.unwrap_or_else(|| "en".to_string());
    normalize_menu_lang(&lang).to_string()
}

fn persist_user_language(lang: &str) -> Result<String, String> {
    let normalized = normalize_menu_lang(lang).to_string();
    let mut config = load_stored_config();
    config.user_language = Some(normalized.clone());
    save_stored_config(&config)?;
    Ok(normalized)
}

#[cfg(not(target_os = "android"))]
fn pick_knowledge_base_folder(default_dir: &str, title: &str) -> Option<PathBuf> {
    rfd::FileDialog::new()
        .set_title(title)
        .set_directory(default_dir)
        .pick_folder()
}

#[cfg(target_os = "android")]
fn pick_knowledge_base_folder(_default_dir: &str, _title: &str) -> Option<PathBuf> {
    eprintln!(
        "[Rust] Folder picker is not available on Android. Falling back to configured/default KB path."
    );
    None
}

#[cfg(not(target_os = "android"))]
fn resolve_notemd_initial_directory(initial_path: Option<&str>) -> Option<PathBuf> {
    let raw_path = initial_path?.trim();
    if raw_path.is_empty() {
        return None;
    }

    let candidate = PathBuf::from(raw_path);
    if candidate.exists() && candidate.is_dir() {
        return Some(candidate);
    }
    if candidate.exists() && candidate.is_file() {
        return candidate.parent().map(Path::to_path_buf);
    }

    candidate
        .parent()
        .filter(|parent| parent.exists() && parent.is_dir())
        .map(Path::to_path_buf)
}

#[cfg(not(target_os = "android"))]
fn pick_notemd_file_internal(initial_path: Option<&str>) -> Option<PathBuf> {
    let mut dialog = rfd::FileDialog::new()
        .set_title("Select Markdown File")
        .add_filter("Markdown", &["md", "markdown", "txt"]);

    if let Some(directory) = resolve_notemd_initial_directory(initial_path) {
        dialog = dialog.set_directory(directory);
    }

    dialog.pick_file()
}

#[cfg(not(target_os = "android"))]
fn save_notemd_file_internal(initial_path: Option<&str>) -> Option<PathBuf> {
    let mut dialog = rfd::FileDialog::new()
        .set_title("Select Output Markdown File")
        .add_filter("Markdown", &["md", "markdown", "txt"]);

    if let Some(directory) = resolve_notemd_initial_directory(initial_path) {
        dialog = dialog.set_directory(directory);
    }

    if let Some(raw_path) = initial_path {
        let file_name = PathBuf::from(raw_path)
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("")
            .trim()
            .to_string();
        if !file_name.is_empty() {
            dialog = dialog.set_file_name(file_name);
        }
    }

    dialog.save_file()
}

#[cfg(not(target_os = "android"))]
fn pick_notemd_folder_internal(initial_path: Option<&str>) -> Option<PathBuf> {
    let mut dialog = rfd::FileDialog::new().set_title("Select Folder");

    if let Some(directory) = resolve_notemd_initial_directory(initial_path) {
        dialog = dialog.set_directory(directory);
    }

    dialog.pick_folder()
}

fn ensure_startup_kb_path() -> String {
    let config_path = app_config_path();
    let has_existing_config = config_path.exists();
    let mut config = load_stored_config();

    if let Some(saved) = config.knowledge_base_path.clone() {
        if let Some(valid) = normalize_existing_dir(&saved) {
            if valid != saved {
                config.knowledge_base_path = Some(valid.clone());
                if config.user_language.is_none() {
                    config.user_language = Some("en".to_string());
                }
                if let Err(err) = save_stored_config(&config) {
                    eprintln!("[Rust] Failed to persist normalized startup config: {}", err);
                }
            }
            return valid;
        }
    }

    let default_path = ensure_default_kb_root_exists();

    // First run flow: ask user to select KB folder. If cancelled, fallback to default.
    if !has_existing_config {
        let chosen = pick_knowledge_base_folder(&default_path, "Select Knowledge Base Folder");

        if let Some(folder) = chosen {
            let selected = folder.to_string_lossy().to_string();
            config.knowledge_base_path = Some(selected.clone());
            if config.user_language.is_none() {
                config.user_language = Some("en".to_string());
            }
            if let Err(err) = save_stored_config(&config) {
                eprintln!("[Rust] Failed to persist first-run config: {}", err);
            }
            return selected;
        }
    }

    config.knowledge_base_path = Some(default_path.clone());
    if config.user_language.is_none() {
        config.user_language = Some("en".to_string());
    }
    if let Err(err) = save_stored_config(&config) {
        eprintln!("[Rust] Failed to persist fallback config: {}", err);
    }

    default_path
}

#[cfg(not(target_os = "android"))]
fn resolve_godot_project_path(project_root: &Path) -> PathBuf {
    if let Ok(custom) = std::env::var("NOTE_CONNECTION_GODOT_PROJECT") {
        let candidate = PathBuf::from(custom);
        if candidate.exists() && candidate.is_dir() {
            return candidate;
        }
    }
    project_root.join("path_mode")
}

#[cfg(all(not(target_os = "android"), target_os = "windows", target_arch = "x86_64"))]
fn host_godot_sidecar_name() -> &'static str {
    "godot-x86_64-pc-windows-msvc.exe"
}

#[cfg(all(not(target_os = "android"), target_os = "linux", target_arch = "x86_64"))]
fn host_godot_sidecar_name() -> &'static str {
    "godot-x86_64-unknown-linux-gnu"
}

#[cfg(all(not(target_os = "android"), target_os = "macos", target_arch = "aarch64"))]
fn host_godot_sidecar_name() -> &'static str {
    "godot-aarch64-apple-darwin"
}

#[cfg(all(not(target_os = "android"), target_os = "macos", target_arch = "x86_64"))]
fn host_godot_sidecar_name() -> &'static str {
    "godot-x86_64-apple-darwin"
}

#[cfg(all(
    not(target_os = "android"),
    not(any(
        all(target_os = "windows", target_arch = "x86_64"),
        all(target_os = "linux", target_arch = "x86_64"),
        all(target_os = "macos", target_arch = "aarch64"),
        all(target_os = "macos", target_arch = "x86_64")
    ))
))]
fn host_godot_sidecar_name() -> &'static str {
    "godot"
}

#[cfg(all(not(target_os = "android"), target_os = "windows"))]
fn host_godot_binary_aliases() -> Vec<&'static str> {
    vec!["godot.exe", "godot4.exe"]
}

#[cfg(all(not(target_os = "android"), target_os = "macos"))]
fn host_godot_binary_aliases() -> Vec<&'static str> {
    vec!["godot", "godot4", "Godot"]
}

#[cfg(all(not(target_os = "android"), target_os = "linux"))]
fn host_godot_binary_aliases() -> Vec<&'static str> {
    vec!["godot", "godot4"]
}

#[cfg(all(
    not(target_os = "android"),
    not(any(target_os = "windows", target_os = "macos", target_os = "linux"))
))]
fn host_godot_binary_aliases() -> Vec<&'static str> {
    vec!["godot"]
}

#[cfg(not(target_os = "android"))]
fn resolve_godot_executable(project_root: &Path) -> Option<PathBuf> {
    let exec_dir = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|p| p.to_path_buf()));

    if let Ok(env_path) = std::env::var("NOTE_CONNECTION_GODOT_EXE") {
        let env_candidate = PathBuf::from(env_path);
        if file_has_content(&env_candidate) {
            return Some(env_candidate);
        }
    }

    let mut candidates: Vec<PathBuf> = Vec::new();

    let sidecar_dir = project_root.join("src-tauri").join("bin");
    candidates.push(sidecar_dir.join(host_godot_sidecar_name()));
    for alias in host_godot_binary_aliases() {
        candidates.push(sidecar_dir.join(alias));
    }

    if let Some(dir) = exec_dir {
        candidates.push(dir.join(host_godot_sidecar_name()));
        for alias in host_godot_binary_aliases() {
            candidates.push(dir.join(alias));
            candidates.push(dir.join("bin").join(alias));
        }
        candidates.push(dir.join("bin").join(host_godot_sidecar_name()));
    }

    candidates
        .into_iter()
        .find(|candidate| is_valid_godot_binary(candidate))
}

fn resolve_frontend_dist_path() -> PathBuf {
    if let Ok(custom_dir) = std::env::var("NOTE_CONNECTION_FRONTEND_DIR") {
        let candidate = PathBuf::from(custom_dir);
        if candidate.exists() && candidate.is_dir() {
            return candidate;
        }
    }

    let mut root = resolve_project_root();
    root.push("dist");
    root.push("src");
    root.push("frontend");
    root
}

fn resolve_runtime_data_path() -> PathBuf {
    if let Ok(custom_dir) = std::env::var("NOTE_CONNECTION_RUNTIME_DATA_DIR") {
        let candidate = PathBuf::from(custom_dir);
        ensure_directory(&candidate);
        return candidate;
    }

    let mut base = dirs::data_local_dir().unwrap_or_else(resolve_project_root);
    base.push("NoteConnection");
    base.push("runtime_data");
    ensure_directory(&base);
    base
}

fn sanitize_target_name(target: &str) -> String {
    target
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '_' || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

fn cache_info_from_file(file_path: &PathBuf, source: &str) -> Option<Value> {
    if !file_path.exists() {
        return None;
    }

    let metadata = fs::metadata(file_path).ok()?;
    let modified_secs = metadata
        .modified()
        .ok()
        .and_then(|ts| ts.duration_since(UNIX_EPOCH).ok())
        .map(|dur| dur.as_secs())
        .unwrap_or(0);

    Some(json!({
        "date": modified_secs.to_string(),
        "size": metadata.len(),
        "source": source
    }))
}

fn generated_asset_for_read(runtime_data_dir: &Path, frontend_dir: &Path, filename: &str) -> Option<PathBuf> {
    let runtime_file = runtime_data_dir.join(filename);
    if runtime_file.exists() {
        return Some(runtime_file);
    }

    let bundled_file = frontend_dir.join(filename);
    if bundled_file.exists() {
        return Some(bundled_file);
    }

    None
}

fn check_cache_for_target(runtime_data_dir: &Path, frontend_dir: &Path, target: &str) -> Option<Value> {
    if target.is_empty() {
        return None;
    }

    if target == "ALL_FOLDERS" {
        let active_path = generated_asset_for_read(runtime_data_dir, frontend_dir, "data.js")?;
        return cache_info_from_file(&active_path, "active");
    }

    let target_name = sanitize_target_name(target);
    let cache_path = generated_asset_for_read(
        runtime_data_dir,
        frontend_dir,
        format!("data_{}.js", target_name).as_str(),
    )?;
    cache_info_from_file(&cache_path, "target")
}

fn restore_cache_for_target(runtime_data_dir: &Path, frontend_dir: &Path, target: &str) -> Result<bool, String> {
    if target.is_empty() {
        return Ok(false);
    }

    if target == "ALL_FOLDERS" {
        return Ok(generated_asset_for_read(runtime_data_dir, frontend_dir, "data.js").is_some());
    }

    let target_name = sanitize_target_name(target);
    let cache_js = generated_asset_for_read(
        runtime_data_dir,
        frontend_dir,
        format!("data_{}.js", target_name).as_str(),
    );
    let target_js = runtime_data_dir.join("data.js");
    let cache_json = generated_asset_for_read(
        runtime_data_dir,
        frontend_dir,
        format!("graph_data_{}.json", target_name).as_str(),
    );
    let target_json = runtime_data_dir.join("graph_data.json");

    ensure_directory(runtime_data_dir);

    let Some(cache_js) = cache_js else {
        return Ok(false);
    };

    fs::copy(&cache_js, &target_js).map_err(|e| format!("Failed to copy cache js: {}", e))?;

    if let Some(cache_json) = cache_json {
        fs::copy(&cache_json, &target_json)
            .map_err(|e| format!("Failed to copy cache json: {}", e))?;
    }

    Ok(true)
}

fn is_generated_graph_asset(file_name: &str) -> bool {
    file_name == "data.js"
        || file_name == "graph_data.json"
        || (file_name.starts_with("data_") && file_name.ends_with(".js"))
        || (file_name.starts_with("graph_data_") && file_name.ends_with(".json"))
        || (file_name.starts_with("data_cli_") && file_name.ends_with(".js"))
        || (file_name.starts_with("graph_data_cli_") && file_name.ends_with(".json"))
}

fn bootstrap_runtime_data(frontend_dir: &Path, runtime_data_dir: &Path) {
    ensure_directory(runtime_data_dir);

    if let Ok(entries) = fs::read_dir(frontend_dir) {
        for entry in entries.flatten() {
            let source_path = entry.path();
            let Some(file_name_os) = source_path.file_name() else {
                continue;
            };
            let file_name = file_name_os.to_string_lossy();
            if !is_generated_graph_asset(&file_name) {
                continue;
            }

            let target_path = runtime_data_dir.join(file_name.as_ref());
            if target_path.exists() {
                continue;
            }

            if let Err(err) = fs::copy(&source_path, &target_path) {
                eprintln!(
                    "[Rust] Failed to seed runtime data '{}' -> '{}': {}",
                    source_path.to_string_lossy(),
                    target_path.to_string_lossy(),
                    err
                );
            }
        }
    }
}

#[derive(Debug, Clone)]
struct RuntimeNodeDraft {
    id: String,
    label: String,
    relative_no_ext: String,
    cluster_id: String,
    content: String,
    filepath: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct RuntimeBuildRequest {
    target: Option<String>,
    max_workers: Option<u32>,
    enable_gpu: Option<bool>,
    enable_gpu_layout: Option<bool>,
    memory_saving_mode: Option<bool>,
    deep_debug: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeBuildResult {
    success: bool,
    target: String,
    nodes: usize,
    edges: usize,
    data_js_path: String,
    graph_json_path: String,
}

fn normalize_path_key(raw: &str) -> String {
    raw.replace('\\', "/")
        .trim()
        .trim_matches('/')
        .to_ascii_lowercase()
}

fn normalize_relative_like_path(raw: &str) -> String {
    let replaced = raw.replace('\\', "/");
    let mut parts: Vec<&str> = Vec::new();
    for part in replaced.split('/') {
        match part {
            "" | "." => {}
            ".." => {
                if !parts.is_empty() {
                    parts.pop();
                }
            }
            _ => parts.push(part),
        }
    }
    parts.join("/")
}

fn strip_markdown_extension(raw: &str) -> String {
    let trimmed = raw.trim();
    let lowered = trimmed.to_ascii_lowercase();
    if lowered.ends_with(".markdown") {
        return trimmed[..trimmed.len() - ".markdown".len()].to_string();
    }
    if lowered.ends_with(".md") {
        return trimmed[..trimmed.len() - ".md".len()].to_string();
    }
    trimmed.to_string()
}

fn is_markdown_file(path: &Path) -> bool {
    let Some(ext) = path.extension().and_then(|v| v.to_str()) else {
        return false;
    };

    matches!(ext.to_ascii_lowercase().as_str(), "md" | "markdown")
}

fn collect_markdown_files(root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files: Vec<PathBuf> = Vec::new();
    let mut stack: Vec<PathBuf> = vec![root.to_path_buf()];

    while let Some(dir) = stack.pop() {
        let entries = fs::read_dir(&dir)
            .map_err(|err| format!("Failed to scan directory '{}': {}", dir.to_string_lossy(), err))?;

        for entry in entries.flatten() {
            let path = entry.path();
            let file_type = entry
                .file_type()
                .map_err(|err| format!("Failed to inspect '{}': {}", path.to_string_lossy(), err))?;

            if file_type.is_dir() {
                stack.push(path);
            } else if file_type.is_file() && is_markdown_file(&path) {
                files.push(path);
            }
        }
    }

    files.sort();
    Ok(files)
}

fn extract_wiki_link_targets(content: &str) -> Vec<String> {
    let mut targets = Vec::new();
    let mut cursor = 0usize;
    while let Some(start_rel) = content[cursor..].find("[[") {
        let start = cursor + start_rel + 2;
        let Some(end_rel) = content[start..].find("]]") else {
            break;
        };
        let end = start + end_rel;
        targets.push(content[start..end].to_string());
        cursor = end + 2;
    }
    targets
}

fn extract_markdown_link_targets(content: &str) -> Vec<String> {
    let mut targets = Vec::new();
    let mut cursor = 0usize;
    while let Some(open_rel) = content[cursor..].find("](") {
        let open = cursor + open_rel + 2;
        let Some(close_rel) = content[open..].find(')') else {
            break;
        };
        let close = open + close_rel;
        targets.push(content[open..close].to_string());
        cursor = close + 1;
    }
    targets
}

fn sanitize_reference_target(raw: &str) -> Option<String> {
    let mut target = raw.trim();
    if target.is_empty() {
        return None;
    }

    if let Some(idx) = target.find('|') {
        target = &target[..idx];
    }
    if let Some(idx) = target.find('#') {
        target = &target[..idx];
    }

    let lowered = target.to_ascii_lowercase();
    if lowered.starts_with("http://")
        || lowered.starts_with("https://")
        || lowered.starts_with("mailto:")
        || lowered.starts_with("file://")
        || lowered.starts_with('#')
    {
        return None;
    }

    let no_ext = strip_markdown_extension(target);
    let normalized = normalize_relative_like_path(no_ext.as_str());
    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

fn resolve_target_id_for_reference(
    source_relative_no_ext: &str,
    reference: &str,
    id_by_relative_key: &HashMap<String, String>,
    id_by_unique_stem: &HashMap<String, String>,
) -> Option<String> {
    let direct_key = normalize_path_key(reference);
    if let Some(id) = id_by_relative_key.get(&direct_key) {
        return Some(id.clone());
    }

    let source_parent = Path::new(source_relative_no_ext)
        .parent()
        .and_then(|p| p.to_str())
        .unwrap_or("");
    if !source_parent.is_empty() {
        let combined = normalize_relative_like_path(&format!(
            "{}/{}",
            source_parent.replace('\\', "/"),
            reference
        ));
        let combined_key = normalize_path_key(&combined);
        if let Some(id) = id_by_relative_key.get(&combined_key) {
            return Some(id.clone());
        }
    }

    let stem = Path::new(reference)
        .file_name()
        .and_then(|v| v.to_str())
        .unwrap_or(reference)
        .to_ascii_lowercase();
    id_by_unique_stem.get(&stem).cloned()
}

fn build_graph_runtime_for_target(
    kb_root: &Path,
    runtime_data_dir: &Path,
    target: &str,
) -> Result<RuntimeBuildResult, String> {
    let target_trimmed = target.trim();
    let is_all_targets = target_trimmed.is_empty() || target_trimmed.eq_ignore_ascii_case("ALL_FOLDERS");

    let source_root = if is_all_targets {
        kb_root.to_path_buf()
    } else {
        kb_root.join(target_trimmed)
    };

    if !source_root.exists() || !source_root.is_dir() {
        return Err(format!(
            "Target directory does not exist: {}",
            source_root.to_string_lossy()
        ));
    }

    let markdown_files = collect_markdown_files(&source_root)?;
    let mut node_drafts: Vec<RuntimeNodeDraft> = Vec::with_capacity(markdown_files.len());
    let mut id_by_relative_key: HashMap<String, String> = HashMap::new();
    let mut stem_to_ids: HashMap<String, Vec<String>> = HashMap::new();

    for file_path in markdown_files {
        let content = fs::read_to_string(&file_path)
            .map_err(|err| format!("Failed to read '{}': {}", file_path.to_string_lossy(), err))?;
        let relative_from_kb = file_path
            .strip_prefix(kb_root)
            .map_err(|err| format!("Failed to normalize file path '{}': {}", file_path.to_string_lossy(), err))?
            .to_path_buf();

        let relative_without_ext = strip_markdown_extension(
            relative_from_kb
                .to_string_lossy()
                .replace('\\', "/")
                .as_str(),
        );
        let relative_key = normalize_path_key(&relative_without_ext);
        let id = relative_without_ext.clone();
        let label = file_path
            .file_stem()
            .and_then(|v| v.to_str())
            .unwrap_or("untitled")
            .to_string();
        let stem_key = label.to_ascii_lowercase();
        let cluster_id = relative_from_kb
            .components()
            .next()
            .and_then(|c| c.as_os_str().to_str())
            .unwrap_or("default")
            .to_string();
        let filepath = file_path.to_string_lossy().to_string();

        id_by_relative_key.insert(relative_key, id.clone());
        stem_to_ids
            .entry(stem_key.clone())
            .or_default()
            .push(id.clone());

        node_drafts.push(RuntimeNodeDraft {
            id,
            label,
            relative_no_ext: relative_without_ext,
            cluster_id,
            content,
            filepath,
        });
    }

    let mut id_by_unique_stem: HashMap<String, String> = HashMap::new();
    for (stem, ids) in stem_to_ids {
        if ids.len() == 1 {
            id_by_unique_stem.insert(stem, ids[0].clone());
        }
    }

    let mut unique_edges: BTreeSet<(String, String)> = BTreeSet::new();
    for node in &node_drafts {
        let mut link_candidates = extract_wiki_link_targets(&node.content);
        link_candidates.extend(extract_markdown_link_targets(&node.content));

        for raw_ref in link_candidates {
            let Some(reference) = sanitize_reference_target(&raw_ref) else {
                continue;
            };

            let Some(target_id) = resolve_target_id_for_reference(
                &node.relative_no_ext,
                &reference,
                &id_by_relative_key,
                &id_by_unique_stem,
            ) else {
                continue;
            };

            if target_id != node.id {
                unique_edges.insert((node.id.clone(), target_id));
            }
        }
    }

    let mut in_degree: HashMap<String, usize> = HashMap::new();
    let mut out_degree: HashMap<String, usize> = HashMap::new();
    for (source, target) in &unique_edges {
        *out_degree.entry(source.clone()).or_insert(0) += 1;
        *in_degree.entry(target.clone()).or_insert(0) += 1;
    }

    let full_nodes: Vec<Value> = node_drafts
        .iter()
        .map(|node| {
            let in_count = *in_degree.get(&node.id).unwrap_or(&0);
            let out_count = *out_degree.get(&node.id).unwrap_or(&0);
            json!({
                "id": node.id.clone(),
                "label": node.label.clone(),
                "clusterId": node.cluster_id.clone(),
                "inDegree": in_count,
                "outDegree": out_count,
                "centrality": (in_count + out_count) as f64,
                "metadata": {
                    "filepath": node.filepath.clone()
                },
                "content": node.content.clone()
            })
        })
        .collect();

    let lite_nodes: Vec<Value> = node_drafts
        .iter()
        .map(|node| {
            let in_count = *in_degree.get(&node.id).unwrap_or(&0);
            let out_count = *out_degree.get(&node.id).unwrap_or(&0);
            json!({
                "id": node.id.clone(),
                "label": node.label.clone(),
                "clusterId": node.cluster_id.clone(),
                "inDegree": in_count,
                "outDegree": out_count,
                "centrality": (in_count + out_count) as f64,
                "metadata": {
                    "filepath": node.filepath.clone()
                }
            })
        })
        .collect();

    let edges: Vec<Value> = unique_edges
        .iter()
        .map(|(source, target)| {
            json!({
                "source": source,
                "target": target,
                "weight": 1.0
            })
        })
        .collect();

    let full_graph = json!({
        "nodes": full_nodes,
        "edges": edges.clone()
    });
    let lite_graph = json!({
        "nodes": lite_nodes,
        "edges": edges
    });

    ensure_directory(runtime_data_dir);
    let graph_json_path = runtime_data_dir.join("graph_data.json");
    let data_js_path = runtime_data_dir.join("data.js");

    fs::write(
        &graph_json_path,
        serde_json::to_string_pretty(&full_graph)
            .map_err(|err| format!("Failed to serialize graph_data.json: {}", err))?,
    )
    .map_err(|err| format!("Failed to write '{}': {}", graph_json_path.to_string_lossy(), err))?;
    fs::write(
        &data_js_path,
        format!(
            "const graphData = {};",
            serde_json::to_string(&lite_graph)
                .map_err(|err| format!("Failed to serialize data.js payload: {}", err))?
        ),
    )
    .map_err(|err| format!("Failed to write '{}': {}", data_js_path.to_string_lossy(), err))?;

    if !is_all_targets {
        let sanitized = sanitize_target_name(target_trimmed);
        let cache_js_path = runtime_data_dir.join(format!("data_{}.js", sanitized));
        let cache_json_path = runtime_data_dir.join(format!("graph_data_{}.json", sanitized));

        fs::write(
            &cache_js_path,
            format!(
                "const graphData = {};",
                serde_json::to_string(&lite_graph)
                    .map_err(|err| format!("Failed to serialize cache data payload: {}", err))?
            ),
        )
        .map_err(|err| format!("Failed to write '{}': {}", cache_js_path.to_string_lossy(), err))?;
        fs::write(
            &cache_json_path,
            serde_json::to_string_pretty(&full_graph)
                .map_err(|err| format!("Failed to serialize cache graph payload: {}", err))?,
        )
        .map_err(|err| format!("Failed to write '{}': {}", cache_json_path.to_string_lossy(), err))?;
    }

    Ok(RuntimeBuildResult {
        success: true,
        target: if is_all_targets {
            "ALL_FOLDERS".to_string()
        } else {
            target_trimmed.to_string()
        },
        nodes: node_drafts.len(),
        edges: unique_edges.len(),
        data_js_path: data_js_path.to_string_lossy().to_string(),
        graph_json_path: graph_json_path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn get_kb_path() -> Result<String, String> {
    Ok(resolve_kb_path_from_config())
}

#[tauri::command]
fn set_kb_path(kb_path: String) -> Result<String, String> {
    persist_kb_path(&kb_path)
}

#[tauri::command]
fn choose_kb_path() -> Result<Option<String>, String> {
    let current_kb = resolve_kb_path_from_config();
    if let Some(folder) = pick_knowledge_base_folder(&current_kb, "Select Knowledge Base Folder") {
        let selected = folder.to_string_lossy().to_string();
        return persist_kb_path(selected.as_str()).map(Some);
    }

    Ok(None)
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
fn pick_notemd_file(initial_path: Option<String>) -> Result<Option<String>, String> {
    Ok(pick_notemd_file_internal(initial_path.as_deref())
        .map(|path| path.to_string_lossy().to_string()))
}

#[cfg(target_os = "android")]
#[tauri::command]
fn pick_notemd_file(_initial_path: Option<String>) -> Result<Option<String>, String> {
    Ok(None)
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
fn save_notemd_file(initial_path: Option<String>) -> Result<Option<String>, String> {
    Ok(save_notemd_file_internal(initial_path.as_deref())
        .map(|path| path.to_string_lossy().to_string()))
}

#[cfg(target_os = "android")]
#[tauri::command]
fn save_notemd_file(_initial_path: Option<String>) -> Result<Option<String>, String> {
    Ok(None)
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
fn pick_notemd_folder(initial_path: Option<String>) -> Result<Option<String>, String> {
    Ok(pick_notemd_folder_internal(initial_path.as_deref())
        .map(|path| path.to_string_lossy().to_string()))
}

#[cfg(target_os = "android")]
#[tauri::command]
fn pick_notemd_folder(_initial_path: Option<String>) -> Result<Option<String>, String> {
    Ok(None)
}

#[tauri::command]
fn reset_kb_path() -> Result<String, String> {
    let default_path = ensure_default_kb_root_exists();
    persist_kb_path(default_path.as_str())
}

#[tauri::command]
fn get_user_language() -> Result<String, String> {
    Ok(resolve_user_language_from_config())
}

#[tauri::command]
fn get_folders() -> Result<Vec<String>, String> {
    let kb_path = resolve_kb_path_from_config();
    let mut folders = Vec::new();
    
    if let Ok(entries) = fs::read_dir(kb_path) {
        for entry in entries.flatten() {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_dir() {
                    if let Ok(name) = entry.file_name().into_string() {
                        folders.push(name);
                    }
                }
            }
        }
    }

    folders.sort();

    Ok(folders)
}

fn parse_cached_target_from_file_name(file_name: &str) -> Option<String> {
    if file_name.starts_with("data_cli_") || file_name.starts_with("graph_data_cli_") {
        return None;
    }

    if let Some(raw) = file_name
        .strip_prefix("data_")
        .and_then(|name| name.strip_suffix(".js"))
    {
        if !raw.is_empty() {
            return Some(raw.to_string());
        }
    }

    if let Some(raw) = file_name
        .strip_prefix("graph_data_")
        .and_then(|name| name.strip_suffix(".json"))
    {
        if !raw.is_empty() {
            return Some(raw.to_string());
        }
    }

    None
}

fn collect_cached_targets_from_dir(dir: &Path, targets: &mut BTreeSet<String>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };

    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if !file_type.is_file() {
            continue;
        }

        let Ok(file_name) = entry.file_name().into_string() else {
            continue;
        };

        if let Some(target) = parse_cached_target_from_file_name(file_name.as_str()) {
            targets.insert(target);
        }
    }
}

fn collect_available_targets(kb_path: &Path, runtime_data_dir: &Path, frontend_dir: &Path) -> Vec<String> {
    let mut targets = BTreeSet::new();

    if let Ok(entries) = fs::read_dir(kb_path) {
        for entry in entries.flatten() {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_dir() {
                    if let Ok(name) = entry.file_name().into_string() {
                        targets.insert(name);
                    }
                }
            }
        }
    }

    collect_cached_targets_from_dir(runtime_data_dir, &mut targets);
    collect_cached_targets_from_dir(frontend_dir, &mut targets);

    targets.into_iter().collect()
}

#[tauri::command]
fn get_available_targets() -> Result<Vec<String>, String> {
    let kb_path = PathBuf::from(resolve_kb_path_from_config());
    let runtime_data_dir = resolve_runtime_data_path();
    let frontend_dir = resolve_frontend_dist_path();
    Ok(collect_available_targets(
        &kb_path,
        &runtime_data_dir,
        &frontend_dir,
    ))
}

#[cfg(not(target_os = "android"))]
fn build_menu<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    lang: &str,
) -> tauri::Result<tauri::menu::Menu<R>> {
    let tools = if lang == "zh" { "工具" } else { "Tools" };
    let file = if lang == "zh" { "文件" } else { "File" };
    let _edit = if lang == "zh" { "编辑" } else { "Edit" };
    let _view = if lang == "zh" { "视图" } else { "View" };
    let _window = if lang == "zh" { "窗口" } else { "Window" };
    let help = if lang == "zh" { "帮助" } else { "Help" };

    let quit_item = PredefinedMenuItem::quit(app, Some(if lang == "zh" { "退出" } else { "Quit" }))?;
    let change_kb = MenuItemBuilder::with_id("change_kb", if lang == "zh" { "更改知识库..." } else { "Change KB..." }).accelerator("CmdOrCtrl+O").build(app)?;
    let reset_kb = MenuItemBuilder::with_id("reset_kb", if lang == "zh" { "重置为默认位置" } else { "Reset to Default Location" }).build(app)?;

    let file_submenu = SubmenuBuilder::new(app, file)
        .item(&change_kb)
        .item(&reset_kb)
        .separator()
        .item(&quit_item)
        .build()?;
    let note_md_item = MenuItemBuilder::with_id("open_notemd", if lang == "zh" { "NoteMD..." } else { "NoteMD..." })
        .accelerator("CmdOrCtrl+D")
        .build(app)?;
    let tools_submenu = SubmenuBuilder::new(app, tools)
        .item(&note_md_item)
        .build()?;

    let doc_item = MenuItemBuilder::with_id("docs", if lang == "zh" { "文档" } else { "Documentation" }).build(app)?;
    let about_item = MenuItemBuilder::with_id("about", if lang == "zh" { "关于" } else { "About" }).build(app)?;

    let help_submenu = SubmenuBuilder::new(app, help)
        .item(&doc_item)
        .separator()
        .item(&about_item)
        .build()?;

    MenuBuilder::new(app)
        .item(&file_submenu)
        .item(&tools_submenu)
        .item(&help_submenu)
        .build()
}

#[cfg(not(target_os = "android"))]
static MENU_LANG_STATE: OnceLock<Mutex<String>> = OnceLock::new();
struct ChildProcessState {
    sidecar: Mutex<Option<tauri_plugin_shell::process::CommandChild>>,
    godot: Mutex<Option<std::process::Child>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SidecarRuntimeConfig {
    host: String,
    port: u16,
    bridge_port: u16,
    base_url: String,
    bridge_ws_url: String,
    auth_token: String,
}

fn default_sidecar_runtime_config() -> SidecarRuntimeConfig {
    let host = "127.0.0.1".to_string();
    let port = 3000;
    let bridge_port = 9876;
    SidecarRuntimeConfig {
        host: host.clone(),
        port,
        bridge_port,
        base_url: format!("http://{}:{}", host, port),
        bridge_ws_url: format!("ws://{}:{}", host, bridge_port),
        auth_token: String::new(),
    }
}

#[cfg(not(target_os = "android"))]
fn reserve_loopback_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .and_then(|listener| listener.local_addr())
        .map(|address| address.port())
        .unwrap_or(0)
}

#[cfg(not(target_os = "android"))]
fn build_sidecar_runtime_config() -> SidecarRuntimeConfig {
    let host = "127.0.0.1".to_string();
    let port = reserve_loopback_port();
    let bridge_port = reserve_loopback_port();
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let auth_token = format!("nc-{}-{}-{}", std::process::id(), port, timestamp);

    SidecarRuntimeConfig {
        host: host.clone(),
        port,
        bridge_port,
        base_url: format!("http://{}:{}", host, port),
        bridge_ws_url: format!("ws://{}:{}", host, bridge_port),
        auth_token,
    }
}

struct SidecarRuntimeState {
    config: Mutex<SidecarRuntimeConfig>,
}

impl Default for SidecarRuntimeState {
    fn default() -> Self {
        #[cfg(not(target_os = "android"))]
        {
            return Self {
                config: Mutex::new(build_sidecar_runtime_config()),
            };
        }

        #[cfg(target_os = "android")]
        {
            Self {
                config: Mutex::new(default_sidecar_runtime_config()),
            }
        }
    }
}

#[allow(dead_code)]
#[tauri::command]
fn get_sidecar_runtime_config(state: tauri::State<'_, SidecarRuntimeState>) -> SidecarRuntimeConfig {
    state
        .config
        .lock()
        .map(|config| config.clone())
        .unwrap_or_else(|_| default_sidecar_runtime_config())
}

#[derive(Debug, Clone, Serialize)]
struct RuntimeCapabilities {
    platform: String,
    supports_sidecar: bool,
    supports_build: bool,
    supports_content_api: bool,
    supports_kb_runtime_change: bool,
    supports_native_pathmode: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct NativePathmodeLaunchRequest {
    mode: Option<String>,
    strategy: Option<String>,
    target_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativePathmodeLaunchResult {
    launched: bool,
    reason: Option<String>,
}

#[tauri::command]
fn get_runtime_capabilities() -> RuntimeCapabilities {
    #[cfg(target_os = "android")]
    {
        return RuntimeCapabilities {
            platform: "android".to_string(),
            supports_sidecar: false,
            supports_build: true,
            supports_content_api: true,
            supports_kb_runtime_change: false,
            supports_native_pathmode: true,
        };
    }

    #[cfg(not(target_os = "android"))]
    {
        RuntimeCapabilities {
            platform: std::env::consts::OS.to_string(),
            supports_sidecar: true,
            supports_build: true,
            supports_content_api: true,
            supports_kb_runtime_change: true,
            supports_native_pathmode: false,
        }
    }
}

#[cfg(target_os = "android")]
fn launch_native_pathmode_activity(payload_json: &str) -> Result<bool, String> {
    let android_context = ndk_context::android_context();
    let vm_ptr = android_context.vm();
    let context_ptr = android_context.context();

    if vm_ptr.is_null() || context_ptr.is_null() {
        return Err("Android context is unavailable".to_string());
    }

    let vm = unsafe { JavaVM::from_raw(vm_ptr as *mut jni::sys::JavaVM) }
        .map_err(|err| format!("Failed to access Android JavaVM: {}", err))?;
    let mut env = vm
        .attach_current_thread()
        .map_err(|err| format!("Failed to attach JNI thread: {}", err))?;

    let bridge_class = env
        .find_class("com/jacobinwwey/noteconnection/PathmodeBridge")
        .map_err(|err| {
            format!(
                "PathmodeBridge class is not available in Android app build. Did patch step run? {}",
                err
            )
        })?;

    let context_obj = unsafe { JObject::from_raw(context_ptr as jni::sys::jobject) };
    let payload_str = env
        .new_string(payload_json)
        .map_err(|err| format!("Failed to create JNI payload string: {}", err))?;
    let payload_obj: JObject = payload_str.into();

    let launch_result = env
        .call_static_method(
            bridge_class,
            "openPathmode",
            "(Landroid/content/Context;Ljava/lang/String;)Z",
            &[
                JValue::Object(&context_obj),
                JValue::Object(&payload_obj),
            ],
        )
        .map_err(|err| format!("Failed to call PathmodeBridge.openPathmode: {}", err))?;

    launch_result
        .z()
        .map_err(|err| format!("Failed to decode Pathmode launch result: {}", err))
}

#[tauri::command]
fn open_native_pathmode(request: NativePathmodeLaunchRequest) -> Result<NativePathmodeLaunchResult, String> {
    #[cfg(target_os = "android")]
    {
        let payload_json = serde_json::to_string(&request)
            .map_err(|err| format!("Failed to serialize native Pathmode payload: {}", err))?;

        let launched = launch_native_pathmode_activity(payload_json.as_str())?;
        if launched {
            Ok(NativePathmodeLaunchResult {
                launched: true,
                reason: None,
            })
        } else {
            Ok(NativePathmodeLaunchResult {
                launched: false,
                reason: Some("Android bridge returned false".to_string()),
            })
        }
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = request;
        Ok(NativePathmodeLaunchResult {
            launched: false,
            reason: Some("Native Android Pathmode is unsupported on this platform".to_string()),
        })
    }
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
fn open_notemd(app: AppHandle) -> Result<(), String> {
    // Single-window mode: always render NoteMD inside the main frontend window.
    // 单窗口模式：始终在主前端窗口内嵌显示 NoteMD。
    let main_window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main Tauri window not found".to_string())?;

    main_window
        .show()
        .map_err(|err| format!("Failed to show main window for NoteMD: {}", err))?;
    main_window
        .set_focus()
        .map_err(|err| format!("Failed to focus main window for NoteMD: {}", err))?;

    app.emit(
        "notemd-open-request",
        json!({
            "source": "tauri_command"
        }),
    )
    .map_err(|err| format!("Failed to emit NoteMD open event: {}", err))?;

    Ok(())
}

#[cfg(target_os = "android")]
#[tauri::command]
fn open_notemd(_app: AppHandle) -> Result<(), String> {
    Err("Desktop NoteMD window command is unavailable on Android".to_string())
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
fn shutdown_application(app: AppHandle, reason: Option<String>) -> Result<(), String> {
    println!(
        "[Rust] shutdown_application requested. reason={}",
        reason.unwrap_or_else(|| "unspecified".to_string())
    );
    shutdown_child_processes(&app);
    app.exit(0);
    Ok(())
}

#[cfg(target_os = "android")]
#[tauri::command]
fn shutdown_application(_app: AppHandle, _reason: Option<String>) -> Result<(), String> {
    Ok(())
}

/// Toggle between Tauri main window and Godot PathMode window.
/// When `show_godot` is true, the Tauri window hides and Godot becomes visible.
/// When `show_godot` is false, the Godot window hides and Tauri becomes visible.
///
/// 切换 Tauri 主窗口与 Godot PathMode 窗口。
/// 当 `show_godot` 为 true 时，Tauri 窗口隐藏、Godot 窗口显示。
/// 当 `show_godot` 为 false 时，Godot 窗口隐藏、Tauri 窗口显示。
#[cfg(not(target_os = "android"))]
#[tauri::command]
fn toggle_pathmode_window(app: AppHandle, show_godot: bool) -> Result<(), String> {
    let main_window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main Tauri window not found".to_string())?;

    if show_godot {
        // Hide Tauri window; Godot will show itself via WebSocket message.
        // 隐藏 Tauri 窗口；Godot 将通过 WebSocket 消息自行显示。
        main_window
            .hide()
            .map_err(|err| format!("Failed to hide Tauri window: {}", err))?;
        println!("[Rust] Tauri window hidden for PathMode.");
    } else {
        // Show Tauri window; Godot will hide itself via WebSocket message.
        // 显示 Tauri 窗口；Godot 将通过 WebSocket 消息自行隐藏。
        main_window
            .show()
            .map_err(|err| format!("Failed to show Tauri window: {}", err))?;
        main_window
            .set_focus()
            .map_err(|err| format!("Failed to focus Tauri window: {}", err))?;
        println!("[Rust] Tauri window restored from PathMode.");
    }

    Ok(())
}

#[cfg(target_os = "android")]
#[tauri::command]
fn toggle_pathmode_window(_app: AppHandle, _show_godot: bool) -> Result<(), String> {
    // Android uses native Pathmode activity instead of window toggling.
    // Android 使用原生 Pathmode Activity，而非窗口切换。
    Ok(())
}

impl Default for ChildProcessState {
    fn default() -> Self {
        Self {
            sidecar: Mutex::new(None),
            godot: Mutex::new(None),
        }
    }
}

#[cfg(not(target_os = "android"))]
fn menu_lang_state() -> &'static Mutex<String> {
    MENU_LANG_STATE.get_or_init(|| Mutex::new("en".to_string()))
}

fn shutdown_child_processes<R: tauri::Runtime>(app: &AppHandle<R>) {
    if let Ok(mut sidecar_slot) = app.state::<ChildProcessState>().sidecar.lock() {
        if let Some(child) = sidecar_slot.take() {
            match child.kill() {
                Ok(_) => println!("[Rust] Sidecar process terminated on shutdown."),
                Err(err) => eprintln!("[Rust] Failed to terminate sidecar process: {}", err),
            }
        }
    }

    if let Ok(mut godot_slot) = app.state::<ChildProcessState>().godot.lock() {
        if let Some(mut child) = godot_slot.take() {
            match child.kill() {
                Ok(_) => println!("[Rust] Godot process terminated on shutdown."),
                Err(err) => eprintln!("[Rust] Failed to terminate Godot process: {}", err),
            }
        }
    }
}

#[tauri::command]
fn set_user_language(app: AppHandle, lang: String) -> Result<(), String> {
    let normalized_lang = persist_user_language(&lang)?;

    #[cfg(not(target_os = "android"))]
    {
        // Idempotent guard: avoid reapplying the same menu language repeatedly.
        {
            let state = menu_lang_state()
                .lock()
                .map_err(|_| "Failed to lock menu language state".to_string())?;
            if state.as_str() == normalized_lang {
                return Ok(());
            }
        }

        println!("[Rust] Setting user language to: {}", normalized_lang);
        if let Ok(menu) = build_menu(&app, normalized_lang.as_str()) {
            let _ = app.set_menu(menu);
            if let Ok(mut state) = menu_lang_state().lock() {
                *state = normalized_lang;
            }
        }
    }

    #[cfg(target_os = "android")]
    {
        let _ = app;
        println!("[Rust] Setting user language to: {} (Android)", normalized_lang);
    }

    Ok(())
}

#[tauri::command]
fn check_cache(target: String) -> Result<Option<Value>, String> {
    let frontend_dir = resolve_frontend_dist_path();
    let runtime_data_dir = resolve_runtime_data_path();
    Ok(check_cache_for_target(&runtime_data_dir, &frontend_dir, &target))
}

#[tauri::command]
fn restore_cache(target: String) -> Result<bool, String> {
    let frontend_dir = resolve_frontend_dist_path();
    let runtime_data_dir = resolve_runtime_data_path();
    restore_cache_for_target(&runtime_data_dir, &frontend_dir, &target)
}

#[tauri::command]
fn build_graph_runtime(request: RuntimeBuildRequest) -> Result<RuntimeBuildResult, String> {
    let kb_root = PathBuf::from(resolve_kb_path_from_config());
    let runtime_data_dir = resolve_runtime_data_path();
    let target = request
        .target
        .clone()
        .unwrap_or_else(|| "ALL_FOLDERS".to_string());

    // These options are currently accepted for API parity with desktop build payload.
    // Native mobile runtime does not yet use worker/GPU tuning knobs.
    let _ = (
        request.max_workers,
        request.enable_gpu,
        request.enable_gpu_layout,
        request.memory_saving_mode,
        request.deep_debug,
    );

    build_graph_runtime_for_target(&kb_root, &runtime_data_dir, target.as_str())
}

fn extract_relative_path_from_kb_marker(raw_file_path: &str) -> Option<PathBuf> {
    let normalized = raw_file_path.replace('\\', "/");
    let lowered = normalized.to_ascii_lowercase();
    let marker = "/knowledge_base/";

    if let Some(idx) = lowered.find(marker) {
        let start = idx + marker.len();
        let relative = &normalized[start..];
        if !relative.is_empty() {
            return Some(PathBuf::from(relative));
        }
    }

    let marker_no_prefix = "knowledge_base/";
    if lowered.starts_with(marker_no_prefix) {
        let relative = &normalized[marker_no_prefix.len()..];
        if !relative.is_empty() {
            return Some(PathBuf::from(relative));
        }
    }

    None
}

fn resolve_content_candidate_path(kb_root: &Path, raw_file_path: &str) -> PathBuf {
    let normalized = raw_file_path.replace('\\', "/");
    let normalized_candidate = PathBuf::from(normalized);

    if normalized_candidate.is_absolute() && normalized_candidate.exists() {
        return normalized_candidate;
    }

    if let Some(relative_from_kb) = extract_relative_path_from_kb_marker(raw_file_path) {
        return kb_root.join(relative_from_kb);
    }

    if normalized_candidate.is_absolute() {
        normalized_candidate
    } else {
        kb_root.join(normalized_candidate)
    }
}

/// Read a generated graph asset (e.g. data.js, graph_data.json) directly from
/// runtime_data_dir via IPC, bypassing the HTTP sidecar.  This provides a
/// reliable fallback when the Tauri WebView cannot reach http://localhost:3000
/// due to mixed-content or CSP restrictions.
///
/// 通过 IPC 直接从 runtime_data_dir 读取已生成的图谱资源文件（如 data.js、
/// graph_data.json），绕过 HTTP sidecar。当 Tauri WebView 由于混合内容或
/// CSP 限制无法访问 http://localhost:3000 时，此命令提供可靠的回退方案。
#[tauri::command]
fn read_generated_asset(filename: String) -> Result<String, String> {
    let sanitized = filename
        .replace('/', "")
        .replace('\\', "")
        .replace("..", "");
    if sanitized.is_empty() {
        return Err("Missing or invalid filename".to_string());
    }

    if !is_generated_graph_asset(&sanitized) {
        return Err(format!(
            "Requested file '{}' is not a recognised generated graph asset",
            sanitized
        ));
    }

    let runtime_data_dir = resolve_runtime_data_path();
    let file_path = runtime_data_dir.join(&sanitized);

    if !file_path.exists() || !file_path.is_file() {
        return Err(format!(
            "Generated asset '{}' not found in runtime data directory",
            sanitized
        ));
    }

    fs::read_to_string(&file_path)
        .map_err(|err| format!("Failed to read generated asset '{}': {}", sanitized, err))
}

#[tauri::command]
fn read_node_content(file_path: String) -> Result<String, String> {
    if file_path.trim().is_empty() {
        return Err("Missing file path".to_string());
    }

    let kb_root = PathBuf::from(resolve_kb_path_from_config());
    let kb_root_canonical = fs::canonicalize(&kb_root)
        .map_err(|err| format!("Failed to resolve knowledge base root: {}", err))?;

    let candidate_path = resolve_content_candidate_path(&kb_root_canonical, &file_path);
    let canonical_path = fs::canonicalize(&candidate_path)
        .map_err(|err| format!("Failed to resolve content file path: {}", err))?;

    if !canonical_path.starts_with(&kb_root_canonical) {
        return Err("Requested file is outside configured knowledge base".to_string());
    }

    let metadata = fs::metadata(&canonical_path)
        .map_err(|err| format!("Failed to read file metadata: {}", err))?;
    if !metadata.is_file() {
        return Err("Requested path is not a file".to_string());
    }

    fs::read_to_string(&canonical_path)
        .map_err(|err| format!("Failed to read file content: {}", err))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .manage(ChildProcessState::default())
        .manage(SidecarRuntimeState::default())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                shutdown_child_processes(&window.app_handle());
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_kb_path,
            set_kb_path,
            choose_kb_path,
            pick_notemd_file,
            save_notemd_file,
            pick_notemd_folder,
            reset_kb_path,
            get_folders,
            get_available_targets,
            get_runtime_capabilities,
            get_sidecar_runtime_config,
            open_native_pathmode,
            open_notemd,
            shutdown_application,
            toggle_pathmode_window,
            set_user_language,
            get_user_language,
            check_cache,
            restore_cache,
            build_graph_runtime,
            read_generated_asset,
            read_node_content
        ])
        .setup(|app| {
            let startup_kb_path = ensure_startup_kb_path();
            #[cfg(not(target_os = "android"))]
            let startup_lang = resolve_user_language_from_config();
            #[cfg(target_os = "android")]
            let _ = app;

            #[cfg(not(target_os = "android"))]
            {
                if let Ok(menu) = build_menu(app.handle(), startup_lang.as_str()) {
                    let _ = app.set_menu(menu);
                    if let Ok(mut state) = menu_lang_state().lock() {
                        *state = startup_lang.clone();
                    }
                }

                app.on_menu_event(move |app_handle, event| {
                    match event.id().as_ref() {
                        "change_kb" => {
                            println!("Action: Change KB");
                            let current_kb = resolve_kb_path_from_config();
                            if let Some(folder) =
                                pick_knowledge_base_folder(&current_kb, "Select Knowledge Base Folder")
                            {
                                let path_str = folder.to_string_lossy().to_string();
                                println!("Selected KB Path: {}", path_str);
                                match persist_kb_path(&path_str) {
                                    Ok(normalized_path) => {
                                        let _ = app_handle.emit("kb-path-changed", normalized_path);
                                    }
                                    Err(err) => {
                                        eprintln!("[Rust] Failed to persist KB path: {}", err);
                                    }
                                }
                            }
                        }
                        "reset_kb" => {
                            println!("Action: Reset KB");
                            let default_path = ensure_default_kb_root_exists();
                            match persist_kb_path(&default_path) {
                                Ok(normalized_path) => {
                                    let _ = app_handle.emit("kb-path-changed", normalized_path);
                                }
                                Err(err) => {
                                    eprintln!("[Rust] Failed to persist reset KB path: {}", err);
                                }
                            }
                        }
                        "open_notemd" => {
                            if let Err(err) = open_notemd(app_handle.clone()) {
                                eprintln!("[Rust] Failed to open NoteMD window: {}", err);
                            }
                        }
                        "docs" => {
                            println!("Action: Documentation");
                            // Open manual.html in browser or new Tauri window
                        }
                        "about" => {
                            println!("Action: About");
                            let _ = tauri_plugin_dialog::DialogExt::dialog(app_handle)
                                .message("NoteConnection v1.6.0\n\nDeveloped by Jacob\nGitHub: https://github.com/Jacobinwwey")
                                .title("About NoteConnection")
                                .show(|_| {});
                        }
                        _ => {}
                    }
                });
            }

            let kb_root = PathBuf::from(startup_kb_path.clone());
            let frontend_dir = resolve_frontend_dist_path();
            let runtime_data_dir = resolve_runtime_data_path();
            bootstrap_runtime_data(&frontend_dir, &runtime_data_dir);

            #[cfg(not(target_os = "android"))]
            {
                let project_root = resolve_project_root();
                let sidecar_runtime = app
                    .state::<SidecarRuntimeState>()
                    .config
                    .lock()
                    .map(|config| config.clone())
                    .unwrap_or_else(|_| default_sidecar_runtime_config());
                let sidecar_allowed_origins =
                    "tauri://localhost,http://tauri.localhost,http://localhost,http://127.0.0.1,capacitor://localhost";
                println!("[Rust] Sidecar Project Root: {}", project_root.to_string_lossy());
                println!("[Rust] Sidecar Knowledge Base Root: {}", kb_root.to_string_lossy());
                println!("[Rust] Sidecar Frontend Root: {}", frontend_dir.to_string_lossy());
                println!(
                    "[Rust] Sidecar Runtime Data Root: {}",
                    runtime_data_dir.to_string_lossy()
                );
                println!(
                    "[Rust] Sidecar Runtime Endpoint: {} (bridge {})",
                    sidecar_runtime.base_url,
                    sidecar_runtime.bridge_ws_url
                );

                let mut sidecar_command = app.shell().sidecar("server").unwrap();
                sidecar_command = sidecar_command
                    .env(
                        "NOTE_CONNECTION_PROJECT_ROOT",
                        project_root.to_string_lossy().to_string(),
                    )
                    .env("NOTE_CONNECTION_KB_ROOT", kb_root.to_string_lossy().to_string())
                    .env(
                        "NOTE_CONNECTION_FRONTEND_DIR",
                        frontend_dir.to_string_lossy().to_string(),
                    )
                    .env(
                        "NOTE_CONNECTION_RUNTIME_DATA_DIR",
                        runtime_data_dir.to_string_lossy().to_string(),
                    )
                    .env("NOTE_CONNECTION_PORT", sidecar_runtime.port.to_string())
                    .env(
                        "NOTE_CONNECTION_BRIDGE_PORT",
                        sidecar_runtime.bridge_port.to_string(),
                    )
                    .env(
                        "NOTE_CONNECTION_AUTH_TOKEN",
                        sidecar_runtime.auth_token.clone(),
                    )
                    .env(
                        "NOTE_CONNECTION_ALLOWED_ORIGINS",
                        sidecar_allowed_origins.to_string(),
                    );

                let sidecar_state_handle = app.handle().clone();
                let godot_runtime = sidecar_runtime.clone();
                tauri::async_runtime::spawn(async move {
                    let (mut rx, child) = sidecar_command
                        .spawn()
                        .expect("Failed to spawn Node.js sidecar");

                    if let Ok(mut sidecar_slot) = sidecar_state_handle
                        .state::<ChildProcessState>()
                        .sidecar
                        .lock()
                    {
                        *sidecar_slot = Some(child);
                    }

                    while let Some(event) = rx.recv().await {
                        match event {
                            CommandEvent::Stdout(line) => {
                                let text = String::from_utf8_lossy(&line);
                                println!("[Node Sidecar]: {}", text);
                                let message = text.trim();
                                if !message.is_empty() {
                                    let _ =
                                        sidecar_state_handle.emit("build-log", message.to_string());
                                }
                            }
                            CommandEvent::Stderr(line) => {
                                let text = String::from_utf8_lossy(&line);
                                eprintln!("[Node Sidecar Error]: {}", text);
                                let message = text.trim();
                                if !message.is_empty() {
                                    let _ = sidecar_state_handle
                                        .emit("build-log", format!("ERROR: {}", message));
                                }
                            }
                            CommandEvent::Terminated(payload) => {
                                println!("[Node Sidecar Terminated]: {:?}", payload);
                            }
                            _ => {}
                        }
                    }
                });

                // Spawn Godot process using robust candidate resolution.
                let godot_state_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    let godot_project = resolve_godot_project_path(&project_root);
                    if !godot_project.exists() {
                        eprintln!(
                            "[Rust] Godot project path does not exist: {}",
                            godot_project.to_string_lossy()
                        );
                        return;
                    }

                    match resolve_godot_executable(&project_root) {
                        Some(godot_exe) => {
                            println!(
                                "[Rust] Launching Godot executable: {}",
                                godot_exe.to_string_lossy()
                            );
                            match std::process::Command::new(&godot_exe)
                                .env("NOTE_CONNECTION_PORT", godot_runtime.port.to_string())
                                .env(
                                    "NOTE_CONNECTION_BRIDGE_PORT",
                                    godot_runtime.bridge_port.to_string(),
                                )
                                .env(
                                    "NOTE_CONNECTION_AUTH_TOKEN",
                                    godot_runtime.auth_token.clone(),
                                )
                                .env("NOTE_CONNECTION_START_HIDDEN", "1")
                                .args([
                                    "--path",
                                    godot_project.to_string_lossy().as_ref(),
                                    "--nc-start-hidden",
                                    "--minimized",
                                ])
                                .spawn()
                            {
                                Ok(child) => {
                                    if let Ok(mut godot_slot) = godot_state_handle
                                        .state::<ChildProcessState>()
                                        .godot
                                        .lock()
                                    {
                                        *godot_slot = Some(child);
                                    }
                                    println!("[Rust] Successfully spawned local Godot application.");
                                }
                                Err(e) => {
                                    eprintln!(
                                        "[Rust] Failed to spawn Godot at '{}': {}",
                                        godot_exe.to_string_lossy(),
                                        e
                                    );
                                }
                            }
                        }
                        None => {
                            eprintln!(
                                "[Rust] Godot executable not found. Set NOTE_CONNECTION_GODOT_EXE or place binary under src-tauri/bin."
                            );
                        }
                    }
                });
            }

            #[cfg(target_os = "android")]
            {
                println!("[Rust] Android Knowledge Base Root: {}", kb_root.to_string_lossy());
                println!("[Rust] Android Frontend Root: {}", frontend_dir.to_string_lossy());
                println!(
                    "[Rust] Android Runtime Data Root: {}",
                    runtime_data_dir.to_string_lossy()
                );
                println!(
                    "[Rust] Android startup: desktop sidecar and Godot launch are intentionally disabled."
                );
            }
             
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::MutexGuard;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    fn lock_test_env() -> MutexGuard<'static, ()> {
        test_env_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn canonical_path_for_compare(path: &Path) -> String {
        let normalized =
            normalize_display_path(fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf()));
        let mut key = normalized.to_string_lossy().replace('\\', "/");
        while key.ends_with('/') {
            key.pop();
        }
        #[cfg(windows)]
        {
            key = key.to_ascii_lowercase();
        }
        key
    }

    fn assert_paths_equivalent(actual: &str, expected: &Path) {
        let actual_key = canonical_path_for_compare(Path::new(actual));
        let expected_key = canonical_path_for_compare(expected);
        assert_eq!(actual_key, expected_key);
    }

    struct EnvVarGuard {
        key: &'static str,
        old_value: Option<String>,
    }

    impl EnvVarGuard {
        fn set(key: &'static str, value: &str) -> Self {
            let old_value = std::env::var(key).ok();
            std::env::set_var(key, value);
            Self { key, old_value }
        }
    }

    impl Drop for EnvVarGuard {
        fn drop(&mut self) {
            match &self.old_value {
                Some(value) => std::env::set_var(self.key, value),
                None => std::env::remove_var(self.key),
            }
        }
    }

    struct TempDir {
        path: PathBuf,
    }

    impl TempDir {
        fn new(prefix: &str) -> Self {
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system time is before unix epoch")
                .as_nanos();

            let mut path = std::env::temp_dir();
            path.push(format!(
                "noteconnection_{}_{}_{}",
                prefix,
                std::process::id(),
                now
            ));
            fs::create_dir_all(&path).expect("failed to create temp directory");
            let canonical = normalize_display_path(
                fs::canonicalize(&path).unwrap_or_else(|_| path.clone()),
            );
            Self { path: canonical }
        }

        fn child(&self, relative: &str) -> PathBuf {
            self.path.join(relative)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    #[test]
    fn sanitize_target_name_replaces_unsafe_characters() {
        let sanitized = sanitize_target_name("fi*n@ncial/2026");
        assert_eq!(sanitized, "fi_n_ncial_2026");
    }

    #[test]
    fn normalize_menu_lang_supports_zh_and_defaults_to_en() {
        assert_eq!(normalize_menu_lang("zh"), "zh");
        assert_eq!(normalize_menu_lang("en"), "en");
        assert_eq!(normalize_menu_lang("zh-CN"), "en");
        assert_eq!(normalize_menu_lang("anything-else"), "en");
    }

    #[test]
    fn parse_cached_target_from_file_name_handles_supported_patterns() {
        assert_eq!(
            parse_cached_target_from_file_name("data_financial.js"),
            Some("financial".to_string())
        );
        assert_eq!(
            parse_cached_target_from_file_name("graph_data_robotics.json"),
            Some("robotics".to_string())
        );

        assert_eq!(parse_cached_target_from_file_name("data.js"), None);
        assert_eq!(parse_cached_target_from_file_name("graph_data.json"), None);
        assert_eq!(
            parse_cached_target_from_file_name("data_cli_financial_20260302.js"),
            None
        );
        assert_eq!(
            parse_cached_target_from_file_name("graph_data_cli_financial_20260302.json"),
            None
        );
    }

    #[test]
    fn collect_available_targets_merges_kb_folders_and_cached_targets() {
        let kb_temp = TempDir::new("available_targets_kb");
        let runtime_temp = TempDir::new("available_targets_runtime");
        let frontend_temp = TempDir::new("available_targets_frontend");

        fs::create_dir_all(kb_temp.child("financial")).expect("failed to create kb financial folder");
        fs::create_dir_all(kb_temp.child("legal")).expect("failed to create kb legal folder");

        fs::write(
            runtime_temp.child("data_financial.js"),
            b"const graphData = {\"nodes\":[]};",
        )
        .expect("failed to write runtime data_financial.js");
        fs::write(
            runtime_temp.child("graph_data_research.json"),
            br#"{"nodes":[]}"#,
        )
        .expect("failed to write runtime graph_data_research.json");
        fs::write(
            runtime_temp.child("data_cli_financial_20260302.js"),
            b"const graphData = {\"nodes\":[]};",
        )
        .expect("failed to write runtime data_cli file");

        fs::write(
            frontend_temp.child("data_financial.js"),
            b"const graphData = {\"nodes\":[]};",
        )
        .expect("failed to write frontend duplicate cache file");
        fs::write(
            frontend_temp.child("data_biology.js"),
            b"const graphData = {\"nodes\":[]};",
        )
        .expect("failed to write frontend data_biology.js");

        let targets = collect_available_targets(&kb_temp.path, &runtime_temp.path, &frontend_temp.path);
        assert_eq!(
            targets,
            vec![
                "biology".to_string(),
                "financial".to_string(),
                "legal".to_string(),
                "research".to_string()
            ]
        );
    }

    #[test]
    fn runtime_capabilities_match_target_profile() {
        let caps = get_runtime_capabilities();

        if cfg!(target_os = "android") {
            assert_eq!(caps.platform, "android");
            assert!(!caps.supports_sidecar);
            assert!(caps.supports_build);
            assert!(caps.supports_content_api);
            assert!(!caps.supports_kb_runtime_change);
            assert!(caps.supports_native_pathmode);
        } else {
            assert!(caps.supports_sidecar);
            assert!(caps.supports_build);
            assert!(caps.supports_content_api);
            assert!(caps.supports_kb_runtime_change);
            assert!(!caps.supports_native_pathmode);
        }
    }

    #[test]
    fn kb_path_and_language_persist_and_resolve() {
        let _lock = lock_test_env();
        let temp = TempDir::new("config_roundtrip");
        let config_file = temp.child("kb_config.json");
        let kb_dir = temp.child("Knowledge_Base");
        fs::create_dir_all(&kb_dir).expect("failed to create kb directory");

        let _config_guard = EnvVarGuard::set(
            "NOTE_CONNECTION_CONFIG_PATH",
            config_file.to_string_lossy().as_ref(),
        );

        let persisted_kb = persist_kb_path(kb_dir.to_string_lossy().as_ref())
            .expect("persist_kb_path should succeed");
        assert_paths_equivalent(&persisted_kb, &kb_dir);

        assert_paths_equivalent(&resolve_kb_path_from_config(), &kb_dir);
        assert_eq!(resolve_user_language_from_config(), "en");

        let persisted_lang = persist_user_language("zh").expect("persist_user_language should work");
        assert_eq!(persisted_lang, "zh");
        assert_eq!(resolve_user_language_from_config(), "zh");
    }

    #[test]
    fn persist_kb_path_normalizes_path_inside_knowledge_base() {
        let _lock = lock_test_env();
        let temp = TempDir::new("kb_normalize_persist");
        let config_file = temp.child("kb_config.json");
        let kb_dir = temp.child("Knowledge_Base");
        let nested_dir = kb_dir.join("financial");

        fs::create_dir_all(&nested_dir).expect("failed to create nested kb directory");
        let _config_guard = EnvVarGuard::set(
            "NOTE_CONNECTION_CONFIG_PATH",
            config_file.to_string_lossy().as_ref(),
        );

        let persisted = persist_kb_path(nested_dir.to_string_lossy().as_ref())
            .expect("persist_kb_path should normalize to Knowledge_Base root");
        assert_paths_equivalent(&persisted, &kb_dir);
    }

    #[test]
    fn resolve_kb_path_from_config_normalizes_stale_nested_kb_path() {
        let _lock = lock_test_env();
        let temp = TempDir::new("kb_normalize_resolve");
        let config_file = temp.child("kb_config.json");
        let kb_dir = temp.child("Knowledge_Base");
        let nested_dir = kb_dir.join("financial");

        fs::create_dir_all(&nested_dir).expect("failed to create nested kb directory");
        let _config_guard = EnvVarGuard::set(
            "NOTE_CONNECTION_CONFIG_PATH",
            config_file.to_string_lossy().as_ref(),
        );

        fs::write(
            &config_file,
            format!(
                "{{\"knowledgeBasePath\":\"{}\",\"userLanguage\":\"zh\"}}",
                nested_dir.to_string_lossy().replace('\\', "\\\\")
            ),
        )
        .expect("failed to write stale config");

        let resolved = resolve_kb_path_from_config();
        assert_paths_equivalent(&resolved, &kb_dir);

        let refreshed = load_stored_config();
        let refreshed_path = refreshed
            .knowledge_base_path
            .expect("knowledge_base_path should be persisted");
        assert_paths_equivalent(&refreshed_path, &kb_dir);
    }

    #[test]
    fn persist_kb_path_rejects_non_existing_directory() {
        let _lock = lock_test_env();
        let temp = TempDir::new("invalid_kb");
        let config_file = temp.child("kb_config.json");
        let missing_dir = temp.child("missing_folder");
        let _config_guard = EnvVarGuard::set(
            "NOTE_CONNECTION_CONFIG_PATH",
            config_file.to_string_lossy().as_ref(),
        );

        let result = persist_kb_path(missing_dir.to_string_lossy().as_ref());
        assert!(result.is_err());
    }

    #[test]
    fn read_node_content_supports_absolute_and_relative_paths_within_kb_root() {
        let _lock = lock_test_env();
        let temp = TempDir::new("read_node_content_ok");
        let config_file = temp.child("kb_config.json");
        let kb_dir = temp.child("Knowledge_Base");
        let note_dir = kb_dir.join("financial");
        let note_file = note_dir.join("overview.md");

        fs::create_dir_all(&note_dir).expect("failed to create note directory");
        fs::write(&note_file, "# Financial Overview").expect("failed to write note file");

        let _config_guard = EnvVarGuard::set(
            "NOTE_CONNECTION_CONFIG_PATH",
            config_file.to_string_lossy().as_ref(),
        );
        persist_kb_path(kb_dir.to_string_lossy().as_ref())
            .expect("persist_kb_path should succeed");

        let absolute_result =
            read_node_content(note_file.to_string_lossy().to_string()).expect("absolute read failed");
        assert!(absolute_result.contains("Financial Overview"));

        let relative_result =
            read_node_content("financial/overview.md".to_string()).expect("relative read failed");
        assert!(relative_result.contains("Financial Overview"));

        let windows_style_path = "E:\\legacy\\Knowledge_Base\\financial\\overview.md".to_string();
        let legacy_result =
            read_node_content(windows_style_path).expect("legacy windows-style path read failed");
        assert!(legacy_result.contains("Financial Overview"));
    }

    #[test]
    fn read_node_content_rejects_file_outside_kb_root() {
        let _lock = lock_test_env();
        let temp = TempDir::new("read_node_content_outside");
        let config_file = temp.child("kb_config.json");
        let kb_dir = temp.child("Knowledge_Base");
        let outside_file = temp.child("outside.md");

        fs::create_dir_all(&kb_dir).expect("failed to create kb directory");
        fs::write(&outside_file, "# Outside").expect("failed to write outside file");

        let _config_guard = EnvVarGuard::set(
            "NOTE_CONNECTION_CONFIG_PATH",
            config_file.to_string_lossy().as_ref(),
        );
        persist_kb_path(kb_dir.to_string_lossy().as_ref())
            .expect("persist_kb_path should succeed");

        let err = read_node_content(outside_file.to_string_lossy().to_string())
            .expect_err("expected outside file to be rejected");
        assert!(err.contains("outside configured knowledge base"));
    }

    #[test]
    fn resolve_godot_executable_prefers_env_override_with_real_file() {
        let _lock = lock_test_env();
        let temp = TempDir::new("godot_exec");
        let executable = temp.child("godot-custom");
        fs::write(&executable, b"godot").expect("failed to write executable stub");

        let _exe_guard = EnvVarGuard::set(
            "NOTE_CONNECTION_GODOT_EXE",
            executable.to_string_lossy().as_ref(),
        );

        let resolved = resolve_godot_executable(&temp.path).expect("expected executable path");
        assert_eq!(resolved, executable);
    }

    #[test]
    fn resolve_godot_executable_ignores_wrapper_sized_sidecar_binary() {
        let _lock = lock_test_env();
        let temp = TempDir::new("godot_wrapper_filter");
        let sidecar_dir = temp.child("src-tauri/bin");
        fs::create_dir_all(&sidecar_dir).expect("failed to create sidecar directory");

        let wrapper_like = sidecar_dir.join(host_godot_sidecar_name());
        fs::write(&wrapper_like, b"wrapper").expect("failed to create wrapper-like executable");

        let preferred_alias = host_godot_binary_aliases()
            .first()
            .copied()
            .unwrap_or("godot");
        let real_like = sidecar_dir.join(preferred_alias);
        fs::write(&real_like, vec![0_u8; (GODOT_MIN_BINARY_BYTES + 1) as usize])
            .expect("failed to create real-like executable");

        let _exe_guard = EnvVarGuard::set("NOTE_CONNECTION_GODOT_EXE", "");
        let resolved =
            resolve_godot_executable(&temp.path).expect("expected resolved godot executable");
        assert_eq!(resolved, real_like);
    }

    #[test]
    fn check_cache_for_target_detects_active_and_named_cache_files() {
        let runtime_temp = TempDir::new("cache_check_runtime");
        let frontend_temp = TempDir::new("cache_check_frontend");
        fs::write(runtime_temp.child("data.js"), b"const graphData = {\"nodes\":[]};")
            .expect("failed to create data.js");
        fs::write(
            runtime_temp.child("data_financial.js"),
            b"const graphData = {\"nodes\":[{\"id\":\"A\"}]};",
        )
        .expect("failed to create data_financial.js");

        let active = check_cache_for_target(&runtime_temp.path, &frontend_temp.path, "ALL_FOLDERS")
            .expect("active cache expected");
        assert_eq!(active.get("source").and_then(Value::as_str), Some("active"));

        let target = check_cache_for_target(&runtime_temp.path, &frontend_temp.path, "financial")
            .expect("target cache expected");
        assert_eq!(target.get("source").and_then(Value::as_str), Some("target"));

        assert!(check_cache_for_target(&runtime_temp.path, &frontend_temp.path, "missing").is_none());
        assert!(check_cache_for_target(&runtime_temp.path, &frontend_temp.path, "").is_none());
    }

    #[test]
    fn restore_cache_for_target_copies_js_and_json_artifacts() {
        let runtime_temp = TempDir::new("cache_restore_runtime");
        let frontend_temp = TempDir::new("cache_restore_frontend");
        fs::write(
            runtime_temp.child("data_financial.js"),
            b"const graphData = {\"nodes\":[{\"id\":\"T\"}]};",
        )
        .expect("failed to create cached js");
        fs::write(
            runtime_temp.child("graph_data_financial.json"),
            br#"{"nodes":[{"id":"T"}],"links":[]}"#,
        )
        .expect("failed to create cached json");

        let restored = restore_cache_for_target(&runtime_temp.path, &frontend_temp.path, "financial")
            .expect("restore should not error");
        assert!(restored);
        assert!(runtime_temp.child("data.js").exists());
        assert!(runtime_temp.child("graph_data.json").exists());

        let js =
            fs::read_to_string(runtime_temp.child("data.js")).expect("failed to read restored js");
        assert!(js.contains("\"id\":\"T\""));

        let json = fs::read_to_string(runtime_temp.child("graph_data.json"))
            .expect("failed to read restored json");
        assert!(json.contains("\"id\":\"T\""));
    }

    #[test]
    fn restore_cache_for_target_handles_all_folders_and_missing_targets() {
        let runtime_temp = TempDir::new("cache_restore_all_runtime");
        let frontend_temp = TempDir::new("cache_restore_all_frontend");

        assert!(
            !restore_cache_for_target(&runtime_temp.path, &frontend_temp.path, "ALL_FOLDERS")
                .expect("should return bool")
        );
        assert!(
            !restore_cache_for_target(&runtime_temp.path, &frontend_temp.path, "financial")
                .expect("should return bool")
        );

        fs::write(runtime_temp.child("data.js"), b"const graphData = {\"nodes\":[]};")
            .expect("failed to create data.js");
        assert!(
            restore_cache_for_target(&runtime_temp.path, &frontend_temp.path, "ALL_FOLDERS")
                .expect("should return bool")
        );
    }

    #[test]
    fn bootstrap_runtime_data_copies_generated_assets_only() {
        let runtime_temp = TempDir::new("bootstrap_runtime");
        let frontend_temp = TempDir::new("bootstrap_frontend");

        fs::write(frontend_temp.child("data.js"), b"const graphData = {\"nodes\":[]};")
            .expect("failed to write data.js");
        fs::write(frontend_temp.child("graph_data.json"), br#"{"nodes":[],"edges":[]}"#)
            .expect("failed to write graph_data.json");
        fs::write(frontend_temp.child("app.js"), b"console.log('static app');")
            .expect("failed to write app.js");

        bootstrap_runtime_data(&frontend_temp.path, &runtime_temp.path);

        assert!(runtime_temp.child("data.js").exists());
        assert!(runtime_temp.child("graph_data.json").exists());
        assert!(!runtime_temp.child("app.js").exists());
    }

    #[test]
    fn build_graph_runtime_for_target_writes_active_and_target_cache_assets() {
        let kb_temp = TempDir::new("runtime_build_kb");
        let runtime_temp = TempDir::new("runtime_build_output");

        let kb_root = kb_temp.child("Knowledge_Base");
        let target_dir = kb_root.join("financial");
        fs::create_dir_all(&target_dir).expect("failed to create target directory");
        fs::write(target_dir.join("intro.md"), "# Intro\n[[advanced]]")
            .expect("failed to write intro.md");
        fs::write(target_dir.join("advanced.md"), "# Advanced")
            .expect("failed to write advanced.md");

        let result = build_graph_runtime_for_target(&kb_root, &runtime_temp.path, "financial")
            .expect("build_graph_runtime_for_target should succeed");
        assert!(result.success);
        assert_eq!(result.target, "financial");
        assert_eq!(result.nodes, 2);
        assert_eq!(result.edges, 1);

        let data_js = runtime_temp.child("data.js");
        let graph_json = runtime_temp.child("graph_data.json");
        let cache_js = runtime_temp.child("data_financial.js");
        let cache_json = runtime_temp.child("graph_data_financial.json");
        assert!(data_js.exists());
        assert!(graph_json.exists());
        assert!(cache_js.exists());
        assert!(cache_json.exists());

        let data_js_content = fs::read_to_string(&data_js).expect("failed to read data.js");
        let payload = data_js_content
            .strip_prefix("const graphData = ")
            .expect("data.js should start with graphData assignment")
            .trim_end_matches(';');
        let lite_graph: Value =
            serde_json::from_str(payload).expect("failed to parse data.js payload JSON");
        assert!(lite_graph["nodes"][0].get("content").is_none());

        let full_graph: Value = serde_json::from_str(
            fs::read_to_string(&graph_json)
                .expect("failed to read graph_data.json")
                .as_str(),
        )
        .expect("failed to parse graph_data.json");
        assert!(full_graph["nodes"][0].get("content").is_some());
    }

    #[test]
    fn build_graph_runtime_for_target_rejects_missing_directory() {
        let kb_temp = TempDir::new("runtime_build_missing_kb");
        let runtime_temp = TempDir::new("runtime_build_missing_output");
        let kb_root = kb_temp.child("Knowledge_Base");
        fs::create_dir_all(&kb_root).expect("failed to create kb root");

        let err = build_graph_runtime_for_target(&kb_root, &runtime_temp.path, "does_not_exist")
            .expect_err("missing target should fail");
        assert!(err.contains("Target directory does not exist"));
    }
}








