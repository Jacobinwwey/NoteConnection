#[cfg(not(target_os = "android"))]
use tauri_plugin_shell::{process::CommandEvent, ShellExt};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
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

fn normalize_existing_dir(raw_path: &str) -> Option<String> {
    let resolved = PathBuf::from(raw_path);
    if resolved.exists() && resolved.is_dir() {
        return Some(resolved.to_string_lossy().to_string());
    }
    None
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
            return valid;
        }
    }
    ensure_default_kb_root_exists()
}

fn persist_kb_path(kb_path: &str) -> Result<String, String> {
    let resolved = PathBuf::from(kb_path);
    if !resolved.exists() || !resolved.is_dir() {
        return Err(format!("Invalid knowledge base path: {}", kb_path));
    }

    let mut config = load_stored_config();
    config.knowledge_base_path = Some(resolved.to_string_lossy().to_string());
    if config.user_language.is_none() {
        config.user_language = Some("en".to_string());
    }
    save_stored_config(&config)?;
    Ok(resolved.to_string_lossy().to_string())
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

fn ensure_startup_kb_path() -> String {
    let config_path = app_config_path();
    let has_existing_config = config_path.exists();
    let mut config = load_stored_config();

    if let Some(saved) = config.knowledge_base_path.clone() {
        if let Some(valid) = normalize_existing_dir(&saved) {
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

#[cfg(not(target_os = "android"))]
fn resolve_godot_executable(project_root: &Path) -> Option<PathBuf> {
    let exec_dir = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|p| p.to_path_buf()));

    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(env_path) = std::env::var("NOTE_CONNECTION_GODOT_EXE") {
        candidates.push(PathBuf::from(env_path));
    }

    candidates.push(
        project_root
            .join("src-tauri")
            .join("bin")
            .join("godot-x86_64-pc-windows-msvc.exe"),
    );
    candidates.push(project_root.join("src-tauri").join("bin").join("godot.exe"));

    if let Some(dir) = exec_dir {
        candidates.push(dir.join("godot-x86_64-pc-windows-msvc.exe"));
        candidates.push(dir.join("godot.exe"));
        candidates.push(dir.join("bin").join("godot-x86_64-pc-windows-msvc.exe"));
        candidates.push(dir.join("bin").join("godot.exe"));
    }

    candidates.into_iter().find(|candidate| file_has_content(candidate))
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

#[tauri::command]
fn get_kb_path() -> Result<String, String> {
    Ok(resolve_kb_path_from_config())
}

#[tauri::command]
fn set_kb_path(kb_path: String) -> Result<String, String> {
    persist_kb_path(&kb_path)
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

    let doc_item = MenuItemBuilder::with_id("docs", if lang == "zh" { "文档" } else { "Documentation" }).build(app)?;
    let about_item = MenuItemBuilder::with_id("about", if lang == "zh" { "关于" } else { "About" }).build(app)?;

    let help_submenu = SubmenuBuilder::new(app, help)
        .item(&doc_item)
        .separator()
        .item(&about_item)
        .build()?;

    MenuBuilder::new(app)
        .item(&file_submenu)
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
struct RuntimeCapabilities {
    platform: String,
    supports_sidecar: bool,
    supports_build: bool,
    supports_content_api: bool,
    supports_kb_runtime_change: bool,
}

#[tauri::command]
fn get_runtime_capabilities() -> RuntimeCapabilities {
    #[cfg(target_os = "android")]
    {
        return RuntimeCapabilities {
            platform: "android".to_string(),
            supports_sidecar: false,
            supports_build: false,
            supports_content_api: false,
            supports_kb_runtime_change: false,
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
        }
    }
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .manage(ChildProcessState::default())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                shutdown_child_processes(&window.app_handle());
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_kb_path,
            set_kb_path,
            get_folders,
            get_available_targets,
            get_runtime_capabilities,
            set_user_language,
            get_user_language,
            check_cache,
            restore_cache
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
                                if let Err(err) = persist_kb_path(&path_str) {
                                    eprintln!("[Rust] Failed to persist KB path: {}", err);
                                }

                                let _ = app_handle.emit("kb-path-changed", path_str);
                            }
                        }
                        "reset_kb" => {
                            println!("Action: Reset KB");
                            let default_path = ensure_default_kb_root_exists();
                            if let Err(err) = persist_kb_path(&default_path) {
                                eprintln!("[Rust] Failed to persist reset KB path: {}", err);
                            }

                            let _ = app_handle.emit("kb-path-changed", default_path);
                        }
                        "docs" => {
                            println!("Action: Documentation");
                            // Open manual.html in browser or new Tauri window
                        }
                        "about" => {
                            println!("Action: About");
                            let _ = tauri_plugin_dialog::DialogExt::dialog(app_handle)
                                .message("NoteConnection v1.3.0\n\nDeveloped by Jacob\nGitHub: https://github.com/Jacobinwwey")
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
                println!("[Rust] Sidecar Project Root: {}", project_root.to_string_lossy());
                println!("[Rust] Sidecar Knowledge Base Root: {}", kb_root.to_string_lossy());
                println!("[Rust] Sidecar Frontend Root: {}", frontend_dir.to_string_lossy());
                println!(
                    "[Rust] Sidecar Runtime Data Root: {}",
                    runtime_data_dir.to_string_lossy()
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
                    );

                let sidecar_state_handle = app.handle().clone();
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
                                .args(["--path", godot_project.to_string_lossy().as_ref()])
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
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
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
            Self { path }
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
            assert!(!caps.supports_build);
            assert!(!caps.supports_content_api);
            assert!(!caps.supports_kb_runtime_change);
        } else {
            assert!(caps.supports_sidecar);
            assert!(caps.supports_build);
            assert!(caps.supports_content_api);
            assert!(caps.supports_kb_runtime_change);
        }
    }

    #[test]
    fn kb_path_and_language_persist_and_resolve() {
        let _lock = test_env_lock().lock().expect("failed to lock test env");
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
        assert_eq!(persisted_kb, kb_dir.to_string_lossy().to_string());

        assert_eq!(resolve_kb_path_from_config(), kb_dir.to_string_lossy().to_string());
        assert_eq!(resolve_user_language_from_config(), "en");

        let persisted_lang = persist_user_language("zh").expect("persist_user_language should work");
        assert_eq!(persisted_lang, "zh");
        assert_eq!(resolve_user_language_from_config(), "zh");
    }

    #[test]
    fn persist_kb_path_rejects_non_existing_directory() {
        let _lock = test_env_lock().lock().expect("failed to lock test env");
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
    fn resolve_godot_executable_prefers_env_override_with_real_file() {
        let _lock = test_env_lock().lock().expect("failed to lock test env");
        let temp = TempDir::new("godot_exec");
        let executable = temp.child("godot-custom.exe");
        fs::write(&executable, b"godot").expect("failed to write executable stub");

        let _exe_guard = EnvVarGuard::set(
            "NOTE_CONNECTION_GODOT_EXE",
            executable.to_string_lossy().as_ref(),
        );

        let resolved = resolve_godot_executable(&temp.path).expect("expected executable path");
        assert_eq!(resolved, executable);
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
}
