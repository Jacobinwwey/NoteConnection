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

export interface BuildGraphAnswerPlanParams {
    message: string;
    knowledgePoints: AgentConversationKnowledgePoint[];
    graphContext: AgentConversationGraphContext | null;
    ragContextPack?: RagContextPack;
}

function normalize(value: string): string {
    return String(value || '').replace(/\s+/g, ' ').trim();
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
    const normalizedEvidence = naturalizeRagPublicEvidenceClause(value);
    if (!normalizedEvidence) {
        return [];
    }
    const normalizedTitle = normalize(String(title || '').replace(/\s*\((?:mermaid|code|diagram)\s+block\)\s*$/iu, ''));
    const titleMatchVariants = Array.from(new Set([
        normalizedTitle,
        normalizedTitle.replace(/^\d+(?:\.\d+)*[.、)]?\s*/u, ''),
    ].filter(Boolean)));
    const anchorFeatures = publicClaimAnchorFeatures(message, normalizedTitle);
    const compareBranches = comparisonBranchFeatures(message);
    const compareBranchIdentities = comparisonBranchIdentityTerms(message);
    const candidates = [
        ...segmentRagEvidenceClauses(normalizedEvidence),
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
            const repeatsTitle = remainder.toLowerCase().startsWith(`${matchingTitle.toLowerCase()} `);
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
                || /(?:以及|并且|其中|通常在|范围为|分别为|是|为)$/u.test(clause);
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

function selectComparisonAlignedPublicClaimStatements(
    candidates: ReturnType<typeof rankQualityPublicClaimStatements>
): string[] {
    const maximumComparisonBranchCoverage = candidates.reduce(
        (maximum, candidate) => Math.max(maximum, candidate.comparisonBranchCoverage),
        0
    );
    const branchCompleteCandidates = maximumComparisonBranchCoverage > 0
        ? candidates.filter((candidate) => (
            candidate.comparisonBranchCoverage === maximumComparisonBranchCoverage
            || candidate.comparisonBranchMatchCounts.some((matchCount) => matchCount >= 2)
        ))
        : candidates.filter((candidate) => candidate.anchorMatches > 0);
    return uniquePublicClaimStatements(branchCompleteCandidates);
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
    return uniquePublicClaimStatements(sourceOrderedCandidates.filter((candidate) => acceptedCandidates.includes(candidate)));
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
    const comparisonBranches = comparisonBranchFeatures(params.message);
    const comparisonBranchIdentities = comparisonBranchIdentityTerms(params.message);
    let nextClaimIndex = 0;
    const append = (claim: GraphAnswerClaimPlan) => {
        const key = normalize(claim.statement).toLowerCase();
        if (!key || seen.has(key)) return;
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

    (anchor?.matchedSpans || []).forEach((span, spanIndex) => {
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
    const sortedClaims = claims.sort((left, right) => (
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
    return {
        intent: classifyIntent(params.message),
        depth: sortedClaims.length <= 2 ? 'compact' : sortedClaims.length <= 7 ? 'standard' : 'deep',
        anchorAtomId,
        leadClaimId: sortedClaims[0]?.claimId || '',
        claims: sortedClaims,
        requiredRoles: Array.from(new Set(sortedClaims.filter((claim) => claim.required).map((claim) => claim.role))),
        omittedCandidates,
    };
}
