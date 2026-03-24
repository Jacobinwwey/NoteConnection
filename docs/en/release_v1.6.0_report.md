# NoteConnection v1.6.0 Release Compare Report

## 1. Compare Baseline

- Project: `NoteConnection`
- Compare range: `v1.3.0..v1.6.0`
- Baseline tag (`v1.3.0`): `376ae600fbf14700c9dbbc10c4bb6190a34078e4` (`2026-01-24 20:37:25 +0800`)
- Target tag (`v1.6.0`): `eb2bb2ec7b9fd239c559accb034e5537f56613e7` (`2026-03-23 22:08:28 +0800`)

## 2. Quantitative Diff Summary

Tag-to-tag results from `git diff v1.3.0..v1.6.0`:

- Commits: `107`
- Files changed: `301`
- Churn: `+125,957 / -10,083`
- Net growth: `+115,874`

File status breakdown from `git diff --name-status`:

- Added: `241`
- Modified: `56`
- Deleted: `3`
- Renamed: `1`

## 3. Change Footprint by Top-Level Area

By changed-file count:

1. `src/`: `116`
2. `docs/`: `41`
3. `scripts/`: `40`
4. `path_mode/`: `27`
5. `src-tauri/`: `19`
6. `build/`: `15`
7. `.github/workflows/`: `6`
8. `android/`: `6`

Quality and governance expansion:

- Test files changed/added: `53`
- Contract tests changed/added: `38`
- Workflow files changed/added: `6`

## 4. Critical Engineering Deltas Since v1.3.0

### A. Runtime and Packaging Architecture

- Tauri runtime and sidecar stack was introduced and hardened under `src-tauri/`.
- Electron runtime entries were removed (`src/electron/main.ts`, `src/electron/preload.ts`, `electron-builder.yml`).
- Runtime capability hydration and sidecar runtime config flow were added for frontend bridge stability.

### B. Godot Path Mode Expansion

- `path_mode/` gained a significantly larger UI/runtime surface:
  - new scenes (`main`, settings, tree panel)
  - state machine and panel scripts
  - renderer and websocket client upgrades
  - embedded NoteMD panel hooks
- Single-window orchestration behavior was stabilized between Tauri and Godot windows.

### C. NoteMD System Integration

- Full NoteMD backend module family was added in `src/notemd/`.
- Frontend NoteMD surfaces were added (`notemd.html/js/css`).
- Runtime integration was connected to Tauri/Godot bridge paths.
- File/folder/save picker workflows were fixed in Tauri integration paths.

### D. Mobile and Multi-Export Pipelines

- Dual Android pipeline matured (Capacitor and Tauri Android).
- Android/Tauri compatibility scripts were added (env checks, patching, sidecar validation).
- Java compatibility alignment tooling was added for deterministic APK/AAB export.

### E. Verification, Security, and Release Governance

- Added/expanded:
  - FixRisk readiness automation
  - SBOM generation and attestation verification
  - sidecar signature verification
  - privacy manifest checks
  - pathbridge strict schema gates
  - wasm parity benchmark/guard history controls
  - mobile detox contract checks

### F. Performance and Developer Experience

- Added low-memory Tauri wrappers and runtime memory policy tooling.
- Added sidecar preflight scripts to reduce redundant rebuilds in warm dev loops.
- Added generated runtime assets for Mermaid/Resvg and associated verification plumbing.

## 5. Highest-Impact File Deltas (By Total Line Change)

Representative examples from `git diff --numstat`:

1. `build/sbom/noteconnection-sbom.cdx.json` (`+17016 / -0`)
2. `TODO.md` (`+6684 / -1611`)
3. `package-lock.json` (`+3850 / -3183`)
4. `src-tauri/Cargo.lock` (`+5631 / -0`)
5. `TEST_REPORT.md` (`+3883 / -1410`)
6. `path_mode/scripts/path_mode_ui.gd` (`+4950 / -0`)
7. `src/server.ts` (`+2751 / -291`)
8. `src/frontend/path_app.js` (`+2579 / -86`)
9. `src-tauri/src/lib.rs` (`+2664 / -0`)
10. `src/core/PathBridge.ts` (`+2020 / -26`)

## 6. Documentation Completion Work (This Pass)

Based on the `v1.3.0..v1.6.0` compare audit, the following documentation gaps were normalized:

- Updated stale top-version headers to `v1.6.0` in canonical README/manual/interface docs.
- Refreshed this release report to use strict tag-to-tag metrics (removed `..HEAD` ambiguity).
- Added missing compare-scope context to release notes/readme changelog entries.
- Updated bilingual index coverage to include new paired documents added after `v1.3.0`.

## 7. Release State Recommendation

`v1.6.0` is a major runtime and governance expansion relative to `v1.3.0`, not a patch-level delta.

Recommended release communication framing:

1. Runtime transition: Electron-decommissioned, Tauri-first architecture.
2. UX transition: single-window orchestration and embedded NoteMD flow.
3. Delivery transition: dual Android pipeline plus stricter CI/security governance.
