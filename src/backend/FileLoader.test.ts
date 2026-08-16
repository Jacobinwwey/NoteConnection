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
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});
