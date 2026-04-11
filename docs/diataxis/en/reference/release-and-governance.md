# Reference: Release and Governance

This page is the governance index for release pipelines, docs delivery, and learning-platform quality controls.

## 1) Release Baseline and Scope

- Historical release comparison reference:
  - `v1.3.0..v1.6.0`
  - `107` commits, `301` files changed
- Current delivery context:
  - post-`v1.7.0` evolution baseline with learning-platform contracts and runtime runbook endpoints

## 2) Canonical Release and Planning Documents

- [docs/en/release_v1.6.0_report.md](../../../en/release_v1.6.0_report.md)
- [docs/release_notes_v1.6.0.md](../../../release_notes_v1.6.0.md)
- [docs/release_notes_v1.6.7.md](../../../release_notes_v1.6.7.md)
- [docs/release_notes_v1.7.0.md](../../../release_notes_v1.7.0.md)
- [Knowledge Mastery Evolution Roadmap](../explanation/knowledge-mastery-evolution-roadmap.md)
- [Development Progress Dashboard](../explanation/development-progress-dashboard.md)

## 3) CI/CD Governance Workflows

- Docs validation:
  - `.github/workflows/docs-diataxis-site.yml`
- Docs publish:
  - `.github/workflows/docs-github-pages-publish.yml`
- Desktop/mobile release build:
  - `.github/workflows/release-desktop-multi-os.yml`
- Migration safety gates:
  - `.github/workflows/migration-gates.yml`
- Operational readiness:
  - `.github/workflows/fixrisk-operational-readiness.yml`
- npm publish policy gates:
  - `.github/workflows/npm-publish.yml`
- Mobile contract checks:
  - `.github/workflows/mobile-e2e-detox-contracts.yml`

## 4) Learning Platform Governance Chain

## Contract governance

- Interface layer:
  - `src/learning/api.ts`
  - `src/learning/types.ts`
- Route and normalization layer:
  - `src/server.ts`
- Contract regression safety net:
  - `src/knowledge.api.contract.test.ts`

## Runtime governance

- Runtime capability matrix endpoint:
  - `GET /api/knowledge/runtime-capability-matrix`
- Runtime runbook endpoints:
  - `GET /api/knowledge/runtime-capability-runbook*`
  - `POST /api/knowledge/runtime-capability-runbook/remediation-event`
- Request diagnostics:
  - `GET /api/runtime-request-trace`

## Quality governance

- Learning quality endpoints:
  - `POST /api/knowledge/quality/snapshot`
  - `GET /api/knowledge/quality/history`
  - `GET /api/knowledge/quality/trend`
  - `GET /api/knowledge/quality/thresholds`
- Session strategy quality endpoints:
  - `POST /api/knowledge/session/plan/evaluate`
  - `GET /api/knowledge/session/plan/quality/history`
  - `GET /api/knowledge/session/plan/quality/trend`
  - `GET /api/knowledge/session/plan/quality/thresholds/runtime`

## 5) Docs Governance Controls

- Mapping source of truth:
  - [docs/diataxis-map.json](../../../diataxis-map.json)
- Mapping gate:
  - `npm run docs:diataxis:check`
- Site build gate:
  - `npm run docs:site:build`
- Local iterative docs maintenance:
  - `npm run docs:site:serve`
- Deploy gate:
  - GitHub Actions workflow `Docs GitHub Pages Publish`

## 6) Local Release/Docs Verification Commands

```bash
# docs governance
npm run docs:diataxis:check
npm run docs:site:build

# API contract governance
npm test -- src/knowledge.api.contract.test.ts --runInBand

# broader migration and policy gates
npm run test:migration
```

## 7) Risk Posture (Current)

- Stable:
  - docs build and mapping governance
  - API contract surface coverage
  - runtime runbook and diagnostics endpoints
- Needs continued hardening:
  - graphdb backend depth (current graphdb mode still file-adapter backed)
  - independent vector retrieval backend integration
  - stricter promotion from trend observations to hard release quality gates

## 8) Related Runbooks

- [Publish Docs to GitHub Pages](../how-to/publish-docs-github-pages.md)
- [Detailed docs release and rollback runbook](../../../en/docs_release_and_rollback.md)
