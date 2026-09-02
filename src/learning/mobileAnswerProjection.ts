import type {
    AgentConversationResponse,
    AnswerTaskPlan,
    KnowledgeCitation,
    MobileAnswerCitation,
    MobileAnswerProjection,
    MobileAnswerRouteNode,
} from './types';

export type { MobileAnswerCitation, MobileAnswerProjection, MobileAnswerRouteNode } from './types';

export const MOBILE_ANSWER_PROJECTION_SCHEMA_VERSION = 1 as const;
const MAX_MOBILE_DIRECT_ANSWER_CHARS = 2400;
const MAX_MOBILE_ROUTE_NODES = 8;
const MAX_MOBILE_CITATIONS = 4;
const MAX_MOBILE_TITLE_CHARS = 160;
const MAX_MOBILE_SOURCE_PATH_CHARS = 320;

function normalize(value: unknown): string {
    return String(value || '').replace(/\s+/gu, ' ').trim();
}

function normalizeMarkdown(value: unknown): string {
    return String(value || '').replace(/\r\n?/gu, '\n').trim();
}

function trimText(value: unknown, limit: number): string {
    const normalized = normalize(value);
    return normalized.length <= limit ? normalized : `${normalized.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

function countDisplayMathDelimiters(value: string): number {
    return (value.match(/(?<!\\)\$\$/gu) || []).length;
}

function trimMarkdown(value: unknown, limit: number): string {
    const normalized = normalizeMarkdown(value);
    if (normalized.length <= limit) {
        return normalized;
    }

    const suffix = '…';
    let candidate = normalized.slice(0, Math.max(0, limit - suffix.length)).trimEnd();
    // Do not publish an answer with an unmatched display-math fence. If a
    // block crosses the mobile byte/character budget, omit that incomplete
    // block rather than asking every client to repair malformed Markdown.
    if (countDisplayMathDelimiters(candidate) % 2 !== 0) {
        const openingIndex = candidate.lastIndexOf('$$');
        candidate = openingIndex >= 0 ? candidate.slice(0, openingIndex).trimEnd() : '';
    }
    return `${candidate}${suffix}`.trim();
}

function stripRouteFromAnswer(answer: string): string {
    const normalized = normalizeMarkdown(answer);
    const headingIndex = normalized.search(
        /(?:^|\n)#{1,6}\s+(?:建议学习路径|推荐学习路径|Suggested learning path)\s*$/imu
    );
    const withoutHeadingRoute = headingIndex >= 0
        ? normalized.slice(0, headingIndex).trimEnd()
        : normalized;
    return withoutHeadingRoute
        .replace(/(?:建议学习路径|推荐学习路径|Suggested learning path)\s*[:：][^\n]*(?:\n[^\n]*)*$/iu, '')
        .replace(/([。.!?])\1+/gu, '$1')
        .trim();
}

function resolveTaskPlan(response: AgentConversationResponse): AnswerTaskPlan | undefined {
    return response.answerTaskPlan
        || response.graphAnswerPlan?.answerTaskPlan
        || response.trace?.answerTaskPlan
        || response.knowledgeRun?.answerTaskPlan;
}

function projectCitation(citation: KnowledgeCitation): MobileAnswerCitation | null {
    const citationId = normalize(citation.citationId);
    const title = trimText(citation.title, MAX_MOBILE_TITLE_CHARS);
    const sourcePath = trimText(citation.sourcePath, MAX_MOBILE_SOURCE_PATH_CHARS);
    if (!citationId || !title || !sourcePath) {
        return null;
    }
    return {
        citationId,
        title,
        sourcePath,
        ...(Number.isFinite(Number(citation.startLine)) ? { startLine: Number(citation.startLine) } : {}),
        ...(Number.isFinite(Number(citation.endLine)) ? { endLine: Number(citation.endLine) } : {}),
    };
}

export function projectAnswerForMobile(response: AgentConversationResponse): MobileAnswerProjection {
    const taskPlan = resolveTaskPlan(response);
    const structuredAnswerBlock = (response.assistantBlocks || [])
        .find((block) => block && block.type === 'structured_answer');
    const directAnswer = trimMarkdown(
        stripRouteFromAnswer(String(
            response.answer
            || response.assistantMessage
            || (structuredAnswerBlock && 'directAnswer' in structuredAnswerBlock
                ? structuredAnswerBlock.directAnswer
                : '')
            || ''
        )),
        MAX_MOBILE_DIRECT_ANSWER_CHARS
    );
    const route = (taskPlan?.learningRoute || [])
        .slice()
        .sort((left, right) => left.order - right.order)
        .slice(0, MAX_MOBILE_ROUTE_NODES)
        .map((node) => ({
            nodeId: trimText(node.nodeId, MAX_MOBILE_TITLE_CHARS),
            title: trimText(node.title, MAX_MOBILE_TITLE_CHARS),
            role: node.role,
            order: Math.max(1, Math.floor(Number(node.order) || 1)),
        }))
        .filter((node) => Boolean(node.nodeId && node.title));
    const citations = (response.citations || [])
        .slice(0, MAX_MOBILE_CITATIONS)
        .map(projectCitation)
        .filter((citation): citation is MobileAnswerCitation => Boolean(citation));
    return {
        schemaVersion: MOBILE_ANSWER_PROJECTION_SCHEMA_VERSION,
        primarySubject: trimText(taskPlan?.primarySubject || '', MAX_MOBILE_TITLE_CHARS),
        directAnswer,
        route,
        citations,
    };
}
