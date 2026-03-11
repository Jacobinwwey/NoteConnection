import {
    classifyWasmParityHistoryMaturity,
    compactWasmParityHistoryRecords,
    selectComparableWasmParityHistoryRecords,
    summarizeWasmParityHistoryReadiness
} from './WasmParityHistory';

type SampleHistoryRecord = {
    generatedAt?: string;
    id: string;
    hostKey?: string;
    nodeCount?: number;
    maxWorkers?: number;
    wasmUsed?: boolean;
    equivalenceWithinTolerance?: boolean;
    performanceGuardsPass?: boolean;
};

describe('WASM parity history compaction', () => {
    const now = new Date('2026-03-11T12:00:00.000Z');

    test('drops malformed records and keeps chronological ordering', () => {
        const records: SampleHistoryRecord[] = [
            { id: 'invalid-a', generatedAt: 'not-a-date' },
            { id: 'valid-b', generatedAt: '2026-03-11T10:00:00.000Z' },
            { id: 'valid-a', generatedAt: '2026-03-11T09:00:00.000Z' },
            { id: 'invalid-b' }
        ];

        const result = compactWasmParityHistoryRecords(records, {
            maxRecords: 50,
            maxAgeDays: 30,
            now
        });

        expect(result.beforeCount).toBe(4);
        expect(result.afterCount).toBe(2);
        expect(result.compacted.map((record) => record.id)).toEqual(['valid-a', 'valid-b']);
    });

    test('enforces age-based retention window', () => {
        const records: SampleHistoryRecord[] = [
            { id: 'stale', generatedAt: '2025-12-01T00:00:00.000Z' },
            { id: 'fresh-a', generatedAt: '2026-03-10T00:00:00.000Z' },
            { id: 'fresh-b', generatedAt: '2026-03-11T11:00:00.000Z' }
        ];

        const result = compactWasmParityHistoryRecords(records, {
            maxRecords: 50,
            maxAgeDays: 7,
            now
        });

        expect(result.compacted.map((record) => record.id)).toEqual(['fresh-a', 'fresh-b']);
    });

    test('keeps newest records when max-record ceiling is exceeded', () => {
        const records: SampleHistoryRecord[] = [
            { id: 'r1', generatedAt: '2026-03-11T08:00:00.000Z' },
            { id: 'r2', generatedAt: '2026-03-11T09:00:00.000Z' },
            { id: 'r3', generatedAt: '2026-03-11T10:00:00.000Z' },
            { id: 'r4', generatedAt: '2026-03-11T11:00:00.000Z' }
        ];

        const result = compactWasmParityHistoryRecords(records, {
            maxRecords: 2,
            maxAgeDays: 30,
            now
        });

        expect(result.compacted.map((record) => record.id)).toEqual(['r3', 'r4']);
        expect(result.afterCount).toBe(2);
    });
});

describe('WASM parity history readiness', () => {
    const now = new Date('2026-03-11T12:00:00.000Z');

    test('classifies maturity tiers with deterministic thresholds', () => {
        expect(classifyWasmParityHistoryMaturity(0, 5, 12).tier).toBe('bootstrap');
        expect(classifyWasmParityHistoryMaturity(5, 5, 12).tier).toBe('warming');
        expect(classifyWasmParityHistoryMaturity(11, 5, 12).tier).toBe('warming');
        expect(classifyWasmParityHistoryMaturity(12, 5, 12).tier).toBe('enforced');
    });

    test('selects only comparable records and enforces window', () => {
        const records: SampleHistoryRecord[] = [
            {
                id: 'a-1',
                generatedAt: '2026-03-10T00:00:00.000Z',
                hostKey: 'win:x64:8:node22',
                nodeCount: 500,
                maxWorkers: 4,
                wasmUsed: true,
                equivalenceWithinTolerance: true,
                performanceGuardsPass: true
            },
            {
                id: 'a-2',
                generatedAt: '2026-03-10T01:00:00.000Z',
                hostKey: 'win:x64:8:node22',
                nodeCount: 500,
                maxWorkers: 4,
                wasmUsed: true,
                equivalenceWithinTolerance: true,
                performanceGuardsPass: true
            },
            {
                id: 'a-3',
                generatedAt: '2026-03-10T02:00:00.000Z',
                hostKey: 'win:x64:8:node22',
                nodeCount: 500,
                maxWorkers: 4,
                wasmUsed: true,
                equivalenceWithinTolerance: true,
                performanceGuardsPass: true
            },
            {
                id: 'b-1',
                generatedAt: '2026-03-10T02:30:00.000Z',
                hostKey: 'linux:arm64:8:node22',
                nodeCount: 500,
                maxWorkers: 4,
                wasmUsed: true,
                equivalenceWithinTolerance: true,
                performanceGuardsPass: true
            },
            {
                id: 'a-invalid',
                generatedAt: '2026-03-10T03:00:00.000Z',
                hostKey: 'win:x64:8:node22',
                nodeCount: 500,
                maxWorkers: 4,
                wasmUsed: false,
                equivalenceWithinTolerance: true,
                performanceGuardsPass: true
            }
        ];

        const selected = selectComparableWasmParityHistoryRecords(records, {
            hostKey: 'win:x64:8:node22',
            nodeCount: 500,
            maxWorkers: 4,
            historyWindow: 2
        });

        expect(selected.map((record) => record.id)).toEqual(['a-2', 'a-3']);
    });

    test('summarizes readiness per profile with tier counts and history window cap', () => {
        const records: SampleHistoryRecord[] = [
            {
                id: 'w-1',
                generatedAt: '2026-03-10T01:00:00.000Z',
                hostKey: 'win:x64:8:node22',
                nodeCount: 500,
                maxWorkers: 4,
                wasmUsed: true,
                equivalenceWithinTolerance: true,
                performanceGuardsPass: true
            },
            {
                id: 'w-2',
                generatedAt: '2026-03-10T02:00:00.000Z',
                hostKey: 'win:x64:8:node22',
                nodeCount: 500,
                maxWorkers: 4,
                wasmUsed: true,
                equivalenceWithinTolerance: true,
                performanceGuardsPass: true
            },
            {
                id: 'w-3',
                generatedAt: '2026-03-10T03:00:00.000Z',
                hostKey: 'win:x64:8:node22',
                nodeCount: 500,
                maxWorkers: 4,
                wasmUsed: true,
                equivalenceWithinTolerance: true,
                performanceGuardsPass: true
            },
            {
                id: 'l-1',
                generatedAt: '2026-03-10T03:10:00.000Z',
                hostKey: 'linux:arm64:8:node22',
                nodeCount: 500,
                maxWorkers: 4,
                wasmUsed: true,
                equivalenceWithinTolerance: true,
                performanceGuardsPass: true
            },
            {
                id: 'l-2',
                generatedAt: '2026-03-10T03:20:00.000Z',
                hostKey: 'linux:arm64:8:node22',
                nodeCount: 500,
                maxWorkers: 4,
                wasmUsed: true,
                equivalenceWithinTolerance: true,
                performanceGuardsPass: true
            },
            {
                id: 'mac-failed-guard',
                generatedAt: '2026-03-10T03:30:00.000Z',
                hostKey: 'darwin:arm64:8:node22',
                nodeCount: 500,
                maxWorkers: 4,
                wasmUsed: true,
                equivalenceWithinTolerance: true,
                performanceGuardsPass: false
            }
        ];

        const summary = summarizeWasmParityHistoryReadiness(records, {
            minimumSamples: 2,
            strictSamples: 3,
            historyWindow: 2
        });

        expect(summary.profileCount).toBe(2);
        expect(summary.comparableRecordCount).toBe(5);
        expect(summary.tierCounts.bootstrap).toBe(0);
        expect(summary.tierCounts.warming).toBe(2);
        expect(summary.tierCounts.enforced).toBe(0);
        expect(summary.profileSummaries[0].sampleCount).toBe(2);
        expect(summary.profileSummaries[1].sampleCount).toBe(2);
        expect(summary.profileSummaries.map((profile) => profile.hostKey).sort()).toEqual([
            'linux:arm64:8:node22',
            'win:x64:8:node22'
        ]);
    });

    test('preserves chronological profile timestamps after compaction and readiness flow', () => {
        const compacted = compactWasmParityHistoryRecords<SampleHistoryRecord>(
            [
                {
                    id: 'stale',
                    generatedAt: '2025-01-01T00:00:00.000Z',
                    hostKey: 'win:x64:8:node22',
                    nodeCount: 500,
                    maxWorkers: 4,
                    wasmUsed: true,
                    equivalenceWithinTolerance: true,
                    performanceGuardsPass: true
                },
                {
                    id: 'fresh-1',
                    generatedAt: '2026-03-11T09:00:00.000Z',
                    hostKey: 'win:x64:8:node22',
                    nodeCount: 500,
                    maxWorkers: 4,
                    wasmUsed: true,
                    equivalenceWithinTolerance: true,
                    performanceGuardsPass: true
                },
                {
                    id: 'fresh-2',
                    generatedAt: '2026-03-11T10:00:00.000Z',
                    hostKey: 'win:x64:8:node22',
                    nodeCount: 500,
                    maxWorkers: 4,
                    wasmUsed: true,
                    equivalenceWithinTolerance: true,
                    performanceGuardsPass: true
                }
            ],
            {
                maxRecords: 50,
                maxAgeDays: 7,
                now
            }
        );

        const summary = summarizeWasmParityHistoryReadiness(compacted.compacted, {
            minimumSamples: 1,
            strictSamples: 2,
            historyWindow: 5
        });

        expect(summary.profileCount).toBe(1);
        expect(summary.profileSummaries[0].firstGeneratedAt).toBe('2026-03-11T09:00:00.000Z');
        expect(summary.profileSummaries[0].lastGeneratedAt).toBe('2026-03-11T10:00:00.000Z');
        expect(summary.profileSummaries[0].maturity.tier).toBe('enforced');
    });
});
