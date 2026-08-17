# 2026-03-04 v1.5.13 - Tauri Migration Task Consolidation

## English Document

### 2026-06-19 Re-audit Correction

- [x] A fresh code audit confirms that the final public-answer reviewer is already implemented in `src/learning/answerReleaseReview.ts`; the active gap is no longer "missing release-review ownership".
- [x] A fresh code audit also confirms that right-pane graph-focus highlighting is now tighter than payload hardening alone: `src/frontend/workspace_panes.js` prefers trustworthy `line_window` anchors, falls back to `snippet_fallback` when the line window is absent or stale, records additive `highlightStrategy` diagnostics, and prunes container-wide over-highlighting.
- [x] `src/agent_workspace.frontend.test.ts` now pins two operator-relevant failures: repeated snippet text must resolve to the line-anchored paragraph when the line window is trustworthy, and unusable line metadata must fall back to snippet highlighting instead of highlighting the wrong paragraph.
- [x] `src/learning/answerReleaseReview.ts` now also enforces `claim_state_consistency`, so same-subject state reversals such as `open system` vs `closed system` are revised in both English and Chinese rather than slipping through the release gate.
- [x] `src/learning/answerReleaseReview.ts` now also enforces `query_intent_alignment`, so `what is` / `什么是` queries no longer release document-self-description drafts such as `本技术文档旨在...` when grounded definition frames are available.
- [x] `src/learning/answerReleaseReview.ts` now also enforces `claim_attribute_consistency`, so grounded drafts that keep the same subject and explicit `has` / `具有` attribute frame but swap the supported attribute, such as `moderate thermal insulation` to `high thermal insulation`, are revised before release; `src/learning/answerReleaseReview.test.ts` now pins English conflict, Chinese conflict, and compatible-refinement false-positive control.
- [x] `src/learning/answerReleaseReview.ts` now also enforces `claim_containment_consistency`, so grounded drafts that keep the same subject and explicit containment relation but swap the contained material, such as `contains water` to `contains oil`, are revised before release.
- [x] `src/learning/answerReleaseReview.ts` now also enforces `claim_composition_consistency`, so grounded drafts that keep the same subject and explicit `composed of` / `由...组成` frame but swap the supported components are revised before release; `src/learning/answerReleaseReview.test.ts` now pins English conflict, Chinese conflict, and compatible-order false-positive control.
- [x] `src/learning/answerReleaseReview.ts` now also enforces `claim_purpose_consistency`, so grounded drafts that keep the same subject and explicit `used for` / `用于` purpose frame but swap the supported use, such as `drinking water` to `storing motor oil`, are revised before release; `src/learning/answerReleaseReview.test.ts` now pins English conflict, Chinese conflict, and supported-purpose refinement false-positive control.
- [x] `src/learning/answerReleaseReview.ts` now also enforces `claim_dependency_consistency`, so grounded drafts that keep the same subject and explicit `depends on` / `requires` / `依赖` / `前置条件` relation but swap the supported dependency, such as `Baseline Measurement and Sensor Calibration` to `Final Reporting`, are revised before release; `src/learning/answerReleaseReview.test.ts` now pins English conflict, Chinese conflict, and supported-dependency release control.
- [x] `src/learning/answerReleaseReview.ts` now also enforces `claim_location_consistency`, so grounded drafts that keep the same subject and explicit `located in` / `位于` relation but swap the supported location, such as `main chamber` to `auxiliary chamber`, are revised before release; locative predicates are also excluded from `claim_state_consistency` extraction so location claims do not misfire as state contradictions.
- [x] `src/learning/answerReleaseReview.ts` now also enforces `claim_structured_comparison_consistency`, so grounded drafts that explicitly invert supported `higher/lower`, `greater/less`, and `高于/低于` comparisons are revised before release when the support provides same-property, same-unit facts proving the opposite ordering; `src/learning/answerReleaseReview.test.ts` now pins English inversion, Chinese inversion, supported-direction release, and mixed-property false-positive control.
- [x] `src/learning/answerReleaseReview.ts` now also enforces `claim_graph_causal_consistency`, so grounded drafts that reverse DAG-backed cause/effect direction, such as `Pressure Rise causes Thermal Expansion`, are revised before release in both English and Chinese.
- [x] `src/learning/answerReleaseReview.ts` now also enforces `claim_graph_comparison_consistency`, so grounded drafts that restate DAG-backed `contrast` pairs as `analogy`, or `analogy` pairs as `contrast`, are revised before release with deterministic correction sentences.
- [x] `src/learning/answerReleaseReview.ts` now also enforces `claim_temporal_validity_consistency`, so DAG temporal warnings are no longer explanation-only: when `graphContext.temporalValidity.allPointsValid === false`, unqualified current-tense drafts are revised before release, explicitly time-qualified drafts may still release, and supersedes-only lineage does not become a false-positive blocker by itself.
- [x] `src/frontend/markdown_runtime.js` now annotates rendered markdown blocks with source-line metadata, and `src/frontend/workspace_panes.js` now prefers `source_line_provenance` when rendered-node source ranges overlap trusted matched spans.
- [x] `src/frontend/workspace_panes.js` now projects the matched evidence fragment into inline highlight markup inside the selected graph-focus node instead of only tinting the entire paragraph/container.
- [x] The user-provided screenshot `1781782257390.jpg` remains a formal acceptance owner through `waterglass_explicit_scope_compact_zh`; the root cause is now documented as planner/retrieval normalization drift plus public-answer diagnostic leakage, not a generic "RAG weakness".
- [x] Runtime verification now explicitly requires fresh compiled output when reviewer-gate inventory changes; a stale `dist` build temporarily hid the new gate until `npm run build:mini` refreshed the runtime JS.
- [ ] Next active gap: broaden deterministic claim-vs-citation / claim-vs-evidence contradiction coverage beyond the current lexical + query-intent + structured + structured-comparison + attribute + containment + composition + purpose + dependency + location + subject + state + polarity + graph-causal + graph-order + graph-comparison + temporal-validity reviewer stack without turning the reviewer into a speculative verifier.
- [ ] Next active gap: deepen source-to-render provenance beyond today's block-level markdown source mapping plus snippet-projected inline highlights, toward source-authenticated character offsets.
- [ ] Next active gap: keep growing the real regression corpus with cross-scope, compact-alias, and synonym failures while preserving backward compatibility.

### 2026-06-18 Active Final Reply Review Task Sync

- [x] The new source-of-truth note is `docs/solutions/agent-final-reply-review-robustness-plan-2026-06-18.md`.
- [x] The root problem is now explicitly classified as missing final-answer release review, not merely prompt quality or graph retrieval.
- [x] A dedicated backend owner now exists at `src/learning/answerReleaseReview.ts`.
- [x] The response contract now carries additive `answerReleaseReview` state on the response, trace, and `KnowledgeRun`.
- [x] `conversationComposer.ts` now drafts the answer and then passes it through deterministic release gates before the public answer is released.
- [x] The reviewer now enforces `claim_grounding_alignment`, so grounded but drifting draft claims are revised instead of being released unchanged.
- [x] Scoped Chinese misses now abstain in Chinese instead of leaking English diagnostic-heavy fallback text.
- [x] The screenshot-backed `waterglass` runtime case is now part of the formal verifier: runtime acceptance requires reviewer presence and rejects public-answer diagnostic leakage.
- [x] Reviewer results are now surfaced in operator inspection through `knowledge_run` detail/history cards without widening the primary answer area.
- [x] Reviewer summaries are now exported through `runtime.knowledgeRunReports[*].answerReleaseReview` for durable replay/audit, while keeping the summary surface compact.
- [x] Aggregate reviewer audit telemetry is now exported through `runtime.knowledgeRunAnswerReleaseAuditSummary`, and the `knowledge_run` history card renders the same multi-run audit shape for operators.
- [x] The aggregate reviewer audit now also carries review-trend windows and gate-aging summaries, and the operator history card renders both from the same telemetry path.
- [x] The same reviewer telemetry path now also carries compare-ready operator drilldowns: recent/prior metric shifts, gate shifts, and latest-pair deltas in history, plus answer-release deltas in the run-compare card.
- [x] A shared alias/scope regression corpus now exists at `src/learning/KnowledgeWorkspaceConversationRegression.ts`, including the screenshot-derived compact/spaced `waterglass` cases and cross-scope recovery cases under `financial`.
- [x] `scripts/verify-knowledge-workspace-runtime.js` and `src/learning/KnowledgeWorkspaceConversationRegression.test.ts` now consume the same deterministic corpus, so runtime and Jest no longer drift on alias/scope expectations.
- [x] That corpus exposed and fixed a soft-miss recovery bug in `KnowledgeLearningPlatform.ts`: planner scope recovery no longer waits for absolute zero results, and now also recovers when noisy in-scope candidates survive but none of them belong to planner title-hit documents.
- [x] The reviewer now also enforces `claim_structured_consistency`, so grounded drafts with conflicting numeric or year facts are revised even when the lexical topic overlap still looks acceptable.
- [x] `src/learning/answerReleaseReview.test.ts` now covers deterministic structured-fact contradiction cases: numeric conflict, year conflict, and a multi-value support case that must not raise a false positive.
- [x] The reviewer now also enforces `claim_structured_comparison_consistency`, so grounded drafts that explicitly invert supported same-property comparisons are revised before release, and `src/learning/answerReleaseReview.test.ts` now covers English inversion, Chinese inversion, supported-direction release, and mixed-property false-positive control.
- [x] The reviewer now also enforces `claim_polarity_consistency`, so grounded drafts that explicitly reverse supported claims (`is` vs `is not`, including the narrow Chinese negation path) are revised before release.
- [x] `src/learning/answerReleaseReview.test.ts` now covers deterministic polarity-conflict cases: English reversal, Chinese reversal, and an unrelated-support-negation case that must not raise a false positive.
- [x] The reviewer now also enforces `claim_graph_causal_consistency`, so grounded drafts that reverse DAG-backed `causal` direction are revised before release with a deterministic correction sentence.
- [x] `src/learning/answerReleaseReview.test.ts` now covers deterministic DAG-causal cases: English reversal, correct causal direction, and Chinese reversal.
- [x] The reviewer now also enforces `claim_graph_order_consistency`, so grounded drafts that reverse `prerequisite` or `sequence` direction against the assembled DAG are revised before release with a deterministic correction sentence.
- [x] `src/learning/answerReleaseReview.test.ts` now covers deterministic DAG-order cases: prerequisite reversal, correct prerequisite direction, and sequence reversal.
- [x] The reviewer now also enforces `claim_graph_comparison_consistency`, so grounded drafts that misstate assembled DAG `contrast` / `analogy` relations are revised before release with deterministic correction sentences.
- [x] `src/learning/answerReleaseReview.test.ts` now covers deterministic DAG-comparison cases: contrast released as analogy, correct contrast release, and Chinese analogy released as contrast.
- [x] The reviewer now also enforces `claim_temporal_validity_consistency`, so temporally flagged DAG evidence cannot be released as a current answer without explicit time qualification; `src/learning/answerReleaseReview.test.ts` now covers English/Chinese revision, explicit time-qualified release, and supersedes-only false-positive control.
- [x] The reviewer now also enforces `claim_containment_consistency`, so grounded drafts that keep the same subject and explicit containment relation but swap the contained material are revised before release, and `src/learning/answerReleaseReview.test.ts` now covers English conflict, Chinese conflict, and a compatible-refinement false-positive control.
- [x] The reviewer now also enforces `claim_composition_consistency`, so grounded drafts that keep the same subject and explicit `composed of` / `由...组成` relation but swap the supported components are revised before release, and `src/learning/answerReleaseReview.test.ts` now covers English conflict, Chinese conflict, and a compatible-order false-positive control.
- [x] The reviewer now also enforces `claim_purpose_consistency`, so grounded drafts that keep the same subject and explicit `used for` / `用于` purpose relation but swap the supported use are revised before release, and `src/learning/answerReleaseReview.test.ts` now covers English conflict, Chinese conflict, and a supported-purpose refinement false-positive control.
- [x] The reviewer now also enforces `claim_dependency_consistency`, so grounded drafts that keep the same subject and explicit `depends on` / `requires` / `依赖` / `前置条件` relation but swap the supported dependency are revised before release, and `src/learning/answerReleaseReview.test.ts` now covers English conflict, Chinese conflict, and a supported-dependency release control.
- [x] The reviewer now also enforces `claim_location_consistency`, so grounded drafts that keep the same subject and explicit `located in` / `位于` relation but swap the supported location are revised before release, and `src/learning/answerReleaseReview.test.ts` now covers English conflict, Chinese conflict, and a broader-location false-positive control; locative predicates are excluded from `claim_state_consistency` extraction so the location slice owns those claims.
- [x] Runtime verification for reviewer-gate changes now has an explicit freshness rule: refresh `dist` with `npm run build:mini` before `scripts/verify-knowledge-workspace-runtime.js`, because stale compiled output can hide the live gate inventory.
- [ ] Next active task: extend contradiction coverage beyond the current lexical + query-intent + structured-fact + structured-comparison + attribute + containment + composition + purpose + dependency + location + subject + state + polarity + graph-causal + graph-order + graph-comparison + temporal-validity checks into broader claim/citation/evidence conflicts without letting false positives widen.
- [x] The graph-focus payload contract is now hardened: citation-backed `sourcePath` / `snippet` fallback is normalized before opening graph focus, and right-pane source preview/highlight no longer depends on a single raw top-level hit path.
- [x] Right-pane highlight precision is now tighter than payload stability alone: trusted line windows are preferred, stale line metadata is distrusted, snippet fallback remains available, and `highlightStrategy` diagnostics expose which path won.
- [ ] Next active task: strengthen source-to-render provenance mapping once the markdown runtime can expose stable source-line / DOM metadata beyond today's line-window and snippet-fallback heuristics.
- [ ] Next active task: continue growing the regression corpus with more real cross-scope and synonym failures, while keeping the public answer surface contracted.

### Current Acceptance Targets

1. Public answers never expose `No scoped knowledge points matched`-style internal failure strings.
2. Reviewer decisions remain additive and backward-compatible for all current clients.
3. Grounded drafts with conflicting structured numeric/year facts are revised before release instead of slipping through on lexical overlap alone.
4. Grounded drafts that explicitly invert supported same-property comparisons are revised before release instead of leaking ordering drift such as `Water density is higher than glass density` when the support proves the opposite ordering.
5. Grounded drafts that keep the same subject and explicit containment relation but swap the contained material are revised before release instead of leaking content drift such as `contains water` vs `contains oil`.
6. Grounded drafts that keep the same subject and explicit `composed of` / `由...组成` relation but swap the supported components are revised before release instead of leaking composition drift such as `water and a glass cup` vs `oil and a plastic cup`.
7. Grounded drafts that keep the same subject and explicit `used for` / `用于` purpose relation but swap the supported use are revised before release instead of leaking purpose drift such as `drinking water` vs `storing motor oil`.
8. Grounded drafts that keep the same subject and explicit `located in` / `位于` relation but swap the supported location are revised before release instead of leaking location drift such as `main chamber` vs `auxiliary chamber`, and locative claims must not mis-trigger the state gate.
9. Grounded drafts that assert the wrong same-subject state are revised before release instead of leaking contradictions such as `open system` vs `closed system`.
10. Grounded drafts that explicitly reverse supported polarity are revised before release instead of slipping through on lexical overlap alone.
11. Grounded drafts that reverse DAG-backed cause/effect direction are revised before release instead of leaking inverted causal claims to the public answer.
12. Grounded drafts that reverse `prerequisite` or `sequence` direction against the assembled DAG are revised before release instead of leaking inverted order claims to the public answer.
13. Grounded drafts that restate a DAG-backed single-family comparison pair (`contrast` only or `analogy` only) as the opposite comparison family are revised before release instead of leaking branch-semantics drift to the public answer.
14. Grounded drafts that present temporally flagged DAG evidence as a current answer are revised before release unless the public answer stays explicitly time-qualified; supersedes-only lineage must not trigger this gate by itself.
15. Operator inspection surfaces show reviewer decision, failed gates, and original/public answer deltas without widening the main answer area.
16. Exported `knowledgeRunReports` carry compact reviewer summaries for `release` / `revise` flows and omit the field cleanly when review data is absent.
17. Exported runtime state also carries additive aggregate reviewer telemetry at `runtime.knowledgeRunAnswerReleaseAuditSummary`, including review-trend windows, gate-aging summaries, and compare-ready drilldowns; the operator history card and compare card surface the same reviewer path.
18. Right-pane file-hit preview resolves source markdown and matched-span highlights from stable payload fields, including citation-backed paths/snippets when top-level hit fields are incomplete; rendered markdown blocks retain source-line metadata, `source_line_provenance` wins when rendered-node ranges overlap trusted spans, the selected node receives inline matched-fragment highlight markup, and the system falls back to `line_window` / `snippet_fallback` without widening the main answer area.
19. Runtime verification for reviewer-gate changes runs against fresh compiled output, so `npm run build:mini` precedes `scripts/verify-knowledge-workspace-runtime.js` when the reviewer surface changes.
20. Runtime verification now passes the shared alias/scope corpus, including the screenshot-derived compact/spaced `waterglass` pair and the `financial` cross-scope recovery pair, and confirms `answerReleaseReview.publicAnswer === result.answer`.

### 2026-06-17 Active Agent Knowledge DAG Task Sync

- [x] The graph-structure requirement is now clarified as the existing project DAG, not a generic graph database.
- [x] The 2026-06-17 source-of-truth note is `docs/solutions/agent-knowledge-dag-answer-contract-plan-2026-06-17.md`.
- [x] The current implementation carries optional explicit graph connection paths through graph context, answer composition, evidence-pane rendering, export serialization, and regression tests.
- [x] The open-source review has a firm boundary: use DSPy / Guidance / Semantic Kernel / LangChain Core / LiteLLM patterns without adding those frameworks to the app runtime.
- [x] Current DAG-aware answer planning now includes a first-class graph-conditioned context assembly layer in `src/learning/graphContextAssembler.ts`.
- [x] Right-pane source/highlight behavior now retries candidate source paths, records requested/candidate/attempted/resolved-path diagnostics, and exposes those diagnostics in graph-focus plus durable knowledge-run inspection surfaces.
- [x] Retrieval-side graph intent detection now covers Chinese compare/how-to/explain markers, and compare-branch ranking is regression-tested against lexically stronger reference notes.
- [x] The `graph_comparison_branch` quality gate now rejects reference-only support when compare intent lacks real branch-difference signals.
- [x] Graph-focus render diagnostics now cross the runtime boundary: interesting pane diagnostics are persisted in session state and exported as durable `runtime.graphFocusReports`.
- [x] The screenshot-backed compact-alias regression for `什么是waterglass?` has been reproduced, traced to planner/retrieval normalization drift, and fixed by passing planner-derived query variants into retrieval scoring.
- [x] `verify-knowledge-workspace-runtime.js` now loads the shared alias/scope regression corpus by default, so `npm run verify:knowledge-workspace:runtime` covers both the `waterglass` compact/spaced pair and cross-scope recovery cases.
- [x] The shared corpus also exposed a soft-miss recovery bug: planner scope recovery now triggers when reranked in-scope noise does not contain any planner title-hit document, not only when retrieval returns zero results.
- [ ] Next active task: calibrate the new graph-quality-gate model and continue owner reduction only where a new module owns real invariants or state.
- [ ] Keep the public answer contracted while routing graph evidence, temporal details, and developer trace to secondary surfaces.

### Current Acceptance Targets

1. Active docs distinguish existing DAG data from generic graph database architecture.
2. Public conversation compatibility remains additive: `assistantMessage` stays valid and new graph context fields are optional.
3. Evidence-pane/export surfaces preserve graph connection paths without crowding the main answer.
4. Follow-up implementation starts from context assembly and graph-specific tests, not from prompt-framework adoption.
5. The default alias/scope runtime corpus passes for both `什么是waterglass?` / `什么是water glass` and the `financial`-scope recovery pair `what is water glass?` / `what is waterglass?`.

### 2026-06-10 Active Knowledge Workspace and DAG Task Sync

- [x] The current codebase has been re-audited against the earlier lightweight-RAG, agent-workspace, and mainline architecture plans.
- [x] The reconciliation now has a dedicated source-of-truth note at `docs/solutions/knowledge-workspace-dag-alignment-2026-06-10.md`.
- [x] Structured grounded conversation, grouped knowledge points, durable `flashcard_batch` / `knowledge_run` artifacts, workflow-artifact review follow-up, and graph-focus source rendering are all code-backed in the current branch.
- [x] The current DAG-backed learning substrate is confirmed in code: `KnowledgeAtom`, `RelationEdge`, `TemporalEdge`, path queries, and prerequisite-driven learning flows already exist.
- [x] The visible answer area is contracted in the current slice: users see the targeted `answer` / `directAnswer` first, while graph paths, evidence, diagnostics, and durable artifacts stay on secondary surfaces.
- [~] Left-side knowledge hits are file-first, but still need to converge on a right-pane-first reading model.
- [x] The graph-conditioned context-assembly layer between retrieval and answer synthesis is now implemented, so the current DAG is a first-class answer-planning substrate instead of only a retrieval-side aid.
- [ ] Continue ownership reduction in `src/server.ts`, `src/learning/KnowledgeLearningPlatform.ts`, `src/frontend/agent_workspace.js`, and `src/frontend/workspace_panes.js`.

### Current Acceptance Targets

1. All active tracker docs point to the same 2026-06-10 Knowledge Workspace and DAG alignment note.
2. The documented current state distinguishes implemented code-backed baselines from unfinished product-surface behavior.
3. The current code is verified on `main`, documented as such, and the worktree is clean afterward.
4. Backward compatibility remains explicit: legacy `assistantMessage` and current public runtime APIs are unchanged.

### 2026-06-06 Active Task Sync

- [x] Work continues directly on `main` for this P1 continuation slice; remote sync/push status is tracked separately from local implementation progress.
- [x] Current code has been compared against the May RAG/agent/export plans and the result is now landed in `docs/solutions/architecture-progress-alignment-2026-06-06.md`.
- [x] Scoped retrieval, grounded conversation, Program A-F substrate, export profiles, PNG-first Godot/mobile materialization, and rollout governance are documented as implemented or operational baselines according to current code evidence.
- [~] graphdb/sqlite and ANN/external connector paths remain operational baselines, not production closure, until multi-host soak repetition, workload thresholds, recall/latency calibration, and strict rollout evidence are complete.
- [x] Foundation readiness now exposes release-grade verifier commands for both sqlite soak evidence and ANN matrix release gates, so runtime operators no longer have to infer release checks from docs-only task lists.
- [x] A unified foundation release-evidence freshness verifier now checks the latest sqlite soak and ANN release-gate JSON reports, and foundation readiness exposes it as `verify:foundation:release-evidence`.
- [x] A strict foundation release-evidence history verifier is now wired as `verify:foundation:release-evidence:strict`, and foundation readiness exposes it as `foundation_release_evidence_history`; the current Windows host now has 3/3 fresh release-contract reports for sqlite and ANN, so this repeated-evidence gate passes locally without becoming a production-closure claim.
- [x] An opt-in multi-host release-evidence gate is now wired as `verify:foundation:release-evidence:multi-host`, using `--min-host-count 2` / `NOTE_CONNECTION_FOUNDATION_RELEASE_EVIDENCE_MIN_HOST_COUNT` to audit host diversity across valid fresh sqlite and ANN release reports.
- [~] Architecture reduction is the next structural pressure point: `src/server.ts`, `KnowledgeLearningPlatform.ts`, and large frontend hosts still need ownership cuts.
- [x] Agent conversation reply composition is no longer required to live permanently inline inside `KnowledgeLearningPlatform.ts`; the current `conversationComposer` boundary is the first ownership cut on the reply-synthesis path.
- [x] The grouped knowledge-point and scoped reply-section composition path now has a dedicated module owner in `src/learning/conversationComposer.ts`, while preserving the existing `AgentConversationResponse` contract and Tauri/browser rendering behavior.

## 2026-08-17 Phase 9 Route and Mobile Evidence Update

- [x] Route dispatch now supports explicit `legacy|registry` modes; registry remains the default.
- [x] Shadow verification passes with 14 legacy-equivalent probes and 6 registry-only migration probes, including response and side-effect checks.
- [x] Added APK/AAB entry and profile-budget verification with a release-only `--require-rss` gate.
- [x] Added SQLite close/reopen replay and graph atomic-rollback tests.
- [~] Fresh signed arm64 artifact extraction and device RSS remain required; `not-measured` is not release evidence.
- [ ] Canonical public-ID cutover remains blocked until old-snapshot, collision, rollback, and cross-root corpus replay is recorded.

## 2026-08-18 Phase 12 App-Local Projection Replay

- [x] Add `createFileProjectionStore()` as the host-neutral app-local file boundary. Hosts provide `readFile(fileName)` and, when writes are allowed, `writeAtomic(fileName, serialized, projection)`; the persisted payload remains schema-1 projection JSON.
- [x] Make fallback semantics explicit: an initial projection is used only after a host I/O read failure; truncated JSON, size violations, duplicate identities, and unknown future schemas fail closed even when a stale cache exists.
- [x] Route mobile exact analysis through the file boundary with a legacy `createProjectionStore()` fallback, preserving Web/Tauri/Capacitor compatibility while keeping the runtime payload body-free.
- [x] Add `scripts/verify-mobile-projection-replay.js` and `npm run verify:mobile:projection-replay`. The report proves save -> fresh store -> load -> metadata/search/neighbors/path parity for Web, Tauri, Capacitor, and Android adapters, plus truncated/unknown-schema rejection.
- [x] Harden the route-shadow verifier with condition-based runtime-manifest stabilization so asynchronous SQLite initialization cannot create a false read-only side-effect failure.
- [x] Rebuilt the mobile-slim staging after the adapter change: 120 files, 4,253,837 uncompressed bytes, and 1,546,201 estimated compressed bytes; the existing 25 MiB payload budget still passes.
- [~] G2 remains static-only: unsigned arm64 APK/AAB and the 25 MiB compressed payload gate pass, but signed artifacts, physical-device SAF import/query/path workload, and RSS <= 256 MiB are still release gates.
- [~] G3 now has code-level app-local restart replay and four-host fixture evidence; real Android process-death replay and SQLite/WASM adapter promotion remain open.
- [ ] G4 still blocks canonical public-ID migration until old snapshots, move-journal restart, rollback, same-content collisions, and cross-root identity corpora are replayed.

### Phase 12 architectural decision

Keep raw versioned projection JSON as the mobile persistence format. SQLite/WASM is not promoted by default because it adds binary size, startup, heap, and migration cost without being required for the bounded exact-search/path workload. The adapter boundary is intentionally host-owned: Android/Tauri can provide an atomic writer, while Web/Capacitor can remain read-through or provide their native atomic primitive later. A single-writer policy is required before concurrent background imports are enabled.

### Phase 12 acceptance targets

1. Reopening an app-local projection produces byte/schema/metadata/search/neighbors/path equivalence across all four host contracts.
2. A stale cache never masks a corrupt or future schema; only a transport/storage read failure may use the last successful projection.
3. Mobile packaging remains sidecar/Godot/model/SVG free, with the existing 25 MiB compressed asset and 256 MiB resident-memory budgets unchanged.
4. Release claims remain split: static artifact evidence is not a substitute for signed-device SAF and RSS evidence.
- [x] Runtime runbook modular-route composition is no longer inline-only inside `src/server.ts`; `src/routes/runtimeRunbookRouteOps.ts` now owns `/api/knowledge/runtime-capability-runbook/*` route-op assembly while preserving the current response contract.
- [x] Graph-focus now renders the original markdown knowledge point through the shared markdown runtime and highlights matched passages in-place, instead of showing only a snippet list in the right pane.
- [~] Convert sqlite soak verification into repeated release evidence; latest-report freshness, readiness-exposed strict history auditing, current Windows-host strict 3/3 evidence, and opt-in multi-host audit tooling are now automated, while actual multi-host evidence and threshold calibration remain pending.
- [ ] Complete ANN recall/latency and connector-budget calibration before promoting Phase-2 diagnostics to release gates.
- [~] Extract conversation turn-cache, alert-trend, runbook bridge, rollout-profile, and connector-helper logic out of `server.ts` behind explicit modules. The runtime runbook route-op owner is now extracted; the remaining work is the heavier stateful helper surface.
- [ ] Continue learning-platform domain extraction only where the new owner hides state or enforces invariants.
- [ ] Preserve `assistantMessage` compatibility while expanding optional typed `assistantBlocks` coverage.
- [ ] Build a durable evidence / claim projection and learning-loop follow-up surface, using the `ref/ahadiff` comparison as the new reference bar for agent evidence, runtime validation, and review-state maturity.

Primary references:

- `docs/solutions/architecture-progress-alignment-2026-06-06.md`
- `docs/diataxis/en/explanation/development-progress-dashboard.md`
- `docs/en/implementation_plan.md`

### 2026-05-27 Active Task Sync

- [x] Scoped knowledge-workspace grounding is now real on the current branch.
- [x] Provider preset/TOML settings delivery is now real on the current branch.
- [x] Reader-side markdown/KaTeX/Mermaid hardening and Tauri debug capture tooling are now real on the current branch.
- [x] The Tauri agent workspace now has a typed rich-reply baseline instead of `assistantMessage`-only text mounting.
- [x] The Tauri-first plan to evolve toward shared Reader-aligned rich reply rendering is now implemented as the current baseline while preserving knowledge-point/capability compatibility.
- [x] The backend reply composer now uses `assistantBlocks` as a real organization layer in Tauri: overview, explanation, evidence summary, memory notice, and next-action guidance are emitted as distinct blocks instead of only wrapping the old answer text.
- [x] The new Tauri reply sections are no longer template-only: explanation, evidence, and next-action guidance now derive from actual knowledge points, citations, and memory-action hints.
- [x] The reply policy is now intent-aware for Tauri agent output: comparison-style and how-to-style prompts can yield different explanation/action phrasing instead of one generic section style.
- [x] FR-010 is now governed by the current workflow reality instead of the removed transition-era assumption: repo-owned workflows pin `actions/setup-node@v4` to Node 24 and no longer rely on `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`.
- [~] Remote CI closure remains a live release bar rather than a static claim: `Fixrisk Operational Readiness` must stay green on `main`, while residual Node 20 deprecation annotations from marketplace actions remain documented as non-blocking external debt.

Primary references:

- `docs/diataxis/en/explanation/development-progress-dashboard.md`
- `docs/diataxis/en/explanation/agent-conversation-focus-mode-plan.md`
- `docs/en/implementation_plan.md`

### 2026-05-12 Code-vs-Plan Reality Snapshot

- [x] Agent-workspace browser/runtime/Tauri verification closure is real and repeatable on the current branch.
- [x] Phase-3 tutor telemetry, tutor trace/provider trend diagnostics, conversation memory, and memory-policy diagnostics now have concrete backend implementations.
- [~] Phase-1 A8 has advanced to an embedded `graphdb/sqlite` operational baseline and now has restart-durability proof, host-level dist/runtime + packaged sidecar proof, and a host-level workload matrix across `smoke` / `medium` / `heavy`; soak / longer-duration / performance hardening still remain before production closure.
- [~] Phase-1 A8 now also has a dedicated host-level soak/performance verifier path (`verify:foundation:sqlite-runtime:soak`) with structured report output, but release-grade closure still requires sustained threshold tuning and repeated host evidence rather than one passing command.
- [x] Foundation readiness mandatory checks now include `verify:foundation:sqlite-runtime:release` and `verify:foundation:ann-runtime:release`, keeping operator-facing release checks aligned with package scripts.
- [~] Phase-1 A9 now has a live `external_http` sync-backed connector baseline under real query traffic, host-level dist/runtime + packaged sidecar proof, a host-level workload matrix across `smoke` / `medium` / `heavy`, and matrix release-gate evidence, but repeated release-grade calibration still remains before production closure.
- [x] `KnowledgeLearningPlatform.ts` no longer uses placeholder-backed runtime surfaces for query comparison, staleness, learning-quality, and session-plan-quality diagnostics.
- [x] Server bootstrap now injects an active local `tutorAdapter`; the remaining tutor gap is production-proven multi-provider routing rather than default activation.

### 2026-05-10 Cross-Docs Status Note

- This taskboard is synchronized with [Open Goal Audit (2026-05-10)](../open_goal_audit_2026-05-10.md).
- Canonical unresolved-goal decisions must stay aligned with `TODO.md`, `tauri_tasks.md`, and `TEST_REPORT.md`.

### Priority Task Snapshot

- [x] Bridge-first migration baseline is active (`Tauri + Node sidecar + Godot Path Mode`).
- [x] Runtime path adaptation has been integrated for sidecar and frontend data roots.
- [x] Worker runtime resolution has been stabilized for packaged sidecar scenarios.
- [ ] Soak / longer-duration / performance hardening for the embedded graph backend baseline remain pending after the new packaged/runtime and workload-matrix proofs.
- [ ] Promote the new sqlite soak verifier from initial host-level gate to sustained release evidence with repeated runs and tuned thresholds.
- [ ] Production ANN connector threshold convergence and multi-host release-grade calibration remain pending after the new host-level runtime, workload-matrix, and matrix release-gate proofs.
- [ ] Phase-2 quality/query/session diagnostics now need release-grade calibration on top of a release-grade graphdb/ANN baseline.
- [ ] Tutor routing now needs multi-provider hardening beyond the active local-first adapter path.
- [ ] Final Electron decommission readiness checklist remains pending.

### Current Acceptance Targets

1. Default graphdb runtime path is embedded `graphdb/sqlite` and survives restart with persistent query/store diagnostics.
2. The live `external_http` ANN connector path stays healthy under real sync/query telemetry, and its rollout thresholds are tightened for release use.
3. The live query comparison, staleness, learning-quality, and session-plan-quality diagnostics are calibrated on top of a release-grade graphdb/ANN baseline.
4. Tutor routing advances from local-first adapter execution into a production-proven multi-provider policy while keeping explicit fallback behavior.
5. Tauri desktop + Android path remains documented, verified, and cleanly separated from historical Electron context.

### Core Real-Machine Test Commands

- `npm run verify:core-real-machine`
  - Unified orchestration entrypoint for the current core real-machine test slice. Runs the automated foundation/browser/Tauri checks sequentially and writes JSON + Markdown reports under `output/verification/core-real-machine/`.
- `npm run verify:core-real-machine:clean`
  - Same orchestration path, but also restores transient tracked `src-tauri/bin/server-*` dirtiness introduced by the current verification run so the worktree can be kept clean.
- `npm run verify:foundation:sqlite-runtime:matrix`
  - Highest-value host/runtime proof for the embedded sqlite graph backend across `smoke` / `medium` / `heavy` workloads.
- `npm run verify:foundation:sqlite-runtime:soak`
  - Dedicated P1 host/runtime soak and performance gate for the embedded sqlite graph backend. Writes structured JSON reports under `output/verification/foundation-sqlite-runtime/`.
- `npm run verify:foundation:sqlite-runtime:release`
  - Release-named alias for the sqlite soak gate, intended for foundation readiness and release runbooks that need a stable release command name.
- `npm run verify:foundation:ann-runtime:matrix`
  - Highest-value host/runtime proof for the `external_http` ANN connector across `smoke` / `medium` / `heavy` workloads.
- `npm run verify:foundation:ann-runtime:release`
  - Full matrix release-gate path for the `external_http` ANN connector. It writes structured JSON reports under `output/verification/foundation-ann-runtime/` and gates startup, ingest, diagnostics, query latency, and targeted-query recall.
- `npm run verify:foundation:release-evidence`
  - Default backward-compatible audit. Reads the latest sqlite soak and ANN release-gate JSON reports, enforces bounded freshness through `NOTE_CONNECTION_FOUNDATION_RELEASE_EVIDENCE_MAX_AGE_HOURS`, verifies both `dist_node_runtime` and `packaged_sidecar` evidence, counts at least 1 valid fresh report per component, ignores stale/non-release historical reports as warnings, and writes a compact summary under `output/verification/foundation-release-evidence/`.
- `npm run verify:foundation:release-evidence:strict`
  - Strict history audit for release runbooks that need repeated evidence. Runs the same verifier with `--min-report-count 3` and requires each component to have at least 3 fresh reports that satisfy the current sqlite soak or ANN release-gate contract. The current Windows-host evidence passes with sqlite `3/3` and ANN `3/3`; the minimum can also be tuned through `NOTE_CONNECTION_FOUNDATION_RELEASE_EVIDENCE_MIN_REPORT_COUNT`.
- `npm run verify:foundation:release-evidence:multi-host`
  - Opt-in multi-host release audit for release windows that need host diversity. Runs the same verifier with `--min-report-count 3 --min-host-count 2`; host count can also be tuned through `NOTE_CONNECTION_FOUNDATION_RELEASE_EVIDENCE_MIN_HOST_COUNT`. Current Windows-host evidence is still single-host, so release owners must regenerate valid sqlite/ANN release reports on additional hosts before relying on this gate.
- `npm run verify:agent-workspace:browser`
  - Real browser smoke for agent workspace, runbook cards, query/quality/session surfaces, and focus/path flows.
- `npm run verify:agent-workspace:tauri`
  - Real desktop-shell smoke for the current Tauri app path.
- `npm run tauri:dev:mini:gpu`
  - Primary desktop real-machine interactive command when you want to manually drive the app in the mini GPU-enabled shell.
- `npm run tauri:android:dev`
  - Primary Android real-device interactive command when you want to push the current app to a connected device.

### Real-Machine Test Cautions

- `verify:foundation:*` and `verify:core-real-machine*` are engineering-grade verification commands, not just lightweight smoke wrappers. Let them prepare `dist` and the host sidecar instead of manually skipping the prerequisite build path.
- If `build:sidecar`, `ensure-sidecar-ready`, or runtime verification dirties tracked `src-tauri/bin/server-*` files, treat that as transient verification churn. Unless the current task is explicitly about sidecar build, supply, signing, or validation, restore those binary paths back to `HEAD` after the run. Prefer `npm run verify:core-real-machine:clean` when you want the verification flow to auto-restore transient sidecar dirtiness introduced by that run.
- `verify:agent-workspace:browser` uses an isolated Playwright-managed browser session. Do not run it concurrently with other Playwright-driven browser jobs. It is intended to verify NoteConnection, not to take control of an already-open user Chrome window.
- `npm run tauri:dev:mini:gpu` and `npm run tauri:android:dev` are manual interactive real-machine commands. Keep them outside automated CI, drive them manually, and close them yourself after collecting evidence.
- The orchestration report is only trustworthy when the command exits `0` and the generated report under `output/verification/core-real-machine/` shows all automated steps as `PASS`.

## 2026-08-17 Identity Boundary and Mobile Memory Guardrails

- [x] Target/data sync and `NoteConnection` pass explicit workspace roots, keeping `sourceUri` stable across full-workspace and subdirectory scans. Legacy callers that omit the root remain compatibility-only.
- [x] Learning ingest and snapshots retain optional `sourceUri`, `revision`, and `identityAliases`; deletes resolve URI/alias before legacy path fallback.
- [x] Android low-memory graph builds enforce 5,000 documents, 16 MiB per document, 64 MiB total input, and 250,000 edges before reading unbounded content; link candidates are extracted at read time so the intermediate projection does not retain document bodies.
- [x] Move/rename replay preserves the legacy document ID and historical aliases; path-only moves retain optional URI/revision fields.
- [ ] Android folder picking, signed APK/AAB extraction, device RSS, SQLite persistence, registry parity, cross-host replay, and canonical-ID migration remain explicit gates; versioned projection and optional Bridge host execution are delivered.

# 2026-08-17 Phase 10 Versioned Projection and Host Execution

## Delivered

- [x] Added a browser-compatible versioned projection contract with body-free nodes, source URI/revision/aliases, edge provenance, bounded evidence references, and bounded adjacency.
- [x] Capacitor and Tauri Rust graph outputs now emit schema `1` and the same identity fields; Android still avoids retaining document bodies.
- [x] Added an optional `PathBridgeHostAdapter` with correlated operation results, timeout, disconnect cleanup, `AbortSignal`, and explicit cancellation; legacy broadcast remains the fallback.
- [x] Fresh slim staging measures 120 files, 4,251,345 uncompressed bytes, and 1,545,813 estimated compressed bytes.

## Evidence gates

- [ ] Fresh signed arm64 APK/AAB extraction and physical-device RSS under 256 MiB.
- [x] Tauri Android Storage Access Framework folder import for external knowledge trees is implemented; device replay evidence remains open.
- [ ] Cross-host projection replay and old-snapshot/move/rename/collision corpora before canonical-ID migration.
- [x] Phase 8 replay, bounded ingest validation, indexed keyword matching, mobile identity projection, and additive Bridge 2.0 capability/cancellation envelopes are implemented and covered by focused tests.
- [ ] Registry response/status shadow parity, signed Android APK/RSS evidence, SQLite persistence, and canonical public-ID cutover remain evidence-gated.

# 2026-08-18 Phase 11 Projection Store and Android SAF

- [x] Add the host-neutral projection store with persistent/read-through and memory adapters; exact mobile analysis now loads through it.
- [x] Add Web/Tauri/Capacitor/Android fixture replay for schema, metadata, exact search, neighbors, and paths; unknown versions fail closed.
- [x] Make Tauri projection writes atomic and add Android SAF tree import into app-local storage with bounded streaming and request/poll IPC.
- [x] Extend identity corpus coverage for same-content documents, move/rename aliases, and NFC collisions without changing public IDs.
- [~] G2 has fresh unsigned arm64 APK/AAB static evidence under the 25 MiB payload budget, but still lacks signing, physical-device workload, and RSS JSON. Kotlin compilation now succeeds with the available Android toolchain.
- [~] G3 fixture replay passes, but real Android storage replay and SQLite/WASM adapter promotion remain pending.
- [ ] G4 canonical-ID migration remains blocked by old-snapshot rollback and move-journal restart evidence.
