import * as fs from 'fs';
import * as path from 'path';

type PackageJson = {
  scripts?: Record<string, string>;
};

describe('foundation ann runtime verification contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const scriptPath = path.join(repoRoot, 'scripts', 'verify-foundation-ann-runtime.js');

  function readJson<T>(filePath: string): T {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T;
  }

  test('keeps the host-level ann runtime verifier wired in package scripts', () => {
    const packageJson = readJson<PackageJson>(packageJsonPath);
    expect(packageJson.scripts?.['verify:foundation:ann-runtime']).toBe(
      'npm run build && node scripts/ensure-sidecar-ready.js && node scripts/verify-foundation-ann-runtime.js'
    );
    expect(packageJson.scripts?.['verify:foundation:ann-runtime:matrix']).toBe(
      'npm run build && node scripts/ensure-sidecar-ready.js && node scripts/verify-foundation-ann-runtime.js --matrix'
    );
  });

  test('verifier script covers smoke/medium/heavy ann profiles across dist runtime and packaged sidecar restart continuity', () => {
    const source = fs.readFileSync(scriptPath, 'utf8');

    expect(source).toContain('WORKLOAD_PROFILES');
    expect(source).toContain("profileId: 'medium'");
    expect(source).toContain("profileId: 'heavy'");
    expect(source).toContain("suiteKind: 'matrix'");
    expect(source).toContain('startReferenceAnnService');
    expect(source).toContain('/sync-index');
    expect(source).toContain('/select-candidates');
    expect(source).toContain('dist_node_runtime');
    expect(source).toContain('packaged_sidecar');
    expect(source).toContain('/api/knowledge/ingest');
    expect(source).toContain('/api/knowledge/query');
    expect(source).toContain('/api/knowledge/query-backend-diagnostics');
    expect(source).toContain("configuredBackend || '') === 'local_vector'");
    expect(source).toContain("String(runtime.backendId || '') === 'local-vector-v1'");
    expect(source).toContain("String(acceleration.mode || '') === 'ann_prefilter'");
    expect(source).toContain("String(acceleration.adapterId || '') === 'external-http-vector-acceleration-v1'");
    expect(source).toContain("String(acceleration.representationStatus || '') === 'aligned'");
    expect(source).toContain('anchorkey');
  });
});
