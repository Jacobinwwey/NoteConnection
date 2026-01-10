# Test Report

## 2026-01-10 v0.9.71 - Backend Layout & Static Mode

### Test Environment
- **OS**: Windows 10
- **Hardware**: AMD Radeon RX 7900XT, Ryzen 9 7950X
- **Node Version**: v20.x

### Functional Tests

#### 1. Backend Parallel Layout
- **Goal**: Verify backend calculates positions.
- **Procedure**: Run `npm start`. Check `graph_data.json` for `x` and `y` coordinates.
- **Result**: `PASS`. `x` and `y` fields are present in the JSON output.

#### 2. GPU Acceleration (AMDGPU)
- **Goal**: Verify GPU kernel execution for layout.
- **Procedure**: Run `npm start -- --gpu`. Monitor GPU usage.
- **Result**: `PASS`. GPU utilization spike observed during "GPU Layout Calculation" phase. Logs confirm `[LayoutEngine] Using LayoutGPU`.

#### 3. Static Mode (Frontend)
- **Goal**: Verify simulation stops after 2 seconds.
- **Procedure**: Load a graph with >5000 nodes.
- **Result**: `PASS`. "Static Mode" checkbox is checked by default. Simulation runs for ~2s then log shows "Stopping simulation". Nodes remain fixed.

#### 4. CLI Arguments
- **Goal**: Verify loading custom path.
- **Procedure**: `npm start -- --path "./test_data"`.
- **Result**: `PASS`. Graph built from specified folder.
