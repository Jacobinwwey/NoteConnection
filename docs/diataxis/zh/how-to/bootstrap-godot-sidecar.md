# 操作指南：本地引导 Godot Sidecar

当 `bin/godot` 不再依赖 Git checkout 自带，而你又需要为 Tauri 桌面工作流准备一个可重复的本地引导路径时，请使用本指南。

## 什么时候需要它

- `npm run tauri:dev`
- `npm run tauri:build`
- `npm run prepare:godot:bin`
- 任何需要物化主机平台 `src-tauri/bin/godot-*` 的本地流程

## 现在的引导顺序

`scripts/ensure-godot-sidecar.js` 现在按以下顺序解析主机 Godot sidecar：

1. 已存在且有效的 `src-tauri/bin/godot-*`
2. 通过 `NOTE_CONNECTION_GODOT_EXE` 指定的本地覆盖路径
3. 通过 `NOTE_CONNECTION_GODOT_SEARCH_DIRS` 指定的搜索目录
4. 主机搜索启发式路径（如 `Downloads`、常见 bin 路径、macOS app bundle）
5. `NOTE_CONNECTION_GODOT_CACHE_DIR` 下的缓存文件
6. 通过 `NOTE_CONNECTION_GODOT_DOWNLOAD_URL` 指定的固定下载地址

共享校验逻辑现在也会按主机平台校验 Godot 文件名，不再只盯 Windows 版本名。

## 推荐的固定下载引导

在执行 `npm run prepare:godot:bin` 前先设置：

```bash
export NOTE_CONNECTION_GODOT_DOWNLOAD_URL="https://<固定主机二进制下载地址>"
export NOTE_CONNECTION_GODOT_DOWNLOAD_SHA256="<固定 sha256>"
export NOTE_CONNECTION_GODOT_CACHE_DIR="$HOME/.cache/noteconnection/godot"
```

然后执行：

```bash
npm run prepare:godot:bin
node scripts/validate-tauri-sidecars.js
```

## 手动覆盖路径

如果你已经有本地 Godot 可执行文件：

```bash
export NOTE_CONNECTION_GODOT_EXE="/absolute/path/to/godot"
npm run prepare:godot:bin
```

额外搜索路径也可以显式指定：

```bash
export NOTE_CONNECTION_GODOT_SEARCH_DIRS="/opt/tools:/mnt/shared/godot"
```

## 缓存目录

- Linux/macOS 默认：`~/.cache/noteconnection/godot`
- Windows 默认：`%LOCALAPPDATA%\\NoteConnection\\cache\\godot`
- 覆盖变量：`NOTE_CONNECTION_GODOT_CACHE_DIR`

## 完整性约束

- 如果设置了 `NOTE_CONNECTION_GODOT_DOWNLOAD_SHA256`，下载或缓存命中的 Godot 二进制都必须匹配该值。
- 一旦 checksum 不匹配，引导会在复制到 `src-tauri/bin` 前失败。
- 对于远程 `http(s)` 下载，强烈建议固定 checksum。

## 强制校验说明

- `npm run prepare:godot:bin` 负责引导，不是最终的 sidecar 准入 gate。
- 在 Linux/macOS 上，如果缺少 Godot 且未设置 `NOTE_CONNECTION_GODOT_REQUIRED=1`，该步骤可能只告警并以 `0` 退出。
- 需要 fail-fast 时，请继续执行 `node scripts/validate-tauri-sidecars.js`、`npm run build:sidecar`，或显式设置 `NOTE_CONNECTION_GODOT_REQUIRED=1`。

## Fresh Checkout 预期

在当前 Linux 审计主机上的原始仓库 checkout，真实验证结果如下：

- `npm run prepare:godot:bin` 会因本机尚无可用 Godot 而告警，并以 `0` 退出。
- `npm run verify:tauri:bin` 会失败，因为 `server-x86_64-unknown-linux-gnu` 仍只是 Git LFS pointer 占位文件，而 `markdown-worker-x86_64-unknown-linux-gnu` / `godot-x86_64-unknown-linux-gnu` 也还没有被物化出来。

这应被视为当前阶段的预期行为，而不是图谱载荷清理打坏了 Tauri 打包链路。对于 fresh checkout，请继续执行本机 sidecar 物化步骤，例如 `npm run build:sidecar`，并提供可用的本地 Godot 或固定下载源。

## 对 CI / Release 的影响

- 这一批 bootstrap 改动不需要改 GitHub Actions workflow。
- 现有 release CI 保持原设计不变。
- 本页服务于本地开发者 bootstrap 和后续仓库 / LFS 解耦工作。

## 权威来源

- [docs/zh/lfs_asset_migration_plan.md](../../../zh/lfs_asset_migration_plan.md)
- 仓库实现来源：`scripts/ensure-godot-sidecar.js`、`scripts/tauri-sidecar-utils.js`、`scripts/validate-tauri-sidecars.js`
