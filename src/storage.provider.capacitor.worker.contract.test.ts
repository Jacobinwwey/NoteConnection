import * as fs from 'fs';
import * as path from 'path';

describe('storage provider capacitor worker build contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const storageProviderPath = path.join(repoRoot, 'src', 'frontend', 'storage_provider.js');

  test('defines worker support detection and strict timeout fallback safeguards', () => {
    const source = fs.readFileSync(storageProviderPath, 'utf8');
    expect(source).toContain('function getRuntimeUrlApi()');
    expect(source).toContain('function supportsCapacitorGraphBuildWorker()');
    expect(source).toContain('function runCapacitorGraphBuildWorker(files)');
    expect(source).toContain('CAPACITOR_GRAPH_BUILD_WORKER_TIMEOUT_MS');
    expect(source).toContain('worker.terminate()');
    expect(source).toContain('revokeObjectURL');
    expect(source).toContain('Capacitor worker build timed out');
    expect(source).toContain('Falling back to single-thread mode.');
  });

  test('tracks worker/single-thread build mode in capacitor build stats', () => {
    const source = fs.readFileSync(storageProviderPath, 'utf8');
    expect(source).toContain('async function buildCapacitorGraphDataWithWorkerFallback(files)');
    expect(source).toContain('function resolveCapacitorBuildModeDetail(buildMode, runtimeCaps)');
    expect(source).toContain("buildMode: 'single-thread'");
    expect(source).toContain("buildMode: 'worker'");
    expect(source).toContain("buildMode: 'single-thread-fallback'");
    expect(source).toContain("'worker-wasm-ready'");
    expect(source).toContain('worker-wasm-not-ready:${mobileWasmReason}');
    expect(source).toContain('buildMode: buildResult.buildMode');
    expect(source).toContain('buildModeDetail: resolveCapacitorBuildModeDetail(buildResult.buildMode, runtimeCaps || {})');
  });
});
