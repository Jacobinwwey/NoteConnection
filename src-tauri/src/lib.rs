use tauri_plugin_shell::{process::CommandEvent, ShellExt};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::UNIX_EPOCH;
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager};

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
        let chosen = rfd::FileDialog::new()
            .set_title("Select Knowledge Base Folder")
            .set_directory(&default_path)
            .pick_folder();

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

fn resolve_godot_project_path(project_root: &Path) -> PathBuf {
    if let Ok(custom) = std::env::var("NOTE_CONNECTION_GODOT_PROJECT") {
        let candidate = PathBuf::from(custom);
        if candidate.exists() && candidate.is_dir() {
            return candidate;
        }
    }
    project_root.join("path_mode")
}

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
    candidates.push(PathBuf::from(
        r"E:\网页下载\Godot_v4.6-stable_win64_console.exe",
    ));
    candidates.push(PathBuf::from(r"E:\网页下载\Godot_v4.6-stable_win64.exe"));

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

fn check_cache_for_target(frontend_dir: &Path, target: &str) -> Option<Value> {
    if target.is_empty() {
        return None;
    }

    if target == "ALL_FOLDERS" {
        let active_path = frontend_dir.join("data.js");
        return cache_info_from_file(&active_path, "active");
    }

    let target_name = sanitize_target_name(target);
    let cache_path = frontend_dir.join(format!("data_{}.js", target_name));
    cache_info_from_file(&cache_path, "target")
}

fn restore_cache_for_target(frontend_dir: &Path, target: &str) -> Result<bool, String> {
    if target.is_empty() {
        return Ok(false);
    }

    if target == "ALL_FOLDERS" {
        return Ok(frontend_dir.join("data.js").exists());
    }

    let target_name = sanitize_target_name(target);
    let cache_js = frontend_dir.join(format!("data_{}.js", target_name));
    let target_js = frontend_dir.join("data.js");
    let cache_json = frontend_dir.join(format!("graph_data_{}.json", target_name));
    let target_json = frontend_dir.join("graph_data.json");

    if !cache_js.exists() {
        return Ok(false);
    }

    fs::copy(&cache_js, &target_js).map_err(|e| format!("Failed to copy cache js: {}", e))?;

    if cache_json.exists() {
        fs::copy(&cache_json, &target_json)
            .map_err(|e| format!("Failed to copy cache json: {}", e))?;
    }

    Ok(true)
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

fn build_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>, lang: &str) -> tauri::Result<tauri::menu::Menu<R>> {
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

static MENU_LANG_STATE: OnceLock<Mutex<String>> = OnceLock::new();
struct ChildProcessState {
    sidecar: Mutex<Option<tauri_plugin_shell::process::CommandChild>>,
    godot: Mutex<Option<std::process::Child>>,
}

impl Default for ChildProcessState {
    fn default() -> Self {
        Self {
            sidecar: Mutex::new(None),
            godot: Mutex::new(None),
        }
    }
}

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
    Ok(())
}

#[tauri::command]
fn check_cache(target: String) -> Result<Option<Value>, String> {
    let frontend_dir = resolve_frontend_dist_path();
    Ok(check_cache_for_target(&frontend_dir, &target))
}

#[tauri::command]
fn restore_cache(target: String) -> Result<bool, String> {
    let frontend_dir = resolve_frontend_dist_path();
    restore_cache_for_target(&frontend_dir, &target)
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
            set_user_language,
            get_user_language,
            check_cache,
            restore_cache
        ])
        .setup(|app| {
            let startup_kb_path = ensure_startup_kb_path();
            let startup_lang = resolve_user_language_from_config();

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
                        if let Some(folder) = rfd::FileDialog::new().set_directory(current_kb).pick_folder() {
                            let path_str = folder.to_string_lossy().to_string();
                            println!("Selected KB Path: {}", path_str);
                            if let Err(err) = persist_kb_path(&path_str) {
                                eprintln!("[Rust] Failed to persist KB path: {}", err);
                            }

                            let _ = app_handle.emit("kb-path-changed", path_str);
                        }
                    },
                    "reset_kb" => {
                        println!("Action: Reset KB");
                        let default_path = ensure_default_kb_root_exists();
                        if let Err(err) = persist_kb_path(&default_path) {
                            eprintln!("[Rust] Failed to persist reset KB path: {}", err);
                        }

                        let _ = app_handle.emit("kb-path-changed", default_path);
                    },
                    "docs" => {
                        println!("Action: Documentation");
                        // Open manual.html in browser or new Tauri window
                    },
                    "about" => {
                        println!("Action: About");
                        let _ = tauri_plugin_dialog::DialogExt::dialog(app_handle)
                            .message("NoteConnection v1.3.0\n\nDeveloped by Jacob\nGitHub: https://github.com/Jacobinwwey")
                            .title("About NoteConnection")
                            .show(|_| {});
                    },
                    _ => {}
                }
            });

            let project_root = resolve_project_root();
            let kb_root = PathBuf::from(startup_kb_path.clone());
            let frontend_dir = project_root.join("dist").join("src").join("frontend");

            println!("[Rust] Sidecar Project Root: {}", project_root.to_string_lossy());
            println!("[Rust] Sidecar Knowledge Base Root: {}", kb_root.to_string_lossy());
            println!("[Rust] Sidecar Frontend Root: {}", frontend_dir.to_string_lossy());

            let mut sidecar_command = app.shell().sidecar("server").unwrap();
            sidecar_command = sidecar_command
                .env("NOTE_CONNECTION_PROJECT_ROOT", project_root.to_string_lossy().to_string())
                .env("NOTE_CONNECTION_KB_ROOT", kb_root.to_string_lossy().to_string())
                .env("NOTE_CONNECTION_FRONTEND_DIR", frontend_dir.to_string_lossy().to_string());
            
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
                        },
                        CommandEvent::Stderr(line) => {
                            let text = String::from_utf8_lossy(&line);
                            eprintln!("[Node Sidecar Error]: {}", text);
                        },
                        CommandEvent::Terminated(payload) => {
                            println!("[Node Sidecar Terminated]: {:?}", payload);
                        },
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
        let temp = TempDir::new("cache_check");
        fs::write(temp.child("data.js"), b"const graphData = {\"nodes\":[]};")
            .expect("failed to create data.js");
        fs::write(
            temp.child("data_financial.js"),
            b"const graphData = {\"nodes\":[{\"id\":\"A\"}]};",
        )
        .expect("failed to create data_financial.js");

        let active = check_cache_for_target(&temp.path, "ALL_FOLDERS").expect("active cache expected");
        assert_eq!(active.get("source").and_then(Value::as_str), Some("active"));

        let target = check_cache_for_target(&temp.path, "financial").expect("target cache expected");
        assert_eq!(target.get("source").and_then(Value::as_str), Some("target"));

        assert!(check_cache_for_target(&temp.path, "missing").is_none());
        assert!(check_cache_for_target(&temp.path, "").is_none());
    }

    #[test]
    fn restore_cache_for_target_copies_js_and_json_artifacts() {
        let temp = TempDir::new("cache_restore");
        fs::write(
            temp.child("data_financial.js"),
            b"const graphData = {\"nodes\":[{\"id\":\"T\"}]};",
        )
        .expect("failed to create cached js");
        fs::write(
            temp.child("graph_data_financial.json"),
            br#"{"nodes":[{"id":"T"}],"links":[]}"#,
        )
        .expect("failed to create cached json");

        let restored = restore_cache_for_target(&temp.path, "financial")
            .expect("restore should not error");
        assert!(restored);
        assert!(temp.child("data.js").exists());
        assert!(temp.child("graph_data.json").exists());

        let js = fs::read_to_string(temp.child("data.js")).expect("failed to read restored js");
        assert!(js.contains("\"id\":\"T\""));

        let json =
            fs::read_to_string(temp.child("graph_data.json")).expect("failed to read restored json");
        assert!(json.contains("\"id\":\"T\""));
    }

    #[test]
    fn restore_cache_for_target_handles_all_folders_and_missing_targets() {
        let temp = TempDir::new("cache_restore_all");

        assert!(!restore_cache_for_target(&temp.path, "ALL_FOLDERS").expect("should return bool"));
        assert!(!restore_cache_for_target(&temp.path, "financial").expect("should return bool"));

        fs::write(temp.child("data.js"), b"const graphData = {\"nodes\":[]};")
            .expect("failed to create data.js");
        assert!(restore_cache_for_target(&temp.path, "ALL_FOLDERS").expect("should return bool"));
    }
}
