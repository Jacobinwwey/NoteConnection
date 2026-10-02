---
title: "Interrupted session recovery and installer CI continuation"
date: 2026-10-01
status: completed
source_revision: 227678d349a5d52bbecad51980755f28fb80a09c
parent: docs/plans/2026-09-14-006-fix-desktop-runtime-resources-plan.md
---

# Session Recovery / 会话恢复

## English

Recovered session: `01a0931a-d813-70d1-9916-b723f5182ee4`. The original objective was to audit and execute the project convergence plan, test the changes, and update remote main after verification. Its last explicit request was to fix origin CI failures. The final nonempty turn stopped after committing the elevated WebView2 installer qualification fix.

Previously accepted work is retained: U1–U6, Q/R/N follow-ups, and W1–W5 native-window evidence. Remote main was `6bf87b6d`; the working branch was `codex/project-convergence-20260912`. On recovery, local HEAD was `227678d`, while the actual remote branch was still `2ec296e`. The only existing tracked working-tree modification was `src-tauri/bin/server-x86_64-pc-windows-msvc.exe`; recovery preserves it.

Recent completed changes:

- `031f85f`: desktop resource resolution in `src/utils/RuntimePaths.ts`, `src/server.ts`, and `src-tauri/src/lib.rs`; Godot PCK preparation, centralized engine provisioning, desktop bundle configuration, runtime/installer probes, and their workflows/tests.
- `be73203`: exact Tauri installer stamp fingerprints and correctly quoted MSI properties.
- `2ec296e`: separate NSIS/MSI runners and retained startup diagnostics.
- `227678d`: `scripts/verify-desktop-runtime.js`, `scripts/verify-elevated-desktop-runtime.ps1`, `scripts/verify-windows-installers.js`, `src/windows.installer.runtime.test.ts`, and the bilingual desktop resources plan. Elevated WebView2 argument policies are app-specific and require a cleanup receipt.

Historical command receipts live under `output/project-convergence-2026-09-12/native-evidence/`:

| Command | Recorded result |
| --- | --- |
| `node node_modules/jest/bin/jest.js --runInBand --ci --json --outputFile ...` | Node 22.19.0 / 24.14.0: 170 suites, 1,731 tests each at the desktop source checkpoint |
| `cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- --nocapture` | 34 passed; mobile probe separately executed |
| `node scripts/verify-agent-workspace-tauri-window-evidence.js --strict --skip-proxy-smoke` | Both named native-window cases passed |
| `node scripts/verify-mobile-projection-replay.js` | Four host projections passed |
| `npm run build:with-vite`; `node scripts/prepare-desktop-godot-pack.js`; `node scripts/build-sidecar.js` | Build receipts report exit 0 |
| `node node_modules/@tauri-apps/cli/tauri.js build --ci --bundles nsis,msi --config src-tauri/tauri.desktop.conf.json` | Installer build receipt reports exit 0 |
| `node node_modules/jest/bin/jest.js src/windows.installer.runtime.test.ts src/windows.installer.payload.test.ts src/desktop.godot.pack.test.ts --runInBand --ci` | Latest fix: 3 suites, 19 tests, exit 0 on September 15 |

The PowerShell parser/non-CI guard success is recorded in the old turn, commit message, and plan; recovery did not locate a separate command receipt. Historical checks are not presented as new executions. The prior failed installer run `34907653037` installed, checked payloads, and uninstalled both formats, but failed at CDP discovery on elevated WebView2 152.

Continuation on October 1: pushed existing commit `227678d` to the original development branch. [Run 36817551883](https://github.com/Jacobinwwey/NoteConnection/actions/runs/36817551883) passed MSI and confirmed both WebView2 policy cleanup receipts; NSIS failed when the 15-second screenshot subprocess deadline interrupted PNG writing. Commit `0e10450a` gives captures a bounded 60 seconds and records phase timings. Run `36820293638` then exposed a graph-read race with the delayed post-build page reload. Commit `18fec427` waits for the replacement document and reads a graph snapshot in one CDP evaluation. Two regression cases failed before this correction; 21 focused tests and a local runtime probe now pass. Local capture completed in 842 ms with complete process cleanup. [Run 36822174805](https://github.com/Jacobinwwey/NoteConnection/actions/runs/36822174805) passed NSIS on attempt 1; the downloaded 105,588,816-byte installer matches SHA-256 `71a290ac14ca1bda85ff1349eb6c23dc603d617abcefc7bcf4e1229d30e99200`. Its capture metadata completed after 9,716 ms. MSI remained without a verdict for about 25 minutes, was cancelled, and GitHub returned `log not found` with no MSI artifacts. Only MSI was rerun as attempt 2 on the same source, but it again remained without a verdict. Commit `5b01b24d` preserves installer bytes before execution and adds a ten-minute step timeout so partial logs can still be uploaded. The old attempt was cancelled in favor of [run 36828405439](https://github.com/Jacobinwwey/NoteConnection/actions/runs/36828405439). NSIS passed on attempt 1; the downloaded 105,576,035-byte installer matches SHA-256 `60d4a155083379f2ac570d71deec626aa18b799ff9a9b4206bbd8f4f1896b122`, all three PNG screenshots are complete, and payload/removal/runtime/policy receipts match source fingerprint `940bd5afd0376274aaa7be26f0248f533e3c28c89bf537b0b70b01d83db65a3d`. MSI qualification failed after 49 seconds, before the ten-minute deadline. User-copied live output confirms successful install, payload and runtime checks, followed by uninstall error 1603. The downloaded 128,630,784-byte MSI matches its reported SHA-256 `9caece6092cfd76bf3b24600cb1960c584674084f81d5d747aa13221451d6aa0`. The evidence-upload step selected 17 files but stalled at artifact initialization for over twenty minutes; REST returns BlobNotFound for the job log. The detailed uninstall cause remains unknown. A subsequent diagnostic change prints bounded decoded MSI failure logs directly to step output and limits evidence upload to five minutes; the existing 21 focused tests pass. The application and verifier source are unchanged from `18fec427`. P4/P5 remain open pending acceptance, provenance archival, and verified main integration.

Constraints: keep separate English/Chinese documentation; avoid C: writes; preserve existing binaries, ignored HDR inputs, and failed evidence; do not weaken payload assertions or clear shared installer preferences. HKLM policies are allowed only on disposable GitHub-hosted elevated runners and must be removed. Local PCK and clean-CI PCK have different optional HDR inputs. Signed release trust, Android devices/RSS, production ANN, and independent learner observations remain separate U7/U8 obligations. This continuation creates no release tag or release publication.

Subsequent diagnostic checkpoint: commit `0652cf91` adds direct MSI failure-log output and bounds evidence upload. Run `36832726016` passes NSIS (105,582,559 bytes, SHA-256 `e977c29973f777c05e9b6551c7973c724311ba51235fc0cb1d07c181106c7a89`) but MSI stops reporting during qualification. Commit `87524992` adds a temporary diagnostic workflow; run `36836448951` replays the earlier MSI with the same bytes and passes install/runtime/uninstall, preserving detailed logs. This is diagnostic evidence, not fresh qualification. The next change routes installer output directly to files and emits stage/exit timings; actual subprocess probes and the existing 21 tests pass. No historical pipe-hang or 1603 root cause is asserted. From this point onward, the assistant obtains evidence and performs verification independently; no further requests for the user to retrieve page information.

October 2 continuation: run `36838763881` on `453de115` again passes NSIS but loses the MSI hosted runner. Both this run and `36832726016` have independently retrieved GitHub host-loss annotations. The next scoped change separates installer build jobs from fresh qualification jobs and transports validated build receipts plus exact installer bytes. Five suites / 34 tests pass. Main remains unchanged; P4/P5 await the new isolated qualification result.

<a id="chinese"></a>

October 2 acceptance: run `36960840921`, source `129443f361fc42831f0f1371ab3066fbcdac69f5`, passes both build jobs and both independent NSIS/MSI qualification jobs (build and qualification attempt 1). Downloaded installer hashes, source/build receipts, runtime reports, policy/process/removal cleanup, runtime-data preservation and PNG integrity pass offline verification. The archive retains 232 evidence files plus its manifest, including historical failures and the 34-test contract receipt. P4 is complete; P5 awaits verified main integration and its required checks. Signing trust, Android devices/RSS, production ANN and U8 learner evidence remain open. Historical runner loss and MSI 1603 causes remain unproven. [Evidence manifest](evidence/2026-10-01-windows-installers/manifest.json). The temporary MSI diagnostic workflow is retired; its source and replay evidence are retained in the archive.

Final integration: remote main advanced from `6bf87b6d` to `8a7296c99387932e00ce14a7372847017ad26be0`. All seven main workflows pass: Migration Gates, Native Window Qualification, Windows Installer Qualification, Fixrisk Operational Readiness, Mobile E2E Detox Contracts, Docs Diataxis Site and Docs GitHub Pages Publish. Main installer run `36963202337` also passes both formats at build/qualification attempt 1; downloaded bytes, provenance, runtime/removal/policy receipts and PNGs pass independent verification. P5 is complete. The remaining U7/U8 scope is unchanged; no release tag was created. The existing local sidecar remains untouched. [Main evidence](evidence/2026-10-02-main-integration/manifest.json).

## 中文

恢复的旧会话：`01a0931a-d813-70d1-9916-b723f5182ee4`。最初目标为审计并执行项目收敛计划，完成测试后更新远端 main；最后的明确要求是修复 origin CI 失败。最后一个非空轮次中断于提权 WebView2 安装验收修复提交之后。

保留既有验收：U1–U6、Q/R/N 后续计划、W1–W5 原生窗口证据。远端 main 为 `6bf87b6d`，工作分支为 `codex/project-convergence-20260912`。恢复时本地 HEAD 为 `227678d`，实际远端分支仍为 `2ec296e`。工作区原有且唯一的已跟踪修改是 `src-tauri/bin/server-x86_64-pc-windows-msvc.exe`，恢复过程中保留它。

近期已完成变更：

- `031f85f`：`src/utils/RuntimePaths.ts`、`src/server.ts`、`src-tauri/src/lib.rs` 中的桌面资源路径；Godot PCK 准备、集中式引擎供给、桌面 bundle 配置、运行及安装器探针、对应工作流和测试。
- `be73203`：精确校验 Tauri 安装包标记字节，修正 MSI 属性值引号。
- `2ec296e`：NSIS/MSI 使用独立 runner，保留启动失败诊断。
- `227678d`：`scripts/verify-desktop-runtime.js`、`scripts/verify-elevated-desktop-runtime.ps1`、`scripts/verify-windows-installers.js`、`src/windows.installer.runtime.test.ts` 和双语桌面资源计划。提权 WebView2 使用应用专属参数策略，验收要求清理回执。

历史命令收据位于 `output/project-convergence-2026-09-12/native-evidence/`：

| 命令 | 已记录结果 |
| --- | --- |
| `node node_modules/jest/bin/jest.js --runInBand --ci --json --outputFile ...` | 桌面源码检查点：Node 22.19.0 / 24.14.0 各 170 suites、1,731 tests |
| `cargo test --manifest-path src-tauri/Cargo.toml --locked --lib -- --nocapture` | 34 passed；移动探针单独执行 |
| `node scripts/verify-agent-workspace-tauri-window-evidence.js --strict --skip-proxy-smoke` | 两个命名原生窗口用例通过 |
| `node scripts/verify-mobile-projection-replay.js` | 四种宿主投影通过 |
| `npm run build:with-vite`；`node scripts/prepare-desktop-godot-pack.js`；`node scripts/build-sidecar.js` | 构建收据退出码均为 0 |
| `node node_modules/@tauri-apps/cli/tauri.js build --ci --bundles nsis,msi --config src-tauri/tauri.desktop.conf.json` | 安装包构建收据退出码为 0 |
| `node node_modules/jest/bin/jest.js src/windows.installer.runtime.test.ts src/windows.installer.payload.test.ts src/desktop.godot.pack.test.ts --runInBand --ci` | 最后修复：9 月 15 日 3 suites、19 tests、退出码 0 |

PowerShell parser／非 CI guard 的成功记录来自旧会话、提交消息与计划；本次未找到单独执行收据。历史检查不冒充本次新执行。前次失败安装包 run `34907653037` 已完成两种格式的安装、payload 校验和卸载，但提权 WebView2 152 的 CDP 发现失败。

10 月 1 日续接：将现有提交 `227678d` 推送到原开发分支。[Run 36817551883](https://github.com/Jacobinwwey/NoteConnection/actions/runs/36817551883) 的 MSI 通过，两种格式的 WebView2 策略清理回执均成功；NSIS 因截图子进程的 15 秒截止时间中断 PNG 写入而失败。提交 `0e10450a` 将截图预算改为有限的 60 秒并记录阶段耗时；run `36820293638` 随后暴露图读取与构建后延迟刷新页面的竞态。提交 `18fec427` 等待替换后的文档，并在一次 CDP 求值中取得图快照。两项回归已验证修复前失败；修正后 21 项针对性测试及本地运行探针通过。本机截图耗时 842 ms，所属进程清理完成。[Run 36822174805](https://github.com/Jacobinwwey/NoteConnection/actions/runs/36822174805) 的 attempt 1 已通过 NSIS；下载的 105,588,816-byte 安装包匹配 SHA-256 `71a290ac14ca1bda85ff1349eb6c23dc603d617abcefc7bcf4e1229d30e99200`，截图元数据在 9,716 ms 后保存。MSI 约 25 分钟没有返回结果，取消后 GitHub 返回 `log not found`，也未上传 MSI 产物。已仅重跑同一源码的 MSI，作为 attempt 2，但该尝试再次长时间没有返回结果。提交 `5b01b24d` 将安装包归档移至执行之前，并设置十分钟步骤超时，以便后续上传部分日志。旧尝试已取消，后续由 [run 36828405439](https://github.com/Jacobinwwey/NoteConnection/actions/runs/36828405439) 接替。NSIS 在 attempt 1 通过；下载的 105,576,035-byte 安装包匹配 SHA-256 `60d4a155083379f2ac570d71deec626aa18b799ff9a9b4206bbd8f4f1896b122`，三张 PNG 截图均完整，payload／卸载／运行／策略回执与源码指纹 `940bd5afd0376274aaa7be26f0248f533e3c28c89bf537b0b70b01d83db65a3d` 匹配。MSI 验收在 49 秒后失败，未触发十分钟截止时间。用户复制的实时输出确认安装、payload 和运行检查通过，随后卸载报错 1603；下载的 128,630,784-byte MSI 匹配报告中的 SHA-256 `9caece6092cfd76bf3b24600cb1960c584674084f81d5d747aa13221451d6aa0`。证据上传选中 17 个文件后停留在产物初始化阶段超过二十分钟；REST 获取 job 日志返回 BlobNotFound，卸载的详细原因仍未知。后续诊断变更将正确解码、长度受限的 MSI 失败日志直接写入步骤输出，并限定证据上传五分钟；既有 21 项针对性测试通过。应用和验收脚本源码与 `18fec427` 相同。P4/P5 仍等待验收结果、产物身份归档和验证后的 main 集成。

约束：同步且分开维护中英文文档；尽量避免 C 盘写入；保留原有二进制、ignored HDR 输入和失败证据；不弱化 payload 断言，不清除共享安装偏好来掩盖问题。HKLM 策略仅限一次性 GitHub-hosted 提权 runner，必须清理。本机与干净 CI 的 PCK 可选 HDR 输入不同。签名发布信任、Android 真机／RSS、生产 ANN 与独立学习观察继续作为 U7/U8 的独立义务。本次不创建 release tag，也不发布 release。

后续诊断检查点：提交 `0652cf91` 增加 MSI 详细错误日志直出并限定证据上传时间。Run `36832726016` 通过 NSIS（105,582,559 bytes，SHA-256 `e977c29973f777c05e9b6551c7973c724311ba51235fc0cb1d07c181106c7a89`），但 MSI 在验收中停止回报状态。提交 `87524992` 增加临时诊断工作流；run `36836448951` 重放此前同字节 MSI，安装／运行／卸载均通过并保留详细日志。这是诊断证据，不是新构建验收。随后将安装器输出直接写入文件，并记录阶段／退出耗时；真实子进程探针与既有 21 项测试均通过。尚不声称历史管道停滞或 1603 根因已查明。此后由助手自行取得证据并验证，不再要求用户前往页面取信息。

10 月 2 日续接：`453de115` 对应 run `36838763881` 再次通过 NSIS，但 MSI hosted runner 失联；该运行与 `36832726016` 的宿主失联注解均已由助手通过 GitHub API 取得。下一项范围受限的改动将安装包构建与干净 runner 上的验收分离，并传递经过校验的构建回执和精确安装包字节。5 个套件／34 项测试通过。Main 未更新，P4/P5 等待新的隔离验收结果。

10 月 2 日验收：run `36960840921`、源码 `129443f361fc42831f0f1371ab3066fbcdac69f5` 的两个构建 job 和两个独立 NSIS／MSI 验收 job 均通过，构建及验收均为 attempt 1。下载的安装包哈希、源码／构建回执、运行报告、策略／进程／卸载清理、运行数据保留及 PNG 完整性均通过离线核验。归档保留 232 个证据文件及其清单，包括历史失败和 34 项测试回执。P4 已完成；P5 仍待验证后的 main 集成及必需检查。签名信任、Android 真机／RSS、生产 ANN 和 U8 学习者证据保持未完成。历史 runner 失联及 MSI 1603 根因仍未证实。 [证据清单](evidence/2026-10-01-windows-installers/manifest.json)。临时 MSI 诊断工作流已退役，其源码与回放证据保留在归档中。

最终集成：远端 main 从 `6bf87b6d` 更新到 `8a7296c99387932e00ce14a7372847017ad26be0`。七项主分支工作流全部通过：Migration Gates、Native Window Qualification、Windows Installer Qualification、Fixrisk Operational Readiness、Mobile E2E Detox Contracts、Docs Diataxis Site 和 Docs GitHub Pages Publish。主分支安装包 run `36963202337` 的两种格式也均在构建／验收 attempt 1 通过；下载字节、来源、运行／卸载／策略回执及 PNG 均通过独立核验。P5 已完成；U7/U8 其余范围保持不变，未创建 release tag，原有本机 sidecar 保持不动。 [主分支证据](evidence/2026-10-02-main-integration/manifest.json)。
