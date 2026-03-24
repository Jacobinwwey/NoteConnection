# 操作指南：单窗口运行时

当你需要验证和操作 Tauri/Godot 单窗口行为时，请使用本指南。

## 预期运行行为

1. `npm run tauri:dev:mini:gpu` 启动后默认显示 Tauri。
2. 进入 Path Mode 后切换为 Godot 前端显示。
3. 任意时刻只保留一个主前端窗口可见。

## Godot 关闭行为

- 关闭 Godot 窗口时应先弹出确认框：
  - 返回主界面。
  - 关闭全部窗口。

## NoteMD 运行时行为

- NoteMD 为嵌入式流程能力，不是独立桌面窗口。
- Tauri 中 Browse 操作应触发原生选择器并回填路径。
- PDF 导入规则必须遵循：`PDF -> Mineru -> Markdown`。

## 详细权威来源

- [docs/zh/single_window_migration_plan.md](../../../zh/single_window_migration_plan.md)
- [docs/zh/User_Manual.md](../../../zh/User_Manual.md)
