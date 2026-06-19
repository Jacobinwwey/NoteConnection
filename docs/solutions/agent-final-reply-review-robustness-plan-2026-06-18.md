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

### 2026-06-19 Delta

- Re-audit confirms the original missing-owner problem is already closed in code. The live work now hardens two narrower boundaries rather than reopening framework debates.
- `src/learning/answerReleaseReview.ts` now adds `claim_state_consistency`, a deterministic same-subject state gate for definition/copula contradictions such as `open system` vs `closed system`.
- `src/learning/answerReleaseReview.ts` now also adds `query_intent_alignment`, so definition-style queries revise meta-documentary drafts such as `本技术文档旨在...` into direct grounded definitions before release.
- `src/learning/answerReleaseReview.ts` now also adds `claim_containment_consistency`, so grounded drafts that keep the same explicit containment relation but swap the contained material, such as `Water glass contains water` to `Water glass contains oil`, are revised before release.
- `src/learning/answerReleaseReview.ts` now also adds `claim_composition_consistency`, so grounded drafts that keep the same explicit `composed of` / `由...组成` relation but swap the supported components, such as `water and a glass cup` to `oil and a plastic cup`, are revised before release.
- `src/learning/answerReleaseReview.ts` now also adds `claim_purpose_consistency`, so grounded drafts that keep the same explicit `used for` / `用于` relation but swap the supported use, such as `drinking water` to `storing motor oil`, are revised before release.
- `src/learning/answerReleaseReview.ts` now also adds `claim_subject_consistency`, so drafts that preserve a supported fact tail but swap the grounded subject, such as `Water density` to `Glass density`, are revised before release.
- `src/learning/answerReleaseReview.ts` now also adds `claim_structured_comparison_consistency`, so grounded drafts that explicitly invert supported same-property comparisons such as `Water density is higher than glass density` are revised before release with deterministic correction sentences instead of slipping through on topical overlap.
- `src/learning/answerReleaseReview.ts` now also adds `claim_attribute_consistency`, so grounded drafts that keep the same subject and explicit `has` / `具有` attribute frame but swap the supported attribute, such as `moderate thermal insulation` to `high thermal insulation`, are revised before release.
- `src/learning/answerReleaseReview.ts` now also adds `claim_graph_causal_consistency`, so grounded drafts that reverse DAG-backed cause/effect direction, such as `Pressure Rise causes Thermal Expansion`, are revised before release with deterministic English/Chinese correction sentences.
- `src/learning/answerReleaseReview.ts` now also adds `claim_graph_order_consistency`, so grounded drafts that reverse DAG-backed `prerequisite` or `sequence` direction are revised before release with deterministic correction sentences.
- `src/learning/answerReleaseReview.ts` now also adds `claim_graph_comparison_consistency`, so grounded drafts that misstate DAG-backed `contrast` / `analogy` pairs, such as releasing `is similar to` when the graph only supports `contrast`, are revised before release.
- `src/learning/answerReleaseReview.ts` now also adds `claim_temporal_validity_consistency`, so DAG temporal warnings now participate in final public-answer release: when `graphContext.temporalValidity.allPointsValid === false`, unqualified current-tense drafts are revised, explicitly time-qualified drafts may still release, and supersedes-only lineage does not become a false-positive blocker by itself.
- `src/learning/answerReleaseReview.ts` now also adds `claim_dependency_consistency`, so grounded drafts that keep the same explicit `depends on` / `requires` / `依赖` / `前置条件` relation but swap the supported dependency, such as `Baseline Measurement and Sensor Calibration` to `Final Reporting`, are revised before release.
- `src/frontend/markdown_runtime.js` now exposes block-level source-line provenance for rendered markdown, and `src/frontend/workspace_panes.js` now prefers `source_line_provenance` before `line_window` / `snippet_fallback`.
- The right pane now also projects the matched evidence fragment into inline highlight markup inside the selected rendered node instead of only tinting the larger paragraph/container.
- `src/frontend/workspace_panes.js` now also prefers source-authenticated fragment projection inside an already-authenticated rendered block, so single-line paragraphs and nested inline nodes no longer over-highlight the entire line when the matched snippet is narrower.
- Shared alias/scope regressions now separate corpus-stable public-answer invariants from screenshot-specific runtime behavior: synthetic corpora may legitimately `release` or `revise`, while the real `waterglass_explicit_scope_compact_zh` runtime case still requires `revise` with `query_intent_alignment`.
- Runtime verification now has an explicit build-freshness constraint: a first verifier run against stale `dist` output hid the newly added gate inventory, while the same verifier after `npm run build:mini` showed the correct reviewer surface. The bug was stale compiled output, not missing source wiring.
- Re-audit of the cloned reference libraries under `ref/` (`dspy`, `guidance`, `semantic-kernel`, `langchain`, `litellm`) confirms they remain design references rather than release-policy owners: DSPy is strongest as a program/eval/optimizer harness, Guidance as constrained generation and output control, Semantic Kernel and LangChain as orchestration surfaces, and LiteLLM as a provider gateway, but none of them substitutes for local DAG-backed final-answer verification in this TypeScript runtime.
- The remaining provenance gap is no longer “the right pane can only tint whole blocks.” It is narrower: identical repeated fragments inside the same authenticated block still need explicit span offsets or richer markdown AST provenance to be perfectly disambiguated.

### First Principles

#### Term Definitions

- **Draft answer**: the first user-facing sentence produced by answer synthesis before release gating.
- **Public answer**: the final sentence exposed in the main answer area.
- **Answer release review**: a post-synthesis, pre-release decision layer that can `release`, `revise`, or `abstain`.
- **Revision**: contract-preserving rewrite of a grounded draft into a narrower public answer.
- **Abstention**: a concise refusal to over-claim when evidence is insufficient.
- **Evidence sufficiency**: the minimum grounded support required to let the system answer instead of abstain.
- **Dependency claim**: an explicit relation where the subject depends on, requires, or names a prerequisite.
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
   - query intent alignment,
   - grounding alignment,
   - evidence sufficiency,
   - graph support sufficiency,
   - structured consistency,
   - structured comparison consistency,
   - attribute consistency,
   - containment consistency,
   - composition consistency,
   - purpose consistency,
   - dependency consistency,
   - public-surface contraction,
   - internal diagnostic leakage,
   - subject consistency,
   - state consistency,
   - polarity consistency,
   - graph-causal consistency,
   - graph-order consistency,
   - graph-comparison consistency,
   - temporal-validity consistency,
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

### Reference-Library Reconciliation

The earlier framework recommendations mixed four different problem classes:

1. query rewriting,
2. structured generation,
3. agent orchestration/provider routing,
4. release-time correctness verification.

The screenshot failure was primarily in class 4, with a smaller class-1 retrieval normalization issue upstream. That distinction matters because otherwise the solution keeps drifting toward the wrong owner.

| Reference clone under `ref/` | What it actually optimizes | Best use in this project | Why it is the wrong owner for the current gap |
|---|---|---|---|
| `ref/dspy` | typed LM programs, compile/optimizer loops, and evaluation harnesses | optional offline tuning harness for draft-generation prompts, scorer prompts, or regression scoring | DSPy does not own the local DAG, the TypeScript runtime contracts, or the final release decision; moving release policy into DSPy would make correctness model-dependent |
| `ref/guidance` | constrained generation, regex/CFG-style control, and structured output contracts | optional intermediate JSON extraction or shadow-audit output control | it helps shape model output, but the screenshot regression happened after generation constraints would already have been bypassed by an unreviewed public answer |
| `ref/semantic-kernel` | orchestration, plugin boundaries, and agent-process flows | optional reference for plugin boundaries or process orchestration | the repo now explicitly points toward Microsoft Agent Framework; pulling that stack into a local Node/TypeScript DAG runtime would duplicate ownership rather than close the release-review boundary |
| `ref/langchain` | application orchestration plus observability/evaluation surfaces | optional experimentation harness or external evaluation surface | LangChain is strong at composition and tooling, not at being the source of truth for local graph-conditioned answer invariants; using it as release owner would just relocate the ambiguity |
| `ref/litellm` | provider unification, proxy/gateway routing, and model-routing control | optional upstream model-routing layer if multi-provider control becomes a product requirement | LiteLLM normalizes provider APIs and routing, but it does not verify whether the final answer contradicts the project DAG or leaks runtime diagnostics |

Best-practice conclusion:

- keep the deterministic TypeScript reviewer as the source of truth for release policy,
- keep the project DAG as the structured evidence owner,
- use LLM frameworks only for optional upstream generation experiments or shadow audits,
- never let a prompt/orchestration framework become the only owner of final public-answer correctness.

### Code-vs-Requirement Reconciliation

| Requirement | Current implementation | Progress call |
|---|---|---|
| Public answer must not leak backend diagnostics | New `src/learning/answerReleaseReview.ts` detects and blocks diagnostic leakage before release. | Implemented |
| Empty-result answers must abstain cleanly instead of exposing runtime detail | Reviewer now downgrades unsupported drafts into concise abstentions. | Implemented |
| Grounded drafts must stay aligned with their cited/knowledge-point support | Reviewer now enforces `claim_grounding_alignment` and revises drafts when lexical evidence overlap shows claim drift. | Implemented |
| Grounded drafts must also be checked for deterministic structured fact conflicts | Reviewer now enforces `claim_structured_consistency`, revising grounded drafts when numeric or year facts conflict with support even though topical lexical overlap still passes. | Implemented baseline |
| Grounded drafts must also be checked for explicit structured comparison inversions | Reviewer now enforces `claim_structured_comparison_consistency`, revising explicit `higher/lower`, `greater/less`, `高于/低于` comparison claims when same-property, same-unit support facts prove the opposite ordering. | Implemented baseline |
| Grounded drafts must also be checked for explicit containment/content contradictions | Reviewer now enforces `claim_containment_consistency`, revising grounded drafts when the same grounded subject keeps the same explicit containment relation but swaps the supported contained material in English or Chinese. | Implemented baseline |
| Grounded drafts must also be checked for explicit composition contradictions | Reviewer now enforces `claim_composition_consistency`, revising grounded drafts when the same grounded subject keeps the same explicit `composed of` / `由...组成` relation but swaps the supported components while still allowing compatible order/refinement. | Implemented baseline |
| Grounded drafts must also be checked for explicit purpose/use contradictions | Reviewer now enforces `claim_purpose_consistency`, revising grounded drafts when the same grounded subject keeps the same explicit `used for` / `用于` relation but swaps the supported use while still allowing supported-purpose refinements. | Implemented baseline |
| Grounded drafts must also be checked for explicit dependency/prerequisite contradictions | Reviewer now enforces `claim_dependency_consistency`, revising grounded drafts when the same grounded subject keeps the same explicit `depends on` / `requires` / `依赖` / `前置条件` relation but swaps the supported dependency while still allowing genuinely supported dependency answers. | Implemented baseline |
| Grounded drafts must also be checked for grounded-subject drift even when the supported fact tail still matches | Reviewer now enforces `claim_subject_consistency`, revising drafts that keep the supported fact tail but swap the subject/entity from the grounded support. | Implemented baseline |
| Grounded drafts must also be checked for same-subject explicit attribute drift | Reviewer now enforces `claim_attribute_consistency`, revising grounded drafts when the same subject keeps an explicit `has` / `具有` frame but swaps the supported attribute value. | Implemented baseline |
| Grounded drafts must also be checked for same-subject state contradictions | Reviewer now enforces `claim_state_consistency`, revising grounded drafts when comparable definition/copula state claims conflict with grounded support in English or Chinese. | Implemented baseline |
| Grounded drafts must also be checked for explicit polarity reversals | Reviewer now enforces `claim_polarity_consistency`, revising grounded drafts when they say `is not` / `不是` against support that still affirms the same claim skeleton. | Implemented baseline |
| Grounded drafts must also be checked for reversed DAG causal claims | Reviewer now enforces `claim_graph_causal_consistency`, revising drafts that invert grounded `causal` direction from the assembled DAG. | Implemented baseline |
| Grounded drafts must also be checked for reversed DAG order claims | Reviewer now enforces `claim_graph_order_consistency`, revising drafts that invert grounded `prerequisite` or `sequence` direction from the assembled DAG. | Implemented baseline |
| Grounded drafts must also be checked for DAG-backed comparison-branch contradictions | Reviewer now enforces `claim_graph_comparison_consistency`, revising drafts that state `contrast` pairs as `analogy` or `analogy` pairs as `contrast` when the assembled DAG supports only one comparison family for that title pair. | Implemented baseline |
| Grounded drafts must also be checked for DAG temporal-validity contradictions | Reviewer now enforces `claim_temporal_validity_consistency`, revising current-tense releases when `graphContext.temporalValidity.allPointsValid === false`, while allowing explicit time qualification and avoiding supersedes-only false positives. | Implemented baseline |
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
- The corpus contract is now intentionally split by invariant strength:
  - shared Jest fixtures accept either `release` or `revise` when the final public answer is already contracted and grounded,
  - runtime verification for the real screenshot-derived note still requires `revise` plus failed gate `query_intent_alignment`.
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

#### Phase-11 graph-focus payload-contract hardening landed on top of the DAG-order slice

- `src/frontend/workspace_panes.js` now treats citation-backed evidence fields as first-class fallback inputs for graph focus rather than trusting only raw `item.sourcePath` / `span.sourcePath`.
- `normalizeMatchedSpans()` now backfills:
  - `title`,
  - `snippet`,
  - `sourcePath`,
  - `startLine`,
  - `endLine`
  from `span.citation` whenever the raw span fields are incomplete.
- `buildKnowledgePointFocusPayload()` now derives additive `candidateSourcePaths` and normalized matched spans before opening the right pane.
- `resolveKnowledgePointSourcePath()` now scans top-level source path, top-level citation, citation list, span paths, and span-citation paths instead of stopping at the first raw path.
- `resolveGraphFocusCandidatePaths()` now consumes the additive candidate list, so preview resolution stays stable even when grouped knowledge hits lack a canonical top-level path.
- `src/agent_workspace.frontend.test.ts` now pins two concrete failure modes:
  - citation-backed snippets still highlight after markdown render,
  - citation-backed paths still open source content when the top-level hit path is missing.
- This phase does not change the answer-release reviewer.
- It closes a separate but necessary boundary: evidence usability for operators/developers after the public answer has already been contracted.

#### Phase-12 graph-focus highlight precision landed on top of payload hardening

- `src/frontend/workspace_panes.js` now builds a `line_window` anchor from `startLine` / `endLine` when source-markdown lines and snippet text agree closely enough to trust the line metadata.
- That trust is deliberately conditional:
  - if the line window is absent, it does nothing,
  - if the line window overlaps weakly with the snippet, it is treated as stale and not allowed to force the highlight.
- Candidate rendered nodes are now scored with:
  - normalized `line_window` text when available,
  - `snippet_fallback` text otherwise,
  - specificity bonuses so the narrow paragraph wins over a generic container,
  - penalties for container-wide matches that would over-highlight too much content.
- The chosen path now stays inspectable through additive `highlightStrategy` diagnostics: `line_window`, `snippet_fallback`, or `none`.
- `src/agent_workspace.frontend.test.ts` now pins two higher-value failures:
  - repeated snippet text must resolve to the correct paragraph when the line window is trustworthy,
  - unusable line metadata must fall back to snippet highlighting instead of highlighting the wrong paragraph.
- This phase still does not move release policy into the frontend. It closes a different invariant: evidence-preview precision after the answer has already been contracted.

#### Phase-13 same-subject state contradiction hardening landed on top of the graph-order slice

- `src/learning/answerReleaseReview.ts` now adds a fifth contradiction-oriented reviewer gate: `claim_state_consistency`.
- This gate is intentionally narrower than a generic semantic verifier:
  - it only compares definition/copula-style state frames that look like the same subject,
  - it skips numeric facts and DAG-order language that are already owned by `claim_structured_consistency` and `claim_graph_order_consistency`.
- The first supported contradiction family is same-subject state reversal:
  - English shapes such as `X is an open system` vs `X is a closed system`,
  - Chinese shapes such as `X 是开放系统` vs `X 是封闭系统`.
- The gate stays conservative for false-positive control:
  - if the draft exposes no comparable state frame, it does nothing,
  - if support exposes no comparable state frame, it does nothing,
  - if subject overlap is weak or the value tails still materially overlap, it does not force revision.
- `src/learning/answerReleaseReview.test.ts` now pins three important behaviors:
  - English same-subject state conflict forces `revise`,
  - Chinese same-subject state conflict forces `revise`,
  - compatible refinement of the same state still `release`s cleanly.
- This phase does not replace lexical, structured, polarity, or DAG-order gates.
- It closes a narrower gap: `same topic, same subject, but the answer asserts the wrong state`.

#### Phase-14 block-level markdown provenance landed on top of graph-focus highlight precision

- `src/frontend/markdown_runtime.js` now extracts markdown source blocks and annotates rendered nodes with:
  - `data-agent-markdown-source-start-line`,
  - `data-agent-markdown-source-end-line`,
  - `data-agent-markdown-source-kind`.
- `renderMarkdownInto(...)` now returns additive provenance diagnostics so callers can inspect:
  - `sourceBlockCount`,
  - `attributedNodeCount`.
- `src/frontend/workspace_panes.js` now consumes that metadata before text heuristics:
  - `resolveGraphFocusRenderedSourceRange(...)` reads rendered-node source ranges,
  - `source_line_provenance` wins when those ranges overlap trusted evidence spans,
  - `line_window` and `snippet_fallback` remain the bounded fallback path.
- `src/agent_workspace.frontend.test.ts` now pins the repeated-paragraph case where two rendered paragraphs have identical text but only one matches the trusted source-line span.
- This phase narrows the earlier provenance criticism:
  - the right pane no longer depends only on payload snippets,
  - but the mapping is still block-level rather than exact-span / nested-span precise.

#### Phase-15 source-authenticated fragment projection landed on top of block-level provenance

- `src/frontend/workspace_panes.js` now treats inline highlight as a second-stage problem after node selection instead of reusing the same broad heuristic.
- Once a rendered block has already been selected through `source_line_provenance` or `line_window`, inline highlighting now prefers snippet-sized source-authenticated fragment projection before falling back to the older broad text search.
- The new additive diagnostic field `inlineHighlightStrategy` now distinguishes:
  - `source_fragment_provenance`
  - `text_search`
  - `none`
- This closes a concrete operator-facing failure mode from the prior slice:
  - a single-line paragraph no longer gets wrapped as one giant highlight when the matched snippet is only part of the line,
  - nested inline markdown such as `<strong>` content no longer forces the whole surrounding sentence to be highlighted just because the line window spans the sentence.
- `src/agent_workspace.frontend.test.ts` now pins two new regressions:
  - single-line paragraph highlights must collapse to the matched fragment instead of the whole line,
  - nested inline markdown nodes must still resolve to a single exact fragment highlight.
- This phase still does not fully solve identical repeated-fragment disambiguation inside one authenticated block with the same line window and the same snippet text. That remaining gap requires stronger payload offsets or richer AST provenance, not another ranking tweak.

#### Phase-16 grounded-subject contradiction hardening landed on top of the provenance/reviewer baseline

- `src/learning/answerReleaseReview.ts` now adds a sixth contradiction-oriented reviewer gate: `claim_subject_consistency`.
- This gate closes a specific hole left by the earlier stack:
  - lexical overlap can still stay high,
  - structured facts can still match,
  - polarity can still match,
  - yet the answer can silently swap the grounded subject/entity.
- The gate is intentionally narrower than a generic verifier:
  - it only evaluates comparable subject-tail frames,
  - it only triggers when the support tail materially overlaps but the grounded subject materially differs.
- The first supported contradiction family is grounded subject drift with stable fact tails:
  - English shapes such as `Water density is 999.8 kg/m3` vs `Glass density is 999.8 kg/m3`,
  - Chinese shapes such as `水的密度是...` vs `玻璃的密度是...`.
- The conservative bias remains deliberate:
  - if the draft exposes no extractable subject-tail frame, it does nothing,
  - if grounded support exposes no comparable frame, it does nothing,
  - if the subject is only a minor article/word-order variant of the same entity, it does not force revision.
- `src/learning/answerReleaseReview.test.ts` now pins the two critical boundaries:
  - grounded subject swap with the same fact tail must `revise`,
  - equivalent same-entity phrasing such as `Water glass` vs `A water glass` must still `release`.
- This phase does not replace the earlier contradiction owners.
- It closes a narrower but real remaining gap: `same fact tail, wrong grounded subject`.

#### Phase-17 containment contradiction hardening landed on top of the grounded-subject slice

- `src/learning/answerReleaseReview.ts` now adds a seventh contradiction-oriented reviewer gate: `claim_containment_consistency`.
- This gate closes a narrower but real hole left by the current stack:
  - the draft can keep the same grounded subject,
  - keep the same explicit containment/content relation,
  - yet still swap the contained material.
- The first supported contradiction family intentionally stays narrow and deterministic:
  - English: `contains`, `is/are/was/were filled with`
  - Chinese: `装有`, `盛有`, `含有`, `包含`
- The normalization bias is intentional:
  - trailing environment clauses such as `during the example setup` or `在示例过程中` are stripped before object comparison,
  - compatible refinements such as `water` -> `cold water` still cleanly `release`,
  - non-comparable containment wording does not trigger revision.
- This is the correct bias. A containment gate that invents contradictions from weak overlap would degrade trust faster than a narrow gate that only catches high-confidence swaps.
- `src/learning/answerReleaseReview.test.ts` now pins three key behaviors:
  - English containment contradictions force `revise`,
  - Chinese containment contradictions force `revise`,
  - compatible contained-material refinements still cleanly `release`.
- This phase does not replace the earlier contradiction owners.
- It closes the remaining gap where `the subject stayed the same, the relation stayed the same, but the contained material drifted`.

#### Phase-18 DAG-causal contradiction hardening landed on top of the containment slice

- `src/learning/answerReleaseReview.ts` now adds an eighth contradiction-oriented reviewer gate: `claim_graph_causal_consistency`.
- This gate is intentionally narrower than a generic semantic verifier:
  - it consumes only the existing assembled DAG evidence already present in `graphContext`,
  - the first supported directional relation is `causal`.
- It reuses the same structured graph surfaces already carried through the current architecture:
  - `connectionPaths`,
  - `knowledgePointRelations`,
  - `predecessorWindow`,
  - `successorWindow`.
- It stays conservative by design:
  - if the draft makes no explicit cause/effect claim, it does nothing,
  - if the DAG evidence exposes no trustworthy causal direction, it does nothing,
  - if the draft already matches one grounded causal direction, it does not invent a contradiction from weaker wording elsewhere.
- When the draft reverses grounded cause/effect direction, the reviewer now emits a deterministic correction sentence rather than dropping back to a generic summary:
  - English: `X causes Y.`
  - Chinese: `X导致Y。`
- `src/learning/answerReleaseReview.test.ts` now pins three important behaviors:
  - English causal reversal forces `revise`,
  - correct causal direction still `release`s cleanly,
  - Chinese causal reversal forces `revise`.
- This phase matters architecturally because it closes another concrete part of the earlier `the DAG is underused at answer time` criticism:
  - the existing DAG now participates in release-time contradiction control for both `causal` and `order` relations,
  - the reviewer still remains a local deterministic owner instead of becoming a model-owned semantic judge.

#### Phase-19 same-subject attribute contradiction hardening landed on top of the DAG-causal slice

- `src/learning/answerReleaseReview.ts` now adds a ninth contradiction-oriented reviewer gate: `claim_attribute_consistency`.
- This gate stays narrower than a generic semantic verifier:
  - it only compares explicit same-subject attribute frames shaped like `has` / `have` / `具有` / `带有`,
  - it reuses the existing lexical feature substrate instead of introducing a second semantic runtime,
  - it stays conservative when no comparable attribute frame exists.
- The implementation now explicitly rejects the earlier over-broad equivalence heuristic:
  - high lexical overlap alone is no longer enough to treat two attribute values as equivalent,
  - this blocks false release for modifier drift such as `moderate thermal insulation` vs `high thermal insulation`,
  - compatible refinements such as `transparent wall` vs `transparent glass wall` still remain releasable.
- `src/learning/answerReleaseReview.test.ts` now pins three important behaviors:
  - English same-subject attribute contradiction forces `revise`,
  - Chinese same-subject attribute contradiction forces `revise`,
  - compatible attribute refinement still `release`s cleanly.
- This phase matters architecturally because it closes another deterministic contradiction class without moving release policy into prompts, the frontend, or an external framework.

#### Phase-20 composition contradiction hardening landed on top of the attribute slice

- `src/learning/answerReleaseReview.ts` now adds a tenth contradiction-oriented reviewer gate: `claim_composition_consistency`.
- This gate stays deliberately narrower than a generic semantic verifier:
  - it only compares explicit composition frames such as `composed of`, `consists of`, `made of`, and `由...组成`,
  - it reuses the same local lexical feature substrate instead of introducing a second semantic runtime,
  - it remains conservative when no comparable composition frame exists.
- The supported contradiction family is intentionally concrete:
  - English: `Water glass is composed of water and a glass cup` vs `Water glass is composed of oil and a plastic cup`,
  - Chinese: `水杯由水和玻璃杯组成` vs `水杯由机油和塑料杯组成`.
- False-positive control is explicit:
  - same-subject composition frames are comparable even when the component strings drift heavily, because the explicit relation itself is already high-confidence,
  - component matching remains order-insensitive,
  - compatible refinements such as `glass cup` vs `transparent glass cup` still `release` when both directions remain covered by the same component set.
- `src/learning/answerReleaseReview.test.ts` now pins three important behaviors:
  - English composition contradiction forces `revise`,
  - Chinese composition contradiction forces `revise`,
  - compatible component order/refinement still `release`s cleanly.
- This phase matters architecturally because it closes a reviewer hole that sat directly under the screenshot-derived `waterglass` definition family:
  - the system already knew how to revise document-framing drift,
  - but it still needed an explicit owner for `same subject, same composition relation, wrong components`.

#### Phase-21 purpose/use contradiction hardening landed on top of the composition slice

- `src/learning/answerReleaseReview.ts` now adds an eleventh contradiction-oriented reviewer gate: `claim_purpose_consistency`.
- This gate keeps the same narrow-owner discipline:
  - it only compares explicit purpose/use frames such as `used for`, `used to`, `designed for`, `designed to`, `serves to`, and `用于`,
  - it reuses the same local lexical feature substrate instead of introducing a second semantic runtime,
  - it stays conservative when no comparable purpose frame exists.
- The supported contradiction family is intentionally concrete:
  - English: `Water glass is used for drinking water` vs `Water glass is used for storing motor oil`,
  - Chinese: `水杯用于饮水` vs `水杯用于储存机油`.
- False-positive control is explicit:
  - same-subject purpose frames remain comparable because the explicit relation already carries high confidence,
  - supported-purpose refinements such as `serving cold water` under `drinking water and serving cold water` still `release`,
  - purpose sentences are now excluded from the narrower `claim_state_consistency` slice, so `is used for ...` no longer misfires as a state contradiction.
- `src/learning/answerReleaseReview.test.ts` now pins three important behaviors:
  - English purpose contradiction forces `revise`,
  - Chinese purpose contradiction forces `revise`,
  - supported-purpose refinement still `release`s cleanly.
- This phase matters architecturally because it closes another explicit-relation contradiction family without widening the reviewer into a generic semantic judge.

#### Phase-22 dependency/prerequisite contradiction hardening landed on top of the purpose slice

- `src/learning/answerReleaseReview.ts` now adds a twelfth contradiction-oriented reviewer gate: `claim_dependency_consistency`.
- This gate keeps the same narrow-owner discipline:
  - it only compares explicit dependency/prerequisite frames such as `depends on`, `requires`, `relies on`, `has prerequisite`, `依赖`, `需要`, and `前置条件`,
  - it reuses the same local lexical feature substrate instead of introducing a second semantic runtime,
  - it stays conservative when no comparable dependency frame exists.
- The supported contradiction family is intentionally concrete:
  - English: `Response Validation depends on Baseline Measurement and Sensor Calibration` vs `Response Validation depends on Final Reporting`,
  - Chinese: `响应验证依赖基线测量和传感器校准` vs `响应验证依赖最终报告`。
- False-positive control is explicit:
  - same-subject dependency frames remain comparable because the explicit relation already carries high confidence,
  - compatible dependency answers still `release` when the draft stays inside the supported dependency set,
  - this gate closes a different hole from DAG-order checking: it catches swapped dependency targets inside the same subject claim, not only reversed graph direction.
- `src/learning/answerReleaseReview.test.ts` now pins three important behaviors:
  - English dependency contradiction forces `revise`,
  - Chinese dependency contradiction forces `revise`,
  - supported dependency answers still `release` cleanly.
- This phase matters architecturally because it closes the explicit dependency/prerequisite family without collapsing the reviewer into a generic semantic verifier.

#### Phase-23 structured comparison contradiction hardening landed on top of the dependency slice

- `src/learning/answerReleaseReview.ts` now adds a thirteenth contradiction-oriented reviewer gate: `claim_structured_comparison_consistency`.
- This gate stays within the same narrow-owner discipline:
  - it only evaluates explicit comparative frames such as `higher than`, `lower than`, `greater than`, `less than`, `高于`, and `低于`,
  - it only fires when two support facts are comparable on the same property family and the same unit,
  - it reuses local structured-fact extraction plus anchor/label lexical features instead of introducing a second semantic verifier.
- The supported contradiction family is intentionally concrete:
  - English: `Water density is higher than glass density` vs support showing `Glass density is 2500 kg/m3` and `Water density is 999.8 kg/m3`,
  - Chinese: `水的密度高于玻璃的密度` vs the same support ordering.
- False-positive control is explicit:
  - mixed-property pairs such as density vs temperature do not become comparable just because both are numeric,
  - mixed-unit pairs do not become comparable,
  - compatible supported comparisons still `release`,
  - when the reviewer cannot match both sides to same-property support facts, it stays conservative instead of guessing.
- `src/learning/answerReleaseReview.test.ts` now pins four important behaviors:
  - English comparison inversion forces `revise`,
  - Chinese comparison inversion forces `revise`,
  - supported comparison direction still `release`s cleanly,
  - mixed-property support does not create a false positive.
- The revision surface is also now sentence-quality aware: English deterministic corrections preserve strong anchor casing instead of lowercasing acronyms or proper nouns by accident.
- Runtime verification now records one more operational lesson: reviewer-gate changes must be checked against freshly built `dist` output. The first runtime probe missed the new gate inventory until `npm run build:mini` refreshed the compiled JS.
- This phase matters architecturally because it closes a real contradiction family that lexical overlap, structured scalar checks, and DAG comparison-family checks do not cover by themselves: same-property ordering drift between two grounded entities.

#### Phase-24 temporal validity contradiction hardening landed on top of the structured-comparison slice

- `src/learning/answerReleaseReview.ts` now adds a fourteenth contradiction-oriented reviewer gate: `claim_temporal_validity_consistency`.
- This gate keeps the same narrow-owner discipline:
  - it consumes the project’s existing DAG temporal surface through `graphContext.temporalValidity`,
  - it only fires when `allPointsValid === false`,
  - it stays conservative unless the draft is actually presenting that evidence as a current answer.
- The supported contradiction family is intentionally concrete:
  - English: a draft releases a current-tense answer even though the grounded evidence carries temporal warnings,
  - Chinese: a draft still publishes a current conclusion although the matched DAG evidence is already temporally flagged.
- False-positive control is explicit:
  - explicitly time-qualified drafts such as `as of 2024`, `historically`, or `截至2024年` still `release`,
  - year-qualified public answers count as qualified,
  - supersedes-only lineage does not block release by itself when the current anchor remains valid.
- `src/learning/answerReleaseReview.test.ts` now pins four important behaviors:
  - temporally flagged current-tense English release must `revise`,
  - explicitly time-qualified answers may still `release`,
  - temporally flagged current-tense Chinese release must `revise`,
  - supersedes-only lineage must not create a false positive.
- This phase matters architecturally because it moves DAG temporal warnings from explanation-only metadata into the final release contract without handing correctness ownership to a second verifier runtime.

### Why the Earlier Framework Proposals Were Insufficient

Reviewed references under `ref/`:

- `ref/dspy` `4987601`
- `ref/guidance` `21b1d90`
- `ref/semantic-kernel` `13f812b`
- `ref/langchain` `847312e`
- `ref/litellm` `cf2db41`
- `ref/ahadiff` `897768c`

Concrete local files inspected during this re-audit:

- `ref/dspy/dspy/evaluate/evaluate.py`
- `ref/dspy/dspy/teleprompt/bootstrap.py`
- `ref/guidance/guidance/_grammar.py`
- `ref/langchain/libs/core/langchain_core/language_models/base.py`
- `ref/langchain/libs/core/langchain_core/prompts/chat.py`
- `ref/semantic-kernel/python/semantic_kernel/prompt_template/prompt_template_config.py`
- `ref/semantic-kernel/python/samples/concepts/agents/azure_ai_agent/azure_ai_agent_as_kernel_function.py`
- `ref/litellm/cookbook/litellm_router/load_test_router.py`

Critical conclusion:

- **DSPy** is useful for typed LM subprograms, compile/optimizer loops, and evaluation harnesses, but it does not own runtime invariants unless you externalize them into explicit gates first.
- **Guidance** is useful for constrained structured outputs, regex/CFG-style control, and output contracts, but structured output is not the same as a release decision.
- **Semantic Kernel** is useful for orchestration, plugins, and agent-process boundaries; its current repo direction toward Microsoft Agent Framework is further evidence that it is an orchestration surface, not a local verifier.
- **LangChain Core** is useful for orchestration plus observability/evaluation surfaces, but it still does not solve evidence-policy ownership.
- **LiteLLM** helps provider routing, proxy/gateway control, and model switching, not answer correctness; it is a gateway, not a release-review owner.
- **AhaDiff** is the most relevant conceptual reference because it separates public conclusion from evidence and verification state. The new local reviewer layer follows that direction without importing its runtime model.
- The graph-focus payload fix reinforces the same lesson on the frontend side: local evidence-path invariants still need a local owner even when framework-assisted prompting exists elsewhere.

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

1. Use the new explicit alias/scope regression corpus to add deeper contradiction checks beyond the current lexical + query-intent + structured-fact + structured-comparison + attribute + containment + composition + purpose + dependency + subject + state + polarity + graph-causal + graph-order + graph-comparison + temporal-validity gate stack, but only where the new checks can stay deterministic enough to avoid false-positive churn.
2. Keep expanding the corpus with real cross-scope, compact-alias, and synonym failures before widening reviewer policy again.
3. Treat the current block-level markdown source mapping plus `source_line_provenance` -> source-authenticated fragment projection -> `line_window` -> `snippet_fallback` graph-focus stack as the implemented baseline, then focus the next provenance step on repeated-fragment disambiguation via explicit offsets or richer AST provenance.
4. Keep compare-ready drilldowns on the existing reviewer telemetry path and resist creating a second audit owner for richer operator slices.
5. Continue owner reduction in `KnowledgeLearningPlatform.ts` and `agent_workspace.js` only where the new module owns real invariants.

### Five-Point Summary

1. The missing mechanism was not graph retrieval; it was final public-answer release review.
2. The correct owner is a local deterministic reviewer layer, not a new prompt framework.
3. The current project DAG remains the evidence substrate and now also participates in release-time causal, order, and comparison correction; graph-focus now also has a block-level provenance baseline plus `source_line_provenance` / source-authenticated fragment projection / `line_window` / `snippet_fallback`, so the remaining evidence gap has narrowed to repeated-fragment disambiguation inside one authenticated block rather than basic pane opening.
4. The `waterglass` screenshot is now encoded as a runtime acceptance requirement through reviewer-aware verification, and the reviewer stack now also blocks same-subject attribute drift, containment-content drift, composition-component drift, dependency/prerequisite drift, DAG-backed causal reversal, and temporally flagged current-answer release before publication.
5. The landed slice is backward-compatible and materially improves robustness without widening the main answer surface; the next work is broader contradiction coverage, not replacing the current reviewer owner.

## 中文文档

### 目标

这份说明针对的是一个结构性缺口：系统已经能做检索、DAG 上下文装配、回答合成、右侧证据面板渲染，但在真正把答案发给用户之前，仍然没有一个专门 owner 负责判断“这个公开回答是否值得被释放”。

目标不是再引入一层 prompt framework，而是补上一层确定性的最终回复审核/纠错机制，它要做到：

1. 判断当前 scoped evidence 是否足以支持公开回答；
2. 当草稿回答泄漏内部诊断或把支撑材料堆进主回答区时，改写或降级为 abstain；
3. 把开发者细节留在 trace、`knowledge_run`、evidence pane 和 export；
4. 继续使用项目现有 DAG 作为结构化证据，而不是把图结构当成 prompt 装饰；
5. 保持 additive 和向前兼容。

### 2026-06-19 增量结果

- 复审确认：最初的“缺失 owner”问题已经在代码中关闭，当前工作不再是重开 framework 争论，而是继续加固两个更窄的不变量边界。
- `src/learning/answerReleaseReview.ts` 现在新增 `claim_state_consistency`，用于拦截 `open system` vs `closed system` 这类同主体 definition/copula 状态矛盾。
- `src/learning/answerReleaseReview.ts` 现在也新增 `query_intent_alignment`，因此定义型问题会把 `本技术文档旨在...` 这类元文档草稿改写成直接定义句后再 release。
- `src/learning/answerReleaseReview.ts` 现在也新增 `claim_containment_consistency`，因此像把 `Water glass contains water` 偷换成 `Water glass contains oil` 这类“同一主体、同一显式容纳关系、但内容物漂移”的草稿会在 release 前被拦截并改写。
- `src/learning/answerReleaseReview.ts` 现在也新增 `claim_composition_consistency`，因此像把 `water and a glass cup` 偷换成 `oil and a plastic cup` 这类“同一主体、同一显式组成关系、但组件漂移”的草稿会在 release 前被拦截并改写。
- `src/learning/answerReleaseReview.ts` 现在也新增 `claim_purpose_consistency`，因此像把 `drinking water` 偷换成 `storing motor oil` 这类“同一主体、同一显式用途关系、但用途漂移”的草稿会在 release 前被拦截并改写。
- `src/learning/answerReleaseReview.ts` 现在也新增 `claim_subject_consistency`，因此像把 `Water density` 偷换成 `Glass density` 这种“事实尾部还对，但 grounded subject 已漂移”的草稿会在 release 前被拦截并改写。
- `src/learning/answerReleaseReview.ts` 现在也新增 `claim_attribute_consistency`，因此像把 `中等热绝缘性能` 偷换成 `高热绝缘性能` 这种“同一主体、同一显式属性框架、但属性值漂移”的草稿会在 release 前被拦截并改写。
- `src/learning/answerReleaseReview.ts` 现在也新增 `claim_graph_causal_consistency`，因此像把 `Pressure Rise causes Thermal Expansion` 这样与 DAG 因果方向相反的草稿，会在 release 前被中英文确定性纠正句拦截并改写。
- `src/learning/answerReleaseReview.ts` 现在也新增 `claim_graph_order_consistency`，因此像把 DAG 支撑的 `prerequisite` / `sequence` 顺序说反的草稿，会在 release 前被确定性纠正句拦截并改写。
- `src/learning/answerReleaseReview.ts` 现在也新增 `claim_graph_comparison_consistency`，因此当 DAG 只支撑 `contrast` 或只支撑 `analogy` 时，把二者说反的草稿也会在 release 前被拦截并改写。
- `src/learning/answerReleaseReview.ts` 现在也新增 `claim_temporal_validity_consistency`，因此 DAG 时序有效性警告已经进入最终公开回答的 release contract：当 `graphContext.temporalValidity.allPointsValid === false` 时，未显式带时间限定的“当前结论”草稿会在 release 前被改写；已经带明确时间限定的回答仍可放行，而仅有 `supersedes` 血缘本身不会误触发门禁。
- `src/learning/answerReleaseReview.ts` 现在也新增 `claim_dependency_consistency`，因此像把 `响应验证依赖基线测量和传感器校准` 偷换成 `响应验证依赖最终报告` 这类“同一主体、同一显式依赖/前置条件关系、但依赖目标漂移”的草稿会在 release 前被拦截并改写。
- `src/learning/answerReleaseReview.ts` 现在也新增 `claim_structured_comparison_consistency`，因此像把 `Water density is higher than glass density` 这类“同一属性、同一单位、比较方向说反”的草稿，也会在 release 前被确定性纠正句拦截并改写，而不会仅因 topic overlap 还在就放行。
- `src/frontend/markdown_runtime.js` 现在会暴露 block-level 的 source-line provenance，`src/frontend/workspace_panes.js` 则优先消费 `source_line_provenance`，之后才回退到 `line_window` / `snippet_fallback`。
- 右侧 pane 现在也会在选中的渲染节点内部投影命中的 evidence fragment 内联高亮，而不再只是给更大的段落 / 容器着色。
- 共享 alias/scope 回归现在已经把“跨语料稳定的公开回答不变量”与“截图驱动的运行时行为”拆开：简化语料允许 `release` 或 `revise`，而真实 `waterglass_explicit_scope_compact_zh` 运行时用例仍然要求 `revise`，且必须命中 `query_intent_alignment`。
- 运行时验证现在还有一个明确的 build-freshness 约束：第一次在陈旧 `dist` 输出上跑 verifier 时，新 gate 清单没有完整暴露；执行 `npm run build:mini` 后再次验证，编译产物与源码 reviewer 面才重新对齐。问题是陈旧编译输出，不是 reviewer 接线缺失。
- 已核验 `ref/` 下克隆的 `dspy`、`guidance`、`semantic-kernel`、`langchain` 与 `litellm` 仍然只是设计参考，而不是 release policy owner：它们分别擅长 prompt 优化、受约束生成、agent orchestration 或 provider routing，但都不能替代当前 TypeScript runtime 里的本地 DAG 驱动最终回答校验。
- 当前剩余的 provenance 缺口已经不再是“完全没有 source-to-render provenance”，而是超出当前 block-level mapping 的 exact-span / nested provenance。

### 第一性原理

#### 术语定义

- **草稿回答（draft answer）**：回答合成层先产出的第一版用户回答文本。
- **公开回答（public answer）**：真正进入主回答区的最终文本。
- **最终回复审核（answer release review）**：位于回答合成之后、公开释放之前的决策层，可做 `release`、`revise`、`abstain`。
- **纠错（revision）**：在不破坏兼容性的前提下，把已有证据支撑的草稿收缩成更干净的主回答。
- **降级拒答（abstention）**：证据不足时，明确拒绝过度声称。
- **证据充分性（evidence sufficiency）**：系统可以公开回答而不是拒答的最低支撑阈值。
- **依赖断言（dependency claim）**：主体显式声明“依赖于”“需要”或“以前置条件为成立前提”的关系断言。
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
   - query intent alignment
   - grounding alignment
   - evidence sufficiency
   - graph support sufficiency
   - structured consistency
   - structured comparison consistency
   - attribute consistency
   - containment consistency
   - composition consistency
   - purpose consistency
   - dependency consistency
   - public-surface contraction
   - internal diagnostic leakage
   - subject consistency
   - state consistency
   - polarity consistency
   - graph-causal consistency
   - graph-order consistency
   - graph-comparison consistency
   - temporal-validity consistency
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

### 参考开源库对账

之前那组框架建议把四类问题混在了一起：

1. query rewriting，
2. structured generation，
3. agent orchestration / provider routing，
4. release-time correctness verification。

而截图暴露的主故障在第 4 类，上游只夹带了一个较小的第 1 类 query normalization 漂移。如果这一点不拆开，方案会不断漂向错误 owner。

| `ref/` 下的参考仓库 | 它真正优化的对象 | 在本项目里的合理位置 | 为什么它不是当前缺口的 owner |
|---|---|---|---|
| `ref/dspy` | typed LM program、compile/optimizer 回路与评测 harness | 可作为离线 draft-generation prompt、scorer prompt 或回归评分实验框架 | DSPy 不拥有本地 DAG、TypeScript runtime contract，也不拥有最终 release decision；把 release policy 交给 DSPy 会让正确性重新依赖模型表现 |
| `ref/guidance` | 受约束生成、regex/CFG 风格控制与结构化输出契约 | 可作为中间 JSON 提取实验或 shadow audit 输出控制层 | 它能约束模型输出形状，但截图故障发生在“未审核的公开回答被直接释放”这一边界，不是输出 schema 本身缺失 |
| `ref/semantic-kernel` | orchestration、plugin 边界与 agent 过程编排 | 可参考 plugin/process 边界设计 | 该仓库当前已明确朝 Microsoft Agent Framework 收敛；把这套 owner 直接搬进本地 Node/TypeScript DAG runtime，只会复制编排层，而不会关闭最终审核边界 |
| `ref/langchain` | application orchestration 与 observability/eval 表面 | 可作为实验性 harness 或外部评测面 | LangChain 擅长组合与工具面，不擅长成为本地 graph-conditioned answer invariant 的事实 owner；把 release ownership 迁过去只会转移歧义 |
| `ref/litellm` | provider 统一、proxy/gateway 路由与模型路由控制 | 如果未来产品需要多 provider 路由，可放在上游模型接入层 | LiteLLM 统一的是 provider API 与路由，不会验证最终回答是否违背项目 DAG，也不会阻止 runtime diagnostic leakage |

最佳实践结论：

- 继续让确定性的 TypeScript reviewer 持有 release policy，
- 继续让项目现有 DAG 持有结构化证据所有权，
- LLM 框架只用于可选的上游生成实验或 shadow audit，
- 不让 prompt / orchestration framework 成为最终公开回答正确性的唯一 owner。

### 当前代码与要求对账

| 要求 | 当前实现 | 进度判断 |
|---|---|---|
| 主回答区不能泄漏后端诊断 | 新增 `src/learning/answerReleaseReview.ts`，在 release 前拦截 diagnostic leakage。 | 已实现 |
| 空结果回答必须 clean abstain，而不是暴露 runtime 细节 | reviewer 现在会把 unsupported draft 降级成简洁 abstention。 | 已实现 |
| grounded draft 必须与 citation/knowledge-point 支撑保持一致 | reviewer 现在会执行 `claim_grounding_alignment`，在词法证据重叠不足时强制改写漂移主张。 | 已实现 |
| grounded draft 还必须检查确定性的结构化事实冲突 | reviewer 现在会执行 `claim_structured_consistency`：即使 topical lexical overlap 仍然通过，只要数值或年份事实与支撑冲突，也会触发 revise。 | 已实现基线 |
| grounded draft 还必须检查显式 structured comparison 方向反转 | reviewer 现在会执行 `claim_structured_comparison_consistency`：当 `higher/lower`、`greater/less`、`高于/低于` 这类显式比较与“同一属性、同一单位”的支撑事实顺序相反时，会在 release 前触发 revise。 | 已实现基线 |
| grounded draft 还必须检查显式容纳关系里的内容物矛盾 | reviewer 现在会执行 `claim_containment_consistency`：对于中英文可比容纳关系，只要主体不变、关系不变、但内容物被偷换，就会触发 revise。 | 已实现基线 |
| grounded draft 还必须检查显式组成关系里的组件矛盾 | reviewer 现在会执行 `claim_composition_consistency`：对于可比的 `由...组成` / `composed of` 关系，只要主体不变、关系不变、但支撑组件被偷换，就会触发 revise，同时兼容组件顺序调整与兼容细化。 | 已实现基线 |
| grounded draft 还必须检查显式用途关系里的用途矛盾 | reviewer 现在会执行 `claim_purpose_consistency`：对于可比的 `used for` / `用于` 关系，只要主体不变、关系不变、但支撑用途被偷换，就会触发 revise，同时兼容支撑用途细化。 | 已实现基线 |
| grounded draft 还必须检查显式依赖 / 前置条件关系里的依赖目标矛盾 | reviewer 现在会执行 `claim_dependency_consistency`：对于可比的 `depends on` / `requires` / `依赖` / `前置条件` 关系，只要主体不变、关系不变、但支撑依赖被偷换，就会触发 revise，同时兼容真正被支撑的依赖回答。 | 已实现基线 |
| grounded draft 还必须检查“事实尾部一致但主体漂移”的 grounded-subject 冲突 | reviewer 现在会执行 `claim_subject_consistency`：即使数值/事实尾部仍与支撑一致，只要 grounded subject / entity 被偷换，也会触发 revise。 | 已实现基线 |
| grounded draft 还必须检查同主体显式属性漂移 | reviewer 现在会执行 `claim_attribute_consistency`：对于可比的 `has` / `have` / `具有` 属性框架，只要主体不变但属性值被偷换，就会触发 revise。 | 已实现基线 |
| grounded draft 还必须检查同主体状态矛盾 | reviewer 现在会执行 `claim_state_consistency`：对于中英文可比的 definition/copula 状态断言，只要同主体状态与支撑冲突，就会触发 revise。 | 已实现基线 |
| grounded draft 还必须检查显式正反断言反转 | reviewer 现在会执行 `claim_polarity_consistency`：即使 topical lexical overlap 仍然通过，只要把 `is` / `不是` 这类断言方向明确说反，也会触发 revise。 | 已实现基线 |
| grounded draft 还必须检查与 DAG 相矛盾的因果断言 | reviewer 现在会执行 `claim_graph_causal_consistency`：只要把已装配 DAG 的 `causal` 因果方向说反，就会触发 revise。 | 已实现基线 |
| grounded draft 还必须检查与 DAG 相矛盾的顺序断言 | reviewer 现在会执行 `claim_graph_order_consistency`：只要把已装配 DAG 的 `prerequisite` 或 `sequence` 方向说反，就会触发 revise。 | 已实现基线 |
| grounded draft 还必须检查 DAG 支撑的对比/类比分支被说反 | reviewer 现在会执行 `claim_graph_comparison_consistency`：当同一 title pair 在已装配 DAG 中只支撑 `contrast` 或只支撑 `analogy` 时，把两者说反会触发 revise。 | 已实现基线 |
| grounded draft 还必须检查 DAG 时序有效性警告与“当前结论”发布之间的冲突 | reviewer 现在会执行 `claim_temporal_validity_consistency`：当 `graphContext.temporalValidity.allPointsValid === false` 时，未显式带时间限定的当前结论会被改写；已经显式限定时间的回答仍可放行，而仅有 `supersedes` 血缘本身不会制造误报。 | 已实现基线 |
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
- 这份语料的契约现在也按不变量强度分层：
  - 共享 Jest 语料只要求最终公开回答保持 grounded 且收缩，因此当合成层已经直接产出好答案时，`release` 与 `revise` 都是可接受结果；
  - 真实截图派生的运行时验收仍然要求 `waterglass_explicit_scope_compact_zh` 触发 `revise`，并明确失败 gate 为 `query_intent_alignment`。
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

#### 在 DAG 顺序矛盾切片之上继续落地的 Phase-11 graph-focus payload 契约加固

- `src/frontend/workspace_panes.js` 现在已经把 citation-backed evidence 字段视为 graph focus 的一等回退输入，而不再只信任原始 `item.sourcePath` / `span.sourcePath`。
- `normalizeMatchedSpans()` 现在会在原始 span 字段不完整时，从 `span.citation` 回填：
  - `title`
  - `snippet`
  - `sourcePath`
  - `startLine`
  - `endLine`
- `buildKnowledgePointFocusPayload()` 现在会在打开右侧 pane 之前派生 additive `candidateSourcePaths` 与归一化后的 matched spans。
- `resolveKnowledgePointSourcePath()` 不再在第一个原始 path 处提前停止，而是会扫描 top-level source path、top-level citation、citation list、span path 与 span-citation path。
- `resolveGraphFocusCandidatePaths()` 现在会消费这份 additive candidate list，因此即使 grouped knowledge hit 没有 canonical top-level path，预览解析也能保持稳定。
- `src/agent_workspace.frontend.test.ts` 现在已经固定两类具体失败模式：
  - citation-backed snippet 在 markdown render 之后仍然必须能高亮，
  - top-level hit path 缺失时，citation-backed path 仍然必须能打开原始内容。
- 这个 Phase 不改变 final-answer reviewer 本身。
- 它关闭的是另一条必要边界：在主回答已经收缩后，运维/开发者对证据原文的可用性。

#### 在 graph-focus payload 加固之上继续落地的 Phase-12 高亮精度收紧

- `src/frontend/workspace_panes.js` 现在会在 `startLine` / `endLine` 与 snippet 文本足够一致时，构造可信的 `line_window` 锚点。
- 这份信任是条件化的：
  - 如果行窗本身不存在，它不会强行生效；
  - 如果行窗与 snippet 的重叠过弱，它会被视为 stale，不允许把高亮强行带偏。
- 当前渲染候选节点的打分已经同时考虑：
  - 可用时的 `line_window` 文本，
  - 否则回退到 `snippet_fallback` 文本，
  - specificity bonus，保证窄段落优先于泛化容器，
  - container penalty，避免整块容器被过宽高亮。
- 最终命中的路径现在会通过 additive `highlightStrategy` 诊断显式暴露：`line_window`、`snippet_fallback` 或 `none`。
- `src/agent_workspace.frontend.test.ts` 现在已经固定两类更高价值的失败：
  - 当同一 snippet 在多个段落重复出现时，必须依靠可信 line window 命中正确段落；
  - 当行号元数据不可用或不可信时，必须回退到 snippet 高亮，而不是误高亮错误段落。
- 这个 Phase 依然不把 release policy 挪到前端。
- 它关闭的是另一条局部不变量：在主回答已经收缩之后，证据原文预览的高亮精度。

#### 在 DAG 顺序矛盾切片之上继续落地的 Phase-13 同主体状态矛盾加固

- `src/learning/answerReleaseReview.ts` 现在新增了第五个面向矛盾检测的 reviewer gate：`claim_state_consistency`。
- 这个 gate 依然比泛化语义 verifier 更窄口径：
  - 它只比较看起来属于同一主体的 definition/copula 状态框架，
  - 它会跳过已经分别由 `claim_structured_consistency` 与 `claim_graph_order_consistency` 持有的数值事实与 DAG 顺序语言。
- 当前支持的第一批矛盾类型是同主体状态反转：
  - 英文形态，例如 `X is an open system` vs `X is a closed system`，
  - 中文形态，例如 `X 是开放系统` vs `X 是封闭系统`。
- 这个 gate 为了控制 false positive，继续保持保守：
  - 如果草稿没有可比 state frame，它什么也不做，
  - 如果支撑里没有可比 state frame，它什么也不做，
  - 如果主体重叠过弱，或 value tail 仍然存在实质重叠，它不会强制 revise。
- `src/learning/answerReleaseReview.test.ts` 现在已经固定三类关键行为：
  - 英文同主体状态冲突必须 `revise`，
  - 中文同主体状态冲突必须 `revise`，
  - 同一状态的兼容细化表述必须继续 clean `release`。
- 这个 Phase 不替代 lexical、structured、polarity 或 DAG-order gate。
- 它补上的窄缺口是：“主题没偏、主体没偏，但状态说反了”。

#### 在 graph-focus 高亮精度之上继续落地的 Phase-14 block-level markdown provenance

- `src/frontend/markdown_runtime.js` 现在会抽取 markdown source blocks，并给渲染节点标注：
  - `data-agent-markdown-source-start-line`
  - `data-agent-markdown-source-end-line`
  - `data-agent-markdown-source-kind`
- `renderMarkdownInto(...)` 现在还会返回 additive provenance 诊断，供调用方查看：
  - `sourceBlockCount`
  - `attributedNodeCount`
- `src/frontend/workspace_panes.js` 现在会在文本启发式之前先消费这份元数据：
  - `resolveGraphFocusRenderedSourceRange(...)` 负责读取渲染节点 source range，
  - 当这些 range 与可信 evidence span 重叠时，`source_line_provenance` 会优先胜出，
  - `line_window` 与 `snippet_fallback` 继续作为有界回退路径存在。
- `src/agent_workspace.frontend.test.ts` 现在已经固定“两个渲染段落文本完全相同，但只有一个命中可信 source-line span”这一重复段落回归。
- 这个 Phase 也进一步收紧了此前的 provenance 批评：
  - 右侧 pane 不再只依赖 payload snippet，
  - 但当前映射仍然是 block-level，而不是 exact-span / nested-span 精度。

#### 在 block-level provenance 之上继续落地的 Phase-15 source-authenticated fragment projection

- `src/frontend/workspace_panes.js` 现在把内联高亮视为“节点选中之后”的第二阶段问题，而不再复用同一套宽启发式。
- 一旦渲染 block 已经通过 `source_line_provenance` 或 `line_window` 被选中，内联高亮现在会先尝试 snippet 尺度的 source-authenticated fragment projection，再回退到旧的 broad text search。
- 新增的 additive 诊断字段 `inlineHighlightStrategy` 现在会区分：
  - `source_fragment_provenance`
  - `text_search`
  - `none`
- 这一步关闭了上一阶段一个具体且面向运维的失败：
  - 单行段落在命中 snippet 只是其中一部分时，不会再整行被包成一个大高亮，
  - `strong` 这类嵌套 inline markdown 节点，也不会再因为 line window 覆盖整句，就把整句一起高亮。
- `src/agent_workspace.frontend.test.ts` 现在又固定了两类新回归：
  - 单行段落高亮必须收缩到命中的 fragment，而不是整行，
  - 嵌套 inline markdown 节点仍然必须解析成单个精确 fragment 高亮。
- 这个 Phase 仍然没有完全解决“同一个已认证 block 内、同一 line window 下、同一 snippet 文本重复出现”的去歧义问题。那个剩余缺口需要更强的 payload offset 或更丰富的 AST provenance，而不是再堆一层 ranking tweak。

#### 在 provenance / reviewer 基线之上继续落地的 Phase-16 grounded-subject 矛盾加固

- `src/learning/answerReleaseReview.ts` 现在新增了第六个面向矛盾检测的 reviewer gate：`claim_subject_consistency`。
- 这个 gate 补的是前一层栈留下来的一个具体缺口：
  - lexical overlap 仍然可能很高，
  - structured fact 仍然可能匹配，
  - polarity 也仍然可能一致，
  - 但答案依然可能偷偷把 grounded subject / entity 换掉。
- 它依然比泛化 verifier 更窄口径：
  - 只比较可比的 subject-tail frame，
  - 只在 support tail 仍然实质重叠、但 grounded subject 已实质不同的时候触发。
- 当前支持的第一批矛盾类型是“事实尾部稳定，但 grounded 主体漂移”：
  - 英文形态，例如 `Water density is 999.8 kg/m3` vs `Glass density is 999.8 kg/m3`，
  - 中文形态，例如 `水的密度是...` vs `玻璃的密度是...`。
- 这个 gate 的保守偏置仍然是刻意设计出来的：
  - 如果草稿里抽不出 subject-tail frame，它什么也不做，
  - 如果 grounded support 里没有可比 frame，它什么也不做，
  - 如果主体差异只是同一实体的轻微冠词 / 词序变化，它不会强制 revise。
- `src/learning/answerReleaseReview.test.ts` 现在已经固定两个关键边界：
  - grounded subject 被偷换但事实尾部相同时，必须 `revise`，
  - `Water glass` 与 `A water glass` 这类同一实体的等价表述，仍然必须 clean `release`。
- 这个 Phase 不替代之前的矛盾 gate owner。
- 它补上的剩余缺口是：“事实尾部没错，但 grounded 主体错了”。

#### 在 grounded-subject 切片之上继续落地的 Phase-17 containment 矛盾加固

- `src/learning/answerReleaseReview.ts` 现在新增了第七个面向矛盾检测的 reviewer gate：`claim_containment_consistency`。
- 这个 gate 补的是一个更窄、但真实存在的缺口：
  - 草稿可以保持同一 grounded subject，
  - 保持同一显式容纳/承载关系，
  - 但仍然偷偷把被容纳内容换掉。
- 当前支持的第一批矛盾类型刻意保持窄口径、确定性优先：
  - 英文：`contains`、`is/are/was/were filled with`
  - 中文：`装有`、`盛有`、`含有`、`包含`
- 这个 gate 的归一化偏置也是刻意设计出来的：
  - 会先剥离 `during the example setup`、`在示例过程中` 这类尾随环境语境，再比较内容物；
  - `water` -> `cold water` 这类兼容细化必须继续 clean `release`；
  - 不可比或重叠过弱的容纳表述，不允许强行触发 revision。
- 这是正确偏置。一个会从弱重叠里凭空制造“内容物矛盾”的 gate，比一个只抓高置信度偷换的窄 gate 更糟。
- `src/learning/answerReleaseReview.test.ts` 现在已经固定三类关键行为：
  - 英文 containment contradiction 必须 `revise`；
  - 中文 containment contradiction 必须 `revise`；
  - 内容物兼容细化表述必须继续 clean `release`。
- 这个 Phase 不替代之前的矛盾 gate owner。
- 它补上的剩余缺口是：“主体没变、关系没变，但内容物错了”。

#### 在 containment 切片之上继续落地的 Phase-18 DAG 因果矛盾加固

- `src/learning/answerReleaseReview.ts` 现在新增了第八个面向矛盾检测的 reviewer gate：`claim_graph_causal_consistency`。
- 这个 gate 依然比泛化语义 verifier 更窄口径：
  - 它只消费当前架构已经装配好的 DAG 证据，
  - 第一批支持的方向关系只覆盖 `causal`。
- 它复用当前已经存在的结构化图表面：
  - `connectionPaths`
  - `knowledgePointRelations`
  - `predecessorWindow`
  - `successorWindow`
- 它仍然保持保守：
  - 如果草稿没有显式因果断言，它什么也不做；
  - 如果 DAG 证据没有暴露高置信度因果方向，它什么也不做；
  - 如果草稿已经命中某条已支撑的因果方向，它不会从其他更弱表达里硬造矛盾。
- 一旦草稿把 grounded 因果方向说反，reviewer 现在会输出确定性的纠正句，而不是退回泛化摘要：
  - 英文：`X causes Y.`
  - 中文：`X导致Y。`
- `src/learning/answerReleaseReview.test.ts` 现在已经固定三类关键行为：
  - 英文因果反转必须 `revise`；
  - 因果方向正确时仍然 clean `release`；
  - 中文因果反转必须 `revise`。
- 这个 Phase 在架构上的意义很直接：
  - 现有 DAG 现在会同时参与 `causal` 与 `order` 两类 release-time contradiction control，
  - reviewer 仍然保持本地确定性 owner，而没有退化成模型驱动的泛化语义裁判。

#### 在 DAG 因果切片之上继续落地的 Phase-19 同主体属性矛盾加固

- `src/learning/answerReleaseReview.ts` 现在新增了第九个面向矛盾检测的 reviewer gate：`claim_attribute_consistency`。
- 这个 gate 依然比泛化语义 verifier 更窄口径：
  - 它只比较显式 `has` / `have` / `具有` / `带有` 属性框架里的同主体断言，
  - 它继续复用现有 lexical feature substrate，而不是再引入第二套语义运行时，
  - 当没有可比属性框架时，它继续保持保守。
- 当前实现还显式收紧了先前过宽的“属性等价”判定：
  - 仅仅 lexical overlap 很高，已经不足以把两个属性值当成等价，
  - 这会阻断 `中等热绝缘性能` vs `高热绝缘性能` 这类修饰词漂移的误放行，
  - 但 `transparent wall` vs `transparent glass wall` 这类兼容细化仍然允许 clean `release`。
- `src/learning/answerReleaseReview.test.ts` 现在已经固定三类关键行为：
  - 英文同主体属性矛盾必须 `revise`；
  - 中文同主体属性矛盾必须 `revise`；
  - 兼容属性细化仍然 clean `release`。
- 这个 Phase 在架构上的意义也很直接：它继续在不把 release policy 挪到 prompt、前端或外部框架的前提下，关闭新的确定性矛盾类型。

#### 在同主体属性切片之上继续落地的 Phase-20 组成关系矛盾加固

- `src/learning/answerReleaseReview.ts` 现在新增了第十个面向矛盾检测的 reviewer gate：`claim_composition_consistency`。
- 这个 gate 依然保持比泛化语义 verifier 更窄的边界：
  - 它只比较显式 `composed of`、`consists of`、`made of` 与 `由...组成` 组成关系，
  - 它继续复用本地 lexical feature substrate，而不是再引入第二套语义运行时，
  - 当没有可比组成框架时，它仍然保持保守。
- 当前支持的矛盾族群刻意保持具体：
  - 英文：`Water glass is composed of water and a glass cup` vs `Water glass is composed of oil and a plastic cup`，
  - 中文：`水杯由水和玻璃杯组成` vs `水杯由机油和塑料杯组成`。
- 防误报控制现在也被显式写进实现：
  - 只要显式组成关系与主体都成立，即便组件字符串漂移很大，也会被视为高置信度可比断言，
  - 组件匹配对顺序不敏感，
  - `glass cup` vs `transparent glass cup` 这类兼容细化，只要双方组件集合仍然互相覆盖，就继续允许 `release`。
- `src/learning/answerReleaseReview.test.ts` 现在已经固定三类关键行为：
  - 英文组成关系矛盾必须 `revise`；
  - 中文组成关系矛盾必须 `revise`；
  - 兼容组件顺序 / 细化仍然 clean `release`。
- 这个 Phase 在架构上的意义也很直接：它补上了截图派生 `waterglass` 定义句家族正下方的一块 reviewer 缺口：
  - 系统之前已经知道如何改写文档自述型漂移，
  - 但现在才拥有“同一主体、同一组成关系、错误组件”这一类显式 owner。

#### 在组成关系切片之上继续落地的 Phase-21 用途关系矛盾加固

- `src/learning/answerReleaseReview.ts` 现在新增了第十一个面向矛盾检测的 reviewer gate：`claim_purpose_consistency`。
- 这个 gate 继续保持比泛化语义 verifier 更窄的边界：
  - 它只比较显式 `used for`、`used to`、`designed for`、`designed to`、`serves to` 与 `用于` 用途关系，
  - 它继续复用本地 lexical feature substrate，而不是再引入第二套语义运行时，
  - 当没有可比用途框架时，它仍然保持保守。
- 当前支持的矛盾族群同样保持具体：
  - 英文：`Water glass is used for drinking water` vs `Water glass is used for storing motor oil`，
  - 中文：`水杯用于饮水` vs `水杯用于储存机油`。
- 防误报控制这次也被显式写进实现：
  - 只要显式用途关系与主体都成立，就可以进入高置信度可比断言集合，
  - `serving cold water` 这类被支撑用途细化仍然允许 `release`，
  - `is used for ...` 这类用途句现在还会主动跳过 `claim_state_consistency`，避免被错误识别成状态矛盾。
- `src/learning/answerReleaseReview.test.ts` 现在已经固定三类关键行为：
  - 英文用途关系矛盾必须 `revise`；
  - 中文用途关系矛盾必须 `revise`；
  - 支撑用途细化仍然 clean `release`。
- 这个 Phase 在架构上的意义也很直接：它继续沿着“显式关系、确定性 owner、窄口径误报控制”的路线，把 final-answer reviewer 从主题级收缩推进到更可审计的用途级纠错。

#### 在用途关系切片之上继续落地的 Phase-22 依赖/前置条件矛盾加固

- `src/learning/answerReleaseReview.ts` 现在新增了第十二个面向矛盾检测的 reviewer gate：`claim_dependency_consistency`。
- 这个 gate 继续保持比泛化语义 verifier 更窄的边界：
  - 它只比较显式 `depends on`、`requires`、`relies on`、`has prerequisite` 与 `依赖`、`需要`、`前置条件` 依赖关系，
  - 它继续复用本地 lexical feature substrate，而不是再引入第二套语义运行时，
  - 当没有可比依赖框架时，它仍然保持保守。
- 当前支持的矛盾族群同样保持具体：
  - 英文：`Response Validation depends on Baseline Measurement and Sensor Calibration` vs `Response Validation depends on Final Reporting`，
  - 中文：`响应验证依赖基线测量和传感器校准` vs `响应验证依赖最终报告`。
- 防误报控制也被显式写进实现：
  - 只要显式依赖关系与主体都成立，就可以进入高置信度可比断言集合，
  - 当草稿仍然落在被支撑的依赖集合内时，依旧允许 `release`，
  - 这个 gate 关闭的是“同一主体、同一依赖关系、错误依赖目标”这条局部缺口，而不是去重做 DAG 顺序门禁已经负责的方向约束。
- `src/learning/answerReleaseReview.test.ts` 现在已经固定三类关键行为：
  - 英文依赖关系矛盾必须 `revise`；
  - 中文依赖关系矛盾必须 `revise`；
  - 被支撑的依赖回答仍然 clean `release`。
- 这个 Phase 在架构上的意义也很直接：它把 final-answer reviewer 的确定性边界继续推进到显式依赖/前置条件关系，而没有把 owner 重新交回外部框架或泛化 verifier。

#### 在依赖关系切片之上继续落地的 Phase-23 结构化比较矛盾加固

- `src/learning/answerReleaseReview.ts` 现在新增了第十三个面向矛盾检测的 reviewer gate：`claim_structured_comparison_consistency`。
- 这个 gate 继续保持窄边界：
  - 它只比较显式 `higher than`、`lower than`、`greater than`、`less than`、`高于`、`低于` 这类比较框架，
  - 只有当两侧支撑事实属于同一属性家族且单位一致时，才进入可比集合，
  - 它继续复用本地 structured-fact 抽取与 anchor/label lexical feature，而不是再引入第二套语义 verifier。
- 当前支持的矛盾族群刻意保持具体：
  - 英文：`Water density is higher than glass density`，但支撑事实显示 `Glass density is 2500 kg/m3` 且 `Water density is 999.8 kg/m3`，
  - 中文：`水的密度高于玻璃的密度`，但同一组支撑事实显示顺序相反。
- 防误报控制也被显式写进实现：
  - 密度与温度这类 mixed-property 数值不会因为都可数值化就被强行拿来比较，
  - mixed-unit 数值不会被强行比较，
  - 已被支撑的比较方向仍然允许 `release`，
  - 当 reviewer 无法同时把比较两侧绑定到“同一属性、同一单位”的支撑事实时，会保持保守而不是猜。
- `src/learning/answerReleaseReview.test.ts` 现在已经固定四类关键行为：
  - 英文比较方向反转必须 `revise`；
  - 中文比较方向反转必须 `revise`；
  - 被支撑的比较方向仍然 clean `release`；
  - mixed-property 支撑不得制造误报。
- 英文纠正句现在还补了一层 sentence-quality 约束：在构造确定性改写句时，会保留 acronym / proper noun 这类强大小写信号，而不会被一刀切小写化。
- 运行时验证还补出一个操作层面的结论：只改 reviewer 源码还不够，跑 verifier 前必须先刷新 `dist`。第一次 runtime probe 因为编译产物陈旧而漏掉了新 gate 清单；`npm run build:mini` 之后才重新对齐。
- 这个 Phase 在架构上的意义很直接：它补上的是真实存在、且 lexical overlap、structured scalar check 与 DAG comparison-family gate 各自都不能单独覆盖的矛盾族群，即“同一属性、两个 grounded 实体、比较顺序被说反”。

#### 在结构化比较切片之上继续落地的 Phase-24 时序有效性矛盾加固

- `src/learning/answerReleaseReview.ts` 现在新增了第十四个面向矛盾检测的 reviewer gate：`claim_temporal_validity_consistency`。
- 这个 gate 继续保持窄边界：
  - 它直接消费项目现有 DAG 已装配出来的 `graphContext.temporalValidity`，
  - 它关心的是“带时序警告的证据，是否被当成当前结论公开放行”，
  - 它不去重做 retrieval、planner 或独立图推理 owner 已经负责的工作。
- 当前支持的矛盾族群刻意保持具体：
  - 英文：grounded evidence 已带 temporal warning，但草稿仍直接发布 current-tense answer，
  - 中文：命中的 DAG 证据已经带时序警告，但草稿仍把它公开表述成“当前结论”。
- 防误报控制也被显式写进实现：
  - 只要公开回答已经显式带时间限定，例如 `as of`、`historically`、`截至`、`此前` 或具体年份，仍然允许 `release`，
  - 仅有 `supersedes` 血缘而当前 anchor 仍然有效时，不会单独阻断 release，
  - 如果 DAG 侧没有激活 `allPointsValid === false`，这个 gate 什么也不做。
- `src/learning/answerReleaseReview.test.ts` 现在已经固定三类关键行为：
  - 带时序警告的 current-tense 英文草稿必须 `revise`；
  - 带时序警告的 current-tense 中文草稿必须 `revise`；
  - 已显式加时间限定的回答必须继续 clean `release`，而仅有 supersedes 血缘不得制造误报。
- 这个 Phase 在架构上的意义很直接：它把 DAG 时序警告从“解释层 metadata”推进成最终 release contract 的一部分，同时仍然把正确性 owner 留在本地确定性 reviewer，而不是再引入第二套 verifier runtime。

### 为什么先前那些框架方案不够

已分析的 `ref/` 参考：

- `ref/dspy` `4987601`
- `ref/guidance` `21b1d90`
- `ref/semantic-kernel` `13f812b`
- `ref/langchain` `847312e`
- `ref/litellm` `cf2db41`
- `ref/ahadiff` `897768c`

本次复审明确查看过的本地参考文件：

- `ref/dspy/dspy/evaluate/evaluate.py`
- `ref/dspy/dspy/teleprompt/bootstrap.py`
- `ref/guidance/guidance/_grammar.py`
- `ref/langchain/libs/core/langchain_core/language_models/base.py`
- `ref/langchain/libs/core/langchain_core/prompts/chat.py`
- `ref/semantic-kernel/python/semantic_kernel/prompt_template/prompt_template_config.py`
- `ref/semantic-kernel/python/samples/concepts/agents/azure_ai_agent/azure_ai_agent_as_kernel_function.py`
- `ref/litellm/cookbook/litellm_router/load_test_router.py`

关键结论：

- **DSPy** 适合做 typed LM subprogram、compile/optimizer 回路与 evaluation harness，但前提仍然是你先把 runtime invariants 明确成 gate。
- **Guidance** 适合约束结构化输出、regex/CFG 风格控制与输出契约，但“输出是 JSON”不等于“公开回答值得发布”。
- **Semantic Kernel** 适合 orchestration、plugin 与 agent 过程边界；它当前朝 Microsoft Agent Framework 收敛这一点，反而进一步证明它是 orchestration surface，而不是本地 verifier。
- **LangChain Core** 适合 orchestration 与 observability/eval 表面，但仍然不能替代 evidence-policy owner。
- **LiteLLM** 管的是 provider routing、proxy/gateway 控制与模型切换，不管答案正确性；它是 gateway，不是 release-review owner。
- **AhaDiff** 最有启发，因为它把公开结论、证据、验证状态分层；本地 reviewer 现在沿着这个方向实现，但不引入它的运行时依赖。
- graph-focus payload 这次修复又在前端侧重复证明了同一个结论：即便别处存在 framework-assisted prompting，本地 evidence-path invariant 仍然需要本地 owner。

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

1. 先基于这份显式 alias/scope 回归语料，把当前 lexical + query-intent + structured-fact + structured-comparison + attribute + containment + composition + purpose + dependency + subject + state + polarity + graph-causal + graph-order + graph-comparison + temporal-validity gate 栈之外的更深矛盾检测落地，但前提仍然是控制好 false positive，不把 reviewer 变成不稳定猜测器。
2. 继续把语料从当前 4 个用例扩展到更多真实 cross-scope、compact-alias 与同义表达失败案例，再决定是否继续扩大 reviewer policy。
3. 把当前 block-level markdown source mapping 与 `source_line_provenance` -> source-authenticated fragment projection -> `line_window` -> `snippet_fallback` 的 graph-focus 栈视为已落地基线；后续重点转到基于显式 offset 或更丰富 AST provenance 的重复片段去歧义。
4. compare-ready drilldown 继续坚持复用现有 reviewer telemetry path，不再平行新增第二个 audit owner。
5. 继续缩减 `KnowledgeLearningPlatform.ts` 与 `agent_workspace.js` 的 owner 压力，但前提仍然是“新模块拥有真实不变量”。

### 五点总结

1. 本轮切片起点真正缺失的不是图检索，而是最终公开回答的 release review；复审现在已经确认这个 owner 已落地。
2. 正确 owner 是本地确定性 reviewer layer，不是再引入一层 prompt framework。
3. 项目现有 DAG 继续作为证据底座，并且已经开始同时参与 release-time 的因果、顺序与对比分支纠错；graph-focus 现在也已经具备 block-level provenance 加上 `source_line_provenance` / source-authenticated fragment projection / `line_window` / `snippet_fallback` 的高亮基线，剩余缺口已经收窄到同一认证 block 内重复片段的去歧义。
4. `waterglass` 截图已经被编码进正式运行时验收门禁，而 reviewer 栈现在也会在 release 前同时拦截“同一主体、同一显式属性框架、但属性值漂移”的草稿、“同一主体、同一显式容纳关系、但内容物漂移”的草稿、“同一主体、同一显式组成关系、但组件漂移”的草稿、“同一主体、同一显式依赖/前置条件关系、但依赖目标漂移”的草稿、与 DAG 因果方向相反的草稿，以及把带时序警告的 DAG 证据直接发布成当前结论的草稿。
5. 本轮落地保持向前兼容，同时实质提升了 agent 最终回复的鲁棒性；后续重点已经转移到更广的矛盾检测，而不是更换 reviewer owner。
