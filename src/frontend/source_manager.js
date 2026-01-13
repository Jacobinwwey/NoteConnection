document.addEventListener('DOMContentLoaded', () => {
    const folderSelect = document.getElementById('folder-select');
    const loadBtn = document.getElementById('btn-load-source');

    if (!folderSelect || !loadBtn) return;

    // Fetch folders
    const fetchFolders = async () => {
        try {
            let folders =[];
            if (window.electronAPI) {
                // Electron Mode: KB path is already configured via File menu
                // Auto-select "All Folders" since we're using the configured path
                folders = ['ALL_FOLDERS'];
                console.log('[SourceManager] Electron mode: Using configured KB path');
            } else {
                // Web Mode Fallback (if server running)
                const res = await fetch('/api/folders');
                const data = await res.json();
                folders = data.folders || [];
            }

            if (folders && folders.length > 0) {
                folders.forEach(folder => {
                    const option = document.createElement('option');
                    option.value = folder;
                    option.textContent = folder;
                    folderSelect.appendChild(option);
                });
                
                // Auto-select first option in Electron mode
                if (window.electronAPI) {
                    folderSelect.value = 'ALL_FOLDERS';
                    console.log('[SourceManager] Auto-selected ALL_FOLDERS');
                }
            }
        } catch (err) {
            console.warn('Failed to fetch folders:', err);
             const container = document.getElementById('source-control');
            if (container) container.style.display = 'none';
        }
    };
    fetchFolders();

    // Handle Load
    loadBtn.addEventListener('click', () => {
        const target = folderSelect.value;
        if (!target) {
            alert('Please select a folder first.');
            return;
        }

        loadBtn.disabled = true;
        loadBtn.textContent = '...';

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
                    if (window.loadingManager) window.loadingManager.log("Build Success! Reloading interface...");
                } else {
                    const res = await fetch('/api/build', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(buildPayload)
                    });
                    const data = await res.json();
                    if (data.success) {
                        success = true;
                        if (window.loadingManager) window.loadingManager.log("Build Success! Reloading interface...");
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
                    alert('Build Failed: ' + (error || 'Unknown error'));
                }
            } catch (err) {
                if (window.loadingManager) window.loadingManager.hide();
                alert('Error: ' + err);
            }
        };

        runBuild().finally(() => {
             loadBtn.disabled = false;
             loadBtn.textContent = 'Load';
             // Note: If success, page reloads anyway. If failure, we hid it above.
        });

    });
});
