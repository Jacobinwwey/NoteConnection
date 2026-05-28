# 2026-03-04 v1.5.13 - Tauri Migration Task Consolidation

## English Document

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
- [ ] Promote the new sqlite soak verifier from initial host-level gate to sustained release evidence with repeated runs and tuned thresholds.
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

### Core Real-Machine Test Commands

- `npm run verify:core-real-machine`
  - Unified orchestration entrypoint for the current core real-machine test slice. Runs the automated foundation/browser/Tauri checks sequentially and writes JSON + Markdown reports under `output/verification/core-real-machine/`.
- `npm run verify:core-real-machine:clean`
  - Same orchestration path, but also restores transient tracked `src-tauri/bin/server-*` dirtiness introduced by the current verification run so the worktree can be kept clean.
- `npm run verify:foundation:sqlite-runtime:matrix`
  - Highest-value host/runtime proof for the embedded sqlite graph backend across `smoke` / `medium` / `heavy` workloads.
- `npm run verify:foundation:sqlite-runtime:soak`
  - Dedicated P1 host/runtime soak and performance gate for the embedded sqlite graph backend. Writes structured JSON reports under `output/verification/foundation-sqlite-runtime/`.
- `npm run verify:foundation:ann-runtime:matrix`
  - Highest-value host/runtime proof for the `external_http` ANN connector across `smoke` / `medium` / `heavy` workloads.
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
