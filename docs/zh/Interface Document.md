
# 2026-03-04 v1.5.13
# 接口文档 (v1.5.13)

本文件是当前代码状态下的权威接口交接文档。
本版不是在旧文档上追加，而是按源码核对后重建。

## 0. 核对范围

已逐一对照以下文件：

- `src/server.ts`
- `src/utils/RuntimePaths.ts`
- `src/index.ts`
- `src/core/NoteConnection.ts`
- `src/core/types.ts`
- `src/core/Graph.ts`
- `src/core/PathEngine.ts`
- `src/backend/config.ts`
- `src/backend/FileLoader.ts`
- `src/backend/GraphBuilder.ts`
- `src/backend/utils/frontmatterParser.ts`
- `src/backend/utils/WorkerRuntime.ts`
- `src/core/PathBridge.ts`
- `src-tauri/src/lib.rs`
- `src/frontend/source_manager.js`
- `src/frontend/path_app.js`
- `src/frontend/path_worker.js`
- `src/frontend/i18n.js`
- `src/frontend/index.html`
- `path_mode/scripts/ws_client.gd`
- `path_mode/scripts/path_mode_ui.gd`
- `path_mode/scripts/path_renderer.gd`
- `path_mode/scripts/learning_state_machine.gd`
- `path_mode/scripts/tree_view_panel.gd`

核对流程：

1. 先完整重读旧版 `Interface Document.md`。
2. 从源码重新提取接口。
3. 删除过期项并修正不一致。
4. 重建为完整英文部分 + 完整中文部分。

---

## 1. 运行时与路径契约

### 1.1 运行时路径解析（`src/utils/RuntimePaths.ts`）

```ts
interface RuntimePaths {
  projectRoot: string;
  frontendDir: string;
  runtimeDataDir: string;
  kbRoot: string;
}
```

优先级：

1. `projectRoot` 由候选路径 + 目录存在性判定。
2. `frontendDir`：
   - `NOTE_CONNECTION_FRONTEND_DIR`
   - `<projectRoot>/dist/src/frontend`
   - `<projectRoot>/src/frontend`
3. `kbRoot`：
   - `NOTE_CONNECTION_KB_ROOT`
   - `<projectRoot>/Knowledge_Base`
   - CWD 回退路径

### 1.2 Tauri sidecar 环境注入（`src-tauri/src/lib.rs`）

Rust 启动 sidecar 时注入：

- `NOTE_CONNECTION_PROJECT_ROOT`
- `NOTE_CONNECTION_KB_ROOT`
- `NOTE_CONNECTION_FRONTEND_DIR`

当前项目实际 KB 根路径：

- `E:\Knowledge_project\NoteConnection_app\Knowledge_Base`

### 1.3 图谱文件路径

活动图谱文件：

- `dist/src/frontend/data.js`
- `dist/src/frontend/graph_data.json`

目标缓存文件：

- `dist/src/frontend/data_<target>.js`
- `dist/src/frontend/graph_data_<target>.json`

CLI 时间戳文件：

- `dist/src/frontend/data_cli_<suffix>.js`
- `dist/src/frontend/graph_data_cli_<suffix>.json`

---

## 2. 核心类型接口

### 2.1 图结构类型（`src/core/types.ts`）

```ts
interface NoteNode {
  id: string;
  label: string;
  inDegree: number;
  outDegree: number;
  content?: string;
  x?: number;
  y?: number;
  centrality?: number;
  rank?: number;
  clusterId?: string;
  metadata?: {
    tags?: string[];
    prerequisites?: string[];
    next?: string[];
    filepath?: string;
    [key: string]: any;
  };
}

interface NoteEdge {
  source: string;
  target: string;
  type?: string;
  weight?: number;
}

interface GraphData {
  nodes: NoteNode[];
  edges: NoteEdge[];
}
```
### 2.2 构建 API 类型（`src/core/NoteConnection.ts`）

```ts
interface BuildOptions {
  targetPath?: string;
  maxWorkers?: number;
  enableGPU?: boolean;
  enableGPULayout?: boolean;
  memorySavingMode?: boolean;
  deepDebug?: boolean;
  projectRoot?: string;
  outputPrefix?: string;
  onLog?: (msg: string) => void;
}

interface GraphBuildResult {
  graph: Graph;
  data: any;
  stats: {
    nodeCount: number;
    edgeCount: number;
    fileCount: number;
  };
}
```

### 2.3 后端配置（`src/backend/config.ts`）

```ts
interface AppConfig {
  matchingStrategy: "exact-phrase" | "fuzzy";
  clusteringStrategy: "label-propagation" | "folder";
  fuzzyThreshold: number;
  enableTags: boolean;
  enableStatisticalInference: boolean;
  enableVectorSimilarity: boolean;
  enableHybridInference: boolean;
  enableGPU: boolean;
  enableGPULayout?: boolean;
  memorySavingMode: boolean;
  deepDebug: boolean;
  maxWorkers?: number;
  exclusionList: string[];
}
```

### 2.4 Worker 运行时解析（`src/backend/utils/WorkerRuntime.ts`）

```ts
interface WorkerRuntimeResolution {
  workerPath: string | null;
  isTsNode: boolean;
  candidates: string[];
}
```

---

## 3. 构建与图谱流水线接口

### 3.1 文件加载（`src/backend/FileLoader.ts`）

```ts
interface RawFile {
  filepath: string;
  filename: string;
  content: string;
}

FileLoader.loadFiles(dirPath: string, extensions = [".md"]): Promise<RawFile[]>
```

行为：

- 递归扫描目录。
- 分批并发读取。
- 目录不存在时返回空数组。

### 3.2 Frontmatter 解析（`src/backend/utils/frontmatterParser.ts`）

```ts
interface ParsedMetadata {
  tags: string[];
  prerequisites: string[];
  next: string[];
  [key: string]: any;
}

FrontmatterParser.parse(content: string): ParsedMetadata
FrontmatterParser.extractTags(content: string): string[]
```

支持 YAML 列表、行内数组、单值和 `[[WikiLink]]` 清洗。

### 3.3 图核心（`src/core/Graph.ts`）

主方法：

- `addNode(node)`
- `getNode(id)`
- `hasNode(id)`
- `addEdge(source, target, type?, weight?)`
- `getOutgoingEdges(id)`
- `getIncomingEdges(id)`
- `getNeighbors(id)`
- `getNodes()`
- `getEdges()`
- `toJSON()`
- `getPredecessors(id)`
- `getSuccessors(id)`
- `getShortestPath(source, target)`

### 3.4 图构建编排（`src/backend/GraphBuilder.ts`）

```ts
GraphBuilder.build(files, layout?): Promise<Graph>
```

阶段：

1. 节点初始化（含 metadata/tag）
2. 显式依赖边（`prerequisites`、`next`）
3. 关键词匹配（并行 worker 或顺序回退）
4. 统计推断
5. 向量相似度（`VectorSpace` 或 `VectorSpaceGPU`）
6. 混合推断
7. 聚类
8. 图指标
9. 环检测 + 拓扑排名
10. 后端布局计算（`LayoutEngine.computeLayout`）

并行关键词匹配契约：

- worker 路径由 `resolveWorkerRuntimePath` 解析。
- worker 不可用/失败时回退顺序匹配。

### 3.5 顶层构建输出（`src/index.ts`）

```ts
buildGraph(options: BuildOptions | string, ...legacyArgs): Promise<GraphData>
```

输出规则：

- 标准模式写入活动文件：
  - `graph_data.json`
  - `data.js`
- 指定目标目录时写入缓存副本：
  - `data_<target>.js`
  - `graph_data_<target>.json`
- CLI 模式写入 `data_cli_*` 与 `graph_data_cli_*`，不覆盖活动文件。

---

## 4. 前端加载接口

加载入口：`src/frontend/source_manager.js`

### 4.1 目录与 KB 路径获取

主路径：

- `GET /api/kb-path`
- `GET /api/folders`

Tauri 回退：

- `invoke("get_kb_path")`
- `invoke("get_folders")`

下拉契约：

- 永远包含 `ALL_FOLDERS`。
- 真实选项来自当前 KB 根目录子目录。

### 4.2 缓存检查/恢复弹窗

- 检查：`GET /api/check-cache?target=<id>`
- 命中缓存时必须二选一：
  - `Load Existing`
  - `Regenerate`
- 恢复：`GET /api/restore-cache?target=<id>`

### 4.3 加载单飞契约

前端防重：

- `isLoadInProgress`
- `loadBtn.dataset.sourceManagerBound`
- 会话重载防抖键 `nc_reload_guard`

构建请求载荷：

```json
{
  "target": "ALL_FOLDERS | <folderName>",
  "maxWorkers": 4,
  "enableGPU": true,
  "enableGPULayout": true,
  "memorySavingMode": false,
  "deepDebug": false
}
```

### 4.4 Tauri 下 Path 控件归属（`src/frontend/path_app.js`）

Tauri 模式：

- `#path-toolbar` 隐藏。
- Web Path Mode 设置组隐藏。
- 布局强制为 `orbital`。

浏览器模式：

- Web toolbar 仍负责 Mode/Strategy/Layout/Complete/History/Exit。

---

## 5. 服务端 HTTP API（`src/server.ts`）

基础地址：`http://localhost:3000`

### 5.1 GET 接口

| Endpoint | Query | 成功响应 | 说明 |
| --- | --- | --- | --- |
| `/api/folders` | 无 | `{ "folders": string[] }` | 当前 KB 根目录下子目录。 |
| `/api/content` | `path` | `{ "content": string }` | 文件内容读取。 |
| `/api/kb-path` | 无 | `{ "kbPath": string }` | 当前 KB 根路径。 |
| `/api/check-cache` | `target` | `null` 或 `{ "date": string, "size": number, "source"?: "active" }` | `ALL_FOLDERS` 检查活动缓存。 |
| `/api/restore-cache` | `target` | `{ "success": boolean, "deduped"?: true, "error"?: string }` | 内置短窗去重。 |

附加静态行为：

- 非 `/api/` 的 `*.js` / `*.json` 从 frontend 输出目录读取。

### 5.2 POST 接口

| Endpoint | Body | 成功响应 | 说明 |
| --- | --- | --- | --- |
| `/api/build` | `{ target, maxWorkers, enableGPU, enableGPULayout, memorySavingMode, deepDebug }` | `{ "success": true }` 或 `{ "success": true, "deduped": true }` | 相同参数并发合并；不同参数并发返回 `409`。 |
| `/api/kb-path` | `{ "kbPath": string }` | `{ "success": true, "kbPath": string }` | 更新运行时 KB 根路径。 |

### 5.3 构建去重语义

- 在途构建 + 相同参数：等待并返回去重成功。
- 在途构建 + 不同参数：返回 `409`。

### 5.4 CLI 参数说明

- 支持 `--path`、`--gpu`、`--no-gpu`、`--workers`。
- 同时读取 npm 环境参数和 `NOTE_CONNECTION_GPU`。
- npm 脚本建议用环境变量启用 GPU（`NOTE_CONNECTION_GPU=1`）。

---
## 6. Tauri Rust 命令与事件接口（`src-tauri/src/lib.rs`）

### 6.1 可调用命令

| 命令 | 签名 | 返回 |
| --- | --- | --- |
| `get_kb_path` | `() -> Result<String, String>` | 默认 KB 路径 `<projectRoot>/Knowledge_Base`。 |
| `get_user_language` | `() -> Result<String, String>` | 当前语言（现默认 `"en"`）。 |
| `get_folders` | `() -> Result<Vec<String>, String>` | KB 子目录排序结果。 |
| `set_user_language` | `(app, lang) -> Result<(), String>` | 菜单语言幂等更新。 |
| `check_cache` | `(app, target) -> Result<Option<Value>, String>` | 缓存信息或 `None`。 |
| `restore_cache` | `(app, target) -> Result<bool, String>` | 恢复成功返回 `true`。 |

### 6.2 菜单与事件

菜单动作：

- `change_kb`
- `reset_kb`
- `docs`
- `about`

发给前端的事件：

- `kb-path-changed`（payload 为路径字符串）

### 6.3 Sidecar 与 Godot 进程契约

- Sidecar 进程：`server`
- Godot 启动参数：
  - `--path E:\Knowledge_project\NoteConnection_app\path_mode`

---

## 7. PathBridge WebSocket 协议（`src/core/PathBridge.ts`）

Bridge 地址：`ws://127.0.0.1:9876`

客户端标识：

- 通过 query 参数 `client` 标记来源。
- 示例：
  - `ws://127.0.0.1:9876/?client=godot`
  - `ws://localhost:9876?client=frontend`

消息包格式：

```json
{ "type": "<messageType>", "payload": {} }
```

支持的消息类型：

- `nodeClick`
- `requestPath`
- `pathResult`
- `markComplete`
- `switchCenter`
- `openReader`
- `unmarkComplete`
- `completionSync`
- `toggleCollapse`
- `expandPrereqs`
- `collapsePrereqs`
- `collapseAll`
- `configure`
- `exitPathMode`

常见 payload 键：

- `{ nodeId }`
- `{ newCenterId, autoReconstruct? }`
- `{ completedIds, timestamp? }`

当前实现会将识别消息广播给已连接客户端。

---

## 8. Path Worker 与路径载荷接口

### 8.1 Path worker（`src/frontend/path_worker.js`）

入站消息：

- `initData` -> `{ nodes, links }`
- `computePath` -> `{ mode, strategy, layout, targetId, centralId, collapsedIds, completedIds, forcedExpansionIds, expansionOrder, stickyClaimEnabled }`

出站消息：

- `pathResult` -> `{ nodes, edges, treeLayout }`

### 8.2 Web PathApp 发给 Godot 的路径载荷（`src/frontend/path_app.js`）

```json
{
  "type": "pathResult",
  "payload": {
    "central": { "id": "", "label": "", "inDegree": 0, "outDegree": 0 },
    "peripherals": [{ "id": "", "label": "", "relation": "prerequisite|association" }],
    "progress": { "completed": 0, "total": 0 },
    "totalNodes": 0,
    "pathNodes": [{ "id": "", "label": "", "parentId": null }],
    "treeLayout": { "nodes": [], "edges": [] },
    "completedIds": [],
    "mode": "orbital"
  }
}
```

当 `treeLayout` 为空时，Godot 会回退到 legacy 线性渲染流程。

---

## 9. Godot 接口契约

### 9.1 WS 客户端（`path_mode/scripts/ws_client.gd`）

关键常量：

- `WS_URL = "ws://127.0.0.1:9876/?client=godot"`
- `RECONNECT_DELAY = 3.0`

Signals：

- `data_received(data)`
- `connected`
- `disconnected`
- `path_result(data)`
- `path_update(data)`
- `switch_center(new_center_id)`
- `completion_sync(completed_ids, timestamp)`

发送方法：

- `send_node_click`
- `send_mark_complete`
- `send_open_reader`
- `send_switch_center`
- `send_configure`
- `send_toggle_collapse`
- `send_expand_prereqs`
- `send_collapse_prereqs`
- `send_collapse_all`
- `send_exit_path_mode`

### 9.2 Path UI（`path_mode/scripts/path_mode_ui.gd`）

Signals：

- `mark_complete_pressed`
- `sidebar_toggled(visible)`
- `completed_node_clicked(node_id)`
- `return_pressed`
- `return_to_node(node_id)`
- `tree_node_clicked(node_id)`
- `unmark_requested(node_id)`
- `mark_node_requested(node_id)`
- `node_toggle_requested(node_id)`
- `node_expand_prereqs_requested(node_id)`
- `node_collapse_prereqs_requested(node_id)`
- `collapse_all_requested()`
- `settings_updated(settings)`
- `exit_requested`

发送到后端的运行时配置：

```json
{ "mode": "domain|diffusion", "strategy": "foundational|core", "layout": "orbital", "targetId": "<可选>" }
```

### 9.3 学习状态机（`path_mode/scripts/learning_state_machine.gd`）

状态：

- `IDLE`
- `VIEWING`
- `TRANSITIONING`
- `READING`

Signals：

- `state_changed`
- `central_changed`
- `node_completed`
- `node_unmarked`
- `path_complete`

持久化路径：

- `user://orbital_progress.json`

### 9.4 Path 渲染器（`path_mode/scripts/path_renderer.gd`）

Signals：

- `node_clicked(node_id)`
- `node_double_clicked(node_id)`
- `transition_complete()`

关键处理器：

- `render_path(path_data)`
- `_on_ws_data_received(data)`
- `_on_settings_updated(settings)` -> 发送 `configure`
- `_request_switch_center(target_id)` -> 发送 `switchCenter`
- `_on_mark_node_requested(node_id)` -> 发送 `markComplete`
- `_on_unmark_requested(node_id)` -> 发送 `unmarkComplete`
- `_on_exit_requested()` -> 发送 `exitPathMode`

### 9.5 树面板（`path_mode/scripts/tree_view_panel.gd`）

上抛信号：

- `node_navigate_requested`
- `node_mark_complete_requested`
- `node_unmark_requested`
- `node_toggle_requested`
- `node_expand_prereqs_requested`
- `node_collapse_prereqs_requested`
- `collapse_all_requested`
- `fullscreen_requested(expand)`

---

## 10. Web 与 Tauri 的 Path 控件归属矩阵

| 接口区域 | 浏览器模式 | Tauri 模式 |
| --- | --- | --- |
| Path toolbar（`#path-toolbar`） | 显示且可交互 | 被 `path_app.js` 隐藏 |
| Mode 控制 | Web 下拉（`#learning-mode`） | Godot `PathModeUI` |
| Strategy 控制 | Web 下拉（`#strategy`） | Godot `PathModeUI` |
| Layout 控制 | Web 下拉（`#layout-style`） | 后端/Godot 固定 `orbital` |
| Diffusion 目标选择 | Web modal（`#node-select-modal`） | Godot 目标弹窗 |
| Complete 操作 | Web 按钮（`#btn-mark-complete`） | Godot 按钮 |
| History 操作 | Web 侧栏/弹窗 | Godot 历史弹窗 |
| Exit 操作 | Web 按钮（`#btn-exit-path`） | Godot 退出流程 + `exitPathMode` |

这就是当前 Bridge-first 迁移契约。

---

## 11. 已修正 / 已移除的不一致项

1. 删除中英混排与重复段落，重建为严格 EN/ZH 分离结构。
2. 用 `server.ts` 实际实现替换过期 API 描述。
3. 修正 Godot WS URL 约束：
   - 正确：`ws://127.0.0.1:9876/?client=godot`
4. 明确当前 build/cache 去重语义。
5. 明确当前 Tauri 命令名与返回结构。
6. 补齐 Path worker 载荷与 Godot signals 契约。
7. 明确 Tauri 下 Path 控件归属已迁移到 Godot。

---

## 12. 交接检查清单

1. 目录来源必须是当前 KB 根（`/api/folders` 或 Rust 回退）。
2. 存在缓存时必须先出现“加载缓存/重新生成”选择。
3. 单次点击只触发一次 load/build。
4. 活动图谱文件必须来自 `dist/src/frontend`。
5. 模式/策略变更应触发 `configure` 并得到 `pathResult`。
6. 正常路径更新时 Godot 应收到非空 `treeLayout`。
7. Tauri 模式隐藏 Web path toolbar；浏览器模式保留。

---

---

## 13. 接口更新日志归位说明

- 规范的双语更新日志统一归档在 [`export.md`](export.md)。
- 本文档聚焦接口契约，历史迁移日志不再前置于文件开头。
- 相关接口增量版本：
- `2026-03-02 v1.5.1`：接口增量：Tauri 运行时能力对齐更新

### 已归档接口增量日志块（可追溯）
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
