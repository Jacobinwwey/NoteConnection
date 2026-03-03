import * as fs from 'fs';
import * as path from 'path';

describe('source manager load-flow guards', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const sourceManagerPath = path.join(repoRoot, 'src', 'frontend', 'source_manager.js');

  test('prevents duplicate event binding for load button', () => {
    const source = fs.readFileSync(sourceManagerPath, 'utf8');
    expect(source).toContain("if (loadBtn.dataset.sourceManagerBound === '1')");
    expect(source).toContain("loadBtn.dataset.sourceManagerBound = '1';");
  });

  test('keeps single-load in-progress guard and safe reload gate', () => {
    const source = fs.readFileSync(sourceManagerPath, 'utf8');
    expect(source).toContain('let isLoadInProgress = false;');
    expect(source).toContain('if (isLoadInProgress)');
    expect(source).toContain("isLoadInProgress = true;");
    expect(source).toContain('const requestSafeReload = (reason) => {');
    expect(source).toContain("sessionStorage.setItem(RELOAD_GUARD_KEY");
  });

  test('uses a single cache-choice prompt path before restore/build branch', () => {
    const source = fs.readFileSync(sourceManagerPath, 'utf8');
    const promptMatches = source.match(/choice\s*=\s*await\s*askCacheAction\s*\(/g) || [];
    expect(promptMatches.length).toBe(1);
    expect(source).toContain("if (choice === 'load')");
    expect(source).toContain("keepLockedForReload = requestSafeReload('cache-restore');");
    expect(source).toContain("invoke('build_graph_runtime'");
  });

  test('shows explicit runtime capability boundary note for cache/read-only mobile mode', () => {
    const source = fs.readFileSync(sourceManagerPath, 'utf8');
    expect(source).toContain("runtime-capability-note");
    expect(source).toContain("runtimeCaps.supports_build === false");
    expect(source).toContain("Mobile runtime is cache/read mode (local build is unavailable).");
  });

  test('keeps explicit sidecar-first build route with tauri-native fallback route', () => {
    const source = fs.readFileSync(sourceManagerPath, 'utf8');
    expect(source).toContain('if (runtimeCaps.supports_sidecar) {');
    expect(source).toContain("fetch('http://localhost:3000/api/build'");
    expect(source).toContain('} else if (window.__TAURI__) {');
    expect(source).toContain('const result = await buildGraphViaRust(buildPayload);');
  });
});
