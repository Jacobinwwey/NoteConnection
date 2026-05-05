# Hook Guidelines

> How async work and side effects are handled in this project.

---

## Overview

This project does **not** use React or React hooks. There is no `useState`, `useEffect`, or custom hook system. Instead, the frontend uses three patterns for async work and side effects:

1. **Web Workers** (`Worker` + `postMessage`/`onmessage`) for heavy computation off the main thread.
2. **Event listeners** (`addEventListener`) for user interaction.
3. **Direct async/await** for API calls (fetch).

---

## Custom "Hook" Patterns

### Web Workers

Workers are the primary mechanism for offloading heavy work:

```javascript
// Main thread (app.js)
const worker = new Worker('path_worker.js');
worker.postMessage({ type: 'updateParams', payload: { alpha } });
worker.onmessage = (e) => { /* handle result */ };
worker.onerror = (err) => { console.error('Worker error:', err); };
```

Available workers:
- `path_worker.js` — D3 force simulation for path mode graph layout
- `graph_worker.js` — Graph data loading and processing
- `src/backend/workers/*.ts` — Node.js Worker threads for backend computation

Rules:
- Never run D3 force simulation or graph layout on the main thread.
- Always attach an `onerror` handler to workers.
- Worker messages use `{ type, payload }` envelope.

### I18nManager

The `I18nManager` class (`src/frontend/i18n.js`) handles localization:

```javascript
const i18n = new I18nManager();
await i18n.init(); // loads locale JSON
i18n.t('some.key'); // returns translated string
i18n.getCurrentLocale(); // 'en' or 'zh'
```

Rules:
- All user-visible strings go through `i18n.t()`.
- New strings: add to both `locales/en.json` and `locales/zh.json`.
- Never concatenate translated strings — use parameterized templates.

### Event Listeners

Direct DOM event binding, no delegation framework:
```javascript
button.addEventListener('click', handler);
document.addEventListener('nc:pathmode:exited', handler); // custom events
```

Custom event naming: `nc:<domain>:<action>` (e.g., `nc:pathmode:exited`).

---

## Data Fetching

No data-fetching library is used. API calls use raw `fetch()`:

```javascript
const res = await fetch('/api/knowledge/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});
const data = await res.json();
```

Rules:
- Always check `data.ok` before accessing result fields.
- POST for all knowledge API calls.
- No caching layer — every call hits the server.

---

## Common Mistakes

- Running D3 simulation on the main thread — blocks UI. Always use a Worker.
- Forgetting `await i18n.init()` before calling `i18n.t()` — returns untranslated keys.
- Not checking `response.ok` on fetch — server errors return 500 with `{ ok: false }`.
- Leaving stale event listeners after DOM removal — use `removeEventListener` or let GC handle via node removal.
