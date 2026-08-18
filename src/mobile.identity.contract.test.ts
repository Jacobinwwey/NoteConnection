import * as fs from 'fs';
import * as path from 'path';

describe('mobile portable identity contract', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const modulePath = path.join(repoRoot, 'src', 'frontend', 'mobile_identity_contract.js');
    const identity = require(modulePath) as {
        normalizePortablePath: (value: string) => string;
        createSourceUri: (value: string) => string;
        sha256HexSync: (value: string) => string;
        createResourceIdentity: (pathValue: string, legacyId: string, content: string) => Promise<{
            sourceUri: string;
            canonicalId: string;
            revision: string;
            identityAliases: string[];
        }>;
    };

    test('ships as a browser-compatible asset and normalizes paths identically', () => {
        expect(fs.readFileSync(modulePath, 'utf8')).toContain('NoteConnectionMobileIdentity');
        expect(identity.normalizePortablePath('Knowledge_Base\\Algebra Notes\\Index #1.MD'))
            .toBe('algebra notes/index #1.md');
        expect(identity.createSourceUri('algebra notes/index #1.md'))
            .toBe('note://workspace/v1/algebra%20notes/index%20%231.md');
    });

    test('uses SHA-256 even without Web Crypto and normalizes Unicode content', async () => {
        expect(identity.sha256HexSync(''))
            .toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
        expect(identity.sha256HexSync('abc'))
            .toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');

        const decomposed = await identity.createResourceIdentity('notes/cafe.md', 'cafe', 'Cafe\u0301');
        const composed = await identity.createResourceIdentity('notes/cafe.md', 'cafe', 'Caf\u00e9');
        expect(decomposed.revision).toMatch(/^sha256:[0-9a-f]{64}$/);
        expect(decomposed.revision).toBe(composed.revision);
        expect(decomposed.identityAliases).toEqual(expect.arrayContaining(['notes/cafe.md', 'cafe']));
    });

    test('preserves the legacy id while exposing extension-inclusive portable identity', async () => {
        const result = await identity.createResourceIdentity('algebra/index.md', 'index', '# Algebra');
        expect(result.sourceUri).toBe('note://workspace/v1/algebra/index.md');
        expect(result.canonicalId).toBe('algebra/index');
        expect(result.identityAliases).toEqual(expect.arrayContaining(['index', 'index.md', 'algebra/index.md']));
    });
});
