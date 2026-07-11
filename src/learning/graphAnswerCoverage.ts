import type { GraphAnswerCoverageReview, GraphAnswerPlan } from './types';

const COVERAGE_STOPWORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'between', 'by', 'for', 'from', 'in', 'is', 'it',
    'of', 'on', 'or', 'that', 'the', 'their', 'this', 'through', 'to', 'with', 'its',
]);

function normalize(value: string): string {
    return String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

function semanticTerms(value: string): string[] {
    return Array.from(new Set(
        normalize(value)
            .split(' ')
            .filter((term) => term.length >= 2 && !COVERAGE_STOPWORDS.has(term))
    ));
}

function claimIsCovered(answer: string, statement: string): boolean {
    const normalizedAnswer = normalize(answer);
    const normalizedStatement = normalize(statement);
    if (!normalizedStatement) return false;
    if (normalizedAnswer.includes(normalizedStatement)) return true;
    const terms = semanticTerms(statement);
    if (terms.length === 0) return false;
    const matched = terms.filter((term) => normalizedAnswer.includes(term));
    const requiredMatches = Math.min(terms.length, Math.max(3, Math.ceil(terms.length * 0.55)));
    return matched.length >= requiredMatches;
}

export function reviewGraphAnswerCoverage(
    answer: string,
    plan: GraphAnswerPlan | null | undefined
): GraphAnswerCoverageReview {
    const requiredClaims = (plan?.claims || []).filter((claim) => claim.required);
    if (requiredClaims.length === 0) {
        return {
            passed: true,
            applicable: false,
            requiredClaimIds: [],
            coveredClaimIds: [],
            missingRequiredClaimIds: [],
            coverageScore: 1,
        };
    }
    const coveredClaimIds = requiredClaims
        .filter((claim) => claimIsCovered(answer, claim.statement))
        .map((claim) => claim.claimId);
    const covered = new Set(coveredClaimIds);
    const missingRequiredClaimIds = requiredClaims
        .filter((claim) => !covered.has(claim.claimId))
        .map((claim) => claim.claimId);
    return {
        passed: missingRequiredClaimIds.length === 0,
        applicable: true,
        requiredClaimIds: requiredClaims.map((claim) => claim.claimId),
        coveredClaimIds,
        missingRequiredClaimIds,
        coverageScore: Number((coveredClaimIds.length / requiredClaims.length).toFixed(4)),
    };
}
