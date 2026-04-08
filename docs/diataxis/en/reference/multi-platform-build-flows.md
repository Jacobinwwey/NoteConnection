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

## Use This Reference When

- deciding whether a migration item is safe across desktop, mobile, publish, and release surfaces
- checking whether a build command is runtime-first or explicit full-mode
- verifying whether a platform still depends on repo-head LFS assets

## Related Docs

- [Git LFS Asset Migration](../explanation/git-lfs-asset-migration.md)
- [Bootstrap Godot Sidecar](../how-to/bootstrap-godot-sidecar.md)
- [Release and Governance](release-and-governance.md)
