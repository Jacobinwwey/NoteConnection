# 解释：知识彻底掌握演进路线图

本页用于说明项目为何从“知识可视化”进一步演进为“本地优先、可验证学习成效”的系统。

## 为什么需要这条路线

- 仅做可视化无法直接保证用户掌握度。
- 缺少证据链与记忆治理的 LLM 辅助，难以形成高可信学习反馈。
- 长期学习效果需要原子化知识建模、可解释检索与掌握状态更新闭环。

## 战略方向

1. 继续坚持本地优先架构。
2. 引入图数据库支撑的可解释检索与时序有效性。
3. 建立双核学习回路：
   - 掌握闭环
   - 发散探索回路
4. 在证据优先护栏下提供本地/云模型可插拔 LLM 导师动作。

## 权威计划来源

- [docs/zh/knowledge_mastery_evolution_plan.md](../../../zh/knowledge_mastery_evolution_plan.md)

## v1.7.0 之后的实施基线

- [学习平台契约与工作台基线（v1.7.0 到 HEAD）](../../../solutions/documentation-gaps/learning-platform-api-workbench-contract-gap-2026-04-02.md)
- [演进进度对齐需求（2026-04-11）](../../../brainstorms/2026-04-11-evolution-progress-alignment-requirements.md)

## 当前推进摘要（2026-04-11）

- 学习域核心契约已落地（`KnowledgeIngestAPI`、`KnowledgeQueryAPI`、`MasteryDiagnosticsAPI`、`LearningPathAPI`、`TutorActionAPI`、`MemoryPolicyAPI`）。
- 检索、导师、记忆、运行时治理能力已接入 Learning Workbench 与服务端统一 API 面。
- 当前仍需优先补齐的结构缺口：
  - 本地图数据库底座深度（当前 `graphdb` 路径仍以文件适配器为主）
  - 独立向量检索后端集成

## 关联解释文档

- [架构与迁移](./architecture-and-migration.md)
- [启动节点更新提速方案](./startup-node-update-acceleration-plan.md)
