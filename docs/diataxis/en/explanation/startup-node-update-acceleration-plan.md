# Startup Node Update Acceleration Plan (Cross-Platform + Windows Pilot)

## Context

This document solidifies the optimization strategy for improving node initialization/update speed after app launch.

Scope:
- Frontend graph startup path (`src/frontend/app.js`)
- Simulation worker tick/update path (`src/frontend/simulationWorker.js`)
- Runtime profiles across desktop and mobile runtimes

## 1) Problem Definition

Users experience slow perceived startup because the first interactive graph frame and first stable layout arrive too late.

System-level startup latency model:

`T_start = T_data_prepare + T_worker_init + T_tick_transfer + T_first_interactive_render + T_settle`

Primary user-facing KPIs:
- `TTI` (Time to Interactive graph)
- `TFS` (Time to First Stable readable layout)
- Startup frame-drop rate in first 3 seconds

## 2) Hypotheses

1. Full-payload tick transfer (`all nodes every tick`) is a major startup bottleneck.
2. Full edge rendering in the first 0.3–1.2s adds heavy cost with limited user value.
3. Missing persisted layout snapshots forces repeated cold-start relaxation.
4. Platform runtimes (Windows/macOS/Android WebView) need different startup limits.

## 3) Constraints and Unknowns

### Constraints
- Must keep behavior consistent across Tauri desktop and APK runtime.
- Must not break existing focus/highlight/path mode interactions.
- Must remain rollback-safe with feature flags.

### Unknowns
- Current P50/P95 startup metrics are not centrally collected.
- Device capability distribution per platform is not yet quantified.

## 4) Subproblem Decomposition

1. Data preparation cost on main thread.
2. Worker initialization + simulation settle speed.
3. Worker→UI transfer volume and frequency.
4. Startup render strategy (nodes-first vs edges-first).
5. Warm-start memory (layout snapshot persistence).

## 5) Three Candidate Options

### Option A: Quick Throttle + Staged Rendering
- Add startup edge delay.
- Cap tick frequency.
- Keep protocol unchanged.

Expected gain: medium (fast to deliver, low risk).

### Option B: Balanced Target (Recommended)
- Option A +
- Add persisted layout snapshots (warm start).
- Add delta tick transfer strategy (or reduced-frequency transfer).
- Add platform runtime profiles.

Expected gain: high with manageable risk.

### Option C: Deep Architecture Refactor
- Shared memory + binary graph pipeline + renderer overhaul.

Expected gain: highest, but high risk and long timeline.

## 6) Comparison

| Dimension | Option A | Option B (Recommended) | Option C |
|---|---|---|---|
| Delivery speed | Fast | Medium | Slow |
| Risk | Low | Medium | High |
| Cold-start improvement | Medium | High | Very high |
| Warm-start improvement | Low | Very high | Very high |
| Multi-platform feasibility (v1) | High | High | Medium |

## 7) Chosen Direction

Choose **Option B**, delivered in phases with rollback switches.

Reason:
- Strong performance upside without architectural disruption.
- Explicitly supports runtime profile tuning per platform.
- Suitable for a Windows-first pilot before broader rollout.

## 8) Execution Plan

### Phase 0: Instrumentation Baseline
- Add startup timeline logs:
  - `T0 app_boot`
  - `T1 graph_preprocessed`
  - `T2 worker_init_sent`
  - `T3 first_tick_received`
  - `T4 first_interactive_render`
  - `T5 stable_layout`

### Phase 1: Windows Pilot v1 (low-risk)
- Add runtime startup profile selection.
- Add worker tick rate cap.
- Add startup edge render delay.
- Add startup link render cap (optional guard).

### Phase 1b: Multi-platform Rollout (Desktop + Mobile)
- Extend startup profiles to macOS/Linux/Android/iOS runtime variants.
- Keep the same telemetry checkpoints (`T0..T5`) and compare by platform cohort.
- Scale startup visual overlay density and animation per runtime capability.
- Keep localStorage force-profile switches for fallback and A/B replay.

### Phase 2: Warm Start
- Persist per-graph layout snapshot keyed by graph fingerprint.
- Restore snapshot on startup and run low-alpha stabilization.

### Phase 3: Delta Transfer
- Reduce transfer volume via delta-only tick payload or lower-frequency full payload.

## 9) Risk Points and Mitigation

1. Stale snapshot mismatch:
   - Mitigation: strict graph fingerprint validation + fallback to cold start.
2. Over-throttling in low-end devices:
   - Mitigation: per-platform profile overrides and fast rollback.
3. Rendering incompleteness perception when edges are delayed:
   - Mitigation: short delay window + status hint + progressive edge restore.

## 10) v1 Optimization Spec (Multi-platform)

### Runtime Profiles
- `desktop_windows_pilot`: `26 FPS`, `400ms` edge delay, `1500ms` startup SVG cap window (`18000` links).
- `desktop_macos_pilot`: `24 FPS`, `430ms` edge delay, `1700ms` startup SVG cap window (`15000` links).
- `desktop_linux_pilot`: `24 FPS`, `420ms` edge delay, `1600ms` startup SVG cap window (`16000` links).
- `mobile_android_pilot`: `18 FPS`, `560ms` edge delay, `2200ms` startup SVG cap window (`7000` links).
- `mobile_ios_pilot`: `17 FPS`, `600ms` edge delay, `2300ms` startup SVG cap window (`6200` links).

### Startup Overlay Contract
- Show blurred startup overlay until `T5 stable_layout` or safety timeout.
- Text baseline: `等待世界构建`.
- Interactive starfield allows click-to-dim interactions.
- Mobile and reduced-motion environments use lowered star density and lower animation intensity.

### Success Criteria
- `TTI` improvement >= 30% vs baseline median.
- `TFS` improvement >= 20% vs baseline median.
- Startup 3s frame-drop reduction >= 30%.

### Rollback Gates
- Any startup regression > 10% on P95.
- Any reproducible interaction regression (focus/path mode/reader).
