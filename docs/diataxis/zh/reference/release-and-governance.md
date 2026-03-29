# 参考：发布与治理

## 发布对比基线

- 对比范围：`v1.3.0..v1.6.0`
- 提交数：`107`
- 变更文件数：`301`
- 代码/文档变更量：`+125,957 / -10,083`

## 权威发布文档

- [docs/zh/release_v1.6.0_report.md](../../../zh/release_v1.6.0_report.md)
- [docs/release_notes_v1.6.0.md](../../../release_notes_v1.6.0.md)
- [docs/release_notes_v1.6.7.md](../../../release_notes_v1.6.7.md)

## 治理控制面

- FixRisk 运维就绪工作流
- Migration gates 工作流
- Mobile e2e detox 合约工作流
- NPM 发布策略门禁（SBOM + attestation）
- Sidecar 签名与隐私策略校验
- 文档发布工作流：
  - `.github/workflows/docs-github-pages-publish.yml`
- 文档发布与回滚运行手册：
  - [`docs/zh/docs_release_and_rollback.md`](../../../zh/docs_release_and_rollback.md)

## 文档治理控制面

- Diataxis 映射真源：
  - [docs/diataxis-map.json](../../../diataxis-map.json)
- 映射校验命令：
  - `npm run docs:diataxis:check`
- 一键文档发布命令：
  - GitHub Actions 工作流：`Docs GitHub Pages Publish`
