# NoteConnection Knowledge Graph

## How to Load Knowledge Base (CLI)

You can load a knowledge base and build the graph directly from the command line without using the UI. This is useful for automated builds or headless environments.

### Usage

```bash
npm start -- --path "<path_to_knowledge_base>" [options]
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--path` | Absolute path to the folder containing your Markdown files. | `Knowledge_Base` |
| `--gpu` | Enable AMDGPU/WebGL acceleration for layout and vector calculations. | `true` (if hardware supported) |
| `--no-gpu` | Disable GPU acceleration (Force CPU). | `false` |
| `--static` | Enable Static Mode (Backend calculation only, frozen frontend). | `false` |
| `--workers` | Number of worker threads to use. | `numCPUs - 1` |

### Example

```bash
# Basic Load
npm start -- --path "C:/Users/MyName/Documents/MyNotes"

# GPU Accelerated Build
npm start -- --path "E:/Knowledge/ObsidianVault" --gpu

# Force CPU (if GPU has issues)
npm start -- --path "E:/Knowledge/ObsidianVault" --no-gpu
```

## Hardware & Driver Requirements (AMDGPU)

For optimal performance with "GPU Optimised Rendering", especially on AMD RDNA cards (like RX 7900XT):

1.  **Drivers**: Ensure you have the latest **AMD Adrenalin Edition** drivers installed.
2.  **Node.js**: The project uses `gpu.js` which relies on `headless-gl` for Node.js context.
    *   On Windows, this usually works out of the box with standard build tools (`windows-build-tools`).
    *   If you encounter `gl` errors, ensure Python and C++ compilers are available.

## Changelog

### v0.9.71 (2026-01-10)
-   **Backend Parallel Layout**: Accelerated front-end loading by pre-calculating node positions on the backend using worker threads or GPU.
-   **GPU Optimised Rendering**: Added support for AMDGPU acceleration in backend layout and frontend rendering options.
-   **Static Mode**: Added a "Static" toggle for massive graphs (>5000 nodes). When enabled, the simulation runs for 2 seconds to untangle, then freezes to save resources.