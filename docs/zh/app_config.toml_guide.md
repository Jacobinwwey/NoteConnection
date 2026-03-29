# 2026-03-26 v1.6.6

# app_config.toml 配置指南

本指南说明 NoteConnection `v1.6.6+` 如何将以下运行时配置统一到同一个 `app_config.toml`：

- Tauri 壳层/运行策略
- Godot Path Mode 界面与运行参数
- 前端图谱/阅读器运行参数（Tauri + Godot Bridge 共享）
- NoteMD 的 LLM 工作流与 Provider 参数

## 1. 这个文件现在控制什么

`app_config.toml` 已成为统一持久化入口：

- `knowledge_base_path`、`user_language`、`[multi_window]`（Tauri 运行配置）
- `[path_mode]`（Godot 运行配置，替代原先分散的本地 cfg）
- `[frontend_settings]`（图谱物理参数、视觉参数、性能参数与 Markdown 阅读协议参数）
- `[notemd]` + `[[notemd.providers]]`（NoteMD 全量配置 + Provider 列表）

## 2. NoteConnection 如何定位 `app_config.toml`

读取优先级（从高到低）：

1. `NOTE_CONNECTION_CONFIG_PATH`（完整文件路径）
2. `NOTE_CONNECTION_CONFIG_DIR` + `/app_config.toml`
3. 默认路径：
   - Windows：`%LOCALAPPDATA%/NoteConnection/app_config.toml`

旧配置兼容：

- 若同目录存在旧版 `kb_config.json`，启动时会自动迁移为 TOML。

## 3. 权威模板

- [`docs/examples/app_config.template.toml`](../examples/app_config.template.toml)

## 4. 核心分段示例

### 4.1 Tauri 核心运行配置

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

### 4.2 Godot Path Mode 运行配置

```toml
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
```

### 4.3 NoteMD 配置与 Provider 策略

```toml
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

### 4.4 前端阅读协议（Pulldown/Legacy 灰度）

```toml
[frontend_settings.reading]
mode = "window"
markdown_engine = "auto" # "legacy" | "pulldown" | "auto"
chunk_block_size = 36
prefetch_blocks = 8
index_cache_ttl_sec = 1800
max_doc_bytes = 100663296
```

运行时行为：

- `markdown_engine = "auto"`：优先使用 `pulldown-cmark` 的索引/分块协议，失败自动回退 legacy。
- `markdown_engine = "pulldown"`：若 worker 或协议异常，仍自动回退到 legacy，避免阅读器空白。
- `chunk_block_size` + `prefetch_blocks`：控制大文档分块读取吞吐。
- `index_cache_ttl_sec`：控制服务端 Markdown 索引缓存有效期。
- `max_doc_bytes`：Markdown 索引请求的安全上限。

内置 Provider 名称包括：

`DeepSeek`、`OpenAI`、`Anthropic`、`Google`、`Mistral`、`Azure OpenAI`、`LMStudio`、`Ollama`、`OpenRouter`、`xAI`、`Qwen`、`Doubao`、`Moonshot`、`GLM`、`MiniMax`、`Groq`、`Together`、`Fireworks`、`Requesty`、`OpenAI Compatible`。

## 5. v1.6.6 的 API 调用流程

NoteMD 的 Provider 调用流程已改为“定义驱动”：

1. 读取 provider definition（`transport`、`apiKeyMode`、`apiTestMode`）
2. 按 transport 分发（`openai-compatible`、`anthropic`、`google`、`azure-openai`、`ollama`）
3. 应用 provider 级请求头与策略
4. 对可重试 HTTP 错误执行带 `Retry-After` 感知的重试退避
5. 按 provider 测试模式进行连通性探测（`models-then-chat` 或 `chat-only`）

## 6. 使用注意事项

- 编辑并保存为 UTF-8 编码文本。
- PDF 文件需要先用 Mineru 转为 Markdown，再导入 NoteMD。
- 独立运行 Godot 时可使用本地回退配置；在宿主运行时，优先使用 TOML 统一配置。

## 7. 关联 Diataxis 页面

- 操作指南：[`docs/diataxis/zh/how-to/configure-app-config.md`](../diataxis/zh/how-to/configure-app-config.md)
- 参考文档：[`docs/diataxis/zh/reference/app-config-schema.md`](../diataxis/zh/reference/app-config-schema.md)
