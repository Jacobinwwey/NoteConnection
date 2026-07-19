function normalizeWhitespace(value: string): string {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

const LEADING_SOURCE_LABEL_PATTERN = /^(?:(?:prerequisites?|preconditions?|requirements?|background|context|mechanism|reasoning boundary|downstream checks?|downstream consequences?|failure modes?|mitigation(?: neighbor)?|graph caveat|caveat|evidence|summary|note|material science)\s*[:\uFF1A-]\s*|(?:核心概念(?:及其数学基础)?|材料科学|技术参数)(?:\s*[:\uFF1A-]\s*|\s+))/iu;
const PRESERVED_LEADING_LABEL_PATTERN = /^(?:step|phase|stage|section)\s*\d+\s*[:\uFF1A-]/iu;

export function naturalizeRagPublicEvidenceClause(value: string): string {
    let normalized = normalizeWhitespace(
        String(value || '')
            .replace(/```[\s\S]*?```/gu, ' ')
            .replace(/```[\s\S]*$/u, ' ')
            .replace(/^\s*[-+*]\s+/gmu, '')
            .replace(/\s+\*\s+(?=\$|\*\*|[\u3400-\u9fff])/gu, ' ')
            .replace(/\*\*([^*]+)\*\*/gu, '$1')
            .replace(/([+\-]\/)\s+(?=\d)/gu, '$1')
            .replace(/(\d)\.\s+(?=\d)/gu, '$1.')
            .replace(/^(?:#{1,6})\s+/u, '')
    );
    const tableStart = normalized.search(/\s\|\s*[^|]+\s*\|/u);
    if (tableStart >= 0) {
        normalized = normalizeWhitespace(normalized.slice(0, tableStart));
    }
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

export function shouldRejectPublicEvidenceClause(value: string): boolean {
    const normalized = normalizeWhitespace(value);
    return /\b(?:distractor|must not guide|do not use|ignore this (?:section|evidence)|must (?:compare|resolve)|before publishing)\b/iu.test(normalized)
        || /\b(?:the following table|the table below)\b/iu.test(normalized)
        || /(?:下表|以下表格|表中)(?:列出|展示|给出|包含)/u.test(normalized)
        || /(?:参数\s*\(Parameter\)|Parameter).{0,160}(?:单位\s*\(Unit\)|Unit).{0,160}:---/iu.test(normalized)
        || /(?:遵从您的指示|所有推理过程|最终输出为|仅基于标题|根据您的要求生成|本技术文档旨在)/u.test(normalized);
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
