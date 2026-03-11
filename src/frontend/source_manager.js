document.addEventListener('DOMContentLoaded', () => {
    let runtimeCaps = {
        platform: 'web',
        supports_sidecar: true,
        supports_build: true,
        supports_content_api: true,
        supports_kb_runtime_change: true,
        supports_native_pathmode: false,
        supports_mobile_wasm_compute: false,
        mobile_wasm_reason: 'non-mobile-runtime'
    };

    const resolveCapacitorPlatform = () => {
        if (typeof window === 'undefined') {
            return null;
        }

        const cap = window.Capacitor;
        if (!cap) {
            return null;
        }

        try {
            if (typeof cap.getPlatform === 'function') {
                const platform = cap.getPlatform();
                if (platform && platform !== 'web') {
                    return platform;
                }
            }

            if (typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
                return 'native';
            }
        } catch (err) {
            console.warn('[SourceManager] Failed to detect Capacitor runtime platform.', err);
        }

        return null;
    };

    const supportsCapacitorContentApi = () => {
        if (typeof window === 'undefined') {
            return false;
        }
        const cap = window.Capacitor;
        if (!cap) {
            return false;
        }

        const plugins = cap.Plugins || {};
        const fsPlugin = plugins.Filesystem || window.CapacitorFilesystem || null;
        return Boolean(fsPlugin && typeof fsPlugin.readFile === 'function');
    };

    const supportsCapacitorBuildApi = () => {
        if (typeof window === 'undefined') {
            return false;
        }
        const cap = window.Capacitor;
        if (!cap) {
            return false;
        }

        const plugins = cap.Plugins || {};
        const fsPlugin = plugins.Filesystem || window.CapacitorFilesystem || null;
        return Boolean(
            fsPlugin &&
            typeof fsPlugin.readFile === 'function' &&
            typeof fsPlugin.readdir === 'function' &&
            typeof fsPlugin.writeFile === 'function'
        );
    };

    const detectMobileWasmCapability = () => {
        const features = {
            webAssembly: false,
            worker: false,
            blob: false,
            blobUrl: false,
            typedArrays: false,
            sharedArrayBuffer: false,
            crossOriginIsolated: false
        };

        if (typeof window === 'undefined') {
            return { supported: false, reason: 'runtime-unavailable', features };
        }

        const urlApi = window.URL || window.webkitURL || null;
        features.webAssembly = typeof window.WebAssembly === 'object';
        features.worker = typeof window.Worker === 'function';
        features.blob = typeof window.Blob === 'function';
        features.blobUrl = Boolean(
            urlApi &&
            typeof urlApi.createObjectURL === 'function' &&
            typeof urlApi.revokeObjectURL === 'function'
        );
        features.typedArrays = typeof window.Uint8Array === 'function' && typeof window.ArrayBuffer === 'function';
        features.sharedArrayBuffer = typeof window.SharedArrayBuffer === 'function';
        features.crossOriginIsolated = Boolean(window.crossOriginIsolated);

        if (!features.webAssembly) {
            return { supported: false, reason: 'webassembly-unavailable', features };
        }
        if (!features.worker) {
            return { supported: false, reason: 'worker-unavailable', features };
        }
        if (!features.blob || !features.blobUrl) {
            return { supported: false, reason: 'worker-bootstrap-unavailable', features };
        }
        if (!features.typedArrays) {
            return { supported: false, reason: 'typedarray-unavailable', features };
        }

        return {
            supported: true,
            reason: features.sharedArrayBuffer ? 'ready-with-sab' : 'ready-no-sab',
            features
        };
    };

    const exposeRuntimeCaps = () => {
        if (typeof window !== 'undefined') {
            window.__NC_RUNTIME_CAPS = runtimeCaps;
        }
    };

    const getRuntimeBridge = () => (typeof window !== 'undefined' ? window.NoteConnectionRuntime : null);
    const requireRuntimeBridge = () => {
        const bridge = getRuntimeBridge();
        if (!bridge || typeof bridge !== 'object') {
            throw new Error('Runtime bridge is unavailable. Ensure runtime_bridge.js is loaded before source_manager.js.');
        }
        return bridge;
    };

    const applySidecarRuntimeConfig = (config) => {
        const bridge = getRuntimeBridge();
        if (!bridge || typeof bridge.setRuntimeConfig !== 'function' || !config || typeof config !== 'object') {
            return;
        }
        bridge.setRuntimeConfig(config);
    };

    const buildSidecarUrl = (resourcePath, query = null) => {
        const bridge = requireRuntimeBridge();
        if (typeof bridge.buildUrl !== 'function') {
            throw new Error('Runtime bridge does not expose buildUrl().');
        }
        return bridge.buildUrl(resourcePath, query || undefined);
    };

    const buildSidecarFetchOptions = (init = {}) => {
        const bridge = requireRuntimeBridge();
        if (typeof bridge.buildFetchOptions !== 'function') {
            throw new Error('Runtime bridge does not expose buildFetchOptions().');
        }
        return bridge.buildFetchOptions(init);
    };

    const getStorageProvider = () => {
        if (typeof window === 'undefined' || !window.NoteConnectionStorage || typeof window.NoteConnectionStorage.createProvider !== 'function') {
            throw new Error('Storage provider is unavailable. Ensure storage_provider.js is loaded before source_manager.js.');
        }
        return window.NoteConnectionStorage.createProvider({ runtimeCaps });
    };

    const resolveRuntimeCapabilities = async () => {
        if (!window.__TAURI__) {
            const capacitorPlatform = resolveCapacitorPlatform();
            if (capacitorPlatform) {
                const canReadContent = supportsCapacitorContentApi();
                const canBuildGraph = supportsCapacitorBuildApi();
                const mobileWasm = detectMobileWasmCapability();
                runtimeCaps = {
                    ...runtimeCaps,
                    platform: `capacitor-${capacitorPlatform}`,
                    supports_sidecar: false,
                    supports_build: canBuildGraph,
                    supports_content_api: canReadContent,
                    supports_kb_runtime_change: false,
                    supports_native_pathmode: false,
                    supports_mobile_wasm_compute: mobileWasm.supported,
                    mobile_wasm_reason: mobileWasm.reason,
                    mobile_wasm_features: mobileWasm.features
                };
                console.log('[SourceManager] Capacitor native runtime detected:', runtimeCaps.platform, {
                    supports_content_api: runtimeCaps.supports_content_api,
                    supports_build: runtimeCaps.supports_build,
                    supports_mobile_wasm_compute: runtimeCaps.supports_mobile_wasm_compute,
                    mobile_wasm_reason: runtimeCaps.mobile_wasm_reason
                });
            }
            exposeRuntimeCaps();
            return;
        }

        try {
            const caps = await window.__TAURI__.core.invoke('get_runtime_capabilities');
            if (caps && typeof caps === 'object') {
                runtimeCaps = {
                    ...runtimeCaps,
                    ...caps
                };
            }
            if (runtimeCaps.supports_sidecar) {
                try {
                    const sidecarRuntime = await window.__TAURI__.core.invoke('get_sidecar_runtime_config');
                    applySidecarRuntimeConfig(sidecarRuntime);
                } catch (runtimeErr) {
                    console.warn('[SourceManager] Failed to resolve sidecar runtime config, using runtime bridge defaults.', runtimeErr);
                }
            }
            console.log('[SourceManager] Runtime capabilities resolved:', runtimeCaps);
        } catch (err) {
            console.warn('[SourceManager] Failed to resolve runtime capabilities, using desktop-safe defaults.', err);
        }

        exposeRuntimeCaps();
    };

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const waitForSidecarReady = async () => {
        if (!(window.__TAURI__ && runtimeCaps.supports_sidecar)) {
            return;
        }

        const maxAttempts = 30;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const pingRes = await fetch(buildSidecarUrl('api/kb-path', { v: Date.now() }), buildSidecarFetchOptions({ cache: 'no-store' }));
                if (pingRes.ok) {
                    return;
                }
            } catch (_err) {
                // Sidecar is still starting; retry.
            }

            await sleep(Math.min(1200, 80 * attempt));
        }

        console.warn('[Loader] Sidecar readiness check timed out. Proceeding with startup fallback.');
    };

    // Dynamic Script Loader (Cache Busting & Order Guarantee)
    // 动态脚本加载器（缓存破坏与顺序保证）
    const loadGraphDataFromSidecar = async (src) => {
        const parseGraphDataPayload = (text) => {
            const trimmed = text.trim();
            let parsed = null;

            // Expected format: const graphData = {...};
            if (
                trimmed.startsWith('const graphData') ||
                trimmed.startsWith('let graphData') ||
                trimmed.startsWith('var graphData')
            ) {
                const eqPos = trimmed.indexOf('=');
                if (eqPos > -1) {
                    let jsonText = trimmed.slice(eqPos + 1).trim();
                    if (jsonText.endsWith(';')) {
                        jsonText = jsonText.slice(0, -1);
                    }
                    parsed = JSON.parse(jsonText);
                }
            } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                // Support direct JSON payload if endpoint format changes later.
                parsed = JSON.parse(trimmed);
            } else {
                // Fallback for assignment-based payloads without using runtime eval.
                const assignmentTargets = [
                    'window.graphData',
                    'globalThis.graphData',
                    'self.graphData',
                    'graphData',
                ];
                for (const target of assignmentTargets) {
                    const targetIndex = trimmed.indexOf(target);
                    if (targetIndex < 0) {
                        continue;
                    }
                    const equalsIndex = trimmed.indexOf('=', targetIndex + target.length);
                    if (equalsIndex < 0) {
                        continue;
                    }
                    let candidateJson = trimmed.slice(equalsIndex + 1).trim();
                    if (candidateJson.endsWith(';')) {
                        candidateJson = candidateJson.slice(0, -1).trim();
                    }
                    if (!candidateJson) {
                        continue;
                    }
                    try {
                        parsed = JSON.parse(candidateJson);
                        break;
                    } catch (_parseError) {
                        // Keep scanning fallback patterns.
                    }
                }
            }

            if (!parsed || !Array.isArray(parsed.nodes)) {
                throw new Error('Invalid graph data payload from sidecar (unsupported format).');
            }

            return parsed;
        };

        const useRuntimeProvider = Boolean(
            window.__TAURI__ ||
            (typeof runtimeCaps.platform === 'string' && runtimeCaps.platform.startsWith('capacitor-'))
        );
        if (useRuntimeProvider) {
            try {
                const storageProvider = getStorageProvider();
                const text = await storageProvider.readGeneratedAsset(src);
                const parsed = parseGraphDataPayload(text);
                window.graphData = parsed;
                console.log(`[Loader] Loaded ${src} via storage provider bridge: ${parsed.nodes.length} nodes`);
                return;
            } catch (providerErr) {
                console.warn(`[Loader] Storage provider read failed for ${src}, falling back to runtime fetch strategy.`, providerErr);
            }
        }

        // ─── Strategy 1: HTTP fetch from sidecar (works in browser, may fail in Tauri WebView) ───
        // 策略1：通过 HTTP 从 sidecar 获取（浏览器中有效，Tauri WebView 中可能因混合内容限制而失败）
        const maxAttempts = (window.__TAURI__ && runtimeCaps.supports_sidecar) ? 20 : 1;
        let lastError = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const url = buildSidecarUrl(src, { v: Date.now() });
                console.log(`[Loader] Fetching ${src} via HTTP (attempt ${attempt}/${maxAttempts}): ${url}`);
                const response = await fetch(url, buildSidecarFetchOptions({ cache: 'no-store' }));
                if (!response.ok) {
                    throw new Error(`Failed to fetch ${src}: HTTP ${response.status}`);
                }

                const text = await response.text();
                console.log(`[Loader] HTTP fetch succeeded for ${src}: ${text.length} bytes`);
                const parsed = parseGraphDataPayload(text);
                console.log(`[Loader] Parsed ${src}: ${parsed.nodes.length} nodes, ${(parsed.edges || []).length} edges`);
                window.graphData = parsed;
                return;
            } catch (err) {
                lastError = err;
                if (attempt >= maxAttempts || !(window.__TAURI__ && runtimeCaps.supports_sidecar)) {
                    break;
                }

                if (attempt === 1) {
                    console.warn('[Loader] data.js fetch raced sidecar startup, retrying...');
                }
                await sleep(Math.min(1000, 100 * attempt));
            }
        }

        // ─── Strategy 2: Tauri IPC fallback (bypasses HTTP entirely) ───
        // 策略2：Tauri IPC 回退（完全绕过 HTTP，直接通过 IPC 读取文件）
        if (window.__TAURI__ && window.__TAURI__.core) {
            console.warn(`[Loader] HTTP fetch failed for ${src}. Trying Tauri IPC fallback (read_generated_asset)...`, lastError);
            try {
                const text = await window.__TAURI__.core.invoke('read_generated_asset', { filename: src });
                console.log(`[Loader] Tauri IPC read succeeded for ${src}: ${text.length} bytes`);
                const parsed = parseGraphDataPayload(text);
                console.log(`[Loader] Parsed via IPC ${src}: ${parsed.nodes.length} nodes, ${(parsed.edges || []).length} edges`);
                window.graphData = parsed;
                return;
            } catch (ipcErr) {
                console.error(`[Loader] Tauri IPC fallback also failed for ${src}:`, ipcErr);
                // Fall through to throw the original HTTP error for consistency.
            }
        }

        throw lastError || new Error(`Failed to fetch ${src}`);
    };

    const loadScript = async (src) => {
        const isRuntimeGeneratedDataAsset = src.startsWith('data');
        const useRuntimeGeneratedAssetFlow = Boolean(
            isRuntimeGeneratedDataAsset &&
            (window.__TAURI__ || (typeof runtimeCaps.platform === 'string' && runtimeCaps.platform.startsWith('capacitor-')))
        );
        if (useRuntimeGeneratedAssetFlow) {
            await loadGraphDataFromSidecar(src);
            return;
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src + '?v=' + Date.now();
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
        });
    };

    const triggerWelcomeModal = (hasNodes) => {
        if (typeof window.showWelcomeModal === 'function') {
            window.showWelcomeModal(Boolean(hasNodes));
            return;
        }

        window.__NC_PENDING_WELCOME_STATE = Boolean(hasNodes);

        let attempts = 0;
        const maxAttempts = 30;
        const retry = () => {
            if (typeof window.showWelcomeModal === 'function') {
                const pending = Boolean(window.__NC_PENDING_WELCOME_STATE);
                delete window.__NC_PENDING_WELCOME_STATE;
                window.showWelcomeModal(pending);
                return;
            }

            attempts += 1;
            if (attempts < maxAttempts) {
                setTimeout(retry, 80);
            }
        };

        setTimeout(retry, 0);
    };

    const bootstrapDesktopPathProducer = () => {
        if (!(window.__TAURI__ && runtimeCaps.supports_sidecar)) {
            return;
        }

        const loadedGraphData = typeof graphData !== 'undefined' ? graphData : window.graphData;
        if (!(loadedGraphData && Array.isArray(loadedGraphData.nodes) && loadedGraphData.nodes.length > 0)) {
            console.warn('[SourceManager] Desktop early bridge producer skipped: graph data is not ready.');
            return;
        }

        if (!window.pathApp || typeof window.pathApp.setupEarlyWebSocket !== 'function') {
            console.warn('[SourceManager] Desktop early bridge producer skipped: pathApp is unavailable.');
            return;
        }

        const preferredCentralId = loadedGraphData.nodes[0]?.id || null;
        window.pathApp.setupEarlyWebSocket({
            forceDesktop: true,
            preferredCentralId
        });
        console.log('[SourceManager] Desktop early bridge producer primed for Godot sync.', {
            preferredCentralId,
            nodeCount: loadedGraphData.nodes.length
        });
    };

    const bootstrapScriptLoad = () => {
        // Load data.js first (Critical Data), then app.js (Application Logic)
        loadScript('data.js')
            .then(() => {
                console.log('[Loader] data.js loaded successfully');
                
                // Check data state and trigger Welcome Modal
                // We do this BEFORE loading app.js so the user sees the modal while the app initializes
                const loadedGraphData = typeof graphData !== 'undefined' ? graphData : window.graphData;
                const hasNodes = loadedGraphData && loadedGraphData.nodes && loadedGraphData.nodes.length > 0;
                triggerWelcomeModal(Boolean(hasNodes));
                bootstrapDesktopPathProducer();
                
                return loadScript('app.js');
            })
            .catch(err => {
                console.warn('[Loader] Failed to load data.js (This is expected in Mini Mode or First Run). Proceeding to load app.js...', err);
                
                // Trigger Welcome Modal (Empty State)
                triggerWelcomeModal(false);

                // Proceed to load app.js even if data.js fails
                return loadScript('app.js');
            })
            .then(() => {
                console.log('[Loader] app.js loaded successfully');
                bootstrapDesktopPathProducer();
            })
            .catch(err => {
                console.error('[Loader] Failed to load app.js (Critical Error):', err);
            });
    };

    const folderSelect = document.getElementById('folder-select');
    const loadBtn = document.getElementById('btn-load-source');
    const changeKbPathBtn = document.getElementById('btn-change-kb-path');
    const resetKbPathBtn = document.getElementById('btn-reset-kb-path');
    const currentPathEl = document.getElementById('kb-current-path');

    if (!folderSelect || !loadBtn) return;
    if (loadBtn.dataset.sourceManagerBound === '1') {
        console.warn('[SourceManager] Already initialized, skipping duplicate binding.');
        return;
    }
    loadBtn.dataset.sourceManagerBound = '1';

    // Translation helper
    const t = (key, params) => window.i18n ? window.i18n.t(key, params) : key;
    const isZhLocale = () => Boolean(window.i18n && window.i18n.locale === 'zh');
    const isCapacitorNativeRuntime = () =>
        Boolean(!window.__TAURI__ && typeof runtimeCaps.platform === 'string' && runtimeCaps.platform.startsWith('capacitor-'));

    const ensureRuntimeCapabilityNotice = () => {
        let note = document.getElementById('runtime-capability-note');
        if (note) {
            return note;
        }

        note = document.createElement('span');
        note.id = 'runtime-capability-note';
        note.style.color = '#f7d089';
        note.style.fontSize = '0.76rem';
        note.style.background = 'rgba(20, 20, 20, 0.82)';
        note.style.border = '1px solid #5e4e22';
        note.style.borderRadius = '4px';
        note.style.padding = '2px 6px';
        note.style.display = 'none';
        note.style.maxWidth = '620px';
        note.style.whiteSpace = 'nowrap';
        note.style.overflow = 'hidden';
        note.style.textOverflow = 'ellipsis';

        const sourceControl = document.getElementById('source-control');
        if (sourceControl) {
            sourceControl.appendChild(note);
        } else if (currentPathEl && currentPathEl.parentElement) {
            currentPathEl.parentElement.appendChild(note);
        }

        return note;
    };

    const updateRuntimeCapabilityNotice = () => {
        const note = ensureRuntimeCapabilityNotice();
        if (!note) return;

        const showCacheOnly = Boolean(
            runtimeCaps.supports_build === false &&
            ((window.__TAURI__ && runtimeCaps.supports_sidecar === false) || isCapacitorNativeRuntime())
        );
        if (!showCacheOnly) {
            note.style.display = 'none';
            note.textContent = '';
            return;
        }

        note.style.display = 'inline-flex';
        note.title = 'Mobile runtime capability boundary';
        note.textContent = isCapacitorNativeRuntime()
            ? t('source.error.capacitorReadOnly')
            : (isZhLocale()
                ? '移动端当前为缓存/阅读模式（不支持本地构建）。'
                : 'Mobile runtime is cache/read mode (local build is unavailable).');
    };

    const updateKbPathControls = () => {
        const canRuntimeChangeKb = Boolean(window.__TAURI__ && runtimeCaps.supports_kb_runtime_change);
        [changeKbPathBtn, resetKbPathBtn].forEach((btn) => {
            if (!btn) return;
            btn.style.display = canRuntimeChangeKb ? 'inline-flex' : 'none';
            btn.disabled = !canRuntimeChangeKb;
        });
    };

    const fetchFoldersViaSidecar = async () => {
        const provider = getStorageProvider();
        const kbPath = await provider.getKbPath();
        // Desktop/Tauri-sidecar primary requirement: list real subfolders under KB root.
        let folders = await provider.listFolders();

        // Mobile cache/read mode may expose cached-only targets not present as directories.
        const shouldIncludeCachedTargets = Boolean(window.__TAURI__ && runtimeCaps.supports_build === false);
        if (shouldIncludeCachedTargets) {
            try {
                const cachedTargets = await provider.listAvailableTargets();
                folders = Array.from(new Set([...(folders || []), ...cachedTargets]));
            } catch (err) {
                console.warn('[SourceManager] /api/available-targets unavailable in cache/read mode.', err);
            }
        }

        return { kbPath, folders };
    };

    const fetchFoldersViaRustFallback = async () => {
        if (!window.__TAURI__) {
            return { kbPath: '', folders: [] };
        }

        const provider = getStorageProvider();
        const kbPath = await provider.getKbPath();
        let folders = [];
        try {
            folders = (await provider.listAvailableTargets()) || [];
        } catch (err) {
            console.warn('[SourceManager] get_available_targets unavailable, fallback to get_folders.', err);
            folders = (await provider.listFolders()) || [];
        }
        return { kbPath, folders };
    };

    const checkCacheViaRust = async (target) => {
        if (!window.__TAURI__) {
            return null;
        }
        const provider = getStorageProvider();
        return await provider.checkCache(target);
    };

    const syncSidecarKbPath = async (kbPath) => {
        if (!kbPath) {
            return;
        }

        const provider = getStorageProvider();
        await provider.setKbPath(kbPath);
    };

    const filterTargetsForRuntimeMode = async (targets) => {
        if (runtimeCaps.supports_build || !window.__TAURI__) {
            return targets;
        }

        const uniqueTargets = Array.from(new Set((targets || []).filter((target) => target && target !== 'ALL_FOLDERS')));
        const cachedTargets = [];
        for (const target of uniqueTargets) {
            try {
                const cached = await checkCacheViaRust(target);
                if (cached) {
                    cachedTargets.push(target);
                }
            } catch (err) {
                console.warn('[SourceManager] Failed to check cached target for mobile runtime:', target, err);
            }
        }

        return cachedTargets.sort((a, b) => a.localeCompare(b));
    };

    const LAST_TARGET_KEY = 'nc_last_target';
    const RELOAD_GUARD_KEY = 'nc_reload_guard';
    const RELOAD_GUARD_WINDOW_MS = 4000;

    const askCacheAction = async (targetLabel, cachedDate, isZh) => {
        const existing = document.getElementById('cache-choice-modal');
        if (existing) existing.remove();

        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.id = 'cache-choice-modal';
            overlay.style.position = 'fixed';
            overlay.style.left = '0';
            overlay.style.top = '0';
            overlay.style.width = '100vw';
            overlay.style.height = '100vh';
            overlay.style.background = 'rgba(0, 0, 0, 0.6)';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.zIndex = '9999';

            const panel = document.createElement('div');
            panel.style.width = 'min(560px, 90vw)';
            panel.style.background = '#1f2329';
            panel.style.border = '1px solid #3c4654';
            panel.style.borderRadius = '10px';
            panel.style.padding = '18px';
            panel.style.color = '#e8edf3';
            panel.style.boxShadow = '0 16px 42px rgba(0,0,0,0.45)';

            const title = document.createElement('div');
            title.textContent = isZh ? '检测到已有图谱数据' : 'Existing Graph Cache Found';
            title.style.fontSize = '1.05rem';
            title.style.fontWeight = '700';
            title.style.marginBottom = '10px';
            panel.appendChild(title);

            const desc = document.createElement('div');
            desc.textContent = isZh
                ? `目标: ${targetLabel}\n构建时间: ${cachedDate}\n\n请选择直接加载缓存，或重新生成。`
                : `Target: ${targetLabel}\nBuilt: ${cachedDate}\n\nChoose to load existing cache or regenerate.`;
            desc.style.whiteSpace = 'pre-line';
            desc.style.color = '#c4cdd8';
            desc.style.lineHeight = '1.45';
            desc.style.marginBottom = '16px';
            panel.appendChild(desc);

            const actions = document.createElement('div');
            actions.style.display = 'flex';
            actions.style.justifyContent = 'flex-end';
            actions.style.gap = '10px';

            const regenerateBtn = document.createElement('button');
            regenerateBtn.textContent = isZh ? '重新生成' : 'Regenerate';
            regenerateBtn.style.padding = '8px 12px';
            regenerateBtn.style.borderRadius = '7px';
            regenerateBtn.style.border = '1px solid #576274';
            regenerateBtn.style.background = '#2e3642';
            regenerateBtn.style.color = '#e8edf3';
            regenerateBtn.style.cursor = 'pointer';

            const loadCacheBtn = document.createElement('button');
            loadCacheBtn.textContent = isZh ? '直接加载缓存' : 'Load Existing';
            loadCacheBtn.style.padding = '8px 12px';
            loadCacheBtn.style.borderRadius = '7px';
            loadCacheBtn.style.border = '1px solid #2f69a8';
            loadCacheBtn.style.background = '#2b5f99';
            loadCacheBtn.style.color = '#ffffff';
            loadCacheBtn.style.cursor = 'pointer';

            const cleanup = (result) => {
                overlay.remove();
                resolve(result);
            };

            regenerateBtn.addEventListener('click', () => cleanup('regenerate'));
            loadCacheBtn.addEventListener('click', () => cleanup('load'));
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) cleanup('regenerate');
            });

            actions.appendChild(regenerateBtn);
            actions.appendChild(loadCacheBtn);
            panel.appendChild(actions);
            overlay.appendChild(panel);
            document.body.appendChild(overlay);
        });
    };

    // Prevent accidental double-reload loops when multiple handlers/events fire.
    const requestSafeReload = (reason, options = {}) => {
        const force = Boolean(options && options.force);
        const now = Date.now();
        const raw = sessionStorage.getItem(RELOAD_GUARD_KEY);
        let guard = null;
        try {
            guard = raw ? JSON.parse(raw) : null;
        } catch (_e) {
            guard = null;
        }

        if (!force && guard && typeof guard.ts === 'number' && (now - guard.ts) < RELOAD_GUARD_WINDOW_MS) {
            console.warn('[SourceManager] Reload suppressed by guard. Previous reason:', guard.reason, 'Current reason:', reason);
            return false;
        }

        sessionStorage.setItem(RELOAD_GUARD_KEY, JSON.stringify({ ts: now, reason }));
        window.location.reload();
        return true;
    };

    // Clear stale guard after successful page load.
    try {
        const raw = sessionStorage.getItem(RELOAD_GUARD_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed.ts !== 'number' || (Date.now() - parsed.ts) > RELOAD_GUARD_WINDOW_MS) {
                sessionStorage.removeItem(RELOAD_GUARD_KEY);
            }
        }
    } catch (_e) {
        sessionStorage.removeItem(RELOAD_GUARD_KEY);
    }

    // Prevent duplicate load/build requests caused by rapid clicks or overlapping async flows.
    let isLoadInProgress = false;

    // Fetch folders from backend
    const fetchFolders = async () => {
        try {
            let kbPath = '';
            let folders = [];
            const inCapacitorRuntime = isCapacitorNativeRuntime();

            if (inCapacitorRuntime) {
                kbPath = t('source.capacitor.bundlePath');
                const provider = getStorageProvider();
                let listedFolders = [];
                let cachedTargets = [];
                try {
                    listedFolders = (await provider.listFolders()) || [];
                } catch (folderErr) {
                    console.warn('[SourceManager] Capacitor folder listing failed.', folderErr);
                }
                try {
                    cachedTargets = (await provider.listAvailableTargets()) || [];
                } catch (targetErr) {
                    console.warn('[SourceManager] Capacitor available-target listing failed.', targetErr);
                }
                folders = Array.from(new Set([...(listedFolders || []), ...(cachedTargets || [])]));
                console.log('[SourceManager] Using Capacitor mobile source mode.', {
                    supportsBuild: runtimeCaps.supports_build,
                    folderCount: folders.length
                });
            } else if (runtimeCaps.supports_sidecar) {
                try {
                    const sidecarData = await fetchFoldersViaSidecar();
                    kbPath = sidecarData.kbPath;
                    folders = sidecarData.folders;
                    console.log('[SourceManager] Loaded folders from Node sidecar API:', folders.length);
                } catch (sidecarError) {
                    if (window.__TAURI__) {
                        console.warn('[SourceManager] Sidecar API unavailable, falling back to Rust IPC.', sidecarError);
                        const rustData = await fetchFoldersViaRustFallback();
                        kbPath = rustData.kbPath;
                        folders = rustData.folders;
                    } else {
                        throw sidecarError;
                    }
                }
            } else if (window.__TAURI__) {
                const rustData = await fetchFoldersViaRustFallback();
                kbPath = rustData.kbPath;
                folders = rustData.folders;
            } else {
                const sidecarData = await fetchFoldersViaSidecar();
                kbPath = sidecarData.kbPath;
                folders = sidecarData.folders;
            }

            if (currentPathEl && kbPath) {
                currentPathEl.textContent = t('source.currentPath', { path: kbPath });
                currentPathEl.title = kbPath;
            }

            folders = await filterTargetsForRuntimeMode(folders);

            // Clear existing options
            folderSelect.innerHTML = '';

            let includeAllFoldersOption = true;
            if (!runtimeCaps.supports_build && window.__TAURI__) {
                try {
                    includeAllFoldersOption = Boolean(await checkCacheViaRust('ALL_FOLDERS'));
                } catch (err) {
                    includeAllFoldersOption = false;
                    console.warn('[SourceManager] Failed to check ALL_FOLDERS cache in mobile runtime.', err);
                }
            }

            if (includeAllFoldersOption) {
                const allOption = document.createElement('option');
                allOption.value = 'ALL_FOLDERS';
                allOption.textContent = t('source.allFolders');
                folderSelect.appendChild(allOption);
            }

            // Add individual folders
            if (folders && folders.length > 0) {
                folders.forEach(folder => {
                    // Don't add ALL_FOLDERS again if it's in the list
                    if (folder !== 'ALL_FOLDERS') {
                        const option = document.createElement('option');
                        option.value = folder;
                        option.textContent = folder;
                        folderSelect.appendChild(option);
                    }
                });
            }

            if (folderSelect.options.length === 0 && inCapacitorRuntime) {
                const packagedOption = document.createElement('option');
                packagedOption.value = 'ALL_FOLDERS';
                packagedOption.textContent = t('source.capacitor.packagedGraph');
                folderSelect.appendChild(packagedOption);
            }

            if (folderSelect.options.length === 0) {
                const emptyOption = document.createElement('option');
                emptyOption.value = '';
                emptyOption.disabled = true;
                emptyOption.textContent = t('source.error.buildUnsupportedMobile');
                folderSelect.appendChild(emptyOption);
                loadBtn.disabled = true;
                return;
            }

            loadBtn.disabled = false;

            // Restore last selected target when possible, else default to ALL_FOLDERS.
            const rememberedTarget = localStorage.getItem(LAST_TARGET_KEY);
            const hasRemembered =
                rememberedTarget &&
                Array.from(folderSelect.options).some((opt) => opt.value === rememberedTarget);
            if (hasRemembered) {
                folderSelect.value = rememberedTarget;
            } else if (Array.from(folderSelect.options).some((opt) => opt.value === 'ALL_FOLDERS')) {
                folderSelect.value = 'ALL_FOLDERS';
            } else {
                folderSelect.value = folderSelect.options[0].value;
            }
            console.log('[SourceManager] Folder dropdown populated with', folderSelect.options.length, 'options');
            
        } catch (err) {
            console.error('[SourceManager] Failed to fetch folders:', err);
            
            // Show error in dropdown
            folderSelect.innerHTML = '';
            const errorOption = document.createElement('option');
            errorOption.value = '';
            errorOption.textContent = t('source.error.loadFailed', { error: err && err.message ? err.message : String(err) });
            errorOption.disabled = true;
            folderSelect.appendChild(errorOption);
        }
    };

    // Initial fetch - wait for i18n
    const init = async () => {
        await resolveRuntimeCapabilities();
        updateRuntimeCapabilityNotice();
        updateKbPathControls();
        await waitForSidecarReady();
        bootstrapScriptLoad();

        if (window.i18n && window.i18n.isInitialized) {
            await fetchFolders();
        } else if (window.i18n) {
            window.i18n.onLanguageChange(() => {
                fetchFolders();
            });
        } else {
            // Fallback (shouldn't happen given script order)
            setTimeout(fetchFolders, 500);
        }
    };
    
    init().catch((err) => {
        console.error('[SourceManager] Initialization failed:', err);
    });

    folderSelect.addEventListener('change', () => {
        if (folderSelect.value) {
            localStorage.setItem(LAST_TARGET_KEY, folderSelect.value);
        }
    });

    // Add refresh functionality (will be triggered by IPC event from main process)
    if (window.__TAURI__) {
        window.__TAURI__.event.listen('kb-path-changed', async (event) => {
            console.log('[SourceManager] KB path changed, refreshing folders');
            const newPath = event.payload;
            
            // Inform Sidecar of the new path
            if (runtimeCaps.supports_sidecar) {
                try {
                    await syncSidecarKbPath(newPath);
                } catch (err) {
                    console.error('[SourceManager] Failed to update Sidecar KB path:', err);
                }
            }
            
            fetchFolders();
        });
    }

    if (changeKbPathBtn && window.__TAURI__) {
        changeKbPathBtn.addEventListener('click', async () => {
            if (!runtimeCaps.supports_kb_runtime_change) {
                return;
            }

            const originalText = changeKbPathBtn.textContent;
            changeKbPathBtn.disabled = true;
            if (resetKbPathBtn) resetKbPathBtn.disabled = true;

            try {
                const selectedPath = await window.__TAURI__.core.invoke('choose_kb_path');
                if (!selectedPath) {
                    return;
                }

                await syncSidecarKbPath(selectedPath);
                await fetchFolders();
            } catch (err) {
                const message = err && err.message ? err.message : String(err);
                alert(t('source.error.kbPathChangeFailed', { error: message }));
            } finally {
                changeKbPathBtn.disabled = false;
                if (resetKbPathBtn) resetKbPathBtn.disabled = false;
                if (typeof originalText === 'string') {
                    changeKbPathBtn.textContent = originalText;
                }
            }
        });
    }

    if (resetKbPathBtn && window.__TAURI__) {
        resetKbPathBtn.addEventListener('click', async () => {
            if (!runtimeCaps.supports_kb_runtime_change) {
                return;
            }

            const confirmReset = confirm(
                isZhLocale()
                    ? '确定要重置知识库路径到默认位置吗？'
                    : 'Reset Knowledge Base path to default location?'
            );
            if (!confirmReset) {
                return;
            }

            resetKbPathBtn.disabled = true;
            if (changeKbPathBtn) changeKbPathBtn.disabled = true;
            try {
                const resetPath = await window.__TAURI__.core.invoke('reset_kb_path');
                await syncSidecarKbPath(resetPath);
                await fetchFolders();
            } catch (err) {
                const message = err && err.message ? err.message : String(err);
                alert(t('source.error.kbPathResetFailed', { error: message }));
            } finally {
                resetKbPathBtn.disabled = false;
                if (changeKbPathBtn) changeKbPathBtn.disabled = false;
            }
        });
    }

    // Handle Load
    loadBtn.addEventListener('click', async () => {
        if (isLoadInProgress) {
            console.warn('[SourceManager] Load already in progress; ignoring duplicate click.');
            return;
        }

        isLoadInProgress = true;
        let keepLockedForReload = false;
        loadBtn.disabled = true;

        try {
            const target = folderSelect.value;
            if (!target) {
                alert(t('source.error.noFolder'));
                return;
            }
            localStorage.setItem(LAST_TARGET_KEY, target);

            // Feature: Check for cached graph (Multi-Session Optimization)
            // Bridge-first runtime: sidecar HTTP path with Tauri IPC fallback.
            // 多会话优化：采用桥接优先链路（sidecar HTTP）并保留 Tauri IPC 回退。
            try {
                const storageProvider = getStorageProvider();
                let cached = null;
                cached = await storageProvider.checkCache(target);

                if (cached) {
                    const isZh = window.i18n && window.i18n.locale === 'zh';
                    const targetLabel = target === 'ALL_FOLDERS' ? (isZh ? '全部目录' : 'All Folders') : target;
                    let choice = 'regenerate';
                    try {
                        choice = await askCacheAction(targetLabel, cached.date, Boolean(isZh));
                    } catch (_dialogErr) {
                        const msg = isZh
                            ? `发现 '${targetLabel}' 的现有图谱 (构建于: ${cached.date})。\n\n点击"确定"直接加载 (速度快)。\n点击"取消"重新生成 (如果文件有变动)。`
                            : `Found existing graph for '${targetLabel}' (Built: ${cached.date}).\n\nClick OK to load directly (Fast).\nClick Cancel to regenerate (If files changed).`;
                        choice = confirm(msg) ? 'load' : 'regenerate';
                    }

                    if (choice === 'load') {
                        loadBtn.textContent = isZh ? '加载缓存中...' : 'Loading Cache...';

                        const restoreSuccess = await storageProvider.restoreCache(target);

                        if (restoreSuccess) {
                            keepLockedForReload = requestSafeReload('cache-restore', { force: true });
                            return;
                        }

                        console.warn('[SourceManager] Cache restore failed, falling back to build.');
                    }
                }
            } catch (cacheErr) {
                console.error('[SourceManager] Cache check failed', cacheErr);
            }

            if (!runtimeCaps.supports_build) {
                alert(t('source.error.buildUnsupportedMobile'));
                return;
            }

            loadBtn.textContent = t('source.loading');

            const maxWorkers = window.settingsManager ? window.settingsManager.get('performance', 'maxWorkers') : undefined;
            const enableGPU = window.settingsManager ? window.settingsManager.get('performance', 'enableGPU') : undefined;
            // Map frontend 'gpuRendering' to backend 'enableGPULayout'
            const enableGPULayout = window.settingsManager ? window.settingsManager.get('performance', 'gpuRendering') : undefined;
            const memorySavingMode = window.settingsManager ? window.settingsManager.get('performance', 'memorySavingMode') : undefined;
            const deepDebug = window.settingsManager ? window.settingsManager.get('performance', 'deepDebug') : undefined;

            const buildPayload = { target, maxWorkers, enableGPU, enableGPULayout, memorySavingMode, deepDebug };

            if (window.loadingManager) window.loadingManager.show();

            let success = false;
            let error = '';
            const inCapacitorRuntime = isCapacitorNativeRuntime();
            if ((window.__TAURI__ && runtimeCaps.supports_sidecar === false && window.loadingManager) || (inCapacitorRuntime && window.loadingManager)) {
                window.loadingManager.log(
                    isZhLocale()
                        ? '使用移动端原生构建引擎...'
                        : 'Using mobile native build engine...'
                );
            }

            try {
                const storageProvider = getStorageProvider();
                const result = await storageProvider.buildGraph(buildPayload);
                success = Boolean(result && result.success);
                if (!success) {
                    error = (result && result.error) || 'Build request returned unsuccessful result.';
                } else if (window.loadingManager) {
                    window.loadingManager.log(t('notifications.buildSuccess'));
                }
                if (result && result.warning) {
                    console.warn('[SourceManager] Build warning:', result.warning);
                }
                if (result && result.stats) {
                    console.log('[SourceManager] Build stats:', result.stats);
                    if (window.loadingManager && typeof result.stats.buildModeDetail === 'string') {
                        window.loadingManager.log(
                            isZhLocale()
                                ? `移动构建模式: ${result.stats.buildModeDetail}`
                                : `Mobile build mode: ${result.stats.buildModeDetail}`
                        );
                    }
                }
            } catch (buildErr) {
                error = buildErr && buildErr.message ? buildErr.message : String(buildErr);
            }

            if (success) {
                keepLockedForReload = true;

                // v1.0.1: Pre-verify data.js is accessible before triggering reload.
                // In Tauri, the graph data might not be fetchable via HTTP due to
                // mixed-content restrictions.  Pre-read via IPC ensures data.js exists
                // and the runtime_data directory is populated before the page reloads.
                // v1.0.1: 在触发页面重载前预先验证 data.js 可访问。
                // 在 Tauri 中，由于混合内容限制，可能无法通过 HTTP 获取图谱数据。
                // 通过 IPC 预读可确保 data.js 存在，并在页面重载前已填充 runtime_data 目录。
                if ((window.__TAURI__ && window.__TAURI__.core) || inCapacitorRuntime) {
                    try {
                        const storageProvider = getStorageProvider();
                        const preText = await storageProvider.readGeneratedAsset('data.js');
                        console.log(`[Build] Pre-verified data.js via runtime storage provider: ${preText.length} bytes`);
                    } catch (preErr) {
                        console.warn('[Build] Pre-verify failed (build output may be missing):', preErr);
                    }
                }

                setTimeout(() => {
                    requestSafeReload('build-success', { force: true });
                }, 1000);
                return;
            }

            if (window.loadingManager) window.loadingManager.hide();
            alert(t('source.error.loadFailed', { error: error || 'Unknown error' }));
        } catch (err) {
            if (window.loadingManager) window.loadingManager.hide();
            const message = err && err.message ? err.message : String(err);
            alert(t('source.error.loadFailed', { error: message }));
        } finally {
            if (!keepLockedForReload) {
                isLoadInProgress = false;
                loadBtn.disabled = false;
                loadBtn.textContent = t('source.loadButton');
            }
        }
    });

    // Listen for language changes and update labels
    if (window.i18n) {
        window.i18n.onLanguageChange(() => {
            loadBtn.textContent = t('source.loadButton');
            updateRuntimeCapabilityNotice();
            updateKbPathControls();
            // Re-fetch to update folder labels if needed
            // (Currently folder names are file system names, so no translation needed)
        });
    }
});



