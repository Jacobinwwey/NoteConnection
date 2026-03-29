# 2026-03-26 v1.6.6

# app_config.toml Guide

This guide explains how NoteConnection `v1.6.6+` unifies runtime settings for:

- Tauri shell/runtime policy
- Godot Path Mode UI/runtime
- Frontend graph/reader runtime policy (shared by Tauri + Godot bridge)
- NoteMD LLM workflow/runtime

## 1. What This File Controls

`app_config.toml` is now the single persisted source for:

- `knowledge_base_path`, `user_language`, and `[multi_window]` (Tauri runtime).
- `[path_mode]` (Godot runtime settings that were previously split to local cfg).
- `[frontend_settings]` (graph physics/visual/performance + markdown reader protocol knobs).
- `[notemd]` + `[[notemd.providers]]` (full NoteMD settings + provider registry values).

## 2. Where NoteConnection Reads `app_config.toml`

Resolution order (highest priority first):

1. `NOTE_CONNECTION_CONFIG_PATH` (exact file path).
2. `NOTE_CONNECTION_CONFIG_DIR` + `/app_config.toml`.
3. Default path:
   - Windows: `%LOCALAPPDATA%/NoteConnection/app_config.toml`

Legacy compatibility:

- If legacy `kb_config.json` exists in the same config directory, startup migrates it to TOML.

## 3. Canonical Template

- [`docs/examples/app_config.template.toml`](../examples/app_config.template.toml)

## 4. Key Sections

### 4.1 Core Runtime (Tauri)

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

### 4.2 Godot Path Mode Runtime

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

### 4.3 NoteMD Runtime + Provider Strategy

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

### 4.4 Frontend Reader Protocol (Pulldown/Legacy Gray Release)

```toml
[frontend_settings.reading]
mode = "window"
markdown_engine = "auto" # "legacy" | "pulldown" | "auto"
chunk_block_size = 36
prefetch_blocks = 8
index_cache_ttl_sec = 1800
max_doc_bytes = 100663296
```

Runtime behavior:

- `markdown_engine = "auto"`: prefer `pulldown-cmark` index/chunk protocol and automatically fall back to legacy parser.
- `markdown_engine = "pulldown"`: still falls back to legacy parser if worker or protocol fails (to avoid blank reader sessions).
- `chunk_block_size` + `prefetch_blocks`: control incremental reader throughput for large Markdown files.
- `index_cache_ttl_sec`: controls server-side markdown index cache lifetime.
- `max_doc_bytes`: hard safety cap for markdown indexing requests.

Built-in provider names include:

`DeepSeek`, `OpenAI`, `Anthropic`, `Google`, `Mistral`, `Azure OpenAI`, `LMStudio`, `Ollama`, `OpenRouter`, `xAI`, `Qwen`, `Doubao`, `Moonshot`, `GLM`, `MiniMax`, `Groq`, `Together`, `Fireworks`, `Requesty`, `OpenAI Compatible`.

## 5. API Calling Flow (v1.6.6)

NoteMD provider calls are now definition-driven:

1. Resolve provider definition (`transport`, `apiKeyMode`, `apiTestMode`).
2. Dispatch by transport (`openai-compatible`, `anthropic`, `google`, `azure-openai`, `ollama`).
3. Apply provider-specific headers/policies.
4. Use retry/backoff with `Retry-After` awareness for retryable HTTP failures.
5. Use provider-aware connectivity probing (`models-then-chat` or `chat-only`).

## 6. Safety Notes

- Keep `app_config.toml` in UTF-8.
- For PDF sources, convert to Markdown with Mineru before importing into NoteMD.
- If you run standalone Godot without sidecar runtime, local fallback settings may still be used for development, but host runtime prefers TOML-backed settings.

## 7. Related Diataxis Pages

- How-To: [`docs/diataxis/en/how-to/configure-app-config.md`](../diataxis/en/how-to/configure-app-config.md)
- Reference: [`docs/diataxis/en/reference/app-config-schema.md`](../diataxis/en/reference/app-config-schema.md)
