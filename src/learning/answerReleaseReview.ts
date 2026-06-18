import type {
    AgentConversationGraphContext,
    AgentConversationKnowledgePoint,
    AnswerReleaseDecision,
    AnswerReleaseGate,
    AnswerReleaseGateId,
    AnswerReleaseReview,
    KnowledgeCitation,
    KnowledgeQueryResolvedScope,
} from './types';

export interface AnswerReleaseReviewContext {
    message: string;
    draftAnswer: string;
    knowledgePoints: AgentConversationKnowledgePoint[];
    citations: KnowledgeCitation[];
    usedScope: KnowledgeQueryResolvedScope;
    graphContext: AgentConversationGraphContext | null;
    reviewedAt?: string;
}

const INTERNAL_DIAGNOSTIC_FRAGMENTS = [
    'No scoped knowledge points matched',
    'retrieval_candidates_below_threshold',
    'missDiagnostics',
    'workspaceReadiness',
    'matchedAtomCount',
    'titleLikeQueries',
];

function normalizeWhitespace(value: string): string {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function containsCjk(value: string): boolean {
    return /[\u3400-\u9fff]/u.test(String(value || ''));
}

function resolveScopeLabel(scope: KnowledgeQueryResolvedScope): string {
    if (scope.workspaceId) {
        return String(scope.workspaceId).trim();
    }
    if (scope.corpusId) {
        return String(scope.corpusId).trim();
    }
    if (Array.isArray(scope.documentIds) && scope.documentIds[0]) {
        return String(scope.documentIds[0]).trim();
    }
    if (Array.isArray(scope.sourcePathPrefixes) && scope.sourcePathPrefixes[0]) {
        return String(scope.sourcePathPrefixes[0]).trim();
    }
    return '';
}

function buildFriendlyScopeFailureHint(
    scope: KnowledgeQueryResolvedScope
): string {
    const scopeLabel = resolveScopeLabel(scope);
    const readinessStatus = String(scope.readiness?.status || '').trim();
    const missReason = String(scope.missDiagnostics?.reason || '').trim();

    if (containsCjk(scopeLabel) || containsCjk(scope.missDiagnostics?.query || '')) {
        if (readinessStatus === 'empty_store') {
            return scopeLabel
                ? `当前范围“${scopeLabel}”还没有可检索知识。`
                : '当前范围还没有可检索知识。';
        }
        if (readinessStatus === 'workspace_not_found') {
            return scopeLabel
                ? `当前范围“${scopeLabel}”还不存在。`
                : '当前范围还不存在。';
        }
        if (readinessStatus === 'workspace_unbound') {
            return scopeLabel
                ? `当前范围“${scopeLabel}”还没有绑定知识语料。`
                : '当前范围还没有绑定知识语料。';
        }
        if (missReason === 'scope_has_no_indexed_segments') {
            return scopeLabel
                ? `当前范围“${scopeLabel}”里还没有建立可检索索引。`
                : '当前范围里还没有建立可检索索引。';
        }
        if (missReason === 'query_no_title_or_alias_hit') {
            return scopeLabel
                ? `当前范围“${scopeLabel}”里没有找到足够接近这个问题的标题或别名。`
                : '当前范围里没有找到足够接近这个问题的标题或别名。';
        }
        return scopeLabel
            ? `我还不能在当前范围“${scopeLabel}”内把这个回答落到证据上。`
            : '我还不能把这个回答落到证据上。';
    }

    if (readinessStatus === 'empty_store') {
        return scopeLabel
            ? `The current scope "${scopeLabel}" does not contain indexed knowledge yet.`
            : 'The current scope does not contain indexed knowledge yet.';
    }
    if (readinessStatus === 'workspace_not_found') {
        return scopeLabel
            ? `The current scope "${scopeLabel}" does not exist yet.`
            : 'The current scope does not exist yet.';
    }
    if (readinessStatus === 'workspace_unbound') {
        return scopeLabel
            ? `The current scope "${scopeLabel}" is not bound to a knowledge corpus yet.`
            : 'The current scope is not bound to a knowledge corpus yet.';
    }
    if (missReason === 'scope_has_no_indexed_segments') {
        return scopeLabel
            ? `The current scope "${scopeLabel}" has no indexed notes yet.`
            : 'The current scope has no indexed notes yet.';
    }
    if (missReason === 'query_no_title_or_alias_hit') {
        return scopeLabel
            ? `The current scope "${scopeLabel}" has no title or alias close enough to this query.`
            : 'The current scope has no title or alias close enough to this query.';
    }
    return scopeLabel
        ? `I could not ground the answer inside the current scope "${scopeLabel}".`
        : 'I could not ground the answer inside the current scope.';
}

function buildAbstentionAnswer(
    message: string,
    scope: KnowledgeQueryResolvedScope
): string {
    const normalizedMessage = normalizeWhitespace(message);
    const hint = buildFriendlyScopeFailureHint(scope);
    if (containsCjk(normalizedMessage)) {
        return normalizeWhitespace(
            normalizedMessage
                ? `${hint} 我暂时不能对“${normalizedMessage}”给出有依据的回答。请换个说法、放宽范围，或补充相关笔记。`
                : `${hint} 请换个说法、放宽范围，或补充相关笔记。`
        );
    }
    return normalizeWhitespace(
        normalizedMessage
            ? `${hint} I cannot give a grounded answer to "${normalizedMessage}" yet. Refine the wording, widen the scope, or add the missing note.`
            : `${hint} Refine the wording, widen the scope, or add the missing note.`
    );
}

function buildGroundedRevisionAnswer(
    context: AnswerReleaseReviewContext
): string {
    const leadingPoint = context.knowledgePoints[0];
    const summary = normalizeWhitespace(String(
        leadingPoint?.evidenceSnippet
        || leadingPoint?.summary
        || ''
    ));
    const title = normalizeWhitespace(String(leadingPoint?.title || ''));
    if (summary && title && !summary.toLowerCase().startsWith(title.toLowerCase())) {
        return `${title}: ${summary}`;
    }
    return summary || title || normalizeWhitespace(context.draftAnswer);
}

function collectLeakedInternalFragments(answer: string): string[] {
    const normalizedAnswer = String(answer || '');
    return INTERNAL_DIAGNOSTIC_FRAGMENTS.filter((fragment) => normalizedAnswer.includes(fragment));
}

function collectLexicalFeatures(value: string): string[] {
    const normalized = String(value || '').toLowerCase();
    const features = new Set<string>();
    const asciiTokens = normalized.match(/[a-z0-9]+/g) || [];
    asciiTokens.forEach((token) => {
        if (token.length >= 2) {
            features.add(token);
        }
    });
    const cjkRuns = normalized.match(/[\u3400-\u9fff]+/gu) || [];
    cjkRuns.forEach((run) => {
        const trimmed = String(run || '').trim();
        if (!trimmed) {
            return;
        }
        if (trimmed.length <= 2) {
            features.add(trimmed);
            return;
        }
        for (let index = 0; index < trimmed.length - 1; index += 1) {
            features.add(trimmed.slice(index, index + 2));
        }
    });
    return [...features];
}

function computeGroundingAlignmentScore(answer: string, supportText: string): number {
    const normalizedAnswer = normalizeWhitespace(answer).toLowerCase();
    const normalizedSupport = normalizeWhitespace(supportText).toLowerCase();
    if (!normalizedAnswer || !normalizedSupport) {
        return 0;
    }
    if (normalizedSupport.includes(normalizedAnswer) || normalizedAnswer.includes(normalizedSupport)) {
        return 1;
    }
    const answerFeatures = collectLexicalFeatures(normalizedAnswer);
    const supportFeatures = new Set(collectLexicalFeatures(normalizedSupport));
    if (answerFeatures.length <= 0 || supportFeatures.size <= 0) {
        return 0;
    }
    const overlapCount = answerFeatures.filter((feature) => supportFeatures.has(feature)).length;
    return Number((overlapCount / answerFeatures.length).toFixed(4));
}

function evaluateGroundingAlignment(context: AnswerReleaseReviewContext): {
    passed: boolean;
    bestScore: number;
    bestLabel: string;
} {
    const candidates: Array<{ label: string; text: string }> = [];
    context.citations.forEach((citation, index) => {
        const title = normalizeWhitespace(String(citation.title || '').trim()) || `citation_${index + 1}`;
        const snippet = normalizeWhitespace(String(citation.snippet || '').trim());
        const text = [title, snippet].filter(Boolean).join(' ');
        if (text) {
            candidates.push({
                label: title,
                text,
            });
        }
    });
    context.knowledgePoints.forEach((point, index) => {
        const title = normalizeWhitespace(String(point.title || '').trim()) || `knowledge_point_${index + 1}`;
        const snippet = normalizeWhitespace(String(point.evidenceSnippet || point.summary || '').trim());
        const text = [title, snippet].filter(Boolean).join(' ');
        if (text) {
            candidates.push({
                label: title,
                text,
            });
        }
    });
    if (candidates.length <= 0) {
        return {
            passed: false,
            bestScore: 0,
            bestLabel: '',
        };
    }
    const scored = candidates
        .map((candidate) => ({
            label: candidate.label,
            score: computeGroundingAlignmentScore(context.draftAnswer, candidate.text),
        }))
        .sort((left, right) => right.score - left.score);
    const best = scored[0] || { label: '', score: 0 };
    return {
        passed: best.score >= 0.3,
        bestScore: best.score,
        bestLabel: best.label,
    };
}

function checkPublicSurfaceContraction(answer: string): boolean {
    const normalizedAnswer = String(answer || '');
    if (normalizeWhitespace(normalizedAnswer).length > 320) {
        return false;
    }
    return !(
        /\bGrounded by\b/i.test(normalizedAnswer)
        || /\bKey evidence\b/i.test(normalizedAnswer)
        || /\bCitations?:\b/i.test(normalizedAnswer)
        || /\n\s*[-*]\s+/u.test(normalizedAnswer)
    );
}

function buildDecision(
    groundedEvidenceAvailable: boolean,
    groundingAlignmentPassed: boolean,
    leakedInternalFragments: string[],
    publicSurfaceContracted: boolean
): AnswerReleaseDecision {
    if (!groundedEvidenceAvailable) {
        return 'abstain';
    }
    if (!groundingAlignmentPassed || leakedInternalFragments.length > 0 || !publicSurfaceContracted) {
        return 'revise';
    }
    return 'release';
}

function buildReason(
    decision: AnswerReleaseDecision,
    groundedEvidenceAvailable: boolean
): string {
    if (decision === 'release') {
        return 'Draft answer satisfied the public-release gates.';
    }
    if (decision === 'revise') {
        return 'Draft answer had usable evidence but required contraction before public release.';
    }
    return groundedEvidenceAvailable
        ? 'Draft answer was downgraded even though some evidence existed.'
        : 'Draft answer lacked grounded evidence, so the public answer was downgraded to a concise abstention.';
}

export function reviewAnswerRelease(context: AnswerReleaseReviewContext): AnswerReleaseReview {
    const draftAnswer = normalizeWhitespace(context.draftAnswer);
    const groundedEvidenceAvailable = context.knowledgePoints.length > 0 || context.citations.length > 0;
    const leakedInternalFragments = collectLeakedInternalFragments(draftAnswer);
    const groundingAlignment = groundedEvidenceAvailable
        ? evaluateGroundingAlignment({
            ...context,
            draftAnswer,
        })
        : {
            passed: true,
            bestScore: 1,
            bestLabel: '',
        };
    const publicSurfaceContracted = checkPublicSurfaceContraction(draftAnswer);
    const graphSupportCount = context.graphContext
        ? (
            (Array.isArray(context.graphContext.relationSummaries) ? context.graphContext.relationSummaries.length : 0)
            + (Array.isArray(context.graphContext.connectionPaths) ? context.graphContext.connectionPaths.length : 0)
            + (Array.isArray(context.graphContext.supportingAtomIds) ? context.graphContext.supportingAtomIds.length : 0)
        )
        : 0;
    const graphSupportSufficient = context.knowledgePoints.length <= 0 || graphSupportCount > 0 || Boolean(context.graphContext?.anchorAtomId);
    const decision = buildDecision(
        groundedEvidenceAvailable,
        groundingAlignment.passed,
        leakedInternalFragments,
        publicSurfaceContracted
    );
    const publicAnswer = normalizeWhitespace(
        decision === 'abstain'
            ? buildAbstentionAnswer(context.message, context.usedScope)
            : decision === 'revise'
                ? buildGroundedRevisionAnswer(context)
                : draftAnswer
    );
    const abstentionHygienePassed = decision !== 'abstain'
        || (
            collectLeakedInternalFragments(publicAnswer).length <= 0
            && !/\bretrieval\b/i.test(publicAnswer)
            && !/\bplanner\b/i.test(publicAnswer)
        );
    const gates: AnswerReleaseGate[] = [
        {
            gateId: 'evidence_sufficiency',
            passed: groundedEvidenceAvailable,
            message: groundedEvidenceAvailable
                ? 'Grounded evidence was available for public release.'
                : 'No grounded evidence was available, so the answer must abstain.',
        },
        {
            gateId: 'graph_support_sufficiency',
            passed: graphSupportSufficient,
            message: graphSupportSufficient
                ? 'Graph context stayed sufficient for the current answer shape.'
                : 'Graph context was too thin for a confident grounded answer.',
        },
        {
            gateId: 'claim_grounding_alignment',
            passed: groundingAlignment.passed,
            message: groundedEvidenceAvailable
                ? (
                    groundingAlignment.passed
                        ? `Draft answer stayed aligned with grounded support (best support: ${groundingAlignment.bestLabel || 'primary evidence'}, score ${Math.round(groundingAlignment.bestScore * 100)}%).`
                        : `Draft answer drifted away from grounded support (best support: ${groundingAlignment.bestLabel || 'primary evidence'}, score ${Math.round(groundingAlignment.bestScore * 100)}%).`
                )
                : 'No evidence was available, so claim-grounding alignment was not evaluated.',
        },
        {
            gateId: 'public_surface_contraction',
            passed: publicSurfaceContracted,
            message: publicSurfaceContracted
                ? 'Draft answer stayed within the public-surface contraction budget.'
                : 'Draft answer carried too much support or formatting detail for the public answer surface.',
        },
        {
            gateId: 'internal_diagnostic_leakage',
            passed: leakedInternalFragments.length <= 0,
            message: leakedInternalFragments.length <= 0
                ? 'Draft answer did not leak internal diagnostics.'
                : `Draft answer leaked internal diagnostics: ${leakedInternalFragments.join(', ')}.`,
        },
        {
            gateId: 'abstention_hygiene',
            passed: abstentionHygienePassed,
            message: abstentionHygienePassed
                ? 'Abstention path remained concise and user-facing.'
                : 'Abstention path still leaked implementation detail after correction.',
        },
    ];
    const failedGateIds = gates
        .filter((gate) => gate.passed === false)
        .map((gate) => gate.gateId);

    return {
        reviewedAt: String(context.reviewedAt || new Date().toISOString()).trim(),
        decision,
        revised: publicAnswer !== draftAnswer,
        originalAnswer: draftAnswer,
        publicAnswer,
        reason: buildReason(decision, groundedEvidenceAvailable),
        failedGateIds,
        leakedInternalFragments,
        gates,
    };
}
