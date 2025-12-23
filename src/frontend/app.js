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
svg.append("defs").selectAll("marker")
    .data(["end"])
    .enter().append("marker")
    .attr("id", "arrow")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 15) // Position of arrow
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "#555");

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
        filter_strategy: "过滤策略:",
        cluster_filter: "聚类过滤:",
        threshold: "阈值:",
        selected: "已选:",
        export_json: "JSON",
        export_zip: "ZIP (MD)",
        filtered_nodes: "过滤后节点",
        
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
        exit_focus: "退出专注模式"
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
        filter_strategy: "Filter Strategy:",
        cluster_filter: "Cluster Filter:",
        threshold: "Threshold:",
        selected: "Selected:",
        export_json: "JSON",
        export_zip: "ZIP (MD)",
        filtered_nodes: "Filtered Nodes",
        
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
        exit_focus: "Exit Focus Mode"
    }
};

window.t = function(key) {
    const lang = document.getElementById('lang-select').value;
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

document.getElementById('lang-select').addEventListener('change', (e) => {
    window.updateLanguage(e.target.value);
});


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


// Interactions
let transform = d3.zoomIdentity;

// Highlight Logic
node.on("mouseover", function(event, d) {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    
    // Dim all
    node.style("opacity", 0.1);
    link.style("opacity", 0.1);

    // Highlight current
    d3.select(this).style("opacity", 1).classed("highlight-main", true);

    // Find neighbors
    const connectedLinks = links.filter(l => l.source.id === d.id || l.target.id === d.id);
    const connectedNodeIds = new Set();
    connectedNodeIds.add(d.id);

    connectedLinks.forEach(l => {
        const isOutgoing = l.source.id === d.id;
        const isIncoming = l.target.id === d.id;

        if (mode === 'in' && !isIncoming) return;
        if (mode === 'out' && !isOutgoing) return;

        // Highlight Link
        const linkSel = link.filter(ld => ld === l);
        linkSel.style("opacity", 1)
               .classed("highlight-out", isOutgoing)
               .classed("highlight-in", isIncoming);

        // Add neighbor ID
        connectedNodeIds.add(l.source.id);
        connectedNodeIds.add(l.target.id);
    });

    // Highlight Neighbors
    node.filter(n => connectedNodeIds.has(n.id))
        .style("opacity", 1);

    // Tooltip
    tooltip.transition().duration(200).style("opacity", .9);
    tooltip.html(`
        <strong>${d.label}</strong><br/>
        In-Degree: ${d.inDegree}<br/>
        Out-Degree: ${d.outDegree}
    `)
    .style("left", (event.pageX + 10) + "px")
    .style("top", (event.pageY - 28) + "px");

}).on("mouseout", function() {
    // Reset styles to filtered state
    tooltip.transition().duration(500).style("opacity", 0);
    d3.select(this).classed("highlight-main", false);
    link.classed("highlight-out", false).classed("highlight-in", false);
    updateVisibility(); // Restore visibility based on filters
});

// Canvas Setup
const canvas = document.getElementById('graph-canvas');
const ctx = canvas.getContext('2d');
let currentTransform = d3.zoomIdentity;

// Resize Canvas
function resizeCanvas() {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    if (document.querySelector('input[name="rendererMode"]:checked').value === 'canvas') {
        ticked();
    }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Canvas Zoom
d3.select(canvas).call(d3.zoom()
    .scaleExtent([0.1, 8])
    .on("zoom", (event) => {
        currentTransform = event.transform;
        ticked();
    }));


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

    // Draw Links
    ctx.globalAlpha = settingsManager.settings.visuals.edgeOpacity || 0.6;
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;

    links.forEach(d => {
        // Check Visibility
        if (d.source.isFocusVisible === false || d.target.isFocusVisible === false) return; // Simple check

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

    // Draw Nodes
    ctx.globalAlpha = 1;
    nodes.forEach(d => {
        if (!isNodeVisible(d)) return;

        ctx.beginPath();
        const r = d.id === (focusNode ? focusNode.id : null) ? 25 : (d.centrality ? Math.max(3, Math.sqrt(d.centrality) * 3) : 5);
        ctx.arc(d.x, d.y, r, 0, 2 * Math.PI);
        
        // Color
        ctx.fillStyle = d.id === (focusNode ? focusNode.id : null) ? "#ffd700" : "#61dafb"; // Simplified color
        // Use computed color if possible, but accessing D3 scale is easy
        if (d.id !== (focusNode ? focusNode.id : null)) {
             const mode = document.querySelector('input[name="colorMode"]:checked').value;
             if (mode === 'cluster') ctx.fillStyle = colorScaleCluster(d.clusterId || 'unknown');
             else ctx.fillStyle = colorScaleDegree(getDegree(d));
        }

        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Label
        if (d.id === (focusNode ? focusNode.id : null) || currentTransform.k > 1.2) {
            ctx.fillStyle = "#ccc";
            ctx.font = d.id === (focusNode ? focusNode.id : null) ? "bold 16px Sans-Serif" : "10px Sans-Serif";
            ctx.fillText(d.label, d.x + 8, d.y + 4);
        }
    });

    ctx.restore();
}

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

    node.style("opacity", d => isNodeVisible(d) ? 1 : 0.1)
        .style("pointer-events", d => isNodeVisible(d) ? "all" : "none");

    link.style("opacity", d => {
        const sourceVis = isNodeVisible(d.source);
        const targetVis = isNodeVisible(d.target);
        return (sourceVis && targetVis) ? 0.6 : 0.05;
    });
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
  // In Focus Mode, we want nodes to stay where they are (or where layout put them)
  if (!focusNode) {
        d.fx = null;
        d.fy = null;
  }
}

// Focus Mode Logic
document.getElementById('btn-exit-focus').addEventListener('click', exitFocusMode);
document.getElementById('focus-spacing-slider').addEventListener('input', () => {
    if (focusNode) enterFocusMode(focusNode); // Re-calculate layout
});
      
      // Wire up click event to nodes
      // We need to re-bind the click event or add it to the existing selection
      // Since 'node' is a selection of groups 'g', we can add it.
      // Note: We used 'click' for drill-down in Cluster Mode.
      // In Node Mode, we want Focus Mode or Reader.
      node.on("click", (event, d) => {
          // If in Cluster Mode, ignore (handled by updateViewMode logic)
          const viewMode = document.querySelector('input[name="viewMode"]:checked').value;
          if (viewMode === 'nodes') {
              if (focusNode && focusNode.id === d.id) {
                  // Clicked on ALREADY focused node -> Open Reader
                  if (window.reader) window.reader.open(d);
              } else {
                  // Enter Focus Mode
                  enterFocusMode(d);
              }
              event.stopPropagation();
          }
      });
      
      function enterFocusMode(focusD) {
    // If we re-enter (e.g. slider change), we don't return early unless it's strictly same state
    // But here we want to update positions, so we proceed.

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
    const superiors = []; // Outgoing: Focus -> Target (Superior)
    const subordinates = []; // Incoming: Source -> Focus (Subordinate)
    
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
    const cx = width / 2;
    const cy = height / 2;
    // Get spacing from slider
    const layerGap = parseInt(document.getElementById('focus-spacing-slider').value) || 250; 
    
    const spreadNodes = (nodeList, baselineY) => {
        const count = nodeList.length;
        if (count === 0) return;
        
        const spreadWidth = Math.min(width * 0.9, Math.max(count * 80, 200)); 
        const startX = cx - spreadWidth / 2;
        const step = count > 1 ? spreadWidth / (count - 1) : 0;
        
        nodeList.forEach((n, i) => {
            n.fx = count === 1 ? cx : startX + i * step;
            
            // Relative Height & Staggered Labels
            const stagger = (i % 2 === 0 ? -1 : 1) * 20; 
            const criteriaOffset = (n._focusScore * 20); 
            const totalOffset = stagger + criteriaOffset; 
            
            n.fy = baselineY + totalOffset;
            n.isFocusVisible = true;
            
            if (n.fy < baselineY) n._labelDy = -15; // Above
            else n._labelDy = 25; // Below
        });
    };
    
    // Focus Node
    focusD.fx = cx;
    focusD.fy = cy;
    focusD.isFocusVisible = true;
    focusD._labelDy = 35; 
    
    spreadNodes(uniqueSup, cy - layerGap);
    spreadNodes(uniqueSub, cy + layerGap);
    
    // Associated Nodes
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
        
        const sideGap = 200;
        const placeSide = (list, dir) => {
             list.forEach((n, i) => {
                n.fx = cx + (dir * (sideGap + 100 + (i * 60)));
                n.fy = cy + (i % 2 === 0 ? -20 : 20);
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
