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
        this.currentZoom = 0.5;
        
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
        
        // Touch Gestures (Pinch to Zoom)
        this.initTouchZoom();
    }
    
    initTouchZoom() {
        let initialDistance = 0;
        let initialZoom = 1.0;
        
        this.body.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                initialDistance = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );
                initialZoom = this.currentZoom;
                e.preventDefault(); // Prevent default browser zoom if possible
            }
        }, { passive: false });

        this.body.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                const currentDistance = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );
                
                if (initialDistance > 0) {
                    const scale = currentDistance / initialDistance;
                    // Apply relative to initial zoom of this gesture
                    // We directly update currentZoom but might want to debounce render
                    const newZoom = initialZoom * scale;
                    // Clamp
                    this.currentZoom = Math.max(0.5, Math.min(4.0, newZoom));
                    this.updateZoom();
                }
                e.preventDefault();
            }
        }, { passive: false });

        this.body.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                initialDistance = 0;
            }
        });
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
                    mermaid.run().then(() => {
                        this.initMermaidZoom();
                    }).catch(err => {
                        console.error("Mermaid error:", err);
                        // Fallback: Show error in UI
                        // Mermaid usually handles this, but we can log it.
                    });
                }, 10);
            }
        }

        // 6. Reset State
        this.isLocked = true;
        this.currentZoom = 0.5;
        this.updateLockState();
        this.updateZoom();
    }

    initMermaidZoom() {
        const mermaidDivs = this.body.querySelectorAll('.mermaid');
        mermaidDivs.forEach(div => {
            div.style.cursor = 'zoom-in';
            div.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent Reader close
                this.openMermaidOverlay(div.innerHTML);
            });
        });
    }

    openMermaidOverlay(svgContent) {
        // Create Overlay
        const overlay = document.createElement('div');
        overlay.id = 'mermaid-zoom-overlay';
        overlay.className = 'mermaid-overlay';
        
        // Container for transform
        const container = document.createElement('div');
        container.className = 'mermaid-zoom-container';
        container.innerHTML = svgContent;
        overlay.appendChild(container);

        // Close Button
        const closeBtn = document.createElement('button');
        closeBtn.innerText = '×';
        closeBtn.className = 'mermaid-close-btn';
        closeBtn.onclick = () => document.body.removeChild(overlay);
        overlay.appendChild(closeBtn);

        document.body.appendChild(overlay);

        // Pan/Zoom State
        let scale = 1;
        let panning = false;
        let pointX = 0;
        let pointY = 0;
        let startX = 0;
        let startY = 0;

        const setTransform = () => {
            container.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
        };

        // Mouse Events
        overlay.onmousedown = (e) => {
            e.preventDefault();
            startPanning(e.clientX, e.clientY);
        };

        overlay.onmouseup = () => {
            panning = false;
        };

        overlay.onmousemove = (e) => {
            e.preventDefault();
            if (!panning) return;
            pan(e.clientX, e.clientY);
        };

        overlay.onwheel = (e) => {
            e.preventDefault();
            const xs = (e.clientX - pointX) / scale;
            const ys = (e.clientY - pointY) / scale;
            const delta = -e.deltaY;
            
            (delta > 0) ? (scale *= 1.2) : (scale /= 1.2);
            scale = Math.max(0.1, Math.min(scale, 10)); // Limit zoom

            pointX = e.clientX - xs * scale;
            pointY = e.clientY - ys * scale;

            setTransform();
        };

        // Touch Events
        let lastTouchDistance = 0;
        let lastTouchCenter = { x: 0, y: 0 };
        
        const getDistance = (touches) => {
            return Math.hypot(
                touches[0].pageX - touches[1].pageX,
                touches[0].pageY - touches[1].pageY
            );
        };

        const getCenter = (touches) => {
            return {
                x: (touches[0].clientX + touches[1].clientX) / 2,
                y: (touches[0].clientY + touches[1].clientY) / 2
            };
        };

        overlay.ontouchstart = (e) => {
            if (e.touches.length === 1) {
                startPanning(e.touches[0].clientX, e.touches[0].clientY);
            } else if (e.touches.length === 2) {
                lastTouchDistance = getDistance(e.touches);
                lastTouchCenter = getCenter(e.touches);
            }
        };

        overlay.ontouchend = () => {
            panning = false;
        };

        overlay.ontouchmove = (e) => {
            e.preventDefault();
            if (e.touches.length === 1 && panning) {
                pan(e.touches[0].clientX, e.touches[0].clientY);
            } else if (e.touches.length === 2) {
                const dist = getDistance(e.touches);
                const center = getCenter(e.touches);

                if (lastTouchDistance > 0) {
                    const zoomFactor = dist / lastTouchDistance;
                    const newScale = scale * zoomFactor;
                    
                    // Limit zoom
                    if (newScale >= 0.1 && newScale <= 10) {
                        // Calculate new translation to keep the center stationary
                        // Formula: newPos = center - (center - oldPos) * factor
                        pointX = center.x - (center.x - pointX) * zoomFactor;
                        pointY = center.y - (center.y - pointY) * zoomFactor;
                        scale = newScale;
                        setTransform();
                    }
                }
                lastTouchDistance = dist;
                lastTouchCenter = center;
            }
        };

        function startPanning(x, y) {
            startX = x - pointX;
            startY = y - pointY;
            panning = true;
        }

        function pan(x, y) {
            pointX = x - startX;
            pointY = y - startY;
            setTransform();
        }
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
