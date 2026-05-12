# Historical Note (2026-03-04 v1.5.11)

## English Document

This file is kept as historical taskboard context from the early Electron -> Tauri migration phase.
Current active migration decision/status tracking is maintained in:

- `TODO.md` (release gate decisions and action checklist)
- `TEST_REPORT.md` (verification evidence and risk status)
- `open_goal_audit_2026-05-10.md` (cross-doc unresolved-goal status snapshot)

## 中文文档

本文件作为 Electron -> Tauri 迁移早期阶段的任务看板历史记录保留。
当前有效的迁移决策/状态以以下文档为准：

- `TODO.md`（发布闸门决策与行动清单）
- `TEST_REPORT.md`（验证证据与风险状态）
- `open_goal_audit_2026-05-10.md`（跨文档未完成目标状态快照）

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

## 中文文档

### 更新目标

在保持兼容性的前提下，完成从 Electron 主运行时到 Tauri 主运行时的迁移：

- 桌面端（Windows）并集成 Godot Path Mode。
- Android 双产物策略（保留 Capacitor，同步支持 Tauri Android）。
- 保持 NoteConnection 图构建所需的现有构建与缓存流程。

### 执行状态（v1.5.1）

- [x] Tauri 桌面 Sidecar 架构可运行。
- [x] 后端与 Godot 的 PathBridge 通信可运行。
- [x] Sidecar 运行时路径处理已对齐。
- [x] Sidecar 运行时 Worker 模块路径问题已处理。
- [x] 缓存选择交互（复用/重建提示）一致性现已由合同回归锁定。
- [x] 加载流程防重复执行现已由启动/重连 load-flow 合同检查覆盖。
- [x] Godot 中心切换交互下的 History 同步现已由历史合同验证覆盖。
- [ ] Linux 宿主 strict Tauri 证据仍依赖预装 `webkit2gtk-4.1`、`javascriptcoregtk-4.1`、`libsoup-3.0`；该项现属于宿主供给门禁，而非实现缺口。
- [ ] Electron 下线闸门审查仍待完成。

### P1.5 余下交付

1. 保持 Capacitor 构建链路可用（`build_apk.bat`）并持续维护。
2. 保持 Tauri Android 构建链路可用，并补齐可复现构建文档。
3. 在所有关键数据路径上，确保 Tauri 运行时与 Electron 基线行为一致。

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
