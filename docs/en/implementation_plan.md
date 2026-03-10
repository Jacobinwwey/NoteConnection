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
