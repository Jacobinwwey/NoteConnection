import * as fs from 'fs';
import * as path from 'path';

describe('pkg snapshot safety contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const runtimeEntryFiles = [
    path.join(repoRoot, 'src', 'reader_renderer.ts'),
    path.join(repoRoot, 'src', 'core', 'PathBridge.ts'),
    path.join(repoRoot, 'src', 'frontend', 'source_manager.js'),
    path.join(repoRoot, 'src', 'server.ts')
  ];

  test('critical runtime modules avoid dynamic eval/new Function fallback paths', () => {
    runtimeEntryFiles.forEach((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8');
      expect(source).not.toContain('new Function(');
      expect(source).not.toContain('eval(');
    });
  });

  test('reader and source manager keep packaging-safe Mermaid/runtime fallback paths', () => {
    const readerRenderer = fs.readFileSync(runtimeEntryFiles[0], 'utf8');
    const sourceManager = fs.readFileSync(runtimeEntryFiles[2], 'utf8');

    expect(readerRenderer).toContain('loadMermaidModule');
    expect(readerRenderer).toContain('MERMAID_BROWSER_BUNDLE_BASE64');
    expect(readerRenderer).toContain("createElement('script')");
    expect(readerRenderer).not.toContain("require('mermaid')");
    expect(sourceManager).toContain('parseGraphDataPayload');
    expect(sourceManager).toContain('Fallback for assignment-based payloads without using runtime eval.');
  });
});
