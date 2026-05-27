# Historical Note (2026-03-04 v1.5.11)

## English Document

This file is kept as historical taskboard context from the early Electron -> Tauri migration phase.
Current active migration decision/status tracking is maintained in:

- `TODO.md` (release gate decisions and action checklist)
- `TEST_REPORT.md` (verification evidence and risk status)
- `open_goal_audit_2026-05-10.md` (cross-doc unresolved-goal status snapshot)
- `implementation_plan.md` (current code-vs-plan realignment order for Phase-1/2/3 work)

Additional note (2026-05-12):

- Tauri migration closure does not mean the knowledge-mastery backbone is closed.
- Real graph backend completion, production ANN delivery, non-placeholder quality gates, and active tutor routing are now tracked outside this historical taskboard.

## 2026-05-27 Tauri-First Reply Rendering Task Sync

- [x] Scoped knowledge-workspace selection, active-target propagation, and title-like selective hydration are now real on the current branch.
- [x] Provider presets, TOML template materialization, and conversation turn/resume CORS closure are now real on the current branch.
- [x] Reader-side markdown/KaTeX/Mermaid hardening plus first-party Tauri debug capture tooling are now real on the current branch.
- [x] The Tauri agent reply area no longer depends only on plain-text assistant mounting; structured replies now render through typed blocks.
- [x] Shared Reader-derived render-substrate reuse inside the agent workspace is now in place.
- [x] HTML artifact isolation for rich assistant outputs is now in place through sandboxed preview.

Active execution references:

- `docs/diataxis/en/explanation/development-progress-dashboard.md`
- `docs/diataxis/en/explanation/agent-conversation-focus-mode-plan.md`
- `docs/en/implementation_plan.md`

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
- [x] Cache decision UX parity (reuse vs rebuild prompt) is now regression-locked by contract coverage.
- [x] Duplicate execution prevention for load flow is now covered by startup/reconnect load-flow contract checks.
- [x] Godot history synchronization on center-switch interactions is now covered by history contract verification.
- [ ] Linux-host strict Tauri evidence still depends on preinstalled `webkit2gtk-4.1`, `javascriptcoregtk-4.1`, and `libsoup-3.0`; this is now a host-provisioning gate rather than an implementation gap.
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
