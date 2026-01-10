# 2025-12-26 v0.9.28

# Project Build Plan: Progressive Hierarchical Knowledge Graph

This document outlines the roadmap for building `NoteConnection`, a system capable of visualizing tens of thousands of knowledge points as a Directed Acyclic Graph (DAG), highlighting hierarchical relationships and learning paths.

---

# 2026-01-10 v0.9.71 - Backend Layout & Static Mode

**Goal**: Optimize performance for massive graphs (50k+ nodes) by offloading layout calculations to backend workers and implementing a static rendering mode.

- [x] **Backend Parallel Layout**
    - [x] **Layout Engine**: Created `LayoutEngine.ts` and `layoutWorker.ts` to run `d3-force` simulation on backend threads.
    - [x] **Integration**: `GraphBuilder` now automatically triggers backend layout calculation for graphs > 100 nodes.
    - [x] **GPU Acceleration**: Implemented `LayoutGPU.ts` using `gpu.js` to accelerate layout on AMDGPU.
    - [x] **Performance**: Reduces frontend initialization time by providing pre-calculated coordinates.

- [x] **Frontend Optimizations**
    - [x] **Static Mode**: Introduced a "Static Mode" toggle.
        - [x] **Auto-Enable**: Automatically enabled for >5000 nodes or >200,000 edges.
        - [x] **Behavior**: Simulation runs for 2 seconds (warm-up) then stops to save CPU.
        - [x] **Layout Switch**: Respects static mode during layout transitions (Force <-> DAG).
    - [x] **GPU Settings**: Added "GPU Optimised Rendering" checkbox to settings to control acceleration flags.

# 2026-01-09 v0.9.70 - Frontend Initialization Fix (Race Condition)
...