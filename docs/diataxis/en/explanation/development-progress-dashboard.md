# Explanation: Development Progress Dashboard

This page is the implementation-facing dashboard for the Knowledge Mastery evolution plan.
It tracks what is already implemented, where the hard gaps remain, and how to verify progress from code and runtime behavior.

## Scope

- Focus area: local-first knowledge mastery platform (ingest, retrieval, learning path, tutor, memory, governance).
- Time window: `v1.7.0` to current branch baseline.
- Evidence rule: every progress claim must map to:
  - contract surface (`src/learning/api.ts`, `src/learning/types.ts`)
  - route wiring (`src/server.ts`)
  - behavior tests (`src/knowledge.api.contract.test.ts` and domain tests)

## Phase Snapshot (2026-04-11)

| Phase | Plan Target | Current Status | Evidence |
|---|---|---|---|
| Phase 1 | Knowledge parsing + graph backbone + staleness governance | Partial | `src/learning/KnowledgeLearningPlatform.ts`, `src/learning/store.ts`, `src/learning/queryBackend.ts` |
| Phase 2 | Mastery loop + divergence engine | In progress | `src/learning/KnowledgeLearningPlatform.ts`, `src/frontend/path_app.js` |
| Phase 3 | Pluggable tutor + memory operating layer | In progress | `src/learning/tutorAdapter.ts`, `src/learning/runtimeCapability.ts`, `src/server.ts` |

## Layer-by-Layer Implementation Matrix

| Layer | Goal | Implemented Baseline | Remaining Work |
|---|---|---|---|
| L0 Representation | Parse document content into atom/evidence units | Atom, evidence, source hash and staleness rebuild are implemented (`ingestKnowledge`, staleness APIs) | Add richer formula/code normalization and stronger parser telemetry granularity |
| L1 Structure | Build relation + temporal graph for learning reasoning | `RelationEdge` with `provenance`, `TemporalEdge` with active validity window are implemented | Improve relation quality scoring and cross-document conflict handling |
| L2 Retrieval | Evidence-first explainable retrieval | `local_hybrid` and `keyword_only` retrieval backends with traceable retrieval mode weights are implemented | Add independent vector index backend and stronger pluggable backend adapter boundary |
| L3 Learning | Mastery diagnostics + actionable path generation | Mastery diagnostics, misconception summaries, dual-path recommendation and session execution pipeline are implemented | Tighten measurable effect loop (pass-rate gain and recurrence reduction as strict gate) |
| L4 Interaction | Workbench for operations + tutoring + diagnostics | Learning Workbench is wired to session, quality, runbook, trace diagnostics APIs | Improve operator UX for long history slicing and remediation workflow batching |
| L5 Governance | Runtime checks, trend gates, remediation loop | Runtime capability matrix + runbook + remediation event pipeline are implemented | Harden threshold calibration and incident replay automation |

## Core API and Runtime Baseline

## Contract layer

- API interfaces: `src/learning/api.ts`
- Core types: `src/learning/types.ts`
- Public export boundary: `src/learning/index.ts`
- Contract coverage: `src/knowledge.api.contract.test.ts`

## Server layer

- `/api/knowledge/*` routes are normalized and alias-compatible in `src/server.ts`.
- Runtime diagnostics endpoint: `GET /api/runtime-request-trace`.
- Runbook endpoints:
  - `GET /api/knowledge/runtime-capability-runbook`
  - `GET /api/knowledge/runtime-capability-runbook/verify`
  - `GET /api/knowledge/runtime-capability-runbook/history*`
  - `POST /api/knowledge/runtime-capability-runbook/remediation-event`

## State and storage layer

- Store backends in `src/learning/store.ts`:
  - `file`
  - `memory`
  - `graphdb` (currently file-adapter backed with fallback behavior)
- Known structural limit: graphdb mode still uses `FileGraphDbSnapshotAdapter` (`local-file-graphdb`) rather than a true local graph database engine.

## Retrieval layer

- Query backend implementations in `src/learning/queryBackend.ts`:
  - `local_hybrid`: keyword + semantic token similarity + relation degree + temporal filtering trace
  - `keyword_only`: keyword-dominant retrieval with temporal filtering
- Known structural limit: no standalone vector index service/adapter yet.

## Workbench layer

- Frontend orchestration and diagnostics entry: `src/frontend/path_app.js`.
- Key observability integration:
  - runtime runbook dashboards
  - request trace filtering
  - query backend diagnostics/config
  - path strategy telemetry and session history analytics

## Practice Runbook (Engineering Workflow)

## 1) Contract-first verification

```bash
npm test -- src/knowledge.api.contract.test.ts --runInBand
```

## 2) Docs governance and page stability

```bash
npm run docs:diataxis:check
npm run docs:site:build
npm run docs:site:serve
```

## 3) Runtime route and diagnostics sanity checks

- Validate runbook reads:
  - `GET /api/knowledge/runtime-capability-runbook`
  - `GET /api/knowledge/runtime-capability-runbook/verify?limit=20`
- Validate trace correlations:
  - `GET /api/runtime-request-trace`
  - `GET /api/runtime-request-trace?requestId=<exact_request_id>`

## 4) Query strategy sanity checks

- Compare backends with same query and inspect explainability gaps:
  - `POST /api/knowledge/query/compare-backends`
- Review trend window:
  - `GET /api/knowledge/query/compare-backends/trend`

## 5) Session strategy quality checks

- Evaluate strategy-outcome consistency:
  - `GET /api/knowledge/session/history?pathStrategySelectionSource=strategy_trend&sinceMinutes=10080`
  - `GET /api/knowledge/quality/trend`
  - `GET /api/knowledge/session/plan/quality/trend`

## Next Increments (Priority Order)

1. Replace file-backed graphdb adapter with a real local graph engine adapter (retain fallback).
2. Add independent vector retrieval backend and integrate into backend comparison + trend telemetry.
3. Promote mastery effect metrics to hard quality gates (not dashboard-only trend).
4. Add automated replay flow for runbook remediation events to reduce manual incident loops.

## Related Pages

- [Knowledge Mastery Evolution Roadmap](./knowledge-mastery-evolution-roadmap.md)
- [Interfaces and Runtime Contracts](../reference/interfaces-and-runtime.md)
- [Learning Platform Contract and Workbench Baseline](../../../solutions/documentation-gaps/learning-platform-api-workbench-contract-gap-2026-04-02.md)
- [Evolution Progress Alignment Requirements](../../../brainstorms/2026-04-11-evolution-progress-alignment-requirements.md)
