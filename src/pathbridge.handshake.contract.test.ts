import * as fs from 'fs';
import * as path from 'path';

describe('path bridge handshake and tauri guard contracts', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const bridgePath = path.join(repoRoot, 'src', 'core', 'PathBridge.ts');
  const wsClientPath = path.join(repoRoot, 'path_mode', 'scripts', 'ws_client.gd');
  const pathAppPath = path.join(repoRoot, 'src', 'frontend', 'path_app.js');

  test('path bridge supports explicit identify handshake and client tagging', () => {
    const bridge = fs.readFileSync(bridgePath, 'utf8');
    expect(bridge).toContain("case 'identify'");
    expect(bridge).toContain('setClientTag(sender, requestedTag)');
    expect(bridge).toContain('private sanitizeClientTag(');
  });

  test('godot websocket client uses URL accepted by Godot and queues pre-connect messages', () => {
    const wsClient = fs.readFileSync(wsClientPath, 'utf8');
    expect(wsClient).toContain('const WS_URL := "ws://127.0.0.1:9876"');
    expect(wsClient).toContain('"type": "identify"');
    expect(wsClient).toContain('var _pending_messages: Array[Dictionary] = []');
    expect(wsClient).toContain('_flush_pending_messages()');
  });

  test('path app identifies websocket role and blocks early socket in tauri runtime', () => {
    const pathApp = fs.readFileSync(pathAppPath, 'utf8');
    expect(pathApp).toContain("_getBridgeWsUrl: function() {");
    expect(pathApp).toContain("return 'ws://localhost:9876';");
    expect(pathApp).toContain("payload: { client: 'frontend' }");
    expect(pathApp).toContain("payload: { client: 'frontend-early' }");
    expect(pathApp).toContain("userAgent.includes('Tauri')");
    expect(pathApp).toContain("window.pathApp._isTauriMode()");
  });
});

