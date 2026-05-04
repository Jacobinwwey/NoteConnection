# Explanation: Architecture and Migration Context

This page explains the architectural decisions behind NoteConnection and the rationale for key migrations.

## Why Tauri-First (v1.4.4+)

NoteConnection originally shipped as an Electron desktop app. In v1.4.4, the project migrated to Tauri v2. The decision was driven by three factors:

### 1. Better runtime control for sidecar orchestration

NoteConnection's architecture relies on multiple sidecar processes:
- **Node.js server** (HTTP API + WebSocket bridge on port 9876)
- **Godot 4.3 renderer** (3D Path Mode visualization)
- **Markdown worker** (Rust-based pulldown-cmark parser)

Tauri v2's `tauri-plugin-shell` provides first-class sidecar management with stdio streaming, termination handling, and target-triple naming conventions. Electron required custom child_process management with less reliable lifecycle guarantees.

### 2. Cleaner single-window behavior between Tauri and Godot

Path Mode toggles visibility between the Tauri WebView and the Godot renderer window. Tauri's native window handle access (`app.get_webview_window()`) enables:
- Precise window position synchronization
- Visibility toggling without destroy/recreate cycles
- `confirm_before_full_shutdown_from_godot` safety gate

### 3. Explicit contract boundaries for desktop/mobile runtime capability differences

Desktop and mobile have fundamentally different capabilities:
- Desktop: sidecar processes, GPU compute, Godot native rendering
- Mobile (Android): Capacitor/Tauri WebView, limited compute, no Godot sidecar

Tauri's capability system (`capabilities/default.json`) and platform-specific config merging (`tauri.linux.conf.json`, `tauri.macos.conf.json`, `tauri.windows.conf.json`, `tauri.android.conf.json`) make these differences explicit and config-driven rather than implicit in code.

## Migration from Electron (v1.4.4)

The migration involved:
- Replacing Electron `main.js` with Tauri Rust shell (`src-tauri/src/lib.rs`, ~3,300 lines)
- Moving IPC from `ipcMain`/`ipcRenderer` to Tauri `#[tauri::command]` + `window.__TAURI__.core.invoke`
- Replacing Electron dialog/file APIs with `rfd` crate + Tauri dialog plugin
- Moving configuration from JSON (`electron-settings`) to TOML (`app_config.toml`) shared across Tauri + Godot + NoteMD
- Replacing `electron-builder` with Tauri bundler (`.msi`/`.nsis` for Windows, `.dmg` for macOS, `.AppImage`/`.deb` for Linux)

The `electron_migration_analysis.md` document (in `docs/en/`) preserves the detailed tradeoff analysis.

## Hybrid Native Architecture

### Component Roles

| Component | Technology | Role |
|---|---|---|
| Desktop Shell | Tauri v2 (Rust) | Window management, sidecar lifecycle, system menus, clipboard |
| HTTP Server | Node.js (TypeScript) | API routes, graph construction, learning platform, WebSocket bridge |
| Web Frontend | Vanilla JS + D3.js + Canvas | Graph visualization, settings, reader, NoteMD |
| 3D Renderer | Godot 4.3 (GDScript) | Path Mode tree/radial visualization with iridescent bubble shaders |
| Mobile Shell | Tauri Android (Kotlin) | APK packaging, filesystem access, WebView |

### Communication Paths

```
┌─────────┐  HTTP:3000   ┌──────────┐  WebSocket:9876  ┌─────────┐
│  Tauri   │◄────────────►│  Node.js  │◄───────────────►│  Godot   │
│ (WebView)│              │  Server   │                  │ Renderer │
└─────────┘              └──────────┘                  └─────────┘
     │                        │
     │ Tauri IPC              │ HTTP API
     ▼                        ▼
┌─────────┐              ┌──────────┐
│  Rust    │              │  Web     │
│ Commands │              │ Frontend │
└─────────┘              └──────────┘
```

- Tauri WebView loads frontend from `dist/src/frontend/` via `frontendDist`
- Frontend communicates with Node.js server via HTTP (port 3000)
- Path Mode: Godot connects via WebSocket (port 9876), Tauri toggles window visibility
- Mobile: Capacitor/Tauri Android embeds WebView with filesystem plugins

### PathBridge Protocol

The `PathBridge` WebSocket server (`src/core/PathBridge.ts`, 2,060 lines) implements a JSON-RPC 2.0 protocol with ~25 message types. Key design properties:
- Strict payload validation and schema enforcement
- Outbound message queuing with backpressure
- Mermaid rendering delegation to frontend (PNG output)
- Path validation with transport fingerprints
- Authorized client tracking with auth token support

### Platform Differences

| Feature | Desktop | Mobile |
|---|---|---|
| Graph construction | Full (`worker_threads`, GPU) | Read-only (pre-built data) |
| Path Mode | Godot 4.3 3D renderer | Web Canvas fallback |
| Sidecar processes | Yes (server + godot + markdown-worker) | No |
| File system | Native (`rfd` dialog) | Plugin (`@capacitor/filesystem`) |
| Offline support | Full | Full (vendored libs) |

## Godot Renderer Integration

### Rendering Backend Selection

The project switched from `GL Compatibility` to `Forward+` (Vulkan) renderer in the Godot project configuration. This resolves known Wayland compositor crashes (SIGSEGV on Hyprland/niri) while maintaining `gl_compatibility` fallback for mobile.

### Wayland Fallback

On Linux systems with `XDG_SESSION_TYPE=wayland`, the Tauri Rust launcher automatically sets:
- `GDK_BACKEND=x11` (forces XWayland for WebKitGTK compatibility)
- `WEBKIT_DISABLE_DMABUF_RENDERER=1` (avoids GBM buffer creation failures on NVIDIA)

### Godot WebView Conflict

A known architectural limitation: WebKitGTK requires GTK to own the window and event loop, while Godot manages its own window. The project uses separate windows with visibility toggling rather than embedding (avoiding the event loop conflict documented in godot_wry).

## Why Diataxis for Docs

The documentation suite follows the Diataxis framework across English and Chinese:

| Section | Purpose |
|---|---|
| `tutorials` | Learning-oriented: first run, onboarding |
| `how-to` | Task-oriented: build, export, sidecar management, release |
| `reference` | Information-oriented: interfaces, runtime contracts, Godot/NoteMD specs |
| `explanation` | Understanding-oriented: architecture rationale, roadmap, progress dashboard |

This separation reduces duplication and improves maintenance reliability across bilingual content.

## Canonical Explanation Sources

- [Tauri Brainstorming Notes](../../../en/tauri_brainstorming.md)
- [Electron Migration Analysis](../../../en/electron_migration_analysis.md)
- [Cross-Platform Architecture Refinement Plan](../../../solutions/cross-platform-architecture-refinement-2026-05-02.md)
