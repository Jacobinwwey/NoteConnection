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
