import type { GraphAnswerCoverageReview, GraphAnswerPlan } from './types';
import { matchGraphAnswerClaim } from './graphClaimMatcher';

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
        .filter((claim) => {
            const answerKey = String(answer || '').replace(/\s+/gu, '');
            const statementKey = String(claim.statement || '').replace(/\s+/gu, '');
            return Boolean(statementKey && answerKey.includes(statementKey))
                || matchGraphAnswerClaim(answer, claim.statement).covered;
        })
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
