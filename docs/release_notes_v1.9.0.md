# NoteConnection v1.9.0

## English

### Release scope

- Release date: **2026-10-05 (UTC)**.
- Version: **1.9.0**. Release source: [`ff749c2559974c36e5c7f3bb30faf00ee5887fb4`](https://github.com/Jacobinwwey/NoteConnection/commit/ff749c2559974c36e5c7f3bb30faf00ee5887fb4).
- Compare baseline: **`v1.8.0..v1.9.0`** ([full comparison](https://github.com/Jacobinwwey/NoteConnection/compare/v1.8.0...v1.9.0)).
- Scope: **125 upstream commits** through `3d68da8398b59fb3d0c35444d19261a5342155b7`, followed by Linux packaging/runtime fixes, corrections to four test assumptions, v1.9.0 release metadata and draft-release workflow changes, the macOS standalone Godot signature fix, and the native About version fix. The source range includes archived qualification evidence as well as implementation changes.
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
- **Mobile release boundaries:** aligns Tauri Android as the active release route and Capacitor as a compatibility path, adds signed arm64 artifact checks and shared size/RSS budget definitions, and expands host semantic-parity/recovery probes. **No Android APK/AAB is released in v1.9.0:** signing credentials and a configured device acceptance environment were unavailable, so Android assets are excluded from this release and require signing/device acceptance before a future mobile publication. The host-side changes do not establish signed-device or RSS acceptance.

### Desktop, Godot and installed application behavior

- **About uses the configured release version:** the native menu dialog previously hardcoded `v1.6.0`. It now reads `app_handle.package_info().version`, which Tauri generates from the application configuration, so the displayed version follows the configured `1.9.0` without a second version string. Source review and strict Rust validation passed. The rebuilt AppImage displays `1.9.0` in the actual native About dialog in both FUSE and extract-and-run modes.
- Packages `path_mode.pck` with the desktop application and launches Godot from the installed resource pack instead of depending on the checkout or launcher's working directory. Explicit development overrides validate the Godot project marker.
- Selects distinct browser-compatible private loopback ports for the HTTP server and bridge. Missing credentials are rejected when sidecar authentication is configured.
- Adds native-window checks that prove the required tests actually ran and exercise Tauri/Godot window lifecycle behavior. Window screenshots, runtime logs and source/artifact identities are retained with the acceptance evidence.
- Adds Windows NSIS/MSI installation, installed startup, Godot entry/return and uninstall qualification on fresh runners, with installer receipts, corrected MSI quoting, WebView2 handling and failure-log retention. Upstream archived Windows acceptance is part of this source range; it is separate from the Linux validation recorded below.

### Linux AppImage corrections

| Failure observed in the published or rebuilt AppImage | Behavior in v1.9.0 |
| --- | --- |
| `.DirIcon` points to the CI build directory, causing the catalog to report a missing icon. | Tauri CLI 2.12.1 includes the relative metadata-link fix first released in CLI 2.11.4. |
| `AppRun.wrapped` has root-owned mode 0770, preventing non-owner launch in catalog/install environments. | The updated linuxdeploy chain produces mode 0755; stored permissions are checked before upload. |
| RPATH rewriting moves the pkg server's appended payload while its embedded offsets remain unchanged, causing a bootstrap `SyntaxError`. | An adapter at linuxdeploy's supported `PATCHELF` boundary skips only `--set-rpath` for the exact source-hash-matching pkg server. Queries and operations on other files are forwarded, preserving dependency discovery. The final image must contain the exact source-sidecar bytes. |
| Ubuntu 24.04-built binaries/libraries require newer glibc than the catalog's Ubuntu 22.04 host. | Linux desktop release builds target Ubuntu 22.04 and its glibc 2.35 baseline. |
| The native Markdown worker is installed without a target suffix but the resolver searches build filenames only. | The existing resolver also discovers installed `markdown-worker`/`markdown-worker.exe` names, retaining override/build-name precedence. Linux packaged indexes use pulldown without fallback. |
| The simulation worker downloads D3 from an external origin, preventing graph layout without network access. | Force and DAG layout load the existing bundled D3 library and work with only loopback networking. |

`Exec=npm` remains valid because `npm` is the existing packaged Cargo executable. The fix does not rename the product, rewrite pkg offsets after packaging, replace libc or manually repack the public release.

### macOS Godot sidecar preparation

- The first versioned macOS build exposed a separate packaging failure: the official Godot executable runs inside `Godot.app`, but its embedded signature still binds the app's `Info.plist` after copying it to a standalone sidecar. macOS rejects that copy with `SIGKILL`, and signature verification reports `invalid Info.plist`.
- The macOS preparation step now ad-hoc signs the copied standalone sidecar, verifies its signature and runs `--version` before preparing the Godot resource pack. The checksummed upstream archive and the source app remain untouched.
- An isolated native macOS arm64 diagnostic reproduced the failure for fresh destinations, the release target, overwritten stubs and replaced inodes. All five failing copy cases passed strict signature verification and both Python and Node launch probes after signing their separate control copies. The final macOS CI build also passed its sidecar preparation and packaging steps. These results establish copied-sidecar signature/startup behavior and successful packaging; they do not establish full macOS application GUI acceptance, Developer ID signing or notarization.

### CI, maintainability and documentation

- Adds a final AppImage gate before either artifact upload. It reads stored SquashFS permissions, verifies portable metadata links and executable access, validates desktop fields and icon decoding, and compares the packaged server with the original build output.
- Keeps product releases and asset uploads in draft until the exact CI artifacts are accepted, refuses to overwrite an already public release, and loads the bilingual notes from the checked-out release source. The original Linux server is retained as a separate workflow artifact for the later AppImage integrity check.
- Runs Android builds only when native-device evidence is explicitly requested; signing and device acceptance remain required before mobile assets can be uploaded. npm publication starts only when a product `v*` release is published, while Godot mirror releases neither trigger npm publication nor replace the product’s Latest release.
- Binds foundation SQLite/reference-connector qualification to source fingerprints, exact artifact bytes, workload definitions and independent host identity. Corrects portable fingerprinting and adds Windows/Linux qualification jobs; a passing record for one artifact cannot stand in for another.
- Moves registered NoteMD routes to ownership of complete operations, restores route behavior checks, and removes duplicated graph-window/progress code while preserving matching semantics.
- Splits the top-level README into English and Chinese entrypoints, restores the feature tour, and updates paired architecture/build-flow documentation, progress audits and acceptance records. Adds a local Linux AppImage testing guide.
- Corrects **four test-only assumptions**: binary-upload tests wait for the request to finish writing before teardown; resource-root fixtures use native host paths; the mobile identity corpus tests Windows-style reference normalization without treating a Windows path as a native Linux root; elapsed-time checks accept a valid zero-millisecond result. These test changes do not change production behavior.

### Builds and validation

- **Windows, macOS and Linux desktop builds all passed** in [CI run 37250352656](https://github.com/Jacobinwwey/NoteConnection/actions/runs/37250352656), from release source `ff749c2559974c36e5c7f3bb30faf00ee5887fb4`, including the About fix. The [version gate](https://github.com/Jacobinwwey/NoteConnection/actions/runs/37250352645) passed. All five downloaded release assets match this run's artifacts by SHA-256 and size.

| Platform | Architecture | Release assets | Final CI result |
| --- | --- | --- | --- |
| Windows | x64 | `NoteConnection_1.9.0_x64-setup.exe`, `NoteConnection_1.9.0_x64_en-US.msi` | Build and upload passed |
| macOS | Apple Silicon / aarch64 | `NoteConnection_1.9.0_aarch64.dmg` | Build and upload passed |
| Linux | amd64 / x86_64 | `NoteConnection_1.9.0_amd64.AppImage`, `NoteConnection_1.9.0_amd64.deb` | Build, upload and AppImage integrity gate passed |

- **Complete Jest validation of the source including the About fix:** **176/176 suites and 1,797/1,797 tests passed**, with zero failures, skipped tests or todo tests. The full run used no suite exclusions, forced exit or fixed clock and exited naturally. Independent review confirmed that every suite and assertion passed.
- **Strict Tauri/Rust validation of the About change:** `NOTE_CONNECTION_TAURI_TEST_STRICT=1 npm run test:tauri -- --locked` passed with **34 passed, zero failures, one existing ignored mobile cross-host probe and zero filtered tests**. Independent review verified the Tauri version source, unchanged surrounding menu behavior, scoped formatting and documentation checks.
- **Final Linux artifact identity:** AppImage SHA-256 is `1ac08976a86f77ba9e45005c30de7379b870c97a3cc103e760540703177519c3`. The packaged server matches the original server from the same CI build byte for byte, SHA-256 `59b8bfebc2d059e1c53097bf43bf328da992e9ae2b66213a6003aebb12c7bdcf`. The AppImage integrity gate passed in CI and against the downloaded release artifact; the local `verify:appimage` command exited 0.
- **Linux KVM end-to-end acceptance passed** on Ubuntu 22.04 x86_64 using the exact AppImage hash above. The catalog worker exited 0 and reported glibc 2.35. Both native FUSE and extract-and-run modes passed authenticated API and native Markdown/pulldown checks with only loopback networking, displayed `1.9.0` in the native About dialog, showed force/DAG layouts with directed edges, rendered actual Markdown and Mermaid in the reader, and entered and returned from Godot Path Mode with a two-node, one-edge graph.
- **Normal exit and cleanup passed:** after returning from Godot, both modes closed through the window manager and exited 0. All 26 observed application PIDs, the test namespace and its support processes were gone, and the native FUSE mount was removed. Extraction caches persisted after application exit and were then removed manually after an open-file check; runtime manifests were preserved as evidence. The guest powered off normally, with serial-console and host-side confirmation at `2026-10-05T02:36:11Z`; QEMU and its control sockets were gone, while the VM disk was retained.
- **Verification attachments:** [Linux KVM validation summary and screenshots](https://github.com/Jacobinwwey/NoteConnection/releases/download/v1.9.0/NoteConnection_1.9.0_linux-kvm-validation.zip), [SHA256SUMS.txt](https://github.com/Jacobinwwey/NoteConnection/releases/download/v1.9.0/SHA256SUMS.txt), [source-validation.json](https://github.com/Jacobinwwey/NoteConnection/releases/download/v1.9.0/source-validation.json) and [public-ci-manifest.json](https://github.com/Jacobinwwey/NoteConnection/releases/download/v1.9.0/public-ci-manifest.json).
- **Platform boundary:** successful Windows/macOS CI builds establish packaging for their recorded inputs. The macOS signature/startup diagnosis covers the copied Godot executable. Archived upstream Windows install/start/Godot/uninstall and host-mobile records remain separate from final Linux KVM end-to-end acceptance. They do not establish fresh full-application acceptance for every desktop platform. Android signing/device/RSS acceptance, hardware GPU/audio, production ANN and large-corpus performance are outside this release validation.
- **Known observations from earlier Linux diagnosis:** reader loading/outline placeholders, some Mermaid/DAG label presentation issues and a sequential worker fallback for small graphs remain documented.

---

## 中文

### 发布范围

- 发布日期：**2026-10-05（UTC）**。
- 版本：**1.9.0**。发布源码：[`ff749c2559974c36e5c7f3bb30faf00ee5887fb4`](https://github.com/Jacobinwwey/NoteConnection/commit/ff749c2559974c36e5c7f3bb30faf00ee5887fb4)。
- 对比基线：**`v1.8.0..v1.9.0`**（[完整比较](https://github.com/Jacobinwwey/NoteConnection/compare/v1.8.0...v1.9.0)）。
- 范围包括截止 `3d68da8398b59fb3d0c35444d19261a5342155b7` 的 **125 个上游提交**，以及后续 Linux 打包/运行时修复、4 处测试假设修正、v1.9.0 版本元数据和草稿发布流程调整、macOS 独立 Godot 签名修复，以及原生 About 版本显示修复。源码范围同时包含实现变化和验收归档。
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
- **移动发布边界：** 明确 Tauri Android 为当前发布路线、Capacitor 为兼容路线；增加签名 arm64 制品检查、共用体积/RSS 预算，以及宿主语义一致性和恢复探针。**v1.9.0 不发布 Android APK/AAB：** 本次缺少签名凭据及已配置的真机验收环境，因此本次发布不包含 Android 资产；后续移动发布仍需完成签名和真机验收。宿主侧变化不代表已完成签名真机或 RSS 验收。

### 桌面、Godot 与安装后行为

- **About 使用配置中的发布版本：** 原生菜单对话框此前硬编码 `v1.6.0`，现改为读取 `app_handle.package_info().version`，由 Tauri 从应用配置生成版本信息，使显示内容跟随配置中的 `1.9.0`，无需维护第二份版本字符串。源码审查和严格 Rust 验证已通过；重建 AppImage 的 FUSE 与解包运行模式均已实际打开原生 About 对话框，确认显示 `1.9.0`。
- 桌面应用打包 `path_mode.pck`，从已安装资源包启动 Godot，不再依赖源码目录或启动器工作目录。显式开发覆盖路径需要包含有效 Godot 项目标记。
- 为 HTTP 服务和 bridge 选择不同且浏览器可用的私有回环端口；配置 sidecar 认证后，缺失凭据的请求会被拒绝。
- 原生窗口验证会核对必需测试是否真正执行，并检查 Tauri/Godot 窗口生命周期；截图、运行日志和源码/制品身份随证据归档。
- 增加 Windows NSIS/MSI 在全新 runner 上的安装、安装后启动、Godot 进入/返回及卸载验证，记录安装器来源，修正 MSI 引号、WebView2 处理和失败日志保留。该范围包含上游已归档的 Windows 验收；它与下述 Linux 验证分别记录。

### Linux AppImage 修复

| 在已发布或重建制品中观察到的问题 | v1.9.0 行为 |
| --- | --- |
| `.DirIcon` 指向 CI 构建目录，目录检查报图标缺失。 | Tauri CLI 2.12.1 包含首次于 CLI 2.11.4 发布的相对元数据链接修复。 |
| `AppRun.wrapped` 属于 root 且权限为 0770，目录/安装环境中的其他用户无法执行。 | 更新后的 linuxdeploy 生成权限为 0755 的启动器，上传前检查制品内实际权限。 |
| RPATH 改写移动 pkg server 的附加数据，而内嵌偏移未更新，启动报 bootstrap `SyntaxError`。 | 在 linuxdeploy 支持的 `PATCHELF` 边界，仅对散列与本次构建原件精确匹配的 pkg server 跳过 `--set-rpath`；查询及其他文件操作继续转发，保留依赖收集。最终包内 server 必须与构建原件逐字节一致。 |
| Ubuntu 24.04 构建的二进制/库需要比目录 Ubuntu 22.04 更高的 glibc。 | Linux 桌面发布构建固定 Ubuntu 22.04，采用其 glibc 2.35 基线。 |
| 原生 Markdown worker 安装后没有 target 后缀，解析器却只查找构建文件名。 | 现有解析器补充查找安装名 `markdown-worker`/`markdown-worker.exe`，保留显式覆盖和构建名优先级；Linux 包内索引使用 pulldown，无 fallback。 |
| simulation worker 从外部站点加载 D3，无网络时图布局失败。 | Force 和 DAG 布局改用已有的随包 D3，仅有回环网络时也能工作。 |

`Exec=npm` 仍有效，因为 `npm` 是既有 Cargo 可执行文件名且已打包。本修复没有更名产品、在打包后补写 pkg 偏移、替换 libc 或手工重打包公开制品。

### macOS Godot sidecar 准备

- 首次版本化 macOS 构建暴露了独立的打包问题：官方 Godot 可执行文件在 `Godot.app` 内正常运行，但复制为独立 sidecar 后，内嵌签名仍绑定原应用的 `Info.plist`。macOS 以 `SIGKILL` 拒绝启动，验签明确报告 `invalid Info.plist`。
- macOS 准备步骤现在对复制出的独立 sidecar 执行 ad-hoc 签名、验签和 `--version` 启动检查，再准备 Godot 资源包。上游归档的散列校验和原始 app 保持不变。
- 隔离的原生 macOS arm64 诊断覆盖全新目标、发布目标、覆盖 stub 和更换 inode，均复现失败；五组失败用例另制对照副本，签名后均通过严格验签及 Python、Node 启动探针。最终 macOS CI 构建也已通过 sidecar 准备和打包步骤。这些结果证明了独立 sidecar 的签名/启动行为及打包成功，不等于完整 macOS 应用 GUI 验收、Developer ID 签名或公证。

### CI、可维护性与文档

- 在两类制品上传之前执行最终 AppImage 门禁：读取 SquashFS 实际权限，验证元数据链接和可执行权限，检查 desktop 字段、图标解码，并比对包内 server 与构建原件。
- 在精确 CI 制品验收前，产品发布和资产上传均保持草稿，拒绝覆盖已公开发布，并从检出的发布源码读取双语说明。Linux 原始 server 另存为 workflow artifact，供后续 AppImage 完整性复核。
- 仅在明确请求原生真机证据时启动 Android 构建；移动资产上传仍必须通过签名和真机验收。npm 仅在产品 `v*` release 正式公开时发布；Godot 镜像发布既不触发 npm，也不取代产品的 Latest 发布。
- 将基础 SQLite/参考连接器验收绑定到源码指纹、精确制品字节、工作负载和独立宿主身份；修正跨平台指纹并增加 Windows/Linux 验证任务，避免拿一份制品的合格记录替代另一份。
- 让已注册 NoteMD 路由拥有完整操作，恢复路由行为检查，去除重复的图窗口提取及进度代码，同时保持匹配语义。
- 顶层 README 分为英文、中文入口，恢复功能导览；同步双语架构/构建流程文档、进度审计与验收档案，并增加 Linux AppImage 本地测试指南。
- 修正 **4 处仅测试问题**：二进制上传测试等待请求写完才允许清理；资源根目录 fixture 使用宿主原生路径；移动身份语料直接验证 Windows 风格引用归一化，不把 Windows 路径误当作 Linux 原生根目录；耗时断言允许合法的 0 毫秒结果。这些测试修改不改变生产行为。

### 构建与验证

- **Windows、macOS、Linux 三个平台桌面构建全部通过：** [CI 运行 37250352656](https://github.com/Jacobinwwey/NoteConnection/actions/runs/37250352656) 使用包含 About 修复的发布源码 `ff749c2559974c36e5c7f3bb30faf00ee5887fb4`。[版本门禁](https://github.com/Jacobinwwey/NoteConnection/actions/runs/37250352645)已通过。全部 5 个下载后的发布资产均按 SHA-256 和大小确认与本次运行制品一致。

| 平台 | 架构 | 发布资产 | 最终 CI 结果 |
| --- | --- | --- | --- |
| Windows | x64 | `NoteConnection_1.9.0_x64-setup.exe`、`NoteConnection_1.9.0_x64_en-US.msi` | 构建、上传通过 |
| macOS | Apple Silicon / aarch64 | `NoteConnection_1.9.0_aarch64.dmg` | 构建、上传通过 |
| Linux | amd64 / x86_64 | `NoteConnection_1.9.0_amd64.AppImage`、`NoteConnection_1.9.0_amd64.deb` | 构建、上传及 AppImage 完整性门禁通过 |

- **包含 About 修复的源码完整 Jest 验证：176/176 套件、1,797/1,797 测试通过**，0 失败、跳过或 todo。完整运行未排除套件、强制退出或固定时钟，测试自然退出。独立审查逐项确认所有 suite/assertion 均通过。
- **About 修改的严格 Tauri/Rust 验证：** `NOTE_CONNECTION_TAURI_TEST_STRICT=1 npm run test:tauri -- --locked` 通过，**34 通过、0 失败、1 个既有移动跨宿主探针忽略、0 筛除**。独立审查核对了 Tauri 版本来源、周边菜单行为保持不变、修改片段格式及文档检查。
- **最终 Linux 制品身份：** AppImage SHA-256 为 `1ac08976a86f77ba9e45005c30de7379b870c97a3cc103e760540703177519c3`。包内 server 与同次 CI 构建原件逐字节一致，SHA-256 为 `59b8bfebc2d059e1c53097bf43bf328da992e9ae2b66213a6003aebb12c7bdcf`。CI 和下载后的发布制品均通过 AppImage 完整性门禁，本地 `verify:appimage` 命令真实退出码为 0。
- **Linux KVM 端到端验收已通过：** 在 Ubuntu 22.04 x86_64 上使用前述精确 AppImage 字节。目录 worker 退出 0，报告 glibc 2.35。原生 FUSE 与解包运行两种模式均在仅有回环网络时通过认证 API 和原生 Markdown/pulldown 检查，原生 About 实际显示 `1.9.0`，Force/DAG 布局显示有向边，阅读器实际渲染 Markdown 和 Mermaid，并以两节点、一条边的图谱进入和返回 Godot Path Mode。
- **正常退出与清理已通过：** 从 Godot 返回后，两种模式均通过窗口管理器关闭，退出码均为 0。观测到的 26 个应用 PID、测试命名空间及辅助进程均无残留，原生 FUSE 挂载已消失。解包缓存会在应用退出后保留，测试在检查无打开文件后另外手动删除；runtime manifest 保留为证据。客体正常关机，串口与宿主侧证据在 `2026-10-05T02:36:11Z` 确认 QEMU 及其控制套接字均消失，虚拟机磁盘保留。
- **验证附件：** [Linux KVM 验证摘要与截图](https://github.com/Jacobinwwey/NoteConnection/releases/download/v1.9.0/NoteConnection_1.9.0_linux-kvm-validation.zip)、[SHA256SUMS.txt](https://github.com/Jacobinwwey/NoteConnection/releases/download/v1.9.0/SHA256SUMS.txt)、[source-validation.json](https://github.com/Jacobinwwey/NoteConnection/releases/download/v1.9.0/source-validation.json)、[public-ci-manifest.json](https://github.com/Jacobinwwey/NoteConnection/releases/download/v1.9.0/public-ci-manifest.json)。
- **平台边界：** Windows/macOS CI 构建成功只证明对应输入的打包结果；macOS 验签/启动诊断覆盖复制后的 Godot 可执行文件。上游归档的 Windows 安装/启动/Godot/卸载和移动宿主记录与最终 Linux KVM 端到端验收分别记录，不等于每个平台的新制品均已完成完整应用验收。Android 签名/真机/RSS、硬件 GPU/音频、生产 ANN 和大语料性能不在本次发布验证范围内。
- **此前 Linux 诊断保留的已知观察：** 阅读器加载/大纲占位文字、部分 Mermaid/DAG 标签显示问题，以及小图分析的串行 worker fallback。
