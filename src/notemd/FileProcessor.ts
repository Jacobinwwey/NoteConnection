import * as fs from 'fs';
import * as path from 'path';
import { BatchProcessor } from './BatchProcessor';
import { DuplicateDetector } from './DuplicateDetector';
import { LlmProviderClient, selectModelForTask, selectProviderForTask } from './LlmProvider';
import { PromptManager } from './PromptManager';
import {
    FileOperationError,
    NotemdSettings,
    ProcessFileRequest,
    ProcessFileResult,
    ProcessFolderRequest,
    ProcessFolderResult,
    ProgressReporter,
    ValidationError,
} from './types';
import { NOTEMD_SUPPORTED_TEXT_EXTENSIONS } from './constants';
import { createNoopProgressReporter } from './progressReporter';

type LinkInjectionResult = {
    content: string;
    linkCount: number;
};

function countWords(text: string): number {
    return text
        .trim()
        .split(/\s+/g)
        .filter(Boolean).length;
}

function escapeRegExp(source: string): string {
    return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeConcept(raw: string): string {
    return String(raw || '')
        .replace(/\s+/g, ' ')
        .replace(/^[#*>\-\d.\s]+/, '')
        .replace(/[^\w\u4e00-\u9fff\s-]/g, '')
        .trim();
}

function looksLikeConcept(raw: string): boolean {
    const value = normalizeConcept(raw);
    if (!value) {
        return false;
    }
    if (value.length < 2) {
        return false;
    }
    if (/^\d+$/.test(value)) {
        return false;
    }
    return true;
}

export class FileProcessor {
    private readonly llmClient: LlmProviderClient;
    private readonly promptManager: PromptManager;
    private readonly duplicateDetector: DuplicateDetector;
    private readonly batchProcessor: BatchProcessor;

    constructor(
        llmClient = new LlmProviderClient(),
        promptManager = new PromptManager(),
        duplicateDetector = new DuplicateDetector(),
        batchProcessor = new BatchProcessor()
    ) {
        this.llmClient = llmClient;
        this.promptManager = promptManager;
        this.duplicateDetector = duplicateDetector;
        this.batchProcessor = batchProcessor;
    }

    public splitContent(content: string, maxWords: number): string[] {
        const normalizedMaxWords = Math.max(300, Math.floor(maxWords || 1200));
        const chunks: string[] = [];
        const paragraphs = String(content || '').split(/(\n\s*\n)/g);
        let current = '';
        let currentWordCount = 0;

        paragraphs.forEach((part) => {
            const partWords = countWords(part);
            if (currentWordCount > 0 && currentWordCount + partWords > normalizedMaxWords) {
                chunks.push(current.trim());
                current = '';
                currentWordCount = 0;
            }
            current += part;
            currentWordCount += partWords;
        });

        if (current.trim()) {
            chunks.push(current.trim());
        }

        return chunks.length > 0 ? chunks : [String(content || '')];
    }

    public async extractConceptsFromText(
        content: string,
        settings: NotemdSettings,
        reporter: ProgressReporter = createNoopProgressReporter(),
        signal?: AbortSignal
    ): Promise<Set<string>> {
        const concepts = new Set<string>();
        const chunks = this.splitContent(content, settings.chunkWordCount);
        const provider = selectProviderForTask(settings, 'extractConcepts');
        const model = selectModelForTask(settings, 'extractConcepts', provider);
        const prompt = this.promptManager.getPrompt(settings, 'extractConcepts');

        for (let i = 0; i < chunks.length; i += 1) {
            if (signal?.aborted || reporter.isCancelled()) {
                throw new Error('Operation cancelled.');
            }
            reporter.report({
                type: 'status',
                message: `Extracting concepts (${i + 1}/${chunks.length})`,
                percent: Math.floor((i / chunks.length) * 100),
            });

            try {
                const completion = await this.llmClient.complete({
                    provider,
                    model,
                    prompt,
                    content: chunks[i],
                    maxTokens: Math.max(256, settings.maxTokens),
                    signal,
                    maxRetries: settings.maxRetries,
                    retryDelayMs: settings.retryDelayMs,
                    onRetry: (attempt, message) => {
                        reporter.report({
                            type: 'warning',
                            message: `LLM retry ${attempt} while extracting concepts: ${message}`,
                        });
                    },
                });
                this.parseConceptsFromResponse(completion.text).forEach((item) => concepts.add(item));
            } catch (error) {
                reporter.report({
                    type: 'warning',
                    message: `Concept extraction fallback triggered for chunk ${i + 1}: ${error instanceof Error ? error.message : String(error)}`,
                });
            }
        }

        if (concepts.size === 0) {
            this.extractConceptsHeuristic(content).forEach((item) => concepts.add(item));
        }

        return concepts;
    }

    public async processFile(
        request: ProcessFileRequest,
        settings: NotemdSettings,
        reporter: ProgressReporter = createNoopProgressReporter(),
        signal?: AbortSignal
    ): Promise<ProcessFileResult> {
        const filePath = path.resolve(String(request.filePath || '').trim());
        if (!filePath) {
            throw new ValidationError('Missing filePath.');
        }

        const stats = await this.getFileStats(filePath);
        if (!stats.isFile()) {
            throw new ValidationError(`Not a file: ${filePath}`);
        }
        if (!this.isSupportedTextFile(filePath)) {
            throw new ValidationError(`Unsupported file type: ${filePath}`);
        }

        const source = await fs.promises.readFile(filePath, 'utf8');
        if (!source.trim()) {
            return {
                filePath,
                outputPath: filePath,
                conceptCount: 0,
                concepts: [],
                linkCount: 0,
                changed: false,
            };
        }

        reporter.report({ type: 'status', message: `Processing ${path.basename(filePath)}...`, percent: 5 });
        const concepts = await this.extractConceptsFromText(source, settings, reporter, signal);
        const conceptList = Array.from(concepts).sort((a, b) => b.length - a.length || a.localeCompare(b));

        const injected = this.injectWikiLinks(source, conceptList);
        if (settings.enableDuplicateDetection) {
            const duplicates = this.duplicateDetector.detectDuplicateWikiLinks(injected.content, 3);
            if (duplicates.length > 0) {
                reporter.report({
                    type: 'log',
                    message: `Detected ${duplicates.length} repeated wiki-link terms.`,
                });
            }
        }

        const outputPath = this.resolveProcessedOutputPath(filePath, request.outputPath, settings);
        const changed = injected.content !== source || outputPath !== filePath;

        if (!request.dryRun) {
            await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
            await fs.promises.writeFile(outputPath, injected.content, 'utf8');
        }

        const shouldCreateConceptNotes =
            request.createConceptNotes === true ||
            (settings.useCustomConceptNoteFolder && settings.conceptNoteFolder.trim().length > 0);
        if (!request.dryRun && shouldCreateConceptNotes && concepts.size > 0) {
            await this.createConceptNotes(path.dirname(outputPath), settings, conceptList);
        }

        reporter.report({ type: 'status', message: `Processed ${path.basename(filePath)}.`, percent: 100 });
        return {
            filePath,
            outputPath,
            conceptCount: conceptList.length,
            concepts: conceptList,
            linkCount: injected.linkCount,
            changed,
        };
    }

    public async processFolder(
        request: ProcessFolderRequest,
        settings: NotemdSettings,
        reporter: ProgressReporter = createNoopProgressReporter(),
        signal?: AbortSignal
    ): Promise<ProcessFolderResult> {
        const folderPath = path.resolve(String(request.folderPath || '').trim());
        if (!folderPath) {
            throw new ValidationError('Missing folderPath.');
        }
        const stats = await this.getFileStats(folderPath);
        if (!stats.isDirectory()) {
            throw new ValidationError(`Not a directory: ${folderPath}`);
        }

        const files = await this.collectSupportedFiles(folderPath);
        if (files.length === 0) {
            return {
                folderPath,
                totalFiles: 0,
                processedFiles: 0,
                failedFiles: 0,
                results: [],
                errors: [],
            };
        }

        const concurrency = settings.enableBatchParallelism ? settings.batchConcurrency : 1;
        const perItemResults = await this.batchProcessor.process(
            files,
            async (filePath, index) => {
                reporter.report({
                    type: 'status',
                    message: `Processing file ${index + 1}/${files.length}: ${path.basename(filePath)}`,
                    percent: Math.floor((index / files.length) * 100),
                });
                return this.processFile(
                    {
                        filePath,
                        outputPath: this.resolveFolderOutputPath(filePath, folderPath, request.outputFolderPath),
                        createConceptNotes: request.createConceptNotes,
                        dryRun: request.dryRun,
                    },
                    settings,
                    reporter,
                    signal
                );
            },
            {
                concurrency,
                interTaskDelayMs: settings.apiCallIntervalMs,
                continueOnError: true,
                reporter,
                signal,
            }
        );

        const results: ProcessFileResult[] = [];
        const errors: Array<{ filePath: string; error: string }> = [];
        perItemResults.forEach((item, index) => {
            if (item.ok && item.value) {
                results.push(item.value);
            } else {
                errors.push({
                    filePath: files[index],
                    error: item.error || 'Unknown error',
                });
            }
        });

        return {
            folderPath,
            totalFiles: files.length,
            processedFiles: results.length,
            failedFiles: errors.length,
            results,
            errors,
        };
    }

    private parseConceptsFromResponse(responseText: string): string[] {
        const concepts: string[] = [];
        const lines = String(responseText || '').split(/\r?\n/g);
        lines.forEach((line) => {
            const match = /^\s*CONCEPT:\s*(.+)\s*$/i.exec(line);
            if (!match) {
                return;
            }
            const concept = normalizeConcept(match[1]);
            if (looksLikeConcept(concept)) {
                concepts.push(concept);
            }
        });
        return Array.from(new Set(concepts));
    }

    private extractConceptsHeuristic(content: string): string[] {
        const result = new Set<string>();
        const text = String(content || '');

        const headingPattern = /^\s{0,3}#{1,6}\s+(.+)$/gm;
        let headingMatch = headingPattern.exec(text);
        while (headingMatch) {
            const concept = normalizeConcept(headingMatch[1]);
            if (looksLikeConcept(concept)) {
                result.add(concept);
            }
            headingMatch = headingPattern.exec(text);
        }

        const wikiPattern = /\[\[([^[\]]+)\]\]/g;
        let wikiMatch = wikiPattern.exec(text);
        while (wikiMatch) {
            const concept = normalizeConcept(wikiMatch[1]);
            if (looksLikeConcept(concept)) {
                result.add(concept);
            }
            wikiMatch = wikiPattern.exec(text);
        }

        return Array.from(result);
    }

    public injectWikiLinks(content: string, concepts: string[]): LinkInjectionResult {
        const codeBlocks: string[] = [];
        let safeText = String(content || '').replace(/```[\s\S]*?```/g, (match) => {
            const token = `__NOTEMD_CODE_BLOCK_${codeBlocks.length}__`;
            codeBlocks.push(match);
            return token;
        });

        let linkCount = 0;
        concepts.forEach((concept) => {
            if (!looksLikeConcept(concept)) {
                return;
            }
            if (safeText.includes(`[[${concept}]]`)) {
                return;
            }

            const escaped = escapeRegExp(concept);
            const pattern = new RegExp(`\\b(${escaped})\\b`, 'i');
            let replaced = false;
            safeText = safeText.replace(pattern, (matched) => {
                replaced = true;
                return `[[${matched}]]`;
            });
            if (replaced) {
                linkCount += 1;
            }
        });

        safeText = safeText.replace(/__NOTEMD_CODE_BLOCK_(\d+)__/g, (_match, indexText) => {
            const index = Number(indexText);
            return codeBlocks[index] || '';
        });

        return {
            content: safeText,
            linkCount,
        };
    }

    private async createConceptNotes(baseDir: string, settings: NotemdSettings, concepts: string[]): Promise<void> {
        const conceptFolderName = settings.useCustomConceptNoteFolder
            ? settings.conceptNoteFolder.trim()
            : 'Concepts';
        if (!conceptFolderName) {
            return;
        }

        const conceptDir = path.isAbsolute(conceptFolderName)
            ? conceptFolderName
            : path.join(baseDir, conceptFolderName);
        await fs.promises.mkdir(conceptDir, { recursive: true });

        for (const concept of concepts) {
            const safe = concept.replace(/[\\/:*?"<>|]/g, '').trim();
            if (!safe) {
                continue;
            }
            const notePath = path.join(conceptDir, `${safe}.md`);
            try {
                const stats = await this.getFileStats(notePath).catch(() => null);
                if (stats && stats.isFile()) {
                    continue;
                }
                await fs.promises.writeFile(notePath, `# ${concept}\n`, 'utf8');
            } catch (error) {
                throw new FileOperationError(`Failed to create concept note "${notePath}".`, error);
            }
        }
    }

    private async collectSupportedFiles(rootDir: string): Promise<string[]> {
        const results: string[] = [];
        const queue: string[] = [rootDir];

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) {
                continue;
            }
            const entries = await fs.promises.readdir(current, { withFileTypes: true });
            for (const entry of entries) {
                const entryPath = path.join(current, entry.name);
                if (entry.isDirectory()) {
                    queue.push(entryPath);
                    continue;
                }
                if (entry.isFile() && this.isSupportedTextFile(entryPath)) {
                    results.push(entryPath);
                }
            }
        }

        return results.sort((a, b) => a.localeCompare(b));
    }

    private isSupportedTextFile(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        return NOTEMD_SUPPORTED_TEXT_EXTENSIONS.has(ext);
    }

    private async getFileStats(filePath: string): Promise<fs.Stats> {
        try {
            return await fs.promises.stat(filePath);
        } catch (error) {
            throw new FileOperationError(`Path does not exist: ${filePath}`, error);
        }
    }

    private resolveProcessedOutputPath(sourceFilePath: string, explicitOutputPath: string | undefined, settings: NotemdSettings): string {
        if (settings.moveOriginalFileOnProcess) {
            return sourceFilePath;
        }

        if (explicitOutputPath && explicitOutputPath.trim()) {
            return path.resolve(explicitOutputPath.trim());
        }

        const sourceDir = path.dirname(sourceFilePath);
        const basename = path.basename(sourceFilePath, path.extname(sourceFilePath));
        const suffix = settings.useCustomAddLinksSuffix
            ? settings.addLinksCustomSuffix || '_processed'
            : '_processed';
        const fileName = `${basename}${suffix}.md`;
        const outputDir = settings.useCustomProcessedFileFolder && settings.processedFileFolder.trim()
            ? (path.isAbsolute(settings.processedFileFolder.trim())
                ? settings.processedFileFolder.trim()
                : path.join(sourceDir, settings.processedFileFolder.trim()))
            : sourceDir;
        return path.resolve(path.join(outputDir, fileName));
    }

    private resolveFolderOutputPath(
        sourceFilePath: string,
        sourceFolder: string,
        outputFolderPath: string | undefined
    ): string | undefined {
        if (!outputFolderPath || !outputFolderPath.trim()) {
            return undefined;
        }
        const relative = path.relative(sourceFolder, sourceFilePath);
        return path.join(path.resolve(outputFolderPath), relative);
    }
}
