# NoteConnection v1.9.0

## English

### Release scope and status

- Version: **1.9.0**. Publication remains pending acceptance of the exact versioned release artifacts; the GitHub Release stays in draft until that verification is complete.
- Compare baseline: **`v1.8.0..v1.9.0`** ([full comparison](https://github.com/Jacobinwwey/NoteConnection/compare/v1.8.0...v1.9.0)). Pre-release source validation covers `cd9ae710fff60c5c14b0b437a1727656cc66a4f8`, before the version metadata and draft-release workflow changes.
- Scope: **125 upstream commits** through `3d68da8398b59fb3d0c35444d19261a5342155b7`, followed by **four fix commits**: three production fixes and one commit correcting four test boundaries, plus the v1.9.0 release metadata and draft-release workflow changes. The source range includes extensive archived qualification evidence as well as implementation changes.
- v1.8.0 already introduced the RSE/document-augmented graph RAG pipeline, Agent Workspace, sidecar architecture and foundation runtime checks. The changes below extend and correct those existing capabilities.

### Highlights

- Answers now plan coverage from grounded graph evidence, admit sources against the question before reading them, and better preserve comparison operands, complementary claims, measurement conditions and uncertainty.
- Agent Workspace adds slim/full answers and adaptive full-response budgets, with cancellation, bounded source reads and bounded JSON/SSE delivery across the request lifecycle.
- Storage and ingestion protect complete state transactions; portable resource identities and versioned mobile projections gain replay, import recovery and explicit resource limits.
- Desktop bundles include the Godot resource pack and gain installed-startup/installer qualification. Linux AppImage fixes address the six distinct failures found while reproducing [AppImage catalog PR #8838](https://github.com/AppImage/appimage.github.io/pull/8838).

### RAG, answer quality and response controls

- **Coverage-driven answer planning:** adds explicit grounded answer plans and clause-level evidence selection; connects the plan to retrieval context, composition and final answer review. Multilingual comparison evidence and independent complementary claims survive deduplication, while repeated claims and unrelated variable glossaries are filtered.
- **Question-connected source admission:** excludes sources that only share an unrelated word with the query before document reads and citation construction. Rejected sources cannot return through graph-neighbor recovery. Navigation-only wiki links no longer become factual assertions.
- **Comparable evidence and readable answers:** handles subject, unit, tolerance and time/environment/version/platform scope when comparing measurements; retains unresolved uncertainty and conflicting storage claims. Distinguishes source presentation labels from factual content, preserves step order and equations, and normalizes bilingual comparison identities.
- **Slim/full and budget controls:** adds compact and fuller answer modes, an adaptive full-response budget informed by browser capability/workload hints, budget diagnostics and cache separation. The optional “unbounded” product setting still obeys runtime time, source, fragment and serialization limits. Mobile stays on the bounded standard profile.
- **Cancellation and delivery:** limits concurrent turns and cumulative source work, propagates cancellation through retrieval, evidence assembly and the provider-backed sufficiency judge, and waits for provider work to settle. Bounded response serialization and SSE backpressure preserve a readable answer with explicit truncation rather than allowing unbounded response framing.
- **Quality evidence:** adds frozen bilingual calibration/evaluation and follow-up confirmation corpora, plus runtime measurements and regression records. These are reproducible quality checks, not a claim of universal factual accuracy, production ANN performance or measured learner outcomes.

### Storage, identities and mobile projections

- **Consistent state commits:** makes file snapshot replacement atomic and cache-coherent, serializes overlapping saves, and isolates concurrent learning-state mutations. Ingest requests validate alias ownership and roll back the complete request on failure; acknowledged writes are not silently absorbed into a later failed transaction.
- **SQLite and provider selection:** restores SQLite-backed storage selection, strengthens provider resolution and improves native storage diagnostics.
- **Portable identities and selected roots:** introduces workspace-relative source identity/canonical-ID metadata with content revisions and compatibility aliases across host boundaries. Ambiguous legacy IDs and escaping paths are rejected. Graph loading retains the user-selected knowledge root. Versioned identity corpora and a readiness gate support future migration without declaring a global public-ID cutover.
- **Bounded local mobile analysis:** introduces versioned graph projections, app-local projection storage and replay, and exact local analysis without allocating a desktop-style full graph on Android. Shared budgets bound documents, input bytes, graph size and projection serialization across hosts.
- **Android import recovery:** adds Storage Access Framework folder import into app-local storage, transaction journals, staging/backup recovery and process-restart handling. Follow-up fixes retain the backup when rollback fails and keep recovery retries non-destructive.
- **Mobile release boundaries:** aligns Tauri Android as the active release route and Capacitor as a compatibility path, adds signed arm64 artifact checks and shared size/RSS budget definitions, and expands host semantic-parity/recovery probes. These changes do not establish a completed signed-device/RSS acceptance run for this candidate.

### Desktop, Godot and installed application behavior

- Packages `path_mode.pck` with the desktop application and launches Godot from the installed resource pack instead of depending on the checkout or launcher's working directory. Explicit development overrides validate the Godot project marker.
- Selects distinct browser-compatible private loopback ports for the HTTP server and bridge. Missing credentials are rejected when sidecar authentication is configured.
- Adds native-window checks that prove the required tests actually ran and exercise Tauri/Godot window lifecycle behavior. Window screenshots, runtime logs and source/artifact identities are retained with the acceptance evidence.
- Adds Windows NSIS/MSI installation, installed startup, Godot entry/return and uninstall qualification on fresh runners, with installer receipts, corrected MSI quoting, WebView2 handling and failure-log retention. Upstream archived Windows acceptance is part of this source range; it is separate from the Linux validation recorded below.

### Linux AppImage corrections

| Failure observed in the published or rebuilt AppImage | Candidate behavior |
| --- | --- |
| `.DirIcon` points to the CI build directory, causing the catalog to report a missing icon. | Tauri CLI 2.12.1 incorporates relative metadata-link generation. |
| `AppRun.wrapped` has root-owned mode 0770, preventing non-owner launch in catalog/install environments. | The updated linuxdeploy chain produces a portable launcher; stored permissions are checked before upload. |
| RPATH rewriting moves the pkg server's appended payload while its embedded offsets remain unchanged, causing a bootstrap `SyntaxError`. | A narrowly scoped adapter at linuxdeploy's supported `PATCHELF` boundary preserves the completed server bytes. Dependency discovery and patching of other ELF files remain active. The final image must contain the exact source-sidecar hash. |
| Ubuntu 24.04-built binaries/libraries require newer glibc than the catalog's Ubuntu 22.04 host. | Linux desktop release builds target Ubuntu 22.04; the tested candidate reports GLIBC_2.35. |
| The native Markdown worker is installed without a target suffix but the resolver searches build filenames only. | The existing resolver also discovers installed `markdown-worker`/`markdown-worker.exe` names, retaining override/build-name precedence. Linux packaged indexes use pulldown without fallback. |
| The simulation worker downloads D3 from an external origin, preventing graph layout without network access. | Force and DAG layout load the existing bundled D3 library and work with only loopback networking. |

`Exec=npm` remains valid because `npm` is the existing packaged Cargo executable. The fix does not rename the product, rewrite pkg offsets after packaging, replace libc or manually repack the public release.

### macOS Godot sidecar preparation

- The first versioned macOS build exposed a separate packaging failure: the official Godot executable runs inside `Godot.app`, but its embedded signature still binds the app's `Info.plist` after copying it to a standalone sidecar. macOS rejects that copy with `SIGKILL`, and signature verification reports `invalid Info.plist`.
- The macOS preparation step now ad-hoc signs the copied standalone sidecar, verifies its signature and runs `--version` before preparing the Godot resource pack. The checksummed upstream archive and the source app remain untouched.
- An isolated macOS arm64 diagnostic reproduced the failure for fresh destinations, the release target, overwritten stubs and replaced inodes. All five failing copy cases passed both Python and Node launch probes after signing their separate control copies. This establishes the preparation fix; final versioned macOS application acceptance remains separate.

### CI, maintainability and documentation

- Adds a final AppImage gate before either artifact upload. It reads stored SquashFS permissions, verifies portable metadata links and executable access, validates desktop fields and icon decoding, and compares the packaged server with the original build output.
- Keeps product releases and asset uploads in draft until the exact CI artifacts are accepted, refuses to overwrite an already public release, and loads the bilingual notes from the checked-out release source. The original Linux server is retained as a separate workflow artifact for the later AppImage integrity check.
- Runs Android builds only when native-device evidence is explicitly requested; signing and device acceptance remain required before mobile assets can be uploaded. npm publication starts only when a product `v*` release is published, while Godot mirror releases neither trigger npm publication nor replace the product’s Latest release.
- Binds foundation SQLite/reference-connector qualification to source fingerprints, exact artifact bytes, workload definitions and independent host identity. Corrects portable fingerprinting and adds Windows/Linux qualification jobs; a passing record for one artifact cannot stand in for another.
- Moves registered NoteMD routes to ownership of complete operations, restores route behavior checks, and removes duplicated graph-window/progress code while preserving matching semantics.
- Splits the top-level README into English and Chinese entrypoints, restores the feature tour, and updates paired architecture/build-flow documentation, progress audits and acceptance records. Adds a local Linux AppImage testing guide.
- Corrects **four test-only assumptions**: binary-upload tests wait for the request to finish writing before teardown; resource-root fixtures use native host paths; the mobile identity corpus tests Windows-style reference normalization without treating a Windows path as a native Linux root; elapsed-time checks accept a valid zero-millisecond result. Production behavior is unchanged by this final test commit.

### Verification and publication boundary

- Complete local Jest validation at `cd9ae710`: **176/176 suites and 1,797/1,797 tests passed**, with no skipped suites/tests, exclusions, forced exit or fixed clock. Both the committed WASM input and a source-built WASM input passed the complete suite.
- Strict Tauri/Rust validation: **34 passed, zero failures, one existing ignored mobile cross-host probe**. TypeScript/Vite build, runtime asset verification, final typecheck and Diataxis checks passed.
- The same candidate AppImage passed the unchanged catalog worker in a local **Ubuntu 22.04.5 x86_64 KVM guest**, including real FUSE, Firejail without external networking, linting, screenshot/OCR and metadata export. The catalog harness used commit `918770b1c093c28b2470c5f43af639d33793689f`; only its download URL was redirected to a local server providing the exact candidate bytes.
- On Ubuntu 22.04, both native FUSE and extract-and-run passed authentication/API checks, graph build, force/DAG positions, Markdown/pulldown, reader display, Godot entry/return and normal shutdown with only loopback networking. The same bytes passed both launch modes on Ubuntu 24.04; host native testing additionally demonstrated reader and Godot entry/return, while host extract-and-run evidence covers APIs, visible graph and normal exit. The 2026-10-04 KVM rerun repeated the catalog and both launch modes and verified guest shutdown.
- Validated local AppImage SHA-256: `d05312d08ac94379a96de79c547e8deb450775b4b39e5b6ecc9cd6e2bbcdb131`. It retains **1.8.0 solely for local diagnosis** and was built from production commit `6ad49655`. The only subsequent changes at `cd9ae710` are the four test files; production-input identity was rechecked.
- **v1.9.0 artifact acceptance is pending.** Version metadata is aligned for the new build. CI creates a draft release and keeps desktop and Android uploads in draft. The exact versioned CI AppImage must pass artifact and KVM acceptance before the release is promoted; the earlier diagnostic artifact result does not establish that the v1.9.0 bytes have passed.
- **Platform boundary:** the Linux qualification and macOS Godot launch diagnosis do not establish complete Windows, macOS or Android release acceptance. Upstream Windows/host-mobile evidence is historical evidence for its recorded inputs, not fresh cross-platform acceptance of the new candidate. Hardware GPU/audio, production ANN and large-corpus performance are also outside the Linux packaging result.
- Known observations remain: reader loading/outline placeholders and some Mermaid/DAG label presentation issues; small-graph analysis may use a sequential worker fallback. Runtime manifests and AppImage extraction caches remain after exit; tested application processes and FUSE mounts terminate normally, and test caches were removed separately after open-file checks.

---

## 中文

### 发布范围与当前状态

- 版本：**1.9.0**。正式公开仍需完成版本化制品的精确字节验收；在验收完成前，GitHub Release 保持草稿状态。
- 对比基线：**`v1.8.0..v1.9.0`**（[完整比较](https://github.com/Jacobinwwey/NoteConnection/compare/v1.8.0...v1.9.0)）。发布前源码验证覆盖 `cd9ae710fff60c5c14b0b437a1727656cc66a4f8`，在其后才调整版本元数据和草稿发布流程。
- 范围包括截止 `3d68da8398b59fb3d0c35444d19261a5342155b7` 的 **125 个上游提交**，随后是 **4 个修复提交**：3 个生产修复提交，以及修正 4 处测试边界的 1 个提交，另有 v1.9.0 版本元数据和草稿发布流程调整。源码范围同时包含实现变化和大量验收归档。
- v1.8.0 已引入 RSE/文档增强图 RAG、Agent Workspace、sidecar 架构和基础运行时检查。以下内容描述这些能力之后的增量与修复。

### 主要变化

- 回答从有依据的图证据规划覆盖范围，在读取来源前检查其与问题的关联，更完整地保留比较对象、互补论点、测量条件和不确定性。
- Agent Workspace 增加精简/完整回答及完整回答的自适应预算；取消信号、源读取预算和 JSON/SSE 输出限制贯穿请求生命周期。
- 存储与摄取保护完整状态事务；跨宿主资源身份和版本化移动投影增加回放、导入恢复和明确的资源上限。
- 桌面包携带 Godot 资源包，并增加安装后启动及安装器验证。Linux AppImage 修复覆盖复现 [AppImage 目录 PR #8838](https://github.com/AppImage/appimage.github.io/pull/8838) 时发现的 6 个独立问题。

### RAG、回答质量与响应控制

- **按覆盖范围规划回答：** 增加明确的、有来源依据的回答计划和语句级证据选择，将计划贯穿检索上下文、组织回答和最终审查。多语言比较证据及独立互补论点能够在去重后保留，同时过滤重复断言和不相关的变量词汇表。
- **先检查问题关联，再读取来源：** 在文档读取和引用生成前排除仅因同一个多义词而命中的无关来源；被拒绝的来源不能经图邻居恢复重新进入。仅起导航作用的 wiki 链接不再被当成事实断言。
- **比较条件与可读性：** 比较测量时考虑主体、单位、公差及时间/环境/版本/平台作用域，保留无法判定的不确定性和冲突的存储证据。区分来源排版标签与事实内容，保持步骤顺序、公式和引用，并统一双语比较证据身份。
- **精简/完整及预算设置：** 增加精简与完整回答，完整模式按浏览器能力和工作量提示选择自适应预算，并提供预算诊断与缓存隔离。“不限制”选项仅取消产品层预算，仍受运行时间、源读取、片段数量和序列化上限约束；移动端保留有界的标准档位。
- **取消与传输：** 限制并发轮次和累计源处理量，将取消信号传递到检索、证据组装和 provider 充分性评审，并等待 provider 停止工作。响应序列化和 SSE 背压控制保留可读答案及明确的截断原因，限制输出占用。
- **质量证据：** 增加冻结的双语校准/评估集、后续确认集、运行时测量和回归记录。这些材料用于复现质量检查，不代表所有回答都正确、生产 ANN 已达标，或学习效果已获实测证明。

### 存储、资源身份与移动投影

- **一致的状态提交：** 文件快照替换保持原子性和缓存一致性，重叠保存串行执行，学习状态的并发修改相互隔离。摄取请求先验证别名归属，失败时回滚完整请求，避免已确认写入被后续失败事务覆盖。
- **SQLite 与 provider 选择：** 恢复 SQLite 存储选择，加固 provider 解析与原生存储诊断。
- **可移植身份与知识库根目录：** 增加跨宿主传递的工作区相对来源身份/canonical-ID 元数据、内容修订和兼容别名，拒绝歧义旧 ID 和越界路径，保留用户选择的知识库根目录。版本化身份语料及就绪门禁用于支持后续迁移，不宣称已全局切换公开 ID。
- **有界移动端本地分析：** 增加版本化图投影、应用内投影存储与回放，以及精确本地分析，避免 Android 分配桌面式完整图对象。各宿主共用预算，约束文档数、输入字节、图规模和投影序列化。
- **Android 导入恢复：** 通过 Storage Access Framework 选择文件夹并导入应用本地存储，加入事务日志、暂存/备份恢复和进程重启处理。后续修复在回滚失败时保留备份，使恢复重试不破坏已有数据。
- **移动发布边界：** 明确 Tauri Android 为当前发布路线、Capacitor 为兼容路线；增加签名 arm64 制品检查、共用体积/RSS 预算，以及宿主语义一致性和恢复探针。这些源码变化不等于本候选版本已完成签名真机和 RSS 验收。

### 桌面、Godot 与安装后行为

- 桌面应用打包 `path_mode.pck`，从已安装资源包启动 Godot，不再依赖源码目录或启动器工作目录。显式开发覆盖路径需要包含有效 Godot 项目标记。
- 为 HTTP 服务和 bridge 选择不同且浏览器可用的私有回环端口；配置 sidecar 认证后，缺失凭据的请求会被拒绝。
- 原生窗口验证会核对必需测试是否真正执行，并检查 Tauri/Godot 窗口生命周期；截图、运行日志和源码/制品身份随证据归档。
- 增加 Windows NSIS/MSI 在全新 runner 上的安装、安装后启动、Godot 进入/返回及卸载验证，记录安装器来源，修正 MSI 引号、WebView2 处理和失败日志保留。该范围包含上游已归档的 Windows 验收；它与下述 Linux 验证分别记录。

### Linux AppImage 修复

| 在已发布或重建制品中观察到的问题 | 候选版本行为 |
| --- | --- |
| `.DirIcon` 指向 CI 构建目录，目录检查报图标缺失。 | Tauri CLI 2.12.1 包含相对元数据链接修复。 |
| `AppRun.wrapped` 属于 root 且权限为 0770，目录/安装环境中的其他用户无法执行。 | 更新后的 linuxdeploy 生成可供其他用户执行的启动器，上传前检查制品内实际权限。 |
| RPATH 改写移动 pkg server 的附加数据，而内嵌偏移未更新，启动报 bootstrap `SyntaxError`。 | 在 linuxdeploy 支持的 `PATCHELF` 边界仅保护精确匹配的完整 server，继续收集依赖并处理其他 ELF。最终制品内 server 必须与本次构建原件散列完全一致。 |
| Ubuntu 24.04 构建的二进制/库需要比目录 Ubuntu 22.04 更高的 glibc。 | Linux 桌面发布构建固定 Ubuntu 22.04；已测候选报告 GLIBC_2.35。 |
| 原生 Markdown worker 安装后没有 target 后缀，解析器却只查找构建文件名。 | 现有解析器补充查找安装名 `markdown-worker`/`markdown-worker.exe`，保留显式覆盖和构建名优先级；Linux 包内索引使用 pulldown，无 fallback。 |
| simulation worker 从外部站点加载 D3，无网络时图布局失败。 | Force 和 DAG 布局改用已有的随包 D3，仅有回环网络时也能工作。 |

`Exec=npm` 仍有效，因为 `npm` 是既有 Cargo 可执行文件名且已打包。本修复没有更名产品、在打包后补写 pkg 偏移、替换 libc 或手工重打包公开制品。

### macOS Godot sidecar 准备

- 首次版本化 macOS 构建暴露了独立的打包问题：官方 Godot 可执行文件在 `Godot.app` 内正常运行，但复制为独立 sidecar 后，内嵌签名仍绑定原应用的 `Info.plist`。macOS 以 `SIGKILL` 拒绝启动，验签明确报告 `invalid Info.plist`。
- macOS 准备步骤现在对复制出的独立 sidecar 执行 ad-hoc 签名、验签和 `--version` 启动检查，再准备 Godot 资源包。上游归档的散列校验和原始 app 保持不变。
- 隔离 macOS arm64 诊断覆盖全新目标、发布目标、覆盖 stub 和更换 inode，均复现失败；五组失败用例另制对照副本，签名后均通过 Python 与 Node 启动探针。这证明了准备步骤修复，最终版本化 macOS 应用的验收另行进行。

### CI、可维护性与文档

- 在两类制品上传之前执行最终 AppImage 门禁：读取 SquashFS 实际权限，验证元数据链接和可执行权限，检查 desktop 字段、图标解码，并比对包内 server 与构建原件。
- 在精确 CI 制品验收前，产品发布和资产上传均保持草稿，拒绝覆盖已公开发布，并从检出的发布源码读取双语说明。Linux 原始 server 另存为 workflow artifact，供后续 AppImage 完整性复核。
- 仅在明确请求原生真机证据时启动 Android 构建；移动资产上传仍必须通过签名和真机验收。npm 仅在产品 `v*` release 正式公开时发布；Godot 镜像发布既不触发 npm，也不取代产品的 Latest 发布。
- 将基础 SQLite/参考连接器验收绑定到源码指纹、精确制品字节、工作负载和独立宿主身份；修正跨平台指纹并增加 Windows/Linux 验证任务，避免拿一份制品的合格记录替代另一份。
- 让已注册 NoteMD 路由拥有完整操作，恢复路由行为检查，去除重复的图窗口提取及进度代码，同时保持匹配语义。
- 顶层 README 分为英文、中文入口，恢复功能导览；同步双语架构/构建流程文档、进度审计与验收档案，并增加 Linux AppImage 本地测试指南。
- 修正 **4 处仅测试问题**：二进制上传测试等待请求写完才允许清理；资源根目录 fixture 使用宿主原生路径；移动身份语料直接验证 Windows 风格引用归一化，不把 Windows 路径误当作 Linux 原生根目录；耗时断言允许合法的 0 毫秒结果。最后这一个提交不改变生产行为。

### 验证结果与发布边界

- `cd9ae710` 的完整本地 Jest 验证：**176/176 套件、1,797/1,797 测试通过**，无跳过、排除套件、强制退出或固定时钟。提交中的 WASM 与从源码重建的 WASM 分别通过完整套件。
- 严格 Tauri/Rust 验证：**34 通过、0 失败、1 个既有移动跨宿主探针被正常 runner 忽略**。TypeScript/Vite 构建、运行时资源验证、最终类型检查和 Diataxis 检查通过。
- 同一候选 AppImage 在本地 **Ubuntu 22.04.5 x86_64 KVM 客体**通过未修改的原目录 worker，包括真实 FUSE、无外网 Firejail、lint、截图/OCR 和元数据导出。目录脚本来源为 `918770b1c093c28b2470c5f43af639d33793689f`；仅把下载地址改为提供同一候选字节的本地服务。
- Ubuntu 22.04 的原生 FUSE 与解包运行均在仅有回环网络时通过认证/API、图构建、Force/DAG、Markdown/pulldown、阅读器、Godot 进入/返回及正常退出。同一制品也通过 Ubuntu 24.04 两种启动方式：宿主原生验证覆盖阅读器和 Godot 进入/返回，宿主解包证据覆盖 API、可见图谱和正常退出。2026-10-04 最终 KVM 复验再次通过目录与两种启动方式，并验证客体正常关机。
- 已测本地 AppImage SHA-256：`d05312d08ac94379a96de79c547e8deb450775b4b39e5b6ecc9cd6e2bbcdb131`。其 **1.8.0 版本号仅供本地诊断**，生产构建来源是 `6ad49655`；到 `cd9ae710` 仅增加 4 个测试文件修改，已再次核对生产输入身份。
- **v1.9.0 制品验收仍待完成。** 新构建所需的版本元数据已对齐。CI 创建草稿发布，桌面和 Android 上传均保持草稿状态。必须对 CI 生成的新版本 AppImage 精确字节完成制品门禁与 KVM 验收后，才将发布转为公开；此前诊断制品的通过记录不能替代 v1.9.0 字节验收。
- **平台边界：** Linux 验证及 macOS Godot 启动诊断不等于已完成 Windows、macOS、Android 发布制品的全面验收。上游 Windows/移动宿主记录只证明各自所记录输入的历史结果，不替代新候选的跨平台验收。硬件 GPU/音频、生产 ANN 和大语料性能也不在本轮 Linux 打包结论内。
- 保留的已知观察：阅读器加载/大纲占位文字、部分 Mermaid/DAG 标签显示问题，以及小图分析可能采用串行 worker fallback。正常退出会结束已测应用进程和 FUSE 挂载，但 runtime manifest 与 AppImage 解包缓存仍保留；测试在检查无打开文件后另外清理缓存。
