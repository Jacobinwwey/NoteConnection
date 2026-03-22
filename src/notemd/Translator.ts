import * as fs from 'fs';
import * as path from 'path';
import { BatchProcessor } from './BatchProcessor';
import { NOTEMD_SUPPORTED_TEXT_EXTENSIONS } from './constants';
import { LlmProviderClient, selectModelForTask, selectProviderForTask } from './LlmProvider';
import { PromptManager } from './PromptManager';
import {
    FileOperationError,
    NotemdSettings,
    ProgressReporter,
    TranslateFileRequest,
    TranslateFileResult,
    ValidationError,
} from './types';

function defaultReporter(): ProgressReporter {
    return {
        report: () => undefined,
        isCancelled: () => false,
    };
}

function countWords(text: string): number {
    return text
        .trim()
        .split(/\s+/g)
        .filter(Boolean).length;
}

function splitByWordCount(content: string, maxWords: number): string[] {
    const normalizedMaxWords = Math.max(300, Math.floor(maxWords || 1200));
    const paragraphs = String(content || '').split(/(\n\s*\n)/g);
    const chunks: string[] = [];
    let current = '';
    let currentWords = 0;

    paragraphs.forEach((part) => {
        const words = countWords(part);
        if (currentWords > 0 && currentWords + words > normalizedMaxWords) {
            chunks.push(current.trim());
            current = '';
            currentWords = 0;
        }
        current += part;
        currentWords += words;
    });
    if (current.trim()) {
        chunks.push(current.trim());
    }
    return chunks.length > 0 ? chunks : [String(content || '')];
}

export class Translator {
    private readonly llmClient: LlmProviderClient;
    private readonly promptManager: PromptManager;
    private readonly batchProcessor: BatchProcessor;

    constructor(
        llmClient = new LlmProviderClient(),
        promptManager = new PromptManager(),
        batchProcessor = new BatchProcessor()
    ) {
        this.llmClient = llmClient;
        this.promptManager = promptManager;
        this.batchProcessor = batchProcessor;
    }

    public async translateText(
        content: string,
        targetLanguage: string,
        settings: NotemdSettings,
        reporter: ProgressReporter = defaultReporter(),
        signal?: AbortSignal
    ): Promise<string> {
        const provider = selectProviderForTask(settings, 'translate');
        const model = selectModelForTask(settings, 'translate', provider);
        const chunks = splitByWordCount(content, settings.chunkWordCount);
        const translatedChunks: string[] = [];

        for (let i = 0; i < chunks.length; i += 1) {
            if (signal?.aborted || reporter.isCancelled()) {
                throw new Error('Operation cancelled.');
            }

            reporter.report({
                type: 'status',
                message: `Translating chunk ${i + 1}/${chunks.length}`,
                percent: Math.floor((i / chunks.length) * 100),
            });

            const prompt = this.promptManager.getPrompt(settings, 'translate', {
                LANGUAGE: targetLanguage,
            });
            const completion = await this.llmClient.complete({
                provider,
                model,
                prompt,
                content: chunks[i],
                maxTokens: settings.maxTokens,
                signal,
                maxRetries: settings.maxRetries,
                retryDelayMs: settings.retryDelayMs,
                onRetry: (attempt, message) => {
                    reporter.report({
                        type: 'warning',
                        message: `Translate retry ${attempt}: ${message}`,
                    });
                },
            });
            translatedChunks.push(completion.text);
        }

        return translatedChunks.join('\n\n').trim();
    }

    public async translateFile(
        request: TranslateFileRequest,
        settings: NotemdSettings,
        reporter: ProgressReporter = defaultReporter(),
        signal?: AbortSignal
    ): Promise<TranslateFileResult> {
        const filePath = path.resolve(String(request.filePath || '').trim());
        if (!filePath) {
            throw new ValidationError('Missing filePath.');
        }
        const targetLanguage = String(request.targetLanguage || '').trim();
        if (!targetLanguage) {
            throw new ValidationError('Missing targetLanguage.');
        }

        const stats = await this.stat(filePath);
        if (!stats.isFile()) {
            throw new ValidationError(`Not a file: ${filePath}`);
        }
        if (!this.isSupportedTextFile(filePath)) {
            throw new ValidationError(`Unsupported file type: ${filePath}`);
        }

        const source = await fs.promises.readFile(filePath, 'utf8');
        const translated = await this.translateText(source, targetLanguage, settings, reporter, signal);
        const outputPath = this.resolveOutputPath(filePath, request.outputPath, targetLanguage, settings);

        await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.promises.writeFile(outputPath, translated, 'utf8');

        return {
            filePath,
            outputPath,
            changed: translated !== source || outputPath !== filePath,
        };
    }

    public async translateFolder(
        folderPath: string,
        targetLanguage: string,
        settings: NotemdSettings,
        reporter: ProgressReporter = defaultReporter(),
        signal?: AbortSignal
    ): Promise<{ totalFiles: number; translatedFiles: number; failedFiles: number; results: TranslateFileResult[] }> {
        const root = path.resolve(String(folderPath || '').trim());
        const stats = await this.stat(root);
        if (!stats.isDirectory()) {
            throw new ValidationError(`Not a directory: ${root}`);
        }

        const files = await this.collectFiles(root);
        if (files.length === 0) {
            return { totalFiles: 0, translatedFiles: 0, failedFiles: 0, results: [] };
        }

        const concurrency = settings.enableBatchParallelism ? settings.batchConcurrency : 1;
        const perItem = await this.batchProcessor.process(
            files,
            async (filePath, index) => {
                reporter.report({
                    type: 'status',
                    message: `Translating ${index + 1}/${files.length}: ${path.basename(filePath)}`,
                    percent: Math.floor((index / files.length) * 100),
                });
                return this.translateFile(
                    {
                        filePath,
                        targetLanguage,
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
                signal,
                reporter,
            }
        );

        const results = perItem.filter((item) => item.ok && item.value).map((item) => item.value as TranslateFileResult);
        const failedFiles = perItem.length - results.length;
        return {
            totalFiles: perItem.length,
            translatedFiles: results.length,
            failedFiles,
            results,
        };
    }

    private resolveOutputPath(
        sourceFilePath: string,
        explicitOutputPath: string | undefined,
        targetLanguage: string,
        settings: NotemdSettings
    ): string {
        if (explicitOutputPath && explicitOutputPath.trim()) {
            return path.resolve(explicitOutputPath.trim());
        }

        const sourceDir = path.dirname(sourceFilePath);
        const base = path.basename(sourceFilePath, path.extname(sourceFilePath));
        const suffix = settings.useCustomTranslationSuffix
            ? settings.translationCustomSuffix || `_${targetLanguage}`
            : `_${targetLanguage}`;
        const fileName = `${base}${suffix}.md`;

        if (settings.useCustomTranslationSavePath && settings.translationSavePath.trim()) {
            const outputDir = path.isAbsolute(settings.translationSavePath)
                ? settings.translationSavePath.trim()
                : path.join(sourceDir, settings.translationSavePath.trim());
            return path.resolve(path.join(outputDir, fileName));
        }

        return path.resolve(path.join(sourceDir, fileName));
    }

    private async collectFiles(rootDir: string): Promise<string[]> {
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
                if (entry.isFile() && this.isSupportedTextFile(fullPath)) {
                    results.push(fullPath);
                }
            }
        }
        return results.sort((a, b) => a.localeCompare(b));
    }

    private isSupportedTextFile(filePath: string): boolean {
        return NOTEMD_SUPPORTED_TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
    }

    private async stat(filePath: string): Promise<fs.Stats> {
        try {
            return await fs.promises.stat(filePath);
        } catch (error) {
            throw new FileOperationError(`Path does not exist: ${filePath}`, error);
        }
    }
}

