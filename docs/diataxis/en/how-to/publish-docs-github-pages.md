# How-To: Publish and Maintain Docs on GitHub Pages

Use this guide for day-to-day docs delivery, rollback, and local docs maintenance.

## 1) Deployment Targets

- Public host: `https://jacobinwwey.github.io/`
- Project base path: `/NoteConnection/`
- Canonical docs URL: `https://jacobinwwey.github.io/NoteConnection/`

## 2) Pipeline Topology

## Docs validation on PR/main

- Workflow: `.github/workflows/docs-diataxis-site.yml`
- Purpose:
  - run Diataxis mapping check (`npm run docs:diataxis:check`)
  - run MkDocs build (`mkdocs build --config-file mkdocs.yml`)

## Docs publish to `gh-pages`

- Workflow: `.github/workflows/docs-github-pages-publish.yml`
- Auto trigger:
  - `push` to `main`/`master`
  - only when selected docs/runtime files change (`docs/**`, `mkdocs.yml`, docs requirements/scripts, workflow file, and package files)
- Manual trigger:
  - `workflow_dispatch` with optional `git_ref`, `site_url`, `base_path`

## 3) Required Local Preflight

Run this before pushing docs changes:

```bash
npm run docs:diataxis:check
npm run docs:site:build
```

Expected result:

- Diataxis check prints `PASS`.
- MkDocs build exits `0`.
- Informational warnings about pages not in nav are acceptable unless you intentionally require full-nav indexing.

## 4) Local Docs Maintenance Mode

For local review while iterating docs:

```bash
MKDOCS_SITE_URL=http://127.0.0.1:18000/ \
MKDOCS_BASE_PATH=/ \
MKDOCS_DOCS_HOST=http://127.0.0.1:18000 \
npm run docs:site:serve -- --dev-addr 127.0.0.1:18000
```

Why this matters:

- it avoids production base-path assumptions during local preview,
- keeps local links stable when testing newly added pages and nav entries.

## 5) Standard Publish Flow (Mainline)

1. Merge docs changes to `main`.
2. Wait for `Docs GitHub Pages Publish` workflow completion.
3. Verify:
  - workflow `verify-diataxis-map` job passed,
  - workflow `build-site` job passed,
  - `gh-pages` deployment commit is present,
  - public URL returns updated content.

## 6) Manual Publish from Non-Main Branch

Use when you need preview deployment from a feature branch:

```bash
gh workflow run "Docs GitHub Pages Publish" \
  --ref <branch> \
  -f git_ref=<branch>
```

Then inspect run status:

```bash
gh run list --workflow "Docs GitHub Pages Publish" --limit 5
gh run watch <run_id> --exit-status
```

## 7) Rollback Procedure

Use manual dispatch and point `git_ref` to a known-good tag/commit:

```bash
gh workflow run "Docs GitHub Pages Publish" \
  --ref main \
  -f git_ref=<stable_tag_or_commit>
```

Post-rollback verification:

1. workflow run is `success`,
2. public docs URL serves the expected previous content,
3. no broken nav path under the configured base path.

## 8) Common Failure Modes and Fixes

## Diataxis mapping failure

- Symptom: `docs:diataxis:check` fails.
- Fix:
  - update `docs/diataxis-map.json`,
  - ensure both EN and ZH diataxis page paths exist,
  - ensure canonical references exist.

## MkDocs build failure

- Symptom: build exits non-zero.
- Fix:
  - install deps from `docs/requirements-mkdocs.txt`,
  - check invalid markdown links and YAML frontmatter formatting,
  - verify new pages are reachable from intended nav entries.

## GitHub Pages not enabled

- Symptom: deploy job passes but public URL is still `404`.
- Fix:
  - configure repository Pages settings to deploy from `gh-pages` branch.

## 9) Operational Links

- [Docs Hub](../../../index.md)
- [Development Progress Dashboard](../explanation/development-progress-dashboard.md)
- [Release and Governance Reference](../reference/release-and-governance.md)
- [Detailed docs release runbook](../../../en/docs_release_and_rollback.md)
