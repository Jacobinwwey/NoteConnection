# NoteConnection v1.6.0 发布对比报告

## 1. 对比基线

- 项目：`NoteConnection`
- 对比范围：`v1.3.0..v1.6.0`
- 基线标签（`v1.3.0`）：`376ae600fbf14700c9dbbc10c4bb6190a34078e4`（`2026-01-24 20:37:25 +0800`）
- 目标标签（`v1.6.0`）：`eb2bb2ec7b9fd239c559accb034e5537f56613e7`（`2026-03-23 22:08:28 +0800`）

## 2. 量化差异总览

基于 `git diff v1.3.0..v1.6.0`：

- 提交数：`107`
- 变更文件数：`301`
- 代码/文档变更量：`+125,957 / -10,083`
- 净增长：`+115,874`

基于 `git diff --name-status` 的状态分布：

- 新增：`241`
- 修改：`56`
- 删除：`3`
- 重命名：`1`

## 3. 顶层目录变更覆盖

按变更文件数统计：

1. `src/`: `116`
2. `docs/`: `41`
3. `scripts/`: `40`
4. `path_mode/`: `27`
5. `src-tauri/`: `19`
6. `build/`: `15`
7. `.github/workflows/`: `6`
8. `android/`: `6`

质量与治理扩展：

- 新增/变更测试文件：`53`
- 新增/变更合约测试：`38`
- 新增/变更工作流：`6`

## 4. 自 v1.3.0 以来的关键工程增量

### A. 运行时与打包架构

- 在 `src-tauri/` 引入并强化了 Tauri 运行时与 sidecar 架构。
- 清理了 Electron 运行时入口（`src/electron/main.ts`、`src/electron/preload.ts`、`electron-builder.yml`）。
- 增加前端运行时能力注入与 sidecar 运行时配置水合流程，提升桥接稳定性。

### B. Godot Path Mode 扩展

- `path_mode/` 显著扩容：
  - 新场景（主场景、设置、树面板）
  - 状态机与面板脚本
  - 渲染器与 WebSocket 客户端升级
  - NoteMD 嵌入面板挂接
- 稳定了 Tauri 与 Godot 的单窗口编排行为。

### C. NoteMD 体系集成

- 在 `src/notemd/` 引入完整 NoteMD 后端模块族。
- 新增前端 NoteMD 界面（`notemd.html/js/css`）。
- 打通了 Tauri/Godot 桥接调用链路。
- 修复 Tauri 集成中的文件/文件夹/保存选择器流程。

### D. 移动端与多导出流水线

- 双 Android 路线成熟化（Capacitor + Tauri Android）。
- 增加 Android/Tauri 兼容脚本（环境校验、补丁、sidecar 校验）。
- 增加 Java 兼容性对齐能力，提升 APK/AAB 导出的确定性。

### E. 校验、安全与发布治理

- 新增/扩展：
  - FixRisk 运维就绪自动化
  - SBOM 生成与 attestation 校验
  - sidecar 签名校验
  - 隐私清单校验
  - pathbridge 严格 schema 门禁
  - wasm parity 历史基线与性能护栏
  - 移动端 detox 合约校验

### F. 性能与开发体验

- 增加低内存 Tauri 包装器与运行时内存策略工具。
- 增加 sidecar 预检以减少热启动重复重建。
- 增加 Mermaid/Resvg 运行时资源生成与校验链路。

## 5. 最高影响文件（按总代码行变更）

来自 `git diff --numstat` 的代表性结果：

1. `build/sbom/noteconnection-sbom.cdx.json`（`+17016 / -0`）
2. `TODO.md`（`+6684 / -1611`）
3. `package-lock.json`（`+3850 / -3183`）
4. `src-tauri/Cargo.lock`（`+5631 / -0`）
5. `TEST_REPORT.md`（`+3883 / -1410`）
6. `path_mode/scripts/path_mode_ui.gd`（`+4950 / -0`）
7. `src/server.ts`（`+2751 / -291`）
8. `src/frontend/path_app.js`（`+2579 / -86`）
9. `src-tauri/src/lib.rs`（`+2664 / -0`）
10. `src/core/PathBridge.ts`（`+2020 / -26`）

## 6. 本轮文档补齐项

基于 `v1.3.0..v1.6.0` 对比审计，本轮已补齐以下文档缺口：

- 将核心 README/手册/接口文档的过期版本头统一更新到 `v1.6.0`。
- 将本发布报告改为严格 tag-to-tag 口径（移除 `..HEAD` 造成的歧义）。
- 在发布说明与 README 更新日志中补充 compare 口径信息。
- 更新双语索引，纳入 `v1.3.0` 之后新增的双语配对文档。

## 7. 发布结论建议

相对于 `v1.3.0`，`v1.6.0` 属于运行时与治理能力的大版本跃迁，而非补丁级更新。

建议对外发布叙事聚焦：

1. 架构迁移：Electron 清退，Tauri 主导。
2. 体验迁移：单窗口编排与 NoteMD 嵌入式流程。
3. 交付迁移：双 Android 管线 + 更严格的 CI/安全治理。
