# Reference: Godot + NoteMD + Markdown Interfaces

This page is the contract-level reference for the integrated runtime among:

- Godot Path Mode client,
- embedded/full NoteMD flows,
- Markdown index/chunk/render pipeline.

## 1. Runtime Contract Boundaries

## 1.1 Sidecar and bridge endpoints

- Sidecar HTTP: `http://127.0.0.1:<port>` (default `3000`)
- PathBridge WS: `ws://127.0.0.1:<bridgePort>` (default `9876`)
- Runtime manifest fields:
  - `baseUrl`
  - `bridgeWsUrl`
  - `authToken`
  - `port`
  - `bridgePort`

## 1.2 Auth policy

If `NOTE_CONNECTION_AUTH_TOKEN` is configured:

- all `/api/*` routes are protected,
- generated graph assets are protected,
- token can be supplied by:
  - `X-NoteConnection-Token`,
  - `Authorization: Bearer <token>`.

Godot WS identify payload may also carry `token`.

## 2. Settings APIs

## 2.1 NoteMD settings

- `GET /api/notemd/settings`
  - success:
    - `success: true`
    - `settings: NotemdSettings`
    - `operationSummary: { total, running }`
- `POST /api/notemd/settings`
  - body: either full settings object, or `{ settings: ... }`
  - success: `{ success: true, settings }`

## 2.2 NoteMD workspace

- `GET /api/notemd/workspace`
  - success: `{ success: true, workspace }`
  - workspace fields:
    - `filePath`
    - `folderPath`
    - `outputFilePath`
    - `outputFolderPath`
- `POST /api/notemd/workspace`
  - body: `workspace` patch or direct patch object
  - accepts camel/snake aliases for workspace keys
  - success: `{ success: true, workspace }`

## 2.3 Path Mode settings

- `GET /api/path-mode/settings`
  - success: `{ success: true, settings }`
- `POST /api/path-mode/settings`
  - body: `{ settings: ... }` or direct settings object
  - success: `{ success: true, settings }`

`path_mode` normalized constraints:

- `bg_brightness`: `0.01..10.0`
- `reading_mode`: `window | fullscreen`
- `reader_render_mode`: `render | source`
- `reader_media_scale`: `0.1..3.0`
- `node_spacing`: `100..600`

## 2.4 Frontend settings (Markdown runtime source)

- `GET /api/frontend/settings`
- `POST /api/frontend/settings`

`frontend_settings.reading` normalized constraints:

- `markdown_engine`: `legacy | pulldown | auto`
- `chunk_block_size`: `1..4096`
- `prefetch_blocks`: `0..1024`
- `index_cache_ttl_sec`: `5..86400`
- `max_doc_bytes`: `262144..2147483648`

## 3. Markdown Protocol APIs

All markdown responses include `markdownProtocolVersion` (`1.0.0` at current baseline).

## 3.1 `POST /api/markdown/index`

Request body:

```json
{
  "filePath": "E:/.../Knowledge_Base/Topic/a.md",
  "forceRebuild": false
}
```

Success payload:

- `success: true`
- `indexId`
- `filePath`
- `fileVersion`
- `totalBytes`
- `totalLines`
- `blocksSummary: { totalBlocks, chunkBlockSize }`
- `anchorsSummary: { count }`
- `wikiLinksSummary: { count }`
- `engine: legacy | pulldown`
- optional `fallbackReason`
- `markdownProtocolVersion`

Error conditions:

- `400`: missing `filePath`
- `403`: access denied (KB jail/auth)
- `404`: file not found
- `500`: runtime/worker error

## 3.2 `POST /api/markdown/chunk`

Request body:

```json
{
  "indexId": "<index-id>",
  "startBlock": 0,
  "blockCount": 36
}
```

Success payload:

- `success: true`
- `blocks[]` (includes text slice and block ranges)
- `nextStartBlock`
- `hasMore`
- `markdownProtocolVersion`

Error conditions:

- `400`: missing `indexId`
- `500`: index missing/expired or other server error

## 3.3 `POST /api/markdown/resolve-node`

Request body:

```json
{
  "nodeId": "vector-space",
  "currentFilePath": "E:/.../current.md"
}
```

Success payload:

- `success: true`
- `filePath`
- `indexId`
- `targetBlockId`
- `startLine`
- `endLine`
- optional `anchorId`
- `markdownProtocolVersion`

Error conditions:

- `400`: missing `nodeId`
- `403`: access denied
- `404`: file not found
- `500`: unresolved node or server error

## 3.4 `POST /api/markdown/resolve-wiki`

Request body:

```json
{
  "wikiTarget": "Knowledge Base#Heading|Alias",
  "currentFilePath": "E:/.../current.md"
}
```

Success payload:

- `success: true`
- `filePath`
- `indexId`
- optional `targetBlockId`
- optional `anchorId`
- `matchType: exact | alias | heading | fallback`
- optional `candidates[]`
- `markdownProtocolVersion`

Error conditions:

- `400`: missing `wikiTarget` or `currentFilePath`
- `403`: access denied
- `404`: file not found
- `500`: server error

## 4. NoteMD Processing APIs

## 4.1 Operation model and cancellation

Long-running operations maintain server operation state:

- operation lifecycle: `running -> done | cancelled | error`
- cancellation endpoint: `POST /api/notemd/cancel` with `operationId`

Cancellation responses:

- `400` missing `operationId`
- `404` operation not found
- `200` `success: false` when operation is no longer running
- `200` `success: true` when cancellation succeeds

## 4.2 Streaming contract (SSE)

Streaming is enabled when either:

- request `Accept` contains `text/event-stream`, or
- query has `stream=1`.

SSE event types:

- `operation`
- `status`
- `log`
- `warning`
- `error`
- `done`

## 4.3 Core NoteMD endpoints

- `POST /api/notemd/test-llm`
  - body: `{ providerName? }`
- `POST /api/notemd/process-file`
  - body: `{ filePath, outputPath?, createConceptNotes?, dryRun?, operationId? }`
- `POST /api/notemd/process-folder`
  - body: `{ folderPath, outputFolderPath?, createConceptNotes?, dryRun?, operationId? }`
- `POST /api/notemd/generate-content`
  - body: `{ title?, filePath?, context?, outputPath? }`
- `POST /api/notemd/translate-file`
  - body: `{ filePath, targetLanguage?, outputPath? }`
- `POST /api/notemd/translate-folder`
  - body: `{ folderPath, targetLanguage? }`
- `POST /api/notemd/fix-mermaid`
  - body: `{ filePath, inPlace? }`
- `POST /api/notemd/fix-formulas`
  - body: `{ filePath, inPlace? }`
- `POST /api/notemd/check-duplicates`
  - body: `{ filePath }`
- `POST /api/notemd/extract-concepts`
  - body: `{ filePath, operationId? }`, supports SSE
- `POST /api/notemd/one-click-extract`
  - body: `{ filePath, operationId? }`
- `POST /api/notemd/batch-fix-mermaid`
  - body: `{ folderPath, inPlace? }`
- `POST /api/notemd/generate-folder-content`
  - body: `{ folderPath }`

Security invariant:

- file/folder paths are validated against KB root jail before I/O.

## 5. Reader Render and Clipboard APIs

## 5.1 `POST /api/render/math`

Body:

- `source` (required)
- `displayMode` (default true)
- `maxWidth`, `maxHeight`, `renderScale` (optional)

Returns rendered image payload with `pngBase64` and dimensions.

## 5.2 `POST /api/render/mermaid`

Body:

- `source` (required)
- optional:
  - `maxWidth`, `maxHeight`, `renderScale`
  - `includeStages`, `includeSvg`
  - `renderer` (`frontend|bridge|local|auto`)

Runtime behavior:

- frontend bridge preferred unless explicitly `local`,
- auto mode falls back to local `resvg` when frontend path is unavailable.

Obsidian compatibility baseline:

- Canonical Mermaid source format is fenced Markdown:
  - opening fence on its own line: \`\`\`mermaid
  - closing fence on its own line: \`\`\`
- This baseline must remain compatible in the markdown index/chunk pipeline and in Godot/Web reader rendering flows.
- Inline concatenation patterns such as `$$```mermaid` are malformed content (not valid canonical fenced start) and are expected to fail block-type detection.
- Recommended remediation for `$$```mermaid`: split into two lines (`$$` then ` ```mermaid`), or run:
  - `npm run fix:markdown:mermaid:fence -- Knowledge_Base/testconcept`
- Reader-side fast self-check: when opening markdown reader content, runtime applies lightweight auto-heal for `$$```mermaid` before block parsing/rendering.

## 5.3 Clipboard routes

- `POST /api/clipboard/image-binary`
  - raw PNG body
  - success: `{ ok: true, transport: "binary" }`
- `POST /api/clipboard/image`
  - JSON `{ pngBase64 }`
  - success: `{ ok: true }`

## 6. PathBridge Message Contracts Relevant to NoteMD/Markdown

Accepted/normalized types include:

- `openNotemd` / `open_notemd` -> broadcast `openNotemd`
- `exitPathMode` -> broadcast `exitPathMode`
- `requestAppShutdown` / `request_app_shutdown` -> broadcast `requestAppShutdown`
- `setWindowVisible` -> broadcast `setWindowVisible`

Frontend `path_app.js` actions:

- `openNotemd` triggers embedded/full NoteMD open path.
- `exitPathMode` restores graph/main view (and Tauri window when configured).
- `requestAppShutdown` invokes Tauri shutdown command when available.

## 7. Critical Compatibility Invariant

Godot Mermaid consumption must remain PNG-first:

- `pngBase64` is required for runtime display path,
- SVG can be preserved for diagnostics only,
- no SVG-only fallback path is allowed for Godot runtime rendering.

This is a hard compatibility rule due Godot SVG instability across devices/runtime variants.

## 8. Implementation Guardrails for Interface Changes

When changing any endpoint/message above:

1. update both EN and ZH docs in `docs/diataxis`,
2. keep request/response examples versioned with actual fields,
3. preserve KB jail validation on file/folder inputs,
4. preserve auth-token behavior for protected routes,
5. preserve NoteMD cancellation + SSE semantics for long operations,
6. preserve markdown protocol version field in responses.
