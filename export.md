# 2026-03-04 v1.5.14 - Consolidated Bilingual Migration Update Logs

## English Document

### README Runtime/Migration Logs (v1.5.x)
# 2026-03-03 v1.5.10

### Option A P0 Status Update (Tauri Android Native Folder/Build/Content Flow)

- Tauri Android runtime now supports native build flow without Node sidecar:
  - Added Rust command `build_graph_runtime(request)` in `src-tauri/src/lib.rs`.
  - Runtime graph artifacts are written into `runtime_data/`:
    - `data.js`
    - `graph_data.json`
    - `data_<target>.js`
    - `graph_data_<target>.json`
- Android runtime capability profile is now:
  - `supports_sidecar=false`
  - `supports_build=true`
  - `supports_content_api=true`
- Frontend build routing in `src/frontend/source_manager.js`:
  - sidecar available -> `POST /api/build`
  - no sidecar + Tauri runtime -> `invoke('build_graph_runtime', { request })`
- Verification:
  - `npm run test:migration` -> passed (`55` tests)
  - `npm run test:tauri` -> passed (`16` tests)
  - `npm run verify:android:env` -> passed (SDK + cmdline-tools + NDK detected)

### Scope Clarification

- This closure applies to **Tauri Android runtime path**.
- Capacitor packaging path is preserved, but runtime parity with desktop build backend is still tracked separately.
- Historical sections below that mention `supports_build=false` are archived changelog context and are superseded by this update.

# 2026-03-03 v1.5.5

### Migration Status Revalidation

- Re-ran closure suites:
  - `npm run test:migration` -> passed (`44` tests)
  - `npm run test:tauri` -> passed (`14` tests)
- P0/P1 closures from `v1.5.3` and `v1.5.4` remain valid.
- `v1.5.2` checklist should be treated as historical/superseded plan context.

### Active Scope

- Desktop Tauri path is stable and remains the primary runtime.
- Android runtime remains capability-gated by design:
  - `supports_sidecar=false`
  - `supports_build=false`
  - cache/content-oriented flow only.
- Remaining product decision:
  - Option A: Android-native build/content parity with desktop sidecar flow.
  - Option B (active): keep cache/read-focused mobile runtime boundary.

# 2026-03-03 v1.5.3

### Migration Gate Closure Update

- P0 engineering closure has been completed in this round:
  - Sidecar `/api/content` now enforces KB-root boundary checks.
  - Regression tests were added for inside-root, legacy `Knowledge_Base` marker, and outside-root rejection paths.
  - Godot center-switch history recording contract was hardened and covered by tests.
  - Source-manager single-load/cache-guard contracts were added to migration tests.
- Latest verification:
  - `npm run test:migration` -> passed (`43` tests)
  - `npm run test:tauri` -> passed (`14` tests)

### Runtime Policy (Current)

- Desktop runtime is Tauri-first and stable.
- Android runtime remains capability-gated by design:
  - `supports_sidecar=false`
  - `supports_build=false`
  - cache/content-oriented flow only.

### Archive Notice

- Any Electron references in historical changelog sections below are **archived context only** and are not active release instructions.

# 2026-03-02 v1.5.1

### Tauri Migration Progress Update (Desktop + Android)

This release note records the latest migration parity work completed after the Android SDK Command-line Tools setup was validated.

#### Completed in this round

- Added **target discovery parity** across sidecar and Tauri runtime:
  - Sidecar API: `GET /api/available-targets` (merges `Knowledge_Base` folders + cached graph targets).
  - Tauri command: `get_available_targets` (same merged behavior).
- Added **content-read parity path** for non-sidecar runtimes:
  - Tauri command: `read_node_content(file_path)`.
  - Reader fallback now supports `read_node_content` when sidecar is unavailable (Android-safe path).
- Added **cache-only source filtering** for mobile runtime:
  - When `supports_build=false`, source dropdown is filtered to cached targets only.
  - `ALL_FOLDERS` option appears only if active cache exists.
  - Load button is disabled when no cache is available.
- Added **Android multi-ABI opt-in command path** while keeping `aarch64` as default stable target:
  - `npm run tauri:android:dev:universal`
  - `npm run tauri:android:build:universal`

#### Verification evidence

- `npm run test:migration` passed (35 tests).
- `npm run test:tauri` passed (14 Rust tests).
- `npm run tauri:android:build` passed.
- `npm run tauri:android:build:universal` passed.

#### Current capability boundary

- Android runtime currently supports:
  - Loading and restoring existing graph cache.
  - Reading node content through Tauri command path.
- Android runtime currently does **not** support local in-app graph build (`/api/build` equivalent) yet.
- Godot Path Mode remains desktop-oriented in the current architecture.

---

### Interface Delta Logs
# 2026-03-02 v1.5.1

### Interface Delta: Tauri Runtime Parity Update

This section records interface changes added after `v1.4.5`, keeping all previous handover content unchanged below.

#### A. Sidecar HTTP API (Node)

1. `GET /api/available-targets`
   - Purpose: return selectable learning/build targets merged from:
     - physical subfolders under `Knowledge_Base`
     - cached artifacts like `data_<target>.js`, `graph_data_<target>.json`
   - Response:

```json
{
  "targets": ["financial", "legal", "robotics"]
}
```

#### B. Tauri Commands (Rust IPC)

1. `get_available_targets() -> string[]`
   - Contract: same merged target semantics as `/api/available-targets`.

2. `read_node_content(file_path: string) -> Result<string, string>`
   - Contract:
     - Accepts relative paths and absolute paths.
     - Enforces KB-root boundary (rejects files outside configured `Knowledge_Base`).
     - Supports legacy desktop-style paths containing `.../Knowledge_Base/...` by rebasing to current configured KB root.

#### C. Runtime Capability Contract Update

- `get_runtime_capabilities()` now returns `supports_content_api: true` on Android.
- Rationale: content reads are now available through Rust `read_node_content` command even when sidecar is disabled.

#### D. Frontend Behavior Contract Changes

1. `source_manager.js`
   - Sidecar path prefers `/api/available-targets` and falls back to `/api/folders`.
   - Rust path prefers `get_available_targets` and falls back to `get_folders`.
   - In `supports_build=false` runtime (mobile):
     - Source list is filtered to cached targets only.
     - `ALL_FOLDERS` is shown only if active cache exists.
     - Load button is disabled if no cache is available.

2. `reader.js`
   - Content loading fallback order:
     - sidecar `/api/content` (desktop/web path)
     - Rust command `read_node_content` (Tauri fallback/mobile-safe)
     - localized unavailable/error messaging

#### E. Verification Interface Baseline

- `npm run test:migration` passed (35 tests).
- `npm run test:tauri` passed (14 tests).
- `npm run tauri:android:build` passed.

---

## 中文文档

### README 运行时/迁移日志（v1.5.x）
# 2026-03-03 v1.5.10

### 方案 A P0 状态更新（Tauri Android 原生目录/构建/内容链路）

- Tauri Android 运行时现已支持无 Node sidecar 的原生构建：
  - 在 `src-tauri/src/lib.rs` 新增 Rust 命令 `build_graph_runtime(request)`。
  - 运行时图谱产物写入 `runtime_data/`：
    - `data.js`
    - `graph_data.json`
    - `data_<target>.js`
    - `graph_data_<target>.json`
- Android 运行时能力画像已更新为：
  - `supports_sidecar=false`
  - `supports_build=true`
  - `supports_content_api=true`
- `src/frontend/source_manager.js` 中构建链路分流：
  - 有 sidecar -> `POST /api/build`
  - 无 sidecar 且为 Tauri 运行时 -> `invoke('build_graph_runtime', { request })`
- 验证结果：
  - `npm run test:migration` -> 通过（`55` 项）
  - `npm run test:tauri` -> 通过（`16` 项）
  - `npm run verify:android:env` -> 通过（SDK + cmdline-tools + NDK 已识别）

### 范围说明

- 本次收口适用于 **Tauri Android 运行时路径**。
- Capacitor 打包路径继续保留，但其与桌面构建后端的运行时对等仍单独跟踪。
- 下方历史版本中出现的 `supports_build=false` 为归档上下文，已由本节更新覆盖。

# 2026-03-03 v1.5.5

### 迁移状态复验

- 已重新执行收口测试：
  - `npm run test:migration` -> 通过（`44` 项）
  - `npm run test:tauri` -> 通过（`14` 项）
- `v1.5.3` 与 `v1.5.4` 的 P0/P1 收口结果持续有效。
- `v1.5.2` 清单应视为历史/已被后续版本覆盖的计划上下文。

### 当前有效范围

- 桌面端 Tauri 路径稳定，继续作为主运行时。
- Android 端按设计维持能力门控：
  - `supports_sidecar=false`
  - `supports_build=false`
  - 以缓存/内容读取流程为主。
- 剩余产品决策：
  - 方案 A：实现与桌面 sidecar 等价的 Android 原生构建/内容链路。
  - 方案 B（当前执行策略）：维持移动端缓存/阅读边界。

# 2026-03-03 v1.5.3

### 迁移闸门收口更新

- 本轮已完成 P0 工程收口：
  - Sidecar `/api/content` 已增加 KB 根路径边界校验。
  - 新增回归测试覆盖：根目录内路径、旧式 `Knowledge_Base` 标记路径、根目录外拒绝路径。
  - Godot 中心切换历史记录契约已加固并纳入测试。
  - Source Manager 单次加载/缓存防重入契约已纳入迁移测试。
- 最新验证：
  - `npm run test:migration` -> 通过（`43` 项）
  - `npm run test:tauri` -> 通过（`14` 项）

### 当前运行时策略

- 桌面端运行时为 Tauri-first，且已稳定。
- Android 端按设计维持能力门控：
  - `supports_sidecar=false`
  - `supports_build=false`
  - 以缓存/内容读取流程为主。

### 归档说明

- 下方历史变更中的 Electron 内容均为**归档上下文**，不再作为当前发布执行指令。

# 2026-03-02 v1.5.1

### Tauri 迁移进度更新（桌面 + Android）

本次更新记录了在 Android SDK Command-line Tools 验证通过后，最新完成的迁移对齐工作。

#### 本轮已完成

- 新增 **目标发现能力对齐**（sidecar 与 Tauri 运行时一致）：
  - sidecar API：`GET /api/available-targets`（合并 `Knowledge_Base` 目录与缓存目标）。
  - Tauri 命令：`get_available_targets`（同样的合并逻辑）。
- 新增 **无 sidecar 运行时的内容读取路径**：
  - Tauri 命令：`read_node_content(file_path)`。
  - 阅读器在 sidecar 不可用时可回退到 `read_node_content`（适配 Android）。
- 新增 **移动端仅缓存模式的源过滤**：
  - 当 `supports_build=false` 时，下拉列表仅展示有缓存的数据目标。
  - `ALL_FOLDERS` 仅在存在活动缓存时显示。
  - 无缓存可用时，加载按钮自动禁用。
- 新增 **Android 多 ABI 可选命令路径**，同时保持 `aarch64` 默认稳定目标：
  - `npm run tauri:android:dev:universal`
  - `npm run tauri:android:build:universal`

#### 验证证据

- `npm run test:migration` 通过（35 项测试）。
- `npm run test:tauri` 通过（14 项 Rust 测试）。
- `npm run tauri:android:build` 通过。
- `npm run tauri:android:build:universal` 通过。

#### 当前能力边界

- Android 端当前已支持：
  - 加载与恢复已有图谱缓存。
  - 通过 Tauri 命令路径读取节点内容。
- Android 端当前仍 **不支持** 本地应用内图谱构建（尚未提供 `/api/build` 等价路径）。
- Godot Path Mode 仍以桌面端为主。

---

### 接口增量日志
# 2026-03-02 v1.5.1

### 接口增量：Tauri 运行时能力对齐更新

本节记录 `v1.4.5` 之后新增的接口变化，下方历史交接内容保持不变。

#### A. Sidecar HTTP API（Node）

1. `GET /api/available-targets`
   - 用途：返回可选择的学习/构建目标，来源合并：
     - `Knowledge_Base` 下实际子目录
     - 缓存产物（如 `data_<target>.js`、`graph_data_<target>.json`）
   - 响应示例：

```json
{
  "targets": ["financial", "legal", "robotics"]
}
```

#### B. Tauri 命令（Rust IPC）

1. `get_available_targets() -> string[]`
   - 契约：与 `/api/available-targets` 保持同样的目标合并语义。

2. `read_node_content(file_path: string) -> Result<string, string>`
   - 契约：
     - 支持相对路径与绝对路径输入。
     - 严格限制在配置的 `Knowledge_Base` 根目录内（越界文件直接拒绝）。
     - 对包含 `.../Knowledge_Base/...` 的旧桌面路径可自动重定位到当前 KB 根目录。

#### C. 运行时能力契约更新

- `get_runtime_capabilities()` 在 Android 端现在返回 `supports_content_api: true`。
- 原因：即使 sidecar 关闭，也可通过 Rust `read_node_content` 完成内容读取。

#### D. 前端行为契约更新

1. `source_manager.js`
   - sidecar 路径优先调用 `/api/available-targets`，失败时回退到 `/api/folders`。
   - Rust 路径优先调用 `get_available_targets`，失败时回退到 `get_folders`。
   - 在 `supports_build=false`（移动端）场景：
     - 下拉列表仅保留有缓存的目标。
     - `ALL_FOLDERS` 仅在存在活动缓存时显示。
     - 无可用缓存时，加载按钮禁用。

2. `reader.js`
   - 内容加载回退顺序：
     - sidecar `/api/content`（桌面/网页路径）
     - Rust `read_node_content`（Tauri 回退/移动端可用）
     - 本地化错误或不可用提示

#### E. 验证基线

- `npm run test:migration` 通过（35 项）。
- `npm run test:tauri` 通过（14 项）。
- `npm run tauri:android:build` 通过。

---

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
