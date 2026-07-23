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

export function formatGraphAnswerProfileSentence(facts: GraphAnswerFacts, useChinese: boolean): string {
    const { anchorTitle, predecessorTitles, successorTitles } = facts;
    const degreeParts: string[] = [];
    if (facts.inDegree !== null) {
        degreeParts.push(useChinese ? `入度为 ${facts.inDegree}` : `${facts.inDegree} incoming`);
    }
    if (facts.outDegree !== null) {
        degreeParts.push(useChinese ? `出度为 ${facts.outDegree}` : `${facts.outDegree} outgoing`);
    }
    if (degreeParts.length <= 0 && predecessorTitles.length <= 0 && successorTitles.length <= 0) {
        return '';
    }
    if (useChinese) {
        const fragments: string[] = [];
        if (degreeParts.length > 0) {
            fragments.push(`${anchorTitle || '当前锚点'}在当前图中的${degreeParts.join('，')}`);
        }
        if (predecessorTitles.length > 0) {
            fragments.push(`紧邻前置节点包括 ${predecessorTitles.join('、')}`);
        }
        if (successorTitles.length > 0) {
            fragments.push(`后续分支包括 ${successorTitles.join('、')}`);
        }
        return fragments.join('，');
    }
    const fragments: string[] = [];
    if (degreeParts.length > 0) {
        fragments.push(`${anchorTitle || 'The current anchor'} has ${degreeParts.join(' and ')} links in the current graph`);
    }
    if (predecessorTitles.length > 0 && successorTitles.length > 0) {
        fragments.push(`The graph connects this topic to upstream evidence from ${predecessorTitles.join(', ')} and downstream evidence from ${successorTitles.join(', ')}`);
    } else if (predecessorTitles.length > 0) {
        fragments.push(`The graph connects this topic to upstream evidence from ${predecessorTitles.join(', ')}`);
    } else if (successorTitles.length > 0) {
        fragments.push(`The graph connects this topic to downstream evidence from ${successorTitles.join(', ')}`);
    }
    return fragments.join('; ');
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
