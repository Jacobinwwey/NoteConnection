# 单窗口 Tauri-Godot 迁移方案

**日期**: 2026-03-22  
**版本**: v1.3.0 → v1.4.0（目标）  
**状态**: 分析与提案

---

## 1. 问题陈述

当前运行 `npm run tauri:dev:mini:gpu` 会**同时打开两个独立窗口**：
1. **Tauri 窗口** — 主知识图谱 UI（HTML/JS/CSS）。
2. **Godot 窗口** — "Future Path" 3D 树形可视化。

用户点击 Tauri 中的 **"Pathmode"** 按钮后，节点数据通过 Tauri → Node.js sidecar → PathBridge WebSocket → Godot 传输。

**目标**: 只显示**一个窗口**。初始时展示 Tauri 界面；点击 "Pathmode" 后，**同一窗口**过渡到显示 Godot 内容。点击 "退出" 则返回 Tauri 视图。

---

## 2. 当前架构分析

### 2.1 启动流程（`lib.rs` → `setup()`）

```
npm run tauri:dev:mini:gpu
  └─ set NOTE_CONNECTION_GPU=1
  └─ npm run build:mini && npm run build:sidecar && npx tauri dev
       └─ Tauri setup()（位于 lib.rs）:
            ├─ 启动 Node.js sidecar（通过 tauri-plugin-shell 的 server 二进制文件）
            └─ 启动 Godot（通过 std::process::Command，参数 --path path_mode/）
```

关键代码位置：
- **Godot 启动**: `lib.rs` 第 1808–1864 行 — 在桌面端启动时无条件地作为独立 OS 进程启动。
- **Sidecar 启动**: `lib.rs` 第 1736–1806 行 — Node.js sidecar 启动并初始化 `PathBridge` WebSocket。
- **PathBridge**: `src/core/PathBridge.ts` — Tauri 前端、Node.js 和 Godot 之间的 WebSocket 中继。

### 2.2 数据流（PathMode 点击）

```
用户点击 "Pathmode" 按钮 (app.js:3316)
  └─ 前端隐藏 #graph-wrapper，显示 #path-container
  └─ window.pathApp.init(selectedNode.id) → path_app.js
       └─ PathApp 通过 path_core.js 计算学习路径
       └─ 通过 PathBridge WebSocket 发送 pathResult
            └─ Godot ws_client.gd 接收 pathResult
            └─ tree_renderer.gd 渲染 3D 树
```

### 2.3 Godot WebSocket 客户端（`ws_client.gd`）

- 在 `_ready()` 时连接到 `ws://127.0.0.1:{BRIDGE_PORT}`。
- 发送 `identify` 消息，标签为 `client: "godot"`。
- 连接后请求 `requestPath` 数据。
- 接收 `pathResult`、`pathUpdate`、`switchCenter`、`completionSync`。

### 2.4 前端 PathMode 处理器（`app.js:3283–3386`）

- Android 端：委托给原生 `open_native_pathmode` Tauri 命令。
- 桌面端：切换 `#graph-wrapper` 和 `#path-container` div 的可见性。
- `path_app.js` 管理浏览器内的路径渲染（Canvas/SVG），通过 WebSocket 与 Godot 通信。

---

## 3. 可行性方案分析

### 方案 A: 将 Godot 嵌入为 WebView 覆盖层（GDExtension / WASM）

| 维度 | 评估 |
|------|------|
| **概念** | 将 Godot 项目编译为 WASM，在 Tauri WebView 内通过 `<iframe>` 或 `<canvas>` 加载。 |
| **可行性** | ⚠️ **中高风险** — Godot 4.x WASM 导出存在但有重大限制：无共享内存多线程、仅支持 WebGL2（无 Vulkan），且项目使用自定义着色器（`frosted_glass.gdshader`、`bubble_material.gdshader`）可能无法顺利移植。 |
| **通信** | 需要用 JavaScript ↔ WASM `callv()` 桥接或 `postMessage` 替换 WebSocket。 |
| **健壮性** | 脆弱：复杂场景的 Godot WASM 构建不稳定。GPU 功能（`NOTE_CONNECTION_GPU=1`）将不可用。 |
| **结论** | ❌ **不推荐** v1.4.0 使用。风险太高且破坏 GPU 加速。 |

### 方案 B: Godot `--render-to-texture` + Tauri 窗口合成

| 维度 | 评估 |
|------|------|
| **概念** | 将 Godot 渲染到离屏缓冲区，以视频/图像流方式传输到 Tauri WebView。 |
| **可行性** | ❌ **极高风险** — Godot 4.x 没有内置的无头渲染到纹理流 API。需要自定义 GDExtension + 共享内存 IPC。 |
| **结论** | ❌ **不可行**，需要大量引擎级开发工作。 |

### 方案 C: 窗口可见性切换（显示/隐藏）✅ 推荐方案

| 维度 | 评估 |
|------|------|
| **概念** | 保持 Godot 作为独立进程，但**启动时隐藏**。用户点击 "Pathmode" 时，**隐藏 Tauri 窗口**并**显示 Godot 窗口**。点击 "退出" 时反转。 |
| **可行性** | ✅ **高** — 使用标准 Windows API（`ShowWindow`/`SetForegroundWindow`）或 Godot CLI 标志（`--minimized`）。 |
| **通信** | 现有 WebSocket PathBridge 不变。 |
| **健壮性** | 非常健壮：不改变渲染、着色器或数据流的架构。 |
| **封装性** | 完全封装 — 仅影响 `lib.rs`（Godot 启动参数）、一个新的 Tauri IPC 命令和少量前端 JS。 |
| **结论** | ✅ **推荐** — 最小风险，最大兼容性，保留所有现有功能。 |

### 方案 D: Tauri 多 WebView + Godot 嵌入窗口（Win32 `SetParent`）

| 维度 | 评估 |
|------|------|
| **概念** | 使用 Win32 `SetParent()` 将 Godot HWND 作为子窗口重新挂载到 Tauri 窗口中。 |
| **可行性** | ⚠️ **中等风险** — 仅适用于 Windows。需要通过 `EnumWindows` + PID 匹配发现 HWND。输入路由和调整大小协调复杂。 |
| **通信** | WebSocket 不变，但需要 `MoveWindow`/`SetWindowPos` 同步调整大小。 |
| **健壮性** | 平台特定（仅 Windows），在 Godot/OS 更新时脆弱。 |
| **结论** | ⚠️ **可作为 v1.5.0 增强**，但对初始实现来说过于平台特定。 |

---

## 4. 推荐方案：方案 C — 窗口可见性切换

### 4.1 架构概览

```
┌────────────────────────────────────────────────┐
│                 Tauri 进程                       │
│                                                 │
│  ┌─────────────┐    ┌───────────────────────┐  │
│  │ Tauri 窗口   │    │   Godot 进程          │  │
│  │ (WebView)   │    │   (启动时隐藏)         │  │
│  │             │    │                       │  │
│  │ [Pathmode]──┼───►│ 显示 Godot 窗口       │  │
│  │             │    │ 隐藏 Tauri 窗口       │  │
│  │             │◄───┼── [退出 PathMode]     │  │
│  │ 显示 Tauri  │    │   隐藏 Godot 窗口     │  │
│  └─────────────┘    └───────────────────────┘  │
│         │                    │                  │
│         └────────┬───────────┘                  │
│                  ▼                              │
│         PathBridge WebSocket                    │
│         (Node.js Sidecar)                       │
└────────────────────────────────────────────────┘
```

### 4.2 具体变更

#### 4.2.1 Rust 端（`src-tauri/src/lib.rs`）

1. **使用 `--minimized` 标志启动 Godot**：
   - 在 Godot `args` 数组中添加 `"--minimized"`，使其启动时隐藏。
   - 存储 Godot 进程的 `Child` 句柄（已实现）。

2. **新增 Tauri IPC 命令 `toggle_pathmode_window`**：
   ```rust
   #[tauri::command]
   fn toggle_pathmode_window(
       app: AppHandle,
       show_godot: bool,
   ) -> Result<(), String> {
       // 如果 show_godot == true:
       //   - 隐藏 Tauri 主窗口
       //   - 显示/聚焦 Godot 窗口（通过存储的 HWND 或进程信号）
       // 如果 show_godot == false:
       //   - 隐藏 Godot 窗口
       //   - 显示/聚焦 Tauri 主窗口
   }
   ```

3. **窗口管理策略**：
   - 使用 Tauri API 的 `window.hide()` / `window.show()` 管理 Tauri 窗口。
   - 对于 Godot：通过 PathBridge 发送 WebSocket 消息 `{"type": "setWindowVisible", "payload": {"visible": true/false}}`，由 Godot 在 `ws_client.gd` 中处理。

#### 4.2.2 Godot 端（`path_mode/scripts/ws_client.gd`）

1. **处理 `setWindowVisible` 消息**：
   ```gdscript
   "setWindowVisible":
       var visible: bool = payload.get("visible", true)
       if visible:
           get_window().mode = Window.MODE_WINDOWED
           get_window().grab_focus()
       else:
           get_window().mode = Window.MODE_MINIMIZED
   ```

2. **"退出 PathMode" 按钮**（已发送 `exitPathMode` 消息）：
   - 现有的 `send_exit_path_mode()` 函数已通知前端。
   - 额外在发送退出消息后自动隐藏 Godot 窗口。

#### 4.2.3 前端（`src/frontend/app.js`）

1. **修改 PathMode 按钮处理器**（约第 3316 行）：
   - 在 `pathApp.init()` 之后，调用 `window.__TAURI__.core.invoke('toggle_pathmode_window', { showGodot: true })`。

2. **处理 `exitPathMode` WebSocket 消息**：
   - 调用 `window.__TAURI__.core.invoke('toggle_pathmode_window', { showGodot: false })` 恢复 Tauri 窗口。

#### 4.2.4 PathBridge 增强（`src/core/PathBridge.ts`）

- 将 `setWindowVisible` 添加到允许转发给 Godot 标签客户端的消息类型中。
- 无需结构性变更 — 现有中继机制可处理此消息。

### 4.3 修改后的启动序列

```
1. Tauri 窗口创建（可见，1280x900）
2. Node.js sidecar 启动 → PathBridge WebSocket 开始
3. Godot 以 --minimized 标志启动 → 隐藏状态，连接到 PathBridge
4. 用户只看到 Tauri 窗口及知识图谱
5. 用户点击 "Pathmode"：
   a. 前端调用 toggle_pathmode_window(showGodot: true)
   b. Tauri 窗口隐藏
   c. PathBridge 向 Godot 发送 setWindowVisible(true)
   d. Godot 窗口出现，接收路径数据
6. 用户在 Godot 中点击 "退出"：
   a. Godot 通过 WebSocket 发送 exitPathMode
   b. Godot 自动最小化
   c. 前端接收 exitPathMode，调用 toggle_pathmode_window(showGodot: false)
   d. Tauri 窗口重新出现
```

---

## 5. 风险评估

| 风险 | 严重程度 | 缓解措施 |
|------|----------|----------|
| Godot `--minimized` 标志未完全隐藏窗口闪烁 | 低 | 在 `_ready()` 中使用 `DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_MINIMIZED)` |
| WebSocket 显示/隐藏切换延迟 | 极低 | 切换对延迟不敏感（200ms 可接受） |
| 用户直接关闭 Godot 窗口（X 按钮） | 中 | 在 Godot 中拦截 `NOTIFICATION_WM_CLOSE_REQUEST` → 最小化而非退出 |
| Godot 窗口最小化时出现在任务栏 | 低 | 在 Windows 上启动时使用 `DisplayServer.window_set_flag(DisplayServer.WINDOW_FLAG_NO_FOCUS, true)` |
| 现有测试中断 | 低 | 仅更改 `lib.rs` 启动参数；所有测试契约不受影响 |

---

## 6. 验证计划

### 6.1 自动化测试

```bash
# 现有测试套件 — 必须零回归全部通过
npm test
npm run test:migration
npm run test:tauri
```

### 6.2 手动验证

1. 运行 `npm run tauri:dev:mini:gpu`
2. 验证启动时**只有一个窗口**（Tauri）可见
3. 验证 Godot **不在任务栏中可见**
4. 加载知识库，点击 "Pathmode"
5. 验证 Tauri 窗口**消失**且 Godot 窗口**出现**
6. 验证路径树在 Godot 中正确渲染
7. 在 Godot 中点击 "退出" 按钮
8. 验证 Godot 窗口**消失**且 Tauri 窗口**重新出现**
9. 验证知识图谱状态已保留
10. 重复步骤 4–9 多次以验证稳定性

---

## 7. 需修改的文件

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src-tauri/src/lib.rs` | 修改 | 向 Godot 启动参数添加 `--minimized`；添加 `toggle_pathmode_window` 命令 |
| `path_mode/scripts/ws_client.gd` | 修改 | 处理 `setWindowVisible` 消息类型 |
| `path_mode/scripts/path_mode_ui.gd` | 修改 | 退出 PathMode 时自动隐藏窗口 |
| `path_mode/project.godot` | 修改 | 设置初始窗口模式为最小化（可选） |
| `src/frontend/app.js` | 修改 | 在 PathMode 进入/退出时调用 `toggle_pathmode_window` |
| `src/core/PathBridge.ts` | 修改 | 允许 `setWindowVisible` 消息转发 |
| `docs/` | 新增 | 本迁移方案文档 |

---

## 8. 向后兼容性

- ✅ 非 Tauri 构建（独立 Web、`npm start`）不受影响 — 继续使用浏览器内 path_app.js 渲染。
- ✅ Android 构建不受影响 — 使用 `open_native_pathmode`，不从 Tauri 启动 Godot。
- ✅ 所有 WebSocket 协议消息保持向后兼容（仅添加新消息类型）。
- ✅ `path_app.js` 中现有的 `exitPathMode` 流程作为后备方案仍然有效。
