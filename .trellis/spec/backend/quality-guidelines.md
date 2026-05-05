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
