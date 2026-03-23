(function () {
    const DEFAULT_BASE_URL = 'http://127.0.0.1:3000';
    const DEFAULT_BRIDGE_WS_URL = 'ws://127.0.0.1:9876';
    const BRIDGE_RPC_VERSION = '2.0';
    const BRIDGE_RPC_METHOD_PREFIX = 'noteconnection.';
    const TAURI_RUNTIME_HYDRATE_TIMEOUT_MS = 2000;

    function isPlainObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    function normalizeBridgeMessageType(rawType) {
        const normalized = String(rawType || '').trim();
        return normalized.replace(/^[/.]+/, '');
    }

    function toBridgeEnvelope(type, payload, meta) {
        const normalizedType = normalizeBridgeMessageType(type);
        if (!normalizedType) {
            throw new Error('Bridge message type is required.');
        }

        const envelope = {
            type: normalizedType,
            payload: payload === undefined ? null : payload,
            jsonrpc: BRIDGE_RPC_VERSION,
            method: `${BRIDGE_RPC_METHOD_PREFIX}${normalizedType}`,
            params: payload === undefined ? null : payload
        };

        if (meta && Object.prototype.hasOwnProperty.call(meta, 'id')) {
            envelope.id = meta.id;
        }

        return envelope;
    }

    function parseBridgeEnvelope(rawMessage) {
        let decoded = rawMessage;
        if (typeof decoded === 'string') {
            decoded = JSON.parse(decoded);
        }

        if (!isPlainObject(decoded)) {
            return null;
        }

        let type = normalizeBridgeMessageType(decoded.type);
        let payload = Object.prototype.hasOwnProperty.call(decoded, 'payload')
            ? decoded.payload
            : undefined;

        if (!type && typeof decoded.method === 'string' && decoded.method.startsWith(BRIDGE_RPC_METHOD_PREFIX)) {
            type = normalizeBridgeMessageType(decoded.method.slice(BRIDGE_RPC_METHOD_PREFIX.length));
            if (payload === undefined) {
                payload = decoded.params;
            }
        }

        if (!type) {
            return null;
        }

        if (payload === undefined && Object.prototype.hasOwnProperty.call(decoded, 'params')) {
            payload = decoded.params;
        }

        return {
            type,
            payload: payload === undefined ? null : payload,
            id: Object.prototype.hasOwnProperty.call(decoded, 'id') ? decoded.id : null,
            jsonrpc: decoded.jsonrpc === BRIDGE_RPC_VERSION,
            raw: decoded
        };
    }

    function sendBridgeMessage(socket, type, payload, meta) {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            return false;
        }
        socket.send(JSON.stringify(toBridgeEnvelope(type, payload, meta)));
        return true;
    }

    function normalizeBaseUrl(rawUrl) {
        const value = String(rawUrl || '').trim();
        if (!value) {
            return DEFAULT_BASE_URL;
        }
        return value.replace(/\/+$/, '');
    }

    function normalizeBridgeWsUrl(rawUrl) {
        const value = String(rawUrl || '').trim();
        if (!value) {
            return DEFAULT_BRIDGE_WS_URL;
        }
        return value.replace(/\/+$/, '');
    }

    const state = {
        baseUrl: normalizeBaseUrl(window.__NC_SIDECAR_RUNTIME && window.__NC_SIDECAR_RUNTIME.baseUrl),
        bridgeWsUrl: normalizeBridgeWsUrl(window.__NC_SIDECAR_RUNTIME && window.__NC_SIDECAR_RUNTIME.bridgeWsUrl),
        authToken: String((window.__NC_SIDECAR_RUNTIME && window.__NC_SIDECAR_RUNTIME.authToken) || '').trim(),
        host: String((window.__NC_SIDECAR_RUNTIME && window.__NC_SIDECAR_RUNTIME.host) || '127.0.0.1'),
        port: Number((window.__NC_SIDECAR_RUNTIME && window.__NC_SIDECAR_RUNTIME.port) || 3000),
        bridgePort: Number((window.__NC_SIDECAR_RUNTIME && window.__NC_SIDECAR_RUNTIME.bridgePort) || 9876)
    };

    let runtimeReadyResolved = false;
    let runtimeHydrationPromise = null;
    let resolveRuntimeReady;
    const runtimeReadyPromise = new Promise((resolve) => {
        resolveRuntimeReady = resolve;
    });

    function syncGlobalState() {
        window.__NC_SIDECAR_RUNTIME = {
            host: state.host,
            port: state.port,
            bridgePort: state.bridgePort,
            baseUrl: state.baseUrl,
            bridgeWsUrl: state.bridgeWsUrl,
            authToken: state.authToken
        };
        return window.__NC_SIDECAR_RUNTIME;
    }

    function finalizeRuntimeReady() {
        if (runtimeReadyResolved) {
            return runtimeReadyPromise;
        }
        runtimeReadyResolved = true;
        resolveRuntimeReady(syncGlobalState());
        return runtimeReadyPromise;
    }

    function setRuntimeConfig(nextConfig) {
        if (!nextConfig || typeof nextConfig !== 'object') {
            return syncGlobalState();
        }

        if (typeof nextConfig.host === 'string' && nextConfig.host.trim()) {
            state.host = nextConfig.host.trim();
        }
        if (typeof nextConfig.port === 'number' && Number.isFinite(nextConfig.port) && nextConfig.port > 0) {
            state.port = nextConfig.port;
        }
        if (typeof nextConfig.bridgePort === 'number' && Number.isFinite(nextConfig.bridgePort) && nextConfig.bridgePort > 0) {
            state.bridgePort = nextConfig.bridgePort;
        }
        if (typeof nextConfig.baseUrl === 'string') {
            state.baseUrl = normalizeBaseUrl(nextConfig.baseUrl);
        } else {
            state.baseUrl = normalizeBaseUrl(`http://${state.host}:${state.port}`);
        }
        if (typeof nextConfig.bridgeWsUrl === 'string') {
            state.bridgeWsUrl = normalizeBridgeWsUrl(nextConfig.bridgeWsUrl);
        } else {
            state.bridgeWsUrl = normalizeBridgeWsUrl(`ws://${state.host}:${state.bridgePort}`);
        }
        if (typeof nextConfig.authToken === 'string') {
            state.authToken = nextConfig.authToken.trim();
        }

        return syncGlobalState();
    }

    function getRuntimeConfig() {
        return syncGlobalState();
    }

    function buildUrl(resourcePath, query) {
        const normalizedPath = String(resourcePath || '').replace(/^\/+/, '');
        const url = new URL(normalizedPath, `${state.baseUrl}/`);
        if (query && typeof query === 'object') {
            Object.entries(query).forEach(([key, value]) => {
                if (value === undefined || value === null || value === '') {
                    return;
                }
                url.searchParams.set(key, String(value));
            });
        }
        return url.toString();
    }

    function createAuthHeaders(extraHeaders) {
        const headers = new Headers(extraHeaders || {});
        if (state.authToken && !headers.has('X-NoteConnection-Token') && !headers.has('Authorization')) {
            headers.set('X-NoteConnection-Token', state.authToken);
        }
        return headers;
    }

    function buildFetchOptions(init) {
        const nextInit = { ...(init || {}) };
        nextInit.headers = createAuthHeaders(nextInit.headers);
        return nextInit;
    }

    function getBridgeWsUrl(clientTag) {
        const rawWsUrl = String(state.bridgeWsUrl || '').trim();
        if (!rawWsUrl) {
            return '';
        }

        try {
            const url = new URL(rawWsUrl);
            const normalizedClientTag = String(clientTag || '').trim();
            if (normalizedClientTag) {
                url.searchParams.set('client', normalizedClientTag);
            }
            if (state.authToken) {
                url.searchParams.set('token', state.authToken);
            }
            return url.toString();
        } catch (_error) {
            return rawWsUrl;
        }
    }

    function openBridgeSocket(clientTag, protocols) {
        const wsUrl = getBridgeWsUrl(clientTag);
        if (!wsUrl) {
            return null;
        }
        if (typeof protocols !== 'undefined') {
            return new WebSocket(wsUrl, protocols);
        }
        return new WebSocket(wsUrl);
    }

    function getTauriInvoke() {
        if (!window.__TAURI__ || !window.__TAURI__.core || typeof window.__TAURI__.core.invoke !== 'function') {
            return null;
        }
        return window.__TAURI__.core.invoke;
    }

    function invokeTauriWithTimeout(invokeCall, commandLabel, timeoutMs) {
        return new Promise((resolve, reject) => {
            let settled = false;
            const timer = setTimeout(() => {
                if (settled) {
                    return;
                }
                settled = true;
                reject(new Error(`Tauri invoke timed out (${commandLabel}).`));
            }, timeoutMs);

            Promise.resolve(invokeCall())
                .then((result) => {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    clearTimeout(timer);
                    resolve(result);
                })
                .catch((error) => {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    clearTimeout(timer);
                    reject(error);
                });
        });
    }

    async function hydrateRuntimeFromTauri() {
        if (runtimeHydrationPromise) {
            return runtimeHydrationPromise;
        }

        runtimeHydrationPromise = (async () => {
            const invoke = getTauriInvoke();
            if (!invoke) {
                return finalizeRuntimeReady();
            }

            try {
                const caps = await invokeTauriWithTimeout(
                    () => invoke('get_runtime_capabilities'),
                    'get_runtime_capabilities',
                    TAURI_RUNTIME_HYDRATE_TIMEOUT_MS
                );
                if (caps && typeof caps === 'object') {
                    window.__NC_RUNTIME_CAPS = {
                        ...(window.__NC_RUNTIME_CAPS || {}),
                        ...caps
                    };
                }

                const runtimeCaps = window.__NC_RUNTIME_CAPS || {};
                if (runtimeCaps.supports_sidecar) {
                    const runtimeConfig = await invokeTauriWithTimeout(
                        () => invoke('get_sidecar_runtime_config'),
                        'get_sidecar_runtime_config',
                        TAURI_RUNTIME_HYDRATE_TIMEOUT_MS
                    );
                    setRuntimeConfig(runtimeConfig);
                }
            } catch (error) {
                console.warn('[RuntimeBridge] Failed to hydrate sidecar runtime config from Tauri. Using runtime bridge defaults.', error);
            }

            if (typeof window.dispatchEvent === 'function' && typeof window.CustomEvent === 'function') {
                window.dispatchEvent(new CustomEvent('noteconnection:runtime-ready', {
                    detail: {
                        runtime: syncGlobalState(),
                        caps: window.__NC_RUNTIME_CAPS || null
                    }
                }));
            }

            return finalizeRuntimeReady();
        })();

        return runtimeHydrationPromise;
    }

    function whenReady() {
        if (!runtimeHydrationPromise) {
            void hydrateRuntimeFromTauri();
        }
        return runtimeReadyPromise;
    }

    window.NoteConnectionRuntime = {
        setRuntimeConfig,
        getRuntimeConfig,
        buildUrl,
        buildFetchOptions,
        createAuthHeaders,
        getBridgeWsUrl,
        openBridgeSocket,
        toBridgeEnvelope,
        parseBridgeEnvelope,
        sendBridgeMessage,
        whenReady,
        refreshFromTauri: hydrateRuntimeFromTauri,
        getBaseUrl: function () {
            return state.baseUrl;
        },
        getAuthToken: function () {
            return state.authToken;
        }
    };

    syncGlobalState();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            void hydrateRuntimeFromTauri();
        }, { once: true });
    } else {
        void hydrateRuntimeFromTauri();
    }
}());
