function normalizeWhitespace(value: string): string {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

const LEADING_SOURCE_LABEL_PATTERN = /^(?:prerequisites?|preconditions?|requirements?|background|context|mechanism|reasoning boundary|downstream checks?|downstream consequences?|failure modes?|mitigation(?: neighbor)?|graph caveat|caveat|evidence|summary|note)\s*[:\uFF1A-]\s*/iu;
const PRESERVED_LEADING_LABEL_PATTERN = /^(?:step|phase|stage|section)\s*\d+\s*[:\uFF1A-]/iu;

export function naturalizeRagPublicEvidenceClause(value: string): string {
    let normalized = normalizeWhitespace(value);
    if (!normalized || PRESERVED_LEADING_LABEL_PATTERN.test(normalized)) {
        return normalized;
    }
    for (let pass = 0; pass < 3; pass += 1) {
        const next = normalizeWhitespace(normalized.replace(LEADING_SOURCE_LABEL_PATTERN, ''));
        if (!next || next === normalized) {
            break;
        }
        normalized = next;
        if (PRESERVED_LEADING_LABEL_PATTERN.test(normalized)) {
            break;
        }
    }
    return normalized;
}

export function shouldRejectCompareProcedureEvidenceClause(value: string, query: string): boolean {
    const normalizedClause = normalizeWhitespace(value).toLowerCase();
    const normalizedQuery = normalizeWhitespace(query).toLowerCase();
    if (!normalizedClause) {
        return false;
    }
    if (/\b(?:procedure|procedural|workflow|runbook|steps?|step\s*\d+|sequence)\b/u.test(normalizedQuery)) {
        return false;
    }
    return /\b(?:procedure|workflow|runbook|steps?|step\s*\d+)\b/u.test(normalizedClause)
        || /\bprocedural\b.{0,80}\bsequence\b/u.test(normalizedClause);
}
