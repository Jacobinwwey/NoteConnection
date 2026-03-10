import * as fs from 'fs';
import * as path from 'path';

describe('wasm parity runtime contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const wasmRuntimePath = path.join(repoRoot, 'src', 'backend', 'algorithms', 'WasmParityRuntime.ts');
  const layoutEnginePath = path.join(repoRoot, 'src', 'backend', 'algorithms', 'LayoutEngine.ts');
  const graphMetricsPath = path.join(repoRoot, 'src', 'backend', 'GraphMetrics.ts');

  test('defines runtime capability and artifact resolution primitives', () => {
    const source = fs.readFileSync(wasmRuntimePath, 'utf8');
    expect(source).toContain('class WasmParityRuntime');
    expect(source).toContain('static isEnabled()');
    expect(source).toContain('NOTE_CONNECTION_ENABLE_WASM_PARITY');
    expect(source).toContain('static resolveArtifactPath()');
    expect(source).toContain('NOTE_CONNECTION_WASM_PATH');
    expect(source).toContain('noteconnection_compute.wasm');
  });

  test('exposes layout and betweenness wasm parity entrypoints with deterministic fallback', () => {
    const source = fs.readFileSync(wasmRuntimePath, 'utf8');
    expect(source).toContain('static async computeLayout(');
    expect(source).toContain('static async computeBetweenness(');
    expect(source).toContain("return null;");
    expect(source).toContain('Failed to load wasm artifact');
  });

  test('wires wasm parity runtime into backend layout and graph metrics heavy compute paths', () => {
    const layoutSource = fs.readFileSync(layoutEnginePath, 'utf8');
    const metricsSource = fs.readFileSync(graphMetricsPath, 'utf8');
    expect(layoutSource).toContain("import { WasmParityRuntime } from './WasmParityRuntime';");
    expect(layoutSource).toContain('WasmParityRuntime.computeLayout(');
    expect(layoutSource).toContain('WASM parity layout failed. Falling back to Worker.');
    expect(metricsSource).toContain("import { WasmParityRuntime } from './algorithms/WasmParityRuntime';");
    expect(metricsSource).toContain('WasmParityRuntime.computeBetweenness(allNodeIds, adj)');
    expect(metricsSource).toContain('WASM parity betweenness failed. Falling back to worker/sequential.');
  });
});

