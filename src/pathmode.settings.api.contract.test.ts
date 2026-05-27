import * as fs from 'fs';
import * as path from 'path';

describe('Path Mode settings API contract', () => {
  const serverSourcePath = path.join(__dirname, 'server.ts');
  const serverSource = fs.readFileSync(serverSourcePath, 'utf8');

  test('server exposes path-mode settings read/write endpoints backed by TOML', () => {
    expect(serverSource).toContain('/api/path-mode/settings');
    expect(serverSource).toContain('loadPathModeSettings');
    expect(serverSource).toContain('persistPathModeSettings');
    expect(serverSource).toContain('extractPathModeSettingsFromAppConfig');
    expect(serverSource).toContain('applyPathModeSettingsToAppConfig');
  });

  test('server path-mode settings loader does not short-circuit on stale in-memory cache', () => {
    const loadStart = serverSource.indexOf('async function loadPathModeSettings(): Promise<PathModeSettings> {');
    const loadEnd = serverSource.indexOf('async function persistPathModeSettings(settingsLike: unknown): Promise<PathModeSettings> {');
    const loadSlice = serverSource.slice(loadStart, loadEnd);

    expect(loadStart).toBeGreaterThanOrEqual(0);
    expect(loadEnd).toBeGreaterThan(loadStart);
    expect(loadSlice).toContain('const appConfig = await loadAppConfigToml();');
    expect(loadSlice).not.toContain('if (cachedPathModeSettings)');
  });
});
