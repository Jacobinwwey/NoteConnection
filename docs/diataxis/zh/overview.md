# Diataxis 概览（中文）

本项目文档采用 Diataxis 四分法：

- `教程（Tutorials）`：面向初学者的逐步学习路径。
- `操作指南（How-To）`：面向任务执行的步骤化说明。
- `参考（Reference）`：权威接口、契约与策略说明。
- `解释（Explanation）`：架构动机、取舍与迁移背景。

## 治理机制

- 映射真源：[`docs/diataxis-map.json`](../../diataxis-map.json)
- 校验脚本：`node scripts/verify-diataxis-map.js`
- 站点配置：`mkdocs.yml`（仓库根目录）
- Python 依赖：[`docs/requirements-mkdocs.txt`](../../requirements-mkdocs.txt)

## 常用命令

```bash
npm run docs:diataxis:check
mkdocs serve --config-file mkdocs.yml
mkdocs build --config-file mkdocs.yml
npm run docs:edgeone:publish
```

## 权威来源文档

- 产品总览：[docs/zh/README.md](../../zh/README.md)
- 接口契约：[docs/zh/Interface Document.md](../../zh/Interface%20Document.md)
- 用户手册：[docs/zh/User_Manual.md](../../zh/User_Manual.md)
- app_config 指南：[docs/zh/app_config.toml_guide.md](../../zh/app_config.toml_guide.md)
- 发布对比报告：[docs/zh/release_v1.6.0_report.md](../../zh/release_v1.6.0_report.md)
- Sharelife 文档发布与回滚：[docs/zh/sharelife_community_release_and_rollback.md](../../zh/sharelife_community_release_and_rollback.md)

## 运行时配置入口

- 操作指南：[配置 app_config.toml](./how-to/configure-app-config.md)
- 参考文档：[app_config.toml 结构](./reference/app-config-schema.md)
