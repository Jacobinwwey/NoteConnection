import { assertUniqueLegacyResourceIds, normalizeResourceRelativePath } from './ResourceIdentity';

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
});
