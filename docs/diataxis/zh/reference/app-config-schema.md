# 参考：app_config.toml 配置结构

本页定义 NoteConnection `v1.6.6+` 的权威 `app_config.toml` 结构。

## 文件定位优先级

1. `NOTE_CONNECTION_CONFIG_PATH`
2. `NOTE_CONNECTION_CONFIG_DIR` + `app_config.toml`
3. `%LOCALAPPDATA%/NoteConnection/app_config.toml`（Windows 默认）

旧配置迁移：

- 旧版 `kb_config.json` 会在启动时自动迁移到 TOML。

## 标准结构

```toml
knowledge_base_path = "E:/Knowledge_project/NoteConnection_app/Knowledge_Base"
user_language = "en"

[multi_window]
single_window_mode = true
hide_tauri_when_pathmode_opens = true
restore_tauri_when_pathmode_exits = true
confirm_before_full_shutdown_from_godot = true
sync_language = true

[path_mode]
auto_reconstruct = true
retain_history = true
focus_mode = true
background = "belfast_sunset_puresky_4k.exr"
bg_brightness = 1.0
reading_mode = "window"
reader_render_mode = "render"
reader_toggle_source_shortcut = "Ctrl+M"
reader_media_scale = 1.5
reader_debug = false
node_spacing = 240.0

[notemd]
active_provider = "DeepSeek"
developer_mode = false
chunk_word_count = 2800
max_tokens = 4096
max_retries = 3
retry_delay_ms = 1200
auto_mermaid_fix_after_generate = false

[[notemd.providers]]
name = "DeepSeek"
api_key = ""
base_url = "https://api.deepseek.com/v1"
model = "deepseek-reasoner"
temperature = 0.5
api_version = ""
enabled = true
```

## 键位契约表

| 键 | 类型 | 默认值 | 约束 | 运行时契约 |
|---|---|---|---|---|
| `knowledge_base_path` | `string` | 自动 KB 根目录 | 必须为存在目录 | Tauri 持久化 KB 根目录；若路径在 `Knowledge_Base` 子目录下会归一到根。 |
| `user_language` | `string` | `"en"` | `"en"` 或 `"zh"` | 运行时语言与菜单语言来源。 |
| `multi_window.*` | `bool` | 见模板 | 布尔值 | 控制单窗口切换、恢复以及关闭确认策略。 |
| `path_mode.auto_reconstruct` | `bool` | `true` | 布尔值 | Godot 路径重建行为开关。 |
| `path_mode.reader_media_scale` | `number` | `1.5` | 截断到 `[0.1, 3.0]` | Godot 阅读器媒体缩放比例。 |
| `path_mode.node_spacing` | `number` | `240` | 截断到 `[100, 600]` | Godot Path Mode 树渲染节点间距。 |
| `notemd.active_provider` | `string` | `"DeepSeek"` | 必须存在于 `[[notemd.providers]]` | NoteMD 默认任务使用的活动 Provider。 |
| `notemd.providers[]` | 数组(表) | 内置预设 | provider 名称 + 配置字段 | NoteMD 定义驱动 API 分发的 Provider 注册表。 |
| `notemd.max_retries` | `number` | `3` | `>=0` | NoteMD LLM 调用重试次数基线。 |
| `notemd.retry_delay_ms` | `number` | `1200` | `>=0` | NoteMD 重试基础退避时间。 |
| `notemd.api` | 表 | 活动 provider 镜像 | 可选兼容段 | 保留给旧运行时分支的兼容镜像。 |

## 兼容别名

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

## 关联页面

- [docs/zh/app_config.toml_guide.md](../../../zh/app_config.toml_guide.md)
