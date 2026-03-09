## 中文文档

### 目标
在不削弱现有桌面端/移动端运行时边界的前提下，完成 `v1.5.15` 中全部“高优先级”未闭环事项，并提供完整回归验证证据。

### 本轮完成
- [x] **传输层现代化闭环**：
  - [x] 在 `src/frontend/runtime_bridge.js` 增加 JSON-RPC 兼容桥接信封能力（`toBridgeEnvelope`、`parseBridgeEnvelope`、`sendBridgeMessage`），同时保持旧版 `type/payload` 兼容。
  - [x] 将 `src/frontend/path_app.js` 的桥接收发迁移到统一运行时传输适配路径（`_sendBridgeMessage`、`_parseBridgeIncomingMessage`），不再直接手写原始消息格式解析。
- [x] **存储抽象闭环**：
  - [x] 新增 `src/frontend/storage_provider.js` 作为统一存储提供者，并接入 source/reader 关键流程。
  - [x] 提供 sidecar HTTP、Tauri invoke、Capacitor 原生文件系统读/列目录回退分支（包含 `Filesystem` 插件感知），同时保持现行能力门禁策略不变。
- [x] **macOS/Linux Godot sidecar 制品策略显式化**：
  - [x] 将 `scripts/ensure-godot-sidecar.js` 重构为主机平台感知策略，支持 Windows/Linux/macOS 目标命名（`godot-<target-triple>`）、确定性查找链路与环境变量覆写入口。
  - [x] 更新 `src-tauri/src/lib.rs` 的 Godot 可执行文件解析逻辑，改为平台侧车命名 + 主机别名解析；并同步调整测试确保跨平台行为一致。
- [x] **发布边界显式性持续保持**：
  - [x] Capacitor 原生保持受限的只读/缓存导向运行时能力边界。
  - [x] README 中继续明确 Capacitor 路径尚未达到桌面 sidecar 等价能力。

### 高优先级状态
- [x] 完成传输层现代化（将剩余桌面端原始 HTTP/WS 调用迁移到 Tauri 原生命令或 JSON-RPC 适配层）。
- [x] 实现跨运行时存储抽象（桌面 sidecar / Tauri commands / Capacitor 文件系统）。
- [x] 制定并落地 macOS/Linux 的 Godot sidecar 制品策略（当前 Windows 二进制链路最完整）。
- [x] 持续保持发布边界清晰：在能力对齐完成前，Capacitor 原生仍为只读打包模式。

### 验证门禁（已执行）
- [x] `npx tsc --pretty false`
- [x] `npx jest src/storage.provider.contract.test.ts src/source_manager.loadflow.test.ts src/runtime.capabilities.test.ts src/runtime.transport.adapter.contract.test.ts --runInBand`
- [x] `npm run test:migration`
- [x] `npm run test:tauri`
- [x] `./src-tauri/bin/godot-x86_64-pc-windows-msvc.exe --headless --path ./path_mode --quit`
- [x] `npm run build:sidecar`
- [x] `npm run build:sidecar:all`（已完成制品构建与校验；在非 macOS 主机构建时出现 macOS 签名警告属预期）
- [x] `npm run verify:tauri:bin`
- [x] `npm test`

---
## 中文文档

### 目标
继续推进当前有效的高优先级收口，执行口径保持“先实现、再验证”：
- 降低 Capacitor 运行时在**内容读取**上的对等风险（不虚假宣称构建对等）。
- 将真机验收证据采集流程工程化。
- 对所有受 Git 跟踪的 Markdown 文档执行结构化语言归档，输出到 `docs/en` 与 `docs/zh`。

### 本轮完成
- [x] **Capacitor 内容路径对等加固**：
  - [x] `src/frontend/source_manager.js`：Capacitor 的 `supports_content_api` 由插件可用性动态决策（`supportsCapacitorContentApi`），不再固定为 `false`。
  - [x] `src/frontend/storage_provider.js`：新增 Capacitor 内容路径映射与安全函数：
    - [x] `extractRelativePathFromKbMarker(rawFilePath)`
    - [x] `resolveCapacitorContentCandidatePath(rawFilePath)`
    - [x] 对无法映射且缺少 `Knowledge_Base` 标记的桌面绝对路径进行严格拒绝
  - [x] `RuntimeStorageProvider.readContent()` 在原生 Capacitor 且支持内容 API 时改为走 Capacitor 文件系统读取链路。
- [x] **真机证据采集自动化**：
  - [x] 新增 `scripts/capture-capacitor-device-evidence.js`。
  - [x] 新增 npm 命令 `capture:capacitor:evidence`。
  - [x] 证据包输出规范已落地：
    - [x] 脱敏设备信息
    - [x] 截图（`device-screenshot.png`）
    - [x] logcat 尾部日志（`logcat-tail.txt`）
    - [x] 双语验收报告（`acceptance_evidence.md`）
- [x] **Markdown 语言归档流程**：
  - [x] 新增 `scripts/archive-md-by-language.js`。
  - [x] 已将所有受 Git 跟踪的 Markdown 文档归档至：
    - [x] `docs/en/**`（英文文档集）
    - [x] `docs/zh/**`（中文文档集）
  - [x] 生成归档追踪报告：`docs/language-archive-report.json`。
  - [x] 当前归档结果：扫描 `25` 个受跟踪 Markdown，输出 `24` 份英文文档与 `17` 份中文文档。
- [x] **契约/测试同步**：
  - [x] 更新 `src/capacitor.runtime.contract.test.ts`，适配 Capacitor 内容能力动态决策。
  - [x] 更新 `src/storage.provider.contract.test.ts`，覆盖内容路径映射断言。
  - [x] 新增 `src/storage.provider.capacitor.content.contract.test.ts`。
  - [x] 更新 `src/mobile.pipeline.test.ts`，校验证据采集命令存在。
  - [x] 更新 `package.json` 的迁移测试清单，纳入新的 Capacitor 内容契约测试。

### 当前高优先级状态
- [x] 已交付移动端**内容读取**能力的对等增强路径（基于文件系统、含安全映射）。
- [ ] 尚未实现与桌面 sidecar 等价的移动端**构建 + 内容**完全对等（Capacitor 构建对等仍未收口）。
- [ ] 真机验收清单仍需设备侧人工验证项闭环（受当前无在线设备约束）。

### 验证门禁（已执行）
- [x] `npx jest src/capacitor.runtime.contract.test.ts src/storage.provider.contract.test.ts src/storage.provider.capacitor.content.contract.test.ts src/mobile.pipeline.test.ts src/source_manager.loadflow.test.ts src/runtime.capabilities.test.ts --runInBand`
- [x] `npm run test:migration`（`18` 套件通过）
- [x] `npm run build`
- [x] `npm run test:tauri`
- [x] `./src-tauri/bin/godot-x86_64-pc-windows-msvc.exe --headless --path ./path_mode --quit`
- [x] `node scripts/archive-md-by-language.js`
- [ ] `npm run verify:capacitor:device`（当前环境阻塞：无在线 Android 设备）
- [ ] `npm run capture:capacitor:evidence`（当前环境阻塞：无在线 Android 设备）

---


### 目标
基于 `docs/fixrisk_TODO.md` 执行下一阶段可落地加固，重点收敛移动端文件系统可行性、Android 权限基线与 CI 可重复性，并给出可验证证据。

### 本轮完成
- [x] **Capacitor 文件系统依赖基线**：
  - [x] 在 `package.json` 中补齐 `@capacitor/filesystem` 运行时依赖。
- [x] **原生 Capacitor 存储适配器加固**（`src/frontend/storage_provider.js`）：
  - [x] 新增路径归一化与越权段拦截（拒绝 `.` / `..` 非安全片段）。
  - [x] 新增权限感知文件系统门禁（`checkPermissions` / `requestPermissions`）并提供确定性错误提示。
  - [x] 保持桌面 sidecar 与 Tauri command 回退链路行为不变。
- [x] **Android 清单权限基线**（`android/app/src/main/AndroidManifest.xml`）：
  - [x] 增加旧版外部存储兼容权限（`READ_EXTERNAL_STORAGE`、`WRITE_EXTERNAL_STORAGE`）。
  - [x] 增加 Android 13+ 媒体读取权限（`READ_MEDIA_IMAGES`、`READ_MEDIA_VIDEO`、`READ_MEDIA_AUDIO`）。
- [x] **契约测试覆盖增强**：
  - [x] 更新 `src/mobile.pipeline.test.ts`，强制校验 Capacitor 文件系统依赖与 Android 权限声明。
  - [x] 更新 `src/storage.provider.contract.test.ts`，强制校验存储适配器中的权限/路径加固钩子。
- [x] **CI 迁移测试稳定性**：
  - [x] 保持 `src/server.migration.test.ts` 对 CI 注入的 `NOTE_CONNECTION_AUTH_TOKEN` 环境值隔离，避免出现伪 `401` 连锁失败。

### 当前高优先级状态
- [x] 已完成 fixrisk 中移动文件系统基线缺口（依赖、清单、适配器）加固。
- [x] 已补齐迁移级回归护栏，防止静默回退。
- [ ] 尚未交付移动端与桌面端完全等价的 build/content 能力（当前仍维持“只读打包”策略边界）。
- [ ] 尚需补充真机验收证据（`verify:capacitor:device` + 设备侧执行清单）。

### 验证门禁（已执行）
- [x] `npx tsc --pretty false`
- [x] `npx jest src/storage.provider.contract.test.ts src/mobile.pipeline.test.ts src/source_manager.loadflow.test.ts src/runtime.capabilities.test.ts src/server.migration.test.ts --runInBand`
- [x] `npm run test:migration`
- [x] `npm run build`
- [x] `npm run test:tauri`
- [x] `./src-tauri/bin/godot-x86_64-pc-windows-msvc.exe --headless --path ./path_mode --quit`
- [x] `npm run build:sidecar`


### 目标
在不破坏现有桌面端与移动端运行时契约的前提下，执行 `docs/fixrisk_TODO.md` 中最高风险、可落地的改造项。

### 本轮已完成
- [x] `src/server.ts`：移除 `/api/content` 与生成资产（JS/JSON）响应路径中的同步文件读取。
- [x] `src/server.ts`：将纯内存 JSON 解析改为“有界流式读取 + 临时文件落盘”（`tmp/request-bodies`）以处理大请求体。
- [x] `src/server.ts`：统一请求体错误映射，显式返回：
  - [x] 过大请求体返回 `413`
  - [x] 非法 JSON 返回 `400`
  - [x] 不支持的内容类型返回 `415`
- [x] `src/server.ts`：`/api/build` 与 `/api/kb-path` 迁移到同一套加固后的 JSON 解析流程（移除重复的手动缓冲逻辑）。
- [x] `src/server.ts`：增强默认端口启动鲁棒性。当未显式配置端口且 `3000` 被占用时，服务端自动回退到 loopback 临时端口，避免 `EADDRINUSE` 崩溃。
- [x] `src/server.ts`：完成缓存与目标接口（`/api/check-cache`、`/api/restore-cache`、`/api/available-targets`）的异步化，移除剩余热路径同步文件系统调用。
- [x] 前端传输层收敛：`source_manager.js`、`reader.js` 与 `path_app.js` 统一依赖 `runtime_bridge.js` 作为唯一运行时传输适配器，不再各自维护硬编码 loopback 回退地址。
- [x] 打包链路现代化：
  - [x] 新增 `scripts/build-sidecar.js`，采用 Node 22 目标、Brotli 压缩、`--no-bytecode`。
  - [x] `build:sidecar` 升级为主机平台自适应的 Node 22 构建。
  - [x] 新增 `build:sidecar:all`，输出 Windows/Linux/macOS-arm64 且命名与 Tauri sidecar 规范一致。
  - [x] 更新 sidecar 校验脚本，支持主机模式与全目标模式。
  - [x] 更新 Godot sidecar 准备脚本，在非 Windows 平台跳过 Windows 专属复制逻辑。

### 剩余高优先级工作
- [ ] 完成传输层现代化（将剩余桌面端原始 HTTP/WS 调用迁移到 Tauri 原生命令或 JSON-RPC 适配层）。
- [ ] 实现跨运行时存储抽象（桌面 sidecar / Tauri commands / Capacitor 文件系统）。
- [ ] 制定并落地 macOS/Linux 的 Godot sidecar 制品策略（当前 Windows 二进制链路最完整）。
- [ ] 继续保持发布边界清晰：在能力对齐完成前，Capacitor 原生仍为只读打包模式。

### 本轮验证门禁
- [x] `npx tsc --pretty false`
- [x] `npx jest src/server.migration.test.ts src/source_manager.loadflow.test.ts src/pathbridge.handshake.contract.test.ts src/reader_renderer.test.ts --runInBand`
- [x] `npx jest src/runtime.transport.adapter.contract.test.ts src/source_manager.loadflow.test.ts src/runtime.capabilities.test.ts src/pathbridge.handshake.contract.test.ts --runInBand`
- [x] `npm run test:migration`
- [x] `npm run test:tauri`
- [x] `./src-tauri/bin/godot-x86_64-pc-windows-msvc.exe --headless --path ./path_mode --quit`
- [x] `npm run build:sidecar`
- [x] `npm run build:sidecar:all`（仅制品校验；跨平台实际运行验证依赖对应平台环境）

---

# 2026-03-07 v1.5.14 - 架构、安全与性能加固复核更新

## v1.5.13 之后的后续架构与安全加固

### 目标
根据当前代码基线刷新 v1.5.13 之后的加固待办，使文档准确反映哪些能力已经落地，哪些问题仍然阻碍生产级稳健性、大规模图谱性能以及真实的多平台交付。

### 自原始加固计划以来已完成的事项
- [x] 桌面端 HTTP 与 WebSocket 监听已收敛到仅绑定 `127.0.0.1`。
- [x] Tauri 已能够为 sidecar 与 bridge 动态分配端口，并将运行时元数据注入 Node sidecar、前端与 Godot 进程。
- [x] 受保护的 sidecar 路由与 bridge 标识握手已支持基于令牌的认证。
- [x] 桌面 sidecar 已使用严格的 CORS 白名单替代通配符暴露方式。
- [x] 已新增共享的前端 runtime bridge，在 Tauri 桌面链路中同步 sidecar 基础 URL、bridge URL 与认证头。
- [x] 原生 Capacitor 运行时已明确切换为“只读打包内容模式”，不再假设桌面 sidecar API 可用。
- [x] Node sidecar 在处理剪贴板 PNG 后会显式执行缓冲区清零。
- [x] Godot Reader 已加入 SVG 清洗与尺寸钳制，避免 Math/Mermaid 渲染出现超大位图失败。

### 仍需优先推进的工作

#### 阶段 1：桌面运行时加固收口
- [x] 将 HTTP 与 WebSocket 监听限制为仅绑定 `127.0.0.1`。
- [x] 由 Tauri 运行时动态分配端口与认证令牌。
- [x] 为受保护的 sidecar 路由应用严格的 CORS 白名单与令牌校验。
- [ ] 移除 `src/server.ts` 中 `/api/content` 与生成资源读取路径上的同步文件系统读取。
- [ ] 将大体积剪贴板与渲染负载的 JSON 全量缓冲解析改为流式或临时文件处理。

#### 阶段 2：传输层现代化
- [x] 已为 Tauri 桌面链路引入环境感知的 runtime bridge，用于 URL 与认证信息传递。
- [ ] 将剩余桌面 HTTP/WebSocket 请求路径迁移到 Tauri 原生 IPC 或正式的 JSON-RPC 传输层。
- [ ] 将所有前端传输回退路径统一收口到单一适配层，避免在缺少运行时元数据时仍依赖硬编码 loopback 默认值。

#### 阶段 3：存储与查询扩展性
- [ ] 引入 storage provider 抽象，以支持桌面 sidecar、Tauri command、Capacitor filesystem 以及未来的 SQLite/Wasm 运行时。
- [ ] 将单体 `graph_data.json` 从主运行时存储迁移为基于 SQLite 的局部查询模型。
- [ ] 增加持久化前端缓存层（IndexedDB，经由 `localForage` 或 `Dexie`）以缩短冷启动时间。
- [ ] 评估 MessagePack 或等价二进制传输方案，用于高密度图谱负载传输。

#### 阶段 4：打包与多平台交付
- [ ] 将当前仅支持 Windows 的 `build:sidecar` 目标（`node18-win-x64`）升级为 Node 22 多目标打包。
- [ ] 增加压缩型 sidecar 构建流程（`--compress Brotli`、`--no-bytecode`），并验证打包后的运行时资源完整性。
- [ ] 为 macOS 与 Linux 增加 packaged sidecar 验证，而不仅限于 Windows 桌面。
- [ ] 完成 iOS 文件系统访问相关的 Privacy Manifest 声明工作。
- [ ] 持续明确移动端发布策略：当前 Capacitor 交付形态是“打包只读内容”，并非桌面等价的构建/sidecar 功能对等。

### 验证快照（复核时间：2026-03-07）
- [x] `npx tsc --pretty false`
- [x] `npx jest src/reader_renderer.test.ts src/source_manager.loadflow.test.ts src/pathbridge.handshake.contract.test.ts src/server.migration.test.ts --runInBand`
- [x] `cargo test --manifest-path src-tauri/Cargo.toml`
- [x] Windows PowerShell 下执行 `./src-tauri/bin/godot-x86_64-pc-windows-msvc.exe --headless --path ./path_mode --quit`

### 发布结论
- [ ] 在完成存储抽象与传输层迁移之前，不应宣称“全平台功能完全对等”。
- [ ] 在原生内容读取与图谱加载能力真正补齐之前，应继续将 Capacitor 原生交付视为边界清晰的只读运行时。

---

---

# 未来架构与安全加固计划 (v1.5.13 之后)

### 目标
执行《架构、安全与性能分析报告》中规划的架构、安全与性能提升方案，将项目提升至生产级的高鲁棒性状态，特别是在支撑海量图谱和多端一致性方面。

### 阶段一：建立“零信任”安全沙盒（高优）
- [ ] **强制本地回环绑定**：在 `server.ts` 中，将 HTTP 与 WebSocket 的监听严格限制在 `127.0.0.1`（移除 `0.0.0.0`）。
- [ ] **动态端口与 Token 握手**：
  - [ ] Rust/Tauri 端分配随机端口并生成 `AUTH_TOKEN`。
  - [ ] 将 Port/Token 注入 Node.js Sidecar 和 Frontend WebView。
- [ ] **严格 CORS 与鉴权拦截器**：
  - [ ] 移除 `Access-Control-Allow-Origin: *`，替换为严格白名单 (`tauri://localhost`, `http://localhost`)。
  - [ ] 在所有 API Header 和 WebSocket 握手中校验 Token。

### 阶段二：传输层现代化（中期基建）
- [ ] **IPC 通信重构**：将前端的 `fetch` 调用抽象为感知环境的适配器（Tauri IPC、Capacitor Native、HTTP 回退）。
- [ ] **Stdio JSON-RPC (桌面端)**：废弃 HTTP server，在 Tauri Rust 与 Node Sidecar 之间使用 `stdin/stdout` 进行 JSON-RPC 通信。

### 阶段三：数据存储结构化（核心性能改造）
- [ ] **轻量级 SQLite 后端**：使用本地 SQLite DB (如 `better-sqlite3`) 替代 `graph_data.json` 的生成，以支持图谱局部查询。
- [ ] **前端 IndexedDB 缓存层**：在 `localForage` 或 `Dexie.js` 中缓存图谱结构，实现秒级启动。
- [ ] **二进制协议传输**：将高密度数组的传输格式从 JSON 迁移至 `MessagePack`，消除 V8 引擎解析瓶颈。

### 阶段四：碎片化资产重构（移动端/Web）
- [ ] **构建时碎片化 (Chunking)**：修改 `build_apk.bat`/`npm run build`，将单体图谱切分为 `topology.msgpack`、`metadata.db` 以及独立的 content hash 文件。
- [ ] **Capacitor 原生文件读取**：通过 `@capacitor/filesystem` 实现按需懒加载，而不是将整个 JS payload 一次性塞入 Android WebView。

---

# 2026-03-04 v1.5.13 - Capacitor Physical-Device Acceptance Runbook Closure

### 目标

将 `v1.5.9` 最后未闭环项（Capacitor 真机验收证据）转化为可执行、可复现的验收流程。

### 已交付

- [x] 新增真机验收探测脚本：
  - [x] `scripts/verify-capacitor-device-acceptance.js`
  - [x] 校验项：
    - [x] APK 是否存在（`android/app/build/outputs/apk/debug/app-debug.apk`）
    - [x] `adb` 是否可用
    - [x] 是否至少有一台在线 Android 设备
- [x] 新增 npm 命令：
  - [x] `npm run verify:capacitor:device`
- [x] 重新验证当前 APK 构建链路：
  - [x] `npm run mobile:build:capacitor` -> 2026-03-04 实测通过

### 真机验收清单（发版签核）

- [ ] 设备连接闸门通过：
  - [ ] `npm run verify:capacitor:device`
- [ ] 真机启动行为验证通过。
- [ ] 真机数据源面板行为验证通过。
- [ ] 真机 Reader 行为验证通过。
- [ ] 真机 Path mode 进入/退出行为验证通过。
- [ ] 验收证据已归档：
  - [ ] 设备序列号（可脱敏）
  - [ ] 测试日期/时间
  - [ ] 截图或短视频
  - [ ] 观测结果说明（通过/失败 + 问题单号）

### 当前状态

- [x] 构建与环境侧验收前置条件已具备。
- [ ] 仍需补充真机执行证据，才能关闭 `v1.5.9` 中最后的发版签核项。

---

# 2026-03-04 v1.5.11 - Capacitor Runtime Boundary Closure (Option B Execution)

### 结论快照

- [x] 在 Option B（移动端只读策略）下，Capacitor 运行时边界加固已完成。
- [x] Source/Reader 在原生 Capacitor 中已不再假设桌面 sidecar API 可用。
- [x] 已新增 Capacitor 运行时边界回归契约，并接入迁移闸门。
- [ ] Capacitor 端“目录/构建/内容”与桌面完全对等仍属于当前策略外范围（本版本不做完全对等承诺）。

### 已交付实现

- [x] `src/frontend/source_manager.js`
  - [x] 新增原生 Capacitor 运行时识别（`window.Capacitor.getPlatform` / `isNativePlatform`）。
  - [x] 在 Capacitor 原生运行时显式下发能力画像：
    - [x] `supports_sidecar=false`
    - [x] `supports_build=false`
    - [x] `supports_content_api=false`
    - [x] `supports_kb_runtime_change=false`
  - [x] 新增只读模式下确定性的来源面板降级：
    - [x] 路径文案 -> `source.capacitor.bundlePath`
    - [x] 单一内置选项 -> `PACKAGED_GRAPH`
    - [x] 加载按钮禁用 + 防护提示（`source.error.capacitorReadOnly`）
- [x] `src/frontend/reader.js`
  - [x] 新增 Capacitor 原生检测兜底：当运行时能力对象尚未就绪时，仍强制执行只读内容策略。
- [x] i18n 更新：
  - [x] `src/frontend/locales/en.json`
  - [x] `src/frontend/locales/zh.json`
  - [x] 新增 `source.capacitor.packagedGraph`
  - [x] 新增 `source.capacitor.bundlePath`
  - [x] 新增 `source.error.capacitorReadOnly`
- [x] 新增 Capacitor 运行时边界契约测试：
  - [x] `src/capacitor.runtime.contract.test.ts`
  - [x] 已接入 `package.json` 的 `test:migration`

### 验证证据（2026-03-04 实测）

- [x] `npm run test:migration` -> 通过（`66` 项）
- [x] `npm run test:tauri` -> 通过（`18` 项）
- [x] `npm run mobile:build:capacitor` -> 通过
  - [x] APK 产物：`android/app/build/outputs/apk/debug/app-debug.apk`

### 既有未闭环项状态更新

- [x] `v1.5.9` 中 **Capacitor 运行时行为加固** 项已在代码与测试层闭环。
- [x] `v1.5.9` 中 **Capacitor 运行时边界集成测试覆盖** 已闭环（`src/capacitor.runtime.contract.test.ts`）。
- [ ] `v1.5.9` 中 **Capacitor APK 手工验收清单（真机）** 仍待补充实机执行证据。
- [ ] **仍维持 NO-GO**：当前不宣告“全平台能力完全对等”。

---

# 2026-03-03 v1.5.10 - Option A P0 Closure (Tauri Android Native Folder/Build/Content Flow)

### 结论快照

- [x] 方案 A 的 P0 已在 Tauri Android 运行时落地。
- [x] Android 端现已支持无 Node sidecar 的本地构图能力。
- [x] 桌面端与 Web 端行为保持不变。
- [ ] Capacitor 运行时能力对等仍是独立范围（构建后端尚未原生等价）。

### 已交付实现

- [x] 在 Rust 中新增原生运行时构建命令：
  - [x] `src-tauri/src/lib.rs` 中 `build_graph_runtime(request)`
  - [x] 从 `Knowledge_Base/<target>`（或 `ALL_FOLDERS`）扫描构图
  - [x] 将运行时产物写入 `runtime_data/`：
    - [x] `data.js`
    - [x] `graph_data.json`
    - [x] `data_<target>.js`
    - [x] `graph_data_<target>.json`
- [x] 更新 Android 运行时能力：
  - [x] `supports_sidecar=false`
  - [x] `supports_build=true`
  - [x] `supports_content_api=true`
- [x] 在 `src/frontend/source_manager.js` 完成构建链路分流：
  - [x] 有 sidecar 时仍优先走 `/api/build`
  - [x] 无 sidecar 的 Tauri 路径改为 `invoke('build_graph_runtime', { request })`

### 验证证据（2026-03-03 实测）

- [x] `npm run test:migration` -> 通过（`55` 项）
- [x] `npm run test:tauri` -> 通过（`16` 项）
- [x] `npm run verify:android:env` -> 通过（SDK + cmdline-tools + NDK 已识别）

### P0 状态更新

- [x] `方案 A：实现移动端目录/构建/内容能力原生等价链路`（Tauri Android 路径）已完成。
- [ ] Capacitor 独立运行时的构建/内容完全对等仍待后续收口。

---

> Superseded Note (2026-03-03 v1.5.10): The section below is historical context. Current Option A P0 status is recorded above.
> 覆盖说明（2026-03-03 v1.5.10）：下方内容为历史上下文，当前 Option A P0 状态以上方为准。

# 2026-03-03 v1.5.9 - Electron Removal Final Gate (Audit-Driven Action Plan)

### 结论快照

- [x] 桌面端 Electron -> Tauri 迁移已达到可下线技术状态。
- [x] Tauri 桌面构建与运行主链路已启用并通过测试验证。
- [x] Capacitor 与 Tauri Android 构建链路均已存在。
- [ ] 全平台运行时能力对等尚未完全收口。

### 范围澄清（基于审计）

- 桌面端：
  - [x] Electron IPC 等价能力已迁移到 sidecar HTTP + Tauri 命令。
  - [x] 活跃包管理与运行路径中已无 Electron 脚本/依赖。
- 移动端：
  - [x] Capacitor 运行时按产品策略为只读能力，在目录/构建/内容 API 上不等价于桌面 sidecar 运行时。
  - [x] Tauri Android 运行时为无 sidecar 但可构建/读内容（`supports_sidecar=false`, `supports_build=true`），Capacitor 仍为 `supports_build=false`。

### P0 - 宣告“迁移完全完成”前必须收口

- [x] **移动端能力边界产品化决策（必须二选一并固化）**
  - [x] 方案 A：实现移动端目录/构建/内容能力的原生等价链路（Tauri Android 原生运行时路径）。
  - [x] 方案 B：正式将 Capacitor 定义为缓存/阅读优先能力，并在 UI/文档中消除“对等”歧义。

- [x] **Capacitor 运行时行为加固**
  - [x] 显式识别 Capacitor 运行时，避免沿用桌面 sidecar 假设。
  - [x] 当 `/api/folders`、`/api/build`、`/api/content` 不可用时提供确定性的降级交互。
  - [x] 明确 Capacitor Reader 内容策略（只读内置图谱 + 不可用能力的显式提示）。

- [x] **移动端验收闸门**
  - [x] 增加 Capacitor 运行时边界行为的集成测试覆盖。
  - [x] 增加 Capacitor APK 手工验收清单：
    - [x] 启动行为
    - [x] 数据源面板行为
    - [x] Reader 行为
    - [x] Pathmode 进入/退出行为
  - [ ] 仍需补充真机执行证据以完成最终发版签核。
    - [x] 已提供前置探测命令：`npm run verify:capacitor:device`
    - [ ] 最新探测结果仍为无在线 Android 设备（2026-03-04）。

### P1 - 迁移治理与下线清理

- [x] **归档/移除残余 Electron 痕迹**
  - [x] 删除空目录 `src/electron` 或增加明确归档标记。
  - [x] 清理代码中仍含 “electron” 的误导性命名/注释（运行时已为 bridge 架构）。

- [x] **文档对齐**
  - [x] 对 `docs/tauri_tasks.md` 中已过期迁移待办添加历史标记。
  - [x] 保持有效文档为 Tauri-first，并清晰区分 desktop/Android/Capacitor 能力边界。

### P2 - 稳定性与发布护栏

- [x] 将以下发布闸门保持为必跑：
  - [x] `npm run test:migration`
  - [x] `npm run test:tauri`
- [x] 将 Android 环境闸门保持为必跑：
  - [x] `npm run verify:android:env`
- [x] 增加 CI 矩阵避免静默回归：
  - [x] 桌面迁移测试集
  - [x] Tauri Rust 测试集
  - [x] 移动端流水线契约测试集

### 当前 Go/No-Go 政策

- [x] **GO**：桌面端 Electron 下线。
- [x] **NO-GO 策略生效**：在 Capacitor 仍为只读策略期间，不宣告“全平台运行时能力完全对等”。

---

# 2026-03-03 v1.5.8 - PathBridge Handshake + Tauri Early-Socket Stability

### 本轮新增

- [x] 在 `path_mode/scripts/ws_client.gd` 移除 Godot 不兼容的 WebSocket 查询参数 URL：
  - [x] `ws://127.0.0.1:9876/?client=godot` -> `ws://127.0.0.1:9876`
  - [x] 连接后新增显式 `identify` 握手消息。
  - [x] 增加连接前消息队列与重连后冲刷，避免初始化配置消息丢失/警告。

- [x] 在 `src/core/PathBridge.ts` 增加显式客户端身份协议：
  - [x] 新增 `identify` 消息处理分支。
  - [x] 新增 `setClientTag` 与标签清洗逻辑。
  - [x] 保留 URL 查询参数识别作为浏览器旧路径兼容兜底。

- [x] 在 `src/frontend/path_app.js` 强化 Bridge 行为：
  - [x] 移除 query-tag URL，统一使用 `ws://localhost:9876`。
  - [x] 为 `frontend` 与 `frontend-early` 两类连接发送 `identify` 负载。
  - [x] 新增 Tauri 运行时双重判定（`window.__TAURI__` 或 `navigator.userAgent.includes('Tauri')`），避免在 Tauri 中误启动 `frontend-early` 连接。

- [x] 新增回归契约覆盖：
  - [x] 新增测试文件 `src/pathbridge.handshake.contract.test.ts`。
  - [x] 已纳入 `test:migration`。

### 验证结果

- [x] `npm run test:migration` -> 通过（`53` 项）。
- [x] `npm run test:tauri` -> 通过（`14` 项）。

### 范围安全性

- [x] 桌面端功能不变，仅提升 Bridge 握手与标签稳定性。
- [x] 浏览器模式保留 early bridge 支持。
- [x] Android Pathmode 流程不受影响。

---

# 2026-03-03 v1.5.7 - Android Native Pathmode Smoke Lifecycle Automation

### 本轮新增

- [x] 新增 Android 运行时烟雾生命周期脚本：
  - [x] `scripts/smoke-android-pathmode.js`
  - [x] 使用 `adb` + `dumpsys activity` 检查 `MainActivity -> PathmodeGodotActivity -> MainActivity`。
  - [x] 通过发送返回键（`KEYCODE_BACK`）验证 Activity 返回路径。
  - [x] 支持可选严格模式：
    - [x] `NOTE_CONNECTION_ANDROID_SMOKE_REQUIRE_DEVICE=1` 时，无设备将判定失败
    - [x] 默认模式下，无设备/模拟器时会安全跳过。

- [x] 新增 npm 命令入口：
  - [x] 在 `package.json` 中新增 `smoke:android:pathmode`。

- [x] 新增烟雾集成回归契约：
  - [x] `src/android.pathmode.smoke.contract.test.ts`。
  - [x] 更新 `src/mobile.pipeline.test.ts` 断言烟雾脚本注册。
  - [x] 更新 `test:migration` 用例列表，纳入该契约测试。

### 验证结果

- [x] `npm run test:migration` -> 通过（`50` 项）。
- [x] `npm run test:tauri` -> 通过（`14` 项）。
- [x] `npm run smoke:android:pathmode` -> 通过（无连接设备时按设计跳过）。

### 范围安全性

- [x] 不影响桌面端行为。
- [x] 不影响 Web 端行为。
- [x] Android 烟雾流程仅在显式执行命令时触发。

---

# 2026-03-03 v1.5.6 - Option A Android Native Pathmode (Godot Full-Screen) Execution

### 本轮已实现

- [x] **Android 方案 A 启动链路已落地**
  - [x] 在 `src-tauri/src/lib.rs` 新增 Android 原生 Pathmode 启动命令：`open_native_pathmode`。
  - [x] 新增运行时能力标记：`supports_native_pathmode`（Android=true，桌面/web=false）。
  - [x] 更新前端 Path Mode 入口（`src/frontend/app.js`）：
    - [x] Android 且能力开启时优先走原生启动
    - [x] 桌面/web 维持原有网页 Path Mode 容器流程不变

- [x] **Android 全屏 Godot Activity 桥接已落地**
  - [x] 新增可追踪 Android 模板文件：
    - [x] `src-tauri/mobile/android/PathmodeBridge.kt`
    - [x] `src-tauri/mobile/android/PathmodeGodotActivity.kt`
  - [x] 新增生成工程补丁流水线：
    - [x] `scripts/apply-tauri-android-pathmode.js`
    - [x] `scripts/run-tauri-android.js` 在 Android 命令前后自动补丁
  - [x] 增加 `path_mode` 资源同步到 `src-tauri/gen/android/app/src/main/assets/path_mode`

- [x] **Exit 返回行为已实现**
  - [x] Godot 内点击 `Exit` 会退出 Android Pathmode Activity 并返回主 Tauri 窗口（`path_mode/scripts/path_renderer.gd`）。

- [x] **Android 构建链路已加固**
  - [x] 在 Android runner 增加 Cargo 内存控制（`CARGO_BUILD_JOBS`、release 优化/代码生成参数）。
  - [x] 补丁脚本已处理：
    - [x] Godot Maven 依赖与 Manifest 合并规则
    - [x] 与 Godot Android 产物匹配所需的 Kotlin 插件版本对齐

### 验证结果

- [x] `npm run test:migration` -> 通过（`48` 项）。
- [x] `npm run test:tauri` -> 通过（`14` 项）。
- [x] `node scripts/run-tauri-android.js build` -> 通过。
  - [x] APK：`src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk`
  - [x] AAB：`src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab`

### 影响范围安全性

- [x] 桌面端行为不变。
- [x] Web 端行为不变。
- [x] Android 逻辑通过运行时能力门控与构建脚本门控隔离。

---

# 2026-03-03 v1.5.5 - Status Normalization Update (Proceeding)

### 本轮复验结果

- [x] 已重新执行迁移闸门测试：
  - [x] `npm run test:migration` -> 通过（`44` 项）。
  - [x] `npm run test:tauri` -> 通过（`14` 项）。
- [x] 已确认 `v1.5.3` 与 `v1.5.4` 收口项持续有效（P0 工程收口 + P1 运行时边界 UI）。
- [x] 已确认 sidecar 内容边界校验与加载/历史契约测试持续通过。

### 待办治理

- [x] 已将 `v1.5.2` 清单标记为历史/已被后续版本覆盖，避免执行口径歧义。
- [x] 保留历史清单正文用于追溯（不做破坏性删除）。

### 当前仍可执行的剩余范围

- [ ] 移动端最终对等策略仍为产品层待决项：
  - [ ] 方案 A：实现与桌面 sidecar 等价的 Android 原生构建/内容链路。
  - [x] 方案 B（当前执行策略）：维持 Android 能力门控的缓存/阅读运行时，并显式说明边界。

---

# 2026-03-03 v1.5.3 - Execution Progress Update (P0 Completed)

### 本轮执行已完成

- [x] **将 sidecar 内容 API 安全边界提升至 Rust 同等级**
  - [x] 在 `src/server.ts` 为 `/api/content` 增加 KB 根路径边界校验。
  - [x] 新增回归测试覆盖：
    - [x] 根目录内绝对路径可读取
    - [x] 旧式 `Knowledge_Base` 标记路径可读取
    - [x] 根目录外路径被拦截（`403`）

- [x] **锁定缓存提示/单次加载语义（契约覆盖）**
  - [x] 新增 source manager 加载流程契约测试：
    - [x] 重复事件绑定防护
    - [x] 加载进行中点击防重入
    - [x] 单一缓存提示分支契约
  - [x] 现有服务端 restore/build 去重测试持续通过。

- [x] **完成 Godot History 一致性契约**
  - [x] 在 `path_mode_ui.gd` 新增 `record_navigation_node(node_id)`。
  - [x] 在 `path_renderer.gd` 的 `render_path` 中接入中心切换历史记录。
  - [x] 新增历史记录钩子契约测试。

- [x] **最终 Go/No-Go 技术闸门（工程部分）**
  - [x] `npm run test:migration` -> 通过（`43` 项）。
  - [x] `npm run test:tauri` -> 通过（`14` 项）。

### 剩余产品决策（不阻塞桌面稳定性）

- [ ] 确认移动端最终对等能力范围：
  - [ ] 方案 A：实现 Android 原生等价构建运行时。
  - [x] 方案 B（当前执行策略）：移动端聚焦缓存/阅读能力，并显式声明能力边界。

---

# 2026-03-03 v1.5.2 - Electron Removal Final Gate (Post-Audit Action Plan)

> 覆盖说明（2026-03-03 v1.5.5）：本节作为历史计划上下文保留。P0/P1 收口证据已记录在上方 `v1.5.3` 与 `v1.5.4`。以下未勾选项默认不再作为当前执行阻塞，除非后续明确重开。

**审计结论快照**

- [x] 桌面端 Electron -> Tauri 迁移在功能层面已成功。
- [x] Capacitor 导出链路仍可用且可构建。
- [x] Tauri Android 导出链路可构建。
- [ ] 桌面与移动端的完整运行时对等尚未收口。

### P0 - 在宣告“迁移完全收口”前必须完成

- [ ] **将 sidecar 内容 API 的安全边界提升到 Rust 同等级**
  - [ ] 在 `src/server.ts` 为 `/api/content` 增加 KB 根路径边界校验，对齐 `read_node_content`。
  - [ ] 新增回归测试覆盖：合法路径、越界路径、Windows/相对路径变体。

- [ ] **在 Tauri 启动竞态下锁定缓存提示与单次加载语义**
  - [ ] 增加集成层测试覆盖：
    - [ ] “存在缓存 -> 只出现一次提示”
    - [ ] “单次点击 -> 只执行一次 restore/build”
  - [ ] 与 sidecar 去重和前端 reload guard 的联动行为一并验证。

- [ ] **完成 Godot History 一致性契约**
  - [ ] 确保中心切换事件（双击/手动切换）都能写入 History 时间线。
  - [ ] 增加中心切换后的 History 自动化断言测试。

### P1 - 移动端/导出能力边界澄清与加固

- [ ] **在文档与 UI 中明确 Android 运行时能力边界**
  - [ ] 明确当前 Android 运行时为 `supports_sidecar=false`、`supports_build=false`。
  - [ ] 提供 cache-only 模式下的用户可操作说明。

- [ ] **完成移动端构建能力策略决策并落地**
  - [ ] 方案 A：实现 Android 原生构建/内容链路，对齐桌面 sidecar 流程。
  - [ ] 方案 B：保持缓存/只读能力，并明确为产品约束。

### P2 - 文档治理（保留历史，不删除）

- [ ] 将历史 Electron 段落标记为归档上下文，降低执行层误读。
- [ ] 保持当前有效发布/运维文档为 Tauri-first 与双移动端路径一致。

### 最终 Go/No-Go 闸门（全范围）

- [ ] 新增对等测试后 `npm run test:migration` 通过。
- [ ] 新增安全与行为测试后 `npm run test:tauri` 通过。
- [ ] 手工验收通过：
  - [ ] 缓存提示仅出现一次
  - [ ] 加载动作仅执行一次
  - [ ] History 正确记录中心切换
- [ ] sidecar 内容路径边界安全验证通过。

---

# 2026-03-02 v1.5.1 - Android Runtime Parity Expansion (Targets + Content + Cache-Only UX)

**目标**：将原本依赖桌面 sidecar 的目标/内容能力，扩展为 Tauri Android 可用的运行时安全契约，同时保持桌面行为不回退。

### 本轮已完成

- [x] **目标发现能力对齐已落地**
  - [x] 新增 sidecar API `GET /api/available-targets`（目录 + 缓存目标合并）。
  - [x] 新增 Tauri 命令 `get_available_targets`（语义一致）。
  - [x] 前端源加载优先使用 available-target 接口，并保留安全回退。

- [x] **移动端可用内容读取路径已落地**
  - [x] 新增 Tauri 命令 `read_node_content(file_path)`。
  - [x] 内容读取增加 KB 根路径边界校验（禁止越界访问）。
  - [x] 增加旧桌面路径 `.../Knowledge_Base/...` 的重定位兼容。
  - [x] 阅读器在 sidecar 不可用时回退到 Rust 命令读取。

- [x] **`supports_build=false` 运行时的仅缓存 UX 加固**
  - [x] 移动端源列表仅显示可用缓存目标。
  - [x] `ALL_FOLDERS` 仅在存在活动缓存时显示。
  - [x] 无缓存候选时自动禁用加载按钮。

- [x] **回归覆盖与构建证据更新**
  - [x] 新增/更新迁移测试覆盖 available-target 与 runtime-content 契约。
  - [x] `npm run test:migration` 通过（`35` 项）。
  - [x] `npm run test:tauri` 通过（`14` 项）。
  - [x] `npm run tauri:android:build` 通过。
  - [x] `npm run tauri:android:build:universal` 通过。

### 当前范围剩余工作

- [ ] **Android 端应用内图谱构建链路对等**
  - [ ] 提供桌面 `/api/build` 的 Android 原生等价实现。
  - [ ] 定义基于 SAF/File API 的知识库导入与持久授权策略。

- [ ] **Path Mode/Godot 的 Android 路线收口**
  - [ ] 明确保持仅桌面可用并补齐 UX 提示，或
  - [ ] 设计并实现 Android 可用渲染/运行时替代路径。

---

# 2026-03-02 v1.5.0 - Tauri Android Build Unblock (Arm64 Deterministic Path)

**目标**：将 Tauri Android 从环境/配置阻塞状态推进到可复现的构建路径，同时保持 Capacitor 与 Tauri Android 双路径并存。

### 本轮已完成

- [x] **Android SDK 工具链检测与强校验**
  - [x] 已确认 Android SDK Command-line Tools（`cmdline-tools/latest`）可被检测。
  - [x] 已确认 NDK（`ndk;27.2.12479018`）可被前置脚本检测。
  - [x] 当前机器 `npm run verify:android:env` 已通过。

- [x] **将桌面专属 Rust 依赖与 Android 目标隔离**
  - [x] `src-tauri/Cargo.toml` 中将 `rfd` 改为仅桌面目标依赖。
  - [x] 在 `src-tauri/src/lib.rs` 增加 Android 安全的目录选择回退逻辑。

- [x] **Android 专属 Tauri 运行时配置**
  - [x] 新增 `src-tauri/tauri.android.conf.json`，在 Android 构建中清空 `bundle.externalBin`。
  - [x] 使用 `cfg(not(target_os = "android"))` 隔离桌面专属菜单 API 与桌面进程启动逻辑。
  - [x] Android 启动流程已明确跳过桌面 Node sidecar 与 Godot 启动。

- [x] **Tauri Android 包装脚本加固**
  - [x] 为 `dev/build` 默认采用 `aarch64` 目标，规避 Windows 主机上 armv7 LLVM OOM。
  - [x] 支持通过 `NOTE_CONNECTION_TAURI_ANDROID_TARGET` 覆盖目标。
  - [x] 通过 `cmd.exe /d /s /c` 修复 Windows `spawnSync npx.cmd EINVAL`。
  - [x] 在 `scripts/run-tauri-android.js` 增加 spawn error/signal 明确日志。

- [x] **回归覆盖同步更新**
  - [x] 更新 `src/mobile.pipeline.test.ts`，新增 arm64 默认与覆盖能力断言。
  - [x] 已验证 `npm run test:migration` 通过（`30` 项测试）。

- [x] **构建验证**
  - [x] 已验证 `node scripts/run-tauri-android.js build` 通过。
  - [x] 已验证 `npm run tauri:android:build` 通过。
  - [x] 已产出：
    - `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk`
    - `src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab`

### 迁移剩余项（P1.5 后续）

- [ ] **Android 端桌面专属能力对等**
  - [ ] 将依赖 Node sidecar 的 API（`/api/build`、`/api/content`、目录扫描/构建链路）替换为 Android 可运行方案。
  - [ ] 定义 Android 原生文件访问策略（SAF/File API）以完成知识库选择与加载。

- [ ] **Path Mode/Godot 的 Android 路线决策**
  - [ ] 维持 Godot Bridge 仅桌面可用（当前行为），或提供 Android 兼容渲染路径。
  - [ ] 在文档中明确 Android 端能力边界与 UX 预期。

- [x] **可选多 ABI 策略**
  - [x] 保持 `aarch64` 作为默认稳定目标。
  - [x] 仅在主机内存/工具链满足时提供可选 universal ABI 构建路径。

---

# 2026-03-01 v1.4.9 - Runtime Verification Update (Desktop + Mobile)

**目标**：在 `v1.4.8` 基础上继续实跑验证，并将 Tauri Android 的不确定性收敛为可执行的前置条件检查。

### 本轮已完成

- [x] **桌面打包再次实测通过**
  - [x] 在设置 `NOTE_CONNECTION_GODOT_EXE` 后执行 `npm run tauri:build:mini`。
  - [x] sidecar 二进制校验通过（`server` + `godot` 非空）。
  - [x] MSI + NSIS 安装包成功生成。

- [x] **Capacitor Android 流水线端到端执行**
  - [x] 修复 `build_apk.bat` 中 `if (...)` 代码块内未转义括号导致的解析报错。
  - [x] 增加非交互支持（`NOTE_CONNECTION_NO_PAUSE` / `CI=true`）。
  - [x] 已完成 `build_apk.bat` 全流程并产出 debug APK。

- [x] **Tauri Android 前置检查加固**
  - [x] 新增 `scripts/verify-tauri-android-prereqs.js`。
  - [x] 新增 `npm run verify:android:env`。
  - [x] 已接入以下命令前置：
  - [x] `tauri:android:init`
  - [x] `tauri:android:dev`
  - [x] `tauri:android:build`
  - [x] 效果：当缺失 `cmdline-tools/latest/bin/sdkmanager` 时，返回明确错误而非模糊 Tauri 报错。

- [x] **回归测试覆盖同步更新**
  - [x] 扩展 `src/mobile.pipeline.test.ts`，校验：
  - [x] Android 前置检查脚本是否接入 npm 命令。
  - [x] `build_apk.bat` 自动化标志是否保留。
  - [x] `npm run test:migration` 继续保持通过。

- [x] **双路径聚合命令已验证**
  - [x] 已执行 `npm run mobile:build:both`。
  - [x] Capacitor 分支可完成并产出 APK。
  - [x] Tauri Android 分支在前置检查处被明确拦截（在安装 cmdline-tools 前符合预期）。

### 剩余外部前置条件（环境项）

- [x] **安装 Tauri Android 所需的 Android SDK Command-line Tools**
  - [x] 必需路径：`<ANDROID_SDK_ROOT>/cmdline-tools/latest/bin/sdkmanager(.bat)`。
  - [x] 已通过以下命令验证：
  - [x] `npm run verify:android:env`
  - [x] `npm run tauri:android:build`

---

# 2026-03-01 v1.4.8 - Migration Closure & Dual Android Verification

**目标**：以可执行验证证据收口迁移清单，重点完成 `P1.5`（Capacitor + Tauri Android 双路径产出）的稳定性证明。

### 已完成清单

- [x] **新增双 Android 路径防回归测试**
  - [x] 新增 `src/mobile.pipeline.test.ts`，约束以下关键项：
  - [x] `package.json` 中 Capacitor 与 Tauri Android 脚本必须同时存在。
  - [x] `capacitor.config.ts` 的 `webDir` 必须与 `dist/src/frontend` 对齐。
  - [x] `build_apk.bat` 必须保留同步与 APK 构建关键步骤。
  - [x] `src-tauri/tauri.conf.json` 必须保留 `bin/server` 与 `bin/godot` sidecar 配置。

- [x] **迁移回归测试集扩展**
  - [x] 已更新 `package.json` 中 `test:migration`，纳入 `src/mobile.pipeline.test.ts`。
  - [x] 当前迁移测试覆盖运行时路径、缓存/构建去重、双移动端流水线契约校验。

- [x] **本轮执行证据更新**
  - [x] `npm run build:mini` -> 通过。
  - [x] `npm run test:migration` -> 通过（`29` 项测试）。
  - [x] `npm run test:tauri` -> 通过（`9` 项 Rust 测试）。
  - [x] `npm run smoke:sidecar:relaunch` -> 通过。

### 结论

- [x] `P1.5` 不仅完成文档化，而且已纳入自动化回归保护。
- [x] 在当前仓库范围内（桌面 Tauri-first + 双移动端构建入口），Electron -> Tauri 迁移清单可视为已收口。

---

# 2026-03-01 v1.4.6 - Electron Removal Readiness Action Plan

**目标**：补齐 Electron -> Tauri 的剩余迁移缺口，使移除 Electron 后不会在桌面发布与移动导出链路产生功能回退。

### 阶段 P0 - 移除 Electron 前必须完成

- [x] **实现 Tauri 持久化配置对等能力（等价 `kb_config`）**
  - [x] 在 Tauri 应用数据目录持久化 KB 路径。
  - [x] 在 Tauri 应用数据目录持久化语言设置。
  - [x] 启动时在前端初始化前读取并应用。
  - [x] 验收：重启后无需手动重选 KB 与语言，菜单语言保持一致。

- [x] **加固 Godot 非开发机启动能力**
  - [x] 删除 `src-tauri/src/lib.rs` 中硬编码绝对路径。
  - [x] 采用可打包的 sidecar/bundle 路径解析方案。
  - [x] 校验构建产物中的 Godot 可执行文件存在且非空。
  - [x] 验收：`npm run tauri build` 已输出打包产物并接入二进制校验流水线。

- [x] **补齐子进程生命周期治理**
  - [x] 保留 Node sidecar 与 Godot 子进程句柄。
  - [x] 在应用退出钩子中显式回收子进程。
  - [x] 增加重启验证，确保不会遗留 `3000` 端口占用。
  - [x] 验收：关闭应用后不存在孤儿 sidecar/Godot 进程。

- [x] **修复发布态可写路径策略**
  - [x] 不再假设安装版可写 `dist/src/frontend`。
  - [x] 为生成文件（`data.js`、`graph_data.json`）指定可写运行目录（AppData/Cache）。
  - [x] 同步更新 sidecar 环境变量（`NOTE_CONNECTION_FRONTEND_DIR` + `NOTE_CONNECTION_RUNTIME_DATA_DIR`）与缓存恢复逻辑。
  - [x] 验收：安装版路径模型下构建与缓存恢复链路可用。

- [x] **补齐与 Electron 首次启动体验对等**
  - [x] 无配置时新增 Tauri 首次运行 KB 选择流程。
  - [x] 保留并持久化菜单“更改 KB / 重置”行为。
  - [x] 验收：新安装首次引导后永久记住用户选择。

### 阶段 P1 - 稳定化与验证

- [x] **将后端构建日志统一桥接到前端 Loading 面板**
  - [x] 通过 Rust/sidecar 桥发出结构化 `build-log` 事件。
  - [x] 确保长时间构建在 Tauri 下可见进度日志。
  - [x] 验收：`/api/build` 期间 Loading 面板持续收到增量日志。

- [x] **执行发布态冒烟测试并固化证据**
  - [x] Windows 打包验证（`tauri build` 已生成 msi/nsis 产物）。
  - [x] 缓存分流弹窗验证（`Load Existing` / `Regenerate`）。
  - [x] 单次点击去重验证（无重复 restore/build）。
  - [x] 验收：可复现实验结果已写入 `TEST_REPORT.md`。

- [x] **明确 GPU 启动命令规范**
  - [x] 文档统一使用 `npm run tauri:dev:mini:gpu`。
  - [x] 不再示例 `npm run tauri:dev:mini --gpu`（避免 npm 警告）。
  - [x] 验收：README/手册中仅保留受支持命令格式。

### 阶段 P1.5 - 双移动端交付（Capacitor + Tauri Android）

- [x] **同时保留两条官方 Android 生成路径**
  - [x] 路径 A：保留 Capacitor（Web 资产运行时，功能范围受限）。
  - [x] 路径 B：按 `docs/tauri_brainstorming.md` 提供 Tauri Android 流水线。
  - [x] 验收：两条路径均已文档化并提供构建脚本。

- [x] **Capacitor 路径边界明确化**
  - [x] 明确未嵌入后端前，设备端目录构建/加载 sidecar API 不可用。
  - [x] 明确移动端 source loading/reader 的降级预期。
  - [x] 验收：APK 行为约束已写入文档。

- [x] **Tauri Android 流水线补齐（脚本层）**
  - [x] 增加 Tauri Android 构建脚本与初始化命令。
  - [x] 保留并文档化 Node sidecar 在移动端的兼容性替换事项。
  - [x] 验收：Android 端 Tauri 构建命令已就绪。

### 阶段 P2 - Electron 清退

- [x] **仅在 P0/P1 门槛全部通过后执行清退**
  - [x] 删除 `package.json` 中 Electron 脚本。
  - [x] 删除 `main: dist/src/electron/main.js`。
  - [x] 删除 Electron 依赖（`electron`、`electron-builder`、`electron-squirrel-startup`）。
  - [x] 归档/删除 `src/electron/*` 与 `electron-builder.yml`。
  - [x] 验收：桌面构建链路已切换为 Tauri-first。

- [x] **文档清理**
  - [x] README 构建/发布章节从 Electron-first 改为 Tauri-first。
  - [x] 历史变更保留并标注 Electron 路线停用日期。
  - [x] 验收：当前发布文档不再要求使用 Electron 命令。

### Electron 移除闸门（Go/No-Go）

- [x] Tauri 下 KB 与语言持久化对等已验证。
- [x] Godot 启动不再依赖本机硬编码路径。
- [x] 应用退出后无孤儿子进程。
- [x] Tauri 安装版下构建/缓存/Reader 链路可用。
- [x] 双移动端路线（Capacitor + Tauri Android）已文档化。
- [x] 脚本与 README 全面对齐 Tauri。

---

# 2026-03-01 v1.4.5 - Physically-Based Bubbles & Cancel Completion

**目标**: 使用逼真的物理皂泡升级 Godot 渲染器，移除环境遮挡，并添加灵活的任务完成 UI 逻辑。

### 已完成清单

- [x] **基于物理的着色器**
  - [x] 将 81 波长薄膜干涉 Glassner 逻辑移植到 `bubble_material.gdshader`。
  - [x] 添加了 `warpnoise3` 和 `sp_spectral_filter` 以实现逼真的球面厚度变化。
- [x] **物理交互**
  - [x] 将中心气泡和周围气泡从 `MeshInstance3D` 转换为 `RigidBody3D`。
  - [x] 添加了 `_physics_process` 轨道磁力吸引，让气泡可以逼真地漂浮和碰撞而不会永久重叠。
  - [x] 移除了 `main.tscn` 环境中的 `Floor`（地板）节点障碍物。
- [x] **取消完成 UI**
  - [x] “标记完成”按钮现在动态切换为“取消完成”。
  - [x] 在 `path_mode_ui.gd` 和 `path_renderer.gd` 中连接动态状态以适当地标记/取消标记节点。

---

# 2026-03-01 v1.4.4 - Tauri Bridge Stabilization & Duplicate-Cycle Elimination

**目标**: 完成 Bridge-first 的 Tauri 迁移稳态化，重点解决缓存/加载重复执行、WebSocket 空闲重连抖动与运行时路径一致性问题。

### 已完成清单

- [x] **缓存分流恢复**
  - [x] 当目标缓存存在时，恢复“直接加载缓存 / 重新生成”的显式用户决策流程。
- [x] **重复执行保护**
  - [x] 前端增加加载单飞保护，避免重复点击触发双执行。
  - [x] 后端为 `/api/build` 与 `/api/restore-cache` 增加去重保护。
- [x] **PathBridge 诊断增强**
  - [x] 增加带标签连接日志（client id/tag/address + close code/reason），可区分正常重连与真实循环。
- [x] **Godot WS 兼容性修复**
  - [x] 将 Godot URL 修正为 `ws://127.0.0.1:9876/?client=godot`，消除 URL 非法导致的重连报错。
- [x] **Tauri 空闲重连清理**
  - [x] 在 Tauri 模式禁用 `frontend-early` 自动 WebSocket 启动。
- [x] **语言/菜单幂等保护**
  - [x] 在前端与 Rust 命令侧加入“同语言无操作”保护，避免重复同步造成噪声。

### 更新文件

- `src/frontend/source_manager.js`
- `src/server.ts`
- `src/core/PathBridge.ts`
- `src/frontend/path_app.js`
- `path_mode/scripts/ws_client.gd`
- `src/frontend/i18n.js`
- `src-tauri/src/lib.rs`

---

# 2026-02-26 v1.4.3 - 9 规则树布局引擎 (9-Rule Tree Layout Engine)

**目标**: 将 `tree_path_mockup.html` 中的 9 规则展开/认领/可见性引擎迁移到生产代码，用完整的 owner/claim 体系替换简化轮廓布局。

## 9 规则对照 (Rule Mapping)

| #   | Rule (EN)                                 | 规则 (ZH)                  | Status |
| --- | ----------------------------------------- | -------------------------- | ------ |
| 1   | Expansion Order (FIFO claiming)           | 展开顺序（FIFO 认领）      | [x]    |
| 2   | Preceding Immunity (effective index)      | 前置免疫（有效索引）       | [x]    |
| 3   | Following Migration (spine+followers)     | 后续迁移（脊柱+后续）      | [x]    |
| 4   | Single Appearance (owner-based)           | 单次出现（基于所有者）     | [x]    |
| 5   | Cross-Tributary Isolation (edge filter)   | 跨支流隔离（边过滤）       | [x]    |
| 6   | Spine Always Visible (return on collapse) | 脊柱始终可见（折叠时返回） | [x]    |
| 7   | Sticky Claim (configurable toggle)        | 粘性认领（可配置开关）     | [x]    |
| 8   | Unit Migration (recursive claim)          | 单元迁移（递归认领）       | [x]    |
| 9   | Tributary Hierarchy Immunity              | 支流层级免疫               | [x]    |

## 已落地实现

- [x] 核心算法：`path_core.js` 完成 `expansionOrder`、`currentOwner/ownerPriority`、`tryClaim()` 与 `determineVisibility()`。
- [x] 前端桥接：`path_app.js` 将 `forcedExpansionNodes` 从 Set 改为有序数组，并接入 `stickyClaimEnabled`。
- [x] 渲染器对齐：Godot `tree_renderer.gd` 完成 owner 边过滤、hull 分组碰撞、节点类型着色与展开徽章。
- [x] Worker 参数透传：`path_worker.js` 传递 `expansionOrder` + `stickyClaimEnabled`。

---

# 2026-02-01 v1.4.1 - Path Mode v2: 轨道学习架构

**目标**: 将 Path Mode 升级为沉浸式、游戏化学习体验，引入 3D 气泡可视化与学习进度追踪。

## 架构总览

### 混合渲染策略

1. **Godot Desktop**（9876 端口）: Vulkan/OpenGL + 3D 彩虹薄膜气泡。
2. **Web Fallback**: Android/浏览器使用 Canvas/WebGL。
3. **SVG Fallback**: 小图（<= 500 节点）使用 SVG。

### 学习模式

- **Domain Learning**: 对概念簇进行拓扑排序，学习完整主题域。
- **Diffusion Learning**: 从目标节点反向最短路径追溯前置依赖。

## 本阶段实施清单状态

- [x] 中心/外围双层气泡与点击交互主流程已打通。
- [x] 中心/外围双击行为已对齐 Reader 与轨道切换。
- [ ] 轨道旋转动画、主题化树视图与完整 3D shader 细节仍为后续迭代项。
- [ ] Path Tree 的完整可视化面板与样式系统仍在规划任务中。

---

# 2026-01-23 v1.2.0 - Path Mode 与桌面渲染器

**目标**: 将图谱转化为可学习课程路径，并建立高保真桌面渲染链路。

- [x] **Path Mode 学习路径**
  - [x] 策略：落地 Foundational（基础优先）与 Core（中心性优先）排序。
  - [x] 模式：Domain Learning（主题域）与 Diffusion Learning（反向扩散）双模式。
  - [x] 可视化：径向/树形布局与 Learn/Next/Locked 进度态。
- [x] **混合架构**
  - [x] 建立 Godot WebSocket 桥接（9876）。
  - [x] 桌面使用低延迟原生渲染；Web/Canvas 保留回退能力。

---

# 2026-01-23 v1.1.2 - 路径解析与 UI 稳定性

**目标**: 修复 Windows 静态资源解析问题，并消除 Welcome Modal 引发的 UI 失效。

- [x] 后端：`server.ts` 静态文件映射忽略 query string，`data.js?v=...` 可正确命中。
- [x] 前端：修复 `welcome.js` 跳过引导后菜单 `z-index` 还原，避免菜单不可点击。

---

# 2026-01-22 v1.1.1 - 移动端构建自动化

**目标**: 自动化 Android APK 构建流程，降低移动端发布门槛。

- [x] 新增 `build_apk.bat` 一键构建脚本（Windows）。
- [x] 自动检查 Node.js / Java JDK / Android SDK 环境。
- [x] 用户手册与 README 同步更新移动端构建步骤。

---

# 2026-01-22 v1.1.0 - CI/CD 自动化与稳定性收口

**目标**: 强化协议处理、i18n 一致性与引导 UI 稳定性。

- [x] 多语言收口：移除 `app.js` 冗余翻译逻辑，统一 `I18nManager`。
- [x] 引导流程修复：公开 `enterFocusMode/exitFocusMode` 供教程调用，修复欢迎弹窗触发时机。
- [x] 协议与缓存：`source_manager.js` 引入时间戳动态加载，避免 `data.js` 缓存污染。
- [x] 协议处理优化：`main.ts` 中 `app://` 处理改为 `net.fetch`，提高可靠性。
- [x] 同步补强移动构建：`build_apk.bat` 与文档说明完成对齐。

---

# 2026-01-14 v1.0.0 - 生产环境正式发布 (Production Release)

**目标**: 显著提升系统稳定性、离线可靠性及专注模式视觉体验。

- [x] **稳定性与构建 (v1.0.0)**:
  - **精简版修复**: 解决首屏崩溃、Worker 路径及数据清理问题。
  - **离线支持**: 100% 本地化渲染库 (D3, KaTeX, Mermaid)。
- [x] **专注模式优化 (v1.0.0)**:
  - **视觉恢复**: 修复退出后的尺寸还原 Bug。
  - **O(1) 邻居查找**: 实现客户端邻接缓存，消除切换延迟。
  - **批量 UI 更新**: 使用 `requestAnimationFrame` 同步渲染。
- [x] **物理引擎打磨**:
  - **更高间距**: 默认链接距离增加至 250px，支持更广范围自定义。
- [x] **随机专注**: 在搜索栏旁添加骰子图标，支持即时随机聚焦。
- [x] **GPU 诊断增强**: 增加详细的 GPU 上下文报告（供应商/渲染器）。
- [x] **安全与 CSP**: 更新 CSP 以实现严密的离线环境安全。


# 2026-01-13 v0.9.83 - GPU 工作线程集成 (GPU Worker Integration)

**目标**: 在模拟工作线程中全面启用 GPU 加速，解决设置不一致和 Worker 环境兼容性问题。

- [x] **GPU 工作线程集成**:
  - [x] **工作线程加速**: 在 `simulationWorker.js` 中全面启用了 GPU 力 (`gpuManyBody`, `gpuLink`)。
  - [x] **环境修复**: 重构了 `layout_gpu.js`，通过 `globalScope` 兼容 Web Worker 的 `self` 上下文。
  - [x] **持久性修复**: 优化了 Worker 中的 `updateParams` 逻辑，使用 `.strength()` 更新现有的力，而不是替换它们，防止意外回退到 CPU 物理。
  - [x] **设置同步**: 验证了 `gpuRendering` 标志在初始化期间已正确传递给 Worker。
- [x] **Worker 握手协议**:
  - [x] **显示锁定**: 实现了 `isLayoutSwitching` 状态机，以在转换期间阻止过时的 `tick` 消息。
  - [x] **双向同步**: 引入了 `layoutSwitchDone` 循环，确保 UI 和 Worker 坐标完美对应。
- [x] **专注模式拖动隔离**:
  - [x] **手动驱动**: 专注模式节点不再向 Worker 发送拖动消息，坐标直接在主线程计算。
  - [x] **显示刷新**: 修复了由于延迟消息覆盖手动设置坐标导致的竞态条件。

# 项目构建计划：渐进式层级知识图谱

本文档概述了构建 `NoteConnection` 的路线图，该系统能够将数万个知识点可视化为有向无环图 (DAG)，重点突出层级关系和学习路径。

---

# 2026-01-12 v0.9.74 - 布局切换与 GPU 稳健性

**目标**: 完成稳定的布局切换状态保存，并解决 GPU 资源管理问题（WebGL 上下文泄漏）。

- [x] **布局切换修复**
  - [x] **状态保存**: 实现了 `layoutCache`，独立存储和恢复 'Force' 和 'DAG' 布局的节点位置 (`x, y, fx, fy`)。
  - [x] **崩溃解决**: 通过重构 `applyPhysics` 的使用，修复了 `updateLayout` 中在初始化前访问 `simulation.force` 导致的关键崩溃。
  - [x] **逻辑**: 布局切换现在可以平滑过渡，没有视觉上的“瞬移”闪烁或模拟重置。

- [x] **GPU 稳健性**
  - [x] **单例模式**: 重构 `layout_gpu.js`，为 `GPUManyBodyForce` 使用单例实例，防止在切换设置时发生 WebGL 上下文溢出（限制 16 个上下文）。
  - [x] **构造安全**: 增强了对 `GPU.GPU` 的检测，以处理不同的库打包方式 (Webpack/Rollup)。

# 2026-01-12 v0.9.73 - GPU 渲染修复 (链式调用 Bug)

**目标**: 修复由于 `layout_gpu.js` 中的链式调用 Bug 导致的 GPU 力“静默失败”，该 Bug 导致 v0.9.72 尽管 UI 设置已开启但未能实际激活 GPU 物理引擎。

- [x] **Bug 修复**
  - [x] **链式调用**: 修复了 `layout_gpu.js` 中的 `strength()` 方法，使其返回 `impl` 函数包装器而不是 `this`。
  - [x] **验证**: 确认 `d3.force` 现在可以正确接收可调用的函数。

# 2026-01-12 v0.9.72 - GPU 优化渲染 (极客版)

**目标**: 满足“极客”需求，利用 AMDGPU (RX 7900XT) 实现更流畅的前端渲染和并行后端处理。

- [x] **前端 GPU 渲染**
  - [x] **GPU 力引擎**: 使用 `gpu.js` 在 `layout_gpu.js` 中实现了 `GPUManyBodyForce`。
  - [x] **集成**: 添加了 `libs/gpu-browser.min.js` 并集成到 `app.js`。
  - [x] **UI 控制**: 验证了设置中的“GPU 优化渲染”复选框。默认值：启用。
  - [x] **逻辑**: 实现 CPU (`d3.forceManyBody`) 和 GPU (`gpuManyBody`) 物理引擎之间的动态切换。

- [x] **后端优化确认**
  - [x] **并行化**: 确认 `GraphBuilder` 使用带有 Worker 线程的 `LayoutEngine`。
  - [x] **GPU 后端**: 确认如果启用了 GPU，`LayoutEngine` 会使用 `amdgpu/LayoutGPU.ts`。

# 2026-01-10 v0.9.71 - 后端布局与静态模式

**目标**: 通过将布局计算卸载到后端 Worker 线程并实施静态渲染模式，优化大规模图谱 (50k+ 节点) 的性能。

- [x] **后端并行布局**
  - [x] **布局引擎**: 创建了 `LayoutEngine.ts` 和 `layoutWorker.ts` 以在后端线程运行 `d3-force` 模拟。
  - [x] **集成**: `GraphBuilder` 现在自动为超过 100 个节点的图谱触发后端布局计算。
  - [x] **GPU 加速**: 使用 `gpu.js` 实现了 `LayoutGPU.ts` 以在 AMDGPU 上加速布局。
  - [x] **性能**: 通过提供预计算的坐标减少前端初始化时间。

- [x] **前端优化**
  - [x] **静态模式**: 引入了“静态模式”切换。
    - [x] **自动启用**: 节点数 >5000 或 边数 >200,000 时自动启用。
    - [x] **行为**: 模拟运行 2 秒 (预热) 后停止以节省 CPU。
    - [x] **布局切换**: 布局转换 (Force <-> DAG) 期间尊重静态模式。
  - [x] **GPU 设置**: 在设置中添加了“GPU 优化渲染”复选框以控制加速标志。
  - [x] **极端规模**: 对于 >10,000 个节点的图谱，严格禁用边渲染以防止渲染瓶颈。

- [x] **CLI 与文件管理**
  - [x] **CLI 参数**: 为 `npm start` 添加了 `--path` 和 `--gpu` 支持。
  - [x] **文件隔离**: CLI 运行生成唯一的 `data_cli_*.js` 文件以保护原始 `data.js`。
  - [x] **服务器逻辑**: `server.ts` 根据构建参数自动提供正确的 CLI 数据文件。

# 2026-01-09 v0.9.70 - 前端初始化修复 (竞态条件)

**目标**: 解决由于大规模数据集初始化序列中的竞态条件导致的“不显示节点”和“按钮无响应”问题。

- [x] **Bug 修复**
  - [x] **竞态条件**: 确定 `renderCanvas` 在 `controls` 对象定义之前被 `ResizeObserver` 或 `setTimeout` 调用，导致脚本执行中断的致命错误。
  - [x] **重构**: 将 `controls` 的定义移至 `app.js` 顶部。
  - [x] **稳健性**: 在 `isNodeVisible` 和 `renderCanvas` 中添加了安全检查，以防止初始化期间崩溃。
  - [x] **结果**: UI 按钮 (冻结、设置) 现在应正确初始化，画布应立即渲染。

# 2026-01-09 v0.9.69 - 前端崩溃修复 (10k+ 节点)

**目标**: 修复由于前端处理 120 万条边时的栈溢出导致的“节点：0”关键 Bug。

- [x] **Bug 修复**
  - [x] **栈溢出**: 确定了 `app.js` 中由于 `links.push(...validLinks)` 带有 120 万个参数导致的 `RangeError: Maximum call stack size exceeded`。
  - [x] **重构**: 将 `links` 声明从 `const` 更改为 `let`，并用直接赋值 (`links = validLinks`) 替换了展开操作。
  - [x] **结果**: 应用程序现在成功加载并渲染超过 10,000 个节点和 100 万条边的图谱，而不会崩溃。

# 2026-01-09 v0.9.68 - 按需内容架构 (10k+ 修复)

**目标**: 彻底解决由于巨大的 `data.js` 文件大小 (~500MB) 导致浏览器崩溃而造成的 10k+ 节点“节点：0”显示问题。

- [x] **架构重构**
  - [x] **数据拆分**: 将图结构 (`data.js`) 与内容 (`graph_data.json`) 分离开来。
  - [x] **优化**: `data.js` 现在不包含节点内容，文件大小减少了 ~95% (例如，13k 节点的 500MB 降至 35MB)。
  - [x] **后端**: 更新了 `src/index.ts` 以生成“轻量版” `data.js`。

- [x] **按需内容**
  - [x] **API 端点**: 在 `server.ts` 中添加了 `GET /api/content` 以安全地提供原始节点内容。
  - [x] **前端**: 更新了 `reader.js` 中的 `Reader`，使其在打开节点时异步获取内容。
  - [x] **UX**: 在阅读器窗口添加了加载状态指示器。


### 2026-01-08 v0.9.67 - 紧凑模式与 Canvas 修复 (Compact Mode & Canvas Fix)

**目标**: 解决 10k+ 节点的显示问题，并实现默认隐藏边的性能模式。

- [x] **紧凑模式**:
  - [x] **自动启用**: 对于 >5000 节点或 >100,000 边自动激活。
  - [x] **边剔除**: 渲染循环在紧凑模式下完全跳过边迭代，除非高亮处于活动状态。
  - [x] **设置 UI**: 向性能设置添加了 "紧凑模式 (隐藏边)" 复选框。
- [x] **Canvas 修复**:
  - [x] **初始渲染**: 初始化后强制显式调用 `resizeCanvas()` 和 `ticked()` 以防止白屏。

### 2026-01-08 v0.9.63 - 10k 节点优化与内存策略 (10k Node Optimization & Memory Strategy)

**目标**: 解决 10k+ 节点/1.2M 边时的 "卡死" 渲染问题，并实现后端处理的可配置内存策略。

- [x] **前端优化**:
  - [x] **物理剔除**: 为 D3 力导向模拟实施边限制 (20k)。如果总边数超过此值，仅子集驱动物理以防止主线程冻结，同时所有边仍可用于渲染/遍历。
  - [x] **链接解析**: 将链接源/目标预解析为对象，以支持稳健的渲染，即使物理使用子集。
  - [x] **UI 解锁**: 通过释放主线程修复了 "快速开始指南" 不出现的问题。
- [x] **后端内存策略**:
  - [x] **配置**: 向 `AppConfig` 添加了 `memorySavingMode` 和 `deepDebug`。
  - [x] **Worker 优化**: 重构 `keywordMatchWorker` 和 `statisticalWorker` 以支持 `filePaths` (低内存) 和 `filesChunk` (高性能/精度) 模式。
  - [x] **图指标**: 添加检查以在激活 `memorySavingMode` 时强制单核执行 `Betweenness Centrality`。
  - [x] **循环检测**: 根据内存模式调整限制 (100 vs 10000)。
- [x] **系统监控**:
  - [x] **峰值内存**: 更新 `PerformanceLogger` 以跟踪并记录峰值堆/RSS 内存使用情况。
  - [x] **深度调试**: 基于 `deepDebug` 标志实现了条件详细日志记录。

### 2026-01-07 v0.9.62 - 文档更新 (AMDGPU 指南) (Documentation Update - AMDGPU Guide)

**目标**: 为 AMDGPU 用户提供详细的硬件和软件指南，特别是针对 `gpu.js` 加速和未来的 AI 集成。

- [x] **文档**:
  - [x] **README.md**: 添加 "硬件与驱动要求" 部分，详述 RDNA 架构、驱动选择 (Adrenalin vs Mesa/ROCm) 和 `headless-gl` 的构建依赖。

### 2026-01-07 v0.9.61 - 前端内存优化 (自动 Canvas) (Frontend Memory Optimization - Auto-Canvas)

**目标**: 通过在节点数超过阈值时自动默认使用 "Canvas" 模式，减少前端内存消耗并提高大图的渲染性能。

- [x] **智能默认值**:
  - [x] **阈值检查**: 在 `app.js` 中，检查 `nodes.length > 3000`。
  - [x] **自动切换**: 如果超过阈值，初始化期间以编程方式选择 "Canvas" 渲染器并更新 DOM 可见性（隐藏 SVG，显示 Canvas）。
  - [x] **用户覆盖**: 如果需要，用户仍可以手动切换回 SVG。

### 2026-01-07 v0.9.60 - 并行图指标计算 (Parallel Graph Metrics)

**目标**: 通过并行化 "图指标" 计算（介数中心性），优化图构建性能，该计算以前是单线程的。

- [x] **并行化**:
  - [x] **Worker 实现**: 创建 `betweennessWorker.ts` 以使用 Brandes 算法计算节点子集的部分中心性分数。
  - [x] **异步逻辑**: 更新 `GraphMetrics` 为 `calculateBetweennessAsync`，使用 Worker 池（默认：`numCPUs - 1`）。
  - [x] **集成**: 将异步指标计算集成到 `GraphBuilder` 管道中。
  - [x] **验证**: 使用 `test_metrics_parallel.ts` 在 500+ 节点上验证功能。

### 2026-01-07 v0.9.59 - 向量空间内存修复 (稀疏矩阵) (Vector Space Memory Fix - Sparse Matrix)

**目标**: 通过用稀疏向量实现替换密集的 TF-IDF 矩阵，解决处理 13k+ 文件时 Windows 10/11 (128GB RAM) 上的 "堆内存溢出" 崩溃。

- [x] **内存优化**:
  - [x] **稀疏向量**: 重构 `VectorSpace` 使用 `Uint32Array` (索引) 和 `Float32Array` (值) 代替标准 Javascript 数组。
  - [x] **效率**: 将 13k 文件的内存占用从约 10GB+ (密集) 减少到 <500MB (稀疏)。
  - [x] **算法**: 优化余弦相似度计算使用稀疏点积 ($O(min(N, M))$)。
  - [x] **配置**: 在 `package.json` 中将默认 Node.js 堆限制增加到 12GB (`--max-old-space-size=12288`) 以利用可用的系统 RAM。

### 2026-01-07 v0.9.58 - 混合推断资源重用 (优化) (Hybrid Inference Resource Reuse)

**目标**: 通过防止重复计算统计矩阵和向量空间，修复混合推断期间的 "堆内存溢出" 崩溃。

- [x] **资源优化**:
  - [x] **共享状态**: 在 `GraphBuilder` 中实现了 `sharedStatsMatrix` 和 `sharedVectorSpace`。
  - [x] **逻辑**: 如果启用了 `HybridInference`，则预先计算这些重资源，并在统计和向量步骤中重用它们。
  - [x] **清理**: 推断完成后显式清除共享资源。
  - [x] **结果**: 消除了运行混合推断时的 2 倍内存峰值，防止了 13k+ 文件上的 OOM。

### 2026-01-07 v0.9.57 - Worker 内存优化 (Worker Memory Optimization)

**目标**: 通过优化主线程和 Worker 之间的数据传输，解决处理大数据集（13k+ 文件）时 Windows 10/11 上的 "堆内存溢出" 错误。

- [x] **Worker 数据传输**:
  - [x] **优化**: 重构 `keywordMatchWorker` 和 `statisticalWorker` 以接受 `filePaths: string[]` 而不是 `filesChunk: RawFile[]`（包含完整内容）。
  - [x] **实现**: Worker 现在使用 `fs` 按需从磁盘读取文件内容，避免了序列化期间克隆内容字符串的巨大内存开销。
  - [x] **结果**: 显著减少了并行处理步骤期间的堆使用量。

### 2026-01-05 v0.9.56 - 混合推断内存分析 (Hybrid Inference Memory Analysis)

**目标**: 分析并优化 "混合推断" 引擎的内存使用，以解决 Windows 10 上的 "堆内存溢出" 错误，防止图构建期间的大对象保留。

- [x] **细粒度日志**:
  - [x] **实现**: 在 `HybridEngine.infer` 和 `GraphBuilder`（统计矩阵、向量空间、推断引擎）中添加了详细的 `PerformanceLogger` 步骤。
  - [x] **进度跟踪**: 在推断期间每处理 1000 个节点记录一次内存使用情况，以查明峰值。
  - [x] **优化**: 在推断后立即显式清除大型 `matrix` 并置空 `vectorSpace`，以在后续步骤之前释放堆内存。

### 2026-01-05 v0.9.55 - 堆内存溢出修复与迭代 DFS (Heap OOM Fix & Iterative DFS)

**目标**: 通过优化图构建期间的内存使用并将递归重构为迭代，解决 Windows 10/11 上的 "堆内存溢出" 崩溃。

- [x] **内存优化**:
  - [x] **作用域管理**: 在进入 `GraphBuilder` 中内存密集的 `Algorithmic Core` 阶段之前，显式清除 `fileMap`（保存文件内容）。
  - [x] **细粒度日志**: 将 `Algorithmic Core` 日志拆分为 `Cycle Detection` 和 `Topological Sort` 以进行精确的错误跟踪。
- [x] **算法稳健性**:
  - [x] **迭代 DFS**: 重构 `CycleDetector.detectCycles` 使用基于栈的迭代方法代替递归，以防止深度图上的堆栈溢出。
  - [x] **验证**: 使用现有单元测试验证逻辑。

### 2026-01-05 v0.9.54 - 欢迎体验 (Welcome & Empty State Experience)

**目标**: 通过在图表为空时提供清晰的指导，改善新用户引导体验。

- [x] **空状态处理**:
  - [x] **检测**: `welcome.js` 中的逻辑检测 `graphData` 是否为空或缺失。
  - [x] **欢迎模态框**: 实现了 "Welcome to NoteConnection" 模态框，引导用户：
    1. 选择源文件夹。
    2. 点击加载。
  - [x] **视觉提示**: 模态框激活时高亮显示源控制区域。

### 2026-01-05 v0.9.53 - 核心 API 解耦 (Core API Decoupling)

**目标**: 通过将核心逻辑与 CLI 环境解耦，为插件集成 (Joplin/Obsidian) 准备代码库。

- [x] **核心重构**:
  - [x] **NoteConnection 类**: 创建 `src/core/NoteConnection.ts` 作为主外观模式。
  - [x] **解耦**: 将 `buildGraph` 逻辑移出 `src/index.ts` 以允许库式使用。
  - [x] **CLI 更新**: 重构 `src/index.ts` 以使用新的核心 API。

### 2026-01-05 v0.9.52 - 循环检测内存优化 (Cycle Detection Memory Optimization)

**目标**: 解决处理具有许多循环的大图（100k+ 边）时 Windows 10/11 上的 "堆内存溢出" 崩溃。

- [x] **循环检测优化**:
  - [x] **限制逻辑**: 更新 `CycleDetector` 以接受 `limit` 参数。
  - [x] **终止**: 在找到指定数量的循环 (100) 后立即停止递归/搜索，而不是收集所有循环。
  - [x] **验证**: 添加了单元测试以确限制被遵守。

### 2026-01-03 v0.9.51 - 性能日志与崩溃报告 (Performance Logging & Crash Reporting)

**目标**: 通过实施详细的性能指标和自动崩溃报告来增强系统可观测性，以促进调试。

- [x] **性能日志记录器**:
  - [x] **工具**: 创建 `PerformanceLogger` 类来跟踪时间、CPU (用户/系统) 和内存 (堆/RSS)。
  - [x] **集成**: 用日志记录包裹所有 `GraphBuilder` 阶段（节点初始化、边匹配、推断）。
  - [x] **GPU 跟踪**: 将日志记录集成到 `VectorSpaceGPU` 以监控内核执行时间。
- [x] **崩溃报告**:
  - [x] **工具**: 创建 `CrashLogger` 将未处理的错误写入 `crash.log`。
  - [x] **集成**: 在 `server.ts` 中附加全局处理程序 (`uncaughtException`, `unhandledRejection`)。
  - [x] **Worker**: 向 `keywordMatchWorker` 和 `statisticalWorker` 添加了 try-catch 块和日志记录器集成。

### 2026-01-02 v0.9.50 - GPU 加速可行性 (GPU Acceleration Feasibility)

**目标**: 验证并实现用于数学运算（矩阵乘法）的 GPU 加速，以便在支持的硬件上（在 AMD 7900XT 上验证）进一步加快图构建。

- [x] **可行性验证**:
  - [x] **库**: 安装 `gpu.js` 以通过 WebGL/OpenCL 将 Node.js 与 GPU 连接。
  - [x] **硬件检查**: 验证了 AMD Radeon 7900XT (Windows 10) 上的内核编译和执行成功。
  - [x] **基准测试**: 矩阵乘法 (512x512) 在 GPU 模式下成功完成。
- [x] **实施计划**:
  - [x] **向量空间**: 将 $N \times N$ 余弦相似度矩阵计算卸载到 GPU (`amdgpu/VectorSpaceGPU.ts`)。
  - [x] **约束**: 将字符串处理（关键词匹配）保留在 CPU (Worker) 上，因为文本传输到 GPU 的开销超过了收益。

### 2026-01-02 v0.9.49 - 统计分析内存优化 (Statistical Analysis Memory Optimization)

**目标**: 通过优化共现矩阵计算，修复处理大数据集（10k+ 文件）时的 "堆内存溢出" 错误。

- [x] **算法优化**:
  - [x] **稀疏矩阵计算**: 重构 `calculateMatrixOptimized` 使用以文件为中心的迭代方法 ($O(Files \times TermsPerFile^2)$)，而不是密集的术语对迭代 ($O(TotalTerms^2)$)。
  - [x] **复杂度降低**: 将复杂度从约 1.7 亿次迭代（针对 13k 节点）降低到约 500 万次迭代。
  - [x] **数据结构效率**: 移除了 Worker 结果聚合期间不必要的中间对象转换 (`Set` <-> `Array`)。
  - [x] **Worker 结果合并**: 优化 `runParallelTermExtraction` 以迭代方式合并块，而不是使用 `reduce`，以防止内存峰值。

### 2026-01-02 v0.9.48 - 并行处理优化 (Parallel Processing Optimization)

**目标**: 通过允许可配置的 Worker 线程限制，利用更多 CPU 核心处理大数据集，优化图构建性能。

- [x] **Worker 配置**:
  - [x] **可配置限制**: 向 `AppConfig` 添加了 `maxWorkers` 以覆盖默认 Worker 限制。
  - [x] **移除上限**: 移除了 `GraphBuilder` 和 `StatisticalAnalyzer` 中硬编码的 12 个 Worker 限制。如果未指定，默认为 `numCPUs - 1`。
  - [x] **验证**: 在测试数据集上使用 50 个 Worker 进行了验证。

### 2026-01-02 v0.9.47 - 专注模式交互与布局修复 (Focus Mode Interaction & Layout Fixes)

**目标**: 通过防止意外缩放和修复垂直布局中的标签重叠，提高专注模式的可用性。

- [x] **交互逻辑**
  - [x] **双击缩放预防**: 在节点双击处理程序中添加了 `stopPropagation`，以防止 `d3.zoom` 在进入专注模式时触发放大事件。
- [x] **专注模式布局**
  - [x] **垂直间距**: 在 "垂直" (L-R) 布局中，将节点标签的水平偏移 (`dx`) 增加到 **35px**（原默认约 12px），以防止文本与节点重叠。
  - [x] **焦点节点**: 对垂直布局中的中央焦点节点应用相同的水平偏移，以保持一致性。

### 2025-12-26 v0.9.46 - 专注模式 UI 清理与 Canvas 边修复 (Focus Mode UI Cleanup & Canvas Edge Fix)

**目标**: 清理专注模式期间的 UI 以减少混乱，并修复 Canvas 模式下的视觉渲染。

- [x] **UI 隐藏**
  - [x] **主控件**: 进入专注模式时，"选择知识库"、"加载" 和主 "NoteConnection" 下拉菜单现在完全隐藏 (`display: none`)。
  - [x] **恢复**: 退出专注模式时，元素恢复到默认状态 (`display: ''`)，尊重 CSS 规则（例如移动端可见性）。
- [x] **Canvas 可视化**
  - [x] **边隐藏**: 在 Canvas 专注模式下，*所有*边现在都被隐藏以提供更干净的外观，符合“不显示任何边”的要求。

### 2025-12-26 v0.9.45 - Canvas 交互与清理 (Canvas Interactivity & cleanup)

**目标**: 在 Canvas 模式下启用完全交互性（悬停、点击、专注）并移除已弃用的 "视图模式"（聚类）功能。

- [x] **Canvas 交互**
  - [x] **命中测试**: 实现了 `findNodeAt(x, y)` 以检测 Canvas 模式下鼠标光标下的节点，考虑了缩放/平移变换。
  - [x] **事件监听器**: 向 canvas 元素添加了 `mousemove` (高亮) 和 `click` (检查/专注) 处理程序。
  - [x] **一致性**: Canvas 交互现在匹配 SVG 行为（单击 -> 统计，双击 -> 专注）。
- [x] **视觉修复**
  - [x] **节点大小**: 更新 `renderCanvas` 以尊重 "大小依据" 设置（度数/中心性/统一），修复了节点渲染过大的问题。
- [x] **清理**
  - [x] **移除视图模式**: 从代码库中移除了 "视图模式"（节点/聚类）控件和相关逻辑，因为它已被弃用。

### 2025-12-26 v0.9.44 - 独立专注模式间距 (Independent Focus Mode Spacing)

**目标**: 允许用户为专注模式下的 "水平" 和 "垂直" 布局独立配置 "层间距" 和 "节点间距"，防止一种布局的设置影响另一种。

- [x] **间距逻辑**
  - [x] **状态管理**: 创建 `focusSpacingSettings` 为 `horizontal` 和 `vertical` 模式存储单独的 `layer` 和 `node` 值。
  - [x] **默认值**:
    - **水平**: 层间距默认为 **125** (原为 250)。
    - **垂直**: 节点间距默认为 **20** (原为 80)。
  - [x] **UI 同步**: 切换专注布局下拉菜单现在会自动更新滑块以反映该特定模式的存储值。
  - [x] **持久化**: 调整滑块仅更新*当前*模式的设置。

### 2025-12-26 v0.9.43 - 上下文感知设置 UI (Context-Aware Settings UI)

**目标**: 通过动态更新设置模态框中的标签以反映当前活动的布局模式，提高用户清晰度。

- [x] **UI 增强**
  - [x] **标签切换**: 排斥力滑块的标签现在根据设置模态框打开时的活动布局更新为 "排斥力 (力导向)" 或 "排斥力 (DAG)"。
  - [x] **本地化**: 支持英语和中文语言环境的动态标签切换。

### 2025-12-26 v0.9.42 - 独立排斥力设置 (Distinct Repulsion Settings)

**目标**: 允许用户为 "力导向" 和 "DAG" 布局模式配置不同的 "排斥力强度" 值，并具有特定于布局的默认值。

- [x] **设置逻辑**
  - [x] **数据结构**: 更新了 `settings.js` 中的 `defaultSettings` 以存储单独的键：`repulsionForce` (默认: -550) 和 `repulsionDAG` (默认: -850)。
  - [x] **上下文感知 UI**: "可视化设置" 模态框现在自动显示并更新对应于当前活动布局模式的排斥力值。
  - [x] **动态应用**: 切换布局 (`updateLayout`) 或更改设置 (`settingsManager.subscribe`) 动态应用正确的力强度。

### 2025-12-26 v0.9.41 - 设置模态框模拟冻结 (Settings Modal Simulation Freeze)

**目标**: 打开 "可视化设置" 模态框时自动冻结模拟，以节省内存/CPU 并防止配置期间的后台活动。

- [x] **模态框状态逻辑**
  - [x] **自动冻结**: 打开设置模态框 (`initSettingsUI`) 现在触发 `simulation.stop()` 并设置内部 `isSettingsModalOpen` 标志。
  - [x] **条件恢复**: 关闭模态框*仅*在全局 "冻结布局" 复选框未选中时恢复模拟。
  - [x] **更新抑制**: 模态框打开时由 `settingsManager` 触发的更新（例如滑块拖动）应用值但*不*重启模拟循环。

### 2025-12-26 v0.9.40 - 冻结布局优先级修复 (Freeze Layout Priority Fix - Settings Modal)

**目标**: 确保在 "可视化设置" 模态框中更改物理或视觉设置不会在 "冻结布局" 启用时重启模拟。

- [x] **设置应用逻辑**
  - [x] **条件重启**: 修改了 `app.js` 中的 `settingsManager.subscribe` 回调以检查 "冻结布局" 复选框状态。
  - [x] **行为**:
    - **冻结**: 力（电荷、距离、碰撞）在后台更新，但跳过 `simulation.restart()`。视觉更改（不透明度）立即应用。
    - **解冻**: 力更新且模拟重启 (alpha 0.3)。

### 2025-12-26 v0.9.39 - 布局切换松弛与冻结逻辑 (Layout Switch Relaxation & Freeze Logic)

**目标**: 在切换布局时应用 "快速松弛" 策略（0.2 阻尼 -> 0.95 阻尼），确保与初始加载行为一致。此外，确保在松弛期后尊重 "冻结布局"。

- [x] **布局转换逻辑**
  - [x] **松弛**: 切换到新布局 (Force/DAG) 会将 `velocityDecay` 重置为 **0.2** 并持续 2 秒，以允许节点快速找到新位置。
  - [x] **稳定**: 2 秒后自动过渡到 **0.95** 阻尼。
  - [x] **延迟冻结**: 如果在切换期间启用了 "冻结布局"，模拟将在 2 秒的松弛阶段运行，然后自动**停止**，将新布局冻结在其稳定状态。

### 2025-12-26 v0.9.38 - 快速开始指南 HTML 渲染修复 (Quick Start Guide HTML Rendering Fix)

**目标**: 修复本地化快速开始指南内容中的 HTML 标签（如 `<br>` 和 `<strong>`）显示为原始文本而不是被渲染的问题。

- [x] **渲染逻辑**
  - [x] **HTML 支持**: 更新了 `app.js` 中的 `window.updateLanguage`，在注入翻译内容时使用 `.innerHTML` 而不是 `.innerText`。这确保了指南中的富文本元素正确显示。

### 2025-12-26 v0.9.37 - 快速松弛策略 (Rapid Relaxation Strategy)

**目标**: 实现两阶段阻尼过程，允许图表在加载时快速“展开”，然后稳定下来。

- [x] **阻尼逻辑**
  - [x] **初始阶段**: 在前 2 秒将 `velocityDecay` 设置为 **0.2**。这种低摩擦力允许节点迅速移离中心并解开。
  - [x] **稳定阶段**: 2 秒后自动过渡到 **0.95**（高摩擦力）以稳定布局（从 0.92 更新）。
  - [x] **交互安全**: 确保自动过渡不会覆盖初始阶段的手动滑块调整。

### 2025-12-26 v0.9.36 - 冻结布局优先级修复 (Freeze Layout Priority Fix - Visual Settings)

**目标**: 确保如果启用了 "冻结布局"，更改视觉设置（度数基准、大小依据）不会触发模拟重启，尊重用户保持节点静止的指令。

- [x] **视觉更新逻辑**
  - [x] **条件重启**: 修改了 `app.js` 中的 `updateSize()` 以检查 "冻结布局" 复选框状态。
  - [x] **行为**: 如果冻结，视觉属性（半径、字体大小）立即更新，但跳过 `simulation.restart()`。碰撞力在后台更新，为用户解冻时做好准备。

### 2025-12-26 v0.9.35 - 视口剔除放宽 (Viewport Culling Relaxation)

**目标**: 放宽视口剔除限制以提供更流畅的用户体验，防止视口外的节点过早冻结，并允许在全局冻结之前进行更深度的缩小。

- [x] **剔除优化**
  - [x] **全景冻结阈值**: 从 `scale < 0.4` 降低到 `scale < 0.1`，允许在更广泛的缩放级别下模拟。
  - [x] **动态缓冲区**: 将屏幕外缓冲区从固定的 `100` 单位增加到 `800 / scale`（约 800 视觉像素），确保“向外扩展的固定范围”行为。

### 2025-12-26 v0.9.34 - 全局布局更新修复 (Global Layout Update Fix)

**目标**: 确保布局切换应用于图表中的所有节点，覆盖可能已冻结屏幕外节点的任何优化约束（如视口剔除）。

- [x] **布局转换逻辑**
  - [x] **全局解冻**: 在 `updateLayout()` 中，启动新模拟时显式清除所有节点的 `fx` 和 `fy` 属性。
  - [x] **剔除重置**: 重置 `isCulled` 标志，以确保屏幕外节点包含在新布局计算和渲染中。
  - [x] **结果**: 从 'Force' 切换到 'DAG'（反之亦然）可以正确重新排列整个图表，即使用户放大了视图且许多节点以前被冻结。

### 2025-12-26 v0.9.33 - 布局状态缓存 (Layout State Caching - Instant Switch)

**目标**: 实现状态缓存，允许在布局（"力导向" vs "DAG"）之间切换而无需重新计算位置或动画过渡，满足 "模板状态" 需求。

- [x] **状态管理**
  - [x] **缓存**: 创建 `layoutCache` 以存储每种模式的 `x, y, fx, fy`。
  - [x] **保存/恢复**: 实现切换前保存当前位置和切换后恢复目标位置的逻辑。
- [x] **转换逻辑**
  - [x] **即时切换**: 如果存在布局缓存，恢复位置并跳过模拟预热 (`alpha(1)`)，有效地将节点传送到其先前的状态。
  - [x] **首次运行**: 如果不存在缓存，执行标准模拟。

### 2025-12-26 v0.9.32 - 高阻尼与渲染优化 (High Damping & Render Optimization)

**目标**: 通过增加模拟摩擦力和跳过冻结的屏幕外节点的 DOM 更新，进一步减少内存/CPU 消耗。

- [x] **阻尼调整**
  - [x] **默认值**: 将 `velocityDecay` 增加到 **0.92**。
  - [x] **效果**: 图表稳定得更快；移动更“重”，抖动更少。

- [x] **渲染剔除 (DOM)**
  - [x] **逻辑**: 在 `ticked()` 中，过滤 D3 选择集以仅更新未标记为 `isCulled` 的节点。
  - [x] **机制**: `checkSimulationState` 将屏幕外节点设置为 `isCulled = true`。
  - [x] **好处**: 每帧避免为用户看不到的节点进行数千次昂贵的 DOM 属性更新。

### 2025-12-26 v0.9.31 - 模拟优化 (视口剔除) (Simulation Optimization - Viewport Culling)

**目标**: 通过基于缩放级别和视口可见性最小化粒子运动计算，减少内存和 CPU 消耗。

- [x] **视口剔除逻辑**
  - [x] **全景冻结**: 如果用户缩小到足以看到整个图表（或大部分），自动停止模拟以节省资源，假设布局是稳定的。
  - [x] **屏幕外冻结**: 放大时，仅模拟可见视口内的节点。冻结视口外的节点。
  - [x] **实现**:
    - [x] 添加由缩放事件触发的 `checkSimulationState()`。
    - [x] 基于 `event.transform` 计算可见边界。
    - [x] 更新 `simulation.nodes()` 仅包含可见节点（加上缓冲区）或使用 `fx`/`fy` 锁定屏幕外节点。

### 2025-12-26 v0.9.30 - 专注模式布局隔离 (Focus Mode Layout Isolation)

**目标**: 确保专注模式内发生的布局更改（自动排列或手动拖动）不会影响退出时主界面的节点位置。

- [x] **位置备份与恢复**
  - [x] **备份**: 在 `enterFocusMode` 中，保存所有节点当前的 `x`, `y`, `fx`, 和 `fy` 坐标。
  - [x] **恢复**: 在 `exitFocusMode` 中，将这些坐标恢复到专注前的状态。
  - [x] **一致性**: 确保图表视觉状态完全恢复到进入专注模式之前的样子。

### 2025-12-26 v0.9.29 - 冻结布局持久化 (Freeze Layout Persistence)

**目标**: 修复 "分析与导出"（及其他布局调整）会覆盖 "冻结布局" 状态，导致意外节点移动的 Bug。

- [x] **布局调整逻辑**
  - [x] **行为**: 修改了 `app.js` 中的 `ResizeObserver`，在调用 `simulation.restart()` 之前严格检查 "冻结布局" 复选框状态。
  - [x] **Canvas 同步**: 确保在布局更改期间调用 `resizeCanvas()`，以保持 Canvas 分辨率正确，即使模拟已冻结。
  - [x] **结果**: 打开分析面板或调整窗口大小现在尊重冻结状态，保持节点静止。

### 2025-12-26 v0.9.28 - 专注模式具体内容 (Focus Mode Specific Content Access)

**目标**: 优化用户体验，提供在专注模式下打开特定节点内容的直接方式，避免需要双击。

- [x] **特定内容按钮**
  - [x] **UI**: 在专注模式控制面板 (`#focus-exit-btn`) 中添加了 "打开具体内容" 按钮。
  - [x] **逻辑**: 点击按钮触发 `window.reader.open(focusNode)`，模仿双击专注节点的行为。
  - [x] **本地化**: 添加了英语 ("Open Specific Content") 和中文 ("打开具体内容") 支持。

- [x] **文档**
  - [x] **用户手册**: 更新了专注模式章节。
  - [x] **接口文档**: 更新了专注模式功能。
  - [x] **测试报告**: 添加了新按钮的测试用例。

### 2025-12-26 v0.9.27 - 条件重启 (Conditional Restart)

**目标**: 确保退出专注模式时尊重“冻结布局”状态。

- [x] **冲突解决**
  - [x] **逻辑**: 在 `exitFocusMode` 中，检查是否选中了“冻结布局”。
  - [x] **行为**: 如果选中，调用 `simulation.stop()` 而不是 `restart()`，防止不必要的移动。
  - [x] **视觉**: 手动触发 `ticked()` 以确保图表在其当前位置渲染恢复的节点。

### 2025-12-26 v0.9.26 - UX 增强 (UX Enhancements)

**目标**: 提高移动端可用性并有效引导新用户。

- [x] **冻结布局按钮**
  - [x] **UI**: 在主界面（右上角或控件附近）添加专用的“冻结布局”按钮，以便快速访问，尤其是在移动设备上。
  - [x] **逻辑**: 将按钮链接到现有的模拟冻结功能。与控件中的复选框同步状态。
  - [x] **视觉**: 使用图标（例如 锁定/解锁）指示状态。

- [x] **快速开始手册**
  - [x] **内容**: 创建简明的“如何使用”指南，涵盖：
    - 加载数据
    - 导航（平移/缩放）
    - 专注模式（双击）
    - 检查（点击/悬停）
    - 分析面板
  - [x] **UI**: 实现为模态框，在首次加载时打开（localStorage 检查）或通过“帮助”按钮打开。
  - [x] **本地化**: 支持英语和中文。

- [x] **文档**
  - [x] **接口文档**: 使用新的 UI 元素更新。
  - [x] **README**: 添加更新日志。
  - [x] **测试报告**: 验证新功能。

### 2025-12-25 v0.9.25 - 冻结布局优化 (Freeze Layout Optimization)

**目标**: 通过在请求时严格冻结主图，防止唤醒模拟的用户交互，从而最小化资源使用。

- [x] **冻结布局增强**
  - [x] **行为**: 选中“冻结布局”现在会禁用主界面（SVG 模式）中的节点拖动。
  - [x] **约束**: 此限制*不*适用于专注模式，在该模式下仍允许手动调整。
  - [x] **性能**: 防止拖动事件触发 `simulation.restart()`，确保模拟保持有效停止（0% CPU 使用率）。

- [x] **文档**
  - [x] **接口文档**: 更新模拟控制部分。
  - [x] **README**: 添加更新日志条目。
  - [x] **测试报告**: 验证行为。

### 2025-12-25 v0.9.24 - 专注模式内存优化 (Focus Mode Memory Optimization)

**目标**: 通过在专注模式期间冻结背景节点来减少 SVG 模式下的内存/CPU 开销。

- [x] **模拟优化**
  - [x] **子集化**: 修改 `enterFocusMode` 以过滤 `simulation.nodes()` 和 `simulation.force("link").links()`，仅包含专注子集。
  - [x] **冻结**: 背景节点实际上被冻结，因为它们不再由 D3 力处理。
  - [x] **恢复**: 修改 `exitFocusMode` 以将完整的节点和链接集恢复到模拟中。

- [x] **文档**
  - [x] **接口文档**: 更新优化细节。
  - [x] **README**: 添加更新日志条目。
  - [x] **测试报告**: 验证优化行为。

### 2025-12-25 v0.9.23 - 默认设置调整 (Default Settings Adjustment)

**目标**: 根据用户反馈调整阅读窗口字体大小和模拟阻尼的默认设置。

- [x] **阅读窗口字体大小**
  - [x] **实现**: 修改 `reader.js` 中的 `Reader` 类，默认将 `currentZoom` 设置为 0.5。
  - [x] **逻辑**: 影响打开时的初始化和重置。

- [x] **模拟阻尼**
  - [x] **实现**: 更新 `app.js` 以使用 `.velocityDecay(0.6)` 初始化 `d3.forceSimulation`。
  - [x] **UI**: 更新 `index.html` 滑块默认值并显示文本为 0.6。

### 2025-12-25 v0.9.22 - 移动端弹窗适配 (Mobile Popup Adaptation)

**目标**: 适配节点统计弹窗以支持移动设备的触摸拖动和捏合缩放功能。

- [x] **触摸拖动支持**
  - [x] **实现**: 向 `popupDragHandle` 添加了 `touchstart`, `touchmove`, `touchend` 监听器。
  - [x] **逻辑**: 使用 `touches[0]` 坐标镜像鼠标拖动逻辑。
  - [x] **约束**: 需要单指触摸头部。

- [x] **捏合缩放支持**
  - [x] **实现**: 向 `statsPopup` 添加了 `touchstart`, `touchmove`, `touchend` 监听器。
  - [x] **逻辑**: 计算双指之间的距离 (`Math.hypot`) 以确定缩放比例。
  - [x] **缩放**: 更新 `popupDragState.currentScale` 并应用于 `fontSize`。
  - [x] **限制**: 缩放限制在 0.5x 到 2.0x 之间。

- [x] **文档**
  - [x] **接口文档**: 更新了移动端交互规范。
  - [x] **README**: 添加更新日志条目。
  - [x] **测试报告**: 验证移动端交互。

### 2025-12-25 v0.9.21 - 严格的边可见性与优化 (Strict Edge Visibility & Optimization)

**目标**: 执行严格的边可见性规则（默认隐藏）并优化大图渲染。

- [x] **严格的边可见性**
  - [x] **SVG 模式**: 修改 `app.js` 中的 `updateVisibility`，将默认边不透明度设置为 0（原为 0.15）。
  - [x] **一致性**: 确保 SVG 行为与 Canvas 模式匹配（默认隐藏）。
  - [x] **性能**: 减少初始视图的视觉混乱和渲染成本。

- [x] **文档**
  - [x] **接口文档**: 更新以反映 v0.9.21 中的严格边可见性。
  - [x] **README**: 添加 v0.9.21 更新日志。
  - [x] **测试报告**: 验证 v0.9.21 的行为。

### 2025-12-24 v0.9.20 - 专注进入时自动清除选择状态 (Selection State Auto-Clear on Focus Entry)

**目标**: 通过双击进入专注模式时自动清除任何现有的选择或高亮状态，以实现干净的过渡。

- [x] **自动清除实现**
  - [x] **高亮清除**: 修改 `handleDoubleClick()`，在进入专注模式之前调用 `highlightManager.unhighlight({ force: true })`。
  - [x] **弹窗隐藏**: 进入专注模式时自动隐藏统计弹窗 (`#node-stats-popup`)。
  - [x] **状态管理**: 确保干净的状态转换，没有残留的视觉伪影。

- [x] **用户体验增强**
  - [x] **干净过渡**: 用户始终以原始的专注上下文开始。
  - [x] **视觉清晰度**: 防止正常模式和专注模式之间重叠高亮引起的混淆。
  - [x] **一致行为**: 标准化所有场景下的专注模式进入行为。

- [x] **文档**
  - [x] **接口文档**: 更新了 v0.9.20 选择自动清除规范。
  - [x] **README**: 在中英文中添加了 v0.9.20 更新日志条目。
  - [x] **代码注释**: 解释自动清除逻辑的双语注释。
  - [x] **TODO**: 记录已完成的功能实现。

### 2025-12-24 v0.9.19 - 专注模式与弹窗增强 (Focus Mode & Popup Enhancements)

**目标**: 修复专注模式刷新问题，并为统计弹窗添加拖动/缩放功能，以获得更好的用户体验。

- [x] **专注模式重新进入修复**
  - [x] **双击行为**: 修改了 `handleDoubleClick()`，允许在已处于专注模式时重新进入相关节点的专注模式。
  - [x] **状态重置**: 确保在进入新的专注上下文之前正确重置所有节点可见性标志 (`isFocusVisible`, `fx`, `fy`, `_labelDy`)。
  - [x] **预防**: 移除了阻止在 `enterFocusMode()` 中切换相关节点专注的限制。

- [x] **统计弹窗增强**
  - [x] **拖动功能**: 实现了通过点击和拖动弹窗头部来进行基于鼠标的拖动。
    - [x] **状态跟踪**: 创建 `popupDragState` 来跟踪拖动位置和比例。
    - [x] **事件处理程序**: 添加了 `mousedown`, `mousemove` 和 `mouseup` 监听器用于拖动控制。
    - [x] **视觉反馈**: 为拖动期间的光标反馈添加了 `.dragging` 类。
  - [x] **缩放控制**: 添加了三个缩放按钮 (+, −, ⟲) 来缩放弹窗内容。
    - [x] **缩放范围**: 0.5x 到 2.0x，增量为 0.1。
    - [x] **实现**: 通过 `.popup-content` 上的 `fontSize` CSS 属性应用缩放。
    - [x] **重置功能**: 重置按钮恢复默认大小和比例。
  - [x] **可调整大小**: 启用了 CSS `resize: both` 以支持浏览器原生调整大小功能。
    - [x] **约束**: 设置最小/最大宽度和高度约束。
    - [x] **滚动**: 确保调整大小时内容正确滚动。
  - [x] **位置重置**: 关闭时，弹窗位置重置为默认值（右上角）。
- [x] **文档**
  - [x] **接口文档**: 更新了 v0.9.19 拖动/缩放接口规范。
  - [x] **README**: 在中英文中添加了 v0.9.19 更新日志条目。
  - [x] **双语注释**: 所有新功能的双语代码注释。
  - [x] **CSS**: 记录了可拖动、可缩放和可调整大小弹窗的新样式。

### 2025-12-24 v0.9.18 - 节点高亮系统重构 (Node Highlighting System Refactor)

**目标**: 以模块化架构重构节点高亮逻辑，以提高可维护性和稳健性。

- [x] **模块化架构**
  - [x] **NodeHighlightManager 类**: 创建了具有完整状态管理的专用模块 (`nodeHighlight.js`)。
  - [x] **API 设计**: 实现了清晰的公共 API，包括 `highlight()`, `unhighlight()`, `getState()` 和辅助方法。
  - [x] **集成**: 完全集成到 app.js 中，替换旧的高亮功能。

- [x] **统一交互模型**
  - [x] **PC 支持**: 基于悬停的高亮显示，无需冻结模拟。
  - [x] **移动端支持**: 基于点击的高亮显示，具有模拟冻结功能，以便进行稳定检查。
  - [x] **状态一致性**: 正确跟踪冻结与临时高亮状态。

- [x] **渲染增强**
  - [x] **SVG 模式**: 定向边着色（蓝色=#4488ff 出度，红色=#ff6b6b 入度）与匹配的箭头标记。
  - [x] **Canvas 模式**: 更新为使用 highlightManager 状态以获得一致的视觉行为。
  - [x] **变暗效果**: 未连接的节点在高亮期间变暗至 0.05 不透明度，以获得更清晰的焦点。

- [x] **专注模式集成**
  - [x] **状态感知**: highlightManager 尊重专注模式并且不干扰。
  - [x] **协调**: 专注模式进入/退出正确更新 highlightManager 状态。

- [x] **文档**
  - [x] **双语注释**: 代码中全面的中英文注释。
  - [x] **接口文档**: 更新了完整的 NodeHighlightManager API 参考。
  - [x] **README**: 在两种语言中添加了 v0.9.18 更新日志条目。
  - [x] **集成指南**: 创建了详细的集成说明。

### 2025-12-17 v0.1.0 - 基础与数据结构 (Foundation & Data Structures)

**目标**: 建立独立的项目环境和有向图的核心数据结构，初期独立于特定的笔记应用 API。

- [x] **项目初始化**
  - [x] 在 `NoteConnection` 中初始化一个新的 TypeScript/Node.js 项目。
  - [x] 配置 ESLint, Prettier 和 Jest 用于测试。

- [x] **图核心实现**
  - [x] 实现支持元数据（如 `rank`, `clusterId`）的 `Node` 和 `Edge` 接口。
  - [x] 实现 `Graph` 类，包含方法：`addNode`, `addEdge`, `getNeighbors`, `getIncomingEdges`, `getOutgoingEdges`。

### 2026-01-15 v0.2.0 - 数据摄取与定向解析 (Data Ingestion & Directional Parsing)

**目标**: 从 Markdown 文件中摄取数据，专门解析 Frontmatter 中的定向依赖关系。

- [x] **Markdown 解析服务**
  - [x] 实现文件系统读取器以递归扫描目录。
  - [x] 创建基于正则或 AST 的解析器以提取 YAML Frontmatter。

- [x] **依赖提取**
  - [x] 定义模式：`prerequisites: [[Note A]]`, `next: [[Note B]]`。
  - [x] 将这些元数据字段转换为 `Graph` 对象中的有向边的逻辑。

### 2026-02-01 v0.3.0 - 算法核心 (DAG 逻辑) (Algorithmic Core)

**目标**: 确保图是有效的 DAG 并计算层级布局位置。

- [x] **循环检测与解决**
  - [x] 实现基于 DFS 的循环检测。
  - [x] 策略：向用户报告循环或自动打破循环（控制台警告）。

- [x] **拓扑排序与排名**
  - [x] 实现算法为每个节点分配 `rank` (0, 1, 2...)。
  - [x] 确保没有依赖关系的节点为 Rank 0。
  - [x] 集成 Kahn 算法变体（最长路径分层）。

### 2026-03-01 v0.4.0 - 可视化引擎 (Visualization Engine)

**目标**: 使用分层布局引擎（Sugiyama 风格）在 Web 视图中渲染处理后的图。

- [x] **布局引擎集成**
  - [x] 在 UI 中实现“布局模式”切换（力导向 vs DAG 分层）。
  - [x] 将 `rank` 映射到可视化中的 Y 坐标。

- [x] **Canvas/SVG 渲染**
  - [x] 优化层级结构的渲染。
  - [x] 为依赖关系绘制弯曲的贝塞尔线，以清晰指示流向。

- [x] **专注模式 (Focus Mode - v0.6.2)**
  - [x] **交互式专注**: 点击节点以居中并隔离上下文。
  - [x] **层级布局**: 自动将上级（出度）和下级（入度）排列在分层中。
  - [x] **层内排序**: 按重要性（度数比）对邻居进行排序。
  - [x] **上下文过滤**: 仅显示直接邻居和高相关性节点。
  - [x] **布局优化**:
    - [x] 基于标准（分数）的相对高度定位。
    - [x] 交错标签放置以防止重叠。
    - [x] 修复: 防止在专注模式内切换上下文时节点累积。

### 2026-04-01 v0.5.0 - 可扩展性 (聚类) (Scalability)

**目标**: 通过基于文件结构或语义标签将节点分组为高级聚类，以处理 10,000+ 节点。

- [x] **聚类逻辑**
  - [x] 实现**基于文件夹的聚类**: 解析目录结构（例如 `Physics/Mechanics` -> 聚类 `Mechanics`）。
  - [x] 添加配置策略: 在 `clusterId` 分配的 `标签传播` (当前) 和 `文件夹路径` 之间切换。

- [x] **语义缩放/向下钻取**
  - [x] 在低缩放级别渲染“超级节点”（聚类）（实现为“聚类视图”切换）。
  - [x] 点击聚类时展开显示详细的依赖图（通过过滤器向下钻取）。

### 2026-05-01 v0.6.0 - 混合推断策略 (AI 与统计) (Hybrid Inference Strategy)

**目标**: 结合统计和向量化方法，在缺乏显式元数据的情况下推断依赖关系和关联。

- [x] **基于向量的关联 (Similarity)**
  - [x] 实现嵌入生成（使用本地 TF-IDF VectorSpace）。
  - [x] 使用余弦相似度确定概念之间**关联**（无向关系）的强度。

- [x] **统计依赖推断**
  - [x] 计算笔记语料库中的**共现频率**和**条件概率** ($P(B|A)$)。
  - [x] 假设：如果 A 经常出现在 B 之前或在定义 B 的上下文中，则 A 可能是依赖项。

- [x] **混合判断引擎 (Hybrid Judgment Engine - v0.6.5)**
  - [x] 结合向量相似度（用于相关性）+ 统计概率（用于方向）。
  - [x] 规则：如果 `Similarity(A, B) > Threshold` 且 `P(B|A) >> P(A|B)`，则建议边 `A -> B`。

- [ ] **AI 推断服务 (LLM 验证)**
  - 使用 LLM 验证来自混合引擎的高置信度候选项。
  - 任务：“给定统计证据，确认 A 是否为 B 的先决条件。”

### 2025-12-22 v0.8.5 - 动态数据源与服务器 (Dynamic Data Source & Server)

**目标**: 支持动态选择知识库文件夹和独立服务器部署。

- [x] **动态路径选择**
  - [x] 后端: 支持 `Knowledge_Base` 下的可变输入路径。
  - [x] 服务器: 实现用于 API (`/api/folders`, `/api/build`) 和静态服务的 `http` 服务器。
  - [x] 前端: 添加 UI 以列出和选择知识库文件夹。

### 2025-12-24 v0.9.17 - SVG 视觉完整性 (SVG Visual Completeness)

**目标**: 完成 SVG 模式交互的视觉反馈循环。

- [x] **SVG 渲染器**
  - [x] **彩色标记**: 实现了动态标记切换（红/蓝箭头），以匹配高亮期间的边颜色。
  - [x] **视觉一致性**: 确保清除高亮时箭头恢复为灰色。

### 2025-12-24 v0.9.16 - 交互完整性 (Interaction Completeness)

**目标**: 确保检查期间节点关系的完整可视化。

- [x] **交互逻辑**
  - [x] **始终开启的上下文**: 点击节点现在强制显示*所有*入度和出度关系，覆盖任何活动的“仅入度”或“仅出度”过滤器，以确保可见完整的上下文。
- [x] **Canvas 渲染器**
  - [x] **视觉对等**: 在 Canvas 引擎中为高亮边实现了加粗线条渲染 (2.5px 宽度)，以匹配 SVG 样式。

### 2025-12-23 v0.8.6 - 性能优化 (并行处理) (Performance Optimization)

**目标**: 优化大数据集 (>10,000 节点) 的图构建过程，以缩短构建时间。

- [x] **并行图构建**
  - [x] **Worker 线程**: 将密集的关键词匹配任务分流到多个 CPU 核心。
  - [x] **异步 I/O**: 重构 `FileLoader` 使用异步批量处理以防止 `EMFILE` 错误。
  - [x] **稳健性**: 实现 Worker 失败时的顺序处理回退机制。

### 2025-12-23 v0.8.7 - 可扩展性与用户体验打磨 (Scalability & UX Polish)

**目标**: 解决渲染瓶颈并改进大图的布局控制。

- [x] **高容量处理**
  - [x] **Worker 扩展**: 将线程限制增加到 12。
- [x] **Canvas 渲染**
  - [x] **双引擎**: 实现了 Canvas 渲染器，用于 10k+ 节点的高性能绘制。
- [x] **专注模式 UX**
  - [x] **间距控制**: 添加了 UI 滑块以调整节点层间距。

### 2025-12-23 v0.8.8 - 可扩展性默认值与高级布局 (Scalability Defaults & Advanced Layout)

**目标**: 优化大规模图谱的默认视图并完善专注模式布局。

- [x] **可扩展性默认值**
  - [x] **减少杂乱**: 默认隐藏边和孤立节点。
  - [x] **按需上下文**: 仅在悬停或专注时显示关系。
- [x] **专注模式增强**
  - [x] **水平间距**: 添加了水平节点分隔控制以防止重叠。

### 2025-12-23 v0.8.9 - 稳定性改进 (Stability Improvements)

**目标**: 增强观察稳定性。

- [x] **交互稳定性**
  - [x] **冻结**: 防止在专注模式下选择或拖动时节点漂移。

### 2025-12-23 v0.9.0 - 精确控制与稳定性 (Precise Control & Stability)

**目标**: 提供用于手动布局控制和稳定检查的工具。

- [x] **悬停逻辑**
  - [x] **自动冻结**: 悬停时锁定节点位置以便于检查。
- [x] **模拟 UX**
  - [x] **控制**: 添加速度滑块和冻结布局切换。
  - [x] **手动放置**: 允许在布局冻结时手动定位节点而不自动恢复。

### 2025-12-23 v0.9.1 - 移动端转换 (Mobile Transformation)

**目标**: 将当前的 Web 项目转换为 Android APK 应用程序。

- [x] **Capacitor 集成**
  - [x] **初始化**: 配置了 `capacitor.config.ts`。
  - [x] **平台支持**: 通过 `@capacitor/android` 添加了 Android 平台。
  - [x] **资源管理**: 实现了 `copy-assets` 脚本和 `npx cap sync`。
  - [x] **构建流水线**: 验证了 Gradle 构建配置 (`assembleDebug`)。

### 2025-12-23 v0.9.2 - 移动端 UI 优化 (Mobile UI Optimization)

**目标**: 针对小触摸屏优化 UI/UX。

- [x] **响应式控件**
  - [x] **折叠菜单**: 主控件在移动端折叠为按钮以节省空间。
  - [x] **专注模式 UI**: 将“退出专注”按钮移至底部中央以便操作。
  - [x] **设置合并**: 将语言选择器移入设置模态框以净化界面。
- [x] **触摸交互**
  - [x] **捏合缩放**: 阅读窗口添加了多点触控支持以缩放文本。
  - [x] **触摸目标**: 增大了按钮和输入框以提高触摸精度。

### 2025-12-23 v0.9.3 - 移动端交互迭代 (Mobile Interaction Iteration)

**目标**: 改进移动端可用性的交互逻辑。

- [x] **交互逻辑更新**
  - [x] **单击**: 触发节点高亮和提示框（显示入/出度）。
  - [x] **双击**: 触发进入专注模式。
  - [x] **桌面兼容性**: 保留了桌面的 `mouseover` 悬停，同时统一了点击逻辑。

### 2025-12-23 v0.9.4 - Mermaid 图片优化 (Mermaid Image Optimization)

**目标**: 增强移动设备上的图表阅读体验。

- [x] **Mermaid 缩放模式**
  - [x] **交互**: 点击 Mermaid 图表打开全屏覆盖层。
  - [x] **手势**: 在覆盖层内实现了平移 (拖动) 和缩放 (捏合/滚轮) 逻辑。
  - [x] **UX**: 添加了显眼的退出按钮以关闭缩放模式。

### 2025-12-24 v0.9.5 - 移动体验优化与专注语义 (Refined Mobile Experience & Focus Semantics)

**目标**: 打磨移动端和复杂图谱的交互细节与视觉清晰度。

- [x] **专注模式增强**
  - [x] **居中**: 视口自动以焦点节点的原始位置为中心。
  - [x] **语义**: 添加了清晰的区域标签 ("Helping to understand", "Further exploration")。
  - [x] **布局**: 实现了 "层级 (从左到右)" 布局选项。
- [x] **分析面板**
  - [x] **移动端**: 面板现在可滚动并适配触摸屏。
  - [x] **交互**: 点击行会在图表中高亮显示节点及其连接。
- [x] **视觉打磨**
  - [x] **Mermaid**: 增强了浅色图表的文本可见性（阴影/描边）。
  - [x] **连线**: 确保边默认隐藏，仅在交互时可见。

### 2025-12-24 v0.9.6 - 分析与视觉打磨 (Analysis & Visuals Polish)

**目标**: 进一步完善分析面板的移动端可用性并修复视觉不一致。

- [x] **Mermaid 缩放样式**
  - [x] **修复**: 确保 Mermaid 文本阴影/灰度在全屏缩放模式下持久保留。
- [x] **度数分析移动端**
  - [x] **全屏**: 添加了在半高和全屏之间切换面板的开关。
  - [x] **缩放**: 为面板内容实现了捏合缩放。
  - [x] **交互**: 验证了点击高亮逻辑在各视图中均有效。
- [x] **图表交互**
  - [x] **稳健性**: 添加了背景点击处理程序以清除高亮。

### 2025-12-24 v0.9.7 - 专注模式交互修复 (Focus Mode Interaction Fix)

**目标**: 修复专注模式下的可用性 Bug。

- [x] **布局切换**
  - [x] **修复**: 在 "水平" 和 "垂直" 布局之间切换现在会立即刷新图表，无需调整滑块。

### 2025-12-24 v0.9.8 - 分析交互完善 (Analysis Interaction Refinement)

**目标**: 确保分析面板与图表之间的无缝交互。

- [x] **图表同步**
  - [x] **提示框**: 点击分析面板中的节点现在会在图表上节点的位置显示提示框（统计数据）。
- [x] **移动端 UX**
  - [x] **滚动**: 修复了分析面板中的滚动行为以防止冲突。

### 2025-12-24 v0.9.9 - 移动端分析面板打磨 (Mobile Analysis Panel Polish)

**目标**: 增强“度数分析”页面的移动端可用性，增加手势控制。

- [x] **移动端适配**
  - [x] **滑动操作**: 实现了通过触摸拖动面板头部的“上下滑动”功能。
  - [x] **全屏**: 支持在浮动窗口和全屏页面之间切换，并具有拖动自动吸附功能。
  - [x] **缩放**: 验证了界面的双指捏合缩放支持。
- [x] **交互验证**
  - [x] **节点点击**: 验证了点击面板中的节点会在图表中显示入度和出度关系。

### 2025-12-24 v0.9.10 - 交互完善 (点击冻结) (Interaction Refinement)

**目标**: 通过在点击节点时冻结模拟来提高图表检查的稳定性。

- [x] **点击交互**
  - [x] **点击冻结**: 点击节点现在会立即停止力导向模拟（冻结所有节点），以防止检查期间的移动。
  - [x] **取消恢复**: 点击背景（空白区域）会取消高亮并恢复模拟（除非手动冻结）。
  - [x] **可视化**: 确保在冻结时清晰显示入度和出度连线。

### 2025-12-24 v0.9.11 - 节点统计与本地化 (Node Statistics & Localization)

**目标**: 增强节点的详细检查功能并完成国际化。

- [x] **专注模式本地化**
  - [x] **多语言**: 实现了 `t()` 调用以支持语义标签 ("帮助理解" / "进一步探索")。
- [x] **节点统计面板**
  - [x] **交互**: 点击节点打开一个专用面板显示关系。
  - [x] **视觉**: 入度连线为红色，出度连线为蓝色 (#4488ff)。
  - [x] **内容**: 面板列出所有入度和出度邻居，并支持导航。

### 2025-12-24 v0.9.12 - 独立统计弹窗 (Independent Statistics Popup)

**目标**: 将节点检查与全局分析分离，以获得更好的用户体验。

- [x] **浮动统计窗口**
  - [x] **交互**: 点击节点打开一个浮动弹窗，显示入/出度。
  - [x] **视觉**: 明显的红色 (入) 和蓝色 (出) 指示器。
  - [x] **独立性**: 不干扰主度数分析面板。

### 2025-12-24 v0.9.13 - 专注模式隔离 (Focus Mode Isolation)

**目标**: 确保特定的交互效果不会渗入专注模式。

- [x] **交互完善**
  - [x] **约束**: 验证在专注模式下点击节点*不*会触发浮动统计弹窗或更改高亮样式，从而保留特定的专注模式上下文。

### 2025-12-24 v0.9.14 - 视觉与数据修复 (Visual & Data Fixes)

**目标**: 修复边方向的可视化和数据重复问题。

- [x] **边高亮**
  - [x] **Canvas 支持**: 在 Canvas 渲染器 (`renderCanvas`) 中实现了红色 (入) 和蓝色 (出) 边着色，此前为通用的灰色。
- [x] **数据完整性**
  - [x] **去重**: 使用 `Set` 防止统计弹窗邻居列表中出现重复的节点条目。

### 2025-12-24 v0.9.15 - 增强隔离 (Enhanced Isolation)

**目标**: 通过有效隐藏检查期间的不相关上下文来优化视觉焦点。

- [x] **视觉优化**
  - [x] **深度变暗**: 将不相关节点的不透明度从 0.1 降低到 0.05，以更好地满足“暂时隐藏”的要求，同时保持最小的上下文。
  - [x] **边强调**: 将高亮边的宽度增加到 2.5px，以便更清晰地区分红色/蓝色。

### 2026-06-01 v1.0.0 - 正式版本发布 (Production Release)

**目标**: 完成与 Joplin/Obsidian 插件的集成，并打磨整体用户体验。

- [x] **插件封装**
  - [x] 将 `NoteConnection` 核心逻辑封装为 Joplin 插件与 Obsidian 插件。（API 在 v0.9.53 已就绪）

- [x] **用户设置与文档体系 (v0.7.0)**
  - [x] **设置管理器**: 统一管理应用状态（Physics / Visuals），并通过 `localStorage` 持久化。
  - [x] **配置界面**: 提供 Settings Modal，用于调节图谱物理参数（Gravity、Repulsion）与视觉偏好。
  - [x] **阅读窗口 (v0.8.0)**
    - [x] **触发方式**: 点击焦点节点打开。
    - [x] **内容渲染**: 支持 Markdown、KaTeX（数学公式）、Mermaid（图表）。
    - [x] **交互能力**: 支持文本缩放与图片尺寸调整（Unlocked 模式）。
    - [x] **窗口控制**: 支持窗口/全屏切换。
  - [x] **文档收口**: 完成 User Manual 与 Developer Guide。
  - [x] **发布打磨与演示封装**: 确保零配置启动（`npm start`）可无缝用于演示与推广。
  - [x] **发布**: 完成 v1.0.0 打包发布。

# 框架架构与设计目标

## 1. 混合可视化架构

- **桌面端 (Godot)**: 使用 Godot 4.3 + Vulkan 提供高保真 3D 渲染（粒子、Bloom、物理效果），通过 WebSocket（9876）通信。
- **Web 端 (Canvas/WebGL)**: 为 Android、浏览器与非 GPU 环境提供高性能回退路径。
- **回退策略**:
  1. 优先尝试连接 Godot WebSocket。
  2. 失败后回退到 WebGL/Canvas（Path Mode / 大图）。
  3. 小图与高交互场景再回退到 SVG。

## 2. Path Mode 体验设计

- **核心隐喻**: “轨道学习 (Orbital Learning)”。
- **中心节点**: 当前学习目标，显示为大且高亮的主气泡。
- **外围节点**: 上下文依赖，显示为较小环绕卫星。
- **进度追踪**: 已完成节点收缩为“金色星标”并进入历史列表。
- **交互模型**:
  - **双击中心节点**: 打开 Reader 查看内容。
  - **双击外围节点**: 轨道切换并提升为新中心。

## 3. UI 布局与模式切换

- **无缝切换**: 在“图谱模式 (Force/DAG)”与“Path Mode (Orbital)”之间切换时保留数据上下文，同时切换渲染引擎/Worker。
- **状态持久化**: 学习历史与已完成状态通过 `localStorage` 跨会话保存。
