# NoteConnection v1.8.0

## English

### Release Scope

- Compare baseline: `v1.7.0..v1.8.0`
- Release date: 2026-07-07
- Scope summary:
  - 343 implementation commits since the previous formal release, plus release metadata.
  - Major focus: Knowledge Workspace / Agent Workspace reliability, RSE document-augmented graph RAG, richer one-message answers, runtime observability, desktop sidecar hardening, CI governance, and bilingual documentation.

### Breaking Changes

- No intentional breaking API change is introduced in this release.
- The Knowledge Workspace response model remains additive and forward-compatible: new RAG, trace, claim-citation, sufficiency, source-decision, and export fields are optional.
- Runtime caches, graph caches, and probe fixtures may be regenerated after upgrade; this is expected and does not require a manual data migration.

### Highlights

- Upgraded Knowledge Workspace answers from narrow scoped summaries to a bounded RSE + document-augmented graph RAG pipeline.
- Added full-document-aware source augmentation for selected scoped documents while keeping model-visible context bounded by `RagContextPack`.
- Added graph-conditioned evidence assembly so predecessor/successor nodes contribute source-backed content, relation metadata, and intent-ranked graph context rather than title-only hints.
- Preserved the one public chat message contract while moving orchestration, scoring, recovery, source decisions, evidence roles, and claim-citation mapping into backend trace/status/export surfaces.
- Added profile-aware public answer behavior for definitions, comparisons, how-to answers, causal explanations, and generic queries.
- Hardened release review so public answers are checked against citation-backed RAG fragments, profile completeness signals, graph intent, structured contradictions, temporal qualifiers, and diagnostic leakage rules.
- Expanded runtime and CI probes to cover full-document scans, cross-document conflicts, condition-scoped evidence, graph-neighbor source loss, provider judge failure, and answer profile budgets.

### Knowledge Workspace RAG and Answer Quality

- Introduced typed RAG evidence contracts:
  - `RagEvidenceFragment`
  - `RagContextPack`
  - `RagContextBudget`
  - `RagSufficiencyReview`
  - source decisions and failure-stage classifications
- Added source-window and document augmentation assembly:
  - starts from precise evidence spans;
  - reads complete selected source documents when provenance allows;
  - emits direct support, parent context, adjacent context, graph-neighbor support, conflict, background, and degraded source-window states;
  - deduplicates repeated/overlapping windows and preserves line/offset provenance.
- Added budgeted context packing:
  - role-prioritized fragment selection;
  - per-fragment and total-character caps;
  - traceable include/truncate/drop decisions;
  - head/tail-preserving truncation for oversized evidence.
- Added deterministic and optional provider-backed sufficiency judging:
  - deterministic gates run first;
  - optional LLM judge reuses the existing NoteMD provider boundary;
  - malformed JSON, timeout, and provider failure fall back deterministically;
  - recovery is bounded to one assembly/review pass.
- Added richer public answer composition:
  - direct/document/graph evidence budgets are selected by answer profile;
  - public output strips source-authored scaffolding labels such as `Prerequisite:`, `Mechanism:`, and `Failure mode:` while preserving meaningful step labels;
  - compare answers rank evidence by operands and graph intent, and do not promote procedure-like evidence unless the query is about procedures;
  - how-to answers preserve steps, prerequisites, downstream checks, and failure handling;
  - causal answers preserve mechanism, consequence, and boundary evidence.
- Added release-review completeness improvements:
  - `rag_answer_completeness` now checks required RAG roles and profile-specific signals;
  - drafts missing pack-backed prerequisites, failure handling, mechanisms, consequences, or boundaries are revised from the RAG pack;
  - `rag_claim_citation_support` contracts unsupported or weakly supported public claims.

### Conflict, Qualifier, and Graph Guardrails

- Expanded controlled conflict detection across:
  - measurements and tolerances;
  - dates and release dates;
  - state/status values;
  - quantity and retry limits;
  - location facts;
  - ownership identity facts;
  - endpoint, dependency, format, protocol, semantic-version, service-port, and response-status-code facts.
- Added false-positive guards for scoped qualifiers:
  - temporal current-vs-historical facts;
  - environment-scoped facts;
  - version-scoped facts;
  - platform-scoped facts;
  - cross-document condition-scoped facts.
- Added graph-intent ranking and filtering:
  - comparison queries prefer analogy/contrast neighbors over procedural sequence edges;
  - graph neighbors outside the resolved conversation scope are filtered before evidence assembly;
  - in-scope graph-neighbor source-window failures degrade explicitly instead of silently becoming complete graph support.
- Added runtime probe fixtures under `Knowledge_Base/` for:
  - full-document remote-scan hard negatives;
  - cross-document conflicts;
  - temporal/environment/version/platform qualifiers;
  - graph intent;
  - context overflow;
  - repeated snippet anchoring;
  - causal answer profile budgets.

### Agent Workspace and Frontend UX

- Added and hardened Agent Workspace frontend runtime surfaces:
  - `agent_workspace.js`
  - `agent_workspace_runtime.js`
  - `workspace_panes.js`
  - localized `en` / `zh` status strings
  - modular runtime bridge files and state modules
- Improved Knowledge Workspace visibility for API/RAG state:
  - compact evidence status;
  - provider/runtime readiness indicators;
  - RAG sufficiency and degradation summaries;
  - trace-friendly answer/evidence panes without adding extra chat messages.
- Preserved knowledge-point-oriented evidence display:
  - same knowledge point hits are grouped instead of duplicated;
  - public answers stay natural while trace/export surfaces retain raw evidence details.
- Added frontend contract and runtime behavior tests covering Agent Workspace API parity, runtime behavior, localization, and UI contract surfaces.

### Learning Platform, Storage, and Export

- Expanded the learning platform into typed domain boundaries:
  - `KnowledgeIngestor`
  - `KnowledgeQuerier`
  - `ConversationManager`
  - `MasteryEngine`
  - `QualityEvaluator`
  - `TutorRouter`
  - `MemoryPolicyManager`
- Added or strengthened:
  - knowledge store and persistence tests;
  - query backend tests and external HTTP integration coverage;
  - vector acceleration adapter contracts;
  - runtime capability detection;
  - memory governance;
  - workflow artifact store;
  - resource and workspace registries;
  - indexing lifecycle and segment/unit builders.
- Added answer grounding export support:
  - final public answer claims map to citation ids, RAG fragment ids, source paths, and support status;
  - workspace export bundles deep-clone trace mappings so replay/export consumers can audit grounding without mutable runtime references.

### NoteMD, Markdown, and Reader Runtime

- Expanded NoteMD operation surfaces:
  - CLI parser/dispatcher/commands;
  - operation registry and capability manifest;
  - config profile commands;
  - provider diagnostics, provider templates, and provider profiles;
  - Tavily and DuckDuckGo search provider adapters.
- Added diagram-generation planning and response parsing for NoteMD workflows.
- Hardened Mermaid and Markdown handling:
  - Mermaid fence guardrails;
  - browser Mermaid runtime embedding;
  - Resvg runtime embedding;
  - reader renderer coverage;
  - reader and Markdown runtime frontend updates.
- Added regression and contract tests for NoteMD API, CLI, workflow, batch, diagram, app-config, provider templates, and server integration behavior.

### Desktop, Tauri, Godot, Path Mode, and Multi-Platform Runtime

- Hardened Tauri sidecar handling:
  - sidecar cleanup;
  - sidecar supply readiness;
  - sidecar validation;
  - sidecar relaunch contracts;
  - sidecar signatures and replacement boundaries;
  - Godot sidecar bootstrap and mirror checks.
- Added Agent Workspace Tauri verification scripts:
  - browser runtime verification;
  - Tauri runtime verification;
  - Tauri window evidence capture;
  - Tauri Rust strict checks;
  - evidence index, manifest, summary, and release-fragment rendering.
- Strengthened PathBridge and runtime transport boundaries:
  - strict schema verification;
  - handshake contracts;
  - runtime port fallback contracts;
  - runtime heap/spool/transport policies;
  - request trace middleware and modular route registration.
- Updated Godot / Path Mode surfaces:
  - reader render client;
  - path renderer;
  - settings panel;
  - WebSocket client;
  - path mode UI and shader updates.
- Expanded Android / Capacitor / mobile governance:
  - Android path mode contracts and smoke checks;
  - Detox pipeline verification;
  - privacy manifest verification;
  - Capacitor runtime, device, bridge, storage, and evidence contracts.

### WASM, Performance, and Foundation Runtime

- Added or strengthened WASM parity runtime gates:
  - artifact provisioning;
  - runtime functional checks;
  - output equivalence;
  - benchmark contracts;
  - benchmark guard contracts;
  - history gates.
- Added foundation runtime verification:
  - SQLite runtime contracts and matrix/soak scripts;
  - ANN runtime contracts and release evidence scripts;
  - release evidence verification and multi-host readiness checks.
- Added platform utilities:
  - platform capability detection;
  - render materializer;
  - export profiles;
  - runtime path resilience.

### CI, Release Governance, and Repository Operations

- Hardened GitHub Actions workflows:
  - Docs Diataxis Site;
  - Docs GitHub Pages Publish;
  - Fixrisk Operational Readiness;
  - Migration Gates;
  - Mobile E2E Detox Contracts;
  - npm publish;
  - desktop multi-OS release;
  - version check;
  - WASM parity benchmark snapshots.
- Added release and compliance guardrails:
  - license policy contracts;
  - SBOM policy and attestation contracts;
  - LFS asset policy checks;
  - sidecar signature contracts;
  - core real-machine verification helpers.
- Added Trellis task/workflow scaffolding and repository process documentation for structured work tracking.
- Updated `AGENTS.md`, CI status docs, task/walkthrough docs, and bilingual governance references.

### Documentation

- Added and expanded bilingual Diataxis documentation:
  - development progress dashboards;
  - architecture and migration;
  - release and governance;
  - multi-platform build flows;
  - Git LFS asset migration;
  - sidecar supply feasibility;
  - Android release build;
  - Godot sidecar bootstrap;
  - GitHub Pages publish flow;
  - Agent conversation focus mode plan;
  - DeepTutor and memo reuse assessments.
- Added long-form implementation and solution plans:
  - RSE document-augmented graph RAG answer pipeline;
  - agent final-reply review robustness;
  - agent knowledge DAG answer contract;
  - graph preview and review closure;
  - architecture progress alignment;
  - knowledge workspace DAG alignment.
- Expanded bilingual task, implementation plan, walkthrough, README, test report, interface, sidecar, LFS, and multi-platform build docs.

### Version Metadata

- Aligned release metadata to `1.8.0` in:
  - `package.json`
  - `package-lock.json`
  - `src-tauri/tauri.conf.json`

### Verification

Local verification before release:

- `npm test -- --runInBand`
- `npm run build`
- `npm run docs:diataxis:check`
- `npm run docs:site:build`
- `node scripts/verify-knowledge-workspace-runtime.js --full --case causal_answer_profile_budget_en --case graphintent_compare_neighbor_selection_en`

Remote `main` verification for the pre-release head:

- Docs Diataxis Site: success
- Docs GitHub Pages Publish: success
- Mobile E2E Detox Contracts: success
- Fixrisk Operational Readiness: success
- Migration Gates: success

### Known Follow-Up Work

- Broader profile classes and corpus-calibrated answer budgets.
- Larger replay/runtime corpora for weakly supported but lexically similar claims.
- Deeper natural-language synthesis beyond deterministic source-label stripping.
- Continued calibration of graph-confidence thresholds and semantic conflict classes.

### GitHub Release Body Template

Use this section as the GitHub Release body:

1. Summary:
   - NoteConnection v1.8.0 upgrades Knowledge Workspace into a bounded RSE + document-augmented graph RAG system with richer one-message answers, stronger release review, and much deeper runtime observability.
2. Major user-facing changes:
   - Source-backed answers now use precise spans, full selected source documents, graph-neighbor evidence, sufficiency review, and profile-aware answer composition.
   - The public chat still returns one answer message; evidence roles, source decisions, recovery, and claim-citation mappings stay in trace/status/export surfaces.
   - Compare, how-to, causal, definition, and generic answers now use different deterministic budgets and completeness gates.
3. Runtime and platform:
   - Agent Workspace frontend, Tauri sidecar handling, PathBridge contracts, Godot/Path Mode integration, mobile contracts, and WASM/foundation gates are substantially hardened.
4. Documentation and governance:
   - Bilingual Diataxis docs, implementation plans, release governance, CI gates, SBOM/license/LFS checks, and operational scripts are synchronized for the new runtime architecture.
5. Compatibility:
   - No intentional breaking API change; new response, trace, RAG, and export fields are additive.

---

## 中文

### 发布范围

- 对比基线：`v1.7.0..v1.8.0`
- 发布日期：2026-07-07
- 范围摘要：
  - 上一个正式版本之后累计 343 个实现提交，外加本次发布元数据。
  - 本次重点：Knowledge Workspace / Agent Workspace 可靠性、RSE document-augmented graph RAG、更充分的单消息回答、运行时可观测性、桌面 sidecar 加固、CI 治理与双语文档。

### 破坏性变更

- 本版本没有引入有意的破坏性 API 变更。
- Knowledge Workspace 响应模型保持增量兼容：新增 RAG、trace、claim-citation、sufficiency、source-decision 与 export 字段均为 optional。
- 升级后运行时 cache、graph cache 与探针 fixture 可能会重新生成，这是预期行为，不需要手工数据迁移。

### 版本亮点

- 将 Knowledge Workspace 回答从窄 scoped summary 升级为有界的 RSE + document-augmented graph RAG 链路。
- 对被选 scoped 文档启用完整文档感知的 source augmentation，同时用 `RagContextPack` 限制模型可见上下文。
- 引入 graph-conditioned evidence assembly，使前驱/后继节点贡献可追溯源内容、关系元数据与按意图排序的图上下文，而不是只展示标题。
- 保持“聊天区只显示一条公开回答”的产品契约，把编排、评分、恢复、source decisions、evidence roles 与 claim-citation mapping 放入后端 trace/status/export surface。
- 为 definition、compare、how-to、causal 与 generic 查询加入 profile-aware 公开回答策略。
- 强化 release review，使公开回答接受 citation-backed RAG fragment、profile completeness signals、graph intent、结构化矛盾、时序限定与诊断泄漏规则的检查。
- 扩展 runtime 与 CI 探针，覆盖 full-document scan、跨文档冲突、条件限定证据、图邻居 source loss、provider judge 失败与 answer profile budget。

### Knowledge Workspace RAG 与回答质量

- 引入类型化 RAG 证据契约：
  - `RagEvidenceFragment`
  - `RagContextPack`
  - `RagContextBudget`
  - `RagSufficiencyReview`
  - source decisions 与 failure-stage classifications
- 新增 source-window / document augmentation assembly：
  - 从精确 evidence span 出发；
  - provenance 允许时读取被选源文档完整内容；
  - 产出 direct support、parent context、adjacent context、graph-neighbor support、conflict、background 与 degraded source-window state；
  - 去重重复/重叠窗口，并保留 line / offset provenance。
- 新增有界 context packing：
  - 按 evidence role 优先级选 fragment；
  - 片段级和总字符数上限；
  - 可追踪 include / truncate / drop decision；
  - 对超大 evidence 采用保留首尾的截断策略。
- 新增确定性与可选 provider-backed sufficiency judging：
  - deterministic gate 优先运行；
  - 可选 LLM judge 复用现有 NoteMD provider 边界；
  - malformed JSON、timeout 和 provider failure 都会回退到确定性路径；
  - recovery 被限制为一次 assembly / review pass。
- 新增更充分的公开回答组织：
  - direct / document / graph evidence budget 按 answer profile 选择；
  - 公开输出会剥离 `Prerequisite:`、`Mechanism:`、`Failure mode:` 等源文档结构标签，同时保留有意义的步骤标签；
  - compare 回答按 operand 与 graph intent 排序，除非 query 本身讨论 procedure，否则不会把 procedure-like evidence 升到公开回答；
  - how-to 回答会保留 steps、prerequisites、downstream checks 与 failure handling；
  - causal 回答会保留 mechanism、consequence 与 boundary evidence。
- 强化 release-review completeness：
  - `rag_answer_completeness` 现在同时检查 required RAG roles 和 profile-specific signals；
  - draft 如果遗漏 pack 中已有的 prerequisites、failure handling、mechanisms、consequences 或 boundaries，会从 RAG pack 修订；
  - `rag_claim_citation_support` 会收缩 unsupported 或 weakly supported 的公开 claim。

### 冲突、限定条件与图护栏

- 扩展受控 conflict detection，覆盖：
  - measurement / tolerance；
  - date / release date；
  - state / status；
  - quantity / retry limit；
  - location；
  - ownership identity；
  - endpoint、dependency、format、protocol、semantic-version、service-port 与 response-status-code。
- 新增限定条件 false-positive guard：
  - temporal current-vs-historical facts；
  - environment-scoped facts；
  - version-scoped facts；
  - platform-scoped facts；
  - cross-document condition-scoped facts。
- 新增 graph-intent ranking 与 filtering：
  - compare 查询会优先 analogy / contrast 邻居，而不是 procedural sequence edge；
  - resolved conversation scope 之外的 graph neighbor 会在 evidence assembly 前过滤；
  - scope 内 graph-neighbor source-window 缺失会显式降级，不会被静默当作完整 graph support。
- 在 `Knowledge_Base/` 中新增 runtime probe fixture：
  - full-document remote-scan hard negative；
  - cross-document conflict；
  - temporal / environment / version / platform qualifier；
  - graph intent；
  - context overflow；
  - repeated snippet anchoring；
  - causal answer profile budget。

### Agent Workspace 与前端体验

- 新增并加固 Agent Workspace 前端运行时 surface：
  - `agent_workspace.js`
  - `agent_workspace_runtime.js`
  - `workspace_panes.js`
  - 本地化 `en` / `zh` 状态文案
  - 模块化 runtime bridge 与 state module
- 增强 Knowledge Workspace 对 API / RAG 状态的可见性：
  - compact evidence status；
  - provider / runtime readiness indicator；
  - RAG sufficiency 与 degradation summary；
  - trace-friendly answer / evidence pane，且不会追加额外聊天消息。
- 保持 knowledge-point-oriented evidence display：
  - 同一知识点的命中会聚合而不是重复展示；
  - 公开回答保持自然语言，trace / export surface 保留原始 evidence 细节。
- 新增前端 contract 与 runtime behavior tests，覆盖 Agent Workspace API parity、运行时行为、本地化与 UI contract surface。

### Learning Platform、存储与导出

- 将 learning platform 拆分到更清晰的 typed domain boundary：
  - `KnowledgeIngestor`
  - `KnowledgeQuerier`
  - `ConversationManager`
  - `MasteryEngine`
  - `QualityEvaluator`
  - `TutorRouter`
  - `MemoryPolicyManager`
- 新增或强化：
  - knowledge store 与 persistence tests；
  - query backend tests 与 external HTTP integration coverage；
  - vector acceleration adapter contracts；
  - runtime capability detection；
  - memory governance；
  - workflow artifact store；
  - resource / workspace registry；
  - indexing lifecycle 与 segment / unit builders。
- 新增 answer grounding export：
  - 最终公开回答 claim 会映射到 citation id、RAG fragment id、source path 与 support status；
  - workspace export bundle 会 deep-clone trace mapping，方便 replay / export 消费者审计 grounding，避免共享可变运行时引用。

### NoteMD、Markdown 与 Reader Runtime

- 扩展 NoteMD 操作面：
  - CLI parser / dispatcher / commands；
  - operation registry 与 capability manifest；
  - config profile commands；
  - provider diagnostics、provider templates 与 provider profiles；
  - Tavily / DuckDuckGo search provider adapters。
- 为 NoteMD workflow 新增 diagram-generation planning 与 response parsing。
- 加固 Mermaid 与 Markdown：
  - Mermaid fence guardrails；
  - browser Mermaid runtime embedding；
  - Resvg runtime embedding；
  - reader renderer coverage；
  - reader 与 Markdown runtime 前端更新。
- 新增 NoteMD API、CLI、workflow、batch、diagram、app-config、provider templates 与 server integration 回归/契约测试。

### Desktop、Tauri、Godot、Path Mode 与多平台运行时

- 加固 Tauri sidecar：
  - sidecar cleanup；
  - sidecar supply readiness；
  - sidecar validation；
  - sidecar relaunch contracts；
  - sidecar signatures 与 replacement boundaries；
  - Godot sidecar bootstrap 与 mirror checks。
- 新增 Agent Workspace Tauri 验证脚本：
  - browser runtime verification；
  - Tauri runtime verification；
  - Tauri window evidence capture；
  - Tauri Rust strict checks；
  - evidence index / manifest / summary / release-fragment rendering。
- 强化 PathBridge 与 runtime transport 边界：
  - strict schema verification；
  - handshake contracts；
  - runtime port fallback contracts；
  - runtime heap / spool / transport policies；
  - request trace middleware 与 modular route registration。
- 更新 Godot / Path Mode：
  - reader render client；
  - path renderer；
  - settings panel；
  - WebSocket client；
  - path mode UI 与 shader。
- 扩展 Android / Capacitor / mobile 治理：
  - Android path mode contracts 与 smoke checks；
  - Detox pipeline verification；
  - privacy manifest verification；
  - Capacitor runtime、device、bridge、storage 与 evidence contracts。

### WASM、性能与 Foundation Runtime

- 新增或强化 WASM parity runtime gates：
  - artifact provisioning；
  - runtime functional checks；
  - output equivalence；
  - benchmark contracts；
  - benchmark guard contracts；
  - history gates。
- 新增 foundation runtime verification：
  - SQLite runtime contracts 与 matrix / soak scripts；
  - ANN runtime contracts 与 release evidence scripts；
  - release evidence verification 与 multi-host readiness checks。
- 新增平台工具：
  - platform capability detection；
  - render materializer；
  - export profiles；
  - runtime path resilience。

### CI、发布治理与仓库运营

- 加固 GitHub Actions workflows：
  - Docs Diataxis Site；
  - Docs GitHub Pages Publish；
  - Fixrisk Operational Readiness；
  - Migration Gates；
  - Mobile E2E Detox Contracts；
  - npm publish；
  - desktop multi-OS release；
  - version check；
  - WASM parity benchmark snapshots。
- 新增 release / compliance guardrails：
  - license policy contracts；
  - SBOM policy 与 attestation contracts；
  - LFS asset policy checks；
  - sidecar signature contracts；
  - core real-machine verification helpers。
- 新增 Trellis task / workflow scaffolding 与仓库流程文档，用于结构化工作跟踪。
- 更新 `AGENTS.md`、CI status、task / walkthrough 与双语治理文档。

### 文档

- 新增并扩展双语 Diataxis 文档：
  - development progress dashboards；
  - architecture and migration；
  - release and governance；
  - multi-platform build flows；
  - Git LFS asset migration；
  - sidecar supply feasibility；
  - Android release build；
  - Godot sidecar bootstrap；
  - GitHub Pages publish flow；
  - Agent conversation focus mode plan；
  - DeepTutor / memo reuse assessments。
- 新增长篇 implementation / solution plans：
  - RSE document-augmented graph RAG answer pipeline；
  - agent final-reply review robustness；
  - agent knowledge DAG answer contract；
  - graph preview and review closure；
  - architecture progress alignment；
  - knowledge workspace DAG alignment。
- 扩展双语 task、implementation plan、walkthrough、README、test report、interface、sidecar、LFS 与 multi-platform build docs。

### 版本元数据

- 以下文件版本已统一到 `1.8.0`：
  - `package.json`
  - `package-lock.json`
  - `src-tauri/tauri.conf.json`

### 验证

本地发布前验证：

- `npm test -- --runInBand`
- `npm run build`
- `npm run docs:diataxis:check`
- `npm run docs:site:build`
- `node scripts/verify-knowledge-workspace-runtime.js --full --case causal_answer_profile_budget_en --case graphintent_compare_neighbor_selection_en`

发布前远端 `main` 验证：

- Docs Diataxis Site: success
- Docs GitHub Pages Publish: success
- Mobile E2E Detox Contracts: success
- Fixrisk Operational Readiness: success
- Migration Gates: success

### 后续工作

- 更广 answer profile 类和基于语料校准的回答预算。
- 更大 replay / runtime corpus，用于覆盖“词面相近但支撑不足”的 claim。
- 超出确定性 source-label stripping 的更深自然语言 synthesis。
- 继续校准 graph-confidence threshold 与 semantic conflict class。

### GitHub Release 正文模板

可将以下内容作为 GitHub Release 正文：

1. 概要：
   - NoteConnection v1.8.0 将 Knowledge Workspace 升级为有界 RSE + document-augmented graph RAG 系统，提供更充分的单消息回答、更强 release review 和更完整运行时可观测性。
2. 主要用户可见变化：
   - 回答现在基于 precise spans、完整被选源文档、graph-neighbor evidence、sufficiency review 与 profile-aware answer composition。
   - 聊天区仍只返回一条公开回答；evidence roles、source decisions、recovery 与 claim-citation mappings 保留在 trace/status/export surface。
   - compare、how-to、causal、definition 与 generic 回答现在使用不同确定性预算与 completeness gates。
3. 运行时与平台：
   - Agent Workspace 前端、Tauri sidecar、PathBridge contract、Godot / Path Mode、mobile contracts 与 WASM / foundation gates 均显著加固。
4. 文档与治理：
   - 双语 Diataxis 文档、实现方案、发布治理、CI gates、SBOM / license / LFS checks 与运维脚本已同步到新的运行时架构。
5. 兼容性：
   - 无有意破坏性 API 变更；新增 response、trace、RAG 与 export 字段均为增量 optional。
