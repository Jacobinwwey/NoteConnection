# NoteMD 迁移 — 分析、方案与任务清单

> **NoteMD** — [GitHub](https://github.com/Jacobinwwey/obsidian-NotEMD) ⭐ 欢迎在 GitHub 上给我们 Star！

## 背景

**obsidian-NoteMD_new** 插件在 Obsidian 中提供基于 LLM 的文档处理功能。本文档概述了将其核心功能迁移至 **NoteConnection** 项目的方案，作为独立的平台无关模块，品牌命名为 **NoteMD**。

---

## 🚀 一键批处理流水线 (高级编排)

原插件的一个关键特性是 **一键批处理流水线** (`extract-concepts-and-generate-titles` / `batch-generate-content-from-titles`)。该流水线实现了将非结构化笔记自动转化为全链接知识图谱的过程。

### 流水线工作流

1. **阶段一：处理 (注入链接与提取)**
   - 扫描现有 Markdown 文件。
   - LLM 读取内容并注入 `[[wiki-links]]`。
   - 提取核心概念并创建 **空白概念笔记**（如：`[[机器学习.md]]`）。
2. **阶段二：生成 (填补空白)**
   - 扫描指定的输出文件夹，寻找新创建的空白概念笔记。
   - 根据笔记标题（如“机器学习”）调用 LLM 生成详细内容（可选搭配网络搜索增强）。
3. **阶段三：修复 (Mermaid 自动修复)**
   - 若开启 `autoMermaidFixAfterGenerate`，系统将在生成后的文件上自动运行 Mermaid 语法修复模块，确保图表正确渲染。

### 健壮性与安全机制

为确保该流水线稳健地迁移至 NoteConnection，必须实现以下机制：

- **预检配置 (Pre-flight Checks):** 在启动流水线前，系统必须校验：
  - 存在活跃的 LLM 提供商及有效的 API 密钥。
  - 源文件夹与目标文件夹路径有效且可读写。
  - 基础提示词模板已定义。
- **Token 消耗警告:** 该流水线具有递归性质，极其消耗 Token。系统必须显示强制警告对话框，预估处理文件数量，并要求用户在继续前确认潜在的 API 费用。
- **全局互斥锁 (`isBusy` Mutex):** 防止流水线并发执行，避免引发文件锁定冲​​突或 API 限流耗尽。
- **故障安全检查点 (Fail-Safe Checkpoints):** 如果阶段二因网络原因中断，系统必须记录确切失败的文件名，允许用户后续直接恢复批处理生成，而无需重新执行阶段一。

---

## 源插件分析

### 核心能力（15个模块，约6000行代码）

| 模块 | 功能 |
|---|---|
| `llmUtils.ts` | 10种 LLM 提供商集成，含重试与错误处理 |
| `fileUtils.ts` | 核心文件处理：Wiki链接注入、概念提取、重复检测 |
| `mermaidProcessor.ts` | 30+ 基于正则的 Mermaid 图表语法修复器 |
| `promptUtils.ts` | 7种任务提示模板，支持变量替换 |
| `translate.ts` | 文件/文件夹翻译，支持分块和并发处理 |
| `searchUtils.ts` | 网络搜索集成，用于研究驱动的内容生成 |
| `utils.ts` | 并发原语（信号量）、内容分块 |
| `types.ts` / `constants.ts` | 设置接口和默认值 |
| `formulaFixer.ts` | LaTeX 分隔符规范化 |
| `extractOriginalText.ts` | 参考内容提取与映射 |

### Obsidian API 依赖

插件深度依赖 Obsidian 内部 API：
- **文件 I/O**：`app.vault.read()`、`app.vault.createFolder()` -> **迁移至**: `node:fs`
- **HTTP**：`requestUrl()` -> **迁移至**: `fetch()`
- **UI**：`Notice`、`WorkspaceLeaf` -> **迁移至**: SSE 事件流 + 自定义前端通知

---

## 迁移架构

### 设计原则

1. **完全解耦**：零 Obsidian 依赖。
2. **纯增量**：不修改现有 NoteConnection 功能。NoteMD 是全新独立模块。
3. **前后端分离**：业务逻辑在 `src/notemd/`（Node.js），UI 在 `src/frontend/notemd.html`。
4. **跨平台访问**：通过 IPC/WebSocket，可从浏览器、Tauri 桌面和 Godot 窗口访问。

### 系统架构

```text
┌─────────────────────────────────────────────────────┐
│                   NoteConnection                     │
│  ┌──────────────────┐    ┌────────────────────────┐ │
│  │  现有图谱引擎     │    │  新增：NoteMD          │ │
│  │  + 服务器         │    │  后端模块              │ │
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
└─────────────────────────────────────────────────────┘
```

---

## 实施方案

### 后端：`src/notemd/`（13个新文件）

- `types.ts` / `constants.ts` — 设置和默认值。
- `LlmProvider.ts` — 统一 LLM 客户端（OpenAI, DeepSeek等）。
- `PromptManager.ts` — 7种任务提示模板引擎。
- `FileProcessor.ts` / `ContentGenerator.ts` — 核心生成逻辑。
- `MermaidProcessor.ts` / `FormulaFixer.ts` — 语法修复层。
- **`PipelineOrchestrator.ts`** *(新)* — 管理一键批处理流水线、预检配置及互斥锁。
- `Translator.ts`, `BatchProcessor.ts`, `DuplicateDetector.ts` — 实用工具。
- `index.ts` — 桶导出。

### HTTP API：`/api/notemd/*`（13个端点）

| 端点 | 方法 | 用途 |
|---|---|---|
| `/settings` | GET/PUT | 读写 NoteMD 配置 |
| `/process-file` | POST | 处理单个文件（SSE） |
| `/process-folder` | POST | 批量处理文件夹（SSE） |
| `/generate-content` | POST | 基于标题生成内容 |
| `/fix-mermaid` / `/fix-formulas` | POST | 语法修复 |
| `/check-duplicates` | POST | 重复检测 |
| `/cancel` | POST | 取消操作 |
| `/pipeline/one-click` | POST | **运行完整的一键批处理流水线** |
| `/pipeline/preflight` | POST | **执行配置连通性及合法性预检** |

### 前端：`notemd.html`

独立高级深色 UI 界面：
- **快捷操作栏**: 醒目的"一键流水线"按钮。
- **独立操作卡片**: 手动执行单个任务。
- **设置面板**: API 密钥及提示词微调。
- **进度视图**: 细粒度 SSE 事件流展现批处理进度。

### 系统集成

- **Tauri**: 新增"工具"菜单 -> "NoteMD"（弹出独立 WebView 窗口）。
- **Godot**: WebSocket 桥接消息 `open_notemd` 按需触发 UI。

---

## 任务清单

### 阶段一：规划与分析
- [x] 分析 `obsidian-NoteMD_new` 插件代码
- [x] 分析 NoteConnection 架构并映射依赖
- [x] 撰写一键批处理流水线详尽分析与方案
- [x] 用户审核批准

### 阶段二：后端核心模块（`src/notemd/`）
- [ ] 创建 `types.ts` & `constants.ts`
- [ ] 创建 `LlmProvider.ts` & `PromptManager.ts`
- [ ] 创建 `FileProcessor.ts` & `ContentGenerator.ts`
- [ ] 创建 `MermaidProcessor.ts` & `FormulaFixer.ts`
- [ ] 创建 `PipelineOrchestrator.ts` (一键流水线核心)
- [ ] 创建 `Translator.ts`, `DuplicateDetector.ts`, `BatchProcessor.ts`

### 阶段三：HTTP API 层
- [ ] 添加 `/api/notemd/*` 端点
- [ ] 实现稳健的 SSE 事件流进度响应
- [ ] 增加 JSON 设置持久化

### 阶段四：前端 UI
- [ ] 搭建 `notemd.html` (高级深色组件)
- [ ] 实现"一键流水线" Token 消耗警告及预校验机制
- [ ] 与 `index.html` 的导航按钮集成

### 阶段五：系统集成
- [ ] Tauri 菜单栏更新及 IPC 调用
- [ ] PathBridge WebSocket 协议扩展

### 阶段六：测试与文档
- [ ] 针对一键批处理流水线编写集成测试
- [ ] 更新 README 与 TODO，同步开发进度
