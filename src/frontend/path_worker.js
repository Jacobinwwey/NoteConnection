/**
 * Path Mode Worker
 * Bundles Core Algorithms and Layout Logic
 */

importScripts("libs/d3.v7.min.js");
// We will rely on a bundled version of the core being importable
// The build script will generate 'libs/path_core.js' which defines 'Graph' and 'PathEngine' classes globally or via a shim
importScripts("libs/path_core.js");

let graph = null;
let engine = null;
let rawNodes = [];
let rawLinks = [];

onmessage = function(e) {
    const { type, payload } = e.data;

    try {
        switch (type) {
            case 'initData':
                initData(payload);
                break;
            case 'computePath':
                computePath(payload);
                break;
        }
    } catch (err) {
        console.error('Worker Error:', err);
    }
};

function initData(data) {
    // Reconstruct Graph object
    // Assuming Graph class is globally available from path_core.js
    graph = new Graph();
    data.nodes.forEach(n => graph.addNode(n));
    data.links.forEach(l => graph.addEdge(l.source, l.target, l.type, l.weight));
    
    engine = new PathEngine(graph);
    postMessage({ type: 'log', payload: `Graph Initialized: ${data.nodes.length} nodes` });
}

function computePath(config) {
    if (!engine) return;

    const { mode, strategy, layout, targetId } = config;
    const completedSet = new Set(config.completedIds || []);
    const forcedExpansionSet = new Set(config.forcedExpansionIds || []);
    let result;

    if (mode === 'domain') {
        result = engine.domainLearning(null, strategy);
    } else {
        // Validation for Diffusion Mode
        if (!targetId || targetId === 'null') {
            // console.warn(`[PathWorker] No target for Diffusion. Returning empty.`);
            result = { nodes: [], edges: [], coverage: 0 };
        } else if (!graph.hasNode(targetId)) {
            console.warn(`[PathWorker] Invalid target '${targetId}'. Returning empty.`);
            result = { nodes: [], edges: [], coverage: 0 };
        } else {
            console.log(`[PathWorker] Running Diffusion for target: ${targetId}, Algo: ${strategy}`);
            result = engine.diffusionLearning(targetId, strategy, completedSet, forcedExpansionSet);
            console.log(`[PathWorker] Diffusion result: ${result?.nodes?.length} nodes`);
        }
    }
    
    // Layout Calculation
    // We need to assign x,y coordinates to the result nodes
    // Structure: result.nodes is a linear sequence or a set.
    // For Tree layout, we need to reconstruct the hierarchy passed in result.edges (which are relevant dependencies)
    
    const layoutData = runLayout(result.nodes, result.edges, layout);
    
    // Compute Tree Layout for Godot (2D Layered DAG)
    let treeLayout = null;
    const centralId = config.centralId || (result.nodes.length > 0 ? result.nodes[0].id : null);
    const collapsedSet = new Set(config.collapsedIds || []); // New

    console.log('[PathWorker] Computing treeLayout. centralId:', centralId, 'result.nodes.length:', result.nodes?.length);

    if (engine && engine.getTreeLayout) {
        // Pass the raw result from domainLearning/diffusionLearning and collapsed state
        treeLayout = engine.getTreeLayout(centralId, result, collapsedSet);
        console.log('[PathWorker] treeLayout result:', treeLayout ? `${treeLayout.nodes?.length} nodes` : 'NULL');
    } else {
        console.warn('[PathWorker] engine.getTreeLayout not available!');
    }

    postMessage({ 
        type: 'pathResult', 
        payload: {
            nodes: layoutData.nodes,
            edges: layoutData.edges,
            treeLayout: treeLayout
        }
    });
}

function runLayout(nodes, edges, type) {
    // Convert to D3 Stratify structure if possible, or use d3-dag
    // Simple approach: Build a hierarchy from stepOrder or dependencies
    
    // Create a hierarchy object for D3
    // Root is a virtual node connecting to all step 1 nodes?
    // Or finds roots (in-degree 0) in the subgraph
    
    // 1. Map nodes for quick access
    const nodeMap = new Map();
    nodes.forEach(n => {
        // Clone to avoid mutating original logic objects if needed
        nodeMap.set(n.id, { ...n, children: [] });
    });
    
    // 2. Build Tree Structure
    // Note: Graph might be DAG, D3 Tree requires strict Tree.
    // We break cycles/multi-parents by just taking the first parent found in this path?
    // Or use graph layout. For MVP, we use a simple Level-based layout based on 'stepOrder'.
    
    if (type === 'horizontal' || type === 'vertical') {
        const levelHeight = 100;
        const levelWidth = 80;
        
        // Group by stepOrder
        const levels = [];
        nodes.forEach(node => {
            if (!levels[node.stepOrder]) levels[node.stepOrder] = [];
            levels[node.stepOrder].push(nodeMap.get(node.id));
        });
        
        // Assign coordinates
        levels.forEach((level, i) => {
            const y = i * levelHeight;
            const xStart = -(level.length * levelWidth) / 2;
            level.forEach((node, j) => {
                if (type === 'vertical') {
                    node.x = xStart + j * levelWidth;
                    node.y = y;
                } else {
                    node.x = y; 
                    node.y = xStart + j * levelWidth;
                }
            });
        });
    } else if (type === 'radial') {
         // Radial: Angle based on index, Radius based on step
         const radiusStep = 120;
         
         // Group by step for better radial distribution
         const levels = [];
         nodes.forEach(node => {
            const step = node.stepOrder || 1;
            if (!levels[step]) levels[step] = [];
            levels[step].push(nodeMap.get(node.id));
         });

         levels.forEach((level, stepIndex) => {
             if (!level) return;
             const r = stepIndex * radiusStep;
             level.forEach((node, i) => {
                 // Distribute nodes in this level around the circle
                 const angle = (i / level.length) * 2 * Math.PI; 
                 // Rotate slightly per level to avoid overlap
                 const offset = stepIndex * 0.2; 
                 
                 node.x = r * Math.cos(angle + offset);
                 node.y = r * Math.sin(angle + offset);
             });
         });
    } else if (type === 'orbital') {
        // Orbital: Central node at 0,0. Neighbors in orbit.
        // We need to identify the "Central" node. 
        // Strategy: First node in the list is assumed central/focus for now, 
        // OR the app should pass a 'focusId'.
        // For Path Mode, usually the first node (step 1) or the "current" node is central.
        // Let's assume nodes[0] is the center if not specified.
        
        const centerNode = nodes[0];
        if (centerNode) {
            nodeMap.get(centerNode.id).x = 0;
            nodeMap.get(centerNode.id).y = 0;
            
            const radius = 200;
            const peripherals = nodes.slice(1);
            peripherals.forEach((n, i) => {
                const node = nodeMap.get(n.id);
                const angle = (i / peripherals.length) * 2 * Math.PI;
                node.x = radius * Math.cos(angle);
                node.y = radius * Math.sin(angle);
            });
        }
    }
    
    return {
        nodes: Array.from(nodeMap.values()),
        edges: edges 
    };
}
