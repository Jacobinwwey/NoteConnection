import type {
    AnswerReleaseDecision,
    AnswerReleaseGateId,
    KnowledgeQueryResolvedScope,
    RagEvidenceRole,
    RagFailureStage,
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
    minimumRagFullDocumentFragmentCounts?: Partial<Record<RagEvidenceRole, number>>;
    acceptedRagSufficiencyStatuses?: Array<RagSufficiencyReview['status']>;
    minimumRagSourceDecisionStatusCounts?: Partial<Record<RagSourceDecision['status'], number>>;
    inMemoryMinimumRagSourceDecisionStatusCounts?: Partial<Record<RagSourceDecision['status'], number>>;
    requiredRagFailureStages?: RagFailureStage[];
    runtimeRequiredRagFailureStages?: RagFailureStage[];
    runtimeAcceptedRagSufficiencyStatuses?: Array<RagSufficiencyReview['status']>;
    runtimeAcceptedRagDegradationStates?: Array<NonNullable<RagSufficiencyReview['degradationState']>>;
    runtimeRequiredRagSufficiencyReasonFragments?: string[];
    runtimeRequiredRagSourceDecisionReasonFragments?: string[];
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
    minimumGraphIntentAlignedPredecessorCandidates?: number;
    minimumGraphIntentAlignedSuccessorCandidates?: number;
    minimumGraphIntentMisalignedPredecessorCandidates?: number;
    minimumGraphIntentMisalignedSuccessorCandidates?: number;
    expectedGraphUsedMisalignedPredecessorFallback?: boolean;
    expectedGraphUsedMisalignedSuccessorFallback?: boolean;
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
    runtimeUnavailableSourcePaths?: string[];
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
            runtimeRequiredFailedGateIds: ['query_intent_alignment', 'rag_claim_citation_support'],
            plannerTitleLikeQueries: ['waterglass', 'water glass'],
            primarySourcePath: 'Knowledge_Base/waterglass/water glass.md',
            answerMustContain: ['水杯', '透明', '容器'],
            answerMustNotContain: [
                'No scoped knowledge points matched',
                'retrieval_candidates_below_threshold',
                '本技术文档旨在',
                '所有推理过程',
                '最终输出',
                '遵从您的指示',
                '遵从您的要求',
                'all reasoning',
                'final output',
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
            runtimeAnswerReleaseDecision: 'revise',
            runtimeRequiredFailedGateIds: ['query_intent_alignment', 'rag_claim_citation_support'],
            plannerTitleLikeQueries: ['water glass', 'waterglass'],
            primarySourcePath: 'Knowledge_Base/waterglass/water glass.md',
            answerMustContain: ['水杯', '透明', '容器'],
            answerMustNotContain: [
                'No scoped knowledge points matched',
                'retrieval_candidates_below_threshold',
                '本技术文档旨在',
                '所有推理过程',
                '最终输出',
                '遵从您的指示',
                '遵从您的要求',
                'all reasoning',
                'final output',
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
            minimumRagFullDocumentFragmentCounts: {
                graph_neighbor_support: 1,
            },
            acceptedRagSufficiencyStatuses: ['sufficient', 'borderline'],
            requiredGraphSuccessorTitles: [
                'Ductile Polymer Cup Analogy',
                'Reusable Polymer Vessel Analogy',
            ],
            forbiddenGraphSuccessorTitles: ['Procedural Calibration Sequence'],
            requiredGraphSuccessorRelationKinds: ['analogy'],
            forbiddenGraphNeighborFragmentTitles: ['Procedural Calibration Sequence'],
            minimumGraphIntentAlignedSuccessorCandidates: 2,
            minimumGraphIntentMisalignedSuccessorCandidates: 1,
            expectedGraphUsedMisalignedSuccessorFallback: false,
            requireScopedDocumentIds: false,
        },
    },
    {
        id: 'graphintent_missing_neighbor_source_window_en',
        description: 'Graph-neighbor source-window loss should degrade graph evidence instead of treating direct spans as complete graph support.',
        preloadTargets: ['graphintent'],
        activeTarget: 'graphintent',
        query: 'compare brittle glass vessel with polymer cup material behavior',
        runtimeUnavailableSourcePaths: [
            'Knowledge_Base/graphintent/ductile polymer cup analogy.md',
            'Knowledge_Base/graphintent/reusable polymer vessel analogy.md',
        ],
        expected: {
            minCitations: 1,
            scopeSource: 'explicit_request',
            acceptedAnswerReleaseDecisions: ['release', 'revise'],
            plannerTitleLikeQueries: ['brittle glass vessel', 'polymer cup material behavior'],
            primarySourcePath: 'Knowledge_Base/graphintent/brittle glass vessel.md',
            answerMustContain: ['Brittle'],
            answerMustNotContain: [
                'No scoped knowledge points matched',
                'retrieval_candidates_below_threshold',
            ],
            ragSourceBoundary: 'full_document',
            requiredRagRoles: ['direct_support', 'parent_context', 'graph_neighbor_support'],
            acceptedRagSufficiencyStatuses: ['sufficient', 'borderline'],
            runtimeAcceptedRagSufficiencyStatuses: ['borderline'],
            acceptedRagDegradationStates: ['none', 'partial_coverage'],
            runtimeAcceptedRagDegradationStates: ['partial_coverage'],
            minimumRagSourceDecisionStatusCounts: {
                source_window_unavailable: 1,
            },
            inMemoryMinimumRagSourceDecisionStatusCounts: {
                read: 1,
            },
            runtimeRequiredRagFailureStages: ['parsing_source', 'graph_evidence'],
            runtimeRequiredRagSufficiencyReasonFragments: ['graph_neighbor_evidence_missing'],
            runtimeRequiredRagSourceDecisionReasonFragments: ['graph_neighbor_support'],
            expectedRagDeterministic: true,
            expectedRagLlmJudgeUsed: false,
            expectedRagRecoveryAttempted: true,
            inMemoryExpectedRagRecoveryAttempted: false,
            requiredGraphSuccessorTitles: [
                'Ductile Polymer Cup Analogy',
                'Reusable Polymer Vessel Analogy',
            ],
            requiredGraphSuccessorRelationKinds: ['analogy'],
            minimumGraphIntentAlignedSuccessorCandidates: 2,
            minimumGraphIntentMisalignedSuccessorCandidates: 1,
            expectedGraphUsedMisalignedSuccessorFallback: false,
            requireScopedDocumentIds: false,
        },
    },
    {
        id: 'graphintent_multi_neighbor_source_loss_en',
        description: 'Multiple graph-neighbor source-window losses should be recorded per neighbor document and degrade graph evidence as partial coverage.',
        preloadTargets: ['graphintent'],
        activeTarget: 'graphintent',
        query: 'compare brittle glass vessel with polymer cup material behavior',
        runtimeUnavailableSourcePaths: [
            'Knowledge_Base/graphintent/ductile polymer cup analogy.md',
            'Knowledge_Base/graphintent/reusable polymer vessel analogy.md',
        ],
        expected: {
            minCitations: 1,
            scopeSource: 'explicit_request',
            acceptedAnswerReleaseDecisions: ['release', 'revise'],
            plannerTitleLikeQueries: ['brittle glass vessel', 'polymer cup material behavior'],
            primarySourcePath: 'Knowledge_Base/graphintent/brittle glass vessel.md',
            answerMustContain: ['Brittle'],
            answerMustNotContain: [
                'No scoped knowledge points matched',
                'retrieval_candidates_below_threshold',
            ],
            ragSourceBoundary: 'full_document',
            requiredRagRoles: ['direct_support', 'parent_context', 'graph_neighbor_support'],
            acceptedRagSufficiencyStatuses: ['sufficient', 'borderline'],
            runtimeAcceptedRagSufficiencyStatuses: ['borderline'],
            acceptedRagDegradationStates: ['none', 'partial_coverage'],
            runtimeAcceptedRagDegradationStates: ['partial_coverage'],
            minimumRagSourceDecisionStatusCounts: {
                source_window_unavailable: 2,
            },
            inMemoryMinimumRagSourceDecisionStatusCounts: {
                read: 1,
            },
            runtimeRequiredRagFailureStages: ['parsing_source', 'graph_evidence'],
            runtimeRequiredRagSufficiencyReasonFragments: ['graph_neighbor_evidence_missing'],
            runtimeRequiredRagSourceDecisionReasonFragments: ['graph_neighbor_support'],
            expectedRagDeterministic: true,
            expectedRagLlmJudgeUsed: false,
            expectedRagRecoveryAttempted: true,
            inMemoryExpectedRagRecoveryAttempted: false,
            requiredGraphSuccessorTitles: [
                'Ductile Polymer Cup Analogy',
                'Reusable Polymer Vessel Analogy',
            ],
            requiredGraphSuccessorRelationKinds: ['analogy'],
            minimumGraphIntentAlignedSuccessorCandidates: 2,
            minimumGraphIntentMisalignedSuccessorCandidates: 1,
            expectedGraphUsedMisalignedSuccessorFallback: false,
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
        id: 'conflicting_adjacent_evidence_probe_en',
        description: 'A scoped note with adjacent contradictory tolerance values should degrade as conflict instead of publishing one stable value.',
        preloadTargets: ['ragconflict'],
        activeTarget: 'ragconflict',
        query: 'what is calibration tolerance conflict probe?',
        expected: {
            minCitations: 1,
            scopeSource: 'explicit_request',
            acceptedAnswerReleaseDecisions: ['release', 'revise'],
            plannerTitleLikeQueries: ['calibration tolerance conflict probe'],
            primarySourcePath: 'Knowledge_Base/ragconflict/calibration tolerance conflict probe.md',
            answerMustContain: ['calibration tolerance', '+/-0.10 mm', '+/-0.50 mm'],
            answerMustNotContain: [
                'No scoped knowledge points matched',
                'retrieval_candidates_below_threshold',
                'single stable calibration tolerance',
            ],
            ragSourceBoundary: 'full_document',
            requiredRagRoles: ['direct_support', 'parent_context', 'conflict'],
            acceptedRagSufficiencyStatuses: ['borderline'],
            acceptedRagDegradationStates: ['conflict'],
            requiredRagFailureStages: ['context_assembly'],
            expectedRagDeterministic: true,
            expectedRagLlmJudgeUsed: false,
            requireScopedDocumentIds: false,
        },
    },
    {
        id: 'conflicting_nonadjacent_section_evidence_probe_en',
        description: 'A scoped note with non-adjacent contradictory tolerance values in one section should still degrade as conflict.',
        preloadTargets: ['ragconflict'],
        activeTarget: 'ragconflict',
        query: 'what is remote calibration tolerance conflict probe?',
        expected: {
            minCitations: 1,
            scopeSource: 'explicit_request',
            acceptedAnswerReleaseDecisions: ['release', 'revise'],
            plannerTitleLikeQueries: ['remote calibration tolerance conflict probe'],
            primarySourcePath: 'Knowledge_Base/ragconflict/remote calibration tolerance conflict probe.md',
            answerMustContain: ['calibration tolerance', '+/-0.10 mm', '+/-0.50 mm'],
            answerMustNotContain: [
                'No scoped knowledge points matched',
                'retrieval_candidates_below_threshold',
                'single stable calibration tolerance',
            ],
            ragSourceBoundary: 'full_document',
            requiredRagRoles: ['direct_support', 'parent_context', 'conflict'],
            acceptedRagSufficiencyStatuses: ['borderline'],
            acceptedRagDegradationStates: ['conflict'],
            requiredRagFailureStages: ['context_assembly'],
            expectedRagDeterministic: true,
            expectedRagLlmJudgeUsed: false,
            requireScopedDocumentIds: false,
        },
    },
    {
        id: 'conflicting_release_date_evidence_probe_en',
        description: 'A scoped note with contradictory release dates in one section should degrade as conflict instead of publishing one stable date.',
        preloadTargets: ['ragdateconflict'],
        activeTarget: 'ragdateconflict',
        query: 'what is release date conflict probe?',
        expected: {
            minCitations: 1,
            scopeSource: 'explicit_request',
            acceptedAnswerReleaseDecisions: ['release', 'revise'],
            plannerTitleLikeQueries: ['release date conflict probe'],
            primarySourcePath: 'Knowledge_Base/ragdateconflict/release date conflict probe.md',
            answerMustContain: ['migration release date', '2026-07-01', '2026-08-15'],
            answerMustNotContain: [
                'No scoped knowledge points matched',
                'retrieval_candidates_below_threshold',
                'stable migration release date',
            ],
            ragSourceBoundary: 'full_document',
            requiredRagRoles: ['direct_support', 'parent_context', 'conflict'],
            acceptedRagSufficiencyStatuses: ['borderline'],
            acceptedRagDegradationStates: ['conflict'],
            requiredRagFailureStages: ['context_assembly'],
            expectedRagDeterministic: true,
            expectedRagLlmJudgeUsed: false,
            requireScopedDocumentIds: false,
        },
    },
    {
        id: 'conflicting_multi_document_evidence_probe_en',
        description: 'Two scoped documents with contradictory calibration tolerance facts should degrade as cross-document conflict.',
        preloadTargets: ['ragmulticonflict'],
        activeTarget: 'ragmulticonflict',
        query: 'compare multi document calibration tolerance conflict probe with field calibration tolerance conflict evidence',
        expected: {
            minCitations: 2,
            scopeSource: 'explicit_request',
            acceptedAnswerReleaseDecisions: ['release', 'revise'],
            plannerTitleLikeQueries: [
                'multi document calibration tolerance conflict probe',
                'field calibration tolerance conflict evidence',
            ],
            primarySourcePath: 'Knowledge_Base/ragmulticonflict/field calibration tolerance conflict evidence.md',
            answerMustContain: ['calibration tolerance', '+/-0.10 mm', '+/-0.50 mm'],
            answerMustNotContain: [
                'No scoped knowledge points matched',
                'retrieval_candidates_below_threshold',
                'single stable calibration tolerance',
            ],
            ragSourceBoundary: 'full_document',
            requiredRagRoles: ['direct_support', 'parent_context', 'conflict'],
            acceptedRagSufficiencyStatuses: ['borderline'],
            acceptedRagDegradationStates: ['conflict'],
            requiredRagFailureStages: ['context_assembly'],
            expectedRagDeterministic: true,
            expectedRagLlmJudgeUsed: false,
            requireScopedDocumentIds: false,
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
            requiredRagFailureStages: ['context_assembly'],
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
            requiredRagFailureStages: ['context_assembly'],
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
            requiredRagFailureStages: ['context_assembly'],
            runtimeRequiredRagFailureStages: ['context_assembly', 'generation'],
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
            requiredRagFailureStages: ['context_assembly'],
            runtimeRequiredRagFailureStages: ['context_assembly', 'generation'],
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
