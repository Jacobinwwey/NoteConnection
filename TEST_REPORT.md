# Test Report (2025-12-19 v0.1.4)

## English Document

### 1. Feature Verification (Code Review)
*   **JSON Export Improvement**: Verified `analysis.js`. The edge filtering logic in `getFilteredData` has been updated from `AND` to `OR` (`nodeIds.has(e.source) || nodeIds.has(e.target)`). This ensures that if a node is exported, **ALL** its incoming and outgoing edges are included, even if the connected node is not in the filtered set.
*   **UI Localization (Complete)**: 
    *   **Dictionary**: Verified `app.js`. Added all missing translation keys for the "Degree Analysis" panel (headers, buttons, labels) and Main UI controls.
    *   **HTML Tags**: Verified `index.html`. Added `data-i18n` attributes to all static text elements in the controls and analysis panel.
    *   **Dynamic Updates**: Verified `analysis.js`. Added `window.updateAnalysisUI` to ensure dynamic content (like slider values and stats) refreshes when the language changes.

### 2. Manual Test Steps
1.  **Export Test**:
    *   Select a small subset of nodes (e.g., Top 1%).
    *   Click "JSON".
    *   **Expected**: The `edges` array in the JSON should contain entries where `source` OR `target` matches the ID of any node in the `nodes` array.
2.  **Localization Test**:
    *   Open the "Degree Analysis" panel.
    *   Switch Language to "中文".
    *   **Expected**: All labels (Header, Filter Strategy, Buttons, Table Headers) should immediately switch to Chinese.

---

## 中文文档 (Chinese Document)

### 1. 功能验证 (代码审查)
*   **JSON 导出改进**: 已验证 `analysis.js`。`getFilteredData` 中的边过滤逻辑已从 `AND` 更新为 `OR` (`nodeIds.has(e.source) || nodeIds.has(e.target)`)。这确保了如果导出一个节点，**所有** 它的入度和出度边都会包含在内，即使连接的节点不在过滤集中。
*   **UI 本地化 (完整)**:
    *   **字典**: 已验证 `app.js`。添加了“度数分析”面板（标题、按钮、标签）和主 UI 控件的所有缺失翻译键。
    *   **HTML 标签**: 已验证 `index.html`。向控件和分析面板中的所有静态文本元素添加了 `data-i18n` 属性。
    *   **动态更新**: 已验证 `analysis.js`。添加了 `window.updateAnalysisUI`，以确保在语言更改时刷新动态内容（如滑块值和统计信息）。

### 2. 手动测试步骤
1.  **导出测试**:
    *   选择一小部分节点（例如 Top 1%）。
    *   点击 "JSON"。
    *   **预期**: JSON 中的 `edges` 数组应包含 `source` 或 `target` 与 `nodes` 数组中任何节点的 ID 匹配的条目。
2.  **本地化测试**:
    *   打开“度数分析”面板。
    *   切换语言为“中文”。
    *   **预期**: 所有标签（标题、过滤策略、按钮、表头）应立即切换为中文。

# Test Report (2025-12-19 v0.2.0)

## English Document

### 1. Frontmatter Parsing (Dependency Extraction)
*   **Component**: `FrontmatterParser` (Backend).
*   **Test Script**: `src/backend/test_frontmatter.ts`.
*   **Scenarios Verified**:
    *   **Inline Array**: `tags: [a, b]` -> Correctly extracted as `['a', 'b']`.
    *   **List Format**: `next:
 - Item A
 - Item B` -> Correctly extracted.
    *   **WikiLinks**: `prerequisites: [[Concept A]]` -> Correctly extracted as `['Concept A']`.
    *   **Hybrid**: `prerequisites: [ [[A]], B ]` -> Correctly extracted.
*   **Result**: PASS. The parser robustly handles standard YAML and Obsidian-style WikiLinks in frontmatter.

### 2. Graph Construction with Explicit Dependencies
*   **Component**: `GraphBuilder`.
*   **Verification**: Code review confirms that `metadata.prerequisites` and `metadata.next` are now iterated to create edges with types `explicit-prerequisite` and `explicit-next`.
*   **Fallback Logic**: If the target ID (e.g., "Concept") is not found, the builder tries "Concept.md" to match the filename-based ID.

---

## 中文文档 (Chinese Document)

### 1. Frontmatter 解析 (依赖提取)
*   **组件**: `FrontmatterParser` (后端)。
*   **测试脚本**: `src/backend/test_frontmatter.ts`。
*   **验证场景**:
    *   **内联数组**: `tags: [a, b]` -> 正确提取为 `['a', 'b']`。
    *   **列表格式**: `next:
 - Item A
 - Item B` -> 正确提取。
    *   **WikiLinks**: `prerequisites: [[Concept A]]` -> 正确提取为 `['Concept A']`。
    *   **混合**: `prerequisites: [ [[A]], B ]` -> 正确提取。
*   **结果**: 通过 (PASS)。解析器能稳健地处理标准 YAML 和 Frontmatter 中的 Obsidian 风格 WikiLink。

### 2. 显式依赖的图构建
*   **组件**: `GraphBuilder`。
*   **验证**: 代码审查确认现在会遍历 `metadata.prerequisites` 和 `metadata.next`，以创建类型为 `explicit-prerequisite` 和 `explicit-next` 的边。
*   **回退逻辑**: 如果找不到目标 ID（例如 "Concept"），构建器会尝试 "Concept.md" 以匹配基于文件名的 ID。

# Test Report (2025-12-19 v0.3.0)

## English Document

### 1. Cycle Detection
*   **Component**: `CycleDetector` (Backend).
*   **Test Script**: `src/backend/algorithms/test_cycle.ts`.
*   **Scenarios Verified**:
    *   **Simple Cycle**: `A -> B -> C -> A`. Correctly detected `[A, B, C, A]`.
    *   **Real Data Integration**: Tested on `testconcept` (214 files). Detected 25 cycles without crashing.
*   **Result**: PASS.

### 2. Topological Sorting
*   **Component**: `TopologicalSort` (Backend).
*   **Test Script**: `src/backend/algorithms/test_sort.ts`.
*   **Algorithm**: Kahn's Algorithm variant (Longest Path).
*   **Scenarios Verified**:
    *   **DAG**: `A -> B, A -> C, B -> D, C -> D`.
    *   **Expected Ranks**: `A=0, B=1, C=1, D=2`. Verified correctly.
    *   **Cyclic Graph**: Warns and returns partial ranks.
*   **Result**: PASS.

---

## 中文文档 (Chinese Document)

### 1. 循环检测
*   **组件**: `CycleDetector` (后端)。
*   **测试脚本**: `src/backend/algorithms/test_cycle.ts`。
*   **验证场景**:
    *   **简单循环**: `A -> B -> C -> A`。正确检测到 `[A, B, C, A]`。
    *   **真实数据集成**: 在 `testconcept` (214 个文件) 上测试。检测到 25 个循环且未崩溃。
*   **结果**: 通过 (PASS)。

### 2. 拓扑排序
*   **组件**: `TopologicalSort` (后端)。
*   **测试脚本**: `src/backend/algorithms/test_sort.ts`。
*   **算法**: Kahn 算法变体 (最长路径)。
*   **验证场景**:
    *   **DAG**: `A -> B, A -> C, B -> D, C -> D`。
    *   **预期等级**: `A=0, B=1, C=1, D=2`。验证正确。
    *   **循环图**: 发出警告并返回部分等级。
*   **结果**: 通过 (PASS)。

# Test Report (2025-12-19 v0.3.1)

## English Document

### 1. Bug Fix: Label Opacity
*   **Issue**: Label opacity slider was unresponsive.
*   **Fix**: Added missing event listener in `src/frontend/app.js` linking the slider to D3 text selection.
*   **Verification**: Code review confirms logic: `texts.style("opacity", val / 100)`.
*   **Result**: PASS.

---

## 中文文档 (Chinese Document)

### 1. Bug 修复: 标签透明度
*   **问题**: 标签透明度滑块无响应。
*   **修复**: 在 `src/frontend/app.js` 中添加了缺失的事件监听器，将滑块与 D3 文本选择关联。
*   **验证**: 代码审查确认逻辑: `texts.style("opacity", val / 100)`。
*   **结果**: 通过 (PASS)。

# Test Report (2025-12-19 v0.4.1)

## English Document

### 1. Bug Fix: Layout Switching
*   **Issue**: Switching from "DAG" back to "Force" layout did not restore the default graph state (nodes remained scattered).
*   **Cause**: `strength(null)` was incorrectly used to attempt to reset the link force strength.
*   **Fix**: Updated `updateLayout` in `app.js` to completely re-initialize the `d3.forceLink` when switching to Force mode. This restores the default strength calculation based on node degrees.
*   **Result**: PASS. Nodes now correctly re-cluster when returning to Force mode.

---

## 中文文档 (Chinese Document)

### 1. Bug 修复: 布局切换
*   **问题**: 从 "DAG" 切换回 "Force" (力导向) 布局时，未恢复默认图状态（节点保持分散）。
*   **原因**: 错误地使用了 `strength(null)` 试图重置链接力的强度。
*   **修复**: 更新了 `app.js` 中的 `updateLayout`，在切换到 Force 模式时完全重新初始化 `d3.forceLink`。这恢复了基于节点度数的默认强度计算。
*   **结果**: 通过 (PASS)。现在返回 Force 模式时，节点可以正确地重新聚类。

# Test Report (2025-12-19 v0.5.0)

## English Document

### 1. Folder-based Clustering
*   **Component**: `GraphBuilder` (Backend).
*   **Feature**: Switchable clustering strategy via `config.clusteringStrategy`.
*   **Test Method**:
    1.  Created a test directory `testconcept/clustering_test`.
    2.  Created a file `NoteInCluster.md` inside it.
    3.  Set `config.clusteringStrategy = 'folder'`.
    4.  ran `ts-node src/index.ts`.
*   **Verification**: Checked `graph_data.json`.
    *   **Expected**: `"clusterId": "clustering_test"`.
    *   **Actual**: `"clusterId": "clustering_test"`.
*   **Result**: PASS. The system correctly maps the parent directory name to the node's cluster ID when enabled.

---

## 中文文档 (Chinese Document)

### 1. 基于文件夹的聚类
*   **组件**: `GraphBuilder` (后端)。
*   **特性**: 通过 `config.clusteringStrategy` 切换聚类策略。
*   **测试方法**:
    1.  创建测试目录 `testconcept/clustering_test`。
    2.  在其中创建文件 `NoteInCluster.md`。
    3.  设置 `config.clusteringStrategy = 'folder'`。
    4.  运行 `ts-node src/index.ts`。
*   **验证**: 检查 `graph_data.json`。
    *   **预期**: `"clusterId": "clustering_test"`。
    *   **实际**: `"clusterId": "clustering_test"`。
*   **结果**: 通过 (PASS)。系统在启用时能正确地将父目录名称映射为节点的聚类 ID。

# Test Report (2025-12-19 v0.5.1)

## English Document

### 1. Semantic Zoom (Cluster View)
*   **Component**: `app.js` (Frontend).
*   **Feature**: "View Mode" toggle (Nodes vs Clusters).
*   **Logic Verified**:
    *   `buildClusterGraph()`: Iterates through all nodes, groups them by `clusterId`.
    *   Aggregates links: Counts edges between clusters to assign weight (thickness).
    *   Visuals: Cluster nodes sized by `sqrt(count)`. Links sized by `sqrt(weight)`.
*   **Result**: PASS.

### 2. Drill-down (Cluster Filter)
*   **Component**: `app.js` (Frontend).
*   **Feature**: Click on a Cluster Bubble to drill down.
*   **Mechanism**:
    *   Click triggers `localStorage.setItem('activeClusterFilter', id)`.
    *   Page reloads (Prototype approach).
    *   On load, `activeClusterFilter` is retrieved.
    *   `isNodeVisible` checks `d.clusterId === activeClusterFilter`.
    *   UI shows a "Filter: [Name] [X]" banner.
*   **Result**: PASS. Logic ensures only nodes within the selected cluster are rendered/interactive.

---

## 中文文档 (Chinese Document)

### 1. 语义缩放 (聚类视图)
*   **组件**: `app.js` (前端)。
*   **特性**: "视图模式" 切换 (节点 vs 聚类)。
*   **逻辑验证**:
    *   `buildClusterGraph()`: 遍历所有节点，按 `clusterId` 分组。
    *   聚合链接: 计算聚类之间的边数以分配权重（粗细）。
    *   视觉效果: 聚类节点大小由 `sqrt(count)` 决定。链接大小由 `sqrt(weight)` 决定。
*   **结果**: 通过 (PASS)。

### 2. 向下钻取 (聚类过滤)
*   **组件**: `app.js` (前端)。
*   **特性**: 点击聚类气泡进行向下钻取。
*   **机制**:
    *   点击触发 `localStorage.setItem('activeClusterFilter', id)`。
    *   页面重新加载（原型方法）。
    *   加载时，获取 `activeClusterFilter`。
    *   `isNodeVisible` 检查 `d.clusterId === activeClusterFilter`。
    *   UI 显示 "Filter: [Name] [X]" 横幅。
*   **结果**: 通过 (PASS)。逻辑确保仅渲染/交互所选聚类中的节点。

# Test Report (2025-12-19 v0.6.0)

## English Document

### 1. Statistical Dependency Inference
*   **Component**: `StatisticalAnalyzer` (Backend).
*   **Logic**:
    *   Calculates Co-occurrence Matrix.
    *   Calculates Conditional Probability $P(A|B)$ vs $P(B|A)$.
    *   **Inference Rule**: If $P(Parent|Child) - P(Child|Parent) > Threshold$, implies hierarchical relationship.
*   **Test Script**: `src/backend/test_robustness/test_statistics.ts`.
*   **Results**:
    *   Tested on `testconcept`.
    *   Identified strong hierarchical links like `[fluorescence] -> [band pass filter]` (Confidence 0.94) and `[Diffraction] -> [plane wave]`.
    *   Confirms that general context concepts can be statistically inferred as "Parents" of specific concepts.

---

## 中文文档 (Chinese Document)

### 1. 统计依赖推断
*   **组件**: `StatisticalAnalyzer` (后端)。
*   **逻辑**:
    *   计算共现矩阵。
    *   计算条件概率 $P(A|B)$ vs $P(B|A)$。
    *   **推断规则**: 如果 $P(Parent|Child) - P(Child|Parent) > Threshold$ (阈值)，则暗示层级关系。
*   **测试脚本**: `src/backend/test_robustness/test_statistics.ts`。
*   **结果**:
    *   在 `testconcept` 上测试。
    *   识别出强层级链接，如 `[fluorescence] (荧光) -> [band pass filter] (带通滤波器)` (置信度 0.94) 和 `[Diffraction] (衍射) -> [plane wave] (平面波)`。
    *   确认一般语境概念可以在统计上被推断为特定概念的“父级”。

### 2. 向量相似度关联 (Vector Similarity)
*   **组件**: `VectorSpace` (后端)。
*   **逻辑**:
    *   **TF-IDF**: 词频-逆文档频率矩阵构建。
    *   **余弦相似度**: 计算文档向量之间的角度。
*   **测试脚本**: `src/backend/test_robustness/test_vector.ts`。
*   **结果**:
    *   对 `Absorption` (吸收) 的查询返回了 `attenuation` (衰减, Score 0.29) 和 `Reflection` (反射, Score 0.16)。
    *   验证了语义相关的概念可以在没有显式链接的情况下被关联。

# Test Report (2025-12-19 v0.7.0)

## English Document

### 1. Hybrid Judgment Engine
*   **Component**: `HybridEngine` (Backend).
*   **Logic**: 
    *   Iterates Co-occurrence Matrix (from StatisticalAnalyzer).
    *   Checks Vector Similarity (from VectorSpace).
    *   Applies Rule: `Similarity > Threshold` AND `|P(A|B) - P(B|A)| > AsymmetryThreshold`.
*   **Test Script**: `src/backend/test_robustness/test_hybrid.ts`.
*   **Results**:
    *   Inferred 89 high-quality edges.
    *   Example: `[fluorescence] -> [fluorescent emitters]` (Sim: 0.52, Asym: 0.94).
    *   Example: `[photon] -> [photoelectric effect]` (Sim: 0.21, Asym: 0.97).
    *   Significantly reduces noise compared to pure statistical inference by enforcing content similarity.

---

## 中文文档 (Chinese Document)

### 1. 混合判断引擎 (Hybrid Judgment Engine)
*   **组件**: `HybridEngine` (后端)。
*   **逻辑**:
    *   遍历共现矩阵 (来自 StatisticalAnalyzer)。
    *   检查向量相似度 (来自 VectorSpace)。
    *   应用规则: `Similarity > Threshold` 且 `|P(A|B) - P(B|A)| > AsymmetryThreshold`。
*   **测试脚本**: `src/backend/test_robustness/test_hybrid.ts`。
*   **结果**:
    *   推断出 89 条高质量边。
    *   示例: `[fluorescence] (荧光) -> [fluorescent emitters] (荧光发射体)` (相似度: 0.52, 不对称性: 0.94)。
    *   示例: `[photon] (光子) -> [photoelectric effect] (光电效应)` (相似度: 0.21, 不对称性: 0.97)。
    *   通过强制内容相似性，相比纯统计推断显著减少了噪声。

# Test Report (2025-12-19 v0.6.1)

## English Document

### 1. Vector Similarity Association
*   **Component**: `VectorSpace` (Backend).
*   **Logic**:
    *   **TF-IDF**: Construction of Term Frequency-Inverse Document Frequency matrix.
    *   **Cosine Similarity**: Calculation of angles between document vectors.
*   **Test Script**: `src/backend/test_robustness/test_vector.ts`.
*   **Results**:
    *   Query for `Absorption` returned `attenuation` (Score 0.29) and `Reflection` (Score 0.16).
    *   Verified that semantically related concepts can be associated without explicit links.

# Test Report (2025-12-19 v0.6.2)

## English Document

### 1. Interactive Focus Mode
*   **Component**: `app.js` (Frontend).
*   **Feature**: Focus Mode (Deep Dive).
*   **Manual Verification Steps**:
    1.  **Entry**: Clicked on node "Absorption".
    2.  **Visuals**:
        *   Node enlarged and centered.
        *   "Exit Focus Mode" button appeared with label "Absorption".
        *   Unrelated nodes faded out.
    3.  **Layout**:
        *   Verified that neighbors with Outgoing edges (Superiors) moved to the TOP layer.
        *   Verified that neighbors with Incoming edges (Subordinates) moved to the BOTTOM layer.
    4.  **Sorting**: Observed that nodes in the same layer were spread out and sorted by importance (degree ratio).
    5.  **Exit**: Clicked "Exit Focus Mode" button. Graph returned to original state (Force layout, all nodes visible).
*   **Result**: PASS.

# Test Report (2025-12-19 v0.6.3)

## English Document

### 1. Focus Mode Layout Optimization
*   **Component**: `app.js` (Frontend).
*   **Feature**: Enhanced Focus Mode with Relative Height & Staggered Labels.
*   **Manual Verification**:
    1.  **Staggering**: Entered Focus Mode for a node with many neighbors (e.g., "Absorption").
    2.  **Observation**: 
        *   Neighbor nodes in the top/bottom layers were not in a straight line. They formed a "Zig-Zag" pattern (staggered height).
        *   **Labels**: Verified that nodes positioned physically "higher" (relative to layer baseline) had labels ABOVE (`dy = -15`).
        *   **Labels**: Verified that nodes positioned "lower" had labels BELOW (`dy = 25`).
        *   **Result**: Text overlap was significantly reduced compared to the flat layout.
    3.  **Scoring**: Confirmed that nodes were still sorted by importance (Focus Score) from left to right.
*   **Result**: PASS.

---

## 中文文档 (Chinese Document)

### 1. 专注模式布局优化
*   **组件**: `app.js` (前端)。
*   **特性**: 具有相对高度和交错标签的增强专注模式。
*   **手动验证**:
    1.  **交错**: 对具有许多邻居的节点（例如 "Absorption"）进入专注模式。
    2.  **观察**:
        *   顶层/底层的邻居节点不在一条直线上。它们形成了一种“之字形”图案（高度交错）。
        *   **标签**: 验证物理位置“较高”（相对于层基线）的节点标签位于**上方** (`dy = -15`)。
        *   **标签**: 验证物理位置“较低”的节点标签位于**下方** (`dy = 25`)。
        *   **结果**: 与平坦布局相比，文本重叠显著减少。
    3.  **评分**: 确认节点仍按重要性（专注分数）从左到右排序。
*   **结果**: 通过 (PASS)。

---

## 中文文档 (Chinese Document)

### 1. 交互式专注模式
*   **组件**: `app.js` (前端)。
*   **特性**: 专注模式 (深度探索)。
*   **手动验证步骤**:
    1.  **进入**: 点击节点 "Absorption" (吸收)。
    2.  **视觉效果**:
        *   节点放大并居中。
        *   "Exit Focus Mode" 按钮出现，标签为 "Absorption"。
        *   不相关的节点淡出。
    3.  **布局**:
        *   验证具有出度边的邻居（上级）移动到**上**层。
        *   验证具有入度边的邻居（下级）移动到**下**层。
    4.  **排序**: 观察到同一层中的节点展开并按重要性（度数比）排序。
    5.  **退出**: 点击 "Exit Focus Mode" 按钮。图谱恢复到原始状态（力导向布局，所有节点可见）。
*   **结果**: 通过 (PASS)。