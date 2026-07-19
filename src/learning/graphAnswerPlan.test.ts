import { buildGraphAnswerPlan } from './graphAnswerPlan';
import type {
    AgentConversationGraphContext,
    AgentConversationKnowledgePoint,
    RagContextPack,
} from './types';

const knowledgePoint: AgentConversationKnowledgePoint = {
    atomId: 'water_glass',
    atomIds: ['water_glass', 'material_boundary', 'thermal_exchange'],
    documentId: 'doc_water_glass',
    sourcePath: 'Knowledge_Base/waterglass/water-glass.md',
    title: 'Water Glass',
    summary: 'A water glass is a transparent drinking vessel.',
    evidenceSnippet: 'A water glass is a transparent drinking vessel.',
    score: 0.98,
    citation: null,
    citations: [],
    matchedSpans: [
        {
            atomId: 'water_glass',
            title: 'Water Glass',
            snippet: 'A water glass is a transparent drinking vessel used to contain water.',
            sourcePath: 'Knowledge_Base/waterglass/water-glass.md',
            score: 0.98,
            citation: null,
        },
        {
            atomId: 'material_boundary',
            title: 'Material Boundary',
            snippet: 'Its solid wall forms a material boundary between the liquid and the surrounding environment.',
            sourcePath: 'Knowledge_Base/waterglass/water-glass.md',
            score: 0.91,
            citation: null,
        },
        {
            atomId: 'thermal_exchange',
            title: 'Thermal Exchange',
            snippet: 'Heat moves through the glass wall, so the material and thickness affect thermal exchange.',
            sourcePath: 'Knowledge_Base/waterglass/water-glass.md',
            score: 0.9,
            citation: null,
        },
    ],
    matchCount: 3,
    relationPath: [],
    relationPathAtomIds: [],
    relationKinds: [],
    capabilities: [],
};

const graphContext: AgentConversationGraphContext = {
    anchorAtomId: 'water_glass',
    anchorTitle: 'Water Glass',
    anchorGraphProfile: { atomId: 'water_glass', title: 'Water Glass', inDegree: 2, outDegree: 3 },
    supportingAtomIds: ['container', 'heat_transfer'],
    supportingTitles: ['Container', 'Heat Transfer'],
    relationKinds: ['prerequisite', 'application'],
    relationSummaries: [],
    knowledgePointRelations: [{
        edgeId: 'edge_water_heat',
        relationKind: 'application',
        sourceAtomId: 'water_glass',
        sourceTitle: 'Water Glass',
        targetAtomId: 'heat_transfer',
        targetTitle: 'Heat Transfer',
        confidence: 0.88,
    }],
    predecessorWindow: [
        { atomId: 'container', title: 'Container', relationKind: 'prerequisite', confidence: 0.92 },
    ],
    successorWindow: [
        { atomId: 'heat_transfer', title: 'Heat Transfer', relationKind: 'application', confidence: 0.88 },
    ],
    temporalValidity: {
        checkedAt: '2026-07-11T00:00:00.000Z',
        allPointsValid: true,
        warningReasons: [],
        invalidKnowledgePointTitles: [],
    },
};

const ragContextPack: RagContextPack = {
    query: 'what is water glass',
    generatedAt: '2026-07-11T00:00:00.000Z',
    sourceBoundary: 'full_document',
    budget: { maxFragments: 20, maxCharsPerFragment: 1500, maxTotalChars: 7600 },
    fragments: [
        {
            fragmentId: 'neighbor_heat_transfer',
            role: 'graph_neighbor_support',
            text: 'Heat Transfer explains why the glass wall conducts heat between the drink and the environment.',
            atomId: 'heat_transfer',
            documentId: 'doc_heat_transfer',
            sourcePath: 'Knowledge_Base/physics/heat-transfer.md',
            title: 'Heat Transfer',
            headingPath: ['Heat Transfer'],
            charCount: 96,
            tokenEstimate: 24,
            truncated: false,
            citationIds: ['citation_heat_transfer'],
            relationEdgeIds: ['edge_water_heat'],
            sourceBoundary: 'full_document',
            score: 0.88,
        },
    ],
    sourceDecisions: [],
    totalCharCount: 96,
    tokenEstimate: 24,
};

describe('buildGraphAnswerPlan', () => {
    test('turns grouped anchor spans and evidenced graph neighbors into required semantic claims', () => {
        const plan = buildGraphAnswerPlan({
            message: 'what is water glass',
            knowledgePoints: [knowledgePoint],
            graphContext,
            ragContextPack,
        });

        expect(plan.anchorAtomId).toBe('water_glass');
        expect(plan.claims.map((claim) => claim.role)).toEqual(expect.arrayContaining([
            'definition',
            'boundary',
            'mechanism',
            'application',
        ]));
        expect(plan.claims.filter((claim) => claim.required).length).toBeGreaterThanOrEqual(3);
        expect(plan.claims.find((claim) => claim.role === 'application')?.supportingEdgeIds)
            .toContain('edge_water_heat');
    });

    test('does not promote a title-only graph neighbor into a factual claim', () => {
        const plan = buildGraphAnswerPlan({
            message: 'what is water glass',
            knowledgePoints: [knowledgePoint],
            graphContext,
        });

        expect(plan.claims.some((claim) => claim.supportingAtomIds.includes('container'))).toBe(false);
        expect(plan.omittedCandidates).toContainEqual(expect.objectContaining({
            atomId: 'container',
            reason: 'weak_evidence',
        }));
    });

    test('orders claims by discourse dependency instead of raw confidence', () => {
        const plan = buildGraphAnswerPlan({
            message: 'explain water glass in detail',
            knowledgePoints: [knowledgePoint],
            graphContext,
            ragContextPack: {
                ...ragContextPack,
                fragments: ragContextPack.fragments.map((fragment) => ({ ...fragment, score: 0.99 })),
            },
        });

        const roles = plan.claims.map((claim) => claim.role);
        expect(roles.indexOf('boundary')).toBeLessThan(roles.indexOf('mechanism'));
        expect(roles.indexOf('mechanism')).toBeLessThan(roles.indexOf('application'));
    });

    test('omits semantically redundant graph evidence from the public claim plan', () => {
        const plan = buildGraphAnswerPlan({
            message: 'what is water glass',
            knowledgePoints: [knowledgePoint],
            graphContext: {
                ...graphContext,
                supportingAtomIds: [...graphContext.supportingAtomIds, 'heat_transfer_duplicate'],
            },
            ragContextPack: {
                ...ragContextPack,
                fragments: [
                    ...ragContextPack.fragments,
                    {
                        ...ragContextPack.fragments[0],
                        fragmentId: 'neighbor_heat_transfer_duplicate',
                        atomId: 'heat_transfer_duplicate',
                        text: 'Thermal energy passes through the glass wall between the drink and its environment.',
                        score: 0.86,
                    },
                ],
            },
        });

        expect(plan.claims.filter((claim) => claim.role === 'application')).toHaveLength(1);
        expect(plan.omittedCandidates).toContainEqual({
            atomId: 'heat_transfer_duplicate',
            reason: 'redundant',
        });
    });

    test('requires distinct high-confidence claims even when they share one semantic role', () => {
        const plan = buildGraphAnswerPlan({
            message: 'explain water glass in detail',
            knowledgePoints: [knowledgePoint],
            graphContext: {
                ...graphContext,
                supportingAtomIds: [
                    ...graphContext.supportingAtomIds,
                    'heat_conduction',
                    'thermal_capacity',
                ],
            },
            ragContextPack: {
                ...ragContextPack,
                fragments: [
                    {
                        ...ragContextPack.fragments[0],
                        fragmentId: 'neighbor_heat_transfer_conduction',
                        atomId: 'heat_conduction',
                        text: 'The glass wall conducts thermal energy from the drink to the surrounding air.',
                        score: 0.93,
                    },
                    {
                        ...ragContextPack.fragments[0],
                        fragmentId: 'neighbor_heat_transfer_capacity',
                        atomId: 'thermal_capacity',
                        text: 'The wall heat capacity delays how quickly the drink approaches ambient temperature.',
                        score: 0.91,
                    },
                ],
            },
        });

        const applicationClaims = plan.claims.filter((claim) => claim.role === 'application');
        expect(applicationClaims).toHaveLength(2);
        expect(applicationClaims.every((claim) => claim.required)).toBe(true);
    });

    test('plans public semantic statements instead of renderer and table payloads', () => {
        const plan = buildGraphAnswerPlan({
            message: 'explain water glass in detail',
            knowledgePoints: [{
                ...knowledgePoint,
                matchedSpans: [
                    ...(knowledgePoint.matchedSpans || []),
                    {
                        atomId: 'thermal_equation_diagram',
                        title: 'Thermal Equation Diagram',
                        snippet: 'Heat crosses the glass wall by conduction. ```mermaid\ngraph TD\nA --> B\n```',
                        sourcePath: 'Knowledge_Base/waterglass/water-glass.md',
                        score: 0.89,
                        citation: null,
                    },
                    {
                        atomId: 'parameter_table',
                        title: 'Parameter Table',
                        snippet: 'The following table lists typical values. | Parameter | Unit | | :--- | :--- |',
                        sourcePath: 'Knowledge_Base/waterglass/water-glass.md',
                        score: 0.88,
                        citation: null,
                    },
                ],
            }],
            graphContext,
        });

        expect(plan.claims).toContainEqual(expect.objectContaining({
            statement: 'Heat crosses the glass wall by conduction.',
        }));
        expect(plan.claims.some((claim) => claim.statement.includes('```'))).toBe(false);
        expect(plan.claims.some((claim) => claim.statement.includes('| Parameter |'))).toBe(false);
    });

    test('selects a complete clause from dense mathematical evidence while retaining provenance', () => {
        const denseEvidence = [
            'Thermal transfer is governed by q = kA(T1 - T2) / L.',
            'This document will explain the following table as requested.',
            'For soda-lime glass the coefficient is usually between',
        ].join(' ');
        const plan = buildGraphAnswerPlan({
            message: 'explain thermal transfer in a water glass',
            knowledgePoints: [{
                ...knowledgePoint,
                matchedSpans: [{
                    atomId: 'thermal_transfer_dense',
                    title: 'Thermal Transfer',
                    snippet: denseEvidence,
                    sourcePath: 'Knowledge_Base/waterglass/thermal-transfer.md',
                    score: 0.94,
                    citation: null,
                }],
            }],
            graphContext,
        });

        expect(plan.claims[0].statement).toBe('Thermal transfer is governed by q = kA(T1 - T2) / L.');
        expect(plan.claims[0].evidenceRefs[0].text).toBe(denseEvidence);
    });
});
