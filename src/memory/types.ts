import type { MemoryLayer } from '../learning/types';

export type GovernedMemoryType = 'fact' | 'study' | 'note' | 'system';

export type GovernedMemoryPurpose = 'memorized' | 'internalized' | 'supplementary' | 'systemic';

export interface MemoryAuditRecord {
    auditId: string;
    userId: string;
    operation: 'write' | 'read' | 'evict' | 'promote' | 'feedback' | 'recall';
    layer: MemoryLayer;
    memoryKey: string;
    memoryType: GovernedMemoryType;
    memoryPurpose: GovernedMemoryPurpose;
    reason: string;
    scopeWorkspaceId: string | null;
    scopeCorpusId: string | null;
    recordedAt: string;
}
