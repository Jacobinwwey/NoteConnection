# 2026-05-12 v1.7.0 - HEAD Realignment Implementation Plan

## English Document

### Objective

Bring code truth, active progress docs, and next execution order back into alignment after the branch accumulated real Phase-3 slices while still carrying unfinished Phase-1 and Phase-2 requirements.

### Code-vs-Plan Reality Matrix

| Area | Planned Expectation | Current HEAD Reality | Status |
|---|---|---|---|
| Phase-1 A8 graph backend | production-grade local graph backend | ops semantics exist, but default runtime still points to `local-file-graphdb` | Partial+ |
| Phase-1 A9 ANN connector | production-grade ANN connector | prefilter/circuit/representation telemetry exists, but delivery still stops at `external_stub` / `external_http` scaffolding | Partial+ |
| Phase-2 quality gates | live mastery/divergence quality trend gates | learning-quality and session-plan-quality runtime surfaces remain placeholder-backed in `KnowledgeLearningPlatform.ts` | Open |
| Phase-3 tutor + memory | tutor and memory operating layer becomes real | tutor telemetry/trace/provider trends + conversation memory + memory-policy diagnostics are now real, but runtime tutor routing is not active by default | Early operational |
| Architecture compaction | major monoliths reduced to sustainable size | `server.ts` 15,752, `KnowledgeLearningPlatform.ts` 6,281, `path_app.js` 5,012, `app.js` 5,211, `routes/knowledge.ts` 698 | Open |

### Execution Order

1. P0: Truth correction and gate reclassification
   - keep progress docs aligned with actual code status,
   - stop treating placeholder-backed or catalog-only surfaces as closed.
2. P1: Real graph backend closure
   - activate a non-file-only graph backend path for the production-ready baseline,
   - preserve fallback behavior,
   - add adapter/fallback consistency verification.
3. P2: Production ANN closure
   - replace scaffold-only ANN delivery with one proven connector path,
   - benchmark recall/latency thresholds,
   - keep runbook telemetry and failure semantics intact.
4. P3: Phase-2 quality gate completion
   - replace placeholder query/staleness/learning-quality/session-plan-quality methods with live telemetry-backed implementations,
   - wire those outputs into release-significant threshold gates.
5. P4: Phase-3 tutor routing activation
   - inject an active `tutorAdapter` / routing strategy into normal server runtime,
   - keep rule-engine fallback explicit and observable.
6. P5: Architecture pressure reduction
   - continue splitting `routes/knowledge.ts`,
   - keep reducing `server.ts`, `KnowledgeLearningPlatform.ts`, `path_app.js`, and `app.js`.

### Acceptance Criteria

1. The default graph backend is no longer `local-file-graphdb` for the production-ready path.
2. One ANN connector path is proven beyond scaffold status and passes runbook/telemetry checks under real requests.
3. `KnowledgeLearningPlatform.ts` no longer returns placeholders for query comparison, staleness, learning-quality, and session-plan-quality runtime surfaces.
4. Default runtime tutor execution emits non-zero adapter telemetry under real server execution.
5. `docs:diataxis:check`, `docs:site:build`, `build:with-vite`, and targeted agent-workspace/KLP tests pass after each milestone.

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
