import * as fs from 'fs';
import * as path from 'path';

describe('NoteMD API contract wiring', () => {
  const serverSourcePath = path.join(__dirname, 'server.ts');
  const routesSourcePath = path.join(__dirname, 'routes', 'notemd.ts');
  const serverSource = fs.readFileSync(serverSourcePath, 'utf8');
  const routesSource = fs.existsSync(routesSourcePath) ? fs.readFileSync(routesSourcePath, 'utf8') : '';

  function endpointExistsInSource(endpoint: string): boolean {
    return serverSource.includes(endpoint) || routesSource.includes(endpoint);
  }

  test('server exposes all planned /api/notemd endpoints', () => {
    const endpoints = [
      '/api/notemd/settings',
      '/api/notemd/process-file',
      '/api/notemd/process-folder',
      '/api/notemd/test-llm',
      '/api/notemd/generate-content',
      '/api/notemd/translate-file',
      '/api/notemd/translate-folder',
      '/api/notemd/fix-mermaid',
      '/api/notemd/fix-formulas',
      '/api/notemd/check-duplicates',
      '/api/notemd/extract-concepts',
      '/api/notemd/cancel',
      // ── obsidian-notemd v1.8.4 additions ──
      '/api/notemd/generate-diagram',
      '/api/notemd/preview-diagram',
      '/api/notemd/export-diagram',
      '/api/notemd/search',
      '/api/notemd/progress',
      '/api/notemd/diagnose-llm',
      '/api/notemd/extract-original-text',
    ];

    endpoints.forEach((endpoint) => {
      expect(
        endpointExistsInSource(endpoint)
      ).toBe(true);
    });
  });

  test('server persists NoteMD settings through app_config.toml helpers', () => {
    expect(serverSource).toContain("from './notemd/AppConfigToml'");
    expect(serverSource).toContain('loadAppConfigToml');
    expect(serverSource).toContain('saveAppConfigToml');
    expect(serverSource).toContain('persistNotemdSettings');
    expect(serverSource).toContain('loadNotemdSettings');
  });
});
