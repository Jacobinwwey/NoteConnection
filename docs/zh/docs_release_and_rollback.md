# 文档发布与回滚手册（GitHub Pages）

本文档用于固化 NoteConnection 文档从 MkDocs 构建到 GitHub Pages 发布的完整流程，并覆盖回滚与 404 故障排查。

## 适用范围

- 仓库：`NoteConnection`
- 文档栈：`MkDocs (Material)`
- 发布通道：GitHub Pages project site（`gh-pages` 分支）
- 对外地址：`https://jacobinwwey.github.io/NoteConnection/`

## 一次性初始化（必须）

若 CI 全绿但站点仍返回 `404`，通常是仓库尚未启用 Pages。

1. 在 GitHub 页面进行一次性设置：
   - `Settings -> Pages`
   - Build and deployment：
     - Source：`Deploy from a branch`
     - Branch：`gh-pages`
     - Folder：`/ (root)`
2. 可选 CLI 初始化（维护者）：

```bash
gh api -X POST repos/Jacobinwwey/NoteConnection/pages \
  -f source[branch]=gh-pages \
  -f source[path]=/
```

3. 验证：

```bash
gh api repos/Jacobinwwey/NoteConnection/pages
curl -I https://jacobinwwey.github.io/NoteConnection/
```

预期状态：`built` 且 HTTP `200`。

## CI 发布链路

工作流文件：

- `.github/workflows/docs-github-pages-publish.yml`

行为：

- 文档相关变更推送到 `main/master` 后自动触发。
- `workflow_dispatch` 手动触发支持：
  - `git_ref`（分支/tag/commit，可用于回滚）
  - `site_url`（可选覆盖）
  - `base_path`（可选覆盖）

## 发布前本地校验

```bash
npm run docs:diataxis:check
npm run docs:site:build
```

构建产物目录：`build/mkdocs-site`。

## 回滚流程

### 方法 A：CI 回滚（推荐）

1. 打开 `Docs GitHub Pages Publish` 工作流。
2. 点击 `Run workflow`。
3. 将 `git_ref` 设为稳定 tag/commit（例如 `v1.6.6`）。
4. 保持 `site_url` 与 `base_path` 与生产一致。
5. 执行后验证线上地址。

### 方法 B：本地回滚验证

```bash
git checkout <stable-tag-or-commit>
npm ci
npm run docs:diataxis:check
npm run docs:site:build
```

本地验证通过后，再按方法 A 用同一 `git_ref` 发布。

## 404 排障清单

1. 检查工作流状态：
   - `Docs GitHub Pages Publish` 必须成功。
2. 检查 `gh-pages` 分支是否存在并包含 `index.html`。
3. 检查 Pages API：
   - `gh api repos/Jacobinwwey/NoteConnection/pages`
4. 若 API 返回 `404 Not Found`：
   - 说明仓库尚未启用 Pages，请按“一次性初始化”启用。
5. 若 API 已是 `built` 但仍异常：
   - 等待 1-5 分钟 CDN 同步，清除浏览器缓存后重试。

## 运维护栏

- 保持 `docs/diataxis-map.json`、`mkdocs.yml`、工作流配置一致。
- 将文档发布视为正式发布工件，记录 tag、URL、时间戳。
- 每次重大文档改动前，预先确定可回滚稳定版本。
