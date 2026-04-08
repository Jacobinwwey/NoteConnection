# 2026-04-07 v1.7.0 - Multi-Platform Build Flow Audit

## Scope

- Audit the build and delivery paths that materially affect the Git LFS migration.
- Keep every migration recommendation grounded in the current repository code, not in historical assumptions.
- Cover desktop source builds, desktop Tauri bundles, Android Capacitor, Android Tauri, npm publish, docs site, GitHub Pages, and GitHub Releases.
- Pair this audit with `docs/en/sidecar_supply_strategy.md` when evaluating whether remaining desktop sidecar LFS residues can be reduced without introducing brittle network dependence.

## Why This Audit Exists

The LFS migration is safe only if the real build graph is understood platform by platform.

The repository already mixes:

- runtime-first graph generation
- explicit full-graph opt-in paths
- desktop sidecar packaging
- Android dual pipelines
- npm publish and docs-specific CI

Without a concrete build-flow audit, it is too easy to make a correct change for one surface and silently break another.

## Build Flow Matrix

### 1. Source web build: default runtime-first

Entry points:

- `npm run build`
- `npm run build:mini`

Primary code evidence:

- `package.json` `build` / `build:mini`
- `scripts/copy-assets.js`
- `src-tauri/tauri.conf.json` `build.frontendDist`

Observed contract:

- both default source build paths write frontend output into `dist/src/frontend`
- generated graph payloads are excluded by default
- `copy-assets.js` treats `data.js` / `graph_data.json` as runtime-generated assets and skips Git LFS pointer placeholders

Migration meaning:

- Phase 1 graph-payload removal is aligned with the default build path
- repo-head `data.js` / `graph_data.json` files are no longer required for ordinary source builds

### 2. Explicit full-graph build: opt-in only

Entry points:

- `npm run build:full`
- `npm run tauri:build:full`

Primary code evidence:

- `package.json` `build:full`
- `scripts/copy-assets.js --include-generated-graph-assets`
- `scripts/run-tauri-build.js`
- `scripts/run-tauri-frontend-build.js`
- `src-tauri/tauri.conf.json`
- `src/tauri.frontend.build.contract.test.ts`

Observed contract:

- full mode includes generated graph assets only when real locally generated files exist
- Git LFS pointer placeholders are still excluded
- desktop Tauri full build now preserves full-mode semantics through Tauri `beforeBuildCommand`

Important fix landed in this slice:

- before this audit, `tauri:build:full` prebuilt full assets, but Tauri `beforeBuildCommand` still reran plain `npm run build`
- that meant explicit full output could be overwritten back to runtime-first during bundling
- the repository now routes Tauri frontend prebuild through `scripts/run-tauri-frontend-build.js`, and `tauri:build:full` passes `--frontend-build-mode full`

Migration meaning:

- explicit full mode remains available for QA/demo use
- default flows can stay runtime-first without losing the ability to prove full-mode behavior

### 3. Desktop Tauri local dev and bundle flow

Entry points:

- `npm run tauri:dev`
- `npm run tauri:dev:mini`
- `npm run tauri:dev:full`
- `npm run tauri:build`
- `npm run tauri:build:mini`
- `npm run tauri:build:full`

Primary code evidence:

- `package.json`
- `src-tauri/tauri.conf.json`
- `scripts/build-sidecar.js`
- `scripts/ensure-sidecar-ready.js`
- `scripts/ensure-godot-sidecar.js`
- `scripts/validate-tauri-sidecars.js`

Observed contract:

- desktop Tauri bundles still depend on `src-tauri/bin/*` external sidecars
- the bundle config declares `bin/server`, `bin/godot`, and `bin/markdown-worker`
- local desktop flows materialize or validate sidecars before bundling

Migration meaning:

- desktop graph-payload removal is low risk
- desktop sidecar removal is the real high-risk migration phase because bundle reproducibility still depends on those binaries existing locally at bundle time

### 4. Android Capacitor pipeline

Entry points:

- `build_apk.bat`
- `npm run mobile:build:capacitor`

Primary code evidence:

- `build_apk.bat`
- `capacitor.config.ts`
- `package.json`

Observed contract:

- Capacitor packages `dist/src/frontend` as `webDir`
- the helper script is Windows-first and shells through a `.bat` pipeline
- the script enforces JDK 21+ even though older docs historically said 17+
- the script syncs web assets into `android/app/src/main/assets/public`

Runtime boundary:

- Capacitor runtime can still build graph data locally when Filesystem APIs are available
- local build is bounded by `CAPACITOR_GRAPH_BUILD_MAX_FILES = 2000` and `CAPACITOR_GRAPH_BUILD_MAX_BYTES = 16 * 1024 * 1024`

Migration meaning:

- Capacitor packaging does not need bundled repo-head graph payloads
- the bigger risk is Windows-only helper ergonomics and mobile runtime dataset/permission boundaries

### 5. Android Tauri pipeline

Entry points:

- `npm run tauri:android:init`
- `npm run tauri:android:dev`
- `npm run tauri:android:build`
- `npm run tauri:android:build:universal`

Primary code evidence:

- `package.json`
- `scripts/verify-tauri-android-prereqs.js`
- `scripts/run-tauri-android.js`
- `src-tauri/tauri.android.conf.json`
- `src-tauri/src/lib.rs`

Observed contract:

- Tauri Android requires JDK 21+ and Android SDK/NDK readiness
- local helper defaults to `aarch64` for `dev`/`build` unless an explicit target is provided
- Android bundle config clears `externalBin`, so desktop sidecars are not shipped in Android packages
- Android runtime reports `supports_build=true` and uses native `build_graph_runtime`

Migration meaning:

- current mobile release behavior already tolerates absence of bundled graph cache files
- Android Tauri is a runtime-native graph-build path, not a sidecar-packaging path

### 6. GitHub desktop and Android release pipeline

Entry points:

- `.github/workflows/release-desktop-multi-os.yml`

Primary code evidence:

- desktop jobs checkout with `lfs: false`
- desktop jobs seed a project-controlled GitHub Releases Godot mirror tag, then download Godot mirror-first per runner with upstream fallback
- desktop jobs build with `npm run tauri:build:mini`
- Android release job builds with `NOTE_CONNECTION_TAURI_ANDROID_TARGET=universal npm run tauri:android:build`

Observed contract:

- release packaging is already largely detached from repository-stored LFS graph payloads
- release CI still needs sidecar/bootstrap materialization, but it now prefers a project-controlled GitHub Releases mirror instead of going straight to third-party upstream on the main path
- upstream fallback still exists as a transitional safety rail, so digest pinning and fallback removal remain future hardening work
- real smoke runs on 2026-04-08 already proved the cold-start mirror job can create and seed `godot-mirror-v4.3-stable`, and that Windows, macOS, Linux, and Android release assets can all ship through the current mirror-first release path
- release logs also surfaced a non-blocking operational debt item: `actions/upload-artifact@v4` and `softprops/action-gh-release@v2` are still Node 20-targeted and currently depend on GitHub's Node 24 forced-runtime compatibility

Migration meaning:

- Phase 1 graph-payload cleanup is already compatible with release CI
- later sidecar removal must preserve release-time binary materialization guarantees
- the main remaining uncertainty is release hardening depth, not whether a project-controlled mirror can be inserted into the current CI shape

### 7. npm publish pipeline

Entry points:

- `.github/workflows/npm-publish.yml`
- `prepublishOnly`

Primary code evidence:

- workflow checkout uses `lfs: false`
- workflow runs `npm run build`
- workflow runs SBOM, attestation, strict PathBridge, wasm parity, sidecar-signature, and Jest gates before publish
- `prepublishOnly` also runs `npm run build`

Observed contract:

- npm publish is now semantically aligned with runtime-first output
- build still runs twice, but both passes now agree on runtime-first semantics

Migration meaning:

- graph-payload removal does not destabilize npm publish
- CI redesign is optional, not required for this migration phase

### 8. Docs site and GitHub Pages pipelines

Entry points:

- `npm run docs:diataxis:check`
- `npm run docs:site:build`
- `.github/workflows/docs-diataxis-site.yml`
- `.github/workflows/docs-github-pages-publish.yml`

Primary code evidence:

- `mkdocs.yml`
- `docs/diataxis-map.json`
- docs workflows checkout with `lfs: false`

Observed contract:

- docs delivery is isolated from LFS graph payload and sidecar binaries
- docs governance is controlled through the Diataxis mapping file plus MkDocs build

Migration meaning:

- documentation changes can be shipped independently of the runtime migration
- docs should be used to record platform-specific boundaries rather than forcing CI redesign

## Migration Items Backed By Real Code

### Item 1. Keep runtime-first as the default build contract

Current code support:

- `package.json` `build`
- `scripts/copy-assets.js`
- `src/server.ts`
- `src-tauri/src/lib.rs`
- `src/frontend/source_manager.js`

Why this item is valid:

- runtime loading already tolerates missing bundled graph payloads
- current default build already excludes runtime-generated graph assets

Risk if skipped:

- repo-head cleanup would drift away from the real build contract

Verification:

- `npm run build`
- `npm run test:migration`

### Item 2. Preserve explicit full-mode as a deliberate opt-in path

Current code support:

- `package.json` `build:full`, `tauri:build:full`
- `scripts/run-tauri-build.js`
- `scripts/run-tauri-frontend-build.js`
- `src/tauri.frontend.build.contract.test.ts`

Why this item is valid:

- QA/demo flows still need a supported path for prebuilt graph assets
- the explicit full-mode contract now survives the Tauri bundling step

Risk if skipped:

- future contributors may assume full mode works while Tauri silently reverts to runtime-first

Verification:

- `npx jest src/tauri.frontend.build.contract.test.ts --runInBand`
- `npm run build:full`

### Item 3. Remove repo-head graph payloads before touching history

Current code support:

- `.gitattributes`
- `scripts/verify-lfs-asset-policy.js`
- `src/lfs.asset.policy.contract.test.ts`
- `src/copy.assets.contract.test.ts`

Why this item is valid:

- repo-head graph payload residues are already removed
- future regressions are now observable through policy and contract tests

Risk if skipped:

- LFS bandwidth continues to be spent on assets the runtime no longer needs by default

Verification:

- `npm run verify:lfs:policy`
- `npm run test:migration`

### Item 4. Treat sidecar removal as a separate, higher-risk phase

Current code support:

- `scripts/build-sidecar.js`
- `scripts/ensure-sidecar-ready.js`
- `scripts/ensure-godot-sidecar.js`
- `scripts/validate-tauri-sidecars.js`
- `.github/workflows/release-desktop-multi-os.yml`

Why this item is valid:

- desktop Tauri packaging still depends on binary materialization
- release CI already proves that Godot can be provided outside repo-head

Risk if rushed:

- broken desktop local bundle builds
- broken fresh-checkout developer bootstrap
- invalid `src-tauri/bin/*` placeholders passing unnoticed without validation

Verification:

- `npm run prepare:godot:bin`
- `npm run verify:tauri:bin`
- `npm run test:migration`

### Item 5. Keep mobile packaging and mobile runtime capability as separate concepts

Current code support:

- `build_apk.bat`
- `capacitor.config.ts`
- `scripts/run-tauri-android.js`
- `src/frontend/storage_provider.js`
- `src/frontend/source_manager.js`
- `src-tauri/src/lib.rs`

Why this item is valid:

- current release APKs do not appear to ship bundled graph cache files
- both Capacitor native runtime and Tauri Android runtime can still build graph data locally

Risk if misunderstood:

- unnecessary rollback of graph-payload cleanup
- wrong conclusions about mobile regressions

Verification:

- `npm run verify:android:env`
- `npm run test:mobile:contracts`
- release asset inspection against the latest APK

## Replacement Assessment: Can `sidecar/bootstrap` be replaced now?

Short answer:

- not globally under the current roadmap

Desktop reality:

- desktop sidecar binaries are still part of the intended product architecture, not just a legacy distribution shortcut
- current desktop scripts still build or validate the Node server sidecar, the Markdown worker sidecar, and the Godot sidecar before Tauri bundling
- Tauri desktop bundle config still declares `bin/server`, `bin/godot`, and `bin/markdown-worker` as `externalBin`
- Rust startup still bootstraps runtime data, spawns the Node sidecar, and then spawns Godot as a local process
- frontend startup still treats sidecar-backed loading and early Godot bridge priming as the primary desktop path

Mobile reality:

- Android runtime is already on a selective replacement path: Android package config clears `externalBin`, runtime capability gating reports `supports_sidecar = false`, and graph build falls back to native `build_graph_runtime`
- Capacitor runtime also has its own local build path through native filesystem access when dataset limits and permissions allow it
- however, Android helper scripts still invoke `build:sidecar` today, so build-chain decoupling is incomplete even though runtime decoupling already exists

Migration implication:

- current LFS migration work can replace repository-head binary storage and tighten bootstrap reproducibility
- that is not the same as removing desktop sidecar/bootstrap from the architecture
- a real desktop-side replacement would require a new plan for local build execution, content retrieval, Markdown worker behavior, Godot rendering orchestration, and release-time binary materialization guarantees
- therefore the correct near-term direction is: keep desktop sidecar/bootstrap contracts intact, keep mobile-native fallback paths expanding, and treat desktop sidecar removal as a separate roadmap decision

Verification anchors:

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/tauri.android.conf.json`
- `src-tauri/src/lib.rs`
- `src/frontend/storage_provider.js`
- `src/frontend/source_manager.js`
- `scripts/build-sidecar.js`
- `scripts/ensure-sidecar-ready.js`
- `scripts/ensure-godot-sidecar.js`
- `.github/workflows/release-desktop-multi-os.yml`

### Component breakdown

| Component | Current responsibility | Replaceable now? | Main blocker | Preferred next move |
| --- | --- | --- | --- | --- |
| Node sidecar | desktop KB listing, content API, build API, startup orchestration | No on desktop; selectively replaced on Android runtime | desktop bundle still ships `bin/server`; Rust startup still spawns `server`; frontend desktop flow still prefers sidecar | keep desktop path stable, keep mobile-native fallbacks expanding |
| Godot bootstrap | materialize host Godot binary for desktop dev/build/release flows | No on desktop | desktop bundle still ships `bin/godot`; Rust startup still spawns Godot; release workflow still materializes Godot before bundle | improve reproducible bootstrap, cache, and pinned-download guarantees instead of removing it |
| markdown-worker | shared markdown protocol support across Tauri and Godot readers | No on desktop | bundle still ships `bin/markdown-worker`; sidecar build still compiles it; markdown protocol still spans desktop readers | only revisit after reader protocol has a full non-sidecar native replacement |
| PathBridge | Godot synchronization, early desktop path producer, single-window coordination | No on desktop path mode | server still initializes `PathBridge`; frontend still primes early bridge websocket for Godot | treat any future renderer abstraction as a separate architecture project |
| Android build-chain coupling | Android helper scripts still call `build:sidecar` before `tauri android dev/build` | Partially, but not finished | runtime already disables `externalBin`, but helper scripts still reuse desktop sidecar prep | split Android helper preparation from desktop sidecar preparation, then re-verify dev/build targets |

## LFS Decision Table

This is the practical decision layer for the current repository state.

| Item | Architecture status | LFS status | Decision | Reason |
| --- | --- | --- | --- | --- |
| `src/frontend/data.js` | not a required default runtime artifact anymore | historical LFS residue only | keep removed from repo head | runtime-first flow and policy tests already replaced bundled graph payloads |
| `src/frontend/graph_data.json` | not a required default runtime artifact anymore | historical LFS residue only | keep removed from repo head | same as `data.js`; mobile viability is no longer tied to bundled cache presence |
| `src-tauri/bin/godot-x86_64-pc-windows-msvc.exe` | still required for desktop architecture | still allowed as legacy LFS path | migrate off LFS next | release CI already materializes Godot externally and local bootstrap already supports cache / override / download flows |
| `src-tauri/bin/server-x86_64-pc-windows-msvc.exe` | still required for desktop architecture | still allowed as legacy LFS path | migrate off LFS later, not first | sidecar architecture stays, but fresh-checkout reproducibility for local developers must be hardened before removal |
| `src-tauri/bin/server-x86_64-unknown-linux-gnu` | still required for Linux desktop packaging | still allowed as legacy LFS path | migrate off LFS later, not first | release CI can build on Linux runner, but local and release bootstrap guarantees must stay explicit |
| `src-tauri/bin/server-aarch64-apple-darwin` | still required for macOS desktop packaging | still allowed as legacy LFS path | migrate off LFS later, not first | same reason as Linux/Windows server binaries; this is a binary availability problem, not an architecture replacement problem |
| `src-tauri/bin/markdown-worker-*` | still required for desktop reader protocol | not currently LFS-tracked | not an LFS blocker right now | keep current local-build path and do not confuse it with the remaining LFS debt |
| `src/core/PathBridge.ts` | still required for desktop Godot sync | source code, not LFS-tracked | not an LFS blocker | this is an architecture dependency, but not a binary storage dependency |
| `src-tauri/bin/node-x86_64-pc-windows-msvc.exe` | removed from current architecture | still appears in historical `git lfs ls-files` output only | keep removed | policy and repo-head checks already treat it as dead residue, not an active blocker |

Operational meaning:

- desktop core dependencies still require artifact availability
- artifact availability does not require Git LFS specifically
- therefore the current path is phased LFS removal with stronger bootstrap guarantees, not desktop architecture deletion

## Cross-Platform Friction Still Present

These are not blockers for the current LFS slice, but they are real build-flow risks visible in the current code:

- `build_apk.bat` is Windows-only, so Capacitor helper ergonomics are not yet cross-platform.
- `package.json` helper scripts such as `tauri:dev:gpu`, `tauri:dev:mini:gpu`, `tauri:android:dev:universal`, and `tauri:android:build:universal` still use Windows `set VAR=...&&` syntax.
- npm publish and Tauri bundle flows still rebuild frontend assets redundantly.

These should be treated as follow-up engineering items, not as reasons to restore Git LFS graph payload usage.

## Recommended Next Steps

1. Keep Phase 1 graph-payload cleanup in place and document runtime-first as the default product contract.
2. Preserve the new explicit-full Tauri build contract and keep it covered by migration tests.
3. Do not couple mobile feasibility to prebundled graph-cache presence inside APK artifacts.
4. Move the next migration focus to sidecar bootstrap reproducibility, especially for fresh desktop developer checkouts.
5. If cross-platform local build ergonomics become a priority, replace Windows-only helper wrappers with Node-based runners instead of reopening LFS usage.

## Verification Checklist

- `npx jest src/tauri.frontend.build.contract.test.ts --runInBand`
- `npm run docs:diataxis:check`
- `npm run docs:site:build`
- `npm run test:migration`
- `npm run build`
- `npm run build:full`
- `npm run verify:lfs:policy`
