# 2026-03-04 v1.5.13 - Bridge-First Brainstorming Addendum (Tauri Migration)

---

## Session 9: Soap Bubble Physics & Environment Refinements (Current Progress)

**Date**: 2026-03-04

### 1. Current Progress & Accomplishments

- **Shader Conversion**: Successfully ported a complex Shadertoy physically-based soap bubble shader (Glassner's 81-wavelength Thin-Film Interference) into a Godot 4 Spatial Shader (`bubble_material.gdshader`).
- **Physics Integration**: Upgraded the Path Mode bubbles from static `MeshInstance3D` to interactive `RigidBody3D` nodes. Removed the central board obstruction so bubbles can orbit and collide freely.
- **Syntax Fixes**: Resolved Godot 4 specific shader compilation crashes by removing a duplicate built-in `PI` constant and correcting the array literal initialization syntax from `mat3[13](...)` to `{...}`.
- **Transparency Tuning**: The user reported the bubbles were too transparent on monotonous backgrounds. Tuned the base `fresnel` alpha clamping from `[0.01, 0.5]` up to `[0.05, 0.95]`, and increased `rim_opacity`/`center_opacity` defaults.
- **Background System Architecture**: Designed the architecture for importing environmental backgrounds so the bubbles have something to reflect. Documented the strategy in `path_mode/assets/backgrounds/BACKGROUND_SYSTEM.md`, explicitly supporting `.hdr` and `.exr` High Dynamic Range panoramas.

### 2. Previously Inputted Files & Instructions

- **Goal**: Realistic sloshing colorful iridescence without environmental obstructions, with bubbles that don't stick together.
- **Inputted Code Highlights**:
  - `sp_spectral_filter()`: The core interference calculation mapping film thickness to RGB.
  - `warpnoise3()`: 3D noise function used to simulate organic sloshing film thickness.
- **Instructions Executed**:
  - "remove environmental obstructions" -> Disabled static body boards in `main.tscn`.
  - "reduce excessive transparency" -> Clamped ALPHA and pushed `rainbow_saturation`.
  - "does .exr format is ok?" -> Updated documentation to confirm `.exr` is the industry standard for 3D environments.

### 3. Unfinished Tasks & Next Steps

1. **Dynamic Background Implementation**: Write the GDScript logic to actually load the user's `.exr` / `.hdr` panorama files from the `assets/backgrounds` folder into the `WorldEnvironment` at runtime (Phase 2 of BACKGROUND_SYSTEM.md).
2. **Orbit Restitution Tuning**: Fine-tune the `RigidBody3D` physics layers, mass, and continuous collision detection so that as the graph scales (10+ nodes), they orbit fluidly without jittering or overlapping excessively.
3. **Save/Load State**: Ensure that whatever custom `.exr` background the user uploads is saved to their local preferences and restored on launch.

---

## English Document

### Migration Brainstorming Focus

The design direction is now explicitly Bridge-first:

- Keep backend graph intelligence in Node sidecar.
- Move Path Mode controls and interaction orchestration into Godot UI.
- Use PathBridge as the contract layer between Godot and backend runtime.
- Keep browser toolbar behavior for browser mode, but run Godot-only controls in Tauri Path Mode.

### Architecture Principles for Ongoing Changes

1. Keep runtime contracts stable before visual refactors.
2. Prefer deterministic startup sequencing over optimistic reconnect loops.
3. Separate data authority (backend graph/cache state) from presentation authority (Godot rendering state).
4. Preserve dual-platform output strategy (desktop + Android) with parity verification.

### Open Design Questions

- How strict should startup debounce be for websocket reconnection under heavy cold starts?
- Should cache prompt state be controlled entirely backend-side to avoid frontend race windows?
- Should history snapshots include source event metadata (`dblclick`, `manual switch`, `collapse all`) for debugging?

