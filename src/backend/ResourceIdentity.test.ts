import {
    assertUniqueLegacyResourceIds,
    createResourceIdentity,
    normalizeResourceRelativePath,
} from './ResourceIdentity';

describe('Resource identity boundary', () => {
    test('normalizes workspace-relative paths to POSIX separators', () => {
        const root = 'C:\\workspace\\Knowledge_Base';
        const filePath = 'C:\\workspace\\Knowledge_Base\\algebra\\index.md';

        expect(normalizeResourceRelativePath(root, filePath)).toBe('algebra/index.md');
    });

    test('rejects a path outside the workspace root', () => {
        expect(() => normalizeResourceRelativePath('C:\\workspace\\Knowledge_Base', 'C:\\workspace\\other.md'))
            .toThrow(/outside workspace root/i);
    });

    test('fails before graph construction when legacy basenames collide', () => {
        expect(() => assertUniqueLegacyResourceIds([
            { filename: 'index', filepath: 'algebra/index.md' },
            { filename: 'index', filepath: 'physics/index.md' },
        ])).toThrow(/index.*algebra\/index\.md.*physics\/index\.md/i);
    });

    test('accepts unique legacy IDs', () => {
        expect(() => assertUniqueLegacyResourceIds([
            { filename: 'algebra-index', filepath: 'algebra/index.md' },
            { filename: 'physics-index', filepath: 'physics/index.md' },
        ])).not.toThrow();
    });

    test('builds a versioned portable source URI and stable content revision', () => {
        const identity = createResourceIdentity('Algebra Notes\\Index #1.MD', 'Index #1', '# Algebra');

        expect(identity.sourceUri).toBe('note://workspace/v1/algebra%20notes/index%20%231.md');
        expect(identity.revision).toMatch(/^sha256:[0-9a-f]{64}$/);
        expect(identity.identityAliases).toEqual(expect.arrayContaining([
            'Index #1',
            'Algebra Notes/Index #1.MD',
            'algebra notes/index #1.md',
        ]));
    });

    test('keeps the revision stable for equal content and changes it for different content', () => {
        const first = createResourceIdentity('notes/a.md', 'a', 'same');
        const same = createResourceIdentity('notes/a.md', 'a', 'same');
        const changed = createResourceIdentity('notes/a.md', 'a', 'changed');

        expect(same.revision).toBe(first.revision);
        expect(changed.revision).not.toBe(first.revision);
    });

    test('rejects unsafe relative source paths', () => {
        expect(() => createResourceIdentity('../outside.md', 'outside', 'content'))
            .toThrow(/relative resource path/i);
        expect(() => createResourceIdentity('notes/\0.md', 'nul', 'content'))
            .toThrow(/NUL/i);
    });

    test('rejects case-folded legacy collisions for cross-platform determinism', () => {
        expect(() => assertUniqueLegacyResourceIds([
            { filename: 'Index', filepath: 'Algebra/Index.md' },
            { filename: 'index', filepath: 'Physics/index.md' },
        ])).toThrow(/case-insensitive|ambiguous/i);
    });
});
