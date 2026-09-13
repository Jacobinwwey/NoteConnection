import { KnowledgeLearningPlatform } from './KnowledgeLearningPlatform';

async function measurementEvidence(first: string, second: string) {
    const platform = new KnowledgeLearningPlatform({ autoPersist: false });
    await platform.ingestKnowledge({ relationRecomputeMode: 'none', documents: [
        { documentId: 'measurement-left', sourcePath: 'quality/measurement-left.md', content: `# Calibration Measurements\n${first}` },
        { documentId: 'measurement-right', sourcePath: 'quality/measurement-right.md', content: `# Calibration Measurements\n${second}` },
    ] });
    return platform.agentConversation({ message: 'Summarize calibration measurements.', responseMode: 'full', persistMemory: false });
}

const measurements: Array<[string, string, string, boolean]> = [
    ['different frequencies', 'The calibration rate is 12 Hz.', 'The calibration rate is 18 Hz.', true],
    ['Chinese frequencies', '定标频率是12赫兹。', '定标频率是18赫兹。', true],
    ['day durations', 'The calibration retention period is 7 days.', 'The calibration retention period is 30 days.', true],
    ['Chinese day durations', '定标记录保留周期是7天。', '定标记录保留周期是30天。', true],
    ['opposed exact constraints', 'The calibration rate is 12 Hz.', 'The calibration rate is not 12 Hz.', true],
    ['Chinese opposed constraints', '定标频率是12赫兹。', '定标频率不是12赫兹。', true],
    ['compatible negative constraint', 'The calibration rate is not 12 Hz.', 'The calibration rate is 18 Hz.', false],
    ['two exclusions', 'The calibration rate is not 12 Hz.', 'The calibration rate is not 18 Hz.', false],
    ['Chinese compatible constraint', '定标频率不是12赫兹。', '定标频率是18赫兹。', false],
    ['equivalent frequency units', 'The calibration rate is 1 kHz.', 'The calibration rate is 1000 Hz.', false],
    ['equivalent duration units', 'The calibration duration is 1000 ms.', 'The calibration duration is 1 s.', false],
    ['equivalent length units', 'The calibration length is 12 mm.', 'The calibration length is 1.2 cm.', false],
    ['equivalent mass units', 'The calibration mass is 1000 mg.', 'The calibration mass is 1 g.', false],
    ['equivalent temperature units', 'The calibration temperature is 0 °C.', 'The calibration temperature is 273.15 K.', false],
    ['incompatible dimensions', 'The calibration reading is 5 s.', 'The calibration reading is 5 m.', false],
    ['Chinese incompatible dimensions', '定标读数是5赫兹。', '定标读数是5毫秒。', false],
    ['historical headings', '## Current\nThe calibration duration is 12 ms.', '## Historical\nThe calibration duration is 18 ms.', false],
    ['environment headings', '## Production\nThe calibration duration is 12 ms.', '## Staging\nThe calibration duration is 18 ms.', false],
    ['Chinese environment headings', '## 生产环境\n定标时长是12毫秒。', '## 测试环境\n定标时长是18毫秒。', false],
    ['distinct minor versions', 'The calibration duration is 12 ms for version 1.2.', 'The calibration duration is 18 ms for version 1.3.', false],
    ['same minor version', 'The calibration duration is 12 ms for version 1.2.', 'The calibration duration is 18 ms for version 1.2.', true],
    ['different subjects', 'The alpha calibration duration is 12 ms.', 'The beta calibration duration is 18 ms.', false],
    ['scientific notation', 'The calibration rate is 1e3 Hz.', 'The calibration rate is 2e3 Hz.', true],
    ['scientific equivalence', 'The calibration rate is 1e3 Hz.', 'The calibration rate is 1000 Hz.', false],
    ['leading decimal magnitudes', 'The calibration duration is .5 s.', 'The calibration duration is .8 s.', true],
    ['uncertain magnitude', 'The calibration offset is ±12 ms.', 'The calibration offset is 4 ms.', false],
    ['range constraint', 'The calibration duration is at least 12 ms.', 'The calibration duration is 18 ms.', false],
    ['tolerance half-width constraints', 'The calibration tolerance is +/-0.10 mm.', 'The calibration tolerance is +/-0.50 mm.', true],
    ['equivalent tolerance half-widths', 'The calibration tolerance is ±0.10 mm.', 'The calibration tolerance is 0.01 cm.', false],
    ['Chinese tolerance half-widths', '定标公差为±0.10毫米。', '定标公差为±0.50毫米。', true],
    ['postfix uncertainty', 'The calibration duration is 12 ms ± 2 ms.', 'The calibration duration is 18 ms.', false],
    ['postfix range', 'The calibration duration is 12 ms to 20 ms.', 'The calibration duration is 18 ms.', false],
    ['unrecognized compound dimension', 'The calibration reading is 5 m/s.', 'The calibration reading is 8 m.', false],
    ['SI symbol case', 'The calibration reading is 5 µM.', 'The calibration reading is 8 µm.', false],
    ['tiny distinct magnitudes', 'The calibration length is 1e-10 nm.', 'The calibration length is 2e-10 nm.', true],
    ['equivalent measured capacity', 'The calibration size is 10 mm.', 'The calibration size is 1 cm.', false],
    ['explicit distinct years', 'The calibration duration is 12 ms in 2023.', 'The calibration duration is 18 ms in 2024.', false],
    ['explicit same year', 'The calibration duration is 12 ms in 2024.', 'The calibration duration is 18 ms in 2024.', true],
    ['Chinese distinct years', '定标时长在2023年是12毫秒。', '定标时长在2024年是18毫秒。', false],
    ['distinct platforms', 'The calibration duration is 12 ms on Linux.', 'The calibration duration is 18 ms on Windows.', false],
    ['same platform', 'The calibration duration is 12 ms on Linux.', 'The calibration duration is 18 ms on Linux.', true],
    ['standalone paragraph qualifiers', 'In production. The calibration duration is 12 ms.', 'In staging. The calibration duration is 18 ms.', false],
    ['matching paragraph qualifiers', 'In production. The calibration duration is 12 ms.', 'In production. The calibration duration is 18 ms.', true],
    ['ambiguous environment', 'The calibration duration is 12 ms in production or staging.', 'The calibration duration is 18 ms in production.', false],
    ['ambiguous heading', '## Production and Staging\nThe calibration duration is 12 ms.', '## Production\nThe calibration duration is 18 ms.', false],
];

describe('measurement evidence comparability', () => {
    test.each(measurements)('%s', async (_name, first, second, conflictExpected) => {
        const response = await measurementEvidence(first, second);
        const conflicts = response.trace.ragContextPack?.fragments.filter(fragment => fragment.role === 'conflict') || [];
        expect(conflicts.length > 0).toBe(conflictExpected);
        for (const fragment of conflicts) {
            expect(fragment.citationIds).toHaveLength(2);
            expect(fragment.sourceBoundary).toBe('full_document');
        }
    });
});
