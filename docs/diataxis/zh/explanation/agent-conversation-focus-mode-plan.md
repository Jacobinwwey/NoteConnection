# 解释：Agent 对话与 Focus Mode 主线交付方案

本页定义 NoteConnection 当前主线交付重点：

- 用户在前端与 agent 聊天，
- 前端返回可在本地查看的知识点，
- 用户点击知识点后，在对话窗口侧边工作区中显示该节点的 Tauri 图界面 `focus mode` pane，
- 用户点击“学习路径”动作后，在侧边工作区中显示学习路径 pane，
- `focus mode` 与 `学习路径` 两个 pane 可以并排共存，
- 两个 pane 都支持各自独立提升为全屏。

## 2026-05-12 现实校准说明

- Agent workspace 壳层、focus/path pane 编排、browser/runtime smoke 以及 typed capability contract 都已经是真实交付。
- 但当前仍不能把“所有 capability 都已语义闭环”等同看待：
  - tutor telemetry / tutor trace-provider trend / conversation memory / memory-policy diagnostics 已是真实后端实现；
  - `compareQueryBackends`、query-backend comparison history/trend、staleness diagnostics、learning-quality history/trend、session-plan-quality evaluate/history/trend/runtime thresholds 等结果面在 `KnowledgeLearningPlatform.ts` 中仍带 placeholder；
  - `server.ts` 默认 runtime 只配置了 `tutorAdapters` catalog，并未注入激活态 `tutorAdapter`，因此正常 tutor 执行仍以 rule-engine 为主，而不是多适配器真实路由。
- 这意味着当前 L4 主线已具备“真实宿主壳层 + 真实 capability orchestration”，但其中一部分高层诊断卡片仍处于“契约可调用、语义未闭环”的阶段。

这条主线之所以成为当前优先级，是因为它能把现有学习内核、Path Mode、Godot 学习路径与前端交互收敛成一个单一可发现入口，而不是继续分散在不同工作台与按钮路径中。

## 当前分支状态

这一切片已经不再停留在“只有方案”阶段。

当前已落地：

- `POST /api/knowledge/conversation` 已可从 learning platform 返回可操作的本地知识点；
- 主前端已经落入 `agent workspace` 壳层（`src/frontend/index.html`）；
- 点击 `Focus` 已会解析 live graph node 并调用现有 graph focus 流程；
- 点击 `Learning Path` 已不再停在文本占位，而是会把现有 path workspace 挂入停靠 pane；
- 图谱布局已经为 docked workspace 预留宽度，graph surface 与 agent surface 可以并存。
- graph focus 的 fullscreen 已可提升真实 graph workspace，同时保留一个可恢复的控制卡；
- 新壳层静态文案与运行时按钮/空态标签已具备双语覆盖，且已有知识卡片动作按钮与本地化系统消息会在语言切换时重渲；conversation card 的重渲链路也已收敛为 `workspace_panes` 中的 card-kind 注册表驱动，降低后续漂移风险。
- conversation knowledge point 现在已经具备可执行 typed descriptor：除 `focus` / `learning path` 外，已接入 tutor 侧 `generate_quiz` / `recap` / `generate_transfer` / `generate_counterexample` / `follow_up`、query 侧 `compare_query_backends` / `inspect_query_backend_diagnostics` / `inspect_query_backend_comparison_history` / `inspect_query_backend_comparison_trend`、导师诊断侧 `inspect_tutor_adapter_telemetry` / `inspect_tutor_trace_diagnostics`、质量/会话诊断侧 `inspect_learning_quality_trend` / `inspect_learning_quality_history` / `inspect_session_plan_quality_trend` / `inspect_session_plan_quality_history`，并接入 session 侧 `inspect_session_history` / `build_study_session`，同时补齐 execution / failure / UI hint 元数据。
- browser smoke 已覆盖真实 `conversation/path/query-compare/query-compare-history/query-compare-trend/quality-trend/quality-history/session-plan-quality-trend/session-plan-quality-history/session-plan` 后端链路、真实 graph runtime、真实 path runtime，并会输出 screenshot / console / network-summary 证据产物。

仍未完成：

- Tauri strict 生命周期与窗口证据链在实现层面已经闭环，但在宿主层面仍依赖 Linux/CI 预装 `javascriptcoregtk-4.1`、`libsoup-3.0`、`webkit2gtk-4.1` 才能通过 `verify:agent-workspace:tauri:rust:strict`、`verify:agent-workspace:tauri:window-evidence:strict`、`verify:agent-workspace:tauri:evidence:index:strict`、`verify:agent-workspace:tauri:evidence:manifest:strict`；当前 Windows 宿主则主要证明 non-strict tauri/runtime 行为与 load-flow parity 路径。
- 当前 `study_session_card` / `tutor_action_card` / `session_history_card` / `query_backend_comparison_card` / `query_backend_diagnostics_card` / `query_backend_comparison_history_card` / `query_backend_comparison_trend_card` / `tutor_adapter_telemetry_card` / `tutor_trace_diagnostics_card` / `learning_quality_trend_card` / `learning_quality_history_card` / `session_plan_quality_trend_card` / `session_plan_quality_history_card` 已支持语言切换后重渲，且已统一走注册表驱动；同时已新增源码级门禁测试校验 append-kind 与注册表键集合一致（`src/agent_workspace.frontend.test.ts`）。后续新增 card kind 时，需要默认通过该门禁。
- 可执行 contract 已具备，且不再只停留在 quiz/recap，但仍需继续吸收更广的 tutor/query/session 动作。

## 产品目标

目标用户流如下：

1. 用户在前端对话面板输入请求。
2. 后端返回：
   - 正常对话回答，
   - 可在本地解析的知识点列表，
   - 可选路径动作。
3. 当用户点击某个知识点时：
   - 前端将其解析为本地图中的可定位节点，
   - 对话主表面保持不变，
   - 侧边工作区展示该节点对应的 Tauri 图界面 `focus mode` pane，
   - 该 pane 可与学习路径 pane 并排存在，
   - 用户可将该 pane 提升为全屏。
4. 当用户点击 `学习路径` 时：
   - 侧边工作区打开一个学习路径 pane，
   - 它不需要替换 graph focus pane，
   - 用户在需要时可将该 pane 提升为全屏工作区。

## 交互模型

正确的 UX 模型应当是：

- 主表面：agent conversation，
- 次表面：停靠式侧边工作区，
- 子 pane：
  - graph focus mode，
  - learning path，
- 升级动作：全屏提升。

这意味着：

- 节点点击不能替换掉对话主界面，
- 学习路径不能默认替换 graph focus，
- 产品必须支持两个 pane 并排共存，
- 全屏只是视图升级，不是默认路径。

## 为什么这是当前推进重心

仓库已经具备核心原语：

- 知识查询与 tutor action：
  - `src/learning/KnowledgeLearningPlatform.ts`
  - `src/server.ts`
- 学习路径生成：
  - `src/learning/KnowledgeLearningPlatform.ts`
- 前端工作台与 bridge 感知 UI：
  - `src/frontend/path_app.js`
  - `src/frontend/app.js`
- Tauri 窗口切换：
  - `src-tauri/src/lib.rs`
- Godot 路径与树面板：
  - `path_mode/scripts/path_renderer.gd`
  - `path_mode/scripts/path_mode_ui.gd`
  - `path_mode/scripts/tree_view_panel.gd`
  - `path_mode/scripts/learning_state_machine.gd`
- Bridge 消息转发：
  - `src/core/PathBridge.ts`

当前缺的不是基础设施，而是 host-owned pane 级别的编排与统一入口。

## 交付约束

## 必须保持的约束

- 以 `src/learning/api.ts` 为契约真相源，
- 保持 agent conversation 是主容器，
- 不绕过 `PathBridge` 直接做 Godot 特判，
- 不让 Godot 成为路径选择的真相源，
- 不拆出第二套“聊天路径逻辑”，
- 保持 Tauri 与浏览器 fallback 行为确定。

## 本切片非目标

- 不引入第二套 memory platform，
- 不引入外部 Python 对话/记忆服务，
- 不为聊天单独引入 React/Vue/Electron 子应用，
- 不重写当前 tutor/runtime governance，
- 不重做 Godot UI 布局系统，
- 不上完整多 agent runtime。

## 复杂度控制原则

实现必须优先压低推进复杂度。

这意味着：

- 复用现有 HTML/CSS/JS 前端壳层，
- 先扩展当前 sidebar / overlay / panel controller，
- 避免为 chat 单独引入新的前端框架，
- 外部桌面客户端只作为交互参考，不作为代码捐赠源。

优先复用的本地前端文件：

- `src/frontend/index.html`
- `src/frontend/styles.css`
- `src/frontend/workspace_panes.js`
- `src/frontend/agent_workspace.js`
- `src/frontend/path_app.js`
- `src/frontend/app.js`

运行时注意项：

- 实时 sidecar/frontend 服务读取的是 `dist/src/frontend`，因此 `src/frontend/*` 的修改只有在执行 `npm run build` 后才会进入真实运行时。
- 可通过 `npm run verify:agent-workspace:runtime` 对复制后的前端壳层做真实临时 sidecar/server 校验，而不是继续依赖手动 `npm start` 检查。
- 可通过 `npm run verify:agent-workspace:browser` 在真实浏览器中校验渲染后的 shell；该检查会先通过真实 ingest API 预热最小文档，并写入最小 `data.js` 以启动真实 graph/path runtime，再命中真实 `conversation/path/query-compare/quality/session` 后端链路（含 trend + history 诊断），覆盖语言切换、本地化卡片/消息重渲，以及 graph focus promotion 状态变化，并输出 screenshot / console / network-summary 证据路径。
- 下一阶段的实现重点不再是“证明这条链路能跑”，而是收口 `conversation` 输出与前端动作编排之间的 capability contract。

外部交互参考：

- Cherry Studio 官方仓库：`https://github.com/CherryHQ/cherry-studio`
- Chatbox 官方仓库：`https://github.com/chatboxai/chatbox`

可借鉴的点：

- docked chat + workspace 组合，
- 以 message 为中心的动作入口，
- 轻量的 pane promote / restore 交互。

不应直接借鉴的点：

- 它们的技术栈，
- 它们的状态架构，
- 它们的打包与运行模型。

## 必要架构

## 1. 对话运行时契约

现有 learning API 之上已经落入一个面向 conversation 的最小 typed capability 层。
下一步不是重新发明 UI，而是在不回退到 endpoint-specific UI branching 的前提下继续扩展这套 contract。

当前最小响应结构已能返回：

- conversational message，
- 可绑定证据或本地实体的知识命中，
- 本地知识点卡片，
- CTA action：
  - `open_focus_mode`
  - `open_learning_path`
  - `generate_quiz`
  - `recap`
  - `generate_transfer`
  - `generate_counterexample`
  - `follow_up`
  - `compare_query_backends`
  - `inspect_query_backend_diagnostics`
  - `inspect_query_backend_comparison_history`
  - `inspect_query_backend_comparison_trend`
  - `inspect_tutor_adapter_telemetry`
  - `inspect_tutor_trace_diagnostics`
  - `inspect_learning_quality_trend`
  - `inspect_learning_quality_history`
  - `inspect_session_plan_quality_trend`
  - `inspect_session_plan_quality_history`
  - `inspect_session_history`
  - `build_study_session`

同时，capability descriptor 现在还应承载：

- execution 语义，
- failure 语义，
- 可选 UI hint。

实现规则：

- 本地知识点必须引用真实可解析的 atom/node 标识，
- 前端不得渲染无法映射回本地图状态的点击目标。

预计涉及：

- `src/learning/api.ts`
- `src/learning/types.ts`
- `src/server.ts`
- `src/learning/KnowledgeLearningPlatform.ts`

## 2. 前端对话面板

前端需要一个专门的 agent chat 入口，而不是继续依赖临时 prompt 或工作台里的零散动作。

职责包括：

- 提交用户消息，
- 渲染 agent 输出，
- 渲染知识点卡片，
- 渲染显式动作按钮，
- 管理 host-owned 侧边工作区，可在其中同时承载 graph focus mode 与 learning path 两个 pane，
- 将“结果渲染”和“图谱联动”逻辑解耦。

预计涉及：

- `src/frontend/path.html`
- `src/frontend/path_styles.css`
- `src/frontend/path_app.js`

最佳实践：

- 在 `path_app.js` 中集中收敛“conversation result -> graph action mapping”，
- 增加一个 pane-layout controller 管理 dock / undock / split / fullscreen，
- 不要把点击跳转逻辑散落到模板和 bridge 回调里。

## 3. 前端 Focus Mode 交接链路

知识点点击必须复用现有 `src/frontend/app.js` 中的前端图谱 `focus mode` 实现，但它应渲染在停靠 pane 中，而不是抢占整个主视图。

必需行为：

- 将知识点解析为 graph node / atom，
- 解析出 live graph node instance，
- 打开或刷新 graph-focus pane，
- 调用现有前端 focus-mode 入口，
- 保持 browser 与 Tauri 表现一致，
- 知识点点击这条分支不依赖 bridge / Godot。

关键代码：

- `src/frontend/app.js`
- `src/frontend/path_app.js`

坑点：

- 如果 conversation 层按 label 而不是稳定 ID 解析，很容易聚焦到错误节点或过期节点对象。
- 需要一个事务式 helper，统一做“解析节点 -> 取 live node instance -> 打开/刷新 graph-focus pane -> 调用 `enterFocusMode`”。

## 4. Godot 学习路径窗口

产品要求是“学习路径也在停靠工作区中展示、可与 graph focus 并排共存、并可提升为全屏”。但这不等于要把 live Godot 直接内嵌到对话侧边栏里；这是一个高风险实现假设，不能直接写死。

更合理的两层方案是：

- 产品契约：停靠 learning-path pane + 全屏提升，
- 实现自由度：停靠 pane 优先使用 Tauri 承载的 path preview，全屏时再进入更强的 Godot 工作区。

关键代码：

- `path_mode/scripts/path_mode_ui.gd`
- `path_mode/scripts/tree_view_panel.gd`
- `path_mode/scripts/path_renderer.gd`
- `path_mode/scripts/learning_state_machine.gd`

本切片只应增加：

- 一个由前端持有的 learning-path pane contract，
- 一个允许 graph focus 与 learning path 并排存在的 pane-layout contract，
- 一个显式的 fullscreen promote 路径，
- 一个 bridge-safe 的 Godot 焦点命令，供被提升后的路径工作区使用。

最佳实践：

- 前端持有 pane-layout state，
- Godot 持有全屏路径工作区 state，
- 提升消息必须幂等，
- 不要把“侧边 pane”误写成“必须内嵌 Godot”。

## 5. 数据映射规则

这条主线成立的前提是“知识点”必须等价于稳定、可操作的本地实体。

规则：

- 后端返回稳定 atom/node ID，
- 前端按 ID 映射回图节点，
- 若映射失败，则降级为纯文本结果而非可点击卡片，
- 节点点击仅在映射成功时才进入前端 focus mode，
- `学习路径` CTA 仅在知识点本地可操作时显示，
- 两种动作都必须绑定同一个已解析节点标识，
- 打开一个 pane 不应使另一个 pane 的 focus 失效。

不要把模糊 label 匹配当作主键。

## 实施顺序

## Phase A：typed conversation capability

先补最小服务端契约：

- request：
  - `userId`
  - `message`
  - 可选 mode/context
- response：
  - `assistantMessage`
  - `knowledgePoints[]`
  - `actions[]`

这一步必须先于 UI 扩展完成。

## Phase B：前端对话面板

增加用户可见的 chat surface，并渲染知识点卡片。

必须包含：

- loading / error / empty state，
- 明确可点击的本地知识点，
- side work area，至少支持并排的 graph-focus pane、learning-path pane，以及各自的 fullscreen action，
- 点击后进入前端 `focus mode`，
- 每个知识点或当前焦点的 `学习路径` 动作按钮。

## Phase C：前端 Focus Mode 集成交接 helper

增加一个统一前端 helper，负责：

- 节点解析，
- 解析 live graph node，
- 打开或刷新 graph-focus pane，
- 调用现有前端 focus-mode 入口，
- 处理失败降级。

这个 helper 应成为以下入口的唯一实现：

- 对话点击动作，
- 后续工作台 focus 动作，
- 后续推荐路径动作。

## Phase D：并行 pane 编排与 fullscreen promote

增加一个 host 级 pane 编排 controller，并提供显式 fullscreen promote 路径。

推荐姿态：

- graph-focus pane：Tauri-hosted focus mode，
- learning-path pane：优先使用 Tauri 承载的 learning-path experience，
- 全屏：提升到 Godot 工作区，
- 两者共享同一个 focus identity。

不要在 v1 就把“停靠 pane”和“全屏 Godot”视为同一渲染面。

## Phase E：验证与文档

补充测试：

- 契约形状，
- 前端动作渲染，
- 前端 focus-mode helper，
- pane 并排共存与 split-layout 状态切换，
- fullscreen promote 路由，
- 学习路径 handoff 命令路由。

同步更新：

- 进度看板，
- 路线图，
- 若有新增 endpoint / bridge contract，则更新接口文档。

## 风险与坑点

## 1. atom ID 与 graph node ID 漂移

如果 conversation 层返回的 atom ID 不能稳定映射到图节点，点击链路就会不确定。

应对：

- 明确定义一条 canonical mapping path，并以测试锁定。

## 2. 多套编排逻辑并存

如果 `btn-path-mode`、工作台动作和对话动作各自维护一套 Godot 打开逻辑，后续一定会分叉。

应对：

- 收敛为一个共享前端 orchestration helper。

## 3. 并行 pane 协调错误

如果“知识点点击”和“学习路径点击”共用同一条动作路径，产品行为会很快混乱并回归。

应对：

- 明确分支：
  - 节点点击 -> graph-focus pane
  - `学习路径` 点击 -> learning-path pane
  - fullscreen -> 提升到路径工作区
- pane 布局状态与 focus 解析状态必须解耦。

## 4. Godot 面板所有权混乱

如果前端开始直接假设 Godot 面板状态归自己控制，后续 UI 调整会非常脆弱。

应对：

- 前端只发送意图，
- Godot 负责视图状态，
- bridge 消息保持窄接口和幂等语义。

## 最佳实践决策

- learning platform core 继续做真相源。
- conversation result action 全部走 typed contract。
- 本地知识点只有在 graph-mappable 时才可点击。
- 节点点击复用现有前端 `focus mode` 路径。
- 复用当前 web UI 壳层，只借鉴 Cherry Studio / Chatbox 的 UX 模式。
- 主对话窗口负责 side-work-area 生命周期。
- graph focus 与 learning path 必须可以共存，而不是竞争单个 pane 槽位。
- `学习路径` 的 fullscreen promote 才使用 Tauri + `PathBridge`。
- Godot 负责被提升后的路径工作区，前端负责默认侧边 pane orchestration。

## 当前推进优先级

这条交付链应当替代“泛化对话增强”，成为当前 L4 的第一优先级。

优先顺序：

1. 前端 agent conversation 入口，
2. 本地知识点可操作化，
3. 并行 graph-focus pane，
4. 并行 learning-path pane，
5. split-layout 与共存契约，
6. fullscreen promote 契约，
6. 之后才是更深的 memory / personalization 工作。

## 关联页面

- [开发进度看板](./development-progress-dashboard.md)
- [知识彻底掌握演进路线图](./knowledge-mastery-evolution-roadmap.md)
- [DeepTutor 复用评估](./deeptutor-reuse-assessment.md)
- [MemOS 复用评估](./memos-reuse-assessment.md)
