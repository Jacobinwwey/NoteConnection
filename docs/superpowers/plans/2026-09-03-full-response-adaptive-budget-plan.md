# Full Response Adaptive Budget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add capability-aware `adaptive` and user-requested `unbounded` desktop full-response budgets while preserving slim/mobile compatibility and enforcing non-disableable runtime safety.

**Architecture:** Request normalization owns the public enum contract. `KnowledgeLearningPlatform` resolves an immutable effective budget from the requested response mode, budget mode, and validated host capability; the resolved object is passed to RAG assembly and report composition. The composer and RAG pack builder consume explicit budgets instead of maintaining a second fixed full-mode policy. JSON, SSE, replay, cache fingerprints, UI state, and diagnostics expose the same effective metadata.

**Tech Stack:** TypeScript 5.9, Node.js 20+, Jest 30 with ts-jest, vanilla frontend JavaScript, existing Vite/Tauri packaging, bilingual Markdown docs.

## Global Constraints

- `slim` remains the default and keeps its current response shape and verifier filenames.
- `responseProfile=mobile_compact` always resolves to `slim` and never retrieves desktop-sized context.
- Supported client budget modes are only `adaptive` and `unbounded`; unknown values resolve to `adaptive`.
- Server tiers are `standard` (`120/8000/64000/48000`), `extended` (`160/12000/128000/80000`), and `max` (`256/16000/256000/160000`) in `fragments/chars-per-fragment/RAG-chars/report-chars` order.
- `unbounded` disables product truncation but retains host-owned runtime byte, memory, timeout, and streaming-backpressure governors.
- User input cannot supply arbitrary numeric budgets or disable runtime governors.
- All changed task/plan/progress/walkthrough documents have separated English and Chinese sections.
- No Node-only hardware probing enters portable learning modules; host capability is injected through typed options/request metadata.

---

## English

### Task 1: Extend the typed contract and request normalization

**Files:**
- Modify: `src/learning/types.ts`
- Modify: `src/learning/requestNormalization.ts`
- Test: `src/learning/requestNormalization.test.ts`

**Interfaces:**
- Add `AgentConversationResponseBudgetMode = 'adaptive' | 'unbounded'`.
- Add `AgentConversationBudgetTier = 'standard' | 'extended' | 'max' | 'unbounded'`.
- Add `AgentConversationBudget` with `mode`, `tier`, optional numeric product limits, and `runtimeGovernor` metadata.
- Add optional `responseBudgetMode` and `responseBudgetCapability` to `AgentConversationRequest`.
- Add effective budget and truncation fields to `AgentConversationTrace` and response summary.

- [ ] Write normalization tests for `adaptive`, `unbounded`, aliases `no_cap`/`unbounded`, unknown values, and mobile-profile coexistence.
- [ ] Run `npm test -- --runInBand src/learning/requestNormalization.test.ts` and verify the new cases fail before implementation.
- [ ] Implement one normalization function that accepts camelCase and snake_case keys and returns `adaptive` for unknown values.
- [ ] Validate capability fields at the edge: `memoryClass` (`low|standard|high`), `workload` (`normal|large|max`), and optional numeric hints; reject non-finite/negative values by omission.
- [ ] Run the focused suite and verify all cases pass.
- [ ] Commit as `feat(agent-workspace): add adaptive budget request contract`.

### Task 2: Implement a pure adaptive budget resolver

**Files:**
- Create: `src/learning/agentResponseBudget.ts`
- Test: `src/learning/agentResponseBudget.test.ts`

**Interfaces:**
- Export immutable tier constants for `standard`, `extended`, and `max`.
- Export `resolveAgentResponseBudget(input)` accepting `{ responseMode, responseBudgetMode, capability, mobile }` and returning `AgentConversationBudget`.
- Export `applyRuntimeGovernor(input)` for deterministic byte/time checks used by JSON/report assembly tests.

- [ ] Add table-driven tests proving adaptive selection: missing/invalid capability -> standard; standard workload -> standard; large workload/high memory -> extended; max workload/high memory -> max; explicit unbounded -> unbounded; mobile -> slim-compatible standard runtime projection.
- [ ] Add tests proving client numeric hints never exceed max and cannot alter a tier directly.
- [ ] Implement pure selection with no `os`, filesystem, or browser globals.
- [ ] Implement unbounded runtime defaults as host-safe governor fields (timeout, max serialized bytes, max fragments processed) while leaving product limits unset.
- [ ] Run the new suite and commit as `feat(agent-workspace): resolve adaptive response budgets`.

### Task 3: Thread host capability into the platform and RAG assembly

**Files:**
- Modify: `src/learning/KnowledgeLearningPlatform.ts`
- Modify: `src/learning/evidenceContextAssembler.ts`
- Modify: `src/learning/ragContextPack.ts`
- Test: `src/learning/KnowledgeLearningPlatform.test.ts`
- Test: `src/learning/conversationComposer.test.ts`

**Interfaces:**
- Add `responseBudgetCapability` to `KnowledgeLearningPlatformOptions` and store it as validated immutable state.
- Resolve effective budget after mobile projection and before `queryKnowledge`/RAG assembly.
- Pass `AgentConversationBudget.rag` to `assembleReviewedRagEvidenceContext`.
- Extend `RagContextBudget` with an explicit `productCapDisabled` flag and optional governor metadata; do not use `Infinity` in serialized payloads.

- [ ] Add platform tests for standard/extended/max trace budget values and mobile forced slim behavior.
- [ ] Add RAG tests proving bounded tiers truncate with existing decision reasons, while unbounded keeps all candidate fragments until the runtime governor reports a stop.
- [ ] Refactor `normalizeRagContextBudget` to distinguish product caps from governor caps and keep existing default callers unchanged.
- [ ] Refactor `applyContextBudget` to skip product truncation only when the explicit flag is true and to mark governor truncation distinctly.
- [ ] Run focused platform/RAG suites and commit as `feat(agent-workspace): thread adaptive budgets through rag`.

### Task 4: Make full-report composition budget-aware and observable

**Files:**
- Modify: `src/learning/conversationComposer.ts`
- Modify: `src/learning/types.ts`
- Test: `src/learning/conversationComposer.test.ts`

**Interfaces:**
- Extend `ScopedConversationReplyParams` with `responseBudget?: AgentConversationBudget`.
- Replace fixed `FULL_RESPONSE_MAX_CHARS`/`FULL_RESPONSE_MAX_FRAGMENTS` reads with the resolved report budget and runtime governor.
- Return a report assembly state containing `truncated`, `truncationReason`, and counts; preserve the existing string return through the existing reply object.

- [ ] Add a regression fixture larger than 24,000 characters proving adaptive max report output reaches the configured tier.
- [ ] Add an unbounded fixture proving all safe sections are retained and no product cap reason is emitted.
- [ ] Add a forced-governor test proving partial output is returned with explicit truncation metadata and balanced Markdown math.
- [ ] Implement section selection/deduplication unchanged except for injected limits; preserve Mermaid/prompt filtering, same-document graph-neighbor filtering, delayed headings, and flattened-heading recovery.
- [ ] Run the composer suite and commit as `feat(agent-workspace): expand full report assembly budgets`.

### Task 5: Expose budget metadata across JSON, SSE, replay, and cache identity

**Files:**
- Modify: `src/server.ts`
- Modify: `src/learning/KnowledgeLearningPlatform.ts`
- Modify: `src/server.migration.test.ts`
- Modify: `src/notemd.server.integration.test.ts`

**Interfaces:**
- Include normalized request budget mode in `buildAgentConversationRequestFingerprint`.
- Include effective budget and truncation state in response `summary` and `trace`.
- Ensure `buildMobileAgentConversationResponse` strips desktop budget internals and always reports `responseMode=slim`.
- Ensure `projectAgentConversationTurnEvent` applies the same projection on live and replayed completion events.

- [ ] Add HTTP tests for adaptive default, explicit unbounded, cache separation, SSE replay separation, and mobile projection.
- [ ] Add tests that invalid budget modes normalize to adaptive instead of returning arbitrary limits.
- [ ] Implement typed serialization with finite numeric fields only; omit product-limit fields for unbounded.
- [ ] Run migration/integration suites and commit as `feat(agent-workspace): expose budget diagnostics and cache isolation`.

### Task 6: Add desktop UI controls and bilingual copy

**Files:**
- Modify: `src/frontend/index.html`
- Modify: `src/frontend/agent_workspace.js`
- Modify: `src/frontend/locales/en.json`
- Modify: `src/frontend/locales/zh.json`
- Test: `src/agent_workspace.frontend.test.ts`

**Interfaces:**
- Add a desktop-only budget selector with `adaptive` and `unbounded` options.
- Persist the preference under a new storage key; invalid stored values resolve to adaptive.
- Include `responseBudgetMode` in desktop conversation requests; mobile requests omit it and keep `mobile_compact`.
- Display effective tier/truncation status from response metadata without exposing internal traces.

- [ ] Add DOM/request tests for selector hydration, persistence, adaptive default, unbounded request, and mobile omission.
- [ ] Implement the selector with existing localization and control patterns; do not add a boolean flag that changes unrelated functions.
- [ ] Run frontend contract tests and commit as `feat(agent-workspace): add adaptive budget control`.

### Task 7: Expand runtime/browser verifiers and bilingual progress docs

**Files:**
- Modify: `scripts/verify-agent-answer-browser.js`
- Modify: `scripts/verify-knowledge-workspace-runtime.js`
- Modify: `docs/diataxis/en/explanation/development-progress-dashboard.md`
- Modify: `docs/diataxis/zh/explanation/development-progress-dashboard.md`

- [ ] Add verifier arguments `--response-budget adaptive|unbounded` and assertions for effective tier, report length, balanced math, no Mermaid/prompt leakage, and explicit governor truncation.
- [ ] Run fixture browser probes for adaptive and unbounded, then run real `waterglass` full probes in Chromium.
- [ ] Record actual counts/lengths and the fact that mobile remains slim in both language documents.
- [ ] Run Diátaxis/docs checks and commit as `docs(agent-workspace): document adaptive full response verification`.

### Task 8: Full verification, CI, and clean main

**Files:**
- No source changes expected unless a verification regression is found.

- [ ] Run `npm test -- --runInBand` and require zero failed suites.
- [ ] Run `npm run build:with-vite` and require exit code 0.
- [ ] Run `npm run test:gates` or the exact local gate subset available on the host.
- [ ] Verify desktop adaptive/unbounded browser probes and mobile projection/package budget.
- [ ] Inspect `git diff`, commit all implementation/documentation changes with Conventional Commit messages, and push `main`.
- [ ] Poll every workflow for the pushed commit; only report completion after all required CI checks are successful.
- [ ] Confirm `git status --short --branch` reports `main...origin/main` with no worktree changes.

## 中文

### 任务 1：扩展类型契约与请求归一化

**文件：**
- 修改：`src/learning/types.ts`
- 修改：`src/learning/requestNormalization.ts`
- 测试：`src/learning/requestNormalization.test.ts`

**接口：**
- 增加 `AgentConversationResponseBudgetMode = 'adaptive' | 'unbounded'`。
- 增加 `AgentConversationBudgetTier = 'standard' | 'extended' | 'max' | 'unbounded'`。
- 增加包含 `mode`、`tier`、可选产品限制和 `runtimeGovernor` 元数据的 `AgentConversationBudget`。
- 在 `AgentConversationRequest` 增加可选 `responseBudgetMode`、`responseBudgetCapability`。
- 在 `AgentConversationTrace` 与 response summary 增加 effective budget 和截断字段。

- [ ] 为 `adaptive`、`unbounded`、`no_cap`/`unbounded` 别名、未知值和移动 profile 共存增加归一化测试。
- [ ] 运行 `npm test -- --runInBand src/learning/requestNormalization.test.ts`，确认实现前新增用例失败。
- [ ] 实现单一归一化函数，支持 camelCase/snake_case，未知值回落 `adaptive`。
- [ ] 在边界校验 capability：`memoryClass`（`low|standard|high`）、`workload`（`normal|large|max`）和可选数字提示；非法/非有限/负数直接忽略。
- [ ] 运行聚焦套件并确认全部通过。
- [ ] 提交：`feat(agent-workspace): add adaptive budget request contract`。

### 任务 2：实现纯函数 adaptive budget resolver

**文件：**
- 新建：`src/learning/agentResponseBudget.ts`
- 测试：`src/learning/agentResponseBudget.test.ts`

**接口：**
- 导出 `standard`、`extended`、`max` 的不可变档位常量。
- 导出 `resolveAgentResponseBudget(input)`，输入 `{ responseMode, responseBudgetMode, capability, mobile }`，返回 `AgentConversationBudget`。
- 导出 `applyRuntimeGovernor(input)`，供 JSON/report 拼装测试使用。

- [ ] 增加表驱动测试：capability 缺失/非法 -> standard；standard workload -> standard；large/high -> extended；max/high -> max；显式 unbounded -> unbounded；移动端 -> slim 兼容的 standard runtime projection。
- [ ] 增加测试证明客户端数字提示不能超过 max，也不能直接改变档位。
- [ ] 实现纯选择逻辑，不引用 `os`、文件系统或浏览器全局对象。
- [ ] unbounded 使用宿主安全的运行时默认值（超时、序列化字节、处理 fragment 数），产品限制字段保持未设置。
- [ ] 运行新套件并提交：`feat(agent-workspace): resolve adaptive response budgets`。

### 任务 3：将宿主能力接入 platform 与 RAG 拼装

**文件：**
- 修改：`src/learning/KnowledgeLearningPlatform.ts`
- 修改：`src/learning/evidenceContextAssembler.ts`
- 修改：`src/learning/ragContextPack.ts`
- 测试：`src/learning/KnowledgeLearningPlatform.test.ts`
- 测试：`src/learning/conversationComposer.test.ts`

**接口：**
- 在 `KnowledgeLearningPlatformOptions` 增加 `responseBudgetCapability`，并以校验后的不可变状态保存。
- 移动投影后、RAG 拼装前解析 effective budget。
- 将 `AgentConversationBudget.rag` 传给 `assembleReviewedRagEvidenceContext`。
- 为 `RagContextBudget` 增加显式 `productCapDisabled` 和可选 governor 元数据；禁止用 `Infinity` 序列化。

- [ ] 增加 standard/extended/max trace 数值与移动强制 slim 的 platform 测试。
- [ ] 增加 RAG 测试：有界档位按既有原因截断，unbounded 保留所有候选 fragment，直到运行时 governor 停止。
- [ ] 重构 `normalizeRagContextBudget` 区分产品限制和 governor 限制，并保持既有默认调用不变。
- [ ] 重构 `applyContextBudget`：只有显式 flag 才跳过产品截断，并用独立原因标记 governor 截断。
- [ ] 运行聚焦 platform/RAG 套件并提交：`feat(agent-workspace): thread adaptive budgets through rag`。

### 任务 4：使 full-report 拼装读取预算并可观测

**文件：**
- 修改：`src/learning/conversationComposer.ts`
- 修改：`src/learning/types.ts`
- 测试：`src/learning/conversationComposer.test.ts`

**接口：**
- `ScopedConversationReplyParams` 增加 `responseBudget?: AgentConversationBudget`。
- 用 effective report budget 和 runtime governor 替代 `FULL_RESPONSE_MAX_CHARS`/`FULL_RESPONSE_MAX_FRAGMENTS`。
- 返回带 `truncated`、`truncationReason`、计数的 report assembly state，同时保持现有 reply 字符串接口。

- [ ] 增加超过 24,000 字符的 fixture，证明 adaptive max report 可达到配置档位。
- [ ] 增加 unbounded fixture，证明安全章节全部保留且不产生产品限制原因。
- [ ] 增加强制 governor 测试，证明返回部分输出、带显式截断元数据且 Markdown 数学公式成对。
- [ ] 保持 Mermaid/prompt 过滤、同文档 graph-neighbor 过滤、延迟标题和扁平标题恢复逻辑不变，仅注入新限制。
- [ ] 运行 composer 套件并提交：`feat(agent-workspace): expand full report assembly budgets`。

### 任务 5：让 JSON、SSE、replay 与缓存身份暴露预算元数据

**文件：**
- 修改：`src/server.ts`
- 修改：`src/learning/KnowledgeLearningPlatform.ts`
- 修改：`src/server.migration.test.ts`
- 修改：`src/notemd.server.integration.test.ts`

**接口：**
- `buildAgentConversationRequestFingerprint` 纳入归一化 budget mode。
- response `summary` 与 `trace` 包含 effective budget 和截断状态。
- `buildMobileAgentConversationResponse` 清除桌面预算内部字段并始终报告 `responseMode=slim`。
- `projectAgentConversationTurnEvent` 对实时与 replay completion 使用相同投影。

- [ ] 增加 adaptive 默认、显式 unbounded、缓存隔离、SSE replay 隔离和移动投影 HTTP 测试。
- [ ] 增加非法预算模式回落 adaptive 而非接受任意限制的测试。
- [ ] 使用仅包含有限数字的 typed serialization；unbounded 省略产品限制字段。
- [ ] 运行 migration/integration 套件并提交：`feat(agent-workspace): expose budget diagnostics and cache isolation`。

### 任务 6：增加桌面 UI 控件与双语文案

**文件：**
- 修改：`src/frontend/index.html`
- 修改：`src/frontend/agent_workspace.js`
- 修改：`src/frontend/locales/en.json`
- 修改：`src/frontend/locales/zh.json`
- 测试：`src/agent_workspace.frontend.test.ts`

**接口：**
- 增加仅桌面显示的 adaptive/unbounded budget selector。
- 使用新 storage key 持久化；非法存储值回落 adaptive。
- 桌面请求包含 `responseBudgetMode`；移动请求省略该字段并保留 `mobile_compact`。
- 根据 response 元数据显示 effective tier/截断状态，不暴露内部 trace。

- [ ] 增加 selector hydration、持久化、adaptive 默认、unbounded 请求和移动省略字段的 DOM/request 测试。
- [ ] 使用现有本地化与控件模式实现；不增加改变多个职责的布尔开关。
- [ ] 运行 frontend contract 测试并提交：`feat(agent-workspace): add adaptive budget control`。

### 任务 7：扩展 runtime/browser verifier 与双语进度文档

**文件：**
- 修改：`scripts/verify-agent-answer-browser.js`
- 修改：`scripts/verify-knowledge-workspace-runtime.js`
- 修改：`docs/diataxis/en/explanation/development-progress-dashboard.md`
- 修改：`docs/diataxis/zh/explanation/development-progress-dashboard.md`

- [ ] 增加 verifier 参数 `--response-budget adaptive|unbounded`，断言 effective tier、报告长度、公式成对、无 Mermaid/prompt 泄漏以及 governor 截断状态。
- [ ] 运行 adaptive/unbounded fixture 浏览器探针，再运行 Chromium 真实 `waterglass` full 探针。
- [ ] 记录实际数量/长度与移动始终 slim 的事实到双语文档。
- [ ] 运行 Diátaxis/docs 检查并提交：`docs(agent-workspace): document adaptive full response verification`。

### 任务 8：完整验证、CI 与 clean main

**文件：**
- 无预期源代码变更，除非验证发现回归。

- [ ] 运行 `npm test -- --runInBand`，要求失败套件为 0。
- [ ] 运行 `npm run build:with-vite`，要求退出码为 0。
- [ ] 运行 `npm run test:gates` 或当前主机可用的等价本地门禁子集。
- [ ] 验证桌面 adaptive/unbounded 浏览器探针与移动 projection/包体预算。
- [ ] 检查 `git diff`，使用 Conventional Commit 提交全部实现/文档变更并推送 `main`。
- [ ] 轮询推送 commit 的所有 workflow；全部 required CI 成功后才能报告完成。
- [ ] 确认 `git status --short --branch` 只显示 `main...origin/main`，工作区无变更。
