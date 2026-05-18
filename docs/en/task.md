# 2026-03-04 v1.5.13 - Tauri Migration Task Consolidation

## English Document

### 2026-05-12 Code-vs-Plan Reality Snapshot

- [x] Agent-workspace browser/runtime/Tauri verification closure is real and repeatable on the current branch.
- [x] Phase-3 tutor telemetry, tutor trace/provider trend diagnostics, conversation memory, and memory-policy diagnostics now have concrete backend implementations.
- [~] Phase-1 A8 has advanced to an embedded `graphdb/sqlite` operational baseline and now has restart-durability proof, host-level dist/runtime + packaged sidecar proof, and a host-level workload matrix across `smoke` / `medium` / `heavy`; soak / longer-duration / performance hardening still remain before production closure.
- [~] Phase-1 A9 now has a live `external_http` sync-backed connector baseline under real query traffic, host-level dist/runtime + packaged sidecar proof, and a host-level workload matrix across `smoke` / `medium` / `heavy`, but benchmark-backed rollout thresholds and release-grade calibration still remain before production closure.
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
- [ ] Production ANN connector threshold convergence and release-grade calibration remain pending after the new host-level runtime and workload-matrix proofs.
- [ ] Phase-2 quality/query/session diagnostics now need release-grade calibration on top of a release-grade graphdb/ANN baseline.
- [ ] Tutor routing now needs multi-provider hardening beyond the active local-first adapter path.
- [ ] Final Electron decommission readiness checklist remains pending.

### Current Acceptance Targets

1. Default graphdb runtime path is embedded `graphdb/sqlite` and survives restart with persistent query/store diagnostics.
2. The live `external_http` ANN connector path stays healthy under real sync/query telemetry, and its rollout thresholds are tightened for release use.
3. The live query comparison, staleness, learning-quality, and session-plan-quality diagnostics are calibrated on top of a release-grade graphdb/ANN baseline.
4. Tutor routing advances from local-first adapter execution into a production-proven multi-provider policy while keeping explicit fallback behavior.
5. Tauri desktop + Android path remains documented, verified, and cleanly separated from historical Electron context.
