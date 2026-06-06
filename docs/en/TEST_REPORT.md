# 2026-03-22 v1.5.58 - NoteMD Integration & Tauri Feasibility Full Verification

> Status sync note (2026-05-10): unresolved-goal cross-doc baseline is tracked in [Open Goal Audit (2026-05-10)](../open_goal_audit_2026-05-10.md).

### Architecture / Phase Truth Snapshot (2026-05-13)

- [x] `node node_modules/jest/bin/jest.js src/agent_workspace.contract.parity.test.ts src/agent_workspace.frontend.test.ts src/agent_workspace.runtime.behavior.test.ts src/learning/KnowledgeLearningPlatform.test.ts --runInBand --no-cache`
  - PASS
- [x] `node node_modules/jest/bin/jest.js src/learning/store.test.ts src/learning/KnowledgeLearningPlatform.test.ts --runInBand --no-cache`
  - PASS
- [x] `node node_modules/jest/bin/jest.js src/knowledge.api.contract.test.ts src/agent_workspace.contract.parity.test.ts src/agent_workspace.frontend.test.ts src/agent_workspace.runtime.behavior.test.ts --runInBand --no-cache`
  - PASS
- [x] `node node_modules/jest/bin/jest.js src/notemd.server.integration.test.ts --runInBand --no-cache --testNamePattern="embedded sqlite graph runtime survives server restart and preserves query/store diagnostics"`
  - PASS
- [x] `node node_modules/jest/bin/jest.js src/query_backend.external_http.integration.test.ts --runInBand --no-cache`
  - PASS
- [x] `node node_modules/jest/bin/jest.js src/notemd.server.integration.test.ts src/learning/store.test.ts src/learning/KnowledgeLearningPlatform.test.ts src/knowledge.api.contract.test.ts src/agent_workspace.contract.parity.test.ts src/agent_workspace.frontend.test.ts src/agent_workspace.runtime.behavior.test.ts src/pkg.sidecar.contract.test.ts --runInBand --no-cache`
  - PASS
- [x] `node node_modules/jest/bin/jest.js src/notemd.server.integration.test.ts src/query_backend.external_http.integration.test.ts src/learning/queryBackend.test.ts src/learning/vectorAccelerationAdapter.test.ts src/learning/KnowledgeLearningPlatform.test.ts src/knowledge.api.contract.test.ts src/pkg.sidecar.contract.test.ts --runInBand --no-cache`
  - PASS
- [x] `npm run verify:agent-workspace:runtime`
  - PASS
- [x] `npm run verify:agent-workspace:browser`
  - PASS
- [x] `npm run docs:diataxis:check`
  - PASS
- [x] `npm run docs:site:build`
  - PASS (existing MkDocs nav/link warnings remain)
- [x] `npm run build:with-vite`
  - PASS
- [x] `npm run build:sidecar`
  - PASS (with automatic retry without `--no-bytecode` when `pkg` requires bytecode for the current dependency graph)

### Phase 2 Verification Refresh (2026-05-18)

- [x] `npm run verify:core-real-machine:clean`
  - PASS (`output/verification/core-real-machine/2026-05-18T08-31-26-579Z/`; automated summary `6/6`; transient tracked `src-tauri/bin/server-x86_64-pc-windows-msvc.exe` dirtiness auto-restored)
- [x] `node node_modules/jest/bin/jest.js src/agent_workspace.frontend.test.ts --runInBand --no-cache`
  - PASS
- [x] `node node_modules/jest/bin/jest.js src/learning/runtimeCapability.test.ts src/knowledge.api.contract.test.ts --runInBand --no-cache`
  - PASS
- [x] `npm run test:agent-workspace:contracts`
  - PASS
- [x] `npm run build:with-vite`
  - PASS
- [x] `npm run build:sidecar`
  - PASS
- [x] `npm run verify:foundation:ann-runtime`
  - PASS
- [x] `npm run verify:foundation:ann-runtime:matrix`
  - PASS
- [x] `npm run verify:foundation:sqlite-runtime`
  - PASS
- [x] `npm run verify:foundation:sqlite-runtime:matrix`
  - PASS
- [x] `npm run docs:diataxis:check`
  - PASS
- [x] `npm run docs:site:build`
  - PASS (existing MkDocs nav/link warnings remain)
- [x] `NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_STRICT=1 NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_UI_STRICT=1 NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_UI_DYNAMIC_STRICT=1 node scripts/verify-agent-workspace-browser.js`
  - PASS

### Foundation Release Gate Wiring Refresh (2026-06-06)

- [x] `npm run verify:foundation:sqlite-runtime:release`
  - PASS (`heavy` soak profile, 5 restart cycles, `dist` runtime + packaged sidecar, structured report under `output/verification/foundation-sqlite-runtime/`)
- [x] `npm test -- src/foundation.sqlite.runtime.contract.test.ts --runInBand`
  - PASS
- [x] `npm test -- src/learning/KnowledgeLearningPlatform.test.ts --runInBand --testNamePattern="foundation readiness"`
  - PASS

This refresh adds a stable release-named sqlite soak command and exposes both sqlite and ANN release verifier commands through `getFoundationReadiness().mandatoryChecks`. It does not reclassify the graphdb/ANN baseline as production-closed; repeated and multi-host release evidence remains the closure bar.

### Foundation Release Evidence Freshness and History Refresh (2026-06-06)

- [x] `npm test -- src/foundation.release.evidence.contract.test.ts --runInBand`
  - PASS; covers default env parsing, package-script wiring, latest-report freshness, strict `minReportCount`, timestamped sqlite/ANN history acceptance, strict insufficient-history rejection, and default warning behavior for old stale or non-release history reports.
- [x] `npm test -- src/learning/KnowledgeLearningPlatform.test.ts --runInBand --testNamePattern="foundation readiness"`
  - PASS
- [x] `npm run verify:foundation:release-evidence`
  - PASS; reads latest sqlite and ANN release reports, validates bounded freshness, required profiles, both runtime modes, sqlite soak gates, ANN release gates, and expected recall, counts at least 1 valid fresh report per component by default, warns on stale/non-release history reports, then writes `output/verification/foundation-release-evidence/foundation-release-evidence-report-latest.json`.
- [~] `npm run verify:foundation:release-evidence:strict`
  - Earlier current-host probe failed at sqlite `2/3` and ANN `2/3`; this was the expected gap before regenerating the third sqlite/ANN release reports.
- [x] `npm run test:migration`
  - PASS (`53` suites, `271` tests passed, `13` skipped, `284` total; includes `src/foundation.release.evidence.contract.test.ts`)
- [x] `git diff --check`
  - PASS
- [x] `npm run docs:diataxis:check`
  - PASS
- [x] `npm run verify:markdown:mermaid:fence -- docs`
  - PASS
- [x] `npm run docs:site:build`
  - PASS with existing MkDocs nav warnings and the pre-existing missing `../ref/GitNexus/README.md` documentation link warning.

This refresh adds an audit gate after the heavy sqlite/ANN release report producers and a strict history gate for repeated evidence. The default command verifies that current-host release evidence is fresh and passing without failing on old irrelevant history; the strict command exposes whether the repository already has enough repeated valid release reports. It still does not replace multi-run and multi-host calibration evidence.

### Foundation Strict Release Evidence Closure (2026-06-06)

- [x] `npm run verify:foundation:sqlite-runtime:release`
  - PASS; refreshed sqlite soak evidence at `2026-06-06T03:17:45.083Z` and wrote `output/verification/foundation-sqlite-runtime/foundation-sqlite-runtime-report-2026-06-06T03-17-45-083Z.json`.
- [x] `npm run verify:foundation:ann-runtime:release`
  - PASS; refreshed ANN matrix release-gate evidence at `2026-06-06T03:19:22.368Z` and wrote `output/verification/foundation-ann-runtime/foundation-ann-runtime-report-2026-06-06T03-19-22-368Z.json`.
- [x] `npm run verify:foundation:release-evidence:strict`
  - PASS at `2026-06-06T03:21:04.144Z`; strict history summary reports sqlite `3/3` and ANN `3/3`. Existing stale sqlite history and the old non-release ANN history remain warnings only.
- [x] `npm test -- src/foundation.release.evidence.contract.test.ts --runInBand`
  - PASS (`8` tests).
- [x] `npm run test:migration`
  - PASS (`53` suites, `271` tests passed, `13` skipped, `284` total).
- [x] `git diff --check`
  - PASS.
- [x] `npm run docs:diataxis:check`
  - PASS.
- [x] `npm run verify:markdown:mermaid:fence -- docs`
  - PASS.
- [x] `npm run docs:site:build`
  - PASS with existing MkDocs Material 2.0 warning, existing non-nav page list, and the pre-existing missing `../ref/GitNexus/README.md` documentation link warning.

This closes the current Windows-host strict repeated-evidence audit. It still does not close multi-host evidence, ANN recall/latency threshold convergence, connector-budget calibration, or production closure.

### What This Refresh Adds

1. The embedded `graphdb/sqlite` baseline now also has repeatable host-level runtime proof on the current Windows machine:
   - `npm run verify:foundation:sqlite-runtime` covers both `dist` runtime and packaged sidecar flows,
   - both modes now prove ingest -> store diagnostics/foundation readiness -> restart -> query continuity on the same runtime data directory,
   - `npm run verify:foundation:sqlite-runtime:matrix` now extends that proof across `smoke` / `medium` / `heavy` corpus sizes plus snapshot metadata counts and multi-point restart queries,
   - A8 is therefore no longer blocked on missing packaged/runtime or host-level workload-envelope evidence; the remaining honest gap is soak / longer-duration / performance hardening.
2. The `external_http` ANN connector baseline now also has repeatable host-level runtime proof on the current Windows machine:
   - `npm run verify:foundation:ann-runtime` covers both `dist` runtime and packaged sidecar flows,
   - both modes now prove ingest -> live query-backend diagnostics -> restart -> query continuity against the reference ANN service,
   - `npm run verify:foundation:ann-runtime:matrix` now extends that proof across `smoke` / `medium` / `heavy` corpus sizes plus sync/select telemetry and aligned representation metadata,
   - A9 is therefore no longer blocked on missing host-level runtime or larger-workload evidence; the remaining honest gap is recall/latency threshold convergence and release-grade calibration.
3. The Phase-2 ANN governance slice is now operator-visible through the frontend runbook shell, not only backend JSON:
   - verify/checks now surface ANN sync-health, circuit-budget, traceability, and prefilter summaries plus threshold/signal drilldowns,
   - they now also surface ANN circuit budget flags and prefilter calibration-readiness cues,
   - action-queue continues to carry the index-sync incident drilldown.
4. `query_vector_acceleration_prefilter_effectiveness` now shares the ANN fast-lane escalation path instead of using the slower generic escalation branch.
5. Runtime capability governance now has explicit gate `query_vector_acceleration_calibration_readiness`, which fails or warns until the ANN path has representative sync/prefilter/traceability/stability telemetry in the same runtime window.
6. The workspace verify/checks cards now surface that calibration-readiness gate directly, instead of forcing operators to infer it only from the underlying budget signals.
7. This refresh still does **not** prove release-grade Phase-2 closure:
   - it closes visibility and browser/runtime proof for the new ANN governance summaries,
   - it does **not** close workload/threshold calibration for those budgets.
8. The current core real-machine test slice is now operationalized behind one repeatable entrypoint:
   - `npm run verify:core-real-machine` runs the automated foundation/browser/Tauri slice and emits JSON + Markdown reports under `output/verification/core-real-machine/`,
   - `npm run verify:core-real-machine:clean` runs the same slice and auto-restores transient tracked `src-tauri/bin/server-*` dirtiness introduced by that verification run,
   - manual interactive real-machine commands remain intentionally separate: `npm run tauri:dev:mini:gpu` for desktop and `npm run tauri:android:dev` for Android.

### What These Passes Prove

1. The Phase-3 tutor/memory slice is now real for:
   - tutor adapter telemetry,
   - tutor trace/provider trend diagnostics,
   - conversation memory lifecycle,
   - memory-policy diagnostics/history/trend.
2. These passes do **not** prove Phase-1 A8/A9 closure:
   - runtime no longer defaults to `local-file-graphdb`, restart durability for the embedded `graphdb/sqlite` baseline is integration-proved, host-level dist/runtime + packaged sidecar proof is now in place, and a host-level workload matrix now exists across `smoke` / `medium` / `heavy`, but soak / longer-duration / performance hardening still remains,
   - ANN no longer stops at query-only scaffolding: the `external_http` path now has remote index sync plus live end-to-end query proof, host-level dist/runtime + packaged sidecar proof, and a host-level workload matrix across `smoke` / `medium` / `heavy`, but recall/latency threshold convergence and release-grade calibration still remain before production closure.
3. These passes do **not** prove Phase-2 quality-gate closure:
   - query comparison, staleness, learning-quality, session-plan-quality, and query-backend diagnostics are now implementation-real, but they still require release-grade calibration on top of the current graph/ANN operational baseline.
4. Default runtime tutor execution now runs with an injected local `tutorAdapter`, but this is still a local-first baseline rather than a production-proven multi-provider routing policy.

### Phase 2 Verification Snapshot (2026-05-12)

- [x] `NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_STRICT=1 node scripts/verify-agent-workspace-browser.js`
  - PASS
- [x] `NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_UI_STRICT=1 node scripts/verify-agent-workspace-browser.js`
  - PASS
- [x] `NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_UI_STRICT=1 NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_UI_DYNAMIC_STRICT=1 node scripts/verify-agent-workspace-browser.js`
  - PASS
- [x] `npm run verify:agent-workspace:runtime`
  - PASS
- [x] `npm run verify:agent-workspace:tauri`
  - PASS
- [x] `node node_modules/jest/bin/jest.js src/agent_workspace.contract.parity.test.ts src/agent_workspace.frontend.test.ts src/agent_workspace.runtime.behavior.test.ts --runInBand --no-cache`
  - PASS
- [x] `node node_modules/jest/bin/jest.js src/source_manager.loadflow.test.ts src/welcome.loadflow.test.ts src/pathmode.history.contract.test.ts src/godot.sidecar.bootstrap.contract.test.ts src/sidecar.supply.readiness.contract.test.ts --runInBand --no-cache`
  - PASS
- [x] `npm run verify:sidecar:supply`
  - PASS (`offline-ready` on current Windows host)
- [ ] `npm run verify:agent-workspace:tauri:rust:strict`
  - Expected host failure on current Windows machine: missing Linux GTK/WebKit dependencies (`webkit2gtk-4.1`, `javascriptcoregtk-4.1`, `libsoup-3.0`)
- [ ] `npm run verify:agent-workspace:tauri:window-evidence:strict`
  - Expected host failure on current Windows machine for the same dependency reason

### Phase 2 Interpretation

1. Agent-workspace conversation, capability execution, browser strict evidence, Tauri smoke, load-flow parity, history synchronization, and sidecar/bootstrap readiness are implementation-closed.
2. However, Phase 2 is **not** fully closed at application level, because the new query comparison, staleness, learning-quality, and session-plan-quality runtime surfaces still need release-grade calibration on top of a non-`Partial+` graphdb/ANN baseline.
3. Remaining work is therefore a mix of:
   - operational/release prerequisites (`FR-009`, Linux-host strict Tauri dependency provisioning, Electron decommission review),
   - application-layer implementation gaps (real graphdb/ANN delivery plus stronger release-grade calibration for the new quality/session/query diagnostics).
4. Phase 3 implementation work can proceed in parallel, but it should not be reported as if Phase 1 and Phase 2 are already fully closed.

### Test Objective

Verify that the NoteMD migration slice is fully workable and regression-safe across:

1. NoteMD API/service integration behavior.
2. Core project regression baseline.
3. Packaging/build pipeline stability.
4. Tauri/Rust feasibility path (`cargo check` + rust contracts).
5. Fixrisk closure status consistency.

### Executed Verification (2026-03-22)

- [x] `node node_modules/jest/bin/jest.js src/notemd.server.integration.test.ts --runInBand`
  - PASS (`1` suite, `4` tests)
- [x] `node node_modules/jest/bin/jest.js --runInBand`
  - PASS (`54` suites, `270` tests)
- [x] `node node_modules/typescript/bin/tsc --noEmit`
  - PASS
- [x] Build pipeline scripts:
  - [x] `node scripts/copy-reader-runtime-assets.js`
  - [x] `node node_modules/typescript/bin/tsc`
  - [x] `node scripts/bundle_path_core.js`
  - [x] `node scripts/copy-assets.js`
  - [x] `node scripts/sync-wasm-parity-artifact.js`
  - PASS (all)
- [x] `cargo check` (workdir `src-tauri`)
  - PASS
- [x] `node scripts/run-tauri-tests.js`
  - PASS (`19` Rust tests)
- [x] `node scripts/verify-fixrisk-issues.js --strict-pending`
  - Expected failure mode: only FR-009 remains pending (ops evidence), all other FR items verified closed.

### Key Findings

1. NoteMD migration is functionally integrated and contract-verified.
2. The previous Tauri check flake was caused by a stale lock on `src-tauri/target/debug/server.exe`, not by NoteMD code defects.
3. Sidecar cleanup preflight restores deterministic `cargo` behavior.
4. Build/export paths remain stable and unaffected by the NoteMD additions.
5. Fixrisk closure remains consistent: FR-009 is the only intentionally pending operations gate.

### Conclusion

- NoteMD migration slice is feasible, stable, and regression-safe for current repository scope.
- No new cross-platform regression was observed in web/Tauri/Godot bridge surfaces after integration.

---

# 2026-03-10 v1.5.38 - Multi-Terminal WASM Readiness Slice Verification (Mobile Capability Probe + Build-Mode Telemetry)

### Test Objective

Verify that the multi-terminal WASM continuation slice is workable and regression-safe:

1. Mobile runtime exposes explicit WASM readiness state and reason.
2. Capacitor on-device build path emits capability-aware mode detail without breaking existing fallback behavior.
3. Migration gate suite remains green after the runtime contract extension.

### Implemented Scope Under Verification

- Runtime capability probe:
  - `src/frontend/source_manager.js`
  - added `detectMobileWasmCapability()`
  - added capability fields:
    - `supports_mobile_wasm_compute`
    - `mobile_wasm_reason`
- Build telemetry extension:
  - `src/frontend/storage_provider.js`
  - added `resolveCapacitorBuildModeDetail(...)`
  - added build stats fields:
    - `buildModeDetail`
    - `supportsMobileWasmCompute`
    - `mobileWasmReason`
  - Source manager now logs build warnings/stats for mobile runtime builds.
- Contract updates:
  - `src/runtime.capabilities.test.ts`
  - `src/capacitor.runtime.contract.test.ts`
  - `src/storage.provider.contract.test.ts`
  - `src/storage.provider.capacitor.worker.contract.test.ts`

### Executed Verification (2026-03-10)

- [x] `npx jest src/runtime.capabilities.test.ts src/capacitor.runtime.contract.test.ts src/storage.provider.contract.test.ts src/storage.provider.capacitor.worker.contract.test.ts src/source_manager.loadflow.test.ts --runInBand`
  - PASS (`5` suites, `28` tests)
- [x] `npm run test:migration`
  - PASS (`27` suites, `131` tests)

### Findings

1. Mobile runtime capability boundary is now explicit for WASM readiness:
   - runtime no longer depends on implicit assumptions for mobile compute path selection.
2. Capacitor build path remains deterministic:
   - worker/single-thread fallback behavior is preserved;
   - additional mode-detail telemetry now explains current runtime state.
3. No migration regressions were detected:
   - full migration suite remained green after capability and telemetry extensions.

### Conclusion

- Multi-terminal WASM readiness slice is implemented and verified.
- This slice improves mobile diagnosability and governance, but does not yet claim full mobile WASM kernel parity for all heavy-compute workloads.

---

# 2026-03-10 v1.5.37 - Threshold Calibration Continuation Verification (Configurable GraphMetrics Tiering + Calibration Utility + Snapshot CI)

### Test Objective

Verify that threshold-calibration follow-up is fully workable:

1. GraphMetrics tiering thresholds are configurable at runtime without code edits.
2. Calibration utility produces reproducible evidence and recommendation payload.
3. CI snapshot flow captures both wasm parity and GraphMetrics calibration artifacts.

### Implemented Scope Under Verification

- Policy configurability:
  - `src/backend/GraphMetrics.ts`
  - env overrides:
    - `NOTE_CONNECTION_GRAPHMETRICS_ASYNC_NODE_THRESHOLD`
    - `NOTE_CONNECTION_GRAPHMETRICS_ASYNC_WORKLOAD_RATIO_THRESHOLD`
  - `GraphMetrics.getExecutionPolicy()`
- Calibration utility:
  - `scripts/calibrate-graphmetrics-tiering.js`
  - `npm run calibrate:graphmetrics:tiering`
- CI integration:
  - `.github/workflows/wasm-parity-benchmark-snapshots.yml` now includes calibration snapshot run + artifact upload path

### Executed Verification (2026-03-10)

- [x] `npx jest src/wasm.parity.output.equivalence.contract.test.ts --runInBand`
  - PASS (`7` tests)
  - includes new checks:
    - sparse large graph remains sequential by default (`sparse-workload-threshold`)
    - env override can force sparse large graph into async->wasm path
    - invalid env values fall back to safe default policy values
- [x] `node scripts/calibrate-graphmetrics-tiering.js --iterations 1 --max-workers 4 --out tmp/graphmetrics-tiering-calibration/smoke`
  - PASS
  - output:
    - `tmp/graphmetrics-tiering-calibration/smoke/latest.json`
  - recommendation snapshot (single-iteration smoke run on current host):
    - `asyncNodeCountThreshold=500`
    - `asyncWorkloadBenefitRatioThreshold=115.4385`
- [x] `npm run test:wasm:parity:gates`
  - PASS
  - GraphMetrics p95 ratio (`candidate / baseline`): `0.07505480404213227`
  - LayoutEngine p95 ratio (`candidate / baseline`): `0.0022160486888378587`
- [x] `npm run test:migration`
  - PASS (`27` suites, `131` tests)

### Findings

1. Tiering policy governance is improved:
   - threshold tuning can now be done by environment policy instead of source edits.
2. Calibration evidence loop now exists:
   - profile-matrix benchmark output can drive future threshold convergence.
3. CI drift evidence improved:
   - scheduled snapshots now include both parity benchmark and tiering calibration artifacts.

### Conclusion

- Threshold-calibration continuation slice is implemented and verified.
- No regression observed in strict wasm gates or migration contracts.
- Next step remains multi-iteration/multi-host calibration to increase statistical confidence before updating production default thresholds.

---

# 2026-03-10 v1.5.35 - Detailed Calculation Method Comparison (Sequential vs Worker vs WASM)

### Test Objective

Perform a thorough, evidence-based comparison of available heavy-compute calculation methods in the current codebase, covering:

1. `GraphMetrics` betweenness calculation paths:
   - sequential (`calculateBetweenness`)
   - worker-thread parallel path (`calculateBetweennessAsync` with wasm disabled)
   - wasm-adapter path (`calculateBetweennessAsync` with wasm enabled + provisioned artifact)
2. `LayoutEngine` layout calculation paths:
   - worker path
   - wasm-adapter path

### Scope and Methodology

- Host/runtime:
  - Node.js `v22.14.0`
  - `win32` / `x64`
  - `cpuCount=16`
- Core benchmark graph configs:
  - Dataset A (small/threshold check): `nodeCount=300`, `iterations=4`
  - Dataset B (heavy path check): `nodeCount=500`, `iterations=4`
  - Layout params: `repulsion=-550`, `distance=100`
  - Max workers: `4`
- Evidence sources:
  - `tmp/wasm-parity-benchmark/latest.json` (strict perf gate run, 500 nodes)
  - `tmp/wasm-parity-benchmark/report-method-300/latest.json` (300 nodes)
  - `tmp/calculation-method-comparison/latest.json` (direct same-graph method comparison)

### Executed Commands

- [x] `npm run verify:wasm:parity:strict`
- [x] `npm run benchmark:wasm:parity:strict:perf 4 500`
- [x] `node scripts/benchmark-wasm-parity.js --iterations 4 --nodes 300 --out tmp/wasm-parity-benchmark/report-method-300`
- [x] Custom same-graph comparison run (sequential vs worker vs wasm) -> `tmp/calculation-method-comparison/latest.json`

---

### Comparison Results

#### 1) Heavy Graph (500 nodes) - Same-Graph Direct Method Comparison

Source: `tmp/calculation-method-comparison/latest.json`

| Component | Method | p50 (ms) | p95 (ms) | p99 (ms) | mean (ms) | Notes |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| GraphMetrics | Sequential | 82.845 | 120.737 | 124.105 | 95.262 | Direct single-thread Brandes call |
| GraphMetrics | Worker | 3118.745 | 3273.758 | 3287.536 | 3154.348 | Async worker fan-out path |
| GraphMetrics | WASM Adapter | 231.818 | 267.106 | 270.242 | 243.717 | JSON ABI wasm path |
| LayoutEngine | Worker | 2596.062 | 2644.059 | 2648.326 | 2600.750 | Worker layout simulation |
| LayoutEngine | WASM Adapter | 2.588 | 2.601 | 2.603 | 2.427 | wasm layout apply path |

Key ratios (p95):
- GraphMetrics wasm vs worker: `0.0816` (~91.84% lower p95)
- GraphMetrics sequential vs worker: `0.0369` (~96.31% lower p95)
- GraphMetrics wasm vs sequential: `2.2123` (~2.21x slower than direct sequential in this test shape)
- Layout wasm vs worker: `0.0010` (~99.90% lower p95)

#### 2) Heavy Graph (500 nodes) - Strict Gate Scenario (Runtime Path + Guard)

Source: `tmp/wasm-parity-benchmark/latest.json`

| Component | Baseline (WASM Off) | Candidate (WASM On) | p95 Baseline (ms) | p95 Candidate (ms) | Candidate/Baseline p95 |
| --- | --- | --- | ---: | ---: | ---: |
| GraphMetrics | worker | wasm-adapter | 3393.2 | 247.65 | 0.0730 |
| LayoutEngine | worker | wasm-adapter | 2547.6 | 4.7 | 0.0018 |

Guard status:
- Strict adapter requirement: **PASS** (`wasm-adapter` observed)
- Strict performance ratio guards (<=1.0): **PASS**

#### 3) Small Graph (300 nodes) - Threshold Behavior Comparison

Source: `tmp/wasm-parity-benchmark/report-method-300/latest.json`

| Component | Baseline (WASM Off) | Candidate (WASM On) | p95 Baseline (ms) | p95 Candidate (ms) | Candidate/Baseline p95 |
| --- | --- | --- | ---: | ---: | ---: |
| GraphMetrics | sequential | sequential | 62.45 | 38.0 | 0.6085 |
| LayoutEngine | worker | wasm-adapter | 2254.5 | 7.95 | 0.0035 |

Behavior confirmation:
- `GraphMetrics` at 300 nodes remains on sequential path by design (`nodeCount < 500` threshold).
- `LayoutEngine` candidate still benefits from wasm path even at smaller graph size.

---

### Output Correctness / Equivalence

Source: `tmp/calculation-method-comparison/latest.json`

Tolerance used: `1e-9`

| Comparison | comparedNodes | missing nodes | maxAbsDelta | meanAbsDelta | withinTolerance |
| --- | ---: | ---: | ---: | ---: | --- |
| Sequential vs Worker | 500 | 0 | `9.458744898438454e-11` | `7.1121490918812926e-12` | true |
| Sequential vs WASM | 500 | 0 | `0` | `0` | true |
| Worker vs WASM | 500 | 0 | `9.458744898438454e-11` | `7.1121490918812926e-12` | true |

Conclusion: all compared methods are numerically equivalent under current tolerance and dataset shape.

---

### Detailed Analysis

1. `LayoutEngine`:
   - wasm-adapter is decisively superior to worker in this environment (multi-order-of-magnitude p95 reduction).
   - This is consistent at both 300 and 500 node tests.
   - For current runtime shape, wasm should remain the primary path when artifact is available.

2. `GraphMetrics`:
   - worker path has substantial overhead in this scenario (thread startup/synchronization dominates).
   - wasm-adapter is much faster than worker on heavy graphs (about 12x faster at p95 in 500-node gate run).
   - direct sequential computation is still very competitive for this graph size and sparsity profile.

3. Practical interpretation:
   - Best current practical hierarchy (given artifact provisioned):
     - `LayoutEngine`: wasm > worker
     - `GraphMetrics`: sequential (for this measured shape) < wasm << worker
   - Existing threshold logic (`>=500` promotes async path) is functionally correct but can be further tuned for performance policy.

4. Robustness:
   - strict parity gate now checks both:
     - adapter activation
     - performance regression thresholds
   - This materially reduces risk of silent wasm performance regression in CI.

---

### Recommendations

1. Keep current strict wasm gate (`verify + benchmark:strict:perf`) mandatory in CI.
2. Introduce workload-tiered thresholds for `GraphMetrics` method selection (sparsity-aware), not only node-count based threshold.
3. Add periodic benchmark snapshots (nightly/weekly) to track drift and recalibrate guard thresholds.
4. Keep worker path as fallback for artifact-unavailable scenarios, but treat it as non-preferred in production when wasm is healthy.

---

### Verdict

- **Calculation method comparison is complete and reproducible.**
- **WASM path is validated for correctness and offers major runtime wins over worker path.**
- **Strict regression barriers are effective and currently passing.**

---

# 2026-03-10 v1.5.36 - Method-Policy Continuation Verification (Sparsity-Aware GraphMetrics + Release Gate Enforcement + Snapshot CI)

### Test Objective

Validate that the recommendation follow-up slice is fully landed and workable:

1. GraphMetrics no longer relies on node-count-only routing; sparse heavy graphs should remain sequential.
2. Strict wasm parity gates are enforced in release workflow (`npm-publish`).
3. Periodic benchmark snapshot workflow exists and is executable in CI.

### Implemented Scope Under Verification

- Runtime policy code:
  - `src/backend/GraphMetrics.ts`
    - `ASYNC_NODE_COUNT_THRESHOLD = 500`
    - `ASYNC_WORKLOAD_BENEFIT_RATIO_THRESHOLD = 24`
    - `resolveExecutionDecision(...)` with reasoned mode selection
- Contract coverage:
  - `src/wasm.parity.output.equivalence.contract.test.ts`
    - wasm-path dense fixture retained
    - sparse-large-graph sequential contract added
- CI workflow hardening:
  - `.github/workflows/npm-publish.yml` (strict wasm parity gate step added)
  - `.github/workflows/wasm-parity-benchmark-snapshots.yml` (weekly + manual snapshot workflow)

### Executed Verification (2026-03-10)

- [x] `npx jest src/wasm.parity.output.equivalence.contract.test.ts --runInBand`
  - PASS (`5` tests)
  - confirms:
    - dense large graph path still reaches `wasm-adapter`
    - sparse large graph path remains `sequential` with reason `sparse-workload-threshold`
- [x] `npm run test:wasm:parity:gates`
  - PASS
  - strict verify: artifact/export readiness PASS
  - strict perf guard benchmark PASS
    - GraphMetrics p95 ratio (`candidate / baseline`): `0.08408535438992293`
    - LayoutEngine p95 ratio (`candidate / baseline`): `0.0011282580842560189`
- [x] `npm run test:migration`
  - PASS (`27` suites, `129` tests)

### Findings

1. GraphMetrics method policy is now workload-aware:
   - small or sparse-heavy workloads can stay sequential to avoid async overhead.
   - heavier workloads still take async chain (`wasm-adapter` first, worker fallback).
2. Strict wasm parity enforcement now reaches release path:
   - publish workflow now fails fast if strict parity gate fails.
3. Periodic drift evidence path is implemented:
   - scheduled snapshot workflow captures benchmark artifacts for longitudinal review.

### Conclusion

- Recommendation follow-up is implemented and verified.
- No regression observed in strict parity gates or migration contract suite after policy change.
- Remaining optimization track is threshold calibration across broader workload distributions.

---

# 2026-03-04 v1.5.13 - Capacitor Physical-Device Acceptance Readiness Report

### Test Objective

Establish and verify a deterministic preflight gate for the final pending `v1.5.9` physical-device acceptance item.

### Added Verification Surface

- [x] Device acceptance probe script:
  - [x] `scripts/verify-capacitor-device-acceptance.js`
  - [x] checks:
    - [x] debug APK artifact exists
    - [x] `adb` is available
    - [x] at least one online device is connected
- [x] npm command:
  - [x] `npm run verify:capacitor:device`

### Executed Verification (2026-03-04)

- [x] `npm run mobile:build:capacitor` -> PASS
- [ ] `npm run verify:capacitor:device` -> FAIL (no online device connected)
  - observed:
    - `[Capacitor Device Probe] No online Android device detected.`
    - `[Capacitor Device Probe] Connect a device (USB debugging enabled) and run again.`

### Conclusion

- Build/export pipeline is healthy and reproducible.
- Final release sign-off remains blocked only by missing real-device execution evidence, not by automation/tooling readiness.

---

# 2026-03-04 v1.5.12 - v1.5.9 Final Gate Closure Verification (Desktop GO + Mobile Boundary)

### Verification Objective

Close the remaining actionable items in `2026-03-03 v1.5.9 - Electron Removal Final Gate (Audit-Driven Action Plan)` and re-verify release gates after closure updates.

### Closure Actions Completed

- [x] Migration hygiene closure:
  - [x] Removed empty `src/electron` directory.
  - [x] Reworded remaining misleading legacy “Electron” comments in active bridge-based runtime files.
- [x] Documentation alignment:
  - [x] Marked `docs/tauri_tasks.md` as historical context and pointed active tracking to `TODO.md` + `TEST_REPORT.md`.
  - [x] Updated `TODO.md` `v1.5.9` EN/ZH checklist statuses to match current runtime facts.
- [x] Reliability guardrails:
  - [x] Added `test:mobile:contracts` script in `package.json`.
  - [x] Added CI matrix workflow `.github/workflows/migration-gates.yml`:
    - [x] desktop migration suite
    - [x] tauri rust suite
    - [x] mobile pipeline contract suite

### Fresh Verification Evidence (Executed on 2026-03-04)

- [x] `npm run test:migration` -> PASS (`66` tests)
- [x] `npm run test:tauri` -> PASS (`18` tests)
- [x] `npm run test:mobile:contracts` -> PASS (`28` tests)
- [x] `npm run verify:android:env` -> PASS

### Current Risk Boundary

- Desktop Electron decommission remains **GO**.
- Full all-platform runtime parity statement remains **NO-GO** while Capacitor is intentionally read-only for folder/build/content behavior.
- Capacitor APK physical-device checklist execution evidence is still required for final release sign-off.

---

# 2026-03-03 v1.5.10 - Option A P0 Verification (Tauri Android Native Folder/Build/Content Flow)

### Test Objective

Verify that Option A P0 is functionally completed for Tauri Android runtime:
- folder discovery
- graph build trigger
- content/runtime artifact generation

### Evidence Scope

- Runtime command surface:
  - `src-tauri/src/lib.rs` (`build_graph_runtime`, `get_runtime_capabilities`)
- Frontend routing:
  - `src/frontend/source_manager.js` (sidecar-first, tauri-native fallback build path)
- Regression contracts:
  - `src/runtime.capabilities.test.ts`
  - `src/source_manager.loadflow.test.ts`
  - `src-tauri/src/lib.rs` unit tests

### Executed Verification (2026-03-03)

- `npm run test:migration` -> **PASS** (`55` tests)
- `npm run test:tauri` -> **PASS** (`16` tests)
- `npm run verify:android:env` -> **PASS** (SDK + cmdline-tools + NDK detected)

### Findings

1. Android runtime capability profile is now build-enabled:
   - `supports_sidecar=false`
   - `supports_build=true`
   - `supports_content_api=true`

2. Native runtime build command exists and is test-covered:
   - `build_graph_runtime` scans KB targets and writes active + per-target runtime artifacts.

3. Frontend load/build flow now has explicit route split:
   - Sidecar available -> `/api/build`
   - No sidecar + Tauri -> `invoke('build_graph_runtime')`

4. Previous Android `supports_build=false` assumption is no longer current for Tauri Android runtime.

### Remaining Risk Boundary

- Capacitor runtime is still not equivalent to desktop/Tauri Android build backend behavior.
- This is now a product-scope decision/follow-up task, not a blocker for Option A P0 in Tauri Android.

### Conclusion

- **Option A P0 (Tauri Android folder/build/content native-equivalent flow): COMPLETE**
- Desktop and web paths remain stable (no regression observed in migration and tauri suites).

---

# 2026-03-03 v1.5.9 - Electron to Tauri Migration Audit (Desktop + Capacitor + Tauri Android)

### Audit Goal

Determine whether Electron-to-Tauri migration is successful at the current repository state, including:

- Desktop runtime replacement completeness.
- Electron I/O/IPC/export surface coverage.
- Capacitor export path status.
- Tauri Android path status.
- Risk impact if Electron is removed now.

### Evidence Reviewed

- Runtime/build entry:
  - `package.json`
  - `src/server.ts`
  - `src/utils/RuntimePaths.ts`
  - `src/frontend/source_manager.js`
  - `src/frontend/reader.js`
  - `src/frontend/app.js`
  - `src/core/PathBridge.ts`
  - `src-tauri/src/lib.rs`
  - `src-tauri/tauri.conf.json`
  - `src-tauri/tauri.android.conf.json`
- Mobile/export pipelines:
  - `build_apk.bat`
  - `capacitor.config.ts`
  - `scripts/run-tauri-android.js`
  - `scripts/verify-tauri-android-prereqs.js`
- Regression/contracts:
  - `src/server.migration.test.ts`
  - `src/source_manager.loadflow.test.ts`
  - `src/runtime.capabilities.test.ts`
  - `src/mobile.pipeline.test.ts`
  - `src/android.pathmode.contract.test.ts`
  - `src/android.pathmode.smoke.contract.test.ts`
  - `src/pathbridge.handshake.contract.test.ts`

### Fresh Verification (Executed on 2026-03-03)

- `npm run test:migration` -> **PASS** (`53` tests).
- `npm run test:tauri` -> **PASS** (`14` tests).
- `npm run verify:android:env` -> **PASS** (SDK + cmdline-tools + NDK detected).

### Electron Surface-by-Surface Migration Status

| Electron Baseline Surface | Current Tauri/Runtime Replacement | Status | Evidence |
| --- | --- | --- | --- |
| Electron app shell/main process orchestration | Tauri Rust host, sidecar spawn, command bridge | Complete | `src-tauri/src/lib.rs`, `package.json` |
| `getKbPath` / `setKbPath` | Rust commands + persisted config | Complete | `src-tauri/src/lib.rs` (`get_kb_path`, `set_kb_path`) |
| Folder discovery (`getFolders`) | Sidecar `/api/folders` + `/api/available-targets`, Rust fallback commands | Complete | `src/server.ts`, `src/frontend/source_manager.js`, `src-tauri/src/lib.rs` |
| Node content read (`getContent`) | Sidecar `/api/content` + Rust `read_node_content` fallback | Complete (desktop), boundary on mobile | `src/server.ts`, `src/frontend/reader.js`, `src-tauri/src/lib.rs` |
| Cache check/restore | Sidecar endpoints + Rust commands; dedupe guards | Complete | `src/server.ts`, `src-tauri/src/lib.rs`, `src/server.migration.test.ts` |
| Graph build trigger (`buildGraph`) | Sidecar `POST /api/build` with in-flight dedupe | Complete (desktop), disabled by capability on Android | `src/server.ts`, `src/frontend/source_manager.js`, `src-tauri/src/lib.rs` |
| Build log streaming to UI | Rust emits sidecar stdout/stderr via events (`build-log`) | Complete | `src-tauri/src/lib.rs`, `src/frontend/loading.js` |
| Godot Pathmode integration | PathBridge websocket + Android native activity option | Complete (desktop + Android-native path) | `src/core/PathBridge.ts`, `src/frontend/app.js`, `src-tauri/src/lib.rs` |
| Desktop packaging | Tauri bundle with server/godot external bins | Complete | `src-tauri/tauri.conf.json`, `package.json` |
| Capacitor export path | `build_apk.bat` + `capacitor.config.ts` web asset packaging | Build path complete, runtime parity partial | `build_apk.bat`, `capacitor.config.ts` |
| Tauri Android export path | `run-tauri-android.js` + env verifier + patch pipeline | Build/tooling path complete; runtime capability-gated | `scripts/run-tauri-android.js`, `scripts/verify-tauri-android-prereqs.js`, `src-tauri/src/lib.rs` |

### Critical Findings

1. Desktop Electron replacement is effectively complete:
   - No Electron scripts/dependencies in `package.json`.
   - No active `window.electronAPI` runtime calls in source paths.
   - Core Electron IPC-equivalent behaviors are now handled by sidecar HTTP + Tauri commands.

2. Electron removal risk for desktop runtime is low:
   - The project already runs as Tauri-first with passing migration/tauri suites.
   - Sidecar path, cache flow, path management, and content fallback contracts are in place.

3. Full cross-platform parity is not complete yet (mainly mobile scope boundaries):
   - Android runtime capability is intentionally gated (`supports_sidecar=false`, `supports_build=false`).
   - Capacitor path is a static web packaging route, not equivalent to desktop sidecar runtime.

4. Capacitor-specific functional parity gap remains:
   - Frontend bootstrap loads `data.js` first.
   - `src/frontend/data.js` currently has no `content` field entries (lite graph payload).
   - Reader falls back to `/api/content` or Tauri `read_node_content`; Capacitor path has neither by default.
   - Result: graph visualization can work, but folder/build/content flows are not desktop-equivalent in Capacitor mode.

### Risk Matrix if Electron Is Removed Now

| Risk | Severity | Impact | Current Mitigation | Remaining Work |
| --- | --- | --- | --- | --- |
| Desktop regression after Electron deletion | Low | Low | Tauri runtime is already primary; tests pass | Keep migration suite in CI gate |
| Capacitor app feature parity (folder/build/content) | High | High | Boundary documented; Capacitor build pipeline exists | Decide explicit product scope or implement native/mobile content/build bridge |
| Android parity with desktop build path | Medium | Medium | Capability gating prevents invalid calls | Option A parity implementation or keep explicit non-parity policy |
| Stale Electron references in docs/comments/naming | Low | Medium (maintenance confusion) | Historical docs preserved | Archive/rename remaining Electron-specific wording |
| Empty `src/electron` folder remains | Low | Low | No runtime dependency | Remove folder or add explicit archive marker |

### Go/No-Go Decision

- **Desktop Electron decommissioning:** **GO**
  - The active desktop runtime and packaging paths are Tauri-based and test-verified.
- **Full-scope “all-platform parity achieved” declaration:** **NO-GO**
  - Capacitor and Android runtime capabilities are intentionally not equivalent to desktop sidecar build/content behavior.

### Recommendation Summary

1. Treat Electron as decommissioned for desktop runtime now.
2. Do not claim full migration closure until mobile parity boundary is either:
   - explicitly productized as a permanent limitation, or
   - implemented with native-equivalent mobile content/build flows.
3. Keep `test:migration` and `test:tauri` as mandatory release gates for this transition phase.

---

# 2026-03-03 v1.5.8 - PathBridge Handshake Stability Report

### Scope

Stabilize Bridge socket identification and remove Godot URL incompatibility, while preventing accidental `frontend-early` socket startup in Tauri runtime.

### Delivered

- Godot websocket compatibility fix:
  - `path_mode/scripts/ws_client.gd` now uses `ws://127.0.0.1:9876` (no query string).
  - Added explicit `identify` message on connect (`client=godot`).
  - Added pending-message queue flush after reconnect.
- Bridge handshake protocol:
  - `src/core/PathBridge.ts` now supports `identify` messages.
  - Runtime client tags can be updated via `setClientTag(...)` with sanitization.
- Frontend socket hardening:
  - `src/frontend/path_app.js` now connects via base `ws://localhost:9876`.
  - Sends `identify` for `frontend` and `frontend-early`.
  - Tauri detection hardened with user-agent fallback to avoid early-socket races.
- Regression contracts:
  - Added `src/pathbridge.handshake.contract.test.ts`.
  - Included in `test:migration`.

### Verification

- `npm run test:migration` -> **PASS** (`53` tests)
- `npm run test:tauri` -> **PASS** (`14` tests)

### Impact

- Desktop: Bridge connection labels and lifecycle are more deterministic.
- Web browser mode: retained early bridge behavior.
- Android: unchanged behavior for native Pathmode flow.

---

# 2026-03-03 v1.5.7 - Android Pathmode Smoke Lifecycle Report

### Scope

Add a repeatable smoke verification layer for Android native Pathmode lifecycle without changing desktop/web runtime behavior.

### Delivered

- New smoke script:
  - `scripts/smoke-android-pathmode.js`
  - Validates lifecycle:
    - launch host `MainActivity`
    - launch `PathmodeGodotActivity`
    - send back event (`KEYCODE_BACK`)
    - verify return to `MainActivity`
- Optional strict mode:
  - `NOTE_CONNECTION_ANDROID_SMOKE_REQUIRE_DEVICE=1` -> fail if no connected device.
  - default mode -> skip with explicit message if no device/emulator attached.
- Script wiring:
  - `package.json` -> `smoke:android:pathmode`
- Contract coverage:
  - `src/android.pathmode.smoke.contract.test.ts`
  - `src/mobile.pipeline.test.ts` updated for smoke script registration

### Verification

- `npm run test:migration` -> **PASS** (`50` tests)
- `npm run test:tauri` -> **PASS** (`14` tests)
- `npm run smoke:android:pathmode` -> **PASS** (skip path observed because no connected device in current environment)

### Impact

- Desktop: unchanged.
- Web: unchanged.
- Android: adds explicit runtime smoke verification path for native Pathmode activity lifecycle.

---

# 2026-03-03 v1.5.6 - Option A Android Native Pathmode Verification Report

### Scope

Implement and verify Option A on Android: replace Pathmode web window flow with native full-screen Godot activity launch, while keeping desktop/web behavior unchanged.

### Code and Build Surface Delivered

- Android-native launch contract:
  - `src-tauri/src/lib.rs`
    - added `open_native_pathmode` command
    - added `supports_native_pathmode` capability flag
    - Android JNI bridge call to `PathmodeBridge.openPathmode(...)`
- Frontend launch routing:
  - `src/frontend/app.js`
    - Path Mode button now prefers Android native launch when runtime capability is enabled
    - desktop/web remains on existing Path Mode container flow
- Android patch pipeline (tracked + reproducible):
  - `scripts/apply-tauri-android-pathmode.js`
  - `scripts/run-tauri-android.js` (pre/post patch hooks + Android-only build-memory controls)
  - `src-tauri/mobile/android/PathmodeBridge.kt`
  - `src-tauri/mobile/android/PathmodeGodotActivity.kt`
- Godot exit return:
  - `path_mode/scripts/path_renderer.gd`
    - Android `Exit` now performs activity quit path (returning to host window)

### Regression and Contract Coverage

- Added/updated test coverage:
  - `src/android.pathmode.contract.test.ts`
  - `src/runtime.capabilities.test.ts` (native pathmode capability/command assertions)
  - `src/mobile.pipeline.test.ts` (Android patch script integration assertions)
- Verification:
  - `npm run test:migration` -> **PASS** (`48` tests)
  - `npm run test:tauri` -> **PASS** (`14` tests)

### Android Build Evidence

- Command:
  - `node scripts/run-tauri-android.js build`
- Result:
  - **PASS**
- Artifacts:
  - `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk`
  - `src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab`

### Risk Notes

- Android patching currently targets generated Tauri Android files (`src-tauri/gen/android`); if upstream Tauri template structure changes, patch script updates may be required.
- Kotlin daemon/cache warnings can appear during Android build logs; build currently completes with valid APK/AAB output.

---

# 2026-03-03 v1.5.5 - Regression Revalidation and Status Normalization

### Scope

Proceed with migration closure validation by re-running gate tests and normalizing plan/report status wording to reduce ambiguity between historical and active items.

### Validation Evidence

- `npm run test:migration` -> **PASS** (`44` tests).
- `npm run test:tauri` -> **PASS** (`14` tests).

### Conclusions

- Desktop Electron -> Tauri migration remains stable at code + test level.
- P0/P1 closure from `v1.5.3`/`v1.5.4` remains valid after revalidation.
- Remaining non-closed item is still product-level mobile parity strategy:
  - Option A: Android-native build/content parity with desktop sidecar.
  - Option B (active): capability-gated cache/read runtime on Android.

### Documentation Normalization

- `TODO.md` now explicitly tags `v1.5.2` as historical/superseded context.
- Historical plan content is retained for traceability, while active blockers are clarified.

---

# 2026-03-03 v1.5.4 - Runtime Boundary UI Clarification Closure

### Scope

Close the remaining P1 clarification item by making mobile runtime capability boundaries explicit in product UI and revalidating regressions.

### Changes Implemented

- `src/frontend/source_manager.js`
  - Added runtime capability note element (`runtime-capability-note`).
  - In Tauri runtime with `supports_build=false`, UI now explicitly shows:
    - `Mobile runtime is cache/read mode (local build is unavailable).`
  - Note text updates on language-change events.
- `src/source_manager.loadflow.test.ts`
  - Added contract assertion to ensure runtime-boundary note logic remains present.

### Verification

- `npm run test:migration` -> **PASS** (`44` tests).
- `npm run test:tauri` -> **PASS** (`14` tests).

### Status Impact

- P1 item "Clarify Android runtime capability boundaries in product docs/UI" is now closed at code + test level.
- Product strategy remains unchanged:
  - Desktop: full Tauri sidecar path.
  - Android: capability-gated cache/read flow by design.

---

# 2026-03-03 v1.5.3 - Final Gate Execution Report (P0 Closure + Parity Decision)

### Scope Executed in This Round

Complete the P0 migration-gate engineering tasks identified in `TODO.md`:

1. Sidecar `/api/content` KB-root security hardening.
2. Regression coverage for content-path allow/block behavior.
3. Single-load/cache-prompt guard contract coverage.
4. Godot History consistency contract for center-switch flow.

### Code Changes Landed

- `src/server.ts`
  - Added secure content candidate resolution (`Knowledge_Base` marker rebasing + relative/absolute handling).
  - Added canonical KB-root boundary enforcement for `/api/content`.
  - Added explicit `403` response when requested file is outside configured KB root.
- `src/server.migration.test.ts`
  - Added tests for:
    - inside-root absolute path success
    - legacy `...\\Knowledge_Base\\...` path success
    - outside-root path rejection (`403`)
- `path_mode/scripts/path_mode_ui.gd`
  - Added `record_navigation_node(node_id)` to append switched center nodes while browsing.
- `path_mode/scripts/path_renderer.gd`
  - Wired `render_path` to call `ui.record_navigation_node(central_id)` after center updates.
- New regression/contract tests:
  - `src/source_manager.loadflow.test.ts`
  - `src/pathmode.history.contract.test.ts`
- `package.json`
  - Extended `test:migration` to include the two new tests.

### Verification Results

#### 1) Migration suite

- Command: `npm run test:migration`
- Result: **PASS**
- Evidence: `43` tests passed (`+8` over prior 35 baseline).

#### 2) Tauri/Rust suite

- Command: `npm run test:tauri`
- Result: **PASS**
- Evidence: `14` tests passed.

### Migration Completion Decision (Current)

- Desktop Electron -> Tauri core migration: **Ready/Stable**.
- P0 gate items (security + regression + history contracts): **Completed in code and tests**.
- Mobile full runtime parity (desktop-equivalent build pipeline on Android): **Not fully equivalent by design yet**.
  - Decision kept explicit: Android remains capability-gated (`supports_sidecar=false`, `supports_build=false`) with cache/content-safe runtime behavior.

### Residual Items Outside P0 Engineering Closure

- Product-level decision remains required for full mobile parity target:
  - A) Build Android-native graph-build runtime equivalent, or
  - B) Keep cache/read-focused mobile scope as the official product constraint.

---

# 2026-03-03 v1.5.2 - Electron to Tauri Migration Audit (Full Surface: Desktop + Capacitor + Tauri Android)

### Objective

Determine whether Electron-to-Tauri migration is successful at this stage, including:

- Electron section replacement completeness (runtime + IPC + config behavior).
- Input/output behavior parity (KB path, folder list, content read, build, cache, language, logs).
- Export/build surface parity (desktop package, Capacitor APK, Tauri Android).
- Risk impact if Electron is removed immediately.

### Evidence Reviewed

- Runtime/orchestration:
  - `src/server.ts`
  - `src/utils/RuntimePaths.ts`
  - `src/core/PathBridge.ts`
  - `src/frontend/source_manager.js`
  - `src/frontend/reader.js`
  - `src/frontend/i18n.js`
  - `src-tauri/src/lib.rs`
  - `src-tauri/tauri.conf.json`
  - `src-tauri/tauri.android.conf.json`
- Export/mobile pipelines:
  - `package.json`
  - `build_apk.bat`
  - `capacitor.config.ts`
  - `scripts/run-tauri-android.js`
  - `scripts/verify-tauri-android-prereqs.js`
- Regression status:
  - `npm run test:migration` -> **PASS** (`35` tests)
  - `npm run test:tauri` -> **PASS** (`14` tests)

### Electron Surface Audit Result

| Electron Baseline Surface | Current Tauri/Runtime Replacement | Status | Evidence |
| --- | --- | --- | --- |
| Main process shell (`main.ts`), preload bridge | Tauri Rust host + invoke commands + sidecar process orchestration | Replaced | `src-tauri/src/lib.rs` |
| `getKbPath` / `setKbPath` | `get_kb_path` / `set_kb_path` commands + persisted config | Replaced | `lib.rs` commands + config read/write |
| `getFolders` | sidecar `/api/folders` + Rust fallback `get_folders` | Replaced | `server.ts`, `lib.rs`, `source_manager.js` |
| `getContent(path)` | sidecar `/api/content` + Rust fallback `read_node_content` | Replaced (with security gap on sidecar path) | `server.ts`, `reader.js`, `lib.rs` |
| `buildGraph(opts)` | sidecar `POST /api/build` | Replaced (desktop) | `server.ts`, `source_manager.js` |
| `checkCache` / `restoreCache` | sidecar API + Rust commands | Replaced | `server.ts`, `lib.rs`, `source_manager.js` |
| `getUserLanguage` / `setUserLanguage` | Rust commands + i18n sync | Replaced | `lib.rs`, `i18n.js` |
| Live build logs | Rust emits `build-log` from sidecar stdout/stderr | Replaced | `lib.rs`, `loading.js` |
| Process lifecycle shutdown | `shutdown_child_processes` on window close | Replaced | `lib.rs` |

### Export / Packaging Audit

| Export Path | Current State | Parity vs Electron-era expectation |
| --- | --- | --- |
| Desktop packaging | Tauri desktop build path exists and is test-covered | Good for desktop migration |
| Capacitor Android (`build_apk.bat`) | Build path maintained and still operational | Build/export available, but runtime feature parity is web-asset-level only |
| Tauri Android (`tauri android build`) | Build path operational; Android config excludes desktop sidecars | Packaging works, full runtime parity intentionally not complete |

### Migration Verdict

#### 1) Desktop Tauri migration

- **Status**: **Successful overall**.
- Core Electron responsibilities have active Tauri replacements.
- Automated regression evidence is strong (`35 + 14` tests passing).

#### 2) Full-scope migration (including Capacitor/Tauri Android runtime behavior)

- **Status**: **Not fully complete**.
- Mobile parity is intentionally constrained:
  - Android runtime capabilities disable sidecar/build (`supports_sidecar: false`, `supports_build: false`).
  - Capacitor export route packages frontend assets but does not deliver desktop-equivalent local sidecar workflow.

### Risks If Electron Is Removed Immediately

| Risk | Severity | Impact | Current Trigger |
| --- | --- | --- | --- |
| Mobile runtime parity gap (`/api/build` equivalent absent) | High | Users may assume full desktop-like build features on mobile and fail at runtime | Android capability profile intentionally disables build |
| Sidecar `/api/content` path boundary is weaker than Rust content command | High | Possible file-read exposure risk on desktop sidecar HTTP surface | `server.ts` content API resolves absolute path without KB-root boundary enforcement |
| Cache prompt/single-load UX regressions are not fully E2E-covered | Medium | Duplicate prompt/load or user confusion under startup timing races | User-reported scenarios are only partially covered by unit/regression tests |
| Godot history update behavior not fully contract-tested | Medium | Learning history panel may miss center-switch transitions | No dedicated automated scenario assertion for this interaction path |
| Documentation drift in historical Electron sections | Low | Team confusion about current authoritative runtime | Legacy historical sections still exist by design |

### Removal Decision

- **Desktop-only decision**: Electron removal is technically acceptable with current architecture.
- **Whole-project decision (desktop + mobile parity)**: Do **not** declare migration fully complete yet; keep a final parity closure phase focused on Android/runtime UX and sidecar security hardening.

---

# 2026-03-02 v1.5.1 - Runtime Parity Verification Update (Desktop + Android)

### Scope

Validate newly introduced runtime parity contracts after Electron-to-Tauri migration hardening:

- sidecar + Rust target discovery parity
- Rust content-read fallback for non-sidecar runtime
- cache-only UX behavior in `supports_build=false` runtime
- Android build pipeline stability (default + universal path)

### Verification Results

#### 1) Migration regression suite

- Command: `npm run test:migration`
- Result: **PASS**
- Evidence: `35` tests passed.

#### 2) Rust/Tauri regression suite

- Command: `npm run test:tauri`
- Result: **PASS**
- Evidence: `14` tests passed.

#### 3) Android build (arm64 default path)

- Command: `npm run tauri:android:build`
- Result: **PASS**
- Artifacts:
  - `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk`
  - `src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab`

#### 4) Android build (universal opt-in path)

- Command: `npm run tauri:android:build:universal`
- Result: **PASS**
- Notes:
  - Confirms opt-in multi-ABI command path remains functional.

### New Interface Contracts Covered

- Sidecar endpoint: `GET /api/available-targets`
- Rust command: `get_available_targets`
- Rust command: `read_node_content(file_path)`
- Reader fallback order: sidecar content API -> Rust content command -> localized error text

### Residual Risk

- Android runtime still lacks in-app build parity (`/api/build` equivalent).
- Path Mode / Godot Android runtime strategy remains open.

---

# 2026-03-02 v1.5.0 - Tauri Android Build Recovery Validation (Arm64)

### Scope

Validate that Tauri Android can complete real build output on this machine after fixing dependency/target/runtime blockers discovered in prior migration rounds.

### Verification Results

#### 1) Android environment preflight

- **Command**: `npm run verify:android:env`
- **Result**: **Pass**
- **Evidence**:
  - SDK root resolved: `C:\Users\jacob\AppData\Local\Android\Sdk`
  - `sdkmanager` detected under `cmdline-tools/latest/bin`
  - NDK detected: `C:\Users\jacob\AppData\Local\Android\Sdk\ndk\27.2.12479018`

#### 2) Rust Android compile blockers (rfd/menu/desktop APIs)

- **Initial status**: **Fail** (historical blockers)
  - `rfd` not supported on Android target.
  - `tauri::menu` desktop-only APIs unavailable on Android.
  - Desktop sidecar/Godot launch code coupled into mobile runtime path.
- **Fixes validated**:
  - `rfd` moved to desktop-only target dependency.
  - Android-safe folder-picker fallback added.
  - Menu APIs guarded by `cfg(not(target_os = "android"))`.
  - Android startup path skips desktop sidecar/Godot launch.
  - Android config override added: `src-tauri/tauri.android.conf.json` (`externalBin: []`).
- **Post-fix status**: **Pass** for compilation and packaging path.

#### 3) Wrapper stability on Windows

- **Issue found**: `spawnSync npx.cmd EINVAL`
- **Fix**: invoke through `cmd.exe /d /s /c npx ...` in `scripts/run-tauri-android.js`.
- **Additional hardening**:
  - Spawn error/signal logging.
  - Default target policy: `aarch64` for `build/dev`.
  - Override support: `NOTE_CONNECTION_TAURI_ANDROID_TARGET`.
- **Validation command**: `node scripts/run-tauri-android.js init`
- **Result**: **Pass**

#### 4) Android build execution

- **Command**: `node scripts/run-tauri-android.js build`
- **Result**: **Pass**
- **Output evidence**:
  - APK:
    - `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk`
  - AAB:
    - `src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab`

#### 5) npm pipeline validation

- **Command**: `npm run tauri:android:build`
- **Result**: **Pass**
- **Notes**:
  - Includes `build:mini`, Android env preflight, sidecar binary validation, and Android arm64 Tauri build.

#### 6) Migration regression suite

- **Command**: `npm run test:migration`
- **Result**: **Pass** (`30` tests)
- **Notes**:
  - Includes updated assertions in `src/mobile.pipeline.test.ts` for arm64 default and override contract.

### Current Risk / Non-Parity Items

- Android build pipeline is now executable and artifact-producing, but desktop-only runtime capabilities remain intentionally disabled on Android:
  - Desktop Node sidecar runtime launch is skipped on Android.
  - Desktop Godot bridge launch is skipped on Android.
- Functional parity for on-device folder build/load and full path-mode behavior still requires Android-native runtime design.

---

# 2026-03-01 v1.4.9 - Live Pipeline Verification (Desktop + Dual Mobile)

### Scope

Execute real build pipelines after `v1.4.8`, not only unit/regression tests.

### Results

#### 1) Tauri desktop package (mini path)

- **Command**: `npm run tauri:build:mini` (with `NOTE_CONNECTION_GODOT_EXE=E:\网页下载\Godot_v4.6-stable_win64_console.exe`)
- **Result**: **Pass**
- **Evidence**:
  - `build:sidecar` succeeded.
  - `prepare:godot:bin` succeeded.
  - `verify:tauri:bin` succeeded.
  - Bundles produced:
    - `src-tauri/target/release/bundle/msi/NoteConnection_1.3.0_x64_en-US.msi`
    - `src-tauri/target/release/bundle/nsis/NoteConnection_1.3.0_x64-setup.exe`

#### 2) Capacitor Android APK pipeline

- **Command**: `build_apk.bat` (non-interactive with `NOTE_CONNECTION_NO_PAUSE=1`)
- **Result**: **Pass**
- **Fix applied before pass**:
  - Escaped parentheses in `echo` lines inside `if (...)` blocks to fix:
  - `are was unexpected at this time.`
  - `from: was unexpected at this time.`
  - Added non-interactive pause guard for CI/automation.
- **Artifact**:
  - `android/app/build/outputs/apk/debug/app-debug.apk`

#### 3) Tauri Android path

- **Commands**:
  - `npm run tauri:android:init`
  - `npm run verify:android:env`
- **Result**: **Blocked by environment prerequisite**
- **Detected blocker**:
  - Missing Android SDK command-line tools:
  - `<ANDROID_SDK_ROOT>/cmdline-tools/latest/bin/sdkmanager(.bat)`
- **Hardening added**:
  - New script `scripts/verify-tauri-android-prereqs.js`
  - New command `npm run verify:android:env`
  - Wired as mandatory preflight for:
    - `tauri:android:init`
    - `tauri:android:dev`
    - `tauri:android:build`

#### 4) Regression checks after fixes

- **Command**: `npm run test:migration`
- **Result**: **Pass** (`29` tests)
- **Notes**:
  - Includes updated dual-mobile test assertions.

#### 5) Unified dual-path command behavior

- **Command**: `npm run mobile:build:both`
- **Result**: **Expected Mixed Outcome**
- **Observed**:
  - Capacitor branch completed and produced APK.
  - Tauri Android branch stopped at `verify:android:env` with explicit missing `cmdline-tools` message.
- **Assessment**:
  - Combined command now behaves deterministically and surfaces the exact prerequisite gap.

### Current State

- Desktop Tauri packaging: **Verified Pass**
- Capacitor Android pipeline: **Verified Pass**
- Tauri Android pipeline: **Ready at script level, blocked by missing local SDK cmdline-tools**

---

# 2026-03-01 v1.4.8 - Migration Closure Validation (P1.5 Dual Android)

### Objective

Confirm that the migration list is operationally closed with automated checks, including both Android generation paths:

1. Capacitor pipeline.
2. Tauri Android pipeline.

### Validation Results

#### 1) Mini build integrity

- **Command**: `npm run build:mini`
- **Expectation**: TypeScript compile + mini asset copy succeeds.
- **Result**: **Pass**

#### 2) Migration regression suite

- **Command**: `npm run test:migration`
- **Expectation**: Runtime-path, cache/build dedupe, and dual mobile script contracts all pass.
- **Result**: **Pass** (`29` tests, `7` suites)
- **Notes**:
  - Includes new test file `src/mobile.pipeline.test.ts`.
  - Verifies:
    - Capacitor and Tauri Android scripts both exist.
    - `capacitor.config.ts` and `build_apk.bat` are aligned to `dist/src/frontend`.
    - Tauri bundle sidecar entries retain `bin/server` and `bin/godot`.

#### 3) Rust/Tauri runtime tests

- **Command**: `npm run test:tauri`
- **Expectation**: Core Tauri migration safety tests pass.
- **Result**: **Pass** (`9` tests)

#### 4) Sidecar relaunch smoke

- **Command**: `npm run smoke:sidecar:relaunch`
- **Expectation**: No orphan process or port lock after shutdown.
- **Result**: **Pass** (port `3000` free after exit)

### Conclusion

- Migration checklist status: **Closed for current scope**.
- `P1.5` dual Android strategy is now:
  - Implemented in scripts/config.
  - Covered by automated regression tests.

---

# 2026-03-01 v1.4.7 - Electron Decommission & Dual Mobile Pipeline Verification

### Objective

Validate completion status of the migration checklist after implementing:

- Tauri runtime-data path hardening.
- Godot sidecar launch hardening (without hardcoded absolute path in Rust runtime).
- Electron surface decommission.
- Dual Android generation paths (Capacitor + Tauri Android scripts).

### Evidence Summary

#### 1) Runtime Path & Cache Hardening

- **Result**: Pass
- **Implemented**:
  - Generated graph artifacts now write to writable runtime data directory.
  - Sidecar read path supports runtime-data-first with bundled frontend fallback.
  - Rust + Node cache restore/check logic aligned with runtime data strategy.
- **Verification**:
  - `npm run test:migration` -> pass (`25` tests, includes runtime path + dedupe routes).
  - `npm run test:tauri` -> pass (`9` Rust unit tests, including runtime bootstrap/cache restore tests).

#### 2) Child Lifecycle & Relaunch Stability

- **Result**: Pass
- **Implemented**:
  - Explicit sidecar/Godot process handles and shutdown hooks retained in Tauri runtime.
  - Added relaunch smoke check script for port lock regression.
- **Verification**:
  - `npm run smoke:sidecar:relaunch` -> pass (port `3000` is free after shutdown).

#### 3) Godot Sidecar Launch Hardening

- **Result**: Pass (pipeline-level)
- **Implemented**:
  - Removed hardcoded absolute Godot path fallback from `src-tauri/src/lib.rs`.
  - Added sidecar preparation/validation scripts:
    - `npm run prepare:godot:bin`
    - `npm run verify:tauri:bin`
- **Verification**:
  - Validation passes when `NOTE_CONNECTION_GODOT_EXE` is provided or sidecar binary exists.

#### 4) Packaging Smoke Evidence (Tauri)

- **Result**: Pass (local packaging environment)
- **Verification**:
  - Ran `npm run tauri:build` (with `NOTE_CONNECTION_GODOT_EXE` set).
  - Bundle artifacts generated under:
    - `src-tauri/target/release/bundle/msi/NoteConnection_1.3.0_x64_en-US.msi`
    - `src-tauri/target/release/bundle/nsis/NoteConnection_1.3.0_x64-setup.exe`

#### 5) Electron Decommission

- **Result**: Pass
- **Implemented**:
  - Removed Electron scripts/dependencies from `package.json`.
  - Updated `main` entry to `dist/src/server.js`.
  - Removed `src/electron/main.ts`, `src/electron/preload.ts`, and `electron-builder.yml`.

#### 6) Mobile Delivery Strategy (Both Paths)

- **Result**: Pass
- **Implemented**:
  - **Capacitor path** retained:
    - `npm run mobile:build:capacitor`
    - `build_apk.bat`
  - **Tauri Android path** added:
    - `npm run tauri:android:init`
    - `npm run tauri:android:dev`
    - `npm run tauri:android:build`
    - `npm run mobile:build:tauri-android`
    - `npm run mobile:build:both`
  - Updated mobile docs with explicit capability boundaries.

### Final Status

- Electron removal checklist: **Completed in repository configuration and runtime architecture**.
- Desktop pipeline: **Tauri-first**.
- Mobile pipeline: **Dual-path enabled (Capacitor + Tauri Android scripts)**.

---

# 2026-03-01 v1.4.6 - Electron to Tauri Migration Readiness Audit

### Objective

Determine whether the Electron -> Tauri migration is currently complete enough to safely remove Electron, including non-core workflows such as export and Android APK packaging via Capacitor.

### Audit Scope

- Desktop runtime architecture (`src/electron`, `src-tauri`, `src/server.ts`, `src/frontend`).
- Input/output flow parity (folder load, build, cache restore, reader/content fetch).
- Export/output paths (`data.js`, `graph_data.json`, JSON/ZIP/SVG exports, APK output).
- Build and packaging surface (`package.json`, `electron-builder.yml`, `build_apk.bat`, `capacitor.config.ts`).
- Migration intent comparison against `docs/tauri_brainstorming.md`.

### Method

- Static code audit with file-level evidence.
- Cross-check against current scripts and config.
- No fresh clean-machine installer validation was executed in this audit section.

### Parity Matrix (Electron Baseline vs Current State)

| Area | Electron Baseline | Current Tauri/Project State | Status |
| --- | --- | --- | --- |
| Desktop shell startup | `src/electron/main.ts` owns shell, menus, IPC | `src-tauri/src/lib.rs` starts Tauri shell and Node sidecar | **Migrated (Dev)** |
| Folder listing under KB root | IPC `getFolders` | Sidecar API `GET /api/folders` plus Tauri fallback `get_folders` | **Migrated** |
| Build trigger and graph generation | IPC `buildGraph` | Sidecar `POST /api/build` with dedupe and runtime path resolution | **Migrated** |
| Cache decision and restore flow | IPC `checkCache` + `restoreCache` | Sidecar APIs + Tauri commands + modal prompt in `source_manager.js` | **Migrated** |
| Tutorial choice behavior | Welcome + tutorial choice | `welcome.js` + `tutorial.js` include skip/session guards | **Migrated** |
| Menu language switch | Electron dynamic menu rebuild | Tauri menu rebuild in `set_user_language` | **Partially Migrated** |
| Persistent KB path + language config | `kb_config.json` in Electron userData | Tauri persists KB path + language + multi-window settings in `app_config.toml` (auto-migrates legacy `kb_config.json`) | **Migrated (v1.6.0+)** |
| Godot process integration | N/A in Electron mainline release path | Tauri currently spawns Godot via hardcoded absolute path, not robust sidecar usage | **Not Fully Migrated** |
| Sidecar/Godot lifecycle shutdown guarantees | Electron app lifecycle owns process lifetime | Tauri code does not implement explicit shutdown management verification for spawned children | **Partially Migrated** |
| Release-ready path model | Electron used app-local protocol and known layout | Tauri sidecar paths are tuned for repo/dev layout (`dist/src/frontend`, `Knowledge_Base`) | **Partially Migrated** |
| Electron package surface removal | Electron scripts/deps removed | Electron remains in `package.json` (`main`, scripts, deps) and `electron-builder.yml` remains active | **Not Migrated** |
| Web export (SVG/JSON/ZIP/layout) | Frontend download-based exports | Same download-based implementation in web frontend (`app.js`, `analysis.js`) | **Migrated** |
| Capacitor APK pipeline | N/A (Electron desktop only) | `build_apk.bat` + `capacitor.config.ts` generate APK using `dist/frontend` | **Migrated (Web Assets)** |
| Mobile parity with desktop build/load from folders | Desktop local filesystem + backend build | Capacitor app has no Node sidecar in-app; APIs like `http://localhost:3000/api/*` are unavailable on-device | **Not Fully Migrated** |
| Tauri Android target from brainstorm plan | Planned (`npm run tauri android build`) | No active Tauri Android scripts/workflow in `package.json` | **Not Migrated** |

### Detailed Findings

#### 1) Migration Successes

- Bridge-first Tauri desktop dev flow is functional: Tauri shell + Node sidecar + Godot bridge + cache/build workflows are implemented.
- Worker path issues that previously broke sidecar `pkg` runtime are addressed through runtime worker path resolution.
- Folder discovery and load/build/cache behavior are available through HTTP sidecar APIs, with Tauri command fallback for selected operations.
- Existing frontend export capabilities (SVG image, layout JSON, analysis JSON/ZIP) are runtime-agnostic and remain available.

#### 2) High-Risk Gaps Before Removing Electron

- **Persistent user configuration parity is now complete (updated 2026-03-25)**:
  - Electron persisted KB path and language in `kb_config.json`.
  - Tauri now persists KB path, language, and multi-window policy in `app_config.toml`, with startup auto-migration from legacy `kb_config.json`.
- **Godot launch path is environment-coupled**:
  - `src-tauri/src/lib.rs` uses hardcoded absolute Windows paths for Godot executable/project.
  - This is not portable across machines or release packaging.
- **Process lifecycle hardening is incomplete**:
  - Sidecar/Godot child process shutdown behavior is not explicitly enforced in code-level teardown logic.
  - This can lead to orphan process or port lock risks.
- **Release-path assumptions remain dev-centric**:
  - Graph artifacts are read/written under `dist/src/frontend`; this is fine in repo dev mode but needs explicit writable-path strategy for packaged installs.

#### 3) Capacitor/Android Specific Risk

- APK build pipeline is present and produces artifact output, but it is a **web-asset packaging path**, not Tauri mobile runtime.
- Core desktop behaviors that depend on local sidecar APIs (`/api/build`, `/api/folders`, `/api/content`) are not inherently available inside a standalone Capacitor app on device.
- Without a mobile-specific backend/file access strategy, folder-based build/load workflows cannot be considered fully migrated for mobile parity.

### Removal Decision (As of 2026-03-01)

- **Can Electron be safely removed now?**: **No (not yet)**.
- **Desktop dev migration status**: **Substantially successful**.
- **Cross-target migration status (Desktop release + Capacitor parity)**: **Incomplete**.

### Risk If Electron Is Removed Immediately

| Risk | Severity | Impact |
| --- | --- | --- |
| Loss of persistent KB path/language parity | High | Users reconfigure repeatedly; startup behavior regression |
| Godot hardcoded path failure on non-dev machines | High | Path Mode desktop renderer fails outside author machine |
| Unverified sidecar teardown | High | Zombie processes, port conflicts, unstable relaunch |
| Packaged runtime path mismatch | High | Graph build/cache I/O may fail in packaged Tauri installs |
| Mobile feature gap (Capacitor without backend parity) | High | Folder build/load/content fetch unavailable on device |
| Mixed build surface (Electron + Tauri in parallel) | Medium | Release confusion, maintenance burden, accidental wrong pipeline |

### Final Assessment

Electron -> Tauri migration is **functionally successful in current desktop development mode**, but **not yet de-risked for full Electron removal** when considering production packaging and mobile parity requirements stated in `docs/tauri_brainstorming.md`.

---

# 2026-03-01 v1.4.5 - Physically-Based Bubbles & Cancel Completion

#### 1. Shader Iridescence & Depth

- **Test**: Code Logic Validation in `bubble_material.gdshader`.
- **Scenario**: Applying Glassner 81-wavelength Thin-Film Interference filtering with noise variation.
- **Previous Behavior**: Uses simple HSV phase-shifted sines which create a plastic, flat rainbow lacking depth.
- **Fixed Behavior**: Implements correct polarization-based physical dispersion, mapping `warpnoise3` to film width (150-700nm), dramatically increasing realism.
- **Status**: **Pass**

#### 2. Cancel Completion UI

- **Test**: Manual usage interaction through bridge protocol.
- **Scenario**: Selecting an already-completed node from the Path Mode.
- **Previous Behavior**: "Mark Complete" remains static; cannot be undone without backend config edits.
- **Fixed Behavior**: "Mark Complete" changes visually to "Cancel Completion". Emits `unmarkComplete` properly and syncs progress UI.
- **Status**: **Pass**

---

## 2026-02-26 v1.4.3 - 9-Rule Tree Layout Engine

#### 1. Spine & Tributaries Layout Calculation

- **Test**: Code Logic Validation in `path_core.js`.
- **Scenario**: Generating layout for a learning path with complex prereqs.
- **Previous Behavior**: Used generic geometric contour placement independent of strict ownership rules.
- **Fixed Behavior**:
  - Engine accurately applies 9-Rule logic (FIFO claiming, Preceding Immunity, Single Appearance, etc.).
  - Nodes calculate correct `x`, `y` based on ownership hierarchy and effective spine indices.
  - Generates strict `{ nodes, edges, hulls }` structure reflecting valid claimed routes.
- **Status**: **Pass**

#### 2. Godot Frontend Visuals

- **Test**: Code Logic Validation in `tree_renderer.gd`
- **Scenario**: Rendering Spine highlighting and Expansion Indicators.
- **Result**:
  - `hasPrereqs` triggers `[+]`/`[-]` badges rendered natively on nodes.
  - Spine nodes render with a dedicated glowing border `StyleBoxFlat`.
  - Double-click toggles accurately emit `node_expand_prereqs_requested` and `node_collapse_prereqs_requested` to the WebSocket bridge.
- **Status**: **Pass**

---

## 2026-01-14 v1.0.0 - Build Modes & KB Path

#### 1. User-Defined KB Path

- **Test**: Manual Verification.
- **Steps**:
  1. Ran `npm start`.
  2. Selected a custom folder in the First Run setup.
  3. Verified legacy `kb_config.json` was created in `AppData` (superseded by `app_config.toml` in v1.6.0+).
  4. Used "File > Reset to Default" and "File > Change Knowledge Base" menus.
- **Result**: Config updates correctly; app reloads and loads the specific folder.
- **Status**: **Pass**

#### 2. Dual Build Modes

- **Test**: Build Verification.
- **Command**: `npm run electron:build` (Full) vs `npm run electron:build:mini` (Mini).
- **Result**:
  - **Full**: Installer size ~270MB. Bundled `data.js` present.
  - **Mini**: Installer size ~200MB. Bundled `data.js` excluded.
- **Status**: **Pass**

#### 3. Installer Cleanup Logic (Mini Mode)

- **Bug**: Installer size appeared bloated (236MB) even in Mini mode because `copy-assets.js` skipped copying but didn't remove existing files from previous Full builds in the `dist` folder.
- **Fix**: Updated `scripts/copy-assets.js` to explicitly delete excluded files from the destination if they exist.
- **Status**: **Fixed**

#### 4. Mini Build First-Run Crash (ERR_UNEXPECTED & CSP Violation)

- **Bug**: After installing mini build and selecting KB folder on first run, app crashed with:
  - `GET app://./data.js net::ERR_UNEXPECTED`
  - `ReferenceError: graphData is not defined`
  - `Executing inline event handler violates CSP 'script-src' directive`
- **Cause**:
  - `index.html` unconditionally loads `data.js`, which doesn't exist in mini builds.
  - Initial fix used inline `onerror` handler, which violated Content Security Policy.
  - `app.js` accessed `graphData` without checking if it was defined, causing `ReferenceError`.
- **Fix**:
  - Removed inline `onerror` handler from `data.js` script tag (CSP compliant).
  - Updated `app.js` to use `typeof graphData !== 'undefined'` to safely check existence.
  - Initialize with empty arrays `[]` for graceful mini build startup.
  - Added diagnostic logging to distinguish "Full Build" vs "Mini Build" startup.
- **Status**: **Fixed**

#### 5. Worker Thread Path Resolution (Double dist/)

- **Bug**: Graph build failed with `Cannot find module 'E:\...\dist\dist\backend\workers\statisticalWorker.js'`.
- **Cause**: `StatisticalAnalyzer.ts` used `.replace('src', 'dist')` which incorrectly transformed paths containing `dist/src` into `dist/dist`.
- **Fix**: Replaced string manipulation with proper `path.join(__dirname, '..', 'workers', 'statisticalWorker.js')` that respects actual directory structure.
- **Status**: **Fixed**

---

## 2026-01-13 v0.9.83 - GPU Worker Integration

#### 1. GPU Acceleration in Worker

- **Test**: Code Logic Verification of `simulationWorker.js`.
- **Scenario**: Graph loading with `npm start --gpu` or "GPU Optimised Rendering" enabled.
- **Previous Behavior**: `simulationWorker.js` relied solely on `d3-force` (CPU), ignoring the GPU flag and libraries. Log showed `Switching layout to: force`.
- **Fixed Behavior**:
  - Worker imports `gpu-browser.min.js` and `layout_gpu.js`.
  - `initSimulation` checks `settings.gpuRendering`.
  - If enabled, uses `gpuManyBody` and `gpuLink` forces.
  - `updateParams` correctly updates existing forces instead of overwriting them.
- **Result**: Worker log confirms `[Worker] Layout Engine: GPU (Accelerated)`. Physics calculations during the initial "relaxation" phase are now GPU-accelerated, significantly speeding up node loading/stabilization.
- **Status**: **Pass**

#### 2. Layout Update Stability

- **Test**: Code Logic Verification of `updateParams` in `simulationWorker.js`.
- **Scenario**: Changing "Repulsion Strength" in settings.
- **Previous Behavior**: `updateParams` replaced the entire "charge" force with a new `d3.forceManyBody()`, destroying any active GPU force.
- **Fixed Behavior**: `updateParams` uses `simulation.force("charge").strength(...)` to update the existing force instance (whether CPU or GPU).
- **Result**: GPU force persists across parameter updates.
- **Status**: **Pass**

---

## 2026-01-12 v0.9.73 - GPU Rendering Fix (Chaining Bug)

#### 1. GPU Force Application

- **Test**: Code Analysis & Manual Verification of `layout_gpu.js`.
- **Scenario**: `strength()` method chaining in D3.
- **Previous Behavior**: `strength()` returned the `GPUManyBodyForce` instance (`this`), causing D3 simulation to ignore the force (silent failure). User reported lag.
- **Fixed Behavior**: `strength()` now returns the function wrapper (`impl`), complying with D3 pattern.
- **Result**: GPU force is correctly registered. `[Physics] Using GPU Optimized Force` confirmed in console. Performance on 10k+ nodes improved.
- **Status**: **Pass**

---

## 2026-01-10 v0.9.71 - Backend Layout, CLI & Optimization

### Test Environment

- **OS**: Windows 10
- **Hardware**: AMD Radeon RX 7900XT, Ryzen 9 7950X
- **Node Version**: v20.x

### Functional Tests (English)

#### 1. Backend Parallel Layout & GPU

- **Goal**: Verify backend calculates positions using GPU/Workers.
- **Procedure**: Run `npm start`. Check logs for `[LayoutEngine]`.
- **Result**: `PASS`. Logs confirm `[LayoutEngine] Spawning layout worker` or `[LayoutEngine] GPU Acceleration enabled`. `graph_data.json` contains `x` and `y` coordinates.

#### 2. Static Mode (Large Graph)

- **Goal**: Verify simulation freezes after 2 seconds for >5000 nodes.
- **Procedure**: Load a graph with 6000 nodes.
- **Result**: `PASS`. Simulation runs for relaxation phase (2s) then log shows `[Simulation] Large graph detected. Freezing simulation`. Nodes stop moving.

#### 3. Extreme Scale Constraints

- **Goal**: Verify edges are not rendered for >10000 nodes.
- **Procedure**: Load a graph with 12000 nodes.
- **Result**: `PASS`. Canvas renderer initializes but edges are skipped in the render loop. Performance remains high.

#### 4. CLI Loading & File Generation

- **Goal**: Verify CLI arguments generate isolated files.
- **Procedure**: Run `npm start -- --path "E:/MyNotes"`.
- **Result**: `PASS`.
  - `data_cli_MyNotes_{time}.js` is created in `src/frontend`.
  - Original `data.js` is untouched.
  - Server logs `[Server] CLI Mode: Serving /data_cli_...js instead of /data.js`.
  - Frontend loads the correct data.

#### 5. GPU Settings Persistence

- **Goal**: Verify "GPU Optimised Rendering" checkbox.
- **Procedure**:
  1.  Open Settings. Check "GPU Optimised Rendering".
  2.  Reload Page.
  3.  Check Settings again.
- **Result**: `PASS`. Checkbox defaults to `true` (updated v0.9.71) and persists state.

### 功能测试 (中文)

#### 1. 后端并行布局与 GPU

- **目标**: 验证后端使用 GPU/Worker 计算位置。
- **步骤**: 运行 `npm start`。检查日志中的 `[LayoutEngine]`。
- **结果**: `通过`。日志确认 `[LayoutEngine] Spawning layout worker` 或 `[LayoutEngine] GPU Acceleration enabled`。`graph_data.json` 包含 `x` 和 `y` 坐标。

#### 2. 静态模式 (大图)

- **目标**: 验证超过 5000 个节点时模拟在 2 秒后冻结。
- **步骤**: 加载包含 6000 个节点的图谱。
- **结果**: `通过`。模拟运行松弛阶段 (2s)，然后日志显示 `[Simulation] Large graph detected. Freezing simulation`。节点停止移动。

#### 3. 极端规模约束

- **目标**: 验证超过 10000 个节点时不渲染边。
- **步骤**: 加载包含 12000 个节点的图谱。
- **结果**: `通过`。Canvas 渲染器初始化，但渲染循环跳过了边。性能保持高效。

#### 4. CLI 加载与文件生成

- **目标**: 验证 CLI 参数生成隔离的文件。
- **步骤**: 运行 `npm start -- --path "E:/MyNotes"`。
- **结果**: `通过`。
  - 在 `src/frontend` 中创建了 `data_cli_MyNotes_{time}.js`。
  - 原始 `data.js` 未被修改。
  - 服务器记录 `[Server] CLI Mode: Serving /data_cli_...js instead of /data.js`。
  - 前端加载了正确的数据。

#### 5. GPU 设置持久化

- **目标**: 验证“GPU 优化渲染”复选框。
- **步骤**:
  1.  打开设置。选中“GPU 优化渲染”。
  2.  重新加载页面。
  3.  再次检查设置。
- **结果**: `通过`。复选框默认为 `true` (v0.9.71 更新) 并保持状态。

### 1. Race Condition Verification

- **Test**: Code Analysis of `src/frontend/app.js`.
- **Scenario**: `ResizeObserver` fires immediately on load.
- **Previous Behavior**: `renderCanvas` calls `isNodeVisible`, which accesses `controls.minDegree`. `controls` is undefined (TDZ). Script crashes.
- **Fixed Behavior**: `controls` is defined at the top. `isNodeVisible` has a safety guard. `renderCanvas` is wrapped in `try-catch`.
- **Result**: Initialization proceeds to completion, attaching all event listeners.
- **Status**: **Pass (Verified via Code Logic)**

---

# 2026-01-09 v0.9.69 - Frontend Crash Fix

### 1. Large Dataset Loading (1.2M Edges)

- **Test**: Code Analysis of `src/frontend/app.js`.
- **Scenario**: `links` array contains 1,206,332 objects.
- **Previous Behavior**: `links.push(...validLinks)` attempts to push 1.2M arguments, causing `RangeError: Maximum call stack size exceeded`. Execution stops, UI shows "Nodes: 0".
- **Fixed Behavior**: `links = validLinks` assigns the reference directly. No stack limit is hit.
- **Result**: Code execution proceeds to `updateStats`, `Canvas` initialization, and `Compact Mode` checks.
- **Status**: **Pass (Verified via Code Logic)**

---

# 2026-01-09 v0.9.68 - Content-on-Demand Architecture

### 1. Data File Optimization

- **Test**: Run `POST /api/build` for `testconcept` dataset.
- **Result**:
  - `graph_data.json` (Full): ~8.0 MB.
  - `data.js` (Lite): ~1.4 MB.
  - Reduction: ~82% for this dataset. Projected >95% for datasets with long content.
- **Status**: **Pass**

### 2. Content Fetching Logic

- **Test**: Code Review of `src/frontend/reader.js`.
- **Observation**:
  - `Reader.open` checks if `node.content` is missing.
  - If missing, it fetches `/api/content?path=...`.
  - Displays "Loading content..." during fetch.
- **Status**: **Pass**

### 3. Server API

- **Test**: Verified `src/server.ts` modifications.
- **Result**:
  - `GET /api/content` endpoint exists.
  - Validates path against `KB_ROOT` (Security check).
  - Returns JSON `{ content: "..." }`.
- **Status**: **Pass**

---

# 2026-06-01 v1.0.0 - Production Release Verification

### 1. Smoke Test (Core Logic)

- **Test**: Run `scripts/smoke_test.ts`.
- **Scenario**:
  - File A: `next: [[Concept B]]`
  - File B: Content mentions "Concept C"
  - File C: Plain text
- **Result**:
  - Graph built successfully with 3 nodes.
  - Edge A -> B detected (Explicit).
  - Edge C -> B detected (Keyword: Concept -> Context).
  - Inference engines ran without error.
- **Status**: **Pass**

### 2. Performance & Stability

- **Test**: Memory optimization checks (v0.9.57/58).
- **Result**:
  - Heap usage remains stable during Hybrid Inference.
  - Worker threads process data without cloning content.
  - Shared resources are correctly cleaned up.
- **Status**: **Pass**

### 3. Versioning

- **Test**: Check UI and Metadata.
- **Result**:
  - `package.json` version is 1.0.0.
  - Frontend UI displays `v1.0.0` in controls panel.
- **Status**: **Pass**

---

# 2026-01-08 v0.9.67 - Compact Mode & Canvas Fix

### Test Scenario: Large Graph Loading (10k+ Nodes)

**Objective**: Verify that graphs with >10,000 nodes load correctly without blank screens and default to "Compact Mode".

**Steps**:

1. Load a dataset with >5,000 nodes (or mock the data).
2. Observe the initial rendering state.
3. Check the "Settings" > "Performance" panel.
4. Hover over a node.

**Expected Results**:

- [x] **Auto-Switch**: Renderer automatically switches to "Canvas".
- [x] **Compact Mode**: "Compact Mode" checkbox in Settings is checked automatically.
- [x] **Visuals**: Nodes are visible immediately (no blank screen). Edges are NOT visible by default.
- [x] **Interaction**: Hovering a node temporarily shows its connected edges (highlighting works), then hides them again on mouseout.

### Test Scenario: Manual Toggle

**Objective**: Verify user can toggle Compact Mode.

**Steps**:

1. Open Settings.
2. Uncheck "Compact Mode".
3. Close Settings.

**Expected Results**:

- [x] **Rendering**: Edges appear (if opacity > 0).
- [x] **Performance**: Frame rate may drop significantly for 1.2M edges (expected).

---

# 2026-01-07 v0.9.61 - Frontend Memory Optimization (Auto-Canvas)

### 1. Auto-Switch Logic

- **Test**: Code verification in `src/frontend/app.js`.
- **Conditions**: Simulate `nodes.length = 3001`.
- **Observation**:
  - Console logs `[Optimization] Large graph detected...`.
  - `canvasRadio.checked` becomes true.
  - `svgEl.style.display` set to `none`.
  - `canvasEl.style.display` set to `block`.
- **Result**: Logic correctly switches renderer based on node count.
- **Status**: **Pass (Verified via Code Logic)**

---

# 2026-01-07 v0.9.60 - Parallel Graph Metrics

### 1. Parallel Execution Verification

- **Test**: Run `npx ts-node src/backend/test_robustness/test_metrics_parallel.ts`.
- **Conditions**: Dataset with 513 nodes (threshold > 500).
- **Result**:
  - Console log confirmed parallel execution: `[GraphMetrics] Starting Parallel Betweenness Centrality with 4 workers...`.
  - Centrality values were correctly calculated (non-zero for central nodes).
  - Execution completed without error.
- **Status**: **Pass**

### 2. Integration Check

- **Action**: Review `GraphBuilder.ts`.
- **Observation**: `GraphMetrics.calculateBetweennessAsync` is awaited properly in the pipeline.
- **Status**: **Pass**

---

# 2026-01-07 v0.9.59 - Memory Optimization Verification

**Test Goal**: Verify that the "Heap out of memory" error is resolved by the Sparse Vector implementation and that the graph building pipeline functions correctly.

**Test Environment**:

- **OS**: Windows 10
- **Dataset**: `testconcept` (513 files)
- **Configuration**: GPU Enabled (auto-detected), Max Workers: 15

**Test Steps**:

1.  **Unit Test**: Verified `VectorSpace` logic with `scripts/verify_vector_sparse.ts`.
    - **Result**: Sparse vectors created correctly (Uint32Array/Float32Array). Similarity calculation returned expected results with new IDF logic.
2.  **Integration Test**: Ran full build via `src/index.ts testconcept`.
    - **Result**: Build completed successfully.
    - **Memory**: Heap usage remained stable around 270MB (peak 450MB RSS).
    - **Components Verified**:
      - `VectorSpace` (Sparse construction)
      - `VectorSpaceGPU` (Sparse -> Dense conversion fallback)
      - `HybridEngine` (Sparse Dot Product)
      - `StatisticalAnalyzer` (Shared Matrix reuse)
3.  **Robustness**: Checked behavior with 513 files, detecting 100+ cycles (handled by limit).
4.  **API Validation**: Triggered build via `POST /api/build` on running server.
    - **Result**: Success. Server remained stable, and graph was generated correctly.

**Conclusion**: The system is now robust against OOM errors for large datasets (projected 13k+ files) due to significant memory reduction (>95% for vectors) and increased heap limit (12GB).

---

# 2026-01-07 v0.9.58 - Hybrid Inference Resource Reuse

### 1. Memory Usage Analysis

- **Action**: Simulate `GraphBuilder` logic with `HybridInference` enabled.
- **Observation**:
  - `StatisticalAnalyzer.analyzeAsync` is called only ONCE.
  - The returned `matrix` is stored in `sharedStatsMatrix`.
  - `HybridEngine.infer` reuses `sharedStatsMatrix` without re-running the expensive analysis.
- **Result**: Expected memory savings realized (avoiding 2x allocation of the large matrix).
- **Status**: **Pass (Verified via Code Logic)**

### 2. Resource Cleanup

- **Action**: Verify cleanup steps in `GraphBuilder.ts`.
- **Observation**:
  - `sharedStatsMatrix.clear()` and `sharedVectorSpace.destroy()` are called explicitly at the end of the `build` method.
  - References are nullified to allow GC.
- **Status**: **Pass (Verified via Code Logic)**

---

# 2026-01-07 v0.9.57 - Worker Memory Optimization

### 1. Data Transfer Logic

- **Action**: Review `src/backend/algorithms/StatisticalAnalyzer.ts` and `statisticalWorker.ts`.
- **Result**:
  - Main thread extracts file paths (`f.filepath`).
  - Worker receives `filePaths` and uses `fs.readFileSync`.
  - No cloning of `file.content` observed in message passing.
- **Status**: **Pass**

---

# 2026-01-05 v0.9.56 - Hybrid Inference Memory Analysis

### 1. Granular Logging

- **Action**: Review `src/backend/algorithms/HybridEngine.ts`.
- **Result**:
  - Code includes `processedCount % 1000` check.
  - Logs current Heap usage to console.
- **Status**: **Pass**

### 2. Memory Cleanup

- **Action**: Review `src/backend/GraphBuilder.ts`.
- **Result**:
  - `matrix.clear()` is called immediately after inference.
  - `vectorSpace` is nullified.
  - Logging verifies cleanup step.
- **Status**: **Pass**

---

# 2026-01-05 v0.9.55 - Heap OOM Fix & Iterative DFS

### 1. Iterative Cycle Detection

- **Test**: Run `npm test src/backend/algorithms/CycleDetection.test.ts`.
- **Result**:
  - Iterative implementation passes all existing logic tests.
  - No stack overflow risk for deep graphs.
- **Status**: **Pass**

### 2. Memory Optimization

- **Action**: Review `GraphBuilder.ts`.
- **Observation**:
  - `fileMap.clear()` is called before `Algorithmic Core` to release file content memory.
  - Logging is granular to track execution steps.
- **Status**: **Pass**

---

# 2026-01-05 v0.9.52 - Cycle Detection Memory Optimization

### 1. Cycle Limit Enforcement

- **Test**: Run `npm test src/backend/algorithms/CycleDetection.test.ts`.
- **Result**:
  - `detectCycles(graph, 1)` correctly returns 1 cycle even if more exist.
  - `detectCycles(graph, 100)` correctly limits the output.
  - `detectCycles(graph)` (no limit) finds all cycles.
- **Status**: **Pass**

### 2. Graph Build Integration

- **Action**: Review `GraphBuilder.ts`.
- **Observation**:
  - `CycleDetector.detectCycles` is called with a limit of 100.
  - Double invocation (`hasCycle` + `detectCycles`) is removed.
  - Warning message logic handles the limited count correctly ("100+").
- **Status**: **Pass**

---

# 2026-01-03 v0.9.51 - Performance Logging & Crash Reporting

### Test Report: Performance Logging

### 1. System Info Logging

- **Action**: Run `npm run build`.
- **Result**:
  - Code compiles.
  - `PerformanceLogger` is integrated.
- **Status**: **Pass**

### 2. Step Timing & Resource Tracking

- **Test**: Code Review of `GraphBuilder.ts`.
- **Observation**:
  - `PerformanceLogger.start/end` wraps all major steps: "Node Initialization", "Edge Identification", "Keyword Matching", "Inference", etc.
  - Output format includes Time, CPU, and Memory usage as requested.
- **Status**: **Pass**

### 3. GPU Tracking

- **Test**: Code Review of `VectorSpaceGPU.ts`.
- **Observation**:
  - `PerformanceLogger` wraps the GPU kernel execution.
  - Logs matrix size and execution time.
- **Status**: **Pass**

### Test Report: Crash Reporting

### 1. Global Handler Initialization

- **Action**: Start server.
- **Observation**: `CrashLogger.initGlobalHandlers()` is called in `server.ts`.
- **Status**: **Pass**

### 2. Worker Error Capture

- **Test**: Code Review of Workers (`keywordMatchWorker.ts`, `statisticalWorker.ts`).
- **Observation**:
  - Main logic is wrapped in `try...catch`.
  - `CrashLogger.log()` writes to `crash.log` on error.
  - `process.exit(1)` ensures worker terminates properly after logging.
- **Status**: **Pass**

---

# 2026-01-02 v0.9.50 - GPU Acceleration

### 1. Module Integration

- **Action**: Run `npm run build`.
- **Result**:
  - Build succeeds without errors.
  - `amdgpu` folder is compiled to `dist/amdgpu`.
  - `VectorSpaceGPU` is correctly instantiated in `GraphBuilder`.
- **Status**: **Pass**

### 2. Fallback Mechanism

- **Test**: (Simulated) GPU initialization fails.
- **Result**:
  - `VectorSpaceGPU` catches the error.
  - `similarityMatrix` remains null.
  - `getSimilar` calls fall back to `super.getSimilar` (CPU).
  - Application continues without crashing.
- **Status**: **Pass**

---

# 2026-01-02 v0.9.49 - UI Controls for Parallel Processing

### 1. Settings UI

- **Action**: Open Settings Modal.
- **Observation**:
  - New "Performance" group is visible.
  - "Max Workers" slider and input are present.
  - Default value is 4.
- **Status**: **Pass**

### 2. Synchronization & Persistence

- **Action**:
  1.  Slide "Max Workers" to 8. Input updates to 8.
  2.  Type 12 into Input. Slider updates to 12.
  3.  Reload page. Open Settings.
  4.  Value remains 12.
- **Status**: **Pass**

### 3. API Integration

- **Action**: Open Network tab. Click "Load" on a folder.
- **Observation**:
  - POST request to `/api/build` includes `maxWorkers: 12` in the payload.
- **Status**: **Pass**

---

# 2026-01-02 v0.9.48 - Parallel Workers Configuration

### 1. Max Workers Configuration

- **Action**: Set `config.maxWorkers` to 50 in a test script and trigger graph build.
- **Observation**:
  - Console log shows `[GraphBuilder] Spawning 50 workers...`.
  - Parallel matching proceeds with 50 worker threads.
- **Status**: **Pass**

---

# 2026-01-02 v0.9.47 - Focus Mode Interaction & Layout

### 1. Double Click Zoom Prevention

- **Action**: Double click a node to enter Focus Mode.
- **Result**:
  - Focus Mode activates.
  - The window (viewport) zoom level remains unchanged.
  - The view centers on the node, but does not zoom in/out (unless centering animation implies scale, but double-click zoom event is suppressed).
- **Status**: **Pass**

### 2. Vertical Layout Label Spacing

- **Action**: Enter Focus Mode. Select "Vertical" layout.
- **Result**:
  - Nodes arrange in a vertical column.
  - Text labels are positioned to the right of the nodes with increased spacing (dx=35).
  - Text does not overlap with the node body or adjacent nodes.
- **Status**: **Pass**

### 3. Canvas Mode Verification

- **Pre-condition**: Switch renderer to "Canvas".
- **Action**: Double click a node.
- **Result**: Enters Focus Mode without zooming.
- **Action**: Select "Vertical" layout.
- **Result**: Labels are offset by 35px, avoiding overlap.
- **Status**: **Pass**

---

# 2025-12-26 v0.9.46 - Focus Mode UI & Visuals

### 1. UI Hiding

- **Action**: Enter Focus Mode (Double Click).
- **Observation**:
  - Top-left "Source Select" and "Load" button disappear.
  - Left-side "NoteConnection" control panel disappears.
  - Only the Focus Mode exit bar is visible at the bottom.
- **Action**: Exit Focus Mode.
- **Result**:
  - All controls reappear.
  - (On Mobile): Verify source select does NOT appear if it wasn't visible before (respected via CSS).
- **Status**: **Pass**

### 2. Canvas Edge Suppression

- **Pre-condition**: Switch to "Canvas" Renderer.
- **Action**: Enter Focus Mode.
- **Observation**:
  - Nodes arrange in hierarchy.
  - **No lines (edges)** are visible connecting the nodes.
- **Status**: **Pass**

---

# 2025-12-26 v0.9.45 - Canvas Interactivity & Cleanup

### 1. Canvas Hover & Click

- **Pre-condition**: Switch to "Canvas" Renderer.
- **Action**: Hover over a node.
- **Result**: Node highlights, connections appear (Red/Blue), cursor changes to pointer.
- **Action**: Single Click a node.
- **Result**: Simulation freezes, Statistics Popup opens.
- **Action**: Double Click a node.
- **Result**: Enters Focus Mode.
- **Status**: **Pass**

### 2. Node Sizing

- **Action**: Switch "Size By" to "Degree".
- **Result**: High-degree nodes appear larger in Canvas mode, matching SVG proportions.
- **Action**: Switch "Size By" to "Uniform".
- **Result**: All nodes appear small (r=5).
- **Status**: **Pass**

### 3. Cleanup

- **Observation**: "View Mode" (Nodes/Clusters) radio buttons are gone from the UI.
- **Status**: **Pass**

---

# 2025-12-26 v0.9.44 - Independent Focus Mode Spacing

### 1. Default Values

- **Action**: Enter Focus Mode. Select "Horizontal" layout.
- **Result**: "Layer-Space" slider is at 125 (or approx 1/2 of max).
- **Action**: Select "Vertical" layout.
- **Result**: "Node-Space" slider is at 20 (or approx 1/4 of max). "Layer-Space" is at 250.
- **Status**: **Pass**

### 2. Independent Persistence

- **Action**:
  1.  In "Horizontal" mode, set Layer-Space to 200.
  2.  Switch to "Vertical". Slider updates to 250 (default).
  3.  Set Vertical Layer-Space to 300.
  4.  Switch back to "Horizontal". Slider reverts to 200.
- **Result**: Settings are preserved independently for each layout type.
- **Status**: **Pass**

---

# 2025-12-26 v0.9.43 - Context-Aware Settings UI

### 1. Label Switching

- **Action**: Select "Force" Layout. Open Settings.
- **Result**: Label shows "Repulsion (Force)".
- **Action**: Close Settings. Select "DAG" Layout. Open Settings.
- **Result**: Label shows "Repulsion (DAG)".
- **Status**: **Pass**

---

# 2025-12-26 v0.9.42 - Distinct Repulsion Settings

### 1. Default Values

- **Action**: Clear `localStorage` and reload. Check Settings in "Force" mode.
- **Result**: Repulsion shows -550.
- **Action**: Switch to "DAG" mode. Open Settings.
- **Result**: Repulsion shows -850.
- **Status**: **Pass**

### 2. Independent Configuration

- **Action**:
  1.  In "Force" mode, set Repulsion to -200.
  2.  Switch to "DAG" mode. Check Settings -> Should be -850 (default).
  3.  Set DAG Repulsion to -900.
  4.  Switch back to "Force". Check Settings -> Should be -200.
- **Result**: Values persist independently.
- **Status**: **Pass**

---

# 2025-12-26 v0.9.41 - Settings Modal Simulation Freeze

### 1. Auto-Freeze on Open

- **Action**: Ensure "Freeze Layout" is unchecked and simulation is running (nodes moving). Click "Settings" button.
- **Observation**:
  - Settings modal opens.
  - Background nodes stop moving immediately (`simulation.stop()` triggered).
  - CPU usage drops.
- **Status**: **Pass**

### 2. Resume on Close

- **Action**: Close the Settings modal (via X or background click).
- **Result**:
  - Simulation restarts automatically.
  - Nodes resume movement.
- **Status**: **Pass**

### 3. Interaction with Global Freeze

- **Pre-condition**: Check "Freeze Layout". Open Settings.
- **Action**: Close Settings.
- **Result**:
  - Simulation remains stopped (respects global freeze).
- **Status**: **Pass**

---

# 2025-12-26 v0.9.40 - Freeze Layout Priority (Settings Modal)

### 1. Settings Change with Freeze

- **Pre-condition**: Enable "Freeze Layout". Ensure nodes are stationary. Open "Settings" modal.
- **Action**: Change "Repulsion" slider value significantly.
- **Observation**:
  - Nodes do **NOT** move or jitter.
  - Simulation remains stopped.
- **Action**: Change "Edge Opacity" slider.
- **Observation**:
  - Edges fade in/out immediately (Visual update works).
  - Nodes remain stationary.
- **Status**: **Pass**

### 2. Unfreeze Physics Application

- **Action**: Close modal. Uncheck "Freeze Layout".
- **Result**:
  - Simulation restarts.
  - Nodes move to new positions reflecting the updated Repulsion strength (e.g., spreading out more if repulsion increased).
- **Status**: **Pass**

---

# 2025-12-26 v0.9.39 - Layout Switch Relaxation & Freeze

### 1. Layout Switch Relaxation

- **Action**: Switch from "Force" to "DAG" layout (ensure DAG wasn't cached/visited recently).
- **Observation**:
  - Nodes move rapidly (low friction) to form the DAG structure.
  - After ~2 seconds, movement slows down as friction increases to 0.95.
- **Status**: **Pass**

### 2. Delayed Freeze on Switch

- **Pre-condition**: Enable "Freeze Layout".
- **Action**: Switch Layout Mode (e.g., Force -> DAG).
- **Result**:
  - Simulation starts and runs visibly for 2 seconds (Relaxation Phase).
  - Nodes arrange into the new layout.
  - After 2 seconds, simulation stops completely (Nodes freeze).
  - "Freeze Layout" checkbox remains checked.
- **Status**: **Pass**

---

# 2025-12-26 v0.9.38 - Quick Start Guide HTML Rendering

### 1. HTML Tag Rendering

- **Pre-condition**: Switch language to Chinese (where `<br>` tags are present).
- **Action**: Open "Quick Start Guide" (Help button).
- **Observation**:
  - Line breaks `<br>` are rendered as actual new lines, not text.
  - Bold tags `<strong>` are rendered as bold text.
- **Status**: **Pass**

---

# 2025-12-26 v0.9.37 - Rapid Relaxation Strategy

### 1. Initialization Behavior

- **Action**: Reload the page.
- **Observation**:
  - Nodes move rapidly initially (expanding outward).
  - Check console `simulation.velocityDecay()` within first 2s -> Should be roughly 0.2.
- **Status**: **Pass**

### 2. Stabilization Transition

- **Action**: Wait 2 seconds after reload.
- **Observation**:
  - Movement slows down noticeably as friction increases.
  - "Speed" Slider UI snaps to 0.95 position.
  - Check console `simulation.velocityDecay()` -> Should be 0.95.
- **Status**: **Pass**

### 3. Manual Override

- **Action**: Reload page, immediately drag Speed Slider to 0.5 (within 1s).
- **Observation**:
  - Wait 3 seconds.
  - Slider remains at 0.5.
  - Simulation friction stays at 0.5 (does not force 0.95).
- **Status**: **Pass**

---

# 2025-12-26 v0.9.36 - Freeze Layout Priority Fix

### 1. Visual Settings Change with Freeze

- **Pre-condition**: Enable "Freeze Layout". Ensure nodes are stationary.
- **Action**: Change "Size By" from "Uniform" to "Degree".
- **Observation**:
  - Node circles visibly change size (larger for high degree).
  - Nodes do **NOT** move or jitter.
  - Simulation remains stopped (0 CPU usage).
- **Status**: **Pass**

### 2. Unfreeze Behavior

- **Action**: Uncheck "Freeze Layout".
- **Result**:
  - Simulation restarts.
  - Nodes adjust position based on new sizes (collision radius updated in background).
- **Status**: **Pass**

---

# 2025-12-26 v0.9.35 - Viewport Culling Relaxation

### 1. Extended Zoom Threshold

- **Action**: Zoom out slowly from 1.0x.
- **Observation**:
  - At 0.4x (previous limit), simulation CONTINUES running.
  - Continue zooming out.
  - Simulation stops only when scale drops below 0.1x.
- **Status**: **Pass**

### 2. Smooth Panning Buffer

- **Action**: Zoom in (scale ~2.0). Pan rapidly to the side.
- **Observation**:
  - Nodes entering the viewport are already in motion or settled correctly (not frozen in "mid-air").
  - No "pop-in" effect where nodes suddenly wake up after entering the screen.
  - The 800px buffer ensures seamless transition.
- **Status**: **Pass**

---

# 2025-12-26 v0.9.34 - Global Layout Update Fix

### 1. Layout Switching with Culling

- **Pre-condition**:
  1.  Zoom in significantly (Scale > 2) so that >50% of nodes are off-screen.
  2.  Verify off-screen nodes are culled (check via console `isCulled=true` or simulation CPU drop).
- **Action**: Switch Layout Mode (e.g., Force -> DAG).
- **Result**:
  - All nodes (including previously off-screen ones) immediately start moving to their new positions.
  - Zooming out reveals the graph has fully rearranged according to the new layout (DAG layers).
  - Nodes are NOT stuck in their previous positions.
- **Status**: **Pass**

---

# 2025-12-26 v0.9.33 - Layout State Caching

### 1. State Preservation

- **Action**:
  1.  Start in Force Layout. Drag a node (Node A) to a specific spot.
  2.  Switch to DAG Layout. Wait for it to arrange.
  3.  Switch back to Force Layout.
- **Result**:
  - Node A reappears exactly where it was left in step 1.
  - No animation/movement occurs (Instant Switch).
  - Simulation is stopped (or minimal alpha) to preserve state.
- **Status**: **Pass**

### 2. Independent States

- **Action**:
  1.  In DAG mode, drag Node B.
  2.  Switch to Force.
  3.  Switch back to DAG.
- **Result**: Node B is at the new dragged position in DAG mode.
- **Status**: **Pass**

---

# 2025-12-26 v0.9.32 - High Damping & Render Optimization

### 1. Damping Behavior

- **Test**: Reload the page.
- **Observation**:
  - Nodes settle into position significantly faster than before.
  - Movement stops almost immediately after drag release.
  - Slider shows "0.92".
- **Status**: **Pass**

### 2. Render Culling

- **Test**: Zoom in to a small area (scale > 2).
- **Action**: Pan the view.
- **Result**:
  - Performance (FPS) feels smooth.
  - Nodes entering the view snap to correct positions (logic works).
  - Verify code: `ticked` uses `.filter(d => !d.isCulled)` - Confirmed.
- **Status**: **Pass**

---

# 2025-12-26 v0.9.31 - Simulation Optimization (Viewport Culling)

### 1. Full View Freeze

- **Action**: Zoom out until the graph is small (scale < 0.4).
- **Result**:
  - Simulation stops automatically (CPU usage drops).
  - Nodes freeze in place.
- **Status**: **Pass**

### 2. Off-screen Freezing

- **Action**: Zoom in to a specific area.
- **Result**:
  - Nodes within the visible area (and immediate buffer) continue to move/settle.
  - Nodes far outside the viewport are frozen (fixed position).
  - Pan to a new area -> Previously frozen nodes wake up and start moving.
- **Status**: **Pass**

---

# 2025-12-26 v0.9.30 - Focus Mode Layout Isolation

### 1. Position Restoration

- **Pre-condition**: Identify the position of a specific node (Node A).
- **Action**:
  1.  Double click Node A to enter Focus Mode.
  2.  Observe Node A moves to the center.
  3.  Drag Node A to a new position.
  4.  Click "Exit Focus Mode".
- **Result**:
  - Node A snaps back to its original position (before step 1).
  - The graph layout is identical to the pre-focus state.
- **Status**: **Pass**

### 2. Layout Consistency with Simulation

- **Action**:
  1.  Wait for simulation to settle (or freeze layout).
  2.  Enter Focus Mode.
  3.  Exit Focus Mode.
- **Result**: No significant movement or "explosion" of nodes occurs upon exit. The visual state is preserved.
- **Status**: **Pass**

---

# 2025-12-26 v0.9.29 - Freeze Layout Persistence (Analysis & Resize)

### 1. Analysis Panel Interaction

- **Pre-condition**: Enable "Freeze Layout". Ensure nodes are stationary.
- **Action**: Click "Analysis & Export" button.
- **Observation**:
  - Analysis Panel opens (changing the graph container size).
  - Nodes do **NOT** move or jitter.
  - Simulation remains stopped.
- **Status**: **Pass**

### 2. Window Resize Interaction

- **Pre-condition**: Enable "Freeze Layout".
- **Action**: Resize the browser window.
- **Observation**:
  - Graph container resizes.
  - Nodes maintain their relative positions (Simulation does not restart).
  - Canvas (if active) redraws correctly at new resolution.
- **Status**: **Pass**

---

# 2025-12-26 v0.9.28 - Focus Mode Specific Content Button

### 1. Button Visibility

- **Pre-condition**: Double click a node to enter Focus Mode.
- **Observation**: A new button "Specific Content" is visible in the bottom control panel (`#focus-exit-btn`), placed before the "Exit" button.
- **Status**: **Pass**

### 2. Functional Interaction

- **Action**: Click the "Specific Content" button.
- **Result**:
  - The Reading Window opens displaying the content of the currently focused node.
  - The behavior matches exactly that of double-clicking the focused node.
- **Status**: **Pass**

### 3. Localization

- **Test**: Switch language to Chinese. Enter Focus Mode.
- **Result**: Button label shows "打开具体内容".
- **Status**: **Pass**

---

# 2025-12-26 v0.9.27 - Conditional Restart

### 1. Exit Focus with Freeze Enabled

- **Pre-condition**: Enable "Freeze Layout". Double click a node to enter Focus Mode.
- **Action**: Click "Exit Focus Mode".
- **Result**:
  - The graph returns to the global view.
  - Nodes do **NOT** move (Simulation remains stopped).
  - The visual layout is static (might look like the focus grid or a mix, but it is frozen as requested).
- **Status**: **Pass**

### 2. Resume after Exit

- **Action**: Uncheck "Freeze Layout".
- **Result**: The simulation restarts, and nodes move back to their force-directed positions.
- **Status**: **Pass**

---

# 2025-12-26 v0.9.26 - UX Enhancements & Quick Start

### 1. Freeze Layout Quick Button

- **Test**: Click the snowflake (❄️) button in the top-right corner.
- **Result**:
  - Button background turns Red.
  - "Freeze Layout" checkbox in the Simulation panel becomes checked.
  - Simulation stops and node dragging is disabled (per v0.9.25 logic).
- **Test**: Click the button again.
- **Result**:
  - Button background reverts to dark gray.
  - Checkbox becomes unchecked.
  - Simulation resumes.
- **Test**: Manually check/uncheck the checkbox in the panel.
- **Result**: The quick button visual state updates to match the checkbox.
- **Status**: **Pass**

### 2. Quick Start Manual (Onboarding)

- **Test**: Clear `localStorage.removeItem('noteconnection_manual_seen')` and reload.
- **Result**: The "Quick Start Guide" modal appears automatically after a short delay.
- **Test**: Click "Don't show again" and close the modal. Reload the page.
- **Result**: The modal does NOT appear automatically.
- **Status**: **Pass**

### 3. Help Button Access

- **Test**: Click the "Help" (❓) button.
- **Result**: The Quick Start Guide modal opens immediately.
- **Status**: **Pass**

### 4. Localization

- **Test**: Switch language to Chinese.
- **Result**:
  - Quick Button tooltip/label (if visible) shows Chinese.
  - Manual title becomes "快速开始指南".
  - All manual steps and descriptions are in Chinese.
- **Status**: **Pass**

---

# 2025-12-25 v0.9.25 - Freeze Layout Optimization

### 1. Main Interface Frozen State

- **Test**: Enable "Freeze Layout" checkbox in the Simulation panel.
- **Action**: Attempt to drag any node in the main graph (SVG Mode).
- **Result**:
  - Node does NOT move.
  - Simulation does NOT restart (no CPU spike).
  - Drag cursor interaction is effectively suppressed.
- **Status**: **Pass**

### 2. Focus Mode Interaction (Exemption)

- **Test**: While "Freeze Layout" is enabled, enter Focus Mode (Double Click).
- **Action**: Attempt to drag the focused node or its neighbors.
- **Result**:
  - Node moves with the mouse (Drag works).
  - Layout settles after drag (Simulation works for the active subset).
  - This confirms the global freeze does not hinder focused exploration.
- **Status**: **Pass**

---

# 2025-12-25 v0.9.24 - Focus Mode Memory Optimization

### 1. Simulation Subsetting (Optimization)

- **Test**: Enter Focus Mode (Double Click).
- **Observation**:
  - Focused nodes rearrange smoothly.
  - Background nodes (if visible/dimmed) do NOT move or drift, even if simulation is running.
  - CPU usage (observable via browser dev tools) should be lower compared to previous versions during Focus Mode interaction.
- **Result**:
  - `simulation.nodes()` length equals the number of focused+neighbor nodes.
  - Original state preserved.
- **Status**: **Pass**

### 2. State Restoration

- **Test**: Exit Focus Mode.
- **Observation**:
  - Background nodes instantly reappear/reactivate in their EXACT original positions.
  - Simulation resumes for the entire graph.
  - No "explosion" or resetting of the entire graph layout occurs.
- **Status**: **Pass**

---

# 2025-12-25 v0.9.23 - Default Settings Adjustment

### 1. Reading Window Font Size

- **Test**: Open the Reading Window by clicking a node (after double-clicking to focus, or if focusing opens reader).
- **Result**:
  - The font size of the content is small (0.5rem).
  - Zoom controls work to increase size.
- **Status**: **Pass**

### 2. Simulation Damping

- **Test**: Reload the page. Check the "Speed (Damping)" slider value.
- **Result**: Slider shows "0.6" and handle is at 0.6 position.
- **Test**: Observe graph movement.
- **Result**: Nodes settle slightly faster than before (higher damping/friction).
- **Status**: **Pass**

---

# 2025-12-25 v0.9.22 - Mobile Popup Adaptation

### 1. Touch Drag Interaction

- **Test**: Open the application in mobile view (or device simulation). Click a node to open the popup.
- **Action**: Touch and hold the popup header (title bar) with one finger and move.
- **Result**:
  - The popup follows the finger movement smoothly.
  - The page background does NOT scroll while dragging the popup.
  - `dragging` class is added during interaction.
- **Status**: **Pass**

### 2. Pinch-to-Zoom Interaction

- **Test**: Open the popup on a touch device.
- **Action**: Place two fingers on the popup content and spread them apart (pinch out).
- **Result**:
  - The text size inside the popup increases.
  - The scale is clamped at maximum 2.0x.
- **Action**: Pinch two fingers together (pinch in).
- **Result**:
  - The text size decreases.
  - The scale is clamped at minimum 0.5x.
- **Status**: **Pass**

### 3. Interaction Conflict Prevention

- **Test**: Try to drag the popup by touching the content area (not the header).
- **Result**: The popup does NOT move (Drag is restricted to header).
- **Test**: Try to pinch zoom while dragging the header.
- **Result**: Pinch logic requires 2 fingers on the popup; drag logic requires 1 finger on the header. Logic separation holds.
- **Status**: **Pass**

---

# 2025-12-25 v0.9.21 - Strict Edge Visibility & Optimization

### 1. Default Edge Visibility (SVG)

- **Test**: Load the graph in SVG Mode.
- **Result**:
  - No edges are visible by default (Opacity: 0).
  - Graph appears cleaner with only nodes visible.
- **Status**: **Pass**

### 2. Interaction Visibility (SVG)

- **Test**: Hover over a node (PC) or click a node (Mobile/PC).
- **Result**:
  - Edges connected to the target node immediately become visible.
  - Incoming edges are Red, Outgoing are Blue.
- **Test**: Move mouse away or click background.
- **Result**: Edges revert to invisible (Opacity: 0).
- **Status**: **Pass**

### 3. Canvas Consistency

- **Test**: Switch to Canvas Mode.
- **Result**: Edges remain hidden by default, matching SVG behavior.
- **Status**: **Pass**

---

# 2025-12-24 v0.9.18 - Node Highlighting System Refactor

### 1. NodeHighlightManager Module Loading

- **Test**: Open browser developer console and check for JavaScript errors during page load.
- **Result**: No errors. `window.NodeHighlightManager` and `window.createNodeHighlightManager` are defined.
- **Status**: **Pass**

### 2. PC Hover Interaction (Non-Frozen)

- **Test**: Hover mouse over a node without clicking.
- **Result**:
  - Node and connected nodes remain at full opacity (1.0).
  - Unconnected nodes dim to 0.05 opacity.
  - Outgoing edges turn Blue (#4488ff) with 2.5px width.
  - Incoming edges turn Red (#ff6b6b) with 2.5px width.
  - Tooltip appears with node statistics.
- **Test**: Move mouse away from node.
- **Result**: Highlighting clears, all nodes and edges return to default visibility.
- **Status**: **Pass**

### 3. Mobile Click Interaction (Frozen)

- **Test**: Single click on a node.
- **Result**:
  - Simulation stops (all nodes freeze).
  - Node highlighting applied (same visual as hover).
  - Statistics popup appears showing In/Out degree counts and neighbor lists.
- **Test**: Click background (SVG area).
- **Result**:
  - Highlight clears.
  - Statistics popup closes.
  - Simulation resumes (nodes start moving).
- **Status**: **Pass**

### 4. Double Click Focus Mode Entry

- **Test**: Double click on a node.
- **Result**:
  - Focus Mode activates.
  - Node arranges with inbound/outbound neighbors.
  - Semantic labels appear ("Helping to understand", "Further exploration").
  - highlightManager properly disables during focus mode.
- **Status**: **Pass**

### 5. Focus Mode State Awareness

- **Test**: While in Focus Mode, hover over a neighbor node.
- **Result**: No hover highlighting occurs (Focus Mode handles its own visualization).
- **Test**: Exit Focus Mode, then hover over the same node.
- **Result**: Normal hover highlighting resumes.
- **Status**: **Pass**

### 6. Canvas Mode Rendering

- **Test**: Switch to Canvas renderer, hover over a node.
- **Result**:
  - Visual effects match SVG mode (Blue/Red edges, dimmed unconnected nodes).
  - Performance remains smooth even with highlighting active.
- **Test**: Click a node in Canvas mode.
- **Result**: Same freeze behavior as SVG mode.
- **Status**: **Pass**

### 7. Analysis Panel Integration

- **Test**: Open Analysis Panel, click a node row in the table.
- **Result**:
  - Graph highlights the node using highlightManager.
  - Tooltip appears at node position.
  - No simulation freeze (freeze=false parameter used).
- **Status**: **Pass**

### 8. Background Click Clearing

- **Test**: Click a node to freeze highlight, then click SVG background.
- **Result**:
  - Highlight clears completely.
  - Statistics popup closes.
  - Simulation resumes.
- **Status**: **Pass**

### 9. State Management Robustness

- **Test**: Rapidly click multiple nodes in succession.
- **Result**:
  - Each click properly updates the frozen state.
  - No stale highlights remain.
  - Statistics popup updates for each new node.
- **Status**: **Pass**

### 10. Bilingual Comments Verification

- **Test**: Review `nodeHighlight.js` source code.
- **Result**: All functions and logic blocks have Chinese and English comments.
- **Status**: **Pass**

---

# 2025-12-24 v0.9.17

## Test Report: SVG Visual Completeness

### 1. Colored Arrow Markers

- **Test**: In SVG Mode, click on a node with both incoming and outgoing edges.
- **Result**:
  - Incoming edges are Red with **Red arrowheads**.
  - Outgoing edges are Blue with **Blue arrowheads**.
  - Previously, arrowheads remained gray.
- **Test**: Click the background to clear highlight.
- **Result**: All edges (if visible) revert to Gray lines with **Gray arrowheads**.
- **Status**: **Pass**

---

# 2025-12-24 v0.9.16

## Test Report: Interaction Completeness

### 1. Highlight Logic Override

- **Test**: Set filter mode to "Incoming Only". Single click a node that has both incoming and outgoing edges.
- **Result**: The graph highlights **both** incoming (Red) and outgoing (Blue) edges, overriding the filter for the inspected node.
- **Status**: **Pass**

### 2. Canvas Renderer Styling

- **Test**: Switch to Canvas Mode. Click a node.
- **Result**: Highlighted edges are drawn with increased thickness (2.5px), matching the visual weight of the SVG renderer.
- **Status**: **Pass**

---

# 2025-12-24 v0.9.14

## Test Report: Visual & Data Fixes

### 1. Edge Highlighting (SVG & Canvas)

- **Test**: Single click a node in the graph (SVG Mode).
- **Result**:
  - Incoming edges are colored **Red** (#ff6b6b) and bolded (2px).
  - Outgoing edges are colored **Blue** (#4488ff) and bolded (2px).
- **Test**: Switch to Canvas Mode and repeat.
- **Result**: Visuals are identical to SVG mode.
- **Status**: **Pass**

### 2. Data Deduplication

- **Test**: Click a node with multiple connections to the same neighbor (if any exist in data). Check popup lists.
- **Result**: Neighbor nodes appear only once in the "Incoming" and "Outgoing" lists.
- **Status**: **Pass**

---

# 2025-12-24 v0.9.13

## Test Report: Focus Mode Isolation

### 1. Focus Mode Interaction

- **Test**: Enter Focus Mode (Double Click). Single click another node.
- **Result**: Floating statistics popup does NOT appear. Layout does NOT freeze (unless globally frozen). Node is NOT highlighted with Red/Blue edges (Focus Mode context preserved).
- **Status**: **Pass**

---

# 2025-12-24 v0.9.11

## Test Report: Node Statistics & Localization

### 1. Focus Mode Localization

- **Test**: Switch language to Chinese ('zh') and enter Focus Mode.
- **Result**: Semantic labels appear as "帮助理解" and "进一步探索".
- **Test**: Switch language to English ('en') and enter Focus Mode.
- **Result**: Semantic labels appear as "Helping to understand" and "Further exploration".
- **Status**: **Pass**

### 2. Node Statistics Panel

- **Test**: Single click on a node.
- **Result**:
  - Analysis Panel opens (or switches content) to show "Node Details".
  - Node Name and Cluster are displayed correctly.
  - Inbound/Outbound lists are populated.
  - In-degree edges turn Red.
  - Out-degree edges turn Blue (#4488ff).
- **Test**: Click a node in the Inbound/Outbound list.
- **Result**: The graph highlights the new node, and the panel updates to show details for the new node.
- **Test**: Click "Back" button in the panel.
- **Result**: Panel reverts to "Degree Analysis" (Global View).
- **Status**: **Pass**

---
