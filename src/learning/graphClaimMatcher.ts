export interface GraphClaimMatch {
    covered: boolean;
    score: number;
    matchedConcepts: string[];
    missingConcepts: string[];
    polarityConflict: boolean;
}

const STOPWORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'between', 'by', 'for', 'from', 'in', 'is', 'it',
    'of', 'on', 'or', 'that', 'the', 'their', 'this', 'through', 'to', 'with', 'its', 'will',
]);

const CONCEPT_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
    ['transparent', /\btransparent\b|透明/u],
    ['container', /\b(?:container|vessel|cup|water\s+glass)\b|容器|水杯|杯子/u],
    ['glass_material', /\bglass\b|玻璃/u],
    ['plastic', /\bplastic\b|塑料/u],
    ['comparison', /\b(?:compare|compared|than|versus)\b|相比|比/u],
    ['water', /\b(?:water|liquid)\b|水|液体/u],
    ['drink', /\b(?:drink|drinking)\b|饮用|喝水/u],
    ['wall', /\b(?:glass\s+)?wall\b|杯壁|玻璃壁|实体壁/u],
    ['boundary', /\b(?:boundary|separate|separates|separated|divide|divides)\b|边界|隔开|分隔/u],
    ['environment', /\b(?:environment|surroundings?|outside|external)\b|环境|外部|周围/u],
    ['heat', /\b(?:heat|heating|thermal(?:\s+energy)?)\b|加热|受热|热量|热能|导热|热交换|换热/u],
    ['transfer', /\b(?:move|moves|pass|passes|conduct|conducts|transfer|exchange)\b|穿过|传递|经由|交换|换热/u],
    ['thickness', /\bthickness\b|厚度|壁厚/u],
    ['affect', /\b(?:affect|affects|change|changes|influence|influences)\b|影响|改变/u],
    ['cause', /\b(?:because|cause|causes|lead|leads|result|results)\b|导致|造成|引起/u],
    ['rise', /\b(?:rise|rises|rising|raise|raises|increase|increases)\b|上升|升高|提高/u],
    ['apply', /\b(?:apply|applies|effective|valid)\b|生效|适用|有效/u],
    ['before', /\b(?:before|prior|prerequisite)\b|之前|前置|先/u],
    ['after', /\b(?:after|then|subsequent)\b|之后|以后|随后|再/u],
];

const NEGATION_PATTERN = /\b(?:not|no|never|neither|without|cannot|can't|doesn't|does\s+not|isn't|is\s+not|has\s+no)\b|不(?:会|能|是|再|把|影响|改变|导致|造成|传递|穿过|隔开|分隔)?|并非|没有|无法|不能|不会|无关/u;

export function isGraphClaimNegated(value: string): boolean {
    return NEGATION_PATTERN.test(String(value || ''));
}

function normalize(value: string): string {
    return String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

function lexicalTerms(value: string): string[] {
    return normalize(value)
        .split(' ')
        .filter((term) => term.length >= 3 && !STOPWORDS.has(term));
}

export function semanticFeatures(value: string): string[] {
    const normalized = normalize(value);
    const concepts = CONCEPT_PATTERNS
        .filter(([, pattern]) => pattern.test(normalized))
        .map(([concept]) => `concept:${concept}`);
    const lexical = lexicalTerms(normalized)
        .filter((term) => !CONCEPT_PATTERNS.some(([, pattern]) => pattern.test(term)))
        .map((term) => `term:${term}`);
    return Array.from(new Set([...concepts, ...lexical]));
}

export function graphClaimSemanticSimilarity(left: string, right: string): number {
    const leftFeatures = new Set(semanticFeatures(left));
    const rightFeatures = new Set(semanticFeatures(right));
    if (leftFeatures.size === 0 || rightFeatures.size === 0) return 0;
    const intersection = Array.from(leftFeatures).filter((feature) => rightFeatures.has(feature)).length;
    return Number((intersection / Math.max(leftFeatures.size, rightFeatures.size)).toFixed(4));
}

function clauses(value: string): string[] {
    const normalizedValue = String(value || '').trim();
    const splitClauses = normalizedValue
        .split(/(?<=[.!?。！？；;])|[,，]\s*/u)
        .map((clause) => clause.trim())
        .filter(Boolean);
    return splitClauses.length > 1 ? [...splitClauses, normalizedValue] : splitClauses;
}

function matchClause(statementFeatures: string[], statementNegated: boolean, clause: string): GraphClaimMatch {
    const clauseFeatures = new Set(semanticFeatures(clause));
    const matchedConcepts = statementFeatures.filter((feature) => clauseFeatures.has(feature));
    const missingConcepts = statementFeatures.filter((feature) => !clauseFeatures.has(feature));
    const score = statementFeatures.length > 0 ? matchedConcepts.length / statementFeatures.length : 0;
    const minimumMatches = Math.min(statementFeatures.length, Math.max(2, Math.ceil(statementFeatures.length * 0.55)));
    const polarityConflict = matchedConcepts.length >= minimumMatches && statementNegated !== isGraphClaimNegated(clause);
    return {
        covered: !polarityConflict && matchedConcepts.length >= minimumMatches && score >= 0.55,
        score: Number(score.toFixed(4)),
        matchedConcepts,
        missingConcepts,
        polarityConflict,
    };
}

export function matchGraphAnswerClaim(answer: string, statement: string): GraphClaimMatch {
    const normalizedStatement = normalize(statement);
    if (!normalizedStatement) {
        return { covered: false, score: 0, matchedConcepts: [], missingConcepts: [], polarityConflict: false };
    }
    const normalizedAnswer = normalize(answer);
    const statementNegated = NEGATION_PATTERN.test(statement);
    if (normalizedAnswer.includes(normalizedStatement) && statementNegated === isGraphClaimNegated(answer)) {
        const features = semanticFeatures(statement);
        return { covered: true, score: 1, matchedConcepts: features, missingConcepts: [], polarityConflict: false };
    }
    const features = semanticFeatures(statement);
    if (features.length === 0) {
        return { covered: false, score: 0, matchedConcepts: [], missingConcepts: [], polarityConflict: false };
    }
    return clauses(answer)
        .map((clause) => matchClause(features, statementNegated, clause))
        .sort((left, right) => Number(right.covered) - Number(left.covered) || right.score - left.score)[0]
        || { covered: false, score: 0, matchedConcepts: [], missingConcepts: features, polarityConflict: false };
}
