---
title: "Public evidence quality and native workspace follow-up"
date: 2026-09-14
status: partial_acceptance
source_revision: e4cdce27c55dbb19f0ba6b4405358661c12d8821
source_tree_hash: 15657ea4ebda7e0eeb7847403d2097abc61b08610431395237a78d2a951b5b94
parent: docs/plans/2026-09-12-001-refactor-project-convergence-plan.md
---

# Public Evidence and Native Workspace Results / 公开证据与原生知识库验证结果

## English

The source-selection, measurement-comparison and public-answer fixes are implemented. A fresh native session then exposed a separate configured-workspace bug that the passing host suites did not cover; that defect is now fixed and reproduced successfully through Tauri, its packaged sidecar and Godot. Version-2 source identity, local gates and independent-host artifact verification are complete. The source changes are on remote main, and both clean CI sidecars are adopted for publication. This record follows the [September 13 baseline](2026-09-13-convergence-results.md); it does not rewrite that experiment.

### Implementation and ownership

| Contract | Final behavior and trade-off |
|---|---|
| Source admission | The shared query-subject interpretation governs admission before graph anchoring, citations, source reads and composition. Rejected sources cannot return through neighbor recovery. Exact pruning requires a witness for every comparison operand; partial recognition preserves candidates for the existing graph-intent planner. |
| Comparable measurements | Compare only compatible subjects, dimensions, assertion constraints and time/environment/version/platform scopes. Equivalent units, scientific notation, Chinese text, tolerance half-widths, case-sensitive bit/byte units and SI/IEC units have positive and negative controls. Ambiguous ranges and uncertain observations remain undecided. |
| Public answer | Preserve authored procedural order, bounded complementary definitions, localized conflict disclosure, math and surviving citations across slim/full, JSON, SSE and replay. A source label is ignored during semantic checks only when its complete remaining clause exactly matches a clause from that named source. |
| Measurement validity | `answer-quality-public-surface-v3` measures abstention from public text independently of the release label and distinguishes disagreement between sources from domain terminology such as hash collisions. Historical protocol results remain separate. |
| Selected workspace | `buildGraph` passes the resolved knowledge root to `NoteConnection.build`. `FileLoader` canonicalizes the scan directory and workspace, rejecting escapes before scanning. The direct library default and public basename IDs remain compatible; no persisted schema or canonical-ID cutover is introduced. |
| Qualification | The native-window wrapper requires the named Rust test verdict. Zero matching tests cannot qualify a window. The independent-host workflow archives every fixed fingerprint input, compiled inputs, measured binary and reports for offline verification. |

The root fix adds one configuration field at the existing graph boundary, rather than a second root resolver or storage abstraction. Six new defect probes failed before the fix; the expanded graph/identity/path set passes 35 tests. Seven root/public-answer/evidence suites now run in the existing convergence CI gate.

### Quality evidence and its limits

The first V3–V6 confirmations were frozen before the corresponding production edits. Their [initial reports](evidence/2026-09-13-quality/) remain unchanged. Each corpus became regression data after its first feedback; the final replay is not unseen confirmation.

| Corpus | First confirmation, slim / full | Final regression, each mode | Reference facts covered, each mode |
|---|---|---|---|
| V1 | Historical baseline; see September 13 record | 18/18 | 38/38 |
| V2 | Historical baseline; see September 13 record | 18/18 | 36/36 |
| V3 | 19/28 / 25/28 | 28/28 | 61/61 |
| V4 | 21/22 / 21/22 | 22/22 | 48/48 |
| V5 | 12/16 / 15/16 | 16/16 | 32/32 |
| V6 | 8/12 / 12/12 | 12/12 | 28/28 |

All specified reference checks pass on the final replay, with stable released answers across three repeats. There are **300 corpus/case/mode rows and 900 timing repetitions**; six calibration cases are reused across corpora, and bilingual cases are correlated. These are not 900 independent observations. V5's initial false-conflict result was an evaluator error about hash-key collisions; its full answers already covered every reference fact. Protocol changes prevent a clean same-protocol causal interpretation of the historical rates. Labelled probes do not estimate the production hallucination rate, and none of these measurements establish learner benefit.

### Native failure and verified recovery

The [pre-fix archive](evidence/2026-09-14/manifest.json) binds the earlier host/quality results to `f39e0b7b`. In its real native session, two files were rejected as outside the workspace and the build still reported success with zero nodes. The application root and selected knowledge root had diverged. The default-workspace regression also demonstrated that an entire-workspace request could read the wrong corpus.

After the fix, the [native session record](evidence/2026-09-14-native-fix/native/report.json) verifies:

- A configured external workspace builds **2 nodes / 2 edges**, with `Alpha`/`Beta` legacy IDs and `acceptance/alpha`/`acceptance/beta` canonical paths.
- Authenticated Bridge traffic reaches Godot as a verified two-node/two-edge tree layout.
- Entering Path Mode hides the Tauri main window and shows the actual Godot window. Clicking Godot's **Exit** restores Tauri and hides Godot; Win32 visibility and emitted events agree.
- The native Knowledge Workspace renders a source-backed Alpha answer with its source reference. Application shutdown exits successfully and stops the owned children.

This is a Windows **development executable** session using a packaged Node sidecar, Godot **4.6**, Vulkan Forward+ and a Radeon RX 7900 XT. It is not a signed installer qualification or evidence for another native host. The two historical Rust window-test names are still absent; this recorded session does not make that named-test gate pass. Configuration, profiles, runtime data and synthetic knowledge files were isolated on E:.

### Verification and artifact identity

| Surface | Current result |
|---|---|
| Node 22.19.0, final root fix | 168 suites / 1,708 tests; zero failures or skips |
| Node 24.14.0, final root fix | 168 suites / 1,708 tests; zero failures or skips |
| Build | TypeScript, Vite, 40 frontend runtime assets and Windows sidecar build pass |
| Quality | V1–V6 regression checks and answer-stability controls pass on `e4cdce27` |
| Native Windows development session | Graph, Bridge, actual window transitions, grounded answer and shutdown verified |
| Post-fix HTTP/browser/mobile host checks | HTTP: 55 groups / 92 cases; five browser cases; mobile projection and eight recovery scenarios pass. Rust: 30 ordinary tests plus the explicitly executed semantic probe. |
| Post-fix SQLite/reference connector evidence | Three SQLite soaks and three reference matrices pass in dist and packaged modes; the checked-in archive passes the strict gate without warnings. |
| Independent Windows/Linux CI artifacts | Run `34786392248` passes on both hosts; downloaded manifests, source identity, binaries and six reports per host pass offline verification without warnings. |
| Remote main | Source closure reached `1a688f02`; all five normal workflows and the independent qualification run pass on that SHA. The artifact publication manifest records the adopted bytes. |

Final source fingerprint v2: `15657ea4ebda7e0eeb7847403d2097abc61b08610431395237a78d2a951b5b94` (583 source inputs).
Windows sidecar SHA-256: `bf08708eea0ed04e1ecb1027885b44964c8f6383f8d96df741386176064eca6d` (77,896,769 bytes). The measured sidecar embeds Node 22.22.0; host test runners are 22.19.0 and 24.14.0. The [final v2 manifest](evidence/2026-09-14-portable/manifest.json) lists current evidence; the [root-fix checkpoint](evidence/2026-09-14-native-fix/manifest.json) remains unchanged.

The reference ANN harness is an HTTP token-posting prefilter. It verifies synchronization, representation, fallback and targeted retrieval, not a deployed approximate index. Each host must be checked against its own binary and manifest; a Linux binary cannot satisfy a Windows artifact identity.

Initial remote checks found two workflow defects: its Node 22.19 pin violated the existing Node 24 CI baseline, and the Windows job invoked the complete desktop bundle's Godot provisioning after successfully building the server. The workflow now pins Node 24.14.0 and calls the existing server-sidecar build operation. This preserves the server-only qualification scope. FR-010 now passes 42/42 checks locally; the [failure/correction record](evidence/2026-09-14-native-fix/ci/workflow-correction.json) preserves the initial outcomes. No production source or artifact fingerprint changed.

### Portable source identity

Both jobs in run `34781056955` passed their host gates. Offline comparison then exposed a source-fingerprint defect: 184 local Rust compiler-cache files were included, and Windows `Cargo.lock` line endings produced a different clean-checkout digest. The [initial reconciliation](evidence/2026-09-14-portable/fingerprint-portability-initial.json) preserves those observations. Version 2 excludes only `src/backend/wasm/target`, normalizes Rust/lockfile text and retains every real source/test and compiled input. Three regression probes failed before the fix; 41 relevant checks now pass. [Git blobs, Windows checkout simulation and the local cache-bearing tree now agree](evidence/2026-09-14-portable/source-reconciliation-v2.json). This changes build evidence, not business runtime behavior; the native-session record above remains tied to its original runtime artifact.

The published Linux sidecar is `cff9f0fc2426b3242cd1a3afedc704bbe4f3bb130901f29d957bb73cadf6cb17` (94,693,897 bytes). Both published binaries come from clean CI workspaces. The local generated dist had 104 residual backup files (5,694,853 uncompressed bytes); it was preserved under `output/project-convergence-2026-09-12/local-dist-before-ci-34786392248` before adopting the clean Windows inputs. The Windows binary then passed three SQLite soaks and three reference matrices on this physical host as well. Its [two-host archive gate](evidence/2026-09-14-portable/ci/windows-two-hosts/verification.json) passes with six reports per component, three per host; Linux has its own three-per-component CI qualification. [Published artifact identities](evidence/2026-09-14-portable/ci/published-artifacts.json) keep these separate. The earlier local and native-development artifacts remain historical evidence.

### Remaining acceptance and direction

U1–U6 remain accepted. Q1–Q5, R1–R5 and N1–N5 are complete, including their runtime, evidence and source-publication checkpoints. U7/U8 retain overall partial acceptance. Android still needs a signed arm64 device run covering SAF permission/error/retry, process death/reopen, projection continuity and measured RSS under the existing 25 MiB payload / 256 MiB RSS limits. The current ADB device list is empty. Production ANN qualification and consented 7/28-day learner observations remain separate.

Prioritize a representative corpus and an explicit write-latency/heap SLO before replacing whole-snapshot commits with a journal. The final 2,000-document measurement (five writes, 15,751,932-byte snapshot) has p50/p95 343.11/358.00 ms, maximum observed heap growth 235,244,432 bytes (~224 MiB), and maximum sampled RSS 344,633,344 bytes (~329 MiB). Empty-corpus cooperative cancellation p95 is 0.97 ms; it is not a large-corpus worst-case bound. A small API surface does not remove snapshot allocation. Keep exact matching semantics ahead of candidate-index speed: fuzzy fallback remains quadratic in the worst case. Do not promote a global route switch, public-ID cutover, mobile SQLite/WASM expansion or a frontend rewrite from these passing probes. The next quality step should use independently collected examples under one frozen measurement protocol, with the final regression corpus retained as a release guard.

<a id="chinese"></a>

## 中文

来源选择、测量比较和公开回答修复均已实现。随后启动的真实原生会话又发现了既有宿主测试未覆盖的自定义知识库缺陷；该问题已修复，并通过 Tauri、打包 sidecar 与 Godot 复验。v2 源码身份、本机门禁及独立宿主产物复核均已完成，源码已更新到远端 main，并采用两端干净 CI sidecar 作为发布产物。本记录接续[九月十三日基线](2026-09-13-convergence-results.md#chinese)，不改写之前的实验。

### 实现与所有权

| 契约 | 最终行为及权衡 |
|---|---|
| 来源准入 | 共享的查询主体解释在 graph anchoring、引用、源读取和 composition 前约束准入；被拒绝的来源不能经邻居恢复重新进入。精确裁剪要求比较的全部对象都有依据；部分识别时保留候选，交由既有 graph-intent planner 处理。 |
| 可比测量 | 仅比较主体、量纲、断言约束及时间/环境/版本/平台作用域兼容的观察。单位等价、科学计数、中文、公差半宽、区分大小写的 bit/byte 与 SI/IEC 单位均有正反对照；模糊区间和不确定观察保持未判定。 |
| 公开回答 | slim/full、JSON、SSE、replay 保留原始步骤顺序、有界补充定义、本地化冲突披露、公式与存活引用。仅当来源标签后的完整句子与该来源中的完整句子完全一致时，语义校验才忽略标签。 |
| 测量有效性 | `answer-quality-public-surface-v3` 独立于 release label 测量公开拒答，并区分来源分歧与“哈希冲突”等领域术语；历史口径结果分开保留。 |
| 所选知识库 | `buildGraph` 将已解析 root 传给 `NoteConnection.build`；`FileLoader` 在扫描前统一 canonical directory/workspace 并拒绝逃逸。保持 library 默认行为和公共 basename ID，不迁移持久化 schema 或切换 canonical-ID 主身份。 |
| 资格验证 | 原生窗口 wrapper 必须取得指定 Rust 测试通过的 verdict；零匹配测试不能验收窗口。独立宿主工作流归档全部固定指纹输入、编译输入、实测 binary 与报告，以支持离线复核。 |

根目录修复在既有建图边界增加一个配置字段，避免新增另一套 root resolver 或 storage 抽象。六个缺陷探针均在修复前失败，扩展后的 graph/identity/path 检查共 35 项通过；七个根目录/公开回答/证据套件已加入 convergence CI 门禁。

### 质量证据及边界

V3–V6 的首次确认均在对应生产修改前冻结，[初次报告](evidence/2026-09-13-quality/)保持原样。每份语料在首次反馈后转为回归数据；最终复跑不属于未见确认。

| 语料 | 首次确认 slim / full | 最终回归，每种模式 | 参考事实覆盖，每种模式 |
|---|---|---|---|
| V1 | 历史基线，见九月十三日记录 | 18/18 | 38/38 |
| V2 | 历史基线，见九月十三日记录 | 18/18 | 36/36 |
| V3 | 19/28 / 25/28 | 28/28 | 61/61 |
| V4 | 21/22 / 21/22 | 22/22 | 48/48 |
| V5 | 12/16 / 15/16 | 16/16 | 32/32 |
| V6 | 8/12 / 12/12 | 12/12 | 28/28 |

最终复跑的指定 reference 检查全部通过，三次重复的公开答案稳定。共 **300 条 corpus/case/mode 记录、900 次计时重复**；六个 calibration case 跨语料复用，中英文配对也相关，不能算成 900 个独立样本。V5 首次冲突误报源于评估器把哈希键冲突当作来源分歧，其 full 回答当时已经覆盖全部参考事实；口径变化也使历史比例不构成严格同口径因果对照。已标记探针不是生产幻觉率估计，这些测量均不能证明学习收益。

### 原生失败与修复验证

[修复前归档](evidence/2026-09-14/manifest.json)将早先宿主/质量结果绑定到 `f39e0b7b`。真实原生会话中，两篇文件被判断越界，建图仍以零节点成功返回；根因是应用目录与所选知识库根目录分离。默认知识库反例还证明，整个 workspace 请求可能读到错误语料。

修复后的[原生会话记录](evidence/2026-09-14-native-fix/native/report.json)验证了：

- 外部配置知识库生成 **2 节点 / 2 边**，保留 `Alpha`/`Beta` legacy ID 与 `acceptance/alpha`/`acceptance/beta` canonical path。
- 已认证 Bridge 将两节点/两边 tree layout 传给 Godot 并完成校验。
- 进入 Path Mode 后，Tauri 主窗口隐藏、实际 Godot 窗口显示；点击 Godot 的 **Exit** 后主窗口恢复、Godot 隐藏，Win32 visibility 与事件记录一致。
- 原生 Knowledge Workspace 输出受来源支持的 Alpha 回答并展示来源引用；正常退出成功，所属子进程随之停止。

本次采用 Windows **development executable**、打包 Node sidecar、Godot **4.6**、Vulkan Forward+ 与 Radeon RX 7900 XT。它不等于签名安装包资格，也不是其他原生宿主的证据。两个历史 Rust 窗口测试名仍然缺失，本次会话不会使该 named-test gate 通过。配置、profile、runtime data 和合成知识文件均隔离在 E:。

### 验证及产物身份

| 验证面 | 当前结果 |
|---|---|
| Node 22.19.0，最终 root 修复 | 168 suite / 1,708 test；零失败、零跳过 |
| Node 24.14.0，最终 root 修复 | 168 suite / 1,708 test；零失败、零跳过 |
| Build | TypeScript、Vite、40 个前端 runtime asset 与 Windows sidecar 构建通过 |
| Quality | `e4cdce27` 上 V1–V6 回归及答案稳定性对照通过 |
| Windows development 原生会话 | 建图、Bridge、实际窗口切换、有源回答和退出通过 |
| 修复后 HTTP/浏览器/mobile 宿主检查 | HTTP 55 组 / 92 case、五个浏览器场景、移动投影及八个恢复场景通过；Rust 30 项常规测试及显式运行的语义探针通过。 |
| 修复后 SQLite/参考连接器证据 | SQLite soak 与参考 matrix 各三次通过，覆盖 dist/packaged；入库归档严格门禁通过、无警告。 |
| 独立 Windows/Linux CI 产物 | run `34786392248` 两宿主通过；下载后的 manifest、源码身份、binary 与每宿主六份报告均通过离线复核，无警告。 |
| 远端 main | 源码收口已到 `1a688f02`；该 SHA 的五条常规流水线及独立资格任务通过，产物发布 manifest 记录采用的实际字节。 |

最终源码指纹 v2：`15657ea4ebda7e0eeb7847403d2097abc61b08610431395237a78d2a951b5b94`，覆盖 583 个源码输入。
Windows sidecar SHA-256：`bf08708eea0ed04e1ecb1027885b44964c8f6383f8d96df741386176064eca6d`，大小 77,896,769 bytes。实测 sidecar 内嵌 Node 22.22.0，宿主测试 runner 为 22.19.0 与 24.14.0；[最终 v2 manifest](evidence/2026-09-14-portable/manifest.json)列出当前证据，根目录修复的[检查点 manifest](evidence/2026-09-14-native-fix/manifest.json)保持原样。

参考 ANN harness 是 HTTP token-posting 预筛选器，验证同步、表示一致性、fallback 与定向检索，不是已部署的近似索引。各宿主必须使用自己的 binary/manifest 校验，Linux binary 不能满足 Windows artifact 身份。

首次远端检查发现两项工作流问题：Node 22.19 pin 不符合现有 Node 24 CI 基线；Windows 在服务端构建成功后继续触发完整桌面 bundle 的 Godot 依赖准备。现将工作流固定为 Node 24.14.0，调用已有 server-sidecar 构建入口，保持仅验收服务端的范围。FR-010 本机现通过 42/42；[失败与修正记录](evidence/2026-09-14-native-fix/ci/workflow-correction.json)保留首次结果。生产源码及产物指纹没有变化。

### 可跨宿主复核的源码身份

run `34781056955` 的两个 job 均通过宿主门禁，随后离线比对发现源码指纹规则错误：计入了 184 个本机 Rust 编译缓存文件，Windows `Cargo.lock` 换行也改变了干净 checkout 摘要。[初次核对记录](evidence/2026-09-14-portable/fingerprint-portability-initial.json)保留了观察结果。v2 仅排除 `src/backend/wasm/target`，归一化 Rust/lockfile 文本，同时继续覆盖全部真实源码/测试和编译输入。三个回归探针在修复前失败，41 项相关检查现已通过；[Git blob、Windows checkout 模拟与带缓存本机目录的指纹现已一致](evidence/2026-09-14-portable/source-reconciliation-v2.json)。此次变化属于构建证据，不改变业务 runtime 行为；上方原生会话记录仍绑定其原始运行产物。

发布的 Linux sidecar 为 `cff9f0fc2426b3242cd1a3afedc704bbe4f3bb130901f29d957bb73cadf6cb17`，大小 94,693,897 bytes。两份产物均来自干净 CI workspace；本机 generated dist 的 104 个备份残留文件（未压缩 5,694,853 bytes）已保留在 `output/project-convergence-2026-09-12/local-dist-before-ci-34786392248`，再对齐 Windows CI 输入。该 Windows binary 随后在本机再次通过三轮 SQLite soak 和三轮参考 matrix；其[两宿主归档门禁](evidence/2026-09-14-portable/ci/windows-two-hosts/verification.json)通过，每组件六份报告、每宿主三份。Linux 保留独立的每组件三轮 CI 资格。[发布产物身份](evidence/2026-09-14-portable/ci/published-artifacts.json)明确区分这些范围，之前的本机及 development 原生产物继续作为历史证据保留。

### 剩余验收与方向

U1–U6 保持已验收；Q1–Q5、R1–R5、N1–N5 已完成，包含 runtime、证据及源码发布检查点。U7/U8 整体仍为部分验收。Android 仍需签名 arm64 真机执行 SAF 授权/错误/重试、process death/reopen、投影连续性及 RSS 测量，保持既有 25 MiB payload / 256 MiB RSS 限制；当前 ADB 设备列表为空。生产 ANN 与已取得同意的 7/28 天学习观察保留独立验收。

先定义代表性语料与明确的写入延迟/heap SLO，再评估用 journal 替代整快照提交；最终 2,000 文档测量（五次写入、15,751,932-byte snapshot）的 p50/p95 为 343.11/358.00 ms，最大观察 heap 增量 235,244,432 bytes（约 224 MiB），最大采样 RSS 344,633,344 bytes（约 329 MiB）；空语料协作式取消 p95 为 0.97 ms，不是大语料最坏界限。接口变小不会减少 snapshot 分配。候选索引优化应先保 exact matching 语义，fuzzy fallback 最坏情况仍为二次复杂度。不凭这些探针通过就推进全局 route switch、public-ID 切换、移动 SQLite/WASM 扩张或前端重写。下一轮质量工作应在冻结同一测量协议后使用独立采集样本，并保留最终回归语料作为发布门禁。
