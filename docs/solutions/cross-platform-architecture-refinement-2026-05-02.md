---
module: architecture
tags: [cross-platform, refactoring, code-health, compatibility, roadmap]
problem_type: architectural-debt
created: 2026-05-02
status: proposed
---

# 跨平台架构优化与代码健康度改进方案

## 元信息

本方案是两轮深度分析的交叉对比与提炼成果：

- **第一轮**（2026-05-02）：代码架构分析 — 聚焦于项目结构、单体文件问题、领域逻辑分离度、文档完整性
- **第二轮**（2026-05-02）：跨平台兼容性分析 — 聚焦于 Linux/macOS/Windows/Android 四平台的兼容性差距和侧车部署风险

两轮分析交叉验证后，提炼出统一的分阶段实施方案。

---

## 一、两个分析维度的交叉对比

### 1.1 代码单体 vs 平台脆弱性：重叠区

代码架构问题与跨平台脆弱性之间存在着直接因果关系：

| 代码架构问题 | 导致的跨平台脆弱性 | 因果链 |
|---|---|---|
| `server.ts` 16,848 行单体，路由内联 | 平台相关路径、CORS、sidecar 逻辑混在一起，新增平台支持需要遍历巨型函数定位修改点 | 低内聚 → 高修改风险 |
| `RuntimePaths.ts` 不区分 macOS/Linux 路径约定 | macOS `~/Library/Application Support` 未处理，Linux XDG 未遵循，所有 Unix 回退到 `~/.noteconnection` | 平台无感知 → 路径污染 |
| Tauri 仅 `tauri.android.conf.json` 一个平台专属配置 | Linux `asset://localhost` 403、macOS arm64 签名、Windows sidecar 缺失均无平台专属处理 | 配置单一 → 平台差异未编码 |
| 前端无模块系统 (`window.*` 全局) | `runtime_bridge.js` 假设 Tauri IPC 始终可用，移动端 Capacitor fallback 通过全局变量探测 | 隐式依赖 → 运行时探测脆弱 |
| Godot 使用 GL Compatibility 渲染器 | Wayland 纯合成器上 GL 上下文丢失导致 SIGSEGV | 未选择跨平台最优渲染后端 |

### 1.2 两个维度各自的独立问题

| 维度 | 独立于另一维度的问题 |
|---|---|
| **代码架构** | `KnowledgeLearningPlatform.ts` 13,370 行单体类、`path_app.js` 15,140 行全局对象、前端无打包工具、测试文件过大 (6,500+ 行) |
| **跨平台** | Wayland + GTK + Godot 事件循环架构冲突、Android 系统 WebView 碎片化、`@yao-pkg/pkg` 交叉编译字节码损坏、macOS arm64 强制代码签名 |

### 1.3 交叉验证后的优先级调整

单纯从代码架构角度，P1 是拆分单体文件。但跨平台分析揭示了更紧迫的 **阻塞级** 问题：Linux 用户无法正常加载资源 (403)、Windows 用户缺少 sidecar 二进制、macOS arm64 用户 sidecar 因未签名被内核杀死。这些是**用户可见的崩溃**，优先级应高于代码内部分解。

**调整后的优先级**：平台可用性 > 代码单体拆分 > 文档完善 > 移动端统一

---

## 二、精炼后的统一实施方案

### 阶段 A：平台可用性修复（目标：三桌面平台均可成功启动并运行 Path Mode）

| # | 行动 | 类型 | 影响平台 | 与代码架构的关联 |
|---|---|---|---|---|
| A1 | 创建 `src-tauri/tauri.linux.conf.json`，配置 `assetProtocol.scope` 包含 `$CACHE/**`、`$CONFIG/**`、`$DATA/**` 及隐藏目录通配 | 配置 | Linux | 不涉及代码变更 |
| A2 | 创建 `src/utils/platform.ts`，提供 `getPlatform()`、`getAppDataDir()`、`getConfigDir()`，遵循 macOS Library / Linux XDG / Windows LOCALAPPDATA | 新模块 | Linux + macOS | 替代 `RuntimePaths.ts` 中的隐式 fallback（`process.platform === 'win32'` 一行判断） |
| A3 | 修复 `RuntimePaths.ts`，调用 `platform.ts` 获取正确的平台路径（`~/Library/Application Support/NoteConnection` on macOS, `$XDG_DATA_HOME/NoteConnection` on Linux) | 重构 | Linux + macOS | 消除 `RuntimePaths.ts` 的平台无知 |
| A4 | Godot `project.godot` 渲染器从 `GL Compatibility` 切换到 `Forward+`，同时在启动参数中添加 `--rendering-driver opengl3` 作为 fallback | 配置 + 脚本 | Linux (Wayland) | 不涉及核心代码 |
| A5 | server.ts 中添加 Godot 启动前的 `GDK_BACKEND=x11` 环境变量设置（作为 Wayland fallback） | 平台适配 | Linux | 在 server.ts 的 Godot sidecar 启动逻辑中新增约 10 行平台判断 |
| A6 | 创建 `src-tauri/tauri.macos.conf.json` 和 `src-tauri/tauri.windows.conf.json`，声明各平台的 `externalBin` + `target-triple` | 配置 | macOS + Windows | 不涉及代码变更 |
| A7 | 更新 `scripts/build-sidecar.js`，添加 `--no-bytecode --public-packages "*" --public` 参数 | 构建 | 全部 | 不涉及业务代码 |
| A8 | 更新 `README.md`：添加各平台系统依赖表（Linux: `libwebkit2gtk-4.1`, `libsoup3`; Windows: WebView2 运行时; macOS: 无额外依赖） | 文档 | 全部 | 不涉及代码 |

### 阶段 B：代码单体拆分（目标：核心模块可独立测试、独立部署、独立替换）

| # | 行动 | 类型 | 关联的跨平台收益 |
|---|---|---|---|
| B1 | 提取 server.ts 路由为 `src/routes/knowledge.ts`、`src/routes/notemd.ts`、`src/routes/markdown.ts`、`src/routes/render.ts`、`src/routes/settings.ts`、`src/routes/diagnostics.ts` | 模块化 | 平台相关路由（如 sidecar 管理、路径解析）可独立维护 |
| B2 | 提取公共中间件（CORS、认证、请求追踪、body 解析）为 `src/middleware/` | 模块化 | 平台差异中间件集中管理（如 Linux CSP 例外处理） |
| B3 | 拆分 `KnowledgeLearningPlatform.ts` 为 6-8 个领域类：`KnowledgeIngestor`、`KnowledgeQuerier`、`ConversationManager`、`StudySessionOrchestrator`、`QualityEvaluator`、`TutorRouter`、`MemoryPolicyManager`、`StalenessManager` | 领域分离 | 无直接关联 |
| B4 | 前端迁移到 ES modules + Vite 打包，消除 `window.*` 全局变量依赖链 | 模块化 | `runtime_bridge.js` 的平台探测改为显式依赖注入 |
| B5 | 拆分 `path_app.js` 为：`path_renderer.js`、`path_state.js`、`workbench.js`、`worker_bridge.js` | 模块化 | 学习工作台与路径渲染解耦，各平台可独立优化渲染路径 |
| B6 | 提取 `src/shared/` 共享类型包（将 `learning/api.ts` 和 `learning/types.ts` 提升为前后端共享的类型契约） | 架构升级 | 平台间 API 契约一致，减少序列化/反序列化 bug |

### 阶段 C：文档完善 + 移动端统一（目标：可持续维护的文档体系和单一移动端构建路径）

| # | 行动 | 类型 |
|---|---|---|
| C1 | 放弃 Capacitor 构建路径，统一为 Tauri Android（保留 `android/` 目录作为历史参考） | 架构简化 |
| C2 | 记录 Tauri Android ProGuard/R8 keep 规则到 `docs/diataxis/en/how-to/android-release-build.md` | 文档 |
| C3 | 恢复或重新创建 `docs/release_notes_v1.6.6.md`（AGENTS.md 指定的质量基准） | 文档 |
| C4 | 更新 `BILINGUAL_INDEX.md`，补充 `docs_release_and_rollback.md` 和 `knowledge_mastery_evolution_plan.md` | 文档 |
| C5 | 翻译 `docs/en/analysis_ref.md` 为中文，更新过时的 Electron 引用 | 文档 |
| C6 | 扩展 `docs/diataxis/en/explanation/architecture-and-migration.md` 从 24 行到 200+ 行 | 文档 |
| C7 | brainstorms/ 和 solutions/ 目录中文化 | 文档 |
| C8 | 归档 `docs/en/TODO.md` (233KB) 和 `docs/zh/TODO.md` (214KB) 为 GitHub Issues 或移出 docs 树 | 文档 |

---

## 三、风险矩阵

| 风险 | 概率 | 影响 | 缓解措施 |
|---|---|---|---|
| 拆分 server.ts 引入路由注册顺序 bug | 中 | 中 | 保留旧 server.ts 作为集成测试基准，新旧并行验证 |
| Godot Forward+ 渲染器在旧 GPU 上不兼容 | 低 | 高 | 保留 GL Compatibility 作为 `--rendering-driver opengl3` fallback |
| `--no-bytecode` 暴露 Node.js 源码 | 中 | 低 | NoteConnection 为 GPL-3.0 开源项目，源码本就可获取 |
| Tauri Android 替代 Capacitor 引入回归 | 中 | 中 | 保留 Capacitor 构建脚本为只读参考，分阶段迁移 |
| ES modules 迁移破坏 Worker 加载路径 | 中 | 中 | Vite 的 Web Worker 导入语法 (`new Worker(new URL(...))`) 可替代当前字符串路径 |

---

## 四、关于 Windows Sidecar 的说明

`src-tauri/bin/` 中确实缺少 `server-x86_64-pc-windows-msvc.exe` 和 `godot-x86_64-pc-windows-msvc.exe`。经确认这是由于 Git LFS 配额耗尽而有意删除的——Windows 用户需要在本地运行 `npm run build:sidecar` 自行构建。

**当前方案的改进建议**：
- 在 `README.md` 的「Windows 安装」部分明确记录此步骤
- 在 `scripts/build-sidecar.js` 中添加 Windows 目标三元组
- 考虑在 CI `release-desktop-multi-os.yml` 的 Windows runner 上构建 sidecar 并上传为 Release Artifact（而非通过 Git LFS 追踪）
- 短期兜底：在 server.ts 的 sidecar 启动逻辑中，当检测到 Windows 平台但缺少 sidecar 时，输出清晰的终端提示信息（而非静默崩溃）

Git LFS 配额问题在 Godot 二进制（通常 50-100MB）上尤其严重，最佳实践是将 CI 构建产物作为 GitHub Release 附件分发，而非通过 Git LFS 追踪大文件。

---

## 五、成功标准

每个阶段完成后的验收条件：

### 阶段 A 完成标准
- [ ] Linux (Ubuntu 24.04 / Fedora 40): 桌面应用正常启动、WebView 加载无 403、Path Mode 进入无崩溃
- [ ] macOS (arm64): 应用启动、sidecar 签名有效、Path Mode 可用
- [ ] Windows (11): `npm run build:sidecar` 成功生成 exe、应用启动、Path Mode 窗口切换正常
- [ ] `npm run verify:agent-workspace:tauri:rust:strict` 通过（已配置 Linux 系统依赖）

### 阶段 B 完成标准
- [ ] `src/server.ts` 从 16,848 行缩减到 <3,000 行（仅保留服务器启动和路由注册）
- [ ] 每个提取的路由文件 <500 行
- [ ] 前端 Vite 构建成功，所有 Worker 加载路径正确
- [ ] 现有 85 个测试文件全部通过
- [ ] `KnowledgeLearningPlatform` 拆分为 8 个独立类文件，每个 <2,000 行

### 阶段 C 完成标准
- [ ] 中英双语文档覆盖率达到 100%（diataxis 页面全对称 + brainstorms + solutions 中文化）
- [ ] `BILINGUAL_INDEX.md` 统计数据与 `find docs -name "*.md" | wc -l` 一致
- [ ] Android APK 可通过单一构建命令生成 (`npm run tauri:android:build`)
- [ ] `docs/en/TODO.md` 和 `docs/zh/TODO.md` 归档完成

---

## 六、关联文档

- [开发进度仪表板](../diataxis/en/explanation/development-progress-dashboard.md)
- [知识掌握演进路线图](../diataxis/en/explanation/knowledge-mastery-evolution-roadmap.md)
- [架构与迁移说明](../diataxis/en/explanation/architecture-and-migration.md)
- [Agent 对话 + 聚焦模式交付计划](../diataxis/en/explanation/agent-conversation-focus-mode-plan.md)
- [参考项目 GitNexus 分析](../../ref/GitNexus/README.md)
