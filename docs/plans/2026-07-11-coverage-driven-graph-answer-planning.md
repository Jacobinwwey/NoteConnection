---
module: learning
tags: [agent, augmented-rag, graph, answer-planning, coverage]
problem_type: implementation-plan
created: 2026-07-11
updated: 2026-07-18
status: completed
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
- [x] Replace surface contraction with graph-plan coverage and unsupported-claim review.
- [x] Add Water Glass plan regressions for definition, material boundary, thermal mechanism, evidenced graph application, and title-only-neighbor rejection.
- [x] Run focused tests, full Jest, TypeScript build, and runtime acceptance.

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

Final completion update:

- `graph_answer_plan_coverage` is now a release gate driven by required semantic claims rather than character or sentence counts;
- final public-answer coverage is recalculated after release revision and persisted with the knowledge run;
- response, trace, knowledge-run artifacts, and export reports now carry graph-plan and coverage summaries;
- Water Glass integration requires definition, material boundary, thermal mechanism, and complete required-claim coverage;
- all residual public character/sentence ceiling constants and projections have been removed.

Final verification: 122/122 suites passed, 1,147 tests passed, 26 skipped; `build:with-vite`, strengthened Water Glass runtime acceptance (required IDs and plan order), Diataxis validation, MkDocs build, and `git diff --check` passed.

### Post-completion robustness audit

A runtime audit after the initial completion found that removing answer ceilings exposed source-authoring scaffolding and Markdown table/diagram payloads that had previously been hidden by truncation. The final shaping boundary now rejects Chinese and English authoring/control instructions, removes fenced renderer payloads, strips heading syntax, and truncates table scaffolding after preserving the factual lead. This improves readability without discarding grounded semantic claims or reintroducing a length ceiling.

Post-audit verification: 119/119 suites passed, 1,127 tests passed, 26 skipped; the focused answer-quality matrix passed 177/177; TypeScript, production build, and Water Glass runtime acceptance passed.

### Current code versus prior approaches

| Area | Former code / Scheme A | Scheme B requirement | Current implementation | Remaining risk |
|---|---|---|---|---|
| Retrieval breadth | Raise `topK` or sentence quotas | Select a bounded, semantically useful subgraph | Existing RAG budgets remain bounded; answer planning consumes grouped spans and evidenced graph fragments | Budget calibration still relies on fixed profile maxima, although they no longer truncate the final answer |
| Answer unit | Independent evidence sentence | Evidence-backed semantic claim | `GraphAnswerClaimPlan` carries role, statement, node/edge provenance, confidence, and required status | Role inference is deterministic lexical logic and needs a larger multilingual calibration corpus |
| Graph topology | Degree/path rendered as optional prose | Graph structure becomes an answer contract | Anchor, relation edges, graph-neighbor evidence, omissions, and required roles enter `GraphAnswerPlan` | Predecessor/successor nodes without source evidence remain intentionally excluded from factual prose |
| Completeness | RAG role presence and keyword assertions | Validate required claim coverage | `graph_answer_plan_coverage` gates release; final coverage is recalculated after revision | Coverage matching is conservative lexical overlap, not semantic entailment |
| Public answer length | 900 characters and six sentences | Adaptive progressive disclosure | Character and sentence ceilings are removed | Very large evidence packs can still produce overly dense prose; solve through novelty and claim selection, not truncation |
| Readability | Truncation incidentally hid noisy source text | Natural synthesis without rigid templates | Shared public-evidence shaping removes control prose, table scaffolding, headings, and fenced payloads | Deterministic concatenation remains less fluent than a high-quality optional synthesizer |
| Release behavior | Replace a rich draft with a contracted revision | Preserve coverage while correcting unsafe claims | Definition revision augments the existing draft; coverage and citation gates remain active | Release audit records draft gate failures separately from final coverage, which operator UI must present clearly |
| Observability | Graph context mostly in secondary diagnostics | Replay plan and coverage decisions | Response, trace, knowledge run, artifact, and export report retain plan/coverage | Main frontend does not yet provide an operator-focused plan inspector |
| Scheme C / iterative agent | Not present | Optional only for complex research | Explicitly deferred; ordinary answers stay deterministic | A future tool loop must have bounded steps, evidence budgets, approval policy, and replayable events |

### Architecture progress by owner

- `graphContextAssembler.ts`: remains the candidate-subgraph owner. It selects anchor, support nodes, paths, predecessor/successor windows, and temporal context.
- `graphAnswerPlan.ts`: is now the semantic-planning owner. It converts usable evidence into answer roles and records why graph candidates were omitted.
- `graphAnswerCoverage.ts`: owns required-claim coverage evaluation and does not perform generation or retrieval.
- `conversationComposer.ts`: realizes the plan and ranked RAG evidence into public prose. Its remaining pressure is evidence selection/natural sequencing, not graph discovery.
- `answerReleaseReview.ts`: owns grounding, contradiction, graph-order, temporal, citation, leakage, and plan-coverage gates. It no longer owns answer-length policy.
- `KnowledgeLearningPlatform.ts`: still orchestrates the full turn and remains oversized. Extraction is justified only when a new owner can accept the complete conversation-evidence input and return the complete planned/reviewed answer operation.
- `WorkspaceExportBundle.ts`: exports a compact plan/coverage summary rather than leaking the full internal evidence pack.

### Prioritized next direction

1. Build a multilingual role/coverage calibration corpus covering definitions, causal explanations, comparisons, procedures, temporal qualifications, and weak-evidence cases.
2. Measure false-positive and false-negative rates for lexical claim coverage before adopting embeddings or an LLM entailment judge.
3. Improve novelty-aware claim selection and discourse ordering so rich answers remain readable without length ceilings.
4. Add an operator-only plan/coverage inspector if trace debugging remains costly; do not expose internal planning scaffolding in the primary answer.
5. Introduce bounded graph-expansion tools only for explicitly deep or research-oriented requests. Each expansion must be scope-safe, evidence-backed, step-limited, and replayable.
6. Do not add a broad orchestration framework or default multi-agent topology. The current gap is calibration and synthesis quality, not missing framework surface.

### 2026-07-18 remaining-phase closure

The follow-up phases now close the concrete risks rather than introducing another orchestration layer:

- `graphClaimMatcher.ts` owns deterministic multilingual concept normalization, clause-level polarity agreement, and semantic similarity. A negated paraphrase can no longer satisfy a positive required claim.
- `graphAnswerCoverageCalibration.ts` owns a versioned 24-case EN/ZH corpus across definition, causal, compare, procedure, temporal, and weak-evidence cases. Its report exposes precision, recall, and exact false-positive/false-negative case IDs.
- `graphAnswerPlan.ts` suppresses high-similarity same-role claims and records redundant graph atoms as omissions. Claims follow discourse dependencies before confidence tie-breaking, so applications no longer jump ahead of mechanisms merely because their retrieval score is higher.
- `graphExpansionPolicy.ts` separates ordinary retrieval from explicit deep/research expansion. The expanded path is fixed at one step, eight neighbors, and path depth eight; the actual policy and execution counts persist in `AgentConversationTrace` and the knowledge-run artifact.
- The existing Grounding Inspector now projects compact plan, coverage, omission, and expansion metrics. The public answer renderer remains unaware of internal plan scaffolding.

The deliberate non-change is equally important: answer-planning orchestration remains inside `KnowledgeLearningPlatform.ts`. Extracting it now would add a pass-through owner without reducing caller knowledge or enforcing a stronger invariant. The next architecture extraction should wait for a complete planned/reviewed-answer operation boundary.

Final verification after hardening the runtime acceptance: 122/122 Jest suites passed, 1,145 tests passed, 26 skipped; production and Vite builds passed; the Water Glass runtime case passed while rejecting flattened table introductions/rows, `:---` separators, authoring instructions, and internal section labels; Diataxis and MkDocs documentation gates passed.

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
- [x] 以 graph-plan coverage 和 unsupported-claim review 替代 surface contraction。
- [x] 新增 Water Glass plan 回归，覆盖定义、材料边界、热机制、有证据的图 application 以及仅标题邻居拒绝。
- [x] 运行专项测试、全量 Jest、TypeScript 构建和运行时验收。

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

最终完成状态：

- `graph_answer_plan_coverage` 已成为发布 gate，依据必要语义 claim，而不是字符数或句数；
- release revision 后会重新计算最终公开回答 coverage，并随 knowledge run 持久化；
- response、trace、knowledge-run artifact 和 export report 都携带 graph plan 与 coverage 摘要；
- Water Glass 集成验收直接要求定义、材料边界、热机制和完整 required-claim coverage；
- 所有残余的公开回答字符/句数 ceiling 常量与投影均已移除。

最终验证：122/122 个 suite 通过，1,147 个测试通过，26 个跳过；`build:with-vite`、强化后的 Water Glass 运行时验收（required IDs 与 plan 顺序）、Diataxis 校验、MkDocs 构建和 `git diff --check` 均通过。

### 完成后的稳健性复核

初次完成后的运行时复核发现：移除回答上限后，过去被截断掩盖的源文档创作指令、Markdown 表格和图表源码可能进入公开回答。最终 shaping 边界现在会统一拒绝中英文 authoring/control instruction，移除 fenced renderer payload，清理 heading 语法，并在保留事实引导句后截断表格脚手架。该修正不丢弃有证据的语义 claim，也没有重新引入长度上限。

复核后的验证结果：119/119 个 suite 通过，1,127 个测试通过，26 个跳过；回答质量专项矩阵 177/177 通过；TypeScript、production build 和 Water Glass 运行时验收通过。

### 当前代码与先前方案对比

| 领域 | 旧代码 / 方案 A | 方案 B 要求 | 当前实现 | 剩余风险 |
|---|---|---|---|---|
| 检索广度 | 提高 `topK` 或句子配额 | 选择有界且语义有效的子图 | RAG budget 继续有界；answer plan 消费聚合 span 与有证据的图 fragment | Profile 仍存在固定最大候选数，但不再截断最终回答 |
| 回答单位 | 独立 evidence sentence | 有证据的语义 claim | `GraphAnswerClaimPlan` 保存 role、statement、节点/边 provenance、confidence 和 required 状态 | Role inference 仍是确定性词法逻辑，需要更大的多语言校准语料 |
| 图拓扑 | degree/path 只是可选附加句 | 图结构成为答案契约 | Anchor、关系边、图邻居证据、omission 与 required role 进入 `GraphAnswerPlan` | 没有 source evidence 的前驱/后继仍会有意排除在事实文本之外 |
| 完整性 | 检查 RAG role 与关键词 | 验证 required claim coverage | `graph_answer_plan_coverage` 参与发布 gate；revision 后重新计算最终 coverage | Coverage matcher 是保守词法 overlap，不是语义蕴含判断 |
| 公开回答长度 | 900 字符、六句 | 自适应渐进披露 | 字符和句数 ceiling 已移除 | 超大 evidence pack 仍可能产生密集文本，应通过 novelty/claim selection 解决，而不是重新截断 |
| 可读性 | 截断偶然掩盖噪声 | 非固定模板的自然综合 | 共享 shaping 会清除控制文本、表格脚手架、标题与 fenced payload | 确定性串联的流畅度仍弱于高质量可选 synthesizer |
| 发布行为 | 用收缩 revision 覆盖丰富 draft | 修正风险时保留 coverage | Definition revision 增量补齐现有 draft；coverage/citation gate 保留 | Release audit 的 draft gate failure 与 final coverage 需要在 operator UI 中清晰区分 |
| 可观测性 | Graph context 多数仅在次级诊断 | 可回放 plan 与 coverage | Response、trace、knowledge run、artifact、export 都保留 plan/coverage | 主前端尚无 operator-only plan inspector |
| 方案 C / 迭代 Agent | 不存在 | 仅复杂研究场景可选 | 明确延期；普通回答保持确定性 | 未来 tool loop 必须具有步数、证据预算、审批策略和可回放事件 |

### 按 owner 划分的架构推进

- `graphContextAssembler.ts`：继续负责候选子图，选择 anchor、support、path、前驱/后继窗口与 temporal context。
- `graphAnswerPlan.ts`：成为语义规划 owner，把可用证据转换为 answer role，并记录图候选被排除的原因。
- `graphAnswerCoverage.ts`：只负责 required-claim coverage，不执行生成或检索。
- `conversationComposer.ts`：把 plan 与排序后的 RAG evidence 实现为公开文本；剩余压力是 evidence selection 和自然衔接，不是图发现。
- `answerReleaseReview.ts`：负责 grounding、矛盾、图顺序、时序、citation、leakage 与 plan coverage gate，不再负责回答长度策略。
- `KnowledgeLearningPlatform.ts`：仍负责完整 turn 编排且体积过大。只有新 owner 能接收完整 conversation/evidence 输入并返回完整 planned/reviewed answer 操作时，抽取才合理。
- `WorkspaceExportBundle.ts`：只导出紧凑 plan/coverage 摘要，不泄漏完整内部 evidence pack。

### 后续推进优先级

1. 建立覆盖定义、因果、比较、流程、时序限定和弱证据场景的多语言 role/coverage 校准语料。
2. 在引入 embedding 或 LLM entailment judge 前，先量化词法 coverage 的 false-positive / false-negative。
3. 改进 novelty-aware claim selection 与 discourse ordering，使丰富回答在无长度 ceiling 时仍保持可读。
4. 如果 trace 调试成本仍高，再增加 operator-only plan/coverage inspector；不要把内部规划脚手架暴露到主回答。
5. 只为显式 deep/research 请求引入有界 graph-expansion tool；每次扩展必须 scope-safe、有证据、限制步数并可回放。
6. 不引入宽泛编排框架或默认多 Agent。当前缺口是校准和综合质量，不是缺少框架表面。

### 2026-07-18 剩余 Phase 收口

后续 Phase 已针对具体风险闭环，没有引入新的宽泛编排层：

- `graphClaimMatcher.ts` 负责确定性的多语言概念归一化、分句极性一致性和语义相似度。否定改写不再能够满足正向 required claim。
- `graphAnswerCoverageCalibration.ts` 负责版本化的 24-case 中英文语料，覆盖 definition、causal、compare、procedure、temporal 和 weak-evidence；报告输出 precision、recall 以及精确的 false-positive/false-negative case ID。
- `graphAnswerPlan.ts` 会抑制同角色高相似 claim，并把冗余图 atom 记录为 omission。Claim 先按 discourse dependency 排列，再用 confidence 打破同组平局，application 不再仅因检索分数更高而跳到 mechanism 前面。
- `graphExpansionPolicy.ts` 把普通检索与显式 deep/research 扩展分开。扩展固定为一步、八个邻居、路径深度八；策略与实际执行量进入 `AgentConversationTrace` 和 knowledge-run artifact。
- 现有 Grounding Inspector 会投影紧凑的 plan、coverage、omission 与 expansion 指标；公开回答 renderer 仍不感知内部 plan 脚手架。

有意保持不变的是：answer-planning 编排仍留在 `KnowledgeLearningPlatform.ts`。当前抽取只会增加 pass-through owner，既不降低 caller knowledge，也不强化不变量。下一次架构抽取应等待完整 planned/reviewed-answer operation 边界成立。

加固运行时验收后的最终验证：122/122 个 Jest suite 通过，1,145 个测试通过，26 个跳过；production/Vite build 通过；Water Glass 运行时用例通过，并拒绝扁平化表格引导/表行、`:---` 分隔符、创作指令与内部章节标签；Diataxis 与 MkDocs 文档门通过。

### 2026-07-19 code-humanizer audit

The first structural cleanup pass used the current full Jest suite as its behavior oracle and removed duplicated graph-window extraction from `conversationComposer.ts` and `answerReleaseReview.ts`. `graphAnswerFacts.ts` now owns anchor exclusion, title deduplication, bounded predecessor/successor selection, and finite degree parsing; language-specific phrasing remains with its existing composer/release owner.

The audit intentionally left similar-looking helpers with different contracts: `queryBackend.ts` and `vectorAccelerationAdapter.ts` normalize tokens at different boundaries, and the several `clamp` functions have different non-finite-value policies. The domain `*Platform` interfaces are documented progressive extraction seams, not speculative single-implementation abstractions. No broad exception, compatibility fallback, or dead export was changed because that would alter error timing or an established boundary contract.

Verification: `tsc --noEmit` passed; focused graph/composer/release tests passed 76/76; full Jest passed 123/123 suites with 1,149 passed and 26 skipped.

### 2026-07-19 code-humanizer 复核

首轮结构清理以当前全量 Jest 作为行为 oracle，移除了 `conversationComposer.ts` 与 `answerReleaseReview.ts` 中重复的 graph-window 提取实现。现在由 `graphAnswerFacts.ts` 统一负责 anchor 排除、标题去重、有界前驱/后继选择和有限度数解析；语言相关的回答措辞仍由原有 composer/release owner 负责。

复核有意保留了表面相似但契约不同的 helper：`queryBackend.ts` 与 `vectorAccelerationAdapter.ts` 在不同边界执行 token 归一化，各处 `clamp` 对非有限值也有不同策略。学习域的 `*Platform` 接口是已记录的渐进拆分 seam，不是投机性的单实现抽象。没有修改 broad exception、兼容 fallback 或 dead export，因为这会改变错误时序或既有边界契约。

验证结果：`tsc --noEmit` 通过；graph/composer/release 定向测试 76/76 通过；全量 Jest 123/123 个 suite 通过，1,149 个测试通过，26 个跳过。

## English - 2026-07-19 executable-plan correction

The previous closure confused plan projection with plan execution. The causal defect was the RAG early return in `buildScopedConversationAnswer()`: the RAG answer returned before `GraphAnswerPlan.claims` were consumed. A second defect marked only one claim per role as required, so distinct graph facts could disappear without failing coverage.

The corrected pipeline is: bounded evidence and subgraph assembly -> public claim shaping -> novelty-aware planning -> ordered required-claim realization -> supplemental RAG clauses -> release review -> required-plan-preserving revision -> final coverage review. RAG role completeness uses local claim-to-role matching, and citation validation accepts both RAG fragments and citation-backed plan evidence.

Runtime acceptance now fails unless final required claim IDs are covered and their normalized statements preserve plan order. Emitting a plan in trace is no longer sufficient. Remaining risk is dense mathematical source clauses; the next increment is clause-level calibration and source-quality scoring, not character ceilings or a default iterative-agent framework.

## 中文 - 2026-07-19 可执行 plan 纠偏

此前的阶段闭合把 plan 投影误认为 plan 执行。直接原因是 `buildScopedConversationAnswer()` 的 RAG 提前返回：`GraphAnswerPlan.claims` 尚未消费，RAG answer 就已返回。第二个缺陷是每种 role 只标记一条 required，因此同 role 的不同图事实即使消失也不会触发 coverage 失败。

修正链路为：有界 evidence/子图组装 -> 公开 claim 整形 -> 新颖性感知规划 -> 有序 required claim 实现 -> RAG clause 补充 -> release review -> 保留 required plan 的 revision -> 最终 coverage review。RAG role completeness 改为局部 claim-to-role 匹配，citation 校验同时接受 RAG fragment 与带 citation 的 plan evidence。

运行时验收现在要求最终 required claim ID 全覆盖，并要求规范化 statement 保持 plan 顺序；仅在 trace 中输出 plan 不再算完成。剩余风险是密集数学源 clause，后续应推进 clause 级校准与 source-quality scoring，而不是恢复字符上限或默认迭代 Agent 框架。
