import * as fs from 'fs';
import * as path from 'path';

describe('graph accessibility semantic parity contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const appPath = path.join(repoRoot, 'src', 'frontend', 'app.js');
  const pathAppPath = path.join(repoRoot, 'src', 'frontend', 'path_app.js');

  test('main graph view provisions semantic shadow and live region for canvas/svg parity', () => {
    const appJs = fs.readFileSync(appPath, 'utf8');
    expect(appJs).toContain('graph-semantic-shadow');
    expect(appJs).toContain('graph-semantic-summary');
    expect(appJs).toContain('graph-semantic-live');
    expect(appJs).toContain("graphContainer.setAttribute('role', 'group')");
    expect(appJs).toContain("host.setAttribute('role', 'region')");
    expect(appJs).toContain("host.setAttribute('aria-label', regionLabel)");
    expect(appJs).toContain("live.setAttribute('aria-live', 'polite')");
    expect(appJs).toContain("live.setAttribute('aria-atomic', 'true')");
    expect(appJs).toContain('scheduleGraphSemanticA11yRefresh');
    expect(appJs).toContain('buildGraphSemanticSummary');
  });

  test('main graph semantic refresh is wired to renderer, filtering, and focus state transitions', () => {
    const appJs = fs.readFileSync(appPath, 'utf8');
    expect(appJs).toContain("scheduleGraphSemanticA11yRefresh('Renderer changed')");
    expect(appJs).toContain("scheduleGraphSemanticA11yRefresh('Node selected')");
    expect(appJs).toContain("scheduleGraphSemanticA11yRefresh('Focus mode entered')");
    expect(appJs).toContain("scheduleGraphSemanticA11yRefresh('Focus mode exited')");
    expect(appJs).toContain("function updateVisibility(reason = 'Filter visibility updated')");
  });

  test('path mode semantic region contract remains intact', () => {
    const pathAppJs = fs.readFileSync(pathAppPath, 'utf8');
    expect(pathAppJs).toContain('path-semantic-shadow');
    expect(pathAppJs).toContain('path-semantic-summary');
    expect(pathAppJs).toContain('path-semantic-live');
    expect(pathAppJs).toContain("host.setAttribute('role', 'region')");
    expect(pathAppJs).toContain("host.setAttribute('aria-label', 'Path mode semantic summary')");
    expect(pathAppJs).toContain("live.setAttribute('aria-live', 'polite')");
    expect(pathAppJs).toContain('_refreshPathSemanticA11y');
  });
});
