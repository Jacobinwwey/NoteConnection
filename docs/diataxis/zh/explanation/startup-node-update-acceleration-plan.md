# 启动节点更新提速方案（跨平台 + Windows 试点）

## 背景

本文用于固化「应用启动后节点初始化/更新速度提升」的系统方案，先在 Windows 试点验证，再逐步推广到 macOS 与 APK 运行时。

适用范围：
- 前端图谱启动链路（`src/frontend/app.js`）
- 仿真 Worker Tick/回传链路（`src/frontend/simulationWorker.js`）
- 桌面与移动端运行时配置差异（Tauri / WebView / APK）

## 1) 问题定义

用户在打开软件后，首屏可交互图谱与首个稳定可读布局到达时间偏长，造成“启动慢、卡顿感强”的感知。

系统级启动时延模型：

`T_start = T_data_prepare + T_worker_init + T_tick_transfer + T_first_interactive_render + T_settle`

对用户可见的关键指标（KPI）：
- `TTI`：图谱首帧可交互时间（Time to Interactive）
- `TFS`：首个稳定布局时间（Time to First Stable）
- 启动前 3 秒掉帧率

## 2) 核心假设

1. 启动期 Worker 每 Tick 全量回传所有节点坐标，是主要瓶颈之一。
2. 启动早期立刻渲染全量边，对用户价值低但耗时高。
3. 缺少布局快照导致每次都冷启动松弛，重复消耗明显。
4. Windows/macOS/APK 的渲染与 IPC 能力差异，决定了不能使用单一阈值。

## 3) 约束与未知项

### 约束
- 必须保证 Tauri 桌面端与 APK 运行时行为一致性，不引入功能回退。
- 不破坏 Focus/Highlight/PathMode/Reader 等既有交互链路。
- 所有优化必须可开关、可快速回滚。

### 未知项
- 目前缺少统一采集的 P50/P95 启动指标。
- 各平台设备能力分布尚未形成稳定画像。

## 4) 子问题拆解

1. 主线程数据预处理时延（节点/边归一化与映射）。
2. Worker 初始化与布局收敛速度。
3. Worker -> UI 回传频率与数据量。
4. 启动期渲染策略（先节点后边，还是全量同步）。
5. 热启动能力（布局快照持久化与恢复）。

## 5) 三种可选方案

### 方案 A：快速限流 + 分阶段渲染
- 启动期延迟边渲染
- 限制 Tick 频率
- 不修改通信协议

预期收益：中等（交付最快，风险最低）。

### 方案 B：平衡目标方案（推荐）
- 包含方案 A
- 引入布局快照（Warm Start）
- 引入 Delta 回传或低频全量回传
- 引入按平台运行时 Profile 调参

预期收益：高（收益/风险比最优）。

### 方案 C：深度架构重构
- 共享内存 + 二进制图数据管线 + 渲染器重构

预期收益：最高，但研发风险与周期成本最高。

## 6) 方案对比

| 维度 | 方案 A | 方案 B（推荐） | 方案 C |
|---|---|---|---|
| 交付速度 | 快 | 中 | 慢 |
| 实施风险 | 低 | 中 | 高 |
| 冷启动收益 | 中 | 高 | 很高 |
| 热启动收益 | 低 | 很高 | 很高 |
| v1 跨平台可行性 | 高 | 高 | 中 |

## 7) 最优方案选择

选择 **方案 B**，采用分阶段推进并保持开关化回滚能力。

选择理由：
- 在不破坏架构稳定性的前提下获得显著性能收益。
- 支持分平台调参，满足 Windows/macOS/APK 现实约束。
- 适合先做 Windows 试点，再以数据驱动推广。

## 8) 执行步骤（逐步推进）

### Phase 0：建立基线观测
- 增加统一启动时序日志：
  - `T0 app_boot`
  - `T1 graph_preprocessed`
  - `T2 worker_init_sent`
  - `T3 first_tick_received`
  - `T4 first_interactive_render`
  - `T5 stable_layout`

### Phase 1：Windows 试点 v1（低风险）
- 增加运行时启动 Profile 选择。
- 增加 Worker Tick 频率上限。
- 增加启动期边渲染延迟。
- 可选：启动窗口内的边渲染数量保护阈值。

### Phase 1b：多平台扩展（桌面 + 移动）
- 将启动 profile 扩展到 macOS/Linux/Android/iOS 运行时变体。
- 保持 `T0..T5` 统一观测口径，按平台分组对比指标。
- 按运行时能力自动降低启动遮罩星空密度与动画强度。
- 保留 localStorage 强制 profile 开关，支持回滚与 A/B 回放。

### Phase 2：Warm Start
- 以图指纹作为 Key 持久化布局快照。
- 启动时优先恢复快照，并进行低 alpha 稳定化。

### Phase 3：Delta 传输优化
- 使用 Delta-only 回传，或降低全量回传频率。

## 9) 风险点与缓解

1. 快照陈旧或错配：
   - 缓解：严格图指纹校验，不匹配则自动回退冷启动。
2. 低端设备过度限流导致交互迟滞：
   - 缓解：按平台/设备 profile 分层参数，并保留快速回滚开关。
3. 边延迟渲染造成“内容不完整”误解：
   - 缓解：短时窗口 + 渐进恢复 + 状态提示。

## 10) v1 试点规格（多平台）

### 运行时 Profile
- `desktop_windows_pilot`：`26 FPS`、`400ms` 边延迟、`1500ms` SVG 窗口（`18000` 条边）。
- `desktop_macos_pilot`：`24 FPS`、`430ms` 边延迟、`1700ms` SVG 窗口（`15000` 条边）。
- `desktop_linux_pilot`：`24 FPS`、`420ms` 边延迟、`1600ms` SVG 窗口（`16000` 条边）。
- `mobile_android_pilot`：`18 FPS`、`560ms` 边延迟、`2200ms` SVG 窗口（`7000` 条边）。
- `mobile_ios_pilot`：`17 FPS`、`600ms` 边延迟、`2300ms` SVG 窗口（`6200` 条边）。

### 启动遮罩契约
- 在 `T5 stable_layout` 前显示虚化遮罩，超时自动安全关闭。
- 核心文案：`等待世界构建`。
- 星空支持点击点暗（可交互）。
- 移动端与 reduced-motion 环境自动降载（星点与动画强度）。

### 验收标准
- `TTI` 中位数改善 >= 30%
- `TFS` 中位数改善 >= 20%
- 启动前 3 秒掉帧率下降 >= 30%

### 回滚门槛
- 任一 P95 启动指标回退 > 10%
- 出现可复现的交互回归（Focus/PathMode/Reader）

## 11) 落地验证快照（2026-03-31）

### 执行命令（Windows 试点）

```bash
npm run perf:startup:matrix -- --root tmp/startup-logs --single-platform-label windows --out tmp/startup-logs/report-platform-matrix.md
```

### 当前样本结果（`tmp/startup-logs/report-platform-matrix.md`）

- 平台：`windows`
- 会话数：baseline `2` / pilot `2`
- `TTI P50` 改善：`31.13%`（门槛 >= `30%`）
- `TFS P50` 改善：`26.96%`（门槛 >= `20%`）
- 总体门禁：`PASS`

### 结论

- 当前 Windows 试点样本满足 v1 门禁，具备继续扩展到 macOS/Android/iOS 分组采集的条件。
- 由于样本量仍偏小，发布级决策前建议每个平台至少采集 `>=10` 个完整启动会话。
