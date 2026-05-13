# 2026-05-12 v1.7.0 - HEAD Realignment Implementation Plan

## English Document

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
  - `local_vector` external HTTP acceleration is no longer query-only scaffolding: the adapter now supports remote index sync, exposes sync telemetry in diagnostics, and preserves strict `fail_closed` plus representation-alignment semantics.
  - `src/query_backend.external_http.integration.test.ts` now proves a live `external_http` connector path end to end: ingest -> remote index sync -> query -> diagnostics.
  - runtime capability governance now treats ANN remote index sync as a first-class check: `query_vector_acceleration_index_sync_health` is emitted in the matrix/runbook alongside health, traceability, prefilter, and circuit checks.
  - `server.ts` now closes the runbook loop for that new gate: ANN index-sync health is included in verification escalation, remediation action-queue generation, and per-check history summaries.
  - the agent workspace runtime runbook surfaces now expose ANN sync-health metrics across verify/checks/action-queue flows, so the new gate is visible in the UI instead of staying backend-only.
  - modular knowledge-route wiring for `runtime-capability-runbook/*` is now backed by live server-side runbook ops instead of KLP placeholder payloads, and the route layer now preserves `checkId` / `sinceMinutes` / queue-filter query params rather than dropping them.
  - the real browser smoke gate now proves those verify/checks/action-queue surfaces end to end: strict browser evidence must show the ANN sync-health verify card, the first-check ANN sync metric, and the index-sync action-queue drilldown instead of only proving that the cards can open.
- This changes the execution focus:
  - P3 placeholder replacement is implementation-complete for the current runtime surfaces.
  - P4 default tutor-routing activation is implementation-complete for the local-first baseline.
  - the remaining A8 gap is now narrower: packaged/runtime proof plus heavier workload hardening.
  - P2 now has a real live-connector baseline for A9 instead of pure scaffolding.
  - the next phase after this work is still release-grade Phase-2 gate hardening, and the first concrete gate now has server-side runbook/action-queue/history closure through ANN index-sync health governance, while A8 packaged/runtime closure and A9 workload/threshold calibration continue in parallel.

### Code-vs-Plan Reality Matrix

| Area | Planned Expectation | Current HEAD Reality | Status |
|---|---|---|---|
| Phase-1 A8 graph backend | production-grade local graph backend | ops semantics exist, default runtime now targets embedded `graphdb/sqlite` with explicit file fallback, and restart durability is integration-proved; packaged/runtime proof and heavier-workload hardening are still open | Operational baseline |
| Phase-1 A9 ANN connector | production-grade ANN connector | `external_http` now supports remote index sync plus live end-to-end query proof under strict failure/representation semantics, but recall/latency calibration and larger-workload validation are still open | Operational baseline |
| Phase-2 quality gates | live mastery/divergence quality trend gates | query-backend comparison, staleness, learning-quality, and session-plan-quality runtime surfaces are now live in `KnowledgeLearningPlatform.ts`, and ANN runtime governance now also includes explicit index-sync health checks, but the full gate set still needs release-grade calibration on top of the current graph/ANN operational baseline | Operational baseline |
| Phase-3 tutor + memory | tutor and memory operating layer becomes real | tutor telemetry/trace/provider trends + conversation memory + memory-policy diagnostics are real, and default runtime now injects a local tutor adapter; production-proven multi-provider routing is still open | Operational baseline |
| Architecture compaction | major monoliths reduced to sustainable size | `server.ts` 14,992, `KnowledgeLearningPlatform.ts` 7,706, `path_app.js` 4,649, `app.js` 4,713, `routes/knowledge.ts` 690 | Open |

### Execution Order

1. P0: Truth correction and gate reclassification
   - keep progress docs aligned with actual code status,
   - stop treating placeholder-backed or catalog-only surfaces as closed.
2. P1: Real graph backend closure
   - validate the new embedded `graphdb/sqlite` default across packaged/runtime paths,
   - preserve fallback behavior,
   - keep expanding beyond the now-proved restart lifecycle into heavier durability/performance and adapter/fallback consistency verification.
3. P2: ANN workload and rollout closure on top of the new live connector baseline
   - keep the new sync-backed `external_http` connector healthy under real traffic,
   - benchmark recall/latency thresholds,
   - expand workload validation before calling the ANN layer production-closed.
4. P3: Next phase after this work - Phase-2 quality gate hardening
   - keep the new telemetry-backed query/staleness/learning-quality/session-plan-quality surfaces aligned with the same runtime truth,
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
