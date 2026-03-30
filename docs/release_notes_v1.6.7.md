# NoteConnection v1.6.7

## English

### Release Scope

- Compare baseline: `v1.6.6..v1.6.7`
- Commits: `5`
- Files changed: `56`
- Churn: `+6,021 / -862`

### Highlights

- Added a packaged `markdown-worker` sidecar across desktop targets and wired the new runtime through the frontend reader, NoteMD bridge, Tauri packaging, and validation scripts.
- Extended the embedded reader/path-mode experience with richer panel refresh, settings synchronization, and markdown rendering flow updates spanning frontend, server, and Godot integration code.
- Replaced legacy external docs-publish runbooks with project-owned bilingual GitHub Pages release/rollback guidance and aligned Diataxis/governance references to the new canonical docs.

### Markdown Worker and Reader Runtime

- Added `tools/markdown_worker` Rust binary and platform packaging paths for Windows, Linux, and macOS.
- Introduced `src/markdown/MarkdownGateway.ts` plus contract/integration coverage for markdown worker runtime selection and server integration.
- Updated sidecar build, validation, cleanup, and readiness scripts so the markdown worker is treated as a first-class Tauri sidecar during dev/build/test flows.
- Expanded frontend reader and NoteMD integration surfaces:
  - `src/frontend/reader.js`
  - `src/frontend/notemd.js`
  - `src/frontend/settings.js`
  - `src/server.ts`

### Docs Publishing and Release Operations

- Switched docs publishing away from the removed external EdgeOne runbook to repo-owned GitHub Pages runbooks:
  - `docs/en/docs_release_and_rollback.md`
  - `docs/zh/docs_release_and_rollback.md`
- Added GitHub Pages preflight/auto-enable logic in `.github/workflows/docs-github-pages-publish.yml` so docs deployments can self-heal common Pages configuration drift.
- Hardened `npm-publish.yml` with version-existence guarding to keep `npm publish` idempotent when both tag-push and release events fire for the same version.
- Aligned release metadata for `1.6.7` in package/Tauri manifests and refreshed README + Diataxis references to match the new operator workflow.

### Stability and Verification

- Added regression coverage for markdown gateway runtime routing, app-config persistence, server integration, and embed refresh behavior.
- Kept Tauri preflight cleanup/ensure scripts in the verification path so stale copied sidecars are removed before dev/build/test flows start.
- Preserved bilingual release-note structure so GitHub Release text can be published directly from this document without post-hoc rewriting.

### Release Notes

- This release is not just a docs-only cut: it delivers the new markdown worker runtime, expands embedded reader integration, and hardens GitHub Pages plus npm release operations around that rollout.
- The compare window remains tightly scoped to `v1.6.6..v1.6.7`, so the notes above are intended to map directly to the actual shipped delta.

---

## 中文

### 发布范围

- 对比基线：`v1.6.6..v1.6.7`
- 提交数：`5`
- 变更文件数：`56`
- 代码/文档变更量：`+6,021 / -862`

### 版本亮点

- 为桌面端新增可打包的 `markdown-worker` sidecar，并把该运行时完整接入前端阅读器、NoteMD 桥接、Tauri 打包与校验脚本。
- 扩展嵌入式阅读器 / Path Mode 体验，补齐面板刷新、设置同步与 Markdown 渲染链路，覆盖前端、服务端与 Godot 集成代码。
- 用项目自有的双语 GitHub Pages 发布 / 回滚手册替换历史外部文档发布手册，并同步收敛 Diataxis / 治理文档的权威引用入口。

### Markdown Worker 与阅读器运行时

- 新增 `tools/markdown_worker` Rust 二进制，并补齐 Windows、Linux、macOS 的打包路径。
- 引入 `src/markdown/MarkdownGateway.ts`，并补充 markdown worker 运行时选择与服务端集成的契约 / 集成测试。
- 更新 sidecar 的构建、校验、清理、就绪脚本，使 markdown worker 在 Tauri 的开发 / 构建 / 测试流程中成为一等 sidecar。
- 扩展前端阅读器与 NoteMD 集成面：
  - `src/frontend/reader.js`
  - `src/frontend/notemd.js`
  - `src/frontend/settings.js`
  - `src/server.ts`

### 文档发布与版本运维

- 将文档发布流程从已移除的外部 EdgeOne 手册切换到仓库自有 GitHub Pages 手册：
  - `docs/en/docs_release_and_rollback.md`
  - `docs/zh/docs_release_and_rollback.md`
- 在 `.github/workflows/docs-github-pages-publish.yml` 中增加 GitHub Pages 预检 / 自动启用逻辑，用于自恢复常见 Pages 配置漂移。
- 在 `npm-publish.yml` 中增加版本存在性保护，使同一版本同时被 tag push 与 release 事件触发时仍保持 `npm publish` 幂等。
- 对齐 `1.6.7` 的 package / Tauri manifest 版本元数据，并同步刷新 README 与 Diataxis 引用，保证运维入口一致。

### 稳定性与验证

- 增补 markdown gateway 运行时路由、app-config 持久化、服务端集成、嵌入式刷新行为的回归覆盖。
- 将 Tauri 预检清理 / ensure 脚本持续纳入验证链路，确保开发 / 构建 / 测试启动前不会遗留陈旧的复制 sidecar。
- 保持双语发布说明结构稳定，使 GitHub Release 文案可以直接从本文件发布，而不是事后再临时改写。

### 发布说明

- 本版本并非单纯文档整理，而是围绕新的 markdown worker 运行时上线，同步完成嵌入式阅读器集成与 GitHub Pages / npm 发布链路加固。
- 本说明严格对应 `v1.6.6..v1.6.7` 的实际变更窗口，便于后续直接作为 GitHub Release 正文使用。
