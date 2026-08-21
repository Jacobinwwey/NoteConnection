import { conditionRagFragmentsByGraphPlan } from './graphConditionedContext';
import type { GraphAnswerPlan, RagEvidenceFragment } from './types';

function makeFragment(overrides: Partial<RagEvidenceFragment> = {}): RagEvidenceFragment {
    return {
        fragmentId: 'fragment-default',
        role: 'background',
        text: 'evidence',
        documentId: 'document-1',
        sourcePath: 'notes/topic.md',
        headingPath: [],
        charCount: 8,
        tokenEstimate: 2,
        truncated: false,
        citationIds: [],
        relationEdgeIds: [],
        score: 0.5,
        sourceBoundary: 'direct_span_only',
        ...overrides,
    };
}

function makePlan(): GraphAnswerPlan {
    return {
        intent: 'causal',
        depth: 'standard',
        anchorAtomId: 'atom-anchor',
        leadClaimId: 'claim-required',
        claims: [{
            claimId: 'claim-required',
            role: 'mechanism',
            required: true,
            priority: 100,
            statement: 'The planned mechanism is supported by the graph.',
            subjectAtomId: 'atom-anchor',
            supportingAtomIds: ['atom-support'],
            supportingEdgeIds: ['edge-support'],
            evidenceRefs: [{
                evidenceId: 'evidence-1',
                atomId: 'atom-support',
                sourcePath: 'notes/topic.md',
                citationIds: ['citation-1'],
                text: 'evidence',
            }],
            confidence: 0.95,
        }],
        requiredRoles: ['mechanism'],
        omittedCandidates: [],
    };
}

describe('conditionRagFragmentsByGraphPlan', () => {
    test('prefers fragments matched by required graph atoms and relation edges', () => {
        const fragments = [
            makeFragment({
                fragmentId: 'neighbor-unmatched',
                role: 'graph_neighbor_support',
                atomId: 'atom-other',
                relationEdgeIds: ['edge-other'],
            }),
            makeFragment({
                fragmentId: 'neighbor-matched',
                role: 'graph_neighbor_support',
                atomId: 'atom-support',
                relationEdgeIds: ['edge-support'],
            }),
            makeFragment({
                fragmentId: 'anchor-direct',
                role: 'direct_support',
                atomId: 'atom-anchor',
            }),
        ];

        const result = conditionRagFragmentsByGraphPlan({
            fragments,
            graphAnswerPlan: makePlan(),
        });

        expect(result.fragmentOrder.indexOf('neighbor-matched'))
            .toBeLessThan(result.fragmentOrder.indexOf('neighbor-unmatched'));
        expect(result.trace.strategy).toBe('graph_answer_plan');
        expect(result.trace.matchedClaimCount).toBe(1);
        expect(result.trace.matchedFragmentCount).toBe(2);
        expect(result.trace.selectedAtomIds).toEqual(['atom-anchor', 'atom-support']);
        expect(result.trace.selectedEdgeIds).toEqual(['edge-support']);
    });

    test('keeps input order and exposes an explicit fallback when no plan exists', () => {
        const fragments = [
            makeFragment({ fragmentId: 'second' }),
            makeFragment({ fragmentId: 'first' }),
        ];

        const result = conditionRagFragmentsByGraphPlan({ fragments });

        expect(result.fragmentOrder).toEqual(['second', 'first']);
        expect(result.trace).toEqual({
            strategy: 'none',
            matchedClaimCount: 0,
            matchedFragmentCount: 0,
            selectedAtomIds: [],
            selectedEdgeIds: [],
            fallbackReason: 'no_graph_answer_plan',
        });
    });
});
