import * as fs from 'fs';
import * as path from 'path';
import { BatchProcessor } from './BatchProcessor';
import { NOTEMD_SUPPORTED_TEXT_EXTENSIONS } from './constants';
import { LlmProviderClient, selectModelForTask, selectProviderForTask } from './LlmProvider';
import { PromptManager } from './PromptManager';
import {
    GenerateContentRequest,
    NotemdSettings,
    ProgressReporter,
    ValidationError,
} from './types';
import { createNoopProgressReporter } from './progressReporter';

function isTextExtension(filePath: string): boolean {
    return NOTEMD_SUPPORTED_TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export class ContentGenerator {
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

    public async generateFromTitle(
        request: GenerateContentRequest,
        settings: NotemdSettings,
        reporter: ProgressReporter = createNoopProgressReporter(),
        signal?: AbortSignal
    ): Promise<string> {
        const title = String(request.title || '').trim();
        if (!title) {
            throw new ValidationError('Missing title.');
        }

        const provider = selectProviderForTask(settings, 'generateTitle');
        const model = selectModelForTask(settings, 'generateTitle', provider);
        const researchSection = request.context && request.context.trim()
            ? `Use this external context when relevant:\n${request.context.trim()}`
            : 'No external research context was provided.';
        const prompt = this.promptManager.getPrompt(settings, 'generateTitle', {
            TITLE: title,
            RESEARCH_CONTEXT_SECTION: researchSection,
        });

        reporter.report({ type: 'status', message: `Generating content for "${title}"`, percent: 10 });
        const result = await this.llmClient.complete({
            provider,
            model,
            prompt,
            content: `Generate an in-depth markdown document for: ${title}`,
            maxTokens: settings.maxTokens,
            signal,
            maxRetries: settings.maxRetries,
            retryDelayMs: settings.retryDelayMs,
            onRetry: (attempt, message) => {
                reporter.report({
                    type: 'warning',
                    message: `Generate retry ${attempt}: ${message}`,
                });
            },
        });

        reporter.report({ type: 'done', message: `Generated content for "${title}"`, percent: 100 });
        return result.text.trim();
    }

    public async generateForFile(
        filePath: string,
        settings: NotemdSettings,
        reporter: ProgressReporter = createNoopProgressReporter(),
        signal?: AbortSignal
    ): Promise<{ filePath: string; outputPath: string; generated: boolean }> {
        const absoluteFilePath = path.resolve(String(filePath || '').trim());
        if (!absoluteFilePath) {
            throw new ValidationError('Missing file path.');
        }
        const stats = await fs.promises.stat(absoluteFilePath);
        if (!stats.isFile()) {
            throw new ValidationError(`Not a file: ${absoluteFilePath}`);
        }
        if (!isTextExtension(absoluteFilePath)) {
            throw new ValidationError(`Unsupported file type: ${absoluteFilePath}`);
        }

        const fileNameTitle = path.basename(absoluteFilePath, path.extname(absoluteFilePath));
        const generatedText = await this.generateFromTitle(
            { title: fileNameTitle },
            settings,
            reporter,
            signal
        );

        const outputPath = this.resolveOutputPath(absoluteFilePath, settings);
        await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.promises.writeFile(outputPath, generatedText, 'utf8');

        return {
            filePath: absoluteFilePath,
            outputPath,
            generated: true,
        };
    }

    public async generateFolderFromTitles(
        folderPath: string,
        settings: NotemdSettings,
        reporter: ProgressReporter = createNoopProgressReporter(),
        signal?: AbortSignal
    ): Promise<{ totalFiles: number; generatedFiles: number; failedFiles: number; outputs: string[] }> {
        const absoluteFolder = path.resolve(String(folderPath || '').trim());
        if (!absoluteFolder) {
            throw new ValidationError('Missing folder path.');
        }
        const folderStats = await fs.promises.stat(absoluteFolder);
        if (!folderStats.isDirectory()) {
            throw new ValidationError(`Not a folder: ${absoluteFolder}`);
        }

        const files = await this.collectCandidateFiles(absoluteFolder);
        if (files.length === 0) {
            return { totalFiles: 0, generatedFiles: 0, failedFiles: 0, outputs: [] };
        }

        const concurrency = settings.enableBatchParallelism ? settings.batchConcurrency : 1;
        const results = await this.batchProcessor.process(
            files,
            async (filePath, index) => {
                reporter.report({
                    type: 'status',
                    message: `Generating ${index + 1}/${files.length}: ${path.basename(filePath)}`,
                    percent: Math.floor((index / files.length) * 100),
                });
                const generated = await this.generateForFile(filePath, settings, reporter, signal);
                return generated.outputPath;
            },
            {
                concurrency,
                interTaskDelayMs: settings.apiCallIntervalMs,
                continueOnError: true,
                signal,
                reporter,
            }
        );

        const outputs = results.filter((item) => item.ok && item.value).map((item) => String(item.value));
        const failedFiles = results.length - outputs.length;
        return {
            totalFiles: files.length,
            generatedFiles: outputs.length,
            failedFiles,
            outputs,
        };
    }

    private async collectCandidateFiles(folderPath: string): Promise<string[]> {
        const results: string[] = [];
        const queue = [folderPath];
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
                if (!entry.isFile() || !isTextExtension(fullPath)) {
                    continue;
                }

                const content = await fs.promises.readFile(fullPath, 'utf8');
                if (!content.trim()) {
                    results.push(fullPath);
                }
            }
        }
        return results.sort((a, b) => a.localeCompare(b));
    }

    private resolveOutputPath(sourceFilePath: string, settings: NotemdSettings): string {
        if (!settings.useCustomGenerateTitleOutputFolder) {
            return sourceFilePath;
        }
        const outputFolder = settings.generateTitleOutputFolderName.trim() || '_complete';
        const parentDir = path.dirname(sourceFilePath);
        const fileName = path.basename(sourceFilePath);
        return path.join(parentDir, outputFolder, fileName);
    }
}
