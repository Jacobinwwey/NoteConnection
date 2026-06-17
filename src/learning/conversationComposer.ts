import type {
    AgentConversationAssistantBlock,
    AgentConversationGraphConnectionPath,
    AgentConversationGraphContext,
    AgentConversationGraphKnowledgePointRelation,
    AgentConversationGraphRelationSummary,
    AgentConversationKnowledgePoint,
    AgentConversationMemoryAction,
    AgentConversationMemoryRecord,
    KnowledgeQueryTemporalDetail,
    KnowledgeAtom,
    KnowledgeCitation,
    KnowledgeQueryItem,
    KnowledgeQueryResolvedScope,
    RelationKind,
    KnowledgeRun,
    KnowledgeRunEvidenceClaim,
    KnowledgeRunQuality,
    KnowledgeRunQualityGate,
    KnowledgeRunQualityStatus,
    KnowledgeRunReviewCard,
    KnowledgeRunReviewState,
} from './types';

export type BuildAgentWorkspaceCapabilities = (atomId: string) => unknown[];

export type ScopedConversationReplyParams = {
    message: string;
    knowledgePoints: AgentConversationKnowledgePoint[];
    citations: KnowledgeCitation[];
    recalledMemories: AgentConversationMemoryRecord[];
    memoryActions: AgentConversationMemoryAction[];
    usedScope: KnowledgeQueryResolvedScope;
    generatedAt?: string;
    nextBlockId: () => string;
    nextRunId?: () => string;
    graphContext?: AgentConversationGraphContext | null;
};

function buildAgentConversationGraphContext(
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
            .flatMap((point) => (
                Array.isArray(point.atomIds) && point.atomIds.length > 0
                    ? point.atomIds
                    : [point.atomId]
            ))
            .map((atomId) => String(atomId || '').trim())
            .filter(Boolean)
    );
    knowledgePoints.forEach((point) => {
        const pointTitle = normalizeWhitespace(String(point.title || '').trim());
        const groupedAtomIds = Array.isArray(point.atomIds) && point.atomIds.length > 0
            ? point.atomIds
            : [point.atomId];
        groupedAtomIds
            .map((atomId) => String(atomId || '').trim())
            .filter(Boolean)
            .forEach((atomId) => {
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

    return {
        anchorAtomId,
        anchorTitle: normalizeWhitespace(String(anchorPoint.title || '').trim()) || anchorAtomId,
        anchorDocumentId: anchorPoint.documentId,
        supportingAtomIds: Array.from(new Set(supportingAtomIds)),
        supportingTitles: Array.from(new Set(supportingTitles)),
        relationKinds,
        relationSummaries,
        knowledgePointRelations: Array.from(knowledgePointRelationMap.values()),
        temporalValidity: {
            checkedAt: temporalCheckedAt,
            allPointsValid: invalidKnowledgePoints.length <= 0,
            warningReasons,
            invalidKnowledgePointTitles: invalidKnowledgePoints
                .map((point) => normalizeWhitespace(String(point.title || '').trim()))
                .filter(Boolean),
            edgeKinds: temporalEdgeKinds,
            details: dedupedTemporalDetails,
        },
    };
}

function normalizeWhitespace(value: string): string {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function humanizeRelationKind(value: RelationKind | string): string {
    return normalizeWhitespace(String(value || '').replace(/_/g, ' '));
}

function formatGraphConnectionPath(connectionPath: AgentConversationGraphConnectionPath): string {
    const titles = Array.isArray(connectionPath.pathTitles)
        ? connectionPath.pathTitles.map((title) => normalizeWhitespace(String(title || '').trim())).filter(Boolean)
        : [];
    const edges = Array.isArray(connectionPath.pathEdges)
        ? connectionPath.pathEdges
        : [];
    if (titles.length <= 1 || edges.length <= 0) {
        return titles.join(' -> ');
    }
    const segments: string[] = [titles[0]];
    edges.forEach((edge, index) => {
        const nextTitle = titles[index + 1];
        if (!nextTitle) {
            return;
        }
        segments.push(humanizeRelationKind(edge && edge.relationKind ? edge.relationKind : 'link'), nextTitle);
    });
    return segments.join(' -> ');
}

function clampUnit(value: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Number(Math.max(0, Math.min(1, value)).toFixed(4));
}

function addDaysIso(value: string, days: number): string {
    const parsed = Date.parse(value);
    const baseTimestamp = Number.isFinite(parsed) ? parsed : 0;
    return new Date(baseTimestamp + days * 24 * 60 * 60 * 1000).toISOString();
}

function buildFallbackKnowledgeRunId(params: ScopedConversationReplyParams, generatedAt: string): string {
    const seed = [
        generatedAt,
        params.message,
        params.usedScope.workspaceId || '',
        params.usedScope.corpusId || '',
        params.citations.map((citation) => citation.citationId).join('|'),
    ].join('|');
    let hash = 0;
    for (let index = 0; index < seed.length; index += 1) {
        hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0;
    }
    return `knowledge_run_${Math.abs(hash) || 1}`;
}

function escapeRegExpLiteral(value: string): string {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildKnowledgeCitation(item: KnowledgeQueryItem, index: number): KnowledgeCitation {
    const atom = item.atom;
    const evidence = item.evidenceSpans[0];
    return {
        citationId: String(evidence?.id || `citation_${atom.id}_${index + 1}`).trim(),
        atomId: atom.id,
        documentId: atom.documentId,
        sourcePath: atom.sourcePath,
        title: atom.title,
        snippet: normalizeWhitespace(String(
            evidence?.snippet
            || atom.content
            || atom.title
            || ''
        ).slice(0, 280)),
        startLine: evidence?.startLine,
        endLine: evidence?.endLine,
        score: Number(Number(item.score || 0).toFixed(4)),
    };
}

function buildAgentConversationKnowledgePoint(
    item: KnowledgeQueryItem,
    index: number,
    buildCapabilities: BuildAgentWorkspaceCapabilities
): AgentConversationKnowledgePoint {
    const atom = item.atom;
    const citation = buildKnowledgeCitation(item, index);
    const summary = normalizeWhitespace(String(atom.content || atom.title || '').slice(0, 240)) || atom.title;
    return {
        atomId: atom.id,
        atomIds: [atom.id],
        documentId: atom.documentId,
        sourcePath: atom.sourcePath,
        title: atom.title,
        summary,
        evidenceSnippet: citation.snippet || summary || atom.title,
        score: Number(Number(item.score || 0).toFixed(4)),
        citation,
        citations: citation ? [citation] : [],
        matchedSpans: [
            {
                atomId: atom.id,
                title: atom.title,
                snippet: citation.snippet || summary || atom.title,
                sourcePath: atom.sourcePath,
                startLine: citation.startLine,
                endLine: citation.endLine,
                score: Number(Number(item.score || 0).toFixed(4)),
                citation,
            },
        ],
        matchCount: 1,
        relationPath: item.relationPath.map((edge) => ({
            edgeId: edge.id,
            sourceAtomId: edge.sourceAtomId,
            targetAtomId: edge.targetAtomId,
            relationKind: edge.relationKind,
            confidence: Number(Number(edge.confidence || 0).toFixed(4)),
        })),
        relationPathAtomIds: Array.from(new Set(
            item.relationPath.flatMap((edge) => [edge.sourceAtomId, edge.targetAtomId])
        )).filter((atomId) => atomId !== atom.id),
        relationKinds: Array.from(new Set(item.relationPath.map((edge) => edge.relationKind))),
        temporalValidity: {
            isValid: item.temporalValidity.isValid,
            checkedAt: item.temporalValidity.checkedAt,
            reasons: [...item.temporalValidity.reasons],
            details: Array.isArray(item.temporalValidity.details)
                ? item.temporalValidity.details.map((detail) => ({ ...detail }))
                : [],
        },
        capabilities: buildCapabilities(atom.id),
    };
}

type KnowledgePointGroup = {
    point: AgentConversationKnowledgePoint;
    atomIds: Set<string>;
    citationKeys: Set<string>;
    spanKeys: Set<string>;
    relationEdgeIds: Set<string>;
    relationPathAtomIds: Set<string>;
    relationKinds: Set<RelationKind>;
    temporalValidityCheckedAt: string;
    temporalValidityReasons: Set<string>;
    temporalValidityDetails: Map<string, KnowledgeQueryTemporalDetail>;
};

export function mergeAgentConversationKnowledgePoints(
    items: KnowledgeQueryItem[],
    buildCapabilities: BuildAgentWorkspaceCapabilities
): AgentConversationKnowledgePoint[] {
    const groups = new Map<string, KnowledgePointGroup>();

    items.forEach((item, index) => {
        const atom = item.atom;
        const groupKey = String(atom.documentId || atom.id || `atom_${index}`).trim();
        const citation = buildKnowledgeCitation(item, index);
        const snippet = citation.snippet
            || normalizeWhitespace(String(atom.content || atom.title || '').slice(0, 280))
            || atom.title;
        let group = groups.get(groupKey);
        if (!group) {
            const point = buildAgentConversationKnowledgePoint(item, index, buildCapabilities);
            point.citation = citation;
            point.citations = [];
            point.matchedSpans = [];
            point.atomIds = [];
            point.matchCount = 0;
            point.relationPath = [];
            point.relationPathAtomIds = [];
            point.relationKinds = [];
            point.temporalValidity = undefined;
            group = {
                point,
                atomIds: new Set<string>(),
                citationKeys: new Set<string>(),
                spanKeys: new Set<string>(),
                relationEdgeIds: new Set<string>(),
                relationPathAtomIds: new Set<string>(),
                relationKinds: new Set<RelationKind>(),
                temporalValidityCheckedAt: String(item.temporalValidity.checkedAt || ''),
                temporalValidityReasons: new Set<string>(),
                temporalValidityDetails: new Map<string, KnowledgeQueryTemporalDetail>(),
            };
            groups.set(groupKey, group);
        }

        group.atomIds.add(atom.id);
        group.point.atomIds = Array.from(group.atomIds.values());
        group.point.score = Math.max(group.point.score, Number(Number(item.score || 0).toFixed(4)));

        const citationKey = [
            citation.documentId,
            citation.sourcePath,
            citation.startLine || '',
            citation.endLine || '',
            citation.snippet,
        ].join('|');
        if (!group.citationKeys.has(citationKey)) {
            group.citationKeys.add(citationKey);
            group.point.citations = [...(group.point.citations || []), citation];
            if (!group.point.citation) {
                group.point.citation = citation;
            }
        }

        const spanKey = [
            atom.id,
            citation.startLine || '',
            citation.endLine || '',
            snippet,
        ].join('|');
        if (!group.spanKeys.has(spanKey)) {
            group.spanKeys.add(spanKey);
            group.point.matchedSpans = [
                ...(group.point.matchedSpans || []),
                {
                    atomId: atom.id,
                    title: atom.title,
                    snippet,
                    sourcePath: atom.sourcePath,
                    startLine: citation.startLine,
                    endLine: citation.endLine,
                    score: Number(Number(item.score || 0).toFixed(4)),
                    citation,
                },
            ];
            group.point.matchCount = group.point.matchedSpans.length;
        }

        const relationPath = Array.isArray(item.relationPath) ? item.relationPath : [];
        relationPath.forEach((edge) => {
            const edgeId = String(edge && edge.id || '').trim();
            if (!edgeId) {
                return;
            }
            if (!Array.isArray(group.point.relationPath)) {
                group.point.relationPath = [];
            }
            if (!group.relationEdgeIds.has(edgeId)) {
                group.relationEdgeIds.add(edgeId);
                group.point.relationPath.push({
                    edgeId,
                    sourceAtomId: String(edge.sourceAtomId || '').trim(),
                    targetAtomId: String(edge.targetAtomId || '').trim(),
                    relationKind: edge.relationKind,
                    confidence: Number(Number(edge.confidence || 0).toFixed(4)),
                });
            }
            [edge.sourceAtomId, edge.targetAtomId]
                .map((candidateAtomId) => String(candidateAtomId || '').trim())
                .filter(Boolean)
                .filter((candidateAtomId) => !group.atomIds.has(candidateAtomId))
                .forEach((candidateAtomId) => group.relationPathAtomIds.add(candidateAtomId));
            if (edge.relationKind) {
                group.relationKinds.add(edge.relationKind);
            }
        });

        const temporalValidity = item.temporalValidity && typeof item.temporalValidity === 'object'
            ? item.temporalValidity
            : null;
        if (temporalValidity) {
            const checkedAt = String(temporalValidity.checkedAt || '').trim();
            if (checkedAt && checkedAt > group.temporalValidityCheckedAt) {
                group.temporalValidityCheckedAt = checkedAt;
            }
            if (temporalValidity.isValid === false) {
                group.point.temporalValidity = group.point.temporalValidity || {
                    isValid: true,
                    checkedAt: checkedAt,
                    reasons: [],
                    details: [],
                };
                group.point.temporalValidity.isValid = false;
            }
            if (!group.point.temporalValidity) {
                group.point.temporalValidity = {
                    isValid: temporalValidity.isValid !== false,
                    checkedAt,
                    reasons: [],
                    details: [],
                };
            } else if (temporalValidity.isValid === false) {
                group.point.temporalValidity.isValid = false;
            }
            (Array.isArray(temporalValidity.reasons) ? temporalValidity.reasons : [])
                .map((reason) => String(reason || '').trim())
                .filter(Boolean)
                .forEach((reason) => group.temporalValidityReasons.add(reason));
            (Array.isArray(temporalValidity.details) ? temporalValidity.details : [])
                .filter((detail): detail is KnowledgeQueryTemporalDetail => Boolean(detail && typeof detail === 'object'))
                .forEach((detail) => {
                    const detailKey = [
                        String(detail.edgeId || '').trim(),
                        String(detail.edgeKind || '').trim(),
                        String(detail.sourceAtomId || '').trim(),
                        String(detail.targetAtomId || '').trim(),
                        String(detail.validFrom || '').trim(),
                        String(detail.validTo || '').trim(),
                    ].join('|');
                    if (!group.temporalValidityDetails.has(detailKey)) {
                        group.temporalValidityDetails.set(detailKey, {
                            edgeId: String(detail.edgeId || '').trim(),
                            edgeKind: detail.edgeKind,
                            sourceAtomId: String(detail.sourceAtomId || '').trim(),
                            targetAtomId: String(detail.targetAtomId || '').trim(),
                            validFrom: String(detail.validFrom || '').trim(),
                            validTo: detail.validTo ? String(detail.validTo).trim() : undefined,
                            isActive: detail.isActive !== false,
                        });
                    }
                });
        }

    });

    return Array.from(groups.values()).map((group) => {
        const citations = group.point.citations || [];
        const spans = group.point.matchedSpans || [];
        return {
            ...group.point,
            citation: group.point.citation || citations[0] || null,
            citations,
            matchedSpans: spans,
            matchCount: spans.length,
            evidenceSnippet: spans[0]?.snippet || group.point.evidenceSnippet,
            relationPath: Array.isArray(group.point.relationPath) ? group.point.relationPath : [],
            relationPathAtomIds: Array.from(group.relationPathAtomIds.values()),
            relationKinds: Array.from(group.relationKinds.values()),
            temporalValidity: group.point.temporalValidity
                ? {
                    isValid: group.point.temporalValidity.isValid !== false,
                    checkedAt: group.temporalValidityCheckedAt || group.point.temporalValidity.checkedAt,
                    reasons: Array.from(group.temporalValidityReasons.values()),
                    details: Array.from(group.temporalValidityDetails.values()),
                }
                : undefined,
        };
    });
}

export function collectAgentConversationAtomIds(knowledgePoints: AgentConversationKnowledgePoint[]): string[] {
    const atomIds = new Set<string>();
    knowledgePoints.forEach((point) => {
        const groupedAtomIds = Array.isArray(point.atomIds) && point.atomIds.length > 0
            ? point.atomIds
            : [point.atomId];
        groupedAtomIds
            .map((atomId) => String(atomId || '').trim())
            .filter(Boolean)
            .forEach((atomId) => atomIds.add(atomId));
    });
    return Array.from(atomIds.values());
}

function cleanConversationAnswerCandidate(value: string, point: AgentConversationKnowledgePoint): string {
    let cleaned = String(value || '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[*_~`>#|]/g, ' ')
        .trim();
    const title = normalizeWhitespace(String(point.title || '').replace(/[#*_~`]/g, ' '));
    if (title) {
        cleaned = cleaned
            .replace(new RegExp(`^${escapeRegExpLiteral(title)}\\s*(?:[:\\uFF1A.\\-\\u2014]|\\r?\\n)+\\s*`, 'i'), '')
            .trim();
        const flattenedHeadingMatch = cleaned.match(new RegExp(`^${escapeRegExpLiteral(title)}\\s+(.+)$`, 'i'));
        if (flattenedHeadingMatch) {
            const remainder = normalizeWhitespace(flattenedHeadingMatch[1] || '');
            const titleWordCount = title.split(/\s+/).filter(Boolean).length;
            const repeatsTitle = new RegExp(`^${escapeRegExpLiteral(title)}(?:\\b|\\s)`, 'i').test(remainder);
            const startsWithArticle = /^(?:a|an|the)\s+/i.test(remainder);
            if (repeatsTitle || (titleWordCount > 1 && startsWithArticle)) {
                cleaned = remainder;
            }
        }
    }
    return normalizeWhitespace(cleaned);
}

function selectScopedConversationDirectSentence(message: string, point: AgentConversationKnowledgePoint): string {
    const candidates = [
        ...(Array.isArray(point.matchedSpans) ? point.matchedSpans.map((span) => span.snippet) : []),
        point.summary,
        point.evidenceSnippet,
    ]
        .map((candidate) => cleanConversationAnswerCandidate(String(candidate || ''), point))
        .filter(Boolean);
    for (const candidate of candidates) {
        const sentences = candidate.match(/[^.!?\u3002\uFF01\uFF1F]+[.!?\u3002\uFF01\uFF1F]?/g) || [candidate];
        const directSentence = sentences
            .map((sentence) => normalizeWhitespace(sentence))
            .find((sentence) => {
                const lower = sentence.toLowerCase();
                return (
                    lower.includes(' is ')
                    || lower.includes(' are ')
                    || lower.includes(' refers to ')
                    || lower.includes(' means ')
                    || sentence.includes('是')
                    || sentence.includes('指')
                ) && sentence.length >= 12;
            });
        if (directSentence) {
            return directSentence;
        }
        const firstSentence = normalizeWhitespace(sentences[0] || '');
        if (firstSentence.length >= 12) {
            return firstSentence;
        }
    }
    return normalizeWhitespace(String(point.summary || point.evidenceSnippet || point.title || message || ''));
}

function classifyScopedConversationIntent(message: string): 'explain' | 'compare' | 'how_to' | 'generic' {
    const normalized = String(message || '').trim().toLowerCase();
    if (!normalized) {
        return 'generic';
    }
    if (
        normalized.includes('compare')
        || normalized.includes('difference')
        || normalized.includes('vs')
        || normalized.includes('区别')
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

function buildScopedConversationAnswer(params: ScopedConversationReplyParams): string {
    if (params.knowledgePoints.length <= 0) {
        const readinessMessage = String(params.usedScope.readiness?.message || '').trim();
        const missMessage = String(params.usedScope.missDiagnostics?.message || '').trim();
        if (params.recalledMemories.length > 0) {
            return `No scoped knowledge points matched "${params.message || 'your query'}", but I recovered ${params.recalledMemories.length} relevant conversation memory note(s). ${missMessage || readinessMessage || 'Refine the corpus scope or use the recalled memory as a follow-up anchor.'}`;
        }
        return `No scoped knowledge points matched "${params.message || 'your query'}". ${missMessage || readinessMessage || 'Refine the scope, add more notes to the corpus, or broaden the query terms.'}`;
    }

    const leadingPoint = params.knowledgePoints[0];
    const directSentence = selectScopedConversationDirectSentence(params.message, leadingPoint);
    if (directSentence) {
        return directSentence;
    }
    const title = normalizeWhitespace(String(leadingPoint.title || '').trim());
    const fallback = normalizeWhitespace(String(leadingPoint.evidenceSnippet || leadingPoint.summary || '').trim());
    if (title && fallback && title !== fallback) {
        return `${title}: ${fallback}`;
    }
    return fallback || title || normalizeWhitespace(String(params.message || ''));
}

function buildScopedConversationOverviewMarkdown(
    params: ScopedConversationReplyParams,
    graphContext: AgentConversationGraphContext | null
): string {
    const strongestPoint = params.knowledgePoints[0];
    const lines = [
        '## Answer Context',
        '',
    ];
    if (strongestPoint) {
        lines.push(`Best scoped anchor: **${strongestPoint.title}**.`, '');
    } else {
        lines.push('No scoped knowledge point produced a strong match for the current request.', '');
    }
    lines.push(
        `- Relevant knowledge points: **${params.knowledgePoints.length}**`,
        `- Citations returned: **${params.citations.length}**`,
        `- Scoped memories recalled: **${params.recalledMemories.length}**`
    );
    if (graphContext && graphContext.relationKinds.length > 0) {
        lines.push(
            `- Graph-supported relations: **${graphContext.relationKinds.join(', ')}**`
        );
    }
    if (graphContext) {
        lines.push(
            `- Temporal validity: **${graphContext.temporalValidity.allPointsValid ? 'valid' : 'warning'}**`
        );
    }
    if (graphContext && Array.isArray(graphContext.connectionPaths) && graphContext.connectionPaths.length > 0) {
        lines.push(`- Explicit connection paths: **${graphContext.connectionPaths.length}**`);
    }
    return lines.join('\n');
}

function buildScopedConversationExplanationMarkdown(
    params: ScopedConversationReplyParams,
    graphContext: AgentConversationGraphContext | null
): string {
    if (params.knowledgePoints.length <= 0) {
        return '## Explanation\n\nThe current scope did not return a strong enough knowledge point to explain the request directly.';
    }
    const intent = classifyScopedConversationIntent(params.message);
    const strongestPoint = params.knowledgePoints[0];
    const explanationLines = [
        '## Explanation',
        '',
    ];
    if (intent === 'compare') {
        explanationLines.push(`Use **${strongestPoint.title}** as the comparison baseline inside the current scope.`);
    } else if (intent === 'how_to') {
        explanationLines.push(`Use **${strongestPoint.title}** as the starting anchor for the next concrete steps.`);
    } else if (intent === 'explain') {
        explanationLines.push(`**${strongestPoint.title}** is the current best scoped anchor for the explanation.`);
    } else {
        explanationLines.push(`**${strongestPoint.title}** is the current best scoped anchor.`);
    }
    const summary = normalizeWhitespace(String(strongestPoint.summary || strongestPoint.evidenceSnippet || '').trim());
    if (summary) {
        explanationLines.push('', summary);
    }
    if (graphContext && graphContext.relationKinds.length > 0) {
        explanationLines.push(
            '',
            `Graph support around **${graphContext.anchorTitle}** includes: ${graphContext.relationKinds.join(', ')}.`
        );
    }
    if (graphContext && Array.isArray(graphContext.knowledgePointRelations) && graphContext.knowledgePointRelations.length > 0) {
        const relationPreview = graphContext.knowledgePointRelations
            .slice(0, 2)
            .map((relation) => `${relation.sourceTitle} -> ${relation.relationKind} -> ${relation.targetTitle}`)
            .join('; ');
        explanationLines.push(
            '',
            `Direct graph links inside the current result set: ${relationPreview}.`
        );
    }
    if (graphContext && Array.isArray(graphContext.connectionPaths) && graphContext.connectionPaths.length > 0) {
        explanationLines.push(
            '',
            `Explicit graph path: ${formatGraphConnectionPath(graphContext.connectionPaths[0])}.`
        );
    }
    if (graphContext && graphContext.temporalValidity.allPointsValid === false) {
        const reasonSummary = graphContext.temporalValidity.warningReasons.length > 0
            ? graphContext.temporalValidity.warningReasons.join(', ')
            : 'temporal validity checks reported a warning';
        explanationLines.push(
            '',
            `Temporal validity warning: ${reasonSummary}.`
        );
    }
    const supersedesCount = graphContext
        ? (Array.isArray(graphContext.temporalValidity.details)
            ? graphContext.temporalValidity.details.filter((detail) => detail.edgeKind === 'supersedes').length
            : 0)
        : 0;
    if (supersedesCount > 0) {
        explanationLines.push(
            '',
            `Temporal lineage indicates this anchor supersedes ${supersedesCount} earlier revision${supersedesCount === 1 ? '' : 's'}.`
        );
    }
    const supportingTitles = params.knowledgePoints
        .slice(1, 3)
        .map((point) => normalizeWhitespace(String(point.title || '').trim()))
        .filter(Boolean);
    if (supportingTitles.length > 0) {
        explanationLines.push(
            '',
            intent === 'compare'
                ? `Supporting comparison nodes: ${supportingTitles.join(', ')}.`
                : `Supporting scoped nodes: ${supportingTitles.join(', ')}.`
        );
    }
    if (params.recalledMemories.length > 0) {
        explanationLines.push(
            '',
            `Scoped memory recall contributed ${params.recalledMemories.length} prior note(s) to this explanation.`
        );
    }
    if (params.citations.length > 0) {
        explanationLines.push(
            '',
            `The explanation is grounded by ${params.citations.length} citation(s) from the current scope.`
        );
    }
    return explanationLines.join('\n');
}

function buildScopedConversationEvidenceMarkdown(params: ScopedConversationReplyParams): string {
    const evidenceLines = params.citations.slice(0, 3).map((citation, index) => (
        `${index + 1}. **${citation.title}** (${citation.sourcePath}${citation.startLine ? `:${citation.startLine}` : ''})\n   - ${citation.snippet}`
    ));
    if (evidenceLines.length <= 0) {
        return '## Evidence Summary\n\nNo scoped citations were returned.';
    }
    return [
        '## Evidence Summary',
        '',
        ...evidenceLines,
    ].join('\n');
}

function buildScopedConversationMemoryNotice(params: ScopedConversationReplyParams): string {
    if (params.recalledMemories.length <= 0) {
        return 'No scoped memory note was recalled for this turn.';
    }
    if (params.recalledMemories.length === 1) {
        return '1 scoped memory note was recalled and merged into the answer context.';
    }
    return `${params.recalledMemories.length} scoped memory notes were recalled and merged into the answer context.`;
}

function buildScopedConversationActionGuideMarkdown(
    params: ScopedConversationReplyParams,
    graphContext: AgentConversationGraphContext | null
): string {
    if (params.knowledgePoints.length <= 0) {
        return '## Next Actions\n\nNo actionable scoped knowledge card is available for this turn.';
    }
    const intent = classifyScopedConversationIntent(params.message);
    const topTitles = params.knowledgePoints
        .slice(0, 3)
        .map((point) => `- ${point.title}`);
    const actionHints = params.memoryActions
        .slice(0, 2)
        .map((action) => normalizeWhitespace(String(action.reason || '').trim()))
        .filter(Boolean)
        .map((reason) => `- ${reason}`);
    const graphActionHints: string[] = [];
    if (graphContext && graphContext.relationKinds.includes('prerequisite')) {
        graphActionHints.push('- Inspect prerequisite-linked concepts in focus mode before guided learning.');
    }
    if (graphContext && graphContext.temporalValidity.allPointsValid === false) {
        graphActionHints.push('- Validate whether a fresher or superseding note should replace this anchor before promotion.');
    }
    const supersedesCount = graphContext
        ? (Array.isArray(graphContext.temporalValidity.details)
            ? graphContext.temporalValidity.details.filter((detail) => detail.edgeKind === 'supersedes').length
            : 0)
        : 0;
    if (supersedesCount > 0) {
        graphActionHints.push('- Trace the superseded lineage before promoting this answer.');
    }
    if (graphContext && Array.isArray(graphContext.knowledgePointRelations) && graphContext.knowledgePointRelations.length > 0) {
        const firstRelation = graphContext.knowledgePointRelations[0];
        graphActionHints.push(
            `- Follow the direct graph path between ${firstRelation.sourceTitle} and ${firstRelation.targetTitle} before branching to external support nodes.`
        );
    }
    if (graphContext && Array.isArray(graphContext.connectionPaths) && graphContext.connectionPaths.length > 0) {
        const firstConnectionPath = graphContext.connectionPaths[0];
        const titles = Array.isArray(firstConnectionPath.pathTitles)
            ? firstConnectionPath.pathTitles.map((title) => normalizeWhitespace(String(title || '').trim())).filter(Boolean)
            : [];
        if (titles.length > 1) {
            graphActionHints.push(`- Review the path order: ${titles.join(' -> ')}.`);
        }
    }
    return [
        '## Next Actions',
        '',
        intent === 'compare'
            ? 'Use the scoped knowledge cards below to inspect the strongest nodes side by side before deciding which distinctions matter most:'
            : intent === 'how_to'
                ? 'Use the scoped knowledge cards below to move from explanation into concrete guided-learning or focus-mode steps:'
                : 'Use the scoped knowledge cards below to continue with focus mode or guided learning for the highest-signal nodes:',
        ...topTitles,
        ...(graphActionHints.length > 0 ? ['', 'Graph-aware follow-through:', ...graphActionHints] : []),
        ...(actionHints.length > 0
            ? ['', 'Suggested follow-through from the current turn:', ...actionHints]
            : []),
    ].join('\n');
}

function buildKnowledgeRunClaimFromCitation(
    runId: string,
    citation: KnowledgeCitation,
    index: number
): KnowledgeRunEvidenceClaim {
    const snippet = normalizeWhitespace(String(citation.snippet || '').trim());
    const hasSourcePath = normalizeWhitespace(String(citation.sourcePath || '')).length > 0;
    const hasLine = Number.isFinite(Number(citation.startLine)) && Number(citation.startLine) > 0;
    const status = hasSourcePath && snippet && hasLine
        ? 'verified'
        : hasSourcePath && snippet
            ? 'weak'
            : 'not_proven';
    return {
        claimId: `${runId}_claim_${index + 1}`,
        status,
        title: normalizeWhitespace(String(citation.title || '').trim()) || `Evidence claim ${index + 1}`,
        statement: snippet || normalizeWhitespace(String(citation.title || '').trim()) || 'Citation evidence was returned.',
        citationId: citation.citationId,
        atomId: citation.atomId,
        documentId: citation.documentId,
        sourcePath: citation.sourcePath,
        startLine: citation.startLine,
        endLine: citation.endLine,
        snippet,
        confidence: clampUnit(Number(citation.score || 0)),
        reason: status === 'verified'
            ? 'The claim is backed by a cited source span with a concrete line reference.'
            : status === 'weak'
                ? 'The claim has a cited source path and snippet, but no concrete line reference.'
                : 'The citation is missing enough source-span detail to prove the claim.',
    };
}

function buildKnowledgeRunClaimFromPoint(
    runId: string,
    point: AgentConversationKnowledgePoint,
    index: number
): KnowledgeRunEvidenceClaim {
    const snippet = normalizeWhitespace(String(point.evidenceSnippet || point.summary || '').trim());
    return {
        claimId: `${runId}_claim_${index + 1}`,
        status: 'not_proven',
        title: normalizeWhitespace(String(point.title || '').trim()) || `Knowledge point ${index + 1}`,
        statement: snippet || normalizeWhitespace(String(point.title || '').trim()) || 'A knowledge point was returned without citation evidence.',
        atomId: point.atomId,
        documentId: point.documentId,
        sourcePath: point.sourcePath,
        snippet,
        confidence: clampUnit(Number(point.score || 0)),
        reason: 'The answer can point to a retrieved knowledge node, but no explicit citation span was returned.',
    };
}

function buildRejectedKnowledgeRunClaim(runId: string, message: string): KnowledgeRunEvidenceClaim {
    return {
        claimId: `${runId}_claim_1`,
        status: 'rejected',
        title: 'No scoped evidence',
        statement: `No scoped evidence proved the request: ${normalizeWhitespace(message || 'local knowledge request')}`,
        snippet: '',
        confidence: 0,
        reason: 'No citation or retrieved knowledge point was available for this turn.',
    };
}

function buildKnowledgeRunEvidenceClaims(
    runId: string,
    params: ScopedConversationReplyParams
): KnowledgeRunEvidenceClaim[] {
    const seenCitationKeys = new Set<string>();
    const citationClaims = params.citations
        .filter((citation) => {
            const citationKey = [
                citation.citationId,
                citation.documentId,
                citation.sourcePath,
                citation.startLine || '',
                citation.endLine || '',
                citation.snippet,
            ].join('|');
            if (seenCitationKeys.has(citationKey)) {
                return false;
            }
            seenCitationKeys.add(citationKey);
            return true;
        })
        .map((citation, index) => buildKnowledgeRunClaimFromCitation(runId, citation, index));
    if (citationClaims.length > 0) {
        return citationClaims;
    }
    const pointClaims = params.knowledgePoints
        .slice(0, 3)
        .map((point, index) => buildKnowledgeRunClaimFromPoint(runId, point, index));
    if (pointClaims.length > 0) {
        return pointClaims;
    }
    return [buildRejectedKnowledgeRunClaim(runId, params.message)];
}

function buildKnowledgeRunEvidenceRef(claim: KnowledgeRunEvidenceClaim): string {
    const sourcePath = normalizeWhitespace(String(claim.sourcePath || '').trim());
    if (!sourcePath) {
        return '';
    }
    const startLine = Number(claim.startLine);
    return Number.isFinite(startLine) && startLine > 0
        ? `${sourcePath}:${startLine}`
        : sourcePath;
}

function buildKnowledgeRunReviewCards(
    runId: string,
    generatedAt: string,
    claims: KnowledgeRunEvidenceClaim[]
): KnowledgeRunReviewCard[] {
    return claims
        .filter((claim) => claim.status === 'verified' || claim.status === 'weak')
        .slice(0, 3)
        .map((claim, index) => {
            const evidenceRef = buildKnowledgeRunEvidenceRef(claim);
            return {
                cardId: `${runId}_card_${index + 1}`,
                sourceClaimId: claim.claimId,
                atomId: claim.atomId,
                suggestedActionKind: 'review',
                prompt: `What does the cited source establish about ${claim.title}?`,
                expectedAnswer: claim.snippet || claim.statement,
                evidenceRefs: evidenceRef ? [evidenceRef] : [],
                nextReviewAt: addDaysIso(generatedAt, 1),
            };
        });
}

function buildKnowledgeRunQuality(
    claims: KnowledgeRunEvidenceClaim[],
    reviewCards: KnowledgeRunReviewCard[],
    params: ScopedConversationReplyParams
): KnowledgeRunQuality {
    const coveredClaimCount = claims.filter((claim) => claim.status === 'verified' || claim.status === 'weak').length;
    const evidenceCoverage = claims.length > 0 ? coveredClaimCount / claims.length : 0;
    const scopeDiscipline = params.usedScope.source === 'scoped'
        || (
            params.usedScope.documentIds.length <= 0
            && params.usedScope.atomIds.length <= 0
            && params.usedScope.sourcePathPrefixes.length <= 0
        );
    const memoryActionsGoverned = params.memoryActions.every((action) => (
        Boolean(action.kind)
        && Boolean(action.status)
        && Boolean(action.layer)
        && Boolean(action.namespace)
    ));
    const gates: KnowledgeRunQualityGate[] = [
        {
            gateId: 'evidence_coverage',
            passed: evidenceCoverage >= 0.8,
            observedValue: Number(evidenceCoverage.toFixed(4)),
            threshold: 0.8,
            message: coveredClaimCount > 0
                ? `${coveredClaimCount} of ${claims.length} claim(s) have citation evidence.`
                : 'No claim has enough citation evidence.',
        },
        {
            gateId: 'scope_discipline',
            passed: scopeDiscipline,
            observedValue: scopeDiscipline ? 1 : 0,
            threshold: 1,
            message: scopeDiscipline
                ? 'The answer stayed inside the resolved scope contract.'
                : 'The answer used a global result while scoped filters were active.',
        },
        {
            gateId: 'recall_transfer',
            passed: reviewCards.length > 0,
            observedValue: reviewCards.length,
            threshold: 1,
            message: reviewCards.length > 0
                ? `${reviewCards.length} review card(s) were generated from cited claims.`
                : 'No active-recall card could be generated from the available evidence.',
        },
        {
            gateId: 'memory_governance',
            passed: memoryActionsGoverned,
            observedValue: memoryActionsGoverned ? 1 : 0,
            threshold: 1,
            message: memoryActionsGoverned
                ? 'Memory actions include the governance fields needed for audit.'
                : 'At least one memory action is missing governance metadata.',
        },
    ];
    const passedGateCount = gates.filter((gate) => gate.passed).length;
    const score = Number(((passedGateCount / gates.length) * 100).toFixed(2));
    const status: KnowledgeRunQualityStatus = gates.every((gate) => gate.passed)
        ? 'pass'
        : gates[0].passed && gates[1].passed
            ? 'caution'
            : 'fail';
    return {
        score,
        status,
        gates,
    };
}

function buildKnowledgeRunReviewState(reviewCards: KnowledgeRunReviewCard[]): KnowledgeRunReviewState {
    const totalReviewCards = reviewCards.length;
    return {
        consumedCardIds: [],
        completedReviewCardCount: 0,
        remainingReviewCardCount: totalReviewCards,
        completedAt: null,
    };
}

function buildKnowledgeRun(params: ScopedConversationReplyParams): KnowledgeRun {
    const generatedAt = String(params.generatedAt || new Date().toISOString()).trim();
    const runId = params.nextRunId ? params.nextRunId() : buildFallbackKnowledgeRunId(params, generatedAt);
    const evidenceClaims = buildKnowledgeRunEvidenceClaims(runId, params);
    const reviewCards = buildKnowledgeRunReviewCards(runId, generatedAt, evidenceClaims);
    const reviewState = buildKnowledgeRunReviewState(reviewCards);
    const quality = buildKnowledgeRunQuality(evidenceClaims, reviewCards, params);
    const countStatus = (status: KnowledgeRunEvidenceClaim['status']) => (
        evidenceClaims.filter((claim) => claim.status === status).length
    );
    return {
        runId,
        generatedAt,
        status: quality.status,
        scope: {
            source: params.usedScope.source,
            workspaceId: params.usedScope.workspaceId,
            corpusId: params.usedScope.corpusId,
            documentIds: [...params.usedScope.documentIds],
            atomIds: [...params.usedScope.atomIds],
            sourcePathPrefixes: [...params.usedScope.sourcePathPrefixes],
            languages: [...params.usedScope.languages],
            matchedAtomCount: params.usedScope.matchedAtomCount,
            scopeSource: params.usedScope.scopeSource,
        },
        evidenceClaims,
        quality,
        reviewCards,
        reviewState,
        summary: {
            claimCount: evidenceClaims.length,
            verifiedClaimCount: countStatus('verified'),
            weakClaimCount: countStatus('weak'),
            notProvenClaimCount: countStatus('not_proven'),
            rejectedClaimCount: countStatus('rejected'),
            reviewCardCount: reviewCards.length,
            completedReviewCardCount: reviewState.completedReviewCardCount,
            remainingReviewCardCount: reviewState.remainingReviewCardCount,
        },
    };
}

export function buildScopedConversationReply(params: ScopedConversationReplyParams): {
    answer: string;
    assistantBlocks: AgentConversationAssistantBlock[];
    knowledgeRun: KnowledgeRun;
    graphContext: AgentConversationGraphContext | null;
} {
    const blocks: AgentConversationAssistantBlock[] = [];
    const answer = buildScopedConversationAnswer(params);
    const knowledgeRun = buildKnowledgeRun(params);
    const graphContext = params.graphContext || buildAgentConversationGraphContext(params.knowledgePoints);
    const overviewMarkdown = buildScopedConversationOverviewMarkdown(params, graphContext);
    const explanationMarkdown = buildScopedConversationExplanationMarkdown(params, graphContext);
    const evidenceMarkdown = buildScopedConversationEvidenceMarkdown(params);
    const memoryNotice = buildScopedConversationMemoryNotice(params);
    const actionGuideMarkdown = buildScopedConversationActionGuideMarkdown(params, graphContext);

    blocks.push({
        blockId: params.nextBlockId(),
        type: 'structured_answer',
        title: 'Grounded Answer',
        directAnswer: answer,
        overviewMarkdown,
        explanationMarkdown,
        evidenceMarkdown,
        nextActionsMarkdown: params.knowledgePoints.length > 0 ? actionGuideMarkdown : undefined,
        knowledgePointCount: params.knowledgePoints.length,
        citationCount: params.citations.length,
        recalledMemoryCount: params.recalledMemories.length,
    });
    blocks.push({
        blockId: params.nextBlockId(),
        type: 'knowledge_run_summary',
        title: 'Knowledge Run',
        knowledgeRun,
    });
    if (memoryNotice) {
        blocks.push({
            blockId: params.nextBlockId(),
            type: 'system_notice',
            text: memoryNotice,
        });
    }
    if (params.citations.length > 0) {
        blocks.push({
            blockId: params.nextBlockId(),
            type: 'citations',
            title: 'Citations',
            citations: params.citations.map((citation) => ({ ...citation })),
        });
    }
    if (params.knowledgePoints.length > 0) {
        blocks.push({
            blockId: params.nextBlockId(),
            type: 'knowledge_actions',
            title: 'Knowledge Actions',
            atomIds: collectAgentConversationAtomIds(params.knowledgePoints),
        });
    }
    return {
        answer,
        assistantBlocks: blocks,
        knowledgeRun,
        graphContext,
    };
}
