import type {
    AnswerReleaseDecision,
    AnswerReleaseGateId,
    KnowledgeQueryResolvedScope,
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
    answerMustNotContain?: string[];
}

export interface KnowledgeWorkspaceConversationRegressionCase {
    id: string;
    description: string;
    preloadTargets: string[];
    activeTarget: string;
    query: string;
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
            answerMustNotContain: [
                'No scoped knowledge points matched',
                'retrieval_candidates_below_threshold',
                '本技术文档旨在',
            ],
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
            answerMustNotContain: [
                'No scoped knowledge points matched',
                'retrieval_candidates_below_threshold',
                '本技术文档旨在',
            ],
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
