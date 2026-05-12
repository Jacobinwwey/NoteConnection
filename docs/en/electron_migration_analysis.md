# 2026-03-04 v1.5.13 - Electron Decommission Readiness Addendum

## English Document

> Status sync note (2026-05-10): unresolved-goal baseline is consolidated in [Open Goal Audit (2026-05-10)](../open_goal_audit_2026-05-10.md).

### Current Readiness Position

The migration has reached functional parity on core runtime paths for Tauri desktop, but Electron cannot be removed immediately without controlled gating.

### Ready Areas

- Tauri sidecar startup and graph build pipeline are running in active development workflow.
- Core folder/content/build flows have Tauri-capable backend pathways.
- Godot Path Mode integration via PathBridge is active in the Tauri runtime.

### Remaining Risk Before Full Electron Removal

1. Cache reuse vs rebuild prompt parity must be fully deterministic in Tauri load flow.
2. Duplicate load/build triggers under startup timing races must be fully eliminated.
3. Godot history recording behavior for center-node transitions needs complete regression coverage.
4. IPC surface audit must verify no production-critical path still relies on `window.electronAPI`.
5. Export/release workflows must confirm both desktop and Android outputs remain reproducible.

### Removal Gate Recommendation

Electron removal should be executed only after a formal pass/fail gate:

- All migration regression tests pass.
- Manual scenario checklist (cache prompt, single load execution, history updates) passes.
- Documentation and operator runbooks are updated for Tauri-only + dual Android output strategy.


# In-Depth Analysis of Electron Codebase for Tauri Migration

**Date**: 2026-02-27
**Target**: `src/electron/main.ts`, `src/electron/preload.ts`, `src/server.ts`, and Frontend IPC Usage.

## 1. Current Electron Architecture (`main.ts`)

The existing Electron main process serves several critical roles beyond just rendering the web view:

- **Configuration Management:** Electron read/wrote `kb_config.json` in the user's data directory for the Knowledge Base path and language preferences (now superseded in Tauri by `app_config.toml` with legacy auto-migration).
- **Menu Localization:** Dynamically builds the native window menu in English or Chinese based on user preferences.
- **First-Run Setup:** Spawns a native directory selection dialog (`dialog.showOpenDialog`) if no config exists.
- **Node.js Backend Execution:** Directly imports and runs `NoteController.triggerBuild()` in the same process, managing file I/O and spawning worker threads.
- **IPC Handlers:** Bridges the isolated frontend environment to native Node.js and system APIs.

## 2. IPC Channel Mapping (The `window.electronAPI` interface)

An analysis of `preload.ts` and frontend usages reveals the following IPC channels that must be migrated:

| Electron IPC Hook    | Current Backend Implementation (`main.ts`) | Tauri Migration Strategy                                                                                 |
| :------------------- | :----------------------------------------- | :------------------------------------------------------------------------------------------------------- |
| `getKbPath()`        | Reads from `kb_config.json`.               | Implemented in Rust via `app_config.toml` persistence (`get_kb_path`/`set_kb_path`) with startup migration from legacy JSON. |
| `getFolders()`       | Calls `NoteController.getFolders()`.       | Migrate to HTTP fetch against Node Sidecar (`GET /api/folders`).                                         |
| `getContent(path)`   | Calls `NoteController.getContent()`.       | Migrate to HTTP fetch against Node Sidecar (`GET /api/content?path=...`).                                |
| `buildGraph(opts)`   | Calls `NoteController.triggerBuild()`.     | Migrate to HTTP POST against Node Sidecar (`POST /api/build`), OR Rust invoke that triggers the sidecar. |
| `checkCache(target)` | Checks `fs.stat` on `data_[target].js`.    | Implement as a Rust `#[tauri::command]`.                                                                 |
| `restoreCache(t)`    | Copies `data_[target].js` to `data.js`.    | Implement as a Rust `#[tauri::command]`.                                                                 |
| `getUserLanguage()`  | Reads from `kb_config.json`.               | Implemented in Rust via `app_config.toml` (`get_user_language`) and exposed to frontend runtime hydration. |
| `setUserLanguage()`  | Writes to config & updates OS Menu.        | Implemented in Rust `#[tauri::command]` to update `app_config.toml`, rebuild Tauri menu, and emit unified runtime language updates. |
| `on('build-log')`    | Receives live stdout from build.           | Rust intercepts Sidecar stdout and uses `app_handle.emit()`.                                             |

## 3. The Node.js Server (`server.ts`) API Gap

While `server.ts` exposes `/api/folders` and `/api/content`, it does **not** expose endpoints for:

- Cache management (`checkCache` / `restoreCache`).
- Knowledge base path selection.

This confirms the hybrid architecture plan:

1. **Rust (Tauri Backend):** Will handle OS-level dialogues, configuration persistence, native application menus, and cache file copying.
2. **Node.js (Sidecar):** Will exclusively handle the heavy-lifting logic (Markdown parsing, NLP graph building) exposed via HTTP.

## 4. Key Implementation Risks

1. **Path Resolving:** Currently, `__dirname` is heavily used in `main.ts` to locate `../frontend/data.js`. In Tauri with a sidecar binary, the frontend assets are injected into the Tauri bundle, not physically sitting next to the Node executable. The caching mechanism in Rust must point to the Tauri AppData directory, not a relative `frontend` folder.
2. **Sidecar Lifecycle:** Rust must ensure the Node sidecar (`server.exe`) is forcefully killed when the Tauri window is closed, otherwise it will zombie and lock port 3000.
3. **Menu Rebuilding:** Tauri's menu system (`tauri::menu::Menu`) must be dynamically rebuildable from Rust when the user calls `setUserLanguage`.

---
