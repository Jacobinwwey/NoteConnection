# 2026-03-24 v1.6.0

# Interface Document (v1.6.0)

This document is the canonical interface handover for the current codebase.
It was rebuilt from source verification, not appended to legacy sections.

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

## 0.2 Knowledge Runtime Contract Addendum (2026-06-06)

- Scoped retrieval is now represented by `KnowledgeQueryRequest.scope` and `KnowledgeCorpusScope`.
- `AgentConversationResponse` remains backward-compatible: `assistantMessage` is still valid, while `answer`, `citations`, `memoryActions`, `trace`, and optional `assistantBlocks` provide richer grounded conversation state.
- `AgentConversationKnowledgePoint` may now carry grouped/document-augmented evidence fields such as `atomIds`, `documentId`, `sourcePath`, `citations`, `matchedSpans`, and `matchCount`, while preserving the original top-level title/summary/citation shape.
- Scoped query traces may now report `scopeSource: planner_scope_recovery` when title-like recovery intentionally switches from an incompatible explicit scope to a document-only recovery scope.
- `/api/knowledge/conversation` remains the conversation entrypoint and supports current stream/sync compatibility behavior.
- `/api/knowledge/conversation-memory/{list,add,search,delete,feedback}` exposes scoped conversation memory operations.
- `POST /api/knowledge/export/workspace` exposes deterministic workspace export bundles backed by resource, index, workspace, session, workflow, memory, and render-materialization state.
- Runtime governance payloads expose graphdb/vector rollout context, including `rolloutProfile`, graphdb connector health, vector acceleration strictness, and runbook checks.
- The Knowledge Workspace frontend contract now also includes an in-pane scope selector, a compact conversation API status strip, file-first grouped hit rendering, and matched-span evidence rendering inside the focus pane. These are additive UI/runtime contracts over the existing backend payloads, not a replacement of public response fields.
- `assistantBlocks` are no longer only transport wrappers around the same legacy answer string. Current Tauri-capable clients should expect intent-aware overview / explanation / evidence / memory / action sections while still honoring `assistantMessage` as the compatibility fallback.
- Compatibility rule: new response fields must remain additive and optional; Godot/mobile paths must continue to use PNG-first materialized render artifacts instead of requiring direct SVG import.

## 0.2B Knowledge Workspace and DAG Alignment Addendum (2026-06-10)

- The Knowledge Workspace runtime now includes durable workflow-artifact paths for `flashcard_batch` and `knowledge_run`, exposed through `/api/knowledge/workflow-artifacts` and `/api/knowledge/workflow-artifacts/review-follow-up`.
- Runtime compatibility remains additive:
  - `assistantMessage` stays valid,
  - `answer`, `assistantBlocks`, `knowledgeRun`, grouped `knowledgePoints`, citations, memory actions, and trace coexist with legacy clients.
- The codebase already contains a real DAG-backed learning substrate:
  - `KnowledgeAtom`
  - `RelationEdge`
  - `TemporalEdge`
  - path queries
  - prerequisite-driven mastery/session flows
  - `KnowledgeQueryItem.relationPath`
- Current architecture reading:
  - graph-backed retrieval and learning-path/session logic are implemented,
  - graph-native answer planning is not yet complete because retrieval and answer synthesis still lack a dedicated graph-conditioned context-assembly layer.
- Current product-surface reading:
  - grouped file-first knowledge hits and right-pane source highlighting are implemented,
  - the visible answer area is now contracted at the composer/frontend boundary: `answer` and `directAnswer` stay targeted, while graph paths, citations, memory notes, diagnostics, and durable artifacts move to secondary evidence/export surfaces.

## 0.2C Agent Knowledge DAG Answer Contract Addendum (2026-06-17)

- The graph context referenced by the agent knowledge runtime is this project's existing DAG-structured learning data, not a generic external graph database abstraction.
- `AgentConversationGraphContext` may now carry optional `connectionPaths`.
  - Each connection path contains source/target atom identity, ordered `pathAtomIds`, display `pathTitles`, edge relation kinds, and path length.
  - The field is additive and optional; clients must continue to accept graph contexts without connection paths.
- `/api/knowledge/conversation` remains backward-compatible:
  - `assistantMessage` remains valid,
  - `answer`, `assistantBlocks`, `trace.graphContext`, grouped `knowledgePoints`, citations, memory actions, and workflow artifacts remain additive.
- Workspace export preserves graph connection paths when they are present in conversation trace graph context.
- The Knowledge Workspace evidence pane may render connection paths as secondary inspection material. Public answer rendering must remain targeted to the user question and must not treat graph evidence/debug detail as mandatory visible answer content.
- Right-pane graph-focus source rendering remains the canonical interaction for file hits. File-hit payloads should preserve source path and matched-span data so the pane can read source markdown and highlight evidence in place.
- Architecture rule: future graph-native answer planning should be implemented as a bounded graph-conditioned context assembly layer between retrieval and answer synthesis. It should consume existing `KnowledgeAtom`, `RelationEdge`, `TemporalEdge`, evidence spans, and store-level path operations instead of introducing a broad prompt-framework dependency into the runtime.
- Compatibility rule: when graph ops are unavailable or fail, the conversation path must fail open to the existing retrieval-grounded behavior with observable diagnostics rather than breaking the public answer endpoint.

## 0.2D Agent Knowledge Workspace Graph Preview and Release-Review Addendum (2026-06-20)

- The Agent Knowledge Workspace public-answer contract is release-reviewed:
  - `answer` / `directAnswer` must stay focused on the user's question,
  - citations, graph context, reviewer state, source provenance, and diagnostics remain secondary inspection material unless explicitly requested.
- `AnswerReleaseReview` is an additive response/trace/review contract:
  - clients must tolerate its absence on old payloads,
  - clients that receive it should treat `publicAnswer` as the release-reviewed answer.
- Matched-file entries are interactive source entries:
  - left-click should open the canonical right-side source/focus pane,
  - source rendering should prefer source-line and offset provenance when available,
  - snippet/line fallback remains required for older payloads.
- The matched-file instruction text is not a permanent workspace block. It is exposed through a compact help affordance that must remain keyboard-accessible.
- `Related Focus` is a right-pane semantic projection of the selected node's Focus-mode graph neighborhood:
  - anchor label,
  - incoming references,
  - outgoing references,
  - immediate relation context.
- `Learning Path` is a right-pane semantic projection of Path-mode-style learning guidance:
  - prerequisite/upstream role,
  - anchor role,
  - next/downstream role.
- Graph preview labels must prefer resolved human graph labels such as `water glass`; internal atom IDs are fallback diagnostics, not primary display labels.
- Right-side source/focus/path panes must expose close controls.
- Compatibility rule: these graph-preview contracts are additive UI/runtime contracts. Existing clients that only consume `assistantMessage`, `answer`, `assistantBlocks`, citations, or `trace.graphContext` must remain valid.
- Runtime boundary rule: the Knowledge Workspace pane currently projects Focus/Path semantics instead of embedding live Tauri/Godot canvases. Exact renderer parity should be introduced only through a shared graph projection/renderer contract, not by ad hoc pane-level runtime embedding.

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

## 中文文档

# 2026-03-24 v1.6.0
# 接口文档 (v1.6.0)

本文件是当前代码状态下的权威接口交接文档。
本版不是在旧文档上追加，而是按源码核对后重建。

## 0. 核对范围

已逐一对照以下文件：

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

核对流程：

1. 先完整重读旧版 `Interface Document.md`。
2. 从源码重新提取接口。
3. 删除过期项并修正不一致。
4. 重建为完整英文部分 + 完整中文部分。

## 0.1 渲染兼容性约束（Godot + Mermaid）

- Godot 运行时中的 Mermaid 正式渲染链路仅允许 PNG（权威输出）。
- SVG 仅保留用于诊断/调试快照，不得作为 Godot 运行时回退路径。
- 原因：当前 Godot 的 SVG 处理存在非确定性失败（跨设备文本/布局/栅格不稳定）。
- 变更规则：后续 Godot 渲染优化必须保持 PNG 解码主路径（`pngBase64` 必填）；缺失 PNG 视为失败。

## 0.2 知识运行时契约补充（2026-06-06）

- Scoped retrieval 现在由 `KnowledgeQueryRequest.scope` 与 `KnowledgeCorpusScope` 表达。
- `AgentConversationResponse` 保持向前兼容：`assistantMessage` 仍有效，同时 `answer`、`citations`、`memoryActions`、`trace` 与可选 `assistantBlocks` 提供 richer grounded conversation 状态。
- `/api/knowledge/conversation` 仍是会话入口，并支持当前 stream/sync 兼容行为。
- `/api/knowledge/conversation-memory/{list,add,search,delete,feedback}` 暴露 scoped conversation memory 操作。
- `POST /api/knowledge/export/workspace` 暴露 deterministic workspace export bundle，其数据来自 resource、index、workspace、session、workflow、memory 与 render-materialization 状态。
- 运行时治理 payload 暴露 graphdb/vector rollout 上下文，包括 `rolloutProfile`、graphdb connector health、vector acceleration strictness 与 runbook checks。
- 兼容性规则：新响应字段必须保持 additive 且 optional；Godot/mobile 路径必须继续使用 PNG-first materialized render artifacts，不能依赖直接 SVG 导入。

## 0.2C Agent Knowledge DAG 回答契约补充（2026-06-17）

- agent knowledge runtime 中提到的 graph context 指本项目现有 DAG 结构化学习数据，不是泛化外部图数据库抽象。
- `AgentConversationGraphContext` 现在可以携带可选 `connectionPaths`。
  - 每条 connection path 包含 source/target atom 身份、有序 `pathAtomIds`、展示用 `pathTitles`、边关系类型与路径长度。
  - 该字段是 additive 且 optional；客户端必须继续接受没有 connection paths 的 graph context。
- `/api/knowledge/conversation` 保持向前兼容：
  - `assistantMessage` 仍有效；
  - `answer`、`assistantBlocks`、`trace.graphContext`、按文档聚合的 `knowledgePoints`、citations、memory actions 与 workflow artifacts 均继续作为增量字段共存。
- workspace export 会在 conversation trace graph context 中存在 connection paths 时保留它们。
- Knowledge Workspace evidence pane 可以把 connection paths 渲染为次级 inspection material。公开回答渲染必须继续针对用户问题，不得把 graph evidence/debug detail 当成必须展示在主回答区的内容。
- 右侧 graph-focus source rendering 仍是文件命中的权威交互路径。file-hit payload 应保留 source path 与 matched-span 数据，以便 pane 读取 source markdown 并在原文中高亮证据。
- 架构规则：后续 graph-native answer planning 应在 retrieval 与 answer synthesis 之间实现一个有界 graph-conditioned context assembly layer。该层应消费现有 `KnowledgeAtom`、`RelationEdge`、`TemporalEdge`、evidence spans 与 store-level path operations，而不是把宽 prompt framework 作为运行时依赖引入。
- 兼容规则：graph ops 不可用或失败时，conversation path 必须 fail open 到现有 retrieval-grounded 行为，并通过 diagnostics 可观测，而不是破坏公开回答端点。

## 0.2D Agent Knowledge Workspace 图预览与发布审核补充（2026-06-20）

- Agent Knowledge Workspace 的公开回答契约现在经过 release review：
  - `answer` / `directAnswer` 必须聚焦用户问题；
  - citation、graph context、reviewer state、source provenance 与 diagnostics 默认作为次级 inspection material，除非用户显式要求查看。
- `AnswerReleaseReview` 是 additive response / trace / review contract：
  - 客户端必须兼容旧 payload 中缺失该字段；
  - 如果收到该字段，应把 `publicAnswer` 视为经过发布审核的回答。
- 命中文件 entry 是可交互 source entry：
  - 左键单击应打开右侧 canonical source/focus pane；
  - source rendering 在可用时应优先使用 source-line 与 offset provenance；
  - 对旧 payload 仍必须保留 snippet / line fallback。
- 命中文件说明文案不是 workspace 常驻块。它通过紧凑帮助入口暴露，并且必须保持键盘可访问。
- `关联聚焦` 是右侧 pane 对选中节点 Focus-mode 图邻域的语义投影：
  - anchor label；
  - incoming references；
  - outgoing references；
  - immediate relation context。
- `学习路径` 是右侧 pane 对 Path-mode 风格学习引导的语义投影：
  - prerequisite / upstream role；
  - anchor role；
  - next / downstream role。
- 图预览 label 必须优先使用 `water glass` 这类解析后的人类可读图标签；内部 atom ID 是 fallback diagnostics，不是主要展示标签。
- 右侧 source / focus / path pane 必须提供关闭控件。
- 兼容规则：这些 graph-preview 契约是 additive UI/runtime contract。只消费 `assistantMessage`、`answer`、`assistantBlocks`、citations 或 `trace.graphContext` 的既有客户端必须继续有效。
- 运行时边界规则：Knowledge Workspace pane 当前投影 Focus/Path 语义，而不是嵌入 live Tauri/Godot canvas。精确 renderer parity 只能通过共享 graph projection / renderer contract 引入，不应通过 pane 级临时嵌入运行时实现。

---

## 1. 运行时与路径契约

### 1.1 运行时路径解析（`src/utils/RuntimePaths.ts`）

```ts
interface RuntimePaths {
  projectRoot: string;
  frontendDir: string;
  runtimeDataDir: string;
  kbRoot: string;
}
```

优先级：

1. `projectRoot` 由候选路径 + 目录存在性判定。
2. `frontendDir`：
   - `NOTE_CONNECTION_FRONTEND_DIR`
   - `<projectRoot>/dist/src/frontend`
   - `<projectRoot>/src/frontend`
3. `kbRoot`：
   - `NOTE_CONNECTION_KB_ROOT`
   - `<projectRoot>/Knowledge_Base`
   - CWD 回退路径

### 1.2 Tauri sidecar 环境注入（`src-tauri/src/lib.rs`）

Rust 启动 sidecar 时注入：

- `NOTE_CONNECTION_PROJECT_ROOT`
- `NOTE_CONNECTION_KB_ROOT`
- `NOTE_CONNECTION_FRONTEND_DIR`

当前项目实际 KB 根路径：

- `E:\Knowledge_project\NoteConnection_app\Knowledge_Base`

### 1.3 图谱文件路径

活动图谱文件：

- `dist/src/frontend/data.js`
- `dist/src/frontend/graph_data.json`

目标缓存文件：

- `dist/src/frontend/data_<target>.js`
- `dist/src/frontend/graph_data_<target>.json`

CLI 时间戳文件：

- `dist/src/frontend/data_cli_<suffix>.js`
- `dist/src/frontend/graph_data_cli_<suffix>.json`

---

## 2. 核心类型接口

### 2.1 图结构类型（`src/core/types.ts`）

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
### 2.2 构建 API 类型（`src/core/NoteConnection.ts`）

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

### 2.3 后端配置（`src/backend/config.ts`）

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

### 2.4 Worker 运行时解析（`src/backend/utils/WorkerRuntime.ts`）

```ts
interface WorkerRuntimeResolution {
  workerPath: string | null;
  isTsNode: boolean;
  candidates: string[];
}
```

---

## 3. 构建与图谱流水线接口

### 3.1 文件加载（`src/backend/FileLoader.ts`）

```ts
interface RawFile {
  filepath: string;
  filename: string;
  content: string;
}

FileLoader.loadFiles(dirPath: string, extensions = [".md"]): Promise<RawFile[]>
```

行为：

- 递归扫描目录。
- 分批并发读取。
- 目录不存在时返回空数组。

### 3.2 Frontmatter 解析（`src/backend/utils/frontmatterParser.ts`）

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

支持 YAML 列表、行内数组、单值和 `[[WikiLink]]` 清洗。

### 3.3 图核心（`src/core/Graph.ts`）

主方法：

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

### 3.4 图构建编排（`src/backend/GraphBuilder.ts`）

```ts
GraphBuilder.build(files, layout?): Promise<Graph>
```

阶段：

1. 节点初始化（含 metadata/tag）
2. 显式依赖边（`prerequisites`、`next`）
3. 关键词匹配（并行 worker 或顺序回退）
4. 统计推断
5. 向量相似度（`VectorSpace` 或 `VectorSpaceGPU`）
6. 混合推断
7. 聚类
8. 图指标
9. 环检测 + 拓扑排名
10. 后端布局计算（`LayoutEngine.computeLayout`）

并行关键词匹配契约：

- worker 路径由 `resolveWorkerRuntimePath` 解析。
- worker 不可用/失败时回退顺序匹配。

### 3.5 顶层构建输出（`src/index.ts`）

```ts
buildGraph(options: BuildOptions | string, ...legacyArgs): Promise<GraphData>
```

输出规则：

- 标准模式写入活动文件：
  - `graph_data.json`
  - `data.js`
- 指定目标目录时写入缓存副本：
  - `data_<target>.js`
  - `graph_data_<target>.json`
- CLI 模式写入 `data_cli_*` 与 `graph_data_cli_*`，不覆盖活动文件。

---

## 4. 前端加载接口

加载入口：`src/frontend/source_manager.js`

### 4.1 目录与 KB 路径获取

主路径：

- `GET /api/kb-path`
- `GET /api/folders`

Tauri 回退：

- `invoke("get_kb_path")`
- `invoke("get_folders")`

下拉契约：

- 永远包含 `ALL_FOLDERS`。
- 真实选项来自当前 KB 根目录子目录。

### 4.2 缓存检查/恢复弹窗

- 检查：`GET /api/check-cache?target=<id>`
- 命中缓存时必须二选一：
  - `Load Existing`
  - `Regenerate`
- 恢复：`GET /api/restore-cache?target=<id>`

### 4.3 加载单飞契约

前端防重：

- `isLoadInProgress`
- `loadBtn.dataset.sourceManagerBound`
- 会话重载防抖键 `nc_reload_guard`

构建请求载荷：

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

### 4.4 Tauri 下 Path 控件归属（`src/frontend/path_app.js`）

Tauri 模式：

- `#path-toolbar` 隐藏。
- Web Path Mode 设置组隐藏。
- 布局强制为 `orbital`。

浏览器模式：

- Web toolbar 仍负责 Mode/Strategy/Layout/Complete/History/Exit。

---

## 5. 服务端 HTTP API（`src/server.ts`）

基础地址：`http://localhost:3000`

### 5.1 GET 接口

| Endpoint | Query | 成功响应 | 说明 |
| --- | --- | --- | --- |
| `/api/folders` | 无 | `{ "folders": string[] }` | 当前 KB 根目录下子目录。 |
| `/api/content` | `path` | `{ "content": string }` | 文件内容读取。 |
| `/api/kb-path` | 无 | `{ "kbPath": string }` | 当前 KB 根路径。 |
| `/api/check-cache` | `target` | `null` 或 `{ "date": string, "size": number, "source"?: "active" }` | `ALL_FOLDERS` 检查活动缓存。 |
| `/api/restore-cache` | `target` | `{ "success": boolean, "deduped"?: true, "error"?: string }` | 内置短窗去重。 |

附加静态行为：

- 非 `/api/` 的 `*.js` / `*.json` 从 frontend 输出目录读取。

### 5.2 POST 接口

| Endpoint | Body | 成功响应 | 说明 |
| --- | --- | --- | --- |
| `/api/build` | `{ target, maxWorkers, enableGPU, enableGPULayout, memorySavingMode, deepDebug }` | `{ "success": true }` 或 `{ "success": true, "deduped": true }` | 相同参数并发合并；不同参数并发返回 `409`。 |
| `/api/kb-path` | `{ "kbPath": string }` | `{ "success": true, "kbPath": string }` | 更新运行时 KB 根路径。 |

### 5.3 构建去重语义

- 在途构建 + 相同参数：等待并返回去重成功。
- 在途构建 + 不同参数：返回 `409`。

### 5.4 CLI 参数说明

- 支持 `--path`、`--gpu`、`--no-gpu`、`--workers`。
- 同时读取 npm 环境参数和 `NOTE_CONNECTION_GPU`。
- npm 脚本建议用环境变量启用 GPU（`NOTE_CONNECTION_GPU=1`）。

---
## 6. Tauri Rust 命令与事件接口（`src-tauri/src/lib.rs`）

### 6.1 可调用命令

| 命令 | 签名 | 返回 |
| --- | --- | --- |
| `get_kb_path` | `() -> Result<String, String>` | 默认 KB 路径 `<projectRoot>/Knowledge_Base`。 |
| `get_user_language` | `() -> Result<String, String>` | 当前语言（现默认 `"en"`）。 |
| `get_folders` | `() -> Result<Vec<String>, String>` | KB 子目录排序结果。 |
| `set_user_language` | `(app, lang) -> Result<(), String>` | 菜单语言幂等更新。 |
| `check_cache` | `(app, target) -> Result<Option<Value>, String>` | 缓存信息或 `None`。 |
| `restore_cache` | `(app, target) -> Result<bool, String>` | 恢复成功返回 `true`。 |

### 6.2 菜单与事件

菜单动作：

- `change_kb`
- `reset_kb`
- `docs`
- `about`

发给前端的事件：

- `kb-path-changed`（payload 为路径字符串）

### 6.3 Sidecar 与 Godot 进程契约

- Sidecar 进程：`server`
- Godot 启动参数：
  - `--path E:\Knowledge_project\NoteConnection_app\path_mode`

---

## 7. PathBridge WebSocket 协议（`src/core/PathBridge.ts`）

Bridge 地址：`ws://127.0.0.1:9876`

客户端标识：

- 通过 query 参数 `client` 标记来源。
- 示例：
  - `ws://127.0.0.1:9876/?client=godot`
  - `ws://localhost:9876?client=frontend`

消息包格式：

```json
{ "type": "<messageType>", "payload": {} }
```

支持的消息类型：

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

常见 payload 键：

- `{ nodeId }`
- `{ newCenterId, autoReconstruct? }`
- `{ completedIds, timestamp? }`

当前实现会将识别消息广播给已连接客户端。

---

## 8. Path Worker 与路径载荷接口

### 8.1 Path worker（`src/frontend/path_worker.js`）

入站消息：

- `initData` -> `{ nodes, links }`
- `computePath` -> `{ mode, strategy, layout, targetId, centralId, collapsedIds, completedIds, forcedExpansionIds, expansionOrder, stickyClaimEnabled }`

出站消息：

- `pathResult` -> `{ nodes, edges, treeLayout }`

### 8.2 Web PathApp 发给 Godot 的路径载荷（`src/frontend/path_app.js`）

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

当 `treeLayout` 为空时，Godot 会回退到 legacy 线性渲染流程。

---

## 9. Godot 接口契约

### 9.1 WS 客户端（`path_mode/scripts/ws_client.gd`）

关键常量：

- `WS_URL = "ws://127.0.0.1:9876/?client=godot"`
- `RECONNECT_DELAY = 3.0`

Signals：

- `data_received(data)`
- `connected`
- `disconnected`
- `path_result(data)`
- `path_update(data)`
- `switch_center(new_center_id)`
- `completion_sync(completed_ids, timestamp)`

发送方法：

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

### 9.2 Path UI（`path_mode/scripts/path_mode_ui.gd`）

Signals：

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

发送到后端的运行时配置：

```json
{ "mode": "domain|diffusion", "strategy": "foundational|core", "layout": "orbital", "targetId": "<可选>" }
```

### 9.3 学习状态机（`path_mode/scripts/learning_state_machine.gd`）

状态：

- `IDLE`
- `VIEWING`
- `TRANSITIONING`
- `READING`

Signals：

- `state_changed`
- `central_changed`
- `node_completed`
- `node_unmarked`
- `path_complete`

持久化路径：

- `user://orbital_progress.json`

### 9.4 Path 渲染器（`path_mode/scripts/path_renderer.gd`）

Signals：

- `node_clicked(node_id)`
- `node_double_clicked(node_id)`
- `transition_complete()`

关键处理器：

- `render_path(path_data)`
- `_on_ws_data_received(data)`
- `_on_settings_updated(settings)` -> 发送 `configure`
- `_request_switch_center(target_id)` -> 发送 `switchCenter`
- `_on_mark_node_requested(node_id)` -> 发送 `markComplete`
- `_on_unmark_requested(node_id)` -> 发送 `unmarkComplete`
- `_on_exit_requested()` -> 发送 `exitPathMode`

### 9.5 树面板（`path_mode/scripts/tree_view_panel.gd`）

上抛信号：

- `node_navigate_requested`
- `node_mark_complete_requested`
- `node_unmark_requested`
- `node_toggle_requested`
- `node_expand_prereqs_requested`
- `node_collapse_prereqs_requested`
- `collapse_all_requested`
- `fullscreen_requested(expand)`

---

## 10. Web 与 Tauri 的 Path 控件归属矩阵

| 接口区域 | 浏览器模式 | Tauri 模式 |
| --- | --- | --- |
| Path toolbar（`#path-toolbar`） | 显示且可交互 | 被 `path_app.js` 隐藏 |
| Mode 控制 | Web 下拉（`#learning-mode`） | Godot `PathModeUI` |
| Strategy 控制 | Web 下拉（`#strategy`） | Godot `PathModeUI` |
| Layout 控制 | Web 下拉（`#layout-style`） | 后端/Godot 固定 `orbital` |
| Diffusion 目标选择 | Web modal（`#node-select-modal`） | Godot 目标弹窗 |
| Complete 操作 | Web 按钮（`#btn-mark-complete`） | Godot 按钮 |
| History 操作 | Web 侧栏/弹窗 | Godot 历史弹窗 |
| Exit 操作 | Web 按钮（`#btn-exit-path`） | Godot 退出流程 + `exitPathMode` |

这就是当前 Bridge-first 迁移契约。

---

## 11. 已修正 / 已移除的不一致项

1. 删除中英混排与重复段落，重建为严格 EN/ZH 分离结构。
2. 用 `server.ts` 实际实现替换过期 API 描述。
3. 修正 Godot WS URL 约束：
   - 正确：`ws://127.0.0.1:9876/?client=godot`
4. 明确当前 build/cache 去重语义。
5. 明确当前 Tauri 命令名与返回结构。
6. 补齐 Path worker 载荷与 Godot signals 契约。
7. 明确 Tauri 下 Path 控件归属已迁移到 Godot。

---

## 12. 交接检查清单

1. 目录来源必须是当前 KB 根（`/api/folders` 或 Rust 回退）。
2. 存在缓存时必须先出现“加载缓存/重新生成”选择。
3. 单次点击只触发一次 load/build。
4. 活动图谱文件必须来自 `dist/src/frontend`。
5. 模式/策略变更应触发 `configure` 并得到 `pathResult`。
6. 正常路径更新时 Godot 应收到非空 `treeLayout`。
7. Tauri 模式隐藏 Web path toolbar；浏览器模式保留。

---

---

## 13. 接口更新日志归位说明

- 规范的双语更新日志统一归档在 [`export.md`](export.md)。
- 本文档聚焦接口契约，历史迁移日志不再前置于文件开头。
- 相关接口增量版本：
- `2026-03-02 v1.5.1`：接口增量：Tauri 运行时能力对齐更新

### 已归档接口增量日志块（可追溯）
# 2026-03-02 v1.5.1

### 接口增量：Tauri 运行时能力对齐更新

本节记录 `v1.4.5` 之后新增的接口变化，下方历史交接内容保持不变。

#### A. Sidecar HTTP API（Node）

1. `GET /api/available-targets`
   - 用途：返回可选择的学习/构建目标，来源合并：
     - `Knowledge_Base` 下实际子目录
     - 缓存产物（如 `data_<target>.js`、`graph_data_<target>.json`）
   - 响应示例：

```json
{
  "targets": ["financial", "legal", "robotics"]
}
```

#### B. Tauri 命令（Rust IPC）

1. `get_available_targets() -> string[]`
   - 契约：与 `/api/available-targets` 保持同样的目标合并语义。

2. `read_node_content(file_path: string) -> Result<string, string>`
   - 契约：
     - 支持相对路径与绝对路径输入。
     - 严格限制在配置的 `Knowledge_Base` 根目录内（越界文件直接拒绝）。
     - 对包含 `.../Knowledge_Base/...` 的旧桌面路径可自动重定位到当前 KB 根目录。

#### C. 运行时能力契约更新

- `get_runtime_capabilities()` 在 Android 端现在返回 `supports_content_api: true`。
- 原因：即使 sidecar 关闭，也可通过 Rust `read_node_content` 完成内容读取。

#### D. 前端行为契约更新

1. `source_manager.js`
   - sidecar 路径优先调用 `/api/available-targets`，失败时回退到 `/api/folders`。
   - Rust 路径优先调用 `get_available_targets`，失败时回退到 `get_folders`。
   - 在 `supports_build=false`（移动端）场景：
     - 下拉列表仅保留有缓存的目标。
     - `ALL_FOLDERS` 仅在存在活动缓存时显示。
     - 无可用缓存时，加载按钮禁用。

2. `reader.js`
   - 内容加载回退顺序：
     - sidecar `/api/content`（桌面/网页路径）
     - Rust `read_node_content`（Tauri 回退/移动端可用）
     - 本地化错误或不可用提示

#### E. 验证基线

- `npm run test:migration` 通过（35 项）。
- `npm run test:tauri` 通过（14 项）。
- `npm run tauri:android:build` 通过。
