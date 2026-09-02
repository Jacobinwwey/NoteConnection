# Reference: Multi-Platform Build Flows

This page is the Diataxis reference entry for the current multi-platform build matrix that underpins the Git LFS migration.

## Canonical Source

- [docs/en/multi_platform_build_flow_audit.md](../../../en/multi_platform_build_flow_audit.md)

## What This Reference Covers

- source web build and explicit full-graph build behavior
- desktop Tauri dev/bundle flow and sidecar ownership
- Android Capacitor packaging flow
- Android Tauri native runtime/build flow
- GitHub Release, npm publish, and docs-site delivery pipelines

## Current High-Signal Conclusions

- The default source build contract is runtime-first.
- Explicit full-mode remains supported, and Tauri full bundles now preserve that mode through `beforeBuildCommand`.
- Desktop bundles still treat sidecar binaries as a separate bootstrap concern.
- Mobile packaging and mobile runtime capability must be evaluated separately.
- Docs and npm publish pipelines are already compatible with the current no-new-LFS direction.
- Release smoke on 2026-04-08 already proved the workflow can cold-create and seed the project-controlled `godot-mirror-v4.3-stable` tag before desktop bundle jobs run.
- The current release workflow now pins the mirrored Windows, Linux, and macOS Godot archives with fixed SHA256 values before use.
- The same release workflow now exposes `allow_godot_upstream_fallback` so mirror-only smoke runs can disable upstream fallback without changing the default release path.
- A non-blocking release-governance risk remains: GitHub Actions currently warns that `actions/upload-artifact@v4` and `softprops/action-gh-release@v2` are still Node 20-targeted.

## Use This Reference When

- deciding whether a migration item is safe across desktop, mobile, publish, and release surfaces
- checking whether a build command is runtime-first or explicit full-mode
- verifying whether a platform still depends on repo-head LFS assets

## Related Docs

- [Git LFS Asset Migration](../explanation/git-lfs-asset-migration.md)
- [Bootstrap Godot Sidecar](../how-to/bootstrap-godot-sidecar.md)
- [Release and Governance](release-and-governance.md)

## Mobile Slim Contract (2026-08-17)

`mobile-slim` is now a real packaging profile, not only an export label.

- `npm run mobile:prepare:slim` builds the runtime-first frontend, stages only `dist/mobile-slim/frontend`, removes generated graph payloads, desktop-only Mermaid/GPU assets, SVG files, model files, and binary sidecars, then emits `dist/mobile-slim/mobile-slim-manifest.json`.
- The same staged directory is consumed by Capacitor through `NOTE_CONNECTION_MOBILE_WEB_DIR` and by Tauri Android through `src-tauri/tauri.android.conf.json`. Tauri Android no longer builds a Node sidecar on the slim path.
- The mobile runtime loads the local `graph_data.json` through the storage boundary and exposes bounded exact lookup, neighbor inspection, and directed shortest-path operations through `queryKnowledgeBaseExact()` and `findKnowledgePath()`. The analyzer retains projected node metadata, not document bodies.
- `mobile-slim` declares local ingest and exact query as available, remote inference as optional, SVG materialization as unsupported, a 25 MiB estimated compressed asset gate, and a 256 MiB low-memory RSS gate.
- The static verifier reports estimated ZIP-deflate bytes and fails on forbidden artifacts. RSS is `not-measured` until a device evidence JSON is supplied; a passing static gate is not a device acceptance claim.
- Godot Pathmode is an extended opt-in (`NOTE_CONNECTION_ANDROID_INCLUDE_GODOT_PATHMODE=1`). The default Android runner disables generated Godot bridge files, dependency declarations, and `path_mode` assets so stale generated scaffolds cannot silently inflate a slim build.

This slice intentionally does not claim mobile-local LLM parity or SQLite persistence. The current mobile projection is an exact in-memory index over a bounded local graph; SQLite-backed persistence and full agent conversation parity remain subsequent phases with separate contracts.

## Storage Provider Resolution (2026-09-02)

SQLite functionality remains enabled for desktop/server runtimes. The Node sidecar targets Node 22 and requests the built-in `node:sqlite` adapter by default. When that module is unavailable, the graph store keeps the existing file-backed snapshot fallback and reports `requestedProvider=sqlite`, `resolvedProvider=file`, and `fallbackReason=sqlite_runtime_unavailable`; it never labels the fallback as an embedded SQLite store.

Mobile packaging remains sidecar-free. Tauri Android and Capacitor resolve storage to the bounded `projection` provider (`graph_data.json` plus the exact analyzer), even if stale or manually supplied capability data claims SQLite. Their runtime contract reports `supports_sqlite=false`, `supports_projection=true`, and an explicit `native_sqlite_runtime_unavailable` reason. The projection schema and query semantics remain shared with desktop replay fixtures.

The frontend first consumes host capability data, then refreshes desktop resolution from `/api/knowledge/store-diagnostics` when a sidecar is available. This separates platform capability from the authoritative store resolution and keeps old `storageEngine` diagnostics backward-compatible. SQLite/WASM promotion on mobile remains gated by signed arm64 process-death, SAF, RSS, and package-size evidence.

## Sidecar Freshness (2026-09-03)

Host sidecar reuse is content-verified rather than timestamp-only. A successful `build-sidecar.js` run writes `.noteconnection-sidecar-build-manifest.json` under the ignored `src-tauri/bin` directory. `ensure-sidecar-ready.js` compares the manifest digest over `dist/src` and build inputs, verifies that the current host binary is listed, and rebuilds when the manifest is absent, stale, unreadable, or from another target. This protects packaged SQLite behavior from clock skew, copied artifacts, and stale LFS binaries without rebuilding on every startup when the inputs are unchanged.
