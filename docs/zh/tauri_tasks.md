# Historical Note (2026-03-04 v1.5.11)

## 中文文档

本文件作为 Electron -> Tauri 迁移早期阶段的任务看板历史记录保留。
当前有效的迁移决策/状态以以下文档为准：

- `TODO.md`（发布闸门决策与行动清单）
- `TEST_REPORT.md`（验证证据与风险状态）
- `open_goal_audit_2026-05-10.md`（跨文档未完成目标状态快照）
- `implementation_plan.md`（当前 Phase-1 / Phase-2 / Phase-3 现实对齐执行顺序）

补充说明（2026-05-12）：

- Tauri 迁移闭环并不等于 knowledge-mastery 底座闭环。
- 真实 graph backend、生产级 ANN、非 placeholder 质量门禁、以及默认 runtime tutor routing，现已转入历史 Tauri 任务板之外的主线跟踪。

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
- [x] 缓存选择交互（复用/重建提示）一致性现已由合同回归锁定。
- [x] 加载流程防重复执行现已由启动/重连 load-flow 合同检查覆盖。
- [x] Godot 中心切换交互下的 History 同步现已由历史合同验证覆盖。
- [ ] Linux 宿主 strict Tauri 证据仍依赖预装 `webkit2gtk-4.1`、`javascriptcoregtk-4.1`、`libsoup-3.0`；该项现属于宿主供给门禁，而非实现缺口。
- [ ] Electron 下线闸门审查仍待完成。

### P1.5 余下交付

1. 保持 Capacitor 构建链路可用（`build_apk.bat`）并持续维护。
2. 保持 Tauri Android 构建链路可用，并补齐可复现构建文档。
3. 在所有关键数据路径上，确保 Tauri 运行时与 Electron 基线行为一致。

---
