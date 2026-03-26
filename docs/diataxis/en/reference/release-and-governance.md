# Reference: Release and Governance

## Release Compare Baseline

- Compare range: `v1.3.0..v1.6.0`
- Commits: `107`
- Files changed: `301`
- Churn: `+125,957 / -10,083`

## Canonical Release Documents

- [docs/en/release_v1.6.0_report.md](../../../en/release_v1.6.0_report.md)
- [docs/release_notes_v1.6.0.md](../../../release_notes_v1.6.0.md)

## Governance Controls

- FixRisk operational readiness workflow
- Migration gates workflow
- Mobile e2e detox contracts workflow
- NPM publish policy gates (SBOM + attestation)
- Sidecar signature and privacy policy checks
- Docs deploy workflow:
  - `.github/workflows/docs-edgeone-publish.yml`
- Docs release and rollback runbook:
  - [`docs/en/sharelife_community_release_and_rollback.md`](../../../en/sharelife_community_release_and_rollback.md)

## Docs Governance Controls

- Diataxis mapping source:
  - [docs/diataxis-map.json](../../../diataxis-map.json)
- Mapping verifier:
  - `npm run docs:diataxis:check`
- One-click docs publish:
  - `npm run docs:edgeone:publish`
