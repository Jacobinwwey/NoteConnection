// welcome.js - Handles the "Empty State" or "Welcome" experience for new users.

document.addEventListener('DOMContentLoaded', () => {
    // Check if graphData is empty or missing
    // graphData is defined in data.js which is loaded before this.
    // However, if data.js was generated with 0 nodes, we should show the welcome screen.
    
    // Safety check for graphData existence
    if (typeof graphData === 'undefined' || !graphData || !graphData.nodes || graphData.nodes.length === 0) {
        showWelcomeModal();
    }
});

function showWelcomeModal() {
    // Check if modal already exists (to prevent duplicates)
    if (document.getElementById('welcome-modal')) return;

    // Create Modal HTML
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'welcome-modal';
    modalOverlay.className = 'modal-overlay';
    modalOverlay.style.display = 'flex'; // Force show
    modalOverlay.style.zIndex = '2000'; // Top level

    modalOverlay.innerHTML = `
        <div class="modal-content" style="max-width: 500px; text-align: center;">
            <div class="modal-header" style="justify-content: center;">
                <h2>Welcome to NoteConnection</h2>
            </div>
            <div class="modal-body">
                <p style="font-size: 1.1rem; color: #ccc; margin-bottom: 20px;">
                    It looks like your Knowledge Graph is empty. 
                    <br>Let's get you started!
                </p>
                
                <div style="background: #333; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h3 style="margin-top: 0; color: #61dafb;">1. Select Source</h3>
                    <p style="font-size: 0.9rem; color: #aaa;">
                        Use the dropdown in the top-left corner to choose a folder from your <code>Knowledge_Base</code>.
                    </p>
                </div>

                <div style="background: #333; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h3 style="margin-top: 0; color: #61dafb;">2. Load Graph</h3>
                    <p style="font-size: 0.9rem; color: #aaa;">
                        Click the <span style="background: #2c5282; padding: 2px 6px; border-radius: 3px; color: white; font-size: 0.8rem;">Load</span> button to analyze your notes.
                    </p>
                </div>

                <p style="font-size: 0.9rem; color: #888;">
                    <em>Tip: Ensure your Markdown files are placed in the <code>Knowledge_Base</code> directory.</em>
                </p>
            </div>
        </div>
    `;

    document.body.appendChild(modalOverlay);
    
    // Highlight the Source Control area
    const sourceControl = document.getElementById('source-control');
    if (sourceControl) {
        sourceControl.style.boxShadow = '0 0 15px 5px rgba(97, 218, 251, 0.5)';
        sourceControl.style.zIndex = '2001'; // Above modal if needed, or just highlight
        sourceControl.style.position = 'relative'; // Ensure z-index works
    }
}
