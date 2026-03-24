# NoteConnection v1.6.0

## English

### Release Scope

- Compare baseline: `v1.3.0..v1.6.0`
- Commits: `107`
- Files changed: `301`
- Churn: `+125,957 / -10,083`

### Highlights

- Tauri-first runtime architecture finalized; Electron runtime removed.
- Single-window orchestration stabilized between Tauri and Godot (no dual-primary window overlap).
- NoteMD evolved into an integrated processing subsystem (`src/notemd/*`) with frontend surfaces and API wiring.
- Tauri-side NoteMD browse workflows (file/folder/save picker chain) stabilized end-to-end.
- PDF ingestion guidance added: convert PDF with Mineru before Markdown import.
- Android dual pipeline hardened (Capacitor + Tauri Android), including prerequisite alignment scripts.
- CI governance expanded with FixRisk, SBOM/attestation, privacy/signature, pathbridge strict schema, and wasm parity gates.
- Final pre-release CI fixes included in tag:
  - runtime bridge invoke-contract compatibility for source-manager loadflow checks
  - SBOM transparency policy conditioning for unsigned/signing-key-absent publish contexts

### Detailed Reports

- English: `docs/en/release_v1.6.0_report.md`
- Chinese: `docs/zh/release_v1.6.0_report.md`

---

## 中文

### 发布范围

- 对比基线：`v1.3.0..v1.6.0`
- 提交数：`107`
- 变更文件数：`301`
- 代码/文档变更量：`+125,957 / -10,083`

### 版本亮点

- 完成 Tauri 主导运行时架构，Electron 运行时清退完成。
- 稳定 Tauri 与 Godot 的单窗口编排（不再双主窗口并存）。
- NoteMD 演进为完整集成子系统（`src/notemd/*` + 前端界面 + API 链路）。
- 修复并稳定 Tauri 中 NoteMD 的文件/文件夹/保存选择流程。
- 新增 PDF 导入规范提示：需先通过 Mineru 转换为 Markdown。
- 强化双 Android 导出路径（Capacitor + Tauri Android）及前置校验脚本。
- 扩展 CI 治理能力：FixRisk、SBOM/attestation、隐私/签名、pathbridge 严格 schema、wasm parity 门禁。
- 标签内最终 CI 修复包含：
  - runtime bridge invoke 契约兼容修复（source-manager loadflow）
  - 无签名发布场景下的 SBOM transparency 条件化策略修复

### 详细报告

- 英文：`docs/en/release_v1.6.0_report.md`
- 中文：`docs/zh/release_v1.6.0_report.md`
