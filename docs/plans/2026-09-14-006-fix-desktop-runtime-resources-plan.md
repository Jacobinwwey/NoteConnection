---
title: "fix: Qualify desktop runtime resources outside the checkout"
type: fix
status: in_progress
date: 2026-09-14
updated: 2026-10-01
source_revision: 6bf87b6d11fa01b5b1c8cd21f2ec44cbbc2bbc3a
parent: docs/plans/2026-09-12-001-refactor-project-convergence-plan.md
---

# Desktop Runtime Resources / 桌面运行资源

## English

The W1–W5 window contracts are complete, but do not execute the installed application's startup path. The current Tauri bundle declares executable sidecars without Godot project resources; `resolve_godot_project_path` falls back to `cwd/path_mode`. In addition, the Godot project declares 4.6 while desktop release provisioning pins 4.3. These are concrete packaging risks, not yet installer acceptance evidence.

- [x] P1: Reproduce startup outside the checkout with isolated config, runtime data, WebView profile and owned-process cleanup. Preserve the failure before changing production code.
- [x] P2: Resolve packaged resources at the desktop shell owner; keep explicit development overrides and avoid dependence on the launcher's working directory.
- [x] P3: Package the required Godot resources, exclude editor caches and unsupported SVG imports, and verify the engine version used by release provisioning against the project.
- [ ] P4: Build and exercise a fresh desktop bundle/installer in an isolated target, including resource startup, window transitions and shutdown. Keep installer behavior and signing trust as separate evidence.
- [ ] P5: Run affected and required checks, archive source/artifact provenance, update both languages and integrate verified changes into main.

Do not modify unrelated route, learning or identity behavior. Reuse existing runtime/build owners. Unsigned Windows installer behavior can be tested without pretending that signing has been qualified; Android release signing/device and learner evidence remain separate prerequisites. No release tags or release publication are authorized by this unit.

September 15 checkpoint: the isolated NSIS-extracted executable builds the two-node graph, delivers the layout to Godot, returns through the actual Godot Exit button and shuts down cleanly. The original missing-resource failure and misplaced packaged runtime manifest are retained. A later probe exposed an OS-assigned Bridge port of 6666: WebView reports `ERR_UNSAFE_PORT` while Godot connects successfully. Desktop selection now uses distinct ports in 49152–65535; the regression failed before the fix and passes afterward. This does not transfer the sockets between processes: a competing bind still fails startup rather than silently changing advertised endpoints.

P4 remains open until fresh NSIS/MSI installation and uninstallation pass on a disposable Windows runner. The new qualification workflow checks installed hashes, paths containing spaces, startup outside the checkout, graph/layout, frontend-owned exit, shutdown and preserved runtime data. Native Godot button input remains separately recorded. DPI-aware screenshots prevent truncated evidence on scaled displays. Final source/artifact qualification and publication remain P5 obligations.

Source checkpoint: Node 22.19.0 and 24.14.0 each pass 170 suites / 1,731 tests with zero failures or skips; 34 ordinary Rust tests, both separately executed Wry window tests, and the explicit Rust mobile semantic probe pass. The full run first detected test discovery entering archived compiled output; Jest now discovers the actual `src/` suites. Supply-readiness consumes the centralized Godot configuration while still rejecting missing digest pins. Pack tests also reject a symlinked runtime root and files added during export; both regressions failed before their fixes. TypeScript/Vite, 40 frontend runtime assets and a real Godot 4.6 import/export pass. These checks precede fresh installer execution.

Remote source `031f85f8`: native-window run `34892491842` and Windows/Linux foundation run `34898619256` pass. Initial installer run `34892491904` correctly remains failed. It exposed verifier assumptions: Tauri temporarily stamps `UNK` as `NSS`/`MSI` in each bundled executable; msiexec requires quotes around a property's value, not around the whole `NAME=value` argument. The follow-up derives the exact stamped hash while checking all other bytes. Seven payload tests and actual NSIS/MSI byte comparisons pass. A missing-package probe reproduces the old quoting timeout and returns expected error 1619 with corrected quoting; no package was installed by that probe.

Artifact scope: the local PCK includes five ignored HDR `.exr` files (179,271,168 bytes); clean CI contains tracked runtime sources without those optional backgrounds (311,164 bytes in the initial run). Preserve each input manifest separately. Do not infer byte reproducibility or equivalent optional-background coverage from the same source commit.

Installer run `34904204940` verifies the stamp fix, all NSIS payload hashes and successful silent MSI commands. Acceptance remains failed: NSIS reaches Godot through the runner's D3D12 fallback but the WebView debugger is unavailable; MSI restores the prior NSIS directory from the shared user's remembered install location. Qualify each format on its own fresh runner, collect failed-window/process diagnostics before shutdown and archive evidence separately from binaries. Do not clear shared registry preferences merely to make the combined test pass. The archive retains both failed runs.

Run `34907653037` confirms installation, payload verification and removal independently for both formats; both stop at CDP discovery. The recorded WebView2 152 child arguments omit the requested debugging switches. The same CI executable passes the complete runtime probe locally, including paths with spaces. [WebView2's documented elevation hardening](https://github.com/MicrosoftEdge/WebView2Feedback/issues/5640#issuecomment-4923662109) explains the difference: elevated hosts ignore user-writable argument overrides. The CI launcher now sets app-specific HKLM argument policies on disposable GitHub-hosted runners, restores the process environment and removes only its owned values in `finally`. Acceptance requires a policy-cleanup receipt. Nineteen targeted tests pass, and the non-CI guard rejects execution before registry access. Fresh remote acceptance is still required.

October 1 continuation on `227678d`: run `36817551883` confirms the elevated policy fix on WebView2 153 for both formats, with successful policy cleanup. MSI passes the full acceptance flow. NSIS reaches graph/layout, but the 15-second capture subprocess deadline terminates PNG writing: the archived image is 65,536 bytes with an incomplete IDAT chunk and no IEND. The capture invocation now has a bounded 60-second budget while other native commands retain 15 seconds. Stage timings and stderr are retained for diagnosis; no acceptance assertion is relaxed. A fresh run must still pass NSIS and MSI before P4/P5 close.

Run `36820293638` fails before screenshot capture in both formats: the two-request graph check/read races SourceManager's delayed post-build reload. The pre-verification graph can disappear between CDP requests. Acceptance now waits for the replacement document (`performance.timeOrigin`) and checks/copies its graph in a single evaluation. Two VM-backed regression cases reproduce the old undefined-graph/destroyed-context failures; the corrected operation and existing installer/resource contracts pass 21 tests. Screenshot acceptance still requires the next remote run.

Run `36822174805` accepts NSIS on source `18fec427`, including a complete screenshot (metadata saved at 9,716 ms) and clean removal. MSI remains without a verdict on two runners; the first cancelled job has no retrievable log or MSI artifact. This is an evidence gap, not an accepted installer or a proven application defect. Qualification now archives installer bytes before execution and bounds the execution step to ten minutes, allowing the following `always()` evidence upload to preserve partial installer logs after a step timeout.

Run `36828405439` accepts NSIS on `5b01b24d`; its downloaded installer hash and all three PNGs match the evidence. User-copied live MSI output confirms installation, payload and runtime passed, but uninstall returned 1603. The 128,630,784-byte downloaded MSI matches the reported SHA-256 `9caece6092cfd76bf3b24600cb1960c584674084f81d5d747aa13221451d6aa0`. Evidence upload then remained at artifact initialization for over twenty minutes with 17 files selected. The detailed uninstall log is still unavailable; 1603 alone does not establish a root cause. MSI failures now include the decoded, bounded detailed-log tail in step output as a second diagnostic channel, and evidence upload has a five-minute deadline. Acceptance conditions are unchanged; P4/P5 remain open.

The following run `36832726016` also passes NSIS but stops reporting MSI progress during qualification, with no intermediate console output even after the configured deadline. A temporary diagnostic workflow replays the exact retained MSI above on a disposable runner, separates install/runtime/uninstall into observable steps, and flushes detailed MSI logs while waiting on the Windows process directly. It does not replace fresh installer acceptance or establish an uninstall root cause by itself.

Diagnostic run `36836448951` passes the exact recorded MSI: install takes four seconds, the runtime probe passes, and uninstall takes two seconds with both MSI engines returning zero. Policy and owned-process cleanup pass; no failing `Return value 3`, file-lock owner or 1603 appears in these successful logs. This does not establish the historical failure's cause and does not provide the complete fresh qualification/removal receipt. The qualifier now sends installer stdout/stderr directly to an owned log descriptor closed in `finally`, preserving partial output and removing dependence on captured-pipe closure. Installer and runtime milestones identify the active phase. Real Node subprocess probes preserve success/nonzero/timeout output, close descriptors on all paths and confirm the timed-out child exited (1,520 ms observed for a 1,500 ms timeout). All 21 focused tests pass. Fresh NSIS/MSI acceptance is still required.

## 中文

W1–W5 窗口契约已经完成，但未执行安装后应用的启动链路。当前 Tauri bundle 只声明 sidecar executable，没有 Godot 项目资源；`resolve_godot_project_path` 回落到 `cwd/path_mode`。此外，Godot 项目声明 4.6，而桌面 release provisioning 固定 4.3。这些是明确的打包风险，尚不是安装包验收证据。

- [x] P1：在源码目录之外启动，隔离配置、runtime data、WebView profile，并仅清理所属进程；修改生产代码前保留失败。
- [x] P2：由桌面 shell owner 解析打包资源，保留显式 development override，消除对启动器工作目录的依赖。
- [x] P3：打包必要 Godot 资源，排除编辑器缓存及不支持的 SVG 导入，校验 release provisioning 的引擎版本与项目声明。
- [ ] P4：在隔离目标中构建并运行新的桌面 bundle/installer，覆盖资源启动、窗口切换和退出；分别记录安装行为与签名信任。
- [ ] P5：执行受影响及必需检查，归档源码/产物证据，同步双语状态，将验证后的变更整合到 main。

不修改无关路由、学习或身份行为，复用既有 runtime/build owner。未签名 Windows 安装包也可以验证安装行为，但不能据此声称签名已验收；Android release 签名/真机和学习效果证据仍各自保留。本单元不创建 release tag，也不发布 release。

9 月 15 日检查点：隔离的 NSIS 解包程序已完成双节点图构建、Godot 布局下发、通过真正的 Godot Exit 按钮返回主界面，以及完整退出。最初的资源缺失与 packaged runtime manifest 写错位置的失败证据均保留。后续探针发现 OS 为 Bridge 分配了 6666 端口：Godot 连接正常，WebView 则明确报 `ERR_UNSAFE_PORT`。桌面端现在从 49152–65535 中选择互不相同的端口；回归测试已确认修复前失败、修复后通过。这尚不属于跨进程 socket 移交；若另一个进程抢先占用端口，启动仍明确失败，不会静默改变已经公布的端点。

P4 仍待一次性 Windows runner 上的新 NSIS／MSI 安装、卸载通过。新增 qualification workflow 检查安装文件哈希、含空格路径、源码目录外启动、图／布局、前端负责的退出操作、进程退出和运行数据保留。Godot 原生按钮输入继续单独记录。截图工具已支持 DPI awareness，避免缩放屏幕截断证据。最终源码／产物验收和远端发布仍属于 P5。

源码检查点：Node 22.19.0 与 24.14.0 各通过 170 个 suite／1,731 个测试，零失败、零跳过；34 项常规 Rust 测试、分别执行的两项真实 Wry 窗口测试，以及显式 Rust 移动语义探针均通过。首次全量执行发现 Jest 扫入了归档的编译输出，现在测试发现范围限定在真正的 `src/` 套件。Supply-readiness 已读取集中式 Godot 配置，仍会拒绝缺失的摘要固定值。资源包测试补齐了顶层符号链接目录和导出期间新增文件的拒绝，两项均已验证修复前失败。TypeScript／Vite、40 项前端运行资源及实际 Godot 4.6 导入／导出通过。这些检查尚不代表新的安装行为已经验收。

远端源码 `031f85f8`：真实窗口 run `34892491842` 及 Windows／Linux foundation run `34898619256` 通过。首次安装包 run `34892491904` 继续保留为失败；它暴露了校验器的两项假设错误：Tauri 会在打包时临时将 executable 中的 `UNK` 标记改为 `NSS`／`MSI`；msiexec 要求给属性值加引号，而不是给整个 `NAME=value` 参数加引号。后续修复按实际打包标记派生预期哈希，其他字节仍逐一约束。7 项 payload 测试及真实 NSIS／MSI 字节比对通过。使用不存在安装包的探针复现了旧参数写法超时，修正后立即返回预期错误 1619；该探针没有安装任何包。

产物范围：本机 PCK 包含五个被忽略的 HDR `.exr` 文件，大小为 179,271,168 字节；干净 CI 仅含跟踪的运行资源，没有这些可选背景，首次 run 中为 311,164 字节。各自保留输入清单；不能仅凭相同源码提交声称字节可复现或可选背景覆盖等价。

安装包 run `34904204940` 验证了打包标记修复、NSIS 的全部 payload 哈希和 MSI 静默命令成功执行。验收仍为失败：NSIS 在 runner 上通过 D3D12 回退连接到 Godot，但 WebView debugger 不可达；MSI 从共享用户的安装目录记忆中恢复了之前的 NSIS 路径。后续将各格式放到独立干净 runner，关闭应用前采集失败窗口／进程诊断，并将证据与大型二进制分别归档。不通过清除共享注册表偏好来掩盖联合测试的隔离不足。两次失败记录均保留。

Run `34907653037` 分别确认了两种格式的安装、payload 校验与卸载，均停在 CDP 发现阶段。记录显示 WebView2 152 子进程没有收到请求的调试参数；相同 CI executable 在本机完成了完整运行探针，也通过了带空格路径检查。[WebView2 明确说明的提权安全策略](https://github.com/MicrosoftEdge/WebView2Feedback/issues/5640#issuecomment-4923662109) 解释了差异：高完整性宿主会忽略用户可写的参数覆盖。CI 启动器现仅在一次性 GitHub-hosted runner 上设置应用专属 HKLM 参数策略，在 `finally` 中恢复进程环境并删除自己创建的值。验收必须包含策略清理成功记录。19 项针对性测试通过，非 CI 执行也确认会在访问注册表前被拒绝；仍需新的远端验收。

10 月 1 日在 `227678d` 上续接：run `36817551883` 确认两种格式的提权策略修复均在 WebView2 153 上生效，策略清理也均成功。MSI 全流程通过；NSIS 完成图／布局后，截图子进程的 15 秒截止时间中断了 PNG 写入：归档图片恰为 65,536 字节，IDAT 不完整且缺少 IEND。截图调用现使用有限的 60 秒预算，其他 native command 仍为 15 秒；保留阶段耗时与 stderr 诊断，不放宽验收断言。P4/P5 仍须等待新一轮 NSIS 和 MSI 全部通过。

Run `36820293638` 的两种格式均在截图之前失败：两次请求分别检查／读取图，与 SourceManager 构建后的延迟刷新发生竞态；预验证时可见的图会在两次 CDP 请求之间消失。验收现等待替换后的文档（`performance.timeOrigin`），并在一次求值中检查和复制图快照。两项 VM 回归复现旧实现的 undefined graph／context destroyed 错误；修正后的操作与既有安装器／资源契约共 21 项测试通过。截图验收仍等待下一轮远端执行。

Run `36822174805` 已在源码 `18fec427` 上通过 NSIS，包含完整截图（元数据在 9,716 ms 后保存）和卸载清理。MSI 在两个 runner 上均长时间没有返回结果；首个已取消 job 没有可取回的日志或 MSI 产物。这是证据缺口，尚不能判为安装验收通过，也未证明应用缺陷。验收工作流现先归档安装包，再执行限定十分钟的安装验收步骤，使后续 `always()` 证据上传可在步骤超时后保留安装器的部分日志。

Run `36828405439` 在 `5b01b24d` 上通过 NSIS，下载的安装包哈希与三张 PNG 均完成核对。用户复制的 MSI 实时日志确认安装、payload 与运行已通过，但卸载返回 1603；下载的 128,630,784-byte MSI 与报告中的 SHA-256 `9caece6092cfd76bf3b24600cb1960c584674084f81d5d747aa13221451d6aa0` 一致。证据上传选中 17 个文件后，停留在产物初始化阶段超过二十分钟。详细卸载日志仍不可用，不能仅凭 1603 判断根因。MSI 失败时现会将正确解码、长度受限的详细日志末尾直接写入步骤输出，提供另一条诊断通道；证据上传限定五分钟。验收条件不变，P4/P5 继续保持未完成。

随后 run `36832726016` 再次通过 NSIS，但 MSI 在验收过程中停止回报进度，超过配置截止时间仍无中间输出。临时诊断工作流在一次性 runner 上重放上述保留的同字节 MSI，将安装／运行／卸载拆为可观察的步骤，直接等待 Windows 进程，并实时刷新详细 MSI 日志。该诊断不替代新安装包验收，也不能单独证明卸载根因。

诊断 run `36836448951` 已通过同字节 MSI：安装耗时四秒，运行探针通过，卸载耗时两秒且两端 MSI engine 均返回零；策略与所属进程清理通过。成功日志没有失败的 `Return value 3`、占用文件的进程或 1603，不能据此认定历史失败根因，也没有完整的新安装包／卸载验收回执。验收器现将安装器 stdout/stderr 直接写入自有日志描述符，在 `finally` 关闭，保留中途输出并消除对捕获管道关闭的依赖；安装器和运行阶段输出可定位当前步骤。真实 Node 子进程探针确认成功／非零退出／超时输出保留，各路径句柄关闭，超时子进程已退出（1,500 ms 上限下观察到 1,520 ms）。21 项针对性测试全部通过，仍需新的完整 NSIS／MSI 验收。
