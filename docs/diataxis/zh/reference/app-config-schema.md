# 参考：app_config.toml 配置结构

本页定义 NoteConnection `v1.6.0+` 的权威 `app_config.toml` 运行时结构。

## 文件定位优先级

1. `NOTE_CONNECTION_CONFIG_PATH`
2. `NOTE_CONNECTION_CONFIG_DIR` + `app_config.toml`
3. `%LOCALAPPDATA%/NoteConnection/app_config.toml`（Windows 默认）

旧文件迁移：

- 同目录中的旧版 `kb_config.json` 会在启动时自动迁移为 TOML。

## 配置结构

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

## 键位契约表

| 键 | 类型 | 默认值 | 约束 | 运行时契约 |
|---|---|---|---|---|
| `knowledge_base_path` | `string` | 自动默认 KB 根目录 | 必须为已存在目录 | 持久化 KB 根目录；若路径位于 `Knowledge_Base` 子目录内，会归一到 `Knowledge_Base` 根。 |
| `user_language` | `string` | `"en"` | `"en"` 或 `"zh"`（`"zh-CN"` 不被接受，会回退为 `"en"`） | 控制启动语言与菜单语言。 |
| `multi_window.single_window_mode` | `bool` | `true` | 布尔值 | 控制单窗口启动/切换策略与 Godot 初始可见模式。 |
| `multi_window.hide_tauri_when_pathmode_opens` | `bool` | `true` | 布尔值 | 为 true 时，在 `toggle_pathmode_window(show_godot=true)` 隐藏 Tauri 主窗口。 |
| `multi_window.restore_tauri_when_pathmode_exits` | `bool` | `true` | 布尔值 | 为 true 时，在 `toggle_pathmode_window(show_godot=false)` 恢复并聚焦 Tauri。 |
| `multi_window.confirm_before_full_shutdown_from_godot` | `bool` | `true` | 布尔值 | 为 true 时，Godot 关闭流程需要确认（返回主界面/关闭全部）。 |
| `multi_window.sync_language` | `bool` | `true` | 布尔值 | 为 true 时，语言更新会通过运行时事件同步到前端窗口。 |

## 向后兼容别名

| 规范键 | 旧别名 |
|---|---|
| `knowledge_base_path` | `knowledgeBasePath` |
| `user_language` | `userLanguage` |
| `[multi_window]` | `[multiWindow]` |
| `single_window_mode` | `singleWindowMode` |
| `hide_tauri_when_pathmode_opens` | `hideTauriWhenPathmodeOpens` |
| `restore_tauri_when_pathmode_exits` | `restoreTauriWhenPathmodeExits` |
| `confirm_before_full_shutdown_from_godot` | `confirmBeforeFullShutdownFromGodot` |
| `sync_language` | `syncLanguage` |

## 前端运行时投影

前端通过 `invoke('get_app_runtime_config')` 完成水合，并投影到：

- `window.__NC_APP_CONFIG.language`
- `window.__NC_APP_CONFIG.multiWindow.singleWindowMode`
- `window.__NC_APP_CONFIG.multiWindow.hideTauriWhenPathmodeOpens`
- `window.__NC_APP_CONFIG.multiWindow.restoreTauriWhenPathmodeExits`
- `window.__NC_APP_CONFIG.multiWindow.confirmBeforeFullShutdownFromGodot`
- `window.__NC_APP_CONFIG.multiWindow.syncLanguage`

## 详细权威来源

- [docs/zh/app_config.toml_guide.md](../../../zh/app_config.toml_guide.md)
- [docs/zh/Interface Document.md](../../../zh/Interface%20Document.md)
