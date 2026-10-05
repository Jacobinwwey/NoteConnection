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

### Validation status — draft

- Targeted AppImage behavior tests passed: **3 suites, 71 tests**, including an official zsyncmake 0.6.2 control fixture, missing/stale files, same-size image corruption, malformed headers/tables and wrong update targets. This verifies the boundary checks, not the official updater's block reconstruction.
- Final unfiltered Jest, strict Rust, build/docs/version/workflow results, three-platform CI asset identities, official reconstruction SHA-256 equality, Ubuntu 22.04 catalog/FUSE/extract-and-run acceptance and public asset/npm verification are recorded during release qualification. This draft does not claim those checks have completed.
- Full Linux runtime acceptance must use the exact final CI AppImage, its control file and original server from that same build. Windows/macOS packaging success and Linux KVM runtime evidence are separate acceptance records.

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

### 验证状态——草稿

- AppImage 定向行为测试已通过：**3 个套件、71 个测试**，覆盖官方 zsyncmake 0.6.2 控制文件 fixture、缺失/过期文件、同大小镜像损坏、非法头部/校验表以及错误更新目标。这证明了边界校验行为，不等于官方 updater 的分块重建验收。
- 完整未筛选 Jest、严格 Rust、构建/文档/版本/工作流结果，三平台 CI 资产身份，官方重建 SHA-256 一致性，Ubuntu 22.04 目录/FUSE/解包运行验收，以及公开资产/npm 核对，将在发布验收中记录。此草稿不声称这些检查已经完成。
- Linux 完整运行验收必须使用同一次 CI 构建的精确最终 AppImage、控制文件及原始 server。Windows/macOS 打包成功与 Linux KVM 运行证据分别记录。
