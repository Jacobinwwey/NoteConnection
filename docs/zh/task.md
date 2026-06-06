## 2026-06-06 活跃任务同步

- [x] 本文档切片已确认 `main` 与 `origin/main` 同步。
- [x] 当前代码已经与 5 月 RAG / agent / export 方案完成对比，结果已落盘到 `docs/solutions/architecture-progress-alignment-2026-06-06.md`。
- [x] Scoped retrieval、grounded conversation、Program A-F 底座、export profiles、Godot/mobile PNG-first materialization 与 rollout governance 已按当前代码证据分别标注为“已实现”或“operational baseline”。
- [~] graphdb/sqlite 与 ANN/external connector 路径仍是 operational baseline，不是 production closure；仍待 soak 多轮证据、工作负载阈值、recall/latency 校准与 strict rollout 证明。
- [~] 架构缩减是下一阶段结构性压力点：`src/server.ts`、`KnowledgeLearningPlatform.ts` 与大型前端宿主仍需要所有权切分。
- [ ] 将 sqlite soak verification 推进为多轮 release evidence。
- [ ] 完成 ANN recall/latency 与 connector-budget 校准后，再把 Phase-2 diagnostics 升级为发布门禁。
- [ ] 将 conversation turn-cache、alert-trend、runbook bridge、rollout-profile、connector-helper 等逻辑从 `server.ts` 抽到明确模块。
- [ ] 只在新 owner 能隐藏状态或强制不变量时，继续拆分 learning-platform 领域所有权。
- [ ] 扩展可选 typed `assistantBlocks` 覆盖面时，继续保留 `assistantMessage` 兼容。

主要参考：

- `docs/solutions/architecture-progress-alignment-2026-06-06.md`
- `docs/diataxis/zh/explanation/development-progress-dashboard.md`
- `docs/zh/implementation_plan.md`

## 2026-05-27 活跃任务同步

- [x] Scoped knowledge-workspace grounding 已在当前分支真实落地。
- [x] Provider preset / TOML settings 交付已在当前分支真实落地。
- [x] Reader 侧 markdown / KaTeX / Mermaid 加固与 Tauri 调试抓取工具链已在当前分支真实落地。
- [x] Tauri agent workspace 已具备 typed rich-reply baseline，不再只是 `assistantMessage` 纯文本挂载。
- [x] 这条 Tauri-first 路线已作为当前基线落地：在保持现有 knowledge-point / capability 兼容的前提下，引入了共享 Reader-aligned rich reply rendering。
- [x] 后端回复组织层现在已经把 `assistantBlocks` 用成真正的 Tauri 输出结构：overview、explanation、evidence summary、memory notice、next-action guidance 已分块输出，而不再只是旧 answer 文本的包装。
- [x] 新的 Tauri reply sections 已不再只是模板文本：explanation、evidence、next-action guidance 现在会由真实 knowledge point、citation 和 memory action hint 驱动。
- [x] Tauri agent 输出的 reply policy 现在已具备 intent awareness：comparison-style 与 how-to-style prompt 会得到不同的 explanation / action phrasing，而不再只有一套通用 section 风格。
- [x] FR-010 现已按当前工作流现实治理，而不是继续沿用已删除的过渡期假设：仓库自有工作流固定为 `actions/setup-node@v4` + Node 24，且不再依赖 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`。
- [~] remote CI 是否闭环仍以 `main` 上的实时 `Fixrisk Operational Readiness` 结果为准；其余 marketplace action 带来的 Node 20 弃用注解继续作为非阻塞外部债务记录。

主要参考：

- `docs/diataxis/zh/explanation/development-progress-dashboard.md`
- `docs/diataxis/zh/explanation/agent-conversation-focus-mode-plan.md`
- `docs/zh/implementation_plan.md`

## 2026-05-12 代码 / 方案现实快照

- [x] agent-workspace 的 browser/runtime/Tauri 验证闭环已经是真实可重复的。
- [x] Phase-3 中的 tutor telemetry、tutor trace/provider trend、conversation memory、memory-policy diagnostics 已有具体后端实现。
- [~] Phase-1 A8 已推进到 embedded `graphdb/sqlite` operational baseline，并已具备 shutdown/fresh restart 的重启耐久性证明、主机级 dist/runtime + packaged sidecar 证明，以及覆盖 `smoke` / `medium` / `heavy` 的主机级 workload matrix；但 soak、长时段与性能级加固仍未达到生产闭环。
- [~] Phase-1 A8 现在也新增了独立的主机级 soak/performance verifier（`verify:foundation:sqlite-runtime:soak`）并输出结构化报告，但发布级闭环仍需要持续阈值校准与多轮主机证据，而不是单次通过命令就结束。
- [~] Phase-1 A9 现已具备 live `external_http` sync-backed connector baseline，并在真实 query 流量下得到证明；主机级 dist/runtime + packaged sidecar 证明、`smoke` / `medium` / `heavy` workload matrix 和 matrix release-gate 证据也已具备；但多轮发布级校准仍未完成。
- [x] `KnowledgeLearningPlatform.ts` 中 query compare / staleness / learning-quality / session-plan-quality 运行面已不再返回 placeholder。
- [x] `server.ts` 已注入激活态本地 `tutorAdapter`；剩余导师缺口已不再是默认激活，而是生产级多 provider 路由。

## 2026-05-10 跨文档状态说明

- 本任务看板已与 [Open Goal Audit (2026-05-10)](../open_goal_audit_2026-05-10.md) 同步。
- 未完成目标的最终裁定请与 `TODO.md`、`tauri_tasks.md`、`TEST_REPORT.md` 保持一致。

### 当前任务快照

- [x] Bridge-first 迁移基线已启用（`Tauri + Node sidecar + Godot Path Mode`）。
- [x] Sidecar 与前端数据根路径的运行时适配已集成。
- [x] 打包 Sidecar 场景下的 Worker 路径解析已稳定。
- [ ] embedded graph backend 基线在新的 packaged/runtime 与主机级 workload matrix 证明之外，仍待补齐 soak、长时段与性能级加固。
- [ ] 把新的 sqlite soak verifier 从“初始主机门禁”继续推进为“可持续的发布级证据”，补齐多轮运行与阈值调优。
- [ ] 生产级 ANN connector 在新的主机级 runtime、workload matrix 与 matrix release-gate 证明之外，仍待补齐阈值收敛与多宿主发布级校准。
- [ ] query/quality/session 运行面虽已真实接通，但仍需在发布级 graphdb/ANN 基线上完成发布级校准。
- [ ] tutor 运行路径接下来要从 local-first 激活态 adapter 扩展为生产级多 provider 路由。
- [ ] Electron 下线前最终就绪清单仍待完成。

### 当前验收目标

1. 默认 graphdb 交付路径已经是 embedded `graphdb/sqlite`，并且跨重启可保持 query/store diagnostics 连续性。
2. live `external_http` ANN connector 路径能够在真实 sync/query telemetry 下持续稳定，并完成发布级 rollout 阈值收敛。
3. 当前 live 的 query compare、staleness、learning-quality、session-plan-quality 诊断面已在发布级 graphdb/ANN 基线上完成发布级校准。
4. tutor routing 从 local-first adapter 执行推进到生产级多 provider 策略，同时保留明确的 fallback。
5. Tauri 桌面与 Android 路径继续保持可验证、可文档化，并与历史 Electron 上下文清晰分层。

### 核心实机测试命令

- `npm run verify:core-real-machine`
  - 当前“核心更新功能实机测试”的统一编排入口。会顺序执行 foundation/browser/Tauri 的自动化验证，并将 JSON + Markdown 报告写入 `output/verification/core-real-machine/`。
- `npm run verify:core-real-machine:clean`
  - 与上述统一编排相同，但会额外回滚本次验证新引入的受跟踪 `src-tauri/bin/server-*` 脏改动，用于保持工作区 clean。
- `npm run verify:foundation:sqlite-runtime:matrix`
  - 当前 embedded sqlite 图后端最有价值的主机/runtime 证明，覆盖 `smoke` / `medium` / `heavy` 三档 workload。
- `npm run verify:foundation:sqlite-runtime:soak`
  - 面向 P1 的专用 embedded sqlite 主机/runtime soak 与性能门禁，会把结构化 JSON 报告写到 `output/verification/foundation-sqlite-runtime/`。
- `npm run verify:foundation:ann-runtime:matrix`
  - 当前 `external_http` ANN connector 最有价值的主机/runtime 证明，覆盖 `smoke` / `medium` / `heavy` 三档 workload。
- `npm run verify:foundation:ann-runtime:release`
  - 当前 `external_http` ANN connector 的完整 matrix 发布级门禁路径；会将结构化 JSON 报告写入 `output/verification/foundation-ann-runtime/`，并对 startup、ingest、diagnostics、query latency 与 targeted-query recall 执行门禁。
- `npm run verify:agent-workspace:browser`
  - 真实浏览器 smoke，覆盖 agent workspace、runbook 卡片、query/quality/session 面板和 focus/path 流程。
- `npm run verify:agent-workspace:tauri`
  - 当前 Tauri 桌面壳层路径的真实 smoke。
- `npm run tauri:dev:mini:gpu`
  - 你要做桌面端手动实机交互测试时，优先使用的 mini GPU 壳层命令。
- `npm run tauri:android:dev`
  - 你要把当前应用推到已连接 Android 实机上做交互测试时，优先使用的命令。

### 实机测试注意事项

- `verify:foundation:*` 与 `verify:core-real-machine*` 是工程级验证命令，不只是轻量 smoke。执行时应允许它们自行准备 `dist` 与 host sidecar，不要手工跳过前置 build 路径。
- 如果 `build:sidecar`、`ensure-sidecar-ready` 或运行时验证让受跟踪的 `src-tauri/bin/server-*` 产生脏改动，应将其视为“验证过程引入的临时 sidecar 二进制漂移”。除非当前任务明确就是 sidecar build / supply / signing / validation，否则测试完成后要把这些二进制路径恢复到 `HEAD`。若你希望统一验证命令自动清理本次新引入的 sidecar 脏改动，优先使用 `npm run verify:core-real-machine:clean`。
- `verify:agent-workspace:browser` 使用的是 Playwright 管理的隔离浏览器会话，不要与其他 Playwright 浏览器任务并发执行。它的目标是验证 NoteConnection，而不是接管你已经打开的用户 Chrome 窗口。
- `npm run tauri:dev:mini:gpu` 与 `npm run tauri:android:dev` 都是人工交互式实机命令，不应放进自动化 CI；需要你手动驱动并在取证后自行关闭。
- 只有当命令以 `0` 退出、且 `output/verification/core-real-machine/` 下生成的报告显示所有自动化步骤均为 `PASS` 时，才能把该轮统一验证视为可信结果。

---

# Task: Refining Path Mode Visualization

- [x] **Critical Bug Fix** <!-- id: 100 -->
  - [x] **Fix Navigation Failure**: Tree View defaulting to linear mode on switch center. Ensure `treeLayout` is generated during `switchCenter`. <!-- id: 101 -->
- [ ] **Data Consistency (Frontend)** <!-- id: 0 -->
  - [x] Ensure `inDegree` is correctly calculated and passed in payload. <!-- id: 1 -->
    - [x] Ensure `inDegree` is correctly calculated and passed in payload. <!-- id: 1 -->
    - [x] **Godot: Implement Lazy Loading Visualization** <!-- id: 2 -->
    - [x] **Backend**: Update [path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js) to allow unrestricted context expansion for `forcedExpansionSet`. <!-- id: 3 -->
    - [x] **Frontend Bridge**: Update [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js) to handle `forcedExpansionNodes` and pass to worker. <!-- id: 4 -->
    - [x] **Simplify Lazy Loading UI (Godot)**
    - [x] Update [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd):
      - [x] Remove separate [(+)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53)/[(-)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) buttons.
      - [x] Implement unified `[ Count ]` button (circle with number).
      - [x] Button toggles `forcedExpansion` state.
      - [x] Default state is collapsed.
    - [x] Ensure [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js) handles the toggle correctly (reusing existing logic).
    - [x] **Godot Renderer**: Update [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd) to calculate visible In-Degree and show [(+)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53)/[(-)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) buttons. <!-- id: 5 -->
    - [x] **Godot Signals**: Wire up [expand](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#239-246)/[collapse](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#255-261) signals through `tree_view_panel`, `path_mode_ui` to `ws_client`. <!-- id: 6 -->
      - [ ] (**Godot**) Implement logic to verify `Visible < Global In-Degree` to show [(+)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53). <!-- id: 105 -->
- [x] **Tree View Visual & Interaction Overhaul**
  - [x] **Visual Cleanup (Godot)**
    - [x] Remove [(+)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53)/[(-)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) and `[Count]` buttons from [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd).
    - [x] Remove separate click areas for these buttons.
  - [x] **Interaction Update (Godot)**
    - [x] **Double Click**: Change to Toggle Expansion (Emit [expand](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#239-246)/[collapse](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#255-261)).
    - [x] **Right Click**: Toggle Expansion (Same as Dbl Click).
    - [x] **Middle Click**: Collapse All (Emit new signal `collapse_all_requested`).
    - [x] **Long Press**: Implement Navigation (Switch Central).
      - [x] Add `_process` check for hold duration.
      - [x] Draw Progress Ring during hold.
      - [x] Trigger navigation on completion.
  - [x] **Focus Mode (Godot)**
    - [x] Add "Focus on this node" checkbox to [settings_panel.tscn](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scenes/settings_panel.tscn).
    - [x] Implement `focus_node_id` state in [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd) (visual only for now).
    - [x] Update `_draw` to dim nodes/edges not connected to `focus_node_id` when enabled.
  - [x] **Backend Updates**
    - [x] Add [collapseAll](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#255-261) handler in [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js).
- [x] **Tree Renderer Update (Godot)** <!-- id: 4 -->
  - [x] **In-Degree Display**: Add visualization for in-degree (e.g., small badge/number). <!-- id: 5 -->
  - [x] **Last Node Button**: Hide expand button for the last node in the chain (target node). <!-- id: 6 -->
  - [x] **Bezier Aesthetics**: <!-- id: 7 -->
    - [x] Implement edge filtering to avoid skip-level connections. <!-- id: 8 -->
- [ ] **Frontend UI Fixes (Electron)** <!-- id: 106 -->
  - [x] **Fix In-Degree Mismatch**: Investigate and correct the data source for In-Degree numbers in the details panel. <!-- id: 107 -->
  - [x] **Fix Resizing Layout**: Ensure Incoming/Outgoing columns resize proportionally with the window. <!-- id: 108 -->
  - [x] **Edge Visibility**: Modify renderer to hide edges by default and only show on hover/click. <!-- id: 109 -->
  - [x] **In-Degree Display Setting**: Add setting to toggle between Visible/Total count (Default: Visible). <!-- id: 110 -->
- [x] **Data Validation**
  - [x] **Disable Path Mode if No Data**: Prevent clicking "Path Mode" button if `graphData` is empty/undefined.
  - [x] **Fix False Negative**: Ensure `graphData` check correctly detects dynamically loaded data in Mini Build mode.
  - [x] **Inline Feedback**: Replace `alert()` with a text message next to the button.
- [x] **Fix Godot Script Errors**
  - [x] **TreeRenderer Parse Error**: Add `class_name TreeRenderer` to [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd) or fix syntax error causing parse failure.
- [x] **Fix Tree View Interactions**
  - [x] **Fix Right-Click Toggle**: Ensure right-click (and double-click) correctly toggles between Expand and Collapse based on current state.
  - [x] **Fix Collapse All**:
    - [x] Debug Middle Click binding.
    - [x] Add visible "Collapse All" button to UI.
- [x] **Fix Regression Errors**:
  - [x] Restore `_is_pressed` and `collapse_all_requested` in [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd).
- [ ] **Verification** <!-- id: 10 -->
  - [x] Verify "Expand" button appears for nodes with hidden parents. <!-- id: 16 -->
  - [x] Verify clicking "Expand" reveals "Fair Value" or similar missing nodes. <!-- id: 17 -->

## v1.4.2 - Spine & Tributaries Layout

- [ ] **Core Algorithm Implementation ([path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js))**
  - [ ] **Data Structure**: Implement `Spine` identification (Main Path).
  - [ ] **Slot Manager**: Create `Y-Axis Allocator` to manage vertical slots per X-column.
  - [ ] **Layout Logic**:
    - [ ] Place Spine nodes at `Y=0`.
    - [ ] Place Tributaries (Prerequisites) laterally using "Preceding Parent" priority.
    - [ ] Ensure `Stationary Expansion` (Expanding a node does not shift the Spine).
- [ ] **Frontend Integration**
  - [ ] Verify `switchCenter` triggers correct layout recalculation.
  - [ ] Test with complex graphs to ensure no overlapping nodes.

---

# 任务：完善路径模式可视化 (Task: Refining Path Mode Visualization)

- [x] **关键 Bug 修复 (Critical Bug Fix)** <!-- id: 100 -->
  - [x] **修复导航失败**: 树状视图在切换中心时默认为线性模式。确保在 `switchCenter` 期间生成 `treeLayout`。 <!-- id: 101 -->
- [ ] **数据一致性 (前端)** <!-- id: 0 -->
  - [x] 确保在有效负载中正确计算并传递 `inDegree`。 <!-- id: 1 -->
    - [x] 确保在有效负载中正确计算并传递 `inDegree`。 <!-- id: 1 -->
    - [x] **Godot: 实现懒加载可视化** <!-- id: 2 -->
    - [x] **后端**: 更新 [path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js) 以允许 `forcedExpansionSet` 的无限制上下文扩展。 <!-- id: 3 -->
    - [x] **前端桥接**: 更新 [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js) 以处理 `forcedExpansionNodes` 并传递给 Worker。 <!-- id: 4 -->
    - [x] **简化懒加载 UI (Godot)**
    - [x] 更新 [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd):
      - [x] 移除单独的 [(+)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53)/[(-)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) 按钮。
      - [x] 实现统一的 `[ 计数 ]` 按钮（带数字的圆圈）。
      - [x] 按钮切换 `forcedExpansion` 状态。
      - [x] 默认状态为折叠。
    - [x] 确保 [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js) 正确处理切换（重用现有逻辑）。
    - [x] **Godot 渲染器**: 更新 [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd) 以计算可见入度并显示 [(+)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53)/[(-)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) 按钮。 <!-- id: 5 -->
    - [x] **Godot 信号**: 通过 `tree_view_panel`、`path_mode_ui` 将 [expand](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#239-246)/[collapse](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#255-261) 信号连接到 `ws_client`。 <!-- id: 6 -->
      - [ ] (**Godot**) 实现逻辑以验证 `可见 < 全局入度` 以显示 [(+)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53)。 <!-- id: 105 -->
- [x] **树状视图视觉与交互重修**
  - [x] **视觉清理 (Godot)**
    - [x] 从 [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd) 中移除 [(+)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53)/[(-)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) 和 `[Count]` 按钮。
    - [x] 移除这些按钮的单独点击区域。
  - [x] **交互更新 (Godot)**
    - [x] **双击**: 更改为切换扩展（发射 [expand](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#239-246)/[collapse](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#255-261)）。
    - [x] **右键单击**: 切换扩展（与双击相同）。
    - [x] **中键单击**: 全部折叠（发射新信号 `collapse_all_requested`）。
    - [x] **长按**: 实现导航（切换中心）。
      - [x] 添加 `_process` 检查保持持续时间。
      - [x] 在保持期间绘制进度环。
      - [x] 完成时触发导航。
  - [x] **专注模式 (Godot)**
    - [x] 向 [settings_panel.tscn](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scenes/settings_panel.tscn) 添加“聚焦于此节点”复选框。
    - [x] 在 [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd) 中实现 `focus_node_id` 状态（目前仅视觉）。
    - [x] 更新 `_draw` 以在启用时调暗未连接到 `focus_node_id` 的节点/边缘。
  - [x] **后端更新**
    - [x] 在 [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js) 中添加 [collapseAll](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#255-261) 处理程序。
- [x] **树渲染器更新 (Godot)** <!-- id: 4 -->
  - [x] **入度显示**: 添加入度可视化（例如，小徽章/数字）。 <!-- id: 5 -->
  - [x] **最后一个节点按钮**: 隐藏链中最后一个节点（目标节点）的展开按钮。 <!-- id: 6 -->
  - [x] **贝塞尔美学**: <!-- id: 7 -->
    - [x] 实现边缘过滤以避免跳级连接。 <!-- id: 8 -->
- [ ] **前端 UI 修复 (Electron)** <!-- id: 106 -->
  - [x] **修复入度不匹配**: 调查并更正详细信息面板中入度数字的数据源。 <!-- id: 107 -->
  - [x] **修复布局调整大小**: 确保传入/传出列随窗口按比例调整大小。 <!-- id: 108 -->
  - [x] **边缘可见性**: 修改渲染器以默认隐藏边缘，仅在悬停/点击时显示。 <!-- id: 109 -->
  - [x] **入度显示设置**: 添加设置以在可见/总数之间切换（默认：可见）。 <!-- id: 110 -->
- [x] **数据验证**
  - [x] **这也是如果无数据则禁用路径模式**: 如果 `graphData` 为空/未定义，防止点击“路径模式”按钮。
  - [x] **修复误报**: 确保 `graphData` 检查正确检测 Mini Build 模式下的动态加载数据。
  - [x] **内联反馈**: 用按钮旁边的文本消息替换 `alert()`。
- [x] **修复 Godot 脚本错误**
  - [x] **TreeRenderer 解析错误**: 向 [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd) 添加 `class_name TreeRenderer` 或修复导致解析失败的语法错误。
- [x] **修复树状视图交互**
  - [x] **修复右键切换**: 确保右键单击（和双击）根据当前状态正确在展开和折叠之间切换。
  - [x] **修复全部折叠**:
    - [x] 调试中键绑定。
    - [x] 向 UI 添加可见的“全部折叠”按钮。
- [x] **修复回归错误**:
  - [x] 恢复 [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd) 中的 `_is_pressed` 和 `collapse_all_requested`。
- [ ] **验证** <!-- id: 10 -->
  - [x] 验证“展开”按钮是否出现在具有隐藏父节点的节点上。 <!-- id: 16 -->
  - [x] 验证点击“展开”是否显示“公允价值”或类似的缺失节点。 <!-- id: 17 -->

## v1.4.2 - 主干与支流布局 (Spine & Tributaries Layout)

- [ ] **核心算法实施 ([path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js))**
  - [ ] **数据结构**: 实现 `Spine` 识别（主路径）。
  - [ ] **插槽管理器**: 创建 `Y轴分配器` 以管理每个 X 列的垂直插槽。
  - [ ] **布局逻辑**:
    - [ ] 将主干节点放置在 `Y=0`。
    - [ ] 使用“先前父节点”优先级横向放置支流（前置节点）。
    - [ ] 确保 `静态展开` (展开节点不移动主干)。
- [ ] **前端集成**
  - [ ] 验证 `switchCenter` 触发正确的重新布局计算。
  - [ ] 使用复杂图表测试以确保没有节点重叠。

## v1.4.3 - 9-Rule Tree Layout Engine (2026-02-26)

- [ ] **Core Algorithm: Ownership System ([path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js))**
  - [ ] Step 1: Add `expansionOrder` parameter to `getTreeLayout()`
  - [ ] Step 2: Add `currentOwner`, `ownerPriority`, `_isOnSpine` to layout nodes
  - [ ] Step 3: Implement `tryClaim()` with 9 rules
  - [ ] Step 4: Implement `determineVisibility()` + `isOwnerChainVisible()`
  - [ ] Step 5: Filter edges by ownership (Rule 5)
  - [ ] Step 6: Group hulls by ownership
- [ ] **Frontend Bridge ([path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js))**
  - [ ] Step 7: Convert `forcedExpansionNodes` Set → `expansionOrder` Array
  - [ ] Step 8: Add `stickyClaimEnabled` setting
- [ ] **Godot Renderer ([tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd))**
  - [ ] Step 9: Edge filtering by `currentOwner`
  - [ ] Step 10: Hull collision avoidance
  - [ ] Step 11: Node type coloring (spine/tributary/shared/migrated)
  - [ ] Step 12: Expansion indicator badge
- [ ] **Worker ([path_worker.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_worker.js))**
  - [ ] Step 13: Pass `expansionOrder` + `stickyClaimEnabled` to `getTreeLayout()`
- [ ] **Verification**
  - [ ] Test Rule 2 (Preceding Immunity)
  - [ ] Test Rule 3 (Following Migration)
  - [ ] Test Rule 6 (Spine Always Visible)
  - [ ] Test Rule 7 (Sticky Claim toggle)
  - [ ] Test hull-node collision avoidance

---

## v1.4.3 - 9 规则树形布局引擎 (2026-02-26)

- [ ] **核心算法：所有权系统 ([path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js))**
  - [ ] 步骤 1: 向 `getTreeLayout()` 添加 `expansionOrder` 参数
  - [ ] 步骤 2: 向布局节点添加 `currentOwner`, `ownerPriority`, `_isOnSpine`
  - [ ] 步骤 3: 实现包含 9 条规则的 `tryClaim()`
  - [ ] 步骤 4: 实现 `determineVisibility()` + `isOwnerChainVisible()`
  - [ ] 步骤 5: 按所有权过滤边（规则 5）
  - [ ] 步骤 6: 按所有权分组 hull
- [ ] **前端桥接 ([path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js))**
  - [ ] 步骤 7: 将 `forcedExpansionNodes` Set 转为 `expansionOrder` Array
  - [ ] 步骤 8: 添加 `stickyClaimEnabled` 设置
- [ ] **Godot 渲染器 ([tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd))**
  - [ ] 步骤 9: 按 `currentOwner` 过滤边
  - [ ] 步骤 10: Hull 碰撞避让
  - [ ] 步骤 11: 节点类型着色（脊柱/支流/共享/迁移）
  - [ ] 步骤 12: 展开指示器徽章
- [ ] **Worker ([path_worker.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_worker.js))**
  - [ ] 步骤 13: 传递 `expansionOrder` + `stickyClaimEnabled`
- [ ] **验证**
  - [ ] 测试规则 2（前置免疫）
  - [ ] 测试规则 3（后续迁移）
  - [ ] 测试规则 6（脊柱始终可见）
  - [ ] 测试规则 7（粘性认领开关）
  - [ ] 测试 hull-节点碰撞避让
