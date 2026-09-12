/** Wire tokens shared by capability producers and independently checked UI registries. */
export const AGENT_WORKSPACE_OPERATION_IDS = Object.freeze([
    'build_learning_path',
    'search_conversation_memory',
    'fetch_conversation_turn_cache_diagnostics',
    'fetch_conversation_turn_cache_alert_trend',
    'fetch_conversation_turn_cache_alert_trend_index',
    'fetch_conversation_turn_cache_alert_trend_export',
    'compare_query_backends',
    'fetch_query_backend_diagnostics',
    'fetch_query_backend_comparison_history',
    'fetch_query_backend_comparison_trend',
    'fetch_tutor_adapter_telemetry',
    'fetch_tutor_trace_diagnostics',
    'fetch_learning_quality_trend',
    'fetch_learning_quality_history',
    'evaluate_learning_quality_baseline',
    'fetch_session_plan_quality_trend',
    'fetch_session_plan_quality_history',
    'verify_runtime_capability_runbook',
    'fetch_runtime_capability_runbook_history',
    'fetch_runtime_capability_runbook_checks',
    'fetch_runtime_capability_runbook_action_queue',
    'fetch_session_history',
    'fetch_workflow_artifacts',
    'execute_workflow_artifact_review_follow_up',
    'execute_study_session_action',
    'build_study_session',
    'execute_tutor_action',
] as const);

export const AGENT_WORKSPACE_RESULT_PRESENTATIONS = Object.freeze([
    'learning_path_pane',
    'assistant_message',
    'workflow_artifact_review_follow_up',
    'conversation_turn_cache_diagnostics_card',
    'conversation_turn_cache_alert_trend_card',
    'query_backend_comparison_card',
    'query_backend_diagnostics_card',
    'query_backend_comparison_history_card',
    'query_backend_comparison_trend_card',
    'tutor_adapter_telemetry_card',
    'tutor_trace_diagnostics_card',
    'learning_quality_trend_card',
    'learning_quality_history_card',
    'learning_quality_baseline_evaluation_card',
    'session_plan_quality_trend_card',
    'session_plan_quality_history_card',
    'runtime_capability_runbook_verify_card',
    'runtime_capability_runbook_history_card',
    'runtime_capability_runbook_checks_card',
    'runtime_capability_runbook_action_queue_card',
    'session_history_card',
    'flashcard_batch_card',
    'knowledge_run_card',
    'knowledge_run_history_card',
    'study_session_card',
    'tutor_action_card',
] as const);

export const AGENT_WORKSPACE_EXECUTION_KINDS = Object.freeze([
    'knowledge_operation',
    'local_focus_mode',
] as const);

export type AgentWorkspaceOperationId = typeof AGENT_WORKSPACE_OPERATION_IDS[number];
export type AgentWorkspaceResultPresentation = typeof AGENT_WORKSPACE_RESULT_PRESENTATIONS[number];
export type AgentWorkspaceExecution =
    | { kind: 'local_focus_mode' }
    | { kind: 'knowledge_operation'; operationId: AgentWorkspaceOperationId; resultPresentation: AgentWorkspaceResultPresentation };

export interface AgentWorkspaceCapability {
    capabilityId: string;
    actionId: string;
    targetAtomId: string;
    label: string;
    labelKey?: string;
    request?: Record<string, unknown>;
    execution: AgentWorkspaceExecution;
}
