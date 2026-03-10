import * as fs from 'fs';
import * as path from 'path';

describe('wasm parity runtime contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const wasmRuntimePath = path.join(repoRoot, 'src', 'backend', 'algorithms', 'WasmParityRuntime.ts');
  const layoutEnginePath = path.join(repoRoot, 'src', 'backend', 'algorithms', 'LayoutEngine.ts');
  const graphMetricsPath = path.join(repoRoot, 'src', 'backend', 'GraphMetrics.ts');
  const cycleDetectionPath = path.join(repoRoot, 'src', 'backend', 'algorithms', 'CycleDetection.ts');
  const topologicalSortPath = path.join(repoRoot, 'src', 'backend', 'algorithms', 'TopologicalSort.ts');
  const graphBuilderPath = path.join(repoRoot, 'src', 'backend', 'GraphBuilder.ts');

  test('defines runtime capability and artifact resolution primitives', () => {
    const source = fs.readFileSync(wasmRuntimePath, 'utf8');
    expect(source).toContain('class WasmParityRuntime');
    expect(source).toContain('static isEnabled()');
    expect(source).toContain('NOTE_CONNECTION_ENABLE_WASM_PARITY');
    expect(source).toContain('static resolveArtifactPath()');
    expect(source).toContain('NOTE_CONNECTION_WASM_PATH');
    expect(source).toContain('noteconnection_compute.wasm');
  });

  test('exposes layout, betweenness, cycle, and rank wasm parity entrypoints with deterministic fallback', () => {
    const source = fs.readFileSync(wasmRuntimePath, 'utf8');
    expect(source).toContain('static async computeLayout(');
    expect(source).toContain('static async computeBetweenness(');
    expect(source).toContain('static async computeCycles(');
    expect(source).toContain('static async computeRanks(');
    expect(source).toContain("return null;");
    expect(source).toContain('Failed to load wasm artifact');
  });

  test('wires wasm parity runtime into layout, graph metrics, cycle detection, topological sort, and GraphBuilder orchestration paths', () => {
    const layoutSource = fs.readFileSync(layoutEnginePath, 'utf8');
    const metricsSource = fs.readFileSync(graphMetricsPath, 'utf8');
    const cycleSource = fs.readFileSync(cycleDetectionPath, 'utf8');
    const topologicalSource = fs.readFileSync(topologicalSortPath, 'utf8');
    const builderSource = fs.readFileSync(graphBuilderPath, 'utf8');
    expect(layoutSource).toContain("import { WasmParityRuntime } from './WasmParityRuntime';");
    expect(layoutSource).toContain('WasmParityRuntime.computeLayout(');
    expect(layoutSource).toContain('WASM parity layout failed. Falling back to Worker.');
    expect(metricsSource).toContain("import { WasmParityRuntime } from './algorithms/WasmParityRuntime';");
    expect(metricsSource).toContain('WasmParityRuntime.computeBetweenness(allNodeIds, adj)');
    expect(metricsSource).toContain('WASM parity betweenness failed. Falling back to worker/sequential.');
    expect(cycleSource).toContain("import { WasmParityRuntime } from './WasmParityRuntime';");
    expect(cycleSource).toContain('static async detectCyclesAsync(');
    expect(cycleSource).toContain('WasmParityRuntime.computeCycles(nodeIds, adjacency, normalizedLimit)');
    expect(topologicalSource).toContain("import { WasmParityRuntime } from './WasmParityRuntime';");
    expect(topologicalSource).toContain('static async assignRanksAsync(');
    expect(topologicalSource).toContain('WasmParityRuntime.computeRanks(nodeIds, adjacency, inDegrees)');
    expect(builderSource).toContain('await CycleDetector.detectCyclesAsync(graph, cycleLimit);');
    expect(builderSource).toContain('await TopologicalSort.assignRanksAsync(graph);');
  });
});
