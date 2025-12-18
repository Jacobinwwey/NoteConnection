# 2025-12-17 v0.1.0

# Robustness Test Report

## 1. Test Environment
*   **Directory**: `test_robustness/`
*   **Test Script**: `src/backend/test_robustness.ts`
*   **Sample Data**: 6 Markdown files designed to cover edge cases.

## 2. Test Cases & Results

| Case ID | Description | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TC-01** | **Empty File** <br> (`Empty Concept.md`) | System parses file, creates node, no crash. | Node created. No edges. | ✅ PASS |
| **TC-02** | **Special Characters** <br> (`Special (Char) Concept.md`) | Correctly handles `()` in filename and linking. | Edge `Concept A` -> `Special (Char) Concept` created. | ✅ PASS |
| **TC-03** | **Case Insensitivity** <br> (`Concept D` mentions `concept a`) | Link created despite case mismatch. | Edge `Concept A` -> `Concept D` created. | ✅ PASS |
| **TC-04** | **Cycle Formation** <br> (A->B->C->A) | Graph allows cycles (raw build). System does not hang. | Edges `B->A`, `C->B`, `A->C` created. | ✅ PASS |
| **TC-05** | **Keyword Matching** | Logic: If A mentions B, B is prerequisite (B->A). | All directional edges formed correctly. | ✅ PASS |

## 3. Feasibility Analysis for DAG Construction

The current "Keyword Matching" logic successfully creates a directed graph. However, as seen in **TC-04**, cycles can easily form (`A` mentions `B`, `B` mentions `C`, `C` mentions `A`).

**Implications for Future Development (v0.2.0 - v0.3.0)**:
1.  **Cycle Breaking is Mandatory**: The raw graph is **not** a DAG. The planned "Cycle Detection & Resolution" module (v0.3.0) is critical.
2.  **Ambiguity of "Mention"**: Currently, "Mentioning" implies "Prerequisite". This is a strong assumption.
    *   *Correction*: `Concept A` mentions `Concept B` could mean `A` explains `B` (A->B) OR `A` uses `B` (B->A).
    *   *Refinement*: The Hybrid Strategy (v0.6.0) using Statistics ($P(B|A)$) will help resolve this ambiguity better than simple keyword matching.

## 4. Conclusion
The core ingestion and graph construction engine is **robust**. It handles malformed inputs, special characters, and loops without failure. The path to a true DAG requires the implementation of the algorithmic layers defined in the roadmap.

---
---

# 健壮性测试报告

## 1. 测试环境 (Test Environment)
*   **目录**: `test_robustness/`
*   **测试脚本**: `src/backend/test_robustness.ts`
*   **样本数据**: 6 个 Markdown 文件，旨在覆盖边缘情况。

## 2. 测试用例与结果 (Test Cases & Results)

| 用例 ID     | 描述                                           | 预期结果                           | 实际结果                                          | 状态   |
| :-------- | :------------------------------------------- | :----------------------------- | :-------------------------------------------- | :--- |
| **TC-01** | **空文件** <br> (`Empty Concept.md`)            | 系统解析文件，创建节点，无崩溃。               | 节点已创建。无边。                                     | ✅ 通过 |
| **TC-02** | **特殊字符** <br> (`Special (Char) Concept.md`)  | 正确处理文件名和链接中的 `()`。             | 创建了边 `Concept A` -> `Special (Char) Concept`。 | ✅ 通过 |
| **TC-03** | **不区分大小写** <br> (`Concept D` 提及 `concept a`) | 尽管大小写不匹配，仍创建链接。                | 创建了边 `Concept A` -> `Concept D`。              | ✅ 通过 |
| **TC-04** | **循环形成** <br> (A->B->C->A)                   | 图允许循环（原始构建）。系统不挂起。             | 创建了边 `B->A`, `C->B`, `A->C`。                  | ✅ 通过 |
| **TC-05** | **关键词匹配**                                    | 逻辑：如果 A 提到 B，则 B 是先决条件 (B->A)。 | 所有有向边正确形成。                                    | ✅ 通过 |

## 3. DAG 构建的可行性分析 (Feasibility Analysis for DAG Construction)

当前的“关键词匹配”逻辑成功创建了有向图。然而，如 **TC-04** 所示，很容易形成循环（`A` 提到 `B`，`B` 提到 `C`，`C` 提到 `A`）。

**对未来开发的影响 (v0.2.0 - v0.3.0)**:
1.  **必须打破循环**: 原始图**不是** DAG。计划中的“循环检测与解决”模块 (v0.3.0) 至关重要。
2.  **"提及"的歧义**: 目前，“提及”意味着“先决条件”。这是一个强假设。
    *   *修正*: `Concept A` 提到 `Concept B` 可能意味着 `A` 解释 `B` (A->B) 或者 `A` 使用 `B` (B->A)。
    *   *改进*: 使用统计数据 ($P(B|A)$) 的混合策略 (v0.6.0) 将比简单的关键词匹配更好地解决这种歧义。

## 4. 结论 (Conclusion)
核心摄取和图构建引擎具有**健壮性**。它可以处理格式错误的输入、特殊字符和循环而不会失败。实现真正的 DAG 需要按路线图实施算法层。

---

### 2025-12-18 v0.1.1 - 独立 DAG 构建测试 (Independent DAG Builder Test)

## 1. 测试环境 (Test Environment)
*   **目录**: `testconcept/` (214 个真实概念文件)
*   **测试脚本**: `src/backend/build_dag.ts`
*   **前端**: `src/frontend/index.html`

## 2. 测试执行摘要 (Test Execution Summary)

| 步骤 (Step) | 动作 (Action) | 结果 (Result) | 状态 (Status) |
| :--- | :--- | :--- | :--- |
| **1. 解析 (Parsing)** | 扫描 `testconcept` 目录下的 Markdown 文件。 | 成功加载 **214** 个节点。文件名正确用作 ID。 | ✅ PASS |
| **2. 边推断 (Edge Inference)** | 对每个文件内容执行全词匹配 (Case-insensitive)。 | 发现 **384** 条边。 | ✅ PASS |
| **3. 数据生成 (Data Gen)** | 生成 `graph_data.json`。 | JSON 格式有效。包含 `nodes` 和 `links` 数组。 | ✅ PASS |
| **4. 可视化 (Visualization)** | 在浏览器中打开 `index.html`。 | 成功渲染力导向图。节点交互（拖拽、悬停）正常工作。 | ✅ PASS |

## 3. 观察与分析 (Observations & Analysis)

*   **性能 (Performance)**: 处理 200+ 文件和 40,000+ 次正则匹配（214 * 214）在 Node.js 环境下瞬间完成 (< 1秒)。
*   **连接质量 (Connectivity Quality)**:
    *   关键词匹配策略有效地捕获了显式提及。
    *   **问题**: 存在一些孤立节点 (Isolated Nodes)，即没有提及其他文件且未被其他文件提及。这在知识库早期阶段是正常的。
    *   **方向性**: 目前采用“提及者依赖被提及者” (Mentioner depends on Mentioned) 的策略。对于某些情况（如“A 参见 B”），这可能反了。但在大多数“A 使用概念 B”的情况下，这是正确的。

## 4. 结论 (Conclusion)
v0.1.1 版本的独立构建器已成功实现并验证。它为后续的算法优化（如循环检测和混合推断）提供了坚实的数据基础和可视化平台。

---
---

### 2025-12-18 v0.1.1 - Independent DAG Builder Test

## 1. Test Environment
*   **Directory**: `testconcept/` (214 real concept files)
*   **Test Script**: `src/backend/build_dag.ts`
*   **Frontend**: `src/frontend/index.html`

## 2. Test Execution Summary

| Step | Action | Result | Status |
| :--- | :--- | :--- | :--- |
| **1. Parsing** | Scan Markdown files in `testconcept`. | **214** nodes loaded successfully. Filenames used as IDs. | ✅ PASS |
| **2. Edge Inference** | Perform case-insensitive whole-word matching on content. | **384** edges discovered. | ✅ PASS |
| **3. Data Gen** | Generate `graph_data.json`. | Valid JSON format with `nodes` and `links`. | ✅ PASS |
| **4. Visualization** | Open `index.html` in browser. | Force-directed graph renders successfully. Interactions (drag, hover) work. | ✅ PASS |

## 3. Observations & Analysis

*   **Performance**: Processing 200+ files and 40,000+ regex matches completed instantly (< 1s) in Node.js.
*   **Connectivity Quality**:
    *   Keyword matching effectively captures explicit mentions.
    *   **Issue**: Some isolated nodes exist (no incoming/outgoing edges). This is expected in early-stage knowledge bases.
    *   **Directionality**: Current strategy is "Mentioner depends on Mentioned". This is generally correct for "A uses concept B", though "See also" links might be ambiguous.

## 4. Conclusion
The v0.1.1 independent builder is successfully implemented and verified. It provides a solid data foundation and visualization platform for upcoming algorithmic optimizations (Cycle Detection, Hybrid Inference).

---

### 2025-12-18 v0.1.2 - In/Out-Degree Visualization Test

## 1. Test Environment
*   **Backend**: Updated `src/backend/build_dag.ts` with degree calculation.
*   **Frontend**: Updated `src/frontend/index.html` with filters and highlighting logic.
*   **Data**: `graph_data.json` regenerated from `testconcept/`.

## 2. Test Execution Summary

| Feature | Action | Result | Status |
| :--- | :--- | :--- | :--- |
| **Data Integrity** | Inspect `graph_data.json`. | Nodes contain `inDegree` and `outDegree` integers. | ✅ PASS |
| **Tooltip Display** | Hover over a node in UI. | Tooltip shows "In-Degree: X, Out-Degree: Y". | ✅ PASS |
| **Visual Separation** | Hover over a node (Filter: "All"). | Incoming edges turn Orange, Outgoing edges turn Blue. Arrowheads match color. | ✅ PASS |
| **Filter Logic (In)** | Set Filter to "In-Degree Only". Hover node. | Only Orange (incoming) edges are visible. Outgoing are hidden/dimmed. | ✅ PASS |
| **Filter Logic (Out)** | Set Filter to "Out-Degree Only". Hover node. | Only Blue (outgoing) edges are visible. Incoming are hidden/dimmed. | ✅ PASS |

## 3. Observations
*   **Usability**: The separation of colors (Orange vs. Blue) significantly improves the readability of the graph, especially for "hub" nodes with many connections.
*   **Data Insight**: Immediately reveals which concepts are "Fundamental" (High Out-degree, Low In-degree in this context) vs. "Integrative" (High In-degree).
    *   *Note*: Directionality assumption (Mentioner -> Mentioned) means "Fundamental" nodes are actually pointed *to* by many files (High In-degree).
    *   *Correction*: In current logic, `A` mentions `B` creates `B -> A`.
        *   `B` (Fundamental) is source. `A` (Derived) is target.
        *   So Fundamental Concept = High Out-Degree (Source of many edges).
        *   Derived Concept = High In-Degree (Target of many edges).

## 4. Conclusion
v0.1.2 successfully implements degree visualization and filtering, meeting the user requirements for distinct UI operations.