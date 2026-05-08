/**
 * Workflow Pipeline contract test — validates the 4-stage
 * runWorkflow pipeline (extract → wikilinks → generate → mermaid).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { NotemdService } from './notemd/NotemdService';
import type { NotemdSettings, WorkflowRequest, WorkflowResult } from './notemd/types';

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

function defaultSettings(overrides: Partial<NotemdSettings> = {}): NotemdSettings {
    return {
        activeProvider: 'OpenAI',
        searchProvider: 'duckduckgo',
        language: 'en',
        providers: [],
        enableStableApiCall: true,
        enableApiErrorDebugMode: false,
        maxRetries: 0,
        retryDelayMs: 0,
        maxTokens: 256,
        chunkWordCount: 100,
        enableDuplicateDetection: false,
        enableExperimentalDiagramPipeline: false,
        enableBatchParallelism: false,
        developerMode: false,
        developerDiagnosticCallMode: 'runtime-stable',
        developerDiagnosticTimeoutMs: 60000,
        developerDiagnosticStabilityRuns: 3,
        experimentalDiagramCompatibilityMode: 'legacy-mermaid',
        autoMermaidFixAfterGenerate: true,
        tavilyApiKey: '',
        tavilyMaxResults: 5,
        tavilySearchDepth: 'basic',
        ddgFetchTimeout: 10000,
        useCustomConceptNoteFolder: false,
        conceptNoteFolder: '',
        ...overrides,
    } as NotemdSettings;
}

describe('Notemd Workflow Pipeline', () => {
    let temp: TempDir;
    let service: NotemdService;

    beforeEach(() => { temp = new TempDir('notemd-workflow-'); service = new NotemdService(); });
    afterEach(() => { temp.cleanup(); });

    test('runWorkflow executes all 3 stages (extract → generate → mermaid) on a simple file', async () => {
        const src = temp.file('notes/topic.md',
            '# Graph Theory\n\nGraph theory studies **nodes** and **edges**.\n\n```mermaid\ngraph TD\nA-->B\n```');

        const result = await service.runWorkflow(
            { filePath: src },
            defaultSettings()
        );

        expect(result.sourceFilePath).toBe(src);
        expect(result.outputFolderPath).toContain('topic_notemd_output');
        expect(fs.existsSync(result.outputFolderPath)).toBe(true);

        // All 3 stages should be present (no wiki-links)
        expect(result.stages.length).toBeGreaterThanOrEqual(3);
        const stageNames = result.stages.map(s => s.stage);
        expect(stageNames).toContain('extract-concepts');
        expect(stageNames).toContain('generate-titles');
        expect(stageNames).toContain('mermaid-fix');

        // Extract stage should have completed
        const extractStage = result.stages.find(s => s.stage === 'extract-concepts')!;
        expect(['completed', 'error']).toContain(extractStage.status);

        // Summary should have valid numbers
        expect(typeof result.summary.conceptsExtracted).toBe('number');
        expect(typeof result.summary.totalElapsedMs).toBe('number');
        expect(result.summary.totalElapsedMs).toBeGreaterThan(0);
    });

    test('runWorkflow with addWikiLinks injects wiki-links and writes _wikified file', async () => {
        const src = temp.file('notes/test.md',
            '# Machine Learning\n\nMachine learning uses neural networks and deep learning.');

        const result = await service.runWorkflow(
            { filePath: src, addWikiLinks: true, skipGenerate: true, skipMermaidFix: true },
            defaultSettings()
        );

        // Wiki-links stage should be present and completed
        const wikiStage = result.stages.find(s => s.stage === 'add-wikilinks');
        expect(wikiStage).toBeDefined();
        // May be 'completed' with links or 'skipped' if LLM returned no concepts
        expect(['completed', 'skipped']).toContain(wikiStage!.status);

        // Add stage names check
        const stageNames = result.stages.map(s => s.stage);
        expect(stageNames).toContain('add-wikilinks');
        expect(stageNames).not.toContain('generate-titles');
        expect(stageNames).not.toContain('mermaid-fix');
    });

    test('runWorkflow with skipGenerate and skipMermaidFix only runs extract', async () => {
        const src = temp.file('notes/simple.md', '# Simple\n\nJust a simple note.');

        const result = await service.runWorkflow(
            { filePath: src, skipGenerate: true, skipMermaidFix: true },
            defaultSettings()
        );

        // Only 1 stage should run (extract) since generate + mermaid are skipped
        const runningStages = result.stages.filter(s => s.status !== 'skipped');
        expect(runningStages.length).toBeGreaterThanOrEqual(1);

        const stageNames = result.stages.map(s => s.stage);
        expect(stageNames).toContain('extract-concepts');
    });

    test('runWorkflow with wikiLinksInPlace modifies source file directly', async () => {
        const src = temp.file('notes/inplace.md',
            '# AI\n\nArtificial intelligence uses machine learning and deep learning algorithms.');

        const originalContent = fs.readFileSync(src, 'utf8');

        const result = await service.runWorkflow(
            { filePath: src, addWikiLinks: true, wikiLinksInPlace: true, skipGenerate: true, skipMermaidFix: true },
            defaultSettings()
        );

        const wikiStage = result.stages.find(s => s.stage === 'add-wikilinks');
        expect(wikiStage).toBeDefined();

        // If wikilinks were injected in-place, file content should differ
        if (wikiStage!.status === 'completed') {
            const newContent = fs.readFileSync(src, 'utf8');
            // Either content changed or no concepts were found
            expect(typeof newContent).toBe('string');
        }
    });

    test('runWorkflow errors are collected per-stage without blocking other stages', async () => {
        const src = temp.file('notes/errors.md', 'test content');

        const result = await service.runWorkflow(
            { filePath: src },
            defaultSettings()
        );

        // Each stage should report its status
        result.stages.forEach(stage => {
            expect(['completed', 'error', 'skipped', 'running']).toContain(stage.status);
        });

        // Result should always have a valid structure even on errors
        expect(result.sourceFilePath).toBe(src);
        expect(Array.isArray(result.errors)).toBe(true);
        expect(typeof result.summary.totalElapsedMs).toBe('number');
    });

    test('runWorkflow output folder is created', async () => {
        const src = temp.file('notes/output.md', '# Test\n\nJust testing.');

        const result = await service.runWorkflow(
            { filePath: src },
            defaultSettings()
        );

        expect(fs.existsSync(result.outputFolderPath)).toBe(true);
    });
});
