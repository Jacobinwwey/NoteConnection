# Development Plan — 2026-04-27

## Current Architecture Position

### Foundation Layer (Phase 1 — Complete)
- Graph persistence: embedded sqlite, `graphBackendStatus = independent`
- Query backend: `local_hybrid` (keyword + deterministic ANN), `keyword_only` fallback
- Vector acceleration: `mode = local_ann`, `status = independent`
- Backend sufficiency gate: green, `promotionCriteriaPassed = 7/7`, closed-by-default
- Escalation trigger: measured pressure only (query-latency, rebuild/recovery duration)

### Conversation-Product Layer (M8.20-M8.52 — Shipped)
- Active-atom surface: focus rail, pane-state continuity, summary cards, recent history
- History explanation: drill-down, follow-up affordances, freshness ranking, rationale/alternatives, confidence signals
- Tradeoff/drift/stability: primary-vs-secondary, adjacent drift, stability explanation, stability signals
- Managed-memory continuity: gap follow-up, transition explanation, continuity rollups (counts, next-steps, resolved-actions, latest-transition, mixed-pairs, index-rollups, breadth/freshness)
- Operator triage/runbook: continuity-summary promotion, continuity-aware runbooks, severity calibration, prioritization, primary action contract
- All 33 increments verified by contract + frontend behavior + CI workflow gates

### Governance Layer (In Progress)
- `.trellis/spec/` scaffolding exists, all 11 spec files are empty templates
- Bootstrap task `00-bootstrap-guidelines` is `in_progress`
- Spec filling is the highest-priority prerequisite before any new implementation task

---

## Immediate Next Steps

### Step 1: Complete Spec Bootstrap (Priority: P0)

Fill all 11 spec files with real codebase conventions. Each file needs:
- Actual directory/module organization derived from `src/` structure
- Real code examples from the codebase (not hypothetical)
- Forbidden patterns the team avoids
- File paths that exist on main

| Spec File | Source of Truth |
|-----------|----------------|
| `backend/directory-structure.md` | `src/backend/`, `src/core/`, `src/learning/`, `src/markdown/` |
| `backend/database-guidelines.md` | `src/learning/store.ts`, `src/learning/KnowledgeLearningPlatform.ts` |
| `backend/error-handling.md` | `src/server.ts` error patterns, `try/catch` conventions |
| `backend/logging-guidelines.md` | `console.*` usage, server log format |
| `backend/quality-guidelines.md` | Contract test patterns, `jest` configuration |
| `frontend/directory-structure.md` | `src/frontend/` actual layout |
| `frontend/component-guidelines.md` | Vanilla JS module pattern, Web Worker boundaries |
| `frontend/hook-guidelines.md` | Frontend lifecycle, worker message patterns |
| `frontend/state-management.md` | `agent_workspace_runtime.js` diagnostics state ring, `path_app.js` state |
| `frontend/type-safety.md` | JSDoc conventions, runtime type checks, contract test shape assertions |
| `frontend/quality-guidelines.md` | Linting, `agent_workspace.frontend.test.ts` patterns |

### Step 2: M8.53 — Bounded Primary Runbook Consumer Adoption (Priority: P1)

Scope constraints (from `docs/brainstorms/2026-04-21-mainline-reconciliation-after-m8-52-primary-runbook-consumer-requirements.md`):

1. **Must** reuse the shipped `primaryRunbookAction` contract — no recomputing or re-sorting.
2. **Must** stay inside already-shipped fast-path payloads: `primaryRunbookAction`, `runbookActions`, `runbookLinks`, `triagePriority`, `replayRiskLevel`.
3. **Must not** introduce new persistence, full-report joins, or a broader dashboard shell.
4. **Must not** add a new route family.
5. **Should** target exactly one bounded pane/report consumer (not multiple consumers).

Candidate consumer: the agent workspace runtime diagnostics panel — it already renders triage data and can adopt `primaryRunbookAction` as the top recommendation without architectural change.

### Step 3: CI/Workspace Hygiene

- Remote `main` CI is green — no repair needed.
- Uncommitted workspace files (`.claude/`, `.codex/`, `.trellis/`, `AGENTS.md`): these are Trellis init artifacts. Decide whether to commit them (they contain project-scoped agent configurations) or keep them in `.gitignore`.
- No stale branches or worktrees exist.

---

## Architecture Direction (Post-M8.53)

### Lane 1: Conversation-Product Continuity (Active)
- After M8.53 lands: evaluate whether one-consumer adoption unlocks enough operator value before expanding to broader dashboards.
- Keep each consumer bounded and contract-explicit — no "private protocol" in UI.

### Lane 2: Mastery & Divergence Loop (Phase 2 — Gated)
- Mastery diagnostics, misconception tracking, dual-path session planning, quality trends already have API contracts (`src/learning/api.ts`).
- Current gap: these surfaces are API-accessible but lack rich operator-facing UI beyond the learning workbench.
- Next move: after M8.53 consumer adoption validates the pattern, extend the same bounded-consumer pattern to mastery/divergence surfaces.

### Lane 3: Tutor & Memory Operating Layer (Phase 3 — Planned)
- Pluggable tutor actions, memory policy diagnostics, runtime capability runbook already have type contracts.
- Gated behind: Phase 2 mastery-loop validation + measured backend pressure escalation.

### Lane 4: Backend Escalation (Dormant)
- Default: sqlite + local ANN remains the baseline.
- Escalation triggers:
  - `backend/sufficiency` route shows observed query-latency consistently above threshold,
  - `rebuild/recovery` duration exceeds budget on target hardware,
  - New product capability requires backend semantics not achievable with current sqlite schema.
- When triggered: evaluate graphdb backend (planned), standalone vector index (planned).

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Empty spec files cause sub-agents to write non-conforming code | High | Medium | Complete spec bootstrap before any new implementation task |
| Backend sufficiency degrades silently | Low | High | `GET /api/knowledge/backend/sufficiency` route + `verify:backend:baseline:sufficiency` script provide early warning |
| `server.ts` (499KB) becomes unmaintainable | Medium | High | Future refactor task should split routes; not urgent while all tests pass |
| `agent_workspace_runtime.js` (217KB) grows beyond frontend budget | Medium | Medium | Each M8.x increment is intentionally frontend-bounded; monitor bundle size |

---

## Success Criteria (Next Checkpoint)

1. All 11 spec files contain real, code-referenced conventions (not templates).
2. M8.53 consumer ships on `main` reusing `primaryRunbookAction` without new persistence or routes.
3. CI stays green through all pushes.
4. Progress dashboard updated with M8.53 completion and post-consumer direction.
5. Journal reflects decision rationale and architecture tradeoffs made during implementation.

---

## References

- [Development Progress Dashboard](../../docs/diataxis/en/explanation/development-progress-dashboard.md)
- [Knowledge Mastery Evolution Roadmap](../../docs/diataxis/en/explanation/knowledge-mastery-evolution-roadmap.md)
- [Local Backend Sufficiency and Escalation Plan](../../docs/diataxis/en/explanation/local-backend-sufficiency-and-escalation-plan.md)
- [Mainline Reconciliation After M8.52 (2026-04-21)](../../docs/brainstorms/2026-04-21-mainline-reconciliation-after-m8-52-primary-runbook-consumer-requirements.md)
- [Learning Platform Contract and Workbench Baseline (2026-04-02)](../../docs/solutions/documentation-gaps/learning-platform-api-workbench-contract-gap-2026-04-02.md)
- [Bootstrap Task PRD](../../.trellis/tasks/00-bootstrap-guidelines/prd.md)
