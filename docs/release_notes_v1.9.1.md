# NoteConnection v1.9.1

## English

Comparison baseline: [v1.9.0...v1.9.1](https://github.com/Jacobinwwey/NoteConnection/compare/v1.9.0...v1.9.1).

### Linux AppImage native updates

- Addresses the remaining missing-update-information warning from [AppImage catalog PR #8838](https://github.com/AppImage/appimage.github.io/pull/8838). The Linux build now supplies native `gh-releases-zsync` metadata through linuxdeploy's supported `LDAI_UPDATE_INFORMATION`, targeting the product's Latest release and its amd64 `.AppImage.zsync` asset.
- Uses the official bundled appimagetool/zsyncmake to generate a control file after the AppImage's metadata and signing writes are complete. The release workflow moves the actual control file from Tauri's `src-tauri` working directory beside the final image. Missing generation fails the release gate; old controls are removed before the build.
- Preserves the published v1.9.0 release. Its AppImage can provide local bytes for a delta update when the new `.zsync` URL is supplied explicitly. It cannot automatically discover this update because its embedded update information is absent.

### Release integrity and workflow

- Extends the existing two-argument AppImage verifier to require the adjacent control file, exact embedded update target, matching filename/relative URL, file length, SHA-1 and structurally valid checksum table. Existing stored-permission, desktop/icon, portable-link and original-server payload checks remain mandatory.
- Includes `.AppImage.zsync` in the shared Linux asset list used by both workflow artifacts and the draft GitHub release. The current release contract accepts amd64; other architectures require a separate explicit contract. Accepted product releases are published as Latest, while Godot mirror releases remain `latest=false`.
- Updates the product version to 1.9.1 in npm metadata and Tauri configuration. The native About dialog already reads that configured version. Documents the exact local collection/verification procedure, paired checksums/manifests and official-client reconstruction requirement.

### Verified source and release artifacts

- Release build source: [`cd6548f315e7712bd5034e1025cb603174795528`](https://github.com/Jacobinwwey/NoteConnection/commit/cd6548f315e7712bd5034e1025cb603174795528), based on `origin/main` at `72eac8981f434d7c7e37f0f4ba064f3b81555367`. [Source PR #3](https://github.com/Jacobinwwey/NoteConnection/pull/3). The v1.9.1 tag and binaries retain this build source; the final evidence documentation is a separate follow-up with no production-code changes.
- Final unfiltered Jest passed **177 suites / 1,830 tests**, with no failures, skipped tests or todos and a natural exit code of 0. Targeted AppImage coverage passed **3 suites / 71 tests**, including 33 update cases. Strict Rust `--locked` passed **34 tests**, with one pre-existing mobile probe ignored.
- TypeScript/build, 40 frontend runtime assets, actionlint, actual workflow shell success/failure cases, version/lock consistency, Diataxis and the documentation site passed independent review.
- [Release CI 37266034722](https://github.com/Jacobinwwey/NoteConnection/actions/runs/37266034722) passed Linux, Windows and macOS packaging. All four workflow artifact archives match GitHub's SHA-256 digests; six draft release assets match the accepted file sizes and hashes. The public source archive's 15 changed files match the build commit byte for byte.
- Final AppImage: **201,521,656 bytes**, SHA-256 `4f843ceffdf3c7c0596d901dd91604d0fa70a755ff9bea2ccd44e3eb76c0977b`.
- Companion `.zsync`: **344,642 bytes**, SHA-256 `4b9a4944b3b37ae6dd3dcca173a7803963bfd4e5b0400e4cad91a991a3ce82cb`.
- The full AppImage gate passed locally using the original server from that same CI run, SHA-256 `9f7e877652d9a42e0564d58095bff0143a7a56677e36c1433b26bf8ac621465e`.

### Actual differential update and startup

Both official clients reconstructed the final v1.9.1 artifact from an unchanged copy of the public v1.9.0 AppImage. Each output's complete SHA-256 exactly matches the final CI artifact. The unmodified plugin-generated control file was served from an isolated HTTP server with real Range/206 responses.

| Official client | Local bytes reused | Target content downloaded | Fraction of complete target | Exit |
| --- | ---: | ---: | ---: | ---: |
| AppImageUpdate 2.0.0-alpha-1-20251018 | 189,865,984 | 13,699,576 | 6.80% | 0 |
| zsync2 2.0.0-alpha-1 | 189,865,984 | 11,655,672 | 5.78% | 0 |

These download counts exclude control-file and transport overhead. Independent accounting of HTTP byte ranges matches the client statistics. A 404 failure test retained the seed, exited 1 and left only an incomplete `.part` file. No old-version metadata or public artifact was rewritten. Because v1.9.0 has no metadata, this test supplied the new control URL explicitly; users can manually download v1.9.1 as the first version with native update discovery.

The reconstructed application also passed ordinary-user native FUSE startup on Ubuntu 24.04.2. Its real initial language-selection window rendered, a normal window close exited 0, and the application, test processes and mounts were cleaned up. The pre-existing host service remained unchanged.

### Linux KVM acceptance

The exact final AppImage passed complete acceptance in the local Ubuntu 22.04.5 guest, with glibc 2.35 and QMP-confirmed KVM acceleration. The unchanged catalog worker exited 0, recorded the correct native update target and emitted no missing-update-information warning.

- Both native FUSE and extract-and-run passed offline authenticated APIs, including unauthenticated rejection, diagnostics, knowledge folders/root, graph build, Markdown content/index/chunks, cache and knowledge state. The packaged pulldown worker ran without fallback.
- Both native About dialogs displayed **1.9.1**. Both modes rendered the three-node Force graph, DAG arrows, Markdown/Mermaid and the Godot learning path, then returned to the main window.
- Both normal window closes exited **0**. All 26 observed application-related processes and five test support processes were gone; the FUSE mount and isolated network namespace were removed. Runtime manifests remained as test evidence. The extraction cache also remained after application exit and was manually removed only after checking that no process held it open.
- The VM shut down normally. QEMU, its PID file and QGA/QMP sockets were gone; the host service and all 11 monitored macOS disk/firmware/startup files retained their recorded state.

The screenshots also preserve existing visual limitations: reader loading/outline placeholders, clipped Mermaid labels, DAG label overlap and overlap/clipping in parts of the Godot UI. This release does not claim to fix those independent UI issues. See the [KVM acceptance summary and 12 screenshots](https://github.com/Jacobinwwey/NoteConnection/releases/download/v1.9.1/NoteConnection_1.9.1_linux-kvm-validation.zip).

Windows/macOS results above establish successful packaging, not complete application GUI acceptance. Android assets are excluded from this desktop release; existing signing/device gates remain in force.

### Download verification

[SHA256SUMS](https://github.com/Jacobinwwey/NoteConnection/releases/download/v1.9.1/SHA256SUMS.txt) · [CI provenance](https://github.com/Jacobinwwey/NoteConnection/releases/download/v1.9.1/public-ci-manifest.json) · [Source validation](https://github.com/Jacobinwwey/NoteConnection/releases/download/v1.9.1/source-validation.json) · [Differential update evidence](https://github.com/Jacobinwwey/NoteConnection/releases/download/v1.9.1/NoteConnection_1.9.1_update-validation.md).

## 中文

对比基线：[v1.9.0...v1.9.1](https://github.com/Jacobinwwey/NoteConnection/compare/v1.9.0...v1.9.1)。

### Linux AppImage 原生更新

- 修复 [AppImage 目录 PR #8838](https://github.com/AppImage/appimage.github.io/pull/8838) 剩余的更新信息缺失警告。Linux 构建现在通过 linuxdeploy 支持的 `LDAI_UPDATE_INFORMATION` 写入原生 `gh-releases-zsync` 元数据，指向产品 Latest 发布中的 amd64 `.AppImage.zsync` 资产。
- 使用官方内置 appimagetool/zsyncmake，在 AppImage 元数据和签名写入结束后生成控制文件。发布工作流从 Tauri 的 `src-tauri` 工作目录收拢实际生成的控制文件，将其移动到最终镜像旁；生成缺失会使发布门禁失败，构建前清除旧控制文件。
- 保留已公开的 v1.9.0 发布。显式提供新的 `.zsync` URL 时，其 AppImage 可以作为差分更新的本地种子；由于该版本没有内嵌更新信息，无法自动发现本次更新。

### 发布完整性与工作流

- 扩展现有双参数 AppImage 校验器：必须存在相邻控制文件，并校验精确的内嵌更新目标、文件名/相对 URL、文件长度、SHA-1 和校验表结构。既有的存储权限、desktop/图标、可移植链接和原始 server payload 检查继续作为必需门禁。
- 将 `.AppImage.zsync` 加入 workflow artifact 与 GitHub 草稿发布共用的 Linux 资产列表。当前发布契约只接受 amd64，其他架构需要明确的独立契约。合格产品发布设为 Latest，Godot 镜像继续保持 `latest=false`。
- 将 npm 元数据与 Tauri 配置中的产品版本更新到 1.9.1。原生 About 对话框已从该配置读取版本。补充本地精确收拢/校验步骤、成对散列清单及 manifest 要求，并明确官方客户端重建验收。

### 已验证源码与发布制品

- 构建源码：[`cd6548f315e7712bd5034e1025cb603174795528`](https://github.com/Jacobinwwey/NoteConnection/commit/cd6548f315e7712bd5034e1025cb603174795528)，基于 `origin/main` 的 `72eac8981f434d7c7e37f0f4ba064f3b81555367`。[源码 PR #3](https://github.com/Jacobinwwey/NoteConnection/pull/3)。v1.9.1 标签和二进制保持该构建源码；最终验收说明是独立文档补充，不改变生产代码。
- 最终完整未筛选 Jest **177 套件 / 1,830 测试通过**，无失败、跳过或 todo，正常退出 0。AppImage 定向测试 **3 套件 / 71 测试通过**，其中新增更新检查 33 例。严格 Rust `--locked` **34 测试通过**，1 个既有移动端探针忽略。
- TypeScript/构建、40 项前端资源、actionlint、工作流实际 shell 成功/失败场景、版本/锁文件一致性、Diataxis 和文档站均通过独立审查。
- [发布 CI 37266034722](https://github.com/Jacobinwwey/NoteConnection/actions/runs/37266034722) 的 Linux、Windows、macOS 打包全部成功。4 个 workflow artifact 归档的 SHA-256 与 GitHub 一致，6 个草稿资产大小和散列与验收文件一致。公开源码归档的 15 个变更文件逐字节匹配构建提交。
- 最终 AppImage：**201,521,656 字节**，SHA-256 `4f843ceffdf3c7c0596d901dd91604d0fa70a755ff9bea2ccd44e3eb76c0977b`。
- 配套 `.zsync`：**344,642 字节**，SHA-256 `4b9a4944b3b37ae6dd3dcca173a7803963bfd4e5b0400e4cad91a991a3ce82cb`。
- 本地完整 AppImage 门禁通过，使用同次 CI 的原始 server，SHA-256 `9f7e877652d9a42e0564d58095bff0143a7a56677e36c1433b26bf8ac621465e`。

### 真实差分更新与启动

两个官方客户端都从未改写的公开 v1.9.0 AppImage 副本重建出最终 v1.9.1；完整输出 SHA-256 均精确匹配 CI 制品。未改动的官方控制文件由隔离 HTTP 服务提供，抓包确认真实 Range/206 响应。

| 官方客户端 | 复用本地字节 | 下载目标内容 | 占完整目标 | 退出码 |
| --- | ---: | ---: | ---: | ---: |
| AppImageUpdate 2.0.0-alpha-1-20251018 | 189,865,984 | 13,699,576 | 6.80% | 0 |
| zsync2 2.0.0-alpha-1 | 189,865,984 | 11,655,672 | 5.78% | 0 |

下载量不包含控制文件和传输开销；按 HTTP 实际字节区间独立核算，与工具统计精确一致。404 失败测试保留种子文件，退出 1，仅留下未完成的 `.part`。未改写旧版元数据或公开制品。由于 v1.9.0 没有元数据，本次测试显式提供新的控制 URL；用户可以手动下载 v1.9.1，作为首次支持原生更新发现的版本。

重建程序还通过普通用户在 Ubuntu 24.04.2 上的原生 FUSE 启动检查：真实首次语言选择界面正常显示，正常关闭窗口后退出 0，应用、辅助进程和挂载均清理，宿主原有服务保持不变。

### Linux KVM 验收

最终同一份 AppImage 已在本机 Ubuntu 22.04.5 客体中完成验收，glibc 为 2.35，QMP 确认真正启用 KVM 加速。未修改的目录 worker 退出 0，记录了正确的原生更新目标，未再发出更新信息缺失警告。

- 原生 FUSE 与解包运行均通过离线认证 API，包括未认证拒绝、诊断、知识库目录/根路径、图构建、Markdown 内容/索引/分块、缓存和知识状态；打包的 pulldown worker 正常运行，没有回退。
- 两种模式的原生 About 均显示 **1.9.1**，实际验证三节点 Force 图、DAG 箭头、Markdown/Mermaid、Godot 学习路径，以及返回主窗口。
- 两次正常关闭窗口均退出 **0**。26 个观测到的应用相关进程和 5 个测试辅助进程全部消失，FUSE 挂载及隔离网络命名空间已移除。运行时 manifest 保留作为测试证据；解包缓存也会在应用退出后保留，确认无进程占用后才由测试人员精确手动删除。
- 虚拟机正常关机，QEMU、PID 文件及 QGA/QMP socket 均消失；宿主原有服务以及 11 个受监测的 macOS 磁盘、固件和启动文件保持记录中的状态。

截图如实保留既有视觉限制：阅读器加载/目录占位提示、Mermaid 标签裁切、DAG 标签重叠，以及 Godot 部分界面的重叠或裁切。本次发布不宣称解决这些独立界面问题。详见 [KVM 验收摘要与 12 张截图](https://github.com/Jacobinwwey/NoteConnection/releases/download/v1.9.1/NoteConnection_1.9.1_linux-kvm-validation.zip)。

上述 Windows/macOS 结果证明打包成功，不代表完整应用 GUI 验收。Android 资产不在本次桌面发布范围，已有签名和真机门禁继续保留。

### 下载校验

[SHA256SUMS](https://github.com/Jacobinwwey/NoteConnection/releases/download/v1.9.1/SHA256SUMS.txt) · [CI 来源清单](https://github.com/Jacobinwwey/NoteConnection/releases/download/v1.9.1/public-ci-manifest.json) · [源码测试](https://github.com/Jacobinwwey/NoteConnection/releases/download/v1.9.1/source-validation.json) · [差分更新证据](https://github.com/Jacobinwwey/NoteConnection/releases/download/v1.9.1/NoteConnection_1.9.1_update-validation.md)。
