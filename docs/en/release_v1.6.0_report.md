# NoteConnection v1.6.0 Release Update Report

## 1. Comparison Baseline

- **Project**: NoteConnection
- **Target release**: `v1.6.0`
- **Diff range**: `v1.3.0..HEAD`
- **Baseline tag timestamp**: `2026-01-24 20:37:25 +0800`
- **Current head**: `7f3bb04` (`2026-03-23 19:20:27 +0800`)

## 2. Quantitative Change Summary

- **Commits (no merges)**: `104`
- **Files changed**: `297`
- **Code/doc churn**: `+125,500 / -10,075`

Top change concentration (by added lines):

1. `src/`: `+29,116` (`115` files)
2. `build/`: `+24,851` (`15` files)
3. `docs/`: `+21,589` (`38` files)
4. `path_mode/`: `+10,798` (`27` files)
5. `scripts/`: `+10,394` (`40` files)
6. `src-tauri/`: `+8,889` (`17` files)

Quality scope expansion:

- **Test files added/updated**: `53`
- **Contract tests**: `38`
- **New NoteMD backend module files**: `13`
- **New/updated CI workflows**: `6`

## 3. Major Engineering Changes Since v1.3.0

### A. Runtime Architecture and Desktop Shell

- Migrated and hardened a Tauri-first runtime (`src-tauri/` introduced and expanded).
- Removed legacy Electron runtime files and switched to sidecar-driven desktop packaging.
- Implemented single-window orchestration behavior between Tauri and Godot path mode flows.
- Added safer close behavior and visibility handoff logic for runtime window switching.

### B. NoteMD End-to-End Integration

- Added full NoteMD backend subsystem under `src/notemd/`:
  - `BatchProcessor`, `FileProcessor`, `Translator`, `ContentGenerator`
  - `MermaidProcessor`, `FormulaFixer`, `DuplicateDetector`
  - `NotemdService`, typed request/response contracts
- Added frontend integration (`src/frontend/notemd.html`, `notemd.js`, `notemd.css`).
- Stabilized Browse/file/folder/save picker interaction path in Tauri integration.
- Enforced user guidance for PDF import workflow (`PDF -> Mineru -> Markdown`).

### C. Godot Path Mode and UX

- Expanded `path_mode/` with new scenes, renderer logic, panel system, and embedding panel hooks.
- Improved Path UI behavior, tree rendering, settings flow, and bridge synchronization.
- Fixed Godot window visibility and deprecated API usage paths.

### D. Mobile Export and Multi-Pipeline Support

- Expanded dual Android strategy:
  - Capacitor Android pipeline (`android/`)
  - Tauri Android pipeline (`src-tauri/gen/android/...`, runner/patch scripts)
- Added Java compatibility alignment and prerequisite verification tooling.
- Updated Android package/application metadata and build scripts for release consistency.

### E. Reliability, Security, and Operational Governance

- Added FixRisk operational workflow and strict evidence support.
- Added SBOM generation + attestation + verification scripts/contracts.
- Added privacy manifest, sidecar signature, pathbridge strict schema, and detox pipeline verifications.
- Added wasm parity verification/benchmarking and historical guardrails.

### F. Build Performance and Dev Productivity

- Added low-memory Tauri build wrappers:
  - `scripts/run-tauri-build.js`
  - low-memory policy updates in `scripts/run-tauri-android.js`
  - release profile controls in `src-tauri/Cargo.toml`
- Added sidecar preflight (`scripts/ensure-sidecar-ready.js`) to skip redundant rebuilds in warm dev loops.
- Enabled TypeScript incremental compile cache (`tsconfig.json` incremental options).

## 4. Version Synchronization for v1.6.0

Updated to `1.6.0`:

- `package.json`
- `package-lock.json` (top-level and root package entry)
- `src-tauri/tauri.conf.json`
- `src-tauri/src/lib.rs` (About dialog display string)
- `android/app/build.gradle` (`versionName 1.6.0`, `versionCode 16000`)

README synchronization completed:

- `README.md` (EN + ZH sections)
- `docs/en/README.md`
- `docs/zh/README.md`

## 5. Platform Release Matrix (v1.6.0)

| Platform | Version | Artifact(s) | Status |
|---|---|---|---|
| npm package | `1.6.0` | publish target from `package.json` | Ready |
| Windows Desktop (Tauri x64) | `1.6.0` | `src-tauri/target/release/bundle/nsis/NoteConnection_1.6.0_x64-setup.exe` | Built |
| Windows Desktop (Tauri MSI) | `1.6.0` | `src-tauri/target/release/bundle/msi/NoteConnection_1.6.0_x64_en-US.msi` | Built |
| Android (Capacitor debug) | `1.6.0` | `android/app/build/outputs/apk/debug/app-debug.apk` | Built |
| Android (Tauri universal APK) | `1.6.0` | `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk` | Artifact available |
| Android (Tauri universal AAB) | `1.6.0` | `src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab` | Artifact available |

Tauri Android metadata snapshot:

- `src-tauri/gen/android/app/build/outputs/apk/universal/release/output-metadata.json`
- `versionName: "1.6.0"`
- `versionCode: 1006000`

Capacitor Android metadata snapshot:

- `android/app/build/outputs/apk/debug/output-metadata.json`
- `versionName: "1.6.0"`
- `versionCode: 16000`

## 6. Verification Evidence (This Release Pass)

Successful commands:

1. `npm run build:mini`
2. `npm run verify:fixrisk:issues`
3. `npm run tauri:build:mini`
4. `npm run mobile:build:capacitor`
5. `npm run mobile:build:both` (full dual mobile pipeline run)

FixRisk status:

- `FR-001..FR-008`, `FR-010..FR-015`: `VERIFIED-CLOSED`
- `FR-009`: `VERIFIED-PENDING` (operational evidence freshness/threshold pending)

## 7. Known Risk Notes

1. **Intermittent Tauri Android rebuild OOM on this host**:
   - Repeated `npm run tauri:android:build:universal` retries can fail in Rust Android target compilation with memory allocation aborts.
   - Previously generated `v1.6.0` universal APK/AAB artifacts are present and version-aligned.
2. **FR-009 remains operationally pending**:
   - Functional checks pass, but strict large-graph physical-device evidence must be refreshed for complete closure.

## 8. Release Recommendation

**Go** for `v1.6.0` GitHub + npm synchronization, with two operational notes:

1. Publish the current desktop and Android artifacts already generated for `1.6.0`.
2. Run Tauri Android rebuild on a higher-memory CI/host before final Android artifact rotation if reproducibility from clean state is required.

