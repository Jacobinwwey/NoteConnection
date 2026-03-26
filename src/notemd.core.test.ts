import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BatchProcessor } from './notemd/BatchProcessor';
import { DEFAULT_SETTINGS } from './notemd/constants';
import { DuplicateDetector } from './notemd/DuplicateDetector';
import { FileProcessor } from './notemd/FileProcessor';
import { fixFormulaFormats } from './notemd/FormulaFixer';
import { fixMermaidSyntax } from './notemd/MermaidProcessor';
import { NotemdService } from './notemd/NotemdService';

class TempDir {
  public readonly path: string;

  constructor(prefix: string) {
    this.path = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), `${prefix}-`));
  }

  public file(relativePath: string, content: string): string {
    const fullPath = path.join(this.path, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
    return fullPath;
  }

  public mkdir(relativePath: string): string {
    const fullPath = path.join(this.path, relativePath);
    fs.mkdirSync(fullPath, { recursive: true });
    return fullPath;
  }

  public read(relativePath: string): string {
    return fs.readFileSync(path.join(this.path, relativePath), 'utf8');
  }

  public cleanup(): void {
    fs.rmSync(this.path, { recursive: true, force: true });
  }
}

describe('NoteMD core primitives', () => {
  test('fixFormulaFormats converts standalone dollar delimiters', () => {
    const source = ['Paragraph', '$', 'E = mc^2', '$', 'Tail'].join('\n');
    const result = fixFormulaFormats(source);

    expect(result.changed).toBe(true);
    expect(result.content).toContain('$$');
    expect(result.fixes.length).toBeGreaterThan(0);
  });

  test('fixMermaidSyntax normalizes unicode arrows and subgraph titles', () => {
    const source = [
      '```mermaid',
      'graph TD;',
      'subgraph Material Mechanical Properties',
      'A → B',
      'end;',
      '```',
    ].join('\n');

    const result = fixMermaidSyntax(source);
    expect(result.changed).toBe(true);
    expect(result.content).toContain('graph TD');
    expect(result.content).toContain('-->');
    expect(result.content).toContain('subgraph "Material Mechanical Properties"');
  });

  test('fixMermaidSyntax upgrades note syntax into linked note nodes', () => {
    const source = [
      '```mermaid',
      'graph TD',
      'note Torque "Angular acceleration insight"',
      '```',
    ].join('\n');

    const result = fixMermaidSyntax(source);
    expect(result.changed).toBe(true);
    expect(result.content).toContain('NoteTorque["Angular acceleration insight"]');
    expect(result.content).toContain('Torque -.- NoteTorque');
  });

  test('DuplicateDetector reports repeated terms and wiki-links', () => {
    const detector = new DuplicateDetector();
    const content = 'Graph graph graph [[Node]] [[Node]] [[Edge]]';
    const termDupes = detector.detectDuplicateTerms(content, 2);
    const linkDupes = detector.detectDuplicateWikiLinks(content, 2);

    expect(termDupes.some((item) => item.term === 'graph')).toBe(true);
    expect(linkDupes.some((item) => item.term === 'node')).toBe(true);
  });

  test('BatchProcessor keeps index order and continues on item error', async () => {
    const processor = new BatchProcessor();
    const input = [1, 2, 3, 4];
    const results = await processor.process(
      input,
      async (value) => {
        if (value === 3) {
          throw new Error('boom');
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
        return value * 10;
      },
      { concurrency: 2, continueOnError: true }
    );

    expect(results).toHaveLength(4);
    expect(results[0].ok).toBe(true);
    expect(results[0].value).toBe(10);
    expect(results[2].ok).toBe(false);
    expect(results[2].error).toContain('boom');
  });

  test('FileProcessor processes markdown and writes linked output', async () => {
    const temp = new TempDir('notemd-file-processor');
    try {
      const sourcePath = temp.file(
        'input/topic.md',
        '# Graph Theory\nGraph Theory studies graph and node structures.'
      );

      const mockLlmClient = {
        complete: jest.fn(async () => ({
          text: 'CONCEPT: Graph Theory\nCONCEPT: Node',
          provider: 'DeepSeek',
          model: 'test-model',
        })),
      } as any;

      const processor = new FileProcessor(mockLlmClient);
      const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      settings.useCustomConceptNoteFolder = true;
      settings.conceptNoteFolder = 'concepts';
      settings.useCustomProcessedFileFolder = true;
      settings.processedFileFolder = 'processed';

      const result = await processor.processFile(
        { filePath: sourcePath },
        settings,
        { report: () => undefined, isCancelled: () => false }
      );

      expect(result.changed).toBe(true);
      expect(result.linkCount).toBeGreaterThan(0);
      expect(result.outputPath).toContain('processed');

      const saved = fs.readFileSync(result.outputPath, 'utf8');
      expect(saved).toContain('[[Graph Theory]]');
      expect(fs.existsSync(path.join(path.dirname(result.outputPath), 'concepts', 'Graph Theory.md'))).toBe(true);
    } finally {
      temp.cleanup();
    }
  });

  test('NotemdService one-click extract scaffolds a source-named folder and chains generation plus mermaid fixing', async () => {
    const temp = new TempDir('notemd-one-click');
    try {
      const kbRoot = temp.mkdir('Knowledge_Base');
      const sourcePath = temp.file(
        'Knowledge_Base/science/Topic.md',
        '# Topic\n\nGraph theory studies node systems.'
      );

      const fakeFileProcessor = {
        extractConceptsFromText: jest.fn(async () => new Set(['Graph Theory', 'Node Systems'])),
      } as any;

      const fakeContentGenerator = {
        generateFolderFromTitles: jest.fn(async (folderPath: string) => {
          expect(folderPath).toBe(path.join(kbRoot, 'Topic'));
          expect(fs.existsSync(path.join(folderPath, 'Graph Theory.md'))).toBe(true);
          expect(fs.existsSync(path.join(folderPath, 'Node Systems.md'))).toBe(true);
          fs.writeFileSync(
            path.join(folderPath, 'Graph Theory.md'),
            ['```mermaid', 'graph TD', 'note GT "Needs cleanup"', '```'].join('\n'),
            'utf8'
          );
          fs.writeFileSync(
            path.join(folderPath, 'Node Systems.md'),
            ['```mermaid', 'graph TD', 'note NS "Needs cleanup"', '```'].join('\n'),
            'utf8'
          );
          return {
            totalFiles: 2,
            generatedFiles: 2,
            failedFiles: 0,
            outputs: [
              path.join(folderPath, 'Graph Theory.md'),
              path.join(folderPath, 'Node Systems.md'),
            ],
          };
        }),
      } as any;

      const service = new NotemdService(
        fakeFileProcessor,
        undefined,
        fakeContentGenerator
      );

      const result = await (service as any).oneClickExtract(
        sourcePath,
        { ...DEFAULT_SETTINGS },
        { report: () => undefined, isCancelled: () => false }
      );

      expect(result.outputFolderPath).toBe(path.join(kbRoot, 'Topic'));
      expect(result.concepts).toEqual(['Graph Theory', 'Node Systems']);
      expect(result.generated.generatedFiles).toBe(2);
      expect(result.mermaid.fixedFiles).toBe(2);
      expect(fs.readFileSync(path.join(result.outputFolderPath, 'Graph Theory.md'), 'utf8')).toContain(
        'NoteGT["Needs cleanup"]'
      );
    } finally {
      temp.cleanup();
    }
  });

  test('NotemdService can batch-fix Mermaid files across a folder tree', async () => {
    const temp = new TempDir('notemd-batch-mermaid');
    try {
      const folder = temp.mkdir('Knowledge_Base/Topic');
      const nested = temp.mkdir('Knowledge_Base/Topic/nested');
      const fileA = temp.file(
        'Knowledge_Base/Topic/a.md',
        ['```mermaid', 'graph TD', 'note A "Alpha"', '```'].join('\n')
      );
      const fileB = temp.file(
        'Knowledge_Base/Topic/nested/b.md',
        ['```mermaid', 'graph TD', 'note B "Beta"', '```'].join('\n')
      );

      const service = new NotemdService();
      const result = await (service as any).batchFixMermaid(folder);

      expect(result.totalFiles).toBe(2);
      expect(result.fixedFiles).toBe(2);
      expect(result.results.map((item: any) => item.filePath).sort()).toEqual([fileA, fileB].sort());
      expect(fs.readFileSync(fileA, 'utf8')).toContain('NoteA["Alpha"]');
      expect(fs.readFileSync(fileB, 'utf8')).toContain('NoteB["Beta"]');
      expect(fs.existsSync(nested)).toBe(true);
    } finally {
      temp.cleanup();
    }
  });
});
