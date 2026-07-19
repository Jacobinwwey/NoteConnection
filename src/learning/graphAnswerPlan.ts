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
import {
    naturalizeRagPublicEvidenceClause,
    shouldRejectCompareProcedureEvidenceClause,
    shouldRejectPublicEvidenceClause,
} from './ragPublicText';
import { graphClaimSemanticSimilarity } from './graphClaimMatcher';
import { scoreRagEvidenceClause, segmentRagEvidenceClauses } from './ragEvidenceQuality';

export interface BuildGraphAnswerPlanParams {
    message: string;
    knowledgePoints: AgentConversationKnowledgePoint[];
    graphContext: AgentConversationGraphContext | null;
    ragContextPack?: RagContextPack;
}

function normalize(value: string): string {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function selectPublicClaimStatement(value: string, title?: string): string {
    let normalized = naturalizeRagPublicEvidenceClause(normalize(value));
    if (!normalized) {
        return '';
    }
    const normalizedTitle = normalize(String(title || '').replace(/\s*\((?:mermaid|code|diagram)\s+block\)\s*$/iu, ''));
    if (normalizedTitle && normalized.toLowerCase().startsWith(`${normalizedTitle.toLowerCase()} `)) {
        normalized = normalized.slice(normalizedTitle.length).trim();
    }
    return normalized
        .split(/(?<=[.!?。！？])\s*/u)
        .map((clause) => clause.trim())
        .filter((clause) => clause && !shouldRejectPublicEvidenceClause(clause))
        .join(' ')
        .replace(/(\d)\.\s+(?=\d)/gu, '$1.')
        .trim();
}

function publicClaimAnchorTerms(message: string, title?: string): string[] {
    const source = `${message} ${title || ''}`.toLowerCase();
    return Array.from(new Set(source.match(/[a-z0-9][a-z0-9_-]{2,}|[\u3400-\u9fff]{2,}/gu) || []));
}

function selectQualityPublicClaimStatement(value: string, title: string | undefined, message: string): string {
    const normalizedEvidence = naturalizeRagPublicEvidenceClause(normalize(value));
    if (!normalizedEvidence) {
        return '';
    }
    const normalizedTitle = normalize(String(title || '').replace(/\s*\((?:mermaid|code|diagram)\s+block\)\s*$/iu, ''));
    const anchorTerms = publicClaimAnchorTerms(message, normalizedTitle);
    const candidates = segmentRagEvidenceClauses(normalizedEvidence)
        .map((clause) => naturalizeRagPublicEvidenceClause(clause))
        .map((clause) => {
            if (!normalizedTitle || !clause.toLowerCase().startsWith(`${normalizedTitle.toLowerCase()} `)) {
                return clause;
            }
            const remainder = clause.slice(normalizedTitle.length).trim();
            const repeatsTitle = remainder.toLowerCase().startsWith(`${normalizedTitle.toLowerCase()} `);
            const titleWordCount = normalizedTitle.split(/\s+/u).filter(Boolean).length;
            return repeatsTitle || (titleWordCount > 1 && /^(?:a|an|the)\s+/iu.test(remainder))
                ? remainder
                : clause;
        })
        .filter((clause) => (
            clause
            && !shouldRejectPublicEvidenceClause(clause)
            && !shouldRejectCompareProcedureEvidenceClause(clause, message)
        ))
        .map((clause, order) => {
            const lowerClause = clause.toLowerCase();
            const anchorMatches = anchorTerms.filter((term) => lowerClause.includes(term)).length;
            const incompleteEnding = /\b(?:and|or|with|at|in|between|is|are|from|to)$/iu.test(clause)
                || /(?:以及|并且|其中|通常在|范围为|分别为|是|为)$/u.test(clause);
            return {
                clause,
                score: scoreRagEvidenceClause(clause).score + Math.min(0.6, anchorMatches * 0.2) - (incompleteEnding ? 0.5 : 0),
                order,
            };
        });
    candidates.sort((left, right) => right.score - left.score || left.order - right.order);
    return candidates[0]?.clause.replace(/(\d)\.\s+(?=\d)/gu, '$1.').trim() || '';
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
    title?: string;
    anchorAtomId: string;
    atomId?: string;
    sourcePath: string;
    evidenceId: string;
    citationIds?: string[];
    edgeIds?: string[];
    confidence: number;
    message: string;
}): GraphAnswerClaimPlan {
    const evidenceText = normalize(params.statement);
    const publicStatement = selectQualityPublicClaimStatement(evidenceText, params.title, params.message);
    return {
        claimId: `graph_claim_${params.index + 1}`,
        role: params.role,
        required: false,
        priority: params.role === 'definition' ? 100 : Math.round(params.confidence * 90),
        statement: publicStatement,
        subjectAtomId: params.anchorAtomId,
        supportingAtomIds: params.atomId && params.atomId !== params.anchorAtomId ? [params.atomId] : [],
        supportingEdgeIds: params.edgeIds || [],
        evidenceRefs: [{
            evidenceId: params.evidenceId,
            atomId: params.atomId,
            sourcePath: params.sourcePath,
            citationIds: params.citationIds || [],
            text: evidenceText,
        }],
        confidence: Number(Math.max(0, Math.min(1, params.confidence)).toFixed(4)),
    };
}

export function buildGraphAnswerPlan(params: BuildGraphAnswerPlanParams): GraphAnswerPlan {
    const anchor = params.knowledgePoints[0];
    const anchorAtomId = params.graphContext?.anchorAtomId || anchor?.atomId || '';
    const claims: GraphAnswerClaimPlan[] = [];
    const redundantAtomIds = new Set<string>();
    const seen = new Set<string>();
    const append = (claim: GraphAnswerClaimPlan) => {
        const key = normalize(claim.statement).toLowerCase();
        if (!key || seen.has(key)) return;
        const rawEvidence = claim.evidenceRefs[0]?.text || '';
        if (/```(?:mermaid|graph)\b/iu.test(rawEvidence) && !/[.!?\u3002\uFF01\uFF1F]/u.test(claim.statement)) {
            return;
        }
        const redundantClaim = claims.find((existing) => (
            existing.role === claim.role
            && graphClaimSemanticSimilarity(existing.statement, claim.statement) >= 0.72
        ));
        if (redundantClaim) {
            const redundantAtomId = claim.supportingAtomIds[0] || claim.evidenceRefs[0]?.atomId;
            if (redundantAtomId) redundantAtomIds.add(redundantAtomId);
            return;
        }
        seen.add(key);
        claims.push(claim);
    };

    (anchor?.matchedSpans || []).forEach((span, spanIndex) => append(makeClaim({
        index: claims.length,
        role: spanIndex === 0 ? 'definition' : inferRole(span.title, span.snippet),
        statement: span.snippet,
        title: span.title,
        anchorAtomId,
        atomId: span.atomId,
        sourcePath: span.sourcePath,
        evidenceId: span.citation?.citationId || `span_${span.atomId}_${claims.length + 1}`,
        citationIds: span.citation ? [span.citation.citationId] : [],
        confidence: span.score,
        message: params.message,
    })));

    const selectedSupportingAtomIds = new Set(params.graphContext?.supportingAtomIds || []);
    (params.ragContextPack?.fragments || [])
        .filter((fragment) => fragment.role !== 'background')
        .filter((fragment) => (
            fragment.role !== 'graph_neighbor_support'
            || selectedSupportingAtomIds.size <= 0
            || Boolean(fragment.atomId && selectedSupportingAtomIds.has(fragment.atomId))
        ))
        .forEach((fragment) => {
            const relationKind = fragmentRelationKind(fragment, params.graphContext);
            append(makeClaim({
                index: claims.length,
                role: inferRole(fragment.title || '', fragment.text, relationKind),
                statement: fragment.text,
                title: fragment.title,
                anchorAtomId,
                atomId: fragment.atomId,
                sourcePath: fragment.sourcePath,
                evidenceId: fragment.fragmentId,
                citationIds: fragment.citationIds,
                edgeIds: fragment.relationEdgeIds,
                confidence: Number(fragment.score || 0.75),
                message: params.message,
            }));
        });

    if (claims.length === 0 && anchor) {
        append(makeClaim({
            index: 0,
            role: 'definition',
            statement: anchor.evidenceSnippet || anchor.summary,
            title: anchor.title,
            anchorAtomId,
            atomId: anchor.atomId,
            sourcePath: anchor.sourcePath || anchor.citation?.sourcePath || '',
            evidenceId: anchor.citation?.citationId || `point_${anchor.atomId}`,
            citationIds: anchor.citation ? [anchor.citation.citationId] : [],
            confidence: anchor.score,
            message: params.message,
        }));
    }

    const evidencedAtomIds = new Set(claims.flatMap((claim) => claim.supportingAtomIds));
    const omittedCandidates = [
        ...Array.from(redundantAtomIds).map((atomId) => ({ atomId, reason: 'redundant' as const })),
        ...[
            ...(params.graphContext?.predecessorWindow || []),
            ...(params.graphContext?.successorWindow || []),
        ].map((node) => ({ atomId: node.atomId, reason: 'weak_evidence' as const })),
    ]
        .filter((node) => node.atomId !== anchorAtomId && !evidencedAtomIds.has(node.atomId))
        .filter((node, index, nodes) => nodes.findIndex((candidate) => candidate.atomId === node.atomId) === index);
    const roleOrder: Record<GraphAnswerRole, number> = {
        definition: 10,
        composition: 20,
        boundary: 30,
        attribute: 40,
        prerequisite: 50,
        mechanism: 60,
        causal_consequence: 70,
        sequence: 80,
        application: 90,
        contrast: 100,
        analogy: 110,
        temporal_warning: 120,
    };
    const sortedClaims = claims.sort((left, right) => (
        roleOrder[left.role] - roleOrder[right.role]
        || right.priority - left.priority
    ));
    sortedClaims.forEach((claim) => {
        // The upstream evidence pack is already bounded. At this boundary, novelty and
        // confidence determine coverage; role cardinality does not imply redundancy.
        claim.required = claim.confidence > 0.75;
    });
    if (!sortedClaims.some((claim) => claim.required) && sortedClaims.length > 0) {
        sortedClaims[0].required = true;
    }
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
