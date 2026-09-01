import {
    buildKnowledgeSourceInventoryDiff,
    deriveKnowledgeTargetLookupQueries,
    markdownPreviewMatchesTitleLikeQueries,
} from './workspaceHydration';

describe('workspaceHydration', () => {
    test('detects source files that exist on disk but are absent from the indexed workspace', () => {
        const diff = buildKnowledgeSourceInventoryDiff({
            diskSourcePaths: [
                'Knowledge_Base/waterglass/water glass.md',
                'Knowledge_Base/waterglass/Amorphous ice.md',
            ],
            indexedSourcePaths: [
                'knowledge_base\\waterglass\\water glass.md',
            ],
        });

        expect(diff.addedSourcePaths).toEqual([
            'Knowledge_Base/waterglass/Amorphous ice.md',
        ]);
        expect(diff.removedSourcePaths).toEqual([]);
    });

    test('matches a Chinese heading when the file basename uses the English concept name', () => {
        expect(markdownPreviewMatchesTitleLikeQueries({
            sourcePath: 'Knowledge_Base/waterglass/Amorphous ice.md',
            preview: '## 非晶冰\n\n非晶冰（Amorphous ice）是水的一种固态形式。',
            titleLikeQueries: ['非晶冰'],
        })).toBe(true);
    });

    test('keeps the definition subject from a compound Chinese conversation query', () => {
        expect(deriveKnowledgeTargetLookupQueries('什么是非晶冰？我应该通过哪些知识点学习？')).toEqual(
            expect.arrayContaining(['非晶冰'])
        );
    });
});
