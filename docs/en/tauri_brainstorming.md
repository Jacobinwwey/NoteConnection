# 2026-03-04 v1.5.13 - Tauri Architecture Unification (Runtime Parity Update)

## English Document

### Why This Brainstorming Addendum

The original migration blueprint focused on replacing Electron shell behavior with Tauri and proving cross-platform packaging feasibility. After recent implementation rounds, the architecture has moved from "build-chain readiness" to "runtime parity hardening."

### Newly Validated Decisions

1. Keep **desktop-first sidecar + Godot** architecture intact for performance-intensive rendering.
2. Keep **Tauri Android** as an officially supported mobile build path alongside Capacitor.
3. Apply **capability gating** at runtime rather than forcing desktop assumptions onto Android:
   - sidecar availability
   - build capability
   - content API capability
4. Introduce parity APIs that work in both sidecar and Rust IPC paths:
   - Available target discovery (`available-targets` model)
   - Node content retrieval (`read_node_content` model)

### Architecture Implication (Current State)

- Desktop:
  - Sidecar APIs + Godot bridge remain primary.
  - Full build path supported.
- Android:
  - Build artifacts pipeline is stable (`tauri android build` pass).
  - Runtime now supports cache loading + content read fallback through Rust IPC.
  - In-app graph build remains intentionally disabled pending Android-native storage/import flow.

### Open Strategic Decisions

1. **Android in-app build parity**:
   - whether to implement SAF-driven local folder ingest + incremental build service, or
   - keep Android as cache-consumption runtime in current release line.
2. **Path Mode/Godot on Android**:
   - keep desktop-only with explicit UX messaging, or
   - define an Android-native renderer alternative (WebGL/Canvas or Godot Android strategy).

---

# Tauri Architecture Unification: Comprehensive Blueprint

**Date:** 2026-02-27
**Status:** APPROVED & ACTIVE

## 1. Problem Statement & Core Objectives

The NoteConnection project is currently experiencing severe extension and developer experience (DX) bottlenecks:

1.  **Dual-Window Fragmentation:** Running the backend in Electron and the frontend via Godot GUI simultaneously results in two disparate windows, degrading the end-user experience.
2.  **Fragmented Debugging:** F12 debugging and error logs are split between the Godot engine console and the Node.js/Electron terminal, making crash analysis incredibly tedious.
3.  **Cross-Platform Packaging Hurdles:** The initial decision to use Godot was driven by the need for native Vulkan support to render 10K-50K nodes. However, the current architecture lacks a clear path to generating lightweight Windows EXEs, Android APKs (via Capacitor/Godot), and future Web deployments from a single codebase.

**The Ultimate Goal:**

- **One unified shell** that looks and feels like a single native application.
- **One centralized debugging console** where Godot logs, Node.js backend logs, and Web UI errors are piped together.
- **Streamlined cross-platform compilation** to EXE, APK, and Web without massive OS-level window hacking.

---

## 2. The Solution: Tauri 2.0 Native Shell Architecture

Based on the explicit rejection of fragile Electron Win32 native window embedding and the acceptance of a minimal Rust integration layer, **Tauri 2.0** is the chosen framework to supersede Electron.

Tauri 2.0 solves the core constraints by utilizing the OS's built-in web engine (WebView2 on Windows, WebKit on macOS/iOS, WebView on Android) and a highly performant Rust backend, offering native packaging for both Desktop and Mobile.

### Architecture Topology

| Platform                  | Master Shell | Rendering Engine (Nodes)             | Web UI (Tools/Reader)                | Backend Logic                                 |
| :------------------------ | :----------- | :----------------------------------- | :----------------------------------- | :-------------------------------------------- |
| **Desktop (Windows EXE)** | Tauri (Rust) | Godot (Vulkan, Native Child Process) | Tauri WebView (Overlay/Side-by-side) | Node.js (Child Process)                       |
| **Mobile (Android APK)**  | Tauri (Rust) | Godot (Android Vulkan SurfaceView)   | Tauri Android WebView Plugin         | Node.js (V8 Isolate / Deno / Native Rust API) |
| **Web Browser**           | Browser      | HTML5 Canvas / WebGL                 | Standard DOM                         | Remote Server / WASI                          |

### Key Advantages of this Pivot

1.  **Zero Window Hacks (The F12 Unification):** Tauri's Rust backend acts as the absolute master coordinator. It spawns the Node.js backend. It can inject the Web UI over the Godot viewport natively. Rust intercepts `stdout`/`stderr` from Godot and Node.js, printing a single, unified log stream to the developer terminal.
2.  **Radical Size Reduction:** The final Windows EXE will shrink from Electron's ~150MB to approximately 10MB-15MB.
3.  **Native Mobile Support:** Tauri 2.0 supports `npm run tauri android build`, generating the required Gradle projects and cross-compiling the Rust backend natively, sidestepping Capacitor's heavy DOM overhead.

---

## 3. Implementation Plan (The Full Roadmap)

This is the step-by-step roadmap to transition the NoteConnection codebase from Electron to Tauri 2.0.

### Phase 1: Tauri Initialization & Environment Setup

- **Objective:** Install Tauri 2.0 and configure the build pipeline to consume the existing Frontend dist files.
- **Tasks:**
  1.  Initialize Tauri (`npm create tauri-app@latest`) in the `src-tauri` directory.
  2.  Configure `tauri.conf.json` to map `build.devUrl` to the local development server (e.g., `http://localhost:3000`).
  3.  Configure `build.frontendDist` to point to the `dist/src/frontend` build output.
  4.  Verify that `npm run tauri:dev:mini` successfully opens the Tauri Webview displaying the existing HTML/JS UI. _(Completed)_

### Phase 2: Node.js Backend Sidecar Integration (Unified Logs)

- **Objective:** Abstract the Node.js backend (`server.ts`, Graph Builders) out of the Electron main process and run it as a standalone localized server, managed by Tauri.
- **Tasks:**
  1.  Declare the compiled Node.js backend as a "Sidecar" binary in `tauri.conf.json`.
  2.  Update `src-tauri/src/lib.rs` (Rust) to automatically spawn the Node.js sidecar when the Tauri app launches.
  3.  **Critical DX Step:** Write Rust code using `tauri::process::Command` to intercept all `stdout` and `stderr` from the Node.js sidecar and print it directly to the Rust terminal. This achieves the unified backend debugging goal.
  4.  Ensure graceful shutdown: Rust must kill the Node.js child process when the Tauri window is closed to prevent zombie processes blocking port 3000.

### Phase 3: Godot Native Embedding (The Single Window)

- **Objective:** Integrate the Godot rendering engine into the Tauri shell without fragile Win32 hacks.
- **Tasks:**
  1.  Export the Godot project as a standalone headless/borderless executable.
  2.  Declare the Godot executable as a second "Sidecar" in Tauri.
  3.  In Rust, spawn Godot and capture its logs, merging them into the same terminal stream as Node.js.
  4.  **UI/UX:** Define the layout communication. The Web UI (Tauri) will establish a WebSocket connection (`PathBridge`) to the local Godot instance to synchronize graph data and interactive states.
  5.  _(Optional but Recommended)_: Explore Tauri window transparency or embedding APIs to physically dock the Godot Vulkan surface beneath the Tauri WebView layout.

### Phase 4: Production Packaging (EXE & APK)

- **Objective:** Generate the final deployment artifacts cleanly.
- **Tasks (Desktop):**
  1.  Execute `npm run tauri build`.
  2.  Verify the resulting `.exe` correctly bundles the Node sidecar, launches cleanly, and connects to the Godot renderer.
- **Tasks (Mobile/Android):**
  1.  Set up Android NDK/SDK paths in the environment variables.
  2.  Abstract `server.ts` file system operations (`fs.readFileSync`) behind Tauri's Rust-based `fs` API or Deno isolates, since Android APKs cannot run standard Node.js native modules directly.
  3.  Execute `npm run tauri android build` to generate the signed APK.

---

## _(Bilingual support provided below / 以下提供双语支持)_

