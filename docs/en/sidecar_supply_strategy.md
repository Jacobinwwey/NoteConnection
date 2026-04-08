# 2026-04-08 v1.7.0 - Anti-Fragile Sidecar Supply Strategy

## English Document

### Why this document exists

The current desktop product line still depends on `Node sidecar + Godot + markdown-worker + PathBridge`.
That does **not** automatically mean the project must keep using Git LFS forever.
It only means desktop builds still need reliable artifact availability.

The real engineering question is:

- should artifact availability continue to depend on repository-stored large binaries, or
- should it move to a more resilient supply path with cache, mirror, validation, and offline seeding?

This document takes the second position, but rejects a naive "just download it from the internet" replacement.

### What should be rejected

The following approach should be treated as a bad migration direction:

- remove legacy LFS residues
- replace them with direct third-party downloads only
- assume source builders always have stable internet access

Why this is weak:

- local fresh checkout becomes sensitive to regional network, proxies, and GitHub availability
- CI and local bootstrap can drift into different trust models
- failure moves from `git clone` to `prepare/build`, but does not actually disappear
- Windows desktop bootstrap becomes more fragile because missing Godot already hard-fails there

Current code evidence:

- `scripts/ensure-godot-sidecar.js`
- `scripts/tauri-sidecar-utils.js`
- `.github/workflows/release-desktop-multi-os.yml`
- `scripts/build-sidecar.js`
- `scripts/build-markdown-worker.js`

### Better direction

The recommended direction is:

- keep desktop architecture intact for now
- reduce LFS in phases
- make sidecar supply **cache-first and mirror-aware**
- preserve a manual offline seed path
- keep local bootstrap and CI on the same source and validation model

This is stronger than both extremes:

- stronger than "keep everything in LFS forever"
- stronger than "delete LFS and rely on the public internet"

### Supply ladder

For desktop sidecar artifacts, the preferred acquisition order should be:

1. local target already present and valid
2. local cache already present and valid
3. project-controlled mirror with pinned digest
4. local build from source where appropriate
5. manual offline seed package

Rejected order:

1. direct upstream download first
2. fail if network is unavailable

### Current repository assessment

#### Keep as architecture, not as permanent LFS storage

- `server-*`
- `godot-*`
- `markdown-worker-*`
- `PathBridge.ts`

#### Already removed from default runtime and should stay out of repo-head

- `src/frontend/data.js`
- `src/frontend/graph_data.json`

#### Most suitable first LFS migration target

- `src-tauri/bin/godot-x86_64-pc-windows-msvc.exe`

Reason:

- release CI already materializes Godot outside repo-head
- local bootstrap already supports candidate paths, cache, and pinned download

#### Not the first LFS migration target

- `src-tauri/bin/server-*`

Reason:

- desktop architecture still requires them
- the project still needs stronger reproducibility guarantees for fresh local checkouts before removing the remaining legacy bridge

### Code-backed guardrails added in this slice

#### New verifier

Run:

```bash
npm run verify:sidecar:supply
```

Optional JSON output:

```bash
npm run verify:sidecar:supply -- --json
```

What it reports:

- whether the current host is offline-ready for desktop bootstrap
- whether Godot bootstrap still needs network to complete
- whether release CI still downloads directly from third-party upstream
- which protected legacy LFS paths are still present

Primary code:

- `scripts/sidecar-supply-readiness-utils.js`
- `scripts/verify-sidecar-supply-readiness.js`

#### New contract coverage

- `src/sidecar.supply.readiness.contract.test.ts`
- `src/sidecar.replacement.boundary.contract.test.ts`
- `src/lfs.asset.policy.contract.test.ts`

### Real cloud execution evidence

On 2026-04-08 the mirror-first path was exercised against real GitHub Actions release runs, not only local tests:

- `smoke-lfs-mirror-first-20260408-002012` exposed that the no-checkout mirror job still let `gh release create/upload` infer repository context from local `.git`, and it also surfaced an Android regression caused by host validation drifting into a Linux Godot requirement.
- `smoke-lfs-mirror-first-20260408-002917` confirmed the Android-side guardrail fix, but proved `gh release view/create/upload` still needed explicit `--repo "$GITHUB_REPOSITORY"` binding in the mirror job.
- `smoke-lfs-mirror-first-20260408-003325` then cold-created and seeded the dedicated `godot-mirror-v4.3-stable` release with the Windows, Linux, and macOS Godot archives. The same run completed successfully across Windows, macOS, Linux, and Android release jobs, uploading the expected desktop installers/packages plus the universal Android APK.

What this proves:

- project-controlled mirror seeding is now a real workflow behavior, not only a design proposal
- mirror-first supply can be introduced without replacing the desktop sidecar architecture
- the main implementation risk is now supply hardening and release-governance debt, not feasibility

### Critical risks to address before strict no-LFS mode

1. CI now seeds and prefers a project-controlled GitHub Releases mirror for Godot, live smoke runs have proven cold-start mirror creation, and the workflow now pins the mirrored desktop archives with fixed SHA256 values. Upstream fallback still remains enabled by default as a transitional safety rail, but `workflow_dispatch` can now disable it explicitly for mirror-only smoke verification.
2. Local and CI artifact trust models are not fully unified yet.
3. Windows developer bootstrap remains sensitive to missing Godot because current bootstrap treats it as required.
4. `server-*` binary availability still depends on local build reproducibility or legacy LFS bridge paths.
5. Release smoke logs now show a non-blocking platform warning: `actions/upload-artifact@v4` and `softprops/action-gh-release@v2` are still Node 20-targeted and are currently being force-run on Node 24 by GitHub Actions.

### Mirror feasibility matrix

The current codebase does not require a provider-specific refactor before trying mirror-backed Godot supply.
`scripts/tauri-sidecar-utils.js` already accepts:

- `NOTE_CONNECTION_GODOT_DOWNLOAD_URL`
- `NOTE_CONNECTION_GODOT_DOWNLOAD_SHA256`
- `NOTE_CONNECTION_GODOT_CACHE_DIR`

That makes the bootstrap contract provider-neutral for GitHub Releases, generic HTTPS object storage, and local file-based seeds.

| Option | Infra cost | User barrier | Maintainer cost | Current fit | Recommendation |
|---|---|---|---|---|---|
| Keep remaining desktop sidecars on Git LFS | already rising with bandwidth pressure | low | low now, worse later | works today | transition only |
| GitHub Releases as first mirror | usually lowest additional cost | low | low | strong | implemented first step |
| Generic object storage mirror such as R2/B2 | low to medium recurring cost | low | medium | strong | recommended second |
| Direct third-party upstream download only | low direct hosting cost | medium to high | medium | technically possible | reject |
| Fully self-hosted mirror/CDN | medium to high | low | high | technically possible | reject for current stage |

Important boundary:

- GitHub Releases is already close to the current maintenance model because the repo already creates releases and uploads application bundles there.
- The release workflow now also seeds standalone Godot mirror archives into a dedicated mirror tag before desktop bundle jobs run, and that behavior has been proven in live smoke runs on 2026-04-08.
- The release workflow can now be dispatched with `allow_godot_upstream_fallback=false` to verify strict mirror-only release behavior without changing the default tag-release path.
- It is still not fully hardened because upstream fallback remains enabled by default, and future Godot version bumps will need controlled digest rotation rather than ad-hoc edits.
- No separate paid mirror service was required for this first migration slice because GitHub Releases already matched the current project maintenance surface.
- Generic HTTPS object storage is also technically feasible now because bootstrap only depends on URL + SHA256 + cache, not on a specific vendor API.

### Recommended phased roadmap

#### Phase A: observability and explicit policy

- keep current runtime-first and sidecar-boundary tests
- use `verify:sidecar:supply` to make network dependency visible instead of implicit

#### Phase B: Godot supply hardening

- move CI and local bootstrap toward a shared mirror + digest policy
- keep cache and manual seed support
- keep exercising mirror-only smoke runs with `allow_godot_upstream_fallback=false`
- remove default upstream fallback and then remove Godot from legacy LFS once mirror/bootstrap parity is proven

#### Phase C: server artifact reproducibility

- make fresh-checkout `server-*` materialization deterministic for supported desktop hosts
- only then remove remaining `server-*` legacy LFS paths

#### Phase D: strict end state

- switch from legacy-allowlist verification toward strict no-LFS enforcement for protected roots

### Bottom line

The correct question is not:

- "Can desktop sidecar architecture be removed right now?"

The correct question is:

- "Can required desktop artifacts be supplied without permanent dependence on repo-head LFS?"

Current answer:

- architecture removal: no
- phased LFS reduction with anti-fragile supply: yes, but only with cache, mirror, validation, and offline seed support
