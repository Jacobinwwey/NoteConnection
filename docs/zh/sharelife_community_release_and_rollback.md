# Sharelife 社区文档发布与回滚（GitHub Pages）

本文档用于固化从 MkDocs 构建到 GitHub Pages 发布的完整流程，并定义 Sharelife 社区界面的文档回滚操作规范。

## 范围

- 仓库：`NoteConnection`
- 文档栈：`MkDocs (Material)`
- 发布通道：`GitHub Pages` project site
- 社区消费方式：Sharelife 仓库/社区界面链接到已发布文档站

## 目标地址

- 主域名：`https://jacobinwwey.github.io/`
- Project site 路径（默认）：`/NoteConnection/`
- 完整文档地址（默认）：`https://jacobinwwey.github.io/NoteConnection/`

## 前置条件

1. 仓库已启用 GitHub Pages（来源为 Actions）。
2. 工作流权限包含 `pages:write` 与 `id-token:write`。
3. 文档依赖环境可用：
   - Node.js + npm
   - Python 依赖：`pip install -r docs/requirements-mkdocs.txt`

## CI 发布链路

工作流文件：

- `.github/workflows/docs-github-pages-publish.yml`

行为：

- `main/master` 上文档相关变更自动触发。
- `workflow_dispatch` 手动触发支持：
  - `git_ref`（分支/tag/commit，可用于回滚）
  - `site_url`（可选覆盖）
  - `base_path`（可选覆盖）

## 本地构建校验

```bash
npm run docs:diataxis:check
npm run docs:site:build
```

以上命令用于校验映射治理并生成静态产物到 `build/mkdocs-site`。

## Sharelife 社区界面发布流程

每次文档发布建议按以下清单执行：

1. 通过 CI 工作流完成文档发布。
2. 记录发布元数据：
   - source ref/tag（例如 `v1.6.6`）
   - 文档站 URL
   - 发布时间（UTC）
3. 更新 Sharelife 社区界面内容：
   - “最新文档”入口链接
   - 版本标签 / 公告说明
   - 回滚参考（上一稳定 tag 与 URL）
4. 从用户视角验证：
   - 桌面端 + 移动端可访问
   - 关键页面加载正常（`first-run`、`configure-app-config`、release/reference 页面）

## 回滚手册

## 方法 A：CI 回滚（推荐）

1. 打开 GitHub Actions 工作流 `Docs GitHub Pages Publish`。
2. 通过 `workflow_dispatch` 触发。
3. 将 `git_ref` 设置为稳定 tag/commit（例如 `v1.6.5`）。
4. 保持 `site_url` 与 `base_path` 与生产一致。
5. 部署完成后更新 Sharelife 社区公告，标注回滚版本。

## 方法 B：本地回滚验证

```bash
git checkout <stable-tag-or-commit>
npm ci
npm run docs:diataxis:check
npm run docs:site:build
```

本地验证通过后，使用同一 `git_ref` 走 CI 回滚。

## 回滚后验证

1. 打开文档站确认已回退到目标内容。
2. 确认 Sharelife 社区入口链接与版本说明一致。
3. 发布简短事故说明：
   - 回滚原因
   - 回滚来源 ref
   - 正向修复预计时间

## 运维守则

- 新版本发布前必须预先确定可回滚目标。
- 发布前保证 `docs/diataxis-map.json` 与 `mkdocs.yml` 同步。
- 将文档发布视为正式发布工件，保留可审计记录。
- 先完成 GitHub Pages 路线一轮观察，再决定是否绑定自定义域名。
