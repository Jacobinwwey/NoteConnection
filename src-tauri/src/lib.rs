use tauri_plugin_shell::{ShellExt, process::CommandEvent};

use std::fs;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;
use serde_json::{Value, json};
use tauri::{AppHandle, Emitter};
use tauri::menu::{MenuBuilder, SubmenuBuilder, MenuItemBuilder, PredefinedMenuItem};

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

fn resolve_frontend_dist_path() -> PathBuf {
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

#[tauri::command]
fn get_kb_path() -> Result<String, String> {
    Ok(resolve_default_kb_path())
}

#[tauri::command]
fn get_user_language() -> Result<String, String> {
     // Read from config, default "en", in actual app we read this from user_language localStorage or similar if needed.
     Ok("en".to_string())
}

#[tauri::command]
fn get_folders() -> Result<Vec<String>, String> {
    let kb_path = get_kb_path()?;
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

#[tauri::command]
fn set_user_language(app: AppHandle, lang: String) -> Result<(), String> {
    println!("[Rust] Setting user language to: {}", lang);
    if let Ok(menu) = build_menu(&app, &lang) {
        let _ = app.set_menu(menu);
    }
    Ok(())
}

#[tauri::command]
fn check_cache(_app: AppHandle, target: String) -> Result<Option<Value>, String> {
    if target.is_empty() {
        return Ok(None);
    }

    let frontend_dir = resolve_frontend_dist_path();

    if target == "ALL_FOLDERS" {
        let active_path = frontend_dir.join("data.js");
        return Ok(cache_info_from_file(&active_path, "active"));
    }

    let target_name = sanitize_target_name(&target);
    let cache_path = frontend_dir.join(format!("data_{}.js", target_name));
    Ok(cache_info_from_file(&cache_path, "target"))
}

#[tauri::command]
fn restore_cache(_app: AppHandle, target: String) -> Result<bool, String> {
    if target.is_empty() {
        return Ok(false);
    }

    let frontend_dir = resolve_frontend_dist_path();

    if target == "ALL_FOLDERS" {
        return Ok(frontend_dir.join("data.js").exists());
    }

    let target_name = sanitize_target_name(&target);
    let cache_js = frontend_dir.join(format!("data_{}.js", target_name));
    let target_js = frontend_dir.join("data.js");
    let cache_json = frontend_dir.join(format!("graph_data_{}.json", target_name));
    let target_json = frontend_dir.join("graph_data.json");

    if !cache_js.exists() {
        return Ok(false);
    }

    fs::copy(&cache_js, &target_js)
        .map_err(|e| format!("Failed to copy cache js: {}", e))?;

    if cache_json.exists() {
        fs::copy(&cache_json, &target_json)
            .map_err(|e| format!("Failed to copy cache json: {}", e))?;
    }

    Ok(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_kb_path,
            get_folders,
            set_user_language,
            get_user_language,
            check_cache,
            restore_cache
        ])
        .setup(|app| {
            if let Ok(menu) = build_menu(app.handle(), "en") {
                let _ = app.set_menu(menu);
            }
            
            app.on_menu_event(move |app_handle, event| {
                match event.id().as_ref() {
                    "change_kb" => {
                        println!("Action: Change KB");
                        // 1. Open Dialog using rfd
                        if let Some(folder) = rfd::FileDialog::new().pick_folder() {
                            let path_str = folder.to_string_lossy().to_string();
                            println!("Selected KB Path: {}", path_str);
                            
                            // 2. Emit event to frontend
                            let _ = app_handle.emit("kb-path-changed", path_str);
                        }
                    },
                    "reset_kb" => {
                        println!("Action: Reset KB");
                        // Emit reset event
                        let default_path = resolve_default_kb_path();
                            
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
            let kb_root = project_root.join("Knowledge_Base");
            let frontend_dir = project_root.join("dist").join("src").join("frontend");

            println!("[Rust] Sidecar Project Root: {}", project_root.to_string_lossy());
            println!("[Rust] Sidecar Knowledge Base Root: {}", kb_root.to_string_lossy());
            println!("[Rust] Sidecar Frontend Root: {}", frontend_dir.to_string_lossy());

            let mut sidecar_command = app.shell().sidecar("server").unwrap();
            sidecar_command = sidecar_command
                .env("NOTE_CONNECTION_PROJECT_ROOT", project_root.to_string_lossy().to_string())
                .env("NOTE_CONNECTION_KB_ROOT", kb_root.to_string_lossy().to_string())
                .env("NOTE_CONNECTION_FRONTEND_DIR", frontend_dir.to_string_lossy().to_string());
            
            tauri::async_runtime::spawn(async move {
                let (mut rx, _child) = sidecar_command
                    .spawn()
                    .expect("Failed to spawn Node.js sidecar");

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
            
            // Spawn Godot process (User's local executable)
            tauri::async_runtime::spawn(async move {
                let godot_exe = "E:\\网页下载\\Godot_v4.6-stable_win64_console.exe";
                let project_path = "E:\\Knowledge_project\\NoteConnection_app\\path_mode";
                
                match std::process::Command::new(godot_exe).args(["--path", project_path]).spawn() {
                    Ok(_) => {
                        println!("[Rust] Successfully spawned local Godot Application.");
                    },
                    Err(e) => {
                        eprintln!("[Rust] Failed to spawn Godot application at {}: {}", godot_exe, e);
                    }
                }
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
