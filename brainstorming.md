# Brainstorming: Stable Spine Tree Layout

## User Request Analysis

The user wants a "Tree-like learning path" with specific stability constraints:

1.  **Stationary Expansion**: Expanding a node should not move it.
2.  **Lateral Unfolding**: Prerequisites should appear "to the side" rather than inserting into the main sequence.
3.  **Main Path Precedence**: Nodes on the Main Path (the initial sequence) take priority.
4.  **Unique Nodes**: No duplicates.
5.  **Shared Prerequisite Priority**: If a node is needed by multiple parents, its position is determined by the "preceding" parent (earliest in the main path).

## Conceptual Model: "Spine & Tributaries"

### 1. The Spine (Main Learning Path)

- **Definition**: The primary sequence of nodes identified by the [diffusionLearning](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#253-422) algorithm.
- **Layout**: strictly linear (or slightly curved) horizontal sequence.
- **Coordinates**: Fixed `Y = 0`. `X` increases by `X_SPACING` for each step.
- **Precedence**: These nodes are "anchors". They are placed first and never moved by secondary expansions.

### 2. Tributary Placement (Lateral Expansion)

- When a Spine Node `S` is expanded, its prerequisites `P1, P2...` (Tributaries) need to be placed.
- **Placement Logic**:
  - **X-Coordinate**: To maintain the "input" flow (Left -> Right), Prereqs usually sit to the left.
    - Problem: The slot to the left is occupied by `S`'s predecessor.
    - **Solution**: "Lateral" means displacing in **Y**.
    - `P` is placed at the same `X` column as `S`'s predecessor (or an intermediate column?) but with a `Y` offset.
    - OR: Layout uses a "Sub-column" approach.
    - User said: "unfold laterally from its side".
  - **Proposed Layout**:
    - Spine Nodes: `... -> Prev -> Current -> Next ...`
    - Expanded Prereqs for [Current](file:///e:/Knowledge_project/NoteConnection_app/src/core/PathBridge.ts#149-153):
      ```
      P1 --\
      P2 ---> Current
      ```
    - `P1` and `P2` are placed at `X = X(Current) - X_SPACING` (same X as `Prev`).
    - `Y` is shifted up/down.
    - Conflict: `Prev` is already at [(X-1, 0)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53).
    - `P1, P2` will share the column `X-1`.
    - `Prev` stays at `Y=0`. `P1` at `Y=-1`, `P2` at `Y=1` etc.

### 3. Stability & Collision Avoidance

- **Stability**: Since the Spine is always at `Y=0`, and Tributaries are placed in `Y != 0` slots, the Spine never moves.
- **Recursive Expansion**:
  - If `P1` is expanded, its children `PP1` go to `X-2`.
  - This forms a "Backward Tree" growing from the Spine upwards/downwards.
- **Collision Handling**:
  - We need a "Slot Manager" or "Y-AxisAllocator".
  - For a given `X` column, track used `Y` slots.
  - When placing `P1` at column `X`, find the nearest available `Y` relative to its parent's `Y`.

## Algorithm Stages

### Stage 1: Identify & Place Spine

1.  Traverse the "Main Path" (from `centralId` or `targetId` backtrack).
    - _Note_: [diffusionLearning](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#253-422) returns a list. If `isCritical` or `isOriginalPath` flag exists, use it.
    - Or calculate the critical path (Shortest Path from Frontier to Target).
2.  Assign [(Level, Y=0)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) to all Spine nodes. `Level` increments towards Target.
    - `0` = Start Node.
    - `N` = Target Node.
3.  Register these positions in a `SpatialMap (Level -> Set<Y>)`.

### Stage 2: Process Expansions (Tributaries)

1.  Iterate through Spine Nodes.
2.  If a Spine Node is `expanded`, get its incoming edges (Prereqs).
3.  Filter out nodes already placed (Spine nodes or previously placed Tributaries).
4.  For remaining Prereqs:
    - **Target Level**: `ParentLevel - 1`.
    - **Y-Placement**:
      - Find available Y slots at `Target Level`.
      - Heuristic: Center them around `Parent.Y`.
      - Alternating Up/Down: `+1, -1, +2, -2...` \* SPACING.
      - Check `SpatialMap` to ensure slot is free.
    - Assign position and register in `SpatialMap`.
5.  **Recursion**: If a Tributary is also expanded, process its children at `Level - 2`, etc.

### Stage 3: Priority Handling

- "Priority given to node preceding along primary path":
  - Iterate Spine Nodes in order (Start -> Target).
  - Process expansions for Node 0, then Node 1, etc.
  - If Node 0 needs `P`, `P` is placed relative to Node 0.
  - If Node 1 also needs `P`, it sees `P` is already placed. Just draw edge.
  - _Result_: `P` appears "earlier" (further left), satisfying the requirement (or further right? "Preceding" usually means earlier in dependency chain, so further left).
  - If Node A (Level 5) and Node B (Level 6) both need P.
  - Processing A first places P at Level 4.
  - 绘制边缘 P->B (Level 4 -> 6) (跨级)。
  - This seems correct.

## Edge Cases

- **Deep Prereqs**: What if P (for Level 5) needs PP (Level 4) but Level 4 is packed?
  - `Y-Allocator` pushes layouts further out.
- **Main Path insertion**: If the user effectively changes the main path?
  - The algorithm relies on [path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js) providing a "Critical Path". If the user switches context, the Spine changes. This is acceptable (Switch Center = New View).
  - But simply "Expanding" a node should NOT change the Spine.

## Implementation Details for [path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js)

Current [getTreeLayout](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#707-884) logic needs replacement.
New Logic:

1.  **Extract Spine**: Identify `isCritical` nodes.
2.  **Assign Levels**:
    - Assign Level 0 to `Frontier` (or Start).
    - BFS/DFS along `isCritical` edges to assign levels to Spine.
3.  **Place Spine**: `x = level * SPACING`, `y = 0`.
4.  **Place Others**:
    - Use a `Queue` for BFS processing of dependencies.
    - Use `PosMap` to track [(x, y)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) usage.
    - For each unplaced predecessor `P` of placed node `N`:
      - `level = N.level - 1`.
      - `y = findNearestSlot(level, N.y)`.
      - Place `P`.
      - Add `P` to queue.

## Refined Layout Logic

Instead of naive BFS, we iterate strictly:

1.  **Spine Phase**: Loop `learningPath.nodes`. If `isCritical`, set `level`, `y=0`. Mark placed.
2.  **Expansion Phase**:
    - Iterate `learningPath.nodes` (or specifically the `forcedExpansionSet` + others).
    - If [node](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/app.js#279-280) is placed and `isExpanded`:
      - Get unplaced parents.
      - Sort parents (by weight/alphabetical).
      - Place them at `node.level - 1`.
      - Use logic to fan them out above/below `node.y`.
    - Repeat until no new nodes placed. (Handling recursive expansion).

**Crucial**: The definition of "Main Path" relies on [path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js) identifying it. [diffusionLearning](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#253-422) sets `isCritical: true`. We will use this.

## Conflict Resolution - "Preceding Node"

- We must process nodes in **Topological Order** (or Main Path order) to ensure the "earlier" parent claims the child's position.
- Since we iterate main path `Start -> Target` (Left -> Right), we process `Level 0` first.
- If `Level 0` needs `P`, `P` goes to `Level -1`.
- If `Level 2` needs `P`, and `P` is already at `Level -1`, it stays there.
- This creates long edges `P -> Level 2`, which is fine.

## Summary of Changes

- **Modify [getTreeLayout](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#707-884)**:
  - Discard Reingold-Tilford.
  - Implement "Spine-Based Slot Layout".
  - `Spinenodes`: `y = 0`.
  - `Other nodes`: `y` allocated dynamically to minimize vertical distance to parent while avoiding overlap.

---

# 头脑风暴：稳定主干树形布局 (Stable Spine Tree Layout)

## 用户需求分析

用户需要一种“树状学习路径”，并具有特定的稳定性约束：

1.  **静态展开**: 展开节点不应移动它。
2.  **横向展开**: 前置节点应出现在“侧面”而不是插入主序列中。
3.  **主路径优先**: 位于主路径（初始序列）上的节点优先。
4.  **唯一节点**: 无重复节点。
5.  **共享前置优先级**: 如果一个节点被多个父节点需要，其位置由“先前”的父节点（主路径中最早的）决定。

## 概念模型：“主干与支流” (Spine & Tributaries)

### 1. 主干 (Spine) (主要学习路径)

- **定义**: 由 [diffusionLearning](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#253-422) 算法识别的主要节点序列。
- **布局**: 严格线性（或微弯）的水平序列。
- **坐标**: 固定 `Y = 0`。每一步 `X` 增加 `X_SPACING`。
- **优先级**: 这些节点是“锚点”。它们首先被放置，并且永远不会被次级展开移动。

### 2. 支流放置 (Tributary Placement) (横向展开)

- 当主干节点 `S` 展开时，其前置节点 `P1, P2...` (支流) 需要被放置。
- **放置逻辑**:
  - **X 坐标**: 为了保持“输入”流向 (左 -> 右)，前置通常位于左侧。
    - 问题: 左侧的插槽已被 `S` 的前驱节点占用。
    - **解决方案**: “横向”意味着在 **Y 轴** 上位移。
    - `P` 放置在与 `S` 的前驱节点相同的 `X` 列（或中间列？），但具有 `Y` 偏移。
    - 或者：布局使用“子列”方法。
    - 用户说：“从侧面横向展开”。
  - **建议布局**:
    - 主干节点: `... -> Prev -> Current -> Next ...`
    - [Current](file:///e:/Knowledge_project/NoteConnection_app/src/core/PathBridge.ts#149-153) 的展开前置:
      ```
      P1 --\
      P2 ---> Current
      ```
    - `P1` 和 `P2` 放置在 `X = X(Current) - X_SPACING` (与 `Prev` 相同的 X)。
    - `Y` 上下移动。
    - 冲突: `Prev` 已经在 [(X-1, 0)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53)。
    - `P1, P2` 将共享列 `X-1`。
    - `Prev` 保持在 `Y=0`。`P1` 在 `Y=-1`, `P2` 在 `Y=1` 等。

### 3. 稳定性与避碰 (Stability & Collision Avoidance)

- **稳定性**: 由于主干始终在 `Y=0`，而支流放置在 `Y != 0` 的插槽中，主干永远不会移动。
- **递归展开**:
  - 如果 `P1` 展开，其子节点 `PP1` 去往 `X-2`。
  - 这形成了一棵从主干向上/向下生长的“倒树”。
- **碰撞处理**:
  - 我们需要一个“插槽管理器”或“Y轴分配器”。
  - 对于给定的 `X` 列，跟踪已使用的 `Y` 插槽。
  - 当在列 `X` 放置 `P1` 时，找到相对于其父节点 `Y` 最近的可用 `Y`。

## 算法阶段

### 阶段 1: 识别并放置主干 (Identify & Place Spine)

1.  遍历“主路径”（从 `centralId` 或 `targetId` 回溯）。
    - _注_: [diffusionLearning](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#253-422) 返回一个列表。如果存在 `isCritical` 或 `isOriginalPath` 标志，请使用它。
    - 或者计算关键路径（从前沿到目标的最短路径）。
2.  为所有主干节点分配 [(Level, Y=0)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53)。`Level` 向目标递增。
    - `0` = 起始节点。
    - `N` = 目标节点。
3.  在 `SpatialMap (Level -> Set<Y>)` 中注册这些位置。

### 阶段 2: 处理展开 (Process Expansions) (支流)

1.  迭代主干节点。
2.  如果主干节点是 `expanded` (已展开)，获取其入边（前置节点）。
3.  过滤掉已放置的节点（主干节点或先前放置的支流）。
4.  对于剩余的前置节点：
    - **目标层级**: `ParentLevel - 1`。
    - **Y-放置**:
      - 在 `Target Level` 找到可用的 Y 插槽。
      - 启发式: 围绕 `Parent.Y` 居中。
      - 交替上/下: `+1, -1, +2, -2...` \* SPACING。
      - 检查 `SpatialMap` 确保插槽空闲。
    - 分配位置并在 `SpatialMap` 中注册。
5.  **递归**: 如果支流也展开了，在 `Level - 2` 处理其子节点，依此类推。

### 阶段 3: 优先级处理 (Priority Handling)

- “优先考虑沿主路径在前的节点”:
  - 按顺序（起点 -> 终点）迭代主干节点。
  - 先处理节点 0 的展开，然后节点 1，依此类推。
  - 如果节点 0 需要 `P`，`P` 相对于节点 0 放置。
  - 如果节点 1 也需要 `P`，它会看到 `P` 已放置。只需绘制边缘。
  - _结果_: `P` 出现得“更早”（更靠左），满足要求。
  - 如果节点 A (Level 5) 和节点 B (Level 6) 都需要 P。
  - 先处理 A 将 P 放置在 Level 4。
  - 绘制边缘 P->B (Level 4 -> 6) (跨级)。
  - 这看起来是正确的。

## 边缘情况

- **深度前置**: 如果 P (Level 5) 需要 PP (Level 4) 但 Level 4 已满怎么办？
  - `Y-Allocator` 将布局推向更远的外侧。
- **主路径插入**: 如果用户有效地更改了主路径？
  - 算法依赖 [path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js) 提供“关键路径”。如果用户切换上下文，主干会改变。这是可接受的（切换中心 = 新视图）。
  - 但简单地“展开”一个节点 **不应** 改变主干。

## [path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js) 实现细节

当前的 [getTreeLayout](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#707-884) 逻辑需要替换。
新逻辑:

1.  **提取主干**: 识别 `isCritical` 节点。
2.  **分配层级**:
    - 将 Level 0 分配给 `Frontier` (或 Start)。-沿 `isCritical` 边缘进行 BFS/DFS 以分配主干层级。
3.  **放置主干**: `x = level * SPACING`, `y = 0`。
4.  **放置其他**:
    - 使用 `Queue` 进行依赖项的 BFS 处理。
    - 使用 `PosMap` 跟踪 [(x, y)](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/source_manager.js#51-53) 使用情况。
    - 对于放置节点 `N` 的每个未放置前驱 `P`:
      - `level = N.level - 1`。
      - `y = findNearestSlot(level, N.y)`.
      - 放置 `P`。
      - 将 `P` 添加到队列。

## 总结

- **修改 [getTreeLayout](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js#707-884)**:
  - 放弃 Reingold-Tilford。
  - 实现“基于主干的插槽布局”。
  - `SpineNodes`: `y = 0`。
  - `Other nodes`: `y` 动态分配以最小化平时距离并避免重叠。

## Session 3: Fixing Layout Density and Duplication (current)

**Date**: 2026-02-02

### 1. The Duplication Bug

- **Observation**: Users see multiple identical nodes (e.g. "S&P 500") appearing as siblings.
- **Root Cause**: The underlying graph may have multiple edges between two nodes (e.g. "prerequisite" and "related"). The `getPrerequisites` helper in `getTreeLayout` maps edges to source IDs without deduplication.
- **Mechanism**:
  ```javascript
  // Current Logic
  const prereqs = incomingEdges.map((e) => e.source); // Returns ['A', 'A']
  const unplaced = prereqs.filter((id) => !placed.has(id)); // Returns ['A', 'A'] (both pass)
  unplaced.forEach((id) => {
    place(id); // Places A (1st time)
    place(id); // Places A (2nd time) - Duplicate!
  });
  ```
- **Solution**: Enforce uniqueness on the prerequisite list _before_ processing.
  ```javascript
  const uniquePrereqs = [...new Set(incomingEdges.map((e) => e.source))];
  ```

### 2. Overlap and Density

- **Observation**: Nodes are too close leads to overlap given the new Rounded Rectangle shape (180px width).
- **Current Settings**: `SIBLING_GAP = 220`. Node Width = 180. Gap = 40px. This is tight.
- **Proposal**:
  - **Node Width**: 200px (to fit text better)
  - **Node Height**: 60px
  - **Sibling Gap**: 250px (Space between centers). Gap = 50px.
  - **Spine Spacing (X)**: 400px.
  - **Level Height (Y)**: 150px.

### 3. Implementation Plan

1.  **Deduplicate Prereqs**: Modify `getTreeLayout` in `path_core.js`.
2.  **Adjust Constants**: Update `SPACING_X`, `LEVEL_HEIGHT`, `SIBLING_GAP`.
3.  **Refine Renderer**: Update `tree_renderer.gd` node size constants to match (200x60).

## Session 4: Auto-Avoidance & Visual Bubbles

**Date**: 2026-02-02

### 1. Collision Avoidance (Dynamic Spine)

- **Problem**: Fixed spacing (`500px`) fails if node 1 (Down) and node 3 (Down) both have huge subtrees that collide.
- **Concept**: Dynamic Spine Placement.
- **Algorithm**:
  1.  Calculate `SubtreeWidth` and `SubtreeBounds` (min*x, max_x relative to root) for \_every* spine node bottom-up.
  2.  Place Spine Nodes Left-to-Right.
  3.  `Spine[i].x = Spine[i-1].x + SPACING_X + Constraint`.
  4.  **Constraint**:
      - Find previous node on _same side_ (e.g., if i is Down/Even, check i-2).
      - Ensure `Spine[i].min_x > Spine[i-2].max_x + GAP`.
      - Also ensure logic for immediate neighbor (i-1) is reasonable (often connection line is long).
- **Refinement**: Since layout is tree-based, "shifting" the root shifts the whole tree. We just need to find the safe X for the root.

### 2. Group Highlighting (Visual Bubble)

- **Requirement**: "Faint curved border" around in-degree nodes of a central node.
- **Scenario**: When Central Node is expanded.
- **Implementation**:
  - **Data**: Identify the set of nodes belonging to the "In-Degree Tree" of the Central Node.
  - **Geometry**: Calculate the Convex Hull or simply a Bounding Box + Padding of these nodes.
  - **Render**: Draw a `StyleBoxFlat` or `draw_rect/draw_polygon` behind the nodes with low alpha.
- **Collapsed State**: "All existing in-degree nodes should illuminate".
  - This is already partially handled by the "Focus Mode" dimming logic. We just need to ensure _all_ descendants (not just immediate) are highlighted? No, just "in-degree nodes". Usually means immediate parents. Or all recursive? "In-degree nodes" implies the stream. I will highlight recursively.

### 3. Plan

1.  **Mockup**: Implement Dynamic Spine Spacing in `tree_path_mockup.html`.
2.  **Mockup**: Implement "Group Bubble" in `tree_path_mockup.html`.
3.  **Verify**: Show user.

## Session 5: Contour-Based Layout & Deep Interaction

**Date**: 2026-02-02

### 1. The Overlap Problem (Deep Analysis)

- **User Insight**: "Not just relationship between main learning path and in-degree, but _between all nodes_... collisions are not permitted."
- **Failure of previous approach**: Simple Dynamic Spine only checked spine node overlap. It didn't account for deep tributaries of Node A colliding with deep tributaries of Node B.
- **Requirement**: **Contour-Based Collision Avoidance**.
- **Algorithm**:
  - We must calculate the "Silhouette" (or Skyline) of every subtree.
  - **Silhouette**: A list of `(min_x, max_x)` ranges for every depth level relative to the root.
  - **Merging**: When placing a node next to existing placed nodes, we check for intersection between their Skylines at corresponding Y-levels.
  - **Spine Placement**:
    - Maintain a `GlobalRightContour` for the "Down" side and "Up" side.
    - When placing Spine Node `i` (going Down):
      - Shift `i.x` until `i`'s _Left Contour_ clears the `GlobalRightContour (Down)` + Padding.
      - Update `GlobalRightContour (Down)` by merging `i`'s Right Contour.
      - Same for Up.

### 2. Interaction & Visuals

- **Problem**: Not all nodes collapsible.
- **Fix**: The default click handler in mockup only applied to `.node` groups entered via D3. If nodes are dynamically added/removed, merge selection properly or use event delegation. Or simply ensuring `click` always toggles `d.expanded`.
- **Requirement**: "Faint curved border" for in-degree nodes.
- **Refinement**: Convex Hull or Bubble Set around _all_ upstream nodes of the active central node.

### 3. Implementation Steps for Mockup V3

1.  **Data Structure**: Enhance `Node` with `polygons` or `contours`.
2.  **Recursive Contour Calculation**: Function `getContour(node)` returns `{ [level]: {min, max} }`.
3.  **Contour Merge**: Function `mergeContours(c1, c2, offset_x, offset_y)`.
4.  **Layout Loop**:
    - Iterate Spine.
    - `x = max(prev_spine_x + MIN_SPACING, findSafeX(node_contour, accum_contour))`.
    - Update Accumulators.

---

## 会话 5: 基于轮廓的布局与深度交互

**日期**: 2026-02-02

### 1. 重叠问题 (深度分析)

- **用户见解**: “不仅是主学习路径与其入度节点之间的关系，而是 _所有节点之间_... 不允许碰撞。”
- **先前方法的失败**: 简单的动态主干仅检查了主干节点的重叠。它没有考虑到节点 A 的深度支流与节点 B 的深度支流发生的碰撞。
- **需求**: **基于轮廓的碰撞避让**。
- **算法**:
  - 我们必须计算每个子树的“剪影” (Silhouette/Skyline)。
  - **剪影**: 相对于根节点的每一层深度的 `(min_x, max_x)` 范围列表。
  - **合并**: 当在现有放置节点旁放置新节点时，检查它们在对应 Y 层级上的剪影是否相交。
  - **主干放置**:
    - 维护“下”侧和“上”侧的 `GlobalRightContour` (全局右轮廓)。
    - 当放置主干节点 `i` (向下) 时:
      - 移动 `i.x` 直到 `i` 的 _左轮廓_ 清除 `GlobalRightContour (Down)` + 间距。
      - 通过合并 `i` 的右轮廓来更新 `GlobalRightContour (Down)`。
      - 上方同理。

### 2. 交互与视觉

- **问题**: 并非所有节点都可折叠。
- **修复**: Mockup 中的默认点击处理程序仅应用于通过 D3 进入的 `.node` 组。如果节点是动态添加/删除的，需正确合并选择或使用事件委托。或者简单地确保 `click` 始终切换 `d.expanded`。
- **需求**: 入度节点的“微弱弯曲边框”。
- **优化**: 在活动中心节点的所有上游节点周围绘制凸包或气泡集。

### 3. Mockup V3 实施步骤

1.  **数据结构**: 增强 `Node`，增加 `polygons` 或 `contours`。
2.  **递归轮廓计算**: 函数 `getContour(node)` 返回 `{ [level]: {min, max} }`.
3.  **轮廓合并**: 函数 `mergeContours(c1, c2, offset_x, offset_y)`.
4.  **布局循环**:
    - 遍历主干。
    - `x = max(prev_spine_x + MIN_SPACING, findSafeX(node_contour, accum_contour))`.
    - 更新累加器。

---

## 会话 4: 自动避让与视觉气泡

**日期**: 2026-02-02

### 1. 碰撞避让 (动态主干)

- **问题**: 如果节点 1（下）和节点 3（下）都具有巨大的子树导致碰撞，固定间距（`500px`）将失效。
- **概念**: 动态主干放置。
- **算法**:
  1.  自底向上计算每个主干节点的 `SubtreeWidth` 和 `SubtreeBounds`（相对于根的 min_x, max_x）。
  2.  从左到右放置主干节点。
  3.  `Spine[i].x = Spine[i-1].x + SPACING_X + Constraint`。
  4.  **约束**:
      - 查找 _同侧_ 的前一个节点（例如，如果 i 是下/偶数，检查 i-2）。
      - 确保 `Spine[i].min_x > Spine[i-2].max_x + GAP`。
      - 同时确保与直接邻居 (i-1) 的逻辑合理（通常连接线会变长）。
- **优化**: 由于布局是基于树的，“移动”根节点会移动整个树。我们只需要找到根节点的安全 X 坐标。

### 2. 分组高亮 (视觉气泡)

- **需求**: 在中心节点的入度节点周围显示“微弱的弯曲边框”。
- **场景**: 当中心节点展开时。
- **实现**:
  1.  **数据**: 识别属于中心节点“入度树”的节点集合。
  2.  **几何**: 计算这些节点的凸包 (Convex Hull) 或简单的边界框 (Bounding Box) + 填充。
  3.  **渲染**: 在节点后方使用低透明度的 `StyleBoxFlat` 或 `draw_rect/draw_polygon` 绘制。
- **折叠状态**: “所有现有的入度节点都应点亮”。
  - 这已由“焦点模式”的变暗逻辑部分处理。我们需要确保 _所有_ 后代（不仅是直接后代）都被高亮？或者只是“入度节点”。通常指流。我将递归高亮。

### 3. 计划

1.  **Mockup**: 在 `tree_path_mockup.html` 中实现动态主干间距。
2.  **Mockup**: 在 `tree_path_mockup.html` 中实现“分组气泡”。
3.  **验证**: 向用户展示。

---

## 会话 3: 修复布局密度与重复问题 (当前)

**日期**: 2026-02-02

### 1. 重复节点 Bug

- **观察**: 用户看到多个相同的节点（例如 "S&P 500"）作为兄弟节点出现。
- **根本原因**: 底层图数据可能在两个节点之间包含多条边（例如同时存在 "前提" 和 "相关" 关系）。`getTreeLayout` 中的 `getPrerequisites` 辅助函数直接将边映射为源 ID，未进行去重。
- **机制**:
  ```javascript
  // 当前逻辑
  const prereqs = incomingEdges.map((e) => e.source); // 返回 ['A', 'A']
  const unplaced = prereqs.filter((id) => !placed.has(id)); // 返回 ['A', 'A'] (都通过检查)
  unplaced.forEach((id) => {
    place(id); // 放置 A (第1次)
    place(id); // 放置 A (第2次) - 重复！
  });
  ```
- **解决方案**: 在处理之前强制对前提节点列表去重。
  ```javascript
  const uniquePrereqs = [...new Set(incomingEdges.map((e) => e.source))];
  ```

### 2. 重叠与密度

- **观察**: 考虑到新的圆角矩形形状（180px 宽），节点过于紧凑导致重叠。
- **当前设置**: `SIBLING_GAP = 220`。节点宽 = 180。间隙 = 40px。太紧了。
- **建议**:
  - **节点宽度**: 200px (更好容纳文本)
  - **节点高度**: 60px
  - **兄弟间距 (Sibling Gap)**: 250px (中心间距)。净间隙 = 50px。
  - **主干间距 (Spine Spacing X)**: 400px。
  - **层级高度 (Level Height Y)**: 150px。

### 3. 实施计划

1.  **去重前提节点**: 修改 `path_core.js` 中的 `getTreeLayout`。
2.  **调整常量**: 更新 `SPACING_X`, `LEVEL_HEIGHT`, `SIBLING_GAP`。
3.  **优化渲染器**: 更新 `tree_renderer.gd` 的节点尺寸常量以匹配 (200x60)。

---

## Session 6: 9-Rule Ownership Engine

**Date**: 2026-02-26

### 1. The Ownership Problem (Core Insight)

- **Observation**: The current production layout in [path_core.js](file:///e:/Knowledge_project/NoteConnection_app/src/frontend/libs/path_core.js) `getTreeLayout()` treats node placement as a purely geometric problem. It uses:
  - `placedNodeIds` Set → "has this node been positioned?"
  - `collapsedSet` → "is this node collapsed?"
  - Contour-based spacing → "do subtrees overlap?"
- **Missing**: There is no concept of **who expanded a node** (ownership), **when** they expanded it (priority), or **what rules govern claiming** (immunity/migration).
- **Consequence**: Shared prerequisites are arbitrarily assigned to the first parent encountered during BFS traversal, with no regard for spine precedence, expansion order, or visibility chains.

### 2. The Mockup Solution: Ownership-Based Layout

The `tree_path_mockup.html` introduces a fundamentally different paradigm:

- **Every non-spine node has an owner** (`currentOwner`): The spine node that "expanded" to reveal it.
- **Ownership has priority** (`ownerPriority`): Based on FIFO expansion order.
- **Ownership governs visibility**: If owner is collapsed → node becomes invisible (non-spine) or returns to spine (spine).
- **Ownership governs edges**: Edges are NOT drawn between nodes with different owners (Rule 5).

### 3. The 9 Rules — Design Rationale

| Rule                         | Why It Exists           | Without It                                         |
| ---------------------------- | ----------------------- | -------------------------------------------------- |
| 1. Expansion Order           | Deterministic behavior  | Random claiming based on iteration order           |
| 2. Preceding Immunity        | Spine coherence         | Later nodes could steal earlier spine nodes        |
| 3. Following Migration       | Unit coherence          | Spine nodes after expander left orphaned           |
| 4. Single Appearance         | No visual duplicates    | Same node rendered multiple times                  |
| 5. Cross-Tributary Isolation | Clean separation        | Spaghetti edges crossing ownership boundaries      |
| 6. Spine Always Visible      | Navigation anchor       | Spine nodes disappear when owner collapses         |
| 7. Sticky Claim              | User preference         | Always revert or always keep — no middle ground    |
| 8. Unit Migration            | Hierarchical movement   | Spine node moves but its tributaries stay behind   |
| 9. Tributary Immunity        | Prevents infinite loops | Tributary claims spine nodes above it in hierarchy |

### 4. Dynamic Effective Index — Key Innovation

- **Problem**: When Optimization (idx 3) is claimed by Calculus (idx 1), Optimization now "belongs" to Calculus's territory. But Optimization's original `spineIndex = 3` means it can't claim Diff Eq (idx 2) because `2 ≤ 3`.
- **Solution**: `getEffectiveSpineIndex()` — When claimed, a spine node inherits its owner's index for Rule 2 comparisons.
- **Effect**: Optimization operating at idx 1 can now claim Diff Eq (idx 2) since `2 > 1`.
- **Revert**: When owner collapses, effective index reverts to original.

### 5. Implementation Strategy

- **Do NOT rewrite `getTreeLayout()` from scratch**. Instead:
  1. Insert a `processExpansions()` phase BEFORE the existing contour/placement code.
  2. This phase assigns `currentOwner`, `ownerPriority`, `_isOnSpine` to each node.
  3. The existing contour system then operates on the FILTERED visible node set.
  4. Hulls and edges reference ownership data for filtering.

### 6. Open Questions

1. **Performance**: The mockup iterates all nodes multiple times (process + visibility + placement). For large graphs (10000+ nodes), is this acceptable?
   - **Hypothesis**: Yes. The expansion/claiming phase is O(E × P) where E = expanded count, P = average prerequisites. For typical learning paths (20-100 spine nodes), this is sub-millisecond.
2. **Godot Integration**: Should the 9 rules be computed in `path_core.js` (JavaScript worker) or duplicated in `tree_renderer.gd` (GDScript)?
   - **Decision**: Compute in `path_core.js` only. Send enriched layout data (with `currentOwner`, `_isOnSpine`, node type) to Godot. Godot only renders.

---

## 会话 6：9 规则所有权引擎

**日期**: 2026-02-26

### 1. 所有权问题（核心洞察）

- **观察**: `path_core.js` 的 `getTreeLayout()` 将节点放置视为纯粹的几何问题。使用 `placedNodeIds`、`collapsedSet` 和轮廓间距。
- **缺失**: 没有"谁展开了节点"（所有权）、"何时展开"（优先级）或"认领规则"（免疫/迁移）的概念。
- **后果**: 共享前置节点在 BFS 遍历中被任意分配给第一个遇到的父节点，不考虑脊柱优先、展开顺序或可见性链。

### 2. 原型解决方案：基于所有权的布局

- 每个非脊柱节点都有所有者（`currentOwner`）
- 所有权有优先级（`ownerPriority`）：基于 FIFO 展开顺序
- 所有权决定可见性和边的绘制

### 3. 动态有效索引 — 关键创新

- **问题**: 优化(idx 3)被微积分(idx 1)认领后，原始索引阻止认领微分方程(idx 2)
- **解决方案**: `getEffectiveSpineIndex()` — 被认领时继承所有者的索引
- **还原**: 所有者折叠时恢复原始索引

### 4. 实施策略

- 不从头重写 `getTreeLayout()`，而是在现有轮廓/放置代码之前插入 `processExpansions()` 阶段
- 该阶段为每个节点分配 `currentOwner`、`ownerPriority`、`_isOnSpine`
- 现有轮廓系统在过滤后的可见节点集上运行

### 5. 开放问题

1. **性能**: 对大图（10000+ 节点）的多次迭代是否可接受？答：是，展开/认领阶段是 O(E × P)，通常亚毫秒
2. **Godot 集成**: 9 规则仅在 `path_core.js` 中计算，发送富布局数据到 Godot，Godot 仅渲染
