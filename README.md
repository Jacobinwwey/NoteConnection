# 2026-04-07 v1.7.0

# NoteConnection Knowledge Graph

<img width="606" height="309" alt="banner" src="https://github.com/user-attachments/assets/92e90de5-2b1a-4398-8e8b-6e142c92b6a2" />

<div align="center">

### Legacy Navigation Row (from shared bilingual table)
| **English** | [Key Features](#key-features-en) | [Hardware](#hardware-en) | [Architecture](#architecture-en) | [Quick Start](#quick-start-en) | [CLI](#cli-en) | [Changelog](#changelog-en) |
| :---------: | :------------------------------: | :----------------------: | :------------------------------: | :----------------------------: | :------------: | :------------------------: |
|  **中文**   |   [核心特性](#key-features-zh)   | [硬件配置](#hardware-zh) |   [系统架构](#architecture-zh)   |  [快速开始](#quick-start-zh)   | [CLI](#cli-zh) | [更新日志](#changelog-zh)  |

</div>

# NoteConnection: Hierarchical Knowledge Graph Visualization System

> **Unlock the Structure of Your Knowledge.**

[![npm version](https://badge.fury.io/js/noteconnection.svg)](https://badge.fury.io/js/noteconnection)

**NoteConnection** is a high-performance, standalone visualization system engineered to transform unstructured Markdown knowledge bases into **Directed Acyclic Graphs (DAGs)**.

Unlike traditional "network" views that show a messy web of links, NoteConnection reveals the **hierarchy**, **learning paths**, and **dependency structures** hidden within your notes. It is built for scalability, capable of handling tens of thousands of nodes with ease, and operates completely independently of any specific note-taking app.

<img width="2010" height="2011" alt="image" src="https://github.com/user-attachments/assets/fa55676d-f58d-414e-943c-7a10567f88a5" />

---

## Current Mainline Architecture Status (2026-06-17)

### English

- The current DAG clarification is now explicit: "graph structure" means this project's existing DAG-shaped `KnowledgeAtom` / `RelationEdge` / `TemporalEdge` substrate, not a generic graph database integration target.
- The 2026-06-17 agent-knowledge slice now includes a first-class graph-conditioned context assembly step: `src/learning/graphContextAssembler.ts` selects the anchor, reorders support nodes, attaches explicit store-backed `connectionPaths`, builds bounded predecessor/successor windows, records evidence refs/diagnostics, and still preserves legacy `assistantMessage` compatibility.
- Persistence is guarded for this slice: before auto-saving a rebuilt learning snapshot, `KnowledgeLearningPlatform` merges still-valid store-side relation/temporal edges into the new snapshot so read-side query/conversation flows do not erase externally enriched DAG edges before path enrichment can inspect them.
- The next architecture move is no longer extracting the assembler itself; it is expanding graph-aware ranking features beyond relation-degree bonuses, hardening right-pane diagnostics, and adding graph-specific quality gates on top of the new bounded context pack.
- The public answer contract is now enforced in the current composer path: `answer` / `directAnswer` stays to the targeted response, while citations, connection paths, temporal details, durable artifacts, and developer traces belong in the evidence pane or export payload unless the user explicitly asks to inspect them.
- The prior DSPy / Guidance / Semantic Kernel / LangChain Core / LiteLLM review is retained as design input only. The main runtime should stay TypeScript-native and use local graph store operations instead of importing Python prompt frameworks into the Tauri/Node path.
- Current code-vs-plan details are tracked in [Agent Knowledge DAG Answer Contract Plan (2026-06-17)](docs/solutions/agent-knowledge-dag-answer-contract-plan-2026-06-17.md), [Knowledge Workspace and DAG Alignment Plan (2026-06-10)](docs/solutions/knowledge-workspace-dag-alignment-2026-06-10.md), and the [Development Progress Dashboard](docs/diataxis/en/explanation/development-progress-dashboard.md).

### 中文

- 当前已明确：这里的“图结构”指本项目现有 DAG 形态的 `KnowledgeAtom` / `RelationEdge` / `TemporalEdge` 底座，不是泛化的图数据库接入目标。
- 2026-06-17 agent knowledge 切片现在已经包含一等 graph-conditioned context assembly 步骤：`src/learning/graphContextAssembler.ts` 会在回答合成前选择 anchor、重排 support node、挂接 store 支撑的显式 `connectionPaths`、构建有界 predecessor/successor window，并记录 evidence ref / diagnostics，同时保持 legacy `assistantMessage` 兼容。
- 当前切片也补了持久化保护：`KnowledgeLearningPlatform` 在自动保存重建后的 learning snapshot 前，会把仍然有效的 store 侧 relation/temporal edges 合并回新快照，避免 read-side query/conversation 流程在路径增强读取前抹掉外部增强的 DAG 边。
- 下一步正确的架构动作已经不再是“把 assembler 抽出来”，而是基于新的 bounded context pack 继续扩展 graph-aware ranking feature、右侧原文诊断以及图专项质量门禁。
- 公开回答契约已在当前 composer 路径中强制收缩：`answer` / `directAnswer` 只保留 targeted response；citation、connection path、temporal detail、durable artifact 与 developer trace 默认进入 evidence pane 或 export payload，除非用户显式要求查看。
- 先前对 DSPy / Guidance / Semantic Kernel / LangChain Core / LiteLLM 的研究继续作为设计输入，不作为运行时依赖引入。主运行时应保持 TypeScript-native，并优先使用本地图 store operations。
- 当前代码 / 方案对齐详情见 [Agent Knowledge DAG Answer Contract Plan (2026-06-17)](docs/solutions/agent-knowledge-dag-answer-contract-plan-2026-06-17.md)、[Knowledge Workspace and DAG Alignment Plan (2026-06-10)](docs/solutions/knowledge-workspace-dag-alignment-2026-06-10.md) 与 [Development Progress Dashboard](docs/diataxis/en/explanation/development-progress-dashboard.md)。

---

## Current Mainline Architecture Status (2026-06-10)

- The current `main` branch has code-backed scoped retrieval, grounded conversation, durable resource/index/workspace/session/memory/export substrate, explicit export profiles, and PNG-first Godot/mobile render materialization.
- The Knowledge Workspace now includes an in-pane scope switcher, a compact `/api/knowledge/conversation` status strip, grouped file-first knowledge hits, source-markdown rendering with matched-span highlighting in the focus pane, and durable workflow artifacts for `flashcard_batch` and `knowledge_run`.
- Agent conversation runtime is no longer limited to one flat string: `answer`, `assistantBlocks`, `knowledgeRun`, grouped knowledge points, citations, memory actions, and trace are all present while legacy `assistantMessage` remains valid.
- The current DAG-backed learning substrate is real: `KnowledgeAtom`, `RelationEdge`, `TemporalEdge`, path queries, mastery-path/session logic, and `KnowledgeQueryItem.relationPath` already exist. The remaining gap is not “having a graph,” but letting answer planning consume it through a dedicated graph-conditioned context layer.
- graphdb/sqlite and ANN/external connector paths remain operational baselines, not production-closed claims. Release closure still depends on repeated soak evidence, workload thresholds, recall/latency calibration, strict rollout proof, and multi-host evidence.
- `npm run verify:foundation:release-evidence` audits the latest sqlite soak and ANN release-gate reports for freshness and passing gates before host evidence is used as release context; `npm run verify:foundation:release-evidence:strict` requires repeated fresh valid history and is exposed in foundation readiness as `foundation_release_evidence_history`; `npm run verify:foundation:release-evidence:multi-host` is available for release windows that require host diversity.
- The current architecture pressure remains ownership reduction: `src/server.ts`, `src/learning/KnowledgeLearningPlatform.ts`, `src/frontend/agent_workspace.js`, and `src/frontend/workspace_panes.js` remain the main simplification targets.
- Current code-vs-plan details are tracked in [Knowledge Workspace and DAG Alignment Plan (2026-06-10)](docs/solutions/knowledge-workspace-dag-alignment-2026-06-10.md), [Architecture Progress Alignment and Mainline Plan (2026-06-06)](docs/solutions/architecture-progress-alignment-2026-06-06.md), and the [Development Progress Dashboard](docs/diataxis/en/explanation/development-progress-dashboard.md).

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

### Desktop System Dependencies

| Platform | Required Dependencies |
|---|---|
| **Linux** | `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libsoup3.0`, `libjavascriptcoregtk-4.1-0` (Ubuntu/Debian: `sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libsoup-3.0-dev patchelf`) |
| **macOS** | No additional dependencies (system WebKit included) |
| **Windows** | [Edge WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) (pre-installed on Windows 11; Windows 10 may need manual install) |

> **Linux Wayland users**: Godot Path Mode requires `GDK_BACKEND=x11` on pure Wayland compositors. The launcher sets this automatically when `XDG_SESSION_TYPE=wayland` is detected.

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

NoteConnection supports Android via **Tauri Android** (native shell pipeline). The Capacitor APK path is **deprecated** and retained for historical reference only.

#### Prerequisites

- **Node.js** (LTS)
- **Java JDK** (21 or higher)
- **Android SDK** (Configured in `ANDROID_HOME` or via Android Studio)

#### Recommended: Tauri Android Build (Native Shell)

```bash
# First-time setup
npm run tauri:android:init

# Development build
npm run tauri:android:dev

# Release APK/AAB
npm run tauri:android:build
```

For universal APK (armeabi-v7a + arm64-v8a + x86_64):

```bash
npm run tauri:android:build:universal
```

#### Deprecated: Capacitor Build

The Capacitor APK path (`build_apk.bat`, `npm run mobile:build:capacitor`) is deprecated as of 2026-05. The `android/` Capacitor project directory is retained for historical reference. All active Android development targets the Tauri Android pipeline.
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
- **Reader Protocol Tuning**: Edit `[frontend_settings.reading]` to control markdown rendering runtime (`markdown_engine`, `chunk_block_size`, `prefetch_blocks`, `index_cache_ttl_sec`, `max_doc_bytes`).
- **Detailed Config Guide**: See [`docs/en/app_config.toml_guide.md`](docs/en/app_config.toml_guide.md) and template [`docs/examples/app_config.template.toml`](docs/examples/app_config.template.toml).

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

### Markdown Reader Protocol (v1.6.8)

- **Dual-engine gray release**:
  - `markdown_engine = "auto"`: prefer `pulldown-cmark`, fallback to legacy on failure.
  - `markdown_engine = "pulldown"`: keep automatic fallback to legacy to avoid blank readers.
  - `markdown_engine = "legacy"`: force original parser path.
- **Unified cross-window behavior**: Tauri reader and Godot reader now both consume the same sidecar markdown protocol (`index/chunk/resolve-node/resolve-wiki`).
- **Large file stability**: reader no longer requires single-shot full markdown payloads and supports block-based incremental loading.
- **Mermaid reliability hardening**:
  - Godot reader Mermaid rendering now uses `renderer = "auto"` so it can prefer frontend bridge and automatically fallback to local `resvg` when bridge render is unavailable.
  - Mermaid fences must start on a new line; inline `$$```mermaid` patterns can break block classification.
  - Use `npm run verify:markdown:mermaid:fence -- Knowledge_Base/testconcept` to catch malformed inline Mermaid fences before release.
- **Local MCP web-debug baseline (Runbrowser)**:
  - Build locally from source: `pnpm --filter @jiweiyuan/runbrowser-server build`, `pnpm --filter @jiweiyuan/runbrowser-core build`, `pnpm --filter @jiweiyuan/runbrowser-mcp build`.
  - Run local MCP entrypoint: `node E:\Knowledge_project\tools\runbrowser\packages\mcp\bin.js`.

## 🏗️ Build & Deployment

For developers building from source, NoteConnection now defaults to the runtime-first path:

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
- **GPU Dev Start (`npm run tauri:dev:mini:gpu`)**: Recommended GPU-enabled Tauri development command.
- **Do not use** `npm run tauri:dev:mini --gpu` because npm treats `--gpu` as config and prints warnings.

## 📚 Documentation Architecture (Diataxis + MkDocs)

- Canonical long-form docs remain under `docs/en/*` and `docs/zh/*`.
- Diataxis navigation pages are maintained under `docs/diataxis/<lang>/*`.
- Mapping governance is versioned in `docs/diataxis-map.json`.
- Run mapping validation: `npm run docs:diataxis:check`.
- Run local docs site preview: `npm run docs:site:serve`.
- Build static docs site: `npm run docs:site:build`.
- GitHub Pages Docs Portal (project site): `https://jacobinwwey.github.io/NoteConnection/`.
- Host root (for routing baseline): `https://jacobinwwey.github.io/`.
- Recommended lookup entry points:
  - Users: `/diataxis/zh/tutorials/first-run/` or `/diataxis/en/tutorials/first-run/`
  - Developers: `/diataxis/en/reference/interfaces-and-runtime/` and `/diataxis/en/reference/release-and-governance/`
  - Maintainers assessing LFS / desktop bootstrap risk: `/en/sidecar_supply_strategy/` or `/zh/sidecar_supply_strategy/`
  - Maintainers comparing mirror cost / user friction / maintenance burden: `/diataxis/en/explanation/sidecar-supply-feasibility/` or `/diataxis/zh/explanation/sidecar-supply-feasibility/`
- CI auto publish workflow (GitHub Pages): `.github/workflows/docs-github-pages-publish.yml`.
- Manual rollback entry: run workflow dispatch and set `git_ref` to a stable tag/commit.
- MkDocs base/path can be overridden by environment variables: `MKDOCS_SITE_URL`, `MKDOCS_BASE_PATH`.
- CI policy gate for docs mapping and site build: `.github/workflows/docs-diataxis-site.yml`.
- Docs release + rollback runbook:
  - English: [`docs/en/docs_release_and_rollback.md`](docs/en/docs_release_and_rollback.md)
  - 中文: [`docs/zh/docs_release_and_rollback.md`](docs/zh/docs_release_and_rollback.md)

## 🛠️ Hardware & Driver Requirements (AMDGPU)

For optimal performance with "GPU Optimised Rendering", especially on AMD RDNA cards (like RX 7900XT):

1.  **Drivers**: Ensure you have the latest **AMD Adrenalin Edition** drivers installed.
2.  **Node.js**: The project uses `gpu.js` which relies on `headless-gl` for Node.js context.
    - On Windows, this usually works out of the box with standard build tools (`windows-build-tools`).
    - If you encounter `gl` errors, ensure Python and C++ compilers are available.

<a id="changelog-en"></a>

## 📅 Changelog

### v1.7.0 - Startup Acceleration Closure, Multi-Platform Validation, and Learning Roadmap Foundation (2026-03-31)
- **Tag Compare Snapshot (`v1.6.0..v1.7.0`)**:
  - `47` commits, `160` files changed, `+20,224 / -1,444` churn.
  - Engineering footprint concentrated in: `src/frontend/`, `scripts/`, `docs/`, `src-tauri/`, `package*.json`.
- **Startup Runtime Optimization Closure (Phase 2/3/4 + v1.1 Hardening)**:
  - Added startup delta tick transport (`tickMode: full|delta`) with low-alpha adaptive controls (`lowAlphaDeltaEpsilonMultiplier`, `lowAlphaFullSyncEveryTicks`).
  - Added frame-coalesced startup tick application on main thread to reduce redundant repaint pressure near stable phase.
  - Hardened warm-start recovery with strict snapshot validation (fingerprint, age, node/edge consistency, position coverage threshold).
  - Expanded startup telemetry at `T5 stable_layout` with `tickSummary` (`fullTicks`, `deltaTicks`, `deltaRatio`, payload and frame metrics).
- **Cross-Platform Startup Validation Toolchain**:
  - Added/extended compare + matrix + watch + simulate + cohorts + signoff automation scripts for startup KPI governance.
  - Introduced no-hardware engineering signoff flow (Windows real logs + simulated cohorts) while preserving release-grade requirement for real multi-device cohorts.
- **Runtime Contract and Documentation Alignment**:
  - Synced Diataxis EN/ZH runtime references with the new startup profile fields and telemetry semantics.
  - Extended startup acceleration plan docs with v1.1 optimization and risk-guardrail closure details.
  - Added bilingual knowledge-mastery evolution roadmap docs and integrated them into Diataxis navigation and mapping.
- **Version Metadata Alignment**:
  - Unified release metadata to `1.7.0` in `package.json`, `package-lock.json`, and `src-tauri/tauri.conf.json`.

### v1.6.7 - Docs Governance Cleanup & GitHub Pages Stabilization (2026-03-29)
- Removed unrelated external community UI documentation references from the repository documentation system.
- Replaced legacy external runbooks with project-owned docs operations runbooks:
  - `docs/en/docs_release_and_rollback.md`
  - `docs/zh/docs_release_and_rollback.md`
- Updated Diataxis governance mapping and cross-links to use the new canonical runbook paths.
- Added GitHub Pages preflight verification in docs publish workflow to surface clear warnings when Pages is not enabled.
- Resolved docs portal 404 condition by enabling repository Pages with `gh-pages` branch as publish source.
- Prepared formal release metadata and version alignment to `1.6.7` (npm + Tauri).

### v1.6.6 - Unified Provider Runtime & TOML Settings Consolidation (2026-03-26)
- Upgraded NoteMD API calling flow to a definition-driven provider architecture inspired by recent obsidian-NotEMD and cline patterns.
- Added transport-based dispatch (openai-compatible, anthropic, google, azure-openai, ollama) and provider metadata (apiKeyMode, apiTestMode, category).
- Expanded built-in provider presets: Qwen, Doubao, Moonshot, GLM, MiniMax, Groq, Together, Fireworks, Requesty, OpenAI Compatible.
- Unified runtime settings persistence in app_config.toml across Tauri + Godot + NoteMD:
  - full NoteMD settings in [notemd] + [[notemd.providers]] (with legacy [notemd.api] compatibility mirror)
  - Godot Path Mode settings in [path_mode] with runtime API endpoint /api/path-mode/settings
  - Godot settings panel migrated to runtime TOML sync path.
- Hardened Rust-side TOML writes to preserve unknown sections, preventing accidental loss of [notemd] / [path_mode] when Tauri updates KB path or language.
- Updated bilingual documentation and templates for v1.6.6 schema and operations.
### v1.6.5 - Documentation Portal Update (2026-03-26)

- Published MkDocs documentation to GitHub Pages project site.
- Added bilingual README guidance for docs lookup paths (user/tutorial and developer/reference entry points).
- Standardized docs publish flow for maintainers:
  - `npm run docs:site:build`
  - `.github/workflows/docs-github-pages-publish.yml` (`workflow_dispatch` supports `git_ref` rollback)
### v1.6.0 - Unified Runtime, NoteMD Integration & Release Hardening (2026-03-23)

- **Tag Compare Snapshot (`v1.3.0..v1.6.0`)**:
  - `107` commits, `301` files changed, `+125,957 / -10,083` churn.
  - File-level status: `241` added, `56` modified, `3` deleted, `1` renamed.
  - Largest engineering footprint: `src/`, `docs/`, `scripts/`, `path_mode/`, `src-tauri/`.

- **Single-Window Runtime Orchestration**:
  - Implemented Tauri <-> Godot visibility handoff so only one primary window is shown at a time.
  - Added Godot close-confirm flow ("Return to main interface" vs "Close all windows") to prevent accidental full shutdown.
  - Stabilized Godot window visibility control and removed deprecated foreground APIs.
- **NoteMD Embedded Experience**:
  - Kept NoteMD as an embedded experience (not a standalone desktop window) aligned with both Tauri and Godot flows.
  - Fixed non-responsive `Browse` actions in Tauri NoteMD (file/folder/save pickers now complete the IPC flow).
  - Defaulted embedded NoteMD to a single `One-Click Extract` workflow that chains concept extraction, batch generation from titles, and batch Mermaid repair into a source-file-named KB folder.
  - Moved embedded NoteMD API configuration into `app_config.toml` under `[notemd]` and `[notemd.api]`, with matching fields in the embedded NoteMD window.
  - Added `noteconnection notemd ...` CLI entrypoints for shared NoteMD actions.
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

### v1.5.58 - Godot Path UI Enhancements (2026-03-19)
- **Visuals**: Added Vertical/Horizontal main spine layout toggle and premium aesthetic color schemes (Nord, Tokyo Night, etc).
- **Interactions**: Upgraded hover info box with deep node interactivity (Left/Double/Right click).

### v1.5.x Migration Runtime Logs (Canonical Archive)
- Full bilingual logs are centrally archived in [`export.md`](export.md).
- This README keeps summary pointers in the changelog for readability.
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


## 中文文档


# 2026-04-07 v1.7.0
# NoteConnection: 层级知识图谱可视化系统

<img width="606" height="309" alt="banner" src="https://github.com/user-attachments/assets/92e90de5-2b1a-4398-8e8b-6e142c92b6a2" />

---

---
> **解锁你知识库的深层结构。**

**NoteConnection** 是一个高性能的独立可视化系统，旨在将非结构化的 Markdown 知识库转化为**有向无环图 (DAG)**。

与展示杂乱链接网的传统“网络”视图不同，NoteConnection 揭示了隐藏在笔记中的**层级关系**、**学习路径**和**依赖结构**。它专为可扩展性而设计，能够轻松处理数万个节点，并且完全独立于任何特定的笔记应用程序运行。

<img width="2784" height="2034" alt="image" src="https://github.com/user-attachments/assets/0ea42609-4296-42ea-978d-c6cb7d448068" />
<img width="3543" height="2159" alt="image" src="https://github.com/user-attachments/assets/0b2d80f5-ec8c-4ac1-9607-b925d4ab5f82" />

---

## 当前主线架构状态（2026-06-10）

- 当前 `main` 已具备代码支撑的 scoped retrieval、grounded conversation、持久化 resource/index/workspace/session/memory/export 底座、显式 export profiles，以及 Godot/mobile PNG-first 渲染物化边界。
- 知识工作区除了工作区内 scope 切换器、conversation API 状态条、按文件优先的 grouped knowledge hit 与 focus pane 中的 matched-span 高亮之外，还已经具备 durable workflow artifact：`flashcard_batch` 与 `knowledge_run`。
- agent conversation 运行时已经不再只是单一回答字符串：`answer`、`assistantBlocks`、`knowledgeRun`、按文档聚合的 `knowledgePoints`、citations、memory actions 与 trace 已进入当前兼容性表面，同时保留 legacy `assistantMessage`。
- 现有 DAG 学习底座是真实存在的：`KnowledgeAtom`、`RelationEdge`、`TemporalEdge`、path query、mastery-path/session 逻辑以及 `KnowledgeQueryItem.relationPath` 都已落地。真正剩余的缺口不是“有没有图”，而是“回答规划层还没有 dedicated graph-conditioned context layer”。
- graphdb/sqlite 与 ANN/external connector 仍是 operational baseline。生产闭环仍需要多轮 soak 证据、工作负载阈值、recall/latency 校准、strict rollout proof 与多宿主证据。
- 当前 release-evidence 审计面已由 `verify:foundation:release-evidence`、`verify:foundation:release-evidence:strict` 与 `verify:foundation:release-evidence:multi-host` 统一。
- 下一阶段架构工作仍是缩减 `src/server.ts`、`src/learning/KnowledgeLearningPlatform.ts`、`src/frontend/agent_workspace.js` 与 `src/frontend/workspace_panes.js` 的所有权压力。
- 当前代码 / 方案详细对齐请查看 [知识工作区与 DAG 对齐推进方案（2026-06-10）](docs/solutions/knowledge-workspace-dag-alignment-2026-06-10.md)、[架构推进对齐与主线推进方案（2026-06-06）](docs/solutions/architecture-progress-alignment-2026-06-06.md) 与 [开发进度看板](docs/diataxis/zh/explanation/development-progress-dashboard.md)。

---

<a id="key-features-zh"></a>

## 🚀 核心特性

### 1. 可视化与布局

- **结构优于混沌**: 在 **力导向 (Force-Directed)** 和 **DAG (层级)** 布局之间切换。DAG 布局自动识别“先决条件”和“后续步骤”，将概念按逻辑分层排列。
- **双渲染引擎 (v0.8.7)**: 无缝切换 **SVG** (用于交互) 和 **Canvas** (用于 10,000+ 节点的高性能渲染)。
- **交互式专注模式**: 点击任意节点以隔离它及其上下文。包含 **选中冻结** (v0.8.9) 以防止漂移，可调节的 **垂直/水平间距** (v0.8.8)，以及退出后完美的视觉状态恢复 (v1.0.0)。
- **完全离线化支持 (v1.0.0)**: 所有关键库依赖（D3, KaTeX, Marked, Mermaid 等）均已本地化，确保 100% 离线可用性。

<img width="3404" height="2028" alt="image" src="https://github.com/user-attachments/assets/39ea71da-be14-4fdc-9fec-9f33cab92e1b" />

### 2. 智能与推断

- **混合推断引擎**: 结合 **统计概率** ($P(A|B)$) 和 **向量相似度** (TF-IDF) 推断隐藏的依赖关系（例如，“荧光”隐含“光子”），无需外部 AI API。
- **可扩展聚类**: 基于文件夹结构或标签，将数千个节点聚合为高级“概念气泡”，提供清晰的概览。

<img width="3723" height="2007" alt="image" src="https://github.com/user-attachments/assets/10978984-3e2d-4ab6-8b44-342d4f3c3800" />

### 3. Path Mode (路径模式): 结构化学习 (v1.2.0)

- **课程生成**: 将复杂的网状图瞬间转化为线性的学习路径。
  - **领域学习 (Domain Learning)**: 掌握整个概念集群（拓扑排序）。
  - **扩散学习 (Diffusion Learning)**: 寻找通往特定目标的最优路径（最短路径 + 前置依赖）。
- **混合架构**: 通过 WebSocket (`ws://localhost:9876`) 连接到高保真 **Godot 4.3 桌面渲染器**，实现 3A 级的可视化效果，同时保持完全的 Web 兼容性。
- **智能策略**: 支持 "基础优先" (Foundational) 或 "核心优先" (Core) 排序，适应不同的学习风格。

### 4. 性能与控制 (Performance & Control)

- **高容量并行处理**: 利用 Node.js `worker_threads` (最多 12 核) 分发计算密集的关键词匹配任务。
- **模拟控制 (v0.9.0)**: 通过 **速度/阻尼滑块** 微调物理效果，或使用 **冻结布局** 开关停止模拟以进行稳定的手动排列。
- **悬停锁定**: 悬停在节点上时暂时锁定其位置，以便稳定地检查连接。

<img width="2012" height="2024" alt="image" src="https://github.com/user-attachments/assets/bf6e7508-7e42-46cb-9a3e-b92be063ad3d" />

---

<a id="hardware-zh"></a>

## 💻 硬件与驱动要求 (Hardware & Driver Requirements)

### 支持的 AMDGPU 架构

NoteConnection 利用 `gpu.js` 进行基于 WebGL 的加速，并计划通过 ROCm 支持本地 AI 推断。

- **RDNA 3 (推荐)**: Radeon RX 7000 系列 (例如 **RX 7900 XT/XTX**)。
  - _状态_: WebGL 和计算性能最佳。
- **RDNA 2**: Radeon RX 6000 系列。
  - _状态_: 稳定且成熟的支持。

### 驱动配置

#### Windows (开发环境)

- **驱动程序**: **AMD Software: Adrenalin Edition** (23.12.1+)。
  - 需要 DirectX 12/Vulkan/OpenGL 支持以底层支持 WebGL。
- **构建工具**: 用于为 Node.js 编译 `headless-gl`：
  - 安装 Python 3.x 并加入 PATH。
  - Visual Studio Build Tools (C++ 工作负载)。

#### Linux (AI 推荐)

- **Mesa (RADV/Radeonsi)**: 默认开源驱动。最适合通用 WebGL 和 `gpu.js`。
- **ROCm (Radeon Open Compute)**: 仅在计划开发 AI 推断功能（未来路线图）时安装。NoteConnection 的核心可视化在标准 Mesa 驱动上运行良好。

---

<a id="architecture-zh"></a>

## 🏗️ 系统架构

NoteConnection 基于模块化架构构建，旨在实现高性能和可扩展性。

### 后端 (`src/backend`)

- **GraphBuilder**: 核心协调器。管理从文件读取到图构建的整个流程。
- **Worker Threads**: 繁重的任务（关键词匹配、文本分析）被卸载到工作线程池 (`src/backend/workers`)，确保主线程保持响应。
- **推断引擎**:
  - `StatisticalAnalyzer`: 计算共现矩阵。
  - `VectorSpace`: 处理 TF-IDF 嵌入和余弦相似度。
  - `HybridEngine`: 结合信号建议有向边。

### 前端 (`src/frontend`)

- **双引擎渲染器**:
  - **D3.js (SVG)**: 用于高保真、交互式图表，具有详细的工具提示和 CSS 样式。
  - **HTML5 Canvas**: 针对海量数据集进行了优化，消除了 DOM 操作的开销。
- **状态管理**: `SettingsManager` 将用户偏好（物理、视觉）持久化到 `localStorage`。
- **布局逻辑**: 自定义的 Sugiyama 风格分层算法和力导向物理算法。

### 桌面桥接 (Desktop Bridge) (`src/core`)

- **PathBridge**: 标准 WebSocket 服务器 (端口 9876)，将内部图谱状态暴露给外部应用程序（例如 Godot 引擎），实现混合 Web/原生可视化管线。

---

<a id="quick-start-zh"></a>

## 📦 快速开始

### 桌面系统依赖

| 平台 | 必要依赖 |
|---|---|
| **Linux** | `libwebkit2gtk-4.1-dev`、`libgtk-3-dev`、`libsoup3.0`、`libjavascriptcoregtk-4.1-0`（Ubuntu/Debian: `sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libsoup-3.0-dev patchelf`） |
| **macOS** | 无需额外依赖（系统内置 WebKit） |
| **Windows** | [Edge WebView2 运行时](https://developer.microsoft.com/microsoft-edge/webview2/)（Windows 11 预装；Windows 10 可能需要手动安装） |

> **Linux Wayland 用户**：Godot Path Mode 在纯 Wayland 合成器上需要 `GDK_BACKEND=x11`。启动器检测到 `XDG_SESSION_TYPE=wayland` 时会自动设置。

### 选项 1: Windows 安装程序 (推荐)

1. 从 [最新发布页面](https://github.com/Jacobinwwey/NoteConnection/releases) 下载 `NoteConnection.Setup.exe`。
2. 运行安装程序。
3. 从桌面或开始菜单启动 NoteConnection。

### 选项 2: 使用 npx 运行

无需安装。

```bash
npx noteconnection
```

### 选项 3: 全局安装

```bash
npm install -g noteconnection
noteconnection
```

### 选项 4: 本地开发

```bash
git clone https://github.com/Jacobinwwey/NoteConnection.git
cd NoteConnection
npm install
npm start
```

- 服务器运行于: `http://localhost:3000`

### 选项 5: 移动端支持 (Android)

NoteConnection 通过 **Tauri Android**（原生壳流水线）支持 Android。Capacitor APK 路径已**废弃**，仅保留作为历史参考。

#### 先决条件

- **Node.js** (LTS)
- **Java JDK** (21 或更高版本)
- **Android SDK** (配置在 `ANDROID_HOME` 或通过 Android Studio 安装)

#### 推荐: Tauri Android 构建（原生壳）

```bash
# 首次初始化
npm run tauri:android:init

# 开发构建
npm run tauri:android:dev

# 发布 APK/AAB
npm run tauri:android:build
```

构建通用 APK（armeabi-v7a + arm64-v8a + x86_64）：

```bash
npm run tauri:android:build:universal
```

#### 已废弃: Capacitor 构建

Capacitor APK 路径（`build_apk.bat`、`npm run mobile:build:capacitor`）已于 2026-05 废弃。`android/` 目录保留作为历史参考。所有活跃的 Android 开发均以 Tauri Android 流水线为目标。

#### 历史参考: Capacitor 手动构建步骤

1.  **构建 Web 资源**:
    ```bash
    npm run build
    ```
2.  **同步到 Android 平台**:
    ```bash
    npx cap sync
    ```
3.  **构建 APK**:
    在 Android Studio 中打开 `android` 目录并构建，或使用命令行:
    ```bash
    cd android
    ./gradlew assembleDebug
    ```
    APK 将位于: `android/app/build/outputs/apk/debug/app-debug.apk`

#### 移动端能力边界

- Capacitor 打包路径本身不内置桌面 Node sidecar，但在具备 Filesystem API 且数据量不超过移动端限制时，Capacitor 原生运行时仍可本地图谱构建。
- 如果需要与 Tauri 架构一致的移动端原生壳能力，请使用 Tauri Android 路径；该路径会通过 Android 原生命令 `build_graph_runtime` 构图。

---

<a id="cli-zh"></a>

## 🖥️ CLI 命令行使用 (v0.9.71)

您可以直接从命令行加载知识库并构建图谱，而无需使用 UI。这对于自动构建或无头环境非常有用。

### 使用方法

```bash
npm start -- --path "<知识库路径>" [选项]
```

### 选项

| 选项        | 描述                                      | 默认值                |
| ----------- | ----------------------------------------- | --------------------- |
| `--path`    | 包含 Markdown 文件的文件夹的绝对路径。    | `Knowledge_Base`      |
| `--gpu`     | 为布局和向量计算启用 AMDGPU/WebGL 加速。  | `true` (如果硬件支持) |
| `--no-gpu`  | 禁用 GPU 加速 (强制使用 CPU)。            | `false`               |
| `--static`  | 启用静态模式 (仅后端计算，前端布局冻结)。 | `false`               |
| `--workers` | 要使用的 Worker 线程数。                  | `numCPUs - 1`         |

### 示例

```bash
# 基础加载
npm start -- --path "C:/Users/MyName/Documents/MyNotes"

# GPU 加速构建
npm start -- --path "E:/Knowledge/ObsidianVault" --gpu

# 强制 CPU (如果 GPU 出现问题)
npm start -- --path "E:/Knowledge/ObsidianVault" --no-gpu
```

**注意:** CLI 运行会生成唯一的静态数据文件 (`data_cli_{kb_name}_{time}.js`) 以保护原始 `data.js`。服务器启动时，它会自动为前端提供这些特定的文件。

---

## 📂 用户定义知识库 (User-Defined Knowledge Base - v1.0.0)

管理知识库源现在变得更加简单。

- **首次运行设置**: 首次启动时，系统会提示您选择 `Knowledge_Base` 文件夹。
- **持久化配置 (`app_config.toml`)**: KB 路径、语言及多窗口偏好默认保存到 `%LOCALAPPDATA%/NoteConnection/app_config.toml`（Windows），重启后自动恢复。
- **旧配置自动迁移**: 若同目录存在旧版 `kb_config.json`，启动时会自动迁移到 `app_config.toml`。
- **随时更改**: 使用 **文件 > 更改知识库...** 菜单选项即时切换文件夹。
- **重置**: 使用 **文件 > 重置为默认** 返回由捆绑的演示笔记。
- **配置路径覆盖**: 可通过 `NOTE_CONNECTION_CONFIG_PATH`（完整文件路径）或 `NOTE_CONNECTION_CONFIG_DIR`（目录）自定义 `app_config.toml` 位置。
- **窗口行为可调**: 在 `app_config.toml` 的 `[multi_window]` 段调整 `single_window_mode`、`hide_tauri_when_pathmode_opens`、`restore_tauri_when_pathmode_exits`、`confirm_before_full_shutdown_from_godot`、`sync_language`。
- **阅读协议可调**: 在 `[frontend_settings.reading]` 中统一调节 Markdown 渲染链路（`markdown_engine`、`chunk_block_size`、`prefetch_blocks`、`index_cache_ttl_sec`、`max_doc_bytes`）。
- **详细配置说明**: 参见 [`docs/zh/app_config.toml_guide.md`](docs/zh/app_config.toml_guide.md) 与模板 [`docs/examples/app_config.template.toml`](docs/examples/app_config.template.toml)。

```toml
# 推荐最小 app_config.toml
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

### Markdown 阅读协议（v1.6.8）

- **双引擎灰度发布**：
  - `markdown_engine = "auto"`：优先 `pulldown-cmark`，失败自动回退 legacy。
  - `markdown_engine = "pulldown"`：仍保留自动回退 legacy，避免阅读器空白。
  - `markdown_engine = "legacy"`：强制使用旧解析链路。
- **双窗口统一行为**：Tauri 阅读器与 Godot 阅读器都统一消费 sidecar Markdown 协议（`index/chunk/resolve-node/resolve-wiki`）。
- **大文档稳定性提升**：阅读链路不再依赖单次整文全量载入，改为块级增量加载。
- **Mermaid 稳定性加固**：
  - Godot 阅读器 Mermaid 渲染已切换为 `renderer = "auto"`，优先走前端桥接渲染，桥接不可用时自动回退本地 `resvg`。
  - Mermaid fenced code 必须独占新行起始；`$$```mermaid` 这类行内拼接会导致分块识别失败。
  - 发布前可执行 `npm run verify:markdown:mermaid:fence -- Knowledge_Base/testconcept`，提前拦截异常 Mermaid fence。
- **本地 MCP 网页调试基线（Runbrowser）**：
  - 建议按源码本地构建：`pnpm --filter @jiweiyuan/runbrowser-server build`、`pnpm --filter @jiweiyuan/runbrowser-core build`、`pnpm --filter @jiweiyuan/runbrowser-mcp build`。
  - 本地 MCP 入口：`node E:\Knowledge_project\tools\runbrowser\packages\mcp\bin.js`。

## 🏗️ 构建与部署 (Build & Deployment)

对于从源码构建的开发者，NoteConnection 现在默认采用 runtime-first 路径：

- **Electron 桌面构建链路已于 2026-03-01 下线（弃用并完成清退）。**
- **Tauri 构建** (`npm run tauri:build`)：默认桌面打包路径，采用 runtime-first 资产流，不默认打入预生成图谱载荷。
- **Tauri 精简构建** (`npm run tauri:build:mini`)：与当前默认 runtime-first 打包路径保持兼容的旧别名。
- **Tauri 完整图谱构建** (`npm run tauri:build:full`)：仅在本地存在真实图谱文件时，显式选择把生成型图谱资产打入包中。
- **Build (`npm run build`)**：默认 runtime-first 前端构建。
- **完整图谱前端构建** (`npm run build:full`)：仅供本地 / demo 场景显式选择预生成图谱资产。
- **Godot Bootstrap** (`npm run prepare:godot:bin`)：可从本地覆盖路径 / 搜索目录 / 缓存 / 固定下载 URL 物化当前主机所需的 Godot sidecar。
- **桌面 Release Godot 镜像**：release CI 现在会先在项目 GitHub Releases 中维护 Godot 镜像 tag，并以“镜像优先、上游回退”方式下载。
- **LFS Policy Guard** (`npm run verify:lfs:policy`)：在迁移仍保留历史豁免项时，阻止新的 Git LFS 路径再次进入 `src/frontend/` 与 `src-tauri/bin/`。未来严格模式可通过 `npm run verify:lfs:policy:strict` 启用。
- **Sidecar 供给就绪度** (`npm run verify:sidecar:supply`)：在继续缩减桌面 sidecar 的 LFS 桥接之前，显式报告当前主机是否已具备离线 bootstrap 能力，还是仍依赖网络。
- **GPU 开发启动（推荐）** (`npm run tauri:dev:mini:gpu`)。
- **不要使用** `npm run tauri:dev:mini --gpu`，该写法会被 npm 当作配置参数并触发告警。

## 📚 文档架构（Diataxis + MkDocs）

- 权威长文档仍保持在 `docs/en/*` 与 `docs/zh/*`。
- Diataxis 导航页维护在 `docs/diataxis/<lang>/*`。
- 映射治理文件为 `docs/diataxis-map.json`。
- 映射一致性校验：`npm run docs:diataxis:check`。
- 本地预览文档站点：`npm run docs:site:serve`。
- 构建静态文档站点：`npm run docs:site:build`。
- GitHub Pages 文档入口（project site）：`https://jacobinwwey.github.io/NoteConnection/`。
- 根域名（路由基线）：`https://jacobinwwey.github.io/`。
- 推荐查询入口：
  - 用户文档：`/diataxis/zh/tutorials/first-run/` 或 `/diataxis/en/tutorials/first-run/`
  - 开发文档：`/diataxis/en/reference/interfaces-and-runtime/` 与 `/diataxis/en/reference/release-and-governance/`
  - 维护者评估 LFS / 桌面 bootstrap 风险：`/en/sidecar_supply_strategy/` 或 `/zh/sidecar_supply_strategy/`
  - 维护者比较镜像成本 / 用户门槛 / 维护负担：`/diataxis/en/explanation/sidecar-supply-feasibility/` 或 `/diataxis/zh/explanation/sidecar-supply-feasibility/`
- CI 自动发布工作流（GitHub Pages）：`.github/workflows/docs-github-pages-publish.yml`。
- 手动回滚入口：运行 workflow_dispatch 并设置 `git_ref` 为稳定 tag/commit。
- MkDocs base/path 可通过环境变量覆盖：`MKDOCS_SITE_URL`、`MKDOCS_BASE_PATH`。
- CI 文档治理工作流：`.github/workflows/docs-diataxis-site.yml`。
- 文档发布与回滚运行手册：
  - English：[`docs/en/docs_release_and_rollback.md`](docs/en/docs_release_and_rollback.md)
  - 中文：[`docs/zh/docs_release_and_rollback.md`](docs/zh/docs_release_and_rollback.md)

---

<a id="changelog-zh"></a>

## 更新日志 (Changelog)

### v1.7.0 - 启动加速收口、多平台验证与学习路线图底座 (2026-03-31)
- **Tag 对比快照（`v1.6.0..v1.7.0`）**:
  - `47` 个提交、`160` 个变更文件、`+20,224 / -1,444` 代码/文档变更量。
  - 工程变更面主要集中在：`src/frontend/`、`scripts/`、`docs/`、`src-tauri/`、`package*.json`。
- **启动运行时优化收口（Phase 2/3/4 + v1.1 加固）**:
  - 新增启动 tick 差量传输（`tickMode: full|delta`），并引入低 alpha 自适应控制（`lowAlphaDeltaEpsilonMultiplier`、`lowAlphaFullSyncEveryTicks`）。
  - 主线程新增按帧合并的 startup tick 应用策略，减少稳定阶段附近的重复重绘压力。
  - 加固 warm-start 恢复，新增严格快照校验（fingerprint、age、node/edge 一致性、position coverage 阈值）。
  - 在 `T5 stable_layout` 扩展启动遥测，新增 `tickSummary`（`fullTicks`、`deltaTicks`、`deltaRatio`、payload/frame 指标）。
- **跨平台启动验证工具链**:
  - 新增/扩展 compare、matrix、watch、simulate、cohorts、signoff 自动化脚本，形成启动 KPI 治理闭环。
  - 建立“无硬件工程签收”流程（Windows 实机日志 + 模拟 cohorts），并保留正式发布阶段的实机多设备 cohorts 要求。
- **运行时契约与文档对齐**:
  - 同步 Diataxis EN/ZH 运行时参考文档，对齐新的 startup profile 字段与遥测语义。
  - 扩展启动加速方案文档，纳入 v1.1 优化与风险护栏收口细节。
  - 新增知识掌握演进路线图双语文档，并接入 Diataxis 导航与映射。
- **版本元数据对齐**:
  - 将 `package.json`、`package-lock.json`、`src-tauri/tauri.conf.json` 的发布元数据统一到 `1.7.0`。

### v1.6.7 - 文档治理清理与 GitHub Pages 稳定性修复 (2026-03-29)
- 清理并移除了项目文档体系中与本项目无关的外部社区界面文档引用。
- 将历史外部手册替换为项目内通用文档运维手册：
  - `docs/en/docs_release_and_rollback.md`
  - `docs/zh/docs_release_and_rollback.md`
- 同步更新 Diataxis 映射与跨文档链接，确保权威来源路径一致。
- 在文档发布工作流新增 GitHub Pages 预检步骤，未启用 Pages 时给出明确告警。
- 已通过仓库 Pages 启用与 `gh-pages` 源配置修复文档站点 404 问题。
- 完成下个正式版本发布准备，并将版本统一到 `1.6.7`（npm + Tauri）。

### v1.6.6 - Provider 运行时流程与 TOML 配置统一 (2026-03-26)
- 参考 obsidian-NotEMD 与 cline 的 Provider 策略，重构 NoteMD API 调用流为定义驱动。
- 新增 transport 分发（openai-compatible / anthropic / google / azure-openai / ollama）与 provider 元数据（apiKeyMode、apiTestMode、category）。
- 扩展内置 Provider 预设：Qwen、Doubao、Moonshot、GLM、MiniMax、Groq、Together、Fireworks、Requesty、OpenAI Compatible。
- 完成 Tauri + Godot + NoteMD 的 app_config.toml 统一配置：
  - NoteMD 全量配置持久化到 [notemd] + [[notemd.providers]]（保留 [notemd.api] 兼容镜像）
  - Path Mode 配置持久化到 [path_mode]，并提供 /api/path-mode/settings 读写接口
  - Godot 设置面板升级为运行时 TOML 同步链路。
- 加固 Rust 端 TOML 回写：保留未知 section，避免 Tauri 更新 KB/语言时覆盖 [notemd] / [path_mode]。
- 同步更新 v1.6.6 双语模板与 Diataxis 文档。

### v1.6.5 - 文档门户更新 (2026-03-26)

- 已将 MkDocs 文档发布到 GitHub Pages project site。
- 在 README 中补充了面向用户与开发者的中英文文档检索入口。
- 维护者发布流程统一为：
  - `npm run docs:site:build`
  - `.github/workflows/docs-github-pages-publish.yml`（`workflow_dispatch` 支持 `git_ref` 回滚）

### v1.6.0 - 单窗口运行时、NoteMD 集成与发布加固 (2026-03-23)

- **Tag 对比快照（`v1.3.0..v1.6.0`）**:
  - `107` 个提交、`301` 个变更文件、`+125,957 / -10,083` 代码/文档变更量。
  - 文件状态分布：新增 `241`、修改 `56`、删除 `3`、重命名 `1`。
  - 主要工程变更面集中在：`src/`、`docs/`、`scripts/`、`path_mode/`、`src-tauri/`。

- **单窗口运行时编排**:
  - 实现 Tauri <-> Godot 的可见性切换，同一时刻仅显示一个主窗口。
  - 增加 Godot 关闭确认流程（“返回主界面” / “关闭全部窗口”），避免误操作导致全局退出。
  - 修复并稳定 Godot 窗口可见性控制，移除已弃用前台激活调用。
- **NoteMD 嵌入式体验**:
  - 保持 NoteMD 为嵌入式能力（非独立桌面窗口），与 Tauri/Godot 双前端统一。
  - 修复 Tauri 中 NoteMD 的 `Browse` 按钮无响应问题（文件/文件夹/保存选择器端到端可用）。
  - 增加导入提示：PDF 需先通过 Mineru 转换为 Markdown 再导入。
- **平台与工具链发布就绪**:
  - 统一 Java 基线为 **JDK 21+**，并验证 **JDK 23.0.1** 在 Android 构建链路可用。
  - 新增 Android/Tauri 的补丁与校验脚本，覆盖前置依赖、sidecar 有效性、严格证据门禁。
- **可靠性与安全门禁**:
  - 扩展 CI/工作流：FixRisk 运维就绪、移动端 e2e 合约、wasm parity、SBOM、attestation、签名与隐私清单校验。
  - 新增多层合约回归覆盖（mobile/runtime/pathbridge/storage）。
  - 纳入发布前 CI 兼容修复：runtime bridge invoke 契约断言兼容与无签名 SBOM transparency 条件化策略。
- **构建性能与开发体验**:
  - 增加低内存 Tauri 构建包装器与 release 配置保护，提升受限内存环境可构建性。
  - 增加 sidecar 预检，避免开发期重复重建，缩短 `tauri:dev:mini:gpu` 热启动耗时。

### v1.5.x 迁移运行时日志（统一归档）
- 完整双语日志统一归档在 [`export.md`](export.md)。
- 本 README 在更新日志中保留摘要指针，避免将日志前置堆叠在文档开头。
- `2026-03-03 v1.5.10`：方案 A P0 状态更新（Tauri Android 原生目录/构建/内容链路）
- `2026-03-03 v1.5.5`：迁移状态复验
- `2026-03-03 v1.5.3`：迁移闸门收口更新
- `2026-03-02 v1.5.1`：Tauri 迁移进度更新（桌面 + Android）

### v1.4.4 - Tauri 桥接稳定化与缓存流程加固 (2026-03-01)

- **Electron -> Tauri 运行时对齐**:
  - **路径一致性**: 统一运行时路径解析，sidecar 图谱产物从打包前端资源读取，并写入可写运行时数据目录。
  - **知识库目录发现**: 在 Bridge-first 模式下标准化 `Knowledge_Base` 源根目录的文件夹枚举与加载流程。
- **构建/加载安全性**:
  - **缓存决策流程恢复**: 当目标缓存已存在时，恢复“直接加载缓存 / 重新生成”分流逻辑。
  - **重复请求抑制**: 在前端与后端双层增加去重保护，避免单次加载触发重复 restore/build。
- **PathBridge / WebSocket 稳定性**:
  - **客户端诊断增强**: 增加带标签的连接/断开日志（id、tag、code、reason），用于精准定位桥接问题。
  - **Godot URL 兼容修复**: 将 Godot WebSocket 地址修正为 `ws://127.0.0.1:9876/?client=godot`，解决 URL 解析错误。
  - **Tauri 空闲重连消除**: 在 Tauri 模式禁用 `frontend-early` 自动连接，消除后台 `1001` 循环重连。
- **语言/菜单同步稳健性**:
  - **幂等同步**: 在前端 i18n 与 Tauri Rust 命令两端增加幂等保护，避免重复无效菜单刷新。

### v1.4.1 - 树状视图交互修复 (2026-02-01)

- **交互优化**:
  - **长按导航**: 修复了节点长按 (0.6秒) 会触发右键菜单而不是导航的问题。现在长按可正确切换为中心节点。
  - **全部折叠**: 在学习路径头部添加了 `[-]` 按钮，并支持中键点击以立即折叠所有已展开的节点。
  - **右键切换**: 修复了右键点击无法正确切换节点展开/折叠状态的回归问题。
  - **懒加载 UI**: 将分离的 `(+)/(-)` 按钮替换为统一的状态感知 `[计数]` 指示器，用于切换前置依赖链的可见性。

### v1.4.0 - 路径模式学习体验与树视图 (2026-01-30)

- **路径模式 Bug 修复**:
  - **取消标记同步修复**: 在 `PathBridge.ts` 中添加了 `unmarkComplete` 和 `completionSync` 处理程序。
  - **取消标记后 UI 同步**: 树面板刷新 + 中心气泡进度更新。
  - **着色器语法修复**: 将 `depth_draw_alpha_prepass` 修正为 `depth_prepass_alpha`。
- **路径模式学习 UI**:
  - **导航历史**: 带下拉菜单的返回按钮，用于浏览学习历史。
  - **编辑模式**: 切换开关，用于启用/禁用取消节点标记。
  - **树面板**: 可折叠的依赖树，带视觉状态。
  - **进度显示**: 中心气泡上的"X of N"进度指示器。
- **计划中: 增强图形化树视图**:
  - SubViewport 叠加面板 + 贝塞尔曲线（思维导图风格）。
  - 4 种可选视觉主题: 彩色、深色、玻璃、极简。

### v1.3.0 - 路径模式打磨与 UI 优化 (Path Mode Polish & UI Refinements) (2026-01-24)

- **阅读器集成 (Reader Integration)**:
  - **无缝访问**: 在“轨道布局”中双击中心节点现在会立即打开`阅读器`，显示完整的节点内容。
  - **数据获取**: 修复了阅读器打开为空的关键问题；现在可以正确地从全局图状态检索完整的元数据。
- **视觉打磨 (Visual Polish)**:
  - **轨道布局**: 显著改进了节点分散度（半径 350-950px），减少了标签重叠。
  - **边缘清晰度**: 在轨道模式下，严格隐藏未连接到中心节点的边，将视觉混乱减少了 90%。
  - **标签可见性**: 周围节点现在总是显示标签，并根据距离按比例缩放（最大 16px）。
  - **景深 (DoF)**: 调整了不透明度衰减，以确保远处的节点保持可见（最小 0.4 不透明度）。
- **用户体验改进 (UX Improvements)**:
  - **目标选择**: 将“目标节点”搜索限制从 20 增加到 300，确保用户可以找到图中的任何节点。
  - **交互层级**: 修复了 `z-index` 层级问题，之前的阅读器窗口被隐藏在路径可视化后面。

### v1.2.0 - 路径模式与桌面渲染器 (2026-01-23)

- **路径模式 (Path Mode)**: 引入了一套主要的新功能，用于将图谱转化为线性的学习路径。
  - **学习模式**: '领域学习' (拓扑排序) 和 '扩散学习' (目标导向)。
  - **可视化**: 由 D3/Canvas 驱动的全新径向和树状布局。
  - **策略**: '基础优先' 和 '核心优先' 排序算法。
- **混合架构**:
  - **Godot 桥接**: 实现了 `PathBridge.ts`，通过 WebSocket (端口 9876) 与外部渲染器同步图谱状态。
  - **原生渲染**: 添加了对 Godot 4.3 的支持，以渲染高保真的 Vulkan 图形 (源码位于 `path_mode/`).
- **运维 (DevOps)**:
  - **NPM 脚本**: 添加了 `pathmode:dev` 和 `pathmode:test` 工作流。
  - **UI 稳定性**: 修复了径向布局可见性 (`centerView`) 和退出模式逻辑中的关键 Bug。

### v1.1.2 - 路径解析与 UI 稳定性 (2026-01-23)

- **后端协议修复**:
  - 改进了 `src/server.ts`，使其能够正确处理静态文件的 URL 查询参数（如 `?v=timestamp`）。
  - 解决了 Windows 环境下带缓存刷新参数的 URL 返回 404 的问题。
- **UI 交互修复**:
  - **欢迎弹窗**: 修复了 `welcome.js` 中的一个错误，即跳过教程会导致文件夹选择菜单因 `z-index` 被清除而无法响应的问题。
  - 确保 `#source-control` 在所有弹窗关闭路径下都能保持 `z-index: 1000`。

### v1.1.1 - 移动端构建自动化 (2026-01-22)

- **移动端运维**:
  - 引入了 `build_apk.bat`，用于在 Windows 上一键生成 Android APK。
  - 自动化环境检查（Node, JDK, Android SDK）和项目脚手架搭建。
- **文档**: 在 README 和用户手册中添加了移动端构建的详细指南。

### v1.1.0 - CI/CD 自动化 (2026-01-22)

- **GitHub Actions 集成**:
  - 新增自动 npm 发布工作流，支持发布事件和版本标签触发。
  - 新增版本一致性检查，防止版本号不匹配的发布。
- **DevOps**: 简化发布流程，使用 `git tag v1.1.0 && git push --tags` 即可发布。

### v1.0.1 - 维护与体验优化 (2026-01-21)

- **多语言体系整合**:
  - 移除了 `app.js` 中冗余的硬编码翻译逻辑。
  - 将所有 UI 字符串集成至 `I18nManager`，确保全应用语言切换的一致性。
  - 修复了欢迎弹窗中部分标签显示为英文的“语种混合”问题。
- **新人引导体验修复**:
  - **教程稳定性**: 通过正确暴露 `enterFocusMode` 接口，修复了专注模式教程引发的崩溃。
  - **欢迎弹窗逻辑**: 优化了 `source_manager.js` 中的加载时序，确保在数据状态确认后准确触发弹窗。
- **协议与缓存优化**:
  - **缓存刷新机制**: 在 `source_manager.js` 中实现了带时间戳的动态脚本加载器，防止浏览器加载旧版的 `data.js` 或 `app.js`。
  - **协议处理器精简**: 优化了 `main.ts` 中的 `app://` 协议处理器，采用 `net.fetch` 提供更稳健的本地文件访问支持。

### v1.0.0 - 正式发布 (Production Release) (2026-01-14)

- **稳定性与精简版可靠性**: 对“精简模式”进行了重大修复。
  - **首次启动修复**: 解决了应用在无数据状态下首次启动时的崩溃问题（增加了 `typeof` 安全检查）。
  - **产物自动清理**: 构建过程自动清理旧的数据残留，确保安装包体积最小化 (~70MB)。
  - **Worker 路径修复**: 修正了生产构建中后端工作线程的双层 `dist` 路径解析错误。
- **完全离线化策略**: 所有外部依赖均已迁移为本地资源。系统现在可在完全离线环境下运行。
- **专注模式细化**:
  - **视觉状态恢复**: 修复了退出专注模式后节点大小错误的 Bug。现在能完美恢复原始半径和字体大小。
  - **交互稳定性**: 修复了进入专注模式时的 D3 事件关联错误。
- **物理与间距优化**:
  - **全新默认值**: 默认链接距离增加至 **250px**，碰撞半径增加至 **25px**。
  - **扩展自定义范围**: 滑动条范围增加至 600px 距离 / 100px 碰撞。
- **性能与专注模式重构**:
  - **O(1) 邻居查找**: 在客户端实现邻接缓存，将切换耗时从 $O(N \times M)$ 降低至 $O(1)$。
  - **批量渲染**: 使用 `requestAnimationFrame` 同步渲染，确保平滑过渡。
- **用户定义知识库**: 全新的知识库路径管理、持久化配置及菜单控制。
- **安全与 CSP**: 增强了 CSP 以支持极端的离线安全，并移除了已弃用的 Electron 标志。

### v0.9.83 (2026-01-13)

- **GPU 工作线程集成**: 全面启用了前端模拟工作线程 (Simulation Worker) 中的 GPU 加速。工作线程现在可以动态导入 `gpu-browser.min.js` 和 `layout_gpu.js`，并遵循 `gpuRendering` 设置。
- **性能修复**: 解决了在初始化阶段忽略“GPU 优化渲染”设置、导致强制使用 CPU 计算的问题。现在大型图谱的加载速度显著提升。
- **稳健性**: 修复了 `updateParams` 中的一个关键错误，即在更改物理设置时，现有的 GPU 力实例会被意外地替换为 CPU 力。

### v0.9.74 (2026-01-12)

- **GPU 链接力 (Link Force)**: 使用 `gpu.js` 实现了高性能的 GPU 加速弹簧力。支持 "Gather" 算法，用于高效的邻居处理。
- **物理稳健性**: 在 GPU 核函数中引入了速度钳位 (MAX_VELOCITY=100) 和 NaN/无穷大安全防护，防止节点“爆炸”和消失。
- **布局切换修复**: 实现了 Force 和 DAG 布局的稳健状态保存 (`layoutCache`)，确保节点位置在切换时被保存和恢复，消除了“瞬移”现象。修复了 `updateLayout` 中的关键崩溃，并增加了专注于模式对 GPU 力的支持。
- **GPU 资源管理**: 重构 `layout_gpu.js` 使用单例模式管理 GPU 上下文，防止在切换设置时发生 WebGL 上下文泄漏 (限制 16 个)。

### v0.9.71 (2026-01-10)

- **后端并行布局**: 通过使用 Worker 线程或 GPU 在后端预计算节点位置，加速前端加载。
- **GPU 优化渲染**: 在后端布局中添加了对 AMDGPU 加速的支持。
- **静态模式**: 为海量图谱 (>5000 节点) 实现了严格的模拟冻结以节省资源。
- **CLI 支持**: 添加了完整的 CLI 参数支持，用于自动化构建和加载。
- **极端规模优化**: 对于超过 10,000 个节点的图谱，完全禁用了边渲染，以防止浏览器崩溃。

### v0.9.67 - 紧凑模式与 Canvas 修复 (2026-01-08)

- [x] **紧凑模式**: 添加了一种新模式，默认隐藏边以提高海量图谱（>5k 节点）的性能。此模式在大数据集上自动启用，但可以在设置中切换。
- [x] **Canvas 修复**: 解决了大图在加载时因强制初始 Canvas 渲染帧而显示白屏的问题。
- [x] **优化**: 渲染循环现在在紧凑模式下完全跳过边迭代，显著降低了空闲或平移/缩放期间的 CPU 使用率。

### v0.9.61 - 前端内存优化 (Frontend Memory Optimization) (2026-01-07)

- [x] **智能渲染**: 当图谱包含超过 3000 个节点时，默认自动切换到 **Canvas** 模式。
- [x] **性能**: 降低浏览器内存占用，并提高大数据集初始加载时的帧率。

### v0.9.60 - 并行图指标计算 (Parallel Graph Metrics) (2026-01-07)

- [x] **性能**: 使用 Worker 线程并行化了“图指标”计算（介数中心性）。
- [x] **可扩展性**: 将繁重的 Brandes 算法计算分发到多个 CPU 核心，确保大数据集的图构建更快。

### v0.9.58 - 混合推断资源重用 (优化) (Hybrid Inference Resource Reuse) (2026-01-07)

- [x] **内存优化**: 在 `GraphBuilder` 中为“统计矩阵”和“向量空间”实现了资源重用逻辑。
- [x] **效率**: 防止在混合推断期间重复计算繁重的数据结构，消除了内存峰值并解决了大数据集上的 OOM 崩溃问题。
- [x] **清理**: 在推断任务完成后添加了严格的内存清理步骤。

### v0.9.82 - 稳健性增强与交互优化 (2026-01-12)

- [x] **握手协议**: 引入了 Worker 握手协议 (`isLayoutSwitching`)，有效解决了布局切换竞态，防止延迟消息导致 UI 跳变。
- [x] **专注模式隔离**: 为专注模式实现了完全的手动坐标管理，拖动节点不再受物理引擎干扰，确保定位精准。
- [x] **布局缓存安全**: 增加了 50% 的布局恢复安全阈值，缓存异常时自动执行物理松弛，防止图谱崩溃。
- [x] **分析面板稳定**: 优化了面板缩放时的渲染逻辑，在“冻结布局”激活时严格禁止不必要的物理重启。

### v0.9.57 - Worker 内存优化 (Worker Memory Optimization) (2026-01-07)

- [x] **稳定性修复**: 通过优化 Worker 线程的数据传输策略，解决了处理大数据集 (>13k 文件) 时的“堆内存溢出”崩溃问题。
- [x] **效率**: Worker 现在接收文件路径并按需读取内容，消除了跨线程克隆大型文件内容字符串的内存开销。

### v0.9.56 - 混合推断内存优化 (Hybrid Inference Memory Optimization) (2026-01-05)

- [x] **内存分析**: 为混合推断引擎添加了细粒度的性能日志，每 1000 个节点跟踪一次堆内存使用情况，以识别 Windows 上的内存峰值。
- [x] **优化**: 在推断完成后立即实施激进的内存清理（清除矩阵和置空向量空间），以防止堆内存溢出。

### v0.9.55 - 堆内存溢出修复与迭代 DFS (Heap OOM Fix & Iterative DFS) (2026-01-05)

- [x] **稳定性修复**: 通过在算法阶段之前显式清除文件内容内存，解决了 Windows 10/11 上的“堆内存溢出”崩溃问题。
- [x] **稳健性**: 重构 `CycleDetector` 使用 **迭代 DFS**（基于栈）方法，消除了深度图上的堆栈溢出风险。
- [x] **可观测性**: 将“算法核心”的性能日志拆分为“循环检测”和“拓扑排序”两个独立阶段，以便进行精确调试。

### v0.9.54 - 欢迎体验 (Welcome Experience) (2026-01-05)

- [x] **引导 (Onboarding)**: 添加了一个“欢迎”模态框，当图谱为空时出现，引导新用户选择数据源并加载数据。
- [x] **用户体验 (UX)**: 在欢迎状态下高亮显示“源选择”控件。

### v0.9.53 - 核心 API 解耦 (Core API Decoupling) (2026-01-05)

- [x] **架构重构**: 将核心图构建逻辑提取到独立的 `NoteConnection` 类 (`src/core/NoteConnection.ts`) 中。
- [x] **插件准备**: 将核心 API 与 CLI/服务器特定的文件操作解耦，从而支持与未来的 Joplin/Obsidian 插件直接集成。
- [x] **文档**: 更新了用户手册，补充了缺失的“最大 Worker”性能设置。

### v0.9.52 - 循环检测内存优化 (Cycle Detection Memory Optimization) (2026-01-05)

- [x] **稳定性修复**: 解决了在构建具有大量循环的大型图谱时，Windows 10/11 上发生的关键“堆内存溢出”崩溃问题。
- [x] **算法优化**: 更新了 `CycleDetector` 以限制检测到的循环数量，防止递归期间过度的内存消耗。

### v0.9.51 - 性能日志与崩溃报告 (Performance Logging & Crash Reporting) (2026-01-03)

- [x] **系统监控**: 为后端流程（CPU、内存、时间）实现了全面的性能日志记录。
- [x] **GPU 诊断**: 为 GPU 加速步骤添加了执行计时和内存跟踪。
- [x] **崩溃报告**: 实现了 `CrashLogger`，自动将未处理的异常和 Worker 故障记录到 `crash.log`，以便调试 Windows 11 上的稳定性问题。
- [x] **优化**: 将 `PerformanceLogger` 集成到整个图构建管道（节点初始化、边匹配、推断）中。

### v0.9.50 - GPU 加速 (GPU Acceleration) (2026-01-02)

- [x] **验证**: 确认了使用 **AMD Radeon 7900XT** 通过 `gpu.js` 加速图构建的可行性。
- [x] **策略**: 验证了数学推断（向量相似度）可以卸载到 GPU，而文本处理仍保留在 CPU 上进行优化。
- [x] **实现**: 添加了 `amdgpu` 模块和 `VectorSpaceGPU` 类。集成到 `GraphBuilder` 中，在启用时自动使用 GPU 进行余弦相似度矩阵计算。

### v0.9.49 - 统计分析内存优化 (Statistical Analysis Memory Optimization) (2026-01-02)

- [x] **性能**: 通过优化统计分析器算法，修复了处理大数据集 (>10,000 文件) 时关键的“堆内存溢出”崩溃问题。
- [x] **效率**: 使用稀疏的、以文件为中心的方法，将共现矩阵计算的复杂度降低了约 30 倍。

### v0.9.49 - 并行处理 UI 控制 (UI Controls for Parallel Processing) (2026-01-02)

- [x] **设置界面**: 在设置模态框中添加了“性能” (Performance) 部分，包含用于控制“最大 Worker”的滑块和数字输入框。
- [x] **API 集成**: “加载”按钮现在会将用户定义的 Worker 限制发送到后端构建流程。
- [x] **持久化**: Worker 设置与其他偏好一起保存在 `localStorage` 中。

### v0.9.48 - 并行处理优化 (Parallel Processing Optimization) (2026-01-02)

- [x] **可配置 Worker**: 添加了 'maxWorkers' 配置，允许利用更多 CPU 核心进行图构建和统计推断。移除了 12 个 Worker 的硬编码限制。

### v0.9.46 - 专注模式 UI 清理与 Canvas 边修复 (Focus Mode UI Cleanup & Canvas Edge Fix) (2025-12-26)

- [x] **沉浸式专注**: 专注模式期间，主控制面板和源选择栏现在完全隐藏，以提供无干扰的体验。
- [x] **Canvas 打磨**: 移除了 Canvas 专注模式下的边渲染，以减少视觉噪音。

### v0.9.45 - Canvas 交互与清理 (Canvas Interactivity & Cleanup) (2025-12-26)

- [x] **Canvas 交互**: Canvas 模式现在支持悬停 (高亮)、单击 (统计) 和双击 (专注模式) 交互，与 SVG 功能对齐。
- [x] **视觉修复**: 修复了 Canvas 模式下节点渲染过大的问题；现在它们遵循“大小依据”设置。
- [x] **清理**: 移除了已弃用的“视图模式” (聚类) 功能。

### v0.9.44 - 独立专注模式间距 (Independent Focus Mode Spacing) (2025-12-26)

- [x] **智能间距**: “层间距”和“节点间距”设置现在针对“水平”和“垂直”专注布局独立保存。
- [x] **优化默认值**: 将默认水平层间距减少 50%，垂直节点间距减少 75%，以获得更紧凑、更易读的布局。

### v0.9.43 - 上下文感知设置 UI (Context-Aware Settings UI) (2025-12-26)

- [x] **动态标签**: 设置中的“排斥力强度”标签现在会在“排斥力 (力导向)”和“排斥力 (DAG)”之间动态变化，以清晰指示正在修改哪种布局配置。

### v0.9.42 - 独立排斥力设置 (Distinct Repulsion Settings) (2025-12-26)

- [x] **特定模式物理**: “排斥力强度”现在可以针对“力导向”和“DAG”模式独立配置。
- [x] **智能默认值**: 将力导向布局（聚类）的默认排斥力设置为 **-550**，DAG 布局（层级）设置为 **-850**，以优化初始视觉分离。
- [x] **上下文感知设置**: 设置模态框会自动显示当前布局的排斥力数值。

### v0.9.41 - 设置模态框模拟冻结 (Settings Modal Simulation Freeze) (2025-12-26)

- [x] **资源节省**: 打开“可视化设置”模态框时，模拟现在会自动暂停，从而减少配置期间的 CPU 使用率。关闭时会自动恢复，除非全局启用了“冻结布局”。

### v0.9.40 - 冻结布局优先级修复 (设置模态框) (2025-12-26)

- [x] **设置隔离**: 如果布局已冻结，在“可视化设置”模态框中调整参数（例如排斥力、透明度）不再触发模拟重启。视觉更改立即生效，而物理更新等待解冻。

### v0.9.39 - 布局切换松弛与冻结逻辑 (Layout Switch Relaxation & Freeze Logic) (2025-12-26)

- [x] **一致过渡**: 切换布局现在会触发与初始加载相同的“快速松弛”（0.2 阻尼持续 2 秒），确保节点快速排列。
- [x] **智能冻结**: 如果在切换期间激活了“冻结布局”，模拟将运行 2 秒的松弛期以建立新结构，然后自动冻结。

### v0.9.38 - 快速开始指南 HTML 渲染修复 (Quick Start Guide HTML Rendering Fix) (2025-12-26)

- [x] **富文本支持**: 修复了本地化 UI 中的 HTML 标签（例如粗体文本、换行符）显示为原始文本的问题。系统现在可以正确渲染翻译中的 HTML 格式。

### v0.9.37 - 快速松弛策略 (Rapid Relaxation Strategy) (2025-12-26)

- [x] **智能阻尼**: 模拟现在以低摩擦 (0.2) 启动 2 秒，以允许节点快速解开（“松弛”），然后自动增加到高摩擦 (0.95) 以保持稳定。

### v0.9.36 - 冻结布局优先级修复 (Freeze Layout Priority Fix) (2025-12-26)

- [x] **严格冻结**: 如果“冻结布局”处于激活状态，更改“度数基准”或“大小依据”设置不再唤醒模拟。视觉效果更新（节点大小改变），而位置严格锁定。

### v0.9.35 - 视口剔除放宽 (Viewport Culling Relaxation) (2025-12-26)

- [x] **平滑剔除**: 将屏幕外“活动”缓冲区增加到 800px (视觉)，防止边缘附近的节点在平移期间突然冻结。
- [x] **扩展缩放**: 将全局模拟冻结阈值从 0.4x 降低到 0.1x，允许物理模拟在大幅缩小时继续运行。

### v0.9.34 - 全局布局更新修复 (Global Layout Update Fix) (2025-12-26)

- [x] **布局转换逻辑**: 实现了布局切换期间的全局解冻机制。
- [x] **覆盖剔除**: 切换布局（例如从 Force 到 DAG）现在会强制清除视口剔除锁定（`isCulled`，`fx`，`fy`），确保所有节点（包括屏幕外的节点）都能正确参与新的布局排列。

### v0.9.33 - 布局状态缓存 (即时切换) (2025-12-26)

- [x] **模板状态**: 为“Force”和“DAG”布局实现了独立的状态缓存。
- [x] **即时切换**: 切换布局现在会保存当前状态并立即恢复目标状态，无需重新计算或视觉移动，从而保留每个视图的精确排列。

### v0.9.32 - 高阻尼与渲染优化 (2025-12-26)

- [x] **阻尼**: 将默认摩擦力增加到 0.92 以加快稳定速度。
- [x] **渲染剔除**: 跳过屏幕外冻结节点的 DOM 更新。

### v0.9.31 - 模拟优化 (视口剔除) (2025-12-26)

- [x] **性能**: 实现了智能视口剔除以减少模拟负载。
- [x] **全景冻结**: 当缩小到查看整个图表 (< 0.4x) 时自动冻结模拟。
- [x] **屏幕外冻结**: 放大时，仅模拟可见视口（加上缓冲区）内的节点；屏幕外的节点被冻结。

### v0.9.30 - 专注模式布局隔离 (Focus Mode Layout Isolation) (2025-12-26)

- [x] **位置一致性**: 为专注模式实现了坐标备份/恢复逻辑 (`x`, `y`, `fx`, `fy`)。
- [x] **行为**: 退出专注模式现在会将图表布局恢复到进入前的*精确*状态，丢弃专注会话期间所做的任何临时排列或拖动。
- [x] **UX**: 满足了专注模式应对主界面布局结构零影响的要求。

### v0.9.29 - 冻结布局持久化 (Freeze Layout Persistence) (2025-12-26)

- [x] **Bug 修复**: 解决了打开分析面板或调整窗口大小时会覆盖“冻结布局”状态，导致节点意外移动的问题。
- [x] **稳健性**: 物理模拟现在在布局变更期间严格遵守冻结状态，确保节点按预期保持静止。

### v0.9.27 - 条件重启 (Conditional Restart) (2025-12-26)

- [x] **逻辑修正**: 解决了“退出专注模式”会无条件重启物理模拟，覆盖“冻结布局”状态的冲突。
- [x] **优先级执行**: 如果选中了“冻结布局”，退出专注模式现在会停止模拟并强制进行静态渲染更新，确保节点按请求保持严格静止。

### v0.9.26 - UX 增强与快速开始 (UX Enhancements & Quick Start) (2025-12-26)

- [x] **冻结布局快速按钮**: 在主界面添加了专用的冻结按钮 (❄️) 以便即时访问，提高了移动端可用性。
  - [x] **同步**: 状态与模拟面板复选框同步。
  - [x] **视觉**: 冻结时按钮变红。
- [x] **快速开始指南**: 为新用户实现了“快速开始指南”模态框。
  - [x] **内容**: 涵盖加载、导航、专注模式和控制。
  - [x] **引导**: 首次访问时自动显示（除非选中“不再显示”）。
  - [x] **访问**: 可通过新的“帮助” (❓) 按钮随时访问。
- [x] **本地化**: 全面本地化了新的 UI 元素（中/英）。

### v0.9.25 - 冻结布局优化 (Freeze Layout Optimization) (2025-12-25)

- [x] **资源优化**: 在主界面（SVG 模式）中，启用“冻结布局”现在除了停止模拟外，还会完全禁用节点拖动。
- [x] **逻辑**: 防止因拖动事件而重启（唤醒）物理模拟，从而确保最大限度地节省 CPU/内存。
- [x] **专注模式保留**: 专注模式下的拖动和手动定位功能保持完全激活，不受全局冻结设置的影响。

### v0.9.19 - 专注模式与弹窗增强 (Focus Mode & Popup Enhancements) (2025-12-24)

- [x] **专注模式重新进入**: 修复了在专注模式下双击相关节点时无法正确刷新的问题。现在可以在连接的节点之间无缝切换专注。
- [x] **可拖动弹窗**: 节点统计弹窗现在可以通过标题栏拖动到屏幕上的任何位置，以便更好地组织工作区。
- [x] **可缩放弹窗**: 添加了缩放控制 (+/−/⟲)，可将弹窗内容从 0.5x 缩放到 2.0x，以提高可读性。
- [x] **可调整大小弹窗**: 启用了浏览器原生调整大小手柄，用于手动调整弹窗大小。
- [x] **状态管理**: 改进了节点可见性标志重置，以防止切换专注上下文时出现累积问题。

### v0.9.18 - 节点高亮重构 (Node Highlighting Refactor) (2025-12-24)

- [x] **模块化架构**: 创建了专用的 `NodeHighlightManager` 类，实现高亮逻辑的清晰分离。
- [x] **统一接口**: 为 PC（悬停）和移动端（点击）交互提供单一 API。
- [x] **状态管理**: 正确跟踪高亮/冻结状态，并具备专注模式感知能力。
- [x] **增强渲染**: SVG 和 Canvas 模式之间的一致视觉行为。
- [x] **双语文档**: 整个代码库中全面的中英文注释。
- [x] **稳健集成**: 与现有的专注模式、分析面板和统计弹窗功能完全兼容。

### v0.9.17 - SVG 视觉完整性 (SVG Visual Completeness)

- [x] **彩色箭头**: SVG 边现在在高亮时使用红色和蓝色箭头，确保整个连接颜色编码一致。

### v0.9.16 - 交互完整性 (Interaction Completeness)

- [x] **完整上下文**: 点击或悬停节点现在会显示**所有**连接 (入度和出度)，无论当前过滤器模式如何。
- [x] **Canvas 打磨**: 为 Canvas 渲染器中的高亮边添加了加粗样式。

### v0.9.14 - 视觉与数据修复 (Visual & Data Fixes)

- [x] **边高亮**: 修复了 SVG 模式下边颜色（红/蓝）和加粗样式未正确应用的问题。
- [x] **数据去重**: 确保统计弹窗中的邻居列表不包含重复条目。

### v0.9.13 - 专注模式隔离 (Focus Mode Isolation)

- [x] **交互约束**: 确保在专注模式处于激活状态时，严格禁用浮动统计弹窗和相关高亮显示，以防止上下文冲突。

### v0.9.12 - 独立统计弹窗 (Independent Statistics Popup)

### v0.9.10 - 交互完善 (点击冻结)

- [x] **检查**: 点击节点现在会冻结整个模拟，以便稳定地检查连接。
- [x] **恢复**: 点击背景会恢复模拟（如果未手动冻结）。

### v0.9.9 - 移动端分析面板打磨

- [x] **移动端适配**: 实现了滑动（上/下）手势以调整分析面板大小、全屏拖动吸附以及移动端拖动手柄。
- [x] **交互**: 验证了分析面板与图表之间的节点点击同步。

### v0.9.8 - 分析交互完善

- [x] **图表同步**: 点击表格行现在会高亮显示图表中的节点。
- [x] **移动端 UX**: 修复了分析面板中的移动端滚动问题。

### v0.9.7 - 专注模式交互修复

- [x] **专注模式**: 修复了切换布局类型不会触发立即刷新的 Bug。

### v0.9.6 - 分析与视觉打磨

- [x] **分析面板**: 添加了 "全屏" 切换和 "捏合缩放" 以提高移动端可读性。
- [x] **视觉效果**: 修复了 Mermaid 缩放文本样式；添加了背景点击以清除高亮。

### v0.9.5 - 移动体验优化与专注语义

- [x] **专注模式**: 添加了 "层级 (从左到右)" 布局和语义标签 ("Helping to understand" / "Further exploration")。
- [x] **分析面板**: 针对移动端优化（可滚动），并添加了与主图的点击高亮交互。
- [x] **视觉效果**: 增强了 Mermaid 图表在浅色背景下的文本可见性；修复了专注模式居中问题。

### v0.9.2 - 移动端 UI 优化

- [x] **响应式控件**: 主面板在移动端折叠；专注 UI 移至底部。
- [x] **触摸缩放**: 阅读窗口添加了捏合缩放支持。

### v0.9.0 - 精确控制与稳定性 (2025-12-23)

- [x] **悬停锁定**: 悬停节点时锁定其位置，防止检查时漂移。
- [x] **模拟控制**: 添加了 **冻结布局** 复选框和 **速度/阻尼** 滑块。

### v0.8.9 - 稳定性改进

- [x] **选中冻结**: 专注模式下的节点在交互后保留其位置。

### v0.8.8 - 可扩展性默认值

- [x] **减少杂乱**: 默认隐藏边和孤立节点。
- [x] **水平间距**: 专注模式下新增水平节点分隔滑块。

### v0.8.7 - 渲染引擎

- [x] **Canvas 渲染器**: 添加 HTML5 Canvas 支持以实现高性能。
- [x] **Worker 扩展**: 将线程限制增加到 12。

## Acknowledgments / 致谢

Standing on the shoulders of these great projects. Thank you to their authors and maintainers!

感谢以下优秀开源项目及其作者与维护者：

- **[obsidian-notemd](https://github.com/Jacobinwwey/obsidian-NotEMD)** — the heart of our Notemd engine ❤️
- **[GitNexus](https://github.com/Compound-Engineering/GitNexus)** — shared types, staleness tracking, and graph ops patterns
- **[DeepTutor](https://github.com/DeepTutor/DeepTutor)** — agent-native two-layer model (Tools + Capabilities)
- **[cline](https://github.com/cline/cline)** — co-located test architecture that keeps our tests close

## License / 开源许可

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0-only)**.

本项目采用 **GNU General Public License v3.0（GPL-3.0-only）** 开源协议。
