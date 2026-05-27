import * as fs from 'fs';
import * as path from 'path';
import {
  BRIDGE_BACKPRESSURE_LIMITS,
  BRIDGE_INBOUND_LIMITS,
  BRIDGE_INBOUND_SCHEMA_LIMITS,
  buildBridgePathTransportSummary,
  computeBridgePathFingerprint,
  parseBridgeInboundEnvelope,
  resolveBridgeInboundLimitConfig,
  resolveBridgeInboundSchemaPolicy,
  validateBridgePathPayload,
} from './core/PathBridge';

describe('path bridge handshake and transport verification contracts', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const bridgePath = path.join(repoRoot, 'src', 'core', 'PathBridge.ts');
  const serverPath = path.join(repoRoot, 'src', 'server.ts');
  const wsClientPath = path.join(repoRoot, 'path_mode', 'scripts', 'ws_client.gd');
  const pathAppPath = path.join(repoRoot, 'src', 'frontend', 'path_app.js');
  const pathWorkerPath = path.join(repoRoot, 'src', 'frontend', 'path_worker.js');
  const pathModeUiPath = path.join(repoRoot, 'path_mode', 'scripts', 'path_mode_ui.gd');
  const readerRenderClientPath = path.join(repoRoot, 'path_mode', 'scripts', 'reader_render_client.gd');
  const pathRendererPath = path.join(repoRoot, 'path_mode', 'scripts', 'path_renderer.gd');

  test('path bridge supports explicit identify handshake and client tagging', () => {
    const bridge = fs.readFileSync(bridgePath, 'utf8');
    expect(bridge).toContain("case 'identify'");
    expect(bridge).toContain('setClientTag(sender, String(requestedTag))');
    expect(bridge).toContain('private sanitizeClientTag(');
    expect(bridge).toContain('private unauthorizedClientTimers: Map<WebSocket, NodeJS.Timeout> = new Map();');
    expect(bridge).toContain('private scheduleUnauthorizedDisconnect(ws: WebSocket): void {');
    expect(bridge).toContain('private clearUnauthorizedDisconnect(ws: WebSocket): void {');
    expect(bridge).toContain('UNAUTHORIZED_CLIENT_TIMEOUT_MS');
  });

  test('bridge inbound envelope parser rejects malformed payloads and accepts valid identify/auth payloads', () => {
    const missingType = parseBridgeInboundEnvelope({ payload: {} });
    expect(missingType.ok).toBe(false);
    expect(missingType.reason).toBe('Bridge message requires a non-empty type string.');

    const invalidIdentify = parseBridgeInboundEnvelope({
      type: 'identify',
      payload: {
        client: 123,
      },
    });
    expect(invalidIdentify.ok).toBe(false);
    expect(invalidIdentify.reason).toBe('identify client/tag must be a string when provided.');

    const validIdentify = parseBridgeInboundEnvelope({
      type: 'identify',
      payload: {
        client: 'frontend',
        token: 'dev-token',
      },
    });
    expect(validIdentify.ok).toBe(true);
    expect(validIdentify.envelope?.type).toBe('identify');

    const invalidSwitchCenter = parseBridgeInboundEnvelope({
      type: 'switchCenter',
      payload: {
        newCenterId: '',
      },
    });
    expect(invalidSwitchCenter.ok).toBe(false);
    expect(invalidSwitchCenter.reason).toBe('switchCenter payload.newCenterId must be a non-empty string.');

    const invalidCompletionSync = parseBridgeInboundEnvelope({
      type: 'completionSync',
      payload: {
        completedIds: ['n1', 2],
      },
    });
    expect(invalidCompletionSync.ok).toBe(false);
    expect(invalidCompletionSync.reason).toBe(
      'completionSync payload.completedIds must contain only non-empty strings.'
    );

    const invalidMermaidResult = parseBridgeInboundEnvelope({
      type: 'renderMermaidResult',
      payload: {
        requestId: 'r-1',
        ok: true,
        pngBase64: '',
      },
    });
    expect(invalidMermaidResult.ok).toBe(false);
    expect(invalidMermaidResult.reason).toBe(
      'renderMermaidResult payload.pngBase64 must be a non-empty string when ok=true.'
    );

    const validMermaidResult = parseBridgeInboundEnvelope({
      type: 'renderMermaidResult',
      payload: {
        requestId: 'r-2',
        ok: true,
        pngBase64: 'ZmFrZS1wbmc=',
        width: 640,
        height: 360,
        stages: [
          {
            stage: 'input',
            svg: '<svg/>',
            width: 640,
            height: 360,
          },
        ],
      },
    });
    expect(validMermaidResult.ok).toBe(true);

    const invalidConfigureValue = parseBridgeInboundEnvelope({
      type: 'configure',
      payload: {
        mode: 'invalid-mode',
      },
    });
    expect(invalidConfigureValue.ok).toBe(false);
    expect(invalidConfigureValue.reason).toContain('configure payload.mode must be one of');

    const invalidConfigureLayout = parseBridgeInboundEnvelope({
      type: 'configure',
      payload: {
        layout: 'force-directed',
      },
    });
    expect(invalidConfigureLayout.ok).toBe(false);
    expect(invalidConfigureLayout.reason).toContain('configure payload.layout must be one of');

    const invalidConfigureBackground = parseBridgeInboundEnvelope({
      type: 'configure',
      payload: {
        background: '../unsafe-path.exr',
      },
    });
    expect(invalidConfigureBackground.ok).toBe(false);
    expect(invalidConfigureBackground.reason).toContain('safe .exr/.hdr filename');

    const invalidConfigureBrightness = parseBridgeInboundEnvelope({
      type: 'configure',
      payload: {
        bg_brightness: 0.2,
      },
    });
    expect(invalidConfigureBrightness.ok).toBe(false);
    expect(invalidConfigureBrightness.reason).toContain('configure payload.bg_brightness must be within');

    const invalidConfigureMediaScale = parseBridgeInboundEnvelope({
      type: 'configure',
      payload: {
        reader_media_scale: 7,
      },
    });
    expect(invalidConfigureMediaScale.ok).toBe(false);
    expect(invalidConfigureMediaScale.reason).toContain('configure payload.reader_media_scale must be within');

    const conflictingConfigureTarget = parseBridgeInboundEnvelope({
      type: 'configure',
      payload: {
        targetId: 'node-a',
        target_id: 'node-b',
      },
    });
    expect(conflictingConfigureTarget.ok).toBe(false);
    expect(conflictingConfigureTarget.reason).toContain('targetId and payload.target_id must match');

    const validConfigurePayload = parseBridgeInboundEnvelope({
      type: 'configure',
      payload: {
        mode: 'diffusion',
        strategy: 'core',
        layout: 'orbital',
        targetId: 'knowledge/node-1',
        auto_reconstruct: true,
        retain_history: true,
        focus_mode: false,
        background: 'belfast_sunset_puresky_4k.exr',
        bg_brightness: 0.08,
        reading_mode: 'window',
        reader_render_mode: 'render',
        reader_toggle_source_shortcut: 'Ctrl+Shift+M',
        reader_media_scale: 1.5,
        reader_debug: false,
      },
    });
    expect(validConfigurePayload.ok).toBe(true);

    const strictUnknownPolicy = resolveBridgeInboundSchemaPolicy({
      NOTE_CONNECTION_BRIDGE_REJECT_UNKNOWN_TYPES: '1',
    } as NodeJS.ProcessEnv);
    const unknownTypeInStrictMode = parseBridgeInboundEnvelope(
      {
        type: 'customEvent',
        payload: {},
      },
      strictUnknownPolicy
    );
    expect(unknownTypeInStrictMode.ok).toBe(false);
    expect(unknownTypeInStrictMode.reason).toContain('not allowed in strict unknown-type mode');

    const strictConfigurePolicy = resolveBridgeInboundSchemaPolicy({
      NOTE_CONNECTION_BRIDGE_STRICT_CONFIG_SCHEMA: '1',
    } as NodeJS.ProcessEnv);
    const unknownConfigureKeyInStrictMode = parseBridgeInboundEnvelope(
      {
        type: 'configure',
        payload: {
          mode: 'domain',
          customRuntimeHint: true,
        },
      },
      strictConfigurePolicy
    );
    expect(unknownConfigureKeyInStrictMode.ok).toBe(false);
    expect(unknownConfigureKeyInStrictMode.reason).toContain('unsupported keys in strict mode');
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
    expect(bridge).toContain('private decodeIncomingMessage(raw: RawData): {');
    expect(bridge).toContain('private pendingPathRequests: Map<WebSocket, PendingPathRequest> = new Map();');
    expect(bridge).toContain('private outboundQueueState: Map<WebSocket, ClientOutboundQueueState> = new Map();');
    expect(bridge).toContain('private enqueueOutboundMessage(client: WebSocket, message: OutboundQueueMessage): void {');
    expect(bridge).toContain('private flushOutboundQueue(client: WebSocket): void {');
    expect(bridge).toContain('client.bufferedAmount >= BRIDGE_OUTBOUND_MAX_BUFFERED_BYTES');
    expect(bridge).toContain('Outbound queue overflow');
    expect(bridge).toContain('path_producer_waiting');
    expect(bridge).toContain('path_producer_connected');
    expect(bridge).toContain('path_producer_unavailable');
    expect(bridge).toContain('path_request_timeout');
    expect(bridge).toContain('validateBridgePathPayload(payload)');
    expect(bridge).toContain('Frontend returned invalid path data; see backend log for validation issues.');
    expect(bridge).toContain('private getOpenAuthorizedClients(): WebSocket[] {');
    expect(bridge).toContain("return `${meta.tag}#${meta.id}${meta.authorized ? '' : '(unauthorized)'}`;");
  });

  test('backpressure limits remain bounded for websocket fan-out safety', () => {
    expect(BRIDGE_BACKPRESSURE_LIMITS.maxQueueMessages).toBeGreaterThan(0);
    expect(BRIDGE_BACKPRESSURE_LIMITS.maxQueueMessages).toBeLessThanOrEqual(512);
    expect(BRIDGE_BACKPRESSURE_LIMITS.maxBufferedAmountBytes).toBeGreaterThan(256 * 1024);
    expect(BRIDGE_BACKPRESSURE_LIMITS.maxBufferedAmountBytes).toBeLessThanOrEqual(8 * 1024 * 1024);
    expect(BRIDGE_BACKPRESSURE_LIMITS.flushIntervalMs).toBeGreaterThanOrEqual(10);
    expect(BRIDGE_BACKPRESSURE_LIMITS.flushIntervalMs).toBeLessThanOrEqual(100);
  });

  test('inbound frame limit is provisioned for high-volume graph payloads', () => {
    expect(BRIDGE_INBOUND_LIMITS.defaultMessageBytes).toBe(128 * 1024 * 1024);
    expect(BRIDGE_INBOUND_LIMITS.minMessageBytes).toBe(8 * 1024 * 1024);
    expect(BRIDGE_INBOUND_LIMITS.hardCapBytes).toBe(1024 * 1024 * 1024);
    expect(BRIDGE_INBOUND_LIMITS.maxMessageBytes).toBeGreaterThanOrEqual(BRIDGE_INBOUND_LIMITS.minMessageBytes);
    expect(BRIDGE_INBOUND_LIMITS.maxMessageBytes).toBeLessThanOrEqual(BRIDGE_INBOUND_LIMITS.hardCapBytes);
    expect(BRIDGE_INBOUND_LIMITS.recommendedMessageBytes).toBeGreaterThanOrEqual(BRIDGE_INBOUND_LIMITS.defaultMessageBytes);
  });

  test('schema policy defaults remain compatibility-safe unless explicitly tightened', () => {
    expect(BRIDGE_INBOUND_SCHEMA_LIMITS.rejectUnknownTypes).toBe(false);
    expect(BRIDGE_INBOUND_SCHEMA_LIMITS.strictConfigureSchema).toBe(false);
  });

  test('inbound frame policy auto-raises low configured limits for large graph hints unless strict mode is enabled', () => {
    const autoRaised = resolveBridgeInboundLimitConfig({
      NOTE_CONNECTION_BRIDGE_MAX_INBOUND_MB: '1',
      NOTE_CONNECTION_EXPECTED_NODE_COUNT: '12000',
      NOTE_CONNECTION_EXPECTED_EDGE_COUNT: '1200000',
    });

    expect(autoRaised.recommendedMessageMb).toBeGreaterThanOrEqual(256);
    expect(autoRaised.selectedMessageMb).toBe(autoRaised.recommendedMessageMb);
    expect(autoRaised.source).toBe('auto-raised');

    const strict = resolveBridgeInboundLimitConfig({
      NOTE_CONNECTION_BRIDGE_MAX_INBOUND_MB: '1',
      NOTE_CONNECTION_EXPECTED_NODE_COUNT: '12000',
      NOTE_CONNECTION_EXPECTED_EDGE_COUNT: '1200000',
      NOTE_CONNECTION_BRIDGE_STRICT_INBOUND_LIMIT: '1',
    });

    expect(strict.selectedMessageMb).toBe(8);
    expect(strict.source).toBe('configured-strict');
    expect(strict.recommendedMessageMb).toBeGreaterThan(strict.selectedMessageMb);
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
    expect(pathApp).toContain("_ensurePathSemanticA11y: function() {");
    expect(pathApp).toContain("host.id = hostId;");
    expect(pathApp).toContain("live.setAttribute('aria-live', 'polite')");
  });

  test('path mode preserves bounded default targeting and diffusion multi-target contract', () => {
    const pathModeUi = fs.readFileSync(pathModeUiPath, 'utf8');
    const pathApp = fs.readFileSync(pathAppPath, 'utf8');
    const pathWorker = fs.readFileSync(pathWorkerPath, 'utf8');
    const pathRenderer = fs.readFileSync(pathRendererPath, 'utf8');

    expect(pathModeUi).toContain('func _get_effective_domain_target_ids() -> Array[String]:');
    expect(pathModeUi).toContain('effective_ids = _get_default_target_ids(2)');
    expect(pathModeUi).toContain('config["targetIds"] = domain_ids');
    expect(pathModeUi).toContain('config["targetIds"] = diffusion_ids');
    expect(pathApp).toContain('if (Array.isArray(config.targetIds)) {');
    expect(pathApp).toContain('targetIds,');
    expect(pathApp).toContain('availableTargets: this._buildAvailableTargetCatalog()');
    expect(pathApp).toContain('_buildAvailableTargetCatalog: function() {');
    expect(pathWorker).toContain('result = engine.domainLearning(domainTargets.length > 0 ? domainTargets : null, strategy);');
    expect(pathWorker).toContain('result = mergePathResults(partialResults, strategy);');
    expect(pathRenderer).toContain('var available_target_nodes_raw = path_data.get("availableTargets", path_nodes)');
    expect(pathRenderer).toContain('ui.set_available_targets(available_target_nodes, _central_node.get("id", ""))');
  });

  test('godot renderer surfaces bridge status messages to the UI', () => {
    const pathRenderer = fs.readFileSync(pathRendererPath, 'utf8');
    expect(pathRenderer).toContain('"pathStatus":');
    expect(pathRenderer).toContain('func _handle_path_status(payload: Dictionary) -> void:');
    expect(pathRenderer).toContain('ui.set_runtime_status(message, level)');
  });

  test('mermaid render pipeline keeps Godot runtime on PNG-only decode contract', () => {
    const bridge = fs.readFileSync(bridgePath, 'utf8');
    const server = fs.readFileSync(serverPath, 'utf8');
    const pathApp = fs.readFileSync(pathAppPath, 'utf8');
    const readerRenderClient = fs.readFileSync(readerRenderClientPath, 'utf8');

    expect(bridge).toContain("const ok = payloadLike.ok === true && pngBase64.length > 0;");
    expect(bridge).toContain("svg: typeof payloadLike.svg === 'string' ? payloadLike.svg : undefined,");
    expect(bridge).toContain('includeSvg: payload.includeSvg === true || payload.includeStages === true,');
    expect(server).toContain('const includeSvg = options.includeStages === true || options.includeSvg === true;');
    expect(server).toContain('const includeSvg = parseOptionalBoolean(payload.includeSvg) === true;');
    expect(server).toContain('pngBase64: frontendRendered.pngBase64,');
    expect(server).not.toContain('transportReason');
    expect(server).not.toContain('pngBase64Bytes');
    expect(pathApp).toContain('const includeSvg = includeStages || payload?.includeSvg === true;');
    expect(pathApp).toContain('svg: includeSvg ? serializedSvg : undefined,');
    expect(readerRenderClient).toContain('var png_base64 := String(response.get("pngBase64", "")).strip_edges()');
    expect(readerRenderClient).toContain('return _decode_png_texture(png_base64)');
    expect(readerRenderClient).toContain('Renderer response did not include a PNG payload.');
  });

  test('godot clipboard transport prefers binary PNG upload and keeps base64 fallback', () => {
    const readerRenderClient = fs.readFileSync(readerRenderClientPath, 'utf8');

    expect(readerRenderClient).toContain('const BINARY_PNG_HEADERS := ["Content-Type: image/png"]');
    expect(readerRenderClient).toContain('var binary_response: Dictionary = await _post_binary("/api/clipboard/image-binary", png_buffer)');
    expect(readerRenderClient).toContain('var fallback_response: Dictionary = await _post_json("/api/clipboard/image", {"pngBase64": Marshalls.raw_to_base64(png_buffer)})');
    expect(readerRenderClient).toContain('func _post_binary(endpoint: String, payload: PackedByteArray) -> Dictionary:');
    expect(readerRenderClient).toContain('request.request_raw(');
    expect(readerRenderClient).toContain('func _build_binary_headers() -> PackedStringArray:');
    expect(readerRenderClient).toContain('fallback_response["transport"] = "base64-fallback"');
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
