# NoteConnection v1.6.8

## English

### Release Scope

- Compare baseline: `v1.6.7..v1.6.8`
- Commits: `1`
- Files changed: `7`
- Churn: `+157 / -31`

### Highlights

- Fixed the `tauri.sidecar.cleanup` contract expectation so release CI recognizes the new `markdown-worker` sidecar and no longer blocks npm publish on a stale assertion.
- Added explicit release-note quality discipline in `AGENTS.md`, including bilingual section requirements and subsystem-oriented release narrative standards.
- Backfilled and strengthened `v1.6.7` release notes so the published release body stays aligned with the real shipped delta across runtime, packaging, CI, and docs surfaces.

### Release Pipeline Reliability

- Updated `src/tauri.sidecar.cleanup.contract.test.ts` to match the runtime sidecar list (`server`, `godot`, `markdown-worker`), removing the false-negative test failure that previously stopped the npm release stage.
- Kept the release path aligned with existing automation triggers (`tag push` and GitHub Release publication) so the npm workflow remains idempotent and reproducible.

### Documentation and Governance

- Extended `AGENTS.md` with a dedicated "Release Notes Discipline" section to enforce:
  - bilingual `## English` and `## 中文` split,
  - compare baseline declaration,
  - subsystem-grouped concrete highlights,
  - direct publish-ready release body quality.
- Refined `docs/release_notes_v1.6.7.md` content structure and detail depth to match repository release quality expectations.

### Version Metadata

- Bumped release metadata to `1.6.8` in:
  - `package.json`
  - `package-lock.json`
  - `src-tauri/tauri.conf.json`

### Release Notes

- This patch release focuses on release reliability and documentation quality control: it unblocks the npm pipeline regression, standardizes release-note governance, and keeps bilingual release communication consistent.

---

## 中文

### 发布范围

- 对比基线：`v1.6.7..v1.6.8`
- 提交数：`1`
- 变更文件数：`7`
- 代码/文档变更量：`+157 / -31`

### 版本亮点

- 修复 `tauri.sidecar.cleanup` 契约测试中的旧断言，使发布 CI 能正确识别新增的 `markdown-worker` sidecar，避免 npm 发布被误拦截。
- 在 `AGENTS.md` 新增发布说明质量约束，明确双语分段与按子系统组织的发布叙事标准。
- 回填并增强 `v1.6.7` 发布说明细节，确保已发布版本正文与实际交付变更（运行时、打包、CI、文档）一致。

### 发布链路可靠性

- 更新 `src/tauri.sidecar.cleanup.contract.test.ts`，将运行时 sidecar 列表对齐为 `server`、`godot`、`markdown-worker`，消除此前阻断 npm 发布阶段的误报测试失败。
- 保持发布流程与既有自动化触发机制（`tag push` + GitHub Release 发布）一致，确保 npm 工作流具备幂等与可复现性。

### 文档与治理

- 在 `AGENTS.md` 增补 "Release Notes Discipline" 章节，强制要求：
  - `## English` 与 `## 中文` 双语分段，
  - 明确 compare baseline，
  - 按子系统组织具体亮点，
  - 发布文案可直接用于 GitHub Release 正文。
- 细化 `docs/release_notes_v1.6.7.md` 的结构与信息密度，使其达到仓库既定发布质量基线。

### 版本元数据

- 将以下文件版本统一提升到 `1.6.8`：
  - `package.json`
  - `package-lock.json`
  - `src-tauri/tauri.conf.json`

### 发布说明

- 本次补丁版本聚焦发布可靠性与文档质量治理：既修复 npm 发布链路回归点，也统一双语发布说明标准，保障后续发版稳定执行。
