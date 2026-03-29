import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

describe('notemd embedded refresh contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const appPath = path.join(repoRoot, 'src', 'frontend', 'app.js');
  const notemdPath = path.join(repoRoot, 'src', 'frontend', 'notemd.js');

  test('host page emits a refresh message whenever embedded NoteMD is opened', () => {
    const appSource = fs.readFileSync(appPath, 'utf8');
    expect(appSource).toContain("const NOTEMD_EMBED_REFRESH = 'noteconnection:notemd-refresh'");
    expect(appSource).toContain('function notifyNotemdIframeRefresh(context = {})');
    expect(appSource).toContain('notifyNotemdIframeRefresh(refreshContext);');
    expect(appSource).toContain('notemdIframe.addEventListener(\'load\'');
  });

  test('embedded NoteMD listens for refresh signal and reloads unified settings', () => {
    const notemdSource = fs.readFileSync(notemdPath, 'utf8');
    expect(notemdSource).toContain('const NOTEMD_EMBED_REFRESH = "noteconnection:notemd-refresh"');
    expect(notemdSource).toContain('window.addEventListener("message", (event) => {');
    expect(notemdSource).toContain('data.type !== NOTEMD_EMBED_REFRESH');
    expect(notemdSource).toContain('await loadSettings();');
    expect(notemdSource).toContain('await loadWorkspace(true);');
    expect(notemdSource).toContain('Unified frontend settings refreshed');
  });

  test('embedded NoteMD script remains syntactically valid', () => {
    const notemdSource = fs.readFileSync(notemdPath, 'utf8');
    expect(() => new vm.Script(notemdSource)).not.toThrow();
  });
});
