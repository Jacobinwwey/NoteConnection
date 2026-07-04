import { isOpsAdapter } from './store';
import type { KnowledgeGraphStore, KnowledgeGraphOpsAdapter, PathQueryResult } from './store';
import type {
    AgentConversationGraphConnectionPath,
    AgentConversationGraphContext,
    AgentConversationGraphDiagnostics,
    AgentConversationGraphKnowledgePointRelation,
    AgentConversationGraphNodeProfile,
    AgentConversationGraphRelationSummary,
    AgentConversationGraphTemporalContext,
    AgentConversationGraphWindowNode,
    AgentConversationKnowledgePoint,
    KnowledgeCitation,
    KnowledgeQueryResolvedScope,
    KnowledgeQueryTemporalDetail,
    RelationEdge,
    RelationKind,
} from './types';

export type GraphContextAssemblyIntent = 'explain' | 'compare' | 'how_to' | 'generic';

export type GraphContextAssemblyBudget = {
    maxSupportNodes?: number;
    maxConnectionPaths?: number;
    maxPathDepth?: number;
    maxPredecessors?: number;
    maxSuccessors?: number;
};

export type GraphContextAssemblyParams = {
    message: string;
    usedScope: KnowledgeQueryResolvedScope;
    knowledgePoints: AgentConversationKnowledgePoint[];
    store: KnowledgeGraphStore | null;
    budget?: GraphContextAssemblyBudget;
};

export type GraphContextAssemblyResult = {
    knowledgePoints: AgentConversationKnowledgePoint[];
    graphContext: AgentConversationGraphContext | null;
};

type ResolvedAssemblyBudget = Required<GraphContextAssemblyBudget>;

type AnchorSelection = {
    point: AgentConversationKnowledgePoint;
    index: number;
    reason: string;
};

type CachedGraphNodeMetrics = {
    inDegree?: number;
    outDegree?: number;
    centrality?: number;
};

type AnchorNodeExclusion = {
    atomIds: Set<string>;
    titles: Set<string>;
};

function normalizeGraphComparableTitle(value: string): string {
    return normalizeWhitespace(String(value || '').toLowerCase());
}

function buildAnchorNodeExclusion(
    anchorPoint: AgentConversationKnowledgePoint,
    graphContext: AgentConversationGraphContext
): AnchorNodeExclusion {
    const atomIds = new Set<string>([
        graphContext.anchorAtomId,
        ...pointAtomIds(anchorPoint),
    ].map((atomId) => String(atomId || '').trim()).filter(Boolean));
    const titles = new Set<string>([
        graphContext.anchorTitle,
        anchorPoint.title,
    ].map(normalizeGraphComparableTitle).filter(Boolean));
    return { atomIds, titles };
}

function isAnchorEquivalentNode(atomId: string, title: string, exclusion: AnchorNodeExclusion): boolean {
    const normalizedAtomId = String(atomId || '').trim();
    if (normalizedAtomId && exclusion.atomIds.has(normalizedAtomId)) {
        return true;
    }
    const normalizedTitle = normalizeGraphComparableTitle(title);
    return Boolean(normalizedTitle && exclusion.titles.has(normalizedTitle));
}

async function countUsableAdjacentNodes(
    opsStore: KnowledgeGraphOpsAdapter,
    edges: RelationEdge[],
    direction: 'predecessor' | 'successor',
    exclusion: AnchorNodeExclusion,
    titleCache: Map<string, string>
): Promise<number> {
    const seenNodeKeys = new Set<string>();
    for (const edge of edges) {
        const relatedAtomId = direction === 'predecessor'
            ? String(edge.sourceAtomId || '').trim()
            : String(edge.targetAtomId || '').trim();
        if (!relatedAtomId || exclusion.atomIds.has(relatedAtomId)) {
            continue;
        }
        const title = await resolveNodeTitle(opsStore, relatedAtomId, titleCache);
        if (!title || isAnchorEquivalentNode(relatedAtomId, title, exclusion)) {
            continue;
        }
        seenNodeKeys.add(relatedAtomId + '|' + normalizeGraphComparableTitle(title));
    }
    return seenNodeKeys.size;
}

function normalizeWhitespace(value: string): string {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function tokenize(value: string): string[] {
    return Array.from(new Set(
        normalizeWhitespace(String(value || '').toLowerCase())
            .replace(/[^\p{L}\p{N}\s_-]+/gu, ' ')
            .split(/\s+/)
            .map((token) => token.trim())
            .filter((token) => token.length >= 2)
    ));
}

function computeJaccard(left: string[], right: string[]): number {
    if (left.length <= 0 || right.length <= 0) {
        return 0;
    }
    const leftSet = new Set(left);
    const rightSet = new Set(right);
    let intersection = 0;
    leftSet.forEach((token) => {
        if (rightSet.has(token)) {
            intersection += 1;
        }
    });
    const union = leftSet.size + rightSet.size - intersection;
    if (union <= 0) {
        return 0;
    }
    return intersection / union;
}

function classifyConversationIntent(message: string): GraphContextAssemblyIntent {
    const normalized = normalizeWhitespace(String(message || '').toLowerCase());
    if (!normalized) {
        return 'generic';
    }
    if (
        normalized.includes('compare')
        || normalized.includes('difference')
        || normalized.includes('vs')
        || normalized.includes('区分')
        || normalized.includes('对比')
    ) {
        return 'compare';
    }
    if (
        normalized.includes('how to')
        || normalized.includes('how do')
        || normalized.includes('steps')
        || normalized.includes('plan')
        || normalized.includes('如何')
        || normalized.includes('怎么')
        || normalized.includes('步骤')
        || normalized.includes('方案')
    ) {
        return 'how_to';
    }
    if (
        normalized.includes('what is')
        || normalized.includes('why')
        || normalized.includes('explain')
        || normalized.includes('解释')
        || normalized.includes('什么是')
        || normalized.includes('为什么')
    ) {
        return 'explain';
    }
    return 'generic';
}

function clampInteger(value: number, minValue: number, maxValue: number): number {
    if (!Number.isFinite(value)) {
        return minValue;
    }
    return Math.max(minValue, Math.min(maxValue, Math.floor(value)));
}

function resolveBudget(intent: GraphContextAssemblyIntent, budget?: GraphContextAssemblyBudget): ResolvedAssemblyBudget {
    const defaultSupportNodes = intent === 'compare' || intent === 'how_to' ? 3 : 2;
    const defaultSuccessors = intent === 'how_to' ? 3 : intent === 'compare' ? 2 : 1;
    return {
        maxSupportNodes: clampInteger(Number(budget?.maxSupportNodes ?? defaultSupportNodes), 1, 6),
        maxConnectionPaths: clampInteger(Number(budget?.maxConnectionPaths ?? defaultSupportNodes), 1, 6),
        maxPathDepth: clampInteger(Number(budget?.maxPathDepth ?? 6), 2, 8),
        maxPredecessors: clampInteger(Number(budget?.maxPredecessors ?? 3), 0, 6),
        maxSuccessors: clampInteger(Number(budget?.maxSuccessors ?? defaultSuccessors), 0, 6),
    };
}

function pointAtomIds(point: AgentConversationKnowledgePoint): string[] {
    const groupedAtomIds = Array.isArray(point.atomIds) && point.atomIds.length > 0
        ? point.atomIds
        : [point.atomId];
    return groupedAtomIds
        .map((atomId) => String(atomId || '').trim())
        .filter(Boolean);
}

function pointTitleMentionScore(message: string, point: AgentConversationKnowledgePoint): number {
    const normalizedMessage = normalizeWhitespace(String(message || '').toLowerCase());
    const normalizedTitle = normalizeWhitespace(String(point.title || '').toLowerCase());
    if (!normalizedMessage || !normalizedTitle) {
        return 0;
    }
    if (normalizedMessage.includes(normalizedTitle)) {
        return 0.24;
    }
    return 0;
}

function selectAnchorPoint(message: string, knowledgePoints: AgentConversationKnowledgePoint[]): AnchorSelection {
    const queryTokens = tokenize(message);
    const ranked = knowledgePoints.map((point, index) => {
        const titleTokens = tokenize(point.title);
        const evidenceTokens = tokenize(`${point.summary || ''} ${point.evidenceSnippet || ''}`);
        const titleMentionScore = pointTitleMentionScore(message, point);
        const titleOverlapScore = computeJaccard(queryTokens, titleTokens) * 0.18;
        const evidenceOverlapScore = computeJaccard(queryTokens, evidenceTokens) * 0.08;
        const relationDensityScore = Math.min(Array.isArray(point.relationPath) ? point.relationPath.length : 0, 4) * 0.02;
        const temporalPenalty = point.temporalValidity?.isValid === false ? 0.18 : 0;
        const totalScore = Number((
            Number(point.score || 0)
            + titleMentionScore
            + titleOverlapScore
            + evidenceOverlapScore
            + relationDensityScore
            - temporalPenalty
        ).toFixed(6));
        const reason = titleMentionScore > 0
            ? 'title_mention'
            : titleOverlapScore > evidenceOverlapScore
                ? 'title_overlap'
                : temporalPenalty > 0
                    ? 'retrieval_score_with_temporal_penalty'
                    : 'retrieval_score';
        return {
            point,
            index,
            totalScore,
            reason,
        };
    });
    ranked.sort((left, right) => (
        right.totalScore - left.totalScore
        || left.index - right.index
    ));
    const best = ranked[0];
    return {
        point: best.point,
        index: best.index,
        reason: best.reason,
    };
}

function isDirectlyLinkedToAnchor(point: AgentConversationKnowledgePoint, anchorAtomIds: Set<string>): boolean {
    if (Array.isArray(point.relationPathAtomIds)) {
        for (const atomId of point.relationPathAtomIds) {
            if (anchorAtomIds.has(String(atomId || '').trim())) {
                return true;
            }
        }
    }
    if (Array.isArray(point.relationPath)) {
        for (const edge of point.relationPath) {
            const sourceAtomId = String(edge?.sourceAtomId || '').trim();
            const targetAtomId = String(edge?.targetAtomId || '').trim();
            if (anchorAtomIds.has(sourceAtomId) || anchorAtomIds.has(targetAtomId)) {
                return true;
            }
        }
    }
    return false;
}

function rankSupportPoints(
    message: string,
    intent: GraphContextAssemblyIntent,
    anchorPoint: AgentConversationKnowledgePoint,
    knowledgePoints: AgentConversationKnowledgePoint[],
    budget: ResolvedAssemblyBudget
): AgentConversationKnowledgePoint[] {
    const queryTokens = tokenize(message);
    const anchorAtomIdSet = new Set(pointAtomIds(anchorPoint));
    const ranked = knowledgePoints
        .filter((point) => point !== anchorPoint)
        .map((point, index) => {
            const titleTokens = tokenize(point.title);
            const evidenceTokens = tokenize(`${point.summary || ''} ${point.evidenceSnippet || ''}`);
            const directLinkScore = isDirectlyLinkedToAnchor(point, anchorAtomIdSet) ? 0.18 : 0;
            const titleOverlapScore = computeJaccard(queryTokens, titleTokens) * 0.08;
            const evidenceOverlapScore = computeJaccard(queryTokens, evidenceTokens) * 0.05;
            const compareBonus = intent === 'compare' ? 0.04 : 0;
            const temporalPenalty = point.temporalValidity?.isValid === false ? 0.12 : 0;
            const totalScore = Number((
                Number(point.score || 0)
                + directLinkScore
                + titleOverlapScore
                + evidenceOverlapScore
                + compareBonus
                - temporalPenalty
            ).toFixed(6));
            return {
                point,
                index,
                totalScore,
            };
        });
    ranked.sort((left, right) => (
        right.totalScore - left.totalScore
        || left.index - right.index
    ));
    return ranked
        .slice(0, budget.maxSupportNodes)
        .map((entry) => entry.point);
}

function buildBaseGraphContext(
    knowledgePoints: AgentConversationKnowledgePoint[]
): AgentConversationGraphContext | null {
    const anchorPoint = knowledgePoints[0];
    if (!anchorPoint) {
        return null;
    }

    const relationPath = knowledgePoints.flatMap((point) => (
        Array.isArray(point.relationPath)
            ? point.relationPath
            : []
    ));
    const relationKinds = Array.from(new Set(
        relationPath
            .map((edge) => edge.relationKind)
            .filter(Boolean)
    )) as RelationKind[];
    const relationSummaryMap = new Map<RelationKind, {
        edgeIds: Set<string>;
        sourceAtomIds: Set<string>;
        targetAtomIds: Set<string>;
        confidenceValues: number[];
    }>();
    const anchorAtomId = String(anchorPoint.atomId || '').trim();
    const atomToKnowledgePoint = new Map<string, {
        pointAtomId: string;
        title: string;
    }>();
    const knowledgePointAtomIds = new Set(
        knowledgePoints
            .flatMap((point) => pointAtomIds(point))
    );
    knowledgePoints.forEach((point) => {
        const pointTitle = normalizeWhitespace(String(point.title || '').trim());
        pointAtomIds(point).forEach((atomId) => {
            atomToKnowledgePoint.set(atomId, {
                pointAtomId: String(point.atomId || '').trim(),
                title: pointTitle || atomId,
            });
        });
    });
    const knowledgePointRelationMap = new Map<string, AgentConversationGraphKnowledgePointRelation>();

    relationPath.forEach((edge) => {
        if (!edge || !edge.relationKind) {
            return;
        }
        const summary = relationSummaryMap.get(edge.relationKind) || {
            edgeIds: new Set<string>(),
            sourceAtomIds: new Set<string>(),
            targetAtomIds: new Set<string>(),
            confidenceValues: [],
        };
        if (edge.edgeId) {
            summary.edgeIds.add(String(edge.edgeId));
        }
        const sourceAtomId = String(edge.sourceAtomId || '').trim();
        const targetAtomId = String(edge.targetAtomId || '').trim();
        if (sourceAtomId) {
            summary.sourceAtomIds.add(sourceAtomId);
        }
        const targetAtomIds = [
            sourceAtomId,
            targetAtomId,
        ]
            .filter(Boolean)
            .filter((atomId) => atomId !== anchorAtomId && !knowledgePointAtomIds.has(atomId));
        targetAtomIds.forEach((atomId) => summary.targetAtomIds.add(atomId));
        if (Number.isFinite(Number(edge.confidence))) {
            summary.confidenceValues.push(Number(edge.confidence));
        }
        if (sourceAtomId && targetAtomId) {
            const sourcePoint = atomToKnowledgePoint.get(sourceAtomId);
            const targetPoint = atomToKnowledgePoint.get(targetAtomId);
            if (
                sourcePoint
                && targetPoint
                && sourcePoint.pointAtomId
                && targetPoint.pointAtomId
                && sourcePoint.pointAtomId !== targetPoint.pointAtomId
            ) {
                const relationKey = [
                    String(edge.edgeId || '').trim(),
                    sourcePoint.pointAtomId,
                    targetPoint.pointAtomId,
                    edge.relationKind,
                ].join('|');
                knowledgePointRelationMap.set(relationKey, {
                    edgeId: String(edge.edgeId || '').trim(),
                    relationKind: edge.relationKind,
                    sourceAtomId: sourcePoint.pointAtomId,
                    sourceTitle: sourcePoint.title,
                    targetAtomId: targetPoint.pointAtomId,
                    targetTitle: targetPoint.title,
                    confidence: Number(Number(edge.confidence || 0).toFixed(4)),
                });
            }
        }
        relationSummaryMap.set(edge.relationKind, summary);
    });

    const relationSummaries: AgentConversationGraphRelationSummary[] = Array.from(relationSummaryMap.entries()).map(([relationKind, summary]) => ({
        relationKind,
        edgeIds: Array.from(summary.edgeIds.values()),
        sourceAtomIds: Array.from(summary.sourceAtomIds.values()),
        targetAtomIds: Array.from(summary.targetAtomIds.values()),
        averageConfidence: summary.confidenceValues.length > 0
            ? Number((summary.confidenceValues.reduce((sum, value) => sum + value, 0) / summary.confidenceValues.length).toFixed(4))
            : 0,
    }));

    const supportingAtomIds = Array.from(new Set(
        knowledgePoints.flatMap((point) => (
            Array.isArray(point.relationPathAtomIds)
                ? point.relationPathAtomIds
                : []
        ))
            .map((atomId) => String(atomId || '').trim())
            .filter(Boolean)
            .concat(relationSummaries.flatMap((summary) => summary.targetAtomIds))
    ));
    const supportingAtomIdSet = new Set(supportingAtomIds);
    const supportingTitles = knowledgePoints
        .filter((point, index) => index > 0 || supportingAtomIdSet.has(String(point.atomId || '').trim()))
        .map((point) => normalizeWhitespace(String(point.title || '').trim()))
        .filter(Boolean);

    const temporalCheckedAt = knowledgePoints
        .map((point) => String(point.temporalValidity && point.temporalValidity.checkedAt || '').trim())
        .filter(Boolean)
        .sort()
        .pop() || '';
    const invalidKnowledgePoints = knowledgePoints.filter((point) => point.temporalValidity && point.temporalValidity.isValid === false);
    const temporalDetails = knowledgePoints.flatMap((point) => (
        Array.isArray(point.temporalValidity && point.temporalValidity.details)
            ? point.temporalValidity!.details
            : []
    ));
    const warningReasons = Array.from(new Set(
        invalidKnowledgePoints.flatMap((point) => (
            Array.isArray(point.temporalValidity && point.temporalValidity.reasons)
                ? point.temporalValidity!.reasons
                : []
        ))
            .map((reason) => String(reason || '').trim())
            .filter(Boolean)
    ));
    const normalizedTemporalDetails = temporalDetails
        .filter((detail): detail is KnowledgeQueryTemporalDetail => Boolean(detail && typeof detail === 'object'));
    const temporalEdgeKinds = Array.from(new Set(
        normalizedTemporalDetails
            .map((detail) => detail.edgeKind)
            .filter(Boolean)
    ));
    const dedupedTemporalDetails = Array.from(new Map<string, KnowledgeQueryTemporalDetail>(
        normalizedTemporalDetails.map((detail) => [
            [
                String(detail.edgeId || '').trim(),
                String(detail.edgeKind || '').trim(),
                String(detail.sourceAtomId || '').trim(),
                String(detail.targetAtomId || '').trim(),
                String(detail.validFrom || '').trim(),
                String(detail.validTo || '').trim(),
            ].join('|'),
            {
                edgeId: String(detail.edgeId || '').trim(),
                edgeKind: detail.edgeKind,
                sourceAtomId: String(detail.sourceAtomId || '').trim(),
                targetAtomId: String(detail.targetAtomId || '').trim(),
                validFrom: String(detail.validFrom || '').trim(),
                validTo: detail.validTo ? String(detail.validTo).trim() : undefined,
                isActive: detail.isActive !== false,
            } satisfies KnowledgeQueryTemporalDetail,
        ])
    ).values());

    const temporalValidity: AgentConversationGraphTemporalContext = {
        checkedAt: temporalCheckedAt,
        allPointsValid: invalidKnowledgePoints.length <= 0,
        warningReasons,
        invalidKnowledgePointTitles: invalidKnowledgePoints
            .map((point) => normalizeWhitespace(String(point.title || '').trim()))
            .filter(Boolean),
        edgeKinds: temporalEdgeKinds,
        details: dedupedTemporalDetails,
    };

    return {
        anchorAtomId,
        anchorTitle: normalizeWhitespace(String(anchorPoint.title || '').trim()) || anchorAtomId,
        anchorDocumentId: anchorPoint.documentId,
        supportingAtomIds: Array.from(new Set(supportingAtomIds)),
        supportingTitles: Array.from(new Set(supportingTitles)),
        relationKinds,
        relationSummaries,
        knowledgePointRelations: Array.from(knowledgePointRelationMap.values()),
        temporalValidity,
    };
}

async function resolveNodeTitle(opsStore: KnowledgeGraphOpsAdapter, atomId: string, cache: Map<string, string>): Promise<string> {
    const normalizedAtomId = String(atomId || '').trim();
    if (!normalizedAtomId) {
        return '';
    }
    if (cache.has(normalizedAtomId)) {
        return String(cache.get(normalizedAtomId) || '').trim();
    }
    const atom = await opsStore.getNode(normalizedAtomId);
    const resolvedTitle = normalizeWhitespace(String(atom?.title || '').trim()) || normalizedAtomId;
    cache.set(normalizedAtomId, resolvedTitle);
    return resolvedTitle;
}

async function resolveNodeMetrics(
    opsStore: KnowledgeGraphOpsAdapter,
    atomId: string,
    cache: Map<string, CachedGraphNodeMetrics | null>
): Promise<CachedGraphNodeMetrics | null> {
    const normalizedAtomId = String(atomId || '').trim();
    if (!normalizedAtomId) {
        return null;
    }
    if (cache.has(normalizedAtomId)) {
        return cache.get(normalizedAtomId) || null;
    }
    const atom = await opsStore.getNode(normalizedAtomId);
    if (!atom) {
        cache.set(normalizedAtomId, null);
        return null;
    }
    const graphNode = atom as any;
    const metrics: CachedGraphNodeMetrics = {
        inDegree: Number.isFinite(Number(graphNode.inDegree)) ? Number(graphNode.inDegree) : undefined,
        outDegree: Number.isFinite(Number(graphNode.outDegree)) ? Number(graphNode.outDegree) : undefined,
        centrality: Number.isFinite(Number(graphNode.centrality)) ? Number(Number(graphNode.centrality).toFixed(4)) : undefined,
    };
    cache.set(normalizedAtomId, metrics);
    return metrics;
}

async function buildAnchorGraphProfile(
    opsStore: KnowledgeGraphOpsAdapter,
    anchorPoint: AgentConversationKnowledgePoint,
    titleCache: Map<string, string>,
    metricsCache: Map<string, CachedGraphNodeMetrics | null>,
    incomingEdges: RelationEdge[],
    outgoingEdges: RelationEdge[],
    exclusion: AnchorNodeExclusion,
    useCompleteNeighborhoodDegree: boolean
): Promise<AgentConversationGraphNodeProfile | undefined> {
    const anchorAtomId = String(anchorPoint.atomId || '').trim();
    if (!anchorAtomId) {
        return undefined;
    }
    const title = normalizeWhitespace(String(anchorPoint.title || '').trim())
        || await resolveNodeTitle(opsStore, anchorAtomId, titleCache)
        || anchorAtomId;
    const metrics = await resolveNodeMetrics(opsStore, anchorAtomId, metricsCache);
    const derivedInDegree = useCompleteNeighborhoodDegree
        ? await countUsableAdjacentNodes(opsStore, incomingEdges, 'predecessor', exclusion, titleCache)
        : undefined;
    const derivedOutDegree = useCompleteNeighborhoodDegree
        ? await countUsableAdjacentNodes(opsStore, outgoingEdges, 'successor', exclusion, titleCache)
        : undefined;
    return {
        atomId: anchorAtomId,
        title,
        inDegree: Number.isFinite(Number(derivedInDegree)) ? derivedInDegree : metrics?.inDegree,
        outDegree: Number.isFinite(Number(derivedOutDegree)) ? derivedOutDegree : metrics?.outDegree,
        centrality: metrics?.centrality,
    };
}

function rankRelationEdges(edges: RelationEdge[]): RelationEdge[] {
    return edges
        .slice()
        .sort((left, right) => (
            Number(right.confidence || 0) - Number(left.confidence || 0)
            || (left.provenance === 'fact' ? -1 : 1)
        ));
}

async function buildWindowNodes(
    opsStore: KnowledgeGraphOpsAdapter,
    edges: RelationEdge[],
    direction: 'predecessor' | 'successor',
    titleCache: Map<string, string>,
    metricsCache: Map<string, CachedGraphNodeMetrics | null>,
    exclusion: AnchorNodeExclusion,
    limit: number,
    missingIds: Set<string>
): Promise<AgentConversationGraphWindowNode[]> {
    const rankedEdges = rankRelationEdges(edges);
    const nodes: AgentConversationGraphWindowNode[] = [];
    const seenNodeKeys = new Set<string>();
    for (const edge of rankedEdges) {
        if (nodes.length >= limit) {
            break;
        }
        const relatedAtomId = direction === 'predecessor'
            ? String(edge.sourceAtomId || '').trim()
            : String(edge.targetAtomId || '').trim();
        if (!relatedAtomId || exclusion.atomIds.has(relatedAtomId)) {
            continue;
        }
        const title = await resolveNodeTitle(opsStore, relatedAtomId, titleCache);
        if (!title) {
            missingIds.add(relatedAtomId);
            continue;
        }
        if (isAnchorEquivalentNode(relatedAtomId, title, exclusion)) {
            continue;
        }
        const nodeKey = relatedAtomId + '|' + normalizeGraphComparableTitle(title);
        if (seenNodeKeys.has(nodeKey)) {
            continue;
        }
        seenNodeKeys.add(nodeKey);
        const metrics = await resolveNodeMetrics(opsStore, relatedAtomId, metricsCache);
        nodes.push({
            atomId: relatedAtomId,
            title,
            relationKind: edge.relationKind,
            confidence: Number(Number(edge.confidence || 0).toFixed(4)),
            inDegree: metrics?.inDegree,
            outDegree: metrics?.outDegree,
            centrality: metrics?.centrality,
        });
    }
    return nodes;
}

async function buildConnectionPaths(
    opsStore: KnowledgeGraphOpsAdapter,
    anchorPoint: AgentConversationKnowledgePoint,
    supportPoints: AgentConversationKnowledgePoint[],
    budget: ResolvedAssemblyBudget,
    titleCache: Map<string, string>,
    missingSourceAtomIds: Set<string>
): Promise<AgentConversationGraphConnectionPath[]> {
    const anchorAtomId = String(anchorPoint.atomId || '').trim();
    if (!anchorAtomId) {
        return [];
    }
    const connectionPaths: AgentConversationGraphConnectionPath[] = [];
    for (const point of supportPoints.slice(0, budget.maxConnectionPaths)) {
        let pathResult: PathQueryResult | null = null;
        let resolvedSourceAtomId = '';
        for (const sourceAtomId of pointAtomIds(point)) {
            if (!sourceAtomId || sourceAtomId === anchorAtomId) {
                continue;
            }
            const nextPathResult = await opsStore.findPath(sourceAtomId, anchorAtomId, budget.maxPathDepth);
            if (nextPathResult.found && Array.isArray(nextPathResult.path) && nextPathResult.path.length > 1) {
                pathResult = nextPathResult;
                resolvedSourceAtomId = sourceAtomId;
                break;
            }
        }
        if (!pathResult || !resolvedSourceAtomId) {
            missingSourceAtomIds.add(String(point.atomId || '').trim());
            continue;
        }
        const pathAtomIds = pathResult.path
            .map((atomId) => String(atomId || '').trim())
            .filter(Boolean);
        const pathTitles = [];
        for (const atomId of pathAtomIds) {
            pathTitles.push(await resolveNodeTitle(opsStore, atomId, titleCache));
        }
        connectionPaths.push({
            sourceAtomId: resolvedSourceAtomId,
            sourceTitle: normalizeWhitespace(String(point.title || '').trim()) || resolvedSourceAtomId,
            targetAtomId: anchorAtomId,
            targetTitle: normalizeWhitespace(String(anchorPoint.title || '').trim()) || anchorAtomId,
            pathAtomIds,
            pathTitles,
            pathEdges: Array.isArray(pathResult.edges)
                ? pathResult.edges.map((edge) => ({
                    fromAtomId: String(edge.from || '').trim(),
                    toAtomId: String(edge.to || '').trim(),
                    relationKind: edge.relation as RelationKind | undefined,
                }))
                : [],
            length: Math.max(0, Math.floor(Number(pathResult.length || 0))),
        });
    }
    return connectionPaths;
}

function buildEvidenceSourceRefs(points: AgentConversationKnowledgePoint[]): string[] {
    const refs = new Set<string>();
    const appendCitation = (citation: KnowledgeCitation | null | undefined) => {
        const sourcePath = normalizeWhitespace(String(citation?.sourcePath || '').trim());
        if (!sourcePath) {
            return;
        }
        const startLine = Number(citation?.startLine);
        refs.add(Number.isFinite(startLine) && startLine > 0 ? `${sourcePath}:${startLine}` : sourcePath);
    };
    points.forEach((point) => {
        appendCitation(point.citation || null);
        if (Array.isArray(point.citations)) {
            point.citations.forEach((citation) => appendCitation(citation));
        }
        if (Array.isArray(point.matchedSpans)) {
            point.matchedSpans.forEach((span) => {
                const sourcePath = normalizeWhitespace(String(span.sourcePath || '').trim());
                if (!sourcePath) {
                    return;
                }
                const startLine = Number(span.startLine);
                refs.add(Number.isFinite(startLine) && startLine > 0 ? `${sourcePath}:${startLine}` : sourcePath);
            });
        }
    });
    return Array.from(refs.values()).slice(0, 6);
}

function buildDiagnostics(
    graphOpsAvailable: boolean,
    anchorReason: string,
    candidateCount: number,
    supportNodeCount: number,
    budget: ResolvedAssemblyBudget,
    missingConnectionPathSourceAtomIds: Set<string>,
    missingPredecessorAtomIds: Set<string>,
    missingSuccessorAtomIds: Set<string>
): AgentConversationGraphDiagnostics {
    return {
        graphOpsAvailable,
        usedFallback: !graphOpsAvailable,
        selectedAnchorReason: anchorReason,
        candidateCount,
        supportNodeCount,
        supportNodeLimit: budget.maxSupportNodes,
        pathDepthLimit: budget.maxPathDepth,
        missingConnectionPathSourceAtomIds: Array.from(missingConnectionPathSourceAtomIds.values()),
        missingPredecessorAtomIds: Array.from(missingPredecessorAtomIds.values()),
        missingSuccessorAtomIds: Array.from(missingSuccessorAtomIds.values()),
    };
}

export async function assembleAgentConversationGraphContext(
    params: GraphContextAssemblyParams
): Promise<GraphContextAssemblyResult> {
    const knowledgePoints = Array.isArray(params.knowledgePoints)
        ? params.knowledgePoints.filter((point) => Boolean(point && typeof point === 'object'))
        : [];
    if (knowledgePoints.length <= 0) {
        return {
            knowledgePoints: [],
            graphContext: null,
        };
    }

    const intent = classifyConversationIntent(params.message);
    const budget = resolveBudget(intent, params.budget);
    const anchorSelection = selectAnchorPoint(params.message, knowledgePoints);
    const anchorPoint = anchorSelection.point;
    const supportPoints = rankSupportPoints(params.message, intent, anchorPoint, knowledgePoints, budget);
    const supportAtomIdSet = new Set(supportPoints.map((point) => String(point.atomId || '').trim()).filter(Boolean));
    const orderedKnowledgePoints = [
        anchorPoint,
        ...knowledgePoints.filter((point) => supportAtomIdSet.has(String(point.atomId || '').trim()) && point !== anchorPoint),
        ...knowledgePoints.filter((point) => point !== anchorPoint && !supportAtomIdSet.has(String(point.atomId || '').trim())),
    ];
    const contextPoints = orderedKnowledgePoints.slice(0, 1 + budget.maxSupportNodes);
    const baseGraphContext = buildBaseGraphContext(contextPoints);
    if (!baseGraphContext) {
        return {
            knowledgePoints: orderedKnowledgePoints,
            graphContext: null,
        };
    }

    const evidenceSourceRefs = buildEvidenceSourceRefs(contextPoints);
    if (!params.store || !isOpsAdapter(params.store)) {
        return {
            knowledgePoints: orderedKnowledgePoints,
            graphContext: {
                ...baseGraphContext,
                evidenceSourceRefs,
                diagnostics: buildDiagnostics(
                    false,
                    anchorSelection.reason,
                    knowledgePoints.length,
                    supportPoints.length,
                    budget,
                    new Set<string>(),
                    new Set<string>(),
                    new Set<string>()
                ),
            },
        };
    }

    const opsStore = params.store;
    const titleCache = new Map<string, string>();
    const metricsCache = new Map<string, CachedGraphNodeMetrics | null>();
    orderedKnowledgePoints.forEach((point) => {
        pointAtomIds(point).forEach((atomId) => {
            titleCache.set(atomId, normalizeWhitespace(String(point.title || '').trim()) || atomId);
        });
    });

    const missingConnectionPathSourceAtomIds = new Set<string>();
    const missingPredecessorAtomIds = new Set<string>();
    const missingSuccessorAtomIds = new Set<string>();
    const connectionPaths = await buildConnectionPaths(
        opsStore,
        anchorPoint,
        supportPoints,
        budget,
        titleCache,
        missingConnectionPathSourceAtomIds
    );
    const anchorExclusion = buildAnchorNodeExclusion(anchorPoint, baseGraphContext);
    const capabilities = opsStore.getCapabilities();
    const useCompleteNeighborhoodDegree = capabilities.serverSideQuery !== true;
    const predecessorEdgeLimit = Math.max(budget.maxPredecessors * 8, 24);
    const successorEdgeLimit = Math.max(budget.maxSuccessors * 8, 24);
    const predecessorEdges = useCompleteNeighborhoodDegree || budget.maxPredecessors > 0
        ? await opsStore.queryEdges(useCompleteNeighborhoodDegree
            ? { toNodeId: baseGraphContext.anchorAtomId }
            : { toNodeId: baseGraphContext.anchorAtomId, limit: predecessorEdgeLimit })
        : [];
    const successorEdges = useCompleteNeighborhoodDegree || budget.maxSuccessors > 0
        ? await opsStore.queryEdges(useCompleteNeighborhoodDegree
            ? { fromNodeId: baseGraphContext.anchorAtomId }
            : { fromNodeId: baseGraphContext.anchorAtomId, limit: successorEdgeLimit })
        : [];
    const predecessorWindow = budget.maxPredecessors > 0
        ? await buildWindowNodes(
            opsStore,
            predecessorEdges,
            'predecessor',
            titleCache,
            metricsCache,
            anchorExclusion,
            budget.maxPredecessors,
            missingPredecessorAtomIds
        )
        : [];
    const successorWindow = budget.maxSuccessors > 0
        ? await buildWindowNodes(
            opsStore,
            successorEdges,
            'successor',
            titleCache,
            metricsCache,
            anchorExclusion,
            budget.maxSuccessors,
            missingSuccessorAtomIds
        )
        : [];
    const anchorGraphProfile = await buildAnchorGraphProfile(
        opsStore,
        anchorPoint,
        titleCache,
        metricsCache,
        predecessorEdges,
        successorEdges,
        anchorExclusion,
        useCompleteNeighborhoodDegree
    );

    return {
        knowledgePoints: orderedKnowledgePoints,
        graphContext: {
            ...baseGraphContext,
            anchorGraphProfile,
            connectionPaths,
            predecessorWindow,
            successorWindow,
            evidenceSourceRefs,
            diagnostics: buildDiagnostics(
                true,
                anchorSelection.reason,
                knowledgePoints.length,
                supportPoints.length,
                budget,
                missingConnectionPathSourceAtomIds,
                missingPredecessorAtomIds,
                missingSuccessorAtomIds
            ),
        },
    };
}

export function buildAgentConversationGraphContextFromKnowledgePoints(
    knowledgePoints: AgentConversationKnowledgePoint[]
): AgentConversationGraphContext | null {
    return buildBaseGraphContext(knowledgePoints);
}
