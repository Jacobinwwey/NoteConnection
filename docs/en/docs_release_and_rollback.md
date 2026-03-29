# Docs Publish and Rollback (GitHub Pages)

This runbook standardizes the full docs delivery flow for NoteConnection from MkDocs build to GitHub Pages deployment, including rollback and 404 troubleshooting.

## Scope

- Repository: `NoteConnection`
- Docs stack: `MkDocs (Material)`
- Delivery channel: GitHub Pages project site (`gh-pages` branch)
- Public URL: `https://jacobinwwey.github.io/NoteConnection/`

## One-Time Bootstrap (Required)

If `https://jacobinwwey.github.io/NoteConnection/` returns `404` even when CI is green, Pages is usually not enabled yet.

1. Enable Pages source once:
   - GitHub UI: `Settings -> Pages`
   - Build and deployment:
     - Source: `Deploy from a branch`
     - Branch: `gh-pages`
     - Folder: `/ (root)`
2. Optional CLI bootstrap (maintainer):

```bash
gh api -X POST repos/Jacobinwwey/NoteConnection/pages \
  -f source[branch]=gh-pages \
  -f source[path]=/
```

3. Verify:

```bash
gh api repos/Jacobinwwey/NoteConnection/pages
curl -I https://jacobinwwey.github.io/NoteConnection/
```

Expected status: `built` and HTTP `200`.

## CI Publish Pipeline

Workflow file:

- `.github/workflows/docs-github-pages-publish.yml`

Behavior:

- Auto-trigger on `push` to `main/master` when docs-related files change.
- Manual trigger via `workflow_dispatch` supports:
  - `git_ref` (branch/tag/commit for rollback publish)
  - `site_url` (optional override)
  - `base_path` (optional override)

## Local Validation Before Publish

```bash
npm run docs:diataxis:check
npm run docs:site:build
```

Build output: `build/mkdocs-site`.

## Rollback Procedure

### Method A: CI rollback (recommended)

1. Open `Docs GitHub Pages Publish` workflow.
2. Click `Run workflow`.
3. Set `git_ref` to a stable tag/commit (for example `v1.6.6`).
4. Keep `site_url` and `base_path` aligned with production.
5. Run workflow and validate the site URL.

### Method B: Local rollback verification

```bash
git checkout <stable-tag-or-commit>
npm ci
npm run docs:diataxis:check
npm run docs:site:build
```

Then run Method A with the same `git_ref`.

## 404 Troubleshooting Checklist

1. Check workflow result:
   - `Docs GitHub Pages Publish` must be green.
2. Check `gh-pages` branch exists and contains `index.html`.
3. Check Pages API status:
   - `gh api repos/Jacobinwwey/NoteConnection/pages`
4. If API returns `404 Not Found`:
   - Pages is not enabled for the repo yet. Enable with bootstrap step above.
5. If API is `built` but page still fails:
   - Wait 1-5 minutes for CDN propagation and retry with cache-disabled browser.

## Operational Guardrails

- Keep `docs/diataxis-map.json`, `mkdocs.yml`, and workflow config in sync.
- Treat docs publish as a release artifact with auditable metadata (tag, URL, timestamp).
- Always keep one known-good rollback tag ready before major docs updates.
