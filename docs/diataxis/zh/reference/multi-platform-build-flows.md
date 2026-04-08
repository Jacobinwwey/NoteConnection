# 参考：多平台构建流程

本页是当前多平台构建矩阵的 Diataxis 参考入口，也是 Git LFS 迁移判断所依赖的构建基线索引。

## 权威来源

- [docs/zh/multi_platform_build_flow_audit.md](../../../zh/multi_platform_build_flow_audit.md)

## 本参考覆盖内容

- 源码 Web 构建与显式 full-graph 构建行为
- 桌面 Tauri 开发/打包流与 sidecar 所有权
- Android Capacitor 打包流
- Android Tauri 原生运行时/构建流
- GitHub Release、npm publish 与文档站点交付流水线

## 当前高价值结论

- 默认源码构建契约已经是 runtime-first。
- 显式 full-mode 仍被支持，而且 Tauri full bundle 现在可以在 `beforeBuildCommand` 阶段保留 full-mode。
- 桌面 bundle 仍把 sidecar 二进制视为独立 bootstrap 事项。
- 移动端打包内容和移动端运行时能力必须分开判断。
- docs 与 npm publish 流水线已经与当前 no-new-LFS 方向兼容。
- 2026-04-08 的 release smoke 已经证明：workflow 可以在桌面 bundle job 启动前冷启动创建并补齐项目自控的 `godot-mirror-v4.3-stable` tag。
- 仍有一个非阻塞的 release 治理风险：GitHub Actions 已提示 `actions/upload-artifact@v4` 与 `softprops/action-gh-release@v2` 仍是 Node 20 目标。

## 适用场景

- 判断某一迁移项是否会同时影响桌面、移动、发布和 release 面
- 确认某条构建命令到底是 runtime-first 还是显式 full-mode
- 核查某个平台是否仍依赖 repo-head LFS 资产

## 相关文档

- [Git LFS 资产迁移](../explanation/git-lfs-asset-migration.md)
- [引导 Godot Sidecar](../how-to/bootstrap-godot-sidecar.md)
- [发布与治理](release-and-governance.md)
