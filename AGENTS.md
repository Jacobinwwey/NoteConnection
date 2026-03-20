# Repository Guidelines

## Project Structure & Module Organization

- `src/`: TypeScript backend + graph/layout core. Main entry points are `src/server.ts` (CLI + HTTP server) and `src/index.ts` (graph build APIs). Contains bridging logic (`PathBridge.ts`) and algorithm components.
- `src/frontend/`: Static UI (HTML/CSS/vanilla JS). Employs Web Workers (`path_worker.js`, `graph_worker.js`) to offload expensive graph rendering and D3 physics simulations to background threads. Includes datasets like `data.js` and `graph_data.json` (excluded in “mini” builds).
- `path_mode/`: Godot 4.3 UI layer for the "Future Path" visualizations. Uses Godot WebSockets to synchronize graph data (`PathEngine`) rendered locally within standard GDScript nodes (`tree_renderer.gd`, `path_mode_ui.gd`).
- `src-tauri/`: Tauri (Rust) desktop shell. Configuration lives in `src-tauri/tauri.conf.json`; sidecar binaries live in `src-tauri/bin/`.
- `scripts/`: Build helpers (asset copying, path-core bundling via `bundle_path_core.js`, smoke tests).
- `android/`: Capacitor Android project (APK build output is under `android/app/build/...`).
- `dist/`: Generated build output from `tsc` and asset bundling (do not edit by hand).

## Build, Test, and Development Commands

This repo is TypeScript/Node-first integrated with Tauri/Godot. (CI uses Node.js 20).

```bash
npm install            # install dependencies
npm run build          # compile tsc -> dist/ + bundle frontend assets (path_core.js)
npm start              # dev server at http://localhost:3000
npm test               # jest (ts-jest) test runner

npm run tauri:dev      # Tauri dev (runs build + sidecar build)
npm run tauri:dev:mini # Tauri dev without huge graph payloads
npm run build:sidecar  # pkg -> src-tauri/bin/server-windows...exe
```

Android (Windows): run `build_apk.bat` (requires Node.js, Java JDK 17+, and Android SDK).

## Coding Style & Architectural Conventions

- **Godot Bridge Separation**: Keep heavy algorithmic and mathematical work (like topological sorts or domain learning) inside `src/core/PathEngine.ts`. Godot (`path_mode/`) should only act as a pure render target parsing bridging websocket JSON (`PathBridge.ts`).
- **Memory Safety & Worker Threads**: Never parse massive text strings recursively in UI threads. Favor passing references or ArrayBuffers to Web Workers (see `StatisticalAnalyzer` & `KeywordMatching` optimizations mitigating Heap OOM errors).
- **TypeScript `strict`**: Enabled natively (`tsconfig.json`). Keep public APIs rigorously typed to prevent parsing failures at the IPC/WebSocket boundary.
- **Naming Pattern**: `PascalCase.ts` with matching `PascalCase.test.ts` for modules. Godot prefers standard `snake_case` patterns for GDScript.

## Testing Guidelines

- Framework: Jest with `ts-jest` arrayed in `jest.config.js`.
- Tests are colocated under `src/**`. Execute them with `npm test`.
- Add or update regression tests whenever PathEngine logic changes (especially affecting Domain/Diffusion permutations).

## Commit & Pull Request Guidelines

- Follow Conventional Commits: `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`. Add Godot-specific scoping where necessary e.g., `fix(godot-ui): padding`.
- PRs must document: the root cause trace, verification tests run locally across both UI clients (web browser vs Tauri WebView vs Godot executable), and UI screenshots.
- Release tags `vX.Y.Z` must precisely match `package.json`’s version.
