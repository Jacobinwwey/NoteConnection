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
- 当前 release workflow 也已经会在使用镜像前，对 Windows、Linux、macOS 三份 Godot 归档执行固定 SHA256 校验。
- 同一条 release workflow 现在也暴露了 `allow_godot_upstream_fallback`，可以在 mirror-only smoke 中关闭上游回退，而不改变默认发布路径。
- 仍有一个非阻塞的 release 治理风险：GitHub Actions 已提示 `actions/upload-artifact@v4` 与 `softprops/action-gh-release@v2` 仍是 Node 20 目标。

## 适用场景

- 判断某一迁移项是否会同时影响桌面、移动、发布和 release 面
- 确认某条构建命令到底是 runtime-first 还是显式 full-mode
- 核查某个平台是否仍依赖 repo-head LFS 资产

## 相关文档

- [Git LFS 资产迁移](../explanation/git-lfs-asset-migration.md)
- [引导 Godot Sidecar](../how-to/bootstrap-godot-sidecar.md)
- [发布与治理](release-and-governance.md)

## Mobile Slim 契约（2026-08-17）

`mobile-slim` 现在是可执行的打包 profile，不再只是导出标签。

- `npm run mobile:prepare:slim` 先构建 runtime-first 前端，只 staging `dist/mobile-slim/frontend`，排除生成图 payload、桌面专用 Mermaid/GPU 资源、SVG、模型文件和二进制 sidecar，并生成 `dist/mobile-slim/mobile-slim-manifest.json`。
- Capacitor 通过 `NOTE_CONNECTION_MOBILE_WEB_DIR` 消费同一 staging 目录；Tauri Android 通过 `src-tauri/tauri.android.conf.json` 消费同一目录。瘦身路径不再构建 Node sidecar。
- 移动运行时通过 storage boundary 读取本地 `graph_data.json`，提供有界 exact lookup、邻居查询和有向最短路径：`queryKnowledgeBaseExact()`、`findKnowledgePath()`。分析器只保留投影后的节点元数据，不保留文档正文。
- `mobile-slim` 明确声明本地 ingest/exact query 可用，远程推理仅为可选能力，SVG materialization 不支持；估算压缩资源门禁为 25 MiB，低内存 RSS 门禁为 256 MiB。
- 静态 verifier 会报告 ZIP-deflate 估算字节并拒绝禁入物。没有真机 evidence JSON 时 RSS 状态必须是 `not-measured`；静态门禁通过不等于设备验收通过。
- Godot Pathmode 改为显式扩展档（`NOTE_CONNECTION_ANDROID_INCLUDE_GODOT_PATHMODE=1`）。默认 Android runner 会移除生成工程中的 Godot bridge、依赖声明和 `path_mode` 资源，避免旧生成目录悄悄放大 slim 包体。

本切片不宣称移动端本地 LLM parity 或 SQLite 持久化已经完成。当前移动投影是对有界本地图的 exact 内存索引；SQLite 持久化和完整 agent conversation parity 仍是后续独立契约阶段。
