# 2026-03-10 v1.0.19

# MERMAID PAYLOAD + MOBILE COMPLIANCE CLOSURE UPDATE

## ENGLISH DOCUMENT

### Remediation Status (This Slice)
- [x] Closed base64-heavy Mermaid transfer risk on default API/bridge path:
  - [x] Added `includeSvg` control across server (`src/server.ts`), bridge (`src/core/PathBridge.ts`), and frontend bridge renderer (`src/frontend/path_app.js`).
  - [x] `/api/render/mermaid` is now PNG-focused by default; SVG is omitted unless `includeSvg=true`.
  - [x] Diagnostic compatibility retained: `includeStages=true` auto-enables SVG output.
  - [x] Godot runtime remains PNG-only (`pngBase64` required); SVG is diagnostics-only because Godot SVG handling is unstable.
- [x] Closed mobile app-id compliance gap:
  - [x] `capacitor.config.ts` uses `com.jacob.noteconnection.pro`.
  - [x] Android namespace/applicationId/strings aligned to `com.jacob.noteconnection.pro`.
  - [x] `MainActivity` package moved to `com.jacob.noteconnection.pro`.
- [x] Added regression contracts:
  - [x] `src/server.migration.test.ts` for Mermaid response shape defaults/opt-ins.
  - [x] `src/pathbridge.handshake.contract.test.ts` for includeSvg propagation contract.
  - [x] `src/mobile.pipeline.test.ts` for app-id consistency and legacy package removal.
- [ ] Remaining imported-baseline follow-up: mobile semantic DOM accessibility parity path.

### Verification Snapshot (2026-03-10)
- [x] `npx jest src/pathbridge.handshake.contract.test.ts src/server.migration.test.ts src/mobile.pipeline.test.ts --runInBand`
- [x] `npm run test:migration` (**28 suites, 141 tests passed**)
- [x] `npm run test:wasm:parity:gates`
- [x] `npm test` (**31 suites, 159 tests passed**)
- [x] `npm run build`
- [x] `npm run build:sidecar`

---

## 中文文档

### 本轮整改状态
- [x] 已收口 Mermaid Base64 重负载默认链路风险：
  - [x] 在 `src/server.ts`、`src/core/PathBridge.ts`、`src/frontend/path_app.js` 引入 `includeSvg` 控制。
  - [x] `/api/render/mermaid` 默认回包以 PNG 主链路为主（未显式请求时不返回 SVG）。
  - [x] 保持诊断兼容：`includeStages=true` 时自动携带 SVG。
  - [x] Godot 运行时继续保持 PNG-only（`pngBase64` 必填）；SVG 仅作诊断使用，因 Godot 直接处理 SVG 仍不稳定。
- [x] 已收口移动端 app-id 合规缺口：
  - [x] `capacitor.config.ts` 统一为 `com.jacob.noteconnection.pro`。
  - [x] Android `namespace` / `applicationId` / `strings.xml` 全部对齐。
  - [x] `MainActivity` 已迁移至 `com.jacob.noteconnection.pro` 包路径。
- [x] 已补齐回归契约：
  - [x] `src/server.migration.test.ts` 覆盖 Mermaid 回包默认与显式开启行为。
  - [x] `src/pathbridge.handshake.contract.test.ts` 覆盖 includeSvg 透传契约。
  - [x] `src/mobile.pipeline.test.ts` 覆盖 app-id 一致性与旧包路径移除。
- [ ] 导入基线剩余跟进项：移动端语义 DOM 可访问性等价链路。

### 验证快照（2026-03-10）
- [x] `npx jest src/pathbridge.handshake.contract.test.ts src/server.migration.test.ts src/mobile.pipeline.test.ts --runInBand`
- [x] `npm run test:migration`（**28 suites, 141 tests passed**）
- [x] `npm run test:wasm:parity:gates`
- [x] `npm test`（**31 suites, 159 tests passed**）
- [x] `npm run build`
- [x] `npm run build:sidecar`

---

# 2026-03-10 v1.0.18

# SCALE + STABILITY HARDENING UPDATE (BRIDGE INBOUND LIMIT / RUNTIME WRITABILITY / MERMAID GLOBAL ISOLATION)

## ENGLISH DOCUMENT

### Remediation Status (This Slice)
- [x] PathBridge inbound limit is now high-scale and tunable:
  - [x] Default inbound frame budget raised from 1 MiB to `128 MiB`.
  - [x] Added `NOTE_CONNECTION_BRIDGE_MAX_INBOUND_MB` override with bounded hard cap (`1024 MiB`).
  - [x] Aligned WebSocket `maxPayload` with `MAX_INBOUND_MESSAGE_BYTES`.
- [x] Added explicit inbound-limit contract coverage:
  - [x] Exported `BRIDGE_INBOUND_LIMITS`.
  - [x] Added `inbound frame limit is provisioned for high-volume graph payloads` contract in `src/pathbridge.handshake.contract.test.ts`.
- [x] Hardened runtime data directory resolution in `src/utils/RuntimePaths.ts`:
  - [x] Removed `frontendDir` fallback from runtime-data write path selection.
  - [x] Added app-data / project / cwd / temp writable candidates.
  - [x] Added explicit failure when no writable runtime-data directory can be provisioned.
- [x] Fixed Mermaid/JSDOM global-scope pollution in `src/reader_renderer.ts`:
  - [x] Added scoped DOM-global install/restore (`withMermaidDomGlobals(...)`).
  - [x] Wrapped Mermaid `initialize` and `render` in scoped global context.
  - [x] Added regression proof in `src/reader_renderer.test.ts` that render no longer leaks global `window/document`.
- [ ] Remaining baseline items: base64-heavy transfer optimization and mobile compliance/app-identifier closure remain open.

### Verification Snapshot (2026-03-10)
- [x] `npx jest src/pathbridge.handshake.contract.test.ts src/server.migration.test.ts --runInBand`
- [x] `npx jest src/utils/RuntimePaths.test.ts --runInBand`
- [x] `npx jest src/reader_renderer.test.ts --runInBand`
- [x] `npm run test:migration` (**28 suites, 137 tests passed**)
- [x] `npm run test:wasm:parity:gates`
- [x] `npm test` (**31 suites, 155 tests passed**)
- [x] `npm run build`
- [x] `npm run build:sidecar`

> Timeline note: older slices below are preserved as historical records and may include superseded values (for example, the prior 1 MiB inbound limit).

---

## 中文文档

### 本轮整改状态
- [x] PathBridge 入站上限已支持大规模数据：
  - [x] 默认入站帧预算由 1 MiB 提升至 `128 MiB`。
  - [x] 新增 `NOTE_CONNECTION_BRIDGE_MAX_INBOUND_MB` 可配置项，硬上限约束为 `1024 MiB`。
  - [x] WebSocket `maxPayload` 已与 `MAX_INBOUND_MESSAGE_BYTES` 对齐。
- [x] 已补齐入站上限契约覆盖：
  - [x] 导出 `BRIDGE_INBOUND_LIMITS`。
  - [x] 在 `src/pathbridge.handshake.contract.test.ts` 增加入站上限回归断言。
- [x] 已强化 `src/utils/RuntimePaths.ts` 运行时写目录策略：
  - [x] 运行时数据目录不再回退到 `frontendDir`。
  - [x] 新增 app-data / project / cwd / temp 可写候选链路。
  - [x] 无法创建可写目录时显式失败，避免写入只读路径。
- [x] 已修复 `src/reader_renderer.ts` 中 Mermaid/JSDOM 全局污染：
  - [x] 新增作用域化全局绑定安装/恢复（`withMermaidDomGlobals(...)`）。
  - [x] Mermaid `initialize` / `render` 均在作用域化全局上下文执行。
  - [x] 在 `src/reader_renderer.test.ts` 增加“渲染后不泄漏 `window/document`”回归证明。
- [ ] 剩余基线项：Base64 重负载链路优化、移动端上架合规 / app identifier 收口仍待完成。

### 验证快照（2026-03-10）
- [x] `npx jest src/pathbridge.handshake.contract.test.ts src/server.migration.test.ts --runInBand`
- [x] `npx jest src/utils/RuntimePaths.test.ts --runInBand`
- [x] `npx jest src/reader_renderer.test.ts --runInBand`
- [x] `npm run test:migration`（**28 suites, 137 tests passed**）
- [x] `npm run test:wasm:parity:gates`
- [x] `npm test`（**31 suites, 155 tests passed**）
- [x] `npm run build`
- [x] `npm run build:sidecar`

---

# 2026-03-10 v1.0.17

# BRIDGE HARDENING EXECUTION UPDATE (STRICT ENVELOPE + BACKPRESSURE + CSP/PKG CONTRACTS)

## ENGLISH DOCUMENT

### Remediation Status (This Slice)
- [x] Untyped IPC ingress hardened in `src/core/PathBridge.ts` with strict envelope parsing and known-message payload validation.
- [x] Added inbound frame size gate (`MAX_INBOUND_MESSAGE_BYTES`) and malformed-envelope rejection path.
- [x] Added bounded outbound backpressure queue with `bufferedAmount` gate and overflow drop logging.
- [x] Added packaging safety contract `src/pkg.sidecar.contract.test.ts` and migrated it into `npm run test:migration`.
- [x] Hardened CSP in `src/frontend/index.html` (`object-src`, `base-uri`, `frame-ancestors`, `form-action`).
- [x] Godot Mermaid runtime constraint is explicit: render success is accepted only when `pngBase64` is present; SVG remains diagnostics-only and is not a runtime fallback path.
- [ ] Remaining from imported baseline: Base64-heavy transfer optimization and mobile semantic DOM accessibility parity.

### Verification Snapshot (2026-03-10)
- [x] `npx jest src/pathbridge.handshake.contract.test.ts src/pkg.sidecar.contract.test.ts --runInBand`
- [x] `npm run test:migration` (**28 suites, 135 tests passed**)
- [x] `npm test` (**31 suites, 152 tests passed**)
- [x] `npm run build`

---

## 中文文档

### 本轮整改状态
- [x] `src/core/PathBridge.ts` 已完成 IPC 入站消息包强约束校验（严格消息包解析 + 已知消息负载结构校验）。
- [x] 已新增入站消息大小门禁（`MAX_INBOUND_MESSAGE_BYTES`）与异常消息拒绝路径。
- [x] 已新增有界出站背压队列，包含 `bufferedAmount` 门控与溢出丢弃日志。
- [x] 已新增打包稳健性契约 `src/pkg.sidecar.contract.test.ts`，并纳入 `npm run test:migration`。
- [x] 已强化 `src/frontend/index.html` 的 CSP（`object-src`、`base-uri`、`frame-ancestors`、`form-action`）。
- [x] Godot Mermaid 运行时约束已显式化：仅在 `pngBase64` 存在时判定成功，SVG 仅用于诊断，不作为运行时回退链路。
- [ ] 导入基线中的剩余未完成项：Base64 重负载传输优化与移动端语义 DOM 可访问性等价。

### 验证快照（2026-03-10）
- [x] `npx jest src/pathbridge.handshake.contract.test.ts src/pkg.sidecar.contract.test.ts --runInBand`
- [x] `npm run test:migration`（**28 suites, 135 tests passed**）
- [x] `npm test`（**31 suites, 152 tests passed**）
- [x] `npm run build`

---

# 2026-03-10 v1.0.16

# HYBRID ARCHITECTURE AUDIT BASELINE IMPORT (MERGED FROM `fixrisk_todo.md`)
**Imported Date**: March 10, 2026
**Source Snapshot Date**: March 9, 2026
**Scope**: Node.js (v22 LTS) + Capacitor (v8.2.0) + `@yao-pkg/pkg` (v6.14.1)

> Historical note: This section is an imported baseline snapshot from a stricter pre-remediation audit. Current real project status is tracked in newer sections below.

---

## ENGLISH DOCUMENT

### Executive Summary (Imported Baseline)

- Baseline verdict: **Architecturally fragile** (historical snapshot).
- Imported risk score: **8.5 / 10** (at snapshot time).
- Core concern: split-brain risk between packaged Node runtime and native/mobile bridge boundaries.

### Baseline Risk Matrix (Historical)

| Dimension | Risk (1-10) | Primary Concern |
| :--- | :---: | :--- |
| Data Transmission | 8 | Untyped JSON payloads and missing schema validation across bridge boundaries |
| Pkg Distribution | 7 | Snapshot filesystem path/asset mapping failures |
| Capacitor Integration | 6 | Default WebView hardening and native scheme handling gaps |
| Code Quality | 9 | Loose IPC typing and magic-string dependencies |
| Performance | 7 | Main-thread blocking and WebView memory pressure |
| Testing | 10 | Missing packaged-binary + bridge E2E coverage |
| Accessibility | 5 | Limited non-canvas semantic accessibility path |
| Security | 8 | CSP/supply-chain/signing hardening gaps |

### Critical Findings Imported Into Fix TODO

| Severity | Finding | Impact | Required Action |
| :--- | :--- | :--- | :--- |
| CRITICAL | Untyped IPC payload contracts | Runtime crashes when bridge schema drifts | Enforce typed schemas (`zod` or equivalent) on all bridge messages |
| HIGH | Base64-heavy transfer path | Memory overhead and jank for large payloads | Prefer stream/file transfer for large assets |
| HIGH | Missing bridge backpressure | UI freeze risk under high-rate sidecar events | Introduce ACK/NACK queue with bounded inflight messages |
| HIGH | pkg dynamic asset/path assumptions | Runtime file failures in `/snapshot` context | Enforce explicit pkg asset map + runtime path resolver |
| HIGH | Packaged E2E test gap | No confidence in binary+bridge behavior | Add CI matrix for packaged runtime integration tests |
| MEDIUM | Mobile accessibility path | Screen-reader parity incomplete | Add semantic DOM shadow for canvas/graph state |
| HIGH | Security hardening gaps | Increased tampering/exposure risk | Add CSP, dependency audit gate, and signing verification |

### Imported Remediation Phases

1. Stabilization: strict bridge typing + pkg asset hardening.
2. Performance: serialization optimization + memory profiling.
3. Security: CSP/audit/signing + sidecar threat-model closure.

### Imported Evidence Commands

```powershell
# Dependency & security baseline
npm audit --audit-level=high --json > audit_report.json

# Capacitor consistency
npx cap doctor

# Pkg debug build
npx @yao-pkg/pkg . --debug --targets node22-win-x64 --output dist/debug-cli

# Lint strict
npx eslint src --max-warnings=0

# Quick secret-string scan example
Get-Content dist/debug-cli.exe | Select-String "SECRET_KEY"
```

---

## 中文文档

### 执行摘要（导入基线）

- 基线结论：**架构脆弱**（历史快照）。
- 导入风险分：**8.5 / 10**（快照时）。
- 核心问题：打包后的 Node 运行时与原生/移动桥接边界存在“分裂”风险。

### 基线风险矩阵（历史）

| 维度 | 风险分 (1-10) | 主要问题 |
| :--- | :---: | :--- |
| 数据传输 | 8 | 桥接链路 JSON 负载缺少强类型与模式校验 |
| pkg 分发 | 7 | snapshot 文件系统路径/资产映射失败风险 |
| Capacitor 集成 | 6 | WebView 默认安全配置与 scheme 处理不足 |
| 代码质量 | 9 | IPC 弱类型与魔法字符串依赖 |
| 性能 | 7 | 主线程阻塞与 WebView 内存压力 |
| 测试 | 10 | 缺少“打包二进制 + 桥接”E2E 覆盖 |
| 可访问性 | 5 | 画布渲染缺少语义替代路径 |
| 安全 | 8 | CSP/供应链/签名加固不足 |

### 已并入 Fix TODO 的关键问题

| 严重度 | 问题 | 影响 | 必要动作 |
| :--- | :--- | :--- | :--- |
| 严重 | IPC 负载契约无强类型 | 桥接协议漂移时易崩溃 | 对全部桥接消息引入强类型 schema（如 `zod`） |
| 高 | Base64 大负载传输 | 大文件传输时内存放大与卡顿 | 大文件优先流式/文件通道传输 |
| 高 | 缺少消息背压机制 | sidecar 高频推送导致 UI 冻结 | 引入 ACK/NACK 队列并限制并发消息 |
| 高 | pkg 动态路径假设 | `/snapshot` 环境下运行时读文件失败 | 强制显式 pkg 资产映射 + 运行时路径解析器 |
| 高 | 打包态 E2E 缺口 | 无法验证真实发布形态稳定性 | 在 CI 增加打包态跨平台集成测试 |
| 中 | 移动端可访问性不足 | 屏幕阅读器体验不完整 | 为画布/图谱补充语义 DOM 映射 |
| 高 | 安全加固缺口 | 篡改与泄露风险升高 | 补齐 CSP、依赖审计门禁与签名校验 |

### 导入整改阶段

1. 稳定性阶段：桥接强类型化 + pkg 资产加固。
2. 性能阶段：序列化优化 + 内存剖析。
3. 安全阶段：CSP/审计/签名 + sidecar 威胁模型闭环。

### 导入证据命令

```powershell
# 依赖与安全基线
npm audit --audit-level=high --json > audit_report.json

# Capacitor 一致性检查
npx cap doctor

# pkg 调试构建
npx @yao-pkg/pkg . --debug --targets node22-win-x64 --output dist/debug-cli

# 严格 Lint
npx eslint src --max-warnings=0

# 二进制敏感串快速扫描示例
Get-Content dist/debug-cli.exe | Select-String "SECRET_KEY"
```

---
# 2026-03-10 v1.0.15

# END-TO-END HYBRID ARCHITECTURE & PACKAGING AUDIT (WASM PERFORMANCE REGRESSION GUARDS ENFORCED)
**Date**: March 10, 2026
**Target**: NoteConnection (Hybrid Node.js + Capacitor + Tauri/pkg Architecture)

---

## ENGLISH DOCUMENT

### Executive Summary

**Hybrid Architecture Risk Score: 1.6/10 (CRITICAL BREAKPOINTS CLOSED, STRICT PERF REGRESSION BARRIER ADDED)**

As of **2026-03-10**, wasm parity gating now enforces both activation and performance quality:
- Added a benchmark performance guard model for p95 regression checks.
- Added strict benchmark threshold args and report-level guard outputs.
- Updated strict wasm gate scripts so CI fails when candidate wasm p95 regresses beyond configured limits.
- Added contract coverage for performance guard logic.

Current runtime/gate state:
- Strict verify remains green with provisioned artifact and required exports.
- Strict performance benchmark gate remains green with candidate `wasm-adapter` mode.
- Full migration/build/Tauri/full-Jest revalidation remains green.

Remaining risk concentration:
- Production-scale threshold tuning and drift calibration as workloads evolve.
- Android real-device acceptance evidence remains environment-dependent.

---

### Critical Issues Table

| ID | Severity (Current) | Location | Current Status (2026-03-10) | Verification Evidence | Residual Risk |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **C-01** | **LOW (Managed)** | `src/frontend/runtime_bridge.js`, `src/frontend/storage_provider.js`, `src/frontend/source_manager.js`, `src/frontend/path_app.js`, `src/core/PathBridge.ts`, `src/backend/algorithms/WasmParityRuntime.ts`, `src/backend/algorithms/LayoutEngine.ts`, `src/backend/GraphMetrics.ts`, `src/backend/algorithms/WasmParityBenchmark.ts`, `src/backend/algorithms/WasmParityBenchmarkGuards.ts`, `src/backend/algorithms/WasmParityArtifactProbe.ts`, `src/backend/wasm/Cargo.toml`, `src/backend/wasm/src/lib.rs`, `src/backend/wasm/noteconnection_compute.wasm`, `scripts/benchmark-wasm-parity.js`, `scripts/verify-wasm-parity.js`, `scripts/build-wasm-parity-artifact.js`, `scripts/sync-wasm-parity-artifact.js`, `src/server.ts`, `src/server.migration.test.ts`, `src/wasm.parity.output.equivalence.contract.test.ts`, `src/wasm.parity.benchmark.contract.test.ts`, `src/wasm.parity.benchmark.guards.contract.test.ts`, `src/wasm.parity.artifact.probe.contract.test.ts`, `src/wasm.parity.artifact.provisioning.contract.test.ts`, `package.json`, `.github/workflows/migration-gates.yml` | Parity runtime risk is now managed: artifact exists, strict adapter activation is enforced, and strict p95 regression guards are enforced in gate scripts/CI. | `npm run verify:wasm:parity:strict`, `npm run benchmark:wasm:parity:strict:perf`, `npm run test:wasm:parity:gates`, `src/wasm.parity.benchmark.guards.contract.test.ts`, `tmp/wasm-parity-benchmark/latest.json`, `src/runtime.transport.adapter.contract.test.ts`, `src/wasm.parity.runtime.contract.test.ts`, `src/wasm.parity.runtime.functional.test.ts`, `src/wasm.parity.output.equivalence.contract.test.ts`, `src/server.migration.test.ts` | Remaining risk is threshold calibration for broader workload envelopes and longitudinal perf drift, not missing parity safeguards. |
| **C-02** | **LOW (Resolved)** | `android/app/src/main/AndroidManifest.xml`, `package.json` | Storage-permission baseline remains implemented and verified. | `src/mobile.pipeline.test.ts`, manifest checks for `READ_EXTERNAL_STORAGE` + `READ_MEDIA_*` | Runtime still depends on user granting permissions on-device. |
| **H-01** | **LOW (Resolved)** | `scripts/build-sidecar.js`, `package.json` | Node EOL target remains removed; Node 22 + Brotli + `--no-bytecode` remains active. | `scripts/build-sidecar.js` target map (`node22-*`), `npm run build:sidecar` | Future maintenance risk remains tied to `pkg` ecosystem cadence. |
| **H-02** | **LOW (Resolved)** | `scripts/build-sidecar.js`, `package.json` | Cross-platform sidecar strategy remains implemented. | `npm run build:sidecar`, `npm run build:sidecar:all`, sidecar validation scripts | Runtime execution still must be validated on each target OS in CI/release stages. |
| **M-01** | **LOW (Resolved)** | `src/server.ts` | Request-body memory hardening remains implemented and contract-covered. | `src/server.migration.test.ts` (oversize/invalid-json/content-type contracts) | Very large concurrent uploads can still increase disk I/O pressure by design. |

---

### Best Practices Compliance Checklist

| Standard | Status | Current Evidence | Remaining Work |
| :--- | :--- | :--- | :--- |
| **Data Layer Abstraction** | ✅ | Runtime capability split remains active across source/storage paths; contracts remain green. | Keep adapter contracts stable while parity evolves. |
| **Mobile Runtime** | ✅ (Core Parity + Perf Guardrails Active) | Provisioned wasm artifact, strict adapter activation checks, and strict p95 regression gates are active in scripts and CI. | Continue threshold calibration for large workload classes and multi-host variability. |
| **Node Version** | ✅ | `scripts/build-sidecar.js` still targets `node22-*`. | Keep future Node LTS migration on roadmap. |
| **Storage Permissions** | ✅ | `AndroidManifest.xml` includes `READ_EXTERNAL_STORAGE` and `READ_MEDIA_*`; dependency includes `@capacitor/filesystem`. | Device-level permission denial handling must stay regression-tested. |
| **Brotli Compression** | ✅ | Sidecar build args include `--compress Brotli` and `--no-bytecode`. | Monitor binary size drift in release gates. |
| **IPC Security** | ✅ | PathBridge enforces token-aware client authorization, unauthorized timeout, and authorized-only broadcast fan-out. | Continue threat-model review for local desktop process attack surface. |

---

### Verification Snapshot (2026-03-10)

- `npm run test:migration` passed: **27 suites, 128 tests**.
- `npm run test:wasm:parity:gates` passed (strict verify + strict perf benchmark guards).
- `npm run build` passed.
- `npm run test:tauri` passed: **19 Rust/Tauri tests**.
- `npm test` passed: **30 suites, 145 tests**.

---

## 中文文档

### 执行摘要

**混合架构风险评分：1.6/10（关键断点持续关闭，严格性能回归屏障已补齐）**

截至 **2026-03-10**，wasm parity 门禁已从“仅验证激活”升级为“激活 + 性能质量”双重强制：
- 新增基准性能门禁模型，支持 p95 回归校验。
- 基准脚本新增严格阈值参数，并在报告中输出门禁结果。
- 严格 wasm 门禁脚本已接入性能阈值，CI 在性能退化时会直接失败。
- 新增性能门禁契约测试，避免门禁逻辑回归。

当前运行态/门禁态：
- 严格探针持续通过（工件与导出完整）。
- 严格性能基准门禁持续通过，candidate 保持 `wasm-adapter`。
- migration/build/Tauri/全量 Jest 复验持续全绿。

剩余风险重心：
- 生产规模阈值校准与长期性能漂移治理。
- Android 真机验收证据仍依赖在线设备环境。

---

### 关键问题表

| ID | 当前严重程度 | 位置 | 当前状态（2026-03-10） | 验证证据 | 剩余风险 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **C-01** | **低（已进入可管理态）** | `src/frontend/runtime_bridge.js`、`src/frontend/storage_provider.js`、`src/frontend/source_manager.js`、`src/frontend/path_app.js`、`src/core/PathBridge.ts`、`src/backend/algorithms/WasmParityRuntime.ts`、`src/backend/algorithms/LayoutEngine.ts`、`src/backend/GraphMetrics.ts`、`src/backend/algorithms/WasmParityBenchmark.ts`、`src/backend/algorithms/WasmParityBenchmarkGuards.ts`、`src/backend/algorithms/WasmParityArtifactProbe.ts`、`src/backend/wasm/Cargo.toml`、`src/backend/wasm/src/lib.rs`、`src/backend/wasm/noteconnection_compute.wasm`、`scripts/benchmark-wasm-parity.js`、`scripts/verify-wasm-parity.js`、`scripts/build-wasm-parity-artifact.js`、`scripts/sync-wasm-parity-artifact.js`、`src/server.ts`、`src/server.migration.test.ts`、`src/wasm.parity.output.equivalence.contract.test.ts`、`src/wasm.parity.benchmark.contract.test.ts`、`src/wasm.parity.benchmark.guards.contract.test.ts`、`src/wasm.parity.artifact.probe.contract.test.ts`、`src/wasm.parity.artifact.provisioning.contract.test.ts`、`package.json`、`.github/workflows/migration-gates.yml` | parity 运行时风险已进入可管理态：工件已落地，严格 adapter 激活门禁有效，严格 p95 性能回归门禁已在脚本与 CI 强制执行。 | `npm run verify:wasm:parity:strict`、`npm run benchmark:wasm:parity:strict:perf`、`npm run test:wasm:parity:gates`、`src/wasm.parity.benchmark.guards.contract.test.ts`、`tmp/wasm-parity-benchmark/latest.json`、`src/runtime.transport.adapter.contract.test.ts`、`src/wasm.parity.runtime.contract.test.ts`、`src/wasm.parity.runtime.functional.test.ts`、`src/wasm.parity.output.equivalence.contract.test.ts`、`src/server.migration.test.ts` | 主要剩余风险已转为大规模阈值校准与长期性能漂移，不再是 parity 防护缺失。 |
| **C-02** | **低（已解决）** | `android/app/src/main/AndroidManifest.xml`、`package.json` | Android 存储/媒体权限基线持续有效。 | `src/mobile.pipeline.test.ts` + 清单断言 | 仍依赖设备权限授权。 |
| **H-01** | **低（已解决）** | `scripts/build-sidecar.js`、`package.json` | Node EOL 目标持续移除，保持 Node 22 + Brotli + `--no-bytecode`。 | sidecar 构建脚本与目标映射 | `pkg` 生态演进节奏仍需跟踪。 |
| **H-02** | **低（已解决）** | `scripts/build-sidecar.js`、`package.json` | 跨平台 sidecar 构建策略持续有效。 | `npm run build:sidecar`、`npm run build:sidecar:all` | 发布前仍需目标 OS 实机运行验证。 |
| **M-01** | **低（已解决）** | `src/server.ts` | 请求体内存安全加固持续有效。 | `src/server.migration.test.ts` | 高并发大请求下仍需容量化 I/O 规划。 |

---

### 最佳实践合规检查表

| 标准 | 状态 | 当前证据 | 剩余工作 |
| :--- | :--- | :--- | :--- |
| **数据层抽象** | ✅ | source/storage 运行时能力分流持续有效，契约测试持续通过。 | 在后续等价演进中保持适配契约稳定。 |
| **移动端运行时** | ✅（核心等价 + 性能门禁已激活） | 已具备工件落地、严格激活校验与严格 p95 性能回归门禁（脚本 + CI）。 | 持续进行大规模负载阈值校准与多主机差异治理。 |
| **Node 版本** | ✅ | sidecar 目标保持 `node22-*`。 | 持续按 LTS 节奏升级。 |
| **存储权限** | ✅ | 清单与依赖保持存储/媒体读取基线。 | 持续回归权限拒绝场景。 |
| **Brotli 压缩** | ✅ | sidecar 构建保持 `--compress Brotli` 与 `--no-bytecode`。 | 持续监控二进制体积。 |
| **IPC 安全** | ✅ | 鉴权广播与未授权超时机制保持有效。 | 持续评估本地进程攻防边界。 |

---

### 验证快照（2026-03-10）

- `npm run test:migration` 通过：**27 suites, 128 tests**。
- `npm run test:wasm:parity:gates` 通过（严格校验 + 严格性能门禁）。
- `npm run build` 通过。
- `npm run test:tauri` 通过：**19 项 Rust/Tauri 测试**。
- `npm test` 通过：**30 suites, 145 tests**。

---

# 2026-03-10 v1.0.14

# END-TO-END HYBRID ARCHITECTURE & PACKAGING AUDIT (WASM ARTIFACT PROVISIONED + STRICT CI GATES ACTIVE)
**Date**: March 10, 2026
**Target**: NoteConnection (Hybrid Node.js + Capacitor + Tauri/pkg Architecture)

---

## ENGLISH DOCUMENT

### Executive Summary

**Hybrid Architecture Risk Score: 1.8/10 (CRITICAL BREAKPOINTS CLOSED, WASM ARTIFACT NOW PROVISIONED)**

As of **2026-03-10**, wasm parity has moved from readiness-only checks to real artifact provisioning:
- Added a Rust-based wasm parity module with required JSON ABI exports.
- Provisioned canonical artifact at `src/backend/wasm/noteconnection_compute.wasm`.
- Added artifact build/sync scripts and build pipeline synchronization to `dist`.
- Enabled strict wasm parity gates in scripts and CI workflow matrix.

Current observed runtime state:
- Strict probe passes with `ready: true`.
- Strict benchmark now reaches `wasm-adapter` mode in both GraphMetrics and LayoutEngine.
- Full migration/build/Tauri/full-Jest gates remain green after provisioning.

Remaining risk concentration:
- Production-scale performance tuning and long-horizon parity drift monitoring.
- Android real-device acceptance evidence remains environment-dependent.

---

### Critical Issues Table

| ID | Severity (Current) | Location | Current Status (2026-03-10) | Verification Evidence | Residual Risk |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **C-01** | **LOW (Closed to Managed Runtime Risk)** | `src/frontend/runtime_bridge.js`, `src/frontend/storage_provider.js`, `src/frontend/source_manager.js`, `src/frontend/path_app.js`, `src/core/PathBridge.ts`, `src/backend/algorithms/WasmParityRuntime.ts`, `src/backend/algorithms/LayoutEngine.ts`, `src/backend/GraphMetrics.ts`, `src/backend/wasm/Cargo.toml`, `src/backend/wasm/src/lib.rs`, `src/backend/wasm/noteconnection_compute.wasm`, `scripts/build-wasm-parity-artifact.js`, `scripts/sync-wasm-parity-artifact.js`, `scripts/benchmark-wasm-parity.js`, `scripts/verify-wasm-parity.js`, `src/server.ts`, `src/server.migration.test.ts`, `src/wasm.parity.output.equivalence.contract.test.ts`, `src/wasm.parity.benchmark.contract.test.ts`, `src/wasm.parity.artifact.probe.contract.test.ts`, `src/wasm.parity.artifact.provisioning.contract.test.ts`, `package.json`, `.github/workflows/migration-gates.yml` | Phantom-backend dependency remains mitigated and wasm parity artifact is now provisioned. Runtime can enter real `wasm-adapter` mode, strict gates are active, and CI matrix includes strict wasm parity suite. | `npm run build:wasm:parity`, `npm run verify:wasm:parity:strict`, `npm run benchmark:wasm:parity:strict`, `npm run test:wasm:parity:gates`, `src/wasm.parity.artifact.provisioning.contract.test.ts`, `tmp/wasm-parity-benchmark/latest.json`, `src/runtime.transport.adapter.contract.test.ts`, `src/wasm.parity.runtime.contract.test.ts`, `src/wasm.parity.runtime.functional.test.ts`, `src/wasm.parity.output.equivalence.contract.test.ts`, `src/server.migration.test.ts` | Main remaining risk is production-scale perf optimization and parity drift over time, not artifact absence. |
| **C-02** | **LOW (Resolved)** | `android/app/src/main/AndroidManifest.xml`, `package.json` | Storage-permission baseline remains implemented and verified. | `src/mobile.pipeline.test.ts`, manifest checks for `READ_EXTERNAL_STORAGE` + `READ_MEDIA_*` | Runtime still depends on user granting permissions on-device. |
| **H-01** | **LOW (Resolved)** | `scripts/build-sidecar.js`, `package.json` | Node EOL target remains removed; Node 22 + Brotli + `--no-bytecode` remains active. | `scripts/build-sidecar.js` target map (`node22-*`), `npm run build:sidecar` | Future maintenance risk remains tied to `pkg` ecosystem cadence. |
| **H-02** | **LOW (Resolved)** | `scripts/build-sidecar.js`, `package.json` | Cross-platform sidecar strategy remains implemented. | `npm run build:sidecar`, `npm run build:sidecar:all`, sidecar validation scripts | Runtime execution still must be validated on each target OS in CI/release stages. |
| **M-01** | **LOW (Resolved)** | `src/server.ts` | Request-body memory hardening remains implemented and contract-covered. | `src/server.migration.test.ts` (oversize/invalid-json/content-type contracts) | Very large concurrent uploads can still increase disk I/O pressure by design. |

---

### Best Practices Compliance Checklist

| Standard | Status | Current Evidence | Remaining Work |
| :--- | :--- | :--- | :--- |
| **Data Layer Abstraction** | ✅ | Runtime capability split remains active across source/storage paths; contracts remain green. | Keep adapter contracts stable while parity evolves. |
| **Mobile Runtime** | ✅ (Core Parity Path Closed, Performance Tuning Open) | Capacitor worker-first local build fallback remains active; backend heavy compute now has provisioned wasm artifact + strict gates + active adapter evidence. | Tune production-scale performance and monitor parity drift regressions. |
| **Node Version** | ✅ | `scripts/build-sidecar.js` still targets `node22-*`. | Keep future Node LTS migration on roadmap. |
| **Storage Permissions** | ✅ | `AndroidManifest.xml` includes `READ_EXTERNAL_STORAGE` and `READ_MEDIA_*`; dependency includes `@capacitor/filesystem`. | Device-level permission denial handling must stay regression-tested. |
| **Brotli Compression** | ✅ | Sidecar build args include `--compress Brotli` and `--no-bytecode`. | Monitor binary size drift in release gates. |
| **IPC Security** | ✅ | PathBridge enforces token-aware client authorization, unauthorized timeout, and authorized-only broadcast fan-out. | Continue threat-model review for local desktop process attack surface. |

---

### Verification Snapshot (2026-03-10)

- `npm run build:wasm:parity` passed.
- `npm run verify:wasm:parity` passed.
- `npm run verify:wasm:parity:strict` passed.
- `npm run benchmark:wasm:parity:strict` passed, candidate reached `wasm-adapter` mode.
- `npm run test:wasm:parity:gates` passed.
- `npm run test:migration` passed: **26 suites, 124 tests**.
- `npm run build` passed.
- `npm run test:tauri` passed: **19 Rust/Tauri tests**.
- `npm test` passed: **29 suites, 141 tests**.

---

## 中文文档

### 执行摘要

**混合架构风险评分：1.8/10（关键断点持续关闭，WASM 工件已真实落地）**

截至 **2026-03-10**，wasm parity 已从“可用性探针阶段”进入“真实工件落地阶段”：
- 新增 Rust wasm parity 模块并实现必需 JSON ABI 导出。
- 标准工件已落地：`src/backend/wasm/noteconnection_compute.wasm`。
- 构建链路新增工件构建与同步脚本，并在 `build` 流程中同步到 `dist`。
- 严格 wasm 门禁已接入脚本与 CI 工作流矩阵。

当前运行态观测：
- 严格探针通过，`ready: true`。
- 严格基准中 GraphMetrics/LayoutEngine 的 candidate 均进入 `wasm-adapter`。
- 工件落地后 migration/build/Tauri/全量 Jest 继续全绿。

剩余风险重心：
- 转为生产规模性能调优与长期等价漂移监控。
- Android 真机验收证据仍依赖在线设备环境。

---

### 关键问题表

| ID | 当前严重程度 | 位置 | 当前状态（2026-03-10） | 验证证据 | 剩余风险 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **C-01** | **低（已收口为可管理运行时风险）** | `src/frontend/runtime_bridge.js`、`src/frontend/storage_provider.js`、`src/frontend/source_manager.js`、`src/frontend/path_app.js`、`src/core/PathBridge.ts`、`src/backend/algorithms/WasmParityRuntime.ts`、`src/backend/algorithms/LayoutEngine.ts`、`src/backend/GraphMetrics.ts`、`src/backend/wasm/Cargo.toml`、`src/backend/wasm/src/lib.rs`、`src/backend/wasm/noteconnection_compute.wasm`、`scripts/build-wasm-parity-artifact.js`、`scripts/sync-wasm-parity-artifact.js`、`scripts/benchmark-wasm-parity.js`、`scripts/verify-wasm-parity.js`、`src/server.ts`、`src/server.migration.test.ts`、`src/wasm.parity.output.equivalence.contract.test.ts`、`src/wasm.parity.benchmark.contract.test.ts`、`src/wasm.parity.artifact.probe.contract.test.ts`、`src/wasm.parity.artifact.provisioning.contract.test.ts`、`package.json`、`.github/workflows/migration-gates.yml` | 幽灵后端依赖持续缓解，且 wasm parity 工件已真实落地。运行时可进入 `wasm-adapter`，严格门禁已激活，CI 矩阵已纳入严格 wasm 套件。 | `npm run build:wasm:parity`、`npm run verify:wasm:parity:strict`、`npm run benchmark:wasm:parity:strict`、`npm run test:wasm:parity:gates`、`src/wasm.parity.artifact.provisioning.contract.test.ts`、`tmp/wasm-parity-benchmark/latest.json`、`src/runtime.transport.adapter.contract.test.ts`、`src/wasm.parity.runtime.contract.test.ts`、`src/wasm.parity.runtime.functional.test.ts`、`src/wasm.parity.output.equivalence.contract.test.ts`、`src/server.migration.test.ts` | 主要剩余风险已转为生产规模性能调优与长期等价漂移监控，不再是工件缺失。 |
| **C-02** | **低（已解决）** | `android/app/src/main/AndroidManifest.xml`、`package.json` | Android 存储/媒体权限基线持续有效。 | `src/mobile.pipeline.test.ts` + 清单断言 | 仍依赖设备权限授权。 |
| **H-01** | **低（已解决）** | `scripts/build-sidecar.js`、`package.json` | Node EOL 目标持续移除，保持 Node 22 + Brotli + `--no-bytecode`。 | sidecar 构建脚本与目标映射 | `pkg` 生态演进节奏仍需跟踪。 |
| **H-02** | **低（已解决）** | `scripts/build-sidecar.js`、`package.json` | 跨平台 sidecar 构建策略持续有效。 | `npm run build:sidecar`、`npm run build:sidecar:all` | 发布前仍需目标 OS 实机运行验证。 |
| **M-01** | **低（已解决）** | `src/server.ts` | 请求体内存安全加固持续有效。 | `src/server.migration.test.ts` | 高并发大请求下仍需容量化 I/O 规划。 |

---

### 最佳实践合规检查表

| 标准 | 状态 | 当前证据 | 剩余工作 |
| :--- | :--- | :--- | :--- |
| **数据层抽象** | ✅ | source/storage 运行时能力分流持续有效，契约测试持续通过。 | 在后续等价演进中保持适配契约稳定。 |
| **移动端运行时** | ✅（核心等价链路闭环，性能调优待继续） | Capacitor 本地仍是 Worker 优先回退；后端重计算已具备“工件落地 + 严格门禁 + 实际 adapter 激活”证据。 | 聚焦生产规模性能调优与等价漂移监控。 |
| **Node 版本** | ✅ | sidecar 目标保持 `node22-*`。 | 持续按 LTS 节奏升级。 |
| **存储权限** | ✅ | 清单与依赖保持存储/媒体读取基线。 | 持续回归权限拒绝场景。 |
| **Brotli 压缩** | ✅ | sidecar 构建保持 `--compress Brotli` 与 `--no-bytecode`。 | 持续监控二进制体积。 |
| **IPC 安全** | ✅ | 鉴权广播与未授权超时机制保持有效。 | 持续评估本地进程攻防边界。 |

---

### 验证快照（2026-03-10）

- `npm run build:wasm:parity` 通过。
- `npm run verify:wasm:parity` 通过。
- `npm run verify:wasm:parity:strict` 通过。
- `npm run benchmark:wasm:parity:strict` 通过，candidate 进入 `wasm-adapter`。
- `npm run test:wasm:parity:gates` 通过。
- `npm run test:migration` 通过：**26 suites, 124 tests**。
- `npm run build` 通过。
- `npm run test:tauri` 通过：**19 项 Rust/Tauri 测试**。
- `npm test` 通过：**29 suites, 141 tests**。

---

# 2026-03-10 v1.0.13

# END-TO-END HYBRID ARCHITECTURE & PACKAGING AUDIT (WASM ARTIFACT READINESS GATING)
**Date**: March 10, 2026
**Target**: NoteConnection (Hybrid Node.js + Capacitor + Tauri/pkg Architecture)

---

## ENGLISH DOCUMENT

### Executive Summary

**Hybrid Architecture Risk Score: 2.2/10 (CRITICAL BREAKPOINTS CLOSED, ARTIFACT READINESS GATE ADDED)**

As of **2026-03-10**, the wasm parity stream now includes explicit artifact readiness verification:
- Added a reusable wasm artifact probe with required-export validation and failure taxonomy.
- Added a verifier CLI with strict/non-strict behavior and JSON evidence output.
- Added a dedicated npm strict verifier entrypoint to avoid npm argument-forwarding ambiguity.
- Revalidated full migration/build/Tauri/full-Jest feasibility after this slice.

Current evidence files:
- `tmp/wasm-parity-benchmark/latest.json`
- `tmp/wasm-parity-benchmark/verify-latest.json`

Observed runtime state in this environment:
- Candidate compute path remains worker fallback for GraphMetrics and LayoutEngine.
- Verifier and runtime diagnostics indicate `artifact-not-found`; `wasm-adapter` is not active in this environment.
- Strict gates now fail deterministically when artifact readiness is missing (expected behavior).

Remaining high-risk gap:
- Production wasm artifact availability/parity at scale remains open.
- Worker↔wasm benchmark closure with active wasm execution remains open.
- Android real-device acceptance evidence remains environment-dependent.

---

### Critical Issues Table

| ID | Severity (Current) | Location | Current Status (2026-03-10) | Verification Evidence | Residual Risk |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **C-01** | **MEDIUM (Mitigated)** | `src/frontend/runtime_bridge.js`, `src/frontend/storage_provider.js`, `src/frontend/source_manager.js`, `src/frontend/path_app.js`, `src/core/PathBridge.ts`, `src/backend/algorithms/WasmParityRuntime.ts`, `src/backend/algorithms/LayoutEngine.ts`, `src/backend/GraphMetrics.ts`, `src/backend/algorithms/WasmParityBenchmark.ts`, `src/backend/algorithms/WasmParityArtifactProbe.ts`, `scripts/benchmark-wasm-parity.js`, `scripts/verify-wasm-parity.js`, `src/server.ts`, `src/server.migration.test.ts`, `src/wasm.parity.output.equivalence.contract.test.ts`, `src/wasm.parity.benchmark.contract.test.ts`, `src/wasm.parity.artifact.probe.contract.test.ts`, `package.json` | Phantom-backend dependency remains mitigated and parity readiness has advanced: deterministic fallback + API telemetry remain active; benchmark and artifact-readiness evidence are generated; strict verifier/benchmark paths now fail explicitly when artifact readiness is missing. | `npm run verify:wasm:parity`, `npm run verify:wasm:parity:strict`, `npm run benchmark:wasm:parity`, `npm run benchmark:wasm:parity:strict`, `tmp/wasm-parity-benchmark/latest.json`, `tmp/wasm-parity-benchmark/verify-latest.json`, `src/runtime.transport.adapter.contract.test.ts`, `src/wasm.parity.runtime.contract.test.ts`, `src/wasm.parity.runtime.functional.test.ts`, `src/wasm.parity.output.equivalence.contract.test.ts`, `src/wasm.parity.benchmark.contract.test.ts`, `src/wasm.parity.artifact.probe.contract.test.ts`, `src/server.migration.test.ts` | Active wasm execution path (`wasm-adapter`) is still blocked by artifact availability in this environment; scale/perf closure remains pending. |
| **C-02** | **LOW (Resolved)** | `android/app/src/main/AndroidManifest.xml`, `package.json` | Storage-permission baseline remains implemented and verified. | `src/mobile.pipeline.test.ts`, manifest checks for `READ_EXTERNAL_STORAGE` + `READ_MEDIA_*` | Runtime still depends on user granting permissions on-device. |
| **H-01** | **LOW (Resolved)** | `scripts/build-sidecar.js`, `package.json` | Node EOL target remains removed; Node 22 + Brotli + `--no-bytecode` remains active. | `scripts/build-sidecar.js` target map (`node22-*`), `npm run build:sidecar` | Future maintenance risk remains tied to `pkg` ecosystem cadence. |
| **H-02** | **LOW (Resolved)** | `scripts/build-sidecar.js`, `package.json` | Cross-platform sidecar strategy remains implemented. | `npm run build:sidecar`, `npm run build:sidecar:all`, sidecar validation scripts | Runtime execution still must be validated on each target OS in CI/release stages. |
| **M-01** | **LOW (Resolved)** | `src/server.ts` | Request-body memory hardening remains implemented and contract-covered. | `src/server.migration.test.ts` (oversize/invalid-json/content-type contracts) | Very large concurrent uploads can still increase disk I/O pressure by design. |

---

### Best Practices Compliance Checklist

| Standard | Status | Current Evidence | Remaining Work |
| :--- | :--- | :--- | :--- |
| **Data Layer Abstraction** | ✅ | Runtime capability split remains active across source/storage paths; contracts remain green. | Keep adapter contracts stable while parity evolves. |
| **Mobile Runtime** | ⚠️ Partial | Capacitor worker-first local build fallback remains active; backend heavy compute now has JSON ABI path + orchestration contracts + retry/diagnostic resilience + API telemetry + benchmark and artifact-readiness verifiers. | Close production wasm artifact parity and rerun worker↔wasm baselines with active wasm adapter mode. |
| **Node Version** | ✅ | `scripts/build-sidecar.js` still targets `node22-*`. | Keep future Node LTS migration on roadmap. |
| **Storage Permissions** | ✅ | `AndroidManifest.xml` includes `READ_EXTERNAL_STORAGE` and `READ_MEDIA_*`; dependency includes `@capacitor/filesystem`. | Device-level permission denial handling must stay regression-tested. |
| **Brotli Compression** | ✅ | Sidecar build args include `--compress Brotli` and `--no-bytecode`. | Monitor binary size drift in release gates. |
| **IPC Security** | ✅ | PathBridge enforces token-aware client authorization, unauthorized timeout, and authorized-only broadcast fan-out. | Continue threat-model review for local desktop process attack surface. |

---

### Verification Snapshot (2026-03-10)

- `npx jest src/wasm.parity.artifact.probe.contract.test.ts --runInBand` passed.
- `npx tsc --pretty false` passed.
- `npm run verify:wasm:parity` passed.
- `npm run verify:wasm:parity:strict` returned non-zero as expected (`artifact-not-found`).
- `npm run benchmark:wasm:parity` passed and emitted evidence JSON.
- `npm run benchmark:wasm:parity:strict` returned non-zero as expected (candidate did not reach `wasm-adapter`).
- `npm run test:migration` passed: **25 suites, 123 tests**.
- `npm run build` passed.
- `npm run test:tauri` passed: **19 Rust/Tauri tests**.
- `npm test` passed: **28 suites, 140 tests**.

---

## 中文文档

### 执行摘要

**混合架构风险评分：2.2/10（关键断点持续关闭，工件可用性门禁已补齐）**

截至 **2026-03-10**，wasm 等价链路新增“工件可用性显式门禁”能力：
- 新增可复用 wasm 工件探针，覆盖必需导出校验与失败类型归因。
- 新增校验 CLI，支持严格/非严格模式并输出 JSON 证据。
- 新增专用 npm 严格入口，规避参数透传歧义。
- 本切片后再次完成 migration/build/Tauri/全量 Jest 可行性复验。

当前证据文件：
- `tmp/wasm-parity-benchmark/latest.json`
- `tmp/wasm-parity-benchmark/verify-latest.json`

本环境观测结果：
- GraphMetrics 与 LayoutEngine 的 candidate 仍走 worker 回退。
- 校验与运行时诊断均指向 `artifact-not-found`，说明本环境未激活 `wasm-adapter`。
- 严格门禁在工件缺失时会稳定非零退出（预期行为）。

剩余高风险：
- 生产级 wasm 工件可用性与规模等价仍待闭环。
- 需要在 wasm 真正激活后补齐 worker↔wasm 基准收口。
- Android 真机验收证据仍依赖在线设备环境。

---

### 关键问题表

| ID | 当前严重程度 | 位置 | 当前状态（2026-03-10） | 验证证据 | 剩余风险 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **C-01** | **中（已缓解）** | `src/frontend/runtime_bridge.js`、`src/frontend/storage_provider.js`、`src/frontend/source_manager.js`、`src/frontend/path_app.js`、`src/core/PathBridge.ts`、`src/backend/algorithms/WasmParityRuntime.ts`、`src/backend/algorithms/LayoutEngine.ts`、`src/backend/GraphMetrics.ts`、`src/backend/algorithms/WasmParityBenchmark.ts`、`src/backend/algorithms/WasmParityArtifactProbe.ts`、`scripts/benchmark-wasm-parity.js`、`scripts/verify-wasm-parity.js`、`src/server.ts`、`src/server.migration.test.ts`、`src/wasm.parity.output.equivalence.contract.test.ts`、`src/wasm.parity.benchmark.contract.test.ts`、`src/wasm.parity.artifact.probe.contract.test.ts`、`package.json` | 幽灵后端依赖持续缓解，且等价可用性门禁进一步闭环：确定性回退与 API 遥测保持有效；基准与工件校验证据可持续产出；当工件缺失时严格校验/基准会明确失败。 | `npm run verify:wasm:parity`、`npm run verify:wasm:parity:strict`、`npm run benchmark:wasm:parity`、`npm run benchmark:wasm:parity:strict`、`tmp/wasm-parity-benchmark/latest.json`、`tmp/wasm-parity-benchmark/verify-latest.json`、`src/runtime.transport.adapter.contract.test.ts`、`src/wasm.parity.runtime.contract.test.ts`、`src/wasm.parity.runtime.functional.test.ts`、`src/wasm.parity.output.equivalence.contract.test.ts`、`src/wasm.parity.benchmark.contract.test.ts`、`src/wasm.parity.artifact.probe.contract.test.ts`、`src/server.migration.test.ts` | 本环境下 `wasm-adapter` 仍受工件可用性限制；规模性能闭环仍待完成。 |
| **C-02** | **低（已解决）** | `android/app/src/main/AndroidManifest.xml`、`package.json` | Android 存储/媒体权限基线持续有效。 | `src/mobile.pipeline.test.ts` + 清单断言 | 仍依赖设备权限授权。 |
| **H-01** | **低（已解决）** | `scripts/build-sidecar.js`、`package.json` | Node EOL 目标持续移除，保持 Node 22 + Brotli + `--no-bytecode`。 | sidecar 构建脚本与目标映射 | `pkg` 生态演进节奏仍需跟踪。 |
| **H-02** | **低（已解决）** | `scripts/build-sidecar.js`、`package.json` | 跨平台 sidecar 构建策略持续有效。 | `npm run build:sidecar`、`npm run build:sidecar:all` | 发布前仍需目标 OS 实机运行验证。 |
| **M-01** | **低（已解决）** | `src/server.ts` | 请求体内存安全加固持续有效。 | `src/server.migration.test.ts` | 高并发大请求下仍需容量化 I/O 规划。 |

---

### 最佳实践合规检查表

| 标准 | 状态 | 当前证据 | 剩余工作 |
| :--- | :--- | :--- | :--- |
| **数据层抽象** | ✅ | source/storage 运行时能力分流持续有效，契约测试持续通过。 | 在等价改造过程中保持适配契约稳定。 |
| **移动端运行时** | ⚠️ 部分完成 | Capacitor 本地构建仍是 Worker 优先回退；后端重计算已具备 JSON ABI + 编排契约 + 重试/诊断韧性 + API 遥测 + 基准/工件校验脚手架。 | 闭环生产级 wasm 工件可用性，并在 wasm 激活后复跑 worker↔wasm 基准收口。 |
| **Node 版本** | ✅ | sidecar 目标保持 `node22-*`。 | 持续按 LTS 节奏升级。 |
| **存储权限** | ✅ | 清单与依赖保持存储/媒体读取基线。 | 持续回归权限拒绝场景。 |
| **Brotli 压缩** | ✅ | sidecar 构建保持 `--compress Brotli` 与 `--no-bytecode`。 | 持续监控二进制体积。 |
| **IPC 安全** | ✅ | 鉴权广播与未授权超时机制保持有效。 | 持续评估本地进程攻防边界。 |

---

### 验证快照（2026-03-10）

- `npx jest src/wasm.parity.artifact.probe.contract.test.ts --runInBand` 通过。
- `npx tsc --pretty false` 通过。
- `npm run verify:wasm:parity` 通过。
- `npm run verify:wasm:parity:strict` 按预期非零退出（`artifact-not-found`）。
- `npm run benchmark:wasm:parity` 通过并输出证据 JSON。
- `npm run benchmark:wasm:parity:strict` 按预期非零退出（candidate 未进入 `wasm-adapter`）。
- `npm run test:migration` 通过：**25 suites, 123 tests**。
- `npm run build` 通过。
- `npm run test:tauri` 通过：**19 项 Rust/Tauri 测试**。
- `npm test` 通过：**28 suites, 140 tests**。

---

# 2026-03-10 v1.0.12

# END-TO-END HYBRID ARCHITECTURE & PACKAGING AUDIT (WORKER↔WASM BENCHMARK BASELINE EVIDENCE)
**Date**: March 10, 2026
**Target**: NoteConnection (Hybrid Node.js + Capacitor + Tauri/pkg Architecture)

---

## ENGLISH DOCUMENT

### Executive Summary

**Hybrid Architecture Risk Score: 2.3/10 (CRITICAL BREAKPOINTS CLOSED, BASELINE EVIDENCE PIPELINE ADDED)**

As of **2026-03-10**, parity verification now includes a reproducible benchmark/evidence pipeline:
- Added deterministic heavy-graph benchmark utilities for latency percentiles and betweenness equivalence.
- Added runnable benchmark script that executes baseline (wasm off) vs candidate (wasm on) scenarios and emits JSON evidence.
- Added contract coverage for benchmark math and fixture invariants.

Current benchmark evidence exists at:
- `tmp/wasm-parity-benchmark/latest.json`

Observed runtime state in this environment:
- Candidate path still resolves to worker fallback for both GraphMetrics and LayoutEngine.
- `WasmParityRuntime` diagnostics report `artifact-not-found`, so `wasm-adapter` path is not yet activated here.

Remaining risk is now narrower and explicit:
- Production wasm artifact availability/parity at scale remains open.
- Real workload worker↔wasm benchmark closure with active wasm execution remains open.
- Android real-device acceptance evidence remains environment-dependent.

---

### Critical Issues Table

| ID | Severity (Current) | Location | Current Status (2026-03-10) | Verification Evidence | Residual Risk |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **C-01** | **MEDIUM (Mitigated)** | `src/frontend/runtime_bridge.js`, `src/frontend/storage_provider.js`, `src/frontend/source_manager.js`, `src/frontend/path_app.js`, `src/core/PathBridge.ts`, `src/backend/algorithms/WasmParityRuntime.ts`, `src/backend/algorithms/LayoutEngine.ts`, `src/backend/GraphMetrics.ts`, `src/backend/algorithms/WasmParityBenchmark.ts`, `scripts/benchmark-wasm-parity.js`, `src/server.ts`, `src/server.migration.test.ts`, `src/wasm.parity.output.equivalence.contract.test.ts`, `src/wasm.parity.benchmark.contract.test.ts` | Phantom-backend dependency remains mitigated; deterministic fallback and API telemetry remain active; benchmark baseline evidence pipeline is now in place for worker↔wasm closure tracking. Current environment evidence still shows worker mode because wasm artifact is unavailable. | `node scripts/benchmark-wasm-parity.js 1 500`, `tmp/wasm-parity-benchmark/latest.json`, `src/runtime.transport.adapter.contract.test.ts`, `src/wasm.parity.runtime.contract.test.ts`, `src/wasm.parity.runtime.functional.test.ts`, `src/wasm.parity.output.equivalence.contract.test.ts`, `src/wasm.parity.benchmark.contract.test.ts`, `src/server.migration.test.ts` | Active wasm execution path (`wasm-adapter`) is still blocked by artifact availability in this environment; scale/perf closure remains pending. |
| **C-02** | **LOW (Resolved)** | `android/app/src/main/AndroidManifest.xml`, `package.json` | Android storage/media permission baseline + filesystem dependency remain in place. | `src/mobile.pipeline.test.ts` + manifest checks | Runtime still depends on user/device permission grant. |
| **H-01** | **LOW (Resolved)** | `scripts/build-sidecar.js`, `package.json` | Node EOL target remains removed; Node 22 + Brotli + `--no-bytecode` remains active. | sidecar build scripts + target map | Ongoing maintenance depends on `pkg` ecosystem cadence. |
| **H-02** | **LOW (Resolved)** | `scripts/build-sidecar.js`, `package.json` | Cross-platform sidecar strategy remains implemented. | `npm run build:sidecar`, `npm run build:sidecar:all` | Runtime execution still requires per-target release verification. |
| **M-01** | **LOW (Resolved)** | `src/server.ts` | Request-body memory hardening remains active (size limits + spool threshold + explicit status mapping). | `src/server.migration.test.ts` | High-concurrency large uploads can still raise disk I/O pressure by design. |

---

### Best Practices Compliance Checklist

| Standard | Status | Current Evidence | Remaining Work |
| :--- | :--- | :--- | :--- |
| **Data Layer Abstraction** | ✅ | Runtime capability split remains active across source/storage paths. | Keep adapter contracts stable while parity evolves. |
| **Mobile Runtime** | ⚠️ Partial | Capacitor worker-first local build fallback remains active; backend heavy compute now has JSON ABI path + orchestration contracts + retry/diagnostic resilience + API telemetry + benchmark evidence harness. | Close production wasm artifact parity and rerun worker↔wasm baselines with active wasm adapter mode. |
| **Node Version** | ✅ | Sidecar remains on `node22-*`. | Maintain LTS migration cadence. |
| **Storage Permissions** | ✅ | Android storage/media permission baseline is present. | Keep permission-denied UX regression coverage active. |
| **Brotli Compression** | ✅ | Sidecar build keeps `--compress Brotli` and `--no-bytecode`. | Continue binary-size drift monitoring. |
| **IPC Security** | ✅ | Authorized-only broadcast + unauthorized timeout + token-aware metadata are active. | Continue threat-model review for local process attack surfaces. |

---

### Verification Snapshot (2026-03-10)

- `npx jest src/wasm.parity.benchmark.contract.test.ts --runInBand` passed.
- `node scripts/benchmark-wasm-parity.js 1 500` passed and emitted evidence JSON.
- `npx tsc --pretty false` passed.
- `npm run test:migration` passed: **24 suites, 119 tests**.
- `npm run build` passed.
- `npm run test:tauri` passed: **19 Rust/Tauri tests**.
- `npm test` passed: **27 suites, 136 tests**.

---

## 中文文档

### 执行摘要

**混合架构风险评分：2.3/10（关键断点持续关闭，新增基准证据流水线）**

截至 **2026-03-10**，等价验证已具备可复现基准证据流水线：
- 新增确定性重图基准工具，支持延迟百分位与介数中心性等价汇总。
- 新增可执行基准脚本，执行 baseline（关闭 wasm）与 candidate（开启 wasm）并输出 JSON 证据。
- 新增基准统计与夹具不变量的契约覆盖。

当前证据位置：
- `tmp/wasm-parity-benchmark/latest.json`

本环境下观测结果：
- candidate 在 GraphMetrics/LayoutEngine 上仍为 worker 回退模式。
- `WasmParityRuntime` 诊断为 `artifact-not-found`，说明本环境尚未进入 `wasm-adapter` 执行路径。

剩余风险已收敛并明确化：
- 生产级 wasm 工件可用性与规模等价仍待闭环。
- 需要在 wasm 真正激活后补齐真实负载 worker↔wasm 基准收口。
- Android 真机验收证据仍依赖在线设备环境。

---

### 关键问题表

| ID | 当前严重程度 | 位置 | 当前状态（2026-03-10） | 验证证据 | 剩余风险 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **C-01** | **中（已缓解）** | `src/frontend/runtime_bridge.js`、`src/frontend/storage_provider.js`、`src/frontend/source_manager.js`、`src/frontend/path_app.js`、`src/core/PathBridge.ts`、`src/backend/algorithms/WasmParityRuntime.ts`、`src/backend/algorithms/LayoutEngine.ts`、`src/backend/GraphMetrics.ts`、`src/backend/algorithms/WasmParityBenchmark.ts`、`scripts/benchmark-wasm-parity.js`、`src/server.ts`、`src/server.migration.test.ts`、`src/wasm.parity.output.equivalence.contract.test.ts`、`src/wasm.parity.benchmark.contract.test.ts` | 幽灵后端依赖持续缓解；确定性回退和 API 遥测保持有效；worker↔wasm 基准证据流水线已落地。当前环境证据显示 wasm 工件不可用，candidate 仍为 worker 模式。 | `node scripts/benchmark-wasm-parity.js 1 500`、`tmp/wasm-parity-benchmark/latest.json`、`src/runtime.transport.adapter.contract.test.ts`、`src/wasm.parity.runtime.contract.test.ts`、`src/wasm.parity.runtime.functional.test.ts`、`src/wasm.parity.output.equivalence.contract.test.ts`、`src/wasm.parity.benchmark.contract.test.ts`、`src/server.migration.test.ts` | 本环境下 `wasm-adapter` 仍被工件可用性阻塞；规模性能闭环仍待完成。 |
| **C-02** | **低（已解决）** | `android/app/src/main/AndroidManifest.xml`、`package.json` | Android 存储/媒体权限基线和 filesystem 依赖持续有效。 | `src/mobile.pipeline.test.ts` + 清单断言 | 仍依赖设备权限授权。 |
| **H-01** | **低（已解决）** | `scripts/build-sidecar.js`、`package.json` | Node EOL 目标持续移除，保持 Node 22 + Brotli + `--no-bytecode`。 | sidecar 构建脚本与目标映射 | `pkg` 生态演进节奏仍需跟踪。 |
| **H-02** | **低（已解决）** | `scripts/build-sidecar.js`、`package.json` | 跨平台 sidecar 构建策略持续有效。 | `npm run build:sidecar`、`npm run build:sidecar:all` | 发布前仍需目标 OS 实机运行验证。 |
| **M-01** | **低（已解决）** | `src/server.ts` | 请求体内存安全加固持续有效。 | `src/server.migration.test.ts` | 高并发大请求下仍需容量化 I/O 规划。 |

---

### 最佳实践合规检查表

| 标准 | 状态 | 当前证据 | 剩余工作 |
| :--- | :--- | :--- | :--- |
| **数据层抽象** | ✅ | source/storage 运行时能力分流持续有效。 | 在等价性改造中保持契约稳定。 |
| **移动端运行时** | ⚠️ 部分完成 | Capacitor 本地构建为 Worker 优先回退；后端重计算已具备 JSON ABI + 编排契约 + 重试/诊断韧性 + API 遥测 + 基准证据脚手架。 | 闭环生产级 wasm 工件可用性，并在 wasm 激活后复跑 worker↔wasm 基准收口。 |
| **Node 版本** | ✅ | sidecar 目标保持 `node22-*`。 | 持续按 LTS 节奏升级。 |
| **存储权限** | ✅ | 清单与依赖保持存储/媒体读取基线。 | 持续回归权限拒绝场景。 |
| **Brotli 压缩** | ✅ | sidecar 构建保持 `--compress Brotli`。 | 持续监控二进制体积。 |
| **IPC 安全** | ✅ | 鉴权广播与未授权超时机制保持有效。 | 持续评估本地进程攻防边界。 |

---

### 验证快照（2026-03-10）

- `npx jest src/wasm.parity.benchmark.contract.test.ts --runInBand` 通过。
- `node scripts/benchmark-wasm-parity.js 1 500` 通过，并输出 JSON 证据。
- `npx tsc --pretty false` 通过。
- `npm run test:migration` 通过：**24 suites, 119 tests**。
- `npm run build` 通过。
- `npm run test:tauri` 通过：**19 项 Rust/Tauri 测试**。
- `npm test` 通过：**27 suites, 136 tests**。

---

# 2026-03-09 v1.0.11

# END-TO-END HYBRID ARCHITECTURE & PACKAGING AUDIT (HEAVY COMPUTE MODE TELEMETRY CONTRACTS)
**Date**: March 9, 2026
**Target**: NoteConnection (Hybrid Node.js + Capacitor + Tauri/pkg Architecture)

---

## ENGLISH DOCUMENT

### Executive Summary

**Hybrid Architecture Risk Score: 2.4/10 (CRITICAL BREAKPOINTS CLOSED, HEAVY-COMPUTE PATH OBSERVABILITY STRENGTHENED)**

As of **2026-03-09**, heavy-compute runtime behavior is now contract-observable:
- Added deterministic execution diagnostics in heavy-compute engines:
  - `GraphMetrics`: `none` / `wasm-adapter` / `worker` / `sequential`
  - `LayoutEngine`: `none` / `gpu` / `wasm-adapter` / `worker` / `skipped`
- Exposed compute-mode snapshot via authenticated APIs:
  - `GET /api/runtime-diagnostics`
  - `POST /api/build` (success + dedup responses)
- Added contracts proving telemetry shape and fallback-mode behavior without changing deterministic fallback semantics.

Remaining risk is still production-scale parity closure:
- Real wasm artifact parity/performance on full workloads remains open.
- Real workload worker↔wasm benchmark baselines (p95/p99 latency, memory) remain open.
- Android real-device acceptance evidence remains environment-dependent.

---

### Critical Issues Table

| ID | Severity (Current) | Location | Current Status (2026-03-09) | Verification Evidence | Residual Risk |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **C-01** | **MEDIUM (Mitigated)** | `src/frontend/runtime_bridge.js`, `src/frontend/storage_provider.js`, `src/frontend/source_manager.js`, `src/frontend/path_app.js`, `src/core/PathBridge.ts`, `src/backend/algorithms/WasmParityRuntime.ts`, `src/backend/algorithms/LayoutEngine.ts`, `src/backend/GraphMetrics.ts`, `src/server.ts`, `src/server.migration.test.ts`, `src/wasm.parity.output.equivalence.contract.test.ts` | Phantom-backend dependency remains mitigated. Capacitor native runtime remains storage-provider/filesystem based, sidecar bridge startup is skipped when unsupported, heavy compute path keeps deterministic fallback, and compute-mode telemetry is now API-visible and contract-guarded across wasm/worker/sequential/GPU/skipped routes. | `src/runtime.transport.adapter.contract.test.ts`, `src/source_manager.loadflow.test.ts`, `src/capacitor.runtime.contract.test.ts`, `src/storage.provider.contract.test.ts`, `src/storage.provider.capacitor.worker.contract.test.ts`, `src/wasm.parity.runtime.contract.test.ts`, `src/wasm.parity.runtime.functional.test.ts`, `src/wasm.parity.output.equivalence.contract.test.ts`, `src/server.migration.test.ts`, `src/pathbridge.handshake.contract.test.ts` | Production wasm artifact parity and real workload worker↔wasm benchmark closure remain pending. |
| **C-02** | **LOW (Resolved)** | `android/app/src/main/AndroidManifest.xml`, `package.json` | Android storage/media permission baseline + filesystem dependency remain in place. | `src/mobile.pipeline.test.ts` + manifest checks | Runtime still depends on user/device permission grant. |
| **H-01** | **LOW (Resolved)** | `scripts/build-sidecar.js`, `package.json` | Node EOL target remains removed; Node 22 + Brotli + `--no-bytecode` remains active. | sidecar build scripts + target map | Ongoing maintenance depends on `pkg` ecosystem cadence. |
| **H-02** | **LOW (Resolved)** | `scripts/build-sidecar.js`, `package.json` | Cross-platform sidecar strategy remains implemented. | `npm run build:sidecar`, `npm run build:sidecar:all` | Runtime execution still requires per-target release verification. |
| **M-01** | **LOW (Resolved)** | `src/server.ts` | Request-body memory hardening remains active (size limits + spool threshold + explicit status mapping). | `src/server.migration.test.ts` | High-concurrency large uploads can still raise disk I/O pressure by design. |

---

### Best Practices Compliance Checklist

| Standard | Status | Current Evidence | Remaining Work |
| :--- | :--- | :--- | :--- |
| **Data Layer Abstraction** | ✅ | Runtime capability split remains active across source/storage paths. | Keep adapter contracts stable while parity evolves. |
| **Mobile Runtime** | ⚠️ Partial | Capacitor worker-first local build fallback remains active; backend heavy compute now has JSON ABI path + orchestration contracts + retry/diagnostic resilience + API-level compute-mode telemetry. | Close production wasm artifact parity and real workload worker↔wasm benchmark/equivalence baselines. |
| **Node Version** | ✅ | Sidecar remains on `node22-*`. | Maintain LTS migration cadence. |
| **Storage Permissions** | ✅ | Android storage/media permission baseline is present. | Keep permission-denied UX regression coverage active. |
| **Brotli Compression** | ✅ | Sidecar build keeps `--compress Brotli` and `--no-bytecode`. | Continue binary-size drift monitoring. |
| **IPC Security** | ✅ | Authorized-only broadcast + unauthorized timeout + token-aware metadata are active. | Continue threat-model review for local process attack surfaces. |

---

### Verification Snapshot (2026-03-09)

- `npx jest src/wasm.parity.output.equivalence.contract.test.ts src/server.migration.test.ts --runInBand` passed.
- `npx tsc --pretty false` passed.
- `npm run test:migration` passed: **23 suites, 114 tests**.
- `npm run build` passed.
- `npm run test:tauri` passed: **19 Rust/Tauri tests**.
- `npm test` passed: **26 suites, 131 tests**.

---

## 中文文档

### 执行摘要

**混合架构风险评分：2.4/10（关键断点持续关闭，重计算路径可观测性进一步增强）**

截至 **2026-03-09**，重计算运行时行为已具备契约化可观测能力：
- 重计算引擎新增确定性执行诊断：
  - `GraphMetrics`：`none` / `wasm-adapter` / `worker` / `sequential`
  - `LayoutEngine`：`none` / `gpu` / `wasm-adapter` / `worker` / `skipped`
- 计算模式快照已通过鉴权 API 暴露：
  - `GET /api/runtime-diagnostics`
  - `POST /api/build`（成功与去重响应）
- 契约已验证诊断结构与回退路径行为，同时保持既有确定性回退语义不变。

当前剩余风险仍是生产级规模收口：
- 真实 wasm 工件在完整负载下的等价/性能仍待闭环。
- 真实负载 worker↔wasm 基准（p95/p99 延迟、内存画像）仍待闭环。
- Android 真机验收证据仍依赖在线设备环境。

---

### 关键问题表

| ID | 当前严重程度 | 位置 | 当前状态（2026-03-09） | 验证证据 | 剩余风险 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **C-01** | **中（已缓解）** | `src/frontend/runtime_bridge.js`、`src/frontend/storage_provider.js`、`src/frontend/source_manager.js`、`src/frontend/path_app.js`、`src/core/PathBridge.ts`、`src/backend/algorithms/WasmParityRuntime.ts`、`src/backend/algorithms/LayoutEngine.ts`、`src/backend/GraphMetrics.ts`、`src/server.ts`、`src/server.migration.test.ts`、`src/wasm.parity.output.equivalence.contract.test.ts` | 幽灵后端依赖持续缓解。Capacitor 原生运行时保持 storage-provider/filesystem 路径；不支持 sidecar 时跳过桥接；重计算链路继续保持确定性回退；并且 wasm/worker/sequential/GPU/skipped 计算模式已实现 API 级可观测与契约护栏。 | `src/runtime.transport.adapter.contract.test.ts`、`src/source_manager.loadflow.test.ts`、`src/capacitor.runtime.contract.test.ts`、`src/storage.provider.contract.test.ts`、`src/storage.provider.capacitor.worker.contract.test.ts`、`src/wasm.parity.runtime.contract.test.ts`、`src/wasm.parity.runtime.functional.test.ts`、`src/wasm.parity.output.equivalence.contract.test.ts`、`src/server.migration.test.ts`、`src/pathbridge.handshake.contract.test.ts` | 生产级 wasm 工件等价与真实负载 worker↔wasm 基准仍待闭环。 |
| **C-02** | **低（已解决）** | `android/app/src/main/AndroidManifest.xml`、`package.json` | Android 存储/媒体权限基线和 filesystem 依赖持续有效。 | `src/mobile.pipeline.test.ts` + 清单断言 | 仍依赖设备权限授权。 |
| **H-01** | **低（已解决）** | `scripts/build-sidecar.js`、`package.json` | Node EOL 目标持续移除，保持 Node 22 + Brotli + `--no-bytecode`。 | sidecar 构建脚本与目标映射 | `pkg` 生态演进节奏仍需跟踪。 |
| **H-02** | **低（已解决）** | `scripts/build-sidecar.js`、`package.json` | 跨平台 sidecar 构建策略持续有效。 | `npm run build:sidecar`、`npm run build:sidecar:all` | 发布前仍需目标 OS 实机运行验证。 |
| **M-01** | **低（已解决）** | `src/server.ts` | 请求体内存安全加固持续有效。 | `src/server.migration.test.ts` | 高并发大请求下仍需容量化 I/O 规划。 |

---

### 最佳实践合规检查表

| 标准 | 状态 | 当前证据 | 剩余工作 |
| :--- | :--- | :--- | :--- |
| **数据层抽象** | ✅ | source/storage 运行时能力分流持续有效。 | 在等价性改造中保持契约稳定。 |
| **移动端运行时** | ⚠️ 部分完成 | Capacitor 本地构建为 Worker 优先回退；后端重计算已具备 JSON ABI + 编排契约 + 重试/诊断韧性，并新增 API 级计算模式可观测能力。 | 闭环生产级 wasm 工件等价与真实负载 worker↔wasm 基准回归。 |
| **Node 版本** | ✅ | sidecar 目标保持 `node22-*`。 | 持续按 LTS 节奏升级。 |
| **存储权限** | ✅ | 清单与依赖保持存储/媒体读取基线。 | 持续回归权限拒绝场景。 |
| **Brotli 压缩** | ✅ | sidecar 构建保持 `--compress Brotli`。 | 持续监控二进制体积。 |
| **IPC 安全** | ✅ | 鉴权广播与未授权超时机制保持有效。 | 持续评估本地进程攻防边界。 |

---

### 验证快照（2026-03-09）

- `npx jest src/wasm.parity.output.equivalence.contract.test.ts src/server.migration.test.ts --runInBand` 通过。
- `npx tsc --pretty false` 通过。
- `npm run test:migration` 通过：**23 suites, 114 tests**。
- `npm run build` 通过。
- `npm run test:tauri` 通过：**19 项 Rust/Tauri 测试**。
- `npm test` 通过：**26 suites, 131 tests**。

---

# 2026-03-09 v1.0.10

# END-TO-END HYBRID ARCHITECTURE & PACKAGING AUDIT (RUNTIME DIAGNOSTICS EXPOSURE)
**Date**: March 9, 2026
**Target**: NoteConnection (Hybrid Node.js + Capacitor + Tauri/pkg Architecture)

---

## ENGLISH DOCUMENT

### Executive Summary

**Hybrid Architecture Risk Score: 2.6/10 (CRITICAL BREAKPOINTS CLOSED, DIAGNOSTIC OBSERVABILITY IMPROVED)**

As of **2026-03-09**, runtime observability is strengthened:
- Added authenticated sidecar diagnostics endpoint (`GET /api/runtime-diagnostics`).
- Exposed wasm parity runtime state (`WasmParityRuntime.getDiagnostics`) for release/triage workflows.
- Added contract coverage proving diagnostics payload does not leak auth token.

Remaining risk remains concentrated in production-scale parity:
- Real wasm artifact parity/performance at scale remains open.
- Worker↔wasm benchmark/equivalence baselines remain open.
- Android real-device acceptance evidence remains environment-dependent.

---

### Critical Issues Table

| ID | Severity (Current) | Location | Current Status (2026-03-09) | Verification Evidence | Residual Risk |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **C-01** | **MEDIUM (Mitigated)** | `src/frontend/runtime_bridge.js`, `src/frontend/storage_provider.js`, `src/frontend/source_manager.js`, `src/frontend/path_app.js`, `src/core/PathBridge.ts`, `src/backend/algorithms/WasmParityRuntime.ts`, `src/backend/algorithms/LayoutEngine.ts`, `src/backend/GraphMetrics.ts`, `src/server.ts`, `src/server.migration.test.ts` | Phantom-backend dependency remains mitigated. Capacitor native runtime remains storage-provider/filesystem based, sidecar bridge startup is skipped when unsupported, heavy compute path has wasm parity runtime contracts, and sidecar now exposes runtime/wasm diagnostics without credential leakage. | `src/runtime.transport.adapter.contract.test.ts`, `src/source_manager.loadflow.test.ts`, `src/capacitor.runtime.contract.test.ts`, `src/storage.provider.contract.test.ts`, `src/storage.provider.capacitor.worker.contract.test.ts`, `src/wasm.parity.runtime.contract.test.ts`, `src/wasm.parity.runtime.functional.test.ts`, `src/wasm.parity.output.equivalence.contract.test.ts`, `src/server.migration.test.ts`, `src/pathbridge.handshake.contract.test.ts` | Production wasm artifact parity and worker↔wasm benchmark/equivalence at scale remain pending. |
| **C-02** | **LOW (Resolved)** | `android/app/src/main/AndroidManifest.xml`, `package.json` | Android storage/media permission baseline + filesystem dependency remain in place. | `src/mobile.pipeline.test.ts` + manifest checks | Runtime still depends on user/device permission grant. |
| **H-01** | **LOW (Resolved)** | `scripts/build-sidecar.js`, `package.json` | Node EOL target remains removed; Node 22 + Brotli + `--no-bytecode` remains active. | sidecar build scripts + target map | Ongoing maintenance depends on `pkg` ecosystem cadence. |
| **H-02** | **LOW (Resolved)** | `scripts/build-sidecar.js`, `package.json` | Cross-platform sidecar strategy remains implemented. | `npm run build:sidecar`, `npm run build:sidecar:all` | Runtime execution still requires per-target release verification. |
| **M-01** | **LOW (Resolved)** | `src/server.ts` | Request-body memory hardening remains active (size limits + spool threshold + explicit status mapping). | `src/server.migration.test.ts` | High-concurrency large uploads can still raise disk I/O pressure by design. |

---

### Best Practices Compliance Checklist

| Standard | Status | Current Evidence | Remaining Work |
| :--- | :--- | :--- | :--- |
| **Data Layer Abstraction** | ✅ | Runtime capability split remains active across source/storage paths. | Keep adapter contracts stable while parity evolves. |
| **Mobile Runtime** | ⚠️ Partial | Capacitor worker-first local build fallback remains active; backend heavy compute now has JSON ABI path + orchestration contracts + retry/diagnostic resilience, and sidecar diagnostics endpoint for runtime triage. | Close production wasm artifact parity and worker↔wasm benchmark/equivalence baselines. |
| **Node Version** | ✅ | Sidecar remains on `node22-*`. | Maintain LTS migration cadence. |
| **Storage Permissions** | ✅ | Android storage/media permission baseline is present. | Keep permission-denied UX regression coverage active. |
| **Brotli Compression** | ✅ | Sidecar build keeps `--compress Brotli` and `--no-bytecode`. | Continue binary-size drift monitoring. |
| **IPC Security** | ✅ | Authorized-only broadcast + unauthorized timeout + token-aware metadata are active. | Continue threat-model review for local process attack surfaces. |

---

### Verification Snapshot (2026-03-09)

- `npx jest src/server.migration.test.ts src/wasm.parity.runtime.functional.test.ts src/wasm.parity.output.equivalence.contract.test.ts --runInBand` passed.
- `npx tsc --pretty false` passed.
- `npm run test:migration` passed: **23 suites, 112 tests**.
- `npm run build` passed.
- `npm run test:tauri` passed: **19 Rust/Tauri tests**.
- `npm test` passed: **26 suites, 129 tests**.

---

## 中文文档

### 执行摘要

**混合架构风险评分：2.6/10（关键断点持续关闭，诊断可观测性进一步增强）**

截至 **2026-03-09**，运行时可观测性继续增强：
- 新增鉴权 sidecar 诊断端点（`GET /api/runtime-diagnostics`）。
- 暴露 wasm parity 运行时状态（`WasmParityRuntime.getDiagnostics`）用于发布和排障。
- 新增契约覆盖，验证诊断返回不泄露 auth token。

当前剩余风险仍集中在生产级规模等价：
- 真实 wasm 工件在大规模场景下的等价/性能仍待闭环。
- worker↔wasm 的基准等价回归仍待闭环。
- Android 真机验收证据仍依赖在线设备环境。

---

### 关键问题表

| ID | 当前严重程度 | 位置 | 当前状态（2026-03-09） | 验证证据 | 剩余风险 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **C-01** | **中（已缓解）** | `src/frontend/runtime_bridge.js`、`src/frontend/storage_provider.js`、`src/frontend/source_manager.js`、`src/frontend/path_app.js`、`src/core/PathBridge.ts`、`src/backend/algorithms/WasmParityRuntime.ts`、`src/backend/algorithms/LayoutEngine.ts`、`src/backend/GraphMetrics.ts`、`src/server.ts`、`src/server.migration.test.ts` | 幽灵后端依赖持续缓解。Capacitor 原生运行时保持 storage-provider/filesystem 路径；不支持 sidecar 时跳过桥接；重计算链路保持 wasm parity 契约覆盖；新增 sidecar 运行时/wasm 诊断端点且不暴露凭据。 | `src/runtime.transport.adapter.contract.test.ts`、`src/source_manager.loadflow.test.ts`、`src/capacitor.runtime.contract.test.ts`、`src/storage.provider.contract.test.ts`、`src/storage.provider.capacitor.worker.contract.test.ts`、`src/wasm.parity.runtime.contract.test.ts`、`src/wasm.parity.runtime.functional.test.ts`、`src/wasm.parity.output.equivalence.contract.test.ts`、`src/server.migration.test.ts`、`src/pathbridge.handshake.contract.test.ts` | 生产级 wasm 工件等价与 worker↔wasm 大规模基准/一致性仍待闭环。 |
| **C-02** | **低（已解决）** | `android/app/src/main/AndroidManifest.xml`、`package.json` | Android 存储/媒体权限基线和 filesystem 依赖持续有效。 | `src/mobile.pipeline.test.ts` + 清单断言 | 仍依赖设备权限授权。 |
| **H-01** | **低（已解决）** | `scripts/build-sidecar.js`、`package.json` | Node EOL 目标持续移除，保持 Node 22 + Brotli + `--no-bytecode`。 | sidecar 构建脚本与目标映射 | `pkg` 生态演进节奏仍需跟踪。 |
| **H-02** | **低（已解决）** | `scripts/build-sidecar.js`、`package.json` | 跨平台 sidecar 构建策略持续有效。 | `npm run build:sidecar`、`npm run build:sidecar:all` | 发布前仍需目标 OS 实机运行验证。 |
| **M-01** | **低（已解决）** | `src/server.ts` | 请求体内存安全加固持续有效。 | `src/server.migration.test.ts` | 高并发大请求下仍需容量化 I/O 规划。 |

---

### 最佳实践合规检查表

| 标准 | 状态 | 当前证据 | 剩余工作 |
| :--- | :--- | :--- | :--- |
| **数据层抽象** | ✅ | source/storage 运行时能力分流持续有效。 | 在等价性改造中保持契约稳定。 |
| **移动端运行时** | ⚠️ 部分完成 | Capacitor 本地构建为 Worker 优先回退；后端重计算已具备 JSON ABI + 编排契约 + 重试/诊断韧性，并新增 sidecar 诊断端点。 | 闭环生产级 wasm 工件等价与 worker↔wasm 基准回归。 |
| **Node 版本** | ✅ | sidecar 目标保持 `node22-*`。 | 持续按 LTS 节奏升级。 |
| **存储权限** | ✅ | 清单与依赖保持存储/媒体读取基线。 | 持续回归权限拒绝场景。 |
| **Brotli 压缩** | ✅ | sidecar 构建保持 `--compress Brotli`。 | 持续监控二进制体积。 |
| **IPC 安全** | ✅ | 鉴权广播与未授权超时机制保持有效。 | 持续评估本地进程攻防边界。 |

---

### 验证快照（2026-03-09）

- `npx jest src/server.migration.test.ts src/wasm.parity.runtime.functional.test.ts src/wasm.parity.output.equivalence.contract.test.ts --runInBand` 通过。
- `npx tsc --pretty false` 通过。
- `npm run test:migration` 通过：**23 suites, 112 tests**。
- `npm run build` 通过。
- `npm run test:tauri` 通过：**19 项 Rust/Tauri 测试**。
- `npm test` 通过：**26 suites, 129 tests**。

---

# 2026-03-09 v1.0.9

# END-TO-END HYBRID ARCHITECTURE & PACKAGING AUDIT (WASM RUNTIME RESILIENCE)
**Date**: March 9, 2026
**Target**: NoteConnection (Hybrid Node.js + Capacitor + Tauri/pkg Architecture)

---

## ENGLISH DOCUMENT

### Executive Summary

**Hybrid Architecture Risk Score: 2.8/10 (CRITICAL BREAKPOINTS CLOSED, RUNTIME RESILIENCE IMPROVED)**

As of **2026-03-09**, runtime resilience was strengthened:
- WASM runtime now retries failed/missing artifact loads after a controlled retry window (`NOTE_CONNECTION_WASM_RETRY_MS`), avoiding permanent null-cache lock.
- Runtime diagnostics and execution-mode visibility were added (`getDiagnostics`, execution modes).
- Functional contracts now cover retry-window behavior and diagnostics visibility.

Remaining risk is no longer fallback reliability; it is production-scale parity:
- Real wasm artifact parity/performance at scale remains open.
- Worker↔wasm benchmark/equivalence baselines remain open.
- Android real-device acceptance evidence remains environment-dependent.

---

### Critical Issues Table

| ID | Severity (Current) | Location | Current Status (2026-03-09) | Verification Evidence | Residual Risk |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **C-01** | **MEDIUM (Mitigated)** | `src/frontend/runtime_bridge.js`, `src/frontend/storage_provider.js`, `src/frontend/source_manager.js`, `src/frontend/path_app.js`, `src/core/PathBridge.ts`, `src/backend/algorithms/WasmParityRuntime.ts`, `src/backend/algorithms/LayoutEngine.ts`, `src/backend/GraphMetrics.ts`, `src/wasm.parity.runtime.functional.test.ts`, `src/wasm.parity.output.equivalence.contract.test.ts` | Phantom-backend dependency remains mitigated. Capacitor native runtime is storage-provider/filesystem based, sidecar bridge startup is skipped when unsupported, and heavy compute routing now includes JSON ABI path + orchestration contracts + retry-window recoverability + diagnostics visibility. | `src/runtime.transport.adapter.contract.test.ts`, `src/source_manager.loadflow.test.ts`, `src/capacitor.runtime.contract.test.ts`, `src/storage.provider.contract.test.ts`, `src/storage.provider.capacitor.worker.contract.test.ts`, `src/wasm.parity.runtime.contract.test.ts`, `src/wasm.parity.runtime.functional.test.ts`, `src/wasm.parity.output.equivalence.contract.test.ts`, `src/pathbridge.handshake.contract.test.ts` | Production wasm artifact parity and worker↔wasm benchmark/equivalence at scale remain pending. |
| **C-02** | **LOW (Resolved)** | `android/app/src/main/AndroidManifest.xml`, `package.json` | Android storage/media permission baseline + filesystem dependency remain in place. | `src/mobile.pipeline.test.ts` + manifest checks | Runtime still depends on user/device permission grant. |
| **H-01** | **LOW (Resolved)** | `scripts/build-sidecar.js`, `package.json` | Node EOL target remains removed; Node 22 + Brotli + `--no-bytecode` remains active. | sidecar build scripts + target map | Ongoing maintenance depends on `pkg` ecosystem cadence. |
| **H-02** | **LOW (Resolved)** | `scripts/build-sidecar.js`, `package.json` | Cross-platform sidecar strategy remains implemented. | `npm run build:sidecar`, `npm run build:sidecar:all` | Runtime execution still requires per-target release verification. |
| **M-01** | **LOW (Resolved)** | `src/server.ts` | Request-body memory hardening remains active (size limits + spool threshold + explicit status mapping). | `src/server.migration.test.ts` | High-concurrency large uploads can still raise disk I/O pressure by design. |

---

### Best Practices Compliance Checklist

| Standard | Status | Current Evidence | Remaining Work |
| :--- | :--- | :--- | :--- |
| **Data Layer Abstraction** | ✅ | Runtime capability split remains active across source/storage paths. | Keep adapter contracts stable while parity evolves. |
| **Mobile Runtime** | ⚠️ Partial | Capacitor worker-first local build fallback remains active; backend heavy compute now has JSON ABI path + orchestration contracts + retry/diagnostic resilience. | Close production wasm artifact parity and worker↔wasm benchmark/equivalence baselines. |
| **Node Version** | ✅ | Sidecar remains on `node22-*`. | Maintain LTS migration cadence. |
| **Storage Permissions** | ✅ | Android storage/media permission baseline is present. | Keep permission-denied UX regression coverage active. |
| **Brotli Compression** | ✅ | Sidecar build keeps `--compress Brotli` and `--no-bytecode`. | Continue binary-size drift monitoring. |
| **IPC Security** | ✅ | Authorized-only broadcast + unauthorized timeout + token-aware metadata are active. | Continue threat-model review for local process attack surfaces. |

---

### Verification Snapshot (2026-03-09)

- `npx jest src/wasm.parity.runtime.functional.test.ts src/wasm.parity.runtime.contract.test.ts src/wasm.parity.output.equivalence.contract.test.ts --runInBand` passed.
- `npx tsc --pretty false` passed.
- `npm run test:migration` passed: **23 suites, 111 tests**.
- `npm run build` passed.
- `npm run test:tauri` passed: **19 Rust/Tauri tests**.
- `npm test` passed: **26 suites, 128 tests**.

---

## 中文文档

### 执行摘要

**混合架构风险评分：2.8/10（关键断点持续关闭，运行时韧性进一步增强）**

截至 **2026-03-09**，运行时韧性继续提升：
- WASM 运行时新增受控重试窗口（`NOTE_CONNECTION_WASM_RETRY_MS`），避免缺失工件导致永久 null 缓存锁死。
- 新增运行时诊断与执行模式可见性（`getDiagnostics` + execution mode）。
- 功能契约已覆盖重试窗口行为与诊断可见性。

当前剩余风险已从“回退可靠性”转为“生产级规模等价”：
- 真实 wasm 工件在大规模场景下的等价/性能仍待闭环。
- worker↔wasm 的基准等价回归仍待闭环。
- Android 真机验收证据仍依赖在线设备环境。

---

### 关键问题表

| ID | 当前严重程度 | 位置 | 当前状态（2026-03-09） | 验证证据 | 剩余风险 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **C-01** | **中（已缓解）** | `src/frontend/runtime_bridge.js`、`src/frontend/storage_provider.js`、`src/frontend/source_manager.js`、`src/frontend/path_app.js`、`src/core/PathBridge.ts`、`src/backend/algorithms/WasmParityRuntime.ts`、`src/backend/algorithms/LayoutEngine.ts`、`src/backend/GraphMetrics.ts`、`src/wasm.parity.runtime.functional.test.ts`、`src/wasm.parity.output.equivalence.contract.test.ts` | 幽灵后端依赖持续缓解。Capacitor 原生运行时保持 storage-provider/filesystem 路径；不支持 sidecar 时跳过桥接；重计算链路已具备 JSON ABI、编排契约、重试窗口可恢复性与诊断可见性。 | `src/runtime.transport.adapter.contract.test.ts`、`src/source_manager.loadflow.test.ts`、`src/capacitor.runtime.contract.test.ts`、`src/storage.provider.contract.test.ts`、`src/storage.provider.capacitor.worker.contract.test.ts`、`src/wasm.parity.runtime.contract.test.ts`、`src/wasm.parity.runtime.functional.test.ts`、`src/wasm.parity.output.equivalence.contract.test.ts`、`src/pathbridge.handshake.contract.test.ts` | 生产级 wasm 工件等价与 worker↔wasm 大规模基准/一致性仍待闭环。 |
| **C-02** | **低（已解决）** | `android/app/src/main/AndroidManifest.xml`、`package.json` | Android 存储/媒体权限基线和 filesystem 依赖持续有效。 | `src/mobile.pipeline.test.ts` + 清单断言 | 仍依赖设备权限授权。 |
| **H-01** | **低（已解决）** | `scripts/build-sidecar.js`、`package.json` | Node EOL 目标持续移除，保持 Node 22 + Brotli + `--no-bytecode`。 | sidecar 构建脚本与目标映射 | `pkg` 生态演进节奏仍需跟踪。 |
| **H-02** | **低（已解决）** | `scripts/build-sidecar.js`、`package.json` | 跨平台 sidecar 构建策略持续有效。 | `npm run build:sidecar`、`npm run build:sidecar:all` | 发布前仍需目标 OS 实机运行验证。 |
| **M-01** | **低（已解决）** | `src/server.ts` | 请求体内存安全加固持续有效。 | `src/server.migration.test.ts` | 高并发大请求下仍需容量化 I/O 规划。 |

---

### 最佳实践合规检查表

| 标准 | 状态 | 当前证据 | 剩余工作 |
| :--- | :--- | :--- | :--- |
| **数据层抽象** | ✅ | source/storage 运行时能力分流持续有效。 | 在等价性改造中保持契约稳定。 |
| **移动端运行时** | ⚠️ 部分完成 | Capacitor 本地构建为 Worker 优先回退；后端重计算已具备 JSON ABI + 编排契约 + 重试/诊断韧性。 | 闭环生产级 wasm 工件等价与 worker↔wasm 基准回归。 |
| **Node 版本** | ✅ | sidecar 目标保持 `node22-*`。 | 持续按 LTS 节奏升级。 |
| **存储权限** | ✅ | 清单与依赖保持存储/媒体读取基线。 | 持续回归权限拒绝场景。 |
| **Brotli 压缩** | ✅ | sidecar 构建保持 `--compress Brotli`。 | 持续监控二进制体积。 |
| **IPC 安全** | ✅ | 鉴权广播与未授权超时机制保持有效。 | 持续评估本地进程攻防边界。 |

---

### 验证快照（2026-03-09）

- `npx jest src/wasm.parity.runtime.functional.test.ts src/wasm.parity.runtime.contract.test.ts src/wasm.parity.output.equivalence.contract.test.ts --runInBand` 通过。
- `npx tsc --pretty false` 通过。
- `npm run test:migration` 通过：**23 suites, 111 tests**。
- `npm run build` 通过。
- `npm run test:tauri` 通过：**19 项 Rust/Tauri 测试**。
- `npm test` 通过：**26 suites, 128 tests**。

---

# 2026-03-09 v1.0.8

# END-TO-END HYBRID ARCHITECTURE & PACKAGING AUDIT (WASM PARITY ORCHESTRATION EQUIVALENCE)
**Date**: March 9, 2026
**Target**: NoteConnection (Hybrid Node.js + Capacitor + Tauri/pkg Architecture)

---

## ENGLISH DOCUMENT

### Executive Summary

**Hybrid Architecture Risk Score: 3.0/10 (CRITICAL BREAKPOINTS CLOSED, ORCHESTRATION PARITY COVERAGE EXPANDED)**

As of **2026-03-09**, parity hardening advanced again:
- Added orchestration-level output-equivalence contract coverage for heavy compute routing (`GraphMetrics` + `LayoutEngine`).
- `LayoutEngine` fallback flow now resolves worker runtime lazily, only when GPU/WASM paths do not satisfy layout.
- Full migration/build/Tauri/Jest gates remain green after the new contracts and runtime flow hardening.

Remaining risk is concentrated in production-grade parity closure:
- Real wasm artifact equivalence/performance at scale is still open.
- Worker↔wasm benchmark baselines are still open.
- Android real-device acceptance evidence remains environment-dependent.

---

### Critical Issues Table

| ID | Severity (Current) | Location | Current Status (2026-03-09) | Verification Evidence | Residual Risk |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **C-01** | **MEDIUM (Mitigated)** | `src/frontend/runtime_bridge.js`, `src/frontend/storage_provider.js`, `src/frontend/source_manager.js`, `src/frontend/path_app.js`, `src/core/PathBridge.ts`, `src/backend/algorithms/WasmParityRuntime.ts`, `src/backend/algorithms/LayoutEngine.ts`, `src/backend/GraphMetrics.ts`, `src/wasm.parity.output.equivalence.contract.test.ts` | Phantom-backend dependency remains mitigated. Capacitor native runtime stays filesystem/storage-provider based; sidecar bridge startup is skipped when unsupported; heavy compute path now has JSON ABI runtime coverage plus orchestration-level output-equivalence contracts. | `src/runtime.transport.adapter.contract.test.ts`, `src/source_manager.loadflow.test.ts`, `src/capacitor.runtime.contract.test.ts`, `src/storage.provider.contract.test.ts`, `src/storage.provider.capacitor.worker.contract.test.ts`, `src/wasm.parity.runtime.contract.test.ts`, `src/wasm.parity.runtime.functional.test.ts`, `src/wasm.parity.output.equivalence.contract.test.ts`, `src/pathbridge.handshake.contract.test.ts` | Production wasm artifact parity and worker↔wasm benchmark/equivalence at scale remain pending. |
| **C-02** | **LOW (Resolved)** | `android/app/src/main/AndroidManifest.xml`, `package.json` | Android storage/media permission baseline + filesystem dependency remain in place. | `src/mobile.pipeline.test.ts` + manifest checks | Runtime still depends on user/device permission grant. |
| **H-01** | **LOW (Resolved)** | `scripts/build-sidecar.js`, `package.json` | Node EOL target remains removed; Node 22 + Brotli + `--no-bytecode` remains active. | sidecar build scripts + target map | Ongoing maintenance depends on `pkg` ecosystem cadence. |
| **H-02** | **LOW (Resolved)** | `scripts/build-sidecar.js`, `package.json` | Cross-platform sidecar strategy remains implemented. | `npm run build:sidecar`, `npm run build:sidecar:all` | Runtime execution still requires per-target release verification. |
| **M-01** | **LOW (Resolved)** | `src/server.ts` | Request-body memory hardening remains active (size limits + spool threshold + explicit status mapping). | `src/server.migration.test.ts` | High-concurrency large uploads can still raise disk I/O pressure by design. |

---

### Best Practices Compliance Checklist

| Standard | Status | Current Evidence | Remaining Work |
| :--- | :--- | :--- | :--- |
| **Data Layer Abstraction** | ✅ | Runtime capability split remains active across source/storage paths. | Keep adapter contracts stable while parity evolves. |
| **Mobile Runtime** | ⚠️ Partial | Capacitor worker-first local build fallback remains active; backend heavy compute has JSON ABI runtime path and orchestration-level output-equivalence contracts. | Close production wasm artifact parity and worker↔wasm benchmark/equivalence baselines. |
| **Node Version** | ✅ | Sidecar remains on `node22-*`. | Maintain LTS migration cadence. |
| **Storage Permissions** | ✅ | Android storage/media permission baseline is present. | Keep permission-denied UX regression coverage active. |
| **Brotli Compression** | ✅ | Sidecar build keeps `--compress Brotli` and `--no-bytecode`. | Continue binary-size drift monitoring. |
| **IPC Security** | ✅ | Authorized-only broadcast + unauthorized timeout + token-aware metadata are active. | Continue threat-model review for local process attack surfaces. |

---

### Verification Snapshot (2026-03-09)

- `npx jest src/wasm.parity.output.equivalence.contract.test.ts src/wasm.parity.runtime.functional.test.ts src/wasm.parity.runtime.contract.test.ts --runInBand` passed.
- `npx tsc --pretty false` passed.
- `npm run test:migration` passed: **23 suites, 109 tests**.
- `npm run build` passed.
- `npm run test:tauri` passed: **19 Rust/Tauri tests**.
- `npm test` passed: **26 suites, 126 tests**.

---

## 中文文档

### 执行摘要

**混合架构风险评分：3.0/10（关键断点持续关闭，编排层等价覆盖进一步增强）**

截至 **2026-03-09**，等价性加固再次推进：
- 重计算链路新增编排层输出一致性契约（`GraphMetrics` + `LayoutEngine`）。
- `LayoutEngine` 回退流程改为惰性解析 worker 运行时，仅在 GPU/WASM 未满足时触发。
- 新增契约与运行时优化后，migration/build/Tauri/Jest 全门禁持续全绿。

当前剩余风险集中在生产级等价性收口：
- 真实 wasm 工件在大规模场景下的一致性/性能仍待闭环。
- worker↔wasm 的基准回归仍待闭环。
- Android 真机验收证据仍依赖在线设备环境。

---

### 关键问题表

| ID | 当前严重程度 | 位置 | 当前状态（2026-03-09） | 验证证据 | 剩余风险 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **C-01** | **中（已缓解）** | `src/frontend/runtime_bridge.js`、`src/frontend/storage_provider.js`、`src/frontend/source_manager.js`、`src/frontend/path_app.js`、`src/core/PathBridge.ts`、`src/backend/algorithms/WasmParityRuntime.ts`、`src/backend/algorithms/LayoutEngine.ts`、`src/backend/GraphMetrics.ts`、`src/wasm.parity.output.equivalence.contract.test.ts` | 幽灵后端依赖持续缓解。Capacitor 原生运行时保持 filesystem/storage-provider 路径；不支持 sidecar 时跳过桥接；重计算链路已具备 JSON ABI 运行时覆盖与编排层输出一致性契约。 | `src/runtime.transport.adapter.contract.test.ts`、`src/source_manager.loadflow.test.ts`、`src/capacitor.runtime.contract.test.ts`、`src/storage.provider.contract.test.ts`、`src/storage.provider.capacitor.worker.contract.test.ts`、`src/wasm.parity.runtime.contract.test.ts`、`src/wasm.parity.runtime.functional.test.ts`、`src/wasm.parity.output.equivalence.contract.test.ts`、`src/pathbridge.handshake.contract.test.ts` | 生产级 wasm 工件等价与 worker↔wasm 大规模基准/一致性仍待闭环。 |
| **C-02** | **低（已解决）** | `android/app/src/main/AndroidManifest.xml`、`package.json` | Android 存储/媒体权限基线和 filesystem 依赖持续有效。 | `src/mobile.pipeline.test.ts` + 清单断言 | 仍依赖设备权限授权。 |
| **H-01** | **低（已解决）** | `scripts/build-sidecar.js`、`package.json` | Node EOL 目标持续移除，保持 Node 22 + Brotli + `--no-bytecode`。 | sidecar 构建脚本与目标映射 | `pkg` 生态演进节奏仍需跟踪。 |
| **H-02** | **低（已解决）** | `scripts/build-sidecar.js`、`package.json` | 跨平台 sidecar 构建策略持续有效。 | `npm run build:sidecar`、`npm run build:sidecar:all` | 发布前仍需目标 OS 实机运行验证。 |
| **M-01** | **低（已解决）** | `src/server.ts` | 请求体内存安全加固持续有效。 | `src/server.migration.test.ts` | 高并发大请求下仍需容量化 I/O 规划。 |

---

### 最佳实践合规检查表

| 标准 | 状态 | 当前证据 | 剩余工作 |
| :--- | :--- | :--- | :--- |
| **数据层抽象** | ✅ | source/storage 运行时能力分流持续有效。 | 在等价性改造中保持契约稳定。 |
| **移动端运行时** | ⚠️ 部分完成 | Capacitor 本地构建为 Worker 优先回退；后端重计算已具备 JSON ABI 路径与编排层输出一致性契约。 | 闭环生产级 wasm 工件等价与 worker↔wasm 基准回归。 |
| **Node 版本** | ✅ | sidecar 目标保持 `node22-*`。 | 持续按 LTS 节奏升级。 |
| **存储权限** | ✅ | 清单与依赖保持存储/媒体读取基线。 | 持续回归权限拒绝场景。 |
| **Brotli 压缩** | ✅ | sidecar 构建保持 `--compress Brotli`。 | 持续监控二进制体积。 |
| **IPC 安全** | ✅ | 鉴权广播与未授权超时机制保持有效。 | 持续评估本地进程攻防边界。 |

---

### 验证快照（2026-03-09）

- `npx jest src/wasm.parity.output.equivalence.contract.test.ts src/wasm.parity.runtime.functional.test.ts src/wasm.parity.runtime.contract.test.ts --runInBand` 通过。
- `npx tsc --pretty false` 通过。
- `npm run test:migration` 通过：**23 suites, 109 tests**。
- `npm run build` 通过。
- `npm run test:tauri` 通过：**19 项 Rust/Tauri 测试**。
- `npm test` 通过：**26 suites, 126 tests**。

---

# 2026-03-09 v1.0.7

# END-TO-END HYBRID ARCHITECTURE & PACKAGING AUDIT (WASM PARITY CONTINUATION)
**Date**: March 9, 2026
**Target**: NoteConnection (Hybrid Node.js + Capacitor + Tauri/pkg Architecture)

---

## ENGLISH DOCUMENT

### Executive Summary

**Hybrid Architecture Risk Score: 3.2/10 (CRITICAL BREAKPOINTS CLOSED, WASM PARITY PARTIALLY CLOSED)**

As of **2026-03-09**, the WASM parity slice advanced from adapter wiring to JSON ABI result-path closure:
- Heavy compute runtime now supports JSON ABI calls for layout and betweenness with guarded memory ABI handling.
- Functional regression suite now validates JSON ABI success/fallback behavior (`src/wasm.parity.runtime.functional.test.ts`).
- Existing deterministic fallback remains intact when wasm artifact/ABI is unavailable or invalid.

Remaining risk is now concentrated in production parity closure:
- Real wasm artifact conformance across full-scale workloads remains pending.
- Node worker ↔ wasm output-equivalence/performance baselines are still open.
- Android real-device evidence remains environment-dependent.

---

### Critical Issues Table

| ID | Severity (Current) | Location | Current Status (2026-03-09) | Verification Evidence | Residual Risk |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **C-01** | **MEDIUM (Mitigated)** | `src/frontend/runtime_bridge.js`, `src/frontend/storage_provider.js`, `src/frontend/source_manager.js`, `src/frontend/path_app.js`, `src/core/PathBridge.ts`, `src/backend/algorithms/WasmParityRuntime.ts`, `src/backend/algorithms/LayoutEngine.ts`, `src/backend/GraphMetrics.ts` | Phantom-backend dependency remains mitigated. Capacitor native runtime follows storage-provider/filesystem path; sidecar bridge startup is skipped when unsupported; heavy compute path now includes JSON ABI wasm result ingestion with deterministic fallback. | `src/runtime.transport.adapter.contract.test.ts`, `src/source_manager.loadflow.test.ts`, `src/capacitor.runtime.contract.test.ts`, `src/storage.provider.contract.test.ts`, `src/storage.provider.capacitor.worker.contract.test.ts`, `src/wasm.parity.runtime.contract.test.ts`, `src/wasm.parity.runtime.functional.test.ts`, `src/pathbridge.handshake.contract.test.ts` | Production wasm artifact parity and worker↔wasm output-equivalence/performance closure are still pending. |
| **C-02** | **LOW (Resolved)** | `android/app/src/main/AndroidManifest.xml`, `package.json` | Android storage/media permission baseline + filesystem dependency remain in place. | `src/mobile.pipeline.test.ts` + manifest checks | Runtime still depends on user/device permission grant. |
| **H-01** | **LOW (Resolved)** | `scripts/build-sidecar.js`, `package.json` | Node EOL target remains removed; Node 22 + Brotli + `--no-bytecode` remains active. | sidecar build scripts + target map | Ongoing maintenance depends on `pkg` ecosystem cadence. |
| **H-02** | **LOW (Resolved)** | `scripts/build-sidecar.js`, `package.json` | Cross-platform sidecar strategy remains implemented. | `npm run build:sidecar`, `npm run build:sidecar:all` | Runtime execution still requires per-target release verification. |
| **M-01** | **LOW (Resolved)** | `src/server.ts` | Request-body memory hardening remains active (size limits + spool threshold + explicit status mapping). | `src/server.migration.test.ts` | High-concurrency large uploads can still raise disk I/O pressure by design. |

---

### Best Practices Compliance Checklist

| Standard | Status | Current Evidence | Remaining Work |
| :--- | :--- | :--- | :--- |
| **Data Layer Abstraction** | ✅ | Runtime capability split remains active across source/storage paths. | Keep adapter contracts stable while parity evolves. |
| **Mobile Runtime** | ⚠️ Partial | Capacitor worker-first local build fallback is active; heavy backend path now supports JSON ABI wasm result path with fallback. | Close production wasm artifact parity and output-equivalence/performance baselines. |
| **Node Version** | ✅ | Sidecar remains on `node22-*`. | Maintain LTS migration cadence. |
| **Storage Permissions** | ✅ | Android storage/media permission baseline is present. | Keep permission-denied UX regression coverage active. |
| **Brotli Compression** | ✅ | Sidecar build keeps `--compress Brotli` and `--no-bytecode`. | Continue binary-size drift monitoring. |
| **IPC Security** | ✅ | Authorized-only broadcast + unauthorized timeout + token-aware metadata are active. | Continue threat-model review for local process attack surfaces. |

---

### Verification Snapshot (2026-03-09)

- `npx jest src/wasm.parity.runtime.contract.test.ts src/wasm.parity.runtime.functional.test.ts --runInBand` passed.
- `npx tsc --pretty false` passed.
- `npm run test:migration` passed: **22 suites, 107 tests**.
- `npm run build` passed.
- `npm run test:tauri` passed: **19 Rust/Tauri tests**.
- `npm test` passed: **25 suites, 124 tests**.

---

## 中文文档

### 执行摘要

**混合架构风险评分：3.2/10（关键断点持续关闭，WASM 等价性已部分闭环）**

截至 **2026-03-09**，WASM 等价切片已从“接线阶段”推进到“JSON ABI 结果路径闭环”：
- 重计算运行时已支持布局/中心性的 JSON ABI 调用，并具备内存 ABI 防护。
- 新增功能回归套件，覆盖 JSON ABI 成功与失败回退行为（`src/wasm.parity.runtime.functional.test.ts`）。
- 在 wasm 工件/ABI 缺失或异常时，仍保持既有确定性回退链路。

当前剩余风险集中在生产级等价性收口：
- 面向大规模场景的真实 wasm 工件一致性仍待闭环。
- Node worker 与 wasm 的结果一致性/性能基线仍待闭环。
- Android 真机证据仍依赖在线设备环境。

---

### 关键问题表

| ID | 当前严重程度 | 位置 | 当前状态（2026-03-09） | 验证证据 | 剩余风险 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **C-01** | **中（已缓解）** | `src/frontend/runtime_bridge.js`、`src/frontend/storage_provider.js`、`src/frontend/source_manager.js`、`src/frontend/path_app.js`、`src/core/PathBridge.ts`、`src/backend/algorithms/WasmParityRuntime.ts`、`src/backend/algorithms/LayoutEngine.ts`、`src/backend/GraphMetrics.ts` | 幽灵后端依赖持续缓解。Capacitor 原生运行时走 storage-provider/filesystem；不支持 sidecar 时跳过桥接；重计算链路新增 JSON ABI wasm 结果消费并保持确定性回退。 | `src/runtime.transport.adapter.contract.test.ts`、`src/source_manager.loadflow.test.ts`、`src/capacitor.runtime.contract.test.ts`、`src/storage.provider.contract.test.ts`、`src/storage.provider.capacitor.worker.contract.test.ts`、`src/wasm.parity.runtime.contract.test.ts`、`src/wasm.parity.runtime.functional.test.ts`、`src/pathbridge.handshake.contract.test.ts` | 生产级 wasm 工件等价与 worker↔wasm 结果一致性/性能基线仍待闭环。 |
| **C-02** | **低（已解决）** | `android/app/src/main/AndroidManifest.xml`、`package.json` | Android 存储/媒体权限基线和 filesystem 依赖持续有效。 | `src/mobile.pipeline.test.ts` + 清单断言 | 仍依赖设备权限授权。 |
| **H-01** | **低（已解决）** | `scripts/build-sidecar.js`、`package.json` | Node EOL 目标持续移除，保持 Node 22 + Brotli + `--no-bytecode`。 | sidecar 构建脚本与目标映射 | `pkg` 生态演进节奏仍需跟踪。 |
| **H-02** | **低（已解决）** | `scripts/build-sidecar.js`、`package.json` | 跨平台 sidecar 构建策略持续有效。 | `npm run build:sidecar`、`npm run build:sidecar:all` | 发布前仍需目标 OS 实机运行验证。 |
| **M-01** | **低（已解决）** | `src/server.ts` | 请求体内存安全加固持续有效。 | `src/server.migration.test.ts` | 高并发大请求下仍需容量化 I/O 规划。 |

---

### 最佳实践合规检查表

| 标准 | 状态 | 当前证据 | 剩余工作 |
| :--- | :--- | :--- | :--- |
| **数据层抽象** | ✅ | source/storage 运行时能力分流持续有效。 | 在等价性改造中保持契约稳定。 |
| **移动端运行时** | ⚠️ 部分完成 | Capacitor 本地构建为 Worker 优先回退；后端重计算已支持 JSON ABI wasm 结果路径并保留回退。 | 闭环生产级 wasm 工件等价与结果一致性/性能基线。 |
| **Node 版本** | ✅ | sidecar 目标保持 `node22-*`。 | 持续按 LTS 节奏升级。 |
| **存储权限** | ✅ | 清单与依赖保持存储/媒体读取基线。 | 持续回归权限拒绝场景。 |
| **Brotli 压缩** | ✅ | sidecar 构建保持 `--compress Brotli`。 | 持续监控二进制体积。 |
| **IPC 安全** | ✅ | 鉴权广播与未授权超时机制保持有效。 | 持续评估本地进程攻防边界。 |

---

### 验证快照（2026-03-09）

- `npx jest src/wasm.parity.runtime.contract.test.ts src/wasm.parity.runtime.functional.test.ts --runInBand` 通过。
- `npx tsc --pretty false` 通过。
- `npm run test:migration` 通过：**22 suites, 107 tests**。
- `npm run build` 通过。
- `npm run test:tauri` 通过：**19 项 Rust/Tauri 测试**。
- `npm test` 通过：**25 suites, 124 tests**。

---

# 2026-03-09 v1.0.6

# END-TO-END HYBRID ARCHITECTURE & PACKAGING AUDIT
**Date**: March 9, 2026
**Target**: NoteConnection (Hybrid Node.js + Capacitor + Tauri/pkg Architecture)

---

## ENGLISH DOCUMENT

### Executive Summary

**Hybrid Architecture Risk Score: 3.5/10 (CRITICAL BREAKPOINTS CLOSED, PARITY/RELEASE RISK REMAINS)**

As of **2026-03-09**, previously critical breakpoints remain closed and the parity slice has advanced:
- Mobile runtime no longer hard-depends on localhost sidecar APIs for content/build flows.
- PathBridge handshake/fan-out is tokenized, authorized-only, and timeout-guarded for unauthorized clients.
- Sidecar packaging remains on Node 22 + Brotli + multi-target strategy.
- `server.ts` request-body path remains bounded/spooled for memory safety.
- New parity slice: heavy compute entrypoints (`LayoutEngine`, `GraphMetrics`) now route through a shared WASM parity runtime adapter before worker/sequential fallback.

Remaining risk is parity closure, not architectural breakage:
- WASM artifact ABI/output contract for real layout/centrality compute is not closed yet.
- Large-scale parity still relies on existing Node worker/sequential fallback behavior.
- Real-device acceptance evidence still requires an online Android device.

---

### Critical Issues Table

| ID | Severity (Current) | Location | Current Status (2026-03-09) | Verification Evidence | Residual Risk |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **C-01** | **MEDIUM (Mitigated)** | `src/frontend/runtime_bridge.js`, `src/frontend/storage_provider.js`, `src/frontend/source_manager.js`, `src/frontend/path_app.js`, `src/core/PathBridge.ts`, `src/backend/algorithms/WasmParityRuntime.ts`, `src/backend/algorithms/LayoutEngine.ts`, `src/backend/GraphMetrics.ts` | Phantom-backend dependency remains mitigated. Capacitor native runtime routes through storage-provider/filesystem, sidecar bridge startup is skipped when unsupported, and backend heavy compute now includes WASM parity adapter routing with deterministic fallback. | `src/runtime.transport.adapter.contract.test.ts`, `src/source_manager.loadflow.test.ts`, `src/capacitor.runtime.contract.test.ts`, `src/storage.provider.contract.test.ts`, `src/storage.provider.capacitor.worker.contract.test.ts`, `src/wasm.parity.runtime.contract.test.ts`, `src/pathbridge.handshake.contract.test.ts` | WASM output ABI not yet closed; heavy compute still falls back to Node worker/sequential runtime for actual parity output. |
| **C-02** | **LOW (Resolved)** | `android/app/src/main/AndroidManifest.xml`, `package.json` | Android storage/media permission baseline + filesystem dependency remain in place. | `src/mobile.pipeline.test.ts` + manifest checks | Runtime still depends on user/device permission grant. |
| **H-01** | **LOW (Resolved)** | `scripts/build-sidecar.js`, `package.json` | Node EOL target remains removed; Node 22 + Brotli + `--no-bytecode` is retained. | sidecar build scripts + target map | Ongoing maintenance depends on `pkg` ecosystem cadence. |
| **H-02** | **LOW (Resolved)** | `scripts/build-sidecar.js`, `package.json` | Cross-platform sidecar strategy remains implemented. | `npm run build:sidecar`, `npm run build:sidecar:all` | Runtime execution must still be validated per target OS at release time. |
| **M-01** | **LOW (Resolved)** | `src/server.ts` | Request-body memory hardening remains active (size limits + spool threshold + explicit status mapping). | `src/server.migration.test.ts` | High-concurrency large uploads can still raise disk I/O pressure by design. |

---

### Best Practices Compliance Checklist

| Standard | Status | Current Evidence | Remaining Work |
| :--- | :--- | :--- | :--- |
| **Data Layer Abstraction** | ✅ | Runtime capability split remains active across source/storage paths. | Keep adapter contracts stable while parity slice evolves. |
| **Mobile Runtime** | ⚠️ Partial | Worker-first local build fallback is active on Capacitor; heavy backend paths now include WASM parity adapter routing. | Close WASM ABI + output parity for layout/centrality and validate at scale. |
| **Node Version** | ✅ | Sidecar remains on `node22-*`. | Maintain LTS migration cadence. |
| **Storage Permissions** | ✅ | Android storage/media permission baseline is present. | Keep permission-denied UX regression coverage active. |
| **Brotli Compression** | ✅ | Sidecar build keeps `--compress Brotli` and `--no-bytecode`. | Continue binary-size drift monitoring. |
| **IPC Security** | ✅ | Authorized-only broadcast + unauthorized timeout + token-aware metadata are active. | Continue threat-model review for local process attack surfaces. |

---

### Verification Snapshot (2026-03-09)

- `npm run test:migration` passed: **21 suites, 103 tests**.
- `npm run build` passed.
- `npm run test:tauri` passed: **19 Rust/Tauri tests**.
- `npm test` passed: **24 suites, 120 tests**.

---

### Refactoring Plan (Remaining)

1. Close WASM memory ABI and result contracts for heavy layout/centrality compute.
2. Add output-equivalence regression tests between Node worker and WASM paths.
3. Expose runtime capability telemetry (`worker`, `single-thread-fallback`, `wasm-adapter`, `desktop-full`) in UI/diagnostics.
4. Keep macOS/Linux runtime execution and Android device evidence as release gates.

---

## 中文文档

### 执行摘要

**混合架构风险评分：3.5/10（关键断点已关闭，但等价性/发布风险仍存在）**

截至 **2026-03-09**，关键断点持续关闭且等价性切片继续推进：
- 移动端内容/构建链路不再硬依赖 localhost sidecar。
- PathBridge 已具备 token 化鉴权、仅授权广播、未授权超时断开。
- Sidecar 仍保持 Node 22 + Brotli + 多目标构建策略。
- `server.ts` 请求体路径仍保持大小限制与落盘分流。
- 新增：后端重计算入口（`LayoutEngine`、`GraphMetrics`）已接入共享 WASM 等价运行时适配器，并在失败时确定性回退。

当前剩余风险是等价性闭环，而非架构断裂：
- WASM 工件 ABI 与结果输出契约尚未闭环。
- 大规模重计算结果当前仍以 Node worker/顺序回退链路为主。
- 真机验收证据仍依赖在线 Android 设备。

---

### 关键问题表

| ID | 当前严重程度 | 位置 | 当前状态（2026-03-09） | 验证证据 | 剩余风险 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **C-01** | **中（已缓解）** | `src/frontend/runtime_bridge.js`、`src/frontend/storage_provider.js`、`src/frontend/source_manager.js`、`src/frontend/path_app.js`、`src/core/PathBridge.ts`、`src/backend/algorithms/WasmParityRuntime.ts`、`src/backend/algorithms/LayoutEngine.ts`、`src/backend/GraphMetrics.ts` | 幽灵后端依赖持续缓解。Capacitor 原生运行时走 storage-provider/filesystem；不支持 sidecar 时跳过桥接；后端重计算入口新增 WASM 等价运行时适配并保持确定性回退。 | `src/runtime.transport.adapter.contract.test.ts`、`src/source_manager.loadflow.test.ts`、`src/capacitor.runtime.contract.test.ts`、`src/storage.provider.contract.test.ts`、`src/storage.provider.capacitor.worker.contract.test.ts`、`src/wasm.parity.runtime.contract.test.ts`、`src/pathbridge.handshake.contract.test.ts` | WASM 输出 ABI 未闭环，重计算结果仍主要回退到 Node worker/顺序路径。 |
| **C-02** | **低（已解决）** | `android/app/src/main/AndroidManifest.xml`、`package.json` | Android 存储/媒体权限基线和 filesystem 依赖持续有效。 | `src/mobile.pipeline.test.ts` + 清单断言 | 仍依赖设备权限授权。 |
| **H-01** | **低（已解决）** | `scripts/build-sidecar.js`、`package.json` | Node EOL 目标持续移除，保持 Node 22 + Brotli + `--no-bytecode`。 | sidecar 构建脚本与目标映射 | `pkg` 生态演进节奏仍需跟踪。 |
| **H-02** | **低（已解决）** | `scripts/build-sidecar.js`、`package.json` | 跨平台 sidecar 构建策略持续有效。 | `npm run build:sidecar`、`npm run build:sidecar:all` | 发布前仍需目标 OS 实机运行验证。 |
| **M-01** | **低（已解决）** | `src/server.ts` | 请求体内存安全加固持续有效。 | `src/server.migration.test.ts` | 高并发大请求下仍需容量化 I/O 规划。 |

---

### 最佳实践合规检查表

| 标准 | 状态 | 当前证据 | 剩余工作 |
| :--- | :--- | :--- | :--- |
| **数据层抽象** | ✅ | source/storage 运行时能力分流持续有效。 | 在等价性改造中保持契约稳定。 |
| **移动端运行时** | ⚠️ 部分完成 | Capacitor 本地构建为 Worker 优先回退；后端重计算入口已接入 WASM 等价适配接线。 | 需闭环 WASM ABI + 结果路径并验证规模性能。 |
| **Node 版本** | ✅ | sidecar 目标保持 `node22-*`。 | 持续按 LTS 节奏升级。 |
| **存储权限** | ✅ | 清单与依赖保持存储/媒体读取基线。 | 持续回归权限拒绝场景。 |
| **Brotli 压缩** | ✅ | sidecar 构建保持 `--compress Brotli`。 | 持续监控二进制体积。 |
| **IPC 安全** | ✅ | 鉴权广播与未授权超时机制保持有效。 | 持续评估本地进程攻防边界。 |

---

### 验证快照（2026-03-09）

- `npm run test:migration` 通过：**21 suites, 103 tests**。
- `npm run build` 通过。
- `npm run test:tauri` 通过：**19 项 Rust/Tauri 测试**。
- `npm test` 通过：**24 suites, 120 tests**。

---

### 后续收口计划

1. 闭环 WASM 内存 ABI 与布局/中心性输出契约。
2. 增加 Node worker 与 WASM 结果一致性回归测试。
3. 在 UI/诊断中显式暴露 `worker` / `single-thread-fallback` / `wasm-adapter` / `desktop-full` 能力态。
4. 持续保留 macOS/Linux 运行验证与 Android 真机证据作为发布门禁。

