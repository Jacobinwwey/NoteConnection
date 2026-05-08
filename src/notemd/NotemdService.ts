import * as fs from 'fs';
import * as path from 'path';
import { NOTEMD_SUPPORTED_TEXT_EXTENSIONS } from './constants';
import { ContentGenerator } from './ContentGenerator';
import { DuplicateDetector } from './DuplicateDetector';
import { FileProcessor } from './FileProcessor';
import { FormulaFixer } from './FormulaFixer';
import { MermaidProcessor } from './MermaidProcessor';
import { Translator } from './Translator';
import { SearchManager } from './search/SearchManager';
import { generateDiagramArtifact, DiagramGenerationOptions } from './diagram/diagramGenerationService';
import { DiagramIntent } from './diagram/types';
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
    LlmProviderConfig,
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

    public async batchFixFormulas(
        folderPath: string,
        inPlace = true
    ): Promise<{
        folderPath: string;
        totalFiles: number;
        fixedFiles: number;
        results: Array<{ sourcePath: string; modified: boolean; replacementCount: number }>;
    }> {
        const resolvedFolderPath = path.resolve(String(folderPath || '').trim());
        const stats = await fs.promises.stat(resolvedFolderPath);
        if (!stats.isDirectory()) throw new ValidationError(`Not a directory: ${resolvedFolderPath}`);

        const files = await this.collectTextFiles(resolvedFolderPath);
        const results: Array<{ sourcePath: string; modified: boolean; replacementCount: number }> = [];

        for (const filePath of files) {
            const result = await this.fixFormulas(filePath, inPlace);
            results.push({
                sourcePath: filePath,
                modified: result.changed,
                replacementCount: result.fixes.length
            });
        }

        return {
            folderPath: resolvedFolderPath,
            totalFiles: files.length,
            fixedFiles: results.filter(r => r.modified).length,
            results
        };
    }

    private async collectTextFiles(rootDir: string): Promise<string[]> {
        const results: string[] = [];
        const queue = [rootDir];

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) continue;
            const entries = await fs.promises.readdir(current, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(current, entry.name);
                if (entry.isDirectory()) { queue.push(fullPath); continue; }
                if (!entry.isFile()) continue;
                if (!NOTEMD_SUPPORTED_TEXT_EXTENSIONS.has(path.extname(fullPath).toLowerCase())) continue;
                results.push(fullPath);
            }
        }
        return results.sort((a, b) => a.localeCompare(b));
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
        settings: NotemdSettings,
        llmInvoker?: (systemPrompt: string, sourceMarkdown: string) => Promise<string>
    ): Promise<GenerateDiagramResult> {
        const content = String(request.content || '').trim();
        if (!content) throw new ValidationError('Missing content for diagram generation.');
        const intent = (request.intent || 'mermaid') as DiagramIntent;
        const compatMode = (request.compatibilityMode ?? settings.experimentalDiagramCompatibilityMode ?? 'legacy-mermaid') as 'best-fit' | 'legacy-mermaid';
        const errors: string[] = [];

        if (llmInvoker) {
            try {
                const result = await generateDiagramArtifact(content, {
                    compatibilityMode: compatMode,
                    requestedIntent: intent,
                    targetLanguage: undefined,
                    llmInvoker
                });
                return {
                    diagramType: result.spec.intent,
                    spec: JSON.stringify(result.spec, null, 2),
                    mermaidCode: result.mermaidContent,
                    renderErrors: result.renderError ? [result.renderError] : [],
                    intent: result.spec.intent,
                    generatedAt: new Date().toISOString(),
                };
            } catch (error: unknown) {
                errors.push(error instanceof Error ? error.message : String(error));
            }
        }

        // Fallback: basic Mermaid fix without LLM
        const fixed = this.mermaidProcessor.fixInMarkdown(content);
        return {
            diagramType: intent,
            spec: content,
            mermaidCode: fixed.changed ? fixed.content : content,
            renderErrors: fixed.changed ? ['Auto-fixed Mermaid syntax errors detected.', ...errors] : errors,
            intent,
            generatedAt: new Date().toISOString(),
        };
    }

    public async previewDiagram(
        request: PreviewDiagramRequest,
        _settings: NotemdSettings
    ): Promise<PreviewDiagramResult> {
        const content = String(request.content || '').trim();
        if (!content) throw new ValidationError('Missing content for diagram preview.');
        const fmt = request.format || 'png';
        const fixed = this.mermaidProcessor.fixInMarkdown(content);
        const errors: string[] = fixed.changed ? ['Mermaid syntax was auto-fixed in preview.'] : [];
        return {
            format: fmt,
            dataUrl: '',
            errors,
        };
    }

    public async exportDiagram(
        request: ExportDiagramRequest,
        _settings: NotemdSettings
    ): Promise<ExportDiagramResult> {
        const content = String(request.content || '').trim();
        if (!content) throw new ValidationError('Missing content for diagram export.');
        const outputPath = request.outputPath || '';
        return {
            outputPath,
            format: request.format || 'png',
            size: Buffer.byteLength(content, 'utf8'),
        };
    }

    // ── Search (obsidian-notemd v1.8.4) ──

    public async search(
        request: SearchRequest,
        settings: NotemdSettings
    ): Promise<SearchResult> {
        const query = String(request.query || '').trim();
        if (!query) {
            throw new ValidationError('Missing query for search.');
        }
        const provider = SearchManager.getProvider(request.provider || settings.searchProvider || 'duckduckgo');
        let apiKey: string | undefined;
        if (provider.name === 'tavily') {
            apiKey = settings.tavilyApiKey;
            if (!apiKey) throw new ValidationError('Tavily API key is required in settings.');
        }
        const results = await provider.search({
            query,
            maxResults: request.maxResults ?? settings.tavilyMaxResults ?? 5,
            searchDepth: request.searchDepth ?? settings.tavilySearchDepth ?? 'basic'
        }, apiKey, settings.ddgFetchTimeout ?? 10000);
        return {
            query,
            provider: provider.name,
            results,
            totalResults: results.length,
            searchedAt: new Date().toISOString(),
        };
    }

    // ── LLM diagnostics (obsidian-notemd v1.8.4) ──

    public async diagnoseLlmProvider(
        request: LlmDiagnoseRequest,
        settings: NotemdSettings,
        llmCallImpl?: (provider: LlmProviderConfig, prompt: string, content: string, settings: NotemdSettings, signal?: AbortSignal) => Promise<string>
    ): Promise<LlmDiagnoseResult> {
        const providerName = request.provider || settings.activeProvider || 'unknown';
        const modelName = request.model || settings.providers.find(p => p.name === providerName)?.model || 'unknown';
        const provider = settings.providers.find(p => p.name === providerName);
        if (!provider) throw new ValidationError(`Provider not found: ${providerName}`);
        if (!llmCallImpl) throw new ValidationError('LLM call implementation required for diagnostics.');

        const startMs = Date.now();
        try {
            const { buildDefaultProviderDiagnosticPayload } = await import('./providerDiagnostics');
            const payload = buildDefaultProviderDiagnosticPayload(providerName);
            await llmCallImpl(provider, payload.prompt, payload.content, { ...settings, enableApiErrorDebugMode: true, enableStableApiCall: true });
            return { provider: providerName, model: modelName, status: 'ok', latencyMs: Date.now() - startMs };
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            return { provider: providerName, model: modelName, status: 'error', latencyMs: Date.now() - startMs, error: msg };
        }
    }

    // ── Extract original text (obsidian-notemd v1.8.4) ──

    public async extractOriginalText(
        request: ExtractOriginalTextRequest,
        _settings: NotemdSettings,
        _reporter: ProgressReporter = defaultReporter(),
        _signal?: AbortSignal
    ): Promise<ExtractOriginalTextResult> {
        const resolvedPath = path.resolve(String(request.filePath || '').trim());
        if (!resolvedPath) throw new ValidationError('Missing filePath.');
        const source = await fs.promises.readFile(resolvedPath, 'utf8');
        const mergedMode = request.mergedMode ?? false;
        const outputPath = request.outputPath || resolvedPath.replace(/\.md$/, '_original.md');
        const replacedSuffixPath = resolvedPath.replace(/\.md$/, `${request.outputPath ? '' : '_original'}.md`);
        const targetPath = outputPath || replacedSuffixPath;
        if (targetPath !== resolvedPath) {
            await fs.promises.writeFile(targetPath, source, 'utf8');
        }
        return {
            filePath: resolvedPath,
            outputPath: targetPath,
            originalText: mergedMode ? source.replace(/\n/g, ' ').replace(/\[\[([^\]]+)\]\]/g, '$1') : source,
            changed: targetPath !== resolvedPath,
        };
    }

    // ── Batch progress tracking ──

    private batchOperations = new Map<string, BatchProgress>();

    public getBatchProgress(operationId?: string): BatchProgress {
        if (operationId && this.batchOperations.has(operationId)) {
            return this.batchOperations.get(operationId)!;
        }
        return {
            operationId: operationId || '',
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

    public startBatchOperation(operationId: string, totalItems: number): BatchProgress {
        const progress: BatchProgress = {
            operationId,
            status: 'running',
            totalItems,
            completedItems: 0,
            failedItems: 0,
            logs: [],
            percent: 0,
            startedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        this.batchOperations.set(operationId, progress);
        return progress;
    }

    public updateBatchOperation(operationId: string, update: Partial<BatchProgress>): BatchProgress | undefined {
        const existing = this.batchOperations.get(operationId);
        if (!existing) return undefined;
        const updated: BatchProgress = { ...existing, ...update, updatedAt: new Date().toISOString() };
        if (updated.failedItems > 0 && updated.status === 'running') {
            updated.status = 'error';
        }
        this.batchOperations.set(operationId, updated);
        return updated;
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
