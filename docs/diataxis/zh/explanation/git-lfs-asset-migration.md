# 解释：Git LFS 资产迁移

本页用于说明 NoteConnection 为什么需要把大型图谱生成产物与 sidecar 二进制从 Git LFS 中迁出，以及这次迁移与当前运行时架构之间的关系。

## 为什么要做这次迁移

仓库当前主要有两类 LFS 资产：

- `data.js`、`graph_data.json` 这类图谱生成产物
- `src-tauri/bin/` 下的 sidecar 二进制

这种模型会带来两个直接问题：

- 即使运行时已经支持在别处生成或物化这些资产，仓库级 clone/fetch 仍会持续消耗 Git LFS 带宽。
- 仓库把源码与重量级交付产物混在一起，而这些产物更适合交给运行时生成、本地 bootstrap 或 release 打包流程管理。

## 为什么现在适合推进

当前代码已经具备大部分迁移基础：

- runtime 图谱资产会被写入 `runtime_data`
- 当预打包图谱产物缺失时，启动链路已经支持 mini / first-run 模式
- release 自动化已经通过 `lfs: false` 构建，并在各 runner 上下载对应平台的 Godot 二进制

第一批契约清理已经落地：

- 默认源码构建已切到 runtime-first 资产路径
- 预打包图谱改为 `*:full` 显式 opt-in
- pkg 打包已不再假设 `data.js` / `graph_data.json` 必须内置
- `copy-assets.js` 已会在 `lfs: false` checkout 下跳过 Git LFS pointer 占位文件
- 仓库头部已不再保留 `src/frontend/data.js` 与 `src/frontend/graph_data.json`
- `verify-lfs-asset-policy.js` 已可阻止新的受保护 LFS 路径回流，而不必立刻改造现有 CI workflow
- 仓库头部已移除死掉的 `node-x86_64-pc-windows-msvc.exe` LFS 残留

剩余工作主要是：

- 去掉过时的打包假设
- 补强本地 sidecar bootstrap

## 移动端复核结论

当前迁移说明还需要补一个明确的移动端纠偏结论：

- 最新公开 Android 工件 `v1.7.0` `app-universal-release-unsigned.apk` 看起来并没有内置 `data.js`、`graph_data.json`、目标缓存变体或 `Knowledge_Base`
- 这个 APK 来自 Tauri Android release workflow，而不是旧的 Capacitor 打包路径
- 这并不代表移动端已经失去本地图谱构建能力
- Capacitor 原生运行时在具备 Filesystem API 时，仍可本地构建图谱载荷
- Tauri Android 运行时也可以通过 `build_graph_runtime` 本地构建图谱，并写入 `runtime_data`

所以，这次迁移不能简单理解成“移除 bundled graph payload，移动端就会坏掉”。更准确的判断是：

- 移动端打包本身已经在朝“不预置 graph cache”演进
- 移动端是否可用，更多取决于运行时能否访问内容源，以及本地构建的资源/权限边界，而不是仓库里是否继续保留那几个大图谱文件

## 什么会变，什么不会变

这次迁移会按阶段推进：

- 先把图谱生成产物移出仓库默认交付路径
- 再把 sidecar 二进制移出仓库
- 最后才考虑 Git 历史清理

这个顺序的设计目标是避免打坏现有用户路径。真正的高风险区域在本地开发与 bootstrap，不在已安装 release。

## 解释类权威来源

- [docs/zh/lfs_asset_migration_plan.md](../../../zh/lfs_asset_migration_plan.md)
- [docs/zh/multi_platform_build_flow_audit.md](../../../zh/multi_platform_build_flow_audit.md)
- [Sidecar 供给可行性](./sidecar-supply-feasibility.md)
- [docs/zh/tauri_brainstorming.md](../../../zh/tauri_brainstorming.md)
- [docs/zh/electron_migration_analysis.md](../../../zh/electron_migration_analysis.md)
