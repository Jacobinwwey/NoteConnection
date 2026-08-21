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

本次变更后 `mobile:prepare:slim` staging 为 120 个文件（未压缩 4,253,837；估算压缩 1,546,201 字节）。重新构建的未签名 arm64 APK/AAB 静态 payload 分别为 9,436,196 与 6,983,880 字节，均低于 25 MiB；两项测量都不包含真机 RSS。

route-shadow 门禁也在 readiness 后等待三次连续稳定的 runtime directory manifest。这是必要的，因为 registry backend 可能在 `/api/knowledge/state` 返回之后才异步完成首次 SQLite 初始化；没有该等待，慢宿主会产生假的 read-only side-effect 失败。

这关闭了代码级 G3 replay 证据，但没有关闭真机门禁。仍需签名 arm64 产物、Android 进程死亡后的 SAF import/query/path workload，以及 peak RSS <= 256 MiB。SQLite/WASM 仍是未来 opt-in adapter，因为当前有界 exact workload 不足以证明其移动端体积、启动和 heap 成本值得默认引入。
## 2026-08-18 第 13 阶段 原生导入恢复 Walkthrough

Android SAF 导入现在具有可重启的事务边界：

`ACTION_OPEN_DOCUMENT_TREE` -> 有界 staging tree -> import journal -> backup/activate -> 原子 result marker。

`KnowledgeBasePickerBridge` 在 app-local knowledge base 同目录写入 `knowledge_base_import_journal.v1.json`。journal 只保存 app-local transaction 名称与明确阶段。`MainActivity.onCreate()` 在暴露 picker 前执行 recovery：target 已存在时优先清理；target 缺失但存在 backup 时恢复旧知识库；abandoned staging 直接删除。未知 schema 或路径逃逸的 journal fail closed。

result marker 保持原有 Rust request/poll 契约，但现在使用同目录临时文件、`fsync` 与 rename，避免进程死亡把半写 marker 误判为 `completed`。journal 是内部耐久机制，不改变 projection schema，因此旧客户端与公共 ID 继续兼容。

本轮验证：Android picker contract、mobile profile/artifact contract、TypeScript no-emit、57 suite migration matrix（307 passed、13 skipped）与 `app:compileArm64ReleaseKotlin` 已通过。当前宿主没有在线 Android 设备、已配置 AVD、签名 keystore 或 RSS 采集，G2/G3 原生设备证据仍未关闭。
## 2026-08-18 第 14 阶段 签名设备证据 Walkthrough

release 链路现在明确为：

```text
签名 arm64 APK
-> 校验 ZIP/arm64/签名/budget
-> 安装到指定 Android 设备
-> SAF import -> graph build -> exact query -> path
-> force-stop -> relaunch -> continuity query
-> 采样 /proc/<pid>/status:VmRSS
-> 写入 manifest + rss.json + logcat 尾部
```

`capture-tauri-android-rss-evidence.js` 只接受带显式 `adbArgs` 的 schema-1 workload spec。它强制五个有序阶段、拒绝重复或缺失步骤、脱敏序列号、记录 artifact SHA-256 与签名元数据，并在无法观察进程死亡或没有 RSS 样本时失败。采集器只是证据边界，不是假定 UI 自动化已经完成；SAF 点击和 continuity 断言必须由设备实验室 workload 提供。

当前主机可以运行 parser 与契约测试，但没有 signing keystore、在线设备、已配置 AVD 或 workload spec，因此不会生成 `latest.json`，G2/G3 继续 pending。静态 slim 体积与未签名 arm64 检查仍然单独记录。

## 2026-08-18 第 15 阶段 原生边界与身份语料 Walkthrough

projection replay 报告现在执行四种不同的 host boundary：

```text
Web storage -> projection store
Tauri atomic file -> temporary file + rename
Capacitor filesystem -> 有界 chunk writer + rename
Android app-local file -> journaled backup/activation
```

每个 host entry 都记录 adapter kind 与 `host-boundary-contract` evidence level。这样关闭了此前“四个标签实际复用同一个 Node `fs` adapter”的假信号，同时继续明确保留真机结论 pending。

graph projection 现在以 additive 元数据携带由 `sourceUri` 派生的 `canonicalId`。legacy `id` 不变，旧 layout 仍可读取，exact analyzer 同时解析两类 ID。重复 canonical ID 在分析前拒绝；本轮不执行 public-ID 切换。

route shadow 扩展到 17 条等价 probe。Malformed JSON 在两种 dispatch 路径都返回相同的 400 body 与 `X-Error-Code: invalid_json`，inline `/api/build` 在图变更前拒绝不支持的 recompute mode。G4 corpus 覆盖同内容隔离、NFC/大小写 collision、跨 root 规范化、legacy snapshot replay 与原子 rollback。

Android graph load 现在在完整 UTF-8 materialize 前限制单文件读取，因此目录枚举后文件增长也不能绕过移动端内存预算。验证仍分层：host contract 测试可在本机通过，但 G2/G3 仍需签名真机 SAF、进程死亡 continuity 与 RSS <= 256 MiB。

本轮源码变更后的 slim staging 实测为 121 个文件、未压缩 4,263,740 字节、估算压缩 1,548,695 字节。现有 APK/AAB 是更早构建的未签名产物，必须重建后才能归因到本次源码版本。

验证快照：全量 Jest 144 suites / 1,263 passed / 26 skipped；TypeScript no-emit、Rust host 与 Android arm64 check、projection replay、route shadow（17 + 6 probes）、slim budget、Diataxis 均通过。真实签名真机证据仍不可用。

## 2026-08-18 第 16 阶段 Portable Identity 传播 Walkthrough

`canonicalId` 现在经过当前所有 projection producer。TypeScript identity、`FileLoader` 与桌面 `GraphBuilder` 以 additive 方式输出；浏览器 identity contract 与 Capacitor graph 使用同一规范路径规则；Android Rust 从规范化 relative path 输出同名字段。Legacy `id` 仍是 graph key，因此旧 layout 与 snapshot replay 不变。

关键边界是语义而非字段外观：`canonicalId` 是跨 host 对比 key，`sourceUri` 是 portable provenance，`id` 是兼容 alias。重复 canonical identity 继续 fail closed。这样下一轮 corpus 可以直接比较 node/edge 语义，而不必提前触发 public-ID 迁移。

## 2026-08-18 第 17 阶段：跨 Host 语义 Parity Walkthrough

Parity 边界现在可执行。`mobile_semantic_comparator.js` 忽略 host-specific legacy ID，只比较归一化 canonical node，以及带 endpoint URI、type、kind、provenance 的有向 edge。重复语义 identity 直接拒绝，避免通过排序掩盖 collision。

Capacitor link resolution 现在与 Rust 对齐：direct canonical path、source-relative path、unique stem fallback。worker 与 single-thread 路径使用同一 resolver。Rust 会解码 percent-encoded Markdown target，执行 NFC/lowercase 归一化，并拒绝重复 canonical path 与含糊 legacy basename。projection contract 在两个 mechanism 连接同一 endpoint 时保留不同 provenance。

`verify-mobile-projection-replay.js` 创建包含 nested path、relative/Markdown link、同内容文档和 NFC 归一化 percent-encoded path 的临时 corpus，分别交给 Capacitor 与真实 ignored Rust Cargo probe，最终报告语义一致（`6` 个节点、`4` 条边）。这比 raw JSON equality 更强，但仍低于签名设备、SAF UI、进程死亡和 RSS 验收。

向前兼容决策不变：保持 `id` 与 schema-1 snapshot 稳定，将 comparator 排除出移动运行时 bundle；在原生 replay、rollback、move-journal、collision 与 RSS 证据归档前，不提升 public canonical-ID 或 SQLite/WASM。

全量验证通过 146 个 Jest suite / 1,271 passed / 26 skipped、TypeScript no-emit 与 28 个 Rust host test 加 1 个 ignored probe。定向 parity 覆盖为 3 个 suite / 12 个测试；新增 recovery contract 为 1 个 suite / 1 个测试。fresh `mobile-slim` staging 为 121 个文件 / 未压缩 4,275,083 字节 / 估算压缩 1,550,638 字节，SHA-256 为 `5d5bafa20770bf42531b2e39ec62364537e0eade83b29a9aa2209f4f03bf7c38`；test-only comparator 与 recovery verifier 均已排除，RSS 仍为 `not measured`。代码级语义 parity 与 host recovery replay 已通过；签名真机 SAF/query/path、进程死亡 continuity 与 RSS <= 256 MiB 仍是开放门禁。

## 2026-08-18 第 18 阶段：原生恢复状态机 Walkthrough

`verify-mobile-native-recovery.js` 在临时 host 目录中回放生产 Kotlin journal 契约。六个场景按状态设计：已有 target 优先于 staging/backup artifact；target 不存在时从有效 backup 恢复；孤儿 backup 进入恢复；unsafe journal path 与 unknown schema fail closed。

契约测试输出 schema-1 evidence，包含 `evidenceLevel: host-recovery-state-machine` 与 `nativeDeviceEvidence: false`。这是确定性的 host mirror 和 CI 漂移探测器，不是 Android 进程死亡、SAF UI、存储/权限失败、签名产物或 RSS 证据。移动运行时仍由 Kotlin 拥有，verifier 不进入 mobile-slim。

下一道门禁仍是原生证据：签名 arm64 执行、SAF import/query/path、force-stop/reopen continuity、失败路径 replay，以及代表性低内存硬件上的 RSS <= 256 MiB。在这些 artifact 与 old-snapshot/move-journal/collision/rollback corpus 归档前，public-ID 与 SQLite/WASM 提升继续冻结。

## 2026-08-18 第 19 阶段：原生导入失败路径保留 Walkthrough

Android import 失败边界现在遵循以下状态规则：

```text
失败 -> 删除 staging
     -> 不存在 backup：清理 journal
     -> 存在 backup：保留 backup + journal，等待下次 bind recovery
```

旧的无条件清理会在激活失败且回滚失败后删除唯一可用知识库。新契约断言只检查该 catch block；成功替换与 recovery 分支中的清理仍然有效。Result marker 与 Rust polling 不变，`mobile-slim` 不增加运行时依赖。

当前仍只是代码级证据。签名 arm64 rollback/recovery、SAF 与权限失败、force-stop continuity、签名产物及 RSS <= 256 MiB 仍需真机执行。

## 2026-08-18 第 20 阶段：恢复重试与新鲜 arm64 产物 Walkthrough

启动恢复现在在 rename 失败时保留 journaled backup 并报告 `import_recovery_pending`；孤儿恢复报告 `orphan_recovery_pending`。Host verifier 覆盖 8 个场景，包含确定性的 retry retention，同时明确不属于原生证据。

新鲜 slim arm64 构建已通过未签名 universal APK（压缩 payload `9,576,838` 字节，SHA-256 为 `eb5f63697c6a3e33f3c54659a530f9ed014c600181067ee95684e2377610fbc6`）与 AAB（压缩 payload `7,055,579` 字节，SHA-256 为 `ee3e9b9451e2afeeb861a4a81311d9caccf9cd64d7871e206453bac3d42f2934`）的静态验证。两者均低于 25 MiB；签名、设备 continuity 与 RSS 仍开放。

## 2026-08-18 第 21 阶段：宿主门禁对账 Walkthrough

Phase 20 后的宿主复核可复现：Android prerequisite、TypeScript no-emit、8 个 recovery 场景与 4-host projection replay 均通过。生成报告被忽略，`git status` 仍为 clean。

现有 AVD 为 `Medium_Phone_API_36.1`，路径 `E:\Android\avd\Medium_Phone.avd`，Android `36.1` / Play Store / `x86_64`，内存 2 GiB；`adb devices -l` 没有 online target。它只能用于工具链 smoke test，不能作为 arm64 release 证据。没有找到获批 `.jks`、`.keystore` 或 `.p12`，因此未签名产物仍是静态证据，`--require-signed` 必须在设备执行前失败。

下一次运行：

```text
CI 临时签名 -> 签名 arm64 APK/AAB
-> 获批 arm64 低内存设备
-> SAF import -> graph build -> exact query -> path
-> force-stop -> relaunch -> continuity
-> 存储/权限重试 -> VmRSS 样本
-> manifest + rss.json + artifact hash + logcat
```

重建 x86_64、本地 debug keystore 与 emulator-only evidence 都不能替代 release 证据。public-ID 切换、默认 SQLite/WASM 与预算变化继续冻结。

## 2026-08-18 第 22 阶段：CI 签名门禁与移动预算对账 Walkthrough

```text
CI secrets -> 临时 release.jks
-> slim aarch64 构建
-> 签名 APK/AAB 验证（--require-arm64 --require-signed）
-> 发布已验证产物并删除 keystore
```

本地构建保持 unsigned。AAB 返回码 `4` 仅在归档已签名且证书链不受信任/自签时接受。本地 smoke 的 APK 为 `9,576,838`、AAB 为 `7,140,668` 压缩字节；它们不是 release provenance。

slim manifest 为 121 个文件 / 未压缩 `4,275,083` / 估算压缩 `1,550,638` 字节，arm64 Rust library 是 APK 最大项。运行时仍需证明有界正文读取、SAF staging/重试与原生 RSS。当前只发现 `arm64-v8a` native payload，`universal` 标签尚未被证明；声明前应改名或逐 ABI 验证。

原生验收仍为：

```text
获批 key + 在线 arm64 设备
-> SAF import -> graph build -> exact query -> path
-> force-stop -> reopen -> continuity
-> 存储/权限重试 -> VmRSS 样本
-> manifest + rss.json + artifact hash + logcat
```

缺证据或 RSS 超过 256 MiB 必须 fail closed。public-ID、默认 SQLite/WASM、Godot inclusion 与预算变化继续冻结。

## 2026-08-18 第 23 阶段：版本化移动预算契约与 arm64 语义对齐

manifest 现在从 `config/mobile-budget.v1.json` 记录 schema-1 artifact/RSS/runtime budget。Rust 在 atomic replacement 前拒绝超过 48 MiB 的 serialized projection，Android content 复用 16 MiB bounded reader。release job 构建 `aarch64`，强制精确 `arm64-v8a`，并发布 `noteconnection-arm64-release.apk/.aab`，不再把产物称为 universal。这些都是 additive guard；原生 SAF/重启/RSS 证据仍需补齐。

## 2026-08-21 第 24 阶段：跨 host runtime budget 投影与原生证据隔离

`mobile_budget_runtime.js` 在 storage provider 前加载，将版本化限制投影到 WebView/Capacitor，不增加 runtime 依赖。Capacitor 现在按 UTF-8 字节计量，在可用时先做 filesystem size 预检，并在读取前拒绝超深 entry；Tauri 在 bootstrap/IPC read 前执行同一 projection ceiling。

Release workflow 将打包与验收分离：签名 arm64 APK/AAB 先是 workflow artifact，GitHub Release 上传必须经过 self-hosted arm64 workload、force-stop/reopen continuity 与可测 RSS。当前静态 staging 为 122 文件 / 未压缩 4,283,033 bytes / 估算压缩 1,552,689 bytes / SHA-256 `c60fe683957faf8fcf88a34b1c766740340c2cdd005bc526cc4efe13befbf77c`；原生 G2/G3 仍待补齐。

## 2026-08-21 第 25 阶段：冲突安全的身份迁移与 owner 收敛 Walkthrough

`move`/`rename` 现在会在 mutation 前检查完整目标 alias 集合。当前 path、当前 URI 与其他文档保留的全部 alias 都参与 collision 检查，因此 rejected move 不会静默抢占兼容查询入口。

合法 move 保留旧 `documentId` 与 content revision，更新 atom/evidence，并把新身份同步到 `ResourceRegistry`、workspace binding 与 `IndexLifecycle`。既有 resource/projection/index ID 与 content hash 保持稳定。持久化 G4 fixture 同时验证 rejected collision 与成功后的四 owner 收敛。

这仍是进程内 owner convergence 边界，不是完整事务引擎。混合 ingest request 如果后续 operation 失败仍可能暴露部分 state；下一阶段应增加 whole-request preflight 或 journaled rollback。本阶段没有增加移动端依赖、数据库、模型、Godot asset、预算或 public-ID 变更。定向验证为 3 suites / 11 tests、TypeScript no-emit 与 `git diff --check`；全量回归为 148 个 Jest suite / 1,284 passed / 26 skipped、Rust 30 passed / 1 ignored，四 host projection replay 与 fresh mobile-low budget 通过；原生 G2/G3 仍开放。

## 2026-08-21 第 26 阶段：请求级 ingest 原子性与单写者串行化 Walkthrough

`ingestKnowledge` 现在按 platform instance 串行执行。请求在 mutation 前保存 versioned snapshot 的深拷贝；operation、relation recompute、owner mirror 或 atomic save 失败时，document/atom/evidence、secondary registry、index、identity journal、telemetry 与 ID counter 一起恢复，第二个 import 不能在恢复期间插入。

边界为 `upsert` 与 `move` 校验 ownership：重复 path/URI/alias、显式 move 的 `from*` alias 属于其他文档、source alias 歧义以及 owner 缺失都会被拒绝。mixed-batch fixture 验证后续 collision 后持久化字节不变，再证明原始 alias 仍可用于后续 move。

实现复用现有 snapshot/replay contract，因此 public ID、projection schema、Bridge 字段与 runtime-first 移动包保持不变。瞬时内存及 JSON clone/restore 延迟会随 graph 增长，原生低内存验收必须使用有界 batch 并记录 RSS。版本化 G4 manifest 与签名 arm64 证据仍是 release 门禁。

当前验证为 148 个 Jest suite / 1,287 passed / 26 skipped、Rust 30 passed / 1 ignored、TypeScript no-emit、122 文件 mobile-low staging、4 host projection replay、8 个 native-recovery scenario、Diataxis 与 `git diff --check`。

## 2026-08-21 第 27 阶段：版本化 G4 identity corpus 回放 Walkthrough

`config/identity-corpus.v1.json` 定义受跟踪的 G4 contract。验证器执行八个生产路径用例：legacy snapshot 原子恢复、同内容隔离、跨 root NFC 规范化、NFC/case collision rejection、move-journal 重启并通过旧 alias 删除、mixed-batch rollback、四 owner 收敛与 upsert alias collision rejection，随后强制执行 Web/Tauri/Capacitor/Android projection replay。

8 个 case 与 4 个 host 全部通过，稳定 result hash 为 `4274a5a2d087875d309fdef9dd4232f5704103b9496ee5524744229bf550b5bb`。报告标记 `host-code-replay` 与 `nativeDeviceEvidence: false`，不代表签名真机、进程死亡或 RSS 通过。Public-ID 迁移仍需独立评审，G2/G3 仍需签名 arm64、SAF/重试/continuity 与 RSS 证据。

最终回归为 149 个 Jest suite / 1,289 passed / 26 skipped；TypeScript no-emit、Rust 30 passed / 1 ignored、mobile-low budget、native recovery、projection replay、Diataxis 与 `git diff --check` 通过。

## 2026-08-21 第 28 阶段：Canonical-ID 迁移 readiness gate Walkthrough

执行 `npm run verify:canonical:id:readiness` 运行非破坏性审计。它回放 versioned corpus，检查四个 projection host 与当前 `canonicalId` producer，然后在保持 `NoteNode.id`、layout、snapshot、API 与移动 payload 不变的前提下输出结构化 `blocked` 报告。默认成功只表示审计完成，不表示批准迁移。

Release workflow 应使用 `--strict`。在原生设备证据出现前它会 fail-closed，避免把 host-only replay 当作签名 Android 验收。

本阶段最终回归为 150 个 Jest suite / 1,291 passed / 26 skipped；TypeScript no-emit 与 Diataxis 通过。
