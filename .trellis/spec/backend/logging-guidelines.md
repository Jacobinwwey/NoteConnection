# Logging Guidelines

> How logging is done in this project.

---

## Overview

No logging library or framework is used. The backend uses plain `console.log` / `console.error` / `console.warn`. The `PerformanceLogger` utility (`src/backend/utils/PerformanceLogger.ts`) provides structured timing for heavy operations.

---

## Log Levels

| Method | When to use |
|--------|-------------|
| `console.error` | Server errors, route failures, worker crashes — always include route path or context |
| `console.warn` | Degraded states, fallback activations, missing-but-handled resources |
| `console.log` | Server startup, port binding, build completion — minimal, infrequent |

There is no `console.debug` usage in the codebase. No debug-level logging convention exists.

---

## Structured Logging

**No structured logging framework is used.** Log messages are plain template literals:

```typescript
console.error(`POST /api/knowledge/query`, error);
console.log(`Server running at http://localhost:${PORT}`);
```

The `PerformanceLogger` utility (`src/backend/utils/PerformanceLogger.ts`) provides the closest thing to structured observability:
- Tracks operation duration with labels.
- Used for graph build, layout computation, and query timing.

---

## What to Log

- **Route errors**: Always log the route path + error object.
- **Server lifecycle**: Startup port, shutdown signals.
- **Worker failures**: Include worker type and error.
- **Performance**: Use `PerformanceLogger` for heavy operations (graph build, ingest, store reload).

---

## What NOT to Log

- **User content**: Never log full document bodies, knowledge base content, or user-submitted answers.
- **File paths containing user data**: Omit or redact.
- **API keys or tokens**: Never.
- **Large payloads**: Truncate or summarize — `server.ts` handlers log route paths, not request bodies.

---

## Common Mistakes

- `console.error` without route/context string — the error alone is not enough to trace the failure.
- Logging sensitive content — the knowledge base can contain personal notes; never dump it to console.
- Using `console.log` in tight loops — use `PerformanceLogger` for aggregate timing, not per-item logs.
