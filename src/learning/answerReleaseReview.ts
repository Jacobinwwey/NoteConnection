import type {
    AgentConversationGraphContext,
    AgentConversationKnowledgePoint,
    AnswerReleaseDecision,
    AnswerReleaseGate,
    AnswerReleaseGateId,
    AnswerReleaseReview,
    KnowledgeCitation,
    KnowledgeQueryResolvedScope,
    RelationKind,
} from './types';

export interface AnswerReleaseReviewContext {
    message: string;
    draftAnswer: string;
    knowledgePoints: AgentConversationKnowledgePoint[];
    citations: KnowledgeCitation[];
    usedScope: KnowledgeQueryResolvedScope;
    graphContext: AgentConversationGraphContext | null;
    reviewedAt?: string;
}

type AnswerReleaseSupportCandidate = {
    label: string;
    text: string;
};

type StructuredFactKind = 'number_with_unit' | 'year';

type StructuredFact = {
    kind: StructuredFactKind;
    value: number;
    unit: string;
    surface: string;
    anchorTokens: string[];
};

type StructuredFactConflict = {
    answerFact: StructuredFact;
    supportFacts: Array<StructuredFact & { label: string }>;
};

type StateFrameConnectorKind = 'copula' | 'definition';

type StateFrame = {
    surface: string;
    subject: string;
    subjectFeatures: string[];
    connectorKind: StateFrameConnectorKind;
    value: string;
    valueFeatures: string[];
    tailFeatures: string[];
};

type StateFrameConflict = {
    answerFrame: StateFrame;
    supportFrame: StateFrame & { label: string };
};

type SubjectFrame = {
    surface: string;
    subject: string;
    subjectFeatures: string[];
    tail: string;
    tailFeatures: string[];
};

type SubjectFrameConflict = {
    answerFrame: SubjectFrame;
    supportFrame: SubjectFrame & { label: string };
};

type SentencePolarity = 'positive' | 'negative';

type PolaritySentence = {
    surface: string;
    polarity: SentencePolarity;
    comparableFeatures: string[];
};

type PolaritySentenceConflict = {
    answerSentence: PolaritySentence;
    supportSentence: PolaritySentence & { label: string };
};

type GraphOrderSupportedRelationKind = 'prerequisite' | 'sequence';

type GraphOrderEvidence = {
    relationKind: GraphOrderSupportedRelationKind;
    earlierTitle: string;
    laterTitle: string;
    source: 'connection_path' | 'knowledge_point_relation' | 'predecessor_window' | 'successor_window';
};

type GraphOrderConflict = {
    answerSurface: string;
    evidence: GraphOrderEvidence;
};

type QueryIntentAlignmentResult = {
    passed: boolean;
    applicable: boolean;
    comparableFrameCount: number;
    supportFrame: (StateFrame & { label: string }) | null;
};

const INTERNAL_DIAGNOSTIC_FRAGMENTS = [
    'No scoped knowledge points matched',
    'retrieval_candidates_below_threshold',
    'missDiagnostics',
    'workspaceReadiness',
    'matchedAtomCount',
    'titleLikeQueries',
];

const STRUCTURED_UNIT_ALIASES: Record<string, string> = {
    '%': '%',
    percent: '%',
    percentage: '%',
    'kg/m3': 'kg/m3',
    'kg/m³': 'kg/m3',
    gpa: 'gpa',
    mpa: 'mpa',
    kpa: 'kpa',
    pa: 'pa',
    km: 'km',
    cm: 'cm',
    mm: 'mm',
    ml: 'ml',
    mb: 'mb',
    gb: 'gb',
    tb: 'tb',
    kw: 'kw',
    mw: 'mw',
    'm/s': 'm/s',
    'km/h': 'km/h',
    '°c': 'deg_c',
    '℃': 'deg_c',
    '℉': 'deg_f',
    year: 'year',
    years: 'year',
    yr: 'year',
    yrs: 'year',
    年: 'year',
};

const STRUCTURED_FACT_PATTERN = /(-?\d{1,4}(?:,\d{3})*(?:\.\d+)?)(?:\s*(kg\/m(?:³|3)|gpa|mpa|kpa|pa|km\/h|m\/s|km|cm|mm|ml|mb|gb|tb|kw|mw|%|percent|percentage|years?|yrs?|yr|year|°c|℃|℉|年))?/giu;

const YEAR_CONTEXT_PATTERN = /\b(?:year|years|dated|since|until|from|during|after|before|in|on)\b|年/iu;
const ENGLISH_DEFINITION_QUERY_PATTERN = /\b(?:what\s+is|what'?s|what\s+are|who\s+is|define|definition\s+of|meaning\s+of)\b/iu;
const CHINESE_DEFINITION_QUERY_PATTERN = /什么是|指的是什么|定义|是什么意思/u;
const ENGLISH_META_DOCUMENTARY_PATTERN = /\b(?:this|the)\s+(?:technical\s+)?document\b[^.!?\n\r]{0,120}\b(?:aims?|describes?|analy[sz]es?|provides?|outlines?)\b|\bthis\s+(?:section|chapter)\b|\bwe\s+will\b/iu;
const CHINESE_META_DOCUMENTARY_PATTERN = /(?:本|该)?技术文档|本文档|本节|本章|我们将|旨在(?:对|从|说明|分析)|用于阐述/u;

const STRUCTURED_ANCHOR_STOPWORDS = new Set([
    'a',
    'an',
    'and',
    'are',
    'as',
    'at',
    'by',
    'for',
    'from',
    'in',
    'into',
    'is',
    'it',
    'of',
    'on',
    'or',
    'the',
    'to',
    'was',
    'were',
    'with',
    'this',
    'that',
    'these',
    'those',
    '当前',
    '这个',
    '这是',
    '以及',
    '一个',
    '一种',
    '用于',
    '在',
    '是',
    '和',
    '的',
]);

const POLARITY_SENTENCE_SPLIT_PATTERN = /[.!?\u3002\uFF01\uFF1F;\n\r]+/u;

const ENGLISH_POLARITY_NEGATION_PATTERN = /\b(?:not|never|no|none|cannot|is not|are not|was not|were not|do not|does not|did not|can not|could not|should not|would not|will not)\b/i;
const CHINESE_POLARITY_NEGATION_PATTERN = /不是|并非|并不|没有|不能|无法/u;

const POLARITY_NEGATION_NORMALIZATION_RULES: Array<[RegExp, string]> = [
    [/\b(can)(?:not|'t)\b/gi, '$1 not'],
    [/\b(won)(?:'t)\b/gi, 'will not'],
    [/\b(shan)(?:'t)\b/gi, 'shall not'],
    [/\b([a-z]+)n['’]t\b/gi, '$1 not'],
];

const STATE_FRAME_SKIP_VALUE_PATTERN = /\b(?:prerequisite|before|after|depends?\s+on|requires?|sequence)\b|先于|早于|之前|之后|前置条件|前提|依赖/u;

function normalizeWhitespace(value: string): string {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value: string): string {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsCjk(value: string): boolean {
    return /[\u3400-\u9fff]/u.test(String(value || ''));
}

function resolveScopeLabel(scope: KnowledgeQueryResolvedScope): string {
    if (scope.workspaceId) {
        return String(scope.workspaceId).trim();
    }
    if (scope.corpusId) {
        return String(scope.corpusId).trim();
    }
    if (Array.isArray(scope.documentIds) && scope.documentIds[0]) {
        return String(scope.documentIds[0]).trim();
    }
    if (Array.isArray(scope.sourcePathPrefixes) && scope.sourcePathPrefixes[0]) {
        return String(scope.sourcePathPrefixes[0]).trim();
    }
    return '';
}

function buildFriendlyScopeFailureHint(
    scope: KnowledgeQueryResolvedScope
): string {
    const scopeLabel = resolveScopeLabel(scope);
    const readinessStatus = String(scope.readiness?.status || '').trim();
    const missReason = String(scope.missDiagnostics?.reason || '').trim();

    if (containsCjk(scopeLabel) || containsCjk(scope.missDiagnostics?.query || '')) {
        if (readinessStatus === 'empty_store') {
            return scopeLabel
                ? `当前范围“${scopeLabel}”还没有可检索知识。`
                : '当前范围还没有可检索知识。';
        }
        if (readinessStatus === 'workspace_not_found') {
            return scopeLabel
                ? `当前范围“${scopeLabel}”还不存在。`
                : '当前范围还不存在。';
        }
        if (readinessStatus === 'workspace_unbound') {
            return scopeLabel
                ? `当前范围“${scopeLabel}”还没有绑定知识语料。`
                : '当前范围还没有绑定知识语料。';
        }
        if (missReason === 'scope_has_no_indexed_segments') {
            return scopeLabel
                ? `当前范围“${scopeLabel}”里还没有建立可检索索引。`
                : '当前范围里还没有建立可检索索引。';
        }
        if (missReason === 'query_no_title_or_alias_hit') {
            return scopeLabel
                ? `当前范围“${scopeLabel}”里没有找到足够接近这个问题的标题或别名。`
                : '当前范围里没有找到足够接近这个问题的标题或别名。';
        }
        return scopeLabel
            ? `我还不能在当前范围“${scopeLabel}”内把这个回答落到证据上。`
            : '我还不能把这个回答落到证据上。';
    }

    if (readinessStatus === 'empty_store') {
        return scopeLabel
            ? `The current scope "${scopeLabel}" does not contain indexed knowledge yet.`
            : 'The current scope does not contain indexed knowledge yet.';
    }
    if (readinessStatus === 'workspace_not_found') {
        return scopeLabel
            ? `The current scope "${scopeLabel}" does not exist yet.`
            : 'The current scope does not exist yet.';
    }
    if (readinessStatus === 'workspace_unbound') {
        return scopeLabel
            ? `The current scope "${scopeLabel}" is not bound to a knowledge corpus yet.`
            : 'The current scope is not bound to a knowledge corpus yet.';
    }
    if (missReason === 'scope_has_no_indexed_segments') {
        return scopeLabel
            ? `The current scope "${scopeLabel}" has no indexed notes yet.`
            : 'The current scope has no indexed notes yet.';
    }
    if (missReason === 'query_no_title_or_alias_hit') {
        return scopeLabel
            ? `The current scope "${scopeLabel}" has no title or alias close enough to this query.`
            : 'The current scope has no title or alias close enough to this query.';
    }
    return scopeLabel
        ? `I could not ground the answer inside the current scope "${scopeLabel}".`
        : 'I could not ground the answer inside the current scope.';
}

function buildAbstentionAnswer(
    message: string,
    scope: KnowledgeQueryResolvedScope
): string {
    const normalizedMessage = normalizeWhitespace(message);
    const hint = buildFriendlyScopeFailureHint(scope);
    if (containsCjk(normalizedMessage)) {
        return normalizeWhitespace(
            normalizedMessage
                ? `${hint} 我暂时不能对“${normalizedMessage}”给出有依据的回答。请换个说法、放宽范围，或补充相关笔记。`
                : `${hint} 请换个说法、放宽范围，或补充相关笔记。`
        );
    }
    return normalizeWhitespace(
        normalizedMessage
            ? `${hint} I cannot give a grounded answer to "${normalizedMessage}" yet. Refine the wording, widen the scope, or add the missing note.`
            : `${hint} Refine the wording, widen the scope, or add the missing note.`
    );
}

function buildGroundedRevisionAnswer(
    context: AnswerReleaseReviewContext
): string {
    const leadingPoint = context.knowledgePoints[0];
    const summary = normalizeWhitespace(String(
        leadingPoint?.evidenceSnippet
        || leadingPoint?.summary
        || ''
    ));
    const title = normalizeWhitespace(String(leadingPoint?.title || ''));
    const normalizedSummary = summary.toLowerCase();
    const normalizedTitle = title.toLowerCase();
    const summaryAlreadyCarriesTitle = Boolean(
        summary
        && title
        && (
            normalizedSummary.startsWith(normalizedTitle)
            || new RegExp(`^(?:a|an|the)\\s+${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\b|\\s)`, 'i').test(summary)
        )
    );
    if (summary && title && !summaryAlreadyCarriesTitle) {
        return `${title}: ${summary}`;
    }
    return summary || title || normalizeWhitespace(context.draftAnswer);
}

function stripTerminalSentencePunctuation(value: string): string {
    return normalizeWhitespace(String(value || ''))
        .replace(/[.!?\u3002\uFF01\uFF1F;；:：]+$/u, '')
        .trim();
}

function buildDefinitionIntentRevisionAnswer(
    context: AnswerReleaseReviewContext,
    supportFrame: StateFrame & { label: string }
): string {
    const leadingPoint = context.knowledgePoints[0];
    const subject = normalizeWhitespace(String(leadingPoint?.title || supportFrame.subject || ''));
    const value = stripTerminalSentencePunctuation(supportFrame.value);
    const normalizedSurface = normalizeWhitespace(String(supportFrame.surface || ''));
    const useChinese = containsCjk([
        context.message,
        subject,
        value,
        normalizedSurface,
    ].join(' '));
    if (!useChinese && normalizedSurface) {
        const canonicalizedSurface = (
            subject
            && supportFrame.subject
            && normalizedSurface.toLowerCase().startsWith(normalizeWhitespace(supportFrame.subject).toLowerCase())
        )
            ? `${subject}${normalizedSurface.slice(normalizeWhitespace(supportFrame.subject).length)}`
            : normalizedSurface;
        return /[.!?\u3002\uFF01\uFF1F]$/u.test(canonicalizedSurface)
            ? canonicalizedSurface
            : `${canonicalizedSurface}.`;
    }
    if (!subject || !value) {
        return normalizeWhitespace(supportFrame.surface || buildGroundedRevisionAnswer(context));
    }
    if (useChinese) {
        const separator = /[A-Za-z0-9)\]]$/u.test(subject) ? ' 是' : '是';
        return `${subject}${separator}${value}。`;
    }
    return `${subject} is ${value}.`;
}

function buildGraphOrderRevisionAnswer(
    context: AnswerReleaseReviewContext,
    conflict: GraphOrderConflict
): string {
    const earlierTitle = normalizeWhitespace(conflict.evidence.earlierTitle);
    const laterTitle = normalizeWhitespace(conflict.evidence.laterTitle);
    const useChinese = containsCjk([
        context.message,
        context.draftAnswer,
        earlierTitle,
        laterTitle,
    ].join(' '));
    if (useChinese) {
        return conflict.evidence.relationKind === 'prerequisite'
            ? `${earlierTitle}是${laterTitle}的前置条件。`
            : `${earlierTitle}先于${laterTitle}。`;
    }
    return conflict.evidence.relationKind === 'prerequisite'
        ? `${earlierTitle} is a prerequisite for ${laterTitle}.`
        : `${earlierTitle} comes before ${laterTitle}.`;
}

function buildSupportCandidates(
    context: AnswerReleaseReviewContext
): AnswerReleaseSupportCandidate[] {
    const candidates: AnswerReleaseSupportCandidate[] = [];
    context.citations.forEach((citation, index) => {
        const title = normalizeWhitespace(String(citation.title || '').trim()) || `citation_${index + 1}`;
        const snippet = normalizeWhitespace(String(citation.snippet || '').trim());
        const text = [title, snippet].filter(Boolean).join(' ');
        if (text) {
            candidates.push({
                label: title,
                text,
            });
        }
    });
    context.knowledgePoints.forEach((point, index) => {
        const title = normalizeWhitespace(String(point.title || '').trim()) || `knowledge_point_${index + 1}`;
        const snippet = normalizeWhitespace(String(point.evidenceSnippet || point.summary || '').trim());
        const text = [title, snippet].filter(Boolean).join(' ');
        if (text) {
            candidates.push({
                label: title,
                text,
            });
        }
    });
    return candidates;
}

function isGraphOrderSupportedRelationKind(
    value: RelationKind | null | undefined
): value is GraphOrderSupportedRelationKind {
    return value === 'prerequisite' || value === 'sequence';
}

function buildFlexibleTitlePattern(value: string): string {
    const normalized = normalizeWhitespace(value);
    if (!normalized) {
        return '';
    }
    const flexible = normalized
        .split(/\s+/u)
        .filter(Boolean)
        .map((part) => escapeRegExp(part))
        .join('\\s+');
    return /^[a-z0-9 _-]+$/iu.test(normalized)
        ? `\\b${flexible}\\b`
        : flexible;
}

function resolvePathTitle(
    path: NonNullable<AgentConversationGraphContext['connectionPaths']>[number],
    atomId: string
): string {
    const normalizedAtomId = normalizeWhitespace(atomId);
    if (!normalizedAtomId) {
        return '';
    }
    const atomIndex = Array.isArray(path.pathAtomIds)
        ? path.pathAtomIds.findIndex((candidateAtomId: string) => normalizeWhitespace(candidateAtomId) === normalizedAtomId)
        : -1;
    if (atomIndex >= 0 && Array.isArray(path.pathTitles) && path.pathTitles[atomIndex]) {
        return normalizeWhitespace(String(path.pathTitles[atomIndex] || ''));
    }
    if (normalizeWhitespace(path.sourceAtomId) === normalizedAtomId) {
        return normalizeWhitespace(path.sourceTitle);
    }
    if (normalizeWhitespace(path.targetAtomId) === normalizedAtomId) {
        return normalizeWhitespace(path.targetTitle);
    }
    return '';
}

function buildGraphOrderEvidence(
    graphContext: AgentConversationGraphContext | null
): GraphOrderEvidence[] {
    if (!graphContext) {
        return [];
    }
    const evidenceByKey = new Map<string, GraphOrderEvidence>();
    const appendEvidence = (
        relationKind: RelationKind | null | undefined,
        earlierTitle: string,
        laterTitle: string,
        source: GraphOrderEvidence['source']
    ) => {
        if (!isGraphOrderSupportedRelationKind(relationKind)) {
            return;
        }
        const normalizedEarlierTitle = normalizeWhitespace(earlierTitle);
        const normalizedLaterTitle = normalizeWhitespace(laterTitle);
        if (!normalizedEarlierTitle || !normalizedLaterTitle) {
            return;
        }
        if (normalizedEarlierTitle.toLowerCase() === normalizedLaterTitle.toLowerCase()) {
            return;
        }
        const key = `${relationKind}::${normalizedEarlierTitle.toLowerCase()}::${normalizedLaterTitle.toLowerCase()}`;
        if (!evidenceByKey.has(key)) {
            evidenceByKey.set(key, {
                relationKind,
                earlierTitle: normalizedEarlierTitle,
                laterTitle: normalizedLaterTitle,
                source,
            });
        }
    };

    (graphContext.knowledgePointRelations || []).forEach((relation) => {
        appendEvidence(
            relation.relationKind,
            relation.sourceTitle,
            relation.targetTitle,
            'knowledge_point_relation'
        );
    });
    (graphContext.connectionPaths || []).forEach((path) => {
        (path.pathEdges || []).forEach((edge) => {
            appendEvidence(
                edge.relationKind,
                resolvePathTitle(path, edge.fromAtomId),
                resolvePathTitle(path, edge.toAtomId),
                'connection_path'
            );
        });
    });
    (graphContext.predecessorWindow || []).forEach((node) => {
        appendEvidence(
            node.relationKind,
            node.title,
            graphContext.anchorTitle,
            'predecessor_window'
        );
    });
    (graphContext.successorWindow || []).forEach((node) => {
        appendEvidence(
            node.relationKind,
            graphContext.anchorTitle,
            node.title,
            'successor_window'
        );
    });

    return Array.from(evidenceByKey.values());
}

function normalizePolaritySentenceSource(value: string): string {
    return POLARITY_NEGATION_NORMALIZATION_RULES.reduce(
        (current, [pattern, replacement]) => current.replace(pattern, replacement),
        String(value || '')
    );
}

function classifySentencePolarity(value: string): SentencePolarity {
    const normalized = normalizePolaritySentenceSource(value)
        .replace(/\bnot only\b/gi, ' only ')
        .replace(/不仅仅?|不只是/gu, ' ');
    if (
        ENGLISH_POLARITY_NEGATION_PATTERN.test(normalized)
        || CHINESE_POLARITY_NEGATION_PATTERN.test(normalized)
    ) {
        return 'negative';
    }
    return 'positive';
}

function buildPolarityComparableFeatures(value: string): string[] {
    const normalized = normalizePolaritySentenceSource(value)
        .replace(/\bnot only\b/gi, ' only ')
        .replace(/不仅仅?|不只是/gu, ' ')
        .replace(ENGLISH_POLARITY_NEGATION_PATTERN, ' ')
        .replace(CHINESE_POLARITY_NEGATION_PATTERN, ' ');
    return collectLexicalFeatures(normalized)
        .map((feature) => String(feature || '').trim().toLowerCase())
        .filter((feature) => feature.length >= 2)
        .filter((feature) => !STRUCTURED_ANCHOR_STOPWORDS.has(feature));
}

function extractPolaritySentences(value: string): PolaritySentence[] {
    return String(value || '')
        .split(POLARITY_SENTENCE_SPLIT_PATTERN)
        .map((sentence) => normalizeWhitespace(sentence))
        .filter((sentence) => sentence.length >= 8)
        .map((sentence) => ({
            surface: sentence,
            polarity: classifySentencePolarity(sentence),
            comparableFeatures: buildPolarityComparableFeatures(sentence),
        }))
        .filter((sentence) => sentence.comparableFeatures.length >= 2);
}

function computePolarityFeatureOverlap(
    answerSentence: PolaritySentence,
    supportSentence: PolaritySentence
): number {
    if (answerSentence.comparableFeatures.length <= 0 || supportSentence.comparableFeatures.length <= 0) {
        return 0;
    }
    const supportFeatureSet = new Set(supportSentence.comparableFeatures);
    const overlapCount = answerSentence.comparableFeatures.filter((feature) => supportFeatureSet.has(feature)).length;
    return Number((overlapCount / answerSentence.comparableFeatures.length).toFixed(4));
}

function buildPolarityConflictMessage(conflicts: PolaritySentenceConflict[]): string {
    if (conflicts.length <= 0) {
        return 'Draft answer stayed polarity-consistent with the grounded support that could be compared.';
    }
    const fragments = conflicts.slice(0, 2).map((conflict) => (
        `"${conflict.answerSentence.surface}" conflicted with "${conflict.supportSentence.surface}" (${conflict.supportSentence.label})`
    ));
    return `Draft answer reversed the grounded polarity of comparable support: ${fragments.join('; ')}.`;
}

function buildDirectionalGraphOrderPatterns(
    earlierTitle: string,
    laterTitle: string,
    relationKind: GraphOrderSupportedRelationKind
): RegExp[] {
    const earlierPattern = buildFlexibleTitlePattern(earlierTitle);
    const laterPattern = buildFlexibleTitlePattern(laterTitle);
    if (!earlierPattern || !laterPattern) {
        return [];
    }
    const sentenceGap = '[^.!?\\u3002\\uFF01\\uFF1F\\n\\r]{0,80}?';
    const patterns: RegExp[] = [
        new RegExp(`${earlierPattern}${sentenceGap}(?:comes?|came|occurs?|occurred|runs?|ran|happens?|happened)\\s+before${sentenceGap}${laterPattern}`, 'iu'),
        new RegExp(`${earlierPattern}${sentenceGap}preced(?:es|ed)${sentenceGap}${laterPattern}`, 'iu'),
        new RegExp(`${laterPattern}${sentenceGap}(?:comes?|came|occurs?|occurred|runs?|ran|happens?|happened)\\s+after${sentenceGap}${earlierPattern}`, 'iu'),
        new RegExp(`${laterPattern}${sentenceGap}follows?${sentenceGap}${earlierPattern}`, 'iu'),
        new RegExp(`${earlierPattern}${sentenceGap}先于${sentenceGap}${laterPattern}`, 'u'),
        new RegExp(`${earlierPattern}${sentenceGap}早于${sentenceGap}${laterPattern}`, 'u'),
        new RegExp(`${earlierPattern}${sentenceGap}在${sentenceGap}${laterPattern}${sentenceGap}之前`, 'u'),
        new RegExp(`${laterPattern}${sentenceGap}在${sentenceGap}${earlierPattern}${sentenceGap}之后`, 'u'),
    ];
    if (relationKind === 'prerequisite') {
        patterns.push(
            new RegExp(`${earlierPattern}${sentenceGap}(?:is|was|acts as|serves as|functions as|remains)?${sentenceGap}(?:an?\\s+)?prerequisite\\s+(?:for|to)${sentenceGap}${laterPattern}`, 'iu'),
            new RegExp(`${laterPattern}${sentenceGap}depend(?:s|ed|ing)?\\s+on${sentenceGap}${earlierPattern}`, 'iu'),
            new RegExp(`${laterPattern}${sentenceGap}require(?:s|d)?${sentenceGap}${earlierPattern}`, 'iu'),
            new RegExp(`${laterPattern}${sentenceGap}依赖${sentenceGap}${earlierPattern}`, 'u'),
            new RegExp(`${earlierPattern}${sentenceGap}是${sentenceGap}${laterPattern}${sentenceGap}(?:的)?(?:前置条件|前提|先决条件)`, 'u')
        );
    }
    return patterns;
}

function findDirectionalGraphOrderMatch(
    answer: string,
    earlierTitle: string,
    laterTitle: string,
    relationKind: GraphOrderSupportedRelationKind
): string {
    const normalizedAnswer = String(answer || '');
    for (const pattern of buildDirectionalGraphOrderPatterns(earlierTitle, laterTitle, relationKind)) {
        const match = normalizedAnswer.match(pattern);
        if (match && match[0]) {
            return normalizeWhitespace(match[0]);
        }
    }
    return '';
}

function buildGraphOrderConflictMessage(conflicts: GraphOrderConflict[]): string {
    if (conflicts.length <= 0) {
        return 'Draft answer stayed consistent with the grounded graph order that could be compared.';
    }
    const fragments = conflicts.slice(0, 2).map((conflict) => (
        `"${conflict.answerSurface}" reversed ${conflict.evidence.earlierTitle} -> ${conflict.evidence.relationKind} -> ${conflict.evidence.laterTitle}`
    ));
    return `Draft answer reversed grounded graph order: ${fragments.join('; ')}.`;
}

function collectLeakedInternalFragments(answer: string): string[] {
    const normalizedAnswer = String(answer || '');
    return INTERNAL_DIAGNOSTIC_FRAGMENTS.filter((fragment) => normalizedAnswer.includes(fragment));
}

function collectLexicalFeatures(value: string): string[] {
    const normalized = String(value || '').toLowerCase();
    const features = new Set<string>();
    const asciiTokens = normalized.match(/[a-z0-9]+/g) || [];
    asciiTokens.forEach((token) => {
        if (token.length >= 2) {
            features.add(token);
        }
    });
    const cjkRuns = normalized.match(/[\u3400-\u9fff]+/gu) || [];
    cjkRuns.forEach((run) => {
        const trimmed = String(run || '').trim();
        if (!trimmed) {
            return;
        }
        if (trimmed.length <= 2) {
            features.add(trimmed);
            return;
        }
        for (let index = 0; index < trimmed.length - 1; index += 1) {
            features.add(trimmed.slice(index, index + 2));
        }
    });
    return [...features];
}

function collectOrderedLexicalFeatures(value: string): string[] {
    const normalized = String(value || '').toLowerCase();
    const features: string[] = [];
    const seen = new Set<string>();
    const append = (feature: string) => {
        const normalizedFeature = String(feature || '').trim();
        if (!normalizedFeature || seen.has(normalizedFeature)) {
            return;
        }
        seen.add(normalizedFeature);
        features.push(normalizedFeature);
    };
    const asciiTokens = normalized.match(/[a-z0-9]+/g) || [];
    asciiTokens.forEach((token) => {
        if (token.length >= 2) {
            append(token);
        }
    });
    const cjkRuns = normalized.match(/[\u3400-\u9fff]+/gu) || [];
    cjkRuns.forEach((run) => {
        const trimmed = String(run || '').trim();
        if (!trimmed) {
            return;
        }
        if (trimmed.length <= 2) {
            append(trimmed);
            return;
        }
        for (let index = 0; index < trimmed.length - 1; index += 1) {
            append(trimmed.slice(index, index + 2));
        }
    });
    return features;
}

function computeFeatureOverlapRatio(left: string[], right: string[]): number {
    if (left.length <= 0 || right.length <= 0) {
        return 0;
    }
    const rightSet = new Set(right);
    const overlapCount = left.filter((feature) => rightSet.has(feature)).length;
    return Number((overlapCount / left.length).toFixed(4));
}

function computeFeatureJaccard(left: string[], right: string[]): number {
    if (left.length <= 0 || right.length <= 0) {
        return 0;
    }
    const leftSet = new Set(left);
    const rightSet = new Set(right);
    let overlapCount = 0;
    leftSet.forEach((feature) => {
        if (rightSet.has(feature)) {
            overlapCount += 1;
        }
    });
    const unionCount = leftSet.size + rightSet.size - overlapCount;
    if (unionCount <= 0) {
        return 0;
    }
    return Number((overlapCount / unionCount).toFixed(4));
}

function buildStateFrameFeatures(value: string): string[] {
    return collectOrderedLexicalFeatures(value)
        .map((feature) => String(feature || '').trim().toLowerCase())
        .filter((feature) => feature.length >= 2)
        .filter((feature) => !STRUCTURED_ANCHOR_STOPWORDS.has(feature));
}

function buildSubjectFrameFeatures(value: string): string[] {
    return collectOrderedLexicalFeatures(value)
        .map((feature) => String(feature || '').trim().toLowerCase())
        .filter((feature) => feature.length >= 2)
        .filter((feature) => !STRUCTURED_ANCHOR_STOPWORDS.has(feature));
}

function normalizeStateFrameSubject(value: string): string {
    return normalizeWhitespace(String(value || ''))
        .replace(/^(?:a|an|the)\s+/i, '')
        .replace(/[,:;]+$/g, '')
        .trim();
}

function normalizeSubjectFrameSubject(value: string): string {
    return normalizeWhitespace(String(value || ''))
        .replace(/^(?:a|an|the)\s+/i, '')
        .replace(/[,:;]+$/g, '')
        .trim();
}

function normalizeStateFrameValue(value: string): string {
    return normalizeWhitespace(String(value || ''))
        .replace(/^(?:a|an|the)\s+/i, '')
        .replace(/[,:;]+$/g, '')
        .trim();
}

function normalizeSubjectFrameTail(value: string): string {
    return normalizeWhitespace(String(value || ''))
        .replace(/^(?:a|an|the)\s+/i, '')
        .replace(/[,:;]+$/g, '')
        .trim();
}

function buildStateFrame(
    surface: string,
    subject: string,
    connectorKind: StateFrameConnectorKind,
    value: string
): StateFrame | null {
    const normalizedSurface = normalizeWhitespace(surface);
    const normalizedSubject = normalizeStateFrameSubject(subject);
    const normalizedValue = normalizeStateFrameValue(value);
    if (!normalizedSurface || !normalizedSubject || !normalizedValue) {
        return null;
    }
    if (/\d/u.test(normalizedValue) || STATE_FRAME_SKIP_VALUE_PATTERN.test(normalizedValue)) {
        return null;
    }
    const subjectFeatures = buildStateFrameFeatures(normalizedSubject);
    const valueFeatures = buildStateFrameFeatures(normalizedValue);
    if (subjectFeatures.length <= 0 || valueFeatures.length <= 0) {
        return null;
    }
    return {
        surface: normalizedSurface,
        subject: normalizedSubject,
        subjectFeatures,
        connectorKind,
        value: normalizedValue,
        valueFeatures,
        tailFeatures: valueFeatures.slice(-2),
    };
}

function extractStateFrames(value: string): StateFrame[] {
    const patterns: Array<{ pattern: RegExp; connectorKind: StateFrameConnectorKind }> = [
        {
            pattern: /^(.{1,80}?)\s+(?:is|are|was|were)\s+defined\s+as\s+(.+)$/iu,
            connectorKind: 'definition',
        },
        {
            pattern: /^(.{1,80}?)\s+(?:is|are|was|were|means|refers to|belongs to)\s+(.+)$/iu,
            connectorKind: 'definition',
        },
        {
            pattern: /^(.{1,24}?)(?:被定义为|定义为)(.+)$/u,
            connectorKind: 'definition',
        },
        {
            pattern: /^(.{1,24}?)(?:是|指|属于)(.+)$/u,
            connectorKind: 'definition',
        },
    ];
    return String(value || '')
        .split(POLARITY_SENTENCE_SPLIT_PATTERN)
        .map((sentence) => normalizeWhitespace(sentence))
        .filter((sentence) => sentence.length >= 8 || (containsCjk(sentence) && sentence.length >= 5))
        .flatMap((sentence) => {
            for (const candidate of patterns) {
                const match = sentence.match(candidate.pattern);
                if (!match) {
                    continue;
                }
                const frame = buildStateFrame(
                    sentence,
                    String(match[1] || ''),
                    candidate.connectorKind,
                    String(match[2] || '')
                );
                return frame ? [frame] : [];
            }
            return [];
        });
}

function buildSubjectFrame(
    surface: string,
    subject: string,
    tail: string
): SubjectFrame | null {
    const normalizedSurface = normalizeWhitespace(surface);
    const normalizedSubject = normalizeSubjectFrameSubject(subject);
    const normalizedTail = normalizeSubjectFrameTail(tail);
    if (!normalizedSurface || !normalizedSubject || !normalizedTail) {
        return null;
    }
    const subjectFeatures = buildSubjectFrameFeatures(normalizedSubject);
    const tailFeatures = buildSubjectFrameFeatures(normalizedTail);
    if (subjectFeatures.length <= 0 || tailFeatures.length <= 0) {
        return null;
    }
    return {
        surface: normalizedSurface,
        subject: normalizedSubject,
        subjectFeatures,
        tail: normalizedTail,
        tailFeatures,
    };
}

function extractSubjectFrames(value: string): SubjectFrame[] {
    const patterns: RegExp[] = [
        /^(.{1,80}?)\s+(?:is|are|was|were|remains|stays|equals|means|refers to|belongs to|has|contains)\s+(.+)$/iu,
        /^(.{1,24}?)(?:是|为|等于|指|属于|有|包含)(.+)$/u,
    ];
    return String(value || '')
        .split(POLARITY_SENTENCE_SPLIT_PATTERN)
        .map((sentence) => normalizeWhitespace(sentence))
        .filter((sentence) => sentence.length >= 8 || (containsCjk(sentence) && sentence.length >= 5))
        .flatMap((sentence) => {
            for (const pattern of patterns) {
                const match = sentence.match(pattern);
                if (!match) {
                    continue;
                }
                const frame = buildSubjectFrame(
                    sentence,
                    String(match[1] || ''),
                    String(match[2] || '')
                );
                return frame ? [frame] : [];
            }
            return [];
        });
}

function subjectFramesShareTail(answerFrame: SubjectFrame, supportFrame: SubjectFrame): boolean {
    const overlapRatio = computeFeatureOverlapRatio(answerFrame.tailFeatures, supportFrame.tailFeatures);
    const jaccard = computeFeatureJaccard(answerFrame.tailFeatures, supportFrame.tailFeatures);
    return overlapRatio >= 0.75 || jaccard >= 0.7;
}

function subjectFramesEquivalent(answerFrame: SubjectFrame, supportFrame: SubjectFrame): boolean {
    const normalizedAnswerSubject = normalizeWhitespace(answerFrame.subject).toLowerCase();
    const normalizedSupportSubject = normalizeWhitespace(supportFrame.subject).toLowerCase();
    if (!normalizedAnswerSubject || !normalizedSupportSubject) {
        return false;
    }
    if (normalizedAnswerSubject === normalizedSupportSubject) {
        return true;
    }
    return computeFeatureOverlapRatio(answerFrame.subjectFeatures, supportFrame.subjectFeatures) >= 0.75;
}

function computeSubjectFrameTailOverlap(answerFrame: SubjectFrame, supportFrame: SubjectFrame): number {
    return computeFeatureOverlapRatio(answerFrame.tailFeatures, supportFrame.tailFeatures);
}

function buildSubjectConflictMessage(conflicts: SubjectFrameConflict[]): string {
    if (conflicts.length <= 0) {
        return 'Draft answer stayed subject-consistent with the grounded support that could be compared.';
    }
    const fragments = conflicts.slice(0, 2).map((conflict) => (
        `"${conflict.answerFrame.surface}" kept the supported fact tail but changed the subject from "${conflict.supportFrame.subject}" (${conflict.supportFrame.label})`
    ));
    return `Draft answer changed the grounded subject of comparable support: ${fragments.join('; ')}.`;
}

function stateFrameSubjectsComparable(answerFrame: StateFrame, supportFrame: StateFrame): boolean {
    const normalizedAnswerSubject = normalizeWhitespace(answerFrame.subject).toLowerCase();
    const normalizedSupportSubject = normalizeWhitespace(supportFrame.subject).toLowerCase();
    if (!normalizedAnswerSubject || !normalizedSupportSubject) {
        return false;
    }
    if (
        normalizedAnswerSubject.includes(normalizedSupportSubject)
        || normalizedSupportSubject.includes(normalizedAnswerSubject)
    ) {
        return true;
    }
    return computeFeatureOverlapRatio(answerFrame.subjectFeatures, supportFrame.subjectFeatures) >= 0.6;
}

function stateFrameValuesEquivalent(answerFrame: StateFrame, supportFrame: StateFrame): boolean {
    const normalizedAnswerValue = normalizeWhitespace(answerFrame.value).toLowerCase();
    const normalizedSupportValue = normalizeWhitespace(supportFrame.value).toLowerCase();
    if (!normalizedAnswerValue || !normalizedSupportValue) {
        return false;
    }
    if (
        normalizedAnswerValue === normalizedSupportValue
        || normalizedAnswerValue.includes(normalizedSupportValue)
        || normalizedSupportValue.includes(normalizedAnswerValue)
    ) {
        return true;
    }
    return computeFeatureJaccard(answerFrame.valueFeatures, supportFrame.valueFeatures) >= 0.85;
}

function stateFrameTailOverlapCount(answerFrame: StateFrame, supportFrame: StateFrame): number {
    if (answerFrame.tailFeatures.length <= 0 || supportFrame.tailFeatures.length <= 0) {
        return 0;
    }
    const supportTailSet = new Set(supportFrame.tailFeatures);
    return answerFrame.tailFeatures.filter((feature) => supportTailSet.has(feature)).length;
}

function stateFramesComparable(answerFrame: StateFrame, supportFrame: StateFrame): boolean {
    if (!stateFrameSubjectsComparable(answerFrame, supportFrame)) {
        return false;
    }
    if (answerFrame.connectorKind !== supportFrame.connectorKind) {
        return false;
    }
    if (stateFrameValuesEquivalent(answerFrame, supportFrame)) {
        return true;
    }
    return stateFrameTailOverlapCount(answerFrame, supportFrame) > 0;
}

function buildStateConflictMessage(conflicts: StateFrameConflict[]): string {
    if (conflicts.length <= 0) {
        return 'Draft answer stayed state-consistent with the grounded support that could be compared.';
    }
    const fragments = conflicts.slice(0, 2).map((conflict) => (
        `"${conflict.answerFrame.surface}" conflicted with "${conflict.supportFrame.surface}" (${conflict.supportFrame.label})`
    ));
    return `Draft answer contradicted comparable grounded state frames: ${fragments.join('; ')}.`;
}

function computeGroundingAlignmentScore(answer: string, supportText: string): number {
    const normalizedAnswer = normalizeWhitespace(answer).toLowerCase();
    const normalizedSupport = normalizeWhitespace(supportText).toLowerCase();
    if (!normalizedAnswer || !normalizedSupport) {
        return 0;
    }
    if (normalizedSupport.includes(normalizedAnswer) || normalizedAnswer.includes(normalizedSupport)) {
        return 1;
    }
    const answerFeatures = collectLexicalFeatures(normalizedAnswer);
    const supportFeatures = new Set(collectLexicalFeatures(normalizedSupport));
    if (answerFeatures.length <= 0 || supportFeatures.size <= 0) {
        return 0;
    }
    const overlapCount = answerFeatures.filter((feature) => supportFeatures.has(feature)).length;
    return Number((overlapCount / answerFeatures.length).toFixed(4));
}

function evaluateGroundingAlignment(context: AnswerReleaseReviewContext): {
    passed: boolean;
    bestScore: number;
    bestLabel: string;
} {
    const candidates = buildSupportCandidates(context);
    if (candidates.length <= 0) {
        return {
            passed: false,
            bestScore: 0,
            bestLabel: '',
        };
    }
    const scored = candidates
        .map((candidate) => ({
            label: candidate.label,
            score: computeGroundingAlignmentScore(context.draftAnswer, candidate.text),
        }))
        .sort((left, right) => right.score - left.score);
    const best = scored[0] || { label: '', score: 0 };
    return {
        passed: best.score >= 0.3,
        bestScore: best.score,
        bestLabel: best.label,
    };
}

function isDefinitionIntentQuery(message: string): boolean {
    const normalizedMessage = normalizeWhitespace(message);
    if (!normalizedMessage) {
        return false;
    }
    return (
        ENGLISH_DEFINITION_QUERY_PATTERN.test(normalizedMessage)
        || CHINESE_DEFINITION_QUERY_PATTERN.test(normalizedMessage)
    );
}

function isMetaDocumentaryAnswer(answer: string): boolean {
    const normalizedAnswer = normalizeWhitespace(answer);
    if (!normalizedAnswer) {
        return false;
    }
    return (
        ENGLISH_META_DOCUMENTARY_PATTERN.test(normalizedAnswer)
        || CHINESE_META_DOCUMENTARY_PATTERN.test(normalizedAnswer)
    );
}

function evaluateQueryIntentAlignment(
    context: AnswerReleaseReviewContext
): QueryIntentAlignmentResult {
    if (!isDefinitionIntentQuery(context.message)) {
        return {
            passed: true,
            applicable: false,
            comparableFrameCount: 0,
            supportFrame: null,
        };
    }
    const supportFrames = buildSupportCandidates(context).flatMap((candidate) => (
        extractStateFrames(candidate.text)
            .filter((frame) => frame.connectorKind === 'definition')
            .map((frame) => ({
                ...frame,
                label: candidate.label,
            }))
    ));
    const primarySupportFrame = supportFrames[0] || null;
    if (!primarySupportFrame) {
        return {
            passed: true,
            applicable: true,
            comparableFrameCount: 0,
            supportFrame: null,
        };
    }
    return {
        passed: !isMetaDocumentaryAnswer(context.draftAnswer),
        applicable: true,
        comparableFrameCount: supportFrames.length,
        supportFrame: primarySupportFrame,
    };
}

function normalizeStructuredUnit(rawUnit: string): string {
    const normalized = String(rawUnit || '').trim().toLowerCase();
    if (!normalized) {
        return '';
    }
    return STRUCTURED_UNIT_ALIASES[normalized] || normalized;
}

function collectStructuredAnchorTokens(value: string): string[] {
    return collectLexicalFeatures(value)
        .map((feature) => String(feature || '').trim().toLowerCase())
        .filter((feature) => feature.length >= 2)
        .filter((feature) => !STRUCTURED_ANCHOR_STOPWORDS.has(feature))
        .slice(-3);
}

function extractStructuredFacts(value: string): StructuredFact[] {
    const text = String(value || '');
    if (!text) {
        return [];
    }
    const facts: StructuredFact[] = [];
    for (const match of text.matchAll(STRUCTURED_FACT_PATTERN)) {
        const rawNumber = String(match[1] || '').trim();
        const rawUnit = String(match[2] || '').trim();
        const numericValue = Number(rawNumber.replace(/,/g, ''));
        if (!Number.isFinite(numericValue)) {
            continue;
        }
        const startIndex = Number(match.index || 0);
        const surface = normalizeWhitespace(String(match[0] || ''));
        const endIndex = startIndex + String(match[0] || '').length;
        const preWindow = text.slice(Math.max(0, startIndex - 48), startIndex);
        const postWindow = text.slice(endIndex, Math.min(text.length, endIndex + 24));
        let kind: StructuredFactKind | null = null;
        let unit = normalizeStructuredUnit(rawUnit);
        if (unit) {
            kind = unit === 'year' ? 'year' : 'number_with_unit';
        } else if (
            Number.isInteger(numericValue)
            && numericValue >= 1000
            && numericValue <= 2099
            && YEAR_CONTEXT_PATTERN.test(`${preWindow} ${postWindow}`)
        ) {
            kind = 'year';
            unit = 'year';
        }
        if (!kind) {
            continue;
        }
        const anchorTokens = collectStructuredAnchorTokens(preWindow);
        const resolvedAnchorTokens = anchorTokens.length > 0
            ? anchorTokens
            : collectStructuredAnchorTokens(postWindow).slice(0, 2);
        facts.push({
            kind,
            value: numericValue,
            unit,
            surface,
            anchorTokens: resolvedAnchorTokens,
        });
    }
    return facts;
}

function structuredFactValuesMatch(answerFact: StructuredFact, supportFact: StructuredFact): boolean {
    if (answerFact.kind !== supportFact.kind || answerFact.unit !== supportFact.unit) {
        return false;
    }
    if (answerFact.kind === 'year') {
        return Math.trunc(answerFact.value) === Math.trunc(supportFact.value);
    }
    return Math.abs(answerFact.value - supportFact.value) <= 0.000001;
}

function structuredFactAnchorsOverlap(answerFact: StructuredFact, supportFact: StructuredFact): boolean {
    if (answerFact.anchorTokens.length <= 0 || supportFact.anchorTokens.length <= 0) {
        return true;
    }
    const supportAnchorTokenSet = new Set(supportFact.anchorTokens);
    return answerFact.anchorTokens.some((token) => supportAnchorTokenSet.has(token));
}

function buildStructuredFactConflictMessage(conflicts: StructuredFactConflict[]): string {
    if (conflicts.length <= 0) {
        return 'Draft answer stayed consistent with the grounded structured facts that could be compared.';
    }
    const fragments = conflicts.slice(0, 2).map((conflict) => {
        const supportedValues = Array.from(new Set(
            conflict.supportFacts.map((fact) => normalizeWhitespace(`${fact.surface} (${fact.label})`))
        ));
        return `"${conflict.answerFact.surface}" conflicted with ${supportedValues.join(', ')}`;
    });
    return `Draft answer conflicted with grounded structured facts: ${fragments.join('; ')}.`;
}

function evaluateStructuredConsistency(context: AnswerReleaseReviewContext): {
    passed: boolean;
    comparableFactCount: number;
    conflicts: StructuredFactConflict[];
} {
    const answerFacts = extractStructuredFacts(context.draftAnswer);
    if (answerFacts.length <= 0) {
        return {
            passed: true,
            comparableFactCount: 0,
            conflicts: [],
        };
    }
    const supportFacts = buildSupportCandidates(context).flatMap((candidate) => (
        extractStructuredFacts(candidate.text).map((fact) => ({
            ...fact,
            label: candidate.label,
        }))
    ));
    if (supportFacts.length <= 0) {
        return {
            passed: true,
            comparableFactCount: 0,
            conflicts: [],
        };
    }
    const conflicts: StructuredFactConflict[] = [];
    let comparableFactCount = 0;
    answerFacts.forEach((answerFact) => {
        const comparableSupportFacts = supportFacts.filter((supportFact) => (
            answerFact.kind === supportFact.kind
            && answerFact.unit === supportFact.unit
            && structuredFactAnchorsOverlap(answerFact, supportFact)
        ));
        if (comparableSupportFacts.length <= 0) {
            return;
        }
        comparableFactCount += 1;
        if (comparableSupportFacts.some((supportFact) => structuredFactValuesMatch(answerFact, supportFact))) {
            return;
        }
        conflicts.push({
            answerFact,
            supportFacts: comparableSupportFacts.slice(0, 3),
        });
    });
    return {
        passed: conflicts.length <= 0,
        comparableFactCount,
        conflicts,
    };
}

function evaluateSubjectConsistency(context: AnswerReleaseReviewContext): {
    passed: boolean;
    comparableFrameCount: number;
    conflicts: SubjectFrameConflict[];
} {
    const answerFrames = extractSubjectFrames(context.draftAnswer);
    if (answerFrames.length <= 0) {
        return {
            passed: true,
            comparableFrameCount: 0,
            conflicts: [],
        };
    }
    const supportFrames = buildSupportCandidates(context).flatMap((candidate) => (
        extractSubjectFrames(candidate.text).map((frame) => ({
            ...frame,
            label: candidate.label,
        }))
    ));
    if (supportFrames.length <= 0) {
        return {
            passed: true,
            comparableFrameCount: 0,
            conflicts: [],
        };
    }
    const conflicts: SubjectFrameConflict[] = [];
    let comparableFrameCount = 0;
    answerFrames.forEach((answerFrame) => {
        const comparableSupportFrames = supportFrames.filter((supportFrame) => (
            subjectFramesShareTail(answerFrame, supportFrame)
        ));
        if (comparableSupportFrames.length <= 0) {
            return;
        }
        comparableFrameCount += 1;
        if (comparableSupportFrames.some((supportFrame) => subjectFramesEquivalent(answerFrame, supportFrame))) {
            return;
        }
        conflicts.push({
            answerFrame,
            supportFrame: comparableSupportFrames
                .slice()
                .sort((left, right) => (
                    computeSubjectFrameTailOverlap(answerFrame, right)
                    - computeSubjectFrameTailOverlap(answerFrame, left)
                ))[0],
        });
    });
    return {
        passed: conflicts.length <= 0,
        comparableFrameCount,
        conflicts: conflicts.filter((conflict) => Boolean(conflict.supportFrame)),
    };
}

function evaluateStateConsistency(context: AnswerReleaseReviewContext): {
    passed: boolean;
    comparableFrameCount: number;
    conflicts: StateFrameConflict[];
} {
    const answerFrames = extractStateFrames(context.draftAnswer);
    if (answerFrames.length <= 0) {
        return {
            passed: true,
            comparableFrameCount: 0,
            conflicts: [],
        };
    }
    const supportFrames = buildSupportCandidates(context).flatMap((candidate) => (
        extractStateFrames(candidate.text).map((frame) => ({
            ...frame,
            label: candidate.label,
        }))
    ));
    if (supportFrames.length <= 0) {
        return {
            passed: true,
            comparableFrameCount: 0,
            conflicts: [],
        };
    }
    const conflicts: StateFrameConflict[] = [];
    let comparableFrameCount = 0;
    answerFrames.forEach((answerFrame) => {
        const comparableSupportFrames = supportFrames.filter((supportFrame) => (
            stateFramesComparable(answerFrame, supportFrame)
        ));
        if (comparableSupportFrames.length <= 0) {
            return;
        }
        comparableFrameCount += 1;
        if (comparableSupportFrames.some((supportFrame) => stateFrameValuesEquivalent(answerFrame, supportFrame))) {
            return;
        }
        conflicts.push({
            answerFrame,
            supportFrame: comparableSupportFrames
                .slice()
                .sort((left, right) => (
                    stateFrameTailOverlapCount(answerFrame, right) - stateFrameTailOverlapCount(answerFrame, left)
                ))[0],
        });
    });
    return {
        passed: conflicts.length <= 0,
        comparableFrameCount,
        conflicts: conflicts.filter((conflict) => Boolean(conflict.supportFrame)),
    };
}

function evaluatePolarityConsistency(context: AnswerReleaseReviewContext): {
    passed: boolean;
    comparableSentenceCount: number;
    conflicts: PolaritySentenceConflict[];
} {
    const answerSentences = extractPolaritySentences(context.draftAnswer);
    if (answerSentences.length <= 0) {
        return {
            passed: true,
            comparableSentenceCount: 0,
            conflicts: [],
        };
    }
    const supportSentences = buildSupportCandidates(context).flatMap((candidate) => (
        extractPolaritySentences(candidate.text).map((sentence) => ({
            ...sentence,
            label: candidate.label,
        }))
    ));
    if (supportSentences.length <= 0) {
        return {
            passed: true,
            comparableSentenceCount: 0,
            conflicts: [],
        };
    }
    const conflicts: PolaritySentenceConflict[] = [];
    let comparableSentenceCount = 0;
    answerSentences.forEach((answerSentence) => {
        const comparableSupportSentences = supportSentences.filter((supportSentence) => (
            computePolarityFeatureOverlap(answerSentence, supportSentence) >= 0.6
        ));
        if (comparableSupportSentences.length <= 0) {
            return;
        }
        comparableSentenceCount += 1;
        if (comparableSupportSentences.some((supportSentence) => supportSentence.polarity === answerSentence.polarity)) {
            return;
        }
        const conflictingSupportSentence = comparableSupportSentences[0];
        if (conflictingSupportSentence) {
            conflicts.push({
                answerSentence,
                supportSentence: conflictingSupportSentence,
            });
        }
    });
    return {
        passed: conflicts.length <= 0,
        comparableSentenceCount,
        conflicts,
    };
}

function evaluateGraphOrderConsistency(context: AnswerReleaseReviewContext): {
    passed: boolean;
    comparableClaimCount: number;
    conflicts: GraphOrderConflict[];
} {
    const orderEvidence = buildGraphOrderEvidence(context.graphContext);
    if (orderEvidence.length <= 0) {
        return {
            passed: true,
            comparableClaimCount: 0,
            conflicts: [],
        };
    }
    const conflicts: GraphOrderConflict[] = [];
    let comparableClaimCount = 0;
    orderEvidence.forEach((evidence) => {
        const consistentMatch = findDirectionalGraphOrderMatch(
            context.draftAnswer,
            evidence.earlierTitle,
            evidence.laterTitle,
            evidence.relationKind
        );
        const reversedMatch = findDirectionalGraphOrderMatch(
            context.draftAnswer,
            evidence.laterTitle,
            evidence.earlierTitle,
            evidence.relationKind
        );
        if (!consistentMatch && !reversedMatch) {
            return;
        }
        comparableClaimCount += 1;
        if (reversedMatch && !consistentMatch) {
            conflicts.push({
                answerSurface: reversedMatch,
                evidence,
            });
        }
    });
    return {
        passed: conflicts.length <= 0,
        comparableClaimCount,
        conflicts,
    };
}

function checkPublicSurfaceContraction(answer: string): boolean {
    const normalizedAnswer = String(answer || '');
    if (normalizeWhitespace(normalizedAnswer).length > 320) {
        return false;
    }
    return !(
        /\bGrounded by\b/i.test(normalizedAnswer)
        || /\bKey evidence\b/i.test(normalizedAnswer)
        || /\bCitations?:\b/i.test(normalizedAnswer)
        || /\n\s*[-*]\s+/u.test(normalizedAnswer)
    );
}

function buildDecision(
    groundedEvidenceAvailable: boolean,
    groundingAlignmentPassed: boolean,
    queryIntentAlignmentPassed: boolean,
    structuredConsistencyPassed: boolean,
    subjectConsistencyPassed: boolean,
    stateConsistencyPassed: boolean,
    polarityConsistencyPassed: boolean,
    graphOrderConsistencyPassed: boolean,
    leakedInternalFragments: string[],
    publicSurfaceContracted: boolean
): AnswerReleaseDecision {
    if (!groundedEvidenceAvailable) {
        return 'abstain';
    }
    if (
        !groundingAlignmentPassed
        || !queryIntentAlignmentPassed
        || !structuredConsistencyPassed
        || !subjectConsistencyPassed
        || !stateConsistencyPassed
        || !polarityConsistencyPassed
        || !graphOrderConsistencyPassed
        || leakedInternalFragments.length > 0
        || !publicSurfaceContracted
    ) {
        return 'revise';
    }
    return 'release';
}

function buildReason(
    decision: AnswerReleaseDecision,
    groundedEvidenceAvailable: boolean
): string {
    if (decision === 'release') {
        return 'Draft answer satisfied the public-release gates.';
    }
    if (decision === 'revise') {
        return 'Draft answer had usable evidence but required contraction before public release.';
    }
    return groundedEvidenceAvailable
        ? 'Draft answer was downgraded even though some evidence existed.'
        : 'Draft answer lacked grounded evidence, so the public answer was downgraded to a concise abstention.';
}

export function reviewAnswerRelease(context: AnswerReleaseReviewContext): AnswerReleaseReview {
    const draftAnswer = normalizeWhitespace(context.draftAnswer);
    const groundedEvidenceAvailable = context.knowledgePoints.length > 0 || context.citations.length > 0;
    const leakedInternalFragments = collectLeakedInternalFragments(draftAnswer);
    const groundingAlignment = groundedEvidenceAvailable
        ? evaluateGroundingAlignment({
            ...context,
            draftAnswer,
        })
        : {
            passed: true,
            bestScore: 1,
            bestLabel: '',
        };
    const queryIntentAlignment = groundedEvidenceAvailable
        ? evaluateQueryIntentAlignment({
            ...context,
            draftAnswer,
        })
        : {
            passed: true,
            applicable: false,
            comparableFrameCount: 0,
            supportFrame: null,
        };
    const structuredConsistency = groundedEvidenceAvailable
        ? evaluateStructuredConsistency({
            ...context,
            draftAnswer,
        })
        : {
            passed: true,
            comparableFactCount: 0,
            conflicts: [],
        };
    const subjectConsistency = groundedEvidenceAvailable
        ? evaluateSubjectConsistency({
            ...context,
            draftAnswer,
        })
        : {
            passed: true,
            comparableFrameCount: 0,
            conflicts: [],
        };
    const stateConsistency = groundedEvidenceAvailable
        ? evaluateStateConsistency({
            ...context,
            draftAnswer,
        })
        : {
            passed: true,
            comparableFrameCount: 0,
            conflicts: [],
        };
    const polarityConsistency = groundedEvidenceAvailable
        ? evaluatePolarityConsistency({
            ...context,
            draftAnswer,
        })
        : {
            passed: true,
            comparableSentenceCount: 0,
            conflicts: [],
        };
    const graphOrderConsistency = groundedEvidenceAvailable
        ? evaluateGraphOrderConsistency({
            ...context,
            draftAnswer,
        })
        : {
            passed: true,
            comparableClaimCount: 0,
            conflicts: [],
        };
    const publicSurfaceContracted = checkPublicSurfaceContraction(draftAnswer);
    const graphSupportCount = context.graphContext
        ? (
            (Array.isArray(context.graphContext.relationSummaries) ? context.graphContext.relationSummaries.length : 0)
            + (Array.isArray(context.graphContext.connectionPaths) ? context.graphContext.connectionPaths.length : 0)
            + (Array.isArray(context.graphContext.supportingAtomIds) ? context.graphContext.supportingAtomIds.length : 0)
        )
        : 0;
    const graphSupportSufficient = context.knowledgePoints.length <= 0 || graphSupportCount > 0 || Boolean(context.graphContext?.anchorAtomId);
    const decision = buildDecision(
        groundedEvidenceAvailable,
        groundingAlignment.passed,
        queryIntentAlignment.passed,
        structuredConsistency.passed,
        subjectConsistency.passed,
        stateConsistency.passed,
        polarityConsistency.passed,
        graphOrderConsistency.passed,
        leakedInternalFragments,
        publicSurfaceContracted
    );
    const primaryGraphOrderConflict = graphOrderConsistency.conflicts[0];
    const publicAnswer = normalizeWhitespace(
        decision === 'abstain'
            ? buildAbstentionAnswer(context.message, context.usedScope)
            : decision === 'revise'
                ? (
                    primaryGraphOrderConflict
                        ? buildGraphOrderRevisionAnswer(context, primaryGraphOrderConflict)
                        : (!queryIntentAlignment.passed && queryIntentAlignment.supportFrame)
                            ? buildDefinitionIntentRevisionAnswer(context, queryIntentAlignment.supportFrame)
                        : buildGroundedRevisionAnswer(context)
                )
                : draftAnswer
    );
    const abstentionHygienePassed = decision !== 'abstain'
        || (
            collectLeakedInternalFragments(publicAnswer).length <= 0
            && !/\bretrieval\b/i.test(publicAnswer)
            && !/\bplanner\b/i.test(publicAnswer)
        );
    const gates: AnswerReleaseGate[] = [
        {
            gateId: 'evidence_sufficiency',
            passed: groundedEvidenceAvailable,
            message: groundedEvidenceAvailable
                ? 'Grounded evidence was available for public release.'
                : 'No grounded evidence was available, so the answer must abstain.',
        },
        {
            gateId: 'graph_support_sufficiency',
            passed: graphSupportSufficient,
            message: graphSupportSufficient
                ? 'Graph context stayed sufficient for the current answer shape.'
                : 'Graph context was too thin for a confident grounded answer.',
        },
        {
            gateId: 'claim_grounding_alignment',
            passed: groundingAlignment.passed,
            message: groundedEvidenceAvailable
                ? (
                    groundingAlignment.passed
                        ? `Draft answer stayed aligned with grounded support (best support: ${groundingAlignment.bestLabel || 'primary evidence'}, score ${Math.round(groundingAlignment.bestScore * 100)}%).`
                        : `Draft answer drifted away from grounded support (best support: ${groundingAlignment.bestLabel || 'primary evidence'}, score ${Math.round(groundingAlignment.bestScore * 100)}%).`
                )
                : 'No evidence was available, so claim-grounding alignment was not evaluated.',
        },
        {
            gateId: 'query_intent_alignment',
            passed: queryIntentAlignment.passed,
            message: groundedEvidenceAvailable
                ? (
                    !queryIntentAlignment.applicable
                        ? 'The current query did not require definition-intent alignment.'
                        : queryIntentAlignment.comparableFrameCount > 0
                            ? (
                                queryIntentAlignment.passed
                                    ? 'Draft answer stayed aligned with the definition intent of the query.'
                                    : 'Draft answer described the document instead of directly answering the definition query.'
                            )
                            : 'No grounded definition frame was available, so intent alignment stayed conservative.'
                )
                : 'No evidence was available, so definition-intent alignment was not evaluated.',
        },
        {
            gateId: 'claim_structured_consistency',
            passed: structuredConsistency.passed,
            message: groundedEvidenceAvailable
                ? (
                    structuredConsistency.comparableFactCount > 0
                        ? buildStructuredFactConflictMessage(structuredConsistency.conflicts)
                        : 'No high-confidence structured fact comparison was available, so contradiction checking stayed conservative.'
                )
                : 'No evidence was available, so structured contradiction checking was not evaluated.',
        },
        {
            gateId: 'claim_subject_consistency',
            passed: subjectConsistency.passed,
            message: groundedEvidenceAvailable
                ? (
                    subjectConsistency.comparableFrameCount > 0
                        ? buildSubjectConflictMessage(subjectConsistency.conflicts)
                        : 'No comparable subject frame was available, so subject contradiction checking stayed conservative.'
                )
                : 'No evidence was available, so subject contradiction checking was not evaluated.',
        },
        {
            gateId: 'claim_state_consistency',
            passed: stateConsistency.passed,
            message: groundedEvidenceAvailable
                ? (
                    stateConsistency.comparableFrameCount > 0
                        ? buildStateConflictMessage(stateConsistency.conflicts)
                        : 'No comparable state frame was available, so same-subject state contradiction checking stayed conservative.'
                )
                : 'No evidence was available, so same-subject state contradiction checking was not evaluated.',
        },
        {
            gateId: 'claim_polarity_consistency',
            passed: polarityConsistency.passed,
            message: groundedEvidenceAvailable
                ? (
                    polarityConsistency.comparableSentenceCount > 0
                        ? buildPolarityConflictMessage(polarityConsistency.conflicts)
                        : 'No polarity-comparable support sentence was available, so contradiction checking stayed conservative.'
                )
                : 'No evidence was available, so polarity contradiction checking was not evaluated.',
        },
        {
            gateId: 'claim_graph_order_consistency',
            passed: graphOrderConsistency.passed,
            message: groundedEvidenceAvailable
                ? (
                    graphOrderConsistency.comparableClaimCount > 0
                        ? buildGraphOrderConflictMessage(graphOrderConsistency.conflicts)
                        : 'No explicit graph-order claim was present in the draft answer, so DAG-order checking stayed conservative.'
                )
                : 'No evidence was available, so graph-order contradiction checking was not evaluated.',
        },
        {
            gateId: 'public_surface_contraction',
            passed: publicSurfaceContracted,
            message: publicSurfaceContracted
                ? 'Draft answer stayed within the public-surface contraction budget.'
                : 'Draft answer carried too much support or formatting detail for the public answer surface.',
        },
        {
            gateId: 'internal_diagnostic_leakage',
            passed: leakedInternalFragments.length <= 0,
            message: leakedInternalFragments.length <= 0
                ? 'Draft answer did not leak internal diagnostics.'
                : `Draft answer leaked internal diagnostics: ${leakedInternalFragments.join(', ')}.`,
        },
        {
            gateId: 'abstention_hygiene',
            passed: abstentionHygienePassed,
            message: abstentionHygienePassed
                ? 'Abstention path remained concise and user-facing.'
                : 'Abstention path still leaked implementation detail after correction.',
        },
    ];
    const failedGateIds = gates
        .filter((gate) => gate.passed === false)
        .map((gate) => gate.gateId);

    return {
        reviewedAt: String(context.reviewedAt || new Date().toISOString()).trim(),
        decision,
        revised: publicAnswer !== draftAnswer,
        originalAnswer: draftAnswer,
        publicAnswer,
        reason: buildReason(decision, groundedEvidenceAvailable),
        failedGateIds,
        leakedInternalFragments,
        gates,
    };
}
