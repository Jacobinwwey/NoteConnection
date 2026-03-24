# 参考：接口与运行时契约

本页用于集中查看权威 API/运行时契约。

## 主要契约文档

- [docs/zh/Interface Document.md](../../../zh/Interface%20Document.md)
- [docs/zh/User_Manual.md](../../../zh/User_Manual.md)

## v1.6.0 关键运行时契约点

- 前端运行时能力水合 invoke 契约：
  - `invoke('get_runtime_capabilities')`
  - `invoke('get_sidecar_runtime_config')`
- Rust sidecar 运行时配置命令：
  - `get_sidecar_runtime_config`
- Runtime bridge 通过 `whenReady()` 保障调用时序。

## 策略门禁族

- PathBridge 严格 schema
- Storage provider 合约
- 移动端运行时边界合约
- SBOM + attestation 策略合约
- Sidecar 签名与隐私清单合约
