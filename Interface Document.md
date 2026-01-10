# Interface Document

## 1. System Overview
NoteConnection serves as a bridge between your Markdown notes and a visual knowledge graph.

## 2. CLI Interfaces

### Build Command
**Input:**
- `--path`: String. Path to knowledge base.
- `--gpu`: Boolean (Flag). Enable GPU.
- `--static`: Boolean (Flag). Enable Static Mode.

**Output:**
- `dist/frontend/graph_data.json`: The processed graph data.

## 3. Frontend Settings Interfaces

### Performance Settings
- **GPU Optimised Rendering**:
  - Type: Checkbox
  - Default: `false` (or auto-detected)
  - Effect: Enables `gpu.js` acceleration for layout updates and vector similarity.
- **Static Mode**:
  - Type: Checkbox
  - Default: `true` if Nodes > 5000
  - Effect: Stops simulation after 2 seconds.

### Layout Settings
- **Force Layout**: Standard physics simulation.
- **DAG Layout**: Hierarchical Directed Acyclic Graph layout.