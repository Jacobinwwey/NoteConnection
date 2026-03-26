# Reference: app_config.toml Schema

This page defines the authoritative `app_config.toml` schema for NoteConnection `v1.6.6+`.

## File Resolution Priority

1. `NOTE_CONNECTION_CONFIG_PATH`
2. `NOTE_CONNECTION_CONFIG_DIR` + `app_config.toml`
3. `%LOCALAPPDATA%/NoteConnection/app_config.toml` (Windows default)

Legacy migration:

- Legacy `kb_config.json` is auto-migrated into TOML.

## Canonical Shape

```toml
knowledge_base_path = "E:/Knowledge_project/NoteConnection_app/Knowledge_Base"
user_language = "en"

[multi_window]
single_window_mode = true
hide_tauri_when_pathmode_opens = true
restore_tauri_when_pathmode_exits = true
confirm_before_full_shutdown_from_godot = true
sync_language = true

[path_mode]
auto_reconstruct = true
retain_history = true
focus_mode = true
background = "belfast_sunset_puresky_4k.exr"
bg_brightness = 1.0
reading_mode = "window"
reader_render_mode = "render"
reader_toggle_source_shortcut = "Ctrl+M"
reader_media_scale = 1.5
reader_debug = false
node_spacing = 240.0

[notemd]
active_provider = "DeepSeek"
developer_mode = false
chunk_word_count = 2800
max_tokens = 4096
max_retries = 3
retry_delay_ms = 1200
auto_mermaid_fix_after_generate = false

[[notemd.providers]]
name = "DeepSeek"
api_key = ""
base_url = "https://api.deepseek.com/v1"
model = "deepseek-reasoner"
temperature = 0.5
api_version = ""
enabled = true
```

## Key Contract Table

| Key | Type | Default | Constraints | Runtime Contract |
|---|---|---|---|---|
| `knowledge_base_path` | `string` | auto KB root | existing directory | Tauri persisted KB root; normalizes subpaths inside `Knowledge_Base` to root. |
| `user_language` | `string` | `"en"` | `"en"` or `"zh"` | Runtime language and menu language source. |
| `multi_window.*` | `bool` | see template | boolean | Governs single-window handoff and shutdown confirmation policy. |
| `path_mode.auto_reconstruct` | `bool` | `true` | boolean | Path reconstruction behavior toggle for Godot runtime. |
| `path_mode.reader_media_scale` | `number` | `1.5` | clamped `[0.1, 3.0]` | Reader media rendering scale in Godot runtime. |
| `path_mode.node_spacing` | `number` | `240` | clamped `[100, 600]` | Node spacing in Godot Path Mode tree render. |
| `notemd.active_provider` | `string` | `"DeepSeek"` | provider name in `[[notemd.providers]]` | Active NoteMD provider used by default tasks. |
| `notemd.providers[]` | array(table) | built-in presets | provider names + config fields | Provider registry used by definition-driven API dispatch. |
| `notemd.max_retries` | `number` | `3` | `>=0` | Retry policy for LLM requests in NoteMD runtime. |
| `notemd.retry_delay_ms` | `number` | `1200` | `>=0` | Base retry delay before exponential backoff. |
| `notemd.api` | table | active provider mirror | optional legacy block | Legacy-compatible mirror retained for older runtimes. |

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

## Related Pages

- [docs/en/app_config.toml_guide.md](../../../en/app_config.toml_guide.md)
