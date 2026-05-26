# NoteConnection Documentation Hub

This site adopts the Diataxis framework to make documentation easier to navigate and maintain.

## Documentation Stability

- Use `npm run docs:diataxis:check` to validate Diataxis mapping consistency.
- Use `npm run docs:site:build` to validate page rendering and link stability.
- Use `npm run docs:site:serve` for local browsing during iterative doc updates.
- Use [Working Docs / Brainstorms](brainstorms/index.md) and [Working Docs / Solutions](solutions/index.md) for in-progress alignment artifacts and durable solution notes.
- Use [Open Goal Audit (2026-05-10)](open_goal_audit_2026-05-10.md) as the all-docs unresolved-goal snapshot.
- Track the Program A-F substrate/export closure in [Development Progress Dashboard](diataxis/en/explanation/development-progress-dashboard.md) and [Deep Student Comparison Next-Phase Plan](brainstorms/2026-05-26-deep-student-comparison-next-phase-plan.md).
- Program A-F 的 substrate / export 收口状态请查看 [Development Progress Dashboard](diataxis/en/explanation/development-progress-dashboard.md) 与 [Deep Student Comparison Next-Phase Plan](brainstorms/2026-05-26-deep-student-comparison-next-phase-plan.md)。

## English

- Start with [Diataxis Overview](diataxis/en/overview.md).
- Follow [First Run Tutorial](diataxis/en/tutorials/first-run.md).
- Use [How-To Guides](diataxis/en/how-to/build-and-export.md) for operational tasks.
- Bootstrap local Godot sidecars via [Bootstrap Godot Sidecar](diataxis/en/how-to/bootstrap-godot-sidecar.md).
- Use [Publish Docs to GitHub Pages](diataxis/en/how-to/publish-docs-github-pages.md) for docs delivery + rollback.
- Configure local runtime policy via [Configure app_config.toml](diataxis/en/how-to/configure-app-config.md).
- Follow [Godot + NoteMD + Markdown Workflows](diataxis/en/how-to/godot-notemd-markdown-workflows.md) before integrated feature development.
- Use [Reference](diataxis/en/reference/interfaces-and-runtime.md) for contracts and release governance.
- Use [Godot + NoteMD + Markdown Interfaces](diataxis/en/reference/godot-notemd-markdown-interfaces.md) for field-level API/message contracts.
- Use [Multi-Platform Build Flows](diataxis/en/reference/multi-platform-build-flows.md) for the audited desktop/mobile/publish/release build matrix behind the LFS migration.
- Use [app_config.toml Schema](diataxis/en/reference/app-config-schema.md) for exact config keys/defaults/effects.
- Use [Explanation](diataxis/en/explanation/architecture-and-migration.md) for architecture decisions.
- Use [Startup Node Update Acceleration Plan](diataxis/en/explanation/startup-node-update-acceleration-plan.md) for phased performance rollout.
- Use [Knowledge Mastery Evolution Roadmap](diataxis/en/explanation/knowledge-mastery-evolution-roadmap.md) for the next-stage learning-system strategy.
- Use [Development Progress Dashboard](diataxis/en/explanation/development-progress-dashboard.md) for implementation status, code evidence anchors, and operational runbook flow.
- Use [Brainstorms](brainstorms/index.md) for current requirement-alignment outputs before planning.
- Use [Solutions](solutions/index.md) for baseline implementation decisions and recovery patterns.
- Use [Git LFS Asset Migration](diataxis/en/explanation/git-lfs-asset-migration.md) for the phased repository/runtime decoupling strategy.
- Use [Sidecar Supply Feasibility](diataxis/en/explanation/sidecar-supply-feasibility.md) for the cost/user-friction/maintainer-burden decision matrix behind mirror choices.
- Use [Anti-Fragile Sidecar Supply Strategy](en/sidecar_supply_strategy.md) for the cache-first, mirror-aware, offline-seed path that explicitly rejects download-only replacement.
- Use [Open Goal Audit (2026-05-10)](open_goal_audit_2026-05-10.md) for cross-doc unresolved-goal status.

## 中文

- 从 [Diataxis 概览](diataxis/zh/overview.md) 开始。
- 按照 [首次运行教程](diataxis/zh/tutorials/first-run.md) 上手。
- 面向操作任务请使用 [操作指南](diataxis/zh/how-to/build-and-export.md)。
- 本地物化 Godot sidecar 请参考 [引导 Godot Sidecar](diataxis/zh/how-to/bootstrap-godot-sidecar.md)。
- 文档发布与回滚请参考 [发布文档到 GitHub Pages](diataxis/zh/how-to/publish-docs-github-pages.md)。
- 本地运行策略配置请参考 [配置 app_config.toml](diataxis/zh/how-to/configure-app-config.md)。
- 进入集成功能开发前请先完成 [Godot + NoteMD + Markdown 工作流](diataxis/zh/how-to/godot-notemd-markdown-workflows.md) 基线。
- 需要接口与发布信息请查看 [参考文档](diataxis/zh/reference/interfaces-and-runtime.md)。
- 字段级 API/桥接契约请查看 [Godot + NoteMD + Markdown 接口](diataxis/zh/reference/godot-notemd-markdown-interfaces.md)。
- 桌面/移动/发布/release 的构建矩阵请查看 [多平台构建流程](diataxis/zh/reference/multi-platform-build-flows.md)。
- 参数键/默认值/效果请查看 [app_config.toml 结构](diataxis/zh/reference/app-config-schema.md)。
- 需要理解架构决策请查看 [解释文档](diataxis/zh/explanation/architecture-and-migration.md)。
- 启动性能分阶段落地请查看 [启动节点更新提速方案](diataxis/zh/explanation/startup-node-update-acceleration-plan.md)。
- 下一阶段学习系统战略请查看 [知识彻底掌握演进路线图](diataxis/zh/explanation/knowledge-mastery-evolution-roadmap.md)。
- 需要查看实现进度、代码证据与调试链路请查看 [开发进度看板](diataxis/zh/explanation/development-progress-dashboard.md)。
- 需求对齐与规划前输出请查看 [Brainstorms](brainstorms/index.md)。
- 沉淀的解决方案基线请查看 [Solutions](solutions/index.md)。
- 仓库与运行时资产解耦迁移请查看 [Git LFS 资产迁移](diataxis/zh/explanation/git-lfs-asset-migration.md)。
- 镜像方案的成本 / 用户门槛 / 维护负担矩阵请查看 [Sidecar 供给可行性](diataxis/zh/explanation/sidecar-supply-feasibility.md)。
- 桌面 sidecar 的缓存优先 / 镜像感知 / 离线种子迁移路径请查看 [反脆弱 Sidecar 供给策略](zh/sidecar_supply_strategy.md)。
- 全量文档未完成目标快照请查看 [Open Goal Audit (2026-05-10)](open_goal_audit_2026-05-10.md)。
