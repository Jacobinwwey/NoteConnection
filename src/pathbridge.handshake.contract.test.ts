import * as fs from 'fs';
import * as path from 'path';
import {
  buildBridgePathTransportSummary,
  computeBridgePathFingerprint,
  validateBridgePathPayload,
} from './core/PathBridge';

describe('path bridge handshake and transport verification contracts', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const bridgePath = path.join(repoRoot, 'src', 'core', 'PathBridge.ts');
  const wsClientPath = path.join(repoRoot, 'path_mode', 'scripts', 'ws_client.gd');
  const pathAppPath = path.join(repoRoot, 'src', 'frontend', 'path_app.js');
  const pathRendererPath = path.join(repoRoot, 'path_mode', 'scripts', 'path_renderer.gd');

  test('path bridge supports explicit identify handshake and client tagging', () => {
    const bridge = fs.readFileSync(bridgePath, 'utf8');
    expect(bridge).toContain("case 'identify'");
    expect(bridge).toContain('setClientTag(sender, requestedTag)');
    expect(bridge).toContain('private sanitizeClientTag(');
  });

  test('godot websocket client uses URL accepted by Godot and queues pre-connect messages', () => {
    const wsClient = fs.readFileSync(wsClientPath, 'utf8');
    expect(wsClient).toContain('func _resolve_ws_url() -> String:');
    expect(wsClient).toContain('"type": "identify"');
    expect(wsClient).toContain('var _pending_messages: Array[Dictionary] = []');
    expect(wsClient).toContain('_flush_pending_messages()');
  });

  test('path bridge adds producer-aware status feedback and timeout handling', () => {
    const bridge = fs.readFileSync(bridgePath, 'utf8');
    expect(bridge).toContain("case 'pathStatus':");
    expect(bridge).toContain('private pendingPathRequests: Map<WebSocket, PendingPathRequest> = new Map();');
    expect(bridge).toContain('path_producer_waiting');
    expect(bridge).toContain('path_producer_connected');
    expect(bridge).toContain('path_producer_unavailable');
    expect(bridge).toContain('path_request_timeout');
    expect(bridge).toContain('validateBridgePathPayload(payload)');
    expect(bridge).toContain('Frontend returned invalid path data; see backend log for validation issues.');
  });

  test('path app identifies websocket role and emits verification metadata/status', () => {
    const pathApp = fs.readFileSync(pathAppPath, 'utf8');
    expect(pathApp).toContain("_getBridgeWsUrl: function() {");
    expect(pathApp).toContain("window.NoteConnectionRuntime.getBridgeWsUrl('frontend')");
    expect(pathApp).toContain("this._sendBridgeMessage('identify', this._getBridgeIdentifyPayload('frontend'))");
    expect(pathApp).toContain("this._sendBridgeMessage('identify', this._getBridgeIdentifyPayload('frontend-early'))");
    expect(pathApp).toContain('bridge.parseBridgeEnvelope');
    expect(pathApp).toContain('bridge.sendBridgeMessage');
    expect(pathApp).toContain("_getPreferredStandaloneCentralId: function(");
    expect(pathApp).toContain("setupEarlyWebSocket: function(options = {}) {");
    expect(pathApp).toContain("sendPathToBridgeStandalone(initialCentralId)");
    expect(pathApp).toContain("_sendBridgeStatus: function(");
    expect(pathApp).toContain("_createBridgeTransportMeta: function(");
    expect(pathApp).toContain("_respondToBridgePathRequest: function(source = 'main') {");
    expect(pathApp).toContain("payload._bridgeTransport = this._createBridgeTransportMeta(payload, 'frontend');");
    expect(pathApp).toContain("this._respondToBridgePathRequest('early')");
    expect(pathApp).toContain("userAgent.includes('Tauri')");
  });

  test('godot renderer surfaces bridge status messages to the UI', () => {
    const pathRenderer = fs.readFileSync(pathRendererPath, 'utf8');
    expect(pathRenderer).toContain('"pathStatus":');
    expect(pathRenderer).toContain('func _handle_path_status(payload: Dictionary) -> void:');
    expect(pathRenderer).toContain('ui.set_runtime_status(message, level)');
  });

  test('backend validator accepts matching frontend transport summary and fingerprint', () => {
    const payload: Record<string, unknown> = {
      central: {
        id: 'root',
        label: 'Root',
        metadata: { filepath: 'Knowledge_Base/root.md' },
      },
      peripherals: [
        { id: 'child-a', label: 'Child A', relation: 'prerequisite' },
        { id: 'child-b', label: 'Child B', relation: 'association' },
      ],
      progress: {
        completed: 1,
        total: 3,
      },
      totalNodes: 3,
      pathNodes: [
        { id: 'root', label: 'Root', parentId: null },
        { id: 'child-a', label: 'Child A', parentId: 'root' },
        { id: 'child-b', label: 'Child B', parentId: 'root' },
      ],
      treeLayout: {
        nodes: [
          { id: 'root' },
          { id: 'child-a' },
          { id: 'child-b' },
        ],
      },
      completedIds: ['child-a'],
      mode: 'orbital',
    };

    const summary = buildBridgePathTransportSummary(payload);
    const fingerprint = computeBridgePathFingerprint(summary);
    payload._bridgeTransport = { summary, fingerprint };

    const result = validateBridgePathPayload(payload);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.transport.fingerprint).toBe(fingerprint);
  });

  test('backend validator rejects mismatched frontend transport fingerprint', () => {
    const payload: Record<string, unknown> = {
      central: {
        id: 'root',
        label: 'Root',
        metadata: { filepath: 'Knowledge_Base/root.md' },
      },
      peripherals: [],
      progress: {
        completed: 0,
        total: 1,
      },
      totalNodes: 1,
      pathNodes: [
        { id: 'root', label: 'Root', parentId: null },
      ],
      treeLayout: {
        nodes: [
          { id: 'root' },
        ],
      },
      completedIds: [],
      mode: 'orbital',
      _bridgeTransport: {
        summary: {
          centralId: 'root',
          totalNodes: 1,
          pathNodeCount: 1,
          pathNodeIds: ['root'],
          peripheralIds: [],
          completedIds: [],
          treeNodeIds: ['root'],
          progressCompleted: 0,
          progressTotal: 1,
          mode: 'orbital',
          filepath: 'Knowledge_Base/root.md',
        },
        fingerprint: 'deadbeef',
      },
    };

    const result = validateBridgePathPayload(payload);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('Frontend/back-end transport fingerprint mismatch.');
  });
});
