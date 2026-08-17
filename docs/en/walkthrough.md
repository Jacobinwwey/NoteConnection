# 2026-03-04 v1.5.13 - Tauri/Godot Migration Walkthrough Addendum

## English Document

### 2026-06-10 Knowledge Workspace Runtime Walkthrough

1. The user selects or inherits a scoped workspace/corpus target.
2. `agent_workspace.js` sends the conversation request with `activeTarget` and `scope`.
3. `KnowledgeLearningPlatform.agentConversation()` resolves scoped retrieval, grouped knowledge points, citations, memory actions, and a durable `knowledgeRun`.
4. `conversationComposer.ts` organizes the grounded reply into structured blocks while preserving legacy `assistantMessage`.
5. The frontend renders the reply and presents grouped file-first knowledge hits.
6. Source markdown can be opened in the graph-focus pane, where matched spans are highlighted in-place.
7. Durable workflow artifacts such as `flashcard_batch` and `knowledge_run` can be queried and followed up through dedicated runtime endpoints.

### What This Means Now

- Structured grounded conversation is operational.
- Graph focus is already a reader-aligned evidence surface.
- Durable artifact-backed review loops now exist in the runtime.
- The current DAG-backed learning substrate is real, but answer planning still lacks a dedicated graph-conditioned context layer.

### Runtime Walkthrough (Current)

This addendum documents the current Bridge-first runtime flow after migration progress:

1. Tauri launches the Rust host process.
2. Rust spawns the Node sidecar and Godot executable.
3. Godot connects to PathBridge (`ws://127.0.0.1:9876`).
4. Backend receives configuration/path actions through bridge messages.
5. Graph data is restored from cache or rebuilt and then synchronized to frontend/Godot consumers.

### What Is Working

- Sidecar startup and graph build pipeline execute successfully in Tauri mini GPU runs.
- Worker-thread graph stages (keyword/statistical/layout workers) resolve from runtime paths correctly in sidecar execution.
- Path Mode control migration is operational with Godot-driven settings and actions.

### What Still Needs Verification

- Existing-data prompt behavior must consistently ask users to reuse cache or rebuild before load.
- Startup should avoid duplicate load execution after a single load action.
- WebSocket startup sequencing should avoid redundant early disconnect/reconnect cycles.
- History recording should capture center-node switching triggered by double-click navigation in Godot.

### Validation Checklist

1. Run `npm run tauri:dev:mini:gpu`.
2. Select a source that already has cached data.
3. Confirm exactly one prompt appears and exactly one load path executes.
4. Confirm no duplicate build/restore in sidecar logs.
5. Confirm History list updates when switching central nodes in Godot.

---

# Path Mode Improvements Walkthrough

## 1. Critical Fix: Navigation Failure

**Issue**: When double-clicking a node or switching the center, the Tree View would crash and revert to a linear list because the `treeLayout` data was missing from the update payload.
**Fix**: Updated [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js)'s [switchCentral](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#1004-1014) function to explicitly call [triggerUpdate()](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#539-566). This forces the Web Worker to re-calculate the full `treeLayout` (including correct levels and connections) for the new central node before sending it to Godot.

## 2. Visual Enhancements (Godot)

- [x] **In-Degree Display Setting**: Added option to toggle between "Visible" (default) and "Total" In-Degree counts in Node Popup.
- [x] **Godot Lazy Loading**: Implemented "Expand (+)" and "Collapse (-)" buttons in Godot Tree View to manage prerequisite visibility.
- [x] **i18n Fixes**: Added missing keys `focus_inbound`/`focus_outbound` to English and Chinese locales.

### Godot Tree View Features

- **Visuals ("Zen Mode")**: Simplified view removing all extra buttons. Only nodes and connections are visible.
- **Interactions**:
  - **Double Click / Right Click**: Toggle Context (Expand/Collapse prerequisites).
  - **Long Press (Left)**: Navigate to Node (Switch Central). Visualized by a progress ring overlay.
  - **Middle Click**: Collapse All nodes (Reset view).
- **Focus Mode**:
  - Toggle via Settings ("Focus on this node").
  - Highlights the Central Node and its direct incoming prerequisites.
  - Dims all other nodes to reduce clutter and focus on immediate dependencies.
- This creates a cleaner, less cluttered tree where lines only connect direct neighbors (Level 1 → Level 2), as requested.

**Last Node Cleanup**:

- The "Expand" button logic relies on data validation. With the `treeLayout` now correctly re-computing, the "Target" node (which corresponds to the end of the chain) correctly reports `0` children in the layout, so the expand button will automatically be hidden.

## Verification

- **Navigation**: Double-clicking nodes in Tree View now correctly keeps the Tree View active and re-centers the graph.
- **Aesthetics**: Long, confusing Bezier curves skipping levels are gone.
- **Data**: In-degree numbers are visible.

## 3. Bug Fixes (Interaction & Data)

- **Missing Edges**: Fixed `treeLayout` having 0 edges by sanitizing data in [path_app.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js) (converting Object references back to ID strings for the worker).
- **Right-Click Toggle**: Fixed "Cannot Collapse" bug by:
  - Patching [path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js) to correctly pass `isExpanded` state.
  - Updating [PathBridge.ts](file:///e:/Knowledge_project/NoteConnection_app/src/core/PathBridge.ts) to relay [collapsePrereqs](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#247-254) messages (which were previously dropped).
- **Collapse All**:
  - Added a visible `[-]` button to the Godot UI.
  - Updated [PathBridge.ts](file:///e:/Knowledge_project/NoteConnection_app/src/core/PathBridge.ts) to relay the [collapseAll](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/path_app.js#255-261) message.

---
---

# v1.4.3 - 9-Rule Tree Layout Engine Walkthrough (2026-02-26)

## Analysis Summary

Performed comprehensive gap analysis between `tree_path_mockup.html` (702 lines, 9 rules) and production code.

### Files Analyzed

| File                    | Lines | Purpose                                                 |
| ----------------------- | ----- | ------------------------------------------------------- |
| `tree_path_mockup.html` | 702   | Reference implementation with all 9 rules               |
| `path_core.js`          | 1375  | Production core algorithm (`getTreeLayout()` L742-1133) |
| `tree_renderer.gd`      | 531   | Godot tree visualization                                |
| `tree_view_panel.gd`    | 159   | Godot panel controller                                  |
| `path_app.js`           | 1166  | Frontend bridge and interaction handler                 |

### Key Findings

- **8 of 9 rules** are completely missing from production
- **5 core concepts** absent: ownership, expansion order, effective index, visibility chain, hull collision avoidance
- **7 existing features** preserved: spine ID, contour collision, tributary placement, hull drawing, collapse state, WebSocket bridge, tree renderer
- **Production code is geometrically correct** but lacks the semantic claiming/ownership layer

### Documents Updated

- [implementation_plan.md](file:///e:/Knowledge_project/NoteConnection_app/implementation_plan.md) — Phase 3 with 13 steps
- [brainstorming.md](file:///e:/Knowledge_project/NoteConnection_app/brainstorming.md) — Session 6: Ownership Engine design
- [task.md](file:///e:/Knowledge_project/NoteConnection_app/task.md) — v1.4.3 checklist (EN + ZH)
- [TODO.md](file:///e:/Knowledge_project/NoteConnection_app/TODO.md) — v1.4.3 implementation checklist

### Next Steps

Implementation of 13 steps across 4 components (Core Algorithm, Frontend Bridge, Godot Renderer, Worker Communication).

## 2026-08-17 Identity and Mobile Guardrail Walkthrough

The target/data build and `NoteConnection` pass `kbRoot` into `FileLoader`, so full-workspace and subdirectory scans emit the same `relativePath` and `sourceUri`; callers that omit the root remain compatibility-only. Learning ingest keeps identity fields optional, path-only moves retain URI/revision, and URI/alias deletes resolve before the legacy path normalizer. Android checks metadata sizes before reading bodies and rejects over-budget document, byte, or edge counts; link candidates are extracted at read time so the intermediate projection does not retain document bodies. This is an admission guard, not device RSS evidence.

---
- Phase 8 replay validates a temporary graph before swapping it in, records explicit document moves, and preserves aliases for old layouts and deletes. Mobile exact analysis now resolves URI/alias references and reports explicit versus inferred edge provenance without document bodies. Bridge 2.0 capability and cancellation fields are additive; full device/APK and registry-parity evidence remains open. Current evidence is 35 replay/identity tests, 70 core/route tests, 501 learning tests, 51 mobile contract tests, and 26 Rust tests.

## 2026-08-17 Phase 9 Verification

The route shadow run passed with 14 legacy-equivalent and 6 registry-only probes. It caught and fixed response-shape and error-status drift instead of normalizing those differences away. `NOTE_CONNECTION_ROUTE_DISPATCH_MODE=legacy` remains available for rollback diagnosis.

The APK/AAB verifier is static and tooling-light: it reads ZIP central-directory metadata, requires arm64 in release mode, rejects Godot/sidecar/model/SVG leakage, enforces profile payload budgets, and requires an explicit RSS JSON. SQLite now has a close/reopen replay fixture, while graph restore has an atomic rollback fixture. Signed arm64 artifacts, device RSS, cross-host replay, and canonical-ID cutover remain open.
## 2026-08-17 Phase 10 Projection and Host Adapter Walkthrough

- `knowledge_projection_contract.js` is loaded before the mobile analyzer and storage provider, so Capacitor and browser replay use the same body-free schema.
- Tauri Rust writes schema `1` identity metadata and bounded adjacency; Android continues to clear document bodies after link extraction.
- `PathBridgeHostAdapter` is opt-in and preserves legacy relay semantics when absent. Adapter execution returns correlated results and handles timeout, disconnect, abort, and cancel propagation.
- Verification passed: `build:mini`, mobile-slim staging (120 files / 4,251,345 uncompressed / 1,545,813 estimated compressed), migration matrix (57 suites / 307 tests), focused projection/Bridge tests, `cargo check`, and targeted Rust tests. `rustfmt` is unavailable locally; signed arm64 APK/AAB and device RSS remain open.

## 2026-08-18 Projection Store and SAF Walkthrough

The runtime path is now `graph_data.json` -> `knowledge_projection_store.js` -> versioned projection contract -> `mobile_exact_analyzer`. Persistent hosts can provide `read/write`; a memory adapter preserves the last successful projection during a transient storage failure and still rejects unknown future schemas.

Android uses an asynchronous SAF state machine: Rust requests `ACTION_OPEN_DOCUMENT_TREE`, Kotlin streams Markdown files into app-local `filesDir/Knowledge_Base` within the existing 16 MiB/document and 64 MiB/total budgets, then Rust polls a short result marker and persists only the app-local path. The external URI remains provenance, not identity. This keeps mobile packages sidecar/Godot/model/SVG free while supporting user-selected knowledge bases.

Verification: 24 focused Jest tests, TypeScript no-emit, and 26 Rust tests pass. Generated Android patching is idempotent; a fresh arm64 slim build produced an unsigned APK (9,555,787 bytes) and AAB (7,179,228 bytes), and static artifact verification passed with no forbidden entries. Signed arm64, device import, and RSS evidence remain open.
