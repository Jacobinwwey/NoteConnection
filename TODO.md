# 2026-03-10 v1.5.40 - TODO Consistency Repair (Godot PNG Contract + Closed Security Drift Items)

## English Document

### Objective
Fix stale/contradictory TODO entries so the document reflects current runtime contracts and already-implemented security work.

### Completed in This Iteration
- [x] Corrected historical Godot WebSocket wording to align with actual stable URL contract (`ws://127.0.0.1:9876` without query suffix in Godot client path).
- [x] Corrected legacy “SVG fallback” statement for Godot Path Mode: Mermaid runtime contract is PNG-only (`pngBase64` required), SVG is diagnostics-only.
- [x] Closed stale P0 item “Secure sidecar content API to match Rust boundary guarantees” in duplicated migration blocks:
  - [x] `/api/content` KB-root boundary checks are implemented in `src/server.ts`.
  - [x] Regression tests already cover allowed path + outside-root rejection + legacy Windows-style path variants in `src/server.migration.test.ts`.
- [x] Added explicit TODO state note in legacy Chinese block to avoid confusion with old SVG-sanitization phrasing.

### Verification Gate (Executed)
- [x] `npx jest src/server.migration.test.ts --runInBand`
- [x] `npx jest src/pathbridge.handshake.contract.test.ts --runInBand`

---

## 中文文档

### 目标
修复 TODO 中与当前实现不一致的陈旧条目，确保文档状态与运行时契约、已落地安全加固保持一致。

### 本轮完成
- [x] 修正历史 Godot WebSocket 表述，明确当前稳定 URL 契约为 `ws://127.0.0.1:9876`（Godot 客户端路径不带查询参数）。
- [x] 修正历史 “SVG Fallback” 描述：Godot Path Mode 下 Mermaid 运行时契约为 PNG-only（`pngBase64` 必填），SVG 仅用于诊断。
- [x] 关闭重复迁移区块中的陈旧 P0 项“sidecar 内容 API 安全边界对齐 Rust”：
  - [x] `src/server.ts` 已实现 `/api/content` 的 KB 根路径边界校验。
  - [x] `src/server.migration.test.ts` 已覆盖合法路径、越界拒绝、Windows 历史路径变体回归。
- [x] 在历史中文条目增加状态说明，避免旧版 SVG 清洗表述与当前 PNG-only 契约冲突。

### 验证门禁（已执行）
- [x] `npx jest src/server.migration.test.ts --runInBand`
- [x] `npx jest src/pathbridge.handshake.contract.test.ts --runInBand`

---

# 2026-03-10 v1.5.39 - High-Priority Bridge Robustness Closure (Typed Envelope + Backpressure + Packaging/CSP Contracts)

## English Document

### Objective
Close the remaining high-priority bridge/runtime robustness gaps from the imported fixrisk baseline without destabilizing existing WASM/mobile workstreams.

### Completed in This Iteration
- [x] `src/core/PathBridge.ts` hardened with strict inbound envelope validation (`parseBridgeInboundEnvelope`) and known-message payload checks.
- [x] Added inbound frame size guard (`MAX_INBOUND_MESSAGE_BYTES`) to prevent oversized message ingestion.
- [x] Added per-client outbound backpressure queue with bounded depth and `bufferedAmount`-gated drain (`BRIDGE_BACKPRESSURE_LIMITS`).
- [x] Added packaging contract coverage via `src/pkg.sidecar.contract.test.ts` and included it in `npm run test:migration`.
- [x] Tightened frontend CSP (`object-src`, `base-uri`, `frame-ancestors`, `form-action`) in `src/frontend/index.html`.
- [x] Reaffirmed Godot Mermaid rendering compatibility contract: runtime path remains PNG-only (`pngBase64` required); SVG is debug-only and is not used as Godot runtime fallback.

### Verification Gate (Executed)
- [x] `npx jest src/pathbridge.handshake.contract.test.ts src/pkg.sidecar.contract.test.ts --runInBand`
- [x] `npm run test:migration` (**28 suites, 135 tests passed**)
- [x] `npm test` (**31 suites, 152 tests passed**)
- [x] `npm run build`

---

## 中文文档

### 目标
在不扰动现有 WASM/移动端主线的前提下，收口导入 fixrisk 基线中剩余的桥接/运行时高优先级稳健性缺口。

### 本轮完成
- [x] `src/core/PathBridge.ts` 已完成严格入站消息包校验（`parseBridgeInboundEnvelope`）与已知消息负载结构约束。
- [x] 新增入站消息大小门禁（`MAX_INBOUND_MESSAGE_BYTES`），避免超大消息直接进入解析流程。
- [x] 新增按客户端维度的有界出站背压队列，并基于 `bufferedAmount` 进行排队排空（`BRIDGE_BACKPRESSURE_LIMITS`）。
- [x] 新增打包契约测试 `src/pkg.sidecar.contract.test.ts`，并纳入 `npm run test:migration`。
- [x] 强化前端 CSP（`object-src`、`base-uri`、`frame-ancestors`、`form-action`）于 `src/frontend/index.html`。
- [x] 明确并固化 Godot Mermaid 渲染兼容性契约：运行时保持 PNG-only（`pngBase64` 必填），SVG 仅用于调试，不作为 Godot 回退路径。

### 验证门禁（已执行）
- [x] `npx jest src/pathbridge.handshake.contract.test.ts src/pkg.sidecar.contract.test.ts --runInBand`
- [x] `npm run test:migration`（**28 suites, 135 tests passed**）
- [x] `npm test`（**31 suites, 152 tests passed**）
- [x] `npm run build`

---

# 2026-03-10 v1.5.38 - High-Priority Multi-Terminal WASM Plan Continuation (Mobile WASM Readiness Contract + Capability-Aware Build Telemetry)

## English Document

### Objective
Continue the high-priority WASM parity stream with a concrete multi-terminal implementation plan and the first mobile-facing runtime capability slice, so mobile behavior is diagnosable and fallback remains deterministic.

### Completed in This Iteration
- [x] **Multi-terminal WASM implementation plan added**:
  - [x] `implementation_plan.md`
  - [x] `docs/en/implementation_plan.md`
  - [x] `docs/zh/implementation_plan.md`
  - [x] Plan now explicitly maps mobile bottlenecks, phased rollout, and acceptance gates.
- [x] **Mobile WASM readiness probe integrated** (`src/frontend/source_manager.js`):
  - [x] Added capability fields:
    - [x] `supports_mobile_wasm_compute`
    - [x] `mobile_wasm_reason`
  - [x] Added runtime probe: `detectMobileWasmCapability()`
  - [x] Wired probe output into Capacitor runtime capability resolution and diagnostics logs.
- [x] **Capability-aware mobile build telemetry added** (`src/frontend/storage_provider.js`, `src/frontend/source_manager.js`):
  - [x] Added build-mode detail mapping via `resolveCapacitorBuildModeDetail(...)`.
  - [x] Build result now carries:
    - [x] `buildModeDetail`
    - [x] `supportsMobileWasmCompute`
    - [x] `mobileWasmReason`
  - [x] Source manager now logs mobile build stats/warnings with mode details.
- [x] **Contract coverage updated**:
  - [x] `src/runtime.capabilities.test.ts`
  - [x] `src/capacitor.runtime.contract.test.ts`
  - [x] `src/storage.provider.contract.test.ts`
  - [x] `src/storage.provider.capacitor.worker.contract.test.ts`

### High-Priority Work Status (Current)
- [x] Multi-terminal WASM execution strategy is now explicitly documented and bilingual-synced.
- [x] Mobile runtime now reports explicit WASM readiness and reason instead of implicit behavior.
- [x] Mobile build path now emits capability-aware telemetry while preserving deterministic worker/single-thread fallback.
- [ ] Remaining high-priority work: implement more mobile heavy-compute kernels on real wasm runtime path and validate p95/p99 gains on physical devices.

### Verification Gate (Executed)
- [x] `npx jest src/runtime.capabilities.test.ts src/capacitor.runtime.contract.test.ts src/storage.provider.contract.test.ts src/storage.provider.capacitor.worker.contract.test.ts src/source_manager.loadflow.test.ts --runInBand` (`5` suites, `28` tests passed)
- [x] `npm run test:migration` (`27` suites, `131` tests passed)

---

## 中文文档

### 目标
继续推进高优先级 WASM 等价收口：补齐可执行的多终端实施计划，并落地首个移动端运行时能力切片，使移动端行为可诊断、回退链路可预测。

### 本轮完成
- [x] **多终端 WASM 实施计划已补齐**：
  - [x] `implementation_plan.md`
  - [x] `docs/en/implementation_plan.md`
  - [x] `docs/zh/implementation_plan.md`
  - [x] 计划中已明确移动端瓶颈映射、分阶段推进路径与验收门禁。
- [x] **移动端 WASM 就绪探测已接入**（`src/frontend/source_manager.js`）：
  - [x] 新增能力字段：
    - [x] `supports_mobile_wasm_compute`
    - [x] `mobile_wasm_reason`
  - [x] 新增运行时探测函数：`detectMobileWasmCapability()`
  - [x] 已将探测结果接入 Capacitor 能力解析与日志诊断输出。
- [x] **能力感知的移动构建遥测已落地**（`src/frontend/storage_provider.js`、`src/frontend/source_manager.js`）：
  - [x] 新增构建模式细分映射：`resolveCapacitorBuildModeDetail(...)`。
  - [x] 构建结果新增：
    - [x] `buildModeDetail`
    - [x] `supportsMobileWasmCompute`
    - [x] `mobileWasmReason`
  - [x] SourceManager 现会记录移动构建统计与告警细节。
- [x] **契约覆盖已同步更新**：
  - [x] `src/runtime.capabilities.test.ts`
  - [x] `src/capacitor.runtime.contract.test.ts`
  - [x] `src/storage.provider.contract.test.ts`
  - [x] `src/storage.provider.capacitor.worker.contract.test.ts`

### 当前高优先级状态
- [x] 多终端 WASM 执行策略已明确并完成中英文同步。
- [x] 移动端运行时现可显式报告 WASM 就绪状态与原因，不再依赖隐式行为。
- [x] 在保持 worker/single-thread 确定性回退前提下，移动构建链路已具备能力感知遥测。
- [ ] 剩余高优先级工作：将更多移动端重计算内核迁移到真实 wasm 路径，并在真机上验证 p95/p99 收益。

### 验证门禁（已执行）
- [x] `npx jest src/runtime.capabilities.test.ts src/capacitor.runtime.contract.test.ts src/storage.provider.contract.test.ts src/storage.provider.capacitor.worker.contract.test.ts src/source_manager.loadflow.test.ts --runInBand`（`5` 套件、`28` 项通过）
- [x] `npm run test:migration`（`27` 套件、`131` 项通过）

---

# 2026-03-10 v1.5.37 - High-Priority Threshold Calibration Continuation (Configurable GraphMetrics Tiering + Calibration Utility + CI Snapshot Integration)

## English Document

### Objective
Continue threshold-calibration closure by making GraphMetrics tiering policy runtime-configurable, adding an evidence-driven calibration utility, and integrating calibration snapshots into CI evidence flow.

### Completed in This Iteration
- [x] **GraphMetrics policy is now runtime-configurable** (`src/backend/GraphMetrics.ts`):
  - [x] Added execution policy model:
    - [x] `asyncNodeCountThreshold`
    - [x] `asyncWorkloadBenefitRatioThreshold`
  - [x] Added env overrides with safe fallback:
    - [x] `NOTE_CONNECTION_GRAPHMETRICS_ASYNC_NODE_THRESHOLD`
    - [x] `NOTE_CONNECTION_GRAPHMETRICS_ASYNC_WORKLOAD_RATIO_THRESHOLD`
  - [x] Added `GraphMetrics.getExecutionPolicy()` for diagnostics/tooling visibility.
- [x] **Tiering policy contracts extended** (`src/wasm.parity.output.equivalence.contract.test.ts`):
  - [x] Added env-override contract for sparse large graph forcing async->wasm path when thresholds are lowered.
  - [x] Added default-fallback contract for invalid env values.
- [x] **Calibration utility added**:
  - [x] New script: `scripts/calibrate-graphmetrics-tiering.js`
  - [x] New npm command: `npm run calibrate:graphmetrics:tiering`
  - [x] Output artifact: `tmp/graphmetrics-tiering-calibration/latest.json` (or custom `--out` path)
  - [x] Includes recommendation payload for threshold tuning from measured profile matrix.
- [x] **CI snapshot integration expanded**:
  - [x] `.github/workflows/wasm-parity-benchmark-snapshots.yml` now also runs GraphMetrics tiering calibration snapshot.
  - [x] Snapshot artifact upload now includes:
    - [x] `tmp/wasm-parity-benchmark/snapshots`
    - [x] `tmp/graphmetrics-tiering-calibration/snapshots`

### High-Priority Work Status (Current)
- [x] Tiering threshold is now tunable without code edits (env-driven policy).
- [x] Evidence-driven calibration tooling is now available for threshold governance.
- [x] CI periodic snapshot flow now captures both wasm parity and GraphMetrics tiering calibration artifacts.
- [ ] Remaining high-priority work: execute multi-iteration, multi-host calibration baselines and converge production threshold values with stronger statistical confidence.

### Verification Gate (Executed)
- [x] `npx jest src/wasm.parity.output.equivalence.contract.test.ts --runInBand` (`7` tests passed)
- [x] `node scripts/calibrate-graphmetrics-tiering.js --iterations 1 --max-workers 4 --out tmp/graphmetrics-tiering-calibration/smoke`
  - [x] calibration artifact emitted at `tmp/graphmetrics-tiering-calibration/smoke/latest.json`
  - [x] recommendation snapshot (current host): `asyncNodeCountThreshold=500`, `asyncWorkloadBenefitRatioThreshold=115.4385`
- [x] `npm run test:wasm:parity:gates` (strict verify + strict perf guards passed)
- [x] `npm run test:migration` (`27` suites, `131` tests passed)

---

## 中文文档

### 目标
继续推进阈值校准收口：让 GraphMetrics 分层策略支持运行时可配置，新增证据驱动的校准工具，并把校准快照纳入 CI 证据链路。

### 本轮完成
- [x] **GraphMetrics 策略已支持运行时可配置**（`src/backend/GraphMetrics.ts`）：
  - [x] 新增策略模型：
    - [x] `asyncNodeCountThreshold`
    - [x] `asyncWorkloadBenefitRatioThreshold`
  - [x] 新增环境变量覆盖并带安全回退：
    - [x] `NOTE_CONNECTION_GRAPHMETRICS_ASYNC_NODE_THRESHOLD`
    - [x] `NOTE_CONNECTION_GRAPHMETRICS_ASYNC_WORKLOAD_RATIO_THRESHOLD`
  - [x] 新增 `GraphMetrics.getExecutionPolicy()`，便于诊断与工具读取当前策略。
- [x] **分层策略契约增强**（`src/wasm.parity.output.equivalence.contract.test.ts`）：
  - [x] 新增环境变量覆盖用例：在降低阈值时，稀疏大图可被强制进入 async->wasm 路径。
  - [x] 新增无效环境变量回退默认值用例。
- [x] **校准工具落地**：
  - [x] 新增脚本：`scripts/calibrate-graphmetrics-tiering.js`
  - [x] 新增 npm 命令：`npm run calibrate:graphmetrics:tiering`
  - [x] 输出工件：`tmp/graphmetrics-tiering-calibration/latest.json`（或 `--out` 指定路径）
  - [x] 基于多配置画像输出阈值建议。
- [x] **CI 快照链路扩展**：
  - [x] `.github/workflows/wasm-parity-benchmark-snapshots.yml` 现已纳入 GraphMetrics 分层校准快照执行。
  - [x] 快照工件上传现同时覆盖：
    - [x] `tmp/wasm-parity-benchmark/snapshots`
    - [x] `tmp/graphmetrics-tiering-calibration/snapshots`

### 当前高优先级状态
- [x] 分层阈值已可通过环境变量调优，不再需要改代码。
- [x] 阈值治理已具备证据驱动校准工具。
- [x] CI 周期快照已同时覆盖 wasm parity 与 GraphMetrics 分层校准证据。
- [ ] 剩余高优先级工作：在多主机、多轮次条件下积累更强统计置信度的校准基线，并收敛生产阈值。

### 验证门禁（已执行）
- [x] `npx jest src/wasm.parity.output.equivalence.contract.test.ts --runInBand`（`7` 项通过）
- [x] `node scripts/calibrate-graphmetrics-tiering.js --iterations 1 --max-workers 4 --out tmp/graphmetrics-tiering-calibration/smoke`
  - [x] 校准工件输出：`tmp/graphmetrics-tiering-calibration/smoke/latest.json`
  - [x] 当前主机建议快照：`asyncNodeCountThreshold=500`、`asyncWorkloadBenefitRatioThreshold=115.4385`
- [x] `npm run test:wasm:parity:gates`（严格校验 + 严格性能门禁通过）
- [x] `npm run test:migration`（`27` 套件、`131` 测试通过）

---

# 2026-03-10 v1.5.36 - High-Priority WASM Method-Policy Continuation (Sparsity-Aware GraphMetrics Tiering + Scheduled Snapshot CI + Release Gate Enforcement)

## English Document

### Objective
Proceed the latest method-comparison recommendations end-to-end: close the GraphMetrics method-selection policy gap with sparsity-aware workload tiering, enforce strict wasm parity gates in release flow, and add periodic benchmark snapshots for drift tracking.

### Completed in This Iteration
- [x] **GraphMetrics method policy upgraded to workload-tier selection** (`src/backend/GraphMetrics.ts`):
  - [x] Added explicit async policy constants:
    - [x] `ASYNC_NODE_COUNT_THRESHOLD = 500`
    - [x] `ASYNC_WORKLOAD_BENEFIT_RATIO_THRESHOLD = 24`
  - [x] Added deterministic decision model `resolveExecutionDecision(...)` with reasons:
    - [x] `memory-saving-mode`
    - [x] `small-graph-threshold`
    - [x] `sparse-workload-threshold`
    - [x] `workload-tier-async`
  - [x] Changed runtime orchestration so sparse large graphs remain sequential (avoid low-yield async overhead), while heavy enough workloads still route to `wasm-adapter` -> `worker` fallback chain.
- [x] **Contract coverage updated for policy correctness** (`src/wasm.parity.output.equivalence.contract.test.ts`):
  - [x] Updated wasm-path equivalence fixture graph shape to dense-enough workload tier, preserving expected wasm-path contract.
  - [x] Added sparse-large-graph contract case asserting:
    - [x] wasm betweenness path is not called
    - [x] diagnostics mode is `sequential`
    - [x] diagnostics reason is `sparse-workload-threshold`
- [x] **CI enforcement expanded**:
  - [x] `npm publish` release workflow now enforces strict parity gate before package publish:
    - [x] `.github/workflows/npm-publish.yml`
    - [x] added `npm run test:wasm:parity:gates`
  - [x] Added periodic benchmark snapshot workflow:
    - [x] `.github/workflows/wasm-parity-benchmark-snapshots.yml`
    - [x] weekly cron + manual dispatch
    - [x] strict verify + strict perf benchmark run
    - [x] benchmark snapshot artifact upload (`actions/upload-artifact`)

### High-Priority Work Status (Current)
- [x] GraphMetrics method selection is no longer node-count-only; sparsity/workload characteristics now affect policy.
- [x] Strict wasm parity gating is now enforced in both migration CI matrix and npm release publishing flow.
- [x] Periodic benchmark snapshot automation is now available for longitudinal drift tracking.
- [ ] Remaining high-priority work is threshold calibration refinement across broader workload envelopes and host variability.

### Verification Gate (Executed)
- [x] `npx jest src/wasm.parity.output.equivalence.contract.test.ts --runInBand`
- [x] `npm run test:wasm:parity:gates`
  - [x] GraphMetrics p95 ratio (candidate/baseline): `0.0841`
  - [x] LayoutEngine p95 ratio (candidate/baseline): `0.0011`
- [x] `npm run test:migration` (`27` suites, `129` tests passed)

---

## 中文文档

### 目标
把最新方法对比报告中的建议完整落地：补齐 GraphMetrics 计算路径策略缺口（引入稀疏度/工作负载分层），在发布流程中强制严格 wasm parity 门禁，并增加周期性基准快照以跟踪长期性能漂移。

### 本轮完成
- [x] **GraphMetrics 策略升级为工作负载分层决策**（`src/backend/GraphMetrics.ts`）：
  - [x] 新增异步策略常量：
    - [x] `ASYNC_NODE_COUNT_THRESHOLD = 500`
    - [x] `ASYNC_WORKLOAD_BENEFIT_RATIO_THRESHOLD = 24`
  - [x] 新增确定性决策模型 `resolveExecutionDecision(...)`，输出原因：
    - [x] `memory-saving-mode`
    - [x] `small-graph-threshold`
    - [x] `sparse-workload-threshold`
    - [x] `workload-tier-async`
  - [x] 调整运行时编排：大而稀疏图优先顺序计算（避免低收益异步开销）；工作负载足够时继续走 `wasm-adapter` -> `worker` 回退链路。
- [x] **策略正确性契约同步增强**（`src/wasm.parity.output.equivalence.contract.test.ts`）：
  - [x] 将 wasm 路径等价测试图形调整为“满足分层阈值”的稠密形状，保持 wasm 预期行为契约不退化。
  - [x] 新增“大图但稀疏”契约用例，断言：
    - [x] 不调用 wasm betweenness 路径
    - [x] 诊断模式为 `sequential`
    - [x] 诊断原因为 `sparse-workload-threshold`
- [x] **CI 强制能力扩展**：
  - [x] npm 发布工作流新增严格 parity 门禁：
    - [x] `.github/workflows/npm-publish.yml`
    - [x] 新增 `npm run test:wasm:parity:gates`
  - [x] 新增周期性基准快照工作流：
    - [x] `.github/workflows/wasm-parity-benchmark-snapshots.yml`
    - [x] 每周定时 + 手工触发
    - [x] 执行严格 verify + 严格性能基准
    - [x] 上传基准快照工件（`actions/upload-artifact`）

### 当前高优先级状态
- [x] GraphMetrics 计算策略已从“仅节点数阈值”升级为“节点数 + 工作负载稀疏度”联合决策。
- [x] 严格 wasm parity 门禁已同时覆盖迁移 CI 与 npm 发布流程。
- [x] 周期性基准快照自动化已落地，可用于长期性能漂移跟踪。
- [ ] 剩余高优先级工作为更大负载范围与多主机环境下的阈值持续校准。

### 验证门禁（已执行）
- [x] `npx jest src/wasm.parity.output.equivalence.contract.test.ts --runInBand`
- [x] `npm run test:wasm:parity:gates`
  - [x] GraphMetrics p95 比值（candidate/baseline）：`0.0841`
  - [x] LayoutEngine p95 比值（candidate/baseline）：`0.0011`
- [x] `npm run test:migration`（`27` 套件、`129` 测试通过）

---

# 2026-03-10 v1.5.34 - High-Priority WASM Performance Guard Closure (Benchmark Threshold Gates + CI Regression Barrier)

## English Document

### Objective
Proceed from artifact provisioning to performance robustness: add enforceable wasm benchmark regression guards so CI can fail fast when candidate wasm performance regresses against baseline.

### Completed in This Iteration
- [x] **Performance guard model added** (`src/backend/algorithms/WasmParityBenchmarkGuards.ts`):
  - [x] Added per-metric guard evaluation for GraphMetrics and LayoutEngine.
  - [x] Supports ratio guard (`candidateP95 / baselineP95`) and absolute candidate p95 guard.
  - [x] Added aggregated pass/fail summary for multi-metric enforcement.
- [x] **Benchmark script hardened with regression thresholds** (`scripts/benchmark-wasm-parity.js`):
  - [x] Added guard args:
    - [x] `--max-candidate-to-baseline-graph-p95-ratio`
    - [x] `--max-candidate-to-baseline-layout-p95-ratio`
    - [x] `--max-candidate-graph-p95-ms`
    - [x] `--max-candidate-layout-p95-ms`
  - [x] Added guard results to benchmark report payload (`equivalence.performanceGuards`).
  - [x] Script now exits non-zero when configured guard thresholds are violated.
- [x] **Contract coverage expanded**:
  - [x] Added `src/wasm.parity.benchmark.guards.contract.test.ts`.
  - [x] Added guard contract suite to `npm run test:migration`.
- [x] **Gate scripts/CI barrier upgraded**:
  - [x] Added `benchmark:wasm:parity:strict:perf`.
  - [x] Updated `test:wasm:parity:gates` to run strict verify + strict perf guard benchmark.
  - [x] Existing CI `wasm-parity-strict-suite` now enforces performance regression barrier through updated gate script.

### High-Priority Work Status (Current)
- [x] WASM artifact is provisioned and `wasm-adapter` path is active under strict mode.
- [x] Strict parity gates now cover both activation and p95 performance regression checks.
- [x] Migration/build/Tauri/full-Jest remain green with enhanced guardrail depth.
- [ ] Remaining high-priority track is production-scale profiling/tuning and long-term threshold calibration.

### Verification Gate (Executed)
- [x] `npm run test:migration` (`27` suites, `128` tests passed)
- [x] `npm run test:wasm:parity:gates` (strict verify + strict perf guards passed)
- [x] `npm run build`
- [x] `npm run test:tauri` (`19` Rust tests passed)
- [x] `npm test` (`30` suites, `145` tests passed)

---

## 中文文档

### 目标
在工件落地之后继续推进性能稳健性收口：增加可强制执行的 wasm 基准回归门禁，使 CI 在候选 wasm 性能退化时能够快速失败。

### 本轮完成
- [x] **性能门禁模型落地**（`src/backend/algorithms/WasmParityBenchmarkGuards.ts`）：
  - [x] 新增 GraphMetrics / LayoutEngine 双指标门禁评估。
  - [x] 支持比值门禁（`candidateP95 / baselineP95`）与 candidate 绝对 p95 门禁。
  - [x] 新增多指标聚合通过/失败摘要。
- [x] **基准脚本回归阈值加固**（`scripts/benchmark-wasm-parity.js`）：
  - [x] 新增门禁参数：
    - [x] `--max-candidate-to-baseline-graph-p95-ratio`
    - [x] `--max-candidate-to-baseline-layout-p95-ratio`
    - [x] `--max-candidate-graph-p95-ms`
    - [x] `--max-candidate-layout-p95-ms`
  - [x] 在报告中输出门禁结果（`equivalence.performanceGuards`）。
  - [x] 当阈值被突破时脚本返回非零退出码。
- [x] **契约覆盖增强**：
  - [x] 新增 `src/wasm.parity.benchmark.guards.contract.test.ts`。
  - [x] 在 `npm run test:migration` 纳入该套件。
- [x] **门禁脚本与 CI 屏障升级**：
  - [x] 新增 `benchmark:wasm:parity:strict:perf`。
  - [x] `test:wasm:parity:gates` 更新为严格校验 + 严格性能门禁基准。
  - [x] 现有 CI `wasm-parity-strict-suite` 已通过更新后的脚本强制执行性能回归屏障。

### 当前高优先级状态
- [x] WASM 工件已落地，严格模式下 `wasm-adapter` 已可真实激活。
- [x] 严格 parity 门禁现已同时覆盖“激活校验 + p95 性能回归校验”。
- [x] 在门禁加固后 migration/build/Tauri/全量 Jest 继续全绿。
- [ ] 剩余高优先级工作聚焦生产规模 profiling/调优与长期阈值校准。

### 验证门禁（已执行）
- [x] `npm run test:migration`（`27` 套件、`128` 测试通过）
- [x] `npm run test:wasm:parity:gates`（严格校验 + 严格性能门禁基准通过）
- [x] `npm run build`
- [x] `npm run test:tauri`（`19` 项 Rust 测试通过）
- [x] `npm test`（`30` 套件、`145` 测试通过）

---

# 2026-03-10 v1.5.33 - High-Priority WASM Artifact Provisioning Closure (Rust WASM ABI Module + Strict Gate Activation + CI Wiring)

## English Document

### Objective
Close the high-priority blocker by provisioning a real wasm parity artifact (instead of fallback-only simulation), then validate strict gate behavior end-to-end.

### Completed in This Iteration
- [x] **Real wasm parity artifact provisioned**:
  - [x] Added Rust wasm crate at `src/backend/wasm/` (`Cargo.toml`, `src/lib.rs`).
  - [x] Implemented required JSON ABI exports:
    - [x] `compute_layout_json`
    - [x] `compute_betweenness_json`
    - [x] `get_last_result_len`
    - [x] `alloc`
    - [x] `dealloc`
    - [x] `memory` export (from wasm module runtime)
  - [x] Implemented deterministic layout output and betweenness Brandes-style directed computation in wasm.
  - [x] Generated and provisioned artifact: `src/backend/wasm/noteconnection_compute.wasm`.
- [x] **Build/runtime synchronization hardened**:
  - [x] Added `scripts/build-wasm-parity-artifact.js` (`npm run build:wasm:parity`) for deterministic artifact build/provision.
  - [x] Added `scripts/sync-wasm-parity-artifact.js` and integrated into `build` / `build:mini` to copy artifact into `dist/src/backend/wasm/`.
  - [x] Added `src/backend/wasm/target/` ignore rule to avoid VCS pollution from Rust build output.
- [x] **Contracts and gates expanded**:
  - [x] Added provisioning contract: `src/wasm.parity.artifact.provisioning.contract.test.ts`.
  - [x] Hardened `src/wasm.parity.artifact.probe.contract.test.ts` to be environment-independent (mocked no-artifact path resolution).
  - [x] Added strict wasm gate script: `npm run test:wasm:parity:gates`.
  - [x] Added strict wasm gate job to CI workflow: `.github/workflows/migration-gates.yml`.
  - [x] Updated `test:gates` to include strict wasm parity gates.

### High-Priority Work Status (Current)
- [x] WASM artifact is now provisioned and discoverable in canonical runtime paths.
- [x] Strict verifier and strict benchmark both pass with active `wasm-adapter` mode.
- [x] Candidate benchmark path now enters `wasm-adapter` for both GraphMetrics and LayoutEngine.
- [x] Full migration/build/Tauri/full-Jest feasibility remains green after provisioning.
- [ ] Remaining optimization work: production-scale perf tuning and long-horizon parity monitoring.

### Verification Gate (Executed)
- [x] `npm run build:wasm:parity`
- [x] `npm run verify:wasm:parity`
- [x] `npm run verify:wasm:parity:strict`
- [x] `npm run benchmark:wasm:parity:strict` (candidate mode reached `wasm-adapter`)
- [x] `npm run test:wasm:parity:gates`
- [x] `npm run test:migration` (`26` suites, `124` tests passed)
- [x] `npm run build`
- [x] `npm run test:tauri` (`19` Rust tests passed)
- [x] `npm test` (`29` suites, `141` tests passed)

---

## 中文文档

### 目标
闭环当前高优先级阻塞项：提供真实可用的 wasm parity 工件（不再仅依赖回退路径），并完成严格门禁端到端验证。

### 本轮完成
- [x] **真实 wasm parity 工件已落地**：
  - [x] 新增 Rust wasm crate：`src/backend/wasm/`（`Cargo.toml`、`src/lib.rs`）。
  - [x] 实现必需 JSON ABI 导出：
    - [x] `compute_layout_json`
    - [x] `compute_betweenness_json`
    - [x] `get_last_result_len`
    - [x] `alloc`
    - [x] `dealloc`
    - [x] `memory`（wasm 运行时导出）
  - [x] 在 wasm 内实现确定性布局输出与有向 Brandes 风格中心性计算。
  - [x] 工件已生成并落地：`src/backend/wasm/noteconnection_compute.wasm`。
- [x] **构建与运行时同步加固**：
  - [x] 新增 `scripts/build-wasm-parity-artifact.js`（`npm run build:wasm:parity`）用于确定性构建与落地。
  - [x] 新增 `scripts/sync-wasm-parity-artifact.js`，并接入 `build` / `build:mini`，自动同步到 `dist/src/backend/wasm/`。
  - [x] 新增 `src/backend/wasm/target/` 忽略规则，避免 Rust 构建产物污染版本库。
- [x] **契约与门禁增强**：
  - [x] 新增工件落地契约：`src/wasm.parity.artifact.provisioning.contract.test.ts`。
  - [x] 加固 `src/wasm.parity.artifact.probe.contract.test.ts`，改为与环境无关（mock 无工件路径解析）。
  - [x] 新增严格 wasm 门禁脚本：`npm run test:wasm:parity:gates`。
  - [x] 在 CI 工作流 `.github/workflows/migration-gates.yml` 新增严格 wasm 门禁任务。
  - [x] `test:gates` 已纳入严格 wasm parity 门禁。

### 当前高优先级状态
- [x] WASM 工件已落地，并可在标准运行时路径被发现。
- [x] 严格 verifier 与严格 benchmark 均通过，且 `wasm-adapter` 已真实激活。
- [x] 基准 candidate 路径在 GraphMetrics/LayoutEngine 上均进入 `wasm-adapter`。
- [x] 工件落地后 migration/build/Tauri/全量 Jest 仍全绿。
- [ ] 后续重点转为生产规模性能优化与长期等价监控。

### 验证门禁（已执行）
- [x] `npm run build:wasm:parity`
- [x] `npm run verify:wasm:parity`
- [x] `npm run verify:wasm:parity:strict`
- [x] `npm run benchmark:wasm:parity:strict`（candidate 已进入 `wasm-adapter`）
- [x] `npm run test:wasm:parity:gates`
- [x] `npm run test:migration`（`26` 套件、`124` 测试通过）
- [x] `npm run build`
- [x] `npm run test:tauri`（`19` 项 Rust 测试通过）
- [x] `npm test`（`29` 套件、`141` 测试通过）

---

# 2026-03-10 v1.5.32 - High-Priority WASM Artifact Readiness Closure (Probe + Strict Verify Gate + Full Feasibility Revalidation)

## English Document

### Objective
Continue the high-priority wasm parity stream by making artifact readiness explicit and enforceable, then revalidate end-to-end feasibility with strict/non-strict evidence commands.

### Completed in This Iteration
- [x] **Artifact readiness probe implemented** (`src/backend/algorithms/WasmParityArtifactProbe.ts`):
  - [x] Added required export baseline (`compute_layout_json`, `compute_betweenness_json`, `get_last_result_len`, `alloc`, `dealloc`, `memory`).
  - [x] Added explicit probe result model for `artifact-not-found`, `path-not-found`, export gaps, and instantiation failures.
  - [x] Added reusable missing-export helper for contracts/tooling.
- [x] **Verifier CLI added** (`scripts/verify-wasm-parity.js`):
  - [x] Added args support: `--wasm-path`, `--strict`, `--out`.
  - [x] Added strict-mode non-zero exit when artifact readiness is not met.
  - [x] Added JSON payload output for CI evidence archiving.
- [x] **NPM strict-entry hardening completed** (`package.json`):
  - [x] Added `verify:wasm:parity:strict` to avoid npm arg-forwarding ambiguity with `--strict`.
  - [x] Kept non-strict verifier entrypoint for routine diagnostics (`verify:wasm:parity`).
- [x] **Contract safety net expanded**:
  - [x] Added `src/wasm.parity.artifact.probe.contract.test.ts`.
  - [x] Added probe contract suite into `npm run test:migration`.
- [x] **Benchmark + verifier feasibility evidence refreshed**:
  - [x] Refreshed benchmark evidence at `tmp/wasm-parity-benchmark/latest.json`.
  - [x] Added verifier evidence at `tmp/wasm-parity-benchmark/verify-latest.json`.
  - [x] Confirmed strict verifier/benchmark commands fail as expected when wasm artifact is unavailable.

### High-Priority Work Status (Current)
- [x] Artifact readiness is now explicitly measurable and script-enforceable.
- [x] Strict CI-style gates exist for both verifier and benchmark paths.
- [x] Full migration/build/Tauri/full-Jest gates pass after this slice.
- [ ] Current environment still lacks a wasm artifact; runtime remains worker fallback.
- [ ] Production-scale wasm-adapter parity/performance closure remains open until artifact availability is solved.

### Verification Gate (Executed)
- [x] `npx jest src/wasm.parity.artifact.probe.contract.test.ts --runInBand`
- [x] `npx tsc --pretty false`
- [x] `npm run verify:wasm:parity`
- [x] `npm run verify:wasm:parity:strict` (expected non-zero exit: `artifact-not-found`)
- [x] `npm run benchmark:wasm:parity`
- [x] `npm run benchmark:wasm:parity:strict` (expected non-zero exit: candidate did not reach `wasm-adapter`)
- [x] `npm run test:migration` (`25` suites, `123` tests passed)
- [x] `npm run build`
- [x] `npm run test:tauri` (`19` Rust tests passed)
- [x] `npm test` (`28` suites, `140` tests passed)

---

## 中文文档

### 目标
继续推进高优先级 wasm 等价收口：把 wasm 工件可用性做成“可测量、可强制”的门禁能力，并在严格/非严格路径下完成端到端可行性复验。

### 本轮完成
- [x] **工件可用性探针落地**（`src/backend/algorithms/WasmParityArtifactProbe.ts`）：
  - [x] 新增必需导出基线（`compute_layout_json`、`compute_betweenness_json`、`get_last_result_len`、`alloc`、`dealloc`、`memory`）。
  - [x] 新增探针结果模型，覆盖 `artifact-not-found`、`path-not-found`、导出缺失与实例化失败。
  - [x] 新增缺失导出辅助函数，供契约与工具链复用。
- [x] **校验 CLI 落地**（`scripts/verify-wasm-parity.js`）：
  - [x] 支持参数：`--wasm-path`、`--strict`、`--out`。
  - [x] 在严格模式下，当工件不就绪时返回非零退出码。
  - [x] 输出 JSON 结果，便于 CI 证据归档。
- [x] **NPM 严格入口加固完成**（`package.json`）：
  - [x] 新增 `verify:wasm:parity:strict`，规避 npm 对 `--strict` 透传歧义。
  - [x] 保留日常诊断入口 `verify:wasm:parity`。
- [x] **契约护栏增强**：
  - [x] 新增 `src/wasm.parity.artifact.probe.contract.test.ts`。
  - [x] 在 `npm run test:migration` 纳入探针契约套件。
- [x] **基准与校验证据已刷新**：
  - [x] 基准证据刷新到 `tmp/wasm-parity-benchmark/latest.json`。
  - [x] 校验证据输出到 `tmp/wasm-parity-benchmark/verify-latest.json`。
  - [x] 已确认：在 wasm 工件不可用时，严格校验/严格基准会按预期失败。

### 当前高优先级状态
- [x] 工件可用性已可被显式测量并可脚本化强制。
- [x] verifier 与 benchmark 均具备严格门禁路径。
- [x] 本切片后 migration/build/Tauri/全量 Jest 仍全绿。
- [ ] 当前环境仍缺少 wasm 工件，运行时仍走 worker 回退。
- [ ] 生产级 wasm-adapter 的规模等价与性能闭环仍待工件可用性闭环后完成。

### 验证门禁（已执行）
- [x] `npx jest src/wasm.parity.artifact.probe.contract.test.ts --runInBand`
- [x] `npx tsc --pretty false`
- [x] `npm run verify:wasm:parity`
- [x] `npm run verify:wasm:parity:strict`（预期非零退出：`artifact-not-found`）
- [x] `npm run benchmark:wasm:parity`
- [x] `npm run benchmark:wasm:parity:strict`（预期非零退出：candidate 未进入 `wasm-adapter`）
- [x] `npm run test:migration`（`25` 套件、`123` 测试通过）
- [x] `npm run build`
- [x] `npm run test:tauri`（`19` 项 Rust 测试通过）
- [x] `npm test`（`28` 套件、`140` 测试通过）

---

# 2026-03-10 v1.5.31 - High-Priority Worker↔WASM Baseline Harness (Benchmark Script + Evidence Artifact + Contract Guards)

## English Document

### Objective
Proceed with the remaining high-priority parity closure by adding a reproducible benchmark/equivalence baseline workflow for heavy compute, so worker↔wasm comparisons are evidence-driven and repeatable.

### Completed in This Iteration
- [x] **Benchmark utility module added** (`src/backend/algorithms/WasmParityBenchmark.ts`):
  - [x] Added deterministic heavy-graph fixture builder (`buildDeterministicBenchmarkGraph`).
  - [x] Added percentile latency summary helper (`summarizeDurations`, p50/p95/p99).
  - [x] Added map-equivalence summary helper for betweenness outputs (`summarizeBetweennessDifference`).
- [x] **Runnable benchmark/evidence pipeline added** (`scripts/benchmark-wasm-parity.js`):
  - [x] Added baseline scenario (wasm disabled) and candidate scenario (wasm enabled) execution flow.
  - [x] Collects heavy-compute mode telemetry + latency stats + layout finite-coverage.
  - [x] Writes timestamped and latest JSON evidence artifacts under `tmp/wasm-parity-benchmark/`.
  - [x] Supports both named args (`--iterations`, `--nodes`, `--max-workers`, `--wasm-path`, `--out`) and positional args.
  - [x] Added optional strict gate (`--require-wasm-adapter`) for CI/release environments that must fail if wasm path is not actually active.
- [x] **Contract safety net expanded**:
  - [x] Added `src/wasm.parity.benchmark.contract.test.ts` for benchmark math/fixture invariants.
  - [x] Added benchmark contract suite to `npm run test:migration`.
  - [x] Added npm entrypoint: `npm run benchmark:wasm:parity`.
- [x] **Live feasibility evidence captured**:
  - [x] Executed benchmark and generated report (`tmp/wasm-parity-benchmark/latest.json`).
  - [x] Current environment evidence shows candidate mode remains worker fallback because wasm artifact is not available (`artifact-not-found`).

### High-Priority Work Status (Current)
- [x] Worker↔wasm baseline harness now exists and produces reproducible JSON evidence.
- [x] Equivalence math and latency summaries are now contract-tested.
- [ ] Production wasm artifact parity/performance at scale is still open.
- [ ] Candidate runtime still does not enter `wasm-adapter` mode in current environment until artifact availability is closed.

### Verification Gate (Executed)
- [x] `npx jest src/wasm.parity.benchmark.contract.test.ts --runInBand`
- [x] `node scripts/benchmark-wasm-parity.js 1 500`
- [x] `npx tsc --pretty false`
- [x] `npm run test:migration` (`24` suites, `119` tests passed)
- [x] `npm run build`
- [x] `npm run test:tauri` (`19` Rust tests passed)
- [x] `npm test` (`27` suites, `136` tests passed)

---

## 中文文档

### 目标
继续推进剩余高优先级等价收口：落地可复现的 worker↔wasm 基准/等价基线流程，使重计算对比从“口头判断”升级为“证据驱动”。

### 本轮完成
- [x] **基准工具模块落地**（`src/backend/algorithms/WasmParityBenchmark.ts`）：
  - [x] 新增确定性重图夹具构造（`buildDeterministicBenchmarkGraph`）。
  - [x] 新增延迟百分位汇总（`summarizeDurations`，p50/p95/p99）。
  - [x] 新增介数中心性结果等价汇总（`summarizeBetweennessDifference`）。
- [x] **可执行基准与证据流水线落地**（`scripts/benchmark-wasm-parity.js`）：
  - [x] 新增 baseline（关闭 wasm）与 candidate（开启 wasm）双场景执行流程。
  - [x] 采集重计算模式遥测、延迟统计、布局有限坐标覆盖率。
  - [x] 输出时间戳报告与 `latest.json` 到 `tmp/wasm-parity-benchmark/`。
  - [x] 同时支持命名参数（`--iterations`、`--nodes`、`--max-workers`、`--wasm-path`、`--out`）与位置参数。
  - [x] 新增可选严格门禁（`--require-wasm-adapter`），用于 CI/发布环境在 wasm 未实际激活时强制失败。
- [x] **契约护栏增强**：
  - [x] 新增 `src/wasm.parity.benchmark.contract.test.ts`，覆盖基准统计与夹具不变量。
  - [x] 在 `npm run test:migration` 中纳入该套件。
  - [x] 新增 npm 入口：`npm run benchmark:wasm:parity`。
- [x] **真实可行性证据已采集**：
  - [x] 执行基准并生成报告（`tmp/wasm-parity-benchmark/latest.json`）。
  - [x] 当前环境证据显示 candidate 仍走 worker 回退，原因为 wasm 工件不可用（`artifact-not-found`）。

### 当前高优先级状态
- [x] worker↔wasm 基准基线能力已落地，可稳定产出 JSON 证据。
- [x] 等价统计与延迟汇总逻辑已具备契约测试护栏。
- [ ] 生产级 wasm 工件在大规模场景的等价与性能仍待闭环。
- [ ] 在当前环境中，candidate 尚未进入 `wasm-adapter`，需先闭环 wasm 工件可用性。

### 验证门禁（已执行）
- [x] `npx jest src/wasm.parity.benchmark.contract.test.ts --runInBand`
- [x] `node scripts/benchmark-wasm-parity.js 1 500`
- [x] `npx tsc --pretty false`
- [x] `npm run test:migration`（`24` 套件、`119` 测试通过）
- [x] `npm run build`
- [x] `npm run test:tauri`（`19` 项 Rust 测试通过）
- [x] `npm test`（`27` 套件、`136` 测试通过）

---

# 2026-03-09 v1.5.30 - High-Priority Compute-Mode Telemetry Closure (WASM/Worker/Sequential/GPU Diagnostics + API Surfacing)

## English Document

### Objective
Continue the high-priority parity/robustness stream by making heavy-compute execution mode observable and contract-tested end-to-end, so release verification can confirm real runtime fallback behavior instead of relying on log inspection.

### Completed in This Iteration
- [x] **Heavy-compute diagnostics implemented**:
  - [x] Added `GraphMetrics` compute diagnostics (`none`/`wasm-adapter`/`worker`/`sequential`) with node/edge counts, duration, reason, and timestamp.
  - [x] Added `LayoutEngine` compute diagnostics (`none`/`gpu`/`wasm-adapter`/`worker`/`skipped`) with the same telemetry fields.
  - [x] Added deterministic reset hooks for test isolation in both engines.
- [x] **Server telemetry surface expanded** (`src/server.ts`):
  - [x] `GET /api/runtime-diagnostics` now includes `computeModes` snapshot (`layoutEngine`, `graphMetrics`).
  - [x] `POST /api/build` success and dedup responses now include `computeModes` snapshot for immediate build-path observability.
- [x] **Contract coverage expanded**:
  - [x] `src/server.migration.test.ts` now asserts `computeModes` shape in runtime diagnostics and build responses.
  - [x] `src/wasm.parity.output.equivalence.contract.test.ts` now asserts telemetry mode/reason for wasm path, sequential threshold path, and worker-unavailable layout fallback path.
- [x] **Full feasibility revalidation completed** with updated suite/test totals.

### High-Priority Work Status (Current)
- [x] Heavy-compute runtime path (WASM/worker/sequential/GPU/skipped) is now API-visible and contract-guarded.
- [x] Deterministic fallback behavior remains unchanged while observability depth increased.
- [ ] Production wasm artifact parity/performance at real workload scale remains open.
- [ ] Real workload worker↔wasm benchmark baselines (throughput, p95/p99 latency, memory profile) remain open.

### Verification Gate (Executed)
- [x] `npx jest src/wasm.parity.output.equivalence.contract.test.ts src/server.migration.test.ts --runInBand`
- [x] `npx tsc --pretty false`
- [x] `npm run test:migration` (`23` suites, `114` tests passed)
- [x] `npm run build`
- [x] `npm run test:tauri` (`19` Rust tests passed)
- [x] `npm test` (`26` suites, `131` tests passed)

---

## 中文文档

### 目标
继续推进高优先级等价性与稳健性收口：将重计算链路执行模式做成可观测、可契约化能力，发布验证时可直接确认真实回退路径，而不再依赖日志人工判断。

### 本轮完成
- [x] **重计算诊断能力落地**：
  - [x] `GraphMetrics` 新增计算模式诊断（`none`/`wasm-adapter`/`worker`/`sequential`），包含节点数、边数、耗时、原因、时间戳。
  - [x] `LayoutEngine` 新增计算模式诊断（`none`/`gpu`/`wasm-adapter`/`worker`/`skipped`），字段与上面一致。
  - [x] 两个引擎均新增测试隔离用的确定性重置入口。
- [x] **Server 可观测面扩展**（`src/server.ts`）：
  - [x] `GET /api/runtime-diagnostics` 新增 `computeModes` 快照（`layoutEngine`、`graphMetrics`）。
  - [x] `POST /api/build` 的成功与去重响应新增 `computeModes`，便于构建后立即确认执行路径。
- [x] **契约覆盖增强**：
  - [x] `src/server.migration.test.ts` 新增/更新断言，覆盖运行时诊断与构建响应中的 `computeModes` 结构。
  - [x] `src/wasm.parity.output.equivalence.contract.test.ts` 新增模式断言，覆盖 wasm 成功路径、小图顺序路径、布局 worker 不可用回退路径。
- [x] **全门禁复验完成**，并同步更新套件/测试数量。

### 当前高优先级状态
- [x] 重计算运行模式（WASM/worker/sequential/GPU/skipped）已实现 API 级可观测并具备契约护栏。
- [x] 在增强可观测性的同时，既有确定性回退行为保持不变。
- [ ] 生产级 wasm 工件在真实负载下的等价/性能仍待闭环。
- [ ] 真实负载 worker↔wasm 基准（吞吐、p95/p99 延迟、内存画像）仍待闭环。

### 验证门禁（已执行）
- [x] `npx jest src/wasm.parity.output.equivalence.contract.test.ts src/server.migration.test.ts --runInBand`
- [x] `npx tsc --pretty false`
- [x] `npm run test:migration`（`23` 套件、`114` 测试通过）
- [x] `npm run build`
- [x] `npm run test:tauri`（`19` 项 Rust 测试通过）
- [x] `npm test`（`26` 套件、`131` 测试通过）

---

# 2026-03-09 v1.5.29 - High-Priority Runtime Observability Closure (Sidecar Diagnostics Endpoint + WASM State Exposure)

## English Document

### Objective
Continue high-priority robustness closure by exposing sidecar runtime diagnostics through an authenticated API surface, including wasm parity runtime state for fast feasibility triage.

### Completed in This Iteration
- [x] **Runtime diagnostics API added** (`src/server.ts`):
  - [x] Added `GET /api/runtime-diagnostics`.
  - [x] Returns sidecar runtime context (host/port/paths/auth-required) without leaking auth secrets.
  - [x] Includes `WasmParityRuntime.getDiagnostics()` output for parity state introspection.
  - [x] Includes PathBridge summary/status when available.
- [x] **Migration contract coverage expanded** (`src/server.migration.test.ts`):
  - [x] Added endpoint contract test for `/api/runtime-diagnostics`.
  - [x] Added explicit assertion that auth token is not exposed in diagnostics payload.
- [x] **Full feasibility revalidation completed**:
  - [x] Migration/build/Tauri/full Jest gates pass after diagnostics endpoint integration.

### High-Priority Work Status (Current)
- [x] Runtime observability now includes wasm parity diagnostics at server API level.
- [x] Sidecar diagnostics can be consumed by tooling/QA without exposing credentials.
- [ ] Production wasm artifact parity/performance at scale remains open.
- [ ] Worker ↔ wasm benchmark-equivalence baselines remain open.

### Verification Gate (Executed)
- [x] `npx jest src/server.migration.test.ts src/wasm.parity.runtime.functional.test.ts src/wasm.parity.output.equivalence.contract.test.ts --runInBand`
- [x] `npx tsc --pretty false`
- [x] `npm run test:migration` (`23` suites, `112` tests passed)
- [x] `npm run build`
- [x] `npm run test:tauri` (`19` Rust tests passed)
- [x] `npm test` (`26` suites, `129` tests passed)

---

## 中文文档

### 目标
继续推进高优先级稳健性收口：通过鉴权 API 暴露 sidecar 运行时诊断信息，并纳入 wasm parity 状态，提升可行性排障效率。

### 本轮完成
- [x] **运行时诊断 API 落地**（`src/server.ts`）：
  - [x] 新增 `GET /api/runtime-diagnostics`。
  - [x] 返回 sidecar 运行时上下文（host/port/路径/是否需要鉴权），且不泄露鉴权密钥。
  - [x] 集成 `WasmParityRuntime.getDiagnostics()` 输出，支持 parity 状态观测。
  - [x] 在可用时返回 PathBridge summary/status。
- [x] **迁移契约覆盖增强**（`src/server.migration.test.ts`）：
  - [x] 新增 `/api/runtime-diagnostics` 契约测试。
  - [x] 明确断言诊断结果中不暴露 auth token。
- [x] **全门禁复验完成**：
  - [x] 诊断端点接入后 migration/build/Tauri/全量 Jest 全部通过。

### 当前高优先级状态
- [x] 运行时可观测性已在 server API 层覆盖 wasm parity 诊断信息。
- [x] sidecar 诊断可被工具链/QA 消费且不暴露凭据。
- [ ] 生产级 wasm 工件的大规模等价与性能仍待闭环。
- [ ] worker 与 wasm 的基准等价回归仍待闭环。

### 验证门禁（已执行）
- [x] `npx jest src/server.migration.test.ts src/wasm.parity.runtime.functional.test.ts src/wasm.parity.output.equivalence.contract.test.ts --runInBand`
- [x] `npx tsc --pretty false`
- [x] `npm run test:migration`（`23` 套件、`112` 测试通过）
- [x] `npm run build`
- [x] `npm run test:tauri`（`19` 项 Rust 测试通过）
- [x] `npm test`（`26` 套件、`129` 测试通过）

---

# 2026-03-09 v1.5.28 - High-Priority WASM Runtime Resilience (Retry Window + Diagnostics + Fallback Contracts)

## English Document

### Objective
Continue high-priority WASM parity hardening by making runtime fallback recoverable after missing artifacts, adding diagnostics visibility, and expanding functional contracts for retry-window behavior.

### Completed in This Iteration
- [x] **WASM runtime resilience hardening** (`src/backend/algorithms/WasmParityRuntime.ts`):
  - [x] Added retry-window mechanism for failed/missing artifact loads (`NOTE_CONNECTION_WASM_RETRY_MS`, default 5000ms) to avoid permanent null-cache lock.
  - [x] Added runtime diagnostics surface:
    - [x] `getDiagnostics()`
    - [x] `WasmParityRuntimeDiagnostics`
    - [x] `WasmParityExecutionMode`
  - [x] Added explicit execution-mode tracking (`json-layout`, `json-betweenness`, `legacy-*`, `fallback`).
  - [x] Added deterministic test-reset helper (`__resetForTests()`).
- [x] **Functional parity contracts expanded** (`src/wasm.parity.runtime.functional.test.ts`):
  - [x] Added diagnostics assertion after JSON ABI success.
  - [x] Added retry-window contract ensuring failed loads are not retried before retry interval, but do retry after interval.
- [x] **Full gate revalidation completed**:
  - [x] Migration/build/Tauri/full Jest gates all pass with updated test matrix.

### High-Priority Work Status (Current)
- [x] WASM runtime fallback is now recoverable across runtime lifecycle instead of permanently cached null.
- [x] Diagnostics and execution-mode visibility are available for parity troubleshooting and release verification.
- [ ] Production wasm artifact parity/performance at scale remains open.
- [ ] Worker ↔ wasm benchmark-equivalence baselines remain open.

### Verification Gate (Executed)
- [x] `npx jest src/wasm.parity.runtime.functional.test.ts src/wasm.parity.runtime.contract.test.ts src/wasm.parity.output.equivalence.contract.test.ts --runInBand`
- [x] `npx tsc --pretty false`
- [x] `npm run test:migration` (`23` suites, `111` tests passed)
- [x] `npm run build`
- [x] `npm run test:tauri` (`19` Rust tests passed)
- [x] `npm test` (`26` suites, `128` tests passed)

---

## 中文文档

### 目标
继续推进高优先级 WASM 等价加固：让缺失工件后的回退具备可恢复性，补齐运行时诊断可见性，并扩展重试窗口行为的功能契约。

### 本轮完成
- [x] **WASM 运行时韧性加固**（`src/backend/algorithms/WasmParityRuntime.ts`）：
  - [x] 新增失败/缺失工件加载的重试窗口机制（`NOTE_CONNECTION_WASM_RETRY_MS`，默认 5000ms），避免永久 null 缓存锁死。
  - [x] 新增运行时诊断接口：
    - [x] `getDiagnostics()`
    - [x] `WasmParityRuntimeDiagnostics`
    - [x] `WasmParityExecutionMode`
  - [x] 新增执行模式跟踪（`json-layout`、`json-betweenness`、`legacy-*`、`fallback`）。
  - [x] 新增测试重置辅助（`__resetForTests()`）。
- [x] **功能契约覆盖增强**（`src/wasm.parity.runtime.functional.test.ts`）：
  - [x] 增加 JSON ABI 成功后的诊断断言。
  - [x] 增加重试窗口契约：重试间隔内不重复加载，超过间隔后可重新尝试加载。
- [x] **全门禁复验完成**：
  - [x] 测试矩阵更新后 migration/build/Tauri/全量 Jest 全部通过。

### 当前高优先级状态
- [x] WASM 回退链路已从“永久失败缓存”升级为“运行时可恢复”。
- [x] 已具备用于等价排障与发布验证的诊断与执行模式可见性。
- [ ] 生产级 wasm 工件的大规模等价与性能仍待闭环。
- [ ] worker 与 wasm 的基准等价回归仍待闭环。

### 验证门禁（已执行）
- [x] `npx jest src/wasm.parity.runtime.functional.test.ts src/wasm.parity.runtime.contract.test.ts src/wasm.parity.output.equivalence.contract.test.ts --runInBand`
- [x] `npx tsc --pretty false`
- [x] `npm run test:migration`（`23` 套件、`111` 测试通过）
- [x] `npm run build`
- [x] `npm run test:tauri`（`19` 项 Rust 测试通过）
- [x] `npm test`（`26` 套件、`128` 测试通过）

---

# 2026-03-09 v1.5.27 - High-Priority WASM Parity Hardening (Output-Equivalence Contracts + Worker-Lazy Fallback Resolution)

## English Document

### Objective
Continue high-priority WASM parity closure by adding orchestration-level output-equivalence contracts and reducing unnecessary worker fallback overhead when wasm results are already available.

### Completed in This Iteration
- [x] **Output-equivalence orchestration contracts added**:
  - [x] Added `src/wasm.parity.output.equivalence.contract.test.ts`.
  - [x] Added parity assertions for:
    - [x] `GraphMetrics.calculateBetweennessAsync(...)` using wasm-returned map equivalence with sequential baseline map.
    - [x] `LayoutEngine.computeLayout(...)` applying wasm node positions exactly.
  - [x] Added the suite to `npm run test:migration`.
- [x] **Layout fallback-path efficiency hardening** (`src/backend/algorithms/LayoutEngine.ts`):
  - [x] Reordered runtime flow so worker runtime resolution/logging occurs only when gpu/wasm paths do not satisfy the request.
  - [x] Kept deterministic worker fallback behavior unchanged.
- [x] **Full feasibility revalidation completed**:
  - [x] Migration/build/Tauri/full Jest gates all pass after the new contracts + runtime refactor.

### High-Priority Work Status (Current)
- [x] Runtime-level WASM orchestration now has functional + output-equivalence contract coverage.
- [x] Layout path no longer performs unnecessary worker-runtime resolution when wasm already returns results.
- [ ] Production wasm artifact equivalence at scale remains open.
- [ ] Worker ↔ wasm performance-benchmark baselines remain open.

### Verification Gate (Executed)
- [x] `npx jest src/wasm.parity.output.equivalence.contract.test.ts src/wasm.parity.runtime.functional.test.ts src/wasm.parity.runtime.contract.test.ts --runInBand`
- [x] `npx tsc --pretty false`
- [x] `npm run test:migration` (`23` suites, `109` tests passed)
- [x] `npm run build`
- [x] `npm run test:tauri` (`19` Rust tests passed)
- [x] `npm test` (`26` suites, `126` tests passed)

---

## 中文文档

### 目标
继续推进高优先级 WASM 等价收口：补齐编排层输出一致性契约，并在 wasm 成功返回时减少不必要的 worker 回退链路解析开销。

### 本轮完成
- [x] **输出一致性编排契约补齐**：
  - [x] 新增 `src/wasm.parity.output.equivalence.contract.test.ts`。
  - [x] 新增等价断言覆盖：
    - [x] `GraphMetrics.calculateBetweennessAsync(...)`：wasm 返回结果与顺序基线 map 一致。
    - [x] `LayoutEngine.computeLayout(...)`：wasm 节点坐标被精确应用。
  - [x] 在 `npm run test:migration` 纳入该套件。
- [x] **布局回退链路效率加固**（`src/backend/algorithms/LayoutEngine.ts`）：
  - [x] 将 worker 运行时解析/日志后移，仅在 gpu/wasm 路径未满足时触发。
  - [x] 保持确定性 worker 回退行为不变。
- [x] **可行性门禁全量复验**：
  - [x] 新契约与运行时重排后，migration/build/Tauri/全量 Jest 门禁全部通过。

### 当前高优先级状态
- [x] WASM 编排层已具备“功能契约 + 输出一致性契约”双重覆盖。
- [x] 布局路径在 wasm 成功场景下不再进行不必要的 worker 运行时解析。
- [ ] 生产级 wasm 工件的大规模等价性仍待闭环。
- [ ] worker 与 wasm 的性能基线回归仍待闭环。

### 验证门禁（已执行）
- [x] `npx jest src/wasm.parity.output.equivalence.contract.test.ts src/wasm.parity.runtime.functional.test.ts src/wasm.parity.runtime.contract.test.ts --runInBand`
- [x] `npx tsc --pretty false`
- [x] `npm run test:migration`（`23` 套件、`109` 测试通过）
- [x] `npm run build`
- [x] `npm run test:tauri`（`19` 项 Rust 测试通过）
- [x] `npm test`（`26` 套件、`126` 测试通过）

---

# 2026-03-09 v1.5.26 - High-Priority WASM Parity Continuation (JSON ABI Result Path + Functional Contracts + Full Gate Revalidation)

## English Document

### Objective
Continue the high-priority WASM parity implementation by closing the runtime JSON ABI result path, adding functional regression contracts for decode/fallback behavior, and revalidating full project feasibility gates.

### Completed in This Iteration
- [x] **WASM JSON ABI result path implemented** (`src/backend/algorithms/WasmParityRuntime.ts`):
  - [x] Added JSON ABI entrypoints support: `compute_layout_json`, `compute_betweenness_json`.
  - [x] Added memory ABI primitives support: `alloc`, `dealloc`, `get_last_result_len`, `memory`.
  - [x] Added generic JSON ABI invocation flow (`invokeJsonAbiCall`) with deterministic fallback and safe deallocation guards.
  - [x] Added structured decoders for result payloads:
    - [x] `toLayoutResult(...)`
    - [x] `toBetweennessResult(...)`
- [x] **Functional regression coverage expanded**:
  - [x] Added `src/wasm.parity.runtime.functional.test.ts` to validate:
    - [x] layout JSON ABI success path
    - [x] betweenness JSON ABI success path
    - [x] incomplete ABI fallback (`null`)
    - [x] invalid JSON fallback (`null`)
  - [x] Added this suite to `npm run test:migration` in `package.json`.
- [x] **Feasibility gates revalidated end-to-end**:
  - [x] Targeted parity tests + type-check pass.
  - [x] Migration/build/Tauri/full Jest gates pass.

### High-Priority Work Status (Current)
- [x] Heavy compute runtime now supports JSON ABI result ingestion when wasm artifact exports are available.
- [x] Existing worker/sequential execution remains deterministic fallback when wasm runtime/ABI is missing or invalid.
- [ ] Production wasm artifact parity for full-scale layout/centrality workloads still needs closure.
- [ ] Node worker ↔ wasm output-equivalence/performance regression baselines still need closure.

### Verification Gate (Executed)
- [x] `npx jest src/wasm.parity.runtime.contract.test.ts src/wasm.parity.runtime.functional.test.ts --runInBand`
- [x] `npx tsc --pretty false`
- [x] `npm run test:migration` (`22` suites, `107` tests passed)
- [x] `npm run build`
- [x] `npm run test:tauri` (`19` Rust tests passed)
- [x] `npm test` (`25` suites, `124` tests passed)

---

## 中文文档

### 目标
继续推进高优先级 WASM 等价性实现：闭环运行时 JSON ABI 结果路径，补齐结果解码/回退的功能回归契约，并重新执行全量可行性验证门禁。

### 本轮完成
- [x] **WASM JSON ABI 结果链路落地**（`src/backend/algorithms/WasmParityRuntime.ts`）：
  - [x] 接入 JSON ABI 导出入口：`compute_layout_json`、`compute_betweenness_json`。
  - [x] 接入内存 ABI 基元：`alloc`、`dealloc`、`get_last_result_len`、`memory`。
  - [x] 新增通用 JSON ABI 调用流程（`invokeJsonAbiCall`），并保持确定性回退与安全释放护栏。
  - [x] 新增结果结构解码：
    - [x] `toLayoutResult(...)`
    - [x] `toBetweennessResult(...)`
- [x] **功能回归覆盖增强**：
  - [x] 新增 `src/wasm.parity.runtime.functional.test.ts`，覆盖：
    - [x] 布局 JSON ABI 成功路径
    - [x] 中心性 JSON ABI 成功路径
    - [x] ABI 不完整回退（`null`）
    - [x] 非法 JSON 回退（`null`）
  - [x] 在 `package.json` 的 `npm run test:migration` 中纳入该套件。
- [x] **可行性门禁全量复验**：
  - [x] 定向 parity 测试与类型检查通过。
  - [x] migration/build/Tauri/全量 Jest 门禁全部通过。

### 当前高优先级状态
- [x] 当 wasm 工件提供 JSON ABI 导出时，重计算运行时已可消费 wasm 结果输出。
- [x] 当 wasm 运行时或 ABI 缺失/异常时，现有 worker/顺序路径保持确定性回退。
- [ ] 面向大规模布局/中心性场景的生产级 wasm 工件等价闭环仍待完成。
- [ ] Node worker 与 wasm 的结果一致性/性能回归基线仍待完成。

### 验证门禁（已执行）
- [x] `npx jest src/wasm.parity.runtime.contract.test.ts src/wasm.parity.runtime.functional.test.ts --runInBand`
- [x] `npx tsc --pretty false`
- [x] `npm run test:migration`（`22` 套件、`107` 测试通过）
- [x] `npm run build`
- [x] `npm run test:tauri`（`19` 项 Rust 测试通过）
- [x] `npm test`（`25` 套件、`124` 测试通过）

---

# 2026-03-09 v1.5.25 - High-Priority WASM Parity Slice Start (Heavy Graph/Layout Runtime Adapter + Deterministic Fallback)

## English Document

### Objective
Start the WASM parity implementation slice for heavy graph/layout compute by wiring a shared backend WASM runtime adapter into existing heavy compute entrypoints while keeping deterministic fallback behavior.

### Completed in This Iteration
- [x] **WASM parity runtime adapter added**:
  - [x] Added `src/backend/algorithms/WasmParityRuntime.ts` with:
    - [x] capability gate (`NOTE_CONNECTION_ENABLE_WASM_PARITY`)
    - [x] artifact resolution (`NOTE_CONNECTION_WASM_PATH` + default wasm candidates)
    - [x] cached wasm instance loading with robust failure fallback
    - [x] parity entrypoints: `computeLayout()` and `computeBetweenness()`
- [x] **Heavy compute wiring updated**:
  - [x] `src/backend/algorithms/LayoutEngine.ts` now attempts `WasmParityRuntime.computeLayout(...)` before worker path.
  - [x] `src/backend/GraphMetrics.ts` now attempts `WasmParityRuntime.computeBetweenness(...)` before worker/sequential path (for non-memory-saving large graphs).
- [x] **Regression guardrails added**:
  - [x] Added `src/wasm.parity.runtime.contract.test.ts`.
  - [x] Added wasm parity contract suite to `npm run test:migration` in `package.json`.
- [x] **Risk/TODO synchronization completed**:
  - [x] Updated root/EN/ZH fixrisk docs and TODO streams to reflect real verified state.

### High-Priority Work Status (Current)
- [x] WASM parity runtime adapter is now integrated into heavy compute call paths.
- [x] Existing worker/sequential behavior remains deterministic and intact when wasm artifact/ABI is unavailable.
- [ ] WASM memory ABI + result-output contract for actual layout/centrality compute is still open.
- [ ] Node worker ↔ WASM output equivalence tests are still open.

### Verification Gate (Executed)
- [x] `npx jest src/wasm.parity.runtime.contract.test.ts src/storage.provider.capacitor.worker.contract.test.ts src/runtime.capabilities.test.ts --runInBand`
- [x] `npm run test:migration` (`21` suites, `103` tests passed)
- [x] `npm run build`
- [x] `npm run test:tauri` (`19` Rust tests passed)
- [x] `npm test` (`24` suites, `120` tests passed)

---

## 中文文档

### 目标
启动重计算图谱/布局的 WASM 等价性实现切片：将共享 WASM 运行时适配层接入后端重计算入口，同时保持确定性的回退链路，不破坏现有行为。

### 本轮完成
- [x] **WASM 等价运行时适配器落地**：
  - [x] 新增 `src/backend/algorithms/WasmParityRuntime.ts`，包含：
    - [x] 能力开关（`NOTE_CONNECTION_ENABLE_WASM_PARITY`）
    - [x] 工件路径解析（`NOTE_CONNECTION_WASM_PATH` + 默认候选路径）
    - [x] wasm 实例缓存加载与失败安全回退
    - [x] 等价入口：`computeLayout()` 与 `computeBetweenness()`
- [x] **重计算入口接线完成**：
  - [x] `src/backend/algorithms/LayoutEngine.ts` 在 worker 路径前尝试 `WasmParityRuntime.computeLayout(...)`。
  - [x] `src/backend/GraphMetrics.ts` 在大图且非内存节省模式下优先尝试 `WasmParityRuntime.computeBetweenness(...)`。
- [x] **回归护栏补齐**：
  - [x] 新增 `src/wasm.parity.runtime.contract.test.ts`。
  - [x] 在 `package.json` 的 `test:migration` 纳入 wasm parity 契约测试。
- [x] **风险与 TODO 同步**：
  - [x] 根目录/英文/中文 fixrisk 与 TODO 记录已同步到当前真实验证状态。

### 当前高优先级状态
- [x] WASM 等价运行时适配层已接入后端重计算调用链路。
- [x] 在 wasm 工件/ABI 不可用时，现有 worker/顺序路径保持确定性不变。
- [ ] 真实布局/中心性 WASM 内存 ABI 与结果输出契约仍未闭环。
- [ ] Node worker 与 WASM 的结果一致性回归测试仍未闭环。

### 验证门禁（已执行）
- [x] `npx jest src/wasm.parity.runtime.contract.test.ts src/storage.provider.capacitor.worker.contract.test.ts src/runtime.capabilities.test.ts --runInBand`
- [x] `npm run test:migration`（`21` 套件、`103` 测试通过）
- [x] `npm run build`
- [x] `npm run test:tauri`（`19` 项 Rust 测试通过）
- [x] `npm test`（`24` 套件、`120` 测试通过）

---

# 2026-03-09 v1.5.24 - High-Priority Mobile Compute Continuation (Capacitor Worker-First Build Fallback + Full Gate Revalidation)

## English Document

### Objective
Continue the open high-priority mobile runtime parity slice by adding worker-first local graph compute on native Capacitor, with deterministic fallback behavior and full feasibility revalidation.

### Completed in This Iteration
- [x] **Capacitor worker-first build path implemented** (`src/frontend/storage_provider.js`):
  - [x] Added worker capability detection (`supportsCapacitorGraphBuildWorker`) and URL API safety checks.
  - [x] Added blob-worker compute execution (`runCapacitorGraphBuildWorker`) with strict timeout guard (`CAPACITOR_GRAPH_BUILD_WORKER_TIMEOUT_MS`).
  - [x] Added deterministic fallback orchestrator (`buildCapacitorGraphDataWithWorkerFallback`) to preserve availability on unsupported/failed worker runtimes.
  - [x] Added build-mode observability (`worker`, `single-thread`, `single-thread-fallback`) in Capacitor build stats.
- [x] **Regression safety net expanded**:
  - [x] Updated `src/storage.provider.contract.test.ts` and `src/capacitor.runtime.contract.test.ts` for worker fallback assertions.
  - [x] Added `src/storage.provider.capacitor.worker.contract.test.ts`.
  - [x] Added worker contract suite into `npm run test:migration` matrix in `package.json`.
- [x] **Risk/TODO tracking sync**:
  - [x] Updated `docs/fixrisk_TODO.md`, `docs/en/fixrisk_TODO.md`, `docs/zh/fixrisk_TODO.md` to reflect real post-change state.

### High-Priority Work Status (Current)
- [x] Mobile local graph build is now worker-first with deterministic single-thread fallback.
- [x] Full CI-style verification gates pass after the new worker path and contract additions.
- [ ] Desktop-equivalent Node-worker/WASM compute parity on mobile remains open.
- [ ] Physical-device evidence closure remains environment-dependent (requires online Android device).

### Verification Gate (Executed)
- [x] `npx jest src/storage.provider.contract.test.ts src/capacitor.runtime.contract.test.ts src/storage.provider.capacitor.worker.contract.test.ts --runInBand`
- [x] `npm run test:migration` (`20` suites, `100` tests passed)
- [x] `npm run build`
- [x] `npm run test:tauri` (`19` Rust tests passed)
- [x] `npm test` (`23` suites, `117` tests passed)

---

## 中文文档

### 目标
继续推进高优先级移动端等价性事项：为原生 Capacitor 增加“Worker 优先”的本地图构建能力，并在失败/不支持场景保持确定性回退，同时重新执行全量可行性验证门禁。

### 本轮完成
- [x] **Capacitor Worker 优先构建链路落地**（`src/frontend/storage_provider.js`）：
  - [x] 增加 Worker 能力探测（`supportsCapacitorGraphBuildWorker`）与 URL API 安全判定。
  - [x] 增加 blob Worker 构建执行链路（`runCapacitorGraphBuildWorker`），并加入严格超时护栏（`CAPACITOR_GRAPH_BUILD_WORKER_TIMEOUT_MS`）。
  - [x] 增加确定性回退编排（`buildCapacitorGraphDataWithWorkerFallback`），确保不支持/失败时自动降级为单线程。
  - [x] 在构建统计中增加模式可观测性（`worker`、`single-thread`、`single-thread-fallback`）。
- [x] **回归护栏增强**：
  - [x] 更新 `src/storage.provider.contract.test.ts` 与 `src/capacitor.runtime.contract.test.ts`，覆盖 Worker 回退断言。
  - [x] 新增 `src/storage.provider.capacitor.worker.contract.test.ts`。
  - [x] 在 `package.json` 的 `test:migration` 中纳入 Worker 契约测试套件。
- [x] **风险与 TODO 状态同步**：
  - [x] 更新 `docs/fixrisk_TODO.md`、`docs/en/fixrisk_TODO.md`、`docs/zh/fixrisk_TODO.md`，与当前真实状态一致。

### 当前高优先级状态
- [x] 移动端本地图构建已具备 Worker 优先 + 单线程确定性回退能力。
- [x] 新能力引入后，全量验证门禁持续通过。
- [ ] 移动端与桌面端 Node Worker/WASM 等价能力仍未闭环。
- [ ] 真机证据闭环仍受环境约束（需在线 Android 设备）。

### 验证门禁（已执行）
- [x] `npx jest src/storage.provider.contract.test.ts src/capacitor.runtime.contract.test.ts src/storage.provider.capacitor.worker.contract.test.ts --runInBand`
- [x] `npm run test:migration`（`20` 套件、`100` 测试通过）
- [x] `npm run build`
- [x] `npm run test:tauri`（`19` 项 Rust 测试通过）
- [x] `npm test`（`23` 套件、`117` 测试通过）

---

# 2026-03-09 v1.5.23 - High-Priority Mobile Runtime Continuation (Capacitor Local Build Fallback + Runtime Provider Unification)

## English Document

### Objective
Proceed on the unresolved high-priority mobile runtime scope by removing the hard read-only lock in native Capacitor mode and introducing an on-device local graph build/cache fallback that does not rely on localhost sidecar transport.

### Completed in This Iteration
- [x] **Capacitor local build fallback implemented** (`src/frontend/storage_provider.js`):
  - [x] Added guarded filesystem helpers for read/write/readdir/stat with permission orchestration and path normalization.
  - [x] Added markdown collection limits (`CAPACITOR_GRAPH_BUILD_MAX_FILES`, `CAPACITOR_GRAPH_BUILD_MAX_BYTES`) to prevent unbounded mobile build pressure.
  - [x] Added lightweight on-device graph generation (`collectCapacitorMarkdownFiles` + `buildCapacitorGraphData` + `capacitorBuildGraph`).
  - [x] Added Capacitor cache contracts for `checkCache`/`restoreCache` and runtime-generated asset preference in `readGeneratedAsset`.
- [x] **Source-manager runtime flow upgraded** (`src/frontend/source_manager.js`):
  - [x] Added `supportsCapacitorBuildApi()` capability detection and mapped `supports_build` dynamically for native Capacitor runtime.
  - [x] Removed hard pre-click Capacitor read-only block; load flow now follows cache/build guards uniformly.
  - [x] Switched Capacitor data asset load to storage-provider runtime path for generated `data.js` pickup.
  - [x] Updated Capacitor source list population to include folders + cached targets via storage provider.
- [x] **Contract suite updates**:
  - [x] Updated `src/capacitor.runtime.contract.test.ts` for capability-detected mobile build path.
  - [x] Updated `src/storage.provider.contract.test.ts` for Capacitor local build fallback invariants.

### High-Priority Work Status (Current)
- [x] Native Capacitor runtime is no longer hard-locked to read-only mode when filesystem write/readdir APIs are available.
- [x] Mobile can execute local single-thread markdown graph build fallback and persist cache artifacts for reload.
- [ ] Desktop-equivalent worker-grade parity (performance/scalability) is still open.
- [ ] Physical-device evidence closure remains environment-dependent (online Android device required).

### Verification Gate (Executed)
- [x] `npx jest src/capacitor.runtime.contract.test.ts src/storage.provider.contract.test.ts src/source_manager.loadflow.test.ts src/storage.provider.capacitor.content.contract.test.ts`
- [x] `npm run test:migration` (`19` suites, `98` tests passed)
- [x] `npm run build`
- [x] `npm run test:tauri` (`19` Rust tests passed)
- [x] `npm test` (`22` suites, `115` tests passed)

---

## 中文文档

### 目标
继续推进尚未闭环的移动端高优先级事项：移除原生 Capacitor 的硬只读锁，并在不依赖 localhost sidecar 的前提下，补齐设备端本地图构建/缓存回退能力。

### 本轮完成
- [x] **Capacitor 本地图构建回退落地**（`src/frontend/storage_provider.js`）：
  - [x] 新增受控文件系统辅助链路（read/write/readdir/stat），并统一权限申请与路径规范化。
  - [x] 增加移动端构建保护阈值（`CAPACITOR_GRAPH_BUILD_MAX_FILES`、`CAPACITOR_GRAPH_BUILD_MAX_BYTES`），防止无界资源消耗。
  - [x] 新增设备端轻量图构建链路（`collectCapacitorMarkdownFiles` + `buildCapacitorGraphData` + `capacitorBuildGraph`）。
  - [x] 为 Capacitor 实现 `checkCache`/`restoreCache`，并让 `readGeneratedAsset` 优先读取运行时生成资产。
- [x] **SourceManager 运行时流程升级**（`src/frontend/source_manager.js`）：
  - [x] 新增 `supportsCapacitorBuildApi()` 能力探测，在原生 Capacitor 运行时动态映射 `supports_build`。
  - [x] 移除 Capacitor 点击前硬性只读阻断，统一进入缓存/构建护栏流程。
  - [x] Capacitor `data.js` 加载切换到 storage provider 运行时路径，支持读取构建后产物。
  - [x] Capacitor 数据源列表改为通过 storage provider 聚合目录与缓存目标。
- [x] **契约测试同步更新**：
  - [x] 更新 `src/capacitor.runtime.contract.test.ts`，覆盖“能力探测驱动的移动构建路径”。
  - [x] 更新 `src/storage.provider.contract.test.ts`，覆盖 Capacitor 本地图构建回退关键不变量。

### 当前高优先级状态
- [x] 当文件系统具备写入与目录扫描能力时，原生 Capacitor 不再被硬性锁定为只读模式。
- [x] 移动端已可执行本地单线程 Markdown 图构建回退，并持久化缓存产物用于重载。
- [ ] 与桌面等价的 worker 级性能/规模能力仍未闭环。
- [ ] 真机证据闭环仍受环境约束（需在线 Android 设备）。

### 验证门禁（已执行）
- [x] `npx jest src/capacitor.runtime.contract.test.ts src/storage.provider.contract.test.ts src/source_manager.loadflow.test.ts src/storage.provider.capacitor.content.contract.test.ts`
- [x] `npm run test:migration`（`19` 套件、`98` 测试通过）
- [x] `npm run build`
- [x] `npm run test:tauri`（`19` 项 Rust 测试通过）
- [x] `npm test`（`22` 套件、`115` 测试通过）

---

# 2026-03-09 v1.5.22 - High-Priority Security Hardening (PathBridge Authorization + Tokenized WS Handshake)

## English Document

### Objective
Proceed with the next high-priority robustness slice after critical-table reconciliation by hardening PathBridge authorization boundaries and eliminating unauthorized WebSocket data exposure windows.

### Completed in This Iteration
- [x] **Frontend bridge handshake strengthening**:
  - [x] Updated `src/frontend/runtime_bridge.js` `getBridgeWsUrl(clientTag)` to append runtime `client` and `token` query parameters when available.
  - [x] Preserved backward-safe fallback for malformed/custom WS URLs.
- [x] **PathBridge authorization boundary hardening** (`src/core/PathBridge.ts`):
  - [x] Added unauthorized-client timeout lifecycle (`UNAUTHORIZED_CLIENT_TIMEOUT_MS`, timer map, schedule/clear helpers).
  - [x] Authorized clients now clear auth timeout deterministically in both tokenless and token-required flows.
  - [x] Added `getOpenAuthorizedClients()` and restricted broadcast fan-out to authorized clients only.
  - [x] Enhanced client diagnostics to mark unauthorized connections in status summaries.
- [x] **Contract updates**:
  - [x] Updated `src/runtime.transport.adapter.contract.test.ts` with tokenized WS URL propagation assertions.
  - [x] Updated `src/pathbridge.handshake.contract.test.ts` to enforce unauthorized-timeout and authorized-client broadcast guardrails.

### High-Priority Work Status (Current)
- [x] Bridge-layer unauthorized data exposure window is closed by design (authorized-only broadcast + auth timeout).
- [x] Runtime bridge now propagates token metadata at socket URL handshake time.
- [ ] Full mobile sidecar-equivalent build/worker parity remains intentionally bounded by current release policy.
- [ ] Physical-device manual evidence closure still requires an online Android device.

### Verification Gate (Executed)
- [x] `npx jest src/pathbridge.handshake.contract.test.ts src/runtime.transport.adapter.contract.test.ts --runInBand`
- [x] `npm run test:migration` (`19` suites, `96` tests passed)
- [x] `npm run build`
- [x] `npm run test:tauri` (`19` Rust tests passed)
- [x] `npm test` (`22` suites, `113` tests passed)

---

## 中文文档

### 目标
在“关键问题表对齐”之后，继续推进高优先级稳健性收口：重点加固 PathBridge 的鉴权边界，消除未授权 WebSocket 客户端可能接收广播数据的窗口风险。

### 本轮完成
- [x] **前端桥接握手增强**：
  - [x] 更新 `src/frontend/runtime_bridge.js` 的 `getBridgeWsUrl(clientTag)`，在可用时追加 `client` 与 `token` 查询参数。
  - [x] 保留异常 URL 场景的兼容回退逻辑，不破坏既有运行时行为。
- [x] **PathBridge 鉴权边界加固**（`src/core/PathBridge.ts`）：
  - [x] 新增未授权连接超时生命周期（`UNAUTHORIZED_CLIENT_TIMEOUT_MS`、定时器映射、schedule/clear 辅助函数）。
  - [x] 客户端授权成功后在无 token/有 token 两类路径均会确定性清理超时定时器。
  - [x] 新增 `getOpenAuthorizedClients()`，广播链路改为仅向已授权客户端发送。
  - [x] 连接状态摘要中增加未授权标记，便于运行时诊断。
- [x] **契约测试同步**：
  - [x] 更新 `src/runtime.transport.adapter.contract.test.ts`，增加 token 化 WS URL 断言。
  - [x] 更新 `src/pathbridge.handshake.contract.test.ts`，覆盖未授权超时与仅授权广播护栏。

### 当前高优先级状态
- [x] 桥接层“未授权客户端可能收到广播数据”的窗口风险已按设计收口。
- [x] 运行时桥接在握手 URL 层面已传播 token 元数据。
- [ ] 移动端与桌面 sidecar 的 build/worker 完全等价能力仍在当前发布策略边界之外。
- [ ] 真机人工证据闭环仍依赖在线 Android 设备。

### 验证门禁（已执行）
- [x] `npx jest src/pathbridge.handshake.contract.test.ts src/runtime.transport.adapter.contract.test.ts --runInBand`
- [x] `npm run test:migration`（`19` 套件、`96` 测试通过）
- [x] `npm run build`
- [x] `npm run test:tauri`（`19` 项 Rust 测试通过）
- [x] `npm test`（`22` 套件、`113` 测试通过）

---

# 2026-03-09 v1.5.21 - High-Priority Closure (Critical Issues Table Reconciliation + C-01 Runtime Guard)

## English Document

### Objective
Close the `CRITICAL ISSUES TABLE` drift first by reconciling documented risk state with actual codebase status, and eliminate the remaining C-01 runtime edge where PathBridge WebSocket startup could still be attempted on native Capacitor.

### Completed in This Iteration
- [x] **C-01 runtime hardening completed**:
  - [x] Updated `src/frontend/path_app.js` to skip bridge setup/connect when sidecar transport is unavailable (`supports_sidecar === false`) or native Capacitor runtime is detected.
  - [x] Added explicit runtime guards:
    - [x] `_isCapacitorNativeRuntime()`
    - [x] `_supportsSidecarBridge()`
  - [x] Added deterministic skip logs for disabled sidecar bridge startup paths.
- [x] **Transport contract coverage updated**:
  - [x] Updated `src/runtime.transport.adapter.contract.test.ts` to enforce new sidecar-disabled guard behavior in `path_app.js`.
- [x] **Critical-issues table fixed (EN/ZH)**:
  - [x] Updated `docs/en/fixrisk_TODO.md` `CRITICAL ISSUES TABLE` with current severity/status, validation evidence, and residual risk for `C-01`, `C-02`, `H-01`, `H-02`, `M-01`.
  - [x] Updated `docs/zh/fixrisk_TODO.md` `关键问题表` with aligned bilingual status and evidence.

### High-Priority Work Status (Current)
- [x] `CRITICAL ISSUES TABLE` is now aligned with implemented code reality and verification evidence.
- [x] C-01 localhost/bridge dependency risk is mitigated for Capacitor native runtime startup paths.
- [ ] Full mobile **build + worker** parity with desktop sidecar remains intentionally out of scope for current release boundary.
- [ ] Physical-device manual acceptance evidence remains environment-dependent (requires online Android device).

### Verification Gate (Executed)
- [x] `npx jest src/runtime.transport.adapter.contract.test.ts src/source_manager.loadflow.test.ts src/runtime.capabilities.test.ts src/mobile.pipeline.test.ts src/capacitor.runtime.contract.test.ts --runInBand`
- [x] `npm run test:migration` (`19` suites, `95` tests passed)
- [x] `npm run build`
- [x] `npm run test:tauri` (`19` Rust tests passed)
- [x] `npm test` (`22` suites, `112` tests passed)

---

## 中文文档

### 目标
优先收敛 `CRITICAL ISSUES TABLE` 与代码实际状态不一致的问题，并补齐 C-01 的最后一处运行时边界：避免在原生 Capacitor 环境下仍尝试启动 sidecar PathBridge WebSocket。

### 本轮完成
- [x] **C-01 运行时加固完成**：
  - [x] 更新 `src/frontend/path_app.js`：当 `supports_sidecar === false` 或检测到原生 Capacitor 运行时时，跳过 bridge setup/connect。
  - [x] 新增明确的运行时判定守卫：
    - [x] `_isCapacitorNativeRuntime()`
    - [x] `_supportsSidecarBridge()`
  - [x] 增加 sidecar 被禁用时的确定性日志输出，避免隐式失败。
- [x] **传输契约测试同步更新**：
  - [x] 更新 `src/runtime.transport.adapter.contract.test.ts`，强制校验 `path_app.js` 的新守卫逻辑。
- [x] **关键问题表修复（中英双语）**：
  - [x] 更新 `docs/en/fixrisk_TODO.md` 的 `CRITICAL ISSUES TABLE`，为 `C-01/C-02/H-01/H-02/M-01` 写入当前严重度、验证证据与剩余风险。
  - [x] 更新 `docs/zh/fixrisk_TODO.md` 的 `关键问题表`，保持双语内容一致。

### 当前高优先级状态
- [x] 关键问题表已与当前代码与验证证据对齐。
- [x] 原生 Capacitor 运行时的 C-01 localhost/bridge 依赖风险已进一步收敛。
- [ ] 移动端与桌面 sidecar 的 **build + worker** 完全等价能力仍属于后续范围（当前发布边界内不承诺）。
- [ ] 真机人工验收证据仍受环境约束（需在线 Android 设备）。

### 验证门禁（已执行）
- [x] `npx jest src/runtime.transport.adapter.contract.test.ts src/source_manager.loadflow.test.ts src/runtime.capabilities.test.ts src/mobile.pipeline.test.ts src/capacitor.runtime.contract.test.ts --runInBand`
- [x] `npm run test:migration`（`19` 套件、`95` 测试通过）
- [x] `npm run build`
- [x] `npm run test:tauri`（`19` 项 Rust 测试通过）
- [x] `npm test`（`22` 套件、`112` 测试通过）

---

# 2026-03-09 v1.5.20 - High-Priority Continuation (Capacitor Device Acceptance Pipeline Hardening)

## English Document

### Objective
Advance the remaining fixrisk high-priority mobile acceptance work by hardening Android device verification/evidence scripts for deterministic diagnostics and reusable ADB resolution, without weakening existing runtime boundaries.

### Completed in This Iteration
- [x] **Shared mobile acceptance utility layer**:
  - [x] Added `scripts/capacitor-device-utils.js` for:
    - [x] ADB command candidate resolution (`ADB_PATH`, PATH, `ANDROID_SDK_ROOT`/`ANDROID_HOME`)
    - [x] resilient command execution wrappers
    - [x] `adb devices` parsing with explicit status classification (`device`/`unauthorized`/`offline`)
    - [x] deterministic device-state summaries for diagnostics
- [x] **Verification script hardening**:
  - [x] Updated `scripts/verify-capacitor-device-acceptance.js`:
    - [x] migrate to shared utility layer
    - [x] support `NOTE_CONNECTION_ANDROID_SERIAL` for deterministic serial targeting
    - [x] include structured blocked-state output (`Device states: ...`) when no online device exists
- [x] **Evidence capture script hardening**:
  - [x] Updated `scripts/capture-capacitor-device-evidence.js`:
    - [x] migrate to shared utility layer
    - [x] support deterministic serial selection via `NOTE_CONNECTION_ANDROID_SERIAL`
    - [x] include explicit blocked-state summaries for no-device / non-online-serial scenarios
- [x] **Contract coverage expansion**:
  - [x] Added `src/capacitor.device.utils.contract.test.ts` (ADB parse/state/candidate regression checks)
  - [x] Updated `src/mobile.pipeline.test.ts` to enforce shared-utility wiring in both acceptance scripts
  - [x] Updated `package.json` migration test matrix to include new device-utils contract suite

### High-Priority Work Status (Current)
- [x] Mobile device acceptance scripts now fail fast with deterministic diagnostics and explicit blocked reasons.
- [x] Migration/CI gates include regression protection for ADB parsing and script wiring.
- [ ] Deliver full mobile **build + content** parity equivalent to desktop sidecar (still intentionally bounded by runtime policy).
- [ ] Complete physical-device acceptance evidence checklist with real-device interaction evidence (environment currently has no online Android device).

### Verification Gate (Executed)
- [x] `npx jest src/capacitor.device.utils.contract.test.ts src/mobile.pipeline.test.ts --runInBand`
- [x] `npm run verify:capacitor:device` -> blocked as expected: `Device states: none`
- [x] `npm run capture:capacitor:evidence` -> blocked as expected: `Device states: none`
- [x] `npm run test:migration` (`19` suites, `95` tests passed)
- [x] `npm run build`
- [x] `npm run test:tauri` (`19` Rust tests passed)
- [x] `npm test` (`22` suites, `112` tests passed)

---

## 中文文档

### 目标
在不放宽现有运行时边界的前提下，推进 fixrisk 中剩余的移动端高优先级收口：重点加固 Android 真机验收脚本，使设备探测与证据采集具备可重复、可诊断、可回归保护的行为。

### 本轮完成
- [x] **移动验收共享工具层**：
  - [x] 新增 `scripts/capacitor-device-utils.js`，提供：
    - [x] ADB 多候选解析（`ADB_PATH`、PATH、`ANDROID_SDK_ROOT`/`ANDROID_HOME`）
    - [x] 稳定命令执行封装
    - [x] `adb devices` 状态解析（`device`/`unauthorized`/`offline`）
    - [x] 设备状态汇总输出（用于阻塞诊断）
- [x] **设备闸门脚本加固**：
  - [x] 更新 `scripts/verify-capacitor-device-acceptance.js`：
    - [x] 改为共享工具实现
    - [x] 支持 `NOTE_CONNECTION_ANDROID_SERIAL` 指定设备
    - [x] 在无在线设备时输出确定性阻塞信息（`Device states: ...`）
- [x] **证据采集脚本加固**：
  - [x] 更新 `scripts/capture-capacitor-device-evidence.js`：
    - [x] 改为共享工具实现
    - [x] 支持 `NOTE_CONNECTION_ANDROID_SERIAL` 定向采集
    - [x] 在设备不可用或序列号不在线时输出明确状态汇总
- [x] **契约测试覆盖提升**：
  - [x] 新增 `src/capacitor.device.utils.contract.test.ts`（ADB 解析/状态/候选链路回归）
  - [x] 更新 `src/mobile.pipeline.test.ts`，强制校验两套脚本都走共享工具层
  - [x] 更新 `package.json` 迁移测试矩阵，纳入新契约套件

### 当前高优先级状态
- [x] 移动端真机验收脚本已具备快速失败与可诊断阻塞输出能力。
- [x] 迁移/CI 已纳入 ADB 解析与脚本接线回归护栏。
- [ ] 尚未交付移动端与桌面端完全等价的 **build + content** 能力（仍受当前运行时策略边界约束）。
- [ ] 真机验收清单仍需在线 Android 设备完成人工交互证据闭环。

### 验证门禁（已执行）
- [x] `npx jest src/capacitor.device.utils.contract.test.ts src/mobile.pipeline.test.ts --runInBand`
- [x] `npm run verify:capacitor:device` -> 预期阻塞：`Device states: none`
- [x] `npm run capture:capacitor:evidence` -> 预期阻塞：`Device states: none`
- [x] `npm run test:migration`（`19` 套件、`95` 测试通过）
- [x] `npm run build`
- [x] `npm run test:tauri`（`19` 项 Rust 测试通过）
- [x] `npm test`（`22` 套件、`112` 测试通过）

---

# 2026-03-09 v1.5.19 - Fixrisk High-Priority Hardening (Static Asset Traversal Guard + Full Verification)

## English Document

### Objective
Close a remaining high-priority robustness gap from `docs/fixrisk_TODO.md` by hardening sidecar static-file serving against traversal edge cases and proving no regression through full verification gates.

### Completed in This Iteration
- [x] **Sidecar static-file security hardening** (`src/server.ts`):
  - [x] Added strict raw request-path extraction (`getRawRequestPathname`) to avoid URL normalization hiding traversal intent.
  - [x] Added traversal + null-byte rejection and root-bounded resolution (`resolveFrontendStaticPath`).
  - [x] Replaced callback-style static reads with async `stat` + `readFile`, returning deterministic `403/404/500` responses.
  - [x] Added centralized static content-type mapping (`getStaticContentType`).
- [x] **Regression safety net expanded** (`src/server.migration.test.ts`):
  - [x] Added raw traversal regression case (`/../../outside/sensitive.md`).
  - [x] Added encoded traversal regression case (`/%2e%2e/%2e%2e/outside/sensitive.md`).
- [x] **Feasibility verification executed end-to-end**:
  - [x] Migration suite, build pipeline, and full Jest matrix all pass after hardening.

### High-Priority Work Status (Current)
- [x] Harden static asset serving path resolution to prevent path-escape behavior and ambiguous request-path handling.
- [x] Keep migration and full-test CI viability intact after server-path security changes.
- [ ] Deliver full mobile **build + content** parity equivalent to desktop sidecar (still intentionally bounded by current runtime policy).
- [ ] Complete physical-device acceptance evidence checklist end-to-end (requires online Android device in execution environment).

### Verification Gate (Executed)
- [x] `npx jest src/server.migration.test.ts --runInBand`
- [x] `npm run test:migration` (`18` suites, `91` tests passed)
- [x] `npm run build`
- [x] `npm run test:tauri`
- [x] `npm test` (`21` suites, `108` tests passed)
- [ ] `npm run verify:capacitor:device` (blocked in current environment: no online Android device)
- [ ] `npm run capture:capacitor:evidence` (blocked in current environment: no online Android device)

---

## 中文文档

### 目标
基于 `docs/fixrisk_TODO.md` 收敛一个仍然存在的高优先级鲁棒性缺口：加固 sidecar 静态文件服务路径安全（防止路径穿越边界问题），并通过完整验证门禁证明改动可行且无回归。

### 本轮完成
- [x] **Sidecar 静态文件安全加固**（`src/server.ts`）：
  - [x] 新增原始请求路径提取（`getRawRequestPathname`），避免 URL 规范化吞掉穿越语义后再做判断。
  - [x] 新增路径穿越片段与空字节拒绝，并通过 `resolveFrontendStaticPath` 强制限制在 `FRONTEND_DIR` 根目录内。
  - [x] 将静态文件读取由回调式改为异步 `stat` + `readFile`，并统一 `403/404/500` 返回行为。
  - [x] 新增静态资源 Content-Type 映射函数（`getStaticContentType`）。
- [x] **回归护栏增强**（`src/server.migration.test.ts`）：
  - [x] 新增原始路径穿越用例：`/../../outside/sensitive.md`。
  - [x] 新增编码路径穿越用例：`/%2e%2e/%2e%2e/outside/sensitive.md`。
- [x] **可行性验证已完整执行**：
  - [x] 迁移测试、构建流程与全量 Jest 回归在本轮改动后全部通过。

### 当前高优先级状态
- [x] 已完成静态资源路径解析安全收口，杜绝越出前端根目录的文件访问风险。
- [x] 已确认服务器路径安全改动未破坏现有迁移链路与 CI 测试稳定性。
- [ ] 尚未交付移动端与桌面端完全等价的 **build + content** 能力（仍受当前运行时策略边界约束）。
- [ ] 真机验收证据仍需设备侧执行闭环（当前环境无在线 Android 设备）。

### 验证门禁（已执行）
- [x] `npx jest src/server.migration.test.ts --runInBand`
- [x] `npm run test:migration`（`18` 套件、`91` 测试通过）
- [x] `npm run build`
- [x] `npm test`（`21` 套件、`108` 测试通过）
- [ ] `npm run verify:capacitor:device`（当前环境阻塞：无在线 Android 设备）
- [ ] `npm run capture:capacitor:evidence`（当前环境阻塞：无在线 Android 设备）

---

# 2026-03-09 v1.5.18 - High-Priority Continuation (Capacitor Content Path + Device Evidence + MD Language Archive)

## English Document

### Objective
Continue active high-priority closure with implementation-first rigor:
- Reduce Capacitor runtime parity risk for **content loading** (without pretending build parity).
- Operationalize physical-device acceptance evidence collection.
- Execute a structured language archive of all tracked markdown docs into `docs/en` and `docs/zh`.

### Completed in This Iteration
- [x] **Capacitor content-path parity hardening**:
  - [x] `src/frontend/source_manager.js`: Capacitor runtime capability now resolves `supports_content_api` dynamically via filesystem plugin readiness (`supportsCapacitorContentApi`) instead of hardcoded false.
  - [x] `src/frontend/storage_provider.js`: added Capacitor content mapping and safety helpers:
    - [x] `extractRelativePathFromKbMarker(rawFilePath)`
    - [x] `resolveCapacitorContentCandidatePath(rawFilePath)`
    - [x] strict rejection of unmappable absolute desktop paths without `Knowledge_Base` marker
  - [x] `RuntimeStorageProvider.readContent()` now uses Capacitor filesystem for native runtime when content API is supported.
- [x] **Physical-device evidence automation**:
  - [x] Added `scripts/capture-capacitor-device-evidence.js`.
  - [x] Added npm command `capture:capacitor:evidence`.
  - [x] Evidence bundle output design:
    - [x] masked device metadata
    - [x] screenshot (`device-screenshot.png`)
    - [x] logcat tail (`logcat-tail.txt`)
    - [x] bilingual acceptance report (`acceptance_evidence.md`)
- [x] **Structured markdown language archive**:
  - [x] Added `scripts/archive-md-by-language.js`.
  - [x] Archived all tracked markdown files into:
    - [x] `docs/en/**` (English set)
    - [x] `docs/zh/**` (Chinese set)
  - [x] Generated archive traceability report: `docs/language-archive-report.json`.
  - [x] Current archive snapshot: scanned `25` tracked markdown files, output `24` EN docs and `17` ZH docs.
- [x] **Contract/test updates**:
  - [x] Updated `src/capacitor.runtime.contract.test.ts` for dynamic Capacitor content capability.
  - [x] Updated `src/storage.provider.contract.test.ts` for Capacitor content mapping assertions.
  - [x] Added `src/storage.provider.capacitor.content.contract.test.ts`.
  - [x] Updated `src/mobile.pipeline.test.ts` to assert evidence-capture npm command.
  - [x] Updated `package.json` migration test list to include new capacitor content contract test.

### High-Priority Work Status (Current)
- [x] Deliver mobile **content** parity path beyond strict packaged-read-only behavior (filesystem-backed read path added with safety checks).
- [ ] Deliver full mobile **build + content** parity equivalent to desktop sidecar (build parity remains intentionally unresolved in Capacitor runtime).
- [ ] Complete physical-device acceptance evidence checklist end-to-end (device-dependent manual validations still pending).

### Verification Gate (Executed)
- [x] `npx jest src/capacitor.runtime.contract.test.ts src/storage.provider.contract.test.ts src/storage.provider.capacitor.content.contract.test.ts src/mobile.pipeline.test.ts src/source_manager.loadflow.test.ts src/runtime.capabilities.test.ts --runInBand`
- [x] `npm run test:migration` (`18` suites passed)
- [x] `npm run build`
- [x] `npm run test:tauri`
- [x] `./src-tauri/bin/godot-x86_64-pc-windows-msvc.exe --headless --path ./path_mode --quit`
- [x] `node scripts/archive-md-by-language.js`
- [ ] `npm run verify:capacitor:device` (blocked in current environment: no online Android device)
- [ ] `npm run capture:capacitor:evidence` (blocked in current environment: no online Android device)

---

# 2026-03-09 v1.5.17 - Fixrisk Feasibility Hardening (Approach Plan Execution)

## English Document

### Objective
Execute the next fixrisk-driven hardening slice from `docs/fixrisk_TODO.md` with verifiable runtime contracts, focused on mobile filesystem feasibility, Android permission baselines, and CI determinism.

### Completed in This Iteration
- [x] **Capacitor filesystem dependency baseline**:
  - [x] Added `@capacitor/filesystem` to runtime dependencies in `package.json`.
- [x] **Storage-provider hardening for native Capacitor paths** (`src/frontend/storage_provider.js`):
  - [x] Added Capacitor path normalization with traversal rejection (`.` / `..` unsafe segments).
  - [x] Added permission-aware filesystem gate (`checkPermissions` / `requestPermissions`) with deterministic error signaling.
  - [x] Kept desktop sidecar and Tauri command fallback behavior unchanged.
- [x] **Android manifest permission baseline** (`android/app/src/main/AndroidManifest.xml`):
  - [x] Added legacy storage compatibility declarations (`READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`).
  - [x] Added Android 13+ media-read declarations (`READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_AUDIO`).
- [x] **Contract-test coverage raised**:
  - [x] Updated `src/mobile.pipeline.test.ts` to enforce Capacitor filesystem dependency and Android permission declarations.
  - [x] Updated `src/storage.provider.contract.test.ts` to enforce permission/path-hardening hooks in storage provider.
- [x] **CI migration stability**:
  - [x] Kept `src/server.migration.test.ts` hermetic against runner-injected `NOTE_CONNECTION_AUTH_TOKEN` values to prevent false `401` cascades in CI.

### High-Priority Work Status (Current)
- [x] Address fixrisk mobile filesystem baseline gaps at dependency + manifest + adapter hardening level.
- [x] Add migration-level guardrails to prevent silent regressions.
- [ ] Deliver true mobile build/content parity beyond packaged read-only policy (still intentionally bounded).
- [ ] Complete physical-device acceptance evidence (`verify:capacitor:device` + on-device runtime checklist).

### Verification Gate (Executed)
- [x] `npx tsc --pretty false`
- [x] `npx jest src/storage.provider.contract.test.ts src/mobile.pipeline.test.ts src/source_manager.loadflow.test.ts src/runtime.capabilities.test.ts src/server.migration.test.ts --runInBand`
- [x] `npm run test:migration`
- [x] `npm run build`
- [x] `npm run test:tauri`
- [x] `./src-tauri/bin/godot-x86_64-pc-windows-msvc.exe --headless --path ./path_mode --quit`
- [x] `npm run build:sidecar`

---

# 2026-03-08 v1.5.16 - High-Priority Closure (Transport + Storage + Cross-Platform Godot Strategy)

## English Document

### Objective
Close all open high-priority items from `v1.5.15` with implementation + regression validation, without weakening existing desktop/mobile runtime boundaries.

### Completed in This Iteration
- [x] **Transport modernization closure**:
  - [x] Added JSON-RPC-compatible bridge envelopes in `src/frontend/runtime_bridge.js` (`toBridgeEnvelope`, `parseBridgeEnvelope`, `sendBridgeMessage`) while keeping legacy `type/payload` compatibility.
  - [x] Migrated `src/frontend/path_app.js` bridge sends/receives to the runtime transport adapter path (`_sendBridgeMessage`, `_parseBridgeIncomingMessage`) instead of direct raw message formatting/parsing.
- [x] **Storage-provider abstraction closure**:
  - [x] Added `src/frontend/storage_provider.js` as the unified runtime storage provider and wired it into source/reader flows.
  - [x] Implemented provider branches for sidecar HTTP, Tauri invoke commands, and Capacitor-native filesystem read/list fallbacks (`Filesystem` plugin-aware helpers) while preserving current capability gating policy.
- [x] **Explicit macOS/Linux Godot sidecar artifact strategy**:
  - [x] Reworked `scripts/ensure-godot-sidecar.js` into host-aware preparation for Windows/Linux/macOS naming (`godot-<target-triple>`), with deterministic lookup strategy and documented env overrides.
  - [x] Updated `src-tauri/src/lib.rs` Godot executable resolution to platform-specific sidecar names + host aliases, with tests adjusted for cross-platform behavior.
- [x] **Release policy explicitness kept in code/docs surface**:
  - [x] Capacitor native remains bounded read-only/cache-oriented in runtime capability handling.
  - [x] README policy statements remain explicit that Capacitor path does not provide desktop sidecar parity yet.

### High-Priority Status
- [x] Complete transport modernization (replace remaining raw desktop HTTP/WS flows with Tauri-native IPC or JSON-RPC adapter).
- [x] Implement storage-provider abstraction across desktop sidecar, Tauri commands, and Capacitor native filesystem.
- [x] Add explicit macOS/Linux Godot sidecar artifact strategy (currently Windows binary workflow is strongest).
- [x] Keep release policy explicit: Capacitor native remains read-only packaged mode until parity work is delivered.

### Verification Gate (Executed)
- [x] `npx tsc --pretty false`
- [x] `npx jest src/storage.provider.contract.test.ts src/source_manager.loadflow.test.ts src/runtime.capabilities.test.ts src/runtime.transport.adapter.contract.test.ts --runInBand`
- [x] `npm run test:migration`
- [x] `npm run test:tauri`
- [x] `./src-tauri/bin/godot-x86_64-pc-windows-msvc.exe --headless --path ./path_mode --quit`
- [x] `npm run build:sidecar`
- [x] `npm run build:sidecar:all` (artifact generation + validation; macOS binary signing warning remains expected when built off macOS host)
- [x] `npm run verify:tauri:bin`
- [x] `npm test`

---

## 中文文档

### 目标
在不削弱现有桌面端/移动端运行时边界的前提下，完成 `v1.5.15` 中全部“高优先级”未闭环事项，并提供完整回归验证证据。

### 本轮完成
- [x] **传输层现代化闭环**：
  - [x] 在 `src/frontend/runtime_bridge.js` 增加 JSON-RPC 兼容桥接信封能力（`toBridgeEnvelope`、`parseBridgeEnvelope`、`sendBridgeMessage`），同时保持旧版 `type/payload` 兼容。
  - [x] 将 `src/frontend/path_app.js` 的桥接收发迁移到统一运行时传输适配路径（`_sendBridgeMessage`、`_parseBridgeIncomingMessage`），不再直接手写原始消息格式解析。
- [x] **存储抽象闭环**：
  - [x] 新增 `src/frontend/storage_provider.js` 作为统一存储提供者，并接入 source/reader 关键流程。
  - [x] 提供 sidecar HTTP、Tauri invoke、Capacitor 原生文件系统读/列目录回退分支（包含 `Filesystem` 插件感知），同时保持现行能力门禁策略不变。
- [x] **macOS/Linux Godot sidecar 制品策略显式化**：
  - [x] 将 `scripts/ensure-godot-sidecar.js` 重构为主机平台感知策略，支持 Windows/Linux/macOS 目标命名（`godot-<target-triple>`）、确定性查找链路与环境变量覆写入口。
  - [x] 更新 `src-tauri/src/lib.rs` 的 Godot 可执行文件解析逻辑，改为平台侧车命名 + 主机别名解析；并同步调整测试确保跨平台行为一致。
- [x] **发布边界显式性持续保持**：
  - [x] Capacitor 原生保持受限的只读/缓存导向运行时能力边界。
  - [x] README 中继续明确 Capacitor 路径尚未达到桌面 sidecar 等价能力。

### 高优先级状态
- [x] 完成传输层现代化（将剩余桌面端原始 HTTP/WS 调用迁移到 Tauri 原生命令或 JSON-RPC 适配层）。
- [x] 实现跨运行时存储抽象（桌面 sidecar / Tauri commands / Capacitor 文件系统）。
- [x] 制定并落地 macOS/Linux 的 Godot sidecar 制品策略（当前 Windows 二进制链路最完整）。
- [x] 持续保持发布边界清晰：在能力对齐完成前，Capacitor 原生仍为只读打包模式。

### 验证门禁（已执行）
- [x] `npx tsc --pretty false`
- [x] `npx jest src/storage.provider.contract.test.ts src/source_manager.loadflow.test.ts src/runtime.capabilities.test.ts src/runtime.transport.adapter.contract.test.ts --runInBand`
- [x] `npm run test:migration`
- [x] `npm run test:tauri`
- [x] `./src-tauri/bin/godot-x86_64-pc-windows-msvc.exe --headless --path ./path_mode --quit`
- [x] `npm run build:sidecar`
- [x] `npm run build:sidecar:all`（已完成制品构建与校验；在非 macOS 主机构建时出现 macOS 签名警告属预期）
- [x] `npm run verify:tauri:bin`
- [x] `npm test`

---

# 2026-03-08 v1.5.15 - Fixrisk Phase-1 Hardening Execution (Completed)

## English Document

### Objective
Execute the highest-risk actionable items from `docs/fixrisk_TODO.md` without destabilizing existing desktop and mobile runtime contracts.

### Implemented in This Iteration
- [x] `src/server.ts`: removed synchronous file reads from `/api/content` and generated JS/JSON asset responses.
- [x] `src/server.ts`: replaced in-memory-only JSON body parsing with bounded streaming + temp-file spooling (`tmp/request-bodies`) for large payloads.
- [x] `src/server.ts`: normalized request-body failure handling with explicit HTTP status mapping:
  - [x] `413` for oversized payloads
  - [x] `400` for invalid JSON
  - [x] `415` for unsupported content type
- [x] `src/server.ts`: migrated `/api/build` and `/api/kb-path` to the same hardened JSON parser path (removed duplicated manual body buffering).
- [x] `src/server.ts`: added startup resilience for default dev port conflicts. If no explicit port is configured and `3000` is busy, server now falls back to an ephemeral loopback port instead of crashing with `EADDRINUSE`.
- [x] `src/server.ts`: completed async conversion for cache and target APIs (`/api/check-cache`, `/api/restore-cache`, `/api/available-targets`) to remove remaining sync hot-path filesystem calls.
- [x] Frontend transport consolidation: `source_manager.js`, `reader.js`, and `path_app.js` now rely on `runtime_bridge.js` as the single runtime transport adapter instead of standalone hardcoded loopback URL fallbacks.
- [x] Packaging modernization:
  - [x] Added `scripts/build-sidecar.js` with Node 22 targets, Brotli compression, and `--no-bytecode`.
  - [x] Updated `build:sidecar` to host-aware Node 22 build.
  - [x] Added `build:sidecar:all` for Windows/Linux/macOS-arm64 outputs with Tauri-compatible naming.
  - [x] Updated sidecar validation script to support host/all-target checks.
  - [x] Updated Godot sidecar preparation script to skip Windows-only copy logic on non-Windows hosts.

### Remaining High-Priority Work
- [x] Complete transport modernization (replace remaining raw desktop HTTP/WS flows with Tauri-native IPC or JSON-RPC adapter). (Closed in `v1.5.16`)
- [x] Implement storage-provider abstraction across desktop sidecar, Tauri commands, and Capacitor native filesystem. (Closed in `v1.5.16`)
- [x] Add explicit macOS/Linux Godot sidecar artifact strategy (currently Windows binary workflow is strongest). (Closed in `v1.5.16`)
- [x] Keep release policy explicit: Capacitor native remains read-only packaged mode until parity work is delivered. (Closed in `v1.5.16`)

### Verification Gate (This Iteration)
- [x] `npx tsc --pretty false`
- [x] `npx jest src/server.migration.test.ts src/source_manager.loadflow.test.ts src/pathbridge.handshake.contract.test.ts src/reader_renderer.test.ts --runInBand`
- [x] `npx jest src/runtime.transport.adapter.contract.test.ts src/source_manager.loadflow.test.ts src/runtime.capabilities.test.ts src/pathbridge.handshake.contract.test.ts --runInBand`
- [x] `npm run test:migration`
- [x] `npm run test:tauri`
- [x] `./src-tauri/bin/godot-x86_64-pc-windows-msvc.exe --headless --path ./path_mode --quit`
- [x] `npm run build:sidecar`
- [x] `npm run build:sidecar:all` (artifact validation only; cross-platform runtime execution remains platform-dependent)

---

# 2026-03-07 v1.5.14 - Architecture & Security Hardening Review Refresh

## Future Architecture & Security Hardening (Post v1.5.13)

### Goal
Refresh the post-v1.5.13 hardening backlog against the current codebase so the TODO reflects what is already implemented and what still blocks production-grade robustness, large-graph scalability, and honest multi-platform delivery.

### Completed Since The Original Hardening Plan
- [x] HTTP and WebSocket listeners are now loopback-only on desktop (`127.0.0.1`).
- [x] Tauri now allocates dynamic sidecar and bridge ports and injects runtime metadata into the sidecar, frontend, and Godot process.
- [x] Protected sidecar routes and bridge identification now support token-based authentication.
- [x] Strict CORS allowlisting replaced wildcard desktop exposure for the sidecar runtime.
- [x] A shared frontend runtime bridge now synchronizes sidecar base URL, bridge URL, and auth headers in Tauri desktop flows.
- [x] Native Capacitor runtime is now explicitly treated as a read-only packaged mode instead of assuming desktop sidecar APIs.
- [x] Clipboard PNG buffers are explicitly zeroized after use in the Node sidecar.
- [x] Godot reader SVG sanitization and dimension clamping now prevent oversized raster failures for Math/Mermaid rendering.

### Remaining High-Priority Work

#### Phase 1: Desktop Runtime Hardening Closure
- [x] Bind HTTP and WebSocket listeners to `127.0.0.1` only.
- [x] Allocate dynamic ports and auth tokens from the Tauri runtime.
- [x] Apply strict CORS allowlisting and token validation to protected sidecar routes.
- [x] Remove synchronous filesystem reads from `/api/content` and generated asset serving in `src/server.ts`.
- [x] Replace full-buffer JSON body parsing with streaming or temp-file handling for large clipboard and render payloads.

#### Phase 2: Transport Modernization
- [x] Introduce an environment-aware runtime bridge for Tauri desktop URL and auth propagation.
- [ ] Replace remaining raw desktop HTTP and WebSocket request paths with Tauri-native IPC or a formal JSON-RPC transport.
- [x] Consolidate all frontend transport fallbacks behind one adapter so no feature depends on hardcoded loopback defaults when runtime metadata is unavailable.

#### Phase 3: Storage and Query Scalability
- [ ] Introduce a storage-provider abstraction that can target desktop sidecar, Tauri commands, Capacitor filesystem, and future SQLite or Wasm runtimes.
- [ ] Replace monolithic `graph_data.json` as the primary runtime storage with SQLite-backed partial queries.
- [ ] Add persistent frontend cache layers (IndexedDB via `localForage` or `Dexie`) for cold-start reduction.
- [ ] Evaluate MessagePack or an equivalent binary transport for dense graph payload delivery.

#### Phase 4: Packaging and Multi-Platform Delivery
- [x] Replace the Windows-only `build:sidecar` target (`node18-win-x64`) with multi-target Node 22 packaging.
- [x] Add compressed sidecar build flows (`--compress Brotli`, `--no-bytecode`) and verify packaged runtime assets.
- [x] Add packaged-sidecar validation for macOS and Linux, not only Windows desktop.
- [ ] Finalize iOS privacy-manifest work for filesystem access declarations.
- [ ] Keep the mobile release policy explicit: current Capacitor delivery is packaged read-only content, not desktop-equivalent build or sidecar parity.

### Verification Snapshot (Reviewed on 2026-03-07)
- [x] `npx tsc --pretty false`
- [x] `npx jest src/reader_renderer.test.ts src/source_manager.loadflow.test.ts src/pathbridge.handshake.contract.test.ts src/server.migration.test.ts --runInBand`
- [x] `cargo test --manifest-path src-tauri/Cargo.toml`
- [x] `./src-tauri/bin/godot-x86_64-pc-windows-msvc.exe --headless --path ./path_mode --quit` on Windows PowerShell

### Release Position
- [ ] Do not claim full all-platform feature parity until storage abstraction and transport migration are completed.
- [ ] Treat Capacitor native delivery as a bounded read-only runtime until native content and graph-loading parity is implemented.

# 2026-03-04 v1.5.13 - Capacitor Physical-Device Acceptance Runbook Closure


### Objective

Convert the last open `v1.5.9` sign-off item (Capacitor physical-device checklist evidence) into an executable and repeatable workflow.

### Delivered

- [x] Added device-acceptance probe script:
  - [x] `scripts/verify-capacitor-device-acceptance.js`
  - [x] validates:
    - [x] APK exists (`android/app/build/outputs/apk/debug/app-debug.apk`)
    - [x] `adb` is available
    - [x] at least one online Android device is attached
- [x] Added npm command:
  - [x] preflight command available: `npm run verify:capacitor:device`
- [x] Revalidated current APK build pipeline:
  - [x] `npm run mobile:build:capacitor` -> PASS on 2026-03-04

### Physical-Device Acceptance Checklist (Release Sign-Off)

- [ ] Device connection gate passes:
  - [ ] `npm run verify:capacitor:device`
- [ ] App startup behavior validated on real device.
- [ ] Source panel behavior validated on real device.
- [ ] Reader behavior validated on real device.
- [ ] Path mode entry/exit behavior validated on real device.
- [ ] Evidence artifacts attached:
  - [ ] device serial (masked if needed)
  - [ ] test date/time
  - [ ] screenshots or short screen recording
  - [ ] observed result notes (pass/fail + issue IDs)

### Current Status

- [x] Build + environment side of acceptance is ready.
- [ ] Real-device execution evidence is still required to close the final sign-off checkbox in `v1.5.9`.

---

# 2026-03-04 v1.5.11 - Capacitor Runtime Boundary Closure (Option B Execution)


### Decision Snapshot

- [x] Capacitor runtime boundary hardening is now implemented under Option B (read-only mobile policy).
- [x] Source/Reader runtime behavior no longer assumes desktop sidecar APIs in native Capacitor.
- [x] Regression contract coverage for Capacitor runtime boundary is added and wired into migration gate.
- [ ] Capacitor in-app folder/build/content parity with desktop remains intentionally out of scope for current release policy.

### Delivered in Code

- [x] `src/frontend/source_manager.js`
  - [x] Added native Capacitor runtime detection (`window.Capacitor.getPlatform` / `isNativePlatform`).
  - [x] Applied explicit capability profile in native Capacitor:
    - [x] `supports_sidecar=false`
    - [x] `supports_build=false`
    - [x] `supports_content_api=false`
    - [x] `supports_kb_runtime_change=false`
  - [x] Added deterministic source-panel fallback for read-only mode:
    - [x] path label -> `source.capacitor.bundlePath`
    - [x] single packaged option -> `PACKAGED_GRAPH`
    - [x] load button disabled + guarded alert (`source.error.capacitorReadOnly`)
- [x] `src/frontend/reader.js`
  - [x] Added Capacitor-native detection fallback to enforce read-only content strategy when runtime caps are unavailable early.
- [x] i18n updates:
  - [x] `src/frontend/locales/en.json`
  - [x] `src/frontend/locales/zh.json`
  - [x] added `source.capacitor.packagedGraph`
  - [x] added `source.capacitor.bundlePath`
  - [x] added `source.error.capacitorReadOnly`
- [x] Added Capacitor boundary contract tests:
  - [x] `src/capacitor.runtime.contract.test.ts`
  - [x] included in `package.json` -> `test:migration`

### Verification Evidence (Executed on 2026-03-04)

- [x] `npm run test:migration` -> PASS (`66` tests)
- [x] `npm run test:tauri` -> PASS (`18` tests)
- [x] `npm run mobile:build:capacitor` -> PASS
  - [x] APK output: `android/app/build/outputs/apk/debug/app-debug.apk`

### Status Update for Previously Open Items

- [x] `v1.5.9` item: **Capacitor runtime behavior hardening** -> closed at code + test level.
- [x] `v1.5.9` item: **integration test coverage for Capacitor runtime boundary** -> closed (`src/capacitor.runtime.contract.test.ts`).
- [ ] `v1.5.9` item: **manual Capacitor APK checklist on physical device** remains pending explicit on-device execution evidence.
- [ ] **NO-GO remains** for claiming “all-platform parity complete”.

---

# 2026-03-03 v1.5.10 - Option A P0 Closure (Tauri Android Native Folder/Build/Content Flow)


### Decision Snapshot

- [x] Option A P0 is implemented for Tauri Android runtime.
- [x] Android runtime now supports local graph build without Node sidecar.
- [x] Desktop and web behavior remain unchanged.
- [ ] Capacitor runtime parity is still a separate scope (build backend parity not yet native-equivalent).

### Delivered in Code

- [x] Added native runtime build command in Rust:
  - [x] `build_graph_runtime(request)` in `src-tauri/src/lib.rs`
  - [x] builds from `Knowledge_Base/<target>` (or `ALL_FOLDERS`)
  - [x] writes runtime artifacts to `runtime_data/`:
    - [x] `data.js`
    - [x] `graph_data.json`
    - [x] `data_<target>.js`
    - [x] `graph_data_<target>.json`
- [x] Updated Android runtime capabilities:
  - [x] `supports_sidecar=false`
  - [x] `supports_build=true`
  - [x] `supports_content_api=true`
- [x] Routed source loading/build flow in `src/frontend/source_manager.js`:
  - [x] sidecar path stays primary when available (`/api/build`)
  - [x] Tauri native fallback uses `invoke('build_graph_runtime', { request })`

### Verification Evidence (Executed on 2026-03-03)

- [x] `npm run test:migration` -> PASS (`55` tests)
- [x] `npm run test:tauri` -> PASS (`16` tests)
- [x] `npm run verify:android:env` -> PASS (SDK + cmdline-tools + NDK detected)

### P0 Status Update

- [x] `Option A: Implement mobile-native equivalent for folder/build/content flow` (Tauri Android path).
- [ ] Capacitor-specific build/content runtime parity remains open and tracked under follow-up mobile scope.

---

# 2026-03-03 v1.5.9 - Electron Removal Final Gate (Audit-Driven Action Plan)


### Decision Snapshot

- [x] Desktop runtime migration from Electron to Tauri is technically ready.
- [x] Tauri desktop build/runtime path is active and test-verified.
- [x] Capacitor and Tauri Android build pipelines both exist.
- [ ] Full cross-platform runtime parity is not complete yet.

### Scope Clarification (From Audit)

- Desktop:
  - [x] Electron IPC-equivalent flows are migrated to sidecar HTTP + Tauri commands.
  - [x] Electron scripts/dependencies are absent from active package/runtime surface.
- Mobile:
  - [x] Capacitor runtime is intentionally read-only and not equivalent to desktop sidecar runtime for folder/build/content APIs.
  - [x] Tauri Android runtime is no-sidecar but build/content-enabled (`supports_sidecar=false`, `supports_build=true`), while Capacitor remains `supports_build=false`.

### P0 - Required Before Claiming “Full Migration Complete”

- [x] **Productize mobile capability boundary decision (must choose and freeze release policy)**
  - [x] Option A: Implement mobile-native equivalent for folder/build/content flow (Tauri Android native runtime path).
  - [x] Option B: Officially define Capacitor mobile as cache/read-focused scope and remove parity ambiguity in UI/docs.

- [x] **Capacitor runtime behavior hardening**
  - [x] Detect Capacitor runtime explicitly and avoid desktop-sidecar assumptions in source loading.
  - [x] Provide deterministic fallback UX when `/api/folders`, `/api/build`, `/api/content` are unavailable.
  - [x] Define content strategy for reader in Capacitor mode (read-only packaged graph policy + explicit unsupported notice for unavailable content APIs).

- [x] **Mobile acceptance gate**
  - [x] Add explicit integration test coverage for Capacitor runtime boundary behavior.
  - [x] Add manual verification checklist for Capacitor APK:
    - [x] startup behavior
    - [x] source panel behavior
    - [x] reader behavior
    - [x] path mode entry/exit behavior
  - [ ] Collect physical-device execution evidence against the checklist for final release sign-off.
    - [x] preflight command available: `npm run verify:capacitor:device`
    - [ ] latest probe result still shows no online Android device connected (2026-03-04).

### P1 - Migration Hygiene and Decommission Clean-up

- [x] **Archive/remove residual Electron artifacts**
  - [x] Remove empty `src/electron` directory or add explicit archive marker.
  - [x] Replace misleading names/comments containing “electron” where runtime is already bridge-based (for maintainability clarity).

- [x] **Documentation alignment**
  - [x] Mark `docs/tauri_tasks.md` as historical where it still lists pre-migration TODOs.
  - [x] Keep active docs Tauri-first and clearly separate desktop vs Android vs Capacitor capability boundaries.

### P2 - Reliability and Release Guardrails

- [x] Keep release gate mandatory:
  - [x] `npm run test:migration`
  - [x] `npm run test:tauri`
- [x] Keep Android environment gate mandatory:
  - [x] `npm run verify:android:env`
- [x] Add CI job matrix to prevent silent regressions:
  - [x] desktop migration suite
  - [x] tauri rust suite
  - [x] mobile pipeline contract suite

### Go/No-Go Policy (Current)

- [x] **GO**: Desktop Electron decommissioning.
- [x] **NO-GO policy active**: Do not claim “all-platform runtime parity complete” while Capacitor remains in read-only scope.

---

# 2026-03-03 v1.5.8 - PathBridge Handshake + Tauri Early-Socket Stability


### Added in This Round

- [x] Removed Godot-incompatible WebSocket query URL in `path_mode/scripts/ws_client.gd`:
  - [x] `ws://127.0.0.1:9876/?client=godot` -> `ws://127.0.0.1:9876`
  - [x] Added explicit `identify` handshake payload after connect.
  - [x] Added pre-connect message queue flush to avoid early configure-drop warnings.

- [x] Added explicit client-identification protocol in `src/core/PathBridge.ts`:
  - [x] Added `identify` message handling.
  - [x] Added runtime client tag update (`setClientTag`) with sanitization.
  - [x] Kept URL-tag fallback compatible for browser legacy callers.

- [x] Hardened frontend Bridge behavior in `src/frontend/path_app.js`:
  - [x] Removed query-tag URL usage and switched to base `ws://localhost:9876`.
  - [x] Sent `identify` payloads for both `frontend` and `frontend-early`.
  - [x] Added Tauri-runtime guard using `window.__TAURI__` OR `navigator.userAgent.includes('Tauri')` to prevent accidental `frontend-early` socket startup in Tauri.

- [x] Added regression coverage:
  - [x] New contract file: `src/pathbridge.handshake.contract.test.ts`.
  - [x] Included in `test:migration` suite.

### Verification

- [x] `npm run test:migration` -> PASS (`53` tests).
- [x] `npm run test:tauri` -> PASS (`14` tests).

### Scope Safety

- [x] Desktop behavior unchanged except bridge handshake logging/tagging stability.
- [x] Web browser mode still supports early bridge mode.
- [x] Android Pathmode flow remains unchanged.

---

# 2026-03-03 v1.5.7 - Android Native Pathmode Smoke Lifecycle Automation


### Added in This Round

- [x] Added Android runtime smoke lifecycle script:
  - [x] `scripts/smoke-android-pathmode.js`
  - [x] checks `MainActivity -> PathmodeGodotActivity -> MainActivity` through `adb` + `dumpsys activity`.
  - [x] sends back event (`KEYCODE_BACK`) to verify activity return path.
  - [x] supports optional strict mode:
    - [x] `NOTE_CONNECTION_ANDROID_SMOKE_REQUIRE_DEVICE=1` makes no-device state fail
    - [x] default mode skips gracefully when no device/emulator is attached.

- [x] Added npm entrypoint:
  - [x] `smoke:android:pathmode` in `package.json`.

- [x] Added regression contracts for smoke integration:
  - [x] `src/android.pathmode.smoke.contract.test.ts`.
  - [x] Updated `src/mobile.pipeline.test.ts` to assert smoke script registration.
  - [x] Updated `test:migration` suite list to include smoke contract test.

### Verification

- [x] `npm run test:migration` -> PASS (`50` tests).
- [x] `npm run test:tauri` -> PASS (`14` tests).
- [x] `npm run smoke:android:pathmode` -> PASS (graceful skip without connected device).

### Scope Safety

- [x] No desktop behavior changes.
- [x] No web behavior changes.
- [x] Android smoke flow is standalone and only invoked explicitly.

---

# 2026-03-03 v1.5.6 - Option A Android Native Pathmode (Godot Full-Screen) Execution


### Implemented in This Round

- [x] **Option A launch path implemented for Android**
  - [x] Added Android-native Pathmode launch command: `open_native_pathmode` in `src-tauri/src/lib.rs`.
  - [x] Added runtime capability flag: `supports_native_pathmode` (Android=true, desktop/web=false).
  - [x] Updated frontend Path Mode entry (`src/frontend/app.js`) to:
    - [x] prefer native Android launch when capability is enabled
    - [x] keep desktop/web flow unchanged (fallback to existing web Path Mode container)

- [x] **Android full-screen Godot activity bridge landed**
  - [x] Added tracked Android templates:
    - [x] `src-tauri/mobile/android/PathmodeBridge.kt`
    - [x] `src-tauri/mobile/android/PathmodeGodotActivity.kt`
  - [x] Added generated-project patch pipeline:
    - [x] `scripts/apply-tauri-android-pathmode.js`
    - [x] `scripts/run-tauri-android.js` now auto-applies patch before/after Android commands.
  - [x] Added Android asset sync for `path_mode` into `src-tauri/gen/android/app/src/main/assets/path_mode`.

- [x] **Exit back behavior implemented**
  - [x] Godot `Exit` now quits Android Pathmode activity and returns to main Tauri window (`path_mode/scripts/path_renderer.gd`).

- [x] **Android build path hardened**
  - [x] Added Android-only cargo memory controls in runner (`CARGO_BUILD_JOBS`, release opt/codegen tuning).
  - [x] Added patch logic for:
    - [x] Godot Maven dependency and manifest merge rules
    - [x] Kotlin plugin version alignment required by Godot Android artifact

### Verification

- [x] `npm run test:migration` -> PASS (`48` tests).
- [x] `npm run test:tauri` -> PASS (`14` tests).
- [x] `node scripts/run-tauri-android.js build` -> PASS.
  - [x] APK: `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk`
  - [x] AAB: `src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab`

### Scope Safety

- [x] Desktop behavior unchanged.
- [x] Web behavior unchanged.
- [x] Android-only logic is capability-gated and build-script-gated.

---

# 2026-03-03 v1.5.5 - Status Normalization Update (Proceeding)


### Revalidated in This Round

- [x] Re-ran migration gate suites:
  - [x] `npm run test:migration` -> PASS (`44` tests).
  - [x] `npm run test:tauri` -> PASS (`14` tests).
- [x] Confirmed `v1.5.3` and `v1.5.4` closure items remain valid (P0 engineering + P1 runtime-boundary UI).
- [x] Confirmed sidecar content-boundary checks and load/history contract tests remain green.

### Backlog Hygiene

- [x] Marked `v1.5.2` checklist as historical/superseded context to avoid execution ambiguity.
- [x] Kept historical checklist body intact for traceability (no destructive edits).

### Remaining Actionable Scope

- [ ] Final mobile parity decision remains open at product level:
  - [ ] Option A: implement Android-native build/content pipeline parity with desktop sidecar flow.
  - [x] Option B (active policy): keep Android capability-gated cache/read runtime and document boundary explicitly.

---

# 2026-03-03 v1.5.3 - Execution Progress Update (P0 Completed)


### Completed in This Execution Round

- [x] **Secure sidecar content API to match Rust boundary guarantees**
  - [x] Enforced KB-root boundary checks for `/api/content` in `src/server.ts`.
  - [x] Added regression tests for:
    - [x] allowed inside-root absolute path
    - [x] allowed legacy `Knowledge_Base` marker path
    - [x] blocked outside-root path (`403`)

- [x] **Lock cache prompt + single-load execution behavior (contract coverage)**
  - [x] Added source-manager load-flow guard contract tests:
    - [x] duplicate event-binding guard
    - [x] in-progress click guard
    - [x] single cache-choice prompt branch contract
  - [x] Existing server-side restore/build dedupe tests remain passing.

- [x] **Finalize Godot History consistency contract**
  - [x] Added `record_navigation_node(node_id)` in `path_mode_ui.gd`.
  - [x] Wired `path_renderer.gd` to record center-switch history on `render_path`.
  - [x] Added regression contract test for history hook presence.

- [x] **Final Go/No-Go technical gate (engineering portion)**
  - [x] `npm run test:migration` -> PASS (`43` tests).
  - [x] `npm run test:tauri` -> PASS (`14` tests).

### Remaining Product Decision (Non-blocking to Desktop Stability)

- [ ] Choose final mobile parity product scope:
  - [ ] Option A: Android-native equivalent build runtime.
  - [x] Option B (current active policy): cache/read-focused mobile runtime with explicit capability boundaries.

---

# 2026-03-03 v1.5.2 - Electron Removal Final Gate (Post-Audit Action Plan)


> Superseded Note (2026-03-03 v1.5.5): This section is preserved as historical plan context. P0/P1 closure evidence is recorded in `v1.5.3` and `v1.5.4` above. Unchecked boxes below are not current execution blockers unless explicitly reopened.

**Audit Decision Snapshot**

- [x] Desktop Electron -> Tauri migration is functionally successful.
- [x] Capacitor export pipeline remains available and buildable.
- [x] Tauri Android export pipeline is buildable.
- [ ] Full runtime parity across desktop/mobile is not complete yet.

### P0 - Must Complete Before Declaring Full Migration Closure

- [x] **Secure sidecar content API to match Rust boundary guarantees**
  - [x] Enforced KB-root boundary checks for `/api/content` in `src/server.ts`, equivalent to `read_node_content`.
  - [x] Added regression tests covering allowed path, blocked outside path, and Windows/relative path variants.

- [x] **Lock cache prompt + single-load execution behavior under Tauri startup races**
  - [x] Added integration-level contract coverage:
    - [x] "cache exists -> prompt appears exactly once"
    - [x] "single click -> one restore/build path only"
  - [x] Validated against sidecar dedupe + frontend reload guard interactions.
  - [x] Historical block reconciled to implemented state (see `v1.5.3`).

- [x] **Finalize Godot History consistency contract**
  - [x] Center-switch events append to History timeline via Godot history hook integration.
  - [x] Deterministic contract coverage exists for history hook behavior.
  - [x] Historical block reconciled to implemented state (see `v1.5.3`).

### P1 - Mobile/Export Parity Clarification and Hardening

- [ ] **Clarify Android runtime capability boundaries in product docs/UI**
  - [ ] Explicitly document that Android currently runs with `supports_sidecar=false` and `supports_build=false`.
  - [ ] Provide user-facing fallback guidance for cache-only mode.

- [ ] **Decide and implement mobile build parity strategy**
  - [ ] Option A: implement Android-native build/content pipeline equivalent to desktop sidecar flow.
  - [ ] Option B: keep cache/read-only scope and make it explicit as a product constraint.

### P2 - Documentation Hygiene (without deleting history)

- [ ] Tag historical Electron sections as archived context to reduce operator confusion.
- [ ] Keep active release/runbook sections Tauri-first and dual-mobile-path accurate.

### Final Go/No-Go Gate (Full-Scope)

- [ ] `npm run test:migration` passes with new parity tests.
- [ ] `npm run test:tauri` passes with new security and behavior tests.
- [ ] Manual verification passes for:
  - [ ] cache prompt appears once
  - [ ] load action executes once
  - [ ] History records center switches
- [ ] Security validation passes for sidecar content path boundaries.

---

# 2026-03-02 v1.5.1 - Android Runtime Parity Expansion (Targets + Content + Cache-Only UX)


**Goal**: Convert desktop-sidecar-only target/content flows into runtime-safe contracts for Tauri Android, while preserving desktop behavior.

### Completed This Round

- [x] **Target discovery parity landed**
  - [x] Added sidecar API `GET /api/available-targets` (folders + cached targets merged).
  - [x] Added Tauri command `get_available_targets` with equivalent behavior.
  - [x] Updated frontend source loading to prefer available-target APIs and fallback safely.

- [x] **Mobile-safe content read path landed**
  - [x] Added Tauri command `read_node_content(file_path)`.
  - [x] Enforced KB root boundary checks for content reads (reject outside-root access).
  - [x] Added legacy path rebasing for desktop-style `.../Knowledge_Base/...` file references.
  - [x] Updated reader fallback to use Rust command when sidecar is unavailable.

- [x] **Cache-only UX hardening for `supports_build=false` runtimes**
  - [x] Mobile source list now filters to cache-available targets.
  - [x] `ALL_FOLDERS` option shown only when active cache exists.
  - [x] Load button disabled when no cache candidate exists.

- [x] **Regression coverage and build evidence refreshed**
  - [x] Added/updated migration tests for new available-target and runtime-content contracts.
  - [x] `npm run test:migration` passed (`35` tests).
  - [x] `npm run test:tauri` passed (`14` tests).
  - [x] `npm run tauri:android:build` passed.
  - [x] `npm run tauri:android:build:universal` passed.

### Remaining Work (Current Scope)

- [ ] **In-app Android graph build pipeline parity**
  - [ ] Provide Android-native equivalent for desktop `/api/build` workflow.
  - [ ] Define SAF/File API based import and persistent permission strategy for KB sources.

- [ ] **Path Mode/Godot Android strategy finalization**
  - [ ] Keep desktop-only intentionally with explicit UX messaging, or
  - [ ] design and implement Android-capable rendering/runtime alternative.

---

# 2026-03-02 v1.5.0 - Tauri Android Build Unblock (Arm64 Deterministic Path)


**Goal**: Unblock Tauri Android from environment/setup failures to a reproducible build path, while keeping Capacitor and Tauri Android dual generation available.

### Completed This Round

- [x] **Android SDK toolchain detection and enforcement**
  - [x] Confirmed Android SDK Command-line Tools (`cmdline-tools/latest`) detection.
  - [x] Confirmed NDK detection (`ndk;27.2.12479018`) through preflight script.
  - [x] `npm run verify:android:env` now passes on the current machine.

- [x] **Desktop-only Rust dependencies isolated from Android target**
  - [x] Moved `rfd` dependency to desktop-only target section in `src-tauri/Cargo.toml`.
  - [x] Added Android-safe folder-picker fallback path in `src-tauri/src/lib.rs`.

- [x] **Android-specific Tauri runtime configuration**
  - [x] Added `src-tauri/tauri.android.conf.json` to clear `bundle.externalBin` for Android.
  - [x] Guarded desktop-only menu APIs and desktop process launch logic with `cfg(not(target_os = "android"))`.
  - [x] Android startup now intentionally skips desktop Node sidecar and Godot process launch.

- [x] **Tauri Android wrapper hardening**
  - [x] Added default Android target strategy: `aarch64` for `dev/build` to avoid armv7 LLVM OOM on Windows hosts.
  - [x] Added override support via `NOTE_CONNECTION_TAURI_ANDROID_TARGET`.
  - [x] Fixed Windows process launch issue (`spawnSync npx.cmd EINVAL`) by invoking through `cmd.exe /d /s /c`.
  - [x] Added explicit spawn error/signal logging in `scripts/run-tauri-android.js`.

- [x] **Regression coverage updated**
  - [x] Updated `src/mobile.pipeline.test.ts` to assert arm64 default + override contract.
  - [x] Verified `npm run test:migration` pass (`30` tests).

- [x] **Build verification**
  - [x] Verified `node scripts/run-tauri-android.js build` pass.
  - [x] Verified `npm run tauri:android:build` pass.
  - [x] Generated artifacts:
    - `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk`
    - `src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab`

### Remaining Migration Items (P1.5 Follow-up)

- [ ] **Android runtime feature parity for desktop-only capabilities**
  - [ ] Replace or redesign Node sidecar-dependent APIs (`/api/build`, `/api/content`, folder scan/build pipeline) for Android runtime.
  - [ ] Define Android-native storage/input strategy (SAF/File APIs) for knowledge base selection and loading.

- [ ] **Path Mode/Godot on Android roadmap decision**
  - [ ] Keep Godot bridge desktop-only (current behavior), or introduce an Android-compatible rendering/runtime path.
  - [ ] Document expected UX/capability differences explicitly for Android users.

- [x] **Optional multi-ABI strategy**
  - [x] Keep `aarch64` as default stable target.
  - [x] Add opt-in universal ABI build path only when host memory/toolchain is sufficient.

---

# 2026-03-01 v1.4.9 - Runtime Verification Update (Desktop + Mobile)


**Goal**: Continue execution after `v1.4.8` with real pipeline runs, and convert remaining Tauri Android uncertainty into an explicit, actionable prerequisite gate.

### Completed This Round

- [x] **Desktop packaging re-verified**
  - [x] Ran `npm run tauri:build:mini` with `NOTE_CONNECTION_GODOT_EXE` set.
  - [x] Sidecar validation passed (`server` + `godot` binaries non-empty).
  - [x] MSI + NSIS artifacts generated successfully.

- [x] **Capacitor Android pipeline fully executed**
  - [x] Fixed `build_apk.bat` parse failures caused by unescaped parentheses inside `if (...)` blocks.
  - [x] Added non-interactive support (`NOTE_CONNECTION_NO_PAUSE` / `CI=true`) for automation.
  - [x] Ran `build_apk.bat` end-to-end and produced debug APK.

- [x] **Tauri Android preflight hardening**
  - [x] Added `scripts/verify-tauri-android-prereqs.js`.
  - [x] Added `npm run verify:android:env`.
  - [x] Wired preflight into:
  - [x] `tauri:android:init`
  - [x] `tauri:android:dev`
  - [x] `tauri:android:build`
  - [x] Result: clear deterministic error when `cmdline-tools/latest/bin/sdkmanager` is missing.

- [x] **Regression coverage updated**
  - [x] Expanded `src/mobile.pipeline.test.ts` to assert:
  - [x] Android preflight script wiring in npm commands.
  - [x] `build_apk.bat` automation flag support.
  - [x] `npm run test:migration` remains green.

- [x] **Dual-path aggregate command validated**
  - [x] Ran `npm run mobile:build:both`.
  - [x] Capacitor branch completed with APK output.
  - [x] Tauri Android branch stopped at explicit preflight check (expected until cmdline-tools are installed).

### Remaining External Prerequisite (Environment)

- [x] **Install Android SDK Command-line Tools for Tauri Android runtime**
  - [x] Required path: `<ANDROID_SDK_ROOT>/cmdline-tools/latest/bin/sdkmanager(.bat)`.
  - [x] Verified with:
  - [x] `npm run verify:android:env`
  - [x] `npm run tauri:android:build`

---

# 2026-03-01 v1.4.8 - Migration Closure & Dual Android Verification


**Goal**: Close the migration action list with executable verification evidence, especially for `P1.5` (Capacitor + Tauri Android dual generation paths).

### Completed Checklist

- [x] **Dual Android pipeline guard tests added**
  - [x] Added `src/mobile.pipeline.test.ts` to lock down:
  - [x] Capacitor + Tauri Android script availability in `package.json`.
  - [x] `capacitor.config.ts` `webDir` consistency (`dist/src/frontend`).
  - [x] `build_apk.bat` expected sync/build steps.
  - [x] `src-tauri/tauri.conf.json` sidecar entries (`bin/server`, `bin/godot`).

- [x] **Migration regression suite expanded**
  - [x] Updated `test:migration` in `package.json` to include `src/mobile.pipeline.test.ts`.
  - [x] Migration suite now covers runtime paths, cache/build dedupe, and dual mobile pipeline contract checks.

- [x] **Execution evidence refreshed (this run)**
  - [x] `npm run build:mini` -> pass.
  - [x] `npm run test:migration` -> pass (`29` tests).
  - [x] `npm run test:tauri` -> pass (`9` Rust tests).
  - [x] `npm run smoke:sidecar:relaunch` -> pass.

### Result

- [x] `P1.5` is now not only documented but also protected by automated regression checks.
- [x] Electron -> Tauri migration checklist is considered closed for the current repository scope (desktop Tauri-first + dual mobile generation entry points).

---

# 2026-03-01 v1.4.6 - Electron Removal Readiness Action Plan


**Goal**: Close all remaining Electron -> Tauri migration gaps so Electron can be removed without regression across desktop release and mobile export strategy.

### Phase P0 - Must Complete Before Electron Removal

- [x] **Implement Tauri persistent config parity (`kb_config` equivalent)**
  - [x] Persist selected KB path in Tauri app data.
  - [x] Persist user language in Tauri app data.
  - [x] Load both values on startup before frontend initialization.
  - [x] Acceptance: Restart keeps same KB root and menu language without manual re-selection.

- [x] **Harden Godot process launch for non-dev machines**
  - [x] Remove hardcoded absolute paths in `src-tauri/src/lib.rs`.
  - [x] Use packaged/bundled sidecar strategy for Godot executable resolution.
  - [x] Validate Godot binary presence in build artifacts (non-zero file, correct target naming).
  - [x] Acceptance: `npm run tauri build` artifact produced with sidecar validation pipeline.

- [x] **Add explicit child-process lifecycle management**
  - [x] Keep handles for Node sidecar and Godot child processes.
  - [x] Implement app shutdown hooks to terminate child processes deterministically.
  - [x] Add relaunch test to ensure no lingering `3000` port lock.
  - [x] Acceptance: Close app -> no orphan sidecar/Godot processes remain.

- [x] **Fix release-grade writable data/cache paths**
  - [x] Stop assuming write access to `dist/src/frontend` in packaged environments.
  - [x] Define a writable runtime directory (app data/cache) for generated `data.js` and `graph_data.json`.
  - [x] Update sidecar runtime env (`NOTE_CONNECTION_FRONTEND_DIR` + `NOTE_CONNECTION_RUNTIME_DATA_DIR`) and restore/cache logic accordingly.
  - [x] Acceptance: Build + cache restore works with writable runtime data path model in packaged flow.

- [x] **Complete first-run parity with Electron UX**
  - [x] Add first-run KB selection flow in Tauri when no saved config exists.
  - [x] Preserve current menu-based "Change KB / Reset" behavior with persistence.
  - [x] Acceptance: New install follows first-run setup and stores user choice permanently.

### Phase P1 - Stabilization and Verification

- [x] **Unify backend build logs to frontend loading overlay**
  - [x] Emit structured `build-log` events from Rust/sidecar bridge to frontend.
  - [x] Ensure long builds show progress in Tauri as in prior Electron UX.
  - [x] Acceptance: Loading overlay receives incremental backend logs during `/api/build`.

- [x] **Run release smoke tests and document evidence**
  - [x] Windows packaging test (`tauri build` output artifacts generated).
  - [x] Cache decision modal behavior test (`Load Existing` vs `Regenerate`).
  - [x] Single-click build dedupe test (no duplicate build/restore execution).
  - [x] Acceptance: Added reproducible pass evidence in `TEST_REPORT.md`.

- [x] **Clarify GPU startup command usage**
  - [x] Keep recommending `npm run tauri:dev:mini:gpu`.
  - [x] Avoid `npm run tauri:dev:mini --gpu` in docs/examples to prevent npm config warnings.
  - [x] Acceptance: README/manual examples contain only the supported command form.

### Phase P1.5 - Dual Mobile Delivery (Capacitor + Tauri Android)

- [x] **Keep both authoritative Android generation paths**
  - [x] Path A: Keep Capacitor as web-asset runtime with scoped feature set.
  - [x] Path B: Enable Tauri Android workflow per `docs/tauri_brainstorming.md`.
  - [x] Acceptance: Both paths are documented and exposed as build scripts.

- [x] **Capacitor path boundaries explicitly documented**
  - [x] Mark folder-based local build/load sidecar APIs as unsupported on-device unless backend is embedded.
  - [x] Keep mobile-safe fallback UX expectations for source loading/reader content.
  - [x] Acceptance: APK behavior constraints are explicitly documented.

- [x] **Tauri Android pipeline bootstrapped**
  - [x] Add Android build scripts and prerequisites for Tauri mobile.
  - [x] Keep Node-sidecar compatibility caveat documented until mobile-native backend replacement.
  - [x] Acceptance: Tauri Android commands are available for end-to-end pipeline execution.

### Phase P2 - Electron Decommission

- [x] **Remove Electron entry surface only after P0/P1 gates are green**
  - [x] Remove Electron scripts from `package.json`.
  - [x] Remove `main: dist/src/electron/main.js`.
  - [x] Remove Electron dependencies (`electron`, `electron-builder`, `electron-squirrel-startup`) after migration freeze.
  - [x] Archive/remove `src/electron/*` and `electron-builder.yml`.
  - [x] Acceptance: Desktop pipeline is Tauri-first with Electron decommissioned.

- [x] **Documentation cleanup**
  - [x] Update README build/deploy sections from Electron-first to Tauri-first.
  - [x] Keep historical changelog entries, but mark Electron path as deprecated/removed with date.
  - [x] Acceptance: No active docs instruct users to use Electron commands for current releases.

### Electron Removal Gate Checklist (Go/No-Go)

- [x] Persistent KB + language parity verified in Tauri.
- [x] Godot launch works without hardcoded local path.
- [x] No orphan child process after app exit.
- [x] Packaged Tauri build supports build/cache/reader workflows.
- [x] Dual mobile delivery strategy (Capacitor + Tauri Android) finalized and documented.
- [x] README and scripts fully aligned to Tauri.

---

# 2026-03-01 v1.4.5 - Physically-Based Bubbles & Cancel Completion


**Goal**: Upgrade the Godot visualizer with realistic physically-based soap bubbles, remove environmental obstructions, and add flexible task completion UI logic.

### Completed Checklist

- [x] **Physically-Based Shader**
  - [x] Ported 81-wavelength Thin-Film Interference Glassner logic to `bubble_material.gdshader`.
  - [x] Added `warpnoise3` and `sp_spectral_filter` for realistic thickness variations across the sphere.
- [x] **Physics Interactions**
  - [x] Converted central and peripheral bubbles from `MeshInstance3D` to `RigidBody3D`.
  - [x] Added `_physics_process` orbital magnetism so bubbles float and collide realistically without overlapping permanently.
  - [x] Removed `Floor` node obstruction from the `main.tscn` environment.
- [x] **Cancel Completion UI**
  - [x] "Mark Complete" button now dynamically toggles to "Cancel Completion".
  - [x] Connected dynamic states in `path_mode_ui.gd` and `path_renderer.gd` to appropriately mark/unmark nodes.

# 2026-03-01 v1.4.4 - Tauri Bridge Stabilization & Duplicate-Cycle Elimination


**Goal**: Finalize Bridge-first migration hardening for Tauri runtime by resolving cache/load duplication, websocket reconnect churn, and runtime path consistency issues.

### Completed Checklist

- [x] **Cache Decision Recovery**
  - [x] Restored explicit cache decision flow (`Load Existing` / `Regenerate`) before build when target cache exists.
- [x] **Duplicate Execution Protection**
  - [x] Added frontend single-flight guard for source loading.
  - [x] Added backend dedupe protections for `/api/build` and `/api/restore-cache`.
- [x] **PathBridge Diagnostics**
  - [x] Added tagged connection logging (client id/tag/address + close code/reason) to distinguish benign reconnects from real cycles.
- [x] **Godot WS Compatibility**
  - [x] Finalized Godot URL contract as `ws://127.0.0.1:9876` (query suffix removed for Godot compatibility).
- [x] **Tauri Idle Reconnect Removal**
  - [x] Disabled `frontend-early` auto websocket bootstrap in Tauri mode.
- [x] **Language/Menu Idempotency**
  - [x] Added frontend and Rust-side no-op guards for repeated same-language sync calls.

### Files Updated

- `src/frontend/source_manager.js`
- `src/server.ts`
- `src/core/PathBridge.ts`
- `src/frontend/path_app.js`
- `path_mode/scripts/ws_client.gd`
- `src/frontend/i18n.js`
- `src-tauri/src/lib.rs`

# 2026-02-26 v1.4.3 - 9-Rule Tree Layout Engine

**Goal**: Port the 9-rule expansion/claiming/visibility engine from `tree_path_mockup.html` into production code. Replace simple contour-based layout with full ownership/claiming system.

## 9 Rules Reference

| #   | Rule (EN)                                 | 规则 (ZH)                  | Status |
| --- | ----------------------------------------- | -------------------------- | ------ |
| 1   | Expansion Order (FIFO claiming)           | 展开顺序（FIFO 认领）      | [x]    |
| 2   | Preceding Immunity (effective index)      | 前置免疫（有效索引）       | [x]    |
| 3   | Following Migration (spine+followers)     | 后续迁移（脊柱+后续）      | [x]    |
| 4   | Single Appearance (owner-based)           | 单次出现（基于所有者）     | [x]    |
| 5   | Cross-Tributary Isolation (edge filter)   | 跨支流隔离（边过滤）       | [x]    |
| 6   | Spine Always Visible (return on collapse) | 脊柱始终可见（折叠时返回） | [x]    |
| 7   | Sticky Claim (configurable toggle)        | 粘性认领（可配置开关）     | [x]    |
| 8   | Unit Migration (recursive claim)          | 单元迁移（递归认领）       | [x]    |
| 9   | Tributary Hierarchy Immunity              | 支流层级免疫               | [x]    |

## Implementation Checklist / 实施清单

- [x] **Core Algorithm / 核心算法** ([path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js))
  - [x] Add `expansionOrder` parameter / 添加 `expansionOrder` 参数
  - [x] Implement ownership system (`currentOwner`, `ownerPriority`) / 实现所有权系统
  - [x] Implement `tryClaim()` with 9 rules / 实现包含 9 条规则的 `tryClaim()`
  - [x] Implement `getEffectiveSpineIndex()` / 实现有效脊柱索引
  - [x] Implement `determineVisibility()` / 实现可见性判定
  - [x] Filter edges by ownership (Rule 5) / 按所有权过滤边
  - [x] Group hulls by ownership / 按所有权分组 hull

- [x] **Frontend Bridge / 前端桥接** ([path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js))
  - [x] Convert `forcedExpansionNodes` Set → `expansionOrder` Array / 转换为有序数组
  - [x] Add `stickyClaimEnabled` setting / 添加粘性认领设置

- [x] **Godot Renderer / Godot 渲染器** ([tree_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/tree_renderer.gd))
  - [x] Edge filtering by `currentOwner` / 按所有者过滤边
  - [x] Hull collision avoidance / Hull 碰撞避让
  - [x] Node type coloring (spine/tributary/shared/migrated) / 节点类型着色
  - [x] Expansion indicator badge / 展开指示器徽章

- [x] **Worker** ([path_worker.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_worker.js))
  - [x] Pass `expansionOrder` + `stickyClaimEnabled` / 传递展开顺序和粘性认领

## Files Changed / 修改文件

| File                                 | Change                                 | 变更                                 |
| ------------------------------------ | -------------------------------------- | ------------------------------------ |
| `src/frontend/libs/path_core.js`     | Add 9-rule engine to `getTreeLayout()` | 向 `getTreeLayout()` 添加 9 规则引擎 |
| `src/frontend/path_app.js`           | Ordered expansion tracking             | 有序展开追踪                         |
| `path_mode/scripts/tree_renderer.gd` | Edge/hull/color updates                | 边/hull/颜色更新                     |
| `src/frontend/path_worker.js`        | Pass new parameters                    | 传递新参数                           |

## Reference / 参考

- Mockup: [tree_path_mockup.html](file:///e:/Knowledge_project/NoteConnection_app/tree_path_mockup.html)
- Previous plan: [implementation_plan.md](file:///e:/Knowledge_project/NoteConnection_app/implementation_plan.md) Phase 3
- Design notes: [brainstorming.md](file:///e:/Knowledge_project/NoteConnection_app/brainstorming.md) Session 6

---

# 2026-02-01 v1.4.1 - Path Mode v2: Orbital Learning Architecture

**Goal**: Transform Path Mode into an immersive, game-like learning experience with 3D bubble visualization and progress tracking.

## Architecture Overview

### Hybrid Visualization Strategy

1. **Godot Desktop** (Port 9876): Vulkan/OpenGL + 3D iridescent bubbles
2. **Web Fallback**: Canvas/WebGL for Android/Browser
3. **Godot Mermaid Runtime Contract**: PNG-only (`pngBase64` required); SVG retained as diagnostics-only payload, not runtime fallback.

### Learning Modes

- **Domain Learning**: Topological sort of concept cluster (learn entire subject area)
- **Diffusion Learning**: Shortest path from target backwards to prerequisites

---

## Finalized Design Decisions

| Decision             | Final Choice                       | Rationale                      |
| -------------------- | ---------------------------------- | ------------------------------ |
| Display Limit        | 1 Central + 1-4 Peripheral         | Adapts to connectivity         |
| Zero In-Degree       | Use highest relevance score        | Ensures meaningful peripherals |
| Peripheral Selection | In-degree first + association fill | Balances order with discovery  |
| Central Content      | Title + Progress indicator         | Core UX requirement            |
| Peripheral Labels    | 15 chars + ellipsis                | Clean yet informative          |
| Transition           | Orbital rotation (~500ms)          | Matches metaphor               |
| Gold Star Sidebar    | Collapsible `★ × {N}` format       | Reduces clutter                |

---

## Implementation Checklist

- [ ] **Orbital Bubble Layout**
  - [x] Central bubble = current priority node (large, bright)
  - [x] Peripheral bubbles = connected nodes (smaller, semi-transparent)
  - [x] Smooth animation on central node switch
  - [ ] **Orbital rotation animation** (~500ms arc transition)
  - [ ] Layer separation (peripheral cannot overlap central text)
  - [ ] 3D iridescent bubble shader (fresnel + thin-film interference)

- [ ] **Peripheral Node Selection Algorithm**
  - [ ] Domain Mode: In-degree nodes first, fill with highest-association
  - [ ] Diffusion Mode: High-association to current (exclude target out-degree)
  - [ ] Zero in-degree fallback: Select by relevance score

- [ ] **Central Bubble Content**
  - [ ] Node title (max 24 chars)
  - [ ] Progress indicator: "X of Y prerequisites learned"
  - [ ] Peripheral labels: Title only (max 15 chars + ellipsis)

- [ ] **Learning Progress Tracking**
  - [ ] "Mark Complete" button shrinks central to gold mini-bubble
  - [ ] Collapsible sidebar: `★ × {count}` header format
  - [ ] Click sidebar item → Opens reader
  - [ ] localStorage persistence by default
  - [ ] Auto-advance to next highest priority node

- [ ] **Settings: Path Mode Section**
  - [ ] Add "Path Mode" section to settings modal
  - [ ] "Retain Learning History" checkbox (default ON)
  - [ ] "Auto-reconstruct path on start change" toggle
  - [ ] Integrate with `SettingsManager`

- [ ] **Focus-like Interactions**
  - [x] Double-click central → Opens reader with node content
  - [x] Double-click peripheral → Orbital rotation to center
  - [x] Canvas hit-testing for click detection

- [ ] **Future Path Tree View**
  - [ ] D3-based tree layout for future learning path
  - [ ] Click tree node → Switch central view
  - [ ] Visual states: ★ Completed, ● Current, ○ Pending

- [ ] **Enhanced Graphical Tree View (v2)**
  - [ ] SubViewport overlay panel with collapsible drawer
  - [ ] Bezier curve rendering (parent-child connections)
  - [ ] 4 selectable visual themes:
    - [ ] **Colorful Status** (default): Gold/Cyan/Gray by state
    - [ ] **Dark**: Dark bg, gradient nodes, soft blue/purple curves
    - [ ] **Glass/Frosted**: Semi-transparent, glowing curves
    - [ ] **Minimal Monochrome**: White/gray, thin curves
  - [ ] Tab buttons: `[Subtree] [Full Path]`
  - [ ] Dropdown style selector in header
  - [ ] Node interactions:
    - [ ] Single-click: Expand/collapse + context menu
    - [ ] Double-click: Navigate (make central)
    - [ ] Context menu: Navigate / Mark Complete / Unmark
  - [ ] **New Files**:
    - [ ] `tree_view_panel.tscn` + `tree_view_panel.gd`
    - [ ] `tree_renderer.gd` (bezier curve drawing)
    - [ ] `tree_styles.gd` (4 visual themes)

- [ ] **Godot Desktop Renderer**
  - [ ] Upgrade `path_renderer.gd` to 3D MeshInstance3D
  - [ ] Implement `bubble_material.gdshader` (fresnel + iridescence)
  - [ ] Create `learning_state_machine.gd` for flow control
  - [ ] Central/Peripheral bubble differentiation
  - [ ] Bidirectional interaction via WebSocket
  - [ ] `node_clicked` signal → PathBridge → Frontend

- [ ] **Frontend Web Fallback**
  - [ ] Create `path_orbital.js` (Canvas orbital renderer)
  - [ ] Create `path_tree.js` (D3 tree layout)
  - [ ] Orbital rotation animation in Canvas

---

## File Changes Required

### Backend

- **[MODIFY]** `src/frontend/libs/path_core.js`
  - Add `getPeripheralNodes(centralId, mode)` method
  - Add `getTreePath(currentId, learningPath)` for tree view
  - Add progress tracking state management

### Godot

- **[MODIFY]** `path_mode/scripts/path_renderer.gd` → 3D rendering
- **[NEW]** `path_mode/scripts/learning_state_machine.gd`
- **[NEW]** `path_mode/shaders/bubble_material.gdshader`
- **[MODIFY]** `path_mode/scripts/ws_client.gd` → New message handlers

### Frontend

- **[NEW]** `src/frontend/libs/path_orbital.js`
- **[NEW]** `src/frontend/libs/path_tree.js`

---

# 2026-01-23 v1.2.0 - Path Mode & Desktop Renderer

**Goal**: Transform the graph into a structured learning curriculum and enable high-fidelity desktop rendering.

- [x] **Path Mode (Learning Paths)**
  - [x] **strategies**: Implemented "Foundational" (Base-first) and "Core" (Centrality-first) sorting algorithms.
  - [x] **Modes**:
    - **Domain Learning**: Topological sort of a concept cluster to map a full subject area.
    - **Diffusion Learning**: Shortest-path extraction from a target node backwards to its prerequisites.
  - [x] **Visualization**:
    - **Radial / Tree Layouts**: specialized D3 layouts for linearizing graphs.
    - **Progress Tracking**: Visual states for "Learned", "Next", and "Locked" nodes.
- [x] **Hybrid Architecture**
  - [x] **Godot Bridge**: Established WebSocket communication (`Start port: 9876`) between Electron and Godot 4.3.
  - [x] **Native Renderer**: Low-latency Vulkan/OpenGL renderer for the "Path Mode" visualization on Desktop.
  - [x] **Web Fallback**: Full feature parity in Web/Canvas mode for Android and browser users.

# 2026-01-23 v1.1.2 - Path Resolution & UI Stability

**Goal**: Resolve static file serving issues on Windows and fix UI unresponsiveness in the Welcome Modal.

- [x] **Backend Fixes**
  - [x] **URL Parsing**: Improved `server.ts` to ignore query strings when mapping static files, enabling cache-busting `data.js?v=...` to work correctly.
- [x] **UI Stability**
  - [x] **Z-Index Management**: Fixed `welcome.js` to explicitly restore `z-index: 1000` to the folder menu after skipping the tutorial.

# 2026-01-22 v1.1.1 - Mobile Build Automation

**Goal**: Automate the Android APK build process to lower the barrier for mobile deployment.

- [x] **Mobile DevOps**
  - [x] **Build Script**: Created `build_apk.bat` for zero-config build orchestration on Windows.
  - [x] **Environment Checks**: Automated verification of Node.js, Java JDK, and Android SDK.
  - [x] **Documentation**: Updated all manuals with the new one-click build method.

# 2026-01-22 v1.1.0 - CI/CD Automation

**Goal**: Improve system robustness through protocol handler fixes, i18n consolidation, and onboarding UI refinement.

- [x] **Multilingual Consolidation**
  - [x] **Centralized I18n**: Removed redundant hardcoded translation logic from `app.js` and integrated with `I18nManager`.
  - [x] **UI Consistency**: Fixed "Mixed Language" issues in the Welcome Modal and Loading screen.
- [x] **Onboarding UI Refinement**
  - [x] **Tutorial Stability**: Fixed Focus Mode activation in tutorials by exposing `enterFocusMode` and `exitFocusMode` as global APIs.
  - [x] **Welcome Modal UX**: Optimized trigger timing in `source_manager.js` to ensure accurate display based on data state.
- [x] **Protocol Handler & Caching**
  - [x] **Cache-Busting**: Implemented dynamic script loading in `source_manager.js` using timestamps to prevent browser caching of `data.js`.
  - [x] **Protocol Optimization**: Refined `app://` protocol handler in `main.ts` using `net.fetch` for better reliability.
- [x] **Mobile Build Automation**
  - [x] **Build Script**: Implemented `build_apk.bat` for one-click Android APK generation (Zero-Config).
  - [x] **Documentation**: Updated User Manual and README with build instructions.

---

# 2026-01-14 v1.0.0 - Production Release

**Goal**: Official production release with optimized Focus Mode, GPU diagnostics, and enhanced security.

- [x] **Focus Mode Optimization**
  - [x] **Adjacency Cache**: Implemented O(1) adjacency lookup for neighbors, reducing Focus Mode entry time by 50-500x.
  - [x] **Edge Map for Scoring**: Optimized neighbor scoring by caching edge weights.
  - [x] **Batched Rendering**: Wrapped UI updates in `requestAnimationFrame` to prevent layout thrashing.
- [x] **Random Focus**: Added a dice icon next to the search bar for discovering and focusing on random nodes instantly.
- [x] **GPU & Security**
  - [x] **Forced GPU Mode**: Explicitly set GPU mode with detailed hardware vendor/renderer reporting.
  - [x] **CSP Enhancement**: Updated Content Security Policy to allow external font loading (Google Fonts).
  - [x] **Security Hardening**: Removed insecure `enableBlinkFeatures` flag.
- [x] **User-Defined Knowledge Base**
  - [x] **Persistence**: Implemented `kb_config.json` to store user-selected paths.
  - [x] **First-Run Experience**: Added setup wizard for selecting initial KB folder.
  - [x] **Menu Integration**: Added "Change Knowledge Base" and "Reset to Default" to File menu.
- [x] **Stability & Installer Reliability**
  - [x] **Mini Build Fix**: Resolved first-run crashes and implemented automatic cleanup of pre-generated data files in mini mode.
  - [x] **Worker Paths**: Fixed worker path resolution issues in production environment.
- [x] **Absolute Offline Support**
  - [x] **Local Assets**: Migrated all CDN dependencies (D3, KaTeX, Mermaid, etc.) to local assets.
  - [x] **CSP Security**: Updated CSP to support absolute offline operation.
- [x] **Focus Mode Fidelity**
  - [x] **Visual Restoration**: Guaranteed perfect radius and font-size restoration when exiting focus mode.
  - [x] **Interaction**: Fixed D3 sibling selection errors in Focus Mode.
- [x] **Physics Defaults**
  - [x] **Spacing**: Increased default link distance to 250px and collision to 25px for better legibility.

---

# 2026-01-13 v0.9.83 - GPU Rendering Debugging

**Goal**: Resolve race conditions during layout switching due to asynchronous Worker messages, enhance interaction stability in Focus Mode, and improve layout restoration security.

- [x] **Worker Handshake Protocol**
  - [x] **Display Lock**: Implemented `isLayoutSwitching` state machine to block stale `tick` messages during transitions.
  - [x] **Bi-directional Sync**: Introduced `layoutSwitchDone` loop to ensure UI and Worker coordinates are perfectly aligned.
- [x] **Focus Mode Dragging Isolation**
  - [x] **Manual Dragging**: Focus Mode nodes no longer send drag messages to the Worker; coordinates are calculated directly on the main thread.
  - [x] **Display Refresh**: Fixed race condition bug where late messages would overwrite manually set coordinates.
- [x] **Layout Restoration Safety**
  - [x] **Threshold Validation**: Set a 50% success threshold for cache restoration.
  - [x] **Auto Fallback**: If many nodes are missing or data is inconsistent, automatically force a physics relaxation phase.
- [x] **Analysis Panel Stability**
  - [x] **Render Optimization**: Adjusted `updateLayout` logic to strictly prohibit center force resets during panel resizing under "Freeze Layout".
- [x] **GPU Worker Integration**
  - [x] **Worker Acceleration**: Fully enabled GPU forces (`gpuManyBody`, `gpuLink`) within `simulationWorker.js`.
  - [x] **Environment Fix**: Refactored `layout_gpu.js` to be compatible with Web Worker `self` context via `globalScope`.
  - [x] **Persistence Fix**: Optimized `updateParams` in Worker to update existing forces using `.strength()` instead of replacing them, preventing accidental CPU-fallback.
  - [x] **Settings Sync**: Verified `gpuRendering` flag is correctly passed to the Worker during initialization.

# Project Build Plan: Progressive Hierarchical Knowledge Graph

This document outlines the roadmap for building `NoteConnection`, a system capable of visualizing tens of thousands of knowledge points as a Directed Acyclic Graph (DAG), highlighting hierarchical relationships and learning paths.

---

# 2026-01-12 v0.9.74 - GPU Link Force & Robustness

**Goal**: Implement GPU-accelerated Link Force and finalize stable layout switching with state preservation and WebGL resource management.

- [x] **GPU Link Force Acceleration**
  - [x] **GPULinkForce Class**: Implemented high-performance spring force in `layout_gpu.js`.
  - [x] **Gather Algorithm**: Optimized neighbor processing using flattened adjacency structures.
  - [x] **D3 Integration**: Added API shims (`links`, `strength`, `distance`) for seamless `app.js` integration.

- [x] **Physics Robustness & Stability**
  - [x] **Velocity Clamping**: Prevents node "explosions" by capping velocity at 100.
  - [x] **NaN Safety**: Implemented math guards in GPU kernels and `isFinite` checks in JS.
  - [x] **Shadowing Fix**: Renamed internal `links` to `_links` in `GPULinkForce` to prevent property-method collision.
  - [x] **Focus Mode Support**: Updated `enterFocusMode` and `exitFocusMode` in `app.js` to handle GPU forces.
  - [x] **Focus Mode Isolation**: Enforced completely independent node dimensions and positioning, with zero leakage to the main interface upon exit.
  - [x] **Focus Mode Interactions**: Enabled manual node dragging (without physics) and fixed race condition causing position reset.
  - [x] **Query History**: Implemented a history dropdown in Focus Mode; pins duplicate nodes to top of list.
  - [x] **Analysis Stability**: Added auto-freeze and prevented redundant layout updates (center force reset) during resize.
  - [x] **Analysis Scroll**: Fixed container styles to ensure the "Filtered Nodes" list is vertically scrollable.

- [x] **Layout Switching & Resource Fixes**
  - [x] **Switch Logic**: Implemented "First Switch" relaxation vs "Subsequent Switch" restoration logic.
  - [x] **Cache Persistence**: Enforced strict validation of cached layout states; falls back to relaxation if cache is invalid or partial.
  - [x] **Race Condition Fix**: Implemented Worker Handshake Protocol (`isLayoutSwitching`) to block stale ticks causing layout reversion.
  - [x] **GPU Resource**: Prevented redundant GPU kernal re-compilation on layout switches by reusing manager instances. for `SharedGPU`, preventing WebGL context leaks.
  - [x] **Constructor Safety**: Enhanced `GPU.GPU` detection for varying library builds.
  - [x] **Responsiveness**: Optimized layout switching to be near-instant by deferring worker synchronization.

---

# 2026-01-12 v0.9.73 - GPU Rendering Fix (Chaining Bug)

**Goal**: Fix the "Silent Failure" of GPU Force caused by a method chaining bug in `layout_gpu.js`, which prevented v0.9.72 from actually activating the GPU physics despite UI settings.

- [x] **Bug Fix**
  - [x] **Method Chaining**: Fixed `strength()` method in `layout_gpu.js` to return the `impl` function wrapper instead of `this`.
  - [x] **Verification**: Confirmed `d3.force` now correctly receives the callable function.

# 2026-01-12 v0.9.72 - GPU Optimized Rendering (Geek Edition)

**Goal**: Fulfill the "Geek" requirement to leverage AMDGPU (RX 7900XT) for smoother frontend rendering and parallel backend processing.

- [x] **Frontend GPU Rendering**
  - [x] **GPU Force Engine**: Implemented `GPUManyBodyForce` in `layout_gpu.js` using `gpu.js`.
  - [x] **Integration**: Added `libs/gpu-browser.min.js` and integrated into `app.js`.
  - [x] **UI Control**: Verified "GPU Optimised Rendering" checkbox in Settings. Default: Enabled.
  - [x] **Logic**: Dynamic switching between CPU (`d3.forceManyBody`) and GPU (`gpuManyBody`) physics engines.

- [x] **Backend Optimization Confirmation**
  - [x] **Parallelism**: Confirmed `GraphBuilder` uses `LayoutEngine` with Worker threads.
  - [x] **GPU Backend**: Confirmed `LayoutEngine` uses `amdgpu/LayoutGPU.ts` if enabled.

---

# 2026-01-10 v0.9.71 - Backend Layout & Static Mode

**Goal**: Optimize performance for massive graphs (50k+ nodes) by offloading layout calculations to backend workers and implementing a static rendering mode.

- [x] **Backend Parallel Layout**
  - [x] **Layout Engine**: Created `LayoutEngine.ts` and `layoutWorker.ts` to run `d3-force` simulation on backend threads.
  - [x] **Integration**: `GraphBuilder` now automatically triggers backend layout calculation for graphs > 100 nodes.
  - [x] **GPU Acceleration**: Implemented `LayoutGPU.ts` using `gpu.js` to accelerate layout on AMDGPU.
  - [x] **Performance**: Reduces frontend initialization time by providing pre-calculated coordinates.

- [x] **Frontend Optimizations**
  - [x] **Static Mode**: Introduced a "Static Mode" toggle.
    - [x] **Auto-Enable**: Automatically enabled for >5000 nodes or >200,000 edges.
    - [x] **Behavior**: Simulation runs for 2 seconds (warm-up) then stops to save CPU.
    - [x] **Layout Switch**: Respects static mode during layout transitions (Force <-> DAG).
  - [x] **GPU Settings**: Added "GPU Optimised Rendering" checkbox to settings to control acceleration flags.
  - [x] **Extreme Scale**: Strictly disabled edge rendering for graphs >10,000 nodes to prevent rendering bottlenecks.

- [x] **CLI & File Management**
  - [x] **CLI Arguments**: Added `--path` and `--gpu` support to `npm start`.
  - [x] **File Isolation**: CLI runs generate unique `data_cli_*.js` files to protect the original `data.js`.
  - [x] **Server Logic**: `server.ts` automatically serves the correct CLI data file based on build parameters.

---

# 2026-01-09 v0.9.70 - Frontend Initialization Fix (Race Condition)

**Goal**: Resolve the "No nodes displayed" and "Unresponsive Buttons" issue caused by a race condition in the initialization sequence for large datasets.

- [x] **Bug Fix**
  - [x] **Race Condition**: Identified that `renderCanvas` was being called by `ResizeObserver` or `setTimeout` _before_ the `controls` object was defined, causing a fatal error that halted script execution.
  - [x] **Refactor**: Moved `controls` definition to the top of `app.js`.
  - [x] **Robustness**: Added safety checks in `isNodeVisible` and `renderCanvas` to prevent crashes during initialization.
  - [x] **Result**: UI buttons (Freeze, Settings) should now initialize correctly, and the canvas should render immediately.

# 2026-01-09 v0.9.69 - Frontend Crash Fix (10k+ Nodes)

**Goal**: Fix the critical "Nodes: 0" bug caused by a stack overflow when processing 1.2 million edges in the frontend.

- [x] **Bug Fix**
  - [x] **Stack Overflow**: Identified `RangeError: Maximum call stack size exceeded` in `app.js` due to `links.push(...validLinks)` with 1.2M arguments.
  - [x] **Refactor**: Changed `links` declaration from `const` to `let` and replaced the spread operation with direct assignment (`links = validLinks`).
  - [x] **Result**: The application now successfully loads and renders graphs with >10,000 nodes and >1 million edges without crashing.

# 2026-01-09 v0.9.68 - Content-on-Demand Architecture (10k+ Fix)

**Goal**: Definitively solve the "Nodes: 0" display issue for 10k+ nodes caused by massive `data.js` file size (~500MB) crashing the browser.

- [x] **Architecture Refactor**
  - [x] **Data Splitting**: Separated graph structure (`data.js`) from content (`graph_data.json`).
  - [x] **Optimization**: `data.js` now excludes node content, reducing file size by ~95% (e.g., 500MB -> 35MB for 13k nodes).
  - [x] **Backend**: Updated `src/index.ts` to generate "Lite" `data.js`.

- [x] **Content-on-Demand**
  - [x] **API Endpoint**: Added `GET /api/content` to `server.ts` to serve raw node content securely.
  - [x] **Frontend**: Updated `Reader` in `reader.js` to fetch content asynchronously when opening a node.
  - [x] **UX**: Added loading state indicator in Reader window.

# 2026-01-08 v0.9.67 - Compact Mode & Canvas Fix

**Goal**: Solve the display issue for 10k+ nodes and implement a performance mode that hides edges by default.

- [x] **Compact Mode**
  - [x] **Auto-Enable**: Automatically activates for >5000 nodes or >100,000 edges.
  - [x] **Edge Culling**: Rendering loop skips edge iteration entirely in Compact Mode unless highlighting is active.
  - [x] **Settings UI**: Added "Compact Mode (Hide Edges)" checkbox to Performance settings.
- [x] **Canvas Fix**
  - [x] **Initial Render**: Forced explicit `resizeCanvas()` and `ticked()` calls after initialization to prevent blank screen.

# 2026-01-08 v0.9.63 - 10k Node Optimization & Memory Strategy

**Goal**: Solve the "stuck" rendering issue for 10k+ nodes/1.2M edges and implement configurable memory strategies for backend processing.

- [x] **Frontend Optimization**
  - [x] **Physics Culling**: Implemented edge limit (20k) for the D3 Force Simulation. If total edges exceed this, only a subset drives the physics to prevent Main Thread freeze, while all edges remain available for rendering/traversal.
  - [x] **Link Resolution**: Pre-resolved link source/target to objects to support robust rendering even when physics uses a subset.
  - [x] **UI Unblocking**: Fixed "Quick Start Guide" not appearing by freeing up the main thread.

- [x] **Backend Memory Strategy**
  - [x] **Configuration**: Added `memorySavingMode` and `deepDebug` to `AppConfig`.
  - [x] **Worker Optimization**: Refactored `keywordMatchWorker` and `statisticalWorker` to support both `filePaths` (Low Memory) and `filesChunk` (High Performance/Precision) modes.
  - [x] **Graph Metrics**: Added check to force Single-Core execution for `Betweenness Centrality` when `memorySavingMode` is active.
  - [x] **Cycle Detection**: Adjusted limit (100 vs 10000) based on memory mode.

- [x] **System Monitoring**
  - [x] **Peak Memory**: Updated `PerformanceLogger` to track and log Peak Heap/RSS memory usage.
  - [x] **Deep Debug**: Implemented conditional detailed logging based on `deepDebug` flag.

# 2026-01-07 v0.9.62 - Documentation Update (AMDGPU Guide)

**Goal**: Provide detailed hardware and software guidance for AMDGPU users, specifically for `gpu.js` acceleration and future AI integration.

- [x] **Documentation**
  - [x] **README.md**: Add "Hardware & Driver Requirements" section detailing RDNA architectures, driver selection (Adrenalin vs Mesa/ROCm), and build dependencies for `headless-gl`.

# 2026-01-07 v0.9.61 - Frontend Memory Optimization (Auto-Canvas)

**Goal**: Reduce frontend memory consumption and improve rendering performance for large graphs by automatically defaulting to "Canvas" mode when the node count exceeds a threshold.

- [x] **Smart Defaults**
  - [x] **Threshold Check**: In `app.js`, check if `nodes.length > 3000`.
  - [x] **Auto-Switch**: If threshold exceeded, programmatically select "Canvas" renderer and update DOM visibility (hide SVG, show Canvas) during initialization.
  - [x] **User Override**: Users can still manually switch back to SVG if desired.

# 2026-01-07 v0.9.60 - Parallel Graph Metrics

**Goal**: Optimize graph construction performance by parallelizing the "Graph Metrics" calculation (Betweenness Centrality), which was previously single-threaded.

- [x] **Parallelization**
  - [x] **Worker Implementation**: Created `betweennessWorker.ts` to calculate partial centrality scores for a subset of nodes using Brandes Algorithm.
  - [x] **Async Logic**: Updated `GraphMetrics` to `calculateBetweennessAsync` using a pool of workers (Default: `numCPUs - 1`).
  - [x] **Integration**: Integrated async metrics calculation into `GraphBuilder` pipeline.
  - [x] **Verification**: Validated functionality with `test_metrics_parallel.ts` on 500+ nodes.

# 2026-01-07 v0.9.59 - Vector Space Memory Fix (Sparse Matrix)

**Goal**: Resolve the "Heap out of memory" crash on Windows 10/11 (128GB RAM) when processing 13k+ files by replacing the dense TF-IDF matrix with a Sparse Vector implementation.

- [x] **Memory Optimization**
  - [x] **Sparse Vectors**: Refactored `VectorSpace` to use `Uint32Array` (indices) and `Float32Array` (values) instead of standard Javascript Arrays.
  - [x] **Efficiency**: Reduced memory footprint for 13k files from ~10GB+ (dense) to <500MB (sparse).
  - [x] **Algorithm**: Optimized Cosine Similarity calculation to use sparse dot product ($O(min(N, M))$).
  - [x] **Config**: Increased default Node.js heap limit to 12GB (`--max-old-space-size=12288`) in `package.json` to utilize available system RAM.

# 2026-01-07 v0.9.58 - Hybrid Inference Resource Reuse (Optimization)

**Goal**: Fix "Heap out of memory" crash during Hybrid Inference by preventing redundant calculation of Statistical Matrix and Vector Space.

- [x] **Resource Optimization**
  - [x] **Shared State**: Implemented `sharedStatsMatrix` and `sharedVectorSpace` in `GraphBuilder`.
  - [x] **Logic**: Pre-calculates these heavy resources if `HybridInference` is enabled, reusing them across Statistical and Vector steps.
  - [x] **Cleanup**: Explicitly clears shared resources after inference is complete.
  - [x] **Result**: Eliminates the 2x memory spike when running Hybrid Inference, preventing OOM on 13k+ files.

# 2026-01-07 v0.9.57 - Worker Memory Optimization

**Goal**: Resolve "Heap out of memory" errors on Windows 10/11 when processing large datasets (13k+ files) by optimizing data transfer between main thread and workers.

- [x] **Worker Data Transfer**
  - [x] **Optimization**: Refactored `keywordMatchWorker` and `statisticalWorker` to accept `filePaths: string[]` instead of `filesChunk: RawFile[]` (which contained full content).
  - [x] **Implementation**: Workers now read file content on-demand from disk using `fs`, avoiding the massive memory overhead of cloning content strings during serialization.
  - [x] **Result**: Significantly reduced heap usage during parallel processing steps.

# 2026-01-05 v0.9.56 - Hybrid Inference Memory Analysis

**Goal**: Analyze and optimize the memory usage of the "Hybrid Inference" engine to resolve "Heap out of memory" errors on Windows 10, preventing large object retention during graph construction.

- [x] **Granular Logging**
  - [x] **Implementation**: Added detailed `PerformanceLogger` steps within `HybridEngine.infer` and `GraphBuilder` (Stats Matrix, Vector Space, Inference Engine).
  - [x] **Progress Tracking**: Logs memory usage every 1000 nodes processed during inference to pinpoint spikes.
  - [x] **Optimization**: Explicitly clears the large `matrix` and nullifies `vectorSpace` immediately after inference to release heap memory before subsequent steps.

# 2026-01-05 v0.9.55 - Heap OOM Fix & Iterative DFS

**Goal**: Resolve "Heap out of memory" crash on Windows 10/11 by optimizing memory usage during graph construction and refactoring recursion to iteration.

- [x] **Memory Optimization**
  - [x] **Scope Management**: Explicitly clear `fileMap` (holding file contents) before entering the memory-intensive `Algorithmic Core` phase in `GraphBuilder`.
  - [x] **Granular Logging**: Split `Algorithmic Core` logging into `Cycle Detection` and `Topological Sort` for precise error tracking.

- [x] **Algorithm Robustness**
  - [x] **Iterative DFS**: Refactored `CycleDetector.detectCycles` to use an iterative stack-based approach instead of recursion to prevent stack overflow on deep graphs.
  - [x] **Verification**: Validated logic with existing unit tests.

# 2026-01-05 v0.9.54 - Welcome & Empty State Experience

**Goal**: Improve the new user onboarding experience by providing clear guidance when the graph is empty.

- [x] **Empty State Handling**
  - [x] **Detection**: Logic in `welcome.js` detects if `graphData` is empty or missing.
  - [x] **Welcome Modal**: Implemented a "Welcome to NoteConnection" modal that guides users to:
    1. Select a Source Folder.
    2. Click Load.
  - [x] **Visual Cues**: Highlights the Source Control area when the modal is active.

# 2026-01-05 v0.9.53 - Core API Decoupling

**Goal**: Prepare the codebase for Plugin integration (Joplin/Obsidian) by decoupling the core logic from the CLI environment.

- [x] **Core Refactoring**
  - [x] **NoteConnection Class**: Created `src/core/NoteConnection.ts` as the main facade.
  - [x] **Decoupling**: Moved `buildGraph` logic out of `src/index.ts` to allow library-style usage.
  - [x] **CLI Update**: Refactored `src/index.ts` to consume the new Core API.

# 2026-01-05 v0.9.52 - Cycle Detection Memory Optimization

**Goal**: Solve the "Heap out of memory" crash on Windows 10/11 when processing large graphs with many cycles (100k+ edges).

- [x] **Cycle Detection Optimization**
  - [x] **Limit Logic**: Updated `CycleDetector` to accept a `limit` parameter.
  - [x] **Termination**: Stops recursion/search immediately after finding the specified number of cycles (100) instead of collecting all of them.
  - [x] **Verification**: Added unit tests to ensure limit is respected.

# 2026-01-03 v0.9.51 - Performance Logging & Crash Reporting

**Goal**: Enhance system observability by implementing detailed performance metrics and automatic crash reporting to facilitate debugging.

- [x] **Performance Logger**
  - [x] **Utility**: Created `PerformanceLogger` class to track Time, CPU (User/Sys), and Memory (Heap/RSS).
  - [x] **Integration**: Wrapped all `GraphBuilder` stages (Node Init, Edge Matching, Inference) with logging.
  - [x] **GPU Tracking**: Integrated logging into `VectorSpaceGPU` to monitor kernel execution time.
- [x] **Crash Reporting**
  - [x] **Utility**: Created `CrashLogger` to write unhandled errors to `crash.log`.
  - [x] **Integration**: Attached global handlers (`uncaughtException`, `unhandledRejection`) in `server.ts`.
  - [x] **Workers**: Added try-catch blocks and logger integration to `keywordMatchWorker` and `statisticalWorker`.

# 2026-01-02 v0.9.50 - GPU Acceleration Feasibility

**Goal**: Verify and implement GPU acceleration for mathematical operations (Matrix Multiplication) to further speed up Graph Construction on supported hardware (verified on AMD 7900XT).

- [x] **Feasibility Verification**
  - [x] **Library**: Installed `gpu.js` to bridge Node.js with GPU via WebGL/OpenCL.
  - [x] **Hardware Check**: Verified successful kernel compilation and execution on AMD Radeon 7900XT (Windows 10).
  - [x] **Benchmark**: Matrix Multiplication (512x512) completed successfully in GPU mode.
- [x] **Implementation Plan**
  - [x] **Vector Space**: Offload the $N \times N$ Cosine Similarity matrix calculation to GPU (`amdgpu/VectorSpaceGPU.ts`).
  - [x] **Constraint**: Keep string processing (Keyword Matching) on CPU (Workers) as data transfer overhead to GPU outweighs benefits for text.

---

# 2026-01-02 v0.9.49 - Statistical Analysis Memory Optimization

**Goal**: Fix "Heap out of memory" errors when processing large datasets (10k+ files) by optimizing the Co-occurrence Matrix calculation.

- [x] **Algorithm Optimization**
  - [x] **Sparse Matrix Calculation**: Refactored `calculateMatrixOptimized` to use a file-centric iteration approach ($O(Files \times TermsPerFile^2)$) instead of the dense term-pair iteration ($O(TotalTerms^2)$).
  - [x] **Reduction of Complexity**: Reduced complexity from ~170 million iterations (for 13k nodes) to ~5 million iterations.
  - [x] **Data Structure Efficiency**: Removed unnecessary intermediate object conversions (`Set` <-> `Array`) during worker result aggregation.
  - [x] **Worker Result Merging**: Optimized `runParallelTermExtraction` to merge chunks iteratively instead of using `reduce` to prevent memory spikes.

---

# 2026-01-02 v0.9.48 - Parallel Processing Optimization

**Goal**: Optimize graph building performance by allowing configurable worker thread limits, utilizing more CPU cores for large datasets.

- [x] **Worker Configuration**
  - [x] **Configurable Limit**: Added `maxWorkers` to `AppConfig` to override the default worker limit.
  - [x] **Removal of Cap**: Removed the hardcoded 12-worker limit in `GraphBuilder` and `StatisticalAnalyzer`. Defaults to `numCPUs - 1` if not specified.
  - [x] **Verification**: Validated with 50 workers on test dataset.

---

# 2026-01-02 v0.9.47 - Focus Mode Interaction & Layout Fixes

**Goal**: Improve Focus Mode usability by preventing accidental zooming and fixing label overlap in Vertical layouts.

- [x] **Interaction Logic**
  - [x] **Double Click Zoom Prevention**: Added `stopPropagation` to the node double-click handler to prevent `d3.zoom` from triggering a zoom-in event when entering Focus Mode.

- [x] **Focus Mode Layout**
  - [x] **Vertical Spacing**: In "Vertical" (L-R) layout, increased the horizontal offset (`dx`) of node labels to **35px** (from default ~12px) to prevent overlap between text and nodes.
  - [x] **Focus Node**: Applied the same horizontal offset to the central Focus Node in vertical layout for consistency.

---

# 2025-12-26 v0.9.46 - Focus Mode UI Cleanup & Canvas Edge Fix

**Goal**: Clean up the UI during Focus Mode to reduce clutter and fix visual rendering in Canvas mode.

- [x] **UI Hiding**
  - [x] **Main Controls**: "Select Knowledge Base", "Load", and the main "NoteConnection" dropdown are now completely hidden (`display: none`) when entering Focus Mode.
  - [x] **Restoration**: Elements are restored to their default state (`display: ''`) upon exiting Focus Mode, respecting CSS rules (e.g., mobile visibility).

- [x] **Canvas Visualization**
  - [x] **Edge Hiding**: In Canvas Focus Mode, _all_ edges are now hidden to provide a cleaner look, matching the "do not display any edges" requirement.

---

# 2025-12-26 v0.9.45 - Canvas Interactivity & cleanup

**Goal**: Enable full interactivity (Hover, Click, Focus) in Canvas mode and remove the deprecated "View Mode" (Clusters) feature.

- [x] **Canvas Interactivity**
  - [x] **Hit Testing**: Implemented `findNodeAt(x, y)` to detect nodes under the mouse cursor in Canvas mode, accounting for zoom/pan transforms.
  - [x] **Event Listeners**: Added `mousemove` (highlighting) and `click` (inspection/focus) handlers to the canvas element.
  - [x] **Consistency**: Canvas interaction now matches SVG behavior (Single click -> Stats, Double click -> Focus).

- [x] **Visual Fixes**
  - [x] **Node Sizing**: Updated `renderCanvas` to respect the "Size By" setting (Degree/Centrality/Uniform), fixing the issue where nodes were rendered too large.

- [x] **Cleanup**
  - [x] **View Mode Removal**: Removed "View Mode" (Nodes/Clusters) controls and associated logic from the codebase as it was deprecated.

---

# 2025-12-26 v0.9.44 - Independent Focus Mode Spacing

**Goal**: Allow users to configure "Layer-Space" and "Node-Space" independently for "Horizontal" and "Vertical" layouts in Focus Mode, preventing settings from one layout affecting the other.

- [x] **Spacing Logic**
  - [x] **State Management**: Created `focusSpacingSettings` to store separate `layer` and `node` values for `horizontal` and `vertical` modes.
  - [x] **Defaults**:
    - **Horizontal**: Layer-Space defaulted to **125** (was 250).
    - **Vertical**: Node-Space defaulted to **20** (was 80).
  - [x] **UI Sync**: Switching the Focus Layout dropdown now automatically updates the sliders to reflect the stored values for that specific mode.
  - [x] **Persistence**: Adjusting sliders updates the setting for the _current_ mode only.

---

# 2025-12-26 v0.9.43 - Context-Aware Settings UI

**Goal**: Improve user clarity by dynamically updating the labels in the Settings Modal to reflect the currently active layout mode.

- [x] **UI Enhancement**
  - [x] **Label Switching**: The label for the repulsion slider now updates to "Repulsion (Force)" or "Repulsion (DAG)" based on the active layout when the settings modal is opened.
  - [x] **Localization**: Supports dynamic label switching for both English and Chinese locales.

---

# 2025-12-26 v0.9.42 - Distinct Repulsion Settings

**Goal**: Allow users to configure distinct "Repulsion Strength" values for "Force" and "DAG" layout modes, with layout-specific defaults.

- [x] **Settings Logic**
  - [x] **Data Structure**: Updated `defaultSettings` in `settings.js` to store separate keys: `repulsionForce` (Default: -550) and `repulsionDAG` (Default: -850).
  - [x] **Context-Aware UI**: The "Visualization Settings" modal now automatically displays and updates the repulsion value corresponding to the currently active layout mode.
  - [x] **Dynamic Application**: Switching layouts (`updateLayout`) or changing settings (`settingsManager.subscribe`) dynamically applies the correct force strength.

---

# 2025-12-26 v0.9.41 - Settings Modal Simulation Freeze

**Goal**: Automatically freeze the simulation when the "Visualization Settings" modal is opened to conserve memory/CPU and prevent background activity during configuration.

- [x] **Modal State Logic**
  - [x] **Auto-Freeze**: Opening the Settings Modal (`initSettingsUI`) now triggers `simulation.stop()` and sets an internal `isSettingsModalOpen` flag.
  - [x] **Conditional Resume**: Closing the modal resumes the simulation _only_ if the global "Freeze Layout" checkbox is not checked.
  - [x] **Update Suppression**: Updates triggered by `settingsManager` while the modal is open (e.g. slider drags) apply values but do _not_ restart the simulation loop.

---

# 2025-12-26 v0.9.40 - Freeze Layout Priority Fix (Settings Modal)

**Goal**: Ensure that changing Physics or Visual settings in the "Visualization Settings" modal does not restart the simulation if "Freeze Layout" is currently enabled.

- [x] **Settings Application Logic**
  - [x] **Conditional Restart**: Modified `settingsManager.subscribe` callback in `app.js` to check the "Freeze Layout" checkbox state.
  - [x] **Behavior**:
    - **Frozen**: Forces (charge, distance, collision) are updated in the background, but `simulation.restart()` is skipped. Visual changes (opacity) apply immediately.
    - **Unfrozen**: Forces are updated and simulation restarts (alpha 0.3).

---

# 2025-12-26 v0.9.39 - Layout Switch Relaxation & Freeze Logic

**Goal**: Apply the "Rapid Relaxation" strategy (0.2 damping -> 0.95 damping) when switching layouts, ensuring consistent behavior with initial load. Additionally, ensure "Freeze Layout" is respected after the relaxation period.

- [x] **Layout Transition Logic**
  - [x] **Relaxation**: Switching to a new layout (Force/DAG) resets `velocityDecay` to **0.2** for 2 seconds to allow nodes to find their new positions quickly.
  - [x] **Stabilization**: Automatically transitions to **0.95** damping after 2 seconds.
  - [x] **Delayed Freeze**: If "Freeze Layout" is enabled during the switch, the simulation runs for the 2-second relaxation phase and then automatically **stops**, freezing the new layout in its stabilized state.

---

# 2025-12-26 v0.9.38 - Quick Start Guide HTML Rendering Fix

**Goal**: Fix the issue where HTML tags (like `<br>` and `<strong>`) in the localized Quick Start Guide content were being displayed as raw text instead of being rendered.

- [x] **Rendering Logic**
  - [x] **HTML Support**: Updated `window.updateLanguage` in `app.js` to use `.innerHTML` instead of `.innerText` when injecting translated content. This ensures rich text elements in the guide are displayed correctly.

---

# 2025-12-26 v0.9.37 - Rapid Relaxation Strategy

**Goal**: Implement a two-stage damping process to allow the graph to "unfold" quickly upon load before stabilizing.

- [x] **Damping Logic**
  - [x] **Initial Phase**: Set `velocityDecay` to **0.2** for the first 2 seconds. This low friction allows nodes to rapidly move away from the center and untangle.
  - [x] **Stable Phase**: Automatically transition to **0.95** (high friction) after 2 seconds to stabilize the layout (Updated from 0.92).
  - [x] **Interaction Safety**: Ensures the auto-transition does not override manual slider adjustments made during the initial phase.

---

# 2025-12-26 v0.9.36 - Freeze Layout Priority Fix (Visual Settings)

**Goal**: Ensure that changing visual settings (Degree Basis, Size By) does not trigger a simulation restart if "Freeze Layout" is enabled, respecting the user's command to keep nodes stationary.

- [x] **Visual Update Logic**
  - [x] **Conditional Restart**: Modified `updateSize()` in `app.js` to check the "Freeze Layout" checkbox state.
  - [x] **Behavior**: If frozen, visual attributes (radius, font size) update immediately, but `simulation.restart()` is skipped. The collision force is updated in the background, ready for when the user unfreezes.

---

# 2025-12-26 v0.9.35 - Viewport Culling Relaxation

**Goal**: Relax the viewport culling restrictions to provide a smoother user experience, preventing premature freezing of nodes just outside the viewport and allowing for deeper zooms before global freeze.

- [x] **Culling Optimization**
  - [x] **Full Freeze Threshold**: Lowered from `scale < 0.4` to `scale < 0.1` to allow simulation at broader zoom levels.
  - [x] **Dynamic Buffer**: Increased off-screen buffer from fixed `100` units to `800 / scale` (approx 800 visual pixels), ensuring "fixed range extending outward" behavior.

---

# 2025-12-26 v0.9.34 - Global Layout Update Fix

**Goal**: Ensure that layout switching applies to all nodes in the graph, overriding any optimization constraints (like viewport culling) that might have frozen off-screen nodes.

- [x] **Layout Transition Logic**
  - [x] **Global Unfreeze**: In `updateLayout()`, explicitly clear `fx` and `fy` properties for all nodes when initiating a new simulation.
  - [x] **Culling Reset**: Reset the `isCulled` flag to ensure off-screen nodes are included in the new layout calculation and rendering.
  - [x] **Result**: Switching from 'Force' to 'DAG' (or vice versa) correctly rearranges the entire graph, even if the user is zoomed in and many nodes were previously frozen.

---

# 2025-12-26 v0.9.33 - Layout State Caching (Instant Switch)

**Goal**: Implement state caching to allow switching between layouts ("Force" vs "DAG") without recalculating positions or animating the transition, fulfilling the "template state" requirement.

- [x] **State Management**
  - [x] **Cache**: Create `layoutCache` to store `x, y, fx, fy` for each mode.
  - [x] **Save/Restore**: Implement logic to save current positions before switching and restore target positions after switching.
- [x] **Transition Logic**
  - [x] **Instant Switch**: If a layout state is cached, restore positions and skip the simulation warm-up (`alpha(1)`), effectively teleporting nodes to their previous state.
  - [x] **First Run**: If no cache exists, perform standard simulation.

---

# 2025-12-26 v0.9.32 - High Damping & Render Optimization

**Goal**: Further reduce memory/CPU consumption by increasing simulation friction and skipping DOM updates for frozen off-screen nodes.

- [x] **Damping Adjustment**
  - [x] **Default**: Increased `velocityDecay` to **0.92**.
  - [x] **Effect**: Graph settles much faster; movement is "heavier" and less jittery.

- [x] **Render Culling (DOM)**
  - [x] **Logic**: In `ticked()`, filter the D3 selection to only update nodes that are NOT flagged as `isCulled`.
  - [x] **Mechanism**: `checkSimulationState` sets `isCulled = true` for off-screen nodes.
  - [x] **Benefit**: Avoids thousands of expensive DOM attribute updates per frame for nodes the user cannot see.

---

# 2025-12-26 v0.9.31 - Simulation Optimization (Viewport Culling)

**Goal**: Reduce memory and CPU consumption by minimizing particle movement calculations based on zoom level and viewport visibility.

- [x] **Viewport Culling Logic**
  - [x] **Full View Freeze**: If the user zooms out enough to see the entire graph (or a large portion), automatically stop the simulation to save resources, assuming the layout is stable.
  - [x] **Off-screen Freezing**: When zoomed in, only simulate nodes within the visible viewport. Freeze nodes outside the viewport.
  - [x] **Implementation**:
    - [x] Add `checkSimulationState()` triggered by zoom events.
    - [x] Calculate visible bounds based on `event.transform`.
    - [x] Update `simulation.nodes()` to only include visible nodes (plus a buffer) or use `fx`/`fy` to lock off-screen nodes.

---

# 2025-12-26 v0.9.30 - Focus Mode Layout Isolation

**Goal**: Ensure that layout changes occurring within Focus Mode (automatic arrangement or manual dragging) do not affect the node positions in the main interface upon exiting.

- [x] **Position Backup & Restoration**
  - [x] **Backup**: In `enterFocusMode`, save the current `x`, `y`, `fx`, and `fy` coordinates of all nodes.
  - [x] **Restoration**: In `exitFocusMode`, restore these coordinates to their pre-focus state.
  - [x] **Consistency**: Ensure the graph visual state reverts exactly to how it was before entering Focus Mode.

---

# 2025-12-26 v0.9.29 - Freeze Layout Persistence

**Goal**: Fix bug where "Analysis & Export" (and other layout resizes) would override the "Freeze Layout" state, causing unwanted node movement.

- [x] **Layout Resize Logic**
  - [x] **Behavior**: Modified `ResizeObserver` in `app.js` to strictly check the "Freeze Layout" checkbox state before calling `simulation.restart()`.
  - [x] **Canvas Sync**: Ensured `resizeCanvas()` is called during layout changes to keep the canvas resolution correct even if the simulation is frozen.
  - [x] **Result**: Opening the Analysis Panel or resizing the window now respects the frozen state, keeping nodes stationary.

---

# 2025-12-26 v0.9.28 - Focus Mode Specific Content Access

**Goal**: Optimize user experience by providing a direct way to open specific node content within Focus Mode, avoiding the need for double-clicking.

- [x] **Specific Content Button**
  - [x] **UI**: Added a "Specific Content" button (`#btn-open-content`) to the Focus Mode control panel (`#focus-exit-btn`).
  - [x] **Logic**: Clicking the button triggers `window.reader.open(focusNode)`, mimicking the double-click behavior on a focused node.
  - [x] **Localization**: Added support for English ("Open Specific Content") and Chinese ("打开具体内容").

- [x] **Documentation**
  - [x] **User Manual**: Updated Focus Mode section.
  - [x] **Interface Document**: Updated Focus Mode capabilities.
  - [x] **TEST_REPORT**: Added test case for the new button.

---

# 2025-12-26 v0.9.27 - Conditional Restart

**Goal**: Ensure "Freeze Layout" state is respected when exiting Focus Mode.

- [x] **Conflict Resolution**
  - [x] **Logic**: In `exitFocusMode`, check if "Freeze Layout" is checked.
  - [x] **Behavior**: If checked, call `simulation.stop()` instead of `restart()`, preventing unwanted movement.
  - [x] **Visual**: Manually trigger `ticked()` to ensure the graph renders the restored nodes in their current positions.

# 2025-12-26 v0.9.26 - UX Enhancements

**Goal**: Improve mobile usability and onboard new users effectively.

- [x] **Freeze Layout Button**
  - [x] **UI**: Add a dedicated "Freeze Layout" button to the main interface (top-right or near controls) for quick access, especially on mobile.
  - [x] **Logic**: Link button to the existing simulation freeze functionality. Sync state with the checkbox in controls.
  - [x] **Visual**: Use an icon (e.g., Lock/Unlock) to indicate state.

- [x] **Quick Start Manual**
  - [x] **Content**: Create a concise "How to Use" guide covering:
    - Loading Data
    - Navigation (Pan/Zoom)
    - Focus Mode (Double Click)
    - Inspection (Click/Hover)
    - Analysis Panel
  - [x] **UI**: Implement as a Modal that opens on first load (localStorage check) or via a "Help" button.
  - [x] **Localization**: Support English and Chinese.

- [x] **Documentation**
  - [x] **Interface Document**: Update with new UI elements.
  - [x] **README**: Add changelog.
  - [x] **Test Report**: Verify new features.

---

# 2025-12-25 v0.9.25 - Freeze Layout Optimization

**Goal**: Minimize resource usage by strictly freezing the main graph when requested, preventing user interactions that would wake the simulation.

- [x] **Freeze Layout Enhancement**
  - [x] **Behavior**: Checking "Freeze Layout" now disables node dragging in the main interface (SVG Mode).
  - [x] **Constraint**: This restriction does _not_ apply to Focus Mode, where manual adjustment is still permitted.
  - [x] **Performance**: Prevents `simulation.restart()` triggers from drag events, ensuring the simulation stays effectively stopped (0% CPU usage).

- [x] **Documentation**
  - [x] **Interface Document**: Updated Simulation Controls section.
  - [x] **README**: Added changelog entry.
  - [x] **Test Report**: Verified behavior.

---

# 2025-12-25 v0.9.24 - Focus Mode Memory Optimization

**Goal**: Reduce memory/CPU expenditure in SVG mode by freezing background nodes during Focus Mode.

- [x] **Simulation Optimization**
  - [x] **Subsetting**: Modified `enterFocusMode` to filter `simulation.nodes()` and `simulation.force("link").links()` to only include the focused subset.
  - [x] **Freezing**: Background nodes are effectively frozen as they are no longer processed by D3 forces.
  - [x] **Restoration**: Modified `exitFocusMode` to restore the full set of nodes and links to the simulation.

- [x] **Documentation**
  - [x] **Interface Document**: Updated with optimization details.
  - [x] **README**: Added changelog entry.
  - [x] **Test Report**: Verified optimization behavior.

---

# 2025-12-25 v0.9.23 - Default Settings Adjustment

**Goal**: Adjust default settings for Reading Window font size and Simulation Damping based on user feedback.

- [x] **Reading Window Font Size**
  - [x] **Implementation**: Modified `Reader` class in `reader.js` to set `currentZoom` to 0.5 by default.
  - [x] **Logic**: Affects initialization and reset on open.

- [x] **Simulation Damping**
  - [x] **Implementation**: Updated `app.js` to initialize `d3.forceSimulation` with `.velocityDecay(0.6)`.
  - [x] **UI**: Updated `index.html` slider default value and display text to 0.6.

---

# 2025-12-25 v0.9.22 - Mobile Popup Adaptation

**Goal**: Adapt the node statistics popup for mobile devices with touch-based drag and pinch-to-zoom capabilities.

- [x] **Touch Drag Support**
  - [x] **Implementation**: Added `touchstart`, `touchmove`, `touchend` listeners to `popupDragHandle`.
  - [x] **Logic**: Mirrors mouse drag logic using `touches[0]` coordinates.
  - [x] **Constraint**: Requires single-finger touch on the header.

- [x] **Pinch-to-Zoom Support**
  - [x] **Implementation**: Added `touchstart`, `touchmove`, `touchend` listeners to `statsPopup`.
  - [x] **Logic**: Calculates distance between two fingers (`Math.hypot`) to determine scale ratio.
  - [x] **Scaling**: Updates `popupDragState.currentScale` and applies to `fontSize`.
  - [x] **Clamping**: Restricted scale between 0.5x and 2.0x.

- [x] **Documentation**
  - [x] **Interface Document**: Updated with mobile interaction specs.
  - [x] **README**: Added changelog entry.
  - [x] **Test Report**: Verified mobile interactions.

---

# 2025-12-25 v0.9.21 - Strict Edge Visibility & Optimization

**Goal**: Enforce strict edge visibility rules (hidden by default) and optimize rendering for large graphs.

- [x] **Strict Edge Visibility**
  - [x] **SVG Mode**: Modified `updateVisibility` in `app.js` to set default edge opacity to 0 (was 0.15).
  - [x] **Consistency**: Ensured SVG behavior matches Canvas mode (hidden by default).
  - [x] **Performance**: Reduced visual clutter and rendering cost for initial view.

- [x] **Documentation**
  - [x] **Interface Document**: Updated to reflect strict edge visibility in v0.9.21.
  - [x] **README**: Added v0.9.21 changelog.
  - [x] **Test Report**: Verified behavior for v0.9.21.

---

# 2025-12-24 v0.9.20 - Selection State Auto-Clear on Focus Entry

**Goal**: Automatically clear any existing selection or highlight state when entering Focus Mode via double-click for a clean transition.

- [x] **Auto-Clear Implementation**
  - [x] **Highlight Clearing**: Modified `handleDoubleClick()` to call `highlightManager.unhighlight({ force: true })` before entering focus mode.
  - [x] **Popup Hiding**: Automatically hide the statistics popup (`#node-stats-popup`) when entering focus mode.
  - [x] **State Management**: Ensures clean state transition without residual visual artifacts.

- [x] **User Experience Enhancement**
  - [x] **Clean Transition**: Users always start with a pristine focused context.
  - [x] **Visual Clarity**: Prevents confusion from overlapping highlights between normal and focus modes.
  - [x] **Consistent Behavior**: Standardized focus mode entry behavior across all scenarios.

- [x] **Documentation**
  - [x] **Interface Document**: Updated with v0.9.20 selection auto-clear specifications.
  - [x] **README**: Added v0.9.20 changelog entries in both English and Chinese.
  - [x] **Code Comments**: Bilingual comments explaining the auto-clear logic.
  - [x] **TODO**: Documented completed feature implementation.

---

# 2025-12-24 v0.9.19 - Focus Mode & Popup Enhancements

**Goal**: Fix focus mode refresh issues and add drag/zoom functionality to the statistics popup for better user experience.

- [x] **Focus Mode Re-entry Fix**
  - [x] **Double-Click Behavior**: Modified `handleDoubleClick()` to allow re-entering focus mode on related nodes while already in focus mode.
  - [x] **State Reset**: Ensured all node visibility flags (`isFocusVisible`, `fx`, `fy`, `_labelDy`) are properly reset before entering new focus context.
  - [x] **Prevention**: Removed the restriction that blocked switching focus between related nodes in `enterFocusMode()`.

- [x] **Statistics Popup Enhancements**
  - [x] **Drag Functionality**: Implemented mouse-based dragging by clicking and dragging the popup header.
    - [x] **State Tracking**: Created `popupDragState` to track drag position and scale.
    - [x] **Event Handlers**: Added `mousedown`, `mousemove`, and `mouseup` listeners for drag control.
    - [x] **Visual Feedback**: Added `.dragging` class for cursor feedback during drag.
  - [x] **Zoom Controls**: Added three zoom buttons (+, −, ⟲) to scale popup content.
    - [x] **Scale Range**: 0.5x to 2.0x with 0.1 increments.
    - [x] **Implementation**: Applied scaling via `fontSize` CSS property on `.popup-content`.
    - [x] **Reset Function**: Reset button restores default size and scale.
  - [x] **Resizable**: Enabled CSS `resize: both` for browser-native resize functionality.
    - [x] **Constraints**: Set min/max width and height constraints.
    - [x] **Scrolling**: Ensured content scrolls properly when resized.
  - [x] **Position Reset**: On close, popup position resets to default (top-right).
- [x] **Documentation**
  - [x] **Interface Document**: Updated with v0.9.19 drag/zoom interface specifications.
  - [x] **README**: Added v0.9.19 changelog entries in both English and Chinese.
  - [x] **Bilingual Comments**: Code comments in both languages for all new functionality.
  - [x] **CSS**: Documented new styles for draggable, zoomable, and resizable popup.

---

# 2025-12-24 v0.9.18 - Node Highlighting System Refactor

**Goal**: Reconstruct node highlighting logic with modular architecture for better maintainability and robustness.

- [x] **Modular Architecture**
  - [x] **NodeHighlightManager Class**: Created dedicated module (`nodeHighlight.js`) with complete state management.
  - [x] **API Design**: Implemented clean public API with `highlight()`, `unhighlight()`, `getState()`, and helper methods.
  - [x] **Integration**: Fully integrated into app.js replacing old highlighting functions.

- [x] **Unified Interaction Model**
  - [x] **PC Support**: Hover-based highlighting without freezing simulation.
  - [x] **Mobile Support**: Click-based highlighting with simulation freeze for stable inspection.
  - [x] **State Consistency**: Proper tracking of frozen vs temporary highlight states.

- [x] **Rendering Enhancements**
  - [x] **SVG Mode**: Directional edge coloring (Blue=#4488ff outgoing, Red=#ff6b6b incoming) with matching arrow markers.
  - [x] **Canvas Mode**: Updated to use highlightManager state for consistent visual behavior.
  - [x] **Dimming Effect**: Unconnected nodes dim to 0.05 opacity during highlight for clearer focus.

- [x] **Focus Mode Integration**
  - [x] **State Awareness**: highlightManager respects focus mode and doesn't interfere.
  - [x] **Coordination**: Focus mode entry/exit properly updates highlightManager state.

- [x] **Documentation**
  - [x] **Bilingual Comments**: Comprehensive Chinese/English comments throughout code.
  - [x] **Interface Document**: Updated with complete NodeHighlightManager API reference.
  - [x] **README**: Added v0.9.18 changelog entry in both languages.
  - [x] **Integration Guide**: Created detailed integration instructions.

---

### 2025-12-17 v0.1.0 - Foundation & Data Structures

**Goal**: Establish the standalone project environment and core data structures for a Directed Graph, independent of specific note-taking app APIs initially.

- [x] **Project Initialization**
  - [x] Initialize a new TypeScript/Node.js project in `NoteConnection`.
  - [x] Configure ESLint, Prettier, and Jest for testing.

- [x] **Graph Core Implementation**
  - [x] Implement `Node` and `Edge` interfaces supporting metadata (e.g., `rank`, `clusterId`).
  - [x] Implement a `Graph` class with methods: `addNode`, `addEdge`, `getNeighbors`, `getIncomingEdges`, `getOutgoingEdges`.

### 2026-01-15 v0.2.0 - Data Ingestion & Directional Parsing

**Goal**: Ingest data from Markdown files, specifically parsing frontmatter for directional dependencies.

- [x] **Markdown Parser Service**
  - [x] Implement a file system reader to scan directories recursively.
  - [x] Create a regex or AST-based parser to extract YAML frontmatter.

- [x] **Dependency Extraction**
  - [x] Define the schema: `prerequisites: [[Note A]]`, `next: [[Note B]]`.
  - [x] Logic to convert these metadata fields into directed edges in the `Graph` object.

### 2026-02-01 v0.3.0 - Algorithmic Core (DAG Logic)

**Goal**: Ensure the graph is a valid DAG and calculate hierarchical layout positions.

- [x] **Cycle Detection & Resolution**
  - [x] Implement DFS-based cycle detection.
  - [x] Strategy: Report cycles to the user (Console Warning).

- [x] **Topological Sorting & Ranking**
  - [x] Implement algorithms to assign a `rank` (0, 1, 2...) to every node.
  - [x] Ensure nodes with no dependencies are Rank 0.
  - [x] Integrated Kahn's Algorithm variant for Longest Path layering.

### 2026-03-01 v0.4.0 - Visualization Engine

**Goal**: Render the processed graph in a web view using a layered layout engine (Sugiyama-style).

- [x] **Layout Engine Integration**
  - [x] Implement "Layout Mode" switch in UI (Force vs DAG).
  - [x] Map `rank` to Y-coordinates in the visualization.

- [x] **Canvas/SVG Rendering**
  - [x] Optimize rendering for hierarchical structures.
  - [x] Draw curved bezier lines for dependencies to indicate flow direction clearly.

- [x] **Focus Mode (v0.6.2)**
  - [x] **Interactive Focus**: Click node to center and isolate context.
  - [x] **Hierarchical Layout**: Auto-arrange Superiors (Out-degree) and Subordinates (In-degree) in layers.
  - [x] **Intra-layer Sorting**: Sort neighbors by importance (Degree Ratio).
  - [x] **Context Filtering**: Show only direct neighbors and high-correlation nodes.
  - [x] **Layout Optimization**:
    - [x] Relative Height Positioning based on criteria (Score).
    - [x] Staggered Label Placement to prevent overlap.
    - [x] Fix: Prevents node accumulation when switching context within Focus Mode.

### 2026-04-01 v0.5.0 - Scalability (Clustering)

**Goal**: Handle 10,000+ nodes by grouping them into high-level clusters based on File Structure or Semantic Tags.

- [x] **Clustering Logic**
  - [x] Implement **Folder-based Clustering**: Parse directory structure (e.g., `Physics/Mechanics` -> Cluster `Mechanics`).
  - [x] Add Configuration Strategy: Switch between `Label Propagation` (current) and `Folder Path` for `clusterId` assignment.

- [x] **Semantic Zoom / Drill-down**
  - [x] Render "Super Nodes" (Clusters) at low zoom levels (Implemented as "Cluster View" toggle).
  - [x] Expand to show detailed dependency graphs when a cluster is clicked (Drill-down via Filter).

### 2026-05-01 v0.6.0 - Hybrid Inference Strategy (AI & Stats)

**Goal**: Combine statistical and vectorized methods to infer dependencies and associations where explicit metadata is missing.

- [x] **Vector-based Association (Similarity)**
  - [x] Implement embedding generation (using local TF-IDF VectorSpace).
  - [x] Use Cosine Similarity to determine the strength of **association** (undirected relationship) between concepts.

- [x] **Statistical Dependency Inference**
  - [x] Calculate **Co-occurrence Frequency** and **Conditional Probability** ($P(B|A)$) across the note corpus.
  - [x] Hypothesis: If A frequently appears before B or in the context of defining B, A might be a dependency.

- [x] **Hybrid Judgment Engine (v0.6.5)**
  - [x] Combine Vector Similarity (for relevance) + Statistical Probability (for direction).
  - [x] Rule: If `Similarity(A, B) > Threshold` AND `P(B|A) >> P(A|B)`, suggest edge `A -> B`.

- [ ] **AI Inference Service (LLM Verification)**
  - Use LLMs to verify high-confidence candidates from the hybrid engine.
  - Task: "Given statistical evidence, confirm if A is a prerequisite for B."

### 2025-12-22 v0.8.5 - Dynamic Data Source & Server

**Goal**: Support dynamic selection of knowledge base folders and independent server deployment.

- [x] **Dynamic Path Selection**
  - [x] Backend: Support variable input paths under `Knowledge_Base`.
  - [x] Server: Implement `http` server for API (`/api/folders`, `/api/build`) and static serving.
  - [x] Frontend: Add UI to list and select knowledge base folders.

# 2025-12-24 v0.9.17 - SVG Visual Completeness

**Goal**: Complete the visual feedback loop for SVG mode interactions.

- [x] **SVG Renderer**
  - [x] **Colored Markers**: Implemented dynamic marker switching (Red/Blue arrows) to match the edge color during highlight.
  - [x] **Visual Consistency**: Ensured arrows revert to gray when highlighting is cleared.

# 2025-12-24 v0.9.16 - Interaction Completeness

**Goal**: Ensure complete visualization of node relationships during inspection.

- [x] **Interaction Logic**
  - [x] **Always-On Context**: Clicking a node now forces the display of _all_ In-degree and Out-degree relationships, overriding any active "Incoming Only" or "Outgoing Only" filters to ensure complete context is visible.
- [x] **Canvas Renderer**
  - [x] **Visual Parity**: Implemented bold line rendering (2.5px width) for highlighted edges in the Canvas engine to match SVG styling.

### 2025-12-23 v0.8.6 - Performance Optimization (Parallel Processing)

**Goal**: Optimize graph construction for large datasets (>10,000 nodes) to reduce build time.

- [x] **Parallel Graph Building**
  - [x] **Worker Threads**: Offload intensive keyword matching to multiple CPU cores.
  - [x] **Async I/O**: Refactor `FileLoader` to use asynchronous batch processing to prevent `EMFILE` errors.
  - [x] **Robustness**: Implement fallback to sequential processing if workers fail.

### 2025-12-23 v0.8.7 - Scalability & UX Polish

**Goal**: Address rendering bottlenecks and improve layout control for large graphs.

- [x] **High-Capacity Processing**
  - [x] **Worker Scaling**: Increased thread limit to 12.
- [x] **Canvas Rendering**
  - [x] **Dual Engine**: implemented Canvas renderer for high-performance drawing of 10k+ nodes.
- [x] **Focus Mode UX**
  - [x] **Spacing Control**: Added UI slider to adjust node layer spacing.

### 2025-12-23 v0.8.8 - Scalability Defaults & Advanced Layout

**Goal**: Optimize default view for massive graphs and refine Focus Mode layout.

- [x] **Scalability Defaults**
  - [x] **Clutter Reduction**: Edges hidden by default; Orphans hidden by default.
  - [x] **On-Demand Context**: Relationships revealed on Hover or Focus.
- [x] **Focus Mode Enhancements**
  - [x] **Horizontal Spacing**: Added control for horizontal node separation to prevent overlap.

### 2025-12-23 v0.8.9 - Stability Improvements

**Goal**: Enhance observation stability.

- [x] **Interaction Stability**
  - [x] **Freeze**: Prevent node drift when selecting or dragging in Focus Mode.

### 2025-12-23 v0.9.0 - Precise Control & Stability

**Goal**: Provide tools for manual layout control and stable inspection.

- [x] **Hover Logic**
  - [x] **Auto-Freeze**: Lock node position on hover to facilitate inspection.
- [x] **Simulation UX**
  - [x] **Controls**: Add Speed slider and Freeze Layout toggle.
  - [x] **Manual Placement**: Allow manual node positioning when layout is frozen without auto-revert.

### 2025-12-23 v0.9.1 - Mobile Transformation

**Goal**: Transform the current web project into an Android APK application.

- [x] **Capacitor Integration**
  - [x] **Initialization**: Configured `capacitor.config.ts`.
  - [x] **Platform Support**: Added Android platform via `@capacitor/android`.
  - [x] **Asset Management**: Implemented `copy-assets` script and `npx cap sync`.
  - [x] **Build Pipeline**: Verified Gradle build configuration (`assembleDebug`).

### 2025-12-23 v0.9.2 - Mobile UI Optimization

**Goal**: Optimize UI/UX for small touch screens.

- [x] **Responsive Controls**
  - [x] **Collapsible Menu**: Main controls collapse to a button on mobile to save screen space.
  - [x] **Focus Mode UI**: Relocated "Exit Focus" button to bottom-center for accessibility.
  - [x] **Settings Consolidation**: Moved Language Selector into Settings Modal to declutter the interface.
- [x] **Touch Interactions**
  - [x] **Pinch-to-Zoom**: Added multi-touch support in Reading Window for text scaling.
  - [x] **Touch Targets**: Enlarged buttons and inputs for touch accuracy.

### 2025-12-23 v0.9.3 - Mobile Interaction Iteration

**Goal**: Refine interaction logic for mobile usability.

- [x] **Interaction Logic Update**
  - [x] **Single Click**: Triggers node highlight and tooltip (In/Out Degree display).
  - [x] **Double Click**: Triggers Focus Mode entry.
  - [x] **Desktop Compatibility**: Preserved `mouseover` for desktop hover while unifying click logic.

### 2025-12-23 v0.9.4 - Mermaid Image Optimization

**Goal**: Enhance reading experience for diagrams on mobile devices.

- [x] **Mermaid Zoom Mode**
  - [x] **Interaction**: Clicking a Mermaid diagram opens a full-screen overlay.
  - [x] **Gestures**: Implemented Pan (drag) and Zoom (pinch/wheel) logic within the overlay.
  - [x] **UX**: Added a prominent Exit button to close the zoom mode.

### 2025-12-24 v0.9.5 - Refined Mobile Experience & Focus Semantics

**Goal**: Polish interaction details and visual clarity for mobile and complex graphs.

- [x] **Focus Mode Enhancements**
  - [x] **Centering**: Viewport automatically centers on the focused node's original position.
  - [x] **Semantics**: Added clear area labels ("Helping to understand", "Further exploration").
  - [x] **Layout**: Implemented "Hierarchical (Left-Right)" layout option.
- [x] **Analysis Panel**
  - [x] **Mobile**: Panel is now scrollable and adapted for touch screens.
  - [x] **Interaction**: Clicking rows highlights the node and its connections in the graph.
- [x] **Visual Polish**
  - [x] **Mermaid**: Enhanced text visibility (shadow/outline) for light-colored diagrams.
  - [x] **Lines**: Ensured edges are hidden by default and only visible on interaction.

### 2025-12-24 v0.9.6 - Analysis & Visuals Polish

**Goal**: Further refine Analysis Panel mobile usability and fix visual inconsistencies.

- [x] **Mermaid Zoom Styling**
  - [x] **Fix**: Ensured Mermaid text shadow/grayscale persists in Full-screen Zoom mode.
- [x] **Degree Analysis Mobile**
  - [x] **Full Screen**: Added toggle to switch panel between half-height and full-screen.
  - [x] **Zoom**: Implemented pinch-to-zoom for the panel content.
  - [x] **Interaction**: Verified click-to-highlight logic works across views.
- [x] **Graph Interaction**
  - [x] **Robustness**: Added background click handler to clear highlights.

### 2025-12-24 v0.9.7 - Focus Mode Interaction Fix

**Goal**: Fix usability bugs in Focus Mode.

- [x] **Layout Switching**
  - [x] **Fix**: Switching between "Horizontal" and "Vertical" layouts now immediately refreshes the graph without requiring slider adjustment.

### 2025-12-24 v0.9.8 - Analysis Interaction Refinement

**Goal**: Ensure seamless interaction between Analysis Panel and Graph.

- [x] **Graph Sync**
  - [x] **Tooltip**: Clicking a node in the Analysis Panel now displays the tooltip (stats) on the graph at the node's position.
- [x] **Mobile UX**
  - [x] **Scrolling**: Fixed scroll behavior in Analysis Panel to prevent conflicts.

### 2025-12-24 v0.9.9 - Mobile Analysis Panel Polish

**Goal**: Enhance "Degree Analysis" page for mobile usability with gesture controls.

- [x] **Mobile Adaptation**
  - [x] **Slide Gesture**: Implemented "slide up and down" via touch drag on panel header.
  - [x] **Full Screen**: Supported toggling between floating window and full-screen page, with auto-snap on drag.
  - [x] **Zoom**: Verified two-finger pinch-to-zoom support for the interface.
- [x] **Interaction Verification**
  - [x] **Node Click**: Verified that clicking a node in the panel displays in-degree and out-degree relationships on the graph.

### 2025-12-24 v0.9.10 - Interaction Refinement (Click-to-Freeze)

**Goal**: Improve graph inspection stability by freezing the simulation on node click.

- [x] **Click Interaction**
  - [x] **Freeze on Click**: Clicking a node now immediately stops the force simulation (freezes all nodes) to prevent movement during inspection.
  - [x] **Resume on Cancel**: Clicking the background (blank area) unhighlights the node and resumes the simulation (unless manually frozen).
  - [x] **Visualization**: Ensured in-degree and out-degree lines are displayed clearly when frozen.

### 2025-12-24 v0.9.11 - Node Statistics & Localization

**Goal**: Enhance detailed inspection of nodes and complete internationalization.

- [x] **Focus Mode Localization**
  - [x] **Multi-language**: Implemented `t()` calls for semantic labels ("Helping to understand" / "Further exploration").
- [x] **Node Statistics Panel**
  - [x] **Interaction**: Clicking a node opens a dedicated panel showing relationships.
  - [x] **Visuals**: In-degree lines are Red, Out-degree lines are Blue (#4488ff).
  - [x] **Content**: Panel lists all incoming and outgoing neighbors with navigation support.

### 2025-12-24 v0.9.12 - Independent Statistics Popup

**Goal**: Separate node inspection from global analysis for better UX.

- [x] **Floating Statistics Window**
  - [x] **Interaction**: Clicking a node opens a floating popup showing In/Out degrees.
  - [x] **Visuals**: Distinct Red (In) and Blue (Out) indicators.
  - [x] **Independence**: Does not interfere with the main Degree Analysis panel.

### 2025-12-24 v0.9.13 - Focus Mode Isolation

**Goal**: Ensure specific interaction effects do not bleed into Focus Mode.

- [x] **Interaction Refinement**
  - [x] **Constraint**: Verified that clicking a node while in Focus Mode does _not_ trigger the floating statistics popup or change the highlight style, preserving the specific Focus Mode context.

### 2025-12-24 v0.9.14 - Visual & Data Fixes

**Goal**: Fix visualization of edge directions and data duplication.

- [x] **Edge Highlighting**
  - [x] **Canvas Support**: Implemented Red (In) and Blue (Out) edge coloring in the Canvas renderer (`renderCanvas`), previously generic gray.
- [x] **Data Integrity**
  - [x] **Deduplication**: Used `Set` to prevent duplicate node entries in the Statistics Popup neighbor lists.

### 2025-12-24 v0.9.15 - Enhanced Isolation

**Goal**: Optimize visual focus by effectively hiding unrelated context during inspection.

- [x] **Visual Optimization**
  - [x] **Deep Dimming**: Reduced opacity of unrelated nodes from 0.1 to 0.05 to better satisfy the "temporarily hidden" requirement while maintaining minimal context.
  - [x] **Edge Emphasis**: Increased highlighted edge width to 2.5px for clearer Red/Blue distinction.

### 2026-06-01 v1.0.0 - Production Release

**Goal**: Complete integration with Joplin/Obsidian plugins and polish UX.

- [x] **Plugin Wrapper**
  - Wrap the `NoteConnection` core logic into a Joplin Plugin and an Obsidian Plugin. (API Ready in v0.9.53)

- [x] **User Settings & Documentation (v0.7.0)**
  - [x] **Settings Manager**: Centralized management of application state (Physics, Visuals) with `localStorage` persistence.
  - [x] **Configuration UI**: Settings Modal for tuning Graph Physics (Gravity, Repulsion) and Visual preferences.
  - [x] **Reading Window (v0.8.0)**
    - [x] **Trigger**: Click focused node to open.
    - [x] **Content**: Renders Markdown, KaTeX (Math), Mermaid (Diagrams).
    - [x] **Interaction**: Zoom text and Resize images (Unlocked mode).
    - [x] **Config**: Window/Fullscreen toggle.
  - [x] **Finalize Documentation**: Complete User Manual and Developer Guide.
  - [x] **Final Polish & Demo Packaging**: Ensure zero-config startup (`npm start`) works seamlessly for promotion.
  - [x] **Release**: Package for v1.0.0.

---


## 中文文档

### 目标
继续推进当前有效的高优先级收口，执行口径保持“先实现、再验证”：
- 降低 Capacitor 运行时在**内容读取**上的对等风险（不虚假宣称构建对等）。
- 将真机验收证据采集流程工程化。
- 对所有受 Git 跟踪的 Markdown 文档执行结构化语言归档，输出到 `docs/en` 与 `docs/zh`。

### 本轮完成
- [x] **Capacitor 内容路径对等加固**：
  - [x] `src/frontend/source_manager.js`：Capacitor 的 `supports_content_api` 由插件可用性动态决策（`supportsCapacitorContentApi`），不再固定为 `false`。
  - [x] `src/frontend/storage_provider.js`：新增 Capacitor 内容路径映射与安全函数：
    - [x] `extractRelativePathFromKbMarker(rawFilePath)`
    - [x] `resolveCapacitorContentCandidatePath(rawFilePath)`
    - [x] 对无法映射且缺少 `Knowledge_Base` 标记的桌面绝对路径进行严格拒绝
  - [x] `RuntimeStorageProvider.readContent()` 在原生 Capacitor 且支持内容 API 时改为走 Capacitor 文件系统读取链路。
- [x] **真机证据采集自动化**：
  - [x] 新增 `scripts/capture-capacitor-device-evidence.js`。
  - [x] 新增 npm 命令 `capture:capacitor:evidence`。
  - [x] 证据包输出规范已落地：
    - [x] 脱敏设备信息
    - [x] 截图（`device-screenshot.png`）
    - [x] logcat 尾部日志（`logcat-tail.txt`）
    - [x] 双语验收报告（`acceptance_evidence.md`）
- [x] **Markdown 语言归档流程**：
  - [x] 新增 `scripts/archive-md-by-language.js`。
  - [x] 已将所有受 Git 跟踪的 Markdown 文档归档至：
    - [x] `docs/en/**`（英文文档集）
    - [x] `docs/zh/**`（中文文档集）
  - [x] 生成归档追踪报告：`docs/language-archive-report.json`。
  - [x] 当前归档结果：扫描 `25` 个受跟踪 Markdown，输出 `24` 份英文文档与 `17` 份中文文档。
- [x] **契约/测试同步**：
  - [x] 更新 `src/capacitor.runtime.contract.test.ts`，适配 Capacitor 内容能力动态决策。
  - [x] 更新 `src/storage.provider.contract.test.ts`，覆盖内容路径映射断言。
  - [x] 新增 `src/storage.provider.capacitor.content.contract.test.ts`。
  - [x] 更新 `src/mobile.pipeline.test.ts`，校验证据采集命令存在。
  - [x] 更新 `package.json` 的迁移测试清单，纳入新的 Capacitor 内容契约测试。

### 当前高优先级状态
- [x] 已交付移动端**内容读取**能力的对等增强路径（基于文件系统、含安全映射）。
- [ ] 尚未实现与桌面 sidecar 等价的移动端**构建 + 内容**完全对等（Capacitor 构建对等仍未收口）。
- [ ] 真机验收清单仍需设备侧人工验证项闭环（受当前无在线设备约束）。

### 验证门禁（已执行）
- [x] `npx jest src/capacitor.runtime.contract.test.ts src/storage.provider.contract.test.ts src/storage.provider.capacitor.content.contract.test.ts src/mobile.pipeline.test.ts src/source_manager.loadflow.test.ts src/runtime.capabilities.test.ts --runInBand`
- [x] `npm run test:migration`（`18` 套件通过）
- [x] `npm run build`
- [x] `npm run test:tauri`
- [x] `./src-tauri/bin/godot-x86_64-pc-windows-msvc.exe --headless --path ./path_mode --quit`
- [x] `node scripts/archive-md-by-language.js`
- [ ] `npm run verify:capacitor:device`（当前环境阻塞：无在线 Android 设备）
- [ ] `npm run capture:capacitor:evidence`（当前环境阻塞：无在线 Android 设备）

---


### 目标
基于 `docs/fixrisk_TODO.md` 执行下一阶段可落地加固，重点收敛移动端文件系统可行性、Android 权限基线与 CI 可重复性，并给出可验证证据。

### 本轮完成
- [x] **Capacitor 文件系统依赖基线**：
  - [x] 在 `package.json` 中补齐 `@capacitor/filesystem` 运行时依赖。
- [x] **原生 Capacitor 存储适配器加固**（`src/frontend/storage_provider.js`）：
  - [x] 新增路径归一化与越权段拦截（拒绝 `.` / `..` 非安全片段）。
  - [x] 新增权限感知文件系统门禁（`checkPermissions` / `requestPermissions`）并提供确定性错误提示。
  - [x] 保持桌面 sidecar 与 Tauri command 回退链路行为不变。
- [x] **Android 清单权限基线**（`android/app/src/main/AndroidManifest.xml`）：
  - [x] 增加旧版外部存储兼容权限（`READ_EXTERNAL_STORAGE`、`WRITE_EXTERNAL_STORAGE`）。
  - [x] 增加 Android 13+ 媒体读取权限（`READ_MEDIA_IMAGES`、`READ_MEDIA_VIDEO`、`READ_MEDIA_AUDIO`）。
- [x] **契约测试覆盖增强**：
  - [x] 更新 `src/mobile.pipeline.test.ts`，强制校验 Capacitor 文件系统依赖与 Android 权限声明。
  - [x] 更新 `src/storage.provider.contract.test.ts`，强制校验存储适配器中的权限/路径加固钩子。
- [x] **CI 迁移测试稳定性**：
  - [x] 保持 `src/server.migration.test.ts` 对 CI 注入的 `NOTE_CONNECTION_AUTH_TOKEN` 环境值隔离，避免出现伪 `401` 连锁失败。

### 当前高优先级状态
- [x] 已完成 fixrisk 中移动文件系统基线缺口（依赖、清单、适配器）加固。
- [x] 已补齐迁移级回归护栏，防止静默回退。
- [ ] 尚未交付移动端与桌面端完全等价的 build/content 能力（当前仍维持“只读打包”策略边界）。
- [ ] 尚需补充真机验收证据（`verify:capacitor:device` + 设备侧执行清单）。

### 验证门禁（已执行）
- [x] `npx tsc --pretty false`
- [x] `npx jest src/storage.provider.contract.test.ts src/mobile.pipeline.test.ts src/source_manager.loadflow.test.ts src/runtime.capabilities.test.ts src/server.migration.test.ts --runInBand`
- [x] `npm run test:migration`
- [x] `npm run build`
- [x] `npm run test:tauri`
- [x] `./src-tauri/bin/godot-x86_64-pc-windows-msvc.exe --headless --path ./path_mode --quit`
- [x] `npm run build:sidecar`


### 目标
在不破坏现有桌面端与移动端运行时契约的前提下，执行 `docs/fixrisk_TODO.md` 中最高风险、可落地的改造项。

### 本轮已完成
- [x] `src/server.ts`：移除 `/api/content` 与生成资产（JS/JSON）响应路径中的同步文件读取。
- [x] `src/server.ts`：将纯内存 JSON 解析改为“有界流式读取 + 临时文件落盘”（`tmp/request-bodies`）以处理大请求体。
- [x] `src/server.ts`：统一请求体错误映射，显式返回：
  - [x] 过大请求体返回 `413`
  - [x] 非法 JSON 返回 `400`
  - [x] 不支持的内容类型返回 `415`
- [x] `src/server.ts`：`/api/build` 与 `/api/kb-path` 迁移到同一套加固后的 JSON 解析流程（移除重复的手动缓冲逻辑）。
- [x] `src/server.ts`：增强默认端口启动鲁棒性。当未显式配置端口且 `3000` 被占用时，服务端自动回退到 loopback 临时端口，避免 `EADDRINUSE` 崩溃。
- [x] `src/server.ts`：完成缓存与目标接口（`/api/check-cache`、`/api/restore-cache`、`/api/available-targets`）的异步化，移除剩余热路径同步文件系统调用。
- [x] 前端传输层收敛：`source_manager.js`、`reader.js` 与 `path_app.js` 统一依赖 `runtime_bridge.js` 作为唯一运行时传输适配器，不再各自维护硬编码 loopback 回退地址。
- [x] 打包链路现代化：
  - [x] 新增 `scripts/build-sidecar.js`，采用 Node 22 目标、Brotli 压缩、`--no-bytecode`。
  - [x] `build:sidecar` 升级为主机平台自适应的 Node 22 构建。
  - [x] 新增 `build:sidecar:all`，输出 Windows/Linux/macOS-arm64 且命名与 Tauri sidecar 规范一致。
  - [x] 更新 sidecar 校验脚本，支持主机模式与全目标模式。
  - [x] 更新 Godot sidecar 准备脚本，在非 Windows 平台跳过 Windows 专属复制逻辑。

### 剩余高优先级工作
- [x] 完成传输层现代化（将剩余桌面端原始 HTTP/WS 调用迁移到 Tauri 原生命令或 JSON-RPC 适配层）。（已在 `v1.5.16` 收口）
- [x] 实现跨运行时存储抽象（桌面 sidecar / Tauri commands / Capacitor 文件系统）。（已在 `v1.5.16` 收口）
- [x] 制定并落地 macOS/Linux 的 Godot sidecar 制品策略（当前 Windows 二进制链路最完整）。（已在 `v1.5.16` 收口）
- [x] 继续保持发布边界清晰：在能力对齐完成前，Capacitor 原生仍为只读打包模式。（已在 `v1.5.16` 收口）

### 本轮验证门禁
- [x] `npx tsc --pretty false`
- [x] `npx jest src/server.migration.test.ts src/source_manager.loadflow.test.ts src/pathbridge.handshake.contract.test.ts src/reader_renderer.test.ts --runInBand`
- [x] `npx jest src/runtime.transport.adapter.contract.test.ts src/source_manager.loadflow.test.ts src/runtime.capabilities.test.ts src/pathbridge.handshake.contract.test.ts --runInBand`
- [x] `npm run test:migration`
- [x] `npm run test:tauri`
- [x] `./src-tauri/bin/godot-x86_64-pc-windows-msvc.exe --headless --path ./path_mode --quit`
- [x] `npm run build:sidecar`
- [x] `npm run build:sidecar:all`（仅制品校验；跨平台实际运行验证依赖对应平台环境）

---

# 2026-03-07 v1.5.14 - 架构、安全与性能加固复核更新

## v1.5.13 之后的后续架构与安全加固

### 目标
根据当前代码基线刷新 v1.5.13 之后的加固待办，使文档准确反映哪些能力已经落地，哪些问题仍然阻碍生产级稳健性、大规模图谱性能以及真实的多平台交付。

### 自原始加固计划以来已完成的事项
- [x] 桌面端 HTTP 与 WebSocket 监听已收敛到仅绑定 `127.0.0.1`。
- [x] Tauri 已能够为 sidecar 与 bridge 动态分配端口，并将运行时元数据注入 Node sidecar、前端与 Godot 进程。
- [x] 受保护的 sidecar 路由与 bridge 标识握手已支持基于令牌的认证。
- [x] 桌面 sidecar 已使用严格的 CORS 白名单替代通配符暴露方式。
- [x] 已新增共享的前端 runtime bridge，在 Tauri 桌面链路中同步 sidecar 基础 URL、bridge URL 与认证头。
- [x] 原生 Capacitor 运行时已明确切换为“只读打包内容模式”，不再假设桌面 sidecar API 可用。
- [x] Node sidecar 在处理剪贴板 PNG 后会显式执行缓冲区清零。
- [x] Godot Reader Mermaid 渲染链路已收口为 PNG-only（`pngBase64` 必填）；历史 SVG 清洗逻辑仅保留为诊断辅助，不作为运行时回退。

### 仍需优先推进的工作

#### 阶段 1：桌面运行时加固收口
- [x] 将 HTTP 与 WebSocket 监听限制为仅绑定 `127.0.0.1`。
- [x] 由 Tauri 运行时动态分配端口与认证令牌。
- [x] 为受保护的 sidecar 路由应用严格的 CORS 白名单与令牌校验。
- [ ] 移除 `src/server.ts` 中 `/api/content` 与生成资源读取路径上的同步文件系统读取。
- [ ] 将大体积剪贴板与渲染负载的 JSON 全量缓冲解析改为流式或临时文件处理。

#### 阶段 2：传输层现代化
- [x] 已为 Tauri 桌面链路引入环境感知的 runtime bridge，用于 URL 与认证信息传递。
- [ ] 将剩余桌面 HTTP/WebSocket 请求路径迁移到 Tauri 原生 IPC 或正式的 JSON-RPC 传输层。
- [ ] 将所有前端传输回退路径统一收口到单一适配层，避免在缺少运行时元数据时仍依赖硬编码 loopback 默认值。

#### 阶段 3：存储与查询扩展性
- [ ] 引入 storage provider 抽象，以支持桌面 sidecar、Tauri command、Capacitor filesystem 以及未来的 SQLite/Wasm 运行时。
- [ ] 将单体 `graph_data.json` 从主运行时存储迁移为基于 SQLite 的局部查询模型。
- [ ] 增加持久化前端缓存层（IndexedDB，经由 `localForage` 或 `Dexie`）以缩短冷启动时间。
- [ ] 评估 MessagePack 或等价二进制传输方案，用于高密度图谱负载传输。

#### 阶段 4：打包与多平台交付
- [ ] 将当前仅支持 Windows 的 `build:sidecar` 目标（`node18-win-x64`）升级为 Node 22 多目标打包。
- [ ] 增加压缩型 sidecar 构建流程（`--compress Brotli`、`--no-bytecode`），并验证打包后的运行时资源完整性。
- [ ] 为 macOS 与 Linux 增加 packaged sidecar 验证，而不仅限于 Windows 桌面。
- [ ] 完成 iOS 文件系统访问相关的 Privacy Manifest 声明工作。
- [ ] 持续明确移动端发布策略：当前 Capacitor 交付形态是“打包只读内容”，并非桌面等价的构建/sidecar 功能对等。

### 验证快照（复核时间：2026-03-07）
- [x] `npx tsc --pretty false`
- [x] `npx jest src/reader_renderer.test.ts src/source_manager.loadflow.test.ts src/pathbridge.handshake.contract.test.ts src/server.migration.test.ts --runInBand`
- [x] `cargo test --manifest-path src-tauri/Cargo.toml`
- [x] Windows PowerShell 下执行 `./src-tauri/bin/godot-x86_64-pc-windows-msvc.exe --headless --path ./path_mode --quit`

### 发布结论
- [ ] 在完成存储抽象与传输层迁移之前，不应宣称“全平台功能完全对等”。
- [ ] 在原生内容读取与图谱加载能力真正补齐之前，应继续将 Capacitor 原生交付视为边界清晰的只读运行时。

---

---

# 未来架构与安全加固计划 (v1.5.13 之后)

### 目标
执行《架构、安全与性能分析报告》中规划的架构、安全与性能提升方案，将项目提升至生产级的高鲁棒性状态，特别是在支撑海量图谱和多端一致性方面。

### 阶段一：建立“零信任”安全沙盒（高优）
- [ ] **强制本地回环绑定**：在 `server.ts` 中，将 HTTP 与 WebSocket 的监听严格限制在 `127.0.0.1`（移除 `0.0.0.0`）。
- [ ] **动态端口与 Token 握手**：
  - [ ] Rust/Tauri 端分配随机端口并生成 `AUTH_TOKEN`。
  - [ ] 将 Port/Token 注入 Node.js Sidecar 和 Frontend WebView。
- [ ] **严格 CORS 与鉴权拦截器**：
  - [ ] 移除 `Access-Control-Allow-Origin: *`，替换为严格白名单 (`tauri://localhost`, `http://localhost`)。
  - [ ] 在所有 API Header 和 WebSocket 握手中校验 Token。

### 阶段二：传输层现代化（中期基建）
- [ ] **IPC 通信重构**：将前端的 `fetch` 调用抽象为感知环境的适配器（Tauri IPC、Capacitor Native、HTTP 回退）。
- [ ] **Stdio JSON-RPC (桌面端)**：废弃 HTTP server，在 Tauri Rust 与 Node Sidecar 之间使用 `stdin/stdout` 进行 JSON-RPC 通信。

### 阶段三：数据存储结构化（核心性能改造）
- [ ] **轻量级 SQLite 后端**：使用本地 SQLite DB (如 `better-sqlite3`) 替代 `graph_data.json` 的生成，以支持图谱局部查询。
- [ ] **前端 IndexedDB 缓存层**：在 `localForage` 或 `Dexie.js` 中缓存图谱结构，实现秒级启动。
- [ ] **二进制协议传输**：将高密度数组的传输格式从 JSON 迁移至 `MessagePack`，消除 V8 引擎解析瓶颈。

### 阶段四：碎片化资产重构（移动端/Web）
- [ ] **构建时碎片化 (Chunking)**：修改 `build_apk.bat`/`npm run build`，将单体图谱切分为 `topology.msgpack`、`metadata.db` 以及独立的 content hash 文件。
- [ ] **Capacitor 原生文件读取**：通过 `@capacitor/filesystem` 实现按需懒加载，而不是将整个 JS payload 一次性塞入 Android WebView。

---

# 2026-03-04 v1.5.13 - Capacitor Physical-Device Acceptance Runbook Closure

### 目标

将 `v1.5.9` 最后未闭环项（Capacitor 真机验收证据）转化为可执行、可复现的验收流程。

### 已交付

- [x] 新增真机验收探测脚本：
  - [x] `scripts/verify-capacitor-device-acceptance.js`
  - [x] 校验项：
    - [x] APK 是否存在（`android/app/build/outputs/apk/debug/app-debug.apk`）
    - [x] `adb` 是否可用
    - [x] 是否至少有一台在线 Android 设备
- [x] 新增 npm 命令：
  - [x] 已提供前置探测命令：`npm run verify:capacitor:device`
- [x] 重新验证当前 APK 构建链路：
  - [x] `npm run mobile:build:capacitor` -> 2026-03-04 实测通过

### 真机验收清单（发版签核）

- [ ] 设备连接闸门通过：
  - [ ] `npm run verify:capacitor:device`
- [ ] 真机启动行为验证通过。
- [ ] 真机数据源面板行为验证通过。
- [ ] 真机 Reader 行为验证通过。
- [ ] 真机 Path mode 进入/退出行为验证通过。
- [ ] 验收证据已归档：
  - [ ] 设备序列号（可脱敏）
  - [ ] 测试日期/时间
  - [ ] 截图或短视频
  - [ ] 观测结果说明（通过/失败 + 问题单号）

### 当前状态

- [x] 构建与环境侧验收前置条件已具备。
- [ ] 仍需补充真机执行证据，才能关闭 `v1.5.9` 中最后的发版签核项。

---

# 2026-03-04 v1.5.11 - Capacitor Runtime Boundary Closure (Option B Execution)

### 结论快照

- [x] 在 Option B（移动端只读策略）下，Capacitor 运行时边界加固已完成。
- [x] Source/Reader 在原生 Capacitor 中已不再假设桌面 sidecar API 可用。
- [x] 已新增 Capacitor 运行时边界回归契约，并接入迁移闸门。
- [ ] Capacitor 端“目录/构建/内容”与桌面完全对等仍属于当前策略外范围（本版本不做完全对等承诺）。

### 已交付实现

- [x] `src/frontend/source_manager.js`
  - [x] 新增原生 Capacitor 运行时识别（`window.Capacitor.getPlatform` / `isNativePlatform`）。
  - [x] 在 Capacitor 原生运行时显式下发能力画像：
    - [x] `supports_sidecar=false`
    - [x] `supports_build=false`
    - [x] `supports_content_api=false`
    - [x] `supports_kb_runtime_change=false`
  - [x] 新增只读模式下确定性的来源面板降级：
    - [x] 路径文案 -> `source.capacitor.bundlePath`
    - [x] 单一内置选项 -> `PACKAGED_GRAPH`
    - [x] 加载按钮禁用 + 防护提示（`source.error.capacitorReadOnly`）
- [x] `src/frontend/reader.js`
  - [x] 新增 Capacitor 原生检测兜底：当运行时能力对象尚未就绪时，仍强制执行只读内容策略。
- [x] i18n 更新：
  - [x] `src/frontend/locales/en.json`
  - [x] `src/frontend/locales/zh.json`
  - [x] 新增 `source.capacitor.packagedGraph`
  - [x] 新增 `source.capacitor.bundlePath`
  - [x] 新增 `source.error.capacitorReadOnly`
- [x] 新增 Capacitor 运行时边界契约测试：
  - [x] `src/capacitor.runtime.contract.test.ts`
  - [x] 已接入 `package.json` 的 `test:migration`

### 验证证据（2026-03-04 实测）

- [x] `npm run test:migration` -> 通过（`66` 项）
- [x] `npm run test:tauri` -> 通过（`18` 项）
- [x] `npm run mobile:build:capacitor` -> 通过
  - [x] APK 产物：`android/app/build/outputs/apk/debug/app-debug.apk`

### 既有未闭环项状态更新

- [x] `v1.5.9` 中 **Capacitor 运行时行为加固** 项已在代码与测试层闭环。
- [x] `v1.5.9` 中 **Capacitor 运行时边界集成测试覆盖** 已闭环（`src/capacitor.runtime.contract.test.ts`）。
- [ ] `v1.5.9` 中 **Capacitor APK 手工验收清单（真机）** 仍待补充实机执行证据。
- [ ] **仍维持 NO-GO**：当前不宣告“全平台能力完全对等”。

---

# 2026-03-03 v1.5.10 - Option A P0 Closure (Tauri Android Native Folder/Build/Content Flow)

### 结论快照

- [x] 方案 A 的 P0 已在 Tauri Android 运行时落地。
- [x] Android 端现已支持无 Node sidecar 的本地构图能力。
- [x] 桌面端与 Web 端行为保持不变。
- [ ] Capacitor 运行时能力对等仍是独立范围（构建后端尚未原生等价）。

### 已交付实现

- [x] 在 Rust 中新增原生运行时构建命令：
  - [x] `src-tauri/src/lib.rs` 中 `build_graph_runtime(request)`
  - [x] 从 `Knowledge_Base/<target>`（或 `ALL_FOLDERS`）扫描构图
  - [x] 将运行时产物写入 `runtime_data/`：
    - [x] `data.js`
    - [x] `graph_data.json`
    - [x] `data_<target>.js`
    - [x] `graph_data_<target>.json`
- [x] 更新 Android 运行时能力：
  - [x] `supports_sidecar=false`
  - [x] `supports_build=true`
  - [x] `supports_content_api=true`
- [x] 在 `src/frontend/source_manager.js` 完成构建链路分流：
  - [x] 有 sidecar 时仍优先走 `/api/build`
  - [x] 无 sidecar 的 Tauri 路径改为 `invoke('build_graph_runtime', { request })`

### 验证证据（2026-03-03 实测）

- [x] `npm run test:migration` -> 通过（`55` 项）
- [x] `npm run test:tauri` -> 通过（`16` 项）
- [x] `npm run verify:android:env` -> 通过（SDK + cmdline-tools + NDK 已识别）

### P0 状态更新

- [x] `方案 A：实现移动端目录/构建/内容能力原生等价链路`（Tauri Android 路径）已完成。
- [ ] Capacitor 独立运行时的构建/内容完全对等仍待后续收口。

---

> Superseded Note (2026-03-03 v1.5.10): The section below is historical context. Current Option A P0 status is recorded above.
> 覆盖说明（2026-03-03 v1.5.10）：下方内容为历史上下文，当前 Option A P0 状态以上方为准。

# 2026-03-03 v1.5.9 - Electron Removal Final Gate (Audit-Driven Action Plan)

### 结论快照

- [x] 桌面端 Electron -> Tauri 迁移已达到可下线技术状态。
- [x] Tauri 桌面构建与运行主链路已启用并通过测试验证。
- [x] Capacitor 与 Tauri Android 构建链路均已存在。
- [ ] 全平台运行时能力对等尚未完全收口。

### 范围澄清（基于审计）

- 桌面端：
  - [x] Electron IPC 等价能力已迁移到 sidecar HTTP + Tauri 命令。
  - [x] 活跃包管理与运行路径中已无 Electron 脚本/依赖。
- 移动端：
  - [x] Capacitor 运行时按产品策略为只读能力，在目录/构建/内容 API 上不等价于桌面 sidecar 运行时。
  - [x] Tauri Android 运行时为无 sidecar 但可构建/读内容（`supports_sidecar=false`, `supports_build=true`），Capacitor 仍为 `supports_build=false`。

### P0 - 宣告“迁移完全完成”前必须收口

- [x] **移动端能力边界产品化决策（必须二选一并固化）**
  - [x] 方案 A：实现移动端目录/构建/内容能力的原生等价链路（Tauri Android 原生运行时路径）。
  - [x] 方案 B：正式将 Capacitor 定义为缓存/阅读优先能力，并在 UI/文档中消除“对等”歧义。

- [x] **Capacitor 运行时行为加固**
  - [x] 显式识别 Capacitor 运行时，避免沿用桌面 sidecar 假设。
  - [x] 当 `/api/folders`、`/api/build`、`/api/content` 不可用时提供确定性的降级交互。
  - [x] 明确 Capacitor Reader 内容策略（只读内置图谱 + 不可用能力的显式提示）。

- [x] **移动端验收闸门**
  - [x] 增加 Capacitor 运行时边界行为的集成测试覆盖。
  - [x] 增加 Capacitor APK 手工验收清单：
    - [x] 启动行为
    - [x] 数据源面板行为
    - [x] Reader 行为
    - [x] Pathmode 进入/退出行为
  - [ ] 仍需补充真机执行证据以完成最终发版签核。
    - [x] 已提供前置探测命令：`npm run verify:capacitor:device`
    - [ ] 最新探测结果仍为无在线 Android 设备（2026-03-04）。

### P1 - 迁移治理与下线清理

- [x] **归档/移除残余 Electron 痕迹**
  - [x] 删除空目录 `src/electron` 或增加明确归档标记。
  - [x] 清理代码中仍含 “electron” 的误导性命名/注释（运行时已为 bridge 架构）。

- [x] **文档对齐**
  - [x] 对 `docs/tauri_tasks.md` 中已过期迁移待办添加历史标记。
  - [x] 保持有效文档为 Tauri-first，并清晰区分 desktop/Android/Capacitor 能力边界。

### P2 - 稳定性与发布护栏

- [x] 将以下发布闸门保持为必跑：
  - [x] `npm run test:migration`
  - [x] `npm run test:tauri`
- [x] 将 Android 环境闸门保持为必跑：
  - [x] `npm run verify:android:env`
- [x] 增加 CI 矩阵避免静默回归：
  - [x] 桌面迁移测试集
  - [x] Tauri Rust 测试集
  - [x] 移动端流水线契约测试集

### 当前 Go/No-Go 政策

- [x] **GO**：桌面端 Electron 下线。
- [x] **NO-GO 策略生效**：在 Capacitor 仍为只读策略期间，不宣告“全平台运行时能力完全对等”。

---

# 2026-03-03 v1.5.8 - PathBridge Handshake + Tauri Early-Socket Stability

### 本轮新增

- [x] 在 `path_mode/scripts/ws_client.gd` 移除 Godot 不兼容的 WebSocket 查询参数 URL：
  - [x] `ws://127.0.0.1:9876/?client=godot` -> `ws://127.0.0.1:9876`
  - [x] 连接后新增显式 `identify` 握手消息。
  - [x] 增加连接前消息队列与重连后冲刷，避免初始化配置消息丢失/警告。

- [x] 在 `src/core/PathBridge.ts` 增加显式客户端身份协议：
  - [x] 新增 `identify` 消息处理分支。
  - [x] 新增 `setClientTag` 与标签清洗逻辑。
  - [x] 保留 URL 查询参数识别作为浏览器旧路径兼容兜底。

- [x] 在 `src/frontend/path_app.js` 强化 Bridge 行为：
  - [x] 移除 query-tag URL，统一使用 `ws://localhost:9876`。
  - [x] 为 `frontend` 与 `frontend-early` 两类连接发送 `identify` 负载。
  - [x] 新增 Tauri 运行时双重判定（`window.__TAURI__` 或 `navigator.userAgent.includes('Tauri')`），避免在 Tauri 中误启动 `frontend-early` 连接。

- [x] 新增回归契约覆盖：
  - [x] 新增测试文件 `src/pathbridge.handshake.contract.test.ts`。
  - [x] 已纳入 `test:migration`。

### 验证结果

- [x] `npm run test:migration` -> 通过（`53` 项）。
- [x] `npm run test:tauri` -> 通过（`14` 项）。

### 范围安全性

- [x] 桌面端功能不变，仅提升 Bridge 握手与标签稳定性。
- [x] 浏览器模式保留 early bridge 支持。
- [x] Android Pathmode 流程不受影响。

---

# 2026-03-03 v1.5.7 - Android Native Pathmode Smoke Lifecycle Automation

### 本轮新增

- [x] 新增 Android 运行时烟雾生命周期脚本：
  - [x] `scripts/smoke-android-pathmode.js`
  - [x] 使用 `adb` + `dumpsys activity` 检查 `MainActivity -> PathmodeGodotActivity -> MainActivity`。
  - [x] 通过发送返回键（`KEYCODE_BACK`）验证 Activity 返回路径。
  - [x] 支持可选严格模式：
    - [x] `NOTE_CONNECTION_ANDROID_SMOKE_REQUIRE_DEVICE=1` 时，无设备将判定失败
    - [x] 默认模式下，无设备/模拟器时会安全跳过。

- [x] 新增 npm 命令入口：
  - [x] 在 `package.json` 中新增 `smoke:android:pathmode`。

- [x] 新增烟雾集成回归契约：
  - [x] `src/android.pathmode.smoke.contract.test.ts`。
  - [x] 更新 `src/mobile.pipeline.test.ts` 断言烟雾脚本注册。
  - [x] 更新 `test:migration` 用例列表，纳入该契约测试。

### 验证结果

- [x] `npm run test:migration` -> 通过（`50` 项）。
- [x] `npm run test:tauri` -> 通过（`14` 项）。
- [x] `npm run smoke:android:pathmode` -> 通过（无连接设备时按设计跳过）。

### 范围安全性

- [x] 不影响桌面端行为。
- [x] 不影响 Web 端行为。
- [x] Android 烟雾流程仅在显式执行命令时触发。

---

# 2026-03-03 v1.5.6 - Option A Android Native Pathmode (Godot Full-Screen) Execution

### 本轮已实现

- [x] **Android 方案 A 启动链路已落地**
  - [x] 在 `src-tauri/src/lib.rs` 新增 Android 原生 Pathmode 启动命令：`open_native_pathmode`。
  - [x] 新增运行时能力标记：`supports_native_pathmode`（Android=true，桌面/web=false）。
  - [x] 更新前端 Path Mode 入口（`src/frontend/app.js`）：
    - [x] Android 且能力开启时优先走原生启动
    - [x] 桌面/web 维持原有网页 Path Mode 容器流程不变

- [x] **Android 全屏 Godot Activity 桥接已落地**
  - [x] 新增可追踪 Android 模板文件：
    - [x] `src-tauri/mobile/android/PathmodeBridge.kt`
    - [x] `src-tauri/mobile/android/PathmodeGodotActivity.kt`
  - [x] 新增生成工程补丁流水线：
    - [x] `scripts/apply-tauri-android-pathmode.js`
    - [x] `scripts/run-tauri-android.js` 在 Android 命令前后自动补丁
  - [x] 增加 `path_mode` 资源同步到 `src-tauri/gen/android/app/src/main/assets/path_mode`

- [x] **Exit 返回行为已实现**
  - [x] Godot 内点击 `Exit` 会退出 Android Pathmode Activity 并返回主 Tauri 窗口（`path_mode/scripts/path_renderer.gd`）。

- [x] **Android 构建链路已加固**
  - [x] 在 Android runner 增加 Cargo 内存控制（`CARGO_BUILD_JOBS`、release 优化/代码生成参数）。
  - [x] 补丁脚本已处理：
    - [x] Godot Maven 依赖与 Manifest 合并规则
    - [x] 与 Godot Android 产物匹配所需的 Kotlin 插件版本对齐

### 验证结果

- [x] `npm run test:migration` -> 通过（`48` 项）。
- [x] `npm run test:tauri` -> 通过（`14` 项）。
- [x] `node scripts/run-tauri-android.js build` -> 通过。
  - [x] APK：`src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk`
  - [x] AAB：`src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab`

### 影响范围安全性

- [x] 桌面端行为不变。
- [x] Web 端行为不变。
- [x] Android 逻辑通过运行时能力门控与构建脚本门控隔离。

---

# 2026-03-03 v1.5.5 - Status Normalization Update (Proceeding)

### 本轮复验结果

- [x] 已重新执行迁移闸门测试：
  - [x] `npm run test:migration` -> 通过（`44` 项）。
  - [x] `npm run test:tauri` -> 通过（`14` 项）。
- [x] 已确认 `v1.5.3` 与 `v1.5.4` 收口项持续有效（P0 工程收口 + P1 运行时边界 UI）。
- [x] 已确认 sidecar 内容边界校验与加载/历史契约测试持续通过。

### 待办治理

- [x] 已将 `v1.5.2` 清单标记为历史/已被后续版本覆盖，避免执行口径歧义。
- [x] 保留历史清单正文用于追溯（不做破坏性删除）。

### 当前仍可执行的剩余范围

- [ ] 移动端最终对等策略仍为产品层待决项：
  - [ ] 方案 A：实现与桌面 sidecar 等价的 Android 原生构建/内容链路。
  - [x] 方案 B（当前执行策略）：维持 Android 能力门控的缓存/阅读运行时，并显式说明边界。

---

# 2026-03-03 v1.5.3 - Execution Progress Update (P0 Completed)

### 本轮执行已完成

- [x] **将 sidecar 内容 API 安全边界提升至 Rust 同等级**
  - [x] 在 `src/server.ts` 为 `/api/content` 增加 KB 根路径边界校验。
  - [x] 新增回归测试覆盖：
    - [x] 根目录内绝对路径可读取
    - [x] 旧式 `Knowledge_Base` 标记路径可读取
    - [x] 根目录外路径被拦截（`403`）

- [x] **锁定缓存提示/单次加载语义（契约覆盖）**
  - [x] 新增 source manager 加载流程契约测试：
    - [x] 重复事件绑定防护
    - [x] 加载进行中点击防重入
    - [x] 单一缓存提示分支契约
  - [x] 现有服务端 restore/build 去重测试持续通过。

- [x] **完成 Godot History 一致性契约**
  - [x] 在 `path_mode_ui.gd` 新增 `record_navigation_node(node_id)`。
  - [x] 在 `path_renderer.gd` 的 `render_path` 中接入中心切换历史记录。
  - [x] 新增历史记录钩子契约测试。

- [x] **最终 Go/No-Go 技术闸门（工程部分）**
  - [x] `npm run test:migration` -> 通过（`43` 项）。
  - [x] `npm run test:tauri` -> 通过（`14` 项）。

### 剩余产品决策（不阻塞桌面稳定性）

- [ ] 确认移动端最终对等能力范围：
  - [ ] 方案 A：实现 Android 原生等价构建运行时。
  - [x] 方案 B（当前执行策略）：移动端聚焦缓存/阅读能力，并显式声明能力边界。

---

# 2026-03-03 v1.5.2 - Electron Removal Final Gate (Post-Audit Action Plan)

> 覆盖说明（2026-03-03 v1.5.5）：本节作为历史计划上下文保留。P0/P1 收口证据已记录在上方 `v1.5.3` 与 `v1.5.4`。以下未勾选项默认不再作为当前执行阻塞，除非后续明确重开。

**审计结论快照**

- [x] 桌面端 Electron -> Tauri 迁移在功能层面已成功。
- [x] Capacitor 导出链路仍可用且可构建。
- [x] Tauri Android 导出链路可构建。
- [ ] 桌面与移动端的完整运行时对等尚未收口。

### P0 - 在宣告“迁移完全收口”前必须完成

- [x] **将 sidecar 内容 API 的安全边界提升到 Rust 同等级**
  - [x] 已在 `src/server.ts` 为 `/api/content` 增加 KB 根路径边界校验，对齐 `read_node_content`。
  - [x] 已新增回归测试覆盖：合法路径、越界路径、Windows/相对路径变体。

- [x] **在 Tauri 启动竞态下锁定缓存提示与单次加载语义**
  - [x] 已补齐集成层契约覆盖：
    - [x] “存在缓存 -> 只出现一次提示”
    - [x] “单次点击 -> 只执行一次 restore/build”
  - [x] 已验证与 sidecar 去重和前端 reload guard 的联动行为。
  - [x] 历史区块状态已按 `v1.5.3` 的实现结果对齐。

- [x] **完成 Godot History 一致性契约**
  - [x] 中心切换事件（双击/手动切换）已写入 History 时间线（通过 Godot 记录钩子接线）。
  - [x] 已具备历史记录钩子自动化契约断言。
  - [x] 历史区块状态已按 `v1.5.3` 的实现结果对齐。

### P1 - 移动端/导出能力边界澄清与加固

- [ ] **在文档与 UI 中明确 Android 运行时能力边界**
  - [ ] 明确当前 Android 运行时为 `supports_sidecar=false`、`supports_build=false`。
  - [ ] 提供 cache-only 模式下的用户可操作说明。

- [ ] **完成移动端构建能力策略决策并落地**
  - [ ] 方案 A：实现 Android 原生构建/内容链路，对齐桌面 sidecar 流程。
  - [ ] 方案 B：保持缓存/只读能力，并明确为产品约束。

### P2 - 文档治理（保留历史，不删除）

- [ ] 将历史 Electron 段落标记为归档上下文，降低执行层误读。
- [ ] 保持当前有效发布/运维文档为 Tauri-first 与双移动端路径一致。

### 最终 Go/No-Go 闸门（全范围）

- [ ] 新增对等测试后 `npm run test:migration` 通过。
- [ ] 新增安全与行为测试后 `npm run test:tauri` 通过。
- [ ] 手工验收通过：
  - [ ] 缓存提示仅出现一次
  - [ ] 加载动作仅执行一次
  - [ ] History 正确记录中心切换
- [ ] sidecar 内容路径边界安全验证通过。

---

# 2026-03-02 v1.5.1 - Android Runtime Parity Expansion (Targets + Content + Cache-Only UX)

**目标**：将原本依赖桌面 sidecar 的目标/内容能力，扩展为 Tauri Android 可用的运行时安全契约，同时保持桌面行为不回退。

### 本轮已完成

- [x] **目标发现能力对齐已落地**
  - [x] 新增 sidecar API `GET /api/available-targets`（目录 + 缓存目标合并）。
  - [x] 新增 Tauri 命令 `get_available_targets`（语义一致）。
  - [x] 前端源加载优先使用 available-target 接口，并保留安全回退。

- [x] **移动端可用内容读取路径已落地**
  - [x] 新增 Tauri 命令 `read_node_content(file_path)`。
  - [x] 内容读取增加 KB 根路径边界校验（禁止越界访问）。
  - [x] 增加旧桌面路径 `.../Knowledge_Base/...` 的重定位兼容。
  - [x] 阅读器在 sidecar 不可用时回退到 Rust 命令读取。

- [x] **`supports_build=false` 运行时的仅缓存 UX 加固**
  - [x] 移动端源列表仅显示可用缓存目标。
  - [x] `ALL_FOLDERS` 仅在存在活动缓存时显示。
  - [x] 无缓存候选时自动禁用加载按钮。

- [x] **回归覆盖与构建证据更新**
  - [x] 新增/更新迁移测试覆盖 available-target 与 runtime-content 契约。
  - [x] `npm run test:migration` 通过（`35` 项）。
  - [x] `npm run test:tauri` 通过（`14` 项）。
  - [x] `npm run tauri:android:build` 通过。
  - [x] `npm run tauri:android:build:universal` 通过。

### 当前范围剩余工作

- [ ] **Android 端应用内图谱构建链路对等**
  - [ ] 提供桌面 `/api/build` 的 Android 原生等价实现。
  - [ ] 定义基于 SAF/File API 的知识库导入与持久授权策略。

- [ ] **Path Mode/Godot 的 Android 路线收口**
  - [ ] 明确保持仅桌面可用并补齐 UX 提示，或
  - [ ] 设计并实现 Android 可用渲染/运行时替代路径。

---

# 2026-03-02 v1.5.0 - Tauri Android Build Unblock (Arm64 Deterministic Path)

**目标**：将 Tauri Android 从环境/配置阻塞状态推进到可复现的构建路径，同时保持 Capacitor 与 Tauri Android 双路径并存。

### 本轮已完成

- [x] **Android SDK 工具链检测与强校验**
  - [x] 已确认 Android SDK Command-line Tools（`cmdline-tools/latest`）可被检测。
  - [x] 已确认 NDK（`ndk;27.2.12479018`）可被前置脚本检测。
  - [x] 当前机器 `npm run verify:android:env` 已通过。

- [x] **将桌面专属 Rust 依赖与 Android 目标隔离**
  - [x] `src-tauri/Cargo.toml` 中将 `rfd` 改为仅桌面目标依赖。
  - [x] 在 `src-tauri/src/lib.rs` 增加 Android 安全的目录选择回退逻辑。

- [x] **Android 专属 Tauri 运行时配置**
  - [x] 新增 `src-tauri/tauri.android.conf.json`，在 Android 构建中清空 `bundle.externalBin`。
  - [x] 使用 `cfg(not(target_os = "android"))` 隔离桌面专属菜单 API 与桌面进程启动逻辑。
  - [x] Android 启动流程已明确跳过桌面 Node sidecar 与 Godot 启动。

- [x] **Tauri Android 包装脚本加固**
  - [x] 为 `dev/build` 默认采用 `aarch64` 目标，规避 Windows 主机上 armv7 LLVM OOM。
  - [x] 支持通过 `NOTE_CONNECTION_TAURI_ANDROID_TARGET` 覆盖目标。
  - [x] 通过 `cmd.exe /d /s /c` 修复 Windows `spawnSync npx.cmd EINVAL`。
  - [x] 在 `scripts/run-tauri-android.js` 增加 spawn error/signal 明确日志。

- [x] **回归覆盖同步更新**
  - [x] 更新 `src/mobile.pipeline.test.ts`，新增 arm64 默认与覆盖能力断言。
  - [x] 已验证 `npm run test:migration` 通过（`30` 项测试）。

- [x] **构建验证**
  - [x] 已验证 `node scripts/run-tauri-android.js build` 通过。
  - [x] 已验证 `npm run tauri:android:build` 通过。
  - [x] 已产出：
    - `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk`
    - `src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab`

### 迁移剩余项（P1.5 后续）

- [ ] **Android 端桌面专属能力对等**
  - [ ] 将依赖 Node sidecar 的 API（`/api/build`、`/api/content`、目录扫描/构建链路）替换为 Android 可运行方案。
  - [ ] 定义 Android 原生文件访问策略（SAF/File API）以完成知识库选择与加载。

- [ ] **Path Mode/Godot 的 Android 路线决策**
  - [ ] 维持 Godot Bridge 仅桌面可用（当前行为），或提供 Android 兼容渲染路径。
  - [ ] 在文档中明确 Android 端能力边界与 UX 预期。

- [x] **可选多 ABI 策略**
  - [x] 保持 `aarch64` 作为默认稳定目标。
  - [x] 仅在主机内存/工具链满足时提供可选 universal ABI 构建路径。

---

# 2026-03-01 v1.4.9 - Runtime Verification Update (Desktop + Mobile)

**目标**：在 `v1.4.8` 基础上继续实跑验证，并将 Tauri Android 的不确定性收敛为可执行的前置条件检查。

### 本轮已完成

- [x] **桌面打包再次实测通过**
  - [x] 在设置 `NOTE_CONNECTION_GODOT_EXE` 后执行 `npm run tauri:build:mini`。
  - [x] sidecar 二进制校验通过（`server` + `godot` 非空）。
  - [x] MSI + NSIS 安装包成功生成。

- [x] **Capacitor Android 流水线端到端执行**
  - [x] 修复 `build_apk.bat` 中 `if (...)` 代码块内未转义括号导致的解析报错。
  - [x] 增加非交互支持（`NOTE_CONNECTION_NO_PAUSE` / `CI=true`）。
  - [x] 已完成 `build_apk.bat` 全流程并产出 debug APK。

- [x] **Tauri Android 前置检查加固**
  - [x] 新增 `scripts/verify-tauri-android-prereqs.js`。
  - [x] 新增 `npm run verify:android:env`。
  - [x] 已接入以下命令前置：
  - [x] `tauri:android:init`
  - [x] `tauri:android:dev`
  - [x] `tauri:android:build`
  - [x] 效果：当缺失 `cmdline-tools/latest/bin/sdkmanager` 时，返回明确错误而非模糊 Tauri 报错。

- [x] **回归测试覆盖同步更新**
  - [x] 扩展 `src/mobile.pipeline.test.ts`，校验：
  - [x] Android 前置检查脚本是否接入 npm 命令。
  - [x] `build_apk.bat` 自动化标志是否保留。
  - [x] `npm run test:migration` 继续保持通过。

- [x] **双路径聚合命令已验证**
  - [x] 已执行 `npm run mobile:build:both`。
  - [x] Capacitor 分支可完成并产出 APK。
  - [x] Tauri Android 分支在前置检查处被明确拦截（在安装 cmdline-tools 前符合预期）。

### 剩余外部前置条件（环境项）

- [x] **安装 Tauri Android 所需的 Android SDK Command-line Tools**
  - [x] 必需路径：`<ANDROID_SDK_ROOT>/cmdline-tools/latest/bin/sdkmanager(.bat)`。
  - [x] 已通过以下命令验证：
  - [x] `npm run verify:android:env`
  - [x] `npm run tauri:android:build`

---

# 2026-03-01 v1.4.8 - Migration Closure & Dual Android Verification

**目标**：以可执行验证证据收口迁移清单，重点完成 `P1.5`（Capacitor + Tauri Android 双路径产出）的稳定性证明。

### 已完成清单

- [x] **新增双 Android 路径防回归测试**
  - [x] 新增 `src/mobile.pipeline.test.ts`，约束以下关键项：
  - [x] `package.json` 中 Capacitor 与 Tauri Android 脚本必须同时存在。
  - [x] `capacitor.config.ts` 的 `webDir` 必须与 `dist/src/frontend` 对齐。
  - [x] `build_apk.bat` 必须保留同步与 APK 构建关键步骤。
  - [x] `src-tauri/tauri.conf.json` 必须保留 `bin/server` 与 `bin/godot` sidecar 配置。

- [x] **迁移回归测试集扩展**
  - [x] 已更新 `package.json` 中 `test:migration`，纳入 `src/mobile.pipeline.test.ts`。
  - [x] 当前迁移测试覆盖运行时路径、缓存/构建去重、双移动端流水线契约校验。

- [x] **本轮执行证据更新**
  - [x] `npm run build:mini` -> 通过。
  - [x] `npm run test:migration` -> 通过（`29` 项测试）。
  - [x] `npm run test:tauri` -> 通过（`9` 项 Rust 测试）。
  - [x] `npm run smoke:sidecar:relaunch` -> 通过。

### 结论

- [x] `P1.5` 不仅完成文档化，而且已纳入自动化回归保护。
- [x] 在当前仓库范围内（桌面 Tauri-first + 双移动端构建入口），Electron -> Tauri 迁移清单可视为已收口。

---

# 2026-03-01 v1.4.6 - Electron Removal Readiness Action Plan

**目标**：补齐 Electron -> Tauri 的剩余迁移缺口，使移除 Electron 后不会在桌面发布与移动导出链路产生功能回退。

### 阶段 P0 - 移除 Electron 前必须完成

- [x] **实现 Tauri 持久化配置对等能力（等价 `kb_config`）**
  - [x] 在 Tauri 应用数据目录持久化 KB 路径。
  - [x] 在 Tauri 应用数据目录持久化语言设置。
  - [x] 启动时在前端初始化前读取并应用。
  - [x] 验收：重启后无需手动重选 KB 与语言，菜单语言保持一致。

- [x] **加固 Godot 非开发机启动能力**
  - [x] 删除 `src-tauri/src/lib.rs` 中硬编码绝对路径。
  - [x] 采用可打包的 sidecar/bundle 路径解析方案。
  - [x] 校验构建产物中的 Godot 可执行文件存在且非空。
  - [x] 验收：`npm run tauri build` 已输出打包产物并接入二进制校验流水线。

- [x] **补齐子进程生命周期治理**
  - [x] 保留 Node sidecar 与 Godot 子进程句柄。
  - [x] 在应用退出钩子中显式回收子进程。
  - [x] 增加重启验证，确保不会遗留 `3000` 端口占用。
  - [x] 验收：关闭应用后不存在孤儿 sidecar/Godot 进程。

- [x] **修复发布态可写路径策略**
  - [x] 不再假设安装版可写 `dist/src/frontend`。
  - [x] 为生成文件（`data.js`、`graph_data.json`）指定可写运行目录（AppData/Cache）。
  - [x] 同步更新 sidecar 环境变量（`NOTE_CONNECTION_FRONTEND_DIR` + `NOTE_CONNECTION_RUNTIME_DATA_DIR`）与缓存恢复逻辑。
  - [x] 验收：安装版路径模型下构建与缓存恢复链路可用。

- [x] **补齐与 Electron 首次启动体验对等**
  - [x] 无配置时新增 Tauri 首次运行 KB 选择流程。
  - [x] 保留并持久化菜单“更改 KB / 重置”行为。
  - [x] 验收：新安装首次引导后永久记住用户选择。

### 阶段 P1 - 稳定化与验证

- [x] **将后端构建日志统一桥接到前端 Loading 面板**
  - [x] 通过 Rust/sidecar 桥发出结构化 `build-log` 事件。
  - [x] 确保长时间构建在 Tauri 下可见进度日志。
  - [x] 验收：`/api/build` 期间 Loading 面板持续收到增量日志。

- [x] **执行发布态冒烟测试并固化证据**
  - [x] Windows 打包验证（`tauri build` 已生成 msi/nsis 产物）。
  - [x] 缓存分流弹窗验证（`Load Existing` / `Regenerate`）。
  - [x] 单次点击去重验证（无重复 restore/build）。
  - [x] 验收：可复现实验结果已写入 `TEST_REPORT.md`。

- [x] **明确 GPU 启动命令规范**
  - [x] 文档统一使用 `npm run tauri:dev:mini:gpu`。
  - [x] 不再示例 `npm run tauri:dev:mini --gpu`（避免 npm 警告）。
  - [x] 验收：README/手册中仅保留受支持命令格式。

### 阶段 P1.5 - 双移动端交付（Capacitor + Tauri Android）

- [x] **同时保留两条官方 Android 生成路径**
  - [x] 路径 A：保留 Capacitor（Web 资产运行时，功能范围受限）。
  - [x] 路径 B：按 `docs/tauri_brainstorming.md` 提供 Tauri Android 流水线。
  - [x] 验收：两条路径均已文档化并提供构建脚本。

- [x] **Capacitor 路径边界明确化**
  - [x] 明确未嵌入后端前，设备端目录构建/加载 sidecar API 不可用。
  - [x] 明确移动端 source loading/reader 的降级预期。
  - [x] 验收：APK 行为约束已写入文档。

- [x] **Tauri Android 流水线补齐（脚本层）**
  - [x] 增加 Tauri Android 构建脚本与初始化命令。
  - [x] 保留并文档化 Node sidecar 在移动端的兼容性替换事项。
  - [x] 验收：Android 端 Tauri 构建命令已就绪。

### 阶段 P2 - Electron 清退

- [x] **仅在 P0/P1 门槛全部通过后执行清退**
  - [x] 删除 `package.json` 中 Electron 脚本。
  - [x] 删除 `main: dist/src/electron/main.js`。
  - [x] 删除 Electron 依赖（`electron`、`electron-builder`、`electron-squirrel-startup`）。
  - [x] 归档/删除 `src/electron/*` 与 `electron-builder.yml`。
  - [x] 验收：桌面构建链路已切换为 Tauri-first。

- [x] **文档清理**
  - [x] README 构建/发布章节从 Electron-first 改为 Tauri-first。
  - [x] 历史变更保留并标注 Electron 路线停用日期。
  - [x] 验收：当前发布文档不再要求使用 Electron 命令。

### Electron 移除闸门（Go/No-Go）

- [x] Tauri 下 KB 与语言持久化对等已验证。
- [x] Godot 启动不再依赖本机硬编码路径。
- [x] 应用退出后无孤儿子进程。
- [x] Tauri 安装版下构建/缓存/Reader 链路可用。
- [x] 双移动端路线（Capacitor + Tauri Android）已文档化。
- [x] 脚本与 README 全面对齐 Tauri。

---

# 2026-03-01 v1.4.5 - Physically-Based Bubbles & Cancel Completion

**目标**: 使用逼真的物理皂泡升级 Godot 渲染器，移除环境遮挡，并添加灵活的任务完成 UI 逻辑。

### 已完成清单

- [x] **基于物理的着色器**
  - [x] 将 81 波长薄膜干涉 Glassner 逻辑移植到 `bubble_material.gdshader`。
  - [x] 添加了 `warpnoise3` 和 `sp_spectral_filter` 以实现逼真的球面厚度变化。
- [x] **物理交互**
  - [x] 将中心气泡和周围气泡从 `MeshInstance3D` 转换为 `RigidBody3D`。
  - [x] 添加了 `_physics_process` 轨道磁力吸引，让气泡可以逼真地漂浮和碰撞而不会永久重叠。
  - [x] 移除了 `main.tscn` 环境中的 `Floor`（地板）节点障碍物。
- [x] **取消完成 UI**
  - [x] “标记完成”按钮现在动态切换为“取消完成”。
  - [x] 在 `path_mode_ui.gd` 和 `path_renderer.gd` 中连接动态状态以适当地标记/取消标记节点。

---

# 2026-03-01 v1.4.4 - Tauri Bridge Stabilization & Duplicate-Cycle Elimination

**目标**: 完成 Bridge-first 的 Tauri 迁移稳态化，重点解决缓存/加载重复执行、WebSocket 空闲重连抖动与运行时路径一致性问题。

### 已完成清单

- [x] **缓存分流恢复**
  - [x] 当目标缓存存在时，恢复“直接加载缓存 / 重新生成”的显式用户决策流程。
- [x] **重复执行保护**
  - [x] 前端增加加载单飞保护，避免重复点击触发双执行。
  - [x] 后端为 `/api/build` 与 `/api/restore-cache` 增加去重保护。
- [x] **PathBridge 诊断增强**
  - [x] 增加带标签连接日志（client id/tag/address + close code/reason），可区分正常重连与真实循环。
- [x] **Godot WS 兼容性修复**
  - [x] 已将 Godot URL 契约稳定为 `ws://127.0.0.1:9876`（移除查询参数，避免 Godot 端兼容性问题）。
- [x] **Tauri 空闲重连清理**
  - [x] 在 Tauri 模式禁用 `frontend-early` 自动 WebSocket 启动。
- [x] **语言/菜单幂等保护**
  - [x] 在前端与 Rust 命令侧加入“同语言无操作”保护，避免重复同步造成噪声。

### 更新文件

- `src/frontend/source_manager.js`
- `src/server.ts`
- `src/core/PathBridge.ts`
- `src/frontend/path_app.js`
- `path_mode/scripts/ws_client.gd`
- `src/frontend/i18n.js`
- `src-tauri/src/lib.rs`

---

# 2026-02-26 v1.4.3 - 9 规则树布局引擎 (9-Rule Tree Layout Engine)

**目标**: 将 `tree_path_mockup.html` 中的 9 规则展开/认领/可见性引擎迁移到生产代码，用完整的 owner/claim 体系替换简化轮廓布局。

## 9 规则对照 (Rule Mapping)

| #   | Rule (EN)                                 | 规则 (ZH)                  | Status |
| --- | ----------------------------------------- | -------------------------- | ------ |
| 1   | Expansion Order (FIFO claiming)           | 展开顺序（FIFO 认领）      | [x]    |
| 2   | Preceding Immunity (effective index)      | 前置免疫（有效索引）       | [x]    |
| 3   | Following Migration (spine+followers)     | 后续迁移（脊柱+后续）      | [x]    |
| 4   | Single Appearance (owner-based)           | 单次出现（基于所有者）     | [x]    |
| 5   | Cross-Tributary Isolation (edge filter)   | 跨支流隔离（边过滤）       | [x]    |
| 6   | Spine Always Visible (return on collapse) | 脊柱始终可见（折叠时返回） | [x]    |
| 7   | Sticky Claim (configurable toggle)        | 粘性认领（可配置开关）     | [x]    |
| 8   | Unit Migration (recursive claim)          | 单元迁移（递归认领）       | [x]    |
| 9   | Tributary Hierarchy Immunity              | 支流层级免疫               | [x]    |

## 已落地实现

- [x] 核心算法：`path_core.js` 完成 `expansionOrder`、`currentOwner/ownerPriority`、`tryClaim()` 与 `determineVisibility()`。
- [x] 前端桥接：`path_app.js` 将 `forcedExpansionNodes` 从 Set 改为有序数组，并接入 `stickyClaimEnabled`。
- [x] 渲染器对齐：Godot `tree_renderer.gd` 完成 owner 边过滤、hull 分组碰撞、节点类型着色与展开徽章。
- [x] Worker 参数透传：`path_worker.js` 传递 `expansionOrder` + `stickyClaimEnabled`。

---

# 2026-02-01 v1.4.1 - Path Mode v2: 轨道学习架构

**目标**: 将 Path Mode 升级为沉浸式、游戏化学习体验，引入 3D 气泡可视化与学习进度追踪。

## 架构总览

### 混合渲染策略

1. **Godot Desktop**（9876 端口）: Vulkan/OpenGL + 3D 彩虹薄膜气泡。
2. **Web Fallback**: Android/浏览器使用 Canvas/WebGL。
3. **Godot Mermaid 运行时契约**: PNG-only（`pngBase64` 必填）；SVG 仅用于诊断，不作为运行时回退。

### 学习模式

- **Domain Learning**: 对概念簇进行拓扑排序，学习完整主题域。
- **Diffusion Learning**: 从目标节点反向最短路径追溯前置依赖。

## 本阶段实施清单状态

- [x] 中心/外围双层气泡与点击交互主流程已打通。
- [x] 中心/外围双击行为已对齐 Reader 与轨道切换。
- [ ] 轨道旋转动画、主题化树视图与完整 3D shader 细节仍为后续迭代项。
- [ ] Path Tree 的完整可视化面板与样式系统仍在规划任务中。

---

# 2026-01-23 v1.2.0 - Path Mode 与桌面渲染器

**目标**: 将图谱转化为可学习课程路径，并建立高保真桌面渲染链路。

- [x] **Path Mode 学习路径**
  - [x] 策略：落地 Foundational（基础优先）与 Core（中心性优先）排序。
  - [x] 模式：Domain Learning（主题域）与 Diffusion Learning（反向扩散）双模式。
  - [x] 可视化：径向/树形布局与 Learn/Next/Locked 进度态。
- [x] **混合架构**
  - [x] 建立 Godot WebSocket 桥接（9876）。
  - [x] 桌面使用低延迟原生渲染；Web/Canvas 保留回退能力。

---

# 2026-01-23 v1.1.2 - 路径解析与 UI 稳定性

**目标**: 修复 Windows 静态资源解析问题，并消除 Welcome Modal 引发的 UI 失效。

- [x] 后端：`server.ts` 静态文件映射忽略 query string，`data.js?v=...` 可正确命中。
- [x] 前端：修复 `welcome.js` 跳过引导后菜单 `z-index` 还原，避免菜单不可点击。

---

# 2026-01-22 v1.1.1 - 移动端构建自动化

**目标**: 自动化 Android APK 构建流程，降低移动端发布门槛。

- [x] 新增 `build_apk.bat` 一键构建脚本（Windows）。
- [x] 自动检查 Node.js / Java JDK / Android SDK 环境。
- [x] 用户手册与 README 同步更新移动端构建步骤。

---

# 2026-01-22 v1.1.0 - CI/CD 自动化与稳定性收口

**目标**: 强化协议处理、i18n 一致性与引导 UI 稳定性。

- [x] 多语言收口：移除 `app.js` 冗余翻译逻辑，统一 `I18nManager`。
- [x] 引导流程修复：公开 `enterFocusMode/exitFocusMode` 供教程调用，修复欢迎弹窗触发时机。
- [x] 协议与缓存：`source_manager.js` 引入时间戳动态加载，避免 `data.js` 缓存污染。
- [x] 协议处理优化：`main.ts` 中 `app://` 处理改为 `net.fetch`，提高可靠性。
- [x] 同步补强移动构建：`build_apk.bat` 与文档说明完成对齐。

---

# 2026-01-14 v1.0.0 - 生产环境正式发布 (Production Release)

**目标**: 显著提升系统稳定性、离线可靠性及专注模式视觉体验。

- [x] **稳定性与构建 (v1.0.0)**:
  - **精简版修复**: 解决首屏崩溃、Worker 路径及数据清理问题。
  - **离线支持**: 100% 本地化渲染库 (D3, KaTeX, Mermaid)。
- [x] **专注模式优化 (v1.0.0)**:
  - **视觉恢复**: 修复退出后的尺寸还原 Bug。
  - **O(1) 邻居查找**: 实现客户端邻接缓存，消除切换延迟。
  - **批量 UI 更新**: 使用 `requestAnimationFrame` 同步渲染。
- [x] **物理引擎打磨**:
  - **更高间距**: 默认链接距离增加至 250px，支持更广范围自定义。
- [x] **随机专注**: 在搜索栏旁添加骰子图标，支持即时随机聚焦。
- [x] **GPU 诊断增强**: 增加详细的 GPU 上下文报告（供应商/渲染器）。
- [x] **安全与 CSP**: 更新 CSP 以实现严密的离线环境安全。


# 2026-01-13 v0.9.83 - GPU 工作线程集成 (GPU Worker Integration)

**目标**: 在模拟工作线程中全面启用 GPU 加速，解决设置不一致和 Worker 环境兼容性问题。

- [x] **GPU 工作线程集成**:
  - [x] **工作线程加速**: 在 `simulationWorker.js` 中全面启用了 GPU 力 (`gpuManyBody`, `gpuLink`)。
  - [x] **环境修复**: 重构了 `layout_gpu.js`，通过 `globalScope` 兼容 Web Worker 的 `self` 上下文。
  - [x] **持久性修复**: 优化了 Worker 中的 `updateParams` 逻辑，使用 `.strength()` 更新现有的力，而不是替换它们，防止意外回退到 CPU 物理。
  - [x] **设置同步**: 验证了 `gpuRendering` 标志在初始化期间已正确传递给 Worker。
- [x] **Worker 握手协议**:
  - [x] **显示锁定**: 实现了 `isLayoutSwitching` 状态机，以在转换期间阻止过时的 `tick` 消息。
  - [x] **双向同步**: 引入了 `layoutSwitchDone` 循环，确保 UI 和 Worker 坐标完美对应。
- [x] **专注模式拖动隔离**:
  - [x] **手动驱动**: 专注模式节点不再向 Worker 发送拖动消息，坐标直接在主线程计算。
  - [x] **显示刷新**: 修复了由于延迟消息覆盖手动设置坐标导致的竞态条件。

# 项目构建计划：渐进式层级知识图谱

本文档概述了构建 `NoteConnection` 的路线图，该系统能够将数万个知识点可视化为有向无环图 (DAG)，重点突出层级关系和学习路径。

---

# 2026-01-12 v0.9.74 - 布局切换与 GPU 稳健性

**目标**: 完成稳定的布局切换状态保存，并解决 GPU 资源管理问题（WebGL 上下文泄漏）。

- [x] **布局切换修复**
  - [x] **状态保存**: 实现了 `layoutCache`，独立存储和恢复 'Force' 和 'DAG' 布局的节点位置 (`x, y, fx, fy`)。
  - [x] **崩溃解决**: 通过重构 `applyPhysics` 的使用，修复了 `updateLayout` 中在初始化前访问 `simulation.force` 导致的关键崩溃。
  - [x] **逻辑**: 布局切换现在可以平滑过渡，没有视觉上的“瞬移”闪烁或模拟重置。

- [x] **GPU 稳健性**
  - [x] **单例模式**: 重构 `layout_gpu.js`，为 `GPUManyBodyForce` 使用单例实例，防止在切换设置时发生 WebGL 上下文溢出（限制 16 个上下文）。
  - [x] **构造安全**: 增强了对 `GPU.GPU` 的检测，以处理不同的库打包方式 (Webpack/Rollup)。

# 2026-01-12 v0.9.73 - GPU 渲染修复 (链式调用 Bug)

**目标**: 修复由于 `layout_gpu.js` 中的链式调用 Bug 导致的 GPU 力“静默失败”，该 Bug 导致 v0.9.72 尽管 UI 设置已开启但未能实际激活 GPU 物理引擎。

- [x] **Bug 修复**
  - [x] **链式调用**: 修复了 `layout_gpu.js` 中的 `strength()` 方法，使其返回 `impl` 函数包装器而不是 `this`。
  - [x] **验证**: 确认 `d3.force` 现在可以正确接收可调用的函数。

# 2026-01-12 v0.9.72 - GPU 优化渲染 (极客版)

**目标**: 满足“极客”需求，利用 AMDGPU (RX 7900XT) 实现更流畅的前端渲染和并行后端处理。

- [x] **前端 GPU 渲染**
  - [x] **GPU 力引擎**: 使用 `gpu.js` 在 `layout_gpu.js` 中实现了 `GPUManyBodyForce`。
  - [x] **集成**: 添加了 `libs/gpu-browser.min.js` 并集成到 `app.js`。
  - [x] **UI 控制**: 验证了设置中的“GPU 优化渲染”复选框。默认值：启用。
  - [x] **逻辑**: 实现 CPU (`d3.forceManyBody`) 和 GPU (`gpuManyBody`) 物理引擎之间的动态切换。

- [x] **后端优化确认**
  - [x] **并行化**: 确认 `GraphBuilder` 使用带有 Worker 线程的 `LayoutEngine`。
  - [x] **GPU 后端**: 确认如果启用了 GPU，`LayoutEngine` 会使用 `amdgpu/LayoutGPU.ts`。

# 2026-01-10 v0.9.71 - 后端布局与静态模式

**目标**: 通过将布局计算卸载到后端 Worker 线程并实施静态渲染模式，优化大规模图谱 (50k+ 节点) 的性能。

- [x] **后端并行布局**
  - [x] **布局引擎**: 创建了 `LayoutEngine.ts` 和 `layoutWorker.ts` 以在后端线程运行 `d3-force` 模拟。
  - [x] **集成**: `GraphBuilder` 现在自动为超过 100 个节点的图谱触发后端布局计算。
  - [x] **GPU 加速**: 使用 `gpu.js` 实现了 `LayoutGPU.ts` 以在 AMDGPU 上加速布局。
  - [x] **性能**: 通过提供预计算的坐标减少前端初始化时间。

- [x] **前端优化**
  - [x] **静态模式**: 引入了“静态模式”切换。
    - [x] **自动启用**: 节点数 >5000 或 边数 >200,000 时自动启用。
    - [x] **行为**: 模拟运行 2 秒 (预热) 后停止以节省 CPU。
    - [x] **布局切换**: 布局转换 (Force <-> DAG) 期间尊重静态模式。
  - [x] **GPU 设置**: 在设置中添加了“GPU 优化渲染”复选框以控制加速标志。
  - [x] **极端规模**: 对于 >10,000 个节点的图谱，严格禁用边渲染以防止渲染瓶颈。

- [x] **CLI 与文件管理**
  - [x] **CLI 参数**: 为 `npm start` 添加了 `--path` 和 `--gpu` 支持。
  - [x] **文件隔离**: CLI 运行生成唯一的 `data_cli_*.js` 文件以保护原始 `data.js`。
  - [x] **服务器逻辑**: `server.ts` 根据构建参数自动提供正确的 CLI 数据文件。

# 2026-01-09 v0.9.70 - 前端初始化修复 (竞态条件)

**目标**: 解决由于大规模数据集初始化序列中的竞态条件导致的“不显示节点”和“按钮无响应”问题。

- [x] **Bug 修复**
  - [x] **竞态条件**: 确定 `renderCanvas` 在 `controls` 对象定义之前被 `ResizeObserver` 或 `setTimeout` 调用，导致脚本执行中断的致命错误。
  - [x] **重构**: 将 `controls` 的定义移至 `app.js` 顶部。
  - [x] **稳健性**: 在 `isNodeVisible` 和 `renderCanvas` 中添加了安全检查，以防止初始化期间崩溃。
  - [x] **结果**: UI 按钮 (冻结、设置) 现在应正确初始化，画布应立即渲染。

# 2026-01-09 v0.9.69 - 前端崩溃修复 (10k+ 节点)

**目标**: 修复由于前端处理 120 万条边时的栈溢出导致的“节点：0”关键 Bug。

- [x] **Bug 修复**
  - [x] **栈溢出**: 确定了 `app.js` 中由于 `links.push(...validLinks)` 带有 120 万个参数导致的 `RangeError: Maximum call stack size exceeded`。
  - [x] **重构**: 将 `links` 声明从 `const` 更改为 `let`，并用直接赋值 (`links = validLinks`) 替换了展开操作。
  - [x] **结果**: 应用程序现在成功加载并渲染超过 10,000 个节点和 100 万条边的图谱，而不会崩溃。

# 2026-01-09 v0.9.68 - 按需内容架构 (10k+ 修复)

**目标**: 彻底解决由于巨大的 `data.js` 文件大小 (~500MB) 导致浏览器崩溃而造成的 10k+ 节点“节点：0”显示问题。

- [x] **架构重构**
  - [x] **数据拆分**: 将图结构 (`data.js`) 与内容 (`graph_data.json`) 分离开来。
  - [x] **优化**: `data.js` 现在不包含节点内容，文件大小减少了 ~95% (例如，13k 节点的 500MB 降至 35MB)。
  - [x] **后端**: 更新了 `src/index.ts` 以生成“轻量版” `data.js`。

- [x] **按需内容**
  - [x] **API 端点**: 在 `server.ts` 中添加了 `GET /api/content` 以安全地提供原始节点内容。
  - [x] **前端**: 更新了 `reader.js` 中的 `Reader`，使其在打开节点时异步获取内容。
  - [x] **UX**: 在阅读器窗口添加了加载状态指示器。


### 2026-01-08 v0.9.67 - 紧凑模式与 Canvas 修复 (Compact Mode & Canvas Fix)

**目标**: 解决 10k+ 节点的显示问题，并实现默认隐藏边的性能模式。

- [x] **紧凑模式**:
  - [x] **自动启用**: 对于 >5000 节点或 >100,000 边自动激活。
  - [x] **边剔除**: 渲染循环在紧凑模式下完全跳过边迭代，除非高亮处于活动状态。
  - [x] **设置 UI**: 向性能设置添加了 "紧凑模式 (隐藏边)" 复选框。
- [x] **Canvas 修复**:
  - [x] **初始渲染**: 初始化后强制显式调用 `resizeCanvas()` 和 `ticked()` 以防止白屏。

### 2026-01-08 v0.9.63 - 10k 节点优化与内存策略 (10k Node Optimization & Memory Strategy)

**目标**: 解决 10k+ 节点/1.2M 边时的 "卡死" 渲染问题，并实现后端处理的可配置内存策略。

- [x] **前端优化**:
  - [x] **物理剔除**: 为 D3 力导向模拟实施边限制 (20k)。如果总边数超过此值，仅子集驱动物理以防止主线程冻结，同时所有边仍可用于渲染/遍历。
  - [x] **链接解析**: 将链接源/目标预解析为对象，以支持稳健的渲染，即使物理使用子集。
  - [x] **UI 解锁**: 通过释放主线程修复了 "快速开始指南" 不出现的问题。
- [x] **后端内存策略**:
  - [x] **配置**: 向 `AppConfig` 添加了 `memorySavingMode` 和 `deepDebug`。
  - [x] **Worker 优化**: 重构 `keywordMatchWorker` 和 `statisticalWorker` 以支持 `filePaths` (低内存) 和 `filesChunk` (高性能/精度) 模式。
  - [x] **图指标**: 添加检查以在激活 `memorySavingMode` 时强制单核执行 `Betweenness Centrality`。
  - [x] **循环检测**: 根据内存模式调整限制 (100 vs 10000)。
- [x] **系统监控**:
  - [x] **峰值内存**: 更新 `PerformanceLogger` 以跟踪并记录峰值堆/RSS 内存使用情况。
  - [x] **深度调试**: 基于 `deepDebug` 标志实现了条件详细日志记录。

### 2026-01-07 v0.9.62 - 文档更新 (AMDGPU 指南) (Documentation Update - AMDGPU Guide)

**目标**: 为 AMDGPU 用户提供详细的硬件和软件指南，特别是针对 `gpu.js` 加速和未来的 AI 集成。

- [x] **文档**:
  - [x] **README.md**: 添加 "硬件与驱动要求" 部分，详述 RDNA 架构、驱动选择 (Adrenalin vs Mesa/ROCm) 和 `headless-gl` 的构建依赖。

### 2026-01-07 v0.9.61 - 前端内存优化 (自动 Canvas) (Frontend Memory Optimization - Auto-Canvas)

**目标**: 通过在节点数超过阈值时自动默认使用 "Canvas" 模式，减少前端内存消耗并提高大图的渲染性能。

- [x] **智能默认值**:
  - [x] **阈值检查**: 在 `app.js` 中，检查 `nodes.length > 3000`。
  - [x] **自动切换**: 如果超过阈值，初始化期间以编程方式选择 "Canvas" 渲染器并更新 DOM 可见性（隐藏 SVG，显示 Canvas）。
  - [x] **用户覆盖**: 如果需要，用户仍可以手动切换回 SVG。

### 2026-01-07 v0.9.60 - 并行图指标计算 (Parallel Graph Metrics)

**目标**: 通过并行化 "图指标" 计算（介数中心性），优化图构建性能，该计算以前是单线程的。

- [x] **并行化**:
  - [x] **Worker 实现**: 创建 `betweennessWorker.ts` 以使用 Brandes 算法计算节点子集的部分中心性分数。
  - [x] **异步逻辑**: 更新 `GraphMetrics` 为 `calculateBetweennessAsync`，使用 Worker 池（默认：`numCPUs - 1`）。
  - [x] **集成**: 将异步指标计算集成到 `GraphBuilder` 管道中。
  - [x] **验证**: 使用 `test_metrics_parallel.ts` 在 500+ 节点上验证功能。

### 2026-01-07 v0.9.59 - 向量空间内存修复 (稀疏矩阵) (Vector Space Memory Fix - Sparse Matrix)

**目标**: 通过用稀疏向量实现替换密集的 TF-IDF 矩阵，解决处理 13k+ 文件时 Windows 10/11 (128GB RAM) 上的 "堆内存溢出" 崩溃。

- [x] **内存优化**:
  - [x] **稀疏向量**: 重构 `VectorSpace` 使用 `Uint32Array` (索引) 和 `Float32Array` (值) 代替标准 Javascript 数组。
  - [x] **效率**: 将 13k 文件的内存占用从约 10GB+ (密集) 减少到 <500MB (稀疏)。
  - [x] **算法**: 优化余弦相似度计算使用稀疏点积 ($O(min(N, M))$)。
  - [x] **配置**: 在 `package.json` 中将默认 Node.js 堆限制增加到 12GB (`--max-old-space-size=12288`) 以利用可用的系统 RAM。

### 2026-01-07 v0.9.58 - 混合推断资源重用 (优化) (Hybrid Inference Resource Reuse)

**目标**: 通过防止重复计算统计矩阵和向量空间，修复混合推断期间的 "堆内存溢出" 崩溃。

- [x] **资源优化**:
  - [x] **共享状态**: 在 `GraphBuilder` 中实现了 `sharedStatsMatrix` 和 `sharedVectorSpace`。
  - [x] **逻辑**: 如果启用了 `HybridInference`，则预先计算这些重资源，并在统计和向量步骤中重用它们。
  - [x] **清理**: 推断完成后显式清除共享资源。
  - [x] **结果**: 消除了运行混合推断时的 2 倍内存峰值，防止了 13k+ 文件上的 OOM。

### 2026-01-07 v0.9.57 - Worker 内存优化 (Worker Memory Optimization)

**目标**: 通过优化主线程和 Worker 之间的数据传输，解决处理大数据集（13k+ 文件）时 Windows 10/11 上的 "堆内存溢出" 错误。

- [x] **Worker 数据传输**:
  - [x] **优化**: 重构 `keywordMatchWorker` 和 `statisticalWorker` 以接受 `filePaths: string[]` 而不是 `filesChunk: RawFile[]`（包含完整内容）。
  - [x] **实现**: Worker 现在使用 `fs` 按需从磁盘读取文件内容，避免了序列化期间克隆内容字符串的巨大内存开销。
  - [x] **结果**: 显著减少了并行处理步骤期间的堆使用量。

### 2026-01-05 v0.9.56 - 混合推断内存分析 (Hybrid Inference Memory Analysis)

**目标**: 分析并优化 "混合推断" 引擎的内存使用，以解决 Windows 10 上的 "堆内存溢出" 错误，防止图构建期间的大对象保留。

- [x] **细粒度日志**:
  - [x] **实现**: 在 `HybridEngine.infer` 和 `GraphBuilder`（统计矩阵、向量空间、推断引擎）中添加了详细的 `PerformanceLogger` 步骤。
  - [x] **进度跟踪**: 在推断期间每处理 1000 个节点记录一次内存使用情况，以查明峰值。
  - [x] **优化**: 在推断后立即显式清除大型 `matrix` 并置空 `vectorSpace`，以在后续步骤之前释放堆内存。

### 2026-01-05 v0.9.55 - 堆内存溢出修复与迭代 DFS (Heap OOM Fix & Iterative DFS)

**目标**: 通过优化图构建期间的内存使用并将递归重构为迭代，解决 Windows 10/11 上的 "堆内存溢出" 崩溃。

- [x] **内存优化**:
  - [x] **作用域管理**: 在进入 `GraphBuilder` 中内存密集的 `Algorithmic Core` 阶段之前，显式清除 `fileMap`（保存文件内容）。
  - [x] **细粒度日志**: 将 `Algorithmic Core` 日志拆分为 `Cycle Detection` 和 `Topological Sort` 以进行精确的错误跟踪。
- [x] **算法稳健性**:
  - [x] **迭代 DFS**: 重构 `CycleDetector.detectCycles` 使用基于栈的迭代方法代替递归，以防止深度图上的堆栈溢出。
  - [x] **验证**: 使用现有单元测试验证逻辑。

### 2026-01-05 v0.9.54 - 欢迎体验 (Welcome & Empty State Experience)

**目标**: 通过在图表为空时提供清晰的指导，改善新用户引导体验。

- [x] **空状态处理**:
  - [x] **检测**: `welcome.js` 中的逻辑检测 `graphData` 是否为空或缺失。
  - [x] **欢迎模态框**: 实现了 "Welcome to NoteConnection" 模态框，引导用户：
    1. 选择源文件夹。
    2. 点击加载。
  - [x] **视觉提示**: 模态框激活时高亮显示源控制区域。

### 2026-01-05 v0.9.53 - 核心 API 解耦 (Core API Decoupling)

**目标**: 通过将核心逻辑与 CLI 环境解耦，为插件集成 (Joplin/Obsidian) 准备代码库。

- [x] **核心重构**:
  - [x] **NoteConnection 类**: 创建 `src/core/NoteConnection.ts` 作为主外观模式。
  - [x] **解耦**: 将 `buildGraph` 逻辑移出 `src/index.ts` 以允许库式使用。
  - [x] **CLI 更新**: 重构 `src/index.ts` 以使用新的核心 API。

### 2026-01-05 v0.9.52 - 循环检测内存优化 (Cycle Detection Memory Optimization)

**目标**: 解决处理具有许多循环的大图（100k+ 边）时 Windows 10/11 上的 "堆内存溢出" 崩溃。

- [x] **循环检测优化**:
  - [x] **限制逻辑**: 更新 `CycleDetector` 以接受 `limit` 参数。
  - [x] **终止**: 在找到指定数量的循环 (100) 后立即停止递归/搜索，而不是收集所有循环。
  - [x] **验证**: 添加了单元测试以确限制被遵守。

### 2026-01-03 v0.9.51 - 性能日志与崩溃报告 (Performance Logging & Crash Reporting)

**目标**: 通过实施详细的性能指标和自动崩溃报告来增强系统可观测性，以促进调试。

- [x] **性能日志记录器**:
  - [x] **工具**: 创建 `PerformanceLogger` 类来跟踪时间、CPU (用户/系统) 和内存 (堆/RSS)。
  - [x] **集成**: 用日志记录包裹所有 `GraphBuilder` 阶段（节点初始化、边匹配、推断）。
  - [x] **GPU 跟踪**: 将日志记录集成到 `VectorSpaceGPU` 以监控内核执行时间。
- [x] **崩溃报告**:
  - [x] **工具**: 创建 `CrashLogger` 将未处理的错误写入 `crash.log`。
  - [x] **集成**: 在 `server.ts` 中附加全局处理程序 (`uncaughtException`, `unhandledRejection`)。
  - [x] **Worker**: 向 `keywordMatchWorker` 和 `statisticalWorker` 添加了 try-catch 块和日志记录器集成。

### 2026-01-02 v0.9.50 - GPU 加速可行性 (GPU Acceleration Feasibility)

**目标**: 验证并实现用于数学运算（矩阵乘法）的 GPU 加速，以便在支持的硬件上（在 AMD 7900XT 上验证）进一步加快图构建。

- [x] **可行性验证**:
  - [x] **库**: 安装 `gpu.js` 以通过 WebGL/OpenCL 将 Node.js 与 GPU 连接。
  - [x] **硬件检查**: 验证了 AMD Radeon 7900XT (Windows 10) 上的内核编译和执行成功。
  - [x] **基准测试**: 矩阵乘法 (512x512) 在 GPU 模式下成功完成。
- [x] **实施计划**:
  - [x] **向量空间**: 将 $N \times N$ 余弦相似度矩阵计算卸载到 GPU (`amdgpu/VectorSpaceGPU.ts`)。
  - [x] **约束**: 将字符串处理（关键词匹配）保留在 CPU (Worker) 上，因为文本传输到 GPU 的开销超过了收益。

### 2026-01-02 v0.9.49 - 统计分析内存优化 (Statistical Analysis Memory Optimization)

**目标**: 通过优化共现矩阵计算，修复处理大数据集（10k+ 文件）时的 "堆内存溢出" 错误。

- [x] **算法优化**:
  - [x] **稀疏矩阵计算**: 重构 `calculateMatrixOptimized` 使用以文件为中心的迭代方法 ($O(Files \times TermsPerFile^2)$)，而不是密集的术语对迭代 ($O(TotalTerms^2)$)。
  - [x] **复杂度降低**: 将复杂度从约 1.7 亿次迭代（针对 13k 节点）降低到约 500 万次迭代。
  - [x] **数据结构效率**: 移除了 Worker 结果聚合期间不必要的中间对象转换 (`Set` <-> `Array`)。
  - [x] **Worker 结果合并**: 优化 `runParallelTermExtraction` 以迭代方式合并块，而不是使用 `reduce`，以防止内存峰值。

### 2026-01-02 v0.9.48 - 并行处理优化 (Parallel Processing Optimization)

**目标**: 通过允许可配置的 Worker 线程限制，利用更多 CPU 核心处理大数据集，优化图构建性能。

- [x] **Worker 配置**:
  - [x] **可配置限制**: 向 `AppConfig` 添加了 `maxWorkers` 以覆盖默认 Worker 限制。
  - [x] **移除上限**: 移除了 `GraphBuilder` 和 `StatisticalAnalyzer` 中硬编码的 12 个 Worker 限制。如果未指定，默认为 `numCPUs - 1`。
  - [x] **验证**: 在测试数据集上使用 50 个 Worker 进行了验证。

### 2026-01-02 v0.9.47 - 专注模式交互与布局修复 (Focus Mode Interaction & Layout Fixes)

**目标**: 通过防止意外缩放和修复垂直布局中的标签重叠，提高专注模式的可用性。

- [x] **交互逻辑**
  - [x] **双击缩放预防**: 在节点双击处理程序中添加了 `stopPropagation`，以防止 `d3.zoom` 在进入专注模式时触发放大事件。
- [x] **专注模式布局**
  - [x] **垂直间距**: 在 "垂直" (L-R) 布局中，将节点标签的水平偏移 (`dx`) 增加到 **35px**（原默认约 12px），以防止文本与节点重叠。
  - [x] **焦点节点**: 对垂直布局中的中央焦点节点应用相同的水平偏移，以保持一致性。

### 2025-12-26 v0.9.46 - 专注模式 UI 清理与 Canvas 边修复 (Focus Mode UI Cleanup & Canvas Edge Fix)

**目标**: 清理专注模式期间的 UI 以减少混乱，并修复 Canvas 模式下的视觉渲染。

- [x] **UI 隐藏**
  - [x] **主控件**: 进入专注模式时，"选择知识库"、"加载" 和主 "NoteConnection" 下拉菜单现在完全隐藏 (`display: none`)。
  - [x] **恢复**: 退出专注模式时，元素恢复到默认状态 (`display: ''`)，尊重 CSS 规则（例如移动端可见性）。
- [x] **Canvas 可视化**
  - [x] **边隐藏**: 在 Canvas 专注模式下，*所有*边现在都被隐藏以提供更干净的外观，符合“不显示任何边”的要求。

### 2025-12-26 v0.9.45 - Canvas 交互与清理 (Canvas Interactivity & cleanup)

**目标**: 在 Canvas 模式下启用完全交互性（悬停、点击、专注）并移除已弃用的 "视图模式"（聚类）功能。

- [x] **Canvas 交互**
  - [x] **命中测试**: 实现了 `findNodeAt(x, y)` 以检测 Canvas 模式下鼠标光标下的节点，考虑了缩放/平移变换。
  - [x] **事件监听器**: 向 canvas 元素添加了 `mousemove` (高亮) 和 `click` (检查/专注) 处理程序。
  - [x] **一致性**: Canvas 交互现在匹配 SVG 行为（单击 -> 统计，双击 -> 专注）。
- [x] **视觉修复**
  - [x] **节点大小**: 更新 `renderCanvas` 以尊重 "大小依据" 设置（度数/中心性/统一），修复了节点渲染过大的问题。
- [x] **清理**
  - [x] **移除视图模式**: 从代码库中移除了 "视图模式"（节点/聚类）控件和相关逻辑，因为它已被弃用。

### 2025-12-26 v0.9.44 - 独立专注模式间距 (Independent Focus Mode Spacing)

**目标**: 允许用户为专注模式下的 "水平" 和 "垂直" 布局独立配置 "层间距" 和 "节点间距"，防止一种布局的设置影响另一种。

- [x] **间距逻辑**
  - [x] **状态管理**: 创建 `focusSpacingSettings` 为 `horizontal` 和 `vertical` 模式存储单独的 `layer` 和 `node` 值。
  - [x] **默认值**:
    - **水平**: 层间距默认为 **125** (原为 250)。
    - **垂直**: 节点间距默认为 **20** (原为 80)。
  - [x] **UI 同步**: 切换专注布局下拉菜单现在会自动更新滑块以反映该特定模式的存储值。
  - [x] **持久化**: 调整滑块仅更新*当前*模式的设置。

### 2025-12-26 v0.9.43 - 上下文感知设置 UI (Context-Aware Settings UI)

**目标**: 通过动态更新设置模态框中的标签以反映当前活动的布局模式，提高用户清晰度。

- [x] **UI 增强**
  - [x] **标签切换**: 排斥力滑块的标签现在根据设置模态框打开时的活动布局更新为 "排斥力 (力导向)" 或 "排斥力 (DAG)"。
  - [x] **本地化**: 支持英语和中文语言环境的动态标签切换。

### 2025-12-26 v0.9.42 - 独立排斥力设置 (Distinct Repulsion Settings)

**目标**: 允许用户为 "力导向" 和 "DAG" 布局模式配置不同的 "排斥力强度" 值，并具有特定于布局的默认值。

- [x] **设置逻辑**
  - [x] **数据结构**: 更新了 `settings.js` 中的 `defaultSettings` 以存储单独的键：`repulsionForce` (默认: -550) 和 `repulsionDAG` (默认: -850)。
  - [x] **上下文感知 UI**: "可视化设置" 模态框现在自动显示并更新对应于当前活动布局模式的排斥力值。
  - [x] **动态应用**: 切换布局 (`updateLayout`) 或更改设置 (`settingsManager.subscribe`) 动态应用正确的力强度。

### 2025-12-26 v0.9.41 - 设置模态框模拟冻结 (Settings Modal Simulation Freeze)

**目标**: 打开 "可视化设置" 模态框时自动冻结模拟，以节省内存/CPU 并防止配置期间的后台活动。

- [x] **模态框状态逻辑**
  - [x] **自动冻结**: 打开设置模态框 (`initSettingsUI`) 现在触发 `simulation.stop()` 并设置内部 `isSettingsModalOpen` 标志。
  - [x] **条件恢复**: 关闭模态框*仅*在全局 "冻结布局" 复选框未选中时恢复模拟。
  - [x] **更新抑制**: 模态框打开时由 `settingsManager` 触发的更新（例如滑块拖动）应用值但*不*重启模拟循环。

### 2025-12-26 v0.9.40 - 冻结布局优先级修复 (Freeze Layout Priority Fix - Settings Modal)

**目标**: 确保在 "可视化设置" 模态框中更改物理或视觉设置不会在 "冻结布局" 启用时重启模拟。

- [x] **设置应用逻辑**
  - [x] **条件重启**: 修改了 `app.js` 中的 `settingsManager.subscribe` 回调以检查 "冻结布局" 复选框状态。
  - [x] **行为**:
    - **冻结**: 力（电荷、距离、碰撞）在后台更新，但跳过 `simulation.restart()`。视觉更改（不透明度）立即应用。
    - **解冻**: 力更新且模拟重启 (alpha 0.3)。

### 2025-12-26 v0.9.39 - 布局切换松弛与冻结逻辑 (Layout Switch Relaxation & Freeze Logic)

**目标**: 在切换布局时应用 "快速松弛" 策略（0.2 阻尼 -> 0.95 阻尼），确保与初始加载行为一致。此外，确保在松弛期后尊重 "冻结布局"。

- [x] **布局转换逻辑**
  - [x] **松弛**: 切换到新布局 (Force/DAG) 会将 `velocityDecay` 重置为 **0.2** 并持续 2 秒，以允许节点快速找到新位置。
  - [x] **稳定**: 2 秒后自动过渡到 **0.95** 阻尼。
  - [x] **延迟冻结**: 如果在切换期间启用了 "冻结布局"，模拟将在 2 秒的松弛阶段运行，然后自动**停止**，将新布局冻结在其稳定状态。

### 2025-12-26 v0.9.38 - 快速开始指南 HTML 渲染修复 (Quick Start Guide HTML Rendering Fix)

**目标**: 修复本地化快速开始指南内容中的 HTML 标签（如 `<br>` 和 `<strong>`）显示为原始文本而不是被渲染的问题。

- [x] **渲染逻辑**
  - [x] **HTML 支持**: 更新了 `app.js` 中的 `window.updateLanguage`，在注入翻译内容时使用 `.innerHTML` 而不是 `.innerText`。这确保了指南中的富文本元素正确显示。

### 2025-12-26 v0.9.37 - 快速松弛策略 (Rapid Relaxation Strategy)

**目标**: 实现两阶段阻尼过程，允许图表在加载时快速“展开”，然后稳定下来。

- [x] **阻尼逻辑**
  - [x] **初始阶段**: 在前 2 秒将 `velocityDecay` 设置为 **0.2**。这种低摩擦力允许节点迅速移离中心并解开。
  - [x] **稳定阶段**: 2 秒后自动过渡到 **0.95**（高摩擦力）以稳定布局（从 0.92 更新）。
  - [x] **交互安全**: 确保自动过渡不会覆盖初始阶段的手动滑块调整。

### 2025-12-26 v0.9.36 - 冻结布局优先级修复 (Freeze Layout Priority Fix - Visual Settings)

**目标**: 确保如果启用了 "冻结布局"，更改视觉设置（度数基准、大小依据）不会触发模拟重启，尊重用户保持节点静止的指令。

- [x] **视觉更新逻辑**
  - [x] **条件重启**: 修改了 `app.js` 中的 `updateSize()` 以检查 "冻结布局" 复选框状态。
  - [x] **行为**: 如果冻结，视觉属性（半径、字体大小）立即更新，但跳过 `simulation.restart()`。碰撞力在后台更新，为用户解冻时做好准备。

### 2025-12-26 v0.9.35 - 视口剔除放宽 (Viewport Culling Relaxation)

**目标**: 放宽视口剔除限制以提供更流畅的用户体验，防止视口外的节点过早冻结，并允许在全局冻结之前进行更深度的缩小。

- [x] **剔除优化**
  - [x] **全景冻结阈值**: 从 `scale < 0.4` 降低到 `scale < 0.1`，允许在更广泛的缩放级别下模拟。
  - [x] **动态缓冲区**: 将屏幕外缓冲区从固定的 `100` 单位增加到 `800 / scale`（约 800 视觉像素），确保“向外扩展的固定范围”行为。

### 2025-12-26 v0.9.34 - 全局布局更新修复 (Global Layout Update Fix)

**目标**: 确保布局切换应用于图表中的所有节点，覆盖可能已冻结屏幕外节点的任何优化约束（如视口剔除）。

- [x] **布局转换逻辑**
  - [x] **全局解冻**: 在 `updateLayout()` 中，启动新模拟时显式清除所有节点的 `fx` 和 `fy` 属性。
  - [x] **剔除重置**: 重置 `isCulled` 标志，以确保屏幕外节点包含在新布局计算和渲染中。
  - [x] **结果**: 从 'Force' 切换到 'DAG'（反之亦然）可以正确重新排列整个图表，即使用户放大了视图且许多节点以前被冻结。

### 2025-12-26 v0.9.33 - 布局状态缓存 (Layout State Caching - Instant Switch)

**目标**: 实现状态缓存，允许在布局（"力导向" vs "DAG"）之间切换而无需重新计算位置或动画过渡，满足 "模板状态" 需求。

- [x] **状态管理**
  - [x] **缓存**: 创建 `layoutCache` 以存储每种模式的 `x, y, fx, fy`。
  - [x] **保存/恢复**: 实现切换前保存当前位置和切换后恢复目标位置的逻辑。
- [x] **转换逻辑**
  - [x] **即时切换**: 如果存在布局缓存，恢复位置并跳过模拟预热 (`alpha(1)`)，有效地将节点传送到其先前的状态。
  - [x] **首次运行**: 如果不存在缓存，执行标准模拟。

### 2025-12-26 v0.9.32 - 高阻尼与渲染优化 (High Damping & Render Optimization)

**目标**: 通过增加模拟摩擦力和跳过冻结的屏幕外节点的 DOM 更新，进一步减少内存/CPU 消耗。

- [x] **阻尼调整**
  - [x] **默认值**: 将 `velocityDecay` 增加到 **0.92**。
  - [x] **效果**: 图表稳定得更快；移动更“重”，抖动更少。

- [x] **渲染剔除 (DOM)**
  - [x] **逻辑**: 在 `ticked()` 中，过滤 D3 选择集以仅更新未标记为 `isCulled` 的节点。
  - [x] **机制**: `checkSimulationState` 将屏幕外节点设置为 `isCulled = true`。
  - [x] **好处**: 每帧避免为用户看不到的节点进行数千次昂贵的 DOM 属性更新。

### 2025-12-26 v0.9.31 - 模拟优化 (视口剔除) (Simulation Optimization - Viewport Culling)

**目标**: 通过基于缩放级别和视口可见性最小化粒子运动计算，减少内存和 CPU 消耗。

- [x] **视口剔除逻辑**
  - [x] **全景冻结**: 如果用户缩小到足以看到整个图表（或大部分），自动停止模拟以节省资源，假设布局是稳定的。
  - [x] **屏幕外冻结**: 放大时，仅模拟可见视口内的节点。冻结视口外的节点。
  - [x] **实现**:
    - [x] 添加由缩放事件触发的 `checkSimulationState()`。
    - [x] 基于 `event.transform` 计算可见边界。
    - [x] 更新 `simulation.nodes()` 仅包含可见节点（加上缓冲区）或使用 `fx`/`fy` 锁定屏幕外节点。

### 2025-12-26 v0.9.30 - 专注模式布局隔离 (Focus Mode Layout Isolation)

**目标**: 确保专注模式内发生的布局更改（自动排列或手动拖动）不会影响退出时主界面的节点位置。

- [x] **位置备份与恢复**
  - [x] **备份**: 在 `enterFocusMode` 中，保存所有节点当前的 `x`, `y`, `fx`, 和 `fy` 坐标。
  - [x] **恢复**: 在 `exitFocusMode` 中，将这些坐标恢复到专注前的状态。
  - [x] **一致性**: 确保图表视觉状态完全恢复到进入专注模式之前的样子。

### 2025-12-26 v0.9.29 - 冻结布局持久化 (Freeze Layout Persistence)

**目标**: 修复 "分析与导出"（及其他布局调整）会覆盖 "冻结布局" 状态，导致意外节点移动的 Bug。

- [x] **布局调整逻辑**
  - [x] **行为**: 修改了 `app.js` 中的 `ResizeObserver`，在调用 `simulation.restart()` 之前严格检查 "冻结布局" 复选框状态。
  - [x] **Canvas 同步**: 确保在布局更改期间调用 `resizeCanvas()`，以保持 Canvas 分辨率正确，即使模拟已冻结。
  - [x] **结果**: 打开分析面板或调整窗口大小现在尊重冻结状态，保持节点静止。

### 2025-12-26 v0.9.28 - 专注模式具体内容 (Focus Mode Specific Content Access)

**目标**: 优化用户体验，提供在专注模式下打开特定节点内容的直接方式，避免需要双击。

- [x] **特定内容按钮**
  - [x] **UI**: 在专注模式控制面板 (`#focus-exit-btn`) 中添加了 "打开具体内容" 按钮。
  - [x] **逻辑**: 点击按钮触发 `window.reader.open(focusNode)`，模仿双击专注节点的行为。
  - [x] **本地化**: 添加了英语 ("Open Specific Content") 和中文 ("打开具体内容") 支持。

- [x] **文档**
  - [x] **用户手册**: 更新了专注模式章节。
  - [x] **接口文档**: 更新了专注模式功能。
  - [x] **测试报告**: 添加了新按钮的测试用例。

### 2025-12-26 v0.9.27 - 条件重启 (Conditional Restart)

**目标**: 确保退出专注模式时尊重“冻结布局”状态。

- [x] **冲突解决**
  - [x] **逻辑**: 在 `exitFocusMode` 中，检查是否选中了“冻结布局”。
  - [x] **行为**: 如果选中，调用 `simulation.stop()` 而不是 `restart()`，防止不必要的移动。
  - [x] **视觉**: 手动触发 `ticked()` 以确保图表在其当前位置渲染恢复的节点。

### 2025-12-26 v0.9.26 - UX 增强 (UX Enhancements)

**目标**: 提高移动端可用性并有效引导新用户。

- [x] **冻结布局按钮**
  - [x] **UI**: 在主界面（右上角或控件附近）添加专用的“冻结布局”按钮，以便快速访问，尤其是在移动设备上。
  - [x] **逻辑**: 将按钮链接到现有的模拟冻结功能。与控件中的复选框同步状态。
  - [x] **视觉**: 使用图标（例如 锁定/解锁）指示状态。

- [x] **快速开始手册**
  - [x] **内容**: 创建简明的“如何使用”指南，涵盖：
    - 加载数据
    - 导航（平移/缩放）
    - 专注模式（双击）
    - 检查（点击/悬停）
    - 分析面板
  - [x] **UI**: 实现为模态框，在首次加载时打开（localStorage 检查）或通过“帮助”按钮打开。
  - [x] **本地化**: 支持英语和中文。

- [x] **文档**
  - [x] **接口文档**: 使用新的 UI 元素更新。
  - [x] **README**: 添加更新日志。
  - [x] **测试报告**: 验证新功能。

### 2025-12-25 v0.9.25 - 冻结布局优化 (Freeze Layout Optimization)

**目标**: 通过在请求时严格冻结主图，防止唤醒模拟的用户交互，从而最小化资源使用。

- [x] **冻结布局增强**
  - [x] **行为**: 选中“冻结布局”现在会禁用主界面（SVG 模式）中的节点拖动。
  - [x] **约束**: 此限制*不*适用于专注模式，在该模式下仍允许手动调整。
  - [x] **性能**: 防止拖动事件触发 `simulation.restart()`，确保模拟保持有效停止（0% CPU 使用率）。

- [x] **文档**
  - [x] **接口文档**: 更新模拟控制部分。
  - [x] **README**: 添加更新日志条目。
  - [x] **测试报告**: 验证行为。

### 2025-12-25 v0.9.24 - 专注模式内存优化 (Focus Mode Memory Optimization)

**目标**: 通过在专注模式期间冻结背景节点来减少 SVG 模式下的内存/CPU 开销。

- [x] **模拟优化**
  - [x] **子集化**: 修改 `enterFocusMode` 以过滤 `simulation.nodes()` 和 `simulation.force("link").links()`，仅包含专注子集。
  - [x] **冻结**: 背景节点实际上被冻结，因为它们不再由 D3 力处理。
  - [x] **恢复**: 修改 `exitFocusMode` 以将完整的节点和链接集恢复到模拟中。

- [x] **文档**
  - [x] **接口文档**: 更新优化细节。
  - [x] **README**: 添加更新日志条目。
  - [x] **测试报告**: 验证优化行为。

### 2025-12-25 v0.9.23 - 默认设置调整 (Default Settings Adjustment)

**目标**: 根据用户反馈调整阅读窗口字体大小和模拟阻尼的默认设置。

- [x] **阅读窗口字体大小**
  - [x] **实现**: 修改 `reader.js` 中的 `Reader` 类，默认将 `currentZoom` 设置为 0.5。
  - [x] **逻辑**: 影响打开时的初始化和重置。

- [x] **模拟阻尼**
  - [x] **实现**: 更新 `app.js` 以使用 `.velocityDecay(0.6)` 初始化 `d3.forceSimulation`。
  - [x] **UI**: 更新 `index.html` 滑块默认值并显示文本为 0.6。

### 2025-12-25 v0.9.22 - 移动端弹窗适配 (Mobile Popup Adaptation)

**目标**: 适配节点统计弹窗以支持移动设备的触摸拖动和捏合缩放功能。

- [x] **触摸拖动支持**
  - [x] **实现**: 向 `popupDragHandle` 添加了 `touchstart`, `touchmove`, `touchend` 监听器。
  - [x] **逻辑**: 使用 `touches[0]` 坐标镜像鼠标拖动逻辑。
  - [x] **约束**: 需要单指触摸头部。

- [x] **捏合缩放支持**
  - [x] **实现**: 向 `statsPopup` 添加了 `touchstart`, `touchmove`, `touchend` 监听器。
  - [x] **逻辑**: 计算双指之间的距离 (`Math.hypot`) 以确定缩放比例。
  - [x] **缩放**: 更新 `popupDragState.currentScale` 并应用于 `fontSize`。
  - [x] **限制**: 缩放限制在 0.5x 到 2.0x 之间。

- [x] **文档**
  - [x] **接口文档**: 更新了移动端交互规范。
  - [x] **README**: 添加更新日志条目。
  - [x] **测试报告**: 验证移动端交互。

### 2025-12-25 v0.9.21 - 严格的边可见性与优化 (Strict Edge Visibility & Optimization)

**目标**: 执行严格的边可见性规则（默认隐藏）并优化大图渲染。

- [x] **严格的边可见性**
  - [x] **SVG 模式**: 修改 `app.js` 中的 `updateVisibility`，将默认边不透明度设置为 0（原为 0.15）。
  - [x] **一致性**: 确保 SVG 行为与 Canvas 模式匹配（默认隐藏）。
  - [x] **性能**: 减少初始视图的视觉混乱和渲染成本。

- [x] **文档**
  - [x] **接口文档**: 更新以反映 v0.9.21 中的严格边可见性。
  - [x] **README**: 添加 v0.9.21 更新日志。
  - [x] **测试报告**: 验证 v0.9.21 的行为。

### 2025-12-24 v0.9.20 - 专注进入时自动清除选择状态 (Selection State Auto-Clear on Focus Entry)

**目标**: 通过双击进入专注模式时自动清除任何现有的选择或高亮状态，以实现干净的过渡。

- [x] **自动清除实现**
  - [x] **高亮清除**: 修改 `handleDoubleClick()`，在进入专注模式之前调用 `highlightManager.unhighlight({ force: true })`。
  - [x] **弹窗隐藏**: 进入专注模式时自动隐藏统计弹窗 (`#node-stats-popup`)。
  - [x] **状态管理**: 确保干净的状态转换，没有残留的视觉伪影。

- [x] **用户体验增强**
  - [x] **干净过渡**: 用户始终以原始的专注上下文开始。
  - [x] **视觉清晰度**: 防止正常模式和专注模式之间重叠高亮引起的混淆。
  - [x] **一致行为**: 标准化所有场景下的专注模式进入行为。

- [x] **文档**
  - [x] **接口文档**: 更新了 v0.9.20 选择自动清除规范。
  - [x] **README**: 在中英文中添加了 v0.9.20 更新日志条目。
  - [x] **代码注释**: 解释自动清除逻辑的双语注释。
  - [x] **TODO**: 记录已完成的功能实现。

### 2025-12-24 v0.9.19 - 专注模式与弹窗增强 (Focus Mode & Popup Enhancements)

**目标**: 修复专注模式刷新问题，并为统计弹窗添加拖动/缩放功能，以获得更好的用户体验。

- [x] **专注模式重新进入修复**
  - [x] **双击行为**: 修改了 `handleDoubleClick()`，允许在已处于专注模式时重新进入相关节点的专注模式。
  - [x] **状态重置**: 确保在进入新的专注上下文之前正确重置所有节点可见性标志 (`isFocusVisible`, `fx`, `fy`, `_labelDy`)。
  - [x] **预防**: 移除了阻止在 `enterFocusMode()` 中切换相关节点专注的限制。

- [x] **统计弹窗增强**
  - [x] **拖动功能**: 实现了通过点击和拖动弹窗头部来进行基于鼠标的拖动。
    - [x] **状态跟踪**: 创建 `popupDragState` 来跟踪拖动位置和比例。
    - [x] **事件处理程序**: 添加了 `mousedown`, `mousemove` 和 `mouseup` 监听器用于拖动控制。
    - [x] **视觉反馈**: 为拖动期间的光标反馈添加了 `.dragging` 类。
  - [x] **缩放控制**: 添加了三个缩放按钮 (+, −, ⟲) 来缩放弹窗内容。
    - [x] **缩放范围**: 0.5x 到 2.0x，增量为 0.1。
    - [x] **实现**: 通过 `.popup-content` 上的 `fontSize` CSS 属性应用缩放。
    - [x] **重置功能**: 重置按钮恢复默认大小和比例。
  - [x] **可调整大小**: 启用了 CSS `resize: both` 以支持浏览器原生调整大小功能。
    - [x] **约束**: 设置最小/最大宽度和高度约束。
    - [x] **滚动**: 确保调整大小时内容正确滚动。
  - [x] **位置重置**: 关闭时，弹窗位置重置为默认值（右上角）。
- [x] **文档**
  - [x] **接口文档**: 更新了 v0.9.19 拖动/缩放接口规范。
  - [x] **README**: 在中英文中添加了 v0.9.19 更新日志条目。
  - [x] **双语注释**: 所有新功能的双语代码注释。
  - [x] **CSS**: 记录了可拖动、可缩放和可调整大小弹窗的新样式。

### 2025-12-24 v0.9.18 - 节点高亮系统重构 (Node Highlighting System Refactor)

**目标**: 以模块化架构重构节点高亮逻辑，以提高可维护性和稳健性。

- [x] **模块化架构**
  - [x] **NodeHighlightManager 类**: 创建了具有完整状态管理的专用模块 (`nodeHighlight.js`)。
  - [x] **API 设计**: 实现了清晰的公共 API，包括 `highlight()`, `unhighlight()`, `getState()` 和辅助方法。
  - [x] **集成**: 完全集成到 app.js 中，替换旧的高亮功能。

- [x] **统一交互模型**
  - [x] **PC 支持**: 基于悬停的高亮显示，无需冻结模拟。
  - [x] **移动端支持**: 基于点击的高亮显示，具有模拟冻结功能，以便进行稳定检查。
  - [x] **状态一致性**: 正确跟踪冻结与临时高亮状态。

- [x] **渲染增强**
  - [x] **SVG 模式**: 定向边着色（蓝色=#4488ff 出度，红色=#ff6b6b 入度）与匹配的箭头标记。
  - [x] **Canvas 模式**: 更新为使用 highlightManager 状态以获得一致的视觉行为。
  - [x] **变暗效果**: 未连接的节点在高亮期间变暗至 0.05 不透明度，以获得更清晰的焦点。

- [x] **专注模式集成**
  - [x] **状态感知**: highlightManager 尊重专注模式并且不干扰。
  - [x] **协调**: 专注模式进入/退出正确更新 highlightManager 状态。

- [x] **文档**
  - [x] **双语注释**: 代码中全面的中英文注释。
  - [x] **接口文档**: 更新了完整的 NodeHighlightManager API 参考。
  - [x] **README**: 在两种语言中添加了 v0.9.18 更新日志条目。
  - [x] **集成指南**: 创建了详细的集成说明。

### 2025-12-17 v0.1.0 - 基础与数据结构 (Foundation & Data Structures)

**目标**: 建立独立的项目环境和有向图的核心数据结构，初期独立于特定的笔记应用 API。

- [x] **项目初始化**
  - [x] 在 `NoteConnection` 中初始化一个新的 TypeScript/Node.js 项目。
  - [x] 配置 ESLint, Prettier 和 Jest 用于测试。

- [x] **图核心实现**
  - [x] 实现支持元数据（如 `rank`, `clusterId`）的 `Node` 和 `Edge` 接口。
  - [x] 实现 `Graph` 类，包含方法：`addNode`, `addEdge`, `getNeighbors`, `getIncomingEdges`, `getOutgoingEdges`。

### 2026-01-15 v0.2.0 - 数据摄取与定向解析 (Data Ingestion & Directional Parsing)

**目标**: 从 Markdown 文件中摄取数据，专门解析 Frontmatter 中的定向依赖关系。

- [x] **Markdown 解析服务**
  - [x] 实现文件系统读取器以递归扫描目录。
  - [x] 创建基于正则或 AST 的解析器以提取 YAML Frontmatter。

- [x] **依赖提取**
  - [x] 定义模式：`prerequisites: [[Note A]]`, `next: [[Note B]]`。
  - [x] 将这些元数据字段转换为 `Graph` 对象中的有向边的逻辑。

### 2026-02-01 v0.3.0 - 算法核心 (DAG 逻辑) (Algorithmic Core)

**目标**: 确保图是有效的 DAG 并计算层级布局位置。

- [x] **循环检测与解决**
  - [x] 实现基于 DFS 的循环检测。
  - [x] 策略：向用户报告循环或自动打破循环（控制台警告）。

- [x] **拓扑排序与排名**
  - [x] 实现算法为每个节点分配 `rank` (0, 1, 2...)。
  - [x] 确保没有依赖关系的节点为 Rank 0。
  - [x] 集成 Kahn 算法变体（最长路径分层）。

### 2026-03-01 v0.4.0 - 可视化引擎 (Visualization Engine)

**目标**: 使用分层布局引擎（Sugiyama 风格）在 Web 视图中渲染处理后的图。

- [x] **布局引擎集成**
  - [x] 在 UI 中实现“布局模式”切换（力导向 vs DAG 分层）。
  - [x] 将 `rank` 映射到可视化中的 Y 坐标。

- [x] **Canvas/SVG 渲染**
  - [x] 优化层级结构的渲染。
  - [x] 为依赖关系绘制弯曲的贝塞尔线，以清晰指示流向。

- [x] **专注模式 (Focus Mode - v0.6.2)**
  - [x] **交互式专注**: 点击节点以居中并隔离上下文。
  - [x] **层级布局**: 自动将上级（出度）和下级（入度）排列在分层中。
  - [x] **层内排序**: 按重要性（度数比）对邻居进行排序。
  - [x] **上下文过滤**: 仅显示直接邻居和高相关性节点。
  - [x] **布局优化**:
    - [x] 基于标准（分数）的相对高度定位。
    - [x] 交错标签放置以防止重叠。
    - [x] 修复: 防止在专注模式内切换上下文时节点累积。

### 2026-04-01 v0.5.0 - 可扩展性 (聚类) (Scalability)

**目标**: 通过基于文件结构或语义标签将节点分组为高级聚类，以处理 10,000+ 节点。

- [x] **聚类逻辑**
  - [x] 实现**基于文件夹的聚类**: 解析目录结构（例如 `Physics/Mechanics` -> 聚类 `Mechanics`）。
  - [x] 添加配置策略: 在 `clusterId` 分配的 `标签传播` (当前) 和 `文件夹路径` 之间切换。

- [x] **语义缩放/向下钻取**
  - [x] 在低缩放级别渲染“超级节点”（聚类）（实现为“聚类视图”切换）。
  - [x] 点击聚类时展开显示详细的依赖图（通过过滤器向下钻取）。

### 2026-05-01 v0.6.0 - 混合推断策略 (AI 与统计) (Hybrid Inference Strategy)

**目标**: 结合统计和向量化方法，在缺乏显式元数据的情况下推断依赖关系和关联。

- [x] **基于向量的关联 (Similarity)**
  - [x] 实现嵌入生成（使用本地 TF-IDF VectorSpace）。
  - [x] 使用余弦相似度确定概念之间**关联**（无向关系）的强度。

- [x] **统计依赖推断**
  - [x] 计算笔记语料库中的**共现频率**和**条件概率** ($P(B|A)$)。
  - [x] 假设：如果 A 经常出现在 B 之前或在定义 B 的上下文中，则 A 可能是依赖项。

- [x] **混合判断引擎 (Hybrid Judgment Engine - v0.6.5)**
  - [x] 结合向量相似度（用于相关性）+ 统计概率（用于方向）。
  - [x] 规则：如果 `Similarity(A, B) > Threshold` 且 `P(B|A) >> P(A|B)`，则建议边 `A -> B`。

- [ ] **AI 推断服务 (LLM 验证)**
  - 使用 LLM 验证来自混合引擎的高置信度候选项。
  - 任务：“给定统计证据，确认 A 是否为 B 的先决条件。”

### 2025-12-22 v0.8.5 - 动态数据源与服务器 (Dynamic Data Source & Server)

**目标**: 支持动态选择知识库文件夹和独立服务器部署。

- [x] **动态路径选择**
  - [x] 后端: 支持 `Knowledge_Base` 下的可变输入路径。
  - [x] 服务器: 实现用于 API (`/api/folders`, `/api/build`) 和静态服务的 `http` 服务器。
  - [x] 前端: 添加 UI 以列出和选择知识库文件夹。

### 2025-12-24 v0.9.17 - SVG 视觉完整性 (SVG Visual Completeness)

**目标**: 完成 SVG 模式交互的视觉反馈循环。

- [x] **SVG 渲染器**
  - [x] **彩色标记**: 实现了动态标记切换（红/蓝箭头），以匹配高亮期间的边颜色。
  - [x] **视觉一致性**: 确保清除高亮时箭头恢复为灰色。

### 2025-12-24 v0.9.16 - 交互完整性 (Interaction Completeness)

**目标**: 确保检查期间节点关系的完整可视化。

- [x] **交互逻辑**
  - [x] **始终开启的上下文**: 点击节点现在强制显示*所有*入度和出度关系，覆盖任何活动的“仅入度”或“仅出度”过滤器，以确保可见完整的上下文。
- [x] **Canvas 渲染器**
  - [x] **视觉对等**: 在 Canvas 引擎中为高亮边实现了加粗线条渲染 (2.5px 宽度)，以匹配 SVG 样式。

### 2025-12-23 v0.8.6 - 性能优化 (并行处理) (Performance Optimization)

**目标**: 优化大数据集 (>10,000 节点) 的图构建过程，以缩短构建时间。

- [x] **并行图构建**
  - [x] **Worker 线程**: 将密集的关键词匹配任务分流到多个 CPU 核心。
  - [x] **异步 I/O**: 重构 `FileLoader` 使用异步批量处理以防止 `EMFILE` 错误。
  - [x] **稳健性**: 实现 Worker 失败时的顺序处理回退机制。

### 2025-12-23 v0.8.7 - 可扩展性与用户体验打磨 (Scalability & UX Polish)

**目标**: 解决渲染瓶颈并改进大图的布局控制。

- [x] **高容量处理**
  - [x] **Worker 扩展**: 将线程限制增加到 12。
- [x] **Canvas 渲染**
  - [x] **双引擎**: 实现了 Canvas 渲染器，用于 10k+ 节点的高性能绘制。
- [x] **专注模式 UX**
  - [x] **间距控制**: 添加了 UI 滑块以调整节点层间距。

### 2025-12-23 v0.8.8 - 可扩展性默认值与高级布局 (Scalability Defaults & Advanced Layout)

**目标**: 优化大规模图谱的默认视图并完善专注模式布局。

- [x] **可扩展性默认值**
  - [x] **减少杂乱**: 默认隐藏边和孤立节点。
  - [x] **按需上下文**: 仅在悬停或专注时显示关系。
- [x] **专注模式增强**
  - [x] **水平间距**: 添加了水平节点分隔控制以防止重叠。

### 2025-12-23 v0.8.9 - 稳定性改进 (Stability Improvements)

**目标**: 增强观察稳定性。

- [x] **交互稳定性**
  - [x] **冻结**: 防止在专注模式下选择或拖动时节点漂移。

### 2025-12-23 v0.9.0 - 精确控制与稳定性 (Precise Control & Stability)

**目标**: 提供用于手动布局控制和稳定检查的工具。

- [x] **悬停逻辑**
  - [x] **自动冻结**: 悬停时锁定节点位置以便于检查。
- [x] **模拟 UX**
  - [x] **控制**: 添加速度滑块和冻结布局切换。
  - [x] **手动放置**: 允许在布局冻结时手动定位节点而不自动恢复。

### 2025-12-23 v0.9.1 - 移动端转换 (Mobile Transformation)

**目标**: 将当前的 Web 项目转换为 Android APK 应用程序。

- [x] **Capacitor 集成**
  - [x] **初始化**: 配置了 `capacitor.config.ts`。
  - [x] **平台支持**: 通过 `@capacitor/android` 添加了 Android 平台。
  - [x] **资源管理**: 实现了 `copy-assets` 脚本和 `npx cap sync`。
  - [x] **构建流水线**: 验证了 Gradle 构建配置 (`assembleDebug`)。

### 2025-12-23 v0.9.2 - 移动端 UI 优化 (Mobile UI Optimization)

**目标**: 针对小触摸屏优化 UI/UX。

- [x] **响应式控件**
  - [x] **折叠菜单**: 主控件在移动端折叠为按钮以节省空间。
  - [x] **专注模式 UI**: 将“退出专注”按钮移至底部中央以便操作。
  - [x] **设置合并**: 将语言选择器移入设置模态框以净化界面。
- [x] **触摸交互**
  - [x] **捏合缩放**: 阅读窗口添加了多点触控支持以缩放文本。
  - [x] **触摸目标**: 增大了按钮和输入框以提高触摸精度。

### 2025-12-23 v0.9.3 - 移动端交互迭代 (Mobile Interaction Iteration)

**目标**: 改进移动端可用性的交互逻辑。

- [x] **交互逻辑更新**
  - [x] **单击**: 触发节点高亮和提示框（显示入/出度）。
  - [x] **双击**: 触发进入专注模式。
  - [x] **桌面兼容性**: 保留了桌面的 `mouseover` 悬停，同时统一了点击逻辑。

### 2025-12-23 v0.9.4 - Mermaid 图片优化 (Mermaid Image Optimization)

**目标**: 增强移动设备上的图表阅读体验。

- [x] **Mermaid 缩放模式**
  - [x] **交互**: 点击 Mermaid 图表打开全屏覆盖层。
  - [x] **手势**: 在覆盖层内实现了平移 (拖动) 和缩放 (捏合/滚轮) 逻辑。
  - [x] **UX**: 添加了显眼的退出按钮以关闭缩放模式。

### 2025-12-24 v0.9.5 - 移动体验优化与专注语义 (Refined Mobile Experience & Focus Semantics)

**目标**: 打磨移动端和复杂图谱的交互细节与视觉清晰度。

- [x] **专注模式增强**
  - [x] **居中**: 视口自动以焦点节点的原始位置为中心。
  - [x] **语义**: 添加了清晰的区域标签 ("Helping to understand", "Further exploration")。
  - [x] **布局**: 实现了 "层级 (从左到右)" 布局选项。
- [x] **分析面板**
  - [x] **移动端**: 面板现在可滚动并适配触摸屏。
  - [x] **交互**: 点击行会在图表中高亮显示节点及其连接。
- [x] **视觉打磨**
  - [x] **Mermaid**: 增强了浅色图表的文本可见性（阴影/描边）。
  - [x] **连线**: 确保边默认隐藏，仅在交互时可见。

### 2025-12-24 v0.9.6 - 分析与视觉打磨 (Analysis & Visuals Polish)

**目标**: 进一步完善分析面板的移动端可用性并修复视觉不一致。

- [x] **Mermaid 缩放样式**
  - [x] **修复**: 确保 Mermaid 文本阴影/灰度在全屏缩放模式下持久保留。
- [x] **度数分析移动端**
  - [x] **全屏**: 添加了在半高和全屏之间切换面板的开关。
  - [x] **缩放**: 为面板内容实现了捏合缩放。
  - [x] **交互**: 验证了点击高亮逻辑在各视图中均有效。
- [x] **图表交互**
  - [x] **稳健性**: 添加了背景点击处理程序以清除高亮。

### 2025-12-24 v0.9.7 - 专注模式交互修复 (Focus Mode Interaction Fix)

**目标**: 修复专注模式下的可用性 Bug。

- [x] **布局切换**
  - [x] **修复**: 在 "水平" 和 "垂直" 布局之间切换现在会立即刷新图表，无需调整滑块。

### 2025-12-24 v0.9.8 - 分析交互完善 (Analysis Interaction Refinement)

**目标**: 确保分析面板与图表之间的无缝交互。

- [x] **图表同步**
  - [x] **提示框**: 点击分析面板中的节点现在会在图表上节点的位置显示提示框（统计数据）。
- [x] **移动端 UX**
  - [x] **滚动**: 修复了分析面板中的滚动行为以防止冲突。

### 2025-12-24 v0.9.9 - 移动端分析面板打磨 (Mobile Analysis Panel Polish)

**目标**: 增强“度数分析”页面的移动端可用性，增加手势控制。

- [x] **移动端适配**
  - [x] **滑动操作**: 实现了通过触摸拖动面板头部的“上下滑动”功能。
  - [x] **全屏**: 支持在浮动窗口和全屏页面之间切换，并具有拖动自动吸附功能。
  - [x] **缩放**: 验证了界面的双指捏合缩放支持。
- [x] **交互验证**
  - [x] **节点点击**: 验证了点击面板中的节点会在图表中显示入度和出度关系。

### 2025-12-24 v0.9.10 - 交互完善 (点击冻结) (Interaction Refinement)

**目标**: 通过在点击节点时冻结模拟来提高图表检查的稳定性。

- [x] **点击交互**
  - [x] **点击冻结**: 点击节点现在会立即停止力导向模拟（冻结所有节点），以防止检查期间的移动。
  - [x] **取消恢复**: 点击背景（空白区域）会取消高亮并恢复模拟（除非手动冻结）。
  - [x] **可视化**: 确保在冻结时清晰显示入度和出度连线。

### 2025-12-24 v0.9.11 - 节点统计与本地化 (Node Statistics & Localization)

**目标**: 增强节点的详细检查功能并完成国际化。

- [x] **专注模式本地化**
  - [x] **多语言**: 实现了 `t()` 调用以支持语义标签 ("帮助理解" / "进一步探索")。
- [x] **节点统计面板**
  - [x] **交互**: 点击节点打开一个专用面板显示关系。
  - [x] **视觉**: 入度连线为红色，出度连线为蓝色 (#4488ff)。
  - [x] **内容**: 面板列出所有入度和出度邻居，并支持导航。

### 2025-12-24 v0.9.12 - 独立统计弹窗 (Independent Statistics Popup)

**目标**: 将节点检查与全局分析分离，以获得更好的用户体验。

- [x] **浮动统计窗口**
  - [x] **交互**: 点击节点打开一个浮动弹窗，显示入/出度。
  - [x] **视觉**: 明显的红色 (入) 和蓝色 (出) 指示器。
  - [x] **独立性**: 不干扰主度数分析面板。

### 2025-12-24 v0.9.13 - 专注模式隔离 (Focus Mode Isolation)

**目标**: 确保特定的交互效果不会渗入专注模式。

- [x] **交互完善**
  - [x] **约束**: 验证在专注模式下点击节点*不*会触发浮动统计弹窗或更改高亮样式，从而保留特定的专注模式上下文。

### 2025-12-24 v0.9.14 - 视觉与数据修复 (Visual & Data Fixes)

**目标**: 修复边方向的可视化和数据重复问题。

- [x] **边高亮**
  - [x] **Canvas 支持**: 在 Canvas 渲染器 (`renderCanvas`) 中实现了红色 (入) 和蓝色 (出) 边着色，此前为通用的灰色。
- [x] **数据完整性**
  - [x] **去重**: 使用 `Set` 防止统计弹窗邻居列表中出现重复的节点条目。

### 2025-12-24 v0.9.15 - 增强隔离 (Enhanced Isolation)

**目标**: 通过有效隐藏检查期间的不相关上下文来优化视觉焦点。

- [x] **视觉优化**
  - [x] **深度变暗**: 将不相关节点的不透明度从 0.1 降低到 0.05，以更好地满足“暂时隐藏”的要求，同时保持最小的上下文。
  - [x] **边强调**: 将高亮边的宽度增加到 2.5px，以便更清晰地区分红色/蓝色。

### 2026-06-01 v1.0.0 - 正式版本发布 (Production Release)

**目标**: 完成与 Joplin/Obsidian 插件的集成，并打磨整体用户体验。

- [x] **插件封装**
  - [x] 将 `NoteConnection` 核心逻辑封装为 Joplin 插件与 Obsidian 插件。（API 在 v0.9.53 已就绪）

- [x] **用户设置与文档体系 (v0.7.0)**
  - [x] **设置管理器**: 统一管理应用状态（Physics / Visuals），并通过 `localStorage` 持久化。
  - [x] **配置界面**: 提供 Settings Modal，用于调节图谱物理参数（Gravity、Repulsion）与视觉偏好。
  - [x] **阅读窗口 (v0.8.0)**
    - [x] **触发方式**: 点击焦点节点打开。
    - [x] **内容渲染**: 支持 Markdown、KaTeX（数学公式）、Mermaid（图表）。
    - [x] **交互能力**: 支持文本缩放与图片尺寸调整（Unlocked 模式）。
    - [x] **窗口控制**: 支持窗口/全屏切换。
  - [x] **文档收口**: 完成 User Manual 与 Developer Guide。
  - [x] **发布打磨与演示封装**: 确保零配置启动（`npm start`）可无缝用于演示与推广。
  - [x] **发布**: 完成 v1.0.0 打包发布。

# 框架架构与设计目标

## 1. 混合可视化架构

- **桌面端 (Godot)**: 使用 Godot 4.3 + Vulkan 提供高保真 3D 渲染（粒子、Bloom、物理效果），通过 WebSocket（9876）通信。
- **Web 端 (Canvas/WebGL)**: 为 Android、浏览器与非 GPU 环境提供高性能回退路径。
- **回退策略**:
  1. 优先尝试连接 Godot WebSocket。
  2. 失败后回退到 WebGL/Canvas（Path Mode / 大图）。
  3. 小图与高交互场景再回退到 SVG。

## 2. Path Mode 体验设计

- **核心隐喻**: “轨道学习 (Orbital Learning)”。
- **中心节点**: 当前学习目标，显示为大且高亮的主气泡。
- **外围节点**: 上下文依赖，显示为较小环绕卫星。
- **进度追踪**: 已完成节点收缩为“金色星标”并进入历史列表。
- **交互模型**:
  - **双击中心节点**: 打开 Reader 查看内容。
  - **双击外围节点**: 轨道切换并提升为新中心。

## 3. UI 布局与模式切换

- **无缝切换**: 在“图谱模式 (Force/DAG)”与“Path Mode (Orbital)”之间切换时保留数据上下文，同时切换渲染引擎/Worker。
- **状态持久化**: 学习历史与已完成状态通过 `localStorage` 跨会话保存。
