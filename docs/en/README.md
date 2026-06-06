# 2026-04-07 v1.7.0

# NoteConnection Knowledge Graph

<img width="606" height="309" alt="banner" src="https://github.com/user-attachments/assets/92e90de5-2b1a-4398-8e8b-6e142c92b6a2" />

<div align="center">

| **English** | [Key Features](#key-features-en) | [Hardware](#hardware-en) | [Architecture](#architecture-en) | [Quick Start](#quick-start-en) | [CLI](#cli-en) | [Changelog](#changelog-en) |
| :---------: | :------------------------------: | :----------------------: | :------------------------------: | :----------------------------: | :------------: | :------------------------: |

</div>

# NoteConnection: Hierarchical Knowledge Graph Visualization System

> **Unlock the Structure of Your Knowledge.**

[![npm version](https://badge.fury.io/js/noteconnection.svg)](https://badge.fury.io/js/noteconnection)

**NoteConnection** is a high-performance, standalone visualization system engineered to transform unstructured Markdown knowledge bases into **Directed Acyclic Graphs (DAGs)**.

Unlike traditional "network" views that show a messy web of links, NoteConnection reveals the **hierarchy**, **learning paths**, and **dependency structures** hidden within your notes. It is built for scalability, capable of handling tens of thousands of nodes with ease, and operates completely independently of any specific note-taking app.

<img width="2010" height="2011" alt="image" src="https://github.com/user-attachments/assets/fa55676d-f58d-414e-943c-7a10567f88a5" />

---

## Current Mainline Architecture Status (2026-06-06)

- Current `main` has code-backed scoped retrieval, grounded conversation, durable resource/index/workspace/session/memory/export substrate, explicit export profiles, and PNG-first Godot/mobile render materialization.
- graphdb/sqlite and ANN/external connector paths are operational baselines. Production closure still requires repeated soak evidence, workload thresholds, recall/latency calibration, and strict rollout proof.
- Compatibility remains additive: rich `assistantBlocks` can be used by newer clients while legacy `assistantMessage` stays valid.
- The next architecture work is ownership reduction in `src/server.ts`, `src/learning/KnowledgeLearningPlatform.ts`, and large frontend host files.
- Current code-vs-plan details: [Architecture Progress Alignment and Mainline Plan (2026-06-06)](../solutions/architecture-progress-alignment-2026-06-06.md) and [Development Progress Dashboard](../diataxis/en/explanation/development-progress-dashboard.md).

---

<a id="key-features-en"></a>

## 🚀 Key Features

### 1. Visualization & Layout

- **Structure Over Chaos**: Switch between **Force-Directed** (Physics) and **DAG** (Hierarchical) layouts. The DAG layout automatically identifies "Prerequisites" and "Next Steps" to arrange concepts in logical layers.
- **Dual Rendering Engine (v0.8.7)**: Seamlessly toggle between **SVG** (for interactivity) and **Canvas** (for high-performance rendering of 10,000+ nodes).
- **Interactive Focus Mode**: Click any node to isolate it and its context. Features **Freeze on Select** (v0.8.9) to prevent drift, adjustable **Vertical/Horizontal Spacing** (v0.8.8), and absolute visual consistency upon exit. Use the **Random Focus** (dice icon) to discover new connections (v1.0.0).
- **Absolute Offline Support (v1.0.0)**: All library dependencies (D3, KaTeX, Marked, Mermaid, JSZip) are migrated to local assets, ensuring 100% functionality without internet.
  <img width="2010" height="2011" alt="image" src="https://github.com/user-attachments/assets/52785445-20bf-4ecc-847a-23863f291b6a" />

### 2. Intelligence & Inference

- **Hybrid Inference Engine**: Combines **Statistical Probability** ($P(A|B)$) and **Vector Similarity** (TF-IDF) to infer hidden dependencies (e.g., "Fluorescence" implies "Photon") without external AI APIs.
- **Scalable Clustering**: Aggregates thousands of nodes into high-level "Concept Bubbles" based on folder structure or tags for a cleaner overview.

<img width="3723" height="1992" alt="image" src="https://github.com/user-attachments/assets/9e56e567-1742-48cf-b720-cf65a47fd317" />

### 3. Path Mode: Structured Learning (v1.2.0)

- **Curriculum Generation**: Instantly transforms your graph into linear learning paths.
  - **Domain Learning**: Master an entire concept cluster (Topological Sort).
  - **Diffusion Learning**: Find the most efficient path to a specific goal (Shortest Path + Prerequisites).
- **Hybrid Architecture**: Connects to a high-fidelity **Godot 4.3 Desktop Renderer** via WebSocket (`ws://localhost:9876`) for AAA-quality visualization, while maintaining full web compatibility.
- **Smart Strategies**: Choose "Foundational" (Base-first) or "Core" (Importance-first) sorting to suit your learning style.

### 4. Performance & Control

- **High-Capacity Parallel Processing**: Utilizes Node.js `worker_threads` (up to 12 cores) to distribute computationally intensive keyword matching.
- **Simulation Controls (v0.9.0)**: Fine-tune the physics with a **Speed/Damping Slider** or use the **Freeze Layout** switch to stop the simulation for stable manual arrangement.
- **Hover Lock**: Hovering over a node temporarily locks its position, allowing for stable inspection of connections.

### 5. NoteMD AI Document Workbench (v1.5.58)

- **Integrated NoteMD module**: Added `src/notemd/*` as a standalone, Obsidian-decoupled processing stack (LLM provider abstraction, prompt manager, batch/file processors, translation, Mermaid/formula fixers, and duplicate detection).
- **One-Click Extract workflow**: The embedded NoteMD window now defaults to a single standard workflow button that chains concept extraction, title-based batch generation, and batch Mermaid repair. Generated files land in a KB subfolder named after the source file.
- **TOML-backed API profile**: Embedded NoteMD reads and writes its active API configuration from `app_config.toml` via `[notemd]` and `[notemd.api]`.
- **CLI compatibility**: Core NoteMD workflows are invokable through `noteconnection notemd ...`, including `settings show`, `settings set-api`, `one-click-extract`, `batch-generate`, `batch-mermaid-fix`, and `fix-mermaid`.
- **New API surface**: Added `/api/notemd/*` endpoints for settings, file/folder processing, workflow orchestration, translation, content generation, concept extraction, duplicate checks, and cancellation.
- **Desktop + Bridge access**: Added Tauri menu/IPC `open_notemd` and bridge routing for NoteMD window access from web/Tauri/Godot-connected workflows.
- **Safety defaults**: NoteMD file operations are constrained by KB-root sandbox checks, with SSE progress reporting and cancel support for long-running operations.

<img width="2012" height="2024" alt="image" src="https://github.com/user-attachments/assets/e5e4c42d-54a7-463c-bc43-0feb42469a12" />

---

<a id="hardware-en"></a>

## 💻 Hardware & Driver Requirements

### Supported AMDGPU Architectures

NoteConnection utilizes `gpu.js` for WebGL-based acceleration and plans to support local AI inference via ROCm.

- **RDNA 3 (Recommended)**: Radeon RX 7000 Series (e.g., **RX 7900 XT/XTX**).
  - _Status_: Best performance for both WebGL and Compute.
- **RDNA 2**: Radeon RX 6000 Series.
  - _Status_: Stable and mature support.

### Driver Configuration

#### Windows (Development Environment)

- **Driver**: **AMD Software: Adrenalin Edition** (23.12.1+).
  - Required for DirectX 12/Vulkan/OpenGL support which underpins WebGL.
- **Build Tools**: To compile `headless-gl` for Node.js:
  - Python 3.x installed and in PATH.
  - Visual Studio Build Tools (C++ workload).

#### Linux (Recommended for AI)

- **Mesa (RADV/Radeonsi)**: Default open-source driver. Best for general WebGL and `gpu.js`.
- **ROCm (Radeon Open Compute)**: Install **only** if planning to develop the AI inference features (future roadmap). NoteConnection's core visualization runs fine on standard Mesa drivers.

---

<a id="architecture-en"></a>

## 🏢 System Architecture

NoteConnection is built on a modular architecture designed for performance and extensibility.

### Backend (`src/backend`)

- **GraphBuilder**: The core orchestrator. It manages the pipeline from file reading to graph construction.
- **Worker Threads**: Heavy lifting (keyword matching, text analysis) is offloaded to a pool of worker threads (`src/backend/workers`), ensuring the main thread remains responsive.
- **Inference Engines**:
  - `StatisticalAnalyzer`: Calculates co-occurrence matrices.
  - `VectorSpace`: Handles TF-IDF embedding and cosine similarity.
  - `HybridEngine`: Combines signals to suggest directed edges.

### Frontend (`src/frontend`)

- **Dual-Engine Renderer**:
  - **D3.js (SVG)**: Used for high-fidelity, interactive graphs with detailed tooltips and CSS styling.
  - **HTML5 Canvas**: Optimized for rendering massive datasets where DOM manipulation overhead is too high.
- **State Management**: `SettingsManager` persists user preferences (Physics, Visuals) to `localStorage`.
- **Layout Logic**: Custom algorithms for Sugiyama-style layering and Force-directed physics.

### Desktop Bridge (`src/core`)

- **PathBridge**: standard WebSocket server (Port 9876) that exposes the internal graph state to external applications (e.g., Godot Engine), enabling hybrid web/native visualization pipelines.

---

<a id="quick-start-en"></a>

## 📦 Quick Start

### Option 1: Windows Installer (Recommended)

1. Download `NoteConnection.Setup.exe` from the [Latest Releases](https://github.com/Jacobinwwey/NoteConnection/releases).
2. Run the installer.
3. Launch NoteConnection from your desktop or start menu.

### Option 2: Run with npx

No installation required.

```bash
npx noteconnection
```

### Option 3: Global Installation

```bash
npm install -g noteconnection
noteconnection
```

### Option 4: Local Development

```bash
git clone https://github.com/Jacobinwwey/NoteConnection.git
cd NoteConnection
npm install
npm start
```

- Server runs at: `http://localhost:3000`

### Option 5: Mobile Support (Android)

NoteConnection now supports **two Android generation paths**:

1. **Capacitor APK path** (web-asset runtime, stable for reader/visualization workflows).
2. **Tauri Android path** (native shell pipeline aligned with `docs/tauri_brainstorming.md`).

Build/release/runtime details are audited in:

- `docs/en/multi_platform_build_flow_audit.md`
- `docs/zh/multi_platform_build_flow_audit.md`

#### Prerequisites

- **Node.js** (LTS)
- **Java JDK** (21 or higher)
- **Android SDK** (Configured in `ANDROID_HOME` or via Android Studio)

#### Method A: Capacitor Build (Stable)

Simply run the included batch script on Windows:

```cmd
build_apk.bat
```

This script automatically:

1. Checks your environment (Node, Java, Android SDK).
2. Installs dependencies.
3. Builds web assets.
4. Syncs with Capacitor.
5. Compiles the APK using Gradle.

You can also trigger the same pipeline through npm:

```bash
npm run mobile:build:capacitor
```

#### Method B: Tauri Android Build (Native Shell)

```bash
# First-time setup on the machine
npm run tauri:android:init

# Build APK/AAB through Tauri Android pipeline
npm run tauri:android:build
```

#### Method C: Capacitor Manual Build Steps

1.  **Build Web Assets**:
    ```bash
    npm run build
    ```
2.  **Sync to Android Platform**:
    ```bash
    npx cap sync
    ```
3.  **Build APK**:
    Open the `android` directory in Android Studio and build, or use the command line:
    ```bash
    cd android
    ./gradlew assembleDebug
    ```
    APK will be located at: `android/app/build/outputs/apk/debug/app-debug.apk`

#### Mobile Capability Boundary

- Capacitor packaging path does not embed the desktop Node sidecar workflow, but native Capacitor runtime can still build graph payloads locally when Filesystem APIs are available and the dataset stays within mobile limits.
- Tauri Android path provides the native-shell runtime route and uses Android-native `build_graph_runtime` when mobile-side parity with the Tauri architecture is required.

### 3. Usage Guide

1.  **Select Source**: Use the dropdown in the top-left to choose a folder from `Knowledge_Base`.
2.  **Load**: Click "Load". For large datasets (>200 files), parallel processing engages automatically.
3.  **Explore**:
    - **Layout**: Toggle **DAG** for hierarchy or **Force** for clusters.
    - **Renderer**: Switch to **Canvas** if the graph feels sluggish.
    - **Focus**: Click a node to enter Focus Mode. Use the sliders to adjust spacing.
    - **Control**: Use the **Simulation** panel to freeze the layout or adjust speed.

<a id="cli-en"></a>

## 🖥️ CLI Usage (v0.9.71)

You can load a knowledge base and build the graph directly from the command line without using the UI. This is useful for automated builds or headless environments.

### Usage

```bash
npm start -- --path "<path_to_knowledge_base>" [options]
```

### Options

| Option      | Description                                                          | Default                        |
| ----------- | -------------------------------------------------------------------- | ------------------------------ |
| `--path`    | Absolute path to the folder containing your Markdown files.          | `Knowledge_Base`               |
| `--gpu`     | Enable AMDGPU/WebGL acceleration for layout and vector calculations. | `true` (if hardware supported) |
| `--no-gpu`  | Disable GPU acceleration (Force CPU).                                | `false`                        |
| `--static`  | Enable Static Mode (Backend calculation only, frozen frontend).      | `false`                        |
| `--workers` | Number of worker threads to use.                                     | `numCPUs - 1`                  |

### Example

```bash
# Basic Load
npm start -- --path "C:/Users/MyName/Documents/MyNotes"

# GPU Accelerated Build
npm start -- --path "E:/Knowledge/ObsidianVault" --gpu

# Force CPU (if GPU has issues)
npm start -- --path "E:/Knowledge/ObsidianVault" --no-gpu
```

**Note:** CLI runs generate unique data files (`data_cli_{kb_name}_{time}.js`) to preserve the original `data.js`. When the server starts, it will automatically serve these specific files to the frontend.

## 📂 User-Defined Knowledge Base (v1.0.0)

Managing your knowledge base source is now easier than ever.

- **First Run Setup**: On first launch, you will be prompted to select your `Knowledge_Base` folder.
- **Persistent Config (`app_config.toml`)**: Your KB path, language, and multi-window preferences are saved in `%LOCALAPPDATA%/NoteConnection/app_config.toml` (Windows default) and remembered across restarts.
- **Legacy Auto-Migration**: If a legacy `kb_config.json` exists in the same config directory, NoteConnection automatically migrates it to `app_config.toml`.
- **Change Anytime**: Use the **File > Change Knowledge Base...** menu option to switch folders instantly.
- **Reset**: Use **File > Reset to Default** to return to the bundled demo notes.
- **Config Path Overrides**: Set `NOTE_CONNECTION_CONFIG_PATH` (full file path) or `NOTE_CONNECTION_CONFIG_DIR` (directory) to customize where `app_config.toml` is stored.
- **Window Behavior Tuning**: Edit `[multi_window]` in `app_config.toml` (`single_window_mode`, `hide_tauri_when_pathmode_opens`, `restore_tauri_when_pathmode_exits`, `confirm_before_full_shutdown_from_godot`, `sync_language`).
- **Reader Protocol Tuning**: Edit `[frontend_settings.reading]` (`markdown_engine`, `chunk_block_size`, `prefetch_blocks`, `index_cache_ttl_sec`, `max_doc_bytes`) to control markdown reading behavior in both Tauri and Godot.
- **Detailed Config Guide**: See [`docs/en/app_config.toml_guide.md`](app_config.toml_guide.md) and template [`docs/examples/app_config.template.toml`](../examples/app_config.template.toml).

```toml
# Minimal recommended app_config.toml
knowledge_base_path = "E:/Knowledge_project/NoteConnection_app/Knowledge_Base"
user_language = "en"

[multi_window]
single_window_mode = true
hide_tauri_when_pathmode_opens = true
restore_tauri_when_pathmode_exits = true
confirm_before_full_shutdown_from_godot = true
sync_language = true

[frontend_settings.reading]
mode = "window"
markdown_engine = "auto" # "legacy" | "pulldown" | "auto"
chunk_block_size = 36
prefetch_blocks = 8
index_cache_ttl_sec = 1800
max_doc_bytes = 100663296
```

### Markdown Reader Protocol (v1.6.6)

- Dual-engine gray rollout:
  - `auto`: pulldown first, legacy fallback on failure.
  - `pulldown`: still keeps legacy fallback for session safety.
  - `legacy`: force original parser behavior.
- Unified protocol across windows: Tauri and Godot readers consume `POST /api/markdown/index`, `chunk`, `resolve-node`, and `resolve-wiki`.
- Large-document resilience: reader now supports block-based incremental loading rather than requiring a single full-document response.

## 🏗️ Build & Deployment

For developers building from source, NoteConnection offers two build modes:

- **Electron desktop pipeline was removed on 2026-03-01 (deprecated and decommissioned).**

- **Tauri Build (`npm run tauri:build`)**: Default desktop package path. Uses runtime-first assets and excludes pre-generated graph payloads.
- **Tauri Mini Build (`npm run tauri:build:mini`)**: Legacy-compatible alias of the same runtime-first packaging path.
- **Tauri Full Graph Build (`npm run tauri:build:full`)**: Explicit opt-in path for including generated graph assets when real files are present locally.
- **Build (`npm run build`)**: Default runtime-first frontend build.
- **Build Full Graph Assets (`npm run build:full`)**: Explicit opt-in frontend build for local/demo scenarios that need pre-generated graph assets.
- **Godot Bootstrap** (`npm run prepare:godot:bin`): materializes the host Godot sidecar from local overrides/search paths, cache, or a pinned download URL.
- **Desktop Release Godot Mirror**: release CI now seeds a project-controlled GitHub Releases mirror tag for Godot archives, then downloads mirror-first with upstream fallback.
- **LFS Policy Guard** (`npm run verify:lfs:policy`): blocks new Git LFS drift under `src/frontend/` and `src-tauri/bin/` while migration still carries legacy exemptions. Future strict mode is available via `npm run verify:lfs:policy:strict`.
- **Sidecar Supply Readiness** (`npm run verify:sidecar:supply`): reports whether the current desktop host is offline-ready or still network-dependent before shrinking the remaining sidecar LFS bridge.
- **Mirror Feasibility Docs**: use `/diataxis/en/explanation/sidecar-supply-feasibility/` for the current cost/user-friction/maintainer-burden decision matrix behind GitHub Releases vs object storage mirror options.
- **GPU Dev Start (`npm run tauri:dev:mini:gpu`)**: Recommended GPU-enabled Tauri development command.
- **Do not use** `npm run tauri:dev:mini --gpu` because npm treats `--gpu` as config and prints warnings.

## 📚 Documentation Architecture (Diataxis + MkDocs)

- Canonical long-form docs remain under `docs/en/*` and `docs/zh/*`.
- Diataxis navigation pages are maintained under `docs/diataxis/<lang>/*`.
- Mapping governance is versioned in `docs/diataxis-map.json`.
- Run mapping validation: `npm run docs:diataxis:check`.
- Run local docs site preview: `npm run docs:site:serve`.
- Build static docs site: `npm run docs:site:build`.
- GitHub Pages docs portal (project site): `https://jacobinwwey.github.io/NoteConnection/`.
- Publish workflow: `.github/workflows/docs-github-pages-publish.yml` (`workflow_dispatch` + `git_ref` rollback).
- CI policy gate for docs mapping and site build: `.github/workflows/docs-diataxis-site.yml`.

## 🛠️ Hardware & Driver Requirements (AMDGPU)

For optimal performance with "GPU Optimised Rendering", especially on AMD RDNA cards (like RX 7900XT):

1.  **Drivers**: Ensure you have the latest **AMD Adrenalin Edition** drivers installed.
2.  **Node.js**: The project uses `gpu.js` which relies on `headless-gl` for Node.js context.
    - On Windows, this usually works out of the box with standard build tools (`windows-build-tools`).
    - If you encounter `gl` errors, ensure Python and C++ compilers are available.

<a id="changelog-en"></a>

## 📅 Changelog

### v1.6.6 - Unified Provider Runtime & TOML Settings Consolidation (2026-03-26)
- Upgraded NoteMD provider calls to a definition-driven architecture with transport dispatch and provider metadata (apiKeyMode, apiTestMode, category).
- Added expanded built-in provider presets (Qwen, Doubao, Moonshot, GLM, MiniMax, Groq, Together, Fireworks, Requesty, OpenAI Compatible) while keeping legacy compatibility.
- Unified persisted settings across Tauri + Godot + NoteMD in app_config.toml:
  - full NoteMD settings and provider registry ([notemd] + [[notemd.providers]])
  - Path Mode runtime settings ([path_mode]) via /api/path-mode/settings
  - migration-safe legacy [notemd.api] mirror.
- Hardened Rust TOML save behavior to preserve unknown sections so Tauri writes do not erase NoteMD/Path Mode config blocks.

### v1.6.5 - Documentation Portal Update (2026-03-26)
- Published MkDocs docs to GitHub Pages project site.
- Added bilingual README navigation for user and developer doc entry points.
- Standardized maintainer publish flow:
  - `npm run docs:site:build`
  - `.github/workflows/docs-github-pages-publish.yml` (`workflow_dispatch` supports `git_ref` rollback)

### v1.6.0 - Unified Runtime, NoteMD Integration & Release Hardening (2026-03-23)

- **Tag Compare Snapshot (`v1.3.0..v1.6.0`)**:
  - `107` commits, `301` files changed, `+125,957 / -10,083` churn.
  - File status distribution: `241` added, `56` modified, `3` deleted, `1` renamed.
  - Main engineering footprint: `src/`, `docs/`, `scripts/`, `path_mode/`, and `src-tauri/`.

- **Single-Window Runtime Orchestration**:
  - Implemented Tauri <-> Godot visibility handoff so only one primary window is shown at a time.
  - Added Godot close-confirm flow ("Return to main interface" vs "Close all windows") to prevent accidental full shutdown.
  - Stabilized Godot window visibility control and removed deprecated foreground APIs.
- **NoteMD Embedded Experience**:
  - Kept NoteMD as an embedded experience (not a standalone desktop window) aligned with both Tauri and Godot flows.
  - Fixed non-responsive `Browse` actions in Tauri NoteMD (file/folder/save pickers now complete the IPC flow).
  - Added user guidance that PDF files must be converted to Markdown via Mineru before import.
- **Platform & Toolchain Release Readiness**:
  - Standardized Java policy to **JDK 21+** and verified support for **JDK 23.0.1** in Android prerequisites/build tooling.
  - Added Android/Tauri patching and verification scripts for prerequisite checks, sidecar validation, and strict evidence gates.
- **Reliability & Security Gates**:
  - Expanded CI/workflow coverage for FixRisk operational readiness, mobile e2e contracts, wasm parity, SBOM, attestation, and signature/privacy checks.
  - Added broad contract-level regression coverage across mobile/runtime/pathbridge/storage layers.
  - Included pre-release CI compatibility fixes for runtime bridge invoke-contract assertions and unsigned SBOM transparency policy handling.
- **Build Performance & Developer Experience**:
  - Added low-memory Tauri build wrappers and release-profile safeguards for constrained environments.
  - Added sidecar readiness preflight to skip redundant rebuilds during dev startup, reducing warm `tauri:dev:mini:gpu` startup latency.

### v1.5.x Migration Runtime Logs (Canonical Archive)
- Full bilingual logs are centrally archived in [`export.md`](export.md).
- This README keeps summary pointers in the changelog for readability.
- `2026-03-22 v1.5.58`: NoteMD migration closure (integration contracts + full feasibility verification + bilingual docs closure)
- `2026-03-03 v1.5.10`: Option A P0 Status Update (Tauri Android Native Folder/Build/Content Flow)
- `2026-03-03 v1.5.5`: Migration Status Revalidation
- `2026-03-03 v1.5.3`: Migration Gate Closure Update
- `2026-03-02 v1.5.1`: Tauri Migration Progress Update (Desktop + Android)

### v1.4.5 - Physically-Based Bubbles & Interactive Physics (2026-03-01)

- **Godot Renderer Upgrade**:
  - **Spectral Bubble Shader**: Introduced an advanced 81-wavelength Thin-Film Interference shader (`sp_spectral_filter`) combined with 3D noise for hyper-realistic iridescent soap bubbles.
  - **Interactive Physics**: Converted all static bubbles into physically simulated `RigidBody3D` entities. Bubbles now gently float, bump into each other, and orbit their targets naturally.
  - **Environment Cleared**: Removed the floor to allow 360-degree floating visualization without ground clipping.
- **UI Enhancements**:
  - **Cancel Completion**: The "Mark Complete" button dynamically turns into "Cancel Completion" for already learned nodes, making curriculum management much more forgiving and interactive.

### v1.4.4 - Tauri Bridge Stabilization & Cache Workflow Hardening (2026-03-01)

- **Electron -> Tauri Runtime Alignment**:
  - **Path Consistency**: Unified runtime path resolution so sidecar graph artifacts are read from bundled frontend assets and written to a writable runtime data directory.
  - **Knowledge Base Discovery**: Standardized folder listing and loading flow for `Knowledge_Base` source roots in Bridge-first mode.
- **Build/Load Safety**:
  - **Cache Decision Flow**: Restored pre-build decision behavior (`Load Existing` vs `Regenerate`) when target cache already exists.
  - **Duplicate Request Suppression**: Added frontend + backend de-dup guards to prevent repeated restore/build execution on a single load action.
- **PathBridge / WebSocket Stability**:
  - **Client Diagnostics**: Added tagged client connect/close logging (id, tag, code, reason) for precise bridge RCA.
  - **Godot URL Compatibility**: Fixed Godot websocket URL parsing by switching to `ws://127.0.0.1:9876/?client=godot`.
  - **Idle Reconnect Elimination (Tauri)**: Disabled `frontend-early` auto-connect in Tauri mode to stop background `1001` reconnect churn.
- **Language/Menu Sync Robustness**:
  - **Idempotent Sync**: Added language sync guards in both frontend i18n and Tauri Rust command handlers to avoid repeated no-op menu updates.

### v1.4.3 - 9-Rule Tree Layout Engine (2026-02-26)

- **Layout Engine Upgrade**:
  - **Spine & Tributaries Logic**: Replaced basic geometric node placement with a robust 9-Rule Topological Layout engine (Expansion Order, Preceding Immunity, Following Migration, Single Appearance, Cross-Tributary Isolation, Spine Always Visible, Sticky Claim, Unit Migration, Tributary Hierarchy Immunity).
  - **Node Ownership**: Implemented a recursive claiming system where expanding nodes naturally claim their prerequisites (tributaries), arranging them in a visually structured hierarchy.
- **Frontend Enhancements**:
  - **Expansion Tracking**: The system now seamlessly tracks node expansion orders, ensuring precise deterministic rendering as complex prerequisite chains are unspooled.
  - **Sticky Claims (Configurable)**: Node ownership persists across view updates, avoiding jarring layout reorganizations during consecutive clicks.
- **Godot Renderer Adaptations**:
  - **Expansion Badges**: Added intuitive `[+]`/`[-]` badges in the Godot desktop renderer to indicate combinable prerequisite branches visually.
  - **Spine Highlighting**: Core critical-path nodes ("Spine") receive an elegant glowing border to distinguish the primary learning flow from peripheral branches.

### v1.4.1 - Tree View Interaction Fixes (2026-02-01)

- **Interaction Polish**:
  - **Long Press Navigation**: Fixed an issue where Long Press (0.6s) on a node would trigger the Context Menu instead of navigating to the node. Now correctly switches the Central Node.
  - **Collapse All**: Added a dedicated `[-]` button to the Learning Path header and enabled Middle Click to instantly collapse all expanded nodes.
  - **Right-Click Toggle**: Fixed a regression where Right-Click would not correctly toggle node expansion states.
  - **Lazy Loading UI**: Replaced separate `(+)/(-)` buttons with a unified, state-aware `[Count]` indicator that toggles visibility of prerequisite chains.

### v1.4.0 - Path Mode Learning UX & Tree View (2026-01-30)

- **Path Mode Bug Fixes**:
  - **Unmark Sync Fix**: Added `unmarkComplete` and `completionSync` handlers to `PathBridge.ts`.
  - **UI Sync on Unmark**: Tree panel refresh + central bubble progress update after unmarking.
  - **Shader Syntax Fix**: Corrected `depth_draw_alpha_prepass` to `depth_prepass_alpha`.
- **Path Mode Learning UI**:
  - **Navigation History**: Return button with dropdown for learning history.
  - **Edit Mode**: Toggle to enable/disable unmarking nodes on PC.
  - **Tree Panel**: Collapsible dependency tree with visual states.
  - **Progress Display**: "X of N" progress indicator on central bubble.
- **Planned: Enhanced Graphical Tree View**:
  - SubViewport overlay with bezier curves (mind-map style).
  - 4 visual themes: Colorful (default), Dark, Glass, Minimal.

### v1.3.0 - Path Mode Polish & UI Refinements (2026-01-24)

- **Reader Integration**:
  - **Seamless Access**: Double-clicking the central node in "Orbital Layout" now instantly opens the `Reader`, displaying full node content.
  - **Data Fetching**: Fixed a critical issue where the reader would open empty; now correctly retrieves full metadata from the global graph state.
- **Visual Polish**:
  - **Orbital Layout**: Significantly improved node dispersion (Radius 350-950px) to reduce label overlap.
  - **Edge Clarity**: In Orbital mode, strictly hides edges not connected to the central node, reducing visual clutter by 90%.
  - **Label Visibility**: Peripheral nodes now always display labels, sized proportionally to their distance (max 16px).
  - **Depth of Field**: Adjusted opacity falloff to ensure distant nodes remain visible (min 0.4 opacity).
- **UX Improvements**:
  - **Target Selection**: Increased the "Target Node" search limit from 20 to 300, ensuring users can find any node in the graph.
  - **Interactive Layers**: Fixed `z-index` layering issues where the Reader window was previously hidden behind the Path visualization.

### v1.2.0 - Path Mode & Desktop Renderer (2026-01-23)

- **Path Mode**: Introduced a major new feature set for converting graphs into linear learning paths.
  - **Learning Modes**: 'Domain Learning' (Topological) and 'Diffusion Learning' (Goal-oriented).
  - **Visualization**: New Radial and Tree layouts powered by D3/Canvas.
  - **Strategies**: 'Foundational' and 'Core' sorting algorithms.
- **Hybrid Architecture**:
  - **Godot Bridge**: Implemented `PathBridge.ts` to sync graph state with external renderers via WebSocket (Port 9876).
  - **Native Rendering**: Added support for Godot 4.3 to render the graph with high-fidelity Vulkan graphics (Source in `path_mode/`).
- **DevOps**:
  - **NPM Scripts**: Added `pathmode:dev` and `pathmode:test` workflows.
  - **UI Stability**: Fixed critical bugs in Radial Layout visibility (`centerView`) and Exit Mode logic.

### v1.1.2 - Path Resolution & UI Stability (2026-01-23)

- **Backend Protocol Fix**:
  - Improved `src/server.ts` to correctly handle URL query parameters (e.g., `?v=timestamp`) for static files.
  - Resolves issues where cache-busting URLs would return 404 on Windows.
- **UI Interaction Fix**:
  - **Welcome Modal**: Fixed a bug in `welcome.js` where skipping the tutorial would cause the folder selection menu to become unresponsive due to `z-index` clobbering.
  - Guaranteed `z-index: 1000` preservation for `#source-control` across all modal dismissal paths.

### v1.1.1 - Mobile Build Automation (2026-01-22)

- **Mobile DevOps**:
  - Introduced `build_apk.bat` for one-click Android APK generation on Windows.
  - Automated environment checks (Node, JDK, Android SDK) and project scaffolding.
- **Documentation**: Added comprehensive guides for mobile building in README and User Manual.

### v1.1.0 - CI/CD Automation (2026-01-22)

- **GitHub Actions Integration**:
  - Added automated npm publishing workflow triggered on releases and version tags.
  - Added version consistency check to prevent mismatched releases.
- **DevOps**: Streamlined release process with `git tag v1.1.0 && git push --tags`.

### v1.0.1 - Maintenance & UX Refinement (2026-01-21)

- **Multilingual Consolidation**:
  - Removed redundant hardcoded translation logic in `app.js`.
  - Centralized all UI strings into `I18nManager` for consistent language switching.
  - Fixed "Mixed Language" issue in Welcome Modal where some labels remained in English.
- **Onboarding UX Fixes**:
  - **Tutorial Stability**: Fixed a crash in Focus Mode tutorial by exposing `enterFocusMode` correctly.
  - **Welcome Modal Timing**: Resolved race conditions in `source_manager.js` to ensure the modal displays accurately after data is loaded.
- **Protocol & Caching**:
  - **Cache-Busting Handler**: Implemented a dynamic script loader in `source_manager.js` using timestamps to prevent browsers from serving stale `data.js` or `app.js`.
  - **Refined Protocol Handler**: Optimized `app://` protocol in `main.ts` using `net.fetch` for more robust local file serving in production.

### v1.0.0 - Production Release (2026-01-14)

- **Stability & Mini Build Reliability**: Major fixes for the "Mini" build mode.
  - **First-Run Fix**: Resolved critical crashes when no data is present on first launch (Added `typeof` safety checks).
  - **Artifact Cleanup**: Build process now automatically cleans up previous data artifacts to ensure minimum installer size (~70MB).
  - **Worker Path Fix**: Corrected path resolution for backend workers in production builds (Resolved double-dist folder issue).
- **Absolute Offline Strategy**: All external CDN dependencies migrated to local assets. The system is now 100% functional without an internet connection.
- **Focus Mode Refinement**:
  - **Visual Restoration**: Fixed a bug where nodes retained Focus Mode sizes after exit. Now perfectly restores pre-focus radius and font-size.
  - **Stability**: Fixed D3 sibling selection (`getAttribute`) errors during Focus entry.
- **Physics & Spacing Overhaul**:
  - **New Defaults**: Standard link distance increased to **250px** and collision radius to **25px**.
  - **Expanded Customization**: Slider ranges increased significantly (up to 600px distance / 100px collision).
- **Quality of Life**: Knowledge Base "All Folders" is now automatically selected in Electron mode for a smoother start.
- **Performance & Focus Overhaul**:
  - **O(1) Neighbor Lookup**: Adjacency caching reduces transition time from O(N\*M) to O(1).
  - **Batched Rendering**: UI updates synchronized via `requestAnimationFrame`.
- **User-Defined Knowledge Base**: New First-Run Setup, persistent configuration, and menu controls.
- **Security & CSP**: Enhanced CSP for extreme offline security and removed deprecated flags.

### v0.9.83 (2026-01-13)

- **GPU Worker Integration**: Fully enabled GPU acceleration in the frontend Simulation Worker. The worker now dynamically imports `gpu-browser.min.js` and `layout_gpu.js` and respects the `gpuRendering` setting.
- **Performance Fix**: Resolved an issue where "GPU Optimised Rendering" was ignored during the initialization phase, forcing CPU calculation. Large graphs now load significantly faster.
- **Robustness**: Fixed a critical bug in `updateParams` where existing GPU force instances were accidentally overwritten by CPU forces when changing physics settings.

### v0.9.82 (2026-01-12)

- **Worker Sync & Stability**: Introduced the Worker Handshake Protocol (`isLayoutSwitching`) to eliminate layout "bounce" and race conditions during transitions.
- **Focus Mode Interaction**: Decoupled manual dragging from physics in Focus Mode, ensuring nodes stay exactly where positioned without simulation interference.
- **Layout Persistence**: Added a 50% restoration safety threshold to the layout cache; automatically falls back to simulation relaxation if data is inconsistent.
- **Analysis Stability**: Optimized layout logic to prevent redundant resets during panel resizing while "Freeze Layout" is active.

### v0.9.74 (2026-01-12)

- **GPU Link Force**: Implemented high-performance GPU-accelerated spring forces using `gpu.js`. Supports "Gather" algorithm for efficient neighbor processing.
- **Physics Robustness**: Introduced velocity clamping (MAX_VELOCITY=100) and NaN/Infinity safety guards in GPU kernels to prevent node "explosions" and disappearing nodes.
- **Layout Switching Fix**: Implemented robust state preservation (`layoutCache`) for Force and DAG layouts, ensuring node positions are saved and restored without "teleportation". Fixed a critical crash in `updateLayout` and added Focus Mode support for GPU forces.
- **GPU Resource Management**: Refactored `layout_gpu.js` to use a Singleton pattern for the GPU context, preventing WebGL context leaks (limit 16) when toggling settings.

### v0.9.71 (2026-01-10)

- **Backend Parallel Layout**: Accelerated front-end loading by pre-calculating node positions on the backend using worker threads or GPU.
- **GPU Optimised Rendering**: In the backend layout, added support for AMDGPU acceleration.
- **Static Mode**: Implemented strict simulation freezing for massive graphs (>5000 nodes) to save resources.
- **CLI Support**: Added full CLI argument support for automated building and loading.
- **Extreme Scale Optimization**: Disabled edge rendering entirely for graphs with >10,000 nodes to prevent browser crashes.

### v0.9.70 - Frontend Initialization Fix (2026-01-09)

- [x] **Critical Fix**: Fixed a race condition where the rendering loop started before UI controls were fully initialized, causing blank screens and unresponsive buttons on large datasets.

### v0.9.69 - Frontend Crash Fix (2026-01-09)

- [x] **Critical Fix**: Resolved a "Maximum call stack size exceeded" crash in the frontend when loading graphs with over 100,000 edges. This fixes the "Nodes: 0" issue for massive datasets.

### v0.9.67 - Compact Mode & Canvas Fix (2026-01-08)

- [x] **Compact Mode**: Added a new mode that hides edges by default to improve performance for massive graphs (>5k nodes). This mode is automatically enabled for large datasets but can be toggled in settings.
- [x] **Canvas Fix**: Resolved an issue where large graphs would display a blank screen on load by forcing an initial canvas render frame.
- [x] **Optimization**: Rendering loop now completely skips edge iteration in Compact Mode, significantly reducing CPU usage during idle or pan/zoom.

### v0.9.61 - Frontend Memory Optimization (2026-01-07)

- [x] **Smart Rendering**: Automatically switches to **Canvas** mode by default when the graph contains more than 3000 nodes.
- [x] **Performance**: Reduces browser memory footprint and improves frame rates for large datasets on initial load.

### v0.9.60 - Parallel Graph Metrics (2026-01-07)

- [x] **Performance**: Parallelized the "Graph Metrics" calculation (Betweenness Centrality) using worker threads.
- [x] **Scalability**: Distributed heavy Brandes Algorithm computations across multiple CPU cores, ensuring faster graph construction for large datasets.

# 2026-01-07 v0.9.59 - Vector Space Memory Fix (Sparse Matrix)

**Goal**: Resolve the "Heap out of memory" crash on Windows 10/11 (128GB RAM) when processing 13k+ files by replacing the dense TF-IDF matrix with a Sparse Vector implementation.

- [x] **Memory Optimization**
  - [x] **Sparse Vectors**: Refactored `VectorSpace` to use `Uint32Array` (indices) and `Float32Array` (values) instead of standard Javascript Arrays.
  - [x] **Efficiency**: Reduced memory footprint for 13k files from ~10GB+ (dense) to <500MB (sparse).
  - [x] **Algorithm**: Optimized Cosine Similarity calculation to use sparse dot product ($O(min(N, M))$).
  - [x] **Config**: Increased default Node.js heap limit to 12GB (`--max-old-space-size=12288`) in `package.json` to utilize available system RAM.

# 2026-01-07 v0.9.58 - Hybrid Inference Resource Reuse (Optimization)

- [x] **Memory Optimization**: Implemented resource reuse logic for "Statistical Matrix" and "Vector Space" in `GraphBuilder`.
- [x] **Efficiency**: Prevents redundant recalculation of heavy data structures during Hybrid Inference, eliminating memory spikes and resolving OOM crashes on large datasets.
- [x] **Cleanup**: Added strict memory cleanup steps after inference tasks complete.

### v0.9.57 - Worker Memory Optimization (2026-01-07)

- [x] **Stability Fix**: Resolved "Heap out of memory" crashes when processing large datasets (>13k files) by optimizing the data transfer strategy for Worker Threads.
- [x] **Efficiency**: Workers now receive file paths and read content on-demand, eliminating the memory overhead of cloning large file content strings across threads.

### v0.9.56 - Hybrid Inference Memory Optimization (2026-01-05)

- [x] **Memory Analysis**: Added granular performance logging to the Hybrid Inference engine, tracking heap usage every 1000 nodes to identify memory spikes on Windows.
- [x] **Optimization**: Implemented aggressive memory cleanup (clearing matrices and nullifying vector space) immediately after inference completion to prevent Heap OOM.

### v0.9.55 - Heap OOM Fix & Iterative DFS (2026-01-05)

- [x] **Stability Fix**: Resolved "Heap out of memory" crashes on Windows 10/11 by implementing explicit memory clearing for file content before the algorithmic phase.
- [x] **Robustness**: Refactored `CycleDetector` to use an **Iterative DFS** (stack-based) approach, eliminating stack overflow risks on deep graphs.
- [x] **Observability**: Split performance logging for "Algorithmic Core" into distinct "Cycle Detection" and "Topological Sort" phases for precise debugging.

### v0.9.54 - Welcome Experience (2026-01-05)

- [x] **Onboarding**: Added a "Welcome" modal that appears when the graph is empty, guiding new users to select a source and load data.
- [x] **UX**: Highlights the "Source Select" controls during the welcome state.

### v0.9.53 - Core API Decoupling (2026-01-05)

- [x] **Architecture Refactor**: Extracted the core graph building logic into a standalone `NoteConnection` class (`src/core/NoteConnection.ts`).
- [x] **Plugin Prep**: Decoupled the core API from CLI/Server-specific file operations, enabling direct integration with future Joplin/Obsidian plugins.
- [x] **Documentation**: Updated User Manual with missing "Max Workers" performance setting.

### v0.9.52 - Cycle Detection Memory Optimization (2026-01-05)

- [x] **Stability Fix**: Resolved a critical "Heap out of memory" crash on Windows 10/11 when building large graphs with many cycles.
- [x] **Algorithm Optimization**: Updated `CycleDetector` to limit the number of detected cycles, preventing excessive memory consumption during recursion.

### v0.9.51 - Performance Logging & Crash Reporting (2026-01-03)

- [x] **System Monitoring**: Implemented comprehensive performance logging for backend processes (CPU, Memory, Time).
- [x] **GPU Diagnostics**: Added execution timing and memory tracking for GPU acceleration steps.
- [x] **Crash Reporting**: Implemented `CrashLogger` to automatically record unhandled exceptions and worker failures to `crash.log` for debugging stability issues on Windows 11.
- [x] **Optimization**: Integrated `PerformanceLogger` across the entire Graph Construction pipeline (Node Init, Edge Matching, Inference).

### v0.9.50 - GPU Acceleration (2026-01-02)

- [x] **Verification**: Confirmed feasibility of using **AMD Radeon 7900XT** for graph construction acceleration via `gpu.js`.
- [x] **Strategy**: Validated that Mathematical Inference (Vector Similarity) can be offloaded to GPU, while Text Processing remains optimized on CPU.
- [x] **Implementation**: Added `amdgpu` module with `VectorSpaceGPU` class. Integrated into `GraphBuilder` to automatically use GPU for Cosine Similarity matrix calculations when enabled.

### v0.9.49 - Statistical Analysis Memory Optimization (2026-01-02)

- [x] **Performance**: Fixed a critical "Heap out of memory" crash when processing large datasets (>10,000 files) by optimizing the Statistical Analyzer algorithm.
- [x] **Efficiency**: Reduced the complexity of co-occurrence matrix calculation by ~30x using a sparse, file-centric approach.

### v0.9.49 - UI Controls for Parallel Processing (2026-01-02)

- [x] **Settings UI**: In the Settings Modal, added a "Performance" section with a slider and number input to control "Max Workers".
- [x] **API Integration**: The "Load" button now sends the user-defined worker limit to the backend build process.
- [x] **Persistence**: The worker setting is saved in `localStorage` alongside other preferences.

### v0.9.48 - Parallel Processing Optimization (2026-01-02)

- [x] **Configurable Workers**: Added 'maxWorkers' configuration to allow utilizing more CPU cores for graph building and statistical inference. Removed the hardcoded limit of 12 workers.

### v0.9.47 - Focus Mode Interaction & Layout Fixes (2026-01-02)

- [x] **Interaction Logic**: Fixed an issue where double-clicking a node to enter Focus Mode would accidentally trigger a zoom-in event. Added event propagation control to prevent this (SVG & Canvas).
- [x] **Vertical Layout Spacing**: Increased the horizontal offset of node labels in Vertical Focus Mode to prevent text from overlapping with nodes, improving readability (SVG & Canvas).

### v0.9.46 - Focus Mode UI Cleanup & Canvas Edge Fix (2025-12-26)

- [x] **Immersive Focus**: The main control panel and source selection bar are now completely hidden during Focus Mode for a distraction-free experience.
- [x] **Canvas Polish**: Removed edge rendering in Canvas Focus Mode to reduce visual noise.

### v0.9.45 - Canvas Interactivity & Cleanup (2025-12-26)

- [x] **Canvas Interactive**: Canvas mode now supports Hover (Highlight), Single Click (Stats), and Double Click (Focus Mode) interactions, bringing it to feature parity with SVG.
- [x] **Visual Fixes**: Fixed an issue where nodes in Canvas mode were rendered too large; they now respect "Size By" settings.
- [x] **Cleanup**: Removed the deprecated "View Mode" (Clusters) feature.

### v0.9.44 - Independent Focus Mode Spacing (2025-12-26)

- [x] **Smart Spacing**: "Layer-Space" and "Node-Space" settings are now saved independently for "Horizontal" and "Vertical" focus layouts.
- [x] **Optimized Defaults**: Reduced default Horizontal Layer-Space by 50% and Vertical Node-Space by 75% for tighter, more readable layouts.

### v0.9.43 - Context-Aware Settings UI (2025-12-26)

- [x] **Dynamic Labels**: The "Repulsion Strength" label in the settings now dynamically changes between "Repulsion (Force)" and "Repulsion (DAG)" to clearly indicate which layout configuration is being modified.

### v0.9.42 - Distinct Repulsion Settings (2025-12-26)

- [x] **Mode-Specific Physics**: "Repulsion Strength" is now configured independently for "Force" and "DAG" modes.
- [x] **Smart Defaults**: Set default repulsion to **-550** for Force layout (clusters) and **-850** for DAG layout (hierarchy) to optimize initial visual separation.
- [x] **Context-Aware Settings**: The Settings Modal automatically shows the repulsion value for the current layout.

### v0.9.41 - Settings Modal Simulation Freeze (2025-12-26)

- [x] **Resource Saving**: The simulation now automatically pauses when the "Visualization Settings" modal is opened, reducing CPU usage during configuration. It resumes upon closing unless "Freeze Layout" is globally enabled.

### v0.9.40 - Freeze Layout Priority Fix (Settings Modal) (2025-12-26)

- [x] **Settings Isolation**: Adjusting parameters in the "Visualization Settings" modal (e.g., Repulsion, Opacity) no longer triggers a simulation restart if the layout is frozen. Visual changes apply immediately, while physics updates await unfreezing.

### v0.9.39 - Layout Switch Relaxation & Freeze Logic (2025-12-26)

- [x] **Consistent Transition**: Switching layouts now triggers the same "Rapid Relaxation" (0.2 damping for 2s) as the initial load, ensuring nodes arrange themselves quickly.
- [x] **Smart Freeze**: If "Freeze Layout" is active during a switch, the simulation runs for the 2-second relaxation period to establish the new structure before automatically freezing.

### v0.9.38 - Quick Start Guide HTML Rendering Fix (2025-12-26)

- [x] **Rich Text Support**: Fixed an issue where HTML tags (e.g., bold text, line breaks) in the localized UI were displayed as raw text. The system now correctly renders HTML formatting in translations.

### v0.9.37 - Rapid Relaxation Strategy (2025-12-26)

- [x] **Smart Damping**: The simulation now starts with low friction (0.2) for 2 seconds to allow rapid untangling of nodes ("relaxation"), then automatically increases to high friction (0.95) for stability.

### v0.9.36 - Freeze Layout Priority Fix (2025-12-26)

- [x] **Strict Freeze**: If "Freeze Layout" is active, changing "Degree Basis" or "Size By" settings no longer wakes up the simulation. Visuals update (node sizes change) while positions remain strictly locked.

### v0.9.35 - Viewport Culling Relaxation (2025-12-26)

- [x] **Smoother Culling**: Increased the off-screen "active" buffer to 800px (visual), preventing nodes near the edge from freezing abruptly during panning.
- [x] **Extended Zoom**: Lowered the global simulation freeze threshold from 0.4x to 0.1x, allowing physics to continue running even when significantly zoomed out.

### v0.9.34 - Global Layout Update Fix (2025-12-26)

- [x] **Layout Transition Logic**: Implemented a global unfreeze mechanism during layout switching.
- [x] **Override Culling**: Switching layouts (e.g., Force to DAG) now forcefully clears viewport culling locks (`isCulled`, `fx`, `fy`), ensuring all nodes, including off-screen ones, correctly participate in the new layout arrangement.

### v0.9.33 - Layout State Caching (Instant Switch) (2025-12-26)

- [x] **Template States**: Implemented independent state caching for "Force" and "DAG" layouts.
- [x] **Instant Switch**: Switching layouts now saves the current state and restores the target state instantly without recalculation or visual movement, preserving the exact arrangement of each view.

### v0.9.32 - High Damping & Render Optimization (2025-12-26)

- [x] **Damping**: Increased default friction to 0.92 for faster settling.
- [x] **Render Culling**: DOM updates are skipped for off-screen frozen nodes.

### v0.9.31 - Simulation Optimization (Viewport Culling) (2025-12-26)

- [x] **Performance**: Implemented smart viewport culling to reduce simulation load.
- [x] **Full View Freeze**: Automatically freezes the simulation when zoomed out (< 0.4x) to view the entire graph.
- [x] **Off-screen Freezing**: When zoomed in, only nodes within the visible viewport (plus a buffer) are simulated; off-screen nodes are frozen.

### v0.9.30 - Focus Mode Layout Isolation (2025-12-26)

- [x] **Position Consistency**: Implemented coordinate backup/restore logic (`x`, `y`, `fx`, `fy`) for Focus Mode.
- [x] **Behavior**: Exiting Focus Mode now reverts the graph layout to its _exact_ state prior to entry, discarding any temporary arrangements or drags made during the focused session.
- [x] **UX**: Fulfills the requirement that Focus Mode should have zero impact on the main interface's layout structure.

### v0.9.29 - Freeze Layout Persistence (2025-12-26)

- [x] **Bug Fix**: Resolved an issue where opening the Analysis Panel or resizing the window would override the "Freeze Layout" state, causing unwanted node movement.
- [x] **Robustness**: The physics simulation now strictly respects the frozen state during layout changes, ensuring nodes remain stationary as expected.

### v0.9.27 - Freeze Layout Priority Fix (2025-12-26)

- [x] **Logic Correction**: Resolved a conflict where "Exit Focus Mode" would unconditionally restart the physics simulation, overriding the "Freeze Layout" state.
- [x] **Priority Enforcement**: If "Freeze Layout" is checked, exiting Focus Mode now stops the simulation and forces a static render update, ensuring nodes remain strictly inactive as requested.

### v0.9.26 - UX Enhancements & Quick Start (2025-12-26)

- [x] **Freeze Layout Quick Button**: Added a dedicated freeze button (❄️) to the main interface for instant access, improving mobile usability.
  - [x] **Sync**: State is synchronized with the simulation panel checkbox.
  - [x] **Visuals**: Button turns red when frozen.
- [x] **Quick Start Manual**: Implemented a "Quick Start Guide" modal for new users.
  - [x] **Content**: Covers Loading, Navigation, Focus Mode, and Controls.
  - [x] **Onboarding**: Automatically shows on first visit (unless "Don't show again" is checked).
  - [x] **Access**: Accessible anytime via the new "Help" (❓) button.
- [x] **Localization**: Fully localized new UI elements in English and Chinese.

### v0.9.25 - Freeze Layout Optimization (2025-12-25)

- [x] **Resource Optimization**: In the main interface (SVG Mode), enabling "Freeze Layout" now completely disables node dragging in addition to stopping the simulation.
- [x] **Logic**: Prevents the physics simulation from restarting (waking up) due to drag events, ensuring maximum CPU/Memory savings.
- [x] **Focus Mode Preservation**: Dragging and manual positioning capabilities remain fully active in Focus Mode, unaffected by the global freeze setting.

### v0.9.24 - Focus Mode Memory Optimization (2025-12-25)

- [x] **Simulation Optimization**: Restricted physics simulation during Focus Mode to only active nodes (focus center + neighbors).
- [x] **Resource Saving**: Background nodes are frozen (removed from simulation loop), significantly reducing CPU/Memory usage while maintaining their exact visual state.
- [x] **Seamless Restoration**: Background nodes are instantly restored to their original positions upon exiting Focus Mode.

### v0.9.23 - Default Settings Adjustment (2025-12-25)

- [x] **Reading Window**: Set default font size (zoom level) to minimum (0.5x) for compact reading.
- [x] **Simulation Physics**: Increased default Damping (velocityDecay) from 0.4 to 0.6 for more stable graph movement.

### v0.9.22 - Mobile Popup Adaptation (2025-12-25)

- [x] **Touch Interaction**: Added support for dragging the statistics popup on mobile devices by holding the title bar.
- [x] **Pinch-to-Zoom**: Implemented two-finger pinch gesture to resize/scale the popup content on touch screens.
- [x] **UX Polish**: Prevented page scrolling during popup interactions for a smoother experience.

### v0.9.21 - Strict Edge Visibility & Optimization (2025-12-25)

- [x] **Strict Edge Visibility**: Enforced rule where edges are completely hidden (opacity 0) by default in SVG mode, matching Canvas mode behavior.
- [x] **Performance Optimization**: Reduced rendering overhead by ensuring relationship lines are calculated and drawn _only_ during interaction (Hover/Click/Focus), complying with strict visibility requirements.

### v0.9.20 - Selection State Auto-Clear on Focus Entry (2025-12-24)

- [x] **Clean Focus Transition**: When double-clicking a node to enter Focus Mode, any existing selection or highlight state is now automatically cleared, providing a clean and uncluttered focused view.
- [x] **Auto-Hide Popup**: The statistics popup is automatically hidden when entering Focus Mode, preventing visual conflicts.
- [x] **Enhanced UX**: Ensures users always start with a pristine focused context without residual artifacts from previous node selections.

### v0.9.19 - Focus Mode & Popup Enhancements (2025-12-24)

- [x] **Focus Mode Re-entry**: Fixed issue where double-clicking a related node while in focus mode wouldn't refresh properly. Now seamlessly switches focus between connected nodes.
- [x] **Draggable Popup**: Node statistics popup can now be dragged by its header to any screen position for better workspace organization.
- [x] **Zoomable Popup**: Added zoom controls (+/−/⟲) to scale popup content from 0.5x to 2.0x for improved readability.
- [x] **Resizable Popup**: Enabled browser-native resize handle for manual popup size adjustment.
- [x] **State Management**: Improved node visibility flag reset to prevent accumulation issues when switching focus contexts.

### v0.9.18 - Node Highlighting Refactor (2025-12-24)

- [x] **Modular Architecture**: Created dedicated `NodeHighlightManager` class for clean separation of highlighting logic.
- [x] **Unified Interface**: Single API for both PC (hover) and mobile (click) interactions.
- [x] **State Management**: Proper tracking of highlight/frozen states with focus mode awareness.
- [x] **Enhanced Rendering**: Consistent visual behavior across SVG and Canvas modes.
- [x] **Bilingual Documentation**: Comprehensive Chinese/English comments throughout the codebase.
- [x] **Robust Integration**: Full compatibility with existing focus mode, analysis panel, and statistics popup features.

### v0.9.17 - SVG Visual Completeness

- [x] **Colored Arrows**: SVG edges now use Red and Blue arrowheads when highlighted, ensuring the entire connection is color-coded.

### v0.9.16 - Interaction Completeness

- [x] **Full Context**: Clicking or hovering a node now reveals **all** connections (In & Out) regardless of the active filter mode.
- [x] **Canvas Polish**: Added bold styling for highlighted edges in the Canvas renderer.

### v0.9.14 - Visual & Data Fixes

- [x] **Edge Highlighting**: Fixed an issue where edge colors (Red/Blue) and bold styling were not applying correctly in SVG mode.
- [x] **Data Deduplication**: Ensured neighbor lists in the Statistics Popup do not contain duplicate entries.

### v0.9.13 - Focus Mode Isolation

- [x] **Interaction Constraint**: Ensured that the floating statistics popup and associated highlighting are strictly disabled when Focus Mode is active, preventing context conflict.

### v0.9.12 - Independent Statistics Popup

- [x] **Node Statistics**: Implemented a separate floating window for node details (In/Out Degree) to decouple it from the main Degree Analysis panel.
- [x] **Visualization**: In-degree and Out-degree relationships are clearly distinguished with Red/Blue indicators in the popup.

### v0.9.10 - Interaction Refinement (Click-to-Freeze)

- [x] **Inspection**: Clicking a node now freezes the entire simulation for stable inspection of connections.
- [x] **Resume**: Clicking the background resumes the simulation (if not manually frozen).

### v0.9.9 - Mobile Analysis Panel Polish

- [x] **Mobile Adaptation**: Implemented slide gestures (up/down) to resize the analysis panel, full-screen drag snap, and drag handle.
- [x] **Interaction**: Verified node click sync between analysis panel and graph.

### v0.9.8 - Analysis Interaction Refinement

- [x] **Graph Sync**: Clicking table rows now highlights nodes in the graph.
- [x] **Mobile UX**: Fixed mobile scrolling in Analysis Panel.

### v0.9.7 - Focus Mode Interaction Fix

- [x] **Focus Mode**: Fixed a bug where changing the layout type did not trigger an immediate refresh.

### v0.9.6 - Analysis & Visuals Polish

- [x] **Analysis Panel**: Added "Full Screen" toggle and "Pinch-to-Zoom" for better mobile readability.
- [x] **Visuals**: Fixed Mermaid Zoom text styling; Added background click to clear highlights.

### v0.9.5 - Refined Mobile Experience & Focus Semantics

- [x] **Focus Mode**: Added "Hierarchical (Left-Right)" layout and semantic labels ("Helping to understand" / "Further exploration").
- [x] **Analysis Panel**: Optimized for mobile (scrollable) and added click-to-highlight interaction with the main graph.
- [x] **Visuals**: Enhanced Mermaid diagram text visibility for light backgrounds; Fixed Focus Mode centering.

### v0.9.2 - Mobile UI Optimization

- [x] **Responsive Controls**: Main panel collapses on mobile; Focus UI moved to bottom.
- [x] **Touch Zoom**: Added pinch-to-zoom support in the Reading Window.

### v0.9.0 - Precise Control & Stability (2025-12-23)

- [x] **Hover Lock**: Hovering over a node locks its position to prevent inspection drift.
- [x] **Simulation Controls**: Added **Freeze Layout** checkbox and **Speed/Damping** slider.

### v0.8.9 - Stability Improvements

- [x] **Freeze on Select**: Nodes in Focus Mode retain their position after interaction.

### v0.8.8 - Scalability Defaults

- [x] **Clutter Reduction**: Edges and orphans hidden by default.
- [x] **Horizontal Spacing**: New slider for horizontal node separation in Focus Mode.

### v0.8.7 - Rendering Engine

- [x] **Canvas Renderer**: Added HTML5 Canvas support for high performance.
- [x] **Worker Scaling**: Increased thread limit to 12.

---
---
