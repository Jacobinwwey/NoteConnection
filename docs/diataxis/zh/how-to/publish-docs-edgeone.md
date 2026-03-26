# 操作指南：发布文档到 EdgeOne 与回滚

本指南用于固化文档交付流程：

1. 本地一键发布
2. GitHub Actions 自动发布
3. Sharelife 社区界面发布与回滚

## 本地一键发布

```bash
npm run docs:edgeone:publish
```

快速发布（跳过校验/构建）：

```bash
npm run docs:edgeone:publish:quick
```

## GitHub Actions 自动发布

工作流：

- `.github/workflows/docs-edgeone-publish.yml`

必需 Secret：

- `EDGEONE_PAGES_API_TOKEN`

建议 Variable/Secret：

- `EDGEONE_PAGES_PROJECT_NAME`

手动回滚部署：

1. 在 GitHub Actions 中运行 `Docs EdgeOne Publish`（`workflow_dispatch`）。
2. 将 `source_ref` 设置为稳定 tag/commit。
3. 发布到同一个目标项目和环境。

## Sharelife 社区界面发布与回滚

1. 先完成文档发布。
2. 更新 Sharelife 社区界面的“最新文档”入口与版本说明。
3. 保留上一稳定版本元数据，确保可快速回滚。

## 权威详细来源

- [docs/zh/sharelife_community_release_and_rollback.md](../../../zh/sharelife_community_release_and_rollback.md)
