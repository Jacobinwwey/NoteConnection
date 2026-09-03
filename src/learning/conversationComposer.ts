import type {
    AgentConversationAssistantBlock,
    AgentConversationGraphConnectionPath,
    AgentConversationGraphContext,
    AgentConversationKnowledgePoint,
    AgentConversationMemoryAction,
    AgentConversationMemoryRecord,
    AgentConversationResponseMode,
    AnswerReleaseReview,
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
    RagContextPack,
    RagSufficiencyReview,
    GraphAnswerPlan,
} from './types';
import { reviewAnswerRelease } from './answerReleaseReview';
import { buildAgentConversationGraphContextFromKnowledgePoints } from './graphContextAssembler';
import { buildGraphAnswerPlan } from './graphAnswerPlan';
import { reviewGraphAnswerCoverage } from './graphAnswerCoverage';
import {
    collectGraphAnswerFacts,
    collectGraphAnswerWindowTitles,
    formatGraphAnswerProfileSentence,
} from './graphAnswerFacts';
import {
    naturalizeRagPublicEvidenceClause,
} from './ragPublicText';
import { isPolaritySafeSemanticDuplicate } from './graphAnswerQualityPolicy';
import { formatTaskAwareAnswer } from './answerTaskPlan';

export type BuildAgentWorkspaceCapabilities = (atomId: string) => unknown[];

export type ScopedConversationReplyParams = {
    message: string;
    answerLanguage?: 'auto' | 'en' | 'zh';
    responseMode?: AgentConversationResponseMode;
    knowledgePoints: AgentConversationKnowledgePoint[];
    citations: KnowledgeCitation[];
    recalledMemories: AgentConversationMemoryRecord[];
    memoryActions: AgentConversationMemoryAction[];
    usedScope: KnowledgeQueryResolvedScope;
    generatedAt?: string;
    nextBlockId: () => string;
    nextRunId?: () => string;
    graphContext?: AgentConversationGraphContext | null;
    ragContextPack?: RagContextPack;
    ragSufficiencyReview?: RagSufficiencyReview;
};

const FULL_RESPONSE_MAX_CHARS = 24000;
const FULL_RESPONSE_MAX_FRAGMENTS = 24;
const FULL_REPORT_FRAGMENT_ROLES = new Set([
    'direct_support',
    'parent_context',
    'adjacent_context',
    'graph_neighbor_support',
    'conflict',
]);

type FullReportFragment = RagContextPack['fragments'][number];
type FullReportSourceIdentity = {
    documentId: string;
    sourcePath: string;
};

function isFullResponseMode(params: ScopedConversationReplyParams): boolean {
    return params.responseMode === 'full';
}

function normalizeSourcePathForComparison(value: string): string {
    return String(value || '')
        .trim()
        .replace(/\\/gu, '/')
        .replace(/\/{2,}/gu, '/')
        .replace(/\/+$/gu, '')
        .toLowerCase();
}

function resolveFullReportAnchorSource(params: ScopedConversationReplyParams): FullReportSourceIdentity {
    const anchorAtomId = normalizeWhitespace(String(params.graphContext?.anchorAtomId || ''));
    const anchorDocumentId = normalizeWhitespace(String(params.graphContext?.anchorDocumentId || ''));
    const knowledgePoints = Array.isArray(params.knowledgePoints) ? params.knowledgePoints : [];
    const anchorPoint = knowledgePoints.find((point) => {
        const pointAtomId = normalizeWhitespace(String(point.atomId || ''));
        const pointAtomIds = Array.isArray(point.atomIds) ? point.atomIds.map((atomId) => normalizeWhitespace(String(atomId || ''))) : [];
        return Boolean(anchorAtomId && (pointAtomId === anchorAtomId || pointAtomIds.includes(anchorAtomId)));
    })
        || knowledgePoints.find((point) => anchorDocumentId && normalizeWhitespace(String(point.documentId || '')) === anchorDocumentId)
        || knowledgePoints[0];
    const documentId = anchorDocumentId || normalizeWhitespace(String(anchorPoint?.documentId || ''));
    let sourcePath = normalizeSourcePathForComparison(String(anchorPoint?.sourcePath || ''));
    if (!sourcePath && documentId) {
        const sourceFragment = (params.ragContextPack?.fragments || []).find((fragment) => (
            fragment.role !== 'graph_neighbor_support'
            && normalizeWhitespace(String(fragment.documentId || '')) === documentId
            && normalizeSourcePathForComparison(String(fragment.sourcePath || ''))
        ));
        sourcePath = normalizeSourcePathForComparison(String(sourceFragment?.sourcePath || ''));
    }
    return { documentId, sourcePath };
}

function isFullReportGraphNeighborFromAnchorSource(
    fragment: FullReportFragment,
    anchorSource: FullReportSourceIdentity
): boolean {
    if (fragment.role !== 'graph_neighbor_support') {
        return true;
    }
    const fragmentDocumentId = normalizeWhitespace(String(fragment.documentId || ''));
    const fragmentSourcePath = normalizeSourcePathForComparison(String(fragment.sourcePath || ''));
    if (!anchorSource.documentId && !anchorSource.sourcePath) {
        return false;
    }
    if (anchorSource.documentId && fragmentDocumentId !== anchorSource.documentId) {
        return false;
    }
    if (anchorSource.sourcePath && fragmentSourcePath !== anchorSource.sourcePath) {
        return false;
    }
    return Boolean(fragmentDocumentId || fragmentSourcePath);
}

function hasFullReportBodyOutsideMermaid(fragment: FullReportFragment): boolean {
    const source = stripFullReportMermaid(String(fragment.text || ''))
        .replace(/^#{1,6}\s+[^\n]*$/gmu, '')
        .trim();
    return Boolean(source) && !isFullReportInternalBlock(source);
}

function selectFullReportFragments(params: ScopedConversationReplyParams): RagContextPack['fragments'] {
    const fragments = params.ragContextPack?.fragments || [];
    const anchorSource = resolveFullReportAnchorSource(params);
    const candidates = fragments
        .filter((fragment) => {
            const title = normalizeWhitespace(String(fragment.title || '')).toLowerCase();
            const headingPath = (Array.isArray(fragment.headingPath) ? fragment.headingPath : [])
                .map((heading) => normalizeWhitespace(String(heading || '')).toLowerCase())
                .join(' ');
            const mermaidMarked = title.includes('mermaid') || headingPath.includes('mermaid');
            return !title.includes('preamble')
                && (!mermaidMarked || hasFullReportBodyOutsideMermaid(fragment))
                && !headingPath.includes('preamble')
                && (!headingPath.includes('mermaid') || hasFullReportBodyOutsideMermaid(fragment));
        })
        .filter((fragment) => (
            FULL_REPORT_FRAGMENT_ROLES.has(fragment.role)
            && isFullReportGraphNeighborFromAnchorSource(fragment, anchorSource)
        ));
    const selected: RagContextPack['fragments'] = [];
    const selectedSections = new Set<string>();
    let usedChars = 0;
    const sectionKey = (fragment: RagContextPack['fragments'][number]): string => {
        const path = Array.isArray(fragment.headingPath) ? fragment.headingPath : [];
        const leaf = normalizeWhitespace(String(path[path.length - 1] || fragment.title || ''))
            .replace(/^#+\s*/u, '')
            .replace(/\s*\((?:mermaid|code|diagram)\s+block\)\s*$/iu, '')
            .toLowerCase();
        return `${fragment.documentId}:${leaf}`;
    };
    const appendCandidate = (fragment: RagContextPack['fragments'][number]): void => {
        if (selected.length >= FULL_RESPONSE_MAX_FRAGMENTS || usedChars >= FULL_RESPONSE_MAX_CHARS) {
            return;
        }
        const text = String(fragment.text || '').trim();
        if (
            !text
            || !FULL_REPORT_FRAGMENT_ROLES.has(fragment.role)
            || !isFullReportGraphNeighborFromAnchorSource(fragment, anchorSource)
            || (fragment.truncated && !hasBalancedMathDelimiters(text))
        ) {
            return;
        }
        const remaining = FULL_RESPONSE_MAX_CHARS - usedChars;
        if (text.length > remaining) {
            return;
        }
        const key = sectionKey(fragment);
        if (selectedSections.has(key)) {
            return;
        }
        selected.push({
            ...fragment,
            text,
            charCount: text.length,
        });
        usedChars += text.length;
        selectedSections.add(key);
    };
    const rolePriority: Record<string, number> = {
        parent_context: 0,
        adjacent_context: 1,
        graph_neighbor_support: 2,
        direct_support: 3,
        conflict: 4,
    };
    const grouped = new Map<string, RagContextPack['fragments']>();
    candidates.forEach((fragment) => {
        const key = sectionKey(fragment);
        const group = grouped.get(key) || [];
        group.push(fragment);
        grouped.set(key, group);
    });
    const sectionCandidates = Array.from(grouped.values())
        .map((group) => group.sort((left, right) => {
            const roleDelta = (rolePriority[left.role] ?? 9) - (rolePriority[right.role] ?? 9);
            if (roleDelta !== 0) {
                return roleDelta;
            }
            const boundaryDelta = Number(right.sourceBoundary === 'full_document') - Number(left.sourceBoundary === 'full_document');
            if (boundaryDelta !== 0) {
                return boundaryDelta;
            }
            const lengthDelta = String(right.text || '').length - String(left.text || '').length;
            if (lengthDelta !== 0) {
                return lengthDelta;
            }
            const leftLine = Number.isFinite(Number(left.startLine)) ? Number(left.startLine) : Number.MAX_SAFE_INTEGER;
            const rightLine = Number.isFinite(Number(right.startLine)) ? Number(right.startLine) : Number.MAX_SAFE_INTEGER;
            return leftLine - rightLine;
        }))
        .sort((left, right) => {
            const leftFragment = left[0];
            const rightFragment = right[0];
            const leftLine = Number.isFinite(Number(leftFragment?.startLine)) ? Number(leftFragment?.startLine) : Number.MAX_SAFE_INTEGER;
            const rightLine = Number.isFinite(Number(rightFragment?.startLine)) ? Number(rightFragment?.startLine) : Number.MAX_SAFE_INTEGER;
            if (leftFragment?.documentId !== rightFragment?.documentId) {
                return String(leftFragment?.documentId || '').localeCompare(String(rightFragment?.documentId || ''));
            }
            return leftLine - rightLine;
        });
    sectionCandidates.forEach((group) => appendCandidate(group[0]));
    return selected;
}

function hasBalancedMathDelimiters(value: string): boolean {
    const source = String(value || '');
    const displayCount = (source.match(/(?<!\\)\$\$/gu) || []).length;
    if (displayCount % 2 !== 0) {
        return false;
    }
    const inlineSource = source.replace(/(?<!\\)\$\$/gu, '');
    return ((inlineSource.match(/(?<!\\)\$/gu) || []).length % 2) === 0;
}

function isFullReportInternalBlock(value: string): boolean {
    const normalized = normalizeWhitespace(value);
    return !normalized
        || /(?:遵从.{0,20}(?:指示|要求)|仅基于标题|所有推理过程|推理过程以英文|最终输出|输出为简体中文|本技术文档旨在|本文档旨在|we will|based only on the title|final output|all reasoning)/iu.test(normalized)
        || /(?:grounded by|key evidence|missDiagnostics|workspaceReadiness|matchedAtomCount|titleLikeQueries|retrieval_candidates_below_threshold|rag context pack|planner)/iu.test(normalized);
}

function stripFullReportMermaid(value: string): string {
    return String(value || '')
        .replace(/```mermaid[\s\S]*?(?:```|$)/giu, '')
        .replace(/```(?:graphviz|dot)[\s\S]*?(?:```|$)/giu, '')
        .trim();
}

function sanitizeFullReportBlock(value: string): string {
    const source = String(value || '').replace(/\r\n?/gu, '\n').trim();
    if (!source) {
        return '';
    }
    const lines = source.split('\n');
    const sanitizedLines: string[] = [];
    lines.forEach((line) => {
        const normalizedLine = line.trim();
        if (!normalizedLine) {
            return;
        }
        if (/^#{1,6}\s+/u.test(normalizedLine) || /^\s*\|/u.test(normalizedLine)) {
            if (!isFullReportInternalBlock(normalizedLine)) {
                sanitizedLines.push(normalizedLine);
            }
            return;
        }
        const clauses = normalizedLine
            .split(/(?<=[.!?。！？；;])(?:\s+|(?=[\p{L}]))/u)
            .map((clause) => clause.trim())
            .filter((clause) => clause && !isFullReportInternalBlock(clause));
        if (clauses.length > 0) {
            sanitizedLines.push(clauses.join(' '));
        }
    });
    return sanitizedLines.join('\n').trim();
}

type FullReportLength = {
    value: number;
    keys: Set<string>;
};

function isStandaloneFullReportHeading(value: string): boolean {
    return /^#{1,6}\s+\S[^\n]*$/u.test(String(value || '').trim());
}

function splitFullReportHeadingBody(
    value: string,
    headingPath: string[]
): { heading: string; body: string } {
    const normalized = String(value || '').trim();
    const headingName = normalizeWhitespace(String(headingPath[headingPath.length - 1] || ''))
        .replace(/^#+\s*/u, '')
        .trim();
    if (!normalized || !headingName || !/^#{1,6}\s+/u.test(normalized)) {
        return { heading: '', body: normalized };
    }
    const escapedHeadingName = headingName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const headingMatch = normalized.match(new RegExp(
        `^(#{1,6})\\s+${escapedHeadingName}(?:\\s+|$)([\\s\\S]*)$`,
        'iu'
    ));
    if (!headingMatch) {
        return { heading: '', body: normalized };
    }
    return {
        heading: `${headingMatch[1]} ${headingName}`,
        body: String(headingMatch[2] || '').trim(),
    };
}

function appendFullReportBlock(
    lines: string[],
    block: string,
    currentLength: FullReportLength,
    dedupeValue = block
): boolean {
    const normalized = sanitizeFullReportBlock(block);
    if (!normalized || isFullReportInternalBlock(normalized) || !hasBalancedMathDelimiters(normalized)) {
        return false;
    }
    const separatorLength = lines.length > 0 ? 2 : 0;
    if (currentLength.value + separatorLength + normalized.length > FULL_RESPONSE_MAX_CHARS) {
        return false;
    }
    const key = normalizeWhitespace(dedupeValue).toLowerCase();
    if (!key || currentLength.keys.has(key)) {
        return false;
    }
    lines.push(normalized);
    currentLength.value += separatorLength + normalized.length;
    currentLength.keys.add(key);
    return true;
}

function buildFullTechnicalReport(
    params: ScopedConversationReplyParams,
    graphContext: AgentConversationGraphContext | null,
    graphAnswerPlan: GraphAnswerPlan
): string {
    const useChinese = useChineseAnswerLanguage(params);
    const fragments = selectFullReportFragments(params);
    if (fragments.length <= 0) {
        return buildScopedConversationAnswer({ ...params, responseMode: 'slim' }, graphContext, graphAnswerPlan);
    }
    const reportBlocks: string[] = [];
    const reportLength: FullReportLength = { value: 0, keys: new Set<string>() };
    fragments.forEach((fragment) => {
        const source = stripFullReportMermaid(fragment.text);
        let pendingHeading = '';
        source
            .split(/\n{2,}/u)
            .map((block) => block.trim())
            .filter(Boolean)
            .forEach((block) => {
                const normalizedBlock = block
                    .replace(/^#{1,6}\s+Water Glass\s*$/imu, '')
                    .trim();
                if (!normalizedBlock) {
                    return;
                }
                const headingBody = splitFullReportHeadingBody(
                    normalizedBlock,
                    Array.isArray(fragment.headingPath) ? fragment.headingPath : []
                );
                if (headingBody.heading && headingBody.body) {
                    appendFullReportBlock(
                        reportBlocks,
                        `${headingBody.heading}\n\n${headingBody.body}`,
                        reportLength,
                        headingBody.body
                    );
                    pendingHeading = '';
                    return;
                }
                if (isStandaloneFullReportHeading(normalizedBlock)) {
                    pendingHeading = normalizedBlock;
                    return;
                }
                const sectionBlock = pendingHeading
                    ? `${pendingHeading}\n\n${normalizedBlock}`
                    : normalizedBlock;
                appendFullReportBlock(
                    reportBlocks,
                    sectionBlock,
                    reportLength,
                    pendingHeading ? normalizedBlock : sectionBlock
                );
                pendingHeading = '';
            });
    });
    const directClaims = graphAnswerPlan.claims
        .filter((claim) => claim.required || claim.role === 'definition')
        .map((claim) => normalizeWhitespace(naturalizeRagPublicEvidenceClause(claim.statement)))
        .filter(Boolean);
    if (directClaims.length > 0 && !directClaims.some((claim) => reportBlocks.some((block) => normalizeWhitespace(block).toLowerCase().includes(claim.toLowerCase())))) {
        const heading = useChinese ? '## 核心定义' : '## Definition';
        appendFullReportBlock(reportBlocks, heading, reportLength);
        directClaims.forEach((claim) => appendFullReportBlock(reportBlocks, claim, reportLength));
    }
    return reportBlocks.join('\n\n').trim() || buildScopedConversationAnswer({ ...params, responseMode: 'slim' }, graphContext, graphAnswerPlan);
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
        startOffset: evidence?.startOffset,
        endOffset: evidence?.endOffset,
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
                startOffset: citation.startOffset,
                endOffset: citation.endOffset,
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
                    startOffset: citation.startOffset,
                    endOffset: citation.endOffset,
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

function classifyScopedConversationIntent(message: string): 'explain' | 'compare' | 'how_to' | 'causal_explain' | 'generic' {
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
        /\b(?:why|cause|causes|caused|causal|because|reason|mechanism|mechanisms)\b/u.test(normalized)
        || normalized.includes('为什么')
        || normalized.includes('為什麼')
        || normalized.includes('为何')
        || normalized.includes('為何')
        || normalized.includes('原因')
        || normalized.includes('因果')
        || normalized.includes('机制')
        || normalized.includes('機制')
        || normalized.includes('导致')
        || normalized.includes('導致')
    ) {
        return 'causal_explain';
    }
    if (
        normalized.includes('what is')
        || normalized.includes('explain')
        || normalized.includes('解释')
        || normalized.includes('什么是')
    ) {
        return 'explain';
    }
    return 'generic';
}

function containsCjk(value: string): boolean {
    return /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/u.test(String(value || ''));
}

function useChineseAnswerLanguage(params: ScopedConversationReplyParams): boolean {
    if (params.answerLanguage === 'zh') {
        return true;
    }
    if (params.answerLanguage === 'en') {
        return false;
    }
    return containsCjk([
        params.message,
        params.knowledgePoints[0]?.title,
        params.knowledgePoints[0]?.summary,
        params.graphContext?.anchorTitle,
    ].filter(Boolean).join(' '));
}

function stripConversationAnswerTerminalPunctuation(value: string): string {
    return normalizeWhitespace(String(value || '').replace(/[.!?\u3002\uFF01\uFF1F]+$/u, ''));
}

function normalizeConversationAnswerSentence(value: string, useChinese: boolean): string {
    const normalized = normalizeWhitespace(String(value || ''));
    if (!normalized) {
        return '';
    }
    if (useChinese && /[.!?]$/u.test(normalized)) {
        return normalized.replace(/[.!?]+$/u, '。');
    }
    return /[.!?\u3002\uFF01\uFF1F]$/u.test(normalized)
        ? normalized
        : `${normalized}${useChinese ? '。' : '.'}`;
}

function appendConversationAnswerSentence(sentences: string[], sentence: string, useChinese: boolean): void {
    const normalizedSentence = normalizeConversationAnswerSentence(sentence, useChinese);
    if (!normalizedSentence) {
        return;
    }
    const normalizedKey = stripConversationAnswerTerminalPunctuation(normalizedSentence).toLowerCase();
    const alreadyPresent = sentences.some((existingSentence) => (
        stripConversationAnswerTerminalPunctuation(existingSentence).toLowerCase() === normalizedKey
    ));
    if (!alreadyPresent) {
        sentences.push(normalizedSentence);
    }
}

function buildGraphConnectionPathAnswerSentence(
    graphContext: AgentConversationGraphContext | null,
    useChinese: boolean
): string {
    const connectionPath = graphContext && Array.isArray(graphContext.connectionPaths)
        ? graphContext.connectionPaths[0]
        : null;
    const pathTitles = connectionPath && Array.isArray(connectionPath.pathTitles)
        ? connectionPath.pathTitles.map((title) => normalizeWhitespace(String(title || '').trim())).filter(Boolean)
        : [];
    if (pathTitles.length <= 1) {
        return '';
    }
    if (useChinese) {
        return `当前图中的关键路径是 ${pathTitles.join(' -> ')}`;
    }
    return `The strongest graph path runs through ${pathTitles.join(' -> ')}`;
}

function normalizeGraphAnswerDisplayTitle(value: string): string {
    return normalizeWhitespace(
        String(value || '')
            .replace(/\s*\((?:mermaid|code|diagram)\s+block\)\s*$/iu, '')
            .trim()
    );
}

function buildGraphProfileAnswerSentence(
    graphContext: AgentConversationGraphContext | null,
    useChinese: boolean
): string {
    if (!graphContext) {
        return '';
    }
    const facts = collectGraphAnswerFacts(graphContext, {
        anchorAtomId: graphContext.anchorAtomId,
        anchorTitle: graphContext.anchorTitle,
        normalizeTitle: (value) => normalizeGraphAnswerDisplayTitle(String(value || '')),
    });
    if (!facts) {
        return '';
    }
    return formatGraphAnswerProfileSentence(facts, useChinese);
}

function sentenceComparableKey(value: string): string {
    return stripConversationAnswerTerminalPunctuation(value).toLowerCase();
}

function appendPlannedEvidenceSentence(
    sentences: string[],
    candidate: string,
    useChinese: boolean
): void {
    const normalized = normalizeConversationAnswerSentence(
        naturalizeRagPublicEvidenceClause(candidate),
        useChinese
    );
    if (!normalized) {
        return;
    }
    const candidateKey = sentenceComparableKey(normalized);
    const alreadyCovered = sentences.some((sentence) => {
        const existingKey = sentenceComparableKey(sentence);
        return existingKey === candidateKey
            || (candidateKey.length >= 32 && existingKey.includes(candidateKey))
            || (existingKey.length >= 32 && candidateKey.includes(existingKey))
            || isPolaritySafeSemanticDuplicate(existingKey, candidateKey);
    });
    if (!alreadyCovered) {
        sentences.push(normalized);
    }
}

function buildCoverageDrivenRagAnswer(
    params: ScopedConversationReplyParams,
    graphContext: AgentConversationGraphContext | null,
    graphAnswerPlan: GraphAnswerPlan,
    useChinese: boolean
): string {
    const pack = params.ragContextPack;
    if (!pack || !Array.isArray(pack.fragments) || pack.fragments.length <= 0) {
        return '';
    }
    if (params.ragSufficiencyReview?.status === 'insufficient') {
        return '';
    }
    const answerSentences: string[] = [];
    const hasLearningRouteTask = Boolean(
        graphAnswerPlan.answerTaskPlan?.subtasks.some((subtask) => subtask.kind === 'learning_route')
    );
    graphAnswerPlan.claims
        .forEach((claim) => appendPlannedEvidenceSentence(answerSentences, claim.statement, useChinese));
    if (answerSentences.length <= 0) {
        return '';
    }
    if (params.ragSufficiencyReview?.status === 'borderline') {
        appendPlannedEvidenceSentence(
            answerSentences,
            useChinese
                ? '当前证据覆盖仍然有限，因此这只能作为基于已命中材料的部分回答'
                : 'The available evidence is still partial, so this answer stays within the matched material',
            useChinese
        );
    }
    if (!hasLearningRouteTask) {
        appendConversationAnswerSentence(
            answerSentences,
            buildGraphConnectionPathAnswerSentence(graphContext, useChinese),
            useChinese
        );
        appendConversationAnswerSentence(
            answerSentences,
            buildGraphProfileAnswerSentence(graphContext, useChinese),
            useChinese
        );
    }
    return formatTaskAwareAnswer(answerSentences, graphAnswerPlan.answerTaskPlan, useChinese);
}

function buildScopedConversationAnswer(
    params: ScopedConversationReplyParams,
    graphContext: AgentConversationGraphContext | null,
    graphAnswerPlan: GraphAnswerPlan
): string {
    if (isFullResponseMode(params)) {
        return buildFullTechnicalReport(params, graphContext, graphAnswerPlan);
    }
    const useChinese = useChineseAnswerLanguage(params);
    if (params.knowledgePoints.length <= 0) {
        const query = normalizeWhitespace(String(params.message || '')) || (useChinese ? '当前问题' : 'your query');
        if (params.recalledMemories.length > 0) {
            return useChinese
                ? `当前范围没有匹配“${query}”的知识点，但已找回 ${params.recalledMemories.length} 条相关会话记忆。请调整知识范围，或将这条记忆作为后续检索锚点。`
                : `No scoped knowledge points matched "${query}", but I recovered ${params.recalledMemories.length} relevant conversation memory note(s). Refine the corpus scope or use the recalled memory as a follow-up anchor.`;
        }
        return useChinese
            ? `当前范围没有匹配“${query}”的知识点。请调整范围、补充笔记，或使用更具体的检索词。`
            : `No scoped knowledge points matched "${query}". Refine the scope, add more notes to the corpus, or broaden the query terms.`;
    }

    const leadingPoint = params.knowledgePoints[0];
    const answerSentences: string[] = [];
    const ragAnswer = buildCoverageDrivenRagAnswer(params, graphContext, graphAnswerPlan, useChinese);
    if (ragAnswer) {
        return ragAnswer;
    }
    if (graphAnswerPlan.claims.length > 0) {
        const hasLearningRouteTask = Boolean(
            graphAnswerPlan.answerTaskPlan?.subtasks.some((subtask) => subtask.kind === 'learning_route')
        );
        graphAnswerPlan.claims.forEach((claim) => {
            appendConversationAnswerSentence(answerSentences, claim.statement, useChinese);
        });
        if (params.ragSufficiencyReview?.status === 'borderline') {
            appendConversationAnswerSentence(
                answerSentences,
                useChinese
                    ? '当前证据覆盖仍然有限，因此回答只陈述已有材料能够支持的内容'
                    : 'The evidence coverage is still partial, so the answer stays within the retrieved material',
                useChinese
            );
        }
        if (!hasLearningRouteTask) {
            appendConversationAnswerSentence(
                answerSentences,
                buildGraphConnectionPathAnswerSentence(graphContext, useChinese),
                useChinese
            );
            appendConversationAnswerSentence(
                answerSentences,
                buildGraphProfileAnswerSentence(graphContext, useChinese),
                useChinese
            );
        }
        return formatTaskAwareAnswer(answerSentences, graphAnswerPlan.answerTaskPlan, useChinese);
    }
    const directSentence = selectScopedConversationDirectSentence(params.message, leadingPoint);
    if (directSentence) {
        appendConversationAnswerSentence(answerSentences, directSentence, useChinese);
    }
    if (answerSentences.length <= 0) {
        const title = normalizeWhitespace(String(leadingPoint.title || '').trim());
        const fallback = normalizeWhitespace(String(leadingPoint.evidenceSnippet || leadingPoint.summary || '').trim());
        if (title && fallback && title !== fallback) {
            appendConversationAnswerSentence(answerSentences, `${title}: ${fallback}`, useChinese);
        } else {
            appendConversationAnswerSentence(answerSentences, fallback || title || normalizeWhitespace(String(params.message || '')), useChinese);
        }
    }
    appendConversationAnswerSentence(
        answerSentences,
        buildGraphConnectionPathAnswerSentence(graphContext, useChinese),
        useChinese
    );
    appendConversationAnswerSentence(
        answerSentences,
        buildGraphProfileAnswerSentence(graphContext, useChinese),
        useChinese
    );
    if (answerSentences.length < 2 && params.knowledgePoints.length > 1) {
        appendConversationAnswerSentence(
            answerSentences,
            selectScopedConversationDirectSentence(params.message, params.knowledgePoints[1]),
            useChinese
        );
    }
    return answerSentences.join(useChinese ? '' : ' ');
}

function buildScopedConversationOverviewMarkdown(
    params: ScopedConversationReplyParams,
    graphContext: AgentConversationGraphContext | null
): string {
    const useChinese = useChineseAnswerLanguage(params);
    const strongestPoint = params.knowledgePoints[0];
    const lines = [
        useChinese ? '## 回答上下文' : '## Answer Context',
        '',
    ];
    if (strongestPoint) {
        lines.push(
            useChinese
                ? `当前最佳范围锚点：**${strongestPoint.title}**。`
                : `Best scoped anchor: **${strongestPoint.title}**.`,
            ''
        );
    } else {
        lines.push(
            useChinese
                ? '当前请求没有得到足够强的范围内知识点匹配。'
                : 'No scoped knowledge point produced a strong match for the current request.',
            ''
        );
    }
    lines.push(...(
        useChinese
            ? [
                `- 相关知识点：**${params.knowledgePoints.length}**`,
                `- 返回引用：**${params.citations.length}**`,
                `- 已召回范围内记忆：**${params.recalledMemories.length}**`,
            ]
            : [
                `- Relevant knowledge points: **${params.knowledgePoints.length}**`,
                `- Citations returned: **${params.citations.length}**`,
                `- Scoped memories recalled: **${params.recalledMemories.length}**`,
            ]
    ));
    if (graphContext && graphContext.relationKinds.length > 0) {
        lines.push(
            useChinese
                ? `- 图谱支持关系：**${graphContext.relationKinds.join(', ')}**`
                : `- Graph-supported relations: **${graphContext.relationKinds.join(', ')}**`
        );
    }
    if (graphContext) {
        lines.push(
            useChinese
                ? `- 时序有效性：**${graphContext.temporalValidity.allPointsValid ? '有效' : '警告'}**`
                : `- Temporal validity: **${graphContext.temporalValidity.allPointsValid ? 'valid' : 'warning'}**`
        );
    }
    if (graphContext && Array.isArray(graphContext.connectionPaths) && graphContext.connectionPaths.length > 0) {
        lines.push(useChinese
            ? `- 显式连接路径：**${graphContext.connectionPaths.length}**`
            : `- Explicit connection paths: **${graphContext.connectionPaths.length}**`);
    }
    if (graphContext && Array.isArray(graphContext.predecessorWindow) && graphContext.predecessorWindow.length > 0) {
        lines.push(useChinese
            ? `- 直接前置节点：**${graphContext.predecessorWindow.length}**`
            : `- Immediate predecessors: **${graphContext.predecessorWindow.length}**`);
    }
    if (graphContext && Array.isArray(graphContext.successorWindow) && graphContext.successorWindow.length > 0) {
        lines.push(useChinese
            ? `- 直接后继节点：**${graphContext.successorWindow.length}**`
            : `- Immediate successors: **${graphContext.successorWindow.length}**`);
    }
    return lines.join('\n');
}

function buildScopedConversationExplanationMarkdown(
    params: ScopedConversationReplyParams,
    graphContext: AgentConversationGraphContext | null
): string {
    const useChinese = useChineseAnswerLanguage(params);
    if (params.knowledgePoints.length <= 0) {
        return useChinese
            ? '## 说明\n\n当前范围没有返回足够强的知识点来直接解释该请求。'
            : '## Explanation\n\nThe current scope did not return a strong enough knowledge point to explain the request directly.';
    }
    const intent = classifyScopedConversationIntent(params.message);
    const strongestPoint = params.knowledgePoints[0];
    const explanationLines = [
        useChinese ? '## 说明' : '## Explanation',
        '',
    ];
    if (intent === 'compare') {
        explanationLines.push(useChinese
            ? `将 **${strongestPoint.title}** 作为当前范围内的比较基准。`
            : `Use **${strongestPoint.title}** as the comparison baseline inside the current scope.`);
    } else if (intent === 'how_to') {
        explanationLines.push(useChinese
            ? `将 **${strongestPoint.title}** 作为后续具体步骤的起始锚点。`
            : `Use **${strongestPoint.title}** as the starting anchor for the next concrete steps.`);
    } else if (intent === 'explain') {
        explanationLines.push(useChinese
            ? `**${strongestPoint.title}** 是当前用于说明的最佳范围锚点。`
            : `**${strongestPoint.title}** is the current best scoped anchor for the explanation.`);
    } else {
        explanationLines.push(useChinese
            ? `**${strongestPoint.title}** 是当前最佳范围锚点。`
            : `**${strongestPoint.title}** is the current best scoped anchor.`);
    }
    const summary = normalizeWhitespace(String(strongestPoint.summary || strongestPoint.evidenceSnippet || '').trim());
    if (summary) {
        explanationLines.push('', summary);
    }
    if (graphContext && graphContext.relationKinds.length > 0) {
        explanationLines.push(
            '',
            useChinese
                ? `**${graphContext.anchorTitle}** 周边的图谱支持关系包括：${graphContext.relationKinds.join(', ')}。`
                : `Graph support around **${graphContext.anchorTitle}** includes: ${graphContext.relationKinds.join(', ')}.`
        );
    }
    if (graphContext && Array.isArray(graphContext.knowledgePointRelations) && graphContext.knowledgePointRelations.length > 0) {
        const relationPreview = graphContext.knowledgePointRelations
            .slice(0, 2)
            .map((relation) => `${relation.sourceTitle} -> ${relation.relationKind} -> ${relation.targetTitle}`)
            .join('; ');
        explanationLines.push(
            '',
            useChinese
                ? `当前结果集内的直接图链接：${relationPreview}。`
                : `Direct graph links inside the current result set: ${relationPreview}.`
        );
    }
    if (graphContext && Array.isArray(graphContext.connectionPaths) && graphContext.connectionPaths.length > 0) {
        explanationLines.push(
            '',
            useChinese
                ? `显式图路径：${formatGraphConnectionPath(graphContext.connectionPaths[0])}。`
                : `Explicit graph path: ${formatGraphConnectionPath(graphContext.connectionPaths[0])}.`
        );
    }
    if (graphContext) {
        const predecessorTitles = collectGraphAnswerWindowTitles(graphContext, 'predecessorWindow', {
            anchorAtomId: graphContext.anchorAtomId,
            anchorTitle: graphContext.anchorTitle,
            normalizeTitle: (value) => normalizeGraphAnswerDisplayTitle(String(value || '')),
        }, 3);
        if (predecessorTitles.length > 0) {
            explanationLines.push('', useChinese
                ? '直接前置窗口：' + predecessorTitles.join('、') + '。'
                : 'Immediate predecessor window: ' + predecessorTitles.join(', ') + '.');
        }
    }
    if (graphContext) {
        const successorTitles = collectGraphAnswerWindowTitles(graphContext, 'successorWindow', {
            anchorAtomId: graphContext.anchorAtomId,
            anchorTitle: graphContext.anchorTitle,
            normalizeTitle: (value) => normalizeGraphAnswerDisplayTitle(String(value || '')),
        }, 3);
        if (successorTitles.length > 0) {
            explanationLines.push('', useChinese
                ? '直接后继窗口：' + successorTitles.join('、') + '。'
                : 'Immediate successor window: ' + successorTitles.join(', ') + '.');
        }
    }
    if (graphContext && graphContext.temporalValidity.allPointsValid === false) {
        const reasonSummary = graphContext.temporalValidity.warningReasons.length > 0
            ? graphContext.temporalValidity.warningReasons.join(', ')
            : 'temporal validity checks reported a warning';
        explanationLines.push(
            '',
            useChinese
                ? `时序有效性警告：${reasonSummary}。`
                : `Temporal validity warning: ${reasonSummary}.`
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
            useChinese
                ? `时序谱系表明该锚点替代了 ${supersedesCount} 个更早版本。`
                : `Temporal lineage indicates this anchor supersedes ${supersedesCount} earlier revision${supersedesCount === 1 ? '' : 's'}.`
        );
    }
    const supportingTitles = params.knowledgePoints
        .slice(1, 3)
        .map((point) => normalizeWhitespace(String(point.title || '').trim()))
        .filter(Boolean);
    if (supportingTitles.length > 0) {
        explanationLines.push(
            '',
            useChinese
                ? (intent === 'compare'
                    ? `支持比较节点：${supportingTitles.join('、')}。`
                    : `支持范围节点：${supportingTitles.join('、')}。`)
                : (intent === 'compare'
                    ? `Supporting comparison nodes: ${supportingTitles.join(', ')}.`
                    : `Supporting scoped nodes: ${supportingTitles.join(', ')}.`)
        );
    }
    if (params.recalledMemories.length > 0) {
        explanationLines.push(
            '',
            useChinese
                ? `范围内记忆召回为该说明提供了 ${params.recalledMemories.length} 条先前笔记。`
                : `Scoped memory recall contributed ${params.recalledMemories.length} prior note(s) to this explanation.`
        );
    }
    if (params.citations.length > 0) {
        explanationLines.push(
            '',
            useChinese
                ? `该说明由当前范围内的 ${params.citations.length} 条引用支撑。`
                : `The explanation is grounded by ${params.citations.length} citation(s) from the current scope.`
        );
    }
    return explanationLines.join('\n');
}

function buildScopedConversationEvidenceMarkdown(params: ScopedConversationReplyParams): string {
    const evidenceLines = params.citations.slice(0, 3).map((citation, index) => (
        `${index + 1}. **${citation.title}** (${citation.sourcePath}${citation.startLine ? `:${citation.startLine}` : ''})\n   - ${citation.snippet}`
    ));
    if (evidenceLines.length <= 0) {
        return useChineseAnswerLanguage(params)
            ? '## 证据摘要\n\n当前范围没有返回引用。'
            : '## Evidence Summary\n\nNo scoped citations were returned.';
    }
    return [
        useChineseAnswerLanguage(params) ? '## 证据摘要' : '## Evidence Summary',
        '',
        ...evidenceLines,
    ].join('\n');
}

function buildScopedConversationMemoryNotice(params: ScopedConversationReplyParams): string {
    const useChinese = useChineseAnswerLanguage(params);
    if (params.recalledMemories.length <= 0) {
        return useChinese
            ? '本回合未召回范围内记忆。'
            : 'No scoped memory note was recalled for this turn.';
    }
    if (params.recalledMemories.length === 1) {
        return useChinese
            ? '已召回 1 条范围内记忆并合并到回答上下文。'
            : '1 scoped memory note was recalled and merged into the answer context.';
    }
    return useChinese
        ? `已召回 ${params.recalledMemories.length} 条范围内记忆并合并到回答上下文。`
        : `${params.recalledMemories.length} scoped memory notes were recalled and merged into the answer context.`;
}

function buildScopedConversationActionGuideMarkdown(
    params: ScopedConversationReplyParams,
    graphContext: AgentConversationGraphContext | null,
    answerTaskPlan?: GraphAnswerPlan['answerTaskPlan']
): string {
    const useChinese = useChineseAnswerLanguage(params);
    if (params.knowledgePoints.length <= 0) {
        return useChinese
            ? '## 下一步行动\n\n当前回合没有可执行的限定知识卡片。'
            : '## Next Actions\n\nNo actionable scoped knowledge card is available for this turn.';
    }
    const intent = classifyScopedConversationIntent(params.message);
    const topTitles = params.knowledgePoints
        .slice(0, 3)
        .map((point) => `- ${point.title}`);
    const actionHints = params.memoryActions
        .slice(0, 2)
        .map((action) => useChinese
            ? (action.kind === 'persist_session_memory' ? '- 记录本回合的用户关注点。' : '- 根据当前证据评估是否需要保存学习记忆。')
            : normalizeWhitespace(String(action.reason || '').trim()))
        .filter(Boolean)
        .map((reason) => `- ${reason}`);
    const graphActionHints: string[] = [];
    const learningRoute = answerTaskPlan?.learningRoute || [];
    if (answerTaskPlan?.subtasks.some((subtask) => subtask.kind === 'learning_route') && learningRoute.length > 0) {
        graphActionHints.push(
            useChinese
                ? `- 建议按以下顺序学习：${learningRoute.map((node) => `${node.order}. ${node.title}`).join(' -> ')}。`
                : `- Follow the evidence-backed learning order: ${learningRoute.map((node) => `${node.order}. ${node.title}`).join(' -> ')}.`
        );
    }
    if (graphContext && graphContext.relationKinds.includes('prerequisite')) {
        graphActionHints.push(useChinese ? '- 在进入引导学习前，先在聚焦模式查看前置概念。' : '- Inspect prerequisite-linked concepts in focus mode before guided learning.');
    }
    if (graphContext && graphContext.temporalValidity.allPointsValid === false) {
        graphActionHints.push(useChinese ? '- 提升答案前，确认是否存在更新或替代当前锚点的笔记。' : '- Validate whether a fresher or superseding note should replace this anchor before promotion.');
    }
    const supersedesCount = graphContext
        ? (Array.isArray(graphContext.temporalValidity.details)
            ? graphContext.temporalValidity.details.filter((detail) => detail.edgeKind === 'supersedes').length
            : 0)
        : 0;
    if (supersedesCount > 0) {
        graphActionHints.push(useChinese ? '- 提升答案前，追踪已被替代的知识谱系。' : '- Trace the superseded lineage before promoting this answer.');
    }
    if (graphContext && Array.isArray(graphContext.knowledgePointRelations) && graphContext.knowledgePointRelations.length > 0) {
        const firstRelation = graphContext.knowledgePointRelations[0];
        graphActionHints.push(
            useChinese
                ? `- 在扩展到外部支持节点前，沿 ${firstRelation.sourceTitle} 与 ${firstRelation.targetTitle} 之间的直接图路径查看。`
                : `- Follow the direct graph path between ${firstRelation.sourceTitle} and ${firstRelation.targetTitle} before branching to external support nodes.`
        );
    }
    if (graphContext && Array.isArray(graphContext.connectionPaths) && graphContext.connectionPaths.length > 0) {
        const firstConnectionPath = graphContext.connectionPaths[0];
        const titles = Array.isArray(firstConnectionPath.pathTitles)
            ? firstConnectionPath.pathTitles.map((title) => normalizeWhitespace(String(title || '').trim())).filter(Boolean)
            : [];
        if (titles.length > 1) {
            graphActionHints.push(useChinese ? `- 检查路径顺序：${titles.join(' -> ')}。` : `- Review the path order: ${titles.join(' -> ')}.`);
        }
    }
    if (graphContext) {
        const predecessorTitles = collectGraphAnswerWindowTitles(graphContext, 'predecessorWindow', {
            anchorAtomId: graphContext.anchorAtomId,
            anchorTitle: graphContext.anchorTitle,
            normalizeTitle: (value) => normalizeGraphAnswerDisplayTitle(String(value || '')),
        }, 2);
        if (predecessorTitles.length > 0) {
            graphActionHints.push(useChinese
                ? '- 扩展答案前，先查看前置上下文：' + predecessorTitles.join('、') + '。'
                : '- Inspect prerequisite context from ' + predecessorTitles.join(', ') + ' before expanding the answer.');
        }
    }
    if (graphContext) {
        const successorTitles = collectGraphAnswerWindowTitles(graphContext, 'successorWindow', {
            anchorAtomId: graphContext.anchorAtomId,
            anchorTitle: graphContext.anchorTitle,
            normalizeTitle: (value) => normalizeGraphAnswerDisplayTitle(String(value || '')),
        }, 2);
        if (successorTitles.length > 0) {
            graphActionHints.push(useChinese
                ? '- 可沿后续节点继续：' + successorTitles.join('、') + '。'
                : '- Use likely next-step nodes such as ' + successorTitles.join(', ') + ' to continue follow-through after this answer.');
        }
    }
    return [
        useChinese ? '## 下一步行动' : '## Next Actions',
        '',
        intent === 'compare'
            ? (useChinese ? '先查看下方限定知识卡片中的高相关节点，再判断关键差异：' : 'Use the scoped knowledge cards below to inspect the strongest nodes side by side before deciding which distinctions matter most:')
            : intent === 'how_to'
                ? (useChinese ? '使用下方限定知识卡片，将解释推进为具体的引导学习或聚焦步骤：' : 'Use the scoped knowledge cards below to move from explanation into concrete guided-learning or focus-mode steps:')
                : (useChinese ? '使用下方限定知识卡片，继续聚焦或引导学习高相关节点：' : 'Use the scoped knowledge cards below to continue with focus mode or guided learning for the highest-signal nodes:'),
        ...topTitles,
        ...(graphActionHints.length > 0 ? ['', useChinese ? '图谱辅助行动：' : 'Graph-aware follow-through:', ...graphActionHints] : []),
        ...(actionHints.length > 0
            ? ['', useChinese ? '本回合建议行动：' : 'Suggested follow-through from the current turn:', ...actionHints]
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
    params: ScopedConversationReplyParams,
    graphContext: AgentConversationGraphContext | null
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
    const intent = classifyScopedConversationIntent(params.message);
    const predecessorWindow = graphContext && Array.isArray(graphContext.predecessorWindow)
        ? graphContext.predecessorWindow
        : [];
    const successorWindow = graphContext && Array.isArray(graphContext.successorWindow)
        ? graphContext.successorWindow
        : [];
    const connectionPaths = graphContext && Array.isArray(graphContext.connectionPaths)
        ? graphContext.connectionPaths
        : [];
    const diagnostics = graphContext && graphContext.diagnostics && typeof graphContext.diagnostics === 'object'
        ? graphContext.diagnostics
        : null;
    const prerequisiteSignalPresent = predecessorWindow.length > 0
        || connectionPaths.some((connectionPath) => (
            Array.isArray(connectionPath.pathEdges)
            && connectionPath.pathEdges.some((edge) => edge && edge.relationKind === 'prerequisite')
        ))
        || Boolean(graphContext && graphContext.relationKinds.includes('prerequisite'));
    const prerequisiteOrderRequired = intent === 'how_to' || (intent === 'explain' && prerequisiteSignalPresent);
    const prerequisiteOrderPassed = !prerequisiteOrderRequired
        || predecessorWindow.length > 0
        || connectionPaths.some((connectionPath) => (
            Array.isArray(connectionPath.pathEdges)
            && connectionPath.pathEdges.some((edge) => edge && edge.relationKind === 'prerequisite')
        ));
    const comparisonBranchRequired = intent === 'compare';
    const comparisonBranchSignalPresent = Boolean(
        graphContext
        && (
            graphContext.relationKinds.includes('contrast')
            || graphContext.relationKinds.includes('analogy')
            || (
                Array.isArray(graphContext.knowledgePointRelations)
                && graphContext.knowledgePointRelations.some((relation) => (
                    relation
                    && (relation.relationKind === 'contrast' || relation.relationKind === 'analogy')
                ))
            )
            || (Array.isArray(graphContext.supportingTitles) && graphContext.supportingTitles.length >= 2)
            || connectionPaths.length >= 2
        )
    );
    const comparisonBranchPassed = !comparisonBranchRequired
        || comparisonBranchSignalPresent;
    const temporalWarningRequired = Boolean(
        graphContext
        && (
            graphContext.temporalValidity.allPointsValid === false
            || (
                Array.isArray(graphContext.temporalValidity.details)
                && graphContext.temporalValidity.details.some((detail) => detail.edgeKind === 'supersedes')
            )
        )
    );
    const temporalWarningPassed = !temporalWarningRequired
        || Boolean(
            graphContext
            && Array.isArray(graphContext.temporalValidity.warningReasons)
            && graphContext.temporalValidity.warningReasons.length > 0
        );
    const graphOpFallbackPassed = !diagnostics
        || diagnostics.graphOpsAvailable === true
        || diagnostics.usedFallback === true;
    const supportNodeCount = diagnostics
        ? Math.max(0, Math.floor(Number(diagnostics.supportNodeCount || 0)))
        : (graphContext && Array.isArray(graphContext.supportingAtomIds) ? graphContext.supportingAtomIds.length : 0);
    const supportNodeLimit = diagnostics
        ? Math.max(1, Math.floor(Number(diagnostics.supportNodeLimit || supportNodeCount || 1)))
        : Math.max(supportNodeCount || 1, 1);
    const pathDepthLimit = diagnostics
        ? Math.max(1, Math.floor(Number(diagnostics.pathDepthLimit || 1)))
        : 6;
    const graphBudgetPassed = connectionPaths.every((connectionPath) => Math.max(0, Math.floor(Number(connectionPath.length || 0))) <= pathDepthLimit)
        && predecessorWindow.length <= Math.max(0, supportNodeLimit)
        && successorWindow.length <= Math.max(0, supportNodeLimit)
        && supportNodeCount <= supportNodeLimit;
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
        {
            gateId: 'graph_prerequisite_order',
            passed: prerequisiteOrderPassed,
            observedValue: prerequisiteOrderPassed ? 1 : 0,
            threshold: prerequisiteOrderRequired ? 1 : 0,
            message: prerequisiteOrderRequired
                ? (
                    prerequisiteOrderPassed
                        ? 'Prerequisite-oriented queries retained upstream path order or predecessor context.'
                        : 'The current graph context did not preserve enough prerequisite ordering for this query.'
                )
                : 'No prerequisite-ordering requirement was active for this query.',
        },
        {
            gateId: 'graph_comparison_branch',
            passed: comparisonBranchPassed,
            observedValue: comparisonBranchPassed ? 1 : 0,
            threshold: comparisonBranchRequired ? 1 : 0,
            message: comparisonBranchRequired
                ? (
                    comparisonBranchPassed
                        ? 'Comparison intent retained support nodes or branch structure in the graph context.'
                        : 'Comparison intent did not retain enough branch structure in the graph context.'
                )
                : 'No comparison-branch requirement was active for this query.',
        },
        {
            gateId: 'graph_temporal_warning',
            passed: temporalWarningPassed,
            observedValue: temporalWarningPassed ? 1 : 0,
            threshold: temporalWarningRequired ? 1 : 0,
            message: temporalWarningRequired
                ? (
                    temporalWarningPassed
                        ? 'Temporal invalidity or supersession was surfaced as an explicit warning.'
                        : 'Temporal invalidity was present but not surfaced as an explicit warning.'
                )
                : 'No temporal warning was required for this query.',
        },
        {
            gateId: 'graph_op_fallback',
            passed: graphOpFallbackPassed,
            observedValue: graphOpFallbackPassed ? 1 : 0,
            threshold: 1,
            message: diagnostics
                ? (
                    diagnostics.graphOpsAvailable === true
                        ? 'Graph operations were available for this turn.'
                        : diagnostics.usedFallback === true
                            ? 'Graph operations fell back cleanly without breaking the answer contract.'
                            : 'Graph operation availability and fallback state were inconsistent.'
                )
                : 'No graph diagnostics payload was available; compatibility fallback accepted.',
        },
        {
            gateId: 'graph_budget',
            passed: graphBudgetPassed,
            observedValue: graphBudgetPassed ? 1 : 0,
            threshold: 1,
            message: graphBudgetPassed
                ? 'Graph context stayed within bounded support/path/window budgets.'
                : 'Graph context exceeded the bounded support/path/window budgets for this turn.',
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

function buildKnowledgeRun(
    params: ScopedConversationReplyParams,
    graphContext: AgentConversationGraphContext | null
): KnowledgeRun {
    const generatedAt = String(params.generatedAt || new Date().toISOString()).trim();
    const runId = params.nextRunId ? params.nextRunId() : buildFallbackKnowledgeRunId(params, generatedAt);
    const evidenceClaims = buildKnowledgeRunEvidenceClaims(runId, params);
    const reviewCards = buildKnowledgeRunReviewCards(runId, generatedAt, evidenceClaims);
    const reviewState = buildKnowledgeRunReviewState(reviewCards);
    const quality = buildKnowledgeRunQuality(evidenceClaims, reviewCards, params, graphContext);
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
    answerReleaseReview: AnswerReleaseReview;
    graphAnswerPlan: GraphAnswerPlan;
    graphAnswerCoverage: ReturnType<typeof reviewGraphAnswerCoverage>;
} {
    const blocks: AgentConversationAssistantBlock[] = [];
    const graphContext = params.graphContext || buildAgentConversationGraphContextFromKnowledgePoints(params.knowledgePoints);
    const auditGraphAnswerPlan = buildGraphAnswerPlan({
        message: params.message,
        knowledgePoints: params.knowledgePoints,
        graphContext,
        ragContextPack: params.ragContextPack,
    });
    const draftAnswer = buildScopedConversationAnswer(params, graphContext, auditGraphAnswerPlan);
    const knowledgeRun = buildKnowledgeRun(params, graphContext);
    const answerReleaseReview = reviewAnswerRelease({
        message: params.message,
        answerLanguage: params.answerLanguage,
        responseMode: params.responseMode === 'full' ? 'full' : 'slim',
        draftAnswer,
        knowledgePoints: params.knowledgePoints,
        citations: params.citations,
        usedScope: params.usedScope,
        graphContext,
        ragContextPack: params.ragContextPack,
        ragSufficiencyReview: params.ragSufficiencyReview,
        graphAnswerPlan: auditGraphAnswerPlan,
        reviewedAt: params.generatedAt,
    });
    knowledgeRun.answerReleaseReview = answerReleaseReview;
    const answer = answerReleaseReview.publicAnswer;
    const publicGraphAnswerPlan = answerReleaseReview.publicGraphAnswerPlan;
    const releasedGraphAnswerPlan: GraphAnswerPlan = publicGraphAnswerPlan || {
        ...auditGraphAnswerPlan,
        leadClaimId: '',
        claims: [],
        requiredRoles: [],
        depth: 'compact',
    };
    const graphAnswerCoverage = answerReleaseReview.graphAnswerCoverage
        || reviewGraphAnswerCoverage(answer, publicGraphAnswerPlan || null);
    knowledgeRun.graphAnswerPlan = releasedGraphAnswerPlan;
    knowledgeRun.graphAnswerCoverage = graphAnswerCoverage;
    knowledgeRun.answerTaskPlan = releasedGraphAnswerPlan.answerTaskPlan;
    knowledgeRun.answerTaskCoverage = answerReleaseReview.answerTaskCoverage;
    const useChinese = useChineseAnswerLanguage(params);
    const overviewMarkdown = buildScopedConversationOverviewMarkdown(params, graphContext);
    const explanationMarkdown = buildScopedConversationExplanationMarkdown(params, graphContext);
    const evidenceMarkdown = buildScopedConversationEvidenceMarkdown(params);
    const memoryNotice = buildScopedConversationMemoryNotice(params);
    const actionGuideMarkdown = buildScopedConversationActionGuideMarkdown(
        params,
        graphContext,
        releasedGraphAnswerPlan.answerTaskPlan
    );

    blocks.push({
        blockId: params.nextBlockId(),
        type: 'structured_answer',
        title: useChinese ? '可信回答' : 'Grounded Answer',
        directAnswer: answer,
        answerTaskPlan: releasedGraphAnswerPlan.answerTaskPlan,
        answerTaskCoverage: answerReleaseReview.answerTaskCoverage,
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
        title: useChinese ? '知识运行' : 'Knowledge Run',
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
            title: useChinese ? '引用' : 'Citations',
            citations: params.citations.map((citation) => ({ ...citation })),
        });
    }
    if (params.knowledgePoints.length > 0) {
        blocks.push({
            blockId: params.nextBlockId(),
            type: 'knowledge_actions',
            title: useChinese ? '知识操作' : 'Knowledge Actions',
            atomIds: collectAgentConversationAtomIds(params.knowledgePoints),
        });
    }
    return {
        answer,
        assistantBlocks: blocks,
        knowledgeRun,
        graphContext,
        answerReleaseReview,
        graphAnswerPlan: releasedGraphAnswerPlan,
        graphAnswerCoverage,
    };
}
