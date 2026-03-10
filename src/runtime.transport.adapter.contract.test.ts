import * as fs from 'fs';
import * as path from 'path';

describe('runtime transport adapter consolidation contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const runtimeBridgePath = path.join(repoRoot, 'src', 'frontend', 'runtime_bridge.js');
  const sourceManagerPath = path.join(repoRoot, 'src', 'frontend', 'source_manager.js');
  const readerPath = path.join(repoRoot, 'src', 'frontend', 'reader.js');
  const pathAppPath = path.join(repoRoot, 'src', 'frontend', 'path_app.js');

  test('keeps loopback defaults centralized in runtime_bridge only', () => {
    const runtimeBridge = fs.readFileSync(runtimeBridgePath, 'utf8');
    const sourceManager = fs.readFileSync(sourceManagerPath, 'utf8');
    const reader = fs.readFileSync(readerPath, 'utf8');
    const pathApp = fs.readFileSync(pathAppPath, 'utf8');

    expect(runtimeBridge).toContain("const DEFAULT_BASE_URL = 'http://127.0.0.1:3000';");
    expect(runtimeBridge).toContain("const DEFAULT_BRIDGE_WS_URL = 'ws://127.0.0.1:9876';");
    expect(sourceManager).not.toContain('http://127.0.0.1:3000/');
    expect(reader).not.toContain('http://127.0.0.1:3000/');
    expect(pathApp).not.toContain('ws://127.0.0.1:9876');
  });

  test('runtime bridge websocket URL propagation includes client and token query metadata', () => {
    const runtimeBridge = fs.readFileSync(runtimeBridgePath, 'utf8');
    expect(runtimeBridge).toContain("url.searchParams.set('client', normalizedClientTag)");
    expect(runtimeBridge).toContain("url.searchParams.set('token', state.authToken)");
    expect(runtimeBridge).toContain('function getBridgeWsUrl(clientTag)');
  });

  test('source manager and reader use shared runtime adapters (bridge + storage provider)', () => {
    const sourceManager = fs.readFileSync(sourceManagerPath, 'utf8');
    const reader = fs.readFileSync(readerPath, 'utf8');

    expect(sourceManager).toContain('const requireRuntimeBridge = () => {');
    expect(sourceManager).toContain('Runtime bridge is unavailable. Ensure runtime_bridge.js is loaded before source_manager.js.');
    expect(sourceManager).toContain("Runtime bridge does not expose buildUrl().");
    expect(sourceManager).toContain("window.NoteConnectionStorage.createProvider({ runtimeCaps })");
    expect(reader).toContain("window.NoteConnectionStorage.createProvider({ runtimeCaps })");
    expect(reader).toContain('Storage provider is unavailable. Ensure storage_provider.js is loaded before reader.js.');
  });

  test('path app guards websocket startup when runtime bridge url is unavailable', () => {
    const pathApp = fs.readFileSync(pathAppPath, 'utf8');
    expect(pathApp).toContain('Bridge socket URL is unavailable; skipping WebSocket connect attempt.');
    expect(pathApp).toContain('Sidecar bridge is disabled for this runtime; skipping setupWebSocket.');
    expect(pathApp).toContain('Sidecar bridge is disabled for this runtime; skipping WebSocket connect attempt.');
    expect(pathApp).toContain('_supportsSidecarBridge');
    expect(pathApp).toContain('_isCapacitorNativeRuntime');
    expect(pathApp).toContain('window.__NC_SIDECAR_RUNTIME');
    expect(pathApp).toContain("return '';");
    expect(pathApp).toContain('bridge.parseBridgeEnvelope');
    expect(pathApp).toContain('bridge.sendBridgeMessage');
  });
});
