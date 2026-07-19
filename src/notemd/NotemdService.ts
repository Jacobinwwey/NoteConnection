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
import { LlmProviderClient } from './LlmProvider';
import {
    BatchProgress,
    BatchWorkflowRequest,
    BatchWorkflowResult,
    ExportDiagramRequest,
    ExportDiagramResult,
    ExtractOriginalTextRequest,
    ExtractOriginalTextResult,
    GenerateDiagramRequest,
    GenerateDiagramResult,
    LlmDiagnoseRequest,
    LlmDiagnoseResult,
    LlmProviderConfig,
    LlmProviderName,
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
    WorkflowRequest,
    WorkflowResult,
    WorkflowStage,
} from './types';
import { createNoopProgressReporter } from './progressReporter';

export class NotemdService {
    private readonly fileProcessor: FileProcessor;
    private readonly translator: Translator;
    private readonly contentGenerator: ContentGenerator;
    private readonly mermaidProcessor: MermaidProcessor;
    private readonly formulaFixer: FormulaFixer;
    private readonly duplicateDetector: DuplicateDetector;
    private readonly llmProviderClient: LlmProviderClient;

    constructor(
        fileProcessor = new FileProcessor(),
        translator = new Translator(),
        contentGenerator = new ContentGenerator(),
        mermaidProcessor = new MermaidProcessor(),
        formulaFixer = new FormulaFixer(),
        duplicateDetector = new DuplicateDetector(),
        llmProviderClient = new LlmProviderClient()
    ) {
        this.fileProcessor = fileProcessor;
        this.translator = translator;
        this.contentGenerator = contentGenerator;
        this.mermaidProcessor = mermaidProcessor;
        this.formulaFixer = formulaFixer;
        this.duplicateDetector = duplicateDetector;
        this.llmProviderClient = llmProviderClient;
    }

    public processFile(
        request: ProcessFileRequest,
        settings: NotemdSettings,
        reporter: ProgressReporter = createNoopProgressReporter(),
        signal?: AbortSignal
    ) {
        return this.fileProcessor.processFile(request, settings, reporter, signal);
    }

    public processFolder(
        request: ProcessFolderRequest,
        settings: NotemdSettings,
        reporter: ProgressReporter = createNoopProgressReporter(),
        signal?: AbortSignal
    ) {
        return this.fileProcessor.processFolder(request, settings, reporter, signal);
    }

    public translateFile(
        request: TranslateFileRequest,
        settings: NotemdSettings,
        reporter: ProgressReporter = createNoopProgressReporter(),
        signal?: AbortSignal
    ) {
        return this.translator.translateFile(request, settings, reporter, signal);
    }

    public translateFolder(
        folderPath: string,
        targetLanguage: string,
        settings: NotemdSettings,
        reporter: ProgressReporter = createNoopProgressReporter(),
        signal?: AbortSignal
    ) {
        return this.translator.translateFolder(folderPath, targetLanguage, settings, reporter, signal);
    }

    public generateContent(
        title: string,
        context: string | undefined,
        settings: NotemdSettings,
        reporter: ProgressReporter = createNoopProgressReporter(),
        signal?: AbortSignal
    ) {
        return this.contentGenerator.generateFromTitle({ title, context }, settings, reporter, signal);
    }

    public generateFolderContent(
        folderPath: string,
        settings: NotemdSettings,
        reporter: ProgressReporter = createNoopProgressReporter(),
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
        reporter: ProgressReporter = createNoopProgressReporter(),
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

    // ── Workflow Pipeline (NoteConnection native) ──

    public async runWorkflow(
        request: WorkflowRequest,
        settings: NotemdSettings,
        reporter: ProgressReporter = createNoopProgressReporter(),
        signal?: AbortSignal
    ): Promise<WorkflowResult> {
        const resolvedPath = path.resolve(String(request.filePath || '').trim());
        if (!resolvedPath) throw new ValidationError('Missing filePath.');

        const startedAt = Date.now();
        const stages: WorkflowStage[] = [];
        const errors: string[] = [];
        const ext = path.extname(resolvedPath);
        const baseName = path.basename(resolvedPath, ext);
        const outputFolderPath = request.outputFolderPath
            ? path.resolve(request.outputFolderPath)
            : path.join(path.dirname(resolvedPath), `${baseName}_notemd_output`);

        await fs.promises.mkdir(outputFolderPath, { recursive: true });

        const enableWikilinks = request.addWikiLinks === true;
        const enableGenerate = !request.skipGenerate;
        const enableMermaid = !request.skipMermaidFix;
        const totalStages = 1 + (enableWikilinks ? 1 : 0) + (enableGenerate ? 1 : 0) + (enableMermaid ? 1 : 0);
        let stageNum = 0;

        // Stage 1: Extract Concepts
        stageNum += 1;
        stages.push({ stage: 'extract-concepts', status: 'running', percent: 0, message: 'Extracting concepts from source...' });
        reporter.report({ type: 'status', message: `[${stageNum}/${totalStages}] Extracting concepts from ${baseName}${ext}`, percent: Math.floor((stageNum - 1) / totalStages * 100), operationId: 'workflow-extract' });

        let concepts: string[] = [];
        let sourceContent = '';
        try {
            sourceContent = await fs.promises.readFile(resolvedPath, 'utf8');
            concepts = Array.from(
                await this.fileProcessor.extractConceptsFromText(sourceContent, settings, reporter, signal)
            ).sort((a, b) => a.localeCompare(b));

            await this.scaffoldConceptFiles(outputFolderPath, concepts);
            stages[0] = { stage: 'extract-concepts', status: 'completed', percent: 100, message: `Extracted ${concepts.length} concepts`, details: { count: concepts.length, concepts } };
            reporter.report({ type: 'status', message: `[${stageNum}/${totalStages}] ✓ Extracted ${concepts.length} concepts`, percent: Math.floor(stageNum / totalStages * 100), operationId: 'workflow-extract' });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            stages[0] = { stage: 'extract-concepts', status: 'error', percent: 100, message: msg };
            errors.push(`extract-concepts: ${msg}`);
            reporter.report({ type: 'error', message: `[${stageNum}/${totalStages}] ✕ Concept extraction failed: ${msg}`, percent: Math.floor(stageNum / totalStages * 100), operationId: 'workflow-extract' });
        }

        // Stage 2 (optional): Add Wiki-Links to source
        let wikiLinkCount = 0;
        if (enableWikilinks && concepts.length > 0) {
            stageNum += 1;
            stages.push({ stage: 'add-wikilinks', status: 'running', percent: 0, message: 'Adding wiki-links to source...' });
            reporter.report({ type: 'status', message: `[${stageNum}/${totalStages}] Adding [[wiki-links]] for ${concepts.length} concepts`, percent: Math.floor((stageNum - 1) / totalStages * 100), operationId: 'workflow-wikilinks' });

            try {
                const injected = this.fileProcessor.injectWikiLinks(sourceContent, concepts);
                wikiLinkCount = injected.linkCount;

                // Write wikified output: in-place or _wikified copy
                let wikifiedPath: string;
                if (request.wikiLinksInPlace) {
                    wikifiedPath = resolvedPath;
                } else {
                    wikifiedPath = path.join(path.dirname(resolvedPath), `${baseName}_wikified${ext}`);
                }
                await fs.promises.writeFile(wikifiedPath, injected.content, 'utf8');

                stages.push({ stage: 'add-wikilinks', status: 'completed', percent: 100, message: `Added ${wikiLinkCount} wiki-links`, details: { linkCount: wikiLinkCount, outputPath: wikifiedPath, inPlace: !!request.wikiLinksInPlace } });
                reporter.report({ type: 'status', message: `[${stageNum}/${totalStages}] ✓ Added ${wikiLinkCount} wiki-links → ${path.basename(wikifiedPath)}`, percent: Math.floor(stageNum / totalStages * 100), operationId: 'workflow-wikilinks' });
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                stages.push({ stage: 'add-wikilinks', status: 'error', percent: 100, message: msg });
                errors.push(`add-wikilinks: ${msg}`);
                reporter.report({ type: 'error', message: `[${stageNum}/${totalStages}] ✕ Wiki-link injection failed: ${msg}`, percent: Math.floor(stageNum / totalStages * 100), operationId: 'workflow-wikilinks' });
            }
        } else if (enableWikilinks && concepts.length === 0) {
            stageNum += 1;
            stages.push({ stage: 'add-wikilinks', status: 'skipped', percent: 100, message: 'No concepts to link', details: { linkCount: 0 } });
        }

        // Stage 3 (optional): Generate from Titles
        let generated = { totalFiles: 0, generatedFiles: 0, failedFiles: 0, outputs: [] as string[] };
        if (enableGenerate) {
            stageNum += 1;
            stages.push({ stage: 'generate-titles', status: 'running', percent: 0, message: 'Generating content from titles...' });
            reporter.report({ type: 'status', message: `[${stageNum}/${totalStages}] Generating content from titles in ${path.basename(outputFolderPath)}`, percent: Math.floor((stageNum - 1) / totalStages * 100), operationId: 'workflow-generate' });

            try {
                generated = await this.contentGenerator.generateFolderFromTitles(
                    outputFolderPath, settings, reporter, signal
                );
                stages.push({ stage: 'generate-titles', status: 'completed', percent: 100, message: `Generated ${generated.generatedFiles}/${generated.totalFiles} files`, details: { totalFiles: generated.totalFiles, generatedFiles: generated.generatedFiles, failedFiles: generated.failedFiles, outputs: generated.outputs } });
                reporter.report({ type: 'status', message: `[${stageNum}/${totalStages}] ✓ Generated ${generated.generatedFiles}/${generated.totalFiles} files`, percent: Math.floor(stageNum / totalStages * 100), operationId: 'workflow-generate' });
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                stages.push({ stage: 'generate-titles', status: 'error', percent: 100, message: msg });
                errors.push(`generate-titles: ${msg}`);
                reporter.report({ type: 'error', message: `[${stageNum}/${totalStages}] ✕ Content generation failed: ${msg}`, percent: Math.floor(stageNum / totalStages * 100), operationId: 'workflow-generate' });
            }
        }

        // Stage 4 (optional): Mermaid Fix
        let mermaid = { folderPath: outputFolderPath, totalFiles: 0, fixedFiles: 0, results: [] as Array<{ filePath: string; changed: boolean; fixes: string[]; content: string }> };
        if (enableMermaid) {
            stageNum += 1;
            stages.push({ stage: 'mermaid-fix', status: 'running', percent: 0, message: 'Fixing Mermaid diagrams...' });
            reporter.report({ type: 'status', message: `[${stageNum}/${totalStages}] Fixing Mermaid diagrams in ${path.basename(outputFolderPath)}`, percent: Math.floor((stageNum - 1) / totalStages * 100), operationId: 'workflow-mermaid' });

            try {
                mermaid = await this.batchFixMermaid(outputFolderPath, true);
                stages.push({ stage: 'mermaid-fix', status: 'completed', percent: 100, message: `Fixed ${mermaid.fixedFiles}/${mermaid.totalFiles} files`, details: { fixedFiles: mermaid.fixedFiles, totalFiles: mermaid.totalFiles, results: mermaid.results } });
                reporter.report({ type: 'status', message: `[${stageNum}/${totalStages}] ✓ Fixed ${mermaid.fixedFiles}/${mermaid.totalFiles} Mermaid diagrams`, percent: 100, operationId: 'workflow-mermaid' });
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                stages.push({ stage: 'mermaid-fix', status: 'error', percent: 100, message: msg });
                errors.push(`mermaid-fix: ${msg}`);
                reporter.report({ type: 'error', message: `[${stageNum}/${totalStages}] ✕ Mermaid fix failed: ${msg}`, percent: 100, operationId: 'workflow-mermaid' });
            }
        }

        reporter.report({ type: 'done', message: `Workflow complete for ${baseName}${ext}`, percent: 100, operationId: 'workflow' });

        return {
            sourceFilePath: resolvedPath,
            outputFolderPath,
            stages,
            summary: {
                conceptsExtracted: concepts.length,
                wikiLinksAdded: wikiLinkCount,
                titlesGenerated: generated.generatedFiles,
                titlesFailed: generated.failedFiles,
                mermaidFilesFixed: mermaid.fixedFiles,
                totalElapsedMs: Date.now() - startedAt,
            },
            errors,
        };
    }

    public async runBatchWorkflow(
        request: BatchWorkflowRequest,
        settings: NotemdSettings,
        reporter: ProgressReporter = createNoopProgressReporter(),
        signal?: AbortSignal
    ): Promise<BatchWorkflowResult> {
        const resolvedFolderPath = path.resolve(String(request.folderPath || '').trim());
        if (!resolvedFolderPath) throw new ValidationError('Missing folderPath.');

        const startedAt = Date.now();
        const stats = await fs.promises.stat(resolvedFolderPath);
        if (!stats.isDirectory()) throw new ValidationError(`Not a directory: ${resolvedFolderPath}`);

        const outputBase = request.outputBasePath
            ? path.resolve(request.outputBasePath)
            : path.join(resolvedFolderPath, '_notemd_batch_output');

        await fs.promises.mkdir(outputBase, { recursive: true });

        reporter.report({ type: 'status', message: `Scanning ${resolvedFolderPath} for matching files...`, percent: 0, operationId: 'batch-workflow' });

        // Collect matching files
        let files = await this.collectTextFiles(resolvedFolderPath);

        // Apply extension filter
        if (request.fileExtensions && request.fileExtensions.length > 0) {
            const exts = new Set(request.fileExtensions.map(e => e.toLowerCase()));
            files = files.filter(f => exts.has(path.extname(f).toLowerCase()));
        }

        // Apply regex pattern filter
        if (request.filePattern) {
            try {
                const regex = new RegExp(request.filePattern, 'i');
                files = files.filter(f => regex.test(path.basename(f)));
            } catch {
                throw new ValidationError(`Invalid regex pattern: ${request.filePattern}`);
            }
        }

        // Limit files
        if (request.maxFiles && request.maxFiles > 0) {
            files = files.slice(0, request.maxFiles);
        }

        const totalFiles = files.length;
        reporter.report({ type: 'status', message: `Found ${totalFiles} matching files. Starting batch workflow...`, percent: 5, operationId: 'batch-workflow' });

        const results: WorkflowResult[] = [];
        const errors: Array<{ filePath: string; error: string }> = [];

        for (let i = 0; i < files.length; i++) {
            if (signal?.aborted) break;

            const filePath = files[i];
            const fileBaseName = path.basename(filePath, path.extname(filePath));
            const baseProgress = 5 + Math.floor((i / files.length) * 90);

            reporter.report({
                type: 'status',
                message: `[${i + 1}/${totalFiles}] Processing ${path.basename(filePath)}...`,
                percent: baseProgress,
                operationId: 'batch-workflow'
            });

            try {
                const fileOutputFolder = path.join(outputBase, fileBaseName);
                const result = await this.runWorkflow({
                    filePath,
                    outputFolderPath: fileOutputFolder,
                    language: request.language,
                    skipGenerate: request.skipGenerate,
                    skipMermaidFix: request.skipMermaidFix,
                }, settings, reporter, signal);

                results.push(result);
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                errors.push({ filePath, error: msg });
                reporter.report({ type: 'error', message: `Failed ${path.basename(filePath)}: ${msg}`, percent: baseProgress, operationId: 'batch-workflow' });
            }
        }

        reporter.report({ type: 'done', message: `Batch workflow complete: ${results.length}/${totalFiles} files processed`, percent: 100, operationId: 'batch-workflow' });

        return {
            folderPath: resolvedFolderPath,
            outputBasePath: outputBase,
            filter: { pattern: request.filePattern, extensions: request.fileExtensions },
            totalFiles,
            completedFiles: results.length,
            failedFiles: errors.length,
            results,
            errors,
            totalElapsedMs: Date.now() - startedAt,
        };
    }

    // Backward-compatible wrapper — uses knowledge-base-root-relative output path
    public async oneClickExtract(
        filePath: string,
        settings: NotemdSettings,
        reporter: ProgressReporter = createNoopProgressReporter(),
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
        const kbRoot = this.resolveKnowledgeBaseRootForFile(resolvedPath);
        const outputFolderPath = path.join(kbRoot, path.basename(resolvedPath, path.extname(resolvedPath)));

        const result = await this.runWorkflow({
            filePath: resolvedPath,
            outputFolderPath,
        }, settings, reporter, signal);

        const findStage = (name: string) => [...result.stages].reverse().find(s => s.stage === name);
        const conceptsStage = findStage('extract-concepts');
        const concepts = (conceptsStage?.status === 'completed' && conceptsStage?.details?.concepts)
            ? (conceptsStage.details.concepts as string[])
            : [];
        const genStage = findStage('generate-titles');
        const genDetails = (genStage?.details || {}) as any;
        const mermaidStage = findStage('mermaid-fix');
        const mermaidDetails = (mermaidStage?.details || {}) as any;

        return {
            sourceFilePath: resolvedPath,
            outputFolderPath: result.outputFolderPath,
            concepts,
            generated: {
                totalFiles: genDetails.totalFiles || 0,
                generatedFiles: genDetails.generatedFiles || 0,
                failedFiles: genDetails.failedFiles || 0,
                outputs: genDetails.outputs || [],
            },
            mermaid: {
                folderPath: result.outputFolderPath,
                totalFiles: mermaidDetails.totalFiles || 0,
                fixedFiles: mermaidDetails.fixedFiles || 0,
                results: mermaidDetails.results || [],
            },
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

    public async testLlmConnection(
        request: Record<string, unknown>,
        settings: NotemdSettings
    ): Promise<{
        success: boolean;
        message: string;
        provider: string;
        model: string;
    }> {
        const requestedProvider = request && typeof request.provider === 'object'
            ? (request.provider as Record<string, unknown>)
            : null;
        const requestedProviderName = String(
            (request && typeof request.providerName === 'string' ? request.providerName : '') ||
            (requestedProvider && typeof requestedProvider.name === 'string' ? requestedProvider.name : '') ||
            settings.activeProvider ||
            ''
        ).trim();

        const persistedProvider = settings.providers.find((provider) => provider.name === requestedProviderName);
        if (!persistedProvider && !requestedProvider) {
            throw new ValidationError(`Provider not found: ${requestedProviderName || settings.activeProvider}`);
        }

        const resolvedProviderName = String(
            (persistedProvider && persistedProvider.name) ||
            requestedProviderName ||
            settings.activeProvider
        ).trim() as LlmProviderName;

        const provider: LlmProviderConfig = {
            ...(persistedProvider || {
                name: resolvedProviderName,
                apiKey: '',
                baseUrl: '',
                model: '',
                temperature: 0.5,
                enabled: true,
            }),
            ...(requestedProvider ? {
                name: resolvedProviderName,
                apiKey: String(requestedProvider.apiKey || '').trim(),
                baseUrl: String(requestedProvider.baseUrl || '').trim(),
                model: String(requestedProvider.model || '').trim(),
                temperature: Number.isFinite(Number(requestedProvider.temperature))
                    ? Number(requestedProvider.temperature)
                    : Number((persistedProvider && persistedProvider.temperature) || 0.5),
                apiVersion: String(requestedProvider.apiVersion || '').trim(),
            } : {}),
        };

        const result = await this.llmProviderClient.testConnection(provider);
        return {
            success: result.success,
            message: result.message,
            provider: provider.name,
            model: provider.model,
        };
    }

    // ── Extract original text (obsidian-notemd v1.8.4) ──

    public async extractOriginalText(
        request: ExtractOriginalTextRequest,
        _settings: NotemdSettings,
        _reporter: ProgressReporter = createNoopProgressReporter(),
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
