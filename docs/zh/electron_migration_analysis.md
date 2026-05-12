## 中文文档

> 状态同步说明（2026-05-10）：未完成目标统一基线见 [Open Goal Audit (2026-05-10)](../open_goal_audit_2026-05-10.md)。

### 当前就绪结论

迁移在 Tauri 桌面核心运行链路上已达到可用一致性，但在未完成闸门验收前，不建议立即移除 Electron。

### 已就绪区域

- Tauri Sidecar 启动与图构建流水线已可用于当前开发流程。
- 核心文件夹/内容/构建流程已具备 Tauri 可用后端通路。
- Godot Path Mode 已通过 PathBridge 接入 Tauri 运行时。

### 完全移除 Electron 前的残余风险

1. Tauri 加载流程中“缓存复用/重建提示”需达到完全确定性。
2. 启动时序竞态导致的重复加载/构建触发需彻底消除。
3. Godot 中心节点切换的 History 记录行为需完成回归覆盖。
4. IPC 面需审计确认无生产关键路径仍依赖 `window.electronAPI`。
5. 导出与发布流程需确认桌面与 Android 双产物可复现。

### 下线闸门建议

仅在正式闸门通过后执行 Electron 下线：

- 迁移回归测试全部通过。
- 手工关键场景（缓存提示、单次加载、历史记录）全部通过。
- Tauri-only 与 Android 双产物策略的文档和运维流程已更新。

---
## 针对向 Tauri 迁移的 Electron 代码库深度分析

**日期**: 2026-02-27
**目标代码**: `src/electron/main.ts`, `src/electron/preload.ts`, `src/server.ts`, 以及前端 IPC 使用情况。

## 1. 当前 Electron 架构概述 (`main.ts`)

现有的 Electron 主进程承担了渲染 Web 视图之外的几个关键角色：

- **配置管理：** Electron 阶段在用户数据目录读取/写入 `kb_config.json`，用于知识库路径和语言偏好（现已在 Tauri 中由 `app_config.toml` 取代，并支持旧配置自动迁移）。
- **菜单本地化：** 根据用户偏好动态构建英文或中文的原生窗口菜单。
- **首次启动设置：** 如果不存在配置，则生成原生目录选择对话框 (`dialog.showOpenDialog`)。
- **Node.js 后端执行：** 在同一进程中直接导入并运行 `NoteController.triggerBuild()`，管理文件 I/O 并生成工作线程。
- **IPC 桥接：** 将隔离的前端环境连接到原生的 Node.js 和系统 API。

## 2. IPC 通道映射分析 (`window.electronAPI` 接口)

对 `preload.ts` 和前端使用的分析揭示了必须迁移的以下 IPC 通道：

| Electron IPC 钩子    | 当前后端实现 (`main.ts`)                 | Tauri 迁移策略                                                        |
| :------------------- | :--------------------------------------- | :-------------------------------------------------------------------- |
| `getKbPath()`        | 从 `kb_config.json` 读取。               | 已由 Rust 基于 `app_config.toml` 完成（`get_kb_path`/`set_kb_path`），并在启动时自动迁移旧 JSON 配置。 |
| `getFolders()`       | 调用 `NoteController.getFolders()`。     | 迁移至针对 Node Sidecar 的 HTTP fetch (`GET /api/folders`)。          |
| `getContent(path)`   | 调用 `NoteController.getContent()`。     | 迁移至针对 Node Sidecar 的 HTTP fetch (`GET /api/content?path=...`)。 |
| `buildGraph(opts)`   | 调用 `NoteController.triggerBuild()`。   | 迁移至针对 Node Sidecar 的 HTTP POST，或触发 sidecar 的 Rust 命令。   |
| `checkCache(target)` | 检查 `data_[target].js` 的 `fs.stat`。   | 作为 Rust `#[tauri::command]` 实现。                                  |
| `restoreCache(t)`    | 将 `data_[target].js` 复制到 `data.js`。 | 作为 Rust `#[tauri::command]` 实现。                                  |
| `getUserLanguage()`  | 从 `kb_config.json` 读取。               | 已由 Rust 基于 `app_config.toml` 完成（`get_user_language`），并接入前端运行时初始化。 |
| `setUserLanguage()`  | 写入配置并更新系统菜单。                 | 已由 Rust `#[tauri::command]` 完成：更新 `app_config.toml`、重建 Tauri 菜单并广播统一语言更新事件。 |
| `on('build-log')`    | 接收来自构建过程的实时输出。             | Rust 拦截 Sidecar stdout 并使用 `app_handle.emit()` 推送至前端。      |

## 3. Node.js 服务器 (`server.ts`) 的 API 缺口

虽然 `server.ts` 暴露了 `/api/folders` 和 `/api/content`，但它**没有**暴露以下端点：

- 缓存管理 (`checkCache` / `restoreCache`)。
- 知识库路径选择。

这印证了混合架构计划的正确性：

1. **Rust (Tauri 后端):** 将处理操作系统级别的对话框、配置持久化、本地应用菜单和缓存文件复制。
2. **Node.js (Sidecar 进程):** 将专门处理重负荷逻辑 (Markdown 解析、NLP 图谱构建)，通过 HTTP 暴露。

## 4. 关键实施风险预警

1. **路径解析：** 目前，`main.ts` 中大量使用 `__dirname` 来定位 `../frontend/data.js`。在带有 sidecar 二进制文件的 Tauri 中，前端资源被注入到 Tauri bundle 中，而不是物理上位于 Node 可执行文件旁边。Rust 中的缓存机制必须指向 Tauri AppData 目录，而不是相对的 `frontend` 文件夹。
2. **Sidecar 生命周期：** Rust 必须确保在 Tauri 窗口关闭时强制终止 Node sidecar (`server.exe`)，否则它将变成僵尸进程并锁定 3000 端口。
3. **菜单重建：** 当用户调用 `setUserLanguage` 时，Tauri 的菜单系统必须能够从 Rust 侧被动态重建。
