# NoteConnection v1.6.6

## English

### Release Scope

- Compare baseline: `v1.6.5..v1.6.6`
- Commits: `12`
- Files changed: `34`
- Churn: `+3420 / -1280`

### Highlights

- **Sidecar Reliability**: Hardened the Tauri sidecar lifecycle with crash recovery, automatic restart on broken pipe, and structured termination handling in `lib.rs`. The Node.js server sidecar now emits `build-log` events through stdio streaming.
- **Godot Path Mode Bootstrap**: Delivered the `ensure-godot-sidecar.js` script and validation pipeline (`verify:tauri:bin`, `validate-tauri-sidecars.js`), establishing the Godot executable as a managed sidecar with target-triple naming.
- **Platform Window Management**: Implemented single-window mode with visibility toggling between Tauri WebView and Godot renderer. Added `confirm_before_full_shutdown_from_godot` safety gate and `sync_language` menu coordination.
- **Configuration Migration**: Migrated from Electron-era JSON config to TOML-based `app_config.toml` shared across Tauri, Godot, and NoteMD subsystems. Added `AppConfigToml.ts` reader/writer with structured frontend/pathmode/notemd sections.
- **Documentation Quality**: Established the Diataxis documentation framework baseline with initial bilingual coverage across tutorials, how-to guides, and reference pages. Added the `AGENTS.md` repository guidelines.
- **Markdown Worker**: Introduced the Rust-based `markdown-worker` sidecar using pulldown-cmark for hardware-accelerated Markdown parsing, with target-triple naming and Tauri externalBin registration.

### Architecture and Packaging

- Set the `externalBin` list in `tauri.conf.json` to `["bin/server", "bin/godot", "bin/markdown-worker"]`.
- Hardened the `build-sidecar.js` script with `@yao-pkg/pkg` for reliable cross-platform Node.js → binary packaging.
- Added the `scripts/ensure-sidecar-ready.js` preflight check for Tauri dev mode.

### Release Notes

- This release established the sidecar architecture foundation (server + godot + markdown-worker) that subsequent releases build upon. It is designated as the canonical quality bar for release notes in `AGENTS.md`.

---

## 中文

### 发布范围

- 对比基线：`v1.6.5..v1.6.6`
- 提交数：`12`
- 文件变更：`34`
- 代码变更：`+3420 / -1280`

### 亮点

- **Sidecar 可靠性**：加固了 Tauri sidecar 生命周期，支持崩溃恢复、断管自动重启和结构化终止处理。Node.js 服务器 sidecar 现在通过 stdio 流发出 `build-log` 事件。
- **Godot Path Mode 引导**：交付了 `ensure-godot-sidecar.js` 脚本和验证流水线，将 Godot 可执行文件建立为受管理的 sidecar。
- **平台窗口管理**：实现了 Tauri WebView 与 Godot 渲染器之间的单窗口模式与可见性切换。添加了 `confirm_before_full_shutdown_from_godot` 安全门禁。
- **配置迁移**：从 Electron 时代的 JSON 配置迁移到 TOML 格式的 `app_config.toml`，在 Tauri、Godot 和 NoteMD 子系统之间共享。
- **文档质量**：建立了 Diataxis 文档框架基线，涵盖初始的双语教程、操作指南和参考页面。添加了 `AGENTS.md` 仓库指南。
- **Markdown Worker**：引入了基于 Rust pulldown-cmark 的 markdown-worker sidecar，用于硬件加速的 Markdown 解析。

### 架构与打包

- 在 `tauri.conf.json` 中设置 `externalBin` 列表。
- 使用 `@yao-pkg/pkg` 加固了 `build-sidecar.js` 构建脚本。
- 为 Tauri 开发模式添加了 `scripts/ensure-sidecar-ready.js` 预检。

### 发布说明

- 此版本建立了 sidecar 架构基础（server + godot + markdown-worker），后续版本在此基础上构建。在 `AGENTS.md` 中被指定为发布说明的规范质量基准。
