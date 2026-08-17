## 中文文档

### 2026-06-10 知识工作区运行演练

1. 用户选择或继承一个 scoped workspace/corpus target。
2. `agent_workspace.js` 会把 `activeTarget` 与 `scope` 一并发送到 conversation 请求中。
3. `KnowledgeLearningPlatform.agentConversation()` 解析 scoped retrieval、grouped knowledge point、citation、memory action 与 durable `knowledgeRun`。
4. `conversationComposer.ts` 会把 grounded reply 组织为结构化 block，同时继续保留 legacy `assistantMessage`。
5. 前端渲染回答，并展示按文件优先的 grouped knowledge hit。
6. 原始 markdown 可在 graph-focus pane 中打开，并在原文内高亮 matched span。
7. `flashcard_batch` 与 `knowledge_run` 这类 durable workflow artifact 现在也可以通过独立运行时端点进行查询与 follow-up。

### 当前这意味着什么

- 结构化 grounded conversation 已进入可运行状态。
- graph focus 已经是 reader-aligned 的证据阅读面。
- durable artifact 驱动的 review loop 已经进入运行时。
- 当前 DAG 学习底座是真实存在的，但回答规划层仍缺 dedicated graph-conditioned context layer。

### 当前运行链路说明

本补充说明记录了迁移后 Bridge-first 的当前运行流程：

1. Tauri 启动 Rust 宿主进程。
2. Rust 拉起 Node Sidecar 与 Godot 可执行文件。
3. Godot 连接 PathBridge（`ws://127.0.0.1:9876`）。
4. 后端通过桥接消息接收配置与路径动作。
5. 图数据从缓存恢复或重新构建后，同步给前端/Godot 使用方。

### 已可用能力

- 在 Tauri mini GPU 运行下，Sidecar 启动与图构建流水线可正常执行。
- 图构建的 worker 阶段（关键词/统计/布局）在 Sidecar 运行时路径解析正确。
- Path Mode 控制迁移已可用，由 Godot 侧设置与动作驱动。

### 仍需验证项

- 缓存已存在时，应稳定提示用户选择复用缓存或重建。
- 单次加载动作不应触发重复执行。
- WebSocket 启动时序应避免早期重复断开/重连。
- Godot 双击切换中心节点时，History 记录应同步更新。

### 验证清单

1. 运行 `npm run tauri:dev:mini:gpu`。
2. 选择一个已有缓存数据的源。
3. 确认只出现一次提示，且只执行一次加载路径。
4. 确认 Sidecar 日志中无重复 build/restore。
5. 确认 Godot 切换中心节点后 History 列表有记录。


# 路径模式改进演练 (Path Mode Improvements Walkthrough)

## 1. 关键修复：导航失败 (Critical Fix: Navigation Failure)

**问题 (Issue)**: 双击节点或切换中心时，由于更新负载中缺少 `treeLayout` 数据，树状视图会崩溃并恢复为线性列表。
**修复 (Fix)**: 更新了 [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js) 的 [switchCentral](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#1004-1014) 函数，显式调用 [triggerUpdate()](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#539-566)。这强制 Web Worker 在将新的中心节点发送到 Godot 之前重新计算完整的 `treeLayout`（包括正确的层级和连接）。

## 2. 视觉增强 (Visual Enhancements) (Godot)

- [x] **入度显示设置**: 在节点弹窗中添加了选项，用于在“可见” (默认) 和“总计”入度计数之间切换。
- [x] **Godot 懒加载**: 在 Godot 树状视图中实现了“展开 (+)”和“折叠 (-)”按钮，以管理前置节点的可见性。
- [x] **国际化修复**: 为英语和中文语言环境添加了缺失的键 `focus_inbound`/`focus_outbound`。

### Godot 树状视图功能 (Godot Tree View Features)

- **视觉效果 ("禅模式")**: 简化视图，移除所有额外按钮。仅节点和连接可见。
- **交互**:
  - **双击 / 右键单击**: 切换上下文（展开/折叠前置节点）。
  - **长按 (左键)**: 导航到节点（切换中心）。通过进度环叠加层可视化。
  - **中键单击**: 折叠所有节点（重置视图）。
- **专注模式**:
  - 通过设置切换（“聚焦于此节点”）。
  - 高亮显示中心节点及其直接传入的前置节点。
  - 调暗所有其他节点以减少混乱并专注于直接依赖关系。
- 这创造了一个更清晰、更少混乱的树，其中线条仅连接直接邻居（Level 1 → Level 2），按要求。

**末端节点清理**:

- “展开”按钮逻辑依赖于数据验证。由于 `treeLayout` 现在可以正确重新计算，对应于链末端的“目标”节点正确报告布局中的 `0` 个子节点，因此展开按钮将自动隐藏。

## 验证 (Verification)

- **导航**: 树状视图中的双击节点现在可以正确保持树状视图处于活动状态并重新居中图表。
- **美学**: 移除了跳层级的长而混乱的贝塞尔曲线。
- **数据**: 入度数字可见。

## 3. Bug 修复 (Bug Fixes) (交互与数据)

- **缺失边**: 通过在 [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js) 中清理数据（将对象引用转回 Workers 的 ID 字符串），修复了 `treeLayout` 只有 0 条边的问题。
- **右键切换**: 修复了“无法折叠”的 Bug：
  - 修补 [path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js) 以正确传递 `isExpanded` 状态。
  - 更新 [PathBridge.ts](file:///e:/Knowledge_project/NoteConnection_app/src/core/PathBridge.ts) 以转发 [collapsePrereqs](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#247-254) 消息（以前被丢弃）。
- **全部折叠**:
  - 在 Godot UI 中添加了一个可见的 `[-]` 按钮。
  - 更新 [PathBridge.ts](file:///e:/Knowledge_project/NoteConnection_app/src/core/PathBridge.ts) 以转发 [collapseAll](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#255-261) 消息。


# v1.4.3 - 9 规则树形布局引擎演练 (2026-02-26)

## 分析摘要

对 `tree_path_mockup.html`（702 行，9 条规则）和生产代码进行了全面的差距分析。

### 分析的文件

| 文件                    | 行数 | 用途                        |
| ----------------------- | ---- | --------------------------- |
| `tree_path_mockup.html` | 702  | 包含所有 9 条规则的参考实现 |
| `path_core.js`          | 1375 | 生产核心算法                |
| `tree_renderer.gd`      | 531  | Godot 树可视化              |
| `tree_view_panel.gd`    | 159  | Godot 面板控制器            |
| `path_app.js`           | 1166 | 前端桥接和交互处理          |

### 关键发现

- **9 条规则中有 8 条**在生产代码中完全缺失
- **5 个核心概念**缺失：所有权、展开顺序、有效索引、可见性链、hull 碰撞避让
- **7 个现有特性**保留：脊柱识别、轮廓碰撞、支流放置、hull 绘制、折叠状态、WebSocket 桥、树渲染器
- 生产代码**几何上正确**但缺乏语义认领/所有权层

### 更新的文档

- `implementation_plan.md` — 第三阶段，13 个步骤
- `brainstorming.md` — 会话 6：所有权引擎设计
- `task.md` — v1.4.3 清单（中英双语）
- `TODO.md` — v1.4.3 实施清单

### 后续步骤

跨 4 个组件（核心算法、前端桥接、Godot 渲染器、Worker 通信）实施 13 个步骤。

## 2026-08-17 身份与移动端门禁演练

target/data 构建与 `NoteConnection` 会把 `kbRoot` 传入 `FileLoader`，因此全库与子目录扫描生成一致的 `relativePath` 与 `sourceUri`；省略 root 的旧调用仅作为兼容路径。学习摄入保留可选身份字段，只提供新路径的 move 不清空 URI/revision，并在旧 path normalizer 之前解析 URI/alias 删除。Android 在读取正文前检查元数据大小，拒绝超出文档数、字节数或边数预算的导入；读取时直接提取 link candidate，中间 projection 不保留语料正文。这是 admission guard，不是真机 RSS 证据。
- 第 8 阶段 replay 会先校验临时 graph 再原子替换，记录显式文档移动，并为旧布局/删除保留 alias。移动 exact analysis 现在可解析 URI/alias 并报告 explicit/inferred 边 provenance，同时不携带正文。Bridge 2.0 的 capability/cancellation 字段是 additive；真机/APK 与 registry parity 证据仍待补齐。当前证据为 replay/identity 35 个测试、core/route 70 个测试、learning 501 个测试、mobile contract 51 个测试与 Rust 26 个测试。

## 2026-08-17 第 9 阶段验证

route shadow 已通过 14 条 legacy-equivalent 与 6 条 registry-only probe。它实际捕获并修复了 response shape 和错误状态码漂移，而不是在比较器中吞掉差异；`NOTE_CONNECTION_ROUTE_DISPATCH_MODE=legacy` 仍可用于回滚诊断。

APK/AAB verifier 是静态且轻量的：读取 ZIP central-directory metadata，release 模式要求 arm64，拒绝 Godot/sidecar/model/SVG 泄漏，执行 profile payload budget，并要求显式 RSS JSON。SQLite 现在有 close/reopen replay fixture，graph restore 有原子回滚 fixture。签名 arm64 产物、真机 RSS、跨 host replay 和 canonical-ID 切换仍未完成。
## 2026-08-17 第 10 阶段 Projection 与 Host Adapter Walkthrough

- `knowledge_projection_contract.js` 在 mobile analyzer 与 storage provider 之前加载，因此 Capacitor 和 browser replay 使用同一份无正文 schema。
- Tauri Rust 输出 schema `1`、身份元数据与有界 adjacency；Android 在提取 link 后继续清除正文。
- `PathBridgeHostAdapter` 为可选能力，未配置时保留旧 relay 语义；配置后返回 correlated result，并处理 timeout、断连、abort 与 cancel 传播。
- 已通过 `build:mini`、mobile-slim staging（120 个文件 / 未压缩 4,251,345 / 估算压缩 1,545,813 字节）、migration matrix（57 suite / 307 个测试）、projection/Bridge 定向测试、`cargo check` 与 Rust 定向测试。本机未安装 `rustfmt`；签名 arm64 APK/AAB 与真机 RSS 仍未完成。

## 2026-08-18 Projection Store 与 SAF Walkthrough

运行链路现在是 `graph_data.json` -> `knowledge_projection_store.js` -> 版本化 projection contract -> `mobile_exact_analyzer`。Persistent host 提供 `read/write`；memory adapter 在存储短暂故障时保留最近一次成功 projection，同时拒绝未知未来 schema。

Android 采用异步 SAF 状态机：Rust 请求 `ACTION_OPEN_DOCUMENT_TREE`，Kotlin 在单文档 16 MiB、总输入 64 MiB 限制内把 Markdown 流式复制到 app-local `filesDir/Knowledge_Base`，随后 Rust 轮询短结果 marker，只持久化 app-local path。外部 URI 只是 provenance，不是 identity；移动包继续排除 sidecar/Godot/model/SVG。

验证：24 项 Jest 聚焦测试、TypeScript no-emit 与 Rust 26 项测试通过。Android 生成 patch 已幂等；新鲜 arm64 slim 构建生成未签名 APK（9,555,787 字节）与 AAB（7,179,228 字节），静态 artifact 检查通过且没有禁入条目。签名 arm64、真机导入与 RSS 证据仍待补齐。

## 2026-08-18 第 12 阶段 App-Local Replay Walkthrough

移动 load path 现在有明确的文件边界：

`graph_data.json` -> `createFileProjectionStore()` -> 版本化 projection contract -> `mobile_exact_analyzer`。

`createFileProjectionStore()` 接收 host-owned 的 `readFile(fileName)`，需要写入时接收可选的 `writeAtomic(fileName, serialized, projection)`。它继续保存原始 schema-1 projection，而不是引入新的 envelope，因此 Tauri/Rust 与 Android/Kotlin writer 保持兼容。`storage_provider.js` 在 factory 存在时选择该路径，旧 runtime 仍回退到 legacy generic store。

Store 会区分 I/O 故障与数据不兼容：读取失败可以复用最近一次成功值；非法 JSON、未来 schema、非法 node/edge identity 或大小超限会直接暴露并阻止分析。即使提供 initial projection，首次 load 仍会读取文件，避免过期 bootstrap 值遮蔽更新后的 app-local projection。

运行确定性证据命令：

```text
npm run verify:mobile:projection-replay
```

命令会在临时 app-local 目录执行 atomic save，释放首个 store 实例，再分别以 Web/Tauri/Capacitor/Android 的 read-through store 重开，并比较 metadata、exact search、neighbor 与 shortest path。随后写入 `output/verification/mobile-projection-replay/report-latest.json`，同时验证截断 JSON 与未知 schema fail closed。该 output 目录被 gitignore，不是源码产物。

本次变更后 `mobile:prepare:slim` staging 为 120 个文件（未压缩 4,253,837；估算压缩 1,546,201 字节）。重新构建的未签名 arm64 APK/AAB 静态 payload 分别为 9,434,062 与 6,978,525 字节，均低于 25 MiB；两项测量都不包含真机 RSS。

route-shadow 门禁也在 readiness 后等待三次连续稳定的 runtime directory manifest。这是必要的，因为 registry backend 可能在 `/api/knowledge/state` 返回之后才异步完成首次 SQLite 初始化；没有该等待，慢宿主会产生假的 read-only side-effect 失败。

这关闭了代码级 G3 replay 证据，但没有关闭真机门禁。仍需签名 arm64 产物、Android 进程死亡后的 SAF import/query/path workload，以及 peak RSS <= 256 MiB。SQLite/WASM 仍是未来 opt-in adapter，因为当前有界 exact workload 不足以证明其移动端体积、启动和 heap 成本值得默认引入。
