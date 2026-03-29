# 操作指南：发布文档到 GitHub Pages 并回滚

本指南用于将文档发布链路切换到 GitHub Pages project site，并固化回滚流程。

## 目标发布路线

- 主域名：`https://jacobinwwey.github.io/`
- Project site 路径（当前默认）：`/NoteConnection/`
- 完整文档地址（默认）：`https://jacobinwwey.github.io/NoteConnection/`

## 标准发布流程

1. 将文档相关改动推送到 `main`/`master`。
2. 工作流 `Docs GitHub Pages Publish` 自动触发。
3. 工作流执行 Diataxis 映射校验、MkDocs 构建、GitHub Pages 部署。

工作流文件：

- `.github/workflows/docs-github-pages-publish.yml`

## 手动发布与回滚

当你需要可控发布/回滚时，使用 `workflow_dispatch`：

1. 打开工作流 `Docs GitHub Pages Publish`。
2. 将 `git_ref` 设置为目标分支/标签/提交（回滚时填写稳定 tag/commit）。
3. 可选覆盖：
   - `site_url`
   - `base_path`
4. 执行工作流并验证最终页面地址。

## 环境变量化的 MkDocs Base

MkDocs 地址行为已改为环境变量可切换：

- `MKDOCS_SITE_URL`（默认：`https://jacobinwwey.github.io/NoteConnection/`）
- `MKDOCS_BASE_PATH`（默认：`/NoteConnection/`）
- `MKDOCS_DOCS_HOST`（默认：`https://jacobinwwey.github.io/`）

配置位置：

- `mkdocs.yml`
- `.github/workflows/docs-github-pages-publish.yml`

## 先观察再决定自定义域名

建议顺序：

1. 先在 GitHub Pages project site 路线运行。
2. 观察至少一轮实际使用与外链稳定性。
3. 再决定是否绑定自定义域名。

## 权威详细来源

- [docs/zh/sharelife_community_release_and_rollback.md](../../../zh/sharelife_community_release_and_rollback.md)
