# 2026-03-04 v1.5.13 - Tauri Migration Task Consolidation

## English Document

### 2026-05-12 Code-vs-Plan Reality Snapshot

- [x] Agent-workspace browser/runtime/Tauri verification closure is real and repeatable on the current branch.
- [x] Phase-3 tutor telemetry, tutor trace/provider trend diagnostics, conversation memory, and memory-policy diagnostics now have concrete backend implementations.
- [ ] Phase-1 A8 is still `Partial+`: the default runtime graph backend remains `local-file-graphdb`, so a real local graph database engine is not yet the delivered baseline.
- [ ] Phase-1 A9 is still `Partial+`: ANN acceleration currently stops at `external_stub` / `external_http` scaffolding plus telemetry, not a proven production ANN backend.
- [ ] `KnowledgeLearningPlatform.ts` still contains placeholder-backed runtime surfaces for query comparison, staleness, learning-quality, and session-plan-quality diagnostics.
- [ ] Server bootstrap exposes a `tutorAdapters` catalog but does not inject an active `tutorAdapter`; normal tutor execution is still rule-engine-first on the default runtime path.

### 2026-05-10 Cross-Docs Status Note

- This taskboard is synchronized with [Open Goal Audit (2026-05-10)](../open_goal_audit_2026-05-10.md).
- Canonical unresolved-goal decisions must stay aligned with `TODO.md`, `tauri_tasks.md`, and `TEST_REPORT.md`.

### Priority Task Snapshot

- [x] Bridge-first migration baseline is active (`Tauri + Node sidecar + Godot Path Mode`).
- [x] Runtime path adaptation has been integrated for sidecar and frontend data roots.
- [x] Worker runtime resolution has been stabilized for packaged sidecar scenarios.
- [ ] Real graph backend activation and fallback-proof verification remain pending.
- [ ] Production ANN connector activation and benchmark-backed rollout thresholds remain pending.
- [ ] Placeholder-backed quality/query/session diagnostic methods must be replaced before Phase-2 closure claims.
- [ ] Default tutor routing must move from catalog-only wiring to active adapter execution.
- [ ] Final Electron decommission readiness checklist remains pending.

### Current Acceptance Targets

1. Default graphdb runtime path is no longer `local-file-graphdb` for the production-ready baseline.
2. One ANN connector path is proven under real connector telemetry rather than only `external_stub` / `external_http` scaffolding.
3. `KnowledgeLearningPlatform.ts` no longer returns placeholders for query comparison, staleness, learning-quality, and session-plan-quality runtime surfaces.
4. Default server runtime emits non-zero tutor adapter telemetry under real execution, with rule-engine fallback still explicit.
5. Tauri desktop + Android path remains documented, verified, and cleanly separated from historical Electron context.
