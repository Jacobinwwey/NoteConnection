/**
 * Domain base types for the KnowledgeLearningPlatform decomposition.
 * Uses types from the public API surface (../types) and defines
 * local interfaces for internal types not in the public contract.
 */

import type {
    KnowledgeAtom, EvidenceSpan, RelationEdge, TemporalEdge,
    LearnerConceptState, TutorTrace,
} from '../types';

/** Internal: snapshot of a document at a point in time */
export interface DocumentSnapshot {
    path: string;
    hash: string;
    ingestedAt: string;
    atomCount: number;
}

/** Internal: user memory bank keyed by memory layer */
export interface UserMemoryBank {
    layer: string;
    entries: unknown[];
    updatedAt: string;
}

/** Internal: conversation-scoped memory bank */
export interface ConversationMemoryBank {
    namespace: string;
    entries: unknown[];
    updatedAt: string;
}

/** Internal: knowledge graph store abstraction */
export interface KnowledgeGraphStore {
    backend: string;
    reload: () => Promise<boolean>;
    diagnostics: () => Promise<unknown>;
}

/** Internal: graph query backend interface */
export interface GraphQueryBackend {
    type: string;
    query: (request: unknown) => Promise<unknown>;
}

/** Internal: tutor adapter interface */
export interface TutorAdapter {
    id: string;
    kind: string;
    provider: string;
    execute: (request: unknown) => Promise<unknown>;
}

export interface DomainContext {
    nowProvider: () => Date;
    store: KnowledgeGraphStore | null;
    autoPersist: boolean;
    atoms: Map<string, KnowledgeAtom>;
    evidenceSpans: Map<string, EvidenceSpan>;
    relationEdges: Map<string, RelationEdge>;
    temporalEdges: Map<string, TemporalEdge>;
    documents: Map<string, DocumentSnapshot>;
    activeStableKeyToAtomId: Map<string, string>;
    activeAtomIds: Set<string>;
    learnerStates: Map<string, LearnerConceptState>;
    userMemory: Map<string, UserMemoryBank>;
    conversationMemoryByUser: Map<string, ConversationMemoryBank>;
    titleToAtomIds: Map<string, Set<string>>;
    relationEdgeSignatures: Set<string>;
}
