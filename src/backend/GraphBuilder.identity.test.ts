import { GraphBuilder } from './GraphBuilder';
import { config } from './config';
import { RawFile } from './FileLoader';

describe('GraphBuilder identity compatibility', () => {
    const originalConfig = {
        ...config,
        exclusionList: [...config.exclusionList],
    };

    beforeEach(() => {
        config.enableTags = false;
        config.enableStatisticalInference = false;
        config.enableVectorSimilarity = false;
        config.enableHybridInference = false;
        config.enableGPU = false;
        config.enableGPULayout = false;
        config.clusteringStrategy = 'folder';
        config.exclusionList = [];
    });

    afterEach(() => {
        Object.assign(config, originalConfig);
    });

    test('preserves identity metadata, reads URI frontmatter, and accepts URI layouts', async () => {
        const files: RawFile[] = [
            {
                filepath: 'workspace/algebra/a.md',
                filename: 'A',
                content: '# A',
                relativePath: 'algebra/a.md',
                sourceUri: 'note://workspace/v1/algebra/a.md',
                canonicalId: 'algebra/a',
                revision: 'sha256:a',
                identityAliases: ['A', 'algebra/a.md'],
            },
            {
                filepath: 'workspace/algebra/b.md',
                filename: 'B',
                content: '---\nprerequisites:\n  - note://workspace/v1/algebra/a.md\n---\n# B',
                relativePath: 'algebra/b.md',
                sourceUri: 'note://workspace/v1/algebra/b.md',
                revision: 'sha256:b',
                identityAliases: ['B', 'algebra/b.md'],
            },
        ];

        const graph = await GraphBuilder.build(files, new Map([
            ['note://workspace/v1/algebra/a.md', { x: 12, y: 34 }],
        ]));

        expect(graph.getNode('A')).toEqual(expect.objectContaining({
            sourceUri: 'note://workspace/v1/algebra/a.md',
            canonicalId: 'algebra/a',
            revision: 'sha256:a',
            identityAliases: expect.arrayContaining(['algebra/a.md']),
            x: 12,
            y: 34,
        }));
        expect(graph.getIncomingEdges('B')).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'A', target: 'B', type: 'explicit-prerequisite' }),
        ]));
    });

    test('uses indexed keyword candidates without changing exact-match semantics', async () => {
        const files: RawFile[] = [
            {
                filepath: 'workspace/alpha.md',
                filename: 'Alpha',
                content: 'Alpha is a prerequisite concept.',
            },
            {
                filepath: 'workspace/context.md',
                filename: 'Context',
                content: 'This context mentions Alpha as an explicit phrase.',
            },
            {
                filepath: 'workspace/beta.md',
                filename: 'Beta',
                content: 'This context mentions alphabet but not the standalone concept.',
            },
        ];

        const graph = await GraphBuilder.build(files);
        expect(graph.getOutgoingEdges('Alpha')).toEqual(expect.arrayContaining([
            expect.objectContaining({ target: 'Context', type: 'keyword-match' }),
        ]));
        expect(graph.getOutgoingEdges('Alpha')).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ target: 'Beta', type: 'keyword-match' }),
        ]));
    });
});
