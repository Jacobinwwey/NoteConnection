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