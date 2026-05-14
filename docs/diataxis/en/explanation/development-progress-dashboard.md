# Explanation: Development Progress Dashboard

This page is the implementation-facing dashboard for the Knowledge Mastery evolution plan.
It tracks what is already implemented, where the hard gaps remain, and how to verify progress from code and runtime behavior.

## 2026-05-10 Open-Goal Sync

- This page is aligned with the repository-wide audit in [Open Goal Audit (2026-05-10)](../../../open_goal_audit_2026-05-10.md).
- Current unresolved-goal decisions should be read from:
  - `docs/en/TODO.md`
  - `docs/en/task.md`
  - `docs/en/tauri_tasks.md`
  - `docs/en/TEST_REPORT.md`
- Historical checklists in archive/historical docs remain traceability context and are not the canonical release gate.

## 2026-05-12 HEAD Reality Recalibration

- The previous "Phase-1 closure" wording is too optimistic for current HEAD and is superseded by this section.
- What is real at HEAD:
  - graph/store operations semantics exist in `src/learning/store.ts`, including file-backed ops, embedded SQLite graphdb persistence/query paths, and HTTP adapter paths with fallback diagnostics,
  - the embedded sqlite baseline now also has restart-durability proof: shutdown closes the store cleanly, the adapter can reopen safely, and server integration covers ingest -> shutdown -> fresh module reload -> diagnostics/query/readiness continuity,
  - ANN-style prefilter, representation telemetry, circuit health, remote index sync, and live `external_http` connector proof now exist in `src/learning/queryBackend.ts` and `src/learning/vectorAccelerationAdapter.ts`,
  - runtime capability/runbook governance now includes explicit ANN remote index-sync health (`query_vector_acceleration_index_sync_health`) in addition to prefilter, health, traceability, and circuit checks,
  - `server.ts` now closes the corresponding operator loop: the index-sync gate participates in verification escalation, remediation action-queue generation, and per-check runbook history summaries,
  - the agent workspace runtime-runbook surfaces now render operator-facing ANN governance directly in the frontend shell: verify/checks now expose sync-health plus circuit-budget, traceability, and prefilter summaries, and they now also show threshold/signal drilldowns plus calibration-readiness state needed for budget tuning work, while action-queue keeps the index-sync incident drilldown,
  - the modular `src/routes/knowledge.ts` runtime-runbook surfaces now delegate to live server-side runbook ops with full query-parameter passthrough, so browser/runtime consumers no longer hit the old KLP placeholder payloads for verify/history/checks/action-queue/remediation/schedule flows,
  - the browser strict smoke gate now also proves those ANN runbook surfaces from real browser evidence: verify-card ANN sync/circuit/traceability/prefilter content plus threshold/signal and calibration-readiness labels, checks-card first-check ANN sync plus circuit/traceability/prefilter snapshots, and action-queue index-sync drilldown are now asserted end to end instead of remaining component-test-only,
  - locale governance for the agent workspace is now tighter on both static and runtime surfaces: bilingual locale bundles now cover the query/quality/runbook cards exercised by strict browser smoke, `src/agent_workspace.locale.contract.test.ts` blocks source-referenced `agentWorkspace.*` key drift, and startup-time translate helpers no longer emit false missing-key warnings before locale initialization finishes,
  - Phase-2 runtime diagnostics are now materially implemented in `src/learning/KnowledgeLearningPlatform.ts` for query-backend comparison/history/trend, knowledge staleness diagnostics/rebuild planning, learning-quality history/trend, session-plan quality evaluation/history/trend/runtime-threshold diagnostics, query-backend config, and query-backend diagnostics,
  - Phase-3 tutor/memory diagnostics remain real and now include an active default runtime tutor adapter path in `src/server.ts`, so normal server execution can emit adapter telemetry instead of staying catalog-only.
- What is not closed yet:
  - Phase-1 A8 has advanced beyond a file-only default: `src/server.ts` now defaults to `graphdb/sqlite` with explicit file fallback, and restart durability is already proved, but packaged/runtime proof and heavier-workload hardening are still open before calling the local graph backend production-closed,
  - Phase-1 A9 is now operational rather than scaffold-only, but recall/latency calibration and larger-workload validation are still open before calling the ANN layer production-closed,
  - Phase-2 quality/session/query observability is now real, but it is not yet release-closed because these gates still require release-grade calibration on top of the current graph/ANN operational baseline,
  - default tutor routing is no longer catalog-only, but the runtime is still effectively `local`-first and retains explicit rule-engine fallback rather than a production-proven multi-provider routing policy.
- Active execution focus therefore shifts to truth-first foundation recovery:
  - finish the remaining packaged/runtime + heavier-workload closure for the embedded graph backend baseline,
  - finish the remaining workload/threshold closure for the now-live ANN connector baseline,
  - move the newly surfaced ANN runbook visibility from operator-readable summaries to workload-calibrated release gates,
  - keep the new diagnostic surfaces honest against the same runtime truth,
  - then promote Phase-2 / Phase-3 gates as release-significant only after the graph/ANN baseline is release-grade.

## Scope

- Focus area: local-first knowledge mastery platform (ingest, retrieval, learning path, tutor, memory, governance).
- Time window: `v1.7.0` to current branch baseline.
- Evidence rule: every progress claim must map to:
  - contract surface (`src/learning/api.ts`, `src/learning/types.ts`)
  - route wiring (`src/server.ts`)
  - behavior tests (`src/knowledge.api.contract.test.ts` and domain tests)

## 2026-05-12 Architecture Metrics

| File | Current Lines | Implication |
|---|---:|---|
| `src/server.ts` | 14,992 | routing is modularized, but the main server monolith is still large |
| `src/learning/KnowledgeLearningPlatform.ts` | 7,706 | KLP still carries major implementation gravity despite domain extraction |
| `src/frontend/path_app.js` | 4,649 | path workbench/controller split is incomplete |
| `src/frontend/app.js` | 4,713 | graph runtime still keeps a large host-side control surface |
| `src/routes/knowledge.ts` | 690 | knowledge routes need another split before claiming route-layer compaction |

Use these numbers as the current HEAD truth. Older size-reduction tables later in this page remain useful as historical traceability, but they no longer describe the current branch state exactly.

## Current Delivery Focus

The immediate L4 priority is no longer generic interaction expansion.
It is the end-to-end delivery of:

- frontend agent chat,
- local knowledge-point listing,
- docked Tauri graph `focus mode` pane,
- docked learning-path pane that can coexist with graph focus and be promoted fullscreen.

Execution reference:

- [Agent Conversation + Focus Mode Delivery Plan](./agent-conversation-focus-mode-plan.md)

Current branch status for this slice:

- the main frontend now contains an agent workspace shell (`src/frontend/index.html`, `src/frontend/styles.css`),
- the conversation route now returns actionable local knowledge points with typed capability descriptors, including execution / failure / UI-hint metadata for `focus`, `learning path`, tutor-side actions (`generate_quiz`, `recap`, `generate_transfer`, `generate_counterexample`, `follow_up`), query-side `compare_query_backends` / `inspect_query_backend_diagnostics` / `inspect_query_backend_comparison_history` / `inspect_query_backend_comparison_trend`, tutor diagnostics `inspect_tutor_adapter_telemetry` / `inspect_tutor_trace_diagnostics`, quality/session diagnostics (`inspect_learning_quality_trend` / `inspect_learning_quality_history` / `inspect_session_plan_quality_trend` / `inspect_session_plan_quality_history`), session-side `inspect_session_history` / `build_study_session`, and conversation-memory recall `inspect_conversation_memory` (`src/server.ts`, `src/learning/KnowledgeLearningPlatform.ts`, `src/learning/types.ts`),
- the capability actions that inspect query comparison, staleness, learning quality, session-plan quality, and query-backend diagnostics are now backed by live `KnowledgeLearningPlatform.ts` implementations instead of empty placeholders,
- default server bootstrap now injects a concrete local `tutorAdapter` while preserving the multi-adapter catalog (`local` + `cloud`), so normal runtime tutor execution can emit adapter telemetry and still degrade explicitly to guarded fallback behavior when needed,
- conversation knowledge points are now typed-only (`capabilities` is the single action source), and legacy `availableActions` fallback telemetry/synthesis has been removed from both backend response shape and pane rendering (`src/learning/types.ts`, `src/learning/KnowledgeLearningPlatform.ts`, `src/frontend/workspace_panes.js`, `src/agent_workspace.frontend.test.ts`, `src/knowledge.api.contract.test.ts`),
- agent workspace capability execution dispatch now enforces explicit execution-kind handlers without legacy action fallback execution; knowledge operations are split into independent transport and request-builder registries, while result presentation is split into custom presenters plus card-presentation descriptors and payload-builder registries with fail-fast `unsupported_result_presentation*` drift semantics, and parity/frontend diagnostics now cover transport/request-builder/custom-presentation/card-presentation/payload-builder/execution-kind completeness (`src/frontend/agent_workspace.js`, `src/agent_workspace.frontend.test.ts`, `src/agent_workspace.contract.parity.test.ts`),
- clicking `Learning Path` now mounts the existing path workspace (`path-container` + sidebars) into the docked learning-path pane instead of stopping at a text-only preview (`src/frontend/workspace_panes.js`, `src/frontend/agent_workspace.js`),
- the graph surface now reserves workspace width so conversation + graph-focus + learning-path can coexist in one host-owned layout (`src/frontend/styles.css`),
- graph-focus fullscreen now promotes the real graph workspace instead of only enlarging a metadata card (`src/frontend/workspace_panes.js`, `src/frontend/styles.css`),
- the new agent workspace shell now has i18n coverage for static shell strings plus runtime button/empty-state messaging, existing knowledge-card actions / localized system messages now re-render on language change instead of staying in the previous locale, conversation card rerender is now centralized through a card-kind renderer registry, and a source-level parity guard now checks append-kind vs registry alignment (`src/frontend/index.html`, `src/frontend/locales/en.json`, `src/frontend/locales/zh.json`, `src/frontend/workspace_panes.js`, `src/frontend/agent_workspace.js`, `src/agent_workspace.frontend.test.ts`),
- locale governance now includes backend-to-frontend capability label-key parity blocking: emitted conversation capability `labelKey` values must resolve to non-empty bilingual `agentWorkspace.actions.*` entries (`src/learning/KnowledgeLearningPlatform.ts`, `src/frontend/locales/en.json`, `src/frontend/locales/zh.json`, `src/agent_workspace.locale.contract.test.ts`),
- modular knowledge-route closure now includes live browser strict proof instead of snapshot-only recovery: conversation response wiring, capability-triggered request routes, card-title localization, and graph-focus compatibility now pass `STRICT`, `UI_STRICT`, and `UI_DYNAMIC_STRICT` against real browser/network traces (`src/routes/knowledge.ts`, `src/learning/KnowledgeLearningPlatform.ts`, `src/frontend/app.js`, `src/frontend/locales/en.json`, `src/frontend/locales/zh.json`, `scripts/verify-agent-workspace-browser.js`),
- locale governance now also blocks capability failure-message drift: emitted `failure.messageKey` values must resolve to bilingual `agentWorkspace.messages.*` entries with aligned interpolation placeholders and stable fallback placeholder sets (`src/learning/KnowledgeLearningPlatform.ts`, `src/frontend/locales/en.json`, `src/frontend/locales/zh.json`, `src/agent_workspace.locale.contract.test.ts`),
- backend capability descriptor contract now enforces execution completeness for `knowledge_operation` capabilities (`operationId` + `resultPresentation`) and mandatory failure metadata (`messageKey` + `fallbackMessage`) in the emitted conversation capability payload (`src/learning/KnowledgeLearningPlatform.ts`, `src/agent_workspace.contract.parity.test.ts`),
- frontend capability execution now enforces an operation-scoped result-presentation allowlist (default + explicit overrides such as `execute_tutor_action -> tutor_action_card`) and fails fast on unsupported combinations before backend request dispatch and renderer dispatch (`src/frontend/agent_workspace.js`, `src/agent_workspace.contract.parity.test.ts`, `src/agent_workspace.frontend.test.ts`),
- contract governance now blocks allowlist override drift: override operation keys must be a subset of `AgentConversationCapabilityOperationId`, and override values must be a subset of `AgentConversationCapabilityResultPresentation` (`src/agent_workspace.contract.parity.test.ts`),
- parity governance now enforces allowlist shape: each operation allowlist must include its transport default presentation, and backend non-default operation presentations must be declared by explicit frontend overrides (`src/agent_workspace.contract.parity.test.ts`),
- override hygiene now enforces non-default-only semantics: operation override entries may not repeat transport defaults (`src/agent_workspace.contract.parity.test.ts`, `src/frontend/agent_workspace.js`),
- override governance now also blocks stale entries: each frontend override presentation must be observed in backend capability emission for the same operation (`src/agent_workspace.contract.parity.test.ts`),
- frontend registry diagnostics now export per-operation override/default/allowlist presentation maps (`operationResultPresentationOverrideMap`, `operationDefaultResultPresentations`, `operationAllowedResultPresentations`) to support contract drift debugging (`src/frontend/agent_workspace.js`, `src/agent_workspace.frontend.test.ts`),
- frontend registry diagnostics now also export `operationInvalidResultPresentationOverrideMap` so runtime can surface default-duplicate/unknown override tokens if configuration drifts (`src/frontend/agent_workspace.js`, `src/agent_workspace.frontend.test.ts`),
- frontend registry diagnostics now also export `operationUnknownResultPresentationOverrideMap` so unknown override operation IDs remain visible in runtime drift debugging (`src/frontend/agent_workspace.js`, `src/agent_workspace.frontend.test.ts`),
- frontend registry diagnostics now also export override-drift summary signals (`operationResultPresentationOverrideDriftDetected`, invalid/unknown override token counters) for quick runtime health checks (`src/frontend/agent_workspace.js`, `src/agent_workspace.frontend.test.ts`),
- frontend message-locale governance now blocks unresolved runtime message keys: every `agentWorkspace.messages.*` key referenced by `agent_workspace.js` must resolve to bilingual locale entries with aligned placeholders (`src/frontend/agent_workspace.js`, `src/frontend/locales/en.json`, `src/frontend/locales/zh.json`, `src/agent_workspace.locale.contract.test.ts`),
- app-level tauri lifecycle observability now records `pathmode-window-toggled` payloads into a bounded frontend trace buffer and forwards them as `noteconnection:pathmode-window-toggled` DOM events for local diagnostics (`src/frontend/app.js`),
- the desktop lifecycle verification stack now includes a first real app/window-handle evidence path (`verify:agent-workspace:tauri:window-evidence`) that runs dedicated Rust tests against mock-app webview window handles and emits structured artifacts under `output/tauri/agent-workspace-window-evidence`, with explicit degraded semantics when host system dependencies are missing (`scripts/verify-agent-workspace-tauri-window-evidence.js`, `src-tauri/src/lib.rs`, `src/agent_workspace.tauri.contract.test.ts`),
- CI now has an always-on strict desktop evidence job in `.github/workflows/migration-gates.yml` (`agent-workspace-tauri-strict-evidence`) that runs `verify:agent-workspace:tauri:rust:strict` and `verify:agent-workspace:tauri:window-evidence:strict` on Linux hosts with explicit `javascriptcoregtk-4.1` / `libsoup-3.0` dependencies, and release workflow `.github/workflows/release-desktop-multi-os.yml` now enforces the same strict evidence gate on the Linux desktop build path before bundle generation; both workflows also generate a strict evidence index (`verify:agent-workspace:tauri:evidence:index:strict`), enforce a strict evidence manifest gate (`verify:agent-workspace:tauri:evidence:manifest:strict`), and upload tauri evidence artifacts (retention policy pinned to 30 days) for audit traceability, while the Linux release path now publishes `release-fragment-latest.md` into GitHub Release notes using marker-based idempotent upsert,
- migration workflow now also includes a dedicated always-on `agent-workspace-contract-gates` job that runs `test:agent-workspace:contracts` (parity/frontend/tauri contract suites) plus `test:conversation-turn-cache:durability` (restart durability check for turn-cache trend index/export consistency), closing the CI drift-detection gap for agent-workspace contract evolution,
- license governance now adds `test:license:contract` to enforce `GPL-3.0-only` parity across `LICENSE`, `README`, `package.json`, and `src-tauri/Cargo.toml`, and this gate is wired into `migration-gates` CI to block license drift,
- browser smoke now exercises real `conversation/path/query-compare/quality/session/runbook` backend slices (including trend + history diagnostics plus runbook verify/checks/action-queue), real graph runtime, and real path runtime, and now asserts ANN sync-health plus verify/checks circuit/traceability/prefilter threshold/signal and calibration-readiness content from browser evidence before emitting screenshot/console/network-summary artifacts (`scripts/verify-agent-workspace-browser.js`, `src/agent_workspace.browser.contract.test.ts`),
- scoped conversation-memory foundation is now wired end-to-end (typed contracts, backend normalizers/routes, capability operation registry, locale keys, lifecycle tests, browser/runtime verification) through `/api/knowledge/conversation-memory/{list,add,search,delete,feedback}` (`src/learning/api.ts`, `src/learning/types.ts`, `src/learning/KnowledgeLearningPlatform.ts`, `src/server.ts`, `src/frontend/agent_workspace.js`, `src/knowledge.api.contract.test.ts`, `src/learning/KnowledgeLearningPlatform.test.ts`, `src/agent_workspace.frontend.test.ts`),
- unified turn streaming baseline is now delivered on `/api/knowledge/conversation` via `Accept: text/event-stream` negotiation with a minimal event set (`turn_started`/`capability_planned`/`capability_progress`/`capability_result`/`turn_completed`/`turn_failed`) and frontend stream-first + sync fallback behavior (`src/server.ts`, `src/frontend/agent_workspace.js`, `src/knowledge.api.contract.test.ts`, `src/agent_workspace.frontend.test.ts`),
- M8.2 recovery semantics are now in place on top of the stream baseline: frontend requests propagate client turn IDs across stream-first + sync fallback, server route `/api/knowledge/conversation` now enforces replay-window idempotency with turn-level dedupe/conflict protection (`turn_id_conflict`), and resumed stream requests replay cached turn events instead of re-running execution (`src/server.ts`, `src/frontend/agent_workspace.js`, `src/knowledge.api.contract.test.ts`, `src/agent_workspace.frontend.test.ts`),
- M8.3 operator baseline is now delivered: turn-cache lifecycle diagnostics are exposed at `GET /api/knowledge/conversation/turn-cache/diagnostics` (including TTL/capacity config, live state, hit ratio, conflict count, replay counters, and eviction counters), and TTL/capacity are runtime-tunable via `NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_TTL_MS` / `NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_MAX_ENTRIES` (`src/server.ts`, `src/knowledge.api.contract.test.ts`),
- M8.4 operator productization baseline is now delivered: turn-cache diagnostics are wired into the agent workspace execution contract as `inspect_conversation_turn_cache_diagnostics` -> `fetch_conversation_turn_cache_diagnostics` -> `conversation_turn_cache_diagnostics_card`, including bilingual card rendering and language-switch re-render coverage (`src/learning/types.ts`, `src/learning/KnowledgeLearningPlatform.ts`, `src/frontend/agent_workspace.js`, `src/frontend/workspace_panes.js`, `src/frontend/locales/en.json`, `src/frontend/locales/zh.json`, `src/agent_workspace.frontend.test.ts`, `src/agent_workspace.contract.parity.test.ts`, `src/knowledge.api.contract.test.ts`, `src/learning/KnowledgeLearningPlatform.test.ts`),
- M8.5 thresholded-governance baseline is now delivered: turn-cache diagnostics now include env-driven alert thresholds and policy checks (`utilization_pct`, `execution_failure_ratio_pct`, `conflict_count`, `stale_eligible_entries`) with summarized severity state (`summaryStatus`) and fail/warn counters; the workspace diagnostics card now renders alert summary/top-check/threshold-profile metrics with bilingual labels and re-render coverage (`src/server.ts`, `src/frontend/agent_workspace.js`, `src/frontend/workspace_panes.js`, `src/frontend/locales/en.json`, `src/frontend/locales/zh.json`, `src/agent_workspace.frontend.test.ts`, `src/knowledge.api.contract.test.ts`),
- M8.6 alert-trend governance baseline is now delivered: `GET /api/knowledge/conversation/turn-cache/diagnostics/trend` now returns bounded alert-history snapshots, trend status (`insufficient_data` / `stable` / `improving` / `regressing`), escalation state (`normal` / `watch` / `high` / `critical`), and active-streak context; sampling and policy behavior are env-tunable via `NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_ALERT_HISTORY_LIMIT`, `NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_ALERT_SAMPLE_MIN_INTERVAL_MS`, `NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_ALERT_TREND_WINDOW_SIZE`, `NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_ALERT_TREND_MIN_SAMPLES`, `NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_ALERT_ESCALATION_WARN_STREAK`, and `NOTE_CONNECTION_AGENT_CONVERSATION_TURN_CACHE_ALERT_ESCALATION_FAIL_STREAK` (`src/server.ts`, `src/knowledge.api.contract.test.ts`),
- M8.6 operator productization follow-through is now delivered in the workspace contract path: `inspect_conversation_turn_cache_alert_trend` -> `fetch_conversation_turn_cache_alert_trend` -> `conversation_turn_cache_alert_trend_card`, including bilingual card rendering and language-switch re-render coverage (`src/learning/types.ts`, `src/learning/KnowledgeLearningPlatform.ts`, `src/frontend/agent_workspace.js`, `src/frontend/workspace_panes.js`, `src/frontend/locales/en.json`, `src/frontend/locales/zh.json`, `src/agent_workspace.frontend.test.ts`, `src/agent_workspace.contract.parity.test.ts`, `src/learning/KnowledgeLearningPlatform.test.ts`),
- M8.7 durability + runbook-gate linkage baseline is now delivered: turn-cache alert trend history is persisted across restarts at `runtime_data/agent_conversation_turn_cache_alert_history.v1.json` with bounded compaction and async persist queueing, index/export endpoints are available at `GET /api/knowledge/conversation/turn-cache/diagnostics/trend/index` and `GET /api/knowledge/conversation/turn-cache/diagnostics/trend/export`, and escalation is now bridged into runtime runbook through synthetic check `conversation_turn_cache_alert_trend` with remediation actions `inspect_conversation_turn_cache_alert_trend_index`, `stabilize_conversation_turn_cache_alert_pressure`, and `verify_conversation_turn_cache_alert_trend_recovery` (`src/server.ts`, `src/knowledge.api.contract.test.ts`, `src/notemd.server.integration.test.ts`),
- M8.8 operator drilldown + schedule guardrail baseline is now delivered: agent workspace now exposes explicit trend index/export operator actions (`inspect_conversation_turn_cache_alert_trend_index` / `inspect_conversation_turn_cache_alert_trend_export`) and corresponding operation wiring (`fetch_conversation_turn_cache_alert_trend_index` / `fetch_conversation_turn_cache_alert_trend_export`), trend/action-queue cards now surface storage/index/export/endpoint-hint drilldown context, and replay schedule config now applies cross-field guardrails (`maxReplayChecksPerWindow >= replayLimit`) with explicit telemetry reasons (`config_guardrail_applied`, `schedule_config_guardrail:*`) visible through server snapshot + workbench status text (`src/learning/types.ts`, `src/learning/KnowledgeLearningPlatform.ts`, `src/frontend/agent_workspace.js`, `src/frontend/workspace_panes.js`, `src/frontend/path_app.js`, `src/server.ts`, `src/agent_workspace.frontend.test.ts`, `src/agent_workspace.contract.parity.test.ts`, `src/knowledge.api.contract.test.ts`, `src/learning/KnowledgeLearningPlatform.test.ts`, `src/notemd.server.integration.test.ts`),
- M8.9 replay-schedule proactive recommendation + policy-template baseline is now delivered: replay-schedule snapshots now include structured recommendation payloads (`telemetry.recommendations`) and policy-template candidates (`telemetry.policyTemplates`) for guardrail/budget/trigger/cooldown/skip-streak scenarios, schedule config update accepts `policyTemplate` as a first-class payload input, and workbench replay-schedule refresh/update/tick status text now surfaces both top recommendation and top policy template for operator action (`src/server.ts`, `src/frontend/path_app.js`, `src/notemd.server.integration.test.ts`, `src/path_app.runtime_trace_filter.behavior.test.ts`),
- M9 replay-schedule safe auto-execution baseline is now delivered: schedule config now supports explicit `autoExecution` policy (`enabled`, `mode`, `requireDryRunParity`, `minConsecutiveSkips`), snapshot telemetry now reports structured gate diagnostics (`eligible`, `blockedReasons[]`, `decision`, `lastAttemptedAt`, `lastExecutedAt`), and schedule tick now enforces gate-first execution semantics (`auto_execution_blocked`, `auto_execution_dry_run_required`, `auto_execution_executed`) on top of existing trigger/cooldown/budget guards (`src/server.ts`, `src/notemd.server.integration.test.ts`, `src/knowledge.api.contract.test.ts`),
- M9.1 workbench operator explainability is now delivered: replay-schedule refresh/update/tick status text and remediation history formatting now include `autoExecution(...)` diagnostics, and config update flow now forwards `autoExecution` fields from UI preferences to backend payload (`src/frontend/path_app.js`, `src/path_app.runtime_trace_filter.behavior.test.ts`),
- M10 foundation hardening bootstrap is now delivered as rollout controls: graphdb storage now supports provider-based adapter selection plus fallback policy (`NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_ADAPTER_PROVIDER`, `NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_ADAPTER_ID`, `NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_FALLBACK_ENABLED`) and local-vector acceleration now supports explicit failure semantics plus representation strictness (`NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_FAILURE_MODE=fail_open|fail_closed`, `NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_REPRESENTATION_STRICT=true|false`) with trace/runtime diagnostics propagation (`src/learning/store.ts`, `src/learning/queryBackend.ts`, `src/learning/KnowledgeLearningPlatform.ts`, `src/server.ts`, `src/learning/store.test.ts`, `src/learning/queryBackend.test.ts`, `src/knowledge.api.contract.test.ts`),
- local-vector acceleration strictness now also treats `external_http` endpoint misconfiguration as a first-class adapter failure (`external_http_endpoint_missing`) so `fail_closed` rollout no longer silently downgrades to full-scan; strict paths now surface `vector_acceleration_adapter_failure:*` in trace/diagnostics (`src/learning/vectorAccelerationAdapter.ts`, `src/notemd.server.rollout-boundary.integration.test.ts`),
- query-backend diagnostics/config endpoints now echo vector-acceleration rollout context (`configuredVectorAccelerationProvider`, `configuredVectorAccelerationFailureMode`, `configuredVectorAccelerationRepresentationStrict`, `queryVectorAnnPrefilterEnabled`, `rolloutProfile`) so workbench/runtime operators can reason about strictness without cross-calling `/api/knowledge/state` (`src/server.ts`, `src/notemd.server.integration.test.ts`, `src/notemd.server.rollout-boundary.integration.test.ts`),
- M10.2 graphdb adapter baseline now includes an `external_http` provider path (`NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_ENDPOINT`, `NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_TIMEOUT_MS`, `NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_MAX_RETRIES`, `NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_RETRY_DELAY_MS`) with connector diagnostics and strict fail-closed behavior when endpoint configuration is invalid (`graphdb_http_endpoint_missing`) (`src/learning/store.ts`, `src/server.ts`, `src/learning/store.test.ts`, `src/notemd.server.rollout-boundary.integration.test.ts`),
- M10.3 graphdb `external_http` connector telemetry is now promoted to first-class runtime governance: store diagnostics now include structured connector health/circuit/request telemetry (`healthStatus`, `circuitState`, `requestCount`, `retryCount`, `shortCircuitCount`, `lastRequestId`, `lastErrorCode`, `lastStatusCode`, `lastRetryAfterMs`), runtime capability matrix now adds `store_graphdb_connector_health` with runbook/debug-trace wiring, and strict rollout integration/store tests now validate the healthy path plus circuit-open degradation semantics (`src/learning/store.ts`, `src/learning/runtimeCapability.ts`, `src/learning/store.test.ts`, `src/learning/runtimeCapability.test.ts`, `src/notemd.server.rollout-boundary.integration.test.ts`),
- M10 rollout-boundary integration coverage is now extended with isolated server bootstrap tests for strict-mode behavior: vector acceleration `fail_closed` now verifies both adapter-failure surfacing and healthy `external_http` success-path telemetry (no backend fallback, `healthStatus=ready`, request-correlation propagation), graphdb `provider=none` + `fallback=false` now verifies fail-closed store API semantics, and graphdb `provider=external_http` + `fallback=false` now verifies the success path across `/api/knowledge/store/reload` + `/api/knowledge/store-diagnostics` (including rollout-context fields `configuredGraphDbAdapterProvider` / `configuredGraphDbAdapterId` / `graphDbFallbackEnabled`) (`src/notemd.server.rollout-boundary.integration.test.ts`, `src/server.ts`),
- M10 rollout profile operator visibility is now wired end-to-end: runtime payload now exposes `rolloutProfile` (store/vector strictness + aggregate mode), `runtime-capability-matrix` plus runbook/verify/history/history-checks/action-queue/remediation-history/replay-schedule endpoints (including remediation POST flows: `event`/`replay`/`schedule`/`tick`) now echo the same profile, and learning-workbench runtime summary now surfaces `rollout=<mode>(...)` cue; integration/contract/frontend behavior coverage is in place (`src/server.ts`, `src/notemd.server.integration.test.ts`, `src/knowledge.api.contract.test.ts`, `src/frontend/path_app.js`, `src/path_app.runtime_trace_filter.behavior.test.ts`),
- the legacy global Path Mode entry now clears the docked pane first so full-path entry remains deterministic (`src/frontend/app.js`).

## Latest Validation Snapshot (2026-05-14)

- Reconfirmed on the current Windows host in this turn: `node node_modules/jest/bin/jest.js src/agent_workspace.frontend.test.ts --runInBand --no-cache`, `npm run test:agent-workspace:contracts`, `npm run build:with-vite`, `npm run docs:diataxis:check`, `npm run docs:site:build`, `NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_STRICT=1 NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_UI_STRICT=1 NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_UI_DYNAMIC_STRICT=1 node scripts/verify-agent-workspace-browser.js`.
- The strict browser proof now explicitly verifies the bilingual runtime-runbook verify/checks ANN governance labels that were added in this slice: sync-health plus circuit, traceability, and prefilter summaries, along with the threshold/signal drilldowns and calibration-readiness cues that support budget-tuning work.
- Tauri strict evidence is implementation-closed but still host-dependent:
  - the current Windows host proves non-strict tauri/runtime behavior and load-flow parity,
  - Linux strict evidence commands (`verify:agent-workspace:tauri:rust:strict`, `verify:agent-workspace:tauri:window-evidence:strict`, strict evidence index/manifest) still require provisioned `webkit2gtk-4.1`, `javascriptcoregtk-4.1`, and `libsoup-3.0`.
- Sidecar/bootstrap readiness on the current Windows host is now `offline-ready`; remaining bootstrap work is policy hardening before strict no-LFS mode, not an immediate host-readiness blocker.
- Practical Phase boundary:
  - interaction/runtime verification infrastructure is strong enough to continue selective Phase-3 hardening in parallel,
- but neither Phase-1 backend closure nor Phase-2 governance closure is actually done at HEAD,
- remaining work is not only ops/release prerequisites; it still includes unresolved real graphdb/ANN delivery, stronger release-grade calibration for the new diagnostics, and continued architecture reduction.

Operational note:

- the live server serves frontend assets from `dist/src/frontend`, so `src/frontend/*` changes do not reach runtime verification until a fresh `npm run build` copies them into the dist tree.
- there is now a dedicated smoke command, `npm run verify:agent-workspace:runtime`, which copies the current frontend into a temporary runtime tree, boots a real sidecar/server, and verifies that the served root HTML and locale payload expose the agent workspace shell.
- there is also a browser-driven smoke command, `npm run verify:agent-workspace:browser`, which seeds a minimal knowledge document through the real ingest API, writes a minimal `data.js` seed so the page boots real graph/path runtimes, opens the served shell in a real Chromium session, drives the agent-workspace conversation/action flow against the real `conversation/path/query-compare/quality/session/runbook` backend slice, verifies localized action/message re-rendering (including runbook checks/action-queue cards), checks graph-focus promotion enter/exit state, and emits screenshot/console/network-summary evidence paths for failure diagnosis.
- there is now a Rust-targeted tauri contract command, `npm run verify:agent-workspace:tauri:rust`, which executes the `pathmode_window_toggle_plan`/`pathmode_window_toggled_event_payload` cargo tests when required system libs exist; local non-strict mode reports `SKIP` if `webkit2gtk-4.1`, `javascriptcoregtk-4.1`, or `libsoup-3.0` are unavailable, while CI/strict mode fails hard.
- there is now a real app/window evidence command, `npm run verify:agent-workspace:tauri:window-evidence`, which attempts dedicated Rust window-lifecycle evidence tests and writes structured reports/logs; if host dependencies are missing it reports `degraded` (non-strict) with explicit reasons, while strict mode hard-fails.
- there is now a strict evidence index command, `npm run verify:agent-workspace:tauri:evidence:index`, which builds a normalized latest-report index across rust/window/smoke artifacts, validates the generated report against `schemas/agent-workspace-tauri-evidence-index.schema.json`, and in strict mode fails when required evidence is missing or not passed.
- there is now a tauri evidence summary renderer, `npm run verify:agent-workspace:tauri:evidence:summary`, which writes `output/tauri/agent-workspace-evidence-index/evidence-summary-latest.md` for operator review and can be published into `GITHUB_STEP_SUMMARY` in CI workflows.
- there is now a tauri evidence release-fragment renderer, `npm run verify:agent-workspace:tauri:evidence:release-fragment`, which emits `output/tauri/agent-workspace-evidence-index/release-fragment-latest.md` and can be appended to `GITHUB_STEP_SUMMARY` for release-gate audit context.
- there is now a tauri evidence manifest renderer, `npm run verify:agent-workspace:tauri:evidence:manifest`, which emits `output/tauri/agent-workspace-evidence-index/evidence-manifest-latest.json`, validates the payload against `schemas/agent-workspace-tauri-evidence-manifest.schema.json`, and includes strict-validation diagnostics over required evidence artifacts.
- there is now a release-note publisher, `npm run verify:agent-workspace:tauri:evidence:publish-release-notes -- --tag <release_tag>`, which upserts the latest tauri evidence fragment into the target GitHub Release body via stable begin/end markers.

## Phase Snapshot (Revalidated 2026-05-12)

| Phase | Plan Target | Current Status | Evidence |
|---|---|---|---|
| Phase 1 | Knowledge parsing + graph backbone + staleness governance | Operational baseline | `src/learning/store.ts`, `src/learning/queryBackend.ts`, `src/learning/vectorAccelerationAdapter.ts`, `src/server.ts` |
| Phase 2 | Mastery loop + divergence engine | Partial | `src/learning/KnowledgeLearningPlatform.ts`, `src/frontend/path_app.js` |
| Phase 3 | Pluggable tutor + memory operating layer | Early operational | `src/learning/KnowledgeLearningPlatform.ts`, `src/learning/tutorAdapter.ts`, `src/server.ts`, `src/routes/knowledge.ts` |

## Layer-by-Layer Implementation Matrix

| Layer | Goal | Implemented Baseline | Remaining Work |
|---|---|---|---|
| L0 Representation | Parse document content into atom/evidence units | Atom, evidence, source hash and staleness rebuild are implemented (`ingestKnowledge`, staleness APIs) | Add richer formula/code normalization and stronger parser telemetry granularity |
| L1 Structure | Build relation + temporal graph for learning reasoning | `RelationEdge` with `provenance`, `TemporalEdge` with active validity window are implemented | Improve relation quality scoring and cross-document conflict handling |
| L2 Retrieval | Evidence-first explainable retrieval | `local_hybrid`, `keyword_only`, and `local_vector` retrieval backends exist with ANN-style prefilter, fallback telemetry, and a live sync-backed `external_http` acceleration path; the default graph store baseline is now embedded `graphdb/sqlite` with restart-durability proof | Keep the remaining backend gap honest: packaged/runtime + heavier-workload hardening are still open for graphdb, and ANN still needs benchmarked rollout thresholds plus larger-workload validation |
| L3 Learning | Mastery diagnostics + actionable path generation | Mastery diagnostics, misconception summaries, dual-path recommendation, session execution primitives, and live quality/session-plan trend surfaces are implemented | Calibrate the now-live `learning quality` / `session plan quality` history-trend-evaluation surfaces on top of a release-grade graphdb/ANN baseline before claiming Phase-2 gate closure |
| L4 Interaction | Workbench for operations + tutoring + diagnostics | The agent workspace shell, focus/path panes, typed capability contract, runtime/browser smoke, and turn-cache operator surfaces are real | Keep the shell/runtime evidence healthy, but stop treating observability cards as release-closed while they still depend on an operational rather than release-grade graph/ANN baseline |
| L5 Governance | Runtime checks, trend gates, remediation loop | Runtime capability matrix, connector/circuit telemetry, ANN index-sync telemetry, remediation plumbing, and operator-facing verify/checks drilldowns for ANN sync/circuit/traceability/prefilter are real | Tie governance upgrades to non-empty live thresholds plus adapter-backed telemetry on top of a release-grade graph/ANN baseline |

## Architecture Refactoring Status (2026-05-05, FINAL)

A 12-phase refactoring (A→L) was executed against the baseline. The following modules are now delivered:

### New Module Inventory

| Module | Files | Purpose |
|---|---|---|
| `src/routes/` | 10 | Modular API route handlers (65 routes across knowledge, notemd, markdown, render, data, diagnostics) |
| `src/middleware/` | 5 | HTTP middleware (cors, auth, body-parser, request-trace) |
| `src/learning/domains/` | 8 | Domain classes extracted from KnowledgeLearningPlatform (7 classes + 7 Platform interfaces) |
| `src/frontend/*.mjs` | 4 | ES module versions of i18n, runtime_bridge, main entry, worker bridge |
| `src/utils/platform.ts` | 1 | Cross-platform detection (Linux XDG / macOS Library / Windows LOCALAPPDATA) |
| `src-tauri/tauri.{linux,macos,windows}.conf.json` | 3 | Platform-specific Tauri configs |
| `vite.config.ts` | 1 | Vite 5-entry multi-page build (4 chunks: main/graph-app/agent-workspace/path-mode) |
| `docs/solutions/` | 2 | Cross-platform refinement plan + implementation gap analysis |
| `docs/archive/` | 3 | Archived TODO.md files (448KB) |
| `docs/zh/analysis_ref.md` | 1 | Chinese translation of reference analysis (updated for Tauri v2) |
| `docs/release_notes_v1.6.6.md` | 1 | Canonical quality bar release notes (EN+ZH) |

### Refactoring Metrics

| Metric | Before | After |
|---|---|---|
| Route modules | 0 (inline if/else chain) | 10 modules, 65 routes |
| Middleware modules | 0 (inline functions) | 5 independent modules |
| Domain classes | 1 (13,370-line monolith) | 7 classes with typed Platform interfaces |
| Frontend module system | `<script>` tag chain | ES modules + Vite 4-chunk |
| Platform configs | 1 generic + 1 Android | 5 configs (Linux/macOS/Windows/Android + generic) |
| Platform path logic | 1-line `win32` check | `platform.ts` with proper XDG/Library/LOCALAPPDATA |
| Godot renderer | GL Compatibility | Forward+ (Vulkan) with Wayland fallback |
| Mobile build paths | 2 (Capacitor + Tauri Android) | 1 (Tauri Android, Capacitor deprecated) |
| TODO files | 448KB in docs tree | Archived to `docs/archive/` |
| Bilingual doc pairs | 21 | 24 |
| CI jobs (migration-gates) | 16 | 18 |
| Route contract tests | 0 | 10/10 passing |
| Runtime observability | No route migration metrics | registryHitRate + migrationProgress + 7 domain panels |
| Route migration coverage | 0% | 91.3% (73 modular + 7 terminal inline) |
| Inline chain complexity | Monolithic if/else chain | Clearly sectioned + [REGISTRY_COVERED] annotations |
| Domain class method bodies | 0 (all in monolith) | 7/7 complete (validate → delegate → augment → diagnostics) |
| Vite build time | N/A | 437ms |
| Path-mode chunk size | N/A | 93KB (from 430KB in legacy bundle) |
| tsc errors | 255 (pre-existing M8-M10) | 26 (-90%) |
| Domain method body migration depth | Delegation only | 4-domain-method deep (Ingestor: staleness+guardrails, Querier: validation+cache, Mastery: path validation) |

### Domain Class Implementation Status

| Domain Class | Platform Interface | Own Logic | Production Use |
|---|---|---|---|
| `KnowledgeIngestor` | `IngestPlatform` | 4 domain gates, staleness analysis (freshnessScore/freshnessRating/staleBySource), staleness trend (100-snapshot history, getFreshnessTrend), latency tracking, guardrail pass rate, 10 diagnostics | ✅ `POST /api/knowledge/ingest` |
| `KnowledgeQuerier` | `QueryPlatform` | Query validation (empty/length/max), _domain telemetry, cache (TTL+pruning), latency P95, 10 diagnostics | ✅ `POST /api/knowledge/query` |
| `ConversationManager` | `ConversationPlatform` | Query+memory validation, turn count, response latency, memory ops, 6 diagnostics | ✅ (instantiated) |
| `MasteryEngine` | `MasteryPlatform` | Path validation, _domain augmentation (pathLength/duration), session metrics, 6 diagnostics | ✅ (instantiated) |
| `QualityEvaluator` | `QualityPlatform` | User validation, pass rate tracking (200-window), snapshot metrics, 5 diagnostics | ✅ (instantiated) |
| `TutorRouter` | `TutorPlatform` | UserID+actionKind validation, action distribution, execution metadata, 4 diagnostics | ✅ (instantiated) |
| `MemoryPolicyManager` | `MemoryPlatform` | UserID+layer validation, policy layer distribution, _domain augmentation, 5 diagnostics | ✅ (instantiated) |

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
  - `POST /api/knowledge/runtime-capability-runbook/remediation-event/replay`

## State and storage layer

- Store backends in `src/learning/store.ts`:
  - `file`
  - `memory`
  - `graphdb` (now supports embedded SQLite, file, and HTTP adapter paths)
- Current structural limit: the new default graphdb path is embedded SQLite with explicit fallback, but it still needs packaged/runtime proof and workload hardening before being called production-closed.

## Retrieval layer

- Query backend implementations in `src/learning/queryBackend.ts`:
  - `local_hybrid`: keyword + semantic token similarity + relation degree + temporal filtering trace
  - `keyword_only`: keyword-dominant retrieval with temporal filtering
  - `local_vector`: TF-IDF-like local vector similarity + semantic overlap + graph relation bonus, with durable local index snapshot (`knowledge_query_vector_index.v1.json`), ingest-triggered invalidation, lazy refresh by atom signature, ANN-style token/signature prefilter (`ann_prefilter`) with automatic full-scan fallback, and a pluggable acceleration adapter boundary (`local` default + `external_stub` + `external_http`)
- Known structural limits:
  - current external adapter implementations are scaffolds for integration hardening (including `external_http` timeout/retry/circuit-breaker baseline), not production ANN engine connectors,
  - larger-corpus workloads still need dedicated external ANN backends plus benchmarked threshold tuning.
- Governance coverage:
  - runtime checks now distinguish backend availability, vector index readiness, and persistence mode.
  - vector acceleration circuit governance now evaluates warn/fail budgets on short-circuit count/ratio, consecutive failures, and half-open probe success rate.
  - ANN prefilter effectiveness governance now tracks `lastSelectionMode` + `lastCandidateCount` and fails when `ann_prefilter` remains on persistent `full_scan` fallback under stable connector traffic.
  - ANN prefilter effectiveness thresholds are now tunable via runtime env controls (minimum sample size + warn/fail candidate-ratio budgets) for corpus-specific rollout calibration.
  - runbook action queue now adds a dedicated prefilter-risk tie-break inside the same priority band so `query_vector_acceleration_prefilter_effectiveness` remediation actions surface earlier when the check is `warn|fail`.
  - remediation-event replay automation is now available via `POST /api/knowledge/runtime-capability-runbook/remediation-event/replay` to replay risk checks from remediation history into a fresh verify cycle.
  - server integration now validates external_http circuit-open propagation across `/api/knowledge/query-backend-diagnostics`, `/api/knowledge/runtime-capability-matrix`, and runbook verify endpoints.

## Workbench layer

- Frontend orchestration and diagnostics entry: `src/frontend/path_app.js`.
- Key observability integration:
  - runtime runbook dashboards
  - request trace filtering
  - query backend diagnostics/config
  - remediation replay controls in workbench (`risk_only|all`, replay limit 1-24) with local preference persistence
  - remediation replay schedule orchestration controls in workbench (enable/interval/trigger policy + thresholds) with API-backed snapshot + manual tick
  - vector acceleration governance visibility in runtime summary (`queryVectorAcceleration(...)` now surfaces live counters, circuit warn/fail threshold tuples, and embedded prefilter budget snapshot driven by matrix signals)
  - runbook `history/checks` now exposes structured ANN prefilter effectiveness snapshots (`queryVectorAccelerationPrefilter`) at both summary and per-check levels for threshold-aware incident triage
  - dedicated vector acceleration governance drilldown panel in the runbook section (structured status/threshold/flag/action view for `query_vector_acceleration_circuit_state`, remote ANN sync-health view for `query_vector_acceleration_index_sync_health`, prefilter selection/candidate telemetry + threshold budget/action view for `query_vector_acceleration_prefilter_effectiveness`, plus traceability coverage/action view for `query_vector_acceleration_traceability`), and the server-side runbook history/action-queue layer now treats the sync-health gate as a first-class incident object
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
- Validate turn-cache operator diagnostics and trend governance:
  - `GET /api/knowledge/conversation/turn-cache/diagnostics`
  - `GET /api/knowledge/conversation/turn-cache/diagnostics/trend?limit=20&windowSize=6&minSamples=3`
  - `GET /api/knowledge/conversation/turn-cache/diagnostics/trend/index?limit=20`
  - `GET /api/knowledge/conversation/turn-cache/diagnostics/trend/export?limit=50`
- Validate copied-frontend runtime shell:

```bash
npm run verify:agent-workspace:runtime
```

- Validate browser-rendered shell and interaction loop:

```bash
npm run verify:agent-workspace:browser
```

- Validate desktop lifecycle proxy smoke (runtime + tauri config + source lifecycle contracts + promotion lifecycle test):

```bash
npm run verify:agent-workspace:tauri
```

- Validate Rust-side tauri lifecycle contracts (`pathmode_window_toggle_plan*`, strict in CI):

```bash
npm run verify:agent-workspace:tauri:rust
npm run verify:agent-workspace:tauri:rust:strict
```

- Validate app/window lifecycle evidence path (degraded-friendly local mode + strict mode):

```bash
npm run verify:agent-workspace:tauri:window-evidence
npm run verify:agent-workspace:tauri:window-evidence:strict
```

- Build strict evidence index (local + CI strict mode):

```bash
npm run verify:agent-workspace:tauri:evidence:index
npm run verify:agent-workspace:tauri:evidence:index:strict
npm run verify:agent-workspace:tauri:evidence:summary
npm run verify:agent-workspace:tauri:evidence:release-fragment
npm run verify:agent-workspace:tauri:evidence:manifest
npm run verify:agent-workspace:tauri:evidence:manifest:strict
npm run verify:agent-workspace:tauri:evidence:publish-release-notes -- --tag <release_tag>
```

## 4) Query strategy sanity checks

- Compare backends with same query and inspect explainability gaps:
  - `POST /api/knowledge/query/compare-backends`
- Review recent comparison history:
  - `GET /api/knowledge/query/compare-backends/history?limit=8`
- Review trend window:
  - `GET /api/knowledge/query/compare-backends/trend`

## 5) Session strategy quality checks

- Evaluate strategy-outcome consistency:
  - `GET /api/knowledge/session/history?pathStrategySelectionSource=strategy_trend&sinceMinutes=10080`
  - `GET /api/knowledge/quality/trend`
  - `GET /api/knowledge/session/plan/quality/trend`

## Next Increments (Priority Order)

1. Close CI coverage gaps for the agent-workspace contract suites: keep tauri strict evidence jobs, and add always-on parity/frontend contract gates (`src/agent_workspace.contract.parity.test.ts`, `src/agent_workspace.frontend.test.ts`, `src/agent_workspace.tauri.contract.test.ts`) as first-class CI blockers.
2. Carry the embedded `graphdb/sqlite` baseline from restart-durability proof to packaged/runtime + heavier-workload closure while preserving explicit fail-open/fail-closed rollout semantics.
3. Finish ANN release-grade closure by keeping the new sync-backed `external_http` path healthy under real traffic, then tightening workload/threshold calibration.
4. Move next into Phase-2 gate promotion only after the same checks run on a release-grade graphdb/ANN baseline.
5. Add CI-integrated durability checks for persisted turn-cache trend index/export consistency across restart flows.
6. Continue strict evidence artifact governance improvements (retention/indexability/export) for operator audits, and keep i18n expansion as a lower-priority stream unless it directly unblocks contract/foundation risk.

## Cross-Platform Architecture Refinement (2026-05-02)

A comprehensive cross-platform compatibility audit and architecture health assessment was completed. Key findings and the unified remediation plan are documented in:

- [Cross-Platform Architecture Refinement Plan](../../../solutions/cross-platform-architecture-refinement-2026-05-02.md)

The plan identifies 6 blocking-level cross-platform issues (Linux asset://localhost 403, missing Windows sidecar binaries, macOS arm64 signing requirement, Wayland + Godot GL crash, WebKitGTK dependency gaps, CI matrix gaps) and 3 monolithic code files (server.ts 16,848 lines, path_app.js 15,140 lines, KnowledgeLearningPlatform.ts 13,370 lines) that together constitute the highest-priority technical debt. The remediation is organized into three phases aligned with the M10 foundation hardening stream.

**Key insight**: Code monoliths and platform fragility are causally linked — splitting server.ts enables platform-specific route handling without touching 16,848-line files; extracting platform.ts eliminates the single `process.platform === 'win32'` pattern that currently handles all Unix platforms identically.

## Related Pages

- [Knowledge Mastery Evolution Roadmap](./knowledge-mastery-evolution-roadmap.md)
- [Agent Conversation + Focus Mode Delivery Plan](./agent-conversation-focus-mode-plan.md)
- [Interfaces and Runtime Contracts](../reference/interfaces-and-runtime.md)
- [Learning Platform Contract and Workbench Baseline](../../../solutions/documentation-gaps/learning-platform-api-workbench-contract-gap-2026-04-02.md)
- [Agent Workspace Contract Closure Next Direction Requirements (2026-04-14)](../../../brainstorms/2026-04-14-agent-workspace-contract-closure-next-direction-requirements.md)
- [Evolution Progress Alignment Requirements](../../../brainstorms/2026-04-11-evolution-progress-alignment-requirements.md)
