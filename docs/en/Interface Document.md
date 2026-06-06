# 2026-04-07 v1.7.0

# Interface Document (v1.7.0)

This document is the canonical interface handover for the current codebase.
It was rebuilt from source verification, not appended to legacy sections.

## 0.0 Multi-Platform Build Contract Addendum (v1.7.0)

This addendum captures the build/runtime contracts that now matter to the Git LFS migration and to cross-platform delivery safety.

Canonical companion docs:

- `docs/en/lfs_asset_migration_plan.md`
- `docs/en/multi_platform_build_flow_audit.md`
- `docs/en/sidecar_supply_strategy.md`

Current build-contract conclusions:

- The default frontend build contract is runtime-first via `npm run build`.
- Explicit full-mode is still supported, and desktop `tauri:build:full` now preserves full-mode through Tauri `beforeBuildCommand` by routing through `scripts/run-tauri-frontend-build.js`.
- Android build tooling baseline is JDK 21+ for both local helper verification and current CI/release setup.
- Capacitor packaging and Tauri Android packaging must be treated separately from mobile runtime capability:
  - Capacitor native runtime can locally build graph payloads when Filesystem APIs are available.
  - Tauri Android runtime exposes native `build_graph_runtime` and reports `supports_build=true`.
- Desktop sidecar/bootstrap remains an active build contract; the current migration direction is supply hardening, not architecture deletion.
- Current Godot bootstrap is provider-neutral at the download-contract layer: pinned GitHub Releases URLs and generic HTTPS object-storage mirror URLs both fit the same URL + SHA256 + cache model.
- Release CI now includes a minimal Godot mirror-seeding slice: it maintains a project-controlled GitHub Releases mirror tag and downloads mirror-first while retaining upstream fallback as a transitional safety rail.

Build-surface files verified for this addendum:

- `package.json`
- `build_apk.bat`
- `capacitor.config.ts`
- `scripts/copy-assets.js`
- `scripts/run-tauri-build.js`
- `scripts/run-tauri-frontend-build.js`
- `scripts/run-tauri-android.js`
- `scripts/verify-tauri-android-prereqs.js`
- `src-tauri/tauri.conf.json`
- `src-tauri/tauri.android.conf.json`
- `src-tauri/src/lib.rs`
- `src/frontend/storage_provider.js`
- `src/frontend/source_manager.js`
- `.github/workflows/release-desktop-multi-os.yml`
- `.github/workflows/npm-publish.yml`

## 0.0A Knowledge Runtime Contract Addendum (2026-06-06)

This addendum records the current code-backed knowledge runtime contracts without changing the public API.

Current contract surfaces:

- `KnowledgeQueryRequest.scope` accepts `KnowledgeCorpusScope` with workspace, corpus, document, atom, source-path-prefix, and language constraints.
- `AgentConversationResponse` remains backward-compatible:
  - `assistantMessage` is still valid for legacy clients,
  - `answer`, `citations`, `knowledgePoints`, `memoryActions`, `summary`, and `trace` expose grounded conversation state,
  - optional `assistantBlocks` carries richer typed reply sections for clients that can render them.
- `/api/knowledge/conversation` supports the current conversation path, including stream-first clients and sync fallback behavior.
- `/api/knowledge/conversation-memory/{list,add,search,delete,feedback}` exposes scoped conversation memory operations.
- `/api/knowledge/workspace-readiness` exposes workspace/corpus readiness for scoped runtime decisions.
- `POST /api/knowledge/export/workspace` exposes deterministic workspace export bundles backed by resource, index, workspace, session, workflow, memory, and render-materialization state.
- Runtime governance endpoints and payloads expose graphdb/vector rollout context, including `rolloutProfile`, graphdb connector health, vector acceleration strictness, and runbook checks.

Compatibility rules:

- New response fields must remain additive and optional.
- Existing endpoint names and legacy fields must remain stable unless a compatibility shim and tests land in the same change.
- Godot/mobile render paths must continue to consume PNG-first materialized artifacts; direct SVG import must not become a required runtime dependency.
- graphdb and ANN status wording must distinguish operational baselines from production closure until release-grade thresholds and repeated evidence exist.

## 0. Fast Track Links (Godot + NoteMD + Markdown)

Before starting the next integrated feature slice, execute against these docs first:

- Workflow baseline: [Diataxis How-To: Godot + NoteMD + Markdown Workflows](../diataxis/en/how-to/godot-notemd-markdown-workflows.md)
- Field-level contract baseline: [Diataxis Reference: Godot + NoteMD + Markdown Interfaces](../diataxis/en/reference/godot-notemd-markdown-interfaces.md)

## 0. Verification Scope

Verified against implementation files:

- `src/server.ts`
- `src/utils/RuntimePaths.ts`
- `src/index.ts`
- `src/core/NoteConnection.ts`
- `src/core/types.ts`
- `src/core/Graph.ts`
- `src/core/PathEngine.ts`
- `src/backend/config.ts`
- `src/backend/FileLoader.ts`
- `src/backend/GraphBuilder.ts`
- `src/backend/utils/frontmatterParser.ts`
- `src/backend/utils/WorkerRuntime.ts`
- `src/core/PathBridge.ts`
- `src-tauri/src/lib.rs`
- `src/frontend/source_manager.js`
- `src/frontend/path_app.js`
- `src/frontend/path_worker.js`
- `src/frontend/i18n.js`
- `src/frontend/index.html`
- `path_mode/scripts/ws_client.gd`
- `path_mode/scripts/path_mode_ui.gd`
- `path_mode/scripts/path_renderer.gd`
- `path_mode/scripts/learning_state_machine.gd`
- `path_mode/scripts/tree_view_panel.gd`

Audit flow:

1. Fully reread previous `Interface Document.md`.
2. Re-extract interfaces from source.
3. Remove obsolete items and correct mismatches.
4. Rebuild as complete English section followed by complete Chinese section.

## 0.1 Rendering Compatibility Constraint (Godot + Mermaid)

- Godot runtime Mermaid consumption is PNG-only for authoritative rendering output.
- SVG payload is retained only for diagnostics/debug snapshots and must not be used as runtime fallback in Godot.
- Reason: current Godot SVG handling can fail non-deterministically (text/layout/raster instability across devices).
- Change-control rule: any future Godot renderer optimization must preserve PNG decode as the primary path (`pngBase64` required); missing PNG is a hard failure.
- Obsidian compatibility baseline: canonical Mermaid markdown is fenced code whose opening line is three backticks followed by `mermaid`, and whose closing line is three backticks.
- Any inline-concatenated pattern where a math delimiter is immediately followed by a Mermaid opening fence is malformed input and outside the canonical compatibility baseline.
- Reader runtime guardrail: markdown reader performs a lightweight self-check on open and auto-heals that malformed pattern to newline-split form before parsing/rendering.

## 0.2 NoteMD Module Interface Contracts (v1.6.0)

NoteMD is integrated additively and does not replace existing graph/path APIs.

### Backend module namespace (`src/notemd/`)

- Core interfaces/constants: `types.ts`, `constants.ts`
- LLM and prompts: `LlmProvider.ts`, `PromptManager.ts`
- Processing primitives: `FileProcessor.ts`, `MermaidProcessor.ts`, `FormulaFixer.ts`
- Batch/content utilities: `Translator.ts`, `BatchProcessor.ts`, `DuplicateDetector.ts`, `ContentGenerator.ts`
- Facade service: `NotemdService.ts`, `index.ts`

### HTTP API contract (`src/server.ts`)

- `GET /api/notemd/settings`
- `POST|PUT /api/notemd/settings`
- `POST /api/notemd/process-file`
- `POST /api/notemd/process-folder`
- `POST /api/notemd/test-llm`
- `POST /api/notemd/generate-content`
- `POST /api/notemd/translate-file`
- `POST /api/notemd/translate-folder`
- `POST /api/notemd/fix-mermaid`
- `POST /api/notemd/fix-formulas`
- `POST /api/notemd/check-duplicates`
- `POST /api/notemd/extract-concepts`
- `POST /api/notemd/cancel`

### Safety and lifecycle guarantees

- KB-root jail validation is enforced for NoteMD file/folder operations.
- Long-running operations support SSE progress and cancellation.
- Tauri/Godot bridge contracts expose `open_notemd` without changing existing graph bridge semantics.

## 0.3 v1.6.0 Interface Delta (Compared to v1.3.0)

- Added runtime-capability hydration bridge contract in frontend/runtime integration:
  - `invoke('get_runtime_capabilities')`
  - `invoke('get_sidecar_runtime_config')`
- Added sidecar runtime config command contract in Rust runtime:
  - `get_sidecar_runtime_config`
- Added stricter frontend runtime bridge readiness sequencing (`whenReady`) before path-mode flows.
- Added contract-level policy gates for pathbridge strict schema, storage provider abstraction, mobile runtime capability boundaries, and SBOM/attestation verification scripts.

---

## 1. Runtime and Path Contracts

### 1.1 Runtime path resolution (`src/utils/RuntimePaths.ts`)

```ts
interface RuntimePaths {
  projectRoot: string;
  frontendDir: string;
  runtimeDataDir: string;
  kbRoot: string;
}
```

Resolution priorities:

1. `projectRoot` from candidate directories with existence checks.
2. `frontendDir`:
   - `NOTE_CONNECTION_FRONTEND_DIR`
   - `<projectRoot>/dist/src/frontend`
   - `<projectRoot>/src/frontend`
3. `kbRoot`:
   - `NOTE_CONNECTION_KB_ROOT`
   - `<projectRoot>/Knowledge_Base`
   - CWD fallbacks

### 1.2 Tauri sidecar env injection (`src-tauri/src/lib.rs`)

Rust sets:

- `NOTE_CONNECTION_PROJECT_ROOT`
- `NOTE_CONNECTION_KB_ROOT`
- `NOTE_CONNECTION_FRONTEND_DIR`

Effective KB root in this project:

- `E:\Knowledge_project\NoteConnection_app\Knowledge_Base`

### 1.3 Graph artifact paths

Active graph artifacts:

- `dist/src/frontend/data.js`
- `dist/src/frontend/graph_data.json`

Target cache artifacts:

- `dist/src/frontend/data_<target>.js`
- `dist/src/frontend/graph_data_<target>.json`

CLI timestamped artifacts:

- `dist/src/frontend/data_cli_<suffix>.js`
- `dist/src/frontend/graph_data_cli_<suffix>.json`

---

## 2. Core Type Interfaces

### 2.1 Graph types (`src/core/types.ts`)

```ts
interface NoteNode {
  id: string;
  label: string;
  inDegree: number;
  outDegree: number;
  content?: string;
  x?: number;
  y?: number;
  centrality?: number;
  rank?: number;
  clusterId?: string;
  metadata?: {
    tags?: string[];
    prerequisites?: string[];
    next?: string[];
    filepath?: string;
    [key: string]: any;
  };
}

interface NoteEdge {
  source: string;
  target: string;
  type?: string;
  weight?: number;
}

interface GraphData {
  nodes: NoteNode[];
  edges: NoteEdge[];
}
```

### 2.2 Build API types (`src/core/NoteConnection.ts`)

```ts
interface BuildOptions {
  targetPath?: string;
  maxWorkers?: number;
  enableGPU?: boolean;
  enableGPULayout?: boolean;
  memorySavingMode?: boolean;
  deepDebug?: boolean;
  projectRoot?: string;
  outputPrefix?: string;
  onLog?: (msg: string) => void;
}

interface GraphBuildResult {
  graph: Graph;
  data: any;
  stats: {
    nodeCount: number;
    edgeCount: number;
    fileCount: number;
  };
}
```

### 2.3 Backend config (`src/backend/config.ts`)

```ts
interface AppConfig {
  matchingStrategy: "exact-phrase" | "fuzzy";
  clusteringStrategy: "label-propagation" | "folder";
  fuzzyThreshold: number;
  enableTags: boolean;
  enableStatisticalInference: boolean;
  enableVectorSimilarity: boolean;
  enableHybridInference: boolean;
  enableGPU: boolean;
  enableGPULayout?: boolean;
  memorySavingMode: boolean;
  deepDebug: boolean;
  maxWorkers?: number;
  exclusionList: string[];
}
```

### 2.4 Worker runtime resolution (`src/backend/utils/WorkerRuntime.ts`)

```ts
interface WorkerRuntimeResolution {
  workerPath: string | null;
  isTsNode: boolean;
  candidates: string[];
}
```

---
## 3. Build and Graph Pipeline Interfaces

### 3.1 File loading (`src/backend/FileLoader.ts`)

```ts
interface RawFile {
  filepath: string;
  filename: string;
  content: string;
}

FileLoader.loadFiles(dirPath: string, extensions = [".md"]): Promise<RawFile[]>
```

Behavior:

- Recursive directory scan.
- Batched concurrent reads.
- Empty array when directory does not exist.

### 3.2 Frontmatter parsing (`src/backend/utils/frontmatterParser.ts`)

```ts
interface ParsedMetadata {
  tags: string[];
  prerequisites: string[];
  next: string[];
  [key: string]: any;
}

FrontmatterParser.parse(content: string): ParsedMetadata
FrontmatterParser.extractTags(content: string): string[]
```

Supported formats: YAML list, inline array, single value, and `[[WikiLink]]` cleanup.

### 3.3 Graph core (`src/core/Graph.ts`)

Primary methods:

- `addNode(node)`
- `getNode(id)`
- `hasNode(id)`
- `addEdge(source, target, type?, weight?)`
- `getOutgoingEdges(id)`
- `getIncomingEdges(id)`
- `getNeighbors(id)`
- `getNodes()`
- `getEdges()`
- `toJSON()`
- `getPredecessors(id)`
- `getSuccessors(id)`
- `getShortestPath(source, target)`

### 3.4 Graph building orchestration (`src/backend/GraphBuilder.ts`)

```ts
GraphBuilder.build(files, layout?): Promise<Graph>
```

Pipeline stages:

1. Node initialization (+ metadata/tags)
2. Explicit dependency edges (`prerequisites`, `next`)
3. Keyword matching (parallel workers or sequential fallback)
4. Statistical inference
5. Vector similarity (`VectorSpace` or `VectorSpaceGPU`)
6. Hybrid inference
7. Clustering
8. Graph metrics
9. Cycle detection + topological rank assignment
10. Backend layout compute (`LayoutEngine.computeLayout`)

Parallel keyword matching contract:

- Worker path from `resolveWorkerRuntimePath`.
- Falls back to sequential matching when workers fail/unavailable.

### 3.5 Top-level build output (`src/index.ts`)

```ts
buildGraph(options: BuildOptions | string, ...legacyArgs): Promise<GraphData>
```

Output rules:

- Standard writes active files:
  - `graph_data.json`
  - `data.js` (lite payload)
- Target builds also write cache copies:
  - `data_<target>.js`
  - `graph_data_<target>.json`
- CLI mode (`outputPrefix`) writes `data_cli_*` and `graph_data_cli_*` without overwriting active data.

---

## 4. Frontend Source Loading Interfaces

Source loader: `src/frontend/source_manager.js`

### 4.1 Folder and KB path loading

Primary API path:

- `GET /api/kb-path`
- `GET /api/folders`

Tauri fallback path:

- `invoke("get_kb_path")`
- `invoke("get_folders")`

Dropdown contract:

- Always includes synthetic `ALL_FOLDERS`.
- Real options come from directories under current KB root.

### 4.2 Cache check/restore modal contract

- Check: `GET /api/check-cache?target=<id>`
- If cache exists, user decision is required:
  - `Load Existing`
  - `Regenerate`
- Restore: `GET /api/restore-cache?target=<id>`

### 4.3 Single-flight load/build contract

Client-side guards:

- `isLoadInProgress`
- `loadBtn.dataset.sourceManagerBound`
- Session reload guard `nc_reload_guard`

Build payload:

```json
{
  "target": "ALL_FOLDERS | <folderName>",
  "maxWorkers": 4,
  "enableGPU": true,
  "enableGPULayout": true,
  "memorySavingMode": false,
  "deepDebug": false
}
```

### 4.4 Path mode ownership in Tauri (`src/frontend/path_app.js`)

In Tauri mode:

- `#path-toolbar` is hidden.
- Web Path Mode settings group is hidden.
- Layout is backend/runtime-forced to `orbital`.

In browser mode:

- Web toolbar remains active for Mode/Strategy/Layout/Complete/History/Exit.

---

## 5. Server HTTP API Interfaces (`src/server.ts`)

Base URL: `http://localhost:3000`

### 5.1 GET APIs

| Endpoint | Query | Success Response | Notes |
| --- | --- | --- | --- |
| `/api/folders` | none | `{ "folders": string[] }` | Directories under current KB root. |
| `/api/content` | `path` | `{ "content": string }` | Reads file content. |
| `/api/kb-path` | none | `{ "kbPath": string }` | Current KB root. |
| `/api/check-cache` | `target` | `null` or `{ "date": string, "size": number, "source"?: "active" }` | `ALL_FOLDERS` checks active cache. |
| `/api/restore-cache` | `target` | `{ "success": boolean, "deduped"?: true, "error"?: string }` | Includes short-window dedupe. |

Additional static behavior:

- Non-`/api/` `*.js` and `*.json` paths are served from frontend output dir.

### 5.2 POST APIs

| Endpoint | Body | Success Response | Notes |
| --- | --- | --- | --- |
| `/api/build` | `{ target, maxWorkers, enableGPU, enableGPULayout, memorySavingMode, deepDebug }` | `{ "success": true }` or `{ "success": true, "deduped": true }` | Same in-flight payload dedupes; different payload returns `409`. |
| `/api/kb-path` | `{ "kbPath": string }` | `{ "success": true, "kbPath": string }` | Updates runtime KB root. |

### 5.3 Build dedupe semantics

- Active build + same payload: wait and return deduped success.
- Active build + different payload: `409` conflict.

### 5.4 CLI option parsing notes

- Supports `--path`, `--gpu`, `--no-gpu`, `--workers`.
- Also reads npm env flags and `NOTE_CONNECTION_GPU`.
- Recommended npm script style for GPU is env flag (`NOTE_CONNECTION_GPU=1`) to avoid npm unknown-config warnings.

---
## 6. Tauri Rust Command and Event Interfaces (`src-tauri/src/lib.rs`)

### 6.1 Invokable commands

| Command | Signature | Return |
| --- | --- | --- |
| `get_kb_path` | `() -> Result<String, String>` | Default KB path `<projectRoot>/Knowledge_Base`. |
| `get_user_language` | `() -> Result<String, String>` | Current language (currently defaults to `"en"`). |
| `get_folders` | `() -> Result<Vec<String>, String>` | Sorted KB folder names. |
| `set_user_language` | `(app, lang) -> Result<(), String>` | Menu language update with idempotent guard. |
| `check_cache` | `(app, target) -> Result<Option<Value>, String>` | Cache metadata or `None`. |
| `restore_cache` | `(app, target) -> Result<bool, String>` | `true` if restore succeeded. |

### 6.2 Menu and emitted events

Menu actions:

- `change_kb`
- `reset_kb`
- `docs`
- `about`

Emitted frontend event:

- `kb-path-changed` with payload path string

### 6.3 Sidecar and Godot process contracts

- Sidecar process: `server`
- Godot process launched with:
  - `--path E:\Knowledge_project\NoteConnection_app\path_mode`

---

## 7. PathBridge WebSocket Protocol (`src/core/PathBridge.ts`)

Bridge server: `ws://127.0.0.1:9876`

Client tagging:

- Query param `client` is parsed for diagnostics.
- Examples:
  - `ws://127.0.0.1:9876/?client=godot`
  - `ws://localhost:9876?client=frontend`

Message envelope:

```json
{ "type": "<messageType>", "payload": {} }
```

Supported message types:

- `nodeClick`
- `requestPath`
- `pathResult`
- `markComplete`
- `switchCenter`
- `openReader`
- `unmarkComplete`
- `completionSync`
- `toggleCollapse`
- `expandPrereqs`
- `collapsePrereqs`
- `collapseAll`
- `configure`
- `exitPathMode`

Known payload keys include:

- `{ nodeId }`
- `{ newCenterId, autoReconstruct? }`
- `{ completedIds, timestamp? }`

Current implementation broadcasts recognized messages to connected clients.

---

## 8. Path Worker and Path Payload Interfaces

### 8.1 Path worker (`src/frontend/path_worker.js`)

Inbound messages:

- `initData` -> `{ nodes, links }`
- `computePath` -> `{ mode, strategy, layout, targetId, centralId, collapsedIds, completedIds, forcedExpansionIds, expansionOrder, stickyClaimEnabled }`

Outbound messages:

- `pathResult` -> `{ nodes, edges, treeLayout }`

### 8.2 Path payload sent from web path app to Godot (`src/frontend/path_app.js`)

```json
{
  "type": "pathResult",
  "payload": {
    "central": { "id": "", "label": "", "inDegree": 0, "outDegree": 0 },
    "peripherals": [{ "id": "", "label": "", "relation": "prerequisite|association" }],
    "progress": { "completed": 0, "total": 0 },
    "totalNodes": 0,
    "pathNodes": [{ "id": "", "label": "", "parentId": null }],
    "treeLayout": { "nodes": [], "edges": [] },
    "completedIds": [],
    "mode": "orbital"
  }
}
```

When `treeLayout` is null/empty, Godot falls back to legacy linear rendering path.

---

## 9. Godot Interface Contracts

### 9.1 WS client (`path_mode/scripts/ws_client.gd`)

Core constants:

- `WS_URL = "ws://127.0.0.1:9876/?client=godot"`
- `RECONNECT_DELAY = 3.0`

Signals:

- `data_received(data)`
- `connected`
- `disconnected`
- `path_result(data)`
- `path_update(data)`
- `switch_center(new_center_id)`
- `completion_sync(completed_ids, timestamp)`

Send helpers:

- `send_node_click`
- `send_mark_complete`
- `send_open_reader`
- `send_switch_center`
- `send_configure`
- `send_toggle_collapse`
- `send_expand_prereqs`
- `send_collapse_prereqs`
- `send_collapse_all`
- `send_exit_path_mode`

### 9.2 Path UI (`path_mode/scripts/path_mode_ui.gd`)

Signals:

- `mark_complete_pressed`
- `sidebar_toggled(visible)`
- `completed_node_clicked(node_id)`
- `return_pressed`
- `return_to_node(node_id)`
- `tree_node_clicked(node_id)`
- `unmark_requested(node_id)`
- `mark_node_requested(node_id)`
- `node_toggle_requested(node_id)`
- `node_expand_prereqs_requested(node_id)`
- `node_collapse_prereqs_requested(node_id)`
- `collapse_all_requested()`
- `settings_updated(settings)`
- `exit_requested`

Runtime config emitted to backend:

```json
{ "mode": "domain|diffusion", "strategy": "foundational|core", "layout": "orbital", "targetId": "<optional>" }
```

### 9.3 Learning state machine (`path_mode/scripts/learning_state_machine.gd`)

States:

- `IDLE`
- `VIEWING`
- `TRANSITIONING`
- `READING`

Signals:

- `state_changed`
- `central_changed`
- `node_completed`
- `node_unmarked`
- `path_complete`

Persistence path:

- `user://orbital_progress.json`

### 9.4 Path renderer (`path_mode/scripts/path_renderer.gd`)

Signals:

- `node_clicked(node_id)`
- `node_double_clicked(node_id)`
- `transition_complete()`

Critical handlers:

- `render_path(path_data)`
- `_on_ws_data_received(data)`
- `_on_settings_updated(settings)` -> sends `configure`
- `_request_switch_center(target_id)` -> sends `switchCenter`
- `_on_mark_node_requested(node_id)` -> sends `markComplete`
- `_on_unmark_requested(node_id)` -> sends `unmarkComplete`
- `_on_exit_requested()` -> sends `exitPathMode`

### 9.5 Tree panel (`path_mode/scripts/tree_view_panel.gd`)

Signals relayed upward:

- `node_navigate_requested`
- `node_mark_complete_requested`
- `node_unmark_requested`
- `node_toggle_requested`
- `node_expand_prereqs_requested`
- `node_collapse_prereqs_requested`
- `collapse_all_requested`
- `fullscreen_requested(expand)`

---

## 10. Web vs Tauri Path Mode Ownership Matrix

| Interface Area | Browser Mode | Tauri Mode |
| --- | --- | --- |
| Path toolbar (`#path-toolbar`) | Visible and interactive | Hidden by `path_app.js` |
| Mode control | Web select (`#learning-mode`) | Godot `PathModeUI` |
| Strategy control | Web select (`#strategy`) | Godot `PathModeUI` |
| Layout control | Web select (`#layout-style`) | Backend/Godot forced to `orbital` |
| Diffusion target picker | Web modal (`#node-select-modal`) | Godot target popup |
| Complete action | Web button (`#btn-mark-complete`) | Godot button |
| History action | Web sidebar/popup | Godot history popup |
| Exit action | Web button (`#btn-exit-path`) | Godot exit flow + `exitPathMode` bridge message |

This is the current Bridge-first migration contract.

---

## 11. Corrected / Removed Legacy Mismatches

1. Removed duplicated mixed-language blocks and rebuilt strict EN/ZH separation.
2. Replaced stale API text with exact `server.ts` contracts.
3. Corrected Godot WebSocket URL requirement:
   - valid: `ws://127.0.0.1:9876/?client=godot`
4. Documented actual build/cache dedupe semantics.
5. Documented actual Tauri command names and return shapes.
6. Added missing path worker payload and Godot signal contracts.
7. Clarified Tauri path-control ownership migration to Godot.

---

## 12. Handover Checklist

1. Folder list source must be current KB root (`/api/folders` or Rust fallback).
2. Cache choice prompt must appear when target cache exists.
3. One click should produce one load/build flow only.
4. Active graph files must be read from `dist/src/frontend`.
5. Mode/strategy changes should emit `configure` and produce `pathResult`.
6. Godot should receive non-empty `treeLayout` in normal path updates.
7. Tauri mode should hide web path toolbar; browser mode should keep it.

---

---

---

## 13. Interface Update Log Placement

- Canonical bilingual update logs are centrally archived in [`export.md`](export.md).
- This document focuses on interface contracts; historical migration logs are no longer placed at file beginning.
- Related interface delta versions:
- `2026-03-02 v1.5.1`: Interface Delta: Tauri Runtime Parity Update

### Archived Interface Delta Block (traceability)
# 2026-03-02 v1.5.1

### Interface Delta: Tauri Runtime Parity Update

This section records interface changes added after `v1.4.5`, keeping all previous handover content unchanged below.

#### A. Sidecar HTTP API (Node)

1. `GET /api/available-targets`
   - Purpose: return selectable learning/build targets merged from:
     - physical subfolders under `Knowledge_Base`
     - cached artifacts like `data_<target>.js`, `graph_data_<target>.json`
   - Response:

```json
{
  "targets": ["financial", "legal", "robotics"]
}
```

#### B. Tauri Commands (Rust IPC)

1. `get_available_targets() -> string[]`
   - Contract: same merged target semantics as `/api/available-targets`.

2. `read_node_content(file_path: string) -> Result<string, string>`
   - Contract:
     - Accepts relative paths and absolute paths.
     - Enforces KB-root boundary (rejects files outside configured `Knowledge_Base`).
     - Supports legacy desktop-style paths containing `.../Knowledge_Base/...` by rebasing to current configured KB root.

#### C. Runtime Capability Contract Update

- `get_runtime_capabilities()` now returns `supports_content_api: true` on Android.
- Rationale: content reads are now available through Rust `read_node_content` command even when sidecar is disabled.

#### D. Frontend Behavior Contract Changes

1. `source_manager.js`
   - Sidecar path prefers `/api/available-targets` and falls back to `/api/folders`.
   - Rust path prefers `get_available_targets` and falls back to `get_folders`.
   - In `supports_build=false` runtime (mobile):
     - Source list is filtered to cached targets only.
     - `ALL_FOLDERS` is shown only if active cache exists.
     - Load button is disabled if no cache is available.

2. `reader.js`
   - Content loading fallback order:
     - sidecar `/api/content` (desktop/web path)
     - Rust command `read_node_content` (Tauri fallback/mobile-safe)
     - localized unavailable/error messaging

#### E. Verification Interface Baseline

- `npm run test:migration` passed (35 tests).
- `npm run test:tauri` passed (14 tests).
- `npm run tauri:android:build` passed.

---
