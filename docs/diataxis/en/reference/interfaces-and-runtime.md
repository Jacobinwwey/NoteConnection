# Reference: Interfaces and Runtime Contracts

This reference tracks canonical API/runtime contracts.

## Primary Contract Documents

- [docs/en/Interface Document.md](../../../en/Interface%20Document.md)
- [docs/en/User_Manual.md](../../../en/User_Manual.md)

## Focused Integration References

- [Godot + NoteMD + Markdown Interfaces](./godot-notemd-markdown-interfaces.md)
- [Godot + NoteMD + Markdown Workflows](../how-to/godot-notemd-markdown-workflows.md)

## Key Runtime Contract Points (v1.6.0)

- Frontend runtime hydration invoke contracts:
  - `invoke('get_runtime_capabilities')`
  - `invoke('get_sidecar_runtime_config')`
- Rust sidecar runtime config command:
  - `get_sidecar_runtime_config`
- Rust app runtime config command:
  - `get_app_runtime_config`
- Runtime bridge readiness sequencing via `whenReady()`.

## Startup Perf Telemetry and Pilot Profile (v1.6.9+ pilot)

- Frontend startup checkpoints are emitted as one-shot logs:
  - `T0 app_boot`
  - `T1 graph_preprocessed`
  - `T2 worker_init_sent`
  - `T3 first_tick_received`
  - `T4 first_interactive_render`
  - `T5 stable_layout`
- Worker startup profile is passed through `simulationWorker` init payload:
  - `startupProfile.id`
  - `startupProfile.tickMaxFps`
  - `startupProfile.stableAlphaThreshold`
  - `startupProfile.stableHoldTicks`
  - `startupProfile.stableTimeoutMs`
- Multi-platform startup pilot profiles:
  - `desktop_windows_pilot`: `26 FPS`, `400ms` edge delay, `1500ms` SVG cap window (`18000` links).
  - `desktop_macos_pilot`: `24 FPS`, `430ms` edge delay, `1700ms` SVG cap window (`15000` links).
  - `desktop_linux_pilot`: `24 FPS`, `420ms` edge delay, `1600ms` SVG cap window (`16000` links).
  - `mobile_android_pilot`: `18 FPS`, `560ms` edge delay, `2200ms` SVG cap window (`7000` links), reduced overlay density.
  - `mobile_ios_pilot`: `17 FPS`, `600ms` edge delay, `2300ms` SVG cap window (`6200` links), reduced overlay density.
- Startup visual overlay contract:
  - A blurred startup overlay is shown until `T5 stable_layout` (or safety timeout).
  - Core text: `等待世界构建`.
  - Interactive starfield: stars twinkle naturally, and pointer clicks can dim nearby stars.
  - Overlay automatically scales down density/animation intensity on mobile and reduced-motion environments.
- Runtime override switch (for rollback/A-B validation):
  - `localStorage['nc.startupPerfProfile'] = 'off'` disables pilot behavior.
  - `localStorage['nc.startupPerfProfile'] = 'desktop_windows_pilot'` force-enables pilot behavior.
  - `localStorage['nc.startupPerfProfile'] = 'desktop_macos_pilot' | 'desktop_linux_pilot' | 'mobile_android_pilot' | 'mobile_ios_pilot'` force-selects the target profile.
- Automated baseline vs pilot summary script:
  - `npm run perf:startup:compare -- --baseline <baseline-log-path> --pilot <pilot-log-path>`
  - Supports file or directory inputs, auto-parses sessions from `[Startup Perf]` checkpoints, outputs P50/P95 KPI report.
- Automated cross-platform matrix summary script:
  - `npm run perf:startup:matrix -- --root <startup-logs-root> [--out <report-path>]`
  - Recommended layout: `<root>/<platform>/baseline|pilot` (for example `windows`, `macos`, `android`).
  - Backward-compatible single-platform layout: `<root>/baseline|pilot`, with `--single-platform-label <label>` as platform tag.
- Near-real-time matrix gate (auto-refresh when logs change):
  - `npm run perf:startup:matrix:watch -- --root <startup-logs-root> --out <report-path> --strict`
  - Recommended same-device dual-phase layout:
    - `<root>/macos/baseline/*.log`
    - `<root>/macos/pilot/*.log`
    - `<root>/android/baseline/*.log`
    - `<root>/android/pilot/*.log`
    - `<root>/ios/baseline/*.log`
    - `<root>/ios/pilot/*.log`
- Fallback flow without multi-device hardware (pipeline validation only):
  - `npm run perf:startup:matrix:simulate -- --seed-root tmp/startup-logs --out-root tmp/startup-logs-simulated`
  - `npm run perf:startup:matrix -- --root tmp/startup-logs-simulated --out tmp/startup-logs-simulated/report-platform-matrix.md`
  - Note: `tmp/startup-logs-simulated` is synthetic data and must not be used for release-go performance decisions.

## Mermaid Canonical Baseline (Obsidian)

- Standard compatible format: fenced code block using ` ```mermaid` (opening line) and ` ``` ` (closing line).
- Godot runtime rendering remains PNG-first; Mermaid renderer preference should allow fallback (`auto`) to avoid bridge-only hard failures.
- Detailed field and route contracts:
  - [Godot + NoteMD + Markdown Interfaces](./godot-notemd-markdown-interfaces.md)

## app_config Runtime Contract Hook

- Frontend app-config hydration command:
  - `invoke('get_app_runtime_config')`
- Hydrated projection:
  - `window.__NC_APP_CONFIG.language`
  - `window.__NC_APP_CONFIG.multiWindow.*`
- Detailed schema reference:
  - [app_config.toml Schema](./app-config-schema.md)

## Policy Gate Families

- PathBridge strict schema
- Storage provider contracts
- Mobile runtime boundary contracts
- SBOM + attestation policy contracts
- Sidecar signature and privacy manifest contracts
