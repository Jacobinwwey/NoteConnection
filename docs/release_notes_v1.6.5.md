# NoteConnection v1.6.5

## English

### Release Scope

- Compare baseline: `v1.6.4..v1.6.5`
- Commits: `1`
- Files changed: `4`
- Churn: `+32 / -4`

### Highlights

- Published the MkDocs documentation portal to EdgeOne Pages project `noteconnection-docs`.
- Added bilingual README documentation discovery guidance for both users and developers:
  - EdgeOne docs portal entry
  - Public fallback mirror entry
  - Recommended Diataxis lookup paths
- Standardized maintainer docs deploy command:
  - `npm run docs:site:build`
  - `edgeone pages deploy build/mkdocs-site -n noteconnection-docs -e production -a global`
- Bumped project release version to `1.6.5` across:
  - `package.json`
  - `package-lock.json`
  - `src-tauri/tauri.conf.json`

### Release Notes

- This release is documentation portal and release-process hardening focused.
- Existing runtime behavior and packaging logic remain unchanged.

---

## 中文

### 发布范围

- 对比基线：`v1.6.4..v1.6.5`
- 提交数：`1`
- 变更文件数：`4`
- 代码/文档变更量：`+32 / -4`

### 版本亮点

- 已将 MkDocs 文档门户发布到 EdgeOne Pages 项目 `noteconnection-docs`。
- 已补充 README 中英文文档检索入口，覆盖用户与开发者场景：
  - EdgeOne 文档站入口
  - 公共镜像兜底入口
  - Diataxis 推荐查询路径
- 统一维护者文档发布命令：
  - `npm run docs:site:build`
  - `edgeone pages deploy build/mkdocs-site -n noteconnection-docs -e production -a global`
- 已将项目版本号统一提升到 `1.6.5`，覆盖：
  - `package.json`
  - `package-lock.json`
  - `src-tauri/tauri.conf.json`

### 发布说明

- 本版本聚焦文档门户上线与发布流程固化。
- 运行时行为与打包逻辑不做功能性变更。
