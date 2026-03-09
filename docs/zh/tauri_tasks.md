# Historical Note (2026-03-04 v1.5.11)

## 中文文档

本文件作为 Electron -> Tauri 迁移早期阶段的任务看板历史记录保留。
当前有效的迁移决策/状态以以下文档为准：

- `TODO.md`（发布闸门决策与行动清单）
- `TEST_REPORT.md`（验证证据与风险状态）

---

# 2026-03-04 v1.5.13 - Tauri Taskboard Refresh (Desktop + Android + Godot Bridge)

## 中文文档

### 更新目标

在保持兼容性的前提下，完成从 Electron 主运行时到 Tauri 主运行时的迁移：

- 桌面端（Windows）并集成 Godot Path Mode。
- Android 双产物策略（保留 Capacitor，同步支持 Tauri Android）。
- 保持 NoteConnection 图构建所需的现有构建与缓存流程。

### 执行状态（v1.5.1）

- [x] Tauri 桌面 Sidecar 架构可运行。
- [x] 后端与 Godot 的 PathBridge 通信可运行。
- [x] Sidecar 运行时路径处理已对齐。
- [x] Sidecar 运行时 Worker 模块路径问题已处理。
- [ ] 缓存选择交互（复用/重建提示）一致性仍需锁定回归验证。
- [ ] 加载流程防重复执行仍需完成启动竞态加固。
- [ ] Godot 中心切换交互下的 History 同步仍需最终验证。
- [ ] Electron 下线闸门审查仍待完成。

### P1.5 余下交付

1. 保持 Capacitor 构建链路可用（`build_apk.bat`）并持续维护。
2. 保持 Tauri Android 构建链路可用，并补齐可复现构建文档。
3. 在所有关键数据路径上，确保 Tauri 运行时与 Electron 基线行为一致。

---

