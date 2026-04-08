# 2026-04-08 v1.7.0 - 反脆弱 Sidecar 供给策略

## 中文文档

### 为什么需要这份文档

当前桌面产品线仍然依赖 `Node sidecar + Godot + markdown-worker + PathBridge`。
这并不自动等于项目必须永久依赖 Git LFS。
它只意味着桌面构建仍然需要稳定、可验证的产物供给。

真正的工程问题是：

- 产物可得性是否还要继续依赖“仓库存放大二进制”，还是
- 应该迁移到更稳健的供给路径，也就是带缓存、镜像、校验与离线种子的物化链路？

本文选择后者，但明确反对一种天真的替代方式：把 LFS 直接换成“从公网下载就好”。

### 应该明确否定什么

以下迁移方向应视为劣解：

- 清掉历史 LFS 残留
- 只保留第三方直连下载
- 假设所有源码构建者都稳定联网

这条路为什么弱：

- 新机器 fresh checkout 会直接暴露在区域网络、代理与 GitHub 可用性波动之下
- 本地 bootstrap 与 CI 容易演化成两套不同的信任模型
- 失败只是从 `git clone` 后移到 `prepare/build`，并没有真正消失
- Windows 桌面 bootstrap 会更脆，因为当前缺失 Godot 仍然会直接打断关键路径

当前代码证据：

- `scripts/ensure-godot-sidecar.js`
- `scripts/tauri-sidecar-utils.js`
- `.github/workflows/release-desktop-multi-os.yml`
- `scripts/build-sidecar.js`
- `scripts/build-markdown-worker.js`

### 更好的方向

推荐方向是：

- 暂时保持桌面架构不动
- 分阶段压缩 LFS
- 让 sidecar 供给变成**缓存优先、镜像感知**
- 保留人工离线种子路径
- 让本地 bootstrap 与 CI 尽量共享同一套来源与校验模型

这条路比两个极端都更强：

- 比“所有东西永久留在 LFS”更强
- 也比“删掉 LFS 后改成完全依赖公网”更强

### 供给阶梯

桌面 sidecar 产物的推荐获取顺序应为：

1. 当前主机目标路径已存在且校验通过
2. 本地缓存已存在且校验通过
3. 项目自控镜像且带固定摘要
4. 在适合的宿主机上本地源码构建
5. 人工离线种子包

应否定的顺序：

1. 优先直连上游公共下载源
2. 一旦无网就失败

### 当前仓库判断

#### 应保留为架构边界，而不是继续当作永久 LFS 存储

- `server-*`
- `godot-*`
- `markdown-worker-*`
- `PathBridge.ts`

#### 已经从默认运行时退出，不应重新回到 repo-head

- `src/frontend/data.js`
- `src/frontend/graph_data.json`

#### 最适合先迁出的 LFS 目标

- `src-tauri/bin/godot-x86_64-pc-windows-msvc.exe`

原因：

- release CI 已经会在 repo-head 之外物化 Godot
- 本地 bootstrap 已经支持候选路径、缓存与固定下载

#### 不适合作为第一批迁出的 LFS 目标

- `src-tauri/bin/server-*`

原因：

- 桌面架构当前仍然依赖它们
- 在移除剩余历史桥接前，项目仍需要更强的 fresh checkout 可重复性保证

### 本轮新增的代码护栏

#### 新增 verifier

执行：

```bash
npm run verify:sidecar:supply
```

可选 JSON 输出：

```bash
npm run verify:sidecar:supply -- --json
```

它会报告：

- 当前主机的桌面 bootstrap 是否已经具备离线就绪度
- 当前 Godot bootstrap 是否仍然需要网络才能完成
- release CI 是否仍在直接访问第三方上游下载
- 哪些历史受保护 LFS 路径还存在

核心代码：

- `scripts/sidecar-supply-readiness-utils.js`
- `scripts/verify-sidecar-supply-readiness.js`

#### 新增契约覆盖

- `src/sidecar.supply.readiness.contract.test.ts`
- `src/sidecar.replacement.boundary.contract.test.ts`
- `src/lfs.asset.policy.contract.test.ts`

### 真实云端执行证据

2026-04-08 这条 mirror-first 链路已经在真实 GitHub Actions release run 中被执行，而不只是停留在本地测试：

- `smoke-lfs-mirror-first-20260408-002012` 暴露了 no-checkout 镜像 job 里的 `gh release create/upload` 仍在依赖本地 `.git` 推断仓库上下文；同时也暴露出 Android 回归，因为宿主机校验一度错误地把 Linux Godot 变成了 Android 构建前置。
- `smoke-lfs-mirror-first-20260408-002917` 证明 Android 侧的护栏修正已生效，但也进一步暴露 `gh release view/create/upload` 在镜像 job 里仍需要显式绑定 `--repo "$GITHUB_REPOSITORY"`。
- `smoke-lfs-mirror-first-20260408-003325` 随后已经冷启动创建并补齐了专用的 `godot-mirror-v4.3-stable` release，其中包含 Windows、Linux、macOS 三个平台的 Godot 归档；同一次 run 中，Windows、macOS、Linux、Android 全部 release job 最终都成功完成，并上传了预期的桌面安装包/发行包与通用 Android APK。

这证明了什么：

- 项目自控镜像补种已经是真实 workflow 行为，不再只是方案描述
- mirror-first 供给可以在不拆掉桌面 sidecar 架构的前提下落地
- 当前主要风险已经从“能不能做”转向“供给链怎么继续加固、发布治理债务怎么收口”

### 在严格 no-LFS 之前必须先解决的风险

1. 当前 CI 已经会先维护并优先使用项目自控的 GitHub Releases Godot 镜像，而且真实 smoke run 已经证明镜像可以冷启动创建；但迁移期仍保留上游回退，且尚未对归档文件做 digest 固定。
2. 本地与 CI 的产物信任模型还没有完全统一。
3. Windows 开发者 bootstrap 对缺失 Godot 仍然敏感，因为当前 bootstrap 把它视为必要项。
4. `server-*` 的可得性仍依赖本地构建可重复性，或依赖历史 LFS 过渡桥接。
5. release smoke 日志里已经出现一个非阻塞平台预警：`actions/upload-artifact@v4` 与 `softprops/action-gh-release@v2` 仍是 Node 20 目标，目前只是被 GitHub Actions 强制映射到 Node 24 才继续运行。

### 镜像方案可行性矩阵

当前代码库在尝试镜像化 Godot 供给前，并不需要先做 provider-specific 重构。
`scripts/tauri-sidecar-utils.js` 已经支持：

- `NOTE_CONNECTION_GODOT_DOWNLOAD_URL`
- `NOTE_CONNECTION_GODOT_DOWNLOAD_SHA256`
- `NOTE_CONNECTION_GODOT_CACHE_DIR`

这意味着在当前 bootstrap 契约里，GitHub Releases、通用 HTTPS 对象存储和本地文件种子都属于同一类来源。

| 方案 | 基础设施成本 | 用户门槛 | 维护者成本 | 与当前代码契合度 | 建议 |
|---|---|---|---|---|---|
| 继续把剩余桌面 sidecar 放在 Git LFS | 已在随带宽压力上升 | 低 | 现在低，后续更差 | 当前可用 | 仅过渡 |
| 用 GitHub Releases 作为第一镜像 | 通常是最低额外成本 | 低 | 低 | 很强 | 已落地第一步 |
| 用 R2/B2 这类通用对象存储镜像 | 低到中等持续成本 | 低 | 中等 | 很强 | 第二优先 |
| 只保留第三方上游直连下载 | 直接托管成本低 | 中到高 | 中等 | 技术上可行 | 应否定 |
| 自建完整镜像/CDN | 中到高 | 低 | 高 | 技术上可行 | 当前阶段应否定 |

重要边界：

- GitHub Releases 很接近当前维护模型，因为仓库已经在 release 流程里创建 release 并上传应用包。
- release workflow 现在也会在桌面构建前把独立的 Godot 镜像归档补到一个专用镜像 tag 中，而且这一行为已经在 2026-04-08 的真实 smoke run 中被证明。
- 但这条链路还没有完全加固，因为 CI 里还没有做归档 digest 固定，且仍保留上游回退。
- 第一阶段迁移不需要额外付费镜像服务，因为 GitHub Releases 已经与当前项目维护面天然对齐。
- 通用 HTTPS 对象存储现在也具备技术可行性，因为 bootstrap 只依赖 URL + SHA256 + cache，而不依赖特定厂商 API。

### 建议的分阶段路线

#### Phase A：先把可观测性与策略显式化

- 保持当前以运行时为先的测试与 sidecar 边界测试
- 用 `verify:sidecar:supply` 把网络依赖显式化，而不是继续让它隐含存在

#### Phase B：先加固 Godot 供给

- 让 CI 与本地 bootstrap 朝共享镜像 + 摘要校验策略收敛
- 保留缓存与人工离线种子支持
- 只有在移除上游回退并验证镜像/bootstrap 对齐后，才把 Godot 从历史 LFS 中移除

#### Phase C：再解决 server 产物可重复性

- 让受支持桌面宿主机上的 fresh checkout `server-*` 物化变得可重复
- 只有完成这一点，才移除剩余 `server-*` LFS 路径

#### Phase D：最后进入严格终态

- 从“允许历史豁免”的校验，切换到对受保护目录执行严格 no-LFS

### 结论

真正该问的问题不是：

- “桌面 sidecar 架构现在能不能直接删掉？”

真正该问的问题是：

- “桌面必需产物能否在不永久依赖 repo-head LFS 的前提下被稳定供应？”

当前答案：

- 架构删除：不能
- 采用反脆弱供给链来分阶段缩减 LFS：可以，但前提是必须同时具备缓存、镜像、校验与离线种子支持
