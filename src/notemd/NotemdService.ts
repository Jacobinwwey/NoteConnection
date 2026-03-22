import * as fs from 'fs';
import * as path from 'path';
import { ContentGenerator } from './ContentGenerator';
import { DuplicateDetector } from './DuplicateDetector';
import { FileProcessor } from './FileProcessor';
import { FormulaFixer } from './FormulaFixer';
import { MermaidProcessor } from './MermaidProcessor';
import { Translator } from './Translator';
import {
    NotemdSettings,
    ProcessFileRequest,
    ProcessFolderRequest,
    ProgressReporter,
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
}

