export type RagEvidenceClauseQuality = {
    score: number;
    hasTerminalPunctuation: boolean;
    hasBalancedDelimiters: boolean;
    mathDensity: number;
    documentaryPenalty: number;
};

function normalizeWhitespace(value: string): string {
    return String(value || '').replace(/\s+/gu, ' ').trim();
}

function isClauseBoundary(source: string, index: number): boolean {
    const character = source[index];
    if (/\r|\n|;/u.test(character)) {
        return true;
    }
    if (character === '.' && /\d/u.test(source[index - 1] || '') && /\d/u.test(source[index + 1] || '')) {
        return false;
    }
    return /[.!?。！？；]/u.test(character);
}

/**
 * Splits source evidence at discourse boundaries while retaining decimal numbers and
 * mathematical notation. The caller still owns filtering and public-text naturalization.
 */
export function segmentRagEvidenceClauses(value: string): string[] {
    const source = String(value || '');
    if (!source) {
        return [];
    }
    const clauses: string[] = [];
    let start = 0;
    for (let index = 0; index < source.length; index += 1) {
        if (!isClauseBoundary(source, index)) {
            continue;
        }
        const includeBoundary = /[.!?。！？]/u.test(source[index]);
        const clause = normalizeWhitespace(source.slice(start, includeBoundary ? index + 1 : index));
        if (clause) {
            clauses.push(clause);
        }
        start = index + 1;
    }
    const remainder = normalizeWhitespace(source.slice(start));
    if (remainder) {
        clauses.push(remainder);
    }
    return clauses;
}

function delimiterBalance(value: string): boolean {
    const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}', '（': '）', '［': '］', '｛': '｝' };
    const closing = new Set(Object.values(pairs));
    const stack: string[] = [];
    for (const character of value) {
        if (pairs[character]) {
            stack.push(pairs[character]);
        } else if (closing.has(character) && stack.pop() !== character) {
            return false;
        }
    }
    return stack.length === 0;
}

function mathDensity(value: string): number {
    const mathTokens = value.match(/(?:\b\d+(?:\.\d+)?\b|[=<>±×÷∑∫√]|\b(?:sin|cos|log|exp)\b)/giu) || [];
    return Math.min(1, mathTokens.length / Math.max(6, value.length / 24));
}

function documentaryPenalty(value: string): number {
    return /\b(?:this (?:document|section|table)|the following|as requested|we will|must follow|ignore this)\b/iu.test(value)
        || /(?:本文档|下表|如下|按照您的要求|忽略本节)/u.test(value)
        ? 0.35
        : 0;
}

export function scoreRagEvidenceClause(value: string): RagEvidenceClauseQuality {
    const clause = normalizeWhitespace(value);
    const hasTerminalPunctuation = /[.!?。！？]$/u.test(clause);
    const hasBalancedDelimiters = delimiterBalance(clause);
    const density = mathDensity(clause);
    const penalty = documentaryPenalty(clause);
    const lengthScore = clause.length < 8
        ? -0.3
        : clause.length <= 420
            ? 0.25
            : -Math.min(0.25, (clause.length - 420) / 2400);
    const score = Math.max(0, Math.min(1,
        0.35
        + (hasTerminalPunctuation ? 0.15 : -0.08)
        + (hasBalancedDelimiters ? 0.15 : -0.3)
        + Math.min(0.2, density * 0.2)
        + lengthScore
        - penalty
    ));
    return {
        score: Number(score.toFixed(4)),
        hasTerminalPunctuation,
        hasBalancedDelimiters,
        mathDensity: Number(density.toFixed(4)),
        documentaryPenalty: penalty,
    };
}
