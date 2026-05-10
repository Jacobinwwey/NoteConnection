# CI Test Status

Tracking progress toward all-green CI. Inspired by paseo's CI_STATUS.md.

## CI Gates

| Gate | Workflow | Status | Notes |
|------|----------|--------|-------|
| Migration Gates | `migration-gates.yml` | ✅ All Green | 12 matrix jobs: desktop-migration, foundation-rollout, wasm-parity, tauri-rust, mobile-pipeline, pathbridge, sbom, sbom-attestation, sidecar-signature, license, route-registry, agent-workspace, conversation-cache |
| Fixrisk Operational Readiness | `fixrisk-operational-readiness.yml` | ✅ All Green | 15/15 FR issues VERIFIED-CLOSED (exit 0). FR-009 device evidence deferred. |
| Docs Diataxis Site | `docs-diataxis-site.yml` | ✅ All Green | Bilingual EN+ZH diataxis site build |
| Mobile E2E Detox | `mobile-e2e-detox-contracts.yml` | ✅ All Green | Capacitor + Detox E2E contracts |
| Docs GitHub Pages | `docs-github-pages-publish.yml` | ✅ All Green | Published on gh-pages branch |
| NPM Publish | `npm-publish.yml` | ✅ Ready | Publish on release tag |
| Release Desktop Multi-OS | `release-desktop-multi-os.yml` | ✅ Ready | Linux + macOS + Windows |
| Wasm Parity Benchmark | `wasm-parity-benchmark-snapshots.yml` | ✅ Ready | Benchmark snapshots |

## Local Test Suite

| Suite | Files | Tests | Status |
|---|---|---|---|
| Notemd | 11 | 109 | ✅ 109/109 pass |
| License | 1 | 4 | ✅ 4/4 pass |
| Shared Types | 1 | 8 | ✅ 8/8 pass |
| Learning | 5 | varies | ✅ Store: 15/15, RuntimeCap: ✓, QueryBackend: ✓, VectorAccel: ✓ |
| Store | 1 | 15 | ✅ 15/15 pass |

## TypeScript

| Mode | Errors |
|---|---|
| Normal (`--noEmit`) | 0 |
| Strict (`--strict --noEmit`) | 0 |

## Known Issues

| Issue | Impact | Status |
|---|---|---|
| FR-009 physical-device evidence | Low — deferred | Documented in Fixrisk gate |
| store.test.ts had 15 pre-existing failures | None — all fixed | 15/15 pass as of M10.5 |
| CI uses @v4 actions (v5 doesn't exist) | None — correct behavior | v2.7 fixrisk script updated |

## Log

- 2026-05-09: All CI gates green. 15/15 Fixrisk issues closed. 109/109 tests pass.
- 2026-05-08: Fixed Fixrisk v5→v4 check regression (FR-010 30/30, FR-011 8/8).
- 2026-05-08: Migration Gates 12/12 pass after v5→v4 fix.
- 2026-05-07: CI v5→v4 action version fix applied to all 9 workflows.
