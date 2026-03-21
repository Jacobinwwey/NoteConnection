import * as fs from 'fs';
import * as path from 'path';

describe('content path sandbox contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const serverPath = path.join(repoRoot, 'src', 'server.ts');
  const controllerPath = path.join(repoRoot, 'src', 'backend', 'controller.ts');

  test('server content endpoint enforces canonical root jail + pkg snapshot guard', () => {
    const source = fs.readFileSync(serverPath, 'utf8');
    expect(source).toContain('Absolute pkg snapshot content paths are not allowed.');
    expect(source).toContain('pkg snapshot paths are not allowed as Knowledge Base roots');
    expect(source).toContain('normalizePathForComparison');
    expect(source).toContain('isPathInsideRoot');
    expect(source).toContain('makeAccessDeniedError');
    expect(source).toContain('isAccessDeniedError');
  });

  test('backend controller uses path-relative sandbox checks instead of prefix matching', () => {
    const source = fs.readFileSync(controllerPath, 'utf8');
    expect(source).toContain('isPathInsideRoot');
    expect(source).toContain('isPkgSnapshotPath');
    expect(source).toContain('tryRealpath');
    expect(source).not.toContain('startsWith(resolvedRoot)');
  });
});
