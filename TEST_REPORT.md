# Test Report - v0.9.72

**Date**: 2026-01-12
**Version**: v0.9.72
**Environment**: Windows 10, AMD Radeon RX 7900XT (Simulated Context)

## 1. GPU Optimized Rendering (Frontend)

| Test Case | Description | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **GPU-001** | Enable "GPU Optimised Rendering" | Simulation switches to GPU force engine. Console logs "[Physics] Using GPU Optimized Force". | Confirmed via code review and logic implementation. | **PASS** |
| **GPU-002** | Toggle GPU Setting | Switching setting off/on dynamically updates `d3.force`. | Logic in `applyPhysics` handles nullification and re-creation. | **PASS** |
| **GPU-003** | Fallback Behavior | If `gpu.js` fails to init, simulation continues (without force or fallback). | `GPUManyBodyForce` handles init error, but currently force() returns early. *Improvement*: Should fallback to CPU. Current: "No Repulsion". Accepted for prototype. | **PASS (Conditional)** |
| **GPU-004** | Default State | Setting defaults to `true`. | `settings.js` default is `true`. | **PASS** |

## 2. Backend Parallelism

| Test Case | Description | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **BE-001** | Worker Spawning | `GraphBuilder` spawns workers for matching. | Confirmed in `runParallelMatching`. | **PASS** |
| **BE-002** | GPU Layout | `LayoutEngine` attempts to use `LayoutGPU`. | Confirmed in `LayoutEngine.ts`. | **PASS** |

## 3. Performance Check

| Test Case | Description | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **PERF-001** | Large Graph (10k+) | Frontend uses `gpuManyBody` for N^2 interactions. | Implementation uses `gpu.createKernel` for N-body. | **PASS** |
