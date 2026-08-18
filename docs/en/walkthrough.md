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

## 2026-08-18 Phase 12 App-Local Replay Walkthrough

The mobile load path now has an explicit file boundary:

`graph_data.json` -> `createFileProjectionStore()` -> versioned projection contract -> `mobile_exact_analyzer`.

`createFileProjectionStore()` takes a host-owned `readFile(fileName)` and an optional `writeAtomic(fileName, serialized, projection)`. It deliberately stores the existing raw schema-1 projection rather than a new envelope, so Tauri/Rust and Android/Kotlin writers remain compatible. `storage_provider.js` selects this factory when available and falls back to the legacy generic store for older runtimes.

The store distinguishes I/O failure from data incompatibility. A read failure can reuse the last successful value; malformed JSON, a future schema, invalid node/edge identity, or a size violation is surfaced and blocks analysis. The first load still reads the file even when an initial projection is supplied, so a stale bootstrap value cannot mask a newer app-local projection.

Run the deterministic evidence command:

```text
npm run verify:mobile:projection-replay
```

It performs an atomic save in a temporary app-local directory, drops the first store instance, recreates a read-through store for Web/Tauri/Capacitor/Android, and compares metadata, exact search, neighbors, and shortest path. It then writes `output/verification/mobile-projection-replay/report-latest.json` and verifies truncated JSON and unknown schema fail closed. The output directory is ignored and is not a source artifact.

After this change, `mobile:prepare:slim` stages 120 files (4,253,837 uncompressed; 1,546,201 estimated compressed). The rebuilt unsigned arm64 APK/AAB static payloads are 9,436,196 and 6,983,880 bytes; both remain below the 25 MiB budget and neither measurement includes device RSS.

The route-shadow gate also waits for three consecutive stable runtime-directory manifests after readiness. This is required because the registry backend may finish its first SQLite initialization asynchronously after `/api/knowledge/state` returns; without the wait, a slow host can produce a false read-only side-effect failure.

This closes code-level G3 replay evidence, not the device gate. A signed arm64 artifact, physical Android process-death/SAF import/query/path run, and peak RSS <= 256 MiB are still required. SQLite/WASM remains an opt-in future adapter because the current bounded exact workload does not justify its mobile size, startup, and heap costs.

## 2026-08-18 Phase 13 Native Import Recovery Walkthrough

The Android SAF import now has a restart-safe transaction boundary:

`ACTION_OPEN_DOCUMENT_TREE` -> bounded staging tree -> import journal -> backup/activate -> atomic result marker.

`KnowledgeBasePickerBridge` writes `knowledge_base_import_journal.v1.json` beside the app-local knowledge base. The journal records only app-local transaction names and an explicit phase. `MainActivity.onCreate()` calls recovery before the picker is exposed. A target that already exists wins cleanup; a missing target with a backup restores the previous knowledge base; abandoned staging is deleted. Invalid schema or path-escaping journal data fails closed.

The result marker keeps the existing Rust request/poll contract, but now uses a sibling temporary file, `fsync`, and rename. This prevents a process death from turning a partially written marker into a false `completed` state. The journal is an internal durability mechanism, not a projection-schema change, so older clients and public IDs remain compatible.

Verification for this increment: the Android picker contract suite, mobile profile/artifact contract suites, TypeScript no-emit, the 57-suite migration matrix (307 passed, 13 skipped), and `app:compileArm64ReleaseKotlin` pass. The current host has no online Android device, configured AVD, signing keystore, or RSS capture; G2/G3 native device evidence remains open.

## 2026-08-18 Phase 14 Signed Device Evidence Walkthrough

The release path is now explicit:

```text
signed arm64 APK
-> verify ZIP/arm64/signature/budget
-> install on selected Android device
-> SAF import -> graph build -> exact query -> path
-> force-stop -> relaunch -> continuity query
-> sample /proc/<pid>/status:VmRSS
-> write manifest + rss.json + logcat tail
```

`capture-tauri-android-rss-evidence.js` accepts only a schema-1 workload spec with explicit `adbArgs`. It requires the five ordered phases, rejects duplicate or missing steps, masks serials, records artifact SHA-256 and signature metadata, and fails without an observed process death or RSS sample. The recorder is an evidence boundary, not a UI automation claim: SAF taps and continuity assertions must be supplied by the device-lab workload.

The current host can run the parser and contract tests, but has no signing keystore, online device, configured AVD, or workload spec. Therefore no `latest.json` is produced and G2/G3 remain pending. Static slim size and unsigned arm64 checks continue to be reported separately.

## 2026-08-18 Phase 15 Native Boundary and Identity Corpus Walkthrough

The projection replay report now exercises four distinct host boundaries:

```text
Web storage -> projection store
Tauri atomic file -> temporary file + rename
Capacitor filesystem -> bounded chunk writer + rename
Android app-local file -> journaled backup/activation
```

Each host entry records its adapter kind and `host-boundary-contract` evidence level. This closes the previous false signal where four labels all called the same Node `fs` adapter, while keeping device-only claims pending.

The graph projection now carries `canonicalId` as additive metadata derived from `sourceUri`. Legacy `id` remains unchanged, old layouts remain readable, and the exact analyzer resolves both IDs. Duplicate canonical IDs are rejected before analysis; no public-ID cutover is performed.

Route shadow expanded to 17 equivalent probes. Malformed JSON now yields the same 400 body and `X-Error-Code: invalid_json` on both dispatch paths, and inline `/api/build` rejects unsupported recompute modes before graph mutation. The G4 corpus covers same-content isolation, NFC/case collision, cross-root normalization, legacy snapshot replay, and atomic rollback.

Android graph loading now caps each file before full UTF-8 materialization, so a file changed after directory enumeration cannot bypass the mobile memory budget. Verification remains split: host contract tests may pass locally, but signed-device SAF, process-death continuity, and RSS <= 256 MiB are still required for G2/G3.

The current post-change slim staging measures 121 files, 4,263,740 uncompressed bytes, and 1,548,695 estimated compressed bytes. Existing APK/AAB files are older unsigned outputs and must be rebuilt before they can be attributed to this source revision.

Verification snapshot: full Jest 144 suites / 1,263 passed / 26 skipped; TypeScript no-emit, Rust host and Android arm64 checks, projection replay, route shadow (17 + 6 probes), slim budget, and Diataxis all pass. Real signed-device evidence remains unavailable.

## 2026-08-18 Phase 16 Portable Identity Propagation Walkthrough

`canonicalId` now travels through every current projection producer. TypeScript identity generation, `FileLoader`, and desktop `GraphBuilder` emit it additively; the browser identity contract and Capacitor graph use the same normalized path rule; Android Rust emits the same field from its normalized relative path. Legacy `id` remains the graph key, so old layout and snapshot replay are unchanged.

The important boundary is semantic, not cosmetic: `canonicalId` is the cross-host comparison key, while `sourceUri` remains the portable provenance and `id` remains the compatibility alias. Duplicate canonical identities still fail closed. This lets the next corpus compare node and edge meaning without forcing a public-ID migration.

## 2026-08-18 Phase 17 Cross-Host Semantic Parity Walkthrough

The parity boundary is now executable. `mobile_semantic_comparator.js` ignores host-specific legacy IDs and compares normalized canonical nodes plus directed edges with endpoint URI, type, kind, and provenance. It rejects duplicate semantic identities so a collision cannot be hidden by ordering.

Capacitor link resolution now follows the Rust policy: direct canonical path, source-relative path, then unique stem fallback. Both worker and single-thread paths use the same resolver. Rust decodes percent-encoded Markdown targets, normalizes NFC/lowercase, and rejects duplicate canonical paths and ambiguous legacy basenames. The projection contract preserves distinct provenance when two mechanisms connect the same endpoints.

`verify-mobile-projection-replay.js` creates one temporary corpus containing nested paths, relative and Markdown links, same-content documents, and an NFC-normalized percent-encoded path. It builds the corpus through Capacitor and an actual ignored Rust Cargo probe, then reports semantic equality (`6` nodes, `4` edges). This is stronger code-level evidence than raw JSON equality, but it remains below signed-device, SAF UI, process-death, and RSS acceptance.

The forward-compatible decision is unchanged: keep `id` and schema-1 snapshots stable, keep the comparator out of the mobile runtime bundle, and defer public canonical-ID or SQLite/WASM promotion until native replay, rollback, move-journal, collision, and RSS evidence are archived.

Full verification passes 146 Jest suites / 1,271 passed / 26 skipped, TypeScript no-emit, and 28 Rust host tests plus 1 ignored probe. Focused parity coverage is 3 suites / 12 tests; the new recovery contract is an additional 1 suite / 1 test. Fresh `mobile-slim` staging is 121 files / 4,275,083 uncompressed bytes / 1,550,638 estimated compressed bytes with SHA-256 `5d5bafa20770bf42531b2e39ec62364537e0eade83b29a9aa2209f4f03bf7c38`; the test-only comparator and recovery verifier are excluded and RSS remains `not measured`. Code-level semantic parity and host recovery replay pass; signed-device SAF/query/path, process-death continuity, and RSS <= 256 MiB remain open gates.

## 2026-08-18 Phase 18 Native Recovery State-Machine Walkthrough

`verify-mobile-native-recovery.js` replays the production Kotlin journal contract in a temporary host directory. The six scenarios are state-oriented: an existing target wins over staging/backup artifacts; a missing target is restored from a valid backup; orphan backups are recovered; unsafe journal paths and unknown schemas fail closed.

The contract test emits schema-1 evidence with `evidenceLevel: host-recovery-state-machine` and `nativeDeviceEvidence: false`. This is a deterministic host mirror and CI drift detector, not Android process-death, SAF UI, storage/permission failure, signed artifact, or RSS evidence. The mobile runtime remains Kotlin-owned and the verifier is excluded from mobile-slim.

The next gate is still native: signed arm64 execution, SAF import/query/path, force-stop/reopen continuity, failure-path replay, and RSS <= 256 MiB on representative low-memory hardware. Public-ID and SQLite/WASM promotion remain frozen until those artifacts and the old-snapshot/move-journal/collision/rollback corpus are archived.
