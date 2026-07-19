import { scoreRagEvidenceClause, segmentRagEvidenceClauses } from './ragEvidenceQuality';

describe('ragEvidenceQuality', () => {
    test('segments prose without splitting decimal mathematical values', () => {
        expect(segmentRagEvidenceClauses('The coefficient is 0.75; heat transfer follows the wall.')).toEqual([
            'The coefficient is 0.75',
            'heat transfer follows the wall.',
        ]);
    });

    test('scores complete balanced mathematical evidence above documentary prose', () => {
        const evidence = scoreRagEvidenceClause('The thermal flux is q = kA(T1 - T2) / L, so thickness changes the exchange rate.');
        const documentary = scoreRagEvidenceClause('This document will explain the following table as requested.');
        expect(evidence.hasBalancedDelimiters).toBe(true);
        expect(evidence.mathDensity).toBeGreaterThan(0);
        expect(evidence.score).toBeGreaterThan(documentary.score);
        expect(documentary.documentaryPenalty).toBeGreaterThan(0);
    });

    test('penalizes unbalanced mathematical fragments', () => {
        const quality = scoreRagEvidenceClause('The flux is q = kA(T1 - T2 / L.');
        expect(quality.hasBalancedDelimiters).toBe(false);
        expect(quality.score).toBeLessThan(0.5);
    });
});
