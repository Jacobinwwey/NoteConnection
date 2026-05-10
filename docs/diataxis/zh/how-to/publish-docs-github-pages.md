# 操作指南：GitHub Pages 文档发布与本地维护

本指南用于日常文档发布、回滚和本地文档页面稳定维护。

## 1）发布目标

- 主域名：`https://jacobinwwey.github.io/`
- 项目基路径：`/NoteConnection/`
- 文档标准地址：`https://jacobinwwey.github.io/NoteConnection/`

## 2）流水线拓扑

## PR/主干文档校验

- 工作流：`.github/workflows/docs-diataxis-site.yml`
- 职责：
  - 执行 Diataxis 映射校验（`npm run docs:diataxis:check`）
  - 执行 MkDocs 构建（`mkdocs build --config-file mkdocs.yml`）

## 发布到 `gh-pages`

- 工作流：`.github/workflows/docs-github-pages-publish.yml`
- 自动触发：
  - `main`/`master` 分支 push
  - 且命中文档相关路径过滤（`docs/**`、`mkdocs.yml`、文档依赖/脚本、workflow、package 文件）
- 手动触发：
  - `workflow_dispatch`，可传 `git_ref`、`site_url`、`base_path`

## 3）本地发布前校验

提交前先执行：

```bash
npm run docs:diataxis:check
npm run docs:site:build
```

判定标准：

- Diataxis 输出 `PASS`，
- MkDocs 构建返回码 `0`，
- 未入 nav 的提示可接受（除非你当前迭代要求全量导航收敛）。

## 4）本地文档稳定维护模式

本地迭代建议使用固定地址与本地 base path：

```bash
MKDOCS_SITE_URL=http://127.0.0.1:18000/ \
MKDOCS_BASE_PATH=/ \
MKDOCS_DOCS_HOST=http://127.0.0.1:18000 \
npm run docs:site:serve -- --dev-addr 127.0.0.1:18000
```

作用：

- 避免本地预览受生产路径 `/NoteConnection/` 干扰，
- 新增页面与导航联动时链接更稳定、排错更直接。

## 5）标准发布流程（主干）

1. 文档改动合入 `main`。
2. 等待 `Docs GitHub Pages Publish` 完成。
3. 检查：
  - `verify-diataxis-map` 通过，
  - `build-site` 通过，
  - `gh-pages` 分支出现新发布提交，
  - 公网文档地址内容已更新。

## 6）从功能分支手动发布

用于分支预发布验证：

```bash
gh workflow run "Docs GitHub Pages Publish" \
  --ref <branch> \
  -f git_ref=<branch>
```

查看运行状态：

```bash
gh run list --workflow "Docs GitHub Pages Publish" --limit 5
gh run watch <run_id> --exit-status
```

## 7）回滚流程

通过手动触发并回指稳定版本：

```bash
gh workflow run "Docs GitHub Pages Publish" \
  --ref main \
  -f git_ref=<stable_tag_or_commit>
```

回滚后验证：

1. workflow 结果为 `success`，
2. 文档地址回到目标版本内容，
3. 基路径下导航无断链。

## 8）常见故障与处理

## Diataxis 映射失败

- 现象：`docs:diataxis:check` 失败。
- 处理：
  - 更新 `docs/diataxis-map.json`，
  - 确认 EN/ZH diataxis 页实际存在，
  - 确认 canonical 引用路径有效。

## MkDocs 构建失败

- 现象：`docs:site:build` 非零退出。
- 处理：
  - 安装 `docs/requirements-mkdocs.txt` 依赖，
  - 修复 markdown 链接和 frontmatter 格式，
  - 检查新增页面是否纳入预期导航入口。

## Pages 未启用

- 现象：部署成功但公网 `404`。
- 处理：
  - 仓库设置中启用 Pages，并设置 `gh-pages` 分支部署。

## 9）关联入口

- [文档总入口](../../../index.md)
- [开发进度看板](../explanation/development-progress-dashboard.md)
- [发布与治理参考](../reference/release-and-governance.md)
- [详细发布与回滚手册](../../../zh/docs_release_and_rollback.md)
