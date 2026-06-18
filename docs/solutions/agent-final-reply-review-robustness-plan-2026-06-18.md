---
module: architecture
tags: [agent-workspace, final-reply-review, dag, answer-release, robustness, compatibility]
problem_type: implementation-plan
created: 2026-06-18
updated: 2026-06-18
status: in_progress
version: 2026.06.18
---

# 2026-06-18 v1.7.0 - Agent Final Reply Review Robustness Plan

## English Document

### Objective

This note corrects a structural gap in the current agent architecture: the system could retrieve evidence, assemble DAG context, compose an answer, and render supporting panes, but it still had no dedicated owner for the last decision that matters most: whether the public answer is fit to be released.

The target is not another prompt framework. The target is a deterministic release-review layer that:

1. evaluates whether the public answer is supported by the current scoped evidence,
2. rewrites or abstains when the drafted answer leaks internal diagnostics or over-explains support material,
3. keeps developer detail in traces, `knowledge_run`, evidence panes, and exports,
4. uses the current project DAG as structured evidence input rather than treating graph data as prompt decoration,
5. remains additive and backward-compatible.

### First Principles

#### Term Definitions

- **Draft answer**: the first user-facing sentence produced by answer synthesis before release gating.
- **Public answer**: the final sentence exposed in the main answer area.
- **Answer release review**: a post-synthesis, pre-release decision layer that can `release`, `revise`, or `abstain`.
- **Revision**: contract-preserving rewrite of a grounded draft into a narrower public answer.
- **Abstention**: a concise refusal to over-claim when evidence is insufficient.
- **Evidence sufficiency**: the minimum grounded support required to let the system answer instead of abstain.
- **Graph support sufficiency**: whether the DAG context around the anchor/support set is rich enough for the answer shape being attempted.
- **Public-surface contraction**: the rule that the main answer must not dump citations, graph traces, runtime counters, planner state, or review metadata.
- **Internal diagnostic leakage**: any public-answer text that exposes runtime terms such as `retrieval_candidates_below_threshold`, planner state, or debug counters.
- **Knowledge run**: the durable operator/developer artifact that carries claims, gates, and review context. It is not the same thing as the user-visible answer.

#### Layered Architecture

The correct architecture is a pipeline of owners, not a single "RAG" blob:

1. **Source layer**
   - Owners: `Knowledge_Base`, loader/indexing paths, markdown runtime.
   - Role: provide durable text, evidence spans, and canonical source paths.

2. **Scoped retrieval layer**
   - Owners: `KnowledgeLearningPlatform.buildQueryBackendContext()`, `queryBackend.ts`.
   - Role: find candidate atoms/documents under the requested scope.
   - Failure mode from the screenshot: planner normalization and retrieval scoring drifted apart on compact alias queries such as `什么是waterglass?`.

3. **DAG context assembly layer**
   - Owner: `src/learning/graphContextAssembler.ts`.
   - Role: choose the anchor, order support nodes, attach explicit `connectionPaths`, bounded predecessor/successor windows, temporal warnings, and diagnostics.
   - This is where the project’s existing DAG becomes answer-time structure, not just storage.

4. **Answer synthesis layer**
   - Owner: `src/learning/conversationComposer.ts`.
   - Role: build the draft answer plus structured secondary blocks.
   - Limitation before this slice: synthesis still owned the only public-answer string, so a bad empty-result sentence could leak straight to the main chat surface.

5. **Answer release review layer**
   - New owner: `src/learning/answerReleaseReview.ts`.
   - Role: inspect the drafted answer against deterministic gates, then decide `release`, `revise`, or `abstain`.
   - This layer is the missing robustness boundary.

6. **Operator surfaces**
   - Owners: `knowledgeRun`, traces, workflow artifacts, evidence panes, exports.
   - Role: keep the richer explanation, diagnostics, graph telemetry, and review state available without crowding the public answer.

7. **Main answer surface**
   - Owners: `agent_workspace.js`, structured-answer render path.
   - Role: render only the contracted public answer.

### How the Layers Connect

1. Query enters `/api/knowledge/conversation`.
2. Retrieval resolves scope and candidates.
3. DAG context assembly converts candidates into bounded graph context.
4. Composer emits a draft answer plus structured secondary blocks.
5. `answerReleaseReview` evaluates the draft against deterministic gates:
   - evidence sufficiency,
   - graph support sufficiency,
   - public-surface contraction,
   - internal diagnostic leakage,
   - abstention hygiene.
6. The review result rewrites the public answer if needed.
7. The final answer is released to the main chat surface.
8. The full review state is retained in `answerReleaseReview` on the response, trace, and `knowledgeRun`.

This sequencing matters. If review is merged into prompting, invariants become model-dependent. If review is moved into the frontend, the backend loses the durable release decision. If review is skipped entirely, the system can still return technically structured but product-poor answers.

### Root Cause Analysis of the Screenshot

Observed screenshot behavior:

- scope: `waterglass`
- user question: `什么是waterglass?`
- public answer leaked: `No scoped knowledge points matched ...`
- lower status strip showed `0 knowledge points | 0 citations`
- internal planner/retrieval failure details were effectively promoted to the main answer

The real failure had two layers:

1. **Retrieval-contract failure**
   - compact alias normalization had drifted between planner and retriever.
   - This was already fixed by passing planner-derived query variants into retrieval scoring.

2. **Release-review failure**
   - even when retrieval failed, the public answer surface had no final gate stopping internal language from leaking.

The first fix restores evidence. The second fix restores robustness.

### Code-vs-Requirement Reconciliation

| Requirement | Current implementation | Progress call |
|---|---|---|
| Public answer must not leak backend diagnostics | New `src/learning/answerReleaseReview.ts` detects and blocks diagnostic leakage before release. | Implemented |
| Empty-result answers must abstain cleanly instead of exposing runtime detail | Reviewer now downgrades unsupported drafts into concise abstentions. | Implemented |
| Grounded drafts must stay aligned with their cited/knowledge-point support | Reviewer now enforces `claim_grounding_alignment` and revises drafts when lexical evidence overlap shows claim drift. | Implemented |
| Final review state must be inspectable by developers | `answerReleaseReview` is now stored additively on `AgentConversationResponse`, `AgentConversationTrace`, and `KnowledgeRun`. | Implemented |
| Operator surfaces must expose reviewer state without widening the main answer area | `src/frontend/agent_workspace.js` sanitizes `answerReleaseReview`, and `src/frontend/workspace_panes.js` renders release-review detail/history inside `knowledge_run` cards. | Implemented |
| Reviewer telemetry must survive export/replay surfaces | `src/export/WorkspaceExportBundle.ts` now emits compact `runtime.knowledgeRunReports[*].answerReleaseReview` summaries for durable replay and operator audit. | Implemented |
| Screenshot-backed `waterglass` case must become a formal acceptance requirement | `scripts/verify-knowledge-workspace-runtime.js` now requires `answerReleaseReview`, rejects empty-scope debug text in the public answer, and verifies `publicAnswer === result.answer`. | Implemented |
| DAG structure must inform the answer before release review | Existing `graphContextAssembler.ts` remains the structure source; the new review layer consumes that output instead of replacing it. | Preserved |
| Backward compatibility must remain explicit | `assistantMessage`, `answer`, `assistantBlocks`, and existing clients remain valid; `answerReleaseReview` is additive. | Preserved |

### Landed Implementation Slice

#### New owner

- `src/learning/answerReleaseReview.ts`

What it does:

- inspects the synthesized draft answer,
- detects internal diagnostic leakage,
- checks whether the main answer is over-expanded,
- decides `release` / `revise` / `abstain`,
- emits a deterministic `AnswerReleaseReview` record.

#### Type surface

Extended in `src/learning/types.ts`:

- `AnswerReleaseDecision`
- `AnswerReleaseGateId`
- `AnswerReleaseGate`
- `AnswerReleaseReview`

Attached additively to:

- `AgentConversationResponse.answerReleaseReview`
- `AgentConversationTrace.answerReleaseReview`
- `KnowledgeRun.answerReleaseReview`

#### Integration points

- `src/learning/conversationComposer.ts`
  - still composes the draft answer,
  - now delegates final release decision to `reviewAnswerRelease()`.
- `src/learning/KnowledgeLearningPlatform.ts`
  - now persists the review result into response, trace, and workflow artifact payloads.
- `scripts/verify-knowledge-workspace-runtime.js`
  - now treats reviewer presence and public-answer hygiene as runtime acceptance criteria.

#### Phase-2 hardening landed on top of the first reviewer slice

- The reviewer now enforces `claim_grounding_alignment`, using deterministic lexical support overlap across ASCII and CJK features. This does not prove semantic truth, but it does stop obvious grounded-draft drift from reaching the public answer unchanged.
- Scoped Chinese misses now produce Chinese abstentions instead of leaking English diagnostic-heavy fallback text. This matters because the screenshot-backed `waterglass` regression came from a Chinese query path.
- Operator inspection now exposes reviewer state in `knowledge_run` detail/history cards through sanitized `answerReleaseReview` payloads. The public answer area stays contracted; the richer release decision moves to developer/operator surfaces instead.
- The user-provided screenshot evidence (`1781782257390.jpg`) is now treated as a formal acceptance case through the `waterglass` runtime verifier, not as an informal anecdote.

#### Phase-3 export/audit hardening landed on top of the operator-surface slice

- `WorkspaceExportBundle.ts` now projects a compact reviewer summary into `runtime.knowledgeRunReports[*].answerReleaseReview`.
- That summary intentionally stays narrow: `reviewedAt`, `decision`, `revised`, `failedGateIds`, `leakedInternalFragmentCount`, and `reason`.
- The export report does not duplicate full original/public answer text into the compare-ready summary surface. Those heavier details remain available in workflow artifacts and conversation traces for deeper developer inspection.
- `WorkspaceExportBundle.test.ts` now covers three states explicitly:
  - `release` summary export,
  - `revise` summary export with payload-level fallback,
  - backward-compatible omission when review data is absent.

### Why the Earlier Framework Proposals Were Insufficient

Reviewed references under `ref/`:

- `ref/dspy` `4987601`
- `ref/guidance` `21b1d90`
- `ref/semantic-kernel` `13f812b`
- `ref/langchain` `847312e`
- `ref/litellm` `cf2db41`
- `ref/ahadiff` `897768c`

Critical conclusion:

- **DSPy** is useful for evaluation/program structure, but it does not own runtime invariants unless you externalize them into explicit gates first.
- **Guidance** is useful for constrained structured outputs, but structured output is not the same as a release decision.
- **Semantic Kernel** and **LangChain Core** can organize calls, but they do not solve evidence-policy ownership.
- **LiteLLM** helps provider routing, not answer correctness.
- **AhaDiff** is the most relevant conceptual reference because it separates public conclusion from evidence and verification state. The new local reviewer layer follows that direction without importing its runtime model.

Therefore the better design is:

- keep runtime invariants in local TypeScript,
- keep LLM/framework usage optional and downstream of explicit contracts,
- treat frameworks as references, not ownership substitutes.

### Tradeoffs

- **Deterministic first, model-assisted later**
  - Good: stable invariants, easier tests, less latency.
  - Cost: contradiction detection is still shallow compared to a dedicated verifier model.

- **Abstain instead of bluff**
  - Good: better trust boundary.
  - Cost: more visible "I cannot ground this yet" behavior until retrieval/index quality improves.

- **Review at the backend, not the frontend**
  - Good: durable artifact trail and exportability.
  - Cost: one more backend owner to maintain.

### Pitfalls

1. Do not mistake evidence presence for release readiness.
2. Do not let review logic drift into prompt text only.
3. Do not let the frontend decide final public-answer hygiene.
4. Do not overload `KnowledgeLearningPlatform.ts` again; the new reviewer must stay an explicit owner.
5. Do not broaden the gate list faster than you can regression-test it.

### Mental Model

Think of the answer path as three distinct decisions:

1. **Can the system find relevant atoms?**
2. **Can the system place them into a meaningful DAG context?**
3. **Does the drafted answer deserve public release?**

The first two decide capability. The third decides trust.

### Real Applications

- Compact alias queries in a scoped corpus: `什么是waterglass?`
- Partial-evidence queries where retrieval finds notes but the public answer is over-expanded
- Future contradiction-sensitive paths where claim/citation alignment must trigger revision without changing the visible answer surface contract

### Common Misconceptions

- "We already have quality gates, so release review already exists."
  - False. `knowledgeRun.quality.gates` evaluated artifact quality, not public-answer release.

- "Prompt frameworks can fix this by better prompting."
  - False. Prompting can help outputs, but it cannot replace a deterministic release owner.

- "If the main answer is shorter, the problem is solved."
  - False. A short answer can still leak the wrong thing.

### Next Direction

1. Add deeper contradiction checks beyond the current lexical grounding alignment, but only after building an explicit regression corpus for false-positive control.
2. Build longer-horizon operator audits on top of the new exported reviewer summaries instead of adding another parallel telemetry path.
3. Expand regression corpus beyond `waterglass` using real alias/scope failures.
4. Continue owner reduction in `KnowledgeLearningPlatform.ts` and `agent_workspace.js` only where the new module owns real invariants.

### Five-Point Summary

1. The missing mechanism was not graph retrieval; it was final public-answer release review.
2. The correct owner is a local deterministic reviewer layer, not a new prompt framework.
3. The current project DAG remains the evidence substrate; the reviewer does not replace graph assembly.
4. The `waterglass` screenshot is now encoded as a runtime acceptance requirement through reviewer-aware verification.
5. The landed slice is backward-compatible and materially improves robustness without widening the main answer surface.

## 中文文档

### 目标

这份说明针对的是一个结构性缺口：系统已经能做检索、DAG 上下文装配、回答合成、右侧证据面板渲染，但在真正把答案发给用户之前，仍然没有一个专门 owner 负责判断“这个公开回答是否值得被释放”。

目标不是再引入一层 prompt framework，而是补上一层确定性的最终回复审核/纠错机制，它要做到：

1. 判断当前 scoped evidence 是否足以支持公开回答；
2. 当草稿回答泄漏内部诊断或把支撑材料堆进主回答区时，改写或降级为 abstain；
3. 把开发者细节留在 trace、`knowledge_run`、evidence pane 和 export；
4. 继续使用项目现有 DAG 作为结构化证据，而不是把图结构当成 prompt 装饰；
5. 保持 additive 和向前兼容。

### 第一性原理

#### 术语定义

- **草稿回答（draft answer）**：回答合成层先产出的第一版用户回答文本。
- **公开回答（public answer）**：真正进入主回答区的最终文本。
- **最终回复审核（answer release review）**：位于回答合成之后、公开释放之前的决策层，可做 `release`、`revise`、`abstain`。
- **纠错（revision）**：在不破坏兼容性的前提下，把已有证据支撑的草稿收缩成更干净的主回答。
- **降级拒答（abstention）**：证据不足时，明确拒绝过度声称。
- **证据充分性（evidence sufficiency）**：系统可以公开回答而不是拒答的最低支撑阈值。
- **图支撑充分性（graph support sufficiency）**：当前 DAG 上下文是否足以支撑这次回答形态。
- **主表面收缩（public-surface contraction）**：主回答区不得堆 citation、graph trace、runtime counter、planner state、review metadata。
- **内部诊断泄漏（internal diagnostic leakage）**：公开回答里出现 `retrieval_candidates_below_threshold`、planner 诊断、debug counter 等内部词汇。
- **Knowledge Run**：给运维/开发者查看的 durable artifact，不等于用户主回答。

#### 分层架构

正确做法不是再谈一个模糊的“RAG 层”，而是把 owner 分开：

1. **源层**
   - Owner：`Knowledge_Base`、loader/indexing、markdown runtime。
   - 职责：提供持久文本、evidence span、canonical source path。

2. **Scoped retrieval 层**
   - Owner：`KnowledgeLearningPlatform.buildQueryBackendContext()`、`queryBackend.ts`。
   - 职责：在 scope 约束下找到候选 atom/document。
   - 截图里的第一类故障就在这里：`什么是waterglass?` 的 compact alias 归一化与 retrieval scoring 发生漂移。

3. **DAG 上下文装配层**
   - Owner：`src/learning/graphContextAssembler.ts`。
   - 职责：选择 anchor、排序 support node、挂显式 `connectionPaths`、补 predecessor/successor window、temporal warning 与 graph diagnostics。
   - 这里才是“现有 DAG 在回答时真正发挥结构化作用”的位置。

4. **回答合成层**
   - Owner：`src/learning/conversationComposer.ts`。
   - 职责：生成草稿回答与结构化次级 block。
   - 在本切片前的限制是：合成层同时拥有唯一主回答字符串，因此一条坏的 empty-result 句子可以直接泄漏到主聊天区。

5. **最终回复审核层**
   - 新 owner：`src/learning/answerReleaseReview.ts`。
   - 职责：对草稿回答做确定性门禁，决定 `release` / `revise` / `abstain`。
   - 这就是本项目之前缺失的鲁棒性边界。

6. **运维/开发者表面**
   - Owner：`knowledgeRun`、trace、workflow artifact、evidence pane、export。
   - 职责：保留更丰富的解释、诊断、graph telemetry 与 review state，而不是塞进主回答区。

7. **主回答表面**
   - Owner：`agent_workspace.js`、structured-answer render path。
   - 职责：只显示已经收缩好的公开回答。

### 各层如何连接

1. 请求进入 `/api/knowledge/conversation`。
2. retrieval 解析 scope 并返回候选。
3. DAG context assembler 把候选转成有界图上下文。
4. composer 先产出草稿回答和结构化次级 block。
5. `answerReleaseReview` 再对草稿做确定性审核：
   - evidence sufficiency
   - graph support sufficiency
   - public-surface contraction
   - internal diagnostic leakage
   - abstention hygiene
6. review 层决定最终公开回答是否原样放行、收缩重写、或降级拒答。
7. 主回答区只渲染最终公开回答。
8. review 结果以 `answerReleaseReview` 的形式保留在 response、trace 与 `knowledgeRun` 中。

顺序不能错。把 review 融进 prompt，会让不变量退化成模型习惯；把 review 放前端，会丢掉服务端的 durable decision；完全不做 review，则系统依然可能返回结构化但产品质量很差的公开回答。

### 截图故障的根因

截图里的行为：

- scope 为 `waterglass`
- 用户问题是 `什么是waterglass?`
- 主回答区出现 `No scoped knowledge points matched ...`
- 底部状态条显示 `0 knowledge points | 0 citations`
- planner / retrieval 的内部失败信息实际被提升到了主回答表面

这里有两层故障：

1. **检索契约故障**
   - compact alias 在 planner 与 retriever 之间漂移。
   - 这一层已通过把 planner-derived query variants 送入 retrieval scoring 修复。

2. **最终回复审核故障**
   - 即使 retrieval 失败，主回答区也没有最后一层 gate 阻止内部诊断语言泄漏。

第一层修复恢复召回；第二层修复恢复鲁棒性。

### 当前代码与要求对账

| 要求 | 当前实现 | 进度判断 |
|---|---|---|
| 主回答区不能泄漏后端诊断 | 新增 `src/learning/answerReleaseReview.ts`，在 release 前拦截 diagnostic leakage。 | 已实现 |
| 空结果回答必须 clean abstain，而不是暴露 runtime 细节 | reviewer 现在会把 unsupported draft 降级成简洁 abstention。 | 已实现 |
| grounded draft 必须与 citation/knowledge-point 支撑保持一致 | reviewer 现在会执行 `claim_grounding_alignment`，在词法证据重叠不足时强制改写漂移主张。 | 已实现 |
| 最终审核结果必须可供开发者检查 | `answerReleaseReview` 已加到 `AgentConversationResponse`、`AgentConversationTrace`、`KnowledgeRun`。 | 已实现 |
| 运维表面必须能看到 reviewer 状态且不扩大主回答区 | `src/frontend/agent_workspace.js` 会净化 `answerReleaseReview`，`src/frontend/workspace_panes.js` 会在 `knowledge_run` 卡片中渲染 release-review 明细 / 历史。 | 已实现 |
| reviewer 遥测必须能跨 export/replay 表面保留 | `src/export/WorkspaceExportBundle.ts` 现在会在 `runtime.knowledgeRunReports[*].answerReleaseReview` 中输出紧凑 reviewer 摘要，供离线回放与运维审计使用。 | 已实现 |
| `waterglass` 截图必须成为正式验收项 | `scripts/verify-knowledge-workspace-runtime.js` 现在要求 reviewer 存在、拒绝公开回答中的 empty-scope debug 文本，并校验 `publicAnswer === result.answer`。 | 已实现 |
| DAG 结构必须在 review 前参与回答构建 | 现有 `graphContextAssembler.ts` 继续提供结构化证据，新 reviewer 只消费结果，不替代 DAG owner。 | 已保持 |
| 向前兼容必须显式 | `assistantMessage`、`answer`、`assistantBlocks` 和现有 client 都不破；`answerReleaseReview` 是 additive 字段。 | 已保持 |

### 本轮已落地实现

#### 新 owner

- `src/learning/answerReleaseReview.ts`

它负责：

- 检查草稿回答；
- 识别 internal diagnostic leakage；
- 判断主回答是否过度展开；
- 决定 `release` / `revise` / `abstain`；
- 产出确定性的 `AnswerReleaseReview` 记录。

#### 类型面

在 `src/learning/types.ts` 中新增：

- `AnswerReleaseDecision`
- `AnswerReleaseGateId`
- `AnswerReleaseGate`
- `AnswerReleaseReview`

并以 additive 方式接到：

- `AgentConversationResponse.answerReleaseReview`
- `AgentConversationTrace.answerReleaseReview`
- `KnowledgeRun.answerReleaseReview`

#### 接入点

- `src/learning/conversationComposer.ts`
  - 仍然负责合成草稿回答；
  - 但最终公开回答现在交给 `reviewAnswerRelease()` 决定。
- `src/learning/KnowledgeLearningPlatform.ts`
  - 现在会把 review 结果写入 response、trace 和 workflow artifact payload。
- `scripts/verify-knowledge-workspace-runtime.js`
  - 现在把 reviewer 存在性与公开回答卫生要求纳入运行时门禁。

#### 在首版 reviewer 之上已继续落地的 Phase-2 加固

- reviewer 现在会执行 `claim_grounding_alignment`：通过确定性的 ASCII/CJK 词法支撑重叠检查，阻止“有证据但主张已明显漂移”的草稿原样进入主回答区。它不能证明语义真值，但足以拦住当前最直接的 grounded-drift 回归。
- 中文 scoped miss 现在会返回中文 abstention，而不是退化成 English diagnostic-heavy fallback。这个细节重要，因为截图驱动的 `waterglass` 回归本身就来自中文提问路径。
- 运维检查面现在已经能通过净化后的 `answerReleaseReview` 在 `knowledge_run` 明细 / 历史卡片中查看 reviewer 状态。主回答区继续保持收缩， richer release decision 进入 developer/operator surface。
- 用户提供的截图证据（`1781782257390.jpg`）现在已经被提升为正式验收用例，而不再只是口头描述：`waterglass` 运行时 verifier 会对这条回归路径做强制校验。

#### 在运维检查面之后继续落地的 Phase-3 export/audit 加固

- `WorkspaceExportBundle.ts` 现在会把紧凑 reviewer 摘要投影到 `runtime.knowledgeRunReports[*].answerReleaseReview`。
- 这个摘要有意保持窄口径：只保留 `reviewedAt`、`decision`、`revised`、`failedGateIds`、`leakedInternalFragmentCount` 与 `reason`。
- export report 不会把完整 original/public answer 文本重复塞进 compare-ready summary surface；这些较重细节仍保留在 workflow artifact 与 conversation trace 中供开发者深查。
- `WorkspaceExportBundle.test.ts` 现在显式覆盖三种状态：
  - `release` 摘要导出，
  - 带 payload-level fallback 的 `revise` 摘要导出，
  - review 数据缺失时的向前兼容省略行为。

### 为什么先前那些框架方案不够

已分析的 `ref/` 参考：

- `ref/dspy` `4987601`
- `ref/guidance` `21b1d90`
- `ref/semantic-kernel` `13f812b`
- `ref/langchain` `847312e`
- `ref/litellm` `cf2db41`
- `ref/ahadiff` `897768c`

关键结论：

- **DSPy** 适合做 evaluation/program 结构，但前提是你先把 runtime invariants 明确成 gate。
- **Guidance** 适合约束结构化输出，但“输出是 JSON”不等于“公开回答值得发布”。
- **Semantic Kernel** / **LangChain Core** 能组织调用，但不能替代 evidence-policy owner。
- **LiteLLM** 管的是 provider routing，不管答案正确性。
- **AhaDiff** 最有启发，因为它把公开结论、证据、验证状态分层；本地 reviewer 现在沿着这个方向实现，但不引入它的运行时依赖。

所以更优方向是：

- 把 runtime invariant 留在本地 TypeScript；
- 把 LLM/framework 放到显式契约之后；
- 把这些开源库当参考，而不是 owner 替身。

### 权衡

- **先确定性，后模型化**
  - 好处：门禁稳定、可测试、低延迟。
  - 代价：claim/citation contradiction 检测目前仍然是浅层。

- **宁可 abstain，也不 bluff**
  - 好处：信任边界更清晰。
  - 代价：在 retrieval/index 继续完善前，会更频繁暴露“当前无法有依据回答”。

- **review 放后端，不放前端**
  - 好处：能留 durable artifact、可导出、可回放。
  - 代价：后端多一个 owner 需要维护。

### 坑点

1. 不要把“有证据”误认为“可公开发布”。
2. 不要把 review 逻辑重新藏回 prompt 文本。
3. 不要让前端决定最终公开回答卫生。
4. 不要再把 `KnowledgeLearningPlatform.ts` 撑大；reviewer 必须保持独立 owner。
5. 不要在缺少回归语料时过快扩张 gate 列表。

### 思维模型

把回答链路拆成三个判断：

1. **有没有找到相关 atom？**
2. **这些 atom 能不能放回有意义的 DAG 结构？**
3. **这条草稿回答值不值得公开放行？**

前两步决定能力，第三步决定可信度。

### 真实应用

- scoped corpus 里的 compact alias 问题：`什么是waterglass?`
- retrieval 命中但草稿回答仍然带 support framing 的场景
- 后续需要 claim/citation 对齐校验的路径

### 常见误区

- “我们已经有 quality gate，所以 release review 已经存在。”
  - 错。`knowledgeRun.quality.gates` 评估的是 artifact 质量，不是公开回答发布。

- “prompt framework 调一调就能解决。”
  - 错。prompt 可以改善输出，但不能替代确定性的 release owner。

- “回答够短就没问题。”
  - 错。短答案一样可能泄漏错的内容。

### 后续方向

1. 在显式回归语料具备之前，不扩大 gate 列表；先把当前 lexical grounding alignment 之外的更深矛盾检测建立在可控 false-positive 语料上。
2. 以当前已经导出的 reviewer summary 为底座，继续建设更长周期的运维审计，而不是再平行新增一条 telemetry 路径。
3. 把 alias/scope 回归语料从 `waterglass` 扩到更多真实失败案例。
4. 继续缩减 `KnowledgeLearningPlatform.ts` 与 `agent_workspace.js` 的 owner 压力，但前提仍然是“新模块拥有真实不变量”。

### 五点总结

1. 真正缺失的不是图检索，而是最终公开回答的 release review。
2. 正确 owner 是本地确定性 reviewer layer，不是再引入一层 prompt framework。
3. 项目现有 DAG 继续作为证据底座，reviewer 不会替代 graph assembly。
4. `waterglass` 截图已经被编码进正式运行时验收门禁。
5. 本轮落地保持向前兼容，同时实质提升了 agent 最终回复的鲁棒性。
