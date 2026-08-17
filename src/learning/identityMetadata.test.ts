import { KnowledgeLearningPlatform } from './KnowledgeLearningPlatform';

describe('knowledge document identity metadata', () => {
    test('deletes a document through its portable source URI after ingest', async () => {
        const platform = new KnowledgeLearningPlatform(() => new Date('2026-08-17T00:00:00.000Z'));

        await platform.ingestKnowledge({
            incremental: true,
            documents: [{
                documentId: 'legacy_doc',
                sourcePath: 'Knowledge_Base/notes/identity.md',
                sourceUri: 'note://workspace/v1/notes/identity.md',
                revision: 'sha256:identity-revision',
                identityAliases: ['identity', 'notes/identity.md'],
                content: '# Identity\nPortable identity metadata stays additive.',
            }],
        });

        const deleted = await platform.ingestKnowledge({
            incremental: true,
            deletedDocuments: [{ sourceUri: 'note://workspace/v1/notes/identity.md' }],
        });

        expect(deleted.summary.deletedDocuments).toBe(1);
        expect(deleted.staleness[0]?.documentId).toBe('legacy_doc');
        expect(deleted.staleness[0]?.status).toBe('deleted');
    });
});
