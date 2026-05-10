# 解释：架构与迁移背景

本页说明 NoteConnection 的架构决策及关键迁移的工程取舍。

## 为什么采用 Tauri-first（v1.4.4+）

NoteConnection 最初以 Electron 桌面应用发布。v1.4.4 迁移至 Tauri v2，由三个因素驱动：

### 1. 更强的 sidecar 编排控制

NoteConnection 的架构依赖多个 sidecar 进程：
- **Node.js 服务器**（HTTP API + WebSocket 桥接，端口 9876）
- **Godot 4.3 渲染器**（3D Path Mode 可视化）
- **Markdown Worker**（Rust pulldown-cmark 解析器）

Tauri v2 的 `tauri-plugin-shell` 提供一流的 sidecar 管理：stdio 流式传输、终止处理、目标三元组命名。Electron 则需要自定义 child_process 管理，生命周期保障较差。

### 2. 更清晰的 Tauri/Godot 单窗口行为

Path Mode 在 Tauri WebView 和 Godot 渲染器窗口之间切换可见性。Tauri 的原生窗口句柄访问支持：
- 精确的窗口位置同步
- 无需销毁/重建的可见性切换
- `confirm_before_full_shutdown_from_godot` 安全门禁

### 3. 桌面端与移动端能力差异的显式契约边界

桌面端和移动端有根本不同的能力集：
- 桌面端：sidecar 进程、GPU 计算、Godot 原生渲染
- 移动端（Android）：Capacitor/Tauri WebView、受限计算、无 Godot sidecar

Tauri 的能力系统（`capabilities/default.json`）和平台配置合并（`tauri.linux.conf.json` 等）使这些差异显式化、配置驱动。

## Electron 迁移（v1.4.4）

迁移涉及：
- 将 Electron `main.js` 替换为 Tauri Rust 壳（`src-tauri/src/lib.rs`，约 3,300 行）
- IPC 从 `ipcMain`/`ipcRenderer` 迁移到 Tauri `#[tauri::command]` + `window.__TAURI__.core.invoke`
- 文件对话框从 Electron dialog 迁移到 Rust `rfd` crate + Tauri dialog 插件
- 配置从 JSON 迁移到 TOML（`app_config.toml`），在 Tauri + Godot + NoteMD 之间共享
- 打包从 `electron-builder` 迁移到 Tauri bundler

详细分析见 `docs/zh/electron_migration_analysis.md`。

## 混合原生架构

### 组件角色

| 组件 | 技术 | 角色 |
|---|---|---|
| 桌面壳 | Tauri v2 (Rust) | 窗口管理、sidecar 生命周期、系统菜单、剪贴板 |
| HTTP 服务 | Node.js (TypeScript) | API 路由、图构建、学习平台、WebSocket 桥接 |
| Web 前端 | 原生 JS + D3.js + Canvas | 图可视化、设置、阅读器、NoteMD |
| 3D 渲染器 | Godot 4.3 (GDScript) | Path Mode 树形/径向可视化，虹彩气泡着色器 |
| 移动壳 | Tauri Android (Kotlin) | APK 打包、文件系统访问、WebView |

### 通信路径

```
┌─────────┐  HTTP:3000   ┌──────────┐  WebSocket:9876  ┌─────────┐
│  Tauri   │◄────────────►│  Node.js  │◄───────────────►│  Godot   │
│ (WebView)│              │  Server   │                  │ Renderer │
└─────────┘              └──────────┘                  └─────────┘
     │                        │
     │ Tauri IPC              │ HTTP API
     ▼                        ▼
┌─────────┐              ┌──────────┐
│  Rust    │              │  Web     │
│ Commands │              │ Frontend │
└─────────┘              └──────────┘
```

### PathBridge 协议

`PathBridge` WebSocket 服务器实现了 JSON-RPC 2.0 协议，约 25 种消息类型。核心设计属性：
- 严格负载验证和模式强制
- 带背压的出站消息队列
- Mermaid 渲染委托前端（PNG 输出）
- 带传输指纹的路径验证
- 带认证令牌的授权客户端追踪

### 平台差异

| 功能 | 桌面端 | 移动端 |
|---|---|---|
| 图构建 | 完整（worker_threads, GPU） | 只读（预构建数据） |
| Path Mode | Godot 4.3 3D 渲染 | Web Canvas 回退 |
| Sidecar 进程 | 支持 | 不支持 |
| 文件系统 | 原生（rfd 对话框） | 插件（@capacitor/filesystem） |

## Godot 渲染器集成

### 渲染后端选择

项目将 Godot 渲染器从 `GL Compatibility` 切换到 `Forward+`（Vulkan），解决了已知的 Wayland 合成器崩溃问题，同时保留 `gl_compatibility` 作为移动端回退。

### Wayland 回退

在 `XDG_SESSION_TYPE=wayland` 的 Linux 系统上，Tauri Rust 启动器自动设置：
- `GDK_BACKEND=x11`（强制 XWayland 以保证 WebKitGTK 兼容）
- `WEBKIT_DISABLE_DMABUF_RENDERER=1`（避免 NVIDIA GBM 缓冲区创建失败）

## 为什么采用 Diataxis 文档框架

| 章节 | 目的 |
|---|---|
| `tutorials` | 学习导向：首次运行、入门引导 |
| `how-to` | 任务导向：构建、导出、sidecar 管理、发布 |
| `reference` | 信息导向：接口、运行时契约、Godot/NoteMD 规范 |
| `explanation` | 理解导向：架构原理、路线图、进度看板 |

## 参考来源

- [Tauri 头脑风暴笔记](../../../zh/tauri_brainstorming.md)
- [Electron 迁移分析](../../../zh/electron_migration_analysis.md)
- [跨平台架构优化方案](../../../solutions/cross-platform-architecture-refinement-2026-05-02.md)
