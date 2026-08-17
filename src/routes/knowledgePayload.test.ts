import { KnowledgePayloadError, parseKnowledgeIngestBody } from './knowledgePayload';

describe('knowledge HTTP payload contract', () => {
    test('normalizes legacy aliases while preserving portable identity fields', () => {
        const request = parseKnowledgeIngestBody(JSON.stringify({
            docs: [{
                id: 'legacy-doc',
                path: 'Knowledge_Base/one.md',
                text: '# One',
                uri: 'note://workspace/v1/one.md',
                source_revision: 'sha256:one',
                aliases: ['one', 'notes/one.md'],
            }],
        }));

        expect(request.documents?.[0]).toEqual(expect.objectContaining({
            documentId: 'legacy-doc',
            sourcePath: 'Knowledge_Base/one.md',
            sourceUri: 'note://workspace/v1/one.md',
            revision: 'sha256:one',
            identityAliases: ['one', 'notes/one.md'],
            content: '# One',
        }));
    });

    test('accepts explicit move operations for replay', () => {
        const request = parseKnowledgeIngestBody(JSON.stringify({
            operations: [{
                op: 'rename',
                document: {
                    documentId: 'doc-1',
                    fromSourcePath: 'old.md',
                    toSourcePath: 'new.md',
                    toSourceUri: 'note://workspace/v1/new.md',
                },
            }],
        }));

        expect(request.operations).toEqual([expect.objectContaining({
            op: 'move',
            document: expect.objectContaining({
                documentId: 'doc-1',
                toSourcePath: 'new.md',
            }),
        })]);
    });

    test('rejects malformed identity arrays and oversized documents at the edge', () => {
        expect(() => parseKnowledgeIngestBody(JSON.stringify({
            documents: [{ content: '# invalid', aliases: ['ok', 3] }],
        }))).toThrow(KnowledgePayloadError);

        expect(() => parseKnowledgeIngestBody(JSON.stringify({
            documents: [{ content: 'x'.repeat(64 * 1024 * 1024 + 1) }],
        }))).toThrow(/exceeds 67108864 bytes/);
    });
});
