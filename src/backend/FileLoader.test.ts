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
            expect(files[0].canonicalId).toBe('algebra/index');
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
            expect(files[0].canonicalId).toBe('algebra/index');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    test('rejects an outside scan directory instead of returning an empty successful load', async () => {
        const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-file-loader-boundary-'));
        const workspaceRoot = path.join(fixtureRoot, 'workspace');
        const outside = path.join(fixtureRoot, 'outside');
        fs.mkdirSync(workspaceRoot);
        fs.mkdirSync(outside);
        fs.writeFileSync(path.join(outside, 'private.md'), '# Outside');

        try {
            await expect(FileLoader.loadFiles(outside, ['.md'], workspaceRoot)).rejects.toThrow(/outside workspace root/i);
        } finally {
            fs.rmSync(fixtureRoot, { recursive: true, force: true });
        }
    });

    test('rejects a scan directory that escapes the workspace through a symlink', async () => {
        const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-file-loader-symlink-'));
        const workspaceRoot = path.join(fixtureRoot, 'workspace');
        const outside = path.join(fixtureRoot, 'outside');
        fs.mkdirSync(workspaceRoot);
        fs.mkdirSync(outside);
        fs.writeFileSync(path.join(outside, 'private.md'), '# Outside');
        const link = path.join(workspaceRoot, 'linked');
        fs.symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir');

        try {
            await expect(FileLoader.loadFiles(link, ['.md'], workspaceRoot)).rejects.toThrow(/outside workspace root/i);
        } finally {
            fs.rmSync(fixtureRoot, { recursive: true, force: true });
        }
    });

    test('keeps canonical identities stable through an in-workspace directory alias', async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-file-loader-alias-'));
        const nested = path.join(root, 'algebra');
        fs.mkdirSync(nested);
        fs.writeFileSync(path.join(nested, 'index.md'), '# Algebra');
        const link = path.join(root, 'alias');
        fs.symlinkSync(nested, link, process.platform === 'win32' ? 'junction' : 'dir');

        try {
            const files = await FileLoader.loadFiles(link, ['.md'], root);
            expect(files).toHaveLength(1);
            expect(files[0].relativePath).toBe('algebra/index.md');
            expect(files[0].sourceUri).toBe('note://workspace/v1/algebra/index.md');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});
