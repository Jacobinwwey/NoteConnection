#[cfg(not(target_os = "android"))]
use tauri_plugin_shell::{process::CommandEvent, ShellExt};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
#[cfg(target_os = "android")]
use jni::objects::{JObject, JString, JValue};
#[cfg(target_os = "android")]
use jni::JavaVM;
#[cfg(target_os = "android")]
use std::io::Read;
#[cfg(not(target_os = "android"))]
use std::net::TcpListener;
#[cfg(not(target_os = "android"))]
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};
use unicode_normalization::UnicodeNormalization;
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

fn write_atomic(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        ensure_directory(parent);
    }
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let temporary_path = path.with_extension(format!(
        "{}.tmp-{}-{}",
        path.extension().and_then(|value| value.to_str()).unwrap_or("payload"),
        std::process::id(),
        nonce
    ));

    fs::write(&temporary_path, content).map_err(|err| {
        format!(
            "Failed to write temporary projection '{}': {}",
            temporary_path.to_string_lossy(),
            err
        )
    })?;

    if let Err(rename_error) = fs::rename(&temporary_path, path) {
        // Windows cannot replace an existing file with rename. Remove only the
        // validated destination and retry; readers never observe a partial file.
        if path.exists() {
            fs::remove_file(path).map_err(|remove_error| {
                format!(
                    "Failed to replace projection '{}': {} (initial rename: {})",
                    path.to_string_lossy(),
                    remove_error,
                    rename_error
                )
            })?;
            fs::rename(&temporary_path, path).map_err(|err| {
                format!(
                    "Failed to finalize projection '{}': {}",
                    path.to_string_lossy(),
                    err
                )
            })?;
        } else {
            let _ = fs::remove_file(&temporary_path);
            return Err(format!(
                "Failed to finalize projection '{}': {}",
                path.to_string_lossy(),
                rename_error
            ));
        }
    }

    Ok(())
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
        base.push("app_config.toml");
        return base;
    }

    let mut base = dirs::data_local_dir().unwrap_or_else(resolve_project_root);
    base.push("NoteConnection");
    ensure_directory(&base);
    base.push("app_config.toml");
    base
}

fn legacy_app_config_path_from(primary_path: &Path) -> PathBuf {
    if let Some(parent) = primary_path.parent() {
        return parent.join("kb_config.json");
    }
    PathBuf::from("kb_config.json")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
struct MultiWindowConfig {
    #[serde(alias = "singleWindowMode")]
    single_window_mode: bool,
    #[serde(alias = "hideTauriWhenPathmodeOpens")]
    hide_tauri_when_pathmode_opens: bool,
    #[serde(alias = "restoreTauriWhenPathmodeExits")]
    restore_tauri_when_pathmode_exits: bool,
    #[serde(alias = "confirmBeforeFullShutdownFromGodot")]
    confirm_before_full_shutdown_from_godot: bool,
    #[serde(alias = "syncLanguage")]
    sync_language: bool,
}

impl Default for MultiWindowConfig {
    fn default() -> Self {
        Self {
            single_window_mode: true,
            hide_tauri_when_pathmode_opens: true,
            restore_tauri_when_pathmode_exits: true,
            confirm_before_full_shutdown_from_godot: true,
            sync_language: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
struct StoredConfig {
    #[serde(alias = "knowledgeBasePath")]
    knowledge_base_path: Option<String>,
    #[serde(alias = "userLanguage")]
    user_language: Option<String>,
    #[serde(alias = "multiWindow")]
    multi_window: MultiWindowConfig,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum StoredConfigFormat {
    Toml,
    Json,
}

fn try_load_stored_config_from_path(path: &Path) -> Option<(StoredConfig, StoredConfigFormat)> {
    if !path.exists() {
        return None;
    }

    let content = match fs::read_to_string(path) {
        Ok(value) => value,
        Err(err) => {
            eprintln!(
                "[Rust] Failed to read config '{}': {}",
                path.to_string_lossy(),
                err
            );
            return None;
        }
    };

    if let Ok(config) = toml::from_str::<StoredConfig>(&content) {
        return Some((config, StoredConfigFormat::Toml));
    }

    if let Ok(config) = serde_json::from_str::<StoredConfig>(&content) {
        return Some((config, StoredConfigFormat::Json));
    }

    eprintln!(
        "[Rust] Failed to parse config '{}': content is neither valid TOML nor legacy JSON.",
        path.to_string_lossy()
    );
    None
}

fn load_stored_config() -> StoredConfig {
    let config_path = app_config_path();
    if let Some((config, format)) = try_load_stored_config_from_path(&config_path) {
        if format != StoredConfigFormat::Toml {
            if let Err(err) = save_stored_config(&config) {
                eprintln!(
                    "[Rust] Failed to migrate config '{}' to TOML: {}",
                    config_path.to_string_lossy(),
                    err
                );
            }
        }
        return config;
    }

    let legacy_path = legacy_app_config_path_from(&config_path);
    if legacy_path != config_path {
        if let Some((config, _format)) = try_load_stored_config_from_path(&legacy_path) {
            if let Err(err) = save_stored_config(&config) {
                eprintln!(
                    "[Rust] Failed to migrate legacy config '{}' to '{}': {}",
                    legacy_path.to_string_lossy(),
                    config_path.to_string_lossy(),
                    err
                );
            }
            return config;
        }
    }

    StoredConfig::default()
}

fn save_stored_config(config: &StoredConfig) -> Result<(), String> {
    let config_path = app_config_path();
    if let Some(parent) = config_path.parent() {
        ensure_directory(parent);
    }

    let mut merged_table = toml::map::Map::new();
    if let Ok(existing_content) = fs::read_to_string(&config_path) {
        if let Ok(existing_value) = toml::from_str::<toml::Value>(&existing_content) {
            if let Some(existing_table) = existing_value.as_table() {
                merged_table = existing_table.clone();
            }
        }
    }

    let config_value = toml::Value::try_from(config).map_err(|err| err.to_string())?;
    let Some(config_table) = config_value.as_table() else {
        return Err("Failed to serialize stored config to TOML table.".to_string());
    };

    for (key, value) in config_table {
        merged_table.insert(key.clone(), value.clone());
    }

    let merged_value = toml::Value::Table(merged_table);
    let content = toml::to_string_pretty(&merged_value).map_err(|err| err.to_string())?;
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct MultiWindowRuntimeConfig {
    single_window_mode: bool,
    hide_tauri_when_pathmode_opens: bool,
    restore_tauri_when_pathmode_exits: bool,
    confirm_before_full_shutdown_from_godot: bool,
    sync_language: bool,
}

impl From<MultiWindowConfig> for MultiWindowRuntimeConfig {
    fn from(config: MultiWindowConfig) -> Self {
        Self {
            single_window_mode: config.single_window_mode,
            hide_tauri_when_pathmode_opens: config.hide_tauri_when_pathmode_opens,
            restore_tauri_when_pathmode_exits: config.restore_tauri_when_pathmode_exits,
            confirm_before_full_shutdown_from_godot: config
                .confirm_before_full_shutdown_from_godot,
            sync_language: config.sync_language,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppRuntimeConfig {
    language: String,
    multi_window: MultiWindowRuntimeConfig,
}

fn resolve_multi_window_config_from_config() -> MultiWindowConfig {
    load_stored_config().multi_window
}

fn resolve_app_runtime_config() -> AppRuntimeConfig {
    let config = load_stored_config();
    let language = normalize_menu_lang(config.user_language.as_deref().unwrap_or("en")).to_string();
    AppRuntimeConfig {
        language,
        multi_window: MultiWindowRuntimeConfig::from(config.multi_window),
    }
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

#[cfg(target_os = "android")]
fn request_android_knowledge_base_picker() -> Result<bool, String> {
    let android_context = ndk_context::android_context();
    if android_context.vm().is_null() || android_context.context().is_null() {
        return Err("Android context is unavailable".to_string());
    }
    let vm = unsafe { JavaVM::from_raw(android_context.vm() as *mut jni::sys::JavaVM) }
        .map_err(|err| format!("Failed to access Android JavaVM: {}", err))?;
    let mut env = vm
        .attach_current_thread()
        .map_err(|err| format!("Failed to attach JNI thread: {}", err))?;
    let bridge_class = env
        .find_class("com/jacobinwwey/noteconnection/KnowledgeBasePickerBridge")
        .map_err(|err| format!("KnowledgeBasePickerBridge class is unavailable: {}", err))?;
    let context_obj = unsafe { JObject::from_raw(android_context.context() as jni::sys::jobject) };
    env.call_static_method(
        bridge_class,
        "requestPick",
        "(Landroid/content/Context;)Z",
        &[JValue::Object(&context_obj)],
    )
    .map_err(|err| format!("Failed to launch Android folder picker: {}", err))?
    .z()
    .map_err(|err| format!("Failed to decode Android folder picker result: {}", err))
}

#[cfg(target_os = "android")]
fn consume_android_knowledge_base_picker_result() -> Result<Option<String>, String> {
    let android_context = ndk_context::android_context();
    if android_context.vm().is_null() || android_context.context().is_null() {
        return Err("Android context is unavailable".to_string());
    }
    let vm = unsafe { JavaVM::from_raw(android_context.vm() as *mut jni::sys::JavaVM) }
        .map_err(|err| format!("Failed to access Android JavaVM: {}", err))?;
    let mut env = vm
        .attach_current_thread()
        .map_err(|err| format!("Failed to attach JNI thread: {}", err))?;
    let bridge_class = env
        .find_class("com/jacobinwwey/noteconnection/KnowledgeBasePickerBridge")
        .map_err(|err| format!("KnowledgeBasePickerBridge class is unavailable: {}", err))?;
    let context_obj = unsafe { JObject::from_raw(android_context.context() as jni::sys::jobject) };
    let result = env
        .call_static_method(
            bridge_class,
            "consumeResult",
            "(Landroid/content/Context;)Ljava/lang/String;",
            &[JValue::Object(&context_obj)],
        )
        .map_err(|err| format!("Failed to consume Android folder picker result: {}", err))?;
    let result_obj = result
        .l()
        .map_err(|err| format!("Failed to decode Android folder picker payload: {}", err))?;
    if result_obj.is_null() {
        return Ok(None);
    }
    let result_string = env
        .get_string(&JString::from(result_obj))
        .map_err(|err| format!("Failed to read Android folder picker payload: {}", err))?
        .to_string_lossy()
        .into_owned();
    Ok(Some(result_string))
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
    let legacy_config_path = legacy_app_config_path_from(&config_path);
    let has_existing_config = config_path.exists() || legacy_config_path.exists();
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
    canonical_id: String,
    label: String,
    relative_no_ext: String,
    cluster_id: String,
    content: String,
    link_targets: Vec<RuntimeLinkTarget>,
    filepath: String,
    source_uri: String,
    revision: String,
    identity_aliases: Vec<String>,
}

#[derive(Debug, Clone)]
struct RuntimeLinkTarget {
    target: String,
    edge_type: String,
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

#[cfg(any(target_os = "android", test))]
const MOBILE_MAX_DOCUMENTS: usize = 5_000;
#[cfg(any(target_os = "android", test))]
const MOBILE_MAX_DOCUMENT_BYTES: u64 = 16 * 1024 * 1024;
#[cfg(any(target_os = "android", test))]
const MOBILE_MAX_TOTAL_INPUT_BYTES: u64 = 64 * 1024 * 1024;
#[cfg(any(target_os = "android", test))]
const MOBILE_MAX_EDGES: usize = 250_000;
#[cfg(any(target_os = "android", test))]
const MOBILE_MAX_DEPTH: usize = 64;

#[cfg(any(target_os = "android", test))]
fn validate_mobile_corpus_budget(document_count: usize, total_bytes: u64) -> Result<(), String> {
    if document_count > MOBILE_MAX_DOCUMENTS {
        return Err(format!(
            "Mobile knowledge base exceeds the document limit ({} > {})",
            document_count, MOBILE_MAX_DOCUMENTS
        ));
    }
    if total_bytes > MOBILE_MAX_TOTAL_INPUT_BYTES {
        return Err(format!(
            "Mobile knowledge base exceeds the input budget ({} bytes > {} bytes)",
            total_bytes, MOBILE_MAX_TOTAL_INPUT_BYTES
        ));
    }
    Ok(())
}

#[cfg(any(target_os = "android", test))]
fn validate_mobile_document_size(file_bytes: u64) -> Result<(), String> {
    if file_bytes > MOBILE_MAX_DOCUMENT_BYTES {
        return Err(format!(
            "Mobile document exceeds the per-file limit ({} bytes > {} bytes)",
            file_bytes, MOBILE_MAX_DOCUMENT_BYTES
        ));
    }
    Ok(())
}

#[cfg(any(target_os = "android", test))]
fn validate_mobile_edge_budget(edge_count: usize) -> Result<(), String> {
    if edge_count > MOBILE_MAX_EDGES {
        return Err(format!(
            "Mobile knowledge base exceeds the edge limit ({} > {})",
            edge_count, MOBILE_MAX_EDGES
        ));
    }
    Ok(())
}

#[cfg(target_os = "android")]
fn read_mobile_markdown_content(path: &Path) -> Result<String, String> {
    let file = fs::File::open(path)
        .map_err(|err| format!("Failed to read '{}': {}", path.to_string_lossy(), err))?;
    let mut bytes = Vec::new();
    file.take(MOBILE_MAX_DOCUMENT_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|err| format!("Failed to read '{}': {}", path.to_string_lossy(), err))?;
    validate_mobile_document_size(bytes.len() as u64).map_err(|error| {
        format!("{}: {}", error, path.to_string_lossy())
    })?;
    String::from_utf8(bytes)
        .map_err(|err| format!("Markdown file '{}' is not valid UTF-8: {}", path.to_string_lossy(), err))
}

fn normalize_path_key(raw: &str) -> String {
    raw.nfc()
        .collect::<String>()
        .replace('\\', "/")
        .trim()
        .trim_matches('/')
        .to_lowercase()
}

fn encode_uri_segment(segment: &str) -> String {
    segment
        .as_bytes()
        .iter()
        .map(|byte| {
            if byte.is_ascii_alphanumeric() || matches!(*byte, b'-' | b'.' | b'_' | b'~') {
                (*byte as char).to_string()
            } else {
                format!("%{:02X}", byte)
            }
        })
        .collect()
}

fn create_mobile_source_uri(relative_path: &str) -> String {
    let canonical_path = normalize_path_key(relative_path);
    let encoded = canonical_path
        .split('/')
        .filter(|segment| !segment.is_empty())
        .map(encode_uri_segment)
        .collect::<Vec<_>>()
        .join("/");
    if encoded.is_empty() {
        String::new()
    } else {
        format!("note://workspace/v1/{}", encoded)
    }
}

fn create_mobile_content_revision(content: &str) -> String {
    let normalized_content = content.nfc().collect::<String>();
    let digest = Sha256::digest(normalized_content.as_bytes());
    format!(
        "sha256:{}",
        digest
            .iter()
            .map(|byte| format!("{:02x}", byte))
            .collect::<String>()
    )
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
    let mut stack: Vec<(PathBuf, usize)> = vec![(root.to_path_buf(), 0)];
    #[cfg(target_os = "android")]
    let mut total_input_bytes = 0u64;

    while let Some((dir, depth)) = stack.pop() {
        let entries = fs::read_dir(&dir)
            .map_err(|err| format!("Failed to scan directory '{}': {}", dir.to_string_lossy(), err))?;

        for entry in entries.flatten() {
            let path = entry.path();
            let file_type = entry
                .file_type()
                .map_err(|err| format!("Failed to inspect '{}': {}", path.to_string_lossy(), err))?;

            if file_type.is_dir() {
                #[cfg(target_os = "android")]
                if depth >= MOBILE_MAX_DEPTH {
                    return Err(format!(
                        "Mobile knowledge base exceeds the directory depth limit ({})",
                        MOBILE_MAX_DEPTH
                    ));
                }
                stack.push((path, depth + 1));
            } else if file_type.is_file() && is_markdown_file(&path) {
                #[cfg(target_os = "android")]
                {
                    if files.len() >= MOBILE_MAX_DOCUMENTS {
                        return Err(format!(
                            "Mobile knowledge base exceeds the document limit ({})",
                            MOBILE_MAX_DOCUMENTS
                        ));
                    }
                    let file_bytes = fs::metadata(&path)
                        .map_err(|err| format!("Failed to inspect '{}': {}", path.to_string_lossy(), err))?
                        .len();
                    validate_mobile_document_size(file_bytes).map_err(|error| {
                        format!("{}: {}", error, path.to_string_lossy())
                    })?;
                    total_input_bytes = total_input_bytes
                        .checked_add(file_bytes)
                        .ok_or_else(|| "Mobile knowledge base input size overflowed".to_string())?;
                    validate_mobile_corpus_budget(files.len() + 1, total_input_bytes)?;
                }
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

fn parse_frontmatter_link_value(raw: &str) -> Vec<String> {
    let mut value = raw.trim();
    if value.is_empty() || value.starts_with('#') {
        return Vec::new();
    }
    if value.starts_with('[') && value.ends_with(']') {
        value = value[1..value.len() - 1].trim();
        return value
            .split(',')
            .flat_map(parse_frontmatter_link_value)
            .collect();
    }
    let unquoted = value.trim_matches(['"', '\''].as_ref()).trim();
    let unwrapped = unquoted
        .strip_prefix("[[")
        .and_then(|item| item.strip_suffix("]]"))
        .unwrap_or(unquoted)
        .trim();
    if unwrapped.is_empty() {
        Vec::new()
    } else {
        vec![unwrapped.to_string()]
    }
}

fn extract_frontmatter_link_targets(content: &str, field: &str) -> Vec<String> {
    let mut lines = content.lines();
    if lines.next().map(str::trim) != Some("---") {
        return Vec::new();
    }

    let mut active_list = false;
    let mut targets = Vec::new();
    for line in lines {
        let trimmed = line.trim();
        if trimmed == "---" {
            break;
        }
        if let Some(value) = trimmed.strip_prefix(format!("{}:", field).as_str()) {
            targets.extend(parse_frontmatter_link_value(value));
            active_list = value.trim().is_empty();
            continue;
        }
        if active_list {
            if let Some(value) = trimmed.strip_prefix('-') {
                targets.extend(parse_frontmatter_link_value(value));
                continue;
            }
            if !trimmed.is_empty() {
                active_list = false;
            }
        }
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
    #[cfg(target_os = "android")]
    let mut actual_total_input_bytes = 0u64;

    for file_path in markdown_files {
        #[cfg(target_os = "android")]
        let content = read_mobile_markdown_content(&file_path)?;
        #[cfg(not(target_os = "android"))]
        let content = fs::read_to_string(&file_path)
            .map_err(|err| format!("Failed to read '{}': {}", file_path.to_string_lossy(), err))?;
        #[cfg(target_os = "android")]
        {
            actual_total_input_bytes = actual_total_input_bytes
                .checked_add(content.as_bytes().len() as u64)
                .ok_or_else(|| "Mobile knowledge base input size overflowed while reading".to_string())?;
            validate_mobile_corpus_budget(node_drafts.len() + 1, actual_total_input_bytes)?;
        }
        let relative_from_kb = file_path
            .strip_prefix(kb_root)
            .map_err(|err| format!("Failed to normalize file path '{}': {}", file_path.to_string_lossy(), err))?
            .to_path_buf();

        let relative_path = relative_from_kb.to_string_lossy().replace('\\', "/");
        let relative_without_ext = strip_markdown_extension(relative_path.as_str());
        let relative_key = normalize_path_key(&relative_without_ext);
        let id = relative_without_ext.clone();
        let canonical_id = relative_key.clone();
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

        id_by_relative_key.insert(relative_key.clone(), id.clone());
        stem_to_ids
            .entry(stem_key.clone())
            .or_default()
            .push(id.clone());

        let mut link_targets: Vec<RuntimeLinkTarget> = extract_wiki_link_targets(&content)
            .into_iter()
            .map(|target| RuntimeLinkTarget {
                target,
                edge_type: "wiki-link".to_string(),
            })
            .collect();
        link_targets.extend(extract_markdown_link_targets(&content).into_iter().map(|target| {
            RuntimeLinkTarget {
                target,
                edge_type: "markdown-link".to_string(),
            }
        }));
        link_targets.extend(
            extract_frontmatter_link_targets(&content, "prerequisites")
                .into_iter()
                .map(|target| RuntimeLinkTarget {
                    target,
                    edge_type: "explicit-prerequisite".to_string(),
                }),
        );
        link_targets.extend(
            extract_frontmatter_link_targets(&content, "next")
                .into_iter()
                .map(|target| RuntimeLinkTarget {
                    target,
                    edge_type: "explicit-next".to_string(),
                }),
        );
        let source_uri = create_mobile_source_uri(relative_path.as_str());
        let revision = create_mobile_content_revision(&content);
        let mut identity_aliases = Vec::new();
        for alias in [
            id.clone(),
            format!("{}.md", id),
            relative_without_ext.clone(),
            relative_key.clone(),
        ] {
            if !alias.is_empty() && !identity_aliases.contains(&alias) {
                identity_aliases.push(alias);
            }
        }

        // Android emits a body-free graph, so do not retain the corpus in the
        // intermediate draft while the link index is being resolved.
        let retained_content = if cfg!(target_os = "android") {
            String::new()
        } else {
            content
        };

        node_drafts.push(RuntimeNodeDraft {
            id,
            canonical_id,
            label,
            relative_no_ext: relative_without_ext,
            cluster_id,
            content: retained_content,
            link_targets,
            filepath,
            source_uri,
            revision,
            identity_aliases,
        });
    }

    let mut id_by_unique_stem: HashMap<String, String> = HashMap::new();
    for (stem, ids) in stem_to_ids {
        if ids.len() == 1 {
            id_by_unique_stem.insert(stem, ids[0].clone());
        }
    }

    let mut unique_edges: BTreeSet<(String, String, String)> = BTreeSet::new();
    for node in &node_drafts {
        for link_target in &node.link_targets {
            let Some(reference) = sanitize_reference_target(&link_target.target) else {
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

            let (edge_source, edge_target) = if link_target.edge_type == "explicit-prerequisite" {
                (target_id, node.id.clone())
            } else {
                (node.id.clone(), target_id)
            };
            if edge_source != edge_target {
                unique_edges.insert((edge_source, edge_target, link_target.edge_type.clone()));
                #[cfg(target_os = "android")]
                validate_mobile_edge_budget(unique_edges.len())?;
            }
        }
    }

    let mut in_degree: HashMap<String, usize> = HashMap::new();
    let mut out_degree: HashMap<String, usize> = HashMap::new();
    let source_uri_by_id: HashMap<String, String> = node_drafts
        .iter()
        .map(|node| (node.id.clone(), node.source_uri.clone()))
        .collect();
    for (source, target, _) in &unique_edges {
        *out_degree.entry(source.clone()).or_insert(0) += 1;
        *in_degree.entry(target.clone()).or_insert(0) += 1;
    }

    #[cfg(not(target_os = "android"))]
    let full_nodes: Vec<Value> = node_drafts
        .iter()
        .map(|node| {
            let in_count = *in_degree.get(&node.id).unwrap_or(&0);
            let out_count = *out_degree.get(&node.id).unwrap_or(&0);
            json!({
                "id": node.id.clone(),
                "canonicalId": node.canonical_id.clone(),
                "label": node.label.clone(),
                "sourceUri": node.source_uri.clone(),
                "revision": node.revision.clone(),
                "identityAliases": node.identity_aliases.clone(),
                "evidenceRefs": Vec::<String>::new(),
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
                "canonicalId": node.canonical_id.clone(),
                "label": node.label.clone(),
                "sourceUri": node.source_uri.clone(),
                "revision": node.revision.clone(),
                "identityAliases": node.identity_aliases.clone(),
                "evidenceRefs": Vec::<String>::new(),
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
        .map(|(source, target, edge_type)| {
            json!({
                "source": source,
                "target": target,
                "sourceUri": source_uri_by_id.get(source).cloned().unwrap_or_default(),
                "targetUri": source_uri_by_id.get(target).cloned().unwrap_or_default(),
                "type": edge_type,
                "kind": "explicit",
                "provenance": edge_type,
                "evidenceRefs": Vec::<String>::new(),
                "weight": 1.0
            })
        })
        .collect();

    let mut adjacency_by_id: BTreeMap<String, (Vec<String>, Vec<String>)> = node_drafts
        .iter()
        .map(|node| (node.id.clone(), (Vec::new(), Vec::new())))
        .collect();
    for (source, target, _) in &unique_edges {
        if let Some((outgoing, _)) = adjacency_by_id.get_mut(source) {
            if outgoing.len() < 64 && !outgoing.contains(target) {
                outgoing.push(target.clone());
            }
        }
        if let Some((_, incoming)) = adjacency_by_id.get_mut(target) {
            if incoming.len() < 64 && !incoming.contains(source) {
                incoming.push(source.clone());
            }
        }
    }
    let adjacency: Vec<Value> = adjacency_by_id
        .into_iter()
        .map(|(node_id, (outgoing, incoming))| json!({
            "nodeId": node_id,
            "outgoing": outgoing,
            "incoming": incoming,
        }))
        .collect();

    #[cfg(not(target_os = "android"))]
    let full_graph = json!({
        "schemaVersion": 1,
        "projectionVersion": 1,
        "workspaceId": "tauri-workspace",
        "nodes": full_nodes,
        "edges": edges.clone(),
        "adjacency": adjacency.clone(),
    });
    let lite_graph = json!({
        "schemaVersion": 1,
        "projectionVersion": 1,
        "workspaceId": "tauri-workspace",
        "nodes": lite_nodes,
        "edges": edges,
        "adjacency": adjacency,
    });

    #[cfg(target_os = "android")]
    let persisted_graph = &lite_graph;
    #[cfg(not(target_os = "android"))]
    let persisted_graph = &full_graph;

    ensure_directory(runtime_data_dir);
    let graph_json_path = runtime_data_dir.join("graph_data.json");
    let data_js_path = runtime_data_dir.join("data.js");

    write_atomic(
        &graph_json_path,
        serde_json::to_string_pretty(persisted_graph)
            .map_err(|err| format!("Failed to serialize graph_data.json: {}", err))?
            .as_str(),
    )?;
    let data_js = format!(
        "const graphData = {};",
        serde_json::to_string(&lite_graph)
            .map_err(|err| format!("Failed to serialize data.js payload: {}", err))?
    );
    write_atomic(&data_js_path, data_js.as_str())?;

    if !is_all_targets {
        let sanitized = sanitize_target_name(target_trimmed);
        let cache_js_path = runtime_data_dir.join(format!("data_{}.js", sanitized));
        let cache_json_path = runtime_data_dir.join(format!("graph_data_{}.json", sanitized));

        let cache_js = format!(
            "const graphData = {};",
            serde_json::to_string(&lite_graph)
                .map_err(|err| format!("Failed to serialize cache data payload: {}", err))?
        );
        write_atomic(&cache_js_path, cache_js.as_str())?;
        let cache_json = serde_json::to_string_pretty(persisted_graph)
            .map_err(|err| format!("Failed to serialize cache graph payload: {}", err))?;
        write_atomic(&cache_json_path, cache_json.as_str())?;
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

#[tauri::command]
fn request_kb_path_change() -> Result<KnowledgeBasePathChangeResult, String> {
    #[cfg(target_os = "android")]
    {
        let launched = request_android_knowledge_base_picker()?;
        return Ok(KnowledgeBasePathChangeResult {
            status: if launched { "pending" } else { "unavailable" }.to_string(),
            path: None,
            detail: if launched { None } else { Some("Android folder picker did not launch".to_string()) },
        });
    }

    #[cfg(not(target_os = "android"))]
    {
        let current_kb = resolve_kb_path_from_config();
        if let Some(folder) = pick_knowledge_base_folder(&current_kb, "Select Knowledge Base Folder") {
            let selected = folder.to_string_lossy().to_string();
            let persisted = persist_kb_path(selected.as_str())?;
            return Ok(KnowledgeBasePathChangeResult {
                status: "completed".to_string(),
                path: Some(persisted),
                detail: None,
            });
        }
        Ok(KnowledgeBasePathChangeResult {
            status: "cancelled".to_string(),
            path: None,
            detail: None,
        })
    }
}

#[tauri::command]
fn poll_kb_path_change() -> Result<KnowledgeBasePathChangeResult, String> {
    #[cfg(target_os = "android")]
    {
        let Some(serialized) = consume_android_knowledge_base_picker_result()? else {
            return Ok(KnowledgeBasePathChangeResult {
                status: "pending".to_string(),
                path: None,
                detail: None,
            });
        };
        let payload: Value = serde_json::from_str(&serialized)
            .map_err(|err| format!("Invalid Android folder picker result: {}", err))?;
        let status = payload
            .get("status")
            .and_then(Value::as_str)
            .unwrap_or("failed")
            .to_string();
        let detail = payload
            .get("detail")
            .and_then(Value::as_str)
            .map(str::to_string);
        if status == "completed" {
            let path = payload
                .get("path")
                .and_then(Value::as_str)
                .ok_or_else(|| "Android folder picker completed without an app-local path".to_string())?;
            let persisted = persist_kb_path(path)?;
            return Ok(KnowledgeBasePathChangeResult {
                status,
                path: Some(persisted),
                detail,
            });
        }
        return Ok(KnowledgeBasePathChangeResult {
            status,
            path: None,
            detail,
        });
    }

    #[cfg(not(target_os = "android"))]
    {
        Ok(KnowledgeBasePathChangeResult {
            status: "unsupported".to_string(),
            path: None,
            detail: None,
        })
    }
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
fn get_app_runtime_config() -> Result<AppRuntimeConfig, String> {
    Ok(resolve_app_runtime_config())
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
    supports_kb_import: bool,
    kb_import_mode: String,
    supports_projection_store: bool,
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct KnowledgeBasePathChangeResult {
    status: String,
    path: Option<String>,
    detail: Option<String>,
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
            supports_kb_runtime_change: true,
            supports_kb_import: true,
            kb_import_mode: "android-saf-copy".to_string(),
            supports_projection_store: true,
            supports_native_pathmode: option_env!("NOTE_CONNECTION_ANDROID_INCLUDE_GODOT_PATHMODE") == Some("1"),
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
            supports_kb_import: true,
            kb_import_mode: "native-folder".to_string(),
            supports_projection_store: true,
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
        if option_env!("NOTE_CONNECTION_ANDROID_INCLUDE_GODOT_PATHMODE") != Some("1") {
            let _ = request;
            return Ok(NativePathmodeLaunchResult {
                launched: false,
                reason: Some("Native Android Pathmode is disabled in mobile-slim profile".to_string()),
            });
        }
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

#[cfg(not(target_os = "android"))]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct PathmodeWindowTogglePlan {
    send_pathmode_show: bool,
    send_pathmode_hide: bool,
    hide_tauri_main_window: bool,
    show_tauri_main_window: bool,
    focus_tauri_main_window: bool,
}

#[cfg(not(target_os = "android"))]
fn resolve_pathmode_window_toggle_plan(
    show_godot: bool,
    multi_window: &MultiWindowConfig,
) -> PathmodeWindowTogglePlan {
    if show_godot {
        return PathmodeWindowTogglePlan {
            send_pathmode_show: true,
            send_pathmode_hide: false,
            hide_tauri_main_window: multi_window.hide_tauri_when_pathmode_opens,
            show_tauri_main_window: false,
            focus_tauri_main_window: false,
        };
    }

    let should_restore_tauri = multi_window.restore_tauri_when_pathmode_exits;
    PathmodeWindowTogglePlan {
        send_pathmode_show: false,
        send_pathmode_hide: true,
        hide_tauri_main_window: false,
        show_tauri_main_window: should_restore_tauri,
        focus_tauri_main_window: should_restore_tauri,
    }
}

#[cfg(not(target_os = "android"))]
fn build_pathmode_window_toggled_event_payload(
    show_godot: bool,
    multi_window: &MultiWindowConfig,
    plan: PathmodeWindowTogglePlan,
) -> Value {
    json!({
        "showGodot": show_godot,
        "triggeredAtMs": SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .unwrap_or(0),
        "config": {
            "singleWindowMode": multi_window.single_window_mode,
            "hideTauriWhenPathmodeOpens": multi_window.hide_tauri_when_pathmode_opens,
            "restoreTauriWhenPathmodeExits": multi_window.restore_tauri_when_pathmode_exits,
            "confirmBeforeFullShutdownFromGodot": multi_window.confirm_before_full_shutdown_from_godot,
            "syncLanguage": multi_window.sync_language,
        },
        "plan": {
            "sendPathmodeShow": plan.send_pathmode_show,
            "sendPathmodeHide": plan.send_pathmode_hide,
            "hideTauriMainWindow": plan.hide_tauri_main_window,
            "showTauriMainWindow": plan.show_tauri_main_window,
            "focusTauriMainWindow": plan.focus_tauri_main_window,
        }
    })
}

/// Toggle between Tauri main window and Godot PathMode window.
/// When `show_godot` is true, the frontend bridge is expected to request Godot visibility,
/// and Tauri hides only if configured to do so.
/// When `show_godot` is false, the frontend bridge is expected to request Godot hide,
/// and Tauri restores only if configured to do so.
///
/// 切换 Tauri 主窗口与 Godot PathMode 窗口。
/// 当 `show_godot` 为 true 时，前端 bridge 负责请求 Godot 显示，
/// Tauri 是否隐藏由配置决定。
/// 当 `show_godot` 为 false 时，前端 bridge 负责请求 Godot 隐藏，
/// Tauri 是否恢复由配置决定。
#[cfg(not(target_os = "android"))]
fn toggle_pathmode_window_with_runtime<R: tauri::Runtime>(
    app: AppHandle<R>,
    show_godot: bool,
) -> Result<(), String> {
    let main_window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main Tauri window not found".to_string())?;
    let multi_window = resolve_multi_window_config_from_config();
    let plan = resolve_pathmode_window_toggle_plan(show_godot, &multi_window);

    if show_godot {
        if plan.hide_tauri_main_window {
            main_window
                .hide()
                .map_err(|err| format!("Failed to hide Tauri window: {}", err))?;
            println!("[Rust] Tauri window hidden for PathMode.");
        } else {
            println!("[Rust] PathMode requested without hiding Tauri window (config override).");
        }
    } else {
        if plan.show_tauri_main_window {
            main_window
                .show()
                .map_err(|err| format!("Failed to show Tauri window: {}", err))?;
            if plan.focus_tauri_main_window {
                main_window
                    .set_focus()
                    .map_err(|err| format!("Failed to focus Tauri window: {}", err))?;
            }
            println!("[Rust] Tauri window restored from PathMode.");
        } else {
            println!("[Rust] PathMode exit requested without restoring Tauri window (config override).");
        }
    }

    let payload = build_pathmode_window_toggled_event_payload(show_godot, &multi_window, plan);
    if let Err(err) = app.emit("pathmode-window-toggled", payload) {
        eprintln!("[Rust] Failed to emit pathmode-window-toggled event: {}", err);
    }

    Ok(())
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
fn toggle_pathmode_window(app: AppHandle, show_godot: bool) -> Result<(), String> {
    toggle_pathmode_window_with_runtime(app, show_godot)
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

        let app_runtime = resolve_app_runtime_config();
        if app_runtime.multi_window.sync_language {
            let _ = app.emit(
                "app-language-updated",
                json!({
                    "language": app_runtime.language,
                    "multiWindow": app_runtime.multi_window
                }),
            );
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
            request_kb_path_change,
            poll_kb_path_change,
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
            get_app_runtime_config,
            check_cache,
            restore_cache,
            build_graph_runtime,
            read_generated_asset,
            read_node_content
        ])
        .setup(|app| {
            let startup_kb_path = ensure_startup_kb_path();
            #[cfg(not(target_os = "android"))]
            let startup_app_runtime = resolve_app_runtime_config();
            #[cfg(not(target_os = "android"))]
            let startup_lang = startup_app_runtime.language.clone();
            #[cfg(not(target_os = "android"))]
            let startup_multi_window = startup_app_runtime.multi_window.clone();
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
                let godot_single_window_mode = startup_multi_window.single_window_mode;
                let godot_confirm_close_from_window =
                    startup_multi_window.confirm_before_full_shutdown_from_godot;
                let godot_sync_language = startup_multi_window.sync_language;
                let godot_ui_language = startup_lang.clone();
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
                            let mut godot_command = std::process::Command::new(&godot_exe);
                            godot_command
                                .env("NOTE_CONNECTION_PORT", godot_runtime.port.to_string())
                                .env(
                                    "NOTE_CONNECTION_BRIDGE_PORT",
                                    godot_runtime.bridge_port.to_string(),
                                )
                                .env(
                                    "NOTE_CONNECTION_AUTH_TOKEN",
                                    godot_runtime.auth_token.clone(),
                                )
                                .env(
                                    "NOTE_CONNECTION_SINGLE_WINDOW_MODE",
                                    if godot_single_window_mode { "1" } else { "0" },
                                )
                                .env(
                                    "NOTE_CONNECTION_CONFIRM_CLOSE_FROM_GODOT",
                                    if godot_confirm_close_from_window {
                                        "1"
                                    } else {
                                        "0"
                                    },
                                )
                                .env(
                                    "NOTE_CONNECTION_SYNC_LANGUAGE",
                                    if godot_sync_language { "1" } else { "0" },
                                )
                                .env("NOTE_CONNECTION_UI_LANGUAGE", godot_ui_language.clone());

                            #[cfg(target_os = "linux")]
                            {
                                let session_type =
                                    std::env::var("XDG_SESSION_TYPE").unwrap_or_default();
                                if session_type == "wayland" {
                                    godot_command
                                        .env("GDK_BACKEND", "x11")
                                        .env("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
                                }
                            }

                            if godot_single_window_mode {
                                godot_command
                                    .env("NOTE_CONNECTION_START_HIDDEN", "1")
                                    .args([
                                        "--path",
                                        godot_project.to_string_lossy().as_ref(),
                                        "--nc-start-hidden",
                                        "--minimized",
                                    ]);
                            } else {
                                godot_command
                                    .env("NOTE_CONNECTION_START_HIDDEN", "0")
                                    .env("NOTE_CONNECTION_FORCE_VISIBLE", "1")
                                    .args(["--path", godot_project.to_string_lossy().as_ref()]);
                            }

                            match godot_command.spawn() {
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

    #[test]
    fn mobile_corpus_budget_rejects_oversized_document_sets() {
        assert!(validate_mobile_corpus_budget(
            MOBILE_MAX_DOCUMENTS,
            MOBILE_MAX_TOTAL_INPUT_BYTES
        )
        .is_ok());
        assert!(validate_mobile_corpus_budget(MOBILE_MAX_DOCUMENTS + 1, 0).is_err());
        assert!(validate_mobile_corpus_budget(0, MOBILE_MAX_TOTAL_INPUT_BYTES + 1).is_err());
        assert!(validate_mobile_document_size(MOBILE_MAX_DOCUMENT_BYTES).is_ok());
        assert!(validate_mobile_document_size(MOBILE_MAX_DOCUMENT_BYTES + 1).is_err());
        assert!(validate_mobile_edge_budget(MOBILE_MAX_EDGES).is_ok());
        assert!(validate_mobile_edge_budget(MOBILE_MAX_EDGES + 1).is_err());
    }

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
            assert!(caps.supports_kb_runtime_change);
            assert!(caps.supports_kb_import);
            assert_eq!(caps.kb_import_mode, "android-saf-copy");
            assert!(caps.supports_projection_store);
            assert_eq!(
                caps.supports_native_pathmode,
                option_env!("NOTE_CONNECTION_ANDROID_INCLUDE_GODOT_PATHMODE") == Some("1")
            );
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
        let config_file = temp.child("app_config.toml");
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
    fn load_stored_config_migrates_legacy_json_file_to_toml() {
        let _lock = lock_test_env();
        let temp = TempDir::new("legacy_json_to_toml");
        let config_dir = temp.child("config_dir");
        fs::create_dir_all(&config_dir).expect("failed to create config directory");

        let legacy_config_file = config_dir.join("kb_config.json");
        let migrated_config_file = config_dir.join("app_config.toml");
        fs::write(
            &legacy_config_file,
            r#"{"knowledgeBasePath":"E:\\Knowledge_Base","userLanguage":"zh"}"#,
        )
        .expect("failed to write legacy json config");

        let _config_dir_guard = EnvVarGuard::set(
            "NOTE_CONNECTION_CONFIG_DIR",
            config_dir.to_string_lossy().as_ref(),
        );

        let loaded = load_stored_config();
        assert_eq!(loaded.user_language.as_deref(), Some("zh"));
        assert!(migrated_config_file.exists());

        let migrated_content =
            fs::read_to_string(&migrated_config_file).expect("failed to read migrated toml config");
        assert!(migrated_content.contains("user_language = \"zh\""));
        assert!(migrated_content.contains("[multi_window]"));
    }

    #[test]
    fn app_runtime_config_reflects_toml_multi_window_settings() {
        let _lock = lock_test_env();
        let temp = TempDir::new("runtime_config_from_toml");
        let config_file = temp.child("app_config.toml");

        fs::write(
            &config_file,
            r#"
knowledge_base_path = "E:/Knowledge_Base"
user_language = "zh"

[multi_window]
single_window_mode = false
hide_tauri_when_pathmode_opens = false
restore_tauri_when_pathmode_exits = true
confirm_before_full_shutdown_from_godot = false
sync_language = true
"#,
        )
        .expect("failed to write app_config.toml");

        let _config_guard = EnvVarGuard::set(
            "NOTE_CONNECTION_CONFIG_PATH",
            config_file.to_string_lossy().as_ref(),
        );

        let runtime_config = get_app_runtime_config().expect("get_app_runtime_config should succeed");
        assert_eq!(runtime_config.language, "zh");
        assert!(!runtime_config.multi_window.single_window_mode);
        assert!(!runtime_config.multi_window.hide_tauri_when_pathmode_opens);
        assert!(runtime_config.multi_window.restore_tauri_when_pathmode_exits);
        assert!(!runtime_config.multi_window.confirm_before_full_shutdown_from_godot);
        assert!(runtime_config.multi_window.sync_language);
    }

    #[cfg(not(target_os = "android"))]
    #[test]
    fn pathmode_window_toggle_plan_decouples_godot_signal_from_tauri_hide_restore_flags() {
        let config = MultiWindowConfig {
            single_window_mode: false,
            hide_tauri_when_pathmode_opens: false,
            restore_tauri_when_pathmode_exits: false,
            confirm_before_full_shutdown_from_godot: true,
            sync_language: true,
        };

        let open_plan = resolve_pathmode_window_toggle_plan(true, &config);
        assert!(open_plan.send_pathmode_show);
        assert!(!open_plan.send_pathmode_hide);
        assert!(!open_plan.hide_tauri_main_window);
        assert!(!open_plan.show_tauri_main_window);
        assert!(!open_plan.focus_tauri_main_window);

        let exit_plan = resolve_pathmode_window_toggle_plan(false, &config);
        assert!(!exit_plan.send_pathmode_show);
        assert!(exit_plan.send_pathmode_hide);
        assert!(!exit_plan.hide_tauri_main_window);
        assert!(!exit_plan.show_tauri_main_window);
        assert!(!exit_plan.focus_tauri_main_window);
    }

    #[cfg(not(target_os = "android"))]
    #[test]
    fn pathmode_window_toggle_plan_restores_tauri_focus_when_restore_policy_is_enabled() {
        let config = MultiWindowConfig {
            single_window_mode: true,
            hide_tauri_when_pathmode_opens: true,
            restore_tauri_when_pathmode_exits: true,
            confirm_before_full_shutdown_from_godot: true,
            sync_language: true,
        };

        let open_plan = resolve_pathmode_window_toggle_plan(true, &config);
        assert!(open_plan.send_pathmode_show);
        assert!(open_plan.hide_tauri_main_window);
        assert!(!open_plan.show_tauri_main_window);
        assert!(!open_plan.focus_tauri_main_window);

        let exit_plan = resolve_pathmode_window_toggle_plan(false, &config);
        assert!(exit_plan.send_pathmode_hide);
        assert!(!exit_plan.hide_tauri_main_window);
        assert!(exit_plan.show_tauri_main_window);
        assert!(exit_plan.focus_tauri_main_window);
    }

    #[cfg(not(target_os = "android"))]
    #[test]
    fn pathmode_window_toggled_event_payload_contains_config_and_execution_plan() {
        let config = MultiWindowConfig {
            single_window_mode: true,
            hide_tauri_when_pathmode_opens: true,
            restore_tauri_when_pathmode_exits: false,
            confirm_before_full_shutdown_from_godot: false,
            sync_language: false,
        };
        let plan = resolve_pathmode_window_toggle_plan(true, &config);
        let payload = build_pathmode_window_toggled_event_payload(true, &config, plan);

        assert_eq!(payload.get("showGodot").and_then(Value::as_bool), Some(true));
        assert_eq!(
            payload
                .get("config")
                .and_then(|value| value.get("hideTauriWhenPathmodeOpens"))
                .and_then(Value::as_bool),
            Some(true)
        );
        assert_eq!(
            payload
                .get("config")
                .and_then(|value| value.get("restoreTauriWhenPathmodeExits"))
                .and_then(Value::as_bool),
            Some(false)
        );
        assert_eq!(
            payload
                .get("plan")
                .and_then(|value| value.get("sendPathmodeShow"))
                .and_then(Value::as_bool),
            Some(true)
        );
        assert_eq!(
            payload
                .get("plan")
                .and_then(|value| value.get("hideTauriMainWindow"))
                .and_then(Value::as_bool),
            Some(true)
        );
        assert_eq!(
            payload
                .get("plan")
                .and_then(|value| value.get("showTauriMainWindow"))
                .and_then(Value::as_bool),
            Some(false)
        );
        assert!(
            payload
                .get("triggeredAtMs")
                .and_then(Value::as_u64)
                .is_some()
        );
    }


    #[test]
    fn save_stored_config_preserves_unknown_toml_sections() {
        let _lock = lock_test_env();
        let temp = TempDir::new("preserve_unknown_sections");
        let config_file = temp.child("app_config.toml");

        fs::write(
            &config_file,
            r#"
knowledge_base_path = "E:/Knowledge_Base"
user_language = "en"

[multi_window]
single_window_mode = true
hide_tauri_when_pathmode_opens = true
restore_tauri_when_pathmode_exits = true
confirm_before_full_shutdown_from_godot = true
sync_language = true

[notemd]
developer_mode = true
chunk_word_count = 2800

[path_mode]
auto_reconstruct = true
reader_media_scale = 1.5
"#,
        )
        .expect("failed to write seed app_config.toml");

        let _config_guard = EnvVarGuard::set(
            "NOTE_CONNECTION_CONFIG_PATH",
            config_file.to_string_lossy().as_ref(),
        );

        let persisted_lang = persist_user_language("zh").expect("persist_user_language should work");
        assert_eq!(persisted_lang, "zh");

        let updated = fs::read_to_string(&config_file).expect("failed to read updated config");
        assert!(updated.contains("user_language = \"zh\""));
        assert!(updated.contains("[notemd]"));
        assert!(updated.contains("developer_mode = true"));
        assert!(updated.contains("[path_mode]"));
        assert!(updated.contains("reader_media_scale = 1.5"));
    }

    #[test]
    fn persist_kb_path_normalizes_path_inside_knowledge_base() {
        let _lock = lock_test_env();
        let temp = TempDir::new("kb_normalize_persist");
        let config_file = temp.child("app_config.toml");
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
        let config_file = temp.child("app_config.toml");
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
        let config_file = temp.child("app_config.toml");
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
        let config_file = temp.child("app_config.toml");
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
        let config_file = temp.child("app_config.toml");
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
        let intro_node = lite_graph["nodes"]
            .as_array()
            .and_then(|nodes| nodes.iter().find(|node| node["id"] == "financial/intro"))
            .expect("intro node should be present");
        assert_eq!(lite_graph["schemaVersion"].as_u64(), Some(1));
        assert_eq!(lite_graph["projectionVersion"].as_u64(), Some(1));
        assert!(intro_node["sourceUri"]
            .as_str()
            .unwrap_or_default()
            .ends_with("/intro.md"));
        assert_eq!(intro_node["canonicalId"].as_str(), Some("financial/intro"));
        assert!(intro_node["revision"]
            .as_str()
            .unwrap_or_default()
            .starts_with("sha256:"));
        assert_eq!(lite_graph["edges"][0]["source"].as_str(), Some("financial/intro"));
        assert_eq!(lite_graph["edges"][0]["target"].as_str(), Some("financial/advanced"));
        assert_eq!(lite_graph["edges"][0]["sourceUri"].as_str(), Some("note://workspace/v1/financial/intro.md"));
        assert_eq!(lite_graph["edges"][0]["targetUri"].as_str(), Some("note://workspace/v1/financial/advanced.md"));
        assert!(lite_graph["adjacency"].is_array());
        assert!(lite_graph["nodes"][0].get("content").is_none());

        let full_graph: Value = serde_json::from_str(
            fs::read_to_string(&graph_json)
                .expect("failed to read graph_data.json")
                .as_str(),
        )
        .expect("failed to parse graph_data.json");
        assert_eq!(full_graph["schemaVersion"].as_u64(), Some(1));
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

    #[test]
    fn mobile_identity_and_frontmatter_edges_match_portable_contract() {
        let kb_temp = TempDir::new("runtime_identity_contract_kb");
        let runtime_temp = TempDir::new("runtime_identity_contract_output");
        let kb_root = kb_temp.child("Knowledge_Base");
        let target_dir = kb_root.join("financial");
        fs::create_dir_all(&target_dir).expect("failed to create target directory");
        fs::write(target_dir.join("base.md"), "# Base").expect("failed to write base.md");
        fs::write(
            target_dir.join("intro.md"),
            "---\nprerequisites:\n  - [[base]]\n---\n# Intro\n[[advanced]]",
        )
        .expect("failed to write intro.md");
        fs::write(target_dir.join("advanced.md"), "# Advanced")
            .expect("failed to write advanced.md");

        build_graph_runtime_for_target(&kb_root, &runtime_temp.path, "financial")
            .expect("identity contract graph build should succeed");
        let data_js = fs::read_to_string(runtime_temp.child("data.js"))
            .expect("failed to read identity contract data");
        let payload = data_js
            .strip_prefix("const graphData = ")
            .expect("data.js should start with graphData assignment")
            .trim_end_matches(';');
        let graph: Value = serde_json::from_str(payload).expect("failed to parse graph payload");
        let edges = graph["edges"].as_array().expect("edges should be an array");
        assert!(edges.iter().any(|edge| {
            edge["source"].as_str() == Some("financial/base")
                && edge["target"].as_str() == Some("financial/intro")
                && edge["type"].as_str() == Some("explicit-prerequisite")
        }));
        assert!(edges.iter().any(|edge| {
            edge["source"].as_str() == Some("financial/intro")
                && edge["target"].as_str() == Some("financial/advanced")
                && edge["type"].as_str() == Some("wiki-link")
        }));
        assert_eq!(
            create_mobile_source_uri("Cafe\u{301}.md"),
            "note://workspace/v1/caf%C3%A9.md"
        );
        assert_eq!(
            create_mobile_content_revision("Cafe\u{301}"),
            create_mobile_content_revision("Caf\u{e9}")
        );
        assert!(create_mobile_content_revision("Caf\u{e9}").starts_with("sha256:"));
    }
}
