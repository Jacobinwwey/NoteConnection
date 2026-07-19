import type { AgentConversationGraphContext } from './types';

export type GraphAnswerTitleNormalizer = (value: unknown) => string;

export interface GraphAnswerFactSelection {
    anchorAtomId: string;
    anchorTitle: string;
    normalizeTitle: GraphAnswerTitleNormalizer;
}

export interface GraphAnswerFacts {
    anchorTitle: string;
    inDegree: number | null;
    outDegree: number | null;
    predecessorTitles: string[];
    successorTitles: string[];
}

function normalizeAtomId(value: unknown): string {
    return String(value || '').trim();
}

function normalizeComparableTitle(value: string): string {
    return value.toLowerCase();
}

export function collectGraphAnswerWindowTitles(
    graphContext: AgentConversationGraphContext,
    windowKey: 'predecessorWindow' | 'successorWindow',
    selection: GraphAnswerFactSelection,
    limit: number
): string[] {
    const anchorAtomId = normalizeAtomId(selection.anchorAtomId);
    const anchorTitle = normalizeComparableTitle(selection.normalizeTitle(selection.anchorTitle));
    const seen = new Set<string>();
    const titles: string[] = [];
    for (const node of graphContext[windowKey] || []) {
        const atomId = normalizeAtomId(node && node.atomId);
        const title = selection.normalizeTitle(node && node.title);
        const comparableTitle = normalizeComparableTitle(title);
        if (!title || (atomId && atomId === anchorAtomId) || (comparableTitle && comparableTitle === anchorTitle)) {
            continue;
        }
        const key = comparableTitle || atomId;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        titles.push(title);
        if (titles.length >= limit) {
            break;
        }
    }
    return titles;
}

function finiteNumber(value: unknown): number | null {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

export function collectGraphAnswerFacts(
    graphContext: AgentConversationGraphContext | null,
    selection: GraphAnswerFactSelection,
    windowLimit = 2
): GraphAnswerFacts | null {
    if (!graphContext) {
        return null;
    }
    const anchorProfile = graphContext.anchorGraphProfile && typeof graphContext.anchorGraphProfile === 'object'
        ? graphContext.anchorGraphProfile
        : null;
    return {
        anchorTitle: selection.normalizeTitle(selection.anchorTitle),
        inDegree: finiteNumber(anchorProfile?.inDegree),
        outDegree: finiteNumber(anchorProfile?.outDegree),
        predecessorTitles: collectGraphAnswerWindowTitles(graphContext, 'predecessorWindow', selection, windowLimit),
        successorTitles: collectGraphAnswerWindowTitles(graphContext, 'successorWindow', selection, windowLimit),
    };
}
