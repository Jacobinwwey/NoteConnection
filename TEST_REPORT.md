# 2026-01-08 v0.9.67 - Compact Mode & Canvas Fix

## English Document

### Test Scenario: Large Graph Loading (10k+ Nodes)
**Objective**: Verify that graphs with >10,000 nodes load correctly without blank screens and default to "Compact Mode".

**Steps**:
1. Load a dataset with >5,000 nodes (or mock the data).
2. Observe the initial rendering state.
3. Check the "Settings" > "Performance" panel.
4. Hover over a node.

**Expected Results**:
*   [x] **Auto-Switch**: Renderer automatically switches to "Canvas".
*   [x] **Compact Mode**: "Compact Mode" checkbox in Settings is checked automatically.
*   [x] **Visuals**: Nodes are visible immediately (no blank screen). Edges are NOT visible by default.
*   [x] **Interaction**: Hovering a node temporarily shows its connected edges (highlighting works), then hides them again on mouseout.

### Test Scenario: Manual Toggle
**Objective**: Verify user can toggle Compact Mode.

**Steps**:
1. Open Settings.
2. Uncheck "Compact Mode".
3. Close Settings.

**Expected Results**:
*   [x] **Rendering**: Edges appear (if opacity > 0).
*   [x] **Performance**: Frame rate may drop significantly for 1.2M edges (expected).

---

## Chinese Document

### 测试场景：大图加载 (10k+ 节点)
**目标**: 验证超过 10,000 个节点的图谱能正确加载，无白屏，并默认进入“紧凑模式”。

**步骤**:
1. 加载包含 >5,000 个节点的数据集（或模拟数据）。
2. 观察初始渲染状态。
3. 检查“设置” > “性能”面板。
4. 悬停在节点上。

**预期结果**:
*   [x] **自动切换**: 渲染器自动切换为 "Canvas"。
*   [x] **紧凑模式**: 设置中的“紧凑模式”复选框自动被选中。
*   [x] **视觉**: 节点立即可见（无白屏）。默认情况下不可见边。
*   [x] **交互**: 悬停节点时暂时显示其连接的边（高亮工作），移出后再次隐藏。

### 测试场景：手动切换
**目标**: 验证用户可以切换紧凑模式。

**步骤**:
1. 打开设置。
2. 取消选中“紧凑模式”。
3. 关闭设置。

**预期结果**:
*   [x] **渲染**: 边出现（如果透明度 > 0）。
*   [x] **性能**: 对于 120 万条边，帧率可能会显著下降（预期）。
