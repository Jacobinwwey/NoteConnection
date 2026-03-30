# 参考：接口与运行时契约

本页用于集中查看权威 API/运行时契约。

## 主要契约文档

- [docs/zh/Interface Document.md](../../../zh/Interface%20Document.md)
- [docs/zh/User_Manual.md](../../../zh/User_Manual.md)

## 集成专题参考

- [Godot + NoteMD + Markdown 接口](./godot-notemd-markdown-interfaces.md)
- [Godot + NoteMD + Markdown 工作流](../how-to/godot-notemd-markdown-workflows.md)

## v1.6.0 关键运行时契约点

- 前端运行时能力水合 invoke 契约：
  - `invoke('get_runtime_capabilities')`
  - `invoke('get_sidecar_runtime_config')`
- Rust sidecar 运行时配置命令：
  - `get_sidecar_runtime_config`
- Rust 应用运行时配置命令：
  - `get_app_runtime_config`
- Runtime bridge 通过 `whenReady()` 保障调用时序。

## Mermaid 标准兼容基线（Obsidian）

- 标准兼容格式：fenced code block，起始行为 ` ```mermaid`，结束行为 ` ``` `。
- Godot 运行时渲染保持 PNG-first；Mermaid 渲染偏好需允许回退（`auto`），避免仅 bridge 可用时才成功。
- 字段级路由与契约细节：
  - [Godot + NoteMD + Markdown 接口](./godot-notemd-markdown-interfaces.md)

## app_config 运行时契约挂载点

- 前端配置水合命令：
  - `invoke('get_app_runtime_config')`
- 水合后的投影：
  - `window.__NC_APP_CONFIG.language`
  - `window.__NC_APP_CONFIG.multiWindow.*`
- 详细结构请见：
  - [app_config.toml 结构](./app-config-schema.md)

## 策略门禁族

- PathBridge 严格 schema
- Storage provider 合约
- 移动端运行时边界合约
- SBOM + attestation 策略合约
- Sidecar 签名与隐私清单合约
