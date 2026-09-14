---
title: "fix: Execute native window acceptance tests"
type: fix
status: in_progress
date: 2026-09-14
origin: docs/plans/2026-09-12-001-refactor-project-convergence-plan.md
source_revision: 0027e6d39ed2a26b68ac5884360012b183710a1c
---

# Native Window Evidence Plan / 原生窗口证据实施计划

## English

U7 still lacks executable native-window acceptance. The strict wrapper requires two absent Rust tests; the ordinary Rust contract wrapper can also accept a successful empty test selection. The existing manual development session remains valid for its recorded artifact, but does not satisfy either named-test or release-installer acceptance.

Use the existing Tauri command owner and real Wry windows. Keep interactive tests behind an explicit Cargo feature and execute each named test in its own process: desktop event loops have thread/process lifetime constraints. Isolate app configuration and WebView storage in the test directory. The tests must observe real window visibility and emitted events, not only the pure toggle plan. No production test endpoint, alternative window implementation, or public API change is needed.

- [x] W1: Record the current missing-test failure and regressions for empty/ignored/failed Rust evidence.
- [x] W2: Implement the two named real-window tests, including missing-main rejection, default hide/restore, configuration overrides, event order and cleanup.
- [x] W3: Require actual named verdicts in both Rust wrappers; run native tests explicitly and preserve raw failure evidence.
- [ ] W4: Execute native tests and affected Node/Rust contracts; bind the record to the source and test executable, and review the acceptance limits. Local execution passes; archival binding follows the source commit.
- [ ] W5: Update both language records, qualify any changed server artifact inputs, and integrate verified changes into remote main.

This closes an executable-test gap. Signed release installers, signed arm64 device behavior/RSS, an optional production ANN backend and consented 7/28-day learner observations remain separate acceptance requirements. No release tag or unverified promotion is part of this change.

## 中文

U7 仍缺少可执行的原生窗口验收。严格 wrapper 要求两个不存在的 Rust 测试；普通 Rust 合约 wrapper 也可能把成功的空筛选算作通过。已有 development 手工会话对其记录的 artifact 仍然有效，但不能代替命名测试或发布安装包验收。

复用现有 Tauri command owner 和真实 Wry 窗口。交互测试通过显式 Cargo feature 启用，每个命名测试独立进程执行，因为桌面事件循环有线程/进程生命周期约束。应用配置与 WebView 存储隔离到测试目录。断言真实窗口显隐及事件发出，而非只检查纯 toggle plan；无需生产测试端点、另一套窗口实现或公共 API 变更。

- [x] W1：记录当前缺失测试失败，并补空筛选/ignored/失败的 Rust 证据回归。
- [x] W2：实现两个命名原生窗口测试，覆盖缺少 main 的拒绝、默认隐藏/恢复、配置覆盖、事件顺序及清理。
- [x] W3：两类 Rust wrapper 均要求实际命名 verdict，显式运行 native 测试并保留原始失败证据。
- [ ] W4：执行 native 测试及受影响 Node/Rust 合约，将记录绑定源码和测试可执行文件，并复核验收边界。本机执行通过，归档绑定将在源码提交后完成。
- [ ] W5：同步双语记录，重新验收发生变化的 server artifact 输入，将验证后的变更整合到远端 main。

本轮关闭可执行测试缺口。签名发布安装包、签名 arm64 真机行为/RSS、可选生产 ANN backend 及取得同意后的 7/28 天学习者观察仍各自验收；不创建 release tag，也不提升未经验证的目标。
