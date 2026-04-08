# 2026-04-07 v1.7.0 - 多平台构建流程审计

## 范围

- 审计所有会实质影响 Git LFS 迁移判断的构建与交付路径。
- 所有迁移建议都必须锚定当前仓库里的真实代码，而不是历史印象。
- 覆盖桌面源码构建、桌面 Tauri 打包、Android Capacitor、Android Tauri、npm publish、文档站点、GitHub Pages 和 GitHub Release。
- 当需要判断剩余桌面 sidecar 的 LFS 残留能否继续收缩、且不引入脆弱的网络依赖时，应与 `docs/zh/sidecar_supply_strategy.md` 配套阅读。

## 为什么要做这份审计

只有把平台级构建图真正看清，Git LFS 迁移才是安全的。

当前仓库里已经同时存在：

- runtime-first 图谱生成链路
- 显式 full-graph opt-in 路径
- 桌面 sidecar 打包路径
- Android 双流水线
- npm publish 与 docs 专用 CI

如果不把这些构建流逐个审清，就很容易在一个面上做对改动，却在另一个面上悄悄打坏行为。

## 构建流程矩阵

### 1. 源码 Web 构建：默认 runtime-first

入口：

- `npm run build`
- `npm run build:mini`

主要代码证据：

- `package.json` 中的 `build` / `build:mini`
- `scripts/copy-assets.js`
- `src-tauri/tauri.conf.json` 里的 `build.frontendDist`

当前契约：

- 默认源码构建都会把前端产物输出到 `dist/src/frontend`
- 生成型图谱载荷默认不进入产物
- `copy-assets.js` 把 `data.js` / `graph_data.json` 当作运行时生成资产处理，并跳过 Git LFS pointer 占位文件

迁移含义：

- Phase 1 的图谱载荷移除，已经与默认构建路径对齐
- 普通源码构建不再需要 repo-head 自带的 `data.js` / `graph_data.json`

### 2. 显式 full-graph 构建：仅作为 opt-in 路径存在

入口：

- `npm run build:full`
- `npm run tauri:build:full`

主要代码证据：

- `package.json` 中的 `build:full`
- `scripts/copy-assets.js --include-generated-graph-assets`
- `scripts/run-tauri-build.js`
- `scripts/run-tauri-frontend-build.js`
- `src-tauri/tauri.conf.json`
- `src/tauri.frontend.build.contract.test.ts`

当前契约：

- full 模式只会在本地存在真实生成图谱文件时才带入这些产物
- Git LFS pointer 占位文件在 full 模式下仍会被跳过
- 桌面 Tauri full build 现在可以把 full-mode 语义传过 Tauri `beforeBuildCommand`

本轮修正的重要问题：

- 在这次审计前，`tauri:build:full` 虽然先执行了 `build:full`，但 Tauri 的 `beforeBuildCommand` 仍固定为 `npm run build`
- 这会导致显式 full 产物在打包前又被重新覆盖成 runtime-first
- 现在仓库已经把 Tauri 前端预构建改为走 `scripts/run-tauri-frontend-build.js`，并由 `tauri:build:full` 显式传入 `--frontend-build-mode full`

迁移含义：

- 显式 full 模式仍然可用于 QA/demo
- 默认流程保持 runtime-first 的同时，显式 full 仍然是可证明、可验证的有效路径

### 3. 桌面 Tauri 本地开发与打包流

入口：

- `npm run tauri:dev`
- `npm run tauri:dev:mini`
- `npm run tauri:dev:full`
- `npm run tauri:build`
- `npm run tauri:build:mini`
- `npm run tauri:build:full`

主要代码证据：

- `package.json`
- `src-tauri/tauri.conf.json`
- `scripts/build-sidecar.js`
- `scripts/ensure-sidecar-ready.js`
- `scripts/ensure-godot-sidecar.js`
- `scripts/validate-tauri-sidecars.js`

当前契约：

- 桌面 Tauri bundle 仍依赖 `src-tauri/bin/*` external sidecar
- bundle 配置明确声明了 `bin/server`、`bin/godot`、`bin/markdown-worker`
- 桌面本地流程会在打包前物化或校验 sidecar

迁移含义：

- 桌面图谱载荷移除本身风险较低
- sidecar 移除才是后续真正高风险的迁移阶段，因为桌面 bundle 的可重复性仍依赖这些二进制在打包时存在

### 4. Android Capacitor 流水线

入口：

- `build_apk.bat`
- `npm run mobile:build:capacitor`

主要代码证据：

- `build_apk.bat`
- `capacitor.config.ts`
- `package.json`

当前契约：

- Capacitor 会把 `dist/src/frontend` 作为 `webDir` 打包
- 辅助构建入口目前是 Windows 优先的 `.bat` 流程
- 脚本真实要求 JDK 21+，而不是一些旧文档里残留的 17+
- 脚本会把 Web 资产同步到 `android/app/src/main/assets/public`

运行时边界：

- 在具备 Filesystem API 时，Capacitor 运行时仍可本地构图
- 本地构图受到 `CAPACITOR_GRAPH_BUILD_MAX_FILES = 2000` 与 `CAPACITOR_GRAPH_BUILD_MAX_BYTES = 16 * 1024 * 1024` 限制

迁移含义：

- Capacitor 打包本身不需要重新引入 repo-head 图谱大文件
- 更大的风险在于 Windows-only helper 体验，以及移动端运行时的数据量/权限边界

### 5. Android Tauri 流水线

入口：

- `npm run tauri:android:init`
- `npm run tauri:android:dev`
- `npm run tauri:android:build`
- `npm run tauri:android:build:universal`

主要代码证据：

- `package.json`
- `scripts/verify-tauri-android-prereqs.js`
- `scripts/run-tauri-android.js`
- `src-tauri/tauri.android.conf.json`
- `src-tauri/src/lib.rs`

当前契约：

- Tauri Android 要求 JDK 21+ 与 Android SDK/NDK 就绪
- 本地 helper 在 `dev`/`build` 时默认选 `aarch64`，除非显式传目标
- Android bundle 配置把 `externalBin` 清空，因此桌面 sidecar 不会被直接装进 Android 包
- Android 运行时会上报 `supports_build=true`，并走原生 `build_graph_runtime`

迁移含义：

- 当前移动端 release 已经不依赖预打包 graph cache 文件
- Android Tauri 是“原生运行时构图路径”，不是“移动端 sidecar 打包路径”

### 6. GitHub 桌面与 Android release 流水线

入口：

- `.github/workflows/release-desktop-multi-os.yml`

主要代码证据：

- 桌面 job 使用 `lfs: false` checkout
- 桌面 job 现在会先维护项目 GitHub Releases 中的 Godot 镜像 tag，再以“镜像优先、上游回退”方式在 runner 上下载 Godot
- 桌面 job 通过 `npm run tauri:build:mini` 构建
- Android release job 通过 `NOTE_CONNECTION_TAURI_ANDROID_TARGET=universal npm run tauri:android:build` 构建

当前契约：

- release 打包已经基本脱离 repo-head 图谱 LFS 大文件
- release CI 仍需要 sidecar/bootstrap 物化，但主路径上的 Godot 供给现在优先来自项目自控的 GitHub Releases 镜像，而不是直接访问第三方上游
- 迁移期仍保留上游回退，因此 digest pinning 与彻底去掉上游回退仍属于后续加固任务
- 2026-04-08 的真实 smoke run 已经证明冷启动镜像 job 可以创建并补齐 `godot-mirror-v4.3-stable`，同时 Windows、macOS、Linux、Android 的 release 资产都可以经当前 mirror-first 主路径产出
- release 日志还暴露出一个非阻塞运维债务：`actions/upload-artifact@v4` 与 `softprops/action-gh-release@v2` 仍是 Node 20 目标，目前依赖 GitHub 的 Node 24 强制兼容层继续运行

迁移含义：

- Phase 1 图谱载荷清理已经与 release CI 相容
- 后续 sidecar 移除必须保证 release 时的二进制物化能力不被破坏
- 当前主要不确定性已经不在“项目自控镜像能不能插入现有 CI 形态”，而在“这条供给链还需要加固到什么程度”

### 7. npm publish 流水线

入口：

- `.github/workflows/npm-publish.yml`
- `prepublishOnly`

主要代码证据：

- workflow checkout 使用 `lfs: false`
- workflow 执行 `npm run build`
- workflow 在发布前执行 SBOM、attestation、严格 PathBridge、wasm parity、sidecar signature 与 Jest 闸门
- `prepublishOnly` 也执行 `npm run build`

当前契约：

- npm publish 现在已经与 runtime-first 语义对齐
- build 仍然会执行两次，但两次现在都遵循相同的 runtime-first 语义

迁移含义：

- 图谱载荷移除不会破坏 npm publish
- 这里不是必须改 CI 的地方，只是后续可以再简化

### 8. 文档站点与 GitHub Pages 流水线

入口：

- `npm run docs:diataxis:check`
- `npm run docs:site:build`
- `.github/workflows/docs-diataxis-site.yml`
- `.github/workflows/docs-github-pages-publish.yml`

主要代码证据：

- `mkdocs.yml`
- `docs/diataxis-map.json`
- docs workflows 统一使用 `lfs: false`

当前契约：

- 文档交付完全独立于图谱载荷和 sidecar 二进制
- 文档治理依赖 Diataxis 映射文件和 MkDocs 构建

迁移含义：

- 文档可以独立跟进运行时迁移
- 平台边界应该通过文档固化，而不是为了文档去改动现有 CI 设计

## 具备真实代码支撑的迁移项

### 项目 1：保持 runtime-first 作为默认构建契约

当前代码支撑：

- `package.json` `build`
- `scripts/copy-assets.js`
- `src/server.ts`
- `src-tauri/src/lib.rs`
- `src/frontend/source_manager.js`

为什么成立：

- 运行时早已支持缺失 bundled graph payload 的情况
- 当前默认构建路径也已经默认排除这些运行时生成文件

如果不这么做的风险：

- repo-head 清理会与真实构建契约重新错位

验证：

- `npm run build`
- `npm run test:migration`

### 项目 2：保留显式 full-mode 作为有意识的 opt-in 路径

当前代码支撑：

- `package.json` `build:full`、`tauri:build:full`
- `scripts/run-tauri-build.js`
- `scripts/run-tauri-frontend-build.js`
- `src/tauri.frontend.build.contract.test.ts`

为什么成立：

- QA/demo 仍可能需要一个受支持的预打包图谱路径
- 现在显式 full-mode 已可在 Tauri bundling 前保持一致

如果忽略它的风险：

- 后续贡献者会误以为 full mode 可用，但实际上 Tauri 打包时又悄悄退回 runtime-first

验证：

- `npx jest src/tauri.frontend.build.contract.test.ts --runInBand`
- `npm run build:full`

### 项目 3：先移除 repo-head 图谱载荷，再谈历史清理

当前代码支撑：

- `.gitattributes`
- `scripts/verify-lfs-asset-policy.js`
- `src/lfs.asset.policy.contract.test.ts`
- `src/copy.assets.contract.test.ts`

为什么成立：

- repo-head 图谱残留已经清掉
- 后续回流也已经能通过策略与契约测试观察到

如果不推进的风险：

- Git LFS 带宽会继续消耗在默认运行时根本不需要的大文件上

验证：

- `npm run verify:lfs:policy`
- `npm run test:migration`

### 项目 4：把 sidecar 移除视为独立且更高风险的阶段

当前代码支撑：

- `scripts/build-sidecar.js`
- `scripts/ensure-sidecar-ready.js`
- `scripts/ensure-godot-sidecar.js`
- `scripts/validate-tauri-sidecars.js`
- `.github/workflows/release-desktop-multi-os.yml`

为什么成立：

- 桌面 Tauri 打包仍依赖 sidecar 物化
- release CI 已经证明 Godot 可以在 repo-head 之外提供

如果推进过快的风险：

- 桌面本地 bundle 失效
- fresh checkout 的开发者 bootstrap 失效
- 无效 `src-tauri/bin/*` 占位文件在没有严格校验时被误当成有效二进制

验证：

- `npm run prepare:godot:bin`
- `npm run verify:tauri:bin`
- `npm run test:migration`

### 项目 5：把“移动端打包内容”和“移动端运行时能力”分开处理

当前代码支撑：

- `build_apk.bat`
- `capacitor.config.ts`
- `scripts/run-tauri-android.js`
- `src/frontend/storage_provider.js`
- `src/frontend/source_manager.js`
- `src-tauri/src/lib.rs`

为什么成立：

- 当前 release APK 看起来并不携带 bundled graph cache
- 但 Capacitor 原生运行时和 Tauri Android 运行时都仍可本地构图

如果理解错的风险：

- 错误回滚图谱载荷清理
- 对移动端回归作出错误归因

验证：

- `npm run verify:android:env`
- `npm run test:mobile:contracts`
- 对最新 APK 进行工件检查

## 替代性评估：现在的 `sidecar/bootstrap` 能直接被取代吗？

短结论：

- 不能在当前路线下被全局取代

桌面端现实：

- 桌面 sidecar 二进制仍然属于当前产品主架构，而不只是历史遗留的分发捷径
- 当前桌面脚本在 Tauri 打包前仍会构建或校验 Node server sidecar、Markdown worker sidecar 与 Godot sidecar
- Tauri 桌面 bundle 配置仍把 `bin/server`、`bin/godot`、`bin/markdown-worker` 声明为 `externalBin`
- Rust 启动流程仍会先 bootstrap 运行时数据，再拉起 Node sidecar，然后再拉起本地 Godot 进程
- 前端启动流程仍把 sidecar 驱动的数据加载与 Godot 早期桥接预热视为桌面主路径

移动端现实：

- Android 运行时已经进入“选择性替代”状态：Android 打包配置清空了 `externalBin`，运行时能力门控报告 `supports_sidecar = false`，图谱构建改走原生 `build_graph_runtime`
- Capacitor 运行时在数据量与权限允许时，也有自己基于原生文件系统的本地图谱构建路径
- 但 Android helper 脚本今天仍然会调用 `build:sidecar`，说明构建链路的解耦还没有完全做完，即便运行时已经部分解耦

迁移含义：

- 当前 LFS 迁移工作可以替代“仓库头部存储二进制”的做法，并强化 bootstrap 物化的可重复性
- 这不等于可以移除桌面 sidecar/bootstrap 架构
- 真正的桌面侧替代，需要为本地图谱构建执行、内容读取、Markdown worker 行为、Godot 渲染编排，以及 release 时二进制物化保证分别提供新的方案
- 因此更准确的近期方向应该是：保持桌面 sidecar/bootstrap 契约不动，继续扩展移动端原生 fallback，并把桌面 sidecar 移除作为单独的路线决策

验证锚点：

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/tauri.android.conf.json`
- `src-tauri/src/lib.rs`
- `src/frontend/storage_provider.js`
- `src/frontend/source_manager.js`
- `scripts/build-sidecar.js`
- `scripts/ensure-sidecar-ready.js`
- `scripts/ensure-godot-sidecar.js`
- `.github/workflows/release-desktop-multi-os.yml`

### 组件拆解矩阵

| 组件 | 当前职责 | 现在可直接替代吗？ | 主要阻塞点 | 更合适的下一步 |
| --- | --- | --- | --- | --- |
| Node sidecar | 桌面端 KB 列表、内容 API、构图 API、启动编排 | 桌面端不行；Android 运行时已局部替代 | 桌面 bundle 仍打包 `bin/server`；Rust 启动仍拉起 `server`；前端桌面加载流仍优先走 sidecar | 保持桌面主路径稳定，继续扩展移动端原生 fallback |
| Godot bootstrap | 为桌面开发、构建、发布流程物化本机 Godot 二进制 | 桌面端不行 | 桌面 bundle 仍打包 `bin/godot`；Rust 启动仍拉起 Godot；release workflow 仍需在打包前物化 Godot | 优先提升 bootstrap、缓存、下载校验的可重复性，而不是直接删除 |
| markdown-worker | 支撑 Tauri/Godot 阅读器共用的 Markdown 协议 | 桌面端不行 | bundle 仍打包 `bin/markdown-worker`；sidecar 构建链仍会编译它；Markdown 协议仍横跨桌面双阅读器 | 等阅读器协议有完整非 sidecar 原生替代后再考虑迁移 |
| PathBridge | Godot 同步、桌面早期 path producer、单窗口协同 | 桌面 Path Mode 下不行 | `server` 仍初始化 `PathBridge`；前端仍会为 Godot 预热 early bridge websocket | 若未来要抽象渲染器，应单独作为架构项目推进 |
| Android 构建链耦合 | Android helper 在 `tauri android dev/build` 前仍调用 `build:sidecar` | 可以部分解耦，但目前还没完成 | 运行时已关闭 `externalBin`，但 helper 脚本仍复用桌面 sidecar 预处理 | 先把 Android helper 准备流程从桌面 sidecar 准备流程中拆出，再重验 dev/build 目标 |

## LFS 决策表

这一层才是针对当前仓库状态的实际工程决策。

| 项目 | 架构状态 | LFS 状态 | 决策 | 原因 |
| --- | --- | --- | --- | --- |
| `src/frontend/data.js` | 已不再是默认运行时必需制品 | 仅剩历史 LFS 残留 | 继续保持从 repo head 移除 | runtime-first 流程和策略测试已经替代 bundled graph payload |
| `src/frontend/graph_data.json` | 已不再是默认运行时必需制品 | 仅剩历史 LFS 残留 | 继续保持从 repo head 移除 | 与 `data.js` 相同；移动端可行性已不再依赖 APK 内置 cache |
| `src-tauri/bin/godot-x86_64-pc-windows-msvc.exe` | 仍属于桌面主架构必需项 | 当前仍在 legacy LFS 允许名单中 | 下一步优先迁出 LFS | release CI 已能外部物化 Godot，本地 bootstrap 也已支持缓存 / override / 下载 |
| `src-tauri/bin/server-x86_64-pc-windows-msvc.exe` | 仍属于桌面主架构必需项 | 当前仍在 legacy LFS 允许名单中 | 之后迁出 LFS，不宜第一批 | sidecar 架构仍保留，但 fresh checkout 的本地可重复物化还需要更强保证 |
| `src-tauri/bin/server-x86_64-unknown-linux-gnu` | 仍属于 Linux 桌面打包必需项 | 当前仍在 legacy LFS 允许名单中 | 之后迁出 LFS，不宜第一批 | release CI 可在 Linux runner 构建，但本地与发布物化保证仍需继续显式化 |
| `src-tauri/bin/server-aarch64-apple-darwin` | 仍属于 macOS 桌面打包必需项 | 当前仍在 legacy LFS 允许名单中 | 之后迁出 LFS，不宜第一批 | 原因同 Linux/Windows server binary；这是二进制可获得性问题，不是架构替代问题 |
| `src-tauri/bin/markdown-worker-*` | 仍属于桌面阅读器协议必需项 | 当前并未被 LFS 跟踪 | 现在不是 LFS 阻塞项 | 保持当前本地构建路径，不要把它误判成剩余 LFS 债务 |
| `src/core/PathBridge.ts` | 仍属于桌面 Godot 同步必需项 | 源码文件，不走 LFS | 现在不是 LFS 阻塞项 | 它是架构依赖，但不是二进制存储依赖 |
| `src-tauri/bin/node-x86_64-pc-windows-msvc.exe` | 已退出当前架构 | 只在历史 `git lfs ls-files` 输出中残留 | 继续保持移除 | 策略与 repo-head 校验都已把它当成死亡残留，而不是现役阻塞项 |

运行含义：

- 桌面核心依赖仍然要求“制品可获得”
- 但“制品可获得”并不等于必须继续使用 Git LFS
- 因此当前正确路径是“分阶段移除 LFS + 强化 bootstrap 保证”，而不是“删除桌面主架构”

## 当前仍存在的跨平台摩擦

这些不是当前 LFS 切片的阻塞项，但它们是代码里已经能看到的真实构建风险：

- `build_apk.bat` 仍是 Windows-only，因此 Capacitor helper 还没有统一成跨平台入口。
- `package.json` 中的 `tauri:dev:gpu`、`tauri:dev:mini:gpu`、`tauri:android:dev:universal`、`tauri:android:build:universal` 仍使用 Windows `set VAR=...&&` 语法。
- npm publish 与 Tauri bundle 仍存在前端重复构建。

这些应该作为后续工程项去治理，而不是作为恢复 Git LFS 图谱大文件的理由。

## 建议的后续动作

1. 保持 Phase 1 图谱载荷清理结果不回退，并把 runtime-first 固化为默认产品契约。
2. 保留新的显式 full Tauri 构建契约，并让它持续处于迁移测试覆盖中。
3. 不再把“APK 里是否内置 graph cache”当作移动端可行性的唯一判断标准。
4. 下一阶段迁移重点转向 sidecar bootstrap 的可重复性，尤其是桌面 fresh checkout。
5. 如果要改善跨平台本地构建体验，应优先把 Windows-only helper 换成 Node runner，而不是回退到重新依赖 Git LFS。

## 验证清单

- `npx jest src/tauri.frontend.build.contract.test.ts --runInBand`
- `npm run docs:diataxis:check`
- `npm run docs:site:build`
- `npm run test:migration`
- `npm run build`
- `npm run build:full`
- `npm run verify:lfs:policy`
