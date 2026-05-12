import type { EvidenceSpan, KnowledgeAtom, TutorActionKind } from './types';

export interface TutorAdapterInput {
    userId: string;
    actionKind: TutorActionKind;
    atom: KnowledgeAtom;
    prompt?: string;
    answer?: string;
    evidenceSpans: EvidenceSpan[];
    relatedAtomIds: string[];
    providerNameHint?: string;
    providerModeHint?: string;
    adapterIdHint?: string;
}

export interface TutorAdapterResult {
    message: string;
    confidence: number;
    evidenceSpanIds: string[];
    modelId?: string;
    providerName?: string;
    providerMode?: 'local' | 'cloud' | string;
    adapterId?: string;
    metadata?: Record<string, unknown>;
}

export interface TutorAdapter {
    id: string;
    mode: 'local' | 'cloud';
    execute(input: TutorAdapterInput): Promise<TutorAdapterResult>;
}
