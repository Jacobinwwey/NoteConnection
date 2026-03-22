import * as fs from 'fs';
import * as path from 'path';

describe('NoteMD API contract wiring', () => {
  const serverSourcePath = path.join(__dirname, 'server.ts');
  const serverSource = fs.readFileSync(serverSourcePath, 'utf8');

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
    ];

    endpoints.forEach((endpoint) => {
      expect(serverSource).toContain(endpoint);
    });
  });

  test('server persists NoteMD settings in runtime data directory', () => {
    expect(serverSource).toContain('NOTEMD_CONFIG_FILE_NAME');
    expect(serverSource).toContain('persistNotemdSettings');
    expect(serverSource).toContain('loadNotemdSettings');
  });
});

