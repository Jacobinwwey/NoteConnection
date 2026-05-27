import * as fs from 'fs';
import * as path from 'path';

describe('tauri sidecar cleanup integration', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const packagePath = path.join(repoRoot, 'package.json');
  const cleanupScriptPath = path.join(repoRoot, 'scripts', 'cleanup-tauri-sidecars.js');
  const sidecarEnsureScriptPath = path.join(repoRoot, 'scripts', 'ensure-sidecar-ready.js');
  const tauriBuildRunnerPath = path.join(repoRoot, 'scripts', 'run-tauri-build.js');
  const tauriDevRunnerPath = path.join(repoRoot, 'scripts', 'run-tauri-dev.js');
  const tauriRunnerPath = path.join(repoRoot, 'scripts', 'run-tauri-tests.js');

  test('desktop tauri scripts run stale sidecar cleanup before cargo build flow', () => {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const tauriRunner = fs.readFileSync(tauriRunnerPath, 'utf8');

    expect(pkg.scripts['cleanup:tauri:sidecars']).toBe('node scripts/cleanup-tauri-sidecars.js');
    expect(pkg.scripts['ensure:sidecar:dev']).toBe('node scripts/ensure-sidecar-ready.js');
    expect(pkg.scripts['tauri:dev']).toContain('npm run cleanup:tauri:sidecars');
    expect(pkg.scripts['tauri:dev:mini']).toContain('npm run cleanup:tauri:sidecars');
    expect(pkg.scripts['tauri:dev']).toContain('npm run ensure:sidecar:dev');
    expect(pkg.scripts['tauri:dev:mini']).toContain('npm run ensure:sidecar:dev');
    expect(pkg.scripts['tauri:dev']).toContain('node scripts/run-tauri-dev.js');
    expect(pkg.scripts['tauri:dev:mini']).toContain('node scripts/run-tauri-dev.js');
    expect(pkg.scripts['tauri:build']).toContain('npm run cleanup:tauri:sidecars');
    expect(pkg.scripts['tauri:build:mini']).toContain('npm run cleanup:tauri:sidecars');
    expect(pkg.scripts['tauri:build']).toContain('node scripts/run-tauri-build.js');
    expect(pkg.scripts['tauri:build:mini']).toContain('node scripts/run-tauri-build.js');

    // test:tauri delegates cleanup/frontend preflight to run-tauri-tests.js.
    expect(pkg.scripts['test:tauri']).toBe('node scripts/run-tauri-tests.js');
    expect(tauriRunner).toContain("const preflightScripts = ['cleanup-tauri-sidecars.js', 'ensure-tauri-frontend-dist.js'];");
    expect(tauriRunner).toContain('for (const scriptFileName of preflightScripts)');

    const tauriBuildRunner = fs.readFileSync(tauriBuildRunnerPath, 'utf8');
    expect(tauriBuildRunner).toContain('CARGO_BUILD_JOBS');
    expect(tauriBuildRunner).toContain('CARGO_PROFILE_RELEASE_OPT_LEVEL');
    expect(tauriBuildRunner).toContain('CARGO_PROFILE_RELEASE_CODEGEN_UNITS');
    expect(tauriBuildRunner).toContain("['tauri', 'build', '--ci'");

    const tauriDevRunner = fs.readFileSync(tauriDevRunnerPath, 'utf8');
    expect(tauriDevRunner).toContain('CARGO_TARGET_DIR');
    expect(tauriDevRunner).toContain('target-dev-lowmem');
    expect(tauriDevRunner).toContain('process.pid');
    expect(tauriDevRunner).toContain('Date.now().toString(36)');
    expect(tauriDevRunner).toContain('CARGO_BUILD_JOBS');
    expect(tauriDevRunner).toContain('CARGO_PROFILE_DEV_DEBUG');
    expect(tauriDevRunner).toContain('CARGO_INCREMENTAL');
    expect(tauriDevRunner).toContain("['tauri', 'dev'");

    const sidecarEnsureScript = fs.readFileSync(sidecarEnsureScriptPath, 'utf8');
    expect(sidecarEnsureScript).toContain('Sidecar binaries are valid and up-to-date');
    expect(sidecarEnsureScript).toContain("runNodeScript('build-sidecar.js')");
    expect(sidecarEnsureScript).toContain("runNpmScript('prepare:godot:bin')");
  });

  test('cleanup script targets copied tauri sidecars in debug and release outputs', () => {
    const script = fs.readFileSync(cleanupScriptPath, 'utf8');
    expect(script).toContain("const defaultTargetRoots = [");
    expect(script).toContain("path.join(repoRoot, 'src-tauri', 'target')");
    expect(script).toContain("path.join(repoRoot, 'src-tauri', 'target-dev-lowmem')");
    expect(script).toContain("const targetModes = ['debug', 'release'];");
    expect(script).toContain("const sidecarNames = ['server', 'godot', 'markdown-worker'];");
    expect(script).toContain('function resolveTargetRoots()');
    expect(script).toContain('process.env.CARGO_TARGET_DIR');
    expect(script).toContain("targetRoot, mode, `${name}.exe`");
    expect(script).toContain('function removeExistingArtifacts(targetPaths)');
    expect(script).toContain('function runPowerShellNameFallbackCleanup(targetPath)');
    expect(script).toContain('KILLED_BY_NAME|');
    expect(script).toContain('[Tauri Sidecar Cleanup] REMOVED|');
    expect(script).toContain('Failed to terminate stale copied sidecars');
  });
});
