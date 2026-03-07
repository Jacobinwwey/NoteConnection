import * as fs from 'fs';
import * as path from 'path';

describe('tauri sidecar cleanup integration', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const packagePath = path.join(repoRoot, 'package.json');
  const cleanupScriptPath = path.join(repoRoot, 'scripts', 'cleanup-tauri-sidecars.js');

  test('desktop tauri scripts run stale sidecar cleanup before cargo build flow', () => {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    expect(pkg.scripts['cleanup:tauri:sidecars']).toBe('node scripts/cleanup-tauri-sidecars.js');
    expect(pkg.scripts['tauri:dev']).toContain('npm run cleanup:tauri:sidecars');
    expect(pkg.scripts['tauri:dev:mini']).toContain('npm run cleanup:tauri:sidecars');
    expect(pkg.scripts['tauri:build']).toContain('npm run cleanup:tauri:sidecars');
    expect(pkg.scripts['tauri:build:mini']).toContain('npm run cleanup:tauri:sidecars');
    expect(pkg.scripts['test:tauri']).toContain('node scripts/cleanup-tauri-sidecars.js');
  });

  test('cleanup script targets copied tauri sidecars in debug and release outputs', () => {
    const script = fs.readFileSync(cleanupScriptPath, 'utf8');
    expect(script).toContain("const targetModes = ['debug', 'release'];");
    expect(script).toContain("const sidecarNames = ['server', 'godot'];");
    expect(script).toContain("targetRoot, mode, `${name}.exe`");
    expect(script).toContain('Failed to terminate stale copied sidecars');
  });
});
