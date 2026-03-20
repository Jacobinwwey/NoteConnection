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
    postMessage({ type: 'log', payload: `Graph Initialized: ${data.nodes.length} nodes, ${graph.getEdges().length} edges` });
    if (graph.getEdges().length > 0) {
        const firstEdge = graph.getEdges()[0];
        postMessage({ type: 'log', payload: `Sample Edge: ${firstEdge.source} -> ${firstEdge.target} (${typeof firstEdge.source})` });
    }
}

function computePath(config) {
    if (!engine) return;

    const { mode, strategy, layout, targetIds } = config;
    let targetId = config.targetId;
    const completedSet = new Set(config.completedIds || []);
    const forcedExpansionSet = new Set(config.forcedExpansionIds || []);
    let result;

    if (mode === 'domain') {
        const domainTargets = Array.isArray(targetIds)
            ? targetIds
                .filter((id) => typeof id === 'string' && id.trim().length > 0)
                .map((id) => id.trim())
            : [];
        result = engine.domainLearning(domainTargets.length > 0 ? domainTargets : null, strategy);
    } else {
        const diffusionTargets = sanitizeTargetIds(targetIds);
        if (typeof targetId === 'string') {
            targetId = targetId.trim();
        } else {
            targetId = '';
        }
        if ((!targetId || targetId === 'null') && diffusionTargets.length > 0) {
            targetId = diffusionTargets[0];
        }
        if (targetId && targetId !== 'null' && !diffusionTargets.includes(targetId)) {
            diffusionTargets.unshift(targetId);
        }

        const validTargets = diffusionTargets.filter((id) => graph.hasNode(id));
        if (validTargets.length === 0) {
            console.warn('[PathWorker] No valid Diffusion targets. Returning empty.');
            result = { nodes: [], edges: [], coverage: 0 };
        } else if (validTargets.length === 1) {
            console.log(`[PathWorker] Running Diffusion for target: ${validTargets[0]}, Algo: ${strategy}`);
            result = engine.diffusionLearning(validTargets[0], strategy, completedSet, forcedExpansionSet);
            console.log(`[PathWorker] Diffusion result: ${result?.nodes?.length} nodes`);
        } else {
            console.log(`[PathWorker] Running multi-target Diffusion for ${validTargets.length} targets, Algo: ${strategy}`);
            const partialResults = validTargets.map((id) => engine.diffusionLearning(id, strategy, completedSet, forcedExpansionSet));
            result = mergePathResults(partialResults, strategy);
            console.log(`[PathWorker] Multi-target Diffusion result: ${result?.nodes?.length} nodes`);
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
    const expansionOrder = config.expansionOrder || [];
    const stickyClaimEnabled = config.stickyClaimEnabled !== false;
    const nodeSpacing = config.node_spacing || 240.0;

    console.log('[PathWorker] Computing treeLayout. centralId:', centralId, 'result.nodes.length:', result.nodes?.length);

    if (engine && engine.getTreeLayout) {
        // Pass the raw result from domainLearning/diffusionLearning and collapsed state
        try {
            treeLayout = engine.getTreeLayout(centralId, result, collapsedSet, expansionOrder, stickyClaimEnabled, { verticalGap: nodeSpacing });
            console.log('[PathWorker] treeLayout generated. Nodes:', treeLayout?.nodes?.length);
        } catch (err) {
            console.error('[PathWorker] getTreeLayout Error:', err);
        }
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

function sanitizeTargetIds(candidateIds) {
    if (!Array.isArray(candidateIds)) {
        return [];
    }
    const ids = [];
    const seen = new Set();
    candidateIds.forEach((id) => {
        if (typeof id !== 'string') return;
        const normalized = id.trim();
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        ids.push(normalized);
    });
    return ids;
}

function mergePathResults(results, strategy) {
    const nodeMap = new Map();
    const edgeMap = new Map();
    let maxCoverage = 0;

    results.forEach((result) => {
        if (!result || !Array.isArray(result.nodes) || !Array.isArray(result.edges)) {
            return;
        }
        if (typeof result.coverage === 'number' && Number.isFinite(result.coverage)) {
            maxCoverage = Math.max(maxCoverage, result.coverage);
        }

        result.nodes.forEach((node) => {
            if (!node || typeof node.id !== 'string') return;
            const existing = nodeMap.get(node.id);
            if (!existing) {
                nodeMap.set(node.id, { ...node });
                return;
            }
            const existingStep = Number.isFinite(existing.stepOrder) ? existing.stepOrder : Number.POSITIVE_INFINITY;
            const nextStep = Number.isFinite(node.stepOrder) ? node.stepOrder : Number.POSITIVE_INFINITY;
            if (nextStep < existingStep) {
                nodeMap.set(node.id, { ...existing, ...node });
            } else {
                nodeMap.set(node.id, { ...node, ...existing });
            }
        });

        result.edges.forEach((edge) => {
            if (!edge) return;
            const source = typeof edge.source === 'object' ? edge.source?.id : edge.source;
            const target = typeof edge.target === 'object' ? edge.target?.id : edge.target;
            if (typeof source !== 'string' || typeof target !== 'string') return;
            const normalizedSource = source.trim();
            const normalizedTarget = target.trim();
            if (!normalizedSource || !normalizedTarget) return;
            const edgeType = typeof edge.type === 'string' ? edge.type : '';
            const key = `${normalizedSource}->${normalizedTarget}::${edgeType}`;
            if (!edgeMap.has(key)) {
                edgeMap.set(key, {
                    ...edge,
                    source: normalizedSource,
                    target: normalizedTarget
                });
            }
        });
    });

    const nodes = Array.from(nodeMap.values()).sort((left, right) => {
        const leftStep = Number.isFinite(left?.stepOrder) ? left.stepOrder : Number.POSITIVE_INFINITY;
        const rightStep = Number.isFinite(right?.stepOrder) ? right.stepOrder : Number.POSITIVE_INFINITY;
        if (leftStep !== rightStep) return leftStep - rightStep;
        const leftLabel = String(left?.label || left?.id || '').toLowerCase();
        const rightLabel = String(right?.label || right?.id || '').toLowerCase();
        return leftLabel.localeCompare(rightLabel);
    });

    const edges = Array.from(edgeMap.values());
    return {
        nodes,
        edges,
        strategy,
        coverage: maxCoverage
    };
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
