import type {
    EvidenceSpan,
    KnowledgeQueryItem,
    RagContextBudget,
    RagContextPack,
    RagEvidenceFragment,
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
    item: KnowledgeQueryItem;
    documentId: string;
    sourcePath: string;
    headingPath: string[];
    blocks: SourceBlock[];
    citationIds: Set<string>;
    relationEdgeIds: Set<string>;
    score: number;
}

const DEFAULT_PARAGRAPH_WINDOW = 5;

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

function blocksForEvidence(blocks: SourceBlock[], span: EvidenceSpan, content: string): SourceBlock[] {
    if (spanHasUsableOffsets(span, content.length)) {
        const endOffset = Math.min(span.endOffset, content.length);
        const matches = blocks.filter((block) => block.endOffset >= span.startOffset && block.startOffset <= endOffset);
        if (matches.length > 0) {
            return matches;
        }
    }
    if (Number.isFinite(span.startLine) && Number.isFinite(span.endLine) && span.startLine > 0) {
        const matches = blocks.filter((block) => block.endLine >= span.startLine && block.startLine <= span.endLine);
        if (matches.length > 0) {
            return matches;
        }
    }
    const snippet = normalizeWhitespace(span.snippet);
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

function mergeBlocks(blocks: SourceBlock[]): SourceBlock[] {
    const seen = new Set<string>();
    const merged: SourceBlock[] = [];
    blocks.forEach((block) => {
        const key = `${block.startOffset}:${block.endOffset}:${block.text}`;
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
    graphNeighborItems.forEach((item, index) => appendItem(item, index, 'graph_neighbor_support', false));
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
        .forEach(({ item }) => {
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
            const parentKey = `${group.documentId}\n${group.sourcePath}\n${headingPath.join('/') || 'local_window'}`;
            let draft = parentDrafts.get(parentKey);
            if (!draft) {
                draft = {
                    key: parentKey,
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
        return {
            fragmentId: `rag_parent_${sanitizeFragmentPart(draft.documentId)}_${index + 1}`,
            role: 'parent_context',
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
            decisions.push({
                documentId: group.documentId,
                sourcePath: group.sourcePath,
                sourceBoundary: 'direct_span_only',
                status: 'source_window_unavailable',
                reason: 'source_resolver_returned_no_content',
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
    }

    return buildRagContextPack({
        query: params.query,
        generatedAt: params.generatedAt,
        sourceBoundary: readFullDocument ? 'full_document' : 'direct_span_only',
        fragments: rawFragments,
        sourceDecisions: decisions,
        budget: params.budget,
    });
}
