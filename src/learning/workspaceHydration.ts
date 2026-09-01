import * as path from 'path';

export interface KnowledgeSourceInventoryDiff {
    addedSourcePaths: string[];
    removedSourcePaths: string[];
}

export interface MarkdownTitlePreviewMatchInput {
    sourcePath: string;
    preview: string;
    titleLikeQueries: string[];
}

function normalizeLookupQuery(value: unknown): string {
    return String(value || '')
        .normalize('NFKC')
        .replace(/[?？!！。.;；:,，]+/gu, ' ')
        .replace(/\s+/gu, ' ')
        .trim()
        .toLowerCase();
}

function stripDefinitionPredicate(value: string): string {
    return value
        .replace(/^(?:what\s+is|what\s+are|define|explain|tell\s+me\s+about|what's)\s+/iu, '')
        .replace(/^(?:什么是|何谓|解释(?:一下)?|介绍(?:一下)?|请(?:解释|介绍)(?:一下)?)\s*/u, '')
        .trim();
}

/**
 * Extracts bounded title-like variants from a user query. Compound prompts keep
 * their first definition clause so a Chinese subject can resolve an English
 * filename without scanning the whole corpus.
 */
export function deriveKnowledgeTargetLookupQueries(query: string): string[] {
    const source = String(query || '').normalize('NFKC');
    const candidates = new Set<string>();
    const add = (value: string): void => {
        const normalized = normalizeLookupQuery(value);
        if (!normalized) {
            return;
        }
        candidates.add(normalized);
        const stripped = stripDefinitionPredicate(normalized);
        if (stripped) {
            candidates.add(stripped);
            candidates.add(stripped.replace(/\s+/gu, ''));
        }
    };
    add(source);
    source.split(/[?？!！。.;；\n\r]+/gu).forEach(add);

    const definitionSubject = source.match(
        /^(?:what\s+is|what\s+are|define|explain|tell\s+me\s+about|what's|什么是|何谓|解释(?:一下)?|介绍(?:一下)?|请(?:解释|介绍)(?:一下)?)\s*([^?？!！。.;；\n\r]+)/iu
    );
    if (definitionSubject?.[1]) {
        const subject = definitionSubject[1]
            .replace(/\s+(?:我应该|应该|how\s+should|what\s+should).*$/iu, '')
            .trim();
        add(subject);
    }

    if (candidates.has('water glass') || candidates.has('waterglass')) {
        candidates.add('water glass');
        candidates.add('waterglass');
        candidates.add('水玻璃');
        candidates.add('水杯');
    }
    return Array.from(candidates.values()).filter(Boolean);
}

/**
 * Produces the case-folded path key used only for inventory reconciliation.
 * The original spelling is retained in diff output for diagnostics and ingest.
 */
export function normalizeKnowledgeSourcePath(value: unknown): string {
    return String(value || '')
        .normalize('NFKC')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/\/{2,}/g, '/')
        .replace(/\/+$/g, '')
        .toLowerCase();
}

export function buildKnowledgeSourceInventoryDiff(params: {
    diskSourcePaths: ReadonlyArray<string>;
    indexedSourcePaths: ReadonlyArray<string>;
}): KnowledgeSourceInventoryDiff {
    const collect = (sourcePaths: ReadonlyArray<string>): Map<string, string> => {
        const byNormalizedPath = new Map<string, string>();
        sourcePaths.forEach((sourcePath) => {
            const normalized = normalizeKnowledgeSourcePath(sourcePath);
            if (normalized && !byNormalizedPath.has(normalized)) {
                byNormalizedPath.set(normalized, sourcePath);
            }
        });
        return byNormalizedPath;
    };
    const disk = collect(params.diskSourcePaths);
    const indexed = collect(params.indexedSourcePaths);
    const addedSourcePaths = Array.from(disk.entries())
        .filter(([normalizedPath]) => !indexed.has(normalizedPath))
        .map(([, sourcePath]) => sourcePath)
        .sort((left, right) => normalizeKnowledgeSourcePath(left).localeCompare(normalizeKnowledgeSourcePath(right)));
    const removedSourcePaths = Array.from(indexed.entries())
        .filter(([normalizedPath]) => !disk.has(normalizedPath))
        .map(([, sourcePath]) => sourcePath)
        .sort((left, right) => normalizeKnowledgeSourcePath(left).localeCompare(normalizeKnowledgeSourcePath(right)));
    return { addedSourcePaths, removedSourcePaths };
}

function normalizeTitleCandidate(value: unknown): string {
    return String(value || '')
        .normalize('NFKC')
        .replace(/[^\p{L}\p{N}\s_-]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
        .replace(/^(?:the|a|an)\s+/u, '')
        .trim();
}

function collectPreviewTitleCandidates(sourcePath: string, preview: string): string[] {
    const candidates = new Set<string>();
    const basename = path.posix.basename(String(sourcePath || '').replace(/\\/g, '/'))
        .replace(/\.[^.]+$/u, '');
    if (basename) {
        candidates.add(basename);
    }
    String(preview || '').split(/\r?\n/u).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) {
            return;
        }
        const heading = trimmed.match(/^#{1,6}\s+(.+?)\s*#*$/u);
        if (heading?.[1]) {
            candidates.add(heading[1]);
            return;
        }
        if (candidates.size <= 1 && !/^```|^[-*+]\s|^\d+[.)]\s/u.test(trimmed)) {
            candidates.add(trimmed);
        }
    });
    return Array.from(candidates.values()).map(normalizeTitleCandidate).filter(Boolean);
}

export function markdownPreviewMatchesTitleLikeQueries(
    input: MarkdownTitlePreviewMatchInput
): boolean {
    const queries = Array.from(new Set(
        input.titleLikeQueries.map(normalizeTitleCandidate).filter((query) => query.length >= 2)
    ));
    if (queries.length <= 0) {
        return false;
    }
    const candidates = collectPreviewTitleCandidates(input.sourcePath, input.preview);
    return candidates.some((candidate) => queries.some((query) =>
        candidate === query || candidate.includes(query)
    ));
}
