# Reference: Interfaces and Runtime Contracts

This reference tracks canonical API/runtime contracts.

## Primary Contract Documents

- [docs/en/Interface Document.md](../../../en/Interface%20Document.md)
- [docs/en/User_Manual.md](../../../en/User_Manual.md)

## Focused Integration References

- [Godot + NoteMD + Markdown Interfaces](./godot-notemd-markdown-interfaces.md)
- [Godot + NoteMD + Markdown Workflows](../how-to/godot-notemd-markdown-workflows.md)

## Key Runtime Contract Points (v1.6.0)

- Frontend runtime hydration invoke contracts:
  - `invoke('get_runtime_capabilities')`
  - `invoke('get_sidecar_runtime_config')`
- Rust sidecar runtime config command:
  - `get_sidecar_runtime_config`
- Rust app runtime config command:
  - `get_app_runtime_config`
- Runtime bridge readiness sequencing via `whenReady()`.

## Mermaid Canonical Baseline (Obsidian)

- Standard compatible format: fenced code block using ` ```mermaid` (opening line) and ` ``` ` (closing line).
- Godot runtime rendering remains PNG-first; Mermaid renderer preference should allow fallback (`auto`) to avoid bridge-only hard failures.
- Detailed field and route contracts:
  - [Godot + NoteMD + Markdown Interfaces](./godot-notemd-markdown-interfaces.md)

## app_config Runtime Contract Hook

- Frontend app-config hydration command:
  - `invoke('get_app_runtime_config')`
- Hydrated projection:
  - `window.__NC_APP_CONFIG.language`
  - `window.__NC_APP_CONFIG.multiWindow.*`
- Detailed schema reference:
  - [app_config.toml Schema](./app-config-schema.md)

## Policy Gate Families

- PathBridge strict schema
- Storage provider contracts
- Mobile runtime boundary contracts
- SBOM + attestation policy contracts
- Sidecar signature and privacy manifest contracts
