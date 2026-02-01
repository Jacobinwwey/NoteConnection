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
