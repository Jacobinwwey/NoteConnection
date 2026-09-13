import {
    naturalizeRagPublicEvidenceClause,
    shouldRejectPublicEvidenceClause,
    shouldRejectCompareProcedureEvidenceClause,
} from './ragPublicText';
import { KnowledgeLearningPlatform } from './KnowledgeLearningPlatform';

describe('ragPublicText', () => {
    test('retains numbered procedure evidence for a how-should request', () => {
        expect(shouldRejectCompareProcedureEvidenceClause('Step 1: Validate the candidate.', 'How should the index be replaced?')).toBe(false);
        expect(shouldRejectCompareProcedureEvidenceClause('Step 1: Validate the candidate.', 'Compare the two indexes.')).toBe(true);
    });
    test.each(['[[Checkpoint]]', '[[Checkpoint]] [[Mutation log]]', '1. [[Checkpoint]] 2. [[Mutation log]]'])('rejects link-only navigation as factual evidence: %s', text => {
        expect(shouldRejectPublicEvidenceClause(text)).toBe(true);
    });
    test('preserves factual prose that contains a wiki link', () => {
        expect(shouldRejectPublicEvidenceClause('A [[Mutation log]] records an ordered sequence of changes.')).toBe(false);
    });
    test('comparison composition selects source facts instead of bare wiki links', async () => {
        const platform = new KnowledgeLearningPlatform({ autoPersist: false });
        await platform.ingestKnowledge({ documents: [
            { documentId: 'checkpoint', sourcePath: 'test/checkpoint.md', content: '# Checkpoint\nA checkpoint stores the complete state at a checkpoint. [[Mutation log]]' },
            { documentId: 'mutation-log', sourcePath: 'test/mutation-log.md', content: '# Mutation Log\nA mutation log records an ordered sequence of state changes. [[Checkpoint]]' },
        ] });
        const response = await platform.agentConversation({ message: 'Compare Checkpoint and Mutation Log', persistMemory: false });
        expect(response.answer).toMatch(/complete state|ordered sequence/i);
        expect(shouldRejectPublicEvidenceClause(response.answer)).toBe(false);
    });
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
        expect(shouldRejectPublicEvidenceClause('This clause is intentionally beyond the public definition budget and should remain internal.')).toBe(true);
        expect(shouldRejectPublicEvidenceClause('The response budget limits serialized bytes.')).toBe(false);
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
