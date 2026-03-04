# 2026-03-04 v1.5.13

# User Manual

## English Document

### 1. Introduction

NoteConnection is a visualization tool that transforms your Markdown notes into a hierarchical knowledge graph. It helps you understand the structure of your knowledge base by identifying prerequisites, learning paths, and clusters.

### 2. Getting Started

1.  **Select Data Source**: Upon opening the application, use the dropdown menu in the top-left corner to select a folder from your `Knowledge_Base`.
2.  **Load Graph**: Click the "Load" button. For large datasets, the system will use parallel processing to build the graph efficiently.
3.  **Explore**: The graph will render in the main view. You can pan and zoom using your mouse or touch gestures.

### 3. Core Features

#### 3.1 Layout Modes

- **Force-Directed**: Default mode. Good for seeing clusters and groups.
- **DAG (Directed Acyclic Graph)**: Hierarchical mode. Arranges notes based on dependencies (Top -> Bottom). Useful for learning paths.

#### 3.2 Focus Mode

- **Enter**: Double-click any node to enter Focus Mode.
- **View**: The selected node moves to the center.
  - **Helping to understand (Left/Bottom)**: Prerequisites and incoming connections.
  - **Further exploration (Right/Top)**: Next steps and outgoing connections.
- **Controls**: Use the sliders at the bottom to adjust Vertical and Horizontal spacing.
- **Open Content**: Click the "Specific Content" button to read the node's full text.
- **Exit**: Click the "Exit Focus" button or double-click the background.
- **Note**: "Freeze Layout" allows you to manually arrange nodes in this mode without them snapping back.

#### 3.3 Node Inspection

- **Hover (PC)**: Hover over a node to see its connections and details.
- **Click (Mobile/PC)**: Click a node to "Freeze" it and open the **Statistics Popup**.
  - **Popup**: Shows In-degree (Red) and Out-degree (Blue) lists. You can drag and zoom this popup.
  - **Actions**: Click any neighbor in the list to navigate to it.

#### 3.4 Simulation Controls

- **Panel**: Located on the right side.
- **Freeze Layout**: Check this to stop all movement. Useful for large graphs or manual arrangement.
  - **Quick Button**: Use the snowflake icon (❄️) in the toolbar for quick toggling.
- **Speed/Damping**: Adjust the slider to control how fast the graph settles.

### 4. Analysis Panel

- **Access**: Scroll down or click "Analysis" to view the data table.
- **Interaction**: Clicking a row in the table highlights the corresponding node in the graph.
- **Mobile**: The panel supports full-screen mode and pinch-to-zoom for better readability.

### 5. Settings

- **Access**: Click the Gear icon.
- **Options**:
  - **Language**: Switch between English and Chinese.
  - **Physics**: Tune gravity and repulsion forces.
  - **Performance**:
    - **Enable GPU Acceleration**: Toggle GPU usage for accelerated matrix operations (e.g., Cosine Similarity). Recommended for AMD Radeon 7900XT or compatible GPUs.
    - **Max Workers**: Adjust the number of CPU threads used for parallel processing (Default: CPU Cores - 1). Higher values speed up large builds but use more memory.
    - **Memory Saving Mode**: (v0.9.63) Enable to optimize backend memory usage for large datasets (10k+ files). Reduces Peak Heap by streaming file content and serializing data efficiently. Default: Enabled.
  - **Visuals**: Adjust edge opacity.

### 6. Performance Features (Auto-Optimization)

- **Canvas Auto-Switch**: If your graph contains more than 3000 nodes, NoteConnection automatically switches to the **Canvas Renderer** to ensure smooth performance. You can manually switch back to SVG in the controls if needed.
- **Physics Culling**: For extremely dense graphs (>20,000 edges), the physics simulation will only calculate forces for a subset of edges to prevent freezing the interface, while still rendering all connections.

### 7. Mobile App Build

NoteConnection includes a one-click script to build a native Android APK (v1.1.0+).

- **Prerequisites**:
  - Node.js (LTS)
  - Java JDK (17 or higher)
  - Android SDK (configured in environment)
- **How to Build**:
  1.  Open the project folder in a terminal.
  2.  Run `build_apk.bat`.
  3.  Follow the on-screen instructions. The script will check your environment, install dependencies, build the web app, and compile the APK.
- **Output**: The APK will be generated at `android/app/build/outputs/apk/debug/app-debug.apk`.

### 8. Path Mode (Learning)

- **Access**: Click the "Path Mode" button in the top-left toolbar.
- **Features**:
  - **Domain Learning**: Topological ordering of a specific topic cluster (Mastery).
  - **Diffusion Learning**: Find the shortest path to a target concept (Efficiency).
- **Controls**:
  - **Strategy**: Choose between "Foundational" (Base concepts first) or "Core" (Key concepts first).
  - **Layout**: Switch between Radial, Vertical Tree, and Horizontal Tree views.
  - **Exit**: Click "Exit" to return to the main graph.
- **Desktop Mode**: In the desktop application (Tauri), Path Mode opens in a high-performance native 3D window (Godot) for rendering up to 50,000 nodes smoothly, automatically syncing via WebSocket.

---

## Chinese Document

### 1. 简介

NoteConnection 是一个可视化工具，可将您的 Markdown 笔记转换为层级知识图谱。它通过识别先决条件、学习路径和聚类，帮助您理解知识库的结构。

### 2. 快速开始

1.  **选择数据源**: 打开应用程序后，使用左上角的下拉菜单从 `Knowledge_Base` 中选择一个文件夹。
2.  **加载图谱**: 点击“Load”按钮。对于大数据集，系统将使用并行处理来高效构建图谱。
3.  **探索**: 图谱将在主视图中渲染。您可以使用鼠标或触摸手势进行平移和缩放。

### 3. 核心功能

#### 3.1 布局模式

- **力导向 (Force-Directed)**: 默认模式。适合查看聚类和分组。
- **DAG (有向无环图)**: 层级模式。根据依赖关系排列笔记（上 -> 下）。适用于查看学习路径。

#### 3.2 专注模式 (Focus Mode)

- **进入**: 双击任意节点进入专注模式。
- **视图**: 选中的节点移动到中心。
  - **帮助理解 (左/下)**: 先决条件和入度连接。
  - **进一步探索 (右/上)**: 后续步骤和出度连接。
- **控制**: 使用底部的滑块调整垂直和水平间距。
- **打开内容**: 点击“打开具体内容”按钮以阅读节点的全文。
- **退出**: 点击“退出专注”按钮或双击背景。
- **注意**: “冻结布局”允许您在此模式下手动排列节点，而不会自动弹回。

#### 3.3 节点检查

- **悬停 (PC)**: 悬停在节点上以查看其连接和详情。
- **点击 (移动端/PC)**: 点击节点以“冻结”它并打开**统计弹窗**。
  - **弹窗**: 显示入度 (红色) 和出度 (蓝色) 列表。您可以拖动和缩放此弹窗。
  - **操作**: 点击列表中的任意邻居以导航到该节点。

#### 3.4 模拟控制

- **面板**: 位于右侧。
- **冻结布局**: 选中此项以停止所有移动。适用于大图或手动排列。
  - **快速按钮**: 使用工具栏中的雪花图标 (❄️) 进行快速切换。
- **速度/阻尼**: 调整滑块以控制图谱稳定的速度。

### 4. 分析面板

- **访问**: 向下滚动或点击“Analysis”以查看数据表。
- **交互**: 点击表格中的行会在图谱中高亮显示相应的节点。
- **移动端**: 面板支持全屏模式和捏合缩放，以获得更好的可读性。

### 5. 设置

- **访问**: 点击齿轮图标。
- **选项**:
  - **语言**: 在英语和中文之间切换。
  - **物理**: 调整重力和排斥力。
  - **性能**:
    - **启用 GPU 加速**: 切换用于加速矩阵运算（如余弦相似度）的 GPU 使用。推荐用于 AMD Radeon 7900XT 或兼容 GPU。
    - **最大 Worker 数**: 调整用于并行处理的 CPU 线程数（默认：CPU 核心数 - 1）。较高的值可加快大型构建速度，但会占用更多内存。
    - **省内存模式 (Memory Saving Mode)**: (v0.9.63) 启用以优化大数据集（10k+ 文件）的后端内存使用。通过流式传输文件内容和高效序列化数据来降低峰值堆内存。默认：已启用。
  - **视觉**: 调整边透明度。

### 6. 性能特性 (自动优化)

- **Canvas 自动切换**: 如果您的图谱包含超过 3000 个节点，NoteConnection 会自动切换到 **Canvas 渲染器**以确保流畅的性能。如有需要，您可以在控件中手动切回 SVG。
- **物理剔除**: 对于极其密集的图谱（>20,000 条边），物理模拟将仅计算边的一个子集的力，以防止界面冻结，同时仍渲染所有连接。

### 7. 移动应用构建 (Mobile App Build)

NoteConnection 包含一个一键式脚本，用于构建原生 Android APK (v1.1.0+)。

- **先决条件**:
  - Node.js (LTS)
  - Java JDK (17 或更高版本)
  - Android SDK (已在环境中配置)
- **如何构建**:
  1.  在终端中打开项目文件夹。
  2.  运行 `build_apk.bat`。
  3.  按照屏幕上的指示操作。脚本将检查您的环境，安装依赖项，构建 Web 应用程序，并编译 APK。
- **输出**: APK 将生成于 `android/app/build/outputs/apk/debug/app-debug.apk`。

### 8. 路径模式 (Path Mode)

- **访问**: 点击左上角工具栏中的“Path Mode”按钮。
- **功能**:
  - **领域学习**: 特定主题集群的拓扑排序（掌握模式）。
  - **扩散学习**: 寻找通往目标概念的最短路径（效率模式）。
- **控制**:
  - **策略**: 选择“基础优先”(Foundational) 或“核心优先”(Core)。
  - **布局**: 在径向 (Radial)、垂直树 (Vertical Tree) 和水平树 (Horizontal Tree) 视图之间切换。
  - **退出**: 点击“Exit”返回主图谱。
- **桌面模式**: 在桌面端应用程序 (Tauri) 中，路径模式会在高性能原生 3D 窗口 (Godot) 中打开，可流畅渲染多达 50,000 个节点，并通过 WebSocket 自动同步。
