# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

Frontend quality is enforced through contract tests (TypeScript/Jest validating vanilla JS behavior) and structural conventions. There is no frontend linter (no ESLint for JS files), no TypeScript compiler for frontend code, and no bundler. Quality relies on test coverage and code review.

---

## Forbidden Patterns

| Pattern | Why |
|---------|-----|
| `innerHTML` with user or server content | XSS risk — use `textContent` or `createElement` |
| Running D3 simulation on the main thread | Blocks UI — always use a Web Worker |
| Hardcoded English strings | Must go through `I18nManager.t()` |
| Direct DOM manipulation across module boundaries | Use custom events (`nc:*`) for cross-module communication |
| `eval()` or `new Function()` | Never parse executable code from data |
| Synchronous `XMLHttpRequest` | Deprecated and blocks main thread |
| Storing large datasets in DOM or state | Keep in Workers; pass references |
| Assuming API response shape without checking `.ok` | Server errors return `{ ok: false }` |

---

## Required Patterns

- **I18n coverage**: Every user-visible string must exist in both `locales/en.json` and `locales/zh.json`.
- **Worker offloading**: D3 force simulation, graph processing, and heavy computation must run in Web Workers.
- **Contract-aligned payloads**: Agent workspace payload builders must match the shapes defined in `src/learning/types.ts`.
- **Custom events for cross-module signaling**: `nc:pathmode:exited`, `nc:workspace:layout-changed`, etc.
- **CSS class toggling for state**: `.is-busy`, `.is-active`, `.is-disabled` — not inline style manipulation.

---

## Testing Requirements

### Contract Tests (TypeScript/Jest)

All frontend JS modules that produce or consume structured data must have contract coverage:

| Test File | What It Validates |
|-----------|-------------------|
| `src/agent_workspace.contract.parity.test.ts` | Frontend operation config vs backend capability types |
| `src/agent_workspace.frontend.test.ts` | Frontend payload builder output shapes |
| `src/agent_workspace.runtime.behavior.test.ts` | jsdom-based runtime behavior (DOM output, state transitions) |
| `src/agent_workspace.runtime.integration.test.ts` | Cross-module integration (frontend + backend) |

### What to Test
- Payload shape correctness (right fields, right types).
- Error response handling (`{ ok: false }` branch).
- Locale switch re-renders (EN ↔ ZH).
- Empty/null state rendering.

### What NOT to Test
- Visual appearance (pixel-level).
- Third-party library internals (D3, Mermaid).
- Browser-specific rendering quirks (handled by Tauri/Godot integration tests).

---

## Code Review Checklist

1. Are all user-visible strings in both locale files?
2. Is heavy computation offloaded to a Worker?
3. Are API responses checked for `.ok` before accessing data?
4. Is `innerHTML` avoided for server/user content?
5. Does the change have contract test coverage for new payload shapes?
6. Are custom events used for cross-module communication (not direct DOM access)?
7. Does state mutation trigger explicit re-render?
