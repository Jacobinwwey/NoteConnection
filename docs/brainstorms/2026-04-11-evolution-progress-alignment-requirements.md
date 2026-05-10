---
date: 2026-04-11
topic: evolution-progress-alignment
---

# NoteConnection Evolution Progress Alignment Requirements

## Problem Frame
当前目标不是“再写一份路线图”，而是把既有演进总方案与真实代码基线做严谨对齐，回答三个问题：

1. 现在已经完成了什么，哪些是部分完成，哪些仍是能力缺口。
2. 现有架构推进是否与三阶段目标同向，是否存在“看似完成但能力上限受限”的结构性问题。
3. 下一阶段应优先推进哪些工作，才能最大化掌握度提升与治理可控性。

### Current Baseline Snapshot (Evidence-Backed)

| Area | Plan Expectation | Evidence | Status |
|---|---|---|---|
| Core types | 必须实现 `KnowledgeAtom`/`EvidenceSpan`/`RelationEdge`/`TemporalEdge`/`LearnerConceptState`/`LearningAction`/`TutorTrace` | `src/learning/types.ts:66`, `src/learning/types.ts:80`, `src/learning/types.ts:100`, `src/learning/types.ts:114`, `src/learning/types.ts:125`, `src/learning/types.ts:142`, `src/learning/types.ts:154` | Done |
| Public APIs | 必须实现 `KnowledgeIngestAPI`/`KnowledgeQueryAPI`/`MasteryDiagnosticsAPI`/`LearningPathAPI`/`TutorActionAPI`/`MemoryPolicyAPI` | `src/learning/api.ts:78`, `src/learning/api.ts:82`, `src/learning/api.ts:125`, `src/learning/api.ts:133`, `src/learning/api.ts:201`, `src/learning/api.ts:205` | Done |
| Server contract wiring | `/api/knowledge/*` 与契约测试对齐 | `src/server.ts:9417`, `src/server.ts:9479`, `src/server.ts:9496`, `src/server.ts:9530`, `src/server.ts:9710`, `src/server.ts:9727`, `src/knowledge.api.contract.test.ts:10` | Done |
| L0 parse + evidence | Markdown/代码块/公式/Mermaid -> atom + evidence + hash/staleness | `src/learning/KnowledgeLearningPlatform.ts:961`, `src/learning/KnowledgeLearningPlatform.ts:9251`, `src/learning/KnowledgeLearningPlatform.ts:9376`, `src/learning/KnowledgeLearningPlatform.ts:9410` | Done |
| L1 structure + temporal | 关系边区分 fact/inferred，时序边生效 | `src/learning/types.ts:10`, `src/learning/KnowledgeLearningPlatform.ts:9650`, `src/learning/KnowledgeLearningPlatform.ts:9702` | Done |
| L2 explainable retrieval | keyword + semantic + graph + temporal，返回 evidence/path/validity | `src/learning/queryBackend.ts:45`, `src/learning/queryBackend.ts:237`, `src/learning/KnowledgeLearningPlatform.ts:1319`, `src/learning/KnowledgeLearningPlatform.ts:1322`, `src/learning/KnowledgeLearningPlatform.ts:1323` | Done |
| L3 mastery + divergence loop | 诊断、路径编排、双核输出 | `src/learning/KnowledgeLearningPlatform.ts:2295`, `src/learning/KnowledgeLearningPlatform.ts:2434` | Done |
| L4 workspace + tutor | Learning Workbench + tutor adapter + runtime trace filtering | `src/frontend/path.html:70`, `src/frontend/path.html:544`, `src/learning/tutorAdapter.ts:31`, `src/server.ts:8956` | Done |
| L5 governance | quality thresholds + runtime capability matrix + runbook + trace correlation | `src/learning/KnowledgeLearningPlatform.ts:335`, `src/learning/runtimeCapability.ts:1361`, `src/server.ts:8378`, `src/server.ts:2532` | Done |
| Graph DB backbone depth | 方案要求“本地图数据库高级引擎” | `src/server.ts:3569`, `src/learning/store.ts:231` 当前适配器为 file-backed adapter (`local-file-graphdb`) | Partial |
| Vector retrieval independence | 方案强调图+向量双层检索主干 | 当前 `local_hybrid` 语义层为 token/Jaccard，本地无独立向量索引后端（`src/learning/queryBackend.ts:199`） | Gap |

### Layer Maturity (L0-L5)

| Layer | Maturity | Notes |
|---|---|---|
| L0 Representation | High | 解析链路、证据定位、staleness 已具备。 |
| L1 Structure | High | fact/inferred + temporal 基本完整。 |
| L2 Retrieval | Medium | explainable retrieval 成熟，但“真正图+向量双引擎”仍未完成。 |
| L3 Learning | Medium-High | mastery/path/session 已闭环；效果优化仍需实验化推进。 |
| L4 Interaction | High | Workbench 能力面完整，调试入口充足。 |
| L5 Governance | Medium-High | runbook/threshold/trace 已落地；学习效果门禁需更强线上化闭环。 |

## Requirements

**Progress Governance**
- R1. 建立并持续维护“方案条款 -> 代码证据 -> 测试证据”的单一真相矩阵，作为后续迭代入口文档。
- R2. 每个阶段新增能力必须同时提供三类证据：接口契约、运行时可观测信号、回归测试用例。

**Phase 1 Completion (Backbone Hardening)**
- R3. 将 `graphdb` 后端从“文件适配器模拟层”升级为“真实本地图数据库适配层”，并保留可回退路径。
- R4. 完成图存储能力验证：增量写入、关系查询、时序有效性查询、故障回退的一致性验证。
- R5. 将检索后端升级为可插拔“双引擎”（graph + vector），并保留 `compare-backends` 趋势治理机制。

**Phase 2 Advancement (Mastery + Divergence)**
- R6. 把掌握闭环从“功能闭环”升级为“效果闭环”：对复测通过率、误区复发率做持续趋势评估与门禁。
- R7. 为 Divergence Path 建立质量评分框架（相关性、迁移有效性、反例价值），进入可回归评估。
- R8. 把错因体系与路径编排策略联动，保证错因标签可直接驱动补救动作和复训计划。

**Phase 3 Readiness (Tutor + Memory Robustness)**
- R9. 固化多适配器 tutor 路由健康预算与降级策略，确保 provider 波动下仍可稳定给出 evidence-first 输出。
- R10. 将分层记忆策略（session/unit/long_term）纳入强制诊断与趋势门禁，避免“写入了但不可控”。

**Delivery and Risk Control**
- R11. 后续开发采用“Phase 1 补齐为主线 + 低风险 Phase 2 验证并行”的双轨节奏，禁止只扩功能不补底座。
- R12. 每个迭代必须产出“可验证学习收益”与“治理稳定性”双指标，不满足任一项不得视为完成。

## Success Criteria
- Phase 1 完成判定从“接口存在”升级为“真实图后端可运行且可回退”。
- 检索层可在不改上层调用协议的情况下切换或组合 graph/vector 后端。
- 学习效果指标具备连续趋势输出，能够比较策略变更前后差异。
- Divergence 输出具备可解释评分，不再只依赖主观观感。
- Tutor 路由和 Memory 策略都具备异常态诊断、告警与回滚策略。
- 新增能力在 `src/knowledge.api.contract.test.ts` 与关键集成测试中可被验证。

## Scope Boundaries
- 不引入云优先多租户作为当前阶段前置条件。
- 不在当前阶段引入深度分布式架构复杂度。
- 不把“模型能力提升”当作替代“证据链与治理体系完善”。

## Key Decisions
- Decision: 先补“底座缺口”（真实 graph db + vector 双引擎）再大规模扩展高层功能。  
  Rationale: 当前主要风险不是接口缺失，而是架构上限受限；Phase 2 仅并行推进低耦合验证项。
- Decision: 以“学习效果 + 治理稳定”双指标作为推进主轴。  
  Rationale: 避免功能增长与学习收益脱钩。
- Decision: 保持本地优先和可回退机制不变。  
  Rationale: 与既定产品决策和隐私边界一致，且工程风险可控。

## Alternatives Considered
- Option A: Feature-first（优先扩展 Phase 2/3 新能力，再回补底座）  
  Pros: 用户可见功能增长快。  
  Cons: 容易累积“治理与底层债务”，后续返工成本高。
- Option B: Foundation-first（推荐，先补齐 Phase 1 关键缺口，再扩大上层能力）  
  Pros: 降低后续演进风险，保障长期上限与可维护性。  
  Cons: 短期可见功能增长速度略慢。
- Option C: Two-track（Phase 1 主线 + 低风险 Phase 2 验证并行）  
  Pros: 兼顾底座质量与学习效果验证速度。  
  Cons: 需要更强治理节奏，避免并行任务漂移成“隐形主线”。

## Dependencies / Assumptions
- 假设现有 `KnowledgeLearningPlatform` API 面保持兼容，后续主要做后端能力增强与治理强化。
- 假设继续沿用 `compare-backends`、runtime runbook、quality gate 作为治理主干。
- 假设前端 Learning Workbench 继续作为集成验证界面，不新增独立控制台。

## Outstanding Questions

### Resolve Before Planning
- 暂无阻塞项。

### Deferred to Planning
- [Affects R3][Technical] 真实本地图数据库首选方案与适配器边界（例如 Neo4j 本地进程或嵌入式图存储）如何分阶段落地。
- [Affects R5][Technical] 向量检索后端的最小可行实现策略与离线索引更新机制。
- [Affects R6][Needs research] 学习效果评估样本的最小统计口径与实验窗口设定。

## Next Steps
→ `/prompts:ce-plan` for structured implementation planning.
