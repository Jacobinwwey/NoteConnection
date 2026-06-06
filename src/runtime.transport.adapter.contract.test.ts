import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

describe('runtime transport adapter consolidation contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const runtimeBridgePath = path.join(repoRoot, 'src', 'frontend', 'runtime_bridge.js');
  const appPath = path.join(repoRoot, 'src', 'frontend', 'app.js');
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

  test('runtime bridge refreshes sidecar config from Tauri after initial hydration', async () => {
    const runtimeBridge = fs.readFileSync(runtimeBridgePath, 'utf8');
    const sidecarConfigs = [
      {
        host: '127.0.0.1',
        port: 14817,
        bridgePort: 14818,
        baseUrl: 'http://127.0.0.1:14817',
        bridgeWsUrl: 'ws://127.0.0.1:14818',
        authToken: 'old-token',
      },
      {
        host: '127.0.0.1',
        port: 24817,
        bridgePort: 24818,
        baseUrl: 'http://127.0.0.1:24817',
        bridgeWsUrl: 'ws://127.0.0.1:24818',
        authToken: 'new-token',
      },
    ];
    let sidecarConfigIndex = 0;
    const invokeCalls: string[] = [];
    const windowObject: Record<string, any> = {
      __TAURI__: {
        core: {
          invoke: async (command: string) => {
            invokeCalls.push(command);
            if (command === 'get_runtime_capabilities') {
              return { supports_sidecar: true };
            }
            if (command === 'get_sidecar_runtime_config') {
              const config = sidecarConfigs[Math.min(sidecarConfigIndex, sidecarConfigs.length - 1)];
              sidecarConfigIndex += 1;
              return config;
            }
            if (command === 'get_app_runtime_config') {
              return { language: 'en', multiWindow: {} };
            }
            throw new Error(`Unexpected Tauri command: ${command}`);
          },
        },
      },
      dispatchEvent: jest.fn(),
    };
    const context = {
      window: windowObject,
      document: {
        readyState: 'complete',
        addEventListener: jest.fn(),
      },
      console,
      CustomEvent,
      Headers,
      URL,
      WebSocket: class {},
      setTimeout,
      clearTimeout,
    };

    vm.runInNewContext(runtimeBridge, context);

    await windowObject.NoteConnectionRuntime.whenReady();
    expect(windowObject.NoteConnectionRuntime.getAuthToken()).toBe('old-token');

    await windowObject.NoteConnectionRuntime.refreshFromTauri();

    expect(windowObject.NoteConnectionRuntime.getAuthToken()).toBe('new-token');
    expect(windowObject.NoteConnectionRuntime.getBaseUrl()).toBe('http://127.0.0.1:24817');
    expect(invokeCalls.filter((command) => command === 'get_sidecar_runtime_config')).toHaveLength(2);
  });

  test('agent settings runtime requests wait for runtime readiness and recover stale sidecar auth', () => {
    const app = fs.readFileSync(appPath, 'utf8');
    const requestRuntimeJsonStart = app.indexOf('const ensureRuntimeBridgeReady = async () => {');
    expect(requestRuntimeJsonStart).toBeGreaterThan(-1);
    const requestRuntimeJsonEnd = app.indexOf('    const isAnySettingsPanelOpen', requestRuntimeJsonStart);
    expect(requestRuntimeJsonEnd).toBeGreaterThan(requestRuntimeJsonStart);
    const runtimeRequestBlock = app.slice(requestRuntimeJsonStart, requestRuntimeJsonEnd);

    expect(runtimeRequestBlock).toContain('await window.NoteConnectionRuntime.whenReady()');
    expect(runtimeRequestBlock).toContain('response.status === 401');
    expect(runtimeRequestBlock).toContain('await window.NoteConnectionRuntime.refreshFromTauri()');
    expect(runtimeRequestBlock).toContain('const secondAttempt = await fetchRuntimeJsonOnce(resourcePath, init);');
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
