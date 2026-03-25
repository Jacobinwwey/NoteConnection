# 2026-03-25 v1.6.0

# app_config.toml Guide

This guide explains how to configure NoteConnection runtime behavior through `app_config.toml`.

## 1. What This File Controls

`app_config.toml` controls:

- Knowledge base root path persistence.
- UI language (`en` / `zh`).
- Multi-window runtime policy between Tauri and Godot.

## 2. Where NoteConnection Reads `app_config.toml`

Resolution order (highest priority first):

1. `NOTE_CONNECTION_CONFIG_PATH` (exact file path).
2. `NOTE_CONNECTION_CONFIG_DIR` + `/app_config.toml`.
3. Default path:
   - Windows: `%LOCALAPPDATA%/NoteConnection/app_config.toml`.

Legacy compatibility:

- If `kb_config.json` exists in the same config directory, NoteConnection automatically migrates it to `app_config.toml` at startup.

## 3. Template (Recommended Starting Point)

Use the canonical template:

- [`docs/examples/app_config.template.toml`](../examples/app_config.template.toml)

Quick inline template:

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

## 4. Parameter Semantics and Effects

| Key | Type | Default | Allowed Values | Effect |
|---|---|---|---|---|
| `knowledge_base_path` | `string` | auto default KB path | existing directory path | Persists KB root. If the path is inside `Knowledge_Base`, runtime normalizes to the `Knowledge_Base` root. |
| `user_language` | `string` | `"en"` | `"en"`, `"zh"` | Sets app language. Any other value resolves to `"en"`. |
| `multi_window.single_window_mode` | `bool` | `true` | `true`/`false` | Controls startup mode and Godot launch visibility strategy. |
| `multi_window.hide_tauri_when_pathmode_opens` | `bool` | `true` | `true`/`false` | If true, Tauri hides when Path Mode opens. |
| `multi_window.restore_tauri_when_pathmode_exits` | `bool` | `true` | `true`/`false` | If true, Tauri restores/focuses when Path Mode exits. |
| `multi_window.confirm_before_full_shutdown_from_godot` | `bool` | `true` | `true`/`false` | If true, closing Godot shows a confirmation dialog ("return" vs "close all"). |
| `multi_window.sync_language` | `bool` | `true` | `true`/`false` | If true, language updates are synchronized across runtime windows. |

Compatibility aliases (accepted for migration):

- `knowledgeBasePath` -> `knowledge_base_path`
- `userLanguage` -> `user_language`
- `[multiWindow]` -> `[multi_window]`
- `singleWindowMode` -> `single_window_mode`
- `hideTauriWhenPathmodeOpens` -> `hide_tauri_when_pathmode_opens`
- `restoreTauriWhenPathmodeExits` -> `restore_tauri_when_pathmode_exits`
- `confirmBeforeFullShutdownFromGodot` -> `confirm_before_full_shutdown_from_godot`
- `syncLanguage` -> `sync_language`

## 5. Recommended Presets

### A) Strict single-window (recommended)

```toml
[multi_window]
single_window_mode = true
hide_tauri_when_pathmode_opens = true
restore_tauri_when_pathmode_exits = true
confirm_before_full_shutdown_from_godot = true
sync_language = true
```

Behavior:

- Only one primary frontend window is visible at a time.
- Path Mode close requires explicit user choice.

### B) Dev co-visibility / debugging mode

```toml
[multi_window]
single_window_mode = false
hide_tauri_when_pathmode_opens = false
restore_tauri_when_pathmode_exits = true
confirm_before_full_shutdown_from_godot = true
sync_language = true
```

Behavior:

- Tauri can remain visible while Path Mode opens.
- Useful for debugging bridge/UI interactions.

## 6. Safe Update Workflow

1. Exit NoteConnection.
2. Edit `app_config.toml`.
3. Save file with UTF-8 text encoding.
4. Start NoteConnection again.
5. Validate:
   - Main window/Path Mode handoff follows your multi-window policy.
   - Language and KB path are loaded as expected.

## 7. Related Diataxis Pages

- How-To: [`docs/diataxis/en/how-to/configure-app-config.md`](../diataxis/en/how-to/configure-app-config.md)
- Reference: [`docs/diataxis/en/reference/app-config-schema.md`](../diataxis/en/reference/app-config-schema.md)
