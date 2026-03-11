import * as fs from 'fs';
import * as path from 'path';

type PackageJson = {
  scripts?: Record<string, string>;
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

describe('tauri runner and android prereq contracts', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const tauriRunnerPath = path.join(repoRoot, 'scripts', 'run-tauri-tests.js');
  const androidPrereqPath = path.join(repoRoot, 'scripts', 'verify-tauri-android-prereqs.js');

  test('routes test:tauri through the resilient runner script', () => {
    const pkg = readJson<PackageJson>(packageJsonPath);
    expect(pkg.scripts?.['test:tauri']).toBe('node scripts/run-tauri-tests.js');
  });

  test('tauri runner enforces low-memory cargo defaults with strict CI behavior', () => {
    const source = fs.readFileSync(tauriRunnerPath, 'utf8');

    expect(source).toContain('cleanup-tauri-sidecars.js');
    expect(source).toContain('ensure-tauri-frontend-dist.js');
    expect(source).toContain("['test', '--manifest-path', cargoManifestPath, '-j'");
    expect(source).toContain('CARGO_BUILD_JOBS');
    expect(source).toContain('CARGO_INCREMENTAL');
    expect(source).toContain('NOTE_CONNECTION_TAURI_TEST_STRICT');
    expect(source).toContain("process.env.CI === 'true'");
    expect(source).toContain('degraded-oom');
    expect(source).toContain('failed-oom');
  });

  test('android prereq verifier enforces JDK 21+ before SDK checks', () => {
    const source = fs.readFileSync(androidPrereqPath, 'utf8');

    expect(source).toContain("spawnSync('javac', ['-version']");
    expect(source).toContain('parseJavaMajorVersion');
    expect(source).toContain('if (javac.major < 21)');
    expect(source).toContain('require JDK 21+');
    expect(source).toContain('JDK: ${javac.version}');
  });
});
