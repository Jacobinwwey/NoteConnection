# 2026-03-10 v1.0.17

# BRIDGE HARDENING EXECUTION UPDATE (STRICT ENVELOPE + BACKPRESSURE + CSP/PKG CONTRACTS)

## ENGLISH DOCUMENT

### Remediation Status (This Slice)
- [x] Untyped IPC ingress is hardened in `src/core/PathBridge.ts`:
  - [x] Added `parseBridgeInboundEnvelope(...)` for strict envelope parsing.
  - [x] Added known-message payload shape validation.
  - [x] Added 1 MiB inbound frame limit (`MAX_INBOUND_MESSAGE_BYTES`).
- [x] Bridge backpressure is now enforced:
  - [x] Added per-client bounded outbound queue state.
  - [x] Added `bufferedAmount` gating with scheduled queue draining.
  - [x] Added overflow drop logging and queue cleanup on disconnect/close.
- [x] Packaging robustness now has explicit CI contract coverage:
  - [x] Added `src/pkg.sidecar.contract.test.ts`.
  - [x] Added sidecar/pkg contract suite into `npm run test:migration`.
- [x] Security hardening advanced with CSP tightening in `src/frontend/index.html`:
  - [x] Added `object-src 'none'`.
  - [x] Added `base-uri 'self'`.
  - [x] Added `frame-ancestors 'none'`.
  - [x] Added `form-action 'self'`.
- [ ] Remaining imported-baseline work still open: base64 heavy-transfer optimization and mobile semantic DOM accessibility path.

### Verification Snapshot (2026-03-10)
- [x] `npx jest src/pathbridge.handshake.contract.test.ts src/pkg.sidecar.contract.test.ts --runInBand`
- [x] `npm run test:migration` passed (**28 suites, 135 tests**).
- [x] `npm test` passed (**31 suites, 152 tests**).
- [x] `npm run build` passed.

---

## 中文文档

### 本轮整改状态
- [x] `src/core/PathBridge.ts` 已完成 IPC 入口强类型化加固：
  - [x] 新增 `parseBridgeInboundEnvelope(...)`，对桥接消息包进行严格解析。
  - [x] 新增已知消息类型的负载结构校验。
  - [x] 新增 1 MiB 入站消息大小限制（`MAX_INBOUND_MESSAGE_BYTES`）。
- [x] 已补齐桥接背压机制：
  - [x] 新增按客户端维度的有界出站队列状态。
  - [x] 新增 `bufferedAmount` 门控与定时排队排空策略。
  - [x] 新增队列溢出丢弃日志与断连/关闭时清理逻辑。
- [x] 打包稳健性已补齐显式 CI 契约覆盖：
  - [x] 新增 `src/pkg.sidecar.contract.test.ts`。
  - [x] 在 `npm run test:migration` 中纳入 sidecar/pkg 契约测试。
- [x] 安全加固已推进：`src/frontend/index.html` 的 CSP 已强化：
  - [x] 新增 `object-src 'none'`。
  - [x] 新增 `base-uri 'self'`。
  - [x] 新增 `frame-ancestors 'none'`。
  - [x] 新增 `form-action 'self'`。
- [ ] 导入基线中的剩余未完成项：Base64 重负载传输优化与移动端语义 DOM 可访问性路径。

### 验证快照（2026-03-10）
- [x] `npx jest src/pathbridge.handshake.contract.test.ts src/pkg.sidecar.contract.test.ts --runInBand`
- [x] `npm run test:migration` 通过（**28 suites, 135 tests**）。
- [x] `npm test` 通过（**31 suites, 152 tests**）。
- [x] `npm run build` 通过。

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
