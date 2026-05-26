import type { KnowledgeAtom } from '../learning/types';

export interface DocumentUnitDraft {
    documentId: string;
    sourcePath: string;
    language: string;
    workspaceId: string | null;
    corpusId: string | null;
    title: string;
    content: string;
}

export interface BuiltUnitDraft {
    documentId: string | null;
    atomId: string | null;
    sourcePath: string;
    language: string;
    workspaceId: string | null;
    corpusId: string | null;
    title: string;
    content: string;
    unitKind: 'knowledge_document' | 'knowledge_atom';
    unitIndex: number;
    contentHash: string;
}

export class UnitBuilder {
    public constructor(private readonly computeHash: (value: string) => string) {}

    public buildDocumentAndAtomUnits(
        document: DocumentUnitDraft,
        atoms: KnowledgeAtom[]
    ): BuiltUnitDraft[] {
        const units: BuiltUnitDraft[] = [];
        const normalizedDocumentContent = String(document.content || '').trim();
        if (normalizedDocumentContent) {
            units.push({
                documentId: document.documentId,
                atomId: null,
                sourcePath: document.sourcePath,
                language: document.language,
                workspaceId: document.workspaceId,
                corpusId: document.corpusId,
                title: document.title,
                content: normalizedDocumentContent,
                unitKind: 'knowledge_document',
                unitIndex: 0,
                contentHash: this.computeHash(normalizedDocumentContent),
            });
        }

        atoms.forEach((atom, index) => {
            const normalizedContent = String(atom.content || '').trim();
            if (!normalizedContent) {
                return;
            }
            units.push({
                documentId: atom.documentId,
                atomId: atom.id,
                sourcePath: atom.sourcePath,
                language: String(atom.metadata?.language || document.language || 'unknown').trim() || 'unknown',
                workspaceId: document.workspaceId,
                corpusId: document.corpusId,
                title: atom.title,
                content: normalizedContent,
                unitKind: 'knowledge_atom',
                unitIndex: index + 1,
                contentHash: this.computeHash(normalizedContent),
            });
        });

        return units;
    }
}
