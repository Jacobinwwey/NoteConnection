/**
 * Reader Module
 * Handles rendering of Markdown, Math, Mermaid, and window management.
 */

class Reader {
    constructor() {
        this.window = document.getElementById('reading-window');
        this.contentBox = document.getElementById('reading-content-box');
        this.body = document.getElementById('reading-body');
        this.title = document.getElementById('reading-title');
        
        this.isLocked = true;
        this.currentZoom = 1.0;
        
        this.init();
    }

    init() {
        // Close Button
        document.getElementById('btn-reader-close').addEventListener('click', () => {
            this.close();
        });

        // Close on overlay click
        this.window.addEventListener('click', (e) => {
            if (e.target === this.window) this.close();
        });

        // Lock Toggle
        document.getElementById('btn-reader-lock').addEventListener('click', () => {
            this.toggleLock();
        });

        // Zoom Controls
        document.getElementById('btn-reader-zoom-in').addEventListener('click', () => this.zoom(0.1));
        document.getElementById('btn-reader-zoom-out').addEventListener('click', () => this.zoom(-0.1));

        // Initialize Mermaid
        if (window.mermaid) {
            mermaid.initialize({ startOnLoad: false, theme: 'dark' });
        }
    }

    open(node) {
        // 1. Set Title
        this.title.innerText = node.label;

        // 2. Prepare Content
        let rawContent = node.content || "*No content available.*";
        let htmlContent = marked.parse(rawContent);
        this.body.innerHTML = htmlContent;

        // 3. Show Window EARLY (Crucial for Mermaid layout calculation)
        const settings = window.settingsManager.get('reading', 'mode');
        this.contentBox.className = `reading-box ${settings === 'fullscreen' ? 'fullscreen-mode' : 'window-mode'}`;
        this.window.style.display = 'flex';

        // 4. Render Latex (KaTeX)
        if (window.renderMathInElement) {
            renderMathInElement(this.body, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false}
                ]
            });
        }

        // 5. Render Mermaid
        if (window.mermaid) {
            // Re-configure for robustness & High Contrast
            mermaid.initialize({ 
                startOnLoad: false, 
                theme: 'dark', // Switch to 'dark' base for better defaults
                themeVariables: {
                    darkMode: true,
                    background: '#1e1e1e', // Match app bg
                    mainBkg: '#1e1e1e',    // Container bg
                    
                    // Node Colors (High Contrast)
                    primaryColor: '#2d2d2d', 
                    primaryTextColor: '#ffffff',
                    primaryBorderColor: '#61dafb',
                    
                    // Edges & Arrows
                    lineColor: '#a0a0a0',
                    secondaryColor: '#333',
                    tertiaryColor: '#2d2d2d',
                    
                    // Text
                    textColor: '#ffffff',
                    fontSize: '16px' // Bump base size
                },
                securityLevel: 'loose', // Allow HTML in nodes
                htmlLabels: true
            });

            const mermaidBlocks = this.body.querySelectorAll('pre code.language-mermaid');
            mermaidBlocks.forEach((block, index) => {
                // Robust Decoding: Handle HTML entities (e.g., &gt; -> >)
                const txt = document.createElement("textarea");
                txt.innerHTML = block.innerHTML;
                const graphDefinition = txt.value;
                
                const parentPre = block.parentElement;
                
                // Create container
                const div = document.createElement('div');
                div.className = 'mermaid';
                div.id = `mermaid-${index}`;
                div.textContent = graphDefinition; // Use textContent to set raw text
                
                parentPre.parentNode.replaceChild(div, parentPre);
            });
            
            if (mermaidBlocks.length > 0) {
                // Slight delay to ensure DOM is reflowed after show
                setTimeout(() => {
                    mermaid.run().catch(err => {
                        console.error("Mermaid error:", err);
                        // Fallback: Show error in UI
                        // Mermaid usually handles this, but we can log it.
                    });
                }, 10);
            }
        }

        // 6. Reset State
        this.isLocked = true;
        this.currentZoom = 1.0;
        this.updateLockState();
        this.updateZoom();
    }

    close() {
        this.window.style.display = 'none';
    }

    toggleLock() {
        this.isLocked = !this.isLocked;
        this.updateLockState();
    }

    updateLockState() {
        const btn = document.getElementById('btn-reader-lock');
        const zoomBtns = document.querySelectorAll('#btn-reader-zoom-in, #btn-reader-zoom-out');
        
        if (this.isLocked) {
            this.body.classList.add('locked');
            this.body.classList.remove('unlocked');
            btn.innerText = "🔒";
            btn.title = "Locked: Sizing fixed";
            zoomBtns.forEach(b => b.disabled = true);
        } else {
            this.body.classList.add('unlocked');
            this.body.classList.remove('locked');
            btn.innerText = "🔓";
            btn.title = "Unlocked: Adjust size enabled";
            zoomBtns.forEach(b => b.disabled = false);
        }
    }

    zoom(delta) {
        if (this.isLocked) return;
        this.currentZoom = Math.max(0.5, Math.min(3.0, this.currentZoom + delta));
        this.updateZoom();
    }

    updateZoom() {
        this.body.style.fontSize = `${this.currentZoom}rem`;
        // Scale images if needed, but CSS 'resize' handles explicit image resizing in unlocked mode.
        // Font size scaling handles text content scaling.
    }
}

const reader = new Reader();
window.reader = reader;
