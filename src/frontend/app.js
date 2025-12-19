// Initialize Graph
const container = document.getElementById('graph-container');

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
        simulation.force("link").distance(100).strength(null); // Revert to default
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
    en: {
        show_all: "Show All",
        show_in: "Incoming Only",
        show_out: "Outgoing Only",
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
        th_total: "Total"
    },
    zh: {
        show_all: "显示全部",
        show_in: "仅入度",
        show_out: "仅出度",
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
        th_total: "总计"
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

// Simulation Tick
simulation.on("tick", () => {
    link.attr("d", d => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        // const dr = Math.sqrt(dx * dx + dy * dy);
        return `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`;
    });

    node.attr("transform", d => `translate(${d.x},${d.y})`);
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
    const minDegree = parseInt(controls.minDegree.value);
    const showOrphans = controls.showOrphans.checked;
    const term = controls.search.value.toLowerCase();
    
    const degree = d.inDegree + d.outDegree;
    const matchesDegree = degree >= minDegree;
    const isOrphan = degree === 0;
    const allowedOrphan = !isOrphan || showOrphans;
    const matchesSearch = !term || d.label.toLowerCase().includes(term);

    return matchesDegree && allowedOrphan && matchesSearch;
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
  d.fx = null;
  d.fy = null;
}
