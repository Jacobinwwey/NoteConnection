# Error Handling

> How errors are handled in this project.

---

## Overview

Error handling is fail-safe and evidence-first. Server routes return structured JSON error responses. Internal operations use `try/catch` with explicit error conversion. Errors are never thrown across HTTP or WebSocket boundaries.

---

## Error Types

No custom error classes are defined. The project uses:
- Standard `Error` with `(error as Error)?.message` access for internal errors.
- `NodeJS.ErrnoException` code checks for filesystem-specific errors (`ENOENT`).
- Structured `{ ok: false, error: String(error) }` for all error responses over HTTP.

---

## Error Handling Patterns

### Server Route Pattern (`src/server.ts`)

Every `/api/*` route follows this shape:

```typescript
try {
  const result = await platform.someOperation(...);
  res.json({ ok: true, ...result });
} catch (error) {
  console.error(`POST /api/knowledge/some-route`, error);
  res.status(500).json({ ok: false, error: String(error) });
}
```

Rules:
- Always log the **route path** alongside the error.
- Always use `{ ok: false, error: String(error) }` shape.
- Always HTTP 500 for unhandled internal errors.

### Store Pattern (`src/learning/store.ts`)

Store methods catch, record diagnostics, and re-throw:

```typescript
try {
  // operation
} catch (error) {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  if (code === 'ENOENT') { /* handle */ }
  this.lastError = String((error as Error)?.message || error);
  throw error;
}
```

### Worker Thread Pattern

Workers use event-based error handling:
```typescript
worker.on('error', (err) => { console.error(`Worker error:`, err); });
```

---

## API Error Responses

**Standard error shape across all `/api/*` routes:**
```json
{ "ok": false, "error": "human-readable description" }
```

Never return plain strings, never `throw` across the HTTP boundary.

---

## Common Mistakes

- Returning `"error string"` instead of `{ ok: false, error: "error string" }` — frontend code expects the structured shape.
- Forgetting to include the route path in `console.error` — makes production debugging impossible.
- Accessing `error.message` without `as Error` cast — TypeScript strict mode rejects it.
- Swallowing errors silently with empty `catch(e) {}` — always either handle definitively or re-throw.
