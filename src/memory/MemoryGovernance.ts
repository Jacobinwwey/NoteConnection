import type { MemoryEntry, MemoryLayer } from '../learning/types';
import type { GovernedMemoryPurpose, GovernedMemoryType, MemoryAuditRecord } from './types';

type NextId = (prefix?: string) => string;

export function normalizeGovernedMemoryType(value: unknown): GovernedMemoryType {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'study' || normalized === 'note' || normalized === 'system') {
        return normalized;
    }
    return 'fact';
}

export function normalizeGovernedMemoryPurpose(value: unknown): GovernedMemoryPurpose {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'internalized' || normalized === 'supplementary' || normalized === 'systemic') {
        return normalized;
    }
    return 'memorized';
}

export function classifyMemoryEntry(entry: MemoryEntry): {
    memoryType: GovernedMemoryType;
    memoryPurpose: GovernedMemoryPurpose;
    classificationConfidence: number;
} {
    const tags = Array.isArray(entry.tags) ? entry.tags.map((tag) => String(tag || '').trim().toLowerCase()) : [];
    const rawText = `${entry.key} ${entry.value} ${tags.join(' ')}`.toLowerCase();
    const memoryType = normalizeGovernedMemoryType(
        (entry as MemoryEntry & { memoryType?: string }).memoryType
        || (tags.includes('study') || rawText.includes('quiz') || rawText.includes('review') ? 'study'
            : tags.includes('note') || rawText.includes('note') ? 'note'
                : tags.includes('system') ? 'system'
                    : 'fact')
    );
    const memoryPurpose = normalizeGovernedMemoryPurpose(
        (entry as MemoryEntry & { memoryPurpose?: string }).memoryPurpose
        || (memoryType === 'study' ? 'internalized'
            : memoryType === 'system' ? 'systemic'
                : memoryType === 'note' ? 'supplementary'
                    : 'memorized')
    );
    return {
        memoryType,
        memoryPurpose,
        classificationConfidence: Math.max(0.45, Math.min(0.98, Number(entry.confidence || 0.72))),
    };
}

export function computeGovernedMemoryWeight(entry: MemoryEntry): number {
    const { memoryType, memoryPurpose } = classifyMemoryEntry(entry);
    const typeWeight = memoryType === 'study'
        ? 1.25
        : memoryType === 'note'
            ? 1.1
            : memoryType === 'system'
                ? 0.7
                : 1;
    const purposeWeight = memoryPurpose === 'internalized'
        ? 1.35
        : memoryPurpose === 'supplementary'
            ? 0.92
            : memoryPurpose === 'systemic'
                ? 0.75
                : 1;
    return Number((typeWeight * purposeWeight).toFixed(4));
}

export function buildMemoryAuditRecord(
    nextId: NextId,
    params: {
        userId: string;
        operation: MemoryAuditRecord['operation'];
        layer: MemoryLayer;
        entry: MemoryEntry;
        reason: string;
        scopeWorkspaceId?: string | null;
        scopeCorpusId?: string | null;
        recordedAt: string;
    }
): MemoryAuditRecord {
    const classification = classifyMemoryEntry(params.entry);
    return {
        auditId: nextId('memory_audit'),
        userId: params.userId,
        operation: params.operation,
        layer: params.layer,
        memoryKey: params.entry.key,
        memoryType: classification.memoryType,
        memoryPurpose: classification.memoryPurpose,
        reason: params.reason,
        scopeWorkspaceId: params.scopeWorkspaceId || null,
        scopeCorpusId: params.scopeCorpusId || null,
        recordedAt: params.recordedAt,
    };
}
