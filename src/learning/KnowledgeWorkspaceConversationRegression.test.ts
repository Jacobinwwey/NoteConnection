import * as fs from 'fs';
import * as path from 'path';
import { KnowledgeLearningPlatform } from './KnowledgeLearningPlatform';
import {
    KNOWLEDGE_WORKSPACE_CONVERSATION_REGRESSION_CASES,
    type KnowledgeWorkspaceConversationRegressionCase,
} from './KnowledgeWorkspaceConversationRegression';
import { createKnowledgeGraphStore } from './store';
import type { RagEvidenceRole, RagFailureStage, RagSourceDecision } from './types';

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
            documentId: 'doc_conflicting_adjacent_evidence_probe',
            sourcePath: 'Knowledge_Base/ragconflict/calibration tolerance conflict probe.md',
            language: 'en',
            workspaceId: 'ragconflict',
            corpusId: 'ragconflict',
            content: [
                '# The Calibration Tolerance Conflict Probe',
                'Calibration tolerance conflict probe validates that adjacent contradictory source facts are not flattened into a stable value.',
                '',
                '## Tolerance Statements',
                'The calibration tolerance is +/-0.10 mm in the nominal bench procedure.',
                'The calibration tolerance is +/-0.50 mm in the field override note.',
                'Operators must resolve the active procedure before publishing a tolerance value.',
            ].join('\n'),
        },
        {
            documentId: 'doc_conflicting_nonadjacent_evidence_probe',
            sourcePath: 'Knowledge_Base/ragconflict/remote calibration tolerance conflict probe.md',
            language: 'en',
            workspaceId: 'ragconflict',
            corpusId: 'ragconflict',
            content: [
                '# Remote Calibration Tolerance Conflict Probe',
                'Remote calibration tolerance conflict probe validates that non-adjacent contradictory source facts inside one section are not flattened into a stable value.',
                '',
                '## Tolerance Statements',
                'The calibration tolerance is +/-0.10 mm in the nominal bench procedure.',
                '',
                'Context paragraph one keeps the source section long enough to exceed the local window.',
                '',
                'Context paragraph two keeps the source section long enough to exceed the local window.',
                '',
                'Context paragraph three keeps the source section long enough to exceed the local window.',
                '',
                'Context paragraph four keeps the source section long enough to exceed the local window.',
                '',
                'Context paragraph five keeps the source section long enough to exceed the local window.',
                '',
                'Context paragraph six keeps the source section long enough to exceed the local window.',
                '',
                'Context paragraph seven keeps the source section long enough to exceed the local window.',
                '',
                'The calibration tolerance is +/-0.50 mm in the field override note.',
                'Operators must resolve the active procedure before publishing a tolerance value.',
            ].join('\n'),
        },
        {
            documentId: 'doc_conflicting_release_date_probe',
            sourcePath: 'Knowledge_Base/ragdateconflict/release date conflict probe.md',
            language: 'en',
            workspaceId: 'ragdateconflict',
            corpusId: 'ragdateconflict',
            content: [
                '# Release Date Conflict Probe',
                'Release date conflict probe validates that date contradictions inside one section are not flattened into a stable schedule.',
                '',
                '## Release Schedule',
                'The migration release date is 2026-07-01.',
                '',
                'Context paragraph one keeps the release schedule section beyond the local window.',
                '',
                'Context paragraph two keeps the release schedule section beyond the local window.',
                '',
                'Context paragraph three keeps the release schedule section beyond the local window.',
                '',
                'Context paragraph four keeps the release schedule section beyond the local window.',
                '',
                'Context paragraph five keeps the release schedule section beyond the local window.',
                '',
                'Context paragraph six keeps the release schedule section beyond the local window.',
                '',
                'The migration release date is 2026-08-15.',
                'Operators must resolve the active release record before publishing the schedule.',
            ].join('\n'),
        },
        {
            documentId: 'doc_conflicting_state_status_probe',
            sourcePath: 'Knowledge_Base/ragstateconflict/state status conflict probe.md',
            language: 'en',
            workspaceId: 'ragstateconflict',
            corpusId: 'ragstateconflict',
            content: [
                '# State Status Conflict Probe',
                'State status conflict probe validates that categorical state contradictions are not flattened into one stable status.',
                '',
                '## Gate Status',
                'The migration gate status is enabled in the release checklist.',
                '',
                'Context paragraph keeps the categorical state conflict inside one scoped section.',
                '',
                'The migration gate status is disabled in the rollback appendix.',
                'Operators must resolve which status record is active before release.',
            ].join('\n'),
        },
        {
            documentId: 'doc_multi_document_calibration_tolerance_conflict_probe',
            sourcePath: 'Knowledge_Base/ragmulticonflict/multi document calibration tolerance conflict probe.md',
            language: 'en',
            workspaceId: 'ragmulticonflict',
            corpusId: 'ragmulticonflict',
            content: [
                '# Multi Document Calibration Tolerance Conflict Probe',
                'Multi document calibration tolerance conflict probe validates that contradictory scoped facts across documents are not flattened into one stable value.',
                '',
                '## Nominal Source',
                'The calibration tolerance is +/-0.10 mm in the nominal record.',
                'Operators must compare this source against field evidence before publishing a tolerance value.',
            ].join('\n'),
        },
        {
            documentId: 'doc_field_calibration_tolerance_conflict_evidence',
            sourcePath: 'Knowledge_Base/ragmulticonflict/field calibration tolerance conflict evidence.md',
            language: 'en',
            workspaceId: 'ragmulticonflict',
            corpusId: 'ragmulticonflict',
            content: [
                '# Field Calibration Tolerance Conflict Evidence',
                'Multi document calibration tolerance conflict probe field evidence records the field-side tolerance statement.',
                '',
                '## Field Source',
                'The calibration tolerance is +/-0.50 mm in the field record.',
                'Operators must resolve the active source before publishing a stable calibration tolerance.',
            ].join('\n'),
        },
        {
            documentId: 'doc_nominal_full_scan_source',
            sourcePath: 'Knowledge_Base/ragfullscan/nominal full scan source.md',
            language: 'en',
            workspaceId: 'ragfullscan',
            corpusId: 'ragfullscan',
            content: [
                '# Nominal Full Scan Source',
                'Nominal full scan source is the scoped document anchor for full-document augmentation.',
                '',
                'This opening section is intentionally separate from the remote tolerance statement.',
                '',
                'Local filler paragraph one keeps the remote appendix away from the matched opening span.',
                '',
                'Local filler paragraph two keeps the remote appendix away from the matched opening span.',
                '',
                'Local filler paragraph three keeps the remote appendix away from the matched opening span.',
                '',
                'Local filler paragraph four keeps the remote appendix away from the matched opening span.',
                '',
                'Local filler paragraph five keeps the remote appendix away from the matched opening span.',
                '',
                'Local filler paragraph six keeps the remote appendix away from the matched opening span.',
                '',
                '## Remote Nominal Appendix',
                'The calibration tolerance is +/-0.10 mm in the remote nominal appendix.',
            ].join('\n'),
        },
        {
            documentId: 'doc_field_full_scan_source',
            sourcePath: 'Knowledge_Base/ragfullscan/field full scan source.md',
            language: 'en',
            workspaceId: 'ragfullscan',
            corpusId: 'ragfullscan',
            content: [
                '# Field Full Scan Source',
                'Field full scan source is the scoped comparison document for full-document augmentation.',
                '',
                'This opening section is intentionally separate from the remote tolerance statement.',
                '',
                'Local filler paragraph one keeps the remote appendix away from the matched opening span.',
                '',
                'Local filler paragraph two keeps the remote appendix away from the matched opening span.',
                '',
                'Local filler paragraph three keeps the remote appendix away from the matched opening span.',
                '',
                'Local filler paragraph four keeps the remote appendix away from the matched opening span.',
                '',
                'Local filler paragraph five keeps the remote appendix away from the matched opening span.',
                '',
                'Local filler paragraph six keeps the remote appendix away from the matched opening span.',
                '',
                '## Remote Field Appendix',
                'The calibration tolerance is +/-0.50 mm in the remote field appendix.',
            ].join('\n'),
        },
        {
            documentId: 'doc_repeated_snippet_target_probe',
            sourcePath: 'Knowledge_Base/ragrepeatedspan/repeated snippet target section.md',
            language: 'en',
            workspaceId: 'ragrepeatedspan',
            corpusId: 'ragrepeatedspan',
            content: [
                '# Repeated Snippet Target Section',
                'Repeated snippet target probe validates source anchoring when the same clause appears in multiple sections.',
                '',
                '## Repeated Snippet Distractor Section',
                'The repeated snippet uses shared repeated wording.',
                'Distractor section context belongs to the first occurrence and must not guide the target answer.',
                '',
                '## Repeated Snippet Target Section',
                'The repeated snippet uses shared repeated wording.',
                'Target section context says the second occurrence controls the answer.',
            ].join('\n'),
        },
        {
            documentId: 'doc_graphintent_brittle_glass_vessel',
            sourcePath: 'Knowledge_Base/graphintent/brittle glass vessel.md',
            language: 'en',
            workspaceId: 'graphintent',
            corpusId: 'graphintent',
            content: [
                '# Brittle Glass Vessel',
                'Brittle glass vessel water container material wall stiffness clarity fracture comparison impact tolerance.',
            ].join('\n'),
        },
        {
            documentId: 'doc_graphintent_procedural_calibration_sequence',
            sourcePath: 'Knowledge_Base/graphintent/procedural calibration sequence.md',
            language: 'en',
            workspaceId: 'graphintent',
            corpusId: 'graphintent',
            content: [
                '# Procedural Calibration Sequence',
                'Procedural calibration sequence brittle glass vessel water container material wall stiffness clarity fracture comparison impact tolerance rinse align fill record.',
            ].join('\n'),
        },
        {
            documentId: 'doc_graphintent_ductile_polymer_cup',
            sourcePath: 'Knowledge_Base/graphintent/ductile polymer cup analogy.md',
            language: 'en',
            workspaceId: 'graphintent',
            corpusId: 'graphintent',
            content: [
                '# Ductile Polymer Cup Analogy',
                'Ductile polymer cup water container material wall comparison impact tolerance flexible fracture resistance.',
            ].join('\n'),
        },
        {
            documentId: 'doc_graphintent_reusable_polymer_vessel',
            sourcePath: 'Knowledge_Base/graphintent/reusable polymer vessel analogy.md',
            language: 'en',
            workspaceId: 'graphintent',
            corpusId: 'graphintent',
            content: [
                '# Reusable Polymer Vessel Analogy',
                'Reusable polymer vessel water container material wall comparison impact tolerance flexible ductility stiffness tradeoff.',
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

function countFullDocumentRagFragmentsByRole(
    response: Awaited<ReturnType<KnowledgeLearningPlatform['agentConversation']>>
): Partial<Record<RagEvidenceRole, number>> {
    return (response.trace.ragContextPack?.fragments || []).reduce<Partial<Record<RagEvidenceRole, number>>>(
        (counts, fragment) => {
            if (fragment.sourceBoundary !== 'full_document') {
                return counts;
            }
            counts[fragment.role] = (counts[fragment.role] || 0) + 1;
            return counts;
        },
        {}
    );
}

function collectRagFailureStages(
    response: Awaited<ReturnType<KnowledgeLearningPlatform['agentConversation']>>
): RagFailureStage[] {
    return (response.trace.ragFailureClassifications || [])
        .map((classification) => classification.stage)
        .filter((stage): stage is RagFailureStage => Boolean(stage));
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

function graphSuccessorWindow(response: Awaited<ReturnType<KnowledgeLearningPlatform['agentConversation']>>) {
    const graphContext = response.trace.graphContext as any;
    return Array.isArray(graphContext?.successorWindow) ? graphContext.successorWindow : [];
}

function graphSuccessorTitles(response: Awaited<ReturnType<KnowledgeLearningPlatform['agentConversation']>>): string[] {
    return graphSuccessorWindow(response)
        .map((node: any) => String(node?.title || '').trim())
        .filter(Boolean);
}

function graphSuccessorRelationKinds(response: Awaited<ReturnType<KnowledgeLearningPlatform['agentConversation']>>): string[] {
    return graphSuccessorWindow(response)
        .map((node: any) => String(node?.relationKind || '').trim())
        .filter(Boolean);
}

function graphNeighborFragmentTitles(response: Awaited<ReturnType<KnowledgeLearningPlatform['agentConversation']>>): string[] {
    return (response.trace.ragContextPack?.fragments || [])
        .filter((fragment) => fragment.role === 'graph_neighbor_support')
        .map((fragment) => String(fragment.title || '').trim())
        .filter(Boolean);
}

function graphDiagnostics(response: Awaited<ReturnType<KnowledgeLearningPlatform['agentConversation']>>) {
    const graphContext = response.trace.graphContext as any;
    return graphContext?.diagnostics && typeof graphContext.diagnostics === 'object'
        ? graphContext.diagnostics
        : {};
}

function caseNeedsGraphOpsStore(caseEntry: KnowledgeWorkspaceConversationRegressionCase): boolean {
    const expected = caseEntry.expected;
    return Boolean(
        expected.requiredFirstGraphSuccessorTitle
        || (expected.requiredGraphSuccessorTitles && expected.requiredGraphSuccessorTitles.length > 0)
        || (expected.forbiddenGraphSuccessorTitles && expected.forbiddenGraphSuccessorTitles.length > 0)
        || (expected.requiredGraphSuccessorRelationKinds && expected.requiredGraphSuccessorRelationKinds.length > 0)
        || typeof expected.minimumGraphIntentAlignedPredecessorCandidates === 'number'
        || typeof expected.minimumGraphIntentAlignedSuccessorCandidates === 'number'
        || typeof expected.minimumGraphIntentMisalignedPredecessorCandidates === 'number'
        || typeof expected.minimumGraphIntentMisalignedSuccessorCandidates === 'number'
        || typeof expected.expectedGraphUsedMisalignedPredecessorFallback === 'boolean'
        || typeof expected.expectedGraphUsedMisalignedSuccessorFallback === 'boolean'
    );
}

function createRegressionPlatform(caseEntry: KnowledgeWorkspaceConversationRegressionCase): {
    platform: KnowledgeLearningPlatform;
    cleanup: () => void;
} {
    if (!caseNeedsGraphOpsStore(caseEntry)) {
        return {
            platform: new KnowledgeLearningPlatform(() => new Date('2026-06-18T00:00:00.000Z')),
            cleanup: () => {},
        };
    }
    const tempDir = fs.mkdtempSync(path.join(process.cwd(), 'tmp-knowledge-conversation-regression-'));
    const store = createKnowledgeGraphStore({
        backend: 'file',
        filePath: path.join(tempDir, 'knowledge_graph.snapshot.json'),
    });
    return {
        platform: new KnowledgeLearningPlatform({
            nowProvider: () => new Date('2026-06-18T00:00:00.000Z'),
            store,
            autoPersist: true,
        }),
        cleanup: () => {
            fs.rmSync(tempDir, { recursive: true, force: true });
        },
    };
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

    test('registers a compare-intent graph neighbor selection probe', () => {
        expect(KNOWLEDGE_WORKSPACE_CONVERSATION_REGRESSION_CASES).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'graphintent_compare_neighbor_selection_en',
                    expected: expect.objectContaining({
                        requiredGraphSuccessorTitles: [
                            'Ductile Polymer Cup Analogy',
                            'Reusable Polymer Vessel Analogy',
                        ],
                        minimumRagFullDocumentFragmentCounts: {
                            graph_neighbor_support: 1,
                        },
                        forbiddenGraphSuccessorTitles: ['Procedural Calibration Sequence'],
                        requiredGraphSuccessorRelationKinds: ['analogy'],
                        forbiddenGraphNeighborFragmentTitles: ['Procedural Calibration Sequence'],
                        minimumGraphIntentAlignedSuccessorCandidates: 2,
                        minimumGraphIntentMisalignedSuccessorCandidates: 1,
                        expectedGraphUsedMisalignedSuccessorFallback: false,
                    }),
                }),
            ])
        );
    });

    test('registers a runtime graph-neighbor source-missing hard-negative probe', () => {
        expect(KNOWLEDGE_WORKSPACE_CONVERSATION_REGRESSION_CASES).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'graphintent_missing_neighbor_source_window_en',
                    runtimeUnavailableSourcePaths: expect.arrayContaining([
                        'Knowledge_Base/graphintent/ductile polymer cup analogy.md',
                        'Knowledge_Base/graphintent/reusable polymer vessel analogy.md',
                    ]),
                    expected: expect.objectContaining({
                        runtimeAcceptedRagSufficiencyStatuses: ['borderline'],
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
                        expectedRagRecoveryAttempted: true,
                        inMemoryExpectedRagRecoveryAttempted: false,
                        minimumGraphIntentAlignedSuccessorCandidates: 2,
                        minimumGraphIntentMisalignedSuccessorCandidates: 1,
                        expectedGraphUsedMisalignedSuccessorFallback: false,
                    }),
                }),
            ])
        );
    });

    test('registers a runtime multi-neighbor source-loss probe', () => {
        expect(KNOWLEDGE_WORKSPACE_CONVERSATION_REGRESSION_CASES).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'graphintent_multi_neighbor_source_loss_en',
                    runtimeUnavailableSourcePaths: expect.arrayContaining([
                        'Knowledge_Base/graphintent/ductile polymer cup analogy.md',
                        'Knowledge_Base/graphintent/reusable polymer vessel analogy.md',
                    ]),
                    expected: expect.objectContaining({
                        runtimeAcceptedRagSufficiencyStatuses: ['borderline'],
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
                        expectedRagRecoveryAttempted: true,
                        inMemoryExpectedRagRecoveryAttempted: false,
                        requiredGraphSuccessorTitles: [
                            'Ductile Polymer Cup Analogy',
                            'Reusable Polymer Vessel Analogy',
                        ],
                        requiredGraphSuccessorRelationKinds: ['analogy'],
                    }),
                }),
            ])
        );
    });

    test('registers waterglass RAG claim-gate and preamble-leak runtime acceptance', () => {
        const expectedWaterglassReleaseAcceptance = expect.objectContaining({
            runtimeAnswerReleaseDecision: 'revise',
            runtimeRequiredFailedGateIds: expect.arrayContaining([
                'query_intent_alignment',
                'rag_claim_citation_support',
            ]),
            answerMustNotContain: expect.arrayContaining([
                '所有推理过程',
                '最终输出',
                '遵从您的指示',
            ]),
        });

        expect(KNOWLEDGE_WORKSPACE_CONVERSATION_REGRESSION_CASES).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'waterglass_explicit_scope_compact_zh',
                    expected: expectedWaterglassReleaseAcceptance,
                }),
                expect.objectContaining({
                    id: 'waterglass_explicit_scope_spaced_zh',
                    expected: expectedWaterglassReleaseAcceptance,
                }),
            ])
        );
    });

    test('registers conflicting evidence hard-negative probes', () => {
        expect(KNOWLEDGE_WORKSPACE_CONVERSATION_REGRESSION_CASES).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'conflicting_adjacent_evidence_probe_en',
                    expected: expect.objectContaining({
                        requiredRagRoles: expect.arrayContaining(['direct_support', 'parent_context', 'conflict']),
                        acceptedRagSufficiencyStatuses: ['borderline'],
                        acceptedRagDegradationStates: ['conflict'],
                        requiredRagFailureStages: ['context_assembly'],
                        answerMustNotContain: expect.arrayContaining([
                            'single stable calibration tolerance',
                        ]),
                    }),
                }),
                expect.objectContaining({
                    id: 'conflicting_nonadjacent_section_evidence_probe_en',
                    expected: expect.objectContaining({
                        requiredRagRoles: expect.arrayContaining(['direct_support', 'parent_context', 'conflict']),
                        acceptedRagSufficiencyStatuses: ['borderline'],
                        acceptedRagDegradationStates: ['conflict'],
                        requiredRagFailureStages: ['context_assembly'],
                        answerMustNotContain: expect.arrayContaining([
                            'single stable calibration tolerance',
                        ]),
                    }),
                }),
                expect.objectContaining({
                    id: 'conflicting_release_date_evidence_probe_en',
                    expected: expect.objectContaining({
                        requiredRagRoles: expect.arrayContaining(['direct_support', 'parent_context', 'conflict']),
                        acceptedRagSufficiencyStatuses: ['borderline'],
                        acceptedRagDegradationStates: ['conflict'],
                        requiredRagFailureStages: ['context_assembly'],
                        answerMustNotContain: expect.arrayContaining([
                            'stable migration release date',
                        ]),
                    }),
                }),
                expect.objectContaining({
                    id: 'conflicting_state_status_evidence_probe_en',
                    expected: expect.objectContaining({
                        requiredRagRoles: expect.arrayContaining(['direct_support', 'parent_context', 'conflict']),
                        acceptedRagSufficiencyStatuses: ['borderline'],
                        acceptedRagDegradationStates: ['conflict'],
                        requiredRagFailureStages: ['context_assembly'],
                        answerMustContain: expect.arrayContaining(['enabled', 'disabled']),
                        answerMustNotContain: expect.arrayContaining([
                            'stable migration gate status',
                        ]),
                    }),
                }),
                expect.objectContaining({
                    id: 'conflicting_multi_document_evidence_probe_en',
                    expected: expect.objectContaining({
                        minCitations: 2,
                        requiredRagRoles: expect.arrayContaining(['direct_support', 'parent_context', 'conflict']),
                        acceptedRagSufficiencyStatuses: ['borderline'],
                        acceptedRagDegradationStates: ['conflict'],
                        requiredRagFailureStages: ['context_assembly'],
                        answerMustContain: expect.arrayContaining(['+/-0.10 mm', '+/-0.50 mm']),
                        answerMustNotContain: expect.arrayContaining([
                            'single stable calibration tolerance',
                        ]),
                    }),
                }),
                expect.objectContaining({
                    id: 'full_document_scan_remote_conflict_probe_en',
                    expected: expect.objectContaining({
                        minCitations: 2,
                        requiredRagRoles: expect.arrayContaining(['direct_support', 'parent_context', 'conflict']),
                        acceptedRagSufficiencyStatuses: ['borderline'],
                        acceptedRagDegradationStates: ['conflict'],
                        requiredRagFailureStages: ['context_assembly'],
                        answerMustContain: expect.arrayContaining(['+/-0.10 mm', '+/-0.50 mm']),
                        answerMustNotContain: expect.arrayContaining([
                            'single stable calibration tolerance',
                        ]),
                    }),
                }),
                expect.objectContaining({
                    id: 'repeated_snippet_target_section_probe_en',
                    expected: expect.objectContaining({
                        minCitations: 1,
                        requiredRagRoles: expect.arrayContaining(['direct_support', 'parent_context']),
                        acceptedRagSufficiencyStatuses: expect.arrayContaining(['sufficient', 'borderline']),
                        answerMustContain: expect.arrayContaining([
                            'Target section context says the second occurrence controls the answer',
                        ]),
                        answerMustNotContain: expect.arrayContaining([
                            'Distractor section context belongs to the first occurrence',
                        ]),
                    }),
                }),
            ])
        );
    });

    test.each(KNOWLEDGE_WORKSPACE_CONVERSATION_REGRESSION_CASES)(
        'conversation regression case: $id',
        async (caseEntry) => {
            const regressionPlatform = createRegressionPlatform(caseEntry);
            try {
                await regressionPlatform.platform.ingestKnowledge({
                    incremental: true,
                    documents: buildRegressionDocuments(),
                });

                const response = await regressionPlatform.platform.agentConversation(
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
            if (expected.minimumRagFullDocumentFragmentCounts) {
                const observedFullDocumentFragmentCounts = countFullDocumentRagFragmentsByRole(response);
                Object.entries(expected.minimumRagFullDocumentFragmentCounts).forEach(([role, minimumCount]) => {
                    expect(observedFullDocumentFragmentCounts[role as RagEvidenceRole] || 0)
                        .toBeGreaterThanOrEqual(minimumCount || 0);
                });
            }
            if (expected.acceptedRagSufficiencyStatuses && expected.acceptedRagSufficiencyStatuses.length > 0) {
                expect(expected.acceptedRagSufficiencyStatuses).toContain(response.trace.ragSufficiencyReview?.status);
            }
            if (expected.requiredRagFailureStages && expected.requiredRagFailureStages.length > 0) {
                expect(collectRagFailureStages(response)).toEqual(
                    expect.arrayContaining(expected.requiredRagFailureStages)
                );
            }
            if (expected.requiredFirstGraphSuccessorTitle) {
                expect(graphSuccessorTitles(response)[0]).toBe(expected.requiredFirstGraphSuccessorTitle);
            }
            if (expected.requiredGraphSuccessorTitles && expected.requiredGraphSuccessorTitles.length > 0) {
                expect(graphSuccessorTitles(response)).toEqual(
                    expect.arrayContaining(expected.requiredGraphSuccessorTitles)
                );
            }
            if (expected.forbiddenGraphSuccessorTitles && expected.forbiddenGraphSuccessorTitles.length > 0) {
                expected.forbiddenGraphSuccessorTitles.forEach((title) => {
                    expect(graphSuccessorTitles(response)).not.toContain(title);
                });
            }
            if (expected.requiredGraphSuccessorRelationKinds && expected.requiredGraphSuccessorRelationKinds.length > 0) {
                expect(graphSuccessorRelationKinds(response)).toEqual(
                    expect.arrayContaining(expected.requiredGraphSuccessorRelationKinds)
                );
            }
            if (expected.forbiddenGraphNeighborFragmentTitles && expected.forbiddenGraphNeighborFragmentTitles.length > 0) {
                expected.forbiddenGraphNeighborFragmentTitles.forEach((title) => {
                    expect(graphNeighborFragmentTitles(response)).not.toContain(title);
                });
            }
            const diagnostics = graphDiagnostics(response);
            if (typeof expected.minimumGraphIntentAlignedPredecessorCandidates === 'number') {
                expect(Number(diagnostics.intentAlignedPredecessorCandidateCount || 0))
                    .toBeGreaterThanOrEqual(expected.minimumGraphIntentAlignedPredecessorCandidates);
            }
            if (typeof expected.minimumGraphIntentAlignedSuccessorCandidates === 'number') {
                expect(Number(diagnostics.intentAlignedSuccessorCandidateCount || 0))
                    .toBeGreaterThanOrEqual(expected.minimumGraphIntentAlignedSuccessorCandidates);
            }
            if (typeof expected.minimumGraphIntentMisalignedPredecessorCandidates === 'number') {
                expect(Number(diagnostics.intentMisalignedPredecessorCandidateCount || 0))
                    .toBeGreaterThanOrEqual(expected.minimumGraphIntentMisalignedPredecessorCandidates);
            }
            if (typeof expected.minimumGraphIntentMisalignedSuccessorCandidates === 'number') {
                expect(Number(diagnostics.intentMisalignedSuccessorCandidateCount || 0))
                    .toBeGreaterThanOrEqual(expected.minimumGraphIntentMisalignedSuccessorCandidates);
            }
            if (typeof expected.expectedGraphUsedMisalignedPredecessorFallback === 'boolean') {
                expect(Boolean(diagnostics.usedIntentMisalignedPredecessorFallback))
                    .toBe(expected.expectedGraphUsedMisalignedPredecessorFallback);
            }
            if (typeof expected.expectedGraphUsedMisalignedSuccessorFallback === 'boolean') {
                expect(Boolean(diagnostics.usedIntentMisalignedSuccessorFallback))
                    .toBe(expected.expectedGraphUsedMisalignedSuccessorFallback);
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
            } finally {
                regressionPlatform.cleanup();
            }
        }
    );
});
