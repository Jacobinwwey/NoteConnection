# 操作指南：配置 app_config.toml

本指南用于安全地自定义本地运行策略（KB 路径、语言、多窗口行为）。

## 步骤 1：定位当前生效的配置文件

NoteConnection 的读取优先级如下：

1. `NOTE_CONNECTION_CONFIG_PATH`
2. `NOTE_CONNECTION_CONFIG_DIR` + `app_config.toml`
3. `%LOCALAPPDATA%/NoteConnection/app_config.toml`（Windows 默认）

## 步骤 2：从官方模板开始

请复制以下模板：

- [`docs/examples/app_config.template.toml`](../../../examples/app_config.template.toml)

## 步骤 3：应用你的策略

推荐单窗口配置：

```toml
[multi_window]
single_window_mode = true
hide_tauri_when_pathmode_opens = true
restore_tauri_when_pathmode_exits = true
confirm_before_full_shutdown_from_godot = true
sync_language = true
```

## 步骤 4：保存并重启

1. 退出 NoteConnection。
2. 使用 UTF-8 保存配置。
3. 重启后验证 Path Mode 窗口切换行为。

## 步骤 5：验证语言与 KB 持久化

- 确认重启后 KB 路径保持不变。
- 确认启动后语言按配置生效。
- 若 `sync_language = true`，确认 Path Mode 语言同步正常。

## 详细权威来源

- [docs/zh/app_config.toml_guide.md](../../../zh/app_config.toml_guide.md)
- [docs/zh/User_Manual.md](../../../zh/User_Manual.md)
