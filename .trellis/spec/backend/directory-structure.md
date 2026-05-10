# Directory Structure

> How backend code is organized in this project.

---

## Overview

The backend is a single-repo TypeScript codebase with the server entry at `src/server.ts`. Modules are organized by domain, not by layer — each directory owns its types, logic, and tests.

---

## Directory Layout

```
src/
├── server.ts              # CLI + HTTP server (routes, middleware, IPC)
├── index.ts               # Graph build API exports
├── reader_renderer.ts      # Markdown reader/renderer core
├── backend/               # Graph build + analysis pipeline
│   ├── algorithms/        # StatisticalAnalyzer, HybridEngine, LayoutEngine, etc.
│   ├── wasm/              # Rust-compiled compute WASM + parity runtime
│   ├── workers/           # Node Worker threads (layout, keywordMatch, etc.)
│   ├── utils/             # CrashLogger, PerformanceLogger, stringUtils
│   ├── GraphBuilder.ts    # Core DAG + relation graph builder
│   ├── GraphMetrics.ts    # Centrality, community, connectivity metrics
│   └── ...
├── core/                  # Platform-agnostic graph/layout engine
│   ├── PathBridge.ts      # WebSocket bridging for Godot/Tauri
│   ├── PathEngine.ts      # Path computation, learning domain logic
│   ├── Graph.ts           # Graph data structures
│   └── types.ts           # Core type contracts
├── learning/              # Knowledge mastery platform
│   ├── api.ts             # Public API interface
│   ├── types.ts           # Type contracts (atom, evidence, mastery, tutor, memory)
│   ├── KnowledgeLearningPlatform.ts  # Platform implementation
│   ├── store.ts           # Graph persistence (file-backed + sqlite)
│   ├── queryBackend.ts    # Query backend separation
│   ├── tutorAdapter.ts    # Pluggable tutor provider adapter
│   └── vectorAccelerationAdapter.ts  # Local ANN acceleration
├── markdown/              # Markdown parsing + Mermaid integration
├── notemd/                # .md file ingestion pipeline (batch, translate, mermaid)
├── generated/             # Generated runtime wrappers (mermaid, resvg)
└── frontend/              # Static UI (HTML/CSS/vanilla JS, Web Workers)
```

---

## Module Organization

- **Domain ownership**: Each module owns its full stack — types, implementation, and tests live in the same directory.
  - Example: `src/learning/types.ts` + `src/learning/KnowledgeLearningPlatform.ts` + `src/learning/KnowledgeLearningPlatform.test.ts`.
- **New API routes**: Define in `src/learning/api.ts` (interface), implement in `src/learning/KnowledgeLearningPlatform.ts`, wire into `src/server.ts`.
- **New graph algorithms**: Add in `src/backend/algorithms/` with colocated tests.
- **Type contracts**: Heavyweight shared types live in `src/learning/types.ts`; lightweight domain types live in their module's `types.ts`.

---

## Naming Conventions

- **Files**: `PascalCase.ts` with matching `PascalCase.test.ts` for module tests.
- **Contract tests**: `domain.contract.test.ts` pattern (e.g., `src/knowledge.api.contract.test.ts`).
- **Workers**: `camelCaseWorker.ts` under `src/backend/workers/`.
- **Exports**: Default to named exports. Classes and interfaces are `PascalCase`; functions and variables are `camelCase`.

---

## Examples

- Well-organized module: `src/learning/` — types, API interface, platform implementation, store, adapters, all with colocated tests.
- Well-organized algorithm: `src/backend/algorithms/StatisticalAnalyzer.ts` — self-contained with clear exports.
- Contract test reference: `src/knowledge.api.contract.test.ts` — validates API surface against type contracts.
