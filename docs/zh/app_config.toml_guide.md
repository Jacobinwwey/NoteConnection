# 2026-03-25 v1.6.0

# app_config.toml 配置指南

本指南用于说明如何通过 `app_config.toml` 配置 NoteConnection 的运行时行为。

## 1. 这个文件控制什么

`app_config.toml` 负责以下配置：

- 知识库根目录（KB）持久化。
- 界面语言（`en` / `zh`）。
- Tauri 与 Godot 之间的多窗口运行策略。

## 2. NoteConnection 如何定位 `app_config.toml`

读取优先级（从高到低）：

1. `NOTE_CONNECTION_CONFIG_PATH`（完整文件路径）。
2. `NOTE_CONNECTION_CONFIG_DIR` + `/app_config.toml`。
3. 默认路径：
   - Windows：`%LOCALAPPDATA%/NoteConnection/app_config.toml`。

旧配置兼容：

- 若同目录存在 `kb_config.json`，启动时会自动迁移为 `app_config.toml`。

## 3. 模板（推荐起点）

请优先使用权威模板：

- [`docs/examples/app_config.template.toml`](../examples/app_config.template.toml)

快速模板如下：

```toml
knowledge_base_path = "E:/Knowledge_project/NoteConnection_app/Knowledge_Base"
user_language = "en"

[multi_window]
single_window_mode = true
hide_tauri_when_pathmode_opens = true
restore_tauri_when_pathmode_exits = true
confirm_before_full_shutdown_from_godot = true
sync_language = true
```

## 4. 参数语义与效果

| 键 | 类型 | 默认值 | 可选值 | 效果 |
|---|---|---|---|---|
| `knowledge_base_path` | `string` | 自动默认 KB 路径 | 已存在目录路径 | 持久化 KB 根目录。若路径在 `Knowledge_Base` 子目录内，运行时会自动归一到 `Knowledge_Base` 根。 |
| `user_language` | `string` | `"en"` | `"en"`、`"zh"` | 设置应用语言。其它值会回退到 `"en"`。 |
| `multi_window.single_window_mode` | `bool` | `true` | `true`/`false` | 控制启动模式与 Godot 初始可见策略。 |
| `multi_window.hide_tauri_when_pathmode_opens` | `bool` | `true` | `true`/`false` | 为 true 时，进入 Path Mode 后隐藏 Tauri。 |
| `multi_window.restore_tauri_when_pathmode_exits` | `bool` | `true` | `true`/`false` | 为 true 时，退出 Path Mode 后恢复并聚焦 Tauri。 |
| `multi_window.confirm_before_full_shutdown_from_godot` | `bool` | `true` | `true`/`false` | 为 true 时，关闭 Godot 会先弹确认框（返回主界面/关闭全部）。 |
| `multi_window.sync_language` | `bool` | `true` | `true`/`false` | 为 true 时，语言更新会在运行时窗口间同步。 |

兼容别名（迁移场景可识别）：

- `knowledgeBasePath` -> `knowledge_base_path`
- `userLanguage` -> `user_language`
- `[multiWindow]` -> `[multi_window]`
- `singleWindowMode` -> `single_window_mode`
- `hideTauriWhenPathmodeOpens` -> `hide_tauri_when_pathmode_opens`
- `restoreTauriWhenPathmodeExits` -> `restore_tauri_when_pathmode_exits`
- `confirmBeforeFullShutdownFromGodot` -> `confirm_before_full_shutdown_from_godot`
- `syncLanguage` -> `sync_language`

## 5. 推荐方案

### A) 严格单窗口（推荐）

```toml
[multi_window]
single_window_mode = true
hide_tauri_when_pathmode_opens = true
restore_tauri_when_pathmode_exits = true
confirm_before_full_shutdown_from_godot = true
sync_language = true
```

效果：

- 任意时刻仅显示一个主前端窗口。
- 关闭 Path Mode 时会要求用户明确选择。

### B) 联调并行可见模式（开发调试）

```toml
[multi_window]
single_window_mode = false
hide_tauri_when_pathmode_opens = false
restore_tauri_when_pathmode_exits = true
confirm_before_full_shutdown_from_godot = true
sync_language = true
```

效果：

- 打开 Path Mode 时可保留 Tauri 可见。
- 适用于桥接通信和界面联调。

## 6. 安全修改流程

1. 退出 NoteConnection。
2. 编辑 `app_config.toml`。
3. 使用 UTF-8 编码保存。
4. 重新启动 NoteConnection。
5. 验证：
   - 主窗口与 Path Mode 切换行为符合你的多窗口策略。
   - 语言与 KB 路径按预期加载。

## 7. 关联 Diataxis 页面

- 操作指南：[`docs/diataxis/zh/how-to/configure-app-config.md`](../diataxis/zh/how-to/configure-app-config.md)
- 参考文档：[`docs/diataxis/zh/reference/app-config-schema.md`](../diataxis/zh/reference/app-config-schema.md)
