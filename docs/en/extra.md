# NoteMD Migration — Analysis, Plan & Task Checklist

> **NoteMD** — [GitHub](https://github.com/Jacobinwwey/obsidian-NotEMD) ⭐ Star us on GitHub!

## Background

The **obsidian-NoteMD_new** plugin provides LLM-powered document processing capabilities within Obsidian. This document outlines the plan to migrate its core functionality into the **NoteConnection** project as a standalone, platform-independent module branded as **NoteMD**.

---

## Source Plugin Analysis

### Core Capabilities (15 Modules, ~6000 Lines)

| Module | Capability |
|---|---|
| `llmUtils.ts` | 10 LLM provider integrations (OpenAI, Anthropic, Google, Mistral, DeepSeek, Ollama, LMStudio, OpenRouter, Azure, xAI) with retry logic and error handling |
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

---

## Migration Architecture

### Design Principles

1. **Complete Decoupling**: Zero Obsidian dependencies. All APIs replaced with Node.js equivalents (`fs`, `fetch`).
2. **Additive-Only**: No existing NoteConnection functionality is modified or removed. NoteMD is an entirely new module.
3. **Backend-Frontend Separation**: Business logic in `src/notemd/` (Node.js), UI in `src/frontend/notemd.html` (vanilla JS).
4. **Cross-Platform Access**: Accessible from browser, Tauri desktop, and Godot window via HTTP API and IPC.

### System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   NoteConnection                     │
│                                                      │
│  ┌──────────────────┐    ┌────────────────────────┐ │
│  │  Existing Graph   │    │  NEW: NoteMD           │ │
│  │  Engine + Server  │    │  Backend Modules       │ │
│  │  (unchanged)      │    │  (src/notemd/)         │ │
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
│             │              │                        │
│  ┌──────────┴──────────────┴──────────────────┐   │
│  │    Tauri Desktop Shell (src-tauri/)         │   │
│  │    Menu: File | Tools | Help                │   │
│  │    Window: main | notemd (NEW)              │   │
│  └─────────────┬──────────────────────────────┘   │
│                │                                    │
│  ┌─────────────┴──────────────────────────────┐   │
│  │    Godot Path Mode (WebSocket Bridge)       │   │
│  │    Button: "NoteMD" (NEW)                   │   │
│  └────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Backend: `src/notemd/` (12 new files)

| File | Purpose |
|---|---|
| `types.ts` | `NotemdSettings`, `TaskKey`, `ProgressReporter`, error classes |
| `constants.ts` | `DEFAULT_SETTINGS` with 10 LLM providers |
| `LlmProvider.ts` | Unified LLM client (OpenAI/Anthropic/Google/Mistral/DeepSeek/Ollama/LMStudio/OpenRouter/Azure/xAI) |
| `PromptManager.ts` | 7 task prompt templates with variable substitution |
| `FileProcessor.ts` | Core: wiki-link injection, concept extraction, chunked LLM processing |
| `MermaidProcessor.ts` | 30+ Mermaid syntax fixers (pure string) |
| `FormulaFixer.ts` | LaTeX delimiter normalization |
| `Translator.ts` | File/folder translation with batching |
| `BatchProcessor.ts` | Semaphore-based concurrent batch operations |
| `DuplicateDetector.ts` | Duplicate word/concept detection |
| `ContentGenerator.ts` | Title-based content generation with optional web research |
| `index.ts` | Barrel exports |

### API Replacements

| Obsidian API | Replacement |
|---|---|
| `app.vault.read(file)` | `fs.promises.readFile(path, 'utf-8')` |
| `app.vault.create(path, content)` | `fs.promises.writeFile(path, content)` |
| `app.vault.modify(file, content)` | `fs.promises.writeFile(path, content)` |
| `app.vault.createFolder(path)` | `fs.promises.mkdir(path, { recursive: true })` |
| `new Notice(msg)` | SSE event / HTTP response message |
| `requestUrl(options)` | `fetch()` / `https.request()` |
| `TFile` / `TFolder` | `string` paths |

### HTTP API: `/api/notemd/*` (12 endpoints)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/notemd/settings` | GET/PUT | Read/write NoteMD config |
| `/api/notemd/process-file` | POST | Process single file (SSE) |
| `/api/notemd/process-folder` | POST | Batch process folder (SSE) |
| `/api/notemd/test-llm` | POST | Test LLM connection |
| `/api/notemd/generate-content` | POST | Generate from title |
| `/api/notemd/translate-file` | POST | Translate single file |
| `/api/notemd/translate-folder` | POST | Batch translate |
| `/api/notemd/fix-mermaid` | POST | Fix Mermaid syntax |
| `/api/notemd/fix-formulas` | POST | Fix formula format |
| `/api/notemd/check-duplicates` | POST | Duplicate detection |
| `/api/notemd/extract-concepts` | POST | Concept extraction |
| `/api/notemd/cancel` | POST | Cancel running operation |

### One-Click Batch Processing Pipeline

The original Obsidian plugin featured a highly efficient "One-Click" pipeline (`extract-concepts-and-generate-titles` command) which we will preserve as a dedicated button in the NoteMD UI.

#### Pipeline Flow
1. **Phase 1: Process File/Folder (`extract-concepts`)**
   - The LLM scans the markdown content, identifies key concepts, and injects `[[wiki-links]]`.
   - The system automatically creates blank markdown files in the Concept Note folder for each new wiki-link.
2. **Phase 2: Generate Content (`batch-generate-content-from-titles`)**
   - The system scans the Concept Note folder for blank files.
   - For each blank file, the LLM generates full article content based solely on the filename (the concept title), optionally using web research as context.
3. **Phase 3: Cleanup (`fix-mermaid`)**
   - If the `autoMermaidFixAfterGenerate` setting is enabled, the system automatically runs the regex-based Mermaid syntax fixer on all newly generated files to correct any LLM formatting mistakes.

#### Robustness & Warning System
Before triggering this one-click pipeline, the UI must perform a pre-flight check:
- **Configuration Check**: Ensure a valid LLM provider is selected, and both the `conceptNoteFolder` and `processedFileFolder` paths are configured.
- **Token Consumption Warning**: Display a prominent modal warning: *"This operation will process the entire folder, extract concepts, and generate new articles. This may consume a massive amount of LLM tokens and take significant time. Are you sure you wish to proceed?"*
- **Cancellation**: The pipeline must be fully abortable at any stage via the `AbortController` passed down to the batch processing utility.

### Frontend: `notemd.html`

Standalone page with dark-theme premium UI: operation cards, settings panel, SSE progress display, file browser. Branded with **NoteMD** name and GitHub link.

### Tauri Integration

1. **Menu**: New "Tools" (工具) submenu with "NoteMD..." item (Ctrl+D)
2. **Window**: New Tauri window (`notemd`) pointing to `notemd.html`
3. **IPC**: `open_notemd` command
4. **Cleanup**: Existing `on_window_event(CloseRequested)` handles — NoteMD window auto-closes with main window

### Godot Integration

1. WebSocket bridge message: `open_notemd`
2. "NoteMD" button in frontend `#source-control` div

### Window Lifecycle

- NoteMD window is a secondary Tauri WebView
- Main window close → `shutdown_child_processes()` → all windows destroyed
- NoteMD window can be independently closed without affecting main app
- No orphan processes possible

---

## Feasibility Assessment

| Aspect | Assessment | Risk |
|---|---|---|
| Obsidian API Replacement | All APIs have direct Node.js equivalents | **Low** |
| LLM Provider Integration | Pure HTTP calls, no platform dependency | **Low** |
| Mermaid/Formula Fixing | Pure string manipulation, zero deps | **None** |
| Tauri Window Management | Built-in `WebviewWindowBuilder` API | **Low** |
| Godot Bridge Extension | Existing WebSocket protocol supports new types | **Low** |
| Performance (batching) | Node.js `worker_threads` available if needed | **Low** |
| Security (API keys) | File-based config, not exposed in IPC | **Medium** |

---

## Task Checklist

### Phase 1: Planning & Analysis
- [x] Analyze `obsidian-NoteMD_new` plugin code
- [x] Analyze NoteConnection project architecture
- [x] Identify Obsidian API dependencies to replace
- [x] Create implementation plan and bilingual docs/extra.md
- [x] User review and approval

### Phase 2: Backend Core Modules (`src/notemd/`)
- [x] Create `types.ts` — Settings/interfaces
- [x] Create `constants.ts` — Default settings
- [x] Create `LlmProvider.ts` — Abstract LLM client (10 providers)
- [x] Create `PromptManager.ts` — Prompt template engine
- [x] Create `FileProcessor.ts` — Core file processing
- [x] Create `MermaidProcessor.ts` — Mermaid syntax fixing
- [x] Create `FormulaFixer.ts` — LaTeX formula cleanup
- [x] Create `Translator.ts` — Batch translation
- [x] Create `BatchProcessor.ts` — Concurrent batch operations
- [x] Create `DuplicateDetector.ts` — Duplicate detection
- [x] Create `ContentGenerator.ts` — Content generation from titles
- [x] Create `index.ts` — Barrel exports

### Phase 3: HTTP API Layer
- [x] Add `/api/notemd/*` endpoints to `server.ts`
- [x] Wire SSE progress reporting
- [x] Add settings persistence via `notemd_config.json`

### Phase 4: Frontend UI
- [x] Create `notemd.html` — Standalone NoteMD interface
- [x] Create `notemd.css` / `notemd.js` — Styling + logic
- [x] Integrate "NoteMD" button into `index.html`

### Phase 5: Tauri & Godot Integration
- [x] Add "NoteMD" menu item in Tauri `build_menu()`
- [x] Add Tauri IPC command to open NoteMD window
- [x] Add WebSocket bridge message for Godot
- [x] Ensure cleanup on `CloseRequested`

### Phase 6: Testing & Documentation
- [x] Create unit tests
- [x] Update `Interface Document.md`, `README.md`, `TODO.md`
- [x] Update bilingual docs
- [x] Create `TEST_REPORT.md` entry

---

## Best Improvement Opportunities (Prioritized)

1. **P0 - End-to-end feasibility verification (Completed)**
   - Executed NoteMD integration coverage (`src/notemd.server.integration.test.ts`) plus full regression (`54 suites`, `270 tests`) to validate runtime feasibility under current code.
2. **P0 - Tauri build-script lock robustness (Completed)**
   - Root cause of `cargo check` failure was a stale `src-tauri/target/debug/server.exe` process lock.
   - Confirmed robust preflight path by using `scripts/cleanup-tauri-sidecars.js` and re-running `cargo check` / `scripts/run-tauri-tests.js`.
3. **P1 - Bilingual operational documentation parity (Completed)**
   - Updated `Interface Document.md`, `README.md`, `TODO.md`, and `TEST_REPORT.md` in both `docs/en` and `docs/zh`.
4. **P1 - Remaining risk closure (Pending Ops Evidence)**
   - FR-009 is still pending physical-device evidence collection and remains correctly blocked by strict verifier gates.

---

## Verification Plan

### Automated Tests
```bash
node node_modules/jest/bin/jest.js src/notemd.core.test.ts src/notemd.api.contract.test.ts src/notemd.server.integration.test.ts --runInBand
node node_modules/jest/bin/jest.js --runInBand          # regression: all 54 suites pass
node node_modules/typescript/bin/tsc --noEmit           # zero errors
node scripts/run-tauri-tests.js                         # cleanup + rust contract suite
cargo check --manifest-path src-tauri/Cargo.toml        # with sidecar cleanup preflight
```

### Manual Verification
1. Browser: `http://localhost:3000/notemd.html` loads correctly
2. Tauri: "NoteMD" in Tools menu opens window
3. Window lifecycle: no orphan windows on close
