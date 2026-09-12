---
title: Project progress audit and completion boundaries
date: 2026-09-12
status: current-audit
source_revision: e84d6ece9cce5b82902d4b9335ac096a136a8d2a
---

# Project Progress Audit / 项目进度审计

## English

### Decision and scope

The project has a substantial working implementation, but **runtime isolation, bounded execution, and release qualification remain open**. The next increment should close those contracts before adding more answer profiles, infrastructure, or platform variants.

Baseline: local `main`, commit `e84d6ece` (2026-09-03), package `1.8.0`; audited on 2026-09-12. This is a local code/document audit with fresh tests and synthetic probes against production functions. Remote CI, a freshly packaged desktop application, browser/Godot interaction, and Android hardware were not revalidated in this audit. No production implementation was changed.

This page owns the current cross-plan status. The [convergence plan](../plans/2026-09-12-001-refactor-project-convergence-plan.md) owns the next implementation units. Older task files, walkthroughs, and dated completion notes remain historical evidence; their unchecked items are not automatically current backlog.

Status notation:

- **D — implemented baseline:** code and relevant tests exist; this does not imply release or user-outcome acceptance.
- **P — partial:** a required implementation invariant is incomplete or a reproduced defect reopens it.
- **E — evidence open:** implementation/harness exists, but the required fresh runtime, device, scale, or outcome evidence is missing.
- **F — deferred:** a deliberate conditional direction, not a delivery commitment.
- **H — historical:** absorbed into later work; retained for traceability.

There is no aggregate completion percentage. Repeated historical checklists, translations, implementation steps, and operational gates have different denominators.

### Fresh verification

| Check | Observation | What it establishes |
|---|---|---|
| TypeScript | `tsc --noEmit --incremental false` passed | Current source type-checks on local Node `22.19.0` |
| Full Jest | **159 suites, 1,419 passed, 26 skipped, 0 failed**; 1,445 cases total | Existing automated baseline passes; approximately 178 seconds |
| Documentation | Final Diataxis check: 18 entries, 36 language paths, 68 canonical references; MkDocs build passed; 140 added links checked | New pages/anchors and language sections are valid; this does not prove product acceptance |
| Serialization probe | Raw response **1,998 bytes**, completed-event JSON **2,094 bytes**, synthetic budget **2,000 bytes**, `truncated=false` | SSE envelope accounting defect reproduced |
| Matching probe | `fuzzy`: `cat` in `concatenate`, and `知识` in `知识图谱`, both accepted by `checkMatch`; sequential candidate filtering emits no edge | Sequential matching is not semantically equivalent to the worker matcher |
| Ingest isolation probe | State exposes 2 documents before failed commit; concurrent memory returns `added=true`; rollback leaves 1 document and **0 memory entries** | Dirty state visibility and loss of an acknowledged concurrent write reproduced |
| Foundation release evaluator | `ok=false` at explicit audit time `2026-09-12T00:00:00Z` | Current local reports do not qualify for release |

The ingest probe uses the real `KnowledgeLearningPlatform` and an injected in-memory store that serializes saves and fails one ingest write. It proves a platform-level concurrency defect, not a device/filesystem failure. The SSE probe uses a deliberately small internal test budget; it establishes the boundary-accounting error, not a measured production memory incident.

The skipped cases are concentrated: 13 in `src/server.migration.test.ts` and 13 in `src/agent_workspace.contract.parity.test.ts`. Some parity cases skip when a source-string marker disappears. A green run therefore does not prove those request, build, clipboard, scope, or capability contracts.

Local reproducible evidence:

- `output/project-audit-2026-09-12/jest-results.json` and `jest.log`.
- `output/project-audit-2026-09-12/boundary-probes.cjs` / `boundary-probes.json`.
- `output/project-audit-2026-09-12/ingest-isolation-probe.cjs` / `ingest-isolation-probe.json`.
- `output/project-audit-2026-09-12/foundation-release-evidence.json`.
- Checked-in compact record: [audit evidence](2026-09-12-project-progress-evidence.json).

The local files above are ignored diagnostic artifacts, not durable release attestations. From the repository root, reproduce the two probes with `rtk proxy node output/project-audit-2026-09-12/boundary-probes.cjs` and `rtk proxy node output/project-audit-2026-09-12/ingest-isolation-probe.cjs`.

### Progress by plan family

| ID | Plan family | Reconciled status | Remaining completion boundary |
|---|---|---|---|
| M01 | Knowledge-mastery evolution, L0–L5 / Phases 1–3 | **P/E**: atom/evidence, retrieval, mastery, tutor and memory mechanisms exist | Learning gains, misconception recurrence, and path superiority are not demonstrated by API tests |
| M02 | April Agent Workspace alignment / v1–v6 contract plans | **D/P**: scoped actions, diagnostics, contracts and runtime paths exist | Domain ownership and meaningful parity coverage remain partial |
| M03 | Markdown Reader / NoteMD upgrade | **D/E**: shared rich rendering, Mermaid repair and NoteMD operations exist | Current browser/Tauri/Godot acceptance remains a separate runtime check |
| M04 | May cross-platform refinement / decomposition / Phase 4 | **P**: registry, domain files and ES modules exist | Legacy route copies and reverse domain delegation still concentrate behavior |
| M05 | May 25 lightweight RAG / agent Phases 0–6 | **P**: scope, multilingual retrieval work, RAG and memory integration advanced materially | Turn resource safety and separation of runtime ownership remain open |
| M06 | May 26 Deep Student Program A–F | **D/P**: resource, projection, indexing, workspace, session, memory and export modules exist | The cross-owner commit/isolation defect prevents a blanket durability-complete claim |
| M07 | June 6 architecture alignment | **H** as a scheduling baseline | Its remaining obligations are represented by M01, M04, M10, M15 and this plan |
| M08 | June 10/17 workspace and DAG-answer contracts | **D** baseline | Graph-conditioned context is implemented; it is no longer a missing layer |
| M09 | June 18 final-review / June 20 workspace closure | **D/E**: release review, graph preview and shared interaction paths exist | Broader held-out answer quality and fresh native runtime acceptance remain open |
| M10 | July 5 RSE document-augmented RAG | **D** units 1–7; **E** unit 8 | Composer, trace and evidence ledger are implemented; representative corpus and runtime qualification remain open |
| M11 | July 11 coverage-driven graph-answer planning | **D** scoped plan | Keep the completed contract; broader quality calibration is a separate obligation |
| M12 | August 16 hardening and forward compatibility | **D/P**: auth unification, identity guards and file-write hardening landed | Ingest-only rollback is not whole-platform isolation; reopened by this audit |
| M13 | August 21 graph-conditioned context | **D** | Preserve deterministic ordering, provenance and evidence bounds |
| M14 | September 3 adaptive full-response budget | **P**: tiers, UI, report/RAG caps and serialization code exist | Deadline execution, source admission, SSE envelope and backpressure are not closed |
| M15 | Mobile Phase 13 and subsequent host/identity phases | **D/E/F**: compact projection, recovery journal, identity replay and release harness exist | Signed arm64 SAF/restart/RSS acceptance open; canonical public-ID cutover and mobile SQLite/WASM remain gated |
| M16 | Tauri migration / single window / mobile release routing | **D/E**: Tauri-first runtime and Tauri Android release owner exist | Fresh per-host packaging/interaction evidence; Capacitor retirement requires a consumer audit |
| M17 | Startup Plan B / WASM parity | **D/E**: warm snapshot, worker delta, parity and performance harnesses exist | Historical Windows and simulated cohorts do not establish current cross-device performance |
| M18 | Git LFS migration / sidecar supply | **P**: generated graph payload removal, bootstrap, build lock and content fingerprint exist | Five sidecar paths remain tracked; strict no-LFS delivery and clean bootstrap qualification remain incomplete |
| M19 | Fixrisk / foundation / release governance | **E** | FR-009 device evidence absent locally; fresh release-grade SQLite/ANN reports fail qualification |
| M20 | Task/TODO/implementation/walkthrough and bilingual navigation | **P**, reconciled by this audit | One status owner and paired updates are needed to stop completion drift; historical logs are not active task counts |

Important reclassifications:

1. RSE units 6 and 7 are no longer treated as missing implementation. Their broader corpus/runtime follow-up stays open in unit 8 and U8.
2. Adaptive budget checklists are synchronized across languages, but end-to-end safety is explicitly **partial**.
3. Bridge v2 is already declared: `PATH_BRIDGE_PROTOCOL_VERSION = '2.0'`, capability announcements and envelope validation exist. “Introduce Bridge v2” is obsolete; interoperability evidence is the remaining question.
4. Sequential graph matching already has a token candidate index. “Everything is still pairwise” is inaccurate; its `fuzzy` false negatives and the worker path's pairwise work need separate treatment.
5. Resource identity dual-read, move aliases and the versioned G4 corpus exist. Changing public IDs is still blocked; adding the gate is not completing the migration.
6. SQLite is a real desktop backend with explicit fallback. ANN connector execution and release thresholds exist. Neither should be described as mere scaffolding, nor as currently release-qualified.
7. There are 24 English/Chinese file pairs in `docs/en` and `docs/zh`, with no unmatched files. Pair presence alone does not prove semantic synchronization.

### Critical findings and implementation consequences

#### F1 — P0: ingest rollback can erase a concurrent acknowledged write

`src/learning/KnowledgeLearningPlatform.ts:858` queues only ingestion. It captures a whole-platform pre-image, mutates shared state, then awaits persistence; on failure it restores the whole pre-image. `addConversationMemory` and other snapshot-affecting writes do not participate in that queue. The probe confirms both uncommitted state visibility and acknowledged memory loss.

**Required direction:** put committed-state publication and all writes that share its rollback domain under one complete operation boundary. File-save serialization alone cannot establish isolation. Avoid a generic manager/facade around the same mutable maps. Inventory nested write calls first to avoid a reentrant queue deadlock. See U1.

#### F2 — P1: runtime governor metadata overstates execution safety

`src/learning/agentResponseBudget.ts:213` exports `applyRuntimeGovernor`, but current source references outside its definition are tests. `agentConversation` selects the budget, then query/RAG work proceeds without consuming its deadline. `evidenceContextAssembler.ts:1381` reads and expands documents before the final pack budget; `KnowledgeLearningPlatform.ts:6931` reads the complete source file without a byte-admission limit at that boundary.

Browser capability hints can select a tier; they are not proof of server memory availability. The report/source character limits do not bound total transient allocation, concurrent turns, or whole-document scanning.

**Required direction:** backend-owned admission, a turn-wide deadline/cancellation contract and bounded scan accounting before allocation. A timeout promise that leaves work running is insufficient. If scanning is incomplete, do not claim full-document conflict coverage. See U2.

#### F3 — P1: transport limits are incomplete and happen after allocation

`agentConversationSerialization.ts:174` stringifies the entire response before checking size, and the HTTP path serializes it again. At line 227 the SSE envelope is reconsidered only when the inner response was already truncated; the 1,998 → 2,094 byte probe crosses the limit without truncation. `server.ts:12703` ignores the return values of `res.write`.

**Required direction:** account for response, envelope and framing; project oversized diagnostic collections before serialization; enforce bounded drain/close behavior. When compacting, preserve citations for surviving public claims and recompute projected counts. Do not retain “fully evidenced” metadata after dropping all citations. See U3.

#### F4 — P1: indexed candidate selection changes matching semantics

`GraphBuilder.ts:484` filters source candidates by complete alphanumeric/CJK tokens before `checkMatch`. `fuzzy` is currently case-insensitive substring matching, so a matching term inside a larger token can be discarded before the matcher runs. The worker still invokes `checkMatch` for every source/target pair.

**Required direction:** candidate selection must be a conservative superset of actual matches. Restore semantic equivalence first; benchmark the indexing choice separately. Keep `exact-phrase` and `fuzzy` test cases distinct. See U4.

#### F5 — P1: green CI is weaker than the named gate

`package.json:104` defines `test:foundation:rollout-boundary` as an `echo "SKIP..."` command. `.github/workflows/migration-gates.yml:20` runs it as a suite. The 26 skipped Jest cases include request/error boundaries and capability parity; source-string introspection can silently disable tests after a valid refactor.

**Required direction:** exercise exported behavior and real request contracts; a required job must fail when its fixture or prerequisite is absent. Maintain an explicit, owned skip inventory. Test count growth is not an acceptance metric. See U5.

#### F6 — P1: release evidence is stale or of the wrong kind

At the explicit audit time, SQLite's latest local report is **223.3301 hours** old and ANN's is **231.6195 hours** old; policy allows **168 hours**. SQLite's latest report is `matrix`, while the release verifier requires `soak`. Older soak reports exist but are also stale; this is not a claim that soak was never implemented. ANN's fixture recall is 6/6 per mode/profile, not representative corpus recall.

`docs/mobile-evidence` is absent locally. The existing canonical-ID readiness report records `nativeDeviceEvidence=false` and `canonicalPublicIdCutover=blocked`.

**Required direction:** qualify the exact artifact and target host using fresh reports; bind source revision, artifact hash, workload and environment. Run device acceptance as an independent workstream. Do not weaken freshness or classify missing evidence as pass. See U7.

#### F7 — P2: file extraction has not completed ownership migration

Measured source sizes, including the terminal line: `server.ts` 17,042; `KnowledgeLearningPlatform.ts` 13,241; `workspace_panes.js` 10,273; `answerReleaseReview.ts` 6,752; `agent_workspace.js` 6,012.

The server constructs all seven domain classes with the same platform instance. Their interfaces still use many `any` types and return to platform operations. This can be a transitional instrumentation seam, but not a completed domain split. Registry dispatch defaults to `registry`; `STRICT_REGISTRY` is opt-in and its inline guards currently address NoteMD. Hard-coded terminal counts do not prove route parity.

**Required direction:** U1/U2 move actual invariants; U6 retires one covered route family at a time. Judge success by removed duplicate decisions and independent behavior tests, not line quotas. Do not blanket-extract the large frontend files or replace the UI framework during this closure.

### Strategic trade-offs

- **Learning outcomes can advance on the local backend.** The original “Phase 2 must wait for production ANN” dependency is too broad. Use the stable local/exact path for an outcome pilot; qualify ANN as an optional acceleration path.
- **More answer text is not stronger grounding.** Preserve slim/full product choice, but evaluate factual support, task coverage, omission and latency on held-out bilingual cases. Keep Water Glass as a regression, not the entire quality benchmark.
- **Atomic rename is not isolation.** Keep the useful file-store hardening while closing state publication and concurrent-write semantics.
- **Mobile parity is a capability contract.** The existing compact projection can be the mobile product. SQLite/WASM, Godot, models and desktop-sized payloads need a measured benefit before adoption.
- **Canonical IDs and storage replacement are conditional migrations.** Finish collision/alias/restart evidence before changing public keys. A path-derived URI alone is not rename-stable identity.
- **Do not reopen completed feature work as new architecture projects.** Bridge v2, graph conditioning, workspace registries and export already exist. Improve their failed boundary, not their naming or wrapper shape.
- **Avoid speculative refactoring.** Prefer a small complete operation with an explicit owner, characterization tests and a reversible commit. Preserve public schema and release support unless a migration is explicitly planned.

### Source-plan inventory

The inventory groups translations and historical trackers without treating them as separate deliverables. The detailed status is in M01–M20 above.

| Group | Reviewed planning sources |
|---|---|
| M01 | `docs/en/knowledge_mastery_evolution_plan.md`, its Chinese pair, and both Diataxis `knowledge-mastery-evolution-roadmap.md` pages |
| M02 | `docs/brainstorms/2026-04-11-evolution-progress-alignment-requirements.md`; `2026-04-12-agent-workspace-next-direction-requirements.md`; `2026-04-13-agent-workspace-architecture-progress-and-next-direction-requirements.md`; `2026-04-14-agent-workspace-contract-closure-next-direction-requirements.md` in the same directory |
| M03 | `docs/brainstorms/2026-04-13-markdown-reader-upgrade-alignment-requirements.md`; paired `agent-conversation-focus-mode-plan.md`; paired `godot-notemd-markdown-workflows.md` |
| M04 | `docs/solutions/cross-platform-architecture-refinement-2026-05-02.md`; `implementation-gap-analysis-2026-05-04.md`; `implementation-plan-2026-05-08.md`; `.trellis/workspace/Jacobinwwey/development-plan-2026-04-27.md` |
| M05 | `docs/brainstorms/2026-05-25-multiplatform-lightweight-rag-agent-architecture-plan.md` |
| M06 | `docs/brainstorms/2026-05-26-deep-student-comparison-next-phase-plan.md` |
| M07–M09 | `docs/solutions/architecture-progress-alignment-2026-06-06.md`; `knowledge-workspace-dag-alignment-2026-06-10.md`; `agent-knowledge-dag-answer-contract-plan-2026-06-17.md`; `agent-final-reply-review-robustness-plan-2026-06-18.md`; `agent-knowledge-workspace-graph-preview-and-review-closure-2026-06-20.md` |
| M10–M11 | `docs/plans/2026-07-05-001-feat-rse-document-augmented-rag-plan.md`; `2026-07-11-coverage-driven-graph-answer-planning.md` |
| M12–M14 | `docs/solutions/architecture-hardening-forward-compatibility-2026-08-16.md`; `docs/superpowers/plans/2026-08-16-architecture-hardening-forward-compatibility.md`; `2026-08-21-graph-conditioned-context.md`; `2026-09-03-full-response-adaptive-budget-plan.md`; `docs/superpowers/specs/2026-09-03-full-response-adaptive-budget-design.md` |
| M15 | `docs/solutions/mobile-cross-host-forward-compatibility-phase13-2026-08-18.md`; later identity, recovery and mobile phases in the August hardening note |
| M16 | Paired `single_window_migration_plan.md`, `tauri_brainstorming.md`, `tauri_tasks.md`, `multi_platform_build_flow_audit.md`; `docs/tauri_tasks.md` and `docs/tauri_brainstorming.md` |
| M17 | Paired Diataxis `startup-node-update-acceleration-plan.md`; WASM sections in `implementation_plan.md` and its language mirrors |
| M18 | Paired `lfs_asset_migration_plan.md`, `sidecar_supply_strategy.md`; Diataxis `git-lfs-asset-migration.md` and `sidecar-supply-feasibility.md` |
| M19 | Paired `fixrisk_TODO.md`; foundation evidence scripts; migration/release/fixrisk workflows |
| M20 / history | Root and paired `task.md`, `TODO.md`, `implementation_plan.md`, `walkthrough.md`, `brainstorming.md`; `docs/open_goal_audit_2026-05-10.md`; `docs/archive/TODO.*.md` |
| Reference decisions, not new commitments | DeepTutor reuse analysis/assessment, MemOS reuse assessment, Electron migration analysis and `docs/solutions/documentation-gaps/learning-platform-api-workbench-contract-gap-2026-04-02.md` |

<a id="chinese"></a>

## 中文

### 结论与范围

项目已具备较完整的功能实现，但**状态隔离、端到端资源约束和发布验收仍未闭环**。下一轮应先关闭这些契约，再扩展回答 profile、基础设施和平台变体。

审计基线：本地 `main`，提交 `e84d6ece`（2026-09-03），版本 `1.8.0`；审计日期 2026-09-12。本轮检查代码与文档，执行新鲜测试，并对生产函数做合成边界探针。未重新验收远端 CI、新打包桌面应用、浏览器/Godot 交互或 Android 真机；未修改生产实现。

本页负责各计划的当前状态，[推进计划](../plans/2026-09-12-001-refactor-project-convergence-plan.md)负责下一批实施单元。旧 Task、walkthrough 和日期化完成记录保留为历史证据，未勾选项不自动成为当前 backlog。

状态定义：

- **D — 实现基线成立**：代码与相关测试存在，不等同于发布或用户成效验收。
- **P — 部分完成**：必要实现不变量尚未成立，或已复现缺陷使完成结论重新打开。
- **E — 验收证据未闭环**：已有实现/工具，但缺少所需的新鲜运行时、设备、规模或成效证据。
- **F — 条件性暂缓**：有明确触发条件的方向，不是交付承诺。
- **H — 历史计划**：已由后续工作吸收，保留追溯。

不计算总完成率。历史重复任务、双语翻译、编码步骤和运维门禁的分母不同，合并百分比会误导决策。

### 本轮验证

| 检查 | 结果 | 证明范围 |
|---|---|---|
| TypeScript | `tsc --noEmit --incremental false` 通过 | 本机 Node `22.19.0` 下当前源码类型检查通过 |
| 全量 Jest | **159 suites，1,419 passed，26 skipped，0 failed**；总计 1,445 cases | 现有自动化基线通过，耗时约 178 秒 |
| 文档验证 | 最终 Diataxis：18 entries、36 language paths、68 canonical refs；MkDocs build 通过；检查 140 个新增链接 | 新页面、锚点及双语分节有效，不证明产品验收 |
| 序列化探针 | 原响应 **1,998 bytes**，completed-event JSON **2,094 bytes**，合成预算 **2,000 bytes**，仍为 `truncated=false` | 复现 SSE envelope 计量缺口 |
| 图匹配探针 | `fuzzy` 下 `cat/concatenate`、`知识/知识图谱` 均被 `checkMatch` 接受，顺序路径却不产出边 | 顺序候选过滤与 worker 匹配语义不等价 |
| 摄入隔离探针 | 失败提交前可见 2 个文档；并发 memory 返回 `added=true`；回滚后只剩 1 个文档、**0 条 memory** | 复现未提交状态可见，以及已确认并发写入丢失 |
| Foundation release evaluator | 显式审计时点 `2026-09-12T00:00:00Z` 返回 `ok=false` | 当前本地报告不满足发布资格 |

摄入探针使用真实 `KnowledgeLearningPlatform` 与注入的串行保存内存 store，并让一次 ingest 写入失败；它证明平台层并发缺陷，不是设备/文件系统故障实测。SSE 探针刻意使用较小的内部测试预算，证明边界计算错误，不代表已经测得生产内存事故。

26 个跳过用例集中在两处：`src/server.migration.test.ts` 13 个、`src/agent_workspace.contract.parity.test.ts` 13 个。部分 parity 用例会在源码字符串 marker 消失时自动 skip，因此绿灯不能证明对应请求、构建、剪贴板、scope 或 capability 契约。

本地可复现证据：

- `output/project-audit-2026-09-12/jest-results.json`、`jest.log`。
- `output/project-audit-2026-09-12/boundary-probes.cjs` / `boundary-probes.json`。
- `output/project-audit-2026-09-12/ingest-isolation-probe.cjs` / `ingest-isolation-probe.json`。
- `output/project-audit-2026-09-12/foundation-release-evidence.json`。
- 入库的简要记录：[audit evidence](2026-09-12-project-progress-evidence.json)。

上述 `output/` 文件是被 Git 忽略的本地诊断产物，不是持久的发布证明。在仓库根目录执行 `rtk proxy node output/project-audit-2026-09-12/boundary-probes.cjs` 与 `rtk proxy node output/project-audit-2026-09-12/ingest-isolation-probe.cjs` 可重放两个探针。

### 各计划的完成边界

| ID | 计划族 | 当前重定级 | 剩余完成条件 |
|---|---|---|---|
| M01 | 知识掌握演进，L0–L5 / Phase 1–3 | **P/E**：atom/evidence、检索、mastery、tutor、memory 机制存在 | API 测试不能证明学习增益、误区复发下降与路径优越性 |
| M02 | 4 月 Agent Workspace 对齐 / v1–v6 契约 | **D/P**：scope action、诊断、契约及运行路径已实现 | domain 所有权和真实 parity 覆盖仍不完整 |
| M03 | Markdown Reader / NoteMD 升级 | **D/E**：共享富渲染、Mermaid 修复、NoteMD 操作已存在 | 当前 browser/Tauri/Godot 交互验收需独立验证 |
| M04 | 5 月跨平台优化 / 单体拆分 / Phase 4 | **P**：registry、domain 文件、ES module 已存在 | 旧路由副本与 domain 反向委托仍集中业务责任 |
| M05 | 5 月 25 日轻量 RAG / agent Phase 0–6 | **P**：scope、多语言检索、RAG、memory 集成已有实质进展 | turn 资源安全和 runtime 责任拆分仍未闭环 |
| M06 | 5 月 26 日 Deep Student Program A–F | **D/P**：资源、projection、indexing、workspace、session、memory、export 均有实现 | 跨 owner 提交/隔离缺陷使“耐久性整体完成”不成立 |
| M07 | 6 月 6 日主线架构对齐 | 排期基线为 **H** | 剩余义务已归入 M01、M04、M10、M15 与本计划 |
| M08 | 6 月 10/17 日 workspace 与 DAG 回答契约 | **D** 基线 | graph-conditioned context 已实现，不应继续列为缺失层 |
| M09 | 6 月 18 日最终审核 / 6 月 20 日工作区收口 | **D/E**：release review、图预览、共享交互路径已存在 | 独立留出语料质量与新鲜原生交互验收仍开放 |
| M10 | 7 月 5 日 RSE 文档增强 RAG | 单元 1–7 为 **D**；单元 8 为 **E** | composer、trace、evidence ledger 已实现；代表性语料及 runtime 验收未闭环 |
| M11 | 7 月 11 日 coverage-driven graph-answer plan | 有限范围内 **D** | 保留已完成契约，广泛质量校准独立推进 |
| M12 | 8 月 16 日架构加固与向前兼容 | **D/P**：认证收敛、identity guard、文件写入加固已落地 | 仅 ingest 串行化不足以保证整个平台隔离，本轮重新打开 |
| M13 | 8 月 21 日图条件上下文 | **D** | 保持确定性排序、provenance 与证据预算 |
| M14 | 9 月 3 日 adaptive full-response budget | **P**：档位、UI、报告/RAG cap、序列化代码存在 | deadline 执行、源读取准入、SSE envelope 与背压未闭环 |
| M15 | 移动 Phase 13 及后续 host/identity 阶段 | **D/E/F**：compact projection、恢复 journal、identity replay、release harness 已实现 | signed arm64 SAF/restart/RSS 未验收；canonical public-ID 与移动 SQLite/WASM 继续受门禁约束 |
| M16 | Tauri 迁移 / 单窗口 / 移动发布归属 | **D/E**：Tauri-first runtime 与 Tauri Android 发布主入口成立 | 新鲜跨宿主打包/交互证据；移除 Capacitor 前需审计消费者 |
| M17 | Startup Plan B / WASM parity | **D/E**：warm snapshot、worker delta、parity 与性能工具存在 | 历史 Windows 和模拟 cohort 不能证明当前跨设备性能 |
| M18 | Git LFS 迁移 / sidecar 供给 | **P**：默认图 payload 清理、bootstrap、build lock、内容指纹已实现 | 仍有 5 个 sidecar 路径被跟踪；严格 no-LFS 与干净环境引导未闭环 |
| M19 | Fixrisk / foundation / release governance | **E** | 本地缺少 FR-009 真机证据；当前 SQLite/ANN release qualification 不通过 |
| M20 | Task/TODO/implementation/walkthrough 与双语导航 | **P**，本轮完成事实对齐 | 需维持单一状态入口和双语同步；历史日志不能作为活跃任务计数 |

关键纠偏：

1. RSE 单元 6/7 不再列为“未实现”；更广语料/runtime 义务保留在单元 8 和 U8。
2. Adaptive budget 双语 checklist 同步，但端到端安全明确标为**部分完成**。
3. Bridge v2 已有 `PATH_BRIDGE_PROTOCOL_VERSION = '2.0'`、capability 公告及 envelope 校验；不应重新规划“引入 v2”，应验证互操作。
4. 顺序图匹配已经建立 token 候选索引；“所有路径仍为两两扫描”不准确。其 fuzzy 漏边与 worker 的两两匹配成本应分别处理。
5. identity dual-read、move alias 与版本化 G4 corpus 已存在；公共 ID 切换仍阻断，不能把“门禁已加”写成“迁移已完成”。
6. SQLite 已是真实桌面后端并有显式 fallback；ANN connector 执行与发布阈值也存在。不能再称为纯脚手架，也不能称为当前已发布验收。
7. `docs/en` 与 `docs/zh` 均为 24 个文件、24 对、无 unmatched；文件配对不代表语义同步。

### 关键发现及实施含义

#### F1 — P0：摄入回滚可能抹掉已确认的并发写入

`KnowledgeLearningPlatform.ts:858` 只串行化 ingest。它先捕获整个平台的 pre-image，再修改共享状态并等待持久化；失败后恢复整个 pre-image。`addConversationMemory` 及其他会改变 snapshot 的写操作不在该队列内。探针已复现提交前可见状态，以及已确认 memory 丢失。

**推进方向：**将 committed-state 发布与共享回滚域的写入收归一个完整操作边界。仅串行化文件保存无法保证隔离。不要在同一组可变 Map 外再套 manager/facade；先盘点嵌套写调用，避免可重入队列死锁。对应 U1。

#### F2 — P1：runtime governor 元数据超出了实际执行保障

`agentResponseBudget.ts:213` 的 `applyRuntimeGovernor` 在当前源码中仅被测试调用。`agentConversation` 选择预算后，query/RAG 并未消费该 deadline。`evidenceContextAssembler.ts:1381` 先读文档并扩展片段，再裁剪最终 pack；`KnowledgeLearningPlatform.ts:6931` 的整文件读取边界没有字节准入限制。

浏览器 capability hint 可选择档位，但不能证明服务端可用内存；report/source 字符上限也不能约束瞬时分配、并发 turn 总量与全文扫描。

**推进方向：**在分配前执行后端拥有的准入、贯穿 turn 的 deadline/cancellation 与扫描计量。单纯 timeout promise 而后台继续运行不成立；扫描未完成时，不得声称已完成全文冲突检查。对应 U2。

#### F3 — P1：transport 限制未覆盖 envelope，且位于分配之后

`agentConversationSerialization.ts:174` 先完整 stringify 再判断大小，HTTP 路径又序列化一次；第 227 行仅在内部 response 已截断时才重新检查 SSE envelope，导致 1,998 → 2,094 字节越界却未标记。`server.ts:12703` 忽略 `res.write` 返回值。

**推进方向：**计入 response、envelope 和 framing；序列化前投影过大的诊断集合；限制 drain/close 等待与缓冲。压缩后需保留存活 claim 的引用并重新计算计数，不能清空 citations 后仍保留“完全有证据”的元数据。对应 U3。

#### F4 — P1：候选索引改变了匹配语义

`GraphBuilder.ts:484` 以完整 alphanumeric/CJK token 过滤 source，再执行 `checkMatch`。而 `fuzzy` 实际是忽略大小写的子串匹配，嵌在更长 token 中的合法匹配会提前被丢弃。worker 仍逐个 source/target 调用 `checkMatch`。

**推进方向：**候选集必须是实际命中的保守超集。先恢复语义等价，再独立比较索引性能；分别覆盖 `exact-phrase` 与 `fuzzy`。对应 U4。

#### F5 — P1：CI 绿灯弱于门禁名称承诺

`package.json:104` 的 `test:foundation:rollout-boundary` 仅执行 `echo "SKIP..."`，但 `.github/workflows/migration-gates.yml:20` 将其作为 suite。26 个跳过项包含请求/异常边界及 capability parity；源码字符串探测可能在正常重构后静默停测。

**推进方向：**验证导出行为与真实请求契约；必要 fixture/前提缺失应使 required job 失败。显式维护有 owner 的 skip 清单，不把测试数量增长当成验收指标。对应 U5。

#### F6 — P1：发布证据过期或类型不符

在显式审计时点，SQLite 最新本地报告已 **223.3301 小时**，ANN 为 **231.6195 小时**，超过 **168 小时**策略；SQLite 最新报告是 `matrix`，发布要求 `soak`。旧 soak 报告存在，但也已过期，并非从未实现 soak。ANN fixture 每个 mode/profile 的 recall 为 6/6，不能解释为代表性语料召回率。

本地不存在 `docs/mobile-evidence`；现有 canonical-ID readiness 报告明确为 `nativeDeviceEvidence=false`、`canonicalPublicIdCutover=blocked`。

**推进方向：**针对确定 artifact/host 取得新鲜证据，绑定源码 revision、artifact hash、workload、环境。设备验收单独推进；不降低 freshness，也不把缺证据写成通过。对应 U7。

#### F7 — P2：文件拆分未完成责任迁移

源码行数测量包含结尾空行：`server.ts` 17,042；`KnowledgeLearningPlatform.ts` 13,241；`workspace_panes.js` 10,273；`answerReleaseReview.ts` 6,752；`agent_workspace.js` 6,012。

server 用同一个 platform 实例构造 7 个 domain 类；接口仍大量使用 `any`，业务操作仍回调平台。它可以是过渡性的诊断接缝，但不能称为完成的 domain 拆分。registry dispatch 默认已经是 `registry`；`STRICT_REGISTRY` 仍需 opt-in，inline guard 当前针对 NoteMD。硬编码 terminal 数量不能证明路由等价。

**推进方向：**U1/U2 迁移真实不变量，U6 每次收敛一个已覆盖路由族。以重复决策消失和独立行为测试成立验收，不设武断行数指标；本轮收口不开展全量前端拆分或 UI 框架替换。

### 战略取舍

- **学习成效可先基于本地后端推进。**原“Phase 2 必须等待生产 ANN”的依赖过宽。稳定 local/exact 路径可开展成效试验，ANN 独立作为可选加速路径验收。
- **回答更长不等于 grounding 更好。**保留 slim/full 产品选择，以独立中英留出集评估事实支撑、任务覆盖、遗漏和时延。Water Glass 保留为回归，不承担全部质量基准。
- **原子 rename 不等于 isolation。**保留文件 store 加固，同时修复状态发布和并发写语义。
- **移动 parity 应落在 capability 契约。**已有 compact projection 可以承担移动产品；SQLite/WASM、Godot、模型和桌面级 payload 必须先证明增益。
- **Canonical ID 与存储替换都是条件迁移。**先完成 collision/alias/restart 证据，再改公共 key；路径派生 URI 本身不保证 rename 稳定。
- **已完成能力不要重开成新架构工程。**Bridge v2、graph conditioning、workspace registry、export 已存在；修复失败边界，不重复命名或套壳。
- **避免推测性重构。**优先完整的小操作、明确 owner、特征测试与可回退提交；公共 schema 和支持范围变更需明确迁移。

### 源计划覆盖

下表将翻译与历史 tracker 合并为计划族，当前状态见 M01–M20。

| 分组 | 已审阅的计划来源 |
|---|---|
| M01 | `docs/en/knowledge_mastery_evolution_plan.md` 及中文对应；双语 Diataxis `knowledge-mastery-evolution-roadmap.md` |
| M02 | `docs/brainstorms/2026-04-11-evolution-progress-alignment-requirements.md`；同目录 `2026-04-12-agent-workspace-next-direction-requirements.md`、`2026-04-13-agent-workspace-architecture-progress-and-next-direction-requirements.md`、`2026-04-14-agent-workspace-contract-closure-next-direction-requirements.md` |
| M03 | `docs/brainstorms/2026-04-13-markdown-reader-upgrade-alignment-requirements.md`；双语 `agent-conversation-focus-mode-plan.md`、`godot-notemd-markdown-workflows.md` |
| M04 | `docs/solutions/cross-platform-architecture-refinement-2026-05-02.md`、`implementation-gap-analysis-2026-05-04.md`、`implementation-plan-2026-05-08.md`；`.trellis/workspace/Jacobinwwey/development-plan-2026-04-27.md` |
| M05 | `docs/brainstorms/2026-05-25-multiplatform-lightweight-rag-agent-architecture-plan.md` |
| M06 | `docs/brainstorms/2026-05-26-deep-student-comparison-next-phase-plan.md` |
| M07–M09 | `docs/solutions/architecture-progress-alignment-2026-06-06.md`、`knowledge-workspace-dag-alignment-2026-06-10.md`、`agent-knowledge-dag-answer-contract-plan-2026-06-17.md`、`agent-final-reply-review-robustness-plan-2026-06-18.md`、`agent-knowledge-workspace-graph-preview-and-review-closure-2026-06-20.md` |
| M10–M11 | `docs/plans/2026-07-05-001-feat-rse-document-augmented-rag-plan.md`、`2026-07-11-coverage-driven-graph-answer-planning.md` |
| M12–M14 | `docs/solutions/architecture-hardening-forward-compatibility-2026-08-16.md`；`docs/superpowers/plans/2026-08-16-architecture-hardening-forward-compatibility.md`、`2026-08-21-graph-conditioned-context.md`、`2026-09-03-full-response-adaptive-budget-plan.md`；`docs/superpowers/specs/2026-09-03-full-response-adaptive-budget-design.md` |
| M15 | `docs/solutions/mobile-cross-host-forward-compatibility-phase13-2026-08-18.md`；8 月 hardening 文档中的后续 identity/recovery/mobile 阶段 |
| M16 | 双语 `single_window_migration_plan.md`、`tauri_brainstorming.md`、`tauri_tasks.md`、`multi_platform_build_flow_audit.md`；`docs/tauri_tasks.md`、`docs/tauri_brainstorming.md` |
| M17 | 双语 Diataxis `startup-node-update-acceleration-plan.md`；根 `implementation_plan.md` 及镜像中的 WASM 章节 |
| M18 | 双语 `lfs_asset_migration_plan.md`、`sidecar_supply_strategy.md`；Diataxis `git-lfs-asset-migration.md`、`sidecar-supply-feasibility.md` |
| M19 | 双语 `fixrisk_TODO.md`；foundation evidence scripts；migration/release/fixrisk workflows |
| M20 / 历史 | 根目录及双语 `task.md`、`TODO.md`、`implementation_plan.md`、`walkthrough.md`、`brainstorming.md`；`docs/open_goal_audit_2026-05-10.md`；`docs/archive/TODO.*.md` |
| 参考决策，不生成新承诺 | DeepTutor reuse analysis/assessment、MemOS reuse assessment、Electron migration analysis、`docs/solutions/documentation-gaps/learning-platform-api-workbench-contract-gap-2026-04-02.md` |
