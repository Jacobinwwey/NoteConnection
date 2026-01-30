# Path Mode Architecture & Development Documentation

## Task Overview

Document and expand the Path Mode architecture for the NoteConnection project, enabling hybrid visualization with Godot desktop rendering and web fallback.

---

## Phase 1-3: Complete (Architecture & Basic Godot)

## Phase 1: Research & Context Gathering

- [x] Review existing [path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js) (Graph, PathEngine classes)
- [x] Review existing [ws_client.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/ws_client.gd) WebSocket client
- [x] Review existing [path_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/path_renderer.gd) renderer
- [x] Review brainstorming and godot-gdscript-patterns skills
- [x] Analyze TODO.md for Path Mode v2 requirements

## Phase 2: Architecture Documentation

- [x] Create comprehensive Path Mode Architecture Document
- [x] Document Hybrid Visualization Architecture
- [x] Document Domain Learning & Diffusion Learning algorithms
- [x] Document Godot 3D/Pseudo-3D visualization requirements
- [x] Document WebSocket protocol specification

## Phase 3: Godot Implementation (Complete)

- [x] Enhance [path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js) with [getPeripheralNodes()](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#424-510) and [OrbitalState](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#556-680)
- [x] Create [bubble_material.gdshader](file:///e:/Knowledge_project/NoteConnection_app/path_mode/shaders/bubble_material.gdshader) (iridescent bubble effect)
- [x] Create [learning_state_machine.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/learning_state_machine.gd) (state machine)
- [x] Create [path_renderer.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/path_renderer.gd) (3D orbital renderer)
- [x] Create [main.tscn](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scenes/main.tscn) (Godot main scene)
- [x] Update [ws_client.gd](file:///e:/Knowledge_project/NoteConnection_app/path_mode/scripts/ws_client.gd) (new message handlers)
- [x] Fix dark background and floor
- [x] Add collision detection for bubble interactivity

## Phase 3.5: Godot Interactivity Fixes (In Progress)

- [x] Add camera zoom/pan/rotate controls (`orbital_camera.gd`)
- [x] Fix orbital transition animation (central bubble position reset)
- [x] Implement openReader IPC (PathBridge → Electron renderer)
- [x] Enforce node limit (1 Central + Max 4 Peripherals)
- [x] Fix double-click open editor (Threshold + Window Focus)
- [x] Fix Reader content loading (Metadata lookup)
- [x] Improve Camera controls (Left-Drag Orbit + Initial Zoom)
- [x] Fix "Below Base Plate" camera issue (Pitch constraints)
- [x] Fix Central Node Overlap (Strict state reset)
- [x] Fix Color Update on Switch (Force material refresh)
- [x] Refactor Node Switch to "Clear-then-Rebuild" architecture (prevents overlap/color bugs)
- [x] Implement realistic iridescent bubble shader (thin-film interference, Fresnel, specular highlights)
- [x] Connect UI buttons (Mark Complete, Sidebar toggle, completed nodes list)
- [x] Fix ambient lighting (reduced wash-out, iridescent colors visible)
- [x] Fix "X of 0" progress display (send totalNodes from frontend)
- [x] Add navigation history + Return button (single return + dropdown)
- [x] Add Edit mode for unmark completion
- [x] Add bidirectional Electron sync (completionSync WebSocket)
- [x] Add tree-view learning path panel (dependency tree with ★●○ states)
- [ ] Add settings button and panel

## Phase 4: Enhanced Graphical Tree View (Planned)

- [ ] **Tree View Architecture**
  - [ ] Create `tree_view_panel.tscn` (SubViewport overlay panel)
  - [ ] Create `tree_renderer.gd` (bezier curve drawing in 2D canvas)
  - [ ] Create `tree_styles.gd` (4 selectable visual themes)
  - [ ] Integrate with `path_renderer.gd`

- [ ] **Visual Themes** (4 selectable, colorful as default)
  - [ ] **Colorful Status** (default): Gold=complete, Cyan=current, Gray=pending
  - [ ] **Dark**: Dark background, gradient fills, soft blue/purple curves
  - [ ] **Glass/Frosted**: Semi-transparent nodes, glowing bezier curves
  - [ ] **Minimal Monochrome**: White/gray nodes, thin gray curves

- [ ] **Tree View Modes**
  - [ ] Tab buttons: `[Subtree] [Full Path]`
  - [ ] Dropdown style selector in header
  - [ ] Collapsible drawer panel

- [ ] **Node Interactions**
  - [ ] Single-click: Expand/collapse + show context menu
  - [ ] Double-click: Navigate to node (make central)
  - [ ] Context menu: Navigate / Mark Complete / Unmark

- [ ] **Bezier Curve Rendering**
  - [ ] Draw parent-child connections with bezier curves
  - [ ] Curves inherit parent color (colorful mode)
  - [ ] Anti-aliased polyline rendering

## Phase 5: HTML5 Embed Integration (Pending)

- [ ] Configure Godot HTML5 export with GPU support
- [ ] Create embed container in Electron frontend
- [ ] Integrate WebSocket communication inside Electron
- [ ] Test single-window workflow
