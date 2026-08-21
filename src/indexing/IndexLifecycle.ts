import { SegmentBuilder } from './SegmentBuilder';
import type {
    IndexLifecycleSnapshot,
    IndexLifecycleSummary,
    IndexLifecycleState,
    IndexSegmentRecord,
    IndexUnitRecord,
} from './types';
import { UnitBuilder } from './UnitBuilder';
import type { KnowledgeAtom } from '../learning/types';

type NextId = (prefix?: string) => string;

export class IndexLifecycle {
    private readonly units = new Map<string, IndexUnitRecord>();

    private readonly segments = new Map<string, IndexSegmentRecord>();

    private readonly unitIdsByDocumentId = new Map<string, string[]>();

    private readonly segmentIdsByAtomId = new Map<string, string[]>();

    private readonly unitBuilder: UnitBuilder;

    private readonly segmentBuilder: SegmentBuilder;

    public constructor(
        private readonly nextId: NextId,
        private readonly computeHash: (value: string) => string
    ) {
        this.unitBuilder = new UnitBuilder(computeHash);
        this.segmentBuilder = new SegmentBuilder(computeHash);
    }

    public syncDocumentIndex(input: {
        resourceId: string;
        projectionId: string;
        documentId: string;
        sourcePath: string;
        language: string;
        workspaceId: string | null;
        corpusId: string | null;
        title: string;
        content: string;
        atoms: KnowledgeAtom[];
        indexedAt: string;
    }): {
        units: IndexUnitRecord[];
        segments: IndexSegmentRecord[];
    } {
        this.retireDocumentIndex(input.documentId);
        const unitDrafts = this.unitBuilder.buildDocumentAndAtomUnits({
            documentId: input.documentId,
            sourcePath: input.sourcePath,
            language: input.language,
            workspaceId: input.workspaceId,
            corpusId: input.corpusId,
            title: input.title,
            content: input.content,
        }, input.atoms);

        const createdUnits: IndexUnitRecord[] = [];
        const createdSegments: IndexSegmentRecord[] = [];

        unitDrafts.forEach((draft) => {
            const unitId = this.nextId('idx_unit');
            const builtSegments = this.segmentBuilder.buildSegments(draft.content);
            const segmentIds: string[] = [];
            builtSegments.forEach((segmentDraft) => {
                const segmentId = this.nextId('idx_segment');
                const segment: IndexSegmentRecord = {
                    segmentId,
                    unitId,
                    resourceId: input.resourceId,
                    projectionId: input.projectionId,
                    documentId: draft.documentId,
                    atomId: draft.atomId,
                    workspaceId: draft.workspaceId,
                    corpusId: draft.corpusId,
                    modality: 'text',
                    segmentIndex: segmentDraft.segmentIndex,
                    content: segmentDraft.content,
                    contentHash: segmentDraft.contentHash,
                    tokenCount: segmentDraft.tokenCount,
                    state: 'indexed',
                    error: null,
                    representationVersion: 'noteconnection-index-segment-v1',
                    createdAt: input.indexedAt,
                    updatedAt: input.indexedAt,
                };
                this.segments.set(segmentId, segment);
                createdSegments.push(segment);
                segmentIds.push(segmentId);
            });

            const unit: IndexUnitRecord = {
                unitId,
                resourceId: input.resourceId,
                projectionId: input.projectionId,
                documentId: draft.documentId,
                atomId: draft.atomId,
                workspaceId: draft.workspaceId,
                corpusId: draft.corpusId,
                sourcePath: draft.sourcePath,
                language: draft.language,
                title: draft.title,
                content: draft.content,
                unitKind: draft.unitKind,
                unitIndex: draft.unitIndex,
                contentHash: draft.contentHash,
                state: 'indexed',
                error: null,
                segmentIds,
                createdAt: input.indexedAt,
                updatedAt: input.indexedAt,
            };
            this.units.set(unitId, unit);
            createdUnits.push(unit);
            const existingUnitIds = this.unitIdsByDocumentId.get(input.documentId) || [];
            existingUnitIds.push(unitId);
            this.unitIdsByDocumentId.set(input.documentId, existingUnitIds);
            if (draft.atomId) {
                this.segmentIdsByAtomId.set(draft.atomId, [...segmentIds]);
            }
        });

        return {
            units: createdUnits,
            segments: createdSegments,
        };
    }

    public retireDocumentIndex(documentId: string): void {
        const unitIds = this.unitIdsByDocumentId.get(String(documentId || '').trim()) || [];
        unitIds.forEach((unitId) => {
            const unit = this.units.get(unitId);
            if (!unit) {
                return;
            }
            if (unit.atomId) {
                this.segmentIdsByAtomId.delete(unit.atomId);
            }
            unit.segmentIds.forEach((segmentId) => {
                this.segments.delete(segmentId);
            });
            this.units.delete(unitId);
        });
        this.unitIdsByDocumentId.delete(String(documentId || '').trim());
    }

    /**
     * Moves the indexed path in place. Rebuilding units would allocate new
     * segments and make a path-only identity transition look like content
     * churn, so the existing index identity is deliberately preserved.
     */
    public updateDocumentSourcePath(documentId: string, sourcePath: string, updatedAt: string): number {
        const unitIds = this.unitIdsByDocumentId.get(String(documentId || '').trim()) || [];
        let updatedCount = 0;
        unitIds.forEach((unitId) => {
            const unit = this.units.get(unitId);
            if (!unit) {
                return;
            }
            this.units.set(unitId, {
                ...unit,
                sourcePath,
                updatedAt,
            });
            updatedCount += 1;
        });
        return updatedCount;
    }

    public listSegmentsForAtom(atomId: string): IndexSegmentRecord[] {
        const segmentIds = this.segmentIdsByAtomId.get(String(atomId || '').trim()) || [];
        return segmentIds
            .map((segmentId) => this.segments.get(segmentId))
            .filter((segment): segment is IndexSegmentRecord => Boolean(segment));
    }

    public listUnitsByProjectionIds(projectionIds: string[]): IndexUnitRecord[] {
        const allowedProjectionIds = new Set(
            projectionIds
                .map((projectionId) => String(projectionId || '').trim())
                .filter(Boolean)
        );
        if (allowedProjectionIds.size <= 0) {
            return [];
        }
        return Array.from(this.units.values())
            .filter((unit) => allowedProjectionIds.has(unit.projectionId))
            .sort((left, right) => left.unitId.localeCompare(right.unitId));
    }

    public listSegmentsByUnitIds(unitIds: string[]): IndexSegmentRecord[] {
        const allowedUnitIds = new Set(
            unitIds
                .map((unitId) => String(unitId || '').trim())
                .filter(Boolean)
        );
        if (allowedUnitIds.size <= 0) {
            return [];
        }
        return Array.from(this.segments.values())
            .filter((segment) => allowedUnitIds.has(segment.unitId))
            .sort((left, right) => left.segmentId.localeCompare(right.segmentId));
    }

    public hasIndexedSegmentsForAtom(atomId: string): boolean {
        return this.listSegmentsForAtom(atomId).some((segment) => segment.state === 'indexed');
    }

    public buildSummary(): IndexLifecycleSummary {
        const states: Record<IndexLifecycleState, number> = {
            pending: 0,
            indexing: 0,
            indexed: 0,
            failed: 0,
            disabled: 0,
        };
        this.units.forEach((unit) => {
            states[unit.state] += 1;
        });
        return {
            totalUnits: this.units.size,
            totalSegments: this.segments.size,
            states,
            activeDocuments: this.unitIdsByDocumentId.size,
            activeAtomUnits: Array.from(this.units.values()).filter((unit) => unit.atomId !== null).length,
        };
    }

    public buildSnapshot(): IndexLifecycleSnapshot {
        return {
            units: Array.from(this.units.values()).map((unit) => ({
                ...unit,
                segmentIds: [...unit.segmentIds],
            })),
            segments: Array.from(this.segments.values()).map((segment) => ({ ...segment })),
        };
    }

    public restoreFromSnapshot(snapshot: IndexLifecycleSnapshot | null | undefined): void {
        this.units.clear();
        this.segments.clear();
        this.unitIdsByDocumentId.clear();
        this.segmentIdsByAtomId.clear();
        (snapshot?.segments || []).forEach((segment) => {
            this.segments.set(segment.segmentId, { ...segment });
        });
        (snapshot?.units || []).forEach((unit) => {
            this.units.set(unit.unitId, {
                ...unit,
                segmentIds: [...unit.segmentIds],
            });
            if (unit.documentId) {
                const existingUnitIds = this.unitIdsByDocumentId.get(unit.documentId) || [];
                existingUnitIds.push(unit.unitId);
                this.unitIdsByDocumentId.set(unit.documentId, existingUnitIds);
            }
            if (unit.atomId) {
                this.segmentIdsByAtomId.set(unit.atomId, [...unit.segmentIds]);
            }
        });
    }
}
