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
## 存储 Provider 解析（2026-09-02）

SQLite 功能继续保留在桌面/服务端运行时。Node sidecar 以 Node 22 为目标，默认请求内置 `node:sqlite` adapter。如果该模块不可用，graph store 保留现有 file-backed snapshot fallback，并报告 `requestedProvider=sqlite`、`resolvedProvider=file` 与 `fallbackReason=sqlite_runtime_unavailable`；绝不会把 fallback 标记成 embedded SQLite store。

移动端打包继续保持 sidecar-free。Tauri Android 与 Capacitor 将存储解析为有界 `projection` provider（`graph_data.json` 加 exact analyzer），即使收到过期或手工注入的 SQLite capability 数据也不改变这一边界。运行时契约报告 `supports_sqlite=false`、`supports_projection=true` 以及明确的 `native_sqlite_runtime_unavailable` 原因。projection schema 与查询语义继续和桌面 replay fixture 共用。

前端先消费宿主 capability 数据；sidecar 可用时，再从 `/api/knowledge/store-diagnostics` 刷新桌面端真实解析结果。这把平台能力与权威 store resolution 分开，同时保持旧 `storageEngine` 诊断字段向前兼容。移动端 SQLite/WASM 提升仍受签名 arm64 进程死亡、SAF、RSS 与包体证据门禁约束。

## Sidecar 新鲜度（2026-09-03）

Host sidecar 复用现在以内容指纹为准，不再只依赖时间戳。成功执行 `build-sidecar.js` 后，会在 ignored 的 `src-tauri/bin` 目录写入 `.noteconnection-sidecar-build-manifest.json`。`ensure-sidecar-ready.js` 对 `dist/src` 与构建输入计算 manifest digest，并验证当前 host binary 在 target 列表中；manifest 缺失、过期、不可读或来自其他 target 时重建。这可以拦截时钟回拨、文件拷贝与过期 LFS binary 导致的 packaged SQLite 行为偏差，同时在输入未变时避免每次启动都重建。
