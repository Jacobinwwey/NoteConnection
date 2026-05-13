# 2026-05-10 Open Goal Audit / 未完成目标审计

## English

### 2026-05-13 Further Revalidation

- This document remains a 2026-05-10 audit baseline and should not be read as current HEAD truth without this addendum.
- HEAD has advanced beyond the 2026-05-12 revalidation note:
  - Phase-1 A8 is no longer "default local-file-graphdb": default runtime now targets embedded `graphdb/sqlite`, and server-restart durability is covered by integration proof.
  - Phase-2 query/staleness/learning-quality/session-plan-quality surfaces are no longer placeholder-backed.
  - Phase-3 tutor routing is no longer catalog-only: default runtime now injects an active local tutor adapter.
- Current still-open goals after the latest revalidation are:
  - remaining A8 packaged/runtime + heavier-workload closure,
  - A9 production ANN closure,
  - Phase-2 release-grade gate calibration,
  - multi-provider tutor-routing hardening,
  - FR-009 operational evidence,
  - Electron decommission review.

### 2026-05-12 HEAD Revalidation

- The previous cross-doc conclusion ("only FR-009 + Electron review remain") is no longer sufficient for HEAD truth-tracking.
- Newly reclassified active implementation gaps:
  - Phase-1 A8 remains `Partial+`: default graph backend is still `local-file-graphdb`, so a real local graph database baseline is not delivered yet.
  - Phase-1 A9 remains `Partial+`: current ANN delivery is still connector scaffolding + telemetry, not a proven production ANN backend.
  - Phase-2 quality gating remains open at application level because `KnowledgeLearningPlatform.ts` still returns placeholders for query comparison, staleness, learning-quality, and session-plan-quality runtime surfaces.
  - Phase-3 tutor routing remains open at runtime wiring level because server bootstrap configures a `tutorAdapters` catalog but does not inject an active `tutorAdapter` into normal execution.
- Previously closed-and-still-closed items:
  - agent-workspace browser/runtime/Tauri verification chain,
  - tutor telemetry + conversation memory + memory-policy diagnostics backend slice,
  - load-flow parity / Godot history synchronization contract closures.

### Scope

- Audited `122` markdown files under `docs/**/*.md`.
- Covered both:
  - docs-site build pages (MkDocs + Diataxis navigation targets),
  - working documents (`docs/en`, `docs/zh`, `docs/solutions`, `docs/brainstorms`, root docs pages).

### Audit Method

- Pattern scan on goal-status markers:
  - unchecked tasks: `- [ ]`
  - status keywords: `pending`, `in progress`, `remains pending`, `未完成`, `进行中`, `待完成`
- Command family used:
  - `rtk rg --files docs --glob "*.md"`
  - `rtk rg -l "<status-pattern>" docs --glob "*.md"`

### Result Summary

- Files with open-goal markers: `27`
- Files without open-goal markers: `95`
- Canonical active open goals after HEAD revalidation:
  - FR-009 operational evidence closure (physical-device large-graph/freshness evidence).
  - Electron decommission final gate review.
  - Phase-1 A8 real graph backend closure.
  - Phase-1 A9 production ANN closure.
  - Phase-2 non-placeholder quality/query/session diagnostics closure.
  - Phase-3 active tutor-routing closure.
- Phase-1 closure note:
  - Production graph backend adapter + ANN connector hardening code paths were implemented after this audit baseline.
  - HEAD revalidation now classifies A8/A9 as `Partial+`, so current open-goal tracking must include their remaining backend-closure work.
- Revalidation note (2026-05-12):
  - Tauri load-flow parity implementation gates are now closed by contract evidence (`src/source_manager.loadflow.test.ts`, `src/welcome.loadflow.test.ts`, `src/pathmode.history.contract.test.ts`, `npm run verify:agent-workspace:tauri`).
  - Remaining Tauri-related work is now host provisioning for Linux strict evidence (`webkit2gtk-4.1`, `javascriptcoregtk-4.1`, `libsoup-3.0`), not application behavior drift.

### Classification Notes

- Active goal trackers (authoritative for release gating):
  - `docs/en/TODO.md`, `docs/zh/TODO.md`
  - `docs/en/task.md`, `docs/zh/task.md`
  - `docs/en/tauri_tasks.md`, `docs/zh/tauri_tasks.md`
  - `docs/en/TEST_REPORT.md`, `docs/zh/TEST_REPORT.md`
- Historical context trackers (kept for traceability, not current release gate source):
  - `docs/tauri_tasks.md`, `docs/tauri_brainstorming.md`
  - `docs/archive/TODO.en.md`, `docs/archive/TODO.zh.md`
- Diataxis docs may reference remaining work, but active close/open decisions follow the trackers above.

### Open-Goal Marker Coverage (File-Level)

| File | Marker Count |
|---|---:|
| `docs/archive/TODO.en.md` | 186 |
| `docs/archive/TODO.zh.md` | 152 |
| `docs/brainstorms/2026-04-11-evolution-progress-alignment-requirements.md` | 1 |
| `docs/diataxis/en/explanation/memos-reuse-assessment.md` | 1 |
| `docs/diataxis/en/explanation/startup-node-update-acceleration-plan.md` | 1 |
| `docs/diataxis/zh/explanation/agent-conversation-focus-mode-plan.md` | 1 |
| `docs/diataxis/zh/explanation/development-progress-dashboard.md` | 2 |
| `docs/electron_migration_analysis.md` | 1 |
| `docs/en/extra.md` | 1 |
| `docs/en/lfs_asset_migration_plan.md` | 1 |
| `docs/en/task.md` | 4 |
| `docs/en/tauri_brainstorming.md` | 1 |
| `docs/en/tauri_tasks.md` | 15 |
| `docs/en/TEST_REPORT.md` | 6 |
| `docs/en/TODO.md` | 193 |
| `docs/solutions/cross-platform-architecture-refinement-2026-05-02.md` | 13 |
| `docs/solutions/documentation-gaps/learning-platform-api-workbench-contract-gap-2026-04-02.md` | 1 |
| `docs/solutions/implementation-gap-analysis-2026-05-04.md` | 2 |
| `docs/tauri_brainstorming.md` | 1 |
| `docs/tauri_tasks.md` | 19 |
| `docs/zh/electron_migration_analysis.md` | 1 |
| `docs/zh/implementation_plan.md` | 30 |
| `docs/zh/lfs_asset_migration_plan.md` | 1 |
| `docs/zh/task.md` | 78 |
| `docs/zh/tauri_tasks.md` | 4 |
| `docs/zh/TEST_REPORT.md` | 9 |
| `docs/zh/TODO.md` | 160 |

## 中文

### 2026-05-13 进一步复核

- 本文仍是 2026-05-10 的审计基线；如果不结合本节补充说明，就不能把它当作当前 HEAD 的真实状态。
- HEAD 已经超出 2026-05-12 的复核口径：
  - Phase-1 A8 已不再是“默认 local-file-graphdb”：默认 runtime 现已切到 embedded `graphdb/sqlite`，且跨 server restart 的耐久性已有集成证明。
  - Phase-2 的 query/staleness/learning-quality/session-plan-quality 运行面已不再依赖 placeholder。
  - Phase-3 tutor routing 也不再是 catalog-only：默认 runtime 现已注入激活态本地 tutor adapter。
- 截至最新复核，当前仍然开放的目标是：
  - A8 剩余的 packaged/runtime + 更重工作负载闭环，
  - A9 生产级 ANN 闭环，
  - Phase-2 发布级门禁校准，
  - 多 provider tutor-routing 加固，
  - FR-009 运维证据，
  - Electron 下线审查。

### 2026-05-12 HEAD 复核

- 先前“当前只剩 FR-009 + Electron review”这一跨文档结论，已不足以描述 HEAD 真相。
- 现已重新识别出的活跃实现缺口：
  - Phase-1 A8 仍为 `Partial+`：默认 graph backend 仍是 `local-file-graphdb`，尚未交付真实本地图数据库基线；
  - Phase-1 A9 仍为 `Partial+`：当前 ANN 交付仍属于 connector scaffolding + telemetry，而不是已验证的生产级 ANN 后端；
  - Phase-2 quality gating 仍在应用层开放状态：`KnowledgeLearningPlatform.ts` 中 query compare、staleness、learning-quality、session-plan-quality 一组运行面仍有 placeholder 返回；
  - Phase-3 tutor routing 在 runtime wiring 层仍未闭环：`server.ts` 配置了 `tutorAdapters` catalog，但默认执行路径没有注入激活态 `tutorAdapter`。
- 已关闭且继续保持关闭的部分：
  - agent-workspace browser/runtime/Tauri 验证链，
  - tutor telemetry + conversation memory + memory-policy diagnostics 后端切片，
  - load-flow parity / Godot history synchronization 合同闭环。

### 范围

- 已审计 `docs/**/*.md` 下 `122` 个 Markdown 文档。
- 覆盖范围包括：
  - 文档站点构建页（MkDocs + Diataxis 导航目标），
  - 工作文档（`docs/en`、`docs/zh`、`docs/solutions`、`docs/brainstorms`、根目录文档页）。

### 审计方法

- 使用以下目标状态标记进行扫描：
  - 未勾选任务：`- [ ]`
  - 状态关键词：`pending`、`in progress`、`remains pending`、`未完成`、`进行中`、`待完成`
- 使用命令族：
  - `rtk rg --files docs --glob "*.md"`
  - `rtk rg -l "<status-pattern>" docs --glob "*.md"`

### 结果汇总

- 含未完成目标标记的文件：`27`
- 未命中未完成标记的文件：`95`
- 截至 2026-05-10 拉取同步后的当前活跃未完成目标：
  - FR-009 运维证据闭环（真机大图/新鲜度证据）。
  - Electron 下线最终闸门审查。
- Phase-1 收口说明：
  - 生产级图后端适配器与 ANN 连接器的代码路径已在该审计基线后落地。
  - 但 HEAD 复核已将 A8/A9 重新归类为 `Partial+`，因此当前未完成目标口径必须重新纳入这两项剩余 backend-closure 工作。
- 复核说明（2026-05-12）：
  - Tauri 加载流程一致性实现门禁现已由合同证据关闭（`src/source_manager.loadflow.test.ts`、`src/welcome.loadflow.test.ts`、`src/pathmode.history.contract.test.ts`、`npm run verify:agent-workspace:tauri`）。
  - 当前剩余的 Tauri 相关工作已收缩为 Linux strict 证据宿主前置依赖（`webkit2gtk-4.1`、`javascriptcoregtk-4.1`、`libsoup-3.0`），不再属于应用行为漂移。

### 分层说明

- 活跃目标看板（发布闸门权威来源）：
  - `docs/en/TODO.md`、`docs/zh/TODO.md`
  - `docs/en/task.md`、`docs/zh/task.md`
  - `docs/en/tauri_tasks.md`、`docs/zh/tauri_tasks.md`
  - `docs/en/TEST_REPORT.md`、`docs/zh/TEST_REPORT.md`
- 历史上下文看板（保留追溯，不作为当前发布闸门来源）：
  - `docs/tauri_tasks.md`、`docs/tauri_brainstorming.md`
  - `docs/archive/TODO.en.md`、`docs/archive/TODO.zh.md`
- Diataxis 页面可描述剩余工作，但关闭/未关闭裁定以活跃看板为准。

### 文件级命中统计

下表与英文段一致，按文件展示未完成目标标记命中次数（见上方英文表）。
