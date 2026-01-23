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
    
    init: function(startNodeId) {
        console.log('Path Mode Initializing...');
        this.setupCanvas();
        this.setupWorker();
        this.setupUI();
        
        // Load data (assuming data.js is loaded or available)
        // In standalone mode, we might need to fetch it.
        // For integrated mode, window.graphData might be available.
        // Check local variable 'graphData' first (if declared via const in data.js)
        if (typeof graphData !== 'undefined') {
            this.startProcessing(startNodeId);
        } else if (typeof window.graphData !== 'undefined') {
             this.startProcessing(startNodeId);
        } else {
             // Try to fetch if not present (standalone dev)
             fetch('/data.js').then(() => {
                 // data.js usually assigns to global variable
                 // This is a placeholder for data loading logic
                 console.warn('Data loading logic needed for standalone mode');
             });
        }
    },

    setupCanvas: function() {
        this.canvas = document.getElementById('path-canvas');
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        
        // Resize handler
        window.addEventListener('resize', () => {
            this.width = window.innerWidth;
            this.height = window.innerHeight;
            this.canvas.width = this.width;
            this.canvas.height = this.height;
            this.render();
        });

        // Zoom/Pan
        const zoom = d3.zoom()
            .scaleExtent([0.1, 5])
            .on('zoom', (e) => {
                this.transform = e.transform;
                this.render();
            });
        
        d3.select(this.canvas).call(zoom);
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
                    this.nodes = payload.nodes;
                    this.links = payload.links; // or implicit
                    this.render(); // Request animation frame?
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
             
             // Optional: Force a resize event to layout engines if needed
             window.dispatchEvent(new Event('resize'));
        });

        document.getElementById('learning-mode').addEventListener('change', () => this.triggerUpdate());
        document.getElementById('strategy').addEventListener('change', () => this.triggerUpdate());
        document.getElementById('layout-style').addEventListener('change', () => this.triggerUpdate());
    },

    triggerUpdate: function() {
        const mode = document.getElementById('learning-mode').value;
        const strategy = document.getElementById('strategy').value;
        const layout = document.getElementById('layout-style').value;
        
        this.worker.postMessage({
            type: 'computePath',
            payload: {
                mode,
                strategy,
                layout,
                // If diffusion, we need target. How to select?
                // For now, assume global selected node or root
                targetId: this.currentTargetId
            }
        });
    },

    startProcessing: function(targetId) {
        this.currentTargetId = targetId;
        // Send full graph data to worker once
        // We strip content to save memory, matching main app optimization
        const sourceData = (typeof graphData !== 'undefined') ? graphData : window.graphData;
        
        const nodes = sourceData.nodes.map(n => ({
            id: n.id,
            label: n.label,
            inDegree: n.inDegree,
            outDegree: n.outDegree,
            centrality: n.centrality
        }));
        const links = sourceData.edges;

        this.worker.postMessage({
            type: 'initData',
            payload: { nodes, links }
        });

        // Trigger initial path
        this.triggerUpdate();
    },

    handlePathResult: function(result) {
        this.nodes = result.nodes;
        this.links = result.edges;
        document.getElementById('path-count').innerText = this.nodes.length;
        this.render();
        this.centerView(); // Auto-fit graph to screen
    },

    render: function() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const t = this.transform;

        ctx.save();
        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(0, 0, this.width, this.height);
        
        ctx.translate(t.x, t.y);
        ctx.scale(t.k, t.k);

        // Draw Links
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        this.links.forEach(link => {
            // Need source/target coordinates. 
            // result.links often has IDs. we need to map to objects or lookup positions
            // The worker should return resolved coordinates or we look them up.
            // Assuming worker returns resolved links for rendering
            const source = this.nodes.find(n => n.id === link.source);
            const target = this.nodes.find(n => n.id === link.target);
            if (source && target) {
                if (document.getElementById('layout-style').value === 'vertical') {
                    // Curved lines for tree
                   this.drawCurve(ctx, source, target);
                } else {
                   ctx.moveTo(source.x, source.y);
                   ctx.lineTo(target.x, target.y);
                }
            }
        });
        ctx.stroke();

        // Draw Nodes
        this.nodes.forEach(node => {
            ctx.beginPath();
            ctx.fillStyle = node.isCompleted ? '#4caf50' : '#4a9eff';
            ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI);
            ctx.fill();

            // Text
            if (t.k > 0.5) {
                ctx.fillStyle = '#ccc';
                ctx.font = '4px sans-serif';
                ctx.fillText(node.label, node.x + 8, node.y + 2);
            }
        });

        ctx.restore();
    },
    
    drawCurve: function(ctx, source, target) {
        // Simple Bezier for tree
        ctx.moveTo(source.x, source.y);
        ctx.bezierCurveTo(source.x, (source.y + target.y)/2, target.x, (source.y + target.y)/2, target.x, target.y);
    },

    centerView: function() {
        if (this.nodes.length === 0) return;

        // Calculate Bounding Box
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        this.nodes.forEach(n => {
            if (n.x < minX) minX = n.x;
            if (n.x > maxX) maxX = n.x;
            if (n.y < minY) minY = n.y;
            if (n.y > maxY) maxY = n.y;
        });

        // Add padding
        const padding = 50;
        const width = maxX - minX + padding * 2;
        const height = maxY - minY + padding * 2;
        
        // Calculate scale to fit
        const scaleX = this.width / width;
        const scaleY = this.height / height;
        const scale = Math.min(scaleX, scaleY, 1); // Cap at 1.0 zoom if graph is small

        // Center point of graph
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;

        // Calculate translate to move center of graph to center of canvas
        const tx = this.width / 2 - cx * scale;
        const ty = this.height / 2 - cy * scale;

        // Apply D3 Zoom
        const zoom = d3.zoomIdentity.translate(tx, ty).scale(scale);
        d3.select(this.canvas).transition().duration(750).call(d3.zoom().transform, zoom);
        
        // Update local transform state
        this.transform = { k: scale, x: tx, y: ty };
    }
};
