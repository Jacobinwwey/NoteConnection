import type {
    GraphAnswerPlan,
    EvidenceSpan,
    KnowledgeQueryItem,
    RagContextBudget,
    RagContextPack,
    RagEvidenceFragment,
    RagEvidenceRole,
    RagSourceDecision,
} from './types';
import { buildRagContextPack, estimateRagTokenCount } from './ragContextPack';
import { conditionRagFragmentsByGraphPlan } from './graphConditionedContext';
import type { AgentConversationExecution } from './agentConversationExecution';
import { iterateRagEvidenceClauses } from './ragEvidenceQuality';

export interface RagEvidenceSourceLookup {
    documentId: string;
    sourcePath: string;
    atomIds: string[];
    citationIds: string[];
}

export interface RagEvidenceSourceDocument {
    unavailableReason?: string;
    documentId: string;
    sourcePath: string;
    content: string;
    sourceHash?: string;
    updatedAt?: string;
}

export type RagEvidenceSourceResolver = (
    lookup: RagEvidenceSourceLookup
) => RagEvidenceSourceDocument | null | Promise<RagEvidenceSourceDocument | null>;

export interface AssembleRagEvidenceContextParams {
    execution?: AgentConversationExecution;
    query: string;
    items: KnowledgeQueryItem[];
    graphNeighborItems?: KnowledgeQueryItem[];
    sourceResolver?: RagEvidenceSourceResolver;
    budget?: Partial<RagContextBudget>;
    paragraphWindow?: number;
    generatedAt?: string;
    graphAnswerPlan?: GraphAnswerPlan;
}

type SourceBlockKind = 'heading' | 'paragraph' | 'code' | 'table';

interface SourceLine {
    lineNumber: number;
    text: string;
    startOffset: number;
    endOffset: number;
}

interface SourceBlock {
    kind: SourceBlockKind;
    text: string;
    startOffset: number;
    endOffset: number;
    startLine: number;
    endLine: number;
    headingPath: string[];
}

interface DocumentEvidenceGroup {
    documentId: string;
    sourcePath: string;
    entries: DocumentEvidenceEntry[];
}

interface DocumentEvidenceEntry {
    item: KnowledgeQueryItem;
    directRole: 'direct_support' | 'graph_neighbor_support';
    expandDocumentContext: boolean;
}

interface ParentFragmentDraft {
    key: string;
    role: Extract<RagEvidenceRole, 'parent_context' | 'graph_neighbor_support'>;
    item: KnowledgeQueryItem;
    documentId: string;
    sourcePath: string;
    headingPath: string[];
    blocks: SourceBlock[];
    citationIds: Set<string>;
    relationEdgeIds: Set<string>;
    score: number;
}

type ComparableEvidenceFact = {
    subjectKey: string;
    subjectLabel: string;
    valueKey: string;
    valueLabel: string;
    block: SourceBlock;
    citationIds: string[];
    item: KnowledgeQueryItem;
} & ({
    factKind: 'measurement';
    measurement: {
        dimension: string;
        magnitude: number;
        relation: 'equal' | 'not_equal';
    };
} | {
    factKind: 'quantity' | 'date' | 'state' | 'location' | 'identity' | 'endpoint' | 'dependency' | 'format' | 'protocol' | 'version' | 'port' | 'status_code';
});

type ComparableTemporalScopeKey = 'current' | 'historical' | 'planned';
type ComparableFactScopeKey =
    | `temporal:${ComparableTemporalScopeKey}`
    | `environment:${string}`
    | `version:${string}`
    | `platform:${string}`
    | `time:${string}`;

const DEFAULT_PARAGRAPH_WINDOW = 5;
const MAX_GRAPH_NEIGHBOR_DOCUMENT_CONTEXT_FRAGMENTS = 2;
const COMPARABLE_QUANTITY_FACT_PATTERN = /\b(?:the\s+)?([a-z][a-z0-9 -]{2,80}?(?:count|limit|threshold|budget|quota|capacity|size|window|attempts|retries))\s+(?:is|are|=|:)\s*(-?\d+(?:\.\d+)?)\b/gi;
const COMPARABLE_DATE_FACT_PATTERN = /\b(?:the\s+)?([a-z][a-z0-9 -]{2,80}?(?:date|year|deadline|cutoff|cut-off|version|release|revision|effective))\s+(?:is|=|:)\s*(\d{4}(?:-\d{2}-\d{2})?)\b/gi;
const COMPARABLE_STATE_FACT_PATTERN = /\b(?:the\s+)?([a-z][a-z0-9 -]{2,80}?(?:status|state|mode|flag|policy|availability|setting|gate|switch))\s+(?:is|=|:)\s*(enabled|disabled|active|inactive|available|unavailable|supported|unsupported|allowed|blocked|required|optional|open|closed|on|off)\b/gi;
const COMPARABLE_LOCATION_FACT_PATTERN = /\b(?:the\s+)?([a-z][a-z0-9 -]{2,80}?(?:location|site|region|zone|room|rack|slot|bay))\s+(?:is|=|:)\s*([a-z0-9][a-z0-9 /_.-]{1,80}?)(?=\.|,|;|\n|$)/gi;
const COMPARABLE_IDENTITY_FACT_PATTERN = /\b(?:the\s+)?([a-z][a-z0-9 -]{2,80}?(?:owner|assignee|contact|maintainer|team|group))\s+(?:is|=|:)\s*([a-z][a-z0-9 &/_.-]{1,80}?)(?=\s+(?:in|for|on|under|within)\s+|\.|,|;|\n|$)/gi;
const COMPARABLE_ENDPOINT_FACT_PATTERN = /\b(?:the\s+)?([a-z][a-z0-9 -]{2,80}?(?:endpoint|url|uri|route))\s+(?:is|=|:)\s*((?:https?:\/\/|\/|[a-z0-9][a-z0-9._-]*\/)[a-z0-9/?#&=._~:%+\-/]*?[a-z0-9/#&=_~:%+\-/])(?=\s+(?:in|for|on|under|within)\s+|\.|,|;|\n|$)/gi;
const COMPARABLE_DEPENDENCY_FACT_PATTERN = /\b(?:the\s+)?([a-z][a-z0-9 -]{2,80}?(?:dependency|package|provider|driver|runtime|library|module|plugin|adapter))\s+(?:is|are|=|:)\s*((?:@[a-z0-9._-]+\/)?[a-z0-9][a-z0-9+.#/_@ -]{0,79}?)(?=\s+(?:in|for|on|under|within)\s+|\.|,|;|\n|$)/gi;
const COMPARABLE_FORMAT_FACT_PATTERN = /\b(?:the\s+)?([a-z][a-z0-9 -]{2,80}?(?:format|schema|encoding|serialization|content type|mime type))\s+(?:is|are|=|:)\s*([a-z0-9][a-z0-9+.#/_ -]{0,79}?)(?=\s+(?:in|for|on|under|within)\s+|\.|,|;|\n|$)/gi;
const COMPARABLE_PROTOCOL_FACT_PATTERN = /\b(?:the\s+)?([a-z][a-z0-9 -]{2,80}?(?:protocol|transport protocol|wire protocol))\s+(?:is|are|=|:)\s*([a-z0-9][a-z0-9+.#/_ -]{0,79}?)(?=\s+(?:in|for|on|under|within)\s+|\.|,|;|\n|$)/gi;
const COMPARABLE_VERSION_FACT_PATTERN = /\b(?:the\s+)?([a-z][a-z0-9 -]{2,80}?(?:version|revision))\s+(?:is|are|=|:)\s*((?:v\s*)?\d+(?:\.\d+){1,4}(?:[-+._][a-z0-9]+)?|v\s*\d+(?:[-+._][a-z0-9]+)?)(?=\s+(?:in|for|on|under|within)\s+|\.|,|;|\n|$)/gi;
const COMPARABLE_PORT_FACT_PATTERN = /\b(?:the\s+)?([a-z][a-z0-9 -]{2,80}?(?:port|listener port|service port))\s+(?:is|are|=|:)\s*(\d{1,5})(?=\s+(?:in|for|on|under|within)\s+|\.|,|;|\n|$)/gi;
const COMPARABLE_STATUS_CODE_FACT_PATTERN = /\b(?:the\s+)?([a-z][a-z0-9 -]{2,80}?(?:http status code|response status code|status code))\s+(?:is|are|=|:)\s*(\d{3})(?=\s+(?:in|for|on|under|within)\s+|\.|,|;|\n|$)/gi;
const COMPARABLE_STATE_VALUE_GROUPS: Record<string, string> = {
    enabled: 'enabled_disabled',
    disabled: 'enabled_disabled',
    active: 'active_inactive',
    inactive: 'active_inactive',
    available: 'available_unavailable',
    unavailable: 'available_unavailable',
    supported: 'supported_unsupported',
    unsupported: 'supported_unsupported',
    allowed: 'allowed_blocked',
    blocked: 'allowed_blocked',
    required: 'required_optional',
    optional: 'required_optional',
    open: 'open_closed',
    closed: 'open_closed',
    on: 'on_off',
    off: 'on_off',
};
const COMPARABLE_TEMPORAL_SCOPE_GROUPS: Record<string, ComparableTemporalScopeKey> = {
    current: 'current',
    active: 'current',
    present: 'current',
    latest: 'current',
    historical: 'historical',
    historic: 'historical',
    legacy: 'historical',
    previous: 'historical',
    archived: 'historical',
    deprecated: 'historical',
    superseded: 'historical',
    planned: 'planned',
    future: 'planned',
    upcoming: 'planned',
    scheduled: 'planned',
};
const COMPARABLE_TEMPORAL_SCOPE_PATTERN = /\b(current|active|present|latest|historical|historic|legacy|previous|archived|deprecated|superseded|planned|future|upcoming|scheduled)\b/i;
const COMPARABLE_ENVIRONMENT_SCOPE_ALIASES: Record<string, string> = {
    production: 'production',
    prod: 'production',
    staging: 'staging',
    stage: 'staging',
    development: 'development',
    dev: 'development',
    test: 'test',
    testing: 'test',
    qa: 'qa',
    uat: 'uat',
    sandbox: 'sandbox',
    local: 'local',
    preview: 'preview',
    canary: 'canary',
};
const COMPARABLE_ENVIRONMENT_SCOPE_PATTERN = /\b(?:in|for|on|under|within)\s+(?:the\s+)?(production|prod|staging|stage|development|dev|test|testing|qa|uat|sandbox|local|preview|canary)(?:\s+(?:environment|env|deployment|cluster|workspace|tenant|runtime))?\b|\b(production|staging|development|test|testing|qa|uat|sandbox|local|preview|canary)\s+(?:environment|env|deployment|cluster|workspace|tenant|runtime)\b/i;
const COMPARABLE_VERSION_SCOPE_PATTERN = /\b(?:in|for|on|under|within)\s+(?:the\s+)?(?:version|ver\.?|v)\s*([0-9]+(?:\.[0-9]+){0,3}(?:[-+._][a-z0-9]+)?)\b|\b(?:version|ver\.?|v)\s*([0-9]+(?:\.[0-9]+){0,3}(?:[-+._][a-z0-9]+)?)\b/i;
const COMPARABLE_PLATFORM_SCOPE_ALIASES: Record<string, string> = {
    windows: 'windows',
    win32: 'windows',
    macos: 'macos',
    mac: 'macos',
    linux: 'linux',
    android: 'android',
    ios: 'ios',
    web: 'web',
    desktop: 'desktop',
    mobile: 'mobile',
};
const COMPARABLE_PLATFORM_SCOPE_PATTERN = /\b(?:in|for|on|under|within)\s+(?:the\s+)?(windows|win32|macos|mac|linux|android|ios|web|desktop|mobile)(?:\s+(?:platform|os|runtime|client|app|build|target))?\b|\b(windows|win32|macos|mac|linux|android|ios|web|desktop|mobile)\s+(?:platform|os|runtime|client|app|build|target)\b/i;
const COMPARABLE_TIME_SCOPE_PATTERN = /\b(?:in|during|on|as of)\s+(\d{4}(?:-\d{2}(?:-\d{2})?)?)\b/i;

const MEASUREMENT_UNIT_GROUPS: Array<{ aliases: string[]; dimension: string; scale: number; offset?: number }> = [
    { aliases: ['B', 'byte', 'bytes', '字节'], dimension: 'information', scale: 1 },
    { aliases: ['b', 'bit', 'bits', '比特'], dimension: 'information', scale: 1 / 8 },
    { aliases: ['kB', 'kilobyte', 'kilobytes'], dimension: 'information', scale: 1000 },
    { aliases: ['MB', 'megabyte', 'megabytes', '兆字节'], dimension: 'information', scale: 1e6 },
    { aliases: ['Mb', 'megabit', 'megabits'], dimension: 'information', scale: 1e6 / 8 },
    { aliases: ['GB', 'gigabyte', 'gigabytes'], dimension: 'information', scale: 1e9 },
    { aliases: ['KiB', 'kibibyte', 'kibibytes'], dimension: 'information', scale: 1024 },
    { aliases: ['MiB', 'mebibyte', 'mebibytes'], dimension: 'information', scale: 1024 ** 2 },
    { aliases: ['GiB', 'gibibyte', 'gibibytes'], dimension: 'information', scale: 1024 ** 3 },
    { aliases: ['m', 'meter', 'meters', 'metre', 'metres', '米'], dimension: 'length', scale: 1 },
    { aliases: ['cm', '厘米'], dimension: 'length', scale: 1e-2 },
    { aliases: ['mm', '毫米'], dimension: 'length', scale: 1e-3 },
    { aliases: ['um', 'µm', 'μm', '微米'], dimension: 'length', scale: 1e-6 },
    { aliases: ['nm', '纳米'], dimension: 'length', scale: 1e-9 },
    { aliases: ['kg', '千克', '公斤'], dimension: 'mass', scale: 1 },
    { aliases: ['g', 'gram', 'grams', '克'], dimension: 'mass', scale: 1e-3 },
    { aliases: ['mg', '毫克'], dimension: 'mass', scale: 1e-6 },
    { aliases: ['s', 'second', 'seconds', '秒'], dimension: 'duration', scale: 1 },
    { aliases: ['ms', 'millisecond', 'milliseconds', '毫秒'], dimension: 'duration', scale: 1e-3 },
    { aliases: ['us', 'µs', 'μs', '微秒'], dimension: 'duration', scale: 1e-6 },
    { aliases: ['min', 'minute', 'minutes', '分钟'], dimension: 'duration', scale: 60 },
    { aliases: ['h', 'hour', 'hours', '小时'], dimension: 'duration', scale: 3600 },
    { aliases: ['d', 'day', 'days', '天', '日'], dimension: 'duration', scale: 86400 },
    { aliases: ['Hz', 'hz', 'hertz', '赫兹'], dimension: 'frequency', scale: 1 },
    { aliases: ['kHz', 'khz', '千赫兹'], dimension: 'frequency', scale: 1000 },
    { aliases: ['K', 'kelvin', '开尔文'], dimension: 'temperature', scale: 1 },
    { aliases: ['C', 'c', '°C', '°c', '℃', '摄氏度'], dimension: 'temperature', scale: 1, offset: 273.15 },
    { aliases: ['deg', 'degree', 'degrees', '度'], dimension: 'angle', scale: Math.PI / 180 },
    { aliases: ['rad', 'radian', 'radians', '弧度'], dimension: 'angle', scale: 1 },
    { aliases: ['%'], dimension: 'ratio', scale: 0.01 },
];
const MEASUREMENT_UNITS = new Map(MEASUREMENT_UNIT_GROUPS.flatMap(group => group.aliases.map(alias => [alias, group] as const)));
const MEASUREMENT_UNIT_PATTERN = Array.from(MEASUREMENT_UNITS.keys()).sort((left, right) => right.length - left.length).join('|');
const MEASUREMENT_NUMBER_PATTERN = /[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?/i;
const MEASUREMENT_PREFIX_PATTERNS = [
    /(?<![\p{L}\p{N}])([\p{L}][\p{L}\p{N} _-]{1,100}?)(?:\s+(?:is|are)\s+|\s*[:=]\s*)(not\s+)?/u,
    /(?<![\p{L}\p{N}])([\p{L}][\p{L}\p{N} _-]{1,100}?)\s*(?:(并不是|不是|不为|不等于|并非)|是|为|等于|：)\s*/u,
];
const MEASUREMENT_FACT_PATTERNS = MEASUREMENT_PREFIX_PATTERNS.map(prefix => new RegExp(
    prefix.source + /(?:(?:\+\s*\/\s*-|±)\s*)?/.source + '(' + MEASUREMENT_NUMBER_PATTERN.source + ')' + /\s*/.source
    + '(' + MEASUREMENT_UNIT_PATTERN + ')' + /(?![a-z0-9_])/.source,
    'giu'
));
const MEASUREMENT_UNIT_SUFFIX_PATTERN = new RegExp('^\\s*(?:' + MEASUREMENT_UNIT_PATTERN + ')(?![a-z0-9_])', 'iu');

const CHINESE_SCOPE_TERMS: Record<string, string> = {
    当前: ' current ', 目前: ' current ', 现行: ' current ', 历史: ' historical ', 旧版: ' historical ',
    计划: ' planned ', 未来: ' planned ', 生产环境: ' production environment ', 测试环境: ' test environment ',
    开发环境: ' development environment ', 预发环境: ' staging environment ', 预生产环境: ' staging environment ',
    版本: ' version ', 安卓平台: ' android platform ', 桌面平台: ' desktop platform ', 移动平台: ' mobile platform ',
};
const CHINESE_SCOPE_PATTERN = new RegExp(Object.keys(CHINESE_SCOPE_TERMS).sort((a, b) => b.length - a.length).join('|'), 'gu');

function normalizeScopeLanguage(value: string): string {
    return value.replace(CHINESE_SCOPE_PATTERN, term => CHINESE_SCOPE_TERMS[term])
        .replace(/(\d{4})年(?:(\d{1,2})月)?(?:(\d{1,2})日)?/gu, (_match, year: string, month?: string, day?: string) => (
            ` in ${year}${month ? `-${month.padStart(2, '0')}` : ''}${day ? `-${day.padStart(2, '0')}` : ''} `
        ));
}

function normalizeWhitespace(value: string): string {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function finishEvidenceFragment(fragment: RagEvidenceFragment, execution?: AgentConversationExecution): RagEvidenceFragment {
    if (!execution) return fragment;
    execution.recordFragment();
    if (fragment.text.length <= execution.maxFragmentChars) return fragment;
    const text = fragment.text.slice(0, execution.maxFragmentChars);
    return {
        ...fragment, text, charCount: text.length, tokenEstimate: estimateRagTokenCount(text),
        truncated: true, truncationReason: 'runtime_fragment_chars_limit',
    };
}

function sanitizeFragmentPart(value: string): string {
    return normalizeWhitespace(value)
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 80) || 'fragment';
}

function splitSourceLines(content: string, execution?: AgentConversationExecution): SourceLine[] {
    const normalizedContent = String(content || '');
    if (!normalizedContent) {
        return [];
    }
    const records: SourceLine[] = [];
    const newline = /\r\n|\n|\r/g;
    let cursor = 0;
    let delimiter: RegExpExecArray | null;
    while ((delimiter = newline.exec(normalizedContent)) !== null) {
        execution?.checkSourceLineCount(records.length + 1);
        records.push({
            lineNumber: records.length + 1,
            text: normalizedContent.slice(cursor, delimiter.index),
            startOffset: cursor,
            endOffset: delimiter.index,
        });
        cursor = delimiter.index + delimiter[0].length;
    }
    execution?.checkSourceLineCount(records.length + 1);
    records.push({ lineNumber: records.length + 1, text: normalizedContent.slice(cursor), startOffset: cursor, endOffset: normalizedContent.length });
    return records;
}

function isTableLine(text: string): boolean {
    const trimmed = String(text || '').trim();
    return trimmed.startsWith('|') && trimmed.endsWith('|');
}

function parseMarkdownBlocks(content: string, execution?: AgentConversationExecution): SourceBlock[] {
    const sourceLines = splitSourceLines(content, execution);
    const blocks: SourceBlock[] = [];
    const headingStack: Array<{ level: number; title: string }> = [];
    let pendingLines: SourceLine[] = [];
    let pendingKind: SourceBlockKind = 'paragraph';
    let pendingHeadingPath: string[] = [];
    let inCodeFence = false;

    const currentHeadingPath = (): string[] => headingStack.map((heading) => heading.title);
    const flushPending = (): void => {
        if (pendingLines.length <= 0) {
            return;
        }
        const text = pendingLines.map((line) => line.text).join('\n').trim();
        if (text) {
            const first = pendingLines[0];
            const last = pendingLines[pendingLines.length - 1];
            blocks.push({
                kind: pendingKind,
                text,
                startOffset: first.startOffset,
                endOffset: last.endOffset,
                startLine: first.lineNumber,
                endLine: last.lineNumber,
                headingPath: [...pendingHeadingPath],
            });
        }
        pendingLines = [];
        pendingKind = 'paragraph';
        pendingHeadingPath = currentHeadingPath();
    };

    sourceLines.forEach((line) => {
        execution?.assertActive();
        const rawText = String(line.text || '');
        const trimmed = rawText.trim();
        const fenceLine = /^```/.test(trimmed);
        if (fenceLine) {
            if (!inCodeFence) {
                flushPending();
                pendingKind = 'code';
                pendingHeadingPath = currentHeadingPath();
                pendingLines = [line];
                inCodeFence = true;
                return;
            }
            pendingLines.push(line);
            inCodeFence = false;
            flushPending();
            return;
        }
        if (inCodeFence) {
            pendingLines.push(line);
            return;
        }
        if (!trimmed) {
            flushPending();
            return;
        }

        const headingMatch = /^(#{1,6})\s+(.+?)\s*$/.exec(trimmed);
        if (headingMatch) {
            flushPending();
            const level = headingMatch[1].length;
            const title = normalizeWhitespace(headingMatch[2].replace(/#+\s*$/, ''));
            while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
                headingStack.pop();
            }
            headingStack.push({ level, title });
            blocks.push({
                kind: 'heading',
                text: trimmed,
                startOffset: line.startOffset,
                endOffset: line.endOffset,
                startLine: line.lineNumber,
                endLine: line.lineNumber,
                headingPath: currentHeadingPath(),
            });
            pendingHeadingPath = currentHeadingPath();
            return;
        }

        const nextKind: SourceBlockKind = isTableLine(trimmed) ? 'table' : 'paragraph';
        if (pendingLines.length > 0 && pendingKind !== nextKind) {
            flushPending();
        }
        if (pendingLines.length <= 0) {
            pendingKind = nextKind;
            pendingHeadingPath = currentHeadingPath();
        }
        pendingLines.push(line);
    });
    flushPending();
    return blocks;
}

function spanHasUsableOffsets(span: EvidenceSpan, sourceLength: number): boolean {
    return Number.isFinite(span.startOffset)
        && Number.isFinite(span.endOffset)
        && span.startOffset >= 0
        && span.endOffset >= span.startOffset
        && span.startOffset <= sourceLength;
}

function blocksContainSnippet(blocks: SourceBlock[], snippet: string): boolean {
    if (!snippet) {
        return true;
    }
    return normalizeWhitespace(blocks.map((block) => block.text).join(' ')).includes(snippet);
}

function blocksForEvidence(blocks: SourceBlock[], span: EvidenceSpan, content: string): SourceBlock[] {
    const snippet = normalizeWhitespace(span.snippet);
    const lineMatches = Number.isFinite(span.startLine) && Number.isFinite(span.endLine) && span.startLine > 0
        ? blocks.filter((block) => block.endLine >= span.startLine && block.startLine <= span.endLine)
        : [];
    if (spanHasUsableOffsets(span, content.length)) {
        const endOffset = Math.min(span.endOffset, content.length);
        const matches = blocks.filter((block) => block.endOffset >= span.startOffset && block.startOffset <= endOffset);
        if (matches.length > 0) {
            if (!blocksContainSnippet(matches, snippet) && blocksContainSnippet(lineMatches, snippet)) {
                return lineMatches;
            }
            return matches;
        }
    }
    if (lineMatches.length > 0) {
        return lineMatches;
    }
    if (snippet) {
        const normalizedBlocks = blocks.filter((block) => normalizeWhitespace(block.text).includes(snippet));
        if (normalizedBlocks.length > 0) {
            return normalizedBlocks;
        }
    }
    return [];
}

function sameHeadingPath(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((part, index) => part === b[index]);
}

function buildSectionBlocks(blocks: SourceBlock[], evidenceBlocks: SourceBlock[], paragraphWindow: number): SourceBlock[] {
    if (evidenceBlocks.length <= 0) {
        return [];
    }
    const headingPath = evidenceBlocks[0].headingPath;
    if (headingPath.length > 0) {
        const sectionBlocks = blocks.filter((block) => sameHeadingPath(block.headingPath, headingPath));
        if (sectionBlocks.length > 0) {
            return sectionBlocks;
        }
    }
    const firstIndex = blocks.indexOf(evidenceBlocks[0]);
    const lastIndex = blocks.indexOf(evidenceBlocks[evidenceBlocks.length - 1]);
    if (firstIndex < 0 || lastIndex < 0) {
        return evidenceBlocks;
    }
    const start = Math.max(0, firstIndex - paragraphWindow);
    const end = Math.min(blocks.length - 1, lastIndex + paragraphWindow);
    return blocks.slice(start, end + 1);
}

function sourceBlockKey(block: SourceBlock): string {
    return `${block.startOffset}:${block.endOffset}:${block.text}`;
}

function mergeBlocks(blocks: SourceBlock[]): SourceBlock[] {
    const seen = new Set<string>();
    const merged: SourceBlock[] = [];
    blocks.forEach((block) => {
        const key = sourceBlockKey(block);
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        merged.push(block);
    });
    return merged.sort((a, b) => a.startOffset - b.startOffset);
}

function fragmentTextFromBlocks(blocks: SourceBlock[]): string {
    return mergeBlocks(blocks)
        .map((block) => block.text)
        .filter(Boolean)
        .join('\n\n')
        .trim();
}

function normalizeComparableFactSubject(value: string): string {
    return normalizeWhitespace(value)
        .toLowerCase()
        .replace(/^(the|a|an)\s+/i, '')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
}

function comparableFactSentenceTail(blockText: string, match: RegExpMatchArray): string {
    const matchIndex = typeof match.index === 'number' ? match.index : -1;
    if (matchIndex < 0) {
        return '';
    }
    const tail = String(blockText || '').slice(matchIndex + String(match[0] || '').length);
    const boundary = /[!?。！？；;\r\n]|\.(?!\d)/u.exec(tail);
    return normalizeWhitespace(boundary ? tail.slice(0, boundary.index) : tail);
}

function comparableFactTemporalScopeKey(subjectLabel: string, sentenceTail: string): ComparableTemporalScopeKey | null {
    const scopedText = `${normalizeWhitespace(subjectLabel)} ${normalizeWhitespace(sentenceTail)}`;
    const match = COMPARABLE_TEMPORAL_SCOPE_PATTERN.exec(scopedText);
    if (!match) {
        return null;
    }
    return COMPARABLE_TEMPORAL_SCOPE_GROUPS[String(match[1] || '').toLowerCase()] || null;
}

function comparableFactEnvironmentScopeKey(subjectLabel: string, sentenceTail: string): string | null {
    const scopedText = `${normalizeWhitespace(subjectLabel)} ${normalizeWhitespace(sentenceTail)}`;
    const match = COMPARABLE_ENVIRONMENT_SCOPE_PATTERN.exec(scopedText);
    if (!match) {
        return null;
    }
    const environmentLabel = String(match[1] || match[2] || '').toLowerCase();
    return COMPARABLE_ENVIRONMENT_SCOPE_ALIASES[environmentLabel] || null;
}

function comparableFactVersionScopeKey(subjectLabel: string, sentenceTail: string): string | null {
    const scopedText = `${normalizeWhitespace(subjectLabel)} ${normalizeWhitespace(sentenceTail)}`;
    const match = COMPARABLE_VERSION_SCOPE_PATTERN.exec(scopedText);
    if (!match) {
        return null;
    }
    const versionLabel = normalizeWhitespace(match[1] || match[2] || '').toLowerCase();
    if (!/^[0-9]+(?:\.[0-9]+){0,3}(?:[-+._][a-z0-9]+)?$/.test(versionLabel)) {
        return null;
    }
    return versionLabel;
}

function comparableFactPlatformScopeKey(subjectLabel: string, sentenceTail: string): string | null {
    const scopedText = `${normalizeWhitespace(subjectLabel)} ${normalizeWhitespace(sentenceTail)}`;
    const match = COMPARABLE_PLATFORM_SCOPE_PATTERN.exec(scopedText);
    if (!match) {
        return null;
    }
    const platformLabel = String(match[1] || match[2] || '').toLowerCase();
    return COMPARABLE_PLATFORM_SCOPE_ALIASES[platformLabel] || null;
}

function comparableFactScopeKeys(subjectLabel: string, sentenceTail: string): ComparableFactScopeKey[] {
    subjectLabel = normalizeScopeLanguage(subjectLabel);
    sentenceTail = normalizeScopeLanguage(sentenceTail);
    const scopeKeys: ComparableFactScopeKey[] = [];
    const temporalScopeKey = comparableFactTemporalScopeKey(subjectLabel, sentenceTail);
    if (temporalScopeKey) {
        scopeKeys.push(`temporal:${temporalScopeKey}`);
    }
    const environmentScopeKey = comparableFactEnvironmentScopeKey(subjectLabel, sentenceTail);
    if (environmentScopeKey) {
        scopeKeys.push(`environment:${environmentScopeKey}`);
    }
    const versionScopeKey = comparableFactVersionScopeKey(subjectLabel, sentenceTail);
    if (versionScopeKey) {
        scopeKeys.push(`version:${versionScopeKey}`);
    }
    const platformScopeKey = comparableFactPlatformScopeKey(subjectLabel, sentenceTail);
    if (platformScopeKey) {
        scopeKeys.push(`platform:${platformScopeKey}`);
    }
    const timeScope = COMPARABLE_TIME_SCOPE_PATTERN.exec(`${subjectLabel} ${sentenceTail}`)?.[1];
    if (timeScope) scopeKeys.push(`time:${timeScope}`);
    return scopeKeys.sort();
}

function comparableFactSubjectKey(subjectLabel: string, scopeKeys: ComparableFactScopeKey[]): string {
    subjectLabel = normalizeScopeLanguage(subjectLabel);
    const scopedSubjectLabel = scopeKeys.some((scopeKey) => scopeKey.startsWith('temporal:'))
        ? normalizeWhitespace(subjectLabel).replace(COMPARABLE_TEMPORAL_SCOPE_PATTERN, '')
        : subjectLabel;
    const subjectKey = normalizeComparableFactSubject(scopedSubjectLabel
        .replace(COMPARABLE_ENVIRONMENT_SCOPE_PATTERN, '')
        .replace(COMPARABLE_PLATFORM_SCOPE_PATTERN, '')
        .replace(COMPARABLE_VERSION_SCOPE_PATTERN, '')
        .replace(COMPARABLE_TIME_SCOPE_PATTERN, ''));
    return scopeKeys.length > 0 && subjectKey
        ? `${subjectKey}@scope:${scopeKeys.join('+')}`
        : subjectKey;
}

function measurementScopeKeys(text: string): ComparableFactScopeKey[] | null {
    const normalized = normalizeScopeLanguage(text);
    const keys = new Set<ComparableFactScopeKey>();
    for (const pattern of [COMPARABLE_TEMPORAL_SCOPE_PATTERN, COMPARABLE_ENVIRONMENT_SCOPE_PATTERN,
        COMPARABLE_VERSION_SCOPE_PATTERN, COMPARABLE_PLATFORM_SCOPE_PATTERN, COMPARABLE_TIME_SCOPE_PATTERN]) {
        for (const match of normalized.matchAll(new RegExp(pattern.source, 'gi'))) {
            comparableFactScopeKeys('', match[0]).forEach(key => keys.add(key));
        }
    }
    // A coordinated qualifier ("in production or staging") is not a single scope.
    if (Array.from(keys).some(key => key.startsWith('environment:'))) {
        for (const word of normalized.toLowerCase().match(/\b[a-z]+\b/g) || []) {
            const environment = COMPARABLE_ENVIRONMENT_SCOPE_ALIASES[word];
            if (environment) keys.add(`environment:${environment}`);
        }
    }
    if (Array.from(keys).some(key => key.startsWith('platform:'))) {
        for (const word of normalized.toLowerCase().match(/\b[a-z0-9]+\b/g) || []) {
            const platform = COMPARABLE_PLATFORM_SCOPE_ALIASES[word];
            if (platform) keys.add(`platform:${platform}`);
        }
    }
    const dimensions = new Set<string>();
    for (const key of keys) {
        const dimension = key.slice(0, key.indexOf(':'));
        if (dimensions.has(dimension)) return null;
        dimensions.add(dimension);
    }
    return Array.from(keys).sort();
}

function measurementHeadingScopeKeys(headingPath: string[]): ComparableFactScopeKey[] | null {
    const byDimension = new Map<string, ComparableFactScopeKey>();
    for (const heading of headingPath) {
        const keys = measurementScopeKeys(`in ${heading}`);
        if (!keys) return null;
        for (const key of keys) byDimension.set(key.slice(0, key.indexOf(':')), key);
    }
    return Array.from(byDimension.values()).sort();
}

function measurementAssertionScopeKeys(
    headingKeys: ComparableFactScopeKey[],
    paragraphKeys: ComparableFactScopeKey[],
    clauseKeys: ComparableFactScopeKey[]
): ComparableFactScopeKey[] {
    const byDimension = new Map<string, ComparableFactScopeKey>();
    for (const key of [...headingKeys, ...paragraphKeys, ...clauseKeys]) {
        byDimension.set(key.slice(0, key.indexOf(':')), key);
    }
    return Array.from(byDimension.values()).sort();
}

function standaloneMeasurementScopeKeys(clause: string): ComparableFactScopeKey[] | null {
    const normalized = normalizeScopeLanguage(clause).replace(/[.:：。]+$/u, '').trim();
    const keys = measurementScopeKeys(`in ${normalized}`);
    if (!keys?.length) return null;
    const remainder = `in ${normalized}`
        .replace(COMPARABLE_TEMPORAL_SCOPE_PATTERN, '')
        .replace(COMPARABLE_ENVIRONMENT_SCOPE_PATTERN, '')
        .replace(COMPARABLE_VERSION_SCOPE_PATTERN, '')
        .replace(COMPARABLE_PLATFORM_SCOPE_PATTERN, '')
        .replace(COMPARABLE_TIME_SCOPE_PATTERN, '')
        .replace(/\b(?:in|for|on|under|within|during|as of|the)\b/gi, '').trim();
    return remainder ? null : keys;
}

function normalizeComparableDateValue(value: string): string | null {
    const normalized = normalizeWhitespace(value);
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
    if (dateMatch) {
        const year = Number(dateMatch[1]);
        const month = Number(dateMatch[2]);
        const day = Number(dateMatch[3]);
        if (year >= 1000 && year <= 2999 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            return `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
        }
        return null;
    }
    const yearMatch = /^(\d{4})$/.exec(normalized);
    if (yearMatch) {
        const year = Number(yearMatch[1]);
        if (year >= 1000 && year <= 2999) {
            return yearMatch[1];
        }
    }
    return null;
}

function normalizeComparableStateValue(value: string): { valueKey: string; groupKey: string } | null {
    const valueKey = normalizeWhitespace(value).toLowerCase();
    const groupKey = COMPARABLE_STATE_VALUE_GROUPS[valueKey];
    if (!valueKey || !groupKey) {
        return null;
    }
    return { valueKey, groupKey };
}

function normalizeComparableLocationValue(value: string): string {
    return normalizeWhitespace(value)
        .toLowerCase()
        .replace(/^(the|a|an)\s+/i, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function normalizeComparableIdentityValue(value: string): string {
    return normalizeWhitespace(value)
        .toLowerCase()
        .replace(/^(the|a|an)\s+/i, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function normalizeComparableEndpointValue(value: string): string {
    const normalized = normalizeWhitespace(value)
        .toLowerCase()
        .replace(/^['"`]+|['"`]+$/g, '');
    return normalized.length > 1
        ? normalized.replace(/\/+$/g, '')
        : normalized;
}

function normalizeComparableDependencyValue(value: string): string {
    return normalizeWhitespace(value)
        .toLowerCase()
        .replace(/^['"`]+|['"`]+$/g, '')
        .replace(/^(the|a|an)\s+/i, '')
        .replace(/[^a-z0-9+.#/@_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeComparableFormatValue(value: string): string {
    return normalizeWhitespace(value)
        .toLowerCase()
        .replace(/^['"`]+|['"`]+$/g, '')
        .replace(/^(the|a|an)\s+/i, '')
        .replace(/[^a-z0-9+.#/_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeComparableProtocolValue(value: string): string {
    return normalizeWhitespace(value)
        .toLowerCase()
        .replace(/^['"`]+|['"`]+$/g, '')
        .replace(/^(the|a|an)\s+/i, '')
        .replace(/[^a-z0-9+.#/_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeComparableVersionValue(value: string): string {
    return normalizeWhitespace(value)
        .toLowerCase()
        .replace(/^['"`]+|['"`]+$/g, '')
        .replace(/^v\s*/i, '')
        .replace(/\s+/g, '')
        .trim();
}

function normalizeComparablePortValue(value: string): string | null {
    const port = Number(normalizeWhitespace(value));
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return null;
    }
    return String(port);
}

function normalizeComparableStatusCodeValue(value: string): string | null {
    const statusCode = Number(normalizeWhitespace(value));
    if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
        return null;
    }
    return String(statusCode);
}

function extractComparableEvidenceFacts(params: {
    execution?: AgentConversationExecution;
    block: SourceBlock;
    citationIds: string[];
    item: KnowledgeQueryItem;
}): ComparableEvidenceFact[] {
    if (params.block.kind === 'heading' || params.block.kind === 'code') {
        return [];
    }
    const facts: ComparableEvidenceFact[] = [];
    const appendFact = (fact: ComparableEvidenceFact): void => {
        params.execution?.recordSourceFact();
        facts.push(fact);
    };
    const headingKeys = measurementHeadingScopeKeys(params.block.headingPath);
    let paragraphKeys: ComparableFactScopeKey[] = [];
    for (const clause of iterateRagEvidenceClauses(params.block.text)) {
        params.execution?.assertActive();
        const inheritedKeys = paragraphKeys;
        // Only an immediately preceding standalone qualifier is unambiguous.
        paragraphKeys = standaloneMeasurementScopeKeys(clause) || [];
        const clauseKeys = measurementScopeKeys(clause);
        if (!headingKeys || !clauseKeys) continue;
        if (/\b(?:approximately|roughly|about|at least|at most|between|range)\b|大约|约为|至少|至多|范围/iu.test(clause)) continue;
        const scopeKeys = measurementAssertionScopeKeys(headingKeys, inheritedKeys, clauseKeys);
        for (const pattern of MEASUREMENT_FACT_PATTERNS) {
            for (const match of clause.matchAll(pattern)) {
                params.execution?.assertActive();
                const tail = clause.slice(match.index! + match[0].length);
                if (/^\s*(?:[\/^*]|(?:[-–—~～]|to|至|到)\s*[+-]?\d)/iu.test(tail)) continue;
                const subjectLabel = normalizeWhitespace(match[1]);
                const subjectKey = comparableFactSubjectKey(subjectLabel, scopeKeys);
                const tolerance = /(?:\btolerance|公差|容差)$/iu.test(subjectLabel);
                // A named tolerance defines a half-width; an uncertain observation does not define an exact value.
                if (/±|\+\s*\/\s*-/u.test(clause)
                    && (!tolerance || !/±|\+\s*\/\s*-/u.test(match[0]))) continue;
                // SI symbol case is significant: µM is not µm, nor Ms milliseconds.
                const unit = MEASUREMENT_UNITS.get(match[4])
                    || (match[4].length > 2 ? MEASUREMENT_UNITS.get(match[4].toLowerCase()) : undefined);
                if (!subjectKey || !unit) continue;
                const converted = Number(match[3]) * unit.scale + (tolerance ? 0 : (unit.offset || 0));
                if (!Number.isFinite(converted) || (tolerance && converted < 0)) continue;
                // Significant digits remove conversion noise without rounding tiny measurements to zero.
                const magnitude = Number(converted.toPrecision(15));
                const relation = match[2] ? 'not_equal' : 'equal';
                const dimension = tolerance ? `tolerance:${unit.dimension}` : unit.dimension;
                appendFact({
                    subjectKey, subjectLabel,
                    valueKey: `${dimension}:${relation}:${magnitude}`,
                    valueLabel: `${match[2] || ''}${match[3]} ${match[4]}`,
                    factKind: 'measurement', measurement: { dimension, magnitude, relation },
                    block: params.block, citationIds: params.citationIds, item: params.item,
                });
            }
        }
    }
    for (const match of String(params.block.text || '').matchAll(COMPARABLE_QUANTITY_FACT_PATTERN)) {
        if (MEASUREMENT_UNIT_SUFFIX_PATTERN.test(params.block.text.slice(match.index! + match[0].length))) continue;
        const subjectLabel = normalizeWhitespace(match[1]);
        const scopeKeys = comparableFactScopeKeys(
            subjectLabel,
            comparableFactSentenceTail(params.block.text, match)
        );
        const subjectKey = comparableFactSubjectKey(subjectLabel, scopeKeys);
        const value = Number(match[2]);
        if (!subjectKey || !Number.isFinite(value)) {
            continue;
        }
        appendFact({
            subjectKey,
            subjectLabel,
            valueKey: `${Number(value.toFixed(12))}`,
            valueLabel: match[2],
            factKind: 'quantity',
            block: params.block,
            citationIds: params.citationIds,
            item: params.item,
        });
    }
    for (const match of String(params.block.text || '').matchAll(COMPARABLE_DATE_FACT_PATTERN)) {
        const subjectLabel = normalizeWhitespace(match[1]);
        const scopeKeys = comparableFactScopeKeys(
            subjectLabel,
            comparableFactSentenceTail(params.block.text, match)
        );
        const subjectKey = comparableFactSubjectKey(subjectLabel, scopeKeys);
        const valueKey = normalizeComparableDateValue(match[2]);
        if (!subjectKey || !valueKey) {
            continue;
        }
        appendFact({
            subjectKey,
            subjectLabel,
            valueKey,
            valueLabel: match[2],
            factKind: 'date',
            block: params.block,
            citationIds: params.citationIds,
            item: params.item,
        });
    }
    for (const match of String(params.block.text || '').matchAll(COMPARABLE_STATE_FACT_PATTERN)) {
        const subjectLabel = normalizeWhitespace(match[1]);
        const scopeKeys = comparableFactScopeKeys(
            subjectLabel,
            comparableFactSentenceTail(params.block.text, match)
        );
        const subjectKey = comparableFactSubjectKey(subjectLabel, scopeKeys);
        const stateValue = normalizeComparableStateValue(match[2]);
        if (!subjectKey || !stateValue) {
            continue;
        }
        appendFact({
            subjectKey: `${subjectKey}:${stateValue.groupKey}`,
            subjectLabel,
            valueKey: stateValue.valueKey,
            valueLabel: match[2],
            factKind: 'state',
            block: params.block,
            citationIds: params.citationIds,
            item: params.item,
        });
    }
    for (const match of String(params.block.text || '').matchAll(COMPARABLE_LOCATION_FACT_PATTERN)) {
        const subjectLabel = normalizeWhitespace(match[1]);
        const scopeKeys = comparableFactScopeKeys(
            subjectLabel,
            `${normalizeWhitespace(match[2])} ${comparableFactSentenceTail(params.block.text, match)}`
        );
        const subjectKey = comparableFactSubjectKey(subjectLabel, scopeKeys);
        const valueKey = normalizeComparableLocationValue(match[2]);
        if (!subjectKey || !valueKey) {
            continue;
        }
        appendFact({
            subjectKey,
            subjectLabel,
            valueKey,
            valueLabel: normalizeWhitespace(match[2]),
            factKind: 'location',
            block: params.block,
            citationIds: params.citationIds,
            item: params.item,
        });
    }
    for (const match of String(params.block.text || '').matchAll(COMPARABLE_IDENTITY_FACT_PATTERN)) {
        const subjectLabel = normalizeWhitespace(match[1]);
        const scopeKeys = comparableFactScopeKeys(
            subjectLabel,
            `${normalizeWhitespace(match[2])} ${comparableFactSentenceTail(params.block.text, match)}`
        );
        const subjectKey = comparableFactSubjectKey(subjectLabel, scopeKeys);
        const valueKey = normalizeComparableIdentityValue(match[2]);
        if (!subjectKey || !valueKey) {
            continue;
        }
        appendFact({
            subjectKey,
            subjectLabel,
            valueKey,
            valueLabel: normalizeWhitespace(match[2]),
            factKind: 'identity',
            block: params.block,
            citationIds: params.citationIds,
            item: params.item,
        });
    }
    for (const match of String(params.block.text || '').matchAll(COMPARABLE_ENDPOINT_FACT_PATTERN)) {
        const subjectLabel = normalizeWhitespace(match[1]);
        const scopeKeys = comparableFactScopeKeys(
            subjectLabel,
            comparableFactSentenceTail(params.block.text, match)
        );
        const subjectKey = comparableFactSubjectKey(subjectLabel, scopeKeys);
        const valueKey = normalizeComparableEndpointValue(match[2]);
        if (!subjectKey || !valueKey) {
            continue;
        }
        appendFact({
            subjectKey,
            subjectLabel,
            valueKey,
            valueLabel: normalizeWhitespace(match[2]),
            factKind: 'endpoint',
            block: params.block,
            citationIds: params.citationIds,
            item: params.item,
        });
    }
    for (const match of String(params.block.text || '').matchAll(COMPARABLE_DEPENDENCY_FACT_PATTERN)) {
        const subjectLabel = normalizeWhitespace(match[1]);
        const scopeKeys = comparableFactScopeKeys(
            subjectLabel,
            comparableFactSentenceTail(params.block.text, match)
        );
        const subjectKey = comparableFactSubjectKey(subjectLabel, scopeKeys);
        const valueKey = normalizeComparableDependencyValue(match[2]);
        if (!subjectKey || !valueKey) {
            continue;
        }
        appendFact({
            subjectKey,
            subjectLabel,
            valueKey,
            valueLabel: normalizeWhitespace(match[2]),
            factKind: 'dependency',
            block: params.block,
            citationIds: params.citationIds,
            item: params.item,
        });
    }
    for (const match of String(params.block.text || '').matchAll(COMPARABLE_FORMAT_FACT_PATTERN)) {
        const subjectLabel = normalizeWhitespace(match[1]);
        const scopeKeys = comparableFactScopeKeys(
            subjectLabel,
            comparableFactSentenceTail(params.block.text, match)
        );
        const subjectKey = comparableFactSubjectKey(subjectLabel, scopeKeys);
        const valueKey = normalizeComparableFormatValue(match[2]);
        if (!subjectKey || !valueKey) {
            continue;
        }
        appendFact({
            subjectKey,
            subjectLabel,
            valueKey,
            valueLabel: normalizeWhitespace(match[2]),
            factKind: 'format',
            block: params.block,
            citationIds: params.citationIds,
            item: params.item,
        });
    }
    for (const match of String(params.block.text || '').matchAll(COMPARABLE_PROTOCOL_FACT_PATTERN)) {
        const subjectLabel = normalizeWhitespace(match[1]);
        const scopeKeys = comparableFactScopeKeys(
            subjectLabel,
            comparableFactSentenceTail(params.block.text, match)
        );
        const subjectKey = comparableFactSubjectKey(subjectLabel, scopeKeys);
        const valueKey = normalizeComparableProtocolValue(match[2]);
        if (!subjectKey || !valueKey) {
            continue;
        }
        appendFact({
            subjectKey,
            subjectLabel,
            valueKey,
            valueLabel: normalizeWhitespace(match[2]),
            factKind: 'protocol',
            block: params.block,
            citationIds: params.citationIds,
            item: params.item,
        });
    }
    for (const match of String(params.block.text || '').matchAll(COMPARABLE_VERSION_FACT_PATTERN)) {
        const subjectLabel = normalizeWhitespace(match[1]);
        const scopeKeys = comparableFactScopeKeys(
            subjectLabel,
            comparableFactSentenceTail(params.block.text, match)
        );
        const subjectKey = comparableFactSubjectKey(subjectLabel, scopeKeys);
        const valueKey = normalizeComparableVersionValue(match[2]);
        if (!subjectKey || !valueKey) {
            continue;
        }
        appendFact({
            subjectKey,
            subjectLabel,
            valueKey,
            valueLabel: normalizeWhitespace(match[2]),
            factKind: 'version',
            block: params.block,
            citationIds: params.citationIds,
            item: params.item,
        });
    }
    for (const match of String(params.block.text || '').matchAll(COMPARABLE_PORT_FACT_PATTERN)) {
        const subjectLabel = normalizeWhitespace(match[1]);
        const scopeKeys = comparableFactScopeKeys(
            subjectLabel,
            comparableFactSentenceTail(params.block.text, match)
        );
        const subjectKey = comparableFactSubjectKey(subjectLabel, scopeKeys);
        const valueKey = normalizeComparablePortValue(match[2]);
        if (!subjectKey || !valueKey) {
            continue;
        }
        appendFact({
            subjectKey,
            subjectLabel,
            valueKey,
            valueLabel: match[2],
            factKind: 'port',
            block: params.block,
            citationIds: params.citationIds,
            item: params.item,
        });
    }
    for (const match of String(params.block.text || '').matchAll(COMPARABLE_STATUS_CODE_FACT_PATTERN)) {
        const subjectLabel = normalizeWhitespace(match[1]);
        const scopeKeys = comparableFactScopeKeys(
            subjectLabel,
            comparableFactSentenceTail(params.block.text, match)
        );
        const subjectKey = comparableFactSubjectKey(subjectLabel, scopeKeys);
        const valueKey = normalizeComparableStatusCodeValue(match[2]);
        if (!subjectKey || !valueKey) {
            continue;
        }
        appendFact({
            subjectKey,
            subjectLabel,
            valueKey,
            valueLabel: match[2],
            factKind: 'status_code',
            block: params.block,
            citationIds: params.citationIds,
            item: params.item,
        });
    }
    return facts;
}

function buildBlockCitationMap(
    group: DocumentEvidenceGroup,
    blocks: SourceBlock[],
    source: RagEvidenceSourceDocument
): Map<string, Set<string>> {
    const citationIdsByBlock = new Map<string, Set<string>>();
    group.entries.forEach(({ item }) => {
        itemEvidenceSpans(item).forEach((span) => {
            blocksForEvidence(blocks, span, source.content).forEach((block) => {
                const key = sourceBlockKey(block);
                const citationIds = citationIdsByBlock.get(key) || new Set<string>();
                citationIds.add(span.id);
                citationIdsByBlock.set(key, citationIds);
            });
        });
    });
    return citationIdsByBlock;
}

function extractComparableEvidenceFactsFromBlockEntries(
    entries: Array<{ block: SourceBlock; item: KnowledgeQueryItem }>,
    citationIdsByBlock: Map<string, Set<string>>,
    execution?: AgentConversationExecution
): ComparableEvidenceFact[] {
    return entries
        .sort((left, right) => left.block.startOffset - right.block.startOffset)
        .flatMap(({ block, item }) => extractComparableEvidenceFacts({
            execution,
            block,
            item,
            citationIds: Array.from(citationIdsByBlock.get(sourceBlockKey(block)) || []),
        }));
}

function selectRepresentativeGroupItem(group: DocumentEvidenceGroup): KnowledgeQueryItem | null {
    const rankedEntries = group.entries.slice().sort((left, right) => {
        if (left.directRole !== right.directRole) {
            return left.directRole === 'direct_support' ? -1 : 1;
        }
        return Number(right.item.score || 0) - Number(left.item.score || 0);
    });
    return rankedEntries[0]?.item || null;
}

function buildEvidenceItemMap(
    group: DocumentEvidenceGroup,
    blocks: SourceBlock[],
    source: RagEvidenceSourceDocument
): Map<string, KnowledgeQueryItem> {
    const itemByBlock = new Map<string, KnowledgeQueryItem>();
    group.entries.forEach(({ item }) => {
        itemEvidenceSpans(item).forEach((span) => {
            blocksForEvidence(blocks, span, source.content).forEach((block) => {
                const key = sourceBlockKey(block);
                const previous = itemByBlock.get(key);
                if (!previous || Number(item.score || 0) > Number(previous.score || 0)) {
                    itemByBlock.set(key, item);
                }
            });
        });
    });
    return itemByBlock;
}

function collectSelectedContextComparableFacts(
    group: DocumentEvidenceGroup,
    source: RagEvidenceSourceDocument,
    paragraphWindow: number,
    blocks: SourceBlock[],
    execution?: AgentConversationExecution,
): ComparableEvidenceFact[] {
    const citationIdsByBlock = buildBlockCitationMap(group, blocks, source);
    const selectedBlocks = new Map<string, { block: SourceBlock; item: KnowledgeQueryItem }>();

    group.entries
        .filter((entry) => entry.expandDocumentContext)
        .forEach(({ item }) => {
            itemEvidenceSpans(item).forEach((span) => {
                const evidenceBlocks = blocksForEvidence(blocks, span, source.content);
                buildSectionBlocks(blocks, evidenceBlocks, paragraphWindow).forEach((block) => {
                    selectedBlocks.set(sourceBlockKey(block), { block, item });
                });
            });
        });

    return extractComparableEvidenceFactsFromBlockEntries(Array.from(selectedBlocks.values()), citationIdsByBlock, execution);
}

function collectFullDocumentComparableFacts(
    group: DocumentEvidenceGroup,
    source: RagEvidenceSourceDocument,
    blocks: SourceBlock[],
    execution?: AgentConversationExecution,
): ComparableEvidenceFact[] {
    const fallbackItem = selectRepresentativeGroupItem(group);
    if (!fallbackItem) {
        return [];
    }
    const citationIdsByBlock = buildBlockCitationMap(group, blocks, source);
    const evidenceItemByBlock = buildEvidenceItemMap(group, blocks, source);
    return extractComparableEvidenceFactsFromBlockEntries(
        blocks.map((block) => ({
            block,
            item: evidenceItemByBlock.get(sourceBlockKey(block)) || fallbackItem,
        })),
        citationIdsByBlock,
        execution,
    );
}

function comparableFactDocumentKey(fact: ComparableEvidenceFact): string {
    return `${fact.item.atom.documentId}\n${fact.item.atom.sourcePath}`;
}

function comparableEvidenceFactsConflict(left: ComparableEvidenceFact, right: ComparableEvidenceFact): boolean {
    if (left.subjectKey !== right.subjectKey || left.factKind !== right.factKind) return false;
    if (left.factKind === 'measurement' && right.factKind === 'measurement') {
        if (left.measurement.dimension !== right.measurement.dimension) return false;
        const sameMagnitude = left.measurement.magnitude === right.measurement.magnitude;
        if (left.measurement.relation !== right.measurement.relation) return sameMagnitude;
        return left.measurement.relation === 'equal' && !sameMagnitude;
    }
    return left.valueKey !== right.valueKey;
}

function buildConflictFragments(
    group: DocumentEvidenceGroup,
    facts: ComparableEvidenceFact[],
    paragraphWindow: number,
    execution?: AgentConversationExecution,
): RagEvidenceFragment[] {
    const fragments: RagEvidenceFragment[] = [];
    const seenConflicts = new Set<string>();

    facts.forEach((left, leftIndex) => {
        facts.slice(leftIndex + 1).forEach((right) => {
            if (!comparableEvidenceFactsConflict(left, right)) {
                return;
            }
            const blockDistance = Math.abs(left.block.startLine - right.block.startLine);
            const sameScopedSection = left.block.headingPath.length > 0
                && sameHeadingPath(left.block.headingPath, right.block.headingPath);
            if (!sameScopedSection && blockDistance > Math.max(2, paragraphWindow)) {
                return;
            }
            const orderedValues = [left.valueKey, right.valueKey].sort();
            const conflictKey = `${left.subjectKey}:${left.factKind}:${orderedValues[0]}:${orderedValues[1]}`;
            if (seenConflicts.has(conflictKey)) {
                return;
            }
            seenConflicts.add(conflictKey);
            const firstBlock = left.block.startOffset <= right.block.startOffset ? left.block : right.block;
            const lastBlock = left.block.endOffset >= right.block.endOffset ? left.block : right.block;
            const citationIds = Array.from(new Set([
                ...left.citationIds,
                ...right.citationIds,
                ...itemEvidenceSpans(left.item).map((span) => span.id),
                ...itemEvidenceSpans(right.item).map((span) => span.id),
            ].filter(Boolean)));
            const conflictBlockTexts = Array.from(new Map(
                [left.block, right.block].map((block) => [sourceBlockKey(block), block.text] as const)
            ).values());
            const text = [
                `Conflicting evidence for ${left.subjectLabel}:`,
                ...conflictBlockTexts,
            ].join('\n');
            fragments.push(finishEvidenceFragment({
                fragmentId: `rag_conflict_${sanitizeFragmentPart(group.documentId)}_${fragments.length + 1}`,
                role: 'conflict',
                text,
                atomId: left.item.atom.id,
                documentId: group.documentId,
                sourcePath: group.sourcePath,
                title: left.item.atom.title,
                headingPath: [...left.block.headingPath],
                startOffset: firstBlock.startOffset,
                endOffset: lastBlock.endOffset,
                startLine: firstBlock.startLine,
                endLine: lastBlock.endLine,
                charCount: text.length,
                tokenEstimate: estimateRagTokenCount(text),
                truncated: false,
                citationIds,
                relationEdgeIds: Array.from(new Set([
                    ...left.item.relationPath.map((edge) => edge.id),
                    ...right.item.relationPath.map((edge) => edge.id),
                ])),
                score: Number(Math.max(Number(left.item.score || 0), Number(right.item.score || 0)).toFixed(4)),
                sourceBoundary: 'full_document',
            }, execution));
        });
    });

    return fragments;
}

function buildCrossDocumentConflictFragments(facts: ComparableEvidenceFact[], execution?: AgentConversationExecution): RagEvidenceFragment[] {
    const orderedFacts = facts.slice().sort((left, right) => {
        const sourceDelta = String(left.item.atom.sourcePath || '').localeCompare(String(right.item.atom.sourcePath || ''));
        if (sourceDelta !== 0) {
            return sourceDelta;
        }
        return left.block.startOffset - right.block.startOffset;
    });
    const fragments: RagEvidenceFragment[] = [];
    const seenConflicts = new Set<string>();

    orderedFacts.forEach((left, leftIndex) => {
        execution?.assertActive();
        orderedFacts.slice(leftIndex + 1).forEach((right) => {
            if (comparableFactDocumentKey(left) === comparableFactDocumentKey(right)) {
                return;
            }
            if (!comparableEvidenceFactsConflict(left, right)) {
                return;
            }
            const orderedSourceKeys = [comparableFactDocumentKey(left), comparableFactDocumentKey(right)].sort();
            const orderedValues = [left.valueKey, right.valueKey].sort();
            const conflictKey = `${left.subjectKey}:${left.factKind}:${orderedSourceKeys[0]}:${orderedSourceKeys[1]}:${orderedValues[0]}:${orderedValues[1]}`;
            if (seenConflicts.has(conflictKey)) {
                return;
            }
            seenConflicts.add(conflictKey);
            const citationIds = Array.from(new Set([
                ...left.citationIds,
                ...right.citationIds,
                ...itemEvidenceSpans(left.item).map((span) => span.id),
                ...itemEvidenceSpans(right.item).map((span) => span.id),
            ].filter(Boolean)));
            const text = [
                `Conflicting evidence for ${left.subjectLabel} across documents:`,
                `${left.item.atom.title}: ${left.block.text}`,
                `${right.item.atom.title}: ${right.block.text}`,
            ].join('\n');
            fragments.push(finishEvidenceFragment({
                fragmentId: `rag_conflict_cross_document_${sanitizeFragmentPart(left.item.atom.documentId)}_${sanitizeFragmentPart(right.item.atom.documentId)}_${fragments.length + 1}`,
                role: 'conflict',
                text,
                atomId: left.item.atom.id,
                documentId: `cross_document_conflict_${sanitizeFragmentPart(left.item.atom.documentId)}_${sanitizeFragmentPart(right.item.atom.documentId)}`,
                sourcePath: `${left.item.atom.sourcePath} | ${right.item.atom.sourcePath}`,
                title: `${left.item.atom.title} / ${right.item.atom.title}`,
                headingPath: [],
                charCount: text.length,
                tokenEstimate: estimateRagTokenCount(text),
                truncated: false,
                citationIds,
                relationEdgeIds: Array.from(new Set([
                    ...left.item.relationPath.map((edge) => edge.id),
                    ...right.item.relationPath.map((edge) => edge.id),
                ])),
                score: Number(Math.max(Number(left.item.score || 0), Number(right.item.score || 0)).toFixed(4)),
                sourceBoundary: 'full_document',
            }, execution));
        });
    });

    return fragments;
}

function limitGraphNeighborDocumentContextFragments(fragments: RagEvidenceFragment[]): RagEvidenceFragment[] {
    const graphNeighborContextFragments = fragments
        .map((fragment, index) => ({ fragment, index }))
        .filter((entry) => (
            entry.fragment.role === 'graph_neighbor_support'
            && entry.fragment.sourceBoundary === 'full_document'
        ))
        .sort((left, right) => {
            const scoreDelta = Number(right.fragment.score || 0) - Number(left.fragment.score || 0);
            if (Math.abs(scoreDelta) > 0.0001) {
                return scoreDelta;
            }
            return left.index - right.index;
        });
    const selectedContextFragmentIds = new Set(
        graphNeighborContextFragments
            .slice(0, MAX_GRAPH_NEIGHBOR_DOCUMENT_CONTEXT_FRAGMENTS)
            .map((entry) => entry.fragment.fragmentId)
    );
    return fragments.filter((fragment) => (
        fragment.role !== 'graph_neighbor_support'
        || fragment.sourceBoundary !== 'full_document'
        || selectedContextFragmentIds.has(fragment.fragmentId)
    ));
}

function buildDirectFragment(
    item: KnowledgeQueryItem,
    span: EvidenceSpan,
    index: number,
    role: 'direct_support' | 'graph_neighbor_support' = 'direct_support',
    execution?: AgentConversationExecution,
): RagEvidenceFragment {
    const text = normalizeWhitespace(String(span.snippet || item.atom.content || item.atom.title || ''));
    return finishEvidenceFragment({
        fragmentId: `${role === 'graph_neighbor_support' ? 'rag_graph_neighbor' : 'rag_direct'}_${sanitizeFragmentPart(item.atom.documentId)}_${sanitizeFragmentPart(span.id || String(index + 1))}`,
        role,
        text,
        atomId: item.atom.id,
        documentId: item.atom.documentId,
        sourcePath: item.atom.sourcePath,
        title: item.atom.title,
        headingPath: Array.isArray(item.atom.metadata?.sectionPath) ? [...item.atom.metadata.sectionPath] : [],
        startOffset: Number.isFinite(span.startOffset) ? span.startOffset : undefined,
        endOffset: Number.isFinite(span.endOffset) ? span.endOffset : undefined,
        startLine: Number.isFinite(span.startLine) ? span.startLine : undefined,
        endLine: Number.isFinite(span.endLine) ? span.endLine : undefined,
        charCount: text.length,
        tokenEstimate: estimateRagTokenCount(text),
        truncated: false,
        citationIds: [span.id],
        relationEdgeIds: item.relationPath.map((edge) => edge.id),
        score: Number(Number(item.score || 0).toFixed(4)),
        sourceBoundary: 'direct_span_only',
    }, execution);
}

function groupItemsByDocument(
    items: KnowledgeQueryItem[],
    graphNeighborItems: KnowledgeQueryItem[] = []
): DocumentEvidenceGroup[] {
    const groups = new Map<string, DocumentEvidenceGroup>();
    const appendItem = (
        item: KnowledgeQueryItem,
        index: number,
        directRole: 'direct_support' | 'graph_neighbor_support',
        expandDocumentContext: boolean
    ): void => {
        const documentId = String(item.atom.documentId || `document_${index + 1}`).trim();
        const sourcePath = String(item.atom.sourcePath || '').trim();
        const key = `${documentId}\n${sourcePath}`;
        let group = groups.get(key);
        if (!group) {
            group = {
                documentId,
                sourcePath,
                entries: [],
            };
            groups.set(key, group);
        }
        group.entries.push({
            item,
            directRole,
            expandDocumentContext,
        });
    };
    items.forEach((item, index) => appendItem(item, index, 'direct_support', true));
    graphNeighborItems.forEach((item, index) => appendItem(item, index, 'graph_neighbor_support', true));
    return Array.from(groups.values());
}

function itemEvidenceSpans(item: KnowledgeQueryItem): EvidenceSpan[] {
    return Array.isArray(item.evidenceSpans) ? item.evidenceSpans.filter(Boolean) : [];
}

async function resolveDocumentSource(
    group: DocumentEvidenceGroup,
    sourceResolver?: RagEvidenceSourceResolver
): Promise<RagEvidenceSourceDocument | null> {
    if (!sourceResolver) {
        return null;
    }
    const atomIds = Array.from(new Set(group.entries.map((entry) => entry.item.atom.id).filter(Boolean)));
    const citationIds = Array.from(new Set(group.entries.flatMap((entry) => itemEvidenceSpans(entry.item).map((span) => span.id)).filter(Boolean)));
    const source = await sourceResolver({
        documentId: group.documentId,
        sourcePath: group.sourcePath,
        atomIds,
        citationIds,
    });
    if (!source || (!source.unavailableReason && !String(source.content || '').trim())) {
        return null;
    }
    return {
        ...source,
        documentId: String(source.documentId || group.documentId),
        sourcePath: String(source.sourcePath || group.sourcePath),
        content: String(source.content || ''),
    };
}

function buildParentFragments(
    group: DocumentEvidenceGroup,
    source: RagEvidenceSourceDocument,
    paragraphWindow: number,
    blocks: SourceBlock[],
    execution?: AgentConversationExecution,
): RagEvidenceFragment[] {
    const parentDrafts = new Map<string, ParentFragmentDraft>();

    group.entries
        .filter((entry) => entry.expandDocumentContext)
        .forEach(({ item, directRole }) => {
            const fragmentRole = directRole === 'graph_neighbor_support' ? 'graph_neighbor_support' : 'parent_context';
            itemEvidenceSpans(item).forEach((span) => {
                const evidenceBlocks = blocksForEvidence(blocks, span, source.content);
                if (evidenceBlocks.length <= 0) {
                    return;
                }
                const sectionBlocks = buildSectionBlocks(blocks, evidenceBlocks, paragraphWindow);
                if (sectionBlocks.length <= 0) {
                    return;
                }
                const headingPath = evidenceBlocks[0].headingPath.length > 0
                    ? evidenceBlocks[0].headingPath
                    : (Array.isArray(item.atom.metadata?.sectionPath) ? item.atom.metadata.sectionPath : []);
                const parentKey = `${fragmentRole}\n${group.documentId}\n${group.sourcePath}\n${headingPath.join('/') || 'local_window'}`;
                let draft = parentDrafts.get(parentKey);
                if (!draft) {
                    draft = {
                        key: parentKey,
                        role: fragmentRole,
                        item,
                        documentId: group.documentId,
                        sourcePath: group.sourcePath,
                        headingPath: [...headingPath],
                        blocks: [],
                        citationIds: new Set<string>(),
                        relationEdgeIds: new Set<string>(),
                        score: 0,
                    };
                    parentDrafts.set(parentKey, draft);
                }
                draft.blocks.push(...sectionBlocks);
                draft.citationIds.add(span.id);
                item.relationPath.forEach((edge) => draft?.relationEdgeIds.add(edge.id));
                draft.score = Math.max(draft.score, Number(item.score || 0));
            });
        });

    return Array.from(parentDrafts.values()).map((draft, index): RagEvidenceFragment => {
        const blocksForFragment = mergeBlocks(draft.blocks);
        const text = fragmentTextFromBlocks(blocksForFragment);
        const first = blocksForFragment[0];
        const last = blocksForFragment[blocksForFragment.length - 1];
        const fragmentPrefix = draft.role === 'graph_neighbor_support'
            ? 'rag_graph_neighbor_context'
            : 'rag_parent';
        return finishEvidenceFragment({
            fragmentId: `${fragmentPrefix}_${sanitizeFragmentPart(draft.documentId)}_${index + 1}`,
            role: draft.role,
            text,
            atomId: draft.item.atom.id,
            documentId: draft.documentId,
            sourcePath: draft.sourcePath,
            title: draft.item.atom.title,
            headingPath: [...draft.headingPath],
            startOffset: first?.startOffset,
            endOffset: last?.endOffset,
            startLine: first?.startLine,
            endLine: last?.endLine,
            charCount: text.length,
            tokenEstimate: estimateRagTokenCount(text),
            truncated: false,
            citationIds: Array.from(draft.citationIds),
            relationEdgeIds: Array.from(draft.relationEdgeIds),
            score: Number(Number(draft.score || 0).toFixed(4)),
            sourceBoundary: 'full_document',
        }, execution);
    }).filter((fragment) => fragment.text.length > 0);
}

export async function assembleRagEvidenceContext(params: AssembleRagEvidenceContextParams): Promise<RagContextPack> {
    const paragraphWindow = Math.floor(Math.max(0, Math.min(20, Number(params.paragraphWindow ?? DEFAULT_PARAGRAPH_WINDOW))));
    const decisions: RagSourceDecision[] = [];
    const rawFragments: RagEvidenceFragment[] = [];
    const fullDocumentComparableFacts: ComparableEvidenceFact[] = [];
    const execution = params.execution;
    let readFullDocument = false;
    const groups = groupItemsByDocument(
        Array.isArray(params.items) ? params.items : [],
        Array.isArray(params.graphNeighborItems) ? params.graphNeighborItems : []
    );

    for (const group of groups) {
        await execution?.yieldCheckpoint();
        try {
            group.entries.forEach(entry => {
                itemEvidenceSpans(entry.item).forEach((span, spanIndex) => {
                    rawFragments.push(buildDirectFragment(entry.item, span, rawFragments.length + spanIndex, entry.directRole, execution));
                });
            });
            const source = await resolveDocumentSource(group, params.sourceResolver);
            execution?.assertActive();
            if (!source || source.unavailableReason) {
                const unavailableRoles = Array.from(new Set(group.entries.map(entry => entry.directRole))).join(',');
                decisions.push({
                    documentId: group.documentId, sourcePath: group.sourcePath,
                    sourceBoundary: 'direct_span_only', status: 'source_window_unavailable',
                    reason: source?.unavailableReason || `source_resolver_returned_no_content:${unavailableRoles}`,
                });
                continue;
            }
            readFullDocument = true;
            const blocks = parseMarkdownBlocks(source.content, execution);
            rawFragments.push(...buildParentFragments(group, source, paragraphWindow, blocks, execution));
            const selectedFacts = collectSelectedContextComparableFacts(group, source, paragraphWindow, blocks, execution);
            fullDocumentComparableFacts.push(...collectFullDocumentComparableFacts(group, source, blocks, execution));
            rawFragments.push(...buildConflictFragments(group, selectedFacts, paragraphWindow, execution));
            decisions.push({
                documentId: group.documentId, sourcePath: group.sourcePath,
                sourceBoundary: 'full_document', status: 'read', charsRead: source.content.length,
            });
        } catch (error) {
            if (!execution || !execution.isResourceLimit(error)) throw error;
            decisions.push({
                documentId: group.documentId, sourcePath: group.sourcePath,
                sourceBoundary: 'direct_span_only', status: 'source_window_unavailable', reason: error.code,
            });
            if (error.code === 'runtime_fragment_limit') break;
        }
    }
    try {
        rawFragments.push(...buildCrossDocumentConflictFragments(fullDocumentComparableFacts, execution));
    } catch (error) {
        if (!execution || !execution.isResourceLimit(error)) throw error;
        decisions.push({
            documentId: 'cross_document_conflicts', sourcePath: '',
            sourceBoundary: 'direct_span_only', status: 'source_window_unavailable', reason: error.code,
        });
    }
    execution?.assertActive();
    const candidateFragments = limitGraphNeighborDocumentContextFragments(rawFragments);
    const graphConditioning = conditionRagFragmentsByGraphPlan({
        fragments: candidateFragments,
        graphAnswerPlan: params.graphAnswerPlan,
    });
    return buildRagContextPack({
        query: params.query,
        generatedAt: params.generatedAt,
        sourceBoundary: readFullDocument ? 'full_document' : 'direct_span_only',
        fragments: candidateFragments,
        sourceDecisions: decisions,
        budget: params.budget,
        fragmentOrder: graphConditioning.fragmentOrder,
        graphConditioning: graphConditioning.trace,
    });
}
