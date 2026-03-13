import * as fs from 'fs';
import * as path from 'path';

type PackageJson = {
  scripts?: Record<string, string>;
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

describe('sbom policy contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const generatorPath = path.join(repoRoot, 'scripts', 'generate-sbom.js');
  const verifierPath = path.join(repoRoot, 'scripts', 'verify-sbom-policy.js');
  const migrationWorkflowPath = path.join(repoRoot, '.github', 'workflows', 'migration-gates.yml');
  const npmPublishWorkflowPath = path.join(repoRoot, '.github', 'workflows', 'npm-publish.yml');

  test('exports sbom generation and verification npm scripts', () => {
    const packageJson = readJson<PackageJson>(packageJsonPath);
    const scripts = packageJson.scripts || {};

    expect(scripts['generate:sbom']).toBe('node scripts/generate-sbom.js');
    expect(scripts['verify:sbom']).toBe('node scripts/verify-sbom-policy.js');
    expect(scripts['test:gates']).toContain('verify:sbom -- --contract-only');
  });

  test('ships CycloneDX sbom generator with lockfile coverage controls', () => {
    const source = fs.readFileSync(generatorPath, 'utf8');

    expect(source).toContain('CycloneDX');
    expect(source).toContain('package-lock.json');
    expect(source).toContain('NOTE_CONNECTION_SBOM_INCLUDE_DEV');
    expect(source).toContain('--include-dev');
    expect(source).toContain('noteconnection-sbom.cdx.json');
    expect(source).toContain('specVersion');
    expect(source).toContain('dependencies');
  });

  test('ships sbom policy verifier with strict and contract-only modes', () => {
    const source = fs.readFileSync(verifierPath, 'utf8');

    expect(source).toContain('NOTE_CONNECTION_REQUIRE_SBOM_POLICY');
    expect(source).toContain('NOTE_CONNECTION_SBOM_MAX_AGE_HOURS');
    expect(source).toContain('--contract-only');
    expect(source).toContain('--strict');
    expect(source).toContain('bomFormat');
    expect(source).toContain('CycloneDX');
    expect(source).toContain('SBOM Verify');
  });

  test('wires sbom policy contract in migration and publish workflows', () => {
    const migrationWorkflow = fs.readFileSync(migrationWorkflowPath, 'utf8');
    const npmPublishWorkflow = fs.readFileSync(npmPublishWorkflowPath, 'utf8');

    expect(migrationWorkflow).toContain('sbom-policy-contract-suite');
    expect(migrationWorkflow).toContain('npm run verify:sbom -- --contract-only');
    expect(npmPublishWorkflow).toContain('npm run generate:sbom');
    expect(npmPublishWorkflow).toContain('npm run verify:sbom -- --strict 1');
  });
});
