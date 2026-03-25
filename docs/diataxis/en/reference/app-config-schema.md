# Reference: app_config.toml Schema

This page defines the authoritative `app_config.toml` runtime schema for NoteConnection `v1.6.0+`.

## File Resolution Priority

1. `NOTE_CONNECTION_CONFIG_PATH`
2. `NOTE_CONNECTION_CONFIG_DIR` + `app_config.toml`
3. `%LOCALAPPDATA%/NoteConnection/app_config.toml` (Windows default)

Legacy file migration:

- Legacy `kb_config.json` in the same config directory is auto-migrated to TOML at startup.

## Schema

```toml
knowledge_base_path = "E:/Knowledge_project/NoteConnection_app/Knowledge_Base"
user_language = "en"

[multi_window]
single_window_mode = true
hide_tauri_when_pathmode_opens = true
restore_tauri_when_pathmode_exits = true
confirm_before_full_shutdown_from_godot = true
sync_language = true
```

## Key Contract Table

| Key | Type | Default | Constraints | Runtime Contract |
|---|---|---|---|---|
| `knowledge_base_path` | `string` | auto default KB root | must be an existing directory | Persisted KB root. Normalized to `Knowledge_Base` root if path points inside it. |
| `user_language` | `string` | `"en"` | `"en"` or `"zh"` (`"zh-CN"` is not accepted and falls back to `"en"`) | Controls startup language and menu language. |
| `multi_window.single_window_mode` | `bool` | `true` | boolean | Governs single-window startup/handoff policy and Godot launch visibility mode. |
| `multi_window.hide_tauri_when_pathmode_opens` | `bool` | `true` | boolean | If true, `toggle_pathmode_window(show_godot=true)` hides Tauri main window. |
| `multi_window.restore_tauri_when_pathmode_exits` | `bool` | `true` | boolean | If true, `toggle_pathmode_window(show_godot=false)` restores and focuses Tauri window. |
| `multi_window.confirm_before_full_shutdown_from_godot` | `bool` | `true` | boolean | If true, Godot close flow requires confirmation ("return" vs "close all"). |
| `multi_window.sync_language` | `bool` | `true` | boolean | If true, language updates emit runtime sync event payload to frontend windows. |

## Backward-Compatible Aliases

| Canonical | Legacy Alias |
|---|---|
| `knowledge_base_path` | `knowledgeBasePath` |
| `user_language` | `userLanguage` |
| `[multi_window]` | `[multiWindow]` |
| `single_window_mode` | `singleWindowMode` |
| `hide_tauri_when_pathmode_opens` | `hideTauriWhenPathmodeOpens` |
| `restore_tauri_when_pathmode_exits` | `restoreTauriWhenPathmodeExits` |
| `confirm_before_full_shutdown_from_godot` | `confirmBeforeFullShutdownFromGodot` |
| `sync_language` | `syncLanguage` |

## Runtime Projection to Frontend

Frontend hydration uses `invoke('get_app_runtime_config')` and projects values to:

- `window.__NC_APP_CONFIG.language`
- `window.__NC_APP_CONFIG.multiWindow.singleWindowMode`
- `window.__NC_APP_CONFIG.multiWindow.hideTauriWhenPathmodeOpens`
- `window.__NC_APP_CONFIG.multiWindow.restoreTauriWhenPathmodeExits`
- `window.__NC_APP_CONFIG.multiWindow.confirmBeforeFullShutdownFromGodot`
- `window.__NC_APP_CONFIG.multiWindow.syncLanguage`

## Canonical Detailed Sources

- [docs/en/app_config.toml_guide.md](../../../en/app_config.toml_guide.md)
- [docs/en/Interface Document.md](../../../en/Interface%20Document.md)
