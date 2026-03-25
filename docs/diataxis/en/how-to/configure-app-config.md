# How-To: Configure app_config.toml

Use this guide to safely customize local runtime behavior (KB path, language, and single-window policy).

## Step 1: Locate the Active Config File

NoteConnection resolves config in this order:

1. `NOTE_CONNECTION_CONFIG_PATH`
2. `NOTE_CONNECTION_CONFIG_DIR` + `app_config.toml`
3. `%LOCALAPPDATA%/NoteConnection/app_config.toml` (Windows default)

## Step 2: Start from the Official Template

Copy from:

- [`docs/examples/app_config.template.toml`](../../../examples/app_config.template.toml)

## Step 3: Apply Your Policy

Recommended single-window profile:

```toml
[multi_window]
single_window_mode = true
hide_tauri_when_pathmode_opens = true
restore_tauri_when_pathmode_exits = true
confirm_before_full_shutdown_from_godot = true
sync_language = true
```

## Step 4: Save and Restart

1. Exit NoteConnection.
2. Save config as UTF-8 text.
3. Restart and verify Path Mode window handoff.

## Step 5: Verify Language + KB Persistence

- Confirm selected KB path persists across restart.
- Confirm language is applied on startup.
- Confirm language sync in Path Mode if `sync_language = true`.

## Canonical Detailed Sources

- [docs/en/app_config.toml_guide.md](../../../en/app_config.toml_guide.md)
- [docs/en/User_Manual.md](../../../en/User_Manual.md)
