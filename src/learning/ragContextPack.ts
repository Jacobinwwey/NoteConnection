import { createHash } from 'crypto';
import type {
    RagContextBudget,
    RagContextPack,
    RagEvidenceFragment,
    RagEvidenceRole,
    RagSourceBoundary,
    RagSourceDecision,
} from './types';

export interface BuildRagContextPackParams {
    query: string;
    fragments: RagEvidenceFragment[];
    sourceDecisions?: RagSourceDecision[];
    budget?: Partial<RagContextBudget>;
    generatedAt?: string;
    sourceBoundary?: RagSourceBoundary;
}

export const DEFAULT_RAG_CONTEXT_BUDGET: RagContextBudget = {
    maxFragments: 16,
    maxCharsPerFragment: 1600,
    maxTotalChars: 6400,
};

const ROLE_PRIORITY: Record<RagEvidenceRole, number> = {
    direct_support: 0,
    conflict: 1,
    graph_neighbor_support: 2,
    parent_context: 3,
    adjacent_context: 4,
    background: 5,
};

export function normalizeRagContextBudget(input?: Partial<RagContextBudget>): RagContextBudget {
    const numberOrDefault = (value: unknown, fallback: number, min: number, max: number): number => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return fallback;
        }
        return Math.floor(Math.max(min, Math.min(max, numeric)));
    };
    return {
        maxFragments: numberOrDefault(input?.maxFragments, DEFAULT_RAG_CONTEXT_BUDGET.maxFragments, 1, 200),
        maxCharsPerFragment: numberOrDefault(
            input?.maxCharsPerFragment,
            DEFAULT_RAG_CONTEXT_BUDGET.maxCharsPerFragment,
            80,
            20000
        ),
        maxTotalChars: numberOrDefault(input?.maxTotalChars, DEFAULT_RAG_CONTEXT_BUDGET.maxTotalChars, 120, 100000),
    };
}

export function estimateRagTokenCount(text: string): number {
    const normalized = String(text || '').trim();
    if (!normalized) {
        return 0;
    }
    return Math.max(1, Math.ceil(normalized.length / 4));
}

function truncateMiddle(text: string, maxChars: number): { text: string; truncated: boolean } {
    const source = String(text || '');
    if (source.length <= maxChars) {
        return { text: source, truncated: false };
    }
    if (maxChars <= 16) {
        return { text: source.slice(0, maxChars), truncated: true };
    }
    const marker = '\n[...]\n';
    const available = Math.max(0, maxChars - marker.length);
    const headLength = Math.ceil(available * 0.6);
    const tailLength = Math.floor(available * 0.4);
    return {
        text: `${source.slice(0, headLength).trimEnd()}${marker}${source.slice(source.length - tailLength).trimStart()}`,
        truncated: true,
    };
}

function withBudgetedText(
    fragment: RagEvidenceFragment,
    maxChars: number,
    reason: string
): RagEvidenceFragment {
    const truncated = truncateMiddle(fragment.text, maxChars);
    const text = truncated.text;
    return {
        ...fragment,
        text,
        charCount: text.length,
        tokenEstimate: estimateRagTokenCount(text),
        truncated: fragment.truncated || truncated.truncated,
        truncationReason: truncated.truncated ? reason : fragment.truncationReason,
    };
}

function rolePriority(fragment: RagEvidenceFragment): number {
    return ROLE_PRIORITY[fragment.role] ?? ROLE_PRIORITY.background;
}

function sortFragmentsForBudget(fragments: RagEvidenceFragment[]): RagEvidenceFragment[] {
    return fragments
        .map((fragment, index) => ({ fragment, index }))
        .sort((a, b) => {
            const priorityDelta = rolePriority(a.fragment) - rolePriority(b.fragment);
            if (priorityDelta !== 0) {
                return priorityDelta;
            }
            const scoreDelta = Number(b.fragment.score || 0) - Number(a.fragment.score || 0);
            if (Math.abs(scoreDelta) > 0.0001) {
                return scoreDelta;
            }
            return a.index - b.index;
        })
        .map((entry) => entry.fragment);
}

function applyContextBudget(
    fragments: RagEvidenceFragment[],
    budget: RagContextBudget,
    decisions: RagSourceDecision[]
): RagEvidenceFragment[] {
    const selected: RagEvidenceFragment[] = [];
    let usedChars = 0;
    sortFragmentsForBudget(fragments).forEach((fragment) => {
        if (selected.length >= budget.maxFragments) {
            decisions.push({
                documentId: fragment.documentId,
                sourcePath: fragment.sourcePath,
                sourceBoundary: fragment.sourceBoundary,
                status: 'fragment_dropped',
                reason: 'max_fragments_exceeded',
            });
            return;
        }
        let candidate = withBudgetedText(fragment, budget.maxCharsPerFragment, 'max_chars_per_fragment_exceeded');
        const remainingChars = budget.maxTotalChars - usedChars;
        if (remainingChars <= 0) {
            decisions.push({
                documentId: fragment.documentId,
                sourcePath: fragment.sourcePath,
                sourceBoundary: fragment.sourceBoundary,
                status: 'fragment_dropped',
                reason: 'max_total_chars_exceeded',
            });
            return;
        }
        if (candidate.charCount > remainingChars) {
            if (remainingChars < 80 && candidate.role !== 'direct_support') {
                decisions.push({
                    documentId: fragment.documentId,
                    sourcePath: fragment.sourcePath,
                    sourceBoundary: fragment.sourceBoundary,
                    status: 'fragment_dropped',
                    reason: 'remaining_context_budget_too_small',
                });
                return;
            }
            candidate = withBudgetedText(candidate, remainingChars, 'max_total_chars_exceeded');
        }
        selected.push(candidate);
        usedChars += candidate.charCount;
        decisions.push({
            documentId: candidate.documentId,
            sourcePath: candidate.sourcePath,
            sourceBoundary: candidate.sourceBoundary,
            status: candidate.truncated ? 'fragment_truncated' : 'fragment_included',
            reason: candidate.truncationReason,
        });
    });
    return selected;
}

function resolveSourceBoundary(
    requestedBoundary: RagSourceBoundary | undefined,
    fragments: RagEvidenceFragment[]
): RagSourceBoundary {
    if (requestedBoundary) {
        return requestedBoundary;
    }
    return fragments.some((fragment) => fragment.sourceBoundary === 'full_document')
        ? 'full_document'
        : 'direct_span_only';
}

function annotateReadDecisions(decisions: RagSourceDecision[], fragments: RagEvidenceFragment[]): void {
    const fragmentCountsByDocument = fragments.reduce((counts, fragment) => {
        const previous = counts.get(fragment.documentId) || 0;
        counts.set(fragment.documentId, previous + 1);
        return counts;
    }, new Map<string, number>());
    decisions.forEach((decision) => {
        if (decision.status === 'read') {
            decision.fragmentsSelected = fragmentCountsByDocument.get(decision.documentId) || 0;
        }
    });
}

function sortedStrings(values: string[] | undefined): string[] {
    return normalizedStrings(values).sort();
}

function normalizedStrings(values: string[] | undefined): string[] {
    return (Array.isArray(values) ? values : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean);
}

function buildRagContextReplayId(params: {
    query: string;
    sourceBoundary: RagSourceBoundary;
    budget: RagContextBudget;
    fragments: RagEvidenceFragment[];
    sourceDecisions: RagSourceDecision[];
    totalCharCount: number;
    tokenEstimate: number;
}): string {
    const payload = {
        query: params.query,
        sourceBoundary: params.sourceBoundary,
        budget: params.budget,
        totalCharCount: params.totalCharCount,
        tokenEstimate: params.tokenEstimate,
        fragments: params.fragments
            .map((fragment) => ({
                fragmentId: fragment.fragmentId,
                role: fragment.role,
                documentId: fragment.documentId,
                sourcePath: fragment.sourcePath,
                atomId: fragment.atomId || '',
                title: fragment.title || '',
                headingPath: normalizedStrings(fragment.headingPath),
                citationIds: sortedStrings(fragment.citationIds),
                relationEdgeIds: sortedStrings(fragment.relationEdgeIds),
                sourceBoundary: fragment.sourceBoundary,
                startOffset: fragment.startOffset ?? null,
                endOffset: fragment.endOffset ?? null,
                startLine: fragment.startLine ?? null,
                endLine: fragment.endLine ?? null,
                truncated: fragment.truncated,
                truncationReason: fragment.truncationReason || '',
                text: fragment.text,
            }))
            .sort((left, right) => [
                left.role.localeCompare(right.role),
                left.documentId.localeCompare(right.documentId),
                left.fragmentId.localeCompare(right.fragmentId),
                left.text.localeCompare(right.text),
            ].find((delta) => delta !== 0) || 0),
        sourceDecisions: params.sourceDecisions
            .map((decision) => ({
                documentId: decision.documentId,
                sourcePath: decision.sourcePath,
                sourceBoundary: decision.sourceBoundary,
                status: decision.status,
                reason: decision.reason || '',
                charsRead: decision.charsRead ?? null,
                fragmentsSelected: decision.fragmentsSelected ?? null,
            }))
            .sort((left, right) => [
                left.documentId.localeCompare(right.documentId),
                left.sourcePath.localeCompare(right.sourcePath),
                left.sourceBoundary.localeCompare(right.sourceBoundary),
                left.status.localeCompare(right.status),
                left.reason.localeCompare(right.reason),
            ].find((delta) => delta !== 0) || 0),
    };
    const digest = createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('hex')
        .slice(0, 16);
    return `ragctx_${digest}`;
}

export function buildRagContextPack(params: BuildRagContextPackParams): RagContextPack {
    const budget = normalizeRagContextBudget(params.budget);
    const decisions = Array.isArray(params.sourceDecisions)
        ? params.sourceDecisions.map((decision) => ({ ...decision }))
        : [];
    const fragments = Array.isArray(params.fragments) ? params.fragments.filter(Boolean) : [];
    const selectedFragments = applyContextBudget(fragments, budget, decisions);
    annotateReadDecisions(decisions, selectedFragments);
    const totalCharCount = selectedFragments.reduce((sum, fragment) => sum + fragment.charCount, 0);
    const tokenEstimate = selectedFragments.reduce((sum, fragment) => sum + fragment.tokenEstimate, 0);
    const query = String(params.query || '');
    const sourceBoundary = resolveSourceBoundary(params.sourceBoundary, selectedFragments);

    return {
        replayId: buildRagContextReplayId({
            query,
            sourceBoundary,
            budget,
            fragments: selectedFragments,
            sourceDecisions: decisions,
            totalCharCount,
            tokenEstimate,
        }),
        query,
        generatedAt: String(params.generatedAt || new Date().toISOString()),
        sourceBoundary,
        budget,
        fragments: selectedFragments,
        sourceDecisions: decisions,
        totalCharCount,
        tokenEstimate,
    };
}
