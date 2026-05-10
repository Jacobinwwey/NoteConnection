# 参考：发布与治理

本页是发布流水线、文档交付链路与学习平台质量门禁的治理索引。

## 1）发布基线与范围

- 历史发布对比基线：
  - `v1.3.0..v1.6.0`
  - `107` 次提交，`301` 个文件变更
- 当前交付上下文：
  - `v1.7.0` 之后以学习平台契约与运行时治理为主线推进

## 2）权威发布与规划文档

- [docs/zh/release_v1.6.0_report.md](../../../zh/release_v1.6.0_report.md)
- [docs/release_notes_v1.6.0.md](../../../release_notes_v1.6.0.md)
- [docs/release_notes_v1.6.7.md](../../../release_notes_v1.6.7.md)
- [docs/release_notes_v1.7.0.md](../../../release_notes_v1.7.0.md)
- [知识彻底掌握演进路线图](../explanation/knowledge-mastery-evolution-roadmap.md)
- [开发进度看板](../explanation/development-progress-dashboard.md)

## 3）CI/CD 治理工作流

- 文档校验：
  - `.github/workflows/docs-diataxis-site.yml`
- 文档发布：
  - `.github/workflows/docs-github-pages-publish.yml`
- 桌面/移动发布构建：
  - `.github/workflows/release-desktop-multi-os.yml`
- 迁移安全门禁：
  - `.github/workflows/migration-gates.yml`
- 运维就绪门禁：
  - `.github/workflows/fixrisk-operational-readiness.yml`
- npm 发布策略门禁：
  - `.github/workflows/npm-publish.yml`
- 移动端契约校验：
  - `.github/workflows/mobile-e2e-detox-contracts.yml`

## 4）学习平台治理链路

## 契约治理

- 接口层：
  - `src/learning/api.ts`
  - `src/learning/types.ts`
- 路由与归一化层：
  - `src/server.ts`
- 契约回归护栏：
  - `src/knowledge.api.contract.test.ts`

## 运行时治理

- 运行时能力矩阵端点：
  - `GET /api/knowledge/runtime-capability-matrix`
- 运行时 runbook 端点：
  - `GET /api/knowledge/runtime-capability-runbook*`
  - `POST /api/knowledge/runtime-capability-runbook/remediation-event`
- 请求诊断端点：
  - `GET /api/runtime-request-trace`

## 质量治理

- 学习质量端点：
  - `POST /api/knowledge/quality/snapshot`
  - `GET /api/knowledge/quality/history`
  - `GET /api/knowledge/quality/trend`
  - `GET /api/knowledge/quality/thresholds`
- 会话策略质量端点：
  - `POST /api/knowledge/session/plan/evaluate`
  - `GET /api/knowledge/session/plan/quality/history`
  - `GET /api/knowledge/session/plan/quality/trend`
  - `GET /api/knowledge/session/plan/quality/thresholds/runtime`

## 5）文档治理控制面

- 映射真源：
  - [docs/diataxis-map.json](../../../diataxis-map.json)
- 映射门禁：
  - `npm run docs:diataxis:check`
- 站点构建门禁：
  - `npm run docs:site:build`
- 本地迭代维护：
  - `npm run docs:site:serve`
- 发布门禁：
  - GitHub Actions 工作流 `Docs GitHub Pages Publish`

## 6）本地验证命令

```bash
# 文档治理
npm run docs:diataxis:check
npm run docs:site:build

# API 契约治理
npm test -- src/knowledge.api.contract.test.ts --runInBand

# 更大范围迁移/策略门禁
npm run test:migration
```

## 7）当前风险态势

- 稳定项：
  - 文档映射与构建门禁
  - API 契约覆盖
  - runtime runbook 与诊断端点
- 需持续补强：
  - graphdb 后端深度（当前仍是 file-adapter 模式）
  - 独立向量检索后端接入
  - 将趋势观察进一步升级为硬发布门禁

## 8）关联运行手册

- [发布文档到 GitHub Pages](../how-to/publish-docs-github-pages.md)
- [文档发布与回滚详细手册](../../../zh/docs_release_and_rollback.md)
