# Sharelife Community Docs Publish and Rollback (GitHub Pages)

This document standardizes the full flow from MkDocs build to GitHub Pages deployment, and defines rollback operations for the Sharelife community UI.

## Scope

- Repository: `NoteConnection`
- Docs stack: `MkDocs (Material)`
- Delivery channel: `GitHub Pages` project site
- Community-facing consumption: Sharelife repository/community UI links to the published docs portal

## Target URL

- Host: `https://jacobinwwey.github.io/`
- Project site path (default): `/NoteConnection/`
- Full docs URL (default): `https://jacobinwwey.github.io/NoteConnection/`

## Prerequisites

1. GitHub Pages is enabled for this repository (Actions source).
2. Workflow permissions allow `pages:write` and `id-token:write`.
3. Docs dependencies are healthy:
   - Node.js + npm
   - Python dependencies: `pip install -r docs/requirements-mkdocs.txt`

## Publish Pipeline (CI)

Workflow file:

- `.github/workflows/docs-github-pages-publish.yml`

Behavior:

- Auto-trigger on `push` to `main/master` when docs-related files change.
- Manual trigger via `workflow_dispatch` supports:
  - `git_ref` (branch/tag/commit, can be used for rollback deployment)
  - `site_url` (optional override)
  - `base_path` (optional override)

## Local Build Validation

```bash
npm run docs:diataxis:check
npm run docs:site:build
```

This validates mapping governance and builds static site output under `build/mkdocs-site`.

## Sharelife Community UI Publish Process

Use this checklist for each docs release:

1. Deploy docs via CI workflow.
2. Record release metadata:
   - source ref/tag (for example `v1.6.6`)
   - docs portal URL
   - deployment timestamp (UTC)
3. Update Sharelife community UI content:
   - "Latest docs" link
   - version label / announcement text
   - rollback reference (previous stable tag and URL)
4. Verify from user perspective:
   - desktop + mobile openability
   - key pages load (`first-run`, `configure-app-config`, release/reference pages)

## Rollback Runbook

## Method A: CI rollback (recommended)

1. Open GitHub Actions workflow `Docs GitHub Pages Publish`.
2. Run workflow (`workflow_dispatch`).
3. Set `git_ref` to a stable tag/commit (for example `v1.6.5`).
4. Keep `site_url` and `base_path` consistent with production route.
5. Confirm deployment, then update Sharelife community UI announcement to indicate rollback version.

## Method B: Local rollback verification

```bash
git checkout <stable-tag-or-commit>
npm ci
npm run docs:diataxis:check
npm run docs:site:build
```

After local verification, execute CI rollback with the same `git_ref`.

## Rollback verification

1. Open docs portal and confirm rollback content is active.
2. Ensure Sharelife community UI link points to expected portal/version note.
3. Publish a brief incident note:
   - rollback reason
   - rollback source ref
   - ETA for forward fix

## Operational Guardrails

- Always keep rollback target documented before a new docs deploy.
- Keep `docs/diataxis-map.json` and `mkdocs.yml` in sync before publishing.
- Treat docs publish as a release artifact; keep an auditable trail in release notes/changelog.
- Run one full observation cycle on GitHub Pages route before deciding custom domain binding.
