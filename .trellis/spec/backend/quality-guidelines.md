# Quality Guidelines

> Code quality standards for backend development.

---

## Overview

Quality gates are test-driven and contract-first. Every subsystem has contract tests that validate API surface, type consistency, and behavioral contracts. TypeScript strict mode is enabled (`tsconfig.json`).

---

## Forbidden Patterns

| Pattern | Why |
|---------|-----|
| Direct `better-sqlite3` calls outside `src/learning/store.ts` | Bypasses the store abstraction |
| Ad-hoc `fs.readFile`/`fs.writeFile` for graph persistence | Must use `KnowledgeGraphStore` |
| Raw SQL in route handlers | All data access through store + in-memory queries |
| `any` type in API signatures | TypeScript strict mode; use `unknown` and narrow |
| Swallowed errors (`catch {}`) | Every error must be handled or re-thrown |
| `throw` across HTTP boundary | Always return `{ ok: false, error: String(err) }` |
| Mutating global config from request handlers | Use request-level overrides (e.g., `queryBackend` field) |

---

## Required Patterns

- **Contract tests**: Every new API route or type change must ship with a contract test (`*.contract.test.ts`).
- **Type exports**: Public API types are exported from `src/learning/types.ts` and `src/learning/api.ts`.
- **Named exports**: Default to named exports; avoid default exports.
- **`PascalCase` for classes and interfaces**: `KnowledgeGraphStore`, `SqliteKnowledgeGraphStore`.
- **`camelCase` for functions and variables**: `loadSnapshot`, `lastError`.
- **`UPPER_SNAKE_CASE` for constants**: `DEFAULT_KNOWLEDGE_GRAPH_STORE_KIND`.
- **Worker isolation**: Heavy computation (layout, statistics, keyword matching) runs in `Worker` threads under `src/backend/workers/`.

---

## Testing Requirements

### Framework

Jest with `ts-jest` (configured in `jest.config.js`). Node.js 20 is the CI target.

### Test Types

| Type | Pattern | Example |
|------|---------|---------|
| Contract test | `*.contract.test.ts` | `src/knowledge.api.contract.test.ts` |
| Behavioral test | `*.test.ts` | `src/learning/KnowledgeLearningPlatform.test.ts` |
| Integration test | `*.integration.test.ts` | `src/notemd.server.integration.test.ts` |
| Persistence test | `*.persistence.test.ts` | `src/learning/KnowledgeLearningPlatform.persistence.test.ts` |

### Requirements

- **Contract tests are mandatory** for new API routes and type changes.
- **Tests are colocated** with source files (`src/learning/types.ts` → `src/learning/KnowledgeLearningPlatform.test.ts`).
- **Enough coverage to fail fast**: if an API contract changes, at least one test must break.
- Run with: `npm test` (full suite) or `npm test -- --testPathPattern=<file>` for targeted runs.

---

## Code Review Checklist

1. Does the change ship with a contract test?
2. Are errors caught and returned as `{ ok: false, error: String(err) }`?
3. Is `console.error` prefixed with route/context?
4. Are types exported from `src/learning/types.ts` or `src/learning/api.ts`?
5. Is database access through the store interface?
6. Does the change avoid `any` in public API signatures?
7. For performance-sensitive code: is `PerformanceLogger` used for timing?

## Linux AppImage Packaging Contract

### Scope

Changes to the Tauri CLI, sidecars, Linux build runner, or release workflow must preserve the final artifact's portability. Build Linux releases on Ubuntu 22.04 (glibc 2.35), the catalog baseline.

### Commands

Use `npm run tauri:build:mini`, move the generated `src-tauri/<AppImage basename>.zsync` next to the final image, then run `npm run verify:appimage -- <image.AppImage> <original-server-sidecar>`. Both verifier arguments and the adjacent control file must come from the same build. Clear previous `src-tauri/*.AppImage.zsync` before building so a missing generator cannot reuse old output.

### Boundary and environment

The Linux runner selects `scripts/appimage-patchelf.js` through `PATCHELF`. `NOTE_CONNECTION_APPIMAGE_PATCHELF` identifies the original executable; `NOTE_CONNECTION_APPIMAGE_SERVER_SUFFIX` and `NOTE_CONNECTION_APPIMAGE_SERVER_SHA256` identify the protected pkg sidecar. Only its `--set-rpath` write is suppressed; dependency queries and other ELF operations remain enabled. AppRun supplies the sidecar's library search path. Never rewrite pkg's completed ELF payload offsets.

`scripts/appimage-update.js` owns the native `gh-releases-zsync` contract for the current amd64 release. The Linux runner passes it through `LDAI_UPDATE_INFORMATION`; the official bundled appimagetool/zsyncmake generates the control after the final metadata/signing writes. Tauri CLI 2.12.1 changes CWD to `src-tauri` in `crates/tauri-cli/src/build.rs:166`, and official zsyncmake 0.6.2 emits basename.zsync in that CWD. The release workflow already owns final artifact paths, so it moves each exact control beside its image and fails if absent. Do not add a second Tauri CLI parser or search guessed directories to collect it.

Keep the product release Latest and Godot mirrors `latest=false`. Publish exactly one matching amd64 `.zsync` with its AppImage, and include both in checksums and the final asset manifest. An unsupported architecture must not pass the current release gate. Preserve v1.9.0: it lacks embedded metadata, so testing it as a delta seed requires the explicit new control URL.

### Validation and errors

The final verifier rejects inaccessible stored SquashFS modes, invalid integration symlinks, missing desktop executables/icons, invalid image decoding, and any server hash mismatch. A matching path with changed bytes makes the patchelf adapter fail. Metadata success alone does not prove that the ELF loader, WebView, or backend starts.

The same two-argument verifier requires correct embedded update information and the adjacent control file. It validates the official plain-file header, basename/relative URL, exact Length/SHA-1 and checksum table length `ceil(Length / Blocksize) * (rsum_bytes + checksum_bytes)`. The first `Hash-Lengths` field is a sequence count, not bytes per table entry. Never implement rsync weak hashes or MD4 to duplicate the official updater; table-content correctness is accepted through official reconstruction followed by full target SHA-256 equality.

### Acceptance cases

- Good: the Ubuntu 22.04 artifact launches as a normal user, serves authenticated graph/reader requests, and shuts down its sidecars.
- Base: `.DirIcon` resolves inside the image, `AppRun.wrapped` is executable by other users, and the packaged server equals the original file.
- Bad: testing only on the newer build host, resolving links against the CI workspace, or accepting a visible shell window while its backend has crashed.

### Required tests

Run the update, portability and patchelf behavioral suites. Update tests must cover a good official control fixture, missing/stale controls, same-size image corruption, malformed headers/tables and wrong owner/repository/channel/architecture/URL. Verify the final image on the baseline OS and a newer host, retaining its SHA-256, logs, and screenshots. The installed Markdown worker must be discovered under Tauri's suffixless name and report `engine: pulldown` without a missing-worker fallback.

Run the offline simulation worker suite and load a graph with external networking disabled, keeping loopback available for the sidecar. Graph layout dependencies must be bundled; an initial window and successful graph API do not establish that worker-produced node positions render.

### Wrong and correct evidence

An extracted directory with manually repaired links is diagnostic evidence. A fresh image produced by the corrected build, checked outside the build directory and exercised through the catalog worker and native runtime, establishes release acceptance. Use `unsquashfs` for stored-mode checks: runtime `--appimage-extract` can alter directory permissions.
