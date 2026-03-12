# NoteConnection Fixrisk TODO（实时状态）

最后更新：2026-03-11

## 范围说明
本文件只保留“当前可验证”的真实风险。只有当问题具备代码修复和契约测试（或明确的运维闸门）时，才标记为 `Closed`。

## Issues（实时）
| ID | 问题 | 严重级别 | 状态 | 证据 |
| :-- | :-- | :-- | :-- | :-- |
| FR-001 | 大负载下 `readJsonBody` 的请求体内存风险 | Critical | Closed（代码） | `src/server.ts` 已采用请求体上限 + 落盘缓冲（spool）+ 运行时诊断；契约测试：`src/runtime.spool.policy.contract.test.ts`。 |
| FR-002 | Sidecar 打包器冲突（`pkg` 与 `@yao-pkg/pkg` 并存） | Critical | Closed（代码） | `package.json` 开发依赖已只保留 `@yao-pkg/pkg`；`scripts/build-sidecar.js` 固定走 `node_modules/@yao-pkg/pkg/...`。 |
| FR-003 | Capacitor 侧车回环地址策略原先不显式 | High | Closed（代码） | `capacitor.config.ts` 已显式声明 `hostname` / `cleartext` / `allowNavigation`，并由 `src/mobile.pipeline.test.ts` 进行契约校验。 |
| FR-004 | 运行时 `eval/new Function` 快照/CSP 风险 | Critical | Closed（代码） | 关键路径已通过契约门禁禁止动态 eval 回退：`src/pkg.snapshot.safety.contract.test.ts`。 |
| FR-005 | 启动参数硬编码 12GB 堆内存（`--max-old-space-size=12288`） | High | Closed（代码） | 已改为自适应堆策略 + 负载提示：`scripts/start-server.js`、`scripts/lib/runtime-memory-policy.js`；契约测试：`src/runtime.heap.policy.contract.test.ts`。 |
| FR-006 | CI/发布流程缺少可执行的 sidecar 签名闸门策略 | Medium | Closed（策略闸门） | 新增 `scripts/verify-sidecar-signatures.js`、`verify:sidecar:signatures` 脚本，接入 `.github/workflows/migration-gates.yml` 与 `.github/workflows/npm-publish.yml`，并有契约测试 `src/sidecar.signature.contract.test.ts`。 |
| FR-010 | GitHub Actions Node 20 JavaScript Action 运行时弃用告警 | Medium | Closed（流水线） | 各工作流已升级为 `actions/checkout@v5` 与 `actions/setup-node@v5`，并统一设置 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: "true"`。 |
| FR-011 | Android/Tauri 工具链可行性漂移（JDK 版本不匹配 + 本机 Rust 编译 OOM） | High | Closed（代码闸门）；Pending（主机环境） | Android 前置检查已强制 Java 21 工具链可用性（`scripts/verify-tauri-android-prereqs.js`）；Capacitor Android 构建改为仅同步 Android 平台（`build_apk.bat`）；Tauri Rust 测试改为资源感知执行器（`scripts/run-tauri-tests.js`），并输出严格/非严格诊断报告（`build/tauri-test-verification-strict.json`、`build/tauri-test-verification-nonstrict.json`）。 |
| FR-007 | Canvas 图语义对读屏不可访问 | Critical | Closed（代码） | 无障碍契约已纳入迁移测试集：`src/graph.accessibility.contract.test.ts`。 |
| FR-008 | 隐私清单合规闸门缺失 | Critical | Closed（代码） | 已具备 Privacy Manifest + 校验脚本 + 契约测试：`ios/App/PrivacyInfo.xcprivacy`、`scripts/verify-privacy-manifest.js`、`src/privacy.manifest.contract.test.ts`。 |
| FR-009 | 真机证据未强绑定“大图阈值” | High | Closed（工具）；Pending（运维证据） | 证据采集脚本已记录 workload 节点/边规模（`scripts/capture-capacitor-device-evidence.js`），校验脚本支持严格大图门槛（`scripts/verify-capacitor-evidence-freshness.js`），契约测试：`src/capacitor.evidence.contract.test.ts`。仍需实际真机采集。 |

## 当前剩余阻塞（运维侧）
当前仅剩运维证据闭环，不是代码缺陷：

1. 在真机上采集 workload >= `10,000` 节点且 >= `1,000,000` 边的验收证据。
2. 启用严格大图证据校验：
   - `NOTE_CONNECTION_REQUIRE_LARGE_GRAPH_EVIDENCE=1`
   - `NOTE_CONNECTION_MIN_EVIDENCE_NODE_COUNT=10000`
   - `NOTE_CONNECTION_MIN_EVIDENCE_EDGE_COUNT=1000000`
3. 在用于 Android 构建的主机/CI 上提供 Java 21 工具链（当前主机仅检测到 JDK 23）。
4. 严格模式下的 Tauri Rust 编译建议使用更高内存预算主机；或仅在受控 CI 资源中执行 strict 闸门。

## 基线验证命令
```bash
node scripts/verify-detox-pipeline.js
node scripts/verify-privacy-manifest.js
node scripts/verify-sidecar-signatures.js --contract-only
node scripts/verify-fixrisk-issues.js
node scripts/verify-fixrisk-issues.js --strict-pending
node node_modules/typescript/bin/tsc --noEmit
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run test:migration
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run test:gates
node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run test:tauri
```

## 最佳实践合规检查
| 领域 | 状态 | 说明 |
| :-- | :--: | :-- |
| 数据传输防护 | ✅ | 请求体落盘策略 + Bridge 入站限额均为自适应。 |
| Sidecar 打包一致性 | ✅ | 已统一为 `@yao-pkg/pkg`。 |
| Capacitor 回环策略清晰度 | ✅ | `capacitor.config.ts` 已显式声明。 |
| 运行时安全（禁用 eval 回退） | ✅ | 契约门禁覆盖。 |
| 大图内存策略 | ✅ | 自适应堆策略并含主机预算夹紧。 |
| 移动端 E2E/契约基线 | ✅ | Detox + Privacy + Mobile pipeline 校验已接入。 |
| 无障碍契约 | ✅ | 已纳入迁移测试集。 |
| 发布签名策略闸门 | ✅ | 签名校验脚本与 CI 契约接线已落地。 |
| Android/Tauri 工具链护栏 | ⚠️ | 护栏已落地；当前主机仍需补齐 Java 21 工具链，并为 strict Tauri Rust 编译预留稳定内存预算。 |
| 真机大图证据 | ⚠️ | 工具链已完成；仍需采集真实设备证据。 |

diff --git a/e:\Knowledge_project\NoteConnection_app\docs\zh\fixrisk_TODO.md b/e:\Knowledge_project\NoteConnection_app\docs\zh\fixrisk_TODO.md
deleted file mode 100644
--- a/e:\Knowledge_project\NoteConnection_app\docs\zh\fixrisk_TODO.md
+++ /dev/null
@@ -1,311 +0,0 @@
-# NoteConnection 混合架构与安全审计报告 (2026-03)
-
-## 执行摘要
-
-**混合架构最终裁定：** NoteConnection 展示了令人瞩目的边缘计算混合愿景，有效地将 Godot Vulkan 渲染与 Capacitor 8.2+ 移动端外壳和基于 `@yao-pkg/pkg` 打包的 Node.js 侧车（Sidecar）相结合。然而，其生产环境就绪度受到严重阻碍，在数据序列化限制、运行时求值（eval/new Function）违规以及次优的内存分配策略等方面存在致命瓶颈，这些风险直接威胁到 App Store 的合规上架以及长期的大规模扩展性。
-
-### 生产环境就绪度记分卡
-
-| 维度 | 风险区域 | 评分 (1-10) | 状态 | 核心瓶颈 |
-| :--- | :--- | :---: | :--- | :--- |
-| **1. 数据传输链** | 混合 IPC 链路 | 5/10 | ⚠️ 存在风险 | 解析 >5000 个节点时 `JSON.parse` 阻塞，WebView 有 OOM 风险。 |
-| **2. Pkg 分发策略** | Sidecar 二进制文件 | 4/10 | ❌ 致命危险 | `new Function`/动态 `require` 绕过快照安全机制。 |
-| **3. Capacitor 混合层** | 移动端插件 | 7/10 | ✅ 勉强合格 | 存在 CSP 限制和后台执行限制。 |
-| **4. 代码严格性** | 静态分析 | 3/10 | ❌ 致命危险 | 依赖冲突严重 (`pkg` 混用 `@yao-pkg/pkg`)。 |
-| **5. 性能与资源** | 资源管理 | 4/10 | ❌ 致命危险 | 过于宽泛的堆内存配置 (12GB) 导致移动端瞬间 OOM。 |
-| **6. 测试与 CI/CD** | 流水线质量门 | 6/10 | ✅ 勉强合格 | 缺乏深度的原生端到端矩阵执行 (Detox 测试纯原生层)。 |
-| **7. 可访问性** | UX 与无障碍 (A11y) | 4/10 | ❌ 致命危险 | Canvas 渲染完全阻断了屏幕阅读器对图谱语义的获取。 |
-| **8. 安全与合规** | 安全/法规 | 4/10 | ❌ 致命危险 | 缺失完整的隐私清单（Privacy Manifest），面临商店拒审威胁。 |
-
----
-
-## 第一部分：端到端混合数据传输链路微观审查
-
-**定量瓶颈分析：** 通过 WebSocket/HTTP 混合桥接传输 1GB+ 的负载时，同步的 `JSON.parse` 阻塞主线程超过 3,000 毫秒。移动设备经历巨大的电池消耗（在持续数据同步 10 分钟内电量下降可达 12%）。
-
-```mermaid
-flowchart TD
-    subgraph 数据流架构
-    A[本地文件系统 / IndexedDB] -->|分块读取 (Stream)| B(Node 22 Sidecar 工作线程)
-    B -->|序列化的 JSON / Brotli 压缩| C{连接桥 IPC}
-    C -->|WebSocket 端口 9876| D[Godot Vulkan 渲染引擎]
-    C -->|HTTP REST 端口 3000| E[Capacitor WebView 桥接]
-    E -->|JSON.parse 阻塞队列| F[Canvas / WebGL 降级渲染]
-    F --> G[终端用户设备屏幕]
-    end
-    style B fill:#f9f,stroke:#333,stroke-width:2px
-    style C fill:#bbf,stroke:#333,stroke-width:2px
-    style E fill:#fcc,stroke:#333,stroke-width:2px
-```
-
-### 关键问题表 (表 1/6)
-| 严重程度 | 文件 : 行号 | 问题描述 | 复现 CLI 命令 | 跨工具影响 | 商店拒审风险 |
-| :--- | :--- | :--- | :--- | :--- | :--- |
-| **致命 (CRITICAL)** | `src/server.ts:458` | `readJsonBody` 期间发生内存缓冲耗尽。 | `curl -X POST -d @huge.json localhost:3000` | 导致 Node 进程崩溃，使 Capacitor 彻底卡死。 | App 崩溃（被拒） |
-
----
-
-## 第二部分：多平台分发与 PKG (Sidecar) 打包策略审计
-
-**定量瓶颈分析：** 最终二进制文件大小为 50MB+，但解包虚拟文件系统资产时内存占用峰值飙升至 >500MB。打包后的垃圾回收（GC）行为极度不稳定。
-
-```mermaid
-sequenceDiagram
-    autonumber
-    title 打包流水线 (Packaging Pipeline)
-    participant CI as GitHub Actions
-    participant P as @yao-pkg/pkg
-    participant VFS as 虚拟快照文件系统 (VFS)
-    participant EXE as 输出二进制文件
-
-    CI->>P: 执行构建目标 (node22-linux/win/mac)
-    P->>VFS: AST 静态分析与 Tree Shaking
-    Note over P,VFS: 动态导入触发严重警告
-    VFS-->>P: 打包所需资产
-    P->>EXE: 嵌入 V8 字节码 & Brotli 压缩资产
-    EXE->>CI: 输出包含 Node 环境的独立服务端
-```
-
-### 关键问题表 (表 2/6)
-| 严重程度 | 文件 : 行号 | 问题描述 | 复现 CLI 命令 | 跨工具影响 | 商店拒审风险 |
-| :--- | :--- | :--- | :--- | :--- | :--- |
-| **致命 (CRITICAL)** | `package.json:15` | `pkg` 和 `@yao-pkg/pkg` 定义存在严重冲突。 | `npm run build:sidecar` | 强制降级回旧版 Vercel pkg，限制了 Node 22 的兼容性。 | 导致执行失败 |
-
----
-
-## 第三部分：Capacitor 8.2+ 混合层集成审计
-
-**定量瓶颈分析：** 在 1 万个并发节点下，Capacitor WebView 桥接传递字符串的效率极低。CPU 性能分析显示高达 60% 的时间耗费在 `bridge.postMessage` 序列化上。
-
-```mermaid
-architecture-beta
-    title Monorepo 单体仓库架构
-    group root(NoteConnection 工作区)
-    group app(Capacitor 混合 App) in root
-    service web(WebView DOM 上下文) in app
-    service native(原生 Swift/Kotlin 层) in app
-    group sidecar(Pkg 后端) in root
-    service node(Node.js 22 引擎) in sidecar
-    service db(本地 SQLite/JSON) in sidecar
-    
-    web:right:native
-    native:bottom:node
-    node:right:db
-```
-
-### 关键问题表 (表 3/6)
-| 严重程度 | 文件 : 行号 | 问题描述 | 复现 CLI 命令 | 跨工具影响 | 商店拒审风险 |
-| :--- | :--- | :--- | :--- | :--- | :--- |
-| **高 (HIGH)** | `capacitor.config.ts:8` | 侧车 IPC 缺失确切的服务器 IP 绑定配置。 | `npx cap run android` | 在严格 Android 权限下本地网络连接会被直接拒绝。 | 本地网络权限被拒 |
-
----
-
-## 第四部分：代码质量、语法严格性与可维护性审查
-
-**定量瓶颈分析：** 异步网络调用周边缺失 35 处以上的 `try/catch` 异常捕获块，导致出现未处理的 Promise 拒绝（Unhandled Promise Rejections），永久性地搞崩 Sidecar 的事件循环。
-
-```mermaid
-gantt
-    title 重构概览 (8周路线图)
-    dateFormat YYYY-MM-DD
-    section 阶段 1: 安全清理
-    移除 eval/new Function      :active, a1, 2026-03-12, 7d
-    依赖项冲突清理               :a2, after a1, 7d
-    section 阶段 2: 性能调优
-    迁移至 Uint8Array 二进制传输 :a3, after a2, 14d
-    设置动态内存上限护栏          :a4, after a3, 7d
-    section 阶段 3: CI/CD
-    Detox & A11y 自动化测试      :a5, after a4, 14d
-    确认最终隐私合规清单          :a6, after a5, 7d
-```
-
-### 关键问题表 (表 4/6)
-| 严重程度 | 文件 : 行号 | 问题描述 | 复现 CLI 命令 | 跨工具影响 | 商店拒审风险 |
-| :--- | :--- | :--- | :--- | :--- | :--- |
-| **致命 (CRITICAL)** | `src/reader_renderer.ts:15` | 使用 `new Function` 动态导入文件严重违反内容安全策略 (CSP)。 | `grep -r "new Function" src/` | 严重违反 iOS App Store 审核指南 2.5.2。 | **瞬间秒拒审** |
-
----
-
-## 第五部分：性能剖析、可扩展性与资源管理审查
-
-**定量瓶颈分析：** `--max-old-space-size=12288`（12GB）的强制启动标志，在仅有 4GB 内存的普通 iOS 设备上会直接触发系统级 OOM 杀手。
-
-```mermaid
-flowchart LR
-    subgraph 性能调用图 (Performance Call Graph)
-    A[用户发起请求] --> B{Node 事件循环}
-    B -->|巨大图谱载荷| C[V8 堆内存分配]
-    C -->|超过 1GB| D[同步垃圾回收 (GC) 停顿]
-    D -->|触发 OOM 警戒线| E[操作系统强杀进程 (SIGKILL)]
-    C -->|内存充足| F[Bridge 跨端传输数据]
-    end
-```
-
-### 关键问题表 (表 5/6)
-| 严重程度 | 文件 : 行号 | 问题描述 | 复现 CLI 命令 | 跨工具影响 | 商店拒审风险 |
-| :--- | :--- | :--- | :--- | :--- | :--- |
-| **高 (HIGH)** | `package.json:10` | 写死 12GB 堆内存上限对移动端部署是致命的。 | `node --max-old-space-size=12288 src/server.ts` | 凌驾于系统限制之上，导致系统层强杀应用。 | 极高的崩溃率 |
-
----
-
-## 第六部分：测试覆盖率、质量门与 CI/CD 流水线审查
-
-**定量瓶颈分析：** IPC 桥接代码的测试覆盖率低于 90%。缺乏真实的端到端矩阵环境（没有在打包后的二进制文件配合 Capacitor Swift 上同时运行 E2E）。
-
-```mermaid
-flowchart TD
-    subgraph CI/CD 矩阵执行
-    A[Git Push 事件] --> B[Lint/TSC 严格静态检查]
-    B --> C{多平台执行矩阵}
-    C -->|Ubuntu| D[pkg linux-x64]
-    C -->|Windows| E[pkg win-x64]
-    C -->|macOS| F[pkg macos-arm64]
-    D & E & F --> G[Playwright 桌面端 E2E 验证]
-    F --> H[xcodebuild / fastlane]
-    H --> I[Detox iOS 移动端 E2E 测试]
-    I --> J[构建质量门验证]
-    end
-```
-
-### 关键问题表 (表 6/6)
-| 严重程度 | 文件 : 行号 | 问题描述 | 复现 CLI 命令 | 跨工具影响 | 商店拒审风险 |
-| :--- | :--- | :--- | :--- | :--- | :--- |
-| **中 (MEDIUM)** | `.github/workflows/main.yml` | 缺失签名二进制质量门控。 | `codesign -v --strict output.exe` | macOS Gatekeeper 将直接拦截 Sidecar 的执行。 | 用户被系统拦截 |
-
----
-
-## 第七部分：可访问性、国际化与用户体验审查
-
-**定量瓶颈分析：** 在 Canvas 图谱渲染容器内，WCAG 2.2 / ARIA 合规性为 0%。VoiceOver 根本读不出任何元素内容。
-
-```mermaid
-flowchart TD
-    subgraph 可访问性数据流 (A11y Flow)
-    A[Canvas 节点渲染层] --> B{ARIA 影子 DOM 映射层}
-    B -->|同步真实坐标| C[隐藏的 HTML div 元素阵列]
-    C -->|焦点触发事件| D[屏幕阅读器 (VoiceOver)]
-    D -->|转换为语音输出| E[盲人/弱视用户]
-    end
-```
-
----
-
-## 第八部分：依赖供应链安全、合规与法律审查
-
-**定量瓶颈分析：** 依赖库版本未严格锁定（Unpinned），缺失 SBOM。由于 Privacy Manifest 没有自动化生成逻辑，每次发版都将面临因权限声明缺失而被拒的风险。
-
-```mermaid
-flowchart LR
-    subgraph 威胁模型 (STRIDE 分析)
-    A[恶意构建的图谱载荷] -->|Spoofing 欺骗| B[IPC 通信桥接]
-    B -->|Tampering 篡改| C[Node.js Sidecar 引擎]
-    C -->|Information Disclosure 泄露| D[本地文件系统越权访问]
-    D -->|Denial of Service 拒绝服务| E[OOM 内存耗尽攻击]
-    end
-```
-
----
-
-## 修复前/修复后 代码差异 (Top 5 核心致命问题)
-
-**1. 彻底移除动态的 `new Function` (src/reader_renderer.ts)**
-```diff
-- const dynamicImport = new Function('specifier', 'return import(specifier);') as (specifier: string) => Promise<any>;
-+ const dynamicImport = (specifier: string) => import(specifier);
-```
-
-**2. 修复危险的内存限制 (package.json / scripts)**
-```diff
-- "start": "node --max-old-space-size=12288 src/server.ts"
-+ "start": "node --max-old-space-size=1024 src/server.ts"
-```
-
-**3. 修复 Pkg 依赖包冲突 (package.json)**
-```diff
-- "pkg": "^5.8.1",
-- "@yao-pkg/pkg": "^6.14.1"
-+ "@yao-pkg/pkg": "^6.14.1"
-```
-
-**4. 补充 IPC 中的 try/catch 异常捕获 (src/server.ts)**
-```diff
-- const data = await fs.promises.readFile(path);
-+ let data;
-+ try { data = await fs.promises.readFile(path); } catch(e) { throw new Error('FS Read fail'); }
-```
-
-**5. 修复同步阻塞的 JSON 解析 (src/server.ts)**
-```diff
-- const body = JSON.parse(await getRawBody(req));
-+ const body = await streamJsonParse(req); // 需集成 stream-json 支持
-```
-
----
-
-## 推荐重构执行路线图 (CLI 命令)
-
-请按顺序直接复制粘贴以下命令以执行第一阶段的重构清理工作：
-```bash
-# 1. 清理脏依赖并消除 pkg 冲突
-npm uninstall pkg
-npm install @yao-pkg/pkg@latest --save-dev
-npm audit fix --force
-
-# 2. 同步电容运行时
-npx cap sync
-
-# 3. 限制安全内存并带有 brotli 压缩的侧车打包命令
-NODE_OPTIONS="--max-old-space-size=16384" npx @yao-pkg/pkg . --targets node22-win-x64,node22-linux-x64,node22-macos-arm64 --compress Brotli --public-packages "*"
-
-# 4. 通过 Fastlane 自动生成 iOS 隐私清单 (需环境支持)
-fastlane ios build
-```
-
----
-
-## 自动化扫描防护命令
-
-请在 CI/CD 流水线中常态化运行以下防护层：
-```bash
-# 静态分析 / Linting (零警告政策)
-npx eslint src/ --ext .ts --max-warnings=0
-
-# 安全审计 (阻断高/严重级别漏洞)
-npm audit --audit-level=high
-
-# 自动原生端到端测试矩阵 (Detox)
-npx detox test -c ios.sim.release
-npx detox test -c android.emu.release
-
-# 性能剖析 / 火焰图分析 (Flamegraph)
-node --prof src/server.ts && node --prof-process isolate-0x*-v8.log > flamegraph.txt
-```
-
----
-
-## 最佳实践合规性检查清单
-
-| 审计章节 | 状态 | 补救修正指令 (Remediation Command) |
-| :--- | :---: | :--- |
-| **1. 数据传输** | ❌ | `npm i stream-json && npm i -D @types/stream-json` |
-| **2. Pkg 分发** | ❌ | `npm uninstall pkg && npm run build:sidecar` |
-| **3. Capacitor 层** | ✅ | 目前配置可用，暂无需处理。 |
-| **4. 代码质量** | ❌ | `npx eslint src/ --fix` |
-| **5. 性能与资源** | ❌ | `sed -i '' 's/12288/1024/g' package.json` |
-| **6. 测试与 CI/CD** | ❌ | `npm install detox detox-cli --save-dev` |
-| **7. 无障碍 (A11y)** | ❌ | 必须为 Canvas 图表建立 ARIA shadow DOM 映射。 |
-| **8. 安全合规** | ❌ | 生成 `PrivacyInfo.xcprivacy` 并实现二进制强签名。 |
-
----
-
-## 未来可扩展性战略建议 (Future-Proofing Recommendations)
-
-1. **全面向 Node.js SEA 迁移：** `@yao-pkg/pkg` 是当下的拐杖解决方案。随着 Node 22 原生提供 Single Executable Application (SEA) 能力，转向 SEA 能够彻底根除第三方打包器对 AST 动态依赖路径支持不佳的顽疾。
-2. **Capacitor 9 演进策略：** 提前为 Capacitor 9 即将主推的 WASM-native 多线程模型做技术储备。该模型最终将废除并替代现有的 WebSocket IPC 桥接层，转为使用直接的 JSI/WASM 共享内存交互。
-3. **统一 Monorepo 构建流水线：** 建议将 `scripts/build-sidecar.js` 与 `scripts/run-tauri-android.js` 统一收敛至 Nx 或 Turborepo 流水线进行编排，以保障各端缓存一致性与版本同步。
-
----
-**缺失材料与假设说明：**
-- **假设前提：** 后端引擎版本强制锁定为 Node.js `22.x`。
-- **假设前提：** iOS 目标系统版本为 `17.0+`（支持强管控的本地网络隐私策略）。
-- **缺失材料：** 需要获取 Android 真机在加载 10,000+ 节点图谱时的详细 V8 堆内存快照文件 (`.heapsnapshot`) 以进行微观优化。
