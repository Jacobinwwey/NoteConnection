import type { AgentConversationResponse, KnowledgeDocumentInput } from './types';

export const ANSWER_QUALITY_CATEGORIES = [
    'definition', 'comparison', 'causal', 'multi_step', 'conflict', 'missing_evidence', 'topic_drift', 'math', 'noisy_headings',
] as const;

export interface AnswerQualityCase {
    id: string;
    split: 'calibration' | 'evaluation';
    language: 'en' | 'zh';
    category: typeof ANSWER_QUALITY_CATEGORIES[number];
    query: string;
    documents: KnowledgeDocumentInput[];
    reference: {
        facts: Array<{ id: string; patterns: string[] }>;
        unsupportedClaims: Array<{ id: string; pattern: string }>;
        expectsConflict: boolean;
        expectsAbstention: boolean;
        orderedSteps?: string[];
    };
}

export interface AnswerQualityCorpus {
    schemaVersion: 1;
    version: string;
    authoredAt: string;
    backend: string;
    cases: AnswerQualityCase[];
}

export function parseAnswerQualityCorpus(input: unknown): AnswerQualityCorpus {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Expected an answer-quality corpus object');
    const corpus = input as AnswerQualityCorpus;
    if (corpus.schemaVersion !== 1 || !corpus.version || !corpus.backend || !Array.isArray(corpus.cases) || !corpus.cases.length) {
        throw new TypeError('Incomplete answer-quality corpus contract');
    }
    const caseIds = new Set<string>();
    const documentIds = new Set<string>();
    const sourceContents = new Map<string, AnswerQualityCase['split']>();
    for (const entry of corpus.cases) {
        if (!entry.id || caseIds.has(entry.id) || !['calibration', 'evaluation'].includes(entry.split)
            || !['en', 'zh'].includes(entry.language) || !(ANSWER_QUALITY_CATEGORIES as readonly string[]).includes(entry.category)
            || typeof entry.query !== 'string' || !entry.query.trim() || !Array.isArray(entry.documents) || !entry.documents.length) {
            throw new TypeError(`Invalid or duplicate answer-quality case: ${entry.id}`);
        }
        caseIds.add(entry.id);
        for (const document of entry.documents) {
            if (!document.documentId || documentIds.has(document.documentId) || !document.sourcePath || typeof document.content !== 'string') {
                throw new TypeError(`Invalid or duplicate document in case ${entry.id}`);
            }
            documentIds.add(document.documentId);
            const content = document.content.replace(/\s+/g, ' ').trim();
            const previousSplit = sourceContents.get(content);
            if (previousSplit && previousSplit !== entry.split) throw new TypeError('Calibration/evaluation source leakage');
            sourceContents.set(content, entry.split);
        }
        const reference = entry.reference;
        if (!reference || !Array.isArray(reference.facts) || !Array.isArray(reference.unsupportedClaims)
            || typeof reference.expectsConflict !== 'boolean' || typeof reference.expectsAbstention !== 'boolean') {
            throw new TypeError(`Missing independent references for ${entry.id}`);
        }
        const patterns: string[] = [];
        for (const fact of reference.facts) {
            if (!fact.id || !Array.isArray(fact.patterns) || !fact.patterns.length) throw new TypeError(`Invalid fact in ${entry.id}`);
            patterns.push(...fact.patterns);
        }
        for (const claim of reference.unsupportedClaims) {
            if (!claim.id) throw new TypeError(`Invalid unsupported-claim probe in ${entry.id}`);
            patterns.push(claim.pattern);
        }
        if (reference.orderedSteps) {
            if (!Array.isArray(reference.orderedSteps)) throw new TypeError(`Invalid ordered steps in ${entry.id}`);
            patterns.push(...reference.orderedSteps);
        }
        for (const pattern of patterns) {
            if (typeof pattern !== 'string' || !pattern || pattern.length > 512) throw new TypeError(`Invalid reference pattern in ${entry.id}`);
            new RegExp(pattern, 'iu');
        }
    }
    return corpus;
}

export function measureAnswerQuality(entry: AnswerQualityCase, response: AgentConversationResponse) {
    const answer = response.answer.replace(/\*\*|`/g, '').replace(/\s+/g, ' ').trim();
    const matches = (pattern: string) => new RegExp(pattern, 'iu').test(answer);
    const coveredFactIds = entry.reference.facts.filter(fact => fact.patterns.some(matches)).map(fact => fact.id);
    const missingFactIds = entry.reference.facts.filter(fact => !coveredFactIds.includes(fact.id)).map(fact => fact.id);
    const unsupportedClaimIds = entry.reference.unsupportedClaims.filter(claim => matches(claim.pattern)).map(claim => claim.id);
    const conflictText = answer.replace(/\b(?:no|without)\s+(?:evidence of\s+)?(?:conflicts?|contradictions?)\b/giu, '')
        .replace(/(?:没有|不存在|无)(?:明显)?(?:冲突|矛盾|分歧)/gu, '');
    const conflictSignalled = /\b(?:conflict|contradict|inconsisten)|冲突|矛盾|不一致|分歧/iu.test(conflictText);
    const abstentionSignalled = response.answerReleaseReview?.decision === 'abstain'
        || /insufficient (?:local |source )?evidence|no (?:scoped|relevant|matching) (?:knowledge|evidence)|证据不足|没有(?:足够|相关)证据|暂无相关证据/iu.test(answer);
    let stepOffset = 0;
    const orderedStepsSatisfied = (entry.reference.orderedSteps || []).every(pattern => {
        const match = new RegExp(pattern, 'iu').exec(answer.slice(stepOffset));
        if (!match) return false;
        stepOffset += match.index + match[0].length;
        return true;
    });
    const displayMathCount = (answer.match(/(?<!\\)\$\$/gu) || []).length;
    const inlineMathCount = (answer.replace(/(?<!\\)\$\$/gu, '').match(/(?<!\\)\$/gu) || []).length;
    const balancedMath = displayMathCount % 2 === 0 && inlineMathCount % 2 === 0;
    const documents = new Set(entry.documents.map(document => document.documentId));
    const invalidCitationIds = response.citations.filter(citation => !documents.has(citation.documentId)).map(citation => citation.citationId);
    const passed = !missingFactIds.length && !unsupportedClaimIds.length && orderedStepsSatisfied && balancedMath
        && !invalidCitationIds.length && conflictSignalled === entry.reference.expectsConflict && abstentionSignalled === entry.reference.expectsAbstention;
    return {
        caseId: entry.id, split: entry.split, language: entry.language, category: entry.category,
        referenceFactCount: entry.reference.facts.length, coveredFactIds, missingFactIds,
        unsupportedProbeCount: entry.reference.unsupportedClaims.length, unsupportedClaimIds,
        conflictExpected: entry.reference.expectsConflict, conflictSignalled,
        abstentionExpected: entry.reference.expectsAbstention, abstentionSignalled,
        orderedStepsSatisfied, balancedMath, invalidCitationIds, passed,
    };
}

export function summarizeAnswerQuality(results: Array<ReturnType<typeof measureAnswerQuality>>) {
    const count = (predicate: (item: typeof results[number]) => boolean) => results.filter(predicate).length;
    const fraction = (numerator: number, denominator: number) => ({ numerator, denominator, rate: denominator ? numerator / denominator : null });
    const facts = results.reduce((sum, row) => sum + row.referenceFactCount, 0);
    const covered = results.reduce((sum, row) => sum + row.coveredFactIds.length, 0);
    const probes = results.reduce((sum, row) => sum + row.unsupportedProbeCount, 0);
    const unsupported = results.reduce((sum, row) => sum + row.unsupportedClaimIds.length, 0);
    return {
        cases: results.length,
        referenceAcceptance: fraction(count(row => row.passed), results.length),
        referenceFactCoverage: fraction(covered, facts),
        unsupportedAssertionProbeHitRate: fraction(unsupported, probes),
        falseConflictRate: fraction(count(row => !row.conflictExpected && row.conflictSignalled), count(row => !row.conflictExpected)),
        missedConflictRate: fraction(count(row => row.conflictExpected && !row.conflictSignalled), count(row => row.conflictExpected)),
        correctAbstentionRate: fraction(count(row => row.abstentionExpected && row.abstentionSignalled), count(row => row.abstentionExpected)),
        unexpectedAbstentionRate: fraction(count(row => !row.abstentionExpected && row.abstentionSignalled), count(row => !row.abstentionExpected)),
        unbalancedMathAnswers: count(row => !row.balancedMath),
        outOfScopeCitations: results.reduce((sum, row) => sum + row.invalidCitationIds.length, 0),
    };
}
