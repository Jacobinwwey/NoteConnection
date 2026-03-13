import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

type PackageJson = {
  scripts?: Record<string, string>;
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

describe('pathbridge strict schema policy contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const verifyScriptPath = path.join(repoRoot, 'scripts', 'verify-pathbridge-strict-schema.js');
  const migrationWorkflowPath = path.join(repoRoot, '.github', 'workflows', 'migration-gates.yml');

  test('exports strict pathbridge verifier npm script and wires gate pipeline', () => {
    const packageJson = readJson<PackageJson>(packageJsonPath);
    const scripts = packageJson.scripts || {};

    expect(scripts['verify:pathbridge:strict']).toBe('node scripts/verify-pathbridge-strict-schema.js');
    expect(scripts['test:gates']).toContain('verify:pathbridge:strict');
  });

  test('strict verifier script enforces strict schema toggles and validates envelope behavior', () => {
    const source = fs.readFileSync(verifyScriptPath, 'utf8');

    expect(source).toContain('NOTE_CONNECTION_BRIDGE_REJECT_UNKNOWN_TYPES');
    expect(source).toContain('NOTE_CONNECTION_BRIDGE_STRICT_CONFIG_SCHEMA');
    expect(source).toContain('parseBridgeInboundEnvelope');
    expect(source).toContain('--contract-only');
    expect(source).toContain('customRuntimeEvent');
    expect(source).toContain('customRuntimeHint');
  });

  test('migration workflow provisions dedicated strict pathbridge schema suite', () => {
    const workflow = fs.readFileSync(migrationWorkflowPath, 'utf8');
    expect(workflow).toContain('pathbridge-strict-schema-suite');
    expect(workflow).toContain('npm run verify:pathbridge:strict');
  });

  test('strict verifier script passes in repository runtime', () => {
    const result = spawnSync(process.execPath, [verifyScriptPath], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        NOTE_CONNECTION_REQUIRE_STRICT_PATHBRIDGE_SCHEMA: '1',
      },
      stdio: 'pipe',
    });

    expect(result.status).toBe(0);
    expect(String(result.stdout)).toContain('[PathBridge Strict Verify] PASS');
  });
});
