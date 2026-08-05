---
module: learning
tags: [agent, augmented-rag, graph, answer-planning, coverage]
problem_type: implementation-plan
created: 2026-07-11
updated: 2026-08-05
status: completed
---

## 2026-07-19 Clause-Level Source Quality Completion

### English

The dense-fragment phase is implemented. `ragEvidenceQuality.ts` owns deterministic clause segmentation and source-quality features: terminal completeness, delimiter balance, mathematical-token density, length sanity, and documentary/meta-text penalties. `graphAnswerPlan.ts` applies this policy before public claim shaping while retaining the original fragment in `evidenceRefs`; `answerReleaseReview.ts` uses the score as a relevance-preserving tie-breaker, and `conversationComposer.ts` removes only high-semantic-similarity supplemental duplicates.

The important boundary is clause-local filtering. A fragment containing one authoring preamble and one valid equation is no longer discarded wholesale. If no safe clause remains, the claim is omitted rather than falling back to unsafe raw text. This preserves graph coverage without allowing source contamination to dominate the public answer.

Verification evidence at the time of this historical checkpoint: full Jest passed 124/124 suites, 1,155 tests passed, and 26 skipped; the focused graph-plan/release/coverage matrix passed after final shaping, TypeScript production build passed, and the conversation-mode Water Glass verifier passed with complete required claim IDs, no duplicate long clauses, and no public Markdown scaffolding. The later runtime closure below supersedes the earlier full-mode timeout note.

### 中文

密集 fragment 阶段现已实现。`ragEvidenceQuality.ts` 负责确定性的 clause segmentation 与 source-quality 特征：句末完整性、delimiter 平衡、数学 token 密度、长度合理性以及文档元叙述惩罚。`graphAnswerPlan.ts` 在 public claim shaping 前应用该策略，同时把原始 fragment 保留在 `evidenceRefs`；`answerReleaseReview.ts` 将相同评分作为不改变 relevance 主排序的 tie-breaker，`conversationComposer.ts` 只移除高语义相似度的 supplemental duplicate。

关键边界是 clause-local filtering。一个 fragment 同时包含 authoring preamble 和有效公式时，不再整体丢弃；如果没有任何安全 clause，则直接省略该 claim，不回退到不安全的 raw text。这样既保持图 coverage，又避免污染源主导公开回答。

该历史检查点的验证证据为：全量 Jest 124/124 个 suite、1,155 个测试通过、26 个跳过；最终 shaping 后的 graph-plan/release/coverage focused matrix 通过，TypeScript production build 通过，Water Glass conversation verifier 通过且 required claim ID 完整、无重复长 clause、无公开 Markdown 脚手架。下方运行时收口已取代此前 full 模式超时记录。

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

### 2026-07-19 repository-wide code-humanizer completion

The repository-wide pass covered `src/learning`, backend/core algorithms, frontend JavaScript/ES-module migration surfaces, NoteMD, and build/verification scripts. Three behavior-preserving pattern classes were completed as separate commits:

- Pattern #1: replaced two graph-window extraction implementations with one graph-fact owner;
- Pattern #1: replaced four identical NoteMD no-op reporter factories with `createNoopProgressReporter()`;
- Pattern #12: removed 20 backend comments that only narrated the following operation, while preserving relation-direction, probability, memory, fallback, mutation, and algorithm-invariant comments.

The final scan found no safe `_v2`/`_new` clone, dead export, try-import fallback, or single-implementation abstraction to remove. Script-local CLI parsers and process helpers require characterization tests before consolidation; frontend `.js`/`.mjs` duplication is part of the documented migration compatibility surface. Broad catches at filesystem, network, IPC, worker, and WASM boundaries were treated as boundary behavior and not silently changed.

Final evidence: every code cleanup commit passed the full Jest oracle; the final state is 123/123 suites, 1,149 passed, 26 skipped. TypeScript, production/Vite build, Diataxis, MkDocs, and `git diff --check` also passed.

### 2026-07-19 全仓 code-humanizer 完成状态

全仓复核覆盖 `src/learning`、backend/core 算法、前端 JavaScript/ES-module 迁移面、NoteMD 和构建/验证脚本，并以独立提交完成三种行为保持型清理：

- Pattern #1：把两份 graph-window 提取收敛为单一 graph-fact owner；
- Pattern #1：把四份相同的 NoteMD no-op reporter factory 收敛为 `createNoopProgressReporter()`；
- Pattern #12：删除 20 条只复述下一行操作的 backend 注释，同时保留关系方向、概率、内存、fallback、mutation 与算法不变量说明。

最终扫描没有发现可安全删除的 `_v2`/`_new` clone、dead export、try-import fallback 或单实现抽象。脚本内部 CLI parser 与进程 helper 需要先补 characterization test 才能合并；前端 `.js`/`.mjs` 重复属于已记录的迁移兼容面。文件系统、网络、IPC、worker 与 WASM 边界的 broad catch 被视为边界行为，没有静默改变。

最终证据：每个代码清理提交均通过全量 Jest oracle；最终状态为 123/123 个 suite、1,149 个测试通过、26 个跳过。TypeScript、production/Vite build、Diataxis、MkDocs 与 `git diff --check` 也均通过。

## 2026-07-19 Final Delivery Audit

### English

| Prior requirement | Current code evidence | Status | Trade-off / remaining risk |
|---|---|---|---|
| Use graph structure as an answer contract | `graphContextAssembler.ts` selects a bounded subgraph; `graphAnswerPlan.ts` carries node/edge provenance and omissions | Complete | Degree remains a discovery signal, never relevance proof |
| Make RAG execute the plan | `buildPlanDrivenRagAnswer()` realizes ordered required claims before supplemental fragments | Complete | Discourse fluency remains a measured quality concern, not a template requirement |
| Preserve multiple useful related nodes | Novelty deduplication plus confidence-based required status allows distinct same-role claims | Complete | Thresholds remain calibration policy, not semantic truth |
| Remove conflicting length quotas | No 900-character, six-sentence, or one-`direct_support` correctness limit remains | Complete | `public_surface_contraction` remains for compatibility but now governs structure/leakage hygiene |
| Enforce final coverage after revision | `preserveRequiredGraphAnswerClaims()` and `reviewGraphAnswerCoverage()` run across revision/final output | Complete | Matching is deterministic concept/polarity logic, not LLM entailment |
| Bound graph expansion | `resolveGraphExpansionPolicy()` permits one replayable step only for explicit deep/research intent | Complete | Autonomous multi-step exploration remains intentionally out of scope |
| Provide operator observability | Grounding Inspector projects plan, coverage, omissions, and expansion without exposing scaffolding in the answer | Complete | A separate inspector is preferable to polluting public prose |
| Reduce duplicated policy | `graphAnswerFacts.ts` and `createNoopProgressReporter()` own formerly duplicated behavior | Complete | Script-local helpers await characterization before consolidation |
| Shape dense source evidence | `ragEvidenceQuality.ts` segments and scores clauses; `graphAnswerPlan.ts` retains raw provenance | Complete | Deterministic heuristics require multilingual calibration and do not prove entailment |
| Prevent answer duplication | composer semantic dedup plus release literal/containment dedup | Complete | The `0.86` supplemental threshold needs corpus-backed multilingual calibration |

All implementation phases in this plan are complete. The next measurable engineering question is: **how should multilingual source-quality, semantic-deduplication, and readability thresholds be calibrated together so prose improves without losing required graph claims, preserving contradictions as distinct evidence, or weakening provenance?** The answer requires a versioned corpus and joint metrics, not another orchestration hierarchy or a restored length quota. Orchestration extraction from `KnowledgeLearningPlatform.ts` remains a future decision gate conditioned on a complete planned/reviewed-answer operation that removes caller knowledge; a pass-through owner is explicitly rejected.

### 中文

| 先前要求 | 当前代码证据 | 状态 | 权衡 / 剩余风险 |
|---|---|---|---|
| 把图结构作为回答契约 | `graphContextAssembler.ts` 选择有界子图；`graphAnswerPlan.ts` 保存节点/边 provenance 与 omission | 完成 | degree 仍只用于发现，不构成 relevance 证明 |
| 让 RAG 真正执行 plan | `buildPlanDrivenRagAnswer()` 先按顺序实现 required claim，再补充 fragment | 完成 | discourse 流畅度仍是可度量质量问题，不是模板要求 |
| 保留多个有价值关联节点 | 新颖性去重与基于置信度的 required 状态允许同 role 的不同 claim 共存 | 完成 | 阈值是校准策略，不是语义真值 |
| 移除冲突的长度配额 | 不再存在 900 字符、六句或单条 `direct_support` 正确性限制 | 完成 | `public_surface_contraction` 名称为兼容保留，当前只治理结构/泄漏卫生 |
| revision 后强制最终 coverage | `preserveRequiredGraphAnswerClaims()` 与 `reviewGraphAnswerCoverage()` 覆盖 revision/最终输出 | 完成 | matcher 是确定性的概念/极性逻辑，不是 LLM entailment |
| 限制图扩展 | `resolveGraphExpansionPolicy()` 只对显式 deep/research 意图允许一步可回放扩展 | 完成 | 自主多步探索有意不在默认范围内 |
| 提供 operator 可观测性 | Grounding Inspector 投影 plan、coverage、omission 与 expansion，不污染公开回答 | 完成 | 独立 inspector 优于把内部脚手架混入 prose |
| 收敛重复策略 | `graphAnswerFacts.ts` 与 `createNoopProgressReporter()` 统一原重复行为 | 完成 | 脚本局部 helper 需 characterization 后才能合并 |
| 整形密集源证据 | `ragEvidenceQuality.ts` 分句并评分；`graphAnswerPlan.ts` 保留 raw provenance | 完成 | 确定性 heuristic 仍需多语言校准，且不证明 entailment |
| 防止回答重复 | composer 语义去重加 release 字面/包含型去重 | 完成 | supplemental 的 `0.86` 阈值需要语料驱动的多语言校准 |

本方案全部实施 Phase 均已完成。下一项可度量的工程问题是：**如何联合校准多语言 source-quality、semantic-deduplication 与 readability 阈值，使 prose 改善，同时不丢失 required graph claim、不把冲突证据错误合并，并保持 provenance？** 这需要版本化语料和联合指标，而不是增加编排层或恢复长度配额。`KnowledgeLearningPlatform.ts` 的编排抽取是未来 decision gate，仍以完整 planned/reviewed-answer operation 能实际移除 caller knowledge 为前提；明确拒绝 pass-through owner。

## English - 2026-07-19 executable-plan correction

The previous closure confused plan projection with plan execution. The causal defect was the RAG early return in `buildScopedConversationAnswer()`: the RAG answer returned before `GraphAnswerPlan.claims` were consumed. A second defect marked only one claim per role as required, so distinct graph facts could disappear without failing coverage.

The corrected pipeline is: bounded evidence and subgraph assembly -> public claim shaping -> novelty-aware planning -> ordered required-claim realization -> supplemental RAG clauses -> release review -> required-plan-preserving revision -> final coverage review. RAG role completeness uses local claim-to-role matching, and citation validation accepts both RAG fragments and citation-backed plan evidence.

Runtime acceptance now fails unless final required claim IDs are covered and their normalized statements preserve plan order. Emitting a plan in trace is no longer sufficient. Clause-level segmentation and source-quality scoring are now implemented; the remaining risk is multilingual threshold calibration across readability, duplicate suppression, contradiction preservation, and graph coverage, not character ceilings or a default iterative-agent framework.

## 中文 - 2026-07-19 可执行 plan 纠偏

此前的阶段闭合把 plan 投影误认为 plan 执行。直接原因是 `buildScopedConversationAnswer()` 的 RAG 提前返回：`GraphAnswerPlan.claims` 尚未消费，RAG answer 就已返回。第二个缺陷是每种 role 只标记一条 required，因此同 role 的不同图事实即使消失也不会触发 coverage 失败。

修正链路为：有界 evidence/子图组装 -> 公开 claim 整形 -> 新颖性感知规划 -> 有序 required claim 实现 -> RAG clause 补充 -> release review -> 保留 required plan 的 revision -> 最终 coverage review。RAG role completeness 改为局部 claim-to-role 匹配，citation 校验同时接受 RAG fragment 与带 citation 的 plan evidence。

运行时验收现在要求最终 required claim ID 全覆盖，并要求规范化 statement 保持 plan 顺序；仅在 trace 中输出 plan 不再算完成。Clause-level segmentation 与 source-quality scoring 已落地；剩余风险是跨 readability、重复抑制、冲突保留和 graph coverage 的多语言阈值校准，而不是恢复字符上限或默认迭代 Agent 框架。

## 2026-07-19 Phase Closure

### English

The implementation plan is closed at 124/124 Jest suites, 1,155 passed, and 26 skipped. Focused graph/release/runtime tests passed 191/191; TypeScript, production/Vite build, Water Glass runtime acceptance, Diataxis, MkDocs, and diff hygiene passed. No planned Phase remains partially implemented.

Future work is deliberately separated from this closure: build a multilingual joint-quality corpus, calibrate the `0.86` supplemental dedup threshold and source-quality features, and consider orchestration extraction only when a complete operation boundary removes caller knowledge.

### 中文

本实施方案以 Jest 124/124 个 suite、1,155 个测试通过、26 个跳过收口。graph/release/runtime 定向测试 191/191 通过；TypeScript、production/Vite build、Water Glass 运行时验收、Diataxis、MkDocs 与 diff hygiene 均通过。不存在部分实施的计划 Phase。

后续工作与本轮收口明确分离：建立多语言联合质量语料，校准 supplemental 去重的 `0.86` 阈值和 source-quality feature；只有完整 operation 边界能移除 caller knowledge 时，才评估编排抽取。

## 2026-07-19 Multilingual Comparison Evidence Closure

### English

#### Root cause and code-vs-plan correction

The Water Glass compare runtime exposed that the earlier “phase complete” statement was too broad. The graph and RAG pack contained the material comparison, but the public planning path could still lose it through two mechanisms:

1. `ragContextPack.ts` used fixed head/tail middle truncation. A high-overlap Mermaid payload could occupy the selected window while equivalent prose later in the same section was truncated.
2. `graphAnswerPlan.ts` selected one public clause per fragment and inferred role from relation-edge context before the clause's explicit semantics. Dense comparison sections therefore allowed an unrelated optical comparison to consume the only claim slot, while a material comparison survived only as supplemental prose and was not protected by final coverage.

#### Implemented architecture

- `queryBackend.ts` and `ragContextPack.ts` reuse `graphClaimMatcher.semanticFeatures()`; multilingual retrieval and coverage no longer maintain divergent synonym tables.
- `ragPublicText.ts` owns fenced Markdown payload omission. Query-centered context windows score fence-external text and replace the deterministic head/tail baseline only when semantic/lexical coverage strictly improves within the existing character budget.
- `graphAnswerPlan.ts` ranks complete clauses, rejects dangling `vs.`/separator fragments, and can emit multiple distinct claims from one bounded source fragment. There is no new per-fragment claim-count quota; the existing evidence budget, relevance, completeness, and semantic novelty boundaries provide control.
- Explicit comparison semantics override generic traversal-edge roles for the public claim role, while edge ids remain in provenance.
- Compare planning derives both operands from the query, removes shared features, and measures candidate coverage of each branch. Clauses covering both requested branches outrank same-section clauses covering only the Water Glass/optics branch.
- Runtime acceptance uses the shared semantic feature owner to require `glass_material` and `plastic`, plus a required `contrast` role, final required-claim coverage, plan order, and negative checks for unrelated achromatic-lens/math-optimization prose.

#### Trade-offs and risks

- The evidence pack remains bounded; this is a model-input resource invariant, not an answer-length quota.
- Branch extraction is deterministic and currently strongest for explicit `compare X and/with/versus Y` and Chinese `比较/对比 X 与/和/跟 Y` forms. A versioned multilingual branch corpus is required before widening syntax heuristics.
- Semantic features prove calibrated concept overlap, not entailment. Numeric direction, negation, and contradiction must continue to be checked separately.
- English-query/Chinese-source answers can now pass semantically without renderer leakage, but language realization is still source-language dominant. A future synthesizer must preserve provenance and required claims rather than prepend canned bilingual labels.
- `KnowledgeLearningPlatform.ts` ownership remains unchanged; this fix stays with the existing retrieval, pack, planning, and verifier owners and does not justify a pass-through orchestration layer.

#### Verification checkpoint

- Focused graph/RAG/release matrix: 11/11 suites, 238/238 tests.
- Full Jest: 124/124 suites, 1,160 passed, 26 skipped (1,186 total).
- `npm run build:with-vite`: passed; existing non-module script warnings remain unchanged.
- Complete conversation runtime verifier: exited successfully; the focused `waterglass_compare_materials_en` probe also passed semantic concepts, required contrast, coverage/order, and irrelevant-clause negatives.
- Diataxis: 18 entries, 36 paths, 64 canonical references; MkDocs build passed.
- At this historical checkpoint, full restore mode (`--full`) was not closure evidence because prior runs exceeded the environment timeout. The 2026-07-23 runtime closure below supersedes this limitation.

#### Next direction

The remaining critical question is: **how should graph-branch coverage, multilingual language realization, claim novelty, and source-quality be calibrated together so completeness does not become evidence dumping?** The next implementation should introduce a versioned corpus and joint metrics before adding more heuristics, templates, or orchestration layers.

### 中文

#### 根因与代码-方案纠偏

Water Glass compare runtime 证明此前“全部 Phase 完成”的表述仍过宽。图与 RAG pack 中已经存在材料比较，但公开 planning 路径仍可能通过两个机制丢失它：

1. `ragContextPack.ts` 使用固定 head/tail middle truncation。高 overlap 的 Mermaid payload 可能占据窗口，而同 section 后面的等价 prose 被截断。
2. `graphAnswerPlan.ts` 每个 fragment 只选择一个 public clause，并优先按 relation-edge context 推断 role，而不是 clause 的显式语义。密集比较 section 因而可能让无关光学比较占用唯一 claim 槽位；材料比较即使作为 supplemental prose 出现，也不受最终 coverage 保护。

#### 已实施架构

- `queryBackend.ts` 与 `ragContextPack.ts` 复用 `graphClaimMatcher.semanticFeatures()`；多语言 retrieval 与 coverage 不再维护分叉的同义词表。
- `ragPublicText.ts` 统一负责 fenced Markdown payload omission。Query-centered context window 对围栏外文本评分，只有在既有字符预算内严格提升语义/词项覆盖时才替换确定性 head/tail 基线。
- `graphAnswerPlan.ts` 对完整 clause 排序，拒绝悬空 `vs.` / separator fragment，并可从一个有界 source fragment 发射多个不同 claim。不新增每 fragment claim 数量配额；控制来自既有 evidence budget、相关性、完整句与语义新颖性边界。
- 公开 claim role 优先服从显式比较语义，而 relation edge id 继续保留在 provenance。
- Compare planning 从查询中推导两侧 operand，去掉共享 feature，并计算 candidate 对每个 branch 的覆盖。同一 section 中只覆盖 Water Glass / optics 一侧的 clause 不再压过同时覆盖两种容器材料的 clause。
- Runtime acceptance 复用共享语义 feature owner，要求 `glass_material`、`plastic`、required `contrast` role、最终 required-claim coverage、plan order，并拒绝无关的消色差透镜 / 数学优化 prose。

#### 权衡与风险

- Evidence pack 继续有界；这是 model input 的资源不变量，不是回答长度配额。
- Branch extraction 是确定性逻辑，目前最适合显式 `compare X and/with/versus Y` 与中文 `比较/对比 X 与/和/跟 Y`。扩大语法前需要版本化多语言 branch corpus。
- Semantic feature 只能证明经校准的概念 overlap，不证明 entailment；数值方向、否定和矛盾仍需独立校验。
- 英文查询 + 中文来源现在可以在不泄漏 renderer payload 的情况下通过语义验收，但 language realization 仍偏向来源语言。未来 synthesizer 必须保留 provenance 与 required claim，不能简单添加固定双语标签。
- `KnowledgeLearningPlatform.ts` owner 保持不变；本次修复落在既有 retrieval、pack、planning 与 verifier owner 内，不构成增加 pass-through 编排层的理由。

#### 验证检查点

- graph/RAG/release focused matrix：11/11 suites，238/238 tests。
- 全量 Jest：124/124 suites，1,160 passed，26 skipped（共 1,186）。
- `npm run build:with-vite`：通过；既有 non-module script warning 未变化。
- 完整 conversation runtime verifier：成功退出；定向 `waterglass_compare_materials_en` 同时通过语义概念、required contrast、coverage/order 与无关 clause 反例。
- Diataxis：18 entries、36 paths、64 canonical references；MkDocs build 通过。
- 在该历史检查点，Full restore mode（`--full`）因超过环境 timeout 未作为收口证据。下方 2026-07-23 运行时收口已取代此限制。

#### 后续方向

剩余核心问题是：**如何联合校准 graph branch coverage、多语言 language realization、claim novelty 与 source-quality，使完整性不退化为 evidence dumping？** 下一步应先建立版本化语料与联合指标，再增加 heuristic、模板或编排层。

## 2026-07-23 Runtime Closure and Verifier Isolation

### English

The full runtime verifier is now closure evidence. `/api/build` and `/api/restore-cache` accept a validated `relationRecomputeMode` of `none`, `incremental`, or `full`; product routes default to `incremental`, while the verifier selects `none` for targets with at least 100 Markdown documents and keeps `incremental` for small graph fixtures. This avoids unbounded inferred-relation recomputation during stress verification without weakening ordinary product ingestion or small-target graph coverage.

The verifier isolates cases by identical `preloadTargets`. Each group runs in a fresh Node/server process, reuses its target build inside the group, and preserves cross-target scope recovery where a case declares multiple preload targets. This closes a state-contamination failure mode in which 92 cases accumulated unrelated atoms in one platform instance, grew the heap beyond 1 GB, and caused a conversation timeout after build completion. A longer HTTP timeout would only hide that causal defect.

The public graph profile formatter was tightened at the same boundary: degree and graph connectivity remain available, but internal diagnostic phrases such as `immediate predecessors` and `likely next nodes` are rendered as upstream/downstream evidence. The graph remains visible in the answer without leaking planner terminology.

Closure evidence:

- Full verifier: `node scripts/verify-knowledge-workspace-runtime.js --full` passed with 55 isolated preload-target groups and 92 conversation regression cases.
- Large-target policy: `financial` (513 Markdown files) and `waterglass` (214 Markdown files) used `none`; six-document and smaller graph fixtures used `incremental`.
- Route contract: default, explicit `none`, and invalid mode rejection are covered by `src/routes/data.test.ts`.
- Final oracle: 125 Jest suites passed, 1,172 tests passed, and 26 skipped; TypeScript and `npm run build:with-vite` passed after the formatter and route changes. The full runtime verifier also passed with 55 isolated preload-target groups and 92 conversation cases.

The remaining measurable question is unchanged: jointly calibrate multilingual source quality, semantic novelty, branch coverage, and readability without allowing completeness to become evidence dumping. No additional orchestration layer or public length quota is justified by this closure.

### 中文

完整运行时验证器现已成为收口证据。`/api/build` 与 `/api/restore-cache` 接受经过校验的 `relationRecomputeMode`：`none`、`incremental`、`full`；产品路由默认仍为 `incremental`，验证器对至少 100 个 Markdown 文件的大 target 选择 `none`，对小型图 fixture 继续使用 `incremental`。这避免压力验证期间无界的 inferred relation 重算，同时不削弱产品默认 ingestion 或小 target 的图关系覆盖。

验证器按相同的 `preloadTargets` 隔离 case。每组在新的 Node/server 进程中运行，组内复用 target 构建；case 声明多个 preload target 时仍保留跨 scope 恢复语义。这样关闭了 92 个 case 在同一 platform 实例累积无关 atom、堆增长超过 1 GB、构建完成后会话超时的状态污染问题。单纯延长 HTTP timeout 只会掩盖因果缺陷。

公开图 profile formatter 也在同一边界收紧：入度、出度与图连接事实继续可用，但 `immediate predecessors`、`likely next nodes` 等内部诊断措辞改为用户可读的 upstream/downstream evidence。图结构仍进入回答，但不泄漏 planner 术语。

收口证据：

- 完整验证器：`node scripts/verify-knowledge-workspace-runtime.js --full` 通过，共 55 个隔离 preload-target 组、92 个会话回归 case。
- 大 target 策略：`financial`（513 个 Markdown 文件）与 `waterglass`（214 个 Markdown 文件）使用 `none`；六文件及更小的图 fixture 使用 `incremental`。
- 路由契约：默认模式、显式 `none` 和非法模式拒绝由 `src/routes/data.test.ts` 覆盖。
- 最终 oracle：125 个 Jest suite 通过、1,172 个测试通过、26 个跳过；formatter/路由修改后的 TypeScript 与 `npm run build:with-vite` 均通过。完整运行时验证器也通过，共 55 个隔离 preload-target 组、92 个会话 case。

剩余可度量问题不变：联合校准多语言 source quality、semantic novelty、branch coverage 与 readability，避免完整性退化为 evidence dumping。此次收口不支持增加新的编排层，也不支持恢复公开回答长度配额。

## 2026-07-23 Joint Quality Calibration Phase

### English

The next measurable phase is now implemented as a versioned, deterministic calibration contract rather than an informal future task.

- `graphAnswerQualityPolicy.ts` is the single owner of `GRAPH_ANSWER_QUALITY_POLICY_VERSION`, the `0.86` supplemental dedup threshold, polarity compatibility, and numeric-fact compatibility. Both composer supplemental deduplication and graph-plan same-role redundancy use the same safety invariant; their relevance thresholds remain intentionally separate (`0.86` versus the existing `0.72` plan threshold).
- The policy's v2 numeric guard preserves signed values, common English/Chinese measurement units, and date components before semantic similarity can merge claims. An empty calibration dimension now reports `corpus_empty:<dimension>` and fails the joint gate instead of treating missing evidence as 100% accuracy.
- `graphAnswerQualityCalibration.ts` owns `DEFAULT_GRAPH_ANSWER_QUALITY_CORPUS` and `evaluateGraphAnswerQualityCalibration()`. The corpus reports coverage, source-quality pairwise ranking, semantic deduplication, comparison branch recall, query/answer language consistency, and readability as separate metrics with exact failed case IDs.
- Source-quality calibration reports the minimum preferred-vs-rejected score margin. Deduplication reports the active similarity threshold and preserves contradictions or changed numeric facts. Readability reports its accepted score floor and minimum observed score.
- The report fails closed when the corpus version drifts from the production policy. A green aggregate cannot hide a dimension-specific failure.
- `graphAnswerPlan.ts` now retains polarity-opposed claims instead of dropping them through generic same-role semantic deduplication.

The calibration corpus is intentionally a measurement owner, not a runtime synthesizer. Language consistency currently measures query/answer alignment and exposes source-language dominance; it does not silently rewrite answers or introduce canned bilingual labels. Likewise, source-quality scores and semantic similarity are ranking signals, not entailment proofs.

Verification for this phase:

- Red-green TDD covered policy polarity/numeric guards, version drift, six calibration metrics, and graph-plan contradiction preservation.
- Focused graph-plan, calibration, composer, and release suites: 105 tests passed.
- Final repository oracle: 126 Jest suites passed, 1,179 tests passed, and 26 skipped; TypeScript and `npm run build:with-vite` passed; the full runtime verifier passed 55 isolated preload-target groups and 92 conversation cases. No new orchestration hierarchy or public length quota is part of this phase.

### 中文

下一项可度量阶段现已实现为版本化、确定性的校准契约，而不是停留在 future task 描述。

- `graphAnswerQualityPolicy.ts` 是 `GRAPH_ANSWER_QUALITY_POLICY_VERSION`、`0.86` supplemental dedup threshold、polarity compatibility 与 numeric-fact compatibility 的唯一 owner。composer supplemental dedup 与 graph-plan 同 role redundancy 共用同一安全不变量；两者 relevance threshold 仍有意分离（`0.86` 与既有 plan `0.72`）。
- Policy v2 的 numeric guard 会在 semantic similarity 合并 claim 前保留带符号数值、常见中英文测量单位和日期分量。空 calibration dimension 会报告 `corpus_empty:<dimension>` 并使联合门禁失败，不再把缺失证据当成 100% accuracy。
- `graphAnswerQualityCalibration.ts` 持有 `DEFAULT_GRAPH_ANSWER_QUALITY_CORPUS` 与 `evaluateGraphAnswerQualityCalibration()`。语料分别报告 coverage、source-quality pairwise ranking、semantic deduplication、comparison branch recall、query/answer language consistency 和 readability，并给出精确失败 case ID。
- Source-quality calibration 报告 preferred 与 rejected 的最小 score margin；deduplication 报告当前 similarity threshold，并保留冲突或数值变化事实；readability 报告 accepted score floor 与最小观测分。
- 当 corpus version 与 production policy 漂移时，报告 fail closed；aggregate green 不能掩盖某个维度的失败。
- `graphAnswerPlan.ts` 现在保留 polarity 相反的 claim，不再通过通用同 role semantic dedup 静默丢弃。

校准语料是 measurement owner，不是 runtime synthesizer。Language consistency 当前测量 query/answer 对齐，并显式暴露来源语言主导问题；它不会静默改写回答，也不会注入固定双语标签。同样，source-quality score 与 semantic similarity 只是排序信号，不是 entailment 证明。

本阶段验证：

- 红-绿 TDD 覆盖 policy polarity/numeric guard、version drift、六项 calibration metric 与 graph-plan contradiction preservation。
- graph-plan、calibration、composer、release 定向 suite：105 个测试通过。
- 最终仓库 oracle：126 个 Jest suite 通过、1,179 个测试通过、26 个跳过；TypeScript 与 `npm run build:with-vite` 通过；完整 runtime verifier 通过 55 个隔离 preload-target 组和 92 个会话 case。本阶段不增加新的编排层，也不恢复公开回答长度配额。
