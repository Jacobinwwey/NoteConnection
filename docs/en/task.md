# 2026-03-04 v1.5.13 - Tauri Migration Task Consolidation

## English Document

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
- [ ] Next active task: deepen contradiction detection beyond the current lexical grounding check once an explicit regression corpus exists.
- [ ] Next active task: extend reviewer summaries from current `knowledge_run` inspection into export bundles and longer-horizon operator audits.

### Current Acceptance Targets

1. Public answers never expose `No scoped knowledge points matched`-style internal failure strings.
2. Reviewer decisions remain additive and backward-compatible for all current clients.
3. Operator inspection surfaces show reviewer decision, failed gates, and original/public answer deltas without widening the main answer area.
4. Runtime verification on `waterglass` passes for both compact and spaced aliases and confirms `answerReleaseReview.publicAnswer === result.answer`.

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
- [x] `verify-knowledge-workspace-runtime.js` now treats the compact/spaced `waterglass` pair as the default runtime acceptance matrix, and `npm run verify:knowledge-workspace:runtime` formalizes that gate.
- [ ] Next active task: calibrate the new graph-quality-gate model and continue owner reduction only where a new module owns real invariants or state.
- [ ] Keep the public answer contracted while routing graph evidence, temporal details, and developer trace to secondary surfaces.

### Current Acceptance Targets

1. Active docs distinguish existing DAG data from generic graph database architecture.
2. Public conversation compatibility remains additive: `assistantMessage` stays valid and new graph context fields are optional.
3. Evidence-pane/export surfaces preserve graph connection paths without crowding the main answer.
4. Follow-up implementation starts from context assembly and graph-specific tests, not from prompt-framework adoption.
5. The compact/spaced `waterglass` runtime matrix passes for both `什么是waterglass?` and `什么是water glass`.

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
