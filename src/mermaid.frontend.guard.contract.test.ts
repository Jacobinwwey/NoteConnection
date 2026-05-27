import * as fs from 'fs';
import * as path from 'path';

describe('mermaid frontend guard contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const appPath = path.join(repoRoot, 'src', 'frontend', 'app.js');
  const readerPath = path.join(repoRoot, 'src', 'frontend', 'reader.js');
  const stylesPath = path.join(repoRoot, 'src', 'frontend', 'styles.css');

  test('installs a global Mermaid artifact suppression observer for leaked error SVGs', () => {
    const source = fs.readFileSync(appPath, 'utf8');
    expect(source).toContain('function suppressMermaidErrorArtifacts(root, context = {})');
    expect(source).toContain('function installMermaidErrorArtifactObserver()');
    expect(source).toContain('function installMermaidRuntimeGuards()');
    expect(source).toContain('function exposeMermaidDebugInterface()');
    expect(source).toContain('installMermaidErrorArtifactObserver();');
    expect(source).toContain("normalized.includes('syntax error in text')");
    expect(source).toContain("normalized.includes('mermaid version')");
    expect(source).toContain('captureRuntimeState: () => ({');
    expect(source).toContain('function isProtectedMermaidSuppressionHost(host)');
    expect(source).toContain('root !== document.body');
    expect(source).toContain("host.id === 'reading-body'");
  });

  test('reader mermaid suppression never selects the page root as a removable host', () => {
    const source = fs.readFileSync(readerPath, 'utf8');
    expect(source).toContain('isProtectedMermaidSuppressionHost(host)');
    expect(source).toContain('root !== document.body');
    expect(source).toContain("host.id === 'graph-wrapper'");
    expect(source).toContain('Reader Mermaid offscreen host mount root is unavailable.');
    expect(source).toContain('ensureReaderStructure()');
    expect(source).toContain("replacementBody.id = 'reading-body'");
    expect(source).toContain('this.contentBox.appendChild(replacementBody);');
    expect(source).toContain('lookupNodeDataById(nodeId)');
    expect(source).toContain("typeof graphData !== 'undefined'");
    expect(source).toContain('isReaderBodyVisiblyEmpty()');
    expect(source).toContain('Markdown protocol path completed without visible content. Falling back to raw markdown render.');
  });

  test('ships compact inline and toast styles for suppressed Mermaid errors', () => {
    const source = fs.readFileSync(stylesPath, 'utf8');
    expect(source).toContain('.mermaid-inline-guard');
    expect(source).toContain('.mermaid-error-toast-stack');
    expect(source).toContain('.mermaid-error-toast');
  });
});
