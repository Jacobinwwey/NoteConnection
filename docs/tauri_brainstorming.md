# 2026-03-02 v1.5.1 - Tauri Architecture Unification (Runtime Parity Update)

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

## 中文文档

### 本次补充脑暴的原因

原始迁移蓝图主要解决 Electron 外壳替换、跨平台打包可行性与统一调试问题。经过最近几轮落地后，当前重点已经从“能构建”推进到“运行时能力对等”。

### 已验证的新决策

1. 保持 **桌面端 sidecar + Godot** 主架构不变，以保障高负载渲染性能。
2. 保持 **Tauri Android** 与 Capacitor 并行，作为正式移动端构建路径。
3. 对 Android 采用 **运行时能力门控**，不强行套用桌面前提：
   - sidecar 可用性
   - 本地构建能力
   - 内容读取能力
4. 新增可在 sidecar 与 Rust IPC 双路径复用的对齐接口：
   - 可用目标发现（`available-targets` 语义）
   - 节点内容读取（`read_node_content` 语义）

### 架构含义（当前状态）

- 桌面端：
  - 继续以 Sidecar API + Godot Bridge 为主路径。
  - 支持完整本地构建。
- Android 端：
  - 构建链路已稳定（`tauri android build` 已实测通过）。
  - 运行时已支持缓存加载 + Rust IPC 内容读取回退。
  - 应用内图谱构建仍暂未开放，等待 Android 原生存储/导入方案。

### 仍需决策的战略问题

1. **Android 应用内构建对等**：
   - 是实现基于 SAF 的本地目录导入 + 增量构建服务，还是
   - 在当前发布阶段继续定位为“缓存消费型”运行时。
2. **Path Mode/Godot 的 Android 路线**：
   - 保持仅桌面可用并明确提示，还是
   - 定义 Android 原生渲染替代方案（WebGL/Canvas 或 Godot Android 路线）。

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

# Tauri 架构统一：综合架构蓝图

**日期：** 2026-02-27
**状态：** 已批准 & 执行中

## 1. 问题陈述与核心目标

NoteConnection 项目目前正面临严重的扩展性和开发者体验 (DX) 瓶颈：

1.  **双窗口体验碎裂：** 分别在 Electron 中运行后端和在 Godot GUI 中运行前端，导致出现两个完全独立的窗口，极大降低了终端用户体验。
2.  **碎片化的调试：** F12 调试信息和错误日志分布在 Godot 引擎控制台和 Node.js/Electron 终端之间，使得崩溃分析变得极其繁琐。
3.  **跨平台打包障碍：** 最初选择 Godot 是因为需要原生 Vulkan 支持来渲染 1-5 万个节点。然而，目前的架构缺乏清晰的路径来通过单一代码库生成轻巧的 Windows EXE、Android APK (借助 Capacitor/Godot) 以及未来的 Web 部署。

**最终目标：**

- **一个统一的外壳 (Shell)**，在外观和体验上如同一个原生的单窗口应用程序。
- **一个中央调试控制台**，将 Godot 日志、Node.js 后端日志和 Web UI 错误统一汇集并输出。
- **流线型的跨平台编译**，能够无需针对操作系统进行大规模的“窗口黑客”就能打包为 EXE、APK 和 Web。

---

## 2. 解决方案：Tauri 2.0 原生外壳架构

基于您明确拒绝在 Electron 中使用脆弱的 Win32 本地窗口嵌入，并接受使用少量的 Rust 集成层，**Tauri 2.0** 被选为取代 Electron 的框架。

Tauri 2.0 通过利用操作系统的内置 Web 引擎 (Windows 的 WebView2，macOS/iOS 的 WebKit，Android 的 WebView) 和极其高性能的 Rust 后端解决了核心瓶颈，为桌面和移动端提供了原生打包能力。

### 架构拓扑

| 平台                     | 主外壳 (Master Shell) | 渲染引擎 (节点)                 | Web UI (工具/阅读器)       | 后端逻辑                                |
| :----------------------- | :-------------------- | :------------------------------ | :------------------------- | :-------------------------------------- |
| **桌面端 (Windows EXE)** | Tauri (Rust)          | Godot (Vulkan, 原生子进程)      | Tauri WebView (覆盖/并排)  | Node.js (子进程)                        |
| **移动端 (Android APK)** | Tauri (Rust)          | Godot (Android Vulkan 表面视图) | Tauri Android WebView 插件 | Node.js (V8 隔离区 / 系统原生 Rust API) |
| **Web 浏览器**           | 浏览器                | HTML5 Canvas / WebGL            | 标准 DOM                   | 远程服务器 / WASI                       |

### 这一转变的核心优势

1.  **零窗口黑客 (F12 统一)：** Tauri 的 Rust 后端作为绝对的主协调器。它启动 Node.js 后端。它可以原生将 Web UI 注入到 Godot 视口上方。Rust 拦截来自 Godot 和 Node.js 的 `stdout`/`stderr`，将单一的、统一的日志流打印在开发者的终端上。
2.  **极端的体积缩减：** 最终的 Windows EXE 将从 Electron 的 ~150MB 缩减到约 10MB-15MB。
3.  **原生移动端支持：** Tauri 2.0 支持 `npm run tauri android build`，自动生成所需的 Gradle 项目并原生交叉编译 Rust 后端，避开了 Capacitor 沉重的 DOM 开销。

---

## 3. 实施计划 (完整路线图)

以下是将 NoteConnection 代码库从 Electron 过渡到 Tauri 2.0 的步骤式路线图。

### 阶段 1：Tauri 初始化与环境设置

- **目标：** 安装 Tauri 2.0 并配置构建管道以使用现有的前端 dist 编译文件。
- **任务：**
  1.  在 `src-tauri` 目录初始化 Tauri (`npm create tauri-app@latest`)。
  2.  配置 `tauri.conf.json` 将 `build.devUrl` 映射到本地开发服务器 (如 `http://localhost:3000`)。
  3.  配置 `build.frontendDist` 指向 `dist/src/frontend` 的构建输出。
  4.  验证 `npm run tauri:dev:mini` 能否成功打开 Tauri Webview 并显示现有的 HTML/JS 用户界面。 _(已完成)_

### 阶段 2：Node.js 后端 Sidecar 集成 (统一日志)

- **目标：** 将 Node.js 后端 (`server.ts`, 图谱构建器) 从 Electron 主进程中剥离，使其作为由 Tauri 管理的独立本地服务器运行。
- **任务：**
  1.  在 `tauri.conf.json` 中将编译后的 Node.js 后端声明为 "Sidecar" 附属二进制文件。
  2.  更新 `src-tauri/src/lib.rs` (Rust)，以便在 Tauri 应用启动时自动拉起 Node.js sidecar。
  3.  **极其关键的体验升级步骤：** 编写 Rust 代码，使用 `tauri::process::Command` 拦截来自 Node.js sidecar 的所有 `stdout` 和 `stderr`，并将其直接打印到 Rust 终端。这实现了后端日志的终极统一。
  4.  确保优雅退出：当 Tauri 窗口关闭时，Rust 必须杀死 Node.js 子进程，以防止僵尸进程继续霸占 3000 端口。

### 阶段 3：Godot 原生嵌入 (真正的单窗口)

- **目标：** 在不使用脆弱的 Win32 黑客代码的情况下，将 Godot 渲染引擎集成到 Tauri 外壳中。
- **任务：**
  1.  将 Godot 项目导出为独立的 无头(headless)/无边框(borderless) 可执行文件。
  2.  将 Godot 可执行文件配置为 Tauri 的第二个 "Sidecar"。
  3.  在 Rust 中启动 Godot 并捕获其日志，将它们合并到与 Node.js 相同的终端流中。
  4.  **UI/UX:** 定义布局通信协议。Web UI (Tauri) 将建立一个到本地 Godot 实例的 WebSocket 连接 (`PathBridge`)，以同步图谱数据和交互状态。
  5.  _(可选但推荐)_：探索 Tauri 窗口透明度或嵌入式 API，以物理方式将 Godot Vulkan 表面贴合在 Tauri WebView 布局的底层。

### 阶段 4：生产环境打包 (EXE & APK)

- **目标：** 干净利落地生成最终部署构件。
- **任务 (桌面端)：**
  1.  执行 `npm run tauri build`。
  2.  验证生成的 `.exe` 能否正确打包 Node sidecar，干净启动并成功连接至 Godot 渲染器。
- **任务 (移动端/Android)：**
  1.  在环境变量中设置 Android NDK/SDK 路径。
  2.  将 `server.ts` 的文件系统操作 (`fs.readFileSync`) 抽象到 Tauri 的基于 Rust 的 `fs` API 或 Deno 隔离区之后，因为 Android APK 无法直接运行标准 Node.js 原生模块。
  3.  执行 `npm run tauri android build` 以生成签名的 APK。
