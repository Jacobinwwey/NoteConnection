/**
 * Node Highlighting Module
 * 节点高亮模块
 * 
 * This module provides a unified interface for highlighting nodes and their connections
 * in the knowledge graph visualization. It handles both PC (hover) and mobile (click)
 * interactions with proper visual feedback and state management.
 * 
 * 该模块为知识图谱可视化中的节点及其连接提供统一的高亮接口。
 * 它处理 PC（悬停）和移动端（点击）交互，并提供适当的视觉反馈和状态管理。
 * 
 * @version 0.9.18
 * @date 2025-12-24
 */

/**
 * Node Highlighting State Manager
 * 节点高亮状态管理器
 * 
 * Manages the state of node highlighting interactions including:
 * - Current highlighted node
 * - Frozen state (click-to-lock on mobile)
 * - Connected nodes and edges
 * 
 * 管理节点高亮交互的状态，包括：
 * - 当前高亮节点
 * - 冻结状态（移动端点击锁定）
 * - 连接的节点和边
 */
class NodeHighlightManager {
    constructor(config) {
        // Core references / 核心引用
        this.nodes = config.nodes;           // All graph nodes / 所有图节点
        this.links = config.links;           // All graph edges / 所有图边
        this.nodeSelection = config.nodeSelection; // D3 node selection / D3节点选择
        this.linkSelection = config.linkSelection; // D3 link selection / D3链接选择
        this.tooltip = config.tooltip;       // Tooltip element / 提示框元素
        this.simulation = config.simulation; // Force simulation / 力导向模拟
        this.onTick = config.onTick;        // Callback to trigger re-render / 触发重绘的回调
        
        // State / 状态
        this.currentNode = null;             // Currently highlighted node / 当前高亮节点
        this.isFrozen = false;               // Whether highlight is "locked" / 高亮是否"锁定"
        this.frozenNode = null;              // Node that was clicked (frozen) / 被点击（冻结）的节点
        this.focusMode = null;               // Reference to focus mode state / 专注模式状态引用
        
        // Callbacks / 回调函数
        this.onHighlight = config.onHighlight || null;   // Called when node is highlighted / 节点高亮时调用
        this.onUnhighlight = config.onUnhighlight || null; // Called when highlight is cleared / 清除高亮时调用
    }

    /**
     * Set focus mode reference
     * 设置专注模式引用
     * 
     * @param {Object} focusState - Object with focusNode property / 带有focusNode属性的对象
     */
    setFocusMode(focusState) {
        this.focusMode = focusState;
    }

    /**
     * Highlight a node and its connections
     * 高亮节点及其连接
     * 
     * @param {Object} node - The node to highlight / 要高亮的节点
     * @param {Object} options - Highlighting options / 高亮选项
     * @param {Event} options.event - Mouse/touch event for tooltip positioning / 用于提示框定位的鼠标/触摸事件
     * @param {boolean} options.freeze - Whether to freeze the simulation / 是否冻结模拟
     * @param {string} options.mode - Filter mode: 'all', 'in', 'out' / 过滤模式：'全部'，'入度'，'出度'
     */
    highlight(node, options = {}) {
        // Skip if in focus mode (focus mode handles its own highlighting)
        // 如果在专注模式中则跳过（专注模式处理自己的高亮）
        if (this.focusMode && this.focusMode.active) {
            return;
        }

        // If frozen and trying to highlight a different node, ignore
        // 如果已冻结且尝试高亮不同节点，则忽略
        if (this.isFrozen && this.frozenNode && node.id !== this.frozenNode.id) {
            return;
        }

        const { event = null, freeze = false, mode = 'all' } = options;

        // Lock node position to prevent drift during inspection
        // 锁定节点位置以防止检查期间漂移
        if (!this.focusMode?.active && !this._isLayoutFrozen()) {
            node.fx = node.x;
            node.fy = node.y;
        }

        // Update state / 更新状态
        this.currentNode = node;
        if (freeze) {
            this.isFrozen = true;
            this.frozenNode = node;
            this.simulation.stop();
        }

        // Find connected nodes and edges / 查找连接的节点和边
        const connections = this._getConnections(node, mode);
        
        // Apply visual highlighting / 应用视觉高亮
        this._applyHighlight(node, connections);
        
        // Show tooltip / 显示提示框
        this._showTooltip(node, event);
        
        // Trigger re-render for canvas mode / 触发Canvas模式的重绘
        if (this.onTick) {
            this.onTick();
        }

        // Call custom callback / 调用自定义回调
        if (this.onHighlight) {
            this.onHighlight(node, connections);
        }
    }

    /**
     * Remove highlighting from current node
     * 移除当前节点的高亮
     * 
     * @param {Object} options - Unhighlight options / 取消高亮选项
     * @param {boolean} options.force - Force unhighlight even if frozen / 即使冻结也强制取消高亮
     */
    unhighlight(options = {}) {
        const { force = false } = options;

        // Don't unhighlight if frozen unless forced
        // 除非强制，否则冻结时不取消高亮
        if (this.isFrozen && !force) {
            return;
        }

        if (!this.currentNode) {
            return;
        }

        const node = this.currentNode;

        // Unlock node position (unless globally frozen or in focus mode)
        // 解锁节点位置（除非全局冻结或在专注模式中）
        if (!this.focusMode?.active && !this._isLayoutFrozen()) {
            node.fx = null;
            node.fy = null;
        }

        // Clear state / 清除状态
        this.currentNode = null;
        if (force) {
            this.isFrozen = false;
            this.frozenNode = null;
            
            // Resume simulation if not manually frozen
            // 如果未手动冻结则恢复模拟
            if (!this._isLayoutFrozen()) {
                this.simulation.alphaTarget(0.3).restart();
            }
        }

        // Remove visual highlighting / 移除视觉高亮
        this._clearHighlight();
        
        // Hide tooltip / 隐藏提示框
        this._hideTooltip();
        
        // Trigger re-render / 触发重绘
        if (this.onTick) {
            this.onTick();
        }

        // Call custom callback / 调用自定义回调
        if (this.onUnhighlight) {
            this.onUnhighlight(node);
        }
    }

    /**
     * Get connections for a node
     * 获取节点的连接
     * 
     * @private
     * @param {Object} node - The node / 节点
     * @param {string} mode - Connection mode: 'all', 'in', 'out' / 连接模式
     * @returns {Object} Connected nodes and edges / 连接的节点和边
     */
    _getConnections(node, mode) {
        const connectedLinks = [];
        const connectedNodeIds = new Set([node.id]);
        const incomingLinks = [];
        const outgoingLinks = [];

        this.links.forEach(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            
            const isOutgoing = sourceId === node.id;
            const isIncoming = targetId === node.id;

            if (!isOutgoing && !isIncoming) {
                return;
            }

            // Filter by mode / 按模式过滤
            if (mode === 'in' && !isIncoming) return;
            if (mode === 'out' && !isOutgoing) return;

            connectedLinks.push(link);
            connectedNodeIds.add(sourceId);
            connectedNodeIds.add(targetId);

            if (isOutgoing) outgoingLinks.push(link);
            if (isIncoming) incomingLinks.push(link);
        });

        return {
            links: connectedLinks,
            nodeIds: connectedNodeIds,
            incomingLinks,
            outgoingLinks
        };
    }

    /**
     * Apply visual highlighting to nodes and edges
     * 对节点和边应用视觉高亮
     * 
     * @private
     * @param {Object} node - Main node / 主节点
     * @param {Object} connections - Connection data / 连接数据
     */
    _applyHighlight(node, connections) {
        // Dim all nodes first / 首先使所有节点变暗
        this.nodeSelection.each(function(n) {
            const el = d3.select(this);
            if (n.id === node.id) {
                el.style("opacity", "1");  // Main node - full opacity / 主节点 - 完全不透明
            } else if (connections.nodeIds.has(n.id)) {
                el.style("opacity", "1");  // Connected nodes - full opacity / 连接节点 - 完全不透明
            } else {
                el.style("opacity", "0.05"); // Unconnected - very dim / 未连接 - 非常暗
            }
        });

        // Highlight edges with directional colors / 用方向颜色高亮边
        this.linkSelection.each(function(link) {
            const el = d3.select(this);
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            const isConnected = (sourceId === node.id || targetId === node.id);
            
            if (isConnected) {
                const isOutgoing = sourceId === node.id;
                // Blue for outgoing (further exploration), Red for incoming (helps understanding)
                // 蓝色表示出度（进一步探索），红色表示入度（帮助理解）
                const color = isOutgoing ? "#4488ff" : "#ff6b6b";
                const marker = isOutgoing ? "url(#arrow-out)" : "url(#arrow-in)";
                
                // Use setAttribute for SVG properties to override CSS
                // 使用setAttribute设置SVG属性以覆盖CSS
                this.setAttribute("marker-end", marker);
                this.setAttribute("stroke", color);
                this.setAttribute("stroke-width", "2.5");
                this.setAttribute("opacity", "1");
                this.style.opacity = "1";
            } else {
                this.setAttribute("opacity", "0");
                this.style.opacity = "0";
            }
        });
    }

    /**
     * Clear all visual highlighting
     * 清除所有视觉高亮
     * 
     * @private
     */
    _clearHighlight() {
        // Reset node styles / 重置节点样式
        this.nodeSelection.classed("highlight-main", false);
        
        // Reset link styles / 重置边样式
        this.linkSelection
            .classed("highlight-out", false)
            .classed("highlight-in", false)
            .style("stroke", null)
            .style("stroke-width", null)
            .attr("marker-end", "url(#arrow)");
        
        // Restore visibility based on filters / 根据过滤器恢复可见性
        if (typeof window.updateVisibility === 'function') {
            window.updateVisibility();
        }
    }

    /**
     * Show tooltip for a node
     * 为节点显示提示框
     * 
     * @private
     * @param {Object} node - The node / 节点
     * @param {Event} event - Mouse/touch event / 鼠标/触摸事件
     */
    _showTooltip(node, event) {
        if (!this.tooltip) return;

        this.tooltip.transition().duration(200).style("opacity", 0.9);
        this.tooltip.html(`
            <strong>${node.label}</strong><br/>
            In-Degree: ${node.inDegree}<br/>
            Out-Degree: ${node.outDegree}
        `);

        if (event) {
            // Position based on event / 根据事件定位
            this.tooltip
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        } else {
            // Calculate screen position from node coordinates / 从节点坐标计算屏幕位置
            const svgElement = document.querySelector("#graph-container svg");
            if (svgElement) {
                const transform = d3.zoomTransform(svgElement);
                const screenX = node.x * transform.k + transform.x;
                const screenY = node.y * transform.k + transform.y;
                
                this.tooltip
                    .style("left", (screenX + 10) + "px")
                    .style("top", (screenY - 28) + "px");
            }
        }
    }

    /**
     * Hide tooltip
     * 隐藏提示框
     * 
     * @private
     */
    _hideTooltip() {
        if (!this.tooltip) return;
        this.tooltip.transition().duration(500).style("opacity", 0);
    }

    /**
     * Check if layout is manually frozen
     * 检查布局是否手动冻结
     * 
     * @private
     * @returns {boolean} True if frozen / 如果冻结则返回true
     */
    _isLayoutFrozen() {
        const checkbox = document.getElementById('freeze-layout');
        return checkbox && checkbox.checked;
    }

    /**
     * Get current highlight state
     * 获取当前高亮状态
     * 
     * @returns {Object} Current state / 当前状态
     */
    getState() {
        return {
            currentNode: this.currentNode,
            isFrozen: this.isFrozen,
            frozenNode: this.frozenNode
        };
    }

    /**
     * Check if a node is currently highlighted
     * 检查节点是否当前高亮
     * 
     * @param {string} nodeId - Node ID / 节点ID
     * @returns {boolean} True if highlighted / 如果高亮则返回true
     */
    isHighlighted(nodeId) {
        return this.currentNode && this.currentNode.id === nodeId;
    }

    /**
     * Get connections for the currently highlighted node
     * 获取当前高亮节点的连接
     * 
     * @returns {Object|null} Connection data or null / 连接数据或null
     */
    getCurrentConnections() {
        if (!this.currentNode) return null;
        return this._getConnections(this.currentNode, 'all');
    }
}

/**
 * Create and initialize node highlight manager
 * 创建并初始化节点高亮管理器
 * 
 * @param {Object} config - Configuration object / 配置对象
 * @returns {NodeHighlightManager} Manager instance / 管理器实例
 */
function createNodeHighlightManager(config) {
    return new NodeHighlightManager(config);
}

// Export for use in main application
// 导出供主应用使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NodeHighlightManager, createNodeHighlightManager };
} else if (typeof window !== 'undefined') {
    window.NodeHighlightManager = NodeHighlightManager;
    window.createNodeHighlightManager = createNodeHighlightManager;
}
