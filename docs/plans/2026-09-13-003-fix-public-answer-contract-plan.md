---
title: "fix: Preserve query subjects, complementary evidence and procedural order"
date: 2026-09-13
status: in_progress
parent: docs/plans/2026-09-13-002-fix-public-evidence-quality-plan.md
source_revision: 9428f6281665c57e8a07eacb267089371c46c3e4
---

# Public Answer Contract Follow-up / 公开回答契约后续修复

## English

Frozen V3 completed before this follow-up: evaluation acceptance was 19/28 slim and 25/28 full, with 0/25 false conflicts, 0/3 missed conflicts and 2/2 correct unknown-measurement signals in each mode. The initial report is preserved at `docs/evaluations/evidence/2026-09-13-quality/answer-quality-v3-confirmation-initial.json`. It exposed real failures: compound questions were treated as entity names, a Chinese comparison admitted an unrelated building passage, and relevance ranking reordered a three-step replacement procedure. Slim projection also dropped supported complementary definition facts. V3 now becomes regression evidence; do not relabel later runs as independent confirmation.

- [ ] R1: Align query-subject interpretation across source admission and release review. Preserve both Chinese comparison operands, separate follow-up questions from entity names, and accept source-backed attribute questions without weakening wrong-entity abstention.
- [ ] R2: Preserve authored procedural order after evidence selection. Ranking may choose clauses; it must not imply an execution order that contradicts the source.
- [ ] R3: Retain bounded, supported complementary definition claims in the public projection. Preserve math, glossary/artifact filters and compact response limits.
- [ ] R4: Recognize explicit Chinese no-answer text containing a quoted question. Keep factual negation controls and version the public-surface measurement correction.
- [ ] R5: Run the V1–V3 regressions, frozen V4, full runtime checks and current artifact qualification; update bilingual evidence and remote main after verification.

V4 is frozen before these production changes: six reused calibration cases and 22 new confirmation cases in `fixtures/answer-quality/v4.json`, SHA-256 `ba3c6936cf9cd67a606248bc98292920cf023f276f0ac68050f11d5e048682c6`. Its confirmation sources do not repeat V1–V3 sources. It covers compound/attribute questions, bilingual comparison subjects, procedure ordering, definition completeness, noisy headings and retained conflict/unknown controls. Curated reference acceptance is not a production error-rate estimate or a learner-outcome result.

Owners remain the existing query/claim semantics, graph planning and release review modules. Reuse the existing semantic owner rather than adding a generic query framework. Native window qualification also now requires the named Cargo tests to execute and pass: exit zero with zero, ignored or different tests cannot qualify a window. Six boundary controls passed on Node 22 and 24; this does not supply native-window observations. Android, independent-host/backend and consented learner evidence remain open in the parent plan.

<a id="chinese"></a>

## 中文

V3 在本轮后续修改前完成首次确认：evaluation 验收 slim 19/28、full 25/28；两种模式均为冲突误报 0/25、漏报 0/3、未知测量正确识别 2/2。初次报告保存在 `docs/evaluations/evidence/2026-09-13-quality/answer-quality-v3-confirmation-initial.json`。它暴露了实际缺陷：复合问题被当作完整实体名、中文比较混入建筑资料、相关性排序改变了三步替换操作的执行顺序；slim 投影还遗漏有依据的补充定义事实。V3 从此作为回归证据，后续运行不得重新标注为独立确认。

- [ ] R1：统一来源准入和发布审查对查询主体的解释；保留中文比较双方，把追问与实体名分开；有源支持的属性问题应可回答，同时保留错误实体拒答约束。
- [ ] R2：选取证据后保持来源中的操作顺序；相关性排序可以决定选哪些句子，不能制造与来源相反的执行顺序。
- [ ] R3：公开投影保留有界、受支持的补充定义声明，同时保留公式、变量表/文档噪声过滤及 compact 限制。
- [ ] R4：识别包含被引用问句的中文明确拒答；保留事实否定对照，为公开信号修正单独标注评估版本。
- [ ] R5：执行 V1–V3 回归、冻结 V4、完整 runtime 检查与当前产物资格验证；验证后同步双语证据与远端 main。

V4 在这些生产修改之前冻结：`fixtures/answer-quality/v4.json` 包含六个沿用校准 case 与 22 个新确认 case，SHA-256 为 `ba3c6936cf9cd67a606248bc98292920cf023f276f0ac68050f11d5e048682c6`。确认源不与 V1–V3 重复，覆盖复合/属性问句、双语比较主体、步骤顺序、定义完整度、噪声标题，以及保留的冲突/未知答案对照。人工参考验收不能当作生产错误率或学习效果。

实现仍由既有 query/claim semantics、graph planning 和 release review 模块负责；复用语义 owner，不新增泛化查询框架。原生窗口资格还要求指定 Cargo 测试实际执行并通过：零退出码配合零测试、忽略测试或其他测试，均不能验收窗口。六项边界对照已在 Node 22/24 通过，但这不提供原生窗口观察。Android、独立宿主/backend 及取得参与同意的学习证据仍按上位计划保留开放。
