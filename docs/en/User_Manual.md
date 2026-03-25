# 2026-03-24 v1.6.0

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

### 9. v1.6.0 Runtime and NoteMD Behavior

- **Single-window behavior**:
  - In `npm run tauri:dev:mini:gpu`, Tauri is the default visible window.
  - Entering Path Mode switches visibility to the Godot frontend.
  - At any moment, only one primary frontend window should remain visible.
- **Godot close confirmation**:
  - Closing the Godot window should show a confirmation dialog.
  - Users can either return to the main interface or close all windows.
- **NoteMD embedded workflow**:
  - NoteMD is integrated as an embedded workflow in both Tauri and Godot flows (not a standalone desktop app window).
  - File/folder/save browse actions in Tauri are expected to trigger native pickers and return selected paths.
- **PDF import rule**:
  - PDF files must be converted to Markdown with Mineru before importing into NoteMD.

### 10. Local Runtime Config (`app_config.toml`)

- **Purpose**:
  - Persist KB root, language, and multi-window policy in one local TOML file.
- **Default location (Windows)**:
  - `%LOCALAPPDATA%/NoteConnection/app_config.toml`
- **Path overrides**:
  - `NOTE_CONNECTION_CONFIG_PATH` (absolute file path)
  - `NOTE_CONNECTION_CONFIG_DIR` (directory containing `app_config.toml`)
- **Template**:
  - [`docs/examples/app_config.template.toml`](../examples/app_config.template.toml)
- **Detailed guide**:
  - [`docs/en/app_config.toml_guide.md`](app_config.toml_guide.md)

---
