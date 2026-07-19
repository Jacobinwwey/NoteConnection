import {
    naturalizeRagPublicEvidenceClause,
    shouldRejectPublicEvidenceClause,
} from './ragPublicText';

describe('ragPublicText', () => {
    test('removes Markdown list and bold-label scaffolding before public composition', () => {
        expect(naturalizeRagPublicEvidenceClause('* **Quantitative analysis**: pressure follows P = rho g h.'))
            .toBe('Quantitative analysis: pressure follows P = rho g h.');
        expect(naturalizeRagPublicEvidenceClause('* $T$ is the temperature field.'))
            .toBe('$T$ is the temperature field.');
        expect(naturalizeRagPublicEvidenceClause('A value * B value remains mathematical.'))
            .toBe('A value * B value remains mathematical.');
    });
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

    test('rejects flattened table introductions after Markdown extraction', () => {
        expect(shouldRejectPublicEvidenceClause(
            '下表列出了标准温度和压力下的典型技术参数。参数 Parameter 密度 2500 999.8 kg/m³ 单位 Unit。'
        )).toBe(true);
        expect(shouldRejectPublicEvidenceClause(
            'The following table lists typical parameters. Parameter Density Value Unit.'
        )).toBe(true);
        expect(shouldRejectPublicEvidenceClause(
            '参数 (Parameter) 钠钙玻璃 水 单位 (Unit) :--- :--- 密度 2500 999.8 kg/m³。'
        )).toBe(true);
    });

    test('removes flattened section labels while retaining their factual sentence', () => {
        expect(naturalizeRagPublicEvidenceClause(
            '核心概念及其数学基础：水杯系统通过传导、对流和辐射与环境交换热量。'
        )).toBe('水杯系统通过传导、对流和辐射与环境交换热量。');
        expect(naturalizeRagPublicEvidenceClause(
            'Material science: Glass is an amorphous solid without long-range order.'
        )).toBe('Glass is an amorphous solid without long-range order.');
        expect(naturalizeRagPublicEvidenceClause(
            '核心概念及其数学基础 水杯系统通过传导、对流和辐射与环境交换热量。'
        )).toBe('水杯系统通过传导、对流和辐射与环境交换热量。');
    });
});
