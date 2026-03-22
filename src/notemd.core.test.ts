import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BatchProcessor } from './notemd/BatchProcessor';
import { DEFAULT_SETTINGS } from './notemd/constants';
import { DuplicateDetector } from './notemd/DuplicateDetector';
import { FileProcessor } from './notemd/FileProcessor';
import { fixFormulaFormats } from './notemd/FormulaFixer';
import { fixMermaidSyntax } from './notemd/MermaidProcessor';

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
});

