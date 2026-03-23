# NoteConnection v1.6.0 发布更新报告

## 1. 对比基线

- **项目**: NoteConnection
- **目标版本**: `v1.6.0`
- **对比范围**: `v1.3.0..HEAD`
- **基线标签时间**: `2026-01-24 20:37:25 +0800`
- **当前提交**: `7f3bb04`（`2026-03-23 19:20:27 +0800`）

## 2. 变更规模总览

- **提交数（不含 merge）**: `104`
- **变更文件数**: `297`
- **代码/文档变更量**: `+125,500 / -10,075`

按新增行数统计的主要变更区域：

1. `src/`: `+29,116`（`115` 文件）
2. `build/`: `+24,851`（`15` 文件）
3. `docs/`: `+21,589`（`38` 文件）
4. `path_mode/`: `+10,798`（`27` 文件）
5. `scripts/`: `+10,394`（`40` 文件）
6. `src-tauri/`: `+8,889`（`17` 文件）

质量保障范围扩展：

- **新增/更新测试文件**: `53`
- **其中合约测试**: `38`
- **NoteMD 后端新增模块文件**: `13`
- **新增/更新 CI 工作流**: `6`

## 3. v1.3.0 以来的核心工程升级

### A. 运行时架构与桌面壳层

- 引入并强化 Tauri 主导架构（`src-tauri/` 大规模扩展）。
- 移除历史 Electron 运行时文件，切换到 sidecar 驱动打包模式。
- 完成 Tauri 与 Godot 间单窗口编排（窗口切换而非双窗口并存）。
- 增强关闭流程与窗口可见性交接逻辑，降低误关风险。

### B. NoteMD 端到端集成

- 新增 `src/notemd/` 完整后端子系统：
  - `BatchProcessor`、`FileProcessor`、`Translator`、`ContentGenerator`
  - `MermaidProcessor`、`FormulaFixer`、`DuplicateDetector`
  - `NotemdService` 与类型化请求/响应契约
- 新增前端界面与逻辑（`src/frontend/notemd.html/js/css`）。
- 修复 Tauri 中 Browse/文件/文件夹/保存选择链路无响应问题。
- 明确导入规范：`PDF -> Mineru -> Markdown`。

### C. Godot Path Mode 与交互体验

- `path_mode/` 新增场景、渲染逻辑、面板系统与嵌入能力。
- 路径 UI、树渲染、设置流和桥接同步机制均有增强。
- 修复 Godot 可见性控制路径与已弃用 API 警告链路。

### D. 移动端导出与双管线支持

- 扩展双 Android 管线：
  - Capacitor Android（`android/`）
  - Tauri Android（`src-tauri/gen/android/...` + runner/patch 脚本）
- 新增 Java 兼容性对齐与前置依赖校验脚本。
- 统一 Android 包信息与构建脚本，保证发布一致性。

### E. 可靠性、安全与运维治理

- 增加 FixRisk 运维就绪工作流与严格证据门禁支持。
- 增加 SBOM 生成、attestation 生成与校验脚本/合约。
- 增加 privacy manifest、sidecar 签名、pathbridge 严格 schema、detox 管线校验。
- 增加 wasm parity 校验、基准测试与历史阈值护栏。

### F. 构建性能与开发效率

- 增加低内存 Tauri 构建包装器：
  - `scripts/run-tauri-build.js`
  - `scripts/run-tauri-android.js` 低内存策略
  - `src-tauri/Cargo.toml` release profile 保护
- 增加 `scripts/ensure-sidecar-ready.js`，热启动阶段跳过冗余 sidecar 重建。
- 启用 TypeScript 增量编译缓存（`tsconfig.json`）。

## 4. v1.6.0 版本同步项

已同步为 `1.6.0`：

- `package.json`
- `package-lock.json`（顶层与 root package 条目）
- `src-tauri/tauri.conf.json`
- `src-tauri/src/lib.rs`（About 版本显示）
- `android/app/build.gradle`（`versionName 1.6.0`，`versionCode 16000`）

README 同步完成：

- `README.md`（中英双区段）
- `docs/en/README.md`
- `docs/zh/README.md`

## 5. 平台发布矩阵（v1.6.0）

| 平台 | 版本 | 产物 | 状态 |
|---|---|---|---|
| npm 包 | `1.6.0` | `package.json` 发布目标 | 就绪 |
| Windows 桌面版（Tauri x64） | `1.6.0` | `src-tauri/target/release/bundle/nsis/NoteConnection_1.6.0_x64-setup.exe` | 已构建 |
| Windows 桌面版（Tauri MSI） | `1.6.0` | `src-tauri/target/release/bundle/msi/NoteConnection_1.6.0_x64_en-US.msi` | 已构建 |
| Android（Capacitor debug） | `1.6.0` | `android/app/build/outputs/apk/debug/app-debug.apk` | 已构建 |
| Android（Tauri universal APK） | `1.6.0` | `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk` | 产物可用 |
| Android（Tauri universal AAB） | `1.6.0` | `src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab` | 产物可用 |

Tauri Android 元数据快照：

- `src-tauri/gen/android/app/build/outputs/apk/universal/release/output-metadata.json`
- `versionName: "1.6.0"`
- `versionCode: 1006000`

Capacitor Android 元数据快照：

- `android/app/build/outputs/apk/debug/output-metadata.json`
- `versionName: "1.6.0"`
- `versionCode: 16000`

## 6. 本轮发布验证证据

通过命令：

1. `npm run build:mini`
2. `npm run verify:fixrisk:issues`
3. `npm run tauri:build:mini`
4. `npm run mobile:build:capacitor`
5. `npm run mobile:build:both`（双移动端全链路构建）

FixRisk 状态：

- `FR-001..FR-008`、`FR-010..FR-015`: `VERIFIED-CLOSED`
- `FR-009`: `VERIFIED-PENDING`（运维证据新鲜度/阈值仍待补齐）

## 7. 已知风险说明

1. **Tauri Android 重复构建存在宿主机内存不稳定问题**：
   - 在本机多次重跑 `npm run tauri:android:build:universal` 时，可能在 Rust Android 目标编译阶段出现内存分配失败。
   - 但先前生成的 `v1.6.0` universal APK/AAB 产物已存在且版本对齐。
2. **FR-009 仍是运维层 pending**：
   - 功能校验已通过，但严格的大图实机证据闭环仍需刷新。

## 8. 发布建议

建议执行 `v1.6.0` 的 GitHub + npm 同步发布，附带两点运维建议：

1. 先发布当前已产出的 `1.6.0` 桌面与 Android 产物。
2. 若要求“从零可重复构建”证明，建议在更高内存 CI/构建机上重跑 Tauri Android 打包并替换产物。

