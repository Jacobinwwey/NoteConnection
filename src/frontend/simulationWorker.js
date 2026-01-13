importScripts("https://d3js.org/d3.v6.min.js", "libs/gpu-browser.min.js", "layout_gpu.js");

let simulation;
let nodes = [];
let links = [];
let layoutMode = 'force'; // 'force' | 'dag'

// Force configurations
let currentSettings = {
    repulsion: -300,
    distance: 100,
    velocityDecay: 0.2
};

onmessage = function(event) {
    const { type, payload } = event.data;

    switch (type) {
        case 'init':
            initSimulation(payload);
            break;
        case 'updateParams':
            updateParams(payload);
            break;
        case 'updateLayout':
            updateLayout(payload);
            break;
        case 'dragStart':
        case 'drag':
        case 'dragEnd':
            handleDrag(type, payload);
            break;
        case 'setNodes':
            setNodes(payload);
            break;
        case 'restart':
            if (simulation) simulation.alpha(0.3).restart();
            break;
        case 'stop':
            if (simulation) simulation.stop();
            break;
        case 'fixNodes':
             fixNodes(payload); // payload: [{id, fx, fy}, ...]
             break;
        case 'layoutSwitchDone':
             postMessage({ type: 'layoutSwitchDone' });
             break;
    }
};

function initSimulation(data) {
    nodes = data.nodes;
    links = data.links;
    const { width, height } = data;
    const { settings } = data; // Settings if provided

    console.log(`[Worker] Initializing simulation with ${nodes.length} nodes, ${links.length} edges`);

    if (settings) {
        currentSettings = { ...currentSettings, ...settings };
    }

    // GPU Check
    const useGPU = settings && settings.gpuRendering && (typeof gpuManyBody === 'function');
    console.log(`[Worker] Layout Engine: ${useGPU ? 'GPU (Accelerated)' : 'CPU (Standard)'}`);

    const linkForce = useGPU ? gpuLink(links) : d3.forceLink(links);
    const chargeForce = useGPU ? gpuManyBody() : d3.forceManyBody();

    // Configure Forces
    linkForce.id(d => d.id).distance(currentSettings.distance);
    chargeForce.strength(currentSettings.repulsion);

    simulation = d3.forceSimulation(nodes)
        .force("link", linkForce)
        .force("charge", chargeForce)
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide().radius(20))
        .velocityDecay(currentSettings.velocityDecay);

    simulation.on("tick", () => {
        // Optimization: For very large graphs, maybe use Float32Array?
        // For now, post simplified objects
        const positions = nodes.map(n => ({ id: n.id, x: n.x, y: n.y }));
        postMessage({ type: 'tick', nodes: positions });
    });
    
    // Initial warmup
    simulation.alpha(1).restart();
}

function updateParams(params) {
    if (!simulation) return;
    
    // Handle specific parameter updates
    if (params.repulsion !== undefined) {
        // Update existing force instead of replacing it
        simulation.force("charge").strength(params.repulsion);
    }
    if (params.distance !== undefined) {
        simulation.force("link").distance(params.distance);
    }
    if (params.velocityDecay !== undefined) {
        simulation.velocityDecay(params.velocityDecay);
    }
    if (params.collision !== undefined) {
        // Collide is usually CPU fast enough, or we can use GPU if implemented. 
        // For now, assuming standard d3 collide, we can just update radius if it supports it?
        // d3.forceCollide().radius(...) is a setter. 
        // simulation.force("collide").radius(...) updates it.
        simulation.force("collide").radius(params.collision);
    }

    // Restart if requested (often params update implies restart)
    if (params.restart !== false) {
        simulation.alpha(params.alpha || 0.3).restart();
    }
}

function updateLayout(payload) {
    if (!simulation) return;
    
    const { mode, width, settings } = payload;
    layoutMode = mode;
    
    console.log(`[Worker] Switching layout to: ${mode}`);

    if (mode === 'dag') {
        const layerHeight = 120;
        simulation.force("center", null);
        simulation.force("y", d3.forceY(d => (d.rank || 0) * layerHeight).strength(1));
        simulation.force("x", d3.forceX(width / 2).strength(0.05));
        
        // Weak links for DAG usually
        simulation.force("link").strength(0.3);

    } else {
        // Force Mode
        simulation.force("y", null);
        simulation.force("x", null);
        simulation.force("center", d3.forceCenter(width / 2, 600)); // Need height, assume center
        
        simulation.force("link").strength(1);
    }
    
    // Apply common physics settings
    if (settings) updateParams({ ...settings, restart: false });

    // Restart only if requested (default true)
    if (payload.restart !== false) {
        simulation.alpha(1).restart();
    } else {
        simulation.stop();
    }
}

function setNodes(payload) {
    const { nodes: newNodes, links: newLinks } = payload;
    // Map simplified objects if necessary, or assume payload is clean
    nodes = newNodes; // These should have x, y, fx, fy
    links = newLinks;
    
    console.log(`[Worker] setNodes: ${nodes.length} nodes, ${links.length} links`);

    // Re-initialize key forces
    simulation.nodes(nodes);
    simulation.force("link").links(links);
    
    // If we want to support collision updates based on new subset
    // simulation.force("collide")...
    
    // Check if restart is requested (default true)
    if (payload.restart !== false) {
        simulation.alpha(0.3).restart();
    } else {
        simulation.stop(); // Ensure it's stopped if requested
    }
}

function handleDrag(type, payload) {
    if (!simulation) return;
    const { id, x, y } = payload;
    const node = nodes.find(n => n.id === id);
    if (!node) return;

    if (type === 'dragStart') {
        if (!payload.active) simulation.alphaTarget(0.3).restart();
        node.fx = x;
        node.fy = y;
    } else if (type === 'drag') {
        node.fx = x;
        node.fy = y;
    } else if (type === 'dragEnd') {
        if (!payload.active) simulation.alphaTarget(0);
        
        // Only release node if main thread says so (not Frozen, not Focus Mode)
        if (payload.shouldClear) {
            node.fx = null;
            node.fy = null;
        }
    }
}

function fixNodes(nodeUpdates) {
    // Used for fixing multiple nodes (e.g. Viewport culling)
    nodeUpdates.forEach(update => {
        const node = nodes.find(n => n.id === update.id);
        if (node) {
            if (update.cod === 'fix') {
                 node.fx = update.x;
                 node.fy = update.y;
            } else if (update.cmd === 'unfix') {
                 node.fx = null;
                 node.fy = null;
            }
        }
    });
}
