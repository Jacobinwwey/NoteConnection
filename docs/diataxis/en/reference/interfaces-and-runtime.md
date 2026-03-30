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
- Windows pilot profile:
  - Profile ID: `desktop_windows_pilot`
  - Tick cap: `26 FPS` (worker-side emit throttle)
  - SVG edge geometry delay: `400ms`
  - Startup SVG edge cap window: `1500ms`, cap `18000` links
- Runtime override switch (for rollback/A-B validation):
  - `localStorage['nc.startupPerfProfile'] = 'off'` disables pilot behavior.
  - `localStorage['nc.startupPerfProfile'] = 'desktop_windows_pilot'` force-enables pilot behavior.

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
