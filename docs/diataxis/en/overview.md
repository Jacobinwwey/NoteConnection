# Diataxis Overview (EN)

This documentation system is organized by Diataxis:

- `Tutorials`: step-by-step learning for newcomers.
- `How-To Guides`: task-oriented operational instructions.
- `Reference`: authoritative contracts, interfaces, and policies.
- `Explanation`: architecture rationale, tradeoffs, and migration context.

## Governance Mechanism

- Mapping source of truth: [`docs/diataxis-map.json`](../../diataxis-map.json)
- Validation script: `node scripts/verify-diataxis-map.js`
- Site config: `mkdocs.yml` (repository root)
- Python dependencies: [`docs/requirements-mkdocs.txt`](../../requirements-mkdocs.txt)

## Typical Commands

```bash
npm run docs:diataxis:check
mkdocs serve --config-file mkdocs.yml
mkdocs build --config-file mkdocs.yml
```

## Canonical Source Documents

- Product overview: [docs/en/README.md](../../en/README.md)
- Interface contracts: [docs/en/Interface Document.md](../../en/Interface%20Document.md)
- User manual: [docs/en/User_Manual.md](../../en/User_Manual.md)
- Release compare report: [docs/en/release_v1.6.0_report.md](../../en/release_v1.6.0_report.md)
