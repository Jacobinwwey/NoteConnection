# CI Test Status

Tracking progress toward all-green CI. Inspired by paseo's CI_STATUS.md.

## 2026-06-10 Knowledge Workspace and DAG Alignment Sync

- Current branch state has been re-audited against the earlier lightweight-RAG, agent-workspace, and mainline architecture plans.
- The source-of-truth reconciliation note is now `docs/solutions/knowledge-workspace-dag-alignment-2026-06-10.md`.
- Code-backed current-state confirmations for this slice:
  - structured grounded conversation with additive compatibility,
  - grouped knowledge points,
  - durable `flashcard_batch` / `knowledge_run` workflow artifacts,
  - workflow-artifact review follow-up runtime path,
  - graph-focus source rendering with matched-span highlighting.
- Local verification executed for this slice:
  - `npm.cmd exec -- tsc --noEmit`
  - `node --check src/frontend/agent_workspace.js`
  - `node --check src/frontend/workspace_panes.js`
  - `npm.cmd exec -- jest src/learning/conversationComposer.test.ts src/learning/KnowledgeLearningPlatform.test.ts src/learning/KnowledgeLearningPlatform.persistence.test.ts src/learning/KnowledgeLearningPlatform.program-f.test.ts src/agent_workspace.frontend.test.ts src/knowledge.api.contract.test.ts src/routes/registry.contract.test.ts src/pathbridge.handshake.contract.test.ts src/server.port.fallback.contract.test.ts src/workflows/WorkflowArtifactStore.test.ts --runInBand --no-cache`
- Remaining architecture gaps from this slice are product-surface and answer-planning gaps, not missing substrate:
  - contract the visible answer area toward a single targeted answer,
  - converge knowledge-hit interaction on a right-pane-first model,
  - add graph-conditioned context assembly between retrieval and answer synthesis.

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
