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
    collapsedNodes: new Set(), 
    forcedExpansionNodes: new Set(), // New: nodes with forced expansion of prereqs
    expansionOrder: [],
    stickyClaimEnabled: true,
    currentTargetId: null,
    lastTreeLayout: null, // Store tree layout for requestPath
    uiInitialized: false,
    runtimeConfig: {
        mode: 'domain',
        strategy: 'foundational',
        layout: 'orbital', // Track(Focus) default in Tauri flow
        targetId: null,
        autoReconstruct: true,
        retainHistory: true
    },
    
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
        this._loadCompletedNodes();
        this._loadCollapsedNodes(); // New
        

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
        const hasActiveSocket = this.ws && (
            this.ws.readyState === WebSocket.OPEN ||
            this.ws.readyState === WebSocket.CONNECTING
        );

        if (!hasActiveSocket) {
            this.ws = new WebSocket(this._getBridgeWsUrl('frontend'));
        }

        this.ws.onopen = () => console.log('[PathApp] Connected to Bridge');
        this.ws.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data);
                console.log('[PathApp] WS Received:', msg.type);
                
                if (msg.type === 'nodeClick') {
                    console.log('[PathApp] Remote node click:', msg.payload?.nodeId);
                    this.switchCentral(msg.payload?.nodeId || msg.payload);
                } else if (msg.type === 'openReader') {
                    const data = msg.payload || msg;
                    console.log('[PathApp] Remote open reader:', data);
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
                } else if (msg.type === 'switchCenter') {
                    console.log('[PathApp] Remote switch center:', msg.payload?.newCenterId);
                    this.switchCentral(msg.payload?.newCenterId);
                } else if (msg.type === 'toggleCollapse') { // New
                    console.log('[PathApp] Remote toggle collapse:', msg.payload?.nodeId);
                    this.toggleNodeCollapse(msg.payload?.nodeId);
                } else if (msg.type === 'expandPrereqs') { // New
                     console.log('[PathApp] Remote expand prereqs:', msg.payload?.nodeId);
                     this.expandPrereqs(msg.payload?.nodeId);
                } else if (msg.type === 'collapsePrereqs') { // New
                     console.log('[PathApp] Remote collapse prereqs:', msg.payload?.nodeId);
                     this.collapsePrereqs(msg.payload?.nodeId);
                } else if (msg.type === 'collapseAll') { // New
                     console.log('[PathApp] Remote collapse ALL');
                     this.collapseAll();
                } else if (msg.type === 'requestPath') {
                     // always trigger fresh update to ensure treeLayout is computed via Worker
                     console.log('[PathApp] Remote requested path data. Triggering fresh update.');
                     this.triggerUpdate();
                } else if (msg.type === 'configure') {
                    console.log('[PathApp] Remote configure:', msg.payload);
                    this.applyRemoteConfigure(msg.payload || {});
                } else if (msg.type === 'exitPathMode') {
                    console.log('[PathApp] Remote exit Path Mode');
                    this.exitPathMode();
                } else if (msg.type === 'completionSync') {
                    // ... existing code ...
                    // Bidirectional sync from Godot
                    console.log('[PathApp] Completion sync from Godot:', msg.payload);
                    const completedIds = msg.payload?.completedIds || [];
                    this.completedNodes = new Set(completedIds);
                    // Persist to localStorage
                    this._saveCompletedNodes();
                    console.log('[PathApp] Synced', completedIds.length, 'completed nodes from Godot');
                } else if (msg.type === 'markComplete') {
                    // ... existing code ...
                    // Single node marked complete from Godot
                    const nodeId = msg.payload?.nodeId;
                    if (nodeId) {
                        this.completedNodes.add(nodeId);
                        this._saveCompletedNodes();
                        
                        // Also add to learningHistory for sidebar display
                        const sourceData = (typeof graphData !== 'undefined') ? graphData : window.graphData;
                        const node = sourceData?.nodes?.find(n => n.id === nodeId);
                        const label = node?.label || nodeId;
                        
                        // Avoid duplicates
                        if (!this.learningHistory.some(h => h.id === nodeId)) {
                            this.learningHistory.push({ id: nodeId, label: label });
                            this.saveHistory();
                            this.updateHistorySidebar();
                        }
                        
                        console.log('[PathApp] Marked complete from Godot:', nodeId);
                        
                        // Auto-Reconstruct Path if setting enabled (default true)
                        // This triggers path Recalculation based on new completion status
                        const autoReconstruct = this.runtimeConfig.autoReconstruct !== false;
                        if (autoReconstruct && this.currentTargetId) {
                            console.log('[PathApp] Auto-reconstructing path because', nodeId, 'was completed');
                            this.triggerUpdate();
                        }
                    }
                } else if (msg.type === 'unmarkComplete') {
                    // ... existing code ...
                    // Node unmarked from Godot
                    const nodeId = msg.payload?.nodeId;
                    if (nodeId) {
                        this.completedNodes.delete(nodeId);
                        this._saveCompletedNodes();
                        
                        // Remove from learningHistory
                        const idx = this.learningHistory.findIndex(h => h.id === nodeId);
                        if (idx !== -1) {
                            this.learningHistory.splice(idx, 1);
                            this.saveHistory();
                            this.updateHistorySidebar();
                        }
                        
                        console.log('[PathApp] Unmarked from Godot:', nodeId);
                    }
                }
            } catch(err) {
                console.error('WS Error', err);
            }
        };
        this.ws.onclose = (e) => {
            console.log('[PathApp] Bridge socket closed. code=', e.code, 'reason=', e.reason || '<empty>');
        };
        this.ws.onerror = (err) => {
            console.warn('[PathApp] Bridge socket error:', err);
        };

        if (hasActiveSocket && this.ws.readyState === WebSocket.OPEN) {
            console.log('[PathApp] Reusing existing Bridge socket');
        }
    },

    _getBridgeWsUrl: function(clientTag = 'frontend') {
        return `ws://localhost:9876?client=${encodeURIComponent(clientTag)}`;
    },

    _isTauriMode: function() {
        return typeof window !== 'undefined' && !!window.__TAURI__;
    },

    _getModeValue: function() {
        if (this._isTauriMode()) {
            return this.runtimeConfig.mode || (this.currentTargetId ? 'diffusion' : 'domain');
        }
        return document.getElementById('learning-mode')?.value || 'domain';
    },

    _getStrategyValue: function() {
        if (this._isTauriMode()) {
            return this.runtimeConfig.strategy || 'foundational';
        }
        return document.getElementById('strategy')?.value || 'foundational';
    },

    _getLayoutValue: function() {
        if (this._isTauriMode()) {
            // Layout is backend-defaulted to Track(Focus) in Tauri flow.
            return 'orbital';
        }
        return document.getElementById('layout-style')?.value || 'orbital';
    },

    _getRetainHistoryEnabled: function() {
        if (this._isTauriMode()) {
            return this.runtimeConfig.retainHistory !== false;
        }
        return document.getElementById('set-retain-history')?.checked ?? true;
    },

    _toggleHistorySidebar: function() {
        const sidebar = document.getElementById('learning-history-sidebar');
        if (!sidebar) return;
        sidebar.style.zIndex = '3000';
        if (sidebar.style.display === 'none' || sidebar.style.display === '') {
            sidebar.style.display = 'flex';
            sidebar.offsetHeight;
            setTimeout(() => {
                sidebar.style.transform = 'translateX(0)';
            }, 10);
        } else {
            sidebar.style.transform = 'translateX(100%)';
            setTimeout(() => {
                sidebar.style.display = 'none';
            }, 300);
        }
    },

    exitPathMode: function() {
        const pathContainer = document.getElementById('path-container');
        const graphWrapper = document.getElementById('graph-wrapper');
        const sidebar = document.getElementById('learning-history-sidebar');

        if (pathContainer) pathContainer.style.display = 'none';
        if (graphWrapper) graphWrapper.style.display = 'block';
        if (sidebar) {
            sidebar.style.transform = 'translateX(100%)';
            sidebar.style.display = 'none';
        }
        window.dispatchEvent(new Event('resize'));
    },

    applyRemoteConfigure: function(config) {
        if (!config || typeof config !== 'object') return;

        const incomingTargetId = typeof config.targetId === 'string'
            ? config.targetId
            : (typeof config.target_id === 'string' ? config.target_id : null);

        if (typeof config.mode === 'string') {
            this.runtimeConfig.mode = config.mode === 'diffusion' ? 'diffusion' : 'domain';
        }
        if (typeof config.strategy === 'string') {
            this.runtimeConfig.strategy = config.strategy === 'core' ? 'core' : 'foundational';
        }
        if (incomingTargetId !== null) {
            this.runtimeConfig.targetId = incomingTargetId || null;
            this.currentTargetId = incomingTargetId || null;
        }
        if (typeof config.auto_reconstruct === 'boolean') {
            this.runtimeConfig.autoReconstruct = config.auto_reconstruct;
        }
        if (typeof config.retain_history === 'boolean') {
            this.runtimeConfig.retainHistory = config.retain_history;
        }

        if (this._isTauriMode()) {
            this.runtimeConfig.layout = 'orbital';
        } else if (typeof config.layout === 'string') {
            this.runtimeConfig.layout = config.layout;
        }

        // Keep DOM controls in sync for browser mode compatibility/debugging.
        const modeEl = document.getElementById('learning-mode');
        const strategyEl = document.getElementById('strategy');
        const layoutEl = document.getElementById('layout-style');
        if (modeEl) modeEl.value = this.runtimeConfig.mode;
        if (strategyEl) strategyEl.value = this.runtimeConfig.strategy;
        if (layoutEl) layoutEl.value = this._getLayoutValue();

        // Trigger recompute only when worker is ready.
        if (this.worker) {
            this.triggerUpdate();
        }
    },
    
    // Save completed nodes to localStorage
    _saveCompletedNodes: function() {
        try {
            const ids = Array.from(this.completedNodes);
            localStorage.setItem('pathMode_completedNodes', JSON.stringify(ids));
        } catch (e) {
            console.warn('[PathApp] Failed to save completed nodes:', e);
        }
    },
    
    // Load completed nodes from localStorage
    _loadCompletedNodes: function() {
        try {
            const stored = localStorage.getItem('pathMode_completedNodes');
            if (stored) {
                const ids = JSON.parse(stored);
                this.completedNodes = new Set(ids);
                console.log('[PathApp] Loaded', ids.length, 'completed nodes from storage');
            }
        } catch (e) {
            console.warn('[PathApp] Failed to load completed nodes:', e);
        }
    },

    // New Collapse Logic
    _saveCollapsedNodes: function() {
        try {
            const ids = Array.from(this.collapsedNodes);
            localStorage.setItem('pathMode_collapsedNodes', JSON.stringify(ids));
            localStorage.setItem('pathMode_expansionOrder', JSON.stringify(this.expansionOrder));
        } catch (e) { console.warn('Failed save collapsed', e); }
    },

    _loadCollapsedNodes: function() {
        try {
            const stored = localStorage.getItem('pathMode_collapsedNodes');
            if (stored) {
                const ids = JSON.parse(stored);
                this.collapsedNodes = new Set(ids);
            }
            const storedExp = localStorage.getItem('pathMode_expansionOrder');
            if (storedExp) {
                this.expansionOrder = JSON.parse(storedExp);
            }
        } catch (e) { console.warn('Failed load collapsed', e); }
    },

    toggleNodeCollapse: function(nodeId) {
        if (!nodeId) return;
        if (this.collapsedNodes.has(nodeId)) {
            // Un-collapse (Expand)
            this.collapsedNodes.delete(nodeId);
            if (!this.expansionOrder.includes(nodeId)) {
                this.expansionOrder.push(nodeId);
            }
        } else {
            // Collapse
            this.collapsedNodes.add(nodeId);
            this.expansionOrder = this.expansionOrder.filter(id => id !== nodeId);
        }
        this._saveCollapsedNodes();
        this.triggerUpdate(); // Recalculate layout
    },

    expandPrereqs: function(nodeId) {
        if (!nodeId) return;
        this.collapsedNodes.delete(nodeId);
        if (!this.expansionOrder.includes(nodeId)) {
            this.expansionOrder.push(nodeId);
        }
        if (!this.forcedExpansionNodes.has(nodeId)) {
            this.forcedExpansionNodes.add(nodeId);
        }
        this._saveCollapsedNodes();
        this.triggerUpdate();
    },

    collapsePrereqs: function(nodeId) {
        if (!nodeId) return;
        this.collapsedNodes.add(nodeId);
        this.expansionOrder = this.expansionOrder.filter(id => id !== nodeId);
        if (this.forcedExpansionNodes.has(nodeId)) {
            this.forcedExpansionNodes.delete(nodeId);
        }
        this._saveCollapsedNodes();
        this.triggerUpdate();
    },

    collapseAll: function() {
        this.expansionOrder.forEach(id => this.collapsedNodes.add(id));
        this.expansionOrder = [];
        this.forcedExpansionNodes.clear();
        this._saveCollapsedNodes();
        this.triggerUpdate();
    },

    sendPathToBridge: function(result) {
        console.log('[PathApp] sendPathToBridge called. WS state:', this.ws?.readyState, 'Nodes:', result?.nodes?.length);
        
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('[PathApp] WebSocket not open, cannot send pathResult');
            return;
        }
        
        // Convert to simplified format expected by Godot
        const centralId = this.centralNodeId;
        console.log('[PathApp] Looking for centralId:', centralId);
        
        let centralNode = result.nodes.find(n => n.id === centralId);
        
        // Fallback: If central not in current path nodes, fetch from global graphData
        if (!centralNode) {
            console.warn('[PathApp] Central node not in path nodes, checking graphData...');
            const sourceData = (typeof graphData !== 'undefined') ? graphData : window.graphData;
            if (sourceData && sourceData.nodes) {
                centralNode = sourceData.nodes.find(n => n.id === centralId);
                if (centralNode) {
                    console.log('[PathApp] Found central in graphData:', centralNode.label);
                    // Add to our local nodes for future reference
                    result.nodes.push(centralNode);
                }
            }
        }
        
        if (!centralNode) {
            console.error('[PathApp] Central node not found anywhere! ID:', centralId);
            return;
        }

        // --- Peripheral Selection Logic (Max 4) ---
        const candidates = result.nodes.filter(n => n.id !== centralId);
        const edges = result.edges || [];
        
        const peripherals = candidates.map(node => {
            const isIncoming = edges.some(e => {
                const sourceId = typeof e.source === 'object' ? e.source.id : e.source;
                const targetId = typeof e.target === 'object' ? e.target.id : e.target;
                return sourceId === node.id && targetId === centralId;
            });
            const isOutgoing = edges.some(e => {
                const sourceId = typeof e.source === 'object' ? e.source.id : e.source;
                const targetId = typeof e.target === 'object' ? e.target.id : e.target;
                return sourceId === centralId && targetId === node.id;
            });
            
            let priority = 0;
            if (isIncoming) priority = 2;
            else if (isOutgoing) priority = 1;
            
            return {
                ...node,
                priority: priority,
                totalDegree: (node.inDegree || 0) + (node.outDegree || 0)
            };
        });

        peripherals.sort((a, b) => {
            if (b.priority !== a.priority) return b.priority - a.priority;
            return b.totalDegree - a.totalDegree;
        });

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
                total: result.nodes.length
            },
            // Full path data for tree-view and progress tracking
            totalNodes: result.nodes.length,
            pathNodes: result.nodes.map(n => ({
                id: n.id,
                label: n.label || n.id,
                parentId: this._findParentId(n.id, result.edges) // For tree structure
            })),
            // Pre-calculated tree layout from backend (PathEngine)
            treeLayout: result.treeLayout || null,
            completedIds: Array.from(this.completedNodes),
            mode: 'orbital'
        };

        console.log('[PathApp] treeLayout in result:', result.treeLayout ? `${result.treeLayout.nodes?.length} nodes` : 'NULL/UNDEFINED');
        console.log('[PathApp] Sending pathResult with central:', payload.central.label, 'peripherals:', selectedPeripherals.length, 'totalNodes:', payload.totalNodes);
        this.ws.send(JSON.stringify({
            type: 'pathResult',
            payload: payload
        }));
        console.log('[PathApp] pathResult SENT to Bridge');
    },
    
    // Helper to find parent node ID for tree structure
    _findParentId: function(nodeId, edges) {
        // Parent = node that has an edge pointing TO this node (prerequisite)
        const incomingEdge = edges.find(e => {
            const targetId = typeof e.target === 'object' ? e.target.id : e.target;
            return targetId === nodeId;
        });
        if (incomingEdge) {
            return typeof incomingEdge.source === 'object' ? incomingEdge.source.id : incomingEdge.source;
        }
        return null; // Root node
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
        const tauriMode = this._isTauriMode();
        const toolbar = document.getElementById('path-toolbar');

        if (tauriMode && toolbar) {
            // In Tauri, controls are migrated to Godot. Keep canvas view only.
            toolbar.style.display = 'none';
        }
        if (tauriMode) {
            const pathSettingsHeader = document.querySelector('h3[data-i18n="grp_path_mode"]');
            const pathSettingsGroup = pathSettingsHeader ? pathSettingsHeader.closest('.settings-group') : null;
            if (pathSettingsGroup) {
                pathSettingsGroup.style.display = 'none';
            }
        }

        if (this.uiInitialized) {
            return;
        }
        this.uiInitialized = true;

        const exitBtn = document.getElementById('btn-exit-path');
        if (exitBtn) {
            exitBtn.addEventListener('click', () => this.exitPathMode());
        }

        const learningModeEl = document.getElementById('learning-mode');
        const strategyEl = document.getElementById('strategy');
        const layoutEl = document.getElementById('layout-style');
        const markBtn = document.getElementById('btn-mark-complete');
        const historyBtn = document.getElementById('btn-toggle-history');
        const closeHistoryBtn = document.getElementById('btn-close-history');

        if (!tauriMode) {
            if (learningModeEl) {
                learningModeEl.addEventListener('change', (e) => {
                    const mode = e.target.value;
                    if (mode === 'diffusion') {
                        this.showNodeSelector();
                    } else {
                        this.currentTargetId = null; // Clear target for Domain Mode
                        this.updateTargetDisplay();
                        this.triggerUpdate();
                    }
                });
            }
            if (strategyEl) strategyEl.addEventListener('change', () => this.triggerUpdate());
            if (layoutEl) layoutEl.addEventListener('change', () => this.triggerUpdate());
            if (markBtn) markBtn.addEventListener('click', () => this.markComplete());
            if (historyBtn) historyBtn.addEventListener('click', () => this._toggleHistorySidebar());
        }

        if (closeHistoryBtn) {
            closeHistoryBtn.addEventListener('click', () => {
                const sidebar = document.getElementById('learning-history-sidebar');
                if (!sidebar) return;
                sidebar.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    sidebar.style.display = 'none';
                }, 300);
            });
        }

        // Add Target Display UI if missing
        if (!tauriMode && !document.getElementById('target-display') && toolbar && learningModeEl) {
            const targetDiv = document.createElement('div');
            targetDiv.id = 'target-display';
            targetDiv.className = 'toolbar-group';
            targetDiv.style.display = 'none';
            targetDiv.innerHTML = `
                <span id="target-label" style="font-size: 0.8rem; color: #aaa; margin-right: 5px;"></span>
                <button id="btn-change-target" class="btn-small">Change</button>
            `;
            // Insert after strategy
            toolbar.insertBefore(targetDiv, learningModeEl.parentNode.nextSibling);
            
            document.getElementById('btn-change-target').addEventListener('click', () => {
                this.showNodeSelector();
            });
        }

        const nodeSelectInput = document.getElementById('node-select-input');
        const closeNodeSelectBtn = document.getElementById('btn-close-node-select');
        if (nodeSelectInput) {
            nodeSelectInput.addEventListener('input', (e) => this.filterNodeList(e.target.value));
        }
        if (closeNodeSelectBtn) {
            closeNodeSelectBtn.addEventListener('click', () => {
                const modal = document.getElementById('node-select-modal');
                if (modal) modal.style.display = 'none';
                if (!this.currentTargetId && this._getModeValue() === 'diffusion') {
                    // Keep current mode; Godot/browser can update target later.
                }
            });
        }
    },

    updateTargetDisplay: function() {
        if (this._isTauriMode()) {
            return;
        }
        const div = document.getElementById('target-display');
        const mode = this._getModeValue();
        
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
        const retain = this._getRetainHistoryEnabled();
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
        if (this._getRetainHistoryEnabled()) {
            localStorage.setItem('nc_path_history', JSON.stringify(this.learningHistory));
        }
    },

    triggerUpdate: function() {
        const mode = this._getModeValue();
        const strategy = this._getStrategyValue();
        const layout = this._getLayoutValue();
        let targetId = this.currentTargetId;
        if (mode === 'diffusion' && this.runtimeConfig.targetId) {
            targetId = this.runtimeConfig.targetId;
        }
        if (mode === 'diffusion' && !targetId) {
            const fallbackTarget = this.centralNodeId || (this.nodes.length > 0 ? this.nodes[0].id : null);
            if (fallbackTarget) {
                targetId = fallbackTarget;
                this.currentTargetId = fallbackTarget;
                this.runtimeConfig.targetId = fallbackTarget;
            }
        }
        if (mode === 'diffusion' && !targetId) {
            console.warn('[PathApp] Diffusion mode requested without target; skipping update.');
            return;
        }
        
        // Preserve central focus if we already have one
        if (layout === 'orbital' && !this.centralNodeId && this.nodes.length > 0) {
             const next = this.nodes.find(n => !this.completedNodes.has(n.id));
             this.centralNodeId = next ? next.id : this.nodes[0].id;
        }

        this.worker.postMessage({
            type: 'computePath',
            payload: { 
                mode, 
                strategy, 
                layout, 
                targetId: targetId, 
                centralId: this.centralNodeId,
                collapsedIds: Array.from(this.collapsedNodes),
                completedIds: Array.from(this.completedNodes),
                forcedExpansionIds: Array.from(this.forcedExpansionNodes),
                expansionOrder: this.expansionOrder,
                stickyClaimEnabled: this.stickyClaimEnabled
            }
        });
        
        this.updateTargetDisplay();
    },

    startProcessing: function(targetId) {
        this.currentTargetId = targetId;
        if (this._isTauriMode()) {
            this.runtimeConfig.layout = 'orbital';
            if (targetId) {
                this.runtimeConfig.mode = 'diffusion';
                this.runtimeConfig.targetId = targetId;
            } else if (!this.runtimeConfig.targetId) {
                this.runtimeConfig.mode = 'domain';
            }
        }
        this.forcedExpansionNodes.clear(); // Reset expansion on new target
        const sourceData = (typeof graphData !== 'undefined') ? graphData : window.graphData;
        
        if (!sourceData) {
            console.error('[PathApp] No graph data found to process!');
            return;
        }

        const nodes = sourceData.nodes.map(n => ({
            id: n.id, label: n.label, inDegree: n.inDegree, outDegree: n.outDegree, centrality: n.centrality
        }));
        
        // Debug: Log source edges type
        console.log('[PathApp] Processing links. Source edges count:', sourceData.edges?.length, 'First raw:', sourceData.edges?.[0]);

        // D3 mutates links to objects, we need IDs for the worker
        // Safety check: ensure edges exists, fallback to links check
        const rawEdges = sourceData.edges || sourceData.links || [];
        
        const links = rawEdges.map(l => ({
            source: (typeof l.source === 'object') ? l.source.id : l.source,
            target: (typeof l.target === 'object') ? l.target.id : l.target,
            type: l.type,
            weight: l.weight
        }));

        console.log('[PathApp] Sending initData to worker. Nodes:', nodes.length, 'Links:', links.length, 'Sample Link:', links[0]);
        this.worker.postMessage({ type: 'initData', payload: { nodes, links } });
        this.triggerUpdate();
    },

    handlePathResult: function(result) {
        this.nodes = result.nodes;
        this.links = result.edges;
        // Store treeLayout for later requestPath responses
        if (result.treeLayout) {
            this.lastTreeLayout = result.treeLayout;
        }
        
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

        if (this._getLayoutValue() === 'orbital') {
            this.runLocalCloudLayout();
        }

        this.centerView();
        
        // Sync with Godot
        this.sendPathToBridge(result);
    },

    // --- Animation & Rendering ---

    animate: function() {
        const layout = this._getLayoutValue();
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
        const layout = this._getLayoutValue();

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
        const layout = this._getLayoutValue();
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
        console.log('[PathApp] switchCentral called with:', id);
        this.centralNodeId = id;
        
        // Use triggerUpdate to ensure Worker re-calculates Tree Layout with new Central ID
        this.triggerUpdate();
    },

    runLocalCloudLayout: function() {
        if (this._getLayoutValue() !== 'orbital') return;
        
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
        const layout = this._getLayoutValue();
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
    },
    
    /**
     * Standalone WebSocket mode: Respond to Godot even when Path Mode UI is not active.
     * Uses graphData directly instead of worker-computed paths.
     */
    sendPathToBridgeStandalone: function(centralId) {
        console.log('[PathApp] sendPathToBridgeStandalone for:', centralId);
        
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('[PathApp] WS not open for standalone response');
            return;
        }
        
        const sourceData = (typeof graphData !== 'undefined') ? graphData : window.graphData;
        if (!sourceData || !sourceData.nodes) {
            console.error('[PathApp] No graphData available for standalone mode');
            return;
        }
        
        const centralNode = sourceData.nodes.find(n => n.id === centralId);
        if (!centralNode) {
            console.error('[PathApp] Central node not found in graphData:', centralId);
            return;
        }
        
        // Find connected nodes as peripherals
        const edges = sourceData.edges || [];
        const connectedIds = new Set();
        
        edges.forEach(e => {
            const sourceId = typeof e.source === 'object' ? e.source.id : e.source;
            const targetId = typeof e.target === 'object' ? e.target.id : e.target;
            if (sourceId === centralId) connectedIds.add(targetId);
            if (targetId === centralId) connectedIds.add(sourceId);
        });
        
        const peripherals = Array.from(connectedIds)
            .map(id => sourceData.nodes.find(n => n.id === id))
            .filter(n => n)
            .slice(0, 4)
            .map(n => ({
                id: n.id,
                label: n.label,
                relation: 'association'
            }));
        
        const payload = {
            central: {
                id: centralNode.id,
                label: centralNode.label,
                inDegree: centralNode.inDegree || 0,
                outDegree: centralNode.outDegree || 0
            },
            peripherals: peripherals,
            progress: {
                completed: this.completedNodes ? this.completedNodes.size : 0,
                total: sourceData.nodes.length
            },
            mode: 'orbital'
        };
        
        console.log('[PathApp] Sending standalone pathResult:', payload.central.label);
        this.ws.send(JSON.stringify({
            type: 'pathResult',
            payload: payload
        }));
    },
    
    /**
     * Early WebSocket connection for Godot standalone testing.
     * Called immediately when script loads.
     */
    setupEarlyWebSocket: function() {
        if (this._isTauriMode()) {
            // In Tauri flow, avoid idle early bridge sockets that can reconnect on webview lifecycle changes.
            return;
        }

        if (this.ws) return; // Already connected
        
        console.log('[PathApp] Setting up early WebSocket connection...');
        this.ws = new WebSocket(this._getBridgeWsUrl('frontend-early'));
        
        this.ws.onopen = () => {
            console.log('[PathApp] Early WS Connected to Bridge');
        };
        
        this.ws.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data);
                console.log('[PathApp] Early WS Received:', msg.type);
                
                if (msg.type === 'switchCenter') {
                    const newCentralId = msg.payload?.newCenterId;
                    console.log('[PathApp] Early switch center request:', newCentralId);
                    
                    // If full init was called, use the full pipeline
                    if (this.nodes && this.nodes.length > 0) {
                        this.centralNodeId = newCentralId;
                        this.runLocalCloudLayout();
                        this.render();
                        this.centerView();
                        
                        const result = {
                            nodes: this.nodes,
                            edges: this.links
                        };
                        this.sendPathToBridge(result);
                    } else {
                        // Standalone mode: Use graphData directly
                        this.centralNodeId = newCentralId;
                        this.sendPathToBridgeStandalone(newCentralId);
                    }
                } else if (msg.type === 'requestPath') {
                    console.log('[PathApp] Early requestPath received');
                    // Respond with current state if available
                    if (this.nodes && this.nodes.length > 0 && this.centralNodeId) {
                        const result = {
                            nodes: this.nodes,
                            edges: this.links
                        };
                        this.sendPathToBridge(result);
                    }
                } else if (msg.type === 'configure') {
                    console.log('[PathApp] Early configure received');
                    this.applyRemoteConfigure(msg.payload || {});
                } else if (msg.type === 'exitPathMode') {
                    this.exitPathMode();
                }
            } catch(err) {
                console.error('[PathApp] Early WS Error:', err);
            }
        };
        
        this.ws.onerror = (err) => {
            console.warn('[PathApp] Early WS Error (PathBridge may not be running):', err);
        };
        this.ws.onclose = (e) => {
            console.log('[PathApp] Early WS Closed. code=', e.code, 'reason=', e.reason || '<empty>');
        };
    }
};

// === AUTO-CONNECT: Establish WebSocket immediately for Godot standalone support ===
// This runs as soon as path_app.js is loaded, before init() is called.
(function() {
    const isTauri = typeof window !== 'undefined' && !!window.__TAURI__;
    if (isTauri) {
        // Bridge-first Tauri: only connect when Path Mode is explicitly initialized.
        return;
    }

    // Small delay to ensure graphData might be available
    setTimeout(() => {
        if (window.pathApp && !window.pathApp.ws) {
            window.pathApp.setupEarlyWebSocket();
        }
    }, 500);
})();

