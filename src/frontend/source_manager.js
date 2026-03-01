document.addEventListener('DOMContentLoaded', () => {
    // Dynamic Script Loader (Cache Busting & Order Guarantee)
    const loadGraphDataFromSidecar = async (src) => {
        const url = 'http://localhost:3000/' + src + '?v=' + Date.now();
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Failed to fetch ${src}: HTTP ${response.status}`);
        }

        const text = await response.text();
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
            // Fallback for unexpected payload shape.
            parsed = new Function(
                `${text}\n; return typeof graphData !== 'undefined' ? graphData : (typeof window !== 'undefined' ? window.graphData : undefined);`
            )();
        }

        if (!parsed || !Array.isArray(parsed.nodes)) {
            throw new Error('Invalid graph data payload from sidecar.');
        }

        window.graphData = parsed;
    };

    const loadScript = async (src) => {
        if (window.__TAURI__ && src.startsWith('data')) {
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

    // Load data.js first (Critical Data), then app.js (Application Logic)
    loadScript('data.js')
        .then(() => {
            console.log('[Loader] data.js loaded successfully');
            
            // Check data state and trigger Welcome Modal
            // We do this BEFORE loading app.js so the user sees the modal while the app initializes
            const loadedGraphData = typeof graphData !== 'undefined' ? graphData : window.graphData;
            const hasNodes = loadedGraphData && loadedGraphData.nodes && loadedGraphData.nodes.length > 0;
            if (typeof window.showWelcomeModal === 'function') {
                window.showWelcomeModal(hasNodes);
            }
            
            return loadScript('app.js');
        })
        .catch(err => {
            console.warn('[Loader] Failed to load data.js (This is expected in Mini Mode or First Run). Proceeding to load app.js...', err);
            
            // Trigger Welcome Modal (Empty State)
            if (typeof window.showWelcomeModal === 'function') {
                window.showWelcomeModal(false);
            }

            // Proceed to load app.js even if data.js fails
            return loadScript('app.js');
        })
        .then(() => {
            console.log('[Loader] app.js loaded successfully');
        })
        .catch(err => {
            console.error('[Loader] Failed to load app.js (Critical Error):', err);
        });

    const folderSelect = document.getElementById('folder-select');
    const loadBtn = document.getElementById('btn-load-source');
    const currentPathEl = document.getElementById('kb-current-path');

    if (!folderSelect || !loadBtn) return;
    if (loadBtn.dataset.sourceManagerBound === '1') {
        console.warn('[SourceManager] Already initialized, skipping duplicate binding.');
        return;
    }
    loadBtn.dataset.sourceManagerBound = '1';

    // Translation helper
    const t = (key, params) => window.i18n ? window.i18n.t(key, params) : key;

    const fetchFoldersViaSidecar = async () => {
        const kbRes = await fetch('http://localhost:3000/api/kb-path');
        const kbData = await kbRes.json();
        const kbPath = kbData && kbData.kbPath ? kbData.kbPath : '';

        const foldersRes = await fetch('http://localhost:3000/api/folders');
        const foldersData = await foldersRes.json();
        const folders = foldersData && Array.isArray(foldersData.folders) ? foldersData.folders : [];

        return { kbPath, folders };
    };

    const fetchFoldersViaRustFallback = async () => {
        if (!window.__TAURI__) {
            return { kbPath: '', folders: [] };
        }

        const kbPath = await window.__TAURI__.core.invoke('get_kb_path');
        const folders = (await window.__TAURI__.core.invoke('get_folders')) || [];
        return { kbPath, folders };
    };

    const checkCacheViaSidecar = async (target) => {
        const cacheRes = await fetch(`http://localhost:3000/api/check-cache?target=${encodeURIComponent(target)}`);
        if (!cacheRes.ok) {
            throw new Error(`Cache API error: HTTP ${cacheRes.status}`);
        }
        return await cacheRes.json();
    };

    const restoreCacheViaSidecar = async (target) => {
        const restoreRes = await fetch(`http://localhost:3000/api/restore-cache?target=${encodeURIComponent(target)}`);
        if (!restoreRes.ok) {
            throw new Error(`Restore API error: HTTP ${restoreRes.status}`);
        }
        const restoreData = await restoreRes.json();
        return Boolean(restoreData && restoreData.success);
    };

    const LAST_TARGET_KEY = 'nc_last_target';

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

    // Prevent duplicate load/build requests caused by rapid clicks or overlapping async flows.
    let isLoadInProgress = false;

    // Fetch folders from backend
    const fetchFolders = async () => {
        try {
            let kbPath = '';
            let folders = [];

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

            if (currentPathEl && kbPath) {
                currentPathEl.textContent = t('source.currentPath', { path: kbPath });
                currentPathEl.title = kbPath;
            }

            // Clear existing options
            folderSelect.innerHTML = '';

            // Always add "All Folders" option first
            const allOption = document.createElement('option');
            allOption.value = 'ALL_FOLDERS';
            allOption.textContent = t('source.allFolders');
            folderSelect.appendChild(allOption);

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

            // Restore last selected target when possible, else default to ALL_FOLDERS.
            const rememberedTarget = localStorage.getItem(LAST_TARGET_KEY);
            const hasRemembered =
                rememberedTarget &&
                Array.from(folderSelect.options).some((opt) => opt.value === rememberedTarget);
            folderSelect.value = hasRemembered ? rememberedTarget : 'ALL_FOLDERS';
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
    const init = () => {
        if (window.i18n && window.i18n.isInitialized) {
            fetchFolders();
        } else if (window.i18n) {
            window.i18n.onLanguageChange(() => {
                fetchFolders();
            });
        } else {
            // Fallback (shouldn't happen given script order)
            setTimeout(fetchFolders, 500);
        }
    };
    
    init();

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
            try {
                await fetch('http://localhost:3000/api/kb-path', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ kbPath: newPath })
                });
            } catch (err) {
                console.error('[SourceManager] Failed to update Sidecar KB path:', err);
            }
            
            fetchFolders();
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
            // Works in both Electron (IPC) and Tauri/Web (HTTP API) modes
            // 多会话优化：检查缓存图谱，同时支持 Electron IPC 和 HTTP API 模式
            try {
                let cached = null;

                try {
                    // Preferred path in Tauri/Electron/Web: query sidecar cache API.
                    cached = await checkCacheViaSidecar(target);
                } catch (sidecarErr) {
                    if (window.__TAURI__) {
                        // Fallback path only when sidecar API is unreachable.
                        cached = await window.__TAURI__.core.invoke('check_cache', { target: target });
                    } else {
                        throw sidecarErr;
                    }
                }

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

                        let restoreSuccess = false;
                        try {
                            restoreSuccess = await restoreCacheViaSidecar(target);
                        } catch (sidecarErr) {
                            if (window.__TAURI__) {
                                restoreSuccess = await window.__TAURI__.core.invoke('restore_cache', { target: target });
                            } else {
                                throw sidecarErr;
                            }
                        }

                        if (restoreSuccess) {
                            keepLockedForReload = true;
                            window.location.reload();
                            return;
                        }

                        console.warn('[SourceManager] Cache restore failed, falling back to build.');
                    }
                }
            } catch (cacheErr) {
                console.error('[SourceManager] Cache check failed', cacheErr);
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
            const res = await fetch('http://localhost:3000/api/build', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildPayload)
            });

            if (res.ok) {
                success = true;
                if (window.loadingManager) window.loadingManager.log(t('notifications.buildSuccess'));
            } else {
                try {
                    const data = await res.json();
                    error = data.error || `HTTP ${res.status}`;
                } catch (_e) {
                    error = `HTTP ${res.status}: ${res.statusText}`;
                }
            }

            if (success) {
                keepLockedForReload = true;
                setTimeout(() => {
                    window.location.reload();
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
            // Re-fetch to update folder labels if needed
            // (Currently folder names are file system names, so no translation needed)
        });
    }
});
