import * as fs from 'fs';
import * as path from 'path';

type PackageJson = {
  scripts?: Record<string, string>;
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

describe('sidecar signature verification contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const verifierPath = path.join(repoRoot, 'scripts', 'verify-sidecar-signatures.js');

  test('wires verify:sidecar:signatures script into gate pipeline', () => {
    const packageJson = readJson<PackageJson>(packageJsonPath);
    const scripts = packageJson.scripts || {};

    expect(scripts['verify:sidecar:signatures']).toBe('node scripts/verify-sidecar-signatures.js');
    expect(scripts['test:gates']).toContain('verify:sidecar:signatures');
    expect(scripts['test:gates']).toContain('--contract-only');
  });

  test('verifier supports strict signing mode and platform-specific validation hooks', () => {
    const source = fs.readFileSync(verifierPath, 'utf8');

    expect(source).toContain('NOTE_CONNECTION_REQUIRE_SIGNED_SIDECAR');
    expect(source).toContain('--require-signed');
    expect(source).toContain('--artifact-root');
    expect(source).toContain('--contract-only');
    expect(source).toContain('Get-AuthenticodeSignature');
    expect(source).toContain('codesign');
    expect(source).toContain('verifyArtifactSignature');
  });
});
