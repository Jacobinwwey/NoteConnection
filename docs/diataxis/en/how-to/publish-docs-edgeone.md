# How-To: Publish Docs to EdgeOne and Roll Back

Use this guide to operationalize the docs delivery pipeline:

1. Local one-click deploy
2. GitHub Actions automatic deploy
3. Sharelife community UI release + rollback

## One-click local deploy

```bash
npm run docs:edgeone:publish
```

Quick deploy (skip verify/build):

```bash
npm run docs:edgeone:publish:quick
```

## GitHub Actions deploy

Workflow:

- `.github/workflows/docs-edgeone-publish.yml`

Required secret:

- `EDGEONE_PAGES_API_TOKEN`

Recommended variable/secret:

- `EDGEONE_PAGES_PROJECT_NAME`

Manual rollback deploy:

1. Run workflow `Docs EdgeOne Publish` via `workflow_dispatch`.
2. Set `source_ref` to a stable tag/commit.
3. Deploy to the same target project and environment.

## Sharelife community UI publication and rollback

1. Publish docs first.
2. Update Sharelife community UI "latest docs" entry and version note.
3. Keep previous stable version metadata for immediate rollback.

## Canonical detailed source

- [docs/en/sharelife_community_release_and_rollback.md](../../../en/sharelife_community_release_and_rollback.md)
