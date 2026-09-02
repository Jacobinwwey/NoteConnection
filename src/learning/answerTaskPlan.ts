import type {
    AgentConversationGraphContext,
    AgentConversationKnowledgePoint,
    AnswerSubtask,
    AnswerSubtaskCoverage,
    AnswerTaskCoverageReview,
    AnswerTaskDepth,
    AnswerTaskExpectedOutput,
    AnswerTaskKind,
    AnswerTaskPlan,
    LearningRouteNode,
    LearningRouteOrderingBasis,
    LearningRouteRole,
    RagContextPack,
    RelationKind,
} from './types';

export interface BuildAnswerTaskPlanParams {
    message: string;
    knowledgePoints: AgentConversationKnowledgePoint[];
    graphContext?: AgentConversationGraphContext | null;
    ragContextPack?: RagContextPack;
}

function normalize(value: string): string {
    return String(value || '').replace(/\s+/gu, ' ').trim();
}

function compact(value: string): string {
    return normalize(value)
        .replace(/[^\p{L}\p{N}]+/gu, '')
        .toLowerCase();
}

function isDefinitionRequest(message: string): boolean {
    const normalized = normalize(message).toLowerCase();
    return /\b(?:what\s+is|what'?s|what\s+are|define|definition\s+of|meaning\s+of|explain)\b/u.test(normalized)
        || /什么是|何谓|定义|解释|介绍/u.test(normalized);
}

function isLearningRouteRequest(message: string): boolean {
    const normalized = normalize(message).toLowerCase();
    return /\b(?:learn|learning|study|studying|knowledge\s+points?|learning\s+path|what\s+should\s+i\s+learn|which\s+concepts?)\b/u.test(normalized)
        || /学习|知识点|学习路径|学哪些|先学|应该通过|如何学习|怎么学习/u.test(normalized);
}

function extractSubject(message: string, fallbackTitle: string): string {
    const normalized = normalize(message);
    const match = normalized.match(
        /^(?:what\s+is|what'?s|what\s+are|define|definition\s+of|meaning\s+of|explain)\s+(.+?)(?=\?|？|!|！|\.|,|，|;|；|\b(?:which|what|how|should|learn|study)\b|$)/iu
    ) || normalized.match(
        /^(?:什么是|何谓|解释(?:一下)?|介绍(?:一下)?)\s*(.+?)(?=\?|？|!|！|。|，|,|；|;|我应该|应该通过|通过哪些|哪些知识点|如何学习|怎么学习|$)/u
    );
    const subject = normalize(match?.[1] || fallbackTitle)
        .replace(/^(?:a|an|the)\s+/iu, '')
        .replace(/[?？!！。.,，;；]+$/gu, '')
        .trim() || normalize(fallbackTitle);
    const normalizedFallback = normalize(fallbackTitle);
    return normalizedFallback && compact(subject) === compact(normalizedFallback)
        ? normalizedFallback
        : subject;
}

function resolveDepth(message: string): AnswerTaskDepth {
    const normalized = normalize(message).toLowerCase();
    if (/\b(?:deep|deeply|detailed|detail|comprehensive|in depth)\b/u.test(normalized)
        || /深入|详细|全面|系统/u.test(normalized)) {
        return 'deep';
    }
    if (/\b(?:brief|briefly|short|compact)\b/u.test(normalized)
        || /简要|简短|概括/u.test(normalized)) {
        return 'compact';
    }
    return 'standard';
}

function resolveExpectedOutput(kind: AnswerTaskKind): AnswerTaskExpectedOutput {
    switch (kind) {
        case 'learning_route':
            return 'ordered_nodes';
        case 'comparison':
            return 'comparison_matrix';
        case 'procedure':
        case 'causal_explanation':
            return 'steps';
        default:
            return 'direct_answer';
    }
}

function inferRouteRole(title: string, text: string, isAnchor: boolean): LearningRouteRole {
    if (isAnchor) {
        return 'core';
    }
    const value = `${title} ${text}`.toLowerCase();
    if (/prerequisite|foundation|basic|molecular|hydrogen|water\s+molecule|先修|前置|基础|基本|水分子|氢键/u.test(value)) {
        return 'prerequisite';
    }
    if (/application|use case|performance|measurement|characteri[sz]ation|应用|用例|性能|表征/u.test(value)) {
        return 'application';
    }
    if (/mechanism|formation|structure|radial|distribution|glass|transition|thermal|math|equation|机制|形成|结构|径向|分布|玻璃化|转变|热力学|数学|公式/u.test(value)) {
        return 'mechanism';
    }
    return 'core';
}

function deriveLearningConceptTitle(title: string, text: string): string {
    const normalizedTitle = normalize(title);
    const normalizedText = normalize(text);
    const value = `${normalizedTitle} ${normalizedText}`.toLowerCase();
    if (/(?:核心概念|核心结构|数学基础|key\s+concept|mathematical\s+basis)/iu.test(normalizedTitle)) {
        return '核心结构与数学基础';
    }
    if (/radial\s+distribution\s+function/iu.test(normalizedTitle)) {
        return normalizedTitle;
    }
    if (/(?:core|math|mathemat|数学|核心概念|径向分布|radial|rdf|g\s*\(r\))/u.test(value)) {
        if (/径向分布|radial|rdf|g\s*\(r\)/u.test(value)) {
            return /g\s*\(r\)/u.test(value) ? '径向分布函数 g(r)' : '径向分布函数（RDF）';
        }
        return '核心结构与数学基础';
    }
    if (/(?:technical|specification|density|形态|技术规格|密度|lda|hda|vhda)/u.test(value)) {
        if (/lda|hda|vhda/u.test(value)) {
            return 'LDA / HDA / VHDA 多非晶性';
        }
        return '密度与形态分类';
    }
    if (/(?:application|use\s*case|performance|应用|用例|性能|冷冻电子|cryo)/u.test(value)) {
        return '实验表征与应用';
    }
    if (/(?:implementation|formation|pathway|制备|形成路径|形成方法|算法分析)/u.test(value)) {
        return '形成路径与制备方法';
    }
    if (/(?:property|statistic|structure\s*factor|玻璃化|结构因子|统计度量|性能特征)/u.test(value)) {
        return '结构因子与玻璃化转变';
    }
    return normalizedTitle;
}

function isRouteNoiseTitle(title: string): boolean {
    const normalized = normalize(title);
    return !normalized
        || /preamble|reference|bibliograph|table|mermaid|diagram|code\s+block|参考文献|参考资料|表格|比较模型|comparison model/u.test(normalized);
}

function appendMarkdownSectionCandidates(
    appendCandidate: (candidate: {
        title: string;
        text: string;
        atomId?: string;
        evidenceRefs?: string[];
        orderingBasis?: LearningRouteOrderingBasis;
    }) => void,
    text: string,
    atomId: string | undefined,
    evidenceRefs: string[]
): void {
    const source = String(text || '').replace(/\r\n?/gu, '\n');
    if (!/\n\s*#{1,6}\s+[^\n]+/u.test(source)) {
        return;
    }
    const headings = Array.from(source.matchAll(/(?:^|\n)\s*#{1,6}\s+([^\n]+)\n?/gu))
        .map((heading) => ({
            ...heading,
            1: String(heading[1] || '').replace(/\s+#{1,6}\s+.*$/u, '').trim(),
        }))
        .filter((heading) => heading[1].length > 0 && heading[1].length <= 160);
    if (headings.length <= 0) {
        return;
    }
    headings.forEach((heading, index) => {
        const title = normalize(String(heading[1] || ''));
        const start = (heading.index || 0) + heading[0].length;
        const end = index + 1 < headings.length
            ? (headings[index + 1].index || source.length)
            : source.length;
        const sectionText = normalize(source.slice(start, end));
        appendCandidate({
            title,
            text: sectionText,
            atomId,
            evidenceRefs,
            orderingBasis: 'source_order',
        });
    });
}

function routeReason(
    role: LearningRouteRole,
    title: string,
    orderingBasis: LearningRouteOrderingBasis
): string {
    const basisNote = orderingBasis === 'explicit_prerequisite'
        ? ''
        : orderingBasis === 'explicit_sequence'
            ? '（依据图谱中的显式顺序）'
            : orderingBasis === 'source_order'
                ? '（当前资料顺序，不代表显式前置关系）'
                : '（按资料主题分组，不代表显式前置关系）';
    switch (role) {
        case 'prerequisite':
            return `建立 ${title} 所需的前置概念${basisNote}。`;
        case 'mechanism':
            return `用 ${title} 解释目标概念的结构或形成机制${basisNote}。`;
        case 'application':
            return `用 ${title} 把概念连接到测量、性能或应用${basisNote}。`;
        default:
            return `先掌握 ${title} 的核心定义与边界${basisNote}。`;
    }
}

function collectLearningRoute(
    params: BuildAnswerTaskPlanParams,
    subject: string
): LearningRouteNode[] {
    const subjectKey = compact(subject);
    const candidates: Array<{
        title: string;
        text: string;
        atomId?: string;
        evidenceRefs: string[];
        role: LearningRouteRole;
        orderingBasis: LearningRouteOrderingBasis;
        sourceOrder: number;
    }> = [];
    let sourceOrder = 0;
    const appendCandidate = (candidate: {
        title: string;
        text: string;
        atomId?: string;
        evidenceRefs?: string[];
        role?: LearningRouteRole;
        relationKind?: RelationKind;
        orderingBasis?: LearningRouteOrderingBasis;
    }): void => {
        const rawTitle = normalize(candidate.title);
        const rawKey = compact(rawTitle);
        const isAnchorTitle = Boolean(rawKey && (
            rawKey === subjectKey
            || rawKey.includes(subjectKey)
            || subjectKey.includes(rawKey)
        ));
        const title = isAnchorTitle
            ? rawTitle
            : deriveLearningConceptTitle(rawTitle, candidate.text);
        if (isRouteNoiseTitle(title)) {
            return;
        }
        const key = compact(title);
        if (!key || candidates.some((entry) => compact(entry.title) === key)) {
            return;
        }
        const isAnchor = key === subjectKey || key.includes(subjectKey) || subjectKey.includes(key);
        const evidenceRefs = Array.from(new Set((candidate.evidenceRefs || []).map(normalize).filter(Boolean)));
        if (evidenceRefs.length <= 0 && candidate.atomId) {
            evidenceRefs.push(`atom:${normalize(candidate.atomId)}`);
        }
        candidates.push({
            title,
            text: normalize(candidate.text),
            atomId: normalize(String(candidate.atomId || '')) || undefined,
            evidenceRefs,
            role: candidate.role || inferRouteRole(title, candidate.text, isAnchor),
            orderingBasis: candidate.orderingBasis || (
                candidate.relationKind === 'prerequisite'
                    ? 'explicit_prerequisite'
                    : candidate.relationKind === 'sequence'
                        ? 'explicit_sequence'
                        : 'semantic_grouping'
            ),
            sourceOrder: sourceOrder++,
        });
    };

    params.knowledgePoints.forEach((point) => {
        const pointEvidenceRefs = [
            ...(point.citations || []).map((citation) => citation.citationId),
            point.citation?.citationId || '',
        ];
        appendCandidate({
            title: point.title,
            text: point.summary || point.evidenceSnippet || '',
            atomId: point.atomId,
            evidenceRefs: pointEvidenceRefs,
            orderingBasis: 'source_order',
        });
        appendMarkdownSectionCandidates(
            appendCandidate,
            point.summary || point.evidenceSnippet || '',
            point.atomId,
            pointEvidenceRefs,
        );
        (point.matchedSpans || []).forEach((span) => {
            appendCandidate({
                title: span.title,
                text: span.snippet,
                atomId: span.atomId,
                evidenceRefs: [span.citation?.citationId || ''],
                orderingBasis: 'source_order',
            });
            appendMarkdownSectionCandidates(
                appendCandidate,
                span.snippet,
                span.atomId,
                [span.citation?.citationId || ''],
            );
        });
    });

    (params.ragContextPack?.fragments || [])
        .filter((fragment) => fragment.role !== 'background' && fragment.role !== 'conflict')
        .forEach((fragment) => {
            appendCandidate({
                title: String(fragment.title || ''),
                text: String(fragment.text || ''),
                atomId: fragment.atomId,
                evidenceRefs: Array.isArray(fragment.citationIds) ? fragment.citationIds : [],
                orderingBasis: 'source_order',
            });
            appendMarkdownSectionCandidates(
                appendCandidate,
                String(fragment.text || ''),
                fragment.atomId,
                Array.isArray(fragment.citationIds) ? fragment.citationIds : [],
            );
        });

    const graph = params.graphContext;
    (graph?.predecessorWindow || []).forEach((node) => {
        if (node.relationKind === 'prerequisite' || node.relationKind === 'sequence') {
            appendCandidate({
                title: node.title,
                text: node.relationKind,
                atomId: node.atomId,
                evidenceRefs: [`edge:${node.atomId}:${node.relationKind}`],
                role: 'prerequisite',
                relationKind: node.relationKind,
            });
        }
    });
    (graph?.successorWindow || []).forEach((node) => {
        if (node.relationKind === 'application' || node.relationKind === 'sequence') {
            appendCandidate({
                title: node.title,
                text: node.relationKind,
                atomId: node.atomId,
                evidenceRefs: [`edge:${node.atomId}:${node.relationKind}`],
                role: node.relationKind === 'application' ? 'application' : 'mechanism',
                relationKind: node.relationKind,
            });
        }
    });

    const roleOrder: Record<LearningRouteRole, number> = {
        prerequisite: 10,
        core: 20,
        mechanism: 30,
        application: 40,
    };
    return candidates
        .sort((left, right) => (
            Number(right.orderingBasis === 'explicit_prerequisite') - Number(left.orderingBasis === 'explicit_prerequisite')
            || Number(right.orderingBasis === 'explicit_sequence') - Number(left.orderingBasis === 'explicit_sequence')
            || roleOrder[left.role] - roleOrder[right.role]
            || left.sourceOrder - right.sourceOrder
        ))
        .slice(0, 8)
        .map((candidate, index) => ({
            nodeId: candidate.atomId
                ? `${candidate.atomId}:${compact(candidate.title)}`
                : `route_node_${index + 1}`,
            title: candidate.title,
            role: candidate.role,
            order: index + 1,
            orderingBasis: candidate.orderingBasis,
            evidenceRefs: candidate.evidenceRefs,
            reason: routeReason(candidate.role, candidate.title, candidate.orderingBasis),
        }));
}

function buildSubtasks(message: string, subject: string): AnswerSubtask[] {
    const subtasks: AnswerSubtask[] = [];
    const append = (kind: AnswerTaskKind, required = true): void => {
        if (subtasks.some((subtask) => subtask.kind === kind)) {
            return;
        }
        subtasks.push({
            subtaskId: kind,
            kind,
            subject,
            required,
            expectedOutput: resolveExpectedOutput(kind),
        });
    };
    if (isDefinitionRequest(message)) {
        append('definition');
    }
    if (isLearningRouteRequest(message)) {
        append('learning_route');
    }
    if (subtasks.length <= 0) {
        append('definition', false);
    }
    return subtasks;
}

export function buildAnswerTaskPlan(params: BuildAnswerTaskPlanParams): AnswerTaskPlan {
    const fallbackTitle = normalize(params.knowledgePoints[0]?.title || params.graphContext?.anchorTitle || '');
    const primarySubject = extractSubject(params.message, fallbackTitle);
    const subtasks = buildSubtasks(params.message, primarySubject);
    const learningRoute = subtasks.some((subtask) => subtask.kind === 'learning_route')
        ? collectLearningRoute(params, primarySubject)
        : [];
    return {
        schemaVersion: '1',
        primarySubject,
        subtasks,
        requestedDepth: resolveDepth(params.message),
        learningRoute,
    };
}

function routeRoleLabel(role: LearningRouteRole, useChinese: boolean): string {
    if (useChinese) {
        return {
            prerequisite: '前置',
            core: '核心',
            mechanism: '机制',
            application: '应用',
        }[role];
    }
    return role;
}

export function formatLearningRouteAnswer(
    plan: AnswerTaskPlan | null | undefined,
    useChinese: boolean
): string {
    const route = plan?.learningRoute || [];
    if (route.length <= 0 || !plan?.subtasks.some((subtask) => subtask.kind === 'learning_route')) {
        return '';
    }
    const heading = useChinese ? '### 建议学习路径' : '### Suggested learning path';
    const items = route.map((node) => {
        const title = normalize(node.title);
        const role = routeRoleLabel(node.role, useChinese);
        const reason = normalize(node.reason)
            || routeReason(node.role, title, node.orderingBasis);
        const label = useChinese ? `**${title}**（${role}）` : `**${title}** (${role})`;
        return `${node.order}. ${label}\n   - ${reason}`;
    });
    return `${heading}\n\n${items.join('\n')}`;
}

function normalizeMarkdownLineEndings(value: string): string {
    return String(value || '').replace(/\r\n?/gu, '\n').trim();
}

/**
 * Restores display-math block boundaries after evidence clauses have been
 * normalized into prose. This is intentionally limited to compound task
 * answers; legacy single-deliverable answers retain their existing surface.
 */
export function formatDisplayMathBlocks(value: string): string {
    const source = normalizeMarkdownLineEndings(value);
    if (!source) {
        return '';
    }
    const withBlockBoundaries = source.replace(
        /(?<!\\)\$\$([\s\S]*?)(?<!\\)\$\$/gu,
        (_match, expression: string) => {
            const body = normalizeMarkdownLineEndings(expression);
            return body ? `\n\n$$\n${body}\n$$\n\n` : '';
        }
    );
    return withBlockBoundaries
        .replace(/[ \t]+\n/gu, '\n')
        .replace(/\n{3,}/gu, '\n\n')
        .trim();
}

export function formatTaskAwareAnswer(
    parts: readonly string[],
    plan: AnswerTaskPlan | null | undefined,
    useChinese: boolean
): string {
    const normalizedParts = parts
        .map((part) => normalizeMarkdownLineEndings(part))
        .filter(Boolean);
    const hasLearningRoute = Boolean(
        plan?.subtasks.some((subtask) => subtask.kind === 'learning_route')
        && plan.learningRoute.length > 0
    );
    const joinedBody = normalizedParts.join(useChinese ? '' : ' ');
    const body = /(?<!\\)\$\$/u.test(joinedBody)
        ? formatDisplayMathBlocks(joinedBody)
        : joinedBody;
    if (!hasLearningRoute) {
        return body;
    }
    const route = formatLearningRouteAnswer(plan, useChinese);
    return [body, route].filter(Boolean).join('\n\n').trim();
}

function answerContainsSubject(answer: string, subject: string): boolean {
    const answerKey = compact(answer);
    const subjectKey = compact(subject);
    return Boolean(subjectKey && answerKey.includes(subjectKey));
}

export function reviewAnswerTaskCoverage(
    answer: string,
    plan: AnswerTaskPlan | null | undefined
): AnswerTaskCoverageReview {
    const subtasks = plan?.subtasks || [];
    if (subtasks.length <= 0) {
        return {
            passed: true,
            applicable: false,
            coveredSubtaskIds: [],
            missingRequiredSubtaskIds: [],
            subtaskCoverage: [],
            learningRouteNodeCount: 0,
            coverageScore: 1,
        };
    }
    const route = plan?.learningRoute || [];
    const routeNodeThreshold = Math.max(3, Math.min(5, route.length));
    const routeTitleMatches = route.filter((node) => answerContainsSubject(answer, node.title)).length;
    const coverage: AnswerSubtaskCoverage[] = subtasks.map((subtask) => {
        if (subtask.kind === 'definition') {
            const covered = answerContainsSubject(answer, subtask.subject) && normalize(answer).length >= 12;
            return {
                subtaskId: subtask.subtaskId,
                kind: subtask.kind,
                covered,
                evidenceRefIds: [],
                reason: covered ? undefined : 'definition_subject_missing',
            };
        }
        if (subtask.kind === 'learning_route') {
            const covered = route.length >= 3 && routeTitleMatches >= routeNodeThreshold;
            return {
                subtaskId: subtask.subtaskId,
                kind: subtask.kind,
                covered,
                evidenceRefIds: route.flatMap((node) => node.evidenceRefs),
                reason: covered ? undefined : 'learning_route_nodes_missing_or_unordered',
            };
        }
        const covered = normalize(answer).length >= 12;
        return {
            subtaskId: subtask.subtaskId,
            kind: subtask.kind,
            covered,
            evidenceRefIds: [],
            reason: covered ? undefined : 'answer_empty',
        };
    });
    const required = coverage.filter((entry) => subtasks.find((subtask) => subtask.subtaskId === entry.subtaskId)?.required);
    const covered = required.filter((entry) => entry.covered);
    return {
        passed: required.every((entry) => entry.covered),
        applicable: subtasks.some((subtask) => subtask.required && subtask.kind === 'learning_route') || subtasks.length > 1,
        coveredSubtaskIds: covered.map((entry) => entry.subtaskId),
        missingRequiredSubtaskIds: required.filter((entry) => !entry.covered).map((entry) => entry.subtaskId),
        subtaskCoverage: coverage,
        learningRouteNodeCount: route.length,
        coverageScore: required.length > 0 ? Number((covered.length / required.length).toFixed(4)) : 1,
    };
}
