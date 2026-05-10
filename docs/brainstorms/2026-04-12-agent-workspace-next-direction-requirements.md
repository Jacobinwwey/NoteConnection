---
date: 2026-04-12
topic: agent-workspace-next-direction
---

# Agent Workspace Next Direction Requirements

## Problem Frame
当前切片已经越过“能否跑通”的阶段，进入“架构能否持续演进”的阶段。

已被验证的事实是：

- host-owned `agent workspace` 壳层已在主前端落地（`src/frontend/index.html`、`src/frontend/styles.css`）；
- conversation 已返回 typed capability descriptors（`src/learning/types.ts`、`src/learning/KnowledgeLearningPlatform.ts`）；
- `Focus` 与 `Learning Path` 都可在侧边工作区落地，并支持 pane 级 fullscreen promotion（`src/frontend/workspace_panes.js`、`src/frontend/agent_workspace.js`）；
- browser smoke 已覆盖真实后端 + 真实 graph/path runtime，并产出 screenshot / console / network-summary（`scripts/verify-agent-workspace-browser.js`、`src/agent_workspace.browser.contract.test.ts`）。

当前主要矛盾不在“是否具备功能”，而在“是否已形成可扩展契约”：

1. 是否已经从 endpoint-aware UI 编排切换到 capability-driven 编排。
2. 是否仍存在双轨真相源（typed capability 与 legacy `availableActions`）导致行为漂移。
3. 下一步应继续加动作，还是先收敛动作执行面，避免后续复杂度失控。

## Plan-vs-Code Deep Comparison

| Requirement Axis | Plan Expectation | Code Evidence | Status | Engineering Risk |
|---|---|---|---|---|
| Conversation typed contract | `conversation` 返回可执行 capability（动作、目标、请求、失败、UI hint、execution） | `src/learning/types.ts:657-799`, `src/learning/KnowledgeLearningPlatform.ts:1537-1952`, `src/server.ts:11448-11463` | Done | 合同层已具备，不是当前瓶颈 |
| Capability richness | 覆盖 focus/path/tutor/query/quality/session 多动作 | `src/learning/KnowledgeLearningPlatform.ts:1537-1923` | Done | 扩面已完成首轮，后续风险转移到执行层 |
| Side-by-side pane model | focus 与 learning-path 可并排共存，并各自可 fullscreen | `src/frontend/index.html:171-205`, `src/frontend/styles.css:306-332`, `src/frontend/workspace_panes.js:1484-1550` | Done | 交互模型已符合当前产品要求 |
| Capability render source | 优先消费 typed capabilities | `src/frontend/workspace_panes.js:1309-1315`, `src/frontend/workspace_panes.js:1703-1765` | Done | 渲染层对 typed contract 已兼容 |
| Capability execution decoupling | 前端不应继续按 endpoint/operation 分支硬编码 | `src/frontend/agent_workspace.js:70-126`, `src/frontend/agent_workspace.js:899-1111` | Gap | 新动作增长会导致分支爆炸与回归成本上升 |
| Request payload abstraction | payload 组装应由统一策略层驱动，而非多段 if/else | `src/frontend/agent_workspace.js:235-461`, `src/frontend/agent_workspace.js:914-937` | Gap | 请求语义散落，改一处可能漏多处 |
| Result presentation abstraction | card 呈现应由可扩展 presenter registry 驱动 | `src/frontend/agent_workspace.js:957-1101` | Gap | `resultPresentation` 新值需改核心分支，违反开放封闭 |
| Legacy compatibility removal | 移除 `availableActions -> legacy capability` 合成路径 | `src/frontend/workspace_panes.js:956-1315`, `src/agent_workspace.frontend.test.ts:1034-1072` | Gap | 双轨真相源会掩盖契约漂移，且易引入“后端未声明、前端仍可触发” |
| Runtime evidence quality | 保留 screenshot / console / network-summary 结构化证据 | `src/agent_workspace.browser.contract.test.ts:101-138` | Done | 当前证据链完整 |
| Desktop lifecycle coverage | 覆盖 Tauri 生命周期与窗口编排行为 | 当前仅 browser/runtime smoke（`src/agent_workspace.runtime.contract.test.ts:35-70`） | Partial | 桌面端 regressions 仍有盲区 |
| Program-level base alignment | graph db/vector 等底座缺口需与 L4 交互切片分离治理 | `docs/brainstorms/2026-04-11-evolution-progress-alignment-requirements.md` | Partial | 若混成同一主线，会造成执行目标摇摆 |

## Architecture Progress Map (L4 Interaction Slice)

| Sub-Layer | Current Maturity | Evidence | Blocker to Next Stage |
|---|---|---|---|
| L4-A Contract Definition | High | `src/learning/types.ts:657-799` | 无显著阻塞 |
| L4-B Contract Emission | High | `src/learning/KnowledgeLearningPlatform.ts:1537-1952` | 无显著阻塞 |
| L4-C Contract Rendering | Medium-High | `src/frontend/workspace_panes.js:1309-1315`, `src/frontend/workspace_panes.js:1703-1765` | 仍保留 legacy fallback |
| L4-D Contract Execution | Medium-Low | `src/frontend/agent_workspace.js:899-1111` | endpoint-aware branching 与 presenter branching 集中耦合 |
| L4-E Runtime Verification | Medium | `src/agent_workspace.browser.contract.test.ts`, `src/agent_workspace.runtime.contract.test.ts` | 缺 Tauri 生命周期 smoke |

结论：当前不是“能力缺失”，而是“执行层抽象不足”。若不先修复 L4-D，后续每扩一个 action 都会线性增加前端耦合与测试负担。

## Critical Pressure Test (Assumption Challenge)

- 假设 A: “有 typed capability 就等于 capability-driven 架构已完成。”
  - 反证：`src/frontend/agent_workspace.js:899-1111` 仍以 `operationId` 和 `resultPresentation` 的显式 if/else 作为控制面。
  - 结论：合同存在 != 编排解耦。

- 假设 B: “保留 legacy fallback 只是兼容层，不影响主线。”
  - 反证：`src/frontend/workspace_panes.js:956-1315` 会在 typed capability 缺失时自动合成动作，形成第二真相源。
  - 结论：这会掩盖后端 contract 漂移，拖慢问题暴露。

- 假设 C: “browser smoke 通过即可代表桌面端稳定。”
  - 反证：当前验证主要在浏览器环境，缺 Tauri 生命周期与窗口编排专项回归。
  - 结论：仍有桌面行为盲区，尤其在 promotion/restore/窗口切换上。

- 假设 D: “继续加动作比先做执行面收敛更快。”
  - 反证：每个新动作都需触达 operation config、payload resolver、presenter 分支、测试桩。
  - 结论：短期快，长期慢，且错误率递增。

## Approach Options (with Tradeoffs)

### Option A - Continue Incremental Branching (Not Recommended)
继续按当前模式新增 action（扩 `KNOWLEDGE_OPERATION_CONFIG` + payload resolver + presentation switch）。

- Pros: 短期交付最快，开发者认知成本低。
- Cons: 前端 orchestration 会继续膨胀；回归矩阵复杂度持续上升；能力边界不可审计。
- Risk: 2-3 个迭代后进入“动作扩展成本 > 业务价值”。

### Option B - Capability Executor Registry (Recommended)
将执行链路重构为三层注册表：

- operation transport registry（`operationId -> endpoint/method/serializer`）；
- request builder registry（`operationId -> payload builder`）；
- result presenter registry（`resultPresentation -> renderer`）。

- Pros: 新动作扩展变为“注册”而非“改核心流程”；测试可按 registry 覆盖；契约可审计。
- Cons: 需要一次受控重构与迁移期双跑。
- Risk: 若迁移策略不清晰，可能出现旧分支与新注册并行导致行为重复。

### Option C - Full Tool/Plugin Runtime for Actions (Defer)
直接将 capability 执行升级为可插拔工具协议层（动态 discovery、版本协商）。

- Pros: 远期扩展性最强。
- Cons: 当前阶段过度设计，显著增加治理与调试复杂度。
- Risk: 在基础执行抽象未稳前引入更多动态性，会放大排障成本。

Recommendation: 采用 Option B，明确一个短迁移窗口后移除 legacy fallback；Option C 仅在 L4-D 稳定后再评估。

## Requirements (Landed for Next Stage)

### Interaction Contract Hardening
- R1. 前端 capability 执行层必须重构为注册表驱动，不再在主流程中保留按 `operationId`/`resultPresentation` 的长分支。
- R2. 注册表至少拆分为 `transport`、`request builder`、`presenter` 三个可测试单元。
- R3. capability 执行必须在未知 `operationId` / `resultPresentation` 场景下给出可诊断错误，不得静默降级。
- R4. 每个 capability 的 `failure` 语义必须被统一渲染，并保留本地化 key + fallback message。

### Source-of-Truth Convergence
- R5. `availableActions -> legacy capability` 仅允许短期迁移保留，并设置删除门槛；进入下一里程碑后必须移除。
- R6. 对于 conversation 卡片动作，前后端契约真相源必须唯一（typed capabilities）。
- R7. 新增动作禁止通过 legacy fallback 暗渡，必须先在 typed contract 中声明。

### Runtime Boundary Stability
- R8. 保持 `agent chat` 主表面不被 `focus/path` 交互替换；focus 与 learning-path 继续并排可见。
- R9. 保持 fullscreen promotion 是 pane 级视图升级，不改变 conversation 主流程状态。
- R10. learning-path pane 挂载路径工作区的机制（mount/restore）必须保持可逆和可恢复。

### Verification and Governance
- R11. browser smoke 继续保留 screenshot / console / network-summary 证据输出，并新增关键请求状态/耗时摘要断言。
- R12. 增加 Tauri 生命周期 smoke，覆盖 pane promotion/restore、窗口切换和 exit/reopen 的行为一致性。
- R13. 增加 contract parity test：校验后端 emitted `operationId`/`resultPresentation` 与前端 registry 的双向覆盖。

### Program Alignment
- R14. 将“graph db/vector 底座增强”与本次 L4 执行面收敛分轨推进，不在当前切片混合交付目标。

## Milestone Envelope (Execution Focus)

### M0 - Contract Freeze and Gap Closure
目标：冻结 capability 字段与语义，补齐 parity 守卫。

- 交付项：
  - capability 字段清单与默认语义冻结；
  - operation/presentation parity 测试框架；
  - 迁移窗口内 legacy fallback 使用计数与告警。
- Gate:
  - 后端 capability 枚举与前端执行映射一致；
  - 未知 capability 可触发可诊断失败消息。

### M1 - Frontend Execution Refactor
目标：完成 `agent_workspace` 执行层注册表化。

- 交付项：
  - transport/request/presenter registry 落地；
  - 删除主流程大分支（保留最小 dispatcher）；
  - 前端测试迁移到 registry 驱动断言。
- Gate:
  - 现有 action 集合行为与重构前一致；
  - 新增一个 action 不需要修改 dispatcher 主流程。

### M2 - Legacy Removal and Runtime Guardrail
目标：移除双轨真相源并补齐桌面回归。

- 交付项：
  - 移除 `availableActions` legacy capability 合成路径；
  - Tauri 生命周期 smoke 与证据输出；
  - network summary 增强（状态码/耗时/关键失败摘要）。
- Gate:
  - typed capability 成为唯一动作来源；
  - browser + Tauri 双通道 smoke 通过。

当前状态（2026-04-12）：

- 已完成：`availableActions` legacy 路径移除（后端响应、前端 pane 渲染与 fallback 统计接口已删除）。
- 已完成：`verify:agent-workspace:tauri` 代理烟测链路（runtime shell + tauri 配置校验 + focus/path promotion 生命周期用例）。
- 已完成：`verify:agent-workspace:tauri:rust` 验证入口（带系统依赖预检；本地可跳过，CI strict 可强失败），并补充 `pathmode-window-toggled` Rust 源码契约校验。
- 已完成：前端 capability 执行层新增 execution-kind dispatcher registry（并保留有界 legacy action fallback registry），knowledge operation 已拆分为 transport registry 与 request-builder registry；result presentation 也已拆分为 custom presenter、card descriptor 与 payload-builder registry，unknown kind/action/presentation drift 统一 fail-fast，且 parity 已扩展到 transport / request-builder / custom-presentation / card-presentation / payload-builder / execution kind 覆盖校验。
- 已完成：前端 app 层接入 `pathmode-window-toggled` 生命周期事件观测（trace 缓冲 + DOM 事件转发），并纳入 `verify:agent-workspace:tauri` source lifecycle 契约校验。
- 已完成：首版真实 app/window handle 生命周期证据链 `verify:agent-workspace:tauri:window-evidence`，通过 Rust 专项用例覆盖窗口句柄路径并输出结构化证据；宿主缺依赖时以 `degraded` 语义显式回传原因。
- 待继续：将 `window-evidence` 从依赖感知可降级模式推进为 CI/稳定宿主 strict 常态化（确保桌面窗口证据链长期不可回退）。

## Scope Boundaries

- 本轮不直接实现真实 graph db 或新的向量检索引擎。
- 本轮不重做 UI 视觉系统与大规模布局改造。
- 本轮不引入新的前端框架或独立聊天子应用。

## Risks and Pitfalls

- 迁移期双跑风险：registry 与旧分支并存过久会制造行为差异。
- 契约漂移风险：后端新增 capability 但前端 registry 未补齐时，必须 fail-fast。
- 桌面回归风险：仅依赖 browser smoke 会遗漏 Tauri 生命周期问题。
- 测试盲区风险：若只测 happy path，failure semantics 和 i18n 参数化消息会退化。

## Success Criteria

- 前端新增 capability action 时，不再修改 dispatcher 主分支。
- typed capability 成为唯一动作真相源，legacy fallback 被移除。
- browser + Tauri smoke 均可复现实链路并输出结构化证据。
- focus/path 并排 + fullscreen promotion 行为在重构后保持一致。

## Next Steps

- 进入 `/ce:plan`，以 M0->M2 里程碑拆分任务并标注测试/回归 gate。
