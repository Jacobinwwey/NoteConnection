import * as fs from 'fs';
import * as path from 'path';

describe('frontend settings runtime sync guard', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const settingsPath = path.join(repoRoot, 'src', 'frontend', 'settings.js');

  test('disables runtime hydration and persistence when the page is only a detached frontend preview', () => {
    const source = fs.readFileSync(settingsPath, 'utf8');
    expect(source).toContain('function shouldEnableRuntimeSync()');
    expect(source).toContain('this.runtimeSyncEnabled = shouldEnableRuntimeSync();');
    expect(source).toContain('if (!this.runtimeSyncEnabled) {');
    expect(source).toContain('this.isHydrationComplete = true;');
    expect(source).toContain('if (!this.runtimeSyncEnabled) {');
    expect(source).toContain('return /^https?:\\/\\/(?:127\\.0\\.0\\.1|localhost):3000$/.test(origin);');
  });
});
