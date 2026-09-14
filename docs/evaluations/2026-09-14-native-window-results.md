---
title: "Executable native window evidence"
date: 2026-09-14
status: in_progress
parent: docs/plans/2026-09-14-005-fix-native-window-evidence-plan.md
---

# Native Window Evidence / 原生窗口证据

## English

The two required window tests now execute against real Tauri/Wry WebView2 windows on Windows. This closes the missing-test obligation from the [preceding checkpoint](2026-09-14-public-evidence-quality-results.md); it does not turn that historical development session into release-installer evidence.

The first strict run failed with both filters selecting zero tests. Seven new Node regressions then failed before the wrapper changes. Both evidence wrappers now require the named libtest verdicts and preserve a nonzero Cargo exit, even when its output mentions zero tests. The ordinary toggle-plan group requires both policy cases, not any one matching prefix.

The first real-window executable compiled but exited in the Windows loader with `0xc0000139 / STATUS_ENTRYPOINT_NOT_FOUND`. Tauri's `embed-resource` dependency links the Common Controls v6 resource only to application binaries; the newly live Wry code imports `TaskDialogIndirect`, while the libtest executable had no activation manifest. The explicit native-test build now emits that manifest for all its artifacts. Default production builds retain the existing build path; a feature-enabled application build also passes.

Native tests use an explicit Cargo feature and are ignored by ordinary test selection. The window verifier explicitly selects `--ignored` and runs each named case in its own process, satisfying Wry's event-loop lifetime constraints. A passing window run reports **one executed test and zero ignored tests**. Config and WebView storage are isolated under the test temporary directory. Assertions run on the actual event-loop thread; panic propagation happens only after Tauri cleanup.

Verified locally:

- Real auxiliary WebView without `main`: both toggle directions fail and emit no successful event.
- Real main WebView: default enter hides Tauri, default exit restores it; configuration can retain visibility or disable restoration. Four successful operations produce four ordered events with the expected policy payload.
- Both native tests pass. The ordinary Rust suite passes 30 tests; its existing mobile semantic probe is separately invoked by the projection verifier.
- Thirteen wrapper regressions pass, including empty, ignored, unrelated, incomplete and failed Cargo executions.
- The native test executable and its WebView children are absent after completion.

Node 22.19.0 and 24.14.0 each pass **168 suites / 1,715 tests**, with zero failures or skips. TypeScript/Vite and all 40 frontend assets pass; the established Mermaid corpus passes 513 files / 1,539 fences. Independent-host native execution, server-artifact renewal and main publication remain in progress. This record will bind those results to their actual revision and artifact hashes.

Native command tests do not launch Godot or install the application. Signed release installers, signed arm64 Android behavior and measured RSS, optional production ANN qualification, independent final-quality evaluation and consented 7/28-day learner observations remain separate. Android's ADB list is still empty; the 25 MiB payload / 256 MiB RSS contract is unchanged.

## 中文

两个必需窗口测试现已在 Windows 的真实 Tauri/Wry WebView2 窗口上执行，关闭[前一检查点](2026-09-14-public-evidence-quality-results.md#chinese)的测试缺失义务；之前的 development 会话仍是其原有证据，不能因此升级为发布安装包验收。

首次严格执行因两个 filter 均为零测试而失败；新增的七个 Node 回归也在 wrapper 修复前失败。两类证据 wrapper 现在都要求命名 libtest verdict，并保留 Cargo 非零退出，即使输出提到零测试。普通 toggle-plan 组必须执行两个 policy case，不能只凭同前缀下任一用例通过。

首个真实窗口可执行文件编译成功，但 Windows loader 以 `0xc0000139 / STATUS_ENTRYPOINT_NOT_FOUND` 终止。Tauri 的 `embed-resource` 仅将 Common Controls v6 resource 链接到应用 binary；新增 Wry 执行路径导入 `TaskDialogIndirect`，而 libtest 缺少 activation manifest。显式 native-test 构建现为全部产物生成该 manifest；默认生产构建保持既有路径，启用该 feature 的应用构建也通过。

Native 测试通过显式 Cargo feature 编译，普通测试选择保持忽略。窗口 verifier 显式传入 `--ignored`，每个命名用例单独进程执行，以满足 Wry 的事件循环生命周期约束；通过记录显示**实际运行一个测试、零 ignored**。配置和 WebView storage 隔离到临时测试目录。断言在真实事件循环线程执行，Tauri 清理后才向测试框架传播 panic。

本机已验证：

- 真实 auxiliary WebView 缺少 `main` 时，两种切换方向都失败，且不发出成功事件。
- 真实 main WebView 默认进入时隐藏、退出时恢复；配置可以保留可见性或禁止恢复。四次成功操作产生四个顺序正确、policy payload 正确的事件。
- 两个原生测试通过。普通 Rust suite 通过 30 项；既有 mobile semantic probe 由投影 verifier 单独执行。
- 十三项 wrapper 回归通过，覆盖空筛选、ignored、无关用例、组内缺项及 Cargo 失败。
- 测试结束后，测试进程及所属 WebView 子进程均不存在。

Node 22.19.0、24.14.0 各通过 **168 suite / 1,715 test**，零失败、零跳过。TypeScript/Vite 与 40 项前端资源验证通过；既有 Mermaid 语料通过 513 文件 / 1,539 fence。独立宿主 native 执行、server artifact 更新和 main 发布仍在进行；本记录将绑定其实际 revision 与 artifact hash。

Native command 测试不启动 Godot，也不安装应用。签名发布安装包、签名 arm64 Android 行为和实测 RSS、可选生产 ANN、最终质量的独立评估、已取得同意的 7/28 天学习观察仍独立验收。ADB 列表仍为空，25 MiB payload / 256 MiB RSS 契约保持不变。
