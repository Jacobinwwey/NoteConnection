---
title: "fix: Qualify desktop runtime resources outside the checkout"
type: fix
status: in_progress
date: 2026-09-14
updated: 2026-09-15
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
