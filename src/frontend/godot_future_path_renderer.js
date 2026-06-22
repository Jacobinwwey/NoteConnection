(function () {
    const NODE_WIDTH = 140;
    const NODE_HEIGHT = 50;
    const NODE_PADDING_X = 24;
    const NODE_PADDING_Y = 24;
    const SURFACE_PADDING = 120;
    const MIN_SURFACE_WIDTH = 760;
    const MIN_SURFACE_HEIGHT = 460;

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizeText(value) {
        return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    }

    function normalizeBoolean(value) {
        return value === true || value === 'true' || value === 1 || value === '1';
    }

    function normalizeTextList(value) {
        return Array.isArray(value)
            ? value.map((item) => normalizeText(item)).filter(Boolean)
            : [];
    }

    function normalizeNode(rawNode) {
        const id = normalizeText(rawNode && (rawNode.id || rawNode.nodeId || rawNode.key));
        const x = Number(rawNode && rawNode.x);
        const y = Number(rawNode && rawNode.y);
        if (!id || !Number.isFinite(x) || !Number.isFinite(y)) {
            return null;
        }
        return {
            id,
            label: normalizeText(rawNode && (rawNode.label || rawNode.title || rawNode.name || id)) || id,
            x,
            y,
            isSpine: normalizeBoolean(rawNode && rawNode.isSpine),
            hasPrereqs: normalizeBoolean(rawNode && rawNode.hasPrereqs),
            isExpanded: normalizeBoolean(rawNode && rawNode.isExpanded),
            inDegree: Number(rawNode && rawNode.inDegree),
            outDegree: Number(rawNode && rawNode.outDegree),
            inDegreeNames: normalizeTextList(rawNode && rawNode.inDegreeNames),
            outDegreeNames: normalizeTextList(rawNode && rawNode.outDegreeNames),
            inDegreeIds: normalizeTextList(rawNode && rawNode.inDegreeIds),
            outDegreeIds: normalizeTextList(rawNode && rawNode.outDegreeIds),
        };
    }

    function normalizeEdge(rawEdge) {
        const from = normalizeText(rawEdge && (rawEdge.from || rawEdge.source || rawEdge.sourceId));
        const to = normalizeText(rawEdge && (rawEdge.to || rawEdge.target || rawEdge.targetId));
        if (!from || !to) {
            return null;
        }
        return { from, to };
    }

    function normalizeHull(rawHull, nodeIds) {
        const groupNodeId = normalizeText(rawHull && rawHull.groupNodeId);
        const memberIds = Array.isArray(rawHull && rawHull.memberIds)
            ? rawHull.memberIds.map((id) => normalizeText(id)).filter((id) => id && nodeIds.has(id))
            : [];
        if (!groupNodeId || memberIds.length <= 0) {
            return null;
        }
        return { groupNodeId, memberIds };
    }

    function createHullMap(hulls) {
        const hullMap = new Map();
        hulls.forEach((hull) => {
            hullMap.set(hull.groupNodeId, hull.memberIds.slice());
        });
        return hullMap;
    }

    function collectValidHullMembers(hullMap, rootId) {
        const members = [];
        const visited = new Set();
        const stack = [rootId];
        while (stack.length > 0) {
            const current = stack.pop();
            if (!current || visited.has(current)) {
                continue;
            }
            visited.add(current);
            if (!hullMap.has(current)) {
                continue;
            }
            hullMap.get(current).forEach((memberId) => {
                if (!memberId || memberId === current || visited.has(memberId)) {
                    return;
                }
                members.push(memberId);
                stack.push(memberId);
            });
        }
        return Array.from(new Set(members));
    }

    function resolveActiveHullRoot(layout, hoveredNodeId) {
        const rawNodes = Array.isArray(layout && layout.nodes) ? layout.nodes : [];
        const nodeIds = new Set(rawNodes.map((node) => normalizeText(node && (node.id || node.nodeId || node.key))).filter(Boolean));
        const hulls = (Array.isArray(layout && layout.hulls) ? layout.hulls : [])
            .map((hull) => normalizeHull(hull, nodeIds))
            .filter(Boolean);
        if (hulls.length <= 0) {
            return '';
        }
        const hullMap = createHullMap(hulls);
        let largestRootId = '';
        let largestDescendantCount = -1;
        hulls.forEach((hull) => {
            const descendants = collectValidHullMembers(hullMap, hull.groupNodeId);
            if (descendants.length > largestDescendantCount) {
                largestDescendantCount = descendants.length;
                largestRootId = hull.groupNodeId;
            }
        });
        const hoveredId = normalizeText(hoveredNodeId);
        if (!hoveredId) {
            return largestRootId;
        }
        let smallestRootId = '';
        let smallestDescendantCount = Number.MAX_SAFE_INTEGER;
        hulls.forEach((hull) => {
            const descendants = collectValidHullMembers(hullMap, hull.groupNodeId);
            if ((hull.groupNodeId === hoveredId || descendants.includes(hoveredId)) && descendants.length < smallestDescendantCount) {
                smallestDescendantCount = descendants.length;
                smallestRootId = hull.groupNodeId;
            }
        });
        return smallestRootId || largestRootId;
    }

    function cross(origin, left, right) {
        return (left.x - origin.x) * (right.y - origin.y) - (left.y - origin.y) * (right.x - origin.x);
    }

    function convexHull(points) {
        const sorted = points
            .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
            .sort((left, right) => left.x === right.x ? left.y - right.y : left.x - right.x);
        if (sorted.length <= 2) {
            return sorted;
        }
        const lower = [];
        sorted.forEach((point) => {
            while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
                lower.pop();
            }
            lower.push(point);
        });
        const upper = [];
        for (let index = sorted.length - 1; index >= 0; index -= 1) {
            const point = sorted[index];
            while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
                upper.pop();
            }
            upper.push(point);
        }
        upper.pop();
        lower.pop();
        return lower.concat(upper);
    }

    function buildHullPolygonPoints(memberIds, nodeById, edges) {
        const memberSet = new Set(memberIds);
        const rx = (NODE_WIDTH * 0.5) + NODE_PADDING_X;
        const ry = (NODE_HEIGHT * 0.5) + NODE_PADDING_Y;
        const points = [];
        memberIds.forEach((nodeId) => {
            const node = nodeById.get(nodeId);
            if (!node) {
                return;
            }
            points.push(
                { x: node.projectedX - rx, y: node.projectedY - ry },
                { x: node.projectedX + rx, y: node.projectedY - ry },
                { x: node.projectedX + rx, y: node.projectedY + ry },
                { x: node.projectedX - rx, y: node.projectedY + ry }
            );
        });
        edges.forEach((edge) => {
            if (!memberSet.has(edge.from) || !memberSet.has(edge.to)) {
                return;
            }
            const fromNode = nodeById.get(edge.from);
            const toNode = nodeById.get(edge.to);
            if (!fromNode || !toNode) {
                return;
            }
            const dx = toNode.projectedX - fromNode.projectedX;
            const dy = toNode.projectedY - fromNode.projectedY;
            const length = Math.sqrt((dx * dx) + (dy * dy)) || 1;
            const perpX = (-dy / length) * ry * 0.8;
            const perpY = (dx / length) * ry * 0.8;
            points.push(
                { x: fromNode.projectedX + perpX, y: fromNode.projectedY + perpY },
                { x: fromNode.projectedX - perpX, y: fromNode.projectedY - perpY },
                { x: toNode.projectedX - perpX, y: toNode.projectedY - perpY },
                { x: toNode.projectedX + perpX, y: toNode.projectedY + perpY }
            );
        });
        return convexHull(points);
    }

    function projectTreeLayout(layout, options = {}) {
        const currentId = normalizeText(options.currentId || options.targetId || layout && (layout.currentId || layout.targetId));
        const completedIds = new Set((Array.isArray(options.completedIds) ? options.completedIds : [])
            .map((id) => normalizeText(id))
            .filter(Boolean));
        const nodes = (Array.isArray(layout && layout.nodes) ? layout.nodes : [])
            .map(normalizeNode)
            .filter(Boolean);
        if (nodes.length <= 0) {
            return null;
        }
        const nodeIds = new Set(nodes.map((node) => node.id));
        const edges = (Array.isArray(layout && layout.edges) ? layout.edges : [])
            .map(normalizeEdge)
            .filter((edge) => edge && nodeIds.has(edge.from) && nodeIds.has(edge.to));
        const hulls = (Array.isArray(layout && layout.hulls) ? layout.hulls : [])
            .map((hull) => normalizeHull(hull, nodeIds))
            .filter(Boolean);
        const minX = Math.min(...nodes.map((node) => node.x));
        const maxX = Math.max(...nodes.map((node) => node.x));
        const minY = Math.min(...nodes.map((node) => node.y));
        const maxY = Math.max(...nodes.map((node) => node.y));
        const surfaceWidth = Math.max(MIN_SURFACE_WIDTH, (maxX - minX) + (SURFACE_PADDING * 2));
        const surfaceHeight = Math.max(MIN_SURFACE_HEIGHT, (maxY - minY) + (SURFACE_PADDING * 2));
        const projectedNodes = nodes.map((node) => ({
            ...node,
            projectedX: node.x - minX + SURFACE_PADDING,
            projectedY: node.y - minY + SURFACE_PADDING,
            isCurrent: node.id === currentId,
            isCompleted: completedIds.has(node.id),
        }));
        const nodeById = new Map(projectedNodes.map((node) => [node.id, node]));
        const currentNode = currentId ? nodeById.get(currentId) : null;
        const highlightIds = new Set();
        if (currentId) {
            highlightIds.add(currentId);
            edges.forEach((edge) => {
                if (edge.to === currentId) {
                    highlightIds.add(edge.from);
                }
            });
        }
        const hullMap = createHullMap(hulls);
        const activeHullRootId = resolveActiveHullRoot({ nodes: projectedNodes, hulls }, options.hoveredNodeId);
        const projectedHulls = hulls.map((hull) => {
            const memberIds = collectValidHullMembers(hullMap, hull.groupNodeId)
                .filter((nodeId) => nodeById.has(nodeId));
            const polygon = buildHullPolygonPoints(memberIds, nodeById, edges);
            return {
                ...hull,
                memberIds,
                polygon,
                isActive: hull.groupNodeId === activeHullRootId,
            };
        }).filter((hull) => hull.memberIds.length > 0 && hull.polygon.length >= 3);
        return {
            currentId,
            completedIds: Array.from(completedIds),
            nodes: projectedNodes,
            edges,
            hulls: projectedHulls,
            activeHullRootId,
            surfaceWidth,
            surfaceHeight,
            currentX: currentNode ? currentNode.projectedX : 0,
            currentY: currentNode ? currentNode.projectedY : 0,
            focusModeEnabled: options.focusModeEnabled !== false,
        };
    }

    function buildBezierPath(fromNode, toNode) {
        const primaryDistance = (toNode.projectedX - fromNode.projectedX) * 0.5;
        if (Math.abs(primaryDistance * 2) > 300) {
            return '';
        }
        const cp1x = fromNode.projectedX + primaryDistance;
        const cp1y = fromNode.projectedY;
        const cp2x = toNode.projectedX - primaryDistance;
        const cp2y = toNode.projectedY;
        return [
            'M', fromNode.projectedX.toFixed(2), fromNode.projectedY.toFixed(2),
            'C', cp1x.toFixed(2), cp1y.toFixed(2),
            cp2x.toFixed(2), cp2y.toFixed(2),
            toNode.projectedX.toFixed(2), toNode.projectedY.toFixed(2),
        ].join(' ');
    }

    function wrapNodeLabel(label) {
        const words = normalizeText(label).split(/\s+/).filter(Boolean);
        if (words.length <= 0) {
            return [];
        }
        const lines = [];
        let currentLine = '';
        const maxChars = 16;
        words.forEach((word) => {
            const candidate = currentLine ? `${currentLine} ${word}` : word;
            if (candidate.length > maxChars && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = candidate;
            }
        });
        if (currentLine) {
            lines.push(currentLine);
        }
        if (lines.length <= 2) {
            return lines;
        }
        return [lines[0], `${lines.slice(1).join(' ').slice(0, maxChars - 1)}...`];
    }

    function buildNodeLabelHtml(label) {
        const lines = wrapNodeLabel(label);
        if (lines.length <= 0) {
            return '';
        }
        return lines.map((line) => `<span class="agent-godot-future-path-node-label-line">${escapeHtml(line)}</span>`).join('');
    }

    function buildNodeHoverHtml(node) {
        const inNames = node.inDegreeNames.slice(0, 4);
        const outNames = node.outDegreeNames.slice(0, 4);
        const inCount = Number.isFinite(node.inDegree) ? node.inDegree : node.inDegreeNames.length;
        const outCount = Number.isFinite(node.outDegree) ? node.outDegree : node.outDegreeNames.length;
        const inText = inNames.length > 0 ? inNames.join(', ') : 'none';
        const outText = outNames.length > 0 ? outNames.join(', ') : 'none';
        return `
            <span class="agent-godot-future-path-node-popover" aria-hidden="true">
                <strong>${escapeHtml(node.label)}</strong>
                <span>${escapeHtml(`In ${inCount} / Out ${outCount}`)}</span>
                <span>${escapeHtml(`<- ${inText}`)}</span>
                <span>${escapeHtml(`-> ${outText}`)}</span>
            </span>
        `;
    }

    function buildUnavailableHtml(options = {}) {
        const title = normalizeText(options.targetLabel) || 'Future Path';
        const message = normalizeText(options.unavailableLabel) || 'Godot Future Path target is unavailable.';
        const reason = normalizeText(options.reason);
        return `
            <div
                class="agent-godot-future-path-shell"
                data-agent-godot-future-path-shell="true"
                data-agent-godot-future-path-hosted="true"
                data-godot-tree-renderer="false"
            >
                <div class="agent-godot-future-path-title">${escapeHtml(title)}</div>
                <div class="agent-godot-future-path-status" data-agent-godot-future-path-status="true">
                    ${escapeHtml(message)}${reason ? ` (${escapeHtml(reason)})` : ''}
                </div>
            </div>
        `;
    }

    function buildSurfaceHtml(input = {}) {
        const projection = projectTreeLayout(input.treeLayout || input.layout, {
            currentId: input.currentId || input.targetId,
            targetId: input.targetId,
            completedIds: input.completedIds,
            hoveredNodeId: input.hoveredNodeId,
            focusModeEnabled: input.focusModeEnabled !== false,
        });
        if (!projection) {
            return buildUnavailableHtml(input);
        }
        const selectedNodeId = normalizeText(input.selectedNodeId);
        const lastSignal = input.lastSignal && typeof input.lastSignal === 'object'
            ? normalizeText(input.lastSignal.signal)
            : normalizeText(input.lastSignal);
        const nodeById = new Map(projection.nodes.map((node) => [node.id, node]));
        const edgeHtml = projection.edges.map((edge) => {
            const fromNode = nodeById.get(edge.from);
            const toNode = nodeById.get(edge.to);
            if (!fromNode || !toNode) {
                return '';
            }
            const path = buildBezierPath(fromNode, toNode);
            if (!path) {
                return '';
            }
            const bright = edge.to === projection.currentId;
            return `
                <path
                    class="agent-godot-future-path-edge${bright ? ' agent-godot-future-path-edge--active' : ''}"
                    d="${path}"
                    data-godot-tree-edge-from="${escapeHtml(edge.from)}"
                    data-godot-tree-edge-to="${escapeHtml(edge.to)}"
                ></path>
            `;
        }).join('');
        const hullHtml = projection.hulls.map((hull) => `
            <polygon
                class="agent-godot-future-path-hull${hull.isActive ? ' agent-godot-future-path-hull--active' : ''}"
                points="${hull.polygon.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')}"
                data-godot-tree-hull-root="${escapeHtml(hull.groupNodeId)}"
                data-godot-tree-hull-members="${escapeHtml(hull.memberIds.join('|'))}"
            ></polygon>
        `).join('');
        const nodeHtml = projection.nodes.map((node) => {
            const highlight = !projection.focusModeEnabled || !projection.currentId || projection.edges.some((edge) => (
                edge.to === projection.currentId && edge.from === node.id
            )) || node.id === projection.currentId;
            const classes = [
                'agent-godot-future-path-node',
                'agent-godot-tree-node',
                node.isSpine ? 'agent-godot-future-path-node--spine' : 'agent-godot-future-path-node--tributary',
                node.isCurrent ? 'agent-godot-future-path-node--current' : '',
                node.isCompleted ? 'agent-godot-future-path-node--completed' : '',
                node.isExpanded ? 'agent-godot-future-path-node--expanded' : '',
                node.id === selectedNodeId ? 'agent-godot-future-path-node--selected' : '',
                !highlight ? 'agent-godot-future-path-node--dimmed' : '',
            ].filter(Boolean).join(' ');
            return `
                <button
                    type="button"
                    class="${classes}"
                    data-godot-tree-node-id="${escapeHtml(node.id)}"
                    data-agent-future-path-node-id="${escapeHtml(node.id)}"
                    data-agent-future-path-node-spine="${node.isSpine ? 'true' : 'false'}"
                    data-agent-future-path-node-has-prereqs="${node.hasPrereqs ? 'true' : 'false'}"
                    data-agent-future-path-node-expanded="${node.isExpanded ? 'true' : 'false'}"
                    data-godot-tree-node-current="${node.isCurrent ? 'true' : 'false'}"
                    data-godot-tree-node-spine="${node.isSpine ? 'true' : 'false'}"
                    data-godot-tree-node-has-prereqs="${node.hasPrereqs ? 'true' : 'false'}"
                    data-godot-tree-node-expanded="${node.isExpanded ? 'true' : 'false'}"
                    data-godot-tree-node-in-count="${Number.isFinite(node.inDegree) ? String(node.inDegree) : String(node.inDegreeNames.length)}"
                    data-godot-tree-node-out-count="${Number.isFinite(node.outDegree) ? String(node.outDegree) : String(node.outDegreeNames.length)}"
                    style="left: ${node.projectedX.toFixed(2)}px; top: ${node.projectedY.toFixed(2)}px;"
                    title="${escapeHtml(node.label)}"
                    aria-label="${escapeHtml(node.label)}"
                >
                    <span class="agent-godot-future-path-node-label">${buildNodeLabelHtml(node.label)}</span>
                    ${node.hasPrereqs || node.isExpanded ? `
                        <span
                            class="agent-godot-future-path-node-badge"
                            data-godot-tree-expansion-badge="true"
                            aria-hidden="true"
                        >${node.isExpanded ? '-' : '+'}</span>
                    ` : ''}
                    ${buildNodeHoverHtml(node)}
                </button>
            `;
        }).join('');
        const title = normalizeText(input.targetLabel) || normalizeText(input.title) || normalizeText(input.targetId) || 'Future Path';
        const status = normalizeText(input.statusLabel) || 'Godot Future Path requested: Diffusion / Core';
        return `
            <div
                class="agent-godot-future-path-shell"
                data-agent-godot-future-path-shell="true"
                data-agent-godot-future-path-hosted="true"
                data-godot-tree-renderer="true"
                data-godot-tree-active-hull-root="${escapeHtml(projection.activeHullRootId)}"
                data-godot-tree-selected-node-id="${escapeHtml(selectedNodeId)}"
                data-godot-tree-last-signal="${escapeHtml(lastSignal)}"
            >
                <div class="agent-godot-future-path-header">
                    <div class="agent-godot-future-path-title">${escapeHtml(title)}</div>
                    <div class="agent-godot-future-path-status" data-agent-godot-future-path-status="true">
                        ${escapeHtml(status)}
                    </div>
                </div>
                <div
                    class="agent-godot-future-path-viewport"
                    data-godot-tree-viewport="true"
                    data-godot-tree-zoom="1"
                    data-godot-tree-pan-x="0"
                    data-godot-tree-pan-y="0"
                    data-godot-tree-auto-fit="pending"
                >
                    <div
                        class="agent-godot-future-path-surface"
                        data-agent-godot-future-path-surface="true"
                        data-godot-tree-transform-target="true"
                        data-agent-godot-future-path-target-id="${escapeHtml(projection.currentId || input.targetId || '')}"
                        data-godot-tree-surface-width="${projection.surfaceWidth.toFixed(0)}"
                        data-godot-tree-surface-height="${projection.surfaceHeight.toFixed(0)}"
                        data-godot-tree-current-x="${projection.currentX.toFixed(2)}"
                        data-godot-tree-current-y="${projection.currentY.toFixed(2)}"
                        data-godot-tree-selected-node-id="${escapeHtml(selectedNodeId)}"
                        style="width: ${projection.surfaceWidth.toFixed(0)}px; height: ${projection.surfaceHeight.toFixed(0)}px;"
                    >
                        <svg
                            class="agent-godot-future-path-lines"
                            viewBox="0 0 ${projection.surfaceWidth.toFixed(0)} ${projection.surfaceHeight.toFixed(0)}"
                            preserveAspectRatio="xMinYMin meet"
                            aria-hidden="true"
                        >
                            ${hullHtml}
                            ${edgeHtml}
                        </svg>
                        ${nodeHtml}
                    </div>
                </div>
            </div>
        `;
    }

    function updateActiveHullRoot(root, activeRootId) {
        if (!root || typeof root.querySelectorAll !== 'function') {
            return;
        }
        const normalizedRootId = normalizeText(activeRootId);
        root.querySelectorAll('[data-godot-tree-hull-root]').forEach((hullNode) => {
            const isActive = normalizeText(hullNode.getAttribute('data-godot-tree-hull-root')) === normalizedRootId;
            hullNode.classList.toggle('agent-godot-future-path-hull--active', isActive);
        });
        const shell = root.matches && root.matches('[data-godot-tree-renderer="true"]')
            ? root
            : root.querySelector('[data-godot-tree-renderer="true"]');
        if (shell) {
            shell.setAttribute('data-godot-tree-active-hull-root', normalizedRootId);
        }
    }

    window.NoteConnectionGodotFuturePathRenderer = {
        projectTreeLayout,
        buildSurfaceHtml,
        buildUnavailableHtml,
        resolveActiveHullRoot,
        updateActiveHullRoot,
    };
}());
