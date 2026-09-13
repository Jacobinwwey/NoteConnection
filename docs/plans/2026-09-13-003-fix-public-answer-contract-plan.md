---
title: "fix: Preserve query subjects, complementary evidence and procedural order"
date: 2026-09-13
status: in_progress
updated: 2026-09-14
parent: docs/plans/2026-09-13-002-fix-public-evidence-quality-plan.md
source_revision: 9428f6281665c57e8a07eacb267089371c46c3e4
---

# Public Answer Contract Follow-up / 公开回答契约后续修复

## English

Frozen V3 completed before this follow-up: evaluation acceptance was 19/28 slim and 25/28 full, with 0/25 false conflicts, 0/3 missed conflicts and 2/2 correct unknown-measurement signals in each mode. The initial report is preserved at `docs/evaluations/evidence/2026-09-13-quality/answer-quality-v3-confirmation-initial.json`. It exposed real failures: compound questions were treated as entity names, a Chinese comparison admitted an unrelated building passage, and relevance ranking reordered a three-step replacement procedure. Slim projection also dropped supported complementary definition facts. V3 now becomes regression evidence; do not relabel later runs as independent confirmation.

- [x] R1: Align query-subject interpretation across source admission and release review. Preserve both Chinese comparison operands, separate follow-up questions from entity names, and accept source-backed attribute questions without weakening wrong-entity abstention.
- [x] R2: Preserve authored procedural order after evidence selection. Ranking may choose clauses; it must not imply an execution order that contradicts the source.
- [x] R3: Retain bounded, supported complementary claims in the public projection. Preserve math, glossary/artifact filters and compact response limits; distinguish source identity/presentation from assertions and normalize comparison identities across English and Chinese.
- [x] R4: Recognize explicit Chinese no-answer text containing a quoted question. Keep factual negation controls and version the public-surface measurement correction.
- [ ] R5: Preserve the first frozen V6 result, run V1–V6 as regressions after the final source-label fix, complete full runtime checks and current artifact qualification, then update bilingual evidence and remote main.

V4 is frozen before these production changes: six reused calibration cases and 22 new confirmation cases in `fixtures/answer-quality/v4.json`, SHA-256 `ba3c6936cf9cd67a606248bc98292920cf023f276f0ac68050f11d5e048682c6`. Its confirmation sources do not repeat V1–V3 sources. It covers compound/attribute questions, bilingual comparison subjects, procedure ordering, definition completeness, noisy headings and retained conflict/unknown controls. Curated reference acceptance is not a production error-rate estimate or a learner-outcome result.

Owners remain the existing query/claim semantics, graph planning and release review modules. Reuse the existing semantic owner rather than adding a generic query framework. Native window qualification also now requires the named Cargo tests to execute and pass: exit zero with zero, ignored or different tests cannot qualify a window. Six boundary controls passed on Node 22 and 24; this does not supply native-window observations. Android, independent-host/backend and consented learner evidence remain open in the parent plan.

V4's first confirmation is archived at `docs/evaluations/evidence/2026-09-13-quality/answer-quality-v4-confirmation-initial.json`: each mode accepted 21/22 cases and covered 47/48 facts, with no labelled leakage, false/missed conflict or unexpected abstention. Two different failures remain: full-mode polarity review interpreted a source heading as a positive assertion; the English title-noise filter matched `table` inside `Immutable` and discarded a supporting source. R3 is reopened for these boundary failures. Before further production changes, V5 froze six calibration and 16 new confirmation cases, SHA-256 `8061c9b785459c1e84ee4797d38d04f9d08b8105db9a4538a197f0c60be89b00`, in `fixtures/answer-quality/v5.json`. V4 joins the regression corpora; both first-confirmation reports remain unchanged.

V5's initial report is also archived. Full answers covered 32/32 facts; slim covered 29/32. The reported false conflict was the evaluator mistaking the correct domain statement about hash-key collisions for disagreement between sources; runtime RAG contained no conflict fragment. Three slim omissions exposed comparison-identity defects: English articles entered identity thresholds and Chinese unspaced sentences did not match their named operands. Finish R3 at those language boundaries, using standard word segmentation for Chinese context and keeping unrelated-clause controls. Correct the evidence-conflict measurement independently of runtime answers. V6 freezes six calibration and 12 new confirmation cases before these edits: `fixtures/answer-quality/v6.json`, SHA-256 `29db50012e0e2a39405131e614e2cdb942b50f8229310c713f3d2d7872d0b348`. V1–V5 are regression data from this point; never overwrite their initial confirmation records.

The V6 first-confirmation report is preserved: full accepted 12/12 cases and covered 28/28 facts; slim accepted 8/12 and covered 20/28. Conflict and unknown-answer signals were correct. The four slim failures came from interpreting a supported `Source: original clause` prefix as part of the subject/polarity. The final fix removes a prefix from semantic comparison only when the entire remaining clause exactly matches a clause from that named source. Unsupported assertions keep their checks. All 319 relevant regression tests now pass. Subsequent V6 executions are explicitly regression runs, not new independent confirmation. Protocol `answer-quality-public-surface-v3` distinguishes source disagreements from domain conflict terminology. Final full-suite, artifact and remote CI evidence is pending.

The local closure uses V1–V6 as regression data after this final presentation correction. Keep the initial V3–V6 confirmation scores in the evidence record; improved replay scores must not be presented as unseen evaluation. Native devices and consented learner outcomes retain their original acceptance requirements.

<a id="chinese"></a>

## 中文

V3 在本轮后续修改前完成首次确认：evaluation 验收 slim 19/28、full 25/28；两种模式均为冲突误报 0/25、漏报 0/3、未知测量正确识别 2/2。初次报告保存在 `docs/evaluations/evidence/2026-09-13-quality/answer-quality-v3-confirmation-initial.json`。它暴露了实际缺陷：复合问题被当作完整实体名、中文比较混入建筑资料、相关性排序改变了三步替换操作的执行顺序；slim 投影还遗漏有依据的补充定义事实。V3 从此作为回归证据，后续运行不得重新标注为独立确认。

- [x] R1：统一来源准入和发布审查对查询主体的解释；保留中文比较双方，把追问与实体名分开；有源支持的属性问题应可回答，同时保留错误实体拒答约束。
- [x] R2：选取证据后保持来源中的操作顺序；相关性排序可以决定选哪些句子，不能制造与来源相反的执行顺序。
- [x] R3：公开投影保留有界、受支持的补充声明，同时保留公式、变量表/文档噪声过滤及 compact 限制；区分来源身份/排版与事实断言，并统一中英文比较主体的身份归一化。
- [x] R4：识别包含被引用问句的中文明确拒答；保留事实否定对照，为公开信号修正单独标注评估版本。
- [ ] R5：保留 V6 首次冻结确认结果，在最终来源标签修复后将 V1–V6 作为回归运行；完成完整 runtime 与当前产物资格验证，再同步双语证据与远端 main。

V4 在这些生产修改之前冻结：`fixtures/answer-quality/v4.json` 包含六个沿用校准 case 与 22 个新确认 case，SHA-256 为 `ba3c6936cf9cd67a606248bc98292920cf023f276f0ac68050f11d5e048682c6`。确认源不与 V1–V3 重复，覆盖复合/属性问句、双语比较主体、步骤顺序、定义完整度、噪声标题，以及保留的冲突/未知答案对照。人工参考验收不能当作生产错误率或学习效果。

实现仍由既有 query/claim semantics、graph planning 和 release review 模块负责；复用语义 owner，不新增泛化查询框架。原生窗口资格还要求指定 Cargo 测试实际执行并通过：零退出码配合零测试、忽略测试或其他测试，均不能验收窗口。六项边界对照已在 Node 22/24 通过，但这不提供原生窗口观察。Android、独立宿主/backend 及取得参与同意的学习证据仍按上位计划保留开放。

V4 首次确认已归档至 `docs/evaluations/evidence/2026-09-13-quality/answer-quality-v4-confirmation-initial.json`：两种模式各验收 21/22、覆盖 47/48 事实，无已标记串题、冲突误报/漏报及错误拒答；剩下的是两个不同缺陷：full 极性审查把来源标题当作肯定断言，英文标题噪声过滤把 `Immutable` 中的 `table` 子串误判为表格并删除支持来源。因此重新打开 R3。进一步修改生产代码前，V5 在 `fixtures/answer-quality/v5.json` 冻结六个校准和 16 个新确认 case，SHA-256 为 `8061c9b785459c1e84ee4797d38d04f9d08b8105db9a4538a197f0c60be89b00`。V4 加入回归语料，两次首次确认报告保持原样。

V5 初次报告也已归档：full 覆盖 32/32 事实，slim 覆盖 29/32。报告中的冲突误报来自评估器把正确的“哈希键冲突”领域陈述误当成来源分歧，runtime RAG 没有冲突片段。三个 slim 遗漏暴露了比较身份缺陷：英文冠词进入身份阈值，中文连续文本无法按空格匹配已明确命名的对象。继续在语言边界完成 R3，为中文上下文使用标准分词，并保留无关句排除对照；证据冲突测量单独修正，不改正确回答。修改前，V6 在 `fixtures/answer-quality/v6.json` 冻结六个校准和 12 个新确认 case，SHA-256 为 `29db50012e0e2a39405131e614e2cdb942b50f8229310c713f3d2d7872d0b348`。此后 V1–V5 均为回归数据，不覆盖其初次确认记录。

V6 首次确认报告已保留：full 验收 12/12、覆盖 28/28 事实，slim 验收 8/12、覆盖 20/28，冲突和未知答案信号正确。四个 slim 失败源于把受支持的 `来源名: 原句` 前缀当作主语/极性的一部分；最终修复仅在余下整句与该名称对应来源中的完整句子完全一致时，才从语义比较中去掉前缀，伪造正文仍接受原校验。319 项相关回归均通过。V6 后续运行明确属于回归，不再算新独立确认。`answer-quality-public-surface-v3` 区分来源分歧与领域中的冲突术语；最终全量、产物及远端 CI 证据仍待补齐。

最终排版边界修复后的本机收口将 V1–V6 全部作为回归数据。证据记录保留 V3–V6 的首次确认成绩，不能把改进后的复跑结果写成未见评估；原生设备与已取得参与同意的学习效果保留原验收要求。
