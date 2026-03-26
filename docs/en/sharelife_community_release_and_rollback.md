# Sharelife Community Docs Publish and Rollback (EdgeOne CLI)

This document standardizes the full flow from local MkDocs build to EdgeOne Pages deployment, and defines rollback operations for the Sharelife community UI.

## Scope

- Repository: `NoteConnection`
- Docs stack: `MkDocs (Material)`
- Delivery channel: `EdgeOne Pages` via `edgeone` CLI
- Community-facing consumption: Sharelife repository/community UI links to the published docs portal

## Prerequisites

1. Node.js and npm are installed.
2. Python dependencies for MkDocs are installed:
   - `pip install -r docs/requirements-mkdocs.txt`
3. EdgeOne CLI is available:
   - `npm install -g edgeone@1.3.5`
4. One of the following auth methods is ready:
   - Environment variable token: `EDGEONE_PAGES_API_TOKEN`
   - Existing local `edgeone` login session
5. Target project name is known:
   - `EDGEONE_PAGES_PROJECT_NAME` (for example: `noteconnection-docs`)

## One-Click Local Publish

## Standard publish (verify + build + deploy)

```bash
npm run docs:edgeone:publish
```

This command executes:

1. `npm run docs:diataxis:check`
2. `npm run docs:site:build`
3. `edgeone pages deploy build/mkdocs-site -n <project> -e <env> -a <area>`

## Quick publish (skip verify/build, deploy only)

```bash
npm run docs:edgeone:publish:quick
```

Use only when the current `build/mkdocs-site` is already validated and fresh.

## Optional flags

```bash
node scripts/deploy-docs-edgeone.js \
  --name noteconnection-docs \
  --env production \
  --area global \
  --token <EDGEONE_PAGES_API_TOKEN>
```

Supported options:

- `--skip-verify`
- `--skip-build`
- `--dir <output-dir>`
- `--name <project-name>`
- `--token <api-token>`
- `--env production|preview`
- `--area global|overseas`

## GitHub Actions Auto Publish

Workflow file:

- `.github/workflows/docs-edgeone-publish.yml`

Behavior:

- Auto-trigger on `push` to `main/master` when docs-related files change.
- Manual trigger via `workflow_dispatch` supports:
  - `source_ref` (branch/tag/commit, can be used for rollback deployment)
  - `deploy_env`
  - `deploy_area`
  - `project_name`

Required repository secret:

- `EDGEONE_PAGES_API_TOKEN`

Recommended repository variable or secret:

- `EDGEONE_PAGES_PROJECT_NAME`

Optional repository variables:

- `EDGEONE_PAGES_ENV` (`production` by default)
- `EDGEONE_PAGES_AREA` (`global` by default)

## Sharelife Community UI Publish Process

Use this checklist for each docs release:

1. Deploy docs via local one-click command or CI workflow.
2. Record release metadata:
   - source ref/tag (for example `v1.6.5`)
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

1. Open GitHub Actions workflow `Docs EdgeOne Publish`.
2. Run workflow (`workflow_dispatch`).
3. Set `source_ref` to a stable tag/commit (for example `v1.6.4`).
4. Keep the same target project name/environment.
5. Confirm deployment, then update Sharelife community UI announcement to indicate rollback version.

## Method B: Local rollback

```bash
git checkout <stable-tag-or-commit>
npm ci
npm run docs:edgeone:publish
```

After deployment, restore your previous working branch.

## Rollback verification

1. Open docs portal and confirm rollback content is active.
2. Ensure Sharelife community UI link points to the expected portal/version note.
3. Publish a brief incident note:
   - rollback reason
   - rollback source ref
   - ETA for forward fix

## Operational Guardrails

- Always keep rollback target documented before a new docs deploy.
- Avoid force-pushing docs-only fixes directly to tags.
- Keep `docs/diataxis-map.json` and `mkdocs.yml` in sync before publishing.
- Treat docs publish as a release artifact; keep an auditable trail in release notes/changelog.
