// Analysis & Export Module
console.log("Analysis Module: Parsing...");

document.addEventListener("DOMContentLoaded", () => {
    console.log("Analysis Module: DOMContentLoaded");

    const UI = {
        panel: document.getElementById("analysis-panel"),
        resizer: document.getElementById("analysis-resizer"),
        btn: document.getElementById("analysis-btn"),
        closeBtn: document.querySelector(".close-panel"),
        fullScreenBtn: document.getElementById("analysis-fullscreen-btn"),
        panelBody: document.querySelector("#analysis-panel .panel-body"),
        quickDist: document.getElementById("quick-distribution"),
        histogram: document.getElementById("histogram-container"),
        // Controls
        strategy: document.getElementById("export-strategy"),
        clusterFilter: document.getElementById("cluster-filter"),
        slider: document.getElementById("export-threshold-slider"),
        val: document.getElementById("export-threshold-val"),
        count: document.getElementById("selected-count"),
        btnJson: document.getElementById("export-json-btn"),
        btnZip: document.getElementById("export-zip-btn"),
        // Table
        tableBody: document.getElementById("node-table-body"),
        headers: document.querySelectorAll(".sortable")
    };

    // State
    const AppState = {
        threshold: 5,
        strategy: 'top-percent',
        cluster: 'all',     // 'all' or specific clusterId
        sortField: 'total', // 'name', 'cluster', 'in', 'out', 'total'
        sortOrder: 'desc',  // 'asc', 'desc'
        currentZoom: 1.0
    };

    // --- 0. Init Cluster Options ---
    function initClusters() {
        if (!UI.clusterFilter || typeof graphData === 'undefined') return;
        
        // Find unique clusters
        const clusters = new Set();
        graphData.nodes.forEach(n => {
            if (n.clusterId) clusters.add(n.clusterId);
        });
        
        // Sort
        const sortedClusters = Array.from(clusters).sort();
        
        // Populate
        sortedClusters.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c; // Or "Cluster " + c
            UI.clusterFilter.appendChild(opt);
        });
    }
    // Delay slightly to ensure data.js is parsed
    setTimeout(initClusters, 0);


    // --- 1. Quick Distribution (Immediate) ---
    function initQuickDist() {
        if (!UI.quickDist) return;
        if (typeof graphData === 'undefined') return;

        const degrees = graphData.nodes.map(n => n.inDegree + n.outDegree);
        const maxDeg = Math.max(...degrees, 1);
        const buckets = new Array(15).fill(0);
        
        degrees.forEach(d => {
            const idx = Math.min(Math.floor((d / maxDeg) * 15), 14);
            buckets[idx]++;
        });

        const maxCount = Math.max(...buckets, 1);
        
        UI.quickDist.innerHTML = buckets.map(count => {
            const pct = (count / maxCount) * 100;
            const bg = count > 0 ? '#4ecdc4' : '#333';
            return `<div style="flex: 1; background: ${bg}; height: ${pct}%; border-radius: 1px;"></div>`;
        }).join('');
    }
    setTimeout(initQuickDist, 0);

    // --- 2. Panel Toggle ---
    if (UI.btn && UI.panel && UI.resizer) {
        UI.btn.addEventListener("click", () => {
            const isOpen = UI.panel.classList.contains("open");
            
            if (isOpen) {
                UI.panel.classList.remove("open");
                UI.resizer.style.display = "none";
            } else {
                UI.panel.classList.add("open");
                UI.resizer.style.display = "block";
                
                if (!UI.panel.style.height || UI.panel.style.height === '0px') {
                    UI.panel.style.height = "500px"; 
                }
                
                requestAnimationFrame(() => {
                    renderHistogram();
                    updateStats(); 
                });
            }
        });

        if (UI.closeBtn) {
            UI.closeBtn.addEventListener("click", () => {
                UI.panel.classList.remove("open");
                UI.resizer.style.display = "none";
                UI.panel.classList.remove("full-screen"); // Reset full screen on close
            });
        }
        
        if (UI.fullScreenBtn) {
            UI.fullScreenBtn.addEventListener("click", () => {
                UI.panel.classList.toggle("full-screen");
                // Update button icon/text?
                UI.fullScreenBtn.innerText = UI.panel.classList.contains("full-screen") ? "⤓" : "⤢";
                renderHistogram(); // Re-render histogram for new width
            });
        }
    }
    
    // --- 2.5 Touch Zoom (Pinch) ---
    if (UI.panelBody) {
        let initialDistance = 0;
        let initialZoom = 1.0;

        UI.panelBody.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                initialDistance = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );
                initialZoom = AppState.currentZoom;
                e.preventDefault(); // Prevent scroll while pinching
            }
        }, { passive: false });

        UI.panelBody.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                const currentDistance = Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY
                );

                if (initialDistance > 0) {
                    const scale = currentDistance / initialDistance;
                    let newZoom = initialZoom * scale;
                    newZoom = Math.max(0.8, Math.min(2.0, newZoom)); // Clamp zoom
                    
                    AppState.currentZoom = newZoom;
                    document.getElementById('node-list-wrapper').style.fontSize = `${newZoom * 0.85}rem`; 
                }
                e.preventDefault(); // Prevent native zoom
            }
        }, { passive: false });
        
        UI.panelBody.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                initialDistance = 0;
            }
        });
    }

    // --- 2.6 Mobile Panel Slide/Drag ---
    const panelHeader = document.querySelector('.panel-header');
    if (panelHeader) {
        let startY = 0;
        let startHeight = 0;
        let isDragging = false;

        panelHeader.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                isDragging = true;
                startY = e.touches[0].clientY;
                startHeight = UI.panel.clientHeight;
                // Don't prevent default here, we might want to click buttons
            }
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            const deltaY = startY - e.touches[0].clientY; // Drag up = positive
            let newHeight = startHeight + deltaY;
            
            // Constrain
            const maxH = window.innerHeight;
            if (newHeight < 100) newHeight = 100;
            if (newHeight > maxH) newHeight = maxH;

            UI.panel.style.height = `${newHeight}px`;
            
            // Auto-snap to full screen if dragged near top
            if (newHeight > maxH * 0.9) {
                UI.panel.classList.add('full-screen');
                UI.panel.style.height = ''; // Reset inline height to let CSS handle it
                if (UI.fullScreenBtn) UI.fullScreenBtn.innerText = "⤓";
            } else {
                UI.panel.classList.remove('full-screen');
                if (UI.fullScreenBtn) UI.fullScreenBtn.innerText = "⤢";
            }
            
            e.preventDefault(); // Prevent page scroll
        }, { passive: false });

        document.addEventListener('touchend', () => {
            isDragging = false;
        });
    }

    // --- 3. Resizer ---
    let resizing = false;
    if (UI.resizer) {
        UI.resizer.addEventListener("mousedown", (e) => {
            resizing = true;
            document.body.style.cursor = "row-resize";
            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
            e.preventDefault();
        });
    }

    function onMouseMove(e) {
        if (!resizing) return;
        const totalH = window.innerHeight;
        const newH = totalH - e.clientY;
        if (newH < 100 || newH > totalH - 100) return;
        UI.panel.style.height = `${newH}px`;
    }

    function onMouseUp() {
        resizing = false;
        document.body.style.cursor = "";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        window.dispatchEvent(new Event('resize'));
    }

    // --- 4. Histogram (D3) ---
    function renderHistogram() {
        if (!UI.histogram) return;
        UI.histogram.innerHTML = "";
        const w = UI.histogram.clientWidth;
        const h = UI.histogram.clientHeight;
        if (w === 0 || h === 0) return;

        const margin = {top: 10, right: 10, bottom: 20, left: 30};
        const counts = new Map();
        
        // Use filtered nodes for histogram? Or all? Usually histogram shows ALL context.
        // Let's stick to ALL nodes for the main histogram to show global context.
        // OR: should it reflect the current cluster filter?
        // Requirement: "support users to perform clustering filtering".
        // It's better if the histogram reflects the CURRENTLY VIEWED set (filtered by cluster).
        
        // Get nodes filtered ONLY by cluster (ignore threshold for histogram context)
        let contextNodes = graphData.nodes;
        if (AppState.cluster !== 'all') {
            contextNodes = contextNodes.filter(n => n.clusterId === AppState.cluster);
        }

        contextNodes.forEach(n => {
            const d = n.inDegree + n.outDegree;
            counts.set(d, (counts.get(d)||0)+1);
        });
        const data = Array.from(counts, ([d, c]) => ({d, c})).sort((a,b)=>a.d - b.d);

        const svg = d3.select(UI.histogram).append("svg").attr("width", w).attr("height", h);
        const x = d3.scaleLinear().domain([0, d3.max(data, i=>i.d)||0]).range([margin.left, w-margin.right]);
        const y = d3.scaleLinear().domain([0, d3.max(data, i=>i.c)||0]).range([h-margin.bottom, margin.top]);

        svg.selectAll("rect").data(data).join("rect")
            .attr("x", i => x(i.d)-2).attr("y", i => y(i.c))
            .attr("width", 4).attr("height", i => y(0) - y(i.c))
            .attr("fill", "#61dafb");

        svg.append("g").attr("transform", `translate(0,${h-margin.bottom})`)
           .call(d3.axisBottom(x).ticks(10).tickSizeOuter(0));
        svg.append("g").attr("transform", `translate(${margin.left},0)`)
           .call(d3.axisLeft(y).ticks(5));
    }

    // --- 5. Table Logic ---
    function renderTable(nodes) {
        if (!UI.tableBody) return;
        
        // Sort
        const sorted = [...nodes].sort((a, b) => {
            let valA, valB;
            
            switch(AppState.sortField) {
                case 'name': valA = a.label.toLowerCase(); valB = b.label.toLowerCase(); break;
                case 'cluster': valA = a.clusterId || ''; valB = b.clusterId || ''; break;
                case 'in': valA = a.inDegree; valB = b.inDegree; break;
                case 'out': valA = a.outDegree; valB = b.outDegree; break;
                case 'total': default: valA = a.inDegree + a.outDegree; valB = b.inDegree + b.outDegree; break;
            }

            if (valA < valB) return AppState.sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return AppState.sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        // Update Header Indicators
        UI.headers.forEach(h => {
            const span = h.querySelector('span');
            if (h.dataset.sort === AppState.sortField) {
                h.style.color = '#61dafb';
                span.innerText = AppState.sortOrder === 'asc' ? '▲' : '▼';
            } else {
                h.style.color = '';
                span.innerText = '';
            }
        });

        // Render Rows
        UI.tableBody.innerHTML = sorted.map(n => `
            <div class="node-row" title="${n.label}">
                <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${n.label}</div>
                <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color: #aaa;">${n.clusterId || '-'}</div>
                <div>${n.inDegree}</div>
                <div>${n.outDegree}</div>
                <div>${n.inDegree + n.outDegree}</div>
            </div>
        `).join('');

        // Add Click Listeners to Rows
        UI.tableBody.querySelectorAll('.node-row').forEach((row, index) => {
            row.addEventListener('click', () => {
                const nodeData = sorted[index];
                if (window.highlightNode) {
                    window.highlightNode(nodeData.id);
                }
            });
            row.style.cursor = 'pointer';
        });
    }

    UI.headers.forEach(h => {
        h.addEventListener('click', () => {
            const field = h.dataset.sort;
            if (AppState.sortField === field) {
                AppState.sortOrder = AppState.sortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                AppState.sortField = field;
                AppState.sortOrder = 'desc';
            }
            updateStats();
        });
    });


    // --- 7. Node Details Logic (v0.9.11) ---
    const NodeDetails = {
        globalContainer: document.getElementById("global-analysis-container"),
        nodeContainer: document.getElementById("node-details-container"),
        backBtn: document.getElementById("btn-back-analysis"),
        name: document.getElementById("details-node-name"),
        cluster: document.getElementById("details-cluster"),
        inCount: document.getElementById("details-in-count"),
        outCount: document.getElementById("details-out-count"),
        inList: document.getElementById("details-in-list"),
        outList: document.getElementById("details-out-list")
    };

    if (NodeDetails.backBtn) {
        NodeDetails.backBtn.addEventListener('click', () => {
            showGlobalView();
        });
    }

    function showGlobalView() {
        if (NodeDetails.globalContainer) NodeDetails.globalContainer.style.display = "block";
        if (NodeDetails.nodeContainer) NodeDetails.nodeContainer.style.display = "none";
        // Update Title
        document.querySelector("#analysis-panel h2").setAttribute("data-i18n", "analysis_title");
        document.querySelector("#analysis-panel h2").innerText = window.t ? window.t("analysis_title") : "Degree Analysis";
    }

    function showNodeDetails(nodeId) {
        // Open Panel if closed
        if (!UI.panel.classList.contains("open")) {
            UI.btn.click();
        }

        // Switch View
        if (NodeDetails.globalContainer) NodeDetails.globalContainer.style.display = "none";
        if (NodeDetails.nodeContainer) NodeDetails.nodeContainer.style.display = "flex";

        // Find Node
        const node = graphData.nodes.find(n => n.id === nodeId);
        if (!node) return;

        // Populate Info
        NodeDetails.name.innerText = node.label;
        NodeDetails.cluster.innerText = node.clusterId || '-';
        
        // Find Edges
        const inEdges = [];
        const outEdges = [];
        
        graphData.edges.forEach(e => {
            if (e.target === nodeId) inEdges.push(graphData.nodes.find(n => n.id === e.source));
            if (e.source === nodeId) outEdges.push(graphData.nodes.find(n => n.id === e.target));
        });

        NodeDetails.inCount.innerText = inEdges.length;
        NodeDetails.outCount.innerText = outEdges.length;

        // Render Lists
        const renderList = (list, container) => {
            container.innerHTML = list.map(n => `
                <div class="detail-item" data-id="${n.id}">
                    <span>${n.label}</span>
                    <span style="color: #888; font-size: 0.8em;">${n.clusterId || ''}</span>
                </div>
            `).join('');
            
            // Add click listeners
            container.querySelectorAll('.detail-item').forEach(el => {
                el.addEventListener('click', () => {
                    const id = el.dataset.id;
                    if (window.highlightNode) window.highlightNode(id);
                    // Also navigate to this node in the panel?
                    showNodeDetails(id);
                });
            });
        };

        renderList(inEdges, NodeDetails.inList);
        renderList(outEdges, NodeDetails.outList);
        
        // Update Header Title (Optional, or keep static)
        document.querySelector("#analysis-panel h2").innerText = window.t ? window.t("node_details") : "Node Details";
    }

    // Expose
    window.showNodeAnalysis = showNodeDetails;

    // --- 6. Export & Filter Logic ---
    function getFilteredData() {
        let nodes = graphData.nodes;
        
        // 1. Cluster Filter
        if (AppState.cluster !== 'all') {
            nodes = nodes.filter(n => n.clusterId === AppState.cluster);
        }

        // 2. Degree/Rank Filter
        let filteredNodes = [];
        if (AppState.strategy === 'min-degree') {
            filteredNodes = nodes.filter(n => (n.inDegree + n.outDegree) >= AppState.threshold);
        } else {
            // Top Percent
            const sorted = [...nodes].sort((a,b)=>(b.inDegree+b.outDegree)-(a.inDegree+a.outDegree));
            const cut = Math.ceil(nodes.length * (AppState.threshold/100));
            filteredNodes = sorted.slice(0, cut);
        }

        // 3. Filter Edges
        const nodeIds = new Set(filteredNodes.map(n => n.id));
        
        // Requirement: Export complete in-degree and out-degree relationships of exported nodes.
        // This means we include an edge if AT LEAST ONE of its endpoints is in our filtered node list.
        const filteredEdges = graphData.edges.filter(e => 
            nodeIds.has(e.source) || nodeIds.has(e.target)
        );

        return { nodes: filteredNodes, edges: filteredEdges };
    }

    function updateStats() {
        const { nodes } = getFilteredData();
        if (UI.count) {
            const tot = graphData.nodes.length;
            const pct = ((nodes.length/tot)*100).toFixed(1);
            // Use translation for "Selected:" label is handled in HTML, here just numbers
            // But wait, the label is separate <span data-i18n="selected">
            UI.count.innerText = `${nodes.length} / ${tot} (${pct}%)`;
        }
        renderTable(nodes);
        renderHistogram(); 
    }

    // Expose update function for Localization
    window.updateAnalysisUI = function() {
        // Re-render table to update headers if we were generating them via JS (we are not, they are HTML)
        // But we need to update dynamic text that might contain English words
        if (UI.val) {
             const suffix = AppState.strategy === 'top-percent' ? '%' : '';
             UI.val.innerText = AppState.threshold + suffix;
        }
        updateStats();
    };

    if (UI.clusterFilter) UI.clusterFilter.addEventListener("change", (e) => {
        AppState.cluster = e.target.value;
        updateStats();
    });

    if (UI.strategy) UI.strategy.addEventListener("change", (e) => {
        AppState.strategy = e.target.value;
        updateStats();
    });

    if (UI.slider) UI.slider.addEventListener("input", (e) => {
        AppState.threshold = parseInt(e.target.value);
        if (UI.val) {
             const suffix = AppState.strategy === 'top-percent' ? '%' : '';
             UI.val.innerText = AppState.threshold + suffix;
        }
        updateStats();
    });

    if (UI.btnJson) UI.btnJson.addEventListener("click", () => {
        const data = getFilteredData();
        // Export full graph structure with edge info
        download(JSON.stringify(data, null, 2), "export.json", "application/json");
    });

    if (UI.btnZip) UI.btnZip.addEventListener("click", () => {
        if (typeof JSZip === 'undefined') return alert("JSZip missing");
        const zip = new JSZip();
        const { nodes, edges } = getFilteredData();
        
        // Add JSON export to ZIP
        zip.file("graph_data.json", JSON.stringify({ nodes, edges }, null, 2));

        const f = zip.folder("notes");
        nodes.forEach(n => {
            const name = n.id.endsWith(".md") ? n.id : n.id+".md";
            f.file(name, (n.content||"") + `\n\n---\nDegree: ${n.inDegree+n.outDegree}\nCluster: ${n.clusterId}`);
        });
        zip.generateAsync({type:"blob"}).then(b => {
            const url = URL.createObjectURL(b);
            const a = document.createElement("a");
            a.href = url; a.download = "notes.zip";
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
        });
    });

    function download(content, name, type) {
        const blob = new Blob([content], {type});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
});
