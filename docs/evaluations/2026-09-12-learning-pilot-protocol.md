---
title: Learning outcome pilot protocol / 学习成效试验协议
date: 2026-09-12
status: awaiting_participants
---

# Learning Outcome Pilot Protocol / 学习成效试验协议

## English

No participant observations have been collected. Implementation completion, mastery counters and answer-quality fixtures do not qualify the learning-outcome targets. This document defines the data and comparison needed before those targets can be assessed.

Use the stable `local_hybrid` backend with a pinned source revision, corpus hash, response mode and path-selection seed. Compare the guided path with a random choice from the same prerequisite-eligible frontier, using the same content and time budget. Unconstrained random ordering would bias the comparison by violating prerequisites. Counterbalance topic and order within each learner; use parallel test forms to reduce answer memorization.

| Target | Operational definition | Unit / denominator |
|---|---|---|
| Retest improvement ≥20% | Relative change: `(post accuracy − baseline accuracy) / baseline accuracy`; also report percentage-point change | Paired learner/topic; undefined when baseline accuracy is zero |
| Misconception recurrence reduction ≥25% | Relative reduction in repeated misconception events per comparable assessment opportunity | Paired learner/topic; preserve opportunity counts |
| Evidence-backed suggestions ≥90% | Independently adjudicated suggestions with a valid source that supports the suggestion | Supported suggestions / adjudicated suggestions |
| Guided path better than random | Paired difference in delayed retention and task completion at equal study time | Learner as the resampling unit, not individual clicks or cards |

Record pretest, immediate posttest, a seven-day retest and a 28-day retention check. Pre-register the observation windows and rubric before collecting outcome data. A small feasibility pilot estimates variance and attrition; use that variance to choose the subsequent sample size. Do not label a convenient participant count as a powered study.

Required records: pseudonymous participant ID, consent record reference, randomized condition/order, task/form ID, source/corpus revision, timing, scored answers, misconception opportunities/events, and blinded evidence adjudication. Keep names and contact details outside the engineering dataset. An absent consent record makes an observation ineligible.

Report participant count, task count, missing observations and attrition per condition. Preserve numerators and denominators. Use paired estimates and bootstrap learners for uncertainty once the sample supports it. Repeated answers from one learner are correlated. If randomization or baseline data are absent, report descriptive observations without a causal “better than random” claim.

The current [answer-quality corpus](../../fixtures/answer-quality/v1.json) measures deterministic reference probes. Its unsupported-assertion probes are a lower-bound detection instrument, not an exhaustive hallucination rate. Independent sentence-level review is still required for a general unsupported-claim rate.

## 中文

目前尚未采集参与者观察数据。功能完成、mastery 计数和回答质量 fixture 不构成学习成效目标的验收。本协议明确后续评估必须具备的数据与对照。

固定 `local_hybrid` 后端、源码修订、语料 hash、回答模式和路径选择 seed。将引导路径与“同一先修约束可行集合中的随机选择”比较，保持内容和学习时间预算一致。完全无约束的随机顺序会违反先修关系，造成有偏对照。每个学习者内部平衡主题与顺序，采用平行试卷降低答案记忆效应。

| 目标 | 可执行定义 | 统计单位 / 分母 |
|---|---|---|
| 复测提升 ≥20% | 相对变化：`（后测正确率 − 基线正确率）/ 基线正确率`；同时报告百分点差 | 学习者/主题配对；基线为零时相对变化未定义 |
| 误概念复发下降 ≥25% | 每个可比评估机会中的重复误概念事件率相对下降 | 学习者/主题配对，保留机会数 |
| 建议有证据支持 ≥90% | 独立审阅认定来源有效且支持建议 | 获得支持的建议数 / 已审阅建议数 |
| 引导路径优于随机 | 相同学习时间下，延迟保持率与任务完成的配对差 | 以学习者为重采样单位，不能把点击或卡片当独立样本 |

采集前测、即时后测、七天复测和 28 天保持测验。采样前预注册观察窗口与评分准则。小规模可行性试验用于估计方差和流失率，再据此确定后续样本量；不能把方便招募的人数称为有统计功效的研究。

必需字段：匿名化参与者 ID、同意记录引用、随机条件/顺序、任务/试卷 ID、源码/语料修订、耗时、评分、误概念机会/事件，以及盲审证据标签。姓名和联系方式不进入工程数据集；没有同意记录的观察不纳入分析。

分别报告各条件的参与人数、任务数、缺测与流失，保留所有分子和分母。样本具备条件后采用配对估计，并以学习者为单位 bootstrap 不确定性；同一学习者的多次回答存在相关性。缺少随机分配或基线数据时，只报告描述性观察，不作“因果上优于随机”的结论。

当前[回答质量语料](../../fixtures/answer-quality/v1.json)测量确定性参考探针。已标注的不受支持断言探针只提供检测下界，不能当作完整幻觉率。一般性的 unsupported-claim rate 仍需独立逐句审阅。
