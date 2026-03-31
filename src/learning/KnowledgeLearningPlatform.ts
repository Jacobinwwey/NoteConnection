import { createHash } from 'crypto';
import * as path from 'path';
import type { KnowledgeLearningPlatformAPI } from './api';
import type {
    DivergencePath,
    EvidenceSpan,
    KnowledgeAtom,
    KnowledgeDocumentInput,
    KnowledgeIngestRequest,
    KnowledgeIngestResponse,
    KnowledgeQueryItem,
    KnowledgeQueryRequest,
    KnowledgeQueryResponse,
    KnowledgeSystemState,
    LearnerConceptState,
    LearningAction,
    LearningActionKind,
    LearningPathRequest,
    LearningPathResponse,
    MasteryDiagnosticsRequest,
    MasteryDiagnosticsResponse,
    MasteryObservation,
    MemoryEntry,
    MemoryLayer,
    MemoryPolicyRequest,
    MemoryPolicyResponse,
    RelationEdge,
    RelationKind,
    StalenessRecord,
    TemporalEdge,
    TutorActionRequest,
    TutorActionResponse,
    TutorTrace,
} from './types';

type ParsedAtomDraft = {
    stableKey: string;
    title: string;
    content: string;
    sectionPath: string[];
    startLine: number;
    endLine: number;
    startOffset: number;
    endOffset: number;
    keywords: string[];
};

type ParsedDocument = {
    atoms: ParsedAtomDraft[];
    wikiLinksByStableKey: Map<string, string[]>;
};

type DocumentSnapshot = {
    documentId: string;
    sourcePath: string;
    sourceHash: string;
    version: number;
    updatedAt: string;
    atomStableKeyToId: Map<string, string>;
    atomIds: string[];
    evidenceSpanIds: string[];
    relationEdgeIds: string[];
    temporalEdgeIds: string[];
};

type UserMemoryBank = {
    session: MemoryEntry[];
    unit: MemoryEntry[];
    long_term: MemoryEntry[];
};

type MemoryStats = {
    session: number;
    unit: number;
    longTerm: number;
};

const STOPWORDS = new Set<string>([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'being',
    'by', 'for', 'from', 'in', 'into', 'is', 'it', 'its', 'of',
    'on', 'or', 'that', 'the', 'their', 'this', 'to', 'was',
    'were', 'with', 'without', 'your', 'you', 'we', 'our', 'can',
    'will', 'shall', 'not', 'do', 'does', 'did', 'if', 'then',
]);

const MEMORY_LAYER_CAPACITY: Record<MemoryLayer, number> = {
    session: 80,
    unit: 320,
    long_term: 1200,
};

function clamp(value: number, minValue: number, maxValue: number): number {
    return Math.min(maxValue, Math.max(minValue, value));
}

function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function normalizeIdentifier(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]+/gu, '')
        .replace(/\s+/g, '_');
}

function tokenize(text: string): string[] {
    const normalized = text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]+/gu, ' ')
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
    return Array.from(new Set(normalized));
}

function computeJaccard(left: string[], right: string[]): number {
    if (!left.length || !right.length) {
        return 0;
    }
    const leftSet = new Set(left);
    const rightSet = new Set(right);
    let intersection = 0;
    leftSet.forEach((token) => {
        if (rightSet.has(token)) {
            intersection += 1;
        }
    });
    const union = leftSet.size + rightSet.size - intersection;
    if (union <= 0) {
        return 0;
    }
    return intersection / union;
}

function plusDays(isoDate: string, days: number): string {
    const date = new Date(isoDate);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString();
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

export class KnowledgeLearningPlatform implements KnowledgeLearningPlatformAPI {
    private idCounter = 0;

    private readonly atoms = new Map<string, KnowledgeAtom>();

    private readonly evidenceSpans = new Map<string, EvidenceSpan>();

    private readonly relationEdges = new Map<string, RelationEdge>();

    private readonly temporalEdges = new Map<string, TemporalEdge>();

    private readonly documents = new Map<string, DocumentSnapshot>();

    private readonly activeStableKeyToAtomId = new Map<string, string>();

    private readonly activeAtomIds = new Set<string>();

    private readonly learnerStates = new Map<string, LearnerConceptState>();

    private readonly tutorTraces: TutorTrace[] = [];

    private readonly userMemory = new Map<string, UserMemoryBank>();

    private readonly titleToAtomIds = new Map<string, Set<string>>();

    private readonly relationEdgeSignatures = new Set<string>();

    constructor(private readonly nowProvider: () => Date = () => new Date()) {
    }

    public async ingestKnowledge(request: KnowledgeIngestRequest): Promise<KnowledgeIngestResponse> {
        const documents = Array.isArray(request.documents) ? request.documents : [];
        const ingestedAt = this.resolveTimestamp(request.ingestedAt);
        const incremental = request.incremental !== false;
        const changedDocIds: string[] = [];
        const responseAtoms: KnowledgeAtom[] = [];
        const responseEvidence: EvidenceSpan[] = [];
        const responseRelations: RelationEdge[] = [];
        const responseTemporals: TemporalEdge[] = [];
        const staleness: StalenessRecord[] = [];
        const newAtomIds: string[] = [];
        const wikiLinksByAtomId = new Map<string, string[]>();

        for (const documentInput of documents) {
            const normalizedInput = this.normalizeDocumentInput(documentInput);
            const sourceHash = this.computeHash(normalizedInput.content);
            const previousSnapshot = this.documents.get(normalizedInput.documentId);
            const previousVersion = previousSnapshot?.version ?? 0;
            const currentVersion = previousVersion + 1;

            if (incremental && previousSnapshot && previousSnapshot.sourceHash === sourceHash) {
                staleness.push({
                    documentId: normalizedInput.documentId,
                    sourcePath: normalizedInput.sourcePath,
                    status: 'unchanged',
                    previousHash: previousSnapshot.sourceHash,
                    currentHash: sourceHash,
                    previousVersion: previousSnapshot.version,
                    currentVersion: previousSnapshot.version,
                });
                continue;
            }

            const status: StalenessRecord['status'] = previousSnapshot ? 'updated' : 'new';
            staleness.push({
                documentId: normalizedInput.documentId,
                sourcePath: normalizedInput.sourcePath,
                status,
                previousHash: previousSnapshot?.sourceHash,
                currentHash: sourceHash,
                previousVersion: previousSnapshot?.version,
                currentVersion,
            });

            changedDocIds.push(normalizedInput.documentId);
            const parsedDocument = this.parseDocument(normalizedInput);
            const snapshot: DocumentSnapshot = {
                documentId: normalizedInput.documentId,
                sourcePath: normalizedInput.sourcePath,
                sourceHash,
                version: currentVersion,
                updatedAt: ingestedAt,
                atomStableKeyToId: new Map<string, string>(),
                atomIds: [],
                evidenceSpanIds: [],
                relationEdgeIds: [],
                temporalEdgeIds: [],
            };

            if (previousSnapshot) {
                this.retireRemovedStableKeys({
                    previousSnapshot,
                    parsedDocument,
                    retiredAt: ingestedAt,
                    responseTemporals,
                });
            }

            for (const draft of parsedDocument.atoms) {
                const evidenceId = this.nextId('evidence');
                const atomId = this.nextId('atom');
                const evidenceSpan: EvidenceSpan = {
                    id: evidenceId,
                    documentId: normalizedInput.documentId,
                    sourcePath: normalizedInput.sourcePath,
                    language: normalizedInput.language,
                    startOffset: draft.startOffset,
                    endOffset: draft.endOffset,
                    startLine: draft.startLine,
                    endLine: draft.endLine,
                    snippet: draft.content.slice(0, 320),
                    sourceHash,
                    createdAt: ingestedAt,
                };
                const atom: KnowledgeAtom = {
                    id: atomId,
                    stableKey: draft.stableKey,
                    documentId: normalizedInput.documentId,
                    sourcePath: normalizedInput.sourcePath,
                    title: draft.title,
                    content: draft.content,
                    keywords: draft.keywords,
                    evidenceSpanIds: [evidenceId],
                    createdAt: ingestedAt,
                    updatedAt: ingestedAt,
                    metadata: {
                        sectionPath: draft.sectionPath,
                        version: currentVersion,
                        sourceHash,
                        language: normalizedInput.language,
                    },
                };
                this.atoms.set(atomId, atom);
                this.evidenceSpans.set(evidenceId, evidenceSpan);
                this.activeAtomIds.add(atomId);
                this.activeStableKeyToAtomId.set(draft.stableKey, atomId);
                snapshot.atomStableKeyToId.set(draft.stableKey, atomId);
                snapshot.atomIds.push(atomId);
                snapshot.evidenceSpanIds.push(evidenceId);
                responseAtoms.push(atom);
                responseEvidence.push(evidenceSpan);
                newAtomIds.push(atomId);

                const outgoingWikiLinks = parsedDocument.wikiLinksByStableKey.get(draft.stableKey) || [];
                wikiLinksByAtomId.set(atomId, outgoingWikiLinks);

                const previousAtomId = previousSnapshot?.atomStableKeyToId.get(draft.stableKey);
                if (previousAtomId && previousAtomId !== atomId) {
                    this.activeAtomIds.delete(previousAtomId);
                    const supersedesEdge = this.createTemporalEdge({
                        sourceAtomId: previousAtomId,
                        targetAtomId: atomId,
                        edgeKind: 'supersedes',
                        validFrom: ingestedAt,
                        sourceDocumentHash: sourceHash,
                        isActive: true,
                    });
                    this.temporalEdges.set(supersedesEdge.id, supersedesEdge);
                    snapshot.temporalEdgeIds.push(supersedesEdge.id);
                    responseTemporals.push(supersedesEdge);
                    this.expireRelationsForAtom(previousAtomId, ingestedAt);
                }
            }

            for (let index = 1; index < snapshot.atomIds.length; index += 1) {
                const relation = this.createRelationEdge({
                    sourceAtomId: snapshot.atomIds[index - 1],
                    targetAtomId: snapshot.atomIds[index],
                    relationKind: 'sequence',
                    provenance: 'fact',
                    confidence: 0.98,
                    evidenceSpanIds: [
                        this.atoms.get(snapshot.atomIds[index - 1])?.evidenceSpanIds[0] || '',
                        this.atoms.get(snapshot.atomIds[index])?.evidenceSpanIds[0] || '',
                    ].filter((id) => id.length > 0),
                    validFrom: ingestedAt,
                });
                if (relation) {
                    snapshot.relationEdgeIds.push(relation.id);
                    responseRelations.push(relation);
                }
            }

            this.documents.set(normalizedInput.documentId, snapshot);
        }

        if (newAtomIds.length > 0) {
            this.rebuildTitleIndex();
            const referenceEdges = this.createReferenceEdges(newAtomIds, wikiLinksByAtomId, ingestedAt);
            referenceEdges.forEach((edge) => responseRelations.push(edge));
            const inferredEdges = this.createInferredEdges(newAtomIds, ingestedAt);
            inferredEdges.forEach((edge) => responseRelations.push(edge));
        }

        return {
            atoms: responseAtoms,
            evidenceSpans: responseEvidence,
            relationEdges: responseRelations,
            temporalEdges: responseTemporals,
            staleness,
            summary: {
                ingestedDocuments: documents.length,
                changedDocuments: changedDocIds.length,
                activeAtoms: this.activeAtomIds.size,
                activeRelationEdges: this.collectActiveRelationEdges(ingestedAt).length,
            },
        };
    }

    public async queryKnowledge(request: KnowledgeQueryRequest): Promise<KnowledgeQueryResponse> {
        const query = normalizeWhitespace(String(request.query || ''));
        const asOf = this.resolveTimestamp(request.asOf);
        const topK = clamp(Math.floor(Number(request.topK) || 5), 1, 20);
        const tokens = tokenize(query);
        const activeEdges = this.collectActiveRelationEdges(asOf);

        const scoredItems: Array<{ atom: KnowledgeAtom; score: number }> = [];
        this.activeAtomIds.forEach((atomId) => {
            const atom = this.atoms.get(atomId);
            if (!atom) {
                return;
            }
            const titleLower = atom.title.toLowerCase();
            const contentLower = atom.content.toLowerCase();
            const keywordMatches = tokens.filter((token) => atom.keywords.includes(token)).length;
            const titleMatchBonus = query && titleLower.includes(query.toLowerCase()) ? 2 : 0;
            const contentMatchBonus = tokens.filter((token) => contentLower.includes(token)).length * 0.25;
            const relationBonus = activeEdges.filter((edge) =>
                edge.sourceAtomId === atom.id || edge.targetAtomId === atom.id
            ).length * 0.08;
            const score = keywordMatches + titleMatchBonus + contentMatchBonus + relationBonus;
            if (score > 0) {
                scoredItems.push({ atom, score });
            }
        });

        scoredItems.sort((left, right) => {
            if (right.score !== left.score) {
                return right.score - left.score;
            }
            return right.atom.updatedAt.localeCompare(left.atom.updatedAt);
        });

        const items: KnowledgeQueryItem[] = scoredItems
            .slice(0, topK)
            .map(({ atom, score }) => {
                const evidenceSpans = atom.evidenceSpanIds
                    .map((evidenceId) => this.evidenceSpans.get(evidenceId))
                    .filter((span): span is EvidenceSpan => Boolean(span));
                const relationPath = this.selectRelationPath(atom.id, activeEdges, 3);
                const temporalValidity = this.evaluateTemporalValidity(atom.id, asOf);
                return {
                    atom,
                    score: Number(score.toFixed(4)),
                    evidenceSpans,
                    relationPath,
                    temporalValidity,
                };
            });

        return {
            items,
            trace: {
                retrievalModes: ['keyword', 'graph_traversal', 'temporal_filter'],
                asOf,
                totalActiveAtoms: this.activeAtomIds.size,
            },
        };
    }

    public async diagnoseMastery(request: MasteryDiagnosticsRequest): Promise<MasteryDiagnosticsResponse> {
        const userId = String(request.userId || '').trim();
        if (!userId) {
            throw new Error('MasteryDiagnosticsAPI requires a non-empty userId.');
        }
        const observedAt = this.resolveTimestamp(request.observedAt);
        const observations = Array.isArray(request.observations) ? request.observations : [];
        const updatedStates: LearnerConceptState[] = [];
        let masteryBefore = 0;
        let masteryAfter = 0;

        for (const observation of observations) {
            if (!isNonEmptyString(observation.atomId)) {
                continue;
            }
            const stateKey = this.makeLearnerStateKey(userId, observation.atomId);
            const previousState = this.learnerStates.get(stateKey) || this.createDefaultLearnerState(userId, observation.atomId, observedAt);
            masteryBefore += previousState.masteryProbability;
            const updatedState = this.applyMasteryObservation(previousState, observation, observedAt);
            masteryAfter += updatedState.masteryProbability;
            this.learnerStates.set(stateKey, updatedState);
            updatedStates.push(updatedState);
        }

        const updatedCount = updatedStates.length;
        return {
            updatedStates,
            summary: {
                updatedCount,
                averageMasteryBefore: updatedCount > 0 ? Number((masteryBefore / updatedCount).toFixed(6)) : 0,
                averageMasteryAfter: updatedCount > 0 ? Number((masteryAfter / updatedCount).toFixed(6)) : 0,
            },
        };
    }

    public async buildLearningPath(request: LearningPathRequest): Promise<LearningPathResponse> {
        const userId = String(request.userId || '').trim();
        if (!userId) {
            throw new Error('LearningPathAPI requires a non-empty userId.');
        }
        const generatedAt = this.resolveTimestamp(request.generatedAt);
        const maxMasteryPaths = clamp(Math.floor(Number(request.maxMasteryPaths) || 3), 1, 12);
        const maxDivergencePaths = clamp(Math.floor(Number(request.maxDivergencePaths) || 3), 1, 12);
        const focusAtomIds = Array.isArray(request.focusAtomIds)
            ? request.focusAtomIds.filter((atomId): atomId is string => isNonEmptyString(atomId) && this.activeAtomIds.has(atomId))
            : [];

        const candidateAtomIds = focusAtomIds.length > 0 ? focusAtomIds : Array.from(this.activeAtomIds);
        const masteryPaths = this.buildMasteryPaths(userId, candidateAtomIds, maxMasteryPaths, generatedAt);
        const divergencePaths = this.buildDivergencePaths(userId, candidateAtomIds, maxDivergencePaths, generatedAt);
        const recommendedActions = [...masteryPaths, ...divergencePaths]
            .flatMap((pathItem) => pathItem.actions)
            .sort((left, right) => right.priority - left.priority)
            .slice(0, 24);

        return {
            masteryPaths,
            divergencePaths,
            recommendedActions,
        };
    }

    public async executeTutorAction(request: TutorActionRequest): Promise<TutorActionResponse> {
        const userId = String(request.userId || '').trim();
        if (!userId) {
            throw new Error('TutorActionAPI requires a non-empty userId.');
        }
        const nowIso = this.resolveTimestamp(undefined);
        let targetAtom: KnowledgeAtom | undefined;

        if (isNonEmptyString(request.atomId)) {
            targetAtom = this.atoms.get(request.atomId);
        }

        if (!targetAtom && isNonEmptyString(request.prompt)) {
            const queryResult = await this.queryKnowledge({
                query: request.prompt,
                topK: 1,
                asOf: nowIso,
            });
            targetAtom = queryResult.items[0]?.atom;
        }

        if (!targetAtom) {
            throw new Error('TutorActionAPI could not resolve target atom.');
        }

        const evidenceSpans = targetAtom.evidenceSpanIds
            .map((evidenceId) => this.evidenceSpans.get(evidenceId))
            .filter((span): span is EvidenceSpan => Boolean(span));
        const neighbors = this.collectNeighborAtomIds(targetAtom.id, 3);
        const suggestedActions = this.buildTutorSuggestedActions(targetAtom.id, evidenceSpans, neighbors);
        const message = this.renderTutorMessage({
            actionKind: request.actionKind,
            atom: targetAtom,
            answer: request.answer,
            prompt: request.prompt,
            neighbors,
            evidenceSpans,
        });
        const trace: TutorTrace = {
            traceId: this.nextId('trace'),
            userId,
            actionKind: request.actionKind,
            atomId: targetAtom.id,
            createdAt: nowIso,
            confidence: this.estimateTutorConfidence(request.actionKind, request.answer, targetAtom),
            evidenceSpanIds: evidenceSpans.map((span) => span.id),
            relationPathAtomIds: neighbors,
            source: 'rule-engine',
            notes: 'Evidence-first response generated by local rule engine.',
        };
        this.tutorTraces.push(trace);

        return {
            message,
            suggestedActions,
            evidenceSpans,
            trace,
        };
    }

    public async applyMemoryPolicy(request: MemoryPolicyRequest): Promise<MemoryPolicyResponse> {
        const userId = String(request.userId || '').trim();
        if (!userId) {
            throw new Error('MemoryPolicyAPI requires a non-empty userId.');
        }
        const layer = request.layer;
        const operation = request.operation;
        const nowIso = this.resolveTimestamp(request.now);
        const bank = this.ensureUserMemoryBank(userId);
        const entries = bank[layer];
        let evictedCount = 0;

        if (operation === 'write') {
            const incomingEntries = Array.isArray(request.entries) ? request.entries : [];
            for (const incomingEntry of incomingEntries) {
                if (!isNonEmptyString(incomingEntry.key) || !isNonEmptyString(incomingEntry.value)) {
                    continue;
                }
                const index = entries.findIndex((entry) => entry.key === incomingEntry.key);
                if (index >= 0) {
                    const current = entries[index];
                    entries[index] = {
                        ...current,
                        value: incomingEntry.value,
                        tags: Array.from(new Set(incomingEntry.tags || current.tags || [])),
                        confidence: clamp(Number(incomingEntry.confidence ?? current.confidence ?? 0.5), 0, 1),
                        references: Array.from(new Set(incomingEntry.references || current.references || [])),
                        updatedAt: nowIso,
                        expiresAt: incomingEntry.expiresAt || current.expiresAt,
                    };
                } else {
                    entries.push({
                        key: incomingEntry.key,
                        value: incomingEntry.value,
                        tags: Array.from(new Set(incomingEntry.tags || [])),
                        confidence: clamp(Number(incomingEntry.confidence ?? 0.5), 0, 1),
                        references: Array.from(new Set(incomingEntry.references || [])),
                        createdAt: incomingEntry.createdAt || nowIso,
                        updatedAt: nowIso,
                        expiresAt: incomingEntry.expiresAt,
                    });
                }
            }
            evictedCount = this.evictMemoryLayer(bank, layer, nowIso);
            return {
                layer,
                operation,
                entries: [...bank[layer]],
                evictedCount,
                stats: this.collectMemoryStats(),
            };
        }

        if (operation === 'evict') {
            evictedCount = this.evictMemoryLayer(bank, layer, nowIso);
            return {
                layer,
                operation,
                entries: [...bank[layer]],
                evictedCount,
                stats: this.collectMemoryStats(),
            };
        }

        if (operation === 'read') {
            const limit = clamp(Math.floor(Number(request.limit) || 20), 1, 100);
            const queryTokens = tokenize(String(request.query || ''));
            const selectedEntries = bank[layer]
                .filter((entry) => {
                    if (!queryTokens.length) {
                        return true;
                    }
                    const haystack = `${entry.key} ${entry.value} ${entry.tags.join(' ')}`.toLowerCase();
                    return queryTokens.every((token) => haystack.includes(token));
                })
                .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
                .slice(0, limit);
            return {
                layer,
                operation,
                entries: selectedEntries,
                evictedCount: 0,
                stats: this.collectMemoryStats(),
            };
        }

        return {
            layer,
            operation: 'snapshot',
            entries: [...bank[layer]],
            evictedCount: 0,
            stats: this.collectMemoryStats(),
        };
    }

    public getKnowledgeState(): KnowledgeSystemState {
        const memoryStats = this.collectMemoryStats();
        return {
            documents: this.documents.size,
            activeAtoms: this.activeAtomIds.size,
            activeRelationEdges: this.collectActiveRelationEdges(this.resolveTimestamp(undefined)).length,
            temporalEdges: this.temporalEdges.size,
            masteryStates: this.learnerStates.size,
            tutorTraces: this.tutorTraces.length,
            memoryEntries: memoryStats,
        };
    }

    private normalizeDocumentInput(input: KnowledgeDocumentInput): Required<KnowledgeDocumentInput> {
        const sourcePath = isNonEmptyString(input.sourcePath) ? input.sourcePath : `untitled_${this.nextId('doc')}.md`;
        const documentId = isNonEmptyString(input.documentId)
            ? input.documentId
            : normalizeIdentifier(sourcePath);
        const language = isNonEmptyString(input.language) ? input.language.trim() : 'unknown';
        return {
            documentId,
            sourcePath: sourcePath.replace(/\\/g, '/'),
            content: String(input.content || ''),
            language,
            updatedAt: this.resolveTimestamp(input.updatedAt),
        };
    }

    private parseDocument(documentInput: Required<KnowledgeDocumentInput>): ParsedDocument {
        const content = documentInput.content || '';
        const rawLines = content.length > 0 ? content.split('\n') : [''];
        const lineStartOffsets: number[] = [];
        let runningOffset = 0;
        for (const rawLine of rawLines) {
            lineStartOffsets.push(runningOffset);
            runningOffset += rawLine.length + 1;
        }

        const atoms: ParsedAtomDraft[] = [];
        const wikiLinksByStableKey = new Map<string, string[]>();
        const sectionStack: string[] = [];
        let currentStartLineIndex = 0;
        let currentTitle = `${path.basename(documentInput.sourcePath)} preamble`;
        let currentSectionPath: string[] = [];

        const flushSegment = (endLineExclusive: number): void => {
            if (endLineExclusive <= currentStartLineIndex) {
                return;
            }
            const startOffset = lineStartOffsets[currentStartLineIndex] || 0;
            const endOffset = endLineExclusive >= rawLines.length
                ? content.length
                : (lineStartOffsets[endLineExclusive] || content.length);
            const segmentContent = normalizeWhitespace(content.slice(startOffset, endOffset));
            if (!segmentContent || !/[A-Za-z0-9\u4e00-\u9fff]/.test(segmentContent)) {
                return;
            }
            const canonicalSectionPath = currentSectionPath.length > 0
                ? [...currentSectionPath]
                : ['preamble'];
            const stableKey = `${documentInput.documentId}::${canonicalSectionPath.join('>').toLowerCase()}`;
            const keywords = tokenize(`${currentTitle} ${segmentContent}`).slice(0, 32);
            const atomDraft: ParsedAtomDraft = {
                stableKey,
                title: currentTitle,
                content: segmentContent,
                sectionPath: canonicalSectionPath,
                startLine: currentStartLineIndex + 1,
                endLine: endLineExclusive,
                startOffset,
                endOffset,
                keywords,
            };
            atoms.push(atomDraft);
            const wikiLinks = Array.from(segmentContent.matchAll(/\[\[([^\]]+)\]\]/g))
                .map((match) => normalizeIdentifier(String(match[1] || '')))
                .filter((target) => target.length > 0);
            if (wikiLinks.length > 0) {
                wikiLinksByStableKey.set(stableKey, wikiLinks);
            }
        };

        for (let index = 0; index < rawLines.length; index += 1) {
            const rawLine = rawLines[index];
            const normalizedLine = rawLine.replace(/\r$/, '');
            const headingMatch = normalizedLine.match(/^\s*(#{1,6})\s+(.+?)\s*$/);
            if (!headingMatch) {
                continue;
            }

            flushSegment(index);
            const level = headingMatch[1].length;
            const headingTitle = normalizeWhitespace(headingMatch[2]);
            while (sectionStack.length >= level) {
                sectionStack.pop();
            }
            sectionStack.push(headingTitle);
            currentSectionPath = [...sectionStack];
            currentTitle = headingTitle;
            currentStartLineIndex = index;
        }

        flushSegment(rawLines.length);

        return {
            atoms,
            wikiLinksByStableKey,
        };
    }

    private retireRemovedStableKeys(params: {
        previousSnapshot: DocumentSnapshot;
        parsedDocument: ParsedDocument;
        retiredAt: string;
        responseTemporals: TemporalEdge[];
    }): void {
        const nextStableKeys = new Set(params.parsedDocument.atoms.map((atom) => atom.stableKey));
        params.previousSnapshot.atomStableKeyToId.forEach((atomId, stableKey) => {
            if (nextStableKeys.has(stableKey)) {
                return;
            }
            this.activeAtomIds.delete(atomId);
            this.activeStableKeyToAtomId.delete(stableKey);
            const temporalEdge = this.createTemporalEdge({
                sourceAtomId: atomId,
                targetAtomId: atomId,
                edgeKind: 'validity_window',
                validFrom: params.retiredAt,
                validTo: params.retiredAt,
                sourceDocumentHash: params.previousSnapshot.sourceHash,
                isActive: false,
            });
            this.temporalEdges.set(temporalEdge.id, temporalEdge);
            params.responseTemporals.push(temporalEdge);
            this.expireRelationsForAtom(atomId, params.retiredAt);
        });
    }

    private createReferenceEdges(
        newAtomIds: string[],
        wikiLinksByAtomId: Map<string, string[]>,
        nowIso: string
    ): RelationEdge[] {
        const created: RelationEdge[] = [];
        for (const sourceAtomId of newAtomIds) {
            const links = wikiLinksByAtomId.get(sourceAtomId) || [];
            for (const linkTitle of links) {
                const targets = this.titleToAtomIds.get(linkTitle);
                if (!targets || targets.size === 0) {
                    continue;
                }
                for (const targetAtomId of targets) {
                    if (targetAtomId === sourceAtomId) {
                        continue;
                    }
                    const sourceAtom = this.atoms.get(sourceAtomId);
                    if (!sourceAtom) {
                        continue;
                    }
                    const relation = this.createRelationEdge({
                        sourceAtomId,
                        targetAtomId,
                        relationKind: 'reference',
                        provenance: 'fact',
                        confidence: 0.85,
                        evidenceSpanIds: [...sourceAtom.evidenceSpanIds],
                        validFrom: nowIso,
                    });
                    if (relation) {
                        created.push(relation);
                    }
                }
            }
        }
        return created;
    }

    private createInferredEdges(newAtomIds: string[], nowIso: string): RelationEdge[] {
        const created: RelationEdge[] = [];
        const candidateTargetIds = Array.from(this.activeAtomIds);
        for (const sourceAtomId of newAtomIds) {
            const sourceAtom = this.atoms.get(sourceAtomId);
            if (!sourceAtom || sourceAtom.keywords.length === 0) {
                continue;
            }
            for (const targetAtomId of candidateTargetIds) {
                if (targetAtomId === sourceAtomId) {
                    continue;
                }
                const targetAtom = this.atoms.get(targetAtomId);
                if (!targetAtom || targetAtom.keywords.length === 0) {
                    continue;
                }
                const jaccard = computeJaccard(sourceAtom.keywords, targetAtom.keywords);
                if (jaccard < 0.32) {
                    continue;
                }
                const relationKind: RelationKind = jaccard >= 0.5 ? 'application' : 'analogy';
                const relation = this.createRelationEdge({
                    sourceAtomId,
                    targetAtomId,
                    relationKind,
                    provenance: 'inferred',
                    confidence: Number(clamp(jaccard, 0.32, 0.95).toFixed(4)),
                    evidenceSpanIds: [...sourceAtom.evidenceSpanIds, ...targetAtom.evidenceSpanIds].slice(0, 4),
                    validFrom: nowIso,
                });
                if (relation) {
                    created.push(relation);
                }
            }
        }
        return created;
    }

    private createRelationEdge(params: {
        sourceAtomId: string;
        targetAtomId: string;
        relationKind: RelationKind;
        provenance: 'fact' | 'inferred';
        confidence: number;
        evidenceSpanIds: string[];
        validFrom: string;
    }): RelationEdge | null {
        const signature = `${params.sourceAtomId}::${params.targetAtomId}::${params.relationKind}::${params.provenance}`;
        if (this.relationEdgeSignatures.has(signature)) {
            return null;
        }
        this.relationEdgeSignatures.add(signature);
        const relationEdge: RelationEdge = {
            id: this.nextId('relation'),
            sourceAtomId: params.sourceAtomId,
            targetAtomId: params.targetAtomId,
            relationKind: params.relationKind,
            provenance: params.provenance,
            confidence: clamp(params.confidence, 0, 1),
            evidenceSpanIds: Array.from(new Set(params.evidenceSpanIds)),
            temporal: {
                validFrom: params.validFrom,
            },
        };
        this.relationEdges.set(relationEdge.id, relationEdge);
        return relationEdge;
    }

    private createTemporalEdge(params: {
        sourceAtomId: string;
        targetAtomId: string;
        edgeKind: TemporalEdge['edgeKind'];
        validFrom: string;
        validTo?: string;
        sourceDocumentHash: string;
        isActive: boolean;
    }): TemporalEdge {
        return {
            id: this.nextId('temporal'),
            sourceAtomId: params.sourceAtomId,
            targetAtomId: params.targetAtomId,
            edgeKind: params.edgeKind,
            validFrom: params.validFrom,
            validTo: params.validTo,
            sourceDocumentHash: params.sourceDocumentHash,
            isActive: params.isActive,
        };
    }

    private expireRelationsForAtom(atomId: string, expiredAt: string): void {
        this.relationEdges.forEach((relation) => {
            if (relation.sourceAtomId !== atomId && relation.targetAtomId !== atomId) {
                return;
            }
            if (!relation.temporal.validTo) {
                relation.temporal.validTo = expiredAt;
            }
        });
    }

    private rebuildTitleIndex(): void {
        this.titleToAtomIds.clear();
        this.activeAtomIds.forEach((atomId) => {
            const atom = this.atoms.get(atomId);
            if (!atom) {
                return;
            }
            const primaryKey = normalizeIdentifier(atom.title);
            if (primaryKey) {
                if (!this.titleToAtomIds.has(primaryKey)) {
                    this.titleToAtomIds.set(primaryKey, new Set<string>());
                }
                this.titleToAtomIds.get(primaryKey)?.add(atomId);
            }
        });
    }

    private collectActiveRelationEdges(asOfIso: string): RelationEdge[] {
        const asOfTime = Date.parse(asOfIso);
        const activeEdges: RelationEdge[] = [];
        this.relationEdges.forEach((edge) => {
            if (!this.activeAtomIds.has(edge.sourceAtomId) || !this.activeAtomIds.has(edge.targetAtomId)) {
                return;
            }
            const validFromTime = Date.parse(edge.temporal.validFrom);
            if (Number.isFinite(validFromTime) && validFromTime > asOfTime) {
                return;
            }
            if (edge.temporal.validTo) {
                const validToTime = Date.parse(edge.temporal.validTo);
                if (Number.isFinite(validToTime) && validToTime < asOfTime) {
                    return;
                }
            }
            activeEdges.push(edge);
        });
        return activeEdges;
    }

    private selectRelationPath(atomId: string, activeEdges: RelationEdge[], limit: number): RelationEdge[] {
        return activeEdges
            .filter((edge) => edge.sourceAtomId === atomId || edge.targetAtomId === atomId)
            .sort((left, right) => right.confidence - left.confidence)
            .slice(0, limit);
    }

    private evaluateTemporalValidity(atomId: string, asOfIso: string): KnowledgeQueryItem['temporalValidity'] {
        const reasons: string[] = [];
        if (!this.activeAtomIds.has(atomId)) {
            reasons.push('atom_not_active');
        } else {
            reasons.push('atom_active');
        }

        const asOfTime = Date.parse(asOfIso);
        this.temporalEdges.forEach((edge) => {
            if (edge.targetAtomId !== atomId) {
                return;
            }
            const validFromTime = Date.parse(edge.validFrom);
            if (Number.isFinite(validFromTime) && validFromTime > asOfTime) {
                reasons.push('temporal_edge_not_started');
            }
            if (edge.validTo) {
                const validToTime = Date.parse(edge.validTo);
                if (Number.isFinite(validToTime) && validToTime < asOfTime) {
                    reasons.push('temporal_edge_expired');
                }
            }
        });

        return {
            isValid: reasons.every((reason) => !reason.endsWith('expired') && reason !== 'atom_not_active'),
            checkedAt: asOfIso,
            reasons,
        };
    }

    private makeLearnerStateKey(userId: string, atomId: string): string {
        return `${userId}::${atomId}`;
    }

    private createDefaultLearnerState(userId: string, atomId: string, nowIso: string): LearnerConceptState {
        return {
            userId,
            atomId,
            masteryProbability: 0.5,
            reviewCount: 0,
            correctCount: 0,
            incorrectCount: 0,
            partialCount: 0,
            skippedCount: 0,
            lastOutcome: null,
            lastUpdatedAt: nowIso,
            nextReviewAt: plusDays(nowIso, 3),
            errorTags: [],
        };
    }

    private applyMasteryObservation(
        state: LearnerConceptState,
        observation: MasteryObservation,
        observedAt: string
    ): LearnerConceptState {
        const nextState: LearnerConceptState = {
            ...state,
            reviewCount: state.reviewCount + 1,
            lastOutcome: observation.outcome,
            lastUpdatedAt: observedAt,
            errorTags: [...state.errorTags],
        };
        const confidence = clamp(Number(observation.confidence ?? 0.7), 0, 1);
        const previousMastery = state.masteryProbability;
        let mastery = previousMastery;

        if (observation.outcome === 'correct') {
            nextState.correctCount += 1;
            mastery += (1 - mastery) * (0.16 + confidence * 0.08);
        } else if (observation.outcome === 'partial') {
            nextState.partialCount += 1;
            mastery += (1 - mastery) * (0.06 + confidence * 0.04);
            if (observation.errorTag) {
                nextState.errorTags.push(observation.errorTag);
            }
        } else if (observation.outcome === 'incorrect') {
            nextState.incorrectCount += 1;
            mastery -= mastery * (0.22 + (1 - confidence) * 0.08);
            if (observation.errorTag) {
                nextState.errorTags.push(observation.errorTag);
            } else {
                nextState.errorTags.push('incorrect_answer');
            }
        } else {
            nextState.skippedCount += 1;
            mastery -= mastery * 0.12;
            nextState.errorTags.push('skipped');
        }

        nextState.masteryProbability = Number(clamp(mastery, 0.01, 0.99).toFixed(6));
        nextState.errorTags = Array.from(new Set(nextState.errorTags)).slice(0, 12);
        nextState.nextReviewAt = this.calculateNextReviewAt(observedAt, nextState.masteryProbability);
        return nextState;
    }

    private calculateNextReviewAt(baseIso: string, masteryProbability: number): string {
        if (masteryProbability < 0.35) {
            return plusDays(baseIso, 1);
        }
        if (masteryProbability < 0.6) {
            return plusDays(baseIso, 3);
        }
        if (masteryProbability < 0.8) {
            return plusDays(baseIso, 7);
        }
        return plusDays(baseIso, 14);
    }

    private buildMasteryPaths(
        userId: string,
        candidateAtomIds: string[],
        maxPaths: number,
        generatedAt: string
    ): Array<{
        id: string;
        targetAtomId: string;
        priority: number;
        expectedMasteryGain: number;
        actions: LearningAction[];
    }> {
        const scored = candidateAtomIds
            .map((atomId) => {
                const state = this.learnerStates.get(this.makeLearnerStateKey(userId, atomId))
                    || this.createDefaultLearnerState(userId, atomId, generatedAt);
                return { atomId, mastery: state.masteryProbability };
            })
            .sort((left, right) => left.mastery - right.mastery)
            .slice(0, maxPaths);

        return scored.map((item, index) => {
            const expectedGain = Number((0.75 - item.mastery).toFixed(4));
            const actions = this.buildMasteryActions(item.atomId, expectedGain, index + 1);
            return {
                id: this.nextId('mastery_path'),
                targetAtomId: item.atomId,
                priority: 100 - index * 5,
                expectedMasteryGain: expectedGain,
                actions,
            };
        });
    }

    private buildMasteryActions(atomId: string, expectedGain: number, rank: number): LearningAction[] {
        const atom = this.atoms.get(atomId);
        const evidenceSpanIds = atom?.evidenceSpanIds || [];
        return [
            this.createLearningAction({
                kind: 'review',
                atomId,
                priority: 100 - rank * 2,
                expectedGain: expectedGain * 0.5,
                rationale: 'Review source evidence first to rebuild grounded understanding.',
                evidenceSpanIds,
                relationPathAtomIds: [atomId],
                estimatedMinutes: 8,
            }),
            this.createLearningAction({
                kind: 'quiz',
                atomId,
                priority: 95 - rank * 2,
                expectedGain: expectedGain * 0.3,
                rationale: 'Run retrieval practice to validate stable recall.',
                evidenceSpanIds,
                relationPathAtomIds: [atomId],
                estimatedMinutes: 6,
            }),
            this.createLearningAction({
                kind: 'explain',
                atomId,
                priority: 90 - rank * 2,
                expectedGain: expectedGain * 0.2,
                rationale: 'Self-explanation consolidates concept boundaries and misconceptions.',
                evidenceSpanIds,
                relationPathAtomIds: [atomId],
                estimatedMinutes: 6,
            }),
        ];
    }

    private buildDivergencePaths(
        userId: string,
        candidateAtomIds: string[],
        maxPaths: number,
        generatedAt: string
    ): DivergencePath[] {
        const focusSet = new Set(candidateAtomIds);
        const activeEdges = this.collectActiveRelationEdges(generatedAt)
            .filter((edge) =>
                focusSet.has(edge.sourceAtomId)
                && (edge.relationKind === 'analogy' || edge.relationKind === 'application' || edge.relationKind === 'contrast' || edge.relationKind === 'causal')
            );
        const scored = activeEdges
            .map((edge) => {
                const targetState = this.learnerStates.get(this.makeLearnerStateKey(userId, edge.targetAtomId))
                    || this.createDefaultLearnerState(userId, edge.targetAtomId, generatedAt);
                const novelty = 1 - targetState.masteryProbability;
                const score = edge.confidence * 0.6 + novelty * 0.4;
                return { edge, score, novelty };
            })
            .sort((left, right) => right.score - left.score)
            .slice(0, maxPaths);

        return scored.map((item, index) => ({
            id: this.nextId('divergence_path'),
            sourceAtomId: item.edge.sourceAtomId,
            targetAtomId: item.edge.targetAtomId,
            priority: 80 - index * 3,
            expectedExplorationGain: Number(item.novelty.toFixed(4)),
            actions: [
                this.createLearningAction({
                    kind: 'transfer',
                    atomId: item.edge.targetAtomId,
                    priority: 78 - index * 3,
                    expectedGain: Number((item.novelty * 0.55).toFixed(4)),
                    rationale: 'Apply the concept in a new context to build transfer strength.',
                    evidenceSpanIds: item.edge.evidenceSpanIds,
                    relationPathAtomIds: [item.edge.sourceAtomId, item.edge.targetAtomId],
                    estimatedMinutes: 10,
                }),
                this.createLearningAction({
                    kind: 'counterexample',
                    atomId: item.edge.targetAtomId,
                    priority: 74 - index * 3,
                    expectedGain: Number((item.novelty * 0.45).toFixed(4)),
                    rationale: 'Generate counterexamples to sharpen concept boundaries.',
                    evidenceSpanIds: item.edge.evidenceSpanIds,
                    relationPathAtomIds: [item.edge.sourceAtomId, item.edge.targetAtomId],
                    estimatedMinutes: 8,
                }),
            ],
        }));
    }

    private createLearningAction(params: {
        kind: LearningActionKind;
        atomId: string;
        priority: number;
        expectedGain: number;
        rationale: string;
        evidenceSpanIds: string[];
        relationPathAtomIds: string[];
        estimatedMinutes: number;
    }): LearningAction {
        return {
            id: this.nextId('action'),
            kind: params.kind,
            atomId: params.atomId,
            priority: params.priority,
            expectedGain: Number(params.expectedGain.toFixed(4)),
            rationale: params.rationale,
            evidenceSpanIds: Array.from(new Set(params.evidenceSpanIds)),
            relationPathAtomIds: Array.from(new Set(params.relationPathAtomIds)),
            estimatedMinutes: params.estimatedMinutes,
        };
    }

    private collectNeighborAtomIds(atomId: string, limit: number): string[] {
        const edges = this.collectActiveRelationEdges(this.resolveTimestamp(undefined))
            .filter((edge) => edge.sourceAtomId === atomId || edge.targetAtomId === atomId)
            .sort((left, right) => right.confidence - left.confidence);
        const neighborIds: string[] = [];
        for (const edge of edges) {
            const neighbor = edge.sourceAtomId === atomId ? edge.targetAtomId : edge.sourceAtomId;
            if (!neighborIds.includes(neighbor)) {
                neighborIds.push(neighbor);
            }
            if (neighborIds.length >= limit) {
                break;
            }
        }
        return neighborIds;
    }

    private buildTutorSuggestedActions(atomId: string, evidenceSpans: EvidenceSpan[], neighbors: string[]): LearningAction[] {
        return [
            this.createLearningAction({
                kind: 'quiz',
                atomId,
                priority: 88,
                expectedGain: 0.24,
                rationale: 'Immediate retrieval practice to test current mastery.',
                evidenceSpanIds: evidenceSpans.map((span) => span.id),
                relationPathAtomIds: [atomId, ...neighbors],
                estimatedMinutes: 7,
            }),
            this.createLearningAction({
                kind: 'reflection',
                atomId,
                priority: 82,
                expectedGain: 0.17,
                rationale: 'Reflect on misunderstandings and bind corrections to evidence.',
                evidenceSpanIds: evidenceSpans.map((span) => span.id),
                relationPathAtomIds: [atomId],
                estimatedMinutes: 5,
            }),
        ];
    }

    private renderTutorMessage(params: {
        actionKind: TutorActionRequest['actionKind'];
        atom: KnowledgeAtom;
        prompt?: string;
        answer?: string;
        neighbors: string[];
        evidenceSpans: EvidenceSpan[];
    }): string {
        const firstEvidence = params.evidenceSpans[0]?.snippet || params.atom.content.slice(0, 220);
        if (params.actionKind === 'generate_quiz') {
            return [
                `Question: Explain the core idea of "${params.atom.title}" in your own words.`,
                'Constraint: include one evidence-backed statement from the source.',
                `Evidence hint: ${firstEvidence}`,
            ].join('\n');
        }
        if (params.actionKind === 'analyze_answer') {
            const answerTokens = tokenize(String(params.answer || ''));
            const keywordOverlap = answerTokens.filter((token) => params.atom.keywords.includes(token)).length;
            const quality = keywordOverlap >= 3 ? 'strong' : (keywordOverlap >= 1 ? 'partial' : 'weak');
            return [
                `Answer quality: ${quality}.`,
                `Matched keywords: ${keywordOverlap}/${params.atom.keywords.length}.`,
                `Repair focus: align your reasoning with this evidence: ${firstEvidence}`,
            ].join('\n');
        }
        if (params.actionKind === 'follow_up') {
            const neighborTitle = params.neighbors
                .map((atomId) => this.atoms.get(atomId)?.title)
                .find((title): title is string => Boolean(title))
                || 'a related concept';
            return [
                `Follow-up: compare "${params.atom.title}" with "${neighborTitle}".`,
                'Prompt: identify one shared mechanism and one critical difference.',
                `Evidence anchor: ${firstEvidence}`,
            ].join('\n');
        }
        return [
            `Recap for "${params.atom.title}":`,
            `- Key evidence: ${firstEvidence}`,
            '- Suggested next move: apply the concept to a transfer task and verify against source.',
        ].join('\n');
    }

    private estimateTutorConfidence(
        actionKind: TutorActionRequest['actionKind'],
        answer: string | undefined,
        atom: KnowledgeAtom
    ): number {
        if (actionKind === 'analyze_answer') {
            const overlap = tokenize(String(answer || '')).filter((token) => atom.keywords.includes(token)).length;
            return Number(clamp(0.42 + overlap * 0.08, 0.42, 0.92).toFixed(4));
        }
        if (actionKind === 'follow_up') {
            return 0.74;
        }
        if (actionKind === 'recap') {
            return 0.87;
        }
        return 0.81;
    }

    private ensureUserMemoryBank(userId: string): UserMemoryBank {
        if (!this.userMemory.has(userId)) {
            this.userMemory.set(userId, {
                session: [],
                unit: [],
                long_term: [],
            });
        }
        return this.userMemory.get(userId) as UserMemoryBank;
    }

    private evictMemoryLayer(bank: UserMemoryBank, layer: MemoryLayer, nowIso: string): number {
        const entries = bank[layer];
        const beforeCount = entries.length;
        const nowTime = Date.parse(nowIso);
        const surviving = entries.filter((entry) => {
            if (!entry.expiresAt) {
                return true;
            }
            const expiresAt = Date.parse(entry.expiresAt);
            if (!Number.isFinite(expiresAt)) {
                return true;
            }
            return expiresAt > nowTime;
        });

        surviving.sort((left, right) => {
            if (left.confidence !== right.confidence) {
                return left.confidence - right.confidence;
            }
            return left.updatedAt.localeCompare(right.updatedAt);
        });

        const capacity = MEMORY_LAYER_CAPACITY[layer];
        while (surviving.length > capacity) {
            surviving.shift();
        }

        bank[layer] = surviving;
        return beforeCount - surviving.length;
    }

    private collectMemoryStats(): MemoryStats {
        const stats: MemoryStats = {
            session: 0,
            unit: 0,
            longTerm: 0,
        };
        this.userMemory.forEach((bank) => {
            stats.session += bank.session.length;
            stats.unit += bank.unit.length;
            stats.longTerm += bank.long_term.length;
        });
        return stats;
    }

    private resolveTimestamp(preferred: string | undefined): string {
        if (isNonEmptyString(preferred)) {
            const parsed = new Date(preferred);
            if (!Number.isNaN(parsed.getTime())) {
                return parsed.toISOString();
            }
        }
        return this.nowProvider().toISOString();
    }

    private computeHash(content: string): string {
        return createHash('sha256').update(content).digest('hex');
    }

    private nextId(prefix: string): string {
        this.idCounter += 1;
        return `${prefix}_${this.idCounter.toString(36)}`;
    }
}

export function createKnowledgeLearningPlatform(): KnowledgeLearningPlatform {
    return new KnowledgeLearningPlatform();
}
