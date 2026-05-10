# Explanation: Knowledge Mastery Evolution Roadmap

This page explains the product and engineering roadmap for moving NoteConnection from a
knowledge-visualization system into a verifiable local-first learning platform.

## Strategic Objective

The roadmap is driven by one primary target:

- maximize measurable mastery improvement while keeping retrieval and tutoring outputs explainable and auditable.

This requires:

1. stable knowledge representation and evidence traceability,
2. explainable retrieval and policy-controlled orchestration,
3. mastery-state update loops with testable quality gates.

## Why the Shift Is Necessary

- Visualization is useful for navigation but does not prove learning effect.
- LLM output without evidence alignment can improve fluency while degrading trust.
- Long-term learning outcomes require both temporal validity and memory governance, not only single-turn responses.

## Roadmap Backbone (Three Phases)

## Phase 1: Representation and Backbone Hardening

- Unified ingest and staleness rebuild pipeline.
- Relation and temporal graph contracts.
- Store backend abstraction (`file` / `memory` / `graphdb`) with fallback safety.
- Query backend comparability (`local_hybrid` vs `keyword_only`) with trend telemetry.

## Phase 2: Mastery and Divergence Learning Loop

- Mastery diagnostics and misconception tracking.
- Dual path outputs (`MasteryPath` + `DivergencePath`) in session planning.
- Session history analytics with strategy-source and outcome telemetry.
- Quality trend and threshold checks linked to path strategy behavior.

## Phase 3: Tutor and Memory Operating Layer

- Pluggable tutor actions under evidence-first constraints.
- Memory policy diagnostics and trend governance for `session` / `unit` / `long_term`.
- Runtime capability runbook with remediation queue and incident verification chain.

## Current Implementation Baseline (as of 2026-04-11)

- Core interfaces are available in `src/learning/api.ts` and exported via `src/learning/index.ts`.
- Type contracts for atom/evidence/relation/temporal/mastery/action/trace are defined in `src/learning/types.ts`.
- API surface is wired in `src/server.ts` and validated by `src/knowledge.api.contract.test.ts`.
- Learning Workbench orchestration and diagnostics are integrated in `src/frontend/path_app.js`.

## Primary Structural Gaps Still Open

1. Graph persistence depth:
   - `graphdb` mode currently relies on `FileGraphDbSnapshotAdapter` in `src/learning/store.ts`.
   - this preserves fallback reliability but does not yet deliver a true local graph database backend.
2. Vector retrieval independence:
   - retrieval currently uses `local_hybrid` token/semantic heuristics and `keyword_only` fallback in `src/learning/queryBackend.ts`.
   - a standalone vector index backend is not integrated yet.

## Decision Rules for Next Iterations

1. Foundation first:
   - close graph backend and vector backend gaps before large new feature expansion.
2. Evidence before promotion:
   - every new ability must ship with contract wiring, runtime observability, and test evidence.
3. Quality gates over demos:
   - trend outputs are useful, but release decisions must be tied to threshold gate outcomes.

## Progress Tracking Entry

- [Development Progress Dashboard](./development-progress-dashboard.md)

Use this page as the execution view (layer matrix, debug runbook, and priority backlog).

## Canonical Plan and Baseline Sources

- [docs/en/knowledge_mastery_evolution_plan.md](../../../en/knowledge_mastery_evolution_plan.md)
- [Learning Platform Contract and Workbench Baseline (v1.7.0 to HEAD)](../../../solutions/documentation-gaps/learning-platform-api-workbench-contract-gap-2026-04-02.md)
- [Evolution Progress Alignment Requirements (2026-04-11)](../../../brainstorms/2026-04-11-evolution-progress-alignment-requirements.md)

## Related Explanation Sources

- [Architecture and Migration](./architecture-and-migration.md)
- [Startup Node Update Acceleration Plan](./startup-node-update-acceleration-plan.md)
