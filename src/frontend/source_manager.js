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
            
            // Auto-select first option (All Folders)
            folderSelect.value = 'ALL_FOLDERS';
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
        const target = folderSelect.value;
        if (!target) {
            alert(t('source.error.noFolder'));
            return;
        }

        // Feature: Check for cached graph (Multi-Session Optimization)
        // Works in both Electron (IPC) and Tauri/Web (HTTP API) modes
        // 多会话优化：检查缓存图谱，同时支持 Electron IPC 和 HTTP API 模式
        if (target !== 'ALL_FOLDERS') {
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
                    // Simple bilingual fallback since we haven't updated json files yet
                    const isZh = window.i18n && window.i18n.locale === 'zh';
                    const msg = isZh 
                        ? `发现 '${target}' 的现有图谱 (构建于: ${cached.date})。\n\n点击"确定"直接加载 (速度快)。\n点击"取消"重新生成 (如果文件有变动)。`
                        : `Found existing graph for '${target}' (Built: ${cached.date}).\n\nClick OK to load directly (Fast).\nClick Cancel to regenerate (If files changed).`;
                    
                    if (confirm(msg)) {
                        loadBtn.disabled = true;
                        loadBtn.textContent = 'Loading Cache...';
                        
                        let success = false;

                        try {
                            success = await restoreCacheViaSidecar(target);
                        } catch (sidecarErr) {
                            if (window.__TAURI__) {
                                success = await window.__TAURI__.core.invoke('restore_cache', { target: target });
                            } else {
                                throw sidecarErr;
                            }
                        }
                        
                        if (success) {
                            // Reload with cache busting handled by dynamic loader
                            window.location.reload();
                            return;
                        } else {
                            console.warn('[SourceManager] Cache restore failed, falling back to build.');
                        }
                    }
                }
            } catch (e) {
                console.error('[SourceManager] Cache check failed', e);
            }
        }

        loadBtn.disabled = true;
        loadBtn.textContent = t('source.loading');

        const maxWorkers = window.settingsManager ? window.settingsManager.get('performance', 'maxWorkers') : undefined;
        const enableGPU = window.settingsManager ? window.settingsManager.get('performance', 'enableGPU') : undefined;
        // Map frontend 'gpuRendering' to backend 'enableGPULayout'
        const enableGPULayout = window.settingsManager ? window.settingsManager.get('performance', 'gpuRendering') : undefined;
        const memorySavingMode = window.settingsManager ? window.settingsManager.get('performance', 'memorySavingMode') : undefined;
        const deepDebug = window.settingsManager ? window.settingsManager.get('performance', 'deepDebug') : undefined;

        const buildPayload = { target, maxWorkers, enableGPU, enableGPULayout, memorySavingMode, deepDebug };

        const runBuild = async () => {
            // Show Loading Screen
            if (window.loadingManager) window.loadingManager.show();

            try {
                let success = false;
                let error = '';

                // Use fetch for both Tauri sidecar and standard HTTP usage
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
                    } catch(e) {
                         error = `HTTP ${res.status}: ${res.statusText}`;
                    }
                }

                if (success) {
                    // Delay reload slightly to show success
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                } else {
                    if (window.loadingManager) window.loadingManager.hide();
                    alert(t('source.error.loadFailed', { error: error || 'Unknown error' }));
                }
            } catch (err) {
                if (window.loadingManager) window.loadingManager.hide();
                alert(t('source.error.loadFailed', { error: err.message }));
            }
        };

        runBuild().finally(() => {
             loadBtn.disabled = false;
             loadBtn.textContent = t('source.loadButton');
             // Note: If success, page reloads anyway. If failure, we hid it above.
        });

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
