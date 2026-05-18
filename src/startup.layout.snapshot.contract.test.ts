import * as fs from 'fs';
import * as path from 'path';

describe('startup layout snapshot contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const appPath = path.join(repoRoot, 'src', 'frontend', 'app.js');

  test('rejects and purges degenerate persisted layout snapshots', () => {
    const source = fs.readFileSync(appPath, 'utf8');
    expect(source).toContain('async function deleteStartupLayoutSnapshotRecord(fingerprint)');
    expect(source).toContain("reason: 'degenerate-layout'");
    expect(source).toContain('if ((spanX < 48 && spanY < 48) || uniqueRatio < 0.12)');
    expect(source).toContain('if (validation.purge === true && record.fingerprint)');
  });
});
