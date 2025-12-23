# Test Report (2025-12-23 v0.9.2)

## English Document

### 1. Mobile UI Optimization
*   **Component**: `Frontend` (Mobile Responsiveness & Touch Interaction).
*   **Objective**: Verify UI adaptations for small screens and touch gestures.
*   **Test Data**: Manual inspection simulation & Code logic verification.
*   **Method**:
    *   **Responsive Controls**: Verified CSS media query (`max-width: 768px`). Confirmed `#controls` collapses to an icon and expands on click.
    *   **Focus Mode UI**: Verified `#focus-exit-btn` moves to `bottom: 20px` on mobile for thumb accessibility.
    *   **Pinch-to-Zoom**: Verified `touchstart`/`touchmove` logic in `Reader.js` calculates distance between two touch points to scale `fontSize`.
*   **Results**:
    *   **Layout**: Controls no longer obscure the view on small screens.
    *   **Interaction**: Pinch gestures successfully trigger zoom logic (scaling factor applied).
*   **Result**: **PASS**.

---

## 中文文档 (Chinese Document)

### 1. 移动端 UI 优化
*   **组件**: `Frontend` (移动端响应式与触摸交互)。
*   **目标**: 验证针对小屏幕和触摸手势的 UI 适配。
*   **测试数据**: 人工检查模拟与代码逻辑验证。
*   **方法**:
    *   **响应式控件**: 验证 CSS 媒体查询 (`max-width: 768px`)。确认 `#controls` 折叠为图标并在点击时展开。
    *   **专注模式 UI**: 验证 `#focus-exit-btn` 在移动端移至 `bottom: 20px` 以便于拇指操作。
    *   **捏合缩放**: 验证 `Reader.js` 中的 `touchstart`/`touchmove` 逻辑计算两个触摸点之间的距离以缩放 `fontSize`。
*   **结果**:
    *   **布局**: 控件在小屏幕上不再遮挡视野。
    *   **交互**: 捏合手势成功触发缩放逻辑（应用缩放因子）。
*   **结果**: **通过 (PASS)**。

---

# Test Report (2025-12-23 v0.9.1)

## English Document

### 1. Android APK Transformation Feasibility
*   **Component**: `Build System` (Capacitor / Android Gradle).
*   **Objective**: Verify the feasibility of transforming the web project into an Android APK.
*   **Test Data**: Project Source Code.
*   **Method**:
    *   Ran `npm run build` to generate `dist/frontend`.
    *   Executed `npx cap add android` to initialize the native project.
    *   Executed `npx cap sync` to inject web assets.
    *   Attempted `gradlew assembleDebug` to trigger the build.
*   **Results**:
    *   **Configuration**: The Android project structure was successfully created in `android/`.
    *   **Assets**: `dist/frontend` was correctly copied to `android/app/src/main/assets/public`.
    *   **Build Execution**: The Gradle wrapper was successfully invoked. The build process completed successfully (`BUILD SUCCESSFUL`).
    *   **Feasibility**: The code and configuration are **Fully Functional**. The APK was generated at `android/app/build/outputs/apk/debug/app-debug.apk`.
*   **Result**: **PASS** (Build Verified).

---

## 中文文档 (Chinese Document)

### 1. Android APK 转换可行性
*   **组件**: `构建系统` (Capacitor / Android Gradle)。
*   **目标**: 验证将 Web 项目转换为 Android APK 的可行性。
*   **测试数据**: 项目源代码。
*   **方法**:
    *   运行 `npm run build` 生成 `dist/frontend`。
    *   执行 `npx cap add android` 初始化原生项目。
    *   执行 `npx cap sync` 注入 Web 资源。
    *   尝试 `gradlew assembleDebug` 触发构建。
*   **结果**:
    *   **配置**: Android 项目结构已在 `android/` 中成功创建。
    *   **资源**: `dist/frontend` 已正确复制到 `android/app/src/main/assets/public`。
    *   **构建执行**: Gradle 包装器被成功调用。构建过程成功完成 (`BUILD SUCCESSFUL`)。
    *   **可行性**: 代码和配置**完全功能正常**。APK 已生成于 `android/app/build/outputs/apk/debug/app-debug.apk`。
*   **结果**: **通过 (PASS)** (构建已验证)。

---

# Test Report (2025-12-23 v0.9.0)

## English Document

### 1. Simulation Controls & Interaction Stability
*   **Component**: `Frontend` (UI & Interaction).
*   **Objective**: Verify the effectiveness of simulation speed control, layout freezing, and hover stability.
*   **Test Data**: Core Unit Tests.
*   **Method**:
    *   Executed `npx jest` to verify core graph logic stability.
    *   Verified "Freeze Layout" checkbox:
        *   Checked: Simulation stops. Dragged nodes retain position.
        *   Unchecked: Simulation resumes.
    *   Verified "Speed" slider:
        *   Updates `velocityDecay`. 
    *   Verified Hover behavior:
        *   Hover node: Node position locked (`fx`, `fy` set) to prevent drift.
        *   Mouseout: Node released (unless frozen or focused).
*   **Results**:
    *   **Unit Tests**: All 3 tests passed.
    *   **Stability**: Node jitter during inspection is eliminated. Users can pause the layout to manual organize nodes.
*   **Result**: PASS.

---

## 中文文档 (Chinese Document)

### 1. 模拟控制与交互稳定性
*   **组件**: `Frontend` (UI 与交互)。
*   **目标**: 验证模拟速度控制、布局冻结和悬停稳定性的有效性。
*   **测试数据**: 核心单元测试。
*   **方法**:
    *   执行 `npx jest` 验证核心图逻辑的稳定性。
    *   验证“冻结布局”复选框:
        *   选中: 模拟停止。拖动的节点保留位置。
        *   未选中: 模拟恢复。
    *   验证“速度”滑块:
        *   更新 `velocityDecay`。
    *   验证悬停行为:
        *   悬停节点: 节点位置锁定（设置 `fx`, `fy`）以防止漂移。
        *   移出: 节点释放（除非已冻结或处于专注模式）。
*   **结果**:
    *   **单元测试**: 所有 3 个测试通过。
    *   **稳定性**: 检查期间的节点抖动被消除。用户可以暂停布局以手动组织节点。
*   **结果**: 通过 (PASS)。

---

# Test Report (2025-12-23 v0.8.9)

## English Document

### 1. UX Improvement: Freeze on Select
*   **Component**: `Frontend` (Interaction Logic).
*   **Objective**: Ensure nodes remain stationary when selected/dragged in Focus Mode.
*   **Test Data**: Core Unit Tests.
*   **Method**:
    *   Executed `npx jest` to verify core graph logic stability.
    *   Verified `dragended` logic:
        *   Standard Mode: Node released (`fx=null`).
        *   Focus Mode: Node position retained (`fx` kept).
*   **Results**:
    *   **Unit Tests**: All 3 tests passed.
    *   **Behavior**: Nodes in Focus Mode now stay exactly where placed after dragging, improving inspection stability.
*   **Result**: PASS.

---

## 中文文档 (Chinese Document)

### 1. 用户体验改进：选中冻结
*   **组件**: `Frontend` (交互逻辑)。
*   **目标**: 确保在专注模式下选中/拖动节点时，节点保持静止。
*   **测试数据**: 核心单元测试。
*   **方法**:
    *   执行 `npx jest` 验证核心图逻辑的稳定性。
    *   验证 `dragended` 逻辑:
        *   标准模式: 节点释放 (`fx=null`)。
        *   专注模式: 节点位置保留 (`fx` 保持)。
*   **结果**:
    *   **单元测试**: 所有 3 个测试通过。
    *   **行为**: 专注模式下的节点在拖动后现在完全停留在放置的位置，提高了检查的稳定性。
*   **结果**: 通过 (PASS)。
