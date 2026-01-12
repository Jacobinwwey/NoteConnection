// Initialize Graph
const container = document.getElementById('graph-container');
let focusNode = null;

// State for Cluster Filtering
let activeClusterFilter = localStorage.getItem('activeClusterFilter') || 'all';
// Clear it immediately so it doesn't persist unwantedly on manual refreshes? 
// No, user might want to refresh. We need a UI to clear it.

// Create SVG with 100% dimensions
const svg = d3.select("#graph-container")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .on("click", (event) => {
        // Clear highlight on background click using highlightManager
        // 使用highlightManager在背景点击时清除高亮
        if (event.target.tagName === 'svg') {
             // Only if not in Focus Mode (Focus Mode has its own exit)
             // 仅当不在专注模式时（专注模式有自己的退出方式）
             if (!focusNode && window.highlightManager) {
                 const state = window.highlightManager.getState();
                 if (state.isFrozen || state.currentNode) {
                     // Clear highlight with force option
                     // 使用强制选项清除高亮
                     window.highlightManager.unhighlight({ force: true });
                     
                     // Hide statistics popup if visible
                     // 如果统计弹窗可见则隐藏
                     const popup = document.getElementById('node-stats-popup');
                     if (popup) popup.style.display = 'none';
                 }
             }
        }
    })
    .call(d3.zoom().on("zoom", (event) => {
        g.attr("transform", event.transform);
        // v0.9.31: Check simulation state on zoom
        if (typeof checkSimulationState === 'function') checkSimulationState();
    }));

const g = svg.append("g");

// Tooltip
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

// Data
const nodes = graphData.nodes.map(d => Object.create(d));
let links = graphData.edges.map(d => Object.create(d));

// Optimization: Pre-resolve links to ensure they are objects, not strings.
// This allows us to feed a SUBSET to the physics engine while keeping ALL links for rendering.
// 优化：预解析连接以确保它们是对象而不是字符串。
// 这允许我们将子集提供给物理引擎，同时保留所有连接以供渲染。
const nodeMap = new Map(nodes.map(n => [n.id, n]));
links.forEach(l => {
    if (typeof l.source !== 'object') l.source = nodeMap.get(l.source);
    if (typeof l.target !== 'object') l.target = nodeMap.get(l.target);
});

// Filter out broken links (where source/target missing)
// 过滤掉断开的连接（源/目标丢失）
const validLinks = links.filter(l => l.source && l.target);
// Replace original links array with valid ones to avoid errors in render
// 用有效的链接数组替换原始链接数组以避免渲染错误
links = validLinks;

// Optimization: Default to Canvas for large graphs (>3000 nodes) to save memory
if (nodes.length > 3000) {
    console.log(`[Optimization] Large graph detected (${nodes.length} nodes). Switching to Canvas mode.`);
    const canvasRadio = document.querySelector('input[name="rendererMode"][value="canvas"]');
    const svgRadio = document.querySelector('input[name="rendererMode"][value="svg"]');
    
    if (canvasRadio && svgRadio) {
        canvasRadio.checked = true;
        svgRadio.checked = false;
        
        // Manually trigger visibility update since listeners might not have fired yet
        // or just set initial state
        const svgEl = document.querySelector('#graph-container svg');
        const canvasEl = document.getElementById('graph-canvas');
        if (svgEl) svgEl.style.display = 'none';
        if (canvasEl) canvasEl.style.display = 'block';

        // v0.9.67 Fix: Force initial resize and tick to ensure canvas is drawn
        // The canvas needs to be sized and content rendered immediately
        setTimeout(() => {
             if (typeof resizeCanvas === 'function') resizeCanvas();
             if (typeof ticked === 'function') ticked();
             console.log("[Init] Forced initial Canvas render.");
        }, 100);
    }
}

// v0.9.67: Auto-enable Compact Mode for very large graphs
// Criteria: > 5000 Nodes OR > 100,000 Edges
if (nodes.length > 5000 || links.length > 100000) {
    console.log(`[Optimization] Massive graph detected (${nodes.length} nodes, ${links.length} edges). Enabling Compact Mode.`);
    // Only set if user hasn't explicitly saved a preference? 
    // For now, we enforce default if no setting exists or override for performance safety.
    // Let's check if settingsManager is available and update it.
    if (window.settingsManager) {
        // We set it but don't save it to localStorage to avoid persisting it permanently 
        // if the user switches to a small graph later? 
        // Actually, settings are global. 
        // Better: Update the runtime setting.
        window.settingsManager.set('performance', 'compactMode', true);
        
        // Also update UI if Settings Modal exists (might not be init yet)
        // The settings UI init code will read from settingsManager.
    }
}

// Update stats
document.getElementById('node-count').innerText = nodes.length;
document.getElementById('edge-count').innerText = links.length;

// Inject Filter Reset UI if needed
if (activeClusterFilter !== 'all') {
    const controls = document.getElementById('controls');
    const filterMsg = document.createElement('div');
    filterMsg.style.background = '#742a2a';
    filterMsg.style.color = 'white';
    filterMsg.style.padding = '5px';
    filterMsg.style.marginTop = '10px';
    filterMsg.style.borderRadius = '4px';
    filterMsg.style.fontSize = '0.85rem';
    filterMsg.style.display = 'flex';
    filterMsg.style.justifyContent = 'space-between';
    filterMsg.style.alignItems = 'center';
    filterMsg.innerHTML = `<span>Filter: <b>${activeClusterFilter}</b></span> <button id="clear-cluster-filter" style="font-size:0.8em; cursor:pointer;">X</button>`;
    
    // Insert after Search box
    const searchBox = document.querySelector('.search-box');
    searchBox.parentNode.insertBefore(filterMsg, searchBox.nextSibling);
    
    setTimeout(() => {
        document.getElementById('clear-cluster-filter').addEventListener('click', () => {
            localStorage.removeItem('activeClusterFilter');
            window.location.reload();
        });
    }, 100);
}

// Initialize Controls
const maxDegree = d3.max(nodes, d => d.inDegree + d.outDegree) || 0;
const minDegreeSlider = document.getElementById('min-degree-slider');
minDegreeSlider.max = maxDegree;
document.getElementById('min-degree-val').innerText = minDegreeSlider.value;

// v0.9.69 Fix: Move controls definition UP to prevent ResizeObserver/setTimeout race condition
// caused by renderCanvas accessing 'controls' before it was defined.
const controls = {
    minDegree: document.getElementById('min-degree-slider'),
    showOrphans: document.getElementById('show-orphans'),
    search: document.getElementById('search-input'),
    export: document.getElementById('export-btn')
};

// Simulation
// Initial Center
let width = container.clientWidth;
let height = container.clientHeight;

// Optimization: Limit Physics Edges
// For CPU physics (d3.forceLink), we must limit edges to prevent main thread freeze.
// For GPU physics (gpuLink), we can handle significantly more.
let physicsLinks = links;

function updatePhysicsLinks(settings) {
    const isGPUEnabled = settings && settings.performance && settings.performance.gpuRendering;
    const limit = isGPUEnabled ? 2000000 : 20000;
    
    if (links.length > limit) {
        console.log(`[Optimization] Too many edges (${links.length}). Limiting physics simulation to ${limit} to prevent freeze.`);
        physicsLinks = links.slice(0, limit); 
    } else {
        physicsLinks = links;
    }
}

// Initial update using current settings
if (window.settingsManager) {
    updatePhysicsLinks(settingsManager.settings);
} else {
    // Fallback default
    if (links.length > 20000) {
        console.warn(`[Optimization] Too many edges (${links.length}). Limiting physics simulation to 20000 (Safe Default).`);
        physicsLinks = links.slice(0, 20000);
    }
}

// Simulation Worker Setup
const simulationWorker = new Worker("simulationWorker.js");

// Position buffer for rendering
let currentPositions = new Map();

simulationWorker.onmessage = function(event) {
    const { type, nodes: workerNodes } = event.data;
    if (type === 'tick') {
        // v0.9.80: Ignore worker ticks in Focus Mode to prevent position overwrite
        // In Focus Mode, positions are managed by the main thread's highlightManager
        if (focusNode) return;

        // Update positions
        workerNodes.forEach(n => {
            currentPositions.set(n.id, { x: n.x, y: n.y });
            const originalNode = nodeMap.get(n.id);
            if (originalNode) {
                originalNode.x = n.x;
                originalNode.y = n.y;
            }
        });
        
        ticked();
    }
};

// Simulation Proxy to mimic D3 API for compatibility
const simulation = {
    force: (name, ...args) => {
        // Simplified proxy: We only support specific updates via messages
        // If args provided, it's a setter.
        // This is complex because d3 uses chaining and function arguments.
        // We will refactor usage sites instead of perfect proxying.
        return simulation; // Chaining
    },
    alpha: (a) => {
        if (a !== undefined) {
             simulationWorker.postMessage({ type: 'updateParams', payload: { alpha: a, restart: true } });
             return simulation;
        }
        return 0; // Dummy
    },
    alphaTarget: (a) => {
         // Used in drag
         // We handle drag separately
         return simulation; 
    },
    restart: () => {
        simulationWorker.postMessage({ type: 'restart', payload: {} });
        return simulation; 
    },
    stop: () => {
        simulationWorker.postMessage({ type: 'stop', payload: {} });
        return simulation;
    },
    velocityDecay: (d) => {
        if (d !== undefined) {
            simulationWorker.postMessage({ type: 'updateParams', payload: { velocityDecay: d } });
            return simulation;
        }
        return 0.2; // Dummy default
    },
    nodes: () => nodes // Return reference to main thread nodes
};

// Initialize Worker
// Send simplified data structure (avoid circular refs)
const workerNodes = nodes.map(n => ({ id: n.id, x: n.x || Math.random()* width, y: n.y || Math.random()*height, fx: n.fx, fy: n.fy, rank: n.rank }));
const workerLinks = physicsLinks.map(l => ({ source: l.source.id, target: l.target.id }));

simulationWorker.postMessage({ 
    type: 'init', 
    payload: { 
        nodes: workerNodes, 
        links: workerLinks, 
        width, 
        height,
        settings: {
            repulsion: -300,
            distance: 100,
            velocityDecay: 0.2
        }
    } 
});

// v0.9.37: Two-stage Damping Strategy handled in worker or re-implemented here?
// Re-implementing logic via messages
setTimeout(() => {
    // We assume default hasn't changed manually
    // Send update
    simulationWorker.postMessage({ type: 'updateParams', payload: { velocityDecay: 0.95 } });
    
    // Sync UI
    if (typeof simSpeedSlider !== 'undefined' && simSpeedSlider) {
        simSpeedSlider.value = 0.95;
        if (typeof simSpeedVal !== 'undefined' && simSpeedVal) {
             simSpeedVal.innerText = "0.95";
        }
    }
    
    // Static Mode Enforcement
    if (nodes.length > 5000 || links.length > 200000) {
         console.log("[Simulation] Large graph detected. Freezing simulation after relaxation.");
         simulation.stop();
    }
}, 2000);

// Handle Resize
const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
        width = entry.contentRect.width;
        height = entry.contentRect.height;
        
        if (typeof resizeCanvas === 'function') resizeCanvas();

        // v0.9.75: Skip layout updates if in Focus Mode to maintain static state
        if (focusModeState && focusModeState.active) {
            console.log("[Resize] Focus Mode active. Skipping layout update.");
            // Optional: Re-center focus node? For now, just render.
            ticked();
            return;
        }

        const mode = document.querySelector('input[name="layoutMode"]:checked') ? document.querySelector('input[name="layoutMode"]:checked').value : 'force';
        
        // Send layout update to worker
        // We reuse the updateLayout logic which now sends messages
        updateLayout(); 
        
        const isFrozen = document.getElementById('freeze-layout') ? document.getElementById('freeze-layout').checked : false;
        if (!isFrozen) {
            simulation.restart();
        }
    }
});
resizeObserver.observe(container);

// Arrows for edges
const defs = svg.append("defs");
const markers = [
    { id: "arrow", color: "#555" },
    { id: "arrow-in", color: "#ff6b6b" },
    { id: "arrow-out", color: "#4488ff" }
];

defs.selectAll("marker")
    .data(markers)
    .enter().append("marker")
    .attr("id", d => d.id)
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 15) // Position of arrow
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", d => d.color);

// Render Links
const link = g.append("g")
    .attr("class", "links")
    .selectAll("path")
    .data(links)
    .enter().append("path")
    .attr("class", "link")
    .attr("marker-end", "url(#arrow)");

// Render Nodes
const node = g.append("g")
    .attr("class", "nodes")
    .selectAll("g")
    .data(nodes)
    .enter().append("g")
    .attr("class", "node")
    .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

// Node Circles (Color by degree)
// Scales
const colorScaleDegree = d3.scaleSequential(d3.interpolateBlues)
    .domain([0, maxDegree]);

const uniqueClusters = Array.from(new Set(nodes.map(d => d.clusterId))).sort();
const colorScaleCluster = d3.scaleOrdinal(d3.schemeCategory10)
    .domain(uniqueClusters);

// Size Scale
const maxCentrality = d3.max(nodes, d => d.centrality || 0) || 1;
const sizeScaleCentrality = d3.scaleSqrt()
    .domain([0, maxCentrality])
    .range([3, 12]); // Min 3px, Max 12px

const circles = node.append("circle")
    .attr("r", 5);

// Labels
const texts = node.append("text")
    .attr("dx", 8)
    .attr("dy", ".35em")
    .text(d => d.label);

// Initialize Node Highlight Manager
// 初始化节点高亮管理器
const focusModeState = { active: false, node: null };
const highlightManager = window.createNodeHighlightManager({
    nodes: nodes,
    links: links,
    nodeSelection: node,
    linkSelection: link,
    tooltip: tooltip,
    simulation: simulation,
    onTick: ticked
});
window.highlightManager = highlightManager;

// Update focus mode state helper
// 更新专注模式状态辅助函数
function updateFocusModeState(active, node = null) {
    focusModeState.active = active;
    focusModeState.node = node;
    highlightManager.setFocusMode(focusModeState);
}

// Initial State
updateColor();
updateSize();

// Version Info
const APP_VERSION = "1.0.0";
const controlsPanelEl = document.getElementById('controls');
if (controlsPanelEl) {
    const versionEl = document.createElement('div');
    versionEl.style.marginTop = '15px';
    versionEl.style.borderTop = '1px solid #444';
    versionEl.style.paddingTop = '10px';
    versionEl.style.fontSize = '0.7rem';
    versionEl.style.color = '#666';
    versionEl.style.textAlign = 'center';
    versionEl.innerText = `v${APP_VERSION}`;
    controlsPanelEl.appendChild(versionEl);
}


// Helper to get degree based on selection
function getDegree(d) {
    const mode = document.querySelector('input[name="degreeMode"]:checked').value;
    if (mode === 'in') return d.inDegree || 0;
    if (mode === 'out') return d.outDegree || 0;
    return (d.inDegree || 0) + (d.outDegree || 0);
}

function updateColor() {
    const mode = document.querySelector('input[name="colorMode"]:checked').value;
    if (mode === 'cluster') {
        circles.attr("fill", d => colorScaleCluster(d.clusterId || 'unknown'));
    } else {
        // Update domain based on current max degree
        const maxDeg = d3.max(nodes, d => getDegree(d)) || 1;
        colorScaleDegree.domain([0, maxDeg]);
        circles.attr("fill", d => colorScaleDegree(getDegree(d)));
    }
}

function updateSize() {
    const mode = document.querySelector('input[name="sizeMode"]:checked').value;
    
    if (mode === 'centrality') {
        // Node Size by Centrality
        circles.transition().duration(300).attr("r", d => sizeScaleCentrality(d.centrality || 0));
        
        texts.transition().duration(300)
             .attr("font-size", d => Math.max(10, sizeScaleCentrality(d.centrality || 0) * 1.2) + "px")
             .attr("font-weight", d => (d.centrality || 0) > maxCentrality * 0.5 ? "bold" : "normal")
             .attr("dx", d => sizeScaleCentrality(d.centrality || 0) + 4);

        simulation.force("collide", d3.forceCollide().radius(d => sizeScaleCentrality(d.centrality || 0) + 5));
    
    } else if (mode === 'degree') {
        // Node Size by Degree
        const maxDeg = d3.max(nodes, d => getDegree(d)) || 1;
        const sizeScaleDegree = d3.scaleSqrt().domain([0, maxDeg]).range([3, 12]);

        circles.transition().duration(300).attr("r", d => sizeScaleDegree(getDegree(d)));
        
        texts.transition().duration(300)
             .attr("font-size", d => Math.max(10, sizeScaleDegree(getDegree(d)) * 1.2) + "px")
             .attr("dx", d => sizeScaleDegree(getDegree(d)) + 4);

        simulation.force("collide", d3.forceCollide().radius(d => sizeScaleDegree(getDegree(d)) + 5));

    } else {
        // Uniform
        circles.transition().duration(300).attr("r", 5);
        texts.transition().duration(300)
             .attr("font-size", "10px")
             .attr("font-weight", "normal")
             .attr("dx", 8);
        
        simulation.force("collide", d3.forceCollide().radius(8));
    }
    
    // v0.9.36: Check Freeze Layout State before restarting
    // Requirement: "when I modified 'Degree Basis' or 'Size By', the node started to move again... node should not start to move"
    const isFrozen = document.getElementById('freeze-layout') ? document.getElementById('freeze-layout').checked : false;
    if (!isFrozen) {
        simulation.alpha(0.3).restart();
    }
}

// Layout State Caching (v0.9.33)
const layoutCache = { force: null, dag: null };
let currentLayoutMode = 'force'; // Default start mode
let isLayoutSwitching = false; // v0.9.82: Handshake flag

function cacheLayoutState(mode) {
    console.log(`[Layout] Caching state for mode: ${mode} (${nodes.length} nodes)`);
    // Deep copy specific properties
    layoutCache[mode] = nodes.map(n => ({
        id: n.id,
        x: n.x, y: n.y,
        fx: n.fx, fy: n.fy,
        vx: n.vx, vy: n.vy
    }));
}

function restoreLayoutState(mode) {
    console.log(`[Layout] Attempting to restore mode: ${mode}`);
    if (!layoutCache[mode]) {
        console.log(`[Layout] No cache found for ${mode}`);
        return false;
    }
    
    const cacheMap = new Map(layoutCache[mode].map(c => [c.id, c]));
    let restoredCount = 0;

    nodes.forEach(n => {
        const c = cacheMap.get(n.id);
        if (c) {
            n.x = c.x; n.y = c.y;
            n.fx = c.fx; n.fy = c.fy;
            n.vx = c.vx; n.vy = c.vy;
            restoredCount++;
        }
    });
    console.log(`[Layout] Restored ${restoredCount}/${nodes.length} nodes from cache`);
    // v0.9.81: Strict restoration check. If we lost most nodes (filter?), treat as cache miss.
    return restoredCount > (nodes.length * 0.5);
}

function updateLayout() {
    const newMode = document.querySelector('input[name="layoutMode"]:checked').value;
    
    // v0.9.79: Prevent layout shift on resize when frozen
    // If mode hasn't changed and we are frozen, do not re-send layout params (which resets center).
    const isFrozen = document.getElementById('freeze-layout') ? document.getElementById('freeze-layout').checked : false;
    if (newMode === currentLayoutMode && isFrozen) {
        console.log("[Layout] Update blocked by Freeze Layout.");
        return;
    }

    console.log(`[Layout] Switching from ${currentLayoutMode} to ${newMode}`);
    
    // 1. Cache previous state if mode changed
    if (newMode !== currentLayoutMode) {
        cacheLayoutState(currentLayoutMode);
        currentLayoutMode = newMode;
    }

    // Prepare settings for worker
    const settings = settingsManager ? settingsManager.settings.physics : {};

    // 2. Attempt to Restore State
    // 2. Attempt to Restore State
    const hasCache = !!layoutCache[newMode];
    let restored = false;

    if (hasCache) {
        restored = restoreLayoutState(newMode);
    }
    
    // v0.9.81: User Logic - If cache exists and valid, use it. Else restart (relax).
    // If restore failed (restored=false) even if hasCache=true, we MUST restart.
    const shouldRestart = !restored;

    // Send command to worker
    simulationWorker.postMessage({ 
        type: 'updateLayout', 
        payload: { 
            mode: newMode, 
            width, 
            height,
            settings: { 
                repulsion: settings.repulsionForce || -300, 
             },
            restart: shouldRestart // Restart if no cache OR restore failed
        } 
    });

    // 3. Simulation Control
    if (restored) {
        // IMMEDIATE UI UPDATE: Render the restored state instantly
        ticked();

        console.log("[Layout] State restored. Syncing worker in background.");
        
        // v0.9.82: Remove setTimeout to prioritize sync and prevent stale ticks.
        // We use a handshake to ignore ticks until this sync is complete.
        isLayoutSwitching = true; // Block ticks

        // Sync Worker with restored positions
        const workerNodes = nodes.map(n => ({
            id: n.id,
            x: n.x, y: n.y,
            fx: n.fx, fy: n.fy,
            vx: n.vx, vy: n.vy,
            rank: n.rank 
        }));
        
        simulationWorker.postMessage({
            type: 'setNodes',
            payload: {
                nodes: workerNodes,
                links: physicsLinks.map(l => ({ source: l.source.id, target: l.target.id })),
                restart: false // keep stopped
            }
        });

        // Ensure it stays stopped
        simulationWorker.postMessage({ type: 'stop' });
        
        // Send handshake
        simulationWorker.postMessage({ type: 'layoutSwitchDone' });
                   
    } else {
        // v0.9.34: Force Unfreeze
        nodes.forEach(n => {
            n.fx = null;
            n.fy = null;
            n.isCulled = false; 
        });
        
        // Notify worker to unfix all nodes (except dragged ones? logic needed)
        // For now, assume unfix all.
        // simulationWorker.postMessage({ type: 'fixNodes', payload: nodes.map(n => ({id: n.id, cmd: 'unfix'})) });

        // v0.9.39: Rapid Relaxation on Layout Switch (Only for FRESH layouts)
        simulationWorker.postMessage({ type: 'updateParams', payload: { velocityDecay: 0.2, restart: true } });

        setTimeout(() => {
             simulationWorker.postMessage({ type: 'updateParams', payload: { velocityDecay: 0.95 } });
             
             // Sync UI
             if (typeof simSpeedSlider !== 'undefined' && simSpeedSlider) {
                simSpeedSlider.value = 0.95;
                if (typeof simSpeedVal !== 'undefined' && simSpeedVal) {
                    simSpeedVal.innerText = "0.95";
                }
            }

            const isFrozen = document.getElementById('freeze-layout') ? document.getElementById('freeze-layout').checked : false;
            const isLargeGraph = nodes.length > 5000 || links.length > 200000;
            
            if (isFrozen || isLargeGraph) {
                if (isLargeGraph) console.log("[Simulation] Large graph detected. Freezing simulation after layout switch.");
                simulationWorker.postMessage({ type: 'stop', payload: {} });
            }
        }, 2000);
    }
}

// Listeners
document.querySelectorAll('input[name="layoutMode"]').forEach(radio => {
    radio.addEventListener('change', updateLayout);
});

document.querySelectorAll('input[name="colorMode"]').forEach(radio => {
    radio.addEventListener('change', updateColor);
});
document.querySelectorAll('input[name="sizeMode"]').forEach(radio => {
    radio.addEventListener('change', updateSize);
});
document.querySelectorAll('input[name="degreeMode"]').forEach(radio => {
    radio.addEventListener('change', () => {
        updateColor(); // Color might depend on degree mode
        updateSize();  // Size might depend on degree mode
    });
});

// Localization
const translations = {
    zh: {
        show_all: "显示全部",
        show_in: "仅入度",
        show_out: "仅出度",
        view_mode: "视图模式:",
        view_nodes: "节点",
        view_clusters: "聚类 (概览)",
        degree_basis: "度数基准:",
        all: "总",
        in: "入",
        out: "出",
        color_by: "颜色依据:",
        degree: "度数",
        cluster: "聚类",
        size_by: "大小依据:",
        uniform: "统一",
        centrality: "中心性",
        nodes: "节点:",
        edges: "边:",
        label_opacity: "标签透明度:",
        min_degree: "最小度数:",
        show_orphans: "显示孤立节点",
        export_image: "导出图片",
        save_layout: "保存布局 (JSON)",
        analysis_export: "分析与导出",
        search_placeholder: "搜索节点...",
        layout: "布局:",
        layout_force: "力导向",
        layout_dag: "DAG (层级)",
        
        // Analysis Panel
        analysis_title: "度数分析",
        node_details: "节点详情",
        filter_strategy: "过滤策略:",
        cluster_filter: "聚类过滤:",
        threshold: "阈值:",
        selected: "已选:",
        export_json: "JSON",
        export_zip: "ZIP (MD)",
        filtered_nodes: "过滤后节点",
        back: "返回",
        inbound_rels: "入度 (帮助理解)",
        outbound_rels: "出度 (进一步探索)",
        
        // Strategy Options
        strat_top: "Top X% (按度数)",
        strat_min: "最小度数 > X",
        cluster_all: "所有聚类",
        
        // Table Headers
        th_name: "名称",
        th_cluster: "聚类",
        th_in: "入",
        th_out: "出",
        th_total: "总计",
        
        // Settings
        settings_title: "可视化设置",
        btn_settings: "设置",
        grp_physics: "物理模拟",
        grp_visuals: "视觉外观",
        lbl_repulsion: "排斥力",
        lbl_distance: "连接长度",
        lbl_collision: "碰撞半径",
        lbl_opacity: "边透明度",
        lbl_gpu: "启用 GPU 加速",
        desc_gpu: "使用 GPU 进行相似度计算（需要重新加载）。",
        lbl_memory_saving: "大文件内存节省策略",
        desc_memory_saving: "使用低精度策略以防止大文件导致的内存溢出。",
        lbl_compact_mode: "紧凑模式 (隐藏边)",
        desc_compact_mode: "默认不加载/渲染边以提高 >5k 节点的性能。",
        lbl_deep_debug: "深度调试",
        desc_deep_debug: "启用详细日志以进行调试。",
        btn_reset: "重置默认",
        btn_done: "完成",
        
        // Reader
        grp_reading: "阅读窗口",
        lbl_reading_mode: "打开模式",
        opt_window: "窗口",
        opt_fullscreen: "全屏",
        
        // Focus Mode
        exit_focus: "退出专注模式",
        auto_arrange: "自动排列",
        open_content: "打开具体内容",
        focus_inbound: "帮助理解",
        focus_outbound: "进一步探索",
        
        // Simulation
        simulation: "物理模拟",
        freeze_layout: "冻结布局 (停止刷新)",
        speed: "速度 (阻尼):",
        
        // Quick Start & UI
        help: "帮助",
        manual_title: "快速开始指南",
        manual_step1_title: "1. 加载知识库（移动端请忽略这步）",
        manual_step1_desc: "从下拉菜单（左上角）选择一个文件夹，然后点击“加载”以可视化您的笔记。",
        manual_step2_title: "2. 导航",
        manual_step2_desc: "• <strong>平移/缩放</strong>: 拖动背景移动，滚动/捏合缩放。<br>• <strong>检查</strong>: 单击（移动端）或悬停（PC）节点以查看连接。",
        manual_step3_title: "3. 专注模式",
        manual_step3_desc: "<strong>双击</strong>节点进入专注模式。这将隔离概念并按层级排列其依赖关系。",
        manual_step4_title: "4. 控制",
        manual_step4_desc: "• <strong>冻结 (❄️)</strong>: 停止移动以便轻松点击/阅读节点。<br>• <strong>布局</strong>: 在侧面板中切换“力导向”（聚类）和“DAG”（树状）布局。",
        dont_show_again: "不再显示",
        btn_got_it: "知道了！"
    },
    en: {
        show_all: "Show All",
        show_in: "Incoming Only",
        show_out: "Outgoing Only",
        view_mode: "View Mode:",
        view_nodes: "Nodes",
        view_clusters: "Clusters (Overview)",
        degree_basis: "Degree Basis:",
        all: "All",
        in: "In",
        out: "Out",
        color_by: "Color By:",
        degree: "Degree",
        cluster: "Cluster",
        size_by: "Size By:",
        uniform: "Uniform",
        centrality: "Centrality",
        nodes: "Nodes:",
        edges: "Edges:",
        label_opacity: "Label Opacity:",
        min_degree: "Min Degree:",
        show_orphans: "Show Orphans",
        export_image: "Export Image",
        save_layout: "Save Layout (JSON)",
        analysis_export: "Analysis & Export",
        search_placeholder: "Search node...",
        layout: "Layout:",
        layout_force: "Force",
        layout_dag: "DAG (Hierarchical)",
        
        // Analysis Panel
        analysis_title: "Degree Analysis",
        node_details: "Node Details",
        filter_strategy: "Filter Strategy:",
        cluster_filter: "Cluster Filter:",
        threshold: "Threshold:",
        selected: "Selected:",
        export_json: "JSON",
        export_zip: "ZIP (MD)",
        filtered_nodes: "Filtered Nodes",
        back: "Back",
        inbound_rels: "Inbound (Helping to understand)",
        outbound_rels: "Outbound (Further exploration)",
        
        // Strategy Options
        strat_top: "Top X% (by Degree)",
        strat_min: "Min Degree > X",
        cluster_all: "All Clusters",
        
        // Table Headers
        th_name: "Name",
        th_cluster: "Cluster",
        th_in: "In",
        th_out: "Out",
        th_total: "Total",
        
        // Settings
        settings_title: "Visualization Settings",
        btn_settings: "Settings",
        grp_physics: "Physics Simulation",
        grp_visuals: "Visual Appearance",
        lbl_repulsion: "Repulsion",
        lbl_distance: "Link Length",
        lbl_collision: "Collision Radius",
        lbl_opacity: "Edge Opacity",
        lbl_gpu: "Enable GPU Acceleration",
        desc_gpu: "Use GPU for similarity calculation (Requires page reload).",
        lbl_memory_saving: "Large File Memory Saving Strategy",
        desc_memory_saving: "Use lower precision strategies to prevent OOM on large files.",
        lbl_compact_mode: "Compact Mode (Hide Edges)",
        desc_compact_mode: "Don't load/render edges by default to improve performance for >5k nodes.",
        lbl_deep_debug: "Deep Debug",
        desc_deep_debug: "Enable detailed logging for debugging.",
        btn_reset: "Reset Defaults",
        btn_done: "Done",
        
        // Reader
        grp_reading: "Reading Window",
        lbl_reading_mode: "Open Mode",
        opt_window: "Window",
        opt_fullscreen: "Full Screen",
        
        // Focus Mode
        exit_focus: "Exit Focus Mode",
        open_content: "Open Specific Content",
        focus_inbound: "Helping to understand",
        focus_outbound: "Further exploration",
        
        // Simulation
        simulation: "Simulation",
        freeze_layout: "Freeze Layout",
        speed: "Speed (Damping):"
    }
};

window.t = function(key) {
    const langSelect = document.getElementById('set-language');
    // Fallback if element not found yet (race condition safety)
    const lang = langSelect ? langSelect.value : 'en';
    return translations[lang][key] || key;
}

window.updateLanguage = function(lang) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (translations[lang] && translations[lang][key]) {
            el.innerHTML = translations[lang][key];
        }
    });
    
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.dataset.i18nPlaceholder;
        if (translations[lang] && translations[lang][key]) {
            el.placeholder = translations[lang][key];
        }
    });

    // Trigger update for Analysis Panel components if they exist
    if (typeof window.updateAnalysisUI === 'function') {
        window.updateAnalysisUI();
    }
}

// Language Selector in Settings
const langSelect = document.getElementById('set-language');
if (langSelect) {
    langSelect.addEventListener('change', (e) => {
        window.updateLanguage(e.target.value);
    });
}


// v0.9.45: View Mode Removed
// Cluster aggregation logic removed.

// Simulation Controls
const simSpeedSlider = document.getElementById('sim-speed-slider');
const simSpeedVal = document.getElementById('sim-speed-val');
const freezeLayoutCheckbox = document.getElementById('freeze-layout');

if (simSpeedSlider) {
    simSpeedSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        simSpeedVal.innerText = val;
        // D3 velocityDecay: 1 = frictionless, 0 = frozen? No.
        // D3: velocityDecay(0.4) is default. 
        // We map slider 0-1 to reasonable decay. 
        // Let's treat slider as "Friction": 1 = high friction (stop), 0 = low friction.
        // Actually, d3.velocityDecay corresponds to (1 - friction) per tick.
        // Standard range [0, 1]. 
        simulation.velocityDecay(val);
        simulation.alphaTarget(0.3).restart();
    });
}

if (freezeLayoutCheckbox) {
    freezeLayoutCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            simulation.stop();
            // Optional: Fix all nodes in place to be sure?
            // simulation.nodes().forEach(d => { d.fx = d.x; d.fy = d.y; });
        } else {
            // Release nodes? Only if we fixed them. 
            // For now, just restart.
            simulation.alphaTarget(0.3).restart();
        }
    });
}

// Interactions
let transform = d3.zoomIdentity;
let clickTimer = null;

// Event Handlers using highlightManager
// 使用highlightManager的事件处理器
node.on("mouseover", function(event, d) {
    const state = highlightManager.getState();
    if (!state.isFrozen && !focusModeState.active) {
        highlightManager.highlight(d, { event: event });
    }
}).on("mouseout", function(event, d) {
    const state = highlightManager.getState();
    if (!state.isFrozen && !focusModeState.active) {
        highlightManager.unhighlight();
    }
}).on("dblclick", (event) => event.stopPropagation());

// Click & Double Click Logic
node.on("click", (event, d) => {
    if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
        // Double Click Detected
        handleDoubleClick(event, d);
    } else {
        clickTimer = setTimeout(() => {
            clickTimer = null;
            // Single Click Detected
            handleSingleClick(event, d);
        }, 250); // 250ms delay to wait for potential second click
    }
    event.stopPropagation();
});

function handleSingleClick(event, d) {
    // Requirement: "this effect does not exist in 'Focus mode'"
    if (focusNode) return;

    // Use highlightManager with freeze option
    // 使用带冻结选项的highlightManager
    highlightManager.highlight(d, { 
        event: event, 
        freeze: true 
    });
    
    // Show Statistics Panel (Floating Popup)
    // 显示统计弹窗
    showNodePopup(d.id);
}

function handleDoubleClick(event, d) {
    // Requirement: Double Click enters Focus Mode
    // 要求：双击进入专注模式
    // v0.9.19 Fix: Allow re-entering focus mode for different nodes
    // v0.9.19 修复：允许为不同节点重新进入专注模式
    // v0.9.20 Enhancement: Auto-clear selection state when entering focus mode
    // v0.9.20 增强：进入专注模式时自动清除选择状态
    
    if (focusNode && focusNode.id === d.id) {
        // Already focused on same node -> Open Reader
        // 已经专注于同一节点 -> 打开阅读器
        if (window.reader) window.reader.open(d);
    } else {
        // Clear any existing selection/highlight state before entering focus mode
        // 在进入专注模式前清除任何现有的选择/高亮状态
        if (window.highlightManager) {
            window.highlightManager.unhighlight({ force: true });
        }
        
        // Hide statistics popup if visible
        // 如果统计弹窗可见则隐藏
        const popup = document.getElementById('node-stats-popup');
        if (popup && popup.style.display !== 'none') {
            popup.style.display = 'none';
        }
        
        // Enter or Re-enter Focus Mode for new node
        // 为新节点进入或重新进入专注模式
        // This properly handles the case when double-clicking a related node while in focus mode
        // 这正确处理了在专注模式下双击相关节点的情况
        enterFocusMode(d);
    }
}


// --- Node Statistics Popup Logic ---
// --- 节点统计弹窗逻辑 ---
const statsPopup = document.getElementById('node-stats-popup');
const popupCloseBtn = document.getElementById('popup-close-btn');

// Popup drag functionality / 弹窗拖动功能
// v0.9.19: Add draggable support for statistics popup
// v0.9.19: 为统计弹窗添加可拖动支持
let popupDragState = {
    isDragging: false,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
    currentScale: 1
};

const popupDragHandle = document.getElementById('popup-drag-handle');
if (popupDragHandle && statsPopup) {
    // --- Mouse Drag Support ---
    popupDragHandle.addEventListener('mousedown', (e) => {
        // Only start drag if clicking on header, not on buttons
        // 仅在点击标题时开始拖动，不在按钮上
        if (e.target.closest('button')) return;
        
        popupDragState.isDragging = true;
        popupDragState.startX = e.clientX;
        popupDragState.startY = e.clientY;
        
        const rect = statsPopup.getBoundingClientRect();
        popupDragState.startLeft = rect.left;
        popupDragState.startTop = rect.top;
        
        statsPopup.classList.add('dragging');
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!popupDragState.isDragging) return;
        
        const deltaX = e.clientX - popupDragState.startX;
        const deltaY = e.clientY - popupDragState.startY;
        
        const newLeft = popupDragState.startLeft + deltaX;
        const newTop = popupDragState.startTop + deltaY;
        
        // Update position / 更新位置
        statsPopup.style.left = `${newLeft}px`;
        statsPopup.style.top = `${newTop}px`;
        statsPopup.style.right = 'auto'; // Remove default right positioning
        
        e.preventDefault();
    });

    document.addEventListener('mouseup', () => {
        if (popupDragState.isDragging) {
            popupDragState.isDragging = false;
            statsPopup.classList.remove('dragging');
        }
    });

    // --- Touch Drag Support (Mobile) ---
    popupDragHandle.addEventListener('touchstart', (e) => {
        if (e.target.closest('button')) return;
        if (e.touches.length !== 1) return; // Single finger for drag
        
        popupDragState.isDragging = true;
        popupDragState.startX = e.touches[0].clientX;
        popupDragState.startY = e.touches[0].clientY;
        
        const rect = statsPopup.getBoundingClientRect();
        popupDragState.startLeft = rect.left;
        popupDragState.startTop = rect.top;
        
        statsPopup.classList.add('dragging');
        e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
        if (!popupDragState.isDragging) return;
        if (e.touches.length !== 1) return;
        
        const deltaX = e.touches[0].clientX - popupDragState.startX;
        const deltaY = e.touches[0].clientY - popupDragState.startY;
        
        const newLeft = popupDragState.startLeft + deltaX;
        const newTop = popupDragState.startTop + deltaY;
        
        statsPopup.style.left = `${newLeft}px`;
        statsPopup.style.top = `${newTop}px`;
        statsPopup.style.right = 'auto';
        
        e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchend', () => {
        if (popupDragState.isDragging) {
            popupDragState.isDragging = false;
            statsPopup.classList.remove('dragging');
        }
    });

    // --- Pinch to Zoom Support (Mobile) ---
    let pinchState = {
        isPinching: false,
        startDist: 0,
        startScale: 1
    };

    statsPopup.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            // Two fingers detected - Start Pinch
            pinchState.isPinching = true;
            pinchState.startDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            pinchState.startScale = popupDragState.currentScale;
            e.preventDefault(); // Prevent default browser zoom
        }
    }, { passive: false });

    statsPopup.addEventListener('touchmove', (e) => {
        if (pinchState.isPinching && e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            
            if (pinchState.startDist > 0) {
                const scaleDiff = dist / pinchState.startDist;
                let newScale = pinchState.startScale * scaleDiff;
                
                // Clamp scale between 0.5 and 2.0
                newScale = Math.max(0.5, Math.min(2.0, newScale));
                
                popupDragState.currentScale = newScale;
                
                // Apply Scale
                const content = statsPopup.querySelector('.popup-content');
                if (content) {
                    content.style.fontSize = `${newScale}rem`;
                }
            }
            e.preventDefault();
        }
    }, { passive: false });

    statsPopup.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
            pinchState.isPinching = false;
        }
    });
}

// Popup zoom functionality / 弹窗缩放功能
// v0.9.19: Add zoom controls for statistics popup
// v0.9.19: 为统计弹窗添加缩放控制
const popupZoomIn = document.getElementById('popup-zoom-in');
const popupZoomOut = document.getElementById('popup-zoom-out');
const popupResetSize = document.getElementById('popup-reset-size');

if (popupZoomIn && popupZoomOut && popupResetSize && statsPopup) {
    popupZoomIn.addEventListener('click', () => {
        popupDragState.currentScale = Math.min(popupDragState.currentScale + 0.1, 2.0);
        applyPopupZoom();
    });
    
    popupZoomOut.addEventListener('click', () => {
        popupDragState.currentScale = Math.max(popupDragState.currentScale - 0.1, 0.5);
        applyPopupZoom();
    });
    
    popupResetSize.addEventListener('click', () => {
        popupDragState.currentScale = 1.0;
        applyPopupZoom();
        // Also reset size if manually resized / 如果手动调整了大小也重置
        statsPopup.style.width = '280px';
        statsPopup.style.height = 'auto';
    });
    
    function applyPopupZoom() {
        const content = statsPopup.querySelector('.popup-content');
        if (content) {
            content.style.fontSize = `${popupDragState.currentScale}rem`;
        }
    }
}

// Close button handler / 关闭按钮处理器
if (popupCloseBtn) {
    popupCloseBtn.addEventListener('click', () => {
        if (statsPopup) {
            statsPopup.style.display = 'none';
            // Reset position to default / 重置位置到默认
            statsPopup.style.left = 'auto';
            statsPopup.style.right = '20px';
            statsPopup.style.top = '80px';
        }
        
        // Clear highlight using highlightManager
        // 使用highlightManager清除高亮
        if (window.highlightManager) {
            window.highlightManager.unhighlight({ force: true });
        }
    });
}

function showNodePopup(nodeId) {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !statsPopup) return;

    // Populate Data
    document.getElementById('popup-node-name').innerText = node.label;
    document.getElementById('popup-in-count').innerText = node.inDegree;
    document.getElementById('popup-out-count').innerText = node.outDegree;

    // Find Edges
    const inList = document.getElementById('popup-in-list');
    const outList = document.getElementById('popup-out-list');
    inList.innerHTML = '';
    outList.innerHTML = '';

    const inNeighbors = [...new Set(links.filter(l => l.target.id === nodeId).map(l => l.source))];
    const outNeighbors = [...new Set(links.filter(l => l.source.id === nodeId).map(l => l.target))];

    const createItem = (n) => {
        const li = document.createElement('li');
        li.innerText = n.label;
        li.title = n.label; // Tooltip for long names
        li.addEventListener('click', (e) => {
            // Navigate to neighbor
            e.stopPropagation(); // Prevent background click
            handleSingleClick(e, n); // Recursively show stats for neighbor
        });
        return li;
    };

    inNeighbors.forEach(n => inList.appendChild(createItem(n)));
    outNeighbors.forEach(n => outList.appendChild(createItem(n)));

    // Show Popup
    statsPopup.style.display = 'flex';
}



// v0.9.31: Simulation Optimization (Viewport Culling)
// v0.9.31: 模拟优化 (视口剔除)
function checkSimulationState() {
    // Only apply optimization in standard force layout mode
    const layoutMode = document.querySelector('input[name="layoutMode"]:checked').value;
    if (layoutMode !== 'force' || focusNode) return;

    const transform = d3.zoomTransform(svg.node());
    const scale = transform.k;
    
    // 1. Full View Freeze
    // If zoomed out enough to see everything (approximate), freeze simulation
    // 如果缩小到足以看到所有内容（近似值），冻结模拟
    // Assuming initial scale 1 fits mostly. scale < 0.4 is definitely "bird's eye view".
    // v0.9.35: Relaxed threshold to 0.1 per user request
    if (scale < 0.1) {
        simulation.stop();
        return;
    }

    // 2. Off-screen Freezing
    // Calculate visible bounds in simulation coordinates
    // 计算模拟坐标中的可见边界
    const visibleWidth = width / scale;
    const visibleHeight = height / scale;
    const visibleX = -transform.x / scale;
    const visibleY = -transform.y / scale;
    
    // Add buffer (e.g., 800px visual range)
    // v0.9.35: Dynamic buffer based on scale ("fixed range extending outward")
    const buffer = 800 / scale;
    const minX = visibleX - buffer;
    const maxX = visibleX + visibleWidth + buffer;
    const minY = visibleY - buffer;
    const maxY = visibleY + visibleHeight + buffer;

    // Filter nodes: Active if inside bounds OR connected to someone inside bounds (to keep edges moving correctly)
    // 过滤节点：如果在边界内或连接到边界内的人（以保持边缘正确移动），则为活动
    // Simplified: Just check node position for now.
    
    let activeCount = 0;
    simulation.nodes().forEach(d => {
        const isVisible = d.x >= minX && d.x <= maxX && d.y >= minY && d.y <= maxY;
        if (isVisible) {
            d.isCulled = false;
            // Only unlock if NOT dragging and NOT globally frozen
            // 仅在未拖动且未全局冻结时解锁
            // Actually, we should just clear fx/fy if it was set by culling. 
            // If it was set by Drag, isDragging protects it? 
            // Drag sets fx/fy. We must NOT clear it if dragging.
            if (!d.isDragging && !focusNode) {
                 d.fx = null;
                 d.fy = null;
            }
            activeCount++;
        } else {
            d.isCulled = true;
            // Freeze if off-screen (and not manually dragged)
            // 如果在屏幕外（且未手动拖动），则冻结
            if (!d.isDragging) {
                d.fx = d.x;
                d.fy = d.y;
            }
        }
    });

    // If active nodes exist, ensure simulation is running
    // 如果存在活动节点，请确保模拟正在运行
    // But check global freeze first
    const isGlobalFrozen = document.getElementById('freeze-layout') ? document.getElementById('freeze-layout').checked : false;
    if (!isGlobalFrozen && activeCount > 0) {
        simulation.alphaTarget(0.3).restart();
    } else if (activeCount === 0) {
        simulation.stop();
    }
}

// Simulation Tick
function ticked() {
    const renderer = document.querySelector('input[name="rendererMode"]:checked').value;
    const layoutMode = document.querySelector('input[name="layoutMode"]:checked').value;

    // v0.9.31: Continuous check (optional, can be expensive, maybe just on zoom is enough?)
    // Actually, checking every tick is expensive. Let's rely on Zoom event + occasional checks.
    // But if nodes move INTO view, they need to wake up.
    // Ideally, we run checkSimulationState periodically or if alpha is high.
    // For now, let's keep it lightweight and rely on Zoom event + Drag.
    // If we want accurate "wake up on move", we'd need to check bounds here.
    // To satisfy requirement "particles within range move, others frozen", we need to update it.
    // Let's add a throttle or check only every N ticks.
    if (simulation.alpha() > 0.05) { // Only check if simulation is active enough
         // We can't call it every tick efficiently.
         // Let's assume nodes don't move drastically fast out of view.
    }

    if (renderer === 'svg') {
        // SVG Update Logic
        if (layoutMode === 'dag') {
            link.attr("d", d => {
                const sx = d.source.x;
                const sy = d.source.y;
                const tx = d.target.x;
                const ty = d.target.y;
                return `M${sx},${sy} C${sx},${(sy + ty) / 2} ${tx},${(sy + ty) / 2} ${tx},${ty}`;
            });
        } else {
            link.attr("d", d => `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`);
        }
        node.filter(d => !d.isCulled).attr("transform", d => `translate(${d.x},${d.y})`);
    } else {
        // Canvas Update Logic
        renderCanvas(layoutMode);
    }
}

function renderCanvas(layoutMode) {
    if (!ctx) return; // Canvas context missing
    
    try {
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Apply Zoom/Pan
        ctx.translate(currentTransform.x, currentTransform.y);
        ctx.scale(currentTransform.k, currentTransform.k);

        // Get highlight state from highlightManager
        // 从highlightManager获取高亮状态
        const highlightState = window.highlightManager ? window.highlightManager.getState() : null;
        const highlightConnections = highlightState && highlightState.currentNode ? 
            window.highlightManager.getCurrentConnections() : null;

        // v0.9.67: Compact Mode Optimization
        // If Compact Mode is ON, and we are NOT highlighting/focusing, skip edge iteration entirely.
        // This saves iterating 1.2M items per frame.
        const isCompact = window.settingsManager ? window.settingsManager.get('performance', 'compactMode') : false;
        
        // v0.9.72: Extreme Scale Constraint
        // "When the number of nodes or edges becomes excessive (exceeding 10,000 nodes or 1,000,000 edges), 
        // edges shall never be rendered in the frontend display (even when a node is selected on the canvas)."
        const isExtremeScale = nodes.length > 10000 || links.length > 1000000;
        
        const shouldRenderEdges = !isExtremeScale && (!isCompact || focusNode || highlightConnections);

        // Draw Links / 绘制连接
        ctx.lineWidth = 1;

        if (shouldRenderEdges) {
            links.forEach(d => {
                // Check Visibility / 检查可见性
                // 1. Focus Mode / 专注模式
                if (focusNode) {
                    // v0.9.46: Do not display any edges in Focus Mode under Canvas
                    return; 
                } 
                // 2. Highlight Mode (using highlightManager) / 高亮模式（使用highlightManager）
                else if (highlightConnections) {
                    const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
                    const targetId = typeof d.target === 'object' ? d.target.id : d.target;
                    const currentNodeId = highlightState.currentNode.id;
                    
                    if (sourceId === currentNodeId) {
                        // Outgoing edge / 出度边
                        ctx.globalAlpha = 1;
                        ctx.strokeStyle = "#4488ff"; // Blue for outgoing / 蓝色表示出度
                        ctx.lineWidth = 2.5;
                    } else if (targetId === currentNodeId) {
                        // Incoming edge / 入度边
                        ctx.globalAlpha = 1;
                        ctx.strokeStyle = "#ff6b6b"; // Red for incoming / 红色表示入度
                        ctx.lineWidth = 2.5;
                    } else {
                        return; // Hide others / 隐藏其他
                    }
                }
                else {
                    // Default Mode (No Highlight/Focus)
                    // If Compact Mode is ON, we shouldn't be here (guarded by shouldRenderEdges).
                    // But if we are here, it means we are in Normal Mode.
                    // In Normal Mode, edges are default hidden (return) unless some logic changes?
                    // Existing logic: "else { return; // Default Hidden }"
                    // So edges were ALREADY hidden by default in Canvas.
                    return; // Default Hidden / 默认隐藏
                }
        
                ctx.beginPath();
                if (layoutMode === 'dag') {
                    const sx = d.source.x;
                    const sy = d.source.y;
                    const tx = d.target.x;
                    const ty = d.target.y;
                    const cp1x = sx;
                    const cp1y = (sy + ty) / 2;
                    const cp2x = tx;
                    const cp2y = (sy + ty) / 2;
                    ctx.moveTo(sx, sy);
                    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, tx, ty);
                } else {
                    ctx.moveTo(d.source.x, d.source.y);
                    ctx.lineTo(d.target.x, d.target.y);
                }
                ctx.stroke();
            });
        }

        // Draw Nodes / 绘制节点
        nodes.forEach(d => {
            if (!isNodeVisible(d)) return;

            // Determine if this node should be dimmed / 确定节点是否应变暗
            const isHighlightedNode = highlightState && highlightState.currentNode && 
                highlightState.currentNode.id === d.id;
            const isFocus = focusNode && focusNode.id === d.id;
            const isConnected = highlightConnections && highlightConnections.nodeIds.has(d.id);
            const shouldDim = highlightState && highlightState.currentNode && !isConnected && !focusNode;

            // Set opacity for dimming effect / 设置变暗效果的透明度
            ctx.globalAlpha = shouldDim ? 0.05 : 1;

            ctx.beginPath();
            
            // v0.9.45: Fix Canvas Node Sizing to match SVG
            let r = 5;
            const sizeMode = document.querySelector('input[name="sizeMode"]:checked') ? document.querySelector('input[name="sizeMode"]:checked').value : 'uniform';
            
            if (isFocus) {
                r = 25;
            } else if (sizeMode === 'centrality') {
                r = sizeScaleCentrality(d.centrality || 0);
            } else if (sizeMode === 'degree') {
                // Re-calculate or use scale. We need the scale defined earlier.
                // sizeScaleDegree is local to updateSize(). We need to expose it or recreate it.
                // Recreating is cheap.
                const maxDeg = d3.max(nodes, n => (n.inDegree||0) + (n.outDegree||0)) || 1;
                const s = d3.scaleSqrt().domain([0, maxDeg]).range([3, 12]);
                const deg = (d.inDegree||0) + (d.outDegree||0); // Simplification: using Total degree for sizing usually
                r = s(deg);
            } else {
                r = 5;
            }

            if (isHighlightedNode) r += 2; // Slight enlarge on highlight / 高亮时略微放大

            ctx.arc(d.x, d.y, r, 0, 2 * Math.PI);
            
            // Color / 颜色
            if (isFocus) {
                ctx.fillStyle = "#ffd700";
            } else if (isHighlightedNode) {
                ctx.fillStyle = "#ffaa00";
            } else {
                 const mode = document.querySelector('input[name="colorMode"]:checked').value;
                 if (mode === 'cluster') ctx.fillStyle = colorScaleCluster(d.clusterId || 'unknown');
                 else ctx.fillStyle = colorScaleDegree(getDegree(d));
            }

            ctx.fill();
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Label - only show if not dimmed or if important / 标签 - 仅在未变暗或重要时显示
            if (!shouldDim && (isFocus || isHighlightedNode || currentTransform.k > 1.2)) {
                ctx.globalAlpha = 1;
                ctx.fillStyle = "#ccc";
                ctx.font = isFocus ? "bold 16px Sans-Serif" : "10px Sans-Serif";
                // v0.9.47: Use custom offset if set (for Focus Mode Vertical Layout)
                const labelDx = d._labelDx !== undefined ? d._labelDx : 8;
                ctx.fillText(d.label, d.x + labelDx, d.y + 4);
            }
        });

        // Draw Focus Labels (Canvas) / 绘制专注标签（Canvas）
        if (focusNode && window.focusLabels) {
            ctx.save();
            ctx.font = "bold 16px Segoe UI";
            ctx.fillStyle = "#61dafb";
            ctx.textAlign = "center";
            ctx.shadowColor = "rgba(0,0,0,0.8)";
            ctx.shadowBlur = 4;
            
            window.focusLabels.forEach(lbl => {
                ctx.fillText(lbl.text, lbl.x, lbl.y);
            });
            ctx.restore();
        }

        ctx.restore();
    } catch (e) {
        console.error("Canvas Render Error:", e);
    }
}

// Canvas Setup / Canvas设置
const canvas = document.getElementById('graph-canvas');
const ctx = canvas.getContext('2d');
let currentTransform = d3.zoomIdentity;

// Resize Canvas / 调整Canvas大小
function resizeCanvas() {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    
    // v0.9.78: Fix Analysis stability - Guard against simulation restart/movement
    const isFrozen = document.getElementById('freeze-layout') ? document.getElementById('freeze-layout').checked : false;
    if (isFrozen) {
        simulation.stop();
    }

    if (document.querySelector('input[name="rendererMode"]:checked').value === 'canvas') {
        ticked();
    }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Canvas Zoom / Canvas缩放
d3.select(canvas).call(d3.zoom()
    .scaleExtent([0.1, 8])
    .filter(function(event) {
        // v0.9.47: Prevent double-click zoom if clicking on a node (to allow Focus Mode)
        if (event.type === 'dblclick') {
            const rect = canvas.getBoundingClientRect();
            // findNodeAt might not be hoisted/available if defined below. 
            // However, function declarations are hoisted. 
            // We need to ensure 'currentTransform' is available. It is defined above.
            const node = findNodeAt(event.clientX - rect.left, event.clientY - rect.top);
            if (node) return false;
        }
        return !event.ctrlKey && !event.button; // Default filter: no ctrl, left button only
    })
    .on("zoom", (event) => {
        currentTransform = event.transform;
        ticked();
    }));

// v0.9.45: Canvas Interactivity
function findNodeAt(x, y) {
    const tx = (x - currentTransform.x) / currentTransform.k;
    const ty = (y - currentTransform.y) / currentTransform.k;
    
    // Search radius: constant 10px visual, converted to simulation space
    const searchRadius = 15 / currentTransform.k; 
    let closest = null;
    let minDist = Infinity;

    for (const n of nodes) {
        if (!isNodeVisible(n)) continue;
        
        // Approximate hit test
        const dist = (n.x - tx) ** 2 + (n.y - ty) ** 2;
        // Use squared distance for performance
        // Check against searchRadius^2 + nodeRadius^2 estimate
        // Simple radius check:
        const r = 10; // Avg node radius
        const threshold = (r + searchRadius) ** 2;
        
        if (dist < threshold && dist < minDist) {
            minDist = dist;
            closest = n;
        }
    }
    return closest;
}

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const node = findNodeAt(e.clientX - rect.left, e.clientY - rect.top);
    
    if (node) {
        canvas.style.cursor = 'pointer';
        const state = highlightManager.getState();
        // Only highlight if not frozen (or if we want to allow hover highlight in frozen state too?)
        // SVG Logic: node.on("mouseover", ...) checks !state.isFrozen && !focusModeState.active
        if (!state.isFrozen && !focusModeState.active) {
             highlightManager.highlight(node, { event: e });
        }
    } else {
        canvas.style.cursor = 'default';
        const state = highlightManager.getState();
        if (!state.isFrozen && !focusModeState.active) {
             highlightManager.unhighlight();
        }
    }
});

canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const node = findNodeAt(e.clientX - rect.left, e.clientY - rect.top);
    
    if (node) {
        if (clickTimer) {
            clearTimeout(clickTimer);
            clickTimer = null;
            // Double Click
            handleDoubleClick(e, node);
        } else {
            clickTimer = setTimeout(() => {
                clickTimer = null;
                // Single Click
                handleSingleClick(e, node);
            }, 250);
        }
    } else {
        // Background Click
        if (!focusNode && window.highlightManager) {
             const state = window.highlightManager.getState();
             if (state.isFrozen || state.currentNode) {
                 window.highlightManager.unhighlight({ force: true });
                 const popup = document.getElementById('node-stats-popup');
                 if (popup) popup.style.display = 'none';
             }
        }
    }
});

// simulation.on("tick", ticked); // Handled via worker message

// Renderer Toggle
document.querySelectorAll('input[name="rendererMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const mode = e.target.value;
        if (mode === 'canvas') {
            document.querySelector('#graph-container svg').style.display = 'none';
            canvas.style.display = 'block';
            ticked();
        } else {
            document.querySelector('#graph-container svg').style.display = 'block';
            canvas.style.display = 'none';
            // Sync zoom state
            g.attr("transform", currentTransform);
            ticked();
        }
    });
});

// Controls & Filtering
// Controls object moved to top (v0.9.69) to fix initialization race condition.

if (controls.minDegree) controls.minDegree.addEventListener('input', updateVisibility);
if (controls.showOrphans) controls.showOrphans.addEventListener('change', updateVisibility);
if (controls.search) controls.search.addEventListener('input', updateVisibility);
if (controls.export) controls.export.addEventListener('click', exportSVG);

// Mobile: Toggle Controls Panel
const controlsPanel = document.getElementById('controls');
if (controlsPanel) {
    controlsPanel.addEventListener('click', (e) => {
        // Only toggle if strictly clicking the container (or the hamburger icon background)
        // AND screen is small (checked via class or simple width check, but let's just toggle 'expanded' class)
        // But we must NOT toggle if clicking an input/button inside
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'LABEL' || e.target.tagName === 'SELECT') {
            return;
        }
        
        // If it's already expanded, and we clicked "empty space" inside, we might want to keep it open.
        // The requirement is to make it usable. A simple toggle on the "header" or just the container when collapsed is best.
        // Since we hid children with opacity 0 when collapsed, clicking 'controls' when collapsed hits the div.
        
        if (!controlsPanel.classList.contains('expanded')) {
            controlsPanel.classList.add('expanded');
        } else {
            // If clicking the header h3, toggle close?
            if (e.target.tagName === 'H3' || e.target === controlsPanel) {
               controlsPanel.classList.remove('expanded');
            }
        }
    });
}

// Label Opacity Control
const labelOpacitySlider = document.getElementById('label-opacity-slider');
const labelOpacityVal = document.getElementById('label-opacity-val');

if (labelOpacitySlider && labelOpacityVal) {
    labelOpacitySlider.addEventListener('input', (e) => {
        const val = e.target.value;
        labelOpacityVal.innerText = val + '%';
        texts.style("opacity", val / 100);
    });
}

function isNodeVisible(d) {
    if (focusNode) {
        // In Focus Mode, visibility is controlled by the enterFocusMode logic setting classes or explicit styles.
        // However, updateVisibility() is called by mouseout and controls.
        // We should respect the 'focus-visible' flag if we use one, OR check against the focus set.
        // To keep it simple and robust: If focusNode is set, we let enterFocusMode handle opacity.
        // But wait, updateVisibility resets opacity.
        // So we need logic here:
        if (d.id === focusNode.id) return true;
        if (d.isFocusVisible) return true; // We will tag nodes in enterFocusMode
        return false;
    }

    // v0.9.69 Fix: Guard against controls not being ready
    if (!controls || !controls.minDegree) return true;

    const minDegree = parseInt(controls.minDegree.value);
    const showOrphans = controls.showOrphans.checked;
    const term = controls.search.value.toLowerCase();
    
    const degree = d.inDegree + d.outDegree;
    const matchesDegree = degree >= minDegree;
    const isOrphan = degree === 0;
    const allowedOrphan = !isOrphan || showOrphans;
    const matchesSearch = !term || d.label.toLowerCase().includes(term);
    
    // Check Cluster Filter
    const matchesCluster = activeClusterFilter === 'all' || (d.clusterId === activeClusterFilter);

    return matchesDegree && allowedOrphan && matchesSearch && matchesCluster;
}

function updateVisibility() {
    const minVal = controls.minDegree.value;
    document.getElementById('min-degree-val').innerText = minVal;

    // Check highlight state from highlightManager
    // 从highlightManager检查高亮状态
    const highlightState = window.highlightManager ? window.highlightManager.getState() : null;
    const isHighlighting = highlightState && highlightState.currentNode;

    // Don't reset opacity if we're in highlighting mode
    // 如果在高亮模式中则不重置透明度
    if (!isHighlighting) {
        node.style("opacity", d => isNodeVisible(d) ? 1 : 0.1)
            .style("pointer-events", d => isNodeVisible(d) ? "all" : "none");

        link.style("opacity", d => {
            // If in Focus Mode, show connections to focus node
            if (focusNode) {
                const isConnected = d.source.id === focusNode.id || d.target.id === focusNode.id;
                const sourceVis = isNodeVisible(d.source);
                const targetVis = isNodeVisible(d.target);
                return (sourceVis && targetVis) ? 0.6 : 0;
            }
            
            // Default Mode: Show edges with low opacity
            // Hover/click will increase opacity to 1 for highlighted edges
            return 0; 
        });
    }
}

function exportSVG() {
    const svgEl = document.querySelector("#graph-container svg");
    
    // 1. Clone the SVG to manipulate it without affecting the UI
    const clone = svgEl.cloneNode(true);
    
    // 2. Add Background Rect
    const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("width", "100%");
    bgRect.setAttribute("height", "100%");
    bgRect.setAttribute("fill", "#1e1e1e"); // Match body background
    clone.insertBefore(bgRect, clone.firstChild);

    // 3. Inline Computed Styles for Nodes and Links
    // We need to match elements in clone with original to get computed styles
    const originalNodes = svgEl.querySelectorAll('.node circle, .node text');
    const cloneNodes = clone.querySelectorAll('.node circle, .node text');
    
    originalNodes.forEach((orig, i) => {
        const cl = cloneNodes[i];
        const style = window.getComputedStyle(orig);
        cl.setAttribute("fill", style.fill);
        cl.setAttribute("stroke", style.stroke);
        cl.setAttribute("stroke-width", style.strokeWidth);
        cl.setAttribute("opacity", style.opacity);
        cl.setAttribute("font-size", style.fontSize);
        cl.setAttribute("font-family", style.fontFamily);
    });

    const originalLinks = svgEl.querySelectorAll('.link');
    const cloneLinks = clone.querySelectorAll('.link');
    
    originalLinks.forEach((orig, i) => {
        const cl = cloneLinks[i];
        const style = window.getComputedStyle(orig);
        cl.setAttribute("stroke", style.stroke);
        cl.setAttribute("stroke-width", style.strokeWidth);
        cl.setAttribute("stroke-opacity", style.strokeOpacity);
        cl.setAttribute("fill", "none"); // Links shouldn't have fill
    });

    // 4. Serialize
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(clone);

    // Add namespaces if missing
    if(!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if(!source.match(/^<svg[^>]+\"http\:\/\/www\.w3\.org\/1999\/xlink"/)){
        source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }

    const preamble = '<?xml version="1.0" standalone="no"?>\r\n';
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(preamble + source);
    
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = "note_connection_graph.svg";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

// Save Layout
document.getElementById('save-layout-btn').addEventListener('click', saveLayout);

function saveLayout() {
    const layoutData = nodes.map(n => ({
        id: n.id,
        x: Math.round(n.x),
        y: Math.round(n.y)
    }));

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(layoutData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "layout.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

// Drag functions
// Drag functions
function dragstarted(event, d) {
  d.isDragging = true; 
  const isFrozen = document.getElementById('freeze-layout') ? document.getElementById('freeze-layout').checked : false;
  
  // v0.9.79: Allow manual drag in Focus Mode (No Physics)
  if (focusNode) {
      d.fx = d.x; d.fy = d.y; // Lock position
      return; 
  }
  
  if (isFrozen) return; 

  // Notify Worker
  simulationWorker.postMessage({ type: 'dragStart', payload: { id: d.id, x: d.x, y: d.y, active: event.active } });
  
  // Local Update (for instant feedback before tick)
  d.fx = d.x;
  d.fy = d.y;
}

function dragged(event, d) {
  const isFrozen = document.getElementById('freeze-layout') ? document.getElementById('freeze-layout').checked : false;
  
   // v0.9.79: Allow manual drag in Focus Mode (No Physics)
  if (focusNode) {
      if (!d.isDragging) return;
      // Manually update position
      d.x = event.x; d.y = event.y;
      d.fx = event.x; d.fy = event.y;
      ticked(); // Force render
      return;
  }

  if (isFrozen) return;

  // Notify Worker
  simulationWorker.postMessage({ type: 'drag', payload: { id: d.id, x: event.x, y: event.y, active: event.active } });
  
  // Local Update
  d.fx = event.x;
  d.fy = event.y;
}

function dragended(event, d) {
  d.isDragging = false; 
  const isFrozen = document.getElementById('freeze-layout') ? document.getElementById('freeze-layout').checked : false;
  
   // v0.9.79: Focus Mode Drag End
  if (focusNode) {
      // Keep fixed (fx/fy already set in dragged)
      return;
  }

  if (isFrozen) return;

  const shouldClear = !focusNode && !isFrozen; // Standard logic

  // Notify Worker
  simulationWorker.postMessage({ 
      type: 'dragEnd', 
      payload: { 
          id: d.id, 
          x: event.x, 
          y: event.y, 
          active: event.active,
          shouldClear: shouldClear 
      } 
  });
  
  if (shouldClear) {
        d.fx = null;
        d.fy = null;
  }
}

// Old click listener removed.
// Focus Mode Logic
// v0.9.44: Independent spacing settings for Horizontal/Vertical layouts
const focusSpacingSettings = {
    horizontal: { layer: 125, node: 80 }, // Layer 1/2 of original (250->125)
    vertical: { layer: 250, node: 20 }    // Node 1/4 of original (80->20)
};

const focusSpacingSlider = document.getElementById('focus-spacing-slider');
const focusHSpacingSlider = document.getElementById('focus-h-spacing-slider');
const focusLayoutSelect = document.getElementById('focus-layout-select');

document.getElementById('btn-exit-focus').addEventListener('click', exitFocusMode);
document.getElementById('btn-open-content').addEventListener('click', () => {
    if (focusNode && window.reader) {
        window.reader.open(focusNode);
    }
});

document.getElementById('btn-reset-focus-layout').addEventListener('click', () => {
    const mode = focusLayoutSelect.value;
    // Reset to defaults
    if (mode === 'horizontal') {
        focusSpacingSettings.horizontal.layer = 125;
        focusSpacingSettings.horizontal.node = 80;
    } else {
        focusSpacingSettings.vertical.layer = 250;
        focusSpacingSettings.vertical.node = 20;
    }
    
    // Update UI
    focusSpacingSlider.value = focusSpacingSettings[mode].layer;
    focusHSpacingSlider.value = focusSpacingSettings[mode].node;
    
    // Refresh
    if (focusNode) enterFocusMode(focusNode);
});

// Update Settings on Slider Change
focusSpacingSlider.addEventListener('input', (e) => {
    const mode = focusLayoutSelect.value;
    focusSpacingSettings[mode].layer = parseInt(e.target.value);
    if (focusNode) enterFocusMode(focusNode);
});

focusHSpacingSlider.addEventListener('input', (e) => {
    const mode = focusLayoutSelect.value;
    focusSpacingSettings[mode].node = parseInt(e.target.value);
    if (focusNode) enterFocusMode(focusNode);
});

// Sync Sliders on Layout Change
focusLayoutSelect.addEventListener('change', () => {
    const mode = focusLayoutSelect.value;
    // Update UI controls to match stored settings
    focusSpacingSlider.value = focusSpacingSettings[mode].layer;
    focusHSpacingSlider.value = focusSpacingSettings[mode].node;
    
    if (focusNode) enterFocusMode(focusNode);
});
      
      
// Helper to expose highlightNode for external modules (like Analysis)
// 为外部模块（如Analysis）公开highlightNode
window.highlightNode = function(id) {
    const d = nodes.find(n => n.id === id);
    if (d && window.highlightManager) {
        // Requirement: Clicking in Analysis should have SAME effect as clicking in graph.
        // Graph click triggers: highlight(freeze=true) AND showNodePopup.
        
        // 1. Clear previous highlight to ensure we can switch nodes
        // (If previous was frozen, highlight() would block switching otherwise)
        window.highlightManager.unhighlight({ force: true });
        
        // 2. Highlight with freeze option
        window.highlightManager.highlight(d, { freeze: true });
        
        // 3. Show Popup
        showNodePopup(id);
    }
};

// Helper to expose focusOnNode for external modules
// 为外部模块公开focusOnNode
window.focusOnNode = function(id) {
    const d = nodes.find(n => n.id === id);
    if (d) {
        // Reuse double click logic or call enterFocusMode directly
        // Clear highlight first
        if (window.highlightManager) {
            window.highlightManager.unhighlight({ force: true });
        }
        
        // Hide popup
        const popup = document.getElementById('node-stats-popup');
        if (popup) popup.style.display = 'none';

        // Enter Focus Mode
        enterFocusMode(d);
    }
};



// --- Query History Implementation (v0.9.77) ---
window.focusHistory = [];
const MAX_HISTORY = 10;

function updateFocusHistory(newNode) {
    // Avoid duplicates: Remove if exists, then add to top
    // Requirement: "pin the corresponding node to the top"
    window.focusHistory = window.focusHistory.filter(n => n.id !== newNode.id);
    
    // Add to specific history list
    window.focusHistory.unshift(newNode);
    if (window.focusHistory.length > MAX_HISTORY) window.focusHistory.pop();
    
    renderFocusHistory();
}

function renderFocusHistory() {
    const container = document.getElementById('focus-history-list');
    if (!container) return; // Should be created by init
    
    container.innerHTML = '';
    
    if (window.focusHistory.length === 0) {
        container.innerHTML = '<div style="padding:5px; color:#aaa; font-style:italic">No history</div>';
        return;
    }

    window.focusHistory.forEach(node => {
        const item = document.createElement('div');
        item.style.padding = '4px 8px';
        item.style.cursor = 'pointer';
        item.style.borderBottom = '1px solid #444';
        item.style.fontSize = '0.8rem';
        item.style.color = '#eee';
        item.innerText = node.label;
        item.title = `Cluster: ${node.clusterId || '-'}`;
        
        item.addEventListener('mouseenter', () => item.style.background = '#444');
        item.addEventListener('mouseleave', () => item.style.background = '');
        
        item.addEventListener('click', (e) => {
             e.stopPropagation(); // prevent closing dropdown immediately?
             // Close dropdown handled by global click?
             document.getElementById('focus-history-dropdown').style.display = 'none';
             enterFocusMode(node);
        });
        
        container.appendChild(item);
    });
}

// Inject History UI
function initFocusHistoryUI() {
    const parent = document.getElementById('focus-exit-btn');
    if (!parent || document.getElementById('btn-focus-history')) return;

    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.marginRight = '5px';

    const btn = document.createElement('button');
    btn.id = 'btn-focus-history';
    btn.innerText = 'History ▼';
    btn.style.fontSize = '0.8rem';
    btn.style.padding = '2px 6px';
    btn.style.cursor = 'pointer';
    
    const dropdown = document.createElement('div');
    dropdown.id = 'focus-history-dropdown';
    dropdown.style.display = 'none';
    dropdown.style.position = 'absolute';
    dropdown.style.top = '100%';
    dropdown.style.left = '0';
    dropdown.style.background = '#222';
    dropdown.style.border = '1px solid #555';
    dropdown.style.zIndex = '2000';
    dropdown.style.minWidth = '150px';
    dropdown.style.maxHeight = '300px';
    dropdown.style.overflowY = 'auto';
    dropdown.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';

    const list = document.createElement('div');
    list.id = 'focus-history-list';
    
    dropdown.appendChild(list);
    wrapper.appendChild(btn);
    wrapper.appendChild(dropdown);
    
    // Insert before 'Specific Content' button
    const neighbor = document.getElementById('btn-open-content');
    if (neighbor) {
        parent.insertBefore(wrapper, neighbor);
    } else {
        parent.appendChild(wrapper);
    }

    // Toggle Logic
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = dropdown.style.display === 'block';
        dropdown.style.display = isVisible ? 'none' : 'block';
    });
    
    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

// Ensure init happens
initFocusHistoryUI();

function enterFocusMode(focusD) {
    // Backup original positions to ensure layout consistency upon exit (v0.9.30)
    // 备份原始位置以确保退出时布局一致
    nodes.forEach(n => {
        // Only backup if not already backed up (in case of re-entry/nested calls)
        if (n._origX === undefined) {
            n._origX = n.x;
            n._origY = n.y;
            n._origFx = n.fx;
            n._origFy = n.fy;
        }
    });

    // Update focus mode state
    // 更新专注模式状态
    updateFocusModeState(true, focusD);
    
    // v0.9.77: Add to History
    updateFocusHistory(focusD);

    // Update Stats
    document.getElementById('focus-node-stats').innerText = `In: ${focusD.inDegree} | Out: ${focusD.outDegree}`;

    // RESET ALL NODES first to prevent accumulation of visible nodes
    nodes.forEach(n => {
        n.isFocusVisible = false;
        // Optional: Reset fx/fy for cleanliness, but important one is visibility flag
        // We generally want to release nodes that are no longer part of the focus set
        n.fx = null;
        n.fy = null; 
        n._labelDy = null;
    });

    focusNode = focusD;
    
    // 1. UI Updates
    document.getElementById('focus-exit-btn').style.display = 'flex';
    // v0.9.46: Hide main interface settings in Focus Mode
    document.getElementById('source-control').style.display = 'none';
    document.getElementById('controls').style.display = 'none';

    document.getElementById('focus-node-name').innerText = focusD.label;
    // document.getElementById('controls').style.opacity = '0.3'; // Dim controls - Removed as we hide it now
    // document.getElementById('controls').style.pointerEvents = 'none'; // Disable controls - Removed as we hide it now
    
    // 2. Identify Nodes
    const superiors = []; // Outgoing: Focus -> Target (Superior / Further Exploration)
    const subordinates = []; // Incoming: Source -> Focus (Subordinate / Helping to understand)
    
    links.forEach(l => {
        if (l.source.id === focusD.id) superiors.push(l.target);
        if (l.target.id === focusD.id) subordinates.push(l.source);
    });
    
    const uniqueSup = [...new Set(superiors)];
    const uniqueSub = [...new Set(subordinates)];
    
    // 3. Intra-layer Sorting & Scoring
    const getFocusScore = (n) => {
        const edge = links.find(l => 
            (l.source.id === focusD.id && l.target.id === n.id) || 
            (l.target.id === focusD.id && l.source.id === n.id)
        );
        const weight = edge ? (edge.weight || 0.5) : 0.5;
        const degreeRatio = (n.outDegree || 0) / ((n.inDegree || 0) + 1);
        const normRatio = Math.min(degreeRatio, 5) / 5; 
        return (weight * 0.7) + (normRatio * 0.3);
    };

    uniqueSup.forEach(n => n._focusScore = getFocusScore(n));
    uniqueSub.forEach(n => n._focusScore = getFocusScore(n));

    const sortFn = (a, b) => b._focusScore - a._focusScore;
    uniqueSup.sort(sortFn);
    uniqueSub.sort(sortFn);
    
    // 4. Layout Calculation
    // Stop simulation to prevent movement during calculation
    simulationWorker.postMessage({ type: 'stop' });
    
    // Requirement: "central position of this node should be the original position"
    // We use focusD.x / focusD.y as the anchor.
    // If the node hasn't been simulated yet (unlikely), fallback to center.
    const cx = focusD.x || width / 2;
    const cy = focusD.y || height / 2;
    
    // Center the view on this node (Optional, but good UX if we keep original pos)
    // We need to transform the graph so (cx, cy) is at screen center.
    // currentTransform is k, x, y. 
    // We want: newX + cx*k = screenWidth/2
    // newX = screenWidth/2 - cx*k
    // Let's preserve current scale 'k' or zoom in slightly?
    const targetScale = Math.max(1, d3.zoomTransform(svg.node()).k);
    svg.transition().duration(750).call(
        d3.zoom().transform, 
        d3.zoomIdentity.translate(width/2 - cx * targetScale, height/2 - cy * targetScale).scale(targetScale)
    );

    // Get settings
    const layoutType = document.getElementById('focus-layout-select') ? document.getElementById('focus-layout-select').value : 'horizontal';

    // v0.9.44: Sync sliders from stored settings for this mode
    if (typeof focusSpacingSettings !== 'undefined' && focusSpacingSettings[layoutType]) {
        document.getElementById('focus-spacing-slider').value = focusSpacingSettings[layoutType].layer;
        document.getElementById('focus-h-spacing-slider').value = focusSpacingSettings[layoutType].node;
    }

    const layerGap = parseInt(document.getElementById('focus-spacing-slider').value) || 250; 
    const hSpacing = parseInt(document.getElementById('focus-h-spacing-slider').value) || 80;

    // Set Focus Node Fixed Position
    focusD.fx = cx;
    focusD.fy = cy;
    // v0.9.80: Sync internal position to prevent snap-back on drag
    focusD.x = cx;
    focusD.y = cy;
    
    focusD.isFocusVisible = true;
    focusD._labelDy = 35; 
    if (layoutType === 'vertical') focusD._labelDx = 25; 

    // Define Semantic Labels for rendering
    window.focusLabels = [];

    if (layoutType === 'vertical') {
        // Vertical Layout (Left-to-Right structure: Inbound -> Selected -> Outbound)
        // Requirement: "arranged from left to right as 'inbound node - selected node - outbound node'"
        // So: Left = Inbound (Sub), Center = Focus, Right = Outbound (Sup)
        
        const spreadVertical = (nodeList, baselineX) => {
            const count = nodeList.length;
            if (count === 0) return;
            const totalHeight = (count - 1) * hSpacing;
            const startY = cy - totalHeight / 2;
            
            nodeList.forEach((n, i) => {
                n.fx = baselineX;
                n.fy = startY + i * hSpacing;
                // v0.9.80: Sync internal position
                n.x = n.fx; n.y = n.fy;
                
                n.isFocusVisible = true;
                n._labelDy = 25;
                n._labelDx = 25;
            });
        };

        spreadVertical(uniqueSub, cx - layerGap); // Left: Inbound
        spreadVertical(uniqueSup, cx + layerGap); // Right: Outbound

        // Add Labels
        window.focusLabels.push({ text: t("focus_inbound"), x: cx - layerGap, y: cy - (uniqueSub.length * hSpacing / 2) - 40, align: "middle" });
        window.focusLabels.push({ text: t("focus_outbound"), x: cx + layerGap, y: cy - (uniqueSup.length * hSpacing / 2) - 40, align: "middle" });

    } else {
        // Horizontal Layout (Standard / Top-Bottom)
        // Top = Outbound (Sup), Bottom = Inbound (Sub)
        
        const spreadHorizontal = (nodeList, baselineY) => {
            const count = nodeList.length;
            if (count === 0) return;
            const totalWidth = (count - 1) * hSpacing;
            const startX = cx - totalWidth / 2;
            
            nodeList.forEach((n, i) => {
                n.fx = startX + i * hSpacing;
                
                // Stagger
                const stagger = (i % 2 === 0 ? -1 : 1) * 20; 
                const criteriaOffset = (n._focusScore * 20); 
                n.fy = baselineY + stagger + criteriaOffset;
                
                // v0.9.80: Sync internal position
                n.x = n.fx; n.y = n.fy;
                
                n.isFocusVisible = true;
                if (n.fy < baselineY) n._labelDy = -15; else n._labelDy = 25;
            });
        };

        spreadHorizontal(uniqueSup, cy - layerGap); // Top (Outbound)
        spreadHorizontal(uniqueSub, cy + layerGap); // Bottom (Inbound)

        // Labels
        // Top Area (Outbound) -> "Further exploration"
        window.focusLabels.push({ text: t("focus_outbound"), x: cx, y: cy - layerGap - 60, align: "middle" });
        // Bottom Area (Inbound) -> "Helping to understand"
        window.focusLabels.push({ text: t("focus_inbound"), x: cx, y: cy + layerGap + 80, align: "middle" });
    }
    
    // Associated Nodes (Side placement - simplified for now, keep existing logic but adapt to cx/cy)
    const associated = [];
    links.forEach(l => {
        if ((l.source.id === focusD.id || l.target.id === focusD.id) && l.weight > 0.6) { 
             const other = l.source.id === focusD.id ? l.target : l.source;
             if (!uniqueSup.includes(other) && !uniqueSub.includes(other)) {
                 associated.push(other);
             }
        }
    });
    
    if (associated.length > 0) {
        const left = [];
        const right = [];
        associated.forEach((n, i) => {
            n.isFocusVisible = true;
            if (i % 2 === 0) left.push(n); else right.push(n);
        });
        
        // Place associated nodes loosely around
        const sideGap = layerGap * 1.2; 
        const placeSide = (list, dir) => {
             list.forEach((n, i) => {
                n.fx = cx + (dir * sideGap);
                n.fy = cy + (i * 60) - (list.length * 30);
                n._labelDy = 25;
                // v0.9.80: Sync internal position for associated nodes too
                n.x = n.fx; n.y = n.fy;
             });
        };
        placeSide(left, -1);
        placeSide(right, 1);
    }

    // 5. Apply Updates
    simulation.stop(); // Stop main thread proxy if needed (it does nothing)
    link.style("display", "none");
    updateVisibility();
    
    // Optimization: Subset Simulation
    const activeNodes = [focusD, ...uniqueSup, ...uniqueSub, ...associated];
    const activeNodeIds = new Set(activeNodes.map(n => n.id));
    const activeLinks = links.filter(l => activeNodeIds.has(l.source.id) && activeNodeIds.has(l.target.id));
    
    // Convert to simplified objects for worker
    const workerActiveNodes = activeNodes.map(n => ({
        id: n.id,
        x: n.x, y: n.y,
        fx: n.fx, fy: n.fy, // Important: fx/fy are set by manual layout logic above
        rank: n.rank
    }));
    
    const workerActiveLinks = activeLinks.map(l => ({
        source: l.source.id,
        target: l.target.id
    }));

    simulationWorker.postMessage({
        type: 'setNodes',
        payload: {
            nodes: workerActiveNodes,
            links: workerActiveLinks,
            restart: false // v0.9.75: Ensure simulation is STOPPED in Focus Mode
        }
    });


    // Render Focus Labels (SVG)
    g.selectAll(".focus-label-group").remove(); // Clear old
    if (document.querySelector('input[name="rendererMode"]:checked').value === 'svg') {
        const labelGroup = g.append("g").attr("class", "focus-label-group");
        window.focusLabels.forEach(lbl => {
            labelGroup.append("text")
                .attr("class", "focus-label")
                .attr("x", lbl.x)
                .attr("y", lbl.y)
                .attr("text-anchor", lbl.align || "middle")
                .text(lbl.text);
        });
    }

    node.each(function(d) {
        if (isNodeVisible(d)) {
            const el = d3.select(this);
            el.transition().duration(750)
                .attr("transform", `translate(${d.fx},${d.fy})`);
            
            // Safe Attribute Interpolation
            // Ensure values are numbers before adding 'px', or use safe defaults
            const safeDy = d._labelDy !== undefined && !isNaN(d._labelDy) ? d._labelDy + "px" : ".35em";
            const safeDx = d._labelDx !== undefined && !isNaN(d._labelDx) ? d._labelDx + "px" : (d.id === focusD.id ? "29px" : "12px");

            el.select("text").transition().duration(750)
                .attr("dy", safeDy)
                .attr("dx", safeDx);
            if (d.id === focusD.id) {
                el.select("circle").transition().duration(750)
                    .attr("r", 25).attr("fill", "#ffd700").attr("stroke", "#fff").attr("stroke-width", "3px");
                el.select("text").transition().duration(750)
                    .attr("font-size", "16px").attr("font-weight", "bold").attr("fill", "#fff");
            } else {
                const isSup = uniqueSup.includes(d);
                const isSub = uniqueSub.includes(d);
                const color = isSup ? "#4ecdc4" : (isSub ? "#ff6b6b" : "#aaa");
                el.select("circle").transition().duration(750)
                    .attr("r", 8).attr("fill", color);
                el.select("text").transition().duration(750)
                    .attr("font-size", "10px").attr("font-weight", "normal").attr("fill", "#ccc");
            }
        } else {
             d.fx = null; d.fy = null; d.isFocusVisible = false; d._labelDy = null;
        }
    });
    // v0.9.75: Removed simulation.alpha(0.1).restart() to comply with "cease simulating" requirement.
    // simulation.alpha(0.1).restart();
    ticked(); // Force render update (Canvas)
}
      
      
      
      function exitFocusMode() {
    // Update focus mode state
    // 更新专注模式状态
    updateFocusModeState(false, null);
    
    focusNode = null;

    document.getElementById('focus-exit-btn').style.display = 'none';

    // v0.9.46: Restore main interface settings
    document.getElementById('source-control').style.display = ''; 
    document.getElementById('controls').style.display = '';

    link.style("display", "block");

    // 1. Restore Original Positions FIRST (Critical Step)
    // We must revert to the pre-focus state *before* syncing with the worker
    nodes.forEach(d => {
        // Restore original positions (v0.9.30)
        // 恢复原始位置
        if (d._origX !== undefined) d.x = d._origX;
        if (d._origY !== undefined) d.y = d._origY;
        
        // Restore fx/fy only if they were set (e.g., manual drag outside focus)
        // 仅在设置了 fx/fy 时恢复（例如，专注模式外的移动）
        d.fx = d._origFx !== undefined ? d._origFx : null;
        d.fy = d._origFy !== undefined ? d._origFy : null;
        
        // Cleanup backup props
        delete d._origX; delete d._origY; delete d._origFx; delete d._origFy;

        // Reset Focus flags
        d.isFocusVisible = false; 
        d._labelDy = null;
    });

    // 2. Restore Visual State (Dimensions & Colors)
    // Call these explicitly to reset sizes from Focus Mode values (25px/8px) back to global settings
    updateVisibility(); 
    
    // Instant restoration of size/color to avoid "morphing" from focus state
    // We can use a special flag or just rely on the transition being fast/imperceptible if we remove delay?
    // Let's force a "clean" update.
    updateColor();
    updateSize();

    // Reset Texts specific focus overrides (dy)
    node.selectAll("text").transition().duration(500).attr("dy", ".35em");
    node.selectAll("circle").transition().duration(500).attr("stroke-width", "1.5px");
    
    // Clear Focus Labels (SVG)
    g.selectAll(".focus-label-group").remove();
    window.focusLabels = [];

    // 3. Sync Worker with Restored State
    const workerNodes = nodes.map(n => ({ 
        id: n.id, 
        x: n.x, y: n.y, 
        fx: n.fx, fy: n.fy, 
        rank: n.rank,
        vx: n.vx || 0, vy: n.vy || 0 // optionally reset velocity?
    }));
    const workerLinks = physicsLinks.map(l => ({ source: l.source.id, target: l.target.id }));

    simulationWorker.postMessage({
        type: 'setNodes',
        payload: {
            nodes: workerNodes,
            links: workerLinks,
            restart: false // Set data, don't restart yet
        }
    });

    // 4. Check Freeze Layout State & Restart if needed
    const isFrozen = document.getElementById('freeze-layout') ? document.getElementById('freeze-layout').checked : false;

    if (isFrozen) {
        simulation.stop();
        ticked(); // Force one render to show all nodes in their current (restored) positions
    } else {
        simulation.alpha(1).restart();
    }
}

// Max Workers (Performance)
const workersSlider = document.getElementById('set-workers-slider');
    const workersInput = document.getElementById('set-workers-input');
    const gpuCheckbox = document.getElementById('set-gpu');

    if (workersSlider && workersInput) {
        const updateWorkers = (val) => {
            const num = parseInt(val);
            if (isNaN(num) || num < 1) return;
            workersSlider.value = num;
            workersInput.value = num;
            settingsManager.set('performance', 'maxWorkers', num);
        };

        workersSlider.addEventListener('input', (e) => updateWorkers(e.target.value));
        workersInput.addEventListener('change', (e) => updateWorkers(e.target.value));
    }
    
    if (gpuCheckbox) {
        gpuCheckbox.addEventListener('change', (e) => {
            settingsManager.set('performance', 'enableGPU', e.target.checked);
        });
    }

    // --- Settings Integration ---
function initSettingsUI() {
    const modal = document.getElementById('settings-modal');
    const openBtn = document.getElementById('btn-open-settings');
    const closeBtns = document.querySelectorAll('.modal-close');
    const resetBtn = document.getElementById('btn-reset-settings');
    
    // v0.9.41: Track modal state to freeze simulation
    let isSettingsModalOpen = false;

    // Controls
    const inputs = {
        charge: document.getElementById('set-charge'),
        distance: document.getElementById('set-distance'),
        collision: document.getElementById('set-collision'),
        opacity: document.getElementById('set-opacity')
    };

    const displays = {
        charge: document.getElementById('val-charge'),
        distance: document.getElementById('val-distance'),
        collision: document.getElementById('val-collision'),
        opacity: document.getElementById('val-opacity')
    };
    
    // Performance Controls
    const workersSlider = document.getElementById('set-workers-slider');
    const workersInput = document.getElementById('set-workers-input');
    const gpuCheckbox = document.getElementById('set-gpu');
    const gpuRenderingCheckbox = document.getElementById('set-gpu-rendering');
    const memorySavingCheckbox = document.getElementById('set-memory-saving');
    const compactModeCheckbox = document.getElementById('set-compact-mode');
    const deepDebugCheckbox = document.getElementById('set-deep-debug');
    
    // Reader Settings
    const inputReadingMode = document.getElementById('set-reading-mode');

    // Load initial values
    const updateUIFromSettings = (settings) => {
        const mode = document.querySelector('input[name="layoutMode"]:checked') ? document.querySelector('input[name="layoutMode"]:checked').value : 'force';
        const chargeVal = mode === 'dag' ? settings.physics.repulsionDAG : settings.physics.repulsionForce;
        
        // Update Label
        const repLabel = document.querySelector('label[for="set-charge"]');
        if (repLabel) {
            repLabel.innerText = mode === 'dag' ? "Repulsion (DAG)" : "Repulsion (Force)";
            const lang = document.getElementById('set-language') ? document.getElementById('set-language').value : 'en';
            if (lang === 'zh') {
                 repLabel.innerText = mode === 'dag' ? "排斥力 (DAG)" : "排斥力 (力导向)";
            }
        }

        inputs.charge.value = chargeVal;
        displays.charge.innerText = chargeVal;

        inputs.distance.value = settings.physics.linkDistance;
        displays.distance.innerText = settings.physics.linkDistance;

        inputs.collision.value = settings.physics.collisionRadius;
        displays.collision.innerText = settings.physics.collisionRadius;

        inputs.opacity.value = settings.visuals.edgeOpacity;
        displays.opacity.innerText = settings.visuals.edgeOpacity;
        
        if (settings.reading && settings.reading.mode) {
            inputReadingMode.value = settings.reading.mode;
        }

        // Performance
        if (settings.performance) {
            if (settings.performance.maxWorkers) {
                const num = settings.performance.maxWorkers;
                if (workersSlider) workersSlider.value = num;
                if (workersInput) workersInput.value = num;
            }
            if (settings.performance.enableGPU !== undefined) {
                if (gpuCheckbox) gpuCheckbox.checked = settings.performance.enableGPU;
            }
            if (settings.performance.gpuRendering !== undefined) {
                if (gpuRenderingCheckbox) gpuRenderingCheckbox.checked = settings.performance.gpuRendering;
            }
            if (settings.performance.memorySavingMode !== undefined) {
                if (memorySavingCheckbox) memorySavingCheckbox.checked = settings.performance.memorySavingMode;
            }
            if (settings.performance.compactMode !== undefined) {
                if (compactModeCheckbox) compactModeCheckbox.checked = settings.performance.compactMode;
            }
            if (settings.performance.deepDebug !== undefined) {
                if (deepDebugCheckbox) deepDebugCheckbox.checked = settings.performance.deepDebug;
            }
        }
    };

    updateUIFromSettings(settingsManager.settings);

    // Event Listeners for Inputs
    inputs.charge.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        const mode = document.querySelector('input[name="layoutMode"]:checked') ? document.querySelector('input[name="layoutMode"]:checked').value : 'force';
        const key = mode === 'dag' ? 'repulsionDAG' : 'repulsionForce';
        settingsManager.set('physics', key, val);
        displays.charge.innerText = val;
    });

    inputs.distance.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        settingsManager.set('physics', 'linkDistance', val);
        displays.distance.innerText = val;
    });

    inputs.collision.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        settingsManager.set('physics', 'collisionRadius', val);
        displays.collision.innerText = val;
    });

    inputs.opacity.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        settingsManager.set('visuals', 'edgeOpacity', val);
        displays.opacity.innerText = val;
    });
    
    // Performance Listeners
    if (workersSlider && workersInput) {
        workersSlider.addEventListener('input', (e) => {
            workersInput.value = e.target.value;
            settingsManager.set('performance', 'maxWorkers', parseInt(e.target.value));
        });
        workersInput.addEventListener('input', (e) => {
            workersSlider.value = e.target.value;
            settingsManager.set('performance', 'maxWorkers', parseInt(e.target.value));
        });
    }
    
    if (gpuCheckbox) {
        gpuCheckbox.addEventListener('change', (e) => {
            settingsManager.set('performance', 'enableGPU', e.target.checked);
        });
    }

    if (gpuRenderingCheckbox) {
        gpuRenderingCheckbox.addEventListener('change', (e) => {
            settingsManager.set('performance', 'gpuRendering', e.target.checked);
            // Apply GPU Force immediately
            applyPhysics(settingsManager.settings);
        });
    }

    if (memorySavingCheckbox) {
        memorySavingCheckbox.addEventListener('change', (e) => {
            settingsManager.set('performance', 'memorySavingMode', e.target.checked);
        });
    }

    if (compactModeCheckbox) {
        compactModeCheckbox.addEventListener('change', (e) => {
            settingsManager.set('performance', 'compactMode', e.target.checked);
            // Force redraw immediately to show/hide edges
            if (typeof ticked === 'function') ticked();
        });
    }

    if (deepDebugCheckbox) {
        deepDebugCheckbox.addEventListener('change', (e) => {
            settingsManager.set('performance', 'deepDebug', e.target.checked);
        });
    }
    
    inputReadingMode.addEventListener('change', (e) => {
        settingsManager.set('reading', 'mode', e.target.value);
    });

    // Helper to close settings
    const closeSettings = () => {
        modal.style.display = 'none';
        isSettingsModalOpen = false;
        // Resume if not globally frozen
        const isFrozen = document.getElementById('freeze-layout') ? document.getElementById('freeze-layout').checked : false;
        if (!isFrozen) {
            simulation.alpha(0.3).restart();
        }
    };

    // Modal Actions
    // v0.9.42: When opening settings, update UI to reflect current mode's values
    openBtn.addEventListener('click', () => {
        updateUIFromSettings(settingsManager.settings);
        modal.style.display = 'flex';
        isSettingsModalOpen = true;
        simulation.stop(); // v0.9.41: Force freeze to save resources
    });
    
    closeBtns.forEach(btn => btn.addEventListener('click', closeSettings));
    
    // Close on click outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeSettings();
    });

    resetBtn.addEventListener('click', () => {
        settingsManager.reset();
        updateUIFromSettings(settingsManager.settings);
    });

    // Subscribe to changes
    settingsManager.subscribe((settings) => {
        // Apply Physics
        if (!focusNode) { 
            applyPhysics(settings);
            
            // v0.9.40: Check Freeze Layout State before restarting
            const globalFreeze = document.getElementById('freeze-layout') ? document.getElementById('freeze-layout').checked : false;
            const isFrozen = globalFreeze || isSettingsModalOpen;
            
            if (!isFrozen) {
                simulation.alpha(0.3).restart();
            }
        }

        // Apply Visuals
        g.selectAll(".link").style("stroke-opacity", settings.visuals.edgeOpacity);
    });
}

// Helper to apply physics (Worker Proxy)
function applyPhysics(settings) {
    // We Map settings to Worker params
    // GPU mode is currently ignored in Worker implementation (CPU fallback), 
    // but we respect the parameters.

    const mode = document.querySelector('input[name="layoutMode"]:checked') ? document.querySelector('input[name="layoutMode"]:checked').value : 'force';
    const chargeVal = mode === 'dag' ? settings.physics.repulsionDAG : settings.physics.repulsionForce;
    
    simulationWorker.postMessage({
        type: 'updateParams',
        payload: {
            repulsion: chargeVal,
            distance: settings.physics.linkDistance,
            collision: settings.physics.collisionRadius,
            // We can send other params if needed
        }
    });

    // Handle GPU Visual Feedback (Visuals only, not physics)
    // If user expects GPU physics, we might want a toast saying "Using Parallel CPU Physics"
}

// Initialize Settings
if (window.settingsManager) {
    initSettingsUI();
    // Apply initial settings immediately
    const s = settingsManager.settings;
    applyPhysics(s);
    g.selectAll(".link").style("stroke-opacity", s.visuals.edgeOpacity);
}

// --- Quick Actions Logic (v0.9.26) ---

// 1. Freeze Layout Quick Button
const btnQuickFreeze = document.getElementById('btn-quick-freeze');
const checkboxFreeze = document.getElementById('freeze-layout');

if (btnQuickFreeze && checkboxFreeze) {
    btnQuickFreeze.addEventListener('click', () => {
        // Toggle Checkbox
        checkboxFreeze.checked = !checkboxFreeze.checked;
        
        // Trigger Change Event for Simulation Logic
        const event = new Event('change');
        checkboxFreeze.dispatchEvent(event);
        
        // Update Button Visuals
        updateFreezeButtonState();
    });
    
    // Sync Button with Checkbox (in case checkbox is clicked directly)
    checkboxFreeze.addEventListener('change', updateFreezeButtonState);
    
    function updateFreezeButtonState() {
        if (checkboxFreeze.checked) {
            btnQuickFreeze.classList.add('active');
            // Optional: Change icon?
        } else {
            btnQuickFreeze.classList.remove('active');
        }
    }
}

// 2. Quick Start Manual
const btnHelp = document.getElementById('btn-help');
const manualModal = document.getElementById('manual-modal');
const checkboxDontShow = document.getElementById('dont-show-manual');

// Check and Show on Startup
window.addEventListener('load', () => {
    const seen = localStorage.getItem('nc_manual_seen');
    if (!seen && manualModal) {
        manualModal.style.display = 'flex';
    }
});

if (btnHelp && manualModal) {
    btnHelp.addEventListener('click', () => {
        manualModal.style.display = 'flex';
    });
    
    // Close Logic (using shared .modal-close class)
    const manualCloseBtns = manualModal.querySelectorAll('.modal-close');
    manualCloseBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            manualModal.style.display = 'none';
            handleManualClose();
        });
    });
    
    manualModal.addEventListener('click', (e) => {
        if (e.target === manualModal) {
            manualModal.style.display = 'none';
            handleManualClose();
        }
    });
    
    function handleManualClose() {
        if (checkboxDontShow && checkboxDontShow.checked) {
            localStorage.setItem('nc_manual_seen', 'true');
        }
    }
}

