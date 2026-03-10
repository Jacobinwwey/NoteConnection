import * as fs from 'fs';
import * as path from 'path';

type PackageJson = {
  scripts?: Record<string, string>;
  pkg?: {
    scripts?: string[];
    assets?: string[];
  };
};

describe('pkg sidecar packaging contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const buildSidecarPath = path.join(repoRoot, 'scripts', 'build-sidecar.js');

  function readJson<T>(filePath: string): T {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T;
  }

  test('keeps pkg scripts/assets explicit for snapshot/runtime stability', () => {
    const packageJson = readJson<PackageJson>(packageJsonPath);
    const pkg = packageJson.pkg || {};
    const pkgScripts = pkg.scripts || [];
    const pkgAssets = pkg.assets || [];

    expect(pkgScripts).toContain('dist/src/backend/workers/**/*.js');
    expect(pkgAssets).toContain('dist/src/**/*');
    expect(pkgAssets).toContain('data.js');
    expect(pkgAssets).toContain('graph_data.json');
  });

  test('retains hardened node22 sidecar build args and target mapping', () => {
    const buildSidecar = fs.readFileSync(buildSidecarPath, 'utf8');
    expect(buildSidecar).toContain("pkgTarget: 'node22-win-x64'");
    expect(buildSidecar).toContain("pkgTarget: 'node22-linux-x64'");
    expect(buildSidecar).toContain("pkgTarget: 'node22-macos-arm64'");
    expect(buildSidecar).toContain("'--compress'");
    expect(buildSidecar).toContain("'Brotli'");
    expect(buildSidecar).toContain("'--no-bytecode'");
    expect(buildSidecar).toContain("'--public'");
  });
});
