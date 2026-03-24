# How-To: Operate Single-Window Runtime

Use this guide to verify and operate Tauri/Godot single-window behavior.

## Expected Runtime Behavior

1. `npm run tauri:dev:mini:gpu` starts with Tauri visible.
2. Entering Path Mode switches visibility to Godot.
3. Only one primary frontend window remains visible at a time.

## Godot Close Behavior

- Closing the Godot window should prompt:
  - Return to main interface.
  - Close all windows.

## NoteMD Behavior in Runtime

- NoteMD is embedded in runtime flows (not a standalone desktop window).
- Browse actions in Tauri should open native pickers and return selected paths.
- PDF import must follow: `PDF -> Mineru -> Markdown`.

## Canonical Detailed Sources

- [docs/en/single_window_migration_plan.md](../../../en/single_window_migration_plan.md)
- [docs/en/User_Manual.md](../../../en/User_Manual.md)
