# 解释：开发进度看板

本页是“知识彻底掌握演进方案”的实现侧进度看板。
它用于回答三件事：哪些能力已落地、哪些关键缺口仍在、如何用代码与运行时证据验证推进结果。

## 2026-07-05 RSE + document augmentation 图谱 RAG 实践计划

本切片现在记录更充分 Knowledge Workspace 回答的实现进展。具体方案仍以 [RSE document-augmented graph RAG answer pipeline](../../../plans/2026-07-05-001-feat-rse-document-augmented-rag-plan.md) 为准，但当前分支已经不只是规划：确定性的 RSE / document augmentation 链路、完整文档感知的图邻居 augmentation、query-intent 图邻居排序、intent-aware graph connection-path 排序、有界 context pack、稳定 RAG context replay id、接入 provider 的充分性 trace、有界一次性 recovery、RAG failure-stage classification、RAG-aware 单消息 release review、claim-level citation-backed RAG release gate、public RAG clause 的 prompt / preamble artifact 过滤、answer claim-to-citation trace / export 映射、基于 operand 的 compare answer-profile 预算、how-to answer-profile 预算、generic answer-profile 排序、Mermaid label evidence 抽取、runtime verifier 字段、graph successor-window verifier 断言、context-budget truncation/drop/malformed-provider/timeout-provider/graphintent 探针覆盖、前端 compact RAG 状态，以及导出 RAG trace 保留已经落地。图置信阈值校准、大语料上的更完整 replay tooling、对 label-heavy evidence 的自然语言 synthesis、更广的 release-budget 校准和更大的 runtime probe 语料仍是后续工作。

当前代码 / 方案对齐判断：

| 要求 / 先前预期 | 当前分支代码证据 | 进度判断 |
|---|---|---|
| RSE 应从精确命中片段开始，而不是直接召回大段文档 | `src/learning/queryBackend.ts` 与 `src/learning/KnowledgeLearningPlatform.ts` 已经返回 evidence span、citation、relation path、query variant 与 scoped recovery trace；`src/learning/evidenceContextAssembler.ts` 现在从这些 span 出发，而不是 dump 整篇文档。 | 确定性路径已实现 |
| document augmentation 应恢复足够的源文档上下文来支撑完整回答 | `evidenceContextAssembler.ts` 现在通过平台边界读取被选中源文档的完整内容，保留 direct support，补入 parent / adjacent context，去重重叠窗口，产出完整文档感知的图邻居支撑 fragment，并在无法恢复源文本时标记 `source_window_unavailable`。 | 确定性路径已实现 |
| 图上下文应使用入度/出度与邻居内容，而不是只显示邻居标题 | `KnowledgeLearningPlatform.agentConversation()` 现在会物化选中的图邻居 item，并让 evidence assembler 同时生成 snippet 级与完整文档感知的 `graph_neighbor_support` fragment。`graphContextAssembler.ts` 现在会在 evidence assembly 之前，基于 query intent scoring policy、relation kind priority、confidence / provenance scoring、anchor-equivalent 过滤与 bibliography 排除来排序 predecessor / successor window 和 connection path。 | 确定性路径已实现，仍需大语料校准 |
| 用户只应看到一条回答，编排留在后端 | `conversationComposer.ts` 现在会把 `ragContextPack` 与 `ragSufficiencyReview` 传入 `answerReleaseReview.ts`；release review 可以基于 direct、document、graph fragment 修订或增强公开回答，同时把编排细节留在 trace / status surface，并且 `rag_claim_citation_support` 会在句子级公开 claim 不能被带 citation 的 RAG fragment 支撑或只能弱支撑时触发收缩。compare-intent RAG 回答现在会抽取 operand，避免把显式 scope 硬收窄到仅 title-hit document id，为双方预留 4 个 direct-support clause，按 operand / fragment 覆盖度排序证据，并在加入 graph contrast context 前把 Mermaid 对比 label 转为可读证据。how-to 回答现在会为 ordered steps、prerequisites、downstream checks 与 failure handling 预留 direct / document / graph 预算，而不是压缩成泛化概览。generic 回答现在会按 query-term 覆盖度排序，并使用 2 个 direct-support slot，让宽泛问题优先保留真正相关的 grounded clause，而不是泛化 preamble。`KnowledgeLearningPlatform.ts` 现在会记录可选 `answerClaimCitations`，把公开回答 claim 映射到 citation id、RAG fragment id 与 source path，供 trace / export 审计；`agent_workspace.js` / `workspace_panes.js` 显示 compact 状态，而不是追加聊天消息。 | 已保持并增强 |
| LLM judging 应提升回答完整性 | `ragSufficiencyJudge.ts` 已有确定性 gate 与可注入的可选 LLM judge hook；`ragSufficiencyProviderJudge.ts` 现在通过现有 `LlmProviderClient` / NoteMD settings 边界完成 adapter 接入，包含严格 JSON 解析、timeout、无重试和 reviewer catch path 的确定性 fallback；malformed completion text 现在会在 adapter 边界 reject，因此 `llm_judge_failed:*` 可回放。`KnowledgeLearningPlatform.agentConversation()` 现在会在首轮 pack 可恢复地 borderline / insufficient 时，最多执行一次有界 recovery assembly / review。 | Unit 5 已实现 |
| 弱证据应显式降级 | `RagSufficiencyReview` 现在记录 `sufficient`、`borderline` 或 `insufficient`，并带有 `partial_coverage`、`conflict`、`insufficient_evidence` 等降级状态；前端 evidence pane 会显示 compact 状态。 | 确定性 review 已实现 |

现在的架构 owner 更清晰：

- `queryBackend.ts` 继续作为精确 RSE 与 hybrid ranking owner。
- `evidenceContextAssembler.ts` 持有 source-window、parent-section、adjacent-context、完整文档 source-boundary 读取、图邻居 source expansion 和 missing-source 降级。
- `ragContextPack.ts` 持有 model-visible 硬上限、role priority、middle truncation、budget decision，以及已选证据包的稳定 replay id。
- `ragSufficiencyJudge.ts` 持有确定性充分性判断与可选 judge 接入点。
- `ragSufficiencyProviderJudge.ts` 持有 NoteMD provider adapter，用于有界 JSON-only 充分性评审。
- `KnowledgeLearningPlatform.ts` 负责 source resolution、图邻居物化、一次性 RAG recovery、failure-stage classification、answer claim-to-citation trace 映射、trace/artifact 持久化和 conversation response 装配。
- `conversationComposer.ts` 负责基于结构化 pack 生成单条 public answer draft。
- `answerReleaseReview.ts` 负责 public-surface contraction、RAG answer completeness、claim-level citation-backed RAG release gate、prompt / preamble artifact 过滤与最终公开回答修订。
- `agent_workspace.js` 与 `workspace_panes.js` 在 API status / evidence surface 展示 compact RAG 健康状态，不把 raw fragment 渲染进聊天。

对用户提出方案的关键修正不变：“命中点前后各五段”只是局部扩展启发式，不是最大 source 读取范围。最大 source 边界是每个被选直接证据或图邻居知识点对应的完整 scoped document；真正的硬上限属于 model-visible `RagContextPack`。当前实现遵循 small-to-big 形状：先保留 direct span，再基于完整文档 source 视图选择 parent / adjacent context，最后在 graph context 提供可用 id 时补入完整文档感知的图邻居证据。

本切片新增实现证据：

- 新增模块：`src/learning/evidenceContextAssembler.ts`、`src/learning/ragContextPack.ts`、`src/learning/ragSufficiencyJudge.ts`、`src/learning/ragSufficiencyProviderJudge.ts`。
- 新增 / 更新测试：evidence assembler、context pack budgeter、稳定 context replay id、sufficiency judge、接入 provider 的 sufficiency judge adapter、有界 recovery、RAG failure-stage classification、answer claim-to-citation trace 映射、RAG-aware claim release gate、RAG-aware release review、持久化兼容、composer、平台集成、导出 RAG trace 保留、Knowledge Workspace conversation regression、runtime verifier 校验，以及前端 RAG grounding 展示。
- `scripts/verify-knowledge-workspace-runtime.js` 现在能校验期望 RAG source boundary、有效 `ragctx_*` replay id、roles、answer terms、sufficiency statuses、deterministic/no-provider judge 标志、recovery 标志、degradation state、required RAG failure stages、RAG source-decision status 最小计数、按 role 统计的 full-document fragment 最小计数、recovery 前 source-decision status 最小计数、recovery 前 reason fragment，以及 graph successor-window 预期；同时支持按用例配置 scoped document-id 预期、按用例传递 `topK`、隔离临时 NoteMD config、本地 malformed-provider fixture，默认严格要求 scoped id，并对 answer term 做大小写不敏感匹配。
- `src/frontend/agent_workspace.js` 会把仅含 RAG trace 的 payload 标记为可 inspect；API 状态行显示 `RAG: <status>, <N> fragments`，并在本回合使用 recovery pass 时追加 `+recovered`。
- `src/frontend/workspace_panes.js` 显示 compact RAG context metrics：replay id、sufficiency、source boundary、fragment budget、direct/document/graph roles、truncated/dropped/unavailable source counts、degradation、recovery、reasons 与 failure stages。
- `src/learning/KnowledgeLearningPlatform.ts` 现在会为最终公开回答的 claim 生成可选 `answerClaimCitations` 记录，`src/export/WorkspaceExportBundle.ts` 会 deep-clone 这些记录，因此 replay / export 消费者可以检查 citation、fragment 与 source-path grounding，而不把编排暴露进聊天正文。
- `src/learning/answerReleaseReview.ts` 现在会执行 `rag_claim_citation_support`，因此句子级公开 RAG claim 必须先被带 citation 的 fragment 支撑才能 release；无支撑或弱支撑 claim 会触发现有 RAG-grounded revision 路径。
- `src/learning/answerReleaseReview.ts` 现在会在 RAG-grounded 公开修订前过滤“所有推理过程”“最终输出语言”等 prompt / preamble artifact，避免非知识性前言进入用户答案。
- `waterglass` compact / spaced 两个运行时探针现在要求 failed release gates 同时包含 `query_intent_alignment` 与 `rag_claim_citation_support`，并拒绝公开答案中出现 `所有推理过程`、`最终输出`、`遵从您的指示`、`all reasoning`、`final output` 等 prompt / preamble artifact。
- `src/learning/graphContextAssembler.ts` 现在应用 intent-specific graph-window 和 connection-path scoring：compare query 可以让 contrast / analogy 邻居优先于 procedural sequence / application 路径，即使 procedural 边置信度更高；definition 与 how-to query 则保留各自的结构优先级。
- `src/learning/KnowledgeLearningPlatform.ts` 现在可以识别 `compare X and/with/to Y`、`X vs Y`、`difference between X and Y`、`X differs from Y` 等 compare operand，并且不会把显式 scope 只收窄到 title-hit document id。
- `src/learning/conversationComposer.ts` 现在应用 compare RAG answer profile：当 context pack 同时包含被对比双方的 direct support 时，公开回答会保留 4 个 direct-support clause，按 operand 与 query term 覆盖度排序 compare evidence，把 Mermaid label evidence 转为可读 clause，再加入有界 graph-neighbor contrast context，同时不额外产生聊天消息。
- `src/learning/conversationComposer.ts` 现在应用 how-to RAG answer profile：公开回答会保留 3 个 direct-support sentence、1 个 document-context sentence 与 2 个 graph-neighbor sentence，因此过程型问题可以在一条有界公开回答中保留步骤、前置条件、下游验证与失败处理。
- `src/learning/conversationComposer.ts` 现在应用 generic RAG answer profile：直接证据会按 query-term 覆盖度排序，避免同一 fragment 中没有 query 信号的 preamble 因为共享 fragment 而压过真正证据。
- runtime probe `waterglass_compare_materials_en` 现在验证 `compare water glass and plastic cup` 会从 `Knowledge_Base/waterglass/water glass.md` 返回 glass 与 plastic 两侧证据，并覆盖 `full_document` source boundary 以及 direct / document / graph 角色。
- runtime probe `contextbudget_source_window_truncation_en` 现在验证 `what is context budget probe?` 会从 `Knowledge_Base/contextbudget/context budget probe.md` 读取 scoped 完整源文档，同时在 model-visible `RagContextPack` 中记录 `fragment_truncated` source decision。
- runtime probe `contextoverflow_no_provider_budget_drop_en` 现在验证 `what is overflow budget probe?` 在未使用 LLM judge 时仍保持 deterministic，并在最终有界 `RagContextPack` 中记录 `fragment_dropped`；当 recovery 实际发生时，recovery source-decision 计数会继续保留在 `ragRecovery` 中。
- runtime probe `contextoverflow_malformed_provider_judge_fallback_en` 现在验证本地 malformed OpenAI-compatible judge response 不会阻塞主回答链路：fixture 会被调用一次，首轮 review 会在 `ragRecovery.beforeReasons` 中记录 `llm_judge_failed`，最终 recovered answer 仍保持 deterministic 与有界。
- runtime probe `contextoverflow_timeout_provider_judge_fallback_en` 现在验证延迟响应的本地 OpenAI-compatible judge 会通过有界 provider-judge 路径超时：fixture 会被调用一次，`ragRecovery.beforeReasons` 会记录 `llm_judge_failed:RAG sufficiency judge timed out.`，最终 recovered answer 仍保持 deterministic 与有界。
- runtime probe `graphintent_compare_neighbor_selection_en` 现在验证 `compare brittle glass vessel with polymer cup material behavior` 会从 `Knowledge_Base/graphintent` 选择 analogy graph successors，从 `successorWindow` 排除高重叠 procedural successor，保留 `graph_neighbor_support`，至少包含一个 `full_document` 图邻居支撑 fragment，并且不会把 procedural path 泄漏进公开回答。

后续推进：

- 基于代表性 hard negative 校准图关系权重与低置信排除阈值，不把当前 scoring 常量当作最终形态。
- 在当前 `graphintent` intent-selection 基线之上，继续扩展大语料 hard negative 与关系抽取歧义样本的 runtime probes。
- 在当前 deterministic definition / compare / how-to / generic 基线之上继续校准 profile-specific release budget，同时保留公开回答硬上限。
- 在稳定 context id、failure-stage classification 与 answer claim-citation map 之上扩展 replay tooling，并补齐 repeated snippet、conflicting adjacent evidence、missing graph-neighbor evidence、更严格的 total-character budget drop、provider fallback 的更大 runtime probes。

## 2026-07-04 知识工作区 scope 可见性、聚合 RAG 回答与命中文件交互收口

本次切片回应的是当前知识工作区的可用性与检索质量缺口：scope 技术上存在，但视觉位置脱离真实提问流程；命中结果返回后，提问/回答区容易显得不可达；命中卡片曾过早暴露次级操作，收起后又容易把操作藏到不可发现手势里；`what is water glass?` 这类定义型问题仍没有充分释放聚合证据、图邻域和 document augmentation。
当前实现保持向前兼容：既有 payload 字段与 capability 动作仍然有效，但主 UI 契约被收口为更简单的路径：在对话 pane 内选择 scope，提问，点击一个命中文件名，再到右侧查看已高亮的命中段落。

当前代码已经成立的事实：

- `src/frontend/index.html` 现在把 `agent-scope-control--workspace` 放入左侧知识工作区 conversation pane，位置在 learner id、消息、命中文件与 composer 之前。scope 不再只是 toolbar 附属控件或隐藏请求载荷。
- `src/frontend/styles.css` 将 drawer toolbar 收口为标题与关闭按钮，并为 chat pane 增加稳定的 scope、消息历史、命中文件、composer、动作区与 API 状态 grid 行。conversation stream 与命中文件列表继续保持独立滚动；外层 workspace shell 现在在桌面与移动端都有纵向滚动兜底，因此命中返回后不会把提问区和 composer 挤出可达范围。
- `src/frontend/workspace_panes.js` 的知识命中列表以文件名按钮为主视图，同时恢复低强调 `.agent-knowledge-actions` 兼容操作条，保留 `学习路径` 与 `聚焦`；固定 44px 的 `...` 操作入口、长按、右键和键盘菜单继续兼容，并且都复用同一组 action 定义。
- 点击命中文件后，右侧 graph-focus pane 会以 source path / citation / matched span provenance 渲染 Markdown，在命中段落内做 inline highlight，并把第一处主命中滚入视野。
- `src/frontend/agent_workspace.js` 将 RSE、document augmentation、图上下文、记忆召回、readiness 与 scope recovery 等编排细节保留在后端结果元数据和 status/evidence surface 中。聊天流只呈现该回合面向用户的一条 assistant 消息，structured-answer markdown 小节继续保留在后端 payload 中，但不再作为可见编排说明渲染到聊天气泡里。
- `src/learning/queryBackend.ts` 现在允许本地向量后端复用全局索引，但候选打分和 ANN 过滤必须落回当前 scope；当全局 ANN 候选全部越界时，会退回 scoped full scan。
- `src/learning/graphContextAssembler.ts` 现在会对同一个聚合知识点下的所有命中 atom 查询前驱/后继边，再对图窗口去重，并把结构性邻居排在 bibliography/reference 类节点之前；这修复了真实关系挂在次级命中 atom 上时图上下文变薄或变错的问题，也避免 `参考文献` 在定义回答的后继分支文案中压过真正的语义邻居。
- `src/learning/answerReleaseReview.ts` 现在会让定义型意图的修订回答保持简洁但更完整：它可以释放同一知识点的 document augmentation 标题、有界证据摘要与有界图邻域，而不是把 scoped answer 压缩成一句泛化定义。
- `src/learning/conversationComposer.ts` 与 `answerReleaseReview.ts` 现在会防止缺失 graph-degree profile 时输出 `NaN incoming/outgoing`；两个公开回答路径都会过滤与 anchor 等价的图邻居、按可见标题去重 graph window，并在用户可见回答前归一化 `(mermaid block)` 这类解析产物标题。
- `src/learning/KnowledgeLearningPlatform.ts` 新增 `warmQueryBackend()`，`src/server.ts` 在启动和 `/api/knowledge/state` 后台预热知识查询后端；这降低首次打开知识工作区时的检索冷启动噪声。
- `src/learning/KnowledgeLearningPlatform.ts` 还新增只读 `previewLearningPath()` 路径，`src/server.ts` 的 `/api/knowledge/path` 使用该路径，因此 Learning Path 预览不会触发同步 snapshot 持久化；需要耐久 artifact 的写路径仍保留 `buildLearningPath()` 行为。
- `src/frontend/agent_workspace.js` 现在会对首个命中知识点预热 Learning Path，并用一个有界的 16 项、2 分钟 TTL preview cache 复用结果；通用 `build_learning_path` capability 路径和直接 `openLearningPath()` 路径共用该缓存，因此首次可见点击可以复用已完成或进行中的预览请求，而不是重复启动后端工作。
- `queryKnowledge()` 不再对只读查询结果调用 `persistIfNeeded()`。写操作仍在 ingest、会话、配置和其他真实状态变更路径持久化，读路径不再重写巨大 graph snapshot。
- 参考实现对比已经体现在边界设计中：`ref/codex` 要求 model-visible context 必须有界、结构化并有硬封顶；`ref/enterprise_agent_platform` 将 RAG 定义为可回放证据管线（`retrieve` -> `rerank` -> `assemble_context` -> `generate_answer` -> `verify_citations`）。知识工作区把这些编排细节留在后端 trace / release-review payload，聊天表面只接收一条公开回答。

代码 / 方案对齐：

| 要求 | 当前实现证据 | 进度判断 |
|---|---|---|
| 知识工作区内必须默认展示并可切换 scope | `index.html` 将 scope selector 放在 `agent-chat-pane` 内；`src/agent_workspace.frontend.test.ts` 验证 selector 位于 `.agent-scope-control--workspace`，并且选中 scope 会进入 conversation request。 | 已实现 |
| 返回命中后，提问与回复窗口仍必须可见 | 前端布局回归 `partitions conversation and knowledge hit scrolling so the composer remains reachable` 现在同时固定内部滚动分区与外层 shell 纵向滚动兜底。 | 已实现 |
| 命中内容只优先显示可交互知识点文件名，同时保持 Learning Path / 聚焦可发现 | `workspace_panes.js` 的 `renderKnowledgePoints` 渲染 file-first button，恢复带 `data-capability-action-id` 的兼容 `.agent-knowledge-actions` 操作条，并保留 44px 菜单入口；测试验证操作条和菜单都暴露同一组 `学习路径` / `聚焦` action 定义。 | 已实现 |
| 一个 conversation turn 应只产生一条用户可见回答，编排细节留在后台 | `agent_workspace.js` 将 grounding state 发布到 `__NC_LAST_AGENT_CONVERSATION_GROUNDING` 供 status/evidence pane 使用；前端测试验证 streamed answer 只出现一次，不会追加 `Grounding: scope=...` assistant/system 消息，并且后端 structured markdown 继续留在 result payload 而不是聊天气泡里。 | 已实现 |
| 点击知识点后应在右侧高亮命中段落 | `normalizes citation-backed knowledge hits before opening graph focus` 现在验证 source 渲染、matched-span highlight、primary-highlight 标记，以及 `scrollIntoView({ block: 'center', inline: 'nearest' })`。 | 已实现 |
| 同一知识点不应重复拆成多个主列表项 | conversation grouping 与 matched-span provenance 将同源命中收束到同一知识点；graph context 现在会跨该知识点下所有聚合 atom 展开，而不重复主命中列表。 | 已实现基线，后续继续压测大语料重复片段 |
| RAG 应基于 RSE 与 document augmentation 提升回答质量 | scoped retrieval 以文档/知识点为返回单位；answer release 在修订或增强公开回答时会保留定义证据、document augmentation 标题与有界前驱/后继图上下文，同时过滤解析产物和与 anchor 等价的图邻居。 | 已实现更强基线 |
| 首次点击 Learning Path 不应被持久化阻塞，也不应重复启动后端工作 | `/api/knowledge/path` 现在使用 `previewLearningPath()`，耐久 artifact 记录仍保留在 `buildLearningPath()`；`agent_workspace.js` 会预热首个命中知识点，并在通用 capability 路径复用有界 preview cache。 | 已实现 |
| 首问不能被读路径持久化拖慢 | `queryKnowledge()` 移除 read-only persist；最新 `what is waterglass?` scoped runtime 探针返回 `ok: true`，聚合到一个 `Knowledge_Base/waterglass/water glass.md` 知识点、6 条引用，并返回直接定义回答，而不是先前的 scoped-miss 回复。 | 已修复 |

2026-07-04 当日新鲜验证证据：

- `rtk npm.cmd exec -- jest src/agent_workspace.frontend.test.ts --runInBand`
- `rtk npm.cmd exec -- jest src/learning/KnowledgeLearningPlatform.test.ts src/learning/graphContextAssembler.test.ts src/learning/conversationComposer.test.ts src/learning/answerReleaseReview.test.ts --runInBand`
- `rtk npm.cmd run build`
- `rtk npm.cmd run build:vite`
- `rtk node scripts/verify-knowledge-workspace-runtime.js --target waterglass --query "what is waterglass?"`

相对先前方案链的架构推进判断：

| 先前预期 | 2026-07-04 当前结论 | 进度判断 |
|---|---|---|
| Knowledge Workspace 的 scope 必须成为窗口内显式任务状态 | scope 现在位于用户提问与查看命中的 conversation pane 内；如果运行中的 Tauri 窗口仍看不到，优先判断为 dev sidecar / WebView 仍加载旧构建或未刷新，而不是源码缺失。 | 实现已在当前构建中成立 |
| RAG 命中应按知识点返回并突出命中片段 | 文件名主列表 + 右侧 source-highlight pane 已成立，并包含主命中滚入视野；后续重点是继续压测同一文档内多段命中的排序和折叠。 | 基线已实现 |
| RSE/document augmentation 应提升公开回答而不只是进入诊断 | 定义型意图修订现在会在保持简洁的同时加入同知识点 augmentation 标题与有界图邻域；当存在更强结构性邻居时，bibliography/reference 类窗口会被过滤出公开图邻域措辞。 | 更强基线已实现 |
| API 状态必须让用户判断可用性与稳定性 | 后台 hydration / query backend warmup 已进入 server lifecycle；前端状态条已由 conversation 成功调用更新。下一步应把 warmup latency、backend id、scope readiness 更直接地暴露给普通用户。 | 后端基础已实现，UI 状态仍可增强 |
| 查询与预览链路必须鲁棒且向前兼容 | 读查询和只读 path preview 都不再触发 snapshot 持久化；新增字段、action-strip selector、缓存诊断和方法都保持 additive，耐久写路径保持原有行为。 | 已显著改善 |
| 架构压力应继续下降 | `KnowledgeLearningPlatform.ts` 仍承载 hydrate、retrieval、store snapshot、path preview composition 和 query context assembly 等多个 owner；本次先收紧读写边界，后续应继续拆小持久化、retrieval context 与 preview composition owner。 | 改善但仍需推进 |

后续推进方向：

- 优先把 API 状态面板从“成功/失败”推进到“scope readiness、backend warmup、最近延迟、缓存命中、索引规模”的可读状态，而不是把诊断藏在 developer detail 中。
- 用 representative large corpus 重复压测 `water glass` 类 title-like query，确认 scoped ANN fallback、document augmentation、grouped graph window 和 file-first hit rendering 在大语料下仍稳定。
- 在更大语料上继续校准前驱/后继的公开回答措辞；当前 reference/bibliography 类图节点已不会在存在更强语义邻居时主导有界公开图摘要。
- 继续把 `KnowledgeLearningPlatform.ts` 中的 snapshot persistence、query context assembly、retrieval telemetry 和 path preview composition 拆到更窄 owner，避免下一次读写边界再被混在同一个大类里。

## 2026-07-03 Mermaid 回退修复、Future Path 运行时复用与图感知公开回答

本次切片收口的是 hosted interaction parity 之后仍然存在的三类具体缺口：

- Node 侧回退 Mermaid renderer 在畸形 bracketed-node label 上仍可能失败，
- Guided Learning 首次打开仍可能重复支付托管 `Graph` / `PathEngine` 重建成本，
- 主公开回答路径仍然低估已有的有界 DAG context，经常退化成单个 top-hit 句子。

当前代码已经成立的事实：

- `src/notemd/MermaidProcessor.ts` 与 `src/reader_renderer.ts` 现在都会在解析/渲染前按“逐行”方式归一化 bracketed Mermaid node label 内部多余的双引号。已知的 `Superior Overall` 故障类现在会在 NoteMD 源修复边界与本地 renderer fallback 边界同时自愈。
- Mermaid 修复路径是刻意有界的：新归一化逻辑只按行工作，不跨语句边界，也不会破坏原有的 dangling-bracket label repair。
- `src/frontend/workspace_panes.js` 现在会按 source-graph signature 缓存托管 Future Path 的 `Graph` / `PathEngine` 运行时。对同一 Guided Learning 投影的再次打开或 rerender 不再每次都完整重建托管图运行时。
- 托管 Future Path cache 现在有了更窄的 owner：`src/frontend/hosted_future_path_runtime.js` 持有按签名复用与冷/热路径诊断，`workspace_panes.js` 只消费这个 owner 并暴露最近一次诊断快照。
- `src/frontend/agent_workspace.js` 保留了先前引入的 pending-pane 行为，因此 `/api/knowledge/path` 尚未返回时 Guided Learning 仍会立即打开；现在 runtime 复用则进一步去掉了其后的重复图重建成本。
- Guided Learning 的 pending 状态在首开时也更有用了：只要本地图状态足够，`workspace_panes.js` 现在会先渲染 hosted Future Path 投影，并在 `/api/knowledge/path` 仍在构建 richer response 时保留 pending 状态提示。
- `src/frontend/agent_workspace.js` 现在会按归一化 payload 对相同的 `/api/knowledge/path` 在途请求做 dedupe，因此对同一 Learning Path 目标的重复点击不会再触发并行重复后端工作。
- `src/learning/graphContextAssembler.ts` 现在会发射 additive 的 `anchorGraphProfile`，为当前 anchor 提供有界的 in-degree / out-degree / centrality 事实，predecessor/successor window 也会保留可选 degree metadata。
- `src/learning/conversationComposer.ts` 与 `src/learning/answerReleaseReview.ts` 现在已经在公开回答路径消费有界的 path / degree context。回答仍然保持收缩，但不再被迫固定成“第一条 direct sentence 或 `title: summary`”。
- 本地 `ref/enterprise_agent_platform` 与 `ref/codex` 现在进一步证明当前 owner 切分合理：runtime / retrieval / memory / release-review 继续留在本地运行时，model-visible context 继续保持 bounded + additive。

代码 / 方案对齐：

| 要求 | 当前实现证据 | 进度判断 |
|---|---|---|
| 回退 Mermaid 渲染不应在已知畸形 bracketed-label 模式上崩溃 | `MermaidProcessor.ts` 与 `reader_renderer.ts` 现已按行归一化 stray quote；`src/notemd.core.test.ts` 与 `src/reader_renderer.test.ts` 固定该回归。 | 已实现 |
| Guided Learning 首次打开不应对同一图快照重复执行完整托管运行时重建 | `workspace_panes.js` 现按 source-graph signature 缓存托管 Future Path runtime，`src/agent_workspace.frontend.test.ts` 验证同一快照不会重复构造 nodes/edges。 | 已实现 |
| Guided Learning 首次打开时，应在后端路径请求完成前先展示路径结构 | `workspace_panes.js` 现在会在 pending 阶段先渲染 hosted projection，`src/agent_workspace.frontend.test.ts` 现在验证 deferred 响应返回前会同时看到 pending 状态和 hosted path surface。 | 已实现 |
| 托管运行时复用应能给出可观测的冷/热路径证据 | `hosted_future_path_runtime.js` 现在持有复用诊断，`src/agent_workspace.frontend.test.ts` 现在同时验证同一快照复用与签名变化后的重建。 | 已实现 |
| Learning Path 链路不应对相同在途请求重复打后端 | `agent_workspace.js` 现在会对相同 `/api/knowledge/path` 在途调用做 dedupe，`src/agent_workspace.frontend.test.ts` 现在验证同一目标的两次打开会共享一条后端请求。 | 已实现 |
| 主公开回答应消费有界图上下文，而不是只释放 top-hit 首句 | `graphContextAssembler.ts` 已提供 `anchorGraphProfile`，`conversationComposer.ts` 与 `answerReleaseReview.ts` 已在公开回答路径消费有界 path/degree context。 | 已实现 |

2026-07-03 当日新鲜验证证据：

- `npm.cmd exec -- tsc --noEmit`
- `npm.cmd exec -- jest src/learning/KnowledgeLearningPlatform.test.ts src/learning/KnowledgeWorkspaceConversationRegression.test.ts src/learning/conversationComposer.test.ts src/agent_workspace.frontend.test.ts src/notemd.core.test.ts src/reader_renderer.test.ts --runInBand --no-cache`
- `npm.cmd run build:mini`
- `node scripts/verify-knowledge-workspace-runtime.js --case waterglass_explicit_scope_compact_zh`

相对先前方案链的架构推进判断：

| 先前预期 | 2026-07-03 当前结论 | 进度判断 |
|---|---|---|
| 现有 DAG 应成为回答时结构，而不只是浅层 relation bonus | `graphContextAssembler.ts` 现在会发射有界的 `connectionPaths`、`anchorGraphProfile`、前驱/后继窗口与 evidence ref；`conversationComposer.ts` 与 `answerReleaseReview.ts` 已在公开回答路径消费这些有界上下文。 | 更强基线已实现 |
| Knowledge Workspace 应把证据和图细节留在主回答面之外 | 主回答继续收缩，图细节继续留在 pane-backed evidence 与 trace surface。 | 已实现 |
| Hosted Guided Learning 不应在每次重开时重复构建同一套运行时 | `workspace_panes.js` 现在按 source-graph signature 复用 hosted `Graph` / `PathEngine` runtime。 | 已实现 |
| 平台应吸收参考架构经验，但不能把 runtime owner 外包给参考仓库 | `ref/enterprise_agent_platform` 强化 evidence / retrieval / runtime / review separation；`ref/codex` 强化 bounded model-visible context 与 additive fragment。 | 已吸收为设计输入 |
| 架构压力应逐步下降 | 当前压力仍集中在 `src/server.ts`（约 `15850`）、`KnowledgeLearningPlatform.ts`（约 `11200`）、`workspace_panes.js`（约 `9289`）、`agent_workspace.js`（约 `4882`）与 `answerReleaseReview.ts`（约 `4261`），但 `hosted_future_path_runtime.js` 已开始把一项真实 cache/telemetry 不变量从 `workspace_panes.js` 中抽出。 | 有所改善，但仍然落后 |

这会改变后续判断：

- 剩余缺口已经不再是“DAG context 有没有进入回答路径”；
- 剩余缺口也不再是“Learning Path 能不能复用 hosted runtime”；
- 剩余缺口主要变成少数大 owner 内的校准与缩 owner。

下一步比“再做一轮 framework 对标”更窄：

- 先量化 representative large corpus 下 Guided Learning 的 first-open / hot-reopen 时延，
- 只有当真实 graph mutation 路径证明 signature 复用不足时，才继续增加 hosted Future Path cache invalidation，
- 继续把 graph-aware public answer 保持为“有界 RSE 式增强”，不要把主回答面演化成 graph-inspection surface。

## 2026-06-24 知识工作区托管交互对齐

本次增量收口两个剩余的 pane 托管缺口，但不改变 2026-06-22 已确定的 owner 边界。
Knowledge Workspace 继续在本地复用 Focus/Future Path 的行为契约；它不重挂 Tauri 主图 DOM，也不默认打开或嵌入 Godot 原生窗口。

当前代码已经成立的事实：

- `src/frontend/workspace_panes.js` 为托管 Focus projection 增加了 pane-local viewport，支持滚轮缩放、指针拖拽平移、图标式 reset 与图标式 focus history 控件。
- 托管 Focus history 只作用于知识聚焦 pane，限制最近 anchor 数量，并通过同一条托管 `switchHostedFocusNode()` 路径切换 anchor，而不是修改主图运行时。
- 托管 Focus 继续默认隐藏密集灰色 context-dot 背景、可见边线与主界面工具框，同时保留 Focus 语义标签和主节点信息密度。
- `src/frontend/godot_tree_interactions.js` 现在允许调用方提供 `nodeReaderRequested`；托管 Future Path 使用该回调让双击节点在引导式学习 pane 内打开具体 Markdown，而未提供该回调的调用方仍回退到原有 prerequisite 展开 / 收起行为。
- `src/frontend/workspace_panes.js` 现在让知识聚焦与引导式学习共用 pane-local reader 路径，因此节点内容会在发起交互的 pane 内打开，全局 `reader.open` 不会被调用。
- `src/frontend/locales/en.json` 与 `src/frontend/locales/zh.json` 已补齐新的 Focus viewport 控件文案，locale contract 继续成立。
- `scripts/verify-agent-workspace-browser.js` 现在断言真实浏览器回归路径：Future Path 双击发出 `node_reader_requested`，读取 `Knowledge_Base/waterglass/water glass.md`，在 learning-path pane 内渲染 Markdown，全局 reader 调用保持为零，托管 Focus viewport 可滚轮缩放、reset 回到 `1/0/0`、打开 focus history，并可通过 history 回跳到 `water glass`。
- `src/agent_workspace.frontend.test.ts` 在 jsdom 层固定同一组契约，提供更快的回归反馈。

代码 / 方案对齐：

| 要求 | 当前实现证据 | 进度判断 |
|---|---|---|
| 知识聚焦应在较小右侧 pane 中具备 Focus mode 级交互 | 托管 Focus 复用现有 projection / double-click 契约，并补齐 pane-local 滚轮缩放、reset、history 控件。 | 已实现 |
| 知识聚焦控件不得接管 Tauri 主图 | 托管 viewport 的 transform 状态只写入 pane-local DOM 属性，anchor 切换也只走 hosted path。 | 已实现 |
| 学习路径双击节点应在本 pane 内打开具体内容 | 托管 Future Path 将 `nodeReaderRequested` 传入 TreeRenderer 适配层，并打开共享 pane-local Markdown reader。 | 已实现 |
| 复用必须保持兼容 | TreeRenderer 适配层在未提供 reader callback 时继续回退到旧的展开 / 收起行为。 | 已实现 |
| 回归覆盖必须可执行 | strict browser verification 已检查 `water glass` Focus/Future Path 交互、源文档读取、Markdown 渲染、缩放 / reset / history，以及全局 reader 不被调用。 | 已实现 |

关键取舍：

这里仍然刻意不做 Godot 原生窗口 docking。
这个边界是正确的：嵌入原生窗口需要平台级 owner 处理 window parenting、输入焦点、teardown 与 reader 路由。
当前落地路径是在 web workspace 内复用稳定的 graph/path 契约与 renderer 语义，风险更低，也能保持 Tauri 主界面隔离。

## 2026-06-22 知识工作区托管 Focus/Future Path 收口

最新收口不是新的框架方向。
它修正了上一版“复用”的错误边界：Knowledge Workspace 现在复用已有 Focus-mode 与 Godot Future Path 的行为 / 数据契约，而不是把 Tauri 主图 DOM 重新挂到右侧 pane，也不是默认唤起 Godot 原生窗口。

当前代码已经成立的事实：

- 公开回答继续收缩为 `src/learning/conversationComposer.ts` 与 `src/learning/answerReleaseReview.ts` 发布审核后的回答；
- 现有 DAG 仍在 synthesis 前由 `src/learning/graphContextAssembler.ts` 消费，并在 release-time 通过图感知 reviewer gate 再次参与判断；
- `src/frontend/workspace_panes.js` 的命中文件列表现在使用紧凑问号帮助入口，而不是把说明文字直接堆进 workspace；
- 命中文件的 source focus 继续以右侧 pane 为权威阅读面：点击后解析 source path、渲染 Markdown，并通过 line/snippet/offset provenance 投影 inline highlight；
- `关联聚焦` 现在托管一个由 `NoteConnectionGraphView.getFocusModeProjection()` 驱动的隔离 Focus-mode pane：保持主 `#graph-container` 留在原父节点，渲染主动 Focus 节点但默认不渲染密集灰色背景 context node 层，保留 Focus 语义标签，并且不显示主界面的工具框和可见边线；双击关联节点只切换 pane-local anchor，双击中心节点时 Markdown 阅读器也只在该 pane 内打开；relation/debug 细节仍只在 Developer Mode 下显示；
- `学习路径` 不再挂载浏览器 `path-container`，也不再默认要求 Tauri/Godot 显示原生 Path 窗口；它解析选中 DAG 节点后，复用现有前端 `Graph` / `PathEngine` 契约，执行 `diffusionLearning(target, 'core', completedSet, forcedExpansionSet)` 与 `getTreeLayout(..., collapsedSet, expansionOrder, stickyClaimEnabled, { verticalGap: 240 })`；当 live Path mode 的 target/mode/strategy 匹配时，会继承其 expansion/collapse/completion 状态包；
- `src/frontend/focus_mode_interactions.js` 现在持有共享 Focus 双击决策模型，并同时被主图运行时与托管 Knowledge Focus pane 使用；
- `src/frontend/godot_tree_interactions.js` 现在把托管 Future Path 的 DOM 输入映射回 Godot TreeRenderer 风格信号，而不是继续依赖 pane-local 临时 handler；prerequisite 展开/收起判定重新对齐 Godot TreeRenderer 的 spine-only 契约；
- 托管 Future Path 通过模块化 `src/frontend/godot_future_path_renderer.js` 渲染 TreeRenderer 兼容表面，覆盖 140x50 胶囊节点、Bezier 跨层过滤、active subtree hull、spine expansion badge、hover subtree focus、保词标签换行与以目标节点为中心的 pane-local pan/zoom 自动拟合；
- 受影响的 source/focus/path 右侧窗口现在都有 close control；
- `scripts/verify-agent-workspace-browser.js` 的 strict browser verification 已经持有用户报告的 `water glass.md` UI 回归面，包括托管 Godot Future Path `diffusion/core` 投影、live Path-mode expansion 状态继承、TreeRenderer marker/hull/viewport auto-fit、Future Path 左键 / 右键 / 中键交互信号、`water glass` 右键后必须进入 collapsed 状态、拒绝把 `#path-container` 停靠进 pane、拒绝调用 bridge/Tauri `showGodot=true`、拒绝停靠真实 `#graph-container`、默认不渲染密集 Focus context dot、断言托管 Focus anchor 确实是 `water glass`、Focus 语义标签、托管 Focus 不存在工具框 / 边线、托管 Focus 双击切换到 `application`、pane-local reader 打开，以及全局 `reader.open` 不被调用。

代码 / 方案对齐：

| 要求 | 当前实现证据 | 进度判断 |
|---|---|---|
| 回答区不能变成 evidence dump | `conversationComposer.ts` 发布 `answerReleaseReview.publicAnswer`；graph/evidence diagnostics 留在次级 surface。 | 已实现 |
| 用户需要知道命中文件可点击，但 workspace 不应常驻说明文案 | `workspace_panes.js` 将说明放入 hover/focus 触发的 help icon。 | 已实现 |
| 单击命中文件应打开源文档并高亮依据 | source focus 消费 source-line provenance、line window、snippet，并在可用时使用 offset。 | 已实现基线 |
| `关联聚焦` 应对应 Tauri Focus-mode 状态 | pane 通过 `getFocusModeProjection()` 与共享 `focus_mode_interactions.js` 决策模型本地托管 Focus-mode 行为：主动 Focus 节点、Focus 语义标签、无密集灰色背景 context 层、无工具框、无可见边线、pane-local 双击切换、pane-local Markdown 阅读器，不修改主图运行时，也不调用全局 `reader.open`；诊断只在 Developer Mode 下显示。 | 已实现 |
| `学习路径` 应对应 Godot/Path-mode 设计 | pane 通过现有前端 `Graph` / `PathEngine` 的 `diffusion/core` + `treeLayout` 路径托管 Godot Future Path 数据契约；当 live Path mode 的 target/mode/strategy 匹配时继承 expansion/collapse/completion 状态包；由 `godot_future_path_renderer.js` 渲染，并通过 `godot_tree_interactions.js` 将输入路由为 TreeRenderer spine-only 信号；刻意不挂载浏览器 `path-container`，也不默认显示 Godot 原生窗口。 | 已实现 |
| 最终回答需要鲁棒审核 / 纠错 owner | `answerReleaseReview.ts` 继续作为后端确定性 release-policy owner。 | 已实现基线 |
| 兼容性必须保持 | 新增 graph-preview 与 provenance 字段保持 additive/optional；legacy response fields 继续有效。 | 已实现 |

关键权衡现在更窄。
Focus 复用现在指投影契约复用，而不是 DOM owner 转移。移动 `#graph-container` 会让右侧 pane 意外接管 Tauri 主图生命周期，也会导致 Markdown 内容打开到错误的主界面 surface。
Path 复用现在指 Godot Future Path 的数据契约与 renderer 语义复用：使用现有 `Graph` / `PathEngine` 生成 Godot TreeRenderer 消费的 treeLayout，并在知识工作区用 TreeRenderer 兼容表面托管，而不是浏览器 / Tauri Learning Path，也不是原生窗口可见性开关。最新对齐属于状态契约修复：托管 pane 必须传递与主 Path mode worker 同类的 `completedIds`、`forcedExpansionIds`、`collapsedIds`、`expansionOrder` 与 `stickyClaimEnabled` 状态包，同时用户在 pane 内显式收起当前 target 后，该 collapsed 状态仍必须跨过下一次 render，而不能被“target 默认展开”的初始化不变量覆盖。
如果未来产品要求把 Godot 原生窗口真正嵌入右侧 pane，需要单独做 native window container/reparenting spike；它不应混入当前 Knowledge Workspace pane 实现。

剩余工作已经转为校准：

- 扩展 reviewer contradiction corpus，但不能扩大 false-positive 面；
- 提高 legacy payload 的 source-offset 覆盖；
- 在提升 relation weight 前，用真实语料校准 graph-aware ranking；
- 只有新模块拥有真实不变量时才继续拆前端 owner；
- matched-file interaction 继续演进时，保持 strict browser UI verification 常态化。

持久方案：

- [Agent Knowledge Workspace Graph Preview and Review Closure (2026-06-20)](../../../solutions/agent-knowledge-workspace-graph-preview-and-review-closure-2026-06-20.md)

## 2026-06-19 复审：reviewer owner 已落地，缺口已转移

最新复审改变了这一切片的诊断结论。
项目已经不再缺少最终公开回答的 reviewer；该 owner 已经真实落在 `src/learning/answerReleaseReview.ts`。
当前活跃缺口已经转移到更广的矛盾检测与更深的证据 provenance。

当前代码已经成立的事实：

- 最终公开回答的 release 决策已经由 `answerReleaseReview.ts` 持有，而不是藏在 prompt template 里，也不是交给前端兜底，
- 项目现有 DAG 已经被使用了两次：
  - 回答规划阶段由 `src/learning/graphContextAssembler.ts` 消费，
  - release-review 阶段由 `claim_graph_causal_consistency`、`claim_graph_order_consistency` 与 `claim_graph_comparison_consistency` 消费，
- `src/learning/answerReleaseReview.ts` 现在还会执行 `claim_state_consistency`，因此 `open system` vs `closed system` 这类同主体状态反转会在进入公开回答前被改写，
- `src/learning/answerReleaseReview.ts` 现在还会执行 `query_intent_alignment`，因此 `什么是waterglass?` 这类定义型问题在已有定义证据时，会把“本技术文档旨在……”这类文档自述草稿改写成直接定义句后再发布，
- `src/learning/answerReleaseReview.ts` 现在还会执行 `claim_containment_consistency`，因此当 grounded subject 与显式容纳关系保持不变、但被容纳内容从 `contains water` 偷换成 `contains oil` 时，草稿也会在 release 前被改写，
- `src/learning/answerReleaseReview.ts` 现在还会执行 `claim_composition_consistency`，因此当 grounded subject 与显式 `由...组成` / `composed of` 关系保持不变、但支撑组件从 `water and a glass cup` 偷换成 `oil and a plastic cup` 时，草稿也会在 release 前被改写，
- `src/learning/answerReleaseReview.ts` 现在还会执行 `claim_purpose_consistency`，因此当 grounded subject 与显式 `used for` / `用于` 关系保持不变、但支撑用途从 `drinking water` 偷换成 `storing motor oil` 时，草稿也会在 release 前被改写，
- `src/learning/answerReleaseReview.ts` 现在还会执行 `claim_dependency_consistency`，因此当 grounded subject 与显式 `depends on` / `requires` / `依赖` / `前置条件` 关系保持不变、但支撑依赖从 `基线测量和传感器校准` 偷换成 `最终报告` 时，草稿也会在 release 前被改写，
- `src/learning/answerReleaseReview.ts` 现在还会执行 `claim_location_consistency`，因此当 grounded subject 与显式 `located in` / `位于` 关系保持不变、但支撑位置从 `主舱室` 偷换成 `辅助舱室` 时，草稿也会在 release 前被改写，
- `src/learning/answerReleaseReview.ts` 现在还会执行 `claim_subject_consistency`，因此像把 `Water density` 偷换成 `Glass density` 这种“事实尾部还对、主体却串了”的草稿，也会在 release 前被改写，
- `src/learning/answerReleaseReview.ts` 现在还会执行 `claim_structured_comparison_consistency`，因此当草稿把已被支撑的同属性比较方向说反，例如 `Water density is higher than glass density`，也会在 release 前被改写，
- `src/learning/answerReleaseReview.ts` 现在还会执行 `claim_attribute_consistency`，因此当草稿保持同一 grounded subject 与显式 `has` / `具有` 属性框架、却把支撑属性从 `中等热绝缘性能` 偷换成 `高热绝缘性能` 时，也会在 release 前被改写，
- `src/learning/answerReleaseReview.ts` 现在还会执行 `claim_graph_causal_consistency`，因此当草稿把 DAG 支撑的因果方向说反，例如把 `Pressure Rise causes Thermal Expansion` 这类因果对调，也会在中英文路径上于 release 前被改写，
- `src/learning/answerReleaseReview.ts` 现在还会执行 `claim_graph_comparison_consistency`，因此当草稿把 DAG 支撑的 `contrast` / `analogy` title pair 语义说反时，也会在 release 前被确定性纠正句改写，
- `src/learning/answerReleaseReview.ts` 现在还会执行 `claim_temporal_validity_consistency`，因此 DAG 的 temporal warning 现在也会进入最终发布决策：当 `graphContext.temporalValidity.allPointsValid === false` 时，未显式加时间限定的“当前结论”草稿会在 release 前被改写，带明确时间限定的答案仍可放行，而仅有 `supersedes` 血缘本身不会造成误报拦截，
- `located in` / `位于` 这类位置谓词现在已从 `claim_state_consistency` 抽取中显式排除，因此位置断言会由 location slice 持有，而不会误报成 state contradiction，
- 共享 alias/scope 回归语料现在也不再把这一步中间改写过程错误地钉死到所有 fixture 上：
  - 对内存态的简化语料，只要最终公开回答已经 grounded 且收缩，`release` 与 `revise` 都是允许结果，
  - 对真实截图派生的运行时用例 `waterglass_explicit_scope_compact_zh`，则继续强制要求 `revise`，并且 failed gate 必须包含 `query_intent_alignment`，
- `src/frontend/markdown_runtime.js` 现在会给渲染后的 markdown block 标注 block-level source-line 元数据，
- `src/frontend/workspace_panes.js` 现在已经把右侧证据聚焦从“仅 payload 稳定”推进到“高亮精度可控 + provenance 可观测”：
  - 当渲染节点 source range 与可信 evidence span 重叠时优先使用 `source_line_provenance`，
  - 选中正确节点后，还会把命中的 evidence fragment 投影成内联高亮，
  - 在已经 source-authenticated 的选中 block 内，现在还会优先使用 snippet 尺度的 fragment projection，因此单行段落不再整行被高亮，
  - 当渲染 provenance 暂不可用但 citation 行窗仍可信时回退到 `line_window`，
  - 在行窗缺失或陈旧时继续回退到 `snippet_fallback`，
  - 通过 additive `highlightStrategy` 诊断显式暴露命中的高亮路径（`source_line_provenance`、`line_window`、`snippet_fallback`、`none`），
  - 还会通过 additive `inlineHighlightStrategy` 诊断显式暴露内联高亮路径（`source_fragment_provenance`、`text_search`、`none`），
  - 记录 additive 的 provenance 覆盖计数，并对过宽的容器节点做惩罚，避免重复 snippet 导致整块文章被高亮，
- `src/agent_workspace.frontend.test.ts` 现在已经固定四类运维相关回归：
  - 当同一 snippet 在多个段落重复出现时，必须命中可信 line window 对应的正确段落，
  - 当行号元数据不可用或不可信时，必须回退到 snippet 高亮，而不是误高亮错误段落，
  - 单行段落的高亮必须收缩到命中的 fragment，而不是整行，
  - 嵌套 inline markdown 节点仍然必须解析为单个精确 fragment 高亮，
- 运行时验证现在还补了一条 build-freshness 约束：reviewer gate 变更后必须对着新鲜 `dist` 产物验证；有一次陈旧构建产物曾暂时遮蔽新 gate 清单，直到执行 `npm.cmd run build:mini` 才恢复真实 reviewer 面，
- 用户提供的截图 `1781782257390.jpg` 继续作为正式运行时验收 owner 保留在 `waterglass_explicit_scope_compact_zh`；当前根因已固化为 planner/retrieval normalization 漂移叠加公开回答诊断泄漏。

## 2026-06-19 结构化比较矛盾门禁

这一子切片解决的不是泛化“事实核验”。
它针对的是“两个 grounded 实体、同一属性、同一单位，但比较顺序被说反”的确定性失败类型。

当前变更：

- `src/learning/answerReleaseReview.ts` 现在会抽取 `higher than`、`lower than`、`greater than`、`less than`、`高于`、`低于` 这类显式比较框架，
- `claim_structured_comparison_consistency` 只会在比较两侧都能绑定到“同一属性、同一单位”的 structured fact 时才启动比对，
- 确定性英文纠正句现在会保留 acronym / proper noun 的强大小写信号，而不是一律小写化 anchor，
- `src/learning/types.ts` 现在把该 gate 作为一等 `AnswerReleaseGateId` 暴露，
- `src/learning/answerReleaseReview.test.ts` 现在已经固定四条契约边界：
  - 英文反转必须 `revise`，
  - 中文反转必须 `revise`，
  - 被支撑的比较方向必须继续 `release`，
  - mixed-property 支撑不得制造误报。

为什么这件事在架构上重要：

- lexical overlap 无法区分 `Water density is higher than glass density` 与其相反断言，
- `claim_structured_consistency` 能抓单个结构化事实冲突，但本身并不拥有“双实体顺序关系”的判定，
- DAG 的 `contrast` / `analogy` 门禁回答的是另一类问题，不拥有同属性数值顺序语义，
- 所以这个 gate 仍然必须落在后端确定性 reviewer，而不是退回 prompt 文本或前端显示层。

当前仍未关闭的缺口：

- 更广的 claim-vs-citation / claim-vs-evidence 矛盾覆盖仍需继续超出 lexical + query-intent + structured + structured-comparison + attribute + containment + composition + purpose + dependency + location + subject + state + polarity + graph-causal + graph-order + graph-comparison + temporal-validity 栈，
- 同一已认证渲染 block 内的重复片段去歧义仍然需要 exact offset 或更丰富的 markdown AST provenance。

代码 / 方案对齐：

| 要求 | 当前实现证据 | 进度判断 |
|---|---|---|
| 最终公开回答审核必须拥有“成对比较顺序”的 release owner | `answerReleaseReview.ts` 现在会基于可比的同属性、同单位支撑事实执行 `claim_structured_comparison_consistency`。 | 已实现基线 |
| 门禁必须保持保守，不能跨无关数值乱猜 | mixed-property 与 mixed-unit 支撑不会被强行拿来比较；新增单测已经固定这条防误报边界。 | 已实现基线 |
| reviewer 运行时校验不得信任陈旧编译产物 | reviewer gate 变更后的运行时校验现在要求先刷新 `dist`；`npm.cmd run build:mini` 已进入验证路径。 | 已实现 |

本次子切片验证：

- `npm.cmd exec -- jest src/learning/answerReleaseReview.test.ts --runInBand --no-cache`
- `npm.cmd exec -- tsc --noEmit`
- `npm.cmd run build:mini`
- `node scripts/verify-knowledge-workspace-runtime.js --case waterglass_explicit_scope_compact_zh`

## 2026-06-19 位置矛盾门禁

这一子切片修补的不是状态矛盾，而是显式位置漂移。
它针对的是“同一主体、同一位置关系、但位置被偷换”的确定性失败类型。

当前变更：

- `src/learning/answerReleaseReview.ts` 现在会抽取 `located in`、`situated in`、`positioned in`、`lies in`、`位于`、`坐落于` 这类显式位置框架，
- `claim_location_consistency` 会把同主体位置断言与当前 scope 下的支撑集合对齐；一旦支撑位置被偷换，就会在 release 前改写草稿，
- `STATE_FRAME_SKIP_VALUE_PATTERN` 现在会把位置谓词从 `claim_state_consistency` 抽取中排除，因此位置句不会再误报成状态矛盾，
- `src/learning/types.ts` 现在把 `claim_location_consistency` 暴露为一等 `AnswerReleaseGateId`，
- `src/learning/answerReleaseReview.test.ts` 现在固定三条契约边界：
  - 英文位置矛盾必须 `revise`，
  - 中文位置矛盾必须 `revise`，
  - 被支撑的更宽位置表述必须继续 `release`。

为什么这件事在架构上重要：

- 位置漂移是一类独立的矛盾族群，lexical overlap 与 state gate 都不能干净持有，
- 如果把位置谓词继续混在 state slice 里，reviewer 即便给出正确决策，也会因为错 owner 而变得难以信任，
- 因此这里需要的不是更宽的语义 verifier，而是更窄、更明确的本地 owner 与防误报边界。

当前仍未关闭的缺口：

- claim-vs-citation 与 claim-vs-evidence 的更广矛盾覆盖仍然要继续推进，不能停在显式位置框架上，
- 重复 inline fragment 的精准去歧义仍然需要 exact offset 或更丰富的 markdown AST provenance。

本次子切片验证：

- `npm.cmd exec -- jest src/learning/answerReleaseReview.test.ts --runInBand --no-cache`
- `npm.cmd exec -- tsc --noEmit`

## 2026-06-19 依赖 / 前置条件矛盾门禁

这一子切片刻意比“泛化 LLM verifier”更窄。
它针对的是“答案整体看似 grounded，但显式依赖 / 前置条件被偷换”的具体失败类型，而不是宽泛的语义不确定性。

当前变更：

- `src/learning/answerReleaseReview.ts` 现在会抽取 `depends on`、`requires`、`relies on`、`has prerequisite`、`依赖`、`需要`、`前置条件` 这类显式依赖框架，
- `claim_dependency_consistency` 会把同主体依赖断言与当前 scope 下的支撑集合逐一对齐；一旦支撑依赖被偷换，就会在 release 前改写草稿，
- `src/learning/types.ts` 现在把这个 gate 正式暴露为一等 `AnswerReleaseGateId`，
- `src/learning/answerReleaseReview.test.ts` 现在固定三条契约边界：
  - 英文依赖矛盾必须 `revise`，
  - 中文依赖矛盾必须 `revise`，
  - 被支撑的依赖细化仍然必须 `release`。

为什么这件事在架构上重要：

- 这个 gate 必须放在 answer synthesis 之后的后端 reviewer，因为这里判断的是“能否放行”，而不是“生成长什么样”，
- 它刻意复用当前 DAG + evidence runtime，而不是把 correctness owner 重新交给 `ref/` 里的第二套框架，
- 它关闭的是一类具体矛盾，而不是把 false positive 面扩大成不稳定的语义猜测器。

当前仍未关闭的缺口：

- claim-vs-citation 与 claim-vs-evidence 的更广矛盾覆盖仍然要继续推进，不能停在显式依赖框架上，
- 重复 inline fragment 的精准去歧义仍然需要 exact offset 或更丰富的 markdown AST provenance。

代码 / 方案对齐：

| 要求 | 当前实现证据 | 进度判断 |
|---|---|---|
| 最终公开回答审核必须有耐久的后端 owner | `src/learning/answerReleaseReview.ts` 已经在 answer synthesis 之后持有 `release` / `revise` / `abstain` 决策。 | 已实现 |
| 现有 DAG 必须参与回答正确性，而不只是 retrieval 排序 | `graphContextAssembler.ts` 在 synthesis 前装配图上下文，`claim_graph_causal_consistency`、`claim_graph_order_consistency` 与 `claim_graph_comparison_consistency` 会在 release 时消费 DAG 证据。 | 已实现基线 |
| 定义型问题不得把文档自述草稿直接放行 | `answerReleaseReview.ts` 现在会执行 `query_intent_alignment`：当 `what is` / `什么是` 问题已有 grounded definition frame，但草稿仍然是 `This technical document...` / `本技术文档旨在...` 时，会在 release 前改写。 | 已实现基线 |
| grounded draft 不得在显式容纳关系里保持同一主体却偷换被容纳内容 | `answerReleaseReview.ts` 现在会对可比的 containment/content frame 执行 `claim_containment_consistency`，因此 `Water glass contains water` -> `Water glass contains oil` 这类内容漂移也会被改写。 | 已实现基线 |
| grounded draft 不得在显式组成关系里保持同一主体却偷换支撑组件 | `answerReleaseReview.ts` 现在会对可比的 `composed of` / `consists of` / `由...组成` frame 执行 `claim_composition_consistency`，因此 `water and a glass cup` -> `oil and a plastic cup` 这类组成关系漂移也会被改写，同时兼容组件顺序调整与兼容细化。 | 已实现基线 |
| grounded draft 不得在显式用途关系里保持同一主体却偷换支撑用途 | `answerReleaseReview.ts` 现在会对可比的 `used for` / `用于` frame 执行 `claim_purpose_consistency`，因此 `drinking water` -> `storing motor oil` 这类用途漂移也会被改写，同时兼容支撑用途细化。 | 已实现基线 |
| grounded draft 不得在显式依赖 / 前置条件关系里保持同一主体却偷换支撑依赖 | `answerReleaseReview.ts` 现在会对可比的 `depends on` / `requires` / `依赖` / `前置条件` frame 执行 `claim_dependency_consistency`，因此 `基线测量和传感器校准` -> `最终报告` 这类依赖漂移也会被改写，同时兼容真正被支撑的依赖回答。 | 已实现基线 |
| grounded draft 不得在显式位置关系里保持同一主体却偷换支撑位置 | `answerReleaseReview.ts` 现在会对可比的 `located in` / `位于` frame 执行 `claim_location_consistency`，因此 `主舱室` -> `辅助舱室` 这类位置漂移也会被改写；位置谓词已从 `claim_state_consistency` 抽取中排除，因此位置矛盾会由正确 slice 持有。 | 已实现基线 |
| grounded draft 不得保留正确事实尾部却偷换 grounded subject | `answerReleaseReview.ts` 现在会对可比的 subject-tail frame 执行 `claim_subject_consistency`，因此即使数值尾部仍与支撑一致，`Water density` -> `Glass density` 这类主体漂移也会被改写。 | 已实现基线 |
| grounded draft 不得保持同一主体与显式属性框架却偷换支撑属性 | `answerReleaseReview.ts` 现在会对可比的 `has` / `have` / `具有` 属性 frame 执行 `claim_attribute_consistency`，因此 `中等热绝缘性能` -> `高热绝缘性能` 这类属性漂移也会被改写，同时兼容合理细化。 | 已实现基线 |
| 同主体状态矛盾必须在 release 前改写 | `answerReleaseReview.ts` 现在会对中英文可比 definition/copula 断言执行 `claim_state_consistency`。 | 已实现基线 |
| grounded draft 不得把 DAG 支撑的因果方向说反 | `answerReleaseReview.ts` 现在会对 `connectionPaths`、`knowledgePointRelations` 以及 predecessor/successor window 中装配出的 `causal` 边执行 `claim_graph_causal_consistency`，并把反向因果改写成确定性的纠正句。 | 已实现基线 |
| grounded draft 不得把单一对比分支的 DAG title pair 说成相反对比语义 | `answerReleaseReview.ts` 现在会对已装配 `contrast` / `analogy` 证据执行 `claim_graph_comparison_consistency`；当同一 title pair 在图中只支撑一种对比家族时，把它说成相反语义会触发 revise。 | 已实现基线 |
| grounded draft 不得把带时序警告的 DAG 证据直接发布成“当前结论” | `answerReleaseReview.ts` 现在会基于 `graphContext.temporalValidity` 执行 `claim_temporal_validity_consistency`：未显式加时间限定的当前结论会被改写，而带明确时间限定的答案仍可放行，并避免 `supersedes` 单独触发误报。 | 已实现基线 |
| 右侧原文预览必须在可用时消费 source-to-render provenance | `markdown_runtime.js` 现在会给渲染 block 标注 source-line 元数据，`workspace_panes.js` 则优先使用 `source_line_provenance`，并输出 provenance 覆盖计数。 | 已实现基线 |
| 右侧原文预览必须高亮命中片段，而不只是整段 | `workspace_panes.js` 现在会在选中节点内部投影命中的 evidence fragment，在已认证 block 内优先使用 snippet 尺度的 source-authenticated fragment projection，并输出 `inlineHighlightCount` 与 `inlineHighlightStrategy`。 | 已实现基线 |
| 右侧原文预览在 snippet 重复时仍必须高亮正确段落 | `workspace_panes.js` 现在优先使用可信 `line_window` 锚点，并用 specificity/container penalty 给候选节点打分。 | 已实现基线 |
| 陈旧行号不能强行把高亮带偏 | `workspace_panes.js` 现在会主动怀疑 stale line window，并回退到 `snippet_fallback`；前端测试已固定这类失败模式。 | 已实现基线 |
| 截图驱动的 `waterglass` 失败必须继续作为正式验收项 | `scripts/verify-knowledge-workspace-runtime.js --case waterglass_explicit_scope_compact_zh` 现在要求 grounded 输出、reviewer/public-answer 一致性、无诊断泄漏，并且不能再退化成 `本技术文档旨在` 这类元文档回答。 | 已实现 |
| 当前剩余缺口必须明确转移到更广矛盾检测与更窄但仍未关闭的 provenance | 现有代码仍需继续补超出 lexical + query-intent + structured + structured-comparison + attribute + containment + composition + purpose + dependency + location + subject + state + polarity + graph-causal + graph-order + graph-comparison + temporal-validity 栈的 claim-vs-citation / claim-vs-evidence conflict 检测，以及用于同一已认证 block 内重复片段去歧义的显式 span offset 或更丰富 AST provenance。 | 未完成 |

本次复审验证：

- `npm.cmd exec -- jest src/learning/answerReleaseReview.test.ts src/agent_workspace.frontend.test.ts src/agent_workspace.locale.contract.test.ts src/export/WorkspaceExportBundle.test.ts --runInBand --no-cache`
- `npm.cmd exec -- tsc --noEmit`
- `npm.cmd run build:mini`
- `node scripts/verify-knowledge-workspace-runtime.js --case waterglass_explicit_scope_compact_zh`

## 2026-06-18 最终回复 release review 与纠错层

本切片关闭的是 agent 路径里的一个结构性鲁棒性缺口：系统已经具备 retrieval、DAG context assembly、answer composition、evidence pane 和 workflow artifact，但在把答案真正发给用户之前，还没有一个一等 owner 负责做最后的公开发布决策。

这个缺失 owner 现在已经落地为 `src/learning/answerReleaseReview.ts`。

当前代码已经成立的事实：

- `conversationComposer.ts` 仍然负责产出草稿回答，但已经不再单独拥有最终公开释放权。
- 新 reviewer 会对以下确定性 gate 做审核：
  - evidence sufficiency
  - graph support sufficiency
  - public-surface contraction
  - internal diagnostic leakage
  - abstention hygiene
- reviewer 现在可以做 `release`、`revise`、`abstain` 三类决策。
- reviewer 现在也会执行 `claim_grounding_alignment`：通过轻量的 ASCII/CJK 词法重叠检查，识别“有证据但草稿主张已漂移”的情况，并强制改写。
- 中文 scoped miss 现在会返回中文 abstention，而不是退化成 English diagnostic-heavy fallback 文本。
- reviewer 状态现在已经以 additive 方式保留在：
  - `AgentConversationResponse.answerReleaseReview`
  - `AgentConversationTrace.answerReleaseReview`
  - `KnowledgeRun.answerReleaseReview`
- `KnowledgeLearningPlatform.ts` 现在会把这份状态写进运行时响应与 workflow artifact payload。
- 运维检查面现在已经能通过 `src/frontend/agent_workspace.js` 与 `src/frontend/workspace_panes.js` 在 `knowledge_run` 明细 / 历史卡片里查看净化后的 reviewer 状态，同时不扩大主回答区。
- `WorkspaceExportBundle.ts` 现在会把紧凑 reviewer 摘要投影到 `runtime.knowledgeRunReports[*].answerReleaseReview`。
- 这个导出摘要有意只保留 `reviewedAt`、`decision`、`revised`、`failedGateIds`、`leakedInternalFragmentCount` 与 `reason`；完整 original/public answer 文本继续留在 workflow artifact 与 trace，而不进入 compare-ready report 表面。
- `WorkspaceExportBundle.ts` 现在还会派生 `runtime.knowledgeRunAnswerReleaseAuditSummary`；这是一份基于已导出 knowledge-run report 的长周期聚合审计，而不是第二条平行 telemetry。
- 运维历史检查面现在也会从返回的 runs 渲染同一份聚合 `Release audit` 形态，覆盖 reviewed/unreviewed 计数、decision bucket、failed gate 频次、leak 计数、revised run 数量与最新 review 时间。
- 同一条聚合路径现在还会补出 `reviewTrend` 趋势窗口与 `failedGateAging` 门禁老化摘要，因此 reviewer 漂移不再只是总数，而是可检查的序列信号。
- 同一条聚合路径现在还会继续补出 compare-ready drilldown：近期/前序指标差值、gate 变化、以及最近两次已审运行的 delta；run compare 卡片也会在原有质量/图信号对比之外补出 answer-release 对比。
- `scripts/verify-knowledge-workspace-runtime.js` 现在已经把 reviewer 存在性与 `publicAnswer === result.answer` 一致性纳入运行时契约。

这件事为什么重要：

- 之前的 `waterglass` 截图不只是 retrieval miss，
- 它还暴露了内部失败语言可以直接泄漏到主回答区，
- 新的 reviewer layer 现在会阻断这类回归，即使当前证据为空。

代码 / 方案对齐：

| 要求 | 当前实现证据 | 进度判断 |
|---|---|---|
| 最终公开回答必须经过 release review | `src/learning/answerReleaseReview.ts` 现在已经拥有 post-synthesis release decision。 | 已实现 |
| 不支持的回答必须 clean abstain | empty-result 的 debug-style 草稿现在会被降级成简洁 abstention。 | 已实现 |
| 有证据的草稿主张必须与支撑保持一致 | `claim_grounding_alignment` 现在会在 citation/knowledge point 的词法支撑不足时强制改写 grounded draft。 | 已实现 |
| 开发者必须能检查 release decision | review 状态已保留到 response、trace 与 `KnowledgeRun`。 | 已实现 |
| 运维侧必须能看到 reviewer 状态且不扩大主回答区 | `agent_workspace.js` 会净化 `answerReleaseReview`，`workspace_panes.js` 会在 `knowledge_run` 卡片里渲染 release-review 明细 / 历史。 | 已实现 |
| replay/export 表面必须能耐久保留 reviewer 状态 | `WorkspaceExportBundle.ts` 现在会在 `runtime.knowledgeRunReports` 中输出紧凑 `answerReleaseReview` 摘要。 | 已实现 |
| 更长周期的运维审计必须复用已导出的 reviewer 遥测，而不是再新增第二条路径 | `WorkspaceExportBundle.ts` 现在会派生 `runtime.knowledgeRunAnswerReleaseAuditSummary`，历史卡片也会渲染同一份多 run release-audit 形态。 | 已实现基线 |
| 审核趋势与门禁老化也必须继续留在同一条审计路径上 | `runtime.knowledgeRunAnswerReleaseAuditSummary` 现在还会派生 `reviewTrend` 与 `failedGateAging`，历史卡片也会渲染两者。 | 已实现基线 |
| 运维侧必须能在不打开原始 trace 的前提下比较 reviewer 漂移 | 同一条审计路径现在会派生指标差值、gate 变化与最近两次审核 delta；compare 卡片也会补出 answer-release 对比。 | 已实现基线 |
| `waterglass` 截图必须成为正式回归门禁 | runtime verifier 现在要求 reviewer 存在，并拒绝公开回答中的诊断泄漏。 | 已实现 |
| 向前兼容必须保持显式 | `assistantMessage`、`answer`、`assistantBlocks` 保持有效；reviewer 字段都是 additive。 | 已保持 |

本切片验证：

- `npm.cmd exec -- jest src/learning/answerReleaseReview.test.ts src/learning/conversationComposer.test.ts src/learning/KnowledgeLearningPlatform.test.ts --runInBand --no-cache`
- `npm.cmd exec -- jest src/agent_workspace.frontend.test.ts src/learning/answerReleaseReview.test.ts src/learning/conversationComposer.test.ts src/learning/KnowledgeLearningPlatform.test.ts --runInBand --no-cache`
- `npm.cmd exec -- jest src/export/WorkspaceExportBundle.test.ts src/agent_workspace.frontend.test.ts src/agent_workspace.locale.contract.test.ts --runInBand --no-cache`
- `npm.cmd exec -- tsc --noEmit`
- `npm run verify:knowledge-workspace:runtime`

## 2026-06-19 结构化事实矛盾门禁

下一个鲁棒性缺口比 release review 本身更窄，但依然重要：lexical topic overlap 只能说明“这条草稿大体上还在谈同一个主题”，却不能可靠识别“主题没跑偏，但数值或年份已经说错了”的情况。

这个缺口现在已经在 `src/learning/answerReleaseReview.ts` 中被部分补上，对应的新确定性门禁是 `claim_structured_consistency`。

当前代码已经成立的事实：

- reviewer 现在会从草稿回答与 grounded support 中提取高置信度结构化事实：
  - 带单位的数值，例如 `%`、`kg/m3`、`GPa`、`kPa`、`km/h` 等技术单位；
  - 只有在局部上下文看起来确实像日期/年份时，才会把 4 位数按 year claim 处理，而不是把所有 4 位数都误判成年份。
- structured-fact comparison 刻意保持保守：
  - 如果没有可比的 support fact，就不会凭空制造“矛盾”；
  - 如果 support 里在同一 anchor/unit 族下出现多个值，那么只要其中有一个值和草稿一致，就不会误报。
- 新 gate 是 additive 的：
  - `src/learning/types.ts` 现在已经把 `claim_structured_consistency` 纳入 `AnswerReleaseGateId`；
  - 运维表面与 export telemetry 继续保持兼容，因为它们本来就是按通用 gate ID 路径消费 reviewer 结果。
- 现在即使 lexical alignment 仍然通过，只要结构化事实冲突，grounded draft 也会被改写。
- grounded revision 的文本质量也顺手收了一步：如果 support sentence 已经以 article + title phrase 开头，reviewer 不会再额外重复加一层标题前缀。

为什么这一步重要：

- lexical alignment 擅长抓主题漂移；
- 它并不可靠地抓住“主语没变，但数字/年份错了”；
- 所以只停在 lexical overlap 的 reviewer，依然可能放行一条在事实层面明显错误的回答。

代码 / 方案对齐：

| 要求 | 当前实现证据 | 进度判断 |
|---|---|---|
| 矛盾检测必须超出 lexical overlap，但不能变成猜测器 | `answerReleaseReview.ts` 现在只会在存在高置信度可比 support fact 时，才执行 structured numeric/year consistency 检查。 | 已实现基线 |
| 数值矛盾必须在 topic 仍匹配时触发改写 | `claim_structured_consistency` 现在会在 `875 kg/m3` 对上 grounded `999.8 kg/m3` 这类场景中失败并触发 revise。 | 已实现 |
| 年份矛盾也必须被确定性捕捉 | reviewer 现在会对 `1935` vs grounded `1933` 这类 date-like year conflict 触发 revise。 | 已实现 |
| 支撑里存在多个值时必须避免可预防的误报 | `answerReleaseReview.test.ts` 现在固定了一条支撑同时包含 `2500 kg/m3` 与 `999.8 kg/m3` 的用例，只要草稿命中正确 supported value，就会 clean release。 | 已实现 |

本切片验证：

- `npm.cmd exec -- tsc --noEmit`
- `npm.cmd exec -- jest src/learning/answerReleaseReview.test.ts src/learning/conversationComposer.test.ts src/learning/KnowledgeLearningPlatform.test.ts src/export/WorkspaceExportBundle.test.ts src/agent_workspace.frontend.test.ts src/agent_workspace.locale.contract.test.ts src/learning/KnowledgeWorkspaceConversationRegression.test.ts --runInBand --no-cache`
- `npm.cmd exec -- tsc`
- `node scripts/verify-knowledge-workspace-runtime.js --case waterglass_explicit_scope_compact_zh`

## 2026-06-19 正反断言矛盾门禁

结构化事实之后，下一个仍然适合用确定性方式补上的矛盾缺口，是“主题词没变、实体没变，但把支撑明确说反了”：例如 evidence 说 `is`，draft 却说 `is not`。

这个缺口现在已经在 `src/learning/answerReleaseReview.ts` 中被部分补上，对应的新 gate 是 `claim_polarity_consistency`。

当前代码已经成立的事实：

- reviewer 现在会提取可比的 answer/support sentence，并识别窄口径的正负极性信号：
  - 英文否定路径，例如 `is not`、`do not`、`cannot`，以及归一化后的缩写形式；
  - 中文否定路径，例如 `不是`、`并非`、`没有`、`不能`、`无法`。
- 这个 gate 刻意保持约束：
  - 只比较 feature overlap 足够高、可视为“同一断言骨架”的句子；
  - 只要存在一个 polarity 相同的可比 support sentence，就不会误判冲突；
  - support 里出现无关否定句，本身不会被当作矛盾。
- 新 gate 仍然是 additive 的：
  - `src/learning/types.ts` 现在已经把 `claim_polarity_consistency` 纳入 `AnswerReleaseGateId`；
  - export 与 operator surface 继续保持兼容，因为它们本来就是按通用 gate ID 消费 reviewer 结果。
- 现在即使 lexical alignment 仍然通过，只要草稿把 support 明确说反，也会触发 revise。

为什么这一步重要：

- lexical alignment 负责抓 topic drift；
- structured consistency 负责抓“主题没偏，但数字/年份错了”；
- polarity consistency 则负责抓“主题没偏、实体没偏，但断言方向说反了”。 

代码 / 方案对齐：

| 要求 | 当前实现证据 | 进度判断 |
|---|---|---|
| reviewer 矛盾覆盖必须纳入显式正反反转 | `answerReleaseReview.ts` 现在已经会对高 overlap 的可比句子执行 `claim_polarity_consistency`。 | 已实现基线 |
| 英文显式正反反转必须触发改写 | `answerReleaseReview.test.ts` 现在固定了 `Water glass is not ...` 对上 grounded `Water glass is ...` 的用例。 | 已实现 |
| 中文显式正反反转也必须触发改写 | `answerReleaseReview.test.ts` 现在固定了 `水杯不是...` 对上 grounded `水杯是...` 的用例。 | 已实现 |
| support 中的无关否定句不能制造可避免的误报 | `answerReleaseReview.test.ts` 现在固定了一条 support 含 `Water glass is not plastic`，但主回答正确表述 `Water glass is a transparent container filled with water.` 的防误报用例。 | 已实现 |

本切片验证：

- `npm.cmd exec -- jest src/learning/answerReleaseReview.test.ts --runInBand --no-cache`
- `npm.cmd exec -- tsc --noEmit`
- `npm.cmd exec -- jest src/learning/answerReleaseReview.test.ts src/learning/conversationComposer.test.ts src/learning/KnowledgeLearningPlatform.test.ts src/export/WorkspaceExportBundle.test.ts src/agent_workspace.frontend.test.ts src/agent_workspace.locale.contract.test.ts src/learning/KnowledgeWorkspaceConversationRegression.test.ts --runInBand --no-cache`
- `npm.cmd exec -- tsc`
- `node scripts/verify-knowledge-workspace-runtime.js --case waterglass_explicit_scope_compact_zh`

## 2026-06-19 DAG 顺序一致性门禁

下一个缺口并不是“再加一个泛化 verifier 模型”就能解决的，而是这个项目自己的结构化缺口：当前 DAG 已经被装配进 graph context，但最终回答 reviewer 仍然没有把 DAG 方向当成 release invariant。

这个缺口现在已经在 `src/learning/answerReleaseReview.ts` 中被部分补上，对应的新 gate 是 `claim_graph_order_consistency`。

当前代码已经成立的事实：

- reviewer 现在会消费现有装配好的 DAG 证据，而不是引入新的图运行时：
  - `connectionPaths`
  - `knowledgePointRelations`
  - `predecessorWindow`
  - `successorWindow`
- 第一批方向性检查刻意保持窄口径：
  - `prerequisite`
  - `sequence`
- 这个 gate 只会在草稿回答本身显式声明了 grounded title 之间的顺序关系时才触发。
- 一旦草稿把已支撑的顺序说反，reviewer 现在会输出确定性的纠正句，而不是退回泛化摘要。
- `src/learning/answerReleaseReview.test.ts` 现在已经固定三类关键行为：
  - 前置关系反转必须 `revise`
  - 前置关系方向正确时仍然 clean `release`
  - sequence 反转必须 `revise`
- 这一步关闭了此前“项目 DAG 被低利用”的一部分批评：
  - 现有 DAG 不再只是 answer-planning context，
  - 现在也成为 release-time contradiction boundary。
- 这一步本身并不解决右侧原文预览 / 高亮问题：
  - `workspace_panes.js` 中的点击 / 渲染链路本来就存在，
  - 当前剩余缺口是 source path 与 matched span 的 payload 契约稳定性。

代码 / 方案对齐：

| 要求 | 当前实现证据 | 进度判断 |
|---|---|---|
| 已装配 DAG 必须参与最终 release decision，而不只是回答组织 | `answerReleaseReview.ts` 现在会基于 graph-context 方向性执行 `claim_graph_order_consistency`。 | 已实现基线 |
| 反向的 `prerequisite` 断言必须在 release 前纠正 | reviewer 现在会把 `Ground State is a prerequisite for Bridge Layer.` 这类反向断言改写成 DAG 支撑的纠正句。 | 已实现 |
| 反向的 `sequence` 断言也必须在 release 前纠正 | reviewer 现在会在 DAG 顺序相反时改写 `Response Validation comes before Baseline Measurement.` 这类草稿。 | 已实现 |
| 右侧原文 / 高亮失败仍需要独立 owner | graph-focus 渲染路径本身已经存在；未闭合的是 payload 质量，而不是前端点击事件缺失。 | 仍待解决 |

本切片验证：

- `npm.cmd exec -- jest src/learning/answerReleaseReview.test.ts --runInBand --no-cache`
- `npm.cmd exec -- tsc --noEmit`
- `node scripts/verify-knowledge-workspace-runtime.js --case waterglass_explicit_scope_compact_zh`

## 2026-06-19 Graph-Focus Payload 契约加固

下一个被关闭的缺口并不是 final-answer release review 本身，而是旁边那条证据可用性边界。点击 / 渲染链路原本就存在，真正失败的是：按文档聚合后的知识命中，有时只在 citation-backed 字段里还保留了真实 source path 或 evidence snippet，而 `workspace_panes.js` 过去主要信任原始 top-level `sourcePath` / `matchedSpan.sourcePath`。

当前代码已经成立的事实：

- `src/frontend/workspace_panes.js` 现在会同时从原始 span 字段与 `span.citation` 归一化 `matchedSpans`，覆盖：
  - `title`
  - `snippet`
  - `sourcePath`
  - `startLine`
  - `endLine`
- `buildKnowledgePointFocusPayload(...)` 现在会在打开 graph focus 之前派生 additive `candidateSourcePaths`。
- `resolveKnowledgePointSourcePath(...)` 不再在第一个原始字段处提前停止，而是会扫描：
  - top-level `sourcePath`
  - top-level `citation.sourcePath`
  - `citations[*].sourcePath`
  - `matchedSpan.sourcePath`
  - `matchedSpan.citation.sourcePath`
- `resolveGraphFocusCandidatePaths(...)` 现在会消费这份 additive candidate list，因此即使 grouped knowledge hit 没有单一 canonical top-level path，右侧原文也仍然可预览。
- `src/agent_workspace.frontend.test.ts` 现在已经固定两类具体失败模式：
  - citation-backed snippet 在 markdown render 之后仍然必须能触发高亮；
  - top-level hit path 缺失时，citation-backed path 仍然必须能打开原始文档。
- 截图派生的 `waterglass` 运行时 verifier 继续作为主回答验收 owner；新增的前端契约测试是在其旁边补上 operator evidence surface 的保护，而不是替代它。

为什么这一步重要：

- release-review 鲁棒性与右侧 evidence 可用性是两个不同 owner；
- 主回答再干净，如果运维/开发者打不开支撑原文，系统依旧不够稳；
- 这也再次说明 `ref/` 里的框架不是这个问题的修复 owner：这里坏掉的是本地 payload invariant，不是 prompt orchestration。

代码 / 方案对齐：

| 要求 | 当前实现证据 | 进度判断 |
|---|---|---|
| 右侧预览不能依赖单个原始 top-level hit path | `workspace_panes.js` 现在会从 item、citation、citation list、span 与 span-citation 多个表面派生 additive `candidateSourcePaths`。 | 已实现 |
| citation 里仍有 evidence text 时，高亮不能因 snippet 缺口失效 | `normalizeMatchedSpans(...)` 现在会先从 `span.citation.snippet` 回填 `snippet`，再进入 highlight-term 提取。 | 已实现 |
| top-level path 缺失的 grouped knowledge hit 仍然必须能打开原始文档 | `resolveKnowledgePointSourcePath(...)` 现在会扫描 citation-backed path 来源，而不再停在第一个原始 span path。 | 已实现 |
| 截图驱动的运行时验收仍需保持正式门禁 | `verify-knowledge-workspace-runtime.js --case waterglass_explicit_scope_compact_zh` 仍然是正式要求；新增前端 graph-focus 测试只是补充，而不是替代。 | 已保持 |

本切片验证：

- `npm.cmd exec -- jest src/agent_workspace.frontend.test.ts src/agent_workspace.locale.contract.test.ts src/export/WorkspaceExportBundle.test.ts --runInBand --no-cache`
- `npm.cmd exec -- tsc --noEmit`

## 2026-06-18 共享 alias/scope 回归语料与 soft-miss 恢复

截图驱动的 `waterglass` 失败现在已经不再被当作一次性人工检查。项目已经有了共享的确定性回归语料 `src/learning/KnowledgeWorkspaceConversationRegression.ts`，而这批语料的重要性在于两点：

1. 它把 alias/scope 正确性变成了 Jest 与运行时 verifier 共享的显式契约；
2. 它暴露了单靠 `waterglass` 成功对照组发现不了的真实检索缺陷。

当前代码已经成立的事实：

- 语料当前包含 4 个确定性会话用例：
  - `waterglass_explicit_scope_compact_zh`
  - `waterglass_explicit_scope_spaced_zh`
  - `financial_scope_recovery_spaced_en`
  - `financial_scope_recovery_compact_en`
- 截图派生的 `waterglass_explicit_scope_compact_zh` 现在已经成为 `1781782257390.jpg` 的 durable 验收 owner，而不再只是一次口头复现。
- `src/learning/KnowledgeWorkspaceConversationRegression.test.ts` 会以内存态运行同一批语料，并故意注入 `financial/liquidity.md`、`financial/glass steagall act.md`、`financial/watered stock.md` 作为 scope 内噪声干扰项。
- `scripts/verify-knowledge-workspace-runtime.js` 现在在没有 ad hoc `--query` 的情况下默认加载构建后的语料模块，同时也支持通过 `--case` 只跑指定用例。
- `KnowledgeLearningPlatform.ts` 现在通过 `shouldApplyPlannerScopeRecovery(...)` 决定是否触发 planner scope recovery，而不再只检查 `rerankedItems.length <= 0`。
- 恢复现在会在两类情况下触发：
  - hard miss：rerank 后没有任何结果存活；
  - soft miss：rerank 后仍有结果存活，但其中没有任何一个属于 planner title-hit 文档。

为什么 soft-miss 缺陷重要：

- scoped retrieval 返回“非空结果”并不代表正确；
- 如果逻辑只看绝对 0 结果，就会错过这类“有噪声但仍然错误”的失败；
- `financial` 恢复用例精确证明了这个问题，因为 `glass steagall act` 与 `watered stock` 这类 scope 内噪声文档可能幸存，但真正该被恢复的 title-hit 文档仍然是 `Knowledge_Base/waterglass/water glass.md`。

代码 / 方案对齐：

| 要求 | 当前实现证据 | 进度判断 |
|---|---|---|
| alias/scope 回归覆盖必须显式且共享 | `KnowledgeWorkspaceConversationRegression.ts` 现在已经成为 Jest 与运行时 verifier 共同消费的确定性语料 owner。 | 已实现 |
| 运行时验证不能只覆盖单个 `waterglass` 对照组 | `verify-knowledge-workspace-runtime.js` 现在默认跑共享语料，并支持 `--case` 选择。 | 已实现 |
| scope recovery 必须处理 soft miss，而不只是 0 结果 miss | `KnowledgeLearningPlatform.ts` 现在通过 `shouldApplyPlannerScopeRecovery(...)` 在 planner title-hit 文档全部丢失时触发恢复。 | 已实现 |
| 跨 scope 恢复必须能顶住真实 scope 内噪声 | `financial` 恢复用例故意加入 scope 内噪声文档，但仍要求系统 grounded 恢复到 `Knowledge_Base/waterglass/water glass.md`。 | 已实现 |

本切片验证：

- `npm.cmd exec -- jest src/learning/KnowledgeWorkspaceConversationRegression.test.ts src/learning/KnowledgeLearningPlatform.test.ts src/learning/answerReleaseReview.test.ts src/learning/conversationComposer.test.ts --runInBand --no-cache`
- `npm.cmd exec -- tsc --noEmit`
- `npm run verify:knowledge-workspace:runtime`

## 2026-06-18 紧凑别名作用域检索回归

本切片关闭的是截图驱动的运行时失败：当 `scope=waterglass` 且提问为 `什么是waterglass?` 时，系统会返回：

- `No scoped knowledge points matched "..."`
- trace 中 planner 仍有 title/document 命中，
- 但 rerank 后没有 evidence-bearing retrieval candidates。

这次结论是架构层面的，不是 UI 表象层面的：

- scope normalization 本来就工作正常，
- planner 的 title-like expansion 本来就工作正常，
- 真正断裂的是 planner normalization 与 retrieval scoring 之间的词法契约。

代码 / 方案对齐：

| 要求 | 当前实现证据 | 进度判断 |
|---|---|---|
| 显式 scope 下的紧凑混合别名必须能召回证据 | `KnowledgeLearningPlatform.buildQueryBackendContext()` 现在会基于原始 query 与 planner-derived title-like variant 扩展 retrieval `queryTokens`，并显式传入 `queryVariants`。`queryBackend.ts` 会在 semantic token、anchor inference 与 title matching 中消费这些 variant。 | 已实现 |
| 运行时验证必须覆盖真实回归，而不只是带空格控制组 | `scripts/verify-knowledge-workspace-runtime.js` 现在默认使用共享 alias/scope 语料，其中既有 `waterglass` 双查询，也有跨 scope 恢复用例，`package.json` 也已暴露 `npm run verify:knowledge-workspace:runtime`。 | 已实现 |
| 修复方向必须留在 retrieval boundary，而不是漂到 prompt framework 采纳 | 本次修复是本地 TypeScript runtime normalization。DSPy/Guidance/Semantic Kernel/LangChain/LiteLLM 继续作为设计参考，而不是运行时依赖或补丁手段。 | 已确认 |

本切片验证：

- `npm.cmd exec -- jest src/learning/queryBackend.test.ts src/learning/KnowledgeLearningPlatform.test.ts src/server.migration.test.ts --runInBand --no-cache`
- `npm.cmd exec -- tsc --noEmit`
- `npm.cmd run verify:knowledge-workspace:runtime`

## 2026-06-17 Agent Knowledge DAG 回答契约

本切片在澄清“图结构”指本项目现有 DAG 形态学习数据、而不是泛化图数据库替换方案之后，更新知识工作区 graph/RAG 推进方向。

本切片已实现或已落盘：

- 新的双语事实源文档为 `docs/solutions/agent-knowledge-dag-answer-contract-plan-2026-06-17.md`；
- 开源库研究边界已明确：DSPy、Guidance、Semantic Kernel、LangChain Core 与 LiteLLM 是 `ref/` 下的设计参考，不是运行时依赖；
- `AgentConversationGraphContext` 现在有可选 `connectionPaths` 表面；
- 当 store 具备 ops 能力时，`KnowledgeLearningPlatform` 可以用 store-backed path 查询，把返回 knowledge points 与 anchor 之间的显式路径补入 conversation graph context；
- `conversationComposer` 现在会保持公开 `answer` / `directAnswer` 窄口径，不再嵌入 citation list、graph path、memory notice 或 knowledge-run diagnostics；
- `conversationComposer` 可以在结构化回答 section 中使用这些 explicit paths；
- `queryBackend.ts` 现在已经把中文 compare/how-to/explain 标记纳入 graph intent detection，并对 direct compare branch（`contrast` / `analogy`）相对 reference-only note 做了显式排序校准；
- `conversationComposer.ts` 现在已经把 `graph_comparison_branch` 收紧成真正的 branch-difference gate：仅有 reference-only support 不再被误判为 compare 结构通过；
- `workspace_panes.js` 会在 evidence pane 中渲染 connection paths；
- `knowledge_run` workflow artifact 现在也会保留 `graphContext`，knowledge-run 检查卡片已能把 graph context 与 graph diagnostics 暴露给运维查看；
- recent-run history 与 run-to-run comparison 卡片现在也会暴露紧凑 graph telemetry，运维检查不再只停留在单次 run 检查面；
- `WorkspaceExportBundle` 现在已经暴露 durable 的 `runtime.knowledgeRunReports`，可为离线回放与运维分析提供 compare-ready graph signal summary；
- `workspace_panes.js` 现在会基于 payload + matched-span candidate path 重试 graph-focus 原文读取，记录 requested/candidate/attempted/resolved path 诊断，并在 fallback 或路径回退发生时把这些诊断显示在右侧 pane；
- agent workspace 现在会把有价值的 graph-focus diagnostics 写入 session state，而不再让它们只停留在前端控制器内存里；
- 后续 conversation/study-session 的 session-state 写入现在会保留既有 graph-focus 报告历史，而不是覆盖无关 `panelState` 域；
- `WorkspaceExportBundle` 现在也会派生 durable 的 `runtime.graphFocusReports`，因此 graph-focus 的失败与路径回退事件可以在不解析原始 `panelState` 的情况下离线回放；
- `WorkspaceExportBundle` 会在导出的 conversation trace graph context 中保留 connection paths；
- 聚焦测试覆盖 graph-path composition、platform enrichment、frontend evidence rendering、locale labels 与 export serialization。

代码 / 方案对齐：

| 要求 | 当前实现证据 | 进度判断 |
|---|---|---|
| 公开回答区不能堆内部产物 | `answer` / `directAnswer` 现在保持 targeted；graph connection paths、citations、temporal detail 与 knowledge-run diagnostics 属于次级 inspection 数据。 | 当前切片已实现 |
| 暂时隐藏开发者导向 support material | graph paths、temporal details、citations 与 traces 默认进入 evidence/export surface，除非用户显式要求查看。 | 方向保持 |
| 文件命中打开右侧 pane 并高亮原文 | graph-focus 现在会在 payload + matched-span candidate path 之间重试 source rendering，保留 markdown 高亮渲染，在 pane 内暴露 requested/candidate/attempted/resolved path 诊断，并把有价值的诊断写入 session state、派生为 `runtime.graphFocusReports`。 | 已实现扩展后的 P4 切片 |
| 使用当前 DAG | `KnowledgeAtom`、`RelationEdge`、`TemporalEdge`、store ops 与 `findPath` 是当前活跃图底座。 | 已确认 |
| 让 LLM 查阅图结构 | 有界 `graphContextAssembler` 已在回答合成前选择 anchor、重排 support node、挂接显式路径，并补 predecessor/successor window 与 diagnostics。 | P1 基础已实现 |
| retrieval 不再只是浅层 degree 加分 | `queryBackend.ts` 现在已在 `local_hybrid` / `local_vector` 中使用 anchor distance、directed path confidence、prerequisite depth、temporal invalidity penalty 与 relation-intent bonus；中文 compare/how-to/explain 标记也已进入 intent detection，并对 direct compare branch 相对 lexical 更强的 reference note 做了显式校准。 | 更宽的 P2 切片已实现 |
| 图专项回答质量门禁 | `knowledgeRun.quality.gates` 现在已经检查 prerequisite ordering、comparison branch、temporal warning、graph-op fallback 与 bounded graph budgeting；其中 comparison gate 已收紧，不再把 reference-only support 当成分支结构通过。 | 更宽的 P5 切片已实现 |
| 完整 DAG-native answer planning | assembler、graph-aware ranking、graph-quality gate、graph-focus diagnostics，以及 single-run inspection / history / run-to-run comparison 这些图检查面都已存在，但模型仍需要更广的校准与更长周期的运维证据。 | 校准待推进 |

即时后续方向：

1. 用更多真实回归与运维证据继续校准新的图排序 / 质量门禁模型。
2. 现在 `knowledge_run` telemetry 已通过 `runtime.knowledgeRunReports`、graph-focus diagnostics 已通过 `runtime.graphFocusReports` 进入 export，下一步转为校准这些 replay/export 运维检查面的信号质量。
3. 继续保持公开回答聚焦，同时让 graph/evidence/developer detail 通过 evidence pane、trace、artifact 与 export bundle 可检查。

## 2026-06-10 知识工作区与 DAG 对齐切片

本切片将当前代码库与此前的 lightweight RAG、agent-workspace 和主线架构推进方案重新对齐，重点聚焦于现有 DAG 学习底座与知识工作区的真实实现状态。

核心结论是：当前代码推进得比旧方案文字描述更远，而且本轮切片已经把 P1/P2 的主交互目标推到了当前代码现实里，但产品面与架构面仍有明确缺口。

已经明确有代码支撑的能力包括：

- Knowledge Workspace 不再只是一个薄 scoped-chat 壳层；
- workflow artifact 已包含 durable 的 `flashcard_batch` 与 `knowledge_run`；
- reply rendering 已具备 typed structured-answer 路径；
- workflow-artifact review follow-up 已进入运行时表面；
- graph focus 已能渲染原始 markdown 并高亮 matched span；
- 独立 evidence pane 现已承接 grounding inspection 以及 durable `knowledge_run` / `flashcard_batch` 检查；
- grouped conversation knowledge point 现已保留 relation-path 与 temporal-validity 信号；
- composer 现在会显式构建 `graphContext`；
- 该 `graphContext` 现在也会沿着 conversation trace、snapshot persistence 与 workspace export 一起传播；
- grounding inspector 现在会把持久化的 `graphContext` 渲染为结构化图解释面；
- 关系聚合现在已覆盖整批 grouped knowledge points，而不再只看首个 anchor 的局部提示；
- grouped knowledge points 之间的直接关系现在也会作为一等 `graphContext` 数据被保留，而不再只是隐式 edge 归属；
- 时序有效性聚合现在除 warning text 外，还会保留 temporal edge kind/detail；
- supersession 细节现在也会影响 explanation / next-action 文本，而不再只停留在 warning-only evidence；
- grounding 检查入口现在按当前回合标准化判断，因此后续无 grounding payload 的回合不会继续保留陈旧的 evidence pane 状态。

但当前产品面仍未完全达到目标行为：

- 主回答区现已收缩为只显示用户面的回答块；
- 左侧知识命中现已作为 file-only 入口直接路由到 graph focus；
- 现有 DAG 底座是真实存在的，但 answer synthesis 仍更像 evidence-grouped text RAG，而不是 graph-native answer planning。

本切片的代码 / 方案对齐结果：

| 要求 | 当前实现证据 | 进度判断 |
|---|---|---|
| 结构化 grounded conversation 且保持向前兼容 | `src/learning/types.ts`、`src/learning/conversationComposer.ts`、`src/learning/KnowledgeLearningPlatform.ts`、`src/frontend/agent_workspace.js`、`src/frontend/workspace_panes.js` 现已支持 `answer`、`assistantBlocks`、`knowledgeRun`、按文档聚合的 `knowledgePoints`、citations 与 legacy `assistantMessage`，且主回答区现已只渲染用户面的回答块。 | 当前切片已实现 |
| durable learning/review artifact | `src/workflows/WorkflowArtifactStore.ts`、`src/learning/KnowledgeLearningPlatform.ts` 与 `src/routes/knowledge.ts` 现已支持 durable `flashcard_batch` / `knowledge_run`，以及 `/api/knowledge/workflow-artifacts`、`/api/knowledge/workflow-artifacts/review-follow-up`；`workspace_panes.js` 现已把它们的检查路由到专门的 evidence pane。 | 当前切片已实现 |
| file-first scoped knowledge hit | `workspace_panes.js` 已按 source file 渲染 grouped knowledge hit，并把文件入口直接路由到 graph focus，而不是继续走 inline preview / action 扩展。 | 当前切片已实现 |
| 右侧证据阅读面 | graph focus 已复用共享 markdown runtime，并在原始 markdown 中高亮 matched span。 | 已实现基线 |
| 主回答区收缩为单一 targeted answer | `conversationComposer.ts` 现在让 `answer` / `directAnswer` 保持 targeted；`agent_workspace.js` 会保留完整 conversation result 到 runtime state，但主聊天面仅渲染用户面的回答块（`structured_answer`、`main_markdown`、`html_artifact`）。 | 当前切片已实现 |
| 主命中列表不暴露开发者导向 evidence / action | `workspace_panes.js` 已不再在左侧命中列表中渲染 inline preview 或可见 typed capability button；这些流程现在会路由到 graph focus 或专门的 evidence pane。 | 当前切片已实现 |
| durable evidence / claim inspector | `workspace_panes.js` 现已提供专门的 evidence pane，用于承接 grounding metadata、`knowledge_run`、`knowledge_run_history`、`knowledge_run_compare` 与 `flashcard_batch`；`agent_workspace.js` 也已把 API 状态条接成 grounding inspection 入口，并按当前回合规范清理陈旧 grounding 状态。 | 当前切片已更完整实现 |
| DAG-native answer planning | `AgentConversationKnowledgePoint` 现已保留 grouped `relationPath`、`relationKinds`、`relationPathAtomIds` 与 `temporalValidity`；`conversationComposer.ts` 现已显式构建 `graphContext`；`KnowledgeLearningPlatform.ts` 与 `WorkspaceExportBundle.ts` 也已在 trace / persistence / export 中保留它；`workspace_panes.js` 现在会在 evidence pane 中把该 `graphContext` 渲染成结构化图解释面；关系与时序聚合也已扩展到整批 grouped knowledge points，并保留 source-atom 与 temporal-edge 细节；grouped knowledge points 之间的直接关系现在也会被保留并展示；supersession 细节现在也会进入 explanation / next-action 文本。 | 当前切片已更宽的部分实现 |

从这里出发的即时推进方向：

1. 把当前 DAG-aware 对话切片继续扩展成专门的 graph-conditioned context-assembly layer，而不是停留在 grouped relation hint 与当前仍较薄的 `graphContext` 层。
2. 以当前新增的“整批命中点关系/时序聚合 + evidence-pane 图解释面”为基础，继续补 predecessor / successor / path 语义与 explicit supersession 处理，同时不把复杂度重新塞回主聊天区。
3. 继续缩减 `src/server.ts`、`KnowledgeLearningPlatform.ts`、`agent_workspace.js`、`workspace_panes.js` 的所有权压力。

当前代码对齐切片的本地验证：

- `npm.cmd exec -- tsc --noEmit`
- `node --check src/frontend/agent_workspace.js`
- `node --check src/frontend/workspace_panes.js`
- `npm.cmd exec -- jest src/agent_workspace.frontend.test.ts src/agent_workspace.locale.contract.test.ts --runInBand --no-cache`
- `npm.cmd exec -- jest src/learning/conversationComposer.test.ts src/learning/KnowledgeLearningPlatform.test.ts src/learning/KnowledgeLearningPlatform.persistence.test.ts src/learning/KnowledgeLearningPlatform.program-f.test.ts src/agent_workspace.frontend.test.ts src/knowledge.api.contract.test.ts src/routes/registry.contract.test.ts src/pathbridge.handshake.contract.test.ts src/server.port.fallback.contract.test.ts src/workflows/WorkflowArtifactStore.test.ts --runInBand --no-cache`
- `npm.cmd exec -- jest src/agent_workspace.frontend.test.ts src/agent_workspace.locale.contract.test.ts src/agent_workspace.contract.parity.test.ts src/agent_workspace.runtime.behavior.test.ts --runInBand --no-cache`
- `npm.cmd exec -- jest src/export/WorkspaceExportBundle.test.ts --runInBand --no-cache`
- `npm.cmd exec -- jest src/learning/conversationComposer.test.ts src/learning/KnowledgeLearningPlatform.test.ts src/export/WorkspaceExportBundle.test.ts src/learning/KnowledgeLearningPlatform.persistence.test.ts src/learning/KnowledgeLearningPlatform.program-f.test.ts --runInBand --no-cache`
- `npm.cmd run test:agent-workspace:contracts`
- `npm.cmd run build`

## 2026-06-06 知识工作区 scope 切换器与证据聚焦命中 UI

本切片关闭的是知识工作区前端可用性缺口：旧实现依赖全局文件夹选择器和请求载荷状态，用户在知识工作区内提问时，无法在同一任务窗口中直接确认当前 RAG 检索边界。
同时，旧命中卡片会把摘要、引用、命中 section 与动作按钮全部铺在首层，导致结果返回后提问 / 回复区域容易被挤出视野，也让用户在第一层面对过多选择。

本切片的代码 / 方案对齐结果：

| 要求 | 当前实现证据 | 进度判断 |
|---|---|---|
| 在知识工作区窗口内默认显示并可切换 scope | `src/frontend/index.html` 现在在工作区内加入 `agent-workspace-scope-select`；`src/frontend/agent_workspace.js` 会镜像全局 `folder-select`，发布同一 active-target 事件，更新 `localStorage.nc_last_target`，并在 conversation 请求中发送 `activeTarget` 与 `scope`。 | 已实现 |
| 命中返回后仍保持提问 / 回复区域可见 | `src/frontend/styles.css` 为聊天消息区设置稳定 flex 下限，并限制知识命中列表最大高度，使对话流和输入框不会被结果卡片挤出当前工作区。 | 已实现 |
| 首层命中内容只显示可交互的知识点文件名 | `src/frontend/workspace_panes.js` 现在将每个知识点渲染为文件按钮，文件名来自 `sourcePath`、`citation.sourcePath` 或 `matchedSpans[0].sourcePath`；摘要、得分、引用与命中片段不再作为首层卡片内容。 | 已实现 |
| 其他动作进入长按 / 右键菜单 | typed capability 按钮继续保持向前兼容，但默认隐藏在 `agent-knowledge-actions-menu` 中，只在长按、右键或键盘 context-menu 操作时展开。 | 已实现 |
| 点击知识点后在右侧高亮命中段落 | 点击文件名会打开 graph-focus 面板，展示知识点标题与 `matchedSpans`，每个命中段落作为高亮证据渲染。 | 已实现 |
| 双语文案与契约兼容 | `agentWorkspace.scope.*` 与新增知识点操作文案已经同步到中英 locale bundle，并由 locale contract 测试校验 key 覆盖与占位符一致性。 | 已保留 |

本切片验证：

- `npm.cmd exec -- jest src/agent_workspace.frontend.test.ts -t "scope selector|knowledge hits as file entries" --runInBand`
- `npm.cmd exec -- jest src/agent_workspace.frontend.test.ts --runInBand`
- `npm.cmd exec -- jest src/agent_workspace.locale.contract.test.ts --runInBand`
- `node --check src/frontend/agent_workspace.js`
- `node --check src/frontend/workspace_panes.js`
- `npm.cmd run build`

## 2026-06-07 Graph-focus 原文渲染与 AhaDiff 对比

本切片修正的是知识工作区右侧 graph-focus pane 的剩余交互偏差。
此前虽然右侧 pane 会收到 `matchedSpans`，但实际只渲染了一组紧凑的命中摘录列表。
这意味着用户看不到“原知识点的正常渲染结果”，也就无法在原文语境内查看命中段落是否被正确高亮。

本切片的代码 / 方案对齐结果：

| 要求 | 当前实现证据 | 进度判断 |
|---|---|---|
| 右侧 pane 渲染原知识点正文 | `src/frontend/workspace_panes.js` 现在会解析 `sourcePath`，通过 `NoteConnectionStorage.readContent()` 读取原始 markdown，再经共享的 `NoteConnectionMarkdownRuntime.renderMarkdownInto()` 渲染，而不再只显示摘录卡片。 | 已实现 |
| 在正常渲染的原文中高亮命中段落 | graph-focus pane 现在会用 `matchedSpans[].snippet` 对渲染后的段落/块进行评分匹配，并在 `src/frontend/styles.css` 中通过 `.agent-focus-match` / `data-agent-focus-highlight` 施加适度高亮。 | 已实现 |
| 保留 source 渲染不可用时的降级路径 | 当 source markdown、storage access 或 markdown runtime 不可用时，仍然保留旧的 summary + evidence list fallback，不破坏现有交互。 | 已保留 |
| 保持与现有 Reader-aligned 渲染基底一致 | graph-focus pane 复用了当前 Tauri 回复区域已在使用的 markdown runtime owner，而不是再造一套独立的 markdown / mermaid / math 渲染链。 | 已实现 |

本切片验证：

- `npm.cmd exec -- jest src/agent_workspace.frontend.test.ts -t "graph focus|knowledge hits as file entries" --runInBand --no-cache`
- `npm.cmd exec -- tsc --noEmit`

### AhaDiff 对比与推进含义

最新版 `ref/ahadiff` 对本项目后续推进最有价值的地方，不是某个单点 UI，而是它把 claims、evidence、runtime validation、review state 都做成了一等产品面，而不是隐藏在后端或一次性结果中的细节。

1. 它把 evidence 当成可验证的产品对象，而不是回答字符串的附属说明。
   `ref/ahadiff/src/ahadiff/claims/verify.py` 会把 claim 严格绑定到 file/hunk anchor，而不是接受松散文本解释。
   `ref/ahadiff/viewer/src/api/schemas.ts` 也把 viewer 的 API 边界做成 runtime validation，而不是只信 TypeScript。
2. 它把 review/challenge/adapt 做成 durable learning loop，而不是一次性输出。
   `review.sqlite` 在 `ref/ahadiff/src/ahadiff/review/database.py` 中是明确的持久化边界，`ref/ahadiff/src/ahadiff/challenge/engine.py` 会把“没学会的点”重新转成后续学习信号。
3. 它的 UI 结构按任务面和状态面分离，typed API + typed store + page/component owner 更清晰。
   Shell、API schema、store、page/component 被拆开，避免一个大型宿主文件同时拥有太多产品状态与交互逻辑。

这对本项目的推进方向意味着以下缺口更清晰：

| 领域 | 当前 NoteConnection 位置 | 相比 AhaDiff 式成熟度的不足 | 下一步 |
|---|---|---|---|
| Evidence 模型 | 已有 scoped citation 与 `matchedSpans`，但 evidence 仍主要停留在单轮回答载荷里。 | 缺少能跨回合、跨学习任务复用的第一类 evidence ledger。 | 为 agent answer / 学习产物引入 durable evidence/claim projection。 |
| Runtime contract validation | 已有 TypeScript 契约，但前端运行时边界的 schema validation 仍不均匀。 | UI 仍可能过度信任结构漂移的 payload。 | 在 agent-workspace API 边界继续扩展 runtime schema validation，尤其是 richer assistant payload 和后续学习状态端点。 |
| Durable learning loop | 已有 conversation memory，但 challenge/review/adapt 的学习回路还很浅。 | 缺少把“未理解 / 弱回答”自动回写成后续学习任务或复习信号的机制。 | 构建显式 agent learning loop：answer -> inspect evidence -> mark confusion/gap -> schedule guided follow-up。 |
| UI 信息架构 | Tauri workspace 正在改善，但大型 host 仍承载过多 orchestration，且 retrieval/action/diagnostics surface 仍较密。 | 交互面拆分与状态所有权还不如 AhaDiff 清晰。 | 继续从大型 workspace host 中抽离清晰 owner，并把高密度 diagnostics/learning surface 推向 typed state 模块。 |
| 跨运行质量治理 | foundation 与 runbook gate 已存在，但 answer quality 与 learning effectiveness 还缺同等级持久治理。 | 缺少能稳定推动 agent 学习质量上升的 quality ratchet。 | 增加持久化的 answer-quality / evidence-coverage / follow-up-effectiveness history，用它驱动策略而不只做快照展示。 |

## 2026-06-06 active scope miss recovery 与 document-augmented RAG 修复

本次补丁修复了 WebView 已在 `npm run tauri:dev:mini:gpu` 中运行时复现的 “what is water glass?” 失败。

运行时探针显示：当前 sidecar 如果显式使用 `waterglass` scope 调用，会正确返回 1 个按知识点合并后的结果、8 条引用以及 `matchedSpans`。
但 WebView 当前状态是 `folder-select=financial`、`localStorage.nc_last_target=financial`，并且 `window.__NC_ACTIVE_SOURCE_TARGET.scope.sourcePathPrefixes=["Knowledge_Base/financial"]`。
因此用户问题实际上被发送成了 financial 限定范围内的 scoped query。旧 planner 虽然能在全局找到 `water glass` 的 title-like 文档命中，但随后把该 document id 与显式 financial workspace/corpus/prefix scope 做交集，最终把候选集压成 0 个 indexed atoms。

本补丁的代码 / 方案对齐结果：

| 要求 | 当前实现证据 | 进度判断 |
|---|---|---|
| 当前 scope 未命中但问题明确指向另一个知识点时仍能正面回答 | `buildQueryBackendContext()` 现在会区分 title hit 是否落在请求 scope 内。如果显式 scope 内没有兼容 title hit，但其他位置存在明确文档标题 / 别名命中，检索会切换到 document-only 的 `planner_scope_recovery` scope，而不是继续相交不兼容的 corpus 约束。 | 已实现 |
| 按知识点返回，而不是重复返回 section | 之前的 document-level conversation grouping 继续保留。recovery query 内部仍保留 segment-level evidence，然后由 `mergeAgentConversationKnowledgePoints()` 按 `documentId` 合并，并把命中的 section 作为单一知识点卡片内的 `matchedSpans` 展示。 | 已实现 |
| RSE + document augmentation 推进方向 | 当前实现把 Relevant Segment Extraction 留在检索阶段，同时在 planning 阶段加入 document augmentation：title-like query 可以恢复目标文档，文档内 section 命中会成为标注证据片段，而不是重复卡片。 | Operational baseline |
| 用户可见 scope 诊断 | Knowledge Workspace API 状态条现在会显示 active scope；如果触发 recovery，还会显示恢复到的 source path。用户可以直接看到类似 “Scope: financial” 与 “Recovered: Knowledge_Base/waterglass/water glass.md” 的状态。 | 已实现 |
| 向前兼容 | 公共响应字段只做加法。既有 `assistantMessage`、`answer`、`assistantBlocks`、citations、legacy sync/SSE 流程都继续保留。`scopeSource` 仅新增可选值 `planner_scope_recovery`，不删除旧值。 | 已保留 |

本补丁验证：

- Red/green 后端回归：`KnowledgeLearningPlatform.test.ts` 现在覆盖 active scope 为 `financial`、title-like query 为 `water glass` 时恢复到 `waterglass` 文档，并返回 1 个包含多个 matched spans 的合并知识点。
- Red/green 前端回归：`agent_workspace.frontend.test.ts` 现在覆盖状态条中的 active scope 与 recovered source 可见性。
- 运行时根因证据：CDP 显示当前 WebView scope 是 `financial`；直接用 `waterglass` scope 探针调用 sidecar 时，后端已能正确返回分组证据。

## 2026-06-06 知识工作区 RAG 回答与 API 可观测性切片

本次更新修复的是 `npm run tauri:dev:mini:gpu` 已经运行时暴露出的实际知识工作区问题：运行中的 sidecar 在完成 hydration 后已经可以召回 `waterglass` 作用域证据，但用户可见回答仍使用旧的 “strongest scoped match” 模板，并且会把同一知识点文档内的多个 section 命中渲染成重复知识点卡片。

本切片的代码 / 方案对齐结果：

| 要求 | 当前实现证据 | 进度判断 |
|---|---|---|
| 用户可见 API 调用状态 | 知识工作区新增 `/api/knowledge/conversation` 紧凑状态条，显示 idle/pending/ok/error、传输方式（`SSE` 或 sync fallback）、延迟、知识点数、引用数与记忆数（`src/frontend/index.html`、`src/frontend/agent_workspace.js`、`src/frontend/styles.css`）。 | 已实现 |
| 正面 grounded answer | `agentConversation()` 现在优先用最强证据句生成顶层 `answer` 和 `Scoped Answer` 块，再追加 grounding 计数与引用；成功解释型回合不再强制以 “The strongest scoped match is...” 开头（`src/learning/KnowledgeLearningPlatform.ts`）。 | 已实现 |
| 按知识点合并返回 | 底层 `queryKnowledge()` 仍保留 atom/section 级召回粒度，但面向用户的 conversation `knowledgePoints` 已按 `documentId` 分组，并向前兼容地新增可选 `atomIds`、`documentId`、`sourcePath`、`matchedSpans`、`citations`、`matchCount` 字段（`src/learning/types.ts`、`src/learning/KnowledgeLearningPlatform.ts`）。 | 已实现 |
| RSE / document augmentation 推进 | 响应结构现在把“检索证据片段”和“知识点卡片身份”分开：同一文档内重复命中会作为同一卡片内的 matched spans 展示，而不是重复卡片。这是当前轻量 RSE 边界：召回保持 segment-level，回答与 UI 呈现升级为 evidence-grouped + document-augmented。 | Operational baseline |
| 运行态注意事项 | 已运行的 `server.exe` sidecar 不会热替换 TypeScript/backend 变更。`npm run build` 与 `npm run ensure:sidecar:dev` 已准备好修复后的 dev sidecar，但当前打开的 `tauri:dev:mini:gpu` 窗口需要重启才能加载新的后端二进制。 | 运维说明 |

本切片验证：

- Red/green 回归覆盖：`KnowledgeLearningPlatform.test.ts` 现在验证 `water glass` 的直接回答与 matched spans 分组；`agent_workspace.frontend.test.ts` 验证同一卡片命中渲染和 API 状态面板。
- 本地已复核：`npm.cmd exec -- jest src/learning/KnowledgeLearningPlatform.test.ts --runInBand`、`npm.cmd exec -- jest src/agent_workspace.frontend.test.ts --runInBand`、`npm.cmd exec -- jest src/server.migration.test.ts -t "conversation route auto-hydrates|knowledge/conversation" --runInBand`、`npm.cmd exec -- jest src/agent_workspace.contract.parity.test.ts src/agent_workspace.runtime.behavior.test.ts --runInBand`、`node --check src/frontend/agent_workspace.js`、`node --check src/frontend/workspace_panes.js`、`npm.cmd run build`、`npm.cmd run ensure:sidecar:dev`。

## 2026-06-06 主线架构推进与代码 / 方案对齐

本次更新将当前 `main` 代码与 5 月架构方案重新对齐，并明确覆盖旧口径中的一个关键误差：Program F 交付不等于底座已经达到 release-grade production closure。

当前权威参考：

- 双语详细方案：[架构推进对齐与主线推进方案（2026-06-06）](../../../solutions/architecture-progress-alignment-2026-06-06.md)
- 先前 RAG / agent 方案：[多平台轻量级 RAG 与 Agent 架构推进计划](../../../brainstorms/2026-05-25-multiplatform-lightweight-rag-agent-architecture-plan.md)
- 先前 substrate 方案：[Deep Student Comparison Next-Phase Plan](../../../brainstorms/2026-05-26-deep-student-comparison-next-phase-plan.md)

代码 / 方案对齐结果：

| 方案要求 | 当前 `main` 代码证据 | 进度判断 |
|---|---|---|
| Scoped retrieval 与 workspace/corpus 边界 | `src/learning/types.ts`、`src/learning/KnowledgeLearningPlatform.ts`、`src/workspace/`、`src/export/` 中已经存在 `KnowledgeQueryRequest.scope`、`KnowledgeCorpusScope`、workspace readiness、miss diagnostics、active-target hydration 与 workspace/export 底座。 | 已有实现基线 |
| Lightweight RAG 与 grounded conversation | `AgentConversationResponse` 已包含 `answer`、citation、memory action、trace 和向前兼容的 `assistantBlocks`；Tauri workspace 在结构化块存在时渲染 typed blocks，并继续支持 legacy `assistantMessage`。 | Operational baseline |
| Resource/index/workspace/session/memory/export 持久化底座 | Program A-F 已在 `src/resources/`、`src/indexing/`、`src/workspace/`、`src/session/`、`src/workflows/`、`src/memory/`、`src/export/` 中落地。 | 已实现 |
| 平台壳层分离 | `PlatformCapabilities`、`RenderMaterializer`、render routes、workspace export bundle 已显式化桌面/Godot/mobile materialization 决策。Godot 仍保持 PNG-first，因为直接 SVG 导入不可靠。 | 已实现 |
| graphdb/ANN 运行时生产闭环 | graphdb/sqlite、external graphdb HTTP、local-vector rollout controls、external HTTP vector acceleration、runtime capability checks 与 rollout profile payloads 已存在。 | Operational，但未 production-closed |
| 唯一路由 / 运行时所有权 | modular route registration 已存在，runtime runbook 的 modular-route operation 现在也已有独立 owner `src/routes/runtimeRunbookRouteOps.ts`，但 conversation、turn-cache、rollout、fallback 编排仍大量留在 `src/server.ts`。 | 部分完成 |
| 架构缩减 | 当前行数扫描显示 `src/server.ts` 约 15,920 行、`src/learning/KnowledgeLearningPlatform.ts` 约 10,351 行；主要前端宿主文件仍偏大。 | 落后于目标 |

架构推进图：

| 层级 | 当前成熟度 | 下一步 |
|---|---|---|
| 图谱 / Path 核心 | 成熟 operational baseline | 保持兼容，避免无关重构。 |
| 运行时存储 / 检索 | Operational baseline | 当前 Windows 宿主的严格 release-evidence 历史审计已经在 sqlite 与 ANN 两侧都达到 3/3 并通过，readiness 已通过 `foundation_release_evidence_history` 暴露该门禁，且 opt-in 多宿主审计脚本已经存在；下一步是真实多宿主证据与阈值校准。 |
| Scoped RAG / conversation | Operational baseline | 在不删除 legacy 响应字段的前提下，从 `server.ts` 切出所有权。 |
| Memory / session / workflow | 已实现底座 | 先加固 policy、audit 与 workflow artifact 质量，不堆 UI-only 状态。 |
| Export / platform shell | 已实现基线 | 继续显式维护 Godot/mobile materialization 与 export profile 规则。 |
| Governance / CI | 强，但依赖部分宿主证据 | 将 FR-009、Linux strict Tauri 证据、graphdb/ANN 校准和文档真相作为分开的门禁。 |

即时推进方向：

1. 让本看板、task、implementation plan、TODO、README、接口文档与新增 solution note 保持同一套文档真相。
2. 完成 graphdb 与 ANN 发布级闭环：使用新的 opt-in 多宿主证据门禁，把严格 release-evidence 历史证据扩展到当前 Windows 宿主之外，收紧 graphdb connector budget，校准 ANN release-gate matrix 的 recall/latency 阈值，并收集 strict rollout 证据。
3. 从 `server.ts` 切出 turn-cache、alert trend、runbook bridge、rollout helper 等所有权压力。
4. 继续拆分 `KnowledgeLearningPlatform.ts`，但只在新 owner 能隐藏状态或强制不变量时提取。
5. 通过 typed optional payload 扩展 assistant block 覆盖面，同时保留 `assistantMessage` 与 stream/sync/replay 兼容。
6. 将 Godot/mobile 约束留在平台 adapter 边界，尤其保持“不直接依赖 SVG 导入”的规则。

2026-06-06 对齐与 P1 证据切片的验证位置：

- 初始对齐更新仅修改文档；当前 P1 evidence-history/readiness 切片会修改 verifier tooling、package scripts、测试与 readiness mandatory checks，不改变公开运行时 API。
- 当前切片需要执行：foundation release-evidence 契约测试、foundation readiness 回归测试、默认/严格 release-evidence 校验、migration tests、docs map 校验、docs site build、Mermaid fence 护栏、diff review，以及提交后 clean worktree。
- 后续代码切片仍必须继续执行活跃 task 文档中的运行时门禁，尤其是 `verify:foundation:sqlite-runtime:soak`、`verify:foundation:ann-runtime:matrix`、`verify:foundation:release-evidence`、`verify:foundation:release-evidence:strict`、`test:agent-workspace:contracts` 与 `verify:core-real-machine:clean`；当 release window 需要宿主多样性时，发布负责人应额外加入 `verify:foundation:release-evidence:multi-host`。
- ANN 发布级校准切片应使用 `verify:foundation:ann-runtime:release`；完整 matrix release-gate 路径已有 Windows 宿主新鲜证据，`verify:foundation:release-evidence` 会在这些报告被作为发布上下文前确认最新 sqlite/ANN release 报告仍然新鲜，readiness 也已通过 `foundation_release_evidence_history` 暴露严格历史审计，`verify:foundation:release-evidence:multi-host` 现在可以强制每个组件覆盖 2 个不同 host key。`verify:foundation:release-evidence:strict` 当前已在 Windows 宿主上以 sqlite `3/3` 与 ANN `3/3` 通过，因此剩余证据缺口是真实多宿主 release evidence 与校准，而不是本地报告数量。

## 2026-05-27 工作流门禁重对齐与进度真相同步

- 当前分支其实早已把仓库自有 workflow 迁移到 `actions/setup-node@v4` + `node-version: "24"`。
- `main` 上真正的故障比旧文档描述得更窄：
  - `scripts/verify-fixrisk-issues.js` 仍在强制要求已经移除的 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` 过渡覆盖变量，
  - 因而 `FR-010` 会在“workflow YAML 已经迁移完成”的前提下继续失败。
- 本轮把三层真相一起对齐：
  - verifier 现在校验的是当前 Node 24 / 无覆盖变量基线，
  - fixrisk 实时状态文档现在准确描述该基线，
  - 活跃进度 / task / implementation 文档不再把“某次曾经绿过”写成静态事实。

这次修正的代码 / 方案现实矩阵：

| 区域 | 先前期望 | 当前 HEAD 现实 | 状态 |
|---|---|---|---|
| FR-010 workflow 闭环 | 继续保留旧的 Node24 兼容覆盖变量 | 仓库自有 workflow 已经稳定在 `setup-node@v4` + `node-version: "24"`，且应继续保持“不依赖已删除覆盖变量” | Corrected |
| Fixrisk code-level gate | workflow 迁移早已“算完成” | verifier 逻辑落后于 workflow 真相，需要同步升级到新基线 | Corrected |
| 剩余 Node 20 预警 | 只要 `setup-node` 升到 24 就应完全消失 | 一部分注解仍来自 `upload-artifact`、release helper 等 marketplace action 运行时，属于外部非阻塞债务 | Tracked |
| 进度文档口径 | 之前可以一直沿用“remote CI 已恢复为绿” | 现在必须区分仓库自有闭环、外部运行时债务与 live-run 状态 | Corrected |

从这里出发的即时推进方向：

- 持续保持 live `main` 上的 `Fixrisk Operational Readiness` 与 `Migration Gates` 为绿，
- 在不破坏共享 Reader-derived render substrate 的前提下，继续扩展 Tauri-first rich reply，
- 保持 Program F substrate 稳定，同时承认真正的工程前线仍是 Phase-1 / Phase-2 的发布级校准，
- 持续推动架构缩减，因为 `server.ts`、`KnowledgeLearningPlatform.ts` 与前端宿主文件仍然过大。

## 2026-05-27 Tauri-first 对话渲染现实同步

- 当前分支已经明显超出了上一次只强调 Program F 收口的状态快照。
- 目前代码真相至少覆盖了五个此前文档低估的切片：
  - scoped knowledge workspace grounding 已经真实落地，而不再只是“图已加载”的乐观假设，
  - Tauri Reader 的 markdown / math / mermaid 渲染链已经显著加固，
  - provider settings 与 TOML template 管理已经产品化进入前端，
  - conversation turn / resume 头的 CORS 兼容性已修复，
  - 桌面运行时调试与证据采集工具已成为仓库内正式能力，而不是一次性手工流程。

当前 HEAD 已真实落地：

- Knowledge workspace 闭环：
  - `src/frontend/source_manager.js` 现已发布 active source target，
  - `src/frontend/agent_workspace.js` 现已随 conversation 请求发送 `activeTarget` 与 scoped prefixes，
  - `src/server.ts` 现已执行 active-target-aware workspace hydration 与 selective title-like hydration，
  - `src/routes/data.ts` 不再用 stub 行为遮蔽真实 build / restore-cache 链路，
  - `src/learning/KnowledgeLearningPlatform.ts` 现已暴露 `workspaceReadiness`、`missDiagnostics`、title-hit planner 与 request inspection 辅助能力。
- Reader / runtime 渲染加固：
  - `src/frontend/reader.js` 现已在一条统一 runtime 路径中处理 raw markdown、KaTeX 与 Mermaid，并保留 frontend render first + backend PNG fallback，
  - `src/frontend/app.js` 现已抑制泄漏出的 Mermaid 错误工件，避免长时间错误块占据 Tauri 前台视窗，
  - `src/notemd/MermaidProcessor.ts`、`src/reader_renderer.ts` 与 `src/routes/render.ts` 已强化 Mermaid / Math 的 parity 与 render-service 行为。
- Provider / settings 交付：
  - `src/frontend/index.html`、`src/frontend/settings.js`、`src/notemd/AppConfigToml.ts`、`src/notemd/providerTemplates.ts` 与 locale bundles 现已提供独立的 agent/provider 设置页、预设模板与 TOML 模板落盘能力，
  - `API version` 字段也已经在产品层有解释，不再只是暴露一个没有说明的原始配置项。
- Runtime transport 兼容性：
  - `src/middleware/cors.ts` 现已显式允许 `x-agent-conversation-turn-id` 与 `x-agent-conversation-resume-turn-id`，从而关闭之前破坏 browser/Tauri conversation retry 的 preflight 故障。
- 调试与取证链路：
  - 仓库现在正式提供 page / webview / window 抓取工具与 Mermaid 分阶段导出脚本，Tauri 运行时故障可通过一等调试命令取证，而不再依赖一次性人工排查。

Tauri-first reply rendering 基线已交付：

- `src/learning/types.ts` 与 `src/learning/KnowledgeLearningPlatform.ts` 现已在保留 legacy `assistantMessage` 的同时返回向前兼容的 `assistantBlocks`，
- `src/frontend/markdown_runtime.js` 现已承载一套从 Reader 侧逻辑抽取出来的共享 markdown / math / mermaid runtime，
- `src/frontend/workspace_panes.js` 现已在结构化载荷存在时通过 typed blocks 挂载 assistant reply，而不再只走纯文本，
- `src/frontend/agent_workspace.js` 继续保留 legacy fallback，因此旧的 `assistantMessage`-only 路径仍然可显示。

在这条基线之上，当前代码又前进了一步：

- `src/learning/KnowledgeLearningPlatform.ts` 不再把 `assistantBlocks` 当成“同一段旧 answer 的运输包装层”，
- scoped conversation reply 现在会先组织成明确的 overview / explanation / evidence summary / memory notice / action guidance，再追加 citations 与 knowledge-action affordance，
- 这些 section 现在也会吃进真实 scoped 数据，而不再只是模板填充：explanation 会锚定最强 scoped point，evidence summary 反映真实 citation，action guidance 还会带上 memory follow-through hint，
- reply policy 现在也具备 intent awareness，因此 comparison-style 与 how-to-style prompt 可以把 explanation 和 next-action section 引导成不同语气与用途，
- 这意味着即便底层知识命中集合没变，Tauri 中的 agent 输出也已经可以在结构上明显不同。

在这条渲染/语义基线之上，当前架构质量也向前推进了一步：

- agent-conversation reply composition 已不再被视为永久内联在 `KnowledgeLearningPlatform.ts` 中的所有权，
- 新的 `src/learning/conversationComposer.ts` 现在负责 grouped knowledge-point 组装与 scoped reply section synthesis，
- 这在不改变公开 `AgentConversationResponse` 契约、也不改现有 Tauri/browser 渲染路径的前提下，降低了 KLP 的局部压力。
- 这次抽取刻意保持为“小而明确的所有权切分”，而不是再加一层抽象：KLP 继续持有 runtime state 与 persistence，新的模块只持有纯数据组合逻辑。

当前剩余缺口已经收窄为：

- 当更多端点开始返回 richer assistant payload 时，继续扩充 block 覆盖面，
- 让新的共享 render substrate 在真实 browser/Tauri 运行时下持续经受验证，
- 为后续 Godot 降级 / 物化保留干净边界，而不是重新把 Godot 约束塞回当前 Tauri UX。

## 2026-05-27 Phase-1 SQLite Soak Gate 基线

- embedded `graphdb/sqlite` 基线现在不再只停留在“重启连续性 + workload envelope”证明。
- 当前 HEAD 还新增了一条专用的主机级 soak/performance verifier：
  - `npm run verify:foundation:sqlite-runtime:soak`
  - 会把结构化 JSON 报告写入 `output/verification/foundation-sqlite-runtime/`，
  - 并把发布级证据与较轻量的 `smoke` / `medium` / `heavy` 矩阵验证分开。

这条新门禁当前能够证明：

- `dist` runtime 与 packaged sidecar 两条路径上的重复重启周期，
- startup / ingest / readiness / diagnostics / query 五类时延统计摘要，
- 面向 sqlite 基线的 p95 / max latency 阈值门禁。

这条门禁当前仍不能单独证明：

- 跨多宿主、长时间窗口的稳定证据，
- 面向异构机器的最终发布阈值校准，
- A8 已经完全达到 production-closed。

这条切片的代码 / 方案现实矩阵：

| 区域 | 先前期望 | 当前 HEAD 现实 | 状态 |
|---|---|---|---|
| Knowledge workspace grounding | scoped query 应命中当前选中的 corpus，而不是只依赖已加载图数据 | active target、scope prefixes、title-like hydration、workspace readiness 与 miss diagnostics 已贯通前端、server 与 KLP | Operational |
| Tauri markdown reader parity | markdown、公式与 Mermaid 应能在真实运行时稳定显示且不留下持久错误遮罩 | Reader / runtime 现已支持 Mermaid frontend-first + backend-PNG fallback，并抑制泄漏错误工件 | Operational |
| Provider settings | provider / model / API key 控件应独立成页并可写入 durable TOML 配置 | 专用 agent/provider 设置页与 preset/TOML template helpers 已落地 | Operational |
| Conversation retry transport | turn / replay 头应能通过 browser/Tauri preflight | CORS 已允许两类 conversation turn 头 | Closed |
| Tauri agent reply rendering | assistant reply 应能显示 rich markdown，而非纯文本 | backward-compatible `assistantBlocks` 与共享 markdown runtime 已驱动 rich assistant reply，legacy `assistantMessage` 仍然保留 | Operational |

## 2026-05-26 Program F 收口状态

- 基于 deep-student 对照得出的下一阶段计划，当前 HEAD 已经实现到 Program F。
- 这套 durable substrate 不再只是规划项，而已经真实落入代码：
  - canonical resource 与 projection：`src/resources/`，
  - unit / segment indexing lifecycle：`src/indexing/`，
  - durable workspace / corpus entity：`src/workspace/`，
  - session / workflow durability：`src/session/`、`src/workflows/`，
  - typed memory governance 与 audit：`src/memory/MemoryGovernance.ts`，
  - deterministic workspace export bundle：`src/export/WorkspaceExportBundle.ts`。
- `KnowledgeLearningPlatform.ts` 现在会把这些 substrate 层与 graph、mastery、conversation、telemetry 状态一起持久化与恢复。
- `POST /api/knowledge/export/workspace` 现已作为 Program F 的 bundle 导出入口暴露出来。
- 平台导出语义也已经显式化，而不再依赖隐式推断：
  - `src/platform/PlatformCapabilities.ts` 已描述 bundle packaging mode（`full` / `slim`）与 indexed-readiness 要求，
  - `src/platform/RenderMaterializer.ts` 继续负责在 SVG 不安全的平台上强制 PNG-first materialization。

这次收口的最新验证证据：

- `npm.cmd run build:mini`
- `npm.cmd test -- --runInBand src/resources/ResourceRegistry.test.ts src/workspace/WorkspaceRegistry.test.ts src/indexing/IndexLifecycle.test.ts src/session/SessionStateStore.test.ts src/workflows/WorkflowArtifactStore.test.ts src/memory/MemoryGovernance.test.ts src/export/WorkspaceExportBundle.test.ts src/platform/PlatformCapabilities.test.ts src/platform/RenderMaterializer.test.ts src/routes/registry.contract.test.ts src/learning/store.test.ts src/learning/KnowledgeLearningPlatform.test.ts src/learning/KnowledgeLearningPlatform.persistence.test.ts src/learning/KnowledgeLearningPlatform.program-f.test.ts`

工程含义：

- mobile slim export 与 desktop export 现在已经收敛到同一套 workspace / resource / index / session / memory substrate，
- lightweight local RAG 与多平台导出现在共享同一份 durable scope model，而不是各自维护一套 ad hoc 状态路径。

## 2026-05-12 HEAD 现实校准

- 先前“Phase-1 已收口”的表述对当前 HEAD 过于乐观，现以本节为准。
- 当前已经真实落地的部分：
  - `src/learning/store.ts` 已具备 file-backed ops、embedded SQLite graphdb persistence/query 路径，以及 HTTP adapter 语义路径，
  - embedded sqlite 基线现在还具备了重启耐久性证明：shutdown 会干净关闭 store，adapter 可安全重开，server integration 已覆盖 ingest -> shutdown -> fresh module reload -> diagnostics/query/readiness 连续性，
  - 现在已有一条主机级验证器，会在当前 Windows 宿主上分别走 `dist` runtime 与 packaged sidecar 两条路径，证明同一条 embedded sqlite 基线可以完成 ingest -> store diagnostics/foundation readiness -> restart -> query 连续性（`scripts/verify-foundation-sqlite-runtime.js`），
  - 现在还有一条主机级 workload matrix 验证器，把同样的证明扩展到 `smoke` / `medium` / `heavy` 三档语料规模：在同样两条 runtime 路径上验证 snapshot metadata 计数、restart 连续性与多点 query 连续性（`scripts/verify-foundation-sqlite-runtime.js --matrix`），
  - foundation readiness mandatory checks 现在已包含面向发布的 sqlite soak 别名（`verify:foundation:sqlite-runtime:release`）、ANN matrix release gate（`verify:foundation:ann-runtime:release`）、release-evidence 新鲜度校验器（`verify:foundation:release-evidence`）与严格 release-evidence 历史校验器（`verify:foundation:release-evidence:strict`），因此运维侧 readiness 输出与发布证据使用的 package scripts 保持一致，
  - 现在也已有一条主机级 ANN 验证器，会在当前 Windows 宿主上分别走 `dist` runtime 与 packaged sidecar 两条路径，证明同一条 `external_http` connector baseline 可以完成 ingest -> live query-backend diagnostics -> restart -> query 连续性（`scripts/verify-foundation-ann-runtime.js`），
  - 现在还有一条主机级 ANN workload matrix 验证器，把同样的证明扩展到 `smoke` / `medium` / `heavy` 三档语料规模：在同样两条 runtime 路径上验证 sync/select telemetry、aligned representation metadata 与 restart 连续性（`scripts/verify-foundation-ann-runtime.js --matrix`），
  - ANN verifier 现在也新增了 release-gate 模式与结构化报告输出：`scripts/verify-foundation-ann-runtime.js --release-gates` 会把 startup / ingest / diagnostics / query duration summary 与 targeted-query recall 写入 `output/verification/foundation-ann-runtime/`，`npm run verify:foundation:ann-runtime:release` 则接入完整 matrix 发布路径，
  - `scripts/verify-foundation-release-evidence.js` 现在会读取最新 sqlite soak 与 ANN release-gate 报告，校验有界新鲜度、必需 profile、两条 runtime mode、sqlite soak gates、ANN release gates 与 expected recall，扫描带时间戳的历史报告，报告 host-key 覆盖度，并把聚合 release-evidence 摘要写入 `output/verification/foundation-release-evidence/`；默认审计每个组件要求 1 份有效新鲜报告，`verify:foundation:release-evidence:strict` 要求 3 份且当前 Windows 宿主已通过，`verify:foundation:release-evidence:multi-host` 还要求 2 个 host key，
  - `src/learning/queryBackend.ts` / `src/learning/vectorAccelerationAdapter.ts` 现已具备 ANN 风格 prefilter、representation telemetry、circuit health、远端索引同步，以及 live `external_http` connector 证明，
  - runtime capability / runbook 治理也已新增显式的 ANN 远端索引同步健康度检查（`query_vector_acceleration_index_sync_health`），与 prefilter、health、traceability、circuit 并列，
  - runtime capability 治理现在也新增了显式门禁 `query_vector_acceleration_calibration_readiness`，用来正式回答当前 ANN 路径是否已经具备进入发布级阈值校准的前提条件，
  - `server.ts` 现已补齐对应的 operator 闭环：该 sync-health 门禁已经进入 verification escalation、remediation action queue、以及 per-check runbook history summary，
  - agent workspace 的 runtime-runbook 前端面现已把面向运维的 ANN 治理直接前推到壳层：verify/checks 不仅能看到 sync-health，还能看到熔断预算、可追踪性、预筛选摘要，并进一步看到用于校准的阈值/信号钻取、校准就绪态以及显式校准门禁；action-queue 则继续承载 index-sync 事故钻取，
  - modular `src/routes/knowledge.ts` 的 runtime-runbook 路由面现在也会委托到真实 server 侧 runbook ops，并完整透传 query 参数，因此浏览器/运行时消费者不再命中旧的 KLP placeholder verify/history/checks/action-queue/remediation/schedule 响应，
  - 浏览器 strict smoke 现在也会用真实浏览器证据证明这批 ANN runbook 面：verify 卡的 ANN sync/熔断/可追踪性/预筛选内容及阈值/信号/校准就绪标签、checks 卡的首个检查 ANN sync 加熔断/可追踪性/预筛选快照，以及 action-queue 的 index-sync 钻取都已纳入端到端断言，而不再只停留在组件测试层，
  - agent workspace 的 locale 治理现在也更严了：双语 locale bundle 已补齐 strict browser smoke 实际触达的 query/quality/runbook 卡片文案，`src/agent_workspace.locale.contract.test.ts` 会阻断源码引用的 `agentWorkspace.*` key 漂移，而启动期 `translate()` 也不再在 locale 初始化完成前发出误报式 missing-key warning，
  - `src/learning/KnowledgeLearningPlatform.ts` 中的 Phase-2 运行时诊断面已接通真实实现，包括 query-backend comparison/history/trend、knowledge staleness diagnostics/rebuild planning、learning-quality history/trend、session-plan quality evaluate/history/trend/runtime-threshold diagnostics、query-backend config、query-backend diagnostics，
  - Phase-3 的导师/记忆诊断仍为真实实现，且 `src/server.ts` 现已注入默认激活态 tutor adapter，正常 server 路径可直接产出 adapter telemetry。
- 当前仍未闭环的部分：
  - Phase-1 A8 已经超出 file-only 默认态：`src/server.ts` 现在默认走 `graphdb/sqlite` 并保留显式 file fallback，重启耐久性已证明，主机级 dist/runtime + packaged sidecar 证明也已具备，而且 `smoke` / `medium` / `heavy` 主机端 workload matrix 也已具备；但在宣布本地图后端达到生产闭环之前，仍需补齐 soak、长时段与性能级加固；
  - Phase-1 A9 现已进入 operational baseline，而不再只是 scaffolding：主机级 runtime 证明、主机级 workload matrix 与 matrix release-gate 证据也已具备；但在宣布 ANN 层达到生产闭环前，仍需补齐多轮多宿主校准与阈值收敛；
  - Phase-2 的 quality/session/query 可观测性已不再是空占位，但它们仍需要建立在当前 graph/ANN operational baseline 之上的发布级校准，因此还不能宣称发布级闭环；新的 ANN calibration-readiness gate 只是把前提条件正式化，并不等于校准完成；
  - 默认 tutor routing 已不再只是 catalog-only，但当前 runtime 仍是 `local`-first，并保留显式 rule-engine fallback，而不是已验证的生产级多 provider 路由策略。
- 因此当前活跃重心不是“默认认为 Phase-1 已完成然后推进上层”，而是：
  1. 在保持新的 dist/runtime + packaged sidecar 证明以及 workload matrix 持续为绿的前提下，先补完 embedded graph backend 基线剩余的 soak / 长时段 / 性能闭环，
  2. 补完当前 live ANN connector baseline 的工作负载与阈值闭环，
  3. 把当前已前推到 runbook 卡片中的 ANN 指标可见性，继续推进为带工作负载校准的发布级门禁，
  4. 让这批新诊断面始终与同一份运行时真相保持一致，
  5. 只有在 graph/ANN 基线达到发布级后，才把 Phase-2 / Phase-3 门禁升级为发布级结论。

## 2026-05-12 当前架构体量

| 文件 | 当前行数 | 含义 |
|---|---:|---|
| `src/server.ts` | 15,920 | 路由虽已模块化，但主服务单体仍然偏大，而且承载了更多运行时编排 |
| `src/learning/KnowledgeLearningPlatform.ts` | 10,043 | KLP 仍是最主要的实现重心，并继续吸纳 workspace-readiness / planner 逻辑 |
| `src/frontend/path_app.js` | 4,943 | path workbench / controller 仍未拆完，且额外承载了 reader-parity 责任 |
| `src/frontend/app.js` | 5,953 | graph host 侧控制面仍较厚，并新增 Mermaid error-guard 行为 |
| `src/frontend/reader.js` | 1,334 | Reader / runtime render 已从轻量辅助逻辑演化为一等子系统 |
| `src/frontend/agent_workspace.js` | 3,214 | agent orchestration 已存在，但 reply rendering 仍未从 text shell 升级到 rich message surface |
| `src/routes/knowledge.ts` | 690 | knowledge route 还需要进一步拆分 |

> 本节数字是当前 HEAD 的权威口径。下方较早的重构缩减表仍可保留作历史追溯，但不再等同于当前分支真实状态。

## 2026-05-12 阶段快照

| Phase | 目标 | 当前状态 | 代码证据 |
|---|---|---|---|
| Phase 1 | 知识解析 + 图谱底座 + staleness 治理 | `Operational baseline` | `src/learning/store.ts`、`src/learning/queryBackend.ts`、`src/learning/vectorAccelerationAdapter.ts`、`src/server.ts` |
| Phase 2 | 掌握闭环 + 发散引擎 | `Partial` | `src/learning/KnowledgeLearningPlatform.ts`、`src/frontend/path_app.js` |
| Phase 3 | 可插拔导师 + 记忆操作层 | `Early operational` | `src/learning/KnowledgeLearningPlatform.ts`、`src/learning/tutorAdapter.ts`、`src/server.ts`、`src/routes/knowledge.ts` |

## 2026-05-10 未完成目标同步

- 本页已与全仓文档审计 [Open Goal Audit (2026-05-10)](../../../open_goal_audit_2026-05-10.md) 对齐。
- 当前未完成目标的裁定口径以以下活跃看板为准：
  - `docs/zh/TODO.md`
  - `docs/zh/task.md`
  - `docs/zh/tauri_tasks.md`
  - `docs/zh/TEST_REPORT.md`
- 归档或历史清单仅用于追溯，不作为当前发布闸门的权威来源。

## 2026-05-10 Phase-1 收口更新（历史记录，已被 2026-05-12 HEAD 现实校准覆盖）

- 下列记录仅表示当时已经完成的实现增量，不再代表当前 HEAD 的发布级门禁结论：
  - 图后端适配器路径已具备 HTTP 操作级语义（`getNode/queryNodes/queryEdges/findPath`）并接入运行时诊断可追溯。
  - ANN 连接器加固已落地候选归一化、表示一致性遥测传递与 prefilter 有效性信号。
- 当前权威口径请回到本页顶部的“2026-05-12 HEAD 现实校准”，不要把本段历史记录解读为 A8/A9 已经发布级闭环。

## 范围

- 聚焦对象：本地优先学习平台（摄入、检索、学习路径、导师、记忆、治理）。
- 时间窗口：`v1.7.0` 到当前分支基线。
- 证据原则：每条进展结论都必须可映射到：
  - 契约层（`src/learning/api.ts`、`src/learning/types.ts`）
  - 路由层（`src/server.ts`）
  - 测试层（`src/knowledge.api.contract.test.ts` 及领域测试）

## 当前交付重心

当前 L4 的第一优先级不再是泛化交互扩展，而是以下端到端链路：

- 前端 agent chat，
- 本地知识点列表，
- 停靠式 Tauri 图界面 `focus mode` pane，
- 可与 graph focus 并排存在并支持全屏提升的 learning-path pane，
- 以及能够复用 Reader markdown / math / mermaid 管线的 Tauri-first assistant reply rendering。

执行参考：

- [Agent 对话与 Focus Mode 主线交付方案](./agent-conversation-focus-mode-plan.md)

本分支当前切片状态：

- 主前端已经落入 agent workspace shell（`src/frontend/index.html`、`src/frontend/styles.css`），
- conversation 路由现在已返回带 typed capability descriptor 的本地知识点，当前已覆盖 `focus`、`learning path`、tutor 侧 `generate_quiz` / `recap` / `generate_transfer` / `generate_counterexample` / `follow_up`、query 侧 `compare_query_backends` / `inspect_query_backend_diagnostics` / `inspect_query_backend_comparison_history` / `inspect_query_backend_comparison_trend`、导师诊断侧 `inspect_tutor_adapter_telemetry` / `inspect_tutor_trace_diagnostics`、质量/会话诊断侧 `inspect_learning_quality_trend` / `inspect_learning_quality_history` / `inspect_session_plan_quality_trend` / `inspect_session_plan_quality_history`、session 侧 `inspect_session_history` / `build_study_session`，以及对话记忆召回 `inspect_conversation_memory`，并补齐 execution / failure / UI hint 语义（`src/server.ts`、`src/learning/KnowledgeLearningPlatform.ts`、`src/learning/types.ts`），
- conversation 知识点动作链路现已收敛为 typed-only（`capabilities` 为唯一动作来源），后端响应与前端 pane 渲染均已移除 legacy `availableActions` fallback/统计路径（`src/learning/types.ts`、`src/learning/KnowledgeLearningPlatform.ts`、`src/frontend/workspace_panes.js`、`src/agent_workspace.frontend.test.ts`、`src/knowledge.api.contract.test.ts`），
- agent workspace 的 capability 执行分发已收敛为显式 execution-kind handlers（不再执行 legacy action fallback）；knowledge operation 已拆分为独立的 transport registry 与 request-builder registry，result presentation 也已拆分为 custom presenter、card-presentation descriptor 与 payload-builder 三层，并对 `unsupported_result_presentation*` 漂移统一走 fail-fast；parity 与前端 diagnostics 现已覆盖 transport / request-builder / custom-presentation / card-presentation / payload-builder / execution-kind 六类注册表完整性（`src/frontend/agent_workspace.js`、`src/agent_workspace.frontend.test.ts`、`src/agent_workspace.contract.parity.test.ts`），
- 点击 `Learning Path` 不再停在文本预览，也不再停靠浏览器 `path-container`，而是通过现有前端 `Graph` / `PathEngine` 的 `diffusion/core` + `treeLayout` 流程为解析后的 DAG 节点托管 Godot Future Path 数据契约，且默认不显示 Godot 原生窗口（`src/frontend/workspace_panes.js`、`src/frontend/agent_workspace.js`、`src/frontend/app.js`），
- 主图谱区域已经为 workspace 预留真实宽度，使 conversation + graph focus + learning path 可以在同一 host-owned 布局中并存（`src/frontend/styles.css`），
- graph focus 的 fullscreen 已升级为真实 graph workspace promotion，而不是只把右侧元信息卡片放大（`src/frontend/workspace_panes.js`、`src/frontend/styles.css`），
- scoped-knowledge conversation 流现在也更诚实了：active folder target 会进入 request contract，server 会 selective hydrate 可能 title-match 的文档进入 workspace，conversation trace 也会返回 readiness + miss diagnostics，而不再只是给出一个空 top-k（`src/frontend/source_manager.js`、`src/frontend/agent_workspace.js`、`src/server.ts`、`src/routes/data.ts`、`src/learning/KnowledgeLearningPlatform.ts`），
- 新增 agent workspace 已补齐静态壳层与运行时按钮/空态提示的双语覆盖，且已有知识卡片动作按钮与带参数系统消息会在语言切换时重渲，而不是停留在旧语言；conversation card 的重渲也已集中到 card-kind 渲染注册表，并新增源码级一致性门禁测试校验 append-kind 与注册表键集合对齐，降低后续新增卡片的漏改风险（`src/frontend/index.html`、`src/frontend/locales/en.json`、`src/frontend/locales/zh.json`、`src/frontend/workspace_panes.js`、`src/frontend/agent_workspace.js`、`src/agent_workspace.frontend.test.ts`），
- provider / model / API-key 设置现在已独立成 agent settings 页面，并支持 preset-template / TOML-template 流程；同一 agent workspace 现在也已具备 typed rich-reply 基线，而不再停留在 plain-text-only（`src/frontend/index.html`、`src/frontend/settings.js`、`src/notemd/AppConfigToml.ts`、`src/notemd/providerTemplates.ts`、`src/frontend/markdown_runtime.js`、`src/frontend/workspace_panes.js`、`src/frontend/agent_workspace.js`），
- Reader / runtime 渲染栈已对 Tauri markdown 使用场景显著加固：raw markdown、KaTeX、Mermaid frontend render、Mermaid backend PNG fallback、leaked Mermaid error suppression，以及面向 agent reply 的共享 markdown runtime 都已到位（`src/frontend/reader.js`、`src/frontend/app.js`、`src/frontend/markdown_runtime.js`、`src/reader_renderer.ts`、`src/routes/render.ts`、`src/notemd/MermaidProcessor.ts`），
- locale 治理已新增后端到前端的能力标签键一致性门禁：conversation capability 发出的 `labelKey` 必须映射到非空的双语 `agentWorkspace.actions.*` 文案（`src/learning/KnowledgeLearningPlatform.ts`、`src/frontend/locales/en.json`、`src/frontend/locales/zh.json`、`src/agent_workspace.locale.contract.test.ts`），
- modular knowledge route 闭环现在已经具备真实浏览器 strict 证据，而不再依赖 snapshot 式恢复通过：conversation 返回结构、capability 触发请求路由、卡片标题本地化、graph-focus 兼容 API 已在真实浏览器/网络 trace 下通过 `STRICT`、`UI_STRICT`、`UI_DYNAMIC_STRICT`（`src/routes/knowledge.ts`、`src/learning/KnowledgeLearningPlatform.ts`、`src/frontend/app.js`、`src/frontend/locales/en.json`、`src/frontend/locales/zh.json`、`scripts/verify-agent-workspace-browser.js`），
- locale 治理现已同时阻断能力失败文案漂移：conversation capability 发出的 `failure.messageKey` 必须映射到双语 `agentWorkspace.messages.*` 文案，且中英占位符集合与 fallback 占位符集合必须一致（`src/learning/KnowledgeLearningPlatform.ts`、`src/frontend/locales/en.json`、`src/frontend/locales/zh.json`、`src/agent_workspace.locale.contract.test.ts`），
- 后端 capability 描述子合同现已对 `knowledge_operation` 执行完整性做硬门禁：必须同时携带 `operationId` 与 `resultPresentation`，并要求失败元数据包含 `messageKey` 与 `fallbackMessage`（`src/learning/KnowledgeLearningPlatform.ts`、`src/agent_workspace.contract.parity.test.ts`），
- 前端 capability 执行链路现已新增按 operation 维度的结果呈现 allowlist 门禁（默认值 + 显式覆盖，例如 `execute_tutor_action -> tutor_action_card`）；不在允许集合内的组合会在后端请求发起前与渲染分发前 fail-fast（`src/frontend/agent_workspace.js`、`src/agent_workspace.contract.parity.test.ts`、`src/agent_workspace.frontend.test.ts`），
- 合同治理现已阻断 allowlist override 漂移：override 的 operation 键必须是 `AgentConversationCapabilityOperationId` 子集，override 的结果呈现值必须是 `AgentConversationCapabilityResultPresentation` 子集（`src/agent_workspace.contract.parity.test.ts`），
- parity 治理现已约束 allowlist 结构：每个 operation 的 allowlist 必须包含 transport 默认结果呈现；后端若使用非默认呈现，前端必须通过显式 override 声明（`src/agent_workspace.contract.parity.test.ts`），
- override 卫生约束现已落地非默认语义：operation override 条目不得重复 transport 默认结果呈现（`src/agent_workspace.contract.parity.test.ts`、`src/frontend/agent_workspace.js`），
- override 治理现已阻断陈旧条目：前端 override 的每个结果呈现都必须在同 operation 的后端 capability 发射中被观测到（`src/agent_workspace.contract.parity.test.ts`），
- 前端注册表诊断现已导出按 operation 的 override/默认/allowlist 结果呈现映射（`operationResultPresentationOverrideMap`、`operationDefaultResultPresentations`、`operationAllowedResultPresentations`），用于合同漂移排障（`src/frontend/agent_workspace.js`、`src/agent_workspace.frontend.test.ts`），
- 前端注册表诊断现已额外导出 `operationInvalidResultPresentationOverrideMap`，用于运行时暴露 default 重复项/未知 override token 的配置漂移（`src/frontend/agent_workspace.js`、`src/agent_workspace.frontend.test.ts`），
- 前端注册表诊断现已额外导出 `operationUnknownResultPresentationOverrideMap`，用于运行时暴露未知 override operation ID 的配置漂移（`src/frontend/agent_workspace.js`、`src/agent_workspace.frontend.test.ts`），
- 前端注册表诊断现已额外导出 override 漂移摘要信号（`operationResultPresentationOverrideDriftDetected` 及 invalid/unknown token 计数），用于快速运行时健康检查（`src/frontend/agent_workspace.js`、`src/agent_workspace.frontend.test.ts`），
- 前端消息 locale 治理现已阻断未解析运行时消息键：`agent_workspace.js` 引用的每个 `agentWorkspace.messages.*` 键都必须在中英 locale 中可解析，且占位符集合一致（`src/frontend/agent_workspace.js`、`src/frontend/locales/en.json`、`src/frontend/locales/zh.json`、`src/agent_workspace.locale.contract.test.ts`），
- app 层 tauri 生命周期可观测性已补齐：前端会将 `pathmode-window-toggled` 事件写入有界 trace 缓冲，并转发为 `noteconnection:pathmode-window-toggled` DOM 事件，便于本地诊断与证据采集（`src/frontend/app.js`），
- 桌面生命周期验证链路现已新增首条真实 app/window handle 证据路径（`verify:agent-workspace:tauri:window-evidence`）：通过 Rust 专项用例覆盖 mock-app 的窗口句柄生命周期，并将结构化证据落盘到 `output/tauri/agent-workspace-window-evidence`；当宿主缺少系统依赖时会按显式 `degraded` 语义降级（`scripts/verify-agent-workspace-tauri-window-evidence.js`、`src-tauri/src/lib.rs`、`src/agent_workspace.tauri.contract.test.ts`），
- CI 已在 `.github/workflows/migration-gates.yml` 接入常态化 strict 桌面证据作业（`agent-workspace-tauri-strict-evidence`），会在 Linux 宿主安装 `javascriptcoregtk-4.1` / `libsoup-3.0` 依赖后执行 `verify:agent-workspace:tauri:rust:strict` 与 `verify:agent-workspace:tauri:window-evidence:strict`；release 流程 `.github/workflows/release-desktop-multi-os.yml` 也已在 Linux 桌面构建路径接入同等 strict 证据门禁（在 bundle 产物构建前执行）；两条流程会额外生成 strict 证据索引（`verify:agent-workspace:tauri:evidence:index:strict`）、执行 strict 证据清单门禁（`verify:agent-workspace:tauri:evidence:manifest:strict`），并上传 tauri 证据工件用于审计追溯（保留期固定 30 天），同时 Linux release 链路会将 `release-fragment-latest.md` 通过 marker 幂等 upsert 写入 GitHub Release notes，
- `migration-gates` 现已新增常态化 `agent-workspace-contract-gates` 作业：执行 `test:agent-workspace:contracts`（parity/frontend/tauri 三类契约套件）与 `test:conversation-turn-cache:durability`（turn-cache trend index/export 跨重启一致性检查），用于补齐 agent-workspace 合同演进的 CI 漂移阻断能力，
- 协议治理已新增许可证一致性门禁：`test:license:contract` 会校验 `LICENSE`、`README`、`package.json`、`src-tauri/Cargo.toml` 在主线持续保持 `GPL-3.0-only`，并已接入 `migration-gates` CI 作业，
- browser smoke 已覆盖真实 `conversation/path/query-compare/quality/session/runbook` 后端切片（含 trend + history 诊断，以及 runbook verify/checks/action-queue）、真实 graph runtime、真实 path runtime，并会在输出 screenshot / console / network-summary 证据前，先断言 verify/checks 中的 ANN sync-health + 熔断/可追踪性/预筛选内容及阈值/信号/校准就绪标签，以及 action-queue 的 index-sync 钻取都已经真实渲染（`scripts/verify-agent-workspace-browser.js`、`src/agent_workspace.browser.contract.test.ts`），
- scoped conversation-memory 基线已完成端到端接线（typed contract、后端 normalizer/route、前端 operation registry、双语键、生命周期测试、runtime/browser 验证），端点为 `/api/knowledge/conversation-memory/{list,add,search,delete,feedback}`（`src/learning/api.ts`、`src/learning/types.ts`、`src/learning/KnowledgeLearningPlatform.ts`、`src/server.ts`、`src/frontend/agent_workspace.js`、`src/knowledge.api.contract.test.ts`、`src/learning/KnowledgeLearningPlatform.test.ts`、`src/agent_workspace.frontend.test.ts`），
- unified turn streaming 最小基线已落地：在 `/api/knowledge/conversation` 上通过 `Accept: text/event-stream` 协商输出事件流（`turn_started`/`capability_planned`/`capability_progress`/`capability_result`/`turn_completed`/`turn_failed`），前端采用 stream-first 并保留同步 JSON fallback（`src/server.ts`、`src/frontend/agent_workspace.js`、`src/knowledge.api.contract.test.ts`、`src/agent_workspace.frontend.test.ts`），
- M8.2 恢复语义已落地：前端在 stream-first 与 sync fallback 间透传统一 `turnId`，`/api/knowledge/conversation` 已新增 turn 级重放窗口与去重/冲突保护（`turn_id_conflict`），中断后重试可回放缓存事件而不重复执行回合（`src/server.ts`、`src/frontend/agent_workspace.js`、`src/knowledge.api.contract.test.ts`、`src/agent_workspace.frontend.test.ts`），
- M8.3 的 operator 基线已落地：新增 `GET /api/knowledge/conversation/turn-cache/diagnostics` 输出 turn 缓存生命周期诊断（TTL/容量配置、实时状态、命中率、冲突计数、回放计数、淘汰计数），并支持通过 `NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_TTL_MS` / `NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_MAX_ENTRIES` 进行运行时调参（`src/server.ts`、`src/knowledge.api.contract.test.ts`），
- M8.4 的 operator 产品化基线已落地：turn-cache 诊断已并入 agent workspace 执行契约链路 `inspect_conversation_turn_cache_diagnostics` -> `fetch_conversation_turn_cache_diagnostics` -> `conversation_turn_cache_diagnostics_card`，并补齐双语卡片渲染与语言切换重渲覆盖（`src/learning/types.ts`、`src/learning/KnowledgeLearningPlatform.ts`、`src/frontend/agent_workspace.js`、`src/frontend/workspace_panes.js`、`src/frontend/locales/en.json`、`src/frontend/locales/zh.json`、`src/agent_workspace.frontend.test.ts`、`src/agent_workspace.contract.parity.test.ts`、`src/knowledge.api.contract.test.ts`、`src/learning/KnowledgeLearningPlatform.test.ts`），
- M8.5 的阈值治理基线已落地：turn-cache 诊断新增 env 可调阈值与策略检查（`utilization_pct`、`execution_failure_ratio_pct`、`conflict_count`、`stale_eligible_entries`），并输出告警汇总状态（`summaryStatus`）与 fail/warn 计数；agent workspace 诊断卡片已补齐告警摘要/最高级别检查/阈值画像三类指标及双语渲染覆盖（`src/server.ts`、`src/frontend/agent_workspace.js`、`src/frontend/workspace_panes.js`、`src/frontend/locales/en.json`、`src/frontend/locales/zh.json`、`src/agent_workspace.frontend.test.ts`、`src/knowledge.api.contract.test.ts`），
- M8.6 的趋势治理基线已落地：`GET /api/knowledge/conversation/turn-cache/diagnostics/trend` 已输出有界告警历史快照、趋势状态（`insufficient_data` / `stable` / `improving` / `regressing`）、升级级别（`normal` / `watch` / `high` / `critical`）与活动 streak 上下文；并支持通过 `NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_LIMIT`、`NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_ALERT_SAMPLE_MIN_INTERVAL_MS`、`NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_ALERT_TREND_WINDOW_SIZE`、`NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_ALERT_TREND_MIN_SAMPLES`、`NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_ALERT_ESCALATION_WARN_STREAK`、`NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_ALERT_ESCALATION_FAIL_STREAK` 进行策略调参（`src/server.ts`、`src/knowledge.api.contract.test.ts`），
- M8.6 的 operator 产品化收口已落地：trend 能力已并入 agent workspace 执行契约链路 `inspect_conversation_turn_cache_alert_trend` -> `fetch_conversation_turn_cache_alert_trend` -> `conversation_turn_cache_alert_trend_card`，并补齐双语卡片渲染与语言切换重渲覆盖（`src/learning/types.ts`、`src/learning/KnowledgeLearningPlatform.ts`、`src/frontend/agent_workspace.js`、`src/frontend/workspace_panes.js`、`src/frontend/locales/en.json`、`src/frontend/locales/zh.json`、`src/agent_workspace.frontend.test.ts`、`src/agent_workspace.contract.parity.test.ts`、`src/learning/KnowledgeLearningPlatform.test.ts`），
- M8.7 的持久化与 runbook 门禁联动基线已落地：turn-cache 告警趋势历史已支持跨重启持久化（`runtime_data/agent_conversation_turn_cache_alert_history.v1.json`，带有界压缩与异步写入队列），并新增 `GET /api/knowledge/conversation/turn-cache/diagnostics/trend/index` 与 `GET /api/knowledge/conversation/turn-cache/diagnostics/trend/export`；升级状态已通过 synthetic check `conversation_turn_cache_alert_trend` 接入 runtime runbook，并关联整改动作 `inspect_conversation_turn_cache_alert_trend_index`、`stabilize_conversation_turn_cache_alert_pressure`、`verify_conversation_turn_cache_alert_trend_recovery`（`src/server.ts`、`src/knowledge.api.contract.test.ts`、`src/notemd.server.integration.test.ts`），
- M8.8 的 operator 钻取与调度护栏基线已落地：agent workspace 已新增显式趋势 index/export 能力动作（`inspect_conversation_turn_cache_alert_trend_index` / `inspect_conversation_turn_cache_alert_trend_export`）及对应操作链路（`fetch_conversation_turn_cache_alert_trend_index` / `fetch_conversation_turn_cache_alert_trend_export`），trend/action-queue 卡片已补齐 storage/index/export/endpoint-hint 钻取上下文；replay schedule 配置已加入跨字段护栏（`maxReplayChecksPerWindow >= replayLimit`），并在 telemetry 与工作台状态文案中显式回传 `config_guardrail_applied` + `schedule_config_guardrail:*` 原因（`src/learning/types.ts`、`src/learning/KnowledgeLearningPlatform.ts`、`src/frontend/agent_workspace.js`、`src/frontend/workspace_panes.js`、`src/frontend/path_app.js`、`src/server.ts`、`src/agent_workspace.frontend.test.ts`、`src/agent_workspace.contract.parity.test.ts`、`src/knowledge.api.contract.test.ts`、`src/learning/KnowledgeLearningPlatform.test.ts`、`src/notemd.server.integration.test.ts`），
- M8.9 的 replay-schedule 主动建议 + 策略模板基线已落地：replay schedule 快照新增结构化建议载荷（`telemetry.recommendations`）与策略模板候选（`telemetry.policyTemplates`），覆盖 guardrail / budget / trigger / cooldown / skip-streak 等场景；schedule 配置更新已支持 `policyTemplate` 一等输入；workbench 的 refresh/update/tick 状态文案会回传首条建议与模板，支持运维下一步动作决策（`src/server.ts`、`src/frontend/path_app.js`、`src/notemd.server.integration.test.ts`、`src/path_app.runtime_trace_filter.behavior.test.ts`），
- M9 的 replay-schedule 安全自动执行基线已落地：schedule 配置新增显式 `autoExecution` 策略（`enabled`、`mode`、`requireDryRunParity`、`minConsecutiveSkips`），快照 telemetry 新增门禁诊断块（`eligible`、`blockedReasons[]`、`decision`、`lastAttemptedAt`、`lastExecutedAt`），schedule tick 在既有 trigger/cooldown/budget 守卫之上收敛为 gate-first 决策语义（`auto_execution_blocked`、`auto_execution_dry_run_required`、`auto_execution_executed`）（`src/server.ts`、`src/notemd.server.integration.test.ts`、`src/knowledge.api.contract.test.ts`），
- M9.1 的 workbench 运维可解释性已落地：replay-schedule 的 refresh/update/tick 状态文案与 remediation history 文本已补齐 `autoExecution(...)` 诊断片段，配置更新路径也支持从前端偏好透传 `autoExecution` 字段到后端 payload（`src/frontend/path_app.js`、`src/path_app.runtime_trace_filter.behavior.test.ts`），
- M10 的底座收敛引导开关已落地：graphdb 存储新增 provider 选择与 fallback 策略控制（`NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_ADAPTER_PROVIDER`、`NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_ADAPTER_ID`、`NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_FALLBACK_ENABLED`），`local_vector` 加速链路新增显式 failure 语义与表示一致性 strict 开关（`NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_FAILURE_MODE=fail_open|fail_closed`、`NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_REPRESENTATION_STRICT=true|false`），并已贯通到 query trace/runtime diagnostics（`src/learning/store.ts`、`src/learning/queryBackend.ts`、`src/learning/KnowledgeLearningPlatform.ts`、`src/server.ts`、`src/learning/store.test.ts`、`src/learning/queryBackend.test.ts`、`src/knowledge.api.contract.test.ts`），
- `local_vector` 的 strict 语义现进一步收敛：当 `external_http` endpoint 缺失时会触发显式适配器故障（`external_http_endpoint_missing`），`fail_closed` 不再静默降级为 full-scan，而会在 trace/diagnostics 中暴露 `vector_acceleration_adapter_failure:*`（`src/learning/vectorAccelerationAdapter.ts`、`src/notemd.server.rollout-boundary.integration.test.ts`），
- query-backend 诊断/配置端点现回传向量加速 rollout 上下文（`configuredVectorAccelerationProvider`、`configuredVectorAccelerationFailureMode`、`configuredVectorAccelerationRepresentationStrict`、`queryVectorAnnPrefilterEnabled`、`rolloutProfile`），便于 workbench/operator 直接判断 strictness，无需额外依赖 `/api/knowledge/state`（`src/server.ts`、`src/notemd.server.integration.test.ts`、`src/notemd.server.rollout-boundary.integration.test.ts`），
- M10.2 的 graphdb 适配器基线已新增 `external_http` provider 路径（`NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_ENDPOINT`、`NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_TIMEOUT_MS`、`NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_MAX_RETRIES`、`NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_RETRY_DELAY_MS`），并补齐连接器诊断与严格模式下端点缺失的 fail-closed 行为（`graphdb_http_endpoint_missing`）（`src/learning/store.ts`、`src/server.ts`、`src/learning/store.test.ts`、`src/notemd.server.rollout-boundary.integration.test.ts`），
- M10.3 的 graphdb `external_http` 连接器治理已升级为 runtime 一等信号：store diagnostics 现新增结构化连接器遥测（`healthStatus`、`circuitState`、`requestCount`、`retryCount`、`shortCircuitCount`、`lastRequestId`、`lastErrorCode`、`lastStatusCode`、`lastRetryAfterMs`），runtime capability matrix 新增 `store_graphdb_connector_health` 检查并接入 runbook/debug-trace 链路；同时在 strict rollout 集成与 store 单测中补齐健康路径与 circuit-open 退化语义验证（`src/learning/store.ts`、`src/learning/runtimeCapability.ts`、`src/learning/store.test.ts`、`src/learning/runtimeCapability.test.ts`、`src/notemd.server.rollout-boundary.integration.test.ts`），
- M10 的 rollout 边界集成覆盖已扩展：新增隔离式服务启动测试，向量加速 `fail_closed` 现同时覆盖“适配器故障可观测”与 `external_http` 正向健康路径（无后端回退、`healthStatus=ready`、请求关联字段回传），并验证 graphdb `provider=none` + `fallback=false` 的 store API fail-closed 行为，以及 graphdb `provider=external_http` + `fallback=false` 在 `/api/knowledge/store/reload` 与 `/api/knowledge/store-diagnostics` 的正向成功路径（含 rollout 上下文字段 `configuredGraphDbAdapterProvider` / `configuredGraphDbAdapterId` / `graphDbFallbackEnabled`）（`src/notemd.server.rollout-boundary.integration.test.ts`、`src/server.ts`），
- M10 的 rollout profile 运维可观测性已打通：运行时 payload 新增 `rolloutProfile`（store/vector 严格度 + 聚合模式），`runtime-capability-matrix` 与 runbook/verify/history/history-checks/action-queue/remediation-history/replay-schedule 端点（含 remediation POST：`event`/`replay`/`schedule`/`tick`）同步回传该 profile；learning workbench runtime 摘要新增 `rollout=<mode>(...)` 提示，并已补齐集成/契约/前端行为测试覆盖（`src/server.ts`、`src/notemd.server.integration.test.ts`、`src/knowledge.api.contract.test.ts`、`src/frontend/path_app.js`、`src/path_app.runtime_trace_filter.behavior.test.ts`），
- 旧的全局 Path Mode 入口在切入整屏路径工作区前会先释放停靠 pane，避免两条入口互相踩状态（`src/frontend/app.js`）。

## 最新验证快照（2026-05-18）

- 本轮已在当前 Windows 宿主重新确认通过：`node node_modules/jest/bin/jest.js src/learning/runtimeCapability.test.ts src/knowledge.api.contract.test.ts --runInBand --no-cache`、`node node_modules/jest/bin/jest.js src/agent_workspace.frontend.test.ts --runInBand --no-cache`、`npm run test:agent-workspace:contracts`、`npm run build:with-vite`、`npm run docs:diataxis:check`、`npm run docs:site:build`、`NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_STRICT=1 NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_UI_STRICT=1 NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_UI_DYNAMIC_STRICT=1 node scripts/verify-agent-workspace-browser.js`。
- 本轮已在当前 Windows 宿主重新确认通过：`npm run build:sidecar`、`npm run verify:foundation:sqlite-runtime`、`npm run verify:foundation:sqlite-runtime:matrix`、`npm run verify:foundation:ann-runtime`、`npm run verify:foundation:ann-runtime:matrix`。
- 严格浏览器证据现在已显式校验本轮新增的双语 runtime-runbook verify/checks ANN 治理标签：不仅验证 sync-health，也验证熔断、可追踪性、预筛选摘要，以及支撑校准工作的阈值/信号钻取和校准就绪态。
- embedded sqlite 图基线现在也具备了 Jest 集成测试之外、可重复执行的主机级运行时证明：轻载验证会让 `dist` runtime 与 packaged sidecar 两条路径持续保持 ingest -> diagnostics/readiness -> restart -> query 连续性，而 workload matrix 验证则会在同样两条路径上证明 `smoke` / `medium` / `heavy` 三档 workload 的 snapshot metadata / restart / 多点 query 连续性。
- `external_http` ANN connector baseline 现在也具备了 Jest 集成测试之外、可重复执行的主机级运行时证明：轻载验证会让 `dist` runtime 与 packaged sidecar 两条路径持续保持 ingest -> query-backend diagnostics -> restart -> query 连续性，而 workload matrix 验证则会在同样两条路径上证明 `smoke` / `medium` / `heavy` 三档 workload 的 sync/select telemetry 与 aligned representation metadata。
- Tauri strict 证据链在实现层面已经闭环，但仍受宿主依赖约束：
  - 当前 Windows 宿主已经证明 non-strict tauri/runtime 行为与 load-flow parity，
  - Linux strict 证据命令（`verify:agent-workspace:tauri:rust:strict`、`verify:agent-workspace:tauri:window-evidence:strict` 及 strict evidence index/manifest）仍要求宿主预装 `webkit2gtk-4.1`、`javascriptcoregtk-4.1`、`libsoup-3.0`。
- 当前 Windows 宿主的 sidecar/bootstrap 就绪度已达到 `offline-ready`；剩余 bootstrap 工作属于 strict no-LFS 前的策略加固，而不是当前主机可用性阻塞。
- 对 Phase 边界的实际含义：Phase 2 的实现门禁已足以允许 Phase 3 并行启动；剩余 Phase 2 项主要是运维/发布前置条件。

运行约束：

- 实时服务页面来自 `dist/src/frontend`，因此 `src/frontend/*` 的修改只有在执行一次新的 `npm run build` 之后才会进入真实运行时验证。
- 现在已有专用 smoke 命令 `npm run verify:agent-workspace:runtime`，它会把当前前端复制到临时运行目录，启动真实 sidecar/server，并校验服务端实际提供的根页面与 locale 资源是否包含 agent workspace 壳层。
- 现在也已有浏览器驱动的 smoke 命令 `npm run verify:agent-workspace:browser`，它会先通过真实 ingest API 预热最小知识文档，并写入最小 `data.js` 以启动真实 graph/path runtime，再在真实 Chromium 会话中打开页面，驱动 agent workspace 的对话与动作流，命中真实 `conversation/path/query-compare/quality/session/runbook` 后端切片，验证本地化动作/消息重渲（含 runbook checks/action-queue 卡片），检查 graph focus promotion 的进入/退出状态，并输出 screenshot / console / network-summary 证据路径以便排查失败。
- 现在新增 Rust 侧 tauri 契约命令 `npm run verify:agent-workspace:tauri:rust`：在系统具备依赖时执行 `pathmode_window_toggle_plan` / `pathmode_window_toggled_event_payload` cargo 用例；本地非严格模式若缺 `webkit2gtk-4.1`、`javascriptcoregtk-4.1` 或 `libsoup-3.0` 会输出 `SKIP`，CI/严格模式会直接失败。
- 现在新增真实 app/window 证据命令 `npm run verify:agent-workspace:tauri:window-evidence`：尝试执行窗口生命周期证据用例并输出结构化报告/日志；若宿主缺依赖则在非严格模式下输出 `degraded` 与原因，严格模式会硬失败。
- 现在新增 strict 证据索引命令 `npm run verify:agent-workspace:tauri:evidence:index`：会对 rust/window/smoke 证据报告生成统一 latest index，并按 `schemas/agent-workspace-tauri-evidence-index.schema.json` 做结构校验；strict 模式下若关键证据缺失或未通过会直接失败。
- 现在新增 tauri 证据摘要命令 `npm run verify:agent-workspace:tauri:evidence:summary`：会输出 `output/tauri/agent-workspace-evidence-index/evidence-summary-latest.md` 供运维查阅，并可在 CI 工作流中写入 `GITHUB_STEP_SUMMARY`。
- 现在新增 tauri 证据发布片段命令 `npm run verify:agent-workspace:tauri:evidence:release-fragment`：会输出 `output/tauri/agent-workspace-evidence-index/release-fragment-latest.md`，并可附加到 `GITHUB_STEP_SUMMARY` 作为 release-gate 审计上下文。
- 现在新增 tauri 证据清单命令 `npm run verify:agent-workspace:tauri:evidence:manifest`：会输出 `output/tauri/agent-workspace-evidence-index/evidence-manifest-latest.json`，并按 `schemas/agent-workspace-tauri-evidence-manifest.schema.json` 做结构校验，同时产出 required artifact 的 strict-validation 诊断信息。
- 现在新增发布说明同步命令 `npm run verify:agent-workspace:tauri:evidence:publish-release-notes -- --tag <release_tag>`：会把最新 tauri 证据片段通过固定 begin/end marker 幂等写入目标 GitHub Release 正文。

## 阶段快照（2026-04-11）

| 阶段 | 目标 | 当前状态 | 证据 |
|---|---|---|---|
| Phase 1 | 知识解析 + 图谱底座 + staleness 治理 | 已完成 | `src/learning/KnowledgeLearningPlatform.ts`、`src/learning/store.ts`、`src/learning/queryBackend.ts` |
| Phase 2 | 掌握闭环 + 发散引擎 | 进行中 | `src/learning/KnowledgeLearningPlatform.ts`、`src/frontend/path_app.js` |
| Phase 3 | 可插拔导师 + 记忆操作层 | 进行中 | `src/learning/tutorAdapter.ts`、`src/learning/runtimeCapability.ts`、`src/server.ts` |

## 分层实现矩阵

| 层级 | 目标 | 已落地基线 | 剩余工作 |
|---|---|---|---|
| L0 表示层 | 将文档解析为原子与证据 | 原子、证据、source hash 与 staleness 重建链路已实现（`ingestKnowledge`、staleness APIs） | 增强公式/代码归一化与解析遥测粒度 |
| L1 结构层 | 构建关系 + 时序图 | `RelationEdge` 的 `provenance` 与 `TemporalEdge` 有效期机制已实现 | 提升关系质量评分与跨文档冲突处理 |
| L2 检索层 | 证据优先、可解释检索 | `local_hybrid` / `keyword_only` / `local_vector` 已实现，并回传检索模式权重；`local_vector` 已落地 ANN 风格预筛选基线（`ann_prefilter`）且可自动回退全量扫描，并具备 live sync-backed `external_http` 加速路径；默认 graph store 基线现已是 embedded `graphdb/sqlite` 且具备重启耐久性证明 | 继续把剩余底座缺口写实：graphdb 仍需 packaged/runtime + 更重工作负载级加固，ANN 仍需补齐 rollout 阈值与更大工作负载验证 |
| L3 学习层 | 掌握诊断 + 动作编排 | 掌握诊断、误区汇总、双路径推荐、会话执行流水线，以及 live 的 quality/session-plan trend 运行面均已实现 | 在发布级 graphdb/ANN 基线上校准这些已接通的学习效果指标，再谈 Phase-2 硬门禁 |
| L4 交互层 | 工作台统一操作与诊断 | Learning Workbench 已接入会话、质量、runbook、trace 诊断，已支持可配置整改回放控制（`replayMode`、`replayLimit`、`dryRun`、`replaySelectionPolicy`、`replayMinRiskRatioPct`）与调度编排控制（`enabled`、`intervalMinutes`、`triggerPolicy`、阈值）并持久化工作台偏好。当前分支还已落入第一版 host-owned agent workspace shell、停靠式 conversation action、Godot Future Path 的 learning-path 调度、graph workspace 级 focus fullscreen promotion、双语壳层覆盖、真实 backend + 真实 graph/path runtime 的 browser smoke 与证据产物、首条真实 app/window handle 生命周期证据路径、`migration-gates` 中的 CI strict 桌面证据常态化作业、`release-desktop-multi-os` 中 Linux 路径 strict 证据门禁、`/api/knowledge/conversation` 上 accept 协商的 SSE 回合流基线、可重放的 turnId 幂等恢复语义、可观测的 turn 缓存诊断与可调参数（`/api/knowledge/conversation/turn-cache/diagnostics` + TTL/容量 env 调参）、阈值化告警治理（汇总状态 + 策略检查 + 阈值画像）、以及告警趋势/历史与升级治理（`/api/knowledge/conversation/turn-cache/diagnostics/trend` + 采样/窗口/streak 策略可调），并已补齐显式 index/export operator 能力动作（`inspect_conversation_turn_cache_alert_trend_index` / `inspect_conversation_turn_cache_alert_trend_export`）、replay-schedule 建议遥测（`telemetry.recommendations`）、策略模板遥测（`telemetry.policyTemplates`）、配置期模板套用（`policyTemplate`）、自动执行安全门禁与诊断（`config.autoExecution`、`telemetry.autoExecution`、parity/blocker 决策语义）以及建议/模板驱动状态文案；并已具备可执行 conversation contract：覆盖 `focus`、`learning path`、tutor 侧 `generate_quiz` / `recap` / `generate_transfer` / `generate_counterexample` / `follow_up`、query 侧 `compare_query_backends` / `inspect_query_backend_diagnostics` / `inspect_query_backend_comparison_history` / `inspect_query_backend_comparison_trend`、导师诊断侧 `inspect_tutor_adapter_telemetry` / `inspect_tutor_trace_diagnostics`、质量/会话诊断侧 `inspect_learning_quality_trend` / `inspect_learning_quality_history` / `inspect_session_plan_quality_trend` / `inspect_session_plan_quality_history`、session 侧 `inspect_session_history` / `build_study_session`、对话记忆召回 `inspect_conversation_memory`、以及 turn-cache operator 诊断 `inspect_conversation_turn_cache_diagnostics` / `inspect_conversation_turn_cache_alert_trend`，同时已具备结构化 `conversation_turn_cache_diagnostics_card` / `conversation_turn_cache_alert_trend_card` / `query_backend_comparison_card` / `query_backend_diagnostics_card` / `query_backend_comparison_history_card` / `query_backend_comparison_trend_card` / `tutor_adapter_telemetry_card` / `tutor_trace_diagnostics_card` / `learning_quality_trend_card` / `learning_quality_history_card` / `session_plan_quality_trend_card` / `session_plan_quality_history_card` / `session_history_card` / `study_session_card` / `tutor_action_card` / `assistant_message` 结果呈现。该交互契约已完成 typed-only 收敛（统一使用 `capabilities`），legacy `availableActions` fallback 已从后端与前端主路径移除。 | 持续维持 strict 证据工件治理健康度，但不要把这批 observability/card 能力误写成“发布级闭环”，只因为它们的后端已不再是 placeholder |
| L5 治理层 | 运行时检查、趋势门禁、整改闭环 | runtime capability matrix + runbook + remediation event 已实现，包含 `query_backend_runtime_health`、`query_vector_index_*`、`store_graphdb_connector_health` 与 `query_vector_acceleration_mode`/`query_vector_acceleration_index_sync_health`/`query_vector_acceleration_health`/`query_vector_acceleration_prefilter_effectiveness`/`query_vector_acceleration_traceability`/`query_vector_acceleration_circuit_state` 检查；其中 circuit-state 已升级为阈值驱动（短路计数/比例、连续失败、半开探测成功率），prefilter-effectiveness 则用于识别代表性流量下 ANN 长期回退 `full_scan` 的失效场景，且前端 verify/checks 卡片现已直接暴露 sync/circuit/traceability/prefilter 摘要 | 强化阈值校准与故障回放自动化，并把治理升级严格绑定到发布级 graph/ANN 基线之上 |

## 架构重构状态（2026-05-05，最终）

基于基线的 12 阶段重构（A→L）已完成。以下模块已交付：

### 新增模块清单

| 模块 | 文件数 | 用途 |
|---|---|---|
| `src/routes/` | 10 | 模块化 API 路由处理器（66 条路由） |
| `src/middleware/` | 5 | HTTP 中间件（cors, auth, body-parser, request-trace） |
| `src/learning/domains/` | 8 | 领域类（7 类 + 7 Platform 接口） |
| `src/frontend/*.mjs` | 4 | ES module 版 i18n, runtime_bridge, main, worker bridge |
| `src/utils/platform.ts` | 1 | 跨平台检测（Linux XDG / macOS Library / Windows LOCALAPPDATA） |
| `src-tauri/tauri.{linux,macos,windows}.conf.json` | 3 | 平台专属 Tauri 配置 |
| `vite.config.ts` | 1 | Vite 5 入口多页面构建（4 chunks） |
| `docs/solutions/` | 2 | 跨平台优化方案 + 实施差距分析 |
| `docs/archive/` | 3 | 已归档 TODO.md（448KB） |

### 重构指标

| 指标 | 之前 | 之后 |
|---|---|---|
| 路由模块 | 0（内联 if/else 链） | 10 模块, 66 路由 |
| 中间件 | 0（内联函数） | 5 独立模块 |
| 领域类 | 1（13,370 行单体） | 7 类 + 7 Platform 接口 |
| 前端模块系统 | `<script>` 标签链 | ES modules + Vite 4-chunk |
| 平台配置 | 1 通用 + 1 Android | 5 配置 |
| Godot 渲染器 | GL Compatibility | Forward+ (Vulkan) + Wayland fallback |
| 移动端 | Capacitor + Tauri | Tauri Android（Capacitor 废弃） |
| 双语文档对 | 21 | 24 |
| CI jobs | 16 | 18 |
| 路由合约测试 | 0 | 8/8 通过 |

### 领域类实现状态

| 领域类 | 自有逻辑 | 生产使用 |
|---|---|---|
| `KnowledgeIngestor` | 4 领域门禁、延迟追踪、过期缓存、护栏通过率、8 诊断 | ✅ `POST /api/knowledge/ingest` |
| `KnowledgeQuerier` | 查询验证（空值/长度/上限）、_domain 遥测、缓存(TTL+修剪)、延迟P95、10 诊断 | ✅ `POST /api/knowledge/query` |
| `ConversationManager` | 查询+记忆验证、Turn 计数、响应延迟、记忆操作、6 诊断 | ✅ (已实例化) |
| `MasteryEngine` | 路径验证、_domain 增强(pathLength/duration)、会话指标、6 诊断 | ✅ (已实例化) |
| `QualityEvaluator` | 用户验证、通过率追踪(200窗口)、快照指标、5 诊断 | ✅ (已实例化) |
| `TutorRouter` | 用户ID+动作种类验证、动作分布、执行元数据、4 诊断 | ✅ (已实例化) |
| `MemoryPolicyManager` | 用户ID+层级验证、策略层级分布、_domain 增强、5 诊断 | ✅ (已实例化) |

**全部 7/7 领域类完成方法体迁移。**

### 重构指标

| 指标 | 之前 | 之后 |
|---|---|---|
| 路由模块 | 0（内联 if/else 链） | 10 模块, 73 路由 |
| 中间件 | 0（内联函数） | 5 独立模块 |
| 领域类 | 1（3,894 行单体） | 7 类 + 7 Platform 接口 (7/7 方法体迁移) |
| 前端模块系统 | `<script>` 标签链 | 7 ES modules + Vite 6-chunk (430ms) |
| 平台配置 | 1 通用 + 1 Android | 5 配置 |
| Godot 渲染器 | GL Compatibility | Forward+ (Vulkan) + Wayland fallback |
| 移动端 | Capacitor + Tauri | Tauri Android（Capacitor 废弃） |
| 双语文档对 | 21 | 24 |
| CI jobs | 16 | 19 |
| 路由合约测试 | 0 | 10/10 通过 |
| 运行时可观测性 | 无路由迁移指标 | registryHitRate + migrationProgress + 7 领域面板 |
| 路由迁移覆盖率 | 0% | 91.3% (73 modular + 7 terminal inline) |
| 内联链复杂度 | 单体 if/else 链 | 清晰分段 + [REGISTRY_COVERED] 标注 |
| 领域类方法体 | 0（全在单体中） | 7/7 完成 (validate → delegate → augment → diagnostics) |
| Vite 构建时间 | N/A | 430ms |
| Path-mode chunk 大小 | N/A | 93KB |

## 核心 API 与运行时基线

## 契约层

- API 接口：`src/learning/api.ts`
- 核心类型：`src/learning/types.ts`
- 对外导出边界：`src/learning/index.ts`
- 契约覆盖：`src/knowledge.api.contract.test.ts`

## 服务端层

- `/api/knowledge/*` 在 `src/server.ts` 中已完成 alias 兼容与统一归一化。
- 运行时诊断入口：`GET /api/runtime-request-trace`。
- Runbook 端点：
  - `GET /api/knowledge/runtime-capability-runbook`
  - `GET /api/knowledge/runtime-capability-runbook/verify`
  - `GET /api/knowledge/runtime-capability-runbook/history*`
  - `POST /api/knowledge/runtime-capability-runbook/remediation-event`
  - `POST /api/knowledge/runtime-capability-runbook/remediation-event/replay`

## 存储与状态层

- `src/learning/store.ts` 已支持：
  - `file`
  - `memory`
  - `graphdb`（现已支持 embedded SQLite、file、HTTP adapter 路径）
- 当前结构上限：新的默认 graphdb 路径已经是 embedded SQLite 并保留显式 fallback，但在宣布其达到生产闭环之前，仍需补齐 packaged/runtime 证明与工作负载级加固。

## 检索层

- `src/learning/queryBackend.ts` 已实现：
  - `local_hybrid`：关键词 + 语义 token 相似度 + 关系度 + 时序过滤
  - `keyword_only`：关键词主导 + 时序过滤
  - `local_vector`：本地向量相似度（TF-IDF 近似）+ 语义重叠 + 图关系加权，已支持本地索引快照（`knowledge_query_vector_index.v1.json`）、ingest 触发失效、按原子签名惰性刷新，并落地 token/signature 的 ANN 风格预筛选（`ann_prefilter`）+ 自动全量回退，且支持加速适配器边界（默认 local，可切 `external_stub` / `external_http`）
- 当前结构上限：
  - 当前外部适配器实现仍为边界与治理链路脚手架（含 `external_http` 超时/重试/熔断基线），尚非生产级外部 ANN 引擎接入，
  - 大规模语料仍需接入真实外部向量/ANN 引擎并完成阈值化压测校准。
- 治理覆盖：
  - 运行时检查已区分后端可用性、向量索引就绪状态与持久化模式。
  - 向量加速 circuit 治理已按 warn/fail 阈值评估短路计数/比例、连续失败次数与半开探测成功率。
  - ANN 预筛选有效性治理已接入 `lastSelectionMode` + `lastCandidateCount` 指标，并在连接器稳定且流量具代表性时，对长期 `full_scan` 回退触发 fail。
  - ANN 预筛选有效性门禁已支持运行时阈值调参（最小样本 + 候选比例 warn/fail 预算），可按语料规模分阶段校准 rollout。
  - runbook action queue 已在同一优先级档位内加入 prefilter 风险并列打破规则：当 `query_vector_acceleration_prefilter_effectiveness` 为 `warn|fail` 时，相关整改动作会被提前上浮。
  - 已新增整改事件回放自动化端点 `POST /api/knowledge/runtime-capability-runbook/remediation-event/replay`，可从 remediation history 抽取风险检查并触发新一轮 verify 回放。
  - 服务端集成测试已覆盖 external_http 熔断开路场景在 `/api/knowledge/query-backend-diagnostics`、`/api/knowledge/runtime-capability-matrix` 与 runbook verify 端点的贯通回传。

## 工作台层

- 前端编排与诊断入口：`src/frontend/path_app.js`。
- 关键可观测能力已接入：
  - runtime runbook 看板
  - request trace 过滤
  - query backend 诊断与配置
  - 工作台整改回放控制（`risk_only|all` + 1-24 回放上限）及本地偏好持久化
  - 工作台新增整改回放调度编排控制（启用/间隔/触发策略/阈值），并接入后端调度快照与手动 tick
  - runtime summary 中向量加速治理可观测（`queryVectorAcceleration(...)` 同时展示实时计数、circuit 的 warn/fail 阈值元组，以及基于 matrix 信号的 prefilter 预算快照）
  - runbook `history/checks` 已在 summary 与 per-check 两级补充 `queryVectorAccelerationPrefilter` 结构化快照，便于按阈值预算做 ANN 预筛选故障分诊
  - runbook 区域新增向量加速治理钻取面板（`query_vector_acceleration_circuit_state` 的状态/阈值/预算标志/动作清单结构化展示，`query_vector_acceleration_index_sync_health` 的远端 ANN sync-health 视图，`query_vector_acceleration_prefilter_effectiveness` 的预筛选选择模式/候选规模/阈值预算/整改动作展示，并补充 `query_vector_acceleration_traceability` 的关联字段覆盖率与整改动作视图）；同时 server 侧 history/action-queue 也已将该 sync-health gate 视为一等事故对象
  - path strategy 遥测与 session history 分析

## 实践 Runbook（工程流程）

## 1）先做契约校验

```bash
npm test -- src/knowledge.api.contract.test.ts --runInBand
```

## 2）文档治理与页面稳定校验

```bash
npm run docs:diataxis:check
npm run docs:site:build
npm run docs:site:serve
```

## 3）运行时路由与诊断链路自检

- Runbook 读取检查：
  - `GET /api/knowledge/runtime-capability-runbook`
  - `GET /api/knowledge/runtime-capability-runbook/verify?limit=20`
- Trace 关联检查：
  - `GET /api/runtime-request-trace`
  - `GET /api/runtime-request-trace?requestId=<exact_request_id>`
- turn-cache operator 诊断与趋势治理检查：
  - `GET /api/knowledge/conversation/turn-cache/diagnostics`
  - `GET /api/knowledge/conversation/turn-cache/diagnostics/trend?limit=20&windowSize=6&minSamples=3`
  - `GET /api/knowledge/conversation/turn-cache/diagnostics/trend/index?limit=20`
  - `GET /api/knowledge/conversation/turn-cache/diagnostics/trend/export?limit=50`
- 拷贝后前端 runtime shell 检查：

```bash
npm run verify:agent-workspace:runtime
```

- 浏览器渲染 shell 与交互闭环检查：

```bash
npm run verify:agent-workspace:browser
```

- 桌面生命周期代理烟测（runtime + tauri 配置 + source lifecycle 契约 + promotion 生命周期用例）：

```bash
npm run verify:agent-workspace:tauri
```

- Rust 侧 tauri 生命周期契约校验（`pathmode_window_toggle_plan*`，CI 建议 strict）：

```bash
npm run verify:agent-workspace:tauri:rust
npm run verify:agent-workspace:tauri:rust:strict
```

- app/window 生命周期证据链校验（本地可降级 + 严格模式）：

```bash
npm run verify:agent-workspace:tauri:window-evidence
npm run verify:agent-workspace:tauri:window-evidence:strict
```

- strict 证据索引（本地 + CI 严格模式）：

```bash
npm run verify:agent-workspace:tauri:evidence:index
npm run verify:agent-workspace:tauri:evidence:index:strict
npm run verify:agent-workspace:tauri:evidence:summary
npm run verify:agent-workspace:tauri:evidence:release-fragment
npm run verify:agent-workspace:tauri:evidence:manifest
npm run verify:agent-workspace:tauri:evidence:manifest:strict
npm run verify:agent-workspace:tauri:evidence:publish-release-notes -- --tag <release_tag>
```

## 4）检索策略自检

- 同查询对比后端并检查可解释性差距：
  - `POST /api/knowledge/query/compare-backends`
- 查看近期对比历史：
  - `GET /api/knowledge/query/compare-backends/history?limit=8`
- 查看趋势窗口：
  - `GET /api/knowledge/query/compare-backends/trend`

## 5）会话策略质量自检

- 检查策略来源与学习结果一致性：
  - `GET /api/knowledge/session/history?pathStrategySelectionSource=strategy_trend&sinceMinutes=10080`
  - `GET /api/knowledge/quality/trend`
  - `GET /api/knowledge/session/plan/quality/trend`

## 后续推进优先级

1. 先补齐 agent-workspace 合同套件的 CI 常态覆盖缺口：在保留 tauri strict 证据作业的同时，把 `src/agent_workspace.contract.parity.test.ts`、`src/agent_workspace.frontend.test.ts`、`src/agent_workspace.tauri.contract.test.ts` 作为主线阻断门禁。
2. 把 embedded `graphdb/sqlite` 基线从“已证明重启耐久性”推进到 packaged/runtime + 更重工作负载闭环，同时保持 fail-open/fail-closed rollout 语义不破坏；release 报告生成后使用 `verify:foundation:release-evidence` 确认主机证据仍然新鲜。
3. 完成 ANN 的发布级闭环：让新的 sync-backed `external_http` 路径在真实流量下持续稳定，并收紧工作负载/阈值校准。
4. 下一阶段再把当前已接通的 Phase-2 诊断面升级为发布级门禁，但前提是 graphdb/ANN 基线已经达到发布级。
5. 增补跨重启场景下 turn-cache 趋势持久化 index/export 一致性的 CI 验证。
6. 持续加强 strict 证据工件治理（归档、可索引、可导出）以支持运维审计；i18n 长尾结构化卡片重渲继续保留为次优先级，除非其直接解除合同/底座风险。

## 跨平台架构优化（2026-05-02）

已完成跨平台兼容性全面审计与代码架构健康度评估。核心发现与统一修复方案见：

- [跨平台架构优化方案](../../../solutions/cross-platform-architecture-refinement-2026-05-02.md)

方案识别出 6 个阻塞级跨平台问题（Linux asset://localhost 403、Windows sidecar 缺失、macOS arm64 强制签名、Wayland + Godot GL 崩溃、WebKitGTK 依赖文档缺失、CI 矩阵缺 macOS）和 3 个巨型单体文件（server.ts 16,848 行、path_app.js 15,140 行、KnowledgeLearningPlatform.ts 13,370 行），共同构成当前最高优先级的技术债务。修复工作分为三个阶段，与 M10 底座强化流对齐。

**核心洞察**：代码单体与平台脆弱性存在因果关联——拆分 server.ts 可使平台相关路由独立维护；抽取 platform.ts 可消除当前“所有 Unix 系统共用一条 `process.platform === 'win32'` 判断”的隐患。

## 关联文档

- [知识彻底掌握演进路线图](./knowledge-mastery-evolution-roadmap.md)
- [Agent 对话与 Focus Mode 主线交付方案](./agent-conversation-focus-mode-plan.md)
- [接口与运行时契约](../reference/interfaces-and-runtime.md)
- [学习平台契约与工作台基线](../../../solutions/documentation-gaps/learning-platform-api-workbench-contract-gap-2026-04-02.md)
- [Agent Workspace 合同收敛与下一阶段方向要求（2026-04-14）](../../../brainstorms/2026-04-14-agent-workspace-contract-closure-next-direction-requirements.md)
- [演进进度对齐需求](../../../brainstorms/2026-04-11-evolution-progress-alignment-requirements.md)
