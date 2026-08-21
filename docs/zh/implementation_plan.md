
# 2026-05-12 v1.7.0 - HEAD 现实对齐实施计划

## 中文文档

### 2026-06-21 Agent Knowledge Workspace 运行时复用实施计划

#### 目标

通过复用本项目现有的 DAG 支撑运行时，收口 Knowledge Workspace 剩余的图动作缺陷，避免继续维护与主运行时分叉的预览逻辑。

#### 当前代码真相

- `关联聚焦` 现在复用主图面的 graph-view Focus-mode snapshot/runtime 路径；relation edge 与后端 debug 细节只有 Developer Mode 开启时才显示。
- `学习路径` 现在把现有 Path workspace/runtime（`path-container`、path sidebars、`path_app.js`）挂入右侧停靠 pane，而不是渲染手写的 prerequisite/anchor/next DOM 假预览。
- 学习路径目标会基于真实 DAG source graph 按稳定节点 ID、人类可读 label 与 source basename 做一致性解析。worker 收到真实图节点 ID；UI 展示 `water glass` 这类解析后的 label。
- `agent_workspace.js` 现在会从 knowledge point 顶层字段、matched spans 与 citation payload 透传 `sourcePath`，让图目标解析拥有持久的 source-path 信号。
- `path_app.js` 在语义 live-region 被节流时会延迟刷新，避免有效路径已经算出后仍残留 `focus none` / `0 of 0 nodes` 文案。
- `scripts/verify-agent-workspace-browser.js` 现在围绕 `water glass` 播种真实 DAG 邻域，并断言已挂载的 Path runtime 节点数大于 0、语义文本包含 `water glass`、不泄漏 `atom_h`、不出现 `focus none`、也不出现 `0 of 0 nodes completed`。
- `src/agent_workspace.frontend.test.ts` 固定关键不变量：运行时配置可以使用 DAG ID（fixture 中为 `atom_h`），但右侧 pane UI 必须显示节点 label（`water glass`），不能暴露内部 ID。
- 命中文件帮助入口继续保持为紧凑的 hover/focus 问号控件；左侧命中区域保持可滚动，动作按钮保持可达。
- 兼容性保持 additive：没有把既有 response shape 改成强制字段，并继续接受 legacy `performance.deepDebug` 作为 Developer Mode 兼容键。

#### 执行顺序

1. 图目标解析保留在 workspace/path 边界，不从展示字符串里反推运行时语义。
2. 保持 Path runtime 作为 diffusion/path 语义的唯一 owner，不再引入手写 preview graph。
3. Focus 默认输出保持面向用户且克制；relation 列表与后端诊断只放在 Developer Mode 后。
4. 保持 strict browser verification 作为截图问题的可执行验收面，尤其是 `water glass.md`。
5. 只有新模块持有真实不变量时才继续拆分 owner；避免只转发 graph payload 的 pass-through adapter。

#### 验收标准

1. 点击 `学习路径` 会挂载真实 Path workspace，并从所选 DAG 节点计算出非空路径。
2. Path worker 收到有效图节点 ID，同时右侧 pane 的可见标签优先使用人类可读节点名。
3. 点击 `关联聚焦` 会显示所选节点的 Focus-mode 图状态，默认不显示后端 / relation debug 列表。
4. 命中文件列表可纵向滚动，能显示 `water glass.md`，并保持 `学习路径` / `关联聚焦` 按钮可交互。
5. 如果用户可见的 path pane 中重新出现 `atom_h`、`focus none` 或 `0 of 0 nodes`，strict browser verifier 必须失败。

### 2026-06-18 最终回复审核鲁棒性实施计划

#### 目标

在回答合成与公开释放之间补上一层确定性的 final-answer release-review owner，让 agent 在把答案发给用户前，先决定应该直接放行、收缩改写，还是降级 abstain。

#### 当前代码真相

- `waterglass` 的 compact/spaced alias 归一化问题已经在 planner/retrieval 边界修复。
- 项目已经有 `src/learning/graphContextAssembler.ts` 作为 graph-conditioned context assembly owner，因此当前缺口不是图检索，而是公开回答发布前的最终审核 owner。
- 本轮已新增 `src/learning/answerReleaseReview.ts`，专门负责 `release` / `revise` / `abstain` 决策。
- `src/learning/types.ts` 现在以 additive 方式把 `AnswerReleaseReview` 接到 response、trace 与 `KnowledgeRun`。
- `conversationComposer.ts` 现在先产出草稿回答，再把最终公开回答交给 reviewer 决定，而不是直接放出 draft。
- reviewer 现在也会执行 `claim_grounding_alignment`：即便已经有 grounded evidence，只要草稿回答与 citation/knowledge point 的主支撑发生漂移，仍会强制改写。
- reviewer 现在还会执行 `claim_structured_consistency`：即使 topical lexical overlap 还算合理，只要草稿里的数值或年份这类结构化事实与 citation/knowledge point 支撑冲突，也会被确定性改写。
- reviewer 现在还会执行 `claim_structured_comparison_consistency`：当 `higher/lower`、`greater/less`、`高于/低于` 这类显式比较与“同一属性、同一单位”的支撑事实顺序相反时，也会在 release 前被确定性改写。
- reviewer 现在还会执行 `claim_attribute_consistency`：即使主体保持不变，只要显式 `has` / `have` / `具有` 属性断言把支撑属性从 `中等热绝缘性能` 之类偷换成 `高热绝缘性能`，也会被确定性改写。
- reviewer 现在还会执行 `claim_containment_consistency`：即使 grounded subject 保持不变，只要草稿在显式内容/容纳关系里把 `contains water` 这类被容纳内容偷换成 `contains oil`，也会被确定性改写。
- reviewer 现在还会执行 `claim_composition_consistency`：即使 grounded subject 保持不变，只要草稿在显式 `由...组成` / `composed of` 关系里把 `water and a glass cup` 这类支撑组件偷换成 `oil and a plastic cup`，也会被确定性改写。
- reviewer 现在还会执行 `claim_purpose_consistency`：即使 grounded subject 保持不变，只要草稿在显式 `used for` / `用于` 关系里把 `drinking water` 这类支撑用途偷换成 `storing motor oil`，也会被确定性改写。
- reviewer 现在还会执行 `claim_dependency_consistency`：即使 grounded subject 保持不变，只要草稿在显式 `depends on` / `requires` / `依赖` / `前置条件` 关系里把 `基线测量和传感器校准` 这类支撑依赖偷换成 `最终报告`，也会被确定性改写。
- reviewer 现在还会执行 `claim_location_consistency`：即使 grounded subject 保持不变，只要草稿在显式 `located in` / `位于` 框架里把 `主舱室` 这类支撑位置偷换成 `辅助舱室`，也会被确定性改写。
- reviewer 现在还会执行 `claim_subject_consistency`：即使事实尾部仍然与支撑一致，只要草稿把 grounded subject 从 `Water density` 偷换成 `Glass density` 这类别的主体，也会被确定性改写。
- reviewer 现在还会执行 `claim_state_consistency`：即使 topical lexical overlap 仍然通过，只要同一主体的定义/系词型状态断言与支撑冲突，例如 `open system` vs `closed system`，也会在中英文路径上被确定性改写。
- `located in` / `位于` 这类位置谓词现在已从 `claim_state_consistency` 的 frame 抽取中显式排除，因此位置断言会由 location slice 持有，而不会误报成 state contradiction。
- reviewer 现在还会执行 `query_intent_alignment`：当 `what is` / `什么是` 类问题已经命中定义证据，但草稿回答仍然停留在“本文档旨在……”这类文档自述时，会在 release 前被确定性改写成直接定义句。
- reviewer 现在还会执行 `claim_polarity_consistency`：即使 topical lexical overlap 仍然通过，只要草稿把 support 明确说反（正反断言反转），也会被确定性改写。
- reviewer 现在还会执行 `claim_graph_causal_consistency`：利用 `connectionPaths`、`knowledgePointRelations`、`predecessorWindow` 与 `successorWindow` 检查 `causal` 方向是否被说反，并在冲突时输出 DAG 支撑的纠正句。
- reviewer 现在还会执行 `claim_graph_order_consistency`：利用 `connectionPaths`、`knowledgePointRelations`、`predecessorWindow` 与 `successorWindow` 检查 `prerequisite` / `sequence` 方向是否被说反，并在冲突时输出 DAG 支撑的纠正句。
- reviewer 现在还会执行 `claim_graph_comparison_consistency`：利用已装配图证据，在同一 title pair 只支撑单一 `contrast` / `analogy` 家族时，拦截把两者说反的草稿。
- reviewer 现在还会执行 `claim_temporal_validity_consistency`：直接消费 `graphContext.temporalValidity`；当 grounded evidence 带有时序警告时，未显式加时间限定的“当前结论”草稿会在 release 前被改写，带明确时间限定的答案仍可放行，而仅有 `supersedes` 血缘本身不会误触发门禁。
- cross-language abstention hygiene 现在已显式化：中文 scoped miss 不再退化成 English diagnostic-heavy abstention。
- `KnowledgeLearningPlatform.ts` 现在会把 review 决策写入 response、trace 与 workflow artifact。
- 运维检查面现在已经能查看 reviewer 状态，但不会重新挤占主回答区：`src/frontend/agent_workspace.js` 会映射并净化 `answerReleaseReview`，`src/frontend/workspace_panes.js` 会在 `knowledge_run` 明细 / 历史卡片中渲染 release-review 结果。
- `WorkspaceExportBundle.ts` 现在会把紧凑 reviewer 摘要投影到 `runtime.knowledgeRunReports[*].answerReleaseReview`，因此 export/replay 面也能审计 release decision，而不必重复携带完整回答文本。
- `WorkspaceExportBundle.ts` 现在还会在 `runtime.knowledgeRunAnswerReleaseAuditSummary` 中派生一份 durable 的聚合 reviewer 审计摘要，覆盖 reviewed/unreviewed 计数、decision bucket、改写次数、failed-gate 次数、泄漏次数与最近审核时间。
- 聚合 reviewer 审计现在还会补出 `reviewTrend` 趋势窗口与 `failedGateAging` 门禁老化摘要，两者都继续复用同一条 reviewer telemetry 路径，而不是再引入第二个审计 owner。
- 运维侧的 `knowledge_run` history 现在会渲染同一套长周期 release-audit 形态，包括 review trend window 与 gate-aging 摘要，因此多次运行之间的 reviewer 漂移已经可见，同时不扩大主回答区，也不再发明第二条 telemetry 路径。
- 同一条聚合审计路径现在还会继续派生 compare-ready drilldown：近期/前序已审窗口的指标差值、按 gate 的窗口变化，以及最近两次已审运行的 delta；`knowledge_run` compare 卡片也会在原有质量/图信号对比之外补出 answer-release 对比。
- `scripts/verify-knowledge-workspace-runtime.js` 现在已经把 reviewer 存在性与主回答卫生要求纳入 `waterglass` 截图场景的正式运行时验收，其中也包括拒绝 `本技术文档旨在` 这类文档自述片段进入主回答。
- 共享的确定性 alias/scope 回归语料现在已经落在 `src/learning/KnowledgeWorkspaceConversationRegression.ts`：既覆盖截图派生的 `waterglass` compact/spaced 用例，也覆盖 `financial` 下的跨 scope 恢复用例；Jest 与运行时 verifier 复用同一份数据集。
- 这份共享语料现在也明确区分“跨语料稳定的不变量”和“依赖真实文档措辞的中间草稿行为”：
  - 对内存态 Jest fixture，只要最终公开回答已经 grounded 且收缩，`release` 与 `revise` 都是允许结果，
  - 对真实截图派生的运行时用例 `waterglass_explicit_scope_compact_zh`，则继续强制要求 `revise`，并要求 failed gate 中出现 `query_intent_alignment`。
- 这份语料还暴露了 `KnowledgeLearningPlatform.ts` 中的一个 soft-miss 检索缺陷：planner scope recovery 先前只会在 0 结果 miss 时触发，现在改为在“scope 内 rerank 噪声候选仍在，但没有任何 planner title-hit 文档幸存”时也会触发。
- `src/learning/answerReleaseReview.test.ts` 现在已经钉住确定性的 structured contradiction 用例：数值冲突、年份冲突，以及“支撑里有多个候选值但其中一个就是正确值”的防误报场景。
- `src/learning/answerReleaseReview.test.ts` 现在还固定了确定性的 structured-comparison 用例：英文反转、中文反转、被支撑比较直放行，以及 mixed-property 防误报控制。
- `src/learning/answerReleaseReview.test.ts` 现在还固定了确定性的 polarity contradiction 用例：英文反转、中文反转，以及“support 带有无关否定句但不能误报”的防误报场景。
- 2026-06-19 的一次运行时复核还确认了一个操作约束：reviewer gate 变更必须对着新鲜构建的 `dist` 产物验证。第一次在陈旧编译输出上跑 verifier 时，新 gate 清单被暂时遮蔽；执行 `npm run build:mini` 后再次验证，运行时 reviewer 面才与源码重新对齐。
- 右侧文件预览/高亮链路与最终回答审核仍是两个独立 owner，但当前 graph-focus 契约已经超过单纯 payload 加固：`src/frontend/markdown_runtime.js` 会给渲染后的 markdown block 标注 source-line 元数据，`src/frontend/workspace_panes.js` 会在渲染节点 range 与可信 span 重叠时优先使用 `source_line_provenance`，并在已认证 block 内优先使用 snippet 尺度的 source-fragment projection，之后才回退到 `line_window`、`snippet_fallback` 与 broad text search；additive 诊断也会同时暴露节点高亮策略、内联高亮策略与 provenance 覆盖度。
- `src/agent_workspace.frontend.test.ts` 现在已经固定“重复 snippet 仍要命中正确段落”“行号不可用时必须正确回退”“单行段落不能整行过高亮”以及“嵌套 inline 节点必须命中精确片段”四类关键失败场景，因此右侧证据预览不再只依赖脆弱的 snippet-only 启发式。
- 2026-06-19 的复审已经确认：缺失 owner 这一阶段性问题已经关闭；当前活跃缺口已经转移到超出 lexical + query-intent + structured + structured-comparison + attribute + containment + composition + purpose + dependency + location + subject + state + polarity + graph-causal + graph-order + graph-comparison + temporal-validity 栈的更广 claim-vs-citation / claim-vs-evidence 矛盾检测，以及通过显式 offset 或更丰富 AST provenance 解决“同一已认证渲染 block 内重复片段去歧义”的剩余缺口，而不是继续讨论 prompt framework 是否要引入。

#### 下一步执行顺序

1. 保持 reviewer 窄口径，只拥有 release invariant，不让 prompt template 重新接管 release policy。
2. 基于这份显式 alias/scope 回归语料以及当前 query-intent + structured-fact + structured-comparison + attribute + containment + composition + purpose + dependency + location + subject + state + polarity + graph-causal + graph-order + graph-comparison + temporal-validity reviewer 切片，继续把 lexical grounding check 扩展到更深的 claim-vs-citation / claim-vs-evidence 矛盾检测，同时控制 false positive；其中 structured-comparison 切片继续只接受“同一属性、同一单位”的保守可比对。
3. 把当前 block-level markdown source mapping 与 `source_line_provenance` -> source-fragment projection -> `line_window` -> `snippet_fallback` -> 内联片段高亮栈视为已落地基线；下一步不是重新发明前端 release policy，而是用显式 offset 或更丰富 AST provenance 继续解决重复片段去歧义。
4. 持续扩充共享语料，覆盖更多真实的跨 scope、紧凑别名与同义表达失败场景，并保持 Jest 与运行时 verifier 的确定性预期一致。
5. 继续做 owner reduction，但前提仍然是“新 owner 持有真实决策或不变量”。

#### 验收标准

1. 不支持的草稿回答不能再把 `No scoped knowledge points matched` 或 `retrieval_candidates_below_threshold` 这类内部诊断泄漏到主回答区。
2. 对于 grounded draft 中与证据冲突的结构化数值 / 年份事实，系统必须在 release 前改写，而不能仅因 lexical overlap 还在就放行。
3. 对于 grounded draft 中把被支撑的“同一属性、同一单位”比较方向说反的断言，系统必须在 release 前改写，避免把 `Water density is higher than glass density` 这类顺序漂移公开放行。
4. 对于 grounded draft 中“主体没变、显式内容/容纳关系没变，但被容纳内容被偷换”的断言，系统必须在 release 前改写，避免 `contains water` -> `contains oil` 这类内容漂移进入公开回答。
5. 对于 grounded draft 中“主体没变、显式 `由...组成` / `composed of` 关系没变，但支撑组件被偷换”的断言，系统必须在 release 前改写，避免 `water and a glass cup` -> `oil and a plastic cup` 这类组成关系漂移进入公开回答。
6. 对于 grounded draft 中“主体没变、显式 `used for` / `用于` 关系没变，但支撑用途被偷换”的断言，系统必须在 release 前改写，避免 `drinking water` -> `storing motor oil` 这类用途漂移进入公开回答。
7. 对于 grounded draft 中“主体没变、显式 `located in` / `位于` 关系没变，但支撑位置被偷换”的断言，系统必须在 release 前改写，避免 `主舱室` -> `辅助舱室` 这类位置漂移进入公开回答，同时这类位置句型不得误触发 state gate。
8. 对于 grounded draft 中“事实尾部还对、但 grounded subject 被偷换”的断言，系统必须在 release 前改写，避免实体 / 主体漂移进入公开回答。
9. 对于 grounded draft 中同主体但状态说反的断言，系统必须在 release 前改写，避免把 `open system` vs `closed system` 这类矛盾公开放行。
10. 对于 grounded draft 中把支撑明确说反的正反断言，系统必须在 release 前改写，而不能仅因 lexical overlap 还在就放行。
11. 对于 grounded draft 中把 DAG 支撑的因果方向说反的断言，系统必须在 release 前改写，而不能把反向因果公开放行。
12. 对于 grounded draft 中把已装配 DAG 的 `prerequisite` 或 `sequence` 方向说反的断言，系统必须在 release 前改写，而不能把反向顺序公开放行。
13. 对于 grounded draft 中把 DAG 只支撑单一对比分支的 title pair（仅 `contrast` 或仅 `analogy`）说成相反对比语义的断言，系统必须在 release 前改写，而不能把 comparison branch 漂移公开放行。
14. 对于 grounded draft 中把带时序警告的 DAG 证据直接发布成“当前结论”的断言，系统必须在 release 前改写；如果公开回答已经显式带时间限定，则允许放行，而仅有 `supersedes` 血缘本身不得触发该 gate。
15. `AgentConversationResponse`、trace 与 `KnowledgeRun` 都必须保留 additive 的 `answerReleaseReview` 状态。
16. 运维检查面必须能渲染 reviewer decision、failed gates 与 original/public answer 差异，同时不扩大主回答区。
17. Workspace export 的 knowledge-run report 必须能为 `release` / `revise` 流程保留紧凑 reviewer 摘要，并在 review 数据缺失时保持向前兼容。
18. Workspace export 还必须在 `runtime.knowledgeRunAnswerReleaseAuditSummary` 中保留 additive 的聚合 reviewer 审计摘要，以及同一路径派生出的 review-trend / gate-aging / compare-ready drilldown 摘要；运维 history 卡片与 compare 卡片都必须消费同一套 reviewer telemetry，而不扩大主回答区。
19. 右侧文件命中预览必须基于稳定 payload 字段解析原文与命中高亮；即使 top-level hit 字段不完整，也必须能消费 citation-backed path/snippet；渲染后的 markdown block 必须保留 source-line 元数据，在渲染节点 range 与可信 span 重叠时优先使用 `source_line_provenance`，并在已认证 block 内优先投影 snippet 尺度的 source-fragment 内联高亮，否则再回退到 `line_window` / `snippet_fallback` / text search，同时保留运维诊断。
20. 共享 alias/scope Jest 语料在最终公开回答已经 grounded 且收缩时允许 `release` 或 `revise`；而截图派生的运行时用例 `waterglass_explicit_scope_compact_zh` 仍必须触发 `revise`，且 failed gate 必须包含 `query_intent_alignment`。
21. reviewer gate 变更后的运行时验证必须对着新鲜构建产物执行，因此在 `npm run verify:knowledge-workspace:runtime` 前必须先刷新 `dist`（例如执行 `npm run build:mini`）。
22. `npm run verify:knowledge-workspace:runtime` 必须通过共享 alias/scope 回归语料，包括截图派生的 `waterglass` compact/spaced 双查询与 `financial` 下的跨 scope 恢复双查询，并确认 reviewer/public-answer 一致性。
23. 现有 `assistantMessage`、`answer`、`assistantBlocks` 与下游 client 必须保持向前兼容。

### 2026-06-17 Agent Knowledge DAG 实施计划

#### 目标

将已澄清的 DAG 要求转成可执行顺序：使用现有 learning graph 作为 answer-planning substrate，同时保持公开回答聚焦与运行时兼容。

#### 当前代码真相

- 当前图底座是项目内部已有结构：`KnowledgeAtom`、`RelationEdge`、`TemporalEdge`、evidence spans、store ops 与 `findPath`。
- 当前切片已经有一等 graph-conditioned context assembler：`src/learning/graphContextAssembler.ts` 会在回答合成前选择 anchor、重排 support node、保留显式 `connectionPaths`，并补有界 predecessor/successor window 与 graph diagnostics。
- 当前持久化会在自动保存重建 snapshot 时保留仍然有效的 store 侧 relation/temporal edges，避免 read-side query/conversation 流程在装配 `connectionPaths` 前丢掉外部增强 DAG 结构。
- 当前 retrieval 路径已经使用有界 graph-aware ranking signal，而不再主要依赖 relation degree；剩余工作转为更广的真实回归校准。
- retrieval 侧的 graph intent detection 现在已经补齐中文 compare/how-to/explain 标记，并对 direct compare branch 相对 reference-only note 做了显式结构性加权。
- `graph_comparison_branch` 质量门禁现在已经对假阳性做了校准：compare intent 不会再仅凭 reference-only support 就通过，而必须出现 contrast/analogy 或多分支结构。
- 当前运维可见诊断已经有三个具体面：右侧 graph-focus 的路径回退诊断、durable `knowledge_run` 卡片中的 graph context / graph diagnostics 检查面，以及 knowledge-run history/compare 流程中的紧凑 graph telemetry。
- 有价值的 graph-focus diagnostics 现在也已经跨过运行时边界：agent workspace 会把它们写入 session state，后续 conversation/study-session 写入会保留这段历史，workspace export 则会派生 durable `runtime.graphFocusReports`。
- prompt-framework 研究应指导 contract 与 evaluation，不应把 Python framework 拉入 app runtime。
- 2026-06-18 的截图驱动运行时回归说明：`什么是waterglass?` 这类紧凑混合 query 上，planner 的 alias normalization 与 retrieval scoring 曾经发生漂移；当前切片已通过把 planner-derived query variants 显式下发到 retrieval，并把 compact/spaced `waterglass` 双查询提升为运行时 verifier，修复这一缺口。
- 运行时 verifier 现在不再只硬编码 `waterglass` 双查询：默认无 `--query` 路径会加载共享 alias/scope 回归语料，对应的 Jest 套件也会在刻意注入 `financial` 噪声文档的前提下复用同一份预期。
- 这份共享语料还暴露了第二个检索契约缺口：planner scope recovery 必须响应 soft miss，而不只是 0 结果 miss，因此现在只要 rerank 后没有任何 planner-compatible title-hit 文档幸存，就会触发恢复。

#### 下一步执行顺序

1. 保持新的 assembler surface additive，并继续保证向前兼容。
2. 保持 planner 与 retrieval 的 query normalization 由同一契约拥有，避免“文档标题已命中但证据检索仍断开”的问题再次出现。
3. 保持 graph-aware ranking 有界，并用回归用例持续校准，避免回到 degree-driven hub 排序。
4. 现在 `knowledge_run` history/compare telemetry 已通过 `runtime.knowledgeRunReports`、graph-focus diagnostics 也已通过 `runtime.graphFocusReports` 进入 export，下一步转为校准这些 replay/export-oriented 运维检查面的信号质量。
5. 将 graph/debug/evidence 细节留在 evidence/export surface，而不是公开回答区。
6. 继续校准新的图专项回答质量门禁，并补更多回归证据与运维证据。
7. 只有当新模块拥有真实决策、状态或不变量时，才继续做 owner reduction；避免新增泛化 panel-state 透传端点。

#### 验收标准

1. `assistantMessage` 与现有 conversation client 仍然有效。
2. graph ops 失败时能带 diagnostics 回退到当前 retrieval-grounded behavior。
3. 右侧文件命中继续保留 source markdown 与 matched-span highlight 行为。
4. 不向 Tauri/Node runtime 引入新的宽 prompt-framework 依赖。
5. `npm run verify:knowledge-workspace:runtime` 必须通过默认 alias/scope 回归语料：既包括 `什么是waterglass?` / `什么是water glass`，也包括 `financial` scope 下的 `what is water glass?` / `what is waterglass?`，并且不能出现 0 citations 或 `retrieval_candidates_below_threshold`。

### 2026-06-10 知识工作区与 DAG 实施计划

#### 目标

在现有主线对齐计划基础上，补充一层专门面向知识工作区与现有 DAG 学习底座的代码现实判断。

#### 当前代码真相

- 当前分支已经具备结构化 grounded conversation、按文档聚合的 knowledge point、durable `flashcard_batch` / `knowledge_run` artifact，以及 workflow-artifact review follow-up。
- 当前 DAG 学习底座已经在代码中落地：`KnowledgeAtom`、`RelationEdge`、`TemporalEdge`、path query 与 prerequisite 驱动学习流都已存在。
- 先前最主要缺层 retrieval 与 answer synthesis 之间的 graph-conditioned context assembly，现已落地为 `src/learning/graphContextAssembler.ts`。
- 主回答区收缩切片已经在 composer/frontend 边界落地；剩余产品面缺口主要是 right-pane-first 知识阅读与 durable evidence review。

#### 下一步执行顺序

1. 让新的 2026-06-10 知识工作区 / DAG 对齐文档持续同步到所有活跃入口文档。
2. 保持已收缩的用户可见回答契约，同时把 supporting graph/evidence data 路由到次级表面。
3. 让左侧 knowledge hit 收敛为 right-pane-first 阅读模型。
4. 把 `knowledge_run` 与 `flashcard_batch` 视为第一批 durable evidence surface。
5. 在新的 assembler + graph-aware ranking 边界之上继续扩展右侧 / 运维诊断，并校准图专项质量门禁。
6. 继续缩减主要 server 与 frontend host 文件的所有权压力。

### 2026-06-06 主线架构对齐实施计划

#### 目标

将当前代码 / 方案评估落入活跃实施计划，同时保持仓库位于 `main` 并保持向前兼容。初始对齐切片仅更新文档；后续 P1 证据切片可以调整 release verifier tooling，但不得改变公开运行时 API。

#### 当前代码真相

- Scoped retrieval 已有代码支撑：`KnowledgeQueryRequest.scope`、`KnowledgeCorpusScope`、workspace readiness、miss diagnostics、active-target hydration 与 workspace/export substrate 已存在。
- Grounded conversation 已进入 operational 状态：`AgentConversationResponse` 携带 `answer`、citation、memory action、trace 和可选 `assistantBlocks`；legacy `assistantMessage` 仍有效。
- Program A-F 底座已在 `src/resources/`、`src/indexing/`、`src/workspace/`、`src/session/`、`src/workflows/`、`src/memory/`、`src/export/` 中实现。
- 平台 / 导出边界已通过 `PlatformCapabilities`、`RenderMaterializer`、render routes 与 deterministic workspace export bundle 显式化。
- graphdb/sqlite 与 ANN/external connector 目前是 operational baseline；生产闭环仍需要 soak、多轮主机证据、工作负载阈值、recall/latency 校准与 strict rollout 证明。
- 架构缩减仍落后于目标：`src/server.ts` 与 `src/learning/KnowledgeLearningPlatform.ts` 仍是最主要的实现重心。

#### 从当前 `main` 出发的执行顺序

1. **P0：文档真相同步**
   - 保持 2026-06-06 solution note、development progress dashboard、task、TODO、README、interface docs 使用同一口径。
   - 没有发布级证据时，不把 operational-baseline 表述改写为 production-closed。
2. **P1：release-grade graphdb/ANN 闭环**
   - 将 sqlite soak verifier 推进为多轮证据。
   - 收紧 graphdb connector health/budget 阈值。
   - 完成 ANN recall/latency 校准后，再把 Phase-2 diagnostics 升级为发布门禁。
3. **P2：`server.ts` 所有权缩减**
   - 将 turn-cache、alert-trend、runbook bridge、rollout-profile、connector helper 等逻辑迁入明确模块。
   - 在迁移所有权时保留 endpoint 名称与响应兼容性。
   - `src/routes/runtimeRunbookRouteOps.ts` 现在负责 runtime runbook 的 modular-route operation assembly；后续 P2 应继续把 route-layer composition 从 `server.ts` 中剥离出来，但不要给有状态逻辑加只转发的 facade。
   - 对于体量过大的学习运行时 helper，同样适用这一规则：纯数据组装逻辑不应永久内联在 KLP 中，agent conversation reply composition 已经进入可独立模块化的边界。
4. **P3：学习平台领域拆分**
   - 只有当新 owner 能隐藏状态或强制不变量时，才继续拆分 ingest/query/conversation/mastery/quality/tutor/memory 所有权。
   - 避免给 `KnowledgeLearningPlatform.ts` 包一层只转发的 facade。
5. **P4：Agent Workspace 合同加固**
   - 保持 stream-first + sync fallback + replay 兼容。
   - 只通过可选 payload 与 parity-tested capability 扩展 typed `assistantBlocks` 覆盖面。
   - 将 evidence rendering 与 evidence persistence 分开推进：当前 graph-focus pane 已经能在原文中高亮命中段落，但后续仍需要 durable evidence / claim surface，而不是只停留在单轮 snippet 载荷里。
6. **P5：平台 / 导出兼容性**
   - 保持 Godot/mobile PNG-first materialization 与 export profile 语义显式化。
   - 保持核心 retrieval/synthesis 不包含 shell-specific 分支。

#### 验收标准

1. 活跃规划文档都指向同一份 2026-06-06 状态与后续顺序。
2. 当前对齐与 release-evidence 切片不修改任何公开运行时 API。
3. 后续代码工作可以按明确优先级启动：先发布级底座闭环，再所有权缩减，再 richer agent output。
4. 文档提交后工作区保持 clean。

### 2026-06-06 P1 Foundation Release Evidence 新鲜度与历史证据切片

#### 目标

把 sqlite 与 ANN 的 release evidence 路径从“各自产出报告”推进为一个统一的发布侧新鲜度校验入口，并提供更严格的 repeated evidence 审计；该审计命令本身不重新执行重型 runtime 验证，也不把当前 baseline 宣称为 production closure。

#### 已落地代码路径

- 新增 `scripts/verify-foundation-release-evidence.js`。
- 新增 `npm run verify:foundation:release-evidence`。
- 新增 `npm run verify:foundation:release-evidence:strict`，它会用 `--min-report-count 3` 执行同一个校验器。
- 新增 `npm run verify:foundation:release-evidence:multi-host`，它会用 `--min-report-count 3 --min-host-count 2` 执行同一个校验器。
- 新增 `src/foundation.release.evidence.contract.test.ts`，并纳入 `test:migration`。
- 在 `getFoundationReadiness().mandatoryChecks` 中新增 `foundation_release_evidence_freshness`。
- 在 `getFoundationReadiness().mandatoryChecks` 中新增 `foundation_release_evidence_history`，指向 `npm run verify:foundation:release-evidence:strict`，同时保留既有 freshness 门禁。
- 通过 `--min-report-count` 与 `NOTE_CONNECTION_FOUNDATION_RELEASE_EVIDENCE_MIN_REPORT_COUNT` 新增 repeated evidence 的 CLI/env 控制。
- 通过 `--min-host-count` 与 `NOTE_CONNECTION_FOUNDATION_RELEASE_EVIDENCE_MIN_HOST_COUNT` 新增 host-diversity evidence 的 CLI/env 控制。
- 新增对 `foundation-sqlite-runtime-report-*.json` 与 `foundation-ann-runtime-report-*.json` 时间戳历史报告的扫描。

#### 证据契约

默认新鲜度校验器读取：

- `output/verification/foundation-sqlite-runtime/foundation-sqlite-runtime-report-latest.json`
- `output/verification/foundation-ann-runtime/foundation-ann-runtime-report-latest.json`

它会验证：

- 通过 `NOTE_CONNECTION_FOUNDATION_RELEASE_EVIDENCE_MAX_AGE_HOURS` 执行有界新鲜度校验；
- sqlite 必须是 `suiteKind: soak`，包含 heavy profile、`dist_node_runtime`、`packaged_sidecar`、正数 soak cycles、通过的 soak gates 与 query samples；
- ANN 必须是 `suiteKind: matrix`，`releaseGatesEnabled: true`，包含 `smoke` / `medium` / `heavy`、两条 runtime mode、通过的 release gates、query samples，并且 expected recall 不低于报告阈值。

默认命令保持向前兼容：每个组件至少需要 1 份有效且新鲜的 release-contract 报告和 1 个 host key；旧的过期或非 release 历史文件只作为 warning 忽略。严格命令要求每个组件至少有 3 份有效新鲜报告后才会通过。opt-in 多宿主命令还要求每个组件至少覆盖 2 个不同 host key；host key 优先来自报告中的显式宿主标识，缺省时退回 `platform/arch`。

#### 当前证据位置

当前 Windows 宿主已经具备通过的严格 repeated-evidence 审计：

- sqlite release 报告刷新于 `2026-06-06T03:17:45.083Z`；
- ANN release-gate 报告刷新于 `2026-06-06T03:19:22.368Z`；
- `verify:foundation:release-evidence:strict` 于 `2026-06-06T03:21:04.144Z` 校验通过，sqlite 为 `3/3`，ANN 为 `3/3`。

这只关闭当前宿主的 repeated-evidence 门禁。多宿主审计工具现在已经可执行，但当前 Windows 证据仍是单宿主证据。这不关闭多宿主证据、ANN 阈值收敛、connector budget 校准或 production closure。

#### 剩余 P1 推进方向

本切片让 release evidence 更容易审计，也给发布 runbook 增加了严格 repeated evidence 与 opt-in 多宿主门禁。Foundation readiness 现在同时把默认 freshness 审计与严格 history 审计暴露为 mandatory checks。当前 Windows 宿主已满足严格 repeated-evidence 门禁，因此下一步 P1 转向真实多宿主证据收集、ANN 阈值收敛、connector budget 校准，并且只有在 graphdb/ANN baseline 达到发布级之后，才推进 Phase-2 gate promotion。

### 2026-05-27 工作流真相同步与后续主线重对齐

#### 目标

让实施计划重新与 `main` 上的真实状态对齐，重点覆盖三层真相：

- 仓库自有 GitHub workflow 基线其实已经是 `actions/setup-node@v4` + `node-version: "24"`，
- 旧的 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` 过渡覆盖变量其实已经从 workflow 中移除，
- 但 `scripts/verify-fixrisk-issues.js` 仍在校验这个已移除的过渡变量，而不是当前基线，因此 `FR-010` 会在“工作流已迁移”的前提下依旧失败。

#### 根因与修正

- 先前期望：
  - FR-010 的闭环仍绑定在过渡期兼容覆盖变量上。
- 当前代码真相：
  - workflow YAML 已经迁移到“不依赖覆盖变量”的 Node 24 基线，
  - 剩余的 Node 20 弃用注解来自 artifact/release helper 这类 marketplace action 运行时，而不是仓库自有 `setup-node` 配置。
- 本轮修正：
  - `scripts/verify-fixrisk-issues.js` 现在显式校验 `actions/setup-node@v4`，
  - 在使用 `setup-node` 的 workflow 中强制 `node-version: "24"`，
  - 同时把“必须存在 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`”改成“必须移除该过时过渡变量”。

#### 从当前 HEAD 出发的下一步执行顺序

1. **P0：持续保持 workflow 真相、verifier 真相、docs 真相一致**
   - 不再让过渡期假设重新进入 CI 门禁，
   - fixrisk 的闭环标准始终绑定仓库可控现实。
2. **P1：release-grade graph/store 加固**
   - 把当前 `graphdb/sqlite` operational baseline 从重启/工作负载证明继续推进到 soak 与性能闭环，
   - 保留独立的主机级 soak 门禁（`verify:foundation:sqlite-runtime:soak`），避免把发布级证据稀释到较轻量的矩阵验证里。
3. **P2：release-grade ANN 校准**
   - 保持 `external_http` connector 在 workload proof 下稳定，再收口 recall/latency 阈值校准。
4. **P3：Tauri-first reply/render surface 扩展**
   - 继续以共享的 Reader-derived runtime 作为 Tauri 基线，
   - 把 `assistantBlocks` 从“legacy answer 的薄包装层”推进为真正的回复组织层，
   - 在不破坏兼容性的前提下继续扩展 typed block 使用面。
5. **P4：tutor routing 与 orchestration 加固**
   - 从已激活的 local-first 路由推进到生产级多 provider 策略。
6. **P5：架构压力缩减**
   - 在保持向前兼容性的前提下，继续压缩 `server.ts`、`KnowledgeLearningPlatform.ts` 和大型前端宿主文件。

### 2026-05-27 Tauri-first Agent Reply Rendering 现实对齐

#### 目标

让当前活跃实施计划重新与代码现实对齐：

- scoped knowledge-workspace grounding 已是真实能力，
- provider / TOML settings 交付已是真实能力，
- Reader 的 markdown / math / mermaid 加固已是真实能力，
- 但 Tauri agent reply area 仍停留在纯文本，因此它已成为当前最直观的未完成交互缺口。

#### 代码 / 方案现实

- 代码中已完成：
  - active-target-aware workspace hydration 与 title-like selective document hydration，
  - conversation trace 中的 workspace readiness 与 miss diagnostics，
  - 面向 `app_config.toml` 的 provider preset / template 流程，
  - conversation turn / resume 头的 CORS 闭环，
  - Reader 侧 Mermaid / KaTeX 加固与 leaked-error suppression，
  - 一等的 Tauri runtime / webview / window debug capture 脚本，
  - 仓库自有 workflow 已迁移到“不依赖过渡覆盖变量”的 Node 24 基线，FR-010 现按 `setup-node@v4` + `node-version: "24"` 的当前真相进行门禁校验。
- 本轮已新落地：
  - Tauri agent workspace 中的 typed reply-rendering model，
  - Reader render substrate 在 agent reply surface 中的共享复用，
  - 面向大型 HTML assistant output 的 artifact-style 隔离路径（sandboxed preview）。
  - assistant 输出现在按 overview / explanation / evidence summary / memory notice / action guidance 分块组织，而不再只是单个 markdown answer 的包装。
  - 这些 section 现在也具备更实在的语义内容：explanation 会锚定最强 scoped knowledge point，evidence summary 会反映真实 scoped citation，next-action guidance 也会吸收 scoped node 与 memory action 的 follow-through 建议。
  - reply composition 现在也具备 query intent awareness：comparison-style 与 how-to-style prompt 不再复用与普通 explanatory prompt 完全相同的 explanation / action phrasing。
  - reply composition 的所有权现在也已明确进入可抽取架构面：`conversationComposer` 模块边界用于降低 `KnowledgeLearningPlatform.ts` 重力井，同时不改变公开响应契约。
  - grouped knowledge point 与 scoped reply section 的组装路径现在已有显式代码 owner：`src/learning/conversationComposer.ts`，因此 `KnowledgeLearningPlatform.ts` 不再需要在同一文件里同时承载 session/runtime state 与 reply-composition 细节。

#### 下一步执行顺序

1. **P0：文档真相同步**
   - 保持 `development-progress-dashboard`、`agent-conversation-focus-mode-plan`、`implementation_plan`、`tauri_tasks` 与当前代码一致，而不再停留在 Program F-only 视角。
2. **P1-P4：当前代码已交付**
   - 在保留 `assistantMessage` 的同时，引入了向前兼容的 `assistantBlocks`，
   - 已从 Reader / runtime 路径抽取可复用的 markdown / math / mermaid 渲染逻辑，
   - 在 agent workspace 中，结构化载荷已由 typed block renderer 替换纯文本挂载，
   - 完整 HTML 输出已进入 sandboxed artifact preview，而不是直接进入主聊天 DOM。
3. **P5：兼容性 + 验证**
   - 保留 legacy fallback，
   - 保持现有 knowledge-point / capability orchestration 稳定，
   - 在渲染升级后补齐 docs / frontend contract / build-runtime 证明。
4. **P6：CI 加固跟进**
   - 持续保持 `Migration Gates` 与 `Fixrisk Operational Readiness` 在 `main` 上为绿，
   - 把未来 workflow / runtime 漂移当作实现面的一部分处理，而不是事后补锅。

#### 验收标准

1. Tauri agent reply area 可以通过共享的 Reader-aligned 渲染链显示 markdown、KaTeX 与 Mermaid。
2. 仅有 `assistantMessage` 的旧路径在迁移期间仍可工作。
3. 现有 `knowledgePoints`、capability execution 与 conversation card 保持向前兼容。
4. 新渲染路径为后续 Godot 降级 / 物化保留明确边界，而不是在当前阶段让 Godot 约束反向主导 Tauri-first UX。

在当前分支已经出现真实 Phase-3 切片、但 Phase-1 / Phase-2 仍存在关键缺口的背景下，把代码真相、活跃进度文档、以及后续执行顺序重新对齐。

### 2026-05-12 到 2026-05-13 本轮实现增量

- 本轮代码已完成：
  - `store.ts` 已新增 embedded SQLite graphdb adapter/provider，`server.ts` 默认 runtime 也已从 `local-file-graphdb` 切到 `graphdb/sqlite`，同时保留显式 file fallback。
  - `KnowledgeLearningPlatform.ts` 已补齐 query-backend comparison/history/trend、staleness diagnostics/rebuild planning、learning-quality history/trend、session-plan quality evaluate/history/trend/runtime-threshold diagnostics、query-backend config、query-backend diagnostics 的真实实现。
  - `queryKnowledge()` 已改为遵循当前配置的 backend，并保留显式 runtime fallback 语义。
  - foundation readiness 与 backend baseline sufficiency 已改为根据真实 store/query/vector 信号判定，而不再是静态占位返回。
  - `server.ts` 现已注入默认激活态本地 `tutorAdapter`，同时保留 `local` + `cloud` adapter catalog。
  - embedded sqlite 生命周期已补齐：server shutdown 会显式关闭 graph store，sqlite adapter 也能在同进程后续运行中安全重开。
  - `src/notemd.server.integration.test.ts` 现已证明 A8 的重启耐久性：覆盖 ingest -> shutdown -> fresh module reload -> store diagnostics/query/readiness 连续性。
  - `scripts/verify-foundation-sqlite-runtime.js` 现已在当前 Windows 宿主上通过 `dist` runtime + packaged sidecar 双路径证明同一条 embedded sqlite 基线：覆盖 ingest -> store diagnostics/foundation readiness -> restart -> query 连续性。
  - `scripts/verify-foundation-sqlite-runtime.js --matrix` 现在也会在同样两条 runtime 路径上把主机级证明扩成 `smoke` / `medium` / `heavy` workload matrix：snapshot metadata、restart 连续性与多点 query 连续性都会持续为绿。
  - `verify:foundation:sqlite-runtime:release` 现在为既有 sqlite soak 门禁提供稳定的 release 命名别名；foundation readiness mandatory checks 也已把 sqlite release proof 与 ANN matrix release proof 同较轻量的 baseline / matrix 命令一起暴露。
  - `local_vector` 的 external HTTP 加速已不再只是查询侧脚手架：适配器现已支持远端索引同步，在 diagnostics 中暴露 sync telemetry，并保留严格的 `fail_closed` 与 representation-alignment 语义。
  - `src/query_backend.external_http.integration.test.ts` 现已证明一条真实的 `external_http` connector 路径：覆盖 ingest -> 远端索引同步 -> query -> diagnostics。
  - `scripts/verify-foundation-ann-runtime.js` 现已在当前 Windows 宿主上通过 `dist` runtime + packaged sidecar 双路径证明同一条 `external_http` connector baseline：覆盖 ingest -> live query-backend diagnostics -> restart -> query 连续性。
  - `scripts/verify-foundation-ann-runtime.js --matrix` 现在也会在同样两条 runtime 路径上把 ANN 主机级证明扩成 `smoke` / `medium` / `heavy` workload matrix：sync/select telemetry、aligned representation metadata 与 restart 连续性都会持续为绿。
  - `scripts/verify-foundation-ann-runtime.js --release-gates` 现在会把结构化 JSON 证据写入 `output/verification/foundation-ann-runtime/`，并对 startup、ingest、diagnostics、query latency 与 targeted-query recall 执行门禁。`npm run verify:foundation:ann-runtime:release` 已在当前 Windows 宿主上通过完整 matrix 发布级门禁路径。
  - runtime capability 治理现在也把 ANN 远端索引同步当成一等检查：matrix/runbook 已新增 `query_vector_acceleration_index_sync_health`，与 health、traceability、prefilter、circuit 同级。
  - `server.ts` 现已把这条新门禁接入完整 runbook 闭环：ANN index-sync health 已进入 verification escalation、remediation action queue、以及 per-check history summary。
  - runtime capability 治理现在也有了显式的 ANN 校准前提门禁：`query_vector_acceleration_calibration_readiness` 会在同一运行时窗口内缺少 sync telemetry、稳定 connector、prefilter 样本就绪、可评估 candidate ratio、或外部 traceability 信号时阻断发布级阈值校准。
  - agent workspace 的 runtime runbook 界面现已在 verify/checks/action-queue 三条链路中展示 ANN sync-health 指标，而且 verify/checks 卡片还进一步前推了 ANN 熔断预算、可追踪性、预筛选摘要以及阈值/信号钻取、校准就绪态和显式门禁 `query_vector_acceleration_calibration_readiness`，运维侧的 ANN 治理视图已不再停留在 `index_sync_health`。

## 2026-08-17 第 9 阶段推进状态

- **G1 route parity：通过。** `verify:route:shadow` 对 14 条 legacy-equivalent probe 与 6 条 registry-only probe 比较 status、body、headers 和持久化副作用。
- **G2 移动产物/RSS：静态通过，真机待补。** `verify-mobile-artifact.js` 检查 APK/AAB entry，release 模式要求 arm64，并执行 profile budget；同时要求 RSS JSON。
- **G3 持久化 projection：本机 replay 通过。** SQLite close/reopen/load/query/metadata fixture 已通过；跨 host replay 仍待补，内存 projection 继续作为 fallback。
- **G4 canonical ID：保护中。** 原子 restore、alias、move journal 基础已通过；corpus replay 记录完成前保持公开 ID 不变。

后续顺序：为两种 dispatch 模式建立 CI 矩阵，固化版本化 projection-store 契约，实现 host-owned PathBridge adapter，两条移动 packaging 共用一份 staging，最后再以证据驱动 identity cutover。

## 2026-08-18 第 12 阶段 向前兼容的移动持久化计划

### 第 11 阶段后的当前代码真相

此前方案正确地把 canonical graph identity 与移动 projection 分开，但 G3 的措辞过宽，把 fixture replay 近似成了 Android 进程重启证明。当前代码已经收敛为可测试的窄契约：

- `knowledge_projection_contract.js` 继续作为 schema owner，限制 node、edge、evidence reference、adjacency 与身份元数据，不保留正文。
- `knowledge_projection_store.js` 是持久化边界。`createProjectionStore()` 保持兼容入口，`createFileProjectionStore()` 明确 app-local 文件语义，但不改变序列化 projection 形状。
- `storage_provider.js` 通过文件边界读取 `graph_data.json`；对于尚未提供新 factory 的 runtime，仍保留旧 generic store 路径。
- `src-tauri/src/lib.rs` 已经通过同目录临时文件与 rename 写入 graph projection。Android 持久化 lite projection，并在 projection 前释放解析正文。因此 JavaScript adapter 消费 host-owned atomic primitive，不重复实现 Rust/Kotlin 文件策略。
- `scripts/verify-mobile-projection-replay.js` 在真实临时目录中执行 save/reopen，并写出结构化报告。四个 host label 使用同一 fixture，验证 schema、metadata、exact search、neighbor、shortest path，而不只是 JSON 相等。
- `verify-route-registry-shadow.js` 现在在 readiness 后等待三次连续稳定的 runtime manifest，修复异步 SQLite 初始化被误判为 read-only route side effect 的 verifier race。
- adapter 变更后的 mobile-slim staging 仍在预算内：120 个文件、未压缩 4,253,837 字节、估算压缩 1,546,201 字节；新鲜未签名 arm64 APK/AAB 的压缩 payload 分别为 9,436,196 与 6,983,880 字节。这些是静态 artifact 测量，不是 RSS 证据。

### 修正后的失败语义

旧 store 会对所有异常返回 initial/stale projection，包括 JSON 损坏或未知未来 schema。这会破坏向前兼容：schema 不兼容必须暴露给 host 处理迁移或 abstain。新规则如下：

| 边界失败 | 行为 | 原因 |
| --- | --- | --- |
| app-local read/I/O 错误 | 有最近成功 projection 时使用它 | 短暂存储故障不应清空当前会话 |
| 截断/非法 JSON | fail closed | 不能对部分状态运行分析 |
| 未知 schema 或非法 identity/edge | fail closed | 不能静默降级未来数据 |
| atomic write 错误 | 保留上一个 committed file 与 cache | save 必须是 commit-or-no-change |

这样保留既有 memory fallback，同时移除 stale-cache masking bug。Initial data 只是 fallback candidate，不代表磁盘状态最新；首次 load 仍会先尝试 host read。

### 移动架构与权衡

默认移动路径继续使用无正文 JSON projection 与有界 exact analyzer。当前 workload 只是本地 exact lookup、有界 neighbor 和有界 shortest path，因此不把 SQLite/WASM 置为默认抽象。现在提升会增加 APK/AAB 体积、冷启动工作、heap 常驻和迁移面，却不会关闭尚未获得的 release gate。这个决策可逆：store 契约已经版本化且 host-neutral，未来 SQLite/WASM adapter 可以实现同一组 `load/save/metadata`，而无需改变 `storage_provider.js` 或公共 ID。

Adapter 不拥有平台文件策略。Android SAF 继续由 Kotlin/Rust 持有，Tauri 由 Rust 持有，Web/Capacitor 以后再接入各自 native atomic writer。这避免泄漏跨平台 path abstraction，但在开放并发后台导入前必须建立 single-writer 规则，并补齐进程死亡、URI 权限持续性和 import/query/path continuity 的真机证据。

### 当前起点后的执行顺序

1. **G2 真机证据**：生成签名 arm64 APK/AAB，在低硬件设备上执行 SAF import -> graph build -> exact query -> path，采集 peak RSS；任何 `not-measured` 结果都不能作为 release 证据。
2. **G3 host 矩阵**：在 CI 对 Tauri 与 Capacitor 两条 packaging path 运行 replay script 与 native adapter，并至少在一个 Android API/ABI 目标上补进程死亡/重开证据。
3. **G4 identity 语料**：重放 old snapshot、move journal、rollback、同内容/NFC collision 与 cross-root 用例，全部在 restart 后验证；结果确定前冻结公共 ID。
4. **证据之后再做**：把 SQLite/WASM 作为大语料 opt-in adapter 评估，必须以 startup、RSS、query p95、package budget 的实测收益为晋级依据。
5. **架构减重**：继续从 `server.ts` 与 `KnowledgeLearningPlatform.ts` 抽取 owner，但只有新模块真正持有 state/invariant 才允许拆分，不给 projection store 增加 pass-through facade。

### 验收门禁

- `npm run verify:mobile:projection-replay` 生成新鲜报告，包含四 host pass 与 fail-closed failure mode。
- Full Jest、TypeScript no-emit、Rust tests、mobile slim budget、artifact inspection、route shadow、Diataxis 均保持通过。
- 签名真机 RSS 与 SAF workload 证据必须与静态 APK/AAB 体积证据分开报告。
- 所有检查完成后才允许保持 `main` clean 并 push。

## 2026-08-18 第 15 阶段 原生边界与身份语料加固

### 本轮已实现

1. `verify-mobile-projection-replay.js` 现在执行四种明确 host boundary，不再用一个 Node 文件 adapter 换四个标签。报告标记为 contract evidence，不宣称 Android 进程死亡或 RSS 验收。
2. `canonicalId` 是由 portable URI 派生的 additive 元数据。legacy `id` 继续作为兼容 key；重复 canonical ID fail closed，exact analyzer 支持 canonical ID 作为 lookup/path 输入。
3. route shadow 覆盖 malformed JSON 与非法 build default。inline `/api/build` 在图变更前校验 `relationRecomputeMode`，registry 路径对 invalid JSON 输出一致的 status、body 与 `X-Error-Code`。当前为 17 条等价 probe 加 6 条 registry-only probe。
4. G4 测试覆盖同内容隔离、NFC/大小写 collision、跨 root 规范化、legacy snapshot replay 与原子 rollback。Android graph read 在完整正文 materialize 前被限制上限。

本次变更后的 mobile-slim staging 为 121 个文件 / 未压缩 4,263,740 字节 / 估算压缩 1,548,695 字节。仓库中已有的 APK/AAB 是更早构建生成的未签名产物，必须在本次源码变更后重新构建；它们不能作为本轮 release evidence。

### 权衡

Additive `canonicalId` 避免用 flag 驱动公开 ID 切换，并保持旧 layout/local-storage key 有效。Host-specific persistence 仍在边界处显式实现，序列化 projection 保持 schema-1；在真实跨 host corpus 证据完成前，迁移成本是同时携带两种 ID。

### 后续门禁

- **G2：** 签名 arm64 APK/AAB、SAF import -> graph -> exact query -> path、进程死亡 continuity 与 RSS <= 256 MiB 实测。
- **G3：** 使用真实 Tauri、Capacitor、Android native adapter 回放同一语料；host-boundary 报告是必要条件但不是充分证据。
- **G4：** 在任何 public-ID 切换前完成 move journal 重启、旧 snapshot、rollback failure、同内容/NFC collision 与 cross-root 回放。
- **默认开关：** 在门禁记录完成前保持 legacy ID、内存 projection fallback 与 opt-in SQLite/WASM。

## 2026-08-18 第 16 阶段 Portable Identity 传播

### 已实现

1. `ResourceIdentity` 现在返回 additive `canonicalId`（去除 `.md`/`.markdown` 的 workspace-relative 规范路径）。`FileLoader` 与桌面 `GraphBuilder` 传播该字段，不改变 legacy `id`。
2. 浏览器 identity contract 与 Capacitor projection 输出同一字段。Android Rust 从规范化 relative path 派生它，并同时写入 full/lite projection。
3. 定向断言覆盖所有 producer。序列化 projection 仍为 schema-1；旧 snapshot、layout key 与 exact lookup alias 继续有效。

### 架构约束

`canonicalId` 是语义比较 key，不是 public-ID 开关；`sourceUri` 继续承担 provenance，legacy `id` 继续承担兼容 key。这样不需要 mode flag，也不会在证据不足时触发不可逆迁移。

### 后续门禁

- 建立共享 corpus comparator：按 `canonicalId` 匹配节点，按 canonical endpoint、方向和 provenance 匹配边；raw node ID 不能作为 parity oracle。
- 在宣称原生语义 parity 前，解决或显式版本化 Rust/Capacitor 在 link extraction 与 legacy key resolution 上的差异。
- 本轮源码变更后的 fresh `mobile-slim` staging 为 121 个文件 / 未压缩 4,265,579 字节 / 估算压缩 1,549,039 字节，SHA-256 为 `7a62a376e05228e326732db0e1d76e9eedb84d7d344f862df8ee259a42d7bb72`；RSS 仍为 `not measured`。
- 继续阻塞签名真机 SAF/query/path、进程死亡 continuity、RSS <= 256 MiB、public-ID 迁移和默认 SQLite/WASM 提升。

## 2026-08-18 第 17 阶段：跨 Host 语义 Parity 闭环

### 已实现

1. `mobile_semantic_comparator.js` 是无依赖、仅用于测试的 UMD oracle。节点按归一化 `canonicalId` 匹配（缺失时仅对 legacy fixture 回退到版本化 URI），边按 canonical 方向、endpoint URI、`type`、`kind` 与 `provenance` 匹配；重复语义 identity 直接拒绝，不静默择一。
2. Capacitor 只建立一次 canonical path index，并与 Rust 使用相同 link resolution 顺序：direct path、source-relative path、unique stem。worker 与 single-thread 路径保持同一策略。重复 legacy basename fail-closed，这是有意的保守约束，因为 legacy public ID 无法消歧。
3. Rust 在 lookup 前将 percent-encoded Markdown target 归一化为 NFC/lowercase，并拒绝重复 canonical path 与含糊 legacy stem。schema-1 projection 保留同 endpoint 不同 provenance 的边。
4. `verify-mobile-projection-replay.js` 写入真实临时 corpus，并通过 Cargo 调用 ignored Rust builder probe。Capacitor 与 Rust 使用同一 corpus 做语义比较；报告记录 `6` 个节点、`4` 条边且无 mismatch，但仍明确标记为代码级证据。

### 权衡与约束

- 保留 `id` 作为运行时 key 避免 layout/snapshot 破坏，但移动端因此不能接受重复 basename。只有在 alias 与 rollback 证据完成后，未来 canonical-ID 迁移才可放宽该限制。
- comparator 不进入移动运行时 asset，成本只在验证阶段；Capacitor resolver 使用有界 map（建索引/建图为 `O(V + E)`），不引入 pairwise path scan。
- 同一 endpoint 的不同 link mechanism 会增加 projection 边数，因为 provenance 不能再被静默丢弃；现有 edge 与 total-input budget 仍是硬上限。

### 验证与下一道门禁

- 聚焦 Jest：semantic comparator、Capacitor graph、projection contract 共 `12` 个测试通过。Rust host suite 为 `28` passed、`1` ignored probe。
- staging 已排除 test-only comparator；fresh `mobile-slim` 为 121 个文件 / 未压缩 4,274,600 字节 / 估算压缩 1,550,561 字节，SHA-256 为 `c62d4eec6b1b66d66466b74f1b24ddb49d0c004795a16366f9018337c417baf8`；RSS 仍为 `not measured`。
- `verify:mobile:projection-replay` 已通过四种 storage boundary 与真实 Rust probe，但这不是签名 APK、Android 进程死活、SAF UI 或 RSS 证据。
- merge 前重新执行 TypeScript no-emit、全量 Jest、Rust tests、mobile-slim budget 与 Diataxis 检查。
- G2/G3 原生工作仍未闭环：签名 arm64 产物、低内存设备 SAF import -> graph -> exact query -> path、force-stop/reopen continuity 与 RSS `<= 256 MiB`。
- 在原生 replay、rollback/move-journal、old-snapshot 与 collision corpus 归档前，不提升 public canonical ID、SQLite/WASM 或移动端 corpus 上限。

## 2026-08-18 第 19 阶段：原生导入失败路径保留

### 实施

1. Android import transaction 的生产 owner 继续是 Kotlin。外层失败边界始终删除 `stagingRoot`；仅当 `backupRoot` 不存在时清理 `journalFile`。backup 与 journal 仍存在时，保留它们等待下一次 `bindActivity()` recovery。
2. 保持 Rust request/poll/result-marker 行为、journal schema-1 字段、legacy ID 与 `mobile-slim` export profile 不变。本轮是 additive durability 修正，不增加移动运行时 JavaScript 或数据库依赖。
3. 契约测试只检查准确的 import-failure catch。成功替换与 recovery 分支中的清理仍然合法，不与破坏性失败序列混淆。

### 权衡与门禁

保留一组 backup/journal 会在恢复前占用有界 app-local 磁盘，但急于清理可能在 rollback failure 后删除唯一可用知识库。调用方仍立即收到 `failed`，不会产生假成功；后续 recovery 可复用既有 `recovered_previous` detail。picker 定向契约与 TypeScript no-emit 已通过。签名 arm64 rollback/recovery、SAF/存储权限失败、force-stop continuity 与 RSS `<= 256 MiB` 仍是原生门禁；public-ID、默认 SQLite/WASM 与预算上调继续冻结。

## 2026-08-18 第 20 阶段：恢复重试与新鲜 arm64 产物证据

- 启动恢复在 `renameTo(targetRoot)` 失败时保留 journaled backup，只删除 staging，并写入 `import_recovery_pending`；孤儿 backup 失败写入 `orphan_recovery_pending`。
- Host mirror 覆盖 8 个确定性场景，包含注入的 journaled/orphan backup rename failure 与保留语义；仍仅用于测试并声明 `nativeDeviceEvidence: false`。
- 新鲜 slim arm64 Android 构建通过静态验证。未签名 universal APK 压缩 payload 为 `9,576,838` 字节（文件 SHA-256：`eb5f63697c6a3e33f3c54659a530f9ed014c600181067ee95684e2377610fbc6`）；AAB 为 `7,055,579` 字节（文件 SHA-256：`ee3e9b9451e2afeeb861a4a81311d9caccf9cd64d7871e206453bac3d42f2934`）。
- 两者均低于 25 MiB 且包含 arm64，但签名、真机 workload、进程死亡/存储重试与 RSS 证据仍缺失。
  - `runtime-capability-runbook/*` 这组 modular knowledge route 现已改为接入真实 server 侧 runbook ops，而不再返回 KLP placeholder payload；route 层现在也会保留 `checkId` / `sinceMinutes` / queue-filter 这类 query 参数，不再静默丢弃。
  - 真实浏览器 smoke 门禁现在也会端到端证明这三条链路：严格浏览器证据必须能看到 ANN sync-health verify 卡、新增的 verify/checks ANN 熔断/可追踪性/预筛选钻取、首个检查的 ANN sync 指标，以及 index-sync action-queue 钻取，而不再只是证明卡片“能打开”。
  - agent-workspace 的 locale 加固现在也覆盖了当前真实暴露出来的诊断卡片/消息空间：源码里引用到的 `agentWorkspace.*` key 已由 `src/agent_workspace.locale.contract.test.ts` 做门禁，双语 locale bundle 现已补齐 strict browser smoke 实际触达的 query/quality/runbook 卡片标签，并且启动期 `translate()` 会等 locale 完成初始化后再调用 `window.i18n.t()`，避免在 locale hydrate 前产生误报式 missing-key warning。
- 这会改变执行重心：
  - P3 的“placeholder 替换”在当前 runtime 面上已经完成实现；
  - P4 的“默认 tutor-routing 激活”在本地优先基线上已经完成实现；
  - A8 剩余缺口已经收窄为：主机级 dist/runtime + packaged sidecar 证明已具备，而且 `smoke` / `medium` / `heavy` workload matrix 也已具备，剩下的是 soak、长时段与性能级加固；
  - A9 剩余缺口现在也已收窄：主机级 dist/runtime + packaged sidecar 证明已具备，`smoke` / `medium` / `heavy` workload matrix 也已具备，并且已有 matrix release-gate 证据；剩下的是多轮阈值收敛与多宿主校准；
  - 这个工作之后的下一阶段仍然是发布级 Phase-2 门禁加固，但本轮完成的是“可观测性闭环”而不是“校准闭环”：首个 ANN 门禁族群已经具备 server 侧 runbook/action-queue/history 闭环，`prefilter` 也已进入 ANN 快速升级路径，并在前端 verify/checks 中显式暴露 index-sync、熔断、可追踪性、预筛选治理摘要及阈值/信号上下文和校准就绪态；同时并行继续 A8 的 soak / 长时段 / 性能闭环和 A9 的阈值收敛。

### 代码 vs 方案现状矩阵

| 区域 | 方案期望 | 当前 HEAD 现实 | 状态 |
|---|---|---|---|
| Phase-1 A8 graph backend | 生产级本地图后端 | ops 语义已存在，默认 runtime 已切到 embedded `graphdb/sqlite` 并保留显式 file fallback，重启耐久性已有集成证明，主机级 `dist` runtime + packaged sidecar 证明已自动化，而且 `smoke` / `medium` / `heavy` 主机端 workload matrix 已存在；但 soak、长时段与性能级加固仍未完成 | Operational baseline |
| Phase-1 A9 ANN connector | 生产级 ANN connector | `external_http` 现已支持远端索引同步，并在严格 failure/representation 语义下通过真实端到端 query 证明；主机级 `dist` runtime + packaged sidecar 证明和 `smoke` / `medium` / `heavy` workload matrix 也已具备，但 recall/latency 阈值收敛与发布级校准仍未完成 | Operational baseline |
| Phase-2 quality gates | 真实掌握闭环 / 发散质量门禁 | query-backend comparison、staleness、learning-quality、session-plan-quality 运行面已在 `KnowledgeLearningPlatform.ts` 中接通真实实现；面向运维的 ANN 治理也已通过 runbook verify/checks 显式暴露 index-sync、熔断、可追踪性、预筛选摘要以及阈值/信号钻取和校准就绪态，且 runtime 已具备显式门禁 `query_vector_acceleration_calibration_readiness`；但整套门禁仍需要建立在当前 graph/ANN operational baseline 之上的发布级校准 | Operational baseline |
| Phase-3 tutor + memory | 导师与记忆操作层真实落地 | tutor telemetry / trace-provider trend / conversation memory / memory-policy diagnostics 已真实，且默认 runtime 已注入本地 tutor adapter；生产级多 provider 路由仍待闭环 | Operational baseline |
| 架构缩减 | 主单体下降到可持续体量 | `server.ts` 14,992、`KnowledgeLearningPlatform.ts` 7,706、`path_app.js` 4,649、`app.js` 4,713、`routes/knowledge.ts` 690 | Open |

### 执行顺序

1. P0：真相校正与门禁重分级
   - 先让进度文档与代码现状一致，
   - 不再把 placeholder 返回或 catalog-only wiring 视为“已完成”。
2. P1：真实 graph backend 闭环
   - 保持新的 embedded `graphdb/sqlite` 主机级 `dist` runtime + packaged sidecar 验证持续为绿，
   - 保持新的主机级 workload matrix 验证持续为绿，
   - 保留 fallback，
   - 在已证明的重启生命周期与 workload matrix 之外，继续补齐 soak、长时段耐久性/性能与 adapter / fallback 一致性验证。
3. P2：基于新 live connector baseline 的 ANN 工作负载与 rollout 闭环
   - 让新的 sync-backed `external_http` connector 在真实流量下持续稳定，
   - 保持新的主机级 ANN runtime + workload matrix 验证持续为绿，
   - 校准 recall / latency 阈值并收敛发布级校准，再谈 ANN 层生产闭环。
4. P3：这个工作之后的下一阶段 - Phase-2 quality gate 加固
   - 让新接通的 query/staleness/learning-quality/session-plan-quality 诊断面始终与同一份 runtime 真相对齐，
   - 把当前已前推到 verify/checks 的 ANN index-sync、熔断、可追踪性、预筛选预算从“可见”推进到“可校准”，完成工作负载与阈值闭环，
   - 让 ANN 治理持续覆盖远端 index-sync、health、prefilter、traceability、circuit 这些显式检查面，
   - 只有在 graph/ANN 基线达到发布级而不只是 operational baseline 后，才把它们升级为发布级门禁。
5. P4：Phase-3 tutor routing 加固
   - 保持当前已激活的默认 `tutorAdapter` 可观测，
   - 从 local-first 继续推进到生产级多 provider 路由策略。
6. P5：继续降低架构压力
   - 继续拆 `routes/knowledge.ts`，
   - 持续压缩 `server.ts`、`KnowledgeLearningPlatform.ts`、`path_app.js`、`app.js`。

### 验收标准

1. 默认 graph backend 不再是 `local-file-graphdb`，且 embedded `graphdb/sqlite` 基线已能在 shutdown/restart 后保持 query/store diagnostics 连续性。
2. 至少一条 ANN connector 路径超出脚手架阶段，并在真实 sync/query 流量下得到证明，同时把剩余工作负载/阈值校准显式保留在计划中。
3. `KnowledgeLearningPlatform.ts` 不再对 query compare、staleness、learning-quality、session-plan-quality 返回 placeholder。
4. 默认 runtime tutor 执行在真实 server 路径下能产生非零 adapter telemetry。
5. 每个里程碑后都能通过 `docs:diataxis:check`、`docs:site:build`、`build:with-vite`、严格 `verify:agent-workspace:browser` 证明、以及 targeted agent-workspace / KLP tests。

---

# 2026-03-10 v1.5.38 - 多终端 WASM 等价实施计划（移动端固有瓶颈收口）

### 目标
通过统一的 WASM 计算策略，缓解移动端固有瓶颈，并在桌面 Web、Tauri 桌面、Capacitor 移动端、Tauri Android 多终端之间保持可预测的一致行为。

### 当前移动端固有问题

1. 重图计算/布局计算容易占用主线程，导致交互卡顿。
2. 在稀疏图场景下，Worker 启动与 JS 序列化开销可能高于实际计算收益。
3. 受限设备上内存压力与 GC 抖动更明显，稳定性风险更高。
4. 不同 WebView 运行时能力差异较大，若缺少显式探测会造成行为不确定。

### 多终端统一策略

1. 统一能力契约：
   - 运行时暴露 `supports_mobile_wasm_compute` 与 `mobile_wasm_reason`。
   - 计算路由保留明确的回退原因，保证可诊断性。
2. 统一计算路由模型：
   - 首选：`wasm-adapter`
   - 回退：`worker`
   - 最终回退：`single-thread`
3. 统一工件治理链路：
   - 标准 WASM 工件探针 + 严格门禁脚本 + CI 回归屏障。

### 分阶段执行计划

1. 阶段 A（能力探测与诊断）[基线已完成]：
   - 增加移动端 WASM 就绪探测。
   - 在 runtime caps 中暴露能力与原因。
   - 能力不可用时保持既有行为不变。
2. 阶段 B（路由集成）[进行中]：
   - 将移动端 WASM 能力信号接入本地构建统计。
   - 增加移动构建模式细分标签（`worker-wasm-ready`、`worker-wasm-not-ready`、回退原因）。
   - 保持确定性回退链路。
3. 阶段 C（内核扩展）：
   - 将更多重计算内核迁移到 WASM，并以契约验证正确性。
   - 优先处理当前移动端 CPU 占用最高的图构建热点。
4. 阶段 D（多终端工件落地）：
   - 分别验证以下终端的工件打包与加载路径：
     - 桌面 Web 资源包
     - Tauri 桌面 sidecar/运行时路径
     - Capacitor 移动端资源/运行时路径
     - Tauri Android 运行时路径
5. 阶段 E（性能与稳定性硬门禁）：
   - 对移动端典型负载执行 p95/p99 门禁约束。
   - 强制 worker 与 WASM 输出一致性无回归。

### 验收标准

1. 移动端必须能明确解释 WASM 启用/禁用原因（`mobile_wasm_reason`）。
2. WASM 不可用时移动端构建链路仍可工作（确定性回退已验证）。
3. 每一轮路由调整后，迁移门禁套件保持全绿。
4. 所有计划/TODO/测试报告的中英文文档保持同步更新。

---

### 范围对齐

本次更新将实施计划与当前 Electron 到 Tauri 的迁移策略对齐：

- 以 Tauri 作为桌面主壳层。
- 以 Godot 作为 Path Mode 交互界面。
- 以 Node Sidecar 作为图构建与运行时服务。
- 默认采用 Bridge-first 消息链路（`Godot <-> PathBridge <-> Backend`）。

### 当前迁移周期已完成项

- 已完成 Sidecar 运行路径与前端资源路径的统一，提升桌面运行一致性。
- 已稳定 Worker 路径解析，避免打包 Sidecar 下线程出现 `MODULE_NOT_FOUND`。
- Knowledge Base 文件夹加载已锚定到配置的项目根路径，不再依赖 Electron 专属假设。
- `Path Mode` 关键配置已迁移到 Godot 侧 UI，同时保留浏览器模式下 Web 工具栏行为。

### 仍需收敛的缺口与风险

- 在 Tauri mini GPU 运行中，缓存存在时“复用或重建”提示流程仍需严格回归验证。
- 需要持续防止单次点击触发重复加载（重复 build/restore）。
- WebSocket 客户端生命周期仍需加固，避免启动阶段时序竞争导致早期重复连接/断开。
- Godot 中心节点切换的 History 记录仍需最终行为验收。

### 下一步执行

1. 通过专用回归测试锁定缓存提示与单次执行语义。
2. 完成 websocket 生命周期防护与启动时序收敛。
3. 完成 Electron IPC 替代项的逐任务一致性核验，并移除残余隐式 Electron 依赖。
4. 保持移动端双输出策略：继续保留 Capacitor，同时并行支持 Tauri Android 产物链路。

---

# Implementation Plan - Implementing Lazy Loading for Prerequisites

The goal is to allow users to investigate incomplete In-Degree information by explicitly expanding the context of a specific node, without overloading the view with the entire graph.

## Proposed Changes

### 1. Backend Logic ([src/frontend/libs/path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js))

- **Unrestricted Context Expansion**:
  - In [diffusionLearning](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#253-422), iterate through `forcedExpansionSet`.
  - For each node in the set, retrieve **all** incoming edges ([getIncomingEdges](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#120-128)), regardless of their completion status or relevance to the original path.
  - Add the source nodes of these edges to the `finalPathNodes` list.
  - **Constraint**: Do not recursively fetch parents of these new nodes (Level -1 only).
  - **Flagging**: Mark the expanded target node with `isExpanded: true` in the output.

### 2. Data Bridge ([src/frontend/path_worker.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_worker.js))

- **Pass State Flags**:
  - Ensure the `isExpanded` flag matches the `forcedExpansionSet` state.
  - Pass this flag to the Godot client in the `treeLayout` payload.

### 3. Visualization State Machine ([path_mode/scripts/tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd))

### 3. Visualization State Machine ([path_mode/scripts/tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd))

- **Smart Toggle Logic (Left Side)**:
  - **Pre-calculation**: At the start of `_draw_layout_mode`, iterate `_layout_edges` to build a `visible_in_counts` dictionary (NodeID -> Count).
  - **Decision Logic (in Node Loop)**:
    - Let `global_in` = `node.inDegree` (from backend).
    - Let `visible_in` = `visible_in_counts[node.id]`.
    - Let `is_expanded` = `node.isExpanded` (flag from backend).
  - **States**:
    1.  **Expanded State**: If `is_expanded` is true:
        - Draw [(-)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) button.
        - Click Action: Emit `node_collapse_prereqs_requested`.
    2.  **Expandable State**: Else if `visible_in < global_in`:
        - Draw [(+)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) button.
        - Click Action: Emit `node_expand_prereqs_requested`.
    3.  **Complete State**: Else (Visible == Global):
        - Draw nothing (or disabled indicator).

### 4. Interaction Logic ([tree_view_panel.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_view_panel.gd) & [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js))

- **Collapse Handling**:
  - Implement [collapsePrereqs(nodeId)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#247-254) in [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js): Remove ID from `forcedExpansionSet` and trigger update.
  - Wire up the new Godot signal to this backend method.

## UI Inconsistency Fixes

### 1. Statistics Panel Resizing

- **Problem**: The "Incoming" and "Outgoing" lists in the Node Statistics Popup do not resize proportionally when the popup is resized using the drag handle.
- **Fix**: Modify [src/frontend/styles.css](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/styles.css).
  - Change `.stat-lists` from fixed `height: 150px` to `flex: 1; min-height: 150px`.
  - Ensure parent containers (`.popup-content`) allow expansion.

### 2. Edge Visibility

- **Problem**: Edges are visible by default on load, creating clutter.
- **Fix**:
  - in [src/frontend/styles.css](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/styles.css): Set `.link` default `stroke-opacity` to `0`.
  - in [src/frontend/app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/app.js): Ensure [updateVisibility()](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/app.js#1717-1747) is called immediately after graph initialization to enforce the visibility logic (hiding edges unless focused/hovered).

### 3. In-Degree Number Mismatch

- **Problem**: The number displayed next to "In-Degree" (Red) in the popup often differs from the count of items in the "Incoming" list.
- **Verification**: Locate [showNodePopup](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/app.js#1083-1154) in [app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/app.js) to see if it uses `node.inDegree` (metadata) vs `node.incoming` (actual edges).
- **Fix**:
  - If the metadata is correct (global truth), keep it.
  - If the list is incomplete (due to filtering/culling), add a label "(Visible: X)" or ensure the list matches filters.
  - _Current hypothesis_: The metadata `inDegree` is the ground truth from the backend, while the client-side `links` array might be filtered or optimized (limit 20000 edges), causing a mismatch. functionality to show "Total" vs "Visible".

### 4. In-Degree Display Setting (Electron)

- **Goal**: Allow user to toggle between showing "Visible Inbound Nodes" (calculated from current graph) or "Total Statistical Inbound" (from backend metadata).
- **Default**: Visible Inbound Nodes.
- **Changes**:
  - **[src/frontend/index.html](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/index.html)**: Add a toggle/select in the Settings Modal (e.g., "Degree Count: Visible | Total").
  - **[src/frontend/app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/app.js)**:
    - Update [showNodePopup](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/app.js#1083-1154) to check `settingsManager.get('visuals', 'degreeMode')`.
    - If 'visible': Show `inNeighbors.length`.
    - If 'total': Show `node.inDegree` (with [(visible)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) suffix if different? Or just strict switch?). User asked for "whether the inbound count should be shown as the number of nodes or the statistical number". I will implement a strict switch but maybe keep the tooltip or subtle indicator if they differ significantly.
    - Wire up the new setting in [initSettingsUI](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/app.js#2644-2880).

- [ ] **Simplify Lazy Loading UI (Godot)**
  - [ ] Update [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd):
    - [ ] Remove separate [(+)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53)/[(-)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) buttons.
    - [ ] Implement unified `[ Count ]` button (e.g., circle with number).
    - [ ] Button toggles `forcedExpansion` state.
    - [ ] Default state is collapsed (colored/styled to indicate expandable).
  - [ ] Ensure [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js) handles the toggle correctly (clear vs add to `forcedExpansionNodes`).

- [ ] **Tree View Visual & Interaction Overhaul**
  - [ ] **Visual Cleanup (Godot)**
    - [ ] Remove [(+)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53)/[(-)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) and `[Count]` buttons from [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd).
    - [ ] Remove separate click areas for these buttons.
  - [ ] **Interaction Update (Godot)**
    - [ ] **Double Click**: Change to Toggle Expansion (Emit [expand](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#239-246)/[collapse](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#255-261)).
    - [ ] **Right Click**: Toggle Expansion (Same as Dbl Click).
    - [ ] **Middle Click**: Collapse All (Emit new signal `collapse_all_requested`).
    - [ ] **Long Press**: Implement Navigation (Switch Central).
      - [ ] Add `_process` check for hold duration.
      - [ ] Draw Progress Ring during hold.
      - [ ] Trigger navigation on completion.
  - [ ] **Focus Mode (Godot)**
    - [ ] Add "Focus on this node" checkbox to [settings_panel.tscn](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scenes/settings_panel.tscn).
    - [ ] Implement `focus_node_id` state in [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd).
    - [ ] Update `_draw` to dim nodes/edges not connected to `focus_node_id` when enabled.
  - [x] **Backend Updates**
    - [x] Add [collapseAll](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#255-261) handler in [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js).

## Data Validation

- [x] **Disable Path Mode if No Data**:
  - [x] Update [app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/app.js) to check `graphDataExists` or `nodes.length` before entering Path Mode.
  - [x] Show alert if data missing.

## Bug Fixes

- [ ] **Fix Missing Edges in Tree Layout**:
  - [ ] **Cause**: `d3.forceSimulation` in [app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/app.js) mutates `graphData.links`, replacing ID strings with Node Objects.
  - [ ] **Effect**: `Graph.js` in [path_worker.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_worker.js) uses these Objects as keys/IDs, breaking adjacency map lookups (which expect strings).
  - [ ] **Fix**: In [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js), sanitize links before sending to worker: `l.source.id || l.source`.

## Verification Plan

1. **Initial State Check**:
   - Navigate to a node with high In-Degree (e.g., "Beta", In-Degree 18).
   - Verify the unified `[ Count ]` button appears on the left if < 18 lines are visible.
2. **Expansion Test**:
   - Click the `[ Count ]` button.
   - Verify the tree rebuilds.
   - Verify previously hidden nodes (e.g., "Fair Value") appear as prerequisites.
   - Verify the `[ Count ]` button changes its state/appearance to indicate expansion.
3. **Collapse Test**:
   - [x] Click [(-)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53).
   - [x] Verify the extra nodes disappear and view returns to original state.

## Bug Fixes

- [x] **Fix Missing Edges in Tree Layout**:
  - [x] **Fix**: In [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js), sanitize links before sending to worker.
- [ ] **Fix Tree View Interactions**:
  - [ ] **Right-Click Toggle**: Ensure `isExpanded` is passed from [path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js) to visual node.
  - [x] **Collapse All**: Update [PathBridge.ts](file:///e:/Knowledge_project/NoteConnection_app/src/core/PathBridge.ts) to relay [collapseAll](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#255-261) message. Add UI button.

# Phase 2: Spine & Tributaries Layout (v1.4.2)

## Goal

Implement a stable, tree-like layout where the "Main Learning Path" (Spine) remains linear and stationary, while prerequisites (Tributaries) expand laterally without disrupting the spine.

## Proposed Changes

### 1. Core Algorithm ([src/frontend/libs/path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js))

#### [getTreeLayout(centralId, learningPath)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#707-884)

- **Step 1: Identify Spine**:
  - Determine the "Critical Path" from `learningPath.nodes` (using `isCritical` flag or [diffusionLearning](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#253-422) result).
  - Assign `Level` (X-coordinate) to Spine nodes based on distance from Start.
  - Fix Spine `Y` coordinates to `0`.

#### `assignTributaryPositions(spineNodes, allNodes)`

- **Step 2: Slot Management**:
  - Create a `SlotManager` to track occupied [(X, Y)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) positions.
  - Mark key Spine positions as occupied.
- **Step 3: Lateral Expansion**:
  - Iterate through nodes in **Topological Order** (or Spine Order).
  - For each node `N`, identify its unplaced prerequisites `P`.
  - **Placement Logic**:
    - `Target X`: `N.Level - 1` (Standard dependency inflow).
    - `Target Y`: Find nearest available vertical slot relative to `N.Y`.
    - Preference: Alternating Up/Down (`+1, -1, +2, -2...`) \* `Y_SPACING`.
    - **Stability**: Once placed, a node's position is locked (`isPlaced = true`) and will not be moved by subsequent expansions.

### 2. Frontend Integration

- Ensure [switchCentral](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#893-900) triggers a re-layout using the new algorithm.
- Pass the stable layout to `Graph.js` / Godot via [PathBridge](file:///e:/Knowledge_project/NoteConnection_app/dist/src/core/PathBridge.js#5-134).

## Verification Plan

1. **Spine Stability**:
   - Load a path. Center on a Spine node.
   - Expand a prerequisite.
   - Verify the Spine node DOES NOT move.
2. **Lateral Unfolding**:
   - Verify prerequisites appear above/below the spine, not inline.
3. **Complex Chain**:
   - Expand a prerequisite's prerequisite.
   - Verify it flows backwards (Left) and finds a clear slot.

---

# 实施计划 - 实现前置节点懒加载 (Implementation Plan - Implementing Lazy Loading for Prerequisites)

目标是允许用户通过显式扩展特定节点的上下文来调查不完整的入度信息，而无需加载整个图表。

## 建议更改 (Proposed Changes)

### 1. 后端逻辑 ([src/frontend/libs/path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js))

- **无限制上下文扩展**:
  - 在 [diffusionLearning](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#253-422) 中，迭代 `forcedExpansionSet`。
  - 对于集合中的每个节点，检索 **所有** 入边 ([getIncomingEdges](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#120-128))，无论其完成状态或与原始路径的相关性如何。
  - 将这些边缘的源节点添加到 `finalPathNodes` 列表中。
  - **约束**: 不要递归获取这些新节点的父节点（仅限 Level -1）。
  - **标记**: 在输出中用 `isExpanded: true` 标记已扩展的目标节点。

### 2. 数据桥接 ([src/frontend/path_worker.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_worker.js))

- **传递状态标志**:
  - 确保 `isExpanded` 标志与 `forcedExpansionSet` 状态匹配。
  - 在 `treeLayout`以此传递此标志给 Godot 客户端。

### 3. 可视化状态机 ([path_mode/scripts/tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd))

- **智能切换逻辑 (左侧)**:
  - **预计算**: 在 `_draw_layout_mode` 开始时，迭代 `_layout_edges` 以构建 `visible_in_counts` 字典。
  - **决策逻辑**:
    - `global_in` = `node.inDegree` (来自后端)。
    - `visible_in` = `visible_in_counts[node.id]`.
    - `is_expanded` = `node.isExpanded`.
  - **状态**:
    1.  **已展开**: 如果 `is_expanded` 为真：绘制 [(-)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) 按钮。点击发射 `node_collapse_prereqs_requested`。
    2.  **可展开**: 否则如果 `visible_in < global_in`：绘制 [(+)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) 按钮。点击发射 `node_expand_prereqs_requested`。
    3.  **完整**: 否则（可见 == 全局）：绘制无（或禁用）。

### 4. 交互逻辑 ([tree_view_panel.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_view_panel.gd) & [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js))

- **折叠处理**:
  - 在 [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js) 中实现 [collapsePrereqs(nodeId)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#247-254)：从 `forcedExpansionSet` 中移除 ID 并触发更新。
  - 将新的 Godot 信号连接到此后端方法。

## UI 不一致修复 (UI Inconsistency Fixes)

### 1. 统计面板调整大小

- **修复**: 修改 [src/frontend/styles.css](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/styles.css)，使用 `flex: 1` 确保列表按比例调整大小。

### 2. 边缘可见性

- **修复**: 默认隐藏边缘，仅在悬停/聚焦时显示。

### 3. 入度数字不匹配

- **修复**: 添加设置以切换“可见”与“总计”入度显示。

## 第二阶段：主干与支流布局 (Phase 2: Spine & Tributaries Layout) (v1.4.2)

### 目标

实现稳定的树状布局，其中“主要学习路径”（主干）保持线性和静止，而前置节点（支流）在不破坏主干的情况下横向扩展。

### 建议更改

#### 1. 核心算法 ([src/frontend/libs/path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js))

##### [getTreeLayout(centralId, learningPath)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#707-884)

- **步骤 1: 识别主干**:
  - 从 `learningPath.nodes` 确定“关键路径”。
  - 根据与起点的距离为主干节点分配 `Level` (X坐标)。
  - 将主干 `Y` 坐标固定为 `0`。

##### `assignTributaryPositions(spineNodes, allNodes)`

- **步骤 2: 插槽管理**:
  - 创建 `SlotManager` 以跟踪占用的 [(X, Y)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) 位置。
  - 标记关键主干位置为已占用。
- **步骤 3: 横向扩展**:
  - 按 **拓扑顺序** 迭代节点。
  - 对于每个节点 `N`，识别其未放置的前置节点 `P`。
  - **放置逻辑**:
    - `Target X`: `N.Level - 1`。
    - `Target Y`: 相对于 `N.Y` 找到最近的可用垂直插槽。
    - 偏好: 交替上/下 (`+1, -1, +2, -2...`) \* `Y_SPACING`。
    - **稳定性**: 节点一旦放置，其位置即被锁定 (`isPlaced = true`)。

### 2. 前端集成

- 确保 [switchCenter](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#893-900) 使用新算法触发重新布局。
- 通过 [PathBridge](file:///e:/Knowledge_project/NoteConnection_app/dist/src/core/PathBridge.js#5-134) 将稳定布局传递给 Godot。

### 验证计划

1. **主干稳定性**: 加载路径，居中主干节点，展开前置节点。验证主干节点 **不移动**。
2. **横向展开**: 验证前置节点出现在主干的上方/下方，而不是内联。
3. **复杂链**: 展开前置的前置，验证其向后（左）流动并找到清晰的插槽。

---

# Phase 3: 9-Rule Tree Layout Engine (v1.4.3)

**Date**: 2026-02-26

## Goal

Port the 9-rule expansion/claiming/visibility engine from `tree_path_mockup.html` into production code (`path_core.js`, `tree_renderer.gd`, `path_app.js`). This replaces the simple contour-based layout with a full ownership/claiming system for intelligent node management.

## Gap Analysis: Mockup vs Production

### Missing Rules

| #   | Rule                                          | Mockup Function                            | Production Status            |
| --- | --------------------------------------------- | ------------------------------------------ | ---------------------------- |
| 1   | **Expansion Order** (FIFO claiming)           | `processExpansions()` + `expansionOrder[]` | ❌ Missing                   |
| 2   | **Preceding Immunity** (effective index)      | `tryClaim()` + `getEffectiveSpineIndex()`  | ❌ Missing                   |
| 3   | **Following Migration** (spine+followers)     | `claimSpineChain()`                        | ❌ Missing                   |
| 4   | **Single Appearance** (owner-based)           | `currentOwner` priority check              | ⚠️ Partial (`placedNodeIds`) |
| 5   | **Cross-Tributary Isolation** (edge filter)   | `drawEdges()` owner check                  | ❌ Missing                   |
| 6   | **Spine Always Visible** (return on collapse) | `determineVisibility()` spine pass         | ❌ Missing                   |
| 7   | **Sticky Claim** (configurable)               | `stickyClaimEnabled` toggle                | ❌ Missing                   |
| 8   | **Unit Migration** (recursive claim)          | `claim()` recursive tributaries            | ❌ Missing                   |
| 9   | **Tributary Hierarchy Immunity**              | `getTributaryRootSpineIndex()`             | ❌ Missing                   |

### Missing Concepts

| Concept                   | Mockup                            | Production                             |
| ------------------------- | --------------------------------- | -------------------------------------- |
| **Node Ownership**        | `currentOwner`, `ownerPriority`   | None                                   |
| **Expansion Order**       | `expansionOrder[]` (ordered)      | `forcedExpansionNodes` (unordered Set) |
| **Effective Spine Index** | `getEffectiveSpineIndex()`        | Fixed `spineIndex` only                |
| **Visibility Chain**      | `isOwnerChainVisible()` recursive | Binary collapsed/expanded              |
| **Hull-Node Avoidance**   | Convex hull with padding          | Basic hull, no collision check         |

### Existing Features to Preserve

- ✅ Spine identification via `isCritical` flag
- ✅ Contour-based collision avoidance for spine spacing
- ✅ Recursive tributary placement
- ✅ Hull/bubble drawing around tributary groups
- ✅ Collapsed/expanded state per node
- ✅ Godot WebSocket bridge communication
- ✅ Tree renderer with bezier edges, styled nodes, pan/zoom

## Proposed Changes (13 Steps)

### Component 1: Core Algorithm

#### [MODIFY] [path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js)

**Step 1**: Add expansion order tracking to `getTreeLayout()` (L742-1133)

- Add `expansionOrder` parameter (ordered array of expanded node IDs)
- Replace unordered `collapsedSet` with ordered `expansionOrder` for FIFO claiming

**Step 2**: Implement node ownership system

- Add `currentOwner`, `ownerPriority`, `_isOnSpine` to each layout node
- Track claims during `processExpansions()` matching mockup logic

**Step 3**: Implement `tryClaim()` with all 9 rules

- Rule 1: Owner priority check
- Rule 2: `getEffectiveSpineIndex()` comparison (inherits owner index)
- Rule 3+8: `claimSpineChain()` for following migration
- Rule 4: Single appearance via owner check
- Rule 5: Cross-tributary edge filtering
- Rule 6: Spine always visible on collapse
- Rule 7: Sticky claim toggle
- Rule 9: `getTributaryRootSpineIndex()` for hierarchy immunity

**Step 4**: Implement `determineVisibility()` + `isOwnerChainVisible()`

- Two-pass: spine always visible, non-spine follows recursive owner chain

**Step 5**: Update edge generation — filter edges between different owners (Rule 5)

**Step 6**: Update hull generation to group by owner

### Component 2: Frontend Bridge

#### [MODIFY] [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js)

**Step 7**: Track expansion ORDER (not just Set)

- `forcedExpansionNodes: new Set()` → `expansionOrder: []`
- Update `expandPrereqs()`, `collapsePrereqs()`, `collapseAll()`
- Pass `expansionOrder` to worker

**Step 8**: Add sticky claim setting + pass to worker

### Component 3: Godot Tree Renderer

#### [MODIFY] [tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd)

**Step 9**: Edge rendering — skip edges where `src.currentOwner != tgt.currentOwner`

**Step 10**: Hull collision avoidance with rounded padding

**Step 11**: Node type coloring (spine=green, tributary=blue, shared=purple, migrated=orange)

**Step 12**: Expansion indicator badge (in-degree count circle)

### Component 4: Worker Communication

#### [MODIFY] [path_worker.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_worker.js)

**Step 13**: Pass `expansionOrder` and `stickyClaimEnabled` to `getTreeLayout()`

## Verification Plan

1. Expand Calculus → verify Optimization migrates (Rule 3)
2. Expand Optimization → verify Diff Eq cannot claim Calculus (Rule 2+9)
3. Collapse Calculus → verify spine nodes return (Rule 6)
4. Toggle sticky claim → verify non-spine revert/persist (Rule 7)
5. Check hull boundaries don't overlap nodes

---

# 第三阶段：9 规则树形布局引擎 (v1.4.3)

**日期**: 2026-02-26

## 目标

将 `tree_path_mockup.html` 中的 9 规则展开/认领/可见性引擎移植到生产代码（`path_core.js`、`tree_renderer.gd`、`path_app.js`）中。用完整的所有权/认领系统替换简单的基于轮廓的布局。

## 差距分析：原型 vs 生产代码

### 缺失规则

| #   | 规则                           | 原型函数                                  | 生产代码状态 |
| --- | ------------------------------ | ----------------------------------------- | ------------ |
| 1   | **展开顺序**（FIFO 认领）      | `processExpansions()`                     | ❌ 缺失      |
| 2   | **前置免疫**（有效索引）       | `tryClaim()` + `getEffectiveSpineIndex()` | ❌ 缺失      |
| 3   | **后续迁移**（脊柱+后续）      | `claimSpineChain()`                       | ❌ 缺失      |
| 4   | **单次出现**（基于所有者）     | `currentOwner` 优先级检查                 | ⚠️ 部分存在  |
| 5   | **跨支流隔离**（边过滤）       | `drawEdges()` 所有者检查                  | ❌ 缺失      |
| 6   | **脊柱始终可见**（折叠时返回） | `determineVisibility()`                   | ❌ 缺失      |
| 7   | **粘性认领**（可配置）         | `stickyClaimEnabled` 开关                 | ❌ 缺失      |
| 8   | **单元迁移**（递归认领）       | `claim()` 递归支流                        | ❌ 缺失      |
| 9   | **支流层级免疫**               | `getTributaryRootSpineIndex()`            | ❌ 缺失      |

### 缺失概念

| 概念              | 原型                            | 生产代码                           |
| ----------------- | ------------------------------- | ---------------------------------- |
| **节点所有权**    | `currentOwner`, `ownerPriority` | 无                                 |
| **展开顺序**      | `expansionOrder[]`（有序）      | `forcedExpansionNodes`（无序 Set） |
| **有效脊柱索引**  | `getEffectiveSpineIndex()`      | 固定 `spineIndex`                  |
| **可见性链**      | `isOwnerChainVisible()` 递归    | 二元折叠/展开                      |
| **Hull-节点避让** | 凸包 + 填充                     | 基础 hull，无碰撞检查              |

## 建议更改（13 个步骤）

### 组件 1: 核心算法 — `path_core.js`（步骤 1-6）

- **步骤 1**: 添加展开顺序追踪
- **步骤 2**: 实现节点所有权系统
- **步骤 3**: 实现 `tryClaim()` 包含所有 9 条规则
- **步骤 4**: 实现 `determineVisibility()` + `isOwnerChainVisible()`
- **步骤 5**: 更新边生成 — 基于所有者过滤
- **步骤 6**: 更新 hull 生成 — 按所有者分组

### 组件 2: 前端桥接 — `path_app.js`（步骤 7-8）

- **步骤 7**: 有序展开追踪
- **步骤 8**: 添加粘性认领设置

### 组件 3: Godot 树渲染器 — `tree_renderer.gd`（步骤 9-12）

- **步骤 9**: 跨所有者边过滤
- **步骤 10**: Hull 碰撞避让
- **步骤 11**: 节点类型着色
- **步骤 12**: 展开指示器徽章

### 组件 4: Worker 通信 — `path_worker.js`（步骤 13）

- **步骤 13**: 传递 `expansionOrder` 和 `stickyClaimEnabled`

## 验证计划

1. 展开"微积分" → 验证"优化"迁移（规则3）
2. 展开"优化" → 验证"微分方程"不能认领"微积分"（规则2+9）
3. 折叠"微积分" → 验证脊柱节点返回（规则6）
4. 切换粘性认领 → 验证非脊柱节点还原/保持（规则7）
5. 检查 Hull 边界不与节点重叠

## 2026-08-17 身份边界与移动端预算计划

1. 通过 `FileLoader` 传递显式 workspace root；保留可选参数，保证旧调用方源码兼容。
2. 在学习摄入与快照中传播可选 `sourceUri`、`revision`、`identityAliases`；删除先按 URI/alias 解析，再回退旧 path。
3. 在读取正文前执行 Android admission limit：5,000 文档、单文档 16 MiB、总输入 64 MiB、250,000 条边；读取时提取 link candidate，中间 draft 不保留文档正文。
4. 在完成 move/rename replay、旧 snapshot fixture、HTTP schema parity 与跨端 Bridge replay 前，保持 canonical-ID 切换冻结。
- 2026-08-17 第 8 阶段已交付原子 graph replay 入口、显式 learning move/rename journal、有界模块化 ingest 校验、indexed keyword candidate、带身份的移动 exact projection，以及 additive Bridge 2.0 capability/cancellation envelope。
- 后续门禁是 registry response/status shadow parity、新鲜 arm64 APK/RSS 证据、置于 export 契约后的版本化 SQLite/WASM 持久化，最后才允许 canonical 公共 ID 迁移。
## 2026-08-17 第 10 阶段：版本化 Projection 与 Host 执行

1. `knowledge_projection_contract.js` 是移动端 canonical wire shape：schema `1`、无正文节点、身份元数据、explicit/inferred/runtime provenance、有界 evidence reference 与有界 adjacency。
2. Capacitor 生成 graph 经过契约归一化；Tauri Rust 输出相同 schema 与身份字段，同时保持 Android 无正文内存路径。
3. `PathBridgeHostAdapter` 让执行与策略留在 host；Bridge 负责 correlation、timeout、abort、断连清理和 legacy transport fallback。
4. 剩余门禁是新鲜签名 arm64 产物/RSS、Android Storage Access Framework 导入、跨 host replay 以及旧 snapshot/move/rename/collision 证据。

### 证据边界

静态 staging 不能替代签名产物与真机 RSS；`not-measured` 继续保持未测状态，canonical 公共 ID 迁移继续冻结。

## 2026-08-18 第 11 阶段：Projection Store 与 Android SAF

1. `knowledge_projection_store.js` 成为 host-neutral 持久化边界，提供 persistent/read-through 与 memory adapter、有界 metadata，以及成功读取后的 last-known fallback。
2. 移动 exact analysis 经 store 读取；同一 fixture 已对 Web、Tauri、Capacitor、Android adapter replay schema、metadata、exact lookup、neighbor 与 path。
3. Tauri projection 写入使用同目录临时文件 + rename。Android slim 增加 additive SAF bridge，在 app-local staging tree 中流式导入 Markdown，执行文档数/深度/单文档/总字节预算，成功后原子切换知识库，失败保留旧目录，并通过 request/poll IPC 回报完成。
4. identity corpus 增加同内容文档、move/rename alias 与 NFC collision；public ID 不变。
5. G2 已有部分证据：新鲜 arm64 slim 构建生成未签名 APK（9,555,787 字节）与 AAB（7,179,228 字节）；静态 verifier 测得压缩 payload 分别为 9,433,678 与 6,978,122 字节，且没有 Godot/sidecar/model/SVG 条目。签名产物、在线设备导入/query 与 RSS JSON 仍待完成；当前 Android 工具链 Kotlin 编译已通过。G3 fixture replay 已通过，真实 Android storage replay 与 G4 canonical-ID 切换仍冻结。

### 2026-08-18 验证追记

`mobile:prepare:slim` 当前 staging 为 120 个文件（未压缩 4,251,345 字节；估算压缩 1,545,813 字节）。新鲜 arm64 APK/AAB 已通过 ZIP 检查和 25 MiB payload budget 下的 mobile artifact verifier。这里只关闭静态打包证据；签名、真机 SAF replay 与峰值 RSS 仍是 release 门禁。
## 2026-08-18 第 13 阶段：原生导入恢复与跨 Host 闭环

### 架构增量

1. 继续把原始 schema-1 projection 作为移动持久化格式并保留 memory fallback；没有实测包体、启动与 heap 收益时，不提升 SQLite/WASM。
2. 增加 Android 内部 import journal，使用同目录临时文件原子写入。journal 不进入公共 projection contract，只记录 app-local staging/backup 名称与阶段。
3. 在 activity 启动时恢复：新 target 已存在时安全清理；若停在旧 target 已移走阶段则恢复 backup；只有 staging 时清理并报告 failed/recovered import；损坏或路径逃逸 journal fail closed。
4. Phase 12 的四 host replay 只计作契约证据。canonical-ID 迁移前，必须统一 Tauri、Capacitor、Android 与 TypeScript identity boundary 的 namespace、NFC、SHA-256 revision、边方向与 alias 历史。
5. 移动预算继续作为 admission guard：5,000 文档、单文档 16 MiB、总输入 64 MiB、250,000 边、depth 64。下一轮 Android 证据必须证明中间 draft 无正文并测量瞬时读取/RSS，之后才可提高预算。

### 门禁状态

- **G2：** 当前静态 slim 证据为 120 个文件 / 未压缩 4,253,837 字节 / 估算压缩 1,546,201 字节；未签名 APK/AAB 压缩 payload 为 9,436,196 / 6,983,880 字节。签名、真机 SAF workload、进程死亡 replay 与 RSS `<= 256 MiB` 仍开放。
- **G3：** 原生 journal/recovery、原子 marker、fixture replay 与 arm64 Kotlin 编译属于代码级证据；真实 Android 进程死亡、存储损坏与权限失败仍未验证。
- **G4：** 公共 ID 继续冻结。必需语料包括旧 snapshot restore、move-journal restart、rollback、same-content/NFC collision、cross-root load 与 delete/restore alias continuity。

### 后续顺序

1. 增加只从 CI secret 注入的签名流程与设备 RSS/workload 记录器；缺设备或缺 RSS 必须让 release verifier 失败。
2. 增加 Tauri/Capacitor/Android 原生 adapter replay，对比 graph metadata、exact search、neighbors、path、edge provenance 与 import status。
3. 验证 Android ingest 在读取时提取 link candidate、保持 draft 无正文，并记录瞬时读取/RSS 证据。
4. 关闭 identity corpus 与 registry response/status shadow parity；之后才评估数据库 adapter 或 canonical public-ID 切换。

### 本轮验证

`src/android.knowledgebase.picker.contract.test.ts`、mobile profile/artifact contract、TypeScript no-emit、57 suite migration matrix（307 passed、13 skipped）与 `app:compileArm64ReleaseKotlin` 已通过。当前宿主没有在线 Android 设备、已配置 AVD、签名 keystore 或 RSS JSON。
## 2026-08-18 第 14 阶段：签名设备证据与原生 Replay
### 架构增量
release 边界现在拆成三层、分别验收：
1. **产物完整性**：`verify-mobile-artifact.js` 检查 ZIP entry、arm64 payload、profile budget、可选 RSS，以及 release 模式下的 APK/AAB 签名。未签名 payload 只能通过静态层。
2. **设备执行**：`capture-tauri-android-rss-evidence.js` 在指定设备安装一个明确产物，启动 Tauri package，执行有界 workload spec，观察进程死亡与重启，并采样 `/proc/<pid>/status:VmRSS`。
3. **Projection 语义**：workload 必须证明 SAF 导入、构图、exact query、path 与重启后的连续性。采集器把这些结果与产物体积分开记录，避免 size gate 通过掩盖原生 projection 失败。
workload spec 采用声明式、禁止 host shell 的契约，固定为有序的 `saf-import`、`graph-build`、`exact-query`、`path`、`continuity` 步骤，并只接受显式 `adbArgs`。重复/缺失步骤、宿主命令插值、RSS 缺失或进程死亡不可观测时全部 fail closed；同时写出可被 artifact verifier 复用的独立 `rss.json`。
### 当前真实进展与权衡
- identity contract 改动后的 staging 为 121 个文件 / 未压缩 4,263,740 字节 / 估算压缩 1,548,695 字节；重新构建的未签名 arm64 APK/AAB 当前压缩 payload 为 9,570,708 / 7,052,404 字节，这些只是静态测量。
- 签名校验已经实现，但当前主机没有 signing keystore，因此没有签名证据；release 脚本现在拒绝未签名产物，不再把它当作 release candidate。
- 采集器与契约测试已落盘，但当前没有在线设备/AVD，也没有执行 workload spec。因此 G2 与原生 G3 仍为 pending，harness 本身不等于设备验收。
- 显式 `adbArgs` 比任意脚本不方便，但证据可审阅，也避免误读宿主机文件；SAF UI 驱动继续由设备实验室负责。
### 后续执行顺序
1. 通过 CI secret 生成签名 arm64 APK/AAB，不提交 keystore；执行 `--require-signed --require-arm64 --require-rss`。
2. 在低内存 arm64 硬件运行 harness，归档 manifest、RSS JSON、logcat 尾部与 artifact hash；release 不接受仅 emulator 证据。
3. 用同一 projection corpus 执行 Tauri、Capacitor、Android 原生 adapter matrix，覆盖 force-stop/reopen 与权限/存储故障路径。
4. 完成 G4 identity/edge corpus 与 registry response/status shadow parity；之后再评估 canonical ID、带 `contentRef` 的 indexed projection 或 SQLite/WASM。

## 2026-08-18 第 18 阶段：原生恢复状态机证据

### 实施内容

1. 新增 `scripts/verify-mobile-native-recovery.js`，作为 Kotlin import journal 的无依赖 host verifier。它镜像 `staging`、`target-backed-up`、`target-activated` 三个 phase；已有 target 优先于过期事务 artifact；target 不存在时恢复有效 backup；unsafe path 或未知 schema 则 fail closed。
2. 回放六个场景：staging 且 target 已存在、target-backed-up 恢复、target-activated 的 target 优先、孤儿 backup 恢复、unsafe journal 拒绝与 unknown schema 拒绝。报告使用 schema-1 evidence，标记 `evidenceLevel: host-recovery-state-machine` 与 `nativeDeviceEvidence: false`。
3. verifier 与唯一的 Jest 契约测试均排除出 `mobile-slim`。Kotlin 仍是运行时 owner；host mirror 有意只作为漂移探测器，不形成第二套生产实现。

### 架构边界与权衡

本轮在不改变 Rust request/poll API、result marker 字段、projection schema 或移动包体的前提下，闭合了确定性的代码级恢复契约。代价是测试镜像可能在 journal 契约变化时漂移；缓解方式是要求 Kotlin bridge、verifier、契约测试与双语证据条目在同一变更中同步更新。该报告不能证明 Android 进程死亡、SAF UI 执行、存储/权限失败处理、签名产物完整性或 RSS。

### 验证与下一道门禁

- Recovery verifier：6 个场景通过；恢复契约定向测试：1 个测试通过。
- 全量 Jest：146 suites / 1,271 passed / 26 skipped。TypeScript no-emit 通过。Rust：28 passed / 1 ignored probe。
- Projection replay：4 个 host boundary、6 个节点、4 条边且无语义 mismatch。Mobile-slim：121 个文件 / 未压缩 4,275,083 字节 / 估算压缩 1,550,638 字节，SHA-256 为 `5d5bafa20770bf42531b2e39ec62364537e0eade83b29a9aa2209f4f03bf7c38`；RSS 仍为 `not measured`。
- G2/G3 下一步：签名 arm64 APK/AAB、SAF import/query/path、force-stop/reopen continuity、存储与权限失败 replay，以及代表性低内存硬件上的 RSS `<= 256 MiB`。
- 在原生 replay 与 old-snapshot、move-journal、collision、rollback corpus 归档前，继续冻结 public-ID 迁移、默认 SQLite/WASM 与移动端预算上调。

## 2026-08-18 第 21 阶段：宿主门禁对账

### 证据

- Android prerequisite、TypeScript no-emit、8 场景 native-recovery mirror 与 4-host projection replay 均通过。报告属于被忽略的 verification output，工作区保持 clean。
- 唯一已配置 AVD 为 `Medium_Phone_API_36.1`，路径 `E:\Android\avd\Medium_Phone.avd`：Android `36.1`、Play Store image、`x86_64`、2 GiB RAM；`adb devices -l` 没有 online target。它只能用于工具链 smoke test，不能作为 arm64 release 证据。
- 仓库/宿主搜索没有获批 `.jks`、`.keystore` 或 `.p12`。新鲜 APK/AAB 仍是未签名静态证据，release verification 必须继续要求 `--require-signed --require-arm64 --require-rss`。

### 下一步执行

1. CI 临时签名现有 slim `aarch64` 构建，发布签名产物与 provenance，不发布 keystore。
2. 在获批 arm64 低内存设备上执行 schema-1 声明式 workload：`saf-import -> graph-build -> exact-query -> path -> continuity`，并覆盖存储/权限重试。
3. recorder 归档 artifact hash/signature、脱敏设备信息、force-stop/reopen 观察、workload 结果、logcat 与 `/proc/<pid>/status:VmRSS`；缺证据或 RSS 超过 256 MiB 必须 fail closed。
4. 在归档完成前继续冻结 canonical public-ID、默认 SQLite/WASM 与移动预算变化。重建 x86_64、生成本地 debug keystore 或接受 emulator-only/unsigned 证据均是拒绝的捷径。

## 2026-08-18 第 22 阶段：CI 签名门禁与移动预算对账

### 实施

1. 保持签名逻辑由 `scripts/configure-tauri-android-signing.js` 拥有：本地清理旧 marker 并保持 unsigned；CI 只有在四项 signing value 与真实 keystore 齐全时才注入。
2. keystore 只在 release job 临时落盘；沿用 slim `aarch64` 构建，验证签名 arm64 APK/AAB，只发布已验证产物并删除 key。
3. AAB `jarsigner` 返回码 `4` 仅对确实已签名且证书链不受信任/自签的归档有效；unsigned 或损坏归档继续 fail closed。
4. 将产物事实与 release acceptance 分开记录：本地 smoke 的 APK 为 `9,576,838`、AAB 为 `7,140,668` 压缩字节；slim staging 为 121 个文件 / 未压缩 `4,275,083` / 估算压缩 `1,550,638` 字节。

### 向前计划与权衡

- 当前 `universal` 名称没有证据支撑，只发现 `arm64-v8a` native payload。应改名为 `arm64`，或在声明 universal 前增加逐 ABI manifest 与安装校验。
- input、projection、native output、staging 磁盘与 RSS 必须是独立预算。完整 Markdown 读取、JSON 重复驻留、Map 与 SAF backup/staging 可能在 admission 通过后仍超 RSS 或磁盘上限。
- 下一次运行固定为 CI 签名 arm64 -> 获批低内存设备 -> `saf-import -> graph-build -> exact-query -> path -> continuity` -> 存储/权限重试 -> force-stop/reopen -> `manifest + rss.json + artifact hash + logcat`。任何缺证据或 RSS 超过 256 MiB 都失败。
- 在原生证据归档与有界 content-read 测量前，不提升 SQLite/WASM、Godot、canonical public ID 或语料预算。这样牺牲功能晋级速度，但保护包体与硬件要求。

## 2026-08-18 第 23 阶段：版本化移动预算契约与 arm64 语义对齐

checked-in 的 `config/mobile-budget.v1.json` 现在由 slim verifier、artifact verifier 与 staging manifest 共用。Rust 为保持 native runtime 独立继续保留常量，同时由 Rust contract test 解析同一文件防止漂移。Android serialized projection 超过 48 MiB 会在 atomic replacement 前拒绝，content read 超过 16 MiB 会在返回大 String 前拒绝。release workflow 改为 `aarch64`，强制精确 `arm64-v8a` ABI 集合，并发布 `noteconnection-arm64-release.apk/.aab`；universal 仅保留本地 opt-in。Projection schema、public ID 与 IPC contract 不变；真机/RSS 门禁仍开放。

## 2026-08-21 第 24 阶段：跨 host runtime budget 投影与原生证据隔离

第 23 阶段统一了 build-time budget，但 browser constants 仍有重复，Capacitor 仍是读后计量。第 24 阶段增加 `mobile_budget_runtime.js` 作为小型 WebView projection，改用 UTF-8 字节计量，并在可用时先做 `stat` 预检、再以 decoded text 兜底。所有枚举 entry 都执行深度检查，worker 与 single-thread 构图共用边数/projection 校验。

Tauri 在 bootstrap/IPC read 前拒绝超限 generated asset。Android evidence harness 要求精确 `arm64-v8a`、可测且不超过 profile ceiling 的 RAM，并记录 ABI/RAM provenance。CI 只先暴露签名 arm64 workflow artifact；只有 self-hosted workload 与真实 RSS 证据成功后才上传 GitHub Release。Projection/IPC/public-ID contract 保持不变，移动包继续 runtime-first。

当前静态 staging 为 122 文件 / 未压缩 `4,283,033` / 估算压缩 `1,552,689` bytes / SHA-256 `c60fe683957faf8fcf88a34b1c766740340c2cdd005bc526cc4efe13befbf77c`。边界 contract、TypeScript、Rust、slim budget 与 Diataxis 通过；当前宿主没有获批 signing key 或在线获批 arm64 设备，原生 G2/G3 仍待完成。

## 2026-08-21 第 25 阶段：冲突安全的身份迁移与 owner 收敛

身份迁移边界现在会在修改 document、atom 或 evidence 前预检完整目标 alias 集合。历史 alias 仍是兼容查询入口，因此其他文档已经拥有的 URI、path 或 basename 会直接 fail-closed。合法 move 会原地把 path/URI/revision/alias 同步到 `ResourceRegistry`、workspace binding 与 `IndexLifecycle`；resource/projection/index ID、旧 `documentId`、content hash 与 segment 保持稳定。

本阶段关闭了此前 additive `sourceUri` 留下的 secondary-owner 缺口，但不改变 snapshot/projection schema、公开 ID 或移动端运行时资产。LearnGraph 的 typed boundary 纪律被落实为 identity contract；textbooks 的 package/compiler 方向仍保留给后续 ingestion 边界，二者都不足以证明应把数据库、Node sidecar、Godot runtime 或模型加入 `mobile-slim`。

新增 G4 fixture 验证 rejected-collision 状态与持久化后的四 owner 收敛。定向验证为 3 suites / 11 tests、TypeScript no-emit 与 `git diff --check`；全量回归为 148 个 Jest suite / 1,284 passed / 26 skipped、Rust 30 passed / 1 ignored、四 host projection replay 与 fresh mobile-low budget 通过。这还不是完整 ingest transaction：混合请求可能在后续 operation 失败前产生部分 mutation。下一步是 whole-request preflight 或 journaled rollback，再归档有版本的 G4 manifest；public-ID 与 SQLite/WASM 提升继续等待 replay 与原生 RSS 证据。

## 2026-08-21 第 26 阶段：请求级 ingest 原子性与单写者串行化

`ingestKnowledge` 现在使用按 platform instance 的单写者队列。每个请求在 mutation 前保存 versioned graph snapshot 的深拷贝；operation、relation recompute、owner mirror 或 atomic persistence 失败时，document/atom/evidence、secondary registry、index、identity journal、telemetry 与 `idCounter` 一起恢复。

identity ownership 在 `upsert` 与 `move` 的边界统一校验。path/URI/alias collision、显式 move ID 与 `from*` alias 不属于同一文档、source alias 歧义以及 owner mirror 缺失都会 fail-closed。mixed-batch G4 fixture 证明第一步成功但后续 collision 后第一步不可见，原始 alias 仍可继续使用。

本阶段关闭 Phase 25 的 partial-commit 缺口，不改变 public ID、snapshot/projection schema、Bridge 字段或 runtime-first 移动包。代价是与 graph 成比例的瞬时内存及 JSON clone/restore 延迟；低内存验收必须使用有界 batch 实测。在 public-ID、SQLite/WASM、Godot、预算或 strict-default route 提升前，仍需有版本 old-snapshot/cross-root/move-journal/collision/rollback manifest 与原生签名 arm64/RSS 证据。

当前验证：TypeScript no-emit 通过；148 个 Jest suite 通过，1,287 passed、26 skipped；Rust 通过，30 passed、1 ignored；mobile-low staging 通过，为 122 文件 / 未压缩 4,283,033 / 估算压缩 1,552,689 bytes；projection replay 通过（4 hosts）；native recovery 通过（8 scenarios）；Diataxis 通过（18 entries / 36 paths / 64 canonical references）；`git diff --check` 通过。
