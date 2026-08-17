# 2026-05-12 v1.7.0 - HEAD Realignment Implementation Plan

## English Document

### 2026-06-21 Agent Knowledge Workspace Runtime Reuse Plan

#### Objective

Close the remaining Knowledge Workspace graph-action defects by reusing the project's existing DAG-backed runtimes instead of maintaining separate preview logic.

#### Current code truth

- `Related Focus` now uses the existing graph-view Focus-mode snapshot/runtime path from the main graph surface and hides relation-edge/debug detail unless Developer Mode is enabled.
- `Learning Path` now mounts the existing Path workspace/runtime (`path-container`, path sidebars, and `path_app.js`) into the docked right pane instead of rendering a fake prerequisite/anchor/next DOM preview.
- Learning-path target selection is reconciled against the real DAG source graph by stable node ID, human label, and source basename. The worker receives the real graph node ID; the UI displays the resolved label such as `water glass`.
- `agent_workspace.js` now propagates `sourcePath` from top-level knowledge-point fields, matched spans, and citation payloads so graph target resolution has a durable source-path signal.
- `path_app.js` now defers semantic live-region refreshes when throttled, preventing stale `focus none` / `0 of 0 nodes` announcements after a valid runtime path is computed.
- `scripts/verify-agent-workspace-browser.js` now seeds a real DAG neighborhood around `water glass` and asserts the mounted Path runtime has nonzero nodes, visible `water glass` semantics, no `atom_h` leakage, no `focus none`, and no `0 of 0 nodes completed`.
- `src/agent_workspace.frontend.test.ts` pins the important invariant: runtime configuration may use the DAG ID (`atom_h` in the fixture), but the right-pane UI must show the node label (`water glass`) and not expose the internal ID.
- The matched-file help affordance remains a compact hover/focus question-mark control; the left hit area remains scrollable and action controls stay reachable.
- Compatibility is additive: no existing response shape is made mandatory, and the legacy `performance.deepDebug` setting remains accepted as the Developer Mode compatibility key.

#### Execution order

1. Keep graph target reconciliation in the workspace/path boundary, not in display strings.
2. Preserve the Path runtime as the single owner for diffusion/path semantics; do not reintroduce a handcrafted preview graph.
3. Keep Focus default output user-facing and sparse; expose relation lists and backend diagnostics only behind Developer Mode.
4. Keep strict browser verification as the executable acceptance surface for the reported screenshots, especially `water glass.md`.
5. Extend only invariant-owning modules; avoid pass-through adapters that merely forward graph payloads.

#### Acceptance criteria

1. Clicking `Learning Path` mounts the real Path workspace and computes a nonempty path from the selected DAG node.
2. The Path worker receives a valid graph node ID while all visible right-pane labels prefer human node names.
3. Clicking `Related Focus` shows the selected node's Focus-mode graph state without default backend/relation debug lists.
4. The matched-file list scrolls vertically, exposes `water glass.md`, and keeps `Learning Path` / `Related Focus` buttons interactable.
5. The strict browser verifier fails if `atom_h`, `focus none`, or `0 of 0 nodes` reappear in the user-facing path pane.

### 2026-06-18 Final Reply Review Robustness Implementation Plan

#### Objective

Add a deterministic final-answer release-review layer between answer synthesis and public release so the agent can revise or abstain before leaking unsupported or diagnostic-heavy text into the main answer surface.

#### Current code truth

- Retrieval normalization for compact/spaced `waterglass` aliases is already fixed at the planner/retrieval boundary.
- The project already has graph-conditioned context assembly in `src/learning/graphContextAssembler.ts`, so the missing owner is not graph retrieval but final public-answer review.
- The landed slice adds `src/learning/answerReleaseReview.ts` as a first-class owner for `release` / `revise` / `abstain`.
- `src/learning/types.ts` now carries additive `AnswerReleaseReview` contracts on the response, trace, and `KnowledgeRun`.
- `conversationComposer.ts` now drafts the answer and then delegates the public release decision to the reviewer instead of releasing the draft directly.
- The reviewer now also enforces `claim_grounding_alignment`, so grounded evidence can still force a revision when the draft drifts away from its own citations/knowledge points.
- The reviewer now also enforces `claim_structured_consistency`, a deterministic structured-fact gate that revises grounded drafts when numeric or year facts conflict with citation/knowledge-point support even though topical lexical overlap still looks acceptable.
- The reviewer now also enforces `claim_structured_comparison_consistency`, a deterministic structured-comparison gate that revises explicit `higher/lower`, `greater/less`, and `高于/低于` inversions when the support set contains same-property, same-unit facts proving the opposite ordering.
- The reviewer now also enforces `claim_attribute_consistency`, a deterministic same-subject attribute gate that revises grounded drafts when explicit `has` / `have` / `具有` claims keep the same subject but swap the supported attribute, such as `moderate thermal insulation` to `high thermal insulation`.
- The reviewer now also enforces `claim_containment_consistency`, a deterministic content/containment gate that revises grounded drafts when the same grounded subject keeps an explicit containment relation but swaps the contained material, such as `contains water` to `contains oil`.
- The reviewer now also enforces `claim_composition_consistency`, a deterministic composition gate that revises grounded drafts when the same grounded subject keeps an explicit `composed of` / `由...组成` relation but swaps the supported components, such as `water and a glass cup` to `oil and a plastic cup`.
- The reviewer now also enforces `claim_purpose_consistency`, a deterministic same-subject purpose gate that revises grounded drafts when the same grounded subject keeps an explicit `used for` / `用于` relation but swaps the supported use, such as `drinking water` to `storing motor oil`.
- The reviewer now also enforces `claim_dependency_consistency`, a deterministic same-subject dependency/prerequisite gate that revises grounded drafts when the same grounded subject keeps an explicit `depends on` / `requires` / `依赖` / `前置条件` relation but swaps the supported dependency, such as `Baseline Measurement and Sensor Calibration` to `Final Reporting`.
- The reviewer now also enforces `claim_location_consistency`, a deterministic same-subject location gate that revises grounded drafts when the same grounded subject keeps an explicit `located in` / `位于` frame but swaps the supported location, such as `main chamber` to `auxiliary chamber`.
- The reviewer now also enforces `claim_subject_consistency`, a deterministic subject-tail gate that revises grounded drafts when they keep a supported fact tail but silently swap the grounded subject, such as `Water density` to `Glass density`.
- The reviewer now also enforces `claim_state_consistency`, a deterministic same-subject state gate that revises grounded drafts when definition/copula-style state claims such as `open system` vs `closed system` conflict with support in English or Chinese.
- Locative predicates such as `located in` / `位于` are now explicitly excluded from `claim_state_consistency` frame extraction, so location claims are owned by the location slice instead of surfacing as false-positive state contradictions.
- The reviewer now also enforces `query_intent_alignment`, a deterministic definition-intent gate that revises `what is` / `什么是` answers when the draft only repeats document framing even though grounded definition sentences are available.
- The reviewer now also enforces `claim_polarity_consistency`, a deterministic polarity gate that revises grounded drafts when they explicitly reverse supported positive/negative claims even though topical lexical overlap still looks acceptable.
- The reviewer now also enforces `claim_graph_causal_consistency`, a deterministic DAG-causal gate that uses `connectionPaths`, `knowledgePointRelations`, `predecessorWindow`, and `successorWindow` to catch reversed `causal` direction and rewrite it into a grounded correction sentence.
- The reviewer now also enforces `claim_graph_order_consistency`, a deterministic DAG-order gate that uses `connectionPaths`, `knowledgePointRelations`, `predecessorWindow`, and `successorWindow` to catch reversed `prerequisite` or `sequence` claims and rewrite them into a grounded correction sentence.
- The reviewer now also enforces `claim_graph_comparison_consistency`, a deterministic DAG-comparison gate that uses the assembled graph evidence to catch `contrast` vs `analogy` reversals for title pairs where the graph supports only one comparison family.
- The reviewer now also enforces `claim_temporal_validity_consistency`, a deterministic DAG-temporal release gate that consumes `graphContext.temporalValidity`; when grounded evidence is temporally flagged, unqualified current-tense drafts are revised, explicitly time-qualified drafts may still release, and supersedes-only lineage does not become a false-positive blocker by itself.
- Cross-language abstention hygiene is now explicit: scoped Chinese misses no longer fall back to English diagnostic-heavy abstentions.
- `KnowledgeLearningPlatform.ts` now persists the review decision into response payloads, traces, and workflow artifacts.
- Operator-facing inspection now surfaces reviewer state without widening the public answer area: `src/frontend/agent_workspace.js` maps sanitized `answerReleaseReview` payloads, and `src/frontend/workspace_panes.js` renders release-review details in `knowledge_run` detail/history cards.
- `WorkspaceExportBundle.ts` now projects compact reviewer summaries into `runtime.knowledgeRunReports[*].answerReleaseReview`, so export/replay surfaces can audit release decisions without duplicating full answer text.
- `WorkspaceExportBundle.ts` now also derives a durable aggregate reviewer audit at `runtime.knowledgeRunAnswerReleaseAuditSummary`, covering reviewed/unreviewed counts, decision buckets, revised runs, failed-gate counts, leak counts, and latest reviewed timestamp.
- The aggregate reviewer audit now also carries `reviewTrend` window summaries and `failedGateAging` entries, both derived from the same reviewer telemetry path rather than a second audit owner.
- The operator history surface now renders the same longer-horizon release-audit shape inside `knowledge_run` history, including review-trend windows and gate-aging summaries, so multi-run reviewer drift is visible without widening the main answer area or inventing a second telemetry path.
- That same aggregate audit path now also carries compare-ready drilldowns: metric shifts between recent/prior reviewed windows, per-gate window shifts, and the latest reviewed-pair delta. The knowledge-run compare card now surfaces answer-release deltas on top of the existing quality/graph comparison.
- `scripts/verify-knowledge-workspace-runtime.js` now treats reviewer presence and public-answer hygiene as runtime acceptance gates for the screenshot-backed `waterglass` case, including rejection of the meta-documentary fragment `本技术文档旨在`.
- A shared deterministic alias/scope regression corpus now lives in `src/learning/KnowledgeWorkspaceConversationRegression.ts`; it covers the screenshot-derived compact/spaced `waterglass` cases plus cross-scope recovery cases under `financial`, and both Jest and runtime verification consume the same dataset.
- That shared corpus now distinguishes stable public-answer invariants from corpus-specific intermediate draft behavior:
  - the in-memory Jest fixture accepts either `release` or `revise` when the final answer is already grounded and contracted,
  - the real screenshot-derived runtime case `waterglass_explicit_scope_compact_zh` still requires `revise` and failed gate `query_intent_alignment`.
- That corpus exposed a soft-miss retrieval bug in `KnowledgeLearningPlatform.ts`: planner scope recovery previously triggered only on zero-result misses, and now also triggers when reranked in-scope noise survives but none of the surviving items belong to planner title-hit documents.
- `src/learning/answerReleaseReview.test.ts` now pins deterministic contradiction cases for numeric conflict, year conflict, and a multi-value support case that must not trigger a false positive.
- `src/learning/answerReleaseReview.test.ts` now also pins deterministic structured-comparison cases for English inversion, Chinese inversion, supported comparison release, and mixed-property false-positive resistance.
- `src/learning/answerReleaseReview.test.ts` now also pins deterministic polarity-conflict cases for English reversal, Chinese reversal, and an unrelated-negative-support case that must not trigger a false positive.
- A 2026-06-19 runtime recheck also confirmed an operational constraint: reviewer-gate changes must be verified against freshly built `dist` output. A stale compiled build temporarily hid the new gate inventory until `npm run build:mini` refreshed the runtime JS.
- The right-pane file-preview/highlight path remains architecturally separate from final-answer review, but the graph-focus contract is now stronger than payload hardening alone: `src/frontend/markdown_runtime.js` annotates rendered markdown blocks with source-line metadata, `src/frontend/workspace_panes.js` prefers `source_line_provenance` when rendered-node ranges overlap trusted spans, then inside the selected authenticated block prefers snippet-sized source-fragment projection before falling back to `line_window`, `snippet_fallback`, and broad text search, while additive diagnostics expose both the winning node-highlight strategy, inline-highlight strategy, and provenance coverage.
- `src/agent_workspace.frontend.test.ts` now pins repeated-snippet ambiguity, unusable-line-window fallback, single-line over-highlight, and nested-inline fragment-projection cases, so right-pane evidence preview no longer depends on one fragile snippet-only heuristic.
- A 2026-06-19 re-audit confirms that the missing-owner phase is already closed. The active gap has moved to broader claim-vs-citation / claim-vs-evidence contradiction coverage beyond the current lexical + query-intent + structured + structured-comparison + attribute + containment + composition + purpose + dependency + location + subject + state + polarity + graph-causal + graph-order + graph-comparison + temporal-validity stack, and to repeated-fragment disambiguation inside one authenticated rendered block via explicit offsets or richer AST provenance, not prompt-framework adoption.

#### Next execution order

1. Keep the reviewer deterministic and narrowly scoped to release invariants; do not let prompt templates reclaim ownership of release policy.
2. Use the explicit alias/scope regression corpus and the current query-intent + structured-fact + structured-comparison + attribute + containment + composition + purpose + dependency + location + subject + state + polarity + graph-causal + graph-order + graph-comparison + temporal-validity reviewer slices to broaden contradiction coverage beyond lexical grounding without widening false positives; keep the structured-comparison slice conservative to same-property, same-unit evidence pairs.
3. Treat the current block-level markdown source mapping plus `source_line_provenance` -> source-fragment projection -> `line_window` -> `snippet_fallback` -> inline-fragment-highlight stack as the implemented baseline; the next evidence-preview step is repeated-fragment disambiguation through explicit offsets or richer AST provenance without moving release policy into the frontend.
4. Keep extending the shared corpus with more real cross-scope, compact-alias, and synonym failures while preserving deterministic expectations in both Jest and runtime verification.
5. Continue owner reduction only when the new owner hides real decisions or invariants.

#### Acceptance criteria

1. Unsupported draft answers do not leak internal diagnostics such as `No scoped knowledge points matched` or `retrieval_candidates_below_threshold` into the public answer.
2. Grounded drafts with conflicting structured numeric/year facts are revised before release instead of slipping through on lexical overlap alone.
3. Grounded drafts that explicitly invert supported same-property comparisons are revised before release instead of leaking ordering drift such as `Water density is higher than glass density` when the support proves the opposite ordering.
4. Grounded drafts that keep the same grounded subject and explicit containment relation but swap the contained material are revised before release instead of leaking content drift such as `contains water` -> `contains oil`.
5. Grounded drafts that keep the same grounded subject and explicit `composed of` / `由...组成` relation but swap the supported components are revised before release instead of leaking composition drift such as `water and a glass cup` -> `oil and a plastic cup`.
6. Grounded drafts that keep the same grounded subject and explicit `depends on` / `requires` / `依赖` / `前置条件` relation but swap the supported dependency are revised before release instead of leaking dependency/prerequisite drift.
7. Grounded drafts that keep the same grounded subject and explicit `located in` / `位于` relation but swap the supported location are revised before release instead of leaking location drift such as `main chamber` -> `auxiliary chamber`, and locative claims must not mis-trigger the state gate.
8. Grounded drafts that keep a supported fact tail but swap the grounded subject are revised before release instead of leaking entity/subject drift.
9. Grounded drafts that assert the wrong same-subject state are revised before release instead of leaking contradictions such as `open system` vs `closed system`.
10. Grounded drafts that explicitly reverse supported polarity are revised before release instead of slipping through on lexical overlap alone.
11. Grounded drafts that reverse DAG-backed cause/effect direction are revised before release instead of leaking inverted causal claims.
12. Grounded drafts that reverse `prerequisite` or `sequence` direction against the assembled DAG are revised before release instead of leaking inverted order claims.
13. Grounded drafts that restate a DAG-backed single-family comparison pair (`contrast` only or `analogy` only) as the opposite comparison family are revised before release instead of leaking comparison-branch drift.
14. Grounded drafts that present temporally flagged DAG evidence as a current answer are revised before release unless the public answer stays explicitly time-qualified; supersedes-only lineage must not trigger this gate by itself.
15. `AgentConversationResponse`, trace, and `KnowledgeRun` all retain additive `answerReleaseReview` state.
16. Operator inspection surfaces render reviewer decision, failed gates, and original/public answer deltas without widening the primary answer area.
17. Workspace export knowledge-run reports carry compact reviewer summaries for `release` / `revise` flows and stay backward-compatible when review data is absent.
18. Workspace export also carries additive aggregate reviewer telemetry at `runtime.knowledgeRunAnswerReleaseAuditSummary`, including review-trend windows, gate-aging summaries, and compare-ready drilldowns; the operator history card renders the same audit shape, and the compare card exposes answer-release deltas without widening the public answer area.
19. Right-pane file-hit preview resolves source markdown and matched-span highlights from stable payload fields, including citation-backed paths/snippets when top-level hit fields are incomplete; rendered markdown blocks retain source-line metadata, `source_line_provenance` wins when rendered-node ranges overlap trusted spans, authenticated blocks prefer snippet-sized source-fragment projection for inline highlight, and the system falls back to `line_window` / `snippet_fallback` / text search while preserving operator diagnostics.
20. The shared alias/scope Jest corpus accepts `release` or `revise` when the final public answer is already grounded and contracted, while the screenshot-derived runtime case `waterglass_explicit_scope_compact_zh` still requires `revise` with failed gate `query_intent_alignment`.
21. Runtime verification for reviewer-gate changes is run against fresh compiled output, so `npm run build:mini` precedes `npm run verify:knowledge-workspace:runtime` whenever the reviewer surface changes.
22. `npm run verify:knowledge-workspace:runtime` passes the shared alias/scope regression corpus, including the screenshot-derived `waterglass` compact/spaced pair and the `financial` cross-scope recovery pair, and confirms reviewer/public-answer parity.
23. Existing `assistantMessage`, `answer`, `assistantBlocks`, and downstream clients remain backward-compatible.

### 2026-06-17 Agent Knowledge DAG Implementation Plan

#### Objective

Turn the clarified DAG requirement into an implementation sequence that uses the existing learning graph as an answer-planning substrate while keeping the public answer focused and the runtime compatible.

#### Current code truth

- The existing graph substrate is local to the project: `KnowledgeAtom`, `RelationEdge`, `TemporalEdge`, evidence spans, store ops, and `findPath`.
- The current slice now has a first-class graph-conditioned context assembler in `src/learning/graphContextAssembler.ts`; it selects the anchor, reorders support nodes, preserves explicit `connectionPaths`, and adds bounded predecessor/successor windows plus graph diagnostics before answer synthesis.
- Persistence now preserves still-valid store-side relation/temporal edges during auto-save snapshot rebuilds, which prevents read-side query/conversation flows from discarding externally enriched DAG structure before `connectionPaths` are assembled.
- The retrieval path now uses bounded graph-aware ranking signals instead of leaning mainly on relation degree, but it still needs broader calibration against real regressions.
- Retrieval-side graph intent detection now includes Chinese compare/how-to/explain markers, and direct compare branches receive an explicit structural promotion over reference-only notes.
- The `graph_comparison_branch` quality gate is now calibrated against false positives: compare intent no longer passes on reference-only support without actual contrast/analogy or multi-branch structure.
- Operator-facing diagnostics now exist in three concrete surfaces: graph-focus path-fallback diagnostics in the right pane, graph-context plus graph-diagnostics inspection inside durable `knowledge_run` cards, and compact graph telemetry inside knowledge-run history/compare review flows.
- Interesting graph-focus diagnostics now also cross the runtime boundary: the agent workspace persists them into session state, later conversation/study-session writes preserve that history, and workspace export derives durable `runtime.graphFocusReports`.
- Prompt-framework research should guide contracts and evaluation, not pull Python frameworks into the app runtime.
- A 2026-06-18 screenshot-backed runtime regression showed that planner alias normalization and retrieval scoring had drifted apart for compact mixed-language queries such as `什么是waterglass?`; the current slice fixes this by carrying planner-derived query variants into retrieval and by promoting the compact/spaced `waterglass` pair into the runtime verifier.
- The runtime verifier no longer hardcodes only the `waterglass` pair: the default no-`--query` path now loads the shared alias/scope regression corpus, and the matching Jest suite runs the same expectations against deliberate `financial` noise documents.
- That corpus exposed a second retrieval-contract bug: planner scope recovery must react to soft misses, not only to zero-result misses, so recovery now triggers whenever reranked items do not contain any planner-compatible title-hit document.

#### Next execution order

1. Keep the new assembler surface additive and backward-compatible.
2. Keep planner and retrieval query normalization under one contract so document-title hits and evidence-bearing retrieval cannot drift apart again.
3. Keep graph-aware ranking bounded and calibrate it against regression cases instead of drifting back toward degree-driven hubs.
4. Calibrate the new replay/export-oriented operator surfaces now that `knowledge_run` history/compare telemetry is exported through `runtime.knowledgeRunReports` and graph-focus diagnostics are exported through `runtime.graphFocusReports`.
5. Keep graph/debug/evidence detail in evidence/export surfaces, not in the public answer.
6. Calibrate the new graph-specific answer quality gates against more regression cases and operator evidence.
7. Continue owner reduction only when the new module owns real decisions, state, or invariants; avoid generic panel-state pass-through endpoints.

#### Acceptance criteria

1. `assistantMessage` and existing conversation clients remain valid.
2. Graph ops failure falls back to current retrieval-grounded behavior with diagnostics.
3. Right-pane file hits keep source markdown and matched-span highlight behavior.
4. No new broad prompt-framework dependency is introduced into the Tauri/Node runtime.
5. `npm run verify:knowledge-workspace:runtime` passes the default alias/scope regression corpus for both `什么是waterglass?` / `什么是water glass` and the `financial`-scope recovery pair `what is water glass?` / `what is waterglass?`, without zero-citation results or `retrieval_candidates_below_threshold`.

### 2026-06-10 Knowledge Workspace and DAG Implementation Plan

#### Objective

Extend the current mainline alignment with a Knowledge Workspace and DAG-specific reading of the codebase.

#### Current code truth

- The current branch already has structured grounded conversation, grouped knowledge points, durable `flashcard_batch` / `knowledge_run` artifacts, and workflow-artifact review follow-up.
- The current DAG-backed learning substrate already exists in code through `KnowledgeAtom`, `RelationEdge`, `TemporalEdge`, path queries, and prerequisite-driven learning flows.
- The former missing layer, graph-conditioned context assembly between retrieval and answer synthesis, is now implemented as `src/learning/graphContextAssembler.ts`.
- The answer-surface contraction slice is now implemented at the composer/frontend boundary; the remaining product-surface gap is right-pane-first knowledge reading and durable evidence review.

#### Next execution order

1. Keep the new 2026-06-10 Knowledge Workspace and DAG alignment note synchronized across active docs.
2. Preserve the contracted visible answer contract while routing supporting graph/evidence data to secondary surfaces.
3. Converge left-side knowledge hits on a right-pane-first reading model.
4. Treat `knowledge_run` and `flashcard_batch` as the first durable evidence surfaces.
5. Broaden right-pane/operator diagnostics and calibrate the new graph quality gates on top of the assembler and ranking boundaries.
6. Continue ownership reduction across the major server and frontend hosts.

### 2026-06-06 Mainline Architecture Alignment Plan

#### Objective

Land the current code-vs-plan assessment into the active implementation plan while keeping the repo on `main` and preserving backward compatibility. The initial alignment was documentation-only; later P1 evidence slices may change release verifier tooling, but must not change public runtime APIs.

#### Current code truth

- Scoped retrieval is now code-backed: `KnowledgeQueryRequest.scope`, `KnowledgeCorpusScope`, workspace readiness, miss diagnostics, active-target hydration, and workspace/export substrate are present.
- Grounded conversation is operational: `AgentConversationResponse` carries `answer`, citations, memory actions, trace, and optional `assistantBlocks`; legacy `assistantMessage` remains valid.
- Program A-F substrate is implemented in `src/resources/`, `src/indexing/`, `src/workspace/`, `src/session/`, `src/workflows/`, `src/memory/`, and `src/export/`.
- Platform/export boundaries are explicit through `PlatformCapabilities`, `RenderMaterializer`, render routes, and deterministic workspace export bundles.
- graphdb/sqlite and ANN/external connector paths are operational baselines, but production closure still requires soak, repeated host evidence, workload thresholds, recall/latency calibration, and strict rollout proof.
- Architecture reduction remains behind target: `src/server.ts` and `src/learning/KnowledgeLearningPlatform.ts` remain the main implementation gravity wells.

#### Execution order from current `main`

1. **P0: Documentation truth synchronization**
   - Keep the 2026-06-06 solution note, development progress dashboards, task docs, TODO docs, README, and interface docs aligned.
   - Do not convert operational-baseline wording into production-closed wording without release-grade evidence.
2. **P1: Release-grade graphdb/ANN closure**
   - Convert sqlite soak verification into repeated evidence.
   - Tighten graphdb connector health/budget thresholds.
   - Complete ANN recall/latency calibration before promoting Phase-2 diagnostics to release gates.
3. **P2: `server.ts` ownership reduction**
   - Extract turn-cache, alert-trend, runbook bridge, rollout-profile, and connector helper logic behind explicit modules.
   - Preserve endpoint names and response compatibility while moving ownership.
   - `src/routes/runtimeRunbookRouteOps.ts` now owns runtime runbook modular-route operation assembly; remaining P2 work should keep peeling route-layer composition out of `server.ts` without introducing pass-through facades around stateful logic.
   - Apply the same ownership-reduction rule to oversized learning-runtime helpers when they are pure data composers; agent conversation reply composition is now a candidate/module boundary rather than permanent KLP inline logic.
4. **P3: Learning-platform domain extraction**
   - Continue extracting ingest/query/conversation/mastery/quality/tutor/memory ownership only when the new owner hides state or enforces invariants.
   - Avoid pass-through facades around `KnowledgeLearningPlatform.ts`.
5. **P4: Agent workspace contract hardening**
   - Keep stream-first + sync fallback + replay compatibility.
   - Expand typed `assistantBlocks` coverage only through optional payloads and parity-tested capabilities.
   - Treat evidence rendering and evidence persistence as separate concerns: the current graph-focus pane now renders source markdown with in-place highlights, but future work still needs a durable evidence/claim surface rather than turn-local snippets only.
6. **P5: Platform/export compatibility**
   - Keep Godot/mobile PNG-first materialization and export profile semantics explicit.
   - Keep core retrieval/synthesis free of shell-specific branches.

#### Acceptance criteria

1. All active planning docs point to the same 2026-06-06 status and next-step sequence.
2. No public runtime API is changed by the alignment and release-evidence slices.
3. Future code work can start from a clear priority order: release-grade foundation closure first, then ownership reduction, then richer agent output.
4. Worktree is clean after the documentation commit.

### 2026-06-06 P1 Foundation Release Evidence Freshness and History Slice

#### Objective

Promote the sqlite and ANN release evidence paths from separate report producers into a single release-facing freshness check and a stricter repeated-evidence audit, without re-running heavy runtime verification inside the audit command and without claiming production closure.

#### Implemented code path

- Added `scripts/verify-foundation-release-evidence.js`.
- Added `npm run verify:foundation:release-evidence`.
- Added `npm run verify:foundation:release-evidence:strict`, which runs the same verifier with `--min-report-count 3`.
- Added `npm run verify:foundation:release-evidence:multi-host`, which runs the same verifier with `--min-report-count 3 --min-host-count 2`.
- Added `src/foundation.release.evidence.contract.test.ts` and included it in `test:migration`.
- Added `foundation_release_evidence_freshness` to `getFoundationReadiness().mandatoryChecks`.
- Added `foundation_release_evidence_history` to `getFoundationReadiness().mandatoryChecks`, pointing to `npm run verify:foundation:release-evidence:strict` while preserving the existing freshness gate.
- Added CLI/env control for repeated evidence through `--min-report-count` and `NOTE_CONNECTION_FOUNDATION_RELEASE_EVIDENCE_MIN_REPORT_COUNT`.
- Added CLI/env control for host-diversity evidence through `--min-host-count` and `NOTE_CONNECTION_FOUNDATION_RELEASE_EVIDENCE_MIN_HOST_COUNT`.
- Added timestamped history scanning for `foundation-sqlite-runtime-report-*.json` and `foundation-ann-runtime-report-*.json`.

#### Evidence contract

The default freshness verifier reads:

- `output/verification/foundation-sqlite-runtime/foundation-sqlite-runtime-report-latest.json`
- `output/verification/foundation-ann-runtime/foundation-ann-runtime-report-latest.json`

It validates:

- bounded freshness through `NOTE_CONNECTION_FOUNDATION_RELEASE_EVIDENCE_MAX_AGE_HOURS`,
- sqlite `suiteKind: soak`, heavy profile, `dist_node_runtime`, `packaged_sidecar`, positive soak cycles, passing soak gates, and query samples,
- ANN `suiteKind: matrix`, `releaseGatesEnabled: true`, `smoke` / `medium` / `heavy`, both runtime modes, passing release gates, query samples, and expected recall at or above the report threshold.

The default command remains backward-compatible: it requires at least 1 valid fresh release-contract report and 1 host key per component, and ignores stale or non-release historical files as warnings. The strict command requires at least 3 valid fresh reports per component before it passes. The opt-in multi-host command additionally requires at least 2 distinct host keys per component, derived from explicit report host identifiers when present and otherwise from `platform/arch`.

#### Current evidence position

The current Windows host now has a passing strict repeated-evidence audit:

- sqlite release report refreshed at `2026-06-06T03:17:45.083Z`,
- ANN release-gate report refreshed at `2026-06-06T03:19:22.368Z`,
- `verify:foundation:release-evidence:strict` checked at `2026-06-06T03:21:04.144Z` with sqlite `3/3` and ANN `3/3`.

This closes the current-host repeated-evidence gate only. Multi-host audit tooling is now executable, but current Windows evidence is still single-host evidence. This does not close multi-host evidence, ANN threshold convergence, connector budget calibration, or production closure.

#### Remaining P1 movement

This slice makes release evidence easier to audit and gives release runbooks strict repeated-evidence and opt-in multi-host gates. Foundation readiness surfaces both the default freshness audit and the strict history audit as mandatory checks. The current Windows host now satisfies the strict repeated-evidence gate, so the next P1 work shifts to collecting real multi-host evidence, ANN threshold convergence, connector budget calibration, and then Phase-2 gate promotion only after graphdb/ANN baselines are release-grade.

### 2026-05-27 Workflow Truth-Sync and Next-Step Realignment

#### Objective

Bring the implementation plan back in line with `main` reality at three levels:

- the repo-owned GitHub workflow baseline is already `actions/setup-node@v4` + `node-version: "24"`,
- the old `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` compatibility override has already been removed from the workflows,
- but `scripts/verify-fixrisk-issues.js` was still verifying the removed override instead of the current baseline, which made `FR-010` fail even though the workflow files were already migrated.

#### Root cause and correction

- Prior expectation:
  - FR-010 closure was tied to a transition-era compatibility override.
- Current code truth:
  - workflow YAMLs are already on the no-override Node 24 baseline,
  - residual Node 20 deprecation annotations are coming from marketplace action runtimes such as artifact/release helpers, not from repo-owned `setup-node` configuration.
- This slice corrects the repo-owned gate:
  - `scripts/verify-fixrisk-issues.js` now validates `actions/setup-node@v4`,
  - it now requires explicit `node-version: "24"` where `setup-node` is used,
  - and it now enforces removal of the obsolete `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` override instead of requiring it.

#### Next execution order from current HEAD

1. **P0: keep workflow truth, verifier truth, and docs truth aligned**
   - avoid reintroducing transition-only assumptions into CI gates,
   - keep fixrisk closure criteria tied to repo-controlled reality.
2. **P1: release-grade graph/store hardening**
   - extend the current operational `graphdb/sqlite` baseline from restart/workload proof into soak and performance closure,
   - keep a dedicated host-level soak gate (`verify:foundation:sqlite-runtime:soak`) so release-grade evidence is not diluted into the lighter matrix proof.
3. **P2: release-grade ANN calibration**
   - keep the `external_http` connector green under workload proof, then close recall/latency threshold calibration.
4. **P3: Tauri-first reply/render surface expansion**
   - keep the shared Reader-derived runtime as the Tauri baseline,
   - move `assistantBlocks` from a thin wrapper around the legacy answer string into a real reply-organization layer,
   - continue widening typed block usage without breaking compatibility.
5. **P4: tutor routing and orchestration hardening**
   - move from active local-first routing toward a production-proven multi-provider policy.
6. **P5: architecture pressure reduction**
   - continue shrinking `server.ts`, `KnowledgeLearningPlatform.ts`, and the large frontend hosts while preserving forward compatibility.

### 2026-05-27 Tauri-First Agent Reply Rendering Realignment

#### Objective

Align the active implementation plan with current code reality:

- scoped knowledge-workspace grounding is now real,
- provider/TOML settings delivery is now real,
- Reader markdown/math/mermaid hardening is now real,
- but the Tauri agent reply area is still plain-text and therefore remains the most visible unfinished interaction gap.

#### Code-vs-plan reality

- Already implemented in code:
  - active-target-aware workspace hydration and title-like selective document hydration,
  - workspace readiness and miss diagnostics in conversation traces,
  - provider preset/template flows for `app_config.toml`,
  - CORS closure for conversation turn/resume headers,
  - Reader-side Mermaid/KaTeX hardening and leaked-error suppression,
  - first-party Tauri runtime/webview/window debug capture scripts,
  - repo-owned workflow migration to the no-override Node 24 baseline, with FR-010 now enforced against `setup-node@v4` + `node-version: "24"` rather than the removed transition flag.
- Newly implemented in this slice:
  - a typed reply-rendering model in the Tauri agent workspace,
  - shared reuse of Reader-derived markdown/math/mermaid rendering inside the agent reply surface,
  - artifact-style handling for large HTML assistant outputs through sandboxed preview.
  - structured reply composition now splits the assistant output into overview / explanation / evidence summary / memory notice / action guidance blocks instead of emitting only one wrapped markdown answer.
  - those sections are now also semantically richer: the explanation is anchored to the strongest scoped knowledge point, the evidence summary reflects real scoped citations, and next-action guidance incorporates both scoped nodes and memory-action follow-through.
  - reply composition is now intent-aware as well: comparison-style and how-to-style prompts no longer reuse the exact same explanation/action phrasing as plain explanatory prompts.
  - reply-composition ownership is now explicitly treated as extractable architecture surface rather than permanent `KnowledgeLearningPlatform.ts` inline logic, and the current `conversationComposer` module boundary exists to reduce KLP gravity without changing the public response contract.
  - the grouped-knowledge-point and scoped-reply-section assembly path now has an explicit code owner in `src/learning/conversationComposer.ts`, so `KnowledgeLearningPlatform.ts` no longer has to own both session/runtime state and reply-composition detail in the same file.

#### Next execution order

1. **P0: Document truth sync**
   - keep `development-progress-dashboard`, `agent-conversation-focus-mode-plan`, `implementation_plan`, and `tauri_tasks` aligned with current code rather than older Program F-only framing.
2. **P1-P4: Delivered in current code**
   - the conversation response now carries backward-compatible `assistantBlocks`,
   - Reader-derived markdown/math/mermaid rendering is now reused in the agent reply surface,
   - plain-text assistant reply mounting is replaced by a typed block renderer when structured payloads are present,
   - full HTML outputs now have a sandboxed artifact preview path.
3. **P5: Compatibility + verification**
   - retain legacy fallback behavior,
   - preserve existing knowledge-point/capability orchestration,
   - verify docs, frontend contracts, and build/runtime proof after the rendering uplift.
4. **P6: CI hardening follow-through**
   - keep `Migration Gates` and `Fixrisk Operational Readiness` green on `main`,
   - treat future workflow/runtime drift as part of the implementation surface rather than a separate afterthought.

#### Acceptance criteria

1. The Tauri agent reply area can render markdown, KaTeX, and Mermaid using the shared Reader-aligned pipeline.
2. The existing `assistantMessage`-only flow still works during transition.
3. Existing `knowledgePoints`, capability execution, and conversation cards remain backward-compatible.
4. The new render path keeps a clean downgrade/materialization boundary for later Godot work instead of baking Godot constraints into the Tauri-first UX.

### Objective

Bring code truth, active progress docs, and next execution order back into alignment after the branch accumulated real Phase-3 slices while still carrying unfinished Phase-1 and Phase-2 requirements.

### 2026-05-12 to 2026-05-13 Implementation Delta

- Completed in code on this turn:
  - `store.ts` now ships an embedded SQLite graphdb adapter/provider and the server runtime now defaults to `graphdb/sqlite` instead of `local-file-graphdb`, while preserving explicit file fallback.
  - `KnowledgeLearningPlatform.ts` now has live query-backend comparison/history/trend, staleness diagnostics/rebuild planning, learning-quality history/trend, session-plan quality evaluate/history/trend/runtime-threshold diagnostics, query-backend config, and query-backend diagnostics.
  - `queryKnowledge()` now follows the configured backend and preserves explicit runtime fallback semantics.
  - foundation readiness and backend-baseline sufficiency are now evaluated from real store/query/vector signals instead of static placeholders.
  - `server.ts` now injects an active default local `tutorAdapter` while retaining the `local` + `cloud` adapter catalog.
  - embedded sqlite lifecycle hardening is now in place: server shutdown closes the graph store cleanly, and the sqlite adapter can reopen safely for later runtime use in the same process.
  - `src/notemd.server.integration.test.ts` now proves A8 restart durability through ingest -> shutdown -> fresh module reload -> store diagnostics/query/readiness continuity.
  - `scripts/verify-foundation-sqlite-runtime.js` now proves the same embedded sqlite baseline through both `dist` runtime and packaged sidecar flows on the current Windows host: ingest -> store diagnostics/foundation readiness -> restart -> query continuity.
  - `scripts/verify-foundation-sqlite-runtime.js --matrix` now broadens that host-level proof across `smoke` / `medium` / `heavy` workload profiles on the same two runtime paths: snapshot metadata counts, restart continuity, and multi-point query continuity all stay green.
  - `verify:foundation:sqlite-runtime:release` now provides a stable release-named alias for the existing sqlite soak gate, and foundation readiness mandatory checks now expose both sqlite release proof and ANN matrix release proof alongside the lighter baseline/matrix commands.
  - `local_vector` external HTTP acceleration is no longer query-only scaffolding: the adapter now supports remote index sync, exposes sync telemetry in diagnostics, and preserves strict `fail_closed` plus representation-alignment semantics.
  - `src/query_backend.external_http.integration.test.ts` now proves a live `external_http` connector path end to end: ingest -> remote index sync -> query -> diagnostics.
  - `scripts/verify-foundation-ann-runtime.js` now proves that same `external_http` connector baseline through both `dist` runtime and packaged sidecar flows on the current Windows host: ingest -> live query-backend diagnostics -> restart -> query continuity.
  - `scripts/verify-foundation-ann-runtime.js --matrix` now broadens that ANN proof across `smoke` / `medium` / `heavy` workload profiles on the same two runtime paths: sync/select telemetry, aligned representation metadata, and restart continuity all stay green.
  - `scripts/verify-foundation-ann-runtime.js --release-gates` now writes structured JSON evidence under `output/verification/foundation-ann-runtime/` and gates startup, ingest, diagnostics, query latency, and targeted-query recall. `npm run verify:foundation:ann-runtime:release` now passes the full matrix release-gate path on the current Windows host.
  - runtime capability governance now treats ANN remote index sync as a first-class check: `query_vector_acceleration_index_sync_health` is emitted in the matrix/runbook alongside health, traceability, prefilter, and circuit checks.
  - `server.ts` now closes the runbook loop for that new gate: ANN index-sync health is included in verification escalation, remediation action-queue generation, and per-check history summaries.
  - runtime capability governance now also has an explicit ANN calibration prerequisite gate: `query_vector_acceleration_calibration_readiness` blocks release-grade threshold tuning until sync telemetry, stable connector state, prefilter sample readiness, evaluable candidate ratios, and external traceability signals are all present in the same runtime window.
  - the agent workspace runtime runbook surfaces now expose ANN sync-health metrics across verify/checks/action-queue flows, and the verify/checks cards now also surface ANN circuit-budget, traceability, and prefilter summaries plus threshold/signal drilldowns, calibration-readiness state, and the explicit `query_vector_acceleration_calibration_readiness` gate, so operator-facing governance no longer stops at `index_sync_health`.

## 2026-08-17 Phase 9 Execution Status

- **G1 route parity: pass.** `verify:route:shadow` compares 14 legacy-equivalent probes and 6 registry-only probes across status, body, headers, and persistence side effects.
- **G2 mobile artifact/RSS: static pass, device pending.** `verify-mobile-artifact.js` inspects APK/AAB entries, requires arm64 in release mode, and enforces profile budgets; release mode also requires RSS JSON.
- **G3 persistent projection: local replay pass.** SQLite close/reopen/load/query/metadata fixtures pass; cross-host replay remains pending and the in-memory projection stays as fallback.
- **G4 canonical ID: guarded.** Atomic restore, aliases, and move journal foundations pass; public IDs remain unchanged until corpus replay is recorded.

Next order: CI matrix for both dispatch modes, versioned projection-store contract, host-owned PathBridge adapters, one staging directory for both mobile packaging paths, then evidence-backed identity cutover.

## 2026-08-18 Phase 12 Forward-Compatible Mobile Persistence Plan

### Current code truth after Phase 11

The earlier plan correctly separated canonical graph identity from mobile projections, but its G3 wording was too broad: a fixture replay was treated as if it proved Android process restart. The current code now has a narrower, testable contract:

- `knowledge_projection_contract.js` remains the schema owner. It bounds nodes, edges, evidence references, adjacency, and identity metadata; it does not retain document bodies.
- `knowledge_projection_store.js` is the persistence boundary. `createProjectionStore()` remains the compatibility entry point; `createFileProjectionStore()` makes app-local file semantics explicit without changing the serialized projection shape.
- `storage_provider.js` uses the file boundary for `graph_data.json`, with the old generic store path retained for runtimes that have not shipped the new factory yet.
- `src-tauri/src/lib.rs` already writes graph projections through sibling temporary files and rename. Android persists the lite projection and releases parsed bodies before projection. The JavaScript adapter therefore consumes a host-owned atomic primitive instead of reimplementing Rust/Kotlin filesystem policy.
- `scripts/verify-mobile-projection-replay.js` writes a structured report after a real temporary-directory save/reopen cycle. Four host labels consume the same fixture, so parity is checked at schema, metadata, exact search, neighbors, and shortest path rather than only at JSON equality.
- `verify-route-registry-shadow.js` now waits for three stable runtime-manifest samples after readiness, closing a verifier race where asynchronous SQLite initialization could be misclassified as a read-only route side effect.
- The post-change mobile-slim staging remains within budget at 120 files, 4,253,837 uncompressed bytes, and 1,546,201 estimated compressed bytes; a fresh unsigned arm64 APK/AAB measures 9,434,062 and 6,978,525 compressed payload bytes respectively. These are static artifact measurements, not RSS evidence.

### Corrected failure semantics

The previous store implementation could return an initial/stale projection for any exception, including malformed JSON or an unknown future schema. That is unsafe for forward compatibility: a schema incompatibility must be visible so the host can migrate or abstain. The new rule is:

| Boundary failure | Behavior | Rationale |
| --- | --- | --- |
| app-local read/I/O error | use the last successful projection when one exists | transient storage failures should not blank an active session |
| truncated/invalid JSON | fail closed | never run analysis on partial state |
| unknown schema or invalid identity/edge | fail closed | do not silently downgrade future data |
| atomic write error | keep the previous committed file and cached projection | save is commit-or-no-change |

This preserves the existing memory fallback while removing the stale-cache masking bug. Initial data is now a fallback candidate, not proof that disk state is current; the first load still attempts the host read.

### Mobile architecture and trade-offs

The default mobile path remains a body-free JSON projection plus bounded exact analyzer. It is deliberately below the SQLite/WASM option in abstraction level because the current workload is local exact lookup, bounded neighbors, and bounded shortest path. Promoting SQLite/WASM now would increase APK/AAB size, cold-start work, heap residency, and migration surface without improving the release gates that are still missing. The decision is reversible because the store contract is versioned and host-neutral; a future SQLite/WASM adapter can implement the same `load/save/metadata` operations without changing `storage_provider.js` or public IDs.

The adapter must not own platform filesystem policy. Android SAF import remains Kotlin/Rust-owned, Tauri remains Rust-owned, and Web/Capacitor may supply a native atomic writer later. This avoids a leaky cross-platform path abstraction, but it implies a single-writer rule and requires device evidence for process death, URI permission persistence, and import/query/path continuity.

### Execution order from this point

1. **G2 device evidence**: produce signed arm64 APK/AAB, run SAF import -> graph build -> exact query -> path on low-memory hardware, capture peak RSS, and reject any result marked `not-measured`.
2. **G3 host matrix**: run the replay script and native adapters in CI for both Tauri and Capacitor packaging paths; add process-death/reopen evidence on at least one Android API/ABI target.
3. **G4 identity corpus**: replay old snapshots, move journals, rollback, same-content/NFC collision, and cross-root cases after restart. Keep public IDs frozen until all results are deterministic.
4. **Only after evidence**: evaluate SQLite/WASM as an opt-in large-corpus adapter. It must demonstrate a measured benefit against JSON on startup, RSS, query p95, and package budget before promotion.
5. **Architecture reduction**: continue extracting ownership from `server.ts` and `KnowledgeLearningPlatform.ts` only where the new module owns state/invariants; do not add pass-through facades around the projection store.

### Acceptance gates

- `npm run verify:mobile:projection-replay` produces a fresh report with four host passes and fail-closed failure modes.
- Full Jest, TypeScript no-emit, Rust tests, mobile slim budget, artifact inspection, route shadow, and Diataxis remain green.
- Signed-device RSS and SAF workload evidence are reported separately from static APK/AAB size evidence.
- The worktree is clean and `main` is pushed only after the above checks complete.
  - modular knowledge-route wiring for `runtime-capability-runbook/*` is now backed by live server-side runbook ops instead of KLP placeholder payloads, and the route layer now preserves `checkId` / `sinceMinutes` / queue-filter query params rather than dropping them.
  - the real browser smoke gate now proves those verify/checks/action-queue surfaces end to end: strict browser evidence must show the ANN sync-health verify card, the new verify/checks ANN circuit/traceability/prefilter drilldowns, the first-check ANN sync metric, and the index-sync action-queue drilldown instead of only proving that the cards can open.
  - agent-workspace locale hardening now covers the currently surfaced diagnostics cards/messages: source-referenced `agentWorkspace.*` keys are guarded by `src/agent_workspace.locale.contract.test.ts`, bilingual locale bundles now back the query/quality/runbook card labels that strict browser smoke actually exercises, and startup-time translate helpers defer `window.i18n.t()` until locale init to avoid false missing-key warnings before locales hydrate.
- This changes the execution focus:
  - P3 placeholder replacement is implementation-complete for the current runtime surfaces.
  - P4 default tutor-routing activation is implementation-complete for the local-first baseline.
  - the remaining A8 gap is now narrower: host-level dist/runtime + packaged sidecar proof is in place, and a host-level workload matrix across `smoke` / `medium` / `heavy` is also in place; soak / longer-duration / performance hardening still remains.
  - the remaining A9 gap is now narrower too: host-level dist/runtime + packaged sidecar proof is in place, a host-level workload matrix across `smoke` / `medium` / `heavy` is also in place, and matrix release-gate evidence now exists; repeated threshold convergence and multi-host calibration still remain.
  - the next phase after this work is still release-grade Phase-2 gate hardening, but the current slice is now visibility-complete rather than calibration-complete: the first ANN gate family has server-side runbook/action-queue/history closure, prefilter now shares the ANN fast-lane escalation path, and frontend verify/checks now expose index-sync, circuit, traceability, and prefilter governance with threshold/signal context plus calibration-readiness cues, while A8 soak/performance closure and A9 threshold convergence continue in parallel.

### Code-vs-Plan Reality Matrix

| Area | Planned Expectation | Current HEAD Reality | Status |
|---|---|---|---|
| Phase-1 A8 graph backend | production-grade local graph backend | ops semantics exist, default runtime now targets embedded `graphdb/sqlite` with explicit file fallback, restart durability is integration-proved, host-level `dist` runtime + packaged sidecar proof is automated, and a host-level workload matrix now exists across `smoke` / `medium` / `heavy`; soak / longer-duration / performance hardening is still open | Operational baseline |
| Phase-1 A9 ANN connector | production-grade ANN connector | `external_http` now supports remote index sync plus live end-to-end query proof under strict failure/representation semantics; host-level `dist` runtime + packaged sidecar proof and a host-level workload matrix across `smoke` / `medium` / `heavy` are now in place, but recall/latency threshold convergence and release-grade calibration are still open | Operational baseline |
| Phase-2 quality gates | live mastery/divergence quality trend gates | query-backend comparison, staleness, learning-quality, and session-plan-quality runtime surfaces are now live in `KnowledgeLearningPlatform.ts`; operator-facing ANN governance now surfaces index-sync, circuit, traceability, and prefilter summaries plus threshold/signal drilldowns and calibration-readiness cues through runbook verify/checks, and runtime now carries explicit gate `query_vector_acceleration_calibration_readiness`, but the full gate set still needs release-grade calibration on top of the current graph/ANN operational baseline | Operational baseline |
| Phase-3 tutor + memory | tutor and memory operating layer becomes real | tutor telemetry/trace/provider trends + conversation memory + memory-policy diagnostics are real, and default runtime now injects a local tutor adapter; production-proven multi-provider routing is still open | Operational baseline |
| Architecture compaction | major monoliths reduced to sustainable size | `server.ts` 14,992, `KnowledgeLearningPlatform.ts` 7,706, `path_app.js` 4,649, `app.js` 4,713, `routes/knowledge.ts` 690 | Open |

### Execution Order

1. P0: Truth correction and gate reclassification
   - keep progress docs aligned with actual code status,
   - stop treating placeholder-backed or catalog-only surfaces as closed.
2. P1: Real graph backend closure
   - keep the new embedded `graphdb/sqlite` host-level `dist` runtime + packaged sidecar verifier green,
   - keep the new host-level workload-matrix verifier green,
   - preserve fallback behavior,
   - keep expanding beyond the now-proved restart lifecycle and workload matrix into soak, longer-duration durability/performance, and adapter/fallback consistency verification.
3. P2: ANN workload and rollout closure on top of the new live connector baseline
   - keep the new sync-backed `external_http` connector healthy under real traffic,
   - keep the new host-level ANN runtime + workload-matrix verifiers green,
   - benchmark recall/latency thresholds and converge release-grade calibration before calling the ANN layer production-closed.
4. P3: Next phase after this work - Phase-2 quality gate hardening
   - keep the new telemetry-backed query/staleness/learning-quality/session-plan-quality surfaces aligned with the same runtime truth,
   - move the ANN gate family from visibility closure to calibration closure by workload-testing the now-surfaced index-sync, circuit, traceability, and prefilter budgets,
   - keep ANN governance honest through explicit remote index-sync, health, prefilter, traceability, and circuit checks,
   - promote them into release-significant threshold gates only after the graph/ANN baseline is release-grade rather than merely operational.
5. P4: Tutor routing hardening
   - keep the newly active default `tutorAdapter` observable,
   - extend from local-first routing into a production-proven multi-provider policy.
6. P5: Architecture pressure reduction
   - continue splitting `routes/knowledge.ts`,
   - keep reducing `server.ts`, `KnowledgeLearningPlatform.ts`, `path_app.js`, and `app.js`.

### Acceptance Criteria

1. The default graph backend is no longer `local-file-graphdb`, and the embedded `graphdb/sqlite` baseline survives shutdown/restart with persistent query/store diagnostics.
2. One ANN connector path is proven beyond scaffold status under real sync/query traffic, and its workload/threshold calibration remains explicitly tracked rather than hidden.
3. `KnowledgeLearningPlatform.ts` no longer returns placeholders for query comparison, staleness, learning-quality, and session-plan-quality runtime surfaces.
4. Default runtime tutor execution emits non-zero adapter telemetry under real server execution.
5. `docs:diataxis:check`, `docs:site:build`, `build:with-vite`, strict `verify:agent-workspace:browser` proof, and targeted agent-workspace/KLP tests pass after each milestone.

---

# 2026-03-10 v1.5.38 - Multi-Terminal WASM Parity Implementation Plan (Mobile Bottleneck Closure)

### Goal
Use a single WASM compute strategy to reduce mobile-inherent bottlenecks while preserving deterministic behavior across desktop web, Tauri desktop, Capacitor mobile, and Tauri Android runtimes.

### Mobile Inherent Problems (Current)

1. Main-thread contention during heavy graph/layout compute can freeze interaction.
2. Worker startup + JS serialization overhead can dominate on mobile CPUs for sparse graphs.
3. Memory pressure and GC spikes increase crash/jank probability on constrained devices.
4. Capability variance across WebView runtimes creates nondeterministic behavior without explicit probes.

### Multi-Terminal Strategy

1. One capability contract:
   - Runtime exposes `supports_mobile_wasm_compute` and `mobile_wasm_reason`.
   - Routing remains deterministic with explicit fallback reason tracking.
2. One compute routing model:
   - Preferred: `wasm-adapter`
   - Fallback: `worker`
   - Final fallback: `single-thread`
3. One artifact governance path:
   - Canonical WASM artifact probe + strict gate scripts + CI regression barriers.

### Phased Execution Plan

1. Phase A (Capability and Diagnostics) [Completed baseline]:
   - Add runtime probe for mobile WASM readiness.
   - Expose capability and reason in runtime caps.
   - Keep existing behavior unchanged if capability is unavailable.
2. Phase B (Routing Integration) [Active]:
   - Thread mobile capability signal into on-device build stats.
   - Add build-mode detail tags for mobile telemetry (`worker-wasm-ready`, `worker-wasm-not-ready`, fallback reasons).
   - Keep deterministic fallback behavior.
3. Phase C (Kernel Expansion):
   - Move additional heavy kernels to WASM where correctness is contract-proven.
   - Prioritize graph build hot spots that currently consume most mobile CPU time.
4. Phase D (Artifact Provisioning per Terminal):
   - Validate artifact packaging for:
     - desktop web bundle
     - Tauri desktop sidecar/runtime paths
     - Capacitor mobile asset/runtime paths
     - Tauri Android runtime paths
5. Phase E (Performance and Stability Hard Gates):
   - Enforce p95/p99 guardrails for mobile-oriented workloads.
   - Enforce no-regression equivalence contracts between worker and WASM output.

### Acceptance Criteria

1. Runtime can always explain why WASM is enabled/disabled on mobile (`mobile_wasm_reason`).
2. Mobile build path remains functional when WASM is unavailable (deterministic fallback verified).
3. Migration gate suite remains fully green after each routing change.
4. Bilingual docs remain synchronized for all plan/TODO/test-report updates.

---

# 2026-03-04 v1.5.13 - Tauri Bridge-First Implementation Plan Update

## English Document

### Scope Alignment

This update aligns the implementation plan with the current Electron-to-Tauri migration strategy:

- Tauri as the primary desktop shell.
- Godot as the Path Mode interactive surface.
- Node sidecar as the graph build and runtime service.
- Bridge-first message flow (`Godot <-> PathBridge <-> Backend`) as the default path.

### Completed in Current Migration Cycle

- Runtime path unification for sidecar execution and frontend asset resolution has been integrated across desktop runtime paths.
- Worker path resolution has been stabilized for packaged sidecar execution to avoid `MODULE_NOT_FOUND` in worker threads.
- Knowledge Base folder loading is now anchored to the configured project root path and no longer depends on Electron-only assumptions.
- The `Path Mode` configuration migration has moved core controls into Godot-side UI while preserving browser toolbar behavior for browser mode.

### Open Gaps and Risk Items

- Cache-exists decision flow still requires strict regression verification in Tauri mini GPU runs to ensure users are prompted to reuse or rebuild.
- Duplicate load cycles must remain guarded to prevent repeated build/restore actions after a single user click.
- WebSocket client lifecycle still needs hardening to avoid redundant early connect/disconnect churn under startup timing races.
- History tracking for center-node switches in Godot requires final behavioral verification.

### Next Execution Steps

1. Lock cache prompt + single-execution semantics with dedicated regression tests.
2. Finalize websocket lifecycle guard rails and startup sequencing.
3. Complete task-level parity checks for Electron IPC replacements and remove remaining implicit Electron dependencies.
4. Keep dual-output mobile strategy: maintain Capacitor output while also enabling Tauri Android build path.

## 2026-08-17 Identity Boundary and Mobile Budget Plan

1. Pass an explicit workspace root through `FileLoader`; retain the optional parameter so legacy callers remain source-compatible.
2. Propagate optional `sourceUri`, `revision`, and `identityAliases` through learning ingest and snapshots; resolve deletes by URI/alias before legacy path fallback.
3. Enforce Android admission limits before body reads: 5,000 documents, 16 MiB per document, 64 MiB total input, and 250,000 edges; extract link candidates while reading so the intermediate draft does not retain document bodies.
4. Keep canonical-ID cutover blocked on move/rename replay, old-snapshot fixtures, HTTP schema parity, and cross-client Bridge replay.
- 2026-08-17 Phase 8 delivered an atomic graph replay entry, explicit learning move/rename journal, bounded modular ingest validation, indexed keyword candidates, identity-aware mobile exact projection, and additive Bridge 2.0 capability/cancellation envelopes.
- The next gates are registry response/status shadow parity, fresh arm64 APK/RSS evidence, versioned SQLite/WASM persistence behind the export contract, and only then canonical public-ID migration.

## 2026-08-17 Phase 10: Versioned Projection and Host Execution

1. `knowledge_projection_contract.js` is the canonical mobile wire shape: schema `1`, body-free nodes, identity metadata, explicit/inferred/runtime provenance, bounded evidence references, and bounded adjacency.
2. Capacitor normalizes generated graphs through the contract; Tauri Rust emits the same schema and identity fields while preserving Android body-free memory behavior.
3. `PathBridgeHostAdapter` keeps execution and policy in the host while the Bridge owns correlation, timeout, abort, disconnect cleanup, and legacy transport fallback.
4. Remaining gates are fresh signed arm64 artifact/RSS evidence, Android Storage Access Framework import, cross-host replay, and old-snapshot/move/rename/collision evidence.

## 2026-08-18 Phase 11: Projection Store and Android SAF Execution

1. `knowledge_projection_store.js` is now the host-neutral persistence boundary, with persistent/read-through and memory adapters, bounded metadata, and last-known fallback after a successful load.
2. Mobile exact analysis reads through the store; a shared fixture replays the same schema, metadata, exact lookup, neighbors, and paths for Web, Tauri, Capacitor, and Android adapters.
3. Tauri projection writes use sibling temporary files plus rename. Android slim receives an additive SAF bridge that streams Markdown into a staging tree under app-local storage, enforces document/depth/byte budgets, atomically activates the imported tree, and reports completion through request/poll IPC.
4. Identity corpus coverage now includes same-content documents, move/rename aliases, and NFC collisions. Public IDs remain unchanged.
5. G2 is partially evidenced: a fresh arm64 slim build produced an unsigned APK (9,555,787 bytes) and AAB (7,179,228 bytes); static verification measured 9,433,678 and 6,978,122 compressed payload bytes, with no Godot/sidecar/model/SVG entries. Signed artifacts, online device import/query, and RSS JSON remain open. Kotlin compilation now succeeds with the available Android toolchain. G3 fixture replay passes; real Android storage replay and G4 canonical-ID cutover remain blocked.

### 2026-08-18 verification follow-up

`mobile:prepare:slim` now stages 120 files (4,251,345 uncompressed bytes; 1,545,813 estimated compressed bytes). The fresh arm64 APK/AAB pass ZIP inspection and the mobile artifact verifier under the 25 MiB payload budget. This closes static packaging evidence only; signing, device SAF replay, and peak RSS remain release gates.
