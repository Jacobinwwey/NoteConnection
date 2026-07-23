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

    test('retains every query-connected clause from dense direct evidence without a claim-count quota', () => {
        const plan = buildGraphAnswerPlan({
            message: 'what is water glass',
            knowledgePoints: [knowledgePoint],
            graphContext,
            ragContextPack: {
                ...ragContextPack,
                fragments: [{
                    ...ragContextPack.fragments[0],
                    fragmentId: 'direct_water_glass_dense_evidence',
                    role: 'direct_support',
                    atomId: 'water_glass',
                    title: 'Water Glass',
                    text: [
                        'A water glass is a transparent vessel used to hold water.',
                        'It separates the liquid from the surrounding environment.',
                        'Its wall conducts heat between the drink and the air.',
                        'Mars has two moons.',
                    ].join(' '),
                    score: 0.9,
                }],
            },
        });

        const directClaims = plan.claims
            .filter((claim) => claim.evidenceRefs.some((reference) => reference.evidenceId === 'direct_water_glass_dense_evidence'))
            .map((claim) => claim.statement);

        expect(directClaims).toEqual(expect.arrayContaining([
            'A water glass is a transparent vessel used to hold water.',
            'It separates the liquid from the surrounding environment.',
            'Its wall conducts heat between the drink and the air.',
        ]));
        expect(directClaims).not.toContain('Mars has two moons.');
    });

    test('retains distinct fact values from semantically similar conflict evidence', () => {
        const plan = buildGraphAnswerPlan({
            message: 'what is release date conflict probe?',
            knowledgePoints: [knowledgePoint],
            graphContext,
            ragContextPack: {
                ...ragContextPack,
                fragments: [
                    {
                        ...ragContextPack.fragments[0],
                        fragmentId: 'announced_release_date',
                        role: 'direct_support',
                        atomId: 'release_date_probe',
                        title: 'Release Date Conflict Probe',
                        text: 'The migration release date is 2026-07-01.',
                        score: 0.92,
                    },
                    {
                        ...ragContextPack.fragments[0],
                        fragmentId: 'revised_release_date',
                        role: 'conflict',
                        atomId: 'release_date_probe',
                        title: 'Release Date Conflict Probe',
                        text: 'The migration release date is 2026-08-15.',
                        score: 0.92,
                    },
                ],
            },
        });

        expect(plan.claims.map((claim) => claim.statement)).toEqual(expect.arrayContaining([
            'The migration release date is 2026-07-01.',
            'The migration release date is 2026-08-15.',
        ]));
    });

    test('retains distinct values when equivalent fact subjects use different word order', () => {
        const plan = buildGraphAnswerPlan({
            message: 'what is release date conflict probe?',
            knowledgePoints: [knowledgePoint],
            graphContext,
            ragContextPack: {
                ...ragContextPack,
                fragments: [
                    {
                        ...ragContextPack.fragments[0],
                        fragmentId: 'announced_release_date_reordered',
                        role: 'direct_support',
                        atomId: 'release_date_probe',
                        title: 'Release Date Conflict Probe',
                        text: 'The migration release date is 2026-07-01.',
                        score: 0.92,
                    },
                    {
                        ...ragContextPack.fragments[0],
                        fragmentId: 'revised_release_date_reordered',
                        role: 'conflict',
                        atomId: 'release_date_probe',
                        title: 'Release Date Conflict Probe',
                        text: 'The release date for migration is 2026-08-15.',
                        score: 0.92,
                    },
                ],
            },
        });

        expect(plan.claims.map((claim) => claim.statement)).toEqual(expect.arrayContaining([
            'The migration release date is 2026-07-01.',
            'The release date for migration is 2026-08-15.',
        ]));
    });

    test('retains comparison evidence that completes separate requested branches', () => {
        const plan = buildGraphAnswerPlan({
            message: 'compare cross version one state source with cross version two state source',
            knowledgePoints: [knowledgePoint],
            graphContext,
            ragContextPack: {
                ...ragContextPack,
                fragments: [
                    {
                        ...ragContextPack.fragments[0],
                        fragmentId: 'version_one_state',
                        role: 'direct_support',
                        atomId: 'version_one_state',
                        sourcePath: 'Knowledge_Base/test/cross version one state source.md',
                        title: 'Cross Version One State Source',
                        text: 'Cross version one state source records that the migration gate status is enabled in version 1.0.',
                        score: 0.92,
                    },
                    {
                        ...ragContextPack.fragments[0],
                        fragmentId: 'version_two_state',
                        role: 'direct_support',
                        atomId: 'version_two_state',
                        sourcePath: 'Knowledge_Base/test/cross version two state source.md',
                        title: 'Cross Version Two State Source',
                        text: 'Cross version two state source records that the migration gate status is disabled in version 2.0.',
                        score: 0.92,
                    },
                ],
            },
        });

        expect(plan.claims.map((claim) => claim.statement)).toEqual(expect.arrayContaining([
            'Cross version one state source records that the migration gate status is enabled in version 1.0.',
            'Cross version two state source records that the migration gate status is disabled in version 2.0.',
        ]));
    });

    test('labels comparison claims when otherwise identical evidence is distinguished only by node title', () => {
        const plan = buildGraphAnswerPlan({
            message: 'compare basalt with granite',
            knowledgePoints: [knowledgePoint],
            graphContext,
            ragContextPack: {
                ...ragContextPack,
                fragments: [
                    {
                        ...ragContextPack.fragments[0],
                        fragmentId: 'basalt_density',
                        role: 'direct_support',
                        atomId: 'basalt',
                        sourcePath: 'Knowledge_Base/test/source-a.md',
                        title: 'Basalt',
                        text: 'Its density is high.',
                        score: 0.92,
                    },
                    {
                        ...ragContextPack.fragments[0],
                        fragmentId: 'granite_density',
                        role: 'direct_support',
                        atomId: 'granite',
                        sourcePath: 'Knowledge_Base/test/source-b.md',
                        title: 'Granite',
                        text: 'Its density is high.',
                        score: 0.92,
                    },
                ],
            },
        });

        expect(plan.claims.map((claim) => claim.statement)).toEqual(expect.arrayContaining([
            'Basalt: Its density is high.',
            'Granite: Its density is high.',
        ]));
    });

    test('retains comparison branches whose only distinct token is a short version number', () => {
        const plan = buildGraphAnswerPlan({
            message: 'compare iOS 17 with iOS 18',
            knowledgePoints: [knowledgePoint],
            graphContext,
            ragContextPack: {
                ...ragContextPack,
                fragments: [
                    {
                        ...ragContextPack.fragments[0],
                        fragmentId: 'ios_17_status',
                        role: 'direct_support',
                        atomId: 'ios_17',
                        sourcePath: 'Knowledge_Base/test/opaque-a.md',
                        title: 'iOS 17',
                        text: 'Its response status is stable.',
                        score: 0.92,
                    },
                    {
                        ...ragContextPack.fragments[0],
                        fragmentId: 'ios_18_status',
                        role: 'direct_support',
                        atomId: 'ios_18',
                        sourcePath: 'Knowledge_Base/test/opaque-b.md',
                        title: 'iOS 18',
                        text: 'Its response status is stable.',
                        score: 0.92,
                    },
                ],
            },
        });

        expect(plan.claims.map((claim) => claim.statement)).toEqual(expect.arrayContaining([
            'iOS 17: Its response status is stable.',
            'iOS 18: Its response status is stable.',
        ]));
    });

    test('retains comparison branches made only of one-character labels', () => {
        const plan = buildGraphAnswerPlan({
            message: 'compare A with B',
            knowledgePoints: [knowledgePoint],
            graphContext,
            ragContextPack: {
                ...ragContextPack,
                fragments: [
                    {
                        ...ragContextPack.fragments[0],
                        fragmentId: 'label_a_status',
                        role: 'direct_support',
                        atomId: 'label_a',
                        sourcePath: 'Knowledge_Base/test/opaque-a.md',
                        title: 'A',
                        text: 'Its response status is stable.',
                        score: 0.92,
                    },
                    {
                        ...ragContextPack.fragments[0],
                        fragmentId: 'label_b_status',
                        role: 'direct_support',
                        atomId: 'label_b',
                        sourcePath: 'Knowledge_Base/test/opaque-b.md',
                        title: 'B',
                        text: 'Its response status is stable.',
                        score: 0.92,
                    },
                ],
            },
        });

        expect(plan.claims.map((claim) => claim.statement)).toEqual(expect.arrayContaining([
            'A: Its response status is stable.',
            'B: Its response status is stable.',
        ]));
    });

    test('does not treat unrelated clauses as comparison evidence solely because their fragment title matches a branch', () => {
        const plan = buildGraphAnswerPlan({
            message: 'compare basalt with granite',
            knowledgePoints: [knowledgePoint],
            graphContext,
            ragContextPack: {
                ...ragContextPack,
                fragments: [
                    {
                        ...ragContextPack.fragments[0],
                        fragmentId: 'basalt_density_with_noise',
                        role: 'direct_support',
                        atomId: 'basalt',
                        sourcePath: 'Knowledge_Base/test/basalt.md',
                        title: 'Basalt',
                        text: 'Its density is high. Mars has two moons.',
                        score: 0.92,
                    },
                    {
                        ...ragContextPack.fragments[0],
                        fragmentId: 'granite_density_with_noise',
                        role: 'direct_support',
                        atomId: 'granite',
                        sourcePath: 'Knowledge_Base/test/granite.md',
                        title: 'Granite',
                        text: 'Its density is high. Mars has two moons.',
                        score: 0.92,
                    },
                ],
            },
        });

        const statements = plan.claims.map((claim) => claim.statement);
        expect(statements).toEqual(expect.arrayContaining([
            'Basalt: Its density is high.',
            'Granite: Its density is high.',
        ]));
        expect(statements).not.toContain('Basalt: Mars has two moons.');
        expect(statements).not.toContain('Granite: Mars has two moons.');
    });

    test('removes structural CJK headings without removing an English subject phrase', () => {
        const plan = buildGraphAnswerPlan({
            message: 'explain optics in a water glass',
            knowledgePoints: [{
                ...knowledgePoint,
                matchedSpans: [{
                    atomId: 'optics_heading',
                    title: '3. 光学：光与系统的相互作用',
                    snippet: '3. 光学：光与系统的相互作用\n当光线穿过空气、玻璃和水时会发生折射。',
                    sourcePath: 'Knowledge_Base/waterglass/optics.md',
                    score: 0.94,
                    citation: null,
                }],
            }],
            graphContext,
        });

        expect(plan.claims[0].statement).toBe('当光线穿过空气、玻璃和水时会发生折射。');
    });

    test('turns multilingual comparison prose into a required contrast claim', () => {
        const plan = buildGraphAnswerPlan({
            message: 'compare water glass and plastic cup',
            knowledgePoints: [knowledgePoint],
            graphContext,
            ragContextPack: {
                ...ragContextPack,
                query: 'compare water glass and plastic cup',
                fragments: [
                    {
                        ...ragContextPack.fragments[0],
                        fragmentId: 'rag_parent_material_comparison',
                        role: 'parent_context',
                        atomId: 'water_glass',
                        title: '相关技术与比较数学模型',
                        text: [
                            '光学系统比较模型: 水杯透镜 vs.',
                            '热损失模型可写为 Q = kAΔT/d。',
                            '这是一种远比水杯复杂的数学优化。',
                            '玻璃水杯通常比PET塑料杯更透明。',
                            '对于相同尺寸的杯子，PET塑料杯的热损失速率大约是玻璃杯的1/5。',
                        ].join(' '),
                        score: 0.88,
                    },
                ],
            },
        });

        expect(plan.claims.map((claim) => ({
            role: claim.role,
            required: claim.required,
            statement: claim.statement,
        }))).toContainEqual(expect.objectContaining({
            role: 'contrast',
            required: true,
            statement: '对于相同尺寸的杯子，PET塑料杯的热损失速率大约是玻璃杯的1/5。',
        }));
        expect(plan.requiredRoles).toContain('contrast');
        expect(plan.claims).toContainEqual(expect.objectContaining({
            role: 'contrast',
            required: true,
            statement: '玻璃水杯通常比PET塑料杯更透明。',
        }));
        expect(plan.claims.some((claim) => claim.statement.includes('数学优化'))).toBe(false);
    });

    test('does not spend compare-claim budget on a clause that covers only one requested branch', () => {
        const plan = buildGraphAnswerPlan({
            message: 'compare water glass and plastic cup',
            knowledgePoints: [knowledgePoint],
            graphContext,
            ragContextPack: {
                ...ragContextPack,
                query: 'compare water glass and plastic cup',
                fragments: [{
                    ...ragContextPack.fragments[0],
                    fragmentId: 'rag_parent_mixed_comparisons',
                    role: 'parent_context',
                    atomId: 'water_glass',
                    title: '相关技术与比较数学模型',
                    text: [
                        'PET塑料杯的热损失速率大约是玻璃杯的1/5。',
                        '消色差透镜使用两种不同色散特性的玻璃组合。',
                    ].join(' '),
                    score: 0.88,
                }],
            },
        });

        expect(plan.claims).toContainEqual(expect.objectContaining({
            role: 'contrast',
            statement: 'PET塑料杯的热损失速率大约是玻璃杯的1/5。',
        }));
        expect(plan.claims.some((claim) => claim.statement.includes('消色差透镜'))).toBe(false);
    });
});
