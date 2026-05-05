/**
 * path_layout.mjs — Extracted path layout calculation utilities.
 * Tree layout, orbital positioning, and node arrangement algorithms.
 * Formerly inline in path_app.js.
 */

/** Compute a simple tree layout from a flat node list with parent-child edges. */
export function computeTreeLayout(nodes, edges, rootId, options = {}) {
    const { horizontalSpacing = 180, verticalSpacing = 120 } = options;
    const adjacency = new Map();
    const inDegree = new Map();
    const positions = new Map();

    for (const node of nodes) {
        adjacency.set(node.id, []);
        inDegree.set(node.id, 0);
    }

    for (const edge of edges) {
        const children = adjacency.get(edge.source);
        if (children) children.push(edge.target);
        inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }

    // BFS from root to assign layers
    const layers = [];
    const visited = new Set();
    const queue = [{ id: rootId, layer: 0 }];
    visited.add(rootId);

    while (queue.length > 0) {
        const { id, layer } = queue.shift();
        if (!layers[layer]) layers[layer] = [];
        layers[layer].push(id);

        const children = adjacency.get(id) || [];
        for (const childId of children) {
            if (!visited.has(childId)) {
                visited.add(childId);
                queue.push({ id: childId, layer: layer + 1 });
            }
        }
    }

    // Position nodes within layers
    for (let i = 0; i < layers.length; i++) {
        const layerNodes = layers[i];
        const totalWidth = (layerNodes.length - 1) * horizontalSpacing;
        const startX = -totalWidth / 2;

        for (let j = 0; j < layerNodes.length; j++) {
            positions.set(layerNodes[j], {
                x: startX + j * horizontalSpacing,
                y: i * verticalSpacing,
                layer: i,
                index: j,
            });
        }
    }

    return { positions, layers, nodeCount: nodes.length, depth: layers.length };
}

/**
 * Compute orbital positions for path visualization.
 * Nodes orbit around a central point with increasing radius per layer.
 */
export function computeOrbitalLayout(nodes, edges, centerId, options = {}) {
    const { baseRadius = 200, radiusIncrement = 150, nodesPerOrbit = 8 } = options;

    const treeResult = computeTreeLayout(nodes, edges, centerId, options);
    const positions = new Map();

    for (const [nodeId, treePos] of treeResult.positions) {
        const angle = (treePos.index / Math.max(1, treeResult.layers[treePos.layer]?.length || 1)) * Math.PI * 2;
        const radius = baseRadius + treePos.layer * radiusIncrement;
        positions.set(nodeId, {
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
            z: treePos.layer * 50,
            layer: treePos.layer,
            angle,
            radius,
        });
    }

    return { positions, depth: treeResult.depth, centerId };
}

/**
 * Compute a force-directed radial layout for hierarchical path data.
 */
export function computeRadialLayout(nodes, edges, centerId, options = {}) {
    const { radius = 300, spread = 60 } = options;
    const adjacency = new Map();

    for (const node of nodes) adjacency.set(node.id, []);
    for (const edge of edges) {
        const children = adjacency.get(edge.source);
        if (children) children.push(edge.target);
    }

    const positions = new Map();
    positions.set(centerId, { x: 0, y: 0, z: 0, isCenter: true });

    const visited = new Set([centerId]);
    const queue = [{ id: centerId, depth: 0, angleStart: 0, angleEnd: Math.PI * 2 }];

    while (queue.length > 0) {
        const { id, depth, angleStart, angleEnd } = queue.shift();
        const children = adjacency.get(id) || [];
        const angleRange = angleEnd - angleStart;

        for (let i = 0; i < children.length; i++) {
            const childId = children[i];
            if (visited.has(childId)) continue;
            visited.add(childId);

            const angle = angleStart + (i + 0.5) * (angleRange / children.length);
            const r = radius + depth * spread;
            positions.set(childId, { x: Math.cos(angle) * r, y: Math.sin(angle) * r, z: depth * 40, depth: depth + 1, angle });

            const childRange = angleRange / children.length;
            queue.push({ id: childId, depth: depth + 1, angleStart: angleStart + i * childRange, angleEnd: angleStart + (i + 1) * childRange });
        }
    }

    return { positions, nodeCount: nodes.length };
}

/**
 * Get the bounding box of computed positions for viewport fitting.
 */
export function getLayoutBounds(positions) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pos of positions.values()) {
        if (pos.x < minX) minX = pos.x;
        if (pos.y < minY) minY = pos.y;
        if (pos.x > maxX) maxX = pos.x;
        if (pos.y > maxY) maxY = pos.y;
    }
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}
