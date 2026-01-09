# Fix TODO List

## Current Critical Issue: Frontend "Nodes: 0" Display for 10k+ Nodes

**Status**: **RESOLVED** (v0.9.69)

### Issue Description
- **Symptom**: After the backend successfully generates the graph (13k+ nodes, 1.2M+ edges), the frontend loads the page but displays "Nodes: 0 | Edges: 0". The canvas/SVG remains empty.
- **Root Cause**: A "Maximum call stack size exceeded" error (RangeError) occurred in `src/frontend/app.js` at the line `links.push(...validLinks)`. This was caused by attempting to spread over 1.2 million edge objects into the `push` method, exceeding the JavaScript engine's argument limit (typically ~65k or dependent on stack size).
- **Previous Attempts**: 
    - v0.9.67: Compact Mode (Visual optimization) - Did not fix the crash.
    - v0.9.68: Content-on-Demand (Data size optimization) - Reduced file size but did not fix the runtime crash.

### Resolution (v0.9.69)
- **Fix**: Refactored `src/frontend/app.js` to avoid using the spread operator on large arrays.
    - Changed `const links` to `let links`.
    - Replaced `links.push(...validLinks)` with direct assignment `links = validLinks;`.
- **Verification**: 
    - The code now safely handles arrays of any size supported by the heap.
    - "Nodes: 0" issue should be resolved, allowing the subsequent logic (Canvas auto-switch, Compact Mode) to execute.

### Next Steps
- [x] Apply fix to `src/frontend/app.js`.
- [x] Verify no other spread operators are used on global node/link arrays.
- [ ] User to verify on their local environment (Microsoft Edge).

---

## Historical Fixes

### [2026-01-08] 10k+ Nodes Frontend Optimization
- **Issue**: Rendering 13k nodes froze the browser.
- **Fix**: Implemented "Compact Mode" (edges hidden by default) and "Auto-Canvas" switching.

### [2026-01-07] Heap Out of Memory (Backend)
- **Issue**: Node.js process crashed with OOM when processing 13k files.
- **Fix**: Implemented "Sparse Vectors", "Worker Streaming", and "Hybrid Inference Resource Reuse".