import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileLoader } from './FileLoader';

describe('FileLoader resource paths', () => {
    test('records a normalized path relative to the loaded workspace', async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-file-loader-'));
        const nested = path.join(root, 'algebra');
        fs.mkdirSync(nested, { recursive: true });
        fs.writeFileSync(path.join(nested, 'index.md'), '# Algebra', 'utf8');

        try {
            const files = await FileLoader.loadFiles(root);
            expect(files).toHaveLength(1);
            expect(files[0].relativePath).toBe('algebra/index.md');
            expect(files[0].sourceUri).toBe('note://workspace/v1/algebra/index.md');
            expect(files[0].revision).toMatch(/^sha256:[0-9a-f]{64}$/);
            expect(files[0].identityAliases).toEqual(expect.arrayContaining([
                'index',
                'algebra/index.md',
            ]));
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    test('keeps identity stable when loading a workspace subdirectory', async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-file-loader-root-'));
        const nested = path.join(root, 'algebra');
        fs.mkdirSync(nested, { recursive: true });
        fs.writeFileSync(path.join(nested, 'index.md'), '# Algebra', 'utf8');

        try {
            const files = await FileLoader.loadFiles(nested, ['.md'], root);
            expect(files).toHaveLength(1);
            expect(files[0].relativePath).toBe('algebra/index.md');
            expect(files[0].sourceUri).toBe('note://workspace/v1/algebra/index.md');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});
