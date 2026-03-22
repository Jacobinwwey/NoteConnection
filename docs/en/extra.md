# NoteMD Migration — Analysis, Plan & Task Checklist

> **NoteMD** — [GitHub](https://github.com/Jacobinwwey/obsidian-NotEMD) ⭐ Star us on GitHub!

## Background

The **obsidian-NoteMD_new** plugin provides LLM-powered document processing capabilities within Obsidian. This document outlines the plan to migrate its core functionality into the **NoteConnection** project as a standalone, platform-independent module branded as **NoteMD**.

---

## 🚀 The One-Click Batch Pipeline (Advanced Orchestration)

A critical feature of the original plugin is the **One-Click Batch Processing Pipeline** (`extract-concepts-and-generate-titles` / `batch-generate-content-from-titles`). This pipeline automates the transformation of unstructured notes into a fully linked knowledge graph.

### Pipeline Workflow

1. **Phase 1: Process (Wiki-Link & Extract)**
   - Scans existing Markdown files.
   - LLM reads content and injects `[[wiki-links]]`.
   - Extracts core concepts and creates **blank concept notes** (e.g., `[[Machine Learning.md]]`).
2. **Phase 2: Generate (Fill Blanks)**
   - Scans the designated output folder for the newly created blank concept notes.
   - Uses the note title (e.g., "Machine Learning") to generate comprehensive content via LLM (with optional web search).
3. **Phase 3: Fix (Mermaid Auto-Repair)**
   - If `autoMermaidFixAfterGenerate` is enabled, the system automatically runs the Mermaid syntax repair module on the generated files to ensure diagrams render correctly.

### Robustness & Safety Mechanisms

To migrate this pipeline to NoteConnection robustly, the following mechanisms are required:

- **Pre-flight Configuration Check:** Before starting the pipeline, the system must verify:
  - Active LLM provider and API key exist.
  - Source and destination folders are valid and accessible.
  - Base prompts are defined.
- **Token Consumption Warning:** This pipeline is recursive and highly token-intensive. A mandatory warning dialog must display the estimated file count and prompt the user to acknowledge the potential API cost before proceeding.
- **Global Mutex (`isBusy` lock):** Prevent concurrent pipeline executions that could cause file locks or rate limit exhaustion.
- **Fail-Safe Checkpoints:** If Phase 2 fails due to network error, the system must log the exact file it failed on, allowing the user to resume the batch generation later without re-processing Phase 1.

---

## Source Plugin Analysis

### Core Capabilities (15 Modules, ~6000 Lines)

| Module | Capability |
|---|---|
| `llmUtils.ts` | 10 LLM provider integrations with retry logic and error handling |
| `fileUtils.ts` | Core file processing: wiki-link injection, concept extraction, duplicate detection |
| `mermaidProcessor.ts` | 30+ regex-based Mermaid diagram syntax fixers |
| `promptUtils.ts` | 7 task prompt templates with variable substitution |
| `translate.ts` | File/folder translation with chunking and concurrent processing |
| `searchUtils.ts` | Web search provider integration for research-backed content |
| `utils.ts` | Concurrency primitives (Semaphore), content chunking |
| `types.ts` / `constants.ts` | Settings interfaces and defaults |
| `formulaFixer.ts` | LaTeX delimiter normalization |
| `extractOriginalText.ts` | Reference content extraction and mapping |

### Obsidian API Dependencies

The plugin relies heavily on Obsidian's internal APIs:
- **File I/O**: `app.vault.read()`, `app.vault.createFolder()` -> **Migrate to**: `node:fs`
- **HTTP**: `requestUrl()` -> **Migrate to**: `fetch()`
- **UI**: `Notice`, `WorkspaceLeaf` -> **Migrate to**: SSE + Custom Frontend Notifications

---

## Migration Architecture

### Design Principles

1. **Complete Decoupling**: Zero Obsidian dependencies.
2. **Additive-Only**: No existing NoteConnection functionality is modified. NoteMD is an entirely new module.
3. **Backend-Frontend Separation**: Business logic in `src/notemd/` (Node.js), UI in `src/frontend/notemd.html`.
4. **Cross-Platform Access**: Accessible from browser, Tauri desktop, and Godot window via IPC/WebSocket.

### System Architecture

```text
┌─────────────────────────────────────────────────────┐
│                   NoteConnection                     │
│  ┌──────────────────┐    ┌────────────────────────┐ │
│  │  Existing Graph   │    │  NEW: NoteMD           │ │
│  │  Engine + Server  │    │  Backend Modules       │ │
│  └──────────────────┘    └────────┬───────────────┘ │
│           │                        │                  │
│  ┌────────┴────────────────────────┴──────────────┐ │
│  │          HTTP Server (src/server.ts)            │ │
│  │  /api/build, /api/graph  │  /api/notemd/*      │ │
│  └──────────┬──────────────┬─────────────────────┘ │
│             │              │                        │
│  ┌──────────┴──┐   ┌──────┴───────────────────┐   │
│  │ index.html  │   │ notemd.html (NEW)         │   │
│  └─────────────┘   └──────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Backend: `src/notemd/` (13 new files)

- `types.ts` / `constants.ts` — Settings and defaults.
- `LlmProvider.ts` — Unified LLM client (OpenAI, DeepSeek, Anthropic, etc.).
- `PromptManager.ts` — 7 task prompt templates.
- `FileProcessor.ts` — Core chunked LLM processing layer.
- `MermaidProcessor.ts` / `FormulaFixer.ts` — Syntax repair layers.
- `Translator.ts` — Batch translation.
- `BatchProcessor.ts` — Concurrency queues.
- `DuplicateDetector.ts` — Word/concept duplicate detection.
- `ContentGenerator.ts` — Title-based generation.
- **`PipelineOrchestrator.ts`** *(NEW)* — Manages the One-Click Batch Pipeline, pre-flight checks, and mutex locks.
- `index.ts` — Barrel exports.

### HTTP API: `/api/notemd/*` (13 endpoints)

| Endpoint | Method | Purpose |
|---|---|---|
| `/settings` | GET/PUT | Read/write NoteMD config |
| `/process-file` | POST | Process single file (SSE) |
| `/process-folder` | POST | Batch process folder (SSE) |
| `/generate-content` | POST | Generate from title |
| `/fix-mermaid` / `/fix-formulas` | POST | Syntax repair |
| `/check-duplicates` | POST | Duplicate detection |
| `/cancel` | POST | Cancel running operation |
| `/pipeline/one-click` | POST | **Run the full One-Click Batch Pipeline** |
| `/pipeline/preflight` | POST | **Run pre-flight configuration checks** |

### Frontend: `notemd.html`

Standalone page with dark-theme premium UI:
- **Quick Actions Bar**: Prominent "One-Click Pipeline" button.
- **Operation Cards**: Individual manual tasks.
- **Settings Panel**: API keys and prompt tuning.
- **Progress View**: Granular SSE event stream for batch visibility.

### Integrations

- **Tauri**: New "Tools" menu -> "NoteMD" (opens separate WebView window).
- **Godot**: WebSocket bridge message `open_notemd` to trigger UI on demand.

---

## Task Checklist

### Phase 1: Planning & Analysis
- [x] Analyze `obsidian-NoteMD_new` plugin code
- [x] Analyze NoteConnection architecture & dependencies
- [x] Document the One-Click Pipeline workflow
- [x] User review and approval

### Phase 2: Backend Core Modules (`src/notemd/`)
- [ ] Create `types.ts` & `constants.ts`
- [ ] Create `LlmProvider.ts` & `PromptManager.ts`
- [ ] Create `FileProcessor.ts` & `ContentGenerator.ts`
- [ ] Create `MermaidProcessor.ts` & `FormulaFixer.ts`
- [ ] Create `PipelineOrchestrator.ts` (One-Click Pipeline)
- [ ] Create `Translator.ts`, `DuplicateDetector.ts`, `BatchProcessor.ts`

### Phase 3: HTTP API Layer
- [ ] Add `/api/notemd/*` endpoints to `server.ts`
- [ ] Implement robust SSE stream handler for progress
- [ ] Add settings persistence

### Phase 4: Frontend UI
- [ ] Create `notemd.html` (Premium dark UI)
- [ ] Implement One-Click Pipeline validation & Token warning dialogs
- [ ] Integrate into `index.html` navigation

### Phase 5: Tauri & Godot Integration
- [ ] Update Tauri `build_menu()` & IPC commands
- [ ] Update PathBridge WebSocket protocol

### Phase 6: Testing & Documentation
- [ ] Write integration test for the One-Click Pipeline
- [ ] Update main README & TODO.md
