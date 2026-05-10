# 2026-04-07 v1.7.0 - Git LFS 资产迁移方案

## 范围

- 在不破坏当前运行时模型、npm 发布链路、桌面/移动发布自动化的前提下，将 Git LFS 从仓库默认交付路径中移除。
- 覆盖当前带宽消耗的两类核心资产：
  - `src/frontend/` 下的图谱生成产物
  - `src-tauri/bin/` 下的桌面 sidecar 二进制
- 方案必须建立在当前代码现实之上。下文每一项迁移动作都对应现有文件、脚本、运行时回退逻辑或测试契约。
- 与跨平台构建/release 行为相关的配套证据矩阵见 `docs/zh/multi_platform_build_flow_audit.md`。
- 与桌面 sidecar 供给链相关的反脆弱迁移路径见 `docs/zh/sidecar_supply_strategy.md`，该文档明确否定“纯下载替代”。

## 状态更新（2026-04-07，已落地 Phase 1 的首个契约切片）

仓库已经落地第一批 runtime-first 契约清理：

- `scripts/copy-assets.js` 默认排除生成型图谱载荷。
- 需要预打包图谱时，改为通过 `build:full` 与 `tauri:build:full` 显式 opt-in。
- 即使显式 full 模式下，Git LFS pointer 占位文件也会被跳过，避免 `lfs: false` checkout 把指针假文件误打包进去。
- `package.json` 已不再把 `data.js` / `graph_data.json` 声明进 `pkg.assets`。
- `prepublishOnly` 已与默认 runtime-first build 语义对齐，不再靠额外一次 mini rebuild“碰巧修正”。

这意味着 Phase 1 已经不只是方案。剩余工作主要转向更广的回归验证和贡献者流程清理。

## 状态更新（2026-04-07，已落地 Phase 2 的首个 bootstrap 切片）

仓库现在也已经补上第一批 Godot sidecar 本地 bootstrap 加固：

- `scripts/tauri-sidecar-utils.js` 统一了主机二进制解析、校验、缓存目录解析与固定下载引导逻辑。
- `scripts/ensure-godot-sidecar.js` 现在可以从缓存或固定下载 URL 物化主机 Godot 二进制。
- `scripts/validate-tauri-sidecars.js` 现在会按主机平台校验 Godot 文件名，而不再只检查 Windows 文件名。
- 新增契约测试 `src/godot.sidecar.bootstrap.contract.test.ts`，覆盖下载、缓存复用、checksum 不匹配失败与主机感知校验。

这还不等于已经移除仓库内 sidecar，但它先补上了移除前必须存在的 bootstrap 缺口。

在当前 Linux 审计主机上的真实 smoke 验证也确认了剩余的开发者引导边界：

- 在原始 checkout 且本机没有可用 Godot 时，`npm run prepare:godot:bin` 会按预期给出引导策略并以 `0` 退出。
- 同一份原始 checkout 上，`npm run verify:tauri:bin` 现在会更准确地失败，因为主机 `server-*` 仍只是 Git LFS pointer 占位文件，而主机 `markdown-worker-*` / `godot-*` 产物也尚未被物化。

这条结果对迁移规划很关键：仓库头部图谱载荷清理并没有引入这个失败模式，但后续 sidecar 移除阶段必须把“新开发者/新机器 bootstrap”当成一等风险来治理。

## 状态更新（2026-04-07，已落地 Guardrail 切片，未改动 CI Workflow）

仓库现在也已经补上一个面向本地/未来 CI 的 LFS 保护脚本：

- `scripts/verify-lfs-asset-policy.js` 会评估 `src/frontend/` 与 `src-tauri/bin/` 下的 Git LFS 使用情况。
- `npm run verify:lfs:policy` 只允许当前迁移期内的临时历史豁免项存在，任何新的受保护路径 LFS 漂移都会失败。
- `npm run verify:lfs:policy:strict` 已为后续彻底 no-LFS 终态准备好，但目前还没有接入 CI。
- 已从 `.gitattributes` 和工作树中移除死掉的 `src-tauri/bin/node-x86_64-pc-windows-msvc.exe` LFS 残留。

这样做的目的是在不改现有 CI 设计的前提下，先把后续阶段需要的 enforcement primitive 落地。

## 状态更新（2026-04-07，已落地 Phase 1 的仓库头清理切片：图谱载荷）

仓库头现在已经不再携带旧的图谱载荷 LFS 残留：

- `src/frontend/data.js` 与 `src/frontend/graph_data.json` 已从 `.gitattributes` 中移除。
- 这两个 pointer 文件也已从工作树移除。
- `npm run build:full` 仍然有效，但现在只会在本地存在真实生成图谱文件时才把它们带入产物。
- `verify:lfs:policy` 已不再把图谱载荷视为历史豁免项。

这一步已经不是单纯的契约改写，而是第一次真正清理仓库头部；之所以风险仍低，是因为在删文件之前，运行时和默认构建路径已经先完成 runtime-first 切换。

## 状态更新（2026-04-07，已复核移动端 release 现实边界）

这次又把移动端现状拿真实代码与最新 Android 发布工件重新核对了一遍：

- 当前最新公开 Android 资产是 `v1.7.0` 的 `app-universal-release-unsigned.apk`
- `.github/workflows/release-desktop-multi-os.yml` 是通过 `NOTE_CONNECTION_TAURI_ANDROID_TARGET=universal npm run tauri:android:build` 产出它的
- 对该 APK 的实际内容检查能看到 `assets/path_mode/...`，但没有发现预打包的 `data.js`、`graph_data.json`、`data_<target>.js`、`graph_data_<target>.json` 或 `Knowledge_Base`

这条结果很重要，因为它纠正了一个很容易产生、但已经不准确的推断：

- 当前移动端 release 打包看起来确实**没有**内置预生成图谱缓存文件
- 但这并不等于“移动端现在只能读缓存，不能本地构建”
- Capacitor 原生运行时已经可以扫描 `Knowledge_Base` 下的 markdown，在本地生成图谱，并通过 Filesystem bridge 写回 `data.js` / `graph_data.json`
- Tauri Android 运行时现在会上报 `supports_build=true`，并把构建请求路由到 Rust `build_graph_runtime`，再把运行时图谱产物写入 `runtime_data/`

因此，方案层面的结论要同步调整：

- 从仓库头部移除 bundled graph payload 的 LFS 文件，并不会额外打坏当前移动端 release 语义
- 真正的移动端风险面不是“APK 里必须带 graph cache”，而是运行时是否能拿到有效 `Knowledge_Base`、是否有权限访问存储、以及是否会撞上数据量/构建体验上限

## 当前代码基线

### 1. 图谱加载链路实际上已经是 runtime-first

代码已经支持“没有预打包图谱产物也能运行”：

- `src/index.ts` 会在图谱生成时把 `graph_data.json` 和 `data.js` 写入 `runtimeDataDir`
- `src/server.ts` 读取生成产物时优先查找 `runtime_data`，再回退到 frontend bundle
- `src-tauri/src/lib.rs` 在 Tauri IPC 与缓存恢复路径上也采用同样的 runtime-first 行为
- `src/frontend/source_manager.js` 与 `src/frontend/app.js` 已经允许 `data.js` 缺失，并继续以 mini / first-run 模式启动

这说明产品层面实际上已经在朝“运行时生成，减少打包静态大资产”的方向演进。

现在这条判断对移动端也成立，但需要更精确地表述：

- Capacitor 原生运行时在具备 Filesystem API 时，可以本地构建图谱缓存。
- Tauri Android 运行时可以通过 `build_graph_runtime` 在本地构建图谱缓存。
- 当前 release APK 依然看起来是不预置 graph cache 的，因此“移动端打包内容”和“移动端运行时能力”必须分开讨论，不能混成一个判断。

### 2. 构建与打包契约曾长期保留旧的静态资产假设

运行时早已前进，但构建契约此前还停留在旧状态：

- `scripts/copy-assets.js` 过去在普通模式下会复制 `data.js` 和 `graph_data.json`，只有 `--mini` 才排除
- `package.json` 过去的 `tauri:dev` 与 `tauri:build` 代表“全量前端资产”路径，而 `tauri:dev:mini` / `tauri:build:mini` 才是 runtime-first 路径
- `package.json` 过去仍把 `data.js` 与 `graph_data.json` 列在 `pkg.assets`
- `src/pkg.sidecar.contract.test.ts` 过去也强约束 `pkg.assets` 必须包含这两个大文件

因此，迁移的首要工程风险不在终端用户，而在陈旧的构建契约。如果先删 LFS 资产、后改契约，最先坏的是开发和打包链路。当前默认 runtime-first 的切换，已经先把这部分风险削掉了一截。

### 3. Release 自动化实际上已经不依赖 LFS checkout

当前 release 自动化已经非常接近目标状态：

- `.github/workflows/release-desktop-multi-os.yml` 使用 `lfs: false` checkout
- 同一个 workflow 现在会先在项目 GitHub Releases 中维护 Godot 镜像 tag，再以“镜像优先、上游回退”方式在各 runner 上下载 Godot，而不是依赖仓库中的 Godot 副本
- 桌面 release 通过 `npm run tauri:build:mini` 构建

这说明 sidecar 与图谱资产迁移对正式发布链路是可行的。

### 4. npm 发布流程现在语义已对齐，但仍有重复构建

`.github/workflows/npm-publish.yml` 同样使用 `lfs: false` checkout，而现在 workflow 里的 `Build` 步骤与 `prepublishOnly` 都已经对齐到同一套 runtime-first build 语义。

这意味着旧的语义错位已经被消除，但当前流程仍会构建两次：

1. workflow 中先执行一次 `npm run build`
2. `prepublishOnly` 再执行一次 `npm run build`

从 LFS 契约角度看，这已经是安全的；只是如果后续发布耗时成为问题，仍值得再做一次简化。目前没有必要为了这点去改 CI 设计。

### 5. Sidecar 生成链路本身已经具备本地/按需能力

仓库其实并不需要预提交的 server sidecar 才能工作：

- `scripts/build-sidecar.js` 会在本地把 `server-*` 产物写到 `src-tauri/bin`
- `scripts/ensure-sidecar-ready.js` 会在缺失或过期时重建 sidecar
- `scripts/validate-tauri-sidecars.js` 会校验所需二进制是否有效

剩余缺口在本地 Godot 引导：

- `scripts/ensure-godot-sidecar.js` 已经支持通过环境变量和搜索目录去复制 Godot
- 在 Windows 上，缺失 Godot 目前默认是 fail-fast

这说明 sidecar 迁移可行，但在移除仓库内大二进制之前，必须先补齐本地开发者 bootstrap。

## 迁移原则

- 优先让运行时生成资产，而不是把大产物绑进仓库。
- 优先让本地 bootstrap 可重复，而不是在仓库里长期存放可执行文件。
- 把“安全行为迁移”和“Git 历史重写”分开。只有在仓库已经不再依赖这些 LFS 资产之后，才进入历史清理。
- 保持当前已经工作的终端用户路径稳定，尤其是 first-run、cache restore、release packaging 和 Tauri mini startup。

## 阶段 1：把图谱生成产物移出默认构建路径

### 目标

让 runtime-first / mini 语义成为源码构建、开发启动和 package 发布的默认路径。

### 代码支撑

以下文件已经支持这个方向：

- `src/index.ts`
- `src/server.ts`
- `src-tauri/src/lib.rs`
- `src/frontend/source_manager.js`
- `src/frontend/app.js`
- `docs/zh/TEST_REPORT.md` 已记录 mini build 首次启动崩溃已被修复

### 必要改动

1. 统一构建契约到 runtime-first。
   - 修改 `scripts/copy-assets.js`，让当前的 mini 行为成为默认安全行为。
   - 把现有 full build 改成显式 opt-in，例如 demo build 或 legacy static build。

2. 让 `package.json` 与新默认语义一致。
   - 让 `build`、`tauri:dev` 和面向打包的脚本走 runtime-first 资产流。
   - 只有在内部 QA 确实还需要预打包 demo 图谱时，才保留显式 opt-in 脚本。

3. 去掉 pkg 打包中的静态图谱硬编码假设。
   - 更新 `package.json` 中的 `pkg.assets`
   - 更新 `src/pkg.sidecar.contract.test.ts`，把契约从“必须打包两个超大文件”改成“运行时生成/读取资产必须安全”

4. 强化 runtime-first 测试覆盖。
   - 扩展 `src/server.migration.test.ts`，覆盖“不存在 bundled `data.js` / `graph_data.json`”的情况
   - 扩展启动与 loadflow 测试，让“无预打包图谱”的 mini 路径成为一等支持路径

5. 有意识地保留用户可见的默认/demo 体验。
   - 如果“Reset to Default”依赖的是 demo notes，而不是预打包图谱，请保留 demo notes
   - 不要在不说明的情况下移除 first-run 引导或 fallback 内容

### 工程风险

- `build` 当前代表“复制所有 frontend 资产”，但运行时已经允许图谱资产缺失。调整 `build` 语义属于开发者和 CI 契约变更。
- 一些内部脚本或临时工作流可能仍假设首次启动时存在预加载图谱。
- 如果 `Reset to Default` 间接依赖 bundled 图谱，迁移后用户首次进入可能比之前更空。
- 对移动端来说，关键风险并不是“APK 里没有 `data.js`”。真正需要关注的是运行时能否拿到正确的 `Knowledge_Base`、以及本地构建是否会触发平台边界。

### 对用户 / 运行时的影响

- 已安装的桌面 release 基本不应受到这一阶段影响。
- 后续桌面 release 仍应安全，因为正式发布链路已经在使用 `tauri:build:mini`。
- 当前 Android release 与这一阶段也兼容，因为最新公开 APK 本身看起来就没有预置 graph cache 资产。
- 主要受影响的是开发者：
  - `npm run tauri:dev` 的行为会更像当前的 mini build
  - 首次启动可能在选择 Knowledge Base 前显示空态
- 移动端仍有单独的运行时注意事项：
  - Capacitor 本地图谱构建受文件数与载荷大小上限约束。
  - Tauri Android 本地图谱构建仍依赖运行时能访问所选 Knowledge Base。

### 缓解措施

- 如果产品仍需要非空首屏，保留一个小型 demo Knowledge Base。
- 明确区分脚本命名与文档，让开发者知道当前运行是 runtime-first 还是 demo-prebundled。
- 在移除 LFS 文件前先更新文档，避免贡献者把新行为误判成回归。
- 针对移动端 QA，应该用真实数据集验证运行时构图能力，而不是再把“是否预打包 graph payload”当作唯一安全信号。

### 验证

- `npm run build:mini`
- `npm run tauri:dev:mini`
- `npm run tauri:build:mini`
- 在 `lfs: false` checkout 下执行 npm publish dry-run
- 验证不存在 bundled `data.js` 时的启动链路
- 验证 `data.js` / `graph_data.json` 的缓存恢复链路

### 回滚

- 恢复 `copy-assets.js` 的旧语义
- 恢复 `pkg.assets` 与契约测试中对静态图谱文件的旧要求
- 暂时重新引入 bundled 图谱产物，但此时仍不触碰 Git 历史重写

## 阶段 2：把仓库中的 sidecar 二进制移出默认分支

### 目标

不再把 `src-tauri/bin/*` 下的大型可执行文件长期存放在 Git LFS 中，同时保持本地开发 bootstrap 与 release 可重复性。

### 代码支撑

当前代码已经具备迁移所需的基础设施：

- `scripts/build-sidecar.js` 负责本地构建 server sidecar
- `scripts/ensure-sidecar-ready.js` 负责缺失/过期时重建或刷新
- `scripts/validate-tauri-sidecars.js` 负责校验所需二进制
- `.github/workflows/release-desktop-multi-os.yml` 已经在各 runner 上下载 Godot，不需要仓库内预置 Godot

### 必要改动

1. 让 server sidecar 完全变成本地构建 / 按需生成资产。
   - 去掉“`server-*` 必须作为提交资产存在”的假设
   - 由 `scripts/ensure-sidecar-ready.js` 与 `scripts/build-sidecar.js` 负责物化 server sidecar

2. 补齐本地 Godot bootstrap。
   - 扩展 `scripts/ensure-godot-sidecar.js`，在本地找不到可用 Godot 时，允许自动下载并缓存对应平台的 Godot
   - 保留 `NOTE_CONNECTION_GODOT_EXE` 与搜索目录覆盖，作为手动 escape hatch

3. 让校验逻辑匹配新的所有权模型。
   - `scripts/validate-tauri-sidecars.js` 应校验“本地已物化 sidecar”，而不是“Git checkout 中必须已有文件”

4. 把本地 bootstrap 写清楚。
   - 当仓库不再提供大二进制后，贡献者需要有明确的 Windows/Linux/macOS 主机准备路径

### 工程风险

- Windows 本地开发是最高风险段，因为当前缺少 Godot 时默认 hard fail。
- 自动下载会引入新的失败模式：
  - 离线开发
  - 上游下载 URL 漂移
  - checksum / 完整性校验
  - Windows/macOS 下的杀毒或 quarantine 问题
- 如果在可靠物化路径完成前就先改校验，`tauri:dev` 与 `tauri:build` 很容易变得脆弱。

### 对用户 / 运行时的影响

- 已安装终端用户基本不应受到影响，因为 release 工件本身已经是构建完成的交付物。
- Release CI 大概率会保持稳定甚至更稳定，因为它本来就显式下载 Godot。
- 主要受影响的是开发者：
  - 首次本地构建可能多一个 bootstrap / 下载步骤
  - 离线开发需要有明确的手动覆盖路径
  - 在 fresh raw checkout 上，`npm run verify:tauri:bin` 仍可能因为主机 `server-*` 还是 LFS 残留、且 `markdown-worker-*` / `godot-*` 尚未物化而失败

### 缓解措施

- 为下载的 Godot 工件增加 checksum 校验
- 把下载缓存放到仓库工作树之外
- 保留环境变量覆盖与手动放置路径文档
- 只有在 Windows bootstrap 端到端验证通过后，才推进这一阶段

### 验证

- Windows/Linux/macOS 主机上执行 `npm run tauri:dev:mini`
- `npm run tauri:build:mini`
- `npm run verify:tauri:bin`
- 各平台桌面 release workflow
- 依赖 `build:sidecar` 的 Android / Tauri 工作流

### 回滚

- 临时恢复仓库内的二进制回退路径
- 保留 bootstrap 下载逻辑，但允许已提交二进制继续满足校验，作为新旧路径的过渡兜底

## 阶段 3：确认运行时已独立后，再清理 LFS 追踪与历史

### 目标

在仓库不再依赖这些已提交图谱资产与 sidecar 二进制之后，清理 LFS 使用，并加防回归护栏。

### 必要改动

1. 从 `.gitattributes` 中移除已经过时的 LFS 追踪规则。

2. 进行受控的仓库清理。
   - 在维护窗口内使用 `git lfs migrate export` 或 `git filter-repo`
   - 提前公告、冻结进行中的分支，并提供 reclone / rebase 手册

3. 加入预算护栏。
   - 增加 CI 脚本，禁止以下路径再次出现新的 LFS 对象：
     - `src/frontend/`
     - `src-tauri/bin/`
   - 增加大文件预算检查，限制 demo / 生成资产体量

4. 审计文档与贡献者入口。
   - 清除过时描述，避免继续暗示“clone 仓库就应该物化出超大运行时载荷”

### 工程风险

- Git 历史重写是唯一会直接扰动协作者的阶段
- 开放 PR、fork、本地分支以及固定旧 SHA 的自动化都可能受到影响
- 如果 tags / releases 处理不慎，下游引用会变得混乱

### 对用户 / 项目的影响

- 现有 release 工件用户理论上仍不应受到影响
- 贡献者与维护者会在历史重写窗口内受到明显影响
- 这一阶段应被视为“仓库维护动作”，而不是运行时功能发布

### 缓解措施

- 只有在阶段 1 和阶段 2 已经安全上线后，才启动这一阶段
- 在重写前建立 migration tag / archival branch
- 向贡献者提供明确恢复步骤

### 验证

- 历史重写后的 fresh clone
- npm publish dry-run
- 桌面 release workflow dry-run
- 受保护路径中不再报告新的 LFS 对象

### 回滚

- 保留重写前镜像仓库或 archival remote
- 如果历史重写带来不可接受的协作成本，就停留在“停止新增 LFS 使用”，延后历史清理

## 推荐推进顺序

1. 先做阶段 1
   - 对终端用户风险最低
   - 对 LFS 带宽问题收益最大
   - 本质上是构建契约清理

2. 再做阶段 2
   - 这是彻底移除大型仓库二进制的必要前置
   - 核心挑战在开发者 bootstrap，而不在产品运行时

3. 最后做阶段 3
   - 纯维护性质
   - 必须在代码已经证明不再依赖这些资产之后再做

## Go / No-Go 条件

只有在以下条件全部满足后，才进入历史清理：

- `tauri:build:mini` 已成为稳定默认发布路径
- 本地开发 bootstrap 在没有仓库内 sidecar 二进制时也能稳定工作
- npm publish 不再依赖在 `lfs: false` checkout 上先跑一次 full build
- 在没有 bundled 图谱产物时，startup、cache restore 与 first-run 链路都能通过
- 贡献者文档已更新

## 结论与建议

这次迁移值得做，但不能按“删文件”来做，而要按“迁移构建与交付契约”来做。

最安全的顺序是：

- 先把 runtime-first 图谱加载变成默认构建契约
- 再把 sidecar 物化迁移到可重复的本地/bootstrap 逻辑
- 最后才移除 LFS 追踪，并决定是否进行 Git 历史清理

这个顺序能在控制终端用户风险的同时，直接解决当前 Git LFS 带宽告警的根因。
