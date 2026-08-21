import * as fs from 'fs';
import * as path from 'path';

describe('storage provider capacitor content mapping contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const storageProviderPath = path.join(repoRoot, 'src', 'frontend', 'storage_provider.js');

  test('maps desktop-style Knowledge_Base paths for capacitor content reads', () => {
    const source = fs.readFileSync(storageProviderPath, 'utf8');
    expect(source).toContain('function extractRelativePathFromKbMarker(rawFilePath)');
    expect(source).toContain('function resolveCapacitorContentCandidatePath(rawFilePath)');
    expect(source).toContain("if (/^[A-Za-z]:\\//.test(normalized) || normalized.startsWith('/')) {");
    expect(source).toContain('Cannot map absolute desktop path on Capacitor without Knowledge_Base marker.');
  });

  test('uses capacitor filesystem path resolution before sidecar path in readContent', () => {
    const source = fs.readFileSync(storageProviderPath, 'utf8');
    expect(source).toContain('if (isCapacitorNativeRuntime()) {');
    expect(source).toContain('const capacitorPath = resolveCapacitorContentCandidatePath(filePath);');
    expect(source).toContain('return await capacitorReadText(capacitorPath, {');
  });
});
