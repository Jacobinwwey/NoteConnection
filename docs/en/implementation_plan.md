# 2026-05-12 v1.7.0 - HEAD Realignment Implementation Plan

## English Document

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
- Prompt-framework research should guide contracts and evaluation, not pull Python frameworks into the app runtime.

#### Next execution order

1. Keep the new assembler surface additive and backward-compatible.
2. Keep graph-aware ranking bounded and calibrate it against regression cases instead of drifting back toward degree-driven hubs.
3. Decide whether graph-focus render diagnostics should also be promoted into replay/export-oriented surfaces, now that `knowledge_run` history/compare telemetry is already exported through `runtime.knowledgeRunReports`.
4. Keep graph/debug/evidence detail in evidence/export surfaces, not in the public answer.
5. Calibrate the new graph-specific answer quality gates against more regression cases and operator evidence.
6. Continue owner reduction only when the new module owns real decisions or invariants.

#### Acceptance criteria

1. `assistantMessage` and existing conversation clients remain valid.
2. Graph ops failure falls back to current retrieval-grounded behavior with diagnostics.
3. Right-pane file hits keep source markdown and matched-span highlight behavior.
4. No new broad prompt-framework dependency is introduced into the Tauri/Node runtime.

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
