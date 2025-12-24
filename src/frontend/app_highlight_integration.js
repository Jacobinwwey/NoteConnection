/**
 * Node Highlighting Integration for app.js
 * 节点高亮集成代码
 * 
 * This file contains the integration code to be added to app.js
 * after the graph elements (nodes, links) are created.
 * 
 * 此文件包含要添加到 app.js 的集成代码
 * 在图形元素（节点、链接）创建之后。
 * 
 * @version 0.9.18
 * @date 2025-12-24
 * 
 * Integration Steps / 集成步骤:
 * 1. Add after: "const texts = node.append("text")..." (around line 190)
 *    在 "const texts = node.append("text")..." 之后添加（约第190行）
 * 
 * 2. Replace old event handlers (mouseover, mouseout, click) with new ones
 *    用新的事件处理器替换旧的（mouseover, mouseout, click）
 * 
 * 3. Update the renderCanvas function to use highlightManager state
 *    更新renderCanvas函数以使用highlightManager状态
 */

// ============================================================================
// SECTION 1: Initialize Highlight Manager (Add after texts definition)
// 第1部分：初始化高亮管理器（在texts定义后添加）
// ============================================================================

// Create Focus Mode State Object
// 创建专注模式状态对象
const focusModeState = { active: false, node: null };

// Initialize Node Highlight Manager
// 初始化节点高亮管理器
const highlightManager = window.createNodeHighlightManager({
    nodes: nodes,
    links: links,
    nodeSelection: node,
    linkSelection: link,
    tooltip: tooltip,
    simulation: simulation,
    onTick: ticked,
    onHighlight: (node, connections) => {
        // Optional: Custom callback when node is highlighted
        // 可选：节点高亮时的自定义回调
        console.log('Highlighted node:', node.label);
    },
    onUnhighlight: (node) => {
        // Optional: Custom callback when highlight is cleared
        // 可选：清除高亮时的自定义回调
        console.log('Unhighlighted node:', node ? node.label : 'none');
    }
});

// Store in window for global access
// 存储在window中以供全局访问
window.highlightManager = highlightManager;

// Update focus mode reference when focus mode changes
// 专注模式更改时更新引用
function updateFocusModeState(active, node = null) {
    focusModeState.active = active;
    focusModeState.node = node;
    highlightManager.setFocusMode(focusModeState);
}

// ============================================================================
// SECTION 2: Replace Event Handlers (Replace existing event handlers)
// 第2部分：替换事件处理器（替换现有的事件处理器）
// ============================================================================

// Click Timer for Double-Click Detection
// 双击检测的点击计时器
let clickTimer = null;

// REMOVE OLD EVENT HANDLERS: node.on("mouseover"...), node.on("mouseout"...)
// 移除旧的事件处理器

// NEW EVENT HANDLERS - Add these
// 新的事件处理器 - 添加这些

// Hover Event (PC) - Only trigger if not frozen
// 悬停事件（PC）- 仅在未冻结时触发
node.on("mouseover", function(event, d) {
    const state = highlightManager.getState();
    if (!state.isFrozen && !focusModeState.active) {
        highlightManager.highlight(d, { event: event });
    }
});

node.on("mouseout", function(event, d) {
    const state = highlightManager.getState();
    if (!state.isFrozen && !focusModeState.active) {
        highlightManager.unhighlight();
    }
});

// Click Events (Mobile & PC)
// 点击事件（移动端和PC）
node.on("click", (event, d) => {
    // If in Cluster Mode, ignore (handled by updateViewMode logic)
    // 如果在聚类模式中则忽略
    const viewMode = document.querySelector('input[name="viewMode"]:checked').value;
    if (viewMode !== 'nodes') return;

    if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
        // Double Click Detected - Enter Focus Mode / 检测到双击 - 进入专注模式
        handleDoubleClick(event, d);
    } else {
        clickTimer = setTimeout(() => {
            clickTimer = null;
            // Single Click Detected - Highlight & Freeze / 检测到单击 - 高亮和冻结
            handleSingleClick(event, d);
        }, 250); // 250ms delay
    }
    event.stopPropagation();
});

// Single Click Handler / 单击处理器
function handleSingleClick(event, d) {
    // Skip if in focus mode / 如果在专注模式中则跳过
    if (focusModeState.active) return;

    // Highlight and freeze / 高亮并冻结
    highlightManager.highlight(d, { 
        event: event, 
        freeze: true 
    });
    
    // Show statistics popup / 显示统计弹窗
    if (typeof showNodePopup === 'function') {
        showNodePopup(d.id);
    }
}

// Double Click Handler / 双击处理器
function handleDoubleClick(event, d) {
    if (focusNode && focusNode.id === d.id) {
        // Already focused -> Open Reader / 已经专注 -> 打开阅读器
        if (window.reader) window.reader.open(d);
    } else {
        // Enter Focus Mode / 进入专注模式
        enterFocusMode(d);
    }
}

// Background Click to Clear Highlight / 背景点击以清除高亮
// This should already exist in app.js, update it if needed
// 这应该已经存在于app.js中，如果需要可以更新它

// ============================================================================
// SECTION 3: Update Canvas Renderer (Modify renderCanvas function)
// 第3部分：更新Canvas渲染器（修改renderCanvas函数）
// ============================================================================

// In the renderCanvas function, update the link drawing logic to use highlightManager
// 在renderCanvas函数中，更新链接绘制逻辑以使用highlightManager

// FIND this section in renderCanvas:
// 在renderCanvas中找到此部分：
/*
    links.forEach(d => {
        // Check Visibility
        if (focusNode) {
            ...
        } else if (window.hoverNode) {
            ...
        }
*/

// REPLACE with:
// 替换为：
/*
    // Get current highlight state
    const highlightState = window.highlightManager ? window.highlightManager.getState() : null;
    const highlightConnections = highlightState && highlightState.currentNode ? 
        window.highlightManager.getCurrentConnections() : null;

    links.forEach(d => {
        // Check Visibility
        // 1. Focus Mode
        if (focusNode) {
            if (d.source.isFocusVisible === false || d.target.isFocusVisible === false) return;
            ctx.globalAlpha = 0.6;
            ctx.strokeStyle = "#555";
            ctx.lineWidth = 1;
        } 
        // 2. Highlight Mode (using highlightManager)
        else if (highlightConnections) {
            const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
            const targetId = typeof d.target === 'object' ? d.target.id : d.target;
            const currentNodeId = highlightState.currentNode.id;
            
            if (sourceId === currentNodeId) {
                // Outgoing edge
                ctx.globalAlpha = 1;
                ctx.strokeStyle = "#4488ff"; // Blue for outgoing
                ctx.lineWidth = 2.5;
            } else if (targetId === currentNodeId) {
                // Incoming edge
                ctx.globalAlpha = 1;
                ctx.strokeStyle = "#ff6b6b"; // Red for incoming
                ctx.lineWidth = 2.5;
            } else {
                return; // Hide others
            }
        }
        else {
            return; // Default Hidden
        }

        // ... rest of drawing code
    });

    // For nodes, also check highlight state for dimming effect
    nodes.forEach(d => {
        if (!isNodeVisible(d)) return;

        const isHighlightedNode = highlightState && highlightState.currentNode && 
            highlightState.currentNode.id === d.id;
        const isConnected = highlightConnections && highlightConnections.nodeIds.has(d.id);
        const shouldDim = highlightState && highlightState.currentNode && !isConnected && !focusNode;

        ctx.globalAlpha = shouldDim ? 0.05 : 1;
        
        // ... rest of node drawing code
    });
*/

// ============================================================================
// SECTION 4: Update Focus Mode Functions
// 第4部分：更新专注模式函数
// ============================================================================

// In enterFocusMode function, ADD at the beginning:
// 在enterFocusMode函数中，在开头添加：
/*
    updateFocusModeState(true, focusD);
*/

// In exitFocusMode function, ADD at the beginning:
// 在exitFocusMode函数中，在开头添加：
/*
    updateFocusModeState(false, null);
*/

// ============================================================================
// SECTION 5: Expose API for External Use (Analysis Panel)
// 第5部分：为外部使用公开API（分析面板）
// ============================================================================

// Replace or update the existing window.highlightNode function
// 替换或更新现有的window.highlightNode函数
window.highlightNode = function(nodeId) {
    const d = nodes.find(n => n.id === nodeId);
    if (d && window.highlightManager) {
        window.highlightManager.highlight(d, { freeze: false });
    }
};

// Add function to clear highlight
// 添加清除高亮的函数
window.clearHighlight = function() {
    if (window.highlightManager) {
        window.highlightManager.unhighlight({ force: true });
    }
};

// ============================================================================
// END OF INTEGRATION CODE
// 集成代码结束
// ============================================================================
