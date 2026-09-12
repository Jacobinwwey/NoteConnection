---
title: Project convergence results and acceptance boundaries
date: 2026-09-13
status: host-accepted-external-gates-open
source_revision: e1802ea2f4f77a76c08a92378fbe090ef81fb052
baseline_revision: e84d6ece9cce5b82902d4b9335ac096a136a8d2a
---

# Convergence Results / 收敛实施结果

## English

### Acceptance

U1–U6 are accepted. U7 has fresh Windows dist/packaged-sidecar and reference-connector evidence; U8 has a reproducible answer-quality baseline. Android device acceptance, independent-host qualification, an external production ANN backend, and learner outcomes remain open. These boundaries prevent a blanket “all platforms and learning outcomes complete” claim.

This page supersedes the scheduling conclusions of the [September 12 audit](../audits/2026-09-12-project-progress.md). The [implementation plan](../plans/2026-09-12-001-refactor-project-convergence-plan.md) retains requirements and per-unit acceptance. The checked-in [evidence manifest](evidence/2026-09-13/manifest.json) links immutable fixture reports, source/artifact hashes, runtime identities and test summaries. Later documentation commits do not change the qualified source fingerprint.

| Unit | Delivered operation/invariant | Status and limit |
|---|---|---|
| U1 | Reentrant serialization of complete platform operations; committed read projection; outer commit/rollback; queue recovery | Accepted for one platform instance. No cross-process isolation claim. |
| U2 | Host-owned turn admission, bounded source reads/line/fact expansion, one deadline, vector/judge cancellation and quiescence | Accepted as cooperative control. A provider ignoring cancellation retains its lease until it settles. |
| U3 | Bounded measurement before serialization; shared JSON/SSE/replay projection; citation/framing accounting; bounded stream drain lifecycle | Accepted, including real HTTP disconnect, joined-consumer and replay regressions. |
| U4 | Exact matching preserves ASCII word-boundary semantics; fuzzy matching scans all candidates; workers quiesce before fallback | Accepted. Fuzzy worst-case work remains quadratic. |
| U5 | All 26 previously skipped obligations execute; capability contracts run real registry/emission behavior; rollout and durability commands assert behavior | Accepted. Node 22.19+ within 22.x and Node 24.x are the declared runtime families. |
| U6 | NoteMD registry owns admission, IDs, cancellation, aliases and workspace writes; 20 duplicate inline handlers removed | Accepted after isolated pre-deletion parity. Other server-owned operations retain their complete owner. |
| U7 | Content-bound build freshness and dated evidence selection; three distinct qualification runs per component | Windows SQLite and the reference HTTP candidate prefilter qualify. Native Android and independent hosts do not. |
| U8 | Versioned bilingual calibration/confirmation corpora, independent reference probes, runtime calibration and consent-based pilot protocol | Measurement complete. General answer-quality and learning-benefit promotion remain unqualified. |

Browser acceptance also exposed a layout defect: positional Grid tracks gave new mode/budget controls the flexible space and compressed the answer viewport to **63px**. The transcript now owns spare height independently of control count; the same desktop case provides **240px**. The browser verifier asserts actual rendered height and formulas; CI now runs the slim/full fixture in Chrome. Obsolete assertions demanding a particular Grid declaration were removed, while scrolling/action tests remain.

### Verification on the final implementation

| Check | Evidence |
|---|---|
| Jest / Node 22.19.0 | 162 suites, **1,528 passed, 0 failed, 0 skipped** |
| Jest / Node 24.14.0 | Same full result; frontend changes additionally passed 174 focused tests on each runtime |
| Build | TypeScript, Vite, 40 frontend runtime assets, server sidecar build and Godot/sidecar binary validation passed |
| Rust/Tauri | 30 passed, 1 normally ignored probe; that probe then executed through the mobile semantic-parity verifier |
| HTTP/runtime | Knowledge Workspace: 55 isolated groups / 92 cases; route shadow: 19 equivalent / 4 intentional registry-only cases |
| Browser | Five desktop cases: formula slim/full, real Water Glass slim, full adaptive and full unbounded; two additional narrow-window fixture cases passed |
| Rendering/Bridge | Formula probes: 4 KaTeX nodes; real full responses: 86; no raw math delimiters. Strict PathBridge, WASM exports and 513 Markdown files / 1,539 Mermaid fences passed |
| Mobile host checks | Four host profiles share semantic projection behavior; 8 recovery scenarios passed. These ran on one physical Windows host |
| SQLite | Three distinct heavy-soak runs, 180 documents, both dist and packaged modes, five restarts per mode/run; all thresholds passed |
| Reference connector | Three smoke/medium/heavy matrices, 40/140/260 documents, both modes; expected-document recall 6/6 per profile/mode |
| Evidence gate | `--min-report-count 3` passed again against the archived reports; mirrored latest/dated copies do not count twice |
| Documentation | Diataxis: 18 entries / 36 language paths / 68 canonical references; MkDocs `--strict` passed |

The packaged runtime is Node **22.22.0**; the dist qualification runtime is Node **22.19.0**. The packaged server is **77,904,488 bytes**, SHA-256 `251cff98e2e86dcd008955caa299ef7b5925283df5f286365c0665c4d46c3193`. Qualified source fingerprint: `e96675a485fb7d3d26fb7acb182d5f2d5081a66eae2f78c7a4ba59adcdfef33f`.

The ANN harness starts `startReferenceAnnService`, an HTTP token-posting prefilter. It proves connector synchronization, representation, fallback and targeted retrieval contracts. It does **not** measure a deployed approximate index or establish production ANN recall/performance. Tauri Rust and browser evidence also do not establish a fresh native WebView/Godot window session.

One initial Windows sidecar write returned `EBUSY`; the unchanged retry succeeded. One initial orphan-backup recovery scenario returned `orphan-recovery-pending`; five instrumented reruns and a final normal run passed. The recovery failure was not reproduced and its filesystem cause is not established. Retaining backup/retry state remains required. Rust also reports an existing unused `metadata` variable on the desktop build; no unrelated Rust refactor was made.

### Runtime cost and answer quality

Default host ceilings are **4 MiB/source, 16 MiB cumulative sources, 8 pending turns, 16,384 source lines, 4,096 source facts and 180s maximum deadline**; the normal tier uses 60s. Client hints cannot raise these ceilings. Twelve simultaneous attempts yielded eight completions and four capacity rejections.

The synthetic 2,000-document snapshot is **15,751,932 bytes**. Across five complete writes, p50/p95 were **374.50/379.98ms**; maximum observed heap growth was **235,153,536 bytes (~224 MiB)** and maximum sampled RSS was **342,720,512 bytes (~327 MiB)**. The 500-document p95 was 106.32ms. This is a material cost of whole-snapshot isolation; it is not an OS memory limit. Cooperative cancellation p95 was **1.42ms on an empty corpus with a waiting cooperative backend**, not a large-corpus worst-case guarantee. At 150 files, exact matching used 300 comparisons/build; fuzzy used 22,350. Warmup ordering prevents a meaningful speed comparison from those short timing samples.

Each quality corpus contains six calibration and eighteen evaluation cases across nine categories, paired in English/Chinese. V2 evaluation documents/questions are disjoint from V1 and were frozen before the wiki-link evidence fix. V1 remains archived; the later frontend-only behavior change did not tune answer heuristics on V2. See [V1 raw measurements](evidence/2026-09-13/answer-quality-v1.json), [V2 raw measurements](evidence/2026-09-13/answer-quality-v2.json) and [runtime measurements](evidence/2026-09-13/convergence-runtime.json).

| V2 evaluation metric | Slim | Full |
|---|---:|---:|
| Reference acceptance | 8/18 | 13/18 |
| Reference fact coverage | 28/36 | 36/36 |
| Labelled unwanted-assertion/topic probes hit | 0/6 | 2/6 |
| False conflict signals | 0/16 | 0/16 |
| Missed conflict signals | 2/2 | 2/2 |
| Correct abstention signals | 1/2 | 1/2 |
| Unbalanced math / out-of-scope citations | 0 / 0 | 0 / 0 |
| First query p95, ms | 14.26 | 9.94 |
| Subsequent query p95 / p99, ms | 12.94 / 14.68 | 13.60 / 13.68 |

V1 reference acceptance was 7/18 slim and 15/18 full, with coverage 27/38 and 36/38. **Different corpora are not an improvement/regression experiment.** Quality denominators count each case/mode once, not three timing repetitions; bilingual pairs are correlated. Ingestion precedes timing, memory persistence is disabled, and process/JIT is shared. These milliseconds are not end-to-end browser or source-hydration latency. Probe hits are not an exhaustive hallucination rate.

The two full-mode probe hits are real **topic leakage**: a write-ahead-log answer includes a bird-watching log because both are inside the selected scope. The statements are cited but irrelevant. Both conflict cases also expose incompatible active sensor rates without an explicit conflict decision. Zero false-conflict signals is weak evidence when both positive conflict cases are missed. The wiki-link-only empty-answer defect is fixed; these broader quality defects remain explicit follow-up work.

### Cross-plan status and next decisions

| Original families | Updated completion boundary |
|---|---|
| M01, M09–M11: mastery, answer review, RSE, coverage planning | Reproducible quality baseline now exists. Topic/conflict/abstention quality and learner outcomes remain open. |
| M02, M04: workspace alignment and decomposition | Behavioral gates and one complete route-family extraction closed. No blanket seven-domain extraction claim. |
| M03: Reader/NoteMD | Route ownership, HTTP behavior and browser formula checks pass; fresh native-window acceptance remains separate. |
| M05, M14: lightweight RAG and adaptive budgets | Execution, source admission, framing/backpressure and readable mode controls closed; cooperative-control and quality limits remain. |
| M06, M12: Deep Student and hardening | Cross-operation acknowledged-write/dirty-read defect closed for the supported single-instance topology. |
| M07, M08, M13: historical alignment, DAG contracts, graph conditioning | Retain implemented/historical status. No replacement graph/ID layer is needed. |
| M15, M16: mobile and Tauri | Host contracts pass. Signed arm64 install, SAF, process death/reopen, RSS and native windows remain external acceptance. |
| M17: startup/WASM | Strict artifact/contract verification passes. No new multi-device performance claim. |
| M18: LFS/supply | Final Windows binary is synchronized through existing LFS policy. History rewrite, strict no-LFS delivery and all-host bootstrap remain deferred. |
| M19: foundation/governance | Fresh repeated Windows/reference evidence replaces stale reports. External ANN and additional hosts still require their own evidence. |
| M20: planning/navigation | Paired task/plan/walkthrough/dashboard entries now point here; old checkboxes remain historical. |

Next implementation priority is the **public evidence selection boundary**: retain every requested comparison operand and conflict source, but exclude sections admitted only by a polysemous token. Add independent bilingual topic controls before changing scoring. For contradiction handling, first define comparable subject/attribute/unit/time/environment and negation contracts; broaden supported cases only with both conflict and non-conflict controls. More regexes or additional answer modes would conceal the current failure mechanisms.

Snapshot delta/journal work should follow an explicit write-latency/heap SLO and a representative corpus measurement. Keep the existing serialized owner and schema until the alternative demonstrates equivalent rollback/reopen behavior with lower allocation. Avoid full event sourcing or a forwarding service layer.

Android promotion still requires an authorized connected device and signed arm64 evidence under the existing **25 MiB payload / 256 MiB RSS** limits. `adb devices -l` remained empty. Learning claims require the consent and observation windows in the [pilot protocol](2026-09-12-learning-pilot-protocol.md). Neither a simulator profile nor repeated output from one host supplies those missing observations.

<a id="chinese"></a>

## 中文

### 验收结论

U1–U6 已验收。U7 已取得新鲜的 Windows dist/打包 sidecar 与参考连接器证据；U8 已建立可复现的回答质量基线。Android 真机、独立宿主、外部生产 ANN 和真实学习效果仍未验收。因此不能把本轮结果写成“所有平台和学习收益全部完成”。

本页取代[九月十二日审计](../audits/2026-09-12-project-progress.md)中的排期结论；[实施计划](../plans/2026-09-12-001-refactor-project-convergence-plan.md)保留需求与逐单元验收条件。[已入库证据清单](evidence/2026-09-13/manifest.json)记录不可变 fixture 报告、源码/产物哈希、运行时身份与测试摘要。后续纯文档提交不改变已验证的源码指纹。

| 单元 | 已交付操作/不变量 | 状态与边界 |
|---|---|---|
| U1 | 完整 platform 操作的可重入串行化、committed read projection、外层 commit/rollback、失败后的队列恢复 | 单 platform 实例验收通过；不声称跨进程隔离。 |
| U2 | 宿主拥有准入、源字节/行/事实上限、统一 deadline，以及向量/judge 的取消和静默结束等待 | 协作式约束验收通过；忽略取消的 provider 结束前不释放 lease。 |
| U3 | 序列化前有界计量、JSON/SSE/replay 共享发布投影、引用/封装计量、有界 drain 生命周期 | 通过；包含真实 HTTP 断连、共享消费者与 replay 回归。 |
| U4 | exact 保持 ASCII 词边界，fuzzy 扫描完整候选，worker 完全结束后才 fallback | 通过；fuzzy 最坏复杂度仍为平方级。 |
| U5 | 恢复 26 项跳过义务，真实运行 capability registry/emission，rollout 与 durability 命令执行断言 | 通过；支持 Node 22.x 中的 22.19+ 及 Node 24.x。 |
| U6 | NoteMD registry 拥有准入、ID、取消、alias、workspace 写入；移除 20 个重复 inline handler | 隔离 parity 后验收；其他 server-owned 完整操作保留原 owner。 |
| U7 | 源码内容绑定的构建新鲜度、日期报告选择，每个组件三次独立资格运行 | Windows SQLite 与参考 HTTP 预筛选通过；Android 真机和独立宿主未通过验收。 |
| U8 | 版本化双语校准/确认语料、独立参考探针、运行成本测量、知情同意 pilot 协议 | 测量完成；一般回答质量与学习收益的提升声明仍不具备资格。 |

浏览器验收还发现布局缺陷：按子元素序号分配的 Grid 伸缩行被新增 mode/budget 控件占据，答案视口只剩 **63px**。现在由 transcript 自身拥有剩余高度，同一桌面场景为 **240px**。浏览器 verifier 检查真实渲染高度和公式，CI 增加 Chrome slim/full fixture。删除了要求特定 Grid 声明的过时断言，滚动与动作测试保留。

### 最终实现的验证

| 检查 | 证据 |
|---|---|
| Jest / Node 22.19.0 | 162 个 suite，**1,528 通过、0 失败、0 跳过** |
| Jest / Node 24.14.0 | 相同全量结果；前端变更还分别通过 174 项定向测试 |
| 构建 | TypeScript、Vite、40 项前端 runtime asset、server sidecar 构建与 Godot/sidecar 二进制校验通过 |
| Rust/Tauri | 30 通过，1 个默认忽略探针；随后由移动投影语义脚本实际调用该探针 |
| HTTP/runtime | Knowledge Workspace：55 个隔离组 / 92 case；route shadow：19 个等价 / 4 个预期 registry-only case |
| 浏览器 | 桌面五场景：公式 slim/full、真实 Water Glass slim、full adaptive、full unbounded；另有窄窗口两场景 |
| 渲染/Bridge | 公式 fixture 为 4 个 KaTeX 节点，真实 full 为 86 个，无裸数学分隔符；严格 PathBridge、WASM exports、513 篇 Markdown / 1,539 个 Mermaid fence 通过 |
| 移动宿主检查 | 四种 host profile 的投影语义对齐；8 个恢复场景通过。均在同一台 Windows 机器执行 |
| SQLite | 三次独立 heavy soak，180 文档、dist/packaged 两种模式，每模式每轮重启五次，全部门槛通过 |
| 参考连接器 | 三轮 smoke/medium/heavy，40/140/260 文档，两种模式；各 profile/mode 的预期文档 recall 为 6/6 |
| 证据门禁 | 对入库报告重新执行 `--min-report-count 3` 通过；latest/dated 镜像不重复计数 |
| 文档 | Diataxis：18 个入口 / 36 个语言路径 / 68 个 canonical 引用；MkDocs `--strict` 通过 |

打包 runtime 为 Node **22.22.0**，dist 验收 runtime 为 Node **22.19.0**。server 二进制 **77,904,488 bytes**，SHA-256 为 `251cff98e2e86dcd008955caa299ef7b5925283df5f286365c0665c4d46c3193`。源码指纹为 `e96675a485fb7d3d26fb7acb182d5f2d5081a66eae2f78c7a4ba59adcdfef33f`。

ANN harness 启动的是 `startReferenceAnnService`，即通过 HTTP 提供 token posting 预筛选的参考服务。它证明 connector 同步、表示一致性、fallback 和定向检索契约，**没有测量外部近似索引的生产 recall/性能**。Tauri Rust 与浏览器证据也不等于新启动的原生 WebView/Godot 窗口验收。

首次 Windows sidecar 写入出现 `EBUSY`，未改代码的重试成功。首次 orphan-backup 恢复返回 `orphan-recovery-pending`；五次带诊断复跑及一次正常终验通过。该恢复失败未能重现，文件系统根因尚未确认；必须继续保留 backup/retry 状态。Rust 桌面构建还报告一个既有 `metadata` 未使用变量，本轮未做无关 Rust 重构。

### 运行成本与回答质量

宿主默认上限为：**单源 4 MiB、累计源 16 MiB、8 个 pending turn、16,384 源行、4,096 源事实、最大 deadline 180s**；普通档为 60s。客户端 hint 不能提高这些上限。12 个同时发起的请求中，8 个完成、4 个因容量被拒绝。

合成 2,000 文档 snapshot 为 **15,751,932 bytes**。五次完整写入 p50/p95 为 **374.50/379.98ms**，最大观察 heap 增量 **235,153,536 bytes（约 224 MiB）**，最大采样 RSS **342,720,512 bytes（约 327 MiB）**；500 文档的 p95 为 106.32ms。这是全 snapshot 隔离的实际成本，不是 OS 内存上限。取消 p95 **1.42ms** 仅对应**空语料、等待中的协作式 backend**，不能外推到大语料最坏情况。150 文件下 exact 每次 300 次比较，fuzzy 为 22,350 次；短时样本受 warmup 顺序影响，不据此宣称 fuzzy 更快。

每版质量语料包含 6 个 calibration 与 18 个 evaluation case，覆盖九类问题的中英对照。V2 evaluation 的问题与文档和 V1 分离，并在 wiki-link 证据修复前冻结；V1 报告保留。后续前端行为修复没有针对 V2 调答案规则。原始记录：[V1](evidence/2026-09-13/answer-quality-v1.json)、[V2](evidence/2026-09-13/answer-quality-v2.json)、[运行成本](evidence/2026-09-13/convergence-runtime.json)。

| V2 evaluation 指标 | Slim | Full |
|---|---:|---:|
| 参考验收通过 | 8/18 | 13/18 |
| 参考事实覆盖 | 28/36 | 36/36 |
| 已标注的不应出现断言/主题探针命中 | 0/6 | 2/6 |
| 冲突误报 | 0/16 | 0/16 |
| 冲突漏报 | 2/2 | 2/2 |
| 正确拒答信号 | 1/2 | 1/2 |
| 数学不配对 / 越 scope 引用 | 0 / 0 | 0 / 0 |
| 首次查询 p95，ms | 14.26 | 9.94 |
| 后续查询 p95 / p99，ms | 12.94 / 14.68 | 13.60 / 13.68 |

V1 的参考验收为 slim 7/18、full 15/18，覆盖分别为 27/38、36/38。**不同语料不能构成改进/回退实验。** 质量分母按 case/mode 计一次，不把三轮时延采样算作独立正确性样本；中英对照也相关。计时前已完成 ingest，关闭 memory persistence，进程/JIT 共享，因此上述毫秒数不是浏览器或源 hydration 的端到端延迟。探针命中率也不是完整幻觉率。

full 的两个命中是实际**主题泄漏**：回答预写日志时，把同 scope 的观鸟日志混入正文。事实有引用，但与问题无关。两个冲突 case 也只是并列给出不兼容的有效传感器频率，没有明确冲突结论。正例全部漏报时，零误报并不能证明冲突判断准确。仅含 wiki-link 的空洞回答已经修复；上述更广的质量缺口保留为明确后续工作。

### 各计划的状态变化与后续决策

| 原计划族 | 更新后的完成边界 |
|---|---|
| M01、M09–M11：mastery、答案审查、RSE、coverage planning | 已有可复现质量基线；主题/冲突/拒答质量与真实学习收益仍开放。 |
| M02、M04：workspace 对齐与解耦 | 行为门禁及一个完整路由族迁移已收口；不声称七个 domain 全部解耦。 |
| M03：Reader/NoteMD | 路由 owner、HTTP 行为与浏览器公式验证通过；原生窗口验收独立。 |
| M05、M14：轻量 RAG 与自适应预算 | 执行、源准入、封装/背压、模式控件下的答案可读性收口；协作式控制与质量边界保留。 |
| M06、M12：Deep Student 与 hardening | 在单实例拓扑下，跨操作已确认写入丢失和 dirty read 已关闭。 |
| M07、M08、M13：历史对齐、DAG 契约、图条件上下文 | 保持已实现/历史状态，无需重新造图谱或 ID 层。 |
| M15、M16：移动与 Tauri | 宿主契约通过；签名 arm64、SAF、process death/reopen、RSS 与原生窗口仍需外部验收。 |
| M17：startup/WASM | 严格 artifact/contract 检查通过；不新增跨设备性能声明。 |
| M18：LFS/供应 | 按既有 LFS 策略同步最终 Windows 二进制；历史改写、完全去 LFS 和所有宿主 bootstrap 延后。 |
| M19：foundation/governance | 新鲜重复 Windows/参考服务报告替代过期报告；外部 ANN 和新增宿主需各自证据。 |
| M20：计划/导航 | task/plan/walkthrough/dashboard 双语入口统一指向本页，旧勾选仍为历史。 |

下一实现优先级应放在**公开证据选择边界**：保留每个比较对象及冲突来源，同时剔除仅因多义 token 命中的段落。修改 scoring 前先建立独立双语主题对照。冲突处理先定义主体、属性、单位、时间/环境、否定关系的可比性，再用冲突与非冲突对照扩展支持范围；堆 regex 或新增回答模式只会掩盖当前失效机制。

snapshot delta/journal 应以明确的写入 p95/heap SLO 和代表性语料为前提；候选实现必须在降低分配的同时，证明 rollback/reopen 与现有语义等价。此前保留当前串行 owner 与 schema，不引入完整 event sourcing 或转发 service 层。

Android 提升仍需已授权在线设备和签名 arm64 证据，保持 **25 MiB payload / 256 MiB RSS** 限制。本轮 `adb devices -l` 仍为空。学习收益依赖 [pilot 协议](2026-09-12-learning-pilot-protocol.md)规定的知情同意和观察窗口；模拟 profile 或同宿主重复运行不能补足这些观察。
