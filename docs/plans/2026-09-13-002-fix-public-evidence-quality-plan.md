---
title: "fix: Close public evidence selection and measurement conflict gaps"
date: 2026-09-13
status: in_progress
parent: docs/plans/2026-09-12-001-refactor-project-convergence-plan.md
source_revision: 0ed53e8d825f1d95f8232d34e10b87960561974f
---

# Public Evidence Quality Closure / 公开证据质量收口

## English

This executes the remaining local U8 work in the parent plan. U1–U6 remain accepted; U7 native-device and independent artifact qualification and consented learner outcomes retain their original scope. The prior goal turn made progress through implementation, verification and a successful remote-main update; it did not complete the full goal.

Current evidence: V2 full replies include unrelated in-scope material; graph planning marks its claims as required because retrieval scores above one are clamped to one. Measurement conflicts miss Chinese, Hz and day units, and the existing comparator can incorrectly treat different units as contradictions. The Chinese unknown-measurement answer is already truthful; the evaluation signal misses it. Preserve the distinction between runtime defects and measurement defects.

- [x] Q1: Make one planning decision govern admitted evidence sources and full-report fragments. Retain all requested comparison operands, same-source context and justified supporting sources; preserve raw retrieval evidence for audit. Source scope and retrieval score do not prove topic relevance.
- [x] Q2: Compare measurements only when subject, dimension, time/environment/version/platform and assertion constraints are compatible. Normalize equivalent units, preserve negation, and keep unsupported/ambiguous comparisons undecided. Add positive and negative controls before extending extraction.
- [x] Q3: Carry detected conflicts into the actual public answer with both observations and citations. Keep slim/full, release review, wire budgets and replay consistent.
- [x] Q4: Validate the no-answer measurement signal against grounded unknown answers and factual negations. Version the evaluation protocol and retain old results; do not force correct unknown answers into a generic template to satisfy a regex.
- [ ] Q5: Run frozen V3 without tuning it, the existing regression corpus, full Node 22/24 suites and relevant browser/runtime gates. Update bilingual status and current artifact evidence, then integrate into remote main after verification.

V3 is frozen before production edits: six calibration cases and 28 new confirmation cases, `fixtures/answer-quality/v3.json`, SHA-256 `c8592a33a4f074dbf7059a14af656a2ac808e09eb37068b87f1664955f726b0b`. V1/V2 references stay unchanged and become regression evidence for this iteration. V3 adds multi-source/topic, equivalent-unit, contextual-scope and negation controls; it remains a curated corpus, not a learner study or a production error-rate estimate.

Owners: query-connected planning in `graphAnswerPlan.ts`; report assembly in `conversationComposer.ts`; source comparison in `evidenceContextAssembler.ts`; final disclosure in `answerReleaseReview.ts`; measurements in `AnswerQualityEvaluation.ts` and its evaluator. Add a module only if it owns a comparability invariant; do not build a generic fact framework or replace the graph/retrieval backend. Keep public identities and persisted schemas compatible.

Implementation checkpoint: 45 real-platform measurement cases cover units, negative constraints, tolerance half-widths, scientific/leading-decimal notation and scoped comparisons. The original 26 cases failed 15/26 before implementation. Public disclosure failed three of six initial cases before the release-boundary fix; the expanded public/release/platform regression passes 187 tests, including equivalent observations and 6 KB JSON/SSE/replay. The no-answer signal failed nine controls before correction; the combined measurement/evaluation/serialization regression passes 170 tests. TypeScript checks pass. Q5 final evidence is still pending. `answer-quality-public-surface-v2` reports public no-answer signals independently of the runtime release label; old unversioned reports remain legacy measurements, and V1/V2 reference files remain unchanged.

Acceptance requires failing-before/passing-after behavior and controls for false source rejection/false conflicts. A green synthetic query, a passing proxy signal, or a larger answer does not establish general quality. Native installation/SAF/restart/RSS and consented 7/28-day learner observations remain separate requirements.

Full-suite review found three graph-intent regressions in the first Q1 implementation: pruning after recognizing only one comparison branch removed legitimate analogy evidence and exposed a procedural path. Source pruning now requires a witness for every requested subject; partial recognition defers to the existing intent-aware graph assembly. The targeted graph/source suite passes 129 tests, and Node 22.19.0 / 24.14.0 each pass 165 suites / 1,604 tests with zero skips. Artifact and corpus verification follow these source checks.

<a id="chinese"></a>

## 中文

本计划继续执行上位计划中 U8 可在本机完成的工作，不缩小原目标。U1–U6 保持已验收；U7 真机/独立 artifact 资格与已取得同意的学习者观察仍保留原验收范围。上一目标回合完成实现、验证和远端 main 更新，属于实际进展，未完成整体目标。

当前证据：V2 full 回答混入同 scope 无关内容；graph planner 把大于一的 retrieval score 截成一后，将这些 claim 标为必需。测量冲突提取缺少中文、Hz 和天单位，原比较器还可能把不同单位误判为冲突。中文未知测量答案本身已经诚实，漏报发生在评估信号；运行缺陷和测量缺陷必须分开修复。

- [x] Q1：由一次规划决策约束准入证据源与 full 正文片段；保留全部比较对象、同源上下文及有依据的支持来源，原始检索证据继续可审计。scope 和 retrieval score 不能替代主题相关性。
- [x] Q2：主体、量纲、时间/环境/版本/平台及断言约束可比时才比较测量值；归一化等价单位，保留否定语义，无法比较的情况保持未判定。先增加正反对照，再扩展提取。
- [x] Q3：把已检测冲突传到真实公开答案，保留双方观察与引用，保持 slim/full、release review、wire budget、replay 一致。
- [x] Q4：用有依据的未知答案和事实否定验证拒答测量信号，版本化评估协议并保留旧报告；不为满足 regex 把正确未知答案改成泛化模板。
- [ ] Q5：不调参地执行冻结 V3、既有回归语料、Node 22/24 全量及相关浏览器/runtime 门禁；同步双语状态和产物证据，通过验证后更新远端 main。

V3 在生产修改前冻结，包含六个校准和 28 个新确认 case，位于 `fixtures/answer-quality/v3.json`，SHA-256 为 `c8592a33a4f074dbf7059a14af656a2ac808e09eb37068b87f1664955f726b0b`。V1/V2 参考保持原样，本轮作为回归证据。新语料补充多来源/主题、单位等价、上下文作用域和否定关系；它仍是人工设计语料，不能当作学习实验或生产错误率估计。

实现 owner：`graphAnswerPlan.ts` 负责查询相关规划，`conversationComposer.ts` 负责报告拼装，`evidenceContextAssembler.ts` 负责源事实比较，`answerReleaseReview.ts` 负责最终冲突披露，`AnswerQualityEvaluation.ts` 与 evaluator 负责测量。仅在承担可比性不变量时新增模块，不建设泛化事实框架或替换图谱/检索后端；保持公共身份和持久化 schema 兼容。

实现检查点：45 个真实 platform 测量用例覆盖单位、否定约束、公差半宽、科学计数/前导小数及作用域比较；原始 26 个用例在修复前失败 15 项。公开冲突披露的首批六个用例在发布边界修复前失败三项，扩展后的公开回答/release/platform 回归通过 187 项，包含等价观测及 6 KB JSON/SSE/replay。拒答测量修复前有九项对照失败，测量/evaluation/serialization 组合回归通过 170 项；TypeScript 检查通过。Q5 最终证据仍待完成。`answer-quality-public-surface-v2` 独立于 runtime release label 计算公开未知答案信号；既有无版本报告保留为旧口径，V1/V2 reference 文件保持原样。

验收需要修复前失败/修复后通过的行为证据，并验证源误拒绝和冲突误报。合成查询绿色、代理信号通过或答案变长均不能证明一般质量。原生安装/SAF/重启/RSS 与知情同意后的 7/28 天学习观察仍是独立要求。

全量检查在 Q1 首版中发现三个 graph-intent 回归：只识别比较的一侧就裁剪来源，导致有效 analogy 证据被删除，并暴露了程序性路径。现在裁剪前要求全部查询主体有依据；部分识别时保留候选，由既有意图感知图谱组装处理。图谱/来源组合回归通过 129 项，Node 22.19.0 / 24.14.0 各通过 165 suite / 1,604 test，零跳过；产物与语料确认继续在这组源码检查之后执行。
