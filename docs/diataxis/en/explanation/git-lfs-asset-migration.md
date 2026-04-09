# Explanation: Git LFS Asset Migration

This page explains why NoteConnection should move large generated graph payloads and sidecar binaries out of Git LFS, and how that migration relates to the current runtime architecture.

## Why This Migration Exists

The repository currently carries two classes of large LFS-backed assets:

- generated graph payloads such as `data.js` and `graph_data.json`
- sidecar binaries under `src-tauri/bin/`

That model creates two problems:

- Git LFS bandwidth is consumed by repository-level fetch/clone traffic even though the runtime already supports generating or materializing most of these assets elsewhere.
- The repository is mixing source-of-truth code with heavyweight delivery artifacts that are better owned by runtime generation, local bootstrap, or release packaging.

## Why The Timing Is Right

The current codebase already contains most of the migration foundation:

- runtime graph assets are written into `runtime_data`
- startup logic already supports mini / first-run mode when prebundled graph payloads are absent
- release automation already builds with `lfs: false` and downloads platform Godot binaries per runner

The first contract-cleanup slice has already landed:

- default source builds now use the runtime-first asset path
- explicit prebundled graph builds moved behind opt-in `*:full` scripts
- pkg packaging no longer assumes `data.js` / `graph_data.json` are bundled assets
- `copy-assets.js` now skips Git LFS pointer placeholders in `lfs: false` checkouts
- the repository head no longer carries `src/frontend/data.js` or `src/frontend/graph_data.json`
- `verify-lfs-asset-policy.js` now blocks new protected LFS drift without forcing an immediate CI workflow redesign
- the dead `node-x86_64-pc-windows-msvc.exe` LFS residue was removed from the repository head

The remaining work is mostly:

- remove stale packaging assumptions
- strengthen local sidecar bootstrap

## Mobile Revalidation

The current migration explanation also needs one explicit mobile clarification:

- the latest published Android artifact (`v1.7.0` `app-universal-release-unsigned.apk`) appears to ship without bundled `data.js`, `graph_data.json`, target cache variants, or `Knowledge_Base`
- that APK is produced by the Tauri Android release workflow, not by the older Capacitor packaging path
- this does not mean mobile runtime lost local build support
- Capacitor native runtime can build graph payloads locally through Filesystem APIs
- Tauri Android runtime can build graph payloads locally through `build_graph_runtime` and write them into `runtime_data`

So the migration should not be evaluated as "remove bundled graph payloads, therefore mobile breaks". The more accurate reading is:

- mobile packaging is already moving away from shipping prebuilt graph cache files
- mobile runtime capability now depends more on runtime content access and build constraints than on repository-bundled graph payloads

## What Changes And What Does Not

The migration is intentionally staged:

- graph payloads move out of the repository default delivery path first
- sidecar binaries move out of the repository second
- Git history cleanup happens only after runtime independence is proven

This sequence is designed to avoid breaking current users. The highest-risk surface is local development/bootstrap, not installed releases.

## Canonical Explanation Sources

- [docs/en/lfs_asset_migration_plan.md](../../../en/lfs_asset_migration_plan.md)
- [docs/en/multi_platform_build_flow_audit.md](../../../en/multi_platform_build_flow_audit.md)
- [Sidecar Supply Feasibility](./sidecar-supply-feasibility.md)
- [docs/en/tauri_brainstorming.md](../../../en/tauri_brainstorming.md)
- [docs/en/electron_migration_analysis.md](../../../en/electron_migration_analysis.md)
