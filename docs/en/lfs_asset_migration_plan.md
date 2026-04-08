# 2026-04-07 v1.7.0 - Git LFS Asset Migration Plan

## Scope

- Remove Git LFS from the repository's default delivery path without breaking the current runtime model, npm publish flow, or desktop/mobile release automation.
- Cover the two asset classes that currently drive bandwidth usage:
  - generated graph payloads under `src/frontend/`
  - desktop sidecar binaries under `src-tauri/bin/`
- Keep the plan grounded in the current codebase. Every migration action below maps to existing files, scripts, runtime fallbacks, or tests.
- Use `docs/en/multi_platform_build_flow_audit.md` as the companion evidence matrix for cross-platform build/release behavior.
- Use `docs/en/sidecar_supply_strategy.md` for the anti-fragile supply ladder that rejects a pure download-only replacement for desktop sidecars.

## Status Update (2026-04-07, Phase 1 Contract Slice Landed)

The repository now has the first runtime-first contract cleanup in place:

- `scripts/copy-assets.js` now excludes generated graph payloads by default.
- explicit full-graph opt-in now lives behind `build:full` and `tauri:build:full`.
- Git LFS pointer placeholders are skipped even in explicit full mode, preventing accidental packaging of pointer stubs from `lfs: false` checkouts.
- `package.json` no longer declares `data.js` / `graph_data.json` in `pkg.assets`.
- `prepublishOnly` now aligns with the default runtime-first build path instead of reintroducing a separate mini-only semantic.

This means Phase 1 is no longer only a proposal. The remaining Phase 1 work is mostly broader regression coverage and contributor-flow cleanup.

## Status Update (2026-04-07, Phase 2 Bootstrap Slice Landed)

The repository now also has the first local-bootstrap hardening slice for Godot sidecars:

- `scripts/tauri-sidecar-utils.js` centralizes host binary resolution, validation, cache-path resolution, and pinned download bootstrap.
- `scripts/ensure-godot-sidecar.js` can now materialize a host Godot binary from cache or a pinned download URL.
- `scripts/validate-tauri-sidecars.js` now validates the host-specific Godot binary name instead of only the Windows filename.
- the new contract test `src/godot.sidecar.bootstrap.contract.test.ts` covers download, cache reuse, checksum mismatch, and host-specific validation.

This still does not remove repository-stored sidecars yet. It closes the bootstrap gap that had to be solved first.

Local smoke verification on the current Linux audit host also confirms the remaining developer-bootstrap boundary:

- `npm run prepare:godot:bin` now emits the expected strategy guidance and exits `0` on a raw checkout when no host Godot is available.
- `npm run verify:tauri:bin` now fails more accurately on the same raw checkout because the host `server-*` file is still only a Git LFS pointer placeholder and the host `markdown-worker-*` / `godot-*` binaries have not been materialized yet.

That result is important for migration planning: the repo-head graph payload cleanup does not create this failure mode, but the later sidecar-removal phase must treat fresh developer bootstrap as a first-class rollout risk.

## Status Update (2026-04-07, Guardrail Slice Landed Without CI Workflow Changes)

The repository now also has a local/future-CI guardrail for protected LFS paths:

- `scripts/verify-lfs-asset-policy.js` evaluates Git LFS usage under `src/frontend/` and `src-tauri/bin/`.
- `npm run verify:lfs:policy` passes only when no new protected LFS drift is detected beyond the temporary legacy allowlist.
- `npm run verify:lfs:policy:strict` is ready for the later no-LFS end state, but is not wired into CI yet.
- the dead `src-tauri/bin/node-x86_64-pc-windows-msvc.exe` LFS tracking residue was removed from `.gitattributes` and from the working tree.

This keeps the current CI design unchanged while adding a concrete enforcement primitive for the later migration phases.

## Status Update (2026-04-07, Phase 1 Repo-Head Cleanup Landed For Graph Payloads)

The repository head no longer carries the old bundled graph payload LFS residues:

- `src/frontend/data.js` and `src/frontend/graph_data.json` were removed from `.gitattributes`.
- the same two pointer files were removed from the working tree.
- `npm run build:full` still remains valid, but now only includes graph payloads when real locally generated files are present.
- `verify:lfs:policy` no longer treats bundled graph payloads as legacy exemptions.

This is the first actual head cleanup step, not just a contract rewrite. It remains low-risk because the runtime and default build path were already moved to runtime-first before the files were removed.

## Status Update (2026-04-07, Mobile Release Reality Revalidated)

The current mobile release behavior was rechecked against real code and the latest published Android artifact:

- the latest public Android asset is `v1.7.0` `app-universal-release-unsigned.apk`
- `.github/workflows/release-desktop-multi-os.yml` builds that artifact through `NOTE_CONNECTION_TAURI_ANDROID_TARGET=universal npm run tauri:android:build`
- inspecting the published APK shows `assets/path_mode/...`, but no bundled `data.js`, `graph_data.json`, `data_<target>.js`, `graph_data_<target>.json`, or `Knowledge_Base`

That result matters because it corrects an easy but wrong inference:

- current mobile release packaging does not appear to ship prebuilt graph cache files
- but mobile runtime is not limited to cache-restore only anymore
- Capacitor native runtime can scan markdown under `Knowledge_Base`, build graph data locally, and write `data.js` / `graph_data.json` through the Filesystem bridge
- Tauri Android runtime reports `supports_build=true` and routes build requests to Rust `build_graph_runtime`, which writes runtime graph artifacts into `runtime_data/`

Migration consequence:

- removing repository-head bundled graph payload LFS files does not newly break current mobile release semantics
- the real mobile risk surface is runtime content availability, storage permissions, dataset-size ceilings, and build UX parity, not "APK must contain prebuilt graph cache files"

## Current Code Baseline

### 1. Runtime graph loading is already runtime-first

The codebase already supports running without bundled graph payloads:

- `src/index.ts` writes `graph_data.json` and `data.js` into `runtimeDataDir` during graph generation.
- `src/server.ts` resolves generated assets from `runtime_data` first, then falls back to bundled frontend files.
- `src-tauri/src/lib.rs` mirrors the same runtime-first behavior for Tauri IPC and cache restore.
- `src/frontend/source_manager.js` and `src/frontend/app.js` already tolerate missing `data.js` and continue in mini/first-run mode.

This means the product model has already moved toward "generate at runtime, bundle less".

The same statement now applies to mobile with more nuance than before:

- Capacitor native runtime can locally build graph payloads when Filesystem APIs are available.
- Tauri Android runtime can locally build graph payloads through `build_graph_runtime`.
- the current release APK still appears to ship without prebuilt graph cache files, so mobile packaging and mobile runtime capability must be discussed separately.

### 2. Build and packaging had legacy static-asset assumptions

The runtime was ahead of the build contract:

- `scripts/copy-assets.js` used to copy `data.js` and `graph_data.json` in normal mode and exclude them only in `--mini` mode.
- `package.json` used to define `tauri:dev` and `tauri:build` as "full asset" paths, while `tauri:dev:mini` and `tauri:build:mini` used the runtime-first path.
- `package.json` used to list `data.js` and `graph_data.json` in `pkg.assets`.
- `src/pkg.sidecar.contract.test.ts` used to assert that `pkg.assets` contained `data.js` and `graph_data.json`.

This was the main engineering risk area for migration: removing LFS assets would not primarily break end users; it would break stale build assumptions unless the contract was updated first. The new runtime-first default closes the first half of that gap.

### 3. Release automation already avoids LFS checkout

Current release automation shows that production packaging is already close to the target state:

- `.github/workflows/release-desktop-multi-os.yml` checks out the repository with `lfs: false`.
- The same workflow now seeds a project-controlled GitHub Releases mirror tag for Godot archives, then downloads mirror-first per runner with upstream fallback.
- Desktop release jobs build via `npm run tauri:build:mini`.

This is strong evidence that sidecar and graph payload migration can be made safe for production releases.

### 4. npm publish is now semantically aligned, but still redundant

`.github/workflows/npm-publish.yml` also checks out with `lfs: false`, and now both the workflow `Build` step and `prepublishOnly` use the same runtime-first build semantic.

That closes the old mismatch, but the pipeline still performs the build twice:

1. run `npm run build` in the workflow
2. run `npm run build` again through `prepublishOnly`

This is now safe from an LFS-contract perspective, but it is still worth simplifying later if publish duration becomes a concern. For now, the CI design can remain unchanged.

### 5. Sidecar generation is already partly local/on-demand

The repository does not need precommitted server sidecars in order to function:

- `scripts/build-sidecar.js` builds host/selected `server-*` binaries into `src-tauri/bin`.
- `scripts/ensure-sidecar-ready.js` rebuilds sidecars when they are missing or stale.
- `scripts/validate-tauri-sidecars.js` validates expected binaries.

The remaining gap is Godot on local developer machines:

- `scripts/ensure-godot-sidecar.js` can copy from env vars and search paths.
- On Windows, missing Godot is currently fail-fast by default.

This means the sidecar migration is feasible, but local developer bootstrap needs to be upgraded before removing repository-stored binaries.

## Migration Principles

- Prefer runtime generation over repository-bundled payloads.
- Prefer reproducible local bootstrap over repository-stored executables.
- Separate "safe behavior change" from "history rewrite". The repo should stop depending on LFS before any Git history cleanup starts.
- Preserve current end-user behavior wherever it is already working, especially first-run, cache restore, release packaging, and Tauri mini startup.

## Phase 1: Remove Bundled Graph Payloads From the Default Build Path

### Goal

Make runtime-first / mini semantics the default for source builds, development runs, and package publishing.

### Code Support

The following files already support this direction:

- `src/index.ts`
- `src/server.ts`
- `src-tauri/src/lib.rs`
- `src/frontend/source_manager.js`
- `src/frontend/app.js`
- `docs/en/TEST_REPORT.md` documents that mini build first-run behavior has already been fixed

### Required Changes

1. Normalize the build contract around runtime-first assets.
   - Modify `scripts/copy-assets.js` so that the current "mini" behavior becomes the default-safe behavior.
   - Replace the current "full build" default with an explicit opt-in mode such as a demo build or legacy static build.

2. Make `package.json` reflect the new default.
   - Repoint `build`, `tauri:dev`, and any packaging-facing scripts to the runtime-first asset flow.
   - Keep an explicit opt-in script only if a prebundled demo graph is still required for internal QA.

3. Remove hardcoded static graph assumptions from pkg packaging.
   - Update `package.json` `pkg.assets`.
   - Update `src/pkg.sidecar.contract.test.ts` so the contract becomes "runtime data is generated/read safely" rather than "bundle these two giant files".

4. Strengthen runtime-first tests.
   - Extend `src/server.migration.test.ts` to cover the case where no bundled `data.js` or `graph_data.json` exists.
   - Extend startup/loadflow tests so "mini/no-prebundled-graph" remains the primary supported path, not a secondary path.

5. Preserve user-visible default/demo behavior intentionally.
   - If "Reset to Default" depends on bundled demo notes rather than bundled graph payloads, keep the demo notes.
   - Do not silently remove first-run guidance or fallback content.

### Engineering Risks

- `build` currently means "copy all frontend assets", while the runtime already tolerates missing graph payloads. Changing `build` is a contract change for contributors and CI.
- Some internal scripts or ad-hoc workflows may still assume a preloaded graph exists on first launch.
- If `Reset to Default` implicitly depends on a bundled graph payload, users may land in an emptier first-run state than before.
- For mobile, the meaningful risk is not "no `data.js` inside the APK". The real risk is whether the runtime can actually reach a valid `Knowledge_Base` and complete local build within platform limits.

### User / Runtime Impact

- Existing installed desktop releases should not be affected by this phase.
- Future desktop releases should remain safe because release automation already builds with `tauri:build:mini`.
- Current Android release behavior is also compatible with this phase because the latest published APK already appears to omit prebuilt graph cache assets.
- Developers are the main affected group:
  - `npm run tauri:dev` will behave more like today's mini build
  - first-run may show an empty state until a Knowledge Base is selected
- Mobile-specific runtime caveat remains:
  - Capacitor local build is bounded by in-app file-count and payload-size limits.
  - Tauri Android local build still depends on runtime access to the selected Knowledge Base.

### Mitigations

- Keep a small demo Knowledge Base if the product still needs a non-empty first-run.
- Rename or document scripts clearly so developers know whether a run is runtime-first or demo-prebundled.
- Update docs before removing the LFS files so contributors do not misread the new behavior as a regression.
- For mobile QA, verify runtime graph build against realistic datasets instead of treating bundled graph payload presence as the safety signal.

### Verification

- `npm run build:mini`
- `npm run tauri:dev:mini`
- `npm run tauri:build:mini`
- npm publish dry-run with an `lfs: false` checkout
- Startup path where no bundled `data.js` exists
- Cache restore path for `data.js` / `graph_data.json`

### Rollback

- Restore the old `copy-assets.js` semantics.
- Restore the old `pkg.assets` entries and contract test expectations.
- Reintroduce bundled graph payloads temporarily without touching Git history yet.

## Phase 2: Remove Repository-Stored Sidecar Binaries From the Default Branch

### Goal

Stop storing large `src-tauri/bin/*` executables in Git LFS while preserving local developer bootstrap and release reproducibility.

### Code Support

The current codebase already contains the primitives needed for this migration:

- `scripts/build-sidecar.js` builds server sidecars locally
- `scripts/ensure-sidecar-ready.js` rebuilds or refreshes missing/stale sidecars
- `scripts/validate-tauri-sidecars.js` verifies required binaries
- `.github/workflows/release-desktop-multi-os.yml` downloads Godot per runner and does not need repository-stored Godot binaries

### Required Changes

1. Keep server sidecars local-build/on-demand only.
   - Remove the expectation that `server-*` binaries are committed assets.
   - Let `scripts/ensure-sidecar-ready.js` and `scripts/build-sidecar.js` own server sidecar materialization.

2. Upgrade Godot bootstrap for local developers.
   - Extend `scripts/ensure-godot-sidecar.js` so it can optionally download and cache a host-appropriate Godot binary when it is not found locally.
   - Preserve `NOTE_CONNECTION_GODOT_EXE` and search-dir overrides as the manual escape hatch.

3. Make validation reflect the new ownership model.
   - `scripts/validate-tauri-sidecars.js` should validate "materialized locally" sidecars, not "must already exist in git checkout".

4. Document local bootstrap explicitly.
   - Contributors need a clear path for Windows, Linux, and macOS host setup once the repository no longer provides large binaries.

### Engineering Risks

- Windows developer bootstrap is the highest-risk segment because missing Godot currently fails hard by default.
- Auto-download introduces new failure modes:
  - offline development
  - upstream release URL drift
  - checksum / integrity handling
  - antivirus or quarantine issues on Windows/macOS
- If sidecar validation is updated too early without a reliable materialization path, local `tauri:dev` and `tauri:build` can become flaky.

### User / Runtime Impact

- Existing end users should not be affected because installed releases already contain built artifacts.
- Release CI should remain stable or improve, because it already downloads Godot explicitly.
- Developers are again the main affected group:
  - first local build may need a bootstrap/download step
  - offline development requires a documented manual override path
  - a fresh raw checkout can still fail `npm run verify:tauri:bin` until host `server-*` LFS residues are replaced and host `markdown-worker-*` / `godot-*` binaries are materialized

### Mitigations

- Add checksum verification for downloaded Godot artifacts.
- Cache downloaded binaries outside the repository working tree.
- Preserve environment-variable overrides and documented manual placement paths.
- Roll this out only after Windows bootstrap is verified end to end.

### Verification

- `npm run tauri:dev:mini` on Windows/Linux/macOS hosts
- `npm run tauri:build:mini`
- `npm run verify:tauri:bin`
- Desktop release workflow on all runner types
- Android/Tauri workflows that depend on `build:sidecar`

### Rollback

- Restore repository-side binary fallback temporarily.
- Keep bootstrap download logic, but allow committed binaries to satisfy validation while stabilizing the new path.

## Phase 3: Remove LFS Tracking and Clean History Only After Runtime Independence Is Proven

### Goal

After the repository no longer depends on committed graph payloads or sidecar binaries, clean up LFS usage and add guardrails so the problem does not return.

### Required Changes

1. Remove now-obsolete LFS tracking rules from `.gitattributes`.

2. Perform controlled repository cleanup.
   - Use `git lfs migrate export` or `git filter-repo` in a coordinated maintenance window.
   - Announce the rewrite, freeze open branches, and give contributors a reclone/rebase playbook.

3. Add budget guardrails.
   - Add a CI script that fails if new LFS objects appear under:
     - `src/frontend/`
     - `src-tauri/bin/`
   - Add a size-budget check for large generated/demo assets.

4. Audit the docs and contributor flows.
   - Remove outdated advice that implies cloning the repo should materialize giant runtime payloads.

### Engineering Risks

- History rewrite is the only phase that disrupts collaborators directly.
- Open PRs, forks, local branches, and automation that pins old SHAs can all be affected.
- If tags/releases are not handled carefully, downstream references may become confusing.

### User / Project Impact

- End users of existing release artifacts should still be unaffected.
- Contributors and maintainers will be affected during the rewrite window.
- This phase should be treated as repository maintenance, not as a runtime feature rollout.

### Mitigations

- Do not start this phase until Phases 1 and 2 have already shipped safely.
- Create a migration tag / archival branch before rewriting.
- Publish exact recovery steps for contributors.

### Verification

- Fresh clone after rewrite
- npm publish dry-run
- desktop release workflow dry-run
- no LFS objects reported in protected paths

### Rollback

- Keep an archival remote or pre-rewrite mirror.
- If the rewrite causes unacceptable disruption, stop at "no new LFS usage" and defer history cleanup.

## Recommended Rollout Order

1. Phase 1 first.
   - Lowest end-user risk
   - Highest leverage on LFS bandwidth
   - Mostly a build-contract cleanup

2. Phase 2 second.
   - Necessary before the repository can fully stop storing giant binaries
   - Main challenge is developer bootstrap, not product runtime

3. Phase 3 last.
   - Maintenance-only
   - Should not begin until the codebase has already proven it no longer depends on those assets

## Go / No-Go Criteria

Proceed to history cleanup only if all of the following are true:

- `tauri:build:mini` is the stable default release path
- local developer bootstrap works without repository-stored sidecar binaries
- npm publish no longer relies on a full-build step against an `lfs: false` checkout
- startup, cache restore, and first-run flows pass without bundled graph payloads
- contributor documentation has been updated

## Recommendation

This migration is worth doing, but it should be treated as a contract migration, not a file deletion task.

The safest path is:

- first make runtime-first graph loading the default build contract
- then move sidecar provisioning to reproducible local/bootstrap logic
- only then remove LFS tracking and consider history cleanup

That sequence minimizes end-user risk while directly addressing the root cause of the Git LFS bandwidth warning.
