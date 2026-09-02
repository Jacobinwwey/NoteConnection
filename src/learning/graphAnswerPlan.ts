import type {
    AgentConversationGraphContext,
    AgentConversationKnowledgePoint,
    GraphAnswerClaimPlan,
    GraphAnswerPlan,
    GraphAnswerRole,
    RagContextPack,
    RagEvidenceFragment,
    RelationKind,
} from './types';
import {
    extractPublicMermaidEvidenceLabels,
    naturalizeRagPublicEvidenceClause,
    shouldRejectCompareProcedureEvidenceClause,
    shouldRejectPublicEvidenceClause,
} from './ragPublicText';
import { graphClaimSemanticSimilarity, semanticFeatures } from './graphClaimMatcher';
import { graphClaimsCanShareCoverage } from './graphAnswerQualityPolicy';
import { scoreRagEvidenceClause, segmentRagEvidenceClauses } from './ragEvidenceQuality';
import { buildAnswerTaskPlan } from './answerTaskPlan';

export interface BuildGraphAnswerPlanParams {
    message: string;
    knowledgePoints: AgentConversationKnowledgePoint[];
    graphContext: AgentConversationGraphContext | null;
    ragContextPack?: RagContextPack;
}

function normalize(value: string): string {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function isCompoundLearningDefinitionQuery(message: string): boolean {
    const normalized = normalize(message).toLowerCase();
    return classifyIntent(normalized) === 'definition'
        && (
            /\b(?:learn|learning|study|knowledge\s+points?)\b/u.test(normalized)
            || /学习|知识点|学哪些|通过哪些/u.test(normalized)
        );
}

function hasBalancedMathDelimiters(value: string): boolean {
    const source = String(value || '');
    const displayCount = (source.match(/(?<!\\)\$\$/gu) || []).length;
    if (displayCount % 2 !== 0) {
        return false;
    }
    const inlineSource = source.replace(/(?<!\\)\$\$/gu, '');
    return ((inlineSource.match(/(?<!\\)\$/gu) || []).length % 2) === 0;
}

function definitionSubjectFromMessage(message: string): string {
    const normalized = normalize(message);
    const match = normalized.match(
        /^(?:what\s+is|what'?s|what\s+are|define|definition\s+of|meaning\s+of|什么是|何谓|解释(?:一下)?|介绍(?:一下)?|请(?:解释|介绍)(?:一下)?)\s*([^?？!！。.;；\n\r]+)/iu
    );
    if (!match?.[1]) {
        return '';
    }
    return normalize(match[1])
        .replace(/\s+(?:我应该|应该|how\s+should|what\s+should).*$/iu, '')
        .replace(/^(?:a|an|the)\s+/iu, '')
        .trim()
        .toLowerCase();
}

function definitionTitleMatchesSubject(title: string, subject: string): boolean {
    const normalizeTitle = (value: string): string => normalize(value)
        .replace(/\s*\((?:mermaid|code|diagram|formula)\s+block\)\s*$/iu, '')
        .replace(/[^\p{L}\p{N}\s_-]+/gu, ' ')
        .replace(/\s+/gu, '')
        .toLowerCase();
    const normalizedSubject = normalizeTitle(subject);
    const normalizedTitle = normalizeTitle(title);
    return Boolean(normalizedSubject && normalizedTitle && (
        normalizedTitle === normalizedSubject
        || normalizedTitle.includes(normalizedSubject)
    ));
}

function isDefinitionLearningSupportSpan(
    span: NonNullable<AgentConversationKnowledgePoint['matchedSpans']>[number],
    subject: string
): boolean {
    const title = normalize(String(span.title || ''));
    if (!title || /preamble|reference|参考文献|比较模型|comparison|mermaid|code|diagram/iu.test(title)) {
        return false;
    }
    if (definitionTitleMatchesSubject(title, subject)) {
        return true;
    }
    // A compound definition request may include a bounded learning bridge, but
    // chapter titles such as applications, specifications, and comparisons are
    // not definition evidence merely because their text contains a formula.
    return /核心概念|数学|基础|key\s+concept|mathemat|prerequisite|前置|先修|learning\s+path|学习路径/iu.test(title);
}

function extractMathExpressions(value: string): string[] {
    const source = String(value || '');
    const expressions: string[] = [];
    for (const match of source.matchAll(/(?<!\\)\$\$([\s\S]*?)(?<!\\)\$\$/gu)) {
        const expression = normalize(String(match[1] || '')).replace(/\s+/gu, '');
        if (expression) {
            expressions.push(expression);
        }
    }
    const inlineSource = source.replace(/(?<!\\)\$\$([\s\S]*?)(?<!\\)\$\$/gu, '');
    for (const match of inlineSource.matchAll(/(?<!\\)\$([^$\n]+?)(?<!\\)\$/gu)) {
        const expression = normalize(String(match[1] || '')).replace(/\s+/gu, '');
        if (expression) {
            expressions.push(expression);
        }
    }
    return Array.from(new Set(expressions));
}

function statementCarriesMathDelimiter(value: string): boolean {
    const normalized = normalize(value);
    return /(?<!\\)\$\$[\s\S]+?(?<!\\)\$\$|(?<!\\)\$[^$\n]+?(?<!\\)\$/u.test(normalized);
}

function isCompoundDefinitionNoiseClause(value: string): boolean {
    const normalized = normalize(value);
    if (!normalized) {
        return true;
    }
    return /(?:常见用例|应用场景|关键技术规格|技术规格|性能指标|性能特征|比较数学模型|技术比较|流体容器技术比较|本节|本章|下表|参数\s*\(Parameter\)|preamble|reference|comparison|application|use\s+case|technical\s+specification|performance\s+characteristic|table|mermaid|diagram|code\s+block)/iu.test(normalized)
        || /```|\|\s*[^|]+\s*\|/u.test(normalized);
}

function isDefinitionNoiseTitle(value: string): boolean {
    const normalized = normalize(value);
    if (!normalized) {
        return true;
    }
    return /(?:preamble|reference|参考文献|参考资料|comparison|compare|比较|对比|常见用例|应用场景|use\s+case|application\s+scenario|关键技术规格|技术规格|technical\s+specification|性能指标|性能特征|统计度量|performance\s+(?:metric|characteristic)|related\s+technology|相关技术|mermaid|code\s+block|table|表格)/iu.test(normalized);
}

function isDefinitionNoiseClaim(value: string): boolean {
    const normalized = normalize(value);
    return !normalized || /^\d+(?:\.\d+)*[.、)]?$/u.test(normalized);
}

function isCompoundDefinitionMathClause(value: string): boolean {
    const normalized = normalize(value);
    return statementCarriesMathDelimiter(normalized)
        || /(?:径向分布|分布函数|数学|公式|方程|函数|描述|定义|radial\s+distribution|equation|formula|function|mathemat(?:ics|ical))/iu.test(normalized);
}

function selectCompoundDefinitionPublicClaimStatements(
    candidates: ReturnType<typeof rankQualityPublicClaimStatements>
): string[] {
    const eligibleCandidates = candidates
        .filter((candidate) => !candidate.incompleteEnding)
        .filter((candidate) => !isCompoundDefinitionNoiseClause(candidate.clause));
    if (eligibleCandidates.length <= 0) {
        return [];
    }

    // A compound definition has two bounded deliverables: the subject definition
    // and a small mathematical/learning bridge. It must not inherit every clause
    // from a full-document fragment merely because the subject is repeated in
    // later application or comparison sections.
    const selected: typeof eligibleCandidates = [];
    const append = (candidate: typeof eligibleCandidates[number]): void => {
        if (selected.length >= 4 || selected.includes(candidate)) {
            return;
        }
        if (selected.some((entry) => normalize(entry.clause).toLowerCase() === normalize(candidate.clause).toLowerCase())) {
            return;
        }
        selected.push(candidate);
    };

    const subjectCandidates = eligibleCandidates.filter((candidate) => candidate.anchorMatches > 0);
    append(subjectCandidates[0] || eligibleCandidates[0]);
    eligibleCandidates
        .filter((candidate) => isCompoundDefinitionMathClause(candidate.clause))
        .sort((left, right) => left.order - right.order)
        .forEach(append);

    return uniquePublicClaimStatements(selected.sort((left, right) => left.order - right.order));
}

function publicClaimAnchorFeatures(message: string, title?: string): Set<string> {
    return new Set(semanticFeatures(`${message} ${title || ''}`));
}

function comparisonQueryBranches(message: string): string[] {
    const normalizedMessage = normalize(message)
        .toLowerCase()
        .replace(/^(?:compare|contrast|difference\s+between)\s+/u, '')
        .replace(/^(?:比较|对比)\s*/u, '');
    return normalizedMessage
        .split(/\s+(?:and|with|versus|vs\.?)\s+|\s*(?:与|和|跟)\s*/u)
        .map((branch) => normalize(branch))
        .filter(Boolean);
}

function comparisonBranchFeatures(message: string): Array<Set<string>> {
    const branches = comparisonQueryBranches(message)
        .map((branch) => new Set(semanticFeatures(branch)))
        .filter((features) => features.size > 0);
    if (branches.length !== 2) {
        return [];
    }
    const sharedFeatures = new Set(
        Array.from(branches[0]).filter((feature) => branches[1].has(feature))
    );
    return branches.map((features) => {
        const branchSpecificFeatures = new Set(
            Array.from(features).filter((feature) => !sharedFeatures.has(feature))
        );
        return branchSpecificFeatures.size > 0 ? branchSpecificFeatures : features;
    });
}

function comparisonBranchIdentityTerms(message: string): Array<Set<string>> {
    const branches = comparisonQueryBranches(message)
        .map((branch) => new Set(
            (branch.match(/[\p{L}\p{N}]+/gu) || [])
                .map((term) => term.toLowerCase())
                .filter(Boolean)
        ))
        .filter((terms) => terms.size > 0);
    if (branches.length !== 2) {
        return [];
    }
    const sharedTerms = new Set(
        Array.from(branches[0]).filter((term) => branches[1].has(term))
    );
    return branches.map((terms) => {
        const branchSpecificTerms = new Set(
            Array.from(terms).filter((term) => !sharedTerms.has(term))
        );
        return branchSpecificTerms.size > 0 ? branchSpecificTerms : terms;
    });
}

function isTitleDependentComparisonClause(clause: string): boolean {
    return /^(?:(?:it|its|they|their|this|these|such|the former|the latter)\b|(?:其|它|该|这些|这种|前者|后者))/iu.test(normalize(clause));
}

function rankQualityPublicClaimStatements(value: string, title: string | undefined, message: string): Array<{
    clause: string;
    score: number;
    anchorMatches: number;
    comparisonBranchCoverage: number;
    comparisonBranchMatchCounts: number[];
    incompleteEnding: boolean;
    order: number;
}> {
    const rawEvidence = String(value || '');
    if (!normalize(rawEvidence)) {
        return [];
    }
    const normalizedEvidence = naturalizeRagPublicEvidenceClause(rawEvidence);
    const normalizedTitle = normalize(String(title || '').replace(/\s*\((?:mermaid|code|diagram)\s+block\)\s*$/iu, ''));
    const titleMatchVariants = Array.from(new Set([
        normalizedTitle,
        normalizedTitle.replace(/^\d+(?:\.\d+)*[.、)]?\s*/u, ''),
    ].filter(Boolean)));
    const anchorFeatures = publicClaimAnchorFeatures(message, normalizedTitle);
    const compareBranches = comparisonBranchFeatures(message);
    const compareBranchIdentities = comparisonBranchIdentityTerms(message);
    const segmentSource = classifyIntent(message) === 'definition'
        && /(?:^|\r?\n)\s*#{1,6}\s+/u.test(rawEvidence)
        ? rawEvidence
        : normalizedEvidence;
    const candidates = [
        // Segment before whitespace normalization so Markdown headings and
        // display-math blocks remain independent evidence units. Normalizing
        // first would merge an entire document section into one claim.
        ...segmentRagEvidenceClauses(segmentSource),
        ...extractPublicMermaidEvidenceLabels(value),
    ]
        .map((clause) => naturalizeRagPublicEvidenceClause(clause))
        .map((clause) => {
            const matchingTitle = titleMatchVariants.find((variant) => (
                clause.toLowerCase().startsWith(`${variant.toLowerCase()} `)
            ));
            if (!matchingTitle) {
                return clause;
            }
            const remainder = clause.slice(matchingTitle.length).trim();
            const repeatsTitle = remainder.toLowerCase().startsWith(`${matchingTitle.toLowerCase()} `)
                || remainder.toLowerCase().startsWith(matchingTitle.toLowerCase());
            const titleWordCount = matchingTitle.split(/\s+/u).filter(Boolean).length;
            const structuralHeading = /^\d+(?:\.\d+)*[.、)]?\s*/u.test(normalizedTitle)
                || /[:：]/u.test(normalizedTitle)
                || (/[\u3400-\u9fff]/u.test(normalizedTitle) && normalizedTitle.length >= 8);
            return structuralHeading
                || repeatsTitle
                || (titleWordCount > 1 && /^(?:a|an|the)\s+/iu.test(remainder))
                ? remainder
                : clause;
        })
        .filter((clause) => (
            clause
            && !shouldRejectPublicEvidenceClause(clause)
            && !shouldRejectCompareProcedureEvidenceClause(clause, message)
        ))
        .map((clause, order) => {
            const clauseFeatures = new Set(semanticFeatures(clause));
            const anchorMatches = Array.from(clauseFeatures)
                .filter((feature) => anchorFeatures.has(feature))
                .length;
            const comparisonEvidenceText = isTitleDependentComparisonClause(clause) || anchorMatches > 0
                ? `${normalizedTitle} ${clause}`
                : clause;
            const comparisonEvidenceFeatures = new Set(semanticFeatures(comparisonEvidenceText));
            const comparisonEvidenceIdentityTerms = new Set(
                (comparisonEvidenceText.match(/[\p{L}\p{N}]+/gu) || []).map((term) => term.toLowerCase())
            );
            const comparisonBranchMatchCounts = (compareBranches.length === 2 || compareBranchIdentities.length === 2)
                ? [0, 1].map((branchIndex) => Math.max(
                    compareBranches[branchIndex]
                        ? Array.from(compareBranches[branchIndex])
                            .filter((feature) => comparisonEvidenceFeatures.has(feature))
                            .length
                        : 0,
                    compareBranchIdentities[branchIndex]
                        ? Array.from(compareBranchIdentities[branchIndex])
                            .filter((term) => comparisonEvidenceIdentityTerms.has(term))
                            .length
                        : 0
                ))
                : [];
            const comparisonBranchCoverage = comparisonBranchMatchCounts
                .filter((matchCount) => matchCount > 0)
                .length;
            const incompleteEnding = /\b(?:and|or|with|at|in|between|is|are|from|to)$/iu.test(clause)
                || /\b(?:vs|versus)\.?$/iu.test(clause)
                || /[:：]$/u.test(clause)
                || /(?:以及|并且|其中|通常在|范围为|分别为|是|为)$/u.test(clause)
                || !hasBalancedMathDelimiters(clause);
            return {
                clause,
                score: scoreRagEvidenceClause(clause).score + Math.min(0.8, anchorMatches * 0.2) - (incompleteEnding ? 0.5 : 0),
                anchorMatches,
                comparisonBranchCoverage,
                comparisonBranchMatchCounts,
                incompleteEnding,
                order,
            };
        });
    return candidates.sort((left, right) => (
        Number(left.incompleteEnding) - Number(right.incompleteEnding)
        || right.comparisonBranchCoverage - left.comparisonBranchCoverage
        || right.anchorMatches - left.anchorMatches
        || right.score - left.score
        || left.order - right.order
    ));
}

function normalizePublicClaimStatement(value: string): string {
    return value.replace(/(\d)\.\s+(?=\d)/gu, '$1.').trim();
}

function uniquePublicClaimStatements(candidates: ReturnType<typeof rankQualityPublicClaimStatements>): string[] {
    const seen = new Set<string>();
    return candidates
        .map((candidate) => normalizePublicClaimStatement(candidate.clause))
        .filter((clause) => {
            const key = normalize(clause).toLowerCase();
            if (!key || seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
}

function isComparisonDocumentaryClause(value: string): boolean {
    const normalized = normalize(value);
    return /\b(?:preamble|technical\s+document|generated\s+from\s+(?:the\s+)?title|broad\s+background|documentary\s+context|source\s+anchoring)\b/iu.test(normalized)
        || /本文档|本技术文档|仅基于标题|遵从(?:您的)?指示|综合技术文档|上下文段落|后续分支|前置节点/u.test(normalized)
        // Full-document retrieval deliberately reads scaffolding around a fact.
        // It is useful for provenance and conflict discovery, but never a
        // comparison claim in its own right.
        || /\b(?:scoped\s+comparison\s+document|full-document\s+[\w-]+\s+augmentation|opening\s+section\s+is\s+intentionally\s+separate|filler\s+paragraph|keeps?\s+the\s+remote\s+appendix\s+away|remote\s+appendix\s+away\s+from\s+the\s+matched\s+opening)\b/iu.test(normalized);
}

function comparisonClaimIdentityText(claim: GraphAnswerClaimPlan): string {
    const statement = normalize(claim.statement);
    const leadingStatement = statement.split(
        /\b(?:records?|states?|notes?|reports?|indicates?|describes?|explains?|is|are|has|have|contains?|includes?|uses?|provides?)\b/iu
    )[0];
    const sourcePaths = claim.evidenceRefs
        .map((evidence) => normalize(evidence.sourcePath))
        .filter(Boolean);
    return [leadingStatement, ...sourcePaths].filter(Boolean).join(' ');
}

function comparisonClaimBranchMatchCounts(
    claim: GraphAnswerClaimPlan,
    semanticBranches: Array<Set<string>>,
    identityBranches: Array<Set<string>>
): number[] {
    const identityText = comparisonClaimIdentityText(claim);
    const features = new Set(semanticFeatures(identityText));
    const identityTerms = new Set(
        (identityText.match(/[\p{L}\p{N}]+/gu) || []).map((term) => term.toLowerCase())
    );
    return [0, 1].map((branchIndex) => Math.max(
        semanticBranches[branchIndex]
            ? Array.from(semanticBranches[branchIndex]).filter((feature) => features.has(feature)).length
            : 0,
        identityBranches[branchIndex]
            ? Array.from(identityBranches[branchIndex]).filter((term) => identityTerms.has(term)).length
            : 0
    ));
}

function selectComparisonAnswerClaims(
    claims: GraphAnswerClaimPlan[],
    message: string
): GraphAnswerClaimPlan[] {
    const semanticBranches = comparisonBranchFeatures(message);
    const identityBranches = comparisonBranchIdentityTerms(message);
    if (semanticBranches.length !== 2 && identityBranches.length !== 2) {
        return claims;
    }
    const branchMatchThresholds = [0, 1].map((branchIndex) => {
        const identitySize = identityBranches[branchIndex]?.size || 0;
        const semanticSize = semanticBranches[branchIndex]?.size || 0;
        return Math.max(1, Math.min(2, identitySize || semanticSize || 1));
    });
    const candidates = claims.map((claim, index) => ({
        claim,
        index,
        matchCounts: comparisonClaimBranchMatchCounts(claim, semanticBranches, identityBranches),
    }));
    const selected = new Set<GraphAnswerClaimPlan>();
    [0, 1].forEach((branchIndex) => {
        candidates
            .filter((candidate) => candidate.matchCounts[branchIndex] >= branchMatchThresholds[branchIndex])
            .sort((left, right) => (
                right.matchCounts[branchIndex] - left.matchCounts[branchIndex]
                || Number(right.claim.role === 'contrast') - Number(left.claim.role === 'contrast')
                || right.claim.priority - left.claim.priority
                || left.index - right.index
            ))
            .slice(0, 4)
            .forEach((candidate) => selected.add(candidate.claim));
    });
    // A relation-backed contrast claim can be semantically implicit (for example,
    // "the two nodes differ") but is still valid evidence for a compare request.
    candidates
        .filter((candidate) => candidate.claim.role === 'contrast' && candidate.claim.supportingEdgeIds.length > 0)
        .sort((left, right) => right.claim.priority - left.claim.priority || left.index - right.index)
        .slice(0, 2)
        .forEach((candidate) => selected.add(candidate.claim));
    if (selected.size <= 0) {
        return claims;
    }
    return candidates
        .filter((candidate) => selected.has(candidate.claim))
        .sort((left, right) => left.index - right.index)
        .map((candidate) => candidate.claim);
}

function selectComparisonAlignedPublicClaimStatements(
    candidates: ReturnType<typeof rankQualityPublicClaimStatements>
): string[] {
    const eligibleCandidates = candidates.filter((candidate) => !isComparisonDocumentaryClause(candidate.clause));
    const maximumComparisonBranchCoverage = eligibleCandidates.reduce(
        (maximum, candidate) => Math.max(maximum, candidate.comparisonBranchCoverage),
        0
    );
    if (maximumComparisonBranchCoverage >= 2) {
        return uniquePublicClaimStatements(
            eligibleCandidates
                .filter((candidate) => candidate.comparisonBranchCoverage >= 2)
                .slice(0, 8)
        );
    }
    if (maximumComparisonBranchCoverage <= 0) {
        return uniquePublicClaimStatements(eligibleCandidates.filter((candidate) => candidate.anchorMatches > 0).slice(0, 4));
    }

    // When no single clause names both operands (common for Mermaid labels or
    // two separate source documents), retain the strongest bounded evidence for
    // each branch. This prevents a high-scoring preamble/anchor clause from
    // consuming the comparison answer budget while preserving one-sided facts.
    const branchCandidates: typeof eligibleCandidates = [];
    const appendBranchCandidate = (candidate: typeof eligibleCandidates[number]): void => {
        if (branchCandidates.includes(candidate) || branchCandidates.length >= 8) {
            return;
        }
        branchCandidates.push(candidate);
    };
    [0, 1].forEach((branchIndex) => {
        eligibleCandidates
            .filter((candidate) => Number(candidate.comparisonBranchMatchCounts[branchIndex] || 0) > 0)
            .sort((left, right) => (
                Number(right.comparisonBranchMatchCounts[branchIndex] || 0) - Number(left.comparisonBranchMatchCounts[branchIndex] || 0)
                || right.anchorMatches - left.anchorMatches
                || right.score - left.score
                || left.order - right.order
            ))
            .slice(0, 4)
            .forEach(appendBranchCandidate);
    });
    return uniquePublicClaimStatements(branchCandidates.sort((left, right) => left.order - right.order));
}

function isDiscourseContinuation(clause: string): boolean {
    return /^(?:(?:it|its|they|their|this|these|such|therefore|thus|hence|also|additionally|moreover|however|because|thereby|consequently|as a result)\b|(?:其|它|该|这些|这种|同时|此外|因此|所以|由此|并且|而且|其中|随后|进而))/iu.test(normalize(clause));
}

function sharesAcceptedEvidenceContext(
    candidate: ReturnType<typeof rankQualityPublicClaimStatements>[number],
    accepted: ReturnType<typeof rankQualityPublicClaimStatements>
): boolean {
    return accepted.some((acceptedCandidate) => (
        graphClaimSemanticSimilarity(candidate.clause, acceptedCandidate.clause) >= 0.16
    ));
}

function selectQueryConnectedPublicClaimStatements(value: string, title: string | undefined, message: string): string[] {
    const completeCandidates = rankQualityPublicClaimStatements(value, title, message)
        .filter((candidate) => !candidate.incompleteEnding);
    if (completeCandidates.length <= 0) {
        return [];
    }
    const intent = classifyIntent(message);
    if (intent === 'compare') {
        return selectComparisonAlignedPublicClaimStatements(completeCandidates);
    }
    if (intent === 'procedure') {
        return uniquePublicClaimStatements([...completeCandidates].sort((left, right) => left.order - right.order));
    }

    if (isCompoundLearningDefinitionQuery(message)) {
        return selectCompoundDefinitionPublicClaimStatements(completeCandidates);
    }

    const sourceOrderedCandidates = [...completeCandidates].sort((left, right) => left.order - right.order);
    const acceptedCandidates = sourceOrderedCandidates.filter((candidate) => candidate.anchorMatches > 0);
    if (acceptedCandidates.length <= 0) {
        acceptedCandidates.push(completeCandidates[0]);
    }

    let acceptedNewCandidate = true;
    while (acceptedNewCandidate) {
        acceptedNewCandidate = false;
        sourceOrderedCandidates.forEach((candidate, index) => {
            if (acceptedCandidates.includes(candidate)) {
                return;
            }
            const precedingCandidate = sourceOrderedCandidates[index - 1];
            const followsAcceptedEvidence = Boolean(
                precedingCandidate
                && acceptedCandidates.includes(precedingCandidate)
                && isDiscourseContinuation(candidate.clause)
            );
            if (sharesAcceptedEvidenceContext(candidate, acceptedCandidates) || followsAcceptedEvidence) {
                acceptedCandidates.push(candidate);
                acceptedNewCandidate = true;
            }
        });
    }
    const connectedCandidates = sourceOrderedCandidates.filter((candidate) => acceptedCandidates.includes(candidate));
    if (classifyIntent(message) === 'definition') {
        sourceOrderedCandidates
            .filter((candidate) => statementCarriesMathDelimiter(candidate.clause))
            .forEach((candidate) => {
                if (!connectedCandidates.includes(candidate)) {
                    connectedCandidates.push(candidate);
                }
            });
    }
    return uniquePublicClaimStatements(connectedCandidates);
}

function selectContextualPublicClaimStatements(value: string, title: string | undefined, message: string): string[] {
    const completeCandidates = rankQualityPublicClaimStatements(value, title, message)
        .filter((candidate) => !candidate.incompleteEnding);
    if (classifyIntent(message) === 'compare') {
        return selectComparisonAlignedPublicClaimStatements(completeCandidates);
    }
    return uniquePublicClaimStatements([...completeCandidates].sort((left, right) => left.order - right.order));
}

function isComparisonRelationClause(clause: string): boolean {
    return /\b(?:compare|comparison|contrast|difference|differences|compared|versus)\b|对比|比较|差异|区别/iu.test(normalize(clause));
}

function selectContrastRelationPublicClaimStatements(value: string, title: string | undefined, message: string): string[] {
    const completeCandidates = rankQualityPublicClaimStatements(value, title, message)
        .filter((candidate) => !candidate.incompleteEnding);
    if (completeCandidates.length <= 0) {
        return [];
    }
    const branchAlignedStatements = new Set(
        selectComparisonAlignedPublicClaimStatements(completeCandidates)
            .map((statement) => normalize(statement).toLowerCase())
    );
    return uniquePublicClaimStatements(
        completeCandidates.filter((candidate) => (
            branchAlignedStatements.has(normalize(candidate.clause).toLowerCase())
            || isComparisonRelationClause(candidate.clause)
        ))
    );
}

function contextualizeComparisonClaimStatements(
    statements: string[],
    title: string | undefined,
    message: string
): string[] {
    const normalizedTitle = normalize(String(title || '').replace(/\s*\((?:mermaid|code|diagram)\s+block\)\s*$/iu, ''));
    const comparisonBranches = comparisonBranchFeatures(message);
    const comparisonBranchIdentities = comparisonBranchIdentityTerms(message);
    if (!normalizedTitle || (comparisonBranches.length !== 2 && comparisonBranchIdentities.length !== 2)) {
        return statements;
    }
    const titleFeatures = new Set(semanticFeatures(normalizedTitle));
    const titleIdentityTerms = new Set(
        (normalizedTitle.match(/[\p{L}\p{N}]+/gu) || []).map((term) => term.toLowerCase())
    );
    const completesComparisonBranch = (semanticTerms: Set<string>, identityTerms: Set<string>) => [0, 1].some((index) => {
        const semanticBranch = comparisonBranches[index] || new Set<string>();
        const identityBranch = comparisonBranchIdentities[index] || new Set<string>();
        return (
            semanticBranch.size > 0
            && Array.from(semanticBranch).some((feature) => semanticTerms.has(feature))
        ) || (
            identityBranch.size > 0
            && Array.from(identityBranch).some((term) => identityTerms.has(term))
        );
    });
    const titleCompletesBranch = completesComparisonBranch(titleFeatures, titleIdentityTerms);
    if (!titleCompletesBranch) {
        return statements;
    }
    return statements.map((statement) => {
        if (isComparisonRelationClause(statement)) {
            return statement;
        }
        const statementFeatures = new Set(semanticFeatures(statement));
        const statementIdentityTerms = new Set(
            (statement.match(/[\p{L}\p{N}]+/gu) || []).map((term) => term.toLowerCase())
        );
        const statementNamesBranch = completesComparisonBranch(statementFeatures, statementIdentityTerms);
        return statementNamesBranch ? statement : `${normalizedTitle}: ${statement}`;
    });
}

function classifyIntent(message: string): GraphAnswerPlan['intent'] {
    const value = normalize(message).toLowerCase();
    if (/\b(?:compare|contrast|difference|versus|vs)\b/u.test(value) || /区别|对比/u.test(value)) return 'compare';
    if (/\b(?:why|cause|mechanism|reason|consequence)\b/u.test(value) || /为什么|原因|机制|导致/u.test(value)) return 'causal';
    if (/\b(?:how to|steps?|procedure|workflow)\b/u.test(value) || /如何|怎么|步骤/u.test(value)) return 'procedure';
    if (/\b(?:what is|explain|define)\b/u.test(value) || /什么是|解释/u.test(value)) return 'definition';
    return 'generic';
}

function inferRole(title: string, text: string, relationKind?: RelationKind): GraphAnswerRole {
    const value = `${title} ${text}`.toLowerCase();
    if (/\b(?:compare|comparison|compared|contrast|versus)\b|对比|比较|相比/u.test(value)) return 'contrast';
    if (relationKind === 'prerequisite') return 'prerequisite';
    if (relationKind === 'sequence') return 'sequence';
    if (relationKind === 'causal') return 'causal_consequence';
    if (relationKind === 'contrast') return 'contrast';
    if (relationKind === 'analogy') return 'analogy';
    if (relationKind === 'application') return 'application';
    if (/boundary|边界|隔开|separat/u.test(value)) return 'boundary';
    if (/thermal|heat|mechanism|exchange|传热|热交换|机制/u.test(value)) return 'mechanism';
    if (/compos|consist|made of|组成|构成/u.test(value)) return 'composition';
    if (/property|attribute|feature|特征|属性/u.test(value)) return 'attribute';
    return 'definition';
}

function fragmentRelationKind(fragment: RagEvidenceFragment, graphContext: AgentConversationGraphContext | null): RelationKind | undefined {
    const edgeIds = new Set(fragment.relationEdgeIds || []);
    return (graphContext?.knowledgePointRelations || [])
        .find((relation) => edgeIds.has(relation.edgeId))?.relationKind;
}

function makeClaimsFromPublicStatements(params: {
    publicStatements: string[];
    index: number;
    resolveRole: (statement: string) => GraphAnswerRole;
    evidenceText: string;
    anchorAtomId: string;
    atomId?: string;
    sourcePath: string;
    evidenceId: string;
    citationIds?: string[];
    edgeIds?: string[];
    confidence: number;
}): GraphAnswerClaimPlan[] {
    return params.publicStatements.map((publicStatement, statementIndex) => makeClaimFromPublicStatement({
        index: params.index + statementIndex,
        role: params.resolveRole(publicStatement),
        evidenceText: params.evidenceText,
        publicStatement,
        anchorAtomId: params.anchorAtomId,
        atomId: params.atomId,
        sourcePath: params.sourcePath,
        evidenceId: params.evidenceId,
        citationIds: params.citationIds,
        edgeIds: params.edgeIds,
        confidence: params.confidence,
    }));
}

function makeClaimFromPublicStatement(params: {
    index: number;
    role: GraphAnswerRole;
    publicStatement: string;
    evidenceText: string;
    anchorAtomId: string;
    atomId?: string;
    sourcePath: string;
    evidenceId: string;
    citationIds?: string[];
    edgeIds?: string[];
    confidence: number;
}): GraphAnswerClaimPlan {
    return {
        claimId: `graph_claim_${params.index + 1}`,
        role: params.role,
        required: false,
        priority: params.role === 'definition' ? 100 : Math.round(params.confidence * 90),
        statement: params.publicStatement,
        subjectAtomId: params.anchorAtomId,
        supportingAtomIds: params.atomId && params.atomId !== params.anchorAtomId ? [params.atomId] : [],
        supportingEdgeIds: params.edgeIds || [],
        evidenceRefs: [{
            evidenceId: params.evidenceId,
            atomId: params.atomId,
            sourcePath: params.sourcePath,
            citationIds: params.citationIds || [],
            text: params.evidenceText,
        }],
        confidence: Number(Math.max(0, Math.min(1, params.confidence)).toFixed(4)),
    };
}

function makeClaimsFromRagFragment(params: {
    startIndex: number;
    fragment: RagEvidenceFragment;
    relationKind?: RelationKind;
    anchorAtomId: string;
    message: string;
}): GraphAnswerClaimPlan[] {
    const evidenceText = String(params.fragment.text || '').trim();
    const selectedStatements = params.fragment.role === 'direct_support'
        ? selectQueryConnectedPublicClaimStatements(evidenceText, params.fragment.title, params.message)
        : params.relationKind === 'contrast' && classifyIntent(params.message) === 'compare'
            ? selectContrastRelationPublicClaimStatements(evidenceText, params.fragment.title, params.message)
        : selectContextualPublicClaimStatements(evidenceText, params.fragment.title, params.message);
    return makeClaimsFromPublicStatements({
        publicStatements: contextualizeComparisonClaimStatements(
            selectedStatements,
            params.fragment.title,
            params.message
        ),
        index: params.startIndex,
        resolveRole: (statement) => inferRole(params.fragment.title || '', statement, params.relationKind),
        evidenceText,
        anchorAtomId: params.anchorAtomId,
        atomId: params.fragment.atomId,
        sourcePath: params.fragment.sourcePath,
        evidenceId: params.fragment.fragmentId,
        citationIds: params.fragment.citationIds,
        edgeIds: params.fragment.relationEdgeIds,
        confidence: Number(params.fragment.score || 0.75),
    });
}

function makeClaimsFromMatchedSpan(params: {
    startIndex: number;
    span: NonNullable<AgentConversationKnowledgePoint['matchedSpans']>[number];
    anchorAtomId: string;
    message: string;
    leadingSpan: boolean;
}): GraphAnswerClaimPlan[] {
    const evidenceText = String(params.span.snippet || '').trim();
    return makeClaimsFromPublicStatements({
        publicStatements: contextualizeComparisonClaimStatements(
            selectQueryConnectedPublicClaimStatements(evidenceText, params.span.title, params.message),
            params.span.title,
            params.message
        ),
        index: params.startIndex,
        resolveRole: (statement) => (
            params.leadingSpan ? 'definition' : inferRole(params.span.title, statement)
        ),
        evidenceText,
        anchorAtomId: params.anchorAtomId,
        atomId: params.span.atomId,
        sourcePath: params.span.sourcePath,
        evidenceId: params.span.citation?.citationId || `span_${params.span.atomId}_${params.startIndex + 1}`,
        citationIds: params.span.citation ? [params.span.citation.citationId] : [],
        confidence: params.span.score,
    });
}

function extractPredicateFact(statement: string): { subject: string; value: string } | null {
    const normalizedStatement = normalize(statement).replace(/[.!?。！？]+$/u, '');
    const englishMatch = normalizedStatement.match(/^(.+?)\s+(?:is|are|was|were|equals?|remains?|becomes?|uses?|contains?|runs?|stores?|points?\s+to|depends?\s+on|located\s+(?:in|at)|available\s+(?:at|in))\s+(.+)$/iu);
    if (englishMatch) {
        return {
            subject: normalize(englishMatch[1]).toLowerCase(),
            value: normalize(englishMatch[2]).toLowerCase(),
        };
    }
    const chineseMatch = normalizedStatement.match(/^(.+?)(?:是|为|位于|使用|包含|依赖于|指向)(.+)$/u);
    if (chineseMatch) {
        return {
            subject: normalize(chineseMatch[1]).toLowerCase(),
            value: normalize(chineseMatch[2]).toLowerCase(),
        };
    }
    return null;
}

function claimsStateDifferentPredicateValues(left: GraphAnswerClaimPlan, right: GraphAnswerClaimPlan): boolean {
    const leftFact = extractPredicateFact(left.statement);
    const rightFact = extractPredicateFact(right.statement);
    return Boolean(
        leftFact
        && rightFact
        && (
            leftFact.subject === rightFact.subject
            || graphClaimSemanticSimilarity(leftFact.subject, rightFact.subject) >= 0.72
        )
        && leftFact.value !== rightFact.value
    );
}

function claimsCoverDifferentComparisonBranches(
    left: GraphAnswerClaimPlan,
    right: GraphAnswerClaimPlan,
    comparisonBranches: Array<Set<string>>,
    comparisonBranchIdentities: Array<Set<string>>
): boolean {
    if (comparisonBranches.length !== 2 && comparisonBranchIdentities.length !== 2) {
        return false;
    }
    const collectClaimIdentity = (claim: GraphAnswerClaimPlan) => [
        claim.statement,
        ...claim.evidenceRefs.map((evidence) => evidence.sourcePath),
    ].join(' ');
    const leftIdentity = collectClaimIdentity(left);
    const rightIdentity = collectClaimIdentity(right);
    const leftFeatures = new Set(semanticFeatures(leftIdentity));
    const rightFeatures = new Set(semanticFeatures(rightIdentity));
    const leftTerms = new Set((leftIdentity.match(/[\p{L}\p{N}]+/gu) || []).map((term) => term.toLowerCase()));
    const rightTerms = new Set((rightIdentity.match(/[\p{L}\p{N}]+/gu) || []).map((term) => term.toLowerCase()));
    const branchMatches = (features: Set<string>, branch: Set<string>) => (
        Array.from(branch).some((feature) => features.has(feature))
    );
    const branchIdentityMatches = (terms: Set<string>, branch: Set<string>) => (
        Array.from(branch).some((term) => terms.has(term))
    );
    return [0, 1].some((index) => {
        const semanticBranch = comparisonBranches[index] || new Set<string>();
        const identityBranch = comparisonBranchIdentities[index] || new Set<string>();
        return (
            semanticBranch.size > 0
            && branchMatches(leftFeatures, semanticBranch) !== branchMatches(rightFeatures, semanticBranch)
        ) || (
            identityBranch.size > 0
            && branchIdentityMatches(leftTerms, identityBranch) !== branchIdentityMatches(rightTerms, identityBranch)
        );
    });
}

function claimsRequireSeparateCoverage(
    left: GraphAnswerClaimPlan,
    right: GraphAnswerClaimPlan,
    comparisonBranches: Array<Set<string>>,
    comparisonBranchIdentities: Array<Set<string>>
): boolean {
    return claimsStateDifferentPredicateValues(left, right)
        || claimsCoverDifferentComparisonBranches(left, right, comparisonBranches, comparisonBranchIdentities);
}

export function buildGraphAnswerPlan(params: BuildGraphAnswerPlanParams): GraphAnswerPlan {
    const anchor = params.knowledgePoints[0];
    const anchorAtomId = params.graphContext?.anchorAtomId || anchor?.atomId || '';
    const claims: GraphAnswerClaimPlan[] = [];
    const redundantAtomIds = new Set<string>();
    const seen = new Set<string>();
    const seenCompoundMathExpressions = new Set<string>();
    const comparisonBranches = comparisonBranchFeatures(params.message);
    const comparisonBranchIdentities = comparisonBranchIdentityTerms(params.message);
    const definitionIntent = classifyIntent(params.message) === 'definition';
    let nextClaimIndex = 0;
    const append = (claim: GraphAnswerClaimPlan) => {
        const key = normalize(claim.statement).toLowerCase();
        if (!key || seen.has(key) || (definitionIntent && isDefinitionNoiseClaim(claim.statement))) return;
        if (isCompoundLearningDefinitionQuery(params.message)) {
            const mathExpressions = extractMathExpressions(claim.statement);
            if (mathExpressions.length > 0) {
                const allExpressionsSeen = mathExpressions.every((expression) =>
                    seenCompoundMathExpressions.has(expression)
                );
                if (allExpressionsSeen) {
                    return;
                }
                mathExpressions.forEach((expression) => seenCompoundMathExpressions.add(expression));
            }
        }
        const redundantClaim = claims.find((existing) => (
            existing.role === claim.role
            && graphClaimSemanticSimilarity(existing.statement, claim.statement) >= 0.72
            && graphClaimsCanShareCoverage(existing.statement, claim.statement)
            && !claimsRequireSeparateCoverage(existing, claim, comparisonBranches, comparisonBranchIdentities)
        ));
        if (redundantClaim) {
            const redundantAtomId = claim.supportingAtomIds[0] || claim.evidenceRefs[0]?.atomId;
            if (redundantAtomId) redundantAtomIds.add(redundantAtomId);
            return;
        }
        seen.add(key);
        claims.push(claim);
    };

    const matchedSpans = (anchor?.matchedSpans || [])
        .filter((span) => !definitionIntent || !isDefinitionNoiseTitle(String(span.title || '')))
        .filter((span) => !isCompoundLearningDefinitionQuery(params.message)
            || isDefinitionLearningSupportSpan(span, definitionSubjectFromMessage(params.message)))
        .slice(0, definitionIntent ? 8 : Number.MAX_SAFE_INTEGER);
    matchedSpans.forEach((span, spanIndex) => {
        const spanClaims = makeClaimsFromMatchedSpan({
            startIndex: nextClaimIndex,
            span,
            anchorAtomId,
            message: params.message,
            leadingSpan: spanIndex === 0,
        });
        nextClaimIndex += spanClaims.length;
        spanClaims.forEach(append);
    });

    const selectedSupportingAtomIds = new Set(params.graphContext?.supportingAtomIds || []);
    const selectedGraphEdgeIds = new Set(
        (params.graphContext?.knowledgePointRelations || []).map((relation) => relation.edgeId)
    );
    (params.ragContextPack?.fragments || [])
        .filter((fragment) => fragment.role !== 'background')
        .filter((fragment) => !definitionIntent || !isDefinitionNoiseTitle(String(fragment.title || '')))
        .filter((fragment) => !isCompoundLearningDefinitionQuery(params.message)
            || isDefinitionLearningSupportSpan({
                title: String(fragment.title || ''),
                snippet: String(fragment.text || ''),
            } as NonNullable<AgentConversationKnowledgePoint['matchedSpans']>[number], definitionSubjectFromMessage(params.message)))
        .filter((fragment) => (
            fragment.role !== 'graph_neighbor_support'
            || selectedSupportingAtomIds.size <= 0
            || Boolean(fragment.atomId && selectedSupportingAtomIds.has(fragment.atomId))
            || (fragment.relationEdgeIds || []).some((edgeId) => selectedGraphEdgeIds.has(edgeId))
        ))
        .forEach((fragment) => {
            const relationKind = fragmentRelationKind(fragment, params.graphContext);
            const fragmentClaims = makeClaimsFromRagFragment({
                startIndex: nextClaimIndex,
                fragment,
                relationKind,
                anchorAtomId,
                message: params.message,
            });
            nextClaimIndex += fragmentClaims.length;
            fragmentClaims.forEach(append);
        });

    if (claims.length === 0 && anchor) {
        const evidenceText = String(anchor.evidenceSnippet || anchor.summary || '').trim();
        const fallbackClaims = makeClaimsFromPublicStatements({
            publicStatements: contextualizeComparisonClaimStatements(
                selectQueryConnectedPublicClaimStatements(evidenceText, anchor.title, params.message),
                anchor.title,
                params.message
            ),
            index: nextClaimIndex,
            resolveRole: () => 'definition',
            evidenceText,
            anchorAtomId,
            atomId: anchor.atomId,
            sourcePath: anchor.sourcePath || anchor.citation?.sourcePath || '',
            evidenceId: anchor.citation?.citationId || `point_${anchor.atomId}`,
            citationIds: anchor.citation ? [anchor.citation.citationId] : [],
            confidence: anchor.score,
        });
        nextClaimIndex += fallbackClaims.length;
        fallbackClaims.forEach(append);
    }

    const evidencedAtomIds = new Set(claims.flatMap((claim) => claim.supportingAtomIds));
    const omittedCandidates = [
        ...Array.from(redundantAtomIds).map((atomId) => ({ atomId, reason: 'redundant' as const })),
        ...[
            ...(params.graphContext?.predecessorWindow || []),
            ...(params.graphContext?.successorWindow || []),
        ].map((node) => ({ atomId: node.atomId, reason: 'weak_evidence' as const })),
    ]
        .filter((node) => node.atomId !== anchorAtomId && !evidencedAtomIds.has(node.atomId))
        .filter((node, index, nodes) => nodes.findIndex((candidate) => candidate.atomId === node.atomId) === index);
    const boundedClaims = classifyIntent(params.message) === 'compare'
        ? selectComparisonAnswerClaims(claims, params.message)
        : claims;
    const roleOrder: Record<GraphAnswerRole, number> = {
        definition: 10,
        composition: 20,
        boundary: 30,
        attribute: 40,
        prerequisite: 50,
        mechanism: 60,
        causal_consequence: 70,
        sequence: 80,
        application: 90,
        contrast: 100,
        analogy: 110,
        temporal_warning: 120,
    };
    const sortedClaims = boundedClaims.sort((left, right) => (
        roleOrder[left.role] - roleOrder[right.role]
        || right.priority - left.priority
    ));
    sortedClaims.forEach((claim) => {
        // The upstream evidence pack is already bounded. At this boundary, novelty and
        // confidence determine coverage; role cardinality does not imply redundancy.
        claim.required = claim.confidence > 0.75;
    });
    if (!sortedClaims.some((claim) => claim.required) && sortedClaims.length > 0) {
        sortedClaims[0].required = true;
    }
    const answerTaskPlan = buildAnswerTaskPlan({
        message: params.message,
        knowledgePoints: params.knowledgePoints,
        graphContext: params.graphContext,
        ragContextPack: params.ragContextPack,
    });
    return {
        intent: classifyIntent(params.message),
        depth: sortedClaims.length <= 2 ? 'compact' : sortedClaims.length <= 7 ? 'standard' : 'deep',
        anchorAtomId,
        leadClaimId: sortedClaims[0]?.claimId || '',
        claims: sortedClaims,
        requiredRoles: Array.from(new Set(sortedClaims.filter((claim) => claim.required).map((claim) => claim.role))),
        answerTaskPlan,
        omittedCandidates,
    };
}
