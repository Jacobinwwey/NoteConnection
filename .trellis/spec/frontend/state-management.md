# State Management

> How state is managed in this project.

---

## Overview

There is **no state management library** (no Redux, MobX, Zustand, or Context API). The frontend uses plain JavaScript objects for state. State is mutated directly — there is no immutability guarantee, no change detection, and no reactive binding.

---

## State Categories

### Module-Level Mutable State Objects

Each controller module owns a single mutable state object:

```javascript
// src/frontend/agent_workspace_runtime.js:748
const state = {
  busy: false,
  latestFocusAtomId: null,
  currentPathTargetAtomId: null,
  capabilityEvents: [],
  expandedHistoryEventIdsByAtom: {},
  // ...
};
```

Rules:
- State is read directly (`state.busy`), never through getters.
- State is written directly (`state.busy = true`), never through setters.
- Callers are responsible for re-rendering after state mutation.
- No immutability — push to arrays, assign to objects directly.

### DOM as State

CSS classes on DOM elements serve as visual state:
```javascript
dom.form.classList.toggle('is-busy', state.busy);
body.classList.add(BODY_CLASS_PATH_VISIBLE);
```

The DOM itself is the source of truth for UI state (visibility, active panels, scroll position).

### Server State

No client-side cache. Every interaction fetches fresh data from the server:
- Learning workbench refreshes: parallel `fetch()` calls to `/api/knowledge/*` endpoints.
- Agent workspace capability execution: POST → await response → update state + re-render.

### Diagnostics Ring Buffer

The agent workspace runtime maintains a bounded diagnostics event ring:
```javascript
state.capabilityEvents = []; // append-only, oldest-first
```

No size limit is enforced at the state level — the runtime trims as needed.

---

## When to Use "Global" State

Everything in this codebase is effectively global — state objects are module-scoped but accessible to all functions in the same module. There is no formal distinction between "local" and "global" state.

Guideline:
- If multiple functions in the same module need it → put it in the module's state object.
- If only one function needs it → use a local variable.
- If multiple modules need it → communicate via custom DOM events (`nc:*`).

---

## Common Mistakes

- Mutating state without triggering re-render — there's no reactive binding. Always explicitly call the render function after state change.
- Storing derived data in state — compute on read instead of storing duplicate information.
- Assuming state is immutable — it's not. Array `.push()` and object property assignment are the norm.
- Not clearing state on panel close — stale state survives across panel open/close cycles.
