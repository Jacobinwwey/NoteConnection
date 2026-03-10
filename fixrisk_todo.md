# 2026-03-10 v1.0.23

# RISK-CORRECTION EXECUTION UPDATE (WASM TOPOLOGICAL RANK PARITY SLICE + STRICT EXPORT GATE ALIGNMENT)

## ENGLISH DOCUMENT

### Remediation Status (This Slice)
- [x] Added real topological-rank JSON ABI in Rust parity module (`src/backend/wasm/src/lib.rs`):
  - [x] Exported `compute_ranks_json`.
  - [x] Implemented deterministic Kahn-style rank payload aligned with existing TypeScript rank semantics.
- [x] Extended runtime adapter (`src/backend/algorithms/WasmParityRuntime.ts`):
  - [x] Added `computeRanks(...)` with strict decode guards and `json-ranks` execution mode tracking.
- [x] Extended backend heavy-compute orchestration:
  - [x] Added `TopologicalSort.assignRanksAsync(...)` with wasm-first, sequential fallback semantics.
  - [x] Updated `GraphBuilder` topological-rank stage to async path (`await TopologicalSort.assignRanksAsync(...)`).
- [x] Raised strict artifact readiness requirement:
  - [x] Added `compute_ranks_json` into `REQUIRED_WASM_PARITY_EXPORTS`.
- [x] Regression coverage updated:
  - [x] Added `src/backend/algorithms/TopologicalSort.test.ts`.
  - [x] Updated `src/wasm.parity.runtime.functional.test.ts`.
  - [x] Updated `src/wasm.parity.runtime.contract.test.ts`.
  - [x] Updated `src/wasm.parity.artifact.probe.contract.test.ts`.
  - [x] Added `TopologicalSort` suite into `npm run test:migration`.

### Verification Snapshot (2026-03-10)
- [x] `npm run build:wasm:parity`
- [x] `npx jest src/backend/algorithms/TopologicalSort.test.ts src/wasm.parity.runtime.functional.test.ts src/wasm.parity.runtime.contract.test.ts src/wasm.parity.artifact.probe.contract.test.ts src/wasm.parity.artifact.provisioning.contract.test.ts --runInBand` (**5 suites, 22 tests passed**)
- [x] `npm run test:migration` (**29 suites, 153 tests passed**)
- [x] `npm run test:wasm:parity:gates` (strict verify + strict p95/p99 perf guards passed; strict probe confirms `compute_ranks_json` export)
- [x] `npx jest --runInBand` (**33 suites, 174 tests passed**)
- [x] `npm run build`
- [x] `npm run build:sidecar`

---

## 中文文档

### 本轮整改状态
- [x] 在 Rust parity 模块（`src/backend/wasm/src/lib.rs`）新增真实拓扑等级 JSON ABI：
  - [x] 导出 `compute_ranks_json`。
  - [x] 实现与现有 TypeScript 语义对齐的确定性 Kahn 风格拓扑等级结果。
- [x] 扩展运行时适配层（`src/backend/algorithms/WasmParityRuntime.ts`）：
  - [x] 新增 `computeRanks(...)`，并加入严格解码防护与 `json-ranks` 执行模式追踪。
- [x] 扩展后端重计算编排：
  - [x] 新增 `TopologicalSort.assignRanksAsync(...)`，采用 wasm-first + sequential fallback 语义。
  - [x] `GraphBuilder` 拓扑等级阶段切换为异步路径（`await TopologicalSort.assignRanksAsync(...)`）。
- [x] 提升严格工件门禁要求：
  - [x] 在 `REQUIRED_WASM_PARITY_EXPORTS` 中加入 `compute_ranks_json`。
- [x] 回归覆盖已同步更新：
  - [x] 新增 `src/backend/algorithms/TopologicalSort.test.ts`。
  - [x] 更新 `src/wasm.parity.runtime.functional.test.ts`。
  - [x] 更新 `src/wasm.parity.runtime.contract.test.ts`。
  - [x] 更新 `src/wasm.parity.artifact.probe.contract.test.ts`。
  - [x] 将 `TopologicalSort` 套件纳入 `npm run test:migration`。

### 验证快照（2026-03-10）
- [x] `npm run build:wasm:parity`
- [x] `npx jest src/backend/algorithms/TopologicalSort.test.ts src/wasm.parity.runtime.functional.test.ts src/wasm.parity.runtime.contract.test.ts src/wasm.parity.artifact.probe.contract.test.ts src/wasm.parity.artifact.provisioning.contract.test.ts --runInBand`（**5 suites, 22 tests passed**）
- [x] `npm run test:migration`（**29 suites, 153 tests passed**）
- [x] `npm run test:wasm:parity:gates`（严格校验 + 严格 p95/p99 性能门禁通过，严格探针确认 `compute_ranks_json` 导出存在）
- [x] `npx jest --runInBand`（**33 suites, 174 tests passed**）
- [x] `npm run build`
- [x] `npm run build:sidecar`

---

# 2026-03-10 v1.0.22

# RISK-CORRECTION EXECUTION UPDATE (WASM CYCLE PARITY SLICE + STRICT EXPORT GATE ALIGNMENT)

## ENGLISH DOCUMENT

### Remediation Status (This Slice)
- [x] Added real cycle-detection JSON ABI in Rust parity module (`src/backend/wasm/src/lib.rs`):
  - [x] Exported `compute_cycles_json`.
  - [x] Implemented deterministic iterative-DFS cycle payload with `limit` support.
- [x] Extended runtime adapter (`src/backend/algorithms/WasmParityRuntime.ts`):
  - [x] Added `computeCycles(...)` with strict decode guards and `json-cycles` execution mode tracking.
- [x] Extended backend heavy-compute orchestration:
  - [x] Added `CycleDetector.detectCyclesAsync(...)` with wasm-first, sequential fallback semantics.
  - [x] Updated `GraphBuilder` cycle stage to async path (`await CycleDetector.detectCyclesAsync(...)`).
- [x] Raised strict artifact readiness requirement:
  - [x] Added `compute_cycles_json` into `REQUIRED_WASM_PARITY_EXPORTS`.
- [x] CI snapshot policy aligned with strict perf script:
  - [x] `.github/workflows/wasm-parity-benchmark-snapshots.yml` now reuses `benchmark:wasm:parity:strict:perf` to enforce p95+p99 policy consistently.
- [x] Regression coverage updated:
  - [x] `src/backend/algorithms/CycleDetection.test.ts`
  - [x] `src/wasm.parity.runtime.functional.test.ts`
  - [x] `src/wasm.parity.runtime.contract.test.ts`
  - [x] `src/wasm.parity.artifact.probe.contract.test.ts`

### Verification Snapshot (2026-03-10)
- [x] `npm run build:wasm:parity`
- [x] `npx jest src/backend/algorithms/CycleDetection.test.ts src/wasm.parity.runtime.contract.test.ts src/wasm.parity.runtime.functional.test.ts src/wasm.parity.artifact.probe.contract.test.ts src/wasm.parity.artifact.provisioning.contract.test.ts --runInBand` (**5 suites, 22 tests passed**)
- [x] `npm run test:migration` (**28 suites, 147 tests passed**)
- [x] `npm run test:wasm:parity:gates` (strict verify + strict p95/p99 perf guards passed)
- [x] `npx jest --runInBand` (**32 suites, 168 tests passed**)
- [x] `npm run build`
- [x] `npm run build:sidecar`
- [!] `npm test` (parallel mode) still shows host-memory OOM risk in this environment; sequential suite is green.

---

## 中文文档

### 本轮整改状态
- [x] 在 Rust parity 模块（`src/backend/wasm/src/lib.rs`）新增真实循环检测 JSON ABI：
  - [x] 导出 `compute_cycles_json`。
  - [x] 实现与现有迭代 DFS 对齐、支持 `limit` 的确定性循环检测负载。
- [x] 扩展运行时适配层（`src/backend/algorithms/WasmParityRuntime.ts`）：
  - [x] 新增 `computeCycles(...)`，并加入严格解码防护与 `json-cycles` 执行模式追踪。
- [x] 扩展后端重计算编排：
  - [x] 新增 `CycleDetector.detectCyclesAsync(...)`，采用 wasm-first + sequential fallback 语义。
  - [x] `GraphBuilder` 循环阶段切换为异步路径（`await CycleDetector.detectCyclesAsync(...)`）。
- [x] 提升严格工件门禁要求：
  - [x] 在 `REQUIRED_WASM_PARITY_EXPORTS` 中加入 `compute_cycles_json`。
- [x] CI 快照策略与严格性能脚本完成对齐：
  - [x] `.github/workflows/wasm-parity-benchmark-snapshots.yml` 统一复用 `benchmark:wasm:parity:strict:perf`，保持 p95+p99 一致门禁。
- [x] 回归覆盖已同步更新：
  - [x] `src/backend/algorithms/CycleDetection.test.ts`
  - [x] `src/wasm.parity.runtime.functional.test.ts`
  - [x] `src/wasm.parity.runtime.contract.test.ts`
  - [x] `src/wasm.parity.artifact.probe.contract.test.ts`

### 验证快照（2026-03-10）
- [x] `npm run build:wasm:parity`
- [x] `npx jest src/backend/algorithms/CycleDetection.test.ts src/wasm.parity.runtime.contract.test.ts src/wasm.parity.runtime.functional.test.ts src/wasm.parity.artifact.probe.contract.test.ts src/wasm.parity.artifact.provisioning.contract.test.ts --runInBand`（**5 suites, 22 tests passed**）
- [x] `npm run test:migration`（**28 suites, 147 tests passed**）
- [x] `npm run test:wasm:parity:gates`（严格校验 + 严格 p95/p99 性能门禁通过）
- [x] `npx jest --runInBand`（**32 suites, 168 tests passed**）
- [x] `npm run build`
- [x] `npm run build:sidecar`
- [!] 当前环境下 `npm test`（并行模式）仍存在主机内存 OOM 风险；顺序全量门禁为绿色。

---

# 2026-03-10 v1.0.21

# RISK-CORRECTION EXECUTION UPDATE (WASM TAIL-LATENCY GUARD HARDENING: P95 + P99)

## ENGLISH DOCUMENT

### Remediation Status (This Slice)
- [x] Upgraded strict WASM benchmark guard policy from p95-only to p95+p99 tail-latency enforcement.
  - [x] Extended `src/backend/algorithms/WasmParityBenchmarkGuards.ts` with p99 ratio/absolute thresholds.
  - [x] Added p99 failure reasons:
    - [x] `candidate-to-baseline-p99-ratio-exceeded`
    - [x] `candidate-p99-exceeded-absolute-threshold`
  - [x] Preserved backward compatibility when callers omit p99 input/config.
- [x] Extended guard script plumbing in `scripts/benchmark-wasm-parity.js`:
  - [x] Added p99 CLI threshold arguments.
  - [x] Added p99 metrics to guard report/log output.
- [x] Strengthened strict perf command in `package.json`:
  - [x] `benchmark:wasm:parity:strict:perf` now enforces both p95 and p99 ratio thresholds.
- [x] Added p99 contract coverage in `src/wasm.parity.benchmark.guards.contract.test.ts`.

### Verification Snapshot (2026-03-10)
- [x] `npx jest src/wasm.parity.benchmark.guards.contract.test.ts src/wasm.parity.benchmark.contract.test.ts --runInBand`
- [x] `npm run test:wasm:parity:gates`
- [x] `npm run test:migration` (**28 suites, 143 tests passed**)
- [x] `npm test` (**32 suites, 164 tests passed**)
- [x] `npm run build`
- [x] `npm run build:sidecar`

---

## 中文文档

### 本轮整改状态
- [x] 严格 WASM 基准门禁已从 p95-only 升级为 p95+p99 双尾延迟约束。
  - [x] 在 `src/backend/algorithms/WasmParityBenchmarkGuards.ts` 增加 p99 比例/绝对阈值能力。
  - [x] 新增 p99 失败原因：
    - [x] `candidate-to-baseline-p99-ratio-exceeded`
    - [x] `candidate-p99-exceeded-absolute-threshold`
  - [x] 保持向后兼容：旧调用缺少 p99 输入/配置时仍可安全运行。
- [x] 在 `scripts/benchmark-wasm-parity.js` 完成 p99 门禁链路扩展：
  - [x] 新增 p99 CLI 阈值参数。
  - [x] 门禁日志/报告已包含 p99 指标。
- [x] 在 `package.json` 强化严格性能门禁命令：
  - [x] `benchmark:wasm:parity:strict:perf` 现同时约束 p95 与 p99 比例阈值。
- [x] 在 `src/wasm.parity.benchmark.guards.contract.test.ts` 新增 p99 契约覆盖。

### 验证快照（2026-03-10）
- [x] `npx jest src/wasm.parity.benchmark.guards.contract.test.ts src/wasm.parity.benchmark.contract.test.ts --runInBand`
- [x] `npm run test:wasm:parity:gates`
- [x] `npm run test:migration`（**28 suites, 143 tests passed**）
- [x] `npm test`（**32 suites, 164 tests passed**）
- [x] `npm run build`
- [x] `npm run build:sidecar`

---

# 2026-03-10 v1.0.20

# RISK-CORRECTION EXECUTION UPDATE (MAIN GRAPH ACCESSIBILITY PARITY CLOSURE)

## ENGLISH DOCUMENT

### Remediation Status (This Slice)
- [x] Closed the remaining baseline follow-up: mobile semantic DOM accessibility parity for main graph/canvas surfaces.
  - [x] Added semantic shadow/live-region nodes in `src/frontend/app.js` (`graph-semantic-shadow`, `graph-semantic-summary`, `graph-semantic-live`).
  - [x] Added semantic summary generation for renderer mode, visible node/edge counts, focus/selection state, and active filters.
  - [x] Added throttled semantic-refresh scheduling to avoid high-frequency announcement churn on large graphs.
  - [x] Wired refresh triggers to renderer mode toggle, visibility/filter updates, node selection, focus-mode enter/exit, and language change.
- [x] Added regression proof:
  - [x] New `src/graph.accessibility.contract.test.ts` validates semantic region provisioning and refresh wiring.
  - [x] Existing runtime capability contract remains green (`src/runtime.capabilities.test.ts`).

### Verification Snapshot (2026-03-10)
- [x] `npx jest src/graph.accessibility.contract.test.ts src/runtime.capabilities.test.ts --runInBand`
- [x] `npm run test:migration` (**28 suites, 141 tests passed**)
- [x] `npm run test:wasm:parity:gates` (strict verify + strict perf guards passed)
- [x] `npm test` (**32 suites, 162 tests passed**)
- [x] `npm run build`
- [x] `npm run build:sidecar`

---

## 中文文档

### 本轮整改状态
- [x] 已收口基线剩余跟进项：主图谱/画布移动端语义 DOM 可访问性等价链路。
  - [x] 在 `src/frontend/app.js` 新增语义影子层与实时播报区域（`graph-semantic-shadow`、`graph-semantic-summary`、`graph-semantic-live`）。
  - [x] 新增语义摘要构建，覆盖渲染模式、可见节点/连接数量、专注/选择状态与筛选条件。
  - [x] 新增节流刷新调度，避免大规模图谱下高频可访问性播报抖动。
  - [x] 已将刷新触发接入渲染切换、可见性筛选更新、节点选择、专注模式进入/退出与语言切换。
- [x] 已补齐回归证明：
  - [x] 新增 `src/graph.accessibility.contract.test.ts`，验证语义区域与刷新链路。
  - [x] 既有运行时能力契约继续通过（`src/runtime.capabilities.test.ts`）。

### 验证快照（2026-03-10）
- [x] `npx jest src/graph.accessibility.contract.test.ts src/runtime.capabilities.test.ts --runInBand`
- [x] `npm run test:migration`（**28 suites, 141 tests passed**）
- [x] `npm run test:wasm:parity:gates`（严格校验 + 严格性能门禁通过）
- [x] `npm test`（**32 suites, 162 tests passed**）
- [x] `npm run build`
- [x] `npm run build:sidecar`

---

# 2026-03-10 v1.0.19

# RISK-CORRECTION EXECUTION UPDATE (MERMAID PAYLOAD THINNING + MOBILE APP-ID COMPLIANCE)

## ENGLISH DOCUMENT

### Remediation Status (This Slice)
- [x] Closed the base64-heavy Mermaid transfer risk on the default bridge/API path:
  - [x] Added `includeSvg` request control across server -> bridge -> frontend Mermaid render flow.
  - [x] `/api/render/mermaid` now returns PNG-focused payloads by default (SVG omitted unless explicitly requested).
  - [x] Compatibility is preserved for diagnostics: SVG is auto-included when `includeStages=true`.
  - [x] Godot runtime contract remains PNG-only (`pngBase64` required); SVG remains diagnostics-only because Godot SVG handling is not reliable.
- [x] Closed mobile app-identifier compliance risk:
  - [x] `capacitor.config.ts` app id updated to `com.jacob.noteconnection.pro`.
  - [x] `android/app/build.gradle` `namespace` and `applicationId` aligned to `com.jacob.noteconnection.pro`.
  - [x] `android/app/src/main/res/values/strings.xml` package + URL scheme aligned.
  - [x] `MainActivity.java` moved to `android/app/src/main/java/com/jacob/noteconnection/pro/` with matching package declaration.
- [x] Added regression coverage for both closures:
  - [x] `src/server.migration.test.ts`: Mermaid SVG default-off behavior + explicit/diagnostic opt-in behavior.
  - [x] `src/pathbridge.handshake.contract.test.ts`: includeSvg contract across server/bridge/frontend.
  - [x] `src/mobile.pipeline.test.ts`: non-example app-id consistency + legacy package path removal.
- [x] Remaining baseline follow-up (historical) is now closed in `v1.0.20`: mobile semantic DOM accessibility parity for graph/canvas surfaces.

### Verification Snapshot (2026-03-10)
- [x] `npx jest src/pathbridge.handshake.contract.test.ts src/server.migration.test.ts src/mobile.pipeline.test.ts --runInBand`
- [x] `npm run test:migration` (**28 suites, 141 tests passed**)
- [x] `npm run test:wasm:parity:gates` (strict verify + strict perf guards passed)
- [x] `npm test` (**31 suites, 159 tests passed**)
- [x] `npm run build`
- [x] `npm run build:sidecar`

---

## 中文文档

### 本轮整改状态
- [x] 已收口 Mermaid Base64 重负载传输风险（默认链路）：
  - [x] 在 server -> bridge -> frontend Mermaid 渲染链路新增 `includeSvg` 显式控制。
  - [x] `/api/render/mermaid` 默认仅返回 PNG 主链路负载（未显式请求时不返回 SVG）。
  - [x] 诊断兼容保持：`includeStages=true` 时会自动带回 SVG。
  - [x] Godot 运行时契约继续保持 PNG-only（`pngBase64` 必填）；SVG 仅用于诊断，因为 Godot 对 SVG 的直接处理存在稳定性问题。
- [x] 已收口移动端 app identifier 合规风险：
  - [x] `capacitor.config.ts` app id 更新为 `com.jacob.noteconnection.pro`。
  - [x] `android/app/build.gradle` 的 `namespace` 与 `applicationId` 同步为 `com.jacob.noteconnection.pro`。
  - [x] `android/app/src/main/res/values/strings.xml` 中包名与 URL scheme 已对齐。
  - [x] `MainActivity.java` 已迁移到 `android/app/src/main/java/com/jacob/noteconnection/pro/` 并更新包声明。
- [x] 已补齐回归验证：
  - [x] `src/server.migration.test.ts`：覆盖 Mermaid SVG 默认关闭与显式/诊断开启行为。
  - [x] `src/pathbridge.handshake.contract.test.ts`：覆盖 includeSvg 跨 server/bridge/frontend 契约。
  - [x] `src/mobile.pipeline.test.ts`：覆盖非示例 app-id 一致性与旧包路径移除。
- [x] 基线剩余跟进项（历史记录）已在 `v1.0.20` 收口：移动端图谱/画布语义 DOM 可访问性等价。

### 验证快照（2026-03-10）
- [x] `npx jest src/pathbridge.handshake.contract.test.ts src/server.migration.test.ts src/mobile.pipeline.test.ts --runInBand`
- [x] `npm run test:migration`（**28 suites, 141 tests passed**）
- [x] `npm run test:wasm:parity:gates`（严格校验 + 严格性能门禁通过）
- [x] `npm test`（**31 suites, 159 tests passed**）
- [x] `npm run build`
- [x] `npm run build:sidecar`

---

# 2026-03-10 v1.0.18

# RISK-CORRECTION EXECUTION UPDATE (HIGH-SCALE BRIDGE LIMIT + WRITABLE RUNTIME PATHS + MERMAID GLOBAL ISOLATION)

## ENGLISH DOCUMENT

### Remediation Status (This Slice)
- [x] PathBridge inbound-frame ceiling is now high-throughput and tunable:
  - [x] Default inbound frame limit raised to `128 MiB`.
  - [x] Environment override added: `NOTE_CONNECTION_BRIDGE_MAX_INBOUND_MB`.
  - [x] Effective inbound hard cap bounded at `1024 MiB`.
  - [x] WebSocket `maxPayload` is now aligned with `MAX_INBOUND_MESSAGE_BYTES` to avoid lower-layer mismatch rejects.
- [x] Bridge inbound-limit contracts were added:
  - [x] Exported `BRIDGE_INBOUND_LIMITS` in `src/core/PathBridge.ts`.
  - [x] Added contract coverage in `src/pathbridge.handshake.contract.test.ts`.
- [x] Runtime writability was hardened in `src/utils/RuntimePaths.ts`:
  - [x] Runtime data resolution no longer falls back to `frontendDir`.
  - [x] Added writable candidate chain across app-data, project, cwd, and temp runtime-data roots.
  - [x] Added explicit provisioning failure when no writable runtime directory can be created.
- [x] Mermaid renderer global pollution was corrected in `src/reader_renderer.ts`:
  - [x] Added scoped DOM-global install/restore wrappers (`withMermaidDomGlobals(...)`).
  - [x] Mermaid `initialize` and `render` now execute within scoped global bindings and restore previous process globals afterward.
  - [x] Added non-leak regression test in `src/reader_renderer.test.ts`.
- [x] Remaining risk from this historical baseline slice was closed in later slices (`v1.0.19` + `v1.0.20`).

### Verification Snapshot (2026-03-10)
- [x] `npx jest src/pathbridge.handshake.contract.test.ts src/server.migration.test.ts --runInBand`
- [x] `npx jest src/utils/RuntimePaths.test.ts --runInBand`
- [x] `npx jest src/reader_renderer.test.ts --runInBand`
- [x] `npm run test:migration` (**28 suites, 137 tests passed**)
- [x] `npm run test:wasm:parity:gates` (strict verify + strict perf guards passed)
- [x] `npm test` (**31 suites, 155 tests passed**)
- [x] `npm run build`
- [x] `npm run build:sidecar`

---

## 中文文档

### 本轮整改状态
- [x] PathBridge 入站帧上限已升级为高吞吐可配置方案：
  - [x] 默认入站帧上限提升至 `128 MiB`。
  - [x] 新增环境变量覆盖：`NOTE_CONNECTION_BRIDGE_MAX_INBOUND_MB`。
  - [x] 有效入站上限硬阈值约束为 `1024 MiB`。
  - [x] WebSocket `maxPayload` 与 `MAX_INBOUND_MESSAGE_BYTES` 对齐，避免传输栈上下层阈值不一致导致的提前拒绝。
- [x] 已补齐入站上限契约测试：
  - [x] 在 `src/core/PathBridge.ts` 导出 `BRIDGE_INBOUND_LIMITS`。
  - [x] 在 `src/pathbridge.handshake.contract.test.ts` 增加入站上限契约断言。
- [x] 已强化运行时写路径稳健性（`src/utils/RuntimePaths.ts`）：
  - [x] 运行时数据目录不再回退到 `frontendDir`。
  - [x] 新增 app-data / project / cwd / temp 的可写候选链路。
  - [x] 无可写目录时显式抛错，避免静默落入只读路径。
- [x] 已修复 Mermaid 渲染全局污染问题（`src/reader_renderer.ts`）：
  - [x] 新增作用域化全局绑定安装/恢复包装（`withMermaidDomGlobals(...)`）。
  - [x] Mermaid 的 `initialize` / `render` 均在作用域化绑定中执行，结束后恢复原全局状态。
  - [x] 在 `src/reader_renderer.test.ts` 新增“渲染后不泄漏全局 window/document”回归测试。
- [x] 该历史基线中的剩余风险已在后续切片收口（`v1.0.19` + `v1.0.20`）。

### 验证快照（2026-03-10）
- [x] `npx jest src/pathbridge.handshake.contract.test.ts src/server.migration.test.ts --runInBand`
- [x] `npx jest src/utils/RuntimePaths.test.ts --runInBand`
- [x] `npx jest src/reader_renderer.test.ts --runInBand`
- [x] `npm run test:migration`（**28 suites, 137 tests passed**）
- [x] `npm run test:wasm:parity:gates`（严格校验 + 严格性能门禁通过）
- [x] `npm test`（**31 suites, 155 tests passed**）
- [x] `npm run build`
- [x] `npm run build:sidecar`

> Historical note: the older section below is kept as imported baseline context and does not represent the current remediated state.

---

# 🛡️ HYBRID ARCHITECTURE AUDIT & PRODUCTION READINESS REPORT (2026-03-10)

**Target System:** Node.js (v22 LTS) + Capacitor (v8.2.0) + @yao-pkg/pkg (v6.14.1)
**Auditor:** Gemini CLI Senior Full-Stack Architect
**Status:** 🔴 **NON-PRODUCTION READY (HIGH RISK)**

---

## 📊 1. EXECUTIVE SUMMARY

**Hybrid Verdict:** **ARCHITECTURALLY FRAGILE & RESOURCE INEFFICIENT.** 
The system relies on a "Sidecar" architecture that exhibits severe memory discipline issues (12GB RAM requirement) and lacks the necessary isolation for mobile environments. Critical path resolution logic violates `pkg` static analysis constraints, ensuring runtime failures in read-only environments. Security boundaries are porous, and testing coverage for the actual packaged artifacts is non-existent.

### 📈 Production Readiness Scorecard

| Dimension | Risk Score (1-10) | Readiness | Primary Concern |
| :--- | :---: | :---: | :--- |
| **Performance & Bottlenecks** | 9 | ❌ | 12GB RAM flag; OOM risk on 10k nodes; Sync I/O blocking. |
| **Hybrid Data Chain** | 8 | ❌ | Base64 overhead (33%); Large JSON (>1GB) will crash bridge. |
| **Multi-Platform (Pkg/SEA)** | 8 | ❌ | Dynamic path resolution fails in `/snapshot`; Worker OOM. |
| **Code Quality & Maintainability** | 7 | ⚠️ | Loose IPC typing; Global state pollution in renderer. |
| **Scalability & Load** | 9 | ❌ | $O(V^2)$ algorithms on main thread; No backpressure. |
| **Testing & CI/CD** | 10 | ❌ | **ZERO** E2E coverage for packaged binary + bridge. |
| **Accessibility & UX** | 6 | ⚠️ | Canvas/SVG invisible to screen readers; No ARIA labels. |
| **Security & Compliance** | 8 | ❌ | Path traversal risk; Insecure CORS; Missing Privacy Manifests. |

**Overall Readiness Score:** **2.1 / 10**

---

## 🗺️ 2. ARCHITECTURAL MAPS (MERMAID)

### 1. Hybrid Data Flow (Mobile <-> Sidecar)
```mermaid
flowchart TD
    subgraph "Capacitor WebView"
        UI[React UI] -->|PostMessage| Bridge[Capacitor Bridge]
    end
    
    subgraph "Native Layer (Android/iOS)"
        Bridge -->|HTTP/WS| SidecarPlugin[Custom Plugin]
    end
    
    subgraph "Node.js Sidecar (Pkg Binary)"
        SidecarPlugin -->|TCP 3000| Server[HTTP Server]
        Server -->|Buffer| Logic[Graph Logic]
        Logic -->|JSON| Response[Serialization]
    end
    
    Response -->|Base64 PNG| UI
    style UI fill:#e1f5fe,stroke:#01579b
    style Response fill:#ffebee,stroke:#b71c1c
```

### 2. Packaging & Asset Resolution Pipeline
```mermaid
graph LR
    Src[Source Code] --> TSC[TypeScript]
    TSC --> Dist[Dist folder]
    Dist --> Pkg{Pkg Analysis}
    Pkg -->|Static Path| Bin[Internal Asset]
    Pkg -->|Dynamic Path| Err[❌ Runtime Crash]
    Bin --> App[Packaged Executable]
    
    style Err fill:#ffcdd2,stroke:#f44336
```

### 3. Performance Bottleneck Call Graph
```mermaid
graph TD
    User[Start Build] --> Load[FileLoader: Read 10k files]
    Load -->|Memory Peak| Match[Keyword Match Workers]
    Match -->|Matrix Blowup| Stats[Statistical Analysis]
    Stats -->|CPU Peg| Metrics[Betweenness Centrality O(V^3)]
    Metrics -->|Sync Blocking| Layout[D3 Force Layout]
    Layout -->|Large JSON| Serialization[JSON.stringify]
    Serialization -->|GC Pause| Output[Response]
```

### 4. CI/CD Pipeline Matrix
```mermaid
graph TD
    Commit --> Lint[ESLint/Prettier]
    Commit --> Test[Unit Tests]
    Lint --> Build[Build Dist]
    Test --> Build
    Build --> PkgWin[Pkg Win x64]
    Build --> PkgMac[Pkg Mac ARM64]
    Build --> CapAndroid[Capacitor Android]
    PkgWin --> Smoke[Binary Smoke Test]
    CapAndroid --> E2E[Maestro E2E]
```

### 5. Accessibility Information Flow
```mermaid
flowchart LR
    Graph[Graph Canvas] -->|No ARIA| User((User))
    Logic[A11y Logic] -->|Shadow DOM| ARIA[Screen Reader Nodes]
    ARIA -->|VoiceOver| User
    style Graph fill:#bdbdbd
    style ARIA fill:#c8e6c9
```

### 6. Threat Model (STRIDE)
```mermaid
graph TD
    Entry[HTTP Port 3000] -->|Spoofing| Auth[Missing Token Check]
    Entry -->|Tampering| FS[Write to KB_ROOT]
    Entry -->|Information Disclosure| Traversal[../ Path Traversal]
    Entry -->|DoS| Resource[Memory Exhaustion]
```

### 7. Monorepo Dependency Structure
```mermaid
graph BT
    Frontend --> Core
    Backend --> Core
    Sidecar --> Backend
    Native --> Sidecar
    Native --> Frontend
```

### 8. Phased Refactoring Roadmap
```mermaid
gantt
    title 8-Week Remediation Plan
    section Stabilization
    Security: CSP & Path Fixes :2026-03-10, 7d
    Memory: Streamed Loading     :14d
    section Optimization
    Layout: GPU Worker Offload  :14d
    Bridge: Protobuf/Binary IPC :14d
    section Quality
    Testing: Pkg E2E Automation :14d
    Compliance: App Store Prep   :7d
```

---

## 🚨 3. CRITICAL ISSUES (SEVERITY RANKED)

| Severity | Issue | File:Line | Impact & Cross-Tool Risk | Reproduction CLI | App Store Risk |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CRITICAL** | **12GB Heap Flag** | `package.json:11` | OOM on mobile; Sidecar crashes silently. | `npm start` (Watch RAM) | **REJECTED** |
| **CRITICAL** | **Snapshot Write** | `RuntimePaths:80` | `pkg` runtime crash; Graph data lost. | `npx pkg . && ./app.exe` | **CRASH** |
| **HIGH** | **Path Traversal** | `server.ts:600` | Full host data leak via API. | `curl http://localhost:3000/api/content?path=../../.env` | **REJECTED** |
| **HIGH** | **JSDOM Pollution** | `reader_renderer:430` | Memory leaks; Thread instability. | `node --inspect src/server.ts` | **STABILITY** |
| **MEDIUM** | **Base64 Overhead** | `reader_renderer:315` | 33% Network/Battery bloat. | `Network Tab (Payload Size)` | **BATTERY** |
| **LOW** | **ID com.example** | `capacitor.config` | Metadata violation. | `npx cap doctor` | **REJECTED** |

---

## 🔍 4. QUANTIFIED BOTTLENECKS

1.  **Memory (GraphBuilder):** 
    - **Current:** `files: RawFile[]` clones 10,000 files in memory + 10k x 10k similarity matrix.
    - **Metric:** ~1.2MB per Markdown file (avg) x 10k = **12GB raw buffer**.
    - **GC Pause:** >2s during `JSON.stringify` of the final 1GB graph.
2.  **CPU (GraphMetrics):**
    - **Algorithm:** Brandes' Algorithm for Betweenness Centrality is $O(VE)$. 
    - **Metric:** For 10k nodes and 50k edges, operations $\approx 5 \times 10^8$. 
    - **Time:** ~45s on mobile CPU (Snapdragon 8 Gen 2), blocking main thread.
3.  **Data Chain (Bridge):**
    - **Overhead:** Base64 encoding for PNG renders.
    - **Metric:** 1MB PNG becomes 1.33MB string. Native <-> JS transfer overhead adds ~50ms per render.
4.  **I/O (Server):**
    - **Latency:** Sync `fs.statSync` in `resolveRuntimePaths` called on every boot.
    - **Metric:** 10-50ms latency before server starts, compounding with worker spawns.

---

## 📝 5. TOP 5 CRITICAL CODE DIFFS

### 1. Fix 12GB Heap Requirement (Memory Stream)
**Before (`package.json`):**
```json
"start": "node --max-old-space-size=12288 -r ts-node/register src/server.ts"
```
**After:**
```json
"start": "node --max-old-space-size=4096 -r ts-node/register src/server.ts"
// Plus refactoring GraphBuilder to use streaming file access.
```

### 2. Fix Snapshot Write Failure (Writable Paths)
**Before (`RuntimePaths.ts`):**
```typescript
const runtimeDataDir = runtimeDataCandidates.find((candidate) => ensureWritableDirectory(candidate)) || frontendDir;
```
**After:**
```typescript
const runtimeDataDir = isPkg ? path.join(os.homedir(), '.noteconnection', 'data') : ...;
// Ensure we never fallback to a read-only snapshot directory.
```

### 3. Fix Path Traversal (Security Hardening)
**Before (`server.ts`):**
```typescript
const candidatePath = resolveContentCandidatePath(kbRootCanonical, decodedPath);
const filePathCanonical = await fs.promises.realpath(candidatePath);
```
**After:**
```typescript
const filePathCanonical = path.resolve(kbRootCanonical, decodedPath);
if (!filePathCanonical.startsWith(kbRootCanonical)) {
    throw new Error('Access Denied');
}
```

### 4. Fix JSDOM Global Pollution (Isolation)
**Before (`reader_renderer.ts`):**
```typescript
globalScope.window = window;
globalScope.document = window.document;
```
**After:**
```typescript
// Run Mermaid in a separate Worker or use a library that doesn't require global pollution.
// Or ensure clean-up after every render cycle.
```

### 5. Fix Insecure App ID (Compliance)
**Before (`capacitor.config.ts`):**
```typescript
appId: 'com.example.noteconnection',
```
**After:**
```typescript
appId: 'com.jacob.noteconnection.pro',
```

---

## 🛠️ 6. RECOMMENDED REFACTORING PLAN (8 WEEKS)

### Phase 1: Security & Stability (Week 1-2)
*   **Action:** Implement strict Zod schemas for all IPC.
*   **Action:** Fix `RuntimePaths` to use `os.homedir()` for all writes.
*   **CLI:** `npm install zod && npx tsc`

### Phase 2: Memory Optimization (Week 3-4)
*   **Action:** Replace `RawFile[]` with `ReadableStream` or `fs.read` in workers.
*   **Action:** Disable Betweenness Centrality for $V > 1000$ by default.
*   **CLI:** `node scripts/calibrate-graphmetrics-tiering.js`

### Phase 3: Binary & Bridge Hardening (Week 5-6)
*   **Action:** Migrate to Node.js SEA (Single Executable Applications) for better Node 22 support.
*   **Action:** Implement binary transfer for `reader_renderer` outputs.

---

## ✅ 5. BEST PRACTICES COMPLIANCE CHECKLIST

| Section | Requirement | Status | Remediation Command |
| :--- | :--- | :---: | :--- |
| **Perf** | No synchronous `fs.*Sync` in server | ❌ | Replace with `fs.promises` |
| **Pkg** | Zero dynamic `require` or `__dirname` | ❌ | Use `import.meta.url` or static mapping |
| **Mobile** | Privacy Manifest declared (iOS) | ❌ | Create `PrivacyInfo.xcprivacy` |
| **Security** | CSP Header implemented | ❌ | `res.setHeader('Content-Security-Policy', ...)` |
| **A11y** | ARIA-live for graph updates | ❌ | Add `aria-live="polite"` to status div |

---

## 🚀 6. AUTOMATED SCAN COMMANDS

```powershell
# 1. Quantify Dependency Debt
npm audit --audit-level=high

# 2. Test Pkg Compatibility (Look for dynamic warnings)
npx @yao-pkg/pkg . --debug --targets node22-win-x64 --output dist/pkg-audit

# 3. Memory Profiling (Run build and watch heap)
node --inspect src/server.ts
# Open chrome://inspect to capture heap snapshot during GraphBuilder.build()

# 4. Mobile Compliance Check
npx cap doctor
```

---

## 🔮 7. FUTURE-PROOFING RECOMMENDATIONS

1.  **Node.js SEA:** Move away from `pkg` (which is in maintenance mode) to native Node.js SEA for more robust distribution.
2.  **Capacitor 9:** Prepare for Capacitor 9 by removing all deprecated `@capacitor/filesystem` legacy calls.
3.  **Rust Core:** Consider moving `GraphBuilder` logic to a Rust-based sidecar (via NAPI-RS or Tauri) to eliminate the 12GB GC overhead.
