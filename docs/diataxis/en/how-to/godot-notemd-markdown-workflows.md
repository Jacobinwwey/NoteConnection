# How-To: Godot + NoteMD + Markdown Workflows

This guide turns the current runtime contracts into executable operator steps for day-to-day development.

## 1. Scope

Use this guide when you need to:

- run Path Mode with the Godot renderer,
- operate the embedded NoteMD panel from Godot,
- debug Markdown index/chunk navigation and wiki-link resolution flows.

For field-level API contracts, use:

- [Godot + NoteMD + Markdown Interfaces](../reference/godot-notemd-markdown-interfaces.md)

## 2. Runtime Startup

### 2.1 Desktop dev startup

Run the standard desktop path:

```bash
npm run tauri:dev
```

`tauri:dev` builds frontend assets, ensures sidecars, cleans stale copied sidecars, and launches Tauri.

### 2.2 Runtime manifest and sidecar endpoints

Godot runtime clients resolve sidecar host/port from:

1. env overrides (`NOTE_CONNECTION_PORT`, `NOTE_CONNECTION_BRIDGE_PORT`),
2. runtime manifest (`NOTE_CONNECTION_RUNTIME_MANIFEST`),
3. fallback defaults (`127.0.0.1:3000`, bridge `127.0.0.1:9876`).

The runtime manifest includes:

- `baseUrl` (HTTP sidecar),
- `bridgeWsUrl` (PathBridge WebSocket),
- `authToken` (if token protection is active).

## 3. Godot Path Mode Workflow

### 3.1 Single-window behavior

In Tauri single-window flow:

- Godot can start hidden and be shown via bridge visibility messages.
- Exiting Path Mode sends `exitPathMode`, and frontend/Tauri restores the main window.

### 3.2 Core bridge controls

Godot `ws_client.gd` sends:

- `configure`,
- `switchCenter`,
- `markComplete` / `unmarkComplete`,
- `toggleCollapse` / `expandPrereqs` / `collapsePrereqs` / `collapseAll`,
- `exitPathMode`,
- `open_notemd`,
- `requestAppShutdown`.

PathBridge normalizes and re-broadcasts these into frontend-consumed message types.

## 4. Embedded NoteMD Workflow (from Godot)

The embedded panel (`notemd_embed_panel.gd`) supports:

- One-click extract: `POST /api/notemd/one-click-extract`
- Batch generation: `POST /api/notemd/generate-folder-content`
- Batch Mermaid fix: `POST /api/notemd/batch-fix-mermaid`
- Workspace sync:
  - `GET /api/notemd/workspace`
  - `POST /api/notemd/workspace`

### 4.1 Recommended operator sequence

1. Select source Markdown file in embedded panel.
2. Run One-Click Extract to scaffold concept files and batch-generate content.
3. Run Batch Mermaid Fix for generated notes.
4. Use "Open Full Workspace (Tauri)" when you need full NoteMD UI.

### 4.2 PDF handling constraint

Embedded NoteMD flow does not process PDF directly.

- Convert PDF to `.md` first (for example with MinerU).
- Then process Markdown through NoteMD endpoints.

## 5. Markdown Reader Workflow

Godot Reader runtime calls:

- `POST /api/markdown/resolve-node`
- `POST /api/markdown/index`
- `POST /api/markdown/chunk`
- `POST /api/markdown/resolve-wiki`

Recommended sequence for node reading:

1. Resolve node -> file + target block.
2. Build or reuse index (`indexId`).
3. Pull chunks by `indexId` and render blocks.
4. Resolve wiki links in-context using `currentFilePath`.

## 6. Render and Clipboard Workflow

Reader rendering APIs:

- `POST /api/render/math`
- `POST /api/render/mermaid`

Clipboard APIs:

- Preferred: `POST /api/clipboard/image-binary` (PNG bytes).
- Fallback: `POST /api/clipboard/image` (`pngBase64` JSON).

Mermaid rendering policy:

- Frontend-bridge renderer is preferred when available.
- Local `resvg` fallback is used if frontend renderer is unavailable in `auto` mode.
- PNG payload is authoritative for Godot runtime consumption.

## 7. Auth and Access Control

If `NOTE_CONNECTION_AUTH_TOKEN` is set:

- all `/api/*` routes and generated graph assets require auth,
- clients can authenticate via:
  - `X-NoteConnection-Token: <token>`, or
  - `Authorization: Bearer <token>`.

Godot WS identify payload can include `token`, and HTTP helpers append auth header when token is present.

## 8. High-Value Troubleshooting

### 8.1 Markdown index fails

Check:

- `filePath` is non-empty,
- extension is `.md` or `.markdown`,
- file size is below configured `maxDocBytes`,
- path resolves inside KB root.

### 8.2 NoteMD request denied

Most common cause is KB-root path jail.

- verify file/folder path is inside configured `Knowledge_Base`,
- confirm auth token if protection is enabled.

### 8.3 Empty Mermaid render in Godot

Check:

- response includes `pngBase64`,
- bridge frontend renderer availability,
- fallback to local renderer for diagnostics.

## 9. Release-Gate Checklist Before New Feature Work

- `path_mode` settings GET/POST round-trip works.
- `notemd/workspace` sync works (panel restore + save).
- One-click extract + generate-folder + batch-fix flows are healthy.
- Markdown resolve/index/chunk/wiki-link APIs are healthy.
- `open_notemd` and `exitPathMode` bridge events are healthy.
- Mermaid and clipboard render/copy paths are healthy.

Complete this baseline before starting the next functional development slice.
