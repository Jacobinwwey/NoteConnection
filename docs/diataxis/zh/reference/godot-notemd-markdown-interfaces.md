# 参考：Godot + NoteMD + Markdown 接口契约

本页是以下集成运行时的契约级参考：

- Godot Path Mode 客户端，
- 嵌入式/完整 NoteMD 工作流，
- Markdown 索引/分块/渲染管线。

## 1. 运行时契约边界

## 1.1 Sidecar 与 Bridge 端点

- Sidecar HTTP：`http://127.0.0.1:<port>`（默认 `3000`）
- PathBridge WS：`ws://127.0.0.1:<bridgePort>`（默认 `9876`）
- 运行时清单字段：
  - `baseUrl`
  - `bridgeWsUrl`
  - `authToken`
  - `port`
  - `bridgePort`

## 1.2 鉴权策略

若配置了 `NOTE_CONNECTION_AUTH_TOKEN`：

- 所有 `/api/*` 路由受保护，
- 图谱产物文件受保护，
- token 可通过以下任一方式传递：
  - `X-NoteConnection-Token`，
  - `Authorization: Bearer <token>`。

Godot WS 的 identify 载荷也可携带 `token`。

## 2. 设置接口

## 2.1 NoteMD 设置

- `GET /api/notemd/settings`
  - 成功返回：
    - `success: true`
    - `settings: NotemdSettings`
    - `operationSummary: { total, running }`
- `POST /api/notemd/settings`
  - body：完整 settings 对象，或 `{ settings: ... }`
  - 成功返回：`{ success: true, settings }`

## 2.2 NoteMD 工作区

- `GET /api/notemd/workspace`
  - 成功返回：`{ success: true, workspace }`
  - workspace 字段：
    - `filePath`
    - `folderPath`
    - `outputFilePath`
    - `outputFolderPath`
- `POST /api/notemd/workspace`
  - body：`workspace` patch 或直接 patch 对象
  - 支持 workspace 字段的 camel/snake 别名
  - 成功返回：`{ success: true, workspace }`

## 2.3 Path Mode 设置

- `GET /api/path-mode/settings`
  - 成功返回：`{ success: true, settings }`
- `POST /api/path-mode/settings`
  - body：`{ settings: ... }` 或直接设置对象
  - 成功返回：`{ success: true, settings }`

`path_mode` 归一化约束：

- `bg_brightness`: `0.01..10.0`
- `reading_mode`: `window | fullscreen`
- `reader_render_mode`: `render | source`
- `reader_media_scale`: `0.1..3.0`
- `node_spacing`: `100..600`

## 2.4 Frontend 设置（Markdown 运行时来源）

- `GET /api/frontend/settings`
- `POST /api/frontend/settings`

`frontend_settings.reading` 归一化约束：

- `markdown_engine`: `legacy | pulldown | auto`
- `chunk_block_size`: `1..4096`
- `prefetch_blocks`: `0..1024`
- `index_cache_ttl_sec`: `5..86400`
- `max_doc_bytes`: `262144..2147483648`

## 3. Markdown 协议接口

所有 markdown 响应都包含 `markdownProtocolVersion`（当前基线 `1.0.0`）。

## 3.1 `POST /api/markdown/index`

请求体：

```json
{
  "filePath": "E:/.../Knowledge_Base/Topic/a.md",
  "forceRebuild": false
}
```

成功载荷：

- `success: true`
- `indexId`
- `filePath`
- `fileVersion`
- `totalBytes`
- `totalLines`
- `blocksSummary: { totalBlocks, chunkBlockSize }`
- `anchorsSummary: { count }`
- `wikiLinksSummary: { count }`
- `engine: legacy | pulldown`
- 可选 `fallbackReason`
- `markdownProtocolVersion`

错误条件：

- `400`：缺少 `filePath`
- `403`：访问被拒绝（KB 沙箱/鉴权）
- `404`：文件不存在
- `500`：运行时/worker 错误

## 3.2 `POST /api/markdown/chunk`

请求体：

```json
{
  "indexId": "<index-id>",
  "startBlock": 0,
  "blockCount": 36
}
```

成功载荷：

- `success: true`
- `blocks[]`（包含文本切片与块范围）
- `nextStartBlock`
- `hasMore`
- `markdownProtocolVersion`

错误条件：

- `400`：缺少 `indexId`
- `500`：索引丢失/过期或其他服务端错误

## 3.3 `POST /api/markdown/resolve-node`

请求体：

```json
{
  "nodeId": "vector-space",
  "currentFilePath": "E:/.../current.md"
}
```

成功载荷：

- `success: true`
- `filePath`
- `indexId`
- `targetBlockId`
- `startLine`
- `endLine`
- 可选 `anchorId`
- `markdownProtocolVersion`

错误条件：

- `400`：缺少 `nodeId`
- `403`：访问被拒绝
- `404`：文件不存在
- `500`：节点无法解析或服务端错误

## 3.4 `POST /api/markdown/resolve-wiki`

请求体：

```json
{
  "wikiTarget": "Knowledge Base#Heading|Alias",
  "currentFilePath": "E:/.../current.md"
}
```

成功载荷：

- `success: true`
- `filePath`
- `indexId`
- 可选 `targetBlockId`
- 可选 `anchorId`
- `matchType: exact | alias | heading | fallback`
- 可选 `candidates[]`
- `markdownProtocolVersion`

错误条件：

- `400`：缺少 `wikiTarget` 或 `currentFilePath`
- `403`：访问被拒绝
- `404`：文件不存在
- `500`：服务端错误

## 4. NoteMD 处理接口

## 4.1 操作模型与取消

长任务在服务端维护操作状态：

- 生命周期：`running -> done | cancelled | error`
- 取消接口：`POST /api/notemd/cancel`，携带 `operationId`

取消返回语义：

- `400` 缺少 `operationId`
- `404` 未找到操作
- `200` `success: false`（操作已非运行态）
- `200` `success: true`（取消成功）

## 4.2 流式契约（SSE）

满足以下任一条件即开启流式：

- 请求 `Accept` 包含 `text/event-stream`，或
- query 包含 `stream=1`。

SSE 事件类型：

- `operation`
- `status`
- `log`
- `warning`
- `error`
- `done`

## 4.3 核心 NoteMD 端点

- `POST /api/notemd/test-llm`
  - body: `{ providerName? }`
- `POST /api/notemd/process-file`
  - body: `{ filePath, outputPath?, createConceptNotes?, dryRun?, operationId? }`
- `POST /api/notemd/process-folder`
  - body: `{ folderPath, outputFolderPath?, createConceptNotes?, dryRun?, operationId? }`
- `POST /api/notemd/generate-content`
  - body: `{ title?, filePath?, context?, outputPath? }`
- `POST /api/notemd/translate-file`
  - body: `{ filePath, targetLanguage?, outputPath? }`
- `POST /api/notemd/translate-folder`
  - body: `{ folderPath, targetLanguage? }`
- `POST /api/notemd/fix-mermaid`
  - body: `{ filePath, inPlace? }`
- `POST /api/notemd/fix-formulas`
  - body: `{ filePath, inPlace? }`
- `POST /api/notemd/check-duplicates`
  - body: `{ filePath }`
- `POST /api/notemd/extract-concepts`
  - body: `{ filePath, operationId? }`，支持 SSE
- `POST /api/notemd/one-click-extract`
  - body: `{ filePath, operationId? }`
- `POST /api/notemd/batch-fix-mermaid`
  - body: `{ folderPath, inPlace? }`
- `POST /api/notemd/generate-folder-content`
  - body: `{ folderPath }`

安全不变量：

- 文件/目录路径在 I/O 前必须通过 KB 根路径沙箱校验。

## 5. Reader 渲染与剪贴板接口

## 5.1 `POST /api/render/math`

请求字段：

- `source`（必填）
- `displayMode`（默认 true）
- `maxWidth`、`maxHeight`、`renderScale`（可选）

返回包含 `pngBase64` 与尺寸信息的渲染结果。

## 5.2 `POST /api/render/mermaid`

请求字段：

- `source`（必填）
- 可选：
  - `maxWidth`、`maxHeight`、`renderScale`
  - `includeStages`、`includeSvg`
  - `renderer`（`frontend|bridge|local|auto`）

运行时行为：

- 非显式 `local` 时优先 frontend bridge 渲染，
- `auto` 模式下 frontend 不可用则回退本地 `resvg`。

Obsidian 兼容性基线：

- Mermaid 的权威输入格式为 fenced Markdown：
  - 起始 fence 独占一行：\`\`\`mermaid
  - 结束 fence 独占一行：\`\`\`
- 该基线必须在 markdown 索引/分块管线，以及 Godot/Web Reader 渲染链路中持续兼容。
- `$$```mermaid` 这类同行拼接属于 malformed 内容（非标准 fenced 起始），预期会导致块类型识别失败。
- 推荐修复方式：将 `$$```mermaid` 拆成两行（先 `$$`，再 ` ```mermaid`），或执行：
  - `npm run fix:markdown:mermaid:fence -- Knowledge_Base/testconcept`
- Reader 运行时快速自检：打开 Markdown 阅读器时，渲染前会对 `$$```mermaid` 做轻量自动修复。

## 5.3 剪贴板接口

- `POST /api/clipboard/image-binary`
  - raw PNG body
  - 成功：`{ ok: true, transport: "binary" }`
- `POST /api/clipboard/image`
  - JSON `{ pngBase64 }`
  - 成功：`{ ok: true }`

## 6. 与 NoteMD/Markdown 相关的 PathBridge 消息契约

接受并归一化的消息类型包括：

- `openNotemd` / `open_notemd` -> 广播 `openNotemd`
- `exitPathMode` -> 广播 `exitPathMode`
- `requestAppShutdown` / `request_app_shutdown` -> 广播 `requestAppShutdown`
- `setWindowVisible` -> 广播 `setWindowVisible`

前端 `path_app.js` 行为：

- `openNotemd` 触发嵌入式/完整 NoteMD 打开路径。
- `exitPathMode` 恢复图谱主视图（配置允许时同步恢复 Tauri 窗口）。
- `requestAppShutdown` 在可用时调用 Tauri 关闭命令。

## 7. 关键兼容性不变量

Godot Mermaid 消费必须保持 PNG 优先：

- 运行时显示路径必须有 `pngBase64`，
- SVG 仅可用于诊断，
- 不允许存在 SVG-only 的 Godot 运行时回退链路。

这是硬性兼容规则，原因是 Godot 在不同设备/运行时上的 SVG 稳定性不足。

## 8. 接口变更实施护栏

当变更上述任一端点/消息时：

1. 同步更新 `docs/diataxis` 下 EN 与 ZH 文档，
2. 请求/响应示例必须与真实字段同步版本化，
3. 必须保留文件/目录输入的 KB 沙箱校验，
4. 必须保留受保护路由的 auth-token 行为，
5. 必须保留长任务的 NoteMD 取消 + SSE 语义，
6. 必须保留 markdown 响应中的协议版本字段。
