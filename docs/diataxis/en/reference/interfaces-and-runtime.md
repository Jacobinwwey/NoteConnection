# Reference: Interfaces and Runtime Contracts

This reference tracks canonical API/runtime contracts.

## Primary Contract Documents

- [docs/en/Interface Document.md](../../../en/Interface%20Document.md)
- [docs/en/User_Manual.md](../../../en/User_Manual.md)

## Focused Integration References

- [Godot + NoteMD + Markdown Interfaces](./godot-notemd-markdown-interfaces.md)
- [Godot + NoteMD + Markdown Workflows](../how-to/godot-notemd-markdown-workflows.md)

## Development Baseline Quick Links (v1.7.0+)

- [Knowledge Mastery Evolution Roadmap](../explanation/knowledge-mastery-evolution-roadmap.md)
- [Development Progress Dashboard](../explanation/development-progress-dashboard.md)
- [Learning Platform Contract and Workbench Baseline](../../../solutions/documentation-gaps/learning-platform-api-workbench-contract-gap-2026-04-02.md)
- [Evolution Progress Alignment Requirements](../../../brainstorms/2026-04-11-evolution-progress-alignment-requirements.md)

## Learning Platform Contract Surfaces

- Interface contracts:
  - `src/learning/api.ts`
  - `src/learning/types.ts`
- Runtime implementation:
  - `src/learning/KnowledgeLearningPlatform.ts`
  - `src/learning/store.ts`
  - `src/learning/queryBackend.ts`
  - `src/learning/runtimeCapability.ts`
- API wiring and alias normalization:
  - `src/server.ts`
- Frontend operational integration:
  - `src/frontend/path_app.js`
- Contract safety net:
  - `src/knowledge.api.contract.test.ts`

## Agent Workspace Verification Commands (v1.7.0+)

- Runtime shell and locale checks:
  - `npm run verify:agent-workspace:runtime`
- Desktop/Tauri contract checks:
  - `npm run verify:agent-workspace:tauri`
- Browser smoke checks:
  - `npm run verify:agent-workspace:browser`
- Windows compatibility note:
  - Browser smoke runs with relaxed assertions by default on Windows to avoid Playwright CLI path/argument-limit drift.
  - Set `NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_STRICT=1` to enforce strict critical availability assertions.
  - Set `NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_UI_STRICT=1` to enforce deterministic UI assertions (shell text + promotion + localized fallback messages).
  - Set `NOTE_CONNECTION_AGENT_WORKSPACE_BROWSER_UI_DYNAMIC_STRICT=1` together with `..._UI_STRICT=1` to additionally enforce dynamic conversation/request-card assertions.
  - Dynamic strict now blocks on real browser-driven conversation + capability execution evidence: conversation, learning-path, study-session, tutor action, query-backend comparison/history/trend, learning-quality trend/history, session-plan quality trend/history, session history, runtime runbook verify/checks/action queue, and conversation turn-cache alert trend.
  - The runtime runbook browser proof is content-aware, not open-card-only: ANN sync-health/counts must appear on the verify card, first-check ANN sync must appear on the checks card, and the action queue must expose the `query_vector_acceleration_index_sync_health` drilldown plus `/api/knowledge/query-backend-diagnostics`.
  - Locale/runtime hygiene is also gated here now: `src/agent_workspace.locale.contract.test.ts` blocks missing `agentWorkspace.*` locale keys referenced by the agent-workspace frontend/backend sources, and the runtime translate helpers avoid calling `window.i18n.t()` before locale hydration to prevent startup-only false-positive warning noise.
  - Modular knowledge-route parity is part of this gate: if `/api/knowledge/*` route wiring drifts from `KnowledgeLearningPlatform`, browser strict fails instead of silently falling back to synthetic snapshot data.
  - Dynamic recovery remains as a diagnostic fallback, but missing/failed request traces are now treated as hard failures rather than non-blocking variance.

## Key Runtime Contract Points (v1.6.0)

- Frontend runtime hydration invoke contracts:
  - `invoke('get_runtime_capabilities')`
  - `invoke('get_sidecar_runtime_config')`
- Rust sidecar runtime config command:
  - `get_sidecar_runtime_config`
- Rust app runtime config command:
  - `get_app_runtime_config`
- Runtime bridge readiness sequencing via `whenReady()`.

## Startup Perf Telemetry and Pilot Profile (v1.7.0+ pilot)

- Frontend startup checkpoints are emitted as one-shot logs:
  - `T0 app_boot`
  - `T1 graph_preprocessed`
  - `T2 worker_init_sent`
  - `T3 first_tick_received`
  - `T4 first_interactive_render`
  - `T5 stable_layout`
- Worker startup profile is passed through `simulationWorker` init payload:
  - `startupProfile.id`
  - `startupProfile.tickMaxFps`
  - `startupProfile.lowAlphaTickMaxFps`
  - `startupProfile.lowAlphaThreshold`
  - `startupProfile.stableAlphaThreshold`
  - `startupProfile.stableHoldTicks`
  - `startupProfile.stableTimeoutMs`
  - `startupProfile.deltaEnabled`
  - `startupProfile.deltaEpsilonPx`
  - `startupProfile.fullSyncEveryTicks`
  - `startupProfile.lowAlphaDeltaEpsilonMultiplier`
  - `startupProfile.lowAlphaFullSyncEveryTicks`
- Worker -> main-thread tick transport contract (Phase 2):
  - `tickMode: 'full' | 'delta'`
  - `isDelta: boolean`
  - `nodes: [{ id, i, x, y }]` (`i` is the worker node index fast-path; delta mode only includes changed nodes)
  - Startup tick application is frame-coalesced on main thread to reduce redundant repaint pressure.
  - `T5 stable_layout` details include `tickSummary` (`fullTicks`, `deltaTicks`, `deltaRatio`, payload stats).
- Multi-platform startup pilot profiles:
  - `desktop_windows_pilot`: `26 FPS`, `400ms` edge delay, `1500ms` SVG cap window (`18000` links).
  - `desktop_macos_pilot`: `24 FPS`, `430ms` edge delay, `1700ms` SVG cap window (`15000` links).
  - `desktop_linux_pilot`: `24 FPS`, `420ms` edge delay, `1600ms` SVG cap window (`16000` links).
  - `mobile_android_pilot`: `18 FPS`, `560ms` edge delay, `2200ms` SVG cap window (`7000` links), reduced overlay density.
  - `mobile_ios_pilot`: `17 FPS`, `600ms` edge delay, `2300ms` SVG cap window (`6200` links), reduced overlay density.
- Startup visual overlay contract:
  - A blurred startup overlay is shown until `T5 stable_layout` (or safety timeout).
  - Core text: `等待世界构建`.
  - Interactive starfield: stars twinkle naturally, and pointer clicks can dim nearby stars.
  - Overlay automatically scales down density/animation intensity on mobile and reduced-motion environments.
- Runtime override switch (for rollback/A-B validation):
  - `localStorage['nc.startupPerfProfile'] = 'off'` disables pilot behavior.
  - `localStorage['nc.startupPerfProfile'] = 'desktop_windows_pilot'` force-enables pilot behavior.
  - `localStorage['nc.startupPerfProfile'] = 'desktop_macos_pilot' | 'desktop_linux_pilot' | 'mobile_android_pilot' | 'mobile_ios_pilot'` force-selects the target profile.
- Automated baseline vs pilot summary script:
  - `npm run perf:startup:compare -- --baseline <baseline-log-path> --pilot <pilot-log-path>`
  - Supports file or directory inputs, auto-parses sessions from `[Startup Perf]` checkpoints, outputs P50/P95 KPI report.
- Automated cross-platform matrix summary script:
  - `npm run perf:startup:matrix -- --root <startup-logs-root> [--out <report-path>]`
  - Recommended layout: `<root>/<platform>/baseline|pilot` (for example `windows`, `macos`, `android`).
  - Backward-compatible single-platform layout: `<root>/baseline|pilot`, with `--single-platform-label <label>` as platform tag.
- Near-real-time matrix gate (auto-refresh when logs change):
  - `npm run perf:startup:matrix:watch -- --root <startup-logs-root> --out <report-path> --strict`
  - Recommended same-device dual-phase layout:
    - `<root>/macos/baseline/*.log`
    - `<root>/macos/pilot/*.log`
    - `<root>/android/baseline/*.log`
    - `<root>/android/pilot/*.log`
    - `<root>/ios/baseline/*.log`
    - `<root>/ios/pilot/*.log`
- Fallback flow without multi-device hardware (pipeline validation only):
  - `npm run perf:startup:matrix:simulate -- --seed-root tmp/startup-logs --out-root tmp/startup-logs-simulated`
  - `npm run perf:startup:matrix -- --root tmp/startup-logs-simulated --out tmp/startup-logs-simulated/report-platform-matrix.md`
  - Note: `tmp/startup-logs-simulated` is synthetic data and must not be used for release-go performance decisions.
- One-click no-hardware signoff (engineering gate + release gate TODO tracking):
  - `npm run perf:startup:signoff:nohw`
  - This command automatically runs: Windows real-log gates + simulated multi-platform three-cohort gates, then writes a layered signoff report.
  - If real multi-device cohort data is missing, release signoff is marked as `TODO` and moved to future test backlog.
- Three-cohort automatic regression and rollout gate (Phase 4):
  - `npm run perf:startup:cohorts:verify -- --root <cohorts-root> --cohorts small,medium,large --out <report-path> --strict`
  - Directory contract: `<cohorts-root>/<cohort>/<platform>/baseline|pilot`
- Session floor gate is configurable via `--min-sessions-per-platform <N>`

## Learning Runtime Governance Runbook (v1.7.0+)

- Runtime capability matrix endpoint:
  - `GET /api/knowledge/runtime-capability-matrix`
- Runtime capability runbook endpoints:
  - `GET /api/knowledge/runtime-capability-runbook`
  - `GET /api/knowledge/runtime-capability-runbook?checkId=<check_id>`
  - `GET /api/knowledge/runtime-capability-runbook/verify?checkId=<check_id>&limit=<N>`
  - `GET /api/knowledge/runtime-capability-runbook/history`
  - `GET /api/knowledge/runtime-capability-runbook/history/checks`
  - `GET /api/knowledge/runtime-capability-runbook/history/action-queue`
  - `GET /api/knowledge/runtime-capability-runbook/history/remediation-events`
  - `POST /api/knowledge/runtime-capability-runbook/remediation-event`
- Frontend API retry policy keys for runbook GET endpoints (Learning Workbench):
  - `runtime_runbook_get` -> `GET /api/knowledge/runtime-capability-runbook`
  - `runtime_runbook_verify_get` -> `GET /api/knowledge/runtime-capability-runbook/verify`
  - `runtime_runbook_history_get` -> `GET /api/knowledge/runtime-capability-runbook/history`
  - `runtime_runbook_history_checks_get` -> `GET /api/knowledge/runtime-capability-runbook/history/checks`
  - `runtime_runbook_action_queue_get` -> `GET /api/knowledge/runtime-capability-runbook/history/action-queue`
  - `runtime_runbook_remediation_history_get` -> `GET /api/knowledge/runtime-capability-runbook/history/remediation-events`
  - Current default policy for the runbook GET family:
    - `timeoutMs=12000`
    - `maxRetries=2`
    - `retryable=true`
  - Debugging entry points:
    - `learningWorkbench.apiRequestTraces[].policyKey`
    - `GET /api/runtime-request-trace` (server-correlated request diagnostics)
    - `GET /api/runtime-request-trace` query also supports `requestId=<exact_id>` for correlation-first drilldown, and echoes `summary.requestId`.
- Tutor routing dynamic alignment governance check:
  - `checkId = tutor_routing_dynamic_mode_alignment`
  - Detects a conflict between pinned `preferredMode` and adaptive routing dynamic recommendation.
  - Emits `pass | warn | fail` based on conflict severity and routing degradation budgets.
- Orchestration path-strategy alignment governance check:
  - `checkId = orchestration_path_strategy_alignment`
  - Evaluates whether trend-driven path strategy selections remain aligned with mastery outcomes.
  - Emits `pass | warn | fail` based on trend-auto sample size, average mastery delta, and negative-outcome ratio.
- Dynamic routing signal contract:
  - Tutor trace fields:
    - `adapterRoutingDynamicPreferredMode`
    - `adapterRoutingDynamicModeReason`
  - Tutor telemetry summary fields:
    - `lastRoutingDynamicPreferredMode`
    - `lastRoutingDynamicModeReason`
  - Runtime matrix signal fields:
    - `tutorRoutingDynamicPreferredMode`
    - `tutorRoutingDynamicModeReason`
    - `tutorRoutingDynamicModeSuggestionActive`
- Runbook verification targets for `tutor_routing_dynamic_mode_alignment` include:
  - `/api/knowledge/session/orchestration/config` (reconcile preferred mode policy)
  - `/api/knowledge/tutor/trace-diagnostics/providers/history?source=llm-adapter` (confirm mode-conflict trend convergence)
- Runbook verification targets for `orchestration_path_strategy_alignment` include:
  - `/api/knowledge/session/history?userId=<userId>&pathStrategySelectionSource=strategy_trend&sinceMinutes=10080` (verify strategy source vs outcome telemetry convergence)
  - `/api/knowledge/quality/trend` (cross-check strategyBreakdown trend consistency)
  - `/api/knowledge/session/orchestration/config` (tighten `strategyMinConfidence` when trend-auto remains negative)
- Runbook history diagnostics add streak visibility:
  - `GET /api/knowledge/runtime-capability-runbook/history` summary includes `activeRiskStreak` and `activeFailStreak`.
  - `GET /api/knowledge/runtime-capability-runbook/history/checks` summary includes:
    - `dynamicModeAlignmentRecords`
    - `dynamicModeAlignmentLatestStatus`
    - `dynamicModeAlignmentConflictStreak`
    - `dynamicModeAlignmentFailStreak`
    - `pathStrategyAlignmentRecords`
    - `pathStrategyAlignmentLatestStatus`
    - `pathStrategyAlignmentConflictStreak`
    - `pathStrategyAlignmentFailStreak`
    - `recommendedFocusEscalation`
    - `recommendedFocusTopAction`
    - `actionQueueTotal`
    - `actionQueueP0`
    - `actionQueueP1`
    - `actionQueueP2`
    - remediation aggregates:
      - `remediationRecords`
      - `remediationChecksWithEvents`
      - `remediationChecksRegressing`
      - `remediationChecksImproving`
      - `remediationChecksStable`
      - `remediationChecksInsufficientData`
      - `remediationAppliedRatioPct`
      - `remediationCooldownRatioPct`
      - `remediationErrorRatioPct`
      - `remediationRiskRatioPct`
      - `remediationLatestRecordedAt`
      - `recommendedFocusRemediationStatus`
      - `recommendedFocusRemediationTrendStatus`
  - `history/checks` per-check item includes:
    - `activeRiskStreak`
    - `activeFailStreak`
    - `latestEscalation`
    - `escalationActionItems`
    - `escalationActions`
    - `remediation` (per-check remediation trend summary, status counts, and streak diagnostics)
  - `history/checks` top-level includes:
    - `actionQueue` (cross-check prioritized remediation queue with escalation/context metadata)
  - `history/action-queue` returns a queue-first projection:
    - query filters:
      - `priority=p0|p1|p2`
      - `category=stabilize|governance|trend|routing|evidence|verify|monitor`
      - `checkId=<exact_check_id_token>`
      - `remediationStatus=applied|not_applied|cooldown|error|ignored`
      - `remediationTrend=improving|stable|regressing|insufficient_data`
    - `summary` (queue totals, filtered queue totals, P0/P1/P2 distribution, recommended focus snapshot, remediation queue risk snapshot via `remediationRiskQueueItems` / `remediationRegressingQueueItems` / `remediationAverageRiskRatioPct` / `remediationTopRiskCheckId`, and echoed filter state via `priorityFilter` / `categoryFilter` / `checkIdFilter` / `remediationStatusFilter` / `remediationTrendFilter`)
    - `actionQueue` (priority-sorted actionable items with `queueId`, check context, and remediation risk fields `remediationLatestStatus` / `remediationTrendStatus` / `remediationActiveRiskStreak` / `remediationRiskRatioPct`)
  - Focus recommendation override:
    - When `dynamicModeAlignmentConflictStreak >= 2` and latest status is `warn|fail`,
      `recommendedFocusCheckId` is pinned to `tutor_routing_dynamic_mode_alignment`
      with `recommendedFocusReason=dynamic_mode_alignment_conflict_streak`.
    - When `pathStrategyAlignmentConflictStreak >= 2` and latest status is `warn|fail`,
      `recommendedFocusCheckId` can be pinned to `orchestration_path_strategy_alignment`
      with `recommendedFocusReason=path_strategy_alignment_conflict_streak`.
- `GET /api/knowledge/runtime-capability-runbook/verify` includes extended diagnostics:
  - `selectedCheckHistory` (returned records, risk/fail streak, trend, latest timestamp)
  - `selectedCheckRemediation` (returned remediation records, normalized status counts, remediation streaks, ratio diagnostics, trend, latest remediation timestamp)
  - `selectedCheckEscalation` (`normal|watch|high|critical`)
  - `selectedCheckEscalationActionItems` (structured remediation action items with `actionId`, `priority`, `category`, `instruction`, endpoint and automation hints)
  - `selectedCheckEscalationActions` (ordered actionable remediation checklist for the current escalation level)
  - `dynamicModeAlignment` (`records`, `latestStatus`, `conflictStreak`, `failStreak`, `conflictPersistent`, focus recommendation hints)
  - `pathStrategyAlignment` (`records`, `latestStatus`, `conflictStreak`, `failStreak`, `conflictPersistent`, focus recommendation hints)
- Learning workbench refresh degradation telemetry contract:
  - Frontend state telemetry fields include:
    - `workbenchRefreshDegraded`
    - `workbenchRefreshFailureSources`
    - `workbenchRefreshFailureCount`
    - `workbenchRefreshLastFailureSummary`
    - `workbenchRefreshRecoveredSources`
    - `workbenchRefreshRecoveredCount`
    - `workbenchRefreshConsecutiveDegradedCount`
    - `workbenchRefreshLastDurationMs`
    - `workbenchRefreshAutoRemediationAt`
    - `workbenchRefreshAutoRemediationApplied`
    - `workbenchRefreshAutoRemediationReason`
    - `workbenchRefreshAutoRemediationCheckId`
    - `workbenchRefreshAutoRemediationCount`
  - Runtime summary `workbenchRefresh(...)` includes degradation gate and remediation diagnostics:
    - `gate=ok|warn` (`warn` when degraded streak `>= 3`)
    - `autoRemediate=idle|attempted|applied`
    - `autoReason`
    - `autoCheck`
    - `autoCount`
    - `autoAt`
  - Auto remediation trigger policy:
    - Triggered when `workbenchRefreshConsecutiveDegradedCount >= 3`
    - Applies runbook focus auto-selection (`_maybeAutoFocusLearningRuntimeRunbookVerification`)
    - On successful focus apply, runs trace suggestion workflow (`_applyLearningApiTraceSuggestionFromTopRegressingRuntimeCheck`)
  - Auto remediation cooldown policy:
    - If the previous remediation attempt is within `120s`, remediation actions are skipped for the current refresh cycle.
    - Skip reason is recorded as `cooldown_active:<remaining_seconds>s`.
  - Preference persistence contract (`localStorage['nc_learning_workbench_prefs']`) includes remediation telemetry:
    - `workbenchRefreshAutoRemediationCount`
    - `workbenchRefreshAutoRemediationAt`
    - `workbenchRefreshAutoRemediationApplied`
    - `workbenchRefreshAutoRemediationReason`
    - `workbenchRefreshAutoRemediationCheckId`
  - Workbench runbook filter persistence also includes:
    - action-queue remediation filters:
      - `runtimeRunbookActionQueueRemediationStatusFilter`
      - `runtimeRunbookActionQueueRemediationTrendFilter`
    - remediation-event history filters:
      - `runtimeRunbookRemediationHistorySinceMinutes`
      - `runtimeRunbookRemediationHistoryStatusFilter`
      - `runtimeRunbookRemediationHistorySourceFilter`
      - `runtimeRunbookRemediationHistoryCheckFilter`
      - `runtimeRunbookRemediationHistoryLimit`

## Learning Path Strategy Contract (v1.7.0+)

- `POST /api/knowledge/path` request supports:
  - `strategy=balanced|mastery_recovery|exploration_boost`
  - `recommendedActionLimit` (alias: `recommended_action_limit`, `maxActions`, `limit`)
- `POST /api/knowledge/session/plan` supports path-strategy pass-through:
  - `pathStrategy` / `path_strategy` / `learningPathStrategy`
  - `pathRecommendedActionLimit` / `path_recommended_action_limit`
- `POST /api/knowledge/session/execute` supports path-strategy pass-through for on-demand plan build (when `sessionPlan` is omitted):
  - `pathStrategy` / `path_strategy` / `learningPathStrategy` / `strategy`
  - `pathRecommendedActionLimit` / `path_recommended_action_limit` / `recommendedActionLimit` / `recommended_action_limit`
- `StudySessionResponse.summary` includes path telemetry:
  - `pathStrategy`
  - `pathRecommendedActionLimit`
  - `pathRecommendedActionCount`
  - `pathRecommendedMasteryActionCount`
  - `pathRecommendedDivergenceActionCount`
  - `pathRecommendedEvidenceCoverageRatioPct`
- `StudySessionExecutionRecord` and `/api/knowledge/session/history` records persist the same path telemetry fields for strategy-outcome traceability.
- `StudySessionExecutionRecord` additionally persists strategy-selection decision telemetry:
  - `pathStrategySelectionSource`
  - `pathStrategySelectionReason`
  - optional trend evidence: `pathStrategyTrendStatus`, `pathStrategyTrendScore`, `pathStrategyTrendConfidence`
- `/api/knowledge/session/history` `summary` now includes strategy source/outcome analytics:
  - `pathStrategySelectionSourceCounts`
  - `pathStrategySelectionSourceAverageMasteryDeltaPct`
  - `pathStrategySelectionSourcePositiveRatioPct`
  - `pathStrategyOutcomeByStrategy[]` (includes per-strategy execution count, average delta, positive/negative ratio, and source mix)
- `/api/knowledge/session/history` now supports both `POST` and `GET` query mode with shared filters:
  - aliases for strategy filter: `pathStrategy` / `path_strategy` / `learningPathStrategy` / `strategy`
  - aliases for strategy-source filter: `pathStrategySelectionSource` / `path_strategy_selection_source` / `selectionSource` / `strategy_source`
  - aliases for time-window filter: `sinceMinutes` / `since_minutes` / `windowMinutes` / `window_minutes`
  - `summary` now echoes `matchedRecordsBeforeLimit` and `appliedFilters` (`limit`, `sinceMinutes`, `pathStrategy`, `pathStrategySelectionSource`)
- `KnowledgeSystemState` now embeds `sessionStrategyTelemetry` for runtime governance:
  - trend-auto share and outcome signals (`trendAutoSelectionSharePct`, `trendAutoAverageMasteryDeltaPct`, `trendAutoNegativeRatioPct`)
  - source distribution and per-strategy aggregated outcome breakdown
- `POST /api/knowledge/quality/snapshot` now includes strategy-quality telemetry:
  - `snapshot.pathStrategyExecutionCoveragePct`
  - `snapshot.pathStrategyAverageMasteryDeltaPct`
  - `diagnostics.totalSessionExecutions`
  - `diagnostics.pathStrategyExecutionRecords`
- `GET /api/knowledge/quality/trend` deltas now include:
  - `pathStrategyExecutionCoverageDeltaPct`
  - `pathStrategyAverageMasteryDeltaDeltaPct`
- `GET /api/knowledge/quality/trend` now includes `strategyBreakdown[]` for strategy-segmented trend diagnostics:
  - Core fields: `strategy`, `status`, `score`, `confidence`, `reason`
  - Window snapshots: `windows.recent` and `windows.previous` with `sampleCount`, `executionCoveragePct`, `averageMasteryDeltaPct`
  - Strategy deltas: `deltas.executionCoverageDeltaPct`, `deltas.averageMasteryDeltaDeltaPct`
- Learning quality baseline management endpoints are now available:
  - `GET /api/knowledge/quality/baseline?userId=<id>`
  - `POST /api/knowledge/quality/baseline` (set/update baseline snapshot)
  - `POST /api/knowledge/quality/baseline/clear` (clear baseline snapshot)
  - `POST /api/knowledge/quality/baseline/evaluate` (evaluate current quality against stored baseline)
- `StudySessionResponse.signals.orchestration` now includes path-strategy decision telemetry:
  - `recommendedPathStrategy`
  - `pathStrategySelectionSource=explicit_request|strategy_trend|mode_fallback`
  - `pathStrategySelectionReason`
  - optional trend evidence: `pathStrategyTrendStatus`, `pathStrategyTrendScore`, `pathStrategyTrendConfidence`
- `StudySessionOrchestrationTrendRuntimeConfig` now includes:
  - `strategyAutoPathEnabled`
  - `strategyMinConfidence`
  - `POST /api/knowledge/session/orchestration/config` alias support:
    - `strategyAutoPathEnabled` / `strategy_auto_path_enabled` / `autoPathEnabled`
    - `strategyMinConfidence` / `strategy_min_confidence` / `autoPathMinConfidence`
- Alias compatibility for strategy:
  - `pathStrategy`
  - `path_strategy`
  - `learningStrategy`
- `LearningPathResponse.summary` includes:
  - `strategy`
  - `recommendedActionLimit`
  - `recommendedMasteryActionCount`
  - `recommendedDivergenceActionCount`
  - `recommendedEvidenceCoverageRatioPct`

## Mermaid Canonical Baseline (Obsidian)

- Standard compatible format: fenced code block using ` ```mermaid` (opening line) and ` ``` ` (closing line).
- Godot runtime rendering remains PNG-first; Mermaid renderer preference should allow fallback (`auto`) to avoid bridge-only hard failures.
- Detailed field and route contracts:
  - [Godot + NoteMD + Markdown Interfaces](./godot-notemd-markdown-interfaces.md)

## app_config Runtime Contract Hook

- Frontend app-config hydration command:
  - `invoke('get_app_runtime_config')`
- Hydrated projection:
  - `window.__NC_APP_CONFIG.language`
  - `window.__NC_APP_CONFIG.multiWindow.*`
- Detailed schema reference:
  - [app_config.toml Schema](./app-config-schema.md)

## Policy Gate Families

- PathBridge strict schema
- Storage provider contracts
- Mobile runtime boundary contracts
- SBOM + attestation policy contracts
- Sidecar signature and privacy manifest contracts
