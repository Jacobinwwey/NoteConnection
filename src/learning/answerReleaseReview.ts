import type {
    AgentConversationGraphContext,
    AgentConversationKnowledgePoint,
    AnswerReleaseDecision,
    AnswerReleaseGate,
    AnswerReleaseGateId,
    AnswerReleaseReview,
    KnowledgeCitation,
    KnowledgeQueryResolvedScope,
    RagContextPack,
    RagEvidenceFragment,
    RagEvidenceRole,
    RagSufficiencyReview,
    RelationKind,
    GraphAnswerPlan,
    GraphAnswerCoverageReview,
} from './types';
import { reviewGraphAnswerCoverage } from './graphAnswerCoverage';
import { collectGraphAnswerFacts, formatGraphAnswerProfileSentence } from './graphAnswerFacts';
import {
    naturalizeRagPublicEvidenceClause,
    shouldRejectPublicEvidenceClause,
    shouldRejectCompareProcedureEvidenceClause,
} from './ragPublicText';
import { scoreRagEvidenceClause, segmentRagEvidenceClauses } from './ragEvidenceQuality';

export interface AnswerReleaseReviewContext {
    message: string;
    draftAnswer: string;
    knowledgePoints: AgentConversationKnowledgePoint[];
    citations: KnowledgeCitation[];
    usedScope: KnowledgeQueryResolvedScope;
    graphContext: AgentConversationGraphContext | null;
    ragContextPack?: RagContextPack;
    ragSufficiencyReview?: RagSufficiencyReview;
    graphAnswerPlan?: GraphAnswerPlan;
    reviewedAt?: string;
}

type AnswerReleaseSupportCandidate = {
    label: string;
    text: string;
};

type RagAnswerCompleteness = {
    passed: boolean;
    applicable: boolean;
    requiredRoles: RagEvidenceRole[];
    missingRoles: RagEvidenceRole[];
    requiredProfileSignals: RagProfileCompletenessSignal[];
    missingProfileSignals: RagProfileCompletenessSignal[];
};

type RagClaimCitationSupport = {
    passed: boolean;
    applicable: boolean;
    supportedClaimCount: number;
    weakClaims: string[];
    unsupportedClaims: string[];
    citationBackedFragmentCount: number;
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

type StructuredComparisonRelation = 'greater_than' | 'less_than';

type StructuredComparisonFrame = {
    surface: string;
    leftAnchor: string;
    leftFeatures: string[];
    leftDistinctFeatures: string[];
    rightAnchor: string;
    rightFeatures: string[];
    rightDistinctFeatures: string[];
    sharedFeatures: string[];
    relation: StructuredComparisonRelation;
};

type StructuredComparisonConflict = {
    answerFrame: StructuredComparisonFrame;
    leftSupportFact: StructuredFact & { label: string };
    rightSupportFact: StructuredFact & { label: string };
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

type AttributeFrame = {
    surface: string;
    subject: string;
    subjectFeatures: string[];
    value: string;
    valueFeatures: string[];
};

type AttributeFrameConflict = {
    answerFrame: AttributeFrame;
    supportFrame: AttributeFrame & { label: string };
};

type ContainmentFrame = {
    surface: string;
    subject: string;
    subjectFeatures: string[];
    object: string;
    objectFeatures: string[];
};

type ContainmentFrameConflict = {
    answerFrame: ContainmentFrame;
    supportFrame: ContainmentFrame & { label: string };
};

type CompositionFramePart = {
    surface: string;
    features: string[];
};

type CompositionFrame = {
    surface: string;
    subject: string;
    subjectFeatures: string[];
    components: string;
    componentFeatures: string[];
    componentParts: CompositionFramePart[];
};

type CompositionFrameConflict = {
    answerFrame: CompositionFrame;
    supportFrame: CompositionFrame & { label: string };
};

type PurposeFramePart = {
    surface: string;
    features: string[];
};

type PurposeFrame = {
    surface: string;
    subject: string;
    subjectFeatures: string[];
    purpose: string;
    purposeFeatures: string[];
    purposeParts: PurposeFramePart[];
};

type PurposeFrameConflict = {
    answerFrame: PurposeFrame;
    supportFrame: PurposeFrame & { label: string };
};

type DependencyFramePart = {
    surface: string;
    features: string[];
};

type DependencyFrame = {
    surface: string;
    subject: string;
    subjectFeatures: string[];
    dependency: string;
    dependencyFeatures: string[];
    dependencyParts: DependencyFramePart[];
};

type DependencyFrameConflict = {
    answerFrame: DependencyFrame;
    supportFrame: DependencyFrame & { label: string };
};

type LocationFrame = {
    surface: string;
    subject: string;
    subjectFeatures: string[];
    location: string;
    locationFeatures: string[];
};

type LocationFrameConflict = {
    answerFrame: LocationFrame;
    supportFrame: LocationFrame & { label: string };
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

type GraphRelationEvidenceSource = 'connection_path' | 'knowledge_point_relation' | 'predecessor_window' | 'successor_window';

type GraphRelationEvidence = {
    relationKind: RelationKind;
    sourceTitle: string;
    targetTitle: string;
    source: GraphRelationEvidenceSource;
};

type GraphOrderEvidence = {
    relationKind: GraphOrderSupportedRelationKind;
    earlierTitle: string;
    laterTitle: string;
    source: GraphRelationEvidenceSource;
};

type GraphOrderConflict = {
    answerSurface: string;
    evidence: GraphOrderEvidence;
};

type GraphCausalEvidence = {
    causeTitle: string;
    effectTitle: string;
    source: GraphRelationEvidenceSource;
};

type GraphCausalConflict = {
    answerSurface: string;
    evidence: GraphCausalEvidence;
};

type GraphComparisonSupportedRelationKind = 'contrast' | 'analogy';

type GraphComparisonEvidence = {
    relationKind: GraphComparisonSupportedRelationKind;
    leftTitle: string;
    rightTitle: string;
    source: GraphRelationEvidenceSource;
};

type GraphComparisonConflict = {
    answerSurface: string;
    evidence: GraphComparisonEvidence;
};

type QueryIntentAlignmentResult = {
    passed: boolean;
    applicable: boolean;
    comparableFrameCount: number;
    supportFrame: (StateFrame & { label: string }) | null;
};

type TemporalValidityQualificationSource =
    | 'not_required'
    | 'draft_qualified';

type TemporalValidityConflict = {
    anchorTitle: string;
    warningReasons: string[];
    invalidKnowledgePointTitles: string[];
    checkedAt: string;
};

type TemporalValidityConsistencyResult = {
    passed: boolean;
    applicable: boolean;
    qualificationSource: TemporalValidityQualificationSource;
    conflict: TemporalValidityConflict | null;
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
const DEFINITION_EVIDENCE_HIGHLIGHT_LIMIT = 2;
const RAG_CLAIM_CITATION_SUPPORT_MIN_FEATURES = 2;
const RAG_CLAIM_CITATION_SUPPORT_MIN_COVERAGE = 0.78;
const RAG_CLAIM_CITATION_SUPPORT_WEAK_COVERAGE = 0.45;
const RAG_CLAIM_CITATION_SUPPORT_MAX_MISSING_FEATURES = 1;
const YEAR_CONTEXT_PATTERN = /\b(?:year|years|dated|since|until|from|during|after|before|in|on)\b|年/iu;
const ENGLISH_DEFINITION_QUERY_PATTERN = /\b(?:what\s+is|what'?s|what\s+are|who\s+is|define|definition\s+of|meaning\s+of)\b/iu;
const CHINESE_DEFINITION_QUERY_PATTERN = /什么是|指的是什么|定义|是什么意思/u;
const ENGLISH_META_DOCUMENTARY_PATTERN = /\b(?:this|the)\s+(?:technical\s+)?document\b[^.!?\n\r]{0,120}\b(?:aims?|describes?|analy[sz]es?|provides?|outlines?)\b|\bthis\s+(?:section|chapter)\b|\bwe\s+will\b/iu;
const CHINESE_META_DOCUMENTARY_PATTERN = /(?:本|该)?技术文档|本文档|本节|本章|我们将|旨在(?:对|从|说明|分析)|用于阐述/u;
const ENGLISH_PROMPT_ARTIFACT_PATTERN = /\b(?:follow(?:ing)? your instructions|based only on the title|all reasoning|final output|output in simplified chinese)\b/iu;
const CHINESE_PROMPT_ARTIFACT_PATTERN = /遵从.{0,20}(?:指示|要求)|仅基于标题|所有推理过程|推理过程以英文|最终输出|输出为简体中文/u;
const ENGLISH_TEMPORAL_QUALIFICATION_PATTERN = /\b(?:as of|historically|historical|previously|formerly|earlier|prior|at the time|during|until|before|after|superseded|expired|outdated|older revision|prior version|previous version|legacy version|no longer current)\b/iu;
const CHINESE_TEMPORAL_QUALIFICATION_PATTERN = /截至|历史上|历史版本|曾经|先前|此前|之前|之后|期间|当时|已过期|已失效|旧版|早期|已被[^。；.!?\n\r]{0,20}(?:取代|替代)/u;

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

const STATE_FRAME_SKIP_VALUE_PATTERN = /\b(?:prerequisite|before|after|depends?\s+on|requires?|sequence|used\s+for|used\s+to|designed\s+for|designed\s+to|serv(?:es|ed|e)\s+(?:to|for)|located\s+(?:in|inside|within|at)|situated\s+(?:in|inside|within|at)|positioned\s+(?:in|inside|within|at)|lies?\s+(?:in|within))\b|先于|早于|之前|之后|前置条件|前提|依赖|用于|用来|用作|位于|位於|坐落于|坐落於|处于|處於/u;

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
    const ragGroundedAnswer = buildRagGroundedRevisionAnswer(context);
    if (ragGroundedAnswer) {
        return ragGroundedAnswer;
    }
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
    const baseAnswer = summary && title && !summaryAlreadyCarriesTitle
        ? `${title}: ${summary}`
        : (summary || title || normalizeWhitespace(context.draftAnswer));
    const useChinese = containsCjk([
        context.message,
        title,
        summary,
        context.graphContext?.anchorTitle || '',
    ].join(' '));
    return expandAnswerWithGraphContext(baseAnswer, context, useChinese);
}

function stripTerminalSentencePunctuation(value: string): string {
    return normalizeWhitespace(String(value || ''))
        .replace(/[.!?\u3002\uFF01\uFF1F;；:：]+$/u, '')
        .trim();
}

function normalizeRevisionAnswerSentence(value: string, useChinese: boolean): string {
    const normalized = normalizeWhitespace(String(value || ''));
    if (!normalized) {
        return '';
    }
    return /[.!?\u3002\uFF01\uFF1F]$/u.test(normalized)
        ? normalized
        : `${normalized}${useChinese ? '。' : '.'}`;
}

function appendRevisionAnswerSentence(sentences: string[], sentence: string, useChinese: boolean): void {
    const normalizedSentence = normalizeRevisionAnswerSentence(sentence, useChinese);
    if (!normalizedSentence) {
        return;
    }
    const normalizedKey = stripTerminalSentencePunctuation(normalizedSentence).toLowerCase();
    const alreadyPresent = sentences.some((existingSentence) => (
        stripTerminalSentencePunctuation(existingSentence).toLowerCase() === normalizedKey
        || (
            normalizedKey.length >= 32
            && stripTerminalSentencePunctuation(existingSentence).toLowerCase().includes(normalizedKey)
        )
    ));
    if (!alreadyPresent) {
        sentences.push(normalizedSentence);
    }
}

function normalizeDefinitionEvidenceTitle(value: unknown): string {
    return normalizeWhitespace(
        String(value || '')
            .replace(/\s*\((?:mermaid|code|diagram)\s+block\)\s*$/iu, '')
            .trim()
    );
}

function normalizeDefinitionEvidenceTitleKey(value: unknown): string {
    return normalizeDefinitionEvidenceTitle(value).toLowerCase();
}

function collectDefinitionAugmentationTitles(context: AnswerReleaseReviewContext): string[] {
    const leadingPoint = context.knowledgePoints[0];
    const anchorTitle = normalizeDefinitionEvidenceTitle(
        leadingPoint?.title
        || context.graphContext?.anchorTitle
        || ''
    );
    const anchorComparableTitle = normalizeDefinitionEvidenceTitleKey(anchorTitle);
    const titles: string[] = [];
    const seen = new Set<string>();
    const appendTitle = (value: unknown) => {
        const title = normalizeDefinitionEvidenceTitle(value);
        const comparableTitle = normalizeDefinitionEvidenceTitleKey(title);
        if (
            !title
            || comparableTitle === anchorComparableTitle
            || comparableTitle.includes('preamble')
            || seen.has(comparableTitle)
        ) {
            return;
        }
        seen.add(comparableTitle);
        titles.push(title);
    };
    if (Array.isArray(leadingPoint?.matchedSpans)) {
        leadingPoint.matchedSpans.forEach((span) => appendTitle(span && span.title));
    }
    if (Array.isArray(leadingPoint?.citations)) {
        leadingPoint.citations.forEach((citation) => appendTitle(citation && citation.title));
    }
    context.citations.forEach((citation) => appendTitle(citation && citation.title));
    return titles.slice(0, 3);
}

function stripMarkdownScaffolding(value: string): string {
    return normalizeWhitespace(
        String(value || '')
            .replace(/```[\s\S]*?(?:```|$)/gu, ' ')
            .replace(/!\[[^\]]*\]\([^)]*\)/gu, ' ')
            .replace(/\[[^\]]+\]\([^)]*\)/gu, ' ')
            .replace(/<[^>]+>/gu, ' ')
            .replace(/^#{1,6}\s+/gu, '')
            .replace(/\s*\|\s*/gu, ' ')
            .replace(/\s{2,}/gu, ' ')
    );
}

function isPromptArtifactClause(value: string): boolean {
    const normalized = normalizeWhitespace(value);
    if (!normalized) {
        return false;
    }
    return ENGLISH_PROMPT_ARTIFACT_PATTERN.test(normalized)
        || CHINESE_PROMPT_ARTIFACT_PATTERN.test(normalized);
}

function removeLeadingEvidenceTitle(value: string, title: string): string {
    const normalized = normalizeWhitespace(value);
    const normalizedTitle = normalizeWhitespace(title);
    if (!normalized || !normalizedTitle) {
        return normalized;
    }
    const escapedTitle = escapeRegExp(normalizedTitle);
    return normalizeWhitespace(
        normalized.replace(new RegExp(`^#{0,6}\\s*${escapedTitle}\\s*[:：-]?\\s*`, 'iu'), '')
    );
}

function selectPublicEvidenceClause(snippet: string, title: string): string {
    const cleaned = removeLeadingEvidenceTitle(stripMarkdownScaffolding(snippet), title);
    if (!cleaned) {
        return '';
    }
    const clauses = segmentRagEvidenceClauses(cleaned)
        .map((clause) => normalizeWhitespace(clause))
        .map((clause) => naturalizeRagPublicEvidenceClause(clause))
        .filter((clause) => (
            clause.length >= 8
            && !ENGLISH_META_DOCUMENTARY_PATTERN.test(clause)
            && !CHINESE_META_DOCUMENTARY_PATTERN.test(clause)
            && !isPromptArtifactClause(clause)
            && !/^[:：\-–—]+$/u.test(clause)
        ));
    const selected = clauses[0] || cleaned;
    return selected.length > 120
        ? `${selected.slice(0, 118).trim()}...`
        : selected;
}

function collectDefinitionEvidenceHighlights(context: AnswerReleaseReviewContext): string[] {
    const leadingPoint = context.knowledgePoints[0];
    const anchorTitle = normalizeDefinitionEvidenceTitle(
        leadingPoint?.title
        || context.graphContext?.anchorTitle
        || ''
    );
    const anchorComparableTitle = normalizeDefinitionEvidenceTitleKey(anchorTitle);
    const citations = [
        ...(Array.isArray(leadingPoint?.citations) ? leadingPoint.citations : []),
        ...context.citations,
    ];
    const seen = new Set<string>();
    const highlights: string[] = [];
    citations.forEach((citation) => {
        const title = normalizeDefinitionEvidenceTitle(citation && citation.title);
        const comparableTitle = normalizeDefinitionEvidenceTitleKey(title);
        if (
            !title
            || comparableTitle === anchorComparableTitle
            || comparableTitle.includes('preamble')
            || seen.has(comparableTitle)
        ) {
            return;
        }
        seen.add(comparableTitle);
        const clause = selectPublicEvidenceClause(String(citation && citation.snippet || ''), title);
        if (clause) {
            highlights.push(`${title}: ${clause}`);
        }
    });
    return highlights.slice(0, DEFINITION_EVIDENCE_HIGHLIGHT_LIMIT);
}

function buildDefinitionEvidenceHighlightSentence(
    context: AnswerReleaseReviewContext,
    useChinese: boolean
): string {
    const highlights = collectDefinitionEvidenceHighlights(context);
    if (highlights.length <= 0) {
        return '';
    }
    if (useChinese) {
        return `证据摘要还显示：${highlights.join('；')}`;
    }
    return `Evidence highlights: ${highlights.join('; ')}`;
}

function buildDefinitionAugmentationSentence(
    context: AnswerReleaseReviewContext,
    useChinese: boolean
): string {
    const augmentationTitles = collectDefinitionAugmentationTitles(context);
    if (augmentationTitles.length <= 0) {
        return '';
    }
    if (useChinese) {
        return `同一知识点还覆盖 ${augmentationTitles.join('、')}`;
    }
    return `The same knowledge point also covers ${augmentationTitles.join(', ')}`;
}

function buildRevisionGraphConnectionSentence(
    context: AnswerReleaseReviewContext,
    useChinese: boolean
): string {
    const connectionPath = context.graphContext && Array.isArray(context.graphContext.connectionPaths)
        ? context.graphContext.connectionPaths[0]
        : null;
    const pathTitles = connectionPath && Array.isArray(connectionPath.pathTitles)
        ? connectionPath.pathTitles.map((title) => normalizeDefinitionEvidenceTitle(title)).filter(Boolean)
        : [];
    if (pathTitles.length <= 1) {
        return '';
    }
    if (useChinese) {
        return `当前图中的关键路径是 ${pathTitles.join(' -> ')}`;
    }
    return `The strongest graph path runs through ${pathTitles.join(' -> ')}`;
}

function buildRevisionGraphProfileSentence(
    context: AnswerReleaseReviewContext,
    useChinese: boolean
): string {
    const graphContext = context.graphContext;
    if (!graphContext) {
        return '';
    }
    const anchorProfile = graphContext.anchorGraphProfile && typeof graphContext.anchorGraphProfile === 'object'
        ? graphContext.anchorGraphProfile
        : null;
    const facts = collectGraphAnswerFacts(graphContext, {
        anchorAtomId: graphContext.anchorAtomId || anchorProfile?.atomId || '',
        anchorTitle: graphContext.anchorTitle || anchorProfile?.title || '',
        normalizeTitle: normalizeDefinitionEvidenceTitle,
    });
    if (!facts) {
        return '';
    }
    return formatGraphAnswerProfileSentence(facts, useChinese);
}

function expandAnswerWithGraphContext(
    baseAnswer: string,
    context: AnswerReleaseReviewContext,
    useChinese: boolean,
    extraSentences: string[] = []
): string {
    const sentences: string[] = [];
    appendRevisionAnswerSentence(sentences, baseAnswer, useChinese);
    extraSentences.forEach((sentence) => appendRevisionAnswerSentence(sentences, sentence, useChinese));
    appendRevisionAnswerSentence(sentences, buildRevisionGraphConnectionSentence(context, useChinese), useChinese);
    appendRevisionAnswerSentence(sentences, buildRevisionGraphProfileSentence(context, useChinese), useChinese);
    return sentences.join(useChinese ? '' : ' ');
}

function expandRagGroundedAnswer(
    baseAnswer: string,
    useChinese: boolean,
    evidenceSentences: string[] = []
): string {
    const sentences: string[] = [];
    appendRevisionAnswerSentence(sentences, baseAnswer, useChinese);
    evidenceSentences.forEach((sentence) => appendRevisionAnswerSentence(sentences, sentence, useChinese));
    return sentences.join(useChinese ? '' : ' ');
}

function hasUsableRagEvidenceContext(context: AnswerReleaseReviewContext): boolean {
    const pack = context.ragContextPack;
    if (!pack || !Array.isArray(pack.fragments) || pack.fragments.length <= 0) {
        return false;
    }
    return context.ragSufficiencyReview?.status !== 'insufficient';
}

function collectRagRoleFragments(
    context: AnswerReleaseReviewContext,
    roles: Set<RagEvidenceRole>
): RagEvidenceFragment[] {
    if (!hasUsableRagEvidenceContext(context)) {
        return [];
    }
    return (context.ragContextPack?.fragments || []).filter((fragment) => roles.has(fragment.role));
}

function normalizeRagClauseKey(value: string): string {
    return stripTerminalSentencePunctuation(value).toLowerCase();
}

function ragClauseAlreadyCovered(candidate: string, selectedClauses: string[]): boolean {
    const candidateKey = normalizeRagClauseKey(candidate);
    if (!candidateKey) {
        return true;
    }
    return selectedClauses.some((selected) => {
        const selectedKey = normalizeRagClauseKey(selected);
        return selectedKey === candidateKey
            || (candidateKey.length >= 32 && selectedKey.includes(candidateKey))
            || (selectedKey.length >= 32 && candidateKey.includes(selectedKey));
    });
}

const RAG_PUBLIC_QUERY_STOPWORDS = new Set([
    'a', 'about', 'an', 'and', 'are', 'as', 'at', 'be', 'between', 'by', 'compare',
    'contrast', 'difference', 'differences', 'do', 'does', 'from', 'how',
    'in', 'is', 'it', 'me', 'of', 'on', 'or', 'plan', 'step', 'steps', 'tell', 'the', 'to', 'versus', 'vs', 'what',
    'which', 'with',
]);

function extractRagPublicQueryTerms(message: string): string[] {
    const terms = (String(message || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
        .map((term) => term.trim())
        .filter((term) => term.length >= 2 && !RAG_PUBLIC_QUERY_STOPWORDS.has(term));
    return Array.from(new Set(terms));
}

function isRagPublicCompareQuery(message: string): boolean {
    const normalized = normalizeWhitespace(String(message || '').toLowerCase());
    return /\b(?:compare|contrast|vs|versus|difference|differences)\b/u.test(normalized)
        || normalized.includes('区别')
        || normalized.includes('对比');
}

function resolveRagPublicAnswerProfile(message: string): RagPublicAnswerProfile {
    const normalized = normalizeWhitespace(String(message || '').toLowerCase());
    if (isRagPublicCompareQuery(normalized)) {
        return 'compare';
    }
    if (
        /\b(?:how to|steps?|procedure|workflow|runbook|calibrat|configure|setup|install|fix|troubleshoot)\b/u.test(normalized)
        || normalized.includes('\u5982\u4F55')
        || normalized.includes('\u600E\u4E48')
        || normalized.includes('\u600E\u6A23')
        || normalized.includes('\u6B65\u9AA4')
    ) {
        return 'how_to';
    }
    if (
        /\b(?:why|cause|causes|caused|causal|because|reason|mechanism|consequence|downstream|implication)\b/u.test(normalized)
        || normalized.includes('\u4E3A\u4EC0\u4E48')
        || normalized.includes('\u70BA\u4EC0\u9EBC')
        || normalized.includes('\u539F\u56E0')
        || normalized.includes('\u673A\u5236')
        || normalized.includes('\u6A5F\u5236')
        || normalized.includes('\u5BFC\u81F4')
        || normalized.includes('\u5C0E\u81F4')
    ) {
        return 'causal';
    }
    return 'generic';
}

function collectRagPublicClauseQueryTerms(value: string, queryTerms: string[]): Set<string> {
    const lower = String(value || '').toLowerCase();
    return new Set(queryTerms.filter((term) => lower.includes(term)));
}

function collectRagPublicLeafHeadingQueryTerms(fragment: RagEvidenceFragment, queryTerms: string[]): Set<string> {
    const headingPath = Array.isArray(fragment.headingPath) ? fragment.headingPath : [];
    const leafHeading = normalizeWhitespace(String(headingPath[headingPath.length - 1] || ''));
    if (!leafHeading) {
        return new Set();
    }
    return collectRagPublicClauseQueryTerms(leafHeading, queryTerms);
}

type RagPublicEvidenceClauseSelectionOptions = {
    queryTerms?: string[];
    useLeafHeadingScore?: boolean;
    preferBestLeafHeadingMatch?: boolean;
    minimumLeafHeadingTermCount?: number;
    preserveLeadingHeading?: boolean;
    rejectClause?: (clause: string) => boolean;
};

type RagPublicAnswerProfile = 'compare' | 'how_to' | 'causal' | 'generic';
type RagProfileCompletenessSignal =
    | 'how_to_steps'
    | 'how_to_prerequisites'
    | 'how_to_failure_handling'
    | 'causal_mechanism'
    | 'causal_consequence'
    | 'causal_boundary';

type RagProfileSignalRule = {
    signal: RagProfileCompletenessSignal;
    supportPatterns: RegExp[];
    answerPatterns: RegExp[];
};

type RagPublicEvidenceClauseCandidate = {
    clause: string;
    queryTerms: Set<string>;
    headingQueryTerms: Set<string>;
    qualityScore: number;
    order: number;
};

function splitRagPublicEvidenceClauses(
    fragment: RagEvidenceFragment,
    options: RagPublicEvidenceClauseSelectionOptions = {}
): string[] {
    const title = normalizeWhitespace(String(fragment.title || '').trim());
    let cleaned = normalizeWhitespace(
        String(fragment.text || '')
            .replace(/^#{1,6}\s+/gmu, '')
            .replace(/```[\s\S]*?(?:```|$)/gu, ' ')
            .replace(/!\[[^\]]*\]\([^)]*\)/gu, ' ')
            .replace(/\[[^\]]+\]\([^)]*\)/gu, ' ')
            .replace(/<[^>]+>/gu, ' ')
            .replace(/\s*\|\s*/gu, ' ')
    );
    const removeLeadingRagHeading = (value: string, heading: string): string => {
        const normalizedValue = normalizeWhitespace(value);
        const normalizedHeading = normalizeWhitespace(heading);
        if (!normalizedValue || !normalizedHeading) {
            return normalizedValue;
        }
        const escapedHeading = escapeRegExp(normalizedHeading);
        const match = normalizedValue.match(new RegExp(`^${escapedHeading}\\s*`, 'iu'));
        if (!match) {
            return normalizedValue;
        }
        const remainder = normalizedValue.slice(match[0].length).trim();
        if (/^(?:is|are|was|were|means|refers)\b/iu.test(remainder) || /^[是为為]/u.test(remainder)) {
            return normalizedValue;
        }
        return normalizeWhitespace(remainder.replace(/^[:：\-–—]+/u, ''));
    };
    if (!options.preserveLeadingHeading) {
        const leadingHeadings = [
            title,
            ...(Array.isArray(fragment.headingPath) ? fragment.headingPath.slice().reverse() : []),
        ];
        leadingHeadings.forEach((heading) => {
            cleaned = removeLeadingRagHeading(cleaned, normalizeWhitespace(String(heading || '').trim()));
        });
    }
    if (!cleaned) {
        return [];
    }
    const clauses = segmentRagEvidenceClauses(cleaned)
        .map((clause) => normalizeWhitespace(clause))
        .map((clause) => naturalizeRagPublicEvidenceClause(clause))
        .filter((clause) => (
            clause.length >= 8
            && !ENGLISH_META_DOCUMENTARY_PATTERN.test(clause)
            && !CHINESE_META_DOCUMENTARY_PATTERN.test(clause)
            && !isPromptArtifactClause(clause)
            && !/^[:：\-–—]+$/u.test(clause)
        ));
    return clauses.length > 0 ? clauses : [cleaned];
}

function collectRagPublicEvidenceClauses(
    context: AnswerReleaseReviewContext,
    roles: Set<RagEvidenceRole>,
    limit: number | undefined,
    excludedClauses: string[] = [],
    options: RagPublicEvidenceClauseSelectionOptions = {}
): string[] {
    const clauses: string[] = [];
    const selected = [...excludedClauses];
    const queryTerms = Array.isArray(options.queryTerms) ? options.queryTerms : [];
    const candidates: RagPublicEvidenceClauseCandidate[] = [];
    let order = 0;
    collectRagRoleFragments(context, roles).forEach((fragment) => {
        const headingQueryTerms = collectRagPublicLeafHeadingQueryTerms(fragment, queryTerms);
        splitRagPublicEvidenceClauses(fragment, options).forEach((clause) => {
            if (options.rejectClause?.(clause)) {
                order += 1;
                return;
            }
            candidates.push({
                clause,
                queryTerms: collectRagPublicClauseQueryTerms(clause, queryTerms),
                headingQueryTerms,
                qualityScore: scoreRagEvidenceClause(clause).score,
                order,
            });
            order += 1;
        });
    });
    const maxHeadingTermCount = candidates.reduce(
        (max, candidate) => Math.max(max, candidate.headingQueryTerms.size),
        0
    );
    const minimumLeafHeadingTermCount = Math.max(0, Math.floor(Number(options.minimumLeafHeadingTermCount || 0)));
    const thresholdCandidates = minimumLeafHeadingTermCount > 0
        ? candidates.filter((candidate) => candidate.headingQueryTerms.size >= minimumLeafHeadingTermCount)
        : candidates;
    const rankedCandidates = (
        options.preferBestLeafHeadingMatch && maxHeadingTermCount > 0
            ? thresholdCandidates.filter((candidate) => candidate.headingQueryTerms.size === maxHeadingTermCount)
            : thresholdCandidates
    ).sort((left, right) => {
        const leftHeadingScore = options.useLeafHeadingScore ? left.headingQueryTerms.size : 0;
        const rightHeadingScore = options.useLeafHeadingScore ? right.headingQueryTerms.size : 0;
        const leftScore = left.queryTerms.size * 4 + leftHeadingScore * 6;
        const rightScore = right.queryTerms.size * 4 + rightHeadingScore * 6;
        if (rightScore !== leftScore) {
            return rightScore - leftScore;
        }
        if (right.qualityScore !== left.qualityScore) {
            return right.qualityScore - left.qualityScore;
        }
        return left.order - right.order;
    });
    rankedCandidates.forEach((candidate) => {
        if ((limit !== undefined && clauses.length >= limit) || ragClauseAlreadyCovered(candidate.clause, selected)) {
            return;
        }
        selected.push(candidate.clause);
        clauses.push(candidate.clause);
    });
    return clauses;
}

function ragRevisionDocumentClauseOptions(
    profile: RagPublicAnswerProfile,
    queryTerms: string[]
): RagPublicEvidenceClauseSelectionOptions {
    if (profile === 'compare') {
        return {
            preserveLeadingHeading: true,
        };
    }
    if (profile === 'how_to' || profile === 'causal') {
        return {
            queryTerms,
            useLeafHeadingScore: true,
            preferBestLeafHeadingMatch: false,
        };
    }
    return {
        queryTerms,
        useLeafHeadingScore: true,
        preferBestLeafHeadingMatch: true,
    };
}

function ragRevisionGraphClauseOptions(
    profile: RagPublicAnswerProfile,
    queryTerms: string[]
): RagPublicEvidenceClauseSelectionOptions {
    if (profile === 'compare') {
        return {
            preserveLeadingHeading: true,
        };
    }
    if (profile === 'how_to' || profile === 'causal') {
        return {
            queryTerms,
            useLeafHeadingScore: true,
            preferBestLeafHeadingMatch: false,
        };
    }
    return {
        queryTerms,
        useLeafHeadingScore: true,
        preferBestLeafHeadingMatch: true,
        minimumLeafHeadingTermCount: queryTerms.length >= 3 ? queryTerms.length : 0,
    };
}

function hasPlannedGraphAnswerClaims(context: AnswerReleaseReviewContext): boolean {
    return (context.graphAnswerPlan?.claims || []).some((claim) => (
        normalizeWhitespace(String(claim.statement || '')).length > 0
    ));
}

function buildRagGroundedRevisionAnswer(context: AnswerReleaseReviewContext): string {
    if (hasPlannedGraphAnswerClaims(context) || !hasUsableRagEvidenceContext(context)) {
        return '';
    }
    const useChinese = containsCjk([
        context.message,
        context.draftAnswer,
        context.graphContext?.anchorTitle || '',
        ...(context.ragContextPack?.fragments || []).slice(0, 4).map((fragment) => fragment.text),
    ].join(' '));
    const queryTerms = extractRagPublicQueryTerms(context.message);
    const profile = resolveRagPublicAnswerProfile(context.message);
    const isCompareQuery = profile === 'compare';
    const rejectAnswerControlClause = shouldRejectPublicEvidenceClause;
    const rejectCompareProcedureClause = isCompareQuery
        ? (clause: string) => (
            rejectAnswerControlClause(clause)
            || shouldRejectCompareProcedureEvidenceClause(clause, context.message)
        )
        : rejectAnswerControlClause;
    const directClauses = collectRagPublicEvidenceClauses(
        context,
        new Set(['direct_support']),
        undefined,
        [],
        {
            preserveLeadingHeading: isCompareQuery,
            rejectClause: rejectCompareProcedureClause,
        }
    );
    const documentClauses = collectRagPublicEvidenceClauses(
        context,
        new Set(['parent_context', 'adjacent_context']),
        undefined,
        directClauses,
        {
            ...ragRevisionDocumentClauseOptions(profile, queryTerms),
            rejectClause: rejectCompareProcedureClause,
        }
    );
    const hasConflictEvidence = context.ragSufficiencyReview?.degradationState === 'conflict'
        || (context.ragSufficiencyReview?.reasons || []).some((reason) => String(reason || '').includes('conflict_evidence_present'));
    const conflictClauses = hasConflictEvidence
        ? collectRagPublicEvidenceClauses(
            context,
            new Set(['conflict']),
            undefined,
            [...directClauses, ...documentClauses]
        )
        : [];
    const graphClauses = collectRagPublicEvidenceClauses(
        context,
        new Set(['graph_neighbor_support']),
        undefined,
        [...directClauses, ...documentClauses, ...conflictClauses],
        {
            ...ragRevisionGraphClauseOptions(profile, queryTerms),
            rejectClause: rejectCompareProcedureClause,
        }
    );
    const fallback = normalizeWhitespace(String(
        context.knowledgePoints[0]?.evidenceSnippet
        || context.knowledgePoints[0]?.summary
        || context.knowledgePoints[0]?.title
        || context.draftAnswer
    ));
    const baseAnswer = directClauses[0] || fallback;
    if (!baseAnswer) {
        return '';
    }
    const extraSentences = [
        ...directClauses.slice(1),
        ...conflictClauses,
        ...documentClauses,
        ...graphClauses,
    ];
    if (context.ragSufficiencyReview?.status === 'borderline') {
        extraSentences.push(
            useChinese
                ? '当前证据覆盖仍然有限，因此回答只使用已命中的材料'
                : 'The evidence coverage is still partial, so the answer stays within the retrieved material'
        );
    }
    return expandRagGroundedAnswer(baseAnswer, useChinese, extraSentences);
}

function hasStrongEnglishAnchorCaseSignal(value: string): boolean {
    const normalized = normalizeWhitespace(value);
    if (!normalized || containsCjk(normalized)) {
        return false;
    }
    const tokens = normalized.split(/\s+/u).filter(Boolean);
    return tokens.some((token, index) => {
        if (/^[A-Z0-9-]{2,}$/u.test(token)) {
            return true;
        }
        if (/[A-Z]/u.test(token.slice(1))) {
            return true;
        }
        return index > 0 && /^[A-Z]/u.test(token);
    });
}

function formatEnglishComparisonAnchor(
    value: string,
    position: 'leading' | 'non_leading'
): string {
    const normalized = normalizeWhitespace(value);
    if (!normalized || containsCjk(normalized)) {
        return normalized;
    }
    if (hasStrongEnglishAnchorCaseSignal(normalized)) {
        if (position === 'leading' && /^[a-z]/u.test(normalized)) {
            return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
        }
        return normalized;
    }
    if (position === 'leading') {
        return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
    }
    return `${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}`;
}

function buildDefinitionIntentRevisionAnswer(
    context: AnswerReleaseReviewContext,
    supportFrame: StateFrame & { label: string }
): string {
    const ragGroundedAnswer = buildRagGroundedRevisionAnswer(context);
    if (ragGroundedAnswer) {
        return ragGroundedAnswer;
    }
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
        const baseAnswer = /[.!?\u3002\uFF01\uFF1F]$/u.test(canonicalizedSurface)
            ? canonicalizedSurface
            : `${canonicalizedSurface}.`;
        return expandAnswerWithGraphContext(baseAnswer, context, useChinese, [
            buildDefinitionAugmentationSentence(context, useChinese),
            buildDefinitionEvidenceHighlightSentence(context, useChinese),
        ]);
    }
    if (!subject || !value) {
        return expandAnswerWithGraphContext(
            normalizeWhitespace(supportFrame.surface || buildGroundedRevisionAnswer(context)),
            context,
            useChinese,
            [
                buildDefinitionAugmentationSentence(context, useChinese),
                buildDefinitionEvidenceHighlightSentence(context, useChinese),
            ]
        );
    }
    if (useChinese) {
        const separator = /[A-Za-z0-9)\]]$/u.test(subject) ? ' 是' : '是';
        return expandAnswerWithGraphContext(`${subject}${separator}${value}。`, context, useChinese, [
            buildDefinitionAugmentationSentence(context, useChinese),
            buildDefinitionEvidenceHighlightSentence(context, useChinese),
        ]);
    }
    return expandAnswerWithGraphContext(`${subject} is ${value}.`, context, useChinese, [
        buildDefinitionAugmentationSentence(context, useChinese),
        buildDefinitionEvidenceHighlightSentence(context, useChinese),
    ]);
}

function buildReleasedPublicAnswer(
    context: AnswerReleaseReviewContext,
    draftAnswer: string
): string {
    if (isDefinitionIntentQuery(context.message)) {
        const ragGroundedAnswer = buildRagGroundedRevisionAnswer(context);
        if (ragGroundedAnswer && !normalizeWhitespace(draftAnswer).includes(normalizeWhitespace(ragGroundedAnswer))) {
            return normalizeWhitespace(`${draftAnswer} ${ragGroundedAnswer}`);
        }
    }
    return draftAnswer;
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

function buildGraphCausalRevisionAnswer(
    context: AnswerReleaseReviewContext,
    conflict: GraphCausalConflict
): string {
    const causeTitle = normalizeWhitespace(conflict.evidence.causeTitle);
    const effectTitle = normalizeWhitespace(conflict.evidence.effectTitle);
    const useChinese = containsCjk([
        context.message,
        context.draftAnswer,
        causeTitle,
        effectTitle,
    ].join(' '));
    if (useChinese) {
        return `${causeTitle}导致${effectTitle}。`;
    }
    return `${causeTitle} causes ${effectTitle}.`;
}

function buildGraphComparisonRevisionAnswer(
    context: AnswerReleaseReviewContext,
    conflict: GraphComparisonConflict
): string {
    const leftTitle = normalizeWhitespace(conflict.evidence.leftTitle);
    const rightTitle = normalizeWhitespace(conflict.evidence.rightTitle);
    const useChinese = containsCjk([
        context.message,
        context.draftAnswer,
        leftTitle,
        rightTitle,
    ].join(' '));
    if (useChinese) {
        return conflict.evidence.relationKind === 'contrast'
            ? `${leftTitle}与${rightTitle}不同。`
            : `${leftTitle}与${rightTitle}类似。`;
    }
    return conflict.evidence.relationKind === 'contrast'
        ? `${leftTitle} contrasts with ${rightTitle}.`
        : `${leftTitle} is similar to ${rightTitle}.`;
}

function draftCarriesTemporalQualification(value: string): boolean {
    const normalized = normalizeWhitespace(value);
    if (!normalized) {
        return false;
    }
    return ENGLISH_TEMPORAL_QUALIFICATION_PATTERN.test(normalized)
        || CHINESE_TEMPORAL_QUALIFICATION_PATTERN.test(normalized)
        || /\b(?:19|20)\d{2}\b/.test(normalized);
}

function buildTemporalValidityRevisionAnswer(
    context: AnswerReleaseReviewContext,
    conflict: TemporalValidityConflict
): string {
    const anchorTitle = normalizeWhitespace(
        conflict.anchorTitle
        || context.graphContext?.anchorTitle
        || context.knowledgePoints[0]?.title
        || conflict.invalidKnowledgePointTitles[0]
        || ''
    );
    const useChinese = containsCjk([
        context.message,
        context.draftAnswer,
        anchorTitle,
        ...conflict.invalidKnowledgePointTitles,
        ...conflict.warningReasons,
    ].join(' '));
    if (useChinese) {
        if (anchorTitle) {
            return `关于${anchorTitle}的当前命中证据带有时序警告，我不能把它直接当作当前结论发布。`;
        }
        return '当前命中的证据带有时序警告，我不能把它直接当作当前结论发布。';
    }
    if (anchorTitle) {
        return `The retrieved evidence for ${anchorTitle} carries temporal warnings, so I cannot safely present it as the current answer.`;
    }
    return 'The retrieved evidence carries temporal warnings, so I cannot safely present it as the current answer.';
}

function compareStructuredFactMagnitude(
    leftFact: StructuredFact,
    rightFact: StructuredFact
): number | null {
    if (leftFact.kind !== rightFact.kind || leftFact.unit !== rightFact.unit) {
        return null;
    }
    if (Math.abs(leftFact.value - rightFact.value) <= 0.000001) {
        return 0;
    }
    return leftFact.value > rightFact.value ? 1 : -1;
}

function buildStructuredComparisonRevisionAnswer(
    context: AnswerReleaseReviewContext,
    conflict: StructuredComparisonConflict
): string {
    const magnitude = compareStructuredFactMagnitude(conflict.leftSupportFact, conflict.rightSupportFact);
    if (!magnitude) {
        return buildGroundedRevisionAnswer(context);
    }
    const correctedLeft = normalizeWhitespace(
        magnitude > 0
            ? conflict.answerFrame.leftAnchor
            : conflict.answerFrame.rightAnchor
    );
    const correctedRight = normalizeWhitespace(
        magnitude > 0
            ? conflict.answerFrame.rightAnchor
            : conflict.answerFrame.leftAnchor
    );
    if (!correctedLeft || !correctedRight) {
        return buildGroundedRevisionAnswer(context);
    }
    const useChinese = containsCjk([
        context.message,
        context.draftAnswer,
        correctedLeft,
        correctedRight,
    ].join(' '));
    if (useChinese) {
        return `${correctedLeft}高于${correctedRight}。`;
    }
    return `${formatEnglishComparisonAnchor(correctedLeft, 'leading')} is higher than ${formatEnglishComparisonAnchor(correctedRight, 'non_leading')}.`;
}

function buildSupportCandidates(
    context: AnswerReleaseReviewContext
): AnswerReleaseSupportCandidate[] {
    const candidates: AnswerReleaseSupportCandidate[] = [];
    if (hasUsableRagEvidenceContext(context)) {
        (context.ragContextPack?.fragments || []).forEach((fragment, index) => {
            const title = normalizeWhitespace(String(fragment.title || '').trim()) || `rag_fragment_${index + 1}`;
            const text = [title, normalizeWhitespace(String(fragment.text || '').trim())].filter(Boolean).join(' ');
            if (text) {
                candidates.push({
                    label: title,
                    text,
                });
            }
        });
    }
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

function buildGraphRelationEvidence(
    graphContext: AgentConversationGraphContext | null
): GraphRelationEvidence[] {
    if (!graphContext) {
        return [];
    }
    const evidenceByKey = new Map<string, GraphRelationEvidence>();
    const appendEvidence = (
        relationKind: RelationKind | null | undefined,
        sourceTitle: string,
        targetTitle: string,
        source: GraphRelationEvidenceSource
    ) => {
        if (!relationKind) {
            return;
        }
        const normalizedSourceTitle = normalizeWhitespace(sourceTitle);
        const normalizedTargetTitle = normalizeWhitespace(targetTitle);
        if (!normalizedSourceTitle || !normalizedTargetTitle) {
            return;
        }
        if (normalizedSourceTitle.toLowerCase() === normalizedTargetTitle.toLowerCase()) {
            return;
        }
        const key = `${relationKind}::${normalizedSourceTitle.toLowerCase()}::${normalizedTargetTitle.toLowerCase()}`;
        if (!evidenceByKey.has(key)) {
            evidenceByKey.set(key, {
                relationKind,
                sourceTitle: normalizedSourceTitle,
                targetTitle: normalizedTargetTitle,
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

function buildGraphOrderEvidence(
    graphContext: AgentConversationGraphContext | null
): GraphOrderEvidence[] {
    return buildGraphRelationEvidence(graphContext)
        .filter((evidence) => isGraphOrderSupportedRelationKind(evidence.relationKind))
        .map((evidence) => ({
            relationKind: evidence.relationKind as GraphOrderSupportedRelationKind,
            earlierTitle: evidence.sourceTitle,
            laterTitle: evidence.targetTitle,
            source: evidence.source,
        }));
}

function buildGraphCausalEvidence(
    graphContext: AgentConversationGraphContext | null
): GraphCausalEvidence[] {
    return buildGraphRelationEvidence(graphContext)
        .filter((evidence) => evidence.relationKind === 'causal')
        .map((evidence) => ({
            causeTitle: evidence.sourceTitle,
            effectTitle: evidence.targetTitle,
            source: evidence.source,
        }));
}

function buildSymmetricGraphPairKey(leftTitle: string, rightTitle: string): string {
    const normalizedLeftTitle = normalizeWhitespace(leftTitle).toLowerCase();
    const normalizedRightTitle = normalizeWhitespace(rightTitle).toLowerCase();
    if (!normalizedLeftTitle || !normalizedRightTitle || normalizedLeftTitle === normalizedRightTitle) {
        return '';
    }
    return [normalizedLeftTitle, normalizedRightTitle].sort().join('::');
}

function isGraphComparisonSupportedRelationKind(
    value: RelationKind | null | undefined
): value is GraphComparisonSupportedRelationKind {
    return value === 'contrast' || value === 'analogy';
}

function buildGraphComparisonEvidence(
    graphContext: AgentConversationGraphContext | null
): GraphComparisonEvidence[] {
    const pairSupport = new Map<string, {
        leftTitle: string;
        rightTitle: string;
        source: GraphRelationEvidenceSource;
        relationKinds: Set<GraphComparisonSupportedRelationKind>;
    }>();
    buildGraphRelationEvidence(graphContext)
        .filter((evidence) => isGraphComparisonSupportedRelationKind(evidence.relationKind))
        .forEach((evidence) => {
            const pairKey = buildSymmetricGraphPairKey(evidence.sourceTitle, evidence.targetTitle);
            if (!pairKey) {
                return;
            }
            const entry = pairSupport.get(pairKey);
            if (entry) {
                entry.relationKinds.add(evidence.relationKind as GraphComparisonSupportedRelationKind);
                return;
            }
            pairSupport.set(pairKey, {
                leftTitle: evidence.sourceTitle,
                rightTitle: evidence.targetTitle,
                source: evidence.source,
                relationKinds: new Set([evidence.relationKind as GraphComparisonSupportedRelationKind]),
            });
        });
    return Array.from(pairSupport.values())
        .filter((entry) => entry.relationKinds.size === 1)
        .map((entry) => ({
            relationKind: Array.from(entry.relationKinds)[0] as GraphComparisonSupportedRelationKind,
            leftTitle: entry.leftTitle,
            rightTitle: entry.rightTitle,
            source: entry.source,
        }));
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

function buildDirectionalGraphCausalPatterns(
    causeTitle: string,
    effectTitle: string
): RegExp[] {
    const causePattern = buildFlexibleTitlePattern(causeTitle);
    const effectPattern = buildFlexibleTitlePattern(effectTitle);
    if (!causePattern || !effectPattern) {
        return [];
    }
    const sentenceGap = '[^.!?\\u3002\\uFF01\\uFF1F\\n\\r]{0,80}?';
    return [
        new RegExp(`${causePattern}${sentenceGap}(?:causes?|caused|leads?\\s+to|led\\s+to|trigger(?:s|ed)?|produces?|produced|results?\\s+in|creates?|created|drives?)${sentenceGap}${effectPattern}`, 'iu'),
        new RegExp(`${effectPattern}${sentenceGap}(?:results?|resulted)\\s+from${sentenceGap}${causePattern}`, 'iu'),
        new RegExp(`${effectPattern}${sentenceGap}(?:is|was|were)\\s+caused\\s+by${sentenceGap}${causePattern}`, 'iu'),
        new RegExp(`${causePattern}${sentenceGap}(?:导致|造成|引发)${sentenceGap}${effectPattern}`, 'u'),
        new RegExp(`${effectPattern}${sentenceGap}(?:由|因)${sentenceGap}${causePattern}${sentenceGap}(?:引起|导致)`, 'u'),
    ];
}

function findDirectionalGraphCausalMatch(
    answer: string,
    causeTitle: string,
    effectTitle: string
): string {
    const normalizedAnswer = String(answer || '');
    for (const pattern of buildDirectionalGraphCausalPatterns(causeTitle, effectTitle)) {
        const match = normalizedAnswer.match(pattern);
        if (match && match[0]) {
            return normalizeWhitespace(match[0]);
        }
    }
    return '';
}

function buildGraphCausalConflictMessage(conflicts: GraphCausalConflict[]): string {
    if (conflicts.length <= 0) {
        return 'Draft answer stayed consistent with the grounded causal direction that could be compared.';
    }
    const fragments = conflicts.slice(0, 2).map((conflict) => (
        `"${conflict.answerSurface}" reversed ${conflict.evidence.causeTitle} -> causes -> ${conflict.evidence.effectTitle}`
    ));
    return `Draft answer reversed grounded causal direction: ${fragments.join('; ')}.`;
}

function buildGraphComparisonPatterns(
    leftTitle: string,
    rightTitle: string,
    relationKind: GraphComparisonSupportedRelationKind
): RegExp[] {
    const leftPattern = buildFlexibleTitlePattern(leftTitle);
    const rightPattern = buildFlexibleTitlePattern(rightTitle);
    if (!leftPattern || !rightPattern) {
        return [];
    }
    const sentenceGap = '[^.!?\\u3002\\uFF01\\uFF1F\\n\\r]{0,80}?';
    const orderedPatterns = (firstPattern: string, secondPattern: string): RegExp[] => {
        if (relationKind === 'contrast') {
            return [
                new RegExp(`${firstPattern}${sentenceGap}(?:contrast(?:s|ed)?\\s+with|differ(?:s|ed)?\\s+from|(?:is|are|was|were|remains?)\\s+different\\s+from)${sentenceGap}${secondPattern}`, 'iu'),
                new RegExp(`${firstPattern}${sentenceGap}(?:不同于|区别于)${sentenceGap}${secondPattern}`, 'u'),
                new RegExp(`${firstPattern}${sentenceGap}(?:与|和|跟)?${sentenceGap}${secondPattern}${sentenceGap}(?:不同|形成对比|有明显差异)`, 'u'),
            ];
        }
        return [
            new RegExp(`${firstPattern}${sentenceGap}(?:(?:is|are|was|were|remains?)\\s+)?(?:similar\\s+to|analogous\\s+to|comparable\\s+to|akin\\s+to|resemble(?:s|d)?)${sentenceGap}${secondPattern}`, 'iu'),
            new RegExp(`${firstPattern}${sentenceGap}(?:类似于|相似于|可类比于)${sentenceGap}${secondPattern}`, 'u'),
            new RegExp(`${firstPattern}${sentenceGap}(?:与|和|跟)?${sentenceGap}${secondPattern}${sentenceGap}(?:类似|相似|可类比)`, 'u'),
        ];
    };
    return [
        ...orderedPatterns(leftPattern, rightPattern),
        ...orderedPatterns(rightPattern, leftPattern),
    ];
}

function findGraphComparisonMatch(
    answer: string,
    leftTitle: string,
    rightTitle: string,
    relationKind: GraphComparisonSupportedRelationKind
): string {
    const normalizedAnswer = String(answer || '');
    for (const pattern of buildGraphComparisonPatterns(leftTitle, rightTitle, relationKind)) {
        const match = normalizedAnswer.match(pattern);
        if (match && match[0]) {
            return normalizeWhitespace(match[0]);
        }
    }
    return '';
}

function buildGraphComparisonConflictMessage(conflicts: GraphComparisonConflict[]): string {
    if (conflicts.length <= 0) {
        return 'Draft answer stayed consistent with the grounded comparison branch that could be compared.';
    }
    const fragments = conflicts.slice(0, 2).map((conflict) => (
        `"${conflict.answerSurface}" contradicted ${conflict.evidence.leftTitle} <-> ${conflict.evidence.relationKind} <-> ${conflict.evidence.rightTitle}`
    ));
    return `Draft answer contradicted grounded graph comparison relations: ${fragments.join('; ')}.`;
}

function buildTemporalValidityConflictMessage(
    result: TemporalValidityConsistencyResult
): string {
    if (!result.applicable) {
        return 'No temporal validity warning was active for the grounded graph context.';
    }
    if (result.passed) {
        return result.qualificationSource === 'draft_qualified'
            ? 'Temporal warnings were present, and the draft answer stayed explicitly time-qualified.'
            : 'Temporal validity stayed aligned with the draft answer.';
    }
    if (!result.conflict) {
        return 'Temporal warnings were present, but the draft answer stayed conservative.';
    }
    const warningSummary = result.conflict.warningReasons.length > 0
        ? result.conflict.warningReasons.join(', ')
        : 'temporal validity warning';
    const titleSummary = result.conflict.invalidKnowledgePointTitles.length > 0
        ? ` for ${result.conflict.invalidKnowledgePointTitles.slice(0, 2).join(', ')}`
        : '';
    return `Draft answer presented temporally flagged evidence as a current claim${titleSummary} without any time qualification (${warningSummary}).`;
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

function buildAttributeFrameFeatures(value: string): string[] {
    return collectOrderedLexicalFeatures(value)
        .map((feature) => String(feature || '').trim().toLowerCase())
        .filter((feature) => feature.length >= 2)
        .filter((feature) => !STRUCTURED_ANCHOR_STOPWORDS.has(feature));
}

function buildContainmentFrameFeatures(value: string): string[] {
    return collectOrderedLexicalFeatures(value)
        .map((feature) => String(feature || '').trim().toLowerCase())
        .filter((feature) => feature.length >= 2)
        .filter((feature) => !STRUCTURED_ANCHOR_STOPWORDS.has(feature));
}

function buildCompositionFrameFeatures(value: string): string[] {
    return collectOrderedLexicalFeatures(value)
        .map((feature) => String(feature || '').trim().toLowerCase())
        .filter((feature) => feature.length >= 2)
        .filter((feature) => !STRUCTURED_ANCHOR_STOPWORDS.has(feature));
}

function buildPurposeFrameFeatures(value: string): string[] {
    return collectOrderedLexicalFeatures(value)
        .map((feature) => String(feature || '').trim().toLowerCase())
        .filter((feature) => feature.length >= 2)
        .filter((feature) => !STRUCTURED_ANCHOR_STOPWORDS.has(feature));
}

function buildDependencyFrameFeatures(value: string): string[] {
    return collectOrderedLexicalFeatures(value)
        .map((feature) => String(feature || '').trim().toLowerCase())
        .filter((feature) => feature.length >= 2)
        .filter((feature) => !STRUCTURED_ANCHOR_STOPWORDS.has(feature));
}

function buildLocationFrameFeatures(value: string): string[] {
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

function normalizeAttributeFrameSubject(value: string): string {
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

function normalizeAttributeFrameValue(value: string): string {
    return normalizeWhitespace(String(value || ''))
        .replace(/^(?:a|an|the)\s+/i, '')
        .replace(/[,:;]+$/g, '')
        .trim();
}

function normalizeContainmentFrameSubject(value: string): string {
    return normalizeWhitespace(String(value || ''))
        .replace(/^(?:a|an|the)\s+/i, '')
        .replace(/[,:;]+$/g, '')
        .trim();
}

function normalizeContainmentFrameObject(value: string): string {
    return normalizeWhitespace(String(value || ''))
        .replace(/^(?:a|an|the)\s+/i, '')
        .replace(/\s+(?:during|under|within|inside|outside|near|around|across|throughout|through|at|on|in)\s+.+$/iu, '')
        .replace(/(?:在|于).+$/u, '')
        .replace(/[,:;]+$/g, '')
        .trim();
}

function normalizeCompositionFrameSubject(value: string): string {
    return normalizeWhitespace(String(value || ''))
        .replace(/^(?:a|an|the)\s+/i, '')
        .replace(/^(?:此处的|这里的|该|这个|這個)/u, '')
        .replace(/[“”"'`]+/gu, '')
        .replace(/[,:;]+$/g, '')
        .trim();
}

function normalizeCompositionComponentPart(value: string): string {
    return normalizeWhitespace(String(value || ''))
        .replace(/^(?:a|an|the)\s+/i, '')
        .replace(/^(?:一个|一种|一個|该|這個|这个)/u, '')
        .replace(/[“”"'`]+/gu, '')
        .replace(/[,:;]+$/g, '')
        .trim();
}

function normalizeCompositionFrameComponents(value: string): string {
    return normalizeWhitespace(String(value || ''))
        .replace(/[“”"'`]+/gu, '')
        .replace(/[,:;]+$/g, '')
        .trim();
}

function normalizePurposeFrameSubject(value: string): string {
    return normalizeWhitespace(String(value || ''))
        .replace(/^(?:a|an|the)\s+/i, '')
        .replace(/^(?:此处的|这里的|该|这个|這個)/u, '')
        .replace(/[“”"'`]+/gu, '')
        .replace(/[,:;]+$/g, '')
        .trim();
}

function normalizePurposeFramePart(value: string): string {
    return normalizeWhitespace(String(value || ''))
        .replace(/^(?:a|an|the)\s+/i, '')
        .replace(/^(?:to)\s+/iu, '')
        .replace(/^(?:用于|用来|用於|用來|用作|作为|作為)/u, '')
        .replace(/[“”"'`]+/gu, '')
        .replace(/[,:;]+$/g, '')
        .trim();
}

function normalizePurposeFrameValue(value: string): string {
    return normalizeWhitespace(String(value || ''))
        .replace(/^(?:to|for)\s+/iu, '')
        .replace(/^(?:用于|用来|用於|用來|用作|作为|作為)/u, '')
        .replace(/\s+(?:during|under|within|inside|outside|near|around|across|throughout|through|at|on|in)\s+.+$/iu, '')
        .replace(/(?:在|于).+$/u, '')
        .replace(/[“”"'`]+/gu, '')
        .replace(/[,:;]+$/g, '')
        .trim();
}

function normalizeDependencyFrameSubject(value: string): string {
    return normalizeWhitespace(String(value || ''))
        .replace(/^(?:a|an|the)\s+/i, '')
        .replace(/^(?:此处的|这里的|该|这个|這個)/u, '')
        .replace(/[“”"'`]+/gu, '')
        .replace(/[,:;]+$/g, '')
        .trim();
}

function normalizeDependencyFramePart(value: string): string {
    return normalizeWhitespace(String(value || ''))
        .replace(/^(?:a|an|the)\s+/i, '')
        .replace(/^(?:on|upon)\s+/iu, '')
        .replace(/^(?:对|對|向|于|於|为|為)\s*/u, '')
        .replace(/[“”"'`]+/gu, '')
        .replace(/[,:;]+$/g, '')
        .trim();
}

function normalizeDependencyFrameValue(value: string): string {
    return normalizeWhitespace(String(value || ''))
        .replace(/^(?:on|upon)\s+/iu, '')
        .replace(/^(?:对|對|向|于|於|为|為)\s*/u, '')
        .replace(/\s+(?:during|under|within|inside|outside|near|around|across|throughout|through|at|on|in)\s+.+$/iu, '')
        .replace(/(?:在|于|於).+$/u, '')
        .replace(/[“”"'`]+/gu, '')
        .replace(/[,:;]+$/g, '')
        .trim();
}

function normalizeLocationFrameSubject(value: string): string {
    return normalizeWhitespace(String(value || ''))
        .replace(/^(?:a|an|the)\s+/i, '')
        .replace(/^(?:此处的|这里的|该|这个|這個)/u, '')
        .replace(/[“”"'`]+/gu, '')
        .replace(/[,:;]+$/g, '')
        .trim();
}

function normalizeLocationFrameValue(value: string): string {
    return normalizeWhitespace(String(value || ''))
        .replace(/^(?:a|an|the)\s+/i, '')
        .replace(/[“”"'`]+/gu, '')
        .replace(/\s+(?:during|while|when|under)\s+.+$/iu, '')
        .replace(/[,:;]+$/g, '')
        .trim();
}

function splitCompositionFrameParts(value: string): CompositionFramePart[] {
    const normalizedValue = normalizeCompositionFrameComponents(value);
    if (!normalizedValue) {
        return [];
    }
    const parts = normalizedValue
        .split(/\s*(?:,|;|\band\b|\bplus\b|\bwith\b|以及|及|和|与|與|、)\s*/iu)
        .map((part) => normalizeCompositionComponentPart(part))
        .filter((part) => part.length > 0);
    if (parts.length <= 0) {
        return [];
    }
    const uniqueParts: CompositionFramePart[] = [];
    const seen = new Set<string>();
    parts.forEach((part) => {
        const key = part.toLowerCase();
        if (!key || seen.has(key)) {
            return;
        }
        const features = buildCompositionFrameFeatures(part);
        if (features.length <= 0) {
            return;
        }
        seen.add(key);
        uniqueParts.push({
            surface: part,
            features,
        });
    });
    return uniqueParts;
}

function splitPurposeFrameParts(value: string): PurposeFramePart[] {
    const normalizedValue = normalizePurposeFrameValue(value);
    if (!normalizedValue) {
        return [];
    }
    const parts = normalizedValue
        .split(/\s*(?:,|;|\band\b|\bor\b|以及|及|和|与|與|或|或者|、)\s*/iu)
        .map((part) => normalizePurposeFramePart(part))
        .filter((part) => part.length > 0);
    if (parts.length <= 0) {
        return [];
    }
    const uniqueParts: PurposeFramePart[] = [];
    const seen = new Set<string>();
    parts.forEach((part) => {
        const key = part.toLowerCase();
        if (!key || seen.has(key)) {
            return;
        }
        const features = buildPurposeFrameFeatures(part);
        if (features.length <= 0) {
            return;
        }
        seen.add(key);
        uniqueParts.push({
            surface: part,
            features,
        });
    });
    return uniqueParts;
}

function splitDependencyFrameParts(value: string): DependencyFramePart[] {
    const normalizedValue = normalizeDependencyFrameValue(value);
    if (!normalizedValue) {
        return [];
    }
    const parts = normalizedValue
        .split(/\s*(?:,|;|\band\b|\bor\b|以及|及|和|与|與|或|或者|、)\s*/iu)
        .map((part) => normalizeDependencyFramePart(part))
        .filter((part) => part.length > 0);
    if (parts.length <= 0) {
        return [];
    }
    const uniqueParts: DependencyFramePart[] = [];
    const seen = new Set<string>();
    parts.forEach((part) => {
        const key = part.toLowerCase();
        if (!key || seen.has(key)) {
            return;
        }
        const features = buildDependencyFrameFeatures(part);
        if (features.length <= 0) {
            return;
        }
        seen.add(key);
        uniqueParts.push({
            surface: part,
            features,
        });
    });
    return uniqueParts;
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

function buildAttributeFrame(
    surface: string,
    subject: string,
    value: string
): AttributeFrame | null {
    const normalizedSurface = normalizeWhitespace(surface);
    const normalizedSubject = normalizeAttributeFrameSubject(subject);
    const normalizedValue = normalizeAttributeFrameValue(value);
    if (!normalizedSurface || !normalizedSubject || !normalizedValue) {
        return null;
    }
    if (/\d/u.test(normalizedValue)) {
        return null;
    }
    const subjectFeatures = buildAttributeFrameFeatures(normalizedSubject);
    const valueFeatures = buildAttributeFrameFeatures(normalizedValue);
    if (subjectFeatures.length <= 0 || valueFeatures.length <= 0) {
        return null;
    }
    return {
        surface: normalizedSurface,
        subject: normalizedSubject,
        subjectFeatures,
        value: normalizedValue,
        valueFeatures,
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

function extractAttributeFrames(value: string): AttributeFrame[] {
    const patterns: RegExp[] = [
        /^(.{1,80}?)\s+(?:has|have|had|features?)\s+(.+)$/iu,
        /^(.{1,24}?)(?:有|具有|带有)(.+)$/u,
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
                const frame = buildAttributeFrame(
                    sentence,
                    String(match[1] || ''),
                    String(match[2] || '')
                );
                return frame ? [frame] : [];
            }
            return [];
        });
}

function buildContainmentFrame(
    surface: string,
    subject: string,
    object: string
): ContainmentFrame | null {
    const normalizedSurface = normalizeWhitespace(surface);
    const normalizedSubject = normalizeContainmentFrameSubject(subject);
    const normalizedObject = normalizeContainmentFrameObject(object);
    if (!normalizedSurface || !normalizedSubject || !normalizedObject) {
        return null;
    }
    if (/\d/u.test(normalizedObject)) {
        return null;
    }
    const subjectFeatures = buildContainmentFrameFeatures(normalizedSubject);
    const objectFeatures = buildContainmentFrameFeatures(normalizedObject);
    if (subjectFeatures.length <= 0 || objectFeatures.length <= 0) {
        return null;
    }
    return {
        surface: normalizedSurface,
        subject: normalizedSubject,
        subjectFeatures,
        object: normalizedObject,
        objectFeatures,
    };
}

function buildCompositionFrame(
    surface: string,
    subject: string,
    components: string
): CompositionFrame | null {
    const normalizedSurface = normalizeWhitespace(surface);
    const normalizedSubject = normalizeCompositionFrameSubject(subject);
    const normalizedComponents = normalizeCompositionFrameComponents(components);
    if (!normalizedSurface || !normalizedSubject || !normalizedComponents) {
        return null;
    }
    const subjectFeatures = buildCompositionFrameFeatures(normalizedSubject);
    const componentFeatures = buildCompositionFrameFeatures(normalizedComponents);
    const componentParts = splitCompositionFrameParts(normalizedComponents);
    if (subjectFeatures.length <= 0 || componentFeatures.length <= 0 || componentParts.length <= 0) {
        return null;
    }
    return {
        surface: normalizedSurface,
        subject: normalizedSubject,
        subjectFeatures,
        components: normalizedComponents,
        componentFeatures,
        componentParts,
    };
}

function buildPurposeFrame(
    surface: string,
    subject: string,
    purpose: string
): PurposeFrame | null {
    const normalizedSurface = normalizeWhitespace(surface);
    const normalizedSubject = normalizePurposeFrameSubject(subject);
    const normalizedPurpose = normalizePurposeFrameValue(purpose);
    if (!normalizedSurface || !normalizedSubject || !normalizedPurpose) {
        return null;
    }
    if (/\d/u.test(normalizedPurpose)) {
        return null;
    }
    const subjectFeatures = buildPurposeFrameFeatures(normalizedSubject);
    const purposeFeatures = buildPurposeFrameFeatures(normalizedPurpose);
    const purposeParts = splitPurposeFrameParts(normalizedPurpose);
    if (subjectFeatures.length <= 0 || purposeFeatures.length <= 0 || purposeParts.length <= 0) {
        return null;
    }
    return {
        surface: normalizedSurface,
        subject: normalizedSubject,
        subjectFeatures,
        purpose: normalizedPurpose,
        purposeFeatures,
        purposeParts,
    };
}

function buildDependencyFrame(
    surface: string,
    subject: string,
    dependency: string
): DependencyFrame | null {
    const normalizedSurface = normalizeWhitespace(surface);
    const normalizedSubject = normalizeDependencyFrameSubject(subject);
    const normalizedDependency = normalizeDependencyFrameValue(dependency);
    if (!normalizedSurface || !normalizedSubject || !normalizedDependency) {
        return null;
    }
    if (/\d/u.test(normalizedDependency)) {
        return null;
    }
    const subjectFeatures = buildDependencyFrameFeatures(normalizedSubject);
    const dependencyFeatures = buildDependencyFrameFeatures(normalizedDependency);
    const dependencyParts = splitDependencyFrameParts(normalizedDependency);
    if (subjectFeatures.length <= 0 || dependencyFeatures.length <= 0 || dependencyParts.length <= 0) {
        return null;
    }
    return {
        surface: normalizedSurface,
        subject: normalizedSubject,
        subjectFeatures,
        dependency: normalizedDependency,
        dependencyFeatures,
        dependencyParts,
    };
}

function extractContainmentFrames(value: string): ContainmentFrame[] {
    const patterns: RegExp[] = [
        /^(.{1,80}?)\s+contains?\s+(.+)$/iu,
        /^(.{1,80}?)\s+(?:is|are|was|were)\s+filled\s+with\s+(.+)$/iu,
        /^(.{1,24}?)(?:装有|盛有|含有|包含)(.+)$/u,
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
                const frame = buildContainmentFrame(
                    sentence,
                    String(match[1] || ''),
                    String(match[2] || '')
                );
                return frame ? [frame] : [];
            }
            return [];
        });
}

function extractPurposeFrames(value: string): PurposeFrame[] {
    const patterns: RegExp[] = [
        /^(.{1,80}?)\s+(?:is|are|was|were|can\s+be|may\s+be)?\s*used\s+for\s+(.+)$/iu,
        /^(.{1,80}?)\s+(?:is|are|was|were|can\s+be|may\s+be)?\s*used\s+to\s+(.+)$/iu,
        /^(.{1,80}?)\s+(?:is|are|was|were)\s+designed\s+for\s+(.+)$/iu,
        /^(.{1,80}?)\s+(?:is|are|was|were)\s+designed\s+to\s+(.+)$/iu,
        /^(.{1,80}?)\s+serv(?:es|ed|e)\s+(?:to|for)\s+(.+)$/iu,
        /^(.{1,24}?)(?:可)?用于(.+)$/u,
        /^(.{1,24}?)(?:可)?用来(.+)$/u,
        /^(.{1,24}?)(?:被)?用作(.+)$/u,
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
                const frame = buildPurposeFrame(
                    sentence,
                    String(match[1] || ''),
                    String(match[2] || '')
                );
                return frame ? [frame] : [];
            }
            return [];
        });
}

function extractDependencyFrames(value: string): DependencyFrame[] {
    const directPatterns: RegExp[] = [
        /^(.{1,80}?)\s+depends?\s+on\s+(.+)$/iu,
        /^(.{1,80}?)\s+rel(?:ies|ied|y)\s+on\s+(.+)$/iu,
        /^(.{1,80}?)\s+requires?\s+(.+)$/iu,
        /^(.{1,80}?)\s+has\s+(?:the\s+)?prerequisites?\s+(.+)$/iu,
        /^(.{1,24}?)(?:依赖|依賴)(.+)$/u,
        /^(.{1,24}?)(?:需要|需)(.+)$/u,
        /^(.{1,24}?)(?:的)?前置条件是(.+)$/u,
    ];
    const reversedPatterns: Array<{ pattern: RegExp; subjectIndex: number; dependencyIndex: number }> = [
        {
            pattern: /^(.{1,80}?)\s+(?:is|are|was|were)\s+a\s+prerequisite\s+for\s+(.+)$/iu,
            subjectIndex: 2,
            dependencyIndex: 1,
        },
        {
            pattern: /^(.{1,80}?)\s+(?:is|are|was|were)\s+required\s+by\s+(.+)$/iu,
            subjectIndex: 2,
            dependencyIndex: 1,
        },
        {
            pattern: /^(.+?)是(.{1,24}?)(?:的)?前置条件$/u,
            subjectIndex: 2,
            dependencyIndex: 1,
        },
    ];
    return String(value || '')
        .split(POLARITY_SENTENCE_SPLIT_PATTERN)
        .map((sentence) => normalizeWhitespace(sentence))
        .filter((sentence) => sentence.length >= 8 || (containsCjk(sentence) && sentence.length >= 5))
        .flatMap((sentence) => {
            for (const pattern of directPatterns) {
                const match = sentence.match(pattern);
                if (!match) {
                    continue;
                }
                const frame = buildDependencyFrame(
                    sentence,
                    String(match[1] || ''),
                    String(match[2] || '')
                );
                return frame ? [frame] : [];
            }
            for (const candidate of reversedPatterns) {
                const match = sentence.match(candidate.pattern);
                if (!match) {
                    continue;
                }
                const frame = buildDependencyFrame(
                    sentence,
                    String(match[candidate.subjectIndex] || ''),
                    String(match[candidate.dependencyIndex] || '')
                );
                return frame ? [frame] : [];
            }
            return [];
        });
}

function buildLocationFrame(
    surface: string,
    subject: string,
    location: string
): LocationFrame | null {
    const normalizedSurface = normalizeWhitespace(surface);
    const normalizedSubject = normalizeLocationFrameSubject(subject);
    const normalizedLocation = normalizeLocationFrameValue(location);
    if (!normalizedSurface || !normalizedSubject || !normalizedLocation) {
        return null;
    }
    const subjectFeatures = buildLocationFrameFeatures(normalizedSubject);
    const locationFeatures = buildLocationFrameFeatures(normalizedLocation);
    if (subjectFeatures.length <= 0 || locationFeatures.length <= 0) {
        return null;
    }
    return {
        surface: normalizedSurface,
        subject: normalizedSubject,
        subjectFeatures,
        location: normalizedLocation,
        locationFeatures,
    };
}

function extractLocationFrames(value: string): LocationFrame[] {
    const patterns: RegExp[] = [
        /^(.{1,80}?)\s+(?:is|are|was|were)\s+located\s+(?:in|inside|within|at)\s+(.+)$/iu,
        /^(.{1,80}?)\s+(?:is|are|was|were)\s+situated\s+(?:in|inside|within|at)\s+(.+)$/iu,
        /^(.{1,80}?)\s+(?:is|are|was|were)\s+positioned\s+(?:in|inside|within|at)\s+(.+)$/iu,
        /^(.{1,80}?)\s+lies?\s+(?:in|within)\s+(.+)$/iu,
        /^(.{1,24}?)(?:位于|位於|坐落于|坐落於|处于|處於)(.+)$/u,
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
                const frame = buildLocationFrame(
                    sentence,
                    String(match[1] || ''),
                    String(match[2] || '')
                );
                return frame ? [frame] : [];
            }
            return [];
        });
}

function extractCompositionFrames(value: string): CompositionFrame[] {
    const patterns: RegExp[] = [
        /^(.{1,80}?)\s+consists?\s+of\s+(.+)$/iu,
        /^(.{1,80}?)\s+(?:is|are|was|were)\s+composed\s+of\s+(.+)$/iu,
        /^(.{1,80}?)\s+(?:is|are|was|were)\s+made\s+of\s+(.+)$/iu,
        /^(.{1,80}?)\s+(?:is|are|was|were)\s+.+?\bcomposed\s+of\s+(.+)$/iu,
        /^(.{1,80}?)\s+(?:is|are|was|were)\s+.+?\bmade\s+of\s+(.+)$/iu,
        /^(.{1,24}?)(?:是)?由(.+?)(?:组成|构成|構成)(?:的.+)?$/u,
        /^(.{1,24}?)(?:被定义为|定义为|被定義為|定義為).+?由(.+?)(?:组成|构成|構成)(?:的.+)?$/u,
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
                const frame = buildCompositionFrame(
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

function attributeFrameSubjectsComparable(answerFrame: AttributeFrame, supportFrame: AttributeFrame): boolean {
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

function attributeFrameValuesEquivalent(answerFrame: AttributeFrame, supportFrame: AttributeFrame): boolean {
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
    const answerOverlap = computeFeatureOverlapRatio(answerFrame.valueFeatures, supportFrame.valueFeatures);
    const supportOverlap = computeFeatureOverlapRatio(supportFrame.valueFeatures, answerFrame.valueFeatures);
    return answerOverlap === 1 || supportOverlap === 1;
}

function attributeFrameValueOverlap(answerFrame: AttributeFrame, supportFrame: AttributeFrame): number {
    return Math.max(
        computeFeatureOverlapRatio(answerFrame.valueFeatures, supportFrame.valueFeatures),
        computeFeatureOverlapRatio(supportFrame.valueFeatures, answerFrame.valueFeatures),
        computeFeatureJaccard(answerFrame.valueFeatures, supportFrame.valueFeatures)
    );
}

function attributeFramesComparable(answerFrame: AttributeFrame, supportFrame: AttributeFrame): boolean {
    if (!attributeFrameSubjectsComparable(answerFrame, supportFrame)) {
        return false;
    }
    if (attributeFrameValuesEquivalent(answerFrame, supportFrame)) {
        return true;
    }
    return attributeFrameValueOverlap(answerFrame, supportFrame) >= 0.5;
}

function buildAttributeConflictMessage(conflicts: AttributeFrameConflict[]): string {
    if (conflicts.length <= 0) {
        return 'Draft answer stayed attribute-consistent with the grounded support that could be compared.';
    }
    const fragments = conflicts.slice(0, 2).map((conflict) => (
        `"${conflict.answerFrame.surface}" conflicted with "${conflict.supportFrame.surface}" (${conflict.supportFrame.label})`
    ));
    return `Draft answer contradicted comparable grounded attribute claims: ${fragments.join('; ')}.`;
}

function containmentFrameSubjectsComparable(
    answerFrame: ContainmentFrame,
    supportFrame: ContainmentFrame
): boolean {
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

function containmentFrameObjectsEquivalent(
    answerFrame: ContainmentFrame,
    supportFrame: ContainmentFrame
): boolean {
    const normalizedAnswerObject = normalizeWhitespace(answerFrame.object).toLowerCase();
    const normalizedSupportObject = normalizeWhitespace(supportFrame.object).toLowerCase();
    if (!normalizedAnswerObject || !normalizedSupportObject) {
        return false;
    }
    if (
        normalizedAnswerObject === normalizedSupportObject
        || normalizedAnswerObject.includes(normalizedSupportObject)
        || normalizedSupportObject.includes(normalizedAnswerObject)
    ) {
        return true;
    }
    return (
        computeFeatureOverlapRatio(answerFrame.objectFeatures, supportFrame.objectFeatures) >= 0.75
        || computeFeatureJaccard(answerFrame.objectFeatures, supportFrame.objectFeatures) >= 0.75
    );
}

function containmentFrameObjectOverlap(
    answerFrame: ContainmentFrame,
    supportFrame: ContainmentFrame
): number {
    return computeFeatureOverlapRatio(answerFrame.objectFeatures, supportFrame.objectFeatures);
}

function buildContainmentConflictMessage(conflicts: ContainmentFrameConflict[]): string {
    if (conflicts.length <= 0) {
        return 'Draft answer stayed containment-consistent with the grounded support that could be compared.';
    }
    const fragments = conflicts.slice(0, 2).map((conflict) => (
        `"${conflict.answerFrame.surface}" conflicted with "${conflict.supportFrame.surface}" (${conflict.supportFrame.label})`
    ));
    return `Draft answer contradicted comparable grounded containment relations: ${fragments.join('; ')}.`;
}

function compositionFrameSubjectsComparable(
    answerFrame: CompositionFrame,
    supportFrame: CompositionFrame
): boolean {
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

function compositionFramePartsEquivalent(
    answerPart: CompositionFramePart,
    supportPart: CompositionFramePart
): boolean {
    const normalizedAnswerPart = normalizeWhitespace(answerPart.surface).toLowerCase();
    const normalizedSupportPart = normalizeWhitespace(supportPart.surface).toLowerCase();
    if (!normalizedAnswerPart || !normalizedSupportPart) {
        return false;
    }
    if (
        normalizedAnswerPart === normalizedSupportPart
        || normalizedAnswerPart.includes(normalizedSupportPart)
        || normalizedSupportPart.includes(normalizedAnswerPart)
    ) {
        return true;
    }
    return (
        computeFeatureOverlapRatio(answerPart.features, supportPart.features) >= 0.75
        || computeFeatureOverlapRatio(supportPart.features, answerPart.features) >= 0.75
        || computeFeatureJaccard(answerPart.features, supportPart.features) >= 0.75
    );
}

function compositionFramePartsCovered(
    sourceParts: CompositionFramePart[],
    targetParts: CompositionFramePart[]
): boolean {
    if (sourceParts.length <= 0 || targetParts.length <= 0) {
        return false;
    }
    return sourceParts.every((sourcePart) => (
        targetParts.some((targetPart) => compositionFramePartsEquivalent(sourcePart, targetPart))
    ));
}

function compositionFrameComponentsEquivalent(
    answerFrame: CompositionFrame,
    supportFrame: CompositionFrame
): boolean {
    const normalizedAnswerComponents = normalizeWhitespace(answerFrame.components).toLowerCase();
    const normalizedSupportComponents = normalizeWhitespace(supportFrame.components).toLowerCase();
    if (!normalizedAnswerComponents || !normalizedSupportComponents) {
        return false;
    }
    if (normalizedAnswerComponents === normalizedSupportComponents) {
        return true;
    }
    return (
        compositionFramePartsCovered(answerFrame.componentParts, supportFrame.componentParts)
        && compositionFramePartsCovered(supportFrame.componentParts, answerFrame.componentParts)
    );
}

function compositionFrameComponentOverlap(
    answerFrame: CompositionFrame,
    supportFrame: CompositionFrame
): number {
    return Math.max(
        computeFeatureOverlapRatio(answerFrame.componentFeatures, supportFrame.componentFeatures),
        computeFeatureOverlapRatio(supportFrame.componentFeatures, answerFrame.componentFeatures),
        computeFeatureJaccard(answerFrame.componentFeatures, supportFrame.componentFeatures)
    );
}

function buildCompositionConflictMessage(conflicts: CompositionFrameConflict[]): string {
    if (conflicts.length <= 0) {
        return 'Draft answer stayed composition-consistent with the grounded support that could be compared.';
    }
    const fragments = conflicts.slice(0, 2).map((conflict) => (
        `"${conflict.answerFrame.surface}" conflicted with "${conflict.supportFrame.surface}" (${conflict.supportFrame.label})`
    ));
    return `Draft answer contradicted comparable grounded composition claims: ${fragments.join('; ')}.`;
}

function purposeFrameSubjectsComparable(answerFrame: PurposeFrame, supportFrame: PurposeFrame): boolean {
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

function purposeFramePartsEquivalent(answerPart: PurposeFramePart, supportPart: PurposeFramePart): boolean {
    const normalizedAnswerPart = normalizeWhitespace(answerPart.surface).toLowerCase();
    const normalizedSupportPart = normalizeWhitespace(supportPart.surface).toLowerCase();
    if (!normalizedAnswerPart || !normalizedSupportPart) {
        return false;
    }
    if (
        normalizedAnswerPart === normalizedSupportPart
        || normalizedSupportPart.includes(normalizedAnswerPart)
    ) {
        return true;
    }
    return (
        computeFeatureOverlapRatio(answerPart.features, supportPart.features) >= 0.75
        || computeFeatureOverlapRatio(supportPart.features, answerPart.features) === 1
        || computeFeatureJaccard(answerPart.features, supportPart.features) >= 0.75
    );
}

function purposeFramePartsCovered(
    sourceParts: PurposeFramePart[],
    targetParts: PurposeFramePart[]
): boolean {
    if (sourceParts.length <= 0 || targetParts.length <= 0) {
        return false;
    }
    return sourceParts.every((sourcePart) => (
        targetParts.some((targetPart) => purposeFramePartsEquivalent(sourcePart, targetPart))
    ));
}

function purposeFrameValuesEquivalent(answerFrame: PurposeFrame, supportFrame: PurposeFrame): boolean {
    const normalizedAnswerPurpose = normalizeWhitespace(answerFrame.purpose).toLowerCase();
    const normalizedSupportPurpose = normalizeWhitespace(supportFrame.purpose).toLowerCase();
    if (!normalizedAnswerPurpose || !normalizedSupportPurpose) {
        return false;
    }
    if (
        normalizedAnswerPurpose === normalizedSupportPurpose
        || normalizedSupportPurpose.includes(normalizedAnswerPurpose)
    ) {
        return true;
    }
    return (
        purposeFramePartsCovered(answerFrame.purposeParts, supportFrame.purposeParts)
        || computeFeatureOverlapRatio(answerFrame.purposeFeatures, supportFrame.purposeFeatures) === 1
    );
}

function purposeFrameValueOverlap(answerFrame: PurposeFrame, supportFrame: PurposeFrame): number {
    return Math.max(
        computeFeatureOverlapRatio(answerFrame.purposeFeatures, supportFrame.purposeFeatures),
        computeFeatureOverlapRatio(supportFrame.purposeFeatures, answerFrame.purposeFeatures),
        computeFeatureJaccard(answerFrame.purposeFeatures, supportFrame.purposeFeatures)
    );
}

function buildPurposeConflictMessage(conflicts: PurposeFrameConflict[]): string {
    if (conflicts.length <= 0) {
        return 'Draft answer stayed purpose-consistent with the grounded support that could be compared.';
    }
    const fragments = conflicts.slice(0, 2).map((conflict) => (
        `"${conflict.answerFrame.surface}" conflicted with "${conflict.supportFrame.surface}" (${conflict.supportFrame.label})`
    ));
    return `Draft answer contradicted comparable grounded purpose claims: ${fragments.join('; ')}.`;
}

function dependencyFrameSubjectsComparable(answerFrame: DependencyFrame, supportFrame: DependencyFrame): boolean {
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

function dependencyFramePartsEquivalent(answerPart: DependencyFramePart, supportPart: DependencyFramePart): boolean {
    const normalizedAnswerPart = normalizeWhitespace(answerPart.surface).toLowerCase();
    const normalizedSupportPart = normalizeWhitespace(supportPart.surface).toLowerCase();
    if (!normalizedAnswerPart || !normalizedSupportPart) {
        return false;
    }
    if (
        normalizedAnswerPart === normalizedSupportPart
        || normalizedAnswerPart.includes(normalizedSupportPart)
        || normalizedSupportPart.includes(normalizedAnswerPart)
    ) {
        return true;
    }
    return (
        computeFeatureOverlapRatio(answerPart.features, supportPart.features) >= 0.75
        || computeFeatureOverlapRatio(supportPart.features, answerPart.features) === 1
        || computeFeatureJaccard(answerPart.features, supportPart.features) >= 0.75
    );
}

function dependencyFramePartsCovered(
    sourceParts: DependencyFramePart[],
    targetParts: DependencyFramePart[]
): boolean {
    if (sourceParts.length <= 0 || targetParts.length <= 0) {
        return false;
    }
    return sourceParts.every((sourcePart) => (
        targetParts.some((targetPart) => dependencyFramePartsEquivalent(sourcePart, targetPart))
    ));
}

function dependencyFrameValuesEquivalent(answerFrame: DependencyFrame, supportFrame: DependencyFrame): boolean {
    const normalizedAnswerDependency = normalizeWhitespace(answerFrame.dependency).toLowerCase();
    const normalizedSupportDependency = normalizeWhitespace(supportFrame.dependency).toLowerCase();
    if (!normalizedAnswerDependency || !normalizedSupportDependency) {
        return false;
    }
    if (
        normalizedAnswerDependency === normalizedSupportDependency
        || normalizedSupportDependency.includes(normalizedAnswerDependency)
    ) {
        return true;
    }
    return (
        dependencyFramePartsCovered(answerFrame.dependencyParts, supportFrame.dependencyParts)
        || computeFeatureOverlapRatio(answerFrame.dependencyFeatures, supportFrame.dependencyFeatures) === 1
    );
}

function dependencyFrameValueOverlap(answerFrame: DependencyFrame, supportFrame: DependencyFrame): number {
    return Math.max(
        computeFeatureOverlapRatio(answerFrame.dependencyFeatures, supportFrame.dependencyFeatures),
        computeFeatureOverlapRatio(supportFrame.dependencyFeatures, answerFrame.dependencyFeatures),
        computeFeatureJaccard(answerFrame.dependencyFeatures, supportFrame.dependencyFeatures)
    );
}

function buildDependencyConflictMessage(conflicts: DependencyFrameConflict[]): string {
    if (conflicts.length <= 0) {
        return 'Draft answer stayed dependency-consistent with the grounded support that could be compared.';
    }
    const fragments = conflicts.slice(0, 2).map((conflict) => (
        `"${conflict.answerFrame.surface}" conflicted with "${conflict.supportFrame.surface}" (${conflict.supportFrame.label})`
    ));
    return `Draft answer contradicted comparable grounded dependency claims: ${fragments.join('; ')}.`;
}

function locationFrameSubjectsComparable(answerFrame: LocationFrame, supportFrame: LocationFrame): boolean {
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

function locationFrameValuesEquivalent(answerFrame: LocationFrame, supportFrame: LocationFrame): boolean {
    const normalizedAnswerLocation = normalizeWhitespace(answerFrame.location).toLowerCase();
    const normalizedSupportLocation = normalizeWhitespace(supportFrame.location).toLowerCase();
    if (!normalizedAnswerLocation || !normalizedSupportLocation) {
        return false;
    }
    if (
        normalizedAnswerLocation === normalizedSupportLocation
        || normalizedSupportLocation.includes(normalizedAnswerLocation)
    ) {
        return true;
    }
    return computeFeatureOverlapRatio(answerFrame.locationFeatures, supportFrame.locationFeatures) === 1;
}

function locationFrameValueOverlap(answerFrame: LocationFrame, supportFrame: LocationFrame): number {
    return Math.max(
        computeFeatureOverlapRatio(answerFrame.locationFeatures, supportFrame.locationFeatures),
        computeFeatureJaccard(answerFrame.locationFeatures, supportFrame.locationFeatures)
    );
}

function buildLocationConflictMessage(conflicts: LocationFrameConflict[]): string {
    if (conflicts.length <= 0) {
        return 'Draft answer stayed location-consistent with the grounded support that could be compared.';
    }
    const fragments = conflicts.slice(0, 2).map((conflict) => (
        `"${conflict.answerFrame.surface}" conflicted with "${conflict.supportFrame.surface}" (${conflict.supportFrame.label})`
    ));
    return `Draft answer contradicted comparable grounded location claims: ${fragments.join('; ')}.`;
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

function collectAvailableRagAnswerRoles(context: AnswerReleaseReviewContext): RagEvidenceRole[] {
    if (!hasUsableRagEvidenceContext(context)) {
        return [];
    }
    const roles = new Set<RagEvidenceRole>();
    (context.ragContextPack?.fragments || []).forEach((fragment) => {
        if (fragment.role === 'direct_support') {
            roles.add('direct_support');
        }
        if (fragment.role === 'parent_context' || fragment.role === 'adjacent_context') {
            roles.add('parent_context');
        }
        if (fragment.role === 'graph_neighbor_support') {
            roles.add('graph_neighbor_support');
        }
    });
    return ['direct_support', 'parent_context', 'graph_neighbor_support'].filter((role) => roles.has(role as RagEvidenceRole)) as RagEvidenceRole[];
}

function ragAnswerRoleIsCovered(
    context: AnswerReleaseReviewContext,
    role: RagEvidenceRole
): boolean {
    const roleSet = role === 'parent_context'
        ? new Set<RagEvidenceRole>(['parent_context', 'adjacent_context'])
        : new Set<RagEvidenceRole>([role]);
    const supportText = collectRagRoleFragments(context, roleSet)
        .map((fragment) => fragment.text)
        .join(' ');
    if (!supportText) {
        return true;
    }
    return splitDraftAnswerClaims(context.draftAnswer)
        .some((claim) => computeGroundingAlignmentScore(claim, supportText) >= 0.22);
}

const HOW_TO_PROFILE_SIGNAL_RULES: RagProfileSignalRule[] = [
    {
        signal: 'how_to_steps',
        supportPatterns: [/\b(?:step\s*\d+|procedure|workflow|ordered steps?)\b/iu],
        answerPatterns: [/\b(?:step\s*\d+|procedure|workflow|ordered steps?)\b/iu],
    },
    {
        signal: 'how_to_prerequisites',
        supportPatterns: [/\b(?:prerequisites?|preconditions?|requirements?|before|confirm|ensure)\b/iu],
        answerPatterns: [/\b(?:prerequisites?|preconditions?|requirements?|before|confirm|ensure|stable bench|laser is off)\b/iu],
    },
    {
        signal: 'how_to_failure_handling',
        supportPatterns: [/\b(?:failure modes?|failure handling|if\b.{0,100}\b(?:fail|drift|error|repeat)|fallback|recover|retry)\b/iu],
        answerPatterns: [/\b(?:failure modes?|failure handling|if\b.{0,100}\b(?:fail|drift|error|repeat)|fallback|recover|retry)\b/iu],
    },
];

const CAUSAL_PROFILE_SIGNAL_RULES: RagProfileSignalRule[] = [
    {
        signal: 'causal_mechanism',
        supportPatterns: [/\b(?:because|cause|causal|mechanism|reason|direct cause|occurs when|occurs because)\b/iu],
        answerPatterns: [/\b(?:because|cause|causal|mechanism|reason|occurs when|occurs because|changes)\b/iu],
    },
    {
        signal: 'causal_consequence',
        supportPatterns: [/\b(?:downstream|consequence|implication|invalidates|leads to|therefore|so\b)\b/iu],
        answerPatterns: [/\b(?:downstream|consequence|implication|invalidates|leads to|therefore|so\b)\b/iu],
    },
    {
        signal: 'causal_boundary',
        supportPatterns: [/\b(?:not only|not just|rather than|instead of|boundary)\b/iu],
        answerPatterns: [/\b(?:not only|not just|rather than|instead of|boundary)\b/iu],
    },
];

function ragProfileSignalRules(profile: RagPublicAnswerProfile): RagProfileSignalRule[] {
    if (profile === 'how_to') {
        return HOW_TO_PROFILE_SIGNAL_RULES;
    }
    if (profile === 'causal') {
        return CAUSAL_PROFILE_SIGNAL_RULES;
    }
    return [];
}

function ragProfileTextMatches(value: string, patterns: RegExp[]): boolean {
    const normalized = normalizeWhitespace(value);
    return Boolean(normalized) && patterns.some((pattern) => pattern.test(normalized));
}

function collectRagProfileSupportText(context: AnswerReleaseReviewContext): string {
    return (context.ragContextPack?.fragments || [])
        .map((fragment) => normalizeWhitespace([
            fragment.title || '',
            Array.isArray(fragment.headingPath) ? fragment.headingPath.join(' ') : '',
            fragment.text || '',
        ].join(' ')))
        .filter(Boolean)
        .join(' ');
}

function evaluateRagProfileCompleteness(context: AnswerReleaseReviewContext): {
    requiredProfileSignals: RagProfileCompletenessSignal[];
    missingProfileSignals: RagProfileCompletenessSignal[];
} {
    const rules = ragProfileSignalRules(resolveRagPublicAnswerProfile(context.message));
    if (rules.length <= 0) {
        return {
            requiredProfileSignals: [],
            missingProfileSignals: [],
        };
    }
    const supportText = collectRagProfileSupportText(context);
    const answerText = String(context.draftAnswer || '');
    const requiredProfileSignals = rules
        .filter((rule) => ragProfileTextMatches(supportText, rule.supportPatterns))
        .map((rule) => rule.signal);
    const missingProfileSignals = rules
        .filter((rule) => (
            requiredProfileSignals.includes(rule.signal)
            && !ragProfileTextMatches(answerText, rule.answerPatterns)
        ))
        .map((rule) => rule.signal);
    return {
        requiredProfileSignals,
        missingProfileSignals,
    };
}

function evaluateRagAnswerCompleteness(context: AnswerReleaseReviewContext): RagAnswerCompleteness {
    const availableRoles = collectAvailableRagAnswerRoles(context);
    if (availableRoles.length <= 0) {
        return {
            passed: true,
            applicable: false,
            requiredRoles: [],
            missingRoles: [],
            requiredProfileSignals: [],
            missingProfileSignals: [],
        };
    }
    const sufficiencyStatus = context.ragSufficiencyReview?.status || 'borderline';
    const requiredRoles = sufficiencyStatus === 'sufficient'
        ? availableRoles
        : availableRoles.filter((role) => role === 'direct_support');
    const missingRoles = requiredRoles.filter((role) => !ragAnswerRoleIsCovered(context, role));
    const profileCompleteness = evaluateRagProfileCompleteness(context);
    return {
        passed: missingRoles.length <= 0 && profileCompleteness.missingProfileSignals.length <= 0,
        applicable: true,
        requiredRoles,
        missingRoles,
        requiredProfileSignals: profileCompleteness.requiredProfileSignals,
        missingProfileSignals: profileCompleteness.missingProfileSignals,
    };
}

function buildRagAnswerCompletenessMessage(result: RagAnswerCompleteness): string {
    if (!result.applicable) {
        return 'No usable RAG context pack was available, so RAG completeness was not evaluated.';
    }
    if (result.passed) {
        return `Draft answer covered the required RAG evidence roles: ${result.requiredRoles.join(', ') || 'none'}; profile signals: ${result.requiredProfileSignals.join(', ') || 'none'}.`;
    }
    return `Draft answer missed required RAG evidence roles: ${result.missingRoles.join(', ') || 'none'}; missing profile signals: ${result.missingProfileSignals.join(', ') || 'none'}.`;
}

function preservePlannedGraphAnswerClaims(
    answer: string,
    plan: GraphAnswerPlan | null | undefined,
    preservePlan: boolean
): string {
    if (!preservePlan) {
        return normalizeWhitespace(answer);
    }
    const plannedStatements = (plan?.claims || [])
        .map((claim) => naturalizeRagPublicEvidenceClause(String(claim.statement || '')))
        .filter((statement) => statement && !shouldRejectPublicEvidenceClause(statement));
    if (plannedStatements.length <= 0) {
        return normalizeWhitespace(answer);
    }
    const normalizedAnswer = normalizeWhitespace(answer);
    const orderedPlanText = plannedStatements.join(' ');
    const supplementalClauses = segmentRagEvidenceClauses(naturalizeRagPublicEvidenceClause(normalizedAnswer))
        .map((clause) => normalizeWhitespace(clause))
        .filter((clause) => clause && !shouldRejectPublicEvidenceClause(clause))
        .filter((clause) => !plannedStatements.some((plannedStatement) => {
            const clauseKey = clause.toLowerCase();
            const plannedKey = plannedStatement.toLowerCase();
            return clauseKey === plannedKey
                || clauseKey.includes(plannedKey)
                || plannedKey.includes(clauseKey);
        }));
    const supplementalText = supplementalClauses.join(' ');
    return normalizeWhitespace([orderedPlanText, supplementalText].filter(Boolean).join(' '));
}

function collectCitationBackedRagFragments(context: AnswerReleaseReviewContext): RagEvidenceFragment[] {
    if (!hasUsableRagEvidenceContext(context)) {
        return [];
    }
    return (context.ragContextPack?.fragments || []).filter((fragment) => (
        normalizeWhitespace(String(fragment.text || '')).length > 0
        && Array.isArray(fragment.citationIds)
        && fragment.citationIds.some((citationId) => normalizeWhitespace(String(citationId || '')).length > 0)
    ));
}

function claimLooksLikeReleaseScaffolding(claim: string): boolean {
    const normalizedClaim = normalizeWhitespace(claim);
    if (!normalizedClaim) {
        return true;
    }
    return (
        /\b(?:grounded by|key evidence|citations?|rag context|retrieval|planner)\b/iu.test(normalizedClaim)
        || INTERNAL_DIAGNOSTIC_FRAGMENTS.some((fragment) => normalizedClaim.includes(fragment))
    );
}

function splitDraftAnswerClaims(answer: string): string[] {
    return stripMarkdownScaffolding(answer)
        .split(POLARITY_SENTENCE_SPLIT_PATTERN)
        .map((claim) => normalizeWhitespace(claim))
        .filter((claim) => (
            claim.length >= 8
            && !claimLooksLikeReleaseScaffolding(claim)
            && !ENGLISH_META_DOCUMENTARY_PATTERN.test(claim)
            && !CHINESE_META_DOCUMENTARY_PATTERN.test(claim)
            && !isPromptArtifactClause(claim)
        ));
}

function collectClaimSupportFeatures(value: string): string[] {
    return collectLexicalFeatures(value).filter((feature) => {
        const normalizedFeature = normalizeWhitespace(feature).toLowerCase();
        if (!normalizedFeature || STRUCTURED_ANCHOR_STOPWORDS.has(normalizedFeature)) {
            return false;
        }
        const asciiOnly = /^[a-z0-9]+$/u.test(normalizedFeature);
        if (asciiOnly && normalizedFeature.length < 3) {
            return false;
        }
        return true;
    });
}

function scoreClaimAgainstCitationBackedRagSupport(
    claim: string,
    supportText: string,
    supportFeatures: Set<string>
): {
    status: 'supported' | 'weak' | 'unsupported' | 'ignored';
    overlapCount: number;
    coverage: number;
} {
    const claimFeatures = collectClaimSupportFeatures(claim);
    if (claimFeatures.length < RAG_CLAIM_CITATION_SUPPORT_MIN_FEATURES) {
        return {
            status: 'ignored',
            overlapCount: 0,
            coverage: 1,
        };
    }
    const normalizedClaim = stripTerminalSentencePunctuation(stripMarkdownScaffolding(claim)).toLowerCase();
    const normalizedSupport = stripTerminalSentencePunctuation(stripMarkdownScaffolding(supportText)).toLowerCase();
    if (normalizedClaim && normalizedSupport.includes(normalizedClaim)) {
        return {
            status: 'supported',
            overlapCount: claimFeatures.length,
            coverage: 1,
        };
    }
    const overlapCount = claimFeatures.filter((feature) => supportFeatures.has(feature)).length;
    const missingFeatureCount = claimFeatures.length - overlapCount;
    const coverage = claimFeatures.length > 0 ? overlapCount / claimFeatures.length : 0;
    if (
        overlapCount >= RAG_CLAIM_CITATION_SUPPORT_MIN_FEATURES
        && coverage >= RAG_CLAIM_CITATION_SUPPORT_MIN_COVERAGE
        && missingFeatureCount <= RAG_CLAIM_CITATION_SUPPORT_MAX_MISSING_FEATURES
    ) {
        return {
            status: 'supported',
            overlapCount,
            coverage,
        };
    }
    if (
        overlapCount >= RAG_CLAIM_CITATION_SUPPORT_MIN_FEATURES
        && coverage >= RAG_CLAIM_CITATION_SUPPORT_WEAK_COVERAGE
    ) {
        return {
            status: 'weak',
            overlapCount,
            coverage,
        };
    }
    return {
        status: 'unsupported',
        overlapCount,
        coverage,
    };
}

function evaluateRagClaimCitationSupport(context: AnswerReleaseReviewContext): RagClaimCitationSupport {
    if (!hasUsableRagEvidenceContext(context)) {
        return {
            passed: true,
            applicable: false,
            supportedClaimCount: 0,
            weakClaims: [],
            unsupportedClaims: [],
            citationBackedFragmentCount: 0,
        };
    }
    const claims = splitDraftAnswerClaims(context.draftAnswer).filter((claim) => (
        collectClaimSupportFeatures(claim).length >= RAG_CLAIM_CITATION_SUPPORT_MIN_FEATURES
    ));
    const citationBackedFragments = collectCitationBackedRagFragments(context);
    const citationBackedPlanEvidence = (context.graphAnswerPlan?.claims || [])
        .flatMap((claim) => claim.evidenceRefs || [])
        .filter((evidence) => (
            normalizeWhitespace(String(evidence.text || '')).length > 0
            && Array.isArray(evidence.citationIds)
            && evidence.citationIds.some((citationId) => normalizeWhitespace(String(citationId || '')).length > 0)
        ));
    const citationBackedEvidenceCount = citationBackedFragments.length + citationBackedPlanEvidence.length;
    if (claims.length <= 0) {
        return {
            passed: true,
            applicable: true,
            supportedClaimCount: 0,
            weakClaims: [],
            unsupportedClaims: [],
            citationBackedFragmentCount: citationBackedFragments.length,
        };
    }
    if (citationBackedEvidenceCount <= 0) {
        return {
            passed: false,
            applicable: true,
            supportedClaimCount: 0,
            weakClaims: [],
            unsupportedClaims: claims,
            citationBackedFragmentCount: 0,
        };
    }
    const supportText = citationBackedFragments
        .map((fragment) => [
            normalizeWhitespace(String(fragment.title || '').trim()),
            normalizeWhitespace(String(fragment.text || '').trim()),
        ].filter(Boolean).join(' '))
        .concat(citationBackedPlanEvidence.map((evidence) => normalizeWhitespace(evidence.text)))
        .filter(Boolean)
        .join(' ');
    const supportFeatures = new Set(collectClaimSupportFeatures(supportText));
    const weakClaims: string[] = [];
    const unsupportedClaims: string[] = [];
    let supportedClaimCount = 0;
    claims.forEach((claim) => {
        const score = scoreClaimAgainstCitationBackedRagSupport(claim, supportText, supportFeatures);
        if (score.status === 'supported' || score.status === 'ignored') {
            supportedClaimCount += score.status === 'supported' ? 1 : 0;
            return;
        }
        if (score.status === 'weak') {
            weakClaims.push(claim);
            return;
        }
        unsupportedClaims.push(claim);
    });
    return {
        passed: weakClaims.length <= 0 && unsupportedClaims.length <= 0,
        applicable: true,
        supportedClaimCount,
        weakClaims,
        unsupportedClaims,
        citationBackedFragmentCount: citationBackedEvidenceCount,
    };
}

function buildRagClaimCitationSupportMessage(result: RagClaimCitationSupport): string {
    if (!result.applicable) {
        return 'No usable RAG context pack was available, so claim-level citation support was not evaluated.';
    }
    if (result.passed) {
        return `Citation-backed RAG fragments supported ${result.supportedClaimCount} public claim(s).`;
    }
    if (result.citationBackedFragmentCount <= 0) {
        return 'No citation-backed RAG fragments were available for the public claims in the draft answer.';
    }
    const claimSamples = [...result.unsupportedClaims, ...result.weakClaims]
        .slice(0, 2)
        .map((claim) => `"${claim}"`);
    const unsupportedSummary = result.unsupportedClaims.length > 0
        ? `${result.unsupportedClaims.length} unsupported`
        : '';
    const weakSummary = result.weakClaims.length > 0
        ? `${result.weakClaims.length} weak`
        : '';
    const summary = [unsupportedSummary, weakSummary].filter(Boolean).join(' and ');
    return `Draft answer had ${summary || 'insufficiently supported'} public RAG claim(s): ${claimSamples.join('; ')}.`;
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

function normalizeStructuredComparisonSide(value: string): string {
    return normalizeWhitespace(String(value || ''))
        .replace(/^(?:a|an|the)\s+/i, '')
        .replace(/[“”"'`]+/gu, '')
        .replace(/[,:;]+$/g, '')
        .trim();
}

function buildStructuredComparisonSideFeatures(value: string): string[] {
    return collectOrderedLexicalFeatures(value)
        .map((feature) => String(feature || '').trim().toLowerCase())
        .filter((feature) => feature.length >= 2)
        .filter((feature) => !STRUCTURED_ANCHOR_STOPWORDS.has(feature));
}

function buildStructuredComparisonFrame(
    surface: string,
    leftAnchor: string,
    rightAnchor: string,
    relation: StructuredComparisonRelation
): StructuredComparisonFrame | null {
    const normalizedSurface = normalizeWhitespace(surface);
    const normalizedLeftAnchor = normalizeStructuredComparisonSide(leftAnchor);
    const normalizedRightAnchor = normalizeStructuredComparisonSide(rightAnchor);
    if (!normalizedSurface || !normalizedLeftAnchor || !normalizedRightAnchor) {
        return null;
    }
    if (normalizedLeftAnchor.toLowerCase() === normalizedRightAnchor.toLowerCase()) {
        return null;
    }
    const leftFeatures = buildStructuredComparisonSideFeatures(normalizedLeftAnchor);
    const rightFeatures = buildStructuredComparisonSideFeatures(normalizedRightAnchor);
    if (leftFeatures.length <= 0 || rightFeatures.length <= 0) {
        return null;
    }
    const rightFeatureSet = new Set(rightFeatures);
    const sharedFeatures = leftFeatures.filter((feature) => rightFeatureSet.has(feature));
    if (sharedFeatures.length <= 0) {
        return null;
    }
    const sharedFeatureSet = new Set(sharedFeatures);
    const leftDistinctFeatures = leftFeatures.filter((feature) => !sharedFeatureSet.has(feature));
    const rightDistinctFeatures = rightFeatures.filter((feature) => !sharedFeatureSet.has(feature));
    if (leftDistinctFeatures.length <= 0 || rightDistinctFeatures.length <= 0) {
        return null;
    }
    return {
        surface: normalizedSurface,
        leftAnchor: normalizedLeftAnchor,
        leftFeatures,
        leftDistinctFeatures,
        rightAnchor: normalizedRightAnchor,
        rightFeatures,
        rightDistinctFeatures,
        sharedFeatures,
        relation,
    };
}

function extractStructuredComparisonFrames(value: string): StructuredComparisonFrame[] {
    const directPatterns: Array<{ pattern: RegExp; relation: StructuredComparisonRelation }> = [
        {
            pattern: /^(.{1,80}?)\s+(?:is|are|was|were)\s+(?:higher|greater|larger|bigger|more)\s+than\s+(.+)$/iu,
            relation: 'greater_than',
        },
        {
            pattern: /^(.{1,80}?)\s+(?:is|are|was|were)\s+(?:lower|less|smaller|fewer)\s+than\s+(.+)$/iu,
            relation: 'less_than',
        },
        {
            pattern: /^(.{1,40}?)(?:高于|高於|大于|大於|多于|多於|超过|超過)(.+)$/u,
            relation: 'greater_than',
        },
        {
            pattern: /^(.{1,40}?)(?:低于|低於|小于|小於|少于|少於)(.+)$/u,
            relation: 'less_than',
        },
    ];
    return String(value || '')
        .split(POLARITY_SENTENCE_SPLIT_PATTERN)
        .map((sentence) => normalizeWhitespace(sentence))
        .filter((sentence) => sentence.length >= 8)
        .flatMap((sentence) => {
            for (const candidate of directPatterns) {
                const match = sentence.match(candidate.pattern);
                if (!match) {
                    continue;
                }
                const frame = buildStructuredComparisonFrame(
                    sentence,
                    String(match[1] || ''),
                    String(match[2] || ''),
                    candidate.relation
                );
                return frame ? [frame] : [];
            }
            return [];
        });
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

function structuredComparisonFactMatchesSide(
    frame: StructuredComparisonFrame,
    fact: StructuredFact & { label?: string },
    side: 'left' | 'right'
): boolean {
    const comparableFeatures = Array.from(new Set(
        [
            ...fact.anchorTokens,
            ...buildStructuredComparisonSideFeatures(String(fact.label || '')),
        ]
            .map((feature) => String(feature || '').trim().toLowerCase())
            .filter((feature) => feature.length >= 2)
    ));
    if (comparableFeatures.length <= 0) {
        return false;
    }
    const factComparableFeatureSet = new Set(comparableFeatures);
    if (!frame.sharedFeatures.some((feature) => factComparableFeatureSet.has(feature))) {
        return false;
    }
    const distinctFeatures = side === 'left'
        ? frame.leftDistinctFeatures
        : frame.rightDistinctFeatures;
    return distinctFeatures.some((feature) => factComparableFeatureSet.has(feature));
}

function structuredComparisonPairSupportsAnswer(
    frame: StructuredComparisonFrame,
    leftFact: StructuredFact,
    rightFact: StructuredFact
): boolean {
    const magnitude = compareStructuredFactMagnitude(leftFact, rightFact);
    if (!magnitude) {
        return false;
    }
    return frame.relation === 'greater_than'
        ? magnitude > 0
        : magnitude < 0;
}

function buildStructuredComparisonPairScore(
    frame: StructuredComparisonFrame,
    leftFact: StructuredFact & { label?: string },
    rightFact: StructuredFact & { label?: string }
): number {
    const leftComparableFeatureSet = new Set([
        ...leftFact.anchorTokens,
        ...buildStructuredComparisonSideFeatures(String(leftFact.label || '')),
    ]);
    const rightComparableFeatureSet = new Set([
        ...rightFact.anchorTokens,
        ...buildStructuredComparisonSideFeatures(String(rightFact.label || '')),
    ]);
    const leftDistinctOverlap = frame.leftDistinctFeatures.filter((feature) => leftComparableFeatureSet.has(feature)).length;
    const rightDistinctOverlap = frame.rightDistinctFeatures.filter((feature) => rightComparableFeatureSet.has(feature)).length;
    const leftSharedOverlap = frame.sharedFeatures.filter((feature) => leftComparableFeatureSet.has(feature)).length;
    const rightSharedOverlap = frame.sharedFeatures.filter((feature) => rightComparableFeatureSet.has(feature)).length;
    return (
        leftDistinctOverlap * 4
        + rightDistinctOverlap * 4
        + leftSharedOverlap * 2
        + rightSharedOverlap * 2
    );
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

function buildStructuredComparisonConflictMessage(conflicts: StructuredComparisonConflict[]): string {
    if (conflicts.length <= 0) {
        return 'Draft answer stayed consistent with the grounded structured comparisons that could be compared.';
    }
    const fragments = conflicts.slice(0, 2).map((conflict) => (
        `"${conflict.answerFrame.surface}" conflicted with ${normalizeWhitespace(conflict.leftSupportFact.surface)} (${conflict.leftSupportFact.label}) and ${normalizeWhitespace(conflict.rightSupportFact.surface)} (${conflict.rightSupportFact.label})`
    ));
    return `Draft answer contradicted grounded structured comparisons: ${fragments.join('; ')}.`;
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

function evaluateStructuredComparisonConsistency(context: AnswerReleaseReviewContext): {
    passed: boolean;
    comparableFrameCount: number;
    conflicts: StructuredComparisonConflict[];
} {
    const answerFrames = extractStructuredComparisonFrames(context.draftAnswer);
    if (answerFrames.length <= 0) {
        return {
            passed: true,
            comparableFrameCount: 0,
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
            comparableFrameCount: 0,
            conflicts: [],
        };
    }
    const conflicts: StructuredComparisonConflict[] = [];
    let comparableFrameCount = 0;
    answerFrames.forEach((answerFrame) => {
        const leftSupportFacts = supportFacts.filter((supportFact) => structuredComparisonFactMatchesSide(answerFrame, supportFact, 'left'));
        const rightSupportFacts = supportFacts.filter((supportFact) => structuredComparisonFactMatchesSide(answerFrame, supportFact, 'right'));
        const comparablePairs: Array<{
            leftSupportFact: StructuredFact & { label: string };
            rightSupportFact: StructuredFact & { label: string };
            score: number;
        }> = [];
        leftSupportFacts.forEach((leftSupportFact) => {
            rightSupportFacts.forEach((rightSupportFact) => {
                if (leftSupportFact === rightSupportFact) {
                    return;
                }
                const magnitude = compareStructuredFactMagnitude(leftSupportFact, rightSupportFact);
                if (!magnitude) {
                    return;
                }
                comparablePairs.push({
                    leftSupportFact,
                    rightSupportFact,
                    score: buildStructuredComparisonPairScore(answerFrame, leftSupportFact, rightSupportFact),
                });
            });
        });
        if (comparablePairs.length <= 0) {
            return;
        }
        comparableFrameCount += 1;
        if (comparablePairs.some((pair) => structuredComparisonPairSupportsAnswer(answerFrame, pair.leftSupportFact, pair.rightSupportFact))) {
            return;
        }
        comparablePairs.sort((left, right) => right.score - left.score);
        conflicts.push({
            answerFrame,
            leftSupportFact: comparablePairs[0].leftSupportFact,
            rightSupportFact: comparablePairs[0].rightSupportFact,
        });
    });
    return {
        passed: conflicts.length <= 0,
        comparableFrameCount,
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

function evaluateAttributeConsistency(context: AnswerReleaseReviewContext): {
    passed: boolean;
    comparableFrameCount: number;
    conflicts: AttributeFrameConflict[];
} {
    const answerFrames = extractAttributeFrames(context.draftAnswer);
    if (answerFrames.length <= 0) {
        return {
            passed: true,
            comparableFrameCount: 0,
            conflicts: [],
        };
    }
    const supportFrames = buildSupportCandidates(context).flatMap((candidate) => (
        extractAttributeFrames(candidate.text).map((frame) => ({
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
    const conflicts: AttributeFrameConflict[] = [];
    let comparableFrameCount = 0;
    answerFrames.forEach((answerFrame) => {
        const comparableSupportFrames = supportFrames.filter((supportFrame) => (
            attributeFramesComparable(answerFrame, supportFrame)
        ));
        if (comparableSupportFrames.length <= 0) {
            return;
        }
        comparableFrameCount += 1;
        if (comparableSupportFrames.some((supportFrame) => attributeFrameValuesEquivalent(answerFrame, supportFrame))) {
            return;
        }
        conflicts.push({
            answerFrame,
            supportFrame: comparableSupportFrames
                .slice()
                .sort((left, right) => (
                    attributeFrameValueOverlap(answerFrame, right) - attributeFrameValueOverlap(answerFrame, left)
                ))[0],
        });
    });
    return {
        passed: conflicts.length <= 0,
        comparableFrameCount,
        conflicts: conflicts.filter((conflict) => Boolean(conflict.supportFrame)),
    };
}

function evaluateContainmentConsistency(context: AnswerReleaseReviewContext): {
    passed: boolean;
    comparableFrameCount: number;
    conflicts: ContainmentFrameConflict[];
} {
    const answerFrames = extractContainmentFrames(context.draftAnswer);
    if (answerFrames.length <= 0) {
        return {
            passed: true,
            comparableFrameCount: 0,
            conflicts: [],
        };
    }
    const supportFrames = buildSupportCandidates(context).flatMap((candidate) => (
        extractContainmentFrames(candidate.text).map((frame) => ({
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
    const conflicts: ContainmentFrameConflict[] = [];
    let comparableFrameCount = 0;
    answerFrames.forEach((answerFrame) => {
        const comparableSupportFrames = supportFrames.filter((supportFrame) => (
            containmentFrameSubjectsComparable(answerFrame, supportFrame)
        ));
        if (comparableSupportFrames.length <= 0) {
            return;
        }
        comparableFrameCount += 1;
        if (comparableSupportFrames.some((supportFrame) => containmentFrameObjectsEquivalent(answerFrame, supportFrame))) {
            return;
        }
        conflicts.push({
            answerFrame,
            supportFrame: comparableSupportFrames
                .slice()
                .sort((left, right) => (
                    containmentFrameObjectOverlap(answerFrame, right) - containmentFrameObjectOverlap(answerFrame, left)
                ))[0],
        });
    });
    return {
        passed: conflicts.length <= 0,
        comparableFrameCount,
        conflicts: conflicts.filter((conflict) => Boolean(conflict.supportFrame)),
    };
}

function evaluateCompositionConsistency(context: AnswerReleaseReviewContext): {
    passed: boolean;
    comparableFrameCount: number;
    conflicts: CompositionFrameConflict[];
} {
    const answerFrames = extractCompositionFrames(context.draftAnswer);
    if (answerFrames.length <= 0) {
        return {
            passed: true,
            comparableFrameCount: 0,
            conflicts: [],
        };
    }
    const supportFrames = buildSupportCandidates(context).flatMap((candidate) => (
        extractCompositionFrames(candidate.text).map((frame) => ({
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
    const conflicts: CompositionFrameConflict[] = [];
    let comparableFrameCount = 0;
    answerFrames.forEach((answerFrame) => {
        const comparableSupportFrames = supportFrames.filter((supportFrame) => (
            compositionFrameSubjectsComparable(answerFrame, supportFrame)
        ));
        if (comparableSupportFrames.length <= 0) {
            return;
        }
        comparableFrameCount += 1;
        if (comparableSupportFrames.some((supportFrame) => compositionFrameComponentsEquivalent(answerFrame, supportFrame))) {
            return;
        }
        conflicts.push({
            answerFrame,
            supportFrame: comparableSupportFrames
                .slice()
                .sort((left, right) => (
                    compositionFrameComponentOverlap(answerFrame, right)
                    - compositionFrameComponentOverlap(answerFrame, left)
                ))[0],
        });
    });
    return {
        passed: conflicts.length <= 0,
        comparableFrameCount,
        conflicts: conflicts.filter((conflict) => Boolean(conflict.supportFrame)),
    };
}

function evaluatePurposeConsistency(context: AnswerReleaseReviewContext): {
    passed: boolean;
    comparableFrameCount: number;
    conflicts: PurposeFrameConflict[];
} {
    const answerFrames = extractPurposeFrames(context.draftAnswer);
    if (answerFrames.length <= 0) {
        return {
            passed: true,
            comparableFrameCount: 0,
            conflicts: [],
        };
    }
    const supportFrames = buildSupportCandidates(context).flatMap((candidate) => (
        extractPurposeFrames(candidate.text).map((frame) => ({
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
    const conflicts: PurposeFrameConflict[] = [];
    let comparableFrameCount = 0;
    answerFrames.forEach((answerFrame) => {
        const comparableSupportFrames = supportFrames.filter((supportFrame) => (
            purposeFrameSubjectsComparable(answerFrame, supportFrame)
        ));
        if (comparableSupportFrames.length <= 0) {
            return;
        }
        comparableFrameCount += 1;
        if (comparableSupportFrames.some((supportFrame) => purposeFrameValuesEquivalent(answerFrame, supportFrame))) {
            return;
        }
        conflicts.push({
            answerFrame,
            supportFrame: comparableSupportFrames
                .slice()
                .sort((left, right) => (
                    purposeFrameValueOverlap(answerFrame, right) - purposeFrameValueOverlap(answerFrame, left)
                ))[0],
        });
    });
    return {
        passed: conflicts.length <= 0,
        comparableFrameCount,
        conflicts: conflicts.filter((conflict) => Boolean(conflict.supportFrame)),
    };
}

function evaluateDependencyConsistency(context: AnswerReleaseReviewContext): {
    passed: boolean;
    comparableFrameCount: number;
    conflicts: DependencyFrameConflict[];
} {
    const answerFrames = extractDependencyFrames(context.draftAnswer);
    if (answerFrames.length <= 0) {
        return {
            passed: true,
            comparableFrameCount: 0,
            conflicts: [],
        };
    }
    const supportFrames = buildSupportCandidates(context).flatMap((candidate) => (
        extractDependencyFrames(candidate.text).map((frame) => ({
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
    const conflicts: DependencyFrameConflict[] = [];
    let comparableFrameCount = 0;
    answerFrames.forEach((answerFrame) => {
        const comparableSupportFrames = supportFrames.filter((supportFrame) => (
            dependencyFrameSubjectsComparable(answerFrame, supportFrame)
        ));
        if (comparableSupportFrames.length <= 0) {
            return;
        }
        comparableFrameCount += 1;
        if (comparableSupportFrames.some((supportFrame) => dependencyFrameValuesEquivalent(answerFrame, supportFrame))) {
            return;
        }
        conflicts.push({
            answerFrame,
            supportFrame: comparableSupportFrames
                .slice()
                .sort((left, right) => (
                    dependencyFrameValueOverlap(answerFrame, right) - dependencyFrameValueOverlap(answerFrame, left)
                ))[0],
        });
    });
    return {
        passed: conflicts.length <= 0,
        comparableFrameCount,
        conflicts: conflicts.filter((conflict) => Boolean(conflict.supportFrame)),
    };
}

function evaluateLocationConsistency(context: AnswerReleaseReviewContext): {
    passed: boolean;
    comparableFrameCount: number;
    conflicts: LocationFrameConflict[];
} {
    const answerFrames = extractLocationFrames(context.draftAnswer);
    if (answerFrames.length <= 0) {
        return {
            passed: true,
            comparableFrameCount: 0,
            conflicts: [],
        };
    }
    const supportFrames = buildSupportCandidates(context).flatMap((candidate) => (
        extractLocationFrames(candidate.text).map((frame) => ({
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
    const conflicts: LocationFrameConflict[] = [];
    let comparableFrameCount = 0;
    answerFrames.forEach((answerFrame) => {
        const comparableSupportFrames = supportFrames.filter((supportFrame) => (
            locationFrameSubjectsComparable(answerFrame, supportFrame)
        ));
        if (comparableSupportFrames.length <= 0) {
            return;
        }
        comparableFrameCount += 1;
        if (comparableSupportFrames.some((supportFrame) => locationFrameValuesEquivalent(answerFrame, supportFrame))) {
            return;
        }
        conflicts.push({
            answerFrame,
            supportFrame: comparableSupportFrames
                .slice()
                .sort((left, right) => (
                    locationFrameValueOverlap(answerFrame, right) - locationFrameValueOverlap(answerFrame, left)
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

function evaluateGraphCausalConsistency(context: AnswerReleaseReviewContext): {
    passed: boolean;
    comparableClaimCount: number;
    conflicts: GraphCausalConflict[];
} {
    const causalEvidence = buildGraphCausalEvidence(context.graphContext);
    if (causalEvidence.length <= 0) {
        return {
            passed: true,
            comparableClaimCount: 0,
            conflicts: [],
        };
    }
    const conflicts: GraphCausalConflict[] = [];
    let comparableClaimCount = 0;
    causalEvidence.forEach((evidence) => {
        const consistentMatch = findDirectionalGraphCausalMatch(
            context.draftAnswer,
            evidence.causeTitle,
            evidence.effectTitle
        );
        const reversedMatch = findDirectionalGraphCausalMatch(
            context.draftAnswer,
            evidence.effectTitle,
            evidence.causeTitle
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

function evaluateGraphComparisonConsistency(context: AnswerReleaseReviewContext): {
    passed: boolean;
    comparableClaimCount: number;
    conflicts: GraphComparisonConflict[];
} {
    const comparisonEvidence = buildGraphComparisonEvidence(context.graphContext);
    if (comparisonEvidence.length <= 0) {
        return {
            passed: true,
            comparableClaimCount: 0,
            conflicts: [],
        };
    }
    const conflicts: GraphComparisonConflict[] = [];
    let comparableClaimCount = 0;
    comparisonEvidence.forEach((evidence) => {
        const supportedMatch = findGraphComparisonMatch(
            context.draftAnswer,
            evidence.leftTitle,
            evidence.rightTitle,
            evidence.relationKind
        );
        const unsupportedRelationKind: GraphComparisonSupportedRelationKind = evidence.relationKind === 'contrast'
            ? 'analogy'
            : 'contrast';
        const unsupportedMatch = findGraphComparisonMatch(
            context.draftAnswer,
            evidence.leftTitle,
            evidence.rightTitle,
            unsupportedRelationKind
        );
        if (!supportedMatch && !unsupportedMatch) {
            return;
        }
        comparableClaimCount += 1;
        if (unsupportedMatch && !supportedMatch) {
            conflicts.push({
                answerSurface: unsupportedMatch,
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

function evaluateTemporalValidityConsistency(
    context: AnswerReleaseReviewContext
): TemporalValidityConsistencyResult {
    const temporalValidity = context.graphContext?.temporalValidity;
    if (!temporalValidity || temporalValidity.allPointsValid !== false) {
        return {
            passed: true,
            applicable: false,
            qualificationSource: 'not_required',
            conflict: null,
        };
    }
    if (draftCarriesTemporalQualification(context.draftAnswer)) {
        return {
            passed: true,
            applicable: true,
            qualificationSource: 'draft_qualified',
            conflict: null,
        };
    }
    return {
        passed: false,
        applicable: true,
        qualificationSource: 'not_required',
        conflict: {
            anchorTitle: normalizeWhitespace(String(context.graphContext?.anchorTitle || '').trim()),
            warningReasons: Array.isArray(temporalValidity.warningReasons)
                ? temporalValidity.warningReasons.map((reason) => normalizeWhitespace(String(reason || '').trim())).filter(Boolean)
                : [],
            invalidKnowledgePointTitles: Array.isArray(temporalValidity.invalidKnowledgePointTitles)
                ? temporalValidity.invalidKnowledgePointTitles.map((title) => normalizeWhitespace(String(title || '').trim())).filter(Boolean)
                : [],
            checkedAt: normalizeWhitespace(String(temporalValidity.checkedAt || '').trim()),
        },
    };
}

function checkPublicSurfaceContraction(answer: string): boolean {
    const normalizedAnswer = String(answer || '');
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
    structuredComparisonConsistencyPassed: boolean,
    attributeConsistencyPassed: boolean,
    containmentConsistencyPassed: boolean,
    compositionConsistencyPassed: boolean,
    purposeConsistencyPassed: boolean,
    dependencyConsistencyPassed: boolean,
    locationConsistencyPassed: boolean,
    subjectConsistencyPassed: boolean,
    stateConsistencyPassed: boolean,
    polarityConsistencyPassed: boolean,
    graphCausalConsistencyPassed: boolean,
    graphOrderConsistencyPassed: boolean,
    graphComparisonConsistencyPassed: boolean,
    temporalValidityConsistencyPassed: boolean,
    ragAnswerCompletenessPassed: boolean,
    ragClaimCitationSupportPassed: boolean,
    graphAnswerPlanCoveragePassed: boolean,
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
        || !structuredComparisonConsistencyPassed
        || !attributeConsistencyPassed
        || !containmentConsistencyPassed
        || !compositionConsistencyPassed
        || !purposeConsistencyPassed
        || !dependencyConsistencyPassed
        || !locationConsistencyPassed
        || !subjectConsistencyPassed
        || !stateConsistencyPassed
        || !polarityConsistencyPassed
        || !graphCausalConsistencyPassed
        || !graphOrderConsistencyPassed
        || !graphComparisonConsistencyPassed
        || !temporalValidityConsistencyPassed
        || !ragAnswerCompletenessPassed
        || !ragClaimCitationSupportPassed
        || !graphAnswerPlanCoveragePassed
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
    const groundedEvidenceAvailable = context.knowledgePoints.length > 0
        || context.citations.length > 0
        || hasUsableRagEvidenceContext(context);
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
    const structuredComparisonConsistency = groundedEvidenceAvailable
        ? evaluateStructuredComparisonConsistency({
            ...context,
            draftAnswer,
        })
        : {
            passed: true,
            comparableFrameCount: 0,
            conflicts: [],
        };
    const attributeConsistency = groundedEvidenceAvailable
        ? evaluateAttributeConsistency({
            ...context,
            draftAnswer,
        })
        : {
            passed: true,
            comparableFrameCount: 0,
            conflicts: [],
        };
    const containmentConsistency = groundedEvidenceAvailable
        ? evaluateContainmentConsistency({
            ...context,
            draftAnswer,
        })
        : {
            passed: true,
            comparableFrameCount: 0,
            conflicts: [],
        };
    const compositionConsistency = groundedEvidenceAvailable
        ? evaluateCompositionConsistency({
            ...context,
            draftAnswer,
        })
        : {
            passed: true,
            comparableFrameCount: 0,
            conflicts: [],
        };
    const purposeConsistency = groundedEvidenceAvailable
        ? evaluatePurposeConsistency({
            ...context,
            draftAnswer,
        })
        : {
            passed: true,
            comparableFrameCount: 0,
            conflicts: [],
        };
    const dependencyConsistency = groundedEvidenceAvailable
        ? evaluateDependencyConsistency({
            ...context,
            draftAnswer,
        })
        : {
            passed: true,
            comparableFrameCount: 0,
            conflicts: [],
        };
    const locationConsistency = groundedEvidenceAvailable
        ? evaluateLocationConsistency({
            ...context,
            draftAnswer,
        })
        : {
            passed: true,
            comparableFrameCount: 0,
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
    const graphCausalConsistency = groundedEvidenceAvailable
        ? evaluateGraphCausalConsistency({
            ...context,
            draftAnswer,
        })
        : {
            passed: true,
            comparableClaimCount: 0,
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
    const graphComparisonConsistency = groundedEvidenceAvailable
        ? evaluateGraphComparisonConsistency({
            ...context,
            draftAnswer,
        })
        : {
            passed: true,
            comparableClaimCount: 0,
            conflicts: [],
        };
    const temporalValidityConsistency = groundedEvidenceAvailable
        ? evaluateTemporalValidityConsistency({
            ...context,
            draftAnswer,
        })
        : {
            passed: true,
            applicable: false,
            qualificationSource: 'not_required' as const,
            conflict: null,
        };
    const ragAnswerCompleteness = groundedEvidenceAvailable
        ? evaluateRagAnswerCompleteness({
            ...context,
            draftAnswer,
        })
        : {
            passed: true,
            applicable: false,
            requiredRoles: [],
            missingRoles: [],
            requiredProfileSignals: [],
            missingProfileSignals: [],
        };
    const ragClaimCitationSupport = groundedEvidenceAvailable
        ? evaluateRagClaimCitationSupport({
            ...context,
            draftAnswer,
        })
        : {
            passed: true,
            applicable: false,
            supportedClaimCount: 0,
            weakClaims: [],
            unsupportedClaims: [],
            citationBackedFragmentCount: 0,
        };
    const graphAnswerPlanCoverage: GraphAnswerCoverageReview = groundedEvidenceAvailable
        ? reviewGraphAnswerCoverage(draftAnswer, context.graphAnswerPlan)
        : reviewGraphAnswerCoverage('', null);
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
        structuredComparisonConsistency.passed,
        attributeConsistency.passed,
        containmentConsistency.passed,
        compositionConsistency.passed,
        purposeConsistency.passed,
        dependencyConsistency.passed,
        locationConsistency.passed,
        subjectConsistency.passed,
        stateConsistency.passed,
        polarityConsistency.passed,
        graphCausalConsistency.passed,
        graphOrderConsistency.passed,
        graphComparisonConsistency.passed,
        temporalValidityConsistency.passed,
        ragAnswerCompleteness.passed,
        ragClaimCitationSupport.passed,
        graphAnswerPlanCoverage.passed,
        leakedInternalFragments,
        publicSurfaceContracted
    );
    const primaryGraphCausalConflict = graphCausalConsistency.conflicts[0];
    const primaryGraphOrderConflict = graphOrderConsistency.conflicts[0];
    const primaryGraphComparisonConflict = graphComparisonConsistency.conflicts[0];
    const primaryStructuredComparisonConflict = structuredComparisonConsistency.conflicts[0];
    const primaryTemporalValidityConflict = temporalValidityConsistency.conflict;
    const revisedPublicAnswer = normalizeWhitespace(
        decision === 'abstain'
            ? buildAbstentionAnswer(context.message, context.usedScope)
            : decision === 'revise'
                ? (
                    primaryTemporalValidityConflict
                        ? buildTemporalValidityRevisionAnswer(context, primaryTemporalValidityConflict)
                    : primaryGraphCausalConflict
                        ? buildGraphCausalRevisionAnswer(context, primaryGraphCausalConflict)
                        : primaryGraphOrderConflict
                        ? buildGraphOrderRevisionAnswer(context, primaryGraphOrderConflict)
                        : primaryGraphComparisonConflict
                        ? buildGraphComparisonRevisionAnswer(context, primaryGraphComparisonConflict)
                        : primaryStructuredComparisonConflict
                        ? buildStructuredComparisonRevisionAnswer(context, primaryStructuredComparisonConflict)
                        : (!queryIntentAlignment.passed && queryIntentAlignment.supportFrame)
                            ? buildDefinitionIntentRevisionAnswer(context, queryIntentAlignment.supportFrame)
                        : buildGroundedRevisionAnswer(context)
                )
                : buildReleasedPublicAnswer(context, draftAnswer)
    );
    const publicAnswer = preservePlannedGraphAnswerClaims(
        revisedPublicAnswer,
        context.graphAnswerPlan,
        Boolean(context.ragContextPack && context.ragContextPack.fragments && context.ragContextPack.fragments.length > 0)
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
            gateId: 'claim_structured_comparison_consistency',
            passed: structuredComparisonConsistency.passed,
            message: groundedEvidenceAvailable
                ? (
                    structuredComparisonConsistency.comparableFrameCount > 0
                        ? buildStructuredComparisonConflictMessage(structuredComparisonConsistency.conflicts)
                        : 'No comparable structured comparison was available, so comparative contradiction checking stayed conservative.'
                )
                : 'No evidence was available, so structured comparison contradiction checking was not evaluated.',
        },
        {
            gateId: 'claim_attribute_consistency',
            passed: attributeConsistency.passed,
            message: groundedEvidenceAvailable
                ? (
                    attributeConsistency.comparableFrameCount > 0
                        ? buildAttributeConflictMessage(attributeConsistency.conflicts)
                        : 'No comparable attribute frame was available, so same-subject attribute contradiction checking stayed conservative.'
                )
                : 'No evidence was available, so attribute contradiction checking was not evaluated.',
        },
        {
            gateId: 'claim_containment_consistency',
            passed: containmentConsistency.passed,
            message: groundedEvidenceAvailable
                ? (
                    containmentConsistency.comparableFrameCount > 0
                        ? buildContainmentConflictMessage(containmentConsistency.conflicts)
                        : 'No comparable containment relation was available, so containment contradiction checking stayed conservative.'
                )
                : 'No evidence was available, so containment contradiction checking was not evaluated.',
        },
        {
            gateId: 'claim_composition_consistency',
            passed: compositionConsistency.passed,
            message: groundedEvidenceAvailable
                ? (
                    compositionConsistency.comparableFrameCount > 0
                        ? buildCompositionConflictMessage(compositionConsistency.conflicts)
                        : 'No comparable composition frame was available, so composition contradiction checking stayed conservative.'
                )
                : 'No evidence was available, so composition contradiction checking was not evaluated.',
        },
        {
            gateId: 'claim_purpose_consistency',
            passed: purposeConsistency.passed,
            message: groundedEvidenceAvailable
                ? (
                    purposeConsistency.comparableFrameCount > 0
                        ? buildPurposeConflictMessage(purposeConsistency.conflicts)
                        : 'No comparable purpose frame was available, so purpose contradiction checking stayed conservative.'
                )
                : 'No evidence was available, so purpose contradiction checking was not evaluated.',
        },
        {
            gateId: 'claim_dependency_consistency',
            passed: dependencyConsistency.passed,
            message: groundedEvidenceAvailable
                ? (
                    dependencyConsistency.comparableFrameCount > 0
                        ? buildDependencyConflictMessage(dependencyConsistency.conflicts)
                        : 'No comparable dependency frame was available, so dependency contradiction checking stayed conservative.'
                )
                : 'No evidence was available, so dependency contradiction checking was not evaluated.',
        },
        {
            gateId: 'claim_location_consistency',
            passed: locationConsistency.passed,
            message: groundedEvidenceAvailable
                ? (
                    locationConsistency.comparableFrameCount > 0
                        ? buildLocationConflictMessage(locationConsistency.conflicts)
                        : 'No comparable location frame was available, so location contradiction checking stayed conservative.'
                )
                : 'No evidence was available, so location contradiction checking was not evaluated.',
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
            gateId: 'claim_graph_causal_consistency',
            passed: graphCausalConsistency.passed,
            message: groundedEvidenceAvailable
                ? (
                    graphCausalConsistency.comparableClaimCount > 0
                        ? buildGraphCausalConflictMessage(graphCausalConsistency.conflicts)
                        : 'No explicit causal claim was present in the draft answer, so DAG-causal checking stayed conservative.'
                )
                : 'No evidence was available, so graph-causal contradiction checking was not evaluated.',
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
            gateId: 'claim_graph_comparison_consistency',
            passed: graphComparisonConsistency.passed,
            message: groundedEvidenceAvailable
                ? (
                    graphComparisonConsistency.comparableClaimCount > 0
                        ? buildGraphComparisonConflictMessage(graphComparisonConsistency.conflicts)
                        : 'No explicit graph-comparison claim was present in the draft answer, so DAG-comparison checking stayed conservative.'
                )
                : 'No evidence was available, so graph-comparison contradiction checking was not evaluated.',
        },
        {
            gateId: 'claim_temporal_validity_consistency',
            passed: temporalValidityConsistency.passed,
            message: groundedEvidenceAvailable
                ? buildTemporalValidityConflictMessage(temporalValidityConsistency)
                : 'No evidence was available, so temporal-validity release checking was not evaluated.',
        },
        {
            gateId: 'rag_answer_completeness',
            passed: ragAnswerCompleteness.passed,
            message: buildRagAnswerCompletenessMessage(ragAnswerCompleteness),
        },
        {
            gateId: 'rag_claim_citation_support',
            passed: ragClaimCitationSupport.passed,
            message: buildRagClaimCitationSupportMessage(ragClaimCitationSupport),
        },
        {
            gateId: 'graph_answer_plan_coverage',
            passed: graphAnswerPlanCoverage.passed,
            message: !graphAnswerPlanCoverage.applicable
                ? 'No required graph-answer claims were active for this answer.'
                : graphAnswerPlanCoverage.passed
                    ? `The public draft covered all ${graphAnswerPlanCoverage.requiredClaimIds.length} required graph-answer claim(s).`
                    : `The public draft omitted required graph-answer claims: ${graphAnswerPlanCoverage.missingRequiredClaimIds.join(', ')}.`,
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
