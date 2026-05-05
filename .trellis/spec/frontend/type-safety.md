# Type Safety

> Type safety patterns in this project.

---

## Overview

The frontend is **vanilla JavaScript** — there is no TypeScript compilation for frontend files (except `native_clipboard.ts`). Type safety comes from two sources:
1. **Contract tests** (TypeScript, run via Jest) that validate the frontend JS against backend TS types.
2. **Runtime type checks** in critical code paths.

The backend TypeScript types in `src/learning/types.ts` serve as the canonical type definitions that frontend contract tests validate against.

---

## Type Organization

### Backend TypeScript (authoritative)
- `src/learning/types.ts` — all knowledge platform types (atom, evidence, relation, mastery, tutor, memory, conversation, diagnostics).
- `src/learning/api.ts` — API interface types.
- `src/core/types.ts` — core graph types.

### Frontend "Typing" (derived, validated by tests)
Frontend JS has no type annotations. Types are enforced by:
- `src/agent_workspace.contract.parity.test.ts` — validates frontend operation config matches backend capability types.
- `src/agent_workspace.frontend.test.ts` — validates frontend payload builders produce correctly shaped objects.
- `src/agent_workspace.runtime.behavior.test.ts` — jsdom-based behavioral tests that verify runtime output shapes.

## Validation

### Runtime Type Checks

Minimal but present at critical boundaries:
```javascript
// Agent workspace operation config — allowlist checks
function resolveCapabilityMessage(rawMessage) {
  if (!rawMessage || typeof rawMessage !== 'string') return null;
  // ...
}

function resolveStringArray(values) {
  if (!Array.isArray(values)) return [];
  // ...
}
```

### Contract Test Shape Assertions

The primary validation mechanism — TypeScript tests verify JS output:
```typescript
// src/agent_workspace.frontend.test.ts
expect(payload).toHaveProperty('operationId');
expect(payload).toHaveProperty('endpoint');
expect(typeof payload.endpoint).toBe('string');
```

---

## Common Patterns

- **Allowlist validation**: Operation configs, action kinds, and capability types are validated against allowlists in `agent_workspace.js`.
- **Fallback values**: `resolve*` functions take a `fallback` parameter.
- **Null returns for invalid input**: Validation functions return `null` rather than throwing.
- **`Number.isFinite()`**: Used for numeric validation (not `isNaN` or `typeof`).

---

## Forbidden Patterns

- `any` type in backend TypeScript that flows to frontend contracts — use `unknown`.
- Assuming JSON from the server is correctly shaped without checking `.ok`.
- Using `eval()` or `new Function()` — never parse code from server responses.
- `innerHTML` with server content — XSS vector.
