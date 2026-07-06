import type {
    AgentConversationGraphContext,
    RagContextPack,
    RagEvidenceFragment,
    RagSufficiencyReview,
} from './types';

export interface RagSufficiencyJudgeInput {
    query: string;
    contextPack: RagContextPack;
    graphContext?: AgentConversationGraphContext | null;
}

export type RagSufficiencyLlmJudge = (
    input: RagSufficiencyJudgeInput
) => Promise<Partial<RagSufficiencyReview> | null>;

export interface ReviewRagContextSufficiencyParams extends RagSufficiencyJudgeInput {
    reviewedAt?: string;
    allowLlmJudge?: boolean;
    llmJudge?: RagSufficiencyLlmJudge;
}

function clampUnit(value: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Number(Math.max(0, Math.min(1, value)).toFixed(4));
}

function hasCitation(fragment: RagEvidenceFragment): boolean {
    return Array.isArray(fragment.citationIds) && fragment.citationIds.some((citationId) => String(citationId || '').trim());
}

function textHasSubstance(fragment: RagEvidenceFragment): boolean {
    return String(fragment.text || '').trim().length >= 24;
}

function hasDirectSupport(fragments: RagEvidenceFragment[]): boolean {
    return fragments.some((fragment) => fragment.role === 'direct_support' && hasCitation(fragment) && textHasSubstance(fragment));
}

function hasDocumentAugmentation(fragments: RagEvidenceFragment[]): boolean {
    return fragments.some((fragment) => (
        (fragment.role === 'parent_context' || fragment.role === 'adjacent_context')
        && fragment.sourceBoundary === 'full_document'
        && textHasSubstance(fragment)
    ));
}

function hasGraphEvidence(fragments: RagEvidenceFragment[]): boolean {
    return fragments.some((fragment) => fragment.role === 'graph_neighbor_support' && hasCitation(fragment) && textHasSubstance(fragment));
}

function hasConflictEvidence(fragments: RagEvidenceFragment[]): boolean {
    return fragments.some((fragment) => fragment.role === 'conflict' && textHasSubstance(fragment));
}

function hasUnavailableGraphNeighborSourceWindow(pack: RagContextPack): boolean {
    return pack.sourceDecisions.some((decision) => (
        decision.status === 'source_window_unavailable'
        && String(decision.reason || '').includes('graph_neighbor_support')
    ));
}

function hasBudgetViolation(pack: RagContextPack): boolean {
    return pack.sourceDecisions.some((decision) => (
        decision.status === 'fragment_dropped'
        && (decision.reason === 'max_total_chars_exceeded' || decision.reason === 'max_fragments_exceeded')
    ));
}

function buildDeterministicReview(params: ReviewRagContextSufficiencyParams): RagSufficiencyReview {
    const fragments = Array.isArray(params.contextPack.fragments) ? params.contextPack.fragments : [];
    const directSupport = hasDirectSupport(fragments);
    const documentAugmentation = hasDocumentAugmentation(fragments);
    const graphEvidence = hasGraphEvidence(fragments);
    const conflictEvidence = hasConflictEvidence(fragments);
    const graphNeighborSourceUnavailable = hasUnavailableGraphNeighborSourceWindow(params.contextPack);
    const budgetViolation = hasBudgetViolation(params.contextPack);
    const reasons: string[] = [];

    if (!directSupport) {
        reasons.push('missing_direct_support');
    }
    if (!documentAugmentation) {
        reasons.push('document_augmentation_missing');
    }
    const graphNeighborEvidenceMissing = Boolean(params.graphContext && (
        !graphEvidence || graphNeighborSourceUnavailable
    ) && (
        (params.graphContext.predecessorWindow?.length || 0) > 0
        || (params.graphContext.successorWindow?.length || 0) > 0
    ));
    if (graphNeighborEvidenceMissing) {
        reasons.push('graph_neighbor_evidence_missing');
    }
    if (conflictEvidence) {
        reasons.push('conflict_evidence_present');
    }
    if (budgetViolation) {
        reasons.push('context_budget_dropped_fragments');
    }

    if (!directSupport) {
        return {
            reviewedAt: String(params.reviewedAt || new Date().toISOString()),
            status: 'insufficient',
            score: 0.2,
            reasons,
            deterministic: true,
            recoveryAttempted: false,
            llmJudgeUsed: false,
            degradationState: 'insufficient_evidence',
        };
    }

    let score = 0.58;
    if (documentAugmentation) {
        score += 0.24;
    }
    if (graphEvidence) {
        score += 0.08;
    }
    if (!budgetViolation) {
        score += 0.06;
    }
    if (conflictEvidence) {
        score -= 0.18;
    }
    score = clampUnit(score);
    const status: RagSufficiencyReview['status'] = score >= 0.75
        && documentAugmentation
        && !conflictEvidence
        && !graphNeighborEvidenceMissing
        ? 'sufficient'
        : 'borderline';
    return {
        reviewedAt: String(params.reviewedAt || new Date().toISOString()),
        status,
        score,
        reasons,
        deterministic: true,
        recoveryAttempted: false,
        llmJudgeUsed: false,
        degradationState: status === 'sufficient'
            ? 'none'
            : conflictEvidence
                ? 'conflict'
                : 'partial_coverage',
    };
}

function mergeLlmJudgeReview(
    deterministicReview: RagSufficiencyReview,
    judgeReview: Partial<RagSufficiencyReview> | null | undefined
): RagSufficiencyReview {
    if (!judgeReview) {
        return deterministicReview;
    }
    const nextStatus = judgeReview.status === 'sufficient'
        || judgeReview.status === 'borderline'
        || judgeReview.status === 'insufficient'
        ? judgeReview.status
        : deterministicReview.status;
    const nextScore = Number.isFinite(judgeReview.score)
        ? clampUnit(Number(judgeReview.score))
        : deterministicReview.score;
    const nextReasons = Array.isArray(judgeReview.reasons) && judgeReview.reasons.length > 0
        ? judgeReview.reasons.map((reason) => String(reason || '').trim()).filter(Boolean)
        : deterministicReview.reasons;
    return {
        ...deterministicReview,
        ...judgeReview,
        status: nextStatus,
        score: nextScore,
        reasons: nextReasons,
        deterministic: false,
        llmJudgeUsed: true,
    };
}

export async function reviewRagContextSufficiency(
    params: ReviewRagContextSufficiencyParams
): Promise<RagSufficiencyReview> {
    const deterministicReview = buildDeterministicReview(params);
    if (
        deterministicReview.status !== 'borderline'
        || params.allowLlmJudge !== true
        || typeof params.llmJudge !== 'function'
    ) {
        return deterministicReview;
    }
    try {
        const judgeReview = await params.llmJudge({
            query: params.query,
            contextPack: params.contextPack,
            graphContext: params.graphContext,
        });
        return mergeLlmJudgeReview(deterministicReview, judgeReview);
    } catch (error) {
        return {
            ...deterministicReview,
            reasons: [
                ...deterministicReview.reasons,
                `llm_judge_failed:${String((error as Error)?.message || error || 'unknown')}`,
            ],
            llmJudgeUsed: false,
        };
    }
}
