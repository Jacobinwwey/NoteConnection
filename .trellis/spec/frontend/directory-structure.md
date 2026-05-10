# Directory Structure

> How frontend code is organized in this project.

---

## Overview

The frontend is a static vanilla JS application (no React, Vue, or framework). It uses Web Workers for heavy computation (D3 force simulation, graph rendering, keyword matching). Localization is handled by `I18nManager` with JSON locale files.

---

## Directory Layout

```
src/frontend/
├── index.html              # Main app shell (reader + graph + dock panels)
├── help.html               # Help page
├── manual.html              # Manual page
├── notemd.html              # Note-md editor shell
├── app.js                   # Main app controller (graph visualization, D3, load lifecycle)
├── app_highlight_integration.js  # Text highlight integration
├── path_app.js              # "Future Path" learning mode controller
├── agent_workspace.js       # Agent conversation contract (operation config, payload builders)
├── agent_workspace_runtime.js   # Agent workspace runtime (DOM rendering, diag state, capability execution)
├── analysis.js              # Graph analysis dashboard
├── layout_gpu.js            # GPU-accelerated layout (GPU.js)
├── loading.js               # Loading / progress UI
├── language_selector.js     # Language toggle widget
├── nodeHighlight.js         # Node highlight behavior
├── i18n.js                  # I18nManager class (locale loading, string lookup)
├── native_clipboard.ts      # Clipboard bridge (TS compiled to JS)
├── path_worker.js           # Web Worker: D3 force simulation for path mode
├── graph_worker.js          # Web Worker: graph data processing
├── path_core.js             # Bundled path core (from scripts/bundle_path_core.js)
├── reader_renderer.js       # Markdown reader/renderer (generated)
├── styles.css               # Main app styles
├── path_styles.css           # Path mode styles
├── notemd.css               # Note-md editor styles
├── data.js                  # Knowledge graph dataset (excluded in "mini" builds)
├── graph_data.json          # Large graph payload (excluded in "mini" builds)
├── libs/                    # Vendored third-party libraries
│   ├── d3.v7.min.js
│   ├── mermaid.min.js
│   ├── marked.min.js
│   ├── jszip.min.js
│   ├── gpu-browser.min.js
│   └── katex/
└── locales/                 # Bilingual locale files
    ├── en.json
    └── zh.json
```

---

## Module Organization

- **Shell pages**: `*.html` files are standalone entry points. Each loads its own JS.
- **Controllers**: `app.js` (graph viewer), `path_app.js` (learning mode), `agent_workspace.js` + `agent_workspace_runtime.js` (conversation workspace).
- **Workers**: `path_worker.js`, `graph_worker.js` — dedicated Web Workers for expensive computation.
- **Libraries**: Vendored in `libs/` — no npm-based frontend bundler.
- **Locale files**: JSON key-value pairs in `locales/`. Keys are English strings; values are translated.

---

## Naming Conventions

- **Files**: `snake_case.js` for modules, `kebab-case.html` for pages.
- **Functions**: `camelCase` (e.g., `buildKnowledgeOperationRequestPayload`, `resolveCapabilityMessage`).
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `BODY_CLASS_PATH_VISIBLE`, `PATH_DOCK_CLASS`).
- **DOM classes**: kebab-case in CSS, referenced via `UPPER_SNAKE_CASE` constants in JS.

---

## Examples

- Well-organized module: `src/frontend/agent_workspace.js` — operation config, payload builders, contract validation, all in one coherent file.
- Well-organized worker: `src/frontend/path_worker.js` — self-contained D3 simulation off the main thread.
- Locale reference: `src/frontend/locales/en.json` — flat key-value with bilingual coverage for all UI strings.
