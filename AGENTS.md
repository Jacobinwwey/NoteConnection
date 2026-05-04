# Repository Guidelines

## Project Structure & Module Organization

- `src/`: TypeScript backend + graph/layout core. Main entry points are `src/server.ts` (CLI + HTTP server) and `src/index.ts` (graph build APIs).
  - `src/routes/`: Modular API route handlers (knowledge, notemd, markdown, render, settings, diagnostics, data). Routes are registered via `registerAllRoutes()` and dispatched before the server.ts inline chain.
  - `src/middleware/`: HTTP middleware (CORS, auth, body-parser, request-trace).
  - `src/core/`: Bridging logic (`PathBridge.ts`), graph data structures, path/layout engines.
  - `src/backend/`: Graph construction pipeline, algorithms, workers.
  - `src/learning/`: Knowledge learning platform. `api.ts` defines 31 typed interfaces; `KnowledgeLearningPlatform.ts` implements them. `domains/` contains 7 domain classes (`KnowledgeIngestor`, `KnowledgeQuerier`, `ConversationManager`, `MasteryEngine`, `QualityEvaluator`, `TutorRouter`, `MemoryPolicyManager`) with `*Platform` interfaces for gradual extraction.
  - `src/notemd/`: NoteMD LLM-powered Markdown processing.
  - `src/utils/`: Runtime path resolution (`RuntimePaths.ts`), cross-platform detection (`platform.ts`).
- `src/frontend/`: Static UI (HTML/CSS/vanilla JS + ES modules). Employs Web Workers (`path_worker.js`, `simulationWorker.js`) to offload rendering and physics. Uses Vite for ES module bundling (4 chunks: main, graph-app, agent-workspace, path-mode). Legacy IIFE files (`.js`) coexist with ES module versions (`.mjs`).
- `path_mode/`: Godot 4.3 UI layer (Forward+ Vulkan renderer, GL Compatibility fallback for mobile).
- `src-tauri/`: Tauri v2 (Rust) desktop shell. Platform configs at `tauri.{linux,macos,windows,android}.conf.json`; sidecar binaries at `bin/`.
- `scripts/`: Build helpers (~50 scripts: sidecar build, verification, benchmarking, docs).
- `android/`: Capacitor Android project (deprecated; Tauri Android is the active mobile path).
- `dist/`: Generated build output from `tsc`, `vite build`, and asset bundling.
- `docs/`: Diataxis-framework bilingual docs (EN/ZH). Solutions in `docs/solutions/`, archive in `docs/archive/`.

## Build, Test, and Development Commands

This repo is TypeScript/Node-first integrated with Tauri/Godot. (CI uses Node.js 20).

```bash
npm install            # install dependencies
npm run build          # tsc + copy assets + bundle path_core.js
npm run build:vite     # Vite frontend build (ES module bundling)
npm run build:with-vite # full build (tsc + vite)
npm start              # dev server at http://localhost:3000
npm run dev:vite       # Vite dev server (HMR, proxy to :3000)
npm test               # jest (ts-jest) test runner

npm run tauri:dev      # Tauri dev (runs build + sidecar build)
npm run tauri:build    # Tauri production build + sidecar packaging
npm run build:sidecar  # pkg -> src-tauri/bin/server-{target-triple}
```

Mobile (Tauri Android, recommended):
```bash
npm run tauri:android:init    # first-time setup
npm run tauri:android:dev     # dev build
npm run tauri:android:build   # release APK/AAB
```

## Coding Style & Architectural Conventions

- **Godot Bridge Separation**: Keep heavy algorithmic and mathematical work (like topological sorts or domain learning) inside `src/core/PathEngine.ts`. Godot (`path_mode/`) should only act as a pure render target parsing bridging websocket JSON (`PathBridge.ts`).
- **Memory Safety & Worker Threads**: Never parse massive text strings recursively in UI threads. Favor passing references or ArrayBuffers to Web Workers (see `StatisticalAnalyzer` & `KeywordMatching` optimizations mitigating Heap OOM errors).
- **TypeScript `strict`**: Enabled natively (`tsconfig.json`). Keep public APIs rigorously typed to prevent parsing failures at the IPC/WebSocket boundary.
- **Naming Pattern**: `PascalCase.ts` with matching `PascalCase.test.ts` for modules. Godot prefers standard `snake_case` patterns for GDScript.

## Mermaid Compatibility Baseline (Obsidian)

- Canonical Mermaid authoring format is Obsidian fenced Markdown: a standalone line starting with \`\`\`mermaid and a standalone closing \`\`\`.
- This fenced format must remain render-compatible across Web reader, Tauri runtime, and Godot reader flows.
- `$$```mermaid` (or any non-line-start Mermaid fence concatenation) is treated as malformed content and must be fixed at source data level.
- Default remediation for `$$```mermaid`: split into two lines (`$$` then ` ```mermaid`), or run `npm run fix:markdown:mermaid:fence -- Knowledge_Base/testconcept`.
- Reader runtime guardrail: on Markdown reader open, run lightweight self-check and auto-heal `$$```mermaid` to `$$` + newline + ` ```mermaid` before rendering.
- Godot Mermaid runtime path must use renderer preference that allows fallback (`auto`), so missing frontend bridge does not break diagram display.
- Any interface/runtime change touching markdown parsing or Mermaid rendering must preserve this baseline and re-verify it on `Knowledge_Base/testconcept`.

## Testing Guidelines

- Framework: Jest with `ts-jest` arrayed in `jest.config.js`.
- Tests are colocated under `src/**`. Execute them with `npm test`.
- Add or update regression tests whenever PathEngine logic changes (especially affecting Domain/Diffusion permutations).

## Commit & Pull Request Guidelines

- Follow Conventional Commits: `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`. Add Godot-specific scoping where necessary e.g., `fix(godot-ui): padding`.
- PRs must document: the root cause trace, verification tests run locally across both UI clients (web browser vs Tauri WebView vs Godot executable), and UI screenshots.
- Release tags `vX.Y.Z` must precisely match `package.json`’s version.

## Release Notes Discipline

- After creating/pushing any new release tag, update the matching bilingual release note source file in `docs/` (for example `docs/release_notes_v1.6.7.md`) before considering the release finalized.
- GitHub Release notes must not stay as placeholder text. Use the previous high-quality release page as the structure benchmark; until superseded, treat [`v1.6.6`](https://github.com/Jacobinwwey/NoteConnection/releases/tag/v1.6.6) as the canonical quality bar for tone, bilingual layout, and subsystem grouping.
- Every release note must contain separated `## English` and `## 中文` sections, a compare baseline, concrete highlights, and subsystem-oriented bullets that reflect the actual shipped delta rather than generic “release prep” wording.
- When a version includes runtime, packaging, CI, docs, or governance changes, summarize each affected surface explicitly so the GitHub Release body can be published directly from the checked-in docs note with minimal or no manual rewriting.
