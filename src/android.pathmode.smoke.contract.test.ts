import * as fs from 'fs';
import * as path from 'path';

type PackageJson = {
  scripts?: Record<string, string>;
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

describe('android pathmode smoke lifecycle contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const smokeScriptPath = path.join(repoRoot, 'scripts', 'smoke-android-pathmode.js');
  const packageJsonPath = path.join(repoRoot, 'package.json');

  test('smoke script contains lifecycle probes for pathmode enter/exit', () => {
    const script = fs.readFileSync(smokeScriptPath, 'utf8');
    expect(script).toContain('PathmodeGodotActivity');
    expect(script).toContain('MainActivity');
    expect(script).toContain("'input', 'keyevent', '4'");
    expect(script).toContain("'dumpsys', 'activity', 'activities'");
    expect(script).toContain('NOTE_CONNECTION_ANDROID_SMOKE_REQUIRE_DEVICE');
  });

  test('package script exposes android pathmode smoke command', () => {
    const pkg = readJson<PackageJson>(packageJsonPath);
    const scripts = pkg.scripts || {};
    expect(scripts['smoke:android:pathmode']).toBe('node scripts/smoke-android-pathmode.js');
  });
});

