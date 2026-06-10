
### Legacy Navigation Row (from shared bilingual table)
|  **中文**   |   [核心特性](#key-features-zh)   | [硬件配置](#hardware-zh) |   [系统架构](#architecture-zh)   |  [快速开始](#quick-start-zh)   | [CLI](#cli-zh) | [更新日志](#changelog-zh)  |

# 2026-04-07 v1.7.0
# NoteConnection: 层级知识图谱可视化系统

<img width="606" height="309" alt="banner" src="https://github.com/user-attachments/assets/92e90de5-2b1a-4398-8e8b-6e142c92b6a2" />

---

---
> **解锁你知识库的深层结构。**

**NoteConnection** 是一个高性能的独立可视化系统，旨在将非结构化的 Markdown 知识库转化为**有向无环图 (DAG)**。

与展示杂乱链接网的传统“网络”视图不同，NoteConnection 揭示了隐藏在笔记中的**层级关系**、**学习路径**和**依赖结构**。它专为可扩展性而设计，能够轻松处理数万个节点，并且完全独立于任何特定的笔记应用程序运行。

<img width="2784" height="2034" alt="image" src="https://github.com/user-attachments/assets/0ea42609-4296-42ea-978d-c6cb7d448068" />
<img width="3543" height="2159" alt="image" src="https://github.com/user-attachments/assets/0b2d80f5-ec8c-4ac1-9607-b925d4ab5f82" />

---

## 当前主线架构状态（2026-06-10）

- 当前 `main` 已具备代码支撑的 scoped retrieval、grounded conversation、持久化 resource/index/workspace/session/memory/export 底座、显式 export profiles，以及 Godot/mobile PNG-first 渲染物化边界。
- 知识工作区现在除了工作区内 scope 切换器、conversation API 状态条、按文件优先的 grouped knowledge hit 与 focus pane 中的 matched-span 高亮之外，还已经具备 durable workflow artifact：`flashcard_batch` 与 `knowledge_run`。
- agent conversation 运行时已经不再只是单一回答字符串：`answer`、`assistantBlocks`、`knowledgeRun`、按文档聚合的 `knowledgePoints`、citations、memory actions 与 trace 已进入当前兼容性表面，同时保留 legacy `assistantMessage`。
- 现有 DAG 学习底座是真实存在的：`KnowledgeAtom`、`RelationEdge`、`TemporalEdge`、path query、mastery-path/session 逻辑以及 `KnowledgeQueryItem.relationPath` 都已落地。真正剩余的缺口不是“有没有图”，而是“回答规划层还没有 dedicated graph-conditioned context layer”。
- graphdb/sqlite 与 ANN/external connector 仍是 operational baseline。生产闭环仍需要多轮 soak 证据、工作负载阈值、recall/latency 校准、strict rollout proof 与多宿主证据。
- 当前 release-evidence 审计面已由 `verify:foundation:release-evidence`、`verify:foundation:release-evidence:strict` 与 `verify:foundation:release-evidence:multi-host` 统一。
- 下一阶段架构工作仍是缩减 `src/server.ts`、`src/learning/KnowledgeLearningPlatform.ts`、`src/frontend/agent_workspace.js` 与 `src/frontend/workspace_panes.js` 的所有权压力。
- 当前代码 / 方案详细对齐请查看 [知识工作区与 DAG 对齐推进方案（2026-06-10）](../solutions/knowledge-workspace-dag-alignment-2026-06-10.md)、[架构推进对齐与主线推进方案（2026-06-06）](../solutions/architecture-progress-alignment-2026-06-06.md) 与 [开发进度看板](../diataxis/zh/explanation/development-progress-dashboard.md)。

---

<a id="key-features-zh"></a>

## 🚀 核心特性

### 1. 可视化与布局

- **结构优于混沌**: 在 **力导向 (Force-Directed)** 和 **DAG (层级)** 布局之间切换。DAG 布局自动识别“先决条件”和“后续步骤”，将概念按逻辑分层排列。
- **双渲染引擎 (v0.8.7)**: 无缝切换 **SVG** (用于交互) 和 **Canvas** (用于 10,000+ 节点的高性能渲染)。
- **交互式专注模式**: 点击任意节点以隔离它及其上下文。包含 **选中冻结** (v0.8.9) 以防止漂移，可调节的 **垂直/水平间距** (v0.8.8)，以及退出后完美的视觉状态恢复 (v1.0.0)。
- **完全离线化支持 (v1.0.0)**: 所有关键库依赖（D3, KaTeX, Marked, Mermaid 等）均已本地化，确保 100% 离线可用性。

<img width="3404" height="2028" alt="image" src="https://github.com/user-attachments/assets/39ea71da-be14-4fdc-9fec-9f33cab92e1b" />

### 2. 智能与推断

- **混合推断引擎**: 结合 **统计概率** ($P(A|B)$) 和 **向量相似度** (TF-IDF) 推断隐藏的依赖关系（例如，“荧光”隐含“光子”），无需外部 AI API。
- **可扩展聚类**: 基于文件夹结构或标签，将数千个节点聚合为高级“概念气泡”，提供清晰的概览。

<img width="3723" height="2007" alt="image" src="https://github.com/user-attachments/assets/10978984-3e2d-4ab6-8b44-342d4f3c3800" />

### 3. Path Mode (路径模式): 结构化学习 (v1.2.0)

- **课程生成**: 将复杂的网状图瞬间转化为线性的学习路径。
  - **领域学习 (Domain Learning)**: 掌握整个概念集群（拓扑排序）。
  - **扩散学习 (Diffusion Learning)**: 寻找通往特定目标的最优路径（最短路径 + 前置依赖）。
- **混合架构**: 通过 WebSocket (`ws://localhost:9876`) 连接到高保真 **Godot 4.3 桌面渲染器**，实现 3A 级的可视化效果，同时保持完全的 Web 兼容性。
- **智能策略**: 支持 "基础优先" (Foundational) 或 "核心优先" (Core) 排序，适应不同的学习风格。

### 4. 性能与控制 (Performance & Control)

- **高容量并行处理**: 利用 Node.js `worker_threads` (最多 12 核) 分发计算密集的关键词匹配任务。
- **模拟控制 (v0.9.0)**: 通过 **速度/阻尼滑块** 微调物理效果，或使用 **冻结布局** 开关停止模拟以进行稳定的手动排列。
- **悬停锁定**: 悬停在节点上时暂时锁定其位置，以便稳定地检查连接。

### 5. NoteMD AI 文档工作台（v1.5.58）

- **NoteMD 模块已集成**：新增 `src/notemd/*` 独立能力层（LLM 适配、提示词管理、批处理/文件处理、翻译、Mermaid/公式修复、重复检测）。
- **默认一键提取工作流**：嵌入式 NoteMD 现在默认保留一个 `One-Click Extract` 入口，按顺序串联“当前文件概念提取 -> 按标题批量生成 -> 批量 Mermaid 修复”，并将输出写入以源文件名命名的 KB 子目录。
- **TOML API 配置**：嵌入式 NoteMD 的活动 API 配置改为写入 `app_config.toml` 中的 `[notemd]` 与 `[notemd.api]`。
- **CLI 兼容**：可通过 `noteconnection notemd ...` 调用核心 NoteMD 能力，例如 `settings show`、`settings set-api`、`one-click-extract`、`batch-generate`、`batch-mermaid-fix`、`fix-mermaid`。
- **新增 API 面**：`/api/notemd/*` 覆盖设置、工作流编排、文件/文件夹处理、翻译、内容生成、概念提取、重复检测与任务取消。
- **桌面与桥接接入**：新增 Tauri 菜单/IPC `open_notemd`，并在桥接链路支持 NoteMD 窗口打开。
- **安全默认值**：NoteMD 文件操作启用 KB 根路径沙箱校验，长任务支持 SSE 进度回传与取消。

<img width="2012" height="2024" alt="image" src="https://github.com/user-attachments/assets/bf6e7508-7e42-46cb-9a3e-b92be063ad3d" />

---

<a id="hardware-zh"></a>

## 💻 硬件与驱动要求 (Hardware & Driver Requirements)

### 支持的 AMDGPU 架构

NoteConnection 利用 `gpu.js` 进行基于 WebGL 的加速，并计划通过 ROCm 支持本地 AI 推断。

- **RDNA 3 (推荐)**: Radeon RX 7000 系列 (例如 **RX 7900 XT/XTX**)。
  - _状态_: WebGL 和计算性能最佳。
- **RDNA 2**: Radeon RX 6000 系列。
  - _状态_: 稳定且成熟的支持。

### 驱动配置

#### Windows (开发环境)

- **驱动程序**: **AMD Software: Adrenalin Edition** (23.12.1+)。
  - 需要 DirectX 12/Vulkan/OpenGL 支持以底层支持 WebGL。
- **构建工具**: 用于为 Node.js 编译 `headless-gl`：
  - 安装 Python 3.x 并加入 PATH。
  - Visual Studio Build Tools (C++ 工作负载)。

#### Linux (AI 推荐)

- **Mesa (RADV/Radeonsi)**: 默认开源驱动。最适合通用 WebGL 和 `gpu.js`。
- **ROCm (Radeon Open Compute)**: 仅在计划开发 AI 推断功能（未来路线图）时安装。NoteConnection 的核心可视化在标准 Mesa 驱动上运行良好。

---

<a id="architecture-zh"></a>

## 🏗️ 系统架构

NoteConnection 基于模块化架构构建，旨在实现高性能和可扩展性。

### 后端 (`src/backend`)

- **GraphBuilder**: 核心协调器。管理从文件读取到图构建的整个流程。
- **Worker Threads**: 繁重的任务（关键词匹配、文本分析）被卸载到工作线程池 (`src/backend/workers`)，确保主线程保持响应。
- **推断引擎**:
  - `StatisticalAnalyzer`: 计算共现矩阵。
  - `VectorSpace`: 处理 TF-IDF 嵌入和余弦相似度。
  - `HybridEngine`: 结合信号建议有向边。

### 前端 (`src/frontend`)

- **双引擎渲染器**:
  - **D3.js (SVG)**: 用于高保真、交互式图表，具有详细的工具提示和 CSS 样式。
  - **HTML5 Canvas**: 针对海量数据集进行了优化，消除了 DOM 操作的开销。
- **状态管理**: `SettingsManager` 将用户偏好（物理、视觉）持久化到 `localStorage`。
- **布局逻辑**: 自定义的 Sugiyama 风格分层算法和力导向物理算法。

### 桌面桥接 (Desktop Bridge) (`src/core`)

- **PathBridge**: 标准 WebSocket 服务器 (端口 9876)，将内部图谱状态暴露给外部应用程序（例如 Godot 引擎），实现混合 Web/原生可视化管线。

---

<a id="quick-start-zh"></a>

## 📦 快速开始

### 选项 1: Windows 安装程序 (推荐)

1. 从 [最新发布页面](https://github.com/Jacobinwwey/NoteConnection/releases) 下载 `NoteConnection.Setup.exe`。
2. 运行安装程序。
3. 从桌面或开始菜单启动 NoteConnection。

### 选项 2: 使用 npx 运行

无需安装。

```bash
npx noteconnection
```

### 选项 3: 全局安装

```bash
npm install -g noteconnection
noteconnection
```

### 选项 4: 本地开发

```bash
git clone https://github.com/Jacobinwwey/NoteConnection.git
cd NoteConnection
npm install
npm start
```

- 服务器运行于: `http://localhost:3000`

### 选项 5: 移动端支持 (Android)

NoteConnection 现支持 **两条 Android 生成路径**：

1. **Capacitor APK 路径**（Web 资产运行时，适合阅读与可视化流程）。
2. **Tauri Android 路径**（原生壳流程，对齐 `docs/tauri_brainstorming.md`）。

与构建/release/运行时边界相关的完整审计文档见：

- `docs/en/multi_platform_build_flow_audit.md`
- `docs/zh/multi_platform_build_flow_audit.md`

#### 先决条件

- **Node.js** (LTS)
- **Java JDK** (21 或更高版本)
- **Android SDK** (配置在 `ANDROID_HOME` 或通过 Android Studio 安装)

#### 方法 A: Capacitor 构建（稳定）

在 Windows 上直接运行包含的批处理脚本：

```cmd
build_apk.bat
```

该脚本会自动：

1. 检查您的环境 (Node, Java, Android SDK)。
2. 安装依赖项。
3. 构建 Web 资源。
4. 同步 Capacitor。
5. 使用 Gradle 编译 APK。

也可以通过 npm 脚本触发同一路径：

```bash
npm run mobile:build:capacitor
```

#### 方法 B: Tauri Android 构建（原生壳）

```bash
# 机器首次初始化
npm run tauri:android:init

# 通过 Tauri Android 流水线构建
npm run tauri:android:build
```

#### 方法 C: Capacitor 手动构建步骤

1.  **构建 Web 资源**:
    ```bash
    npm run build
    ```
2.  **同步到 Android 平台**:
    ```bash
    npx cap sync
    ```
3.  **构建 APK**:
    在 Android Studio 中打开 `android` 目录并构建，或使用命令行:
    ```bash
    cd android
    ./gradlew assembleDebug
    ```
    APK 将位于: `android/app/build/outputs/apk/debug/app-debug.apk`

#### 移动端能力边界

- Capacitor 打包路径本身不内置桌面 Node sidecar，但在具备 Filesystem API 且数据量不超过移动端限制时，Capacitor 原生运行时仍可本地图谱构建。
- 如果需要与 Tauri 架构一致的移动端原生壳能力，请使用 Tauri Android 路径；该路径会通过 Android 原生命令 `build_graph_runtime` 构图。

---

<a id="cli-zh"></a>

## 🖥️ CLI 命令行使用 (v0.9.71)

您可以直接从命令行加载知识库并构建图谱，而无需使用 UI。这对于自动构建或无头环境非常有用。

### 使用方法

```bash
npm start -- --path "<知识库路径>" [选项]
```

### 选项

| 选项        | 描述                                      | 默认值                |
| ----------- | ----------------------------------------- | --------------------- |
| `--path`    | 包含 Markdown 文件的文件夹的绝对路径。    | `Knowledge_Base`      |
| `--gpu`     | 为布局和向量计算启用 AMDGPU/WebGL 加速。  | `true` (如果硬件支持) |
| `--no-gpu`  | 禁用 GPU 加速 (强制使用 CPU)。            | `false`               |
| `--static`  | 启用静态模式 (仅后端计算，前端布局冻结)。 | `false`               |
| `--workers` | 要使用的 Worker 线程数。                  | `numCPUs - 1`         |

### 示例

```bash
# 基础加载
npm start -- --path "C:/Users/MyName/Documents/MyNotes"

# GPU 加速构建
npm start -- --path "E:/Knowledge/ObsidianVault" --gpu

# 强制 CPU (如果 GPU 出现问题)
npm start -- --path "E:/Knowledge/ObsidianVault" --no-gpu
```

**注意:** CLI 运行会生成唯一的静态数据文件 (`data_cli_{kb_name}_{time}.js`) 以保护原始 `data.js`。服务器启动时，它会自动为前端提供这些特定的文件。

---

## 📂 用户定义知识库 (User-Defined Knowledge Base - v1.0.0)

管理知识库源现在变得更加简单。

- **首次运行设置**: 首次启动时，系统会提示您选择 `Knowledge_Base` 文件夹。
- **持久化配置 (`app_config.toml`)**: KB 路径、语言及多窗口偏好默认保存到 `%LOCALAPPDATA%/NoteConnection/app_config.toml`（Windows），重启后自动恢复。
- **旧配置自动迁移**: 若同目录存在旧版 `kb_config.json`，启动时会自动迁移到 `app_config.toml`。
- **随时更改**: 使用 **文件 > 更改知识库...** 菜单选项即时切换文件夹。
- **重置**: 使用 **文件 > 重置为默认** 返回由捆绑的演示笔记。
- **配置路径覆盖**: 可通过 `NOTE_CONNECTION_CONFIG_PATH`（完整文件路径）或 `NOTE_CONNECTION_CONFIG_DIR`（目录）自定义 `app_config.toml` 位置。
- **窗口行为可调**: 在 `app_config.toml` 的 `[multi_window]` 段调整 `single_window_mode`、`hide_tauri_when_pathmode_opens`、`restore_tauri_when_pathmode_exits`、`confirm_before_full_shutdown_from_godot`、`sync_language`。
- **阅读协议可调**: 在 `[frontend_settings.reading]` 中统一调节 Tauri/Godot 阅读行为（`markdown_engine`、`chunk_block_size`、`prefetch_blocks`、`index_cache_ttl_sec`、`max_doc_bytes`）。
- **详细配置说明**: 参见 [`docs/zh/app_config.toml_guide.md`](app_config.toml_guide.md) 与模板 [`docs/examples/app_config.template.toml`](../examples/app_config.template.toml)。

```toml
# 推荐最小 app_config.toml
knowledge_base_path = "E:/Knowledge_project/NoteConnection_app/Knowledge_Base"
user_language = "en"

[multi_window]
single_window_mode = true
hide_tauri_when_pathmode_opens = true
restore_tauri_when_pathmode_exits = true
confirm_before_full_shutdown_from_godot = true
sync_language = true

[frontend_settings.reading]
mode = "window"
markdown_engine = "auto" # "legacy" | "pulldown" | "auto"
chunk_block_size = 36
prefetch_blocks = 8
index_cache_ttl_sec = 1800
max_doc_bytes = 100663296
```

### Markdown 阅读协议（v1.6.6）

- 双引擎灰度发布：
  - `auto`：优先 pulldown，失败自动回退 legacy。
  - `pulldown`：仍保留 legacy 回退以保证会话稳定。
  - `legacy`：强制旧解析链路。
- 双窗口统一协议：Tauri 与 Godot 阅读器统一消费 `POST /api/markdown/index`、`chunk`、`resolve-node`、`resolve-wiki`。
- 大文档稳定性：阅读链路支持块级增量加载，不再依赖单次整文响应。

## 🏗️ 构建与部署 (Build & Deployment)

对于从源码构建的开发者，NoteConnection 提供两种构建模式：

- **Electron 桌面构建链路已于 2026-03-01 下线（弃用并完成清退）。**

- **Tauri 构建** (`npm run tauri:build`): 默认桌面打包路径，采用 runtime-first 资产流，不再默认打入预生成图谱载荷。
- **Tauri 精简构建** (`npm run tauri:build:mini`): 与当前默认 runtime-first 路径保持兼容的旧别名。
- **Tauri 完整图谱构建** (`npm run tauri:build:full`): 仅在本地真实生成图谱文件存在时，显式选择把图谱资产打入包中。
- **Build (`npm run build`)**: 默认 runtime-first 前端构建。
- **完整图谱前端构建** (`npm run build:full`): 仅供本地 / demo 场景显式选择预生成图谱资产。
- **Godot Bootstrap** (`npm run prepare:godot:bin`): 可从本地覆盖路径 / 搜索目录 / 缓存 / 固定下载 URL 物化主机 Godot sidecar。
- **桌面 Release Godot 镜像**：release CI 现在会先在项目 GitHub Releases 中维护 Godot 镜像 tag，并以“镜像优先、上游回退”方式下载。
- **LFS Policy Guard** (`npm run verify:lfs:policy`): 在迁移仍保留历史豁免项时，阻止新的 Git LFS 路径再次进入 `src/frontend/` 与 `src-tauri/bin/`。未来严格模式可通过 `npm run verify:lfs:policy:strict` 启用。
- **Sidecar 供给就绪度** (`npm run verify:sidecar:supply`): 在继续缩减桌面 sidecar LFS 桥接之前，显式报告当前主机是否已具备离线 bootstrap 能力，还是仍依赖网络。
- **镜像可行性文档**：若要比较 GitHub Releases 与对象存储镜像的成本 / 用户门槛 / 维护负担，请查看 `/diataxis/zh/explanation/sidecar-supply-feasibility/`。
- **GPU 开发启动（推荐）** (`npm run tauri:dev:mini:gpu`)。
- **不要使用** `npm run tauri:dev:mini --gpu`，该写法会被 npm 当作配置参数并触发告警。

## 📚 文档架构（Diataxis + MkDocs）

- 权威长文档仍保持在 `docs/en/*` 与 `docs/zh/*`。
- Diataxis 导航页维护在 `docs/diataxis/<lang>/*`。
- 映射治理文件为 `docs/diataxis-map.json`。
- 映射一致性校验：`npm run docs:diataxis:check`。
- 本地预览文档站点：`npm run docs:site:serve`。
- 构建静态文档站点：`npm run docs:site:build`。
- GitHub Pages 文档入口（project site）：`https://jacobinwwey.github.io/NoteConnection/`。
- 发布工作流：`.github/workflows/docs-github-pages-publish.yml`（`workflow_dispatch` + `git_ref` 回滚）。
- CI 文档治理工作流：`.github/workflows/docs-diataxis-site.yml`。

---

<a id="changelog-zh"></a>

## 更新日志 (Changelog)

### v1.6.6 - Provider 运行时流程与 TOML 配置统一 (2026-03-26)
- 参考 obsidian-NotEMD 与 cline 的 Provider 策略，重构 NoteMD API 调用流为“定义驱动”：transport 分发 + provider 元数据 + Retry-After 感知重试。
- 扩展内置 Provider 预设：Qwen、Doubao、Moonshot、GLM、MiniMax、Groq、Together、Fireworks、Requesty、OpenAI Compatible。
- 完成 Tauri + Godot + NoteMD 的 app_config.toml 统一配置：
  - NoteMD 全量配置持久化到 [notemd] + [[notemd.providers]]
  - Path Mode 配置持久化到 [path_mode] 并通过 /api/path-mode/settings 读写
  - 保留 [notemd.api] 兼容镜像。
- 加固 Rust TOML 回写逻辑：保留未知 section，避免 Tauri 更新 KB/语言时覆盖 NoteMD/Path Mode 配置。

### v1.6.5 - 文档门户更新 (2026-03-26)
- 已将 MkDocs 文档发布到 GitHub Pages project site。
- 在 README 中补充了面向用户与开发者的中英文文档检索入口。
- 维护者发布流程统一为：
  - `npm run docs:site:build`
  - `.github/workflows/docs-github-pages-publish.yml`（`workflow_dispatch` 支持 `git_ref` 回滚）

### v1.6.0 - 单窗口运行时、NoteMD 集成与发布加固 (2026-03-23)

- **Tag 对比快照（`v1.3.0..v1.6.0`）**:
  - `107` 个提交、`301` 个变更文件、`+125,957 / -10,083` 代码/文档变更量。
  - 文件状态分布：新增 `241`、修改 `56`、删除 `3`、重命名 `1`。
  - 主要工程变更面：`src/`、`docs/`、`scripts/`、`path_mode/`、`src-tauri/`。

- **单窗口运行时编排**:
  - 实现 Tauri <-> Godot 的可见性切换，同一时刻仅显示一个主窗口。
  - 增加 Godot 关闭确认流程（“返回主界面” / “关闭全部窗口”），避免误操作导致全局退出。
  - 修复并稳定 Godot 窗口可见性控制，移除已弃用前台激活调用。
- **NoteMD 嵌入式体验**:
  - 保持 NoteMD 为嵌入式能力（非独立桌面窗口），与 Tauri/Godot 双前端统一。
  - 修复 Tauri 中 NoteMD 的 `Browse` 按钮无响应问题（文件/文件夹/保存选择器端到端可用）。
  - 增加导入提示：PDF 需先通过 Mineru 转换为 Markdown 再导入。
- **平台与工具链发布就绪**:
  - 统一 Java 基线为 **JDK 21+**，并验证 **JDK 23.0.1** 在 Android 构建链路可用。
  - 新增 Android/Tauri 的补丁与校验脚本，覆盖前置依赖、sidecar 有效性、严格证据门禁。
- **可靠性与安全门禁**:
  - 扩展 CI/工作流：FixRisk 运维就绪、移动端 e2e 合约、wasm parity、SBOM、attestation、签名与隐私清单校验。
  - 新增多层合约回归覆盖（mobile/runtime/pathbridge/storage）。
  - 纳入发布前 CI 兼容修复：runtime bridge invoke 契约断言兼容与无签名 SBOM transparency 条件化策略。
- **构建性能与开发体验**:
  - 增加低内存 Tauri 构建包装器与 release 配置保护，提升受限内存环境可构建性。
  - 增加 sidecar 预检，避免开发期重复重建，缩短 `tauri:dev:mini:gpu` 热启动耗时。

### v1.5.x 迁移运行时日志（统一归档）
- 完整双语日志统一归档在 [`export.md`](export.md)。
- 本 README 在更新日志中保留摘要指针，避免将日志前置堆叠在文档开头。
- `2026-03-22 v1.5.58`：NoteMD 迁移收口（集成契约 + 全链路可行性验证 + 双语文档闭环）
- `2026-03-03 v1.5.10`：方案 A P0 状态更新（Tauri Android 原生目录/构建/内容链路）
- `2026-03-03 v1.5.5`：迁移状态复验
- `2026-03-03 v1.5.3`：迁移闸门收口更新
- `2026-03-02 v1.5.1`：Tauri 迁移进度更新（桌面 + Android）

### v1.4.4 - Tauri 桥接稳定化与缓存流程加固 (2026-03-01)

- **Electron -> Tauri 运行时对齐**:
  - **路径一致性**: 统一运行时路径解析，sidecar 图谱产物从打包前端资源读取，并写入可写运行时数据目录。
  - **知识库目录发现**: 在 Bridge-first 模式下标准化 `Knowledge_Base` 源根目录的文件夹枚举与加载流程。
- **构建/加载安全性**:
  - **缓存决策流程恢复**: 当目标缓存已存在时，恢复“直接加载缓存 / 重新生成”分流逻辑。
  - **重复请求抑制**: 在前端与后端双层增加去重保护，避免单次加载触发重复 restore/build。
- **PathBridge / WebSocket 稳定性**:
  - **客户端诊断增强**: 增加带标签的连接/断开日志（id、tag、code、reason），用于精准定位桥接问题。
  - **Godot URL 兼容修复**: 将 Godot WebSocket 地址修正为 `ws://127.0.0.1:9876/?client=godot`，解决 URL 解析错误。
  - **Tauri 空闲重连消除**: 在 Tauri 模式禁用 `frontend-early` 自动连接，消除后台 `1001` 循环重连。
- **语言/菜单同步稳健性**:
  - **幂等同步**: 在前端 i18n 与 Tauri Rust 命令两端增加幂等保护，避免重复无效菜单刷新。

### v1.4.1 - 树状视图交互修复 (2026-02-01)

- **交互优化**:
  - **长按导航**: 修复了节点长按 (0.6秒) 会触发右键菜单而不是导航的问题。现在长按可正确切换为中心节点。
  - **全部折叠**: 在学习路径头部添加了 `[-]` 按钮，并支持中键点击以立即折叠所有已展开的节点。
  - **右键切换**: 修复了右键点击无法正确切换节点展开/折叠状态的回归问题。
  - **懒加载 UI**: 将分离的 `(+)/(-)` 按钮替换为统一的状态感知 `[计数]` 指示器，用于切换前置依赖链的可见性。

### v1.4.0 - 路径模式学习体验与树视图 (2026-01-30)

- **路径模式 Bug 修复**:
  - **取消标记同步修复**: 在 `PathBridge.ts` 中添加了 `unmarkComplete` 和 `completionSync` 处理程序。
  - **取消标记后 UI 同步**: 树面板刷新 + 中心气泡进度更新。
  - **着色器语法修复**: 将 `depth_draw_alpha_prepass` 修正为 `depth_prepass_alpha`。
- **路径模式学习 UI**:
  - **导航历史**: 带下拉菜单的返回按钮，用于浏览学习历史。
  - **编辑模式**: 切换开关，用于启用/禁用取消节点标记。
  - **树面板**: 可折叠的依赖树，带视觉状态。
  - **进度显示**: 中心气泡上的"X of N"进度指示器。
- **计划中: 增强图形化树视图**:
  - SubViewport 叠加面板 + 贝塞尔曲线（思维导图风格）。
  - 4 种可选视觉主题: 彩色、深色、玻璃、极简。

### v1.3.0 - 路径模式打磨与 UI 优化 (Path Mode Polish & UI Refinements) (2026-01-24)

- **阅读器集成 (Reader Integration)**:
  - **无缝访问**: 在“轨道布局”中双击中心节点现在会立即打开`阅读器`，显示完整的节点内容。
  - **数据获取**: 修复了阅读器打开为空的关键问题；现在可以正确地从全局图状态检索完整的元数据。
- **视觉打磨 (Visual Polish)**:
  - **轨道布局**: 显著改进了节点分散度（半径 350-950px），减少了标签重叠。
  - **边缘清晰度**: 在轨道模式下，严格隐藏未连接到中心节点的边，将视觉混乱减少了 90%。
  - **标签可见性**: 周围节点现在总是显示标签，并根据距离按比例缩放（最大 16px）。
  - **景深 (DoF)**: 调整了不透明度衰减，以确保远处的节点保持可见（最小 0.4 不透明度）。
- **用户体验改进 (UX Improvements)**:
  - **目标选择**: 将“目标节点”搜索限制从 20 增加到 300，确保用户可以找到图中的任何节点。
  - **交互层级**: 修复了 `z-index` 层级问题，之前的阅读器窗口被隐藏在路径可视化后面。

### v1.2.0 - 路径模式与桌面渲染器 (2026-01-23)

- **路径模式 (Path Mode)**: 引入了一套主要的新功能，用于将图谱转化为线性的学习路径。
  - **学习模式**: '领域学习' (拓扑排序) 和 '扩散学习' (目标导向)。
  - **可视化**: 由 D3/Canvas 驱动的全新径向和树状布局。
  - **策略**: '基础优先' 和 '核心优先' 排序算法。
- **混合架构**:
  - **Godot 桥接**: 实现了 `PathBridge.ts`，通过 WebSocket (端口 9876) 与外部渲染器同步图谱状态。
  - **原生渲染**: 添加了对 Godot 4.3 的支持，以渲染高保真的 Vulkan 图形 (源码位于 `path_mode/`).
- **运维 (DevOps)**:
  - **NPM 脚本**: 添加了 `pathmode:dev` 和 `pathmode:test` 工作流。
  - **UI 稳定性**: 修复了径向布局可见性 (`centerView`) 和退出模式逻辑中的关键 Bug。

### v1.1.2 - 路径解析与 UI 稳定性 (2026-01-23)

- **后端协议修复**:
  - 改进了 `src/server.ts`，使其能够正确处理静态文件的 URL 查询参数（如 `?v=timestamp`）。
  - 解决了 Windows 环境下带缓存刷新参数的 URL 返回 404 的问题。
- **UI 交互修复**:
  - **欢迎弹窗**: 修复了 `welcome.js` 中的一个错误，即跳过教程会导致文件夹选择菜单因 `z-index` 被清除而无法响应的问题。
  - 确保 `#source-control` 在所有弹窗关闭路径下都能保持 `z-index: 1000`。

### v1.1.1 - 移动端构建自动化 (2026-01-22)

- **移动端运维**:
  - 引入了 `build_apk.bat`，用于在 Windows 上一键生成 Android APK。
  - 自动化环境检查（Node, JDK, Android SDK）和项目脚手架搭建。
- **文档**: 在 README 和用户手册中添加了移动端构建的详细指南。

### v1.1.0 - CI/CD 自动化 (2026-01-22)

- **GitHub Actions 集成**:
  - 新增自动 npm 发布工作流，支持发布事件和版本标签触发。
  - 新增版本一致性检查，防止版本号不匹配的发布。
- **DevOps**: 简化发布流程，使用 `git tag v1.1.0 && git push --tags` 即可发布。

### v1.0.1 - 维护与体验优化 (2026-01-21)

- **多语言体系整合**:
  - 移除了 `app.js` 中冗余的硬编码翻译逻辑。
  - 将所有 UI 字符串集成至 `I18nManager`，确保全应用语言切换的一致性。
  - 修复了欢迎弹窗中部分标签显示为英文的“语种混合”问题。
- **新人引导体验修复**:
  - **教程稳定性**: 通过正确暴露 `enterFocusMode` 接口，修复了专注模式教程引发的崩溃。
  - **欢迎弹窗逻辑**: 优化了 `source_manager.js` 中的加载时序，确保在数据状态确认后准确触发弹窗。
- **协议与缓存优化**:
  - **缓存刷新机制**: 在 `source_manager.js` 中实现了带时间戳的动态脚本加载器，防止浏览器加载旧版的 `data.js` 或 `app.js`。
  - **协议处理器精简**: 优化了 `main.ts` 中的 `app://` 协议处理器，采用 `net.fetch` 提供更稳健的本地文件访问支持。

### v1.0.0 - 正式发布 (Production Release) (2026-01-14)

- **稳定性与精简版可靠性**: 对“精简模式”进行了重大修复。
  - **首次启动修复**: 解决了应用在无数据状态下首次启动时的崩溃问题（增加了 `typeof` 安全检查）。
  - **产物自动清理**: 构建过程自动清理旧的数据残留，确保安装包体积最小化 (~70MB)。
  - **Worker 路径修复**: 修正了生产构建中后端工作线程的双层 `dist` 路径解析错误。
- **完全离线化策略**: 所有外部依赖均已迁移为本地资源。系统现在可在完全离线环境下运行。
- **专注模式细化**:
  - **视觉状态恢复**: 修复了退出专注模式后节点大小错误的 Bug。现在能完美恢复原始半径和字体大小。
  - **交互稳定性**: 修复了进入专注模式时的 D3 事件关联错误。
- **物理与间距优化**:
  - **全新默认值**: 默认链接距离增加至 **250px**，碰撞半径增加至 **25px**。
  - **扩展自定义范围**: 滑动条范围增加至 600px 距离 / 100px 碰撞。
- **性能与专注模式重构**:
  - **O(1) 邻居查找**: 在客户端实现邻接缓存，将切换耗时从 $O(N \times M)$ 降低至 $O(1)$。
  - **批量渲染**: 使用 `requestAnimationFrame` 同步渲染，确保平滑过渡。
- **用户定义知识库**: 全新的知识库路径管理、持久化配置及菜单控制。
- **安全与 CSP**: 增强了 CSP 以支持极端的离线安全，并移除了已弃用的 Electron 标志。

### v0.9.83 (2026-01-13)

- **GPU 工作线程集成**: 全面启用了前端模拟工作线程 (Simulation Worker) 中的 GPU 加速。工作线程现在可以动态导入 `gpu-browser.min.js` 和 `layout_gpu.js`，并遵循 `gpuRendering` 设置。
- **性能修复**: 解决了在初始化阶段忽略“GPU 优化渲染”设置、导致强制使用 CPU 计算的问题。现在大型图谱的加载速度显著提升。
- **稳健性**: 修复了 `updateParams` 中的一个关键错误，即在更改物理设置时，现有的 GPU 力实例会被意外地替换为 CPU 力。

### v0.9.74 (2026-01-12)

- **GPU 链接力 (Link Force)**: 使用 `gpu.js` 实现了高性能的 GPU 加速弹簧力。支持 "Gather" 算法，用于高效的邻居处理。
- **物理稳健性**: 在 GPU 核函数中引入了速度钳位 (MAX_VELOCITY=100) 和 NaN/无穷大安全防护，防止节点“爆炸”和消失。
- **布局切换修复**: 实现了 Force 和 DAG 布局的稳健状态保存 (`layoutCache`)，确保节点位置在切换时被保存和恢复，消除了“瞬移”现象。修复了 `updateLayout` 中的关键崩溃，并增加了专注于模式对 GPU 力的支持。
- **GPU 资源管理**: 重构 `layout_gpu.js` 使用单例模式管理 GPU 上下文，防止在切换设置时发生 WebGL 上下文泄漏 (限制 16 个)。

### v0.9.71 (2026-01-10)

- **后端并行布局**: 通过使用 Worker 线程或 GPU 在后端预计算节点位置，加速前端加载。
- **GPU 优化渲染**: 在后端布局中添加了对 AMDGPU 加速的支持。
- **静态模式**: 为海量图谱 (>5000 节点) 实现了严格的模拟冻结以节省资源。
- **CLI 支持**: 添加了完整的 CLI 参数支持，用于自动化构建和加载。
- **极端规模优化**: 对于超过 10,000 个节点的图谱，完全禁用了边渲染，以防止浏览器崩溃。

### v0.9.67 - 紧凑模式与 Canvas 修复 (2026-01-08)

- [x] **紧凑模式**: 添加了一种新模式，默认隐藏边以提高海量图谱（>5k 节点）的性能。此模式在大数据集上自动启用，但可以在设置中切换。
- [x] **Canvas 修复**: 解决了大图在加载时因强制初始 Canvas 渲染帧而显示白屏的问题。
- [x] **优化**: 渲染循环现在在紧凑模式下完全跳过边迭代，显著降低了空闲或平移/缩放期间的 CPU 使用率。

### v0.9.61 - 前端内存优化 (Frontend Memory Optimization) (2026-01-07)

- [x] **智能渲染**: 当图谱包含超过 3000 个节点时，默认自动切换到 **Canvas** 模式。
- [x] **性能**: 降低浏览器内存占用，并提高大数据集初始加载时的帧率。

### v0.9.60 - 并行图指标计算 (Parallel Graph Metrics) (2026-01-07)

- [x] **性能**: 使用 Worker 线程并行化了“图指标”计算（介数中心性）。
- [x] **可扩展性**: 将繁重的 Brandes 算法计算分发到多个 CPU 核心，确保大数据集的图构建更快。

### v0.9.58 - 混合推断资源重用 (优化) (Hybrid Inference Resource Reuse) (2026-01-07)

- [x] **内存优化**: 在 `GraphBuilder` 中为“统计矩阵”和“向量空间”实现了资源重用逻辑。
- [x] **效率**: 防止在混合推断期间重复计算繁重的数据结构，消除了内存峰值并解决了大数据集上的 OOM 崩溃问题。
- [x] **清理**: 在推断任务完成后添加了严格的内存清理步骤。

### v0.9.82 - 稳健性增强与交互优化 (2026-01-12)

- [x] **握手协议**: 引入了 Worker 握手协议 (`isLayoutSwitching`)，有效解决了布局切换竞态，防止延迟消息导致 UI 跳变。
- [x] **专注模式隔离**: 为专注模式实现了完全的手动坐标管理，拖动节点不再受物理引擎干扰，确保定位精准。
- [x] **布局缓存安全**: 增加了 50% 的布局恢复安全阈值，缓存异常时自动执行物理松弛，防止图谱崩溃。
- [x] **分析面板稳定**: 优化了面板缩放时的渲染逻辑，在“冻结布局”激活时严格禁止不必要的物理重启。

### v0.9.57 - Worker 内存优化 (Worker Memory Optimization) (2026-01-07)

- [x] **稳定性修复**: 通过优化 Worker 线程的数据传输策略，解决了处理大数据集 (>13k 文件) 时的“堆内存溢出”崩溃问题。
- [x] **效率**: Worker 现在接收文件路径并按需读取内容，消除了跨线程克隆大型文件内容字符串的内存开销。

### v0.9.56 - 混合推断内存优化 (Hybrid Inference Memory Optimization) (2026-01-05)

- [x] **内存分析**: 为混合推断引擎添加了细粒度的性能日志，每 1000 个节点跟踪一次堆内存使用情况，以识别 Windows 上的内存峰值。
- [x] **优化**: 在推断完成后立即实施激进的内存清理（清除矩阵和置空向量空间），以防止堆内存溢出。

### v0.9.55 - 堆内存溢出修复与迭代 DFS (Heap OOM Fix & Iterative DFS) (2026-01-05)

- [x] **稳定性修复**: 通过在算法阶段之前显式清除文件内容内存，解决了 Windows 10/11 上的“堆内存溢出”崩溃问题。
- [x] **稳健性**: 重构 `CycleDetector` 使用 **迭代 DFS**（基于栈）方法，消除了深度图上的堆栈溢出风险。
- [x] **可观测性**: 将“算法核心”的性能日志拆分为“循环检测”和“拓扑排序”两个独立阶段，以便进行精确调试。

### v0.9.54 - 欢迎体验 (Welcome Experience) (2026-01-05)

- [x] **引导 (Onboarding)**: 添加了一个“欢迎”模态框，当图谱为空时出现，引导新用户选择数据源并加载数据。
- [x] **用户体验 (UX)**: 在欢迎状态下高亮显示“源选择”控件。

### v0.9.53 - 核心 API 解耦 (Core API Decoupling) (2026-01-05)

- [x] **架构重构**: 将核心图构建逻辑提取到独立的 `NoteConnection` 类 (`src/core/NoteConnection.ts`) 中。
- [x] **插件准备**: 将核心 API 与 CLI/服务器特定的文件操作解耦，从而支持与未来的 Joplin/Obsidian 插件直接集成。
- [x] **文档**: 更新了用户手册，补充了缺失的“最大 Worker”性能设置。

### v0.9.52 - 循环检测内存优化 (Cycle Detection Memory Optimization) (2026-01-05)

- [x] **稳定性修复**: 解决了在构建具有大量循环的大型图谱时，Windows 10/11 上发生的关键“堆内存溢出”崩溃问题。
- [x] **算法优化**: 更新了 `CycleDetector` 以限制检测到的循环数量，防止递归期间过度的内存消耗。

### v0.9.51 - 性能日志与崩溃报告 (Performance Logging & Crash Reporting) (2026-01-03)

- [x] **系统监控**: 为后端流程（CPU、内存、时间）实现了全面的性能日志记录。
- [x] **GPU 诊断**: 为 GPU 加速步骤添加了执行计时和内存跟踪。
- [x] **崩溃报告**: 实现了 `CrashLogger`，自动将未处理的异常和 Worker 故障记录到 `crash.log`，以便调试 Windows 11 上的稳定性问题。
- [x] **优化**: 将 `PerformanceLogger` 集成到整个图构建管道（节点初始化、边匹配、推断）中。

### v0.9.50 - GPU 加速 (GPU Acceleration) (2026-01-02)

- [x] **验证**: 确认了使用 **AMD Radeon 7900XT** 通过 `gpu.js` 加速图构建的可行性。
- [x] **策略**: 验证了数学推断（向量相似度）可以卸载到 GPU，而文本处理仍保留在 CPU 上进行优化。
- [x] **实现**: 添加了 `amdgpu` 模块和 `VectorSpaceGPU` 类。集成到 `GraphBuilder` 中，在启用时自动使用 GPU 进行余弦相似度矩阵计算。

### v0.9.49 - 统计分析内存优化 (Statistical Analysis Memory Optimization) (2026-01-02)

- [x] **性能**: 通过优化统计分析器算法，修复了处理大数据集 (>10,000 文件) 时关键的“堆内存溢出”崩溃问题。
- [x] **效率**: 使用稀疏的、以文件为中心的方法，将共现矩阵计算的复杂度降低了约 30 倍。

### v0.9.49 - 并行处理 UI 控制 (UI Controls for Parallel Processing) (2026-01-02)

- [x] **设置界面**: 在设置模态框中添加了“性能” (Performance) 部分，包含用于控制“最大 Worker”的滑块和数字输入框。
- [x] **API 集成**: “加载”按钮现在会将用户定义的 Worker 限制发送到后端构建流程。
- [x] **持久化**: Worker 设置与其他偏好一起保存在 `localStorage` 中。

### v0.9.48 - 并行处理优化 (Parallel Processing Optimization) (2026-01-02)

- [x] **可配置 Worker**: 添加了 'maxWorkers' 配置，允许利用更多 CPU 核心进行图构建和统计推断。移除了 12 个 Worker 的硬编码限制。

### v0.9.46 - 专注模式 UI 清理与 Canvas 边修复 (Focus Mode UI Cleanup & Canvas Edge Fix) (2025-12-26)

- [x] **沉浸式专注**: 专注模式期间，主控制面板和源选择栏现在完全隐藏，以提供无干扰的体验。
- [x] **Canvas 打磨**: 移除了 Canvas 专注模式下的边渲染，以减少视觉噪音。

### v0.9.45 - Canvas 交互与清理 (Canvas Interactivity & Cleanup) (2025-12-26)

- [x] **Canvas 交互**: Canvas 模式现在支持悬停 (高亮)、单击 (统计) 和双击 (专注模式) 交互，与 SVG 功能对齐。
- [x] **视觉修复**: 修复了 Canvas 模式下节点渲染过大的问题；现在它们遵循“大小依据”设置。
- [x] **清理**: 移除了已弃用的“视图模式” (聚类) 功能。

### v0.9.44 - 独立专注模式间距 (Independent Focus Mode Spacing) (2025-12-26)

- [x] **智能间距**: “层间距”和“节点间距”设置现在针对“水平”和“垂直”专注布局独立保存。
- [x] **优化默认值**: 将默认水平层间距减少 50%，垂直节点间距减少 75%，以获得更紧凑、更易读的布局。

### v0.9.43 - 上下文感知设置 UI (Context-Aware Settings UI) (2025-12-26)

- [x] **动态标签**: 设置中的“排斥力强度”标签现在会在“排斥力 (力导向)”和“排斥力 (DAG)”之间动态变化，以清晰指示正在修改哪种布局配置。

### v0.9.42 - 独立排斥力设置 (Distinct Repulsion Settings) (2025-12-26)

- [x] **特定模式物理**: “排斥力强度”现在可以针对“力导向”和“DAG”模式独立配置。
- [x] **智能默认值**: 将力导向布局（聚类）的默认排斥力设置为 **-550**，DAG 布局（层级）设置为 **-850**，以优化初始视觉分离。
- [x] **上下文感知设置**: 设置模态框会自动显示当前布局的排斥力数值。

### v0.9.41 - 设置模态框模拟冻结 (Settings Modal Simulation Freeze) (2025-12-26)

- [x] **资源节省**: 打开“可视化设置”模态框时，模拟现在会自动暂停，从而减少配置期间的 CPU 使用率。关闭时会自动恢复，除非全局启用了“冻结布局”。

### v0.9.40 - 冻结布局优先级修复 (设置模态框) (2025-12-26)

- [x] **设置隔离**: 如果布局已冻结，在“可视化设置”模态框中调整参数（例如排斥力、透明度）不再触发模拟重启。视觉更改立即生效，而物理更新等待解冻。

### v0.9.39 - 布局切换松弛与冻结逻辑 (Layout Switch Relaxation & Freeze Logic) (2025-12-26)

- [x] **一致过渡**: 切换布局现在会触发与初始加载相同的“快速松弛”（0.2 阻尼持续 2 秒），确保节点快速排列。
- [x] **智能冻结**: 如果在切换期间激活了“冻结布局”，模拟将运行 2 秒的松弛期以建立新结构，然后自动冻结。

### v0.9.38 - 快速开始指南 HTML 渲染修复 (Quick Start Guide HTML Rendering Fix) (2025-12-26)

- [x] **富文本支持**: 修复了本地化 UI 中的 HTML 标签（例如粗体文本、换行符）显示为原始文本的问题。系统现在可以正确渲染翻译中的 HTML 格式。

### v0.9.37 - 快速松弛策略 (Rapid Relaxation Strategy) (2025-12-26)

- [x] **智能阻尼**: 模拟现在以低摩擦 (0.2) 启动 2 秒，以允许节点快速解开（“松弛”），然后自动增加到高摩擦 (0.95) 以保持稳定。

### v0.9.36 - 冻结布局优先级修复 (Freeze Layout Priority Fix) (2025-12-26)

- [x] **严格冻结**: 如果“冻结布局”处于激活状态，更改“度数基准”或“大小依据”设置不再唤醒模拟。视觉效果更新（节点大小改变），而位置严格锁定。

### v0.9.35 - 视口剔除放宽 (Viewport Culling Relaxation) (2025-12-26)

- [x] **平滑剔除**: 将屏幕外“活动”缓冲区增加到 800px (视觉)，防止边缘附近的节点在平移期间突然冻结。
- [x] **扩展缩放**: 将全局模拟冻结阈值从 0.4x 降低到 0.1x，允许物理模拟在大幅缩小时继续运行。

### v0.9.34 - 全局布局更新修复 (Global Layout Update Fix) (2025-12-26)

- [x] **布局转换逻辑**: 实现了布局切换期间的全局解冻机制。
- [x] **覆盖剔除**: 切换布局（例如从 Force 到 DAG）现在会强制清除视口剔除锁定（`isCulled`，`fx`，`fy`），确保所有节点（包括屏幕外的节点）都能正确参与新的布局排列。

### v0.9.33 - 布局状态缓存 (即时切换) (2025-12-26)

- [x] **模板状态**: 为“Force”和“DAG”布局实现了独立的状态缓存。
- [x] **即时切换**: 切换布局现在会保存当前状态并立即恢复目标状态，无需重新计算或视觉移动，从而保留每个视图的精确排列。

### v0.9.32 - 高阻尼与渲染优化 (2025-12-26)

- [x] **阻尼**: 将默认摩擦力增加到 0.92 以加快稳定速度。
- [x] **渲染剔除**: 跳过屏幕外冻结节点的 DOM 更新。

### v0.9.31 - 模拟优化 (视口剔除) (2025-12-26)

- [x] **性能**: 实现了智能视口剔除以减少模拟负载。
- [x] **全景冻结**: 当缩小到查看整个图表 (< 0.4x) 时自动冻结模拟。
- [x] **屏幕外冻结**: 放大时，仅模拟可见视口（加上缓冲区）内的节点；屏幕外的节点被冻结。

### v0.9.30 - 专注模式布局隔离 (Focus Mode Layout Isolation) (2025-12-26)

- [x] **位置一致性**: 为专注模式实现了坐标备份/恢复逻辑 (`x`, `y`, `fx`, `fy`)。
- [x] **行为**: 退出专注模式现在会将图表布局恢复到进入前的*精确*状态，丢弃专注会话期间所做的任何临时排列或拖动。
- [x] **UX**: 满足了专注模式应对主界面布局结构零影响的要求。

### v0.9.29 - 冻结布局持久化 (Freeze Layout Persistence) (2025-12-26)

- [x] **Bug 修复**: 解决了打开分析面板或调整窗口大小时会覆盖“冻结布局”状态，导致节点意外移动的问题。
- [x] **稳健性**: 物理模拟现在在布局变更期间严格遵守冻结状态，确保节点按预期保持静止。

### v0.9.27 - 条件重启 (Conditional Restart) (2025-12-26)

- [x] **逻辑修正**: 解决了“退出专注模式”会无条件重启物理模拟，覆盖“冻结布局”状态的冲突。
- [x] **优先级执行**: 如果选中了“冻结布局”，退出专注模式现在会停止模拟并强制进行静态渲染更新，确保节点按请求保持严格静止。

### v0.9.26 - UX 增强与快速开始 (UX Enhancements & Quick Start) (2025-12-26)

- [x] **冻结布局快速按钮**: 在主界面添加了专用的冻结按钮 (❄️) 以便即时访问，提高了移动端可用性。
  - [x] **同步**: 状态与模拟面板复选框同步。
  - [x] **视觉**: 冻结时按钮变红。
- [x] **快速开始指南**: 为新用户实现了“快速开始指南”模态框。
  - [x] **内容**: 涵盖加载、导航、专注模式和控制。
  - [x] **引导**: 首次访问时自动显示（除非选中“不再显示”）。
  - [x] **访问**: 可通过新的“帮助” (❓) 按钮随时访问。
- [x] **本地化**: 全面本地化了新的 UI 元素（中/英）。

### v0.9.25 - 冻结布局优化 (Freeze Layout Optimization) (2025-12-25)

- [x] **资源优化**: 在主界面（SVG 模式）中，启用“冻结布局”现在除了停止模拟外，还会完全禁用节点拖动。
- [x] **逻辑**: 防止因拖动事件而重启（唤醒）物理模拟，从而确保最大限度地节省 CPU/内存。
- [x] **专注模式保留**: 专注模式下的拖动和手动定位功能保持完全激活，不受全局冻结设置的影响。

### v0.9.19 - 专注模式与弹窗增强 (Focus Mode & Popup Enhancements) (2025-12-24)

- [x] **专注模式重新进入**: 修复了在专注模式下双击相关节点时无法正确刷新的问题。现在可以在连接的节点之间无缝切换专注。
- [x] **可拖动弹窗**: 节点统计弹窗现在可以通过标题栏拖动到屏幕上的任何位置，以便更好地组织工作区。
- [x] **可缩放弹窗**: 添加了缩放控制 (+/−/⟲)，可将弹窗内容从 0.5x 缩放到 2.0x，以提高可读性。
- [x] **可调整大小弹窗**: 启用了浏览器原生调整大小手柄，用于手动调整弹窗大小。
- [x] **状态管理**: 改进了节点可见性标志重置，以防止切换专注上下文时出现累积问题。

### v0.9.18 - 节点高亮重构 (Node Highlighting Refactor) (2025-12-24)

- [x] **模块化架构**: 创建了专用的 `NodeHighlightManager` 类，实现高亮逻辑的清晰分离。
- [x] **统一接口**: 为 PC（悬停）和移动端（点击）交互提供单一 API。
- [x] **状态管理**: 正确跟踪高亮/冻结状态，并具备专注模式感知能力。
- [x] **增强渲染**: SVG 和 Canvas 模式之间的一致视觉行为。
- [x] **双语文档**: 整个代码库中全面的中英文注释。
- [x] **稳健集成**: 与现有的专注模式、分析面板和统计弹窗功能完全兼容。

### v0.9.17 - SVG 视觉完整性 (SVG Visual Completeness)

- [x] **彩色箭头**: SVG 边现在在高亮时使用红色和蓝色箭头，确保整个连接颜色编码一致。

### v0.9.16 - 交互完整性 (Interaction Completeness)

- [x] **完整上下文**: 点击或悬停节点现在会显示**所有**连接 (入度和出度)，无论当前过滤器模式如何。
- [x] **Canvas 打磨**: 为 Canvas 渲染器中的高亮边添加了加粗样式。

### v0.9.14 - 视觉与数据修复 (Visual & Data Fixes)

- [x] **边高亮**: 修复了 SVG 模式下边颜色（红/蓝）和加粗样式未正确应用的问题。
- [x] **数据去重**: 确保统计弹窗中的邻居列表不包含重复条目。

### v0.9.13 - 专注模式隔离 (Focus Mode Isolation)

- [x] **交互约束**: 确保在专注模式处于激活状态时，严格禁用浮动统计弹窗和相关高亮显示，以防止上下文冲突。

### v0.9.12 - 独立统计弹窗 (Independent Statistics Popup)

### v0.9.10 - 交互完善 (点击冻结)

- [x] **检查**: 点击节点现在会冻结整个模拟，以便稳定地检查连接。
- [x] **恢复**: 点击背景会恢复模拟（如果未手动冻结）。

### v0.9.9 - 移动端分析面板打磨

- [x] **移动端适配**: 实现了滑动（上/下）手势以调整分析面板大小、全屏拖动吸附以及移动端拖动手柄。
- [x] **交互**: 验证了分析面板与图表之间的节点点击同步。

### v0.9.8 - 分析交互完善

- [x] **图表同步**: 点击表格行现在会高亮显示图表中的节点。
- [x] **移动端 UX**: 修复了分析面板中的移动端滚动问题。

### v0.9.7 - 专注模式交互修复

- [x] **专注模式**: 修复了切换布局类型不会触发立即刷新的 Bug。

### v0.9.6 - 分析与视觉打磨

- [x] **分析面板**: 添加了 "全屏" 切换和 "捏合缩放" 以提高移动端可读性。
- [x] **视觉效果**: 修复了 Mermaid 缩放文本样式；添加了背景点击以清除高亮。

### v0.9.5 - 移动体验优化与专注语义

- [x] **专注模式**: 添加了 "层级 (从左到右)" 布局和语义标签 ("Helping to understand" / "Further exploration")。
- [x] **分析面板**: 针对移动端优化（可滚动），并添加了与主图的点击高亮交互。
- [x] **视觉效果**: 增强了 Mermaid 图表在浅色背景下的文本可见性；修复了专注模式居中问题。

### v0.9.2 - 移动端 UI 优化

- [x] **响应式控件**: 主面板在移动端折叠；专注 UI 移至底部。
- [x] **触摸缩放**: 阅读窗口添加了捏合缩放支持。

### v0.9.0 - 精确控制与稳定性 (2025-12-23)

- [x] **悬停锁定**: 悬停节点时锁定其位置，防止检查时漂移。
- [x] **模拟控制**: 添加了 **冻结布局** 复选框和 **速度/阻尼** 滑块。

### v0.8.9 - 稳定性改进

- [x] **选中冻结**: 专注模式下的节点在交互后保留其位置。

### v0.8.8 - 可扩展性默认值

- [x] **减少杂乱**: 默认隐藏边和孤立节点。
- [x] **水平间距**: 专注模式下新增水平节点分隔滑块。

### v0.8.7 - 渲染引擎

- [x] **Canvas 渲染器**: 添加 HTML5 Canvas 支持以实现高性能。
- [x] **Worker 扩展**: 将线程限制增加到 12。
