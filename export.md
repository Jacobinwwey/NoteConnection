# 2026-03-02 v1.5.1 - Export Strategy Update (Tauri-Primary, Dual Android Outputs)

## English Document

### Strategy Update

Export strategy is now Tauri-primary while preserving Android dual-output flexibility:

- Desktop distribution baseline moves to Tauri packaging.
- Capacitor Android pipeline remains available.
- Tauri Android pipeline is added as a parallel mobile output path.

### Packaging Direction

1. Keep Electron packaging available only as a temporary fallback during migration gate period.
2. Promote Tauri desktop bundling as the default release path.
3. Maintain both mobile generation routes until runtime parity validation is complete.

### Release Risk Controls

- Require parity checks for data loading, cache behavior, and path mode interactions before disabling Electron builds.
- Keep sidecar/runtime path verification in release checklists.
- Keep reproducible build notes for both Android routes in project docs.

## 中文文档

### 策略更新

当前导出策略已转为 Tauri 主路径，同时保留 Android 双产物灵活性：

- 桌面分发基线迁移为 Tauri 打包。
- 保留 Capacitor Android 构建链路。
- 新增 Tauri Android 作为并行移动端产物路径。

### 打包方向

1. Electron 打包仅在迁移闸门期间作为临时回退方案保留。
2. 默认发布路径提升为 Tauri 桌面打包。
3. 在运行时一致性验收完成前，移动端维持双链路产出。

### 发布风险控制

- 在停用 Electron 构建前，必须完成数据加载、缓存行为与 Path Mode 交互一致性检查。
- 在发布检查清单中保留 sidecar/运行时路径校验项。
- 在项目文档中保留两条 Android 构建路径的可复现说明。

---

# Release Strategy: Standalone NoteConnection Application

## Goal

Distribute the NoteConnection application as a standalone, installable desktop package (Windows .exe/.msi) with a dedicated UI via Electron.

## Architecture: Electron Integration

We will use **Electron** to wrap the current Node.js backend and Vanilla JS frontend.

- **Backend (Main Process):** The existing `server.ts` will be integrated into the Electron Main process.
- **Frontend (Renderer Process):** The Electron window will load the application from the local server.

## Key Features & Modifications

### 1. "Open Vault" Functionality

- **Change:** Refactor `server.ts` to accept a dynamic root path instead of locking to `process.cwd()/Knowledge_Base`.
- **UI:** The Electron app will launch with a "Welcome" screen allowing the user to "Open Folder".

### 2. Standalone UI Enhancements

- **Native Menus:** Standard File/Edit/View menus.
- **Window Management:** Persist window state.

### 3. GPU & Performance Preservation

- **GPU:** Uses Chromium's native GPU stack.
- **Workers:** Node.js worker threads continue to function in the backend process.

## Implementation Steps

### Phase 1: Preparation (Refactoring)

1.  **Refactor `server.ts`:** Export a `createAppServer` function.
2.  **Clean Dependencies:** Ensure proper separation for packing.

### Phase 2: Electron Setup

1.  **Install:** `electron`, `electron-builder`.
2.  **`electron/main.ts`:** Main process entry point to spawn server and window.

### Phase 3: Packaging

1.  **Config:** `electron-builder.yml` for NSIS (Windows) installer.
2.  **Build:** Generate `.exe`.

## Verification

- **Install Test:** Clean install in sandbox.
- **Feature Check:** Verify Graph, GPU, and File IO.
