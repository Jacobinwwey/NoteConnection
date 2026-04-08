# Explanation: Sidecar Supply Feasibility

This page explains which mirror/supply options are realistically feasible for NoteConnection's remaining desktop sidecar artifacts, and what each option costs in user friction and maintainer effort.

## The Key Constraint

The current desktop product line still depends on:

- `server-*`
- `godot-*`
- `markdown-worker-*`

So the decision is not "mirror or no mirror" in isolation.
The real question is:

- how can those artifacts be supplied without permanent dependence on repo-head Git LFS, and
- without moving too much fragility onto users or maintainers?

## What Current Code Already Supports

The existing bootstrap path is already provider-neutral for Godot supply:

- `scripts/tauri-sidecar-utils.js` accepts `NOTE_CONNECTION_GODOT_DOWNLOAD_URL`
- the same path also accepts `NOTE_CONNECTION_GODOT_DOWNLOAD_SHA256`
- downloads are cached via `NOTE_CONNECTION_GODOT_CACHE_DIR`
- the implementation accepts generic `http`, `https`, and `file` URLs
- local candidate paths and cache are checked before download

That means GitHub Releases, Cloudflare R2, Backblaze B2, and a self-hosted HTTPS mirror all fit the same bootstrap contract.
The current code does **not** require a provider-specific refactor before trying those sources.

Contract evidence:

- `scripts/tauri-sidecar-utils.js`
- `scripts/ensure-godot-sidecar.js`
- `src/godot.sidecar.bootstrap.contract.test.ts`
- `src/sidecar.supply.readiness.contract.test.ts`

## Feasibility Matrix

| Option | Extra infra fee | User barrier | Maintainer cost | Current code fit | Current gap | Verdict |
|---|---|---|---|---|---|---|
| Keep using Git LFS for desktop sidecars | Already incurring bandwidth/storage cost | Low | Low now, rising later | Already works | LFS bandwidth remains the bottleneck | Transitional only |
| GitHub Releases as first mirror | Usually lowest additional cost | Low if kept out of runtime and used only for bootstrap/release supply | Low | Strong | Current release workflow now seeds a dedicated Godot mirror tag, keeps fixed SHA256 archive pinning, and still retains upstream fallback | Best current fit |
| Generic object storage mirror (R2/B2) | Low to medium recurring cost | Low if hidden behind cache/bootstrap scripts | Medium | Strong | Needs upload/publish automation and secret management | Good second step |
| Direct third-party upstream download only | Low direct hosting cost | Medium to high | Medium | Already possible for Godot | Too network-sensitive; trust model diverges | Reject |
| Fully self-hosted mirror/CDN | Medium to high | Low for users | High | Compatible | Infra ownership becomes the real project | Reject for current stage |

## What This Means In Practice

### 1. GitHub Releases is technically feasible now, and the first CI slice is now in place

Why:

- the repo already creates and uploads GitHub Releases in `.github/workflows/release-desktop-multi-os.yml`
- bootstrap already accepts a pinned download URL and cache path
- this keeps the initial migration close to the current GitHub-centered maintenance model
- release CI now seeds the dedicated `godot-mirror-v4.3-stable` release tag before desktop bundle jobs run
- desktop bundle jobs now download mirror-first and keep upstream fallback as a transitional safety rail

What is still missing:

- eventual removal of upstream fallback once mirror behavior is proven stable
- controlled digest rotation and verification governance when the pinned Godot version changes

Cloud validation snapshot:

- smoke tags `smoke-lfs-mirror-first-20260408-002012` and `smoke-lfs-mirror-first-20260408-002917` exposed real cold-start issues in the mirror job, which is stronger evidence than mock-only confidence
- those runs drove targeted fixes in `.github/workflows/release-desktop-multi-os.yml` and `scripts/tauri-sidecar-utils.js`
- `smoke-lfs-mirror-first-20260408-003325` then cold-created and seeded `godot-mirror-v4.3-stable` with all three desktop Godot archives, and the full Windows/macOS/Linux/Android release matrix completed through the mirror-first path
- this first mirror step required no additional paid infra because GitHub Releases already sits on the existing project maintenance path

### 2. R2/B2 is also technically feasible now

Why:

- bootstrap does not care which HTTPS host serves the binary
- checksum pinning and cache reuse are already built into the current contract

What is still missing:

- object upload automation
- secret management
- lifecycle/version cleanup policy
- decision on whether GitHub Releases remains a fallback

### 3. Download-only replacement is the wrong optimization

This looks cheap, but it shifts cost into the wrong places:

- more bootstrap failure modes
- more regional network sensitivity
- more support burden when developers cannot materialize the required binary

So "download URL exists" is not enough to call a migration safe.

## Recommended Order

1. Keep `server-*` on the current temporary bridge until reproducible materialization is stronger.
2. Treat GitHub Releases as the preferred first mirror candidate for Godot because it fits the current project maintenance model best.
3. Add object storage only if real download reliability or regional access data shows GitHub alone is not enough.
4. Keep cache-first and offline-seed paths regardless of mirror choice.
5. Do not move any of this burden into app first-run or normal user runtime.

## Bottom Line

The technically feasible options are broader than "pay for mirror" versus "stay on LFS forever".

The current repo already supports a lower-risk path:

- first mirror candidate: GitHub Releases
- second-stage hardening: generic HTTPS object storage mirror
- non-negotiable safety rails: cache, checksum pinning, and offline seed
- non-blocking but real maintenance debt: release logs now warn that `actions/upload-artifact@v4` and `softprops/action-gh-release@v2` are still Node 20-targeted and currently rely on GitHub's forced Node 24 runtime

The wrong move would be to remove LFS and replace it with direct public-upstream download only.
