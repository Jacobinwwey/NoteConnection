import {
    buildMemoryAuditRecord,
    classifyMemoryEntry,
    computeGovernedMemoryWeight,
} from './MemoryGovernance';
import type { MemoryEntry } from '../learning/types';

describe('MemoryGovernance', () => {
    test('classifies study memories and raises their retrieval weight', () => {
        const entry: MemoryEntry = {
            key: 'quiz_note',
            value: 'Review this quiz correction before the next session.',
            tags: ['study', 'review'],
            confidence: 0.84,
            references: ['atom_1'],
            createdAt: '2026-05-26T00:00:00.000Z',
            updatedAt: '2026-05-26T00:00:00.000Z',
        };

        const classification = classifyMemoryEntry(entry);
        expect(classification.memoryType).toBe('study');
        expect(classification.memoryPurpose).toBe('internalized');
        expect(computeGovernedMemoryWeight(entry)).toBeGreaterThan(1);
    });

    test('builds audit records with explicit scope fields', () => {
        const entry: MemoryEntry = {
            key: 'memory_1',
            value: 'Scoped note',
            tags: ['note'],
            confidence: 0.7,
            references: [],
            scopeWorkspaceId: 'optics',
            scopeCorpusId: 'optics',
            createdAt: '2026-05-26T00:00:00.000Z',
            updatedAt: '2026-05-26T00:00:00.000Z',
        };

        const audit = buildMemoryAuditRecord(
            (prefix = 'memory_audit') => `${prefix}_1`,
            {
                userId: 'user_a',
                operation: 'write',
                layer: 'session',
                entry,
                reason: 'test',
                scopeWorkspaceId: 'optics',
                scopeCorpusId: 'optics',
                recordedAt: '2026-05-26T00:01:00.000Z',
            }
        );

        expect(audit.scopeWorkspaceId).toBe('optics');
        expect(audit.scopeCorpusId).toBe('optics');
        expect(audit.memoryKey).toBe('memory_1');
    });
});
