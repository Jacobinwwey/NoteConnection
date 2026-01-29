# Path Mode Architecture & Development Documentation

## Task Overview

Document and expand the Path Mode architecture for the NoteConnection project, enabling hybrid visualization with Godot desktop rendering and web fallback.

---

## Phase 1-3: Complete (Architecture & Basic Godot)

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
- [ ] Add tree-view learning path panel
- [ ] Add settings button and panel

## Phase 4: HTML5 Embed Integration (Pending)

- [ ] Configure Godot HTML5 export with GPU support
- [ ] Create embed container in Electron frontend
- [ ] Integrate WebSocket communication inside Electron
- [ ] Test single-window workflow
