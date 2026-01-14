document.addEventListener('DOMContentLoaded', () => {
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
            
            if (window.electronAPI) {
                // Electron Mode: Get KB path and enumerate folders
                const kbPath = await window.electronAPI.getKbPath();
                
                // Display current path
                if (currentPathEl) {
                    currentPathEl.textContent = t('source.currentPath', { path: kbPath });
                    currentPathEl.title = kbPath;
                }
                
                // Get folder listing vie IPC
                const folderData = await window.electronAPI.getFolders();
                folders = folderData || [];
                
                console.log('[SourceManager] Electron mode, KB path:', kbPath);
                console.log('[SourceManager] Found folders:', folders);
            } else {
                // Web Mode Fallback (if server running)
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
    if (window.electronAPI && window.electronAPI.onKbPathChanged) {
        window.electronAPI.onKbPathChanged(() => {
            console.log('[SourceManager] KB path changed, refreshing folders');
            fetchFolders();
        });
    }

    // Handle Load
    loadBtn.addEventListener('click', () => {
        const target = folderSelect.value;
        if (!target) {
            alert(t('source.error.noFolder'));
            return;
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

                if (window.electronAPI) {
                    const res = await window.electronAPI.buildGraph(buildPayload);
                    // Standardize result. Controller returns 'data' on success, or throws.
                    // Actually buildGraph returns data directly. If it throws, we catch it.
                    success = true; 
                    if (window.loadingManager) window.loadingManager.log(t('notifications.buildSuccess'));
                } else {
                    const res = await fetch('/api/build', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(buildPayload)
                    });
                    const data = await res.json();
                    if (data.success) {
                        success = true;
                        if (window.loadingManager) window.loadingManager.log(t('notifications.buildSuccess'));
                    } else {
                        error = data.error;
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
