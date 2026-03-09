# Historical Note (2026-03-04 v1.5.11)

## English Document

This file is kept as historical taskboard context from the early Electron -> Tauri migration phase.
Current active migration decision/status tracking is maintained in:

- `TODO.md` (release gate decisions and action checklist)
- `TEST_REPORT.md` (verification evidence and risk status)

---

# 2026-03-04 v1.5.13 - Tauri Taskboard Refresh (Desktop + Android + Godot Bridge)

## English Document

### Updated Objective

Complete migration from Electron-primary runtime to Tauri-primary runtime while preserving compatibility for:

- Desktop (Windows) with Godot Path Mode integration.
- Android dual output strategy (Capacitor retained + Tauri Android enabled).
- Existing build and cache workflows required by NoteConnection graph generation.

### Execution Status (v1.5.1)

- [x] Tauri desktop sidecar architecture is operational.
- [x] PathBridge communication between backend and Godot is operational.
- [x] Runtime path handling has been aligned for sidecar execution.
- [x] Worker module resolution issues in sidecar runtime have been addressed.
- [ ] Cache decision UX parity (reuse vs rebuild prompt) still needs locked regression validation.
- [ ] Duplicate execution prevention for load flow still needs final startup-race hardening.
- [ ] Godot history synchronization on center-switch interactions still needs final verification.
- [ ] Final Electron removal gate review remains pending.

### Remaining P1.5 Deliverables

1. Keep Capacitor build route healthy (`build_apk.bat`) as a maintained output.
2. Keep Tauri Android route functional and documented for reproducible builds.
3. Keep runtime behavior parity across Electron baseline and Tauri runtime for all critical data paths.

---

# Phase 1: Tauri 2.0 Architecture Unification (Single Window & Unified Logs)

This checklist tracks the implementation of migrating the primary project shell from Electron to Tauri 2.0 to solve cross-platform (Windows/Android) packaging, debugging unification, and dual-window layout issues.

## 1. Environment Cleanup & Tauri Initialization

- [x] Retain `electron` dependencies and [src/electron/main.ts](file:///e:/Knowledge_project/NoteConnection_app/src/electron/main.ts) as a backup reference during Tauri migration.
- [ ] Run `npx create-tauri-app@latest --rc` in the root (selecting `npm`, `vanilla`, `typescript`). Name the directory `src-tauri`.
- [ ] Configure `tauri.conf.json` to point the `distDir` to the existing compiled frontend output directory (`dist/` or equivalent).

## 2. Node.js & Godot Sidecar Integration (Rust)

- [ ] In `tauri.conf.json`, declare the Node.js environment and Godot executable as `sidecars` (bundled external binaries).
- [ ] In `src-tauri/src/main.rs`, write Rust initialization code to spawn the Node.js backend when Tauri starts up.
- [ ] Implement robust `stdout`/`stderr` capturing in Rust to pipe all Node.js and Godot logs directly into the single developer terminal running Tauri.

## 3. IPC Migration (Frontend to Rust)

- [ ] Update any remaining Electron IPC scripts (e.g., `ipcRenderer`) in the Web UI to use the `@tauri-apps/api/core` invoke commands.
- [ ] Write respective `#[tauri::command]` functions in Rust to handle file dialogs, system queries, or opening the Godot sub-window.

## 4. End-to-End Verification

- [ ] Run `npm run tauri dev` and verify the single native window opens with the UI.
- [ ] Monitor the single terminal and verify Node.js `console.log` lines appear successfully in the Rust output feed.
- [ ] Verify `npm run tauri build` successfully generates a lightweight Windows `.exe`.
- [ ] (Future) Verify `npm run tauri android build` setup for APK compilation.
