# Component Guidelines

> How UI is constructed in this project.

---

## Overview

This project does **not** use a component framework (no React, Vue, Svelte). UI is built with vanilla JS DOM manipulation. "Components" are functions that create, configure, and return DOM elements. There is no virtual DOM, no props system, and no component lifecycle beyond manual `createElement`/`appendChild`/`removeChild`.

---

## Component Structure

A "component" in this codebase is a function that builds a DOM subtree:

```javascript
// From src/frontend/agent_workspace_runtime.js
function createStatusBadge(status, label) {
  const badge = document.createElement('span');
  badge.className = 'aw-badge aw-badge--' + status;
  badge.textContent = label;
  return badge;
}
```

Pattern rules:
- Functions return DOM elements (not strings).
- Class names use the `aw-` prefix for agent workspace, `path-` for path mode.
- Node construction uses `document.createElement` — never `innerHTML` for user-controlled content.
- Parent attachment is done by the caller via `appendChild`.

---

## Props / Configuration

There is no formal props system. Functions accept plain configuration objects:

```javascript
function createAgentConversationPayload(options) {
  // options.operationId, options.atomId, etc.
}
```

Rules:
- Required options are accessed directly (no destructuring with defaults).
- Fallback values use `||` or `??` inline.
- No prop-type validation at runtime — correctness is enforced by contract tests.

---

## Styling Patterns

- **Plain CSS**: `styles.css`, `path_styles.css`, `notemd.css`.
- **Class toggling**: `element.classList.add()`, `element.classList.remove()`, `element.classList.toggle()`.
- **State-driven classes**: BEM-like modifiers (`.is-busy`, `.aw-badge--success`).
- **Inline styles**: Used sparingly, only for dynamic values (e.g., `pathContainer.style.display = 'block'`).
- **CSS variables**: Not used. Styles are explicit.
- **No CSS modules, no CSS-in-JS, no preprocessor**.

---

## Accessibility

- Form elements use native `<button>`, `<input>`, `<textarea>` — no div-as-button.
- Loading states communicate via class toggles (`.is-busy`) and text content changes.
- Language is set via `I18nManager` which swaps text content, not just `lang` attribute.
- No ARIA attributes beyond what native elements provide.
- Keyboard navigation is not systematically implemented.

---

## Common Mistakes

- Using `innerHTML` with user content — creates XSS risk. Use `textContent` or `createElement`.
- Hardcoding English strings — all user-visible text must go through `I18nManager`.
- Forgetting to remove event listeners before removing DOM nodes — causes memory leaks in long-running sessions.
- Creating DOM in tight loops — batch mutations and append once.
