---
module: architecture
tags: [agent-workspace, final-reply-review, dag, answer-release, robustness, compatibility]
problem_type: implementation-plan
created: 2026-06-18
updated: 2026-06-19
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
| Grounded drafts must also be checked for deterministic structured fact conflicts | Reviewer now enforces `claim_structured_consistency`, revising grounded drafts when numeric or year facts conflict with support even though topical lexical overlap still passes. | Implemented baseline |
| Grounded drafts must also be checked for explicit polarity reversals | Reviewer now enforces `claim_polarity_consistency`, revising grounded drafts when they say `is not` / `不是` against support that still affirms the same claim skeleton. | Implemented baseline |
| Grounded drafts must also be checked for reversed DAG order claims | Reviewer now enforces `claim_graph_order_consistency`, revising drafts that invert grounded `prerequisite` or `sequence` direction from the assembled DAG. | Implemented baseline |
| Final review state must be inspectable by developers | `answerReleaseReview` is now stored additively on `AgentConversationResponse`, `AgentConversationTrace`, and `KnowledgeRun`. | Implemented |
| Operator surfaces must expose reviewer state without widening the main answer area | `src/frontend/agent_workspace.js` sanitizes `answerReleaseReview`, and `src/frontend/workspace_panes.js` renders release-review detail/history inside `knowledge_run` cards. | Implemented |
| Reviewer telemetry must survive export/replay surfaces | `src/export/WorkspaceExportBundle.ts` now emits compact `runtime.knowledgeRunReports[*].answerReleaseReview` summaries for durable replay and operator audit. | Implemented |
| Longer-horizon operator audit must reuse the same reviewer telemetry path | `WorkspaceExportBundle.ts` now derives `runtime.knowledgeRunAnswerReleaseAuditSummary`, and the history card renders the same multi-run audit shape from returned knowledge runs. | Implemented baseline |
| Trend windows and gate aging must also be derived from the same reviewer telemetry path | `runtime.knowledgeRunAnswerReleaseAuditSummary` now carries `reviewTrend` and `failedGateAging`, and the history card renders both without introducing another audit owner. | Implemented baseline |
| Compare-ready operator drilldowns must reuse the same reviewer telemetry path | `WorkspaceExportBundle.ts`, `agent_workspace.js`, and `workspace_panes.js` now surface recent/prior metric shifts, per-gate shifts, latest reviewed-pair deltas, and compare-card answer-release deltas from the same additive reviewer telemetry path. | Implemented baseline |
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

#### Phase-4 aggregate audit hardening landed on top of the export slice

- `WorkspaceExportBundle.ts` now derives `runtime.knowledgeRunAnswerReleaseAuditSummary` from the already-built `knowledgeRunReports` instead of introducing a second telemetry owner.
- The aggregate summary covers:
  - reviewed vs unreviewed run counts,
  - decision buckets (`release` / `revise` / `abstain` / `other`),
  - revised-run count,
  - runs with failed gates,
  - runs with leaked internal fragments,
  - total leaked-fragment count,
  - deterministic failed-gate frequency summaries,
  - latest reviewed timestamp.
- `src/frontend/agent_workspace.js` now builds the same aggregate release-audit summary from the returned knowledge-run history payload before trimming the visible run list, so the history card shows the full audit window instead of only the first rendered entries.
- `src/frontend/workspace_panes.js` now renders an operator-only `Release audit` block inside `knowledge_run` history, keeping the public answer area unchanged.
- `src/export/WorkspaceExportBundle.test.ts` and `src/agent_workspace.frontend.test.ts` now cover both the exported aggregate and the operator-history rendering path.

#### Phase-5 trend/gate-aging hardening landed on top of the aggregate slice

- `runtime.knowledgeRunAnswerReleaseAuditSummary` now also carries:
  - `reviewTrend`, with a deterministic two-window view over the latest reviewed runs,
  - `failedGateAging`, with per-gate failure count, last-seen review timestamp, and reviewed-run distance from the latest failure.
- The trend baseline is intentionally narrow:
  - it does not invent model-owned "improving/regressing" judgments yet,
  - it exposes deterministic reviewed-run windows first,
  - it establishes the stable audit window that later compare-ready drilldowns can build on without adding a second telemetry owner.
- `src/frontend/workspace_panes.js` now renders `Review trend` and `Gate aging` sections inside the operator-only knowledge-run history card.
- `src/export/WorkspaceExportBundle.test.ts`, `src/agent_workspace.frontend.test.ts`, and `src/agent_workspace.locale.contract.test.ts` now pin the new contract surface.

#### Phase-6 compare-ready drilldown hardening landed on top of the trend slice

- `runtime.knowledgeRunAnswerReleaseAuditSummary` now also carries a deterministic `comparison` block instead of forcing operators to infer drift from isolated counters.
- That comparison block intentionally stays telemetry-first:
  - `metricShifts` shows recent/prior reviewed-window deltas for release-review metrics,
  - `gateShifts` shows gate-specific recent/prior movement from the same audit window,
  - `latestPair` shows the newest reviewed pair delta without duplicating raw original/public answer text into the audit summary.
- `src/frontend/agent_workspace.js` now derives the same compare-ready audit shape from returned knowledge-run history before trimming visible runs, so the operator view and export path stay aligned.
- `src/frontend/workspace_panes.js` now renders:
  - `Review comparison`,
  - `Latest pair`,
  - `Gate shifts`,
  - and answer-release deltas inside the knowledge-run compare card.
- This keeps the public answer contracted while giving operators a pairwise drift surface for release-review behavior.
- `src/export/WorkspaceExportBundle.test.ts` and `src/agent_workspace.frontend.test.ts` now pin the additive comparison contract on both export and frontend history/compare surfaces.

#### Phase-7 shared regression corpus and planner-scope-recovery hardening landed on top of the compare slice

- `src/learning/KnowledgeWorkspaceConversationRegression.ts` now defines a shared deterministic alias/scope corpus for conversation robustness work.
- The initial corpus covers four cases:
  - `waterglass_explicit_scope_compact_zh`
  - `waterglass_explicit_scope_spaced_zh`
  - `financial_scope_recovery_spaced_en`
  - `financial_scope_recovery_compact_en`
- The screenshot-derived `waterglass_explicit_scope_compact_zh` case is now the durable acceptance owner for `1781782257390.jpg`, not only a one-off manual repro.
- `src/learning/KnowledgeWorkspaceConversationRegression.test.ts` now runs the same corpus in-memory and deliberately injects noisy `financial` documents (`liquidity`, `glass steagall act`, `watered stock`) so recovery has to beat realistic in-scope distractors.
- `scripts/verify-knowledge-workspace-runtime.js` now loads the built corpus by default when no ad hoc `--query` is supplied, and it also supports targeted `--case` execution without losing backward-compatible ad hoc `--target` or `--query` flows.
- This corpus exposed a second real bug in `KnowledgeLearningPlatform.ts`: planner scope recovery previously triggered only when reranking returned zero items.
- That rule was too weak. A scoped retrieval can return non-empty noise and still be wrong.
- `KnowledgeLearningPlatform.ts` now routes the decision through `shouldApplyPlannerScopeRecovery(...)`, which also triggers recovery when reranked items survive but none of them belong to planner title-hit documents.
- This is the correct invariant owner because the recovery decision belongs to retrieval-contract semantics, not to prompt wording, frontend presentation, or release-review heuristics.
- The result is that cross-scope title recovery now works even when `financial`-scope noise survives locally, while the public answer still remains governed by the later deterministic release-review layer.

#### Phase-8 structured contradiction hardening landed on top of the shared-corpus slice

- `src/learning/answerReleaseReview.ts` now adds a second contradiction-oriented reviewer gate: `claim_structured_consistency`.
- This gate deliberately does less than a generic verifier model:
  - it does not try to infer arbitrary semantic truth,
  - it only evaluates high-confidence comparable structured facts.
- The first supported contradiction family is intentionally narrow:
  - numeric facts with explicit technical units such as `%`, `kg/m3`, `GPa`, `kPa`, and similar stable units,
  - year claims when the local context actually looks date-like.
- The gate is deliberately conservative:
  - if the draft exposes no structured facts, it does nothing,
  - if grounded support exposes no comparable structured facts, it does nothing,
  - if support contains multiple comparable values and one of them matches the draft, it does not raise a contradiction.
- This is the right bias. A release gate that invents contradictions is worse than a narrower gate that only catches the highest-confidence ones.
- `src/learning/answerReleaseReview.test.ts` now pins three important behaviors:
  - numeric conflict forces `revise`,
  - year conflict forces `revise`,
  - multi-value support with one correct answer still `release`s cleanly.
- The revision builder was also tightened slightly while landing this slice:
  - when the support sentence already starts with an article + title phrase, the reviewer no longer prefixes the title again and creates duplicated release text.
- This phase does not replace the earlier lexical `claim_grounding_alignment` gate.
- Instead, the two gates now cover different failure classes:
  - lexical alignment catches topic drift,
  - structured consistency catches `same topic, wrong number/year`.

#### Phase-9 polarity contradiction hardening landed on top of the structured slice

- `src/learning/answerReleaseReview.ts` now adds a third contradiction-oriented reviewer gate: `claim_polarity_consistency`.
- This gate is also intentionally narrow:
  - it does not try to infer general semantic opposition,
  - it only compares answer/support sentences whose feature overlap is high enough to suggest the same claim skeleton.
- The first supported contradiction family is explicit positive/negative reversal:
  - English forms such as `is not`, `do not`, `cannot`, plus normalized contractions,
  - narrow Chinese forms such as `不是`, `并非`, `没有`, `不能`, `无法`.
- The gate is deliberately conservative for false-positive control:
  - if there is no comparable support sentence, it does nothing,
  - if support contains a comparable sentence with the same polarity, it does not raise a conflict,
  - unrelated negative wording in support is not enough to trigger revision.
- `src/learning/answerReleaseReview.test.ts` now pins three important behaviors:
  - English polarity reversal forces `revise`,
  - Chinese polarity reversal forces `revise`,
  - unrelated negative support wording still `release`s cleanly.
- This phase does not replace the earlier lexical or structured-fact gates.
- The reviewer now covers three distinct contradiction classes:
  - lexical alignment catches topic drift,
  - structured consistency catches `same topic, wrong number/year`,
  - polarity consistency catches `same topic, same entity, but the claim was said backwards`.

#### Phase-10 DAG-order contradiction hardening landed on top of the polarity slice

- `src/learning/answerReleaseReview.ts` now adds a fourth contradiction-oriented reviewer gate: `claim_graph_order_consistency`.
- This gate is intentionally narrower than a generic semantic verifier:
  - it consumes only the project's existing DAG evidence already assembled into `graphContext`,
  - the first supported directional relations are `prerequisite` and `sequence`.
- The gate reads from the structured graph surfaces that already exist in the current architecture:
  - `connectionPaths`,
  - `knowledgePointRelations`,
  - `predecessorWindow`,
  - `successorWindow`.
- It remains conservative:
  - if the draft does not make an explicit order claim, it does nothing,
  - if the DAG evidence does not expose a high-confidence directional relation, it does nothing.
- When the draft reverses grounded order, the reviewer now revises with a deterministic corrective sentence instead of falling back to a generic summary.
- `src/learning/answerReleaseReview.test.ts` now pins three important behaviors:
  - prerequisite reversal forces `revise`,
  - correct prerequisite direction still `release`s cleanly,
  - sequence reversal forces `revise`.
- This phase closes part of the earlier DAG-underuse criticism:
  - the existing DAG is no longer only answer-planning context,
  - it is now also a release-time contradiction boundary.
- This phase does not solve the right-pane source/highlight issue by itself:
  - the click/render path already exists in `workspace_panes.js`,
  - the unresolved gap is payload-contract stability for source paths and matched spans.

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

1. Use the new explicit alias/scope regression corpus to add deeper contradiction checks beyond the current lexical + structured-fact + polarity + graph-order gates, but only where the new checks can stay deterministic enough to avoid false-positive churn.
2. Keep expanding the corpus with real cross-scope, compact-alias, and synonym failures before widening reviewer policy again.
3. Treat the right-pane source/highlight issue as a separate payload-contract problem instead of misclassifying it as missing frontend click wiring.
4. Keep compare-ready drilldowns on the existing reviewer telemetry path and resist creating a second audit owner for richer operator slices.
5. Continue owner reduction in `KnowledgeLearningPlatform.ts` and `agent_workspace.js` only where the new module owns real invariants.

### Five-Point Summary

1. The missing mechanism was not graph retrieval; it was final public-answer release review.
2. The correct owner is a local deterministic reviewer layer, not a new prompt framework.
3. The current project DAG remains the evidence substrate and now also participates in release-time order correction; the reviewer still does not replace graph assembly.
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
| grounded draft 还必须检查确定性的结构化事实冲突 | reviewer 现在会执行 `claim_structured_consistency`：即使 topical lexical overlap 仍然通过，只要数值或年份事实与支撑冲突，也会触发 revise。 | 已实现基线 |
| grounded draft 还必须检查显式正反断言反转 | reviewer 现在会执行 `claim_polarity_consistency`：即使 topical lexical overlap 仍然通过，只要把 `is` / `不是` 这类断言方向明确说反，也会触发 revise。 | 已实现基线 |
| grounded draft 还必须检查与 DAG 相矛盾的顺序断言 | reviewer 现在会执行 `claim_graph_order_consistency`：只要把已装配 DAG 的 `prerequisite` 或 `sequence` 方向说反，就会触发 revise。 | 已实现基线 |
| 最终审核结果必须可供开发者检查 | `answerReleaseReview` 已加到 `AgentConversationResponse`、`AgentConversationTrace`、`KnowledgeRun`。 | 已实现 |
| 运维表面必须能看到 reviewer 状态且不扩大主回答区 | `src/frontend/agent_workspace.js` 会净化 `answerReleaseReview`，`src/frontend/workspace_panes.js` 会在 `knowledge_run` 卡片中渲染 release-review 明细 / 历史。 | 已实现 |
| reviewer 遥测必须能跨 export/replay 表面保留 | `src/export/WorkspaceExportBundle.ts` 现在会在 `runtime.knowledgeRunReports[*].answerReleaseReview` 中输出紧凑 reviewer 摘要，供离线回放与运维审计使用。 | 已实现 |
| 更长周期的运维审计必须复用同一条 reviewer 遥测路径 | `WorkspaceExportBundle.ts` 现在会派生 `runtime.knowledgeRunAnswerReleaseAuditSummary`，历史卡片也会基于返回的 knowledge run 渲染同一份多 run audit 形态。 | 已实现基线 |
| 趋势窗口与门禁老化也必须继续复用同一条 reviewer 遥测路径 | `runtime.knowledgeRunAnswerReleaseAuditSummary` 现在会进一步派生 `reviewTrend` 与 `failedGateAging`，历史卡片也会渲染这两类摘要，而不是再发明第二个审计 owner。 | 已实现基线 |
| compare-ready operator drilldown 也必须继续复用同一条 reviewer 遥测路径 | `WorkspaceExportBundle.ts`、`agent_workspace.js` 与 `workspace_panes.js` 现在会从同一条 additive reviewer telemetry 派生近期/前序指标差值、gate 差值、最近审核对 delta，以及 compare 卡片里的 answer-release 对比。 | 已实现基线 |
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

#### 在 export 切片之上继续落地的 Phase-4 聚合审计加固

- `WorkspaceExportBundle.ts` 现在会基于已构建的 `knowledgeRunReports` 派生 `runtime.knowledgeRunAnswerReleaseAuditSummary`，而不是再引入第二个 reviewer telemetry owner。
- 这份聚合摘要覆盖：
  - reviewed / unreviewed run 计数，
  - decision bucket（`release` / `revise` / `abstain` / `other`），
  - revised run 数量，
  - failed gate run 数量，
  - internal leakage run 数量，
  - leaked fragment 总数，
  - 确定性 failed-gate 频次摘要，
  - 最新 reviewed 时间戳。
- `src/frontend/agent_workspace.js` 现在会先基于返回的 knowledge-run history 计算同一份聚合 release audit，再裁剪可见 run 列表，因此历史卡片看到的是完整审计窗口，而不是仅对首批渲染项做统计。
- `src/frontend/workspace_panes.js` 现在会在 `knowledge_run` 历史卡片中渲染一个仅面向运维的 `Release audit` 区块，同时保持主回答区不变。
- `src/export/WorkspaceExportBundle.test.ts` 与 `src/agent_workspace.frontend.test.ts` 现在都覆盖了聚合导出与历史卡片渲染路径。

#### 在聚合审计切片之上继续落地的 Phase-5 趋势 / 老化加固

- `runtime.knowledgeRunAnswerReleaseAuditSummary` 现在还会派生：
  - `reviewTrend`：对最近已审运行做确定性的双窗口趋势视图，
  - `failedGateAging`：按 gate 汇总失败次数、最近失败时间，以及距离最新一次失败已经过去多少个已审运行。
- 这版趋势基线刻意保持窄口径：
  - 还不急着给出 model-owned 的 improving/regressing 判词，
  - 先把确定性的 reviewed-run 窗口做实，
  - 先把后续 compare-ready operator drilldown 所依赖的稳定审计窗口做实，而不是额外发明一条并行 telemetry。
- `src/frontend/workspace_panes.js` 现在会在 operator-only 的 knowledge-run history 卡片中继续渲染 `Review trend` 与 `Gate aging` 两个区块。
- `src/export/WorkspaceExportBundle.test.ts`、`src/agent_workspace.frontend.test.ts` 与 `src/agent_workspace.locale.contract.test.ts` 现在都对这条新契约做了约束。

#### 在趋势切片之上继续落地的 Phase-6 compare-ready drilldown 加固

- `runtime.knowledgeRunAnswerReleaseAuditSummary` 现在进一步携带确定性的 `comparison` 区块，运维侧不需要再从孤立计数里手工推断 reviewer 漂移。
- 这个 comparison 区块继续坚持 telemetry-first：
  - `metricShifts` 负责给出最近/前序 reviewed window 的审核指标差值，
  - `gateShifts` 负责给出同一审计窗口内按 gate 的变化，
  - `latestPair` 负责给出最新两次审核的 delta，同时不把原始 original/public answer 文本重复塞进审计摘要。
- `src/frontend/agent_workspace.js` 现在会在裁剪可见 knowledge-run 之前，先基于返回历史派生同一份 compare-ready 审计形态，保证前端运维视图与 export 路径一致。
- `src/frontend/workspace_panes.js` 现在会补出：
  - `Review comparison`
  - `Latest pair`
  - `Gate shifts`
  - 以及 knowledge-run compare 卡片中的 answer-release delta。
- 这样做的结果是：主回答区继续收缩，但运维侧终于有了成对观察 reviewer 漂移的表面。
- `src/export/WorkspaceExportBundle.test.ts` 与 `src/agent_workspace.frontend.test.ts` 现在同时约束 export 与前端 history/compare surface 上的 additive comparison contract。

#### 在 compare 切片之上继续落地的 Phase-7 共享回归语料与 planner-scope-recovery 加固

- `src/learning/KnowledgeWorkspaceConversationRegression.ts` 现在已经定义了一份共享的确定性 alias/scope 会话回归语料。
- 第一批语料覆盖 4 个用例：
  - `waterglass_explicit_scope_compact_zh`
  - `waterglass_explicit_scope_spaced_zh`
  - `financial_scope_recovery_spaced_en`
  - `financial_scope_recovery_compact_en`
- 截图派生的 `waterglass_explicit_scope_compact_zh` 现在已经成为 `1781782257390.jpg` 的 durable 验收 owner，而不再只是一次性手工复现。
- `src/learning/KnowledgeWorkspaceConversationRegression.test.ts` 现在会以内存态运行同一批语料，并故意注入带噪声的 `financial` 文档（`liquidity`、`glass steagall act`、`watered stock`），让恢复逻辑必须击败真实 scope 内干扰项。
- `scripts/verify-knowledge-workspace-runtime.js` 现在在没有 ad hoc `--query` 时默认加载构建后的共享语料，同时保留向后兼容的 `--target` / `--query` 路径，并支持只跑指定 `--case`。
- 这批语料还暴露了 `KnowledgeLearningPlatform.ts` 中第二个真实缺陷：planner scope recovery 过去只会在 rerank 后 0 结果时触发。
- 这个规则太弱，因为 scoped retrieval 完全可能返回“非空但仍然错误”的噪声结果。
- `KnowledgeLearningPlatform.ts` 现在会通过 `shouldApplyPlannerScopeRecovery(...)` 做判断：只要 rerank 后仍有结果但没有任何一个属于 planner title-hit 文档，也会触发恢复。
- 这是正确的不变量 owner，因为 recovery 决策属于 retrieval-contract 语义，而不是 prompt 文案、前端展示或 release-review 启发式规则。
- 这样一来，即使 `financial` scope 内的局部噪声仍然幸存，跨 scope 的 title recovery 也能成立，而公开回答仍继续受后续确定性 release-review 层治理。

#### 在共享语料切片之上继续落地的 Phase-8 结构化矛盾加固

- `src/learning/answerReleaseReview.ts` 现在新增了第二个面向矛盾检测的 reviewer gate：`claim_structured_consistency`。
- 这个 gate 刻意不去假装自己是一个泛化 verifier model：
  - 它不会试图推断任意语义真值；
  - 它只在存在高置信度可比结构化事实时才下判断。
- 当前支持的第一批矛盾类型刻意保持窄口径：
  - 带显式技术单位的数值事实，例如 `%`、`kg/m3`、`GPa`、`kPa` 等稳定单位；
  - 只有在局部上下文看起来确实像日期/年份时，才会纳入 year claim。
- 这个 gate 的保守性是刻意设计出来的：
  - 如果草稿里没有结构化事实，它什么也不做；
  - 如果 grounded support 里没有可比的结构化事实，它什么也不做；
  - 如果 support 里有多个可比值，而其中一个值与草稿一致，它不会误报矛盾。
- 这是正确偏置。一个会凭空制造“矛盾”的 release gate，比一个只抓最高置信度冲突的窄 gate 更糟。
- `src/learning/answerReleaseReview.test.ts` 现在已经固定了三类关键行为：
  - 数值冲突必须 `revise`；
  - 年份冲突必须 `revise`；
  - 支撑里存在多个值且其中一个就是正确值时，必须仍然 clean `release`。
- 在落这一步时，revision builder 也顺手做了一个文本质量修正：
  - 如果 support sentence 本身已经以 article + title phrase 开头，reviewer 不会再重复加一层标题前缀，避免生成重复的公开回答文本。
- 这个 Phase 并不替代之前的词法 `claim_grounding_alignment` gate。
- 两个 gate 现在分工更明确：
  - lexical alignment 负责抓 topic drift，
  - structured consistency 负责抓“主题没偏，但数字/年份错了”。

#### 在结构化矛盾切片之上继续落地的 Phase-9 正反断言矛盾加固

- `src/learning/answerReleaseReview.ts` 现在新增了第三个面向矛盾检测的 reviewer gate：`claim_polarity_consistency`。
- 这个 gate 同样刻意保持窄口径：
  - 它不会试图推断泛化语义对立；
  - 它只比较 feature overlap 足够高、可视为“同一断言骨架”的 answer/support sentence。
- 当前支持的第一批矛盾类型是显式正反断言反转：
  - 英文形式，例如 `is not`、`do not`、`cannot`，以及归一化后的缩写形式；
  - 中文形式，例如 `不是`、`并非`、`没有`、`不能`、`无法`。
- 这个 gate 的保守性同样是刻意设计出来的：
  - 如果没有可比 support sentence，它什么也不做；
  - 如果存在 polarity 一致的可比 support sentence，它不会报冲突；
  - support 里出现无关否定句，本身不足以触发 revise。
- `src/learning/answerReleaseReview.test.ts` 现在已经固定了三类关键行为：
  - 英文 polarity reversal 必须 `revise`；
  - 中文 polarity reversal 必须 `revise`；
  - 无关否定 support 仍然要 clean `release`。
- 这个 Phase 也不替代之前的 lexical 或 structured-fact gate。
- reviewer 现在覆盖三类互补的矛盾：
  - lexical alignment 负责抓 topic drift，
  - structured consistency 负责抓“主题没偏，但数字/年份错了”，
  - polarity consistency 负责抓“主题没偏、实体没偏，但断言方向说反了”。

#### 在正反断言矛盾切片之上继续落地的 Phase-10 DAG 顺序矛盾加固

- `src/learning/answerReleaseReview.ts` 现在新增了第四个面向矛盾检测的 reviewer gate：`claim_graph_order_consistency`。
- 这个 gate 比泛化语义 verifier 更窄口径：
  - 它只消费当前架构已经装配好的项目 DAG 证据，
  - 第一批支持的方向关系只覆盖 `prerequisite` 与 `sequence`。
- 它直接读取当前已有的结构化图表面：
  - `connectionPaths`
  - `knowledgePointRelations`
  - `predecessorWindow`
  - `successorWindow`
- 它仍然保持保守：
  - 如果草稿没有显式顺序断言，它什么也不做；
  - 如果 DAG 证据没有暴露高置信度方向关系，它什么也不做。
- 一旦草稿把 grounded 顺序说反，reviewer 现在会输出确定性的纠正句，而不是退回泛化摘要。
- `src/learning/answerReleaseReview.test.ts` 现在已经固定三类关键行为：
  - 前置关系反转必须 `revise`
  - 前置关系方向正确时仍然 clean `release`
  - sequence 反转必须 `revise`
- 这个 Phase 关闭了此前“项目 DAG 利用不足”的一部分批评：
  - 现有 DAG 不再只是 answer-planning context，
  - 现在也成为 release-time contradiction boundary。
- 这个 Phase 本身并不解决右侧原文 / 高亮问题：
  - `workspace_panes.js` 中的点击 / 渲染路径本来就存在，
  - 当前剩余缺口是 source path 与 matched span 的 payload 契约稳定性。

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

1. 先基于这份显式 alias/scope 回归语料，把当前 lexical + structured-fact + polarity + graph-order gate 之外的更深矛盾检测落地，但前提仍然是控制好 false positive，不把 reviewer 变成不稳定猜测器。
2. 继续把语料从当前 4 个用例扩展到更多真实 cross-scope、compact-alias 与同义表达失败案例，再决定是否继续扩大 reviewer policy。
3. 把右侧原文 / 高亮问题收敛为独立 payload 契约工作，而不是继续误判成前端点击事件缺失。
4. compare-ready drilldown 继续坚持复用现有 reviewer telemetry path，不再平行新增第二个 audit owner。
5. 继续缩减 `KnowledgeLearningPlatform.ts` 与 `agent_workspace.js` 的 owner 压力，但前提仍然是“新模块拥有真实不变量”。

### 五点总结

1. 真正缺失的不是图检索，而是最终公开回答的 release review。
2. 正确 owner 是本地确定性 reviewer layer，不是再引入一层 prompt framework。
3. 项目现有 DAG 继续作为证据底座，并且已经开始参与 release-time 的顺序纠错；reviewer 不会替代 graph assembly。
4. `waterglass` 截图已经被编码进正式运行时验收门禁。
5. 本轮落地保持向前兼容，同时实质提升了 agent 最终回复的鲁棒性。
