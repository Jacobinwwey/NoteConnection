import type {
    AgentConversationGraphContext,
    AgentConversationKnowledgePoint,
    GraphAnswerClaimPlan,
    GraphAnswerPlan,
    GraphAnswerRole,
    RagContextPack,
    RagEvidenceFragment,
    RelationKind,
} from './types';

export interface BuildGraphAnswerPlanParams {
    message: string;
    knowledgePoints: AgentConversationKnowledgePoint[];
    graphContext: AgentConversationGraphContext | null;
    ragContextPack?: RagContextPack;
}

function normalize(value: string): string {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function isAuthoringScaffolding(value: string): boolean {
    return /\b(?:distractor|must not guide|do not use|ignore this (?:section|evidence)|must (?:compare|resolve)|before publishing)\b/iu.test(value)
        || /(?:遵从您的指示|所有推理过程|最终输出为|仅基于标题|根据您的要求生成)/u.test(value);
}

function classifyIntent(message: string): GraphAnswerPlan['intent'] {
    const value = normalize(message).toLowerCase();
    if (/\b(?:compare|contrast|difference|versus|vs)\b/u.test(value) || /区别|对比/u.test(value)) return 'compare';
    if (/\b(?:why|cause|mechanism|reason|consequence)\b/u.test(value) || /为什么|原因|机制|导致/u.test(value)) return 'causal';
    if (/\b(?:how to|steps?|procedure|workflow)\b/u.test(value) || /如何|怎么|步骤/u.test(value)) return 'procedure';
    if (/\b(?:what is|explain|define)\b/u.test(value) || /什么是|解释/u.test(value)) return 'definition';
    return 'generic';
}

function inferRole(title: string, text: string, relationKind?: RelationKind): GraphAnswerRole {
    const value = `${title} ${text}`.toLowerCase();
    if (relationKind === 'prerequisite') return 'prerequisite';
    if (relationKind === 'sequence') return 'sequence';
    if (relationKind === 'causal') return 'causal_consequence';
    if (relationKind === 'contrast') return 'contrast';
    if (relationKind === 'analogy') return 'analogy';
    if (relationKind === 'application') return 'application';
    if (/boundary|边界|隔开|separat/u.test(value)) return 'boundary';
    if (/thermal|heat|mechanism|exchange|传热|热交换|机制/u.test(value)) return 'mechanism';
    if (/compos|consist|made of|组成|构成/u.test(value)) return 'composition';
    if (/property|attribute|feature|特征|属性/u.test(value)) return 'attribute';
    return 'definition';
}

function fragmentRelationKind(fragment: RagEvidenceFragment, graphContext: AgentConversationGraphContext | null): RelationKind | undefined {
    const edgeIds = new Set(fragment.relationEdgeIds || []);
    return (graphContext?.knowledgePointRelations || [])
        .find((relation) => edgeIds.has(relation.edgeId))?.relationKind;
}

function makeClaim(params: {
    index: number;
    role: GraphAnswerRole;
    statement: string;
    anchorAtomId: string;
    atomId?: string;
    sourcePath: string;
    evidenceId: string;
    citationIds?: string[];
    edgeIds?: string[];
    confidence: number;
}): GraphAnswerClaimPlan {
    return {
        claimId: `graph_claim_${params.index + 1}`,
        role: params.role,
        required: false,
        priority: params.role === 'definition' ? 100 : Math.round(params.confidence * 90),
        statement: normalize(params.statement),
        subjectAtomId: params.anchorAtomId,
        supportingAtomIds: params.atomId && params.atomId !== params.anchorAtomId ? [params.atomId] : [],
        supportingEdgeIds: params.edgeIds || [],
        evidenceRefs: [{
            evidenceId: params.evidenceId,
            atomId: params.atomId,
            sourcePath: params.sourcePath,
            citationIds: params.citationIds || [],
            text: normalize(params.statement),
        }],
        confidence: Number(Math.max(0, Math.min(1, params.confidence)).toFixed(4)),
    };
}

export function buildGraphAnswerPlan(params: BuildGraphAnswerPlanParams): GraphAnswerPlan {
    const anchor = params.knowledgePoints[0];
    const anchorAtomId = params.graphContext?.anchorAtomId || anchor?.atomId || '';
    const claims: GraphAnswerClaimPlan[] = [];
    const seen = new Set<string>();
    const append = (claim: GraphAnswerClaimPlan) => {
        const key = normalize(claim.statement).toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        claims.push(claim);
    };

    (anchor?.matchedSpans || []).filter((span) => !isAuthoringScaffolding(span.snippet)).forEach((span, spanIndex) => append(makeClaim({
        index: claims.length,
        role: spanIndex === 0 ? 'definition' : inferRole(span.title, span.snippet),
        statement: span.snippet,
        anchorAtomId,
        atomId: span.atomId,
        sourcePath: span.sourcePath,
        evidenceId: span.citation?.citationId || `span_${span.atomId}_${claims.length + 1}`,
        citationIds: span.citation ? [span.citation.citationId] : [],
        confidence: span.score,
    })));

    (params.ragContextPack?.fragments || [])
        .filter((fragment) => fragment.role !== 'background' && !isAuthoringScaffolding(fragment.text))
        .forEach((fragment) => {
            const relationKind = fragmentRelationKind(fragment, params.graphContext);
            append(makeClaim({
                index: claims.length,
                role: inferRole(fragment.title || '', fragment.text, relationKind),
                statement: fragment.text,
                anchorAtomId,
                atomId: fragment.atomId,
                sourcePath: fragment.sourcePath,
                evidenceId: fragment.fragmentId,
                citationIds: fragment.citationIds,
                edgeIds: fragment.relationEdgeIds,
                confidence: Number(fragment.score || 0.75),
            }));
        });

    if (claims.length === 0 && anchor) {
        append(makeClaim({
            index: 0,
            role: 'definition',
            statement: anchor.evidenceSnippet || anchor.summary,
            anchorAtomId,
            atomId: anchor.atomId,
            sourcePath: anchor.sourcePath || anchor.citation?.sourcePath || '',
            evidenceId: anchor.citation?.citationId || `point_${anchor.atomId}`,
            citationIds: anchor.citation ? [anchor.citation.citationId] : [],
            confidence: anchor.score,
        }));
    }

    const evidencedAtomIds = new Set(claims.flatMap((claim) => claim.supportingAtomIds));
    const omittedCandidates = [
        ...(params.graphContext?.predecessorWindow || []),
        ...(params.graphContext?.successorWindow || []),
    ]
        .filter((node) => node.atomId !== anchorAtomId && !evidencedAtomIds.has(node.atomId))
        .filter((node, index, nodes) => nodes.findIndex((candidate) => candidate.atomId === node.atomId) === index)
        .map((node) => ({ atomId: node.atomId, reason: 'weak_evidence' as const }));
    const sortedClaims = claims.sort((left, right) => right.priority - left.priority);
    const requiredRoleClaims = new Set<string>();
    sortedClaims.forEach((claim) => {
        if (claim.confidence < 0.75 || requiredRoleClaims.has(claim.role)) return;
        requiredRoleClaims.add(claim.role);
        claim.required = true;
    });
    return {
        intent: classifyIntent(params.message),
        depth: sortedClaims.length <= 2 ? 'compact' : sortedClaims.length <= 7 ? 'standard' : 'deep',
        anchorAtomId,
        leadClaimId: sortedClaims[0]?.claimId || '',
        claims: sortedClaims,
        requiredRoles: Array.from(new Set(sortedClaims.filter((claim) => claim.required).map((claim) => claim.role))),
        omittedCandidates,
    };
}
