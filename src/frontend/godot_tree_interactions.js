(function () {
    const CLICK_DRAG_THRESHOLD = 6;
    const LONG_PRESS_DURATION_MS = 650;

    function normalizeText(value) {
        return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    }

    function closestNode(target) {
        return target && typeof target.closest === 'function'
            ? target.closest('[data-godot-tree-node-id], [data-agent-future-path-node-id]')
            : null;
    }

    function readNodeId(nodeElement) {
        return normalizeText(
            nodeElement
            && (
                nodeElement.getAttribute('data-agent-future-path-node-id')
                || nodeElement.getAttribute('data-godot-tree-node-id')
            )
        );
    }

    function isSpineNode(nodeElement) {
        return nodeElement && (
            nodeElement.getAttribute('data-agent-future-path-node-spine') === 'true'
            || nodeElement.getAttribute('data-godot-tree-node-spine') === 'true'
        );
    }

    function isExpandedNode(nodeElement) {
        return nodeElement && nodeElement.getAttribute('data-agent-future-path-node-expanded') === 'true';
    }

    function emit(callbacks, name, nodeId, event) {
        const callback = callbacks && callbacks[name];
        if (typeof callback !== 'function') {
            return false;
        }
        callback(nodeId, event);
        return true;
    }

    function emitExpansionSignal(nodeElement, callbacks, event) {
        if (!isSpineNode(nodeElement)) {
            return false;
        }
        const nodeId = readNodeId(nodeElement);
        if (!nodeId) {
            return false;
        }
        return isExpandedNode(nodeElement)
            ? emit(callbacks, 'nodeCollapsePrereqsRequested', nodeId, event)
            : emit(callbacks, 'nodeExpandPrereqsRequested', nodeId, event);
    }

    function bindTreeRenderer(root, callbacks) {
        if (!root || typeof root.querySelectorAll !== 'function') {
            return;
        }
        let longPressState = null;
        let longPressTimer = null;
        let suppressClickNodeId = '';

        const clearLongPress = function () {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            longPressState = null;
        };

        root.querySelectorAll('[data-godot-tree-node-id], [data-agent-future-path-node-id]').forEach((nodeElement) => {
            nodeElement.addEventListener('mousedown', function (event) {
                if (event.button !== 0) {
                    return;
                }
                const nodeId = readNodeId(nodeElement);
                if (!nodeId) {
                    return;
                }
                clearLongPress();
                longPressState = {
                    nodeId,
                    clientX: Number(event.clientX) || 0,
                    clientY: Number(event.clientY) || 0,
                };
                longPressTimer = setTimeout(function () {
                    if (!longPressState || longPressState.nodeId !== nodeId) {
                        return;
                    }
                    suppressClickNodeId = nodeId;
                    emit(callbacks, 'nodeNavigateRequested', nodeId, event);
                    clearLongPress();
                }, LONG_PRESS_DURATION_MS);
            });

            nodeElement.addEventListener('mouseup', function (event) {
                if (!longPressState) {
                    return;
                }
                const dx = (Number(event.clientX) || 0) - longPressState.clientX;
                const dy = (Number(event.clientY) || 0) - longPressState.clientY;
                if (Math.sqrt((dx * dx) + (dy * dy)) > CLICK_DRAG_THRESHOLD) {
                    clearLongPress();
                    return;
                }
                clearLongPress();
            });

            nodeElement.addEventListener('click', function (event) {
                const nodeId = readNodeId(nodeElement);
                if (!nodeId || event.detail > 1) {
                    return;
                }
                if (suppressClickNodeId === nodeId) {
                    suppressClickNodeId = '';
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                }
                emit(callbacks, 'nodeClicked', nodeId, event);
            });

            nodeElement.addEventListener('dblclick', function (event) {
                event.preventDefault();
                event.stopPropagation();
                clearLongPress();
                emitExpansionSignal(nodeElement, callbacks, event);
            });

            nodeElement.addEventListener('contextmenu', function (event) {
                event.preventDefault();
                event.stopPropagation();
                clearLongPress();
                emitExpansionSignal(nodeElement, callbacks, event);
            });
        });

        const viewport = root.querySelector('[data-godot-tree-viewport="true"]') || root;
        viewport.addEventListener('mousedown', function (event) {
            if (event.button !== 1) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            clearLongPress();
            const nodeElement = closestNode(event.target);
            if (nodeElement) {
                return;
            }
            emit(callbacks, 'collapseAllRequested', '', event);
        });
    }

    window.NoteConnectionGodotTreeInteractions = {
        bindTreeRenderer,
        resolveExpansionSignal: function (nodeElement) {
            if (!isSpineNode(nodeElement)) {
                return '';
            }
            return isExpandedNode(nodeElement)
                ? 'node_collapse_prereqs_requested'
                : 'node_expand_prereqs_requested';
        },
    };
}());
