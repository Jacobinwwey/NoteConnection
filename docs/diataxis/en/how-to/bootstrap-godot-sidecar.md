# How-To: Bootstrap the Godot Sidecar Locally

Use this guide when `bin/godot` is no longer expected to come from the Git checkout and you need a reproducible local bootstrap path for Tauri desktop work.

## When You Need This

- `npm run tauri:dev`
- `npm run tauri:build`
- `npm run prepare:godot:bin`
- any local workflow that must materialize a host-specific `src-tauri/bin/godot-*`

## What The Bootstrap Now Does

`scripts/ensure-godot-sidecar.js` now resolves host Godot sidecars in this order:

1. existing valid `src-tauri/bin/godot-*`
2. explicit local override via `NOTE_CONNECTION_GODOT_EXE`
3. host search directories via `NOTE_CONNECTION_GODOT_SEARCH_DIRS`
4. host search heuristics (`Downloads`, common bin paths, macOS app bundles)
5. cached bootstrap artifact under `NOTE_CONNECTION_GODOT_CACHE_DIR`
6. pinned download via `NOTE_CONNECTION_GODOT_DOWNLOAD_URL`

The shared validation logic now also checks the host-specific Godot binary name, not only the Windows filename.

## Recommended Pinned Bootstrap

Set these environment variables before running `npm run prepare:godot:bin`:

```bash
export NOTE_CONNECTION_GODOT_DOWNLOAD_URL="https://<pinned-host-binary-url>"
export NOTE_CONNECTION_GODOT_DOWNLOAD_SHA256="<pinned-sha256>"
export NOTE_CONNECTION_GODOT_CACHE_DIR="$HOME/.cache/noteconnection/godot"
```

Then run:

```bash
npm run prepare:godot:bin
node scripts/validate-tauri-sidecars.js
```

## Manual Override Path

If you already have a host Godot binary:

```bash
export NOTE_CONNECTION_GODOT_EXE="/absolute/path/to/godot"
npm run prepare:godot:bin
```

Optional extra lookup roots:

```bash
export NOTE_CONNECTION_GODOT_SEARCH_DIRS="/opt/tools:/mnt/shared/godot"
```

## Cache Locations

- Linux/macOS default: `~/.cache/noteconnection/godot`
- Windows default: `%LOCALAPPDATA%\\NoteConnection\\cache\\godot`
- override: `NOTE_CONNECTION_GODOT_CACHE_DIR`

## Integrity Behavior

- If `NOTE_CONNECTION_GODOT_DOWNLOAD_SHA256` is set, downloaded or cached Godot binaries must match it.
- If the checksum does not match, bootstrap fails before the sidecar is copied into `src-tauri/bin`.
- For remote `http(s)` downloads, checksum pinning is strongly recommended.

## Enforcement Note

- `npm run prepare:godot:bin` is the bootstrap step, not the final sidecar gate.
- On Linux/macOS, a missing Godot binary can still warn and exit `0` unless `NOTE_CONNECTION_GODOT_REQUIRED=1` is set.
- Use `node scripts/validate-tauri-sidecars.js`, `npm run build:sidecar`, or `NOTE_CONNECTION_GODOT_REQUIRED=1` when you need fail-fast enforcement.

## Fresh Checkout Expectation

Local verification on the current Linux audit host produced this behavior on a raw repository checkout:

- `npm run prepare:godot:bin` warned and exited `0` because no host Godot binary was available yet.
- `npm run verify:tauri:bin` failed because `server-x86_64-unknown-linux-gnu` was still only a Git LFS pointer placeholder and `markdown-worker-x86_64-unknown-linux-gnu` / `godot-x86_64-unknown-linux-gnu` had not been materialized.

Treat that as expected current-state behavior, not as evidence that the graph-payload cleanup regressed Tauri packaging. On a fresh checkout, continue with host sidecar materialization such as `npm run build:sidecar` plus a usable local or pinned-download Godot binary.

## CI / Release Impact

- This migration slice did require scoped GitHub Actions changes, but not a wholesale CI redesign.
- `.github/workflows/release-desktop-multi-os.yml` now maintains a dedicated `godot-mirror-v4.3-stable` release, downloads Godot mirror-first, and keeps upstream fallback enabled only as the default transitional mode.
- The same workflow now also pins the three desktop Godot archives with fixed SHA256 values before mirror upload or runner-side extraction continues.
- The workflow can now be dispatched with `allow_godot_upstream_fallback=false` when you want a strict mirror-only smoke run without redesigning the release jobs.
- The no-checkout mirror job also needed explicit `gh --repo "$GITHUB_REPOSITORY"` binding and `--target "$GITHUB_SHA"` to behave correctly in live release smoke runs.
- The workflow shape is still the same high-level design: ensure release record, ensure mirror assets, then run per-platform desktop and Android build jobs.
- This guide remains primarily for local developer bootstrap and future repository/LFS decoupling work, but it now intentionally shares the same mirror-capable supply model used by release CI.

## Canonical Sources

- [docs/en/lfs_asset_migration_plan.md](../../../en/lfs_asset_migration_plan.md)
- Repository implementation sources: `scripts/ensure-godot-sidecar.js`, `scripts/tauri-sidecar-utils.js`, `scripts/validate-tauri-sidecars.js`
