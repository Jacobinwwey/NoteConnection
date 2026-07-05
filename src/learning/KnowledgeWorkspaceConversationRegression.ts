import type {
    AnswerReleaseDecision,
    AnswerReleaseGateId,
    KnowledgeQueryResolvedScope,
    RagEvidenceRole,
    RagSourceDecision,
    RagSourceBoundary,
    RagSufficiencyReview,
    RelationKind,
} from './types';

export interface KnowledgeWorkspaceConversationRegressionExpectation {
    minCitations: number;
    scopeSource: NonNullable<KnowledgeQueryResolvedScope['scopeSource']>;
    answerReleaseDecision?: AnswerReleaseDecision;
    acceptedAnswerReleaseDecisions?: AnswerReleaseDecision[];
    runtimeAnswerReleaseDecision?: AnswerReleaseDecision;
    runtimeRequiredFailedGateIds?: AnswerReleaseGateId[];
    plannerTitleLikeQueries: string[];
    retrievalModes?: string[];
    primarySourcePath: string;
    recoveredSourcePaths?: string[];
    answerMustContain?: string[];
    answerMustNotContain?: string[];
    ragSourceBoundary?: RagSourceBoundary;
    requiredRagRoles?: RagEvidenceRole[];
    acceptedRagSufficiencyStatuses?: Array<RagSufficiencyReview['status']>;
    minimumRagSourceDecisionStatusCounts?: Partial<Record<RagSourceDecision['status'], number>>;
    inMemoryMinimumRagSourceDecisionStatusCounts?: Partial<Record<RagSourceDecision['status'], number>>;
    expectedRagDeterministic?: boolean;
    expectedRagLlmJudgeUsed?: boolean;
    expectedRagRecoveryAttempted?: boolean;
    inMemoryExpectedRagRecoveryAttempted?: boolean;
    acceptedRagDegradationStates?: Array<NonNullable<RagSufficiencyReview['degradationState']>>;
    minimumRagRecoveryBeforeSourceDecisionStatusCounts?: Partial<Record<RagSourceDecision['status'], number>>;
    inMemoryMinimumRagRecoveryBeforeSourceDecisionStatusCounts?: Partial<Record<RagSourceDecision['status'], number>>;
    requiredRagRecoveryBeforeReasonFragments?: string[];
    runtimeRequiredRagRecoveryBeforeReasonFragments?: string[];
    requiredFirstGraphSuccessorTitle?: string;
    requiredGraphSuccessorTitles?: string[];
    forbiddenGraphSuccessorTitles?: string[];
    requiredGraphSuccessorRelationKinds?: RelationKind[];
    forbiddenGraphNeighborFragmentTitles?: string[];
    requireScopedDocumentIds?: boolean;
}

export interface KnowledgeWorkspaceConversationRegressionCase {
    id: string;
    description: string;
    preloadTargets: string[];
    activeTarget: string;
    query: string;
    topK?: number;
    runtimeProviderFixture?: 'malformed_json' | 'timeout';
    expected: KnowledgeWorkspaceConversationRegressionExpectation;
}

function freezeRegressionCases(
    cases: KnowledgeWorkspaceConversationRegressionCase[]
): KnowledgeWorkspaceConversationRegressionCase[] {
    const seenIds = new Set<string>();
    cases.forEach((entry) => {
        const id = String(entry.id || '').trim();
        if (!id) {
            throw new Error('Knowledge workspace conversation regression cases require a non-empty id.');
        }
        if (seenIds.has(id)) {
            throw new Error(`Duplicate knowledge workspace conversation regression case id: ${id}`);
        }
        seenIds.add(id);
        if (!Array.isArray(entry.preloadTargets) || entry.preloadTargets.length <= 0) {
            throw new Error(`Knowledge workspace conversation regression case "${id}" requires preload targets.`);
        }
        const normalizedActiveTarget = String(entry.activeTarget || '').trim();
        if (!normalizedActiveTarget) {
            throw new Error(`Knowledge workspace conversation regression case "${id}" requires an activeTarget.`);
        }
        if (!entry.preloadTargets.some((target) => String(target || '').trim() === normalizedActiveTarget)) {
            throw new Error(
                `Knowledge workspace conversation regression case "${id}" must include the activeTarget in preloadTargets.`
            );
        }
    });
    return cases;
}

export const KNOWLEDGE_WORKSPACE_CONVERSATION_REGRESSION_CASES = freezeRegressionCases([
    {
        id: 'waterglass_explicit_scope_compact_zh',
        description: 'Compact mixed-language alias inside the explicit waterglass scope should retrieve grounded evidence.',
        preloadTargets: ['waterglass'],
        activeTarget: 'waterglass',
        query: '什么是waterglass?',
        expected: {
            minCitations: 1,
            scopeSource: 'explicit_request',
            acceptedAnswerReleaseDecisions: ['release', 'revise'],
            runtimeAnswerReleaseDecision: 'revise',
            runtimeRequiredFailedGateIds: ['query_intent_alignment'],
            plannerTitleLikeQueries: ['waterglass', 'water glass'],
            primarySourcePath: 'Knowledge_Base/waterglass/water glass.md',
            answerMustContain: ['水杯', '透明', '容器'],
            answerMustNotContain: [
                'No scoped knowledge points matched',
                'retrieval_candidates_below_threshold',
                '本技术文档旨在',
            ],
            ragSourceBoundary: 'full_document',
            requiredRagRoles: ['direct_support', 'parent_context', 'graph_neighbor_support'],
            acceptedRagSufficiencyStatuses: ['sufficient', 'borderline'],
        },
    },
    {
        id: 'waterglass_explicit_scope_spaced_zh',
        description: 'Spaced mixed-language alias inside the explicit waterglass scope should retrieve the same grounded note.',
        preloadTargets: ['waterglass'],
        activeTarget: 'waterglass',
        query: '什么是water glass',
        expected: {
            minCitations: 1,
            scopeSource: 'explicit_request',
            acceptedAnswerReleaseDecisions: ['release', 'revise'],
            plannerTitleLikeQueries: ['water glass', 'waterglass'],
            primarySourcePath: 'Knowledge_Base/waterglass/water glass.md',
            answerMustContain: ['水杯', '透明', '容器'],
            answerMustNotContain: [
                'No scoped knowledge points matched',
                'retrieval_candidates_below_threshold',
                '本技术文档旨在',
            ],
            ragSourceBoundary: 'full_document',
            requiredRagRoles: ['direct_support', 'parent_context', 'graph_neighbor_support'],
            acceptedRagSufficiencyStatuses: ['sufficient', 'borderline'],
        },
    },
    {
        id: 'waterglass_compare_materials_en',
        description: 'Compare-intent query in the explicit waterglass scope should keep evidence for both container materials.',
        preloadTargets: ['waterglass'],
        activeTarget: 'waterglass',
        query: 'compare water glass and plastic cup',
        expected: {
            minCitations: 1,
            scopeSource: 'explicit_request',
            acceptedAnswerReleaseDecisions: ['release', 'revise'],
            plannerTitleLikeQueries: ['water glass', 'plastic cup'],
            primarySourcePath: 'Knowledge_Base/waterglass/water glass.md',
            answerMustContain: ['glass', 'plastic'],
            answerMustNotContain: [
                'No scoped knowledge points matched',
                'retrieval_candidates_below_threshold',
            ],
            ragSourceBoundary: 'full_document',
            requiredRagRoles: ['direct_support', 'parent_context', 'graph_neighbor_support'],
            acceptedRagSufficiencyStatuses: ['sufficient', 'borderline'],
            requireScopedDocumentIds: false,
        },
    },
    {
        id: 'graphintent_compare_neighbor_selection_en',
        description: 'Compare-intent graph assembly should prefer material analogy neighbors over a higher-confidence procedural sequence edge.',
        preloadTargets: ['graphintent'],
        activeTarget: 'graphintent',
        query: 'compare brittle glass vessel with polymer cup material behavior',
        expected: {
            minCitations: 1,
            scopeSource: 'explicit_request',
            acceptedAnswerReleaseDecisions: ['release', 'revise'],
            plannerTitleLikeQueries: ['brittle glass vessel', 'polymer cup material behavior'],
            primarySourcePath: 'Knowledge_Base/graphintent/brittle glass vessel.md',
            answerMustContain: ['Brittle', 'Ductile', 'Polymer'],
            answerMustNotContain: [
                'No scoped knowledge points matched',
                'retrieval_candidates_below_threshold',
                'Procedural Calibration Sequence',
            ],
            ragSourceBoundary: 'full_document',
            requiredRagRoles: ['direct_support', 'parent_context', 'graph_neighbor_support'],
            acceptedRagSufficiencyStatuses: ['sufficient', 'borderline'],
            requiredGraphSuccessorTitles: [
                'Ductile Polymer Cup Analogy',
                'Reusable Polymer Vessel Analogy',
            ],
            forbiddenGraphSuccessorTitles: ['Procedural Calibration Sequence'],
            requiredGraphSuccessorRelationKinds: ['analogy'],
            forbiddenGraphNeighborFragmentTitles: ['Procedural Calibration Sequence'],
            requireScopedDocumentIds: false,
        },
    },
    {
        id: 'financial_scope_recovery_spaced_en',
        description: 'A spaced title-like query should recover from the financial scope into the waterglass note when the selected scope misses.',
        preloadTargets: ['financial', 'waterglass'],
        activeTarget: 'financial',
        query: 'what is water glass?',
        expected: {
            minCitations: 1,
            scopeSource: 'planner_scope_recovery',
            acceptedAnswerReleaseDecisions: ['release', 'revise'],
            plannerTitleLikeQueries: ['water glass', 'waterglass'],
            retrievalModes: ['planner_scope_recovery'],
            primarySourcePath: 'Knowledge_Base/waterglass/water glass.md',
            recoveredSourcePaths: ['Knowledge_Base/waterglass/water glass.md'],
            answerMustNotContain: [
                'No scoped knowledge points matched',
                'retrieval_candidates_below_threshold',
            ],
        },
    },
    {
        id: 'financial_scope_recovery_compact_en',
        description: 'A compact alias should also recover from the financial scope into the waterglass note without leaking diagnostics.',
        preloadTargets: ['financial', 'waterglass'],
        activeTarget: 'financial',
        query: 'what is waterglass?',
        expected: {
            minCitations: 1,
            scopeSource: 'planner_scope_recovery',
            acceptedAnswerReleaseDecisions: ['release', 'revise'],
            plannerTitleLikeQueries: ['waterglass', 'water glass'],
            retrievalModes: ['planner_scope_recovery'],
            primarySourcePath: 'Knowledge_Base/waterglass/water glass.md',
            recoveredSourcePaths: ['Knowledge_Base/waterglass/water glass.md'],
            answerMustNotContain: [
                'No scoped knowledge points matched',
                'retrieval_candidates_below_threshold',
            ],
        },
    },
    {
        id: 'contextbudget_source_window_truncation_en',
        description: 'A long scoped note should read the full source document while keeping the model-visible RAG pack budgeted.',
        preloadTargets: ['contextbudget'],
        activeTarget: 'contextbudget',
        query: 'what is context budget probe?',
        expected: {
            minCitations: 1,
            scopeSource: 'explicit_request',
            acceptedAnswerReleaseDecisions: ['release', 'revise'],
            plannerTitleLikeQueries: ['context budget probe'],
            primarySourcePath: 'Knowledge_Base/contextbudget/context budget probe.md',
            answerMustNotContain: [
                'No scoped knowledge points matched',
                'retrieval_candidates_below_threshold',
            ],
            ragSourceBoundary: 'full_document',
            requiredRagRoles: ['direct_support', 'parent_context'],
            acceptedRagSufficiencyStatuses: ['sufficient', 'borderline'],
            minimumRagSourceDecisionStatusCounts: {
                read: 1,
                fragment_truncated: 1,
            },
            expectedRagDeterministic: true,
            expectedRagLlmJudgeUsed: false,
            expectedRagRecoveryAttempted: false,
            acceptedRagDegradationStates: ['none'],
        },
    },
    {
        id: 'contextoverflow_no_provider_budget_drop_en',
        description: 'A dense scoped note should stay deterministic without an LLM provider and expose fragment-drop budget pressure.',
        preloadTargets: ['contextoverflow'],
        activeTarget: 'contextoverflow',
        query: 'what is overflow budget probe?',
        expected: {
            minCitations: 1,
            scopeSource: 'explicit_request',
            acceptedAnswerReleaseDecisions: ['release', 'revise'],
            plannerTitleLikeQueries: ['overflow budget probe'],
            primarySourcePath: 'Knowledge_Base/contextoverflow/overflow budget probe.md',
            answerMustNotContain: [
                'No scoped knowledge points matched',
                'retrieval_candidates_below_threshold',
                'llm_judge_failed',
            ],
            ragSourceBoundary: 'full_document',
            requiredRagRoles: ['direct_support', 'parent_context'],
            acceptedRagSufficiencyStatuses: ['sufficient', 'borderline'],
            minimumRagSourceDecisionStatusCounts: {
                read: 1,
                fragment_dropped: 1,
            },
            expectedRagDeterministic: true,
            expectedRagLlmJudgeUsed: false,
            expectedRagRecoveryAttempted: false,
            inMemoryExpectedRagRecoveryAttempted: true,
            acceptedRagDegradationStates: ['none', 'partial_coverage'],
            inMemoryMinimumRagSourceDecisionStatusCounts: {
                read: 1,
            },
            inMemoryMinimumRagRecoveryBeforeSourceDecisionStatusCounts: {
                fragment_dropped: 1,
            },
        },
    },
    {
        id: 'contextoverflow_malformed_provider_judge_fallback_en',
        description: 'A dense scoped note should keep answering when a configured RAG sufficiency provider returns malformed judge JSON.',
        preloadTargets: ['contextoverflow'],
        activeTarget: 'contextoverflow',
        query: 'what is overflow budget probe?',
        topK: 12,
        runtimeProviderFixture: 'malformed_json',
        expected: {
            minCitations: 1,
            scopeSource: 'explicit_request',
            acceptedAnswerReleaseDecisions: ['release', 'revise'],
            plannerTitleLikeQueries: ['overflow budget probe'],
            primarySourcePath: 'Knowledge_Base/contextoverflow/overflow budget probe.md',
            answerMustNotContain: [
                'No scoped knowledge points matched',
                'retrieval_candidates_below_threshold',
            ],
            ragSourceBoundary: 'full_document',
            requiredRagRoles: ['direct_support', 'parent_context'],
            acceptedRagSufficiencyStatuses: ['sufficient', 'borderline'],
            minimumRagSourceDecisionStatusCounts: {
                read: 1,
            },
            expectedRagDeterministic: true,
            expectedRagLlmJudgeUsed: false,
            expectedRagRecoveryAttempted: true,
            acceptedRagDegradationStates: ['none', 'partial_coverage'],
            minimumRagRecoveryBeforeSourceDecisionStatusCounts: {
                fragment_dropped: 1,
            },
            runtimeRequiredRagRecoveryBeforeReasonFragments: ['llm_judge_failed'],
        },
    },
    {
        id: 'contextoverflow_timeout_provider_judge_fallback_en',
        description: 'A dense scoped note should keep answering when a configured RAG sufficiency provider times out.',
        preloadTargets: ['contextoverflow'],
        activeTarget: 'contextoverflow',
        query: 'what is overflow budget probe?',
        topK: 12,
        runtimeProviderFixture: 'timeout',
        expected: {
            minCitations: 1,
            scopeSource: 'explicit_request',
            acceptedAnswerReleaseDecisions: ['release', 'revise'],
            plannerTitleLikeQueries: ['overflow budget probe'],
            primarySourcePath: 'Knowledge_Base/contextoverflow/overflow budget probe.md',
            answerMustNotContain: [
                'No scoped knowledge points matched',
                'retrieval_candidates_below_threshold',
            ],
            ragSourceBoundary: 'full_document',
            requiredRagRoles: ['direct_support', 'parent_context'],
            acceptedRagSufficiencyStatuses: ['sufficient', 'borderline'],
            minimumRagSourceDecisionStatusCounts: {
                read: 1,
            },
            expectedRagDeterministic: true,
            expectedRagLlmJudgeUsed: false,
            expectedRagRecoveryAttempted: true,
            acceptedRagDegradationStates: ['none', 'partial_coverage'],
            minimumRagRecoveryBeforeSourceDecisionStatusCounts: {
                fragment_dropped: 1,
            },
            runtimeRequiredRagRecoveryBeforeReasonFragments: ['llm_judge_failed'],
        },
    },
]);

export function selectKnowledgeWorkspaceConversationRegressionCases(
    caseIds?: readonly string[]
): KnowledgeWorkspaceConversationRegressionCase[] {
    if (!Array.isArray(caseIds) || caseIds.length <= 0) {
        return KNOWLEDGE_WORKSPACE_CONVERSATION_REGRESSION_CASES.slice();
    }
    const requestedIds = caseIds
        .map((caseId) => String(caseId || '').trim())
        .filter(Boolean);
    if (requestedIds.length <= 0) {
        return KNOWLEDGE_WORKSPACE_CONVERSATION_REGRESSION_CASES.slice();
    }
    const caseById = new Map(
        KNOWLEDGE_WORKSPACE_CONVERSATION_REGRESSION_CASES.map((entry) => [entry.id, entry] as const)
    );
    const selectedCases = requestedIds.map((caseId) => {
        const matchedCase = caseById.get(caseId);
        if (!matchedCase) {
            throw new Error(`Unknown knowledge workspace conversation regression case: ${caseId}`);
        }
        return matchedCase;
    });
    return selectedCases;
}
