import * as fs from 'fs';
import * as path from 'path';

describe('source manager load-flow guards', () => {
  const indexHtmlOrder = (html: string, needle: string): number => html.indexOf(needle);
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
    expect(source).toContain('const requestSafeReload = (reason, options = {}) => {');
    expect(source).toContain("sessionStorage.setItem(RELOAD_GUARD_KEY");
  });

  test('uses a single cache-choice prompt path before restore/build branch', () => {
    const source = fs.readFileSync(sourceManagerPath, 'utf8');
    const promptMatches = source.match(/choice\s*=\s*await\s*askCacheAction\s*\(/g) || [];
    expect(promptMatches.length).toBe(1);
    expect(source).toContain("if (choice === 'load')");
    expect(source).toContain("keepLockedForReload = requestSafeReload('cache-restore', { force: true });");
    expect(source).toContain("requestSafeReload('build-success', { force: true });");
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
    expect(source).toContain("buildSidecarUrl('api/build')");
    expect(source).toContain('} else if (window.__TAURI__) {');
    expect(source).toContain('const result = await buildGraphViaRust(buildPayload);');
  });

  test('waits for sidecar readiness and retries data.js fetch during tauri startup race', () => {
    const source = fs.readFileSync(sourceManagerPath, 'utf8');
    expect(source).toContain('const waitForSidecarReady = async () => {');
    expect(source).toContain('await waitForSidecarReady();');
    expect(source).toContain("data.js fetch raced sidecar startup, retrying");
    expect(source).toContain('const maxAttempts = (window.__TAURI__ && runtimeCaps.supports_sidecar) ? 20 : 1;');
    expect(source).toContain("get_sidecar_runtime_config");
    expect(source).toContain("bootstrapDesktopPathProducer");
    expect(source).toContain("setupEarlyWebSocket({");
  });

  test('uses /api/folders as the canonical source list for KB folder names', () => {
    const source = fs.readFileSync(sourceManagerPath, 'utf8');
    expect(source).toContain("buildSidecarUrl('api/folders')");
    expect(source).toContain('Desktop/Tauri-sidecar primary requirement: list real subfolders under KB root.');
  });

  test('exposes desktop KB path controls with tauri choose/reset commands', () => {
    const source = fs.readFileSync(sourceManagerPath, 'utf8');
    expect(source).toContain("document.getElementById('btn-change-kb-path')");
    expect(source).toContain("document.getElementById('btn-reset-kb-path')");
    expect(source).toContain("invoke('choose_kb_path')");
    expect(source).toContain("invoke('reset_kb_path')");
    expect(source).toContain('runtimeCaps.supports_kb_runtime_change');
  });

  test('loads runtime bridge before source manager so Tauri sidecar URLs can be resolved dynamically', () => {
    const indexPath = path.join(repoRoot, 'src', 'frontend', 'index.html');
    const indexHtml = fs.readFileSync(indexPath, 'utf8');
    expect(indexHtml).toContain('<script src="runtime_bridge.js"></script>');
    expect(indexHtml.indexOf('<script src="runtime_bridge.js"></script>')).toBeLessThan(indexHtml.indexOf('<script src="source_manager.js"></script>'));
  });

  test('loads runtime bridge before path_app on the dedicated path mode page', () => {
    const pathHtmlPath = path.join(repoRoot, 'src', 'frontend', 'path.html');
    const pathHtml = fs.readFileSync(pathHtmlPath, 'utf8');
    expect(pathHtml).toContain('<script src="runtime_bridge.js"></script>');
    expect(pathHtml.indexOf('<script src="runtime_bridge.js"></script>')).toBeLessThan(indexHtmlOrder(pathHtml, '<script src="path_app.js"></script>'));
  });

  test('exposes sidecar runtime config command and keeps path_app syntax valid', () => {
    const rustPath = path.join(repoRoot, 'src-tauri', 'src', 'lib.rs');
    const pathAppPath = path.join(repoRoot, 'src', 'frontend', 'path_app.js');
    const runtimeBridgePath = path.join(repoRoot, 'src', 'frontend', 'runtime_bridge.js');
    const rustSource = fs.readFileSync(rustPath, 'utf8');
    const pathAppSource = fs.readFileSync(pathAppPath, 'utf8');
    const runtimeBridgeSource = fs.readFileSync(runtimeBridgePath, 'utf8');
    expect(rustSource).toContain('get_sidecar_runtime_config');
    expect(runtimeBridgeSource).toContain("invoke('get_runtime_capabilities')");
    expect(runtimeBridgeSource).toContain("invoke('get_sidecar_runtime_config')");
    expect(pathAppSource).toContain("bridge.whenReady()");
    expect(() => new (require('vm').Script)(pathAppSource)).not.toThrow();
  });
});
