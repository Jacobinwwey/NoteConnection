import type {
    GraphAnswerClaimPlan,
    GraphAnswerPlan,
    RagEvidenceFragment,
    RagGraphConditioningTrace,
} from './types';

export interface ConditionRagFragmentsByGraphPlanParams {
    fragments: ReadonlyArray<RagEvidenceFragment>;
    graphAnswerPlan?: GraphAnswerPlan;
}

export interface ConditionedRagFragmentSelection {
    fragmentOrder: string[];
    trace: RagGraphConditioningTrace;
}

interface FragmentMatch {
    claimIds: Set<string>;
    priority: number;
    required: boolean;
}

function claimAtomIds(claim: GraphAnswerClaimPlan, anchorAtomId: string): Set<string> {
    return new Set([
        anchorAtomId,
        claim.subjectAtomId,
        ...claim.supportingAtomIds,
        ...claim.evidenceRefs.map((evidence) => evidence.atomId || ''),
    ].filter(Boolean));
}

function matchFragmentToClaim(
    fragment: RagEvidenceFragment,
    claim: GraphAnswerClaimPlan,
    anchorAtomId: string
): boolean {
    const atomIds = claimAtomIds(claim, anchorAtomId);
    if (fragment.atomId && atomIds.has(fragment.atomId)) {
        return true;
    }
    const edgeIds = new Set(claim.supportingEdgeIds);
    return (fragment.relationEdgeIds || []).some((edgeId) => edgeIds.has(edgeId));
}

export function conditionRagFragmentsByGraphPlan(
    params: ConditionRagFragmentsByGraphPlanParams
): ConditionedRagFragmentSelection {
    const fragments = Array.isArray(params.fragments) ? params.fragments : [];
    const plan = params.graphAnswerPlan;
    if (!plan) {
        return {
            fragmentOrder: fragments.map((fragment) => fragment.fragmentId),
            trace: {
                strategy: 'none',
                matchedClaimCount: 0,
                matchedFragmentCount: 0,
                selectedAtomIds: [],
                selectedEdgeIds: [],
                fallbackReason: 'no_graph_answer_plan',
            },
        };
    }
    if (plan.claims.length <= 0) {
        return {
            fragmentOrder: fragments.map((fragment) => fragment.fragmentId),
            trace: {
                strategy: 'none',
                matchedClaimCount: 0,
                matchedFragmentCount: 0,
                selectedAtomIds: [],
                selectedEdgeIds: [],
                fallbackReason: 'empty_graph_answer_plan',
            },
        };
    }

    const matches = new Map<string, FragmentMatch>();
    const matchedClaims = new Set<string>();
    const selectedAtomIds = new Set<string>();
    const selectedEdgeIds = new Set<string>();
    fragments.forEach((fragment) => {
        const match: FragmentMatch = {
            claimIds: new Set<string>(),
            priority: 0,
            required: false,
        };
        plan.claims.forEach((claim) => {
            if (!matchFragmentToClaim(fragment, claim, plan.anchorAtomId)) {
                return;
            }
            match.claimIds.add(claim.claimId);
            match.priority = Math.max(match.priority, claim.priority);
            match.required = match.required || claim.required;
            matchedClaims.add(claim.claimId);
        });
        if (match.claimIds.size <= 0) {
            return;
        }
        matches.set(fragment.fragmentId, match);
        if (fragment.atomId) {
            selectedAtomIds.add(fragment.atomId);
        }
        (fragment.relationEdgeIds || []).forEach((edgeId: string) => {
            if (plan.claims.some((claim) => claim.supportingEdgeIds.includes(edgeId))) {
                selectedEdgeIds.add(edgeId);
            }
        });
    });

    const originalOrder = new Map(fragments.map((fragment, index) => [fragment.fragmentId, index]));
    const fragmentOrder = fragments
        .slice()
        .sort((left, right) => {
            const leftMatch = matches.get(left.fragmentId);
            const rightMatch = matches.get(right.fragmentId);
            const leftRank = leftMatch ? (leftMatch.required ? 0 : 1) : 2;
            const rightRank = rightMatch ? (rightMatch.required ? 0 : 1) : 2;
            if (leftRank !== rightRank) {
                return leftRank - rightRank;
            }
            const priorityDelta = (rightMatch?.priority || 0) - (leftMatch?.priority || 0);
            if (priorityDelta !== 0) {
                return priorityDelta;
            }
            return (originalOrder.get(left.fragmentId) || 0) - (originalOrder.get(right.fragmentId) || 0);
        })
        .map((fragment) => fragment.fragmentId);

    return {
        fragmentOrder,
        trace: {
            strategy: 'graph_answer_plan',
            matchedClaimCount: matchedClaims.size,
            matchedFragmentCount: matches.size,
            selectedAtomIds: Array.from(selectedAtomIds).sort(),
            selectedEdgeIds: Array.from(selectedEdgeIds).sort(),
        },
    };
}
