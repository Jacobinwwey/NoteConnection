# Sharelife 社区文档发布与回滚（EdgeOne CLI）

本文档用于固化从本地 MkDocs 构建到 EdgeOne Pages 发布的完整流程，并定义 Sharelife 社区界面的文档回滚操作规范。

## 适用范围

- 仓库：`NoteConnection`
- 文档栈：`MkDocs (Material)`
- 发布通道：通过 `edgeone` CLI 发布到 `EdgeOne Pages`
- 社区侧消费：Sharelife 仓库/社区界面引用已发布文档站点链接

## 前置条件

1. 已安装 Node.js 与 npm。
2. 已安装 MkDocs Python 依赖：
   - `pip install -r docs/requirements-mkdocs.txt`
3. 已安装 EdgeOne CLI：
   - `npm install -g edgeone@1.3.5`
4. 已准备以下任一鉴权方式：
   - 环境变量 Token：`EDGEONE_PAGES_API_TOKEN`
   - 本地已有 `edgeone` 登录态
5. 已确认目标项目名：
   - `EDGEONE_PAGES_PROJECT_NAME`（例如：`noteconnection-docs`）

## 本地一键发布

## 标准发布（校验 + 构建 + 部署）

```bash
npm run docs:edgeone:publish
```

该命令会依次执行：

1. `npm run docs:diataxis:check`
2. `npm run docs:site:build`
3. `edgeone pages deploy build/mkdocs-site -n <project> -e <env> -a <area>`

## 快速发布（跳过校验/构建，仅部署）

```bash
npm run docs:edgeone:publish:quick
```

仅在 `build/mkdocs-site` 已经是最新且已验证通过时使用。

## 可选参数

```bash
node scripts/deploy-docs-edgeone.js \
  --name noteconnection-docs \
  --env production \
  --area global \
  --token <EDGEONE_PAGES_API_TOKEN>
```

支持参数：

- `--skip-verify`
- `--skip-build`
- `--dir <输出目录>`
- `--name <项目名>`
- `--token <API Token>`
- `--env production|preview`
- `--area global|overseas`

## GitHub Actions 自动发布

工作流文件：

- `.github/workflows/docs-edgeone-publish.yml`

行为说明：

- 当 `main/master` 分支有文档相关变更时自动触发。
- 支持 `workflow_dispatch` 手动触发，并可传入：
  - `source_ref`（分支/Tag/Commit，可用于回滚部署）
  - `deploy_env`
  - `deploy_area`
  - `project_name`

必需仓库 Secret：

- `EDGEONE_PAGES_API_TOKEN`

建议配置的仓库 Variable 或 Secret：

- `EDGEONE_PAGES_PROJECT_NAME`

可选仓库 Variables：

- `EDGEONE_PAGES_ENV`（默认 `production`）
- `EDGEONE_PAGES_AREA`（默认 `global`）

## Sharelife 社区界面发布流程

每次文档发布建议按以下清单执行：

1. 通过本地一键命令或 CI 工作流完成文档发布。
2. 记录发布元信息：
   - 源版本（例如 `v1.6.5`）
   - 文档站点 URL
   - 发布时间（UTC）
3. 更新 Sharelife 社区界面内容：
   - “最新文档”入口链接
   - 版本标识/公告文案
   - 回滚参考信息（上一个稳定版本与链接）
4. 以用户视角验证：
   - 桌面端 + 移动端均可打开
   - 核心页面可访问（`first-run`、`configure-app-config`、release/reference）

## 回滚运行手册

## 方法 A：CI 回滚（推荐）

1. 打开 GitHub Actions 的 `Docs EdgeOne Publish` 工作流。
2. 点击 `Run workflow`。
3. 将 `source_ref` 设置为稳定 tag/commit（例如 `v1.6.4`）。
4. 使用相同的 project/environment 发布。
5. 发布完成后同步更新 Sharelife 社区公告，标注当前已回滚版本。

## 方法 B：本地回滚

```bash
git checkout <稳定tag或commit>
npm ci
npm run docs:edgeone:publish
```

部署完成后，切回原来的开发分支继续工作。

## 回滚后验证

1. 打开文档站确认页面内容已回退到目标版本。
2. 确认 Sharelife 社区界面入口指向正确版本说明。
3. 发布简短事故说明：
   - 回滚原因
   - 回滚源版本
   - 前向修复预计时间

## 运行治理建议

- 每次发布前先确认并记录“可回滚目标版本”。
- 避免对 Tag 做强制覆盖式文档修复。
- 发布前保持 `docs/diataxis-map.json` 与 `mkdocs.yml` 同步。
- 将文档发布视作正式发布产物，在 changelog/release note 中留痕。
