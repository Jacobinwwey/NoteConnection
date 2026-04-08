# 解释：Sidecar 供给可行性

本页用于说明：对 NoteConnection 剩余桌面 sidecar 资产而言，哪些镜像/供给方案在当前代码下是真正可行的，以及它们分别会给用户门槛和维护成本带来什么影响。

## 核心约束

当前桌面产品线仍然依赖：

- `server-*`
- `godot-*`
- `markdown-worker-*`

所以这里真正要回答的问题不是孤立的“要不要上镜像”，而是：

- 如何在不永久依赖 repo-head Git LFS 的前提下稳定供给这些产物，同时
- 不把过多脆弱性转嫁给用户或维护者？

## 当前代码已经支持什么

现有 Godot bootstrap 路径本身已经是 provider-neutral 的：

- `scripts/tauri-sidecar-utils.js` 支持 `NOTE_CONNECTION_GODOT_DOWNLOAD_URL`
- 同一路径支持 `NOTE_CONNECTION_GODOT_DOWNLOAD_SHA256`
- 下载结果可通过 `NOTE_CONNECTION_GODOT_CACHE_DIR` 进入本地缓存
- 实现接受通用 `http`、`https`、`file` URL
- 在下载前会先检查本地候选路径与缓存

这意味着 GitHub Releases、Cloudflare R2、Backblaze B2，甚至自建 HTTPS 镜像，在当前 Godot bootstrap 契约里都属于同一类来源。
当前代码**并不需要**先做 provider-specific 重构，才能接入这些来源。

契约证据：

- `scripts/tauri-sidecar-utils.js`
- `scripts/ensure-godot-sidecar.js`
- `src/godot.sidecar.bootstrap.contract.test.ts`
- `src/sidecar.supply.readiness.contract.test.ts`

## 可行性矩阵

| 方案 | 额外基础设施费用 | 用户门槛 | 维护者成本 | 与当前代码契合度 | 当前缺口 | 判断 |
|---|---|---|---|---|---|---|
| 继续把桌面 sidecar 放在 Git LFS | 已经在持续消耗带宽/存储成本 | 低 | 现在低，后续会升高 | 已有 | LFS 带宽仍是瓶颈 | 仅适合作为过渡 |
| 用 GitHub Releases 作为第一镜像 | 通常是最低额外成本 | 低，只要不把下载责任推给运行时用户 | 低 | 很强 | 当前 release workflow 已会维护专用 Godot 镜像 tag，也已经对归档做固定 SHA256 校验，但仍保留上游回退 | 当前最合适 |
| 用通用对象存储镜像（R2/B2） | 低到中等持续成本 | 低，只要仍由缓存/bootstrap 脚本透明处理 | 中等 | 很强 | 需要上传自动化、凭据管理与清理策略 | 适合作为第二步 |
| 只保留第三方上游直连下载 | 直接托管成本低 | 中到高 | 中等 | 对 Godot 来说技术上可行 | 对网络过于敏感，且会让信任模型分裂 | 应否定 |
| 自建完整镜像/CDN | 中到高 | 对用户低 | 高 | 技术上兼容 | 基础设施维护会反客为主 | 当前阶段应否定 |

## 这在工程上意味着什么

### 1. GitHub Releases 现在就具备技术可行性，而且首个 CI 切片已经落地

原因：

- 仓库已经在 `.github/workflows/release-desktop-multi-os.yml` 中创建并上传 GitHub Releases
- bootstrap 已支持固定下载 URL 与本地缓存
- 这条路最贴近当前项目已经采用的 GitHub 中心化维护模型
- release CI 现在会在桌面 bundle job 启动前先维护专用的 `godot-mirror-v4.3-stable` 镜像 tag
- 桌面 bundle job 现在会以“镜像优先、上游回退”方式下载 Godot

仍然缺的部分：

- 在镜像链路验证稳定后移除上游回退
- 在 Godot 版本升级时建立受控的摘要轮换与验证治理

云端验证快照：

- `smoke-lfs-mirror-first-20260408-002012` 与 `smoke-lfs-mirror-first-20260408-002917` 先后暴露了镜像 job 的真实冷启动问题，这比只靠 mock 建立信心更有价值
- 这些 run 直接推动了 `.github/workflows/release-desktop-multi-os.yml` 与 `scripts/tauri-sidecar-utils.js` 的定点修正
- `smoke-lfs-mirror-first-20260408-003325` 随后已经冷启动创建并补齐 `godot-mirror-v4.3-stable`，并让完整的 Windows/macOS/Linux/Android release 矩阵经由 mirror-first 主路径完成
- 第一阶段镜像化并不需要额外付费基础设施，因为 GitHub Releases 已经处在项目现有维护路径上

### 2. R2/B2 现在也具备技术可行性

原因：

- bootstrap 不关心二进制具体由哪个 HTTPS 主机托管
- checksum 固定与缓存复用已经属于当前契约的一部分

仍然缺的部分：

- 对象上传自动化
- 凭据管理
- 生命周期/版本清理策略
- 是否保留 GitHub Releases 作为 fallback 的决策

### 3. 纯下载替代不是正确优化方向

这种方案看上去省钱，但会把成本挪到更糟糕的位置：

- bootstrap 失败模式更多
- 对区域网络更敏感
- 当开发者无法物化所需二进制时，支持成本会上升

所以，仅仅“下载 URL 能工作”并不等于迁移是安全的。

## 推荐顺序

1. 在 `server-*` 可重复物化能力更强之前，保留当前临时桥接。
2. 把 GitHub Releases 视为 Godot 的第一镜像候选，因为它最符合当前项目维护模型。
3. 只有在真实下载可靠性或区域访问数据表明 GitHub 不够稳定时，再补 R2/B2 这类对象存储镜像。
4. 无论选哪种镜像，都保留缓存优先与离线种子路径。
5. 不要把这部分负担转移到应用首启或普通用户运行时。

## 结论

从技术上可行的选择，并不只剩“付费上镜像”和“永远继续用 LFS”这两个极端。

当前仓库已经支持一条更低风险的路线：

- 第一镜像候选：GitHub Releases
- 第二阶段加固：通用 HTTPS 对象存储镜像
- 不可妥协的护栏：本地缓存、SHA256 固定摘要、离线种子
- 非阻塞但真实存在的维护债务：release 日志已经提示 `actions/upload-artifact@v4` 与 `softprops/action-gh-release@v2` 仍是 Node 20 目标，目前依赖 GitHub 的 Node 24 强制运行兼容层

真正错误的方向，是删掉 LFS 之后只保留对公共上游的直接下载。
