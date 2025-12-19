# Test Report (测试报告)

## 2025-12-25 v0.1.5 - Analysis & Flexible Export

### English Report

**Objective**: Implement degree distribution visualization and flexible export options (Top %, Min Degree, ZIP/JSON).

**1. Degree Distribution Visualization**
- **Feature**: Added "Analysis & Export" modal.
- **Visual**: Histogram bar chart showing frequency of Total Degrees (In + Out).
- **Implementation**: Uses D3.js to render bars dynamically based on loaded graph data.
- **Verification**: Opening the modal displays the distribution correctly.

**2. Flexible Export**
- **Criteria**:
    - **Top X Percent**: Slider selects top rankers (e.g., Top 5%).
    - **Min Degree**: Slider selects nodes with degree > Threshold.
- **Formats**:
    - **JSON**: Exports array of nodes with `id`, `inDegree`, `outDegree`, and full `content`.
    - **ZIP**: Client-side generation of a .zip file containing Markdown files.
- **Implementation**:
    - Backend: `GraphBuilder` now embeds `content` in `graph_data.json`.
    - Frontend: `JSZip` library used to package files in the browser.
    - Verified: Downloaded ZIP contains readable MD files.

**Conclusion**: The system now supports deep analysis of graph structure and easy data extraction for external use.

---

### 中文报告

**目标**: 实现度数分布可视化和灵活的导出选项（前百分比、最小度数、ZIP/JSON）。

**1. 度数分布可视化**
- **功能**: 添加了“分析与导出”模态框。
- **视觉**: 显示总度数（入度+出度）频率的直方图条形图。
- **实现**: 使用 D3.js 根据加载的图数据动态渲染条形图。
- **验证**: 打开模态框能正确显示分布。

**2. 灵活导出**
- **标准**:
    - **前 X 百分比**: 滑块选择排名靠前的节点（例如，前 5%）。
    - **最小度数**: 滑块选择度数 > 阈值的节点。
- **格式**:
    - **JSON**: 导出包含 `id`、`inDegree`、`outDegree` 和完整 `content` 的节点数组。
    - **ZIP**: 浏览器端生成包含 Markdown 文件的 .zip 文件。
- **实现**:
    - 后端: `GraphBuilder` 现在将 `content` 嵌入到 `graph_data.json` 中。
    - 前端: 使用 `JSZip` 库在浏览器中打包文件。
    - 验证: 下载的 ZIP 包含可读的 MD 文件。

**结论**: 系统现在支持对图结构的深入分析以及便于外部使用的数据提取。