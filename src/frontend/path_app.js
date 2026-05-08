/**
 * Path Mode Application Controller
 * Handles interaction, rendering, and worker communication.
 *
 * Phase 4 P5: Canonical utility implementations now live in
 * path_mermaid_utils.mjs and path_state.mjs, exposed via
 * window.pathModules (loaded by path_modules_bridge.js).
 * The _methodName functions below delegate to window.pathModules
 * when available, falling back to inline implementations.
 */

(function () {
    'use strict';
    var _pm = window.pathModules;
    if (_pm && _pm.utils) {
        // Pre-bind canonical implementations before pathApp definition.
        // These will be used by the methods defined below.
        window._pathUtils = _pm.utils;
        window._pathState = _pm.state;
    }
})();

window.pathApp = {
    canvas: null,
    ctx: null,
    worker: null,
    transform: { k: 1, x: 0, y: 0 },
    nodes: [],
    links: [],
    width: 0,
    height: 0,
    
    // State
    centralNodeId: null,
    learningHistory: [],
    completedNodes: new Set(),
    collapsedNodes: new Set(), 
    forcedExpansionNodes: new Set(), // New: nodes with forced expansion of prereqs
    expansionOrder: [],
    stickyClaimEnabled: true,
    currentTargetId: null,
    currentTargetIds: [],
    lastTreeLayout: null, // Store tree layout for requestPath
    uiInitialized: false,
    runtimeConfig: {
        mode: 'domain',
        strategy: 'foundational',
        layout: 'orbital', // Track(Focus) default in Tauri flow
        targetId: null,
        targetIds: [],
        autoReconstruct: true,
        retainHistory: true
    },
    bridgeLanguageListenerRegistered: false,
    bridgeMermaidRenderQueue: Promise.resolve(),
    pendingWindowVisibility: null,
    semanticA11yLastSummaryKey: '',
    semanticA11yLastAnnouncementAt: 0,
    learningWorkbench: {
        userId: 'path_user_default',
        loading: false,
        lastError: '',
        lastUpdatedAt: '',
        sessionPlan: null,
        qualitySnapshot: null,
        misconceptions: null,
        runtimeState: null,
        tutorFeedback: null,
        sessionExecution: null,
        sessionHistory: null,
    },
    
    // Animation State
    animationId: null,
    orbitalAngle: 0,
    
    init: function(startNodeId) {
        console.log('Path Mode Initializing...');
        this.setupCanvas();
        this.setupWorker();
        this.setupWebSocket(); // Connect to Bridge
        this.setupUI();
        
        // Initialize Reader if available and not already set
        if (typeof Reader !== 'undefined' && !window.reader) {
            window.reader = new Reader();
            console.log('Reader initialized');
        } else if (window.reader) {
             console.log('Reader already active');
        }

        this.loadHistory(); // Load from localStorage
        this._loadCompletedNodes();
        this._loadCollapsedNodes(); // New
        

        // Start Loop
        this.animate();
        
        // Load data logic
        if (typeof graphData !== 'undefined') {
            this.startProcessing(startNodeId);
        } else if (typeof window.graphData !== 'undefined') {
             this.startProcessing(startNodeId);
        } else {
             console.warn('Data loading logic needed for standalone mode');
        }
    },

    _connectBridgeSocket: function() {
        if (!this._supportsSidecarBridge()) {
            console.log('[PathApp] Sidecar bridge is disabled for this runtime; skipping WebSocket connect attempt.');
            return;
        }

        const hasActiveSocket = this.ws && (
            this.ws.readyState === WebSocket.OPEN ||
            this.ws.readyState === WebSocket.CONNECTING
        );

        if (!hasActiveSocket) {
            const socket = this._openBridgeSocket();
            if (!socket) {
                console.warn('[PathApp] Bridge socket URL is unavailable; skipping WebSocket connect attempt.');
                return;
            }
            this.ws = socket;
        }

        this.ws.onopen = () => {
            console.log('[PathApp] Connected to Bridge');
            this._sendBridgeMessage('identify', this._getBridgeIdentifyPayload('frontend'));
            this._ensureLanguageSyncListener();
            this.syncLanguageWithBridge();
            this._flushPendingWindowVisibility('socket-open');
        };
        this.ws.onmessage = (e) => {
            try {
                const msg = this._parseBridgeIncomingMessage(e.data);
                if (!msg || !msg.type) {
                    return;
                }
                console.log('[PathApp] WS Received:', msg.type);
                
                if (msg.type === 'nodeClick') {
                    console.log('[PathApp] Remote node click:', msg.payload?.nodeId);
                    this.switchCentral(msg.payload?.nodeId || msg.payload);
                } else if (msg.type === 'openReader') {
                    const data = msg.payload || msg;
                    console.log('[PathApp] Remote open reader:', data);
                    const nodeId = data.nodeId || data;
                    if (nodeId && window.reader) {
                        // Always try to find full node data from source (graphData) first to ensure metadata exists
                        const sourceData = (typeof graphData !== 'undefined') ? graphData : window.graphData;
                        let fullNode = null;
                        
                        if (sourceData && sourceData.nodes) {
                            fullNode = sourceData.nodes.find(n => n.id === nodeId);
                        }
                        
                        // Fallback to local nodes if not found (unlikely but safe)
                        if (!fullNode) {
                            fullNode = this.nodes.find(n => n.id === nodeId);
                        }

                        if (fullNode) {
                            // Merge payload overrides if present (e.g., content)
                            fullNode = { ...fullNode, ...data };
                            window.reader.open(fullNode);
                        } else {
                            window.reader.open(nodeId);
                        }
                    }
                } else if (msg.type === 'switchCenter') {
                    console.log('[PathApp] Remote switch center:', msg.payload?.newCenterId);
                    this.switchCentral(msg.payload?.newCenterId);
                } else if (msg.type === 'toggleCollapse') { // New
                    console.log('[PathApp] Remote toggle collapse:', msg.payload?.nodeId);
                    this.toggleNodeCollapse(msg.payload?.nodeId);
                } else if (msg.type === 'expandPrereqs') { // New
                     console.log('[PathApp] Remote expand prereqs:', msg.payload?.nodeId);
                     this.expandPrereqs(msg.payload?.nodeId);
                } else if (msg.type === 'collapsePrereqs') { // New
                     console.log('[PathApp] Remote collapse prereqs:', msg.payload?.nodeId);
                     this.collapsePrereqs(msg.payload?.nodeId);
                } else if (msg.type === 'collapseAll') { // New
                     console.log('[PathApp] Remote collapse ALL');
                     this.collapseAll();
                } else if (msg.type === 'renderMermaidRequest') {
                    this._handleBridgeMermaidRenderRequest(msg.payload || {});
                } else if (msg.type === 'requestPath') {
                    console.log('[PathApp] requestPath received from Bridge');
                    this._respondToBridgePathRequest('main');
                } else if (msg.type === 'configure') {
                    console.log('[PathApp] Remote configure:', msg.payload);
                    this.applyRemoteConfigure(msg.payload || {});
                } else if (msg.type === 'exitPathMode') {
                    console.log('[PathApp] Remote exit Path Mode');
                    this.exitPathMode();
                } else if (msg.type === 'openNotemd' || msg.type === 'open_notemd') {
                    console.log('[PathApp] Remote open NoteMD request');
                    void this.openEmbeddedNoteMD({
                        source: 'bridge-openNotemd',
                        restoreMainView: true
                    });
                } else if (msg.type === 'requestAppShutdown' || msg.type === 'request_app_shutdown') {
                    console.log('[PathApp] Remote full app shutdown request');
                    void this.requestFullApplicationShutdown({
                        source: 'bridge-requestAppShutdown',
                        payload: msg.payload || {}
                    });
                } else if (msg.type === 'completionSync') {
                    // ... existing code ...
                    // Bidirectional sync from Godot
                    console.log('[PathApp] Completion sync from Godot:', msg.payload);
                    const completedIds = msg.payload?.completedIds || [];
                    this.completedNodes = new Set(completedIds);
                    // Persist to localStorage
                    this._saveCompletedNodes();
                    console.log('[PathApp] Synced', completedIds.length, 'completed nodes from Godot');
                    this._refreshPathSemanticA11y('Completion synced');
                } else if (msg.type === 'markComplete') {
                    // ... existing code ...
                    // Single node marked complete from Godot
                    const nodeId = msg.payload?.nodeId;
                    if (nodeId) {
                        this.completedNodes.add(nodeId);
                        this._saveCompletedNodes();
                        
                        // Also add to learningHistory for sidebar display
                        const sourceData = (typeof graphData !== 'undefined') ? graphData : window.graphData;
                        const node = sourceData?.nodes?.find(n => n.id === nodeId);
                        const label = node?.label || nodeId;
                        
                        // Avoid duplicates
                        if (!this.learningHistory.some(h => h.id === nodeId)) {
                            this.learningHistory.push({ id: nodeId, label: label });
                            this.saveHistory();
                            this.updateHistorySidebar();
                        }
                        
                        console.log('[PathApp] Marked complete from Godot:', nodeId);
                        
                        // Auto-Reconstruct Path if setting enabled (default true)
                        // This triggers path Recalculation based on new completion status
                        const autoReconstruct = this.runtimeConfig.autoReconstruct !== false;
                        if (autoReconstruct && this.currentTargetId) {
                            console.log('[PathApp] Auto-reconstructing path because', nodeId, 'was completed');
                            this.triggerUpdate();
                        }
                        this._refreshPathSemanticA11y('Node completed');
                    }
                } else if (msg.type === 'unmarkComplete') {
                    // ... existing code ...
                    // Node unmarked from Godot
                    const nodeId = msg.payload?.nodeId;
                    if (nodeId) {
                        this.completedNodes.delete(nodeId);
                        this._saveCompletedNodes();
                        
                        // Remove from learningHistory
                        const idx = this.learningHistory.findIndex(h => h.id === nodeId);
                        if (idx !== -1) {
                            this.learningHistory.splice(idx, 1);
                            this.saveHistory();
                            this.updateHistorySidebar();
                        }
                        
                        console.log('[PathApp] Unmarked from Godot:', nodeId);
                        this._refreshPathSemanticA11y('Node unmarked');
                    }
                }
            } catch(err) {
                console.error('WS Error', err);
            }
        };
        this.ws.onclose = (e) => {
            console.log('[PathApp] Bridge socket closed. code=', e.code, 'reason=', e.reason || '<empty>');
        };
        this.ws.onerror = (err) => {
            console.warn('[PathApp] Bridge socket error:', err);
        };

        if (hasActiveSocket && this.ws.readyState === WebSocket.OPEN) {
            console.log('[PathApp] Reusing existing Bridge socket');
            this._sendBridgeMessage('identify', this._getBridgeIdentifyPayload('frontend'));
            this._ensureLanguageSyncListener();
            this.syncLanguageWithBridge();
            this._flushPendingWindowVisibility('socket-reuse');
        }
    },

    setupWebSocket: function() {
        if (!this._supportsSidecarBridge()) {
            console.log('[PathApp] Sidecar bridge is disabled for this runtime; skipping setupWebSocket.');
            return;
        }

        this._ensureLanguageSyncListener();

        const bridge = (typeof window !== 'undefined') ? window.NoteConnectionRuntime : null;
        const waitForRuntime = this._isTauriMode() && bridge && typeof bridge.whenReady === 'function';

        if (!waitForRuntime) {
            this._connectBridgeSocket();
            return;
        }

        bridge.whenReady()
            .catch((err) => {
                console.warn('[PathApp] Runtime bridge readiness failed, using current WebSocket config.', err);
            })
            .finally(() => {
                this._connectBridgeSocket();
            });
    },

    _isCapacitorNativeRuntime: function() {
        if (typeof window === 'undefined' || window.__TAURI__ || !window.Capacitor) {
            return false;
        }

        try {
            if (typeof window.Capacitor.getPlatform === 'function') {
                const platform = window.Capacitor.getPlatform();
                if (platform && platform !== 'web') {
                    return true;
                }
            }
            if (typeof window.Capacitor.isNativePlatform === 'function') {
                return Boolean(window.Capacitor.isNativePlatform());
            }
        } catch (_err) {
            return false;
        }

        return false;
    },

    _supportsSidecarBridge: function() {
        const runtimeCaps = (typeof window !== 'undefined' && window.__NC_RUNTIME_CAPS)
            ? window.__NC_RUNTIME_CAPS
            : null;

        if (runtimeCaps && runtimeCaps.supports_sidecar === false) {
            return false;
        }

        if (this._isCapacitorNativeRuntime()) {
            return false;
        }

        return true;
    },

    _getBridgeWsUrl: function() {
        if (typeof window !== 'undefined' && window.NoteConnectionRuntime && typeof window.NoteConnectionRuntime.getBridgeWsUrl === 'function') {
            return window.NoteConnectionRuntime.getBridgeWsUrl('frontend');
        }
        const runtimeState = (typeof window !== 'undefined' && window.__NC_SIDECAR_RUNTIME)
            ? window.__NC_SIDECAR_RUNTIME
            : null;
        if (runtimeState && typeof runtimeState.bridgeWsUrl === 'string' && runtimeState.bridgeWsUrl.trim()) {
            return runtimeState.bridgeWsUrl.trim();
        }
        return '';
    },

    _openBridgeSocket: function() {
        if (typeof window !== 'undefined' && window.NoteConnectionRuntime && typeof window.NoteConnectionRuntime.openBridgeSocket === 'function') {
            return window.NoteConnectionRuntime.openBridgeSocket('frontend');
        }
        const bridgeWsUrl = this._getBridgeWsUrl();
        if (!bridgeWsUrl) {
            return null;
        }
        return new WebSocket(bridgeWsUrl);
    },

    _getBridgeAuthToken: function() {
        if (typeof window !== 'undefined' && window.NoteConnectionRuntime && typeof window.NoteConnectionRuntime.getAuthToken === 'function') {
            return window.NoteConnectionRuntime.getAuthToken() || '';
        }
        return '';
    },

    _getBridgeIdentifyPayload: function(clientTag) {
        const payload = { client: clientTag };
        const authToken = this._getBridgeAuthToken();
        if (authToken) {
            payload.token = authToken;
        }
        return payload;
    },

    _normalizeLanguageCode: function(rawLanguage) {
        const value = String(rawLanguage || '').trim().toLowerCase();
        return value.startsWith('zh') ? 'zh' : 'en';
    },

    _getActiveLanguage: function() {
        if (window.i18n && typeof window.i18n.currentLanguage === 'string') {
            return this._normalizeLanguageCode(window.i18n.currentLanguage);
        }
        const languageSelect = document.getElementById('set-language');
        if (languageSelect && typeof languageSelect.value === 'string') {
            return this._normalizeLanguageCode(languageSelect.value);
        }
        const appConfig = this._getAppRuntimeConfig();
        if (appConfig && typeof appConfig.language === 'string') {
            return this._normalizeLanguageCode(appConfig.language);
        }
        return 'en';
    },

    _getAppRuntimeConfig: function() {
        if (
            typeof window !== 'undefined' &&
            window.NoteConnectionRuntime &&
            typeof window.NoteConnectionRuntime.getAppRuntimeConfig === 'function'
        ) {
            return window.NoteConnectionRuntime.getAppRuntimeConfig();
        }
        if (typeof window !== 'undefined' && window.__NC_APP_CONFIG && typeof window.__NC_APP_CONFIG === 'object') {
            return window.__NC_APP_CONFIG;
        }
        return null;
    },

    _resolveMultiWindowOptions: function() {
        const defaults = {
            singleWindowMode: true,
            hideTauriWhenPathmodeOpens: true,
            restoreTauriWhenPathmodeExits: true,
            confirmBeforeFullShutdownFromGodot: true,
            syncLanguage: true
        };
        const appConfig = this._getAppRuntimeConfig();
        if (!appConfig || !appConfig.multiWindow || typeof appConfig.multiWindow !== 'object') {
            return defaults;
        }
        return {
            singleWindowMode: typeof appConfig.multiWindow.singleWindowMode === 'boolean'
                ? appConfig.multiWindow.singleWindowMode
                : defaults.singleWindowMode,
            hideTauriWhenPathmodeOpens: typeof appConfig.multiWindow.hideTauriWhenPathmodeOpens === 'boolean'
                ? appConfig.multiWindow.hideTauriWhenPathmodeOpens
                : defaults.hideTauriWhenPathmodeOpens,
            restoreTauriWhenPathmodeExits: typeof appConfig.multiWindow.restoreTauriWhenPathmodeExits === 'boolean'
                ? appConfig.multiWindow.restoreTauriWhenPathmodeExits
                : defaults.restoreTauriWhenPathmodeExits,
            confirmBeforeFullShutdownFromGodot: typeof appConfig.multiWindow.confirmBeforeFullShutdownFromGodot === 'boolean'
                ? appConfig.multiWindow.confirmBeforeFullShutdownFromGodot
                : defaults.confirmBeforeFullShutdownFromGodot,
            syncLanguage: typeof appConfig.multiWindow.syncLanguage === 'boolean'
                ? appConfig.multiWindow.syncLanguage
                : defaults.syncLanguage
        };
    },

    _buildLanguageConfigurePayload: function(rawLanguage) {
        return {
            language: this._normalizeLanguageCode(rawLanguage || this._getActiveLanguage())
        };
    },

    syncLanguageWithBridge: function(rawLanguage) {
        const options = this._resolveMultiWindowOptions();
        if (!options.syncLanguage) {
            return false;
        }
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return false;
        }
        const payload = this._buildLanguageConfigurePayload(rawLanguage);
        return this._sendBridgeMessage('configure', payload);
    },

    _ensureLanguageSyncListener: function() {
        if (this.bridgeLanguageListenerRegistered) {
            return;
        }
        if (!window.i18n || typeof window.i18n.onLanguageChange !== 'function') {
            return;
        }
        this.bridgeLanguageListenerRegistered = true;
        window.i18n.onLanguageChange((lang) => {
            this.syncLanguageWithBridge(lang);
        });
    },

    _getRuntimeBridgeAdapter: function() {
        if (
            typeof window === 'undefined' ||
            !window.NoteConnectionRuntime ||
            typeof window.NoteConnectionRuntime !== 'object'
        ) {
            return null;
        }
        return window.NoteConnectionRuntime;
    },

    _parseBridgeIncomingMessage: function(rawData) {
        const bridge = this._getRuntimeBridgeAdapter();
        if (bridge && typeof bridge.parseBridgeEnvelope === 'function') {
            return bridge.parseBridgeEnvelope(rawData);
        }

        const parsed = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        if (!parsed || typeof parsed !== 'object') {
            return null;
        }
        return {
            type: parsed.type || '',
            payload: Object.prototype.hasOwnProperty.call(parsed, 'payload') ? parsed.payload : null,
            raw: parsed
        };
    },

    _sendBridgeMessage: function(type, payload) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('[PathApp] WebSocket not open, cannot send', type);
            return false;
        }
        const bridge = this._getRuntimeBridgeAdapter();
        if (bridge && typeof bridge.sendBridgeMessage === 'function') {
            return bridge.sendBridgeMessage(this.ws, type, payload);
        }
        this.ws.send(JSON.stringify({ type, payload }));
        return true;
    },

    _waitForBridgeSocketOpen: async function(timeoutMs = 2500) {
        const budget = Math.max(0, Number(timeoutMs) || 0);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return true;
        }
        if (budget === 0) {
            return false;
        }
        this._connectBridgeSocket();
        const startedAt = Date.now();
        while (Date.now() - startedAt < budget) {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                return true;
            }
            await new Promise((resolve) => setTimeout(resolve, 80));
            this._connectBridgeSocket();
        }
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    },

    _flushPendingWindowVisibility: function(reason = 'flush') {
        if (typeof this.pendingWindowVisibility !== 'boolean') {
            return false;
        }
        const visible = this.pendingWindowVisibility;
        const sent = this._sendBridgeMessage('setWindowVisible', { visible });
        if (sent) {
            console.log(`[PathApp] Flushed pending setWindowVisible(${visible}) via ${reason}.`);
            this.pendingWindowVisibility = null;
            return true;
        }
        return false;
    },

    requestBridgeWindowVisibility: async function(visible, options = {}) {
        const targetVisible = visible === true;
        const waitMs = Math.max(0, Number(options.waitMs) || 0);
        const reason = String(options.reason || 'manual');

        const sentImmediately = this._sendBridgeMessage('setWindowVisible', { visible: targetVisible });
        if (sentImmediately) {
            console.log(`[PathApp] Sent setWindowVisible(${targetVisible}) immediately. reason=${reason}`);
            this.pendingWindowVisibility = null;
            return true;
        }

        this.pendingWindowVisibility = targetVisible;
        this._connectBridgeSocket();
        if (waitMs === 0) {
            console.warn(`[PathApp] Deferred setWindowVisible(${targetVisible}) until socket opens. reason=${reason}`);
            return false;
        }

        const ready = await this._waitForBridgeSocketOpen(waitMs);
        if (!ready) {
            console.warn(`[PathApp] Bridge socket not ready for setWindowVisible(${targetVisible}). reason=${reason}`);
            return false;
        }
        const flushed = this._flushPendingWindowVisibility(`wait-${reason}`);
        return flushed;
    },

    _getBridgeMermaidConfig: function(theme = 'dark') {
        return {
            startOnLoad: false,
            theme,
            securityLevel: 'loose',
            fontFamily: '"Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "Segoe UI", sans-serif',
            htmlLabels: false,
            markdownAutoWrap: true,
            maxTextSize: 200000,
            maxEdges: 5000,
            flowchart: {
                useMaxWidth: false,
                htmlLabels: false,
                nodeSpacing: 42,
                rankSpacing: 58,
                padding: 22,
                wrappingWidth: 240
            },
            themeVariables: theme === 'dark' ? {
                darkMode: true,
                background: '#1e1e1e',
                mainBkg: '#1e1e1e',
                primaryColor: '#2d2d2d',
                primaryTextColor: '#ffffff',
                primaryBorderColor: '#61dafb',
                lineColor: '#a0a0a0',
                secondaryColor: '#333333',
                tertiaryColor: '#2d2d2d',
                textColor: '#ffffff',
                fontSize: '16px',
                fontFamily: '"Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "Segoe UI", sans-serif',
                fontWeight: '500'
            } : undefined
        };
    },

    _upsertBridgeMermaidOverrideStyle: function(svgElement) {
        const styleId = 'noteconnection-mermaid-overrides';
        let styleNode = svgElement.querySelector('#' + styleId);
        if (!styleNode) {
            styleNode = document.createElementNS('http://www.w3.org/2000/svg', 'style');
            styleNode.setAttribute('id', styleId);
            svgElement.appendChild(styleNode);
        }
        styleNode.textContent = [
            'text, tspan, .nodeLabel, .edgeLabel, .messageText, .loopText, .noteText { fill: #f0f0f0 !important; text-rendering: geometricPrecision !important; }',
            '.node rect, .node circle, .node ellipse, .node polygon, .node path, .basic.label-container, .label-container { fill: #2d2d2d !important; stroke: #61dafb !important; }',
            '.cluster rect, .cluster polygon { fill: none !important; stroke: #61dafb !important; }',
            '.labelBkg, .edgeLabel rect, .edgeLabel polygon, .cluster-label rect, .cluster-label polygon, .note rect { fill: #1e1e1e !important; stroke: #1e1e1e !important; }',
            '.edgePaths path, .flowchart-link, .relationshipLine, .messageLine0, .messageLine1 { stroke: #a0a0a0 !important; fill: none !important; }',
            'marker path, .marker, .arrowheadPath { stroke: #a0a0a0 !important; fill: #a0a0a0 !important; }'
        ].join('\n');
    },

    _sanitizeBridgeMermaidGeneratedStyles: function(svgElement) {
        Array.from(svgElement.querySelectorAll('style')).forEach((styleNode) => {
            if (styleNode.id === 'noteconnection-mermaid-overrides') {
                return;
            }
            const cssText = String(styleNode.textContent || '');
            styleNode.textContent = cssText.replace(/(\.cluster\s+(?:rect|polygon)\s*\{)[^}]*(\})/g, (match, start, end) => {
                return start + 'fill:none;stroke:#61dafb;stroke-width:1px;' + end;
            });
        });
    },

    _applyBridgeSvgAttributes: function(nodes, attributes) {
        Array.from(nodes || []).forEach((node) => {
            Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
        });
    },

    _unionBridgeSvgBounds: function(currentBounds, nextBounds) {
        if (!nextBounds || !Number.isFinite(nextBounds.x) || !Number.isFinite(nextBounds.y) || !Number.isFinite(nextBounds.width) || !Number.isFinite(nextBounds.height) || nextBounds.width <= 0 || nextBounds.height <= 0) {
            return currentBounds;
        }
        if (!currentBounds) {
            return { x: nextBounds.x, y: nextBounds.y, width: nextBounds.width, height: nextBounds.height };
        }
        const minX = Math.min(currentBounds.x, nextBounds.x);
        const minY = Math.min(currentBounds.y, nextBounds.y);
        const maxX = Math.max(currentBounds.x + currentBounds.width, nextBounds.x + nextBounds.width);
        const maxY = Math.max(currentBounds.y + currentBounds.height, nextBounds.y + nextBounds.height);
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    },

    _collectBridgeMermaidLabelBounds: function(group, includePlainTextNodes = false) {
        let combinedBounds = null;
        const labelCandidates = Array.from(group.querySelectorAll('text'));
        if (labelCandidates.length === 0 && includePlainTextNodes) {
            return null;
        }
        labelCandidates.forEach((node) => {
            if (!String((node && node.textContent) || '').trim() || typeof node.getBBox !== 'function') {
                return;
            }
            try {
                combinedBounds = this._unionBridgeSvgBounds(combinedBounds, node.getBBox());
            } catch (error) {
                console.warn('[PathApp] Failed to measure Mermaid label bounds', error);
            }
        });
        return combinedBounds;
    },

    _estimateBridgeTextAnchorBounds: function(textElement) {
        const extraction = this._extractBridgeTextLinesDetailed(textElement);
        const lines = extraction.lines
            .map((line) => this._normalizeBridgeInlineText(line))
            .filter(Boolean);
        if (lines.length === 0) {
            return null;
        }

        const fontSize = this._resolveBridgeSvgFontSize(textElement);
        const lineHeight = Math.max(this._resolveBridgeSvgLineHeight(textElement, fontSize), fontSize * 1.18);
        const estimatedWidth = lines.reduce((max, line) => Math.max(max, this._estimateBridgeTextLineWidth(line, fontSize)), 0);
        const estimatedHeight = Math.max(fontSize, (lineHeight * Math.max(0, lines.length - 1)) + fontSize);
        if (!Number.isFinite(estimatedWidth) || !Number.isFinite(estimatedHeight) || estimatedWidth <= 0 || estimatedHeight <= 0) {
            return null;
        }

        const x = this._parseBridgeNumericAttribute(textElement, 'x', 0);
        const y = this._parseBridgeNumericAttribute(textElement, 'y', 0);
        const rawAnchor = String(this._resolveBridgeTextProperty(textElement, 'text-anchor') || '').trim().toLowerCase();
        const anchor = rawAnchor === 'start' || rawAnchor === 'left'
            ? 'start'
            : (rawAnchor === 'end' || rawAnchor === 'right' ? 'end' : 'middle');

        const widthWithSafety = estimatedWidth * 1.08;
        const heightWithSafety = estimatedHeight + Math.max(2, fontSize * 0.2);
        let left = x - (widthWithSafety / 2);
        if (anchor === 'start') {
            left = x;
        } else if (anchor === 'end') {
            left = x - widthWithSafety;
        }
        const top = y - Math.max(fontSize * 0.84, fontSize - 2);
        return {
            x: left,
            y: top,
            width: widthWithSafety,
            height: heightWithSafety
        };
    },

    _collectBridgeEstimatedLabelBounds: function(group, includePlainTextNodes = false) {
        let combinedBounds = null;
        const labelCandidates = Array.from(group.querySelectorAll('text'));
        if (labelCandidates.length === 0 && includePlainTextNodes) {
            return null;
        }
        labelCandidates.forEach((textNode) => {
            const estimatedBounds = this._estimateBridgeTextAnchorBounds(textNode);
            if (!estimatedBounds) {
                return;
            }
            combinedBounds = this._unionBridgeSvgBounds(combinedBounds, estimatedBounds);
        });
        return combinedBounds;
    },

    _normalizeBridgeInlineText: function(text) {
        if (window._pathUtils) return window._pathUtils.normalizeBridgeInlineText(text);
        return String(text || '').replace(/\s+/g, ' ').trim();
    },

    _parseBridgeNumericAttribute: function(element, name, fallback = 0) {
        if (window._pathUtils) return window._pathUtils.parseBridgeNumericAttribute(element, name, fallback);
        const numeric = Number.parseFloat(String(element?.getAttribute?.(name) || ''));
        return Number.isFinite(numeric) ? numeric : fallback;
    },

    _extractBridgeInlineStyleValue: function(styleValue, propertyName) {
        if (window._pathUtils) return window._pathUtils.extractBridgeInlineStyleValue(styleValue, propertyName);
        if (!styleValue) {
            return null;
        }
        const pattern = new RegExp('(?:^|;)\\s*' + propertyName + '\\s*:\\s*([^;]+)', 'i');
        const match = String(styleValue).match(pattern);
        return match && match[1] ? String(match[1]).trim() : null;
    },

    _resolveBridgeTextProperty: function(element, propertyName) {
        if (window._pathUtils) return window._pathUtils.resolveBridgeTextProperty(element, propertyName);
        let current = element;
        while (current) {
            const attributeValue = current.getAttribute && current.getAttribute(propertyName);
            if (attributeValue && String(attributeValue).trim()) {
                return String(attributeValue).trim();
            }
            const styleValue = this._extractBridgeInlineStyleValue(current.getAttribute && current.getAttribute('style'), propertyName);
            if (styleValue) {
                return styleValue;
            }
            current = current.parentElement || null;
        }
        return null;
    },

    _parseBridgeCssLength: function(lengthValue, baseFontSize) {
        if (window._pathUtils) return window._pathUtils.parseBridgeCssLength(lengthValue, baseFontSize);
        if (!lengthValue) {
            return 0;
        }
        const normalized = String(lengthValue).trim().toLowerCase();
        if (!normalized || normalized === 'normal') {
            return 0;
        }
        const numeric = Number.parseFloat(normalized);
        if (!Number.isFinite(numeric) || numeric <= 0) {
            return 0;
        }
        if (normalized.endsWith('em') || normalized.endsWith('rem')) {
            return numeric * Math.max(10, baseFontSize || 16);
        }
        if (normalized.endsWith('%')) {
            return (numeric / 100) * Math.max(10, baseFontSize || 16);
        }
        return numeric;
    },

    _resolveBridgeSvgFontSize: function(element) {
        if (window._pathUtils) return window._pathUtils.resolveBridgeSvgFontSize(element);
        const resolvedValue = this._resolveBridgeTextProperty(element, 'font-size');
        const parsed = this._parseBridgeCssLength(resolvedValue, 16);
        return parsed > 0 ? parsed : 16;
    },

    _resolveBridgeSvgLineHeight: function(element, fontSize) {
        if (window._pathUtils) return window._pathUtils.resolveBridgeSvgLineHeight(element, fontSize);
        const resolvedValue = this._resolveBridgeTextProperty(element, 'line-height');
        const parsed = this._parseBridgeCssLength(resolvedValue, fontSize);
        return parsed > 0 ? parsed : Math.max(fontSize * 1.18, fontSize + 4);
    },

    _isBridgeWideGlyph: function(char) {
        return /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE6F\uFF01-\uFF60\uFFE0-\uFFE6\u{1F300}-\u{1FAFF}]/u.test(char);
    },

    _estimateBridgeGlyphWidthUnits: function(char) {
        if (window._pathUtils) return window._pathUtils.estimateBridgeGlyphWidthUnits(char);
        if (!char) {
            return 0;
        }
        if (/\s/.test(char)) {
            return 0.35;
        }
        if (this._isBridgeWideGlyph(char)) {
            return 1.02;
        }
        if (/[.,;:!'`|]/.test(char)) {
            return 0.32;
        }
        if (/[(){}\[\]<>]/.test(char)) {
            return 0.46;
        }
        if (/[\\/_-]/.test(char)) {
            return 0.5;
        }
        if (/[0-9]/.test(char)) {
            return 0.62;
        }
        if (/[A-Z]/.test(char)) {
            return 0.72;
        }
        if (/[a-z]/.test(char)) {
            return 0.64;
        }
        return 0.7;
    },

    _estimateBridgeTextLineWidth: function(text, fontSize) {
        if (window._pathUtils) return window._pathUtils.estimateBridgeTextLineWidth(text, fontSize);
        let units = 0;
        for (const char of Array.from(String(text || ''))) {
            units += this._estimateBridgeGlyphWidthUnits(char);
        }
        return Math.max(fontSize * 0.75, (units * fontSize) + Math.max(2, fontSize * 0.12));
    },

    _splitBridgeTokenForWrap: function(token, fontSize, maxLineWidth) {
        if (window._pathUtils) return window._pathUtils.splitBridgeTokenForWrap(token, fontSize, maxLineWidth);
        const wrapped = [];
        let segment = '';
        for (const char of Array.from(token)) {
            const candidate = segment + char;
            if (!segment || this._estimateBridgeTextLineWidth(candidate, fontSize) <= maxLineWidth) {
                segment = candidate;
                continue;
            }
            wrapped.push(segment);
            segment = char;
        }
        if (segment) {
            wrapped.push(segment);
        }
        return wrapped;
    },

    _wrapBridgeMeasurementLine: function(line, fontSize, maxLineWidth) {
        if (window._pathUtils) return window._pathUtils.wrapBridgeMeasurementLine(line, fontSize, maxLineWidth);
        const normalizedLine = this._normalizeBridgeInlineText(line);
        if (!normalizedLine) {
            return [];
        }
        if (this._estimateBridgeTextLineWidth(normalizedLine, fontSize) <= maxLineWidth) {
            return [normalizedLine];
        }

        const maxLines = 12;
        const useSpaceJoin = /\s/.test(normalizedLine);
        const tokens = useSpaceJoin
            ? normalizedLine.split(/\s+/).filter(Boolean)
            : Array.from(normalizedLine);
        const wrappedLines = [];
        let currentLine = '';

        for (const token of tokens) {
            const candidate = !currentLine
                ? token
                : (useSpaceJoin ? `${currentLine} ${token}` : `${currentLine}${token}`);

            if (this._estimateBridgeTextLineWidth(candidate, fontSize) <= maxLineWidth) {
                currentLine = candidate;
                continue;
            }

            if (currentLine) {
                wrappedLines.push(currentLine);
                if (wrappedLines.length >= maxLines) {
                    return wrappedLines.slice(0, maxLines);
                }
                currentLine = '';
            }

            if (this._estimateBridgeTextLineWidth(token, fontSize) <= maxLineWidth) {
                currentLine = token;
                continue;
            }

            const splitTokens = this._splitBridgeTokenForWrap(token, fontSize, maxLineWidth);
            if (splitTokens.length === 0) {
                continue;
            }
            for (let index = 0; index < splitTokens.length - 1; index += 1) {
                wrappedLines.push(splitTokens[index]);
                if (wrappedLines.length >= maxLines) {
                    return wrappedLines.slice(0, maxLines);
                }
            }
            currentLine = splitTokens[splitTokens.length - 1];
        }

        if (currentLine && wrappedLines.length < maxLines) {
            wrappedLines.push(currentLine);
        }
        return wrappedLines.length > 0 ? wrappedLines : [normalizedLine];
    },

    _extractBridgeTextLinesDetailed: function(textElement) {
        const directTextChildren = Array.from(textElement.children || [])
            .filter((child) => String(child.tagName || '').toLowerCase() === 'tspan')
            .map((child) => this._normalizeBridgeInlineText(child.textContent || ''))
            .filter(Boolean);

        const leafDescendantTspans = Array.from(textElement.querySelectorAll('tspan'))
            .filter((child) => !child.querySelector('tspan'))
            .map((child) => this._normalizeBridgeInlineText(child.textContent || ''))
            .filter(Boolean);

        if (directTextChildren.length === 1 && leafDescendantTspans.length > 1) {
            const firstLine = directTextChildren[0];
            const mergedLeafLines = this._normalizeBridgeInlineText(leafDescendantTspans.join(' '));
            const maxLeafLineLength = leafDescendantTspans.reduce((maxLength, line) => Math.max(maxLength, line.length), 0);
            const looksLikeNestedAggregateLine = firstLine.length >= 24 && firstLine.length > maxLeafLineLength * 2;
            if (
                mergedLeafLines
                && (firstLine === mergedLeafLines || firstLine.startsWith(mergedLeafLines) || mergedLeafLines.startsWith(firstLine) || looksLikeNestedAggregateLine)
            ) {
                const canonicalLine = firstLine.length >= mergedLeafLines.length ? firstLine : mergedLeafLines;
                return { lines: [canonicalLine], needsNormalization: true };
            }
        }

        if (directTextChildren.length > 1) {
            const firstLine = directTextChildren[0];
            const remainingLines = directTextChildren.slice(1);
            const mergedRemaining = this._normalizeBridgeInlineText(remainingLines.join(' '));
            const maxRemainingLength = remainingLines.reduce((maxLength, line) => Math.max(maxLength, line.length), 0);
            const looksLikeAggregateLine = firstLine.length >= 32 && remainingLines.length >= 3 && firstLine.length > maxRemainingLength * 2;
            if (
                mergedRemaining
                && (firstLine === mergedRemaining || firstLine.startsWith(mergedRemaining) || mergedRemaining.startsWith(firstLine) || looksLikeAggregateLine)
            ) {
                const canonicalLine = firstLine.length >= mergedRemaining.length ? firstLine : mergedRemaining;
                return { lines: [canonicalLine], needsNormalization: true };
            }
        }

        if (directTextChildren.length > 0) {
            return { lines: directTextChildren, needsNormalization: false };
        }

        const fallbackLines = String(textElement.textContent || '')
            .split(/\r?\n/)
            .map((line) => this._normalizeBridgeInlineText(line))
            .filter(Boolean);
        return {
            lines: fallbackLines.length > 0 ? fallbackLines : [''],
            needsNormalization: false
        };
    },

    _wrapBridgeSvgTextElement: function(textElement, maxLineWidth) {
        const extraction = this._extractBridgeTextLinesDetailed(textElement);
        const baseLines = extraction.lines
            .map((line) => this._normalizeBridgeInlineText(line))
            .filter(Boolean);
        if (baseLines.length === 0) {
            return;
        }

        const fontSize = this._resolveBridgeSvgFontSize(textElement);
        const lineHeight = Math.max(this._resolveBridgeSvgLineHeight(textElement, fontSize), fontSize * 1.18);
        const existingMaxWidth = baseLines.reduce((max, line) => Math.max(max, this._estimateBridgeTextLineWidth(line, fontSize)), 0);
        const exceedsWrapWidth = existingMaxWidth > maxLineWidth + 1;
        if (!exceedsWrapWidth && !extraction.needsNormalization) {
            return;
        }

        const nextLines = [];
        if (exceedsWrapWidth) {
            for (const line of baseLines) {
                const wrappedFromLine = this._wrapBridgeMeasurementLine(line, fontSize, maxLineWidth);
                for (const wrappedLine of wrappedFromLine) {
                    if (nextLines.length >= 12) {
                        break;
                    }
                    nextLines.push(wrappedLine);
                }
                if (nextLines.length >= 12) {
                    break;
                }
            }
        } else {
            nextLines.push(...baseLines);
        }

        if (nextLines.length === 0) {
            return;
        }

        const wrappedMaxWidth = nextLines.reduce((max, line) => Math.max(max, this._estimateBridgeTextLineWidth(line, fontSize)), 0);
        if (
            exceedsWrapWidth
            && !extraction.needsNormalization
            && nextLines.length <= baseLines.length
            && wrappedMaxWidth >= existingMaxWidth - 1
        ) {
            return;
        }

        const ownerDocument = textElement.ownerDocument;
        if (!ownerDocument) {
            return;
        }

        const baseX = this._parseBridgeNumericAttribute(textElement, 'x', 0);
        const baseY = this._parseBridgeNumericAttribute(textElement, 'y', 0);
        const textAnchor = String(textElement.getAttribute('text-anchor') || '').trim();
        const dominantBaseline = String(textElement.getAttribute('dominant-baseline') || '').trim();

        while (textElement.firstChild) {
            textElement.removeChild(textElement.firstChild);
        }
        textElement.setAttribute('x', String(baseX));
        textElement.setAttribute('y', String(baseY));

        nextLines.forEach((line, index) => {
            const tspan = ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'tspan');
            tspan.textContent = line;
            tspan.setAttribute('x', String(baseX));
            if (index === 0) {
                tspan.setAttribute('y', String(baseY));
            } else {
                tspan.setAttribute('dy', String(lineHeight));
            }
            if (textAnchor) {
                tspan.setAttribute('text-anchor', textAnchor);
            }
            if (dominantBaseline) {
                tspan.setAttribute('dominant-baseline', dominantBaseline);
            }
            textElement.appendChild(tspan);
        });
    },

    _wrapBridgeMermaidTextLabels: function(group, maxLineWidth) {
        if (!Number.isFinite(maxLineWidth) || maxLineWidth < 84) {
            return;
        }
        Array.from(group.querySelectorAll('text')).forEach((textNode) => {
            this._wrapBridgeSvgTextElement(textNode, maxLineWidth);
        });
    },

    _findBridgeMermaidShapeNode: function(group) {
        const candidates = Array.from(group.querySelectorAll('rect, polygon, ellipse, circle'));
        if (candidates.length === 0) {
            return null;
        }
        let selected = null;
        let selectedArea = -1;
        candidates.forEach((candidate) => {
            if (typeof candidate.getBBox !== 'function') {
                return;
            }
            try {
                const bbox = candidate.getBBox();
                if (!bbox || !Number.isFinite(bbox.width) || !Number.isFinite(bbox.height) || bbox.width <= 0 || bbox.height <= 0) {
                    return;
                }
                const area = bbox.width * bbox.height;
                if (area > selectedArea) {
                    selected = candidate;
                    selectedArea = area;
                }
            } catch (error) {
                console.warn('[PathApp] Failed to inspect Mermaid shape candidate bounds', error);
            }
        });
        return selected || candidates[0];
    },

    _scaleBridgePolygonPoints: function(pointsValue, centerX, centerY, scaleX, scaleY) {
        if (!pointsValue) {
            return null;
        }
        const scaledPoints = [];
        for (const pair of String(pointsValue).trim().split(/\s+/)) {
            const [rawX, rawY] = pair.split(',');
            const pointX = Number.parseFloat(rawX || '');
            const pointY = Number.parseFloat(rawY || '');
            if (!Number.isFinite(pointX) || !Number.isFinite(pointY)) {
                return null;
            }
            const nextX = centerX + ((pointX - centerX) * scaleX);
            const nextY = centerY + ((pointY - centerY) * scaleY);
            scaledPoints.push(nextX + ',' + nextY);
        }
        return scaledPoints.join(' ');
    },

    _fitBridgeMermaidShapeToBounds: function(shapeNode, shapeBounds, targetWidth, targetHeight) {
        const centerX = shapeBounds.x + (shapeBounds.width / 2);
        const centerY = shapeBounds.y + (shapeBounds.height / 2);
        const tagName = String(shapeNode.tagName || '').toLowerCase();
        if (tagName === 'rect') {
            shapeNode.setAttribute('x', String(centerX - (targetWidth / 2)));
            shapeNode.setAttribute('y', String(centerY - (targetHeight / 2)));
            shapeNode.setAttribute('width', String(targetWidth));
            shapeNode.setAttribute('height', String(targetHeight));
            return;
        }
        if (tagName === 'ellipse') {
            shapeNode.setAttribute('cx', String(centerX));
            shapeNode.setAttribute('cy', String(centerY));
            shapeNode.setAttribute('rx', String(targetWidth / 2));
            shapeNode.setAttribute('ry', String(targetHeight / 2));
            return;
        }
        if (tagName === 'circle') {
            shapeNode.setAttribute('cx', String(centerX));
            shapeNode.setAttribute('cy', String(centerY));
            shapeNode.setAttribute('r', String(Math.max(targetWidth, targetHeight) / 2));
            return;
        }
        if (tagName === 'polygon') {
            const scaleX = shapeBounds.width > 0 ? targetWidth / shapeBounds.width : 1;
            const scaleY = shapeBounds.height > 0 ? targetHeight / shapeBounds.height : 1;
            if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY) || scaleX <= 0 || scaleY <= 0) {
                return;
            }
            const scaledPoints = this._scaleBridgePolygonPoints(shapeNode.getAttribute('points'), centerX, centerY, scaleX, scaleY);
            if (scaledPoints) {
                shapeNode.setAttribute('points', scaledPoints);
            }
        }
    },

    _fitBridgeMermaidLabelShapes: function(svgElement) {
        ['.node', '.edgeLabel'].forEach((selector) => {
            const paddingX = selector === '.edgeLabel' ? 12 : 18;
            const paddingY = selector === '.edgeLabel' ? 10 : 14;
            const minShapeWidth = selector === '.edgeLabel' ? 56 : 108;
            const minShapeHeight = selector === '.edgeLabel' ? 26 : 42;
            const preferredWrapWidth = selector === '.edgeLabel' ? 160 : 200;
            Array.from(svgElement.querySelectorAll(selector)).forEach((group) => {
                const shapeNode = this._findBridgeMermaidShapeNode(group);
                if (!shapeNode || typeof shapeNode.getBBox !== 'function') {
                    return;
                }
                let shapeBounds = null;
                try {
                    shapeBounds = shapeNode.getBBox();
                } catch (error) {
                    console.warn('[PathApp] Failed to measure Mermaid node shape bounds', error);
                    return;
                }
                if (!shapeBounds || !Number.isFinite(shapeBounds.width) || !Number.isFinite(shapeBounds.height) || shapeBounds.width <= 0 || shapeBounds.height <= 0) {
                    return;
                }
                const wrapWidth = Math.max(84, Math.min(preferredWrapWidth, shapeBounds.width - (paddingX * 2)));
                this._wrapBridgeMermaidTextLabels(group, wrapWidth);

                const labelBounds = this._collectBridgeMermaidLabelBounds(group, selector === '.edgeLabel');
                const estimatedLabelBounds = this._collectBridgeEstimatedLabelBounds(group, selector === '.edgeLabel');
                if (!labelBounds && !estimatedLabelBounds) {
                    return;
                }
                const measuredWidth = labelBounds ? labelBounds.width : 0;
                const measuredHeight = labelBounds ? labelBounds.height : 0;
                const estimatedWidth = estimatedLabelBounds ? estimatedLabelBounds.width : 0;
                const estimatedHeight = estimatedLabelBounds ? estimatedLabelBounds.height : 0;
                const effectiveLabelWidth = Math.max(measuredWidth, estimatedWidth);
                const effectiveLabelHeight = Math.max(measuredHeight, estimatedHeight);

                const desiredWidth = Math.max(minShapeWidth, effectiveLabelWidth + (paddingX * 2));
                const desiredHeight = Math.max(minShapeHeight, effectiveLabelHeight + (paddingY * 2));
                const targetWidth = shapeBounds.width > desiredWidth + 8
                    ? desiredWidth
                    : Math.max(shapeBounds.width, desiredWidth);
                const targetHeight = shapeBounds.height > desiredHeight + 6
                    ? desiredHeight
                    : Math.max(shapeBounds.height, desiredHeight);
                const widthChanged = Math.abs(targetWidth - shapeBounds.width) > 1;
                const heightChanged = Math.abs(targetHeight - shapeBounds.height) > 1;
                if (!widthChanged && !heightChanged) {
                    return;
                }
                this._fitBridgeMermaidShapeToBounds(shapeNode, shapeBounds, targetWidth, targetHeight);
            });
        });
    },

    _normalizeBridgeMermaidSvg: function(svgElement) {
        if (!svgElement) {
            return;
        }
        svgElement.style.background = 'transparent';
        this._sanitizeBridgeMermaidGeneratedStyles(svgElement);
        Array.from(svgElement.querySelectorAll('foreignObject')).forEach((node) => node.remove());
        this._applyBridgeSvgAttributes(svgElement.querySelectorAll('text, tspan, .nodeLabel, .edgeLabel, .messageText, .loopText, .noteText'), {
            fill: '#f0f0f0',
            'text-rendering': 'geometricPrecision'
        });
        this._applyBridgeSvgAttributes(svgElement.querySelectorAll('.node rect, .node circle, .node ellipse, .node polygon, .node path'), {
            fill: '#2d2d2d',
            stroke: '#61dafb'
        });
        this._applyBridgeSvgAttributes(svgElement.querySelectorAll('.cluster rect, .cluster polygon'), {
            fill: 'none',
            stroke: '#61dafb'
        });
        this._applyBridgeSvgAttributes(svgElement.querySelectorAll('.labelBkg, .edgeLabel rect, .edgeLabel polygon, .cluster-label rect, .cluster-label polygon, .note rect'), {
            fill: '#1e1e1e',
            stroke: '#1e1e1e'
        });
        this._applyBridgeSvgAttributes(svgElement.querySelectorAll('.edgePaths path, .flowchart-link, .relationshipLine, .messageLine0, .messageLine1'), {
            stroke: '#a0a0a0',
            fill: 'none'
        });
        this._applyBridgeSvgAttributes(svgElement.querySelectorAll('marker path, .marker, .arrowheadPath'), {
            stroke: '#a0a0a0',
            fill: '#a0a0a0'
        });
        this._upsertBridgeMermaidOverrideStyle(svgElement);
    },

    _clampBridgeMermaidSize: function(width, height, maxWidth, maxHeight) {
        const safeWidth = Math.max(1, Math.ceil(Number(width) || 1));
        const safeHeight = Math.max(1, Math.ceil(Number(height) || 1));
        const requestedMaxWidth = Number.isFinite(Number(maxWidth)) && Number(maxWidth) > 0 ? Math.floor(Number(maxWidth)) : safeWidth;
        const requestedMaxHeight = Number.isFinite(Number(maxHeight)) && Number(maxHeight) > 0 ? Math.floor(Number(maxHeight)) : safeHeight;
        const scale = Math.min(1, requestedMaxWidth / safeWidth, requestedMaxHeight / safeHeight);
        if (!Number.isFinite(scale) || scale >= 1) {
            return { width: safeWidth, height: safeHeight };
        }
        return {
            width: Math.max(1, Math.floor(safeWidth * scale)),
            height: Math.max(1, Math.floor(safeHeight * scale))
        };
    },

    _extractBridgeMermaidSvgSize: function(svgElement) {
        const viewBox = String(svgElement.getAttribute('viewBox') || '').trim().split(/\s+/).map((value) => Number.parseFloat(value)).filter((value) => Number.isFinite(value));
        const widthAttr = Number.parseFloat(String(svgElement.getAttribute('width') || ''));
        const heightAttr = Number.parseFloat(String(svgElement.getAttribute('height') || ''));
        return {
            width: Number.isFinite(widthAttr) && widthAttr > 0 ? widthAttr : (viewBox.length === 4 ? viewBox[2] : 1),
            height: Number.isFinite(heightAttr) && heightAttr > 0 ? heightAttr : (viewBox.length === 4 ? viewBox[3] : 1)
        };
    },

    _serializeBridgeMermaidSvg: function(svgElement) {
        return new XMLSerializer().serializeToString(svgElement);
    },

    _captureBridgeMermaidStage: function(stageName, svgElement) {
        const size = this._extractBridgeMermaidSvgSize(svgElement);
        return {
            stage: stageName,
            svg: this._serializeBridgeMermaidSvg(svgElement),
            width: Math.max(1, Math.round(size.width || 1)),
            height: Math.max(1, Math.round(size.height || 1))
        };
    },

    _tightenBridgeMermaidSvgBounds: function(svgElement) {
        const fallbackSize = this._extractBridgeMermaidSvgSize(svgElement);
        const measurementCandidates = [
            svgElement.querySelector('g.output'),
            svgElement.querySelector('g.root'),
            svgElement.querySelector('g'),
            svgElement
        ];
        const padding = 24;
        for (const candidate of measurementCandidates) {
            if (!candidate || typeof candidate.getBBox !== 'function') {
                continue;
            }
            try {
                const bounds = candidate.getBBox();
                if (!bounds || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height) || bounds.width <= 1 || bounds.height <= 1) {
                    continue;
                }
                const width = Math.max(48, Math.ceil(bounds.width + (padding * 2)));
                const height = Math.max(48, Math.ceil(bounds.height + (padding * 2)));
                const minX = Math.floor(bounds.x - padding);
                const minY = Math.floor(bounds.y - padding);
                svgElement.setAttribute('viewBox', `${minX} ${minY} ${width} ${height}`);
                svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                return { width, height };
            } catch (error) {
                console.warn('[PathApp] Failed to tighten Mermaid bounds', error);
            }
        }

        const width = Math.max(1, Math.ceil(fallbackSize.width));
        const height = Math.max(1, Math.ceil(fallbackSize.height));
        svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        return { width, height };
    },

    _renderMermaidForBridge: async function(payload) {
        if (!window.mermaid) {
            throw new Error('Mermaid runtime is unavailable in the frontend renderer.');
        }

        const requestId = String(payload?.requestId || '').trim();
        const source = String(payload?.source || '').trim();
        if (!requestId || !source) {
            throw new Error('Mermaid render request is missing a request id or source.');
        }

        const includeStages = payload?.includeStages === true;
        const includeSvg = includeStages || payload?.includeSvg === true;
        const stageSnapshots = [];
        const theme = String(payload?.theme || 'dark') === 'default' ? 'default' : 'dark';
        window.mermaid.initialize(this._getBridgeMermaidConfig(theme));

        const requestedWidth = Number.isFinite(Number(payload?.maxWidth)) && Number(payload.maxWidth) > 0 ? Math.floor(Number(payload.maxWidth)) : 1600;
        const hostWidth = Math.max(480, requestedWidth);
        const host = document.createElement('div');
        host.style.position = 'fixed';
        host.style.left = '-20000px';
        host.style.top = '0';
        host.style.width = String(hostWidth) + 'px';
        host.style.minWidth = String(hostWidth) + 'px';
        host.style.height = 'auto';
        host.style.overflow = 'visible';
        host.style.opacity = '0';
        host.style.pointerEvents = 'none';
        host.style.background = 'transparent';
        host.style.fontFamily = '"Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "Segoe UI", sans-serif';
        document.body.appendChild(host);

        let objectUrl = null;
        try {
            const renderId = 'bridge-mermaid-' + Date.now() + '-' + Math.random().toString(16).slice(2);
            const result = await window.mermaid.render(renderId, source, host);
            let svgElement = host.querySelector('svg');
            if (!svgElement) {
                const parser = new DOMParser();
                const documentSvg = parser.parseFromString(result.svg, 'image/svg+xml');
                const parsedSvg = documentSvg.querySelector('svg');
                if (!parsedSvg) {
                    throw new Error('Frontend Mermaid renderer did not produce an SVG root.');
                }
                host.replaceChildren(parsedSvg);
                svgElement = host.querySelector('svg');
            }
            if (!svgElement) {
                throw new Error('Frontend Mermaid renderer did not produce an SVG root.');
            }

            svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            svgElement.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
            if (includeStages) {
                stageSnapshots.push(this._captureBridgeMermaidStage('raw', svgElement));
            }

            this._normalizeBridgeMermaidSvg(svgElement);
            if (includeStages) {
                stageSnapshots.push(this._captureBridgeMermaidStage('visual_normalized', svgElement));
            }

            this._fitBridgeMermaidLabelShapes(svgElement);
            if (includeStages) {
                stageSnapshots.push(this._captureBridgeMermaidStage('labels_fitted', svgElement));
            }

            const naturalSize = this._tightenBridgeMermaidSvgBounds(svgElement);
            const clampedSize = this._clampBridgeMermaidSize(naturalSize.width, naturalSize.height, payload?.maxWidth, payload?.maxHeight);
            const requestedRenderScale = Number.isFinite(Number(payload?.renderScale)) && Number(payload.renderScale) > 0 ? Number(payload.renderScale) : 1;
            const rasterScale = Math.min(4, Math.max(1, requestedRenderScale));
            const rasterWidth = Math.max(1, Math.round(clampedSize.width * rasterScale));
            const rasterHeight = Math.max(1, Math.round(clampedSize.height * rasterScale));
            svgElement.setAttribute('width', String(rasterWidth));
            svgElement.setAttribute('height', String(rasterHeight));
            svgElement.style.maxWidth = String(rasterWidth) + 'px';
            svgElement.style.background = 'transparent';

            const serializedSvg = this._serializeBridgeMermaidSvg(svgElement);
            if (includeStages) {
                stageSnapshots.push({
                    stage: 'final',
                    svg: serializedSvg,
                    width: rasterWidth,
                    height: rasterHeight
                });
            }

            const blob = new Blob([serializedSvg], { type: 'image/svg+xml;charset=utf-8' });
            objectUrl = URL.createObjectURL(blob);

            const image = await new Promise((resolve, reject) => {
                const nextImage = new Image();
                nextImage.onload = () => resolve(nextImage);
                nextImage.onerror = () => reject(new Error('Browser rasterization failed to load the Mermaid SVG.'));
                nextImage.src = objectUrl;
            });

            const canvas = document.createElement('canvas');
            canvas.width = rasterWidth;
            canvas.height = rasterHeight;
            const context = canvas.getContext('2d', { alpha: true });
            if (!context) {
                throw new Error('Unable to create a browser canvas for Mermaid rasterization.');
            }
            context.fillStyle = '#05070b';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0, canvas.width, canvas.height);

            return {
                requestId,
                ok: true,
                renderer: 'frontend-bridge',
                svg: includeSvg ? serializedSvg : undefined,
                pngBase64: canvas.toDataURL('image/png').split(',')[1],
                width: canvas.width,
                height: canvas.height,
                stages: includeStages ? stageSnapshots : undefined
            };
        } finally {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
            host.remove();
        }
    },

    _handleBridgeMermaidRenderRequest: function(payload) {
        const requestId = String(payload?.requestId || '').trim();
        if (!requestId) {
            return;
        }

        const work = async () => {
            try {
                console.log('[PathApp] Mermaid bridge render request:', requestId);
                const rendered = await this._renderMermaidForBridge(payload || {});
                this._sendBridgeMessage('renderMermaidResult', rendered);
            } catch (error) {
                console.error('[PathApp] Mermaid bridge render failed:', error);
                this._sendBridgeMessage('renderMermaidResult', {
                    requestId,
                    ok: false,
                    error: error && error.message ? error.message : String(error)
                });
            }
        };

        this.bridgeMermaidRenderQueue = Promise.resolve(this.bridgeMermaidRenderQueue).then(work, work);
    },

    _normalizeBridgeStringList: function(values) {
        if (!Array.isArray(values)) {
            return [];
        }
        return values
            .map((item) => {
                if (typeof item === 'string') {
                    return item.trim();
                }
                if (item && typeof item === 'object' && typeof item.id === 'string') {
                    return item.id.trim();
                }
                return String(item ?? '').trim();
            })
            .filter((item) => item.length > 0);
    },

    _stableBridgeStringify: function(value) {
        if (Array.isArray(value)) {
            return '[' + value.map((entry) => this._stableBridgeStringify(entry)).join(',') + ']';
        }
        if (value && typeof value === 'object') {
            return '{' + Object.keys(value)
                .sort((left, right) => left.localeCompare(right))
                .map((key) => JSON.stringify(key) + ':' + this._stableBridgeStringify(value[key]))
                .join(',') + '}';
        }
        return JSON.stringify(value ?? null);
    },

    _buildBridgeTransportSummary: function(payload) {
        const safePayload = payload && typeof payload === 'object' ? payload : {};
        const central = safePayload.central && typeof safePayload.central === 'object' ? safePayload.central : {};
        const metadata = central.metadata && typeof central.metadata === 'object' ? central.metadata : {};
        const progress = safePayload.progress && typeof safePayload.progress === 'object' ? safePayload.progress : {};
        const pathNodes = Array.isArray(safePayload.pathNodes) ? safePayload.pathNodes : [];
        const peripherals = Array.isArray(safePayload.peripherals) ? safePayload.peripherals : [];
        const completedIds = Array.isArray(safePayload.completedIds) ? safePayload.completedIds : [];
        const treeLayout = safePayload.treeLayout && typeof safePayload.treeLayout === 'object' ? safePayload.treeLayout : null;
        const treeNodes = treeLayout && Array.isArray(treeLayout.nodes) ? treeLayout.nodes : [];
        return {
            centralId: typeof central.id === 'string' ? central.id : '',
            totalNodes: Number.isFinite(Number(safePayload.totalNodes)) ? Math.max(0, Math.trunc(Number(safePayload.totalNodes))) : pathNodes.length,
            pathNodeCount: pathNodes.length,
            pathNodeIds: this._normalizeBridgeStringList(pathNodes.map((node) => node && typeof node === 'object' ? node.id : node)),
            peripheralIds: this._normalizeBridgeStringList(peripherals.map((node) => node && typeof node === 'object' ? node.id : node)),
            completedIds: this._normalizeBridgeStringList(completedIds).sort((left, right) => left.localeCompare(right)),
            treeNodeIds: this._normalizeBridgeStringList(treeNodes.map((node) => node && typeof node === 'object' ? node.id : node)),
            progressCompleted: Number.isFinite(Number(progress.completed)) ? Math.max(0, Math.trunc(Number(progress.completed))) : 0,
            progressTotal: Number.isFinite(Number(progress.total)) ? Math.max(0, Math.trunc(Number(progress.total))) : pathNodes.length,
            mode: typeof safePayload.mode === 'string' ? safePayload.mode : '',
            filepath: typeof metadata.filepath === 'string' ? metadata.filepath : ''
        };
    },

    _computeBridgeTransportFingerprint: function(summary) {
        const normalized = this._stableBridgeStringify(summary);
        let hash = 2166136261;
        for (let index = 0; index < normalized.length; index += 1) {
            hash ^= normalized.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    },

    _createBridgeTransportMeta: function(payload, sourceTag = 'frontend') {
        const summary = this._buildBridgeTransportSummary(payload);
        return {
            schemaVersion: 1,
            source: sourceTag,
            generatedAt: Date.now(),
            summary,
            fingerprint: this._computeBridgeTransportFingerprint(summary)
        };
    },

    _sendBridgeStatus: function(level, code, message, details = {}, terminal = false) {
        return this._sendBridgeMessage('pathStatus', {
            level,
            code,
            message,
            details,
            terminal,
            timestamp: Date.now()
        });
    },

    _sanitizeTargetIds: function(candidateIds) {
        if (!Array.isArray(candidateIds)) {
            return [];
        }
        const uniqueIds = [];
        const seen = new Set();
        candidateIds.forEach((id) => {
            if (typeof id !== 'string') return;
            const normalized = id.trim();
            if (!normalized || seen.has(normalized)) return;
            seen.add(normalized);
            uniqueIds.push(normalized);
        });
        return uniqueIds;
    },

    _getDefaultTargetIds: function(limit = 1) {
        const maxCount = Math.max(0, Number.isFinite(limit) ? Math.floor(limit) : 0);
        if (maxCount <= 0) return [];
        const result = [];
        const seen = new Set();
        const appendCandidate = (rawId) => {
            if (typeof rawId !== 'string') return;
            const normalized = rawId.trim();
            if (!normalized || seen.has(normalized)) return;
            seen.add(normalized);
            result.push(normalized);
        };

        const sourceData = this._getSourceGraphData();
        if (sourceData && Array.isArray(sourceData.nodes)) {
            sourceData.nodes.forEach((node) => appendCandidate(node?.id));
        }
        if (result.length < maxCount && Array.isArray(this.nodes)) {
            this.nodes.forEach((node) => appendCandidate(node?.id));
        }

        return result.slice(0, maxCount);
    },

    _isTauriMode: function() {
        const hasTauriGlobal = typeof window !== 'undefined' && !!window.__TAURI__;
        const runtimeCaps = (typeof window !== 'undefined' && window.__NC_RUNTIME_CAPS) ? window.__NC_RUNTIME_CAPS : null;
        const hasDesktopRuntimeCaps = !!(runtimeCaps && runtimeCaps.supports_sidecar === true);
        const userAgent = typeof navigator !== 'undefined' ? String(navigator.userAgent || '') : '';
        return hasTauriGlobal || hasDesktopRuntimeCaps || userAgent.includes('Tauri');
    },

    _getModeValue: function() {
        if (this._isTauriMode()) {
            return this.runtimeConfig.mode || (this.currentTargetId ? 'diffusion' : 'domain');
        }
        return document.getElementById('learning-mode')?.value || 'domain';
    },

    _getStrategyValue: function() {
        if (this._isTauriMode()) {
            return this.runtimeConfig.strategy || 'foundational';
        }
        return document.getElementById('strategy')?.value || 'foundational';
    },

    _getLayoutValue: function() {
        if (this._isTauriMode()) {
            // Layout is backend-defaulted to Track(Focus) in Tauri flow.
            return 'orbital';
        }
        return document.getElementById('layout-style')?.value || 'orbital';
    },

    _getRetainHistoryEnabled: function() {
        if (this._isTauriMode()) {
            return this.runtimeConfig.retainHistory !== false;
        }
        return document.getElementById('set-retain-history')?.checked ?? true;
    },

    _toggleHistorySidebar: function() {
        const sidebar = document.getElementById('learning-history-sidebar');
        if (!sidebar) return;
        sidebar.style.zIndex = '3000';
        if (sidebar.style.display === 'none' || sidebar.style.display === '') {
            sidebar.style.display = 'flex';
            sidebar.offsetHeight;
            setTimeout(() => {
                sidebar.style.transform = 'translateX(0)';
            }, 10);
        } else {
            sidebar.style.transform = 'translateX(100%)';
            setTimeout(() => {
                sidebar.style.display = 'none';
            }, 300);
        }
    },

    _normalizeLearningWorkbenchUserId: function(rawValue) {
        const candidate = String(rawValue || '')
            .trim()
            .toLowerCase()
            .replace(/[^\p{L}\p{N}_-]+/gu, '_')
            .replace(/_+/g, '_');
        if (!candidate) {
            return 'path_user_default';
        }
        return candidate.slice(0, 64);
    },

    _restoreLearningWorkbenchPreferences: function() {
        try {
            const stored = localStorage.getItem('nc_learning_workbench_prefs');
            if (!stored) {
                return;
            }
            const parsed = JSON.parse(stored);
            if (parsed && typeof parsed === 'object' && typeof parsed.userId === 'string') {
                this.learningWorkbench.userId = this._normalizeLearningWorkbenchUserId(parsed.userId);
            }
        } catch (error) {
            console.warn('[PathApp] Failed to restore learning workbench prefs:', error);
        }
    },

    _persistLearningWorkbenchPreferences: function() {
        try {
            const payload = {
                userId: this._normalizeLearningWorkbenchUserId(this.learningWorkbench.userId),
            };
            localStorage.setItem('nc_learning_workbench_prefs', JSON.stringify(payload));
        } catch (error) {
            console.warn('[PathApp] Failed to persist learning workbench prefs:', error);
        }
    },

    _toggleLearningWorkbenchSidebar: function() {
        const sidebar = document.getElementById('learning-workbench-sidebar');
        if (!sidebar) return;
        sidebar.style.zIndex = '3001';
        if (sidebar.style.display === 'none' || sidebar.style.display === '') {
            sidebar.style.display = 'flex';
            sidebar.offsetHeight;
            setTimeout(() => {
                sidebar.style.transform = 'translateX(0)';
            }, 10);
            void this.refreshLearningWorkbench({ force: false });
            return;
        }
        this._closeLearningWorkbenchSidebar();
    },

    _closeLearningWorkbenchSidebar: function() {
        const sidebar = document.getElementById('learning-workbench-sidebar');
        if (!sidebar) return;
        sidebar.style.transform = 'translateX(-100%)';
        setTimeout(() => {
            sidebar.style.display = 'none';
        }, 300);
    },

    _setLearningWorkbenchStatus: function(message, isError = false) {
        const statusEl = document.getElementById('learning-workbench-status');
        if (!statusEl) return;
        statusEl.textContent = String(message || '');
        statusEl.classList.toggle('is-error', !!isError);
        statusEl.classList.toggle('is-loading', this.learningWorkbench.loading === true);
    },

    _requestLearningApi: async function(endpoint, payload = {}) {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload || {}),
        });

        let body = null;
        try {
            body = await response.json();
        } catch (_error) {
            body = null;
        }

        if (!response.ok) {
            const message = body && body.error
                ? body.error
                : `Request failed (${response.status})`;
            throw new Error(String(message));
        }
        if (!body || body.success !== true) {
            const message = body && body.error
                ? body.error
                : `API ${endpoint} returned an unexpected response`;
            throw new Error(String(message));
        }
        return body.result;
    },

    _getFocusAtomIdsForLearning: function() {
        const ids = [];
        if (typeof this.currentTargetId === 'string' && this.currentTargetId.trim()) {
            ids.push(this.currentTargetId.trim());
        }
        if (Array.isArray(this.currentTargetIds)) {
            this.currentTargetIds.forEach((id) => {
                if (typeof id === 'string' && id.trim()) {
                    ids.push(id.trim());
                }
            });
        }
        if (typeof this.centralNodeId === 'string' && this.centralNodeId.trim()) {
            ids.push(this.centralNodeId.trim());
        }
        return Array.from(new Set(ids));
    },

    _getCurrentFocusNode: function() {
        const sourceData = this._getSourceGraphData();
        if (!sourceData || !Array.isArray(sourceData.nodes)) {
            return null;
        }
        const preferredIds = this._getFocusAtomIdsForLearning();
        for (const candidateId of preferredIds) {
            const matched = sourceData.nodes.find((node) => node && node.id === candidateId);
            if (matched) {
                return matched;
            }
        }
        if (typeof this.centralNodeId === 'string' && this.centralNodeId.trim()) {
            const matched = sourceData.nodes.find((node) => node && node.id === this.centralNodeId);
            if (matched) {
                return matched;
            }
        }
        return this.nodes && this.nodes.length > 0 ? this.nodes[0] : null;
    },

    _buildLearningDocumentFromNode: function(node) {
        if (!node || typeof node !== 'object') {
            return null;
        }
        const nodeId = typeof node.id === 'string' ? node.id.trim() : '';
        if (!nodeId) {
            return null;
        }
        const normalizedDocId = `path_${nodeId.toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 96)}`;
        const sourcePathRaw = node?.metadata?.filepath
            || node?.filepath
            || `Knowledge_Base/path_mode/${normalizedDocId}.md`;
        const sourcePath = String(sourcePathRaw || '').replace(/\\/g, '/');
        const title = typeof node.label === 'string' && node.label.trim()
            ? node.label.trim()
            : nodeId;
        const contentRaw = typeof node.content === 'string'
            ? node.content
            : (typeof node.summary === 'string' ? node.summary : '');
        const content = String(contentRaw || '').trim();
        const finalContent = content.length > 0
            ? `# ${title}\n\n${content}`
            : `# ${title}\n\nNode ${nodeId} was captured from Path Mode for learning orchestration.`;
        return {
            documentId: normalizedDocId,
            sourcePath,
            language: 'en',
            content: finalContent,
        };
    },

    ingestFocusNodeForLearningWorkbench: async function() {
        const focusNode = this._getCurrentFocusNode();
        if (!focusNode) {
            this._setLearningWorkbenchStatus('No focus node available to ingest.', true);
            return;
        }

        const document = this._buildLearningDocumentFromNode(focusNode);
        if (!document) {
            this._setLearningWorkbenchStatus('Failed to build ingest document from focus node.', true);
            return;
        }

        this.learningWorkbench.loading = true;
        this.learningWorkbench.lastError = '';
        this._setLearningWorkbenchStatus('Ingesting focus node into learning graph...');
        try {
            const result = await this._requestLearningApi('/api/knowledge/ingest', {
                incremental: true,
                relationRecomputeMode: 'incremental',
                documents: [document],
            });
            const changedDocs = Number(result?.summary?.changedDocuments || 0);
            this._setLearningWorkbenchStatus(`Ingest succeeded. Changed documents: ${changedDocs}.`);
            await this.refreshLearningWorkbench({ force: true });
        } catch (error) {
            const message = String(error?.message || error || 'Unknown ingest error');
            this.learningWorkbench.lastError = message;
            this._setLearningWorkbenchStatus(`Ingest failed: ${message}`, true);
        } finally {
            this.learningWorkbench.loading = false;
            this._renderLearningWorkbenchState();
        }
    },

    refreshLearningWorkbench: async function(options = {}) {
        if (this.learningWorkbench.loading) {
            return;
        }
        const userId = this._normalizeLearningWorkbenchUserId(this.learningWorkbench.userId);
        this.learningWorkbench.userId = userId;
        this._persistLearningWorkbenchPreferences();
        this.learningWorkbench.loading = true;
        this.learningWorkbench.lastError = '';
        this._setLearningWorkbenchStatus('Refreshing learning workbench...');
        this._renderLearningWorkbenchState();

        const focusAtomIds = this._getFocusAtomIdsForLearning();
        const includeDivergence = true;
        const includeRetrain = true;
        try {
            const [sessionPlan, qualitySnapshot, misconceptions, runtimeState, sessionHistory] = await Promise.all([
                this._requestLearningApi('/api/knowledge/session/plan', {
                    userId,
                    focusAtomIds,
                    maxActions: 14,
                    includeDivergence,
                    includeRetrain,
                }),
                this._requestLearningApi('/api/knowledge/quality/snapshot', {
                    userId,
                }),
                this._requestLearningApi('/api/knowledge/mastery/misconceptions', {
                    userId,
                    atomIds: focusAtomIds,
                    topK: 6,
                }),
                fetch('/api/knowledge/state', { method: 'GET' })
                    .then((response) => response.json())
                    .catch(() => null),
                this._requestLearningApi('/api/knowledge/session/history', {
                    userId,
                    limit: 8,
                }),
            ]);
            this.learningWorkbench.sessionPlan = sessionPlan || null;
            this.learningWorkbench.qualitySnapshot = qualitySnapshot || null;
            this.learningWorkbench.misconceptions = misconceptions || null;
            this.learningWorkbench.runtimeState = runtimeState && runtimeState.success === true
                ? runtimeState
                : null;
            this.learningWorkbench.sessionHistory = sessionHistory || null;
            this.learningWorkbench.lastUpdatedAt = new Date().toISOString();

            const actionCount = Number(sessionPlan?.summary?.totalActions || sessionPlan?.actions?.length || 0);
            this._setLearningWorkbenchStatus(`Learning workbench updated. Planned actions: ${actionCount}.`);
        } catch (error) {
            const message = String(error?.message || error || 'Unknown refresh error');
            this.learningWorkbench.lastError = message;
            this._setLearningWorkbenchStatus(`Refresh failed: ${message}`, true);
        } finally {
            this.learningWorkbench.loading = false;
            this._renderLearningWorkbenchState();
        }
    },

    _escapeHtml: function(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    _collectOptionalAnswerForLearningAction: function(actionKind, atomId) {
        const normalized = String(actionKind || '').trim().toLowerCase();
        if (!['quiz', 'review', 'explain'].includes(normalized)) {
            return '';
        }
        if (typeof window === 'undefined' || typeof window.prompt !== 'function') {
            return '';
        }
        const promptMessage = `Optional: enter learner answer for ${actionKind} on ${atomId}.\nLeave empty to skip mastery diagnostics.`;
        const answer = window.prompt(promptMessage, '');
        if (typeof answer !== 'string') {
            return '';
        }
        return answer.trim();
    },

    _collectOptionalAnswersForSessionActions: function(actions = []) {
        if (typeof window === 'undefined' || typeof window.prompt !== 'function') {
            return {};
        }
        if (!Array.isArray(actions) || actions.length === 0) {
            return {};
        }
        const confirmation = window.prompt(
            'Provide learner answers for this session run? Type "yes" to enable, leave empty to skip.',
            ''
        );
        if (!confirmation || !/^y(es)?$/i.test(String(confirmation).trim())) {
            return {};
        }
        const answerMap = {};
        const promptableActions = actions
            .filter((action) => ['quiz', 'review', 'explain'].includes(String(action?.kind || '').trim().toLowerCase()))
            .slice(0, 6);
        promptableActions.forEach((action) => {
            const actionId = String(action?.id || '').trim();
            if (!actionId) {
                return;
            }
            const atomId = String(action?.atomId || 'unknown_atom').trim();
            const actionKind = String(action?.kind || 'action').trim();
            const promptText = `Optional answer for ${actionKind} on ${atomId} (leave empty to skip):`;
            const answer = window.prompt(promptText, '');
            if (typeof answer !== 'string') {
                return;
            }
            const normalized = answer.trim();
            if (normalized.length > 0) {
                answerMap[actionId] = normalized;
            }
        });
        return answerMap;
    },

    _appendLearningWorkbenchSessionRecord: function(record) {
        if (!record || typeof record !== 'object') {
            return;
        }
        const recordId = String(record.id || '').trim();
        if (!recordId) {
            return;
        }
        const base = this.learningWorkbench.sessionHistory && typeof this.learningWorkbench.sessionHistory === 'object'
            ? this.learningWorkbench.sessionHistory
            : {
                userId: this.learningWorkbench.userId,
                generatedAt: new Date().toISOString(),
                records: [],
                summary: {
                    totalRecords: 0,
                    totalExecutedActions: 0,
                    totalUpdatedMasteryCount: 0,
                    averageMasteryDelta: 0,
                    averageTutorConfidence: 0,
                },
            };
        const existingRecords = Array.isArray(base.records) ? base.records.slice() : [];
        const deduped = [record, ...existingRecords.filter((item) => String(item?.id || '').trim() !== recordId)].slice(0, 8);
        this.learningWorkbench.sessionHistory = {
            ...base,
            generatedAt: new Date().toISOString(),
            records: deduped,
            summary: {
                ...(base.summary || {}),
                totalRecords: deduped.length,
                totalExecutedActions: deduped.reduce((sum, item) => sum + Number(item?.executedCount || 0), 0),
                totalUpdatedMasteryCount: deduped.reduce((sum, item) => sum + Number(item?.updatedMasteryCount || 0), 0),
                averageMasteryDelta: deduped.length > 0
                    ? deduped.reduce((sum, item) => sum + Number(item?.averageMasteryDelta || 0), 0) / deduped.length
                    : 0,
                averageTutorConfidence: deduped.length > 0
                    ? deduped.reduce((sum, item) => sum + Number(item?.averageTutorConfidence || 0), 0) / deduped.length
                    : 0,
            },
        };
    },

    executeLearningWorkbenchAction: async function(params = {}) {
        const userId = this._normalizeLearningWorkbenchUserId(this.learningWorkbench.userId);
        const atomId = String(params.atomId || '').trim();
        const actionKind = String(params.actionKind || '').trim();
        const source = String(params.source || '').trim();
        if (!atomId || !actionKind) {
            this._setLearningWorkbenchStatus('Invalid action payload for tutor execution.', true);
            return;
        }
        const answer = this._collectOptionalAnswerForLearningAction(actionKind, atomId);
        const shouldAnalyzeAnswer = answer.length > 0;

        this.learningWorkbench.loading = true;
        this._setLearningWorkbenchStatus(`Running session action (${actionKind}) for ${atomId}...`);
        this._renderLearningWorkbenchState();
        try {
            const result = await this._requestLearningApi('/api/knowledge/session/action', {
                userId,
                action: {
                    atomId,
                    kind: actionKind,
                    source: source || 'session_plan',
                    prompt: `Learning workbench action: ${actionKind} from ${source || 'session_plan'}`,
                    answer: shouldAnalyzeAnswer ? answer : undefined,
                },
                autoAnalyzeAnswer: shouldAnalyzeAnswer,
                autoUpdateMasteryFromAnswer: shouldAnalyzeAnswer,
                persistMemory: true,
                memoryLayer: 'session',
            });
            const tutorResult = result && result.tutor ? result.tutor : null;
            this.learningWorkbench.tutorFeedback = {
                atomId,
                actionKind,
                source,
                result,
                tutorResult,
                receivedAt: new Date().toISOString(),
            };
            const tutorActionKind = result?.trace?.tutorActionKind || 'unknown';
            const persistedMemory = result?.trace?.persistedMemory === true;
            const updatedMastery = result?.trace?.updatedMastery === true;
            const effectiveOutcome = result?.trace?.effectiveOutcome || 'n/a';
            const masterySource = result?.trace?.masterySource || 'none';
            this._setLearningWorkbenchStatus(
                `Session action finished (${tutorActionKind}); memory ${persistedMemory ? 'persisted' : 'skipped'}; mastery ${updatedMastery ? `updated (${effectiveOutcome}, ${masterySource})` : 'unchanged'}.`
            );
        } catch (error) {
            const message = String(error?.message || error || 'Unknown tutor execution error');
            this.learningWorkbench.lastError = message;
            this._setLearningWorkbenchStatus(`Tutor action failed: ${message}`, true);
        } finally {
            this.learningWorkbench.loading = false;
            this._renderLearningWorkbenchState();
        }
    },

    runLearningWorkbenchSession: async function(options = {}) {
        if (this.learningWorkbench.loading) {
            return;
        }
        const userId = this._normalizeLearningWorkbenchUserId(this.learningWorkbench.userId);
        const sessionPlan = this.learningWorkbench.sessionPlan;
        if (!sessionPlan || !Array.isArray(sessionPlan.actions) || sessionPlan.actions.length === 0) {
            this._setLearningWorkbenchStatus('No session plan actions to execute. Refresh first.', true);
            return;
        }
        let actionLimit = Number(options.actionLimit);
        if (!Number.isFinite(actionLimit) || actionLimit <= 0) {
            if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
                const suggestedLimit = Math.min(3, sessionPlan.actions.length);
                const raw = window.prompt(
                    `Run how many planned actions? (1-${Math.min(20, sessionPlan.actions.length)})`,
                    String(suggestedLimit)
                );
                if (raw === null) {
                    this._setLearningWorkbenchStatus('Session execution canceled.');
                    return;
                }
                actionLimit = Number(raw);
            } else {
                actionLimit = Math.min(3, sessionPlan.actions.length);
            }
        }
        actionLimit = Math.max(1, Math.min(20, Math.floor(Number(actionLimit) || 1), sessionPlan.actions.length));
        const selectedActions = sessionPlan.actions.slice(0, actionLimit);
        const answersByActionId = this._collectOptionalAnswersForSessionActions(selectedActions);
        const answerCount = Object.keys(answersByActionId).length;
        const autoAnalyzeAnswer = answerCount > 0;

        this.learningWorkbench.loading = true;
        this._setLearningWorkbenchStatus(`Running session plan execution for top ${actionLimit} actions...`);
        this._renderLearningWorkbenchState();
        try {
            const result = await this._requestLearningApi('/api/knowledge/session/execute', {
                userId,
                executionKind: 'session',
                sessionPlan,
                actionLimit,
                answersByActionId,
                autoAnalyzeAnswer,
                autoUpdateMasteryFromAnswer: autoAnalyzeAnswer,
                persistMemory: true,
                memoryLayer: 'session',
            });
            this.learningWorkbench.sessionExecution = {
                ...result,
                receivedAt: new Date().toISOString(),
            };
            this._appendLearningWorkbenchSessionRecord(result?.record || null);
            const firstExecuted = Array.isArray(result?.items)
                ? result.items.find((item) => item && item.status === 'executed' && item.result)
                : null;
            if (firstExecuted && firstExecuted.result) {
                this.learningWorkbench.tutorFeedback = {
                    atomId: firstExecuted.action?.atomId || '',
                    actionKind: firstExecuted.action?.kind || '',
                    source: firstExecuted.action?.source || 'session_plan',
                    result: firstExecuted.result,
                    tutorResult: firstExecuted.result?.tutor || null,
                    receivedAt: new Date().toISOString(),
                };
            }
            const summary = result?.summary || {};
            const retestCount = Number(result?.retestPlan?.summary?.totalActions || 0);
            this._setLearningWorkbenchStatus(
                `Session execution finished: executed ${Number(summary.executedCount || 0)}/${Number(summary.attemptedActions || 0)}, mastery updates ${Number(summary.updatedMasteryCount || 0)}, analyzed answers ${Number(summary.analyzedAnswerCount || 0)} (input=${answerCount}), retest actions ${retestCount}.`
            );
        } catch (error) {
            const message = String(error?.message || error || 'Unknown session execution error');
            this.learningWorkbench.lastError = message;
            this._setLearningWorkbenchStatus(`Session execution failed: ${message}`, true);
        } finally {
            this.learningWorkbench.loading = false;
            this._renderLearningWorkbenchState();
        }
    },

    runLearningWorkbenchRetestSession: async function() {
        if (this.learningWorkbench.loading) {
            return;
        }
        const userId = this._normalizeLearningWorkbenchUserId(this.learningWorkbench.userId);
        const existingExecution = this.learningWorkbench.sessionExecution || null;
        const retestActions = Array.isArray(existingExecution?.retestPlan?.actions)
            ? existingExecution.retestPlan.actions
            : [];
        if (retestActions.length === 0) {
            this._setLearningWorkbenchStatus('No immediate retest actions available. Run a session first.', true);
            return;
        }
        const answersByActionId = this._collectOptionalAnswersForSessionActions(retestActions);
        const answerCount = Object.keys(answersByActionId).length;
        const autoAnalyzeAnswer = answerCount > 0;
        const generatedAt = new Date().toISOString();
        const totalEstimatedMinutes = retestActions.reduce(
            (sum, action) => sum + Number(action?.estimatedMinutes || 0),
            0
        );
        const retestSessionPlan = {
            userId,
            generatedAt,
            actions: retestActions,
            signals: {
                misconceptions: [],
                dueRetrainAtoms: Array.from(new Set(retestActions.map((action) => String(action.atomId || '').trim()))),
                masteryPathTargets: [],
                divergenceTargets: [],
            },
            summary: {
                totalActions: retestActions.length,
                totalEstimatedMinutes,
                evidenceCoverageRatio: 1,
            },
        };

        this.learningWorkbench.loading = true;
        this._setLearningWorkbenchStatus(`Running immediate retest for ${retestActions.length} actions...`);
        this._renderLearningWorkbenchState();
        try {
            const result = await this._requestLearningApi('/api/knowledge/session/execute', {
                userId,
                executionKind: 'retest',
                sessionPlan: retestSessionPlan,
                actionLimit: retestActions.length,
                answersByActionId,
                autoAnalyzeAnswer,
                autoUpdateMasteryFromAnswer: autoAnalyzeAnswer,
                persistMemory: true,
                memoryLayer: 'session',
                includeRetestPlan: false,
            });
            this.learningWorkbench.sessionExecution = {
                ...result,
                receivedAt: new Date().toISOString(),
            };
            this._appendLearningWorkbenchSessionRecord(result?.record || null);
            const summary = result?.summary || {};
            this._setLearningWorkbenchStatus(
                `Retest execution finished: executed ${Number(summary.executedCount || 0)}/${Number(summary.attemptedActions || 0)}, mastery delta ${Number(summary.averageMasteryDelta || 0).toFixed(3)}.`
            );
        } catch (error) {
            const message = String(error?.message || error || 'Unknown retest execution error');
            this.learningWorkbench.lastError = message;
            this._setLearningWorkbenchStatus(`Retest execution failed: ${message}`, true);
        } finally {
            this.learningWorkbench.loading = false;
            this._renderLearningWorkbenchState();
        }
    },

    _renderLearningWorkbenchState: function() {
        const userIdInput = document.getElementById('learning-user-id');
        if (userIdInput && userIdInput.value !== this.learningWorkbench.userId) {
            userIdInput.value = this.learningWorkbench.userId;
        }

        const qualityEl = document.getElementById('learning-quality-summary');
        const misconceptionEl = document.getElementById('learning-misconception-list');
        const actionsEl = document.getElementById('learning-session-actions');
        const runtimeEl = document.getElementById('learning-runtime-summary');
        const updatedEl = document.getElementById('learning-workbench-updated-at');
        const tutorFeedbackEl = document.getElementById('learning-tutor-feedback');
        const sessionExecutionEl = document.getElementById('learning-session-execution');
        const sessionHistoryEl = document.getElementById('learning-session-history');

        if (updatedEl) {
            updatedEl.textContent = this.learningWorkbench.lastUpdatedAt
                ? `Last updated: ${new Date(this.learningWorkbench.lastUpdatedAt).toLocaleString()}`
                : 'Last updated: -';
        }

        if (qualityEl) {
            const snapshot = this.learningWorkbench.qualitySnapshot?.snapshot || null;
            if (!snapshot) {
                qualityEl.innerHTML = '<li class="muted">No quality snapshot yet.</li>';
            } else {
                qualityEl.innerHTML = [
                    `<li>Retest pass rate: <strong>${Number(snapshot.retestPassRatePct || 0).toFixed(2)}%</strong></li>`,
                    `<li>Misconception recurrence: <strong>${Number(snapshot.misconceptionRecurrenceRatePct || 0).toFixed(2)}%</strong></li>`,
                    `<li>Evidence-backed suggestions: <strong>${Number(snapshot.evidenceBackedSuggestionRatioPct || 0).toFixed(2)}%</strong></li>`,
                    `<li>Path gain vs random: <strong>${Number(snapshot.averagePathMasteryGainPct || 0).toFixed(2)}% / ${Number(snapshot.randomPathMasteryGainPct || 0).toFixed(2)}%</strong></li>`,
                    `<li>Query p95: <strong>${Number(snapshot.queryP95Ms || 0).toFixed(2)} ms</strong></li>`,
                ].join('');
            }
        }

        if (misconceptionEl) {
            const items = this.learningWorkbench.misconceptions?.items || [];
            if (!Array.isArray(items) || items.length === 0) {
                misconceptionEl.innerHTML = '<li class="muted">No recurring misconceptions detected.</li>';
            } else {
                misconceptionEl.innerHTML = items.map((item) => {
                    const tag = String(item.errorTag || 'unknown');
                    const count = Number(item.count || 0);
                    const severity = Number(item.severityScore || 0).toFixed(3);
                    return `<li><span class="chip">${tag}</span> count=${count}, severity=${severity}</li>`;
                }).join('');
            }
        }

        if (actionsEl) {
            const actions = this.learningWorkbench.sessionPlan?.actions || [];
            if (!Array.isArray(actions) || actions.length === 0) {
                actionsEl.innerHTML = '<li class="muted">No session actions yet.</li>';
            } else {
                actionsEl.innerHTML = actions.slice(0, 10).map((action) => {
                    const source = String(action.source || 'unknown');
                    const kind = String(action.kind || 'action');
                    const atomId = String(action.atomId || '');
                    const minutes = Number(action.estimatedMinutes || 0);
                    const safeKind = this._escapeHtml(kind);
                    const safeSource = this._escapeHtml(source);
                    const safeAtomId = this._escapeHtml(atomId);
                    const encodedKind = encodeURIComponent(kind);
                    const encodedAtomId = encodeURIComponent(atomId);
                    const encodedSource = encodeURIComponent(source);
                    return `
                        <li>
                          <div><strong>${safeKind}</strong> <span class="chip">${safeSource}</span> <code>${safeAtomId}</code> (${minutes}m)</div>
                          <button
                            class="btn-small workbench-run-action"
                            data-action-kind="${encodedKind}"
                            data-atom-id="${encodedAtomId}"
                            data-action-source="${encodedSource}"
                            type="button"
                          >
                            Ask Tutor
                          </button>
                        </li>
                    `;
                }).join('');
            }
        }

        if (tutorFeedbackEl) {
            const tutorFeedback = this.learningWorkbench.tutorFeedback;
            if (!tutorFeedback || !tutorFeedback.result) {
                tutorFeedbackEl.textContent = 'No tutor feedback yet.';
            } else {
                const trace = tutorFeedback.result?.trace || {};
                const tutorResult = tutorFeedback.tutorResult || tutorFeedback.result?.tutor || {};
                const message = String(tutorResult.message || '').trim();
                const safeMessage = message.length > 0 ? message : 'Tutor returned an empty message.';
                const answerAnalysis = tutorFeedback.result?.answerAnalysis || null;
                const answerAnalysisMessage = String(answerAnalysis?.message || '').trim();
                const safeAnswerAnalysis = answerAnalysisMessage.length > 0
                    ? answerAnalysisMessage
                    : 'No answer analysis was generated.';
                tutorFeedbackEl.textContent = [
                    `Action: ${tutorFeedback.actionKind} (${trace.tutorActionKind || 'unknown'})`,
                    `Atom: ${tutorFeedback.atomId}`,
                    `Memory persisted: ${trace.persistedMemory === true ? 'yes' : 'no'}`,
                    `Mastery updated: ${trace.updatedMastery === true ? 'yes' : 'no'} (${trace.masterySource || 'none'})`,
                    `Outcome/Error: ${trace.effectiveOutcome || 'n/a'} / ${trace.effectiveErrorTag || 'n/a'}`,
                    safeMessage,
                    '',
                    'Answer Analysis:',
                    safeAnswerAnalysis,
                ].join('\n');
            }
        }

        if (sessionExecutionEl) {
            const execution = this.learningWorkbench.sessionExecution;
            if (!execution || !execution.summary) {
                sessionExecutionEl.textContent = 'No session execution yet.';
            } else {
                const summary = execution.summary || {};
                const masteryDelta = execution.masteryDelta || null;
                const retestPlan = execution.retestPlan || null;
                const topDeltaLines = Array.isArray(masteryDelta?.items)
                    ? masteryDelta.items.slice(0, 3).map((item) => {
                        const before = Number(item.beforeMastery || 0).toFixed(3);
                        const after = Number(item.afterMastery || 0).toFixed(3);
                        const delta = Number(item.deltaMastery || 0);
                        const signedDelta = `${delta >= 0 ? '+' : ''}${delta.toFixed(3)}`;
                        const atomId = String(item.atomId || 'unknown_atom');
                        return `- ${atomId}: ${before} -> ${after} (${signedDelta})`;
                    })
                    : [];
                const retestPreviewLines = Array.isArray(retestPlan?.actions)
                    ? retestPlan.actions.slice(0, 3).map((action) => {
                        const atomId = String(action.atomId || 'unknown_atom');
                        const kind = String(action.kind || 'action');
                        const source = String(action.source || 'retrain_plan');
                        return `- ${kind} @ ${atomId} (${source})`;
                    })
                    : [];
                sessionExecutionEl.textContent = [
                    `Executed at: ${execution.executedAt || '-'}`,
                    `Planned/Attempted/Executed: ${Number(summary.plannedActions || 0)}/${Number(summary.attemptedActions || 0)}/${Number(summary.executedCount || 0)}`,
                    `Skipped/Failed: ${Number(summary.skippedCount || 0)}/${Number(summary.failedCount || 0)}`,
                    `Mastery updates (inferred/explicit): ${Number(summary.updatedMasteryCount || 0)} (${Number(summary.inferredMasteryCount || 0)}/${Number(summary.explicitMasteryCount || 0)})`,
                    `Answer analyzed: ${Number(summary.analyzedAnswerCount || 0)}, memory persisted: ${Number(summary.memoryPersistedCount || 0)}`,
                    `Avg tutor confidence: ${Number(summary.averageTutorConfidence || 0).toFixed(3)}`,
                    `Mastery avg before/after/delta: ${Number(summary.averageMasteryBefore || 0).toFixed(3)} / ${Number(summary.averageMasteryAfter || 0).toFixed(3)} / ${Number(summary.averageMasteryDelta || 0).toFixed(3)}`,
                    `Mastery movement improved/regressed/flat: ${Number(summary.improvedAtomCount || 0)}/${Number(summary.regressedAtomCount || 0)}/${Number(summary.unchangedAtomCount || 0)}`,
                    `Stopped early: ${summary.stoppedEarly === true ? 'yes' : 'no'}`,
                    ...(masteryDelta
                        ? [
                            `Compared atoms: ${Number(masteryDelta.comparedAtoms || 0)}, avg delta: ${Number(masteryDelta.averageDelta || 0).toFixed(3)}`,
                            'Top mastery delta atoms:',
                            ...(topDeltaLines.length > 0 ? topDeltaLines : ['- n/a']),
                        ]
                        : []),
                    ...(retestPlan
                        ? [
                            `Immediate retest actions: ${Number(retestPlan.summary?.totalActions || 0)}`,
                            'Retest preview:',
                            ...(retestPreviewLines.length > 0 ? retestPreviewLines : ['- n/a']),
                        ]
                        : []),
                ].join('\n');
            }
        }

        if (sessionHistoryEl) {
            const records = this.learningWorkbench.sessionHistory?.records || [];
            if (!Array.isArray(records) || records.length === 0) {
                sessionHistoryEl.innerHTML = '<li class="muted">No session history yet.</li>';
            } else {
                sessionHistoryEl.innerHTML = records.slice(0, 8).map((record) => {
                    const executedAt = new Date(record.executedAt || Date.now()).toLocaleString();
                    const kind = this._escapeHtml(String(record.executionKind || 'session'));
                    const executedCount = Number(record.executedCount || 0);
                    const attempted = Number(record.attemptedActions || 0);
                    const delta = Number(record.averageMasteryDelta || 0);
                    const signedDelta = `${delta >= 0 ? '+' : ''}${delta.toFixed(3)}`;
                    return `<li><span class="chip">${kind}</span> ${executedAt} · ${executedCount}/${attempted} · mastery Δ ${signedDelta}</li>`;
                }).join('');
            }
        }

        if (runtimeEl) {
            const runtimeState = this.learningWorkbench.runtimeState?.state || null;
            if (!runtimeState) {
                runtimeEl.textContent = 'Runtime: unavailable';
            } else {
                const sessionTelemetry = runtimeState.sessionActionTelemetry || null;
                const historyCount = Number(runtimeState.sessionExecutionHistoryRecords || 0);
                const sessionSummary = sessionTelemetry
                    ? `, sessionActions=${Number(sessionTelemetry.executionCount || 0)}, inferred=${Number(sessionTelemetry.inferredMasteryUpdateCount || 0)}, explicit=${Number(sessionTelemetry.explicitMasteryUpdateCount || 0)}, history=${historyCount}`
                    : `, history=${historyCount}`;
                runtimeEl.textContent = `Runtime: docs=${runtimeState.documents}, atoms=${runtimeState.activeAtoms}, relations=${runtimeState.activeRelationEdges}, ingestP95=${Number(runtimeState.ingestTelemetry?.ingestP95Ms || 0).toFixed(2)}ms${sessionSummary}`;
            }
        }
    },

    openEmbeddedNoteMD: async function(options = {}) {
        const shouldRestoreMainView = options.restoreMainView !== false;
        if (shouldRestoreMainView) {
            this.exitPathMode();
        }

        const embeddedNoteMD = (typeof window !== 'undefined') ? window.NoteConnectionEmbeddedNoteMD : null;
        if (embeddedNoteMD && typeof embeddedNoteMD.open === 'function') {
            embeddedNoteMD.open({
                source: options.source || 'path-app'
            });
            return;
        }

        const overlay = document.getElementById('notemd-embed-overlay');
        const iframe = document.getElementById('notemd-embed-frame');
        if (overlay && iframe) {
            if (iframe.getAttribute('src') !== 'notemd.html') {
                iframe.setAttribute('src', 'notemd.html');
            }
            overlay.style.display = 'flex';
            return;
        }

        try {
            if (
                window.__TAURI__ &&
                window.__TAURI__.core &&
                typeof window.__TAURI__.core.invoke === 'function'
            ) {
                await window.__TAURI__.core.invoke('open_notemd');
                return;
            }
        } catch (error) {
            console.warn('[PathApp] open_notemd invoke failed:', error);
        }

        window.location.href = 'notemd.html';
    },

    requestFullApplicationShutdown: async function(options = {}) {
        try {
            if (
                window.__TAURI__ &&
                window.__TAURI__.core &&
                typeof window.__TAURI__.core.invoke === 'function'
            ) {
                await window.__TAURI__.core.invoke('shutdown_application', {
                    reason: options.source || 'path-app-bridge-request'
                });
                return;
            }
        } catch (error) {
            console.warn('[PathApp] shutdown_application invoke failed:', error);
        }

        try {
            window.close();
        } catch (_error) {
            // Ignore fallback errors in browser mode.
        }
    },

    exitPathMode: function() {
        const pathContainer = document.getElementById('path-container');
        const graphWrapper = document.getElementById('graph-wrapper');
        const sidebar = document.getElementById('learning-history-sidebar');
        const workbenchSidebar = document.getElementById('learning-workbench-sidebar');

        if (pathContainer) pathContainer.style.display = 'none';
        if (graphWrapper) graphWrapper.style.display = 'block';
        if (sidebar) {
            sidebar.style.transform = 'translateX(100%)';
            sidebar.style.display = 'none';
        }
        if (workbenchSidebar) {
            workbenchSidebar.style.transform = 'translateX(-100%)';
            workbenchSidebar.style.display = 'none';
        }
        const multiWindowOptions = this._resolveMultiWindowOptions();
        
        // Single-window toggle: hide Godot, show Tauri.
        // 单窗口切换：隐藏 Godot，显示 Tauri。
        if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
            // 1. Hide Godot window via PathBridge WebSocket.
            if (multiWindowOptions.singleWindowMode) {
                void this.requestBridgeWindowVisibility(false, {
                    waitMs: 1200,
                    reason: 'exit-pathmode'
                });
            }
            // 2. Restore Tauri window via Rust IPC.
            if (multiWindowOptions.restoreTauriWhenPathmodeExits) {
                window.__TAURI__.core.invoke('toggle_pathmode_window', { showGodot: false })
                    .then(() => console.log('[PathApp] Single-window toggle: Godot hidden, Tauri restored.'))
                    .catch((err) => console.warn('[PathApp] toggle_pathmode_window restore failed:', err));
            }
        }

        window.dispatchEvent(new Event('resize'));
    },

    applyRemoteConfigure: function(config) {
        if (!config || typeof config !== 'object') return;

        const incomingTargetId = typeof config.targetId === 'string'
            ? config.targetId
            : (typeof config.target_id === 'string' ? config.target_id : null);

        if (typeof config.language === 'string') {
            const normalizedLanguage = this._normalizeLanguageCode(config.language);
            if (
                window.i18n &&
                typeof window.i18n.setLanguage === 'function' &&
                window.i18n.currentLanguage !== normalizedLanguage
            ) {
                void window.i18n.setLanguage(normalizedLanguage).catch((error) => {
                    console.warn('[PathApp] Failed to apply language from remote configure payload:', error);
                });
            }
        }

        if (typeof config.mode === 'string') {
            this.runtimeConfig.mode = config.mode === 'diffusion' ? 'diffusion' : 'domain';
        }
        if (typeof config.strategy === 'string') {
            this.runtimeConfig.strategy = config.strategy === 'core' ? 'core' : 'foundational';
        }
        if (Array.isArray(config.targetIds)) {
            const sanitizedTargetIds = this._sanitizeTargetIds(config.targetIds);
            this.runtimeConfig.targetIds = sanitizedTargetIds;
            this.currentTargetIds = sanitizedTargetIds;
        }
        if (incomingTargetId !== null) {
            this.runtimeConfig.targetId = incomingTargetId || null;
            this.currentTargetId = incomingTargetId || null;
        }

        const sanitizedRuntimeTargetIds = this._sanitizeTargetIds(this.runtimeConfig.targetIds);
        if (this.runtimeConfig.mode === 'diffusion') {
            if (sanitizedRuntimeTargetIds.length === 0 && typeof this.runtimeConfig.targetId === 'string' && this.runtimeConfig.targetId.trim()) {
                sanitizedRuntimeTargetIds.push(this.runtimeConfig.targetId.trim());
            }
            if (sanitizedRuntimeTargetIds.length > 0) {
                const preferredTarget = (typeof this.runtimeConfig.targetId === 'string' && this.runtimeConfig.targetId.trim())
                    ? this.runtimeConfig.targetId.trim()
                    : sanitizedRuntimeTargetIds[0];
                const primaryTarget = sanitizedRuntimeTargetIds.includes(preferredTarget) ? preferredTarget : sanitizedRuntimeTargetIds[0];
                this.runtimeConfig.targetId = primaryTarget;
                this.currentTargetId = primaryTarget;
                this.runtimeConfig.targetIds = sanitizedRuntimeTargetIds;
                this.currentTargetIds = sanitizedRuntimeTargetIds;
            }
        } else {
            this.runtimeConfig.targetIds = sanitizedRuntimeTargetIds;
            this.currentTargetIds = sanitizedRuntimeTargetIds;
        }
        if (typeof config.auto_reconstruct === 'boolean') {
            this.runtimeConfig.autoReconstruct = config.auto_reconstruct;
        }
        if (typeof config.retain_history === 'boolean') {
            this.runtimeConfig.retainHistory = config.retain_history;
        }

        if (this._isTauriMode()) {
            this.runtimeConfig.layout = 'orbital';
        } else if (typeof config.layout === 'string') {
            this.runtimeConfig.layout = config.layout;
        }

        // Keep DOM controls in sync for browser mode compatibility/debugging.
        const modeEl = document.getElementById('learning-mode');
        const strategyEl = document.getElementById('strategy');
        const layoutEl = document.getElementById('layout-style');
        if (modeEl) modeEl.value = this.runtimeConfig.mode;
        if (strategyEl) strategyEl.value = this.runtimeConfig.strategy;
        if (layoutEl) layoutEl.value = this._getLayoutValue();

        // Trigger recompute only when worker is ready.
        if (this.worker) {
            this.triggerUpdate();
        }
    },

    _respondToBridgePathRequest: function(source = 'main') {
        const hasLivePath = Array.isArray(this.nodes) && this.nodes.length > 0 && !!this.centralNodeId;
        if (hasLivePath) {
            this._sendBridgeStatus(
                'info',
                'path_request_received',
                'Frontend received a path request and is recomputing the latest path.',
                {
                    source,
                    centralId: this.centralNodeId,
                    nodeCount: this.nodes.length,
                    hasTreeLayout: !!this.lastTreeLayout
                },
                false
            );
            this.triggerUpdate();
            return;
        }

        const sourceData = this._getSourceGraphData();
        const fallbackCentralId = this._getPreferredStandaloneCentralId();
        if (sourceData && Array.isArray(sourceData.nodes) && sourceData.nodes.length > 0 && fallbackCentralId) {
            this.centralNodeId = fallbackCentralId;
            this._sendBridgeStatus(
                'info',
                'path_request_standalone',
                'Frontend is serving the request from local graph data.',
                {
                    source,
                    centralId: fallbackCentralId,
                    graphNodeCount: sourceData.nodes.length
                },
                false
            );
            this.sendPathToBridgeStandalone(fallbackCentralId);
            return;
        }

        this._sendBridgeStatus(
            'warning',
            'path_not_ready',
            'Frontend path data is not ready yet.',
            {
                source,
                hasGraphData: !!(sourceData && Array.isArray(sourceData.nodes) && sourceData.nodes.length > 0),
                hasNodes: Array.isArray(this.nodes) && this.nodes.length > 0,
                centralNodeId: this.centralNodeId || null,
                currentTargetId: this.currentTargetId || null,
                runtimeTargetId: this.runtimeConfig.targetId || null
            },
            false
        );
    },

    // Save completed nodes to localStorage
    _saveCompletedNodes: function() {
        try {
            const ids = Array.from(this.completedNodes);
            localStorage.setItem('pathMode_completedNodes', JSON.stringify(ids));
        } catch (e) {
            console.warn('[PathApp] Failed to save completed nodes:', e);
        }
    },
    
    // Load completed nodes from localStorage
    _loadCompletedNodes: function() {
        try {
            const stored = localStorage.getItem('pathMode_completedNodes');
            if (stored) {
                const ids = JSON.parse(stored);
                this.completedNodes = new Set(ids);
                console.log('[PathApp] Loaded', ids.length, 'completed nodes from storage');
            }
        } catch (e) {
            console.warn('[PathApp] Failed to load completed nodes:', e);
        }
    },

    // New Collapse Logic
    _saveCollapsedNodes: function() {
        try {
            const ids = Array.from(this.collapsedNodes);
            localStorage.setItem('pathMode_collapsedNodes', JSON.stringify(ids));
            localStorage.setItem('pathMode_expansionOrder', JSON.stringify(this.expansionOrder));
        } catch (e) { console.warn('Failed save collapsed', e); }
    },

    _loadCollapsedNodes: function() {
        try {
            const stored = localStorage.getItem('pathMode_collapsedNodes');
            if (stored) {
                const ids = JSON.parse(stored);
                this.collapsedNodes = new Set(ids);
            }
            const storedExp = localStorage.getItem('pathMode_expansionOrder');
            if (storedExp) {
                this.expansionOrder = JSON.parse(storedExp);
            }
        } catch (e) { console.warn('Failed load collapsed', e); }
    },

    toggleNodeCollapse: function(nodeId) {
        if (!nodeId) return;
        if (this.collapsedNodes.has(nodeId)) {
            // Un-collapse (Expand)
            this.collapsedNodes.delete(nodeId);
            if (!this.expansionOrder.includes(nodeId)) {
                this.expansionOrder.push(nodeId);
            }
        } else {
            // Collapse
            this.collapsedNodes.add(nodeId);
            this.expansionOrder = this.expansionOrder.filter(id => id !== nodeId);
        }
        this._saveCollapsedNodes();
        this.triggerUpdate(); // Recalculate layout
    },

    expandPrereqs: function(nodeId) {
        if (!nodeId) return;
        this.collapsedNodes.delete(nodeId);
        if (!this.expansionOrder.includes(nodeId)) {
            this.expansionOrder.push(nodeId);
        }
        if (!this.forcedExpansionNodes.has(nodeId)) {
            this.forcedExpansionNodes.add(nodeId);
        }
        this._saveCollapsedNodes();
        this.triggerUpdate();
    },

    collapsePrereqs: function(nodeId) {
        if (!nodeId) return;
        this.collapsedNodes.add(nodeId);
        this.expansionOrder = this.expansionOrder.filter(id => id !== nodeId);
        if (this.forcedExpansionNodes.has(nodeId)) {
            this.forcedExpansionNodes.delete(nodeId);
        }
        this._saveCollapsedNodes();
        this.triggerUpdate();
    },

    collapseAll: function() {
        this.expansionOrder.forEach(id => this.collapsedNodes.add(id));
        this.expansionOrder = [];
        this.forcedExpansionNodes.clear();
        this._saveCollapsedNodes();
        this.triggerUpdate();
    },

    sendPathToBridge: function(result) {
        console.log('[PathApp] sendPathToBridge called. WS state:', this.ws?.readyState, 'Nodes:', result?.nodes?.length);

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('[PathApp] WebSocket not open, cannot send pathResult');
            return;
        }

        const centralId = this.centralNodeId;
        console.log('[PathApp] Looking for centralId:', centralId);

        const centralPathNode = result.nodes.find(n => n.id === centralId) || null;
        const centralNode = this._getFullNodeById(centralId, centralPathNode);
        if (!centralNode) {
            console.error('[PathApp] Central node not found anywhere! ID:', centralId);
            this._sendBridgeStatus(
                'error',
                'path_central_missing',
                'Central node is missing while preparing path data for the bridge.',
                {
                    centralId: centralId || null,
                    nodeCount: Array.isArray(result?.nodes) ? result.nodes.length : 0
                },
                true
            );
            return;
        }

        const candidates = result.nodes.filter(n => n.id !== centralId);
        const edges = result.edges || [];

        const peripherals = candidates.map(node => {
            const isIncoming = edges.some(e => {
                const sourceId = typeof e.source === 'object' ? e.source.id : e.source;
                const targetId = typeof e.target === 'object' ? e.target.id : e.target;
                return sourceId === node.id && targetId === centralId;
            });
            const isOutgoing = edges.some(e => {
                const sourceId = typeof e.source === 'object' ? e.source.id : e.source;
                const targetId = typeof e.target === 'object' ? e.target.id : e.target;
                return sourceId === centralId && targetId === node.id;
            });

            let priority = 0;
            if (isIncoming) priority = 2;
            else if (isOutgoing) priority = 1;

            return {
                ...node,
                priority: priority,
                totalDegree: (node.inDegree || 0) + (node.outDegree || 0)
            };
        });

        peripherals.sort((a, b) => {
            if (b.priority !== a.priority) return b.priority - a.priority;
            return b.totalDegree - a.totalDegree;
        });

        const selectedPeripherals = peripherals.slice(0, 4).map((node) => {
            const fullNode = this._getFullNodeById(node.id, node) || node;
            const serialized = this._serializeBridgeNode(fullNode, node.label || node.id) || {
                id: node.id,
                label: node.label || node.id,
                content: '',
                metadata: {}
            };
            return {
                ...serialized,
                relation: node.priority === 2 ? 'prerequisite' : 'association'
            };
        });

        const payload = {
            central: this._serializeBridgeNode(centralNode, centralPathNode?.label || centralId),
            peripherals: selectedPeripherals,
            progress: {
                completed: this.completedNodes.size,
                total: result.nodes.length
            },
            totalNodes: result.nodes.length,
            pathNodes: result.nodes.map((node) => {
                const fullNode = this._getFullNodeById(node.id, node) || node;
                const serialized = this._serializeBridgeNode(fullNode, node.label || node.id) || {
                    id: node.id,
                    label: node.label || node.id,
                    content: '',
                    metadata: {}
                };
                return {
                    ...serialized,
                    parentId: this._findParentId(node.id, result.edges)
                };
            }),
            availableTargets: this._buildAvailableTargetCatalog(),
            treeLayout: result.treeLayout || null,
            completedIds: Array.from(this.completedNodes),
            mode: 'orbital'
        };
        payload._bridgeTransport = this._createBridgeTransportMeta(payload, 'frontend');

        console.log('[PathApp] treeLayout in result:', result.treeLayout ? ((result.treeLayout.nodes?.length || 0) + ' nodes') : 'NULL/UNDEFINED');
        console.log('[PathApp] Sending pathResult with central:', payload.central.label, 'peripherals:', selectedPeripherals.length, 'totalNodes:', payload.totalNodes, 'filepath:', payload.central.metadata?.filepath || 'missing', 'fingerprint:', payload._bridgeTransport.fingerprint);
        this._sendBridgeMessage('pathResult', payload);
        console.log('[PathApp] pathResult SENT to Bridge');
    },

    _getSourceGraphData: function() {
        if (typeof graphData !== 'undefined' && graphData && Array.isArray(graphData.nodes)) {
            return graphData;
        }
        if (window.graphData && Array.isArray(window.graphData.nodes)) {
            return window.graphData;
        }
        return null;
    },

    _buildAvailableTargetCatalog: function() {
        const sourceData = this._getSourceGraphData();
        const sourceNodes = (sourceData && Array.isArray(sourceData.nodes) && sourceData.nodes.length > 0)
            ? sourceData.nodes
            : (Array.isArray(this.nodes) ? this.nodes : []);
        const catalog = [];
        const seen = new Set();
        sourceNodes.forEach((node) => {
            const id = typeof node?.id === 'string' ? node.id.trim() : '';
            if (!id || seen.has(id)) {
                return;
            }
            seen.add(id);
            catalog.push({
                id,
                label: typeof node?.label === 'string' && node.label.trim().length > 0 ? node.label : id
            });
        });
        return catalog;
    },

    _getPreferredStandaloneCentralId: function(preferredNodeId = null) {
        const sourceData = this._getSourceGraphData();
        let highlightedNodeId = null;
        if (typeof window !== 'undefined' && window.highlightManager && typeof window.highlightManager.getState === 'function') {
            highlightedNodeId = window.highlightManager.getState()?.currentNode?.id || null;
        }
        if (preferredNodeId) {
            return preferredNodeId;
        }
        if (highlightedNodeId) {
            return highlightedNodeId;
        }
        if (this.centralNodeId) {
            return this.centralNodeId;
        }
        if (this.currentTargetId) {
            return this.currentTargetId;
        }
        if (this.runtimeConfig && this.runtimeConfig.targetId) {
            return this.runtimeConfig.targetId;
        }
        if (sourceData && Array.isArray(sourceData.nodes) && sourceData.nodes.length > 0) {
            return sourceData.nodes[0].id || null;
        }
        return null;
    },

    _getFullNodeById: function(nodeId, fallbackNode = null) {
        if (!nodeId) {
            return fallbackNode || null;
        }

        const sourceData = this._getSourceGraphData();
        if (sourceData) {
            const sourceNode = sourceData.nodes.find(n => n.id === nodeId);
            if (sourceNode) {
                return fallbackNode ? { ...fallbackNode, ...sourceNode } : sourceNode;
            }
        }

        const localNode = this.nodes.find(n => n.id === nodeId);
        if (localNode) {
            return fallbackNode ? { ...fallbackNode, ...localNode } : localNode;
        }

        return fallbackNode || null;
    },

    _serializeBridgeNode: function(node, fallbackLabel = '') {
        if (!node) {
            return null;
        }

        const metadata = node.metadata && typeof node.metadata === 'object' ? { ...node.metadata } : {};
        return {
            id: node.id,
            label: node.label || fallbackLabel || node.id,
            content: typeof node.content === 'string' ? node.content : '',
            metadata: metadata,
            inDegree: node.inDegree || 0,
            outDegree: node.outDegree || 0
        };
    },
    
    // Helper to find parent node ID for tree structure
    _findParentId: function(nodeId, edges, allowedIds = null) {
        const incomingEdge = edges.find(e => {
            const sourceId = typeof e.source === 'object' ? e.source.id : e.source;
            const targetId = typeof e.target === 'object' ? e.target.id : e.target;
            if (targetId !== nodeId) {
                return false;
            }
            return !allowedIds || allowedIds.has(sourceId);
        });
        if (incomingEdge) {
            return typeof incomingEdge.source === 'object' ? incomingEdge.source.id : incomingEdge.source;
        }
        return null;
    },

    setupCanvas: function() {
        this.canvas = document.getElementById('path-canvas');
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        
        window.addEventListener('resize', () => {
            this.width = window.innerWidth;
            this.height = window.innerHeight;
            this.canvas.width = this.width;
            this.canvas.height = this.height;
            this.render();
        });

        const zoom = d3.zoom()
            .scaleExtent([0.1, 5])
            .on('zoom', (e) => {
                this.transform = e.transform;
                // Render handled by loop
            })
            .filter(event => !event.type.includes('dblclick'));
        
        d3.select(this.canvas).call(zoom).on("dblclick.zoom", null);
        this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
    },

    setupWorker: function() {
        this.worker = new Worker('path_worker.js');
        this.worker.onmessage = (e) => {
            const { type, payload } = e.data;
            switch(type) {
                case 'pathResult':
                    this.handlePathResult(payload);
                    break;
                case 'layoutTick':
                    break;
                case 'log':
                    console.log('[PathWorker]', payload);
                    break;
            }
        };
    },

    setupUI: function() {
        const tauriMode = this._isTauriMode();
        const toolbar = document.getElementById('path-toolbar');

        this._restoreLearningWorkbenchPreferences();

        if (tauriMode && toolbar) {
            // In Tauri, controls are migrated to Godot. Keep canvas view only.
            toolbar.style.display = 'none';
        }
        if (tauriMode) {
            const pathSettingsHeader = document.querySelector('h3[data-i18n="grp_path_mode"]');
            const pathSettingsGroup = pathSettingsHeader ? pathSettingsHeader.closest('.settings-group') : null;
            if (pathSettingsGroup) {
                pathSettingsGroup.style.display = 'none';
            }
        }

        if (this.uiInitialized) {
            this._refreshPathSemanticA11y();
            return;
        }
        this.uiInitialized = true;

        const exitBtn = document.getElementById('btn-exit-path');
        if (exitBtn) {
            exitBtn.addEventListener('click', () => this.exitPathMode());
        }

        const learningModeEl = document.getElementById('learning-mode');
        const strategyEl = document.getElementById('strategy');
        const layoutEl = document.getElementById('layout-style');
        const markBtn = document.getElementById('btn-mark-complete');
        const historyBtn = document.getElementById('btn-toggle-history');
        const closeHistoryBtn = document.getElementById('btn-close-history');
        const workbenchToggleBtn = document.getElementById('btn-toggle-learning-workbench');
        const workbenchCloseBtn = document.getElementById('btn-close-learning-workbench');
        const workbenchRefreshBtn = document.getElementById('btn-refresh-learning-workbench');
        const workbenchIngestBtn = document.getElementById('btn-ingest-focus-node');
        const workbenchRunSessionBtn = document.getElementById('btn-run-learning-session');
        const workbenchRunRetestBtn = document.getElementById('btn-run-retest-session');
        const workbenchUserIdInput = document.getElementById('learning-user-id');
        const workbenchActionsList = document.getElementById('learning-session-actions');

        if (!tauriMode) {
            if (learningModeEl) {
                learningModeEl.addEventListener('change', (e) => {
                    const mode = e.target.value;
                    if (mode === 'diffusion') {
                        this.showNodeSelector();
                    } else {
                        this.currentTargetId = null; // Clear target for Domain Mode
                        this.currentTargetIds = [];
                        this.runtimeConfig.targetIds = [];
                        this.updateTargetDisplay();
                        this.triggerUpdate();
                    }
                });
            }
            if (strategyEl) strategyEl.addEventListener('change', () => this.triggerUpdate());
            if (layoutEl) layoutEl.addEventListener('change', () => this.triggerUpdate());
            if (markBtn) markBtn.addEventListener('click', () => this.markComplete());
            if (historyBtn) historyBtn.addEventListener('click', () => this._toggleHistorySidebar());
            if (workbenchToggleBtn) {
                workbenchToggleBtn.addEventListener('click', () => {
                    this._toggleLearningWorkbenchSidebar();
                });
            }
        }

        if (closeHistoryBtn) {
            closeHistoryBtn.addEventListener('click', () => {
                const sidebar = document.getElementById('learning-history-sidebar');
                if (!sidebar) return;
                sidebar.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    sidebar.style.display = 'none';
                }, 300);
            });
        }

        if (workbenchCloseBtn) {
            workbenchCloseBtn.addEventListener('click', () => this._closeLearningWorkbenchSidebar());
        }

        if (workbenchRefreshBtn) {
            workbenchRefreshBtn.addEventListener('click', () => {
                void this.refreshLearningWorkbench({ force: true });
            });
        }

        if (workbenchIngestBtn) {
            workbenchIngestBtn.addEventListener('click', () => {
                void this.ingestFocusNodeForLearningWorkbench();
            });
        }

        if (workbenchRunSessionBtn) {
            workbenchRunSessionBtn.addEventListener('click', () => {
                void this.runLearningWorkbenchSession();
            });
        }

        if (workbenchRunRetestBtn) {
            workbenchRunRetestBtn.addEventListener('click', () => {
                void this.runLearningWorkbenchRetestSession();
            });
        }

        if (workbenchUserIdInput) {
            workbenchUserIdInput.value = this.learningWorkbench.userId || 'path_user_default';
            workbenchUserIdInput.addEventListener('change', (event) => {
                const candidate = typeof event?.target?.value === 'string'
                    ? event.target.value
                    : '';
                this.learningWorkbench.userId = this._normalizeLearningWorkbenchUserId(candidate);
                workbenchUserIdInput.value = this.learningWorkbench.userId;
                this._persistLearningWorkbenchPreferences();
                this._renderLearningWorkbenchState();
            });
        }

        if (workbenchActionsList) {
            workbenchActionsList.addEventListener('click', (event) => {
                const runBtn = event.target && typeof event.target.closest === 'function'
                    ? event.target.closest('.workbench-run-action')
                    : null;
                if (!runBtn) {
                    return;
                }
                const actionKind = decodeURIComponent(runBtn.getAttribute('data-action-kind') || '');
                const atomId = decodeURIComponent(runBtn.getAttribute('data-atom-id') || '');
                const source = decodeURIComponent(runBtn.getAttribute('data-action-source') || '');
                void this.executeLearningWorkbenchAction({
                    actionKind,
                    atomId,
                    source,
                });
            });
        }

        // Add Target Display UI if missing
        if (!tauriMode && !document.getElementById('target-display') && toolbar && learningModeEl) {
            const targetDiv = document.createElement('div');
            targetDiv.id = 'target-display';
            targetDiv.className = 'toolbar-group';
            targetDiv.style.display = 'none';
            targetDiv.innerHTML = `
                <span id="target-label" style="font-size: 0.8rem; color: #aaa; margin-right: 5px;"></span>
                <button id="btn-change-target" class="btn-small">Change</button>
            `;
            // Insert after strategy
            toolbar.insertBefore(targetDiv, learningModeEl.parentNode.nextSibling);
            
            document.getElementById('btn-change-target').addEventListener('click', () => {
                this.showNodeSelector();
            });
        }

        const nodeSelectInput = document.getElementById('node-select-input');
        const closeNodeSelectBtn = document.getElementById('btn-close-node-select');
        if (nodeSelectInput) {
            nodeSelectInput.addEventListener('input', (e) => this.filterNodeList(e.target.value));
        }
        if (closeNodeSelectBtn) {
            closeNodeSelectBtn.addEventListener('click', () => {
                const modal = document.getElementById('node-select-modal');
                if (modal) modal.style.display = 'none';
                if (!this.currentTargetId && this._getModeValue() === 'diffusion') {
                    // Keep current mode; Godot/browser can update target later.
                }
            });
        }

        this._ensurePathSemanticA11y();
        this._refreshPathSemanticA11y('Path mode initialized');
        this._renderLearningWorkbenchState();
    },

    _ensurePathSemanticA11y: function() {
        const hostId = 'path-semantic-shadow';
        let host = document.getElementById(hostId);
        if (host) {
            return host;
        }

        const pathContainer = document.getElementById('path-container');
        if (!pathContainer) {
            return null;
        }

        host = document.createElement('section');
        host.id = hostId;
        host.setAttribute('role', 'region');
        host.setAttribute('aria-label', 'Path mode semantic summary');
        host.style.position = 'absolute';
        host.style.width = '1px';
        host.style.height = '1px';
        host.style.padding = '0';
        host.style.margin = '-1px';
        host.style.overflow = 'hidden';
        host.style.clip = 'rect(0 0 0 0)';
        host.style.clipPath = 'inset(50%)';
        host.style.whiteSpace = 'nowrap';
        host.style.border = '0';

        const summary = document.createElement('p');
        summary.id = 'path-semantic-summary';
        summary.textContent = '';

        const live = document.createElement('div');
        live.id = 'path-semantic-live';
        live.setAttribute('aria-live', 'polite');
        live.setAttribute('aria-atomic', 'true');

        host.appendChild(summary);
        host.appendChild(live);
        pathContainer.appendChild(host);
        return host;
    },

    _collectSemanticNeighborLabels: function(centralId, limit = 5) {
        if (!centralId || !Array.isArray(this.links) || !Array.isArray(this.nodes)) {
            return [];
        }

        const neighborIds = new Set();
        this.links.forEach((edge) => {
            const sourceId = typeof edge?.source === 'object' ? edge.source.id : edge?.source;
            const targetId = typeof edge?.target === 'object' ? edge.target.id : edge?.target;
            if (sourceId === centralId && typeof targetId === 'string' && targetId.trim()) {
                neighborIds.add(targetId.trim());
            }
            if (targetId === centralId && typeof sourceId === 'string' && sourceId.trim()) {
                neighborIds.add(sourceId.trim());
            }
        });

        const labelMap = new Map();
        this.nodes.forEach((node) => {
            if (node && typeof node.id === 'string') {
                labelMap.set(node.id, String(node.label || node.id));
            }
        });

        return Array.from(neighborIds)
            .slice(0, Math.max(1, Math.floor(limit)))
            .map((nodeId) => labelMap.get(nodeId) || nodeId);
    },

    _buildPathSemanticSummary: function() {
        const totalNodes = Array.isArray(this.nodes) ? this.nodes.length : 0;
        const completedCount = this.completedNodes instanceof Set ? this.completedNodes.size : 0;
        const layout = this._getLayoutValue();
        const centralNode = totalNodes > 0
            ? (this.nodes.find((node) => node.id === this.centralNodeId) || null)
            : null;
        const centralId = centralNode?.id || '';
        const centralLabel = centralNode?.label || centralId || 'none';
        const remainingCount = Math.max(0, totalNodes - completedCount);
        const nearbyLabels = this._collectSemanticNeighborLabels(centralId, 5);
        const parts = [
            `Layout ${layout}`,
            `focus ${centralLabel}`,
            `${completedCount} of ${totalNodes} nodes completed`,
            `${remainingCount} remaining`
        ];
        if (nearbyLabels.length > 0) {
            parts.push(`nearby topics ${nearbyLabels.join(', ')}`);
        }
        return {
            key: `${layout}|${centralId}|${completedCount}|${totalNodes}|${nearbyLabels.join('|')}`,
            text: parts.join('. ') + '.'
        };
    },

    _refreshPathSemanticA11y: function(reason = '') {
        const host = this._ensurePathSemanticA11y();
        if (!host) {
            return;
        }

        const summaryEl = document.getElementById('path-semantic-summary');
        const liveEl = document.getElementById('path-semantic-live');
        if (!summaryEl || !liveEl) {
            return;
        }

        const snapshot = this._buildPathSemanticSummary();
        summaryEl.textContent = snapshot.text;
        if (snapshot.key === this.semanticA11yLastSummaryKey) {
            return;
        }

        const now = Date.now();
        if ((now - this.semanticA11yLastAnnouncementAt) < 250) {
            return;
        }

        const reasonPrefix = reason ? reason + ': ' : '';
        liveEl.textContent = reasonPrefix + snapshot.text;
        this.semanticA11yLastSummaryKey = snapshot.key;
        this.semanticA11yLastAnnouncementAt = now;
    },

    updateTargetDisplay: function() {
        if (this._isTauriMode()) {
            return;
        }
        const div = document.getElementById('target-display');
        const mode = this._getModeValue();
        
        if (mode === 'diffusion' && this.currentTargetId) {
            const sourceData = (typeof graphData !== 'undefined') ? graphData : window.graphData;
            const node = sourceData.nodes.find(n => n.id === this.currentTargetId);
            const label = node ? node.label : this.currentTargetId;
            
            document.getElementById('target-label').innerText = `Target: ${label}`;
            div.style.display = 'flex';
            div.style.alignItems = 'center';
        } else {
            div.style.display = 'none';
        }
    },

    loadHistory: function() {
        const retain = this._getRetainHistoryEnabled();
        if (!retain) return;
        const stored = localStorage.getItem('nc_path_history');
        if (stored) {
            try {
                this.learningHistory = JSON.parse(stored);
                // Validate IDs
                const validHistory = [];
                this.learningHistory.forEach(n => {
                    if (n && n.id) {
                        this.completedNodes.add(n.id);
                        validHistory.push(n);
                    }
                });
                this.learningHistory = validHistory;
                this.updateHistorySidebar();
            } catch(e) { console.error(e); }
        }
    },
    saveHistory: function() {
        if (this._getRetainHistoryEnabled()) {
            localStorage.setItem('nc_path_history', JSON.stringify(this.learningHistory));
        }
    },

    triggerUpdate: function() {
        const mode = this._getModeValue();
        const strategy = this._getStrategyValue();
        const layout = this._getLayoutValue();
        let targetId = this.currentTargetId;
        let targetIds = null;

        if (mode === 'diffusion') {
            const configuredTargetIds = this._sanitizeTargetIds(this.runtimeConfig.targetIds);
            if (configuredTargetIds.length > 0) {
                targetIds = configuredTargetIds;
            }
            if (this.runtimeConfig.targetId) {
                targetId = this.runtimeConfig.targetId;
            }
            if ((!targetId || !String(targetId).trim()) && Array.isArray(targetIds) && targetIds.length > 0) {
                targetId = targetIds[0];
            }
            if ((!targetId || !String(targetId).trim()) && this.centralNodeId) {
                targetId = this.centralNodeId;
            }
            if ((!targetId || !String(targetId).trim())) {
                const fallback = this._getDefaultTargetIds(1);
                if (fallback.length > 0) {
                    targetId = fallback[0];
                }
            }
            if (targetId && (!Array.isArray(targetIds) || targetIds.length === 0)) {
                targetIds = [String(targetId).trim()];
            }
            if (!targetId || !String(targetId).trim()) {
                targetId = null;
            }
            if (!targetId) {
                console.warn('[PathApp] Diffusion mode requested without target; skipping update.');
                this._sendBridgeStatus(
                    'warning',
                    'path_target_missing',
                    'Diffusion mode requested without a target node. Unable to compute path.',
                    {
                        mode,
                        strategy,
                        layout,
                        centralId: this.centralNodeId || null,
                        currentTargetId: this.currentTargetId || null,
                        runtimeTargetId: this.runtimeConfig.targetId || null
                    },
                    true
                );
                return;
            }
            const nextDiffusionTargetIds = this._sanitizeTargetIds([targetId].concat(Array.isArray(targetIds) ? targetIds : []));
            targetIds = nextDiffusionTargetIds;
            this.currentTargetId = targetId;
            this.runtimeConfig.targetId = targetId;
            this.runtimeConfig.targetIds = nextDiffusionTargetIds;
            this.currentTargetIds = nextDiffusionTargetIds;
        } else {
            const configuredTargetIds = this._sanitizeTargetIds(this.runtimeConfig.targetIds);
            if (configuredTargetIds.length > 0) {
                targetIds = configuredTargetIds;
            } else {
                targetIds = this._getDefaultTargetIds(2);
            }
            this.runtimeConfig.targetIds = this._sanitizeTargetIds(targetIds);
            this.currentTargetIds = this.runtimeConfig.targetIds;
        }
        
        // Preserve central focus if we already have one
        if (layout === 'orbital' && !this.centralNodeId && this.nodes.length > 0) {
             const next = this.nodes.find(n => !this.completedNodes.has(n.id));
             this.centralNodeId = next ? next.id : this.nodes[0].id;
        }

        this.worker.postMessage({
            type: 'computePath',
            payload: { 
                mode, 
                strategy, 
                layout, 
                targetId: targetId, 
                targetIds,
                centralId: this.centralNodeId,
                collapsedIds: Array.from(this.collapsedNodes),
                completedIds: Array.from(this.completedNodes),
                forcedExpansionIds: Array.from(this.forcedExpansionNodes),
                expansionOrder: this.expansionOrder,
                stickyClaimEnabled: this.stickyClaimEnabled
            }
        });
        
        this.updateTargetDisplay();
    },

    startProcessing: function(targetId) {
        this.currentTargetId = targetId;
        if (this._isTauriMode()) {
            this.runtimeConfig.layout = 'orbital';
            if (targetId) {
                this.runtimeConfig.mode = 'diffusion';
                this.runtimeConfig.targetId = targetId;
                this.runtimeConfig.targetIds = [targetId];
                this.currentTargetIds = [targetId];
            } else if (!this.runtimeConfig.targetId) {
                this.runtimeConfig.mode = 'domain';
            }
        }
        this.forcedExpansionNodes.clear(); // Reset expansion on new target
        const sourceData = (typeof graphData !== 'undefined') ? graphData : window.graphData;
        
        if (!sourceData) {
            console.error('[PathApp] No graph data found to process!');
            return;
        }

        const nodes = sourceData.nodes.map(n => ({
            id: n.id, label: n.label, inDegree: n.inDegree, outDegree: n.outDegree, centrality: n.centrality
        }));
        
        // Debug: Log source edges type
        console.log('[PathApp] Processing links. Source edges count:', sourceData.edges?.length, 'First raw:', sourceData.edges?.[0]);

        // D3 mutates links to objects, we need IDs for the worker
        // Safety check: ensure edges exists, fallback to links check
        const rawEdges = sourceData.edges || sourceData.links || [];
        
        const links = rawEdges.map(l => ({
            source: (typeof l.source === 'object') ? l.source.id : l.source,
            target: (typeof l.target === 'object') ? l.target.id : l.target,
            type: l.type,
            weight: l.weight
        }));

        console.log('[PathApp] Sending initData to worker. Nodes:', nodes.length, 'Links:', links.length, 'Sample Link:', links[0]);
        this.worker.postMessage({ type: 'initData', payload: { nodes, links } });
        this.triggerUpdate();
    },

    handlePathResult: function(result) {
        this.nodes = result.nodes;
        this.links = result.edges;
        // Store treeLayout for later requestPath responses
        if (result.treeLayout) {
            this.lastTreeLayout = result.treeLayout;
        }
        
        document.getElementById('path-count').innerText = this.nodes.length;
        
        // Auto-set central if needed
        if (this.nodes.length > 0) {
            const exists = this.nodes.find(n => n.id === this.centralNodeId);
            if (!this.centralNodeId || !exists) {
                const cand = this.nodes.find(n => !this.completedNodes.has(n.id)) || this.nodes[0];
                this.centralNodeId = cand.id;
            }
        }

        this.nodes.forEach(n => {
            if (this.completedNodes.has(n.id)) n.isCompleted = true;
            // Initialize orbital params if needed - randomized for "Cloud" effect
            if (!n.orbitalSpeed) n.orbitalSpeed = (Math.random() - 0.5) * 0.0015; // Slow down slightly
            if (!n.orbitalPhase) n.orbitalPhase = Math.random() * Math.PI * 2;
            // Increased dispersion: 0 - 600 offset
            if (!n.orbitalRadiusOffset || n.orbitalRadiusOffset < 100) n.orbitalRadiusOffset = Math.random() * 600; 
        });

        if (this._getLayoutValue() === 'orbital') {
            this.runLocalCloudLayout();
        }

        this.centerView();
        this._refreshPathSemanticA11y('Path recalculated');
        
        // Sync with Godot
        this.sendPathToBridge(result);
    },

    // --- Animation & Rendering ---

    animate: function() {
        const layout = this._getLayoutValue();
        if (layout === 'orbital') {
            this.updateOrbitalPositions();
            this.render(); 
        }
        this.animationId = requestAnimationFrame(() => this.animate());
    },

    updateOrbitalPositions: function() {
        if (!this.centralNodeId) return;
        
        // Cloud Logic: Each node has unique speed/radius
        this.nodes.forEach(node => {
            if (node.id !== this.centralNodeId) {
                // Init logical radius if missing
                if (node.radius === undefined) {
                    node.radius = 200 + (node.orbitalRadiusOffset || 50); 
                    node.baseAngle = node.orbitalPhase || 0;
                }
                
                // Update angle
                node.baseAngle += (node.orbitalSpeed || 0.001);
                
                // Update position
                node.x = node.radius * Math.cos(node.baseAngle);
                node.y = node.radius * Math.sin(node.baseAngle);
            } else {
                node.x = 0;
                node.y = 0;
            }
        });
    },

    render: function() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const t = this.transform;
        const layout = this._getLayoutValue();

        ctx.save();
        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(0, 0, this.width, this.height);
        
        ctx.translate(t.x, t.y);
        ctx.scale(t.k, t.k);

        // --- Edges with Depth of Field ---
        this.links.forEach(link => {
            const source = this.nodes.find(n => n.id === link.source);
            const target = this.nodes.find(n => n.id === link.target);
            if (source && target) {
                let alpha = 0.3;
                if (layout === 'orbital') {
                    // Only show edges connected to central clearly, others content hidden
                    const isCentralConn = source.id === this.centralNodeId || target.id === this.centralNodeId;
                    alpha = isCentralConn ? 0.6 : 0.0; 
                }
                ctx.strokeStyle = `rgba(100, 100, 100, ${alpha})`;
                ctx.lineWidth = layout === 'orbital' ? 0.5 : 1;
                
                // Skip rendering very faint edges for perf
                if (alpha > 0.01) {
                    ctx.beginPath();
                    if (layout === 'vertical' && layout !== 'orbital') {
                       this.drawCurve(ctx, source, target);
                    } else {
                       ctx.moveTo(source.x, source.y);
                       ctx.lineTo(target.x, target.y);
                    }
                    ctx.stroke();
                }
            }
        });

        // --- Nodes ---
        const sortedNodes = [...this.nodes];
        if (layout === 'orbital' && this.centralNodeId) {
            sortedNodes.sort((a, b) => (a.id === this.centralNodeId ? 1 : -1));
        }

        sortedNodes.forEach(node => {
            let radius = 5;
            let fill = '#4a9eff';
            let alpha = 1.0;
            let labelSize = 4;

            if (node.isCompleted) {
                fill = '#ffd700'; 
                radius = 4;
            }

            if (layout === 'orbital') {
                if (node.id === this.centralNodeId) {
                    radius = 60; 
                    fill = node.isCompleted ? '#ffd700' : '#00d2ff';
                    ctx.shadowBlur = 30;
                    ctx.shadowColor = fill;
                    labelSize = 14;
                } else {
                    // Depth of Field: Opacity based on Z/Radius or just distance
                    // Since it's 2D cloud, we use simple distance from center to simulate DoF focus?
                    // Actually user wants "reduce rendering load for most low-relevance nodes"
                    // We can use the 'orbitalRadiusOffset' to simulate Z-depth.
                    // Let's assume larger radius = further away = lower opacity.
                    
                    const dist = node.radius || Math.hypot(node.x, node.y);
                    // Updated DoF for wider dispersion (up to 1000px radius)
                    // High opacity for close nodes, gradual falloff for far nodes
                    const zFactor = Math.max(0.4, 1 - (dist / 1200)); 
                    
                    radius = Math.max(3, 25 * zFactor);
                    alpha = zFactor; // Base alpha directly related to zFactor (0.4 - 1.0)
                    
                    fill = node.isCompleted ? '#b8860b' : '#2c5282';
                    ctx.shadowBlur = 0;
                    labelSize = radius / 2; 
                }
            }

            // Draw
            if (alpha > 0.05) { // Optimization
                ctx.beginPath();
                ctx.globalAlpha = alpha;
                ctx.fillStyle = fill;
                ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
                ctx.fill();
                
                // Labels
                let showLabel = false;
                if (layout === 'orbital') {
                     showLabel = true; // Always show in orbital (user request)
                } else {
                     showLabel = node.id === this.centralNodeId || (alpha > 0.6 && t.k > 0.8);
                }

                if (showLabel) {
                    ctx.globalAlpha = alpha > 0.5 ? 1.0 : alpha + 0.2; // Slightly boost label alpha
                    ctx.fillStyle = '#fff';
                    
                    if (layout === 'orbital') {
                        // Scaled labels with limit
                        // Cap font size to match node dimensions (radius is approx 20-30 for peripherals)
                        // Use 0.5 * radius for text height approx, capped at 16px (standard reading size).
                        const calculatedSize = node.id === this.centralNodeId ? 20 : (radius * 0.5);
                        const fontSize = Math.min(16, Math.max(8, calculatedSize)); 
                        
                        ctx.font = `${fontSize}px sans-serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        let label = node.label;
                        // Truncate only very long labels
                        if (node.id !== this.centralNodeId && label.length > 15) label = label.substring(0, 12) + '..';
                        
                        // Drop shadow for readability
                        ctx.shadowColor = 'rgba(0,0,0,0.8)';
                        ctx.shadowBlur = 4;
                        ctx.fillText(label, node.x, node.y + (node.id === this.centralNodeId ? 0 : radius + 8));
                        ctx.shadowBlur = 0;
                    } else {
                        if (layout !== 'orbital' && t.k > 0.5) {
                            ctx.font = '4px sans-serif';
                            ctx.textAlign = 'left';
                            ctx.fillText(node.label, node.x + 8, node.y + 2);
                        }
                    }
                }
            }
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1.0;
        });

        ctx.restore();
    },
    
    drawCurve: function(ctx, source, target) {
        ctx.moveTo(source.x, source.y);
        ctx.bezierCurveTo(source.x, (source.y + target.y)/2, target.x, (source.y + target.y)/2, target.x, target.y);
    },

    // --- Interactions ---

    handleDoubleClick: function(e) {
        const { x, y } = this.getCanvasCoordinates(e.clientX, e.clientY);
        const layout = this._getLayoutValue();
        const node = this.findNodeAt(x, y);

        if (node) {
            console.log("Double Clicked:", node.label, node.id);
            if (layout === 'orbital') {
                if (node.id === this.centralNodeId) {
                    // Central Node -> Open Content
                    if (typeof window.reader !== 'undefined' && window.reader.open) {
                        try {
                            // Fetch full node data from global source if available to get content/metadata
                            let fullNode = node;
                            if (typeof window.graphData !== 'undefined' && window.graphData.nodes) {
                                const found = window.graphData.nodes.find(n => n.id === node.id);
                                if (found) fullNode = found;
                            } else if (typeof graphData !== 'undefined' && graphData.nodes) {
                                const found = graphData.nodes.find(n => n.id === node.id);
                                if (found) fullNode = found;
                            }
                            
                            window.reader.open(fullNode);
                        } catch(err) { console.error("Reader Error", err); }
                    } else {
                        console.error("Reader module missing or invalid.", window.reader);
                    }
                } else {
                    // Peripheral -> Switch Focus
                    this.switchCentral(node.id);
                }
            } else {
                if (window.reader) window.reader.open(node.id);
            }
        }
    },

    removeHistoryItem: function(itemId, event) {
        if (event) event.stopPropagation(); // Prevent opening reader
        
        this.learningHistory = this.learningHistory.filter(n => n.id !== itemId);
        this.completedNodes.delete(itemId);
        this.saveHistory();
        this.updateHistorySidebar();
        
        // Update visual state of the node if visible
        const liveNode = this.nodes.find(n => n.id === itemId);
        if (liveNode) liveNode.isCompleted = false;
        this.render();
    },

    markComplete: function() {
        if (!this.centralNodeId) return;
        const node = this.nodes.find(n => n.id === this.centralNodeId);
        if (node && !node.isCompleted) {
            node.isCompleted = true;
            this.completedNodes.add(node.id);
            // Avoid duplicates
            if (!this.learningHistory.some(h => h.id === node.id)) {
                this.learningHistory.push(node);
            }
            this.saveHistory();
            this.updateHistorySidebar();
            const workbenchSidebar = document.getElementById('learning-workbench-sidebar');
            if (workbenchSidebar && workbenchSidebar.style.display && workbenchSidebar.style.display !== 'none') {
                void this.refreshLearningWorkbench({ force: false });
            }
            
            const next = this.nodes.find(n => !this.completedNodes.has(n.id) && n.id !== node.id);
            if (next) setTimeout(() => this.switchCentral(next.id), 500);
            
            this.render(); 
            this._refreshPathSemanticA11y('Node completed');
        }
    },

    switchCentral: function(id) {
        console.log('[PathApp] switchCentral called with:', id);
        this.centralNodeId = id;
        this._refreshPathSemanticA11y('Focus changed');
        
        // Use triggerUpdate to ensure Worker re-calculates Tree Layout with new Central ID
        this.triggerUpdate();
    },

    runLocalCloudLayout: function() {
        if (this._getLayoutValue() !== 'orbital') return;
        
        const center = this.nodes.find(n => n.id === this.centralNodeId);
        if (!center) return;

        center.x = 0; center.y = 0; center.radius = 0;
        
        const others = this.nodes.filter(n => n.id !== this.centralNodeId);
        
        // Cloud Distribution: 
        // Iterate and assign random stable radii (350-950 range for max dispersion)
        others.forEach((node, i) => {
            const angle = (i / others.length) * 2 * Math.PI;
            // Use existing offsets or init new randoms (Wide spread)
            if (!node.orbitalRadiusOffset || node.orbitalRadiusOffset < 100) node.orbitalRadiusOffset = Math.random() * 600; 
            
            node.radius = 350 + node.orbitalRadiusOffset; // Base 350 (was 200)
            node.baseAngle = angle;
            node.orbitalPhase = node.orbitalPhase || Math.random() * 10;
            
            node.x = node.radius * Math.cos(angle);
            node.y = node.radius * Math.sin(angle);
        });
    },

    getCanvasCoordinates: function(clientX, clientY) {
        const t = this.transform;
        return {
            x: (clientX - t.x) / t.k,
            y: (clientY - t.y) / t.k
        };
    },

    findNodeAt: function(x, y) {
        const layout = this._getLayoutValue();
        if (layout === 'orbital' && this.centralNodeId) {
            const center = this.nodes.find(n => n.id === this.centralNodeId);
            const dist = Math.hypot(center.x - x, center.y - y);
            if (dist < 65) return center;
        }

        return this.nodes.find(node => {
            const dist = Math.hypot(node.x - x, node.y - y);
            // Dynamic hit test based on visual size (approx)
            // If node is faded (further away), make it harder to hit? 
            // Or keep it standard. Standard is safer for usability.
            return dist < 20; 
        });
    },

    centerView: function() {
        // ... (standard zooming)
        if (this.nodes.length === 0) return;
        let minX = -400, maxX = 400, minY = -400, maxY = 400; // Cloud approximate bounds
        
        const padding = 50;
        const width = maxX - minX + padding * 2;
        const height = maxY - minY + padding * 2;
        const scale = Math.min(this.width / width, this.height / height, 1);
        const tx = this.width / 2;
        const ty = this.height / 2;

        const zoom = d3.zoomIdentity.translate(tx, ty).scale(scale);
        d3.select(this.canvas).transition().duration(750).call(d3.zoom().transform, zoom);
        this.transform = { k: scale, x: tx, y: ty };
    },

    showNodeSelector: function() {
        const modal = document.getElementById('node-select-modal');
        modal.style.display = 'flex';
        document.getElementById('node-select-input').value = '';
        this.filterNodeList('');
    },

    filterNodeList: function(query) {
        const list = document.getElementById('node-select-list');
        list.innerHTML = '';
        const sourceData = (typeof graphData !== 'undefined') ? graphData : window.graphData;
        if (!sourceData) return;

        const matches = sourceData.nodes
            .filter(n => n.label.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 300); // Increased limit from 20 to 300 for better discoverability

        matches.forEach(node => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${node.label}</span>`;
            li.onclick = () => {
                this.currentTargetId = node.id;
                this.runtimeConfig.targetId = node.id;
                this.runtimeConfig.targetIds = [node.id];
                this.currentTargetIds = [node.id];
                document.getElementById('node-select-modal').style.display = 'none';
                this.triggerUpdate();
            };
            list.appendChild(li);
        });
    },

    updateHistorySidebar: function() {
        const list = document.getElementById('history-list');
        list.innerHTML = '';
        this.learningHistory.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';
            
            const labelSpan = document.createElement('span');
            labelSpan.innerText = item.label;
            labelSpan.style.cursor = 'pointer';
            labelSpan.onclick = () => { if (window.reader) window.reader.open(item.id); };
            
            const removeBtn = document.createElement('span');
            removeBtn.innerHTML = '&times;';
            removeBtn.style.color = '#ff6b6b';
            removeBtn.style.cursor = 'pointer';
            removeBtn.style.padding = '0 5px';
            removeBtn.onclick = (e) => this.removeHistoryItem(item.id, e);
            
            div.appendChild(labelSpan);
            div.appendChild(removeBtn);
            list.appendChild(div);
        });
    },
    
    /**
     * Standalone WebSocket mode: Respond to Godot even when Path Mode UI is not active.
     * Uses graphData directly instead of worker-computed paths.
     */
    sendPathToBridgeStandalone: function(centralId) {
        console.log('[PathApp] sendPathToBridgeStandalone for:', centralId);

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('[PathApp] WS not open for standalone response');
            return;
        }

        const sourceData = this._getSourceGraphData();
        if (!sourceData || !sourceData.nodes) {
            console.error('[PathApp] No graphData available for standalone mode');
            this._sendBridgeStatus(
                'error',
                'standalone_graph_missing',
                'No graph data is available for a standalone bridge response.',
                {
                    centralId: centralId || null
                },
                true
            );
            return;
        }

        const centralNode = this._getFullNodeById(centralId);
        if (!centralNode) {
            console.error('[PathApp] Central node not found in graphData:', centralId);
            this._sendBridgeStatus(
                'error',
                'standalone_central_missing',
                'Standalone bridge response could not find the requested central node.',
                {
                    centralId: centralId || null
                },
                true
            );
            return;
        }

        const edges = sourceData.edges || [];
        const connectedIds = new Set();

        edges.forEach(e => {
            const sourceId = typeof e.source === 'object' ? e.source.id : e.source;
            const targetId = typeof e.target === 'object' ? e.target.id : e.target;
            if (sourceId === centralId) connectedIds.add(targetId);
            if (targetId === centralId) connectedIds.add(sourceId);
        });

        const peripheralCandidates = Array.from(connectedIds)
            .map(id => this._getFullNodeById(id))
            .filter(Boolean)
            .map(node => {
                const isIncoming = edges.some(e => {
                    const sourceId = typeof e.source === 'object' ? e.source.id : e.source;
                    const targetId = typeof e.target === 'object' ? e.target.id : e.target;
                    return sourceId === node.id && targetId === centralId;
                });
                const isOutgoing = edges.some(e => {
                    const sourceId = typeof e.source === 'object' ? e.source.id : e.source;
                    const targetId = typeof e.target === 'object' ? e.target.id : e.target;
                    return sourceId === centralId && targetId === node.id;
                });

                let priority = 0;
                if (isIncoming) priority = 2;
                else if (isOutgoing) priority = 1;

                return {
                    ...node,
                    priority,
                    totalDegree: (node.inDegree || 0) + (node.outDegree || 0)
                };
            });

        peripheralCandidates.sort((a, b) => {
            if (b.priority !== a.priority) return b.priority - a.priority;
            return b.totalDegree - a.totalDegree;
        });

        const selectedPeripheralNodes = peripheralCandidates.slice(0, 4);
        const selectedNodeIds = [centralId, ...selectedPeripheralNodes.map(node => node.id)];
        const allowedIds = new Set(selectedNodeIds);

        const payload = {
            central: this._serializeBridgeNode(centralNode, centralId),
            peripherals: selectedPeripheralNodes.map((node) => {
                const fullNode = this._getFullNodeById(node.id, node) || node;
                const serialized = this._serializeBridgeNode(fullNode, node.label || node.id) || {
                    id: node.id,
                    label: node.label || node.id,
                    content: '',
                    metadata: {}
                };
                return {
                    ...serialized,
                    relation: node.priority === 2 ? 'prerequisite' : 'association'
                };
            }),
            progress: {
                completed: this.completedNodes ? this.completedNodes.size : 0,
                total: selectedNodeIds.length
            },
            totalNodes: selectedNodeIds.length,
            pathNodes: selectedNodeIds.map((nodeId) => {
                const node = this._getFullNodeById(nodeId);
                const serialized = this._serializeBridgeNode(node, node?.label || nodeId) || {
                    id: nodeId,
                    label: node?.label || nodeId,
                    content: '',
                    metadata: {}
                };
                return {
                    ...serialized,
                    parentId: this._findParentId(nodeId, edges, allowedIds)
                };
            }),
            availableTargets: this._buildAvailableTargetCatalog(),
            treeLayout: null,
            completedIds: Array.from(this.completedNodes || []),
            mode: 'orbital'
        };
        payload._bridgeTransport = this._createBridgeTransportMeta(payload, 'frontend-standalone');

        console.log('[PathApp] Sending standalone pathResult:', payload.central.label, 'filepath:', payload.central.metadata?.filepath || 'missing', 'fingerprint:', payload._bridgeTransport.fingerprint);
        this._sendBridgeMessage('pathResult', payload);
    },

    /**
     * Early WebSocket connection for Godot standalone testing.
     * Called immediately when script loads.
     */
    setupEarlyWebSocket: function(options = {}) {
        const forceDesktop = options.forceDesktop === true;
        const preferredCentralId = this._getPreferredStandaloneCentralId(options.preferredCentralId || null);
        const bridge = (typeof window !== 'undefined') ? window.NoteConnectionRuntime : null;
        const waitForRuntime = this._isTauriMode() && bridge && typeof bridge.whenReady === 'function';

        if (this._isTauriMode() && !forceDesktop) {
            // In normal Tauri flow, avoid idle early bridge sockets unless the desktop shell explicitly asks for one.
            return;
        }

        const openEarlySocket = () => {
            if (this.ws) {
                if (this.ws.readyState === WebSocket.OPEN && preferredCentralId) {
                    this.centralNodeId = preferredCentralId;
                    this.sendPathToBridgeStandalone(preferredCentralId);
                }
                return;
            }

            console.log('[PathApp] Setting up early WebSocket connection...');
            this.ws = this._openBridgeSocket();
            if (!this.ws) {
                console.warn('[PathApp] Early bridge socket URL is unavailable; skipping early WebSocket connect.');
                return;
            }

            this.ws.onopen = () => {
                console.log('[PathApp] Early WS Connected to Bridge');
                this._sendBridgeMessage('identify', this._getBridgeIdentifyPayload('frontend-early'));
                this._ensureLanguageSyncListener();
                this.syncLanguageWithBridge();

                const initialCentralId = this._getPreferredStandaloneCentralId(preferredCentralId);
                if (initialCentralId) {
                    this.centralNodeId = initialCentralId;
                    this.sendPathToBridgeStandalone(initialCentralId);
                } else {
                    this._sendBridgeStatus(
                        'warning',
                        'early_bridge_no_central',
                        'Frontend early bridge connected before a central node could be resolved.',
                        {
                            hasGraphData: !!this._getSourceGraphData(),
                            graphNodeCount: this._getSourceGraphData()?.nodes?.length || 0
                        },
                        false
                    );
                }
            };

            this.ws.onmessage = (e) => {
                try {
                    const msg = this._parseBridgeIncomingMessage(e.data);
                    if (!msg || !msg.type) {
                        return;
                    }
                    console.log('[PathApp] Early WS Received:', msg.type);

                    if (msg.type === 'switchCenter') {
                        const newCentralId = msg.payload?.newCenterId;
                        console.log('[PathApp] Early switch center request:', newCentralId);

                        // If full init was called, use the full pipeline
                        if (this.nodes && this.nodes.length > 0) {
                            this.centralNodeId = newCentralId;
                            this.runLocalCloudLayout();
                            this.render();
                            this.centerView();

                            const result = {
                                nodes: this.nodes,
                                edges: this.links
                            };
                            this.sendPathToBridge(result);
                        } else {
                            // Standalone mode: Use graphData directly
                            this.centralNodeId = newCentralId;
                            this.sendPathToBridgeStandalone(newCentralId);
                        }
                    } else if (msg.type === 'renderMermaidRequest') {
                        this._handleBridgeMermaidRenderRequest(msg.payload || {});
                    } else if (msg.type === 'requestPath') {
                        console.log('[PathApp] Early requestPath received');
                        this._respondToBridgePathRequest('early');
                    } else if (msg.type === 'configure') {
                        console.log('[PathApp] Early configure received');
                        this.applyRemoteConfigure(msg.payload || {});
                    } else if (msg.type === 'exitPathMode') {
                        this.exitPathMode();
                    } else if (msg.type === 'openNotemd' || msg.type === 'open_notemd') {
                        void this.openEmbeddedNoteMD({
                            source: 'early-bridge-openNotemd',
                            restoreMainView: true
                        });
                    } else if (msg.type === 'requestAppShutdown' || msg.type === 'request_app_shutdown') {
                        void this.requestFullApplicationShutdown({
                            source: 'early-bridge-requestAppShutdown',
                            payload: msg.payload || {}
                        });
                    }
                } catch(err) {
                    console.error('[PathApp] Early WS Error:', err);
                }
            };

            this.ws.onerror = (err) => {
                console.warn('[PathApp] Early WS Error (PathBridge may not be running):', err);
            };
            this.ws.onclose = (e) => {
                console.log('[PathApp] Early WS Closed. code=', e.code, 'reason=', e.reason || '<empty>');
            };
        };

        if (!waitForRuntime) {
            openEarlySocket();
            return;
        }

        bridge.whenReady()
            .catch((err) => {
                console.warn('[PathApp] Runtime bridge readiness failed for early socket, using current WebSocket config.', err);
            })
            .finally(() => {
                openEarlySocket();
            });
    }
};

// === AUTO-CONNECT: Establish WebSocket immediately for Godot standalone support ===
// This runs as soon as path_app.js is loaded, before init() is called.
(function() {
    const isTauri = !!(window.pathApp && typeof window.pathApp._isTauriMode === 'function' && window.pathApp._isTauriMode());
    if (isTauri) {
        // Bridge-first Tauri: only connect when Path Mode is explicitly initialized.
        return;
    }

    // Small delay to ensure graphData might be available
    setTimeout(() => {
        if (window.pathApp && !window.pathApp.ws) {
            window.pathApp.setupEarlyWebSocket();
        }
    }, 500);
})();




