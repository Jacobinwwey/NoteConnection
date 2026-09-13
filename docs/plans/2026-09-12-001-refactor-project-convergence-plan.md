---
title: "refactor: Close state, runtime, and release contracts"
type: refactor
status: partial_acceptance
date: 2026-09-12
updated: 2026-09-14
origin: docs/audits/2026-09-12-project-progress.md
source_revision: e84d6ece9cce5b82902d4b9335ac096a136a8d2a
implementation_revision: e4cdce27c55dbb19f0ba6b4405358661c12d8821
---

# Project Convergence Implementation Plan / 项目收敛实施计划

## English

### Acceptance checkpoint — 2026-09-14

U1–U6 remain accepted. The public-evidence and configured-workspace follow-ups pass 168 suites / 1,708 tests on each of Node 22.19.0 and 24.14.0, with zero skips. V1–V6 final regressions pass with the initial confirmation history retained. A real Windows development session verifies an external workspace, Bridge layout, Tauri/Godot visibility transitions, grounded answer and clean shutdown; it first exposed and then verified the selected-root fix. Final artifact and remote qualification are tracked in the [September 14 follow-up](../evaluations/2026-09-14-public-evidence-quality-results.md). U7/U8 retain overall partial acceptance for unqualified targets and consented learner outcomes. Earlier slice counts below are historical implementation checkpoints.

### Outcome and constraints

Deliver a local-first knowledge/learning runtime whose acknowledged writes survive unrelated failures, whose answer work is bounded before allocation, and whose release claims are backed by target-specific evidence.

This plan follows the [2026-09-12 audit](../audits/2026-09-12-project-progress.md). That documentation audit was the baseline: its three production-code probes exposed gaps outside the passing test coverage. The acceptance checkpoint above records the subsequent implementation and verification.

Requirements:

- **R1:** failed ingestion cannot erase acknowledged memory/session/workspace changes; public reads do not present uncommitted state as committed.
- **R2:** one backend-owned resource contract covers source access, graph/RAG work, composition and delivery; cancellation stops work.
- **R3:** JSON, SSE and replay preserve the same released answer, surviving citations and truthful truncation metadata.
- **R4:** optimization preserves exact matching semantics across sequential and worker execution.
- **R5:** required CI gates execute real assertions and fail when necessary evidence is absent.
- **R6:** architecture work transfers ownership of invariants and removes duplicate decisions.
- **R7:** release readiness is evaluated separately for desktop, mobile and optional backends.
- **R8:** learning/answer quality is measured on independent evidence, not inferred from feature completion.

Keep public IDs, snapshot/projection schemas, slim/full defaults, mobile compact projection and Bridge v2 compatibility. Godot consumes supported raster materializations; do not add direct SVG imports. Do not add a new graph database, orchestration framework, generic service layer, replacement UI framework, or public-ID migration to this work.

Validate untrusted input at the owning edge. Internal code should consume that invariant rather than repeat checks. Do not replace mode flags with enums/options/strategies just to relocate the branch. A new module must own a complete operation, an invariant, or an external dependency.

### Sequence and capacity

Assume one experienced maintainer. Use acceptance gates rather than fixed calendar promises:

| Wave | Work | Exit criterion |
|---|---|---|
| A — correctness containment | U1; then U2/U3; U4 and the minimum U5 regressions | All three audit probes become permanent failing-before/fixed-after regressions; deadline and slow-client failures are observable |
| B — contract and ownership closure | Complete U5, then U6 | Required jobs actually assert behavior; one route family has one implementation and an isolated parity test |
| C — qualify and evaluate | U7 per target; U8 on the stable local backend | Fresh artifact evidence for each promoted target; a reproducible quality baseline with explicit uncertainty |

Waves A and B are several engineering iterations, not a guaranteed “two-week cleanup.” U1 scope depends on the shared-writer inventory. Device procurement/signing, multi-host access, and learner outcome collection are external elapsed-time dependencies; do not hide them in coding estimates. Native evidence collection may proceed independently of route cleanup. Keep only one high-risk state/transport change under implementation per maintainer.

### U1 — committed-state publication and cross-operation isolation

- [x] **U1 / P0 — close F1; R1, R6**

**Owner/files:** `src/learning/KnowledgeLearningPlatform.ts`; `src/learning/store.ts` only if the persistence contract requires it. Tests: `src/learning/KnowledgeLearningPlatform.persistence.test.ts`, `src/learning/KnowledgeLearningPlatform.test.ts`.

**Decision:** the existing snapshot state owner must govern a complete commit. Inventory ingest, memory, session, workflow and workspace writers that share that snapshot. Reuse the versioned snapshot format; keep candidate state separate from the committed read view and publish it only after persistence succeeds. Serialize conflicting logical writes at that owner, not merely at `saveSnapshot`.

A first bounded implementation can trade write concurrency for correctness. A later journal/delta design is conditional on measured clone cost. Do not introduce full event sourcing or copy the platform behind a facade. If changing the committed read view requires a public async contract change, stage an additive compatibility boundary before implementation.

**Pitfalls:** locking only persistence is too late; whole-snapshot rollback can overwrite unrelated work; nested public write operations can deadlock a non-reentrant queue; multiple platform instances/processes remain a distinct storage coordination problem. Document the supported single-writer topology rather than claiming distributed isolation.

**Tests:**

- Pause/fail ingest persistence, concurrently add memory, and verify that a success acknowledgement implies the entry survives and survives reopen.
- During a paused ingest, read state/query/export and verify they observe one committed revision.
- Mixed move/upsert/delete collision preserves old aliases and every resource/workspace/index owner.
- Queue a second write after failure; it executes once, with no deadlock or ID reuse.
- Inject rollback/commit failures and verify the response is an error with recoverable prior state.
- Measure clone/commit peak allocation on small and representative large snapshots.

**Acceptance:** the audit's acknowledged-memory-loss and dirty-read scenarios no longer reproduce; existing identity/persistence suites pass. Dependencies: none.

### U2 — request admission, deadline and cancellation across answer work

Implementation checkpoint: one host-owned execution scope now bounds queued turns, source bytes/lines/facts and fragments. File reads check both stat and chunk bytes and close descriptors on abort. Query cancellation reaches vector HTTP and retry delay; local scoring yields every 128 candidates. Client hints cannot raise the host ceiling. Execution/budget/backend/adapter regressions pass 65 tests; the broader persistence/composition/RAG set passes 117 tests. Delivery cancellation and calibration follow in U3/U7. These are cooperative admission controls, not an OS RSS guarantee; a provider that ignores AbortSignal retains the state lease until it settles.

- [x] **U2 / P1 — close F2; R2, R3**

**Implemented owners:** `src/learning/agentConversationExecution.ts`, `src/learning/agentResponseBudget.ts`, `src/learning/evidenceContextAssembler.ts`, `src/learning/KnowledgeLearningPlatform.ts`; provider cancellation in `queryBackend.ts`, `vectorAccelerationAdapter.ts` and `ragSufficiencyReview.ts`. Execution, platform, backend and composer tests cover these boundaries.

**Decision:** choose a finite server ceiling independently of browser hints; client capability/preferences may only select within it. Start one deadline at the turn boundary and pass cancellation and cumulative source/fragment accounting to the operations that perform work. Bound document reads before allocation and during reading so a changing file cannot bypass a stat-only check. Count concurrent admission separately from per-response size.

Keep the existing full-document evidence contract honest: either finish the admitted scan or mark it incomplete. A source cap must not silently convert an incomplete conflict scan into `full_document/read` with sufficient evidence. Prefer bounded streaming/section iteration where the parser supports it; add worker isolation only if synchronous CPU work cannot honor cancellation.

**Tests:**

- Delayed source resolution exceeds the turn deadline; no later stage or background write continues.
- Cancellation during query, source read and assembly stops subsequent work and yields one terminal outcome.
- Oversized/growing source and many individually valid sources exceed cumulative admission before unbounded allocation.
- Forged high-memory hints cannot raise the host ceiling; missing hints remain conservative.
- Mobile compact remains slim and does not perform desktop-sized retrieval.
- Incomplete scan retains usable evidence while declaring incomplete coverage.

**Acceptance:** timeout fields are consumed by production execution, not only unit-tested as a pure predicate; resource-stop reasons are consistent in response/trace. Before promotion, record finite per-source bytes, cumulative source bytes, admitted concurrent turns and cancellation-latency limits for each host, backed by measured peak allocation. These numeric admission thresholds are implementation-time calibration, not browser-selected values. Dependencies: U1 for turns that write memory; pure budget/source tests can begin earlier.

### U3 — complete wire-size accounting and bounded SSE delivery

Implementation checkpoint: bounded JSON measurement precedes serialization; one released projection reserves complete framing for HTTP/SSE/replay, preserves bounded citations and clears obsolete coverage. The stream writer bounds bytes/event count and handles drain/close/error/timeout. Cached turns share cancellation and stop when their final consumer leaves; source hydration now shares the turn deadline/accounting. Transport/platform/NoteMD/frontend runtime tests pass 80 tests; seven targeted HTTP conversation cases pass, including a real disconnect with failure replay. Restored migration tests exposed pre-existing registry interception defects, tracked in U5.

- [x] **U3 / P1 — close F3; R2, R3**

**Implemented owners:** `src/learning/agentConversationSerialization.ts`, `src/middleware/SseResponseWriter.ts`, `src/server.ts`. Serialization/stream unit tests and real HTTP/frontend integration tests cover framing, drain and shared-consumer cancellation.

**Decision:** the transport owner accounts for the entire emitted unit, including envelope and SSE framing. Compact diagnostic collections before serializing large objects. Produce one released response projection reused by JSON, live SSE and replay; preserve a bounded citation set for the surviving answer and derive summary counts from that projection.

Handle `write() === false` through a bounded queue/drain lifecycle with close/error/deadline cancellation. A shared writer affects NoteMD too: preserve its event contract and add a transport-level regression rather than scattering wait logic through event emitters.

**Tests:**

- Response fits but envelope does not; both JSON and SSE stay within the limit and report truncation.
- Count UTF-8 bytes for CJK/emoji, escaping and multiline payloads; test just-below/equal/above limits.
- Slow or disconnected consumer cannot grow pending buffers indefinitely; one completion or cancellation event wins.
- Oversized trace/citation collections are bounded before full serialization.
- Retained Markdown/math is balanced; retained claims keep valid citations; counts and coverage are recomputed.
- Same turn through JSON/live SSE/replay has identical released content and profile isolation.

**Acceptance:** the audit's 1,998 → 2,094 byte counterexample is covered and fixed; no large initial stringify is relied on as a memory guard. Dependencies: U2 defines the authoritative budget; the envelope regression can land first.

### U4 — preserve matching semantics before further graph optimization

- [x] **U4 / P1 — close F4; R4**

Implemented: exact-phrase candidates use the matcher's ASCII word boundaries; fuzzy matching uses the complete candidate set. Differential regressions cover mixed Chinese/ASCII, substrings, punctuation, exclusions and both actual worker input modes. Matching, identity and PathEngine suites passed 11 tests. This keeps fuzzy's worst-case scan cost explicit.

**Owner/files:** `src/backend/GraphBuilder.ts`, `src/backend/workers/keywordMatchWorker.ts`, `src/backend/utils/stringUtils.ts` only if shared semantics need an explicit contract. Create `src/backend/GraphBuilder.matching.test.ts`; retain `src/backend/GraphBuilder.identity.test.ts` and `src/core/PathEngine.test.ts`.

**Decision:** candidate indexing must not exclude a valid matcher result. The smallest safe fallback for unsupported fuzzy indexing is the existing complete candidate scan, with its performance cost explicit. Evaluate substring-aware indexing only after the parity corpus exists. Avoid a simultaneous matching-language redesign.

**Tests:** English substring, Chinese substring, Unicode/case, punctuation-only titles, exclusions, self-match, exact-phrase boundaries, file-path versus content worker payloads, and worker fallback produce the same edge set. Check direction/provenance and identity aliases.

**Acceptance:** sequential/worker edges match the reference matcher on the corpus; benchmark candidate counts and p95 separately. Worst-case common-token/fallback work may remain quadratic; more workers do not change that. Dependencies: none.

### U5 — make named CI gates prove their contracts

Implementation checkpoint: all 13 skipped HTTP obligations now execute and pass after removing incomplete data/diagnostic/clipboard/Graphviz registry copies. Native clipboard, filesystem resolution and build admission remain at their complete server owner. Graph rebuild preserves its requested recompute policy, now covered through HTTP. The 13 skipped capability obligations were replaced by runtime registry/emission tests against exported typed contracts; context-dependent artifact presenters are checked at their supported registry rather than required in every conversation. The echo gate now runs SQLite/readiness/backend/evidence assertions. A missing turn-cache durability test was restored, and its HTTP diagnostics now read the actual cache instead of placeholder platform counters. Combined verification: 84 tests, zero skipped. Node support is declared as 22.19+ or 24.x, with both CI lanes for convergence regressions.

- [x] **U5 / P1 — close F5; R5, R7**

**Owner/files:** `package.json`, `.github/workflows/migration-gates.yml`, `src/server.migration.test.ts`, `src/agent_workspace.contract.parity.test.ts`. Use `src/foundation.release.evidence.contract.test.ts`; create `src/foundation.rollout.boundary.test.ts` for actual rollout behavior if the old suite no longer exists.

**Decision:** replace the successful echo with executable assertions. Replace source-text marker discovery with exported capability contracts and observable execution. Re-enable or replace the 26 skips according to whether the underlying behavior is still supported; a retired case needs an explicit successor/reason, not silent disappearance.

Pin and document the supported Node matrix. Current local evidence is Node 22.19.0; CI declares Node 24. Legacy “Node 20” prose is not compatibility evidence for the SQLite/Vite runtime.

**Tests:** supported/unsupported capability, backend unavailable/fallback, stale or missing evidence, malformed/oversized request, scope/path rejection, build deduplication/conflict, clipboard type/size, and live/replay parity. Required fixtures missing → failed job; optional target unavailable → explicitly non-qualified target.

**Acceptance:** no required job passes by emitting SKIP; all original skipped obligations are executed, replaced by behavioral checks, or explicitly retired with justification. CI runs the U1–U4 regressions. Dependencies: regression cases can land with their fixes; complete after U1–U4.

### U6 — converge one route family and its operation ownership

Implementation checkpoint: 10 matching behavior cases passed independently against legacy and registry before deletion (raw JSON: `output/project-convergence-2026-09-12/notemd-{legacy,registry}-parity.json`). The 20 legacy NoteMD handlers and their operation/workspace helpers have been removed from server.ts. Registry now owns operation admission, IDs, cancellation, workspace updates and existing PUT aliases; request parsing, canonical filesystem access and SSE delivery retain shared boundaries. Additional HTTP tests cover auth, unknown routes, batch/workflow path rejection, ID conflicts and cancellation. Four suites pass 71 tests, zero skips. Telemetry separates intentional server-owned handling from registry misses instead of claiming seven inline routes by constant.

- [x] **U6 / P1 — advance M04; R5, R6**

**Owner/files:** first `src/routes/notemd.ts`, `src/server.ts`, `src/routes/types.ts`; existing `scripts/verify-route-registry-shadow.js`, `src/routes/registry.shadow.contract.test.ts`, `src/notemd.server.integration.test.ts`.

**Decision:** begin with the covered NoteMD family. Compare legacy and registry behavior in isolated fixtures, remove that family's duplicate implementation once parity passes, and make its registry path authoritative. Narrow context dependencies only where doing so removes caller knowledge. Keep intentional terminal routes explicit.

Do not execute mutating requests twice against production for “shadow” verification. Do not flip a global strict flag as a substitute for proving each family's contract. Other domain extraction follows a real behavior change, not a seven-class quota.

**Tests:** methods/paths/aliases, auth and malformed payloads, operation IDs, cancellation, errors, streaming events, settings persistence, unknown routes and side effects match once per request.

**Acceptance:** one family has one implementation; its fallback counter is zero on the supported contract suite. Telemetry distinguishes intentional terminal handling from migration misses. Dependencies: U5.

### U7 — qualify concrete desktop/mobile artifacts

2026-09-13 host checkpoint (historical): report selection, run-ID deduplication, newest-failure blocking, source/dist/sidecar binding and five-restart requirements are implemented. Three distinct final-build SQLite soak and reference HTTP prefilter matrix runs passed in dist and packaged Windows modes; the strict gate passed against the checked-in archive. The prefilter is a reference token-posting service, not an external approximate index. ADB has no connected device; Android, native-window and independent-host acceptance remain unqualified.

2026-09-14 execution update: the manual `foundation-runtime-qualification.yml` workflow will build and measure separate Windows/Linux artifacts on real CI runners, run three SQLite soak/reference-connector matrices per host, and archive binaries, dist inputs, manifests and strict-gate reports. Qualification remains pending until those jobs and their artifacts are verified. This workflow does not establish native windows, Android or an external production ANN backend.

- [x] U7 tooling, Windows SQLite and reference connector qualification.
- [ ] U7 external device/host/backend qualification with their own artifacts and measurements.

- [ ] **U7 / P1 — close evidence obligations, not feature scope; R7**

**Owner/files:** `scripts/verify-foundation-release-evidence.js`, `scripts/verify-foundation-sqlite-runtime.js`, `scripts/verify-foundation-ann-runtime.js`, `scripts/capture-tauri-android-rss-evidence.js`, `scripts/verify-mobile-artifact.js`, release workflows. Tests: `src/foundation.release.evidence.contract.test.ts`, `src/mobile.artifact.contract.test.ts`.

**Decision:** use the existing harnesses. Archive reports by source revision, artifact hash, runtime/host, workload and generation time. A later matrix run must not obscure a valid release-soak report merely because both use a generic latest pointer. Evaluate eligible dated reports or separate report-kind pointers without weakening freshness.

Desktop acceptance covers dist and packaged sidecar, SQLite restart/soak, explicit fallback and the optional ANN thresholds. Android acceptance covers signed arm64 install, SAF permission/error/retry, exact query/path, force-stop/reopen, projection continuity and peak RSS. Preserve the existing 25 MiB payload and 256 MiB mobile RSS constraints until measured evidence supports a change.

**Tests:** stale/wrong-kind/wrong-artifact reports are rejected; matrix-after-soak ordering chooses the correct eligible report; missing native evidence cannot be promoted by host replay. Validate signing and resource measurements on the target device.

**Acceptance:** promote only the host/backend combinations actually qualified. Keep G2/G3 native acceptance and G4 canonical-ID cutover separate; no public-ID migration is included. Dependencies: U1–U3 before qualifying a changed runtime; evidence collection tooling can proceed independently. Device access/signing is an explicit external prerequisite.

### U8 — representative answer and learning-outcome calibration

2026-09-13 measurement checkpoint (historical): V1 is archived; V2 contains six calibration and eighteen disjoint confirmation cases with references frozen before the wiki-link evidence fix. Final V2 reference acceptance is 8/18 slim and 13/18 full; coverage is 28/36 and 36/36. Full responses still show two topic-leakage probe hits and both modes miss 2/2 conflict signals. The 2,000-document snapshot cost and cooperative cancellation limits are measured in the results record. These measurements complete the baseline, not general answer-quality or learner-outcome acceptance.

- [x] U8 versioned bilingual corpora, reproducible measurements and consent-based pilot protocol.
- [x] U8 topic/conflict controls and V1–V6 regressions, with initial confirmation reports preserved.
- [ ] U8 independent final-quality generalization and consented learner observations.

- [ ] **U8 / P2 — advance M01/M09/M10/M11; R8**

**Implemented owners:** `src/learning/AnswerQualityEvaluation.ts`, `scripts/evaluate-answer-quality.js`, `scripts/measure-convergence-runtime.js`, `fixtures/answer-quality/v{1,2}.json` and the bilingual evaluation/pilot records. The bounded wiki-link fix belongs to `src/learning/ragPublicText.ts`; the existing Knowledge Workspace runtime corpus remains a regression gate. General topic/conflict policy changes require new independent evidence.

**Decision:** keep Water Glass as a known regression and create a versioned held-out bilingual corpus covering definition, comparison, causality, multi-step tasks, conflict, missing evidence, topic drift, math and noisy headings. Split calibration and evaluation cases; state corpus/hash, backend, response mode, sample count and latency/memory measurement conditions.

Run a learning pilot on the stable local/exact backend. Operational mastery metrics do not prove the original “retest +20%, recurrence -25%, evidence-backed suggestions >=90%, better than random path” goals. Define absolute versus relative change, learner/task unit, baseline, observation window and uncertainty before interpreting those thresholds. Require explicit participant consent where user study data is collected.

**Acceptance:** deterministic regressions remain green; unsupported-claim and false-conflict rates, coverage, p95/p99 and cold/hot measurements have reproducible denominators. User learning claims remain unverified until outcome evidence exists. No performance improvement may be traded for silent source loss.

**Dependencies:** quality-corpus design can start now; runtime comparison follows U2–U4. ANN and native mobile release qualification are not prerequisites for a local learning pilot.

### Deferred decisions and rollback

| Direction | Promotion trigger | Current decision |
|---|---|---|
| Canonical public-ID cutover | Alias/collision/old-snapshot/device continuity evidence plus independent migration review | Keep current IDs and dual-read |
| Mobile SQLite/WASM or richer local runtime | Measured exact-index inadequacy with better startup/RSS/package trade-off | Keep compact projection default |
| External graph/vector infrastructure | Representative workload proves local architecture insufficient | Keep optional connector boundary |
| Whole frontend rewrite / blanket domain extraction | A concrete ownership or interaction failure that incremental changes cannot resolve | Do not schedule as cleanup |
| More answer modes / broader heuristic contradiction rules | Held-out error analysis demonstrates a bounded, measurable gain | Prefer calibration over feature count |
| LFS history rewrite / Capacitor removal | Reproducible bootstrap plus downstream/CI consumer audit | Separate migration, outside U1–U8 |

Each unit should be independently reviewable and revertible. Preserve storage formats during U1; retain the previous working artifact during U7; do not use a feature switch to conceal a known data-loss path. Reopen status when a production invariant fails, even when old implementation checkboxes remain checked.

Documentation policy: update English and Chinese status together and link the results/evidence record instead of copying another backlog. The user authorized integrating the verified implementation into remote main. Release tags, manual deployment, production configuration changes and promotion of unverified targets remain outside this work.

<a id="chinese"></a>

## 中文

### 验收检查点 — 2026-09-14

U1–U6 保持已验收。公开证据与所选知识库后续修复在 Node 22.19.0、24.14.0 各通过 168 suite / 1,708 test，零跳过。V1–V6 最终回归通过，首次确认历史保留。真实 Windows development 会话验证外部知识库、Bridge layout、Tauri/Godot 显隐切换、有源回答及正常退出，并实际发现和验证了 root 修复。最终产物与远端资格见[九月十四日后续结果](../evaluations/2026-09-14-public-evidence-quality-results.md#chinese)。U7/U8 对未验收目标与取得同意后的学习效果保留整体部分验收状态；下方旧的分阶段数量属于历史实现检查点。

### 目标与约束

交付一个本地优先的知识/学习 runtime：已确认写入不被无关失败抹掉，回答工作在分配前受到约束，发布声明有对应目标环境的证据。

本计划依据 [2026-09-12 审计](../audits/2026-09-12-project-progress.md)。该文档审计是基线，三个生产代码探针暴露了当时绿色测试覆盖外的缺口；上方验收检查点记录其后的实施和验证。

需求：

- **R1：**摄入失败不丢失已确认的 memory/session/workspace 更新；公开读取不把未提交状态当作 committed state。
- **R2：**由后端拥有同一资源契约，覆盖源读取、graph/RAG、composition、delivery；取消必须停止工作。
- **R3：**JSON、SSE、replay 保持同一发布答案、存活引用和真实截断状态。
- **R4：**优化保持顺序与 worker 的匹配语义一致。
- **R5：**required CI gate 执行真实断言；必要证据缺失必须失败。
- **R6：**架构工作迁移不变量所有权，并消除重复决策。
- **R7：**桌面、移动、可选后端分别验收发布资格。
- **R8：**学习/回答质量基于独立证据测量，不从功能完成推导。

保持公共 ID、snapshot/projection schema、slim/full 默认值、mobile compact 与 Bridge v2 兼容。Godot 消费受支持的栅格物化结果，不新增直接 SVG 导入。本轮不引入图数据库、编排框架、泛化 service 层、替代 UI 框架或 public-ID 迁移。

在所属边界校验外部输入，内部消费已经建立的不变量。不要用 enum/options/strategy 变形隐藏 mode 分支。新增模块必须承担完整操作、不变量或外部依赖。

### 顺序与容量

默认一名有经验的维护者，以验收而非固定日期承诺推进：

| 波次 | 工作 | 退出条件 |
|---|---|---|
| A：正确性收口 | U1；随后 U2/U3；U4 与 U5 最小回归 | 三个探针变为修复前失败/修复后通过的永久回归；deadline/慢客户端失败可观测 |
| B：契约与所有权收敛 | 完成 U5，再做 U6 | required job 真正断言行为；一个路由族只保留一个实现并有隔离 parity 证明 |
| C：验收与效果评估 | U7 按 target 推进；U8 基于稳定 local backend | 被提升目标具备新鲜 artifact 证据；质量基线有可复现数据与明确不确定性 |

A/B 需要多个工程迭代，不承诺“两周清理完成”；U1 的范围取决于共享 writer 盘点。设备、签名、多宿主访问和学习效果采样属于外部周期，不能混进编码工期。原生证据采集可独立于路由清理开展；每名维护者同一时间只推进一个高风险状态/transport 变更。

### U1：committed-state 发布与跨操作隔离

- [x] **U1 / P0 — 关闭 F1；R1、R6**

**Owner/文件：**`src/learning/KnowledgeLearningPlatform.ts`；仅持久化契约确有需要时涉及 `src/learning/store.ts`。测试：`src/learning/KnowledgeLearningPlatform.persistence.test.ts`、`src/learning/KnowledgeLearningPlatform.test.ts`。

**决策：**现有 snapshot 状态 owner 负责完整 commit。盘点共享 snapshot 的 ingest、memory、session、workflow、workspace writer；复用版本化格式，将候选状态与 committed read view 分离，持久化成功后再发布。串行化冲突的逻辑写操作，而非只串行化 `saveSnapshot`。

首个有界实现可以用写并发度换正确性；是否进一步 journal/delta，取决于实测 clone 成本。不引入完整 event sourcing，也不把 platform 复制到 facade 后面。若 committed read view 需要改变公开同步/异步契约，先设计 additive 兼容接缝。

**坑点：**在 persist 才加锁已经太晚；全 snapshot 回滚会覆盖无关更新；嵌套公共写调用可能造成非重入队列死锁；多实例/进程仍是独立存储协调问题。明确支持的 single-writer 拓扑，不声称分布式隔离。

**测试：**

- 暂停并失败 ingest 持久化，同时写 memory；凡返回成功，记录必须保留且重启后可读。
- ingest 暂停时，state/query/export 只观察一个 committed revision。
- mixed move/upsert/delete collision 保留旧 alias 及所有 resource/workspace/index owner。
- 失败后排队的第二次写恰好执行一次，无死锁、无 ID 重用。
- 注入 rollback/commit 失败，返回错误且旧状态可恢复。
- 对小型和代表性大 snapshot 测量 clone/commit 瞬时分配。

**验收：**审计中的 memory 丢失与 dirty read 不再复现，identity/persistence 回归通过。依赖：无。

### U2：回答链路的请求准入、deadline 与 cancellation

实现检查点：单一 host-owned execution scope 已约束排队回合、源字节/行/事实和 fragment。文件读取同时检查 stat 与 chunk 字节，取消时关闭描述符。取消已传到向量 HTTP 和退避等待；本地打分每 128 个候选让出事件循环。客户端提示不能提高宿主上限。execution/budget/backend/adapter 回归 65 项通过；persistence/composition/RAG 组合 117 项通过。传输取消和实测校准继续在 U3/U7 完成。这些是协作式准入限制，不是 OS 级 RSS 保证；忽略 AbortSignal 的 provider 必须等到结束才释放状态 lease。

- [x] **U2 / P1 — 关闭 F2；R2、R3**

**实现 owner：**`src/learning/agentConversationExecution.ts`、`src/learning/agentResponseBudget.ts`、`src/learning/evidenceContextAssembler.ts`、`src/learning/KnowledgeLearningPlatform.ts`；provider 取消由 `queryBackend.ts`、`vectorAccelerationAdapter.ts`、`ragSufficiencyReview.ts` 负责。execution/platform/backend/composer 测试覆盖这些边界。

**决策：**服务端独立决定有限上限，客户端 hint/偏好只能在其中选择。在 turn 边界启动一个 deadline，将 cancellation 与累计 source/fragment 计量传给真正执行工作的操作。读取前和读取中限制字节，避免文件增长绕过 stat 检查；并发准入单独计量，不能用单响应大小代替。

保持全文证据契约诚实：完成被准入的扫描，或明确标记不完整。不能因 source cap 截断却仍标记 `full_document/read` 和 sufficient。解析器允许时用有界流式/分节扫描；同步 CPU 工作不能响应取消时才评估 worker 隔离。

**测试：**

- source resolver 超过 turn deadline 后，后续阶段和后台写停止。
- query/source read/assembly 取消后不继续工作，只有一个 terminal outcome。
- 大文件、增长中的文件、多个单独合法但累计超限的文件在无界分配前被阻断。
- 伪造 high-memory hint 无法抬高宿主上限；缺失 hint 保守回落。
- mobile compact 保持 slim，且不执行桌面级检索。
- 扫描不完整时保留可用证据并声明 coverage 不完整。

**验收：**timeout 被生产路径实际消费；response/trace 的 stop reason 一致。提升前必须记录各宿主的有限单源字节、累计读取字节、准入并发 turn 和 cancellation latency 上限，并以 peak allocation 实测支撑；数值属于实施期校准，不由浏览器选择。依赖：会写 memory 的 turn 依赖 U1；纯预算/读取测试可先做。

### U3：完整 wire-size 计量与有界 SSE delivery

实现检查点：JSON 在序列化前有界计量；HTTP/SSE/replay 使用预留完整封装的同一发布 projection，保留有界引用并清除失效覆盖声明。stream writer 限制字节/事件数量，处理 drain/close/error/timeout。缓存回合共享取消状态，最后一个消费者离开时停止；源 hydration 已共享回合 deadline/计量。transport/platform/NoteMD/frontend runtime 合计 80 项通过；七项 HTTP conversation 定向用例通过，包括真实断连与失败重放。恢复 migration 测试后发现原有 registry 抢先处理缺陷，继续在 U5 修复。

- [x] **U3 / P1 — 关闭 F3；R2、R3**

**实现 owner：**`src/learning/agentConversationSerialization.ts`、`src/middleware/SseResponseWriter.ts`、`src/server.ts`。序列化/stream 单测和真实 HTTP/前端集成测试覆盖封装、drain 与共享消费者取消。

**决策：**transport owner 计入完整发送单元，覆盖 envelope 与 SSE framing。大对象序列化前先压缩诊断集合；JSON/live SSE/replay 复用同一 released response projection，保留存活答案的有界引用集，并据投影重算 summary。

`write() === false` 必须进入有界 queue/drain 生命周期，处理 close/error/deadline。共享 writer 同时影响 NoteMD，应保持事件契约并加入 transport 回归，不把等待逻辑散落到 emitter。

**测试：**

- response 未超限而 envelope 超限，JSON/SSE 都受限且标记截断。
- CJK/emoji、转义、多行 payload 按 UTF-8 字节测试临界点上下及等值。
- 慢读/断连客户端不造成缓冲无限增长；完成与取消仅一个胜出。
- 大 trace/citation 集合在首次全量 stringify 前被约束。
- Markdown/math 成对；存活 claim 保留有效引用，计数与 coverage 重算。
- 同一 turn 的 JSON/live SSE/replay 发布内容一致，profile/cache 隔离保持。

**验收：**覆盖并修复 1,998 → 2,094 字节反例，不以首次大 stringify 充当内存门禁。依赖：U2 提供权威预算；envelope 回归可先落地。

### U4：先保证图匹配语义，再优化性能

- [x] **U4 / P1 — 关闭 F4；R4**

已实现：exact-phrase 候选与 matcher 的 ASCII 词边界一致；fuzzy 使用完整候选集。差分回归覆盖中英混排、子串、标点、排除项和真实 worker 的两种输入方式；matching、identity、PathEngine 共 11 项通过。保留 fuzzy 最坏情况下的扫描成本说明。

**Owner/文件：**`src/backend/GraphBuilder.ts`、`src/backend/workers/keywordMatchWorker.ts`；仅共享语义契约需要时涉及 `src/backend/utils/stringUtils.ts`。新增 `src/backend/GraphBuilder.matching.test.ts`，保留 identity 与 `src/core/PathEngine.test.ts` 回归。

**决策：**候选索引不能排除合法 matcher 命中。当前 fuzzy 索引不支持的情形，最小安全回退是完整候选扫描，并明确成本；parity corpus 建立后再评估子串索引。不要同时重设计匹配语言。

**测试：**英文/中文子串、Unicode/大小写、纯标点标题、exclusion、自引用、exact-phrase 边界、worker file-path/content payload 与 worker fallback 均生成相同边集；验证方向、provenance 和 identity alias。

**验收：**sequential/worker 与参考 matcher 等价，candidate count/p95 单独测量。常见 token/回退的最坏复杂度仍可能为二次，增加 worker 不改变这一点。依赖：无。

### U5：让 CI 门禁名称对应真实断言

实现检查点：13 项跳过的 HTTP 义务已恢复并通过；删除不完整的 data/diagnostic/clipboard/Graphviz 注册副本后，由完整 server owner 继续负责原生剪贴板、文件边界和构建准入。构建保留请求的 recompute 策略，改由 HTTP 回归验证。13 项跳过的能力义务已改为运行时注册表/真实能力输出测试，使用导出的类型契约；依赖上下文的 artifact presenter 在所属注册表验证，不要求每次 conversation 都输出。echo gate 已替换为 SQLite/readiness/backend/evidence 断言。缺失的 turn-cache durability 测试已恢复，HTTP 诊断读取真实缓存，取代 platform 占位计数。组合验证 84 项通过、零跳过。支持 Node 22.19+ 与 24.x，CI 为收敛回归配置双版本通道。

- [x] **U5 / P1 — 关闭 F5；R5、R7**

**Owner/文件：**`package.json`、`.github/workflows/migration-gates.yml`、`src/server.migration.test.ts`、`src/agent_workspace.contract.parity.test.ts`；复用 `src/foundation.release.evidence.contract.test.ts`，若旧 rollout suite 已不存在，新增 `src/foundation.rollout.boundary.test.ts` 验证实际行为。

**决策：**用可执行断言替代成功 echo；用导出的 capability 契约和可观察执行替代源码 marker 探测。按行为是否仍受支持恢复或替换 26 个 skip；退役用例必须记录继任检查/理由，不静默消失。

固定并说明支持的 Node matrix。本轮本机是 Node 22.19.0，CI 为 Node 24；旧“Node 20”说明不能证明 SQLite/Vite runtime 兼容。

**测试：**支持/不支持 capability、backend unavailable/fallback、证据过期/缺失、畸形/超大请求、scope/path 越界、build dedupe/conflict、clipboard type/size、live/replay parity。required fixture 缺失 → job 失败；可选 target 不可用 → 明确未验收。

**验收：**required job 不再仅输出 SKIP；原 skip 义务被执行、被行为测试替代，或有理由地退役；CI 包含 U1–U4 回归。依赖：用例可随修复落地，完整验收位于 U1–U4 后。

### U6：收敛一个路由族及其操作所有权

实现检查点：删除前在 legacy 与 registry 两个实现上分别通过相同的 10 项行为对照（原始 JSON：`output/project-convergence-2026-09-12/notemd-{legacy,registry}-parity.json`）。server.ts 的 20 个 NoteMD 旧 handler 及 operation/workspace helper 已删除。registry 负责操作准入、ID、取消、workspace 更新和原有 PUT 别名；请求解析、文件 canonical 边界和 SSE 传输复用共享实现。新增 HTTP 测试覆盖认证、未知路由、批处理/workflow 路径拒绝、ID 冲突与取消。四套件 71 项通过、零跳过。遥测已区分有意保留的 server-owned 路由与 registry miss，不再用常数宣称只有七个 inline 路由。

- [x] **U6 / P1 — 推进 M04；R5、R6**

**Owner/文件：**首先处理 `src/routes/notemd.ts`、`src/server.ts`、`src/routes/types.ts`；复用 `scripts/verify-route-registry-shadow.js`、`src/routes/registry.shadow.contract.test.ts`、`src/notemd.server.integration.test.ts`。

**决策：**从已经覆盖的 NoteMD 族开始，在隔离 fixture 上比较 legacy/registry；parity 通过后移除该族重复实现，以 registry 为唯一入口。只有确实减少调用者知识时才缩小 context；明确保留 terminal 路由。

不能为 shadow verification 对生产 mutation 执行两遍；不能用翻转 global strict flag 代替逐族证明。其他 domain 提取随真实业务变化推进，不以“拆完七个类”作为指标。

**测试：**method/path/alias、auth、非法 body、operation ID、取消、异常、stream、settings persistence、未知路由和 side effect 每个请求执行一次且语义一致。

**验收：**一个路由族只保留一个实现，支持契约测试下 fallback 为零；telemetry 区分合法 terminal 与迁移缺口。依赖：U5。

### U7：验收具体桌面/移动 artifact

2026-09-14 执行更新：新增手动 `foundation-runtime-qualification.yml` 工作流，在真实 Windows/Linux CI runner 上分别构建和测量产物，每宿主执行三次 SQLite soak/参考连接器 matrix，并归档二进制、dist 输入、manifest 与严格门禁报告。在 job 与产物完成核验前仍保留待验收状态；该工作流不代表原生窗口、Android 或外部生产 ANN 已验收。

2026-09-13 宿主检查点（历史）：日期选择、run ID 去重、最新失败阻断、源码/dist/sidecar 绑定及至少五次重启要求已实现。最终构建的 SQLite soak 与参考 HTTP 预筛选 matrix 各三次通过，覆盖 Windows dist/packaged；对入库归档执行严格门禁亦通过。预筛选是 token posting 参考服务，不是外部近似索引。ADB 没有在线设备，Android、原生窗口与独立宿主仍未验收。

- [x] U7 工具、Windows SQLite 与参考连接器资格验证。
- [ ] U7 外部设备/宿主/backend 的独立 artifact 与实测资格。

- [ ] **U7 / P1 — 关闭证据义务；R7**

**Owner/文件：**`scripts/verify-foundation-release-evidence.js`、`scripts/verify-foundation-sqlite-runtime.js`、`scripts/verify-foundation-ann-runtime.js`、`scripts/capture-tauri-android-rss-evidence.js`、`scripts/verify-mobile-artifact.js`、release workflow。测试：`src/foundation.release.evidence.contract.test.ts`、`src/mobile.artifact.contract.test.ts`。

**决策：**复用现有 harness，按 source revision、artifact hash、runtime/host、workload、生成时间归档。后续 matrix 不应仅因共用 latest pointer 而掩盖有效 release-soak 报告；选择合格日期报告或分离 report-kind pointer，不降低 freshness。

桌面验证 dist/packaged sidecar、SQLite restart/soak、显式 fallback 与可选 ANN 阈值。Android 验证 signed arm64 安装、SAF 权限/异常/重试、exact query/path、force-stop/reopen、projection continuity 与 peak RSS。保持既有 25 MiB payload / 256 MiB mobile RSS 限制，放宽必须有测量证据。

**测试：**拒绝 stale/wrong-kind/wrong-artifact；matrix-after-soak 正确选择仍有效报告；host replay 不能提升缺失的 native evidence。签名与资源测量在目标设备验证。

**验收：**仅提升已实证的 host/backend 组合；G2/G3 原生验收与 G4 canonical-ID 独立，不包含 public-ID 迁移。依赖：变更 runtime 的验收在 U1–U3 后；证据工具可独立推进。设备/签名为明确外部前提。

### U8：代表性回答与学习成效校准

2026-09-13 测量检查点（历史）：V1 已归档，V2 包含六个校准与十八个独立确认用例，参考在 wiki-link 证据修复前冻结。最终 V2 参考验收 slim 8/18、full 13/18，覆盖分别为 28/36、36/36。full 仍命中两个主题泄漏探针，两种模式均漏报 2/2 冲突信号。2,000 文档 snapshot 成本与协作式取消的测量边界已记录。这些结果完成基线，不代表一般回答质量或真实学习成效已经验收。

- [x] U8 版本化双语语料、可复现测量与知情同意 pilot 协议。
- [x] U8 主题/冲突对照与 V1–V6 回归，保留首次确认报告。
- [ ] U8 最终质量的独立泛化验证及已取得参与同意的学习者观察。

- [ ] **U8 / P2 — 推进 M01/M09/M10/M11；R8**

**实现 owner：**`src/learning/AnswerQualityEvaluation.ts`、`scripts/evaluate-answer-quality.js`、`scripts/measure-convergence-runtime.js`、`fixtures/answer-quality/v{1,2}.json` 与双语 evaluation/pilot 记录。有界 wiki-link 修复归属 `src/learning/ragPublicText.ts`；既有 Knowledge Workspace runtime 语料继续作为回归门禁。一般主题/冲突策略变更须有新的独立证据。

**决策：**Water Glass 保留为已知回归；建立版本化中英留出集，覆盖定义、比较、因果、复合任务、冲突、缺证据、主题漂移、数学及噪声标题。分离调参与评估样本，记录 corpus/hash、backend、response mode、样本量和时延/内存测量条件。

先在稳定 local/exact backend 开展学习试验。运行级 mastery 指标不能证明原“复测 +20%、误区复发 -25%、证据建议 >=90%、优于随机路径”目标。解释阈值前定义绝对/相对提升、learner/task 单位、baseline、观察窗口与不确定性；采集用户研究数据时取得明确参与同意。

**验收：**确定性回归保持绿色；unsupported-claim、false-conflict、coverage、p95/p99、cold/hot 测量具备可复现分母。成效证据出现前，学习收益维持未验证。性能提升不能以静默丢失源内容换取。

**依赖：**语料设计现在可做，runtime 比较在 U2–U4 后；ANN 与 native mobile release qualification 不是本地学习试验前提。

### 暂缓决策与回退

| 方向 | 触发条件 | 当前决策 |
|---|---|---|
| Canonical public-ID 切换 | alias/collision/旧 snapshot/device continuity 证据及独立迁移评审 | 保留当前 ID 与 dual-read |
| 移动 SQLite/WASM 或更重本地 runtime | exact index 不足，且 startup/RSS/package 实测权衡更优 | 保持 compact projection 默认 |
| 外部图/向量基础设施 | 代表性 workload 证明本地方案不足 | 保持 optional connector |
| 前端整体重写 / 全量 domain 拆分 | 增量改进无法解决的具体 ownership/交互故障 | 不按 cleanup 排期 |
| 更多回答 mode / 矛盾检测启发式 | 留出集错误分析证明有界且可测的收益 | 先校准，后加功能 |
| LFS 历史重写 / Capacitor 下线 | 可复现 bootstrap 与下游/CI 消费审计 | 独立迁移，排除于 U1–U8 |

每个单元应可独立审查与回退。U1 保持存储格式，U7 保留前一个可用 artifact；不以 feature switch 掩盖已知数据丢失路径。生产不变量失败时重新打开状态，即使历史编码步骤仍勾选。

文档要求：同步更新中英文状态，链接结果/证据记录，不复制另一份 backlog。用户已授权将验证后的实现同步到远端 main；release tag、手工部署、生产配置调整及未验收目标的提升不在本轮范围内。
