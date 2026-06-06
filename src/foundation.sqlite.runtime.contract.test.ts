import * as fs from 'fs';
import * as path from 'path';

type PackageJson = {
  scripts?: Record<string, string>;
};

describe('foundation sqlite runtime verification contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const scriptPath = path.join(repoRoot, 'scripts', 'verify-foundation-sqlite-runtime.js');

  function readJson<T>(filePath: string): T {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T;
  }

  test('keeps the host-level sqlite runtime verifier wired in package scripts', () => {
    const packageJson = readJson<PackageJson>(packageJsonPath);
    expect(packageJson.scripts?.['verify:foundation:sqlite-runtime']).toBe(
      'npm run build && node scripts/ensure-sidecar-ready.js && node scripts/verify-foundation-sqlite-runtime.js'
    );
    expect(packageJson.scripts?.['verify:foundation:sqlite-runtime:heavy']).toBe(
      'npm run build && node scripts/ensure-sidecar-ready.js && node scripts/verify-foundation-sqlite-runtime.js --heavy'
    );
    expect(packageJson.scripts?.['verify:foundation:sqlite-runtime:matrix']).toBe(
      'npm run build && node scripts/ensure-sidecar-ready.js && node scripts/verify-foundation-sqlite-runtime.js --matrix'
    );
    expect(packageJson.scripts?.['verify:foundation:sqlite-runtime:soak']).toBe(
      'npm run build && node scripts/ensure-sidecar-ready.js && node scripts/verify-foundation-sqlite-runtime.js --soak'
    );
    expect(packageJson.scripts?.['verify:foundation:sqlite-runtime:release']).toBe(
      'npm run build && node scripts/ensure-sidecar-ready.js && node scripts/verify-foundation-sqlite-runtime.js --soak'
    );
  });

  test('verifier script covers smoke/medium/heavy profiles, soak gates, and matrix runs across dist runtime and packaged sidecar restart continuity', () => {
    const source = fs.readFileSync(scriptPath, 'utf8');

    expect(source).toContain('WORKLOAD_PROFILES');
    expect(source).toContain("profileId: 'medium'");
    expect(source).toContain("profileId: 'heavy'");
    expect(source).toContain("arg === '--matrix'");
    expect(source).toContain("arg === '--soak'");
    expect(source).toContain('--soak-cycles');
    expect(source).toContain('dist_node_runtime');
    expect(source).toContain('packaged_sidecar');
    expect(source).toContain('knowledge_graph_store.graphdb.v1.sqlite');
    expect(source).toContain('/api/knowledge/ingest');
    expect(source).toContain('/api/knowledge/store-diagnostics');
    expect(source).toContain('/api/knowledge/foundation/readiness');
    expect(source).toContain('/api/knowledge/query');
    expect(source).toContain("graphBackendSignalKind === 'embedded_graphdb'");
    expect(source).toContain("storageEngine === 'sqlite'");
    expect(source).toContain("usingFallback !== true");
    expect(source).toContain("genericQuery: 'persist graph content restart sqlite proof'");
    expect(source).toContain('graphDbLastSnapshotMetadata');
    expect(source).toContain('heavy_runtime_anchor_');
    expect(source).toContain("options.suiteKind === 'matrix'");
    expect(source).toContain('foundation-sqlite-runtime-report-latest.json');
    expect(source).toContain('restartCycles');
    expect(source).toContain('maxStartupP95Ms');
    expect(source).toContain('maxQueryMaxMs');
    expect(source).toContain('computeRequestTimeoutMs');
  });
});
