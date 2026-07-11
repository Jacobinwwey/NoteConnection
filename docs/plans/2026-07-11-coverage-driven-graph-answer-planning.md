---
module: learning
tags: [agent, augmented-rag, graph, answer-planning, coverage]
problem_type: implementation-plan
created: 2026-07-11
updated: 2026-07-11
status: in-progress
---

# Coverage-driven Graph Answer Planning

## English

### Decision

The answer pipeline will use the selected knowledge subgraph as an executable answer contract, not as an optional retrieval bonus. A new `GraphAnswerPlan` intermediate representation maps grounded nodes, edges, paths, and document evidence to semantic claims before public prose is composed.

The public answer must remain readable and natural, but readability is no longer enforced through a 900-character hard limit, a fixed six-sentence ceiling, or a one-sentence `direct_support` allowance. Length is controlled by evidence-backed information gain, required-role coverage, redundancy, and runtime budgets.

### Core failure mechanism

The existing pipeline already retrieves grouped document spans and assembles anchor, predecessor, successor, relation, path, and temporal context. Information is lost downstream because `conversationComposer.ts` projects that context into fixed sentence quotas, while `answerReleaseReview.ts` treats public-surface contraction as a release gate. Tests mostly prove topic retrieval and role presence, not whether high-value graph claims reach the public answer.

### Architecture boundary

1. `graphContextAssembler.ts` selects a bounded candidate subgraph. It does not decide prose structure.
2. `graphAnswerPlan.ts` assigns evidence-backed semantic roles and required/optional claims.
3. `conversationComposer.ts` realizes the plan as a direct lead followed by naturally connected detail. It does not use a universal section template.
4. `answerReleaseReview.ts` validates claim coverage, citation grounding, graph direction, temporal qualification, and leakage. Character count is diagnostic, not correctness.
5. Structured blocks and exports retain the plan and coverage review for replay and tuning.

### Selection rules

- Anchor content is consumed before graph expansion.
- Incoming and outgoing degree are discovery signals, never relevance proof.
- Relation kind, query relevance, evidence quality, path coherence, novelty, and temporal validity outrank centrality.
- A graph node cannot contribute a factual public claim without source evidence or an explicitly trusted structural contract.
- Expansion stops when required semantic coverage is reached or marginal evidence value falls below the runtime budget.
- Repeated evidence and semantically duplicate neighbors do not consume separate answer slots.

### Response-depth policy

Default behavior is adaptive progressive disclosure: answer directly first, then include all non-redundant required claims supported by the selected graph and document evidence. Compact answers remain possible when evidence is genuinely narrow; detailed answers are not truncated merely to satisfy a presentation quota.

### Implementation units and progress

- [x] Architecture audit identified the fixed sentence profiles and 900-character release gate as conflicting constraints.
- [x] Introduce typed `GraphAnswerPlan`, claim roles, provenance, omissions, and coverage summary.
- [x] Build the plan deterministically from grouped knowledge spans and graph context.
- [x] Make the composer construct and return the plan; the deterministic non-RAG path consumes planned claims, while the RAG path preserves its intent-aware sentence ranking during migration.
- [x] Remove the 900-character hard release gate and fixed public sentence ceiling; increase explain/direct graph evidence allowances without admitting background fragments indiscriminately.
- [ ] Replace surface contraction with graph-plan coverage and unsupported-claim review.
- [x] Add Water Glass plan regressions for definition, material boundary, thermal mechanism, evidenced graph application, and title-only-neighbor rejection.
- [ ] Run focused tests, full Jest, TypeScript build, and runtime acceptance.

### Rejected alternatives

- Increasing `topK` or sentence limits alone: creates longer fragment concatenation without semantic coverage guarantees.
- Dumping all predecessors and successors: degree amplifies noise and central nodes.
- A default iterative agent loop: unnecessary latency and nondeterminism for ordinary definition/explanation queries.
- A rigid answer template: produces mechanical prose and invents empty sections when evidence is absent.

### Risks and controls

- Context inflation: claim/evidence budgets and marginal-value stopping.
- Graph noise: intent-relation scoring and evidence-required public claims.
- Fluent hallucination: plan-bound claims plus citation and relation-direction gates.
- Repetitive prose: semantic deduplication before synthesis.
- Backward compatibility: additive optional plan fields and deterministic fallback when graph ops are unavailable.

### Next direction

After deterministic planning is stable, expose bounded graph expansion as an agent tool only for complex research queries. Do not make autonomous exploration the default path.

### 2026-07-11 implementation checkpoint

The first executable slice is now present:

- `graphAnswerPlan.ts` owns semantic claim planning and evidence provenance.
- grouped anchor spans are no longer represented only by the first direct sentence;
- graph-neighbor claims require evidence fragments and retain edge IDs;
- title-only predecessor/successor nodes are recorded as omitted weak evidence instead of being promoted to facts;
- `buildScopedConversationReply()` returns the plan for diagnostics and future UI/export projection;
- the public answer no longer fails merely because it exceeds 900 characters;
- the composer no longer applies a six-sentence final truncation and definition intent no longer has a one-direct-support allowance.

Verification at this checkpoint:

- graph planning, composer, release review, and the complete conversation regression matrix: 4 suites / 176 tests passed;
- TypeScript `--noEmit` passed;
- production build passed;
- `waterglass_explicit_scope_compact_zh` runtime acceptance passed;
- the repository-wide Jest run reached 113 passing suites and 1,108 passing tests, but three unrelated server/external-HTTP integration suites hit their existing 5-second `beforeAll` timeout under the concurrent full run. The affected conversation regression was rerun independently and passed 100/100.

Remaining architectural work is the explicit plan-coverage release gate and first-class plan projection in trace/export. The current release path already preserves the richer draft and augments it with grounded evidence instead of replacing it with a contracted answer.

## 中文

### 决策

回答链路将把选中的知识子图作为可执行的答案契约，而不是可有可无的检索加分项。新增 `GraphAnswerPlan` 中间表示，在生成公开文本前，把有证据的节点、边、路径和文档内容映射为语义 claim。

公开回答仍需自然、可读、有人情味，但不再通过 900 字符硬限制、固定六句上限或一条 `direct_support` 配额来实现“可读性”。长度由证据支持的信息增益、必要角色覆盖、去重结果和运行时成本共同控制。

### 核心失效机制

现有链路已经能聚合同文档多个 span，并装配锚点、前驱、后继、关系、路径和时序上下文。信息在下游丢失：`conversationComposer.ts` 把上下文压进固定句数配额，`answerReleaseReview.ts` 又把 public surface contraction 当作发布门。现有测试主要证明“找对主题”和“某类 evidence 存在”，没有证明高价值图 claim 真正进入最终回答。

### 架构边界

1. `graphContextAssembler.ts` 负责选择有界候选子图，不负责决定文本结构。
2. `graphAnswerPlan.ts` 负责分配有证据的语义角色以及 required/optional claim。
3. `conversationComposer.ts` 先直接回答，再自然串联计划中的细节；不套统一章节模板。
4. `answerReleaseReview.ts` 验证 claim 覆盖、引用、图方向、时序限定和内部信息泄漏；字符数仅作为诊断指标。
5. 结构化 block 和 export 保留 plan 与 coverage review，支持回放和校准。

### 选择规则

- 先充分消费锚点内容，再扩展图邻居。
- 入度、出度只用于发现候选，不能证明语义相关性。
- 关系类型、查询相关性、证据质量、路径连贯性、新颖性和时序有效性优先于中心性。
- 节点若没有来源证据或明确可信的结构契约，不得产生确定性的公开事实 claim。
- 必要语义覆盖完成，或边际证据价值低于预算阈值时停止扩展。
- 重复证据和语义重复邻居不能分别占用回答配额。

### 回答深度策略

默认采用自适应渐进披露：先直接回答，再呈现选中图和文档证据能够支持的全部非重复必要 claim。证据确实狭窄时回答可以短；证据充足时不得为了展示配额而截断。

### 实施单元与当前进度

- [x] 已完成架构审计，确认固定句数 profile 与 900 字符发布门和产品目标冲突。
- [x] 引入带类型的 `GraphAnswerPlan`、claim role、provenance、omission 与 coverage summary。
- [x] 从聚合知识 span 和 graph context 确定性构建 plan。
- [x] composer 已构建并返回 plan；确定性非 RAG 路径消费 planned claims，RAG 路径迁移期间保留原有意图感知句子排序。
- [x] 移除 900 字符硬发布门和固定 public sentence ceiling；提高 explain/direct/graph 证据容量，同时不无条件接纳 background fragment。
- [ ] 以 graph-plan coverage 和 unsupported-claim review 替代 surface contraction。
- [x] 新增 Water Glass plan 回归，覆盖定义、材料边界、热机制、有证据的图 application 以及仅标题邻居拒绝。
- [ ] 运行专项测试、全量 Jest、TypeScript 构建和运行时验收。

### 拒绝的替代方案

- 仅提高 `topK` 或句数：只能得到更长的片段拼接，不能保证语义覆盖。
- 倾倒全部前驱和后继：degree 会放大噪声和通用中心节点。
- 默认使用迭代 Agent：对普通定义和解释问题增加不必要的延迟与不确定性。
- 固定答案模板：容易产生机械化语言，并在证据缺失时制造空洞章节。

### 风险与控制

- 上下文膨胀：claim/evidence 预算与边际价值停止条件。
- 图噪声：意图—关系评分，并要求公开事实具备证据。
- 流畅幻觉：plan 约束、引用 gate 与边方向 gate。
- 文本重复：生成前完成语义去重。
- 兼容性：plan 字段保持 optional/additive；图操作不可用时保留确定性 fallback。

### 后续方向

确定性规划稳定后，只为复杂研究问题把有界图扩展暴露为 Agent tool；不把自主探索设为默认回答路径。

### 2026-07-11 实施检查点

首个可执行切片已经落地：

- `graphAnswerPlan.ts` 成为语义 claim 规划与证据 provenance 的明确 owner；
- 聚合锚点 span 不再只被压成第一条 direct sentence；
- 图邻居 claim 必须具备 evidence fragment，并保留 edge ID；
- 只有标题的前驱/后继会记录为 weak-evidence omission，而不会升级为事实；
- `buildScopedConversationReply()` 返回 plan，供诊断以及后续 UI/export 投影；
- 公开回答不再因超过 900 字符而失败；
- composer 不再执行最终六句截断，definition intent 也不再只有一条 direct-support 配额。

当前检查点验证结果：

- 图规划、composer、release review 与完整 conversation regression：4 个 suite、176 个测试通过；
- TypeScript `--noEmit` 通过；
- production build 通过；
- `waterglass_explicit_scope_compact_zh` 运行时验收通过；
- 仓库全量 Jest 运行达到 113 个 suite、1,108 个测试通过，但三个与本变更无关的 server/external-HTTP integration suite 在并发全量运行中触发现有的 5 秒 `beforeAll` 超时。受本次修改影响的 conversation regression 已独立重跑并 100/100 通过。

剩余架构工作是显式 plan-coverage 发布 gate，以及将 plan 一等投影到 trace/export。当前 release 路径已经改为保留更丰富的 draft，并用 grounded evidence 增量补齐，而不是用收缩后的短答案覆盖它。
