# Reference: Interfaces and Runtime Contracts

This reference tracks canonical API/runtime contracts.

## Primary Contract Documents

- [docs/en/Interface Document.md](../../../en/Interface%20Document.md)
- [docs/en/User_Manual.md](../../../en/User_Manual.md)

## Key Runtime Contract Points (v1.6.0)

- Frontend runtime hydration invoke contracts:
  - `invoke('get_runtime_capabilities')`
  - `invoke('get_sidecar_runtime_config')`
- Rust sidecar runtime config command:
  - `get_sidecar_runtime_config`
- Runtime bridge readiness sequencing via `whenReady()`.

## Policy Gate Families

- PathBridge strict schema
- Storage provider contracts
- Mobile runtime boundary contracts
- SBOM + attestation policy contracts
- Sidecar signature and privacy manifest contracts
