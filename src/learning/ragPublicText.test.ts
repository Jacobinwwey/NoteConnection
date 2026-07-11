import {
    naturalizeRagPublicEvidenceClause,
    shouldRejectPublicEvidenceClause,
} from './ragPublicText';

describe('ragPublicText', () => {
    test('removes markdown headings and table scaffolding while preserving the factual lead', () => {
        expect(naturalizeRagPublicEvidenceClause(
            '### Technical specifications The glass density is about 2500 kg/m³. | Parameter | Value | | :--- | :--- | | density | 2500 |'
        )).toBe('Technical specifications The glass density is about 2500 kg/m³.');
    });

    test('rejects authoring instructions and evidence-control prose in Chinese and English', () => {
        expect(shouldRejectPublicEvidenceClause('所有推理过程以英文进行，最终输出为简体中文。')).toBe(true);
        expect(shouldRejectPublicEvidenceClause('Operators must resolve the active owner before publishing.')).toBe(true);
        expect(shouldRejectPublicEvidenceClause('The glass wall conducts heat into the environment.')).toBe(false);
    });

    test('removes fenced diagram payloads instead of exposing renderer source', () => {
        expect(naturalizeRagPublicEvidenceClause(
            'Heat moves by conduction and convection. ```mermaid graph TD A --> B ```'
        )).toBe('Heat moves by conduction and convection.');
    });
});
