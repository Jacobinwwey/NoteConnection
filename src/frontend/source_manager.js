document.addEventListener('DOMContentLoaded', () => {
    const folderSelect = document.getElementById('folder-select');
    const loadBtn = document.getElementById('btn-load-source');

    if (!folderSelect || !loadBtn) return;

    // Fetch folders
    fetch('/api/folders')
        .then(response => response.json())
        .then(data => {
            if (data.folders) {
                data.folders.forEach(folder => {
                    const option = document.createElement('option');
                    option.value = folder;
                    option.textContent = folder;
                    folderSelect.appendChild(option);
                });
            }
        })
        .catch(err => {
            console.warn('Backend API not available (likely running static).', err);
            // Optional: Hide controls if API fails
            const container = document.getElementById('source-control');
            if (container) container.style.display = 'none';
        });

    // Handle Load
    loadBtn.addEventListener('click', () => {
        const target = folderSelect.value;
        if (!target) {
            alert('Please select a folder first.');
            return;
        }

        loadBtn.disabled = true;
        loadBtn.textContent = '...';

        fetch('/api/build', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target: target })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Reload graph data logic.
                // Reload page to refresh data.js
                window.location.reload();
            } else {
                alert('Build Failed: ' + data.error);
            }
        })
        .catch(err => {
            alert('Error: ' + err);
        })
        .finally(() => {
            loadBtn.disabled = false;
            loadBtn.textContent = 'Load';
        });
    });
});
