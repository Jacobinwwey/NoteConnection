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

let startupProfile = {
    id: 'default',
    pilotEnabled: false,
    tickMaxFps: 0,
    lowAlphaTickMaxFps: 0,
    lowAlphaThreshold: 0.08,
    stableAlphaThreshold: 0.05,
    stableHoldTicks: 8,
    stableTimeoutMs: 12000,
    deltaEnabled: false,
    deltaEpsilonPx: 0.6,
    fullSyncEveryTicks: 3,
    lowAlphaDeltaEpsilonMultiplier: 1.35,
    lowAlphaFullSyncEveryTicks: 5
};

let startupRuntimeState = {
    tickMinIntervalMs: 0,
    lowAlphaTickMinIntervalMs: 0,
    lastTickEmitTs: 0,
    initTs: 0,
    stableTickStreak: 0,
    stableAnnounced: false,
    tickCount: 0,
    prevPositions: new Map()
};

function parseFiniteNumber(value, fallback) {
    if (Number.isFinite(value)) {
        return value;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parsePositiveInt(value, fallback) {
    const parsed = Math.floor(parseFiniteNumber(value, fallback));
    return parsed > 0 ? parsed : fallback;
}

function configureStartupProfile(profile) {
    const next = {
        id: (profile && typeof profile.id === 'string' && profile.id.trim().length > 0)
            ? profile.id.trim()
            : 'default',
        pilotEnabled: Boolean(profile && profile.pilotEnabled === true),
        tickMaxFps: Math.max(0, parsePositiveInt(profile ? profile.tickMaxFps : 0, 0)),
        lowAlphaTickMaxFps: Math.max(0, parsePositiveInt(profile ? profile.lowAlphaTickMaxFps : 0, 0)),
        lowAlphaThreshold: Math.max(0.0001, parseFiniteNumber(profile ? profile.lowAlphaThreshold : 0.08, 0.08)),
        stableAlphaThreshold: Math.max(0.0001, parseFiniteNumber(profile ? profile.stableAlphaThreshold : 0.05, 0.05)),
        stableHoldTicks: Math.max(1, parsePositiveInt(profile ? profile.stableHoldTicks : 8, 8)),
        stableTimeoutMs: Math.max(1000, parsePositiveInt(profile ? profile.stableTimeoutMs : 12000, 12000)),
        deltaEnabled: Boolean(profile && profile.deltaEnabled === true),
        deltaEpsilonPx: Math.max(0.0001, parseFiniteNumber(profile ? profile.deltaEpsilonPx : 0.6, 0.6)),
        fullSyncEveryTicks: Math.max(1, parsePositiveInt(profile ? profile.fullSyncEveryTicks : 3, 3)),
        lowAlphaDeltaEpsilonMultiplier: Math.max(
            1,
            parseFiniteNumber(profile ? profile.lowAlphaDeltaEpsilonMultiplier : 1.35, 1.35)
        ),
        lowAlphaFullSyncEveryTicks: Math.max(
            1,
            parsePositiveInt(
                profile ? profile.lowAlphaFullSyncEveryTicks : Math.max(4, parsePositiveInt(profile ? profile.fullSyncEveryTicks : 3, 3)),
                Math.max(4, parsePositiveInt(profile ? profile.fullSyncEveryTicks : 3, 3))
            )
        )
    };

    startupProfile = next;
    startupRuntimeState = {
        tickMinIntervalMs: next.tickMaxFps > 0 ? Math.max(1, Math.floor(1000 / next.tickMaxFps)) : 0,
        lowAlphaTickMinIntervalMs: next.lowAlphaTickMaxFps > 0 ? Math.max(1, Math.floor(1000 / next.lowAlphaTickMaxFps)) : 0,
        lastTickEmitTs: 0,
        initTs: Date.now(),
        stableTickStreak: 0,
        stableAnnounced: false,
        tickCount: 0,
        prevPositions: new Map()
    };

    console.log('[Worker] Startup profile configured:', {
        id: next.id,
        pilotEnabled: next.pilotEnabled,
        tickMaxFps: next.tickMaxFps,
        tickMinIntervalMs: startupRuntimeState.tickMinIntervalMs,
        lowAlphaTickMaxFps: next.lowAlphaTickMaxFps,
        lowAlphaTickMinIntervalMs: startupRuntimeState.lowAlphaTickMinIntervalMs,
        lowAlphaThreshold: next.lowAlphaThreshold,
        stableAlphaThreshold: next.stableAlphaThreshold,
        stableHoldTicks: next.stableHoldTicks,
        stableTimeoutMs: next.stableTimeoutMs,
        deltaEnabled: next.deltaEnabled,
        deltaEpsilonPx: next.deltaEpsilonPx,
        fullSyncEveryTicks: next.fullSyncEveryTicks,
        lowAlphaDeltaEpsilonMultiplier: next.lowAlphaDeltaEpsilonMultiplier,
        lowAlphaFullSyncEveryTicks: next.lowAlphaFullSyncEveryTicks
    });
}

function resolveTickMinIntervalMs(alpha) {
    const highAlphaIntervalMs = startupRuntimeState.tickMinIntervalMs;
    const lowAlphaIntervalMs = startupRuntimeState.lowAlphaTickMinIntervalMs;
    if (lowAlphaIntervalMs <= 0) {
        return highAlphaIntervalMs;
    }
    if (alpha <= startupProfile.lowAlphaThreshold) {
        return Math.max(highAlphaIntervalMs, lowAlphaIntervalMs);
    }
    return highAlphaIntervalMs;
}

function resolveDeltaEpsilonPx(alpha) {
    let epsilon = startupProfile.deltaEpsilonPx;
    if (alpha <= startupProfile.lowAlphaThreshold) {
        epsilon *= startupProfile.lowAlphaDeltaEpsilonMultiplier;
    }
    return Math.max(0.0001, epsilon);
}

function resolveFullSyncEveryTicks(alpha) {
    if (alpha <= startupProfile.lowAlphaThreshold) {
        return Math.max(startupProfile.fullSyncEveryTicks, startupProfile.lowAlphaFullSyncEveryTicks);
    }
    return startupProfile.fullSyncEveryTicks;
}

function buildFullPositionPayload() {
    const payload = new Array(nodes.length);
    for (let index = 0; index < nodes.length; index += 1) {
        const n = nodes[index];
        const x = Number.isFinite(n.x) ? n.x : 0;
        const y = Number.isFinite(n.y) ? n.y : 0;
        payload[index] = { id: n.id, i: index, x, y };
        startupRuntimeState.prevPositions.set(n.id, { x, y });
    }
    return payload;
}

function buildDeltaPositionPayload(alpha) {
    const payload = [];
    const epsilon = resolveDeltaEpsilonPx(alpha);
    for (let index = 0; index < nodes.length; index += 1) {
        const n = nodes[index];
        const x = Number.isFinite(n.x) ? n.x : 0;
        const y = Number.isFinite(n.y) ? n.y : 0;
        const prev = startupRuntimeState.prevPositions.get(n.id);
        if (!prev || Math.abs(prev.x - x) >= epsilon || Math.abs(prev.y - y) >= epsilon) {
            payload.push({ id: n.id, i: index, x, y });
            startupRuntimeState.prevPositions.set(n.id, { x, y });
        }
    }
    return payload;
}

function buildTickPositionsPayload(alpha) {
    startupRuntimeState.tickCount += 1;
    const activeFullSyncEveryTicks = resolveFullSyncEveryTicks(alpha);
    const forceFull =
        startupRuntimeState.tickCount === 1 ||
        startupProfile.deltaEnabled !== true ||
        activeFullSyncEveryTicks <= 1 ||
        (startupRuntimeState.tickCount % activeFullSyncEveryTicks) === 0;

    if (forceFull) {
        return {
            nodes: buildFullPositionPayload(),
            isDelta: false,
            tickMode: 'full'
        };
    }

    const deltaNodes = buildDeltaPositionPayload(alpha);
    const changeRatio = nodes.length > 0 ? (deltaNodes.length / nodes.length) : 0;
    if (changeRatio >= 0.7) {
        return {
            nodes: buildFullPositionPayload(),
            isDelta: false,
            tickMode: 'full'
        };
    }

    return {
        nodes: deltaNodes,
        isDelta: true,
        tickMode: 'delta'
    };
}

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
    const { settings, startupProfile: startupProfilePayload } = data; // Settings if provided

    console.log(`[Worker] Initializing simulation with ${nodes.length} nodes, ${links.length} edges`);

    configureStartupProfile(startupProfilePayload || {});

    if (settings) {
        currentSettings = { ...currentSettings, ...settings };
    }

    // Adaptive Repulsion Scaling based on node count
    // For larger graphs, increase repulsion strength to improve spacing
    // Formula: base * (1 + log10(nodes/1000)) if nodes > 1000, capped at 3x
    const baseRepulsion = currentSettings.repulsion;
    if (nodes.length > 1000) {
        const scaleFactor = Math.min(3.0, 1 + Math.log10(nodes.length / 1000));
        currentSettings.repulsion = Math.floor(baseRepulsion * scaleFactor);
        console.log(`[Worker] Adaptive Repulsion: ${baseRepulsion} -> ${currentSettings.repulsion} (${nodes.length} nodes, scale: ${scaleFactor.toFixed(2)}x)`);
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
        const now = Date.now();
        const alpha = (simulation && typeof simulation.alpha === 'function')
            ? simulation.alpha()
            : 1;
        const activeTickMinIntervalMs = resolveTickMinIntervalMs(alpha);
        if (
            activeTickMinIntervalMs > 0 &&
            (now - startupRuntimeState.lastTickEmitTs) < activeTickMinIntervalMs
        ) {
            return;
        }
        startupRuntimeState.lastTickEmitTs = now;

        let isStartupStable = false;

        if (!startupRuntimeState.stableAnnounced) {
            if (alpha <= startupProfile.stableAlphaThreshold) {
                startupRuntimeState.stableTickStreak += 1;
            } else {
                startupRuntimeState.stableTickStreak = 0;
            }

            const elapsedMs = now - startupRuntimeState.initTs;
            if (
                startupRuntimeState.stableTickStreak >= startupProfile.stableHoldTicks ||
                elapsedMs >= startupProfile.stableTimeoutMs
            ) {
                startupRuntimeState.stableAnnounced = true;
                isStartupStable = true;
                postMessage({
                    type: 'startupStable',
                    alpha,
                    elapsedMs
                });
            }
        }

        const tickPositions = buildTickPositionsPayload(alpha);
        postMessage({
            type: 'tick',
            nodes: tickPositions.nodes,
            isDelta: tickPositions.isDelta,
            tickMode: tickPositions.tickMode,
            alpha,
            emittedAt: now,
            isStartupStable
        });
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
    startupRuntimeState.prevPositions = new Map();
    startupRuntimeState.tickCount = 0;
    
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
            if (update.cmd === 'fix') {
                 node.fx = update.x;
                 node.fy = update.y;
            } else if (update.cmd === 'unfix') {
                 node.fx = null;
                 node.fy = null;
            }
        }
    });
}
