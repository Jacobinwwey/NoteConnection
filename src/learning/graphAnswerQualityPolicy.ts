import { graphClaimSemanticSimilarity, isGraphClaimNegated } from './graphClaimMatcher';

export const GRAPH_ANSWER_QUALITY_POLICY_VERSION = '2026-07-23.v2';
export const SUPPLEMENTAL_DEDUP_SIMILARITY_THRESHOLD = 0.86;
export const MINIMUM_READABILITY_SCORE = 0.5;

// Keep signs and common measurement suffixes in the fact key so distinct values
// cannot be collapsed by lexical similarity alone.
const NUMERIC_FACT_PATTERN = /([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?)(?:\s*(%|°[cfk]|days?|weeks?|months?|years?|milliseconds?|ms|min|hours?|hr|h|seconds?|s|km|cm|mm|nm|um|m|in|ft|yd|mi|kg|mg|lb|oz|kpa|mpa|pa|bar|kj|kw|hz|kb|mb|gb|tb|usd|eur|cny|rmb|c|f|k|g|j|w|v|a|\u6beb\u79d2|\u5206\u949f|\u5c0f\u65f6|\u5929|\u5468|\u6708|\u5e74|\u6beb\u7c73|\u5398\u7c73|\u5343\u7c73|\u7c73|\u6beb\u514b|\u5343\u514b|\u514b|\u5146\u5e15|\u5343\u5e15|\u5e15|\u6444\u6c0f\u5ea6|\u534e\u6c0f\u5ea6|\u5143|\u7f8e\u5143|\u6b27\u5143))?(?![\p{L}\p{N}_])/giu;

function numericFacts(value: string): string[] {
    return Array.from(new Set(
        Array.from(String(value || '').matchAll(NUMERIC_FACT_PATTERN), (match) => (
            `${match[1].toLowerCase()}|${(match[2] || '').toLowerCase()}`
        ))
    )).sort();
}

export function graphClaimsCanShareCoverage(left: string, right: string): boolean {
    if (isGraphClaimNegated(left) !== isGraphClaimNegated(right)) {
        return false;
    }
    const leftNumbers = numericFacts(left);
    const rightNumbers = numericFacts(right);
    if (leftNumbers.length > 0 && rightNumbers.length > 0 && leftNumbers.join('|') !== rightNumbers.join('|')) {
        return false;
    }
    return true;
}

export function isPolaritySafeSemanticDuplicate(left: string, right: string): boolean {
    return graphClaimsCanShareCoverage(left, right)
        && graphClaimSemanticSimilarity(left, right) >= SUPPLEMENTAL_DEDUP_SIMILARITY_THRESHOLD;
}
