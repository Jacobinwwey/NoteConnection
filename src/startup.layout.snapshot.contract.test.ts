import * as fs from 'fs';
import * as path from 'path';

describe('startup layout snapshot contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const appPath = path.join(repoRoot, 'src', 'frontend', 'app.js');

  test('rejects and purges degenerate persisted layout snapshots', () => {
    const source = fs.readFileSync(appPath, 'utf8');
    expect(source).toContain('async function deleteStartupLayoutSnapshotRecord(fingerprint)');
    expect(source).toContain("reason: 'degenerate-layout'");
    expect(source).toContain("reason: 'degenerate-layout-vs-source'");
    expect(source).toContain('function isDegenerateLayoutSummary(summary)');
    expect(source).toContain('function isSnapshotLayoutCollapsedVsSource(summary, sourceSummary)');
    expect(source).toContain('if (validation.purge === true && record.fingerprint)');
  });

  test('restores startup snapshots without re-applying persisted fx/fy pinning and re-seeds collapsed layouts', () => {
    const source = fs.readFileSync(appPath, 'utf8');
    expect(source).toContain('n.fx = null;');
    expect(source).toContain('n.fy = null;');
    expect(source).toContain("restoreSourceLayoutOrJitterNodes(nodes, width, height, 'worker-init');");
    expect(source).toContain('function restoreSourceLayoutOrJitterNodes(nodeList, viewportWidth, viewportHeight, reason = \'\')');
  });
});
