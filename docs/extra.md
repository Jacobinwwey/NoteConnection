# Document Processing Migration — Analysis & Solution (English)

## Background

The **obsidian-NoteMD_new** plugin provides LLM-powered document processing capabilities within Obsidian. This document outlines the plan to migrate its core functionality into the **NoteConnection** project as a standalone, platform-independent module.

## Source Plugin Analysis

### Core Capabilities (15 Modules, ~6000 Lines)

| Module | Capability |
|---|---|
| `llmUtils.ts` | 10 LLM provider integrations (OpenAI, Anthropic, Google, Mistral, DeepSeek, Ollama, LMStudio, OpenRouter, Azure, Custom) with retry logic and error handling |
| `fileUtils.ts` | Core file processing: wiki-link injection, concept extraction, duplicate detection, content generation from titles |
| `mermaidProcessor.ts` | 30+ regex-based Mermaid diagram syntax fixers |
| `promptUtils.ts` | 7 task prompt templates with variable substitution and focused-learning domain injection |
| `translate.ts` | File/folder translation with chunking and concurrent processing |
| `searchUtils.ts` | Web search provider integration for research-backed content generation |
| `utils.ts` | Concurrency primitives (Semaphore), content chunking, provider/model selection |
| `types.ts` / `constants.ts` | Settings interfaces and defaults |
| `formulaFixer.ts` | LaTeX delimiter normalization |
| `extractOriginalText.ts` | Reference content extraction and mapping |

### Obsidian API Dependencies

The plugin relies heavily on Obsidian's internal APIs:
- **File I/O**: `app.vault.read()`, `app.vault.create()`, `app.vault.modify()`, `app.vault.createFolder()`
- **HTTP**: `requestUrl()` (Obsidian's built-in HTTP client)
- **UI**: `Notice`, `ProgressModal`, `WorkspaceLeaf`
- **Type System**: `TFile`, `TFolder`, `App`

## Migration Architecture

### Design Principles

1. **Complete Decoupling**: Zero Obsidian dependencies. All APIs replaced with Node.js equivalents (`fs`, `fetch`).
2. **Additive-Only**: No existing NoteConnection functionality is modified or removed. The document processor is an entirely new module.
3. **Backend-Frontend Separation**: Business logic in `src/docprocessor/` (Node.js), UI in `src/frontend/docprocessor.html` (vanilla JS).
4. **Cross-Platform Access**: Accessible from browser, Tauri desktop, and Godot window via HTTP API and IPC.

### System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   NoteConnection                     │
│                                                      │
│  ┌──────────────────┐    ┌────────────────────────┐ │
│  │  Existing Graph   │    │  NEW: Doc Processor    │ │
│  │  Engine + Server  │    │  Backend Modules       │ │
│  │  (unchanged)      │    │  (src/docprocessor/)   │ │
│  └──────────────────┘    └────────┬───────────────┘ │
│           │                        │                  │
│  ┌────────┴────────────────────────┴──────────────┐ │
│  │          HTTP Server (src/server.ts)            │ │
│  │  /api/build, /api/graph  │  /api/docproc/*     │ │
│  └──────────┬──────────────┬─────────────────────┘ │
│             │              │                        │
│  ┌──────────┴──┐   ┌──────┴───────────────────┐   │
│  │ index.html  │   │ docprocessor.html (NEW)   │   │
│  └─────────────┘   └──────────────────────────┘   │
│             │              │                        │
│  ┌──────────┴──────────────┴──────────────────┐   │
│  │    Tauri Desktop Shell (src-tauri/)         │   │
│  │    Menu: File | Tools | Help                │   │
│  │    Window: main | docprocessor (NEW)        │   │
│  └─────────────┬──────────────────────────────┘   │
│                │                                    │
│  ┌─────────────┴──────────────────────────────┐   │
│  │    Godot Path Mode (WebSocket Bridge)       │   │
│  │    Button: "Doc Processor" (NEW)            │   │
│  └────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### New Backend Modules

| Module | Purpose |
|---|---|
| `types.ts` | Settings/interfaces without Obsidian types |
| `constants.ts` | Default configuration values |
| `LlmProvider.ts` | Unified LLM client for 10 providers |
| `PromptManager.ts` | Template engine for 7 task prompts |
| `FileProcessor.ts` | Core file processing pipeline |
| `MermaidProcessor.ts` | Mermaid syntax fixing (pure string) |
| `FormulaFixer.ts` | LaTeX delimiter normalization |
| `Translator.ts` | File/folder translation with batching |
| `BatchProcessor.ts` | Concurrent batch operations |
| `ContentGenerator.ts` | Title-based content generation |
| `DuplicateDetector.ts` | Duplicate detection |
| `index.ts` | Barrel exports |

### HTTP API Endpoints

12 new endpoints under `/api/docproc/`:
- `GET/PUT /settings` — Configuration management
- `POST /process-file` — Single file processing (SSE)
- `POST /process-folder` — Batch processing (SSE)
- `POST /test-llm` — Provider connection test
- `POST /generate-content` — Content generation from title
- `POST /translate-file` — Single file translation
- `POST /translate-folder` — Batch translation
- `POST /fix-mermaid` — Mermaid syntax repair
- `POST /fix-formulas` — Formula format repair
- `POST /check-duplicates` — Duplicate detection
- `POST /extract-concepts` — Concept extraction
- `POST /cancel` — Cancel running operation

### Tauri Integration

1. New "Tools" menu with "Document Processing" (Ctrl+D)
2. New Tauri window (`docprocessor`) opened on demand
3. `open_docprocessor` IPC command
4. Automatic cleanup on main window close (no residual windows)

### Godot Integration

1. WebSocket bridge message: `open_docprocessor`
2. UI button in frontend for Godot-triggered access

### Window Lifecycle

- Doc processor window is a secondary Tauri WebView
- When main window closes → `on_window_event(CloseRequested)` fires → `shutdown_child_processes()` kills sidecar/Godot → all windows destroyed
- Doc processor window can be independently closed without affecting main app
- No orphan processes possible

## Feasibility Assessment

| Aspect | Assessment | Risk |
|---|---|---|
| Obsidian API Replacement | All APIs have direct Node.js equivalents | **Low** |
| LLM Provider Integration | Pure HTTP calls, no platform dependency | **Low** |
| Mermaid/Formula Fixing | Pure string manipulation, zero deps | **None** |
| Tauri Window Management | Built-in `WebviewWindowBuilder` API | **Low** |
| Godot Bridge Extension | Existing WebSocket protocol supports new message types | **Low** |
| Performance (batching) | Node.js `worker_threads` available if needed | **Low** |
| Security (API keys) | File-based config, not exposed in IPC | **Medium** — needs secure storage consideration |

## Risks and Mitigations

1. **API Key Security**: Store keys in `docproc_config.json` with file-system permissions. Future: integrate with OS keychain.
2. **Memory for Large Files**: Use streaming/chunking (already implemented in plugin). Monitor with `--max-old-space-size`.
3. **Concurrent API Limits**: Semaphore-based batching already implemented. Configurable concurrency and interval.

---

# 文档处理迁移 — 分析与方案 (中文)

## 背景

**obsidian-NoteMD_new** 插件在 Obsidian 中提供基于 LLM 的文档处理功能。本文档概述了将其核心功能迁移至 **NoteConnection** 项目的方案，作为独立的平台无关模块。

## 源插件分析

### 核心能力（15个模块，约6000行代码）

| 模块 | 功能 |
|---|---|
| `llmUtils.ts` | 10种 LLM 提供商集成（OpenAI、Anthropic、Google、Mistral、DeepSeek、Ollama、LMStudio、OpenRouter、Azure、自定义），含重试与错误处理 |
| `fileUtils.ts` | 核心文件处理：Wiki链接注入、概念提取、重复检测、基于标题的内容生成 |
| `mermaidProcessor.ts` | 30+ 基于正则的 Mermaid 图表语法修复器 |
| `promptUtils.ts` | 7种任务提示模板，支持变量替换和聚焦学习领域注入 |
| `translate.ts` | 文件/文件夹翻译，支持分块和并发处理 |
| `searchUtils.ts` | 网络搜索集成，用于研究驱动的内容生成 |
| `utils.ts` | 并发原语（信号量）、内容分块、提供商/模型选择 |
| `types.ts` / `constants.ts` | 设置接口和默认值 |
| `formulaFixer.ts` | LaTeX 分隔符规范化 |
| `extractOriginalText.ts` | 参考内容提取与映射 |

### Obsidian API 依赖

插件深度依赖 Obsidian 内部 API：
- **文件 I/O**：`app.vault.read()`、`app.vault.create()`、`app.vault.modify()`、`app.vault.createFolder()`
- **HTTP**：`requestUrl()`（Obsidian 内建 HTTP 客户端）
- **UI**：`Notice`、`ProgressModal`、`WorkspaceLeaf`
- **类型系统**：`TFile`、`TFolder`、`App`

## 迁移架构

### 设计原则

1. **完全解耦**：零 Obsidian 依赖。所有 API 替换为 Node.js 等价物（`fs`、`fetch`）。
2. **纯增量**：不修改或移除任何现有 NoteConnection 功能。文档处理器是全新模块。
3. **前后端分离**：业务逻辑在 `src/docprocessor/`（Node.js），UI在 `src/frontend/docprocessor.html`（原生 JS）。
4. **跨平台访问**：通过 HTTP API 和 IPC，可从浏览器、Tauri 桌面和 Godot 窗口访问。

### 系统架构

```
┌─────────────────────────────────────────────────────┐
│                   NoteConnection                     │
│                                                      │
│  ┌──────────────────┐    ┌────────────────────────┐ │
│  │  现有图谱引擎     │    │  新增：文档处理器       │ │
│  │  + 服务器         │    │  后端模块              │ │
│  │  （不变）          │    │  (src/docprocessor/)   │ │
│  └──────────────────┘    └────────┬───────────────┘ │
│           │                        │                  │
│  ┌────────┴────────────────────────┴──────────────┐ │
│  │          HTTP 服务器 (src/server.ts)            │ │
│  │  /api/build, /api/graph  │  /api/docproc/*     │ │
│  └──────────┬──────────────┬─────────────────────┘ │
│             │              │                        │
│  ┌──────────┴──┐   ┌──────┴───────────────────┐   │
│  │ index.html  │   │ docprocessor.html (新增)  │   │
│  └─────────────┘   └──────────────────────────┘   │
│             │              │                        │
│  ┌──────────┴──────────────┴──────────────────┐   │
│  │    Tauri 桌面壳 (src-tauri/)                │   │
│  │    菜单: 文件 | 工具 | 帮助                  │   │
│  │    窗口: 主窗口 | docprocessor (新增)        │   │
│  └─────────────┬──────────────────────────────┘   │
│                │                                    │
│  ┌─────────────┴──────────────────────────────┐   │
│  │    Godot 路径模式 (WebSocket 桥接)          │   │
│  │    按钮: "文档处理" (新增)                   │   │
│  └────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 新后端模块

| 模块 | 用途 |
|---|---|
| `types.ts` | 剔除 Obsidian 类型的设置/接口 |
| `constants.ts` | 默认配置值 |
| `LlmProvider.ts` | 统一 LLM 客户端（10个提供商） |
| `PromptManager.ts` | 7种任务提示的模板引擎 |
| `FileProcessor.ts` | 核心文件处理流水线 |
| `MermaidProcessor.ts` | Mermaid 语法修复（纯字符串） |
| `FormulaFixer.ts` | LaTeX 分隔符规范化 |
| `Translator.ts` | 文件/文件夹翻译（支持批量） |
| `BatchProcessor.ts` | 并发批处理操作 |
| `ContentGenerator.ts` | 基于标题的内容生成 |
| `DuplicateDetector.ts` | 重复检测 |
| `index.ts` | 桶导出 |

### HTTP API 端点

`/api/docproc/` 下新增12个端点：
- `GET/PUT /settings` — 配置管理
- `POST /process-file` — 单文件处理(SSE)
- `POST /process-folder` — 批量处理(SSE)
- `POST /test-llm` — 提供商连接测试
- `POST /generate-content` — 基于标题生成内容
- `POST /translate-file` — 单文件翻译
- `POST /translate-folder` — 批量翻译
- `POST /fix-mermaid` — Mermaid 语法修复
- `POST /fix-formulas` — 公式格式修复
- `POST /check-duplicates` — 重复检测
- `POST /extract-concepts` — 概念提取
- `POST /cancel` — 取消运行中的操作

### Tauri 集成

1. 新增"工具"菜单，含"文档处理"选项（Ctrl+D）
2. 按需打开新 Tauri 窗口（`docprocessor`）
3. `open_docprocessor` IPC 命令
4. 主窗口关闭时自动清理（无残留窗口）

### Godot 集成

1. WebSocket 桥接消息：`open_docprocessor`
2. 前端 UI 按钮，用于 Godot 触发访问

### 窗口生命周期

- 文档处理窗口是辅助 Tauri WebView
- 主窗口关闭时 → 触发 `on_window_event(CloseRequested)` → `shutdown_child_processes()` 终止 sidecar/Godot → 所有窗口销毁
- 文档处理窗口可独立关闭，不影响主应用
- 不可能产生孤儿进程

## 可行性评估

| 方面 | 评估 | 风险 |
|---|---|---|
| Obsidian API 替换 | 所有API都有直接的 Node.js 等价物 | **低** |
| LLM 提供商集成 | 纯 HTTP 调用，无平台依赖 | **低** |
| Mermaid/公式修复 | 纯字符串操作，零依赖 | **无** |
| Tauri 窗口管理 | 内建 `WebviewWindowBuilder` API | **低** |
| Godot 桥接扩展 | 现有 WebSocket 协议支持新消息类型 | **低** |
| 性能（批处理） | 如需可使用 Node.js `worker_threads` | **低** |
| 安全性（API 密钥） | 基于文件配置，不在 IPC 中暴露 | **中** — 需考虑安全存储 |

## 风险与应对

1. **API 密钥安全**：密钥存于 `docproc_config.json`，依赖文件系统权限控制。未来：集成 OS 钥匙串。
2. **大文件内存**：使用流式/分块处理（插件已实现）。通过 `--max-old-space-size` 监控。
3. **并发 API 限制**：已实现基于信号量的批处理。并发数和间隔可配置。
