import * as fs from 'fs';
import * as path from 'path';

describe('sidecar relaunch smoke contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const scriptPath = path.join(repoRoot, 'scripts', 'smoke-sidecar-relaunch.js');

  test('smoke relaunch script enforces graceful shutdown with hard kill fallback and port release probe', () => {
    const source = fs.readFileSync(scriptPath, 'utf8');

    expect(source).toContain('waitForServerStart');
    expect(source).toContain('localhost');
    expect(source).toContain('127.0.0.1');
    expect(source).toContain('terminateChildProcess');
    expect(source).toContain("child.kill('SIGTERM')");
    expect(source).toContain('taskkill.exe');
    expect(source).toContain('assertPortFree');
    expect(source).toContain('Sidecar relaunch check passed');
  });
});
