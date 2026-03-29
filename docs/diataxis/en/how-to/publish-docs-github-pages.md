# How-To: Publish Docs to GitHub Pages and Roll Back

Use this guide to operationalize the docs delivery pipeline on GitHub Pages project site.

## Target Route

- Host: `https://jacobinwwey.github.io/`
- Project site path (current default): `/NoteConnection/`
- Full docs URL (default): `https://jacobinwwey.github.io/NoteConnection/`

## Standard Publish Flow

1. Push docs-related changes to `main`/`master`.
2. Workflow `Docs GitHub Pages Publish` runs automatically.
3. The workflow validates Diataxis mapping, builds MkDocs, and deploys artifact to GitHub Pages.

Workflow file:

- `.github/workflows/docs-github-pages-publish.yml`

## Manual Publish and Rollback

Use `workflow_dispatch` when you need controlled publish/rollback:

1. Open workflow `Docs GitHub Pages Publish`.
2. Set `git_ref` to the target branch/tag/commit (for rollback, set to a stable tag/commit).
3. Optionally override:
   - `site_url`
   - `base_path`
4. Run workflow and verify the resulting pages URL.

## Environment-Driven MkDocs Base

MkDocs URL behavior is now switchable by environment variables:

- `MKDOCS_SITE_URL` (default: `https://jacobinwwey.github.io/NoteConnection/`)
- `MKDOCS_BASE_PATH` (default: `/NoteConnection/`)
- `MKDOCS_DOCS_HOST` (default: `https://jacobinwwey.github.io/`)

Configured in:

- `mkdocs.yml`
- `.github/workflows/docs-github-pages-publish.yml`

## Observe Before Custom Domain Binding

Recommended sequence:

1. Run on GitHub Pages project site first.
2. Observe one release cycle and verify external links.
3. Decide later whether to bind a custom domain.

## Canonical Detailed Source

- [docs/en/docs_release_and_rollback.md](../../../en/docs_release_and_rollback.md)
