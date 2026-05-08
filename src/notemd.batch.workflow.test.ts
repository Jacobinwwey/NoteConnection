/**
 * Batch workflow contract test — validates request structure,
 * file filtering, and error handling for runBatchWorkflow.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { NotemdService } from './notemd/NotemdService';
import type { NotemdSettings, BatchWorkflowRequest } from './notemd/types';

class TempDir {
    public readonly root: string;
    constructor(prefix: string) { this.root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), prefix)); }
    file(rel: string, content: string): string {
        const p = path.join(this.root, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, content, 'utf8');
        return p;
    }
    cleanup() { fs.rmSync(this.root, { recursive: true, force: true }); }
}

function defaultSettings(): NotemdSettings {
    return {
        activeProvider: 'OpenAI', searchProvider: 'duckduckgo', language: 'en',
        providers: [], enableStableApiCall: true, enableApiErrorDebugMode: false,
        maxRetries: 0, retryDelayMs: 0, maxTokens: 256, chunkWordCount: 100,
        enableDuplicateDetection: false, enableExperimentalDiagramPipeline: false,
        enableBatchParallelism: false, developerMode: false,
        developerDiagnosticCallMode: 'runtime-stable', developerDiagnosticTimeoutMs: 60000,
        developerDiagnosticStabilityRuns: 3,
        experimentalDiagramCompatibilityMode: 'legacy-mermaid',
        autoMermaidFixAfterGenerate: true, tavilyApiKey: '', tavilyMaxResults: 5,
        tavilySearchDepth: 'basic', ddgFetchTimeout: 10000,
        useCustomConceptNoteFolder: false, conceptNoteFolder: '',
    } as unknown as NotemdSettings;
}

describe('Notemd Batch Workflow', () => {
    let temp: TempDir;
    let service: NotemdService;

    beforeEach(() => { temp = new TempDir('notemd-batch-'); service = new NotemdService(); });
    afterEach(() => { temp.cleanup(); });

    test('runBatchWorkflow processes matching .md files in a folder', async () => {
        temp.file('notes/a.md', '# Note A\n\nContent A.');
        temp.file('notes/b.md', '# Note B\n\nContent B.');
        temp.file('notes/c.txt', '# Note C\n\nContent C.');
        const folder = path.join(temp.root, 'notes');

        const result = await service.runBatchWorkflow(
            { folderPath: folder, fileExtensions: ['.md'] },
            defaultSettings()
        );

        expect(result.totalFiles).toBe(2);
        expect(result.completedFiles).toBeGreaterThanOrEqual(0);
        expect(result.failedFiles).toBeLessThanOrEqual(2);
        expect(result.filter?.extensions).toEqual(['.md']);
        expect(fs.existsSync(result.outputBasePath)).toBe(true);
        expect(result.totalElapsedMs).toBeGreaterThan(0);
    });

    test('runBatchWorkflow filters by regex pattern', async () => {
        temp.file('notes/lecture-01.md', '# L1');
        temp.file('notes/lecture-02.md', '# L2');
        temp.file('notes/other.md', '# Other');

        const result = await service.runBatchWorkflow(
            { folderPath: path.join(temp.root, 'notes'), filePattern: 'lecture-.*' },
            defaultSettings()
        );

        expect(result.totalFiles).toBe(2);
        expect(result.filter?.pattern).toBe('lecture-.*');
    });

    test('runBatchWorkflow respects maxFiles limit', async () => {
        temp.file('notes/a.md', '# A');
        temp.file('notes/b.md', '# B');
        temp.file('notes/c.md', '# C');
        temp.file('notes/d.md', '# D');

        const result = await service.runBatchWorkflow(
            { folderPath: path.join(temp.root, 'notes'), maxFiles: 2 },
            defaultSettings()
        );

        expect(result.totalFiles).toBe(2);
    });

    test('runBatchWorkflow rejects invalid folder path', async () => {
        await expect(
            service.runBatchWorkflow(
                { folderPath: path.join(temp.root, 'nonexistent') },
                defaultSettings()
            )
        ).rejects.toThrow();
    });

    test('runBatchWorkflow rejects invalid regex pattern', async () => {
        temp.file('notes/a.md', '# A');

        await expect(
            service.runBatchWorkflow(
                { folderPath: path.join(temp.root, 'notes'), filePattern: '[invalid' },
                defaultSettings()
            )
        ).rejects.toThrow('Invalid regex pattern');
    });

    test('runBatchWorkflow output base path is created', async () => {
        temp.file('notes/a.md', '# A');
        const customOutput = path.join(temp.root, 'custom_output');

        const result = await service.runBatchWorkflow(
            { folderPath: path.join(temp.root, 'notes'), outputBasePath: customOutput },
            defaultSettings()
        );

        expect(result.outputBasePath).toBe(customOutput);
        expect(fs.existsSync(customOutput)).toBe(true);
    });
});
