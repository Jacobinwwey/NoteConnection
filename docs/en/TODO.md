# 2026-03-09 v1.5.18 - High-Priority Continuation (Capacitor Content Path + Device Evidence + MD Language Archive)

## English Document

### Objective
Continue active high-priority closure with implementation-first rigor:
- Reduce Capacitor runtime parity risk for **content loading** (without pretending build parity).
- Operationalize physical-device acceptance evidence collection.
- Execute a structured language archive of all tracked markdown docs into `docs/en` and `docs/zh`.

### Completed in This Iteration
- [x] **Capacitor content-path parity hardening**:
  - [x] `src/frontend/source_manager.js`: Capacitor runtime capability now resolves `supports_content_api` dynamically via filesystem plugin readiness (`supportsCapacitorContentApi`) instead of hardcoded false.
  - [x] `src/frontend/storage_provider.js`: added Capacitor content mapping and safety helpers:
    - [x] `extractRelativePathFromKbMarker(rawFilePath)`
    - [x] `resolveCapacitorContentCandidatePath(rawFilePath)`
    - [x] strict rejection of unmappable absolute desktop paths without `Knowledge_Base` marker
  - [x] `RuntimeStorageProvider.readContent()` now uses Capacitor filesystem for native runtime when content API is supported.
- [x] **Physical-device evidence automation**:
  - [x] Added `scripts/capture-capacitor-device-evidence.js`.
  - [x] Added npm command `capture:capacitor:evidence`.
  - [x] Evidence bundle output design:
    - [x] masked device metadata
    - [x] screenshot (`device-screenshot.png`)
    - [x] logcat tail (`logcat-tail.txt`)
    - [x] bilingual acceptance report (`acceptance_evidence.md`)
- [x] **Structured markdown language archive**:
  - [x] Added `scripts/archive-md-by-language.js`.
  - [x] Archived all tracked markdown files into:
    - [x] `docs/en/**` (English set)
    - [x] `docs/zh/**` (Chinese set)
  - [x] Generated archive traceability report: `docs/language-archive-report.json`.
  - [x] Current archive snapshot: scanned `25` tracked markdown files, output `24` EN docs and `17` ZH docs.
- [x] **Contract/test updates**:
  - [x] Updated `src/capacitor.runtime.contract.test.ts` for dynamic Capacitor content capability.
  - [x] Updated `src/storage.provider.contract.test.ts` for Capacitor content mapping assertions.
  - [x] Added `src/storage.provider.capacitor.content.contract.test.ts`.
  - [x] Updated `src/mobile.pipeline.test.ts` to assert evidence-capture npm command.
  - [x] Updated `package.json` migration test list to include new capacitor content contract test.

### High-Priority Work Status (Current)
- [x] Deliver mobile **content** parity path beyond strict packaged-read-only behavior (filesystem-backed read path added with safety checks).
- [ ] Deliver full mobile **build + content** parity equivalent to desktop sidecar (build parity remains intentionally unresolved in Capacitor runtime).
- [ ] Complete physical-device acceptance evidence checklist end-to-end (device-dependent manual validations still pending).

### Verification Gate (Executed)
- [x] `npx jest src/capacitor.runtime.contract.test.ts src/storage.provider.contract.test.ts src/storage.provider.capacitor.content.contract.test.ts src/mobile.pipeline.test.ts src/source_manager.loadflow.test.ts src/runtime.capabilities.test.ts --runInBand`
- [x] `npm run test:migration` (`18` suites passed)
- [x] `npm run build`
- [x] `npm run test:tauri`
- [x] `./src-tauri/bin/godot-x86_64-pc-windows-msvc.exe --headless --path ./path_mode --quit`
- [x] `node scripts/archive-md-by-language.js`
- [ ] `npm run verify:capacitor:device` (blocked in current environment: no online Android device)
- [ ] `npm run capture:capacitor:evidence` (blocked in current environment: no online Android device)

---

# 2026-03-09 v1.5.17 - Fixrisk Feasibility Hardening (Approach Plan Execution)

## English Document

### Objective
Execute the next fixrisk-driven hardening slice from `docs/fixrisk_TODO.md` with verifiable runtime contracts, focused on mobile filesystem feasibility, Android permission baselines, and CI determinism.

### Completed in This Iteration
- [x] **Capacitor filesystem dependency baseline**:
  - [x] Added `@capacitor/filesystem` to runtime dependencies in `package.json`.
- [x] **Storage-provider hardening for native Capacitor paths** (`src/frontend/storage_provider.js`):
  - [x] Added Capacitor path normalization with traversal rejection (`.` / `..` unsafe segments).
  - [x] Added permission-aware filesystem gate (`checkPermissions` / `requestPermissions`) with deterministic error signaling.
  - [x] Kept desktop sidecar and Tauri command fallback behavior unchanged.
- [x] **Android manifest permission baseline** (`android/app/src/main/AndroidManifest.xml`):
  - [x] Added legacy storage compatibility declarations (`READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`).
  - [x] Added Android 13+ media-read declarations (`READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_AUDIO`).
- [x] **Contract-test coverage raised**:
  - [x] Updated `src/mobile.pipeline.test.ts` to enforce Capacitor filesystem dependency and Android permission declarations.
  - [x] Updated `src/storage.provider.contract.test.ts` to enforce permission/path-hardening hooks in storage provider.
- [x] **CI migration stability**:
  - [x] Kept `src/server.migration.test.ts` hermetic against runner-injected `NOTE_CONNECTION_AUTH_TOKEN` values to prevent false `401` cascades in CI.

### High-Priority Work Status (Current)
- [x] Address fixrisk mobile filesystem baseline gaps at dependency + manifest + adapter hardening level.
- [x] Add migration-level guardrails to prevent silent regressions.
- [ ] Deliver true mobile build/content parity beyond packaged read-only policy (still intentionally bounded).
- [ ] Complete physical-device acceptance evidence (`verify:capacitor:device` + on-device runtime checklist).

### Verification Gate (Executed)
- [x] `npx tsc --pretty false`
- [x] `npx jest src/storage.provider.contract.test.ts src/mobile.pipeline.test.ts src/source_manager.loadflow.test.ts src/runtime.capabilities.test.ts src/server.migration.test.ts --runInBand`
- [x] `npm run test:migration`
- [x] `npm run build`
- [x] `npm run test:tauri`
- [x] `./src-tauri/bin/godot-x86_64-pc-windows-msvc.exe --headless --path ./path_mode --quit`
- [x] `npm run build:sidecar`

---

# 2026-03-08 v1.5.16 - High-Priority Closure (Transport + Storage + Cross-Platform Godot Strategy)

## English Document

### Objective
Close all open high-priority items from `v1.5.15` with implementation + regression validation, without weakening existing desktop/mobile runtime boundaries.

### Completed in This Iteration
- [x] **Transport modernization closure**:
  - [x] Added JSON-RPC-compatible bridge envelopes in `src/frontend/runtime_bridge.js` (`toBridgeEnvelope`, `parseBridgeEnvelope`, `sendBridgeMessage`) while keeping legacy `type/payload` compatibility.
  - [x] Migrated `src/frontend/path_app.js` bridge sends/receives to the runtime transport adapter path (`_sendBridgeMessage`, `_parseBridgeIncomingMessage`) instead of direct raw message formatting/parsing.
- [x] **Storage-provider abstraction closure**:
  - [x] Added `src/frontend/storage_provider.js` as the unified runtime storage provider and wired it into source/reader flows.
  - [x] Implemented provider branches for sidecar HTTP, Tauri invoke commands, and Capacitor-native filesystem read/list fallbacks (`Filesystem` plugin-aware helpers) while preserving current capability gating policy.
- [x] **Explicit macOS/Linux Godot sidecar artifact strategy**:
  - [x] Reworked `scripts/ensure-godot-sidecar.js` into host-aware preparation for Windows/Linux/macOS naming (`godot-<target-triple>`), with deterministic lookup strategy and documented env overrides.
  - [x] Updated `src-tauri/src/lib.rs` Godot executable resolution to platform-specific sidecar names + host aliases, with tests adjusted for cross-platform behavior.
- [x] **Release policy explicitness kept in code/docs surface**:
  - [x] Capacitor native remains bounded read-only/cache-oriented in runtime capability handling.
  - [x] README policy statements remain explicit that Capacitor path does not provide desktop sidecar parity yet.

### High-Priority Status
- [x] Complete transport modernization (replace remaining raw desktop HTTP/WS flows with Tauri-native IPC or JSON-RPC adapter).
- [x] Implement storage-provider abstraction across desktop sidecar, Tauri commands, and Capacitor native filesystem.
- [x] Add explicit macOS/Linux Godot sidecar artifact strategy (currently Windows binary workflow is strongest).
- [x] Keep release policy explicit: Capacitor native remains read-only packaged mode until parity work is delivered.

### Verification Gate (Executed)
- [x] `npx tsc --pretty false`
- [x] `npx jest src/storage.provider.contract.test.ts src/source_manager.loadflow.test.ts src/runtime.capabilities.test.ts src/runtime.transport.adapter.contract.test.ts --runInBand`
- [x] `npm run test:migration`
- [x] `npm run test:tauri`
- [x] `./src-tauri/bin/godot-x86_64-pc-windows-msvc.exe --headless --path ./path_mode --quit`
- [x] `npm run build:sidecar`
- [x] `npm run build:sidecar:all` (artifact generation + validation; macOS binary signing warning remains expected when built off macOS host)
- [x] `npm run verify:tauri:bin`
- [x] `npm test`

---


# 2026-03-08 v1.5.15 - Fixrisk Phase-1 Hardening Execution (Completed)

## English Document

### Objective
Execute the highest-risk actionable items from `docs/fixrisk_TODO.md` without destabilizing existing desktop and mobile runtime contracts.

### Implemented in This Iteration
- [x] `src/server.ts`: removed synchronous file reads from `/api/content` and generated JS/JSON asset responses.
- [x] `src/server.ts`: replaced in-memory-only JSON body parsing with bounded streaming + temp-file spooling (`tmp/request-bodies`) for large payloads.
- [x] `src/server.ts`: normalized request-body failure handling with explicit HTTP status mapping:
  - [x] `413` for oversized payloads
  - [x] `400` for invalid JSON
  - [x] `415` for unsupported content type
- [x] `src/server.ts`: migrated `/api/build` and `/api/kb-path` to the same hardened JSON parser path (removed duplicated manual body buffering).
- [x] `src/server.ts`: added startup resilience for default dev port conflicts. If no explicit port is configured and `3000` is busy, server now falls back to an ephemeral loopback port instead of crashing with `EADDRINUSE`.
- [x] `src/server.ts`: completed async conversion for cache and target APIs (`/api/check-cache`, `/api/restore-cache`, `/api/available-targets`) to remove remaining sync hot-path filesystem calls.
- [x] Frontend transport consolidation: `source_manager.js`, `reader.js`, and `path_app.js` now rely on `runtime_bridge.js` as the single runtime transport adapter instead of standalone hardcoded loopback URL fallbacks.
- [x] Packaging modernization:
  - [x] Added `scripts/build-sidecar.js` with Node 22 targets, Brotli compression, and `--no-bytecode`.
  - [x] Updated `build:sidecar` to host-aware Node 22 build.
  - [x] Added `build:sidecar:all` for Windows/Linux/macOS-arm64 outputs with Tauri-compatible naming.
  - [x] Updated sidecar validation script to support host/all-target checks.
  - [x] Updated Godot sidecar preparation script to skip Windows-only copy logic on non-Windows hosts.

### Remaining High-Priority Work
- [ ] Complete transport modernization (replace remaining raw desktop HTTP/WS flows with Tauri-native IPC or JSON-RPC adapter).
- [ ] Implement storage-provider abstraction across desktop sidecar, Tauri commands, and Capacitor native filesystem.
- [ ] Add explicit macOS/Linux Godot sidecar artifact strategy (currently Windows binary workflow is strongest).
- [ ] Keep release policy explicit: Capacitor native remains read-only packaged mode until parity work is delivered.

### Verification Gate (This Iteration)
- [x] `npx tsc --pretty false`
- [x] `npx jest src/server.migration.test.ts src/source_manager.loadflow.test.ts src/pathbridge.handshake.contract.test.ts src/reader_renderer.test.ts --runInBand`
- [x] `npx jest src/runtime.transport.adapter.contract.test.ts src/source_manager.loadflow.test.ts src/runtime.capabilities.test.ts src/pathbridge.handshake.contract.test.ts --runInBand`
- [x] `npm run test:migration`
- [x] `npm run test:tauri`
- [x] `./src-tauri/bin/godot-x86_64-pc-windows-msvc.exe --headless --path ./path_mode --quit`
- [x] `npm run build:sidecar`
- [x] `npm run build:sidecar:all` (artifact validation only; cross-platform runtime execution remains platform-dependent)

---

# 2026-03-07 v1.5.14 - Architecture & Security Hardening Review Refresh

## Future Architecture & Security Hardening (Post v1.5.13)

### Goal
Refresh the post-v1.5.13 hardening backlog against the current codebase so the TODO reflects what is already implemented and what still blocks production-grade robustness, large-graph scalability, and honest multi-platform delivery.

### Completed Since The Original Hardening Plan
- [x] HTTP and WebSocket listeners are now loopback-only on desktop (`127.0.0.1`).
- [x] Tauri now allocates dynamic sidecar and bridge ports and injects runtime metadata into the sidecar, frontend, and Godot process.
- [x] Protected sidecar routes and bridge identification now support token-based authentication.
- [x] Strict CORS allowlisting replaced wildcard desktop exposure for the sidecar runtime.
- [x] A shared frontend runtime bridge now synchronizes sidecar base URL, bridge URL, and auth headers in Tauri desktop flows.
- [x] Native Capacitor runtime is now explicitly treated as a read-only packaged mode instead of assuming desktop sidecar APIs.
- [x] Clipboard PNG buffers are explicitly zeroized after use in the Node sidecar.
- [x] Godot reader SVG sanitization and dimension clamping now prevent oversized raster failures for Math/Mermaid rendering.

### Remaining High-Priority Work

#### Phase 1: Desktop Runtime Hardening Closure
- [x] Bind HTTP and WebSocket listeners to `127.0.0.1` only.
- [x] Allocate dynamic ports and auth tokens from the Tauri runtime.
- [x] Apply strict CORS allowlisting and token validation to protected sidecar routes.
- [x] Remove synchronous filesystem reads from `/api/content` and generated asset serving in `src/server.ts`.
- [x] Replace full-buffer JSON body parsing with streaming or temp-file handling for large clipboard and render payloads.

#### Phase 2: Transport Modernization
- [x] Introduce an environment-aware runtime bridge for Tauri desktop URL and auth propagation.
- [ ] Replace remaining raw desktop HTTP and WebSocket request paths with Tauri-native IPC or a formal JSON-RPC transport.
- [x] Consolidate all frontend transport fallbacks behind one adapter so no feature depends on hardcoded loopback defaults when runtime metadata is unavailable.

#### Phase 3: Storage and Query Scalability
- [ ] Introduce a storage-provider abstraction that can target desktop sidecar, Tauri commands, Capacitor filesystem, and future SQLite or Wasm runtimes.
- [ ] Replace monolithic `graph_data.json` as the primary runtime storage with SQLite-backed partial queries.
- [ ] Add persistent frontend cache layers (IndexedDB via `localForage` or `Dexie`) for cold-start reduction.
- [ ] Evaluate MessagePack or an equivalent binary transport for dense graph payload delivery.

#### Phase 4: Packaging and Multi-Platform Delivery
- [x] Replace the Windows-only `build:sidecar` target (`node18-win-x64`) with multi-target Node 22 packaging.
- [x] Add compressed sidecar build flows (`--compress Brotli`, `--no-bytecode`) and verify packaged runtime assets.
- [x] Add packaged-sidecar validation for macOS and Linux, not only Windows desktop.
- [ ] Finalize iOS privacy-manifest work for filesystem access declarations.
- [ ] Keep the mobile release policy explicit: current Capacitor delivery is packaged read-only content, not desktop-equivalent build or sidecar parity.

### Verification Snapshot (Reviewed on 2026-03-07)
- [x] `npx tsc --pretty false`
- [x] `npx jest src/reader_renderer.test.ts src/source_manager.loadflow.test.ts src/pathbridge.handshake.contract.test.ts src/server.migration.test.ts --runInBand`
- [x] `cargo test --manifest-path src-tauri/Cargo.toml`
- [x] `./src-tauri/bin/godot-x86_64-pc-windows-msvc.exe --headless --path ./path_mode --quit` on Windows PowerShell

### Release Position
- [ ] Do not claim full all-platform feature parity until storage abstraction and transport migration are completed.
- [ ] Treat Capacitor native delivery as a bounded read-only runtime until native content and graph-loading parity is implemented.

# 2026-03-04 v1.5.13 - Capacitor Physical-Device Acceptance Runbook Closure


### Objective

Convert the last open `v1.5.9` sign-off item (Capacitor physical-device checklist evidence) into an executable and repeatable workflow.

### Delivered

- [x] Added device-acceptance probe script:
  - [x] `scripts/verify-capacitor-device-acceptance.js`
  - [x] validates:
    - [x] APK exists (`android/app/build/outputs/apk/debug/app-debug.apk`)
    - [x] `adb` is available
    - [x] at least one online Android device is attached
- [x] Added npm command:
  - [x] `npm run verify:capacitor:device`
- [x] Revalidated current APK build pipeline:
  - [x] `npm run mobile:build:capacitor` -> PASS on 2026-03-04

### Physical-Device Acceptance Checklist (Release Sign-Off)

- [ ] Device connection gate passes:
  - [ ] `npm run verify:capacitor:device`
- [ ] App startup behavior validated on real device.
- [ ] Source panel behavior validated on real device.
- [ ] Reader behavior validated on real device.
- [ ] Path mode entry/exit behavior validated on real device.
- [ ] Evidence artifacts attached:
  - [ ] device serial (masked if needed)
  - [ ] test date/time
  - [ ] screenshots or short screen recording
  - [ ] observed result notes (pass/fail + issue IDs)

### Current Status

- [x] Build + environment side of acceptance is ready.
- [ ] Real-device execution evidence is still required to close the final sign-off checkbox in `v1.5.9`.

---

# 2026-03-04 v1.5.11 - Capacitor Runtime Boundary Closure (Option B Execution)


### Decision Snapshot

- [x] Capacitor runtime boundary hardening is now implemented under Option B (read-only mobile policy).
- [x] Source/Reader runtime behavior no longer assumes desktop sidecar APIs in native Capacitor.
- [x] Regression contract coverage for Capacitor runtime boundary is added and wired into migration gate.
- [ ] Capacitor in-app folder/build/content parity with desktop remains intentionally out of scope for current release policy.

### Delivered in Code

- [x] `src/frontend/source_manager.js`
  - [x] Added native Capacitor runtime detection (`window.Capacitor.getPlatform` / `isNativePlatform`).
  - [x] Applied explicit capability profile in native Capacitor:
    - [x] `supports_sidecar=false`
    - [x] `supports_build=false`
    - [x] `supports_content_api=false`
    - [x] `supports_kb_runtime_change=false`
  - [x] Added deterministic source-panel fallback for read-only mode:
    - [x] path label -> `source.capacitor.bundlePath`
    - [x] single packaged option -> `PACKAGED_GRAPH`
    - [x] load button disabled + guarded alert (`source.error.capacitorReadOnly`)
- [x] `src/frontend/reader.js`
  - [x] Added Capacitor-native detection fallback to enforce read-only content strategy when runtime caps are unavailable early.
- [x] i18n updates:
  - [x] `src/frontend/locales/en.json`
  - [x] `src/frontend/locales/zh.json`
  - [x] added `source.capacitor.packagedGraph`
  - [x] added `source.capacitor.bundlePath`
  - [x] added `source.error.capacitorReadOnly`
- [x] Added Capacitor boundary contract tests:
  - [x] `src/capacitor.runtime.contract.test.ts`
  - [x] included in `package.json` -> `test:migration`

### Verification Evidence (Executed on 2026-03-04)

- [x] `npm run test:migration` -> PASS (`66` tests)
- [x] `npm run test:tauri` -> PASS (`18` tests)
- [x] `npm run mobile:build:capacitor` -> PASS
  - [x] APK output: `android/app/build/outputs/apk/debug/app-debug.apk`

### Status Update for Previously Open Items

- [x] `v1.5.9` item: **Capacitor runtime behavior hardening** -> closed at code + test level.
- [x] `v1.5.9` item: **integration test coverage for Capacitor runtime boundary** -> closed (`src/capacitor.runtime.contract.test.ts`).
- [ ] `v1.5.9` item: **manual Capacitor APK checklist on physical device** remains pending explicit on-device execution evidence.
- [ ] **NO-GO remains** for claiming “all-platform parity complete”.

---

# 2026-03-03 v1.5.10 - Option A P0 Closure (Tauri Android Native Folder/Build/Content Flow)


### Decision Snapshot

- [x] Option A P0 is implemented for Tauri Android runtime.
- [x] Android runtime now supports local graph build without Node sidecar.
- [x] Desktop and web behavior remain unchanged.
- [ ] Capacitor runtime parity is still a separate scope (build backend parity not yet native-equivalent).

### Delivered in Code

- [x] Added native runtime build command in Rust:
  - [x] `build_graph_runtime(request)` in `src-tauri/src/lib.rs`
  - [x] builds from `Knowledge_Base/<target>` (or `ALL_FOLDERS`)
  - [x] writes runtime artifacts to `runtime_data/`:
    - [x] `data.js`
    - [x] `graph_data.json`
    - [x] `data_<target>.js`
    - [x] `graph_data_<target>.json`
- [x] Updated Android runtime capabilities:
  - [x] `supports_sidecar=false`
  - [x] `supports_build=true`
  - [x] `supports_content_api=true`
- [x] Routed source loading/build flow in `src/frontend/source_manager.js`:
  - [x] sidecar path stays primary when available (`/api/build`)
  - [x] Tauri native fallback uses `invoke('build_graph_runtime', { request })`

### Verification Evidence (Executed on 2026-03-03)

- [x] `npm run test:migration` -> PASS (`55` tests)
- [x] `npm run test:tauri` -> PASS (`16` tests)
- [x] `npm run verify:android:env` -> PASS (SDK + cmdline-tools + NDK detected)

### P0 Status Update

- [x] `Option A: Implement mobile-native equivalent for folder/build/content flow` (Tauri Android path).
- [ ] Capacitor-specific build/content runtime parity remains open and tracked under follow-up mobile scope.

---

# 2026-03-03 v1.5.9 - Electron Removal Final Gate (Audit-Driven Action Plan)


### Decision Snapshot

- [x] Desktop runtime migration from Electron to Tauri is technically ready.
- [x] Tauri desktop build/runtime path is active and test-verified.
- [x] Capacitor and Tauri Android build pipelines both exist.
- [ ] Full cross-platform runtime parity is not complete yet.

### Scope Clarification (From Audit)

- Desktop:
  - [x] Electron IPC-equivalent flows are migrated to sidecar HTTP + Tauri commands.
  - [x] Electron scripts/dependencies are absent from active package/runtime surface.
- Mobile:
  - [x] Capacitor runtime is intentionally read-only and not equivalent to desktop sidecar runtime for folder/build/content APIs.
  - [x] Tauri Android runtime is no-sidecar but build/content-enabled (`supports_sidecar=false`, `supports_build=true`), while Capacitor remains `supports_build=false`.

### P0 - Required Before Claiming “Full Migration Complete”

- [x] **Productize mobile capability boundary decision (must choose and freeze release policy)**
  - [x] Option A: Implement mobile-native equivalent for folder/build/content flow (Tauri Android native runtime path).
  - [x] Option B: Officially define Capacitor mobile as cache/read-focused scope and remove parity ambiguity in UI/docs.

- [x] **Capacitor runtime behavior hardening**
  - [x] Detect Capacitor runtime explicitly and avoid desktop-sidecar assumptions in source loading.
  - [x] Provide deterministic fallback UX when `/api/folders`, `/api/build`, `/api/content` are unavailable.
  - [x] Define content strategy for reader in Capacitor mode (read-only packaged graph policy + explicit unsupported notice for unavailable content APIs).

- [x] **Mobile acceptance gate**
  - [x] Add explicit integration test coverage for Capacitor runtime boundary behavior.
  - [x] Add manual verification checklist for Capacitor APK:
    - [x] startup behavior
    - [x] source panel behavior
    - [x] reader behavior
    - [x] path mode entry/exit behavior
  - [ ] Collect physical-device execution evidence against the checklist for final release sign-off.
    - [x] preflight command available: `npm run verify:capacitor:device`
    - [ ] latest probe result still shows no online Android device connected (2026-03-04).

### P1 - Migration Hygiene and Decommission Clean-up

- [x] **Archive/remove residual Electron artifacts**
  - [x] Remove empty `src/electron` directory or add explicit archive marker.
  - [x] Replace misleading names/comments containing “electron” where runtime is already bridge-based (for maintainability clarity).

- [x] **Documentation alignment**
  - [x] Mark `docs/tauri_tasks.md` as historical where it still lists pre-migration TODOs.
  - [x] Keep active docs Tauri-first and clearly separate desktop vs Android vs Capacitor capability boundaries.

### P2 - Reliability and Release Guardrails

- [x] Keep release gate mandatory:
  - [x] `npm run test:migration`
  - [x] `npm run test:tauri`
- [x] Keep Android environment gate mandatory:
  - [x] `npm run verify:android:env`
- [x] Add CI job matrix to prevent silent regressions:
  - [x] desktop migration suite
  - [x] tauri rust suite
  - [x] mobile pipeline contract suite

### Go/No-Go Policy (Current)

- [x] **GO**: Desktop Electron decommissioning.
- [x] **NO-GO policy active**: Do not claim “all-platform runtime parity complete” while Capacitor remains in read-only scope.

---

# 2026-03-03 v1.5.8 - PathBridge Handshake + Tauri Early-Socket Stability


### Added in This Round

- [x] Removed Godot-incompatible WebSocket query URL in `path_mode/scripts/ws_client.gd`:
  - [x] `ws://127.0.0.1:9876/?client=godot` -> `ws://127.0.0.1:9876`
  - [x] Added explicit `identify` handshake payload after connect.
  - [x] Added pre-connect message queue flush to avoid early configure-drop warnings.

- [x] Added explicit client-identification protocol in `src/core/PathBridge.ts`:
  - [x] Added `identify` message handling.
  - [x] Added runtime client tag update (`setClientTag`) with sanitization.
  - [x] Kept URL-tag fallback compatible for browser legacy callers.

- [x] Hardened frontend Bridge behavior in `src/frontend/path_app.js`:
  - [x] Removed query-tag URL usage and switched to base `ws://localhost:9876`.
  - [x] Sent `identify` payloads for both `frontend` and `frontend-early`.
  - [x] Added Tauri-runtime guard using `window.__TAURI__` OR `navigator.userAgent.includes('Tauri')` to prevent accidental `frontend-early` socket startup in Tauri.

- [x] Added regression coverage:
  - [x] New contract file: `src/pathbridge.handshake.contract.test.ts`.
  - [x] Included in `test:migration` suite.

### Verification

- [x] `npm run test:migration` -> PASS (`53` tests).
- [x] `npm run test:tauri` -> PASS (`14` tests).

### Scope Safety

- [x] Desktop behavior unchanged except bridge handshake logging/tagging stability.
- [x] Web browser mode still supports early bridge mode.
- [x] Android Pathmode flow remains unchanged.

---

# 2026-03-03 v1.5.7 - Android Native Pathmode Smoke Lifecycle Automation


### Added in This Round

- [x] Added Android runtime smoke lifecycle script:
  - [x] `scripts/smoke-android-pathmode.js`
  - [x] checks `MainActivity -> PathmodeGodotActivity -> MainActivity` through `adb` + `dumpsys activity`.
  - [x] sends back event (`KEYCODE_BACK`) to verify activity return path.
  - [x] supports optional strict mode:
    - [x] `NOTE_CONNECTION_ANDROID_SMOKE_REQUIRE_DEVICE=1` makes no-device state fail
    - [x] default mode skips gracefully when no device/emulator is attached.

- [x] Added npm entrypoint:
  - [x] `smoke:android:pathmode` in `package.json`.

- [x] Added regression contracts for smoke integration:
  - [x] `src/android.pathmode.smoke.contract.test.ts`.
  - [x] Updated `src/mobile.pipeline.test.ts` to assert smoke script registration.
  - [x] Updated `test:migration` suite list to include smoke contract test.

### Verification

- [x] `npm run test:migration` -> PASS (`50` tests).
- [x] `npm run test:tauri` -> PASS (`14` tests).
- [x] `npm run smoke:android:pathmode` -> PASS (graceful skip without connected device).

### Scope Safety

- [x] No desktop behavior changes.
- [x] No web behavior changes.
- [x] Android smoke flow is standalone and only invoked explicitly.

---

# 2026-03-03 v1.5.6 - Option A Android Native Pathmode (Godot Full-Screen) Execution


### Implemented in This Round

- [x] **Option A launch path implemented for Android**
  - [x] Added Android-native Pathmode launch command: `open_native_pathmode` in `src-tauri/src/lib.rs`.
  - [x] Added runtime capability flag: `supports_native_pathmode` (Android=true, desktop/web=false).
  - [x] Updated frontend Path Mode entry (`src/frontend/app.js`) to:
    - [x] prefer native Android launch when capability is enabled
    - [x] keep desktop/web flow unchanged (fallback to existing web Path Mode container)

- [x] **Android full-screen Godot activity bridge landed**
  - [x] Added tracked Android templates:
    - [x] `src-tauri/mobile/android/PathmodeBridge.kt`
    - [x] `src-tauri/mobile/android/PathmodeGodotActivity.kt`
  - [x] Added generated-project patch pipeline:
    - [x] `scripts/apply-tauri-android-pathmode.js`
    - [x] `scripts/run-tauri-android.js` now auto-applies patch before/after Android commands.
  - [x] Added Android asset sync for `path_mode` into `src-tauri/gen/android/app/src/main/assets/path_mode`.

- [x] **Exit back behavior implemented**
  - [x] Godot `Exit` now quits Android Pathmode activity and returns to main Tauri window (`path_mode/scripts/path_renderer.gd`).

- [x] **Android build path hardened**
  - [x] Added Android-only cargo memory controls in runner (`CARGO_BUILD_JOBS`, release opt/codegen tuning).
  - [x] Added patch logic for:
    - [x] Godot Maven dependency and manifest merge rules
    - [x] Kotlin plugin version alignment required by Godot Android artifact

### Verification

- [x] `npm run test:migration` -> PASS (`48` tests).
- [x] `npm run test:tauri` -> PASS (`14` tests).
- [x] `node scripts/run-tauri-android.js build` -> PASS.
  - [x] APK: `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk`
  - [x] AAB: `src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab`

### Scope Safety

- [x] Desktop behavior unchanged.
- [x] Web behavior unchanged.
- [x] Android-only logic is capability-gated and build-script-gated.

---

# 2026-03-03 v1.5.5 - Status Normalization Update (Proceeding)


### Revalidated in This Round

- [x] Re-ran migration gate suites:
  - [x] `npm run test:migration` -> PASS (`44` tests).
  - [x] `npm run test:tauri` -> PASS (`14` tests).
- [x] Confirmed `v1.5.3` and `v1.5.4` closure items remain valid (P0 engineering + P1 runtime-boundary UI).
- [x] Confirmed sidecar content-boundary checks and load/history contract tests remain green.

### Backlog Hygiene

- [x] Marked `v1.5.2` checklist as historical/superseded context to avoid execution ambiguity.
- [x] Kept historical checklist body intact for traceability (no destructive edits).

### Remaining Actionable Scope

- [ ] Final mobile parity decision remains open at product level:
  - [ ] Option A: implement Android-native build/content pipeline parity with desktop sidecar flow.
  - [x] Option B (active policy): keep Android capability-gated cache/read runtime and document boundary explicitly.

---

# 2026-03-03 v1.5.3 - Execution Progress Update (P0 Completed)


### Completed in This Execution Round

- [x] **Secure sidecar content API to match Rust boundary guarantees**
  - [x] Enforced KB-root boundary checks for `/api/content` in `src/server.ts`.
  - [x] Added regression tests for:
    - [x] allowed inside-root absolute path
    - [x] allowed legacy `Knowledge_Base` marker path
    - [x] blocked outside-root path (`403`)

- [x] **Lock cache prompt + single-load execution behavior (contract coverage)**
  - [x] Added source-manager load-flow guard contract tests:
    - [x] duplicate event-binding guard
    - [x] in-progress click guard
    - [x] single cache-choice prompt branch contract
  - [x] Existing server-side restore/build dedupe tests remain passing.

- [x] **Finalize Godot History consistency contract**
  - [x] Added `record_navigation_node(node_id)` in `path_mode_ui.gd`.
  - [x] Wired `path_renderer.gd` to record center-switch history on `render_path`.
  - [x] Added regression contract test for history hook presence.

- [x] **Final Go/No-Go technical gate (engineering portion)**
  - [x] `npm run test:migration` -> PASS (`43` tests).
  - [x] `npm run test:tauri` -> PASS (`14` tests).

### Remaining Product Decision (Non-blocking to Desktop Stability)

- [ ] Choose final mobile parity product scope:
  - [ ] Option A: Android-native equivalent build runtime.
  - [x] Option B (current active policy): cache/read-focused mobile runtime with explicit capability boundaries.

---

# 2026-03-03 v1.5.2 - Electron Removal Final Gate (Post-Audit Action Plan)


> Superseded Note (2026-03-03 v1.5.5): This section is preserved as historical plan context. P0/P1 closure evidence is recorded in `v1.5.3` and `v1.5.4` above. Unchecked boxes below are not current execution blockers unless explicitly reopened.

**Audit Decision Snapshot**

- [x] Desktop Electron -> Tauri migration is functionally successful.
- [x] Capacitor export pipeline remains available and buildable.
- [x] Tauri Android export pipeline is buildable.
- [ ] Full runtime parity across desktop/mobile is not complete yet.

### P0 - Must Complete Before Declaring Full Migration Closure

- [ ] **Secure sidecar content API to match Rust boundary guarantees**
  - [ ] Enforce KB-root boundary checks for `/api/content` in `src/server.ts`, equivalent to `read_node_content`.
  - [ ] Add regression tests covering allowed path, blocked outside path, and Windows/relative path variants.

- [ ] **Lock cache prompt + single-load execution behavior under Tauri startup races**
  - [ ] Add integration-level tests for:
    - [ ] "cache exists -> prompt appears exactly once"
    - [ ] "single click -> one restore/build path only"
  - [ ] Validate against sidecar dedupe + frontend reload guard interactions.

- [ ] **Finalize Godot History consistency contract**
  - [ ] Ensure center-switch events (double-click/manual switch) always append to History timeline.
  - [ ] Add deterministic tests for History updates after switch-center actions.

### P1 - Mobile/Export Parity Clarification and Hardening

- [ ] **Clarify Android runtime capability boundaries in product docs/UI**
  - [ ] Explicitly document that Android currently runs with `supports_sidecar=false` and `supports_build=false`.
  - [ ] Provide user-facing fallback guidance for cache-only mode.

- [ ] **Decide and implement mobile build parity strategy**
  - [ ] Option A: implement Android-native build/content pipeline equivalent to desktop sidecar flow.
  - [ ] Option B: keep cache/read-only scope and make it explicit as a product constraint.

### P2 - Documentation Hygiene (without deleting history)

- [ ] Tag historical Electron sections as archived context to reduce operator confusion.
- [ ] Keep active release/runbook sections Tauri-first and dual-mobile-path accurate.

### Final Go/No-Go Gate (Full-Scope)

- [ ] `npm run test:migration` passes with new parity tests.
- [ ] `npm run test:tauri` passes with new security and behavior tests.
- [ ] Manual verification passes for:
  - [ ] cache prompt appears once
  - [ ] load action executes once
  - [ ] History records center switches
- [ ] Security validation passes for sidecar content path boundaries.

---

# 2026-03-02 v1.5.1 - Android Runtime Parity Expansion (Targets + Content + Cache-Only UX)


**Goal**: Convert desktop-sidecar-only target/content flows into runtime-safe contracts for Tauri Android, while preserving desktop behavior.

### Completed This Round

- [x] **Target discovery parity landed**
  - [x] Added sidecar API `GET /api/available-targets` (folders + cached targets merged).
  - [x] Added Tauri command `get_available_targets` with equivalent behavior.
  - [x] Updated frontend source loading to prefer available-target APIs and fallback safely.

- [x] **Mobile-safe content read path landed**
  - [x] Added Tauri command `read_node_content(file_path)`.
  - [x] Enforced KB root boundary checks for content reads (reject outside-root access).
  - [x] Added legacy path rebasing for desktop-style `.../Knowledge_Base/...` file references.
  - [x] Updated reader fallback to use Rust command when sidecar is unavailable.

- [x] **Cache-only UX hardening for `supports_build=false` runtimes**
  - [x] Mobile source list now filters to cache-available targets.
  - [x] `ALL_FOLDERS` option shown only when active cache exists.
  - [x] Load button disabled when no cache candidate exists.

- [x] **Regression coverage and build evidence refreshed**
  - [x] Added/updated migration tests for new available-target and runtime-content contracts.
  - [x] `npm run test:migration` passed (`35` tests).
  - [x] `npm run test:tauri` passed (`14` tests).
  - [x] `npm run tauri:android:build` passed.
  - [x] `npm run tauri:android:build:universal` passed.

### Remaining Work (Current Scope)

- [ ] **In-app Android graph build pipeline parity**
  - [ ] Provide Android-native equivalent for desktop `/api/build` workflow.
  - [ ] Define SAF/File API based import and persistent permission strategy for KB sources.

- [ ] **Path Mode/Godot Android strategy finalization**
  - [ ] Keep desktop-only intentionally with explicit UX messaging, or
  - [ ] design and implement Android-capable rendering/runtime alternative.

---

# 2026-03-02 v1.5.0 - Tauri Android Build Unblock (Arm64 Deterministic Path)


**Goal**: Unblock Tauri Android from environment/setup failures to a reproducible build path, while keeping Capacitor and Tauri Android dual generation available.

### Completed This Round

- [x] **Android SDK toolchain detection and enforcement**
  - [x] Confirmed Android SDK Command-line Tools (`cmdline-tools/latest`) detection.
  - [x] Confirmed NDK detection (`ndk;27.2.12479018`) through preflight script.
  - [x] `npm run verify:android:env` now passes on the current machine.

- [x] **Desktop-only Rust dependencies isolated from Android target**
  - [x] Moved `rfd` dependency to desktop-only target section in `src-tauri/Cargo.toml`.
  - [x] Added Android-safe folder-picker fallback path in `src-tauri/src/lib.rs`.

- [x] **Android-specific Tauri runtime configuration**
  - [x] Added `src-tauri/tauri.android.conf.json` to clear `bundle.externalBin` for Android.
  - [x] Guarded desktop-only menu APIs and desktop process launch logic with `cfg(not(target_os = "android"))`.
  - [x] Android startup now intentionally skips desktop Node sidecar and Godot process launch.

- [x] **Tauri Android wrapper hardening**
  - [x] Added default Android target strategy: `aarch64` for `dev/build` to avoid armv7 LLVM OOM on Windows hosts.
  - [x] Added override support via `NOTE_CONNECTION_TAURI_ANDROID_TARGET`.
  - [x] Fixed Windows process launch issue (`spawnSync npx.cmd EINVAL`) by invoking through `cmd.exe /d /s /c`.
  - [x] Added explicit spawn error/signal logging in `scripts/run-tauri-android.js`.

- [x] **Regression coverage updated**
  - [x] Updated `src/mobile.pipeline.test.ts` to assert arm64 default + override contract.
  - [x] Verified `npm run test:migration` pass (`30` tests).

- [x] **Build verification**
  - [x] Verified `node scripts/run-tauri-android.js build` pass.
  - [x] Verified `npm run tauri:android:build` pass.
  - [x] Generated artifacts:
    - `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk`
    - `src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab`

### Remaining Migration Items (P1.5 Follow-up)

- [ ] **Android runtime feature parity for desktop-only capabilities**
  - [ ] Replace or redesign Node sidecar-dependent APIs (`/api/build`, `/api/content`, folder scan/build pipeline) for Android runtime.
  - [ ] Define Android-native storage/input strategy (SAF/File APIs) for knowledge base selection and loading.

- [ ] **Path Mode/Godot on Android roadmap decision**
  - [ ] Keep Godot bridge desktop-only (current behavior), or introduce an Android-compatible rendering/runtime path.
  - [ ] Document expected UX/capability differences explicitly for Android users.

- [x] **Optional multi-ABI strategy**
  - [x] Keep `aarch64` as default stable target.
  - [x] Add opt-in universal ABI build path only when host memory/toolchain is sufficient.

---

# 2026-03-01 v1.4.9 - Runtime Verification Update (Desktop + Mobile)


**Goal**: Continue execution after `v1.4.8` with real pipeline runs, and convert remaining Tauri Android uncertainty into an explicit, actionable prerequisite gate.

### Completed This Round

- [x] **Desktop packaging re-verified**
  - [x] Ran `npm run tauri:build:mini` with `NOTE_CONNECTION_GODOT_EXE` set.
  - [x] Sidecar validation passed (`server` + `godot` binaries non-empty).
  - [x] MSI + NSIS artifacts generated successfully.

- [x] **Capacitor Android pipeline fully executed**
  - [x] Fixed `build_apk.bat` parse failures caused by unescaped parentheses inside `if (...)` blocks.
  - [x] Added non-interactive support (`NOTE_CONNECTION_NO_PAUSE` / `CI=true`) for automation.
  - [x] Ran `build_apk.bat` end-to-end and produced debug APK.

- [x] **Tauri Android preflight hardening**
  - [x] Added `scripts/verify-tauri-android-prereqs.js`.
  - [x] Added `npm run verify:android:env`.
  - [x] Wired preflight into:
  - [x] `tauri:android:init`
  - [x] `tauri:android:dev`
  - [x] `tauri:android:build`
  - [x] Result: clear deterministic error when `cmdline-tools/latest/bin/sdkmanager` is missing.

- [x] **Regression coverage updated**
  - [x] Expanded `src/mobile.pipeline.test.ts` to assert:
  - [x] Android preflight script wiring in npm commands.
  - [x] `build_apk.bat` automation flag support.
  - [x] `npm run test:migration` remains green.

- [x] **Dual-path aggregate command validated**
  - [x] Ran `npm run mobile:build:both`.
  - [x] Capacitor branch completed with APK output.
  - [x] Tauri Android branch stopped at explicit preflight check (expected until cmdline-tools are installed).

### Remaining External Prerequisite (Environment)

- [x] **Install Android SDK Command-line Tools for Tauri Android runtime**
  - [x] Required path: `<ANDROID_SDK_ROOT>/cmdline-tools/latest/bin/sdkmanager(.bat)`.
  - [x] Verified with:
  - [x] `npm run verify:android:env`
  - [x] `npm run tauri:android:build`

---

# 2026-03-01 v1.4.8 - Migration Closure & Dual Android Verification


**Goal**: Close the migration action list with executable verification evidence, especially for `P1.5` (Capacitor + Tauri Android dual generation paths).

### Completed Checklist

- [x] **Dual Android pipeline guard tests added**
  - [x] Added `src/mobile.pipeline.test.ts` to lock down:
  - [x] Capacitor + Tauri Android script availability in `package.json`.
  - [x] `capacitor.config.ts` `webDir` consistency (`dist/src/frontend`).
  - [x] `build_apk.bat` expected sync/build steps.
  - [x] `src-tauri/tauri.conf.json` sidecar entries (`bin/server`, `bin/godot`).

- [x] **Migration regression suite expanded**
  - [x] Updated `test:migration` in `package.json` to include `src/mobile.pipeline.test.ts`.
  - [x] Migration suite now covers runtime paths, cache/build dedupe, and dual mobile pipeline contract checks.

- [x] **Execution evidence refreshed (this run)**
  - [x] `npm run build:mini` -> pass.
  - [x] `npm run test:migration` -> pass (`29` tests).
  - [x] `npm run test:tauri` -> pass (`9` Rust tests).
  - [x] `npm run smoke:sidecar:relaunch` -> pass.

### Result

- [x] `P1.5` is now not only documented but also protected by automated regression checks.
- [x] Electron -> Tauri migration checklist is considered closed for the current repository scope (desktop Tauri-first + dual mobile generation entry points).

---

# 2026-03-01 v1.4.6 - Electron Removal Readiness Action Plan


**Goal**: Close all remaining Electron -> Tauri migration gaps so Electron can be removed without regression across desktop release and mobile export strategy.

### Phase P0 - Must Complete Before Electron Removal

- [x] **Implement Tauri persistent config parity (`kb_config` equivalent)**
  - [x] Persist selected KB path in Tauri app data.
  - [x] Persist user language in Tauri app data.
  - [x] Load both values on startup before frontend initialization.
  - [x] Acceptance: Restart keeps same KB root and menu language without manual re-selection.

- [x] **Harden Godot process launch for non-dev machines**
  - [x] Remove hardcoded absolute paths in `src-tauri/src/lib.rs`.
  - [x] Use packaged/bundled sidecar strategy for Godot executable resolution.
  - [x] Validate Godot binary presence in build artifacts (non-zero file, correct target naming).
  - [x] Acceptance: `npm run tauri build` artifact produced with sidecar validation pipeline.

- [x] **Add explicit child-process lifecycle management**
  - [x] Keep handles for Node sidecar and Godot child processes.
  - [x] Implement app shutdown hooks to terminate child processes deterministically.
  - [x] Add relaunch test to ensure no lingering `3000` port lock.
  - [x] Acceptance: Close app -> no orphan sidecar/Godot processes remain.

- [x] **Fix release-grade writable data/cache paths**
  - [x] Stop assuming write access to `dist/src/frontend` in packaged environments.
  - [x] Define a writable runtime directory (app data/cache) for generated `data.js` and `graph_data.json`.
  - [x] Update sidecar runtime env (`NOTE_CONNECTION_FRONTEND_DIR` + `NOTE_CONNECTION_RUNTIME_DATA_DIR`) and restore/cache logic accordingly.
  - [x] Acceptance: Build + cache restore works with writable runtime data path model in packaged flow.

- [x] **Complete first-run parity with Electron UX**
  - [x] Add first-run KB selection flow in Tauri when no saved config exists.
  - [x] Preserve current menu-based "Change KB / Reset" behavior with persistence.
  - [x] Acceptance: New install follows first-run setup and stores user choice permanently.

### Phase P1 - Stabilization and Verification

- [x] **Unify backend build logs to frontend loading overlay**
  - [x] Emit structured `build-log` events from Rust/sidecar bridge to frontend.
  - [x] Ensure long builds show progress in Tauri as in prior Electron UX.
  - [x] Acceptance: Loading overlay receives incremental backend logs during `/api/build`.

- [x] **Run release smoke tests and document evidence**
  - [x] Windows packaging test (`tauri build` output artifacts generated).
  - [x] Cache decision modal behavior test (`Load Existing` vs `Regenerate`).
  - [x] Single-click build dedupe test (no duplicate build/restore execution).
  - [x] Acceptance: Added reproducible pass evidence in `TEST_REPORT.md`.

- [x] **Clarify GPU startup command usage**
  - [x] Keep recommending `npm run tauri:dev:mini:gpu`.
  - [x] Avoid `npm run tauri:dev:mini --gpu` in docs/examples to prevent npm config warnings.
  - [x] Acceptance: README/manual examples contain only the supported command form.

### Phase P1.5 - Dual Mobile Delivery (Capacitor + Tauri Android)

- [x] **Keep both authoritative Android generation paths**
  - [x] Path A: Keep Capacitor as web-asset runtime with scoped feature set.
  - [x] Path B: Enable Tauri Android workflow per `docs/tauri_brainstorming.md`.
  - [x] Acceptance: Both paths are documented and exposed as build scripts.

- [x] **Capacitor path boundaries explicitly documented**
  - [x] Mark folder-based local build/load sidecar APIs as unsupported on-device unless backend is embedded.
  - [x] Keep mobile-safe fallback UX expectations for source loading/reader content.
  - [x] Acceptance: APK behavior constraints are explicitly documented.

- [x] **Tauri Android pipeline bootstrapped**
  - [x] Add Android build scripts and prerequisites for Tauri mobile.
  - [x] Keep Node-sidecar compatibility caveat documented until mobile-native backend replacement.
  - [x] Acceptance: Tauri Android commands are available for end-to-end pipeline execution.

### Phase P2 - Electron Decommission

- [x] **Remove Electron entry surface only after P0/P1 gates are green**
  - [x] Remove Electron scripts from `package.json`.
  - [x] Remove `main: dist/src/electron/main.js`.
  - [x] Remove Electron dependencies (`electron`, `electron-builder`, `electron-squirrel-startup`) after migration freeze.
  - [x] Archive/remove `src/electron/*` and `electron-builder.yml`.
  - [x] Acceptance: Desktop pipeline is Tauri-first with Electron decommissioned.

- [x] **Documentation cleanup**
  - [x] Update README build/deploy sections from Electron-first to Tauri-first.
  - [x] Keep historical changelog entries, but mark Electron path as deprecated/removed with date.
  - [x] Acceptance: No active docs instruct users to use Electron commands for current releases.

### Electron Removal Gate Checklist (Go/No-Go)

- [x] Persistent KB + language parity verified in Tauri.
- [x] Godot launch works without hardcoded local path.
- [x] No orphan child process after app exit.
- [x] Packaged Tauri build supports build/cache/reader workflows.
- [x] Dual mobile delivery strategy (Capacitor + Tauri Android) finalized and documented.
- [x] README and scripts fully aligned to Tauri.

---

# 2026-03-01 v1.4.5 - Physically-Based Bubbles & Cancel Completion


**Goal**: Upgrade the Godot visualizer with realistic physically-based soap bubbles, remove environmental obstructions, and add flexible task completion UI logic.

### Completed Checklist

- [x] **Physically-Based Shader**
  - [x] Ported 81-wavelength Thin-Film Interference Glassner logic to `bubble_material.gdshader`.
  - [x] Added `warpnoise3` and `sp_spectral_filter` for realistic thickness variations across the sphere.
- [x] **Physics Interactions**
  - [x] Converted central and peripheral bubbles from `MeshInstance3D` to `RigidBody3D`.
  - [x] Added `_physics_process` orbital magnetism so bubbles float and collide realistically without overlapping permanently.
  - [x] Removed `Floor` node obstruction from the `main.tscn` environment.
- [x] **Cancel Completion UI**
  - [x] "Mark Complete" button now dynamically toggles to "Cancel Completion".
  - [x] Connected dynamic states in `path_mode_ui.gd` and `path_renderer.gd` to appropriately mark/unmark nodes.

# 2026-03-01 v1.4.4 - Tauri Bridge Stabilization & Duplicate-Cycle Elimination


**Goal**: Finalize Bridge-first migration hardening for Tauri runtime by resolving cache/load duplication, websocket reconnect churn, and runtime path consistency issues.

### Completed Checklist

- [x] **Cache Decision Recovery**
  - [x] Restored explicit cache decision flow (`Load Existing` / `Regenerate`) before build when target cache exists.
- [x] **Duplicate Execution Protection**
  - [x] Added frontend single-flight guard for source loading.
  - [x] Added backend dedupe protections for `/api/build` and `/api/restore-cache`.
- [x] **PathBridge Diagnostics**
  - [x] Added tagged connection logging (client id/tag/address + close code/reason) to distinguish benign reconnects from real cycles.
- [x] **Godot WS Compatibility**
  - [x] Fixed Godot URL format to `ws://127.0.0.1:9876/?client=godot` to avoid invalid URL reconnect loops.
- [x] **Tauri Idle Reconnect Removal**
  - [x] Disabled `frontend-early` auto websocket bootstrap in Tauri mode.
- [x] **Language/Menu Idempotency**
  - [x] Added frontend and Rust-side no-op guards for repeated same-language sync calls.

### Files Updated

- `src/frontend/source_manager.js`
- `src/server.ts`
- `src/core/PathBridge.ts`
- `src/frontend/path_app.js`
- `path_mode/scripts/ws_client.gd`
- `src/frontend/i18n.js`
- `src-tauri/src/lib.rs`

# 2026-02-26 v1.4.3 - 9-Rule Tree Layout Engine

**Goal**: Port the 9-rule expansion/claiming/visibility engine from `tree_path_mockup.html` into production code. Replace simple contour-based layout with full ownership/claiming system.

## 9 Rules Reference

| #   | Rule (EN)                                 | 规则 (ZH)                  | Status |
| --- | ----------------------------------------- | -------------------------- | ------ |
| 1   | Expansion Order (FIFO claiming)           | 展开顺序（FIFO 认领）      | [x]    |
| 2   | Preceding Immunity (effective index)      | 前置免疫（有效索引）       | [x]    |
| 3   | Following Migration (spine+followers)     | 后续迁移（脊柱+后续）      | [x]    |
| 4   | Single Appearance (owner-based)           | 单次出现（基于所有者）     | [x]    |
| 5   | Cross-Tributary Isolation (edge filter)   | 跨支流隔离（边过滤）       | [x]    |
| 6   | Spine Always Visible (return on collapse) | 脊柱始终可见（折叠时返回） | [x]    |
| 7   | Sticky Claim (configurable toggle)        | 粘性认领（可配置开关）     | [x]    |
| 8   | Unit Migration (recursive claim)          | 单元迁移（递归认领）       | [x]    |
| 9   | Tributary Hierarchy Immunity              | 支流层级免疫               | [x]    |

## Implementation Checklist / 实施清单

- [x] **Core Algorithm / 核心算法** ([path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js))
  - [x] Add `expansionOrder` parameter / 添加 `expansionOrder` 参数
  - [x] Implement ownership system (`currentOwner`, `ownerPriority`) / 实现所有权系统
  - [x] Implement `tryClaim()` with 9 rules / 实现包含 9 条规则的 `tryClaim()`
  - [x] Implement `getEffectiveSpineIndex()` / 实现有效脊柱索引
  - [x] Implement `determineVisibility()` / 实现可见性判定
  - [x] Filter edges by ownership (Rule 5) / 按所有权过滤边
  - [x] Group hulls by ownership / 按所有权分组 hull

- [x] **Frontend Bridge / 前端桥接** ([path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js))
  - [x] Convert `forcedExpansionNodes` Set → `expansionOrder` Array / 转换为有序数组
  - [x] Add `stickyClaimEnabled` setting / 添加粘性认领设置

- [x] **Godot Renderer / Godot 渲染器** ([tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd))
  - [x] Edge filtering by `currentOwner` / 按所有者过滤边
  - [x] Hull collision avoidance / Hull 碰撞避让
  - [x] Node type coloring (spine/tributary/shared/migrated) / 节点类型着色
  - [x] Expansion indicator badge / 展开指示器徽章

- [x] **Worker** ([path_worker.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_worker.js))
  - [x] Pass `expansionOrder` + `stickyClaimEnabled` / 传递展开顺序和粘性认领

## Files Changed / 修改文件

| File                                 | Change                                 | 变更                                 |
| ------------------------------------ | -------------------------------------- | ------------------------------------ |
| `src/frontend/libs/path_core.js`     | Add 9-rule engine to `getTreeLayout()` | 向 `getTreeLayout()` 添加 9 规则引擎 |
| `src/frontend/path_app.js`           | Ordered expansion tracking             | 有序展开追踪                         |
| `path_mode/scripts/tree_renderer.gd` | Edge/hull/color updates                | 边/hull/颜色更新                     |
| `src/frontend/path_worker.js`        | Pass new parameters                    | 传递新参数                           |

## Reference / 参考

- Mockup: [tree_path_mockup.html](file:///e:/Knowledge_project/NoteConnection_app/tree_path_mockup.html)
- Previous plan: [implementation_plan.md](file:///e:/Knowledge_project/NoteConnection_app/implementation_plan.md) Phase 3
- Design notes: [brainstorming.md](file:///e:/Knowledge_project/NoteConnection_app/brainstorming.md) Session 6

---

# 2026-02-01 v1.4.1 - Path Mode v2: Orbital Learning Architecture

**Goal**: Transform Path Mode into an immersive, game-like learning experience with 3D bubble visualization and progress tracking.

## Architecture Overview

### Hybrid Visualization Strategy

1. **Godot Desktop** (Port 9876): Vulkan/OpenGL + 3D iridescent bubbles
2. **Web Fallback**: Canvas/WebGL for Android/Browser
3. **SVG Fallback**: For graphs ≤500 nodes

### Learning Modes

- **Domain Learning**: Topological sort of concept cluster (learn entire subject area)
- **Diffusion Learning**: Shortest path from target backwards to prerequisites

---

## Finalized Design Decisions

| Decision             | Final Choice                       | Rationale                      |
| -------------------- | ---------------------------------- | ------------------------------ |
| Display Limit        | 1 Central + 1-4 Peripheral         | Adapts to connectivity         |
| Zero In-Degree       | Use highest relevance score        | Ensures meaningful peripherals |
| Peripheral Selection | In-degree first + association fill | Balances order with discovery  |
| Central Content      | Title + Progress indicator         | Core UX requirement            |
| Peripheral Labels    | 15 chars + ellipsis                | Clean yet informative          |
| Transition           | Orbital rotation (~500ms)          | Matches metaphor               |
| Gold Star Sidebar    | Collapsible `★ × {N}` format       | Reduces clutter                |

---

## Implementation Checklist

- [ ] **Orbital Bubble Layout**
  - [x] Central bubble = current priority node (large, bright)
  - [x] Peripheral bubbles = connected nodes (smaller, semi-transparent)
  - [x] Smooth animation on central node switch
  - [ ] **Orbital rotation animation** (~500ms arc transition)
  - [ ] Layer separation (peripheral cannot overlap central text)
  - [ ] 3D iridescent bubble shader (fresnel + thin-film interference)

- [ ] **Peripheral Node Selection Algorithm**
  - [ ] Domain Mode: In-degree nodes first, fill with highest-association
  - [ ] Diffusion Mode: High-association to current (exclude target out-degree)
  - [ ] Zero in-degree fallback: Select by relevance score

- [ ] **Central Bubble Content**
  - [ ] Node title (max 24 chars)
  - [ ] Progress indicator: "X of Y prerequisites learned"
  - [ ] Peripheral labels: Title only (max 15 chars + ellipsis)

- [ ] **Learning Progress Tracking**
  - [ ] "Mark Complete" button shrinks central to gold mini-bubble
  - [ ] Collapsible sidebar: `★ × {count}` header format
  - [ ] Click sidebar item → Opens reader
  - [ ] localStorage persistence by default
  - [ ] Auto-advance to next highest priority node

- [ ] **Settings: Path Mode Section**
  - [ ] Add "Path Mode" section to settings modal
  - [ ] "Retain Learning History" checkbox (default ON)
  - [ ] "Auto-reconstruct path on start change" toggle
  - [ ] Integrate with `SettingsManager`

- [ ] **Focus-like Interactions**
  - [x] Double-click central → Opens reader with node content
  - [x] Double-click peripheral → Orbital rotation to center
  - [x] Canvas hit-testing for click detection

- [ ] **Future Path Tree View**
  - [ ] D3-based tree layout for future learning path
  - [ ] Click tree node → Switch central view
  - [ ] Visual states: ★ Completed, ● Current, ○ Pending

- [ ] **Enhanced Graphical Tree View (v2)**
  - [ ] SubViewport overlay panel with collapsible drawer
  - [ ] Bezier curve rendering (parent-child connections)
  - [ ] 4 selectable visual themes:
    - [ ] **Colorful Status** (default): Gold/Cyan/Gray by state
    - [ ] **Dark**: Dark bg, gradient nodes, soft blue/purple curves
    - [ ] **Glass/Frosted**: Semi-transparent, glowing curves
    - [ ] **Minimal Monochrome**: White/gray, thin curves
  - [ ] Tab buttons: `[Subtree] [Full Path]`
  - [ ] Dropdown style selector in header
  - [ ] Node interactions:
    - [ ] Single-click: Expand/collapse + context menu
    - [ ] Double-click: Navigate (make central)
    - [ ] Context menu: Navigate / Mark Complete / Unmark
  - [ ] **New Files**:
    - [ ] `tree_view_panel.tscn` + `tree_view_panel.gd`
    - [ ] `tree_renderer.gd` (bezier curve drawing)
    - [ ] `tree_styles.gd` (4 visual themes)

- [ ] **Godot Desktop Renderer**
  - [ ] Upgrade `path_renderer.gd` to 3D MeshInstance3D
  - [ ] Implement `bubble_material.gdshader` (fresnel + iridescence)
  - [ ] Create `learning_state_machine.gd` for flow control
  - [ ] Central/Peripheral bubble differentiation
  - [ ] Bidirectional interaction via WebSocket
  - [ ] `node_clicked` signal → PathBridge → Frontend

- [ ] **Frontend Web Fallback**
  - [ ] Create `path_orbital.js` (Canvas orbital renderer)
  - [ ] Create `path_tree.js` (D3 tree layout)
  - [ ] Orbital rotation animation in Canvas

---

## File Changes Required

### Backend

- **[MODIFY]** `src/frontend/libs/path_core.js`
  - Add `getPeripheralNodes(centralId, mode)` method
  - Add `getTreePath(currentId, learningPath)` for tree view
  - Add progress tracking state management

### Godot

- **[MODIFY]** `path_mode/scripts/path_renderer.gd` → 3D rendering
- **[NEW]** `path_mode/scripts/learning_state_machine.gd`
- **[NEW]** `path_mode/shaders/bubble_material.gdshader`
- **[MODIFY]** `path_mode/scripts/ws_client.gd` → New message handlers

### Frontend

- **[NEW]** `src/frontend/libs/path_orbital.js`
- **[NEW]** `src/frontend/libs/path_tree.js`

---

# 2026-01-23 v1.2.0 - Path Mode & Desktop Renderer

**Goal**: Transform the graph into a structured learning curriculum and enable high-fidelity desktop rendering.

- [x] **Path Mode (Learning Paths)**
  - [x] **strategies**: Implemented "Foundational" (Base-first) and "Core" (Centrality-first) sorting algorithms.
  - [x] **Modes**:
    - **Domain Learning**: Topological sort of a concept cluster to map a full subject area.
    - **Diffusion Learning**: Shortest-path extraction from a target node backwards to its prerequisites.
  - [x] **Visualization**:
    - **Radial / Tree Layouts**: specialized D3 layouts for linearizing graphs.
    - **Progress Tracking**: Visual states for "Learned", "Next", and "Locked" nodes.
- [x] **Hybrid Architecture**
  - [x] **Godot Bridge**: Established WebSocket communication (`Start port: 9876`) between Electron and Godot 4.3.
  - [x] **Native Renderer**: Low-latency Vulkan/OpenGL renderer for the "Path Mode" visualization on Desktop.
  - [x] **Web Fallback**: Full feature parity in Web/Canvas mode for Android and browser users.

# 2026-01-23 v1.1.2 - Path Resolution & UI Stability

**Goal**: Resolve static file serving issues on Windows and fix UI unresponsiveness in the Welcome Modal.

- [x] **Backend Fixes**
  - [x] **URL Parsing**: Improved `server.ts` to ignore query strings when mapping static files, enabling cache-busting `data.js?v=...` to work correctly.
- [x] **UI Stability**
  - [x] **Z-Index Management**: Fixed `welcome.js` to explicitly restore `z-index: 1000` to the folder menu after skipping the tutorial.

# 2026-01-22 v1.1.1 - Mobile Build Automation

**Goal**: Automate the Android APK build process to lower the barrier for mobile deployment.

- [x] **Mobile DevOps**
  - [x] **Build Script**: Created `build_apk.bat` for zero-config build orchestration on Windows.
  - [x] **Environment Checks**: Automated verification of Node.js, Java JDK, and Android SDK.
  - [x] **Documentation**: Updated all manuals with the new one-click build method.

# 2026-01-22 v1.1.0 - CI/CD Automation

**Goal**: Improve system robustness through protocol handler fixes, i18n consolidation, and onboarding UI refinement.

- [x] **Multilingual Consolidation**
  - [x] **Centralized I18n**: Removed redundant hardcoded translation logic from `app.js` and integrated with `I18nManager`.
  - [x] **UI Consistency**: Fixed "Mixed Language" issues in the Welcome Modal and Loading screen.
- [x] **Onboarding UI Refinement**
  - [x] **Tutorial Stability**: Fixed Focus Mode activation in tutorials by exposing `enterFocusMode` and `exitFocusMode` as global APIs.
  - [x] **Welcome Modal UX**: Optimized trigger timing in `source_manager.js` to ensure accurate display based on data state.
- [x] **Protocol Handler & Caching**
  - [x] **Cache-Busting**: Implemented dynamic script loading in `source_manager.js` using timestamps to prevent browser caching of `data.js`.
  - [x] **Protocol Optimization**: Refined `app://` protocol handler in `main.ts` using `net.fetch` for better reliability.
- [x] **Mobile Build Automation**
  - [x] **Build Script**: Implemented `build_apk.bat` for one-click Android APK generation (Zero-Config).
  - [x] **Documentation**: Updated User Manual and README with build instructions.

---

# 2026-01-14 v1.0.0 - Production Release

**Goal**: Official production release with optimized Focus Mode, GPU diagnostics, and enhanced security.

- [x] **Focus Mode Optimization**
  - [x] **Adjacency Cache**: Implemented O(1) adjacency lookup for neighbors, reducing Focus Mode entry time by 50-500x.
  - [x] **Edge Map for Scoring**: Optimized neighbor scoring by caching edge weights.
  - [x] **Batched Rendering**: Wrapped UI updates in `requestAnimationFrame` to prevent layout thrashing.
- [x] **Random Focus**: Added a dice icon next to the search bar for discovering and focusing on random nodes instantly.
- [x] **GPU & Security**
  - [x] **Forced GPU Mode**: Explicitly set GPU mode with detailed hardware vendor/renderer reporting.
  - [x] **CSP Enhancement**: Updated Content Security Policy to allow external font loading (Google Fonts).
  - [x] **Security Hardening**: Removed insecure `enableBlinkFeatures` flag.
- [x] **User-Defined Knowledge Base**
  - [x] **Persistence**: Implemented `kb_config.json` to store user-selected paths.
  - [x] **First-Run Experience**: Added setup wizard for selecting initial KB folder.
  - [x] **Menu Integration**: Added "Change Knowledge Base" and "Reset to Default" to File menu.
- [x] **Stability & Installer Reliability**
  - [x] **Mini Build Fix**: Resolved first-run crashes and implemented automatic cleanup of pre-generated data files in mini mode.
  - [x] **Worker Paths**: Fixed worker path resolution issues in production environment.
- [x] **Absolute Offline Support**
  - [x] **Local Assets**: Migrated all CDN dependencies (D3, KaTeX, Mermaid, etc.) to local assets.
  - [x] **CSP Security**: Updated CSP to support absolute offline operation.
- [x] **Focus Mode Fidelity**
  - [x] **Visual Restoration**: Guaranteed perfect radius and font-size restoration when exiting focus mode.
  - [x] **Interaction**: Fixed D3 sibling selection errors in Focus Mode.
- [x] **Physics Defaults**
  - [x] **Spacing**: Increased default link distance to 250px and collision to 25px for better legibility.

---

# 2026-01-13 v0.9.83 - GPU Rendering Debugging

**Goal**: Resolve race conditions during layout switching due to asynchronous Worker messages, enhance interaction stability in Focus Mode, and improve layout restoration security.

- [x] **Worker Handshake Protocol**
  - [x] **Display Lock**: Implemented `isLayoutSwitching` state machine to block stale `tick` messages during transitions.
  - [x] **Bi-directional Sync**: Introduced `layoutSwitchDone` loop to ensure UI and Worker coordinates are perfectly aligned.
- [x] **Focus Mode Dragging Isolation**
  - [x] **Manual Dragging**: Focus Mode nodes no longer send drag messages to the Worker; coordinates are calculated directly on the main thread.
  - [x] **Display Refresh**: Fixed race condition bug where late messages would overwrite manually set coordinates.
- [x] **Layout Restoration Safety**
  - [x] **Threshold Validation**: Set a 50% success threshold for cache restoration.
  - [x] **Auto Fallback**: If many nodes are missing or data is inconsistent, automatically force a physics relaxation phase.
- [x] **Analysis Panel Stability**
  - [x] **Render Optimization**: Adjusted `updateLayout` logic to strictly prohibit center force resets during panel resizing under "Freeze Layout".
- [x] **GPU Worker Integration**
  - [x] **Worker Acceleration**: Fully enabled GPU forces (`gpuManyBody`, `gpuLink`) within `simulationWorker.js`.
  - [x] **Environment Fix**: Refactored `layout_gpu.js` to be compatible with Web Worker `self` context via `globalScope`.
  - [x] **Persistence Fix**: Optimized `updateParams` in Worker to update existing forces using `.strength()` instead of replacing them, preventing accidental CPU-fallback.
  - [x] **Settings Sync**: Verified `gpuRendering` flag is correctly passed to the Worker during initialization.

# Project Build Plan: Progressive Hierarchical Knowledge Graph

This document outlines the roadmap for building `NoteConnection`, a system capable of visualizing tens of thousands of knowledge points as a Directed Acyclic Graph (DAG), highlighting hierarchical relationships and learning paths.

---

# 2026-01-12 v0.9.74 - GPU Link Force & Robustness

**Goal**: Implement GPU-accelerated Link Force and finalize stable layout switching with state preservation and WebGL resource management.

- [x] **GPU Link Force Acceleration**
  - [x] **GPULinkForce Class**: Implemented high-performance spring force in `layout_gpu.js`.
  - [x] **Gather Algorithm**: Optimized neighbor processing using flattened adjacency structures.
  - [x] **D3 Integration**: Added API shims (`links`, `strength`, `distance`) for seamless `app.js` integration.

- [x] **Physics Robustness & Stability**
  - [x] **Velocity Clamping**: Prevents node "explosions" by capping velocity at 100.
  - [x] **NaN Safety**: Implemented math guards in GPU kernels and `isFinite` checks in JS.
  - [x] **Shadowing Fix**: Renamed internal `links` to `_links` in `GPULinkForce` to prevent property-method collision.
  - [x] **Focus Mode Support**: Updated `enterFocusMode` and `exitFocusMode` in `app.js` to handle GPU forces.
  - [x] **Focus Mode Isolation**: Enforced completely independent node dimensions and positioning, with zero leakage to the main interface upon exit.
  - [x] **Focus Mode Interactions**: Enabled manual node dragging (without physics) and fixed race condition causing position reset.
  - [x] **Query History**: Implemented a history dropdown in Focus Mode; pins duplicate nodes to top of list.
  - [x] **Analysis Stability**: Added auto-freeze and prevented redundant layout updates (center force reset) during resize.
  - [x] **Analysis Scroll**: Fixed container styles to ensure the "Filtered Nodes" list is vertically scrollable.

- [x] **Layout Switching & Resource Fixes**
  - [x] **Switch Logic**: Implemented "First Switch" relaxation vs "Subsequent Switch" restoration logic.
  - [x] **Cache Persistence**: Enforced strict validation of cached layout states; falls back to relaxation if cache is invalid or partial.
  - [x] **Race Condition Fix**: Implemented Worker Handshake Protocol (`isLayoutSwitching`) to block stale ticks causing layout reversion.
  - [x] **GPU Resource**: Prevented redundant GPU kernal re-compilation on layout switches by reusing manager instances. for `SharedGPU`, preventing WebGL context leaks.
  - [x] **Constructor Safety**: Enhanced `GPU.GPU` detection for varying library builds.
  - [x] **Responsiveness**: Optimized layout switching to be near-instant by deferring worker synchronization.

---

# 2026-01-12 v0.9.73 - GPU Rendering Fix (Chaining Bug)

**Goal**: Fix the "Silent Failure" of GPU Force caused by a method chaining bug in `layout_gpu.js`, which prevented v0.9.72 from actually activating the GPU physics despite UI settings.

- [x] **Bug Fix**
  - [x] **Method Chaining**: Fixed `strength()` method in `layout_gpu.js` to return the `impl` function wrapper instead of `this`.
  - [x] **Verification**: Confirmed `d3.force` now correctly receives the callable function.

# 2026-01-12 v0.9.72 - GPU Optimized Rendering (Geek Edition)

**Goal**: Fulfill the "Geek" requirement to leverage AMDGPU (RX 7900XT) for smoother frontend rendering and parallel backend processing.

- [x] **Frontend GPU Rendering**
  - [x] **GPU Force Engine**: Implemented `GPUManyBodyForce` in `layout_gpu.js` using `gpu.js`.
  - [x] **Integration**: Added `libs/gpu-browser.min.js` and integrated into `app.js`.
  - [x] **UI Control**: Verified "GPU Optimised Rendering" checkbox in Settings. Default: Enabled.
  - [x] **Logic**: Dynamic switching between CPU (`d3.forceManyBody`) and GPU (`gpuManyBody`) physics engines.

- [x] **Backend Optimization Confirmation**
  - [x] **Parallelism**: Confirmed `GraphBuilder` uses `LayoutEngine` with Worker threads.
  - [x] **GPU Backend**: Confirmed `LayoutEngine` uses `amdgpu/LayoutGPU.ts` if enabled.

---

# 2026-01-10 v0.9.71 - Backend Layout & Static Mode

**Goal**: Optimize performance for massive graphs (50k+ nodes) by offloading layout calculations to backend workers and implementing a static rendering mode.

- [x] **Backend Parallel Layout**
  - [x] **Layout Engine**: Created `LayoutEngine.ts` and `layoutWorker.ts` to run `d3-force` simulation on backend threads.
  - [x] **Integration**: `GraphBuilder` now automatically triggers backend layout calculation for graphs > 100 nodes.
  - [x] **GPU Acceleration**: Implemented `LayoutGPU.ts` using `gpu.js` to accelerate layout on AMDGPU.
  - [x] **Performance**: Reduces frontend initialization time by providing pre-calculated coordinates.

- [x] **Frontend Optimizations**
  - [x] **Static Mode**: Introduced a "Static Mode" toggle.
    - [x] **Auto-Enable**: Automatically enabled for >5000 nodes or >200,000 edges.
    - [x] **Behavior**: Simulation runs for 2 seconds (warm-up) then stops to save CPU.
    - [x] **Layout Switch**: Respects static mode during layout transitions (Force <-> DAG).
  - [x] **GPU Settings**: Added "GPU Optimised Rendering" checkbox to settings to control acceleration flags.
  - [x] **Extreme Scale**: Strictly disabled edge rendering for graphs >10,000 nodes to prevent rendering bottlenecks.

- [x] **CLI & File Management**
  - [x] **CLI Arguments**: Added `--path` and `--gpu` support to `npm start`.
  - [x] **File Isolation**: CLI runs generate unique `data_cli_*.js` files to protect the original `data.js`.
  - [x] **Server Logic**: `server.ts` automatically serves the correct CLI data file based on build parameters.

---

# 2026-01-09 v0.9.70 - Frontend Initialization Fix (Race Condition)

**Goal**: Resolve the "No nodes displayed" and "Unresponsive Buttons" issue caused by a race condition in the initialization sequence for large datasets.

- [x] **Bug Fix**
  - [x] **Race Condition**: Identified that `renderCanvas` was being called by `ResizeObserver` or `setTimeout` _before_ the `controls` object was defined, causing a fatal error that halted script execution.
  - [x] **Refactor**: Moved `controls` definition to the top of `app.js`.
  - [x] **Robustness**: Added safety checks in `isNodeVisible` and `renderCanvas` to prevent crashes during initialization.
  - [x] **Result**: UI buttons (Freeze, Settings) should now initialize correctly, and the canvas should render immediately.

# 2026-01-09 v0.9.69 - Frontend Crash Fix (10k+ Nodes)

**Goal**: Fix the critical "Nodes: 0" bug caused by a stack overflow when processing 1.2 million edges in the frontend.

- [x] **Bug Fix**
  - [x] **Stack Overflow**: Identified `RangeError: Maximum call stack size exceeded` in `app.js` due to `links.push(...validLinks)` with 1.2M arguments.
  - [x] **Refactor**: Changed `links` declaration from `const` to `let` and replaced the spread operation with direct assignment (`links = validLinks`).
  - [x] **Result**: The application now successfully loads and renders graphs with >10,000 nodes and >1 million edges without crashing.

# 2026-01-09 v0.9.68 - Content-on-Demand Architecture (10k+ Fix)

**Goal**: Definitively solve the "Nodes: 0" display issue for 10k+ nodes caused by massive `data.js` file size (~500MB) crashing the browser.

- [x] **Architecture Refactor**
  - [x] **Data Splitting**: Separated graph structure (`data.js`) from content (`graph_data.json`).
  - [x] **Optimization**: `data.js` now excludes node content, reducing file size by ~95% (e.g., 500MB -> 35MB for 13k nodes).
  - [x] **Backend**: Updated `src/index.ts` to generate "Lite" `data.js`.

- [x] **Content-on-Demand**
  - [x] **API Endpoint**: Added `GET /api/content` to `server.ts` to serve raw node content securely.
  - [x] **Frontend**: Updated `Reader` in `reader.js` to fetch content asynchronously when opening a node.
  - [x] **UX**: Added loading state indicator in Reader window.

# 2026-01-08 v0.9.67 - Compact Mode & Canvas Fix

**Goal**: Solve the display issue for 10k+ nodes and implement a performance mode that hides edges by default.

- [x] **Compact Mode**
  - [x] **Auto-Enable**: Automatically activates for >5000 nodes or >100,000 edges.
  - [x] **Edge Culling**: Rendering loop skips edge iteration entirely in Compact Mode unless highlighting is active.
  - [x] **Settings UI**: Added "Compact Mode (Hide Edges)" checkbox to Performance settings.
- [x] **Canvas Fix**
  - [x] **Initial Render**: Forced explicit `resizeCanvas()` and `ticked()` calls after initialization to prevent blank screen.

# 2026-01-08 v0.9.63 - 10k Node Optimization & Memory Strategy

**Goal**: Solve the "stuck" rendering issue for 10k+ nodes/1.2M edges and implement configurable memory strategies for backend processing.

- [x] **Frontend Optimization**
  - [x] **Physics Culling**: Implemented edge limit (20k) for the D3 Force Simulation. If total edges exceed this, only a subset drives the physics to prevent Main Thread freeze, while all edges remain available for rendering/traversal.
  - [x] **Link Resolution**: Pre-resolved link source/target to objects to support robust rendering even when physics uses a subset.
  - [x] **UI Unblocking**: Fixed "Quick Start Guide" not appearing by freeing up the main thread.

- [x] **Backend Memory Strategy**
  - [x] **Configuration**: Added `memorySavingMode` and `deepDebug` to `AppConfig`.
  - [x] **Worker Optimization**: Refactored `keywordMatchWorker` and `statisticalWorker` to support both `filePaths` (Low Memory) and `filesChunk` (High Performance/Precision) modes.
  - [x] **Graph Metrics**: Added check to force Single-Core execution for `Betweenness Centrality` when `memorySavingMode` is active.
  - [x] **Cycle Detection**: Adjusted limit (100 vs 10000) based on memory mode.

- [x] **System Monitoring**
  - [x] **Peak Memory**: Updated `PerformanceLogger` to track and log Peak Heap/RSS memory usage.
  - [x] **Deep Debug**: Implemented conditional detailed logging based on `deepDebug` flag.

# 2026-01-07 v0.9.62 - Documentation Update (AMDGPU Guide)

**Goal**: Provide detailed hardware and software guidance for AMDGPU users, specifically for `gpu.js` acceleration and future AI integration.

- [x] **Documentation**
  - [x] **README.md**: Add "Hardware & Driver Requirements" section detailing RDNA architectures, driver selection (Adrenalin vs Mesa/ROCm), and build dependencies for `headless-gl`.

# 2026-01-07 v0.9.61 - Frontend Memory Optimization (Auto-Canvas)

**Goal**: Reduce frontend memory consumption and improve rendering performance for large graphs by automatically defaulting to "Canvas" mode when the node count exceeds a threshold.

- [x] **Smart Defaults**
  - [x] **Threshold Check**: In `app.js`, check if `nodes.length > 3000`.
  - [x] **Auto-Switch**: If threshold exceeded, programmatically select "Canvas" renderer and update DOM visibility (hide SVG, show Canvas) during initialization.
  - [x] **User Override**: Users can still manually switch back to SVG if desired.

# 2026-01-07 v0.9.60 - Parallel Graph Metrics

**Goal**: Optimize graph construction performance by parallelizing the "Graph Metrics" calculation (Betweenness Centrality), which was previously single-threaded.

- [x] **Parallelization**
  - [x] **Worker Implementation**: Created `betweennessWorker.ts` to calculate partial centrality scores for a subset of nodes using Brandes Algorithm.
  - [x] **Async Logic**: Updated `GraphMetrics` to `calculateBetweennessAsync` using a pool of workers (Default: `numCPUs - 1`).
  - [x] **Integration**: Integrated async metrics calculation into `GraphBuilder` pipeline.
  - [x] **Verification**: Validated functionality with `test_metrics_parallel.ts` on 500+ nodes.

# 2026-01-07 v0.9.59 - Vector Space Memory Fix (Sparse Matrix)

**Goal**: Resolve the "Heap out of memory" crash on Windows 10/11 (128GB RAM) when processing 13k+ files by replacing the dense TF-IDF matrix with a Sparse Vector implementation.

- [x] **Memory Optimization**
  - [x] **Sparse Vectors**: Refactored `VectorSpace` to use `Uint32Array` (indices) and `Float32Array` (values) instead of standard Javascript Arrays.
  - [x] **Efficiency**: Reduced memory footprint for 13k files from ~10GB+ (dense) to <500MB (sparse).
  - [x] **Algorithm**: Optimized Cosine Similarity calculation to use sparse dot product ($O(min(N, M))$).
  - [x] **Config**: Increased default Node.js heap limit to 12GB (`--max-old-space-size=12288`) in `package.json` to utilize available system RAM.

# 2026-01-07 v0.9.58 - Hybrid Inference Resource Reuse (Optimization)

**Goal**: Fix "Heap out of memory" crash during Hybrid Inference by preventing redundant calculation of Statistical Matrix and Vector Space.

- [x] **Resource Optimization**
  - [x] **Shared State**: Implemented `sharedStatsMatrix` and `sharedVectorSpace` in `GraphBuilder`.
  - [x] **Logic**: Pre-calculates these heavy resources if `HybridInference` is enabled, reusing them across Statistical and Vector steps.
  - [x] **Cleanup**: Explicitly clears shared resources after inference is complete.
  - [x] **Result**: Eliminates the 2x memory spike when running Hybrid Inference, preventing OOM on 13k+ files.

# 2026-01-07 v0.9.57 - Worker Memory Optimization

**Goal**: Resolve "Heap out of memory" errors on Windows 10/11 when processing large datasets (13k+ files) by optimizing data transfer between main thread and workers.

- [x] **Worker Data Transfer**
  - [x] **Optimization**: Refactored `keywordMatchWorker` and `statisticalWorker` to accept `filePaths: string[]` instead of `filesChunk: RawFile[]` (which contained full content).
  - [x] **Implementation**: Workers now read file content on-demand from disk using `fs`, avoiding the massive memory overhead of cloning content strings during serialization.
  - [x] **Result**: Significantly reduced heap usage during parallel processing steps.

# 2026-01-05 v0.9.56 - Hybrid Inference Memory Analysis

**Goal**: Analyze and optimize the memory usage of the "Hybrid Inference" engine to resolve "Heap out of memory" errors on Windows 10, preventing large object retention during graph construction.

- [x] **Granular Logging**
  - [x] **Implementation**: Added detailed `PerformanceLogger` steps within `HybridEngine.infer` and `GraphBuilder` (Stats Matrix, Vector Space, Inference Engine).
  - [x] **Progress Tracking**: Logs memory usage every 1000 nodes processed during inference to pinpoint spikes.
  - [x] **Optimization**: Explicitly clears the large `matrix` and nullifies `vectorSpace` immediately after inference to release heap memory before subsequent steps.

# 2026-01-05 v0.9.55 - Heap OOM Fix & Iterative DFS

**Goal**: Resolve "Heap out of memory" crash on Windows 10/11 by optimizing memory usage during graph construction and refactoring recursion to iteration.

- [x] **Memory Optimization**
  - [x] **Scope Management**: Explicitly clear `fileMap` (holding file contents) before entering the memory-intensive `Algorithmic Core` phase in `GraphBuilder`.
  - [x] **Granular Logging**: Split `Algorithmic Core` logging into `Cycle Detection` and `Topological Sort` for precise error tracking.

- [x] **Algorithm Robustness**
  - [x] **Iterative DFS**: Refactored `CycleDetector.detectCycles` to use an iterative stack-based approach instead of recursion to prevent stack overflow on deep graphs.
  - [x] **Verification**: Validated logic with existing unit tests.

# 2026-01-05 v0.9.54 - Welcome & Empty State Experience

**Goal**: Improve the new user onboarding experience by providing clear guidance when the graph is empty.

- [x] **Empty State Handling**
  - [x] **Detection**: Logic in `welcome.js` detects if `graphData` is empty or missing.
  - [x] **Welcome Modal**: Implemented a "Welcome to NoteConnection" modal that guides users to:
    1. Select a Source Folder.
    2. Click Load.
  - [x] **Visual Cues**: Highlights the Source Control area when the modal is active.

# 2026-01-05 v0.9.53 - Core API Decoupling

**Goal**: Prepare the codebase for Plugin integration (Joplin/Obsidian) by decoupling the core logic from the CLI environment.

- [x] **Core Refactoring**
  - [x] **NoteConnection Class**: Created `src/core/NoteConnection.ts` as the main facade.
  - [x] **Decoupling**: Moved `buildGraph` logic out of `src/index.ts` to allow library-style usage.
  - [x] **CLI Update**: Refactored `src/index.ts` to consume the new Core API.

# 2026-01-05 v0.9.52 - Cycle Detection Memory Optimization

**Goal**: Solve the "Heap out of memory" crash on Windows 10/11 when processing large graphs with many cycles (100k+ edges).

- [x] **Cycle Detection Optimization**
  - [x] **Limit Logic**: Updated `CycleDetector` to accept a `limit` parameter.
  - [x] **Termination**: Stops recursion/search immediately after finding the specified number of cycles (100) instead of collecting all of them.
  - [x] **Verification**: Added unit tests to ensure limit is respected.

# 2026-01-03 v0.9.51 - Performance Logging & Crash Reporting

**Goal**: Enhance system observability by implementing detailed performance metrics and automatic crash reporting to facilitate debugging.

- [x] **Performance Logger**
  - [x] **Utility**: Created `PerformanceLogger` class to track Time, CPU (User/Sys), and Memory (Heap/RSS).
  - [x] **Integration**: Wrapped all `GraphBuilder` stages (Node Init, Edge Matching, Inference) with logging.
  - [x] **GPU Tracking**: Integrated logging into `VectorSpaceGPU` to monitor kernel execution time.
- [x] **Crash Reporting**
  - [x] **Utility**: Created `CrashLogger` to write unhandled errors to `crash.log`.
  - [x] **Integration**: Attached global handlers (`uncaughtException`, `unhandledRejection`) in `server.ts`.
  - [x] **Workers**: Added try-catch blocks and logger integration to `keywordMatchWorker` and `statisticalWorker`.

# 2026-01-02 v0.9.50 - GPU Acceleration Feasibility

**Goal**: Verify and implement GPU acceleration for mathematical operations (Matrix Multiplication) to further speed up Graph Construction on supported hardware (verified on AMD 7900XT).

- [x] **Feasibility Verification**
  - [x] **Library**: Installed `gpu.js` to bridge Node.js with GPU via WebGL/OpenCL.
  - [x] **Hardware Check**: Verified successful kernel compilation and execution on AMD Radeon 7900XT (Windows 10).
  - [x] **Benchmark**: Matrix Multiplication (512x512) completed successfully in GPU mode.
- [x] **Implementation Plan**
  - [x] **Vector Space**: Offload the $N \times N$ Cosine Similarity matrix calculation to GPU (`amdgpu/VectorSpaceGPU.ts`).
  - [x] **Constraint**: Keep string processing (Keyword Matching) on CPU (Workers) as data transfer overhead to GPU outweighs benefits for text.

---

# 2026-01-02 v0.9.49 - Statistical Analysis Memory Optimization

**Goal**: Fix "Heap out of memory" errors when processing large datasets (10k+ files) by optimizing the Co-occurrence Matrix calculation.

- [x] **Algorithm Optimization**
  - [x] **Sparse Matrix Calculation**: Refactored `calculateMatrixOptimized` to use a file-centric iteration approach ($O(Files \times TermsPerFile^2)$) instead of the dense term-pair iteration ($O(TotalTerms^2)$).
  - [x] **Reduction of Complexity**: Reduced complexity from ~170 million iterations (for 13k nodes) to ~5 million iterations.
  - [x] **Data Structure Efficiency**: Removed unnecessary intermediate object conversions (`Set` <-> `Array`) during worker result aggregation.
  - [x] **Worker Result Merging**: Optimized `runParallelTermExtraction` to merge chunks iteratively instead of using `reduce` to prevent memory spikes.

---

# 2026-01-02 v0.9.48 - Parallel Processing Optimization

**Goal**: Optimize graph building performance by allowing configurable worker thread limits, utilizing more CPU cores for large datasets.

- [x] **Worker Configuration**
  - [x] **Configurable Limit**: Added `maxWorkers` to `AppConfig` to override the default worker limit.
  - [x] **Removal of Cap**: Removed the hardcoded 12-worker limit in `GraphBuilder` and `StatisticalAnalyzer`. Defaults to `numCPUs - 1` if not specified.
  - [x] **Verification**: Validated with 50 workers on test dataset.

---

# 2026-01-02 v0.9.47 - Focus Mode Interaction & Layout Fixes

**Goal**: Improve Focus Mode usability by preventing accidental zooming and fixing label overlap in Vertical layouts.

- [x] **Interaction Logic**
  - [x] **Double Click Zoom Prevention**: Added `stopPropagation` to the node double-click handler to prevent `d3.zoom` from triggering a zoom-in event when entering Focus Mode.

- [x] **Focus Mode Layout**
  - [x] **Vertical Spacing**: In "Vertical" (L-R) layout, increased the horizontal offset (`dx`) of node labels to **35px** (from default ~12px) to prevent overlap between text and nodes.
  - [x] **Focus Node**: Applied the same horizontal offset to the central Focus Node in vertical layout for consistency.

---

# 2025-12-26 v0.9.46 - Focus Mode UI Cleanup & Canvas Edge Fix

**Goal**: Clean up the UI during Focus Mode to reduce clutter and fix visual rendering in Canvas mode.

- [x] **UI Hiding**
  - [x] **Main Controls**: "Select Knowledge Base", "Load", and the main "NoteConnection" dropdown are now completely hidden (`display: none`) when entering Focus Mode.
  - [x] **Restoration**: Elements are restored to their default state (`display: ''`) upon exiting Focus Mode, respecting CSS rules (e.g., mobile visibility).

- [x] **Canvas Visualization**
  - [x] **Edge Hiding**: In Canvas Focus Mode, _all_ edges are now hidden to provide a cleaner look, matching the "do not display any edges" requirement.

---

# 2025-12-26 v0.9.45 - Canvas Interactivity & cleanup

**Goal**: Enable full interactivity (Hover, Click, Focus) in Canvas mode and remove the deprecated "View Mode" (Clusters) feature.

- [x] **Canvas Interactivity**
  - [x] **Hit Testing**: Implemented `findNodeAt(x, y)` to detect nodes under the mouse cursor in Canvas mode, accounting for zoom/pan transforms.
  - [x] **Event Listeners**: Added `mousemove` (highlighting) and `click` (inspection/focus) handlers to the canvas element.
  - [x] **Consistency**: Canvas interaction now matches SVG behavior (Single click -> Stats, Double click -> Focus).

- [x] **Visual Fixes**
  - [x] **Node Sizing**: Updated `renderCanvas` to respect the "Size By" setting (Degree/Centrality/Uniform), fixing the issue where nodes were rendered too large.

- [x] **Cleanup**
  - [x] **View Mode Removal**: Removed "View Mode" (Nodes/Clusters) controls and associated logic from the codebase as it was deprecated.

---

# 2025-12-26 v0.9.44 - Independent Focus Mode Spacing

**Goal**: Allow users to configure "Layer-Space" and "Node-Space" independently for "Horizontal" and "Vertical" layouts in Focus Mode, preventing settings from one layout affecting the other.

- [x] **Spacing Logic**
  - [x] **State Management**: Created `focusSpacingSettings` to store separate `layer` and `node` values for `horizontal` and `vertical` modes.
  - [x] **Defaults**:
    - **Horizontal**: Layer-Space defaulted to **125** (was 250).
    - **Vertical**: Node-Space defaulted to **20** (was 80).
  - [x] **UI Sync**: Switching the Focus Layout dropdown now automatically updates the sliders to reflect the stored values for that specific mode.
  - [x] **Persistence**: Adjusting sliders updates the setting for the _current_ mode only.

---

# 2025-12-26 v0.9.43 - Context-Aware Settings UI

**Goal**: Improve user clarity by dynamically updating the labels in the Settings Modal to reflect the currently active layout mode.

- [x] **UI Enhancement**
  - [x] **Label Switching**: The label for the repulsion slider now updates to "Repulsion (Force)" or "Repulsion (DAG)" based on the active layout when the settings modal is opened.
  - [x] **Localization**: Supports dynamic label switching for both English and Chinese locales.

---

# 2025-12-26 v0.9.42 - Distinct Repulsion Settings

**Goal**: Allow users to configure distinct "Repulsion Strength" values for "Force" and "DAG" layout modes, with layout-specific defaults.

- [x] **Settings Logic**
  - [x] **Data Structure**: Updated `defaultSettings` in `settings.js` to store separate keys: `repulsionForce` (Default: -550) and `repulsionDAG` (Default: -850).
  - [x] **Context-Aware UI**: The "Visualization Settings" modal now automatically displays and updates the repulsion value corresponding to the currently active layout mode.
  - [x] **Dynamic Application**: Switching layouts (`updateLayout`) or changing settings (`settingsManager.subscribe`) dynamically applies the correct force strength.

---

# 2025-12-26 v0.9.41 - Settings Modal Simulation Freeze

**Goal**: Automatically freeze the simulation when the "Visualization Settings" modal is opened to conserve memory/CPU and prevent background activity during configuration.

- [x] **Modal State Logic**
  - [x] **Auto-Freeze**: Opening the Settings Modal (`initSettingsUI`) now triggers `simulation.stop()` and sets an internal `isSettingsModalOpen` flag.
  - [x] **Conditional Resume**: Closing the modal resumes the simulation _only_ if the global "Freeze Layout" checkbox is not checked.
  - [x] **Update Suppression**: Updates triggered by `settingsManager` while the modal is open (e.g. slider drags) apply values but do _not_ restart the simulation loop.

---

# 2025-12-26 v0.9.40 - Freeze Layout Priority Fix (Settings Modal)

**Goal**: Ensure that changing Physics or Visual settings in the "Visualization Settings" modal does not restart the simulation if "Freeze Layout" is currently enabled.

- [x] **Settings Application Logic**
  - [x] **Conditional Restart**: Modified `settingsManager.subscribe` callback in `app.js` to check the "Freeze Layout" checkbox state.
  - [x] **Behavior**:
    - **Frozen**: Forces (charge, distance, collision) are updated in the background, but `simulation.restart()` is skipped. Visual changes (opacity) apply immediately.
    - **Unfrozen**: Forces are updated and simulation restarts (alpha 0.3).

---

# 2025-12-26 v0.9.39 - Layout Switch Relaxation & Freeze Logic

**Goal**: Apply the "Rapid Relaxation" strategy (0.2 damping -> 0.95 damping) when switching layouts, ensuring consistent behavior with initial load. Additionally, ensure "Freeze Layout" is respected after the relaxation period.

- [x] **Layout Transition Logic**
  - [x] **Relaxation**: Switching to a new layout (Force/DAG) resets `velocityDecay` to **0.2** for 2 seconds to allow nodes to find their new positions quickly.
  - [x] **Stabilization**: Automatically transitions to **0.95** damping after 2 seconds.
  - [x] **Delayed Freeze**: If "Freeze Layout" is enabled during the switch, the simulation runs for the 2-second relaxation phase and then automatically **stops**, freezing the new layout in its stabilized state.

---

# 2025-12-26 v0.9.38 - Quick Start Guide HTML Rendering Fix

**Goal**: Fix the issue where HTML tags (like `<br>` and `<strong>`) in the localized Quick Start Guide content were being displayed as raw text instead of being rendered.

- [x] **Rendering Logic**
  - [x] **HTML Support**: Updated `window.updateLanguage` in `app.js` to use `.innerHTML` instead of `.innerText` when injecting translated content. This ensures rich text elements in the guide are displayed correctly.

---

# 2025-12-26 v0.9.37 - Rapid Relaxation Strategy

**Goal**: Implement a two-stage damping process to allow the graph to "unfold" quickly upon load before stabilizing.

- [x] **Damping Logic**
  - [x] **Initial Phase**: Set `velocityDecay` to **0.2** for the first 2 seconds. This low friction allows nodes to rapidly move away from the center and untangle.
  - [x] **Stable Phase**: Automatically transition to **0.95** (high friction) after 2 seconds to stabilize the layout (Updated from 0.92).
  - [x] **Interaction Safety**: Ensures the auto-transition does not override manual slider adjustments made during the initial phase.

---

# 2025-12-26 v0.9.36 - Freeze Layout Priority Fix (Visual Settings)

**Goal**: Ensure that changing visual settings (Degree Basis, Size By) does not trigger a simulation restart if "Freeze Layout" is enabled, respecting the user's command to keep nodes stationary.

- [x] **Visual Update Logic**
  - [x] **Conditional Restart**: Modified `updateSize()` in `app.js` to check the "Freeze Layout" checkbox state.
  - [x] **Behavior**: If frozen, visual attributes (radius, font size) update immediately, but `simulation.restart()` is skipped. The collision force is updated in the background, ready for when the user unfreezes.

---

# 2025-12-26 v0.9.35 - Viewport Culling Relaxation

**Goal**: Relax the viewport culling restrictions to provide a smoother user experience, preventing premature freezing of nodes just outside the viewport and allowing for deeper zooms before global freeze.

- [x] **Culling Optimization**
  - [x] **Full Freeze Threshold**: Lowered from `scale < 0.4` to `scale < 0.1` to allow simulation at broader zoom levels.
  - [x] **Dynamic Buffer**: Increased off-screen buffer from fixed `100` units to `800 / scale` (approx 800 visual pixels), ensuring "fixed range extending outward" behavior.

---

# 2025-12-26 v0.9.34 - Global Layout Update Fix

**Goal**: Ensure that layout switching applies to all nodes in the graph, overriding any optimization constraints (like viewport culling) that might have frozen off-screen nodes.

- [x] **Layout Transition Logic**
  - [x] **Global Unfreeze**: In `updateLayout()`, explicitly clear `fx` and `fy` properties for all nodes when initiating a new simulation.
  - [x] **Culling Reset**: Reset the `isCulled` flag to ensure off-screen nodes are included in the new layout calculation and rendering.
  - [x] **Result**: Switching from 'Force' to 'DAG' (or vice versa) correctly rearranges the entire graph, even if the user is zoomed in and many nodes were previously frozen.

---

# 2025-12-26 v0.9.33 - Layout State Caching (Instant Switch)

**Goal**: Implement state caching to allow switching between layouts ("Force" vs "DAG") without recalculating positions or animating the transition, fulfilling the "template state" requirement.

- [x] **State Management**
  - [x] **Cache**: Create `layoutCache` to store `x, y, fx, fy` for each mode.
  - [x] **Save/Restore**: Implement logic to save current positions before switching and restore target positions after switching.
- [x] **Transition Logic**
  - [x] **Instant Switch**: If a layout state is cached, restore positions and skip the simulation warm-up (`alpha(1)`), effectively teleporting nodes to their previous state.
  - [x] **First Run**: If no cache exists, perform standard simulation.

---

# 2025-12-26 v0.9.32 - High Damping & Render Optimization

**Goal**: Further reduce memory/CPU consumption by increasing simulation friction and skipping DOM updates for frozen off-screen nodes.

- [x] **Damping Adjustment**
  - [x] **Default**: Increased `velocityDecay` to **0.92**.
  - [x] **Effect**: Graph settles much faster; movement is "heavier" and less jittery.

- [x] **Render Culling (DOM)**
  - [x] **Logic**: In `ticked()`, filter the D3 selection to only update nodes that are NOT flagged as `isCulled`.
  - [x] **Mechanism**: `checkSimulationState` sets `isCulled = true` for off-screen nodes.
  - [x] **Benefit**: Avoids thousands of expensive DOM attribute updates per frame for nodes the user cannot see.

---

# 2025-12-26 v0.9.31 - Simulation Optimization (Viewport Culling)

**Goal**: Reduce memory and CPU consumption by minimizing particle movement calculations based on zoom level and viewport visibility.

- [x] **Viewport Culling Logic**
  - [x] **Full View Freeze**: If the user zooms out enough to see the entire graph (or a large portion), automatically stop the simulation to save resources, assuming the layout is stable.
  - [x] **Off-screen Freezing**: When zoomed in, only simulate nodes within the visible viewport. Freeze nodes outside the viewport.
  - [x] **Implementation**:
    - [x] Add `checkSimulationState()` triggered by zoom events.
    - [x] Calculate visible bounds based on `event.transform`.
    - [x] Update `simulation.nodes()` to only include visible nodes (plus a buffer) or use `fx`/`fy` to lock off-screen nodes.

---

# 2025-12-26 v0.9.30 - Focus Mode Layout Isolation

**Goal**: Ensure that layout changes occurring within Focus Mode (automatic arrangement or manual dragging) do not affect the node positions in the main interface upon exiting.

- [x] **Position Backup & Restoration**
  - [x] **Backup**: In `enterFocusMode`, save the current `x`, `y`, `fx`, and `fy` coordinates of all nodes.
  - [x] **Restoration**: In `exitFocusMode`, restore these coordinates to their pre-focus state.
  - [x] **Consistency**: Ensure the graph visual state reverts exactly to how it was before entering Focus Mode.

---

# 2025-12-26 v0.9.29 - Freeze Layout Persistence

**Goal**: Fix bug where "Analysis & Export" (and other layout resizes) would override the "Freeze Layout" state, causing unwanted node movement.

- [x] **Layout Resize Logic**
  - [x] **Behavior**: Modified `ResizeObserver` in `app.js` to strictly check the "Freeze Layout" checkbox state before calling `simulation.restart()`.
  - [x] **Canvas Sync**: Ensured `resizeCanvas()` is called during layout changes to keep the canvas resolution correct even if the simulation is frozen.
  - [x] **Result**: Opening the Analysis Panel or resizing the window now respects the frozen state, keeping nodes stationary.

---

# 2025-12-26 v0.9.28 - Focus Mode Specific Content Access

**Goal**: Optimize user experience by providing a direct way to open specific node content within Focus Mode, avoiding the need for double-clicking.

- [x] **Specific Content Button**
  - [x] **UI**: Added a "Specific Content" button (`#btn-open-content`) to the Focus Mode control panel (`#focus-exit-btn`).
  - [x] **Logic**: Clicking the button triggers `window.reader.open(focusNode)`, mimicking the double-click behavior on a focused node.
  - [x] **Localization**: Added support for English ("Open Specific Content") and Chinese ("打开具体内容").

- [x] **Documentation**
  - [x] **User Manual**: Updated Focus Mode section.
  - [x] **Interface Document**: Updated Focus Mode capabilities.
  - [x] **TEST_REPORT**: Added test case for the new button.

---

# 2025-12-26 v0.9.27 - Conditional Restart

**Goal**: Ensure "Freeze Layout" state is respected when exiting Focus Mode.

- [x] **Conflict Resolution**
  - [x] **Logic**: In `exitFocusMode`, check if "Freeze Layout" is checked.
  - [x] **Behavior**: If checked, call `simulation.stop()` instead of `restart()`, preventing unwanted movement.
  - [x] **Visual**: Manually trigger `ticked()` to ensure the graph renders the restored nodes in their current positions.

# 2025-12-26 v0.9.26 - UX Enhancements

**Goal**: Improve mobile usability and onboard new users effectively.

- [x] **Freeze Layout Button**
  - [x] **UI**: Add a dedicated "Freeze Layout" button to the main interface (top-right or near controls) for quick access, especially on mobile.
  - [x] **Logic**: Link button to the existing simulation freeze functionality. Sync state with the checkbox in controls.
  - [x] **Visual**: Use an icon (e.g., Lock/Unlock) to indicate state.

- [x] **Quick Start Manual**
  - [x] **Content**: Create a concise "How to Use" guide covering:
    - Loading Data
    - Navigation (Pan/Zoom)
    - Focus Mode (Double Click)
    - Inspection (Click/Hover)
    - Analysis Panel
  - [x] **UI**: Implement as a Modal that opens on first load (localStorage check) or via a "Help" button.
  - [x] **Localization**: Support English and Chinese.

- [x] **Documentation**
  - [x] **Interface Document**: Update with new UI elements.
  - [x] **README**: Add changelog.
  - [x] **Test Report**: Verify new features.

---

# 2025-12-25 v0.9.25 - Freeze Layout Optimization

**Goal**: Minimize resource usage by strictly freezing the main graph when requested, preventing user interactions that would wake the simulation.

- [x] **Freeze Layout Enhancement**
  - [x] **Behavior**: Checking "Freeze Layout" now disables node dragging in the main interface (SVG Mode).
  - [x] **Constraint**: This restriction does _not_ apply to Focus Mode, where manual adjustment is still permitted.
  - [x] **Performance**: Prevents `simulation.restart()` triggers from drag events, ensuring the simulation stays effectively stopped (0% CPU usage).

- [x] **Documentation**
  - [x] **Interface Document**: Updated Simulation Controls section.
  - [x] **README**: Added changelog entry.
  - [x] **Test Report**: Verified behavior.

---

# 2025-12-25 v0.9.24 - Focus Mode Memory Optimization

**Goal**: Reduce memory/CPU expenditure in SVG mode by freezing background nodes during Focus Mode.

- [x] **Simulation Optimization**
  - [x] **Subsetting**: Modified `enterFocusMode` to filter `simulation.nodes()` and `simulation.force("link").links()` to only include the focused subset.
  - [x] **Freezing**: Background nodes are effectively frozen as they are no longer processed by D3 forces.
  - [x] **Restoration**: Modified `exitFocusMode` to restore the full set of nodes and links to the simulation.

- [x] **Documentation**
  - [x] **Interface Document**: Updated with optimization details.
  - [x] **README**: Added changelog entry.
  - [x] **Test Report**: Verified optimization behavior.

---

# 2025-12-25 v0.9.23 - Default Settings Adjustment

**Goal**: Adjust default settings for Reading Window font size and Simulation Damping based on user feedback.

- [x] **Reading Window Font Size**
  - [x] **Implementation**: Modified `Reader` class in `reader.js` to set `currentZoom` to 0.5 by default.
  - [x] **Logic**: Affects initialization and reset on open.

- [x] **Simulation Damping**
  - [x] **Implementation**: Updated `app.js` to initialize `d3.forceSimulation` with `.velocityDecay(0.6)`.
  - [x] **UI**: Updated `index.html` slider default value and display text to 0.6.

---

# 2025-12-25 v0.9.22 - Mobile Popup Adaptation

**Goal**: Adapt the node statistics popup for mobile devices with touch-based drag and pinch-to-zoom capabilities.

- [x] **Touch Drag Support**
  - [x] **Implementation**: Added `touchstart`, `touchmove`, `touchend` listeners to `popupDragHandle`.
  - [x] **Logic**: Mirrors mouse drag logic using `touches[0]` coordinates.
  - [x] **Constraint**: Requires single-finger touch on the header.

- [x] **Pinch-to-Zoom Support**
  - [x] **Implementation**: Added `touchstart`, `touchmove`, `touchend` listeners to `statsPopup`.
  - [x] **Logic**: Calculates distance between two fingers (`Math.hypot`) to determine scale ratio.
  - [x] **Scaling**: Updates `popupDragState.currentScale` and applies to `fontSize`.
  - [x] **Clamping**: Restricted scale between 0.5x and 2.0x.

- [x] **Documentation**
  - [x] **Interface Document**: Updated with mobile interaction specs.
  - [x] **README**: Added changelog entry.
  - [x] **Test Report**: Verified mobile interactions.

---

# 2025-12-25 v0.9.21 - Strict Edge Visibility & Optimization

**Goal**: Enforce strict edge visibility rules (hidden by default) and optimize rendering for large graphs.

- [x] **Strict Edge Visibility**
  - [x] **SVG Mode**: Modified `updateVisibility` in `app.js` to set default edge opacity to 0 (was 0.15).
  - [x] **Consistency**: Ensured SVG behavior matches Canvas mode (hidden by default).
  - [x] **Performance**: Reduced visual clutter and rendering cost for initial view.

- [x] **Documentation**
  - [x] **Interface Document**: Updated to reflect strict edge visibility in v0.9.21.
  - [x] **README**: Added v0.9.21 changelog.
  - [x] **Test Report**: Verified behavior for v0.9.21.

---

# 2025-12-24 v0.9.20 - Selection State Auto-Clear on Focus Entry

**Goal**: Automatically clear any existing selection or highlight state when entering Focus Mode via double-click for a clean transition.

- [x] **Auto-Clear Implementation**
  - [x] **Highlight Clearing**: Modified `handleDoubleClick()` to call `highlightManager.unhighlight({ force: true })` before entering focus mode.
  - [x] **Popup Hiding**: Automatically hide the statistics popup (`#node-stats-popup`) when entering focus mode.
  - [x] **State Management**: Ensures clean state transition without residual visual artifacts.

- [x] **User Experience Enhancement**
  - [x] **Clean Transition**: Users always start with a pristine focused context.
  - [x] **Visual Clarity**: Prevents confusion from overlapping highlights between normal and focus modes.
  - [x] **Consistent Behavior**: Standardized focus mode entry behavior across all scenarios.

- [x] **Documentation**
  - [x] **Interface Document**: Updated with v0.9.20 selection auto-clear specifications.
  - [x] **README**: Added v0.9.20 changelog entries in both English and Chinese.
  - [x] **Code Comments**: Bilingual comments explaining the auto-clear logic.
  - [x] **TODO**: Documented completed feature implementation.

---

# 2025-12-24 v0.9.19 - Focus Mode & Popup Enhancements

**Goal**: Fix focus mode refresh issues and add drag/zoom functionality to the statistics popup for better user experience.

- [x] **Focus Mode Re-entry Fix**
  - [x] **Double-Click Behavior**: Modified `handleDoubleClick()` to allow re-entering focus mode on related nodes while already in focus mode.
  - [x] **State Reset**: Ensured all node visibility flags (`isFocusVisible`, `fx`, `fy`, `_labelDy`) are properly reset before entering new focus context.
  - [x] **Prevention**: Removed the restriction that blocked switching focus between related nodes in `enterFocusMode()`.

- [x] **Statistics Popup Enhancements**
  - [x] **Drag Functionality**: Implemented mouse-based dragging by clicking and dragging the popup header.
    - [x] **State Tracking**: Created `popupDragState` to track drag position and scale.
    - [x] **Event Handlers**: Added `mousedown`, `mousemove`, and `mouseup` listeners for drag control.
    - [x] **Visual Feedback**: Added `.dragging` class for cursor feedback during drag.
  - [x] **Zoom Controls**: Added three zoom buttons (+, −, ⟲) to scale popup content.
    - [x] **Scale Range**: 0.5x to 2.0x with 0.1 increments.
    - [x] **Implementation**: Applied scaling via `fontSize` CSS property on `.popup-content`.
    - [x] **Reset Function**: Reset button restores default size and scale.
  - [x] **Resizable**: Enabled CSS `resize: both` for browser-native resize functionality.
    - [x] **Constraints**: Set min/max width and height constraints.
    - [x] **Scrolling**: Ensured content scrolls properly when resized.
  - [x] **Position Reset**: On close, popup position resets to default (top-right).
- [x] **Documentation**
  - [x] **Interface Document**: Updated with v0.9.19 drag/zoom interface specifications.
  - [x] **README**: Added v0.9.19 changelog entries in both English and Chinese.
  - [x] **Bilingual Comments**: Code comments in both languages for all new functionality.
  - [x] **CSS**: Documented new styles for draggable, zoomable, and resizable popup.

---

# 2025-12-24 v0.9.18 - Node Highlighting System Refactor

**Goal**: Reconstruct node highlighting logic with modular architecture for better maintainability and robustness.

- [x] **Modular Architecture**
  - [x] **NodeHighlightManager Class**: Created dedicated module (`nodeHighlight.js`) with complete state management.
  - [x] **API Design**: Implemented clean public API with `highlight()`, `unhighlight()`, `getState()`, and helper methods.
  - [x] **Integration**: Fully integrated into app.js replacing old highlighting functions.

- [x] **Unified Interaction Model**
  - [x] **PC Support**: Hover-based highlighting without freezing simulation.
  - [x] **Mobile Support**: Click-based highlighting with simulation freeze for stable inspection.
  - [x] **State Consistency**: Proper tracking of frozen vs temporary highlight states.

- [x] **Rendering Enhancements**
  - [x] **SVG Mode**: Directional edge coloring (Blue=#4488ff outgoing, Red=#ff6b6b incoming) with matching arrow markers.
  - [x] **Canvas Mode**: Updated to use highlightManager state for consistent visual behavior.
  - [x] **Dimming Effect**: Unconnected nodes dim to 0.05 opacity during highlight for clearer focus.

- [x] **Focus Mode Integration**
  - [x] **State Awareness**: highlightManager respects focus mode and doesn't interfere.
  - [x] **Coordination**: Focus mode entry/exit properly updates highlightManager state.

- [x] **Documentation**
  - [x] **Bilingual Comments**: Comprehensive Chinese/English comments throughout code.
  - [x] **Interface Document**: Updated with complete NodeHighlightManager API reference.
  - [x] **README**: Added v0.9.18 changelog entry in both languages.
  - [x] **Integration Guide**: Created detailed integration instructions.

---

### 2025-12-17 v0.1.0 - Foundation & Data Structures

**Goal**: Establish the standalone project environment and core data structures for a Directed Graph, independent of specific note-taking app APIs initially.

- [x] **Project Initialization**
  - [x] Initialize a new TypeScript/Node.js project in `NoteConnection`.
  - [x] Configure ESLint, Prettier, and Jest for testing.

- [x] **Graph Core Implementation**
  - [x] Implement `Node` and `Edge` interfaces supporting metadata (e.g., `rank`, `clusterId`).
  - [x] Implement a `Graph` class with methods: `addNode`, `addEdge`, `getNeighbors`, `getIncomingEdges`, `getOutgoingEdges`.

### 2026-01-15 v0.2.0 - Data Ingestion & Directional Parsing

**Goal**: Ingest data from Markdown files, specifically parsing frontmatter for directional dependencies.

- [x] **Markdown Parser Service**
  - [x] Implement a file system reader to scan directories recursively.
  - [x] Create a regex or AST-based parser to extract YAML frontmatter.

- [x] **Dependency Extraction**
  - [x] Define the schema: `prerequisites: [[Note A]]`, `next: [[Note B]]`.
  - [x] Logic to convert these metadata fields into directed edges in the `Graph` object.

### 2026-02-01 v0.3.0 - Algorithmic Core (DAG Logic)

**Goal**: Ensure the graph is a valid DAG and calculate hierarchical layout positions.

- [x] **Cycle Detection & Resolution**
  - [x] Implement DFS-based cycle detection.
  - [x] Strategy: Report cycles to the user (Console Warning).

- [x] **Topological Sorting & Ranking**
  - [x] Implement algorithms to assign a `rank` (0, 1, 2...) to every node.
  - [x] Ensure nodes with no dependencies are Rank 0.
  - [x] Integrated Kahn's Algorithm variant for Longest Path layering.

### 2026-03-01 v0.4.0 - Visualization Engine

**Goal**: Render the processed graph in a web view using a layered layout engine (Sugiyama-style).

- [x] **Layout Engine Integration**
  - [x] Implement "Layout Mode" switch in UI (Force vs DAG).
  - [x] Map `rank` to Y-coordinates in the visualization.

- [x] **Canvas/SVG Rendering**
  - [x] Optimize rendering for hierarchical structures.
  - [x] Draw curved bezier lines for dependencies to indicate flow direction clearly.

- [x] **Focus Mode (v0.6.2)**
  - [x] **Interactive Focus**: Click node to center and isolate context.
  - [x] **Hierarchical Layout**: Auto-arrange Superiors (Out-degree) and Subordinates (In-degree) in layers.
  - [x] **Intra-layer Sorting**: Sort neighbors by importance (Degree Ratio).
  - [x] **Context Filtering**: Show only direct neighbors and high-correlation nodes.
  - [x] **Layout Optimization**:
    - [x] Relative Height Positioning based on criteria (Score).
    - [x] Staggered Label Placement to prevent overlap.
    - [x] Fix: Prevents node accumulation when switching context within Focus Mode.

### 2026-04-01 v0.5.0 - Scalability (Clustering)

**Goal**: Handle 10,000+ nodes by grouping them into high-level clusters based on File Structure or Semantic Tags.

- [x] **Clustering Logic**
  - [x] Implement **Folder-based Clustering**: Parse directory structure (e.g., `Physics/Mechanics` -> Cluster `Mechanics`).
  - [x] Add Configuration Strategy: Switch between `Label Propagation` (current) and `Folder Path` for `clusterId` assignment.

- [x] **Semantic Zoom / Drill-down**
  - [x] Render "Super Nodes" (Clusters) at low zoom levels (Implemented as "Cluster View" toggle).
  - [x] Expand to show detailed dependency graphs when a cluster is clicked (Drill-down via Filter).

### 2026-05-01 v0.6.0 - Hybrid Inference Strategy (AI & Stats)

**Goal**: Combine statistical and vectorized methods to infer dependencies and associations where explicit metadata is missing.

- [x] **Vector-based Association (Similarity)**
  - [x] Implement embedding generation (using local TF-IDF VectorSpace).
  - [x] Use Cosine Similarity to determine the strength of **association** (undirected relationship) between concepts.

- [x] **Statistical Dependency Inference**
  - [x] Calculate **Co-occurrence Frequency** and **Conditional Probability** ($P(B|A)$) across the note corpus.
  - [x] Hypothesis: If A frequently appears before B or in the context of defining B, A might be a dependency.

- [x] **Hybrid Judgment Engine (v0.6.5)**
  - [x] Combine Vector Similarity (for relevance) + Statistical Probability (for direction).
  - [x] Rule: If `Similarity(A, B) > Threshold` AND `P(B|A) >> P(A|B)`, suggest edge `A -> B`.

- [ ] **AI Inference Service (LLM Verification)**
  - Use LLMs to verify high-confidence candidates from the hybrid engine.
  - Task: "Given statistical evidence, confirm if A is a prerequisite for B."

### 2025-12-22 v0.8.5 - Dynamic Data Source & Server

**Goal**: Support dynamic selection of knowledge base folders and independent server deployment.

- [x] **Dynamic Path Selection**
  - [x] Backend: Support variable input paths under `Knowledge_Base`.
  - [x] Server: Implement `http` server for API (`/api/folders`, `/api/build`) and static serving.
  - [x] Frontend: Add UI to list and select knowledge base folders.

# 2025-12-24 v0.9.17 - SVG Visual Completeness

**Goal**: Complete the visual feedback loop for SVG mode interactions.

- [x] **SVG Renderer**
  - [x] **Colored Markers**: Implemented dynamic marker switching (Red/Blue arrows) to match the edge color during highlight.
  - [x] **Visual Consistency**: Ensured arrows revert to gray when highlighting is cleared.

# 2025-12-24 v0.9.16 - Interaction Completeness

**Goal**: Ensure complete visualization of node relationships during inspection.

- [x] **Interaction Logic**
  - [x] **Always-On Context**: Clicking a node now forces the display of _all_ In-degree and Out-degree relationships, overriding any active "Incoming Only" or "Outgoing Only" filters to ensure complete context is visible.
- [x] **Canvas Renderer**
  - [x] **Visual Parity**: Implemented bold line rendering (2.5px width) for highlighted edges in the Canvas engine to match SVG styling.

### 2025-12-23 v0.8.6 - Performance Optimization (Parallel Processing)

**Goal**: Optimize graph construction for large datasets (>10,000 nodes) to reduce build time.

- [x] **Parallel Graph Building**
  - [x] **Worker Threads**: Offload intensive keyword matching to multiple CPU cores.
  - [x] **Async I/O**: Refactor `FileLoader` to use asynchronous batch processing to prevent `EMFILE` errors.
  - [x] **Robustness**: Implement fallback to sequential processing if workers fail.

### 2025-12-23 v0.8.7 - Scalability & UX Polish

**Goal**: Address rendering bottlenecks and improve layout control for large graphs.

- [x] **High-Capacity Processing**
  - [x] **Worker Scaling**: Increased thread limit to 12.
- [x] **Canvas Rendering**
  - [x] **Dual Engine**: implemented Canvas renderer for high-performance drawing of 10k+ nodes.
- [x] **Focus Mode UX**
  - [x] **Spacing Control**: Added UI slider to adjust node layer spacing.

### 2025-12-23 v0.8.8 - Scalability Defaults & Advanced Layout

**Goal**: Optimize default view for massive graphs and refine Focus Mode layout.

- [x] **Scalability Defaults**
  - [x] **Clutter Reduction**: Edges hidden by default; Orphans hidden by default.
  - [x] **On-Demand Context**: Relationships revealed on Hover or Focus.
- [x] **Focus Mode Enhancements**
  - [x] **Horizontal Spacing**: Added control for horizontal node separation to prevent overlap.

### 2025-12-23 v0.8.9 - Stability Improvements

**Goal**: Enhance observation stability.

- [x] **Interaction Stability**
  - [x] **Freeze**: Prevent node drift when selecting or dragging in Focus Mode.

### 2025-12-23 v0.9.0 - Precise Control & Stability

**Goal**: Provide tools for manual layout control and stable inspection.

- [x] **Hover Logic**
  - [x] **Auto-Freeze**: Lock node position on hover to facilitate inspection.
- [x] **Simulation UX**
  - [x] **Controls**: Add Speed slider and Freeze Layout toggle.
  - [x] **Manual Placement**: Allow manual node positioning when layout is frozen without auto-revert.

### 2025-12-23 v0.9.1 - Mobile Transformation

**Goal**: Transform the current web project into an Android APK application.

- [x] **Capacitor Integration**
  - [x] **Initialization**: Configured `capacitor.config.ts`.
  - [x] **Platform Support**: Added Android platform via `@capacitor/android`.
  - [x] **Asset Management**: Implemented `copy-assets` script and `npx cap sync`.
  - [x] **Build Pipeline**: Verified Gradle build configuration (`assembleDebug`).

### 2025-12-23 v0.9.2 - Mobile UI Optimization

**Goal**: Optimize UI/UX for small touch screens.

- [x] **Responsive Controls**
  - [x] **Collapsible Menu**: Main controls collapse to a button on mobile to save screen space.
  - [x] **Focus Mode UI**: Relocated "Exit Focus" button to bottom-center for accessibility.
  - [x] **Settings Consolidation**: Moved Language Selector into Settings Modal to declutter the interface.
- [x] **Touch Interactions**
  - [x] **Pinch-to-Zoom**: Added multi-touch support in Reading Window for text scaling.
  - [x] **Touch Targets**: Enlarged buttons and inputs for touch accuracy.

### 2025-12-23 v0.9.3 - Mobile Interaction Iteration

**Goal**: Refine interaction logic for mobile usability.

- [x] **Interaction Logic Update**
  - [x] **Single Click**: Triggers node highlight and tooltip (In/Out Degree display).
  - [x] **Double Click**: Triggers Focus Mode entry.
  - [x] **Desktop Compatibility**: Preserved `mouseover` for desktop hover while unifying click logic.

### 2025-12-23 v0.9.4 - Mermaid Image Optimization

**Goal**: Enhance reading experience for diagrams on mobile devices.

- [x] **Mermaid Zoom Mode**
  - [x] **Interaction**: Clicking a Mermaid diagram opens a full-screen overlay.
  - [x] **Gestures**: Implemented Pan (drag) and Zoom (pinch/wheel) logic within the overlay.
  - [x] **UX**: Added a prominent Exit button to close the zoom mode.

### 2025-12-24 v0.9.5 - Refined Mobile Experience & Focus Semantics

**Goal**: Polish interaction details and visual clarity for mobile and complex graphs.

- [x] **Focus Mode Enhancements**
  - [x] **Centering**: Viewport automatically centers on the focused node's original position.
  - [x] **Semantics**: Added clear area labels ("Helping to understand", "Further exploration").
  - [x] **Layout**: Implemented "Hierarchical (Left-Right)" layout option.
- [x] **Analysis Panel**
  - [x] **Mobile**: Panel is now scrollable and adapted for touch screens.
  - [x] **Interaction**: Clicking rows highlights the node and its connections in the graph.
- [x] **Visual Polish**
  - [x] **Mermaid**: Enhanced text visibility (shadow/outline) for light-colored diagrams.
  - [x] **Lines**: Ensured edges are hidden by default and only visible on interaction.

### 2025-12-24 v0.9.6 - Analysis & Visuals Polish

**Goal**: Further refine Analysis Panel mobile usability and fix visual inconsistencies.

- [x] **Mermaid Zoom Styling**
  - [x] **Fix**: Ensured Mermaid text shadow/grayscale persists in Full-screen Zoom mode.
- [x] **Degree Analysis Mobile**
  - [x] **Full Screen**: Added toggle to switch panel between half-height and full-screen.
  - [x] **Zoom**: Implemented pinch-to-zoom for the panel content.
  - [x] **Interaction**: Verified click-to-highlight logic works across views.
- [x] **Graph Interaction**
  - [x] **Robustness**: Added background click handler to clear highlights.

### 2025-12-24 v0.9.7 - Focus Mode Interaction Fix

**Goal**: Fix usability bugs in Focus Mode.

- [x] **Layout Switching**
  - [x] **Fix**: Switching between "Horizontal" and "Vertical" layouts now immediately refreshes the graph without requiring slider adjustment.

### 2025-12-24 v0.9.8 - Analysis Interaction Refinement

**Goal**: Ensure seamless interaction between Analysis Panel and Graph.

- [x] **Graph Sync**
  - [x] **Tooltip**: Clicking a node in the Analysis Panel now displays the tooltip (stats) on the graph at the node's position.
- [x] **Mobile UX**
  - [x] **Scrolling**: Fixed scroll behavior in Analysis Panel to prevent conflicts.

### 2025-12-24 v0.9.9 - Mobile Analysis Panel Polish

**Goal**: Enhance "Degree Analysis" page for mobile usability with gesture controls.

- [x] **Mobile Adaptation**
  - [x] **Slide Gesture**: Implemented "slide up and down" via touch drag on panel header.
  - [x] **Full Screen**: Supported toggling between floating window and full-screen page, with auto-snap on drag.
  - [x] **Zoom**: Verified two-finger pinch-to-zoom support for the interface.
- [x] **Interaction Verification**
  - [x] **Node Click**: Verified that clicking a node in the panel displays in-degree and out-degree relationships on the graph.

### 2025-12-24 v0.9.10 - Interaction Refinement (Click-to-Freeze)

**Goal**: Improve graph inspection stability by freezing the simulation on node click.

- [x] **Click Interaction**
  - [x] **Freeze on Click**: Clicking a node now immediately stops the force simulation (freezes all nodes) to prevent movement during inspection.
  - [x] **Resume on Cancel**: Clicking the background (blank area) unhighlights the node and resumes the simulation (unless manually frozen).
  - [x] **Visualization**: Ensured in-degree and out-degree lines are displayed clearly when frozen.

### 2025-12-24 v0.9.11 - Node Statistics & Localization

**Goal**: Enhance detailed inspection of nodes and complete internationalization.

- [x] **Focus Mode Localization**
  - [x] **Multi-language**: Implemented `t()` calls for semantic labels ("Helping to understand" / "Further exploration").
- [x] **Node Statistics Panel**
  - [x] **Interaction**: Clicking a node opens a dedicated panel showing relationships.
  - [x] **Visuals**: In-degree lines are Red, Out-degree lines are Blue (#4488ff).
  - [x] **Content**: Panel lists all incoming and outgoing neighbors with navigation support.

### 2025-12-24 v0.9.12 - Independent Statistics Popup

**Goal**: Separate node inspection from global analysis for better UX.

- [x] **Floating Statistics Window**
  - [x] **Interaction**: Clicking a node opens a floating popup showing In/Out degrees.
  - [x] **Visuals**: Distinct Red (In) and Blue (Out) indicators.
  - [x] **Independence**: Does not interfere with the main Degree Analysis panel.

### 2025-12-24 v0.9.13 - Focus Mode Isolation

**Goal**: Ensure specific interaction effects do not bleed into Focus Mode.

- [x] **Interaction Refinement**
  - [x] **Constraint**: Verified that clicking a node while in Focus Mode does _not_ trigger the floating statistics popup or change the highlight style, preserving the specific Focus Mode context.

### 2025-12-24 v0.9.14 - Visual & Data Fixes

**Goal**: Fix visualization of edge directions and data duplication.

- [x] **Edge Highlighting**
  - [x] **Canvas Support**: Implemented Red (In) and Blue (Out) edge coloring in the Canvas renderer (`renderCanvas`), previously generic gray.
- [x] **Data Integrity**
  - [x] **Deduplication**: Used `Set` to prevent duplicate node entries in the Statistics Popup neighbor lists.

### 2025-12-24 v0.9.15 - Enhanced Isolation

**Goal**: Optimize visual focus by effectively hiding unrelated context during inspection.

- [x] **Visual Optimization**
  - [x] **Deep Dimming**: Reduced opacity of unrelated nodes from 0.1 to 0.05 to better satisfy the "temporarily hidden" requirement while maintaining minimal context.
  - [x] **Edge Emphasis**: Increased highlighted edge width to 2.5px for clearer Red/Blue distinction.

### 2026-06-01 v1.0.0 - Production Release

**Goal**: Complete integration with Joplin/Obsidian plugins and polish UX.

- [x] **Plugin Wrapper**
  - Wrap the `NoteConnection` core logic into a Joplin Plugin and an Obsidian Plugin. (API Ready in v0.9.53)

- [x] **User Settings & Documentation (v0.7.0)**
  - [x] **Settings Manager**: Centralized management of application state (Physics, Visuals) with `localStorage` persistence.
  - [x] **Configuration UI**: Settings Modal for tuning Graph Physics (Gravity, Repulsion) and Visual preferences.
  - [x] **Reading Window (v0.8.0)**
    - [x] **Trigger**: Click focused node to open.
    - [x] **Content**: Renders Markdown, KaTeX (Math), Mermaid (Diagrams).
    - [x] **Interaction**: Zoom text and Resize images (Unlocked mode).
    - [x] **Config**: Window/Fullscreen toggle.
  - [x] **Finalize Documentation**: Complete User Manual and Developer Guide.
  - [x] **Final Polish & Demo Packaging**: Ensure zero-config startup (`npm start`) works seamlessly for promotion.
  - [x] **Release**: Package for v1.0.0.

---


