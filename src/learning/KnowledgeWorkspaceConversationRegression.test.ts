import { KnowledgeLearningPlatform } from './KnowledgeLearningPlatform';
import {
    KNOWLEDGE_WORKSPACE_CONVERSATION_REGRESSION_CASES,
    type KnowledgeWorkspaceConversationRegressionCase,
} from './KnowledgeWorkspaceConversationRegression';

function deriveScopedConversationRequest(caseEntry: KnowledgeWorkspaceConversationRegressionCase) {
    const activeTarget = String(caseEntry.activeTarget || '').trim();
    return {
        userId: `regression_user_${caseEntry.id}`,
        sessionId: `regression_session_${caseEntry.id}`,
        message: caseEntry.query,
        persistMemory: false,
        topK: 8,
        scope: {
            workspaceId: activeTarget.toLowerCase(),
            corpusId: activeTarget.toLowerCase(),
            sourcePathPrefixes: [`Knowledge_Base/${activeTarget}`],
        },
    };
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
            ].join('\n'),
        },
    ];
}

describe('KnowledgeWorkspaceConversationRegression', () => {
    test('case ids stay unique', () => {
        const caseIds = KNOWLEDGE_WORKSPACE_CONVERSATION_REGRESSION_CASES.map((entry) => entry.id);
        expect(new Set(caseIds).size).toBe(caseIds.length);
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
            expected.answerMustNotContain?.forEach((fragment) => {
                expect(response.answer).not.toContain(fragment);
            });
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
