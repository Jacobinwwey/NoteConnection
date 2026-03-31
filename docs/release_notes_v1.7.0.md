# NoteConnection v1.7.0

## English

### Release Scope

- Compare baseline: `v1.6.8..v1.7.0`
- Release focus:
  - startup performance acceleration rollout closure
  - multi-platform startup validation automation
  - roadmap consolidation for next-stage learning-system evolution

### Highlights

- Completed the startup acceleration loop with phase-2/3/4 runtime behavior upgrades:
  - delta tick transport for startup simulation updates
  - low-alpha adaptive startup throttling policies
  - staged edge rendering and startup overlay flow hardening
- Added strict warm-start snapshot validation guardrails:
  - fingerprint consistency checks
  - snapshot age and topology consistency checks
  - coverage threshold checks before applying persisted layout
- Added frame-coalesced tick application on the main thread to reduce redundant repaint pressure during startup stabilization.

### Startup Performance and Validation Pipeline

- Extended startup performance tooling with:
  - baseline/pilot compare report generation
  - cross-platform matrix report generation
  - real-time watch mode for strict gate evaluation
  - no-hardware signoff pipeline using Windows real logs plus simulated cohort gates
- Preserved release safety boundaries by explicitly separating:
  - engineering signoff (no-hardware acceptable)
  - release signoff (requires real macOS/Android/iOS cohorts)

### Runtime Contract and Documentation Sync

- Synced runtime contract references in Diataxis docs for new startup profile fields and tick summary telemetry.
- Updated bilingual startup acceleration explanation docs with v1.1 optimization and risk-guardrail closure details.
- Added the next-stage knowledge-mastery evolution roadmap docs and integrated them into Diataxis nav and mapping.

### Version Metadata

- Aligned release metadata to `1.7.0` in:
  - `package.json`
  - `package-lock.json`
  - `src-tauri/tauri.conf.json`

### GitHub Release Body Template (Ready-to-Use)

Use this section as the GitHub Release description body with minimal edits:

1. Summary:
   - This release closes the startup performance acceleration rollout and upgrades startup reliability guardrails.
2. What is new:
   - low-alpha adaptive delta transport
   - frame-coalesced startup tick apply
   - strict warm snapshot validation
   - automated startup compare/matrix/signoff pipeline
3. Operational note:
   - Engineering signoff can proceed with no-hardware flow, but release signoff still requires real multi-device cohort evidence.
4. Docs:
   - Runtime contracts and startup acceleration docs are synchronized in bilingual Diataxis references.

---

## 中文

### 发布范围

- 对比基线：`v1.6.8..v1.7.0`
- 本次发布重点：
  - 启动性能提速方案收口
  - 多平台启动验证自动化链路补齐
  - 下一阶段学习系统演进路线文档固化

### 版本亮点

- 完成启动提速 Phase 2/3/4 运行时行为升级：
  - 启动期 Delta Tick 传输
  - 低 alpha 自适应限流策略
  - 分阶段边渲染与启动遮罩链路加固
- 补齐 Warm Snapshot 严格校验护栏：
  - 指纹一致性校验
  - 快照时效与拓扑一致性校验
  - 应用前覆盖率阈值校验
- 在主线程引入启动期 Tick 帧级合并应用，减少稳定阶段冗余重绘压力。

### 启动性能与验收流水线

- 启动性能工具链扩展为：
  - baseline/pilot 对比报表
  - 多平台矩阵报表
  - 准实时严格门禁 watch 模式
  - 无多端硬件场景下的工程签收流水线（Windows 真实日志 + 模拟 cohort 门禁）
- 保留分层签收边界：
  - 工程签收可接受 no-hardware 流程
  - 发布签收仍要求真实 macOS/Android/iOS cohort 证据

### 运行时契约与文档同步

- Diataxis 参考文档已同步新增启动 profile 字段与 tick summary 观测契约。
- 双语启动提速解释文档已补齐 v1.1 优化与风险护栏收口内容。
- 新增“知识彻底掌握演进路线”文档，并接入 Diataxis 导航与映射体系。

### 版本元数据

- 以下文件版本已统一到 `1.7.0`：
  - `package.json`
  - `package-lock.json`
  - `src-tauri/tauri.conf.json`

### GitHub Release 正文模板（可直接使用）

可将以下内容直接作为 GitHub Release 正文，并按需微调：

1. 概要：
   - 本版本完成启动性能提速方案收口，并强化启动期稳定性护栏。
2. 核心新增：
   - 低 alpha 自适应 Delta 传输
   - 启动 Tick 帧级合并应用
   - Warm Snapshot 严格校验
   - 启动 compare/matrix/signoff 自动化流水线
3. 运维说明：
   - 工程签收可走 no-hardware 流程，但发布签收仍需真实多端 cohort。
4. 文档说明：
   - 运行时契约与启动提速文档已在双语 Diataxis 体系内完成同步。
