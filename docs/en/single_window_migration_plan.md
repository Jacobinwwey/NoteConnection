# Single-Window Tauri-Godot Migration Plan

**Date**: 2026-03-22  
**Version**: v1.3.0 → v1.4.0 (target)  
**Status**: ANALYSIS & PROPOSAL

---

## 1. Problem Statement

Currently, running `npm run tauri:dev:mini:gpu` opens **two separate windows** simultaneously:
1. **Tauri Window** — The main knowledge-graph UI (HTML/JS/CSS).
2. **Godot Window** — The "Future Path" 3D tree visualization.

When the user clicks the **"Pathmode"** button in Tauri, node data is transferred from Tauri → Node.js sidecar → PathBridge WebSocket → Godot.

**Goal**: Only **one window** should appear. Initially display the Tauri interface; upon clicking "Pathmode", the **same window** transitions to display Godot content. Clicking "Exit" returns to the Tauri view.

---

## 2. Current Architecture Analysis

### 2.1 Launch Flow (`lib.rs` → `setup()`)

```
npm run tauri:dev:mini:gpu
  └─ set NOTE_CONNECTION_GPU=1
  └─ npm run build:mini && npm run build:sidecar && npx tauri dev
       └─ Tauri setup() in lib.rs:
            ├─ Spawn Node.js sidecar (server binary via tauri-plugin-shell)
            └─ Spawn Godot (std::process::Command with --path path_mode/)
```

Key code locations:
- **Godot spawn**: `lib.rs` lines 1808–1864 — Godot is launched as an independent OS process immediately at startup, unconditionally on desktop.
- **Sidecar spawn**: `lib.rs` lines 1736–1806 — Node.js sidecar starts and initializes `PathBridge` WebSocket.
- **PathBridge**: `src/core/PathBridge.ts` — WebSocket relay between Tauri frontend, Node.js, and Godot.

### 2.2 Data Flow (PathMode Click)

```
User clicks "Pathmode" button (app.js:3316)
  └─ Frontend hides #graph-wrapper, shows #path-container
  └─ window.pathApp.init(selectedNode.id) → path_app.js
       └─ PathApp computes learning path via path_core.js
       └─ Sends pathResult over PathBridge WebSocket
            └─ Godot ws_client.gd receives pathResult
            └─ tree_renderer.gd renders 3D tree
```

### 2.3 Godot WebSocket Client (`ws_client.gd`)

- Connects to `ws://127.0.0.1:{BRIDGE_PORT}` on `_ready()`.
- Sends `identify` message with `client: "godot"` tag.
- Requests `requestPath` payload on connect.
- Receives `pathResult`, `pathUpdate`, `switchCenter`, `completionSync`.

### 2.4 Frontend PathMode Handler (`app.js:3283–3386`)

- On Android: delegates to native `open_native_pathmode` Tauri command.
- On Desktop: toggles visibility of `#graph-wrapper` and `#path-container` divs.
- `path_app.js` manages all path rendering in-browser (Canvas/SVG), communicating with Godot via WebSocket.

---

## 3. Feasibility Analysis of Approaches

### Approach A: Embed Godot as a WebView Overlay (GDExtension / WASM)

| Aspect | Assessment |
|--------|------------|
| **Concept** | Compile Godot project to WASM and load it inside an `<iframe>` or `<canvas>` within the Tauri WebView. |
| **Feasibility** | ⚠️ **Medium-High Risk** — Godot 4.x WASM export exists but has significant limitations: no shared-memory multi-threading, WebGL2 only (no Vulkan), and the project uses custom shaders (`frosted_glass.gdshader`, `bubble_material.gdshader`) that may not port cleanly. |
| **Communication** | Would need to replace WebSocket with JavaScript ↔ WASM `callv()` bridge or `postMessage`. |
| **Robustness** | Fragile: WASM builds of Godot are unstable for complex scenes. GPU features (`NOTE_CONNECTION_GPU=1`) would be unavailable. |
| **Verdict** | ❌ **Not recommended** for v1.4.0. Too risky and breaks GPU acceleration. |

### Approach B: Godot `--render-to-texture` + Tauri Window Composition

| Aspect | Assessment |
|--------|------------|
| **Concept** | Render Godot to an off-screen buffer, stream frames to Tauri WebView as video/images. |
| **Feasibility** | ❌ **Very High Risk** — Godot 4.x has no built-in headless render-to-texture-stream API. Would require custom GDExtension + shared-memory IPC. |
| **Verdict** | ❌ **Not feasible** without massive engine-level work. |

### Approach C: Window Visibility Toggle (Show/Hide) ✅ RECOMMENDED

| Aspect | Assessment |
|--------|------------|
| **Concept** | Keep Godot as a separate process but **hide it at startup**. On "Pathmode" click, **hide Tauri window** and **show Godot window**. On "Exit", reverse. |
| **Feasibility** | ✅ **High** — Uses standard Windows API (`ShowWindow`/`SetForegroundWindow`) or Godot CLI flags (`--minimized`). |
| **Communication** | Existing WebSocket PathBridge is unchanged. |
| **Robustness** | Very robust: no architectural changes to rendering, shaders, or data flow. |
| **Encapsulation** | Fully encapsulated — changes only affect `lib.rs` (Godot launch flags), a new Tauri IPC command, and minimal frontend JS. |
| **Verdict** | ✅ **Recommended** — Minimal risk, maximal compatibility, preserves all existing functionality. |

### Approach D: Tauri Multi-Webview with Godot Embedded Window (Win32 `SetParent`)

| Aspect | Assessment |
|--------|------------|
| **Concept** | Use Win32 `SetParent()` to reparent the Godot HWND into the Tauri window as a child window. |
| **Feasibility** | ⚠️ **Medium Risk** — Works on Windows only. Requires HWND discovery via `EnumWindows` + matching by PID. Input routing and resize coordination are complex. |
| **Communication** | WebSocket unchanged, but needs `MoveWindow`/`SetWindowPos` sync on resize. |
| **Robustness** | Platform-specific (Windows-only), brittle across Godot/OS updates. |
| **Verdict** | ⚠️ **Possible** as v1.5.0 enhancement, but too platform-specific for initial implementation. |

---

## 4. Recommended Solution: Approach C — Window Visibility Toggle

### 4.1 Architecture Overview

```
┌────────────────────────────────────────────────┐
│                 Tauri Process                   │
│                                                 │
│  ┌─────────────┐    ┌───────────────────────┐  │
│  │ Tauri Window │    │   Godot Process       │  │
│  │ (WebView)   │    │   (hidden at start)   │  │
│  │             │    │                       │  │
│  │ [Pathmode]──┼───►│ Show Godot window     │  │
│  │             │    │ Hide Tauri window     │  │
│  │             │◄───┼── [Exit PathMode]     │  │
│  │ Show Tauri  │    │   Hide Godot window   │  │
│  └─────────────┘    └───────────────────────┘  │
│         │                    │                  │
│         └────────┬───────────┘                  │
│                  ▼                              │
│         PathBridge WebSocket                    │
│         (Node.js Sidecar)                       │
└────────────────────────────────────────────────┘
```

### 4.2 Proposed Changes

#### 4.2.1 Rust Side (`src-tauri/src/lib.rs`)

1. **Launch Godot with `--minimized` flag** (or a custom `--hidden` argument parsed by Godot):
   - Add `"--minimized"` to the Godot `args` array so it starts hidden.
   - Store the Godot process `Child` handle (already done).

2. **New Tauri IPC command `toggle_pathmode_window`**:
   ```rust
   #[tauri::command]
   fn toggle_pathmode_window(
       app: AppHandle,
       show_godot: bool,
   ) -> Result<(), String> {
       // If show_godot == true:
       //   - Hide the Tauri main window
       //   - Show/focus the Godot window (via stored HWND or process signal)
       // If show_godot == false:
       //   - Hide the Godot window
       //   - Show/focus the Tauri main window
   }
   ```

3. **Window management strategy**:
   - Use `window.hide()` / `window.show()` from Tauri API for the Tauri window.
   - For Godot: send a WebSocket message `{"type": "setWindowVisible", "payload": {"visible": true/false}}` through PathBridge, and have Godot handle it in `ws_client.gd`.

#### 4.2.2 Godot Side (`path_mode/scripts/ws_client.gd`)

1. **Handle `setWindowVisible` message**:
   ```gdscript
   "setWindowVisible":
       var visible: bool = payload.get("visible", true)
       if visible:
           get_window().mode = Window.MODE_WINDOWED
           get_window().grab_focus()
       else:
           get_window().mode = Window.MODE_MINIMIZED
   ```

2. **On "Exit PathMode" button** (already sends `exitPathMode` message):
   - The existing `send_exit_path_mode()` function already notifies the frontend.
   - Additionally auto-hide the Godot window after sending the exit message.

#### 4.2.3 Frontend Side (`src/frontend/app.js`)

1. **Modify PathMode button handler** (line ~3316):
   - After `pathApp.init()`, call `window.__TAURI__.core.invoke('toggle_pathmode_window', { showGodot: true })`.

2. **Handle `exitPathMode` WebSocket message**:
   - Call `window.__TAURI__.core.invoke('toggle_pathmode_window', { showGodot: false })` to restore the Tauri window.

#### 4.2.4 PathBridge Enhancement (`src/core/PathBridge.ts`)

- Add `setWindowVisible` to the allowed message types forwarded to Godot-tagged clients.
- No structural changes needed — existing relay mechanism handles this.

### 4.3 Startup Sequence (Modified)

```
1. Tauri window created (visible, 1280x900)
2. Node.js sidecar spawned → PathBridge WebSocket starts
3. Godot spawned with --minimized flag → Hidden, connects to PathBridge
4. User sees only the Tauri window with knowledge graph
5. User clicks "Pathmode":
   a. Frontend calls toggle_pathmode_window(showGodot: true)
   b. Tauri window hides
   c. PathBridge sends setWindowVisible(true) to Godot
   d. Godot window appears, receives path data
6. User clicks "Exit" in Godot:
   a. Godot sends exitPathMode via WebSocket
   b. Godot auto-minimizes itself
   c. Frontend receives exitPathMode, calls toggle_pathmode_window(showGodot: false)
   d. Tauri window reappears
```

---

## 5. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Godot `--minimized` flag not fully hiding the window flash | Low | Use `DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_MINIMIZED)` in `_ready()` |
| WebSocket latency in show/hide toggle | Very Low | Toggle is non-latency-critical (200ms acceptable) |
| User closes Godot window directly (X button) | Medium | Intercept `NOTIFICATION_WM_CLOSE_REQUEST` in Godot → minimize instead of quit |
| Godot window appears in taskbar when minimized | Low | On Windows, use `DisplayServer.window_set_flag(DisplayServer.WINDOW_FLAG_NO_FOCUS, true)` at startup |
| Existing tests break | Low | Only `lib.rs` launch args change; all test contracts unaffected |

---

## 6. Verification Plan

### 6.1 Automated Tests

```bash
# Existing test suite — must pass with zero regressions
npm test
npm run test:migration
npm run test:tauri
```

### 6.2 Manual Verification

1. Run `npm run tauri:dev:mini:gpu`
2. Verify **only one window** (Tauri) is visible at startup
3. Verify Godot is **not visible** in taskbar
4. Load a knowledge base, click "Pathmode"
5. Verify Tauri window **disappears** and Godot window **appears**
6. Verify path tree renders correctly in Godot
7. Click "Exit" button in Godot
8. Verify Godot window **disappears** and Tauri window **reappears**
9. Verify knowledge graph state is preserved
10. Repeat steps 4–9 multiple times for stability

---

## 7. Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `src-tauri/src/lib.rs` | MODIFY | Add `--minimized` to Godot launch args; add `toggle_pathmode_window` command |
| `path_mode/scripts/ws_client.gd` | MODIFY | Handle `setWindowVisible` message type |
| `path_mode/scripts/path_mode_ui.gd` | MODIFY | Auto-hide window on exit PathMode |
| `path_mode/project.godot` | MODIFY | Set initial window mode to minimized (optional) |
| `src/frontend/app.js` | MODIFY | Call `toggle_pathmode_window` on PathMode enter/exit |
| `src/core/PathBridge.ts` | MODIFY | Allow `setWindowVisible` message forwarding |
| `docs/` | NEW | This migration plan document |

---

## 8. Backward Compatibility

- ✅ Non-Tauri builds (standalone web, `npm start`) are unaffected — they continue to use the in-browser path_app.js rendering.
- ✅ Android builds are unaffected — they use `open_native_pathmode` and never launch Godot from Tauri.
- ✅ All WebSocket protocol messages remain backward-compatible (additive change only).
- ✅ Existing `exitPathMode` flow in `path_app.js` remains functional as a fallback.
