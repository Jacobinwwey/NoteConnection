---
title: "fix: Preserve the selected knowledge root through native graph builds"
date: 2026-09-14
status: completed
updated: 2026-09-14
parent: docs/plans/2026-09-12-001-refactor-project-convergence-plan.md
source_revision: f39e0b7bc2213ba8af64074f96feb829965a5ac0
---

# Selected Knowledge Root / 所选知识库根目录

## English

### Acceptance — 2026-09-14

This follow-up is complete. Node 22.19.0 and 24.14.0 each pass 168 suites / 1,708 tests with zero skips. V1–V6 regressions, HTTP/browser/mobile-host checks, the scoped Windows native session and source-v2 artifact gates pass. Remote-main source commit `1a688f02` passes all five normal workflows; CI run `34786392248` qualifies separate Windows/Linux artifacts, with offline verification and an additional two-host qualification of the same Windows binary. See [final results](../evaluations/2026-09-14-public-evidence-quality-results.md). Native release installers, Android, production ANN and consented learner outcomes retain the parent plan's separate acceptance requirements. Counts and pending statements below are historical implementation checkpoints.

A fresh Windows Tauri/WebView2/Godot session exposed a gap outside the passing HTTP and foundation suites. The server scans the configured knowledge directory, but `NoteConnection.build` reconstructs its identity root from the application directory. `FileLoader` rejects every external file and returns an empty successful build. The preserved native log contains both rejected fixture paths and `Graph built: 0 nodes, 0 edges`.

- [x] N1: Add real graph regressions for an external configured workspace, covering absolute targets, relative targets and the entire workspace. Include a different default workspace as a wrong-source control.
- [x] N2: Carry the resolved knowledge root from `buildGraph` to the graph owner. Keep the default library root compatible and retain workspace-relative canonical IDs.
- [x] N3: Reject an outside or symlink-escaped scan directory before enumeration; canonicalize both directory and workspace at the filesystem edge. A wrong root must fail rather than publish an empty graph.
- [x] N4: Rebuild and exercise the native fixture, then rerun Node 22/24, HTTP/browser, quality regressions and artifact qualification against the changed inputs. Archive the earlier evidence unchanged; update bilingual status and remote main after verification.
- [x] N5: Reconcile source fingerprints across clean Windows/Linux checkouts and a local Rust build cache. Exclude only the known WASM compiler output tree, normalize lockfile/Rust-source line endings, and retain sensitivity to real source/tests and compiled artifact bytes. Requalify changed inputs without rewriting old reports.

N1–N3 ownership is limited to `src/index.ts`, `src/core/NoteConnection.ts`, `src/backend/FileLoader.ts` and their regressions. Do not weaken path containment, derive the workspace independently from each file, change public identities, migrate snapshots, or turn this fix into a new storage abstraction. The earlier `docs/evaluations/evidence/2026-09-14/` archive remains evidence for `f39e0b7b`, not for this follow-up.

Native evidence is from an isolated development executable on Windows, with configuration, runtime data and knowledge fixtures on E:. Android/signing and consented learner observations retain separate acceptance requirements.

Implementation checkpoint: all six new defect probes failed before the fix; 35 graph, identity and runtime-path checks now pass. Two additional library controls preserve its default workspace and explicit external root. The seven new root/public-answer/evidence suites are included in the existing convergence CI gate. Native rerun and final qualification remain pending.

Cross-host follow-up: both jobs in run `34781056955` passed their local gates, but offline reconciliation found that the source fingerprint included 184 local Rust cache files. The clean Linux fingerprint is reproduced exactly from Git blobs; applying Windows checkout line endings changes only `src/backend/wasm/Cargo.lock` and reproduces the Windows fingerprint. This is a fingerprint-boundary defect. Compiled inputs have no content differences after line-ending normalization. N5 belongs to `scripts/sidecar-build-fingerprint.js` and `src/sidecar.freshness.contract.test.ts`; no business runtime behavior changes are required.

<a id="chinese"></a>

## 中文

### 验收 — 2026-09-14

本后续计划已完成。Node 22.19.0 与 24.14.0 各通过 168 suite / 1,708 test，零跳过；V1–V6 回归、HTTP/浏览器/mobile 宿主检查、限定范围的 Windows 原生会话及 source-v2 产物门禁通过。远端 main 源码提交 `1a688f02` 的五条常规流水线通过；CI run `34786392248` 分别验收 Windows/Linux 产物，完成离线复核，并额外验证同一 Windows binary 的两宿主资格。见[最终结果](../evaluations/2026-09-14-public-evidence-quality-results.md#chinese)。原生发布安装包、Android、生产 ANN 和已取得参与同意的学习效果保留上位计划的独立验收要求；下方旧数量与待办措辞属于历史实现检查点。

新启动的 Windows Tauri/WebView2/Godot 会话暴露了既有 HTTP 和 foundation 测试未覆盖的缺口：server 扫描配置中的知识库目录，`NoteConnection.build` 却根据应用目录重新构造身份根目录，`FileLoader` 因而拒绝全部外部文件，并返回空图成功。已保留的原生日志同时包含两篇夹具的越界错误及 `Graph built: 0 nodes, 0 edges`。

- [x] N1：增加真实建图回归，覆盖外部配置知识库的绝对 target、相对 target 和整个知识库；另设不同的默认知识库，作为误读来源的反例。
- [x] N2：将 `buildGraph` 已解析的知识库根目录传给建图 owner，保持 library 默认根目录兼容及 workspace-relative canonical ID。
- [x] N3：在枚举前拒绝越界或经符号链接逃逸的扫描目录，在文件系统边界统一目录与 workspace 的 canonical path；根目录错误必须失败，不能发布空图。
- [x] N4：重建并执行原生夹具，再针对变化后的输入复跑 Node 22/24、HTTP/浏览器、质量回归和产物资格；保留旧证据，验证后更新双语状态与远端 main。
- [x] N5：统一干净 Windows/Linux checkout 与包含 Rust 编译缓存的本机源码指纹；仅排除已知 WASM 编译输出目录，归一化 lockfile/Rust source 换行，继续检测真实源码、测试和编译产物字节变化；重新验收新输入，不改写旧报告。

N1–N3 修改范围限定为 `src/index.ts`、`src/core/NoteConnection.ts`、`src/backend/FileLoader.ts` 及回归测试。不放宽路径边界，不按每个文件重新推断 workspace，不改变公共身份或迁移 snapshot，不引入新 storage 抽象。此前的 `docs/evaluations/evidence/2026-09-14/` 归档继续对应 `f39e0b7b`，不能用于验收本次后续修复。

原生证据来自 Windows 上隔离的 development executable，配置、runtime data 和知识夹具均位于 E:。Android/签名及已取得参与同意的学习者观察仍按独立要求验收。

实现检查点：六个新增缺陷探针均在修复前失败，现在 35 项 graph、identity 与 runtime-path 检查通过；另外两项 library 对照确认默认 workspace 和显式外部 root 兼容。七个新的根目录/公开回答/证据测试套件已加入既有 convergence CI 门禁；原生复验和最终产物资格仍待完成。

跨宿主后续：run `34781056955` 的两个 job 均通过各自门禁，但离线核对发现源码指纹包含了 184 个本机 Rust 缓存文件。直接从 Git blob 可精确复现干净 Linux 指纹；应用 Windows checkout 换行后，仅 `src/backend/wasm/Cargo.lock` 改变，且精确复现 Windows 指纹。这是指纹规则缺陷；编译输入在换行归一化后没有内容差异。N5 由 `scripts/sidecar-build-fingerprint.js` 与 `src/sidecar.freshness.contract.test.ts` 负责，无需修改业务 runtime 行为。
