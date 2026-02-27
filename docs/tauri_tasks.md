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
