(function () {
    const DEFAULT_BASE_URL = 'http://127.0.0.1:3000';
    const DEFAULT_BRIDGE_WS_URL = 'ws://127.0.0.1:9876';

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

    function getBridgeWsUrl(_clientTag) {
        return state.bridgeWsUrl;
    }

    function getTauriInvoke() {
        if (!window.__TAURI__ || !window.__TAURI__.core || typeof window.__TAURI__.core.invoke !== 'function') {
            return null;
        }
        return window.__TAURI__.core.invoke;
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
                const caps = await invoke('get_runtime_capabilities');
                if (caps && typeof caps === 'object') {
                    window.__NC_RUNTIME_CAPS = {
                        ...(window.__NC_RUNTIME_CAPS || {}),
                        ...caps
                    };
                }

                const runtimeCaps = window.__NC_RUNTIME_CAPS || {};
                if (runtimeCaps.supports_sidecar) {
                    const runtimeConfig = await invoke('get_sidecar_runtime_config');
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
