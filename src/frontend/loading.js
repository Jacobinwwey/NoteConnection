/**
 * NoteConnection Loading Manager
 * Handles the display of the loading overlay and log progress.
 */

window.loadingManager = {
    overlayId: 'loading-overlay',
    
    show: function() {
        // Create overlay if not exists
        if (!document.getElementById(this.overlayId)) {
            const div = document.createElement('div');
            div.id = this.overlayId;
            div.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: #1a1a1a;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #eee;
                font-family: "Segoe UI", sans-serif;
            `;
            div.innerHTML = `
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="margin: 0; font-size: 2.5rem; color: #61dafb;">NoteConnection</h1>
                    <p style="margin-top: 5px; color: #aaa;">Knowledge Graph Builder</p>
                </div>
                
                <div style="width: 60%; max-width: 600px; height: 4px; background: #333; border-radius: 2px; overflow: hidden; margin-bottom: 20px;">
                    <div id="loading-bar" style="width: 0%; height: 100%; background: #61dafb; transition: width 0.3s ease-out; box-shadow: 0 0 10px #61dafb;"></div>
                </div>
                
                <div id="loading-log" style="
                    width: 60%; 
                    max-width: 600px; 
                    height: 200px; 
                    background: #111; 
                    border: 1px solid #333; 
                    border-radius: 4px;
                    overflow-y: auto; 
                    padding: 10px; 
                    font-family: 'Consolas', monospace; 
                    font-size: 0.85rem; 
                    color: #ccc;
                    box-shadow: inset 0 0 10px rgba(0,0,0,0.5);
                "></div>
                
                <p style="margin-top: 20px; color: #666; font-size: 0.9rem;">
                    Analyzing your notes... larger knowledge bases may take a moment.
                </p>
            `;
            document.body.appendChild(div);
        }
        
        const el = document.getElementById(this.overlayId);
        el.style.display = 'flex';
        
        // Reset state
        this.log('Initializing build process...');
        const bar = document.getElementById('loading-bar');
        if (bar) bar.style.width = '5%';
    },

    hide: function() {
        const el = document.getElementById(this.overlayId);
        if (el) {
            // Fade out effect
            el.style.transition = 'opacity 0.5s';
            el.style.opacity = '0';
            setTimeout(() => {
                el.style.display = 'none';
                el.style.opacity = '1'; // Reset for next time
            }, 500);
        }
    },

    log: function(msg) {
        if (!msg) return;
        
        const prompt = document.getElementById('loading-log');
        if (prompt) {
            const line = document.createElement('div');
            line.innerText = `> ${msg}`;
            line.style.marginBottom = '2px';
            if (msg.toLowerCase().includes('error')) line.style.color = '#ff6b6b';
            if (msg.toLowerCase().includes('success') || msg.toLowerCase().includes('built')) line.style.color = '#4cd964';
            
            prompt.appendChild(line);
            prompt.scrollTop = prompt.scrollHeight;
        }
        
        // Progress Heuristics
        const bar = document.getElementById('loading-bar');
        if (bar) {
            let p = 0;
            if (msg.includes('Loading files')) p = 20;
            else if (msg.includes('Loaded')) p = 40;
            else if (msg.includes('Found layout')) p = 50;
            else if (msg.includes('Building graph')) p = 60;
            else if (msg.includes('Graph built')) p = 90;
            else if (msg.includes('Success')) p = 100;
            
            if (p > 0) {
                // Ensure we don't go backwards unless it's a restart
                const current = parseFloat(bar.style.width) || 0;
                if (p > current) bar.style.width = p + '%';
            }
        }
    }
};

// Listen for Electron logs if available
if (window.electronAPI && window.electronAPI.on) {
    window.electronAPI.on('build-log', (msg) => {
        if (window.loadingManager && document.getElementById('loading-overlay') && document.getElementById('loading-overlay').style.display !== 'none') {
            window.loadingManager.log(msg);
        }
    });
}
