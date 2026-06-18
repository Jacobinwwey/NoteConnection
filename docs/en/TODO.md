# 2026-04-07 v1.7.0 - Git LFS Migration Build-Flow Audit Closure

## English Document

### 2026-06-18 Final Reply Review TODO Reclassification

- [x] Land the new source-of-truth note in `docs/solutions/agent-final-reply-review-robustness-plan-2026-06-18.md`.
- [x] Reclassify the current agent gap as missing final-answer release review rather than missing prompt-framework adoption.
- [x] Re-audit the slice and confirm that the missing-owner phase is closed; the active gap has moved to broader contradiction coverage and deeper evidence provenance.
- [x] Add `src/learning/answerReleaseReview.ts` as an explicit owner for public-answer `release` / `revise` / `abstain`.
- [x] Extend `src/learning/types.ts` with additive `AnswerReleaseReview` contracts on the response, trace, and `KnowledgeRun`.
- [x] Route composed draft answers through deterministic release gates inside `conversationComposer.ts`.
- [x] Add `claim_grounding_alignment` so grounded drafts that drift away from their own citation/knowledge-point support are revised before release.
- [x] Add Chinese abstention hygiene so scoped Chinese misses no longer degrade into English diagnostic-heavy fallback text.
- [x] Persist reviewer state through `KnowledgeLearningPlatform.ts` and workflow-artifact payloads.
- [x] Promote the screenshot-backed `waterglass` failure into a runtime acceptance rule by requiring reviewer presence and by rejecting public-answer diagnostic leakage in `scripts/verify-knowledge-workspace-runtime.js`.
- [x] Surface reviewer state inside operator evidence panes through `knowledge_run` detail/history cards without widening the public answer area.
- [x] Export compact reviewer summaries through `runtime.knowledgeRunReports[*].answerReleaseReview` so replay/audit surfaces can inspect release decisions without duplicating full answer text.
- [x] Build the first longer-horizon operator audit on top of the exported reviewer summaries: `runtime.knowledgeRunAnswerReleaseAuditSummary` now aggregates reviewer counts, decisions, failed gates, and leakage signals, and the `knowledge_run` history card renders the same multi-run audit shape.
- [x] Extend that aggregate audit into the first review-trend and gate-aging baselines, still derived from the same reviewer telemetry path.
- [x] Extend the same reviewer telemetry path into compare-ready operator drilldowns: recent/prior metric shifts, gate shifts, latest-pair deltas, and compare-card answer-release deltas.
- [x] Formalize a shared alias/scope regression corpus in `src/learning/KnowledgeWorkspaceConversationRegression.ts`, covering the screenshot-derived `waterglass` cases plus cross-scope `financial` recovery cases.
- [x] Drive both Jest and `scripts/verify-knowledge-workspace-runtime.js` from that same deterministic corpus so alias/scope expectations stay aligned across unit and runtime verification.
- [x] Fix the soft-miss planner-scope-recovery bug in `KnowledgeLearningPlatform.ts`: recovery now also runs when noisy in-scope candidates survive reranking but none of them belong to planner title-hit documents.
- [x] Extend the reviewer beyond lexical grounding overlap with a deterministic `claim_structured_consistency` gate for numeric/year contradictions, and cover it with false-positive-resistant unit cases.
- [x] Extend the reviewer beyond lexical + structured-fact overlap with a deterministic `claim_state_consistency` gate for same-subject state contradictions such as `open system` vs `closed system`, and cover it with English/Chinese false-positive-resistant unit cases.
- [x] Extend the reviewer beyond lexical + structured-fact overlap with a deterministic `claim_containment_consistency` gate for same-subject explicit containment/content contradictions such as `contains water` vs `contains oil`, and cover it with English/Chinese false-positive-resistant unit cases.
- [x] Extend the reviewer with deterministic `query_intent_alignment` so `what is` / `什么是` queries revise document-self-description drafts into direct grounded definition answers instead of releasing meta-documentary phrasing.
- [x] Extend the reviewer beyond lexical + structured-fact overlap with a deterministic `claim_subject_consistency` gate for subject-tail drift, so grounded drafts that keep a supported fact tail but swap the grounded subject are revised before release.
- [x] Extend the reviewer beyond lexical + structured-fact overlap with a deterministic `claim_polarity_consistency` gate for explicit positive/negative claim reversals, and cover it with false-positive-resistant unit cases.
- [x] Extend the reviewer beyond lexical + structured-fact + polarity checks with a deterministic `claim_graph_causal_consistency` gate for reversed DAG-backed `causal` direction, and cover it with false-positive-resistant English/Chinese unit cases.
- [x] Extend the reviewer beyond lexical + structured-fact + polarity checks with a deterministic `claim_graph_order_consistency` gate for reversed `prerequisite` / `sequence` claims against the assembled DAG, and cover it with false-positive-resistant unit cases.
- [ ] Extend contradiction coverage beyond the current lexical + query-intent + structured-fact + containment + subject + state + polarity + graph-causal + graph-order gates into broader claim-vs-citation / claim-vs-evidence conflicts without raising false positives.
- [x] Harden the graph-focus payload contract so right-pane source preview/highlight is deterministic even when candidate-path fallback is noisy.
- [x] Tighten graph-focus highlighting beyond payload stability: prefer trusted `line_window` anchors, fall back to `snippet_fallback` when line metadata is absent or stale, and expose additive `highlightStrategy` diagnostics.
- [x] Push block-level markdown source provenance into `src/frontend/markdown_runtime.js`, and let graph focus prefer `source_line_provenance` before `line_window` / `snippet_fallback` when rendered-node source ranges overlap trusted spans.
- [x] Project matched evidence fragments into inline highlight markup inside the selected graph-focus node instead of only tinting the entire paragraph/container.
- [ ] Strengthen source-to-render provenance mapping beyond the current block-level markdown source metadata plus snippet-projected inline highlights, toward source-authenticated character offsets.

### 2026-06-17 Agent Knowledge DAG TODO Reclassification

- [x] Land the 2026-06-17 agent knowledge DAG answer contract note in `docs/solutions/agent-knowledge-dag-answer-contract-plan-2026-06-17.md`.
- [x] Reclassify the project graph requirement as use of the existing DAG-shaped `KnowledgeAtom` / `RelationEdge` / `TemporalEdge` substrate, not a generic graph database replacement.
- [x] Treat DSPy, Guidance, Semantic Kernel, LangChain Core, and LiteLLM as researched design references under `ref/`, not app-runtime dependencies.
- [x] Preserve optional `AgentConversationGraphContext.connectionPaths` through conversation trace, structured answer composition, evidence-pane rendering, workspace export, and focused regression tests.
- [x] Extract the bounded graph-conditioned context assembly layer into `src/learning/graphContextAssembler.ts`, with anchor/support selection, explicit paths, predecessor/successor windows, evidence refs, and graph diagnostics.
- [x] Move ranking beyond relation-degree bonuses: `queryBackend.ts` now scores bounded graph features such as anchor distance, path confidence, prerequisite depth, temporal invalidity penalties, and relation-kind intent bonuses.
- [x] Treat right-pane source rendering as implemented with candidate-path retry, pane-visible graph-focus diagnostics, and durable knowledge-run graph diagnostics for operator review.
- [x] Add graph-specific answer quality gates inside `knowledgeRun.quality.gates` for prerequisite ordering, comparison branches, temporal warnings, graph-op fallback, and bounded graph budgeting.
- [x] Externalize graph-focus render diagnostics through the runtime boundary: the agent workspace now persists interesting graph-focus events into session state, and workspace export derives durable `runtime.graphFocusReports`.
- [x] Preserve graph-focus report history across later session updates by merging `panelState` domains instead of overwriting them wholesale.
- [x] Reproduce and fix the screenshot-backed `什么是waterglass?` compact-alias regression by sharing planner-derived query variants with retrieval scoring instead of loosening the evidence gate.
- [x] Promote the compact/spaced `waterglass` verifier pair into the formal runtime gate via `npm run verify:knowledge-workspace:runtime`.
- [x] Extend the same normalization-contract regression corpus beyond `waterglass`, using explicit alias cases and cross-scope recovery cases rather than prompt-framework or threshold workarounds.

### 2026-06-10 Knowledge Workspace and DAG TODO Reclassification

- [x] Land the 2026-06-10 Knowledge Workspace and DAG alignment note in `docs/solutions/knowledge-workspace-dag-alignment-2026-06-10.md`.
- [x] Reclassify structured grounded conversation, grouped knowledge points, durable `flashcard_batch` / `knowledge_run` artifacts, and workflow-artifact review follow-up as code-backed current-state baselines.
- [x] Reclassify the existing DAG-backed learning substrate as implemented reality rather than future intent: `KnowledgeAtom`, `RelationEdge`, `TemporalEdge`, path queries, and prerequisite-driven learning flows already exist in code.
- [x] Treat the current visible answer area as contracted for this slice: `answer` / `directAnswer` now stays targeted while supporting blocks remain available through secondary panes, traces, artifacts, and exports.
- [~] Treat left-side knowledge-hit interaction as partially complete: it is file-first, but still not fully converged on a right-pane-first reading model.
- [x] The graph-conditioned context-assembly layer between retrieval and answer synthesis is now implemented, so the current DAG is a first-class answer-planning substrate.
- [x] `knowledge_run` pane/history/compare graph telemetry is exported through `runtime.knowledgeRunReports`, and graph-focus render diagnostics are exported through `runtime.graphFocusReports`.
- [ ] Continue reducing ownership pressure in `src/server.ts`, `src/learning/KnowledgeLearningPlatform.ts`, `src/frontend/agent_workspace.js`, and `src/frontend/workspace_panes.js`.
- [ ] Keep root/docs bilingual README, TODO, task, implementation plan, walkthrough, interface, dashboard, and test-report docs aligned whenever this slice changes.

### 2026-06-06 Mainline Architecture TODO Reclassification

- [x] Land the bilingual 2026-06-06 code-vs-plan comparison in `docs/solutions/architecture-progress-alignment-2026-06-06.md`.
- [x] Reclassify Program A-F substrate as implemented rather than merely planned.
- [x] Reclassify scoped retrieval and grounded conversation as operational baselines with backward-compatible response evolution.
- [x] Keep Godot/mobile direct-SVG avoidance as an active compatibility rule through PNG-first render materialization.
- [~] Treat graphdb/sqlite as operational until multi-host repeated soak, threshold, and performance evidence make it release-grade.
- [~] Treat ANN/external connector support as operational until multi-host release-gated recall/latency thresholds and workload calibration are complete; the current Windows-host matrix release-gate evidence is an entry point, not production closure.
- [x] Add a unified foundation release-evidence freshness verifier that reads the latest sqlite soak and ANN release-gate reports, validates report age, required profiles, both runtime modes, soak gates, release gates, and ANN expected recall.
- [x] Add strict release-evidence history verification through `verify:foundation:release-evidence:strict`, `--min-report-count`, and `NOTE_CONNECTION_FOUNDATION_RELEASE_EVIDENCE_MIN_REPORT_COUNT`.
- [x] Close the current Windows-host strict history gate by regenerating sqlite soak and ANN release-gate reports until `verify:foundation:release-evidence:strict` passes with sqlite `3/3` and ANN `3/3`.
- [x] Expose the strict release-evidence history audit through foundation readiness mandatory checks as `foundation_release_evidence_history`, pointing at `npm run verify:foundation:release-evidence:strict`.
- [x] Add opt-in multi-host release-evidence verification through `verify:foundation:release-evidence:multi-host`, `--min-host-count`, and `NOTE_CONNECTION_FOUNDATION_RELEASE_EVIDENCE_MIN_HOST_COUNT`.
- [ ] Collect valid fresh sqlite and ANN release reports on at least two hosts before treating the multi-host gate as satisfied for a release window.
- [ ] Move Phase-2 diagnostics from visibility to release-gate status only after they run on release-grade graphdb/ANN baselines.
- [ ] Extract server-owned conversation turn-cache, alert trend, runbook bridge, rollout profile, and connector-helper logic into explicit modules.
- [ ] Continue KLP domain extraction without adding pass-through facade layers.
- [ ] Keep README, Interface Document, task, implementation plan, and dashboard docs aligned whenever the implementation status changes.

### 2026-05-12 HEAD Truth Reclassification

- [x] Agent-workspace browser/runtime/Tauri verification closure is real on the current branch.
- [x] Tutor telemetry, tutor trace/provider trend diagnostics, conversation memory, and memory-policy diagnostics now have real backend implementations.
- [x] Query-backend comparison/history/trend, staleness diagnostics/rebuild planning, learning-quality history/trend, session-plan quality evaluate/history/trend/runtime-threshold diagnostics, query-backend config, and query-backend diagnostics are now live in `src/learning/KnowledgeLearningPlatform.ts`.
- [x] Default server runtime now injects an active local `tutorAdapter` while retaining the `local` + `cloud` adapter catalog.
- [x] Default runtime graph backend is no longer `local-file-graphdb`: the server now targets embedded `graphdb/sqlite` with explicit file fallback.
- [x] Host-level dist runtime plus packaged sidecar verification now proves the embedded `graphdb/sqlite` baseline across ingest -> store diagnostics/foundation readiness -> restart -> query continuity on the current Windows host (`npm run verify:foundation:sqlite-runtime`).
- [x] Host-level workload-matrix verification now proves the same sqlite baseline across `smoke` / `medium` / `heavy` corpus sizes, snapshot metadata counts, restart continuity, and multi-point retrieval checks in both `dist` runtime and packaged sidecar flows (`npm run verify:foundation:sqlite-runtime:matrix`).
- [x] Foundation readiness mandatory checks now expose the sqlite release alias (`npm run verify:foundation:sqlite-runtime:release`) so release runbooks can reference the soak gate directly.
- [~] The new embedded `graphdb/sqlite` baseline is now restart-durability-proved, host-level runtime-packaging-proved, and host-level workload-envelope-proved across `smoke` / `medium` / `heavy`, but soak / longer-duration / performance hardening still remain before calling A8 production-closed.
- [x] Host-level ANN runtime verification now proves the `external_http` connector baseline across `dist` runtime and packaged sidecar flows with restart continuity and live query-backend diagnostics (`npm run verify:foundation:ann-runtime`).
- [x] Host-level ANN workload-matrix verification now proves the same `external_http` baseline across `smoke` / `medium` / `heavy` corpus sizes, sync/select telemetry, aligned representation metadata, and restart continuity (`npm run verify:foundation:ann-runtime:matrix`).
- [x] Host-level ANN matrix release-gate verification now writes structured reports under `output/verification/foundation-ann-runtime/` and gates startup, ingest, diagnostics, query latency, and targeted-query recall (`npm run verify:foundation:ann-runtime:release`).
- [x] Foundation readiness mandatory checks now expose the ANN matrix release gate (`npm run verify:foundation:ann-runtime:release`) alongside baseline and matrix proofs.
- [x] Foundation readiness mandatory checks now also expose the release-evidence freshness verifier (`npm run verify:foundation:release-evidence`), so release runbooks can verify the latest sqlite and ANN reports before treating host evidence as current.
- [x] Release-evidence verification now scans timestamped sqlite/ANN history reports and counts only fresh reports that satisfy the current release contract; old stale or non-release history files are warnings under the default audit.
- [x] `npm run verify:foundation:release-evidence:strict` now passes on current Windows-host evidence with 3 valid fresh sqlite reports and 3 valid fresh ANN reports.
- [x] Foundation readiness mandatory checks now also expose the strict release-evidence history verifier (`npm run verify:foundation:release-evidence:strict`) so operator readiness shows repeated-evidence status alongside latest-evidence freshness.
- [x] Release-evidence verification now reports `minimumHostCount`, `hostCount`, and `hostKeys`; the new `verify:foundation:release-evidence:multi-host` script requires 3 fresh valid reports and 2 distinct host keys per component.
- [~] Broaden repeated release evidence beyond the current Windows host before treating graphdb/ANN baselines as release-grade.
- [~] Phase-1 A9 now has a live `external_http` connector baseline with remote index sync, host-level runtime proof, host-level workload-matrix proof, and matrix release-gate evidence, but repeated threshold convergence and multi-host calibration still remain before production closure.
- [x] Agent-workspace runbook verify/checks now surface ANN index-sync, circuit, traceability, and prefilter summaries plus threshold/signal drilldowns, while action-queue keeps the index-sync incident drilldown.
- [x] `query_vector_acceleration_prefilter_effectiveness` now shares the ANN fast-lane escalation path instead of lagging behind the other ANN governance checks.
- [x] Agent-workspace runbook verify/checks now also surface ANN circuit budget flags and prefilter calibration-readiness cues, so budget tuning no longer depends on raw JSON inspection.
- [x] Runtime capability matrix/runbook now has explicit gate `query_vector_acceleration_calibration_readiness` to formalize whether ANN threshold tuning can start.
- [x] Agent-workspace runbook verify/checks now also surface the explicit `query_vector_acceleration_calibration_readiness` gate, not only the supporting budget signals.
- [ ] Move the newly surfaced ANN governance budgets from visibility closure to workload/threshold calibration closure, then promote the new Phase-2 diagnostics to release-grade gates only after the same checks run on a release-grade graphdb/ANN baseline.
- [ ] Extend tutor routing from the new local-first baseline into a production-proven multi-provider policy.
- [ ] Continue FR-009 evidence freshness, Linux strict Tauri host provisioning, and final Electron decommission review.

### 2026-05-10 Post-Pull Open-Goal Audit

After syncing the repository to the latest upstream `main` baseline, we re-audited active goal trackers.

- [x] Repository sync completed on branch `feat/knowledge-mastery-foundation-phase1` (latest `origin/main` merged).
- [x] Local pre-pull edits were preserved and re-applied (`src/learning/api.ts`, `src/learning/types.ts`).
- [ ] FR-009 operational evidence closure is still pending (physical-device large-graph capture + freshness verification under `docs/mobile-evidence` governance).
- [x] Final Tauri load-flow parity implementation gates are now contract-verified:
  - [x] Existing-cache prompt strict regression confirmed (`src/source_manager.loadflow.test.ts`, `src/welcome.loadflow.test.ts`).
  - [x] Duplicate load-execution guard across startup/reconnect confirmed (`src/source_manager.loadflow.test.ts`, `npm run verify:agent-workspace:tauri`).
  - [x] Godot center-switch history synchronization accepted (`src/pathmode.history.contract.test.ts`).
- [ ] Linux-host strict Tauri evidence provisioning still remains as an environment/release gate on hosts that must run `verify:agent-workspace:tauri:rust:strict` and `verify:agent-workspace:tauri:window-evidence:strict` (requires `webkit2gtk-4.1`, `javascriptcoregtk-4.1`, `libsoup-3.0`).
- [ ] Final Electron decommission gate review remains pending.
- [~] Phase-1 foundation hardening was previously marked closed, but HEAD now reclassifies it as `Partial+`:
  - [x] Graph backend adapter paths do expose HTTP ops-ready semantics (node/edge/path query routes plus diagnostics telemetry).
  - [x] ANN connector hardening does expose candidate normalization, representation telemetry, and prefilter effectiveness signals.
  - [x] Default runtime now targets an embedded `graphdb/sqlite` backend with explicit file fallback.
  - [x] Embedded sqlite restart durability is now covered by server integration proof (`ingest -> shutdown -> fresh module restart -> query/readiness continuity`).
  - [x] Host-level dist runtime + packaged sidecar verification now proves the same embedded sqlite baseline across ingest/readiness/diagnostics/restart/query continuity (`npm run verify:foundation:sqlite-runtime`).
  - [x] Host-level workload-matrix verification now proves the same embedded sqlite baseline across `smoke` / `medium` / `heavy` corpus sizes plus snapshot metadata/restart/multi-query continuity (`npm run verify:foundation:sqlite-runtime:matrix`).
  - [x] Host-level ANN runtime verification now proves the same `external_http` connector baseline across dist/runtime + packaged sidecar restart continuity (`npm run verify:foundation:ann-runtime`).
  - [x] Host-level ANN workload-matrix verification now proves the same `external_http` connector baseline across `smoke` / `medium` / `heavy` corpus sizes plus sync/select telemetry, aligned representation metadata, and restart continuity (`npm run verify:foundation:ann-runtime:matrix`).
  - [x] The `external_http` ANN path now syncs a remote prefilter index and serves live query traffic under integration proof.
  - [ ] Soak / longer-duration / performance hardening still remains for A8 beyond the new host-level workload matrix proof.
  - [ ] ANN still needs recall/latency threshold convergence and release-grade workload calibration before production closure.
- [ ] Next active implementation phase is now split:
  - [ ] finish the remaining A8 soak / longer-duration / performance closure on top of the new dist/runtime + packaged sidecar + workload matrix proof,
  - [ ] finish the remaining A9 workload/threshold closure on top of the live connector + host-level runtime + workload-matrix baseline,
  - [ ] move next into Phase-2 release-grade gate hardening,
  - [ ] continue Phase-3 tutor/memory hardening in parallel.
  - [x] Agent Workspace browser/runtime route closure now passes real strict evidence (`STRICT`, `UI_STRICT`, `UI_DYNAMIC_STRICT`) with live conversation, capability buttons, and request-card flows.
  - [x] Current Windows host bootstrap reproducibility is engineering-ready (`npm run verify:sidecar:supply` => `offline-ready`).
  - [ ] Remaining Phase 2 work now spans both:
    - operational/release-class gates (`FR-009`, Linux-host strict Tauri evidence provisioning, Electron decommission review),
    - application-layer implementation gaps (real graphdb/ANN delivery plus stronger release-grade calibration for the new quality/query/session diagnostics).
  - [x] Phase 3 implementation can start in parallel without waiting on the above host/evidence prerequisites.

Reference trackers:

- `docs/en/TODO.md`
- `docs/en/task.md`
- `docs/en/tauri_tasks.md`
- `docs/diataxis/en/explanation/development-progress-dashboard.md`

---

### Objective

Turn the Git LFS migration plan into a code-backed, multi-platform build contract that can be checked against current desktop, mobile, publish, release, and docs-delivery paths.

### Completed in This Iteration

- [x] Added a canonical multi-platform build audit document:
  - [x] `docs/en/multi_platform_build_flow_audit.md`
  - [x] `docs/zh/multi_platform_build_flow_audit.md`
- [x] Added Diataxis web-reference pages for the same build matrix:
  - [x] `docs/diataxis/en/reference/multi-platform-build-flows.md`
  - [x] `docs/diataxis/zh/reference/multi-platform-build-flows.md`
- [x] Fixed a real build-contract drift in desktop Tauri full builds:
  - [x] Added `scripts/run-tauri-frontend-build.js`
  - [x] Updated `src-tauri/tauri.conf.json` `beforeBuildCommand`
  - [x] Updated `package.json` `tauri:build:full`
  - [x] Added contract coverage in `src/tauri.frontend.build.contract.test.ts`
- [x] Corrected docs-level platform mismatches:
  - [x] Android JDK baseline now documented as 21+
  - [x] README/docs now distinguish mobile packaging from mobile runtime capability
  - [x] README/docs now link to the new build-flow audit
- [x] Added sidecar supply hardening guardrails without changing CI workflow design:
  - [x] `scripts/sidecar-supply-readiness-utils.js`
  - [x] `scripts/verify-sidecar-supply-readiness.js`
  - [x] `src/sidecar.supply.readiness.contract.test.ts`
  - [x] `docs/en/sidecar_supply_strategy.md`
  - [x] `docs/zh/sidecar_supply_strategy.md`
- [x] Added mirror-feasibility documentation to the MkDocs site and revalidated provider-neutral bootstrap support:
  - [x] `docs/diataxis/en/explanation/sidecar-supply-feasibility.md`
  - [x] `docs/diataxis/zh/explanation/sidecar-supply-feasibility.md`
  - [x] `docs/diataxis-map.json`
  - [x] `mkdocs.yml`
  - [x] `src/godot.sidecar.bootstrap.contract.test.ts`
- [x] Added the first justified CI change for mirror-first Godot release supply while preserving the existing release flow shape:
  - [x] `.github/workflows/release-desktop-multi-os.yml`
  - [x] `src/release.godot.mirror.contract.test.ts`
  - [x] `scripts/sidecar-supply-readiness-utils.js`
  - [x] `scripts/verify-sidecar-supply-readiness.js`
- [x] Updated docs governance/index surfaces:
  - [x] `mkdocs.yml`
  - [x] `docs/index.md`
  - [x] `docs/diataxis-map.json`
  - [x] `docs/BILINGUAL_INDEX.md`
  - [x] `docs/en|zh/Interface Document.md`
  - [x] `docs/en|zh/TODO.md`

### Remaining Work

- [ ] Replace Windows-only helper entrypoints (`build_apk.bat`, `set VAR=...&&` npm wrappers) with Node-based cross-platform runners if local shell portability becomes a priority.
- [ ] Simplify redundant frontend rebuilds in Tauri bundle and npm publish paths when it can be done without changing CI semantics.
- [ ] Continue Phase 2 sidecar-bootstrap hardening until fresh-checkout desktop bootstrap is fully reproducible without repository-stored binaries.

### Verification Gate (Executed)

- [x] `npx jest src/tauri.frontend.build.contract.test.ts --runInBand`
- [x] `npm run docs:diataxis:check`
- [x] `npm run docs:site:build`
- [x] `npm run test:migration`
- [x] `npm run build`
- [x] `npm run build:full`
- [x] `npm run verify:lfs:policy`
- [x] `npm run verify:sidecar:supply`
- [x] `npx jest src/godot.sidecar.bootstrap.contract.test.ts --runInBand`
- [x] `npx jest src/release.godot.mirror.contract.test.ts src/sidecar.supply.readiness.contract.test.ts --runInBand`

---

# 2026-03-22 v1.5.58 - NoteMD Migration Closure & Feasibility Verification

## English Document

### Objective
Fully close the remaining NoteMD migration checklist items and verify end-to-end feasibility with strict robustness constraints (API contracts, regression baseline, build pipeline, and Tauri/Rust runtime checks).

### Completed in This Iteration
- [x] NoteMD integration test closure:
  - [x] `src/notemd.server.integration.test.ts` passed (`1` suite, `4` tests).
  - [x] Full Jest regression passed (`54` suites, `270` tests).
- [x] Build/runtime verification closure:
  - [x] TypeScript compile passed (`node node_modules/typescript/bin/tsc --noEmit`).
  - [x] Full build pipeline scripts passed (`copy-reader-runtime-assets`, `tsc`, `bundle_path_core`, `copy-assets`, `sync-wasm-parity-artifact`).
  - [x] Tauri feasibility check passed (`cargo check` in `src-tauri`).
  - [x] Rust contract suite passed (`scripts/run-tauri-tests.js`, `19` Rust tests).
- [x] Root-cause closure for prior Tauri check flake:
  - [x] Identified stale `src-tauri/target/debug/server.exe` process lock as the direct cause of `tauri-build` `PermissionDenied`.
  - [x] Confirmed deterministic mitigation via sidecar cleanup preflight.
- [x] Documentation closure:
  - [x] Updated `docs/en|zh/Interface Document.md`.
  - [x] Updated `docs/en|zh/README.md`.
  - [x] Updated `docs/en|zh/TODO.md`.
  - [x] Added this cycle's `docs/en|zh/TEST_REPORT.md` entry.
  - [x] Closed remaining Phase-6 checkboxes in `docs/en|zh/extra.md`.

### Remaining Work
- [ ] FR-009 remains pending operational evidence only (physical-device large-graph capture and freshness verification under `docs/mobile-evidence` gate policy).

### Verification Gate (Executed)
- [x] `node node_modules/jest/bin/jest.js src/notemd.server.integration.test.ts --runInBand`
- [x] `node node_modules/jest/bin/jest.js --runInBand`
- [x] `node node_modules/typescript/bin/tsc --noEmit`
- [x] `node scripts/copy-reader-runtime-assets.js`
- [x] `node node_modules/typescript/bin/tsc`
- [x] `node scripts/bundle_path_core.js`
- [x] `node scripts/copy-assets.js`
- [x] `node scripts/sync-wasm-parity-artifact.js`
- [x] `cargo check` (workdir: `src-tauri`)
- [x] `node scripts/run-tauri-tests.js`
- [x] `node scripts/verify-fixrisk-issues.js --strict-pending` (expected pending on FR-009 only)

---

# 2026-03-12 v1.5.57 - Fixrisk High-Priority Closure Plan (Live)

## English Document

### Objective
Complete and verify all `fixrisk_TODO` closure items with executable checks, while preserving robust behavior for large-graph workloads (>10k nodes / >1M edges).

### Verified Closure Snapshot
- [x] FR-001 .. FR-008 closed by code/contracts.
- [x] FR-010 closed by workflow migration to Node24-compatible action runtime.
- [x] FR-011 closed by Java 21 gate hardening:
  - [x] `scripts/verify-tauri-android-prereqs.js` now discovers Java 21 candidates (env slots + common local installation paths).
  - [x] `.github/workflows/migration-gates.yml` provisions Java 21 for tauri-rust suite.
- [x] Deferred hardening slice completed: stricter IPC schema guards for known PathBridge message envelopes with contract coverage.
- [x] Deferred hardening policy slice completed:
  - [x] Unknown envelope-type strict policy (`NOTE_CONNECTION_BRIDGE_REJECT_UNKNOWN_TYPES`).
  - [x] Strict `configure` schema mode (`NOTE_CONNECTION_BRIDGE_STRICT_CONFIG_SCHEMA`).
- [x] Deferred hardening configure-value slice completed:
  - [x] `configure.layout` now enforces an enum (`vertical`/`horizontal`/`radial`/`orbital`).
  - [x] `configure.background` now enforces safe `.exr`/`.hdr` filename rules.
  - [x] `configure.bg_brightness` and `configure.reader_media_scale` now enforce bounded ranges.
  - [x] `configure.targetId` and `configure.target_id` now require coherent values when both are provided.
- [x] Deferred hardening strict-policy gate slice completed:
  - [x] Added executable strict PathBridge verifier (`npm run verify:pathbridge:strict`).
  - [x] Migration and publish workflows now run a dedicated strict PathBridge schema gate.
  - [x] Added strict gate contract coverage (`src/pathbridge.strict.policy.contract.test.ts`).
- [x] Deferred hardening mobile memory ceiling slice completed:
  - [x] Runtime heap policy now distinguishes `desktop`/`android`/`ios` platform ceilings.
  - [x] iOS Jetsam tier support added (`NOTE_CONNECTION_IOS_JETSAM_TIER`).
  - [x] Added iOS memory-bound contract coverage (`src/runtime.heap.policy.contract.test.ts`).
- [x] Deferred hardening SBOM attestation slice completed:
  - [x] Added SBOM attestation generator (`npm run generate:sbom:attestation`).
  - [x] Added SBOM attestation verifier with strict mode (`npm run verify:sbom:attestation -- --strict 1`).
  - [x] Migration and publish workflows now include SBOM attestation policy gates.
  - [x] Release workflow now validates signing key-pair completeness and auto-enforces signature requirement when signing keys are provisioned.
  - [x] Signed attestation key-id lifecycle policy is now enforced (required key-id + allowlist/revocation checks) with contract coverage.
  - [x] Multi-key trust policy is now enforced (minimum RSA strength + rotation overlap + optional keyring policy file) with contract coverage.
  - [x] Signed-attestation provenance linkage is now enforced (immutable release metadata expectations + keyring schema/version pin checks) with contract coverage.
  - [x] Signed-attestation transparency inclusion policy is now enforced (append-only ledger + inclusion proof chain checks + schema/version pinning) with contract coverage.
- [x] Deferred hardening SBOM policy slice completed:
  - [x] CycloneDX SBOM generator is available (`npm run generate:sbom`).
  - [x] SBOM verifier strict mode is available (`npm run verify:sbom -- --strict 1`).
  - [x] Migration and publish workflows now include SBOM contract/policy gates.
- [ ] FR-009 remains pending only on physical-device evidence operations.

### Remaining High-Priority Work (FR-009)
1. Verify device readiness:
   - `node scripts/verify-capacitor-device-acceptance.js`
   - Connect a physical device (emulator-like targets are rejected by default).
   - Use `NOTE_CONNECTION_ALLOW_EMULATOR_EVIDENCE=1` only for non-production emulator experiments.
2. Capture large-graph evidence on device:
   - `NOTE_CONNECTION_EVIDENCE_NODE_COUNT=10000`
   - `NOTE_CONNECTION_EVIDENCE_EDGE_COUNT=1000000`
   - `node scripts/capture-capacitor-device-evidence.js`
3. Run strict evidence freshness checks:
   - `NOTE_CONNECTION_REQUIRE_LARGE_GRAPH_EVIDENCE=1`
   - `NOTE_CONNECTION_MIN_EVIDENCE_NODE_COUNT=10000`
   - `NOTE_CONNECTION_MIN_EVIDENCE_EDGE_COUNT=1000000`
   - `node scripts/verify-capacitor-evidence-freshness.js`
4. Run final strict closure:
   - `node scripts/verify-fixrisk-issues.js --strict-pending`
   - `node scripts/run-fixrisk-ops-closure.js`

### Guardrails
- Keep adaptive runtime memory policy enabled for high node/edge cardinality.
- Keep bounded request-body spool strategy enabled.
- Maintain full contract baseline: `node node_modules/jest/bin/jest.js --runInBand`.
- Godot SVG limitation remains active: avoid relying on direct SVG imports in Godot paths.
  - [x] Added `.detoxrc.json`, `e2e/*`, `scripts/verify-detox-pipeline.js`, `scripts/run-detox-e2e.js`.
  - [x] Added workflow `.github/workflows/mobile-e2e-detox-contracts.yml`.
  - [x] Added `src/detox.pipeline.contract.test.ts`.
- [x] Accessibility closure is now contract-guarded (`src/graph.accessibility.contract.test.ts`).
- [x] Privacy manifest baseline is provisioned and verified.
  - [x] Added `ios/App/PrivacyInfo.xcprivacy`.
  - [x] Added `scripts/verify-privacy-manifest.js`.
  - [x] Added `src/privacy.manifest.contract.test.ts`.

### High-Priority Work Status (Current)
- [x] Runtime, CI contract, accessibility, and privacy-manifest issue tracks are closed for repository scope.
- [ ] Remaining high-priority work from `fixrisk_todo.md`:
  - [ ] Physical multi-device evidence closure for sustained >10k node / >1M edge workloads.

### Verification Gate (Executed)
- [x] `node scripts/verify-detox-pipeline.js`
- [x] `node scripts/verify-privacy-manifest.js`
- [x] `node node_modules/jest/bin/jest.js --runInBand` (**41 suites, 213 tests passed**)
- [x] `node node_modules/typescript/bin/tsc --noEmit`

---

# 2026-03-11 v1.5.54 - High-Priority WASM History Gate Policy Tuning (Enforced-Only Failure in CI)

## English Document

### Objective
Refine high-priority WASM history gating policy so CI remains non-blocking during baseline maturation while still hard-failing true regressions once a profile reaches enforced maturity.

### Completed in This Iteration
- [x] Added policy decision primitive in `src/backend/algorithms/WasmParityHistory.ts`:
  - [x] `decideWasmParityHistoryPerformanceGuardOutcome(...)`.
- [x] Updated `scripts/benchmark-wasm-parity.js`:
  - [x] Added `--history-performance-fail-mode` (`always` | `enforced-only` | `never`).
  - [x] Integrated policy decision into runtime failure behavior:
    - [x] non-enforced profiles can downgrade history guard failures to warnings.
    - [x] enforced profiles still fail hard under `enforced-only`.
  - [x] Readiness artifacts now include policy decision outcome metadata.
- [x] Updated script wiring:
  - [x] `benchmark:wasm:parity:history:ci` -> `--history-performance-fail-mode enforced-only`.
  - [x] `benchmark:wasm:parity:history:release` -> `--history-performance-fail-mode always`.
- [x] Extended contract and unit coverage:
  - [x] `src/backend/algorithms/WasmParityHistory.test.ts` policy matrix tests.
  - [x] `src/wasm.parity.history.gate.contract.test.ts` script/runner wiring assertions.

### High-Priority Work Status (Current)
- [x] CI history-gate behavior is now maturity-aware and operationally resilient.
- [x] Enforced-tier regressions remain blocking; pre-enforced regressions remain visible via warnings.
- [ ] Remaining high-priority work from `fixrisk_todo.md`:
  - [ ] Continue multi-host baseline accumulation until key profiles reach enforced tier.
  - [ ] Complete physical-device p95/p99 evidence closure.

### Verification Gate (Executed)
- [x] `node node_modules/jest/bin/jest.js src/backend/algorithms/WasmParityHistory.test.ts src/wasm.parity.history.gate.contract.test.ts src/wasm.parity.benchmark.guards.contract.test.ts src/mobile.pipeline.test.ts --runInBand` (**4 suites, 29 tests passed**)
- [x] Migration matrix equivalent to `npm run test:migration`: **32 suites, 176 tests passed**
- [x] Full Jest equivalent to `npm test`: **36 suites, 197 tests passed**
- [x] TypeScript compile equivalent to build compile stage:
  - [x] `node node_modules/typescript/bin/tsc`
- [x] Behavioral smoke (warning-only on warming tier) passed.
- [x] Behavioral smoke (hard-fail on enforced tier) passed.

---

# 2026-03-11 v1.5.53 - High-Priority WASM Multi-Host Readiness Visibility (Tiered Baseline Maturity)

## English Document

### Objective
Convert remaining high-priority WASM baseline accumulation risk into a measurable, enforceable readiness model so multi-host maturity can be tracked in CI and release flows without breaking cold-start continuity.

### Completed in This Iteration
- [x] Added history maturity/readiness primitives in `src/backend/algorithms/WasmParityHistory.ts`:
  - [x] Comparable-record selection (`selectComparableWasmParityHistoryRecords`).
  - [x] Tier classification (`bootstrap` / `warming` / `enforced`).
  - [x] Fleet/profile readiness summarization (`summarizeWasmParityHistoryReadiness`).
- [x] Upgraded `scripts/benchmark-wasm-parity.js`:
  - [x] Added new controls:
    - [x] `--history-strict-samples`
    - [x] `--history-maturity-warn-tier`
    - [x] `--history-maturity-fail-tier`
  - [x] Added per-run maturity transition telemetry (`beforeRun` -> `afterRun`).
  - [x] Added readiness artifacts in benchmark output:
    - [x] `history-readiness-latest.json`
    - [x] `history-readiness-latest.md`
    - [x] timestamped readiness JSON/MD snapshots.
- [x] Updated operational scripts/workflow:
  - [x] `benchmark:wasm:parity:history` now includes strict sample target (`--history-strict-samples 15`).
  - [x] `benchmark:wasm:parity:history:ci` includes maturity warning policy (`warming`) while preserving non-blocking cold-start mode.
  - [x] Added `benchmark:wasm:parity:history:release` with `--history-maturity-fail-tier enforced`.
  - [x] CI workflow now prints readiness markdown summary to logs.
- [x] Added/updated regression coverage:
  - [x] `src/backend/algorithms/WasmParityHistory.test.ts`
  - [x] `src/wasm.parity.history.gate.contract.test.ts`

### High-Priority Work Status (Current)
- [x] Multi-host baseline progress is now quantifiable by maturity tiers per host profile.
- [x] CI now surfaces readiness state and preserves bootstrap continuity.
- [ ] Remaining high-priority work from `fixrisk_todo.md`:
  - [ ] Continue accumulating real multi-host corpus until critical profiles reach enforced tier.
  - [ ] Close physical-device p95/p99 evidence loop in real device environment.

### Verification Gate (Executed)
- [x] `node node_modules/jest/bin/jest.js src/backend/algorithms/WasmParityHistory.test.ts src/wasm.parity.history.gate.contract.test.ts src/wasm.parity.benchmark.guards.contract.test.ts src/mobile.pipeline.test.ts --runInBand` (**4 suites, 28 tests passed**)
- [x] Migration matrix equivalent to `npm run test:migration`: **32 suites, 175 tests passed**
- [x] Full Jest equivalent to `npm test`: **36 suites, 196 tests passed**
- [x] TypeScript compile equivalent to build compile stage:
  - [x] `node node_modules/typescript/bin/tsc`
- [x] CI-policy smoke:
  - [x] `node scripts/benchmark-wasm-parity.js --require-wasm-adapter 1 --history-window 30 --minimum-history-samples 5 --history-strict-samples 15 --bootstrap-history-guard 1 --history-maturity-warn-tier warming --history-maturity-fail-tier none --history-max-records 3000 --history-max-age-days 180 --max-candidate-to-history-graph-p95-ratio 1.25 --max-candidate-to-history-layout-p95-ratio 1.25 --max-candidate-to-history-graph-p99-ratio 1.25 --max-candidate-to-history-layout-p99-ratio 1.25 --iterations 1 --nodes 200 --out tmp/wasm-parity-history-ci-smoke --history-file tmp/wasm-parity-history-ci-smoke/history.jsonl`

---

# 2026-03-11 v1.5.52 - High-Priority WASM History Persistence + Readiness Gate (Auto-Strict After Baseline)

## English Document

### Objective
Close the next operational gap by persisting WASM history across CI runs and adding a readiness-aware bootstrap mode so strict history thresholds auto-activate only after baseline sample depth is available.

### Completed in This Iteration
- [x] Updated `scripts/benchmark-wasm-parity.js`:
  - [x] Added `--bootstrap-history-guard` mode.
  - [x] When enabled and comparable sample count is below `--minimum-history-samples`, history ratio thresholds are temporarily skipped for that run.
  - [x] Added explicit bootstrap diagnostics and report fields (`bootstrapHistoryGuard`, `historyGuardBootstrapActive`, `comparableHistorySamples`).
- [x] Updated `package.json`:
  - [x] `benchmark:wasm:parity:history:ci` now uses strict baseline target (`--minimum-history-samples 5`) with bootstrap mode enabled (`--bootstrap-history-guard 1`).
- [x] Updated `.github/workflows/wasm-parity-benchmark-snapshots.yml`:
  - [x] Added history cache restore (`actions/cache/restore@v4`).
  - [x] Added history cache save (`actions/cache/save@v4`).
  - [x] Unified history path via `WASM_HISTORY_FILE` env and shared it across strict/history-aware benchmark steps.
  - [x] Included history directory in uploaded snapshot artifacts.
- [x] Expanded contracts:
  - [x] Updated `src/wasm.parity.history.gate.contract.test.ts` to lock bootstrap script wiring and workflow cache/readiness structure.

### High-Priority Work Status (Current)
- [x] History persistence is now wired across CI runs for parity snapshots.
- [x] Strict history thresholds now have deterministic bootstrap behavior and auto-upgrade after baseline depth is reached.
- [ ] Remaining high-priority work: accumulate multi-host baseline corpus and close physical-device p95/p99 evidence.

### Verification Gate (Executed)
- [x] Focused contracts:
  - [x] `node node_modules/jest/bin/jest.js src/wasm.parity.history.gate.contract.test.ts src/wasm.parity.benchmark.guards.contract.test.ts src/mobile.pipeline.test.ts --runInBand` (**3 suites, 21 tests passed**)
- [x] Migration matrix equivalent to `npm run test:migration`: **31 suites, 168 tests passed**
- [x] Full Jest equivalent to `npm test`: **35 suites, 189 tests passed**
- [x] TypeScript compile equivalent to build compile stage:
  - [x] `node node_modules/typescript/bin/tsc`
- [x] Bootstrap-mode smoke:
  - [x] `node scripts/benchmark-wasm-parity.js --iterations 1 --nodes 200 --out tmp/wasm-parity-bootstrap-smoke --history-file tmp/wasm-parity-bootstrap-smoke/history.jsonl --minimum-history-samples 5 --bootstrap-history-guard 1 --max-candidate-to-history-graph-p95-ratio 1.25 --max-candidate-to-history-layout-p95-ratio 1.25 --max-candidate-to-history-graph-p99-ratio 1.25 --max-candidate-to-history-layout-p99-ratio 1.25`

---

# 2026-03-11 v1.5.51 - High-Priority WASM History Gate Operationalization (CI Snapshot Workflow + Contracts)

## English Document

### Objective
Operationalize the new WASM historical-baseline hardening by wiring history-aware parity checks into CI snapshot workflow and locking the wiring with migration contracts.

### Completed in This Iteration
- [x] Updated `package.json` benchmark scripts:
  - [x] Added `benchmark:wasm:parity:history:ci` (history-aware gate with `minimum-history-samples=1` for CI bootstrap continuity).
  - [x] Kept `benchmark:wasm:parity:history` as stricter operator-focused entrypoint (`minimum-history-samples=5`).
- [x] Updated migration matrix script list:
  - [x] Added `src/wasm.parity.history.gate.contract.test.ts` into `test:migration`.
- [x] Updated `.github/workflows/wasm-parity-benchmark-snapshots.yml`:
  - [x] Strict benchmark snapshot now writes to shared `history.jsonl`.
  - [x] Added explicit history-aware regression gate step using shared history file.
- [x] Added regression contract `src/wasm.parity.history.gate.contract.test.ts`:
  - [x] Verifies script wiring in `package.json`.
  - [x] Verifies snapshot workflow contains strict + history-aware parity checks with shared history path.

### High-Priority Work Status (Current)
- [x] Historical parity guard tooling is now operationalized in CI snapshot workflow (not tooling-only).
- [x] Script/workflow wiring drift is now protected by migration contracts.
- [ ] Remaining high-priority work: accumulate multi-host baseline corpus and close physical-device p95/p99 evidence.

### Verification Gate (Executed)
- [x] Focused contracts:
  - [x] `node node_modules/jest/bin/jest.js src/wasm.parity.history.gate.contract.test.ts src/wasm.parity.benchmark.guards.contract.test.ts src/mobile.pipeline.test.ts --runInBand` (**3 suites, 20 tests passed**)
- [x] Migration matrix equivalent to `npm run test:migration`: **31 suites, 167 tests passed**
- [x] Full Jest equivalent to `npm test`: **35 suites, 188 tests passed**
- [x] TypeScript compile equivalent to `npm run build` compile stage:
  - [x] `node node_modules/typescript/bin/tsc`

---

# 2026-03-11 v1.5.50 - High-Priority WASM Historical Baseline Guarding (Multi-Run Calibration)

## English Document

### Objective
Close the next production-scale parity gap by adding persistent benchmark history and optional history-based p95/p99 guardrails so wasm regressions can be detected against host-specific multi-run baselines instead of single-run snapshots only.

### Completed in This Iteration
- [x] Extended `src/backend/algorithms/WasmParityBenchmarkGuards.ts`:
  - [x] Added historical-baseline guard models (`evaluateWasmParityHistoricalMetricGuard`, `evaluateWasmParityHistoricalPerformanceGuards`).
  - [x] Added median-baseline derivation from finite historical samples.
  - [x] Added explicit failure signaling for missing/insufficient historical samples when strict history thresholds are configured.
- [x] Upgraded `scripts/benchmark-wasm-parity.js`:
  - [x] Added persistent JSONL history sink (`--history-file`, default `<out>/history.jsonl`).
  - [x] Added comparable-history selection keyed by `host + nodeCount + maxWorkers`.
  - [x] Added optional history guard CLI thresholds:
    - [x] `--max-candidate-to-history-graph-p95-ratio`
    - [x] `--max-candidate-to-history-layout-p95-ratio`
    - [x] `--max-candidate-to-history-graph-p99-ratio`
    - [x] `--max-candidate-to-history-layout-p99-ratio`
  - [x] Added minimum sample/window controls (`--minimum-history-samples`, `--history-window`).
- [x] Added npm entrypoint in `package.json`:
  - [x] `benchmark:wasm:parity:history` for strict history-based regression checks.
- [x] Expanded regression contracts:
  - [x] Updated `src/wasm.parity.benchmark.guards.contract.test.ts` with historical baseline pass/fail and insufficient-history cases.

### High-Priority Work Status (Current)
- [x] WASM parity benchmarking now supports persistent multi-run historical baselines.
- [x] History-based p95/p99 regression guarding is now available for production calibration workflows.
- [ ] Remaining high-priority work: accumulate multi-host baseline corpus and close physical-device p95/p99 evidence for mobile release sign-off.

### Verification Gate (Executed)
- [x] Focused benchmark contracts:
  - [x] `node node_modules/jest/bin/jest.js src/wasm.parity.benchmark.guards.contract.test.ts src/wasm.parity.benchmark.contract.test.ts --runInBand` (**2 suites, 15 tests passed**)
- [x] Focused pipeline+guard contracts:
  - [x] `node node_modules/jest/bin/jest.js src/mobile.pipeline.test.ts src/wasm.parity.benchmark.guards.contract.test.ts --runInBand` (**2 suites, 18 tests passed**)
- [x] Migration matrix equivalent to `npm run test:migration`: **30 suites, 165 tests passed**
- [x] Benchmark smoke (history write path):
  - [x] `node scripts/benchmark-wasm-parity.js --iterations 1 --nodes 200 --out tmp/wasm-parity-benchmark-smoke`
- [x] Benchmark smoke (history guard path):
  - [x] `node scripts/benchmark-wasm-parity.js --iterations 1 --nodes 200 --out tmp/wasm-parity-benchmark-smoke --minimum-history-samples 1 --max-candidate-to-history-graph-p95-ratio 10 --max-candidate-to-history-layout-p95-ratio 10 --max-candidate-to-history-graph-p99-ratio 10 --max-candidate-to-history-layout-p99-ratio 10`

---

# 2026-03-11 v1.5.49 - High-Priority Mobile Evidence Hardening (Structured Manifest + Freshness Verifier)

## English Document

### Objective
Close the remaining mobile physical-device evidence robustness gap by moving from markdown-only evidence records to machine-verifiable evidence manifests with freshness and checklist-policy validation.

### Completed in This Iteration
- [x] Enhanced evidence capture in `scripts/capture-capacitor-device-evidence.js`:
  - [x] Generates `acceptance_evidence.json` manifest alongside markdown report.
  - [x] Records structured metadata (device snapshot, artifact paths, checklist status).
  - [x] Adds artifact integrity metadata (`sizeBytes`, `sha256`, `lineCount` where applicable).
  - [x] Maintains rolling pointer `docs/mobile-evidence/latest.json` for deterministic verifier resolution.
- [x] Added verifier script `scripts/verify-capacitor-evidence-freshness.js`:
  - [x] Validates latest evidence manifest availability and artifact existence.
  - [x] Enforces bounded freshness via `NOTE_CONNECTION_EVIDENCE_MAX_AGE_DAYS` (`1..365`, default `30`).
  - [x] Supports strict manual checklist gating via `NOTE_CONNECTION_REQUIRE_MANUAL_MOBILE_CHECKLIST`.
  - [x] Supports controlled evidence-root override via `NOTE_CONNECTION_EVIDENCE_ROOT`.
  - [x] Exports validation helpers for contract-level testing.
- [x] Wired npm script contract:
  - [x] Added `verify:capacitor:evidence` to `package.json`.
- [x] Added regression contracts:
  - [x] New `src/capacitor.evidence.contract.test.ts` covers fresh/stale/manual-strict scenarios.
  - [x] Updated `src/mobile.pipeline.test.ts` to enforce script wiring and key verifier/capture behaviors.
  - [x] Added new evidence contract suite to `test:migration`.

### High-Priority Work Status (Current)
- [x] Mobile evidence is now machine-verifiable and freshness-gated instead of markdown-only.
- [x] Manual verification remains explicit and policy-controlled (optional strict enforcement).
- [ ] Remaining high-priority work: continue broader transport/storage refactors and further production-scale parity hardening.

### Verification Gate (Executed)
- [x] Focused contracts:
  - [x] `node node_modules/jest/bin/jest.js src/capacitor.evidence.contract.test.ts src/mobile.pipeline.test.ts src/server.migration.test.ts --runInBand` (**3 suites, 33 tests passed**)
- [x] Migration matrix equivalent to `npm run test:migration`:
  - [x] `node node_modules/jest/bin/jest.js src/core/Graph.test.ts src/core/PathEngine.test.ts src/core/TreeLayout.test.ts src/backend/algorithms/CycleDetection.test.ts src/backend/algorithms/TopologicalSort.test.ts src/utils/RuntimePaths.test.ts src/server.migration.test.ts src/pkg.sidecar.contract.test.ts src/mobile.pipeline.test.ts src/capacitor.device.utils.contract.test.ts src/capacitor.evidence.contract.test.ts src/runtime.capabilities.test.ts src/runtime.transport.adapter.contract.test.ts src/storage.provider.contract.test.ts src/storage.provider.capacitor.content.contract.test.ts src/storage.provider.capacitor.worker.contract.test.ts src/wasm.parity.runtime.contract.test.ts src/wasm.parity.runtime.functional.test.ts src/wasm.parity.output.equivalence.contract.test.ts src/wasm.parity.benchmark.contract.test.ts src/wasm.parity.benchmark.guards.contract.test.ts src/wasm.parity.artifact.probe.contract.test.ts src/wasm.parity.artifact.provisioning.contract.test.ts src/source_manager.loadflow.test.ts src/capacitor.runtime.contract.test.ts src/welcome.loadflow.test.ts src/pathmode.history.contract.test.ts src/android.pathmode.contract.test.ts src/android.pathmode.smoke.contract.test.ts src/pathbridge.handshake.contract.test.ts --runInBand` (**30 suites, 161 tests passed**)
- [x] Full Jest equivalent to `npm test`: `node node_modules/jest/bin/jest.js` (**34 suites, 182 tests passed**)
- [x] Build pipeline equivalent to `npm run build`:
  - [x] `node scripts/copy-reader-runtime-assets.js`
  - [x] `node node_modules/typescript/bin/tsc`
  - [x] `node scripts/bundle_path_core.js`
  - [x] `node scripts/copy-assets.js`
  - [x] `node scripts/sync-wasm-parity-artifact.js`
- [x] Sidecar pipeline equivalent to `npm run build:sidecar`:
  - [x] `node scripts/build-sidecar.js`
  - [x] `node scripts/ensure-godot-sidecar.js`
  - [x] `node scripts/validate-tauri-sidecars.js`
- [x] WASM strict gates equivalent to `npm run test:wasm:parity:gates`:
  - [x] `node scripts/verify-wasm-parity.js --strict 1`
  - [x] `node scripts/benchmark-wasm-parity.js --require-wasm-adapter 1 --max-candidate-to-baseline-graph-p95-ratio 1 --max-candidate-to-baseline-layout-p95-ratio 1 --max-candidate-to-baseline-graph-p99-ratio 1 --max-candidate-to-baseline-layout-p99-ratio 1`

---

# 2026-03-11 v1.5.48 - High-Priority Clipboard Ingress Scalability (Configurable Binary Limit + Runtime Diagnostics)

## English Document

### Objective
Remove the rigid fixed clipboard binary body threshold and make large PNG ingress configurable, bounded, and observable for high-scale usage while preserving deterministic safety guards.

### Completed in This Iteration
- [x] Refactored clipboard body-limit handling in `src/server.ts`:
  - [x] Replaced fixed `8 MiB` clipboard limit with bounded env-based config.
  - [x] Added `NOTE_CONNECTION_CLIPBOARD_BODY_LIMIT_MB` support.
  - [x] Added hard bounds (`min=1 MiB`, `max=512 MiB`) with clamp/warning behavior.
  - [x] Default limit is now `64 MiB` when env is not provided.
- [x] Added ingress observability to `/api/runtime-diagnostics`:
  - [x] Reports JSON body limit and effective clipboard body limit (`bytes` + `MiB`) and configured range.
- [x] Strengthened migration test coverage in `src/server.migration.test.ts`:
  - [x] Hermetic env override for clipboard limit (`4 MiB`) to stabilize contract tests.
  - [x] Runtime diagnostics contract now verifies ingress limit telemetry fields.
  - [x] Oversize binary test now validates against configured limit, not hardcoded payload size.

### High-Priority Work Status (Current)
- [x] Clipboard binary ingress now scales via bounded configuration instead of a rigid fixed threshold.
- [x] Effective ingress limits are diagnosable at runtime via explicit API telemetry.
- [ ] Remaining high-priority work: continue mobile physical-device parity evidence and broaden wasm kernel coverage where worker cost remains dominant.

### Verification Gate (Executed)
- [x] `node node_modules/jest/bin/jest.js src/server.migration.test.ts --runInBand` (**1 suite, 22 tests passed**)
- [x] Migration matrix equivalent to `npm run test:migration`:
  - [x] `node node_modules/jest/bin/jest.js src/core/Graph.test.ts src/core/PathEngine.test.ts src/core/TreeLayout.test.ts src/backend/algorithms/CycleDetection.test.ts src/backend/algorithms/TopologicalSort.test.ts src/utils/RuntimePaths.test.ts src/server.migration.test.ts src/pkg.sidecar.contract.test.ts src/mobile.pipeline.test.ts src/capacitor.device.utils.contract.test.ts src/runtime.capabilities.test.ts src/runtime.transport.adapter.contract.test.ts src/storage.provider.contract.test.ts src/storage.provider.capacitor.content.contract.test.ts src/storage.provider.capacitor.worker.contract.test.ts src/wasm.parity.runtime.contract.test.ts src/wasm.parity.runtime.functional.test.ts src/wasm.parity.output.equivalence.contract.test.ts src/wasm.parity.benchmark.contract.test.ts src/wasm.parity.benchmark.guards.contract.test.ts src/wasm.parity.artifact.probe.contract.test.ts src/wasm.parity.artifact.provisioning.contract.test.ts src/source_manager.loadflow.test.ts src/capacitor.runtime.contract.test.ts src/welcome.loadflow.test.ts src/pathmode.history.contract.test.ts src/android.pathmode.contract.test.ts src/android.pathmode.smoke.contract.test.ts src/pathbridge.handshake.contract.test.ts --runInBand` (**29 suites, 158 tests passed**)
- [x] Full Jest equivalent to `npm test`: `node node_modules/jest/bin/jest.js` (**33 suites, 179 tests passed**)
- [x] Build pipeline equivalent to `npm run build`:
  - [x] `node scripts/copy-reader-runtime-assets.js`
  - [x] `node node_modules/typescript/bin/tsc`
  - [x] `node scripts/bundle_path_core.js`
  - [x] `node scripts/copy-assets.js`
  - [x] `node scripts/sync-wasm-parity-artifact.js`
- [x] Sidecar pipeline equivalent to `npm run build:sidecar`:
  - [x] `node scripts/build-sidecar.js`
  - [x] `node scripts/ensure-godot-sidecar.js`
  - [x] `node scripts/validate-tauri-sidecars.js`
- [x] WASM strict gates equivalent to `npm run test:wasm:parity:gates`:
  - [x] `node scripts/verify-wasm-parity.js --strict 1`
  - [x] `node scripts/benchmark-wasm-parity.js --require-wasm-adapter 1 --max-candidate-to-baseline-graph-p95-ratio 1 --max-candidate-to-baseline-layout-p95-ratio 1 --max-candidate-to-baseline-graph-p99-ratio 1 --max-candidate-to-baseline-layout-p99-ratio 1`

---

# 2026-03-11 v1.5.47 - High-Priority Godot Clipboard Binary-First Migration (Transport Fallback Contract)

## English Document

### Objective
Complete the Godot client migration slice so clipboard copy prefers binary PNG upload while preserving compatibility with older sidecars that still require base64 JSON transport.

### Completed in This Iteration
- [x] Updated `path_mode/scripts/reader_render_client.gd` clipboard flow:
  - [x] Added binary-first upload call to `POST /api/clipboard/image-binary`.
  - [x] Added compatibility fallback to `POST /api/clipboard/image` (`pngBase64`) when binary route fails.
  - [x] Added merged/explicit error propagation for dual-route failure visibility.
  - [x] Added dedicated binary header builder and `HTTPRequest.request_raw(...)` path.
- [x] Strengthened regression contracts:
  - [x] Added clipboard transport contract assertions in `src/pathbridge.handshake.contract.test.ts`.
  - [x] Contract now enforces binary route presence, `request_raw` usage, and base64 fallback retention.
- [x] Maintained runtime rendering constraints:
  - [x] Godot runtime remains PNG-first.
  - [x] SVG remains diagnostics-only because direct SVG handling in Godot is still unstable.

### High-Priority Work Status (Current)
- [x] Clipboard transport is now binary-first on the Godot client while retaining backward compatibility.
- [x] Server + client transport path now has regression coverage on both sides (API route + client contract).
- [ ] Remaining high-priority work: continue mobile physical-device parity evidence and broaden wasm kernel coverage where worker cost remains dominant.

### Verification Gate (Executed)
- [x] `node node_modules/jest/bin/jest.js src/pathbridge.handshake.contract.test.ts src/server.migration.test.ts --runInBand` (**2 suites, 34 tests passed**)
- [x] Migration matrix equivalent to `npm run test:migration`:
  - [x] `node node_modules/jest/bin/jest.js src/core/Graph.test.ts src/core/PathEngine.test.ts src/core/TreeLayout.test.ts src/backend/algorithms/CycleDetection.test.ts src/backend/algorithms/TopologicalSort.test.ts src/utils/RuntimePaths.test.ts src/server.migration.test.ts src/pkg.sidecar.contract.test.ts src/mobile.pipeline.test.ts src/capacitor.device.utils.contract.test.ts src/runtime.capabilities.test.ts src/runtime.transport.adapter.contract.test.ts src/storage.provider.contract.test.ts src/storage.provider.capacitor.content.contract.test.ts src/storage.provider.capacitor.worker.contract.test.ts src/wasm.parity.runtime.contract.test.ts src/wasm.parity.runtime.functional.test.ts src/wasm.parity.output.equivalence.contract.test.ts src/wasm.parity.benchmark.contract.test.ts src/wasm.parity.benchmark.guards.contract.test.ts src/wasm.parity.artifact.probe.contract.test.ts src/wasm.parity.artifact.provisioning.contract.test.ts src/source_manager.loadflow.test.ts src/capacitor.runtime.contract.test.ts src/welcome.loadflow.test.ts src/pathmode.history.contract.test.ts src/android.pathmode.contract.test.ts src/android.pathmode.smoke.contract.test.ts src/pathbridge.handshake.contract.test.ts --runInBand` (**29 suites, 158 tests passed**)
- [x] Full Jest equivalent to `npm test`: `node node_modules/jest/bin/jest.js` (**33 suites, 179 tests passed**)
- [x] Build pipeline equivalent to `npm run build`:
  - [x] `node scripts/copy-reader-runtime-assets.js`
  - [x] `node node_modules/typescript/bin/tsc`
  - [x] `node scripts/bundle_path_core.js`
  - [x] `node scripts/copy-assets.js`
  - [x] `node scripts/sync-wasm-parity-artifact.js`
- [x] Sidecar pipeline equivalent to `npm run build:sidecar`:
  - [x] `node scripts/build-sidecar.js`
  - [x] `node scripts/ensure-godot-sidecar.js`
  - [x] `node scripts/validate-tauri-sidecars.js`
- [x] WASM strict gates equivalent to `npm run test:wasm:parity:gates`:
  - [x] `node scripts/verify-wasm-parity.js --strict 1`
  - [x] `node scripts/benchmark-wasm-parity.js --require-wasm-adapter 1 --max-candidate-to-baseline-graph-p95-ratio 1 --max-candidate-to-baseline-layout-p95-ratio 1 --max-candidate-to-baseline-graph-p99-ratio 1 --max-candidate-to-baseline-layout-p99-ratio 1`

---

# 2026-03-11 v1.5.46 - High-Priority Clipboard Transport Hardening (Binary PNG Path + Spool-Safe Ingestion)

## English Document

### Objective
Reduce large clipboard payload overhead and JSON/base64 memory pressure by introducing a binary PNG upload route with the same request-size and spool protections used in existing server body guards.

### Completed in This Iteration
- [x] Added binary clipboard API path in `src/server.ts`:
  - [x] New endpoint: `POST /api/clipboard/image-binary`.
  - [x] Accepts `image/png` and `application/octet-stream`.
  - [x] Uses bounded body read with threshold-based spool-to-disk protection.
  - [x] Validates PNG signature before forwarding to native clipboard bridge.
- [x] Preserved compatibility with existing route:
  - [x] Existing `POST /api/clipboard/image` (`pngBase64`) remains available.
  - [x] Added stricter PNG-signature validation to the JSON/base64 route.
- [x] Added migration regression coverage in `src/server.migration.test.ts`:
  - [x] Binary PNG upload success contract.
  - [x] Unsupported binary content-type (`415`) contract.
  - [x] Oversized binary payload (`413`) contract.

### High-Priority Work Status (Current)
- [x] Clipboard transport now has a binary-safe path to avoid mandatory base64 expansion.
- [x] Server ingress protection remains deterministic (size limits + spool handling + typed HTTP errors).
- [ ] Remaining high-priority work: continue mobile physical-device parity evidence and broaden wasm kernel coverage where worker cost remains dominant.

### Verification Gate (Executed)
- [x] `npx jest src/server.migration.test.ts --runInBand` (**1 suite, 22 tests passed**)
- [x] `npm run test:migration` (**29 suites, 157 tests passed**)
- [x] `npm test` (**33 suites, 178 tests passed**)
- [x] `npm run build`
- [x] `npm run build:sidecar`
- [x] `npm run test:wasm:parity:gates`

---

# 2026-03-11 v1.5.45 - High-Priority Sidecar Runtime Hardening (Server Async FS + Non-Blocking Startup)

## English Document

### Objective
Close a remaining high-priority robustness gap by removing synchronous filesystem operations from the Node sidecar server runtime path and enforcing this behavior with regression contracts.

### Completed in This Iteration
- [x] Refactored `src/server.ts` to remove blocking filesystem APIs:
  - [x] Replaced `ensureRuntimeDataDir` and request-body spool directory provisioning with `fs.promises.mkdir(...)`.
  - [x] Replaced sidecar runtime-manifest writes with `fs.promises.writeFile(...)`.
  - [x] Removed sync runtime-data scans and moved CLI cache discovery to async helpers.
  - [x] Replaced sync CLI path-existence heuristics with async fallback resolution in `startServer(...)`.
- [x] Preserved behavior while improving startup/runtime safety:
  - [x] Runtime manifest generation remains deterministic.
  - [x] Cache restore flow now explicitly ensures runtime-data directory before copy.
  - [x] Godot runtime contract remains PNG-first; no SVG runtime dependency introduced.
- [x] Added regression guard:
  - [x] `src/server.migration.test.ts` now asserts `src/server.ts` does not contain `fs.*Sync` calls on runtime/request paths.

### High-Priority Work Status (Current)
- [x] Server runtime/request path no longer relies on blocking fs sync operations.
- [x] Migration, full test matrix, build, sidecar build, and wasm parity gates remain green after refactor.
- [ ] Remaining high-priority work: continue mobile physical-device parity evidence and broaden wasm kernel coverage where worker cost remains dominant.

### Verification Gate (Executed)
- [x] `npx jest src/server.migration.test.ts --runInBand` (**1 suite, 19 tests passed**)
- [x] `npm run test:migration` (**29 suites, 154 tests passed**)
- [x] `npm test` (**33 suites, 175 tests passed**)
- [x] `npm run build`
- [x] `npm run build:sidecar`
- [x] `npm run test:wasm:parity:gates`

---

# 2026-03-10 v1.5.44 - High-Priority WASM Heavy-Compute Expansion (Topological Rank JSON ABI + Async Orchestration)

## English Document

### Objective
Continue high-priority WASM parity closure by moving topological rank assignment onto a real WASM JSON ABI path, while preserving deterministic fallback behavior in GraphBuilder orchestration.

### Completed in This Iteration
- [x] Added rank JSON ABI export in `src/backend/wasm/src/lib.rs`:
  - [x] Added `compute_ranks_json` with Kahn-style topological rank semantics aligned to existing TypeScript behavior.
  - [x] Added `RanksInput`/`RanksOutput` payload contracts.
- [x] Extended WASM runtime adapter in `src/backend/algorithms/WasmParityRuntime.ts`:
  - [x] Added `computeRanks(nodeIds, adjacency, inDegrees)` with strict JSON ABI parsing.
  - [x] Added execution-mode tracking (`json-ranks`) and null fallback on malformed outputs.
- [x] Extended backend orchestration:
  - [x] Added `TopologicalSort.assignRanksAsync(...)` in `src/backend/algorithms/TopologicalSort.ts` (`wasm-adapter -> sequential` fallback).
  - [x] Added topological rank diagnostics (`mode/nodeCount/edgeCount/duration/reason`).
  - [x] Updated `src/backend/GraphBuilder.ts` to use async rank assignment in algorithmic core.
- [x] Strengthened strict artifact readiness:
  - [x] Added `compute_ranks_json` to required exports in `src/backend/algorithms/WasmParityArtifactProbe.ts`.
- [x] Added regression coverage:
  - [x] New `src/backend/algorithms/TopologicalSort.test.ts` (wasm-success + null/incomplete fallback coverage).
  - [x] Updated `src/wasm.parity.runtime.functional.test.ts` with rank JSON ABI success/invalid-shape coverage.
  - [x] Updated `src/wasm.parity.runtime.contract.test.ts` with topological wiring assertions.
  - [x] Updated `src/wasm.parity.artifact.probe.contract.test.ts` expected required-export set.
  - [x] Added `TopologicalSort` suite to `npm run test:migration`.

### High-Priority Work Status (Current)
- [x] Heavy-compute WASM coverage now includes layout + betweenness + cycle detection + topological ranking parity entrypoints.
- [x] Strict artifact gate now requires `compute_ranks_json` in addition to existing JSON ABI exports.
- [ ] Remaining high-priority work: continue mobile physical-device parity evidence and broaden wasm kernel coverage where worker cost remains dominant.

### Verification Gate (Executed)
- [x] `npm run build:wasm:parity`
- [x] `npx jest src/backend/algorithms/TopologicalSort.test.ts src/wasm.parity.runtime.functional.test.ts src/wasm.parity.runtime.contract.test.ts src/wasm.parity.artifact.probe.contract.test.ts src/wasm.parity.artifact.provisioning.contract.test.ts --runInBand` (**5 suites, 22 tests passed**)
- [x] `npm run test:migration` (**29 suites, 153 tests passed**)
- [x] `npm run test:wasm:parity:gates` (strict verify + strict p95/p99 perf guards passed; `compute_ranks_json` present in strict export probe)
- [x] `npx jest --runInBand` (**33 suites, 174 tests passed**)
- [x] `npm run build`
- [x] `npm run build:sidecar`

---

# 2026-03-10 v1.5.43 - High-Priority WASM Heavy-Compute Expansion (Cycle Detection JSON ABI + Async Orchestration)

## English Document

### Objective
Continue high-priority WASM parity closure by moving cycle detection onto the real WASM JSON ABI path with deterministic fallback and CI guard alignment.

### Completed in This Iteration
- [x] Added cycle JSON ABI export in `src/backend/wasm/src/lib.rs`:
  - [x] Added `compute_cycles_json` with iterative DFS cycle detection semantics and optional `limit`.
  - [x] Added `CyclesInput`/`CyclesOutput` payload contract.
- [x] Extended WASM runtime adapter in `src/backend/algorithms/WasmParityRuntime.ts`:
  - [x] Added `computeCycles(nodeIds, adjacency, limit)` with strict JSON ABI parsing.
  - [x] Added execution-mode tracking (`json-cycles`) and safe null fallback on malformed ABI output.
- [x] Extended backend orchestration:
  - [x] Added `CycleDetector.detectCyclesAsync(...)` in `src/backend/algorithms/CycleDetection.ts` (`wasm-adapter -> sequential` fallback).
  - [x] Added cycle compute diagnostics (`mode/nodeCount/edgeCount/limit/duration/reason`).
  - [x] Updated `src/backend/GraphBuilder.ts` to use async cycle detection in algorithmic core.
- [x] Strengthened strict artifact readiness and CI alignment:
  - [x] Added `compute_cycles_json` to required exports in `src/backend/algorithms/WasmParityArtifactProbe.ts`.
  - [x] Updated snapshot workflow `.github/workflows/wasm-parity-benchmark-snapshots.yml` to call `benchmark:wasm:parity:strict:perf` (p95+p99 policy).
- [x] Added regression coverage:
  - [x] `src/backend/algorithms/CycleDetection.test.ts` async wasm/fallback diagnostics coverage.
  - [x] `src/wasm.parity.runtime.functional.test.ts` cycle JSON ABI success/invalid-shape coverage.
  - [x] `src/wasm.parity.runtime.contract.test.ts` cycle + GraphBuilder wiring assertions.
  - [x] `src/wasm.parity.artifact.probe.contract.test.ts` required-export list updated.

### High-Priority Work Status (Current)
- [x] Heavy-compute WASM coverage now includes layout + betweenness + cycle detection parity entrypoints.
- [x] Strict artifact gate now requires `compute_cycles_json`.
- [ ] Remaining high-priority work: continue mobile physical-device parity evidence and broaden WASM kernel coverage where worker cost remains dominant.

### Verification Gate (Executed)
- [x] `npm run build:wasm:parity`
- [x] `npx jest src/backend/algorithms/CycleDetection.test.ts src/wasm.parity.runtime.contract.test.ts src/wasm.parity.runtime.functional.test.ts src/wasm.parity.artifact.probe.contract.test.ts src/wasm.parity.artifact.provisioning.contract.test.ts --runInBand` (**5 suites, 22 tests passed**)
- [x] `npm run test:migration` (**28 suites, 147 tests passed**)
- [x] `npm run test:wasm:parity:gates` (strict verify + strict p95/p99 perf gates passed)
- [x] `npx jest --runInBand` (**32 suites, 168 tests passed**)
- [x] `npm run build`
- [x] `npm run build:sidecar`
- [!] `npm test` (parallel mode) can still hit host memory pressure (`Fatal process out of memory: Zone`) in this environment; sequential gate remains green.

---

# 2026-03-10 v1.5.42 - High-Priority WASM Tail-Latency Guard Hardening (p95 + p99 Strict Gates)

## English Document

### Objective
Continue the high-priority WASM parity closure by upgrading strict performance gating from p95-only evidence to p95+p99 tail-latency enforcement, so benchmark acceptance better reflects production-scale jitter risk.

### Completed in This Iteration
- [x] Extended benchmark guard model in `src/backend/algorithms/WasmParityBenchmarkGuards.ts`:
  - [x] Added p99 ratio/absolute threshold fields.
  - [x] Added p99 failure reasons (`candidate-to-baseline-p99-ratio-exceeded`, `candidate-p99-exceeded-absolute-threshold`).
  - [x] Preserved backward compatibility by safely defaulting missing p99 inputs/config.
- [x] Extended guard plumbing in `scripts/benchmark-wasm-parity.js`:
  - [x] Added p99 CLI args:
    - [x] `--max-candidate-to-baseline-graph-p99-ratio`
    - [x] `--max-candidate-to-baseline-layout-p99-ratio`
    - [x] `--max-candidate-graph-p99-ms`
    - [x] `--max-candidate-layout-p99-ms`
  - [x] Added p99 guard metrics to benchmark report and console diagnostics.
- [x] Strengthened strict perf script in `package.json`:
  - [x] `benchmark:wasm:parity:strict:perf` now enforces both p95 and p99 ratio thresholds.
- [x] Added/updated guard contracts in `src/wasm.parity.benchmark.guards.contract.test.ts`:
  - [x] p99 ratio-threshold regression test.
  - [x] p99 absolute-threshold regression test.
  - [x] Aggregated guard contract now includes p99 paths.
- [x] Preserved runtime compatibility constraints:
  - [x] Godot Mermaid runtime remains PNG-only (`pngBase64` required); this slice does not change Godot rendering assumptions.

### High-Priority Work Status (Current)
- [x] Strict benchmark gates now enforce p95+p99 tail-latency regression barriers.
- [ ] Remaining high-priority work: expand real mobile heavy-compute kernel coverage on wasm path and accumulate physical-device p95/p99 evidence.

### Verification Gate (Executed)
- [x] `npx jest src/wasm.parity.benchmark.guards.contract.test.ts src/wasm.parity.benchmark.contract.test.ts --runInBand`
- [x] `npm run test:wasm:parity:gates`
- [x] `npm run test:migration` (**28 suites, 143 tests passed**)
- [x] `npm test` (**32 suites, 164 tests passed**)
- [x] `npm run build`
- [x] `npm run build:sidecar`

---

# 2026-03-10 v1.5.41 - High-Priority Closure (Mermaid Transport Payload Thinning + Mobile App-ID Compliance)

## English Document

### Objective
Close the remaining high-priority fixrisk follow-ups around Mermaid payload overhead and mobile app identifier compliance while preserving Godot runtime stability.

### Completed in This Iteration
- [x] Mermaid transport is now PNG-first by default:
  - [x] Added `includeSvg` control across `src/server.ts`, `src/core/PathBridge.ts`, and `src/frontend/path_app.js`.
  - [x] `/api/render/mermaid` omits SVG unless explicitly requested (`includeSvg=true`) or diagnostics mode is enabled (`includeStages=true`).
  - [x] Reduced default bridge/API payload volume while keeping diagnostic compatibility.
- [x] Godot runtime contract remains robust under SVG instability:
  - [x] Runtime path remains PNG-only (`pngBase64` required).
  - [x] SVG stays diagnostics-only and is never required by the Godot runtime path.
- [x] Mobile app-id compliance closure landed:
  - [x] `capacitor.config.ts` appId set to `com.jacob.noteconnection.pro`.
  - [x] Android `namespace` + `applicationId` + string resources aligned to `com.jacob.noteconnection.pro`.
  - [x] `MainActivity` moved to the matching Java package path.
- [x] Regression coverage updated:
  - [x] `src/server.migration.test.ts` validates Mermaid response shape defaults and SVG opt-in.
  - [x] `src/pathbridge.handshake.contract.test.ts` validates includeSvg propagation contract.
  - [x] `src/mobile.pipeline.test.ts` validates non-example app-id alignment and legacy package removal.

### Verification Gate (Executed)
- [x] `npx jest src/pathbridge.handshake.contract.test.ts src/server.migration.test.ts src/mobile.pipeline.test.ts --runInBand`
- [x] `npm run test:migration` (**28 suites, 141 tests passed**)
- [x] `npm run test:wasm:parity:gates` (strict verify + strict perf guards passed)
- [x] `npm test` (**31 suites, 159 tests passed**)
- [x] `npm run build`
- [x] `npm run build:sidecar`

---

# 2026-03-10 v1.5.40 - TODO Consistency Repair (Godot PNG Contract + Closed Security Drift Items)

## English Document

### Objective
Fix stale/contradictory TODO entries so the document reflects current runtime contracts and already-implemented security work.

### Completed in This Iteration
- [x] Corrected historical Godot WebSocket wording to align with actual stable URL contract (`ws://127.0.0.1:9876` without query suffix in Godot client path).
- [x] Corrected legacy “SVG fallback” statement for Godot Path Mode: Mermaid runtime contract is PNG-only (`pngBase64` required), SVG is diagnostics-only.
- [x] Closed stale P0 item “Secure sidecar content API to match Rust boundary guarantees” in duplicated migration blocks:
  - [x] `/api/content` KB-root boundary checks are implemented in `src/server.ts`.
  - [x] Regression tests already cover allowed path + outside-root rejection + legacy Windows-style path variants in `src/server.migration.test.ts`.

### Verification Gate (Executed)
- [x] `npx jest src/server.migration.test.ts --runInBand`
- [x] `npx jest src/pathbridge.handshake.contract.test.ts --runInBand`

---

# 2026-03-10 v1.5.39 - High-Priority Bridge Robustness Closure (Typed Envelope + Backpressure + Packaging/CSP Contracts)

## English Document

### Objective
Close the remaining high-priority bridge/runtime robustness gaps from the imported fixrisk baseline without destabilizing existing WASM/mobile workstreams.

### Completed in This Iteration
- [x] `src/core/PathBridge.ts` hardened with strict inbound envelope validation (`parseBridgeInboundEnvelope`) and known-message payload checks.
- [x] Added inbound frame size guard (`MAX_INBOUND_MESSAGE_BYTES`) to prevent oversized message ingestion.
- [x] Added per-client outbound backpressure queue with bounded depth and `bufferedAmount`-gated drain (`BRIDGE_BACKPRESSURE_LIMITS`).
- [x] Added packaging contract coverage via `src/pkg.sidecar.contract.test.ts` and included it in `npm run test:migration`.
- [x] Tightened frontend CSP (`object-src`, `base-uri`, `frame-ancestors`, `form-action`) in `src/frontend/index.html`.
- [x] Reaffirmed Godot Mermaid rendering compatibility contract: runtime path remains PNG-only (`pngBase64` required); SVG is debug-only and is not used as Godot runtime fallback.

### Verification Gate (Executed)
- [x] `npx jest src/pathbridge.handshake.contract.test.ts src/pkg.sidecar.contract.test.ts --runInBand`
- [x] `npm run test:migration` (**28 suites, 135 tests passed**)
- [x] `npm test` (**31 suites, 152 tests passed**)
- [x] `npm run build`

---

# 2026-03-10 v1.5.38 - High-Priority Multi-Terminal WASM Plan Continuation (Mobile WASM Readiness Contract + Capability-Aware Build Telemetry)

## English Document

### Objective
Continue the high-priority WASM parity stream with a concrete multi-terminal implementation plan and the first mobile-facing runtime capability slice, so mobile behavior is diagnosable and fallback remains deterministic.

### Completed in This Iteration
- [x] **Multi-terminal WASM implementation plan added**:
  - [x] `implementation_plan.md`
  - [x] `docs/en/implementation_plan.md`
  - [x] `docs/zh/implementation_plan.md`
  - [x] Plan now explicitly maps mobile bottlenecks, phased rollout, and acceptance gates.
- [x] **Mobile WASM readiness probe integrated** (`src/frontend/source_manager.js`):
  - [x] Added capability fields:
    - [x] `supports_mobile_wasm_compute`
    - [x] `mobile_wasm_reason`
  - [x] Added runtime probe: `detectMobileWasmCapability()`
  - [x] Wired probe output into Capacitor runtime capability resolution and diagnostics logs.
- [x] **Capability-aware mobile build telemetry added** (`src/frontend/storage_provider.js`, `src/frontend/source_manager.js`):
  - [x] Added build-mode detail mapping via `resolveCapacitorBuildModeDetail(...)`.
  - [x] Build result now carries:
    - [x] `buildModeDetail`
    - [x] `supportsMobileWasmCompute`
    - [x] `mobileWasmReason`
  - [x] Source manager now logs mobile build stats/warnings with mode details.
- [x] **Contract coverage updated**:
  - [x] `src/runtime.capabilities.test.ts`
  - [x] `src/capacitor.runtime.contract.test.ts`
  - [x] `src/storage.provider.contract.test.ts`
  - [x] `src/storage.provider.capacitor.worker.contract.test.ts`

### High-Priority Work Status (Current)
- [x] Multi-terminal WASM execution strategy is now explicitly documented and bilingual-synced.
- [x] Mobile runtime now reports explicit WASM readiness and reason instead of implicit behavior.
- [x] Mobile build path now emits capability-aware telemetry while preserving deterministic worker/single-thread fallback.
- [ ] Remaining high-priority work: implement more mobile heavy-compute kernels on real wasm runtime path and validate p95/p99 gains on physical devices.

### Verification Gate (Executed)
- [x] `npx jest src/runtime.capabilities.test.ts src/capacitor.runtime.contract.test.ts src/storage.provider.contract.test.ts src/storage.provider.capacitor.worker.contract.test.ts src/source_manager.loadflow.test.ts --runInBand` (`5` suites, `28` tests passed)
- [x] `npm run test:migration` (`27` suites, `131` tests passed)

---

# 2026-03-10 v1.5.37 - High-Priority Threshold Calibration Continuation (Configurable GraphMetrics Tiering + Calibration Utility + CI Snapshot Integration)

## English Document

### Objective
Continue threshold-calibration closure by making GraphMetrics tiering policy runtime-configurable, adding an evidence-driven calibration utility, and integrating calibration snapshots into CI evidence flow.

### Completed in This Iteration
- [x] **GraphMetrics policy is now runtime-configurable** (`src/backend/GraphMetrics.ts`):
  - [x] Added execution policy model:
    - [x] `asyncNodeCountThreshold`
    - [x] `asyncWorkloadBenefitRatioThreshold`
  - [x] Added env overrides with safe fallback:
    - [x] `NOTE_CONNECTION_GRAPHMETRICS_ASYNC_NODE_THRESHOLD`
    - [x] `NOTE_CONNECTION_GRAPHMETRICS_ASYNC_WORKLOAD_RATIO_THRESHOLD`
  - [x] Added `GraphMetrics.getExecutionPolicy()` for diagnostics/tooling visibility.
- [x] **Tiering policy contracts extended** (`src/wasm.parity.output.equivalence.contract.test.ts`):
  - [x] Added env-override contract for sparse large graph forcing async->wasm path when thresholds are lowered.
  - [x] Added default-fallback contract for invalid env values.
- [x] **Calibration utility added**:
  - [x] New script: `scripts/calibrate-graphmetrics-tiering.js`
  - [x] New npm command: `npm run calibrate:graphmetrics:tiering`
  - [x] Output artifact: `tmp/graphmetrics-tiering-calibration/latest.json` (or custom `--out` path)
  - [x] Includes recommendation payload for threshold tuning from measured profile matrix.
- [x] **CI snapshot integration expanded**:
  - [x] `.github/workflows/wasm-parity-benchmark-snapshots.yml` now also runs GraphMetrics tiering calibration snapshot.
  - [x] Snapshot artifact upload now includes:
    - [x] `tmp/wasm-parity-benchmark/snapshots`
    - [x] `tmp/graphmetrics-tiering-calibration/snapshots`

### High-Priority Work Status (Current)
- [x] Tiering threshold is now tunable without code edits (env-driven policy).
- [x] Evidence-driven calibration tooling is now available for threshold governance.
- [x] CI periodic snapshot flow now captures both wasm parity and GraphMetrics tiering calibration artifacts.
- [ ] Remaining high-priority work: execute multi-iteration, multi-host calibration baselines and converge production threshold values with stronger statistical confidence.

### Verification Gate (Executed)
- [x] `npx jest src/wasm.parity.output.equivalence.contract.test.ts --runInBand` (`7` tests passed)
- [x] `node scripts/calibrate-graphmetrics-tiering.js --iterations 1 --max-workers 4 --out tmp/graphmetrics-tiering-calibration/smoke`
  - [x] calibration artifact emitted at `tmp/graphmetrics-tiering-calibration/smoke/latest.json`
  - [x] recommendation snapshot (current host): `asyncNodeCountThreshold=500`, `asyncWorkloadBenefitRatioThreshold=115.4385`
- [x] `npm run test:wasm:parity:gates` (strict verify + strict perf guards passed)
- [x] `npm run test:migration` (`27` suites, `131` tests passed)

---

# 2026-03-10 v1.5.36 - High-Priority WASM Method-Policy Continuation (Sparsity-Aware GraphMetrics Tiering + Scheduled Snapshot CI + Release Gate Enforcement)

## English Document

### Objective
Proceed the latest method-comparison recommendations end-to-end: close the GraphMetrics method-selection policy gap with sparsity-aware workload tiering, enforce strict wasm parity gates in release flow, and add periodic benchmark snapshots for drift tracking.

### Completed in This Iteration
- [x] **GraphMetrics method policy upgraded to workload-tier selection** (`src/backend/GraphMetrics.ts`):
  - [x] Added explicit async policy constants:
    - [x] `ASYNC_NODE_COUNT_THRESHOLD = 500`
    - [x] `ASYNC_WORKLOAD_BENEFIT_RATIO_THRESHOLD = 24`
  - [x] Added deterministic decision model `resolveExecutionDecision(...)` with reasons:
    - [x] `memory-saving-mode`
    - [x] `small-graph-threshold`
    - [x] `sparse-workload-threshold`
    - [x] `workload-tier-async`
  - [x] Changed runtime orchestration so sparse large graphs remain sequential (avoid low-yield async overhead), while heavy enough workloads still route to `wasm-adapter` -> `worker` fallback chain.
- [x] **Contract coverage updated for policy correctness** (`src/wasm.parity.output.equivalence.contract.test.ts`):
  - [x] Updated wasm-path equivalence fixture graph shape to dense-enough workload tier, preserving expected wasm-path contract.
  - [x] Added sparse-large-graph contract case asserting:
    - [x] wasm betweenness path is not called
    - [x] diagnostics mode is `sequential`
    - [x] diagnostics reason is `sparse-workload-threshold`
- [x] **CI enforcement expanded**:
  - [x] `npm publish` release workflow now enforces strict parity gate before package publish:
    - [x] `.github/workflows/npm-publish.yml`
    - [x] added `npm run test:wasm:parity:gates`
  - [x] Added periodic benchmark snapshot workflow:
    - [x] `.github/workflows/wasm-parity-benchmark-snapshots.yml`
    - [x] weekly cron + manual dispatch
    - [x] strict verify + strict perf benchmark run
    - [x] benchmark snapshot artifact upload (`actions/upload-artifact`)

### High-Priority Work Status (Current)
- [x] GraphMetrics method selection is no longer node-count-only; sparsity/workload characteristics now affect policy.
- [x] Strict wasm parity gating is now enforced in both migration CI matrix and npm release publishing flow.
- [x] Periodic benchmark snapshot automation is now available for longitudinal drift tracking.
- [ ] Remaining high-priority work is threshold calibration refinement across broader workload envelopes and host variability.

### Verification Gate (Executed)
- [x] `npx jest src/wasm.parity.output.equivalence.contract.test.ts --runInBand`
- [x] `npm run test:wasm:parity:gates`
  - [x] GraphMetrics p95 ratio (candidate/baseline): `0.0841`
  - [x] LayoutEngine p95 ratio (candidate/baseline): `0.0011`
- [x] `npm run test:migration` (`27` suites, `129` tests passed)

---

# 2026-03-10 v1.5.34 - High-Priority WASM Performance Guard Closure (Benchmark Threshold Gates + CI Regression Barrier)

## English Document

### Objective
Proceed from artifact provisioning to performance robustness: add enforceable wasm benchmark regression guards so CI can fail fast when candidate wasm performance regresses against baseline.

### Completed in This Iteration
- [x] **Performance guard model added** (`src/backend/algorithms/WasmParityBenchmarkGuards.ts`):
  - [x] Added per-metric guard evaluation for GraphMetrics and LayoutEngine.
  - [x] Supports ratio guard (`candidateP95 / baselineP95`) and absolute candidate p95 guard.
  - [x] Added aggregated pass/fail summary for multi-metric enforcement.
- [x] **Benchmark script hardened with regression thresholds** (`scripts/benchmark-wasm-parity.js`):
  - [x] Added guard args:
    - [x] `--max-candidate-to-baseline-graph-p95-ratio`
    - [x] `--max-candidate-to-baseline-layout-p95-ratio`
    - [x] `--max-candidate-graph-p95-ms`
    - [x] `--max-candidate-layout-p95-ms`
  - [x] Added guard results to benchmark report payload (`equivalence.performanceGuards`).
  - [x] Script now exits non-zero when configured guard thresholds are violated.
- [x] **Contract coverage expanded**:
  - [x] Added `src/wasm.parity.benchmark.guards.contract.test.ts`.
  - [x] Added guard contract suite to `npm run test:migration`.
- [x] **Gate scripts/CI barrier upgraded**:
  - [x] Added `benchmark:wasm:parity:strict:perf`.
  - [x] Updated `test:wasm:parity:gates` to run strict verify + strict perf guard benchmark.
  - [x] Existing CI `wasm-parity-strict-suite` now enforces performance regression barrier through updated gate script.

### High-Priority Work Status (Current)
- [x] WASM artifact is provisioned and `wasm-adapter` path is active under strict mode.
- [x] Strict parity gates now cover both activation and p95 performance regression checks.
- [x] Migration/build/Tauri/full-Jest remain green with enhanced guardrail depth.
- [ ] Remaining high-priority track is production-scale profiling/tuning and long-term threshold calibration.

### Verification Gate (Executed)
- [x] `npm run test:migration` (`27` suites, `128` tests passed)
- [x] `npm run test:wasm:parity:gates` (strict verify + strict perf guards passed)
- [x] `npm run build`
- [x] `npm run test:tauri` (`19` Rust tests passed)
- [x] `npm test` (`30` suites, `145` tests passed)

---

# 2026-03-10 v1.5.33 - High-Priority WASM Artifact Provisioning Closure (Rust WASM ABI Module + Strict Gate Activation + CI Wiring)

## English Document

### Objective
Close the high-priority blocker by provisioning a real wasm parity artifact (instead of fallback-only simulation), then validate strict gate behavior end-to-end.

### Completed in This Iteration
- [x] **Real wasm parity artifact provisioned**:
  - [x] Added Rust wasm crate at `src/backend/wasm/` (`Cargo.toml`, `src/lib.rs`).
  - [x] Implemented required JSON ABI exports:
    - [x] `compute_layout_json`
    - [x] `compute_betweenness_json`
    - [x] `get_last_result_len`
    - [x] `alloc`
    - [x] `dealloc`
    - [x] `memory` export (from wasm module runtime)
  - [x] Implemented deterministic layout output and betweenness Brandes-style directed computation in wasm.
  - [x] Generated and provisioned artifact: `src/backend/wasm/noteconnection_compute.wasm`.
- [x] **Build/runtime synchronization hardened**:
  - [x] Added `scripts/build-wasm-parity-artifact.js` (`npm run build:wasm:parity`) for deterministic artifact build/provision.
  - [x] Added `scripts/sync-wasm-parity-artifact.js` and integrated into `build` / `build:mini` to copy artifact into `dist/src/backend/wasm/`.
  - [x] Added `src/backend/wasm/target/` ignore rule to avoid VCS pollution from Rust build output.
- [x] **Contracts and gates expanded**:
  - [x] Added provisioning contract: `src/wasm.parity.artifact.provisioning.contract.test.ts`.
  - [x] Hardened `src/wasm.parity.artifact.probe.contract.test.ts` to be environment-independent (mocked no-artifact path resolution).
  - [x] Added strict wasm gate script: `npm run test:wasm:parity:gates`.
  - [x] Added strict wasm gate job to CI workflow: `.github/workflows/migration-gates.yml`.
  - [x] Updated `test:gates` to include strict wasm parity gates.

### High-Priority Work Status (Current)
- [x] WASM artifact is now provisioned and discoverable in canonical runtime paths.
- [x] Strict verifier and strict benchmark both pass with active `wasm-adapter` mode.
- [x] Candidate benchmark path now enters `wasm-adapter` for both GraphMetrics and LayoutEngine.
- [x] Full migration/build/Tauri/full-Jest feasibility remains green after provisioning.
- [ ] Remaining optimization work: production-scale perf tuning and long-horizon parity monitoring.

### Verification Gate (Executed)
- [x] `npm run build:wasm:parity`
- [x] `npm run verify:wasm:parity`
- [x] `npm run verify:wasm:parity:strict`
- [x] `npm run benchmark:wasm:parity:strict` (candidate mode reached `wasm-adapter`)
- [x] `npm run test:wasm:parity:gates`
- [x] `npm run test:migration` (`26` suites, `124` tests passed)
- [x] `npm run build`
- [x] `npm run test:tauri` (`19` Rust tests passed)
- [x] `npm test` (`29` suites, `141` tests passed)

---

# 2026-03-10 v1.5.32 - High-Priority WASM Artifact Readiness Closure (Probe + Strict Verify Gate + Full Feasibility Revalidation)

## English Document

### Objective
Continue the high-priority wasm parity stream by making artifact readiness explicit and enforceable, then revalidate end-to-end feasibility with strict/non-strict evidence commands.

### Completed in This Iteration
- [x] **Artifact readiness probe implemented** (`src/backend/algorithms/WasmParityArtifactProbe.ts`):
  - [x] Added required export baseline (`compute_layout_json`, `compute_betweenness_json`, `get_last_result_len`, `alloc`, `dealloc`, `memory`).
  - [x] Added explicit probe result model for `artifact-not-found`, `path-not-found`, export gaps, and instantiation failures.
  - [x] Added reusable missing-export helper for contracts/tooling.
- [x] **Verifier CLI added** (`scripts/verify-wasm-parity.js`):
  - [x] Added args support: `--wasm-path`, `--strict`, `--out`.
  - [x] Added strict-mode non-zero exit when artifact readiness is not met.
  - [x] Added JSON payload output for CI evidence archiving.
- [x] **NPM strict-entry hardening completed** (`package.json`):
  - [x] Added `verify:wasm:parity:strict` to avoid npm arg-forwarding ambiguity with `--strict`.
  - [x] Kept non-strict verifier entrypoint for routine diagnostics (`verify:wasm:parity`).
- [x] **Contract safety net expanded**:
  - [x] Added `src/wasm.parity.artifact.probe.contract.test.ts`.
  - [x] Added probe contract suite into `npm run test:migration`.
- [x] **Benchmark + verifier feasibility evidence refreshed**:
  - [x] Refreshed benchmark evidence at `tmp/wasm-parity-benchmark/latest.json`.
  - [x] Added verifier evidence at `tmp/wasm-parity-benchmark/verify-latest.json`.
  - [x] Confirmed strict verifier/benchmark commands fail as expected when wasm artifact is unavailable.

### High-Priority Work Status (Current)
- [x] Artifact readiness is now explicitly measurable and script-enforceable.
- [x] Strict CI-style gates exist for both verifier and benchmark paths.
- [x] Full migration/build/Tauri/full-Jest gates pass after this slice.
- [ ] Current environment still lacks a wasm artifact; runtime remains worker fallback.
- [ ] Production-scale wasm-adapter parity/performance closure remains open until artifact availability is solved.

### Verification Gate (Executed)
- [x] `npx jest src/wasm.parity.artifact.probe.contract.test.ts --runInBand`
- [x] `npx tsc --pretty false`
- [x] `npm run verify:wasm:parity`
- [x] `npm run verify:wasm:parity:strict` (expected non-zero exit: `artifact-not-found`)
- [x] `npm run benchmark:wasm:parity`
- [x] `npm run benchmark:wasm:parity:strict` (expected non-zero exit: candidate did not reach `wasm-adapter`)
- [x] `npm run test:migration` (`25` suites, `123` tests passed)
- [x] `npm run build`
- [x] `npm run test:tauri` (`19` Rust tests passed)
- [x] `npm test` (`28` suites, `140` tests passed)

---

# 2026-03-10 v1.5.31 - High-Priority Worker↔WASM Baseline Harness (Benchmark Script + Evidence Artifact + Contract Guards)

## English Document

### Objective
Proceed with the remaining high-priority parity closure by adding a reproducible benchmark/equivalence baseline workflow for heavy compute, so worker↔wasm comparisons are evidence-driven and repeatable.

### Completed in This Iteration
- [x] **Benchmark utility module added** (`src/backend/algorithms/WasmParityBenchmark.ts`):
  - [x] Added deterministic heavy-graph fixture builder (`buildDeterministicBenchmarkGraph`).
  - [x] Added percentile latency summary helper (`summarizeDurations`, p50/p95/p99).
  - [x] Added map-equivalence summary helper for betweenness outputs (`summarizeBetweennessDifference`).
- [x] **Runnable benchmark/evidence pipeline added** (`scripts/benchmark-wasm-parity.js`):
  - [x] Added baseline scenario (wasm disabled) and candidate scenario (wasm enabled) execution flow.
  - [x] Collects heavy-compute mode telemetry + latency stats + layout finite-coverage.
  - [x] Writes timestamped and latest JSON evidence artifacts under `tmp/wasm-parity-benchmark/`.
  - [x] Supports both named args (`--iterations`, `--nodes`, `--max-workers`, `--wasm-path`, `--out`) and positional args.
  - [x] Added optional strict gate (`--require-wasm-adapter`) for CI/release environments that must fail if wasm path is not actually active.
- [x] **Contract safety net expanded**:
  - [x] Added `src/wasm.parity.benchmark.contract.test.ts` for benchmark math/fixture invariants.
  - [x] Added benchmark contract suite to `npm run test:migration`.
  - [x] Added npm entrypoint: `npm run benchmark:wasm:parity`.
- [x] **Live feasibility evidence captured**:
  - [x] Executed benchmark and generated report (`tmp/wasm-parity-benchmark/latest.json`).
  - [x] Current environment evidence shows candidate mode remains worker fallback because wasm artifact is not available (`artifact-not-found`).

### High-Priority Work Status (Current)
- [x] Worker↔wasm baseline harness now exists and produces reproducible JSON evidence.
- [x] Equivalence math and latency summaries are now contract-tested.
- [ ] Production wasm artifact parity/performance at scale is still open.
- [ ] Candidate runtime still does not enter `wasm-adapter` mode in current environment until artifact availability is closed.

### Verification Gate (Executed)
- [x] `npx jest src/wasm.parity.benchmark.contract.test.ts --runInBand`
- [x] `node scripts/benchmark-wasm-parity.js 1 500`
- [x] `npx tsc --pretty false`
- [x] `npm run test:migration` (`24` suites, `119` tests passed)
- [x] `npm run build`
- [x] `npm run test:tauri` (`19` Rust tests passed)
- [x] `npm test` (`27` suites, `136` tests passed)

---

# 2026-03-09 v1.5.30 - High-Priority Compute-Mode Telemetry Closure (WASM/Worker/Sequential/GPU Diagnostics + API Surfacing)

## English Document

### Objective
Continue the high-priority parity/robustness stream by making heavy-compute execution mode observable and contract-tested end-to-end, so release verification can confirm real runtime fallback behavior instead of relying on log inspection.

### Completed in This Iteration
- [x] **Heavy-compute diagnostics implemented**:
  - [x] Added `GraphMetrics` compute diagnostics (`none`/`wasm-adapter`/`worker`/`sequential`) with node/edge counts, duration, reason, and timestamp.
  - [x] Added `LayoutEngine` compute diagnostics (`none`/`gpu`/`wasm-adapter`/`worker`/`skipped`) with the same telemetry fields.
  - [x] Added deterministic reset hooks for test isolation in both engines.
- [x] **Server telemetry surface expanded** (`src/server.ts`):
  - [x] `GET /api/runtime-diagnostics` now includes `computeModes` snapshot (`layoutEngine`, `graphMetrics`).
  - [x] `POST /api/build` success and dedup responses now include `computeModes` snapshot for immediate build-path observability.
- [x] **Contract coverage expanded**:
  - [x] `src/server.migration.test.ts` now asserts `computeModes` shape in runtime diagnostics and build responses.
  - [x] `src/wasm.parity.output.equivalence.contract.test.ts` now asserts telemetry mode/reason for wasm path, sequential threshold path, and worker-unavailable layout fallback path.
- [x] **Full feasibility revalidation completed** with updated suite/test totals.

### High-Priority Work Status (Current)
- [x] Heavy-compute runtime path (WASM/worker/sequential/GPU/skipped) is now API-visible and contract-guarded.
- [x] Deterministic fallback behavior remains unchanged while observability depth increased.
- [ ] Production wasm artifact parity/performance at real workload scale remains open.
- [ ] Real workload worker↔wasm benchmark baselines (throughput, p95/p99 latency, memory profile) remain open.

### Verification Gate (Executed)
- [x] `npx jest src/wasm.parity.output.equivalence.contract.test.ts src/server.migration.test.ts --runInBand`
- [x] `npx tsc --pretty false`
- [x] `npm run test:migration` (`23` suites, `114` tests passed)
- [x] `npm run build`
- [x] `npm run test:tauri` (`19` Rust tests passed)
- [x] `npm test` (`26` suites, `131` tests passed)

---

# 2026-03-09 v1.5.29 - High-Priority Runtime Observability Closure (Sidecar Diagnostics Endpoint + WASM State Exposure)

## English Document

### Objective
Continue high-priority robustness closure by exposing sidecar runtime diagnostics through an authenticated API surface, including wasm parity runtime state for fast feasibility triage.

### Completed in This Iteration
- [x] **Runtime diagnostics API added** (`src/server.ts`):
  - [x] Added `GET /api/runtime-diagnostics`.
  - [x] Returns sidecar runtime context (host/port/paths/auth-required) without leaking auth secrets.
  - [x] Includes `WasmParityRuntime.getDiagnostics()` output for parity state introspection.
  - [x] Includes PathBridge summary/status when available.
- [x] **Migration contract coverage expanded** (`src/server.migration.test.ts`):
  - [x] Added endpoint contract test for `/api/runtime-diagnostics`.
  - [x] Added explicit assertion that auth token is not exposed in diagnostics payload.
- [x] **Full feasibility revalidation completed**:
  - [x] Migration/build/Tauri/full Jest gates pass after diagnostics endpoint integration.

### High-Priority Work Status (Current)
- [x] Runtime observability now includes wasm parity diagnostics at server API level.
- [x] Sidecar diagnostics can be consumed by tooling/QA without exposing credentials.
- [ ] Production wasm artifact parity/performance at scale remains open.
- [ ] Worker ↔ wasm benchmark-equivalence baselines remain open.

### Verification Gate (Executed)
- [x] `npx jest src/server.migration.test.ts src/wasm.parity.runtime.functional.test.ts src/wasm.parity.output.equivalence.contract.test.ts --runInBand`
- [x] `npx tsc --pretty false`
- [x] `npm run test:migration` (`23` suites, `112` tests passed)
- [x] `npm run build`
- [x] `npm run test:tauri` (`19` Rust tests passed)
- [x] `npm test` (`26` suites, `129` tests passed)

---

# 2026-03-09 v1.5.28 - High-Priority WASM Runtime Resilience (Retry Window + Diagnostics + Fallback Contracts)

## English Document

### Objective
Continue high-priority WASM parity hardening by making runtime fallback recoverable after missing artifacts, adding diagnostics visibility, and expanding functional contracts for retry-window behavior.

### Completed in This Iteration
- [x] **WASM runtime resilience hardening** (`src/backend/algorithms/WasmParityRuntime.ts`):
  - [x] Added retry-window mechanism for failed/missing artifact loads (`NOTE_CONNECTION_WASM_RETRY_MS`, default 5000ms) to avoid permanent null-cache lock.
  - [x] Added runtime diagnostics surface:
    - [x] `getDiagnostics()`
    - [x] `WasmParityRuntimeDiagnostics`
    - [x] `WasmParityExecutionMode`
  - [x] Added explicit execution-mode tracking (`json-layout`, `json-betweenness`, `legacy-*`, `fallback`).
  - [x] Added deterministic test-reset helper (`__resetForTests()`).
- [x] **Functional parity contracts expanded** (`src/wasm.parity.runtime.functional.test.ts`):
  - [x] Added diagnostics assertion after JSON ABI success.
  - [x] Added retry-window contract ensuring failed loads are not retried before retry interval, but do retry after interval.
- [x] **Full gate revalidation completed**:
  - [x] Migration/build/Tauri/full Jest gates all pass with updated test matrix.

### High-Priority Work Status (Current)
- [x] WASM runtime fallback is now recoverable across runtime lifecycle instead of permanently cached null.
- [x] Diagnostics and execution-mode visibility are available for parity troubleshooting and release verification.
- [ ] Production wasm artifact parity/performance at scale remains open.
- [ ] Worker ↔ wasm benchmark-equivalence baselines remain open.

### Verification Gate (Executed)
- [x] `npx jest src/wasm.parity.runtime.functional.test.ts src/wasm.parity.runtime.contract.test.ts src/wasm.parity.output.equivalence.contract.test.ts --runInBand`
- [x] `npx tsc --pretty false`
- [x] `npm run test:migration` (`23` suites, `111` tests passed)
- [x] `npm run build`
- [x] `npm run test:tauri` (`19` Rust tests passed)
- [x] `npm test` (`26` suites, `128` tests passed)

---

# 2026-03-09 v1.5.27 - High-Priority WASM Parity Hardening (Output-Equivalence Contracts + Worker-Lazy Fallback Resolution)

## English Document

### Objective
Continue high-priority WASM parity closure by adding orchestration-level output-equivalence contracts and reducing unnecessary worker fallback overhead when wasm results are already available.

### Completed in This Iteration
- [x] **Output-equivalence orchestration contracts added**:
  - [x] Added `src/wasm.parity.output.equivalence.contract.test.ts`.
  - [x] Added parity assertions for:
    - [x] `GraphMetrics.calculateBetweennessAsync(...)` using wasm-returned map equivalence with sequential baseline map.
    - [x] `LayoutEngine.computeLayout(...)` applying wasm node positions exactly.
  - [x] Added the suite to `npm run test:migration`.
- [x] **Layout fallback-path efficiency hardening** (`src/backend/algorithms/LayoutEngine.ts`):
  - [x] Reordered runtime flow so worker runtime resolution/logging occurs only when gpu/wasm paths do not satisfy the request.
  - [x] Kept deterministic worker fallback behavior unchanged.
- [x] **Full feasibility revalidation completed**:
  - [x] Migration/build/Tauri/full Jest gates all pass after the new contracts + runtime refactor.

### High-Priority Work Status (Current)
- [x] Runtime-level WASM orchestration now has functional + output-equivalence contract coverage.
- [x] Layout path no longer performs unnecessary worker-runtime resolution when wasm already returns results.
- [ ] Production wasm artifact equivalence at scale remains open.
- [ ] Worker ↔ wasm performance-benchmark baselines remain open.

### Verification Gate (Executed)
- [x] `npx jest src/wasm.parity.output.equivalence.contract.test.ts src/wasm.parity.runtime.functional.test.ts src/wasm.parity.runtime.contract.test.ts --runInBand`
- [x] `npx tsc --pretty false`
- [x] `npm run test:migration` (`23` suites, `109` tests passed)
- [x] `npm run build`
- [x] `npm run test:tauri` (`19` Rust tests passed)
- [x] `npm test` (`26` suites, `126` tests passed)

---

# 2026-03-09 v1.5.26 - High-Priority WASM Parity Continuation (JSON ABI Result Path + Functional Contracts + Full Gate Revalidation)

## English Document

### Objective
Continue the high-priority WASM parity implementation by closing the runtime JSON ABI result path, adding functional regression contracts for decode/fallback behavior, and revalidating full project feasibility gates.

### Completed in This Iteration
- [x] **WASM JSON ABI result path implemented** (`src/backend/algorithms/WasmParityRuntime.ts`):
  - [x] Added JSON ABI entrypoints support: `compute_layout_json`, `compute_betweenness_json`.
  - [x] Added memory ABI primitives support: `alloc`, `dealloc`, `get_last_result_len`, `memory`.
  - [x] Added generic JSON ABI invocation flow (`invokeJsonAbiCall`) with deterministic fallback and safe deallocation guards.
  - [x] Added structured decoders for result payloads:
    - [x] `toLayoutResult(...)`
    - [x] `toBetweennessResult(...)`
- [x] **Functional regression coverage expanded**:
  - [x] Added `src/wasm.parity.runtime.functional.test.ts` to validate:
    - [x] layout JSON ABI success path
    - [x] betweenness JSON ABI success path
    - [x] incomplete ABI fallback (`null`)
    - [x] invalid JSON fallback (`null`)
  - [x] Added this suite to `npm run test:migration` in `package.json`.
- [x] **Feasibility gates revalidated end-to-end**:
  - [x] Targeted parity tests + type-check pass.
  - [x] Migration/build/Tauri/full Jest gates pass.

### High-Priority Work Status (Current)
- [x] Heavy compute runtime now supports JSON ABI result ingestion when wasm artifact exports are available.
- [x] Existing worker/sequential execution remains deterministic fallback when wasm runtime/ABI is missing or invalid.
- [ ] Production wasm artifact parity for full-scale layout/centrality workloads still needs closure.
- [ ] Node worker ↔ wasm output-equivalence/performance regression baselines still need closure.

### Verification Gate (Executed)
- [x] `npx jest src/wasm.parity.runtime.contract.test.ts src/wasm.parity.runtime.functional.test.ts --runInBand`
- [x] `npx tsc --pretty false`
- [x] `npm run test:migration` (`22` suites, `107` tests passed)
- [x] `npm run build`
- [x] `npm run test:tauri` (`19` Rust tests passed)
- [x] `npm test` (`25` suites, `124` tests passed)

---

# 2026-03-09 v1.5.25 - High-Priority WASM Parity Slice Start (Heavy Graph/Layout Runtime Adapter + Deterministic Fallback)

## English Document

### Objective
Start the WASM parity implementation slice for heavy graph/layout compute by wiring a shared backend WASM runtime adapter into existing heavy compute entrypoints while keeping deterministic fallback behavior.

### Completed in This Iteration
- [x] **WASM parity runtime adapter added**:
  - [x] Added `src/backend/algorithms/WasmParityRuntime.ts` with:
    - [x] capability gate (`NOTE_CONNECTION_ENABLE_WASM_PARITY`)
    - [x] artifact resolution (`NOTE_CONNECTION_WASM_PATH` + default wasm candidates)
    - [x] cached wasm instance loading with robust failure fallback
    - [x] parity entrypoints: `computeLayout()` and `computeBetweenness()`
- [x] **Heavy compute wiring updated**:
  - [x] `src/backend/algorithms/LayoutEngine.ts` now attempts `WasmParityRuntime.computeLayout(...)` before worker path.
  - [x] `src/backend/GraphMetrics.ts` now attempts `WasmParityRuntime.computeBetweenness(...)` before worker/sequential path (for non-memory-saving large graphs).
- [x] **Regression guardrails added**:
  - [x] Added `src/wasm.parity.runtime.contract.test.ts`.
  - [x] Added wasm parity contract suite to `npm run test:migration` in `package.json`.
- [x] **Risk/TODO synchronization completed**:
  - [x] Updated root/EN/ZH fixrisk docs and TODO streams to reflect real verified state.

### High-Priority Work Status (Current)
- [x] WASM parity runtime adapter is now integrated into heavy compute call paths.
- [x] Existing worker/sequential behavior remains deterministic and intact when wasm artifact/ABI is unavailable.
- [ ] WASM memory ABI + result-output contract for actual layout/centrality compute is still open.
- [ ] Node worker ↔ WASM output equivalence tests are still open.

### Verification Gate (Executed)
- [x] `npx jest src/wasm.parity.runtime.contract.test.ts src/storage.provider.capacitor.worker.contract.test.ts src/runtime.capabilities.test.ts --runInBand`
- [x] `npm run test:migration` (`21` suites, `103` tests passed)
- [x] `npm run build`
- [x] `npm run test:tauri` (`19` Rust tests passed)
- [x] `npm test` (`24` suites, `120` tests passed)

---

# 2026-03-09 v1.5.24 - High-Priority Mobile Compute Continuation (Capacitor Worker-First Build Fallback + Full Gate Revalidation)

## English Document

### Objective
Continue the open high-priority mobile runtime parity slice by adding worker-first local graph compute on native Capacitor, with deterministic fallback behavior and full feasibility revalidation.

### Completed in This Iteration
- [x] **Capacitor worker-first build path implemented** (`src/frontend/storage_provider.js`):
  - [x] Added worker capability detection (`supportsCapacitorGraphBuildWorker`) and URL API safety checks.
  - [x] Added blob-worker compute execution (`runCapacitorGraphBuildWorker`) with strict timeout guard (`CAPACITOR_GRAPH_BUILD_WORKER_TIMEOUT_MS`).
  - [x] Added deterministic fallback orchestrator (`buildCapacitorGraphDataWithWorkerFallback`) to preserve availability on unsupported/failed worker runtimes.
  - [x] Added build-mode observability (`worker`, `single-thread`, `single-thread-fallback`) in Capacitor build stats.
- [x] **Regression safety net expanded**:
  - [x] Updated `src/storage.provider.contract.test.ts` and `src/capacitor.runtime.contract.test.ts` for worker fallback assertions.
  - [x] Added `src/storage.provider.capacitor.worker.contract.test.ts`.
  - [x] Added worker contract suite into `npm run test:migration` matrix in `package.json`.
- [x] **Risk/TODO tracking sync**:
  - [x] Updated `docs/fixrisk_TODO.md`, `docs/en/fixrisk_TODO.md`, `docs/zh/fixrisk_TODO.md` to reflect real post-change state.

### High-Priority Work Status (Current)
- [x] Mobile local graph build is now worker-first with deterministic single-thread fallback.
- [x] Full CI-style verification gates pass after the new worker path and contract additions.
- [ ] Desktop-equivalent Node-worker/WASM compute parity on mobile remains open.
- [ ] Physical-device evidence closure remains environment-dependent (requires online Android device).

### Verification Gate (Executed)
- [x] `npx jest src/storage.provider.contract.test.ts src/capacitor.runtime.contract.test.ts src/storage.provider.capacitor.worker.contract.test.ts --runInBand`
- [x] `npm run test:migration` (`20` suites, `100` tests passed)
- [x] `npm run build`
- [x] `npm run test:tauri` (`19` Rust tests passed)
- [x] `npm test` (`23` suites, `117` tests passed)

---

# 2026-03-09 v1.5.23 - High-Priority Mobile Runtime Continuation (Capacitor Local Build Fallback + Runtime Provider Unification)

## English Document

### Objective
Proceed on the unresolved high-priority mobile runtime scope by removing the hard read-only lock in native Capacitor mode and introducing an on-device local graph build/cache fallback that does not rely on localhost sidecar transport.

### Completed in This Iteration
- [x] **Capacitor local build fallback implemented** (`src/frontend/storage_provider.js`):
  - [x] Added guarded filesystem helpers for read/write/readdir/stat with permission orchestration and path normalization.
  - [x] Added markdown collection limits (`CAPACITOR_GRAPH_BUILD_MAX_FILES`, `CAPACITOR_GRAPH_BUILD_MAX_BYTES`) to prevent unbounded mobile build pressure.
  - [x] Added lightweight on-device graph generation (`collectCapacitorMarkdownFiles` + `buildCapacitorGraphData` + `capacitorBuildGraph`).
  - [x] Added Capacitor cache contracts for `checkCache`/`restoreCache` and runtime-generated asset preference in `readGeneratedAsset`.
- [x] **Source-manager runtime flow upgraded** (`src/frontend/source_manager.js`):
  - [x] Added `supportsCapacitorBuildApi()` capability detection and mapped `supports_build` dynamically for native Capacitor runtime.
  - [x] Removed hard pre-click Capacitor read-only block; load flow now follows cache/build guards uniformly.
  - [x] Switched Capacitor data asset load to storage-provider runtime path for generated `data.js` pickup.
  - [x] Updated Capacitor source list population to include folders + cached targets via storage provider.
- [x] **Contract suite updates**:
  - [x] Updated `src/capacitor.runtime.contract.test.ts` for capability-detected mobile build path.
  - [x] Updated `src/storage.provider.contract.test.ts` for Capacitor local build fallback invariants.

### High-Priority Work Status (Current)
- [x] Native Capacitor runtime is no longer hard-locked to read-only mode when filesystem write/readdir APIs are available.
- [x] Mobile can execute local single-thread markdown graph build fallback and persist cache artifacts for reload.
- [ ] Desktop-equivalent worker-grade parity (performance/scalability) is still open.
- [ ] Physical-device evidence closure remains environment-dependent (online Android device required).

### Verification Gate (Executed)
- [x] `npx jest src/capacitor.runtime.contract.test.ts src/storage.provider.contract.test.ts src/source_manager.loadflow.test.ts src/storage.provider.capacitor.content.contract.test.ts`
- [x] `npm run test:migration` (`19` suites, `98` tests passed)
- [x] `npm run build`
- [x] `npm run test:tauri` (`19` Rust tests passed)
- [x] `npm test` (`22` suites, `115` tests passed)

---

# 2026-03-09 v1.5.22 - High-Priority Security Hardening (PathBridge Authorization + Tokenized WS Handshake)

## English Document

### Objective
Proceed with the next high-priority robustness slice after critical-table reconciliation by hardening PathBridge authorization boundaries and eliminating unauthorized WebSocket data exposure windows.

### Completed in This Iteration
- [x] **Frontend bridge handshake strengthening**:
  - [x] Updated `src/frontend/runtime_bridge.js` `getBridgeWsUrl(clientTag)` to append runtime `client` and `token` query parameters when available.
  - [x] Preserved backward-safe fallback for malformed/custom WS URLs.
- [x] **PathBridge authorization boundary hardening** (`src/core/PathBridge.ts`):
  - [x] Added unauthorized-client timeout lifecycle (`UNAUTHORIZED_CLIENT_TIMEOUT_MS`, timer map, schedule/clear helpers).
  - [x] Authorized clients now clear auth timeout deterministically in both tokenless and token-required flows.
  - [x] Added `getOpenAuthorizedClients()` and restricted broadcast fan-out to authorized clients only.
  - [x] Enhanced client diagnostics to mark unauthorized connections in status summaries.
- [x] **Contract updates**:
  - [x] Updated `src/runtime.transport.adapter.contract.test.ts` with tokenized WS URL propagation assertions.
  - [x] Updated `src/pathbridge.handshake.contract.test.ts` to enforce unauthorized-timeout and authorized-client broadcast guardrails.

### High-Priority Work Status (Current)
- [x] Bridge-layer unauthorized data exposure window is closed by design (authorized-only broadcast + auth timeout).
- [x] Runtime bridge now propagates token metadata at socket URL handshake time.
- [ ] Full mobile sidecar-equivalent build/worker parity remains intentionally bounded by current release policy.
- [ ] Physical-device manual evidence closure still requires an online Android device.

### Verification Gate (Executed)
- [x] `npx jest src/pathbridge.handshake.contract.test.ts src/runtime.transport.adapter.contract.test.ts --runInBand`
- [x] `npm run test:migration` (`19` suites, `96` tests passed)
- [x] `npm run build`
- [x] `npm run test:tauri` (`19` Rust tests passed)
- [x] `npm test` (`22` suites, `113` tests passed)

---

# 2026-03-09 v1.5.21 - High-Priority Closure (Critical Issues Table Reconciliation + C-01 Runtime Guard)

## English Document

### Objective
Close the `CRITICAL ISSUES TABLE` drift first by reconciling documented risk state with actual codebase status, and eliminate the remaining C-01 runtime edge where PathBridge WebSocket startup could still be attempted on native Capacitor.

### Completed in This Iteration
- [x] **C-01 runtime hardening completed**:
  - [x] Updated `src/frontend/path_app.js` to skip bridge setup/connect when sidecar transport is unavailable (`supports_sidecar === false`) or native Capacitor runtime is detected.
  - [x] Added explicit runtime guards:
    - [x] `_isCapacitorNativeRuntime()`
    - [x] `_supportsSidecarBridge()`
  - [x] Added deterministic skip logs for disabled sidecar bridge startup paths.
- [x] **Transport contract coverage updated**:
  - [x] Updated `src/runtime.transport.adapter.contract.test.ts` to enforce new sidecar-disabled guard behavior in `path_app.js`.
- [x] **Critical-issues table fixed (EN/ZH)**:
  - [x] Updated `docs/en/fixrisk_TODO.md` `CRITICAL ISSUES TABLE` with current severity/status, validation evidence, and residual risk for `C-01`, `C-02`, `H-01`, `H-02`, `M-01`.
  - [x] Updated `docs/zh/fixrisk_TODO.md` `关键问题表` with aligned bilingual status and evidence.

### High-Priority Work Status (Current)
- [x] `CRITICAL ISSUES TABLE` is now aligned with implemented code reality and verification evidence.
- [x] C-01 localhost/bridge dependency risk is mitigated for Capacitor native runtime startup paths.
- [ ] Full mobile **build + worker** parity with desktop sidecar remains intentionally out of scope for current release boundary.
- [ ] Physical-device manual acceptance evidence remains environment-dependent (requires online Android device).

### Verification Gate (Executed)
- [x] `npx jest src/runtime.transport.adapter.contract.test.ts src/source_manager.loadflow.test.ts src/runtime.capabilities.test.ts src/mobile.pipeline.test.ts src/capacitor.runtime.contract.test.ts --runInBand`
- [x] `npm run test:migration` (`19` suites, `95` tests passed)
- [x] `npm run build`
- [x] `npm run test:tauri` (`19` Rust tests passed)
- [x] `npm test` (`22` suites, `112` tests passed)

---

# 2026-03-09 v1.5.20 - High-Priority Continuation (Capacitor Device Acceptance Pipeline Hardening)

## English Document

### Objective
Advance the remaining fixrisk high-priority mobile acceptance work by hardening Android device verification/evidence scripts for deterministic diagnostics and reusable ADB resolution, without weakening existing runtime boundaries.

### Completed in This Iteration
- [x] **Shared mobile acceptance utility layer**:
  - [x] Added `scripts/capacitor-device-utils.js` for:
    - [x] ADB command candidate resolution (`ADB_PATH`, PATH, `ANDROID_SDK_ROOT`/`ANDROID_HOME`)
    - [x] resilient command execution wrappers
    - [x] `adb devices` parsing with explicit status classification (`device`/`unauthorized`/`offline`)
    - [x] deterministic device-state summaries for diagnostics
- [x] **Verification script hardening**:
  - [x] Updated `scripts/verify-capacitor-device-acceptance.js`:
    - [x] migrate to shared utility layer
    - [x] support `NOTE_CONNECTION_ANDROID_SERIAL` for deterministic serial targeting
    - [x] include structured blocked-state output (`Device states: ...`) when no online device exists
- [x] **Evidence capture script hardening**:
  - [x] Updated `scripts/capture-capacitor-device-evidence.js`:
    - [x] migrate to shared utility layer
    - [x] support deterministic serial selection via `NOTE_CONNECTION_ANDROID_SERIAL`
    - [x] include explicit blocked-state summaries for no-device / non-online-serial scenarios
- [x] **Contract coverage expansion**:
  - [x] Added `src/capacitor.device.utils.contract.test.ts` (ADB parse/state/candidate regression checks)
  - [x] Updated `src/mobile.pipeline.test.ts` to enforce shared-utility wiring in both acceptance scripts
  - [x] Updated `package.json` migration test matrix to include new device-utils contract suite

### High-Priority Work Status (Current)
- [x] Mobile device acceptance scripts now fail fast with deterministic diagnostics and explicit blocked reasons.
- [x] Migration/CI gates include regression protection for ADB parsing and script wiring.
- [ ] Deliver full mobile **build + content** parity equivalent to desktop sidecar (still intentionally bounded by runtime policy).
- [ ] Complete physical-device acceptance evidence checklist with real-device interaction evidence (environment currently has no online Android device).

### Verification Gate (Executed)
- [x] `npx jest src/capacitor.device.utils.contract.test.ts src/mobile.pipeline.test.ts --runInBand`
- [x] `npm run verify:capacitor:device` -> blocked as expected: `Device states: none`
- [x] `npm run capture:capacitor:evidence` -> blocked as expected: `Device states: none`
- [x] `npm run test:migration` (`19` suites, `95` tests passed)
- [x] `npm run build`
- [x] `npm run test:tauri` (`19` Rust tests passed)
- [x] `npm test` (`22` suites, `112` tests passed)

---

# 2026-03-09 v1.5.19 - Fixrisk High-Priority Hardening (Static Asset Traversal Guard + Full Verification)

## English Document

### Objective
Close a remaining high-priority robustness gap from `docs/fixrisk_TODO.md` by hardening sidecar static-file serving against traversal edge cases and proving no regression through full verification gates.

### Completed in This Iteration
- [x] **Sidecar static-file security hardening** (`src/server.ts`):
  - [x] Added strict raw request-path extraction (`getRawRequestPathname`) to avoid URL normalization hiding traversal intent.
  - [x] Added traversal + null-byte rejection and root-bounded resolution (`resolveFrontendStaticPath`).
  - [x] Replaced callback-style static reads with async `stat` + `readFile`, returning deterministic `403/404/500` responses.
  - [x] Added centralized static content-type mapping (`getStaticContentType`).
- [x] **Regression safety net expanded** (`src/server.migration.test.ts`):
  - [x] Added raw traversal regression case (`/../../outside/sensitive.md`).
  - [x] Added encoded traversal regression case (`/%2e%2e/%2e%2e/outside/sensitive.md`).
- [x] **Feasibility verification executed end-to-end**:
  - [x] Migration suite, build pipeline, and full Jest matrix all pass after hardening.

### High-Priority Work Status (Current)
- [x] Harden static asset serving path resolution to prevent path-escape behavior and ambiguous request-path handling.
- [x] Keep migration and full-test CI viability intact after server-path security changes.
- [ ] Deliver full mobile **build + content** parity equivalent to desktop sidecar (still intentionally bounded by current runtime policy).
- [ ] Complete physical-device acceptance evidence checklist end-to-end (requires online Android device in execution environment).

### Verification Gate (Executed)
- [x] `npx jest src/server.migration.test.ts --runInBand`
- [x] `npm run test:migration` (`18` suites, `91` tests passed)
- [x] `npm run build`
- [x] `npm run test:tauri`
- [x] `npm test` (`21` suites, `108` tests passed)
- [ ] `npm run verify:capacitor:device` (blocked in current environment: no online Android device)
- [ ] `npm run capture:capacitor:evidence` (blocked in current environment: no online Android device)

---

# 2026-03-09 v1.5.18 - High-Priority Continuation (Capacitor Content Path + Device Evidence + MD Language Archive)

## English Document

### Objective
Continue active high-priority closure with implementation-first rigor:
- Reduce Capacitor runtime parity risk for **content loading** (without pretending build parity).
- Operationalize physical-device acceptance evidence collection.
- Execute a structured language archive of all tracked markdown docs into `docs/en` and `docs/zh`.

### Completed in This Iteration
- [x] **Capacitor content-path parity hardening**:
  - [x] `src/frontend/source_manager.js`: Capacitor runtime capability now resolves `supports_content_api` dynamically via filesystem plugin readiness (`supportsCapacitorContentApi`) instead of hardcoded false.
  - [x] `src/frontend/storage_provider.js`: added Capacitor content mapping and safety helpers:
    - [x] `extractRelativePathFromKbMarker(rawFilePath)`
    - [x] `resolveCapacitorContentCandidatePath(rawFilePath)`
    - [x] strict rejection of unmappable absolute desktop paths without `Knowledge_Base` marker
  - [x] `RuntimeStorageProvider.readContent()` now uses Capacitor filesystem for native runtime when content API is supported.
- [x] **Physical-device evidence automation**:
  - [x] Added `scripts/capture-capacitor-device-evidence.js`.
  - [x] Added npm command `capture:capacitor:evidence`.
  - [x] Evidence bundle output design:
    - [x] masked device metadata
    - [x] screenshot (`device-screenshot.png`)
    - [x] logcat tail (`logcat-tail.txt`)
    - [x] bilingual acceptance report (`acceptance_evidence.md`)
- [x] **Structured markdown language archive**:
  - [x] Added `scripts/archive-md-by-language.js`.
  - [x] Archived all tracked markdown files into:
    - [x] `docs/en/**` (English set)
    - [x] `docs/zh/**` (Chinese set)
  - [x] Generated archive traceability report: `docs/language-archive-report.json`.
  - [x] Current archive snapshot: scanned `25` tracked markdown files, output `24` EN docs and `17` ZH docs.
- [x] **Contract/test updates**:
  - [x] Updated `src/capacitor.runtime.contract.test.ts` for dynamic Capacitor content capability.
  - [x] Updated `src/storage.provider.contract.test.ts` for Capacitor content mapping assertions.
  - [x] Added `src/storage.provider.capacitor.content.contract.test.ts`.
  - [x] Updated `src/mobile.pipeline.test.ts` to assert evidence-capture npm command.
  - [x] Updated `package.json` migration test list to include new capacitor content contract test.

### High-Priority Work Status (Current)
- [x] Deliver mobile **content** parity path beyond strict packaged-read-only behavior (filesystem-backed read path added with safety checks).
- [ ] Deliver full mobile **build + content** parity equivalent to desktop sidecar (build parity remains intentionally unresolved in Capacitor runtime).
- [ ] Complete physical-device acceptance evidence checklist end-to-end (device-dependent manual validations still pending).

### Verification Gate (Executed)
- [x] `npx jest src/capacitor.runtime.contract.test.ts src/storage.provider.contract.test.ts src/storage.provider.capacitor.content.contract.test.ts src/mobile.pipeline.test.ts src/source_manager.loadflow.test.ts src/runtime.capabilities.test.ts --runInBand`
- [x] `npm run test:migration` (`18` suites passed)
- [x] `npm run build`
- [x] `npm run test:tauri`
- [x] `./src-tauri/bin/godot-x86_64-pc-windows-msvc.exe --headless --path ./path_mode --quit`
- [x] `node scripts/archive-md-by-language.js`
- [ ] `npm run verify:capacitor:device` (blocked in current environment: no online Android device)
- [ ] `npm run capture:capacitor:evidence` (blocked in current environment: no online Android device)

---

# 2026-03-09 v1.5.17 - Fixrisk Feasibility Hardening (Approach Plan Execution)

## English Document

### Objective
Execute the next fixrisk-driven hardening slice from `docs/fixrisk_TODO.md` with verifiable runtime contracts, focused on mobile filesystem feasibility, Android permission baselines, and CI determinism.

### Completed in This Iteration
- [x] **Capacitor filesystem dependency baseline**:
  - [x] Added `@capacitor/filesystem` to runtime dependencies in `package.json`.
- [x] **Storage-provider hardening for native Capacitor paths** (`src/frontend/storage_provider.js`):
  - [x] Added Capacitor path normalization with traversal rejection (`.` / `..` unsafe segments).
  - [x] Added permission-aware filesystem gate (`checkPermissions` / `requestPermissions`) with deterministic error signaling.
  - [x] Kept desktop sidecar and Tauri command fallback behavior unchanged.
- [x] **Android manifest permission baseline** (`android/app/src/main/AndroidManifest.xml`):
  - [x] Added legacy storage compatibility declarations (`READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`).
  - [x] Added Android 13+ media-read declarations (`READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_AUDIO`).
- [x] **Contract-test coverage raised**:
  - [x] Updated `src/mobile.pipeline.test.ts` to enforce Capacitor filesystem dependency and Android permission declarations.
  - [x] Updated `src/storage.provider.contract.test.ts` to enforce permission/path-hardening hooks in storage provider.
- [x] **CI migration stability**:
  - [x] Kept `src/server.migration.test.ts` hermetic against runner-injected `NOTE_CONNECTION_AUTH_TOKEN` values to prevent false `401` cascades in CI.

### High-Priority Work Status (Current)
- [x] Address fixrisk mobile filesystem baseline gaps at dependency + manifest + adapter hardening level.
- [x] Add migration-level guardrails to prevent silent regressions.
- [ ] Deliver true mobile build/content parity beyond packaged read-only policy (still intentionally bounded).
- [ ] Complete physical-device acceptance evidence (`verify:capacitor:device` + on-device runtime checklist).

### Verification Gate (Executed)
- [x] `npx tsc --pretty false`
- [x] `npx jest src/storage.provider.contract.test.ts src/mobile.pipeline.test.ts src/source_manager.loadflow.test.ts src/runtime.capabilities.test.ts src/server.migration.test.ts --runInBand`
- [x] `npm run test:migration`
- [x] `npm run build`
- [x] `npm run test:tauri`
- [x] `./src-tauri/bin/godot-x86_64-pc-windows-msvc.exe --headless --path ./path_mode --quit`
- [x] `npm run build:sidecar`

---

# 2026-03-08 v1.5.16 - High-Priority Closure (Transport + Storage + Cross-Platform Godot Strategy)

## English Document

### Objective
Close all open high-priority items from `v1.5.15` with implementation + regression validation, without weakening existing desktop/mobile runtime boundaries.

### Completed in This Iteration
- [x] **Transport modernization closure**:
  - [x] Added JSON-RPC-compatible bridge envelopes in `src/frontend/runtime_bridge.js` (`toBridgeEnvelope`, `parseBridgeEnvelope`, `sendBridgeMessage`) while keeping legacy `type/payload` compatibility.
  - [x] Migrated `src/frontend/path_app.js` bridge sends/receives to the runtime transport adapter path (`_sendBridgeMessage`, `_parseBridgeIncomingMessage`) instead of direct raw message formatting/parsing.
- [x] **Storage-provider abstraction closure**:
  - [x] Added `src/frontend/storage_provider.js` as the unified runtime storage provider and wired it into source/reader flows.
  - [x] Implemented provider branches for sidecar HTTP, Tauri invoke commands, and Capacitor-native filesystem read/list fallbacks (`Filesystem` plugin-aware helpers) while preserving current capability gating policy.
- [x] **Explicit macOS/Linux Godot sidecar artifact strategy**:
  - [x] Reworked `scripts/ensure-godot-sidecar.js` into host-aware preparation for Windows/Linux/macOS naming (`godot-<target-triple>`), with deterministic lookup strategy and documented env overrides.
  - [x] Updated `src-tauri/src/lib.rs` Godot executable resolution to platform-specific sidecar names + host aliases, with tests adjusted for cross-platform behavior.
- [x] **Release policy explicitness kept in code/docs surface**:
  - [x] Capacitor native remains bounded read-only/cache-oriented in runtime capability handling.
  - [x] README policy statements remain explicit that Capacitor path does not provide desktop sidecar parity yet.

### High-Priority Status
- [x] Complete transport modernization (replace remaining raw desktop HTTP/WS flows with Tauri-native IPC or JSON-RPC adapter).
- [x] Implement storage-provider abstraction across desktop sidecar, Tauri commands, and Capacitor native filesystem.
- [x] Add explicit macOS/Linux Godot sidecar artifact strategy (currently Windows binary workflow is strongest).
- [x] Keep release policy explicit: Capacitor native remains read-only packaged mode until parity work is delivered.

### Verification Gate (Executed)
- [x] `npx tsc --pretty false`
- [x] `npx jest src/storage.provider.contract.test.ts src/source_manager.loadflow.test.ts src/runtime.capabilities.test.ts src/runtime.transport.adapter.contract.test.ts --runInBand`
- [x] `npm run test:migration`
- [x] `npm run test:tauri`
- [x] `./src-tauri/bin/godot-x86_64-pc-windows-msvc.exe --headless --path ./path_mode --quit`
- [x] `npm run build:sidecar`
- [x] `npm run build:sidecar:all` (artifact generation + validation; macOS binary signing warning remains expected when built off macOS host)
- [x] `npm run verify:tauri:bin`
- [x] `npm test`

---


# 2026-03-08 v1.5.15 - Fixrisk Phase-1 Hardening Execution (Completed)

## English Document

### Objective
Execute the highest-risk actionable items from `docs/fixrisk_TODO.md` without destabilizing existing desktop and mobile runtime contracts.

### Implemented in This Iteration
- [x] `src/server.ts`: removed synchronous file reads from `/api/content` and generated JS/JSON asset responses.
- [x] `src/server.ts`: replaced in-memory-only JSON body parsing with bounded streaming + temp-file spooling (`tmp/request-bodies`) for large payloads.
- [x] `src/server.ts`: normalized request-body failure handling with explicit HTTP status mapping:
  - [x] `413` for oversized payloads
  - [x] `400` for invalid JSON
  - [x] `415` for unsupported content type
- [x] `src/server.ts`: migrated `/api/build` and `/api/kb-path` to the same hardened JSON parser path (removed duplicated manual body buffering).
- [x] `src/server.ts`: added startup resilience for default dev port conflicts. If no explicit port is configured and `3000` is busy, server now falls back to an ephemeral loopback port instead of crashing with `EADDRINUSE`.
- [x] `src/server.ts`: completed async conversion for cache and target APIs (`/api/check-cache`, `/api/restore-cache`, `/api/available-targets`) to remove remaining sync hot-path filesystem calls.
- [x] Frontend transport consolidation: `source_manager.js`, `reader.js`, and `path_app.js` now rely on `runtime_bridge.js` as the single runtime transport adapter instead of standalone hardcoded loopback URL fallbacks.
- [x] Packaging modernization:
  - [x] Added `scripts/build-sidecar.js` with Node 22 targets, Brotli compression, and `--no-bytecode`.
  - [x] Updated `build:sidecar` to host-aware Node 22 build.
  - [x] Added `build:sidecar:all` for Windows/Linux/macOS-arm64 outputs with Tauri-compatible naming.
  - [x] Updated sidecar validation script to support host/all-target checks.
  - [x] Updated Godot sidecar preparation script to skip Windows-only copy logic on non-Windows hosts.

### Remaining High-Priority Work
- [x] Complete transport modernization (replace remaining raw desktop HTTP/WS flows with Tauri-native IPC or JSON-RPC adapter). (Closed in `v1.5.16`)
- [x] Implement storage-provider abstraction across desktop sidecar, Tauri commands, and Capacitor native filesystem. (Closed in `v1.5.16`)
- [x] Add explicit macOS/Linux Godot sidecar artifact strategy (currently Windows binary workflow is strongest). (Closed in `v1.5.16`)
- [x] Keep release policy explicit: Capacitor native remains read-only packaged mode until parity work is delivered. (Closed in `v1.5.16`)

### Verification Gate (This Iteration)
- [x] `npx tsc --pretty false`
- [x] `npx jest src/server.migration.test.ts src/source_manager.loadflow.test.ts src/pathbridge.handshake.contract.test.ts src/reader_renderer.test.ts --runInBand`
- [x] `npx jest src/runtime.transport.adapter.contract.test.ts src/source_manager.loadflow.test.ts src/runtime.capabilities.test.ts src/pathbridge.handshake.contract.test.ts --runInBand`
- [x] `npm run test:migration`
- [x] `npm run test:tauri`
- [x] `./src-tauri/bin/godot-x86_64-pc-windows-msvc.exe --headless --path ./path_mode --quit`
- [x] `npm run build:sidecar`
- [x] `npm run build:sidecar:all` (artifact validation only; cross-platform runtime execution remains platform-dependent)

---

# 2026-03-07 v1.5.14 - Architecture & Security Hardening Review Refresh

## Future Architecture & Security Hardening (Post v1.5.13)

### Goal
Refresh the post-v1.5.13 hardening backlog against the current codebase so the TODO reflects what is already implemented and what still blocks production-grade robustness, large-graph scalability, and honest multi-platform delivery.

### Completed Since The Original Hardening Plan
- [x] HTTP and WebSocket listeners are now loopback-only on desktop (`127.0.0.1`).
- [x] Tauri now allocates dynamic sidecar and bridge ports and injects runtime metadata into the sidecar, frontend, and Godot process.
- [x] Protected sidecar routes and bridge identification now support token-based authentication.
- [x] Strict CORS allowlisting replaced wildcard desktop exposure for the sidecar runtime.
- [x] A shared frontend runtime bridge now synchronizes sidecar base URL, bridge URL, and auth headers in Tauri desktop flows.
- [x] Native Capacitor runtime is now explicitly treated as a read-only packaged mode instead of assuming desktop sidecar APIs.
- [x] Clipboard PNG buffers are explicitly zeroized after use in the Node sidecar.
- [x] Godot reader SVG sanitization and dimension clamping now prevent oversized raster failures for Math/Mermaid rendering.

### Remaining High-Priority Work

#### Phase 1: Desktop Runtime Hardening Closure
- [x] Bind HTTP and WebSocket listeners to `127.0.0.1` only.
- [x] Allocate dynamic ports and auth tokens from the Tauri runtime.
- [x] Apply strict CORS allowlisting and token validation to protected sidecar routes.
- [x] Remove synchronous filesystem reads from `/api/content` and generated asset serving in `src/server.ts`.
- [x] Replace full-buffer JSON body parsing with streaming or temp-file handling for large clipboard and render payloads.

#### Phase 2: Transport Modernization
- [x] Introduce an environment-aware runtime bridge for Tauri desktop URL and auth propagation.
- [ ] Replace remaining raw desktop HTTP and WebSocket request paths with Tauri-native IPC or a formal JSON-RPC transport.
- [x] Consolidate all frontend transport fallbacks behind one adapter so no feature depends on hardcoded loopback defaults when runtime metadata is unavailable.

#### Phase 3: Storage and Query Scalability
- [ ] Introduce a storage-provider abstraction that can target desktop sidecar, Tauri commands, Capacitor filesystem, and future SQLite or Wasm runtimes.
- [ ] Replace monolithic `graph_data.json` as the primary runtime storage with SQLite-backed partial queries.
- [ ] Add persistent frontend cache layers (IndexedDB via `localForage` or `Dexie`) for cold-start reduction.
- [ ] Evaluate MessagePack or an equivalent binary transport for dense graph payload delivery.

#### Phase 4: Packaging and Multi-Platform Delivery
- [x] Replace the Windows-only `build:sidecar` target (`node18-win-x64`) with multi-target Node 22 packaging.
- [x] Add compressed sidecar build flows (`--compress Brotli`, `--no-bytecode`) and verify packaged runtime assets.
- [x] Add packaged-sidecar validation for macOS and Linux, not only Windows desktop.
- [ ] Finalize iOS privacy-manifest work for filesystem access declarations.
- [ ] Keep the mobile release policy explicit: current Capacitor delivery is packaged read-only content, not desktop-equivalent build or sidecar parity.

### Verification Snapshot (Reviewed on 2026-03-07)
- [x] `npx tsc --pretty false`
- [x] `npx jest src/reader_renderer.test.ts src/source_manager.loadflow.test.ts src/pathbridge.handshake.contract.test.ts src/server.migration.test.ts --runInBand`
- [x] `cargo test --manifest-path src-tauri/Cargo.toml`
- [x] `./src-tauri/bin/godot-x86_64-pc-windows-msvc.exe --headless --path ./path_mode --quit` on Windows PowerShell

### Release Position
- [ ] Do not claim full all-platform feature parity until storage abstraction and transport migration are completed.
- [ ] Treat Capacitor native delivery as a bounded read-only runtime until native content and graph-loading parity is implemented.

# 2026-03-04 v1.5.13 - Capacitor Physical-Device Acceptance Runbook Closure


### Objective

Convert the last open `v1.5.9` sign-off item (Capacitor physical-device checklist evidence) into an executable and repeatable workflow.

### Delivered

- [x] Added device-acceptance probe script:
  - [x] `scripts/verify-capacitor-device-acceptance.js`
  - [x] validates:
    - [x] APK exists (`android/app/build/outputs/apk/debug/app-debug.apk`)
    - [x] `adb` is available
    - [x] at least one online Android device is attached
- [x] Added npm command:
  - [x] preflight command available: `npm run verify:capacitor:device`
- [x] Revalidated current APK build pipeline:
  - [x] `npm run mobile:build:capacitor` -> PASS on 2026-03-04

### Physical-Device Acceptance Checklist (Release Sign-Off)

- [ ] Device connection gate passes:
  - [ ] `npm run verify:capacitor:device`
- [ ] App startup behavior validated on real device.
- [ ] Source panel behavior validated on real device.
- [ ] Reader behavior validated on real device.
- [ ] Path mode entry/exit behavior validated on real device.
- [ ] Evidence artifacts attached:
  - [ ] device serial (masked if needed)
  - [ ] test date/time
  - [ ] screenshots or short screen recording
  - [ ] observed result notes (pass/fail + issue IDs)

### Current Status

- [x] Build + environment side of acceptance is ready.
- [ ] Real-device execution evidence is still required to close the final sign-off checkbox in `v1.5.9`.

---

# 2026-03-04 v1.5.11 - Capacitor Runtime Boundary Closure (Option B Execution)


### Decision Snapshot

- [x] Capacitor runtime boundary hardening is now implemented under Option B (read-only mobile policy).
- [x] Source/Reader runtime behavior no longer assumes desktop sidecar APIs in native Capacitor.
- [x] Regression contract coverage for Capacitor runtime boundary is added and wired into migration gate.
- [ ] Capacitor in-app folder/build/content parity with desktop remains intentionally out of scope for current release policy.

### Delivered in Code

- [x] `src/frontend/source_manager.js`
  - [x] Added native Capacitor runtime detection (`window.Capacitor.getPlatform` / `isNativePlatform`).
  - [x] Applied explicit capability profile in native Capacitor:
    - [x] `supports_sidecar=false`
    - [x] `supports_build=false`
    - [x] `supports_content_api=false`
    - [x] `supports_kb_runtime_change=false`
  - [x] Added deterministic source-panel fallback for read-only mode:
    - [x] path label -> `source.capacitor.bundlePath`
    - [x] single packaged option -> `PACKAGED_GRAPH`
    - [x] load button disabled + guarded alert (`source.error.capacitorReadOnly`)
- [x] `src/frontend/reader.js`
  - [x] Added Capacitor-native detection fallback to enforce read-only content strategy when runtime caps are unavailable early.
- [x] i18n updates:
  - [x] `src/frontend/locales/en.json`
  - [x] `src/frontend/locales/zh.json`
  - [x] added `source.capacitor.packagedGraph`
  - [x] added `source.capacitor.bundlePath`
  - [x] added `source.error.capacitorReadOnly`
- [x] Added Capacitor boundary contract tests:
  - [x] `src/capacitor.runtime.contract.test.ts`
  - [x] included in `package.json` -> `test:migration`

### Verification Evidence (Executed on 2026-03-04)

- [x] `npm run test:migration` -> PASS (`66` tests)
- [x] `npm run test:tauri` -> PASS (`18` tests)
- [x] `npm run mobile:build:capacitor` -> PASS
  - [x] APK output: `android/app/build/outputs/apk/debug/app-debug.apk`

### Status Update for Previously Open Items

- [x] `v1.5.9` item: **Capacitor runtime behavior hardening** -> closed at code + test level.
- [x] `v1.5.9` item: **integration test coverage for Capacitor runtime boundary** -> closed (`src/capacitor.runtime.contract.test.ts`).
- [ ] `v1.5.9` item: **manual Capacitor APK checklist on physical device** remains pending explicit on-device execution evidence.
- [ ] **NO-GO remains** for claiming “all-platform parity complete”.

---

# 2026-03-03 v1.5.10 - Option A P0 Closure (Tauri Android Native Folder/Build/Content Flow)


### Decision Snapshot

- [x] Option A P0 is implemented for Tauri Android runtime.
- [x] Android runtime now supports local graph build without Node sidecar.
- [x] Desktop and web behavior remain unchanged.
- [ ] Capacitor runtime parity is still a separate scope (build backend parity not yet native-equivalent).

### Delivered in Code

- [x] Added native runtime build command in Rust:
  - [x] `build_graph_runtime(request)` in `src-tauri/src/lib.rs`
  - [x] builds from `Knowledge_Base/<target>` (or `ALL_FOLDERS`)
  - [x] writes runtime artifacts to `runtime_data/`:
    - [x] `data.js`
    - [x] `graph_data.json`
    - [x] `data_<target>.js`
    - [x] `graph_data_<target>.json`
- [x] Updated Android runtime capabilities:
  - [x] `supports_sidecar=false`
  - [x] `supports_build=true`
  - [x] `supports_content_api=true`
- [x] Routed source loading/build flow in `src/frontend/source_manager.js`:
  - [x] sidecar path stays primary when available (`/api/build`)
  - [x] Tauri native fallback uses `invoke('build_graph_runtime', { request })`

### Verification Evidence (Executed on 2026-03-03)

- [x] `npm run test:migration` -> PASS (`55` tests)
- [x] `npm run test:tauri` -> PASS (`16` tests)
- [x] `npm run verify:android:env` -> PASS (SDK + cmdline-tools + NDK detected)

### P0 Status Update

- [x] `Option A: Implement mobile-native equivalent for folder/build/content flow` (Tauri Android path).
- [ ] Capacitor-specific build/content runtime parity remains open and tracked under follow-up mobile scope.

---

# 2026-03-03 v1.5.9 - Electron Removal Final Gate (Audit-Driven Action Plan)


### Decision Snapshot

- [x] Desktop runtime migration from Electron to Tauri is technically ready.
- [x] Tauri desktop build/runtime path is active and test-verified.
- [x] Capacitor and Tauri Android build pipelines both exist.
- [ ] Full cross-platform runtime parity is not complete yet.

### Scope Clarification (From Audit)

- Desktop:
  - [x] Electron IPC-equivalent flows are migrated to sidecar HTTP + Tauri commands.
  - [x] Electron scripts/dependencies are absent from active package/runtime surface.
- Mobile:
  - [x] Capacitor runtime is intentionally read-only and not equivalent to desktop sidecar runtime for folder/build/content APIs.
  - [x] Tauri Android runtime is no-sidecar but build/content-enabled (`supports_sidecar=false`, `supports_build=true`), while Capacitor remains `supports_build=false`.

### P0 - Required Before Claiming “Full Migration Complete”

- [x] **Productize mobile capability boundary decision (must choose and freeze release policy)**
  - [x] Option A: Implement mobile-native equivalent for folder/build/content flow (Tauri Android native runtime path).
  - [x] Option B: Officially define Capacitor mobile as cache/read-focused scope and remove parity ambiguity in UI/docs.

- [x] **Capacitor runtime behavior hardening**
  - [x] Detect Capacitor runtime explicitly and avoid desktop-sidecar assumptions in source loading.
  - [x] Provide deterministic fallback UX when `/api/folders`, `/api/build`, `/api/content` are unavailable.
  - [x] Define content strategy for reader in Capacitor mode (read-only packaged graph policy + explicit unsupported notice for unavailable content APIs).

- [x] **Mobile acceptance gate**
  - [x] Add explicit integration test coverage for Capacitor runtime boundary behavior.
  - [x] Add manual verification checklist for Capacitor APK:
    - [x] startup behavior
    - [x] source panel behavior
    - [x] reader behavior
    - [x] path mode entry/exit behavior
  - [ ] Collect physical-device execution evidence against the checklist for final release sign-off.
    - [x] preflight command available: `npm run verify:capacitor:device`
    - [ ] latest probe result still shows no online Android device connected (2026-03-04).

### P1 - Migration Hygiene and Decommission Clean-up

- [x] **Archive/remove residual Electron artifacts**
  - [x] Remove empty `src/electron` directory or add explicit archive marker.
  - [x] Replace misleading names/comments containing “electron” where runtime is already bridge-based (for maintainability clarity).

- [x] **Documentation alignment**
  - [x] Mark `docs/tauri_tasks.md` as historical where it still lists pre-migration TODOs.
  - [x] Keep active docs Tauri-first and clearly separate desktop vs Android vs Capacitor capability boundaries.

### P2 - Reliability and Release Guardrails

- [x] Keep release gate mandatory:
  - [x] `npm run test:migration`
  - [x] `npm run test:tauri`
- [x] Keep Android environment gate mandatory:
  - [x] `npm run verify:android:env`
- [x] Add CI job matrix to prevent silent regressions:
  - [x] desktop migration suite
  - [x] tauri rust suite
  - [x] mobile pipeline contract suite

### Go/No-Go Policy (Current)

- [x] **GO**: Desktop Electron decommissioning.
- [x] **NO-GO policy active**: Do not claim “all-platform runtime parity complete” while Capacitor remains in read-only scope.

---

# 2026-03-03 v1.5.8 - PathBridge Handshake + Tauri Early-Socket Stability


### Added in This Round

- [x] Removed Godot-incompatible WebSocket query URL in `path_mode/scripts/ws_client.gd`:
  - [x] `ws://127.0.0.1:9876/?client=godot` -> `ws://127.0.0.1:9876`
  - [x] Added explicit `identify` handshake payload after connect.
  - [x] Added pre-connect message queue flush to avoid early configure-drop warnings.

- [x] Added explicit client-identification protocol in `src/core/PathBridge.ts`:
  - [x] Added `identify` message handling.
  - [x] Added runtime client tag update (`setClientTag`) with sanitization.
  - [x] Kept URL-tag fallback compatible for browser legacy callers.

- [x] Hardened frontend Bridge behavior in `src/frontend/path_app.js`:
  - [x] Removed query-tag URL usage and switched to base `ws://localhost:9876`.
  - [x] Sent `identify` payloads for both `frontend` and `frontend-early`.
  - [x] Added Tauri-runtime guard using `window.__TAURI__` OR `navigator.userAgent.includes('Tauri')` to prevent accidental `frontend-early` socket startup in Tauri.

- [x] Added regression coverage:
  - [x] New contract file: `src/pathbridge.handshake.contract.test.ts`.
  - [x] Included in `test:migration` suite.

### Verification

- [x] `npm run test:migration` -> PASS (`53` tests).
- [x] `npm run test:tauri` -> PASS (`14` tests).

### Scope Safety

- [x] Desktop behavior unchanged except bridge handshake logging/tagging stability.
- [x] Web browser mode still supports early bridge mode.
- [x] Android Pathmode flow remains unchanged.

---

# 2026-03-03 v1.5.7 - Android Native Pathmode Smoke Lifecycle Automation


### Added in This Round

- [x] Added Android runtime smoke lifecycle script:
  - [x] `scripts/smoke-android-pathmode.js`
  - [x] checks `MainActivity -> PathmodeGodotActivity -> MainActivity` through `adb` + `dumpsys activity`.
  - [x] sends back event (`KEYCODE_BACK`) to verify activity return path.
  - [x] supports optional strict mode:
    - [x] `NOTE_CONNECTION_ANDROID_SMOKE_REQUIRE_DEVICE=1` makes no-device state fail
    - [x] default mode skips gracefully when no device/emulator is attached.

- [x] Added npm entrypoint:
  - [x] `smoke:android:pathmode` in `package.json`.

- [x] Added regression contracts for smoke integration:
  - [x] `src/android.pathmode.smoke.contract.test.ts`.
  - [x] Updated `src/mobile.pipeline.test.ts` to assert smoke script registration.
  - [x] Updated `test:migration` suite list to include smoke contract test.

### Verification

- [x] `npm run test:migration` -> PASS (`50` tests).
- [x] `npm run test:tauri` -> PASS (`14` tests).
- [x] `npm run smoke:android:pathmode` -> PASS (graceful skip without connected device).

### Scope Safety

- [x] No desktop behavior changes.
- [x] No web behavior changes.
- [x] Android smoke flow is standalone and only invoked explicitly.

---

# 2026-03-03 v1.5.6 - Option A Android Native Pathmode (Godot Full-Screen) Execution


### Implemented in This Round

- [x] **Option A launch path implemented for Android**
  - [x] Added Android-native Pathmode launch command: `open_native_pathmode` in `src-tauri/src/lib.rs`.
  - [x] Added runtime capability flag: `supports_native_pathmode` (Android=true, desktop/web=false).
  - [x] Updated frontend Path Mode entry (`src/frontend/app.js`) to:
    - [x] prefer native Android launch when capability is enabled
    - [x] keep desktop/web flow unchanged (fallback to existing web Path Mode container)

- [x] **Android full-screen Godot activity bridge landed**
  - [x] Added tracked Android templates:
    - [x] `src-tauri/mobile/android/PathmodeBridge.kt`
    - [x] `src-tauri/mobile/android/PathmodeGodotActivity.kt`
  - [x] Added generated-project patch pipeline:
    - [x] `scripts/apply-tauri-android-pathmode.js`
    - [x] `scripts/run-tauri-android.js` now auto-applies patch before/after Android commands.
  - [x] Added Android asset sync for `path_mode` into `src-tauri/gen/android/app/src/main/assets/path_mode`.

- [x] **Exit back behavior implemented**
  - [x] Godot `Exit` now quits Android Pathmode activity and returns to main Tauri window (`path_mode/scripts/path_renderer.gd`).

- [x] **Android build path hardened**
  - [x] Added Android-only cargo memory controls in runner (`CARGO_BUILD_JOBS`, release opt/codegen tuning).
  - [x] Added patch logic for:
    - [x] Godot Maven dependency and manifest merge rules
    - [x] Kotlin plugin version alignment required by Godot Android artifact

### Verification

- [x] `npm run test:migration` -> PASS (`48` tests).
- [x] `npm run test:tauri` -> PASS (`14` tests).
- [x] `node scripts/run-tauri-android.js build` -> PASS.
  - [x] APK: `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk`
  - [x] AAB: `src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab`

### Scope Safety

- [x] Desktop behavior unchanged.
- [x] Web behavior unchanged.
- [x] Android-only logic is capability-gated and build-script-gated.

---

# 2026-03-03 v1.5.5 - Status Normalization Update (Proceeding)


### Revalidated in This Round

- [x] Re-ran migration gate suites:
  - [x] `npm run test:migration` -> PASS (`44` tests).
  - [x] `npm run test:tauri` -> PASS (`14` tests).
- [x] Confirmed `v1.5.3` and `v1.5.4` closure items remain valid (P0 engineering + P1 runtime-boundary UI).
- [x] Confirmed sidecar content-boundary checks and load/history contract tests remain green.

### Backlog Hygiene

- [x] Marked `v1.5.2` checklist as historical/superseded context to avoid execution ambiguity.
- [x] Kept historical checklist body intact for traceability (no destructive edits).

### Remaining Actionable Scope

- [ ] Final mobile parity decision remains open at product level:
  - [ ] Option A: implement Android-native build/content pipeline parity with desktop sidecar flow.
  - [x] Option B (active policy): keep Android capability-gated cache/read runtime and document boundary explicitly.

---

# 2026-03-03 v1.5.3 - Execution Progress Update (P0 Completed)


### Completed in This Execution Round

- [x] **Secure sidecar content API to match Rust boundary guarantees**
  - [x] Enforced KB-root boundary checks for `/api/content` in `src/server.ts`.
  - [x] Added regression tests for:
    - [x] allowed inside-root absolute path
    - [x] allowed legacy `Knowledge_Base` marker path
    - [x] blocked outside-root path (`403`)

- [x] **Lock cache prompt + single-load execution behavior (contract coverage)**
  - [x] Added source-manager load-flow guard contract tests:
    - [x] duplicate event-binding guard
    - [x] in-progress click guard
    - [x] single cache-choice prompt branch contract
  - [x] Existing server-side restore/build dedupe tests remain passing.

- [x] **Finalize Godot History consistency contract**
  - [x] Added `record_navigation_node(node_id)` in `path_mode_ui.gd`.
  - [x] Wired `path_renderer.gd` to record center-switch history on `render_path`.
  - [x] Added regression contract test for history hook presence.

- [x] **Final Go/No-Go technical gate (engineering portion)**
  - [x] `npm run test:migration` -> PASS (`43` tests).
  - [x] `npm run test:tauri` -> PASS (`14` tests).

### Remaining Product Decision (Non-blocking to Desktop Stability)

- [ ] Choose final mobile parity product scope:
  - [ ] Option A: Android-native equivalent build runtime.
  - [x] Option B (current active policy): cache/read-focused mobile runtime with explicit capability boundaries.

---

# 2026-03-03 v1.5.2 - Electron Removal Final Gate (Post-Audit Action Plan)


> Superseded Note (2026-03-03 v1.5.5): This section is preserved as historical plan context. P0/P1 closure evidence is recorded in `v1.5.3` and `v1.5.4` above. Unchecked boxes below are not current execution blockers unless explicitly reopened.

**Audit Decision Snapshot**

- [x] Desktop Electron -> Tauri migration is functionally successful.
- [x] Capacitor export pipeline remains available and buildable.
- [x] Tauri Android export pipeline is buildable.
- [ ] Full runtime parity across desktop/mobile is not complete yet.

### P0 - Must Complete Before Declaring Full Migration Closure

- [x] **Secure sidecar content API to match Rust boundary guarantees**
  - [x] Enforced KB-root boundary checks for `/api/content` in `src/server.ts`, equivalent to `read_node_content`.
  - [x] Added regression tests covering allowed path, blocked outside path, and Windows/relative path variants.

- [x] **Lock cache prompt + single-load execution behavior under Tauri startup races**
  - [x] Added integration-level contract coverage:
    - [x] "cache exists -> prompt appears exactly once"
    - [x] "single click -> one restore/build path only"
  - [x] Validated against sidecar dedupe + frontend reload guard interactions.
  - [x] Historical block reconciled to implemented state (see `v1.5.3`).

- [x] **Finalize Godot History consistency contract**
  - [x] Center-switch events append to History timeline via Godot history hook integration.
  - [x] Deterministic contract coverage exists for history hook behavior.
  - [x] Historical block reconciled to implemented state (see `v1.5.3`).

### P1 - Mobile/Export Parity Clarification and Hardening

- [ ] **Clarify Android runtime capability boundaries in product docs/UI**
  - [ ] Explicitly document that Android currently runs with `supports_sidecar=false` and `supports_build=false`.
  - [ ] Provide user-facing fallback guidance for cache-only mode.

- [ ] **Decide and implement mobile build parity strategy**
  - [ ] Option A: implement Android-native build/content pipeline equivalent to desktop sidecar flow.
  - [ ] Option B: keep cache/read-only scope and make it explicit as a product constraint.

### P2 - Documentation Hygiene (without deleting history)

- [ ] Tag historical Electron sections as archived context to reduce operator confusion.
- [ ] Keep active release/runbook sections Tauri-first and dual-mobile-path accurate.

### Final Go/No-Go Gate (Full-Scope)

- [ ] `npm run test:migration` passes with new parity tests.
- [ ] `npm run test:tauri` passes with new security and behavior tests.
- [ ] Manual verification passes for:
  - [ ] cache prompt appears once
  - [ ] load action executes once
  - [ ] History records center switches
- [ ] Security validation passes for sidecar content path boundaries.

---

# 2026-03-02 v1.5.1 - Android Runtime Parity Expansion (Targets + Content + Cache-Only UX)


**Goal**: Convert desktop-sidecar-only target/content flows into runtime-safe contracts for Tauri Android, while preserving desktop behavior.

### Completed This Round

- [x] **Target discovery parity landed**
  - [x] Added sidecar API `GET /api/available-targets` (folders + cached targets merged).
  - [x] Added Tauri command `get_available_targets` with equivalent behavior.
  - [x] Updated frontend source loading to prefer available-target APIs and fallback safely.

- [x] **Mobile-safe content read path landed**
  - [x] Added Tauri command `read_node_content(file_path)`.
  - [x] Enforced KB root boundary checks for content reads (reject outside-root access).
  - [x] Added legacy path rebasing for desktop-style `.../Knowledge_Base/...` file references.
  - [x] Updated reader fallback to use Rust command when sidecar is unavailable.

- [x] **Cache-only UX hardening for `supports_build=false` runtimes**
  - [x] Mobile source list now filters to cache-available targets.
  - [x] `ALL_FOLDERS` option shown only when active cache exists.
  - [x] Load button disabled when no cache candidate exists.

- [x] **Regression coverage and build evidence refreshed**
  - [x] Added/updated migration tests for new available-target and runtime-content contracts.
  - [x] `npm run test:migration` passed (`35` tests).
  - [x] `npm run test:tauri` passed (`14` tests).
  - [x] `npm run tauri:android:build` passed.
  - [x] `npm run tauri:android:build:universal` passed.

### Remaining Work (Current Scope)

- [ ] **In-app Android graph build pipeline parity**
  - [ ] Provide Android-native equivalent for desktop `/api/build` workflow.
  - [ ] Define SAF/File API based import and persistent permission strategy for KB sources.

- [ ] **Path Mode/Godot Android strategy finalization**
  - [ ] Keep desktop-only intentionally with explicit UX messaging, or
  - [ ] design and implement Android-capable rendering/runtime alternative.

---

# 2026-03-02 v1.5.0 - Tauri Android Build Unblock (Arm64 Deterministic Path)


**Goal**: Unblock Tauri Android from environment/setup failures to a reproducible build path, while keeping Capacitor and Tauri Android dual generation available.

### Completed This Round

- [x] **Android SDK toolchain detection and enforcement**
  - [x] Confirmed Android SDK Command-line Tools (`cmdline-tools/latest`) detection.
  - [x] Confirmed NDK detection (`ndk;27.2.12479018`) through preflight script.
  - [x] `npm run verify:android:env` now passes on the current machine.

- [x] **Desktop-only Rust dependencies isolated from Android target**
  - [x] Moved `rfd` dependency to desktop-only target section in `src-tauri/Cargo.toml`.
  - [x] Added Android-safe folder-picker fallback path in `src-tauri/src/lib.rs`.

- [x] **Android-specific Tauri runtime configuration**
  - [x] Added `src-tauri/tauri.android.conf.json` to clear `bundle.externalBin` for Android.
  - [x] Guarded desktop-only menu APIs and desktop process launch logic with `cfg(not(target_os = "android"))`.
  - [x] Android startup now intentionally skips desktop Node sidecar and Godot process launch.

- [x] **Tauri Android wrapper hardening**
  - [x] Added default Android target strategy: `aarch64` for `dev/build` to avoid armv7 LLVM OOM on Windows hosts.
  - [x] Added override support via `NOTE_CONNECTION_TAURI_ANDROID_TARGET`.
  - [x] Fixed Windows process launch issue (`spawnSync npx.cmd EINVAL`) by invoking through `cmd.exe /d /s /c`.
  - [x] Added explicit spawn error/signal logging in `scripts/run-tauri-android.js`.

- [x] **Regression coverage updated**
  - [x] Updated `src/mobile.pipeline.test.ts` to assert arm64 default + override contract.
  - [x] Verified `npm run test:migration` pass (`30` tests).

- [x] **Build verification**
  - [x] Verified `node scripts/run-tauri-android.js build` pass.
  - [x] Verified `npm run tauri:android:build` pass.
  - [x] Generated artifacts:
    - `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk`
    - `src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab`

### Remaining Migration Items (P1.5 Follow-up)

- [ ] **Android runtime feature parity for desktop-only capabilities**
  - [ ] Replace or redesign Node sidecar-dependent APIs (`/api/build`, `/api/content`, folder scan/build pipeline) for Android runtime.
  - [ ] Define Android-native storage/input strategy (SAF/File APIs) for knowledge base selection and loading.

- [ ] **Path Mode/Godot on Android roadmap decision**
  - [ ] Keep Godot bridge desktop-only (current behavior), or introduce an Android-compatible rendering/runtime path.
  - [ ] Document expected UX/capability differences explicitly for Android users.

- [x] **Optional multi-ABI strategy**
  - [x] Keep `aarch64` as default stable target.
  - [x] Add opt-in universal ABI build path only when host memory/toolchain is sufficient.

---

# 2026-03-01 v1.4.9 - Runtime Verification Update (Desktop + Mobile)


**Goal**: Continue execution after `v1.4.8` with real pipeline runs, and convert remaining Tauri Android uncertainty into an explicit, actionable prerequisite gate.

### Completed This Round

- [x] **Desktop packaging re-verified**
  - [x] Ran `npm run tauri:build:mini` with `NOTE_CONNECTION_GODOT_EXE` set.
  - [x] Sidecar validation passed (`server` + `godot` binaries non-empty).
  - [x] MSI + NSIS artifacts generated successfully.

- [x] **Capacitor Android pipeline fully executed**
  - [x] Fixed `build_apk.bat` parse failures caused by unescaped parentheses inside `if (...)` blocks.
  - [x] Added non-interactive support (`NOTE_CONNECTION_NO_PAUSE` / `CI=true`) for automation.
  - [x] Ran `build_apk.bat` end-to-end and produced debug APK.

- [x] **Tauri Android preflight hardening**
  - [x] Added `scripts/verify-tauri-android-prereqs.js`.
  - [x] Added `npm run verify:android:env`.
  - [x] Wired preflight into:
  - [x] `tauri:android:init`
  - [x] `tauri:android:dev`
  - [x] `tauri:android:build`
  - [x] Result: clear deterministic error when `cmdline-tools/latest/bin/sdkmanager` is missing.

- [x] **Regression coverage updated**
  - [x] Expanded `src/mobile.pipeline.test.ts` to assert:
  - [x] Android preflight script wiring in npm commands.
  - [x] `build_apk.bat` automation flag support.
  - [x] `npm run test:migration` remains green.

- [x] **Dual-path aggregate command validated**
  - [x] Ran `npm run mobile:build:both`.
  - [x] Capacitor branch completed with APK output.
  - [x] Tauri Android branch stopped at explicit preflight check (expected until cmdline-tools are installed).

### Remaining External Prerequisite (Environment)

- [x] **Install Android SDK Command-line Tools for Tauri Android runtime**
  - [x] Required path: `<ANDROID_SDK_ROOT>/cmdline-tools/latest/bin/sdkmanager(.bat)`.
  - [x] Verified with:
  - [x] `npm run verify:android:env`
  - [x] `npm run tauri:android:build`

---

# 2026-03-01 v1.4.8 - Migration Closure & Dual Android Verification


**Goal**: Close the migration action list with executable verification evidence, especially for `P1.5` (Capacitor + Tauri Android dual generation paths).

### Completed Checklist

- [x] **Dual Android pipeline guard tests added**
  - [x] Added `src/mobile.pipeline.test.ts` to lock down:
  - [x] Capacitor + Tauri Android script availability in `package.json`.
  - [x] `capacitor.config.ts` `webDir` consistency (`dist/src/frontend`).
  - [x] `build_apk.bat` expected sync/build steps.
  - [x] `src-tauri/tauri.conf.json` sidecar entries (`bin/server`, `bin/godot`).

- [x] **Migration regression suite expanded**
  - [x] Updated `test:migration` in `package.json` to include `src/mobile.pipeline.test.ts`.
  - [x] Migration suite now covers runtime paths, cache/build dedupe, and dual mobile pipeline contract checks.

- [x] **Execution evidence refreshed (this run)**
  - [x] `npm run build:mini` -> pass.
  - [x] `npm run test:migration` -> pass (`29` tests).
  - [x] `npm run test:tauri` -> pass (`9` Rust tests).
  - [x] `npm run smoke:sidecar:relaunch` -> pass.

### Result

- [x] `P1.5` is now not only documented but also protected by automated regression checks.
- [x] Electron -> Tauri migration checklist is considered closed for the current repository scope (desktop Tauri-first + dual mobile generation entry points).

---

# 2026-03-01 v1.4.6 - Electron Removal Readiness Action Plan


**Goal**: Close all remaining Electron -> Tauri migration gaps so Electron can be removed without regression across desktop release and mobile export strategy.

### Phase P0 - Must Complete Before Electron Removal

- [x] **Implement Tauri persistent config parity (`app_config.toml` + legacy `kb_config` auto-migration)**
  - [x] Persist selected KB path in Tauri app data.
  - [x] Persist user language in Tauri app data.
  - [x] Load both values on startup before frontend initialization.
  - [x] Acceptance: Restart keeps same KB root and menu language without manual re-selection.

- [x] **Harden Godot process launch for non-dev machines**
  - [x] Remove hardcoded absolute paths in `src-tauri/src/lib.rs`.
  - [x] Use packaged/bundled sidecar strategy for Godot executable resolution.
  - [x] Validate Godot binary presence in build artifacts (non-zero file, correct target naming).
  - [x] Acceptance: `npm run tauri build` artifact produced with sidecar validation pipeline.

- [x] **Add explicit child-process lifecycle management**
  - [x] Keep handles for Node sidecar and Godot child processes.
  - [x] Implement app shutdown hooks to terminate child processes deterministically.
  - [x] Add relaunch test to ensure no lingering `3000` port lock.
  - [x] Acceptance: Close app -> no orphan sidecar/Godot processes remain.

- [x] **Fix release-grade writable data/cache paths**
  - [x] Stop assuming write access to `dist/src/frontend` in packaged environments.
  - [x] Define a writable runtime directory (app data/cache) for generated `data.js` and `graph_data.json`.
  - [x] Update sidecar runtime env (`NOTE_CONNECTION_FRONTEND_DIR` + `NOTE_CONNECTION_RUNTIME_DATA_DIR`) and restore/cache logic accordingly.
  - [x] Acceptance: Build + cache restore works with writable runtime data path model in packaged flow.

- [x] **Complete first-run parity with Electron UX**
  - [x] Add first-run KB selection flow in Tauri when no saved config exists.
  - [x] Preserve current menu-based "Change KB / Reset" behavior with persistence.
  - [x] Acceptance: New install follows first-run setup and stores user choice permanently.

### Phase P1 - Stabilization and Verification

- [x] **Unify backend build logs to frontend loading overlay**
  - [x] Emit structured `build-log` events from Rust/sidecar bridge to frontend.
  - [x] Ensure long builds show progress in Tauri as in prior Electron UX.
  - [x] Acceptance: Loading overlay receives incremental backend logs during `/api/build`.

- [x] **Run release smoke tests and document evidence**
  - [x] Windows packaging test (`tauri build` output artifacts generated).
  - [x] Cache decision modal behavior test (`Load Existing` vs `Regenerate`).
  - [x] Single-click build dedupe test (no duplicate build/restore execution).
  - [x] Acceptance: Added reproducible pass evidence in `TEST_REPORT.md`.

- [x] **Clarify GPU startup command usage**
  - [x] Keep recommending `npm run tauri:dev:mini:gpu`.
  - [x] Avoid `npm run tauri:dev:mini --gpu` in docs/examples to prevent npm config warnings.
  - [x] Acceptance: README/manual examples contain only the supported command form.

### Phase P1.5 - Dual Mobile Delivery (Capacitor + Tauri Android)

- [x] **Keep both authoritative Android generation paths**
  - [x] Path A: Keep Capacitor as web-asset runtime with scoped feature set.
  - [x] Path B: Enable Tauri Android workflow per `docs/tauri_brainstorming.md`.
  - [x] Acceptance: Both paths are documented and exposed as build scripts.

- [x] **Capacitor path boundaries explicitly documented**
  - [x] Mark folder-based local build/load sidecar APIs as unsupported on-device unless backend is embedded.
  - [x] Keep mobile-safe fallback UX expectations for source loading/reader content.
  - [x] Acceptance: APK behavior constraints are explicitly documented.

- [x] **Tauri Android pipeline bootstrapped**
  - [x] Add Android build scripts and prerequisites for Tauri mobile.
  - [x] Keep Node-sidecar compatibility caveat documented until mobile-native backend replacement.
  - [x] Acceptance: Tauri Android commands are available for end-to-end pipeline execution.

### Phase P2 - Electron Decommission

- [x] **Remove Electron entry surface only after P0/P1 gates are green**
  - [x] Remove Electron scripts from `package.json`.
  - [x] Remove `main: dist/src/electron/main.js`.
  - [x] Remove Electron dependencies (`electron`, `electron-builder`, `electron-squirrel-startup`) after migration freeze.
  - [x] Archive/remove `src/electron/*` and `electron-builder.yml`.
  - [x] Acceptance: Desktop pipeline is Tauri-first with Electron decommissioned.

- [x] **Documentation cleanup**
  - [x] Update README build/deploy sections from Electron-first to Tauri-first.
  - [x] Keep historical changelog entries, but mark Electron path as deprecated/removed with date.
  - [x] Acceptance: No active docs instruct users to use Electron commands for current releases.

### Electron Removal Gate Checklist (Go/No-Go)

- [x] Persistent KB + language parity verified in Tauri.
- [x] Godot launch works without hardcoded local path.
- [x] No orphan child process after app exit.
- [x] Packaged Tauri build supports build/cache/reader workflows.
- [x] Dual mobile delivery strategy (Capacitor + Tauri Android) finalized and documented.
- [x] README and scripts fully aligned to Tauri.

---

# 2026-03-01 v1.4.5 - Physically-Based Bubbles & Cancel Completion


**Goal**: Upgrade the Godot visualizer with realistic physically-based soap bubbles, remove environmental obstructions, and add flexible task completion UI logic.

### Completed Checklist

- [x] **Physically-Based Shader**
  - [x] Ported 81-wavelength Thin-Film Interference Glassner logic to `bubble_material.gdshader`.
  - [x] Added `warpnoise3` and `sp_spectral_filter` for realistic thickness variations across the sphere.
- [x] **Physics Interactions**
  - [x] Converted central and peripheral bubbles from `MeshInstance3D` to `RigidBody3D`.
  - [x] Added `_physics_process` orbital magnetism so bubbles float and collide realistically without overlapping permanently.
  - [x] Removed `Floor` node obstruction from the `main.tscn` environment.
- [x] **Cancel Completion UI**
  - [x] "Mark Complete" button now dynamically toggles to "Cancel Completion".
  - [x] Connected dynamic states in `path_mode_ui.gd` and `path_renderer.gd` to appropriately mark/unmark nodes.

# 2026-03-01 v1.4.4 - Tauri Bridge Stabilization & Duplicate-Cycle Elimination


**Goal**: Finalize Bridge-first migration hardening for Tauri runtime by resolving cache/load duplication, websocket reconnect churn, and runtime path consistency issues.

### Completed Checklist

- [x] **Cache Decision Recovery**
  - [x] Restored explicit cache decision flow (`Load Existing` / `Regenerate`) before build when target cache exists.
- [x] **Duplicate Execution Protection**
  - [x] Added frontend single-flight guard for source loading.
  - [x] Added backend dedupe protections for `/api/build` and `/api/restore-cache`.
- [x] **PathBridge Diagnostics**
  - [x] Added tagged connection logging (client id/tag/address + close code/reason) to distinguish benign reconnects from real cycles.
- [x] **Godot WS Compatibility**
  - [x] Finalized Godot URL contract as `ws://127.0.0.1:9876` (query suffix removed for Godot compatibility).
- [x] **Tauri Idle Reconnect Removal**
  - [x] Disabled `frontend-early` auto websocket bootstrap in Tauri mode.
- [x] **Language/Menu Idempotency**
  - [x] Added frontend and Rust-side no-op guards for repeated same-language sync calls.

### Files Updated

- `src/frontend/source_manager.js`
- `src/server.ts`
- `src/core/PathBridge.ts`
- `src/frontend/path_app.js`
- `path_mode/scripts/ws_client.gd`
- `src/frontend/i18n.js`
- `src-tauri/src/lib.rs`

# 2026-02-26 v1.4.3 - 9-Rule Tree Layout Engine

**Goal**: Port the 9-rule expansion/claiming/visibility engine from `tree_path_mockup.html` into production code. Replace simple contour-based layout with full ownership/claiming system.

## 9 Rules Reference

| #   | Rule (EN)                                 | 规则 (ZH)                  | Status |
| --- | ----------------------------------------- | -------------------------- | ------ |
| 1   | Expansion Order (FIFO claiming)           | 展开顺序（FIFO 认领）      | [x]    |
| 2   | Preceding Immunity (effective index)      | 前置免疫（有效索引）       | [x]    |
| 3   | Following Migration (spine+followers)     | 后续迁移（脊柱+后续）      | [x]    |
| 4   | Single Appearance (owner-based)           | 单次出现（基于所有者）     | [x]    |
| 5   | Cross-Tributary Isolation (edge filter)   | 跨支流隔离（边过滤）       | [x]    |
| 6   | Spine Always Visible (return on collapse) | 脊柱始终可见（折叠时返回） | [x]    |
| 7   | Sticky Claim (configurable toggle)        | 粘性认领（可配置开关）     | [x]    |
| 8   | Unit Migration (recursive claim)          | 单元迁移（递归认领）       | [x]    |
| 9   | Tributary Hierarchy Immunity              | 支流层级免疫               | [x]    |

## Implementation Checklist / 实施清单

- [x] **Core Algorithm / 核心算法** ([path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js))
  - [x] Add `expansionOrder` parameter / 添加 `expansionOrder` 参数
  - [x] Implement ownership system (`currentOwner`, `ownerPriority`) / 实现所有权系统
  - [x] Implement `tryClaim()` with 9 rules / 实现包含 9 条规则的 `tryClaim()`
  - [x] Implement `getEffectiveSpineIndex()` / 实现有效脊柱索引
  - [x] Implement `determineVisibility()` / 实现可见性判定
  - [x] Filter edges by ownership (Rule 5) / 按所有权过滤边
  - [x] Group hulls by ownership / 按所有权分组 hull

- [x] **Frontend Bridge / 前端桥接** ([path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js))
  - [x] Convert `forcedExpansionNodes` Set → `expansionOrder` Array / 转换为有序数组
  - [x] Add `stickyClaimEnabled` setting / 添加粘性认领设置

- [x] **Godot Renderer / Godot 渲染器** ([tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd))
  - [x] Edge filtering by `currentOwner` / 按所有者过滤边
  - [x] Hull collision avoidance / Hull 碰撞避让
  - [x] Node type coloring (spine/tributary/shared/migrated) / 节点类型着色
  - [x] Expansion indicator badge / 展开指示器徽章

- [x] **Worker** ([path_worker.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_worker.js))
  - [x] Pass `expansionOrder` + `stickyClaimEnabled` / 传递展开顺序和粘性认领

## Files Changed / 修改文件

| File                                 | Change                                 | 变更                                 |
| ------------------------------------ | -------------------------------------- | ------------------------------------ |
| `src/frontend/libs/path_core.js`     | Add 9-rule engine to `getTreeLayout()` | 向 `getTreeLayout()` 添加 9 规则引擎 |
| `src/frontend/path_app.js`           | Ordered expansion tracking             | 有序展开追踪                         |
| `path_mode/scripts/tree_renderer.gd` | Edge/hull/color updates                | 边/hull/颜色更新                     |
| `src/frontend/path_worker.js`        | Pass new parameters                    | 传递新参数                           |

## Reference / 参考

- Mockup: [tree_path_mockup.html](file:///e:/Knowledge_project/NoteConnection_app/tree_path_mockup.html)
- Previous plan: [implementation_plan.md](file:///e:/Knowledge_project/NoteConnection_app/implementation_plan.md) Phase 3
- Design notes: [brainstorming.md](file:///e:/Knowledge_project/NoteConnection_app/brainstorming.md) Session 6

---

# 2026-02-01 v1.4.1 - Path Mode v2: Orbital Learning Architecture

**Goal**: Transform Path Mode into an immersive, game-like learning experience with 3D bubble visualization and progress tracking.

## Architecture Overview

### Hybrid Visualization Strategy

1. **Godot Desktop** (Port 9876): Vulkan/OpenGL + 3D iridescent bubbles
2. **Web Fallback**: Canvas/WebGL for Android/Browser
3. **Godot Mermaid Runtime Contract**: PNG-only (`pngBase64` required); SVG retained as diagnostics-only payload, not runtime fallback.

### Learning Modes

- **Domain Learning**: Topological sort of concept cluster (learn entire subject area)
- **Diffusion Learning**: Shortest path from target backwards to prerequisites

---

## Finalized Design Decisions

| Decision             | Final Choice                       | Rationale                      |
| -------------------- | ---------------------------------- | ------------------------------ |
| Display Limit        | 1 Central + 1-4 Peripheral         | Adapts to connectivity         |
| Zero In-Degree       | Use highest relevance score        | Ensures meaningful peripherals |
| Peripheral Selection | In-degree first + association fill | Balances order with discovery  |
| Central Content      | Title + Progress indicator         | Core UX requirement            |
| Peripheral Labels    | 15 chars + ellipsis                | Clean yet informative          |
| Transition           | Orbital rotation (~500ms)          | Matches metaphor               |
| Gold Star Sidebar    | Collapsible `★ × {N}` format       | Reduces clutter                |

---

## Implementation Checklist

- [ ] **Orbital Bubble Layout**
  - [x] Central bubble = current priority node (large, bright)
  - [x] Peripheral bubbles = connected nodes (smaller, semi-transparent)
  - [x] Smooth animation on central node switch
  - [ ] **Orbital rotation animation** (~500ms arc transition)
  - [ ] Layer separation (peripheral cannot overlap central text)
  - [ ] 3D iridescent bubble shader (fresnel + thin-film interference)

- [ ] **Peripheral Node Selection Algorithm**
  - [ ] Domain Mode: In-degree nodes first, fill with highest-association
  - [ ] Diffusion Mode: High-association to current (exclude target out-degree)
  - [ ] Zero in-degree fallback: Select by relevance score

- [ ] **Central Bubble Content**
  - [ ] Node title (max 24 chars)
  - [ ] Progress indicator: "X of Y prerequisites learned"
  - [ ] Peripheral labels: Title only (max 15 chars + ellipsis)

- [ ] **Learning Progress Tracking**
  - [ ] "Mark Complete" button shrinks central to gold mini-bubble
  - [ ] Collapsible sidebar: `★ × {count}` header format
  - [ ] Click sidebar item → Opens reader
  - [ ] localStorage persistence by default
  - [ ] Auto-advance to next highest priority node

- [ ] **Settings: Path Mode Section**
  - [ ] Add "Path Mode" section to settings modal
  - [ ] "Retain Learning History" checkbox (default ON)
  - [ ] "Auto-reconstruct path on start change" toggle
  - [ ] Integrate with `SettingsManager`

- [ ] **Focus-like Interactions**
  - [x] Double-click central → Opens reader with node content
  - [x] Double-click peripheral → Orbital rotation to center
  - [x] Canvas hit-testing for click detection

- [ ] **Future Path Tree View**
  - [ ] D3-based tree layout for future learning path
  - [ ] Click tree node → Switch central view
  - [ ] Visual states: ★ Completed, ● Current, ○ Pending

- [ ] **Enhanced Graphical Tree View (v2)**
  - [ ] SubViewport overlay panel with collapsible drawer
  - [ ] Bezier curve rendering (parent-child connections)
  - [ ] 4 selectable visual themes:
    - [ ] **Colorful Status** (default): Gold/Cyan/Gray by state
    - [ ] **Dark**: Dark bg, gradient nodes, soft blue/purple curves
    - [ ] **Glass/Frosted**: Semi-transparent, glowing curves
    - [ ] **Minimal Monochrome**: White/gray, thin curves
  - [ ] Tab buttons: `[Subtree] [Full Path]`
  - [ ] Dropdown style selector in header
  - [ ] Node interactions:
    - [ ] Single-click: Expand/collapse + context menu
    - [ ] Double-click: Navigate (make central)
    - [ ] Context menu: Navigate / Mark Complete / Unmark
  - [ ] **New Files**:
    - [ ] `tree_view_panel.tscn` + `tree_view_panel.gd`
    - [ ] `tree_renderer.gd` (bezier curve drawing)
    - [ ] `tree_styles.gd` (4 visual themes)

- [ ] **Godot Desktop Renderer**
  - [ ] Upgrade `path_renderer.gd` to 3D MeshInstance3D
  - [ ] Implement `bubble_material.gdshader` (fresnel + iridescence)
  - [ ] Create `learning_state_machine.gd` for flow control
  - [ ] Central/Peripheral bubble differentiation
  - [ ] Bidirectional interaction via WebSocket
  - [ ] `node_clicked` signal → PathBridge → Frontend

- [ ] **Frontend Web Fallback**
  - [ ] Create `path_orbital.js` (Canvas orbital renderer)
  - [ ] Create `path_tree.js` (D3 tree layout)
  - [ ] Orbital rotation animation in Canvas

---

## File Changes Required

### Backend

- **[MODIFY]** `src/frontend/libs/path_core.js`
  - Add `getPeripheralNodes(centralId, mode)` method
  - Add `getTreePath(currentId, learningPath)` for tree view
  - Add progress tracking state management

### Godot

- **[MODIFY]** `path_mode/scripts/path_renderer.gd` → 3D rendering
- **[NEW]** `path_mode/scripts/learning_state_machine.gd`
- **[NEW]** `path_mode/shaders/bubble_material.gdshader`
- **[MODIFY]** `path_mode/scripts/ws_client.gd` → New message handlers

### Frontend

- **[NEW]** `src/frontend/libs/path_orbital.js`
- **[NEW]** `src/frontend/libs/path_tree.js`

---

# 2026-01-23 v1.2.0 - Path Mode & Desktop Renderer

**Goal**: Transform the graph into a structured learning curriculum and enable high-fidelity desktop rendering.

- [x] **Path Mode (Learning Paths)**
  - [x] **strategies**: Implemented "Foundational" (Base-first) and "Core" (Centrality-first) sorting algorithms.
  - [x] **Modes**:
    - **Domain Learning**: Topological sort of a concept cluster to map a full subject area.
    - **Diffusion Learning**: Shortest-path extraction from a target node backwards to its prerequisites.
  - [x] **Visualization**:
    - **Radial / Tree Layouts**: specialized D3 layouts for linearizing graphs.
    - **Progress Tracking**: Visual states for "Learned", "Next", and "Locked" nodes.
- [x] **Hybrid Architecture**
  - [x] **Godot Bridge**: Established WebSocket communication (`Start port: 9876`) between Electron and Godot 4.3.
  - [x] **Native Renderer**: Low-latency Vulkan/OpenGL renderer for the "Path Mode" visualization on Desktop.
  - [x] **Web Fallback**: Full feature parity in Web/Canvas mode for Android and browser users.

# 2026-01-23 v1.1.2 - Path Resolution & UI Stability

**Goal**: Resolve static file serving issues on Windows and fix UI unresponsiveness in the Welcome Modal.

- [x] **Backend Fixes**
  - [x] **URL Parsing**: Improved `server.ts` to ignore query strings when mapping static files, enabling cache-busting `data.js?v=...` to work correctly.
- [x] **UI Stability**
  - [x] **Z-Index Management**: Fixed `welcome.js` to explicitly restore `z-index: 1000` to the folder menu after skipping the tutorial.

# 2026-01-22 v1.1.1 - Mobile Build Automation

**Goal**: Automate the Android APK build process to lower the barrier for mobile deployment.

- [x] **Mobile DevOps**
  - [x] **Build Script**: Created `build_apk.bat` for zero-config build orchestration on Windows.
  - [x] **Environment Checks**: Automated verification of Node.js, Java JDK, and Android SDK.
  - [x] **Documentation**: Updated all manuals with the new one-click build method.

# 2026-01-22 v1.1.0 - CI/CD Automation

**Goal**: Improve system robustness through protocol handler fixes, i18n consolidation, and onboarding UI refinement.

- [x] **Multilingual Consolidation**
  - [x] **Centralized I18n**: Removed redundant hardcoded translation logic from `app.js` and integrated with `I18nManager`.
  - [x] **UI Consistency**: Fixed "Mixed Language" issues in the Welcome Modal and Loading screen.
- [x] **Onboarding UI Refinement**
  - [x] **Tutorial Stability**: Fixed Focus Mode activation in tutorials by exposing `enterFocusMode` and `exitFocusMode` as global APIs.
  - [x] **Welcome Modal UX**: Optimized trigger timing in `source_manager.js` to ensure accurate display based on data state.
- [x] **Protocol Handler & Caching**
  - [x] **Cache-Busting**: Implemented dynamic script loading in `source_manager.js` using timestamps to prevent browser caching of `data.js`.
  - [x] **Protocol Optimization**: Refined `app://` protocol handler in `main.ts` using `net.fetch` for better reliability.
- [x] **Mobile Build Automation**
  - [x] **Build Script**: Implemented `build_apk.bat` for one-click Android APK generation (Zero-Config).
  - [x] **Documentation**: Updated User Manual and README with build instructions.

---

# 2026-01-14 v1.0.0 - Production Release

**Goal**: Official production release with optimized Focus Mode, GPU diagnostics, and enhanced security.

- [x] **Focus Mode Optimization**
  - [x] **Adjacency Cache**: Implemented O(1) adjacency lookup for neighbors, reducing Focus Mode entry time by 50-500x.
  - [x] **Edge Map for Scoring**: Optimized neighbor scoring by caching edge weights.
  - [x] **Batched Rendering**: Wrapped UI updates in `requestAnimationFrame` to prevent layout thrashing.
- [x] **Random Focus**: Added a dice icon next to the search bar for discovering and focusing on random nodes instantly.
- [x] **GPU & Security**
  - [x] **Forced GPU Mode**: Explicitly set GPU mode with detailed hardware vendor/renderer reporting.
  - [x] **CSP Enhancement**: Updated Content Security Policy to allow external font loading (Google Fonts).
  - [x] **Security Hardening**: Removed insecure `enableBlinkFeatures` flag.
- [x] **User-Defined Knowledge Base**
  - [x] **Persistence**: Implemented `app_config.toml` to store user-selected paths (with legacy `kb_config.json` auto-migration).
  - [x] **First-Run Experience**: Added setup wizard for selecting initial KB folder.
  - [x] **Menu Integration**: Added "Change Knowledge Base" and "Reset to Default" to File menu.
- [x] **Stability & Installer Reliability**
  - [x] **Mini Build Fix**: Resolved first-run crashes and implemented automatic cleanup of pre-generated data files in mini mode.
  - [x] **Worker Paths**: Fixed worker path resolution issues in production environment.
- [x] **Absolute Offline Support**
  - [x] **Local Assets**: Migrated all CDN dependencies (D3, KaTeX, Mermaid, etc.) to local assets.
  - [x] **CSP Security**: Updated CSP to support absolute offline operation.
- [x] **Focus Mode Fidelity**
  - [x] **Visual Restoration**: Guaranteed perfect radius and font-size restoration when exiting focus mode.
  - [x] **Interaction**: Fixed D3 sibling selection errors in Focus Mode.
- [x] **Physics Defaults**
  - [x] **Spacing**: Increased default link distance to 250px and collision to 25px for better legibility.

---

# 2026-01-13 v0.9.83 - GPU Rendering Debugging

**Goal**: Resolve race conditions during layout switching due to asynchronous Worker messages, enhance interaction stability in Focus Mode, and improve layout restoration security.

- [x] **Worker Handshake Protocol**
  - [x] **Display Lock**: Implemented `isLayoutSwitching` state machine to block stale `tick` messages during transitions.
  - [x] **Bi-directional Sync**: Introduced `layoutSwitchDone` loop to ensure UI and Worker coordinates are perfectly aligned.
- [x] **Focus Mode Dragging Isolation**
  - [x] **Manual Dragging**: Focus Mode nodes no longer send drag messages to the Worker; coordinates are calculated directly on the main thread.
  - [x] **Display Refresh**: Fixed race condition bug where late messages would overwrite manually set coordinates.
- [x] **Layout Restoration Safety**
  - [x] **Threshold Validation**: Set a 50% success threshold for cache restoration.
  - [x] **Auto Fallback**: If many nodes are missing or data is inconsistent, automatically force a physics relaxation phase.
- [x] **Analysis Panel Stability**
  - [x] **Render Optimization**: Adjusted `updateLayout` logic to strictly prohibit center force resets during panel resizing under "Freeze Layout".
- [x] **GPU Worker Integration**
  - [x] **Worker Acceleration**: Fully enabled GPU forces (`gpuManyBody`, `gpuLink`) within `simulationWorker.js`.
  - [x] **Environment Fix**: Refactored `layout_gpu.js` to be compatible with Web Worker `self` context via `globalScope`.
  - [x] **Persistence Fix**: Optimized `updateParams` in Worker to update existing forces using `.strength()` instead of replacing them, preventing accidental CPU-fallback.
  - [x] **Settings Sync**: Verified `gpuRendering` flag is correctly passed to the Worker during initialization.

# Project Build Plan: Progressive Hierarchical Knowledge Graph

This document outlines the roadmap for building `NoteConnection`, a system capable of visualizing tens of thousands of knowledge points as a Directed Acyclic Graph (DAG), highlighting hierarchical relationships and learning paths.

---

# 2026-01-12 v0.9.74 - GPU Link Force & Robustness

**Goal**: Implement GPU-accelerated Link Force and finalize stable layout switching with state preservation and WebGL resource management.

- [x] **GPU Link Force Acceleration**
  - [x] **GPULinkForce Class**: Implemented high-performance spring force in `layout_gpu.js`.
  - [x] **Gather Algorithm**: Optimized neighbor processing using flattened adjacency structures.
  - [x] **D3 Integration**: Added API shims (`links`, `strength`, `distance`) for seamless `app.js` integration.

- [x] **Physics Robustness & Stability**
  - [x] **Velocity Clamping**: Prevents node "explosions" by capping velocity at 100.
  - [x] **NaN Safety**: Implemented math guards in GPU kernels and `isFinite` checks in JS.
  - [x] **Shadowing Fix**: Renamed internal `links` to `_links` in `GPULinkForce` to prevent property-method collision.
  - [x] **Focus Mode Support**: Updated `enterFocusMode` and `exitFocusMode` in `app.js` to handle GPU forces.
  - [x] **Focus Mode Isolation**: Enforced completely independent node dimensions and positioning, with zero leakage to the main interface upon exit.
  - [x] **Focus Mode Interactions**: Enabled manual node dragging (without physics) and fixed race condition causing position reset.
  - [x] **Query History**: Implemented a history dropdown in Focus Mode; pins duplicate nodes to top of list.
  - [x] **Analysis Stability**: Added auto-freeze and prevented redundant layout updates (center force reset) during resize.
  - [x] **Analysis Scroll**: Fixed container styles to ensure the "Filtered Nodes" list is vertically scrollable.

- [x] **Layout Switching & Resource Fixes**
  - [x] **Switch Logic**: Implemented "First Switch" relaxation vs "Subsequent Switch" restoration logic.
  - [x] **Cache Persistence**: Enforced strict validation of cached layout states; falls back to relaxation if cache is invalid or partial.
  - [x] **Race Condition Fix**: Implemented Worker Handshake Protocol (`isLayoutSwitching`) to block stale ticks causing layout reversion.
  - [x] **GPU Resource**: Prevented redundant GPU kernal re-compilation on layout switches by reusing manager instances. for `SharedGPU`, preventing WebGL context leaks.
  - [x] **Constructor Safety**: Enhanced `GPU.GPU` detection for varying library builds.
  - [x] **Responsiveness**: Optimized layout switching to be near-instant by deferring worker synchronization.

---

# 2026-01-12 v0.9.73 - GPU Rendering Fix (Chaining Bug)

**Goal**: Fix the "Silent Failure" of GPU Force caused by a method chaining bug in `layout_gpu.js`, which prevented v0.9.72 from actually activating the GPU physics despite UI settings.

- [x] **Bug Fix**
  - [x] **Method Chaining**: Fixed `strength()` method in `layout_gpu.js` to return the `impl` function wrapper instead of `this`.
  - [x] **Verification**: Confirmed `d3.force` now correctly receives the callable function.

# 2026-01-12 v0.9.72 - GPU Optimized Rendering (Geek Edition)

**Goal**: Fulfill the "Geek" requirement to leverage AMDGPU (RX 7900XT) for smoother frontend rendering and parallel backend processing.

- [x] **Frontend GPU Rendering**
  - [x] **GPU Force Engine**: Implemented `GPUManyBodyForce` in `layout_gpu.js` using `gpu.js`.
  - [x] **Integration**: Added `libs/gpu-browser.min.js` and integrated into `app.js`.
  - [x] **UI Control**: Verified "GPU Optimised Rendering" checkbox in Settings. Default: Enabled.
  - [x] **Logic**: Dynamic switching between CPU (`d3.forceManyBody`) and GPU (`gpuManyBody`) physics engines.

- [x] **Backend Optimization Confirmation**
  - [x] **Parallelism**: Confirmed `GraphBuilder` uses `LayoutEngine` with Worker threads.
  - [x] **GPU Backend**: Confirmed `LayoutEngine` uses `amdgpu/LayoutGPU.ts` if enabled.

---

# 2026-01-10 v0.9.71 - Backend Layout & Static Mode

**Goal**: Optimize performance for massive graphs (50k+ nodes) by offloading layout calculations to backend workers and implementing a static rendering mode.

- [x] **Backend Parallel Layout**
  - [x] **Layout Engine**: Created `LayoutEngine.ts` and `layoutWorker.ts` to run `d3-force` simulation on backend threads.
  - [x] **Integration**: `GraphBuilder` now automatically triggers backend layout calculation for graphs > 100 nodes.
  - [x] **GPU Acceleration**: Implemented `LayoutGPU.ts` using `gpu.js` to accelerate layout on AMDGPU.
  - [x] **Performance**: Reduces frontend initialization time by providing pre-calculated coordinates.

- [x] **Frontend Optimizations**
  - [x] **Static Mode**: Introduced a "Static Mode" toggle.
    - [x] **Auto-Enable**: Automatically enabled for >5000 nodes or >200,000 edges.
    - [x] **Behavior**: Simulation runs for 2 seconds (warm-up) then stops to save CPU.
    - [x] **Layout Switch**: Respects static mode during layout transitions (Force <-> DAG).
  - [x] **GPU Settings**: Added "GPU Optimised Rendering" checkbox to settings to control acceleration flags.
  - [x] **Extreme Scale**: Strictly disabled edge rendering for graphs >10,000 nodes to prevent rendering bottlenecks.

- [x] **CLI & File Management**
  - [x] **CLI Arguments**: Added `--path` and `--gpu` support to `npm start`.
  - [x] **File Isolation**: CLI runs generate unique `data_cli_*.js` files to protect the original `data.js`.
  - [x] **Server Logic**: `server.ts` automatically serves the correct CLI data file based on build parameters.

---

# 2026-01-09 v0.9.70 - Frontend Initialization Fix (Race Condition)

**Goal**: Resolve the "No nodes displayed" and "Unresponsive Buttons" issue caused by a race condition in the initialization sequence for large datasets.

- [x] **Bug Fix**
  - [x] **Race Condition**: Identified that `renderCanvas` was being called by `ResizeObserver` or `setTimeout` _before_ the `controls` object was defined, causing a fatal error that halted script execution.
  - [x] **Refactor**: Moved `controls` definition to the top of `app.js`.
  - [x] **Robustness**: Added safety checks in `isNodeVisible` and `renderCanvas` to prevent crashes during initialization.
  - [x] **Result**: UI buttons (Freeze, Settings) should now initialize correctly, and the canvas should render immediately.

# 2026-01-09 v0.9.69 - Frontend Crash Fix (10k+ Nodes)

**Goal**: Fix the critical "Nodes: 0" bug caused by a stack overflow when processing 1.2 million edges in the frontend.

- [x] **Bug Fix**
  - [x] **Stack Overflow**: Identified `RangeError: Maximum call stack size exceeded` in `app.js` due to `links.push(...validLinks)` with 1.2M arguments.
  - [x] **Refactor**: Changed `links` declaration from `const` to `let` and replaced the spread operation with direct assignment (`links = validLinks`).
  - [x] **Result**: The application now successfully loads and renders graphs with >10,000 nodes and >1 million edges without crashing.

# 2026-01-09 v0.9.68 - Content-on-Demand Architecture (10k+ Fix)

**Goal**: Definitively solve the "Nodes: 0" display issue for 10k+ nodes caused by massive `data.js` file size (~500MB) crashing the browser.

- [x] **Architecture Refactor**
  - [x] **Data Splitting**: Separated graph structure (`data.js`) from content (`graph_data.json`).
  - [x] **Optimization**: `data.js` now excludes node content, reducing file size by ~95% (e.g., 500MB -> 35MB for 13k nodes).
  - [x] **Backend**: Updated `src/index.ts` to generate "Lite" `data.js`.

- [x] **Content-on-Demand**
  - [x] **API Endpoint**: Added `GET /api/content` to `server.ts` to serve raw node content securely.
  - [x] **Frontend**: Updated `Reader` in `reader.js` to fetch content asynchronously when opening a node.
  - [x] **UX**: Added loading state indicator in Reader window.

# 2026-01-08 v0.9.67 - Compact Mode & Canvas Fix

**Goal**: Solve the display issue for 10k+ nodes and implement a performance mode that hides edges by default.

- [x] **Compact Mode**
  - [x] **Auto-Enable**: Automatically activates for >5000 nodes or >100,000 edges.
  - [x] **Edge Culling**: Rendering loop skips edge iteration entirely in Compact Mode unless highlighting is active.
  - [x] **Settings UI**: Added "Compact Mode (Hide Edges)" checkbox to Performance settings.
- [x] **Canvas Fix**
  - [x] **Initial Render**: Forced explicit `resizeCanvas()` and `ticked()` calls after initialization to prevent blank screen.

# 2026-01-08 v0.9.63 - 10k Node Optimization & Memory Strategy

**Goal**: Solve the "stuck" rendering issue for 10k+ nodes/1.2M edges and implement configurable memory strategies for backend processing.

- [x] **Frontend Optimization**
  - [x] **Physics Culling**: Implemented edge limit (20k) for the D3 Force Simulation. If total edges exceed this, only a subset drives the physics to prevent Main Thread freeze, while all edges remain available for rendering/traversal.
  - [x] **Link Resolution**: Pre-resolved link source/target to objects to support robust rendering even when physics uses a subset.
  - [x] **UI Unblocking**: Fixed "Quick Start Guide" not appearing by freeing up the main thread.

- [x] **Backend Memory Strategy**
  - [x] **Configuration**: Added `memorySavingMode` and `deepDebug` to `AppConfig`.
  - [x] **Worker Optimization**: Refactored `keywordMatchWorker` and `statisticalWorker` to support both `filePaths` (Low Memory) and `filesChunk` (High Performance/Precision) modes.
  - [x] **Graph Metrics**: Added check to force Single-Core execution for `Betweenness Centrality` when `memorySavingMode` is active.
  - [x] **Cycle Detection**: Adjusted limit (100 vs 10000) based on memory mode.

- [x] **System Monitoring**
  - [x] **Peak Memory**: Updated `PerformanceLogger` to track and log Peak Heap/RSS memory usage.
  - [x] **Deep Debug**: Implemented conditional detailed logging based on `deepDebug` flag.

# 2026-01-07 v0.9.62 - Documentation Update (AMDGPU Guide)

**Goal**: Provide detailed hardware and software guidance for AMDGPU users, specifically for `gpu.js` acceleration and future AI integration.

- [x] **Documentation**
  - [x] **README.md**: Add "Hardware & Driver Requirements" section detailing RDNA architectures, driver selection (Adrenalin vs Mesa/ROCm), and build dependencies for `headless-gl`.

# 2026-01-07 v0.9.61 - Frontend Memory Optimization (Auto-Canvas)

**Goal**: Reduce frontend memory consumption and improve rendering performance for large graphs by automatically defaulting to "Canvas" mode when the node count exceeds a threshold.

- [x] **Smart Defaults**
  - [x] **Threshold Check**: In `app.js`, check if `nodes.length > 3000`.
  - [x] **Auto-Switch**: If threshold exceeded, programmatically select "Canvas" renderer and update DOM visibility (hide SVG, show Canvas) during initialization.
  - [x] **User Override**: Users can still manually switch back to SVG if desired.

# 2026-01-07 v0.9.60 - Parallel Graph Metrics

**Goal**: Optimize graph construction performance by parallelizing the "Graph Metrics" calculation (Betweenness Centrality), which was previously single-threaded.

- [x] **Parallelization**
  - [x] **Worker Implementation**: Created `betweennessWorker.ts` to calculate partial centrality scores for a subset of nodes using Brandes Algorithm.
  - [x] **Async Logic**: Updated `GraphMetrics` to `calculateBetweennessAsync` using a pool of workers (Default: `numCPUs - 1`).
  - [x] **Integration**: Integrated async metrics calculation into `GraphBuilder` pipeline.
  - [x] **Verification**: Validated functionality with `test_metrics_parallel.ts` on 500+ nodes.

# 2026-01-07 v0.9.59 - Vector Space Memory Fix (Sparse Matrix)

**Goal**: Resolve the "Heap out of memory" crash on Windows 10/11 (128GB RAM) when processing 13k+ files by replacing the dense TF-IDF matrix with a Sparse Vector implementation.

- [x] **Memory Optimization**
  - [x] **Sparse Vectors**: Refactored `VectorSpace` to use `Uint32Array` (indices) and `Float32Array` (values) instead of standard Javascript Arrays.
  - [x] **Efficiency**: Reduced memory footprint for 13k files from ~10GB+ (dense) to <500MB (sparse).
  - [x] **Algorithm**: Optimized Cosine Similarity calculation to use sparse dot product ($O(min(N, M))$).
  - [x] **Config**: Increased default Node.js heap limit to 12GB (`--max-old-space-size=12288`) in `package.json` to utilize available system RAM.

# 2026-01-07 v0.9.58 - Hybrid Inference Resource Reuse (Optimization)

**Goal**: Fix "Heap out of memory" crash during Hybrid Inference by preventing redundant calculation of Statistical Matrix and Vector Space.

- [x] **Resource Optimization**
  - [x] **Shared State**: Implemented `sharedStatsMatrix` and `sharedVectorSpace` in `GraphBuilder`.
  - [x] **Logic**: Pre-calculates these heavy resources if `HybridInference` is enabled, reusing them across Statistical and Vector steps.
  - [x] **Cleanup**: Explicitly clears shared resources after inference is complete.
  - [x] **Result**: Eliminates the 2x memory spike when running Hybrid Inference, preventing OOM on 13k+ files.

# 2026-01-07 v0.9.57 - Worker Memory Optimization

**Goal**: Resolve "Heap out of memory" errors on Windows 10/11 when processing large datasets (13k+ files) by optimizing data transfer between main thread and workers.

- [x] **Worker Data Transfer**
  - [x] **Optimization**: Refactored `keywordMatchWorker` and `statisticalWorker` to accept `filePaths: string[]` instead of `filesChunk: RawFile[]` (which contained full content).
  - [x] **Implementation**: Workers now read file content on-demand from disk using `fs`, avoiding the massive memory overhead of cloning content strings during serialization.
  - [x] **Result**: Significantly reduced heap usage during parallel processing steps.

# 2026-01-05 v0.9.56 - Hybrid Inference Memory Analysis

**Goal**: Analyze and optimize the memory usage of the "Hybrid Inference" engine to resolve "Heap out of memory" errors on Windows 10, preventing large object retention during graph construction.

- [x] **Granular Logging**
  - [x] **Implementation**: Added detailed `PerformanceLogger` steps within `HybridEngine.infer` and `GraphBuilder` (Stats Matrix, Vector Space, Inference Engine).
  - [x] **Progress Tracking**: Logs memory usage every 1000 nodes processed during inference to pinpoint spikes.
  - [x] **Optimization**: Explicitly clears the large `matrix` and nullifies `vectorSpace` immediately after inference to release heap memory before subsequent steps.

# 2026-01-05 v0.9.55 - Heap OOM Fix & Iterative DFS

**Goal**: Resolve "Heap out of memory" crash on Windows 10/11 by optimizing memory usage during graph construction and refactoring recursion to iteration.

- [x] **Memory Optimization**
  - [x] **Scope Management**: Explicitly clear `fileMap` (holding file contents) before entering the memory-intensive `Algorithmic Core` phase in `GraphBuilder`.
  - [x] **Granular Logging**: Split `Algorithmic Core` logging into `Cycle Detection` and `Topological Sort` for precise error tracking.

- [x] **Algorithm Robustness**
  - [x] **Iterative DFS**: Refactored `CycleDetector.detectCycles` to use an iterative stack-based approach instead of recursion to prevent stack overflow on deep graphs.
  - [x] **Verification**: Validated logic with existing unit tests.

# 2026-01-05 v0.9.54 - Welcome & Empty State Experience

**Goal**: Improve the new user onboarding experience by providing clear guidance when the graph is empty.

- [x] **Empty State Handling**
  - [x] **Detection**: Logic in `welcome.js` detects if `graphData` is empty or missing.
  - [x] **Welcome Modal**: Implemented a "Welcome to NoteConnection" modal that guides users to:
    1. Select a Source Folder.
    2. Click Load.
  - [x] **Visual Cues**: Highlights the Source Control area when the modal is active.

# 2026-01-05 v0.9.53 - Core API Decoupling

**Goal**: Prepare the codebase for Plugin integration (Joplin/Obsidian) by decoupling the core logic from the CLI environment.

- [x] **Core Refactoring**
  - [x] **NoteConnection Class**: Created `src/core/NoteConnection.ts` as the main facade.
  - [x] **Decoupling**: Moved `buildGraph` logic out of `src/index.ts` to allow library-style usage.
  - [x] **CLI Update**: Refactored `src/index.ts` to consume the new Core API.

# 2026-01-05 v0.9.52 - Cycle Detection Memory Optimization

**Goal**: Solve the "Heap out of memory" crash on Windows 10/11 when processing large graphs with many cycles (100k+ edges).

- [x] **Cycle Detection Optimization**
  - [x] **Limit Logic**: Updated `CycleDetector` to accept a `limit` parameter.
  - [x] **Termination**: Stops recursion/search immediately after finding the specified number of cycles (100) instead of collecting all of them.
  - [x] **Verification**: Added unit tests to ensure limit is respected.

# 2026-01-03 v0.9.51 - Performance Logging & Crash Reporting

**Goal**: Enhance system observability by implementing detailed performance metrics and automatic crash reporting to facilitate debugging.

- [x] **Performance Logger**
  - [x] **Utility**: Created `PerformanceLogger` class to track Time, CPU (User/Sys), and Memory (Heap/RSS).
  - [x] **Integration**: Wrapped all `GraphBuilder` stages (Node Init, Edge Matching, Inference) with logging.
  - [x] **GPU Tracking**: Integrated logging into `VectorSpaceGPU` to monitor kernel execution time.
- [x] **Crash Reporting**
  - [x] **Utility**: Created `CrashLogger` to write unhandled errors to `crash.log`.
  - [x] **Integration**: Attached global handlers (`uncaughtException`, `unhandledRejection`) in `server.ts`.
  - [x] **Workers**: Added try-catch blocks and logger integration to `keywordMatchWorker` and `statisticalWorker`.

# 2026-01-02 v0.9.50 - GPU Acceleration Feasibility

**Goal**: Verify and implement GPU acceleration for mathematical operations (Matrix Multiplication) to further speed up Graph Construction on supported hardware (verified on AMD 7900XT).

- [x] **Feasibility Verification**
  - [x] **Library**: Installed `gpu.js` to bridge Node.js with GPU via WebGL/OpenCL.
  - [x] **Hardware Check**: Verified successful kernel compilation and execution on AMD Radeon 7900XT (Windows 10).
  - [x] **Benchmark**: Matrix Multiplication (512x512) completed successfully in GPU mode.
- [x] **Implementation Plan**
  - [x] **Vector Space**: Offload the $N \times N$ Cosine Similarity matrix calculation to GPU (`amdgpu/VectorSpaceGPU.ts`).
  - [x] **Constraint**: Keep string processing (Keyword Matching) on CPU (Workers) as data transfer overhead to GPU outweighs benefits for text.

---

# 2026-01-02 v0.9.49 - Statistical Analysis Memory Optimization

**Goal**: Fix "Heap out of memory" errors when processing large datasets (10k+ files) by optimizing the Co-occurrence Matrix calculation.

- [x] **Algorithm Optimization**
  - [x] **Sparse Matrix Calculation**: Refactored `calculateMatrixOptimized` to use a file-centric iteration approach ($O(Files \times TermsPerFile^2)$) instead of the dense term-pair iteration ($O(TotalTerms^2)$).
  - [x] **Reduction of Complexity**: Reduced complexity from ~170 million iterations (for 13k nodes) to ~5 million iterations.
  - [x] **Data Structure Efficiency**: Removed unnecessary intermediate object conversions (`Set` <-> `Array`) during worker result aggregation.
  - [x] **Worker Result Merging**: Optimized `runParallelTermExtraction` to merge chunks iteratively instead of using `reduce` to prevent memory spikes.

---

# 2026-01-02 v0.9.48 - Parallel Processing Optimization

**Goal**: Optimize graph building performance by allowing configurable worker thread limits, utilizing more CPU cores for large datasets.

- [x] **Worker Configuration**
  - [x] **Configurable Limit**: Added `maxWorkers` to `AppConfig` to override the default worker limit.
  - [x] **Removal of Cap**: Removed the hardcoded 12-worker limit in `GraphBuilder` and `StatisticalAnalyzer`. Defaults to `numCPUs - 1` if not specified.
  - [x] **Verification**: Validated with 50 workers on test dataset.

---

# 2026-01-02 v0.9.47 - Focus Mode Interaction & Layout Fixes

**Goal**: Improve Focus Mode usability by preventing accidental zooming and fixing label overlap in Vertical layouts.

- [x] **Interaction Logic**
  - [x] **Double Click Zoom Prevention**: Added `stopPropagation` to the node double-click handler to prevent `d3.zoom` from triggering a zoom-in event when entering Focus Mode.

- [x] **Focus Mode Layout**
  - [x] **Vertical Spacing**: In "Vertical" (L-R) layout, increased the horizontal offset (`dx`) of node labels to **35px** (from default ~12px) to prevent overlap between text and nodes.
  - [x] **Focus Node**: Applied the same horizontal offset to the central Focus Node in vertical layout for consistency.

---

# 2025-12-26 v0.9.46 - Focus Mode UI Cleanup & Canvas Edge Fix

**Goal**: Clean up the UI during Focus Mode to reduce clutter and fix visual rendering in Canvas mode.

- [x] **UI Hiding**
  - [x] **Main Controls**: "Select Knowledge Base", "Load", and the main "NoteConnection" dropdown are now completely hidden (`display: none`) when entering Focus Mode.
  - [x] **Restoration**: Elements are restored to their default state (`display: ''`) upon exiting Focus Mode, respecting CSS rules (e.g., mobile visibility).

- [x] **Canvas Visualization**
  - [x] **Edge Hiding**: In Canvas Focus Mode, _all_ edges are now hidden to provide a cleaner look, matching the "do not display any edges" requirement.

---

# 2025-12-26 v0.9.45 - Canvas Interactivity & cleanup

**Goal**: Enable full interactivity (Hover, Click, Focus) in Canvas mode and remove the deprecated "View Mode" (Clusters) feature.

- [x] **Canvas Interactivity**
  - [x] **Hit Testing**: Implemented `findNodeAt(x, y)` to detect nodes under the mouse cursor in Canvas mode, accounting for zoom/pan transforms.
  - [x] **Event Listeners**: Added `mousemove` (highlighting) and `click` (inspection/focus) handlers to the canvas element.
  - [x] **Consistency**: Canvas interaction now matches SVG behavior (Single click -> Stats, Double click -> Focus).

- [x] **Visual Fixes**
  - [x] **Node Sizing**: Updated `renderCanvas` to respect the "Size By" setting (Degree/Centrality/Uniform), fixing the issue where nodes were rendered too large.

- [x] **Cleanup**
  - [x] **View Mode Removal**: Removed "View Mode" (Nodes/Clusters) controls and associated logic from the codebase as it was deprecated.

---

# 2025-12-26 v0.9.44 - Independent Focus Mode Spacing

**Goal**: Allow users to configure "Layer-Space" and "Node-Space" independently for "Horizontal" and "Vertical" layouts in Focus Mode, preventing settings from one layout affecting the other.

- [x] **Spacing Logic**
  - [x] **State Management**: Created `focusSpacingSettings` to store separate `layer` and `node` values for `horizontal` and `vertical` modes.
  - [x] **Defaults**:
    - **Horizontal**: Layer-Space defaulted to **125** (was 250).
    - **Vertical**: Node-Space defaulted to **20** (was 80).
  - [x] **UI Sync**: Switching the Focus Layout dropdown now automatically updates the sliders to reflect the stored values for that specific mode.
  - [x] **Persistence**: Adjusting sliders updates the setting for the _current_ mode only.

---

# 2025-12-26 v0.9.43 - Context-Aware Settings UI

**Goal**: Improve user clarity by dynamically updating the labels in the Settings Modal to reflect the currently active layout mode.

- [x] **UI Enhancement**
  - [x] **Label Switching**: The label for the repulsion slider now updates to "Repulsion (Force)" or "Repulsion (DAG)" based on the active layout when the settings modal is opened.
  - [x] **Localization**: Supports dynamic label switching for both English and Chinese locales.

---

# 2025-12-26 v0.9.42 - Distinct Repulsion Settings

**Goal**: Allow users to configure distinct "Repulsion Strength" values for "Force" and "DAG" layout modes, with layout-specific defaults.

- [x] **Settings Logic**
  - [x] **Data Structure**: Updated `defaultSettings` in `settings.js` to store separate keys: `repulsionForce` (Default: -550) and `repulsionDAG` (Default: -850).
  - [x] **Context-Aware UI**: The "Visualization Settings" modal now automatically displays and updates the repulsion value corresponding to the currently active layout mode.
  - [x] **Dynamic Application**: Switching layouts (`updateLayout`) or changing settings (`settingsManager.subscribe`) dynamically applies the correct force strength.

---

# 2025-12-26 v0.9.41 - Settings Modal Simulation Freeze

**Goal**: Automatically freeze the simulation when the "Visualization Settings" modal is opened to conserve memory/CPU and prevent background activity during configuration.

- [x] **Modal State Logic**
  - [x] **Auto-Freeze**: Opening the Settings Modal (`initSettingsUI`) now triggers `simulation.stop()` and sets an internal `isSettingsModalOpen` flag.
  - [x] **Conditional Resume**: Closing the modal resumes the simulation _only_ if the global "Freeze Layout" checkbox is not checked.
  - [x] **Update Suppression**: Updates triggered by `settingsManager` while the modal is open (e.g. slider drags) apply values but do _not_ restart the simulation loop.

---

# 2025-12-26 v0.9.40 - Freeze Layout Priority Fix (Settings Modal)

**Goal**: Ensure that changing Physics or Visual settings in the "Visualization Settings" modal does not restart the simulation if "Freeze Layout" is currently enabled.

- [x] **Settings Application Logic**
  - [x] **Conditional Restart**: Modified `settingsManager.subscribe` callback in `app.js` to check the "Freeze Layout" checkbox state.
  - [x] **Behavior**:
    - **Frozen**: Forces (charge, distance, collision) are updated in the background, but `simulation.restart()` is skipped. Visual changes (opacity) apply immediately.
    - **Unfrozen**: Forces are updated and simulation restarts (alpha 0.3).

---

# 2025-12-26 v0.9.39 - Layout Switch Relaxation & Freeze Logic

**Goal**: Apply the "Rapid Relaxation" strategy (0.2 damping -> 0.95 damping) when switching layouts, ensuring consistent behavior with initial load. Additionally, ensure "Freeze Layout" is respected after the relaxation period.

- [x] **Layout Transition Logic**
  - [x] **Relaxation**: Switching to a new layout (Force/DAG) resets `velocityDecay` to **0.2** for 2 seconds to allow nodes to find their new positions quickly.
  - [x] **Stabilization**: Automatically transitions to **0.95** damping after 2 seconds.
  - [x] **Delayed Freeze**: If "Freeze Layout" is enabled during the switch, the simulation runs for the 2-second relaxation phase and then automatically **stops**, freezing the new layout in its stabilized state.

---

# 2025-12-26 v0.9.38 - Quick Start Guide HTML Rendering Fix

**Goal**: Fix the issue where HTML tags (like `<br>` and `<strong>`) in the localized Quick Start Guide content were being displayed as raw text instead of being rendered.

- [x] **Rendering Logic**
  - [x] **HTML Support**: Updated `window.updateLanguage` in `app.js` to use `.innerHTML` instead of `.innerText` when injecting translated content. This ensures rich text elements in the guide are displayed correctly.

---

# 2025-12-26 v0.9.37 - Rapid Relaxation Strategy

**Goal**: Implement a two-stage damping process to allow the graph to "unfold" quickly upon load before stabilizing.

- [x] **Damping Logic**
  - [x] **Initial Phase**: Set `velocityDecay` to **0.2** for the first 2 seconds. This low friction allows nodes to rapidly move away from the center and untangle.
  - [x] **Stable Phase**: Automatically transition to **0.95** (high friction) after 2 seconds to stabilize the layout (Updated from 0.92).
  - [x] **Interaction Safety**: Ensures the auto-transition does not override manual slider adjustments made during the initial phase.

---

# 2025-12-26 v0.9.36 - Freeze Layout Priority Fix (Visual Settings)

**Goal**: Ensure that changing visual settings (Degree Basis, Size By) does not trigger a simulation restart if "Freeze Layout" is enabled, respecting the user's command to keep nodes stationary.

- [x] **Visual Update Logic**
  - [x] **Conditional Restart**: Modified `updateSize()` in `app.js` to check the "Freeze Layout" checkbox state.
  - [x] **Behavior**: If frozen, visual attributes (radius, font size) update immediately, but `simulation.restart()` is skipped. The collision force is updated in the background, ready for when the user unfreezes.

---

# 2025-12-26 v0.9.35 - Viewport Culling Relaxation

**Goal**: Relax the viewport culling restrictions to provide a smoother user experience, preventing premature freezing of nodes just outside the viewport and allowing for deeper zooms before global freeze.

- [x] **Culling Optimization**
  - [x] **Full Freeze Threshold**: Lowered from `scale < 0.4` to `scale < 0.1` to allow simulation at broader zoom levels.
  - [x] **Dynamic Buffer**: Increased off-screen buffer from fixed `100` units to `800 / scale` (approx 800 visual pixels), ensuring "fixed range extending outward" behavior.

---

# 2025-12-26 v0.9.34 - Global Layout Update Fix

**Goal**: Ensure that layout switching applies to all nodes in the graph, overriding any optimization constraints (like viewport culling) that might have frozen off-screen nodes.

- [x] **Layout Transition Logic**
  - [x] **Global Unfreeze**: In `updateLayout()`, explicitly clear `fx` and `fy` properties for all nodes when initiating a new simulation.
  - [x] **Culling Reset**: Reset the `isCulled` flag to ensure off-screen nodes are included in the new layout calculation and rendering.
  - [x] **Result**: Switching from 'Force' to 'DAG' (or vice versa) correctly rearranges the entire graph, even if the user is zoomed in and many nodes were previously frozen.

---

# 2025-12-26 v0.9.33 - Layout State Caching (Instant Switch)

**Goal**: Implement state caching to allow switching between layouts ("Force" vs "DAG") without recalculating positions or animating the transition, fulfilling the "template state" requirement.

- [x] **State Management**
  - [x] **Cache**: Create `layoutCache` to store `x, y, fx, fy` for each mode.
  - [x] **Save/Restore**: Implement logic to save current positions before switching and restore target positions after switching.
- [x] **Transition Logic**
  - [x] **Instant Switch**: If a layout state is cached, restore positions and skip the simulation warm-up (`alpha(1)`), effectively teleporting nodes to their previous state.
  - [x] **First Run**: If no cache exists, perform standard simulation.

---

# 2025-12-26 v0.9.32 - High Damping & Render Optimization

**Goal**: Further reduce memory/CPU consumption by increasing simulation friction and skipping DOM updates for frozen off-screen nodes.

- [x] **Damping Adjustment**
  - [x] **Default**: Increased `velocityDecay` to **0.92**.
  - [x] **Effect**: Graph settles much faster; movement is "heavier" and less jittery.

- [x] **Render Culling (DOM)**
  - [x] **Logic**: In `ticked()`, filter the D3 selection to only update nodes that are NOT flagged as `isCulled`.
  - [x] **Mechanism**: `checkSimulationState` sets `isCulled = true` for off-screen nodes.
  - [x] **Benefit**: Avoids thousands of expensive DOM attribute updates per frame for nodes the user cannot see.

---

# 2025-12-26 v0.9.31 - Simulation Optimization (Viewport Culling)

**Goal**: Reduce memory and CPU consumption by minimizing particle movement calculations based on zoom level and viewport visibility.

- [x] **Viewport Culling Logic**
  - [x] **Full View Freeze**: If the user zooms out enough to see the entire graph (or a large portion), automatically stop the simulation to save resources, assuming the layout is stable.
  - [x] **Off-screen Freezing**: When zoomed in, only simulate nodes within the visible viewport. Freeze nodes outside the viewport.
  - [x] **Implementation**:
    - [x] Add `checkSimulationState()` triggered by zoom events.
    - [x] Calculate visible bounds based on `event.transform`.
    - [x] Update `simulation.nodes()` to only include visible nodes (plus a buffer) or use `fx`/`fy` to lock off-screen nodes.

---

# 2025-12-26 v0.9.30 - Focus Mode Layout Isolation

**Goal**: Ensure that layout changes occurring within Focus Mode (automatic arrangement or manual dragging) do not affect the node positions in the main interface upon exiting.

- [x] **Position Backup & Restoration**
  - [x] **Backup**: In `enterFocusMode`, save the current `x`, `y`, `fx`, and `fy` coordinates of all nodes.
  - [x] **Restoration**: In `exitFocusMode`, restore these coordinates to their pre-focus state.
  - [x] **Consistency**: Ensure the graph visual state reverts exactly to how it was before entering Focus Mode.

---

# 2025-12-26 v0.9.29 - Freeze Layout Persistence

**Goal**: Fix bug where "Analysis & Export" (and other layout resizes) would override the "Freeze Layout" state, causing unwanted node movement.

- [x] **Layout Resize Logic**
  - [x] **Behavior**: Modified `ResizeObserver` in `app.js` to strictly check the "Freeze Layout" checkbox state before calling `simulation.restart()`.
  - [x] **Canvas Sync**: Ensured `resizeCanvas()` is called during layout changes to keep the canvas resolution correct even if the simulation is frozen.
  - [x] **Result**: Opening the Analysis Panel or resizing the window now respects the frozen state, keeping nodes stationary.

---

# 2025-12-26 v0.9.28 - Focus Mode Specific Content Access

**Goal**: Optimize user experience by providing a direct way to open specific node content within Focus Mode, avoiding the need for double-clicking.

- [x] **Specific Content Button**
  - [x] **UI**: Added a "Specific Content" button (`#btn-open-content`) to the Focus Mode control panel (`#focus-exit-btn`).
  - [x] **Logic**: Clicking the button triggers `window.reader.open(focusNode)`, mimicking the double-click behavior on a focused node.
  - [x] **Localization**: Added support for English ("Open Specific Content") and Chinese ("打开具体内容").

- [x] **Documentation**
  - [x] **User Manual**: Updated Focus Mode section.
  - [x] **Interface Document**: Updated Focus Mode capabilities.
  - [x] **TEST_REPORT**: Added test case for the new button.

---

# 2025-12-26 v0.9.27 - Conditional Restart

**Goal**: Ensure "Freeze Layout" state is respected when exiting Focus Mode.

- [x] **Conflict Resolution**
  - [x] **Logic**: In `exitFocusMode`, check if "Freeze Layout" is checked.
  - [x] **Behavior**: If checked, call `simulation.stop()` instead of `restart()`, preventing unwanted movement.
  - [x] **Visual**: Manually trigger `ticked()` to ensure the graph renders the restored nodes in their current positions.

# 2025-12-26 v0.9.26 - UX Enhancements

**Goal**: Improve mobile usability and onboard new users effectively.

- [x] **Freeze Layout Button**
  - [x] **UI**: Add a dedicated "Freeze Layout" button to the main interface (top-right or near controls) for quick access, especially on mobile.
  - [x] **Logic**: Link button to the existing simulation freeze functionality. Sync state with the checkbox in controls.
  - [x] **Visual**: Use an icon (e.g., Lock/Unlock) to indicate state.

- [x] **Quick Start Manual**
  - [x] **Content**: Create a concise "How to Use" guide covering:
    - Loading Data
    - Navigation (Pan/Zoom)
    - Focus Mode (Double Click)
    - Inspection (Click/Hover)
    - Analysis Panel
  - [x] **UI**: Implement as a Modal that opens on first load (localStorage check) or via a "Help" button.
  - [x] **Localization**: Support English and Chinese.

- [x] **Documentation**
  - [x] **Interface Document**: Update with new UI elements.
  - [x] **README**: Add changelog.
  - [x] **Test Report**: Verify new features.

---

# 2025-12-25 v0.9.25 - Freeze Layout Optimization

**Goal**: Minimize resource usage by strictly freezing the main graph when requested, preventing user interactions that would wake the simulation.

- [x] **Freeze Layout Enhancement**
  - [x] **Behavior**: Checking "Freeze Layout" now disables node dragging in the main interface (SVG Mode).
  - [x] **Constraint**: This restriction does _not_ apply to Focus Mode, where manual adjustment is still permitted.
  - [x] **Performance**: Prevents `simulation.restart()` triggers from drag events, ensuring the simulation stays effectively stopped (0% CPU usage).

- [x] **Documentation**
  - [x] **Interface Document**: Updated Simulation Controls section.
  - [x] **README**: Added changelog entry.
  - [x] **Test Report**: Verified behavior.

---

# 2025-12-25 v0.9.24 - Focus Mode Memory Optimization

**Goal**: Reduce memory/CPU expenditure in SVG mode by freezing background nodes during Focus Mode.

- [x] **Simulation Optimization**
  - [x] **Subsetting**: Modified `enterFocusMode` to filter `simulation.nodes()` and `simulation.force("link").links()` to only include the focused subset.
  - [x] **Freezing**: Background nodes are effectively frozen as they are no longer processed by D3 forces.
  - [x] **Restoration**: Modified `exitFocusMode` to restore the full set of nodes and links to the simulation.

- [x] **Documentation**
  - [x] **Interface Document**: Updated with optimization details.
  - [x] **README**: Added changelog entry.
  - [x] **Test Report**: Verified optimization behavior.

---

# 2025-12-25 v0.9.23 - Default Settings Adjustment

**Goal**: Adjust default settings for Reading Window font size and Simulation Damping based on user feedback.

- [x] **Reading Window Font Size**
  - [x] **Implementation**: Modified `Reader` class in `reader.js` to set `currentZoom` to 0.5 by default.
  - [x] **Logic**: Affects initialization and reset on open.

- [x] **Simulation Damping**
  - [x] **Implementation**: Updated `app.js` to initialize `d3.forceSimulation` with `.velocityDecay(0.6)`.
  - [x] **UI**: Updated `index.html` slider default value and display text to 0.6.

---

# 2025-12-25 v0.9.22 - Mobile Popup Adaptation

**Goal**: Adapt the node statistics popup for mobile devices with touch-based drag and pinch-to-zoom capabilities.

- [x] **Touch Drag Support**
  - [x] **Implementation**: Added `touchstart`, `touchmove`, `touchend` listeners to `popupDragHandle`.
  - [x] **Logic**: Mirrors mouse drag logic using `touches[0]` coordinates.
  - [x] **Constraint**: Requires single-finger touch on the header.

- [x] **Pinch-to-Zoom Support**
  - [x] **Implementation**: Added `touchstart`, `touchmove`, `touchend` listeners to `statsPopup`.
  - [x] **Logic**: Calculates distance between two fingers (`Math.hypot`) to determine scale ratio.
  - [x] **Scaling**: Updates `popupDragState.currentScale` and applies to `fontSize`.
  - [x] **Clamping**: Restricted scale between 0.5x and 2.0x.

- [x] **Documentation**
  - [x] **Interface Document**: Updated with mobile interaction specs.
  - [x] **README**: Added changelog entry.
  - [x] **Test Report**: Verified mobile interactions.

---

# 2025-12-25 v0.9.21 - Strict Edge Visibility & Optimization

**Goal**: Enforce strict edge visibility rules (hidden by default) and optimize rendering for large graphs.

- [x] **Strict Edge Visibility**
  - [x] **SVG Mode**: Modified `updateVisibility` in `app.js` to set default edge opacity to 0 (was 0.15).
  - [x] **Consistency**: Ensured SVG behavior matches Canvas mode (hidden by default).
  - [x] **Performance**: Reduced visual clutter and rendering cost for initial view.

- [x] **Documentation**
  - [x] **Interface Document**: Updated to reflect strict edge visibility in v0.9.21.
  - [x] **README**: Added v0.9.21 changelog.
  - [x] **Test Report**: Verified behavior for v0.9.21.

---

# 2025-12-24 v0.9.20 - Selection State Auto-Clear on Focus Entry

**Goal**: Automatically clear any existing selection or highlight state when entering Focus Mode via double-click for a clean transition.

- [x] **Auto-Clear Implementation**
  - [x] **Highlight Clearing**: Modified `handleDoubleClick()` to call `highlightManager.unhighlight({ force: true })` before entering focus mode.
  - [x] **Popup Hiding**: Automatically hide the statistics popup (`#node-stats-popup`) when entering focus mode.
  - [x] **State Management**: Ensures clean state transition without residual visual artifacts.

- [x] **User Experience Enhancement**
  - [x] **Clean Transition**: Users always start with a pristine focused context.
  - [x] **Visual Clarity**: Prevents confusion from overlapping highlights between normal and focus modes.
  - [x] **Consistent Behavior**: Standardized focus mode entry behavior across all scenarios.

- [x] **Documentation**
  - [x] **Interface Document**: Updated with v0.9.20 selection auto-clear specifications.
  - [x] **README**: Added v0.9.20 changelog entries in both English and Chinese.
  - [x] **Code Comments**: Bilingual comments explaining the auto-clear logic.
  - [x] **TODO**: Documented completed feature implementation.

---

# 2025-12-24 v0.9.19 - Focus Mode & Popup Enhancements

**Goal**: Fix focus mode refresh issues and add drag/zoom functionality to the statistics popup for better user experience.

- [x] **Focus Mode Re-entry Fix**
  - [x] **Double-Click Behavior**: Modified `handleDoubleClick()` to allow re-entering focus mode on related nodes while already in focus mode.
  - [x] **State Reset**: Ensured all node visibility flags (`isFocusVisible`, `fx`, `fy`, `_labelDy`) are properly reset before entering new focus context.
  - [x] **Prevention**: Removed the restriction that blocked switching focus between related nodes in `enterFocusMode()`.

- [x] **Statistics Popup Enhancements**
  - [x] **Drag Functionality**: Implemented mouse-based dragging by clicking and dragging the popup header.
    - [x] **State Tracking**: Created `popupDragState` to track drag position and scale.
    - [x] **Event Handlers**: Added `mousedown`, `mousemove`, and `mouseup` listeners for drag control.
    - [x] **Visual Feedback**: Added `.dragging` class for cursor feedback during drag.
  - [x] **Zoom Controls**: Added three zoom buttons (+, −, ⟲) to scale popup content.
    - [x] **Scale Range**: 0.5x to 2.0x with 0.1 increments.
    - [x] **Implementation**: Applied scaling via `fontSize` CSS property on `.popup-content`.
    - [x] **Reset Function**: Reset button restores default size and scale.
  - [x] **Resizable**: Enabled CSS `resize: both` for browser-native resize functionality.
    - [x] **Constraints**: Set min/max width and height constraints.
    - [x] **Scrolling**: Ensured content scrolls properly when resized.
  - [x] **Position Reset**: On close, popup position resets to default (top-right).
- [x] **Documentation**
  - [x] **Interface Document**: Updated with v0.9.19 drag/zoom interface specifications.
  - [x] **README**: Added v0.9.19 changelog entries in both English and Chinese.
  - [x] **Bilingual Comments**: Code comments in both languages for all new functionality.
  - [x] **CSS**: Documented new styles for draggable, zoomable, and resizable popup.

---

# 2025-12-24 v0.9.18 - Node Highlighting System Refactor

**Goal**: Reconstruct node highlighting logic with modular architecture for better maintainability and robustness.

- [x] **Modular Architecture**
  - [x] **NodeHighlightManager Class**: Created dedicated module (`nodeHighlight.js`) with complete state management.
  - [x] **API Design**: Implemented clean public API with `highlight()`, `unhighlight()`, `getState()`, and helper methods.
  - [x] **Integration**: Fully integrated into app.js replacing old highlighting functions.

- [x] **Unified Interaction Model**
  - [x] **PC Support**: Hover-based highlighting without freezing simulation.
  - [x] **Mobile Support**: Click-based highlighting with simulation freeze for stable inspection.
  - [x] **State Consistency**: Proper tracking of frozen vs temporary highlight states.

- [x] **Rendering Enhancements**
  - [x] **SVG Mode**: Directional edge coloring (Blue=#4488ff outgoing, Red=#ff6b6b incoming) with matching arrow markers.
  - [x] **Canvas Mode**: Updated to use highlightManager state for consistent visual behavior.
  - [x] **Dimming Effect**: Unconnected nodes dim to 0.05 opacity during highlight for clearer focus.

- [x] **Focus Mode Integration**
  - [x] **State Awareness**: highlightManager respects focus mode and doesn't interfere.
  - [x] **Coordination**: Focus mode entry/exit properly updates highlightManager state.

- [x] **Documentation**
  - [x] **Bilingual Comments**: Comprehensive Chinese/English comments throughout code.
  - [x] **Interface Document**: Updated with complete NodeHighlightManager API reference.
  - [x] **README**: Added v0.9.18 changelog entry in both languages.
  - [x] **Integration Guide**: Created detailed integration instructions.

---

### 2025-12-17 v0.1.0 - Foundation & Data Structures

**Goal**: Establish the standalone project environment and core data structures for a Directed Graph, independent of specific note-taking app APIs initially.

- [x] **Project Initialization**
  - [x] Initialize a new TypeScript/Node.js project in `NoteConnection`.
  - [x] Configure ESLint, Prettier, and Jest for testing.

- [x] **Graph Core Implementation**
  - [x] Implement `Node` and `Edge` interfaces supporting metadata (e.g., `rank`, `clusterId`).
  - [x] Implement a `Graph` class with methods: `addNode`, `addEdge`, `getNeighbors`, `getIncomingEdges`, `getOutgoingEdges`.

### 2026-01-15 v0.2.0 - Data Ingestion & Directional Parsing

**Goal**: Ingest data from Markdown files, specifically parsing frontmatter for directional dependencies.

- [x] **Markdown Parser Service**
  - [x] Implement a file system reader to scan directories recursively.
  - [x] Create a regex or AST-based parser to extract YAML frontmatter.

- [x] **Dependency Extraction**
  - [x] Define the schema: `prerequisites: [[Note A]]`, `next: [[Note B]]`.
  - [x] Logic to convert these metadata fields into directed edges in the `Graph` object.

### 2026-02-01 v0.3.0 - Algorithmic Core (DAG Logic)

**Goal**: Ensure the graph is a valid DAG and calculate hierarchical layout positions.

- [x] **Cycle Detection & Resolution**
  - [x] Implement DFS-based cycle detection.
  - [x] Strategy: Report cycles to the user (Console Warning).

- [x] **Topological Sorting & Ranking**
  - [x] Implement algorithms to assign a `rank` (0, 1, 2...) to every node.
  - [x] Ensure nodes with no dependencies are Rank 0.
  - [x] Integrated Kahn's Algorithm variant for Longest Path layering.

### 2026-03-01 v0.4.0 - Visualization Engine

**Goal**: Render the processed graph in a web view using a layered layout engine (Sugiyama-style).

- [x] **Layout Engine Integration**
  - [x] Implement "Layout Mode" switch in UI (Force vs DAG).
  - [x] Map `rank` to Y-coordinates in the visualization.

- [x] **Canvas/SVG Rendering**
  - [x] Optimize rendering for hierarchical structures.
  - [x] Draw curved bezier lines for dependencies to indicate flow direction clearly.

- [x] **Focus Mode (v0.6.2)**
  - [x] **Interactive Focus**: Click node to center and isolate context.
  - [x] **Hierarchical Layout**: Auto-arrange Superiors (Out-degree) and Subordinates (In-degree) in layers.
  - [x] **Intra-layer Sorting**: Sort neighbors by importance (Degree Ratio).
  - [x] **Context Filtering**: Show only direct neighbors and high-correlation nodes.
  - [x] **Layout Optimization**:
    - [x] Relative Height Positioning based on criteria (Score).
    - [x] Staggered Label Placement to prevent overlap.
    - [x] Fix: Prevents node accumulation when switching context within Focus Mode.

### 2026-04-01 v0.5.0 - Scalability (Clustering)

**Goal**: Handle 10,000+ nodes by grouping them into high-level clusters based on File Structure or Semantic Tags.

- [x] **Clustering Logic**
  - [x] Implement **Folder-based Clustering**: Parse directory structure (e.g., `Physics/Mechanics` -> Cluster `Mechanics`).
  - [x] Add Configuration Strategy: Switch between `Label Propagation` (current) and `Folder Path` for `clusterId` assignment.

- [x] **Semantic Zoom / Drill-down**
  - [x] Render "Super Nodes" (Clusters) at low zoom levels (Implemented as "Cluster View" toggle).
  - [x] Expand to show detailed dependency graphs when a cluster is clicked (Drill-down via Filter).

### 2026-05-01 v0.6.0 - Hybrid Inference Strategy (AI & Stats)

**Goal**: Combine statistical and vectorized methods to infer dependencies and associations where explicit metadata is missing.

- [x] **Vector-based Association (Similarity)**
  - [x] Implement embedding generation (using local TF-IDF VectorSpace).
  - [x] Use Cosine Similarity to determine the strength of **association** (undirected relationship) between concepts.

- [x] **Statistical Dependency Inference**
  - [x] Calculate **Co-occurrence Frequency** and **Conditional Probability** ($P(B|A)$) across the note corpus.
  - [x] Hypothesis: If A frequently appears before B or in the context of defining B, A might be a dependency.

- [x] **Hybrid Judgment Engine (v0.6.5)**
  - [x] Combine Vector Similarity (for relevance) + Statistical Probability (for direction).
  - [x] Rule: If `Similarity(A, B) > Threshold` AND `P(B|A) >> P(A|B)`, suggest edge `A -> B`.

- [ ] **AI Inference Service (LLM Verification)**
  - Use LLMs to verify high-confidence candidates from the hybrid engine.
  - Task: "Given statistical evidence, confirm if A is a prerequisite for B."

### 2025-12-22 v0.8.5 - Dynamic Data Source & Server

**Goal**: Support dynamic selection of knowledge base folders and independent server deployment.

- [x] **Dynamic Path Selection**
  - [x] Backend: Support variable input paths under `Knowledge_Base`.
  - [x] Server: Implement `http` server for API (`/api/folders`, `/api/build`) and static serving.
  - [x] Frontend: Add UI to list and select knowledge base folders.

# 2025-12-24 v0.9.17 - SVG Visual Completeness

**Goal**: Complete the visual feedback loop for SVG mode interactions.

- [x] **SVG Renderer**
  - [x] **Colored Markers**: Implemented dynamic marker switching (Red/Blue arrows) to match the edge color during highlight.
  - [x] **Visual Consistency**: Ensured arrows revert to gray when highlighting is cleared.

# 2025-12-24 v0.9.16 - Interaction Completeness

**Goal**: Ensure complete visualization of node relationships during inspection.

- [x] **Interaction Logic**
  - [x] **Always-On Context**: Clicking a node now forces the display of _all_ In-degree and Out-degree relationships, overriding any active "Incoming Only" or "Outgoing Only" filters to ensure complete context is visible.
- [x] **Canvas Renderer**
  - [x] **Visual Parity**: Implemented bold line rendering (2.5px width) for highlighted edges in the Canvas engine to match SVG styling.

### 2025-12-23 v0.8.6 - Performance Optimization (Parallel Processing)

**Goal**: Optimize graph construction for large datasets (>10,000 nodes) to reduce build time.

- [x] **Parallel Graph Building**
  - [x] **Worker Threads**: Offload intensive keyword matching to multiple CPU cores.
  - [x] **Async I/O**: Refactor `FileLoader` to use asynchronous batch processing to prevent `EMFILE` errors.
  - [x] **Robustness**: Implement fallback to sequential processing if workers fail.

### 2025-12-23 v0.8.7 - Scalability & UX Polish

**Goal**: Address rendering bottlenecks and improve layout control for large graphs.

- [x] **High-Capacity Processing**
  - [x] **Worker Scaling**: Increased thread limit to 12.
- [x] **Canvas Rendering**
  - [x] **Dual Engine**: implemented Canvas renderer for high-performance drawing of 10k+ nodes.
- [x] **Focus Mode UX**
  - [x] **Spacing Control**: Added UI slider to adjust node layer spacing.

### 2025-12-23 v0.8.8 - Scalability Defaults & Advanced Layout

**Goal**: Optimize default view for massive graphs and refine Focus Mode layout.

- [x] **Scalability Defaults**
  - [x] **Clutter Reduction**: Edges hidden by default; Orphans hidden by default.
  - [x] **On-Demand Context**: Relationships revealed on Hover or Focus.
- [x] **Focus Mode Enhancements**
  - [x] **Horizontal Spacing**: Added control for horizontal node separation to prevent overlap.

### 2025-12-23 v0.8.9 - Stability Improvements

**Goal**: Enhance observation stability.

- [x] **Interaction Stability**
  - [x] **Freeze**: Prevent node drift when selecting or dragging in Focus Mode.

### 2025-12-23 v0.9.0 - Precise Control & Stability

**Goal**: Provide tools for manual layout control and stable inspection.

- [x] **Hover Logic**
  - [x] **Auto-Freeze**: Lock node position on hover to facilitate inspection.
- [x] **Simulation UX**
  - [x] **Controls**: Add Speed slider and Freeze Layout toggle.
  - [x] **Manual Placement**: Allow manual node positioning when layout is frozen without auto-revert.

### 2025-12-23 v0.9.1 - Mobile Transformation

**Goal**: Transform the current web project into an Android APK application.

- [x] **Capacitor Integration**
  - [x] **Initialization**: Configured `capacitor.config.ts`.
  - [x] **Platform Support**: Added Android platform via `@capacitor/android`.
  - [x] **Asset Management**: Implemented `copy-assets` script and `npx cap sync`.
  - [x] **Build Pipeline**: Verified Gradle build configuration (`assembleDebug`).

### 2025-12-23 v0.9.2 - Mobile UI Optimization

**Goal**: Optimize UI/UX for small touch screens.

- [x] **Responsive Controls**
  - [x] **Collapsible Menu**: Main controls collapse to a button on mobile to save screen space.
  - [x] **Focus Mode UI**: Relocated "Exit Focus" button to bottom-center for accessibility.
  - [x] **Settings Consolidation**: Moved Language Selector into Settings Modal to declutter the interface.
- [x] **Touch Interactions**
  - [x] **Pinch-to-Zoom**: Added multi-touch support in Reading Window for text scaling.
  - [x] **Touch Targets**: Enlarged buttons and inputs for touch accuracy.

### 2025-12-23 v0.9.3 - Mobile Interaction Iteration

**Goal**: Refine interaction logic for mobile usability.

- [x] **Interaction Logic Update**
  - [x] **Single Click**: Triggers node highlight and tooltip (In/Out Degree display).
  - [x] **Double Click**: Triggers Focus Mode entry.
  - [x] **Desktop Compatibility**: Preserved `mouseover` for desktop hover while unifying click logic.

### 2025-12-23 v0.9.4 - Mermaid Image Optimization

**Goal**: Enhance reading experience for diagrams on mobile devices.

- [x] **Mermaid Zoom Mode**
  - [x] **Interaction**: Clicking a Mermaid diagram opens a full-screen overlay.
  - [x] **Gestures**: Implemented Pan (drag) and Zoom (pinch/wheel) logic within the overlay.
  - [x] **UX**: Added a prominent Exit button to close the zoom mode.

### 2025-12-24 v0.9.5 - Refined Mobile Experience & Focus Semantics

**Goal**: Polish interaction details and visual clarity for mobile and complex graphs.

- [x] **Focus Mode Enhancements**
  - [x] **Centering**: Viewport automatically centers on the focused node's original position.
  - [x] **Semantics**: Added clear area labels ("Helping to understand", "Further exploration").
  - [x] **Layout**: Implemented "Hierarchical (Left-Right)" layout option.
- [x] **Analysis Panel**
  - [x] **Mobile**: Panel is now scrollable and adapted for touch screens.
  - [x] **Interaction**: Clicking rows highlights the node and its connections in the graph.
- [x] **Visual Polish**
  - [x] **Mermaid**: Enhanced text visibility (shadow/outline) for light-colored diagrams.
  - [x] **Lines**: Ensured edges are hidden by default and only visible on interaction.

### 2025-12-24 v0.9.6 - Analysis & Visuals Polish

**Goal**: Further refine Analysis Panel mobile usability and fix visual inconsistencies.

- [x] **Mermaid Zoom Styling**
  - [x] **Fix**: Ensured Mermaid text shadow/grayscale persists in Full-screen Zoom mode.
- [x] **Degree Analysis Mobile**
  - [x] **Full Screen**: Added toggle to switch panel between half-height and full-screen.
  - [x] **Zoom**: Implemented pinch-to-zoom for the panel content.
  - [x] **Interaction**: Verified click-to-highlight logic works across views.
- [x] **Graph Interaction**
  - [x] **Robustness**: Added background click handler to clear highlights.

### 2025-12-24 v0.9.7 - Focus Mode Interaction Fix

**Goal**: Fix usability bugs in Focus Mode.

- [x] **Layout Switching**
  - [x] **Fix**: Switching between "Horizontal" and "Vertical" layouts now immediately refreshes the graph without requiring slider adjustment.

### 2025-12-24 v0.9.8 - Analysis Interaction Refinement

**Goal**: Ensure seamless interaction between Analysis Panel and Graph.

- [x] **Graph Sync**
  - [x] **Tooltip**: Clicking a node in the Analysis Panel now displays the tooltip (stats) on the graph at the node's position.
- [x] **Mobile UX**
  - [x] **Scrolling**: Fixed scroll behavior in Analysis Panel to prevent conflicts.

### 2025-12-24 v0.9.9 - Mobile Analysis Panel Polish

**Goal**: Enhance "Degree Analysis" page for mobile usability with gesture controls.

- [x] **Mobile Adaptation**
  - [x] **Slide Gesture**: Implemented "slide up and down" via touch drag on panel header.
  - [x] **Full Screen**: Supported toggling between floating window and full-screen page, with auto-snap on drag.
  - [x] **Zoom**: Verified two-finger pinch-to-zoom support for the interface.
- [x] **Interaction Verification**
  - [x] **Node Click**: Verified that clicking a node in the panel displays in-degree and out-degree relationships on the graph.

### 2025-12-24 v0.9.10 - Interaction Refinement (Click-to-Freeze)

**Goal**: Improve graph inspection stability by freezing the simulation on node click.

- [x] **Click Interaction**
  - [x] **Freeze on Click**: Clicking a node now immediately stops the force simulation (freezes all nodes) to prevent movement during inspection.
  - [x] **Resume on Cancel**: Clicking the background (blank area) unhighlights the node and resumes the simulation (unless manually frozen).
  - [x] **Visualization**: Ensured in-degree and out-degree lines are displayed clearly when frozen.

### 2025-12-24 v0.9.11 - Node Statistics & Localization

**Goal**: Enhance detailed inspection of nodes and complete internationalization.

- [x] **Focus Mode Localization**
  - [x] **Multi-language**: Implemented `t()` calls for semantic labels ("Helping to understand" / "Further exploration").
- [x] **Node Statistics Panel**
  - [x] **Interaction**: Clicking a node opens a dedicated panel showing relationships.
  - [x] **Visuals**: In-degree lines are Red, Out-degree lines are Blue (#4488ff).
  - [x] **Content**: Panel lists all incoming and outgoing neighbors with navigation support.

### 2025-12-24 v0.9.12 - Independent Statistics Popup

**Goal**: Separate node inspection from global analysis for better UX.

- [x] **Floating Statistics Window**
  - [x] **Interaction**: Clicking a node opens a floating popup showing In/Out degrees.
  - [x] **Visuals**: Distinct Red (In) and Blue (Out) indicators.
  - [x] **Independence**: Does not interfere with the main Degree Analysis panel.

### 2025-12-24 v0.9.13 - Focus Mode Isolation

**Goal**: Ensure specific interaction effects do not bleed into Focus Mode.

- [x] **Interaction Refinement**
  - [x] **Constraint**: Verified that clicking a node while in Focus Mode does _not_ trigger the floating statistics popup or change the highlight style, preserving the specific Focus Mode context.

### 2025-12-24 v0.9.14 - Visual & Data Fixes

**Goal**: Fix visualization of edge directions and data duplication.

- [x] **Edge Highlighting**
  - [x] **Canvas Support**: Implemented Red (In) and Blue (Out) edge coloring in the Canvas renderer (`renderCanvas`), previously generic gray.
- [x] **Data Integrity**
  - [x] **Deduplication**: Used `Set` to prevent duplicate node entries in the Statistics Popup neighbor lists.

### 2025-12-24 v0.9.15 - Enhanced Isolation

**Goal**: Optimize visual focus by effectively hiding unrelated context during inspection.

- [x] **Visual Optimization**
  - [x] **Deep Dimming**: Reduced opacity of unrelated nodes from 0.1 to 0.05 to better satisfy the "temporarily hidden" requirement while maintaining minimal context.
  - [x] **Edge Emphasis**: Increased highlighted edge width to 2.5px for clearer Red/Blue distinction.

### 2026-06-01 v1.0.0 - Production Release

**Goal**: Complete integration with Joplin/Obsidian plugins and polish UX.

- [x] **Plugin Wrapper**
  - Wrap the `NoteConnection` core logic into a Joplin Plugin and an Obsidian Plugin. (API Ready in v0.9.53)

- [x] **User Settings & Documentation (v0.7.0)**
  - [x] **Settings Manager**: Centralized management of application state (Physics, Visuals) with `localStorage` persistence.
  - [x] **Configuration UI**: Settings Modal for tuning Graph Physics (Gravity, Repulsion) and Visual preferences.
  - [x] **Reading Window (v0.8.0)**
    - [x] **Trigger**: Click focused node to open.
    - [x] **Content**: Renders Markdown, KaTeX (Math), Mermaid (Diagrams).
    - [x] **Interaction**: Zoom text and Resize images (Unlocked mode).
    - [x] **Config**: Window/Fullscreen toggle.
  - [x] **Finalize Documentation**: Complete User Manual and Developer Guide.
  - [x] **Final Polish & Demo Packaging**: Ensure zero-config startup (`npm start`) works seamlessly for promotion.
  - [x] **Release**: Package for v1.0.0.

---
