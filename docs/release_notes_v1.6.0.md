# NoteConnection v1.6.0

## English

### Highlights

- Single-window orchestration between Tauri and Godot (only one primary window visible at a time).
- NoteMD embedded workflow stabilized in Tauri/Godot runtime transitions.
- Fixed NoteMD Browse interactions in Tauri (file/folder/save pickers now complete end-to-end).
- Added PDF import guidance: convert PDF to Markdown with Mineru before import.
- Standardized Android Java policy to JDK 21+ and validated JDK 23.0.1 toolchain compatibility.
- Expanded release governance: FixRisk checks, SBOM/attestation, privacy/signature/contract gates.
- Improved build/dev efficiency with low-memory Tauri wrappers and sidecar preflight skip logic.

### Artifacts

- Windows NSIS: `NoteConnection_1.6.0_x64-setup.exe`
- Windows MSI: `NoteConnection_1.6.0_x64_en-US.msi`
- Android (Capacitor): `app-debug.apk`
- Android (Tauri Universal): `app-universal-release-unsigned.apk`
- Android (Tauri Universal Bundle): `app-universal-release.aab`

### Notes

- `FR-009` remains operationally `VERIFIED-PENDING` due evidence freshness thresholds.

---

## 中文

### 版本亮点

- 完成 Tauri 与 Godot 单窗口编排，同一时刻仅显示一个主窗口。
- 稳定 NoteMD 在 Tauri/Godot 间切换时的嵌入式工作流。
- 修复 Tauri 中 NoteMD Browse 无响应问题（文件/文件夹/保存选择器端到端可用）。
- 增加 PDF 导入提示：需先通过 Mineru 转换为 Markdown 再导入。
- 将 Android Java 基线统一为 JDK 21+，并验证 JDK 23.0.1 工具链兼容性。
- 扩展发布治理能力：FixRisk、SBOM/attestation、隐私/签名/合约门禁。
- 通过低内存 Tauri 包装器与 sidecar 预检，改善构建与开发启动效率。

### 发布产物

- Windows NSIS: `NoteConnection_1.6.0_x64-setup.exe`
- Windows MSI: `NoteConnection_1.6.0_x64_en-US.msi`
- Android（Capacitor）: `app-debug.apk`
- Android（Tauri Universal）: `app-universal-release-unsigned.apk`
- Android（Tauri Universal Bundle）: `app-universal-release.aab`

### 说明

- `FR-009` 仍为运维层 `VERIFIED-PENDING`（证据新鲜度阈值待补齐）。

