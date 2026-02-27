document.addEventListener('DOMContentLoaded', () => {
    // Dynamic Script Loader (Cache Busting & Order Guarantee)
    const loadScript = (src) => {
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
            const hasNodes = typeof graphData !== 'undefined' && graphData && graphData.nodes && graphData.nodes.length > 0;
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
    const currentPathEl = document.getElementById('kb-current-path'); // Will add to HTML

    if (!folderSelect || !loadBtn) return;

    // Translation helper
    const t = (key, params) => window.i18n ? window.i18n.t(key, params) : key;

    // Fetch folders from backend
    const fetchFolders = async () => {
        try {
            let folders = [];
            
                if (window.__TAURI__) {
                    // Tauri Mode: Get KB path and enumerate folders via API
                    const kbPath = await window.__TAURI__.core.invoke('get_kb_path');
                    
                    // Display current path
                    if (currentPathEl) {
                        currentPathEl.textContent = t('source.currentPath', { path: kbPath });
                        currentPathEl.title = kbPath;
                    }
                    
                    // Get folder listing via HTTP from Sidecar
                    const folderRes = await fetch('http://localhost:3000/api/folders');
                    const folderData = await folderRes.json();
                    folders = folderData.folders || [];
                    
                    console.log('[SourceManager] Tauri mode, KB path:', kbPath);
                    console.log('[SourceManager] Found folders:', folders);
            } else {
                // HTTP Mode (Tauri/Web): Use REST API
                // 获取知识库路径和文件夹列表
                try {
                    const kbRes = await fetch('/api/kb-path');
                    const kbData = await kbRes.json();
                    if (currentPathEl && kbData.kbPath) {
                        currentPathEl.textContent = t('source.currentPath', { path: kbData.kbPath });
                        currentPathEl.title = kbData.kbPath;
                    }
                } catch (e) {
                    console.warn('[SourceManager] Could not fetch KB path:', e);
                }
                
                const res = await fetch('/api/folders');
                const data = await res.json();
                folders = data.folders || [];
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
            errorOption.textContent = t('source.error.loadFailed', { error: err.message });
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
                
                if (window.__TAURI__) {
                    // Tauri Mode: Use Rust IPC
                    cached = await window.__TAURI__.core.invoke('check_cache', { target: target });
                } else {
                    // Web Mode: Use REST API (or fallback if backend supports it natively without sidecar)
                    const cacheRes = await fetch(`http://localhost:3000/api/check-cache?target=${encodeURIComponent(target)}`);
                    cached = await cacheRes.json();
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
                        if (window.__TAURI__) {
                            success = await window.__TAURI__.core.invoke('restore_cache', { target: target });
                        } else {
                            const restoreRes = await fetch(`http://localhost:3000/api/restore-cache?target=${encodeURIComponent(target)}`);
                            const restoreData = await restoreRes.json();
                            success = restoreData.success;
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
