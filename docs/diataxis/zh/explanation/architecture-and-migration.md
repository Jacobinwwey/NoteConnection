# 解释：架构与迁移背景

本页用于说明 NoteConnection 为什么转向 Tauri-first 架构，以及迁移决策背后的工程取舍。

## 为什么采用 Tauri-first

- 更强的运行时控制能力，便于 sidecar 编排与生命周期治理。
- 更清晰的单窗口行为约束，能够稳定管理 Tauri 与 Godot 的窗口切换。
- 对桌面端与移动端运行时能力差异有更明确的契约边界。

## 为什么文档采用 Diataxis

- 版本迭代加速后，历史文档规模快速增长，内容意图混杂（学习、操作、规范、解释交织）。
- Diataxis 将文档分层为：
  - 学习路径（`tutorials`）
  - 任务执行（`how-to`）
  - 权威契约（`reference`）
  - 架构动机（`explanation`）
- 这样可以降低重复维护成本，提升文档可追踪性与长期稳定性。

## 解释类权威来源

- [docs/zh/tauri_brainstorming.md](../../../zh/tauri_brainstorming.md)
- [docs/zh/electron_migration_analysis.md](../../../zh/electron_migration_analysis.md)
