use tauri_plugin_shell::{ShellExt, process::CommandEvent};

use std::fs;
use serde_json::Value;
use tauri::{AppHandle, Manager, Emitter};
use tauri::menu::{MenuBuilder, SubmenuBuilder, MenuItemBuilder, PredefinedMenuItem};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

#[tauri::command]
fn get_kb_path() -> Result<String, String> {
    // For now, return the default path or read from a config file.
    // In Electron it was DEFAULT_KB_PATH or from config.json
    // We'll read from Godot/NoteConnection config or return a default.
    let default_path = if cfg!(windows) {
        "D:\\NoteConnection_KB".to_string()
    } else {
        "~/NoteConnection_KB".to_string()
    };
    
    // Attempt to read config if it exists
    let config_path = dirs::config_dir()
        .map(|mut p| { p.push("NoteConnection"); p.push("config.json"); p })
        .unwrap_or_default();
        
    if config_path.exists() {
        if let Ok(content) = fs::read_to_string(config_path) {
            if let Ok(json) = serde_json::from_str::<Value>(&content) {
                if let Some(path) = json.get("kbPath").and_then(|v| v.as_str()) {
                    return Ok(path.to_string());
                }
            }
        }
    }
    
    Ok(default_path)
}

#[tauri::command]
fn get_user_language() -> Result<String, String> {
     // Read from config, default "en", in actual app we read this from user_language localStorage or similar if needed.
     Ok("en".to_string())
}

fn build_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>, lang: &str) -> tauri::Result<tauri::menu::Menu<R>> {
    let file = if lang == "zh" { "文件" } else { "File" };
    let edit = if lang == "zh" { "编辑" } else { "Edit" };
    let view = if lang == "zh" { "视图" } else { "View" };
    let window = if lang == "zh" { "窗口" } else { "Window" };
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
    if target == "ALL_FOLDERS" || target.is_empty() {
        return Ok(None);
    }
    
    let _target_name = target.replace(|c: char| !c.is_ascii_alphanumeric() && c != '_' && c != '-', "_");
    
    // Cache files are currently in the frontend dist dir in Electron.
    // In Tauri, they should probably be in app_data_dir, but for now we follow the existing pattern
    // or just return None to force a rebuild if we can't easily find the frontend dir.
    // Let's look in the current executable dir / frontends for now, or just return None
    // to keep it safe during migration until caching is fully redesigned.
    
    Ok(None)
}

#[tauri::command]
fn restore_cache(_app: AppHandle, _target: String) -> Result<bool, String> {
    // See check_cache
    Ok(false)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_kb_path,
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
                        let default_path = if cfg!(windows) { "D:\\NoteConnection_KB" } else { "~/NoteConnection_KB" };
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

            let sidecar_command = app.shell().sidecar("server").unwrap();
            
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
                let godot_exe = "E:\\网页下载\\Godot_v4.6-stable_win64.exe";
                let project_path = "E:\\Knowledge_project\\NoteConnection_app\\path_mode";
                
                #[cfg(windows)]
                use std::os::windows::process::CommandExt;
                
                let mut cmd = std::process::Command::new(godot_exe);
                cmd.args(["--path", project_path]);
                
                #[cfg(windows)]
                {
                    const DETACHED_PROCESS: u32 = 0x00000008;
                    cmd.creation_flags(DETACHED_PROCESS);
                }
                
                match cmd.spawn() {
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
