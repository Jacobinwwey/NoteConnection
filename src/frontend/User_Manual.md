# NoteConnection User Manual

**Version:** v1.5.13 | **Last Updated:** 2026-03-04

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [Core Features](#3-core-features)
4. [Settings & Customization](#4-settings--customization)
5. [Performance Features](#5-performance-features)
6. [Keyboard Shortcuts](#6-keyboard-shortcuts)
7. [Troubleshooting](#7-troubleshooting)
8. [Advanced Tips](#8-advanced-tips)

---

## 1. Introduction

**NoteConnection** is a powerful knowledge graph visualization tool that transforms your Markdown notes into an interactive, hierarchical network. By analyzing the relationships between your notes, it helps you:

- **Discover connections** between concepts you didn't know existed
- **Identify learning paths** by understanding prerequisite relationships
- **Find knowledge clusters** to see thematic groupings
- **Navigate efficiently** through large collections of notes (10k+ files supported)

### Key Benefits

- **Offline-First**: Works completely offline once built
- **GPU-Accelerated**: Optional AMD GPU support for massive graphs
- **Multi-Language**: Full support for English and Chinese (中文)
- **Cross-Platform**: Windows, macOS, and Linux support

---

## 2. Getting Started

### 2.1 First Launch

When you first open NoteConnection:

1. **Language Selection** will appear automatically
   - Choose **English** or **中文 (Chinese)**
   - Your choice is saved and can be changed later in Settings

2. **Knowledge Base Setup**
   - Click **File** → **Change Knowledge Base**
   - Select the folder containing your Markdown files
   - This becomes your active knowledge base

3. **Load Your First Graph**
   - Use the dropdown menu at the top-left
   - Select **"All Folders"** to analyze everything
   - Click the **"Load"** button
   - Wait for the analysis to complete (shows progress for large datasets)

### 2.2 Interactive Tutorial

For new users, we recommend running the **Interactive Tutorial**:

- Access via **Help** → **Launch Tutorial**
- 6-step guided walkthrough of key features
- Can be skipped or restarted anytime

---

## 3. Core Features

### 3.1 Layout Modes

#### Force-Directed Layout (Default)

- **Best for:** Seeing natural clusters and groupings
- **How it works:** Nodes push apart while edges pull them together
- **Use case:** Exploring general structure

#### DAG (Directed Acyclic Graph) Layout

- **Best for:** Understanding learning paths
- **How it works:** Arranges notes hierarchically (Top → Bottom)
- **Use case:** Finding prerequisites and dependencies

**Switch layouts:** Use the "Layout" dropdown in the right panel

### 3.2 Focus Mode

**Enter Focus Mode** by double-clicking any node.

#### Layout Orientation

- **Horizontal (Default)**: Node in center, incoming left, outgoing right
- **Vertical**: Node in center, incoming bottom, outgoing top

#### Interactive Controls

- **Layer-Space Slider**: Adjust distance between incoming/outgoing layers
- **Node-Space Slider**: Adjust spacing between nodes in same layer
- **RESET Button**: Returns to default spacing
- **Layout Dropdown**: Switch between Horizontal/Vertical orientations

#### Reading Content

- Click **"Specific Content"** button to open the full note
- Content opens in a reading window with:
  - Markdown rendering
  - LaTeX math support
  - Mermaid diagram support
  - Zoom controls (A+ / A-)
  - Fullscreen mode

#### Exit Focus Mode

- Click **"Exit Focus Mode"** button
- Or double-click on the background

**Pro Tip:** Enable "Freeze Layout" before entering Focus Mode to manually position nodes without them moving.

### 3.3 Node Inspection

#### Hover (Desktop)

- Move mouse over a node to see:
  - Node name
  - Degree information (In/Out/Total)
  - Preview of connections

#### Click (All Platforms)

- Click a node to open the **Statistics Popup**
- Popup shows:
  - **In-degree (Red)**: Notes that reference this one
  - **Out-degree (Blue)**: Notes this one references
- **Popup controls:**
  - **Drag** to reposition
  - **+/-** to zoom in/out
  - **⟲** to reset size
  - **×** to close

### 3.4 Simulation Controls

Located in the **right panel**:

#### Freeze Layout

- **Checkbox** or **❄️ Icon** (quick toggle)
- Stops all node movement
- Essential for large graphs (>3000 nodes)
- Allows manual drag-and-drop positioning

#### Speed / Damping Slider

- Controls how quickly the simulation stabilizes
- **Lower values** (0.85): Nodes bounce more, takes longer to settle
- **Higher values** (0.99): Nodes settle quickly, less movement

#### Min Degree Filter

- Hide nodes with degrees below the threshold
- Useful for focusing on highly-connected concepts

#### Show Orphans

- Toggle visibility of nodes with zero connections
- Helpful when cleaning up your knowledge base

### 3.5 Visual Customization

#### Color Modes

- **By Degree**: Warmer colors = higher degree
- **By Cluster**: Each cluster gets a unique color

#### Size Modes

- **Uniform**: All nodes same size
- **By Degree**: Larger nodes = higher degree
- **By Centrality**: Larger nodes = more central to network

#### Renderer

- **SVG**: Better quality, slower for >3000 nodes
- **Canvas**: Better performance, auto-activated for large graphs

#### Edge Opacity

- Adjust the transparency of connections
- Lower opacity helps with dense graphs

---

## 4. Settings & Customization

Access settings by clicking the **⚙️ Gear Icon** in the top-right.

### 4.1 General

#### Language

- **English** or **中文 (Chinese)**
- Instantly updates all UI elements
- Affects: menus, dialogs, tutorial, documentation

### 4.2 Physics

Fine-tune the force simulation:

#### Repulsion Strength

- Default: -300
- Range: -1000 to -50
- Higher (closer to 0) = nodes closer together

#### Link Distance

- Default: 200
- Range: 20 to 900
- Higher = more space between connected nodes

#### Collision Radius

- Default: 30
- Range: 5 to 100
- Prevents nodes from overlapping

### 4.3 Performance

#### Max Workers (Memory)

- Default: CPU cores - 1
- Range: 1 to 128
- **Higher** = Faster builds, more RAM usage
- **Lower this if** you get "Out of Memory" errors

#### Enable GPU Acceleration

**What it does:** Accelerates similarity calculations (cosine similarity) using GPU.js library via WebGL

**Compatible Hardware:**

- **Highly Recommended:** AMD Radeon RX 6000/7000 series (RDNA 2/3)
- **Also Compatible:** NVIDIA GeForce RTX/GTX series (with updated drivers)
- **Works on:** Intel Iris Xe, Arc series
- **Minimum:** Any GPU with WebGL 2.0 support
- **Note:** Integrated GPUs (Intel UHD, AMD Vega) work but offer minimal speedup

**Software Requirements:**

- **Driver:** Latest GPU drivers (AMD Adrenalin 23.x+, NVIDIA 530+, Intel 31.x+)
- **Browser:** Chromium-based (Electron), Chrome 100+, or Edge 100+
- **WebGL:** WebGL 2.0 support required (check: `about:gpu` in Chrome)

**How to Enable:**

1. Ensure GPU drivers are up-to-date
2. Open Settings (⚙️) → Performance
3. Check "Enable GPU Acceleration"
4. Click "Done" and **reload the page** (Ctrl+R)
5. Check console for "GPU.js initialized" message

**Performance Impact:**

- **Sweet spot:** 2000-10000 nodes (2-5x speedup)
- **Not recommended:** <500 nodes (CPU faster due to overhead)
- **Diminishing returns:** >15000 nodes (memory bandwidth limits)

**Requires page reload** to reinitialize GPU.js kernel

#### Large File Memory Saving Strategy

- **Default:** ON
- Streams file content instead of loading all into RAM
- Essential for >10,000 files
- Reduces peak heap usage by 60-80%

#### Compact Mode (Hide Edges)

- **Enabled for:** Graphs with >5000 nodes
- Doesn't render edges by default
- Massive performance improvement on large datasets
- Can force-load edges via a button

#### Static Mode

- Stops simulation immediately after graph builds
- Recommended for large graphs (>20k nodes)
- Nodes won't move at all

#### GPU Layout Optimization (Beta)

- **Experimental feature**
- Offloads force calculations to GPU
- **Only beneficial** for >2000 nodes
- May be slower on graphs <2000 nodes

#### Deep Debug Mode

- Enables verbose logging during build
- Useful for troubleshooting or development
- Shows timing for each analysis phase

### 4.4 Visuals

#### Edge Opacity

- Default: 0.6
- Range: 0.1 to 1.0
- Lower values help with cluttered graphs

### 4.5 Reading

#### Open Mode

- **Window**: Opens notes in a floating window
- **Fullscreen**: Opens notes overlaying entire graph

---

## 5. Performance Features

NoteConnection includes intelligent auto-optimizations:

### 5.1 Canvas Auto-Switch

- Automatically switches to **Canvas Renderer** when graph exceeds 3000 nodes
- Maintains smooth 60fps performance
- Can manually revert to SVG in settings

### 5.2 Physics Culling

- For graphs with >20,000 edges
- Only calculates forces for a subset of edges
- Prevents UI freezing
- All edges still render visually

### 5.3 Web Worker Offloading

- Force simulation runs in a separate thread
- Frontend remains responsive during layout calculations
- Progress is shown via status indicators

### 5.4 Memory Optimization (v0.9.63+)

- Worker threads receive file **paths** instead of full content
- On-demand file reading reduces inter-thread data cloning
- Resource reuse for statistics matrices
- Heap usage reduced by up to 70% on 10k+ file datasets

---

## 6. Keyboard Shortcuts

| Shortcut                      | Action                  |
| ----------------------------- | ----------------------- |
| **Ctrl/Cmd + O**              | Change Knowledge Base   |
| **Mouse Wheel**               | Zoom In/Out             |
| **Click + Drag (Background)** | Pan View                |
| **Click + Drag (Node)**       | Move Node (when frozen) |
| **Double-Click (Node)**       | Enter Focus Mode        |
| **Double-Click (Background)** | Exit Focus Mode         |
| **Esc**                       | Close Dialogs/Modals    |

---

## 7. Troubleshooting

### 7.1 Graph Won't Load

**Symptoms:** Clicking "Load" does nothing or shows error

**Solutions:**

1. Check that your Knowledge Base folder contains `.md` files
2. Verify folder path is correct (**File** → **Change Knowledge Base**)
3. Check console for errors (F12 → Console tab)
4. Try selecting a specific subfolder instead of "All Folders"

### 7.2 Out of Memory Errors

**Symptoms:** Build fails with "JavaScript heap out of memory"

**Solutions:**

1. **Reduce Max Workers** in Settings (try 2-4)
2. **Enable "Large File Memory Saving Strategy"**
3. **Enable "Static Mode"** (disables continuous simulation)
4. Build smaller subsets of your knowledge base
5. For Electron: Increase heap with `--max-old-space-size=8192`

### 7.3 Slow Performance / Lag

**Symptoms:** Graph is choppy or unresponsive

**Solutions:**

1. **Renderer:** Switch to Canvas for large graphs
2. **Freeze Layout:** Enable to stop physics simulation
3. **Compact Mode:** Enable for >5k nodes (hides edges)
4. **Min Degree:** Increase filter to hide low-degree nodes
5. **Edge Opacity:** Lower to 0.2-0.4 for dense graphs

### 7.4 Nodes Keep Moving

**Symptoms:** Can't arrange nodes manually

**Solutions:**

1. Click the **❄️ Freeze Layout** button
2. Or enable "Freeze Layout" checkbox in right panel
3. For permanent: Enable "Static Mode" in settings

### 7.5 Language Not Changing

**Symptoms:** UI still shows wrong language after changing setting

**Solutions:**

1. Ensure you clicked **"Done"** in Settings modal
2. Try reloading the page (Ctrl/Cmd + R)
3. Check `localStorage.user_language` in console
4. Clear browser cache if using web version

### 7.6 Tutorial Won't Start

**Symptoms:** "Launch Tutorial" does nothing

**Solutions:**

1. Ensure graph is loaded (tutorial needs nodes)
2. Check that tutorial hasn't been marked completed
3. Reset via: `localStorage.removeItem('tutorial_completed')`
4. Reload the page

---

## 8. Advanced Tips

### 8.1 Optimizing Large Knowledge Bases

For >5000 notes:

1. Enable **Memory Saving Mode** + **Static Mode**
2. Use **Canvas Renderer**
3. Enable **Compact Mode** (hide edges by default)
4. Set **Max Workers** to 4-6 (balance speed vs memory)
5. Consider building subsets and combining manually

### 8.2 Finding Learning Paths

1. Switch to **DAG Layout**
2. Click a target concept (e.g., "Advanced Topic")
3. **Follow the vertical path downwards** to see prerequisites
4. Enter **Focus Mode** to isolate the path

### 8.3 Identifying Hub Nodes

1. Use **Size By: Degree** or **Centrality**
2. Sort analysis table by **Total** column
3. Hub nodes = highest degree values
4. Color by **Cluster** to see if hubs connect clusters

### 8.4 Exporting Subsets

1. Open **Analysis & Export** panel
2. Choose filter strategy:
   - **Top X%**: Get top-degree nodes
   - **Min Degree > X**: Get nodes above threshold
3. Select cluster (optional)
4. Export as:
   - **JSON**: Import into other tools
   - **ZIP (MD)**: Get filtered Markdown files

### 8.5 Custom Styling

For developers: Modify `styles.css` to adjust:

- Node colors (search for `fillColor`)
- Edge styles (search for `.link`)
- Font sizes (search for `font-size`)

### 8.6 GPU Acceleration Best Practices

**Enable GPU Acceleration if:**

- You have a **dedicated GPU** (AMD RX 5000+, NVIDIA GTX 1060+, Intel Arc)
- Graph has **>2000 nodes**
- Build time **>30 seconds** without GPU
- Your GPU supports **WebGL 2.0** (check at `chrome://gpu`)
- You're running the **latest GPU drivers**

**Tested Configurations:**

- ✅ **Excellent:** AMD RX 7900 XT/XTX, RX 6800/6900 series (5-8x speedup)
- ✅ **Very Good:** NVIDIA RTX 3060/3070/4070 (3-5x speedup)
- ✅ **Good:** AMD RX 5700, NVIDIA GTX 1660/1080 Ti (2-3x speedup)
- ⚠️ **Moderate:** Intel Arc A750/A770 (1.5-2x speedup)
- ⚠️ **Minimal:** Integrated GPUs - Intel UHD, AMD Vega (<1.5x speedup)

**Disable GPU Acceleration if:**

- Graph has **<1000 nodes** (CPU faster due to initialization overhead)
- You experience **crashes or freezes** (likely driver issues)
- Build time **increases** (incompatible GPU or outdated drivers)
- You see **WebGL errors** in console (check `about:gpu`)
- Running in **headless mode** or **via SSH** (no GPU access)

**Troubleshooting GPU Issues:**

1. **"GPU.js not found" error:**
   - Check that `libs/gpu-browser.min.js` exists
   - Ensure Content Security Policy allows script execution
   - Reload the application

2. **"WebGL not supported" error:**
   - Update GPU drivers to latest version
   - Enable hardware acceleration in browser flags
   - Check `chrome://gpu` for driver blocklist issues

3. **Build slower with GPU enabled:**
   - Your GPU may be older/slower than CPU
   - Try with a larger dataset (>5000 nodes)
   - Check GPU memory usage (may be hitting limits)

4. **GPU acceleration not working:**
   - Open DevTools Console (F12)
   - Look for "GPU.js initialized" message
   - If missing, check for WebGL 2.0 support
   - Verify setting persists (check Settings → Performance)

**Driver Update Links:**

- AMD: https://www.amd.com/en/support
- NVIDIA: https://www.nvidia.com/Download/index.aspx
- Intel: https://www.intel.com/content/www/us/en/download-center/home.html

---

## Support & Feedback

- **GitHub Issues**: https://github.com/Jacobinwwey/NoteConnection
- **Documentation**: This file (offline) + README.md
- **Tutorial**: Help → Launch Tutorial

**Last Updated:** 2026-03-04 | **Version:** v1.5.13
