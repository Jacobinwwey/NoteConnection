import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

describe('path core bundle contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(repoRoot, '.tmp-pathcore-'));
  });

  afterEach(() => {
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('bundle keeps the frontend path-mode overlay behavior', () => {
    const { bundlePathCore } = require(path.join(repoRoot, 'scripts', 'bundle_path_core.js')) as {
      bundlePathCore: (options?: { destOverride?: string }) => string | null;
    };

    const dest = path.join(tempDir, 'path_core.js');
    const bundleResult = bundlePathCore({ destOverride: dest });
    expect(bundleResult).toBe(dest);

    const source = fs.readFileSync(dest, 'utf8');
    const storage = new Map<string, string>();
    const context: Record<string, unknown> = {
      console,
      self: {},
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        }
      },
      Set,
      Map,
      JSON,
      Math
    };

    vm.runInNewContext(source, context);

    const runtime = context.self as Record<string, any>;
    expect(typeof runtime.Graph).toBe('function');
    expect(typeof runtime.PathEngine).toBe('function');
    expect(typeof runtime.OrbitalState).toBe('function');

    const graph = new runtime.Graph();
    ['A', 'B', 'C', 'D'].forEach((id) => {
      graph.addNode({ id, label: id, inDegree: 0, outDegree: 0 });
    });
    graph.addEdge('A', 'B');
    graph.addEdge('A', 'C');
    graph.addEdge('B', 'D');
    graph.addEdge('C', 'D');

    const engine = new runtime.PathEngine(graph);
    const withoutExpansion = engine.diffusionLearning('D', 'foundational', new Set(['A']), new Set());
    const targetWithout = withoutExpansion.nodes.find((node: any) => node.id === 'D');
    expect(targetWithout).toBeDefined();
    expect(targetWithout.hasHiddenPrereqs).toBe(true);

    const withExpansion = engine.diffusionLearning('D', 'foundational', new Set(['A']), new Set(['D']));
    expect(withExpansion.nodes.map((node: any) => node.id)).toEqual(expect.arrayContaining(['B', 'C', 'D']));
    const targetWith = withExpansion.nodes.find((node: any) => node.id === 'D');
    expect(targetWith).toBeDefined();
    expect(targetWith.hasHiddenPrereqs).not.toBe(true);
  });
});
