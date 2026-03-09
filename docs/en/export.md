# 2026-03-04 v1.5.14 - Consolidated Bilingual Migration Update Logs

## English Document

### README Runtime/Migration Logs (v1.5.x)
# 2026-03-03 v1.5.10

### Option A P0 Status Update (Tauri Android Native Folder/Build/Content Flow)

- Tauri Android runtime now supports native build flow without Node sidecar:
  - Added Rust command `build_graph_runtime(request)` in `src-tauri/src/lib.rs`.
  - Runtime graph artifacts are written into `runtime_data/`:
    - `data.js`
    - `graph_data.json`
    - `data_<target>.js`
    - `graph_data_<target>.json`
- Android runtime capability profile is now:
  - `supports_sidecar=false`
  - `supports_build=true`
  - `supports_content_api=true`
- Frontend build routing in `src/frontend/source_manager.js`:
  - sidecar available -> `POST /api/build`
  - no sidecar + Tauri runtime -> `invoke('build_graph_runtime', { request })`
- Verification:
  - `npm run test:migration` -> passed (`55` tests)
  - `npm run test:tauri` -> passed (`16` tests)
  - `npm run verify:android:env` -> passed (SDK + cmdline-tools + NDK detected)

### Scope Clarification

- This closure applies to **Tauri Android runtime path**.
- Capacitor packaging path is preserved, but runtime parity with desktop build backend is still tracked separately.
- Historical sections below that mention `supports_build=false` are archived changelog context and are superseded by this update.

# 2026-03-03 v1.5.5

### Migration Status Revalidation

- Re-ran closure suites:
  - `npm run test:migration` -> passed (`44` tests)
  - `npm run test:tauri` -> passed (`14` tests)
- P0/P1 closures from `v1.5.3` and `v1.5.4` remain valid.
- `v1.5.2` checklist should be treated as historical/superseded plan context.

### Active Scope

- Desktop Tauri path is stable and remains the primary runtime.
- Android runtime remains capability-gated by design:
  - `supports_sidecar=false`
  - `supports_build=false`
  - cache/content-oriented flow only.
- Remaining product decision:
  - Option A: Android-native build/content parity with desktop sidecar flow.
  - Option B (active): keep cache/read-focused mobile runtime boundary.

# 2026-03-03 v1.5.3

### Migration Gate Closure Update

- P0 engineering closure has been completed in this round:
  - Sidecar `/api/content` now enforces KB-root boundary checks.
  - Regression tests were added for inside-root, legacy `Knowledge_Base` marker, and outside-root rejection paths.
  - Godot center-switch history recording contract was hardened and covered by tests.
  - Source-manager single-load/cache-guard contracts were added to migration tests.
- Latest verification:
  - `npm run test:migration` -> passed (`43` tests)
  - `npm run test:tauri` -> passed (`14` tests)

### Runtime Policy (Current)

- Desktop runtime is Tauri-first and stable.
- Android runtime remains capability-gated by design:
  - `supports_sidecar=false`
  - `supports_build=false`
  - cache/content-oriented flow only.

### Archive Notice

- Any Electron references in historical changelog sections below are **archived context only** and are not active release instructions.

# 2026-03-02 v1.5.1

### Tauri Migration Progress Update (Desktop + Android)

This release note records the latest migration parity work completed after the Android SDK Command-line Tools setup was validated.

#### Completed in this round

- Added **target discovery parity** across sidecar and Tauri runtime:
  - Sidecar API: `GET /api/available-targets` (merges `Knowledge_Base` folders + cached graph targets).
  - Tauri command: `get_available_targets` (same merged behavior).
- Added **content-read parity path** for non-sidecar runtimes:
  - Tauri command: `read_node_content(file_path)`.
  - Reader fallback now supports `read_node_content` when sidecar is unavailable (Android-safe path).
- Added **cache-only source filtering** for mobile runtime:
  - When `supports_build=false`, source dropdown is filtered to cached targets only.
  - `ALL_FOLDERS` option appears only if active cache exists.
  - Load button is disabled when no cache is available.
- Added **Android multi-ABI opt-in command path** while keeping `aarch64` as default stable target:
  - `npm run tauri:android:dev:universal`
  - `npm run tauri:android:build:universal`

#### Verification evidence

- `npm run test:migration` passed (35 tests).
- `npm run test:tauri` passed (14 Rust tests).
- `npm run tauri:android:build` passed.
- `npm run tauri:android:build:universal` passed.

#### Current capability boundary

- Android runtime currently supports:
  - Loading and restoring existing graph cache.
  - Reading node content through Tauri command path.
- Android runtime currently does **not** support local in-app graph build (`/api/build` equivalent) yet.
- Godot Path Mode remains desktop-oriented in the current architecture.

---

### Interface Delta Logs
# 2026-03-02 v1.5.1

### Interface Delta: Tauri Runtime Parity Update

This section records interface changes added after `v1.4.5`, keeping all previous handover content unchanged below.

#### A. Sidecar HTTP API (Node)

1. `GET /api/available-targets`
   - Purpose: return selectable learning/build targets merged from:
     - physical subfolders under `Knowledge_Base`
     - cached artifacts like `data_<target>.js`, `graph_data_<target>.json`
   - Response:

```json
{
  "targets": ["financial", "legal", "robotics"]
}
```

#### B. Tauri Commands (Rust IPC)

1. `get_available_targets() -> string[]`
   - Contract: same merged target semantics as `/api/available-targets`.

2. `read_node_content(file_path: string) -> Result<string, string>`
   - Contract:
     - Accepts relative paths and absolute paths.
     - Enforces KB-root boundary (rejects files outside configured `Knowledge_Base`).
     - Supports legacy desktop-style paths containing `.../Knowledge_Base/...` by rebasing to current configured KB root.

#### C. Runtime Capability Contract Update

- `get_runtime_capabilities()` now returns `supports_content_api: true` on Android.
- Rationale: content reads are now available through Rust `read_node_content` command even when sidecar is disabled.

#### D. Frontend Behavior Contract Changes

1. `source_manager.js`
   - Sidecar path prefers `/api/available-targets` and falls back to `/api/folders`.
   - Rust path prefers `get_available_targets` and falls back to `get_folders`.
   - In `supports_build=false` runtime (mobile):
     - Source list is filtered to cached targets only.
     - `ALL_FOLDERS` is shown only if active cache exists.
     - Load button is disabled if no cache is available.

2. `reader.js`
   - Content loading fallback order:
     - sidecar `/api/content` (desktop/web path)
     - Rust command `read_node_content` (Tauri fallback/mobile-safe)
     - localized unavailable/error messaging

#### E. Verification Interface Baseline

- `npm run test:migration` passed (35 tests).
- `npm run test:tauri` passed (14 tests).
- `npm run tauri:android:build` passed.

---

# 2026-03-02 v1.5.1 - Export Strategy Update (Tauri-Primary, Dual Android Outputs)

## English Document

### Strategy Update

Export strategy is now Tauri-primary while preserving Android dual-output flexibility:

- Desktop distribution baseline moves to Tauri packaging.
- Capacitor Android pipeline remains available.
- Tauri Android pipeline is added as a parallel mobile output path.

### Packaging Direction

1. Keep Electron packaging available only as a temporary fallback during migration gate period.
2. Promote Tauri desktop bundling as the default release path.
3. Maintain both mobile generation routes until runtime parity validation is complete.

### Release Risk Controls

- Require parity checks for data loading, cache behavior, and path mode interactions before disabling Electron builds.
- Keep sidecar/runtime path verification in release checklists.
- Keep reproducible build notes for both Android routes in project docs.

