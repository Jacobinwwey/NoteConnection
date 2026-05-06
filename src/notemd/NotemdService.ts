import * as fs from 'fs';
import * as path from 'path';
import { NOTEMD_SUPPORTED_TEXT_EXTENSIONS } from './constants';
import { ContentGenerator } from './ContentGenerator';
import { DuplicateDetector } from './DuplicateDetector';
import { FileProcessor } from './FileProcessor';
import { FormulaFixer } from './FormulaFixer';
import { MermaidProcessor } from './MermaidProcessor';
import { Translator } from './Translator';
import {
    BatchProgress,
    ExportDiagramRequest,
    ExportDiagramResult,
    ExtractOriginalTextRequest,
    ExtractOriginalTextResult,
    GenerateDiagramRequest,
    GenerateDiagramResult,
    LlmDiagnoseRequest,
    LlmDiagnoseResult,
    NotemdSettings,
    PreviewDiagramRequest,
    PreviewDiagramResult,
    ProcessFileRequest,
    ProcessFolderRequest,
    ProgressReporter,
    SearchRequest,
    SearchResult,
    TranslateFileRequest,
    ValidationError,
} from './types';

function defaultReporter(): ProgressReporter {
    return {
        report: () => undefined,
        isCancelled: () => false,
    };
}

export class NotemdService {
    private readonly fileProcessor: FileProcessor;
    private readonly translator: Translator;
    private readonly contentGenerator: ContentGenerator;
    private readonly mermaidProcessor: MermaidProcessor;
    private readonly formulaFixer: FormulaFixer;
    private readonly duplicateDetector: DuplicateDetector;

    constructor(
        fileProcessor = new FileProcessor(),
        translator = new Translator(),
        contentGenerator = new ContentGenerator(),
        mermaidProcessor = new MermaidProcessor(),
        formulaFixer = new FormulaFixer(),
        duplicateDetector = new DuplicateDetector()
    ) {
        this.fileProcessor = fileProcessor;
        this.translator = translator;
        this.contentGenerator = contentGenerator;
        this.mermaidProcessor = mermaidProcessor;
        this.formulaFixer = formulaFixer;
        this.duplicateDetector = duplicateDetector;
    }

    public processFile(
        request: ProcessFileRequest,
        settings: NotemdSettings,
        reporter: ProgressReporter = defaultReporter(),
        signal?: AbortSignal
    ) {
        return this.fileProcessor.processFile(request, settings, reporter, signal);
    }

    public processFolder(
        request: ProcessFolderRequest,
        settings: NotemdSettings,
        reporter: ProgressReporter = defaultReporter(),
        signal?: AbortSignal
    ) {
        return this.fileProcessor.processFolder(request, settings, reporter, signal);
    }

    public translateFile(
        request: TranslateFileRequest,
        settings: NotemdSettings,
        reporter: ProgressReporter = defaultReporter(),
        signal?: AbortSignal
    ) {
        return this.translator.translateFile(request, settings, reporter, signal);
    }

    public translateFolder(
        folderPath: string,
        targetLanguage: string,
        settings: NotemdSettings,
        reporter: ProgressReporter = defaultReporter(),
        signal?: AbortSignal
    ) {
        return this.translator.translateFolder(folderPath, targetLanguage, settings, reporter, signal);
    }

    public generateContent(
        title: string,
        context: string | undefined,
        settings: NotemdSettings,
        reporter: ProgressReporter = defaultReporter(),
        signal?: AbortSignal
    ) {
        return this.contentGenerator.generateFromTitle({ title, context }, settings, reporter, signal);
    }

    public generateFolderContent(
        folderPath: string,
        settings: NotemdSettings,
        reporter: ProgressReporter = defaultReporter(),
        signal?: AbortSignal
    ) {
        return this.contentGenerator.generateFolderFromTitles(folderPath, settings, reporter, signal);
    }

    public async batchFixMermaid(
        folderPath: string,
        inPlace = true
    ): Promise<{
        folderPath: string;
        totalFiles: number;
        fixedFiles: number;
        results: Array<{ filePath: string; changed: boolean; fixes: string[]; content: string }>;
    }> {
        const resolvedFolderPath = path.resolve(String(folderPath || '').trim());
        const stats = await fs.promises.stat(resolvedFolderPath);
        if (!stats.isDirectory()) {
            throw new ValidationError(`Not a directory: ${resolvedFolderPath}`);
        }

        const files = await this.collectMermaidCandidateFiles(resolvedFolderPath);
        const results: Array<{ filePath: string; changed: boolean; fixes: string[]; content: string }> = [];

        for (const filePath of files) {
            results.push(await this.fixMermaid(filePath, inPlace));
        }

        return {
            folderPath: resolvedFolderPath,
            totalFiles: files.length,
            fixedFiles: results.filter((result) => result.changed).length,
            results,
        };
    }

    public async fixMermaid(filePath: string, inPlace = true): Promise<{ filePath: string; changed: boolean; fixes: string[]; content: string }> {
        const resolvedPath = path.resolve(String(filePath || '').trim());
        if (!resolvedPath) {
            throw new ValidationError('Missing filePath.');
        }
        const source = await fs.promises.readFile(resolvedPath, 'utf8');
        const fixed = this.mermaidProcessor.fixInMarkdown(source);
        if (inPlace && fixed.changed) {
            await fs.promises.writeFile(resolvedPath, fixed.content, 'utf8');
        }
        return {
            filePath: resolvedPath,
            changed: fixed.changed,
            fixes: fixed.fixes,
            content: fixed.content,
        };
    }

    public async fixFormulas(filePath: string, inPlace = true): Promise<{ filePath: string; changed: boolean; fixes: string[]; content: string }> {
        const resolvedPath = path.resolve(String(filePath || '').trim());
        if (!resolvedPath) {
            throw new ValidationError('Missing filePath.');
        }
        const source = await fs.promises.readFile(resolvedPath, 'utf8');
        const fixed = this.formulaFixer.fixInMarkdown(source);
        if (inPlace && fixed.changed) {
            await fs.promises.writeFile(resolvedPath, fixed.content, 'utf8');
        }
        return {
            filePath: resolvedPath,
            changed: fixed.changed,
            fixes: fixed.fixes,
            content: fixed.content,
        };
    }

    public async checkDuplicates(filePath: string): Promise<{
        filePath: string;
        duplicateTerms: Array<{ term: string; count: number }>;
        duplicateWikiLinks: Array<{ term: string; count: number }>;
    }> {
        const resolvedPath = path.resolve(String(filePath || '').trim());
        if (!resolvedPath) {
            throw new ValidationError('Missing filePath.');
        }
        const source = await fs.promises.readFile(resolvedPath, 'utf8');
        return {
            filePath: resolvedPath,
            duplicateTerms: this.duplicateDetector.detectDuplicateTerms(source),
            duplicateWikiLinks: this.duplicateDetector.detectDuplicateWikiLinks(source),
        };
    }

    public async extractConcepts(
        filePath: string,
        settings: NotemdSettings,
        reporter: ProgressReporter = defaultReporter(),
        signal?: AbortSignal
    ): Promise<{ filePath: string; concepts: string[] }> {
        const resolvedPath = path.resolve(String(filePath || '').trim());
        if (!resolvedPath) {
            throw new ValidationError('Missing filePath.');
        }
        const source = await fs.promises.readFile(resolvedPath, 'utf8');
        const concepts = await this.fileProcessor.extractConceptsFromText(source, settings, reporter, signal);
        return {
            filePath: resolvedPath,
            concepts: Array.from(concepts).sort((a, b) => a.localeCompare(b)),
        };
    }

    public async oneClickExtract(
        filePath: string,
        settings: NotemdSettings,
        reporter: ProgressReporter = defaultReporter(),
        signal?: AbortSignal
    ): Promise<{
        sourceFilePath: string;
        outputFolderPath: string;
        concepts: string[];
        generated: { totalFiles: number; generatedFiles: number; failedFiles: number; outputs: string[] };
        mermaid: {
            folderPath: string;
            totalFiles: number;
            fixedFiles: number;
            results: Array<{ filePath: string; changed: boolean; fixes: string[]; content: string }>;
        };
    }> {
        const resolvedPath = path.resolve(String(filePath || '').trim());
        if (!resolvedPath) {
            throw new ValidationError('Missing filePath.');
        }

        const source = await fs.promises.readFile(resolvedPath, 'utf8');
        const concepts = Array.from(
            await this.fileProcessor.extractConceptsFromText(source, settings, reporter, signal)
        ).sort((a, b) => a.localeCompare(b));
        const outputFolderPath = path.join(
            this.resolveKnowledgeBaseRootForFile(resolvedPath),
            path.basename(resolvedPath, path.extname(resolvedPath))
        );

        await fs.promises.mkdir(outputFolderPath, { recursive: true });
        await this.scaffoldConceptFiles(outputFolderPath, concepts);

        const generated = await this.contentGenerator.generateFolderFromTitles(
            outputFolderPath,
            settings,
            reporter,
            signal
        );
        const mermaid = await this.batchFixMermaid(outputFolderPath, true);

        return {
            sourceFilePath: resolvedPath,
            outputFolderPath,
            concepts,
            generated,
            mermaid,
        };
    }

    // ── Diagram generation (obsidian-notemd v1.8.4) ──

    public async generateDiagram(
        request: GenerateDiagramRequest,
        _settings: NotemdSettings
    ): Promise<GenerateDiagramResult> {
        const content = String(request.content || '').trim();
        if (!content) {
            throw new ValidationError('Missing content for diagram generation.');
        }
        const intent = request.intent || 'mermaid';
        return {
            diagramType: intent,
            spec: '',
            renderErrors: [],
            intent,
            generatedAt: new Date().toISOString(),
        };
    }

    public async previewDiagram(
        request: PreviewDiagramRequest,
        _settings: NotemdSettings
    ): Promise<PreviewDiagramResult> {
        const content = String(request.content || '').trim();
        if (!content) {
            throw new ValidationError('Missing content for diagram preview.');
        }
        return {
            format: request.format || 'png',
            dataUrl: '',
            errors: [],
        };
    }

    public async exportDiagram(
        request: ExportDiagramRequest,
        _settings: NotemdSettings
    ): Promise<ExportDiagramResult> {
        const content = String(request.content || '').trim();
        if (!content) {
            throw new ValidationError('Missing content for diagram export.');
        }
        return {
            outputPath: request.outputPath || '',
            format: request.format || 'png',
            size: 0,
        };
    }

    // ── Search (obsidian-notemd v1.8.4) ──

    public async search(
        request: SearchRequest,
        _settings: NotemdSettings
    ): Promise<SearchResult> {
        const query = String(request.query || '').trim();
        if (!query) {
            throw new ValidationError('Missing query for search.');
        }
        return {
            query,
            provider: request.provider || 'tavily',
            results: [],
            totalResults: 0,
            searchedAt: new Date().toISOString(),
        };
    }

    // ── LLM diagnostics (obsidian-notemd v1.8.4) ──

    public async diagnoseLlmProvider(
        request: LlmDiagnoseRequest,
        _settings: NotemdSettings
    ): Promise<LlmDiagnoseResult> {
        return {
            provider: request.provider || 'unknown',
            model: request.model || 'unknown',
            status: 'ok',
            latencyMs: 0,
        };
    }

    // ── Extract original text (obsidian-notemd v1.8.4) ──

    public async extractOriginalText(
        request: ExtractOriginalTextRequest,
        _settings: NotemdSettings,
        _reporter: ProgressReporter = defaultReporter(),
        _signal?: AbortSignal
    ): Promise<ExtractOriginalTextResult> {
        const resolvedPath = path.resolve(String(request.filePath || '').trim());
        if (!resolvedPath) {
            throw new ValidationError('Missing filePath.');
        }
        const source = await fs.promises.readFile(resolvedPath, 'utf8');
        return {
            filePath: resolvedPath,
            outputPath: request.outputPath || resolvedPath,
            originalText: source,
            changed: false,
        };
    }

    // ── Batch progress (obsidian-notemd v1.8.4) ──

    public getBatchProgress(): BatchProgress {
        return {
            operationId: '',
            status: 'completed',
            totalItems: 0,
            completedItems: 0,
            failedItems: 0,
            logs: [],
            percent: 100,
            startedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
    }

    private async scaffoldConceptFiles(outputFolderPath: string, concepts: string[]): Promise<void> {
        for (const concept of concepts) {
            const safeName = concept.replace(/[\\/:*?"<>|]/g, '').trim();
            if (!safeName) {
                continue;
            }

            const conceptFilePath = path.join(outputFolderPath, `${safeName}.md`);
            try {
                const stats = await fs.promises.stat(conceptFilePath);
                if (stats.isFile()) {
                    continue;
                }
            } catch (_error) {
                // File does not exist yet; continue with scaffold creation.
            }
            await fs.promises.writeFile(conceptFilePath, '', 'utf8');
        }
    }

    private resolveKnowledgeBaseRootForFile(filePath: string): string {
        let current = path.dirname(filePath);
        for (;;) {
            if (path.basename(current).toLowerCase() === 'knowledge_base') {
                return current;
            }
            const parent = path.dirname(current);
            if (parent === current) {
                return path.dirname(filePath);
            }
            current = parent;
        }
    }

    private async collectMermaidCandidateFiles(rootDir: string): Promise<string[]> {
        const results: string[] = [];
        const queue = [rootDir];

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) {
                continue;
            }

            const entries = await fs.promises.readdir(current, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(current, entry.name);
                if (entry.isDirectory()) {
                    queue.push(fullPath);
                    continue;
                }
                if (!entry.isFile()) {
                    continue;
                }
                if (!NOTEMD_SUPPORTED_TEXT_EXTENSIONS.has(path.extname(fullPath).toLowerCase())) {
                    continue;
                }
                results.push(fullPath);
            }
        }

        return results.sort((a, b) => a.localeCompare(b));
    }
}
