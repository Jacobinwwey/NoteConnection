# 操作指南：Godot + NoteMD + Markdown 工作流

本指南把当前运行时契约转成可执行的日常操作步骤，便于在继续功能开发前完成稳定性固化。

## 1. 适用范围

当你需要以下能力时，请先走本指南：

- 运行 Godot 渲染的 Path Mode，
- 在 Godot 内操作嵌入式 NoteMD 面板，
- 调试 Markdown 的索引/分块/Wiki 跳转链路。

字段级接口定义请配合阅读：

- [Godot + NoteMD + Markdown 接口参考](../reference/godot-notemd-markdown-interfaces.md)

## 2. 运行时启动

### 2.1 桌面开发启动

使用标准桌面流程：

```bash
npm run tauri:dev
```

`tauri:dev` 会先构建前端、确保 sidecar、清理陈旧复制 sidecar，再启动 Tauri。

### 2.2 运行时清单与 sidecar 地址

Godot 客户端解析 sidecar 地址的优先级：

1. 环境变量（`NOTE_CONNECTION_PORT`、`NOTE_CONNECTION_BRIDGE_PORT`），
2. 运行时清单（`NOTE_CONNECTION_RUNTIME_MANIFEST`），
3. 默认值（HTTP `127.0.0.1:3000`，Bridge `127.0.0.1:9876`）。

运行时清单包含：

- `baseUrl`（HTTP sidecar），
- `bridgeWsUrl`（PathBridge WebSocket），
- `authToken`（若启用鉴权）。

## 3. Godot Path Mode 工作流

### 3.1 单窗口行为

在 Tauri 单窗口模式中：

- Godot 可隐藏启动，并通过 Bridge 可见性消息显示，
- 退出 Path Mode 会发送 `exitPathMode`，前端/Tauri 恢复主窗口。

### 3.2 核心 Bridge 控制消息

Godot `ws_client.gd` 会发送：

- `configure`,
- `switchCenter`,
- `markComplete` / `unmarkComplete`,
- `toggleCollapse` / `expandPrereqs` / `collapsePrereqs` / `collapseAll`,
- `exitPathMode`,
- `open_notemd`,
- `requestAppShutdown`。

PathBridge 会做消息归一化并广播给前端消费者。

## 4. Godot 内嵌 NoteMD 工作流

嵌入面板（`notemd_embed_panel.gd`）提供：

- 一键抽取：`POST /api/notemd/one-click-extract`
- 批量生成：`POST /api/notemd/generate-folder-content`
- 批量 Mermaid 修复：`POST /api/notemd/batch-fix-mermaid`
- 工作区同步：
  - `GET /api/notemd/workspace`
  - `POST /api/notemd/workspace`

### 4.1 推荐操作顺序

1. 在嵌入面板选择源 Markdown 文件。
2. 执行 One-Click Extract（概念脚手架 + 内容生成）。
3. 执行 Batch Mermaid Fix（批量图表修复）。
4. 需要完整 UI 时点击 "Open Full Workspace (Tauri)"。

### 4.2 PDF 处理约束

嵌入式 NoteMD 不直接处理 PDF。

- 请先将 PDF 转为 `.md`（例如 MinerU），
- 再通过 NoteMD API 处理 Markdown。

## 5. Markdown Reader 工作流

Godot Reader 运行时调用：

- `POST /api/markdown/resolve-node`
- `POST /api/markdown/index`
- `POST /api/markdown/chunk`
- `POST /api/markdown/resolve-wiki`

推荐阅读链路：

1. 先 resolve node，拿到文件与目标 block，
2. 建立/复用索引（`indexId`），
3. 通过 `indexId` 分块拉取并渲染，
4. 使用 `currentFilePath` 做 Wiki 链接上下文跳转。

## 6. 渲染与剪贴板链路

Reader 渲染接口：

- `POST /api/render/math`
- `POST /api/render/mermaid`

剪贴板接口：

- 首选：`POST /api/clipboard/image-binary`（PNG 二进制），
- 回退：`POST /api/clipboard/image`（JSON `pngBase64`）。

Mermaid 渲染策略：

- 优先使用 frontend-bridge 渲染，
- `auto` 下前端不可用会回退到本地 `resvg`，
- Godot 运行时以 PNG 载荷为权威输入。

## 7. 鉴权与访问控制

当设置了 `NOTE_CONNECTION_AUTH_TOKEN`：

- 所有 `/api/*` 与图谱产物文件都需要鉴权，
- 客户端可通过以下任一方式传 token：
  - `X-NoteConnection-Token: <token>`
  - `Authorization: Bearer <token>`

Godot 的 WS identify 可携带 `token`，HTTP helper 也会在 token 存在时自动加头。

## 8. 高频故障排查

### 8.1 Markdown 索引失败

重点检查：

- `filePath` 非空，
- 后缀是 `.md` 或 `.markdown`，
- 文件大小未超过 `maxDocBytes`，
- 路径在 KB 根目录内。

### 8.2 NoteMD 请求被拒绝

常见原因是 KB 根路径沙箱校验失败。

- 确认文件/目录位于 `Knowledge_Base` 内，
- 如启用鉴权，确认 token 正确。

### 8.3 Godot Mermaid 渲染空白

重点检查：

- 响应是否包含 `pngBase64`，
- frontend bridge 渲染器是否在线，
- 是否已触发本地 fallback 渲染用于诊断。

## 9. 下一阶段开发前基线清单

- `path-mode/settings` 的 GET/POST 往返正常。
- `notemd/workspace` 同步正常（读取恢复 + 写回）。
- One-click extract / generate-folder / batch-fix 流程正常。
- Markdown resolve/index/chunk/wiki API 全链路正常。
- `open_notemd` 与 `exitPathMode` 桥接事件正常。
- Mermaid 渲染与剪贴板复制链路正常。

在以上基线通过前，不进入下一步功能开发。
