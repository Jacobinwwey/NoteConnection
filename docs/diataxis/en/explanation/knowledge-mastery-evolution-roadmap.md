# Explanation: Knowledge Mastery Evolution Roadmap

This page explains the strategic shift from a pure knowledge-visualization product to a local-first, verifiable learning system.

## Why This Roadmap Exists

- Visualization alone cannot guarantee user mastery.
- LLM assistance without evidence and memory governance can produce low-trust guidance.
- Long-term learning outcomes require structured atoms, explainable retrieval, and mastery-state updates.

## Strategic Direction

1. Keep local-first as the default architecture.
2. Introduce graph-backed explainable retrieval with temporal validity.
3. Build a dual-core learning loop:
   - mastery closure loop
   - divergence exploration loop
4. Add pluggable local/cloud LLM tutor actions under evidence-first guardrails.

## Canonical Plan Source

- [docs/en/knowledge_mastery_evolution_plan.md](../../../en/knowledge_mastery_evolution_plan.md)

## Implementation Baseline Since v1.7.0

- [Learning Platform Contract and Workbench Baseline (v1.7.0 to HEAD)](../../../solutions/documentation-gaps/learning-platform-api-workbench-contract-gap-2026-04-02.md)
- [Evolution Progress Alignment Requirements (2026-04-11)](../../../brainstorms/2026-04-11-evolution-progress-alignment-requirements.md)

## Current Progress Summary (2026-04-11)

- Core learning contracts are implemented (`KnowledgeIngestAPI`, `KnowledgeQueryAPI`, `MasteryDiagnosticsAPI`, `LearningPathAPI`, `TutorActionAPI`, `MemoryPolicyAPI`).
- Retrieval, tutor, memory, and runtime governance loops are integrated into the Learning Workbench and server API surface.
- Major structural gaps remain in:
  - true local graph database backend depth (current `graphdb` path is file-adapter based)
  - independent vector retrieval backend integration

## Related Explanation Sources

- [Architecture and Migration](./architecture-and-migration.md)
- [Startup Node Update Acceleration Plan](./startup-node-update-acceleration-plan.md)
