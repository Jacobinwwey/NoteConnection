import type {
    AgentConversationAssistantBlock,
    AgentConversationKnowledgePoint,
    AgentConversationMemoryAction,
    AgentConversationMemoryRecord,
    KnowledgeAtom,
    KnowledgeCitation,
    KnowledgeQueryItem,
    KnowledgeQueryResolvedScope,
} from './types';

export type BuildAgentWorkspaceCapabilities = (atomId: string) => unknown[];

export type ScopedConversationReplyParams = {
    message: string;
    knowledgePoints: AgentConversationKnowledgePoint[];
    citations: KnowledgeCitation[];
    recalledMemories: AgentConversationMemoryRecord[];
    memoryActions: AgentConversationMemoryAction[];
    usedScope: KnowledgeQueryResolvedScope;
    nextBlockId: () => string;
};

function normalizeWhitespace(value: string): string {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function escapeRegExpLiteral(value: string): string {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildKnowledgeCitation(item: KnowledgeQueryItem, index: number): KnowledgeCitation {
    const atom = item.atom;
    const evidence = item.evidenceSpans[0];
    return {
        citationId: String(evidence?.id || `citation_${atom.id}_${index + 1}`).trim(),
        atomId: atom.id,
        documentId: atom.documentId,
        sourcePath: atom.sourcePath,
        title: atom.title,
        snippet: normalizeWhitespace(String(
            evidence?.snippet
            || atom.content
            || atom.title
            || ''
        ).slice(0, 280)),
        startLine: evidence?.startLine,
        endLine: evidence?.endLine,
        score: Number(Number(item.score || 0).toFixed(4)),
    };
}

function buildAgentConversationKnowledgePoint(
    item: KnowledgeQueryItem,
    index: number,
    buildCapabilities: BuildAgentWorkspaceCapabilities
): AgentConversationKnowledgePoint {
    const atom = item.atom;
    const citation = buildKnowledgeCitation(item, index);
    const summary = normalizeWhitespace(String(atom.content || atom.title || '').slice(0, 240)) || atom.title;
    return {
        atomId: atom.id,
        atomIds: [atom.id],
        documentId: atom.documentId,
        sourcePath: atom.sourcePath,
        title: atom.title,
        summary,
        evidenceSnippet: citation.snippet || summary || atom.title,
        score: Number(Number(item.score || 0).toFixed(4)),
        citation,
        citations: citation ? [citation] : [],
        matchedSpans: [
            {
                atomId: atom.id,
                title: atom.title,
                snippet: citation.snippet || summary || atom.title,
                sourcePath: atom.sourcePath,
                startLine: citation.startLine,
                endLine: citation.endLine,
                score: Number(Number(item.score || 0).toFixed(4)),
                citation,
            },
        ],
        matchCount: 1,
        capabilities: buildCapabilities(atom.id),
    };
}

type KnowledgePointGroup = {
    point: AgentConversationKnowledgePoint;
    atomIds: Set<string>;
    citationKeys: Set<string>;
    spanKeys: Set<string>;
};

export function mergeAgentConversationKnowledgePoints(
    items: KnowledgeQueryItem[],
    buildCapabilities: BuildAgentWorkspaceCapabilities
): AgentConversationKnowledgePoint[] {
    const groups = new Map<string, KnowledgePointGroup>();

    items.forEach((item, index) => {
        const atom = item.atom;
        const groupKey = String(atom.documentId || atom.id || `atom_${index}`).trim();
        const citation = buildKnowledgeCitation(item, index);
        const snippet = citation.snippet
            || normalizeWhitespace(String(atom.content || atom.title || '').slice(0, 280))
            || atom.title;
        let group = groups.get(groupKey);
        if (!group) {
            const point = buildAgentConversationKnowledgePoint(item, index, buildCapabilities);
            point.citation = citation;
            point.citations = [];
            point.matchedSpans = [];
            point.atomIds = [];
            point.matchCount = 0;
            group = {
                point,
                atomIds: new Set<string>(),
                citationKeys: new Set<string>(),
                spanKeys: new Set<string>(),
            };
            groups.set(groupKey, group);
        }

        group.atomIds.add(atom.id);
        group.point.atomIds = Array.from(group.atomIds.values());
        group.point.score = Math.max(group.point.score, Number(Number(item.score || 0).toFixed(4)));

        const citationKey = [
            citation.documentId,
            citation.sourcePath,
            citation.startLine || '',
            citation.endLine || '',
            citation.snippet,
        ].join('|');
        if (!group.citationKeys.has(citationKey)) {
            group.citationKeys.add(citationKey);
            group.point.citations = [...(group.point.citations || []), citation];
            if (!group.point.citation) {
                group.point.citation = citation;
            }
        }

        const spanKey = [
            atom.id,
            citation.startLine || '',
            citation.endLine || '',
            snippet,
        ].join('|');
        if (!group.spanKeys.has(spanKey)) {
            group.spanKeys.add(spanKey);
            group.point.matchedSpans = [
                ...(group.point.matchedSpans || []),
                {
                    atomId: atom.id,
                    title: atom.title,
                    snippet,
                    sourcePath: atom.sourcePath,
                    startLine: citation.startLine,
                    endLine: citation.endLine,
                    score: Number(Number(item.score || 0).toFixed(4)),
                    citation,
                },
            ];
            group.point.matchCount = group.point.matchedSpans.length;
        }
    });

    return Array.from(groups.values()).map((group) => {
        const citations = group.point.citations || [];
        const spans = group.point.matchedSpans || [];
        return {
            ...group.point,
            citation: group.point.citation || citations[0] || null,
            citations,
            matchedSpans: spans,
            matchCount: spans.length,
            evidenceSnippet: spans[0]?.snippet || group.point.evidenceSnippet,
        };
    });
}

export function collectAgentConversationAtomIds(knowledgePoints: AgentConversationKnowledgePoint[]): string[] {
    const atomIds = new Set<string>();
    knowledgePoints.forEach((point) => {
        const groupedAtomIds = Array.isArray(point.atomIds) && point.atomIds.length > 0
            ? point.atomIds
            : [point.atomId];
        groupedAtomIds
            .map((atomId) => String(atomId || '').trim())
            .filter(Boolean)
            .forEach((atomId) => atomIds.add(atomId));
    });
    return Array.from(atomIds.values());
}

function cleanConversationAnswerCandidate(value: string, point: AgentConversationKnowledgePoint): string {
    let cleaned = String(value || '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[*_~`>#|]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const title = normalizeWhitespace(String(point.title || '').replace(/[#*_~`]/g, ' '));
    if (title) {
        cleaned = cleaned
            .replace(new RegExp(`^${escapeRegExpLiteral(title)}\\s*[:\\uFF1A.\\-\\u2014]*\\s*`, 'i'), '')
            .trim();
    }
    return cleaned;
}

function selectScopedConversationDirectSentence(message: string, point: AgentConversationKnowledgePoint): string {
    const candidates = [
        ...(Array.isArray(point.matchedSpans) ? point.matchedSpans.map((span) => span.snippet) : []),
        point.summary,
        point.evidenceSnippet,
    ]
        .map((candidate) => cleanConversationAnswerCandidate(String(candidate || ''), point))
        .filter(Boolean);
    for (const candidate of candidates) {
        const sentences = candidate.match(/[^.!?\u3002\uFF01\uFF1F]+[.!?\u3002\uFF01\uFF1F]?/g) || [candidate];
        const directSentence = sentences
            .map((sentence) => normalizeWhitespace(sentence))
            .find((sentence) => {
                const lower = sentence.toLowerCase();
                return (
                    lower.includes(' is ')
                    || lower.includes(' are ')
                    || lower.includes(' refers to ')
                    || lower.includes(' means ')
                    || sentence.includes('是')
                    || sentence.includes('指')
                ) && sentence.length >= 12;
            });
        if (directSentence) {
            return directSentence;
        }
        const firstSentence = normalizeWhitespace(sentences[0] || '');
        if (firstSentence.length >= 12) {
            return firstSentence;
        }
    }
    return normalizeWhitespace(String(point.summary || point.evidenceSnippet || point.title || message || ''));
}

function classifyScopedConversationIntent(message: string): 'explain' | 'compare' | 'how_to' | 'generic' {
    const normalized = String(message || '').trim().toLowerCase();
    if (!normalized) {
        return 'generic';
    }
    if (
        normalized.includes('compare')
        || normalized.includes('difference')
        || normalized.includes('vs')
        || normalized.includes('区别')
        || normalized.includes('对比')
    ) {
        return 'compare';
    }
    if (
        normalized.includes('how to')
        || normalized.includes('how do')
        || normalized.includes('steps')
        || normalized.includes('plan')
        || normalized.includes('如何')
        || normalized.includes('怎么')
        || normalized.includes('步骤')
        || normalized.includes('方案')
    ) {
        return 'how_to';
    }
    if (
        normalized.includes('what is')
        || normalized.includes('why')
        || normalized.includes('explain')
        || normalized.includes('解释')
        || normalized.includes('什么是')
        || normalized.includes('为什么')
    ) {
        return 'explain';
    }
    return 'generic';
}

function buildScopedConversationAnswer(params: ScopedConversationReplyParams): string {
    if (params.knowledgePoints.length <= 0) {
        const readinessMessage = String(params.usedScope.readiness?.message || '').trim();
        const missMessage = String(params.usedScope.missDiagnostics?.message || '').trim();
        if (params.recalledMemories.length > 0) {
            return `No scoped knowledge points matched "${params.message || 'your query'}", but I recovered ${params.recalledMemories.length} relevant conversation memory note(s). ${missMessage || readinessMessage || 'Refine the corpus scope or use the recalled memory as a follow-up anchor.'}`;
        }
        return `No scoped knowledge points matched "${params.message || 'your query'}". ${missMessage || readinessMessage || 'Refine the scope, add more notes to the corpus, or broaden the query terms.'}`;
    }

    const leadingPoint = params.knowledgePoints[0];
    const directSentence = selectScopedConversationDirectSentence(params.message, leadingPoint);
    const evidenceLines = params.citations.slice(0, 3).map((citation, index) => (
        `${index + 1}. ${citation.title} (${citation.sourcePath}${citation.startLine ? `:${citation.startLine}` : ''}) — ${citation.snippet}`
    ));
    const memoryLine = params.recalledMemories.length > 0
        ? `I also recalled ${params.recalledMemories.length} scoped memory note(s) and kept them secondary to the cited knowledge evidence.`
        : '';
    return [
        directSentence || `${leadingPoint.title}: ${leadingPoint.evidenceSnippet}`,
        memoryLine,
        `Grounded by ${params.knowledgePoints.length} knowledge point(s) and ${params.citations.length} citation(s).`,
        '',
        'Key evidence:',
        ...evidenceLines,
    ].filter((line) => line !== '').join('\n');
}

function buildScopedConversationOverviewMarkdown(params: ScopedConversationReplyParams): string {
    const strongestPoint = params.knowledgePoints[0];
    const lines = [
        '## Scoped Answer',
        '',
    ];
    if (strongestPoint) {
        const directSentence = selectScopedConversationDirectSentence(params.message, strongestPoint);
        if (directSentence) {
            lines.push(directSentence, '');
        }
        lines.push(`Best scoped anchor: **${strongestPoint.title}**.`, '');
    } else {
        lines.push('No scoped knowledge point produced a strong match for the current request.', '');
    }
    lines.push(
        `- Relevant knowledge points: **${params.knowledgePoints.length}**`,
        `- Citations returned: **${params.citations.length}**`,
        `- Scoped memories recalled: **${params.recalledMemories.length}**`
    );
    return lines.join('\n');
}

function buildScopedConversationExplanationMarkdown(params: ScopedConversationReplyParams): string {
    if (params.knowledgePoints.length <= 0) {
        return '## Explanation\n\nThe current scope did not return a strong enough knowledge point to explain the request directly.';
    }
    const intent = classifyScopedConversationIntent(params.message);
    const strongestPoint = params.knowledgePoints[0];
    const explanationLines = [
        '## Explanation',
        '',
    ];
    if (intent === 'compare') {
        explanationLines.push(`Use **${strongestPoint.title}** as the comparison baseline inside the current scope.`);
    } else if (intent === 'how_to') {
        explanationLines.push(`Use **${strongestPoint.title}** as the starting anchor for the next concrete steps.`);
    } else if (intent === 'explain') {
        explanationLines.push(`**${strongestPoint.title}** is the current best scoped anchor for the explanation.`);
    } else {
        explanationLines.push(`**${strongestPoint.title}** is the current best scoped anchor.`);
    }
    const summary = normalizeWhitespace(String(strongestPoint.summary || strongestPoint.evidenceSnippet || '').trim());
    if (summary) {
        explanationLines.push('', summary);
    }
    const supportingTitles = params.knowledgePoints
        .slice(1, 3)
        .map((point) => normalizeWhitespace(String(point.title || '').trim()))
        .filter(Boolean);
    if (supportingTitles.length > 0) {
        explanationLines.push(
            '',
            intent === 'compare'
                ? `Supporting comparison nodes: ${supportingTitles.join(', ')}.`
                : `Supporting scoped nodes: ${supportingTitles.join(', ')}.`
        );
    }
    if (params.recalledMemories.length > 0) {
        explanationLines.push(
            '',
            `Scoped memory recall contributed ${params.recalledMemories.length} prior note(s) to this explanation.`
        );
    }
    if (params.citations.length > 0) {
        explanationLines.push(
            '',
            `The explanation is grounded by ${params.citations.length} citation(s) from the current scope.`
        );
    }
    return explanationLines.join('\n');
}

function buildScopedConversationEvidenceMarkdown(params: ScopedConversationReplyParams): string {
    const evidenceLines = params.citations.slice(0, 3).map((citation, index) => (
        `${index + 1}. **${citation.title}** (${citation.sourcePath}${citation.startLine ? `:${citation.startLine}` : ''})\n   - ${citation.snippet}`
    ));
    if (evidenceLines.length <= 0) {
        return '## Evidence Summary\n\nNo scoped citations were returned.';
    }
    return [
        '## Evidence Summary',
        '',
        ...evidenceLines,
    ].join('\n');
}

function buildScopedConversationMemoryNotice(params: ScopedConversationReplyParams): string {
    if (params.recalledMemories.length <= 0) {
        return 'No scoped memory note was recalled for this turn.';
    }
    if (params.recalledMemories.length === 1) {
        return '1 scoped memory note was recalled and merged into the answer context.';
    }
    return `${params.recalledMemories.length} scoped memory notes were recalled and merged into the answer context.`;
}

function buildScopedConversationActionGuideMarkdown(params: ScopedConversationReplyParams): string {
    if (params.knowledgePoints.length <= 0) {
        return '## Next Actions\n\nNo actionable scoped knowledge card is available for this turn.';
    }
    const intent = classifyScopedConversationIntent(params.message);
    const topTitles = params.knowledgePoints
        .slice(0, 3)
        .map((point) => `- ${point.title}`);
    const actionHints = params.memoryActions
        .slice(0, 2)
        .map((action) => normalizeWhitespace(String(action.reason || '').trim()))
        .filter(Boolean)
        .map((reason) => `- ${reason}`);
    return [
        '## Next Actions',
        '',
        intent === 'compare'
            ? 'Use the scoped knowledge cards below to inspect the strongest nodes side by side before deciding which distinctions matter most:'
            : intent === 'how_to'
                ? 'Use the scoped knowledge cards below to move from explanation into concrete guided-learning or focus-mode steps:'
                : 'Use the scoped knowledge cards below to continue with focus mode or guided learning for the highest-signal nodes:',
        ...topTitles,
        ...(actionHints.length > 0
            ? ['', 'Suggested follow-through from the current turn:', ...actionHints]
            : []),
    ].join('\n');
}

export function buildScopedConversationReply(params: ScopedConversationReplyParams): {
    answer: string;
    assistantBlocks: AgentConversationAssistantBlock[];
} {
    const blocks: AgentConversationAssistantBlock[] = [];
    const answer = buildScopedConversationAnswer(params);
    const overviewMarkdown = buildScopedConversationOverviewMarkdown(params);
    const explanationMarkdown = buildScopedConversationExplanationMarkdown(params);
    const evidenceMarkdown = buildScopedConversationEvidenceMarkdown(params);
    const memoryNotice = buildScopedConversationMemoryNotice(params);
    const actionGuideMarkdown = buildScopedConversationActionGuideMarkdown(params);

    if (overviewMarkdown) {
        blocks.push({
            blockId: params.nextBlockId(),
            type: 'main_markdown',
            markdown: overviewMarkdown,
        });
    }
    if (explanationMarkdown) {
        blocks.push({
            blockId: params.nextBlockId(),
            type: 'main_markdown',
            markdown: explanationMarkdown,
        });
    }
    if (evidenceMarkdown) {
        blocks.push({
            blockId: params.nextBlockId(),
            type: 'main_markdown',
            markdown: evidenceMarkdown,
        });
    }
    if (memoryNotice) {
        blocks.push({
            blockId: params.nextBlockId(),
            type: 'system_notice',
            text: memoryNotice,
        });
    }
    if (params.citations.length > 0) {
        blocks.push({
            blockId: params.nextBlockId(),
            type: 'citations',
            title: 'Citations',
            citations: params.citations.map((citation) => ({ ...citation })),
        });
    }
    if (params.knowledgePoints.length > 0) {
        blocks.push({
            blockId: params.nextBlockId(),
            type: 'main_markdown',
            markdown: actionGuideMarkdown,
        });
        blocks.push({
            blockId: params.nextBlockId(),
            type: 'knowledge_actions',
            title: 'Knowledge Actions',
            atomIds: collectAgentConversationAtomIds(params.knowledgePoints),
        });
    }
    return {
        answer,
        assistantBlocks: blocks,
    };
}
