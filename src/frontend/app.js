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
    }));

const g = svg.append("g");

// Tooltip
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

// Data
const nodes = graphData.nodes.map(d => Object.create(d));
const links = graphData.edges.map(d => Object.create(d));

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

// Simulation
// Initial Center
let width = container.clientWidth;
let height = container.clientHeight;

const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(100))
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide().radius(20)); // Avoid overlap

// Handle Resize
const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
        width = entry.contentRect.width;
        height = entry.contentRect.height;
        
        const mode = document.querySelector('input[name="layoutMode"]:checked') ? document.querySelector('input[name="layoutMode"]:checked').value : 'force';

        if (mode === 'dag') {
             // Update X centering
             simulation.force("x", d3.forceX(width / 2).strength(0.05));
        } else {
             // Update Center Force
             simulation.force("center", d3.forceCenter(width / 2, height / 2));
        }
        simulation.alpha(0.3).restart();
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
    simulation.alpha(0.3).restart();
}

function updateLayout() {
    const mode = document.querySelector('input[name="layoutMode"]:checked').value;
    
    if (mode === 'dag') {
        // DAG Layout: Vertical layering based on Rank
        const layerHeight = 120; // Pixels per rank
        
        // Remove standard Center force
        simulation.force("center", null);
        
        // Add Hierarchical forces
        // Force Y: Strong pull to rank-based layer
        simulation.force("y", d3.forceY(d => (d.rank || 0) * layerHeight).strength(1));
        
        // Force X: Weak pull to center X to keep tree compact, but allow spread
        simulation.force("x", d3.forceX(width / 2).strength(0.05));
        
        // Modify Link force: Reduce strength so layers don't collapse
        simulation.force("link").distance(100).strength(0.3);
        
        // Charge: Keep repulsion to avoid overlap within layers
        simulation.force("charge").strength(-300);

    } else {
        // Force Layout (Default)
        // Remove DAG forces
        simulation.force("y", null);
        simulation.force("x", null);
        
        // Restore Standard forces
        simulation.force("center", d3.forceCenter(width / 2, height / 2));
        
        // Re-initialize Link Force to restore default strength calculation
        simulation.force("link", d3.forceLink(links).id(d => d.id).distance(100));
        
        simulation.force("charge").strength(-300);
    }
    
    simulation.alpha(1).restart();
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
        focus_inbound: "帮助理解",
        focus_outbound: "进一步探索",
        
        // Simulation
        simulation: "物理模拟",
        freeze_layout: "冻结布局 (停止刷新)",
        speed: "速度 (阻尼):"
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
        btn_reset: "Reset Defaults",
        btn_done: "Done",
        
        // Reader
        grp_reading: "Reading Window",
        lbl_reading_mode: "Open Mode",
        opt_window: "Window",
        opt_fullscreen: "Full Screen",
        
        // Focus Mode
        exit_focus: "Exit Focus Mode",
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
            el.innerText = translations[lang][key];
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


// Aggregation Logic for Cluster View
let clusterNodes = [];
let clusterLinks = [];

function buildClusterGraph() {
    const clusters = new Map();
    
    // 1. Create Cluster Nodes
    nodes.forEach(n => {
        const cId = n.clusterId || 'unknown';
        if (!clusters.has(cId)) {
            clusters.set(cId, {
                id: cId,
                label: cId,
                count: 0,
                x: n.x, y: n.y, // Initial pos
                clusterId: cId
            });
        }
        clusters.get(cId).count++;
    });
    
    clusterNodes = Array.from(clusters.values());
    
    // 2. Create Cluster Links
    const linkMap = new Map();
    links.forEach(l => {
        const sourceCluster = l.source.clusterId || 'unknown';
        const targetCluster = l.target.clusterId || 'unknown';
        
        if (sourceCluster !== targetCluster) {
            const key = sourceCluster < targetCluster 
                ? `${sourceCluster}|${targetCluster}`
                : `${targetCluster}|${sourceCluster}`;
            
            if (!linkMap.has(key)) {
                linkMap.set(key, { source: sourceCluster, target: targetCluster, weight: 0 });
            }
            linkMap.get(key).weight++;
        }
    });
    
    clusterLinks = Array.from(linkMap.values());
}

function updateViewMode() {
    const mode = document.querySelector('input[name="viewMode"]:checked').value;
    
    // Stop current simulation
    simulation.stop();
    
    if (mode === 'clusters') {
        if (clusterNodes.length === 0) buildClusterGraph();
        
        // Update Data
        link.data(clusterLinks, d => d.source + "-" + d.target).exit().remove();
        const linkEnter = link.data(clusterLinks, d => d.source + "-" + d.target).enter().append("path")
            .attr("class", "link")
            .attr("stroke-width", d => Math.sqrt(d.weight)) // Thicker links for more connections
            .attr("marker-end", "url(#arrow)");
        // Merge
        // Note: We need to re-select 'link' properly
        // Simplify: Clear and rebuild for prototype
        g.select(".links").selectAll("*").remove();
        g.select(".nodes").selectAll("*").remove();
        
        const newLinks = g.select(".links").selectAll("path")
            .data(clusterLinks)
            .enter().append("path")
            .attr("class", "link")
            .attr("stroke-width", d => Math.min(5, Math.sqrt(d.weight || 1)))
            .attr("marker-end", "url(#arrow)");
            
        const newNodes = g.select(".nodes").selectAll("g")
            .data(clusterNodes)
            .enter().append("g")
            .attr("class", "node")
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));
        
        newNodes.append("circle")
            .attr("r", d => Math.sqrt(d.count) * 3 + 5) // Size by count
            .attr("fill", d => colorScaleCluster(d.id));
            
        newNodes.append("text")
            .attr("dx", d => Math.sqrt(d.count) * 3 + 8)
            .attr("dy", ".35em")
            .text(d => `${d.label} (${d.count})`);
            
        // Restart Simulation
        simulation.nodes(clusterNodes);
        simulation.force("link").links(clusterLinks).distance(150);
        simulation.force("charge").strength(-500); // Stronger repulsion for big bubbles
        simulation.force("collide").radius(d => Math.sqrt(d.count) * 3 + 20);
        
        // Click to drill down
        newNodes.on("click", (event, d) => {
             // Drill down into cluster
             localStorage.setItem('activeClusterFilter', d.id);
             window.location.reload();
        });

    } else {
        // Nodes Mode (Restore)
        g.select(".links").selectAll("*").remove();
        g.select(".nodes").selectAll("*").remove();
        
        // Rebuild standard graph
        // This is a bit brute force but safe
        const restoreLinks = g.select(".links").selectAll("path")
            .data(links)
            .enter().append("path")
            .attr("class", "link")
            .attr("marker-end", "url(#arrow)");
            
        const restoreNodes = g.select(".nodes").selectAll("g")
            .data(nodes)
            .enter().append("g")
            .attr("class", "node")
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));
                
        // Add circles and texts back
        // Note: The global 'circles' and 'texts' variables need re-binding or we just re-run initial setup
        // For simplicity, we just reload the page? No, let's re-append.
        
        const c = restoreNodes.append("circle").attr("r", 5);
        const t = restoreNodes.append("text").attr("dx", 8).attr("dy", ".35em").text(d => d.label);
        
        // Re-assign globals if needed by other functions (like updateColor)
        // In this architecture, 'node', 'link', 'circles', 'texts' are const selections.
        // We can't reassign const.
        // We should have used let.
        // FIX: We need to reload the page or restructure the app to support dynamic data swapping better.
        // FOR NOW: Let's just reload the page if going back to Nodes, OR better:
        // Use a wrapper function `render(dataNodes, dataLinks)`
        
        location.reload(); // Simplest robust way to restore full graph state for now
        return;
    }
    
    simulation.alpha(1).restart();
}

document.querySelectorAll('input[name="viewMode"]').forEach(radio => {
    radio.addEventListener('change', updateViewMode);
});


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
});

// Click & Double Click Logic
node.on("click", (event, d) => {
    // If in Cluster Mode, ignore (handled by updateViewMode logic)
    const viewMode = document.querySelector('input[name="viewMode"]:checked').value;
    if (viewMode !== 'nodes') return;

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



// Simulation Tick
function ticked() {
    const renderer = document.querySelector('input[name="rendererMode"]:checked').value;
    const layoutMode = document.querySelector('input[name="layoutMode"]:checked').value;

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
        node.attr("transform", d => `translate(${d.x},${d.y})`);
    } else {
        // Canvas Update Logic
        renderCanvas(layoutMode);
    }
}

function renderCanvas(layoutMode) {
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

    // Draw Links / 绘制连接
    ctx.lineWidth = 1;

    links.forEach(d => {
        // Check Visibility / 检查可见性
        // 1. Focus Mode / 专注模式
        if (focusNode) {
            if (d.source.isFocusVisible === false || d.target.isFocusVisible === false) return;
            ctx.globalAlpha = 0.6;
            ctx.strokeStyle = "#555";
            ctx.lineWidth = 1;
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
        let r = isFocus ? 25 : (d.centrality ? Math.max(3, Math.sqrt(d.centrality) * 3) : 5);
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
            ctx.fillText(d.label, d.x + 8, d.y + 4);
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
}

// Canvas Setup / Canvas设置
const canvas = document.getElementById('graph-canvas');
const ctx = canvas.getContext('2d');
let currentTransform = d3.zoomIdentity;

// Resize Canvas / 调整Canvas大小
function resizeCanvas() {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    if (document.querySelector('input[name="rendererMode"]:checked').value === 'canvas') {
        ticked();
    }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Canvas Zoom / Canvas缩放
d3.select(canvas).call(d3.zoom()
    .scaleExtent([0.1, 8])
    .on("zoom", (event) => {
        currentTransform = event.transform;
        ticked();
    }));

simulation.on("tick", ticked);

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
const controls = {
    minDegree: document.getElementById('min-degree-slider'),
    showOrphans: document.getElementById('show-orphans'),
    search: document.getElementById('search-input'),
    export: document.getElementById('export-btn')
};

controls.minDegree.addEventListener('input', updateVisibility);
controls.showOrphans.addEventListener('change', updateVisibility);
controls.search.addEventListener('input', updateVisibility);
controls.export.addEventListener('click', exportSVG);

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
function dragstarted(event, d) {
  if (!event.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x;
  d.fy = d.y;
}

function dragged(event, d) {
  d.fx = event.x;
  d.fy = event.y;
}

function dragended(event, d) {
  if (!event.active) simulation.alphaTarget(0);
  
  // In Focus Mode, nodes have fixed positions (fx, fy) set by the layout.
  // We want to allow manual adjustment (dragging) without them snapping back or drifting.
  // So if in Focus Mode, we simply RETAIN the fx/fy set during drag.
  // If NOT in Focus Mode (Force Layout), we release them to the simulation.
  
  // v0.9.0: Also check Freeze Layout. If frozen, we treat it like Focus Mode (manual placement).
  const isFrozen = document.getElementById('freeze-layout').checked;

  if (!focusNode && !isFrozen) {
        d.fx = null;
        d.fy = null;
  }
}

// Old click listener removed.
// Focus Mode Logic
document.getElementById('btn-exit-focus').addEventListener('click', exitFocusMode);
document.getElementById('focus-spacing-slider').addEventListener('input', () => {
    if (focusNode) enterFocusMode(focusNode); // Re-calculate layout
});
document.getElementById('focus-h-spacing-slider').addEventListener('input', () => {
    if (focusNode) enterFocusMode(focusNode); // Re-calculate layout
});
document.getElementById('focus-layout-select').addEventListener('change', () => {
    if (focusNode) enterFocusMode(focusNode); // Re-calculate layout
});
      
      
// Helper to expose highlightNode for external modules (like Analysis)
// 为外部模块（如Analysis）公开highlightNode
window.highlightNode = function(id) {
    const d = nodes.find(n => n.id === id);
    if (d && window.highlightManager) {
        window.highlightManager.highlight(d, { freeze: false });
    }
};

function enterFocusMode(focusD) {
    // Update focus mode state
    // 更新专注模式状态
    updateFocusModeState(true, focusD);

    // If we re-enter (e.g. slider change), we don't return early unless it's strictly same state
    // But here we want to update positions, so we proceed.

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
    document.getElementById('focus-node-name').innerText = focusD.label;
    document.getElementById('controls').style.opacity = '0.3'; // Dim controls
    document.getElementById('controls').style.pointerEvents = 'none'; // Disable controls
    
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
    const layerGap = parseInt(document.getElementById('focus-spacing-slider').value) || 250; 
    const hSpacing = parseInt(document.getElementById('focus-h-spacing-slider').value) || 80;
    const layoutType = document.getElementById('focus-layout-select') ? document.getElementById('focus-layout-select').value : 'horizontal';

    // Set Focus Node Fixed Position
    focusD.fx = cx;
    focusD.fy = cy;
    focusD.isFocusVisible = true;
    focusD._labelDy = 35; 

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
                n.isFocusVisible = true;
                n._labelDy = 25;
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
             });
        };
        placeSide(left, -1);
        placeSide(right, 1);
    }

    // 5. Apply Updates
    simulation.stop();
    link.style("display", "none");
    updateVisibility();
    
    // Render Focus Labels (SVG)
    g.selectAll(".focus-label-group").remove(); // Clear old
    if (document.querySelector('input[name="rendererMode"]:checked').value === 'svg') {
        const labelGroup = g.append("g").attr("class", "focus-label-group");
        window.focusLabels.forEach(lbl => {
            // Background rect for readability
            /*
            labelGroup.append("rect")
                .attr("class", "focus-bg-rect")
                .attr("x", lbl.x - 100).attr("y", lbl.y - 15)
                .attr("width", 200).attr("height", 30);
            */
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
            
            el.select("text").transition().duration(750)
                .attr("dy", d._labelDy ? d._labelDy : ".35em");

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
    simulation.alpha(0.1).restart();
    ticked(); // Force render update (Canvas)
}
      
      
      
      function exitFocusMode() {
      
          // Update focus mode state
          // 更新专注模式状态
          updateFocusModeState(false, null);
          
          focusNode = null;
      
          document.getElementById('focus-exit-btn').style.display = 'none';
      
          document.getElementById('controls').style.opacity = '1';
      
          document.getElementById('controls').style.pointerEvents = 'all';
      
          link.style("display", "block");
      
          
      
          nodes.forEach(d => {
      
              d.fx = null; d.fy = null; d.isFocusVisible = false; d._labelDy = null;
      
          });
      
          
      
          updateVisibility(); updateSize(); updateColor();
      
          
      
          // Reset Texts
      
          node.selectAll("text").transition().duration(500)
      
              .attr("dy", ".35em") // Restore default
      
              .attr("font-size", "10px").attr("font-weight", "normal").attr("fill", "#ccc");
      
              
      
          node.selectAll("circle").transition().duration(500).attr("stroke-width", "1.5px");
          
          // Clear Focus Labels (SVG)
          g.selectAll(".focus-label-group").remove();
          window.focusLabels = [];
      
          simulation.alpha(1).restart();
      
}

// --- Settings Integration ---

function initSettingsUI() {
    const modal = document.getElementById('settings-modal');
    const openBtn = document.getElementById('btn-open-settings');
    const closeBtns = document.querySelectorAll('.modal-close');
    const resetBtn = document.getElementById('btn-reset-settings');

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
    
    // Reader Settings
    const inputReadingMode = document.getElementById('set-reading-mode');

    // Load initial values
    const updateUIFromSettings = (settings) => {
        inputs.charge.value = settings.physics.chargeStrength;
        displays.charge.innerText = settings.physics.chargeStrength;

        inputs.distance.value = settings.physics.linkDistance;
        displays.distance.innerText = settings.physics.linkDistance;

        inputs.collision.value = settings.physics.collisionRadius;
        displays.collision.innerText = settings.physics.collisionRadius;

        inputs.opacity.value = settings.visuals.edgeOpacity;
        displays.opacity.innerText = settings.visuals.edgeOpacity;
        
        if (settings.reading && settings.reading.mode) {
            inputReadingMode.value = settings.reading.mode;
        }
    };

    updateUIFromSettings(settingsManager.settings);

    // Event Listeners for Inputs
    inputs.charge.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        settingsManager.set('physics', 'chargeStrength', val);
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
    
    inputReadingMode.addEventListener('change', (e) => {
        settingsManager.set('reading', 'mode', e.target.value);
    });

    // Modal Actions
    openBtn.addEventListener('click', () => modal.style.display = 'flex');
    closeBtns.forEach(btn => btn.addEventListener('click', () => modal.style.display = 'none'));
    
    // Close on click outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    resetBtn.addEventListener('click', () => {
        settingsManager.reset();
        updateUIFromSettings(settingsManager.settings);
    });

    // Subscribe to changes
    settingsManager.subscribe((settings) => {
        // Apply Physics
        if (!focusNode) { // Only apply physics updates if NOT in Focus Mode (which locks positions)
            simulation.force("charge").strength(settings.physics.chargeStrength);
            simulation.force("link").distance(settings.physics.linkDistance);
            simulation.force("collide").radius(settings.physics.collisionRadius);
            simulation.alpha(0.3).restart();
        }

        // Apply Visuals
        g.selectAll(".link").style("stroke-opacity", settings.visuals.edgeOpacity);
    });
}

// Initialize Settings
if (window.settingsManager) {
    initSettingsUI();
    // Apply initial settings immediately
    const s = settingsManager.settings;
    simulation.force("charge").strength(s.physics.chargeStrength);
    simulation.force("link").distance(s.physics.linkDistance);
    simulation.force("collide").radius(s.physics.collisionRadius);
    g.selectAll(".link").style("stroke-opacity", s.visuals.edgeOpacity);
}
