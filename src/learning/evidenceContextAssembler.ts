import type {
    EvidenceSpan,
    KnowledgeQueryItem,
    RagContextBudget,
    RagContextPack,
    RagEvidenceFragment,
    RagEvidenceRole,
    RagSourceDecision,
} from './types';
import { buildRagContextPack, estimateRagTokenCount } from './ragContextPack';

export interface RagEvidenceSourceLookup {
    documentId: string;
    sourcePath: string;
    atomIds: string[];
    citationIds: string[];
}

export interface RagEvidenceSourceDocument {
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
    query: string;
    items: KnowledgeQueryItem[];
    graphNeighborItems?: KnowledgeQueryItem[];
    sourceResolver?: RagEvidenceSourceResolver;
    budget?: Partial<RagContextBudget>;
    paragraphWindow?: number;
    generatedAt?: string;
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

interface ComparableEvidenceFact {
    subjectKey: string;
    subjectLabel: string;
    valueKey: string;
    valueLabel: string;
    factKind: 'measurement' | 'quantity' | 'date' | 'state' | 'location' | 'identity' | 'endpoint' | 'dependency';
    block: SourceBlock;
    citationIds: string[];
    item: KnowledgeQueryItem;
}

type ComparableTemporalScopeKey = 'current' | 'historical' | 'planned';
type ComparableFactScopeKey =
    | `temporal:${ComparableTemporalScopeKey}`
    | `environment:${string}`
    | `version:${string}`
    | `platform:${string}`;

const DEFAULT_PARAGRAPH_WINDOW = 5;
const MAX_GRAPH_NEIGHBOR_DOCUMENT_CONTEXT_FRAGMENTS = 2;
const COMPARABLE_NUMERIC_FACT_PATTERN = /\b(?:the\s+)?([a-z][a-z0-9 -]{2,80}?)\s+(?:is|=|:)\s*(?:±|\+\/-|\+\s*\/\s*-)?\s*(-?\d+(?:\.\d+)?)\s*(mm|cm|m|um|µm|nm|kg|g|mg|s|ms|%|deg|degree|degrees|c|k)\b/gi;
const COMPARABLE_QUANTITY_FACT_PATTERN = /\b(?:the\s+)?([a-z][a-z0-9 -]{2,80}?(?:count|limit|threshold|budget|quota|capacity|size|window|attempts|retries))\s+(?:is|are|=|:)\s*(-?\d+(?:\.\d+)?)\b/gi;
const COMPARABLE_DATE_FACT_PATTERN = /\b(?:the\s+)?([a-z][a-z0-9 -]{2,80}?(?:date|year|deadline|cutoff|cut-off|version|release|revision|effective))\s+(?:is|=|:)\s*(\d{4}(?:-\d{2}-\d{2})?)\b/gi;
const COMPARABLE_STATE_FACT_PATTERN = /\b(?:the\s+)?([a-z][a-z0-9 -]{2,80}?(?:status|state|mode|flag|policy|availability|setting|gate|switch))\s+(?:is|=|:)\s*(enabled|disabled|active|inactive|available|unavailable|supported|unsupported|allowed|blocked|required|optional|open|closed|on|off)\b/gi;
const COMPARABLE_LOCATION_FACT_PATTERN = /\b(?:the\s+)?([a-z][a-z0-9 -]{2,80}?(?:location|site|region|zone|room|rack|slot|bay))\s+(?:is|=|:)\s*([a-z0-9][a-z0-9 /_.-]{1,80}?)(?=\.|,|;|\n|$)/gi;
const COMPARABLE_IDENTITY_FACT_PATTERN = /\b(?:the\s+)?([a-z][a-z0-9 -]{2,80}?(?:owner|assignee|contact|maintainer|team|group))\s+(?:is|=|:)\s*([a-z][a-z0-9 &/_.-]{1,80}?)(?=\s+(?:in|for|on|under|within)\s+|\.|,|;|\n|$)/gi;
const COMPARABLE_ENDPOINT_FACT_PATTERN = /\b(?:the\s+)?([a-z][a-z0-9 -]{2,80}?(?:endpoint|url|uri|route))\s+(?:is|=|:)\s*((?:https?:\/\/|\/|[a-z0-9][a-z0-9._-]*\/)[a-z0-9/?#&=._~:%+\-/]*?[a-z0-9/#&=_~:%+\-/])(?=\s+(?:in|for|on|under|within)\s+|\.|,|;|\n|$)/gi;
const COMPARABLE_DEPENDENCY_FACT_PATTERN = /\b(?:the\s+)?([a-z][a-z0-9 -]{2,80}?(?:dependency|package|provider|driver|runtime|library|module|plugin|adapter))\s+(?:is|are|=|:)\s*((?:@[a-z0-9._-]+\/)?[a-z0-9][a-z0-9+.#/_@ -]{0,79}?)(?=\s+(?:in|for|on|under|within)\s+|\.|,|;|\n|$)/gi;
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

function normalizeWhitespace(value: string): string {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function sanitizeFragmentPart(value: string): string {
    return normalizeWhitespace(value)
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 80) || 'fragment';
}

function splitSourceLines(content: string): SourceLine[] {
    const normalizedContent = String(content || '');
    if (!normalizedContent) {
        return [];
    }
    const lines = normalizedContent.split(/\r\n|\n|\r/);
    const records: SourceLine[] = [];
    let cursor = 0;
    lines.forEach((line, index) => {
        const startOffset = cursor;
        const endOffset = startOffset + line.length;
        records.push({
            lineNumber: index + 1,
            text: line,
            startOffset,
            endOffset,
        });
        if (normalizedContent.startsWith('\r\n', endOffset)) {
            cursor = endOffset + 2;
        } else if (normalizedContent[endOffset] === '\n' || normalizedContent[endOffset] === '\r') {
            cursor = endOffset + 1;
        } else {
            cursor = endOffset;
        }
    });
    return records;
}

function isTableLine(text: string): boolean {
    const trimmed = String(text || '').trim();
    return trimmed.startsWith('|') && trimmed.endsWith('|');
}

function parseMarkdownBlocks(content: string): SourceBlock[] {
    const sourceLines = splitSourceLines(content);
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
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function comparableFactSentenceTail(blockText: string, match: RegExpMatchArray): string {
    const matchIndex = typeof match.index === 'number' ? match.index : -1;
    if (matchIndex < 0) {
        return '';
    }
    const tail = String(blockText || '').slice(matchIndex + String(match[0] || '').length);
    return normalizeWhitespace(tail.split(/[.!?]/)[0] || '');
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
    return scopeKeys.sort();
}

function comparableFactSubjectKey(subjectLabel: string, scopeKeys: ComparableFactScopeKey[]): string {
    const scopedSubjectLabel = scopeKeys.some((scopeKey) => scopeKey.startsWith('temporal:'))
        ? normalizeWhitespace(subjectLabel).replace(COMPARABLE_TEMPORAL_SCOPE_PATTERN, '')
        : subjectLabel;
    const subjectKey = normalizeComparableFactSubject(scopedSubjectLabel);
    return scopeKeys.length > 0 && subjectKey
        ? `${subjectKey}@scope:${scopeKeys.join('+')}`
        : subjectKey;
}

function normalizeComparableFactUnit(value: string): string {
    const normalized = normalizeWhitespace(value).toLowerCase();
    if (normalized === 'um') {
        return 'µm';
    }
    if (normalized === 'degree' || normalized === 'degrees') {
        return 'deg';
    }
    return normalized;
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

function extractComparableEvidenceFacts(params: {
    block: SourceBlock;
    citationIds: string[];
    item: KnowledgeQueryItem;
}): ComparableEvidenceFact[] {
    if (params.block.kind === 'heading' || params.block.kind === 'code') {
        return [];
    }
    const facts: ComparableEvidenceFact[] = [];
    for (const match of String(params.block.text || '').matchAll(COMPARABLE_NUMERIC_FACT_PATTERN)) {
        const subjectLabel = normalizeWhitespace(match[1]);
        const scopeKeys = comparableFactScopeKeys(
            subjectLabel,
            comparableFactSentenceTail(params.block.text, match)
        );
        const subjectKey = comparableFactSubjectKey(subjectLabel, scopeKeys);
        const value = Number(match[2]);
        const unit = normalizeComparableFactUnit(match[3]);
        if (!subjectKey || !Number.isFinite(value) || !unit) {
            continue;
        }
        facts.push({
            subjectKey,
            subjectLabel,
            valueKey: `${Number(value.toFixed(12))}:${unit}`,
            valueLabel: `${match[2]} ${match[3]}`,
            factKind: 'measurement',
            block: params.block,
            citationIds: params.citationIds,
            item: params.item,
        });
    }
    for (const match of String(params.block.text || '').matchAll(COMPARABLE_QUANTITY_FACT_PATTERN)) {
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
        facts.push({
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
        facts.push({
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
        facts.push({
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
        facts.push({
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
        facts.push({
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
        facts.push({
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
        facts.push({
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
    citationIdsByBlock: Map<string, Set<string>>
): ComparableEvidenceFact[] {
    return entries
        .sort((left, right) => left.block.startOffset - right.block.startOffset)
        .flatMap(({ block, item }) => extractComparableEvidenceFacts({
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
    paragraphWindow: number
): ComparableEvidenceFact[] {
    const blocks = parseMarkdownBlocks(source.content);
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

    return extractComparableEvidenceFactsFromBlockEntries(Array.from(selectedBlocks.values()), citationIdsByBlock);
}

function collectFullDocumentComparableFacts(
    group: DocumentEvidenceGroup,
    source: RagEvidenceSourceDocument
): ComparableEvidenceFact[] {
    const fallbackItem = selectRepresentativeGroupItem(group);
    if (!fallbackItem) {
        return [];
    }
    const blocks = parseMarkdownBlocks(source.content);
    const citationIdsByBlock = buildBlockCitationMap(group, blocks, source);
    const evidenceItemByBlock = buildEvidenceItemMap(group, blocks, source);
    return extractComparableEvidenceFactsFromBlockEntries(
        blocks.map((block) => ({
            block,
            item: evidenceItemByBlock.get(sourceBlockKey(block)) || fallbackItem,
        })),
        citationIdsByBlock
    );
}

function comparableFactDocumentKey(fact: ComparableEvidenceFact): string {
    return `${fact.item.atom.documentId}\n${fact.item.atom.sourcePath}`;
}

function buildConflictFragments(
    group: DocumentEvidenceGroup,
    facts: ComparableEvidenceFact[],
    paragraphWindow: number
): RagEvidenceFragment[] {
    const fragments: RagEvidenceFragment[] = [];
    const seenConflicts = new Set<string>();

    facts.forEach((left, leftIndex) => {
        facts.slice(leftIndex + 1).forEach((right) => {
            if (left.subjectKey !== right.subjectKey || left.factKind !== right.factKind) {
                return;
            }
            if (left.valueKey === right.valueKey) {
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
            fragments.push({
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
            });
        });
    });

    return fragments;
}

function buildCrossDocumentConflictFragments(facts: ComparableEvidenceFact[]): RagEvidenceFragment[] {
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
        orderedFacts.slice(leftIndex + 1).forEach((right) => {
            if (comparableFactDocumentKey(left) === comparableFactDocumentKey(right)) {
                return;
            }
            if (left.subjectKey !== right.subjectKey || left.factKind !== right.factKind) {
                return;
            }
            if (left.valueKey === right.valueKey) {
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
            fragments.push({
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
            });
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
    role: 'direct_support' | 'graph_neighbor_support' = 'direct_support'
): RagEvidenceFragment {
    const text = normalizeWhitespace(String(span.snippet || item.atom.content || item.atom.title || ''));
    return {
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
    };
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
    if (!source || !String(source.content || '').trim()) {
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
    paragraphWindow: number
): RagEvidenceFragment[] {
    const blocks = parseMarkdownBlocks(source.content);
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
        return {
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
        };
    }).filter((fragment) => fragment.text.length > 0);
}

export async function assembleRagEvidenceContext(params: AssembleRagEvidenceContextParams): Promise<RagContextPack> {
    const paragraphWindow = Math.floor(Math.max(0, Math.min(20, Number(params.paragraphWindow ?? DEFAULT_PARAGRAPH_WINDOW))));
    const decisions: RagSourceDecision[] = [];
    const rawFragments: RagEvidenceFragment[] = [];
    const fullDocumentComparableFacts: ComparableEvidenceFact[] = [];
    let readFullDocument = false;

    const groups = groupItemsByDocument(
        Array.isArray(params.items) ? params.items : [],
        Array.isArray(params.graphNeighborItems) ? params.graphNeighborItems : []
    );
    for (const group of groups) {
        group.entries.forEach((entry) => {
            const item = entry.item;
            itemEvidenceSpans(item).forEach((span, spanIndex) => {
                rawFragments.push(buildDirectFragment(item, span, rawFragments.length + spanIndex, entry.directRole));
            });
        });

        const source = await resolveDocumentSource(group, params.sourceResolver);
        if (!source) {
            const unavailableRoles = Array.from(new Set(
                group.entries
                    .map((entry) => entry.directRole)
                    .filter(Boolean)
            )).join(',');
            decisions.push({
                documentId: group.documentId,
                sourcePath: group.sourcePath,
                sourceBoundary: 'direct_span_only',
                status: 'source_window_unavailable',
                reason: unavailableRoles
                    ? `source_resolver_returned_no_content:${unavailableRoles}`
                    : 'source_resolver_returned_no_content',
            });
            continue;
        }
        readFullDocument = true;
        decisions.push({
            documentId: group.documentId,
            sourcePath: group.sourcePath,
            sourceBoundary: 'full_document',
            status: 'read',
            charsRead: source.content.length,
        });
        rawFragments.push(...buildParentFragments(group, source, paragraphWindow));
        const selectedContextComparableFacts = collectSelectedContextComparableFacts(group, source, paragraphWindow);
        fullDocumentComparableFacts.push(...collectFullDocumentComparableFacts(group, source));
        rawFragments.push(...buildConflictFragments(group, selectedContextComparableFacts, paragraphWindow));
    }
    rawFragments.push(...buildCrossDocumentConflictFragments(fullDocumentComparableFacts));

    return buildRagContextPack({
        query: params.query,
        generatedAt: params.generatedAt,
        sourceBoundary: readFullDocument ? 'full_document' : 'direct_span_only',
        fragments: limitGraphNeighborDocumentContextFragments(rawFragments),
        sourceDecisions: decisions,
        budget: params.budget,
    });
}
