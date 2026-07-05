import { KnowledgeLearningPlatform } from './KnowledgeLearningPlatform';
import {
    KNOWLEDGE_WORKSPACE_CONVERSATION_REGRESSION_CASES,
    type KnowledgeWorkspaceConversationRegressionCase,
} from './KnowledgeWorkspaceConversationRegression';
import type { RagSourceDecision } from './types';

function deriveScopedConversationRequest(caseEntry: KnowledgeWorkspaceConversationRegressionCase) {
    const activeTarget = String(caseEntry.activeTarget || '').trim();
    return {
        userId: `regression_user_${caseEntry.id}`,
        sessionId: `regression_session_${caseEntry.id}`,
        message: caseEntry.query,
        persistMemory: false,
        topK: Number.isInteger(caseEntry.topK) && Number(caseEntry.topK) > 0
            ? Number(caseEntry.topK)
            : 8,
        scope: {
            workspaceId: activeTarget.toLowerCase(),
            corpusId: activeTarget.toLowerCase(),
            sourcePathPrefixes: [`Knowledge_Base/${activeTarget}`],
        },
    };
}

function buildContextBudgetProbeContent(): string {
    const longBudgetParagraph = [
        'Context budget probe evidence defines bounded context assembly as a RAG practice that reads the full source document for provenance and section routing, while only selected fragments enter the model-visible context pack.',
        'The source-reading boundary is intentionally wider than the answer prompt boundary, because source inspection may need headings, local paragraphs, terminal qualifiers, and graph-linked evidence before the pack budget chooses what the model can see.',
        'The context pack must record budget decisions such as fragment_included, fragment_truncated, and fragment_dropped so runtime probes can distinguish complete source access from unbounded prompt growth.',
        'A robust answer should use the direct hit, parent section context, and available graph-neighbor evidence, but it should not paste the entire source note into the user-facing response.',
    ].join(' ');
    return [
        '# Context Budget Probe',
        'Context budget probe is a runtime fixture for validating full-document source reading with a bounded model-visible RAG context pack.',
        '',
        '## Bounded Context Assembly',
        longBudgetParagraph.repeat(5),
        '',
        'Terminal qualifier: this fixture is scoped to budget verification and should not be treated as a general product explanation.',
    ].join('\n');
}

function buildOverflowBudgetProbeContent(): string {
    const sections = Array.from({ length: 18 }, (_entry, index) => {
        const segmentNumber = String(index + 1).padStart(2, '0');
        return [
            `## Overflow Budget Probe Segment ${segmentNumber}`,
            [
                `Overflow budget probe segment ${segmentNumber} records a distinct scoped evidence fragment for testing max-fragment pressure.`,
                'Overflow budget probe answers must remain deterministic when no LLM provider is configured.',
                'The RAG context pack should keep direct support first, then include only as much parent context as the budget allows.',
                `Segment ${segmentNumber} is intentionally concise so the probe stresses fragment count rather than per-fragment truncation.`,
            ].join(' '),
        ].join('\n');
    });
    return [
        '# Overflow Budget Probe',
        'Overflow budget probe validates deterministic no-provider RAG fallback under dense same-document evidence.',
        '',
        ...sections,
    ].join('\n\n');
}

function buildRegressionDocuments() {
    return [
        {
            documentId: 'doc_financial_liquidity',
            sourcePath: 'Knowledge_Base/financial/liquidity.md',
            language: 'en',
            workspaceId: 'financial',
            corpusId: 'financial',
            content: '# Liquidity\nLiquidity analysis explains cash conversion and working capital timing.',
        },
        {
            documentId: 'doc_financial_glass_steagall',
            sourcePath: 'Knowledge_Base/financial/glass steagall act.md',
            language: 'en',
            workspaceId: 'financial',
            corpusId: 'financial',
            content: '# Glass-Steagall Act\nThe Glass-Steagall Act separated commercial and investment banking activities.',
        },
        {
            documentId: 'doc_financial_watered_stock',
            sourcePath: 'Knowledge_Base/financial/watered stock.md',
            language: 'en',
            workspaceId: 'financial',
            corpusId: 'financial',
            content: '# Watered Stock\nWatered stock refers to shares issued at a value greater than the assets that back them.',
        },
        {
            documentId: 'doc_water_glass_runtime',
            sourcePath: 'Knowledge_Base/waterglass/water glass.md',
            language: 'zh',
            workspaceId: 'waterglass',
            corpusId: 'waterglass',
            content: [
                '# 水杯 (water glass)',
                '水杯 (water glass) 是一个用于盛水的透明容器。',
                '',
                '## Material role',
                'The water glass body provides a boundary between the liquid and the environment.',
                '',
                '## Container material comparison',
                'A water glass uses soda-lime glass, so it is transparent, stiff, brittle, and chemically inert.',
                'A plastic cup uses PET plastic, so it is lightweight, ductile, less stiff, and more insulating.',
                'Compared with a plastic cup, a water glass gives better optical transparency and rigidity, while the plastic cup reduces fracture risk.',
            ].join('\n'),
        },
        {
            documentId: 'doc_context_budget_probe',
            sourcePath: 'Knowledge_Base/contextbudget/context budget probe.md',
            language: 'en',
            workspaceId: 'contextbudget',
            corpusId: 'contextbudget',
            content: buildContextBudgetProbeContent(),
        },
        {
            documentId: 'doc_overflow_budget_probe',
            sourcePath: 'Knowledge_Base/contextoverflow/overflow budget probe.md',
            language: 'en',
            workspaceId: 'contextoverflow',
            corpusId: 'contextoverflow',
            content: buildOverflowBudgetProbeContent(),
        },
    ];
}

function countRagSourceDecisionStatuses(
    decisions: RagSourceDecision[] | undefined
): Record<string, number> {
    return (Array.isArray(decisions) ? decisions : []).reduce<Record<string, number>>((counts, decision) => {
        const status = String(decision?.status || '').trim();
        if (!status) {
            return counts;
        }
        counts[status] = (counts[status] || 0) + 1;
        return counts;
    }, {});
}

function expectReasonFragments(
    observedReasons: readonly string[] | undefined,
    requiredFragments: readonly string[] | undefined
): void {
    if (!requiredFragments || requiredFragments.length <= 0) {
        return;
    }
    const reasons = Array.isArray(observedReasons)
        ? observedReasons.map((reason) => String(reason || ''))
        : [];
    requiredFragments.forEach((fragment) => {
        expect(reasons.some((reason) => reason.includes(fragment))).toBe(true);
    });
}

describe('KnowledgeWorkspaceConversationRegression', () => {
    test('case ids stay unique', () => {
        const caseIds = KNOWLEDGE_WORKSPACE_CONVERSATION_REGRESSION_CASES.map((entry) => entry.id);
        expect(new Set(caseIds).size).toBe(caseIds.length);
    });

    test('registers a runtime provider timeout fallback case', () => {
        expect(KNOWLEDGE_WORKSPACE_CONVERSATION_REGRESSION_CASES).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'contextoverflow_timeout_provider_judge_fallback_en',
                    runtimeProviderFixture: 'timeout',
                    expected: expect.objectContaining({
                        expectedRagDeterministic: true,
                        expectedRagLlmJudgeUsed: false,
                        expectedRagRecoveryAttempted: true,
                        runtimeRequiredRagRecoveryBeforeReasonFragments: ['llm_judge_failed'],
                    }),
                }),
            ])
        );
    });

    test.each(KNOWLEDGE_WORKSPACE_CONVERSATION_REGRESSION_CASES)(
        'conversation regression case: $id',
        async (caseEntry) => {
            const platform = new KnowledgeLearningPlatform(() => new Date('2026-06-18T00:00:00.000Z'));
            await platform.ingestKnowledge({
                incremental: true,
                documents: buildRegressionDocuments(),
            });

            const response = await platform.agentConversation(
                deriveScopedConversationRequest(caseEntry)
            );
            const expected = caseEntry.expected;
            const minimumRagSourceDecisionStatusCounts = expected.inMemoryMinimumRagSourceDecisionStatusCounts
                || expected.minimumRagSourceDecisionStatusCounts;
            const expectedRagRecoveryAttempted = typeof expected.inMemoryExpectedRagRecoveryAttempted === 'boolean'
                ? expected.inMemoryExpectedRagRecoveryAttempted
                : expected.expectedRagRecoveryAttempted;
            const minimumRagRecoveryBeforeSourceDecisionStatusCounts = expected.inMemoryMinimumRagRecoveryBeforeSourceDecisionStatusCounts
                || expected.minimumRagRecoveryBeforeSourceDecisionStatusCounts;
            const citations = Array.isArray(response.citations) ? response.citations : [];
            const planner = response.trace.planner || {
                plannerQuery: null,
                titleLikeQueries: [],
                titleHitDocumentIds: [],
            };
            const retrieval = response.trace.retrieval || {
                retrievalModes: [],
            };
            const acceptedDecisions = Array.isArray(expected.acceptedAnswerReleaseDecisions)
                && expected.acceptedAnswerReleaseDecisions.length > 0
                ? expected.acceptedAnswerReleaseDecisions
                : (expected.answerReleaseDecision ? [expected.answerReleaseDecision] : []);

            expect(citations.length).toBeGreaterThanOrEqual(expected.minCitations);
            if (acceptedDecisions.length > 0) {
                expect(acceptedDecisions).toContain(response.answerReleaseReview?.decision);
            }
            expect(response.answerReleaseReview?.publicAnswer).toBe(response.answer);
            expect(response.trace.usedScope.scopeSource).toBe(expected.scopeSource);
            expect(response.knowledgePoints.length).toBeGreaterThan(0);
            expect(response.knowledgePoints[0]?.sourcePath).toBe(expected.primarySourcePath);
            expect(planner.titleLikeQueries).toEqual(
                expect.arrayContaining(expected.plannerTitleLikeQueries)
            );
            expect(planner.titleHitDocumentIds.length).toBeGreaterThan(0);
            expected.answerMustContain?.forEach((fragment) => {
                expect(response.answer).toContain(fragment);
            });
            expected.answerMustNotContain?.forEach((fragment) => {
                expect(response.answer).not.toContain(fragment);
            });
            if (expected.ragSourceBoundary) {
                expect(response.trace.ragContextPack).toEqual(expect.objectContaining({
                    sourceBoundary: expected.ragSourceBoundary,
                }));
            }
            if (expected.requiredRagRoles && expected.requiredRagRoles.length > 0) {
                const observedRagRoles = (response.trace.ragContextPack?.fragments || [])
                    .map((fragment) => fragment.role);
                expect(observedRagRoles).toEqual(expect.arrayContaining(expected.requiredRagRoles));
            }
            if (expected.acceptedRagSufficiencyStatuses && expected.acceptedRagSufficiencyStatuses.length > 0) {
                expect(expected.acceptedRagSufficiencyStatuses).toContain(response.trace.ragSufficiencyReview?.status);
            }
            if (typeof expected.expectedRagDeterministic === 'boolean') {
                expect(response.trace.ragSufficiencyReview?.deterministic).toBe(expected.expectedRagDeterministic);
            }
            if (typeof expected.expectedRagLlmJudgeUsed === 'boolean') {
                expect(response.trace.ragSufficiencyReview?.llmJudgeUsed).toBe(expected.expectedRagLlmJudgeUsed);
            }
            if (typeof expectedRagRecoveryAttempted === 'boolean') {
                expect(response.trace.ragSufficiencyReview?.recoveryAttempted).toBe(expectedRagRecoveryAttempted);
            }
            if (expected.acceptedRagDegradationStates && expected.acceptedRagDegradationStates.length > 0) {
                expect(expected.acceptedRagDegradationStates).toContain(response.trace.ragSufficiencyReview?.degradationState);
            }
            if (minimumRagSourceDecisionStatusCounts) {
                const observedDecisionCounts = countRagSourceDecisionStatuses(
                    response.trace.ragContextPack?.sourceDecisions
                );
                Object.entries(minimumRagSourceDecisionStatusCounts).forEach(([status, minimumCount]) => {
                    expect(observedDecisionCounts[status] || 0).toBeGreaterThanOrEqual(minimumCount || 0);
                });
            }
            if (minimumRagRecoveryBeforeSourceDecisionStatusCounts) {
                const observedRecoveryDecisionCounts = response.trace.ragRecovery?.beforeSourceDecisionStatusCounts || {};
                Object.entries(minimumRagRecoveryBeforeSourceDecisionStatusCounts).forEach(([status, minimumCount]) => {
                    expect(observedRecoveryDecisionCounts[status as keyof typeof observedRecoveryDecisionCounts] || 0)
                        .toBeGreaterThanOrEqual(minimumCount || 0);
                });
            }
            expectReasonFragments(
                response.trace.ragRecovery?.beforeReasons,
                expected.requiredRagRecoveryBeforeReasonFragments
            );
            if (expected.retrievalModes && expected.retrievalModes.length > 0) {
                expect(retrieval.retrievalModes).toEqual(
                    expect.arrayContaining(expected.retrievalModes)
                );
            }
            if (expected.recoveredSourcePaths && expected.recoveredSourcePaths.length > 0) {
                expect(retrieval.scopeRecovery?.recoveredSourcePaths || []).toEqual(
                    expect.arrayContaining(expected.recoveredSourcePaths)
                );
            }
        }
    );
});
