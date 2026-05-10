---
date: 2026-04-13
topic: markdown-reader-upgrade-alignment
---

# Markdown 阅读器升级对齐与后续方向（执行版 v1，2026-04-13）

## 目标与边界

本次目标不是“再做一版阅读器功能堆叠”，而是把既有 Markdown 协议阅读能力与先前演进方案对齐，形成可执行、可验证、可维护的下一阶段升级路径。

范围限定：

- 聚焦 `src/frontend/reader.js` + `src/markdown/MarkdownGateway.ts` + `src/server.ts` 的阅读链路。
- 基于现有协议接口（`/api/markdown/index|chunk|resolve-node|resolve-wiki`）演进，不重写主干。
- 参考 `markdown-viewer/obsidian` 的产品能力模式，但不迁移其 runtime/代码实现。

非目标：

- 不做“全量 Obsidian/浏览器扩展功能对齐”。
- 不在当前切片引入新的前端框架或重做 UI 体系。
- 不将导出（Word/PDF）能力与阅读主链路耦合上线。

## 对齐输入（本次核对）

- 先前方案与进度要求：
  - `docs/brainstorms/2026-04-11-evolution-progress-alignment-requirements.md`
  - `docs/brainstorms/2026-04-12-agent-workspace-next-direction-requirements.md`
  - `docs/brainstorms/2026-04-13-agent-workspace-architecture-progress-and-next-direction-requirements.md`
  - `docs/diataxis/en/explanation/development-progress-dashboard.md`
- 当前阅读器与协议代码：
  - `src/frontend/reader.js`
  - `src/markdown/MarkdownGateway.ts`
  - `src/server.ts`
  - `src/notemd.server.integration.test.ts`
  - `src/markdown/MarkdownGateway.test.ts`
  - `src/reader_renderer.test.ts`
- 外部参考项目：
  - `https://github.com/markdown-viewer/obsidian`
  - 许可证与可复用边界：`https://github.com/markdown-viewer/obsidian/blob/main/LICENSE`

## 深度对比：先前方案要求 vs 当前代码证据（阅读器切片）

| Axis | 方案要求 | 当前代码证据 | 判定 | 当前风险/缺口 |
|---|---|---|---|---|
| R-A1 协议化增量阅读 | 大文档应分块、可定位、可回退 | `src/frontend/reader.js`（index/chunk/prefetch/trim）、`src/markdown/MarkdownGateway.ts`（index/chunk/resolve） | Done | 现有能力可支撑后续演进 |
| R-A2 协议端稳定契约 | index/chunk/resolve-node/resolve-wiki 需可测试 | `src/notemd.server.integration.test.ts`（markdown protocol endpoints）、`src/markdown/MarkdownGateway.test.ts` | Done | 当前契约可作为升级基线 |
| R-A3 Mermaid 多级降级 | 前端渲染失败要后端 fallback | `src/frontend/reader.js`（frontend render/run -> `/api/render/mermaid`） | Done | 已具备鲁棒主链路 |
| R-A4 大文档内存上限 | 阅读器渲染窗口需限制增长 | `src/frontend/reader.js`（`MAX_RENDERED_BLOCKS = 240` + trim） | Done | 阈值策略尚未与文档结构联动 |
| R-A5 安全治理优先 | 渲染链路需有明确 XSS/HTML 安全边界 | `src/frontend/reader.js` 直接 `marked.parse(...) -> innerHTML` | Gap | 当前缺少显式 sanitize 策略与可信边界 |
| R-A6 扩展模型可维护 | 新图表/新块类型应注册式扩展，而非主流程加分支 | `src/frontend/reader.js` 当前仍以集中分支组织渲染 | Gap | 新能力增长将推高耦合与回归成本 |
| R-A7 结构化导航能力 | 用户应在阅读时快速定位章节与锚点 | 协议端有 anchors summary（`MarkdownGateway`），前端缺 TOC/outline 面板 | Gap | 可读性与定位效率受限 |
| R-A8 主题/多语言产品化 | 阅读器层应支持稳定主题与 i18n 文案治理 | 项目整体有 i18n，但阅读器主题仍较固定（Mermaid `theme: 'dark'`） | Partial | 长期会形成视觉与语言不一致 |
| R-A9 证据驱动发布 | 新能力应具备 contract+runtime+docs 三位一体证据 | 当前协议与渲染测试较充分，阅读器产品化指标/遥测不足 | Partial | 容易“能跑但不可运营” |
| R-A10 外部项目复用纪律 | 参考项目应模式复用，不做盲目代码搬运 | 参考项目核心为 minified 单体 + GPLv3 | Done（方向明确） | 直接复用存在许可证与可维护性风险 |

结论：

- 当前阅读器主干已过“能否运行”阶段，主矛盾不在协议缺失，而在“产品化扩展与安全治理不成体系”。
- 这与先前方案共识一致：应优先收敛架构可维护性与治理闭环，而不是继续线性叠加功能。

## 批判性压力测试（反假设）

1. 假设：已有协议分块，就不需要再做阅读器架构升级。  
反证：协议层稳定不等于渲染层可演进；当前渲染主流程仍是集中分支，新增能力成本线性上升。

2. 假设：优先引入更多图表类型（Vega/Graphviz/drawio）就是最高杠杆。  
反证：在缺少注册式渲染模型与安全边界前扩类型，会先放大复杂度债与故障面。

3. 假设：参考 `markdown-viewer/obsidian` 可直接加速实现。  
反证：该项目核心分发形态为打包单体，且许可证为 GPLv3，与本项目当前许可策略不兼容。

4. 假设：阅读器只是附属模块，不需要单独治理指标。  
反证：阅读器是 Tauri/Godot 共同消费链路；一旦退化会直接影响知识点学习闭环与 focus 体验。

## 路径选项与取舍

### Option A：仅修补安全与小体验（保守）

- 内容：补 sanitize + 增 TOC，暂不调整渲染架构。
- 优点：短期风险低，交付快。
- 缺点：后续扩展图表时仍要改主流程。
- 适用：仅适合临时稳态，不适合中期演进。

### Option B：阅读器“治理优先”渐进升级（推荐）

- 内容：先补安全边界与能力矩阵，再做渲染注册表，最后试点 1 个新增图表引擎。
- 优点：把复杂度增长控制在可治理范围内；可持续扩展。
- 缺点：首轮需要较多重构与回归设计。
- 适用：当前阶段最符合先前方案的工程方向。

### Option C：追求外部项目功能对齐（不推荐）

- 内容：快速追平主题包、全图表、导出链路。
- 优点：表面功能增长快。
- 缺点：许可证风险高、维护成本高、与现主线目标冲突。
- 适用：不适用当前阶段。

推荐：Option B。

## 落盘要求（下一阶段）

### 1) 安全与契约治理（P0）

- R1. 明确阅读器渲染安全边界：默认不信任 Markdown 内联 HTML，建立 sanitize 策略。
- R2. 将渲染能力以契约形式输出（capability matrix），前端按能力协商执行。
- R3. 对 unknown/unsupported render path 强制可解释错误，不允许静默失败。

### 2) 阅读效率与可解释性（P0/P1）

- R4. 新增 TOC/outline 与锚点定位，复用协议端 `anchors` 数据。
- R5. 提供渲染来源与降级状态可视化（frontend-render/frontend-run/backend-png/failed）。
- R6. 在阅读器 UI 上显示关键运行诊断（至少含当前 engine 与 fallback 触发信息）。

### 3) 扩展模型收敛（P1）

- R7. 渲染主流程重构为 registry 驱动：`block classifier`、`renderer executor`、`fallback policy` 分离。
- R8. 新增图表能力采用“单引擎试点”策略（Graphviz 或 Vega 二选一），禁止一次并入多引擎。
- R9. 主题能力改为 token 化治理，避免固定主题与多端不一致。

### 4) 边界控制（P2）

- R10. 导出能力（Word/PDF）如需推进，必须独立为服务边界，不进入阅读器主链路。
- R11. 外部项目仅做模式复用，不允许复制 GPLv3 代码或资产到 MIT/ISC 主仓链路。
- R12. 与 L4 agent workspace 主线分轨推进，避免目标混线。

## 里程碑与 Gate（建议）

## M11（当前建议主线）：Reader Governance Baseline

目标：建立安全与扩展治理底座，不改变现有协议 API 形态。

必交付：

1. 渲染安全策略（sanitize + 可信边界开关）；
2. 渲染 capability matrix（协议返回 + 前端消费）；
3. TOC/anchor 导航基础能力；
4. 渲染来源/降级状态可视化最小闭环。

Gate（现有 + 增补）：

```bash
npm test -- src/markdown/MarkdownGateway.test.ts --runInBand
npm test -- src/notemd.server.integration.test.ts --runInBand -t "markdown protocol endpoints"
npm test -- src/reader_renderer.test.ts --runInBand
```

## M11.1（并行）：Registry Refactor + Single Engine Pilot

目标：将阅读器渲染链路注册表化，并试点一个新图表引擎。

必交付：

1. `reader.js` 渲染分层（classifier/executor/fallback）；
2. 新增引擎接入不修改 dispatcher 主流程；
3. 新增对应契约/行为测试。

Gate：

- 新增引擎不触发现有 Mermaid/Math/Wiki 回归；
- 未支持语法返回结构化诊断信息。

## M12（延后评估）：Export Boundary

目标：评估并定义导出域（Word/PDF）与阅读域的隔离接口，不进入 M11 主路径。

## 风险清单与防护策略

| 风险 | 触发条件 | 防护策略 |
|---|---|---|
| XSS/注入风险 | Markdown/HTML 直接注入 DOM | 默认 sanitize + 白名单策略 + 回归测试 |
| 渲染架构继续膨胀 | 新图表继续走主流程分支 | registry 分层 + parity 测试 |
| 协议/前端能力漂移 | 后端 capability 与前端执行不一致 | capability parity contract test |
| 误判外部项目可直接复用 | 直接拷贝 GPLv3 资产/代码 | 明确许可证边界与复用红线 |
| 主线资源冲突 | 与 L4 agent workspace 争夺同一迭代窗口 | 分轨治理：M11 并行推进，避免阻塞主线 |

## 明确不做（本周期）

- 不做外部项目功能对齐式迁移。
- 不做导出链路并入阅读器主流程。
- 不引入新的运行时依赖栈来替代现有协议链路。

## 可直接开工的任务序列（当前建议）

1. 先做 M11：安全边界 + capability matrix + TOC/anchor。
2. 再做 M11.1：registry 重构 + 单引擎试点。
3. 最后评估 M12：导出域隔离方案（仅文档与边界设计）。

## 最终判断（v1）

- 当前 Markdown 阅读器主干能力已经具备，但产品化治理尚未闭环。
- 下一阶段最高杠杆是“安全治理 + 扩展模型收敛 + 可解释阅读体验”，而不是盲目扩展图表类型。
- 最优方向是：在现有协议架构内渐进升级，并保持与先前演进总方案一致的“证据优先、治理优先、分轨推进”原则。

## Next Steps

→ `/ce:plan`：将 M11/M11.1 拆分为可执行任务和测试 gate。
