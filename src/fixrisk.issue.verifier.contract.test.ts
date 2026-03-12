import * as fs from 'fs';
import * as path from 'path';

describe('fixrisk issue verifier contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const verifierScriptPath = path.join(repoRoot, 'scripts', 'verify-fixrisk-issues.js');

  test('package scripts expose consolidated fixrisk verification commands', () => {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    expect(pkg.scripts['verify:fixrisk:issues']).toBe('node scripts/verify-fixrisk-issues.js');
    expect(pkg.scripts['verify:fixrisk:issues:strict']).toBe(
      'node scripts/verify-fixrisk-issues.js --strict-pending'
    );
  });

  test('verifier script tracks all FR issues and emits latest report artifact', () => {
    const script = fs.readFileSync(verifierScriptPath, 'utf8');
    expect(script).toContain('fixrisk-issue-check-latest.json');
    expect(script).toContain('fixrisk-jest-contract-report.json');
    expect(script).toContain("'FR-001'");
    expect(script).toContain("'FR-011'");
    expect(script).toContain('verify-capacitor-evidence-freshness.js');
    expect(script).toContain('verify-tauri-android-prereqs.js');
  });
});
