# NoteConnection v1.6.7

## English

### Release Scope

- Compare baseline: `v1.6.6..v1.6.7`
- Commits: `5`
- Files changed: `53`
- Churn: `+5,764 / -862`

### Highlights

- Removed external community UI-specific docs references from repository documentation.
- Replaced legacy external runbooks with project-owned bilingual docs runbooks:
  - `docs/en/docs_release_and_rollback.md`
  - `docs/zh/docs_release_and_rollback.md`
- Updated Diataxis mapping and governance references to point to new canonical docs runbooks.
- Added GitHub Pages preflight site-state check in `.github/workflows/docs-github-pages-publish.yml`.
- Resolved docs portal `404` by enabling repository Pages with `gh-pages` branch source.
- Prepared formal release metadata and aligned versions to `1.6.7`:
  - `package.json`
  - `package-lock.json`
  - `src-tauri/tauri.conf.json`

### Release Notes

- This release focuses on docs governance hardening and release readiness cleanup.
- Core runtime logic and application behavior are unchanged from feature perspective.

---

## 中文

### 发布范围

- 对比基线：`v1.6.6..v1.6.7`
- 提交数：`5`
- 变更文件数：`53`
- 代码/文档变更量：`+5,764 / -862`

### 版本亮点

- 清理了仓库文档体系中外部社区界面相关的非项目文档引用。
- 以项目自有的双语文档手册替换原历史外部手册：
  - `docs/en/docs_release_and_rollback.md`
  - `docs/zh/docs_release_and_rollback.md`
- 同步更新 Diataxis 映射与治理引用，确保权威来源指向一致。
- 在 `.github/workflows/docs-github-pages-publish.yml` 增加 GitHub Pages 站点预检步骤。
- 通过启用仓库 Pages 并绑定 `gh-pages` 作为发布源，修复文档站点 `404`。
- 完成 `1.6.7` 版本发布准备并统一版本号：
  - `package.json`
  - `package-lock.json`
  - `src-tauri/tauri.conf.json`

### 发布说明

- 本版本聚焦文档治理加固与发布流程收口。
- 功能层面不引入新的核心运行时能力变更。
