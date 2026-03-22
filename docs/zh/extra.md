# NoteMD 迁移 — 分析、方案与任务清单

> **NoteMD** — [GitHub](https://github.com/Jacobinwwey/obsidian-NotEMD) ⭐ 欢迎在 GitHub 上给我们 Star！

## 背景

**obsidian-NoteMD_new** 插件在 Obsidian 中提供基于 LLM 的文档处理功能。本文档概述了将其核心功能迁移至 **NoteConnection** 项目的方案，作为独立的平台无关模块，品牌命名为 **NoteMD**。

---

## 源插件分析

### 核心能力（15个模块，约6000行代码）

| 模块 | 功能 |
|---|---|
| `llmUtils.ts` | 10种 LLM 提供商集成（OpenAI、Anthropic、Google、Mistral、DeepSeek、Ollama、LMStudio、OpenRouter、Azure、xAI），含重试与错误处理 |
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

---

## 迁移架构

### 设计原则

1. **完全解耦**：零 Obsidian 依赖。所有 API 替换为 Node.js 等价物（`fs`、`fetch`）。
2. **纯增量**：不修改或移除任何现有 NoteConnection 功能。NoteMD 是全新模块。
3. **前后端分离**：业务逻辑在 `src/notemd/`（Node.js），UI 在 `src/frontend/notemd.html`（原生 JS）。
4. **跨平台访问**：通过 HTTP API 和 IPC，可从浏览器、Tauri 桌面和 Godot 窗口访问。

### 系统架构

```
┌─────────────────────────────────────────────────────┐
│                   NoteConnection                     │
│                                                      │
│  ┌──────────────────┐    ┌────────────────────────┐ │
│  │  现有图谱引擎     │    │  新增：NoteMD          │ │
│  │  + 服务器         │    │  后端模块              │ │
│  │  （不变）          │    │  (src/notemd/)         │ │
│  └──────────────────┘    └────────┬───────────────┘ │
│           │                        │                  │
│  ┌────────┴────────────────────────┴──────────────┐ │
│  │          HTTP 服务器 (src/server.ts)            │ │
│  │  /api/build, /api/graph  │  /api/notemd/*      │ │
│  └──────────┬──────────────┬─────────────────────┘ │
│             │              │                        │
│  ┌──────────┴──┐   ┌──────┴───────────────────┐   │
│  │ index.html  │   │ notemd.html（新增）       │   │
│  └─────────────┘   └──────────────────────────┘   │
│             │              │                        │
│  ┌──────────┴──────────────┴──────────────────┐   │
│  │    Tauri 桌面壳 (src-tauri/)                │   │
│  │    菜单: 文件 | 工具 | 帮助                  │   │
│  │    窗口: 主窗口 | notemd（新增）             │   │
│  └─────────────┬──────────────────────────────┘   │
│                │                                    │
│  ┌─────────────┴──────────────────────────────┐   │
│  │    Godot 路径模式（WebSocket 桥接）          │   │
│  │    按钮: "NoteMD"（新增）                    │   │
│  └────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 实施方案

### 后端：`src/notemd/`（12个新文件）

| 文件 | 用途 |
|---|---|
| `types.ts` | `NotemdSettings`、`TaskKey`、`ProgressReporter`、错误类 |
| `constants.ts` | `DEFAULT_SETTINGS`，含10个 LLM 提供商 |
| `LlmProvider.ts` | 统一 LLM 客户端（OpenAI/Anthropic/Google/Mistral/DeepSeek/Ollama/LMStudio/OpenRouter/Azure/xAI） |
| `PromptManager.ts` | 7种任务提示模板，支持变量替换 |
| `FileProcessor.ts` | 核心：Wiki链接注入、概念提取、分块 LLM 处理 |
| `MermaidProcessor.ts` | 30+ Mermaid 语法修复器（纯字符串） |
| `FormulaFixer.ts` | LaTeX 分隔符规范化 |
| `Translator.ts` | 文件/文件夹翻译（支持批量） |
| `BatchProcessor.ts` | 基于信号量的并发批处理操作 |
| `DuplicateDetector.ts` | 重复词/概念检测 |
| `ContentGenerator.ts` | 基于标题的内容生成（可选网络研究） |
| `index.ts` | 桶导出 |

### API 替换对照

| Obsidian API | 替换方案 |
|---|---|
| `app.vault.read(file)` | `fs.promises.readFile(path, 'utf-8')` |
| `app.vault.create(path, content)` | `fs.promises.writeFile(path, content)` |
| `app.vault.modify(file, content)` | `fs.promises.writeFile(path, content)` |
| `app.vault.createFolder(path)` | `fs.promises.mkdir(path, { recursive: true })` |
| `new Notice(msg)` | SSE 事件 / HTTP 响应消息 |
| `requestUrl(options)` | `fetch()` / `https.request()` |
| `TFile` / `TFolder` | `string` 路径 |

### HTTP API：`/api/notemd/*`（12个端点）

| 端点 | 方法 | 用途 |
|---|---|---|
| `/api/notemd/settings` | GET/PUT | 读写 NoteMD 配置 |
| `/api/notemd/process-file` | POST | 处理单个文件（SSE） |
| `/api/notemd/process-folder` | POST | 批量处理文件夹（SSE） |
| `/api/notemd/test-llm` | POST | 测试 LLM 连接 |
| `/api/notemd/generate-content` | POST | 基于标题生成内容 |
| `/api/notemd/translate-file` | POST | 翻译单个文件 |
| `/api/notemd/translate-folder` | POST | 批量翻译 |
| `/api/notemd/fix-mermaid` | POST | 修复 Mermaid 语法 |
| `/api/notemd/fix-formulas` | POST | 修复公式格式 |
| `/api/notemd/check-duplicates` | POST | 重复检测 |
| `/api/notemd/extract-concepts` | POST | 概念提取 |
| `/api/notemd/cancel` | POST | 取消运行中的操作 |

### 一键批处理流水线 (One-Click Batch Pipeline)

原 Obsidian 插件具有高效的“一键”流水线（`extract-concepts-and-generate-titles` 命令），我们将作为专属按钮在 NoteMD UI 中保留此功能。

#### 流水线流程
1. **阶段 1：处理文件/文件夹（`extract-concepts`）**
   - LLM 扫描 Markdown 内容，识别核心概念，并注入 `[[wiki-links]]`。
   - 系统为每个新的 wiki-link 在概念笔记（Concept Note）文件夹中自动创建空白的 Markdown 文件。
2. **阶段 2：生成内容（`batch-generate-content-from-titles`）**
   - 系统扫描概念笔记文件夹中的空白文件。
   - 对于每个空白文件，LLM 仅基于文件名（即概念标题）生成完整的文章内容，并可配置是否使用网络搜索作为辅助上下文。
3. **阶段 3：清理格式（`fix-mermaid`）**
   - 如果开启了 `autoMermaidFixAfterGenerate` 设置，系统将自动对所有新生成的文件运行基于正则的 Mermaid 语法修复器，以纠正 LLM 可能产生的格式错误。

#### 鲁棒性与警告系统
在触发此一键流水线之前，UI 必须执行飞行前检查（Pre-flight check）：
- **配置检查**：确保已选择有效的 LLM 提供商，并且已配置 `conceptNoteFolder` 和 `processedFileFolder` 路径。
- **Token 消耗警告**：显示醒目的模态警告框：*“此操作将处理整个文件夹，提取概念，并生成新文章。这可能会消耗大量的 LLM Token 并需要较长时间。您确定要继续吗？”*
- **可取消性**：流水线必须支持在任何阶段完全中止，通过向下传递给批处理工具的 `AbortController` 实现。

### 前端：`notemd.html`

独立页面，采用深色主题高级 UI：操作卡片、设置面板、SSE 进度显示、文件浏览器。使用 **NoteMD** 品牌名称和 GitHub 链接。

### Tauri 集成

1. **菜单**：新增"工具"子菜单，含"NoteMD..."选项（Ctrl+D）
2. **窗口**：新 Tauri 窗口（`notemd`）指向 `notemd.html`
3. **IPC**：`open_notemd` 命令
4. **清理**：现有 `on_window_event(CloseRequested)` 已处理 — NoteMD 窗口随主窗口自动关闭

### Godot 集成

1. WebSocket 桥接消息：`open_notemd`
2. 前端 `#source-control` 中的"NoteMD"按钮

### 窗口生命周期

- NoteMD 窗口是辅助 Tauri WebView
- 主窗口关闭 → `shutdown_child_processes()` → 所有窗口销毁
- NoteMD 窗口可独立关闭，不影响主应用
- 不可能产生孤儿进程

---

## 可行性评估

| 方面 | 评估 | 风险 |
|---|---|---|
| Obsidian API 替换 | 所有 API 都有直接的 Node.js 等价物 | **低** |
| LLM 提供商集成 | 纯 HTTP 调用，无平台依赖 | **低** |
| Mermaid/公式修复 | 纯字符串操作，零依赖 | **无** |
| Tauri 窗口管理 | 内建 `WebviewWindowBuilder` API | **低** |
| Godot 桥接扩展 | 现有 WebSocket 协议支持新消息类型 | **低** |
| 性能（批处理） | 如需可使用 Node.js `worker_threads` | **低** |
| 安全性（API 密钥） | 基于文件配置，不在 IPC 中暴露 | **中** |

---

## 任务清单

### 阶段一：规划与分析
- [x] 分析 `obsidian-NoteMD_new` 插件代码
- [x] 分析 NoteConnection 项目架构
- [x] 识别需要替换的 Obsidian API 依赖
- [x] 创建实施方案和双语 docs/extra.md
- [x] 用户审核批准

### 阶段二：后端核心模块（`src/notemd/`）
- [x] 创建 `types.ts` — 设置/接口
- [x] 创建 `constants.ts` — 默认设置
- [x] 创建 `LlmProvider.ts` — 抽象 LLM 客户端（10个提供商）
- [x] 创建 `PromptManager.ts` — 提示模板引擎
- [x] 创建 `FileProcessor.ts` — 核心文件处理
- [x] 创建 `MermaidProcessor.ts` — Mermaid 语法修复
- [x] 创建 `FormulaFixer.ts` — LaTeX 公式清理
- [x] 创建 `Translator.ts` — 批量翻译
- [x] 创建 `BatchProcessor.ts` — 并发批处理操作
- [x] 创建 `DuplicateDetector.ts` — 重复检测
- [x] 创建 `ContentGenerator.ts` — 基于标题的内容生成
- [x] 创建 `index.ts` — 桶导出

### 阶段三：HTTP API 层
- [x] 在 `server.ts` 中添加 `/api/notemd/*` 端点
- [x] 接入 SSE 进度上报
- [x] 通过 `notemd_config.json` 添加设置持久化

### 阶段四：前端 UI
- [x] 创建 `notemd.html` — 独立 NoteMD 界面
- [x] 创建 `notemd.css` / `notemd.js` — 样式 + 逻辑
- [x] 在 `index.html` 中集成"NoteMD"按钮

### 阶段五：Tauri 与 Godot 集成
- [x] 在 Tauri `build_menu()` 中添加"NoteMD"菜单项
- [x] 添加 Tauri IPC 命令以打开 NoteMD 窗口
- [x] 添加 Godot WebSocket 桥接消息
- [x] 确保 `CloseRequested` 时的清理

### 阶段六：测试与文档
- [x] 创建单元测试
- [x] 更新 `Interface Document.md`、`README.md`、`TODO.md`
- [x] 更新双语文档
- [x] 创建 `TEST_REPORT.md` 条目

---

## 最佳改进机会（按优先级）

1. **P0 - 端到端可行性验证（已完成）**
   - 已执行 NoteMD 服务集成验证（`src/notemd.server.integration.test.ts`）和全量回归（`54` suites，`270` tests），确认当前代码可工作。
2. **P0 - Tauri 构建锁冲突稳健性（已完成）**
   - 已定位 `cargo check` 失败根因：`src-tauri/target/debug/server.exe` 进程残留导致文件锁定。
   - 已通过 `scripts/cleanup-tauri-sidecars.js` 预清理链路复验 `cargo check` 与 `scripts/run-tauri-tests.js`。
3. **P1 - 双语文档与接口对齐（已完成）**
   - 已同步更新 `docs/en` 与 `docs/zh` 下的 `Interface Document.md`、`README.md`、`TODO.md`、`TEST_REPORT.md`。
4. **P1 - 剩余风险闭环（运维证据待补）**
   - FR-009 仍为真机证据闭环项，严格校验门禁保持生效。

---

## 验证计划

### 自动化测试
```bash
node node_modules/jest/bin/jest.js src/notemd.core.test.ts src/notemd.api.contract.test.ts src/notemd.server.integration.test.ts --runInBand
node node_modules/jest/bin/jest.js --runInBand          # 回归：所有 54 套件通过
node node_modules/typescript/bin/tsc --noEmit           # 零错误
node scripts/run-tauri-tests.js                         # cleanup + rust 合同套件
cargo check --manifest-path src-tauri/Cargo.toml        # 执行前需 sidecar 清理预处理
```

### 手动验证
1. 浏览器：`http://localhost:3000/notemd.html` 正确加载
2. Tauri：工具菜单中"NoteMD"打开窗口
3. 窗口生命周期：关闭时无孤儿窗口
