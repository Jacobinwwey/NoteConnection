# 参考：接口与运行时契约

本页用于集中查看权威 API/运行时契约。

## 主要契约文档

- [docs/zh/Interface Document.md](../../../zh/Interface%20Document.md)
- [docs/zh/User_Manual.md](../../../zh/User_Manual.md)

## 集成专题参考

- [Godot + NoteMD + Markdown 接口](./godot-notemd-markdown-interfaces.md)
- [Godot + NoteMD + Markdown 工作流](../how-to/godot-notemd-markdown-workflows.md)

## v1.6.0 关键运行时契约点

- 前端运行时能力水合 invoke 契约：
  - `invoke('get_runtime_capabilities')`
  - `invoke('get_sidecar_runtime_config')`
- Rust sidecar 运行时配置命令：
  - `get_sidecar_runtime_config`
- Rust 应用运行时配置命令：
  - `get_app_runtime_config`
- Runtime bridge 通过 `whenReady()` 保障调用时序。

## 启动性能观测与试点 Profile（v1.7.0+ 试点）

- 前端启动关键点采用单次日志输出：
  - `T0 app_boot`
  - `T1 graph_preprocessed`
  - `T2 worker_init_sent`
  - `T3 first_tick_received`
  - `T4 first_interactive_render`
  - `T5 stable_layout`
- Worker 通过 `simulationWorker` 初始化载荷接收启动 profile：
  - `startupProfile.id`
  - `startupProfile.tickMaxFps`
  - `startupProfile.lowAlphaTickMaxFps`
  - `startupProfile.lowAlphaThreshold`
  - `startupProfile.stableAlphaThreshold`
  - `startupProfile.stableHoldTicks`
  - `startupProfile.stableTimeoutMs`
  - `startupProfile.deltaEnabled`
  - `startupProfile.deltaEpsilonPx`
  - `startupProfile.fullSyncEveryTicks`
  - `startupProfile.lowAlphaDeltaEpsilonMultiplier`
  - `startupProfile.lowAlphaFullSyncEveryTicks`
- Worker -> 主线程 tick 传输契约（Phase 2）：
  - `tickMode: 'full' | 'delta'`
  - `isDelta: boolean`
  - `nodes: [{ id, i, x, y }]`（`i` 为 Worker 节点索引快速路径；delta 模式仅包含变化节点）
  - 主线程对启动期 tick 采用帧级合并应用，降低重复重绘压力。
  - `T5 stable_layout` 附带 `tickSummary`（`fullTicks`、`deltaTicks`、`deltaRatio` 与载荷统计）。
- 多平台启动试点 profile：
  - `desktop_windows_pilot`：`26 FPS`、`400ms` 边延迟、`1500ms` SVG 窗口（`18000` 条边）。
  - `desktop_macos_pilot`：`24 FPS`、`430ms` 边延迟、`1700ms` SVG 窗口（`15000` 条边）。
  - `desktop_linux_pilot`：`24 FPS`、`420ms` 边延迟、`1600ms` SVG 窗口（`16000` 条边）。
  - `mobile_android_pilot`：`18 FPS`、`560ms` 边延迟、`2200ms` SVG 窗口（`7000` 条边），并降低启动星空密度。
  - `mobile_ios_pilot`：`17 FPS`、`600ms` 边延迟、`2300ms` SVG 窗口（`6200` 条边），并降低启动星空密度。
- 启动视觉遮罩契约：
  - 在 `T5 stable_layout` 前显示虚化启动层（若超时则安全关闭）。
  - 核心文案：`等待世界构建`。
  - 星空可交互：星星自然闪烁，用户点击可点暗附近星星。
  - 在移动端和 reduced-motion 环境自动降载（星点密度/动画强度）。
- 运行时覆盖开关（用于回滚与 A/B 验证）：
  - `localStorage['nc.startupPerfProfile'] = 'off'` 可关闭试点行为。
  - `localStorage['nc.startupPerfProfile'] = 'desktop_windows_pilot'` 可强制开启试点行为。
  - `localStorage['nc.startupPerfProfile'] = 'desktop_macos_pilot' | 'desktop_linux_pilot' | 'mobile_android_pilot' | 'mobile_ios_pilot'` 可强制选择对应 profile。
- 自动化基线/试点汇总脚本：
  - `npm run perf:startup:compare -- --baseline <baseline-log-path> --pilot <pilot-log-path>`
  - 支持文件或目录输入，自动按 `[Startup Perf]` 检查点切分会话并输出 P50/P95 KPI 报告。
- 自动化多平台矩阵汇总脚本：
  - `npm run perf:startup:matrix -- --root <startup-logs-root> [--out <report-path>]`
  - 推荐目录结构：`<root>/<platform>/baseline|pilot`（例如 `windows`、`macos`、`android`）。
  - 兼容单平台目录：`<root>/baseline|pilot`，可配合 `--single-platform-label <label>` 指定平台标签。
- 准实时矩阵门禁（日志变更自动重算）：
  - `npm run perf:startup:matrix:watch -- --root <startup-logs-root> --out <report-path> --strict`
  - 推荐目录（同设备双阶段）：
    - `<root>/macos/baseline/*.log`
    - `<root>/macos/pilot/*.log`
    - `<root>/android/baseline/*.log`
    - `<root>/android/pilot/*.log`
    - `<root>/ios/baseline/*.log`
    - `<root>/ios/pilot/*.log`
- 无多端设备条件下的替代链路（仅链路验证）：
  - `npm run perf:startup:matrix:simulate -- --seed-root tmp/startup-logs --out-root tmp/startup-logs-simulated`
  - `npm run perf:startup:matrix -- --root tmp/startup-logs-simulated --out tmp/startup-logs-simulated/report-platform-matrix.md`
  - 注意：`tmp/startup-logs-simulated` 为模拟数据，禁止用于 release-go 性能结论，仅用于脚本/门禁流程演练。
- 无硬件一键签收（工程签收 + 发布签收待办提示）：
  - `npm run perf:startup:signoff:nohw`
  - 该命令会自动执行：Windows 真实日志门禁 + 模拟多端三规模门禁，并输出分层签收报告。
  - 若缺少真实多端 cohort 数据，发布签收会标记为 `TODO` 并进入未来待办测试清单。
- 三规模自动回归与灰度门禁（Phase 4）：
  - `npm run perf:startup:cohorts:verify -- --root <cohorts-root> --cohorts small,medium,large --out <report-path> --strict`
  - 目录约定：`<cohorts-root>/<cohort>/<platform>/baseline|pilot`
  - 支持样本量门禁：`--min-sessions-per-platform <N>`

## Mermaid 标准兼容基线（Obsidian）

- 标准兼容格式：fenced code block，起始行为 ` ```mermaid`，结束行为 ` ``` `。
- Godot 运行时渲染保持 PNG-first；Mermaid 渲染偏好需允许回退（`auto`），避免仅 bridge 可用时才成功。
- 字段级路由与契约细节：
  - [Godot + NoteMD + Markdown 接口](./godot-notemd-markdown-interfaces.md)

## app_config 运行时契约挂载点

- 前端配置水合命令：
  - `invoke('get_app_runtime_config')`
- 水合后的投影：
  - `window.__NC_APP_CONFIG.language`
  - `window.__NC_APP_CONFIG.multiWindow.*`
- 详细结构请见：
  - [app_config.toml 结构](./app-config-schema.md)

## 策略门禁族

- PathBridge 严格 schema
- Storage provider 合约
- 移动端运行时边界合约
- SBOM + attestation 策略合约
- Sidecar 签名与隐私清单合约
