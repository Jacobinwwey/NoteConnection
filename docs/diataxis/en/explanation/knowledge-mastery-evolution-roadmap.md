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

## 2026-05-12 Head Reclassification

- The branch now contains real Phase-3 tutor/memory slices, but current HEAD should not be described as "Phase-1 closed".
- The accurate state is:
  - Phase-1 A8 has advanced into an embedded local-backend baseline: graph/store ops semantics, embedded SQLite graphdb persistence/query paths, and HTTP adapter paths exist, the default runtime now targets `graphdb/sqlite` with explicit file fallback, restart durability is integration-proved, host-level dist/runtime + packaged sidecar proof is in place, and a 180-document host-level heavier-workload smoke is in place; broader workload-envelope / soak / performance hardening are still open.
  - Phase-1 A9 has advanced into an ANN connector operational baseline: ANN-style prefilter, representation telemetry, remote index sync, and live `external_http` query proof now exist, but recall/latency calibration and larger-workload validation are still open.
  - Phase-2 now has an operational diagnostics baseline: `learning quality`, `session plan quality`, query comparison, staleness, query-backend config, and query-backend diagnostics are live in `KnowledgeLearningPlatform.ts`, but they are not yet release-closed because they still require release-grade calibration on top of the current graph/ANN operational baseline.
  - Phase-3 is now operational-baseline rather than catalog-only: tutor telemetry, tutor trace/provider trends, conversation memory, memory-policy diagnostics, and default runtime tutor-adapter injection are real, but production-proven multi-provider routing policy is still open.
- Active rollout focus therefore changes from "assume closure and move on" to "keep the new A8 packaged/runtime and 180-document workload proofs green, finish the remaining broader A8 workload closure plus A9 workload calibration, then move next into honest Phase-2 gate promotion."

## Primary Structural Gaps Still Open

1. Real graph backend closure:
   - keep the new embedded `graphdb/sqlite` default alive across packaged/runtime paths,
   - treat restart durability, host-level packaged/runtime proof, and the new 180-document workload smoke as already proved, then extend verification into ops-preferred query semantics, fallback consistency, and broader heavier-workload durability against that local graph engine.
2. Real ANN connector closure:
   - keep the new live `external_http` connector path healthy under real sync/query traffic,
   - benchmark recall/latency thresholds before calling the vector layer production-ready.
3. Phase-2 quality gating:
   - keep the new `learning quality`, `session plan quality`, query-comparison, and staleness diagnostics aligned with the same runtime truth,
   - promote those trend diagnostics from observability to release-blocking governance only after Phase-1 backend closure is no longer `Partial+`.
4. Tutor-routing hardening:
   - keep the newly active default `tutorAdapter` observable,
   - extend from local-first routing into a production-proven multi-provider policy while preserving explicit fallback behavior.
5. Architecture pressure:
   - continue reducing the major monoliths (`server.ts`, `KnowledgeLearningPlatform.ts`, `path_app.js`, `app.js`, `routes/knowledge.ts`) so roadmap claims and code structure stop drifting apart.

## Decision Rules for Next Iterations

1. Truth before closure:
   - a route, card, or adapter surface is not "done" merely because the contract exists; placeholder methods and catalog-only wiring must stay classified as open work.
2. Foundation recovery before rollout claims:
   - finish real graphdb/ANN delivery before calling the backbone production-grade.
3. Evidence before promotion:
   - every new ability must ship with contract wiring, runtime observability, and fresh test evidence.
4. Quality gates over demos:
   - trend outputs are useful, but release decisions must be tied to non-placeholder threshold-gate outcomes.
5. Tutor routing must be active, not only enumerable:
   - multi-adapter tutor support is only closed after normal server runtime emits real adapter telemetry under live execution.

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
