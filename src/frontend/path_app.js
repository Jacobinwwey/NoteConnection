/**
 * Path Mode Application Controller
 * Handles interaction, rendering, and worker communication.
 */

window.pathApp = {
    canvas: null,
    ctx: null,
    worker: null,
    transform: { k: 1, x: 0, y: 0 },
    nodes: [],
    links: [],
    width: 0,
    height: 0,
    
    // State
    centralNodeId: null,
    learningHistory: [],
    completedNodes: new Set(),
    currentTargetId: null,
    
    // Animation State
    animationId: null,
    orbitalAngle: 0,
    
    init: function(startNodeId) {
        console.log('Path Mode Initializing...');
        this.setupCanvas();
        this.setupWorker();
        this.setupWebSocket(); // Connect to Bridge
        this.setupUI();
        
        // Initialize Reader if available and not already set
        if (typeof Reader !== 'undefined' && !window.reader) {
            window.reader = new Reader();
            console.log('Reader initialized');
        } else if (window.reader) {
             console.log('Reader already active');
        }

        this.loadHistory(); // Load from localStorage
        
        // Listen for IPC from PathBridge (Godot openReader)
        if (window.electronAPI && window.electronAPI.on) {
            window.electronAPI.on('path-open-reader', (data) => {
                console.log('[PathApp] Received path-open-reader IPC:', data);
                const nodeId = data.nodeId || data;
                if (nodeId && window.reader) {
                    // Always try to find full node data from source (graphData) first to ensure metadata exists
                    const sourceData = (typeof graphData !== 'undefined') ? graphData : window.graphData;
                    let fullNode = null;
                    
                    if (sourceData && sourceData.nodes) {
                        fullNode = sourceData.nodes.find(n => n.id === nodeId);
                    }
                    
                    // Fallback to local nodes if not found (unlikely but safe)
                    if (!fullNode) {
                        fullNode = this.nodes.find(n => n.id === nodeId);
                    }

                    if (fullNode) {
                        window.reader.open(fullNode);
                    } else {
                        // Fallback: try to open by ID
                        window.reader.open(nodeId);
                    }
                }
            });
            console.log('[PathApp] Registered path-open-reader IPC listener');
        }
        
        // Start Loop
        this.animate();
        
        // Load data logic
        if (typeof graphData !== 'undefined') {
            this.startProcessing(startNodeId);
        } else if (typeof window.graphData !== 'undefined') {
             this.startProcessing(startNodeId);
        } else {
             console.warn('Data loading logic needed for standalone mode');
        }
    },

    setupWebSocket: function() {
        this.ws = new WebSocket('ws://localhost:9876');
        this.ws.onopen = () => console.log('[PathApp] Connected to Bridge');
        this.ws.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data);
                console.log('[PathApp] WS Received:', msg.type);
                
                if (msg.type === 'nodeClick') {
                    console.log('[PathApp] Remote node click:', msg.payload?.nodeId);
                    this.switchCentral(msg.payload?.nodeId || msg.payload);
                } else if (msg.type === 'switchCenter') {
                    console.log('[PathApp] Remote switch center:', msg.payload?.newCenterId);
                    this.switchCentral(msg.payload?.newCenterId);
                } else if (msg.type === 'requestPath') {
                     console.log('[PathApp] Remote requested path data');
                     // Trigger update to resend current path
                     if (this.nodes.length > 0) {
                         // Re-package current state and send
                         const result = {
                             nodes: this.nodes,
                             edges: this.links
                         };
                         this.sendPathToBridge(result);
                     } else {
                         this.triggerUpdate(); // Will eventually send result
                     }
                }
            } catch(err) {
                console.error('WS Error', err);
            }
        };
    },

    sendPathToBridge: function(result) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
             // Convert to simplified format expected by Godot
             const centralId = this.centralNodeId;
             const centralNode = result.nodes.find(n => n.id === centralId);
             
             if (!centralNode) return;

             // --- Peripheral Selection Logic (Max 4) ---
             // Requirement: 1 Central + 1-4 Peripherals
             // Strategy: Prerequisites (Incoming) First, then Associations (Outgoing/Undirected)
             
             const candidates = result.nodes.filter(n => n.id !== centralId);
             const edges = result.edges || [];
             
             const peripherals = candidates.map(node => {
                 // Determine relationship
                 const isIncoming = edges.some(e => e.source === node.id && e.target === centralId);
                 const isOutgoing = edges.some(e => e.source === centralId && e.target === node.id);
                 
                 // Score for sorting:
                 // Incoming (Prereq) = Priority 2
                 // Outgoing (Association) = Priority 1
                 // Tie-breaker: Centrality or Degree (use inDegree + outDegree)
                 let priority = 0;
                 if (isIncoming) priority = 2;
                 else if (isOutgoing) priority = 1;
                 
                 return {
                     ...node,
                     priority: priority,
                     totalDegree: (node.inDegree || 0) + (node.outDegree || 0)
                 };
             });

             // Sort: High Priority > High Degree
             peripherals.sort((a, b) => {
                 if (b.priority !== a.priority) return b.priority - a.priority;
                 return b.totalDegree - a.totalDegree;
             });

             // Take top 4
             const selectedPeripherals = peripherals.slice(0, 4).map(n => ({
                 id: n.id,
                 label: n.label,
                 relation: n.priority === 2 ? 'prerequisite' : 'association'
             }));

             const payload = {
                 central: {
                     id: centralNode.id,
                     label: centralNode.label,
                     inDegree: centralNode.inDegree || 0,
                     outDegree: centralNode.outDegree || 0
                 },
                 peripherals: selectedPeripherals,
                 progress: {
                     completed: this.completedNodes.size,
                     total: this.nodes.length + this.completedNodes.size // Rough estimate
                 },
                 mode: 'orbital'
             };

             this.ws.send(JSON.stringify({
                 type: 'pathResult',
                 payload: payload
             }));
             console.log('[PathApp] Sent pathResult to Bridge (Filtered to 4 peripherals)');
        }
    },

    setupCanvas: function() {
        this.canvas = document.getElementById('path-canvas');
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        
        window.addEventListener('resize', () => {
            this.width = window.innerWidth;
            this.height = window.innerHeight;
            this.canvas.width = this.width;
            this.canvas.height = this.height;
            this.render();
        });

        const zoom = d3.zoom()
            .scaleExtent([0.1, 5])
            .on('zoom', (e) => {
                this.transform = e.transform;
                // Render handled by loop
            })
            .filter(event => !event.type.includes('dblclick'));
        
        d3.select(this.canvas).call(zoom).on("dblclick.zoom", null);
        this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
    },

    setupWorker: function() {
        this.worker = new Worker('path_worker.js');
        this.worker.onmessage = (e) => {
            const { type, payload } = e.data;
            switch(type) {
                case 'pathResult':
                    this.handlePathResult(payload);
                    break;
                case 'layoutTick':
                    break;
                case 'log':
                    console.log('[PathWorker]', payload);
                    break;
            }
        };
    },

    setupUI: function() {
        document.getElementById('btn-exit-path').addEventListener('click', () => {
             document.getElementById('path-container').style.display = 'none';
             document.getElementById('graph-wrapper').style.display = 'block';
             window.dispatchEvent(new Event('resize'));
        });

        document.getElementById('learning-mode').addEventListener('change', (e) => {
            const mode = e.target.value;
            if (mode === 'diffusion') {
                this.showNodeSelector();
            } else {
                this.currentTargetId = null; // Clear target for Domain Mode
                this.updateTargetDisplay();
                this.triggerUpdate();
            }
        });
        document.getElementById('strategy').addEventListener('change', () => this.triggerUpdate());
        document.getElementById('layout-style').addEventListener('change', () => this.triggerUpdate());

        document.getElementById('btn-mark-complete').addEventListener('click', () => this.markComplete());
        
        document.getElementById('btn-toggle-history').addEventListener('click', () => {
            const sidebar = document.getElementById('learning-history-sidebar');
            sidebar.style.zIndex = '3000'; // Correct Z-Index
            if (sidebar.style.display === 'none' || sidebar.style.display === '') {
                sidebar.style.display = 'flex';
                // Trigger reflow
                sidebar.offsetHeight; 
                setTimeout(() => sidebar.style.transform = 'translateX(0)', 10);
            } else {
                sidebar.style.transform = 'translateX(100%)';
                setTimeout(() => sidebar.style.display = 'none', 300);
            }
        });

        document.getElementById('btn-close-history').addEventListener('click', () => {
            const sidebar = document.getElementById('learning-history-sidebar');
            sidebar.style.transform = 'translateX(100%)';
            setTimeout(() => sidebar.style.display = 'none', 300);
        });

        // Add Target Display UI if missing
        if (!document.getElementById('target-display')) {
            const toolbar = document.getElementById('path-toolbar');
            const targetDiv = document.createElement('div');
            targetDiv.id = 'target-display';
            targetDiv.className = 'toolbar-group';
            targetDiv.style.display = 'none';
            targetDiv.innerHTML = `
                <span id="target-label" style="font-size: 0.8rem; color: #aaa; margin-right: 5px;"></span>
                <button id="btn-change-target" class="btn-small">Change</button>
            `;
            // Insert after strategy
            toolbar.insertBefore(targetDiv, document.getElementById('learning-mode').parentNode.nextSibling);
            
            document.getElementById('btn-change-target').addEventListener('click', () => {
                this.showNodeSelector();
            });
        }

        document.getElementById('node-select-input').addEventListener('input', (e) => this.filterNodeList(e.target.value));
        document.getElementById('btn-close-node-select').addEventListener('click', () => {
            document.getElementById('node-select-modal').style.display = 'none';
            // Revert if no target selected?
            if (!this.currentTargetId && document.getElementById('learning-mode').value === 'diffusion') {
                 // Keep as is or switch back?
            }
        });
    },

    updateTargetDisplay: function() {
        const div = document.getElementById('target-display');
        const mode = document.getElementById('learning-mode').value;
        
        if (mode === 'diffusion' && this.currentTargetId) {
            const sourceData = (typeof graphData !== 'undefined') ? graphData : window.graphData;
            const node = sourceData.nodes.find(n => n.id === this.currentTargetId);
            const label = node ? node.label : this.currentTargetId;
            
            document.getElementById('target-label').innerText = `Target: ${label}`;
            div.style.display = 'flex';
            div.style.alignItems = 'center';
        } else {
            div.style.display = 'none';
        }
    },

    loadHistory: function() {
        const retain = document.getElementById('set-retain-history')?.checked ?? true;
        if (!retain) return;
        const stored = localStorage.getItem('nc_path_history');
        if (stored) {
            try {
                this.learningHistory = JSON.parse(stored);
                // Validate IDs
                const validHistory = [];
                this.learningHistory.forEach(n => {
                    if (n && n.id) {
                        this.completedNodes.add(n.id);
                        validHistory.push(n);
                    }
                });
                this.learningHistory = validHistory;
                this.updateHistorySidebar();
            } catch(e) { console.error(e); }
        }
    },
    saveHistory: function() {
        if (document.getElementById('set-retain-history')?.checked ?? true) {
            localStorage.setItem('nc_path_history', JSON.stringify(this.learningHistory));
        }
    },

    triggerUpdate: function() {
        const mode = document.getElementById('learning-mode').value;
        const strategy = document.getElementById('strategy').value;
        const layout = document.getElementById('layout-style').value;
        
        // Preserve central focus if we already have one
        if (layout === 'orbital' && !this.centralNodeId && this.nodes.length > 0) {
             const next = this.nodes.find(n => !this.completedNodes.has(n.id));
             this.centralNodeId = next ? next.id : this.nodes[0].id;
        }

        this.worker.postMessage({
            type: 'computePath',
            payload: { mode, strategy, layout, targetId: this.currentTargetId }
        });
        
        this.updateTargetDisplay();
    },

    startProcessing: function(targetId) {
        this.currentTargetId = targetId;
        const sourceData = (typeof graphData !== 'undefined') ? graphData : window.graphData;
        const nodes = sourceData.nodes.map(n => ({
            id: n.id, label: n.label, inDegree: n.inDegree, outDegree: n.outDegree, centrality: n.centrality
        }));
        // D3 mutates links to objects, we need IDs for the worker
        const links = sourceData.edges.map(l => ({
            source: typeof l.source === 'object' ? l.source.id : l.source,
            target: typeof l.target === 'object' ? l.target.id : l.target,
            type: l.type,
            weight: l.weight
        }));

        this.worker.postMessage({ type: 'initData', payload: { nodes, links } });
        this.triggerUpdate();
    },

    handlePathResult: function(result) {
        this.nodes = result.nodes;
        this.links = result.edges;
        
        document.getElementById('path-count').innerText = this.nodes.length;
        
        // Auto-set central if needed
        if (this.nodes.length > 0) {
            const exists = this.nodes.find(n => n.id === this.centralNodeId);
            if (!this.centralNodeId || !exists) {
                const cand = this.nodes.find(n => !this.completedNodes.has(n.id)) || this.nodes[0];
                this.centralNodeId = cand.id;
            }
        }

        this.nodes.forEach(n => {
            if (this.completedNodes.has(n.id)) n.isCompleted = true;
            // Initialize orbital params if needed - randomized for "Cloud" effect
            if (!n.orbitalSpeed) n.orbitalSpeed = (Math.random() - 0.5) * 0.0015; // Slow down slightly
            if (!n.orbitalPhase) n.orbitalPhase = Math.random() * Math.PI * 2;
            // Increased dispersion: 0 - 600 offset
            if (!n.orbitalRadiusOffset || n.orbitalRadiusOffset < 100) n.orbitalRadiusOffset = Math.random() * 600; 
        });

        if (document.getElementById('layout-style').value === 'orbital') {
            this.runLocalCloudLayout();
        }

        this.centerView();
        
        // Sync with Godot
        this.sendPathToBridge(result);
    },

    // --- Animation & Rendering ---

    animate: function() {
        const layout = document.getElementById('layout-style').value;
        if (layout === 'orbital') {
            this.updateOrbitalPositions();
            this.render(); 
        }
        this.animationId = requestAnimationFrame(() => this.animate());
    },

    updateOrbitalPositions: function() {
        if (!this.centralNodeId) return;
        
        // Cloud Logic: Each node has unique speed/radius
        this.nodes.forEach(node => {
            if (node.id !== this.centralNodeId) {
                // Init logical radius if missing
                if (node.radius === undefined) {
                    node.radius = 200 + (node.orbitalRadiusOffset || 50); 
                    node.baseAngle = node.orbitalPhase || 0;
                }
                
                // Update angle
                node.baseAngle += (node.orbitalSpeed || 0.001);
                
                // Update position
                node.x = node.radius * Math.cos(node.baseAngle);
                node.y = node.radius * Math.sin(node.baseAngle);
            } else {
                node.x = 0;
                node.y = 0;
            }
        });
    },

    render: function() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const t = this.transform;
        const layout = document.getElementById('layout-style').value;

        ctx.save();
        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(0, 0, this.width, this.height);
        
        ctx.translate(t.x, t.y);
        ctx.scale(t.k, t.k);

        // --- Edges with Depth of Field ---
        this.links.forEach(link => {
            const source = this.nodes.find(n => n.id === link.source);
            const target = this.nodes.find(n => n.id === link.target);
            if (source && target) {
                let alpha = 0.3;
                if (layout === 'orbital') {
                    // Only show edges connected to central clearly, others content hidden
                    const isCentralConn = source.id === this.centralNodeId || target.id === this.centralNodeId;
                    alpha = isCentralConn ? 0.6 : 0.0; 
                }
                ctx.strokeStyle = `rgba(100, 100, 100, ${alpha})`;
                ctx.lineWidth = layout === 'orbital' ? 0.5 : 1;
                
                // Skip rendering very faint edges for perf
                if (alpha > 0.01) {
                    ctx.beginPath();
                    if (layout === 'vertical' && layout !== 'orbital') {
                       this.drawCurve(ctx, source, target);
                    } else {
                       ctx.moveTo(source.x, source.y);
                       ctx.lineTo(target.x, target.y);
                    }
                    ctx.stroke();
                }
            }
        });

        // --- Nodes ---
        const sortedNodes = [...this.nodes];
        if (layout === 'orbital' && this.centralNodeId) {
            sortedNodes.sort((a, b) => (a.id === this.centralNodeId ? 1 : -1));
        }

        sortedNodes.forEach(node => {
            let radius = 5;
            let fill = '#4a9eff';
            let alpha = 1.0;
            let labelSize = 4;

            if (node.isCompleted) {
                fill = '#ffd700'; 
                radius = 4;
            }

            if (layout === 'orbital') {
                if (node.id === this.centralNodeId) {
                    radius = 60; 
                    fill = node.isCompleted ? '#ffd700' : '#00d2ff';
                    ctx.shadowBlur = 30;
                    ctx.shadowColor = fill;
                    labelSize = 14;
                } else {
                    // Depth of Field: Opacity based on Z/Radius or just distance
                    // Since it's 2D cloud, we use simple distance from center to simulate DoF focus?
                    // Actually user wants "reduce rendering load for most low-relevance nodes"
                    // We can use the 'orbitalRadiusOffset' to simulate Z-depth.
                    // Let's assume larger radius = further away = lower opacity.
                    
                    const dist = node.radius || Math.hypot(node.x, node.y);
                    // Updated DoF for wider dispersion (up to 1000px radius)
                    // High opacity for close nodes, gradual falloff for far nodes
                    const zFactor = Math.max(0.4, 1 - (dist / 1200)); 
                    
                    radius = Math.max(3, 25 * zFactor);
                    alpha = zFactor; // Base alpha directly related to zFactor (0.4 - 1.0)
                    
                    fill = node.isCompleted ? '#b8860b' : '#2c5282';
                    ctx.shadowBlur = 0;
                    labelSize = radius / 2; 
                }
            }

            // Draw
            if (alpha > 0.05) { // Optimization
                ctx.beginPath();
                ctx.globalAlpha = alpha;
                ctx.fillStyle = fill;
                ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
                ctx.fill();
                
                // Labels
                let showLabel = false;
                if (layout === 'orbital') {
                     showLabel = true; // Always show in orbital (user request)
                } else {
                     showLabel = node.id === this.centralNodeId || (alpha > 0.6 && t.k > 0.8);
                }

                if (showLabel) {
                    ctx.globalAlpha = alpha > 0.5 ? 1.0 : alpha + 0.2; // Slightly boost label alpha
                    ctx.fillStyle = '#fff';
                    
                    if (layout === 'orbital') {
                        // Scaled labels with limit
                        // Cap font size to match node dimensions (radius is approx 20-30 for peripherals)
                        // Use 0.5 * radius for text height approx, capped at 16px (standard reading size).
                        const calculatedSize = node.id === this.centralNodeId ? 20 : (radius * 0.5);
                        const fontSize = Math.min(16, Math.max(8, calculatedSize)); 
                        
                        ctx.font = `${fontSize}px sans-serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        let label = node.label;
                        // Truncate only very long labels
                        if (node.id !== this.centralNodeId && label.length > 15) label = label.substring(0, 12) + '..';
                        
                        // Drop shadow for readability
                        ctx.shadowColor = 'rgba(0,0,0,0.8)';
                        ctx.shadowBlur = 4;
                        ctx.fillText(label, node.x, node.y + (node.id === this.centralNodeId ? 0 : radius + 8));
                        ctx.shadowBlur = 0;
                    } else {
                        if (layout !== 'orbital' && t.k > 0.5) {
                            ctx.font = '4px sans-serif';
                            ctx.textAlign = 'left';
                            ctx.fillText(node.label, node.x + 8, node.y + 2);
                        }
                    }
                }
            }
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1.0;
        });

        ctx.restore();
    },
    
    drawCurve: function(ctx, source, target) {
        ctx.moveTo(source.x, source.y);
        ctx.bezierCurveTo(source.x, (source.y + target.y)/2, target.x, (source.y + target.y)/2, target.x, target.y);
    },

    // --- Interactions ---

    handleDoubleClick: function(e) {
        const { x, y } = this.getCanvasCoordinates(e.clientX, e.clientY);
        const layout = document.getElementById('layout-style').value;
        const node = this.findNodeAt(x, y);

        if (node) {
            console.log("Double Clicked:", node.label, node.id);
            if (layout === 'orbital') {
                if (node.id === this.centralNodeId) {
                    // Central Node -> Open Content
                    if (typeof window.reader !== 'undefined' && window.reader.open) {
                        try {
                            // Fetch full node data from global source if available to get content/metadata
                            let fullNode = node;
                            if (typeof window.graphData !== 'undefined' && window.graphData.nodes) {
                                const found = window.graphData.nodes.find(n => n.id === node.id);
                                if (found) fullNode = found;
                            } else if (typeof graphData !== 'undefined' && graphData.nodes) {
                                const found = graphData.nodes.find(n => n.id === node.id);
                                if (found) fullNode = found;
                            }
                            
                            window.reader.open(fullNode);
                        } catch(err) { console.error("Reader Error", err); }
                    } else {
                        console.error("Reader module missing or invalid.", window.reader);
                    }
                } else {
                    // Peripheral -> Switch Focus
                    this.switchCentral(node.id);
                }
            } else {
                if (window.reader) window.reader.open(node.id);
            }
        }
    },

    removeHistoryItem: function(itemId, event) {
        if (event) event.stopPropagation(); // Prevent opening reader
        
        this.learningHistory = this.learningHistory.filter(n => n.id !== itemId);
        this.completedNodes.delete(itemId);
        this.saveHistory();
        this.updateHistorySidebar();
        
        // Update visual state of the node if visible
        const liveNode = this.nodes.find(n => n.id === itemId);
        if (liveNode) liveNode.isCompleted = false;
        this.render();
    },

    markComplete: function() {
        if (!this.centralNodeId) return;
        const node = this.nodes.find(n => n.id === this.centralNodeId);
        if (node && !node.isCompleted) {
            node.isCompleted = true;
            this.completedNodes.add(node.id);
            // Avoid duplicates
            if (!this.learningHistory.some(h => h.id === node.id)) {
                this.learningHistory.push(node);
            }
            this.saveHistory();
            this.updateHistorySidebar();
            
            const next = this.nodes.find(n => !this.completedNodes.has(n.id) && n.id !== node.id);
            if (next) setTimeout(() => this.switchCentral(next.id), 500);
            
            this.render(); 
        }
    },

    switchCentral: function(id) {
        this.centralNodeId = id;
        this.runLocalCloudLayout(); 
        this.render();
        this.centerView();
    },

    runLocalCloudLayout: function() {
        if (document.getElementById('layout-style').value !== 'orbital') return;
        
        const center = this.nodes.find(n => n.id === this.centralNodeId);
        if (!center) return;

        center.x = 0; center.y = 0; center.radius = 0;
        
        const others = this.nodes.filter(n => n.id !== this.centralNodeId);
        
        // Cloud Distribution: 
        // Iterate and assign random stable radii (350-950 range for max dispersion)
        others.forEach((node, i) => {
            const angle = (i / others.length) * 2 * Math.PI;
            // Use existing offsets or init new randoms (Wide spread)
            if (!node.orbitalRadiusOffset || node.orbitalRadiusOffset < 100) node.orbitalRadiusOffset = Math.random() * 600; 
            
            node.radius = 350 + node.orbitalRadiusOffset; // Base 350 (was 200)
            node.baseAngle = angle;
            node.orbitalPhase = node.orbitalPhase || Math.random() * 10;
            
            node.x = node.radius * Math.cos(angle);
            node.y = node.radius * Math.sin(angle);
        });
    },

    getCanvasCoordinates: function(clientX, clientY) {
        const t = this.transform;
        return {
            x: (clientX - t.x) / t.k,
            y: (clientY - t.y) / t.k
        };
    },

    findNodeAt: function(x, y) {
        const layout = document.getElementById('layout-style').value;
        if (layout === 'orbital' && this.centralNodeId) {
            const center = this.nodes.find(n => n.id === this.centralNodeId);
            const dist = Math.hypot(center.x - x, center.y - y);
            if (dist < 65) return center;
        }

        return this.nodes.find(node => {
            const dist = Math.hypot(node.x - x, node.y - y);
            // Dynamic hit test based on visual size (approx)
            // If node is faded (further away), make it harder to hit? 
            // Or keep it standard. Standard is safer for usability.
            return dist < 20; 
        });
    },

    centerView: function() {
        // ... (standard zooming)
        if (this.nodes.length === 0) return;
        let minX = -400, maxX = 400, minY = -400, maxY = 400; // Cloud approximate bounds
        
        const padding = 50;
        const width = maxX - minX + padding * 2;
        const height = maxY - minY + padding * 2;
        const scale = Math.min(this.width / width, this.height / height, 1);
        const tx = this.width / 2;
        const ty = this.height / 2;

        const zoom = d3.zoomIdentity.translate(tx, ty).scale(scale);
        d3.select(this.canvas).transition().duration(750).call(d3.zoom().transform, zoom);
        this.transform = { k: scale, x: tx, y: ty };
    },

    showNodeSelector: function() {
        const modal = document.getElementById('node-select-modal');
        modal.style.display = 'flex';
        document.getElementById('node-select-input').value = '';
        this.filterNodeList('');
    },

    filterNodeList: function(query) {
        const list = document.getElementById('node-select-list');
        list.innerHTML = '';
        const sourceData = (typeof graphData !== 'undefined') ? graphData : window.graphData;
        if (!sourceData) return;

        const matches = sourceData.nodes
            .filter(n => n.label.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 300); // Increased limit from 20 to 300 for better discoverability

        matches.forEach(node => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${node.label}</span>`;
            li.onclick = () => {
                this.currentTargetId = node.id;
                document.getElementById('node-select-modal').style.display = 'none';
                this.triggerUpdate();
            };
            list.appendChild(li);
        });
    },

    updateHistorySidebar: function() {
        const list = document.getElementById('history-list');
        list.innerHTML = '';
        this.learningHistory.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';
            
            const labelSpan = document.createElement('span');
            labelSpan.innerText = item.label;
            labelSpan.style.cursor = 'pointer';
            labelSpan.onclick = () => { if (window.reader) window.reader.open(item.id); };
            
            const removeBtn = document.createElement('span');
            removeBtn.innerHTML = '&times;';
            removeBtn.style.color = '#ff6b6b';
            removeBtn.style.cursor = 'pointer';
            removeBtn.style.padding = '0 5px';
            removeBtn.onclick = (e) => this.removeHistoryItem(item.id, e);
            
            div.appendChild(labelSpan);
            div.appendChild(removeBtn);
            list.appendChild(div);
        });
    }
};
