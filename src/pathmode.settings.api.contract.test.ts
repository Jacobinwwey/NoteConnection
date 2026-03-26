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
});
