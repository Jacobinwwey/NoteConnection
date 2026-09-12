import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

type PackageJson = {
  scripts?: Record<string, string>;
};

type FoundationReleaseEvidenceModule = {
  parseBoundedInteger: (value: unknown, range: { min: number; max: number; default: number }) => number;
  verifyFoundationReleaseEvidence: (options?: Record<string, unknown>) => {
    ok: boolean;
    errors: string[];
    warnings: string[];
    summary: Record<string, unknown>;
  };
};

describe('foundation release evidence freshness contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const scriptPath = path.join(repoRoot, 'scripts', 'verify-foundation-release-evidence.js');
  const provenance = require('../scripts/foundation-evidence-provenance');
  const fingerprints = require('../scripts/sidecar-build-fingerprint');
  let fixtureIdentity: any;

  function readJson<T>(filePath: string): T {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T;
  }

  function createTempReportRoot(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-foundation-release-evidence-'));
    fs.mkdirSync(path.join(root, 'dist', 'src'), { recursive: true });
    fs.mkdirSync(path.join(root, 'src-tauri', 'bin'), { recursive: true });
    fs.writeFileSync(path.join(root, 'dist', 'src', 'server.js'), 'fixture runtime');
    const sidecar = path.join(root, 'src-tauri', 'bin', 'fixture-sidecar');
    fs.writeFileSync(sidecar, 'fixture packaged runtime');
    fixtureIdentity = { ...provenance.readFoundationRuntimeIdentity(root, sidecar), sourceTreeHash: fingerprints.computeSidecarSourceFingerprint(repoRoot).digest };
    return root;
  }

  function writeJson(filePath: string, value: unknown): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const report: any = structuredClone(value);
    if (report.profileRuns) {
      report.host = { nodeVersion: process.version, ...report.host };
      report.provenance = {
        schemaVersion: 1, runId: `${report.host.evidenceHostId}-${report.verifiedAt}`,
        sourceRevision: 'a'.repeat(40), ...fixtureIdentity, workloadHash: provenance.foundationWorkloadHash(report),
      };
      for (const profile of report.profileRuns) for (const mode of profile.modes) {
        mode.runtime = { ...report.host };
        if (mode.soak) {
          const provided = new Map(mode.soak.gates.map((gate: any) => [gate.gateId, gate]));
          mode.soak.gates = ['startup_p95', 'startup_max', 'ingest_p95', 'ingest_max', 'readiness_p95', 'diagnostics_p95', 'query_p95', 'query_max'].map(gateId => ({
            observedMs: 100, maxAllowedMs: 2500, sampleCount: 8, passed: true, gateId, ...(provided.get(gateId) as object),
          }));
        }
        if (mode.releaseGates) {
          const provided = new Map(mode.releaseGates.gates.map((gate: any) => [gate.gateId, gate]));
          mode.releaseGates.gates = ['startup_p95', 'ingest_p95', 'diagnostics_p95', 'query_p95', 'query_max', 'expected_recall'].map(gateId => ({
            observed: gateId === 'expected_recall' ? 1 : 100, required: gateId === 'expected_recall' ? 1 : 2500,
            comparison: gateId === 'expected_recall' ? 'gte' : 'lte', sampleCount: 8, passed: true, gateId, ...(provided.get(gateId) as object),
          }));
        }
      }
    }
    fs.writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  function buildPassingSqliteReport(
    verifiedAt: string,
    host: Record<string, unknown> = { platform: 'win32', arch: 'x64', evidenceHostId: 'windows-ci-a' }
  ): Record<string, unknown> {
    return {
      verifiedAt,
      host,
      suiteKind: 'soak',
      soakCycles: 5,
      profileRuns: [
        {
          workloadProfile: {
            profileId: 'heavy',
            documentCount: 180,
          },
          modes: [
            {
              mode: 'dist_node_runtime',
              suiteKind: 'soak',
              profileId: 'heavy',
              restartCycleCount: 5,
              performance: {
                queryDurationMs: { count: 8, p95Ms: 120 },
              },
              soak: {
                pass: true,
                gates: [
                  { gateId: 'startup_p95', passed: true },
                  { gateId: 'query_p95', passed: true },
                ],
              },
            },
            {
              mode: 'packaged_sidecar',
              suiteKind: 'soak',
              profileId: 'heavy',
              restartCycleCount: 5,
              performance: {
                queryDurationMs: { count: 8, p95Ms: 180 },
              },
              soak: {
                pass: true,
                gates: [
                  { gateId: 'startup_p95', passed: true },
                  { gateId: 'query_p95', passed: true },
                ],
              },
            },
          ],
        },
      ],
    };
  }

  function buildPassingAnnReport(
    verifiedAt: string,
    host: Record<string, unknown> = { platform: 'win32', arch: 'x64', evidenceHostId: 'windows-ci-a' }
  ): Record<string, unknown> {
    return {
      verifiedAt,
      host,
      suiteKind: 'matrix',
      releaseGatesEnabled: true,
      releaseThresholds: {
        minExpectedRecall: 1,
      },
      profileRuns: ['smoke', 'medium', 'heavy'].map((profileId) => ({
        workloadProfile: {
          profileId,
          documentCount: profileId === 'heavy' ? 260 : profileId === 'medium' ? 140 : 40,
        },
        modes: ['dist_node_runtime', 'packaged_sidecar'].map((mode) => ({
          mode,
          profileId,
          performance: {
            queryDurationMs: { count: 8, p95Ms: 240 },
          },
          expectedRecall: {
            expectedQueryCount: 6,
            matchedQueryCount: 6,
            ratio: 1,
          },
          releaseGates: {
            pass: true,
            expectedRecall: {
              expectedQueryCount: 6,
              matchedQueryCount: 6,
              ratio: 1,
            },
            gates: [
              { gateId: 'startup_p95', passed: true },
              { gateId: 'query_p95', passed: true },
              { gateId: 'expected_recall', passed: true },
            ],
          },
        })),
      })),
    };
  }

  function buildNonReleaseAnnReport(verifiedAt: string): Record<string, unknown> {
    return {
      verifiedAt,
      suiteKind: 'single',
      releaseGatesEnabled: false,
      profileRuns: [
        {
          workloadProfile: {
            profileId: 'smoke',
            documentCount: 40,
          },
          modes: [],
        },
      ],
    };
  }

  test('keeps the release evidence verifier wired in package scripts and migration contracts', () => {
    const packageJson = readJson<PackageJson>(packageJsonPath);

    expect(packageJson.scripts?.['verify:foundation:release-evidence']).toBe(
      'node scripts/verify-foundation-release-evidence.js'
    );
    expect(packageJson.scripts?.['verify:foundation:release-evidence:strict']).toBe(
      'node scripts/verify-foundation-release-evidence.js --min-report-count 3'
    );
    expect(packageJson.scripts?.['verify:foundation:release-evidence:multi-host']).toBe(
      'node scripts/verify-foundation-release-evidence.js --min-report-count 3 --min-host-count 2'
    );
    expect(packageJson.scripts?.['test:migration']).toContain('src/foundation.release.evidence.contract.test.ts');
  });

  test('verifier script validates latest sqlite soak and ANN release-gate reports with bounded freshness', () => {
    const source = fs.readFileSync(scriptPath, 'utf8');

    expect(source).toContain('foundation-sqlite-runtime-report-latest.json');
    expect(source).toContain('foundation-ann-runtime-report-latest.json');
    expect(source).toContain('foundation-release-evidence-report-latest.json');
    expect(source).toContain('NOTE_CONNECTION_FOUNDATION_RELEASE_EVIDENCE_MAX_AGE_HOURS');
    expect(source).toContain('NOTE_CONNECTION_FOUNDATION_RELEASE_EVIDENCE_MIN_REPORT_COUNT');
    expect(source).toContain('NOTE_CONNECTION_FOUNDATION_RELEASE_EVIDENCE_MIN_HOST_COUNT');
    expect(source).toContain('--min-report-count');
    expect(source).toContain('--min-host-count');
    expect(source).toContain('foundation-sqlite-runtime-report-');
    expect(source).toContain('foundation-ann-runtime-report-');
    expect(source).toContain('verify:foundation:sqlite-runtime:release');
    expect(source).toContain('verify:foundation:ann-runtime:release');
    expect(source).toContain("suiteKind === 'soak'");
    expect(source).toContain("suiteKind === 'matrix'");
    expect(source).toContain('releaseGatesEnabled');
    expect(source).toContain('expectedRecall');
    expect(source).toContain('minimumReportCount');
    expect(source).toContain('minimumHostCount');
    expect(source).toContain('dist_node_runtime');
    expect(source).toContain('packaged_sidecar');
  });

  test('bounded integer parsing uses defaults for missing environment values', () => {
    const verifier = require(scriptPath) as FoundationReleaseEvidenceModule;

    expect(verifier.parseBoundedInteger('', { min: 1, max: 10, default: 7 })).toBe(7);
    expect(verifier.parseBoundedInteger(undefined, { min: 1, max: 10, default: 7 })).toBe(7);
  });

  test('accepts fresh passing sqlite soak and ANN release-gate reports', () => {
    const verifier = require(scriptPath) as FoundationReleaseEvidenceModule;
    const tempRoot = createTempReportRoot();
    const sqliteReportPath = path.join(tempRoot, 'foundation-sqlite-runtime-report-latest.json');
    const annReportPath = path.join(tempRoot, 'foundation-ann-runtime-report-latest.json');
    const now = new Date('2026-06-06T00:00:00.000Z');

    try {
      writeJson(sqliteReportPath, buildPassingSqliteReport('2026-06-05T23:00:00.000Z'));
      writeJson(annReportPath, buildPassingAnnReport('2026-06-05T22:00:00.000Z'));

      const result = verifier.verifyFoundationReleaseEvidence({ artifactRoot: tempRoot,
        sqliteReportPath,
        annReportPath,
        now,
        maxAgeHours: 24,
      });

      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.summary.sqlite).toMatchObject({
        suiteKind: 'soak',
        requiredProfiles: ['heavy'],
      });
      expect(result.summary.ann).toMatchObject({
        suiteKind: 'matrix',
        requiredProfiles: ['smoke', 'medium', 'heavy'],
      });
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('rejects stale release evidence even when runtime gates passed', () => {
    const verifier = require(scriptPath) as FoundationReleaseEvidenceModule;
    const tempRoot = createTempReportRoot();
    const sqliteReportPath = path.join(tempRoot, 'foundation-sqlite-runtime-report-latest.json');
    const annReportPath = path.join(tempRoot, 'foundation-ann-runtime-report-latest.json');
    const now = new Date('2026-06-06T00:00:00.000Z');

    try {
      writeJson(sqliteReportPath, buildPassingSqliteReport('2026-06-01T00:00:00.000Z'));
      writeJson(annReportPath, buildPassingAnnReport('2026-06-05T22:00:00.000Z'));

      const result = verifier.verifyFoundationReleaseEvidence({ artifactRoot: tempRoot,
        sqliteReportPath,
        annReportPath,
        now,
        maxAgeHours: 24,
      });

      expect(result.ok).toBe(false);
      expect(result.errors.join('\n')).toContain('sqlite release evidence is stale');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('a later matrix run does not hide a fresh dated SQLite soak', () => {
    const verifier = require(scriptPath) as FoundationReleaseEvidenceModule;
    const tempRoot = createTempReportRoot();
    const sqliteReportPath = path.join(tempRoot, 'foundation-sqlite-runtime-report-latest.json');
    const annReportPath = path.join(tempRoot, 'foundation-ann-runtime-report-latest.json');
    try {
      writeJson(sqliteReportPath, { ...buildPassingSqliteReport('2026-06-05T23:30:00.000Z'), suiteKind: 'matrix' });
      writeJson(path.join(tempRoot, 'foundation-sqlite-runtime-report-2026-06-05T23-00-00.json'), buildPassingSqliteReport('2026-06-05T23:00:00.000Z'));
      writeJson(annReportPath, buildPassingAnnReport('2026-06-05T23:00:00.000Z'));
      const result = verifier.verifyFoundationReleaseEvidence({ artifactRoot: tempRoot,  sqliteReportPath, annReportPath, now: new Date('2026-06-06T00:00:00Z') });
      expect(result.ok).toBe(true);
      expect((result.summary.sqlite as any).reportPath).toContain('2026-06-05T23-00-00');
    } finally { fs.rmSync(tempRoot, { recursive: true, force: true }); }
  });

  test('latest and dated copies of one run do not count as repeated evidence', () => {
    const verifier = require(scriptPath) as FoundationReleaseEvidenceModule;
    const tempRoot = createTempReportRoot();
    const sqliteReportPath = path.join(tempRoot, 'foundation-sqlite-runtime-report-latest.json');
    const annReportPath = path.join(tempRoot, 'foundation-ann-runtime-report-latest.json');
    try {
      const sqlite = buildPassingSqliteReport('2026-06-05T23:00:00.000Z');
      const ann = buildPassingAnnReport('2026-06-05T23:00:00.000Z');
      writeJson(sqliteReportPath, sqlite); writeJson(annReportPath, ann);
      writeJson(path.join(tempRoot, 'foundation-sqlite-runtime-report-copy.json'), sqlite);
      writeJson(path.join(tempRoot, 'foundation-ann-runtime-report-copy.json'), ann);
      const result = verifier.verifyFoundationReleaseEvidence({ artifactRoot: tempRoot,  sqliteReportPath, annReportPath, minReportCount: 2, now: new Date('2026-06-06T00:00:00Z') });
      expect(result.ok).toBe(false);
      expect((result.summary.sqlite as any).reportCount).toBe(1);
      expect((result.summary.ann as any).reportCount).toBe(1);
    } finally { fs.rmSync(tempRoot, { recursive: true, force: true }); }
  });

  test.each([
    ['missing provenance', (report: any) => { delete report.provenance; }],
    ['wrong source', (report: any) => { report.provenance.sourceTreeHash = 'f'.repeat(64); }],
    ['wrong artifact', (report: any) => { report.provenance.artifacts.packaged_sidecar.sha256 = 'f'.repeat(64); }],
    ['changed workload', (report: any) => { report.profileRuns[0].workloadProfile.documentCount++; }],
    ['unsupported runtime', (report: any) => { report.profileRuns[0].modes[0].runtime.nodeVersion = 'v20.19.0'; }],
    ['future report', (report: any) => { report.verifiedAt = '2026-06-07T00:00:00Z'; }],
    ['missing gate', (report: any) => { report.profileRuns[0].modes[0].soak.gates.pop(); }],
    ['unsubstantiated pass', (report: any) => { report.profileRuns[0].modes[0].soak.gates[0].observedMs = 999999; }],
  ])('rejects %s even if the report declares passing gates', (_name, mutate) => {
    const verifier = require(scriptPath) as FoundationReleaseEvidenceModule;
    const tempRoot = createTempReportRoot();
    const sqliteReportPath = path.join(tempRoot, 'foundation-sqlite-runtime-report-latest.json');
    const annReportPath = path.join(tempRoot, 'foundation-ann-runtime-report-latest.json');
    try {
      writeJson(sqliteReportPath, buildPassingSqliteReport('2026-06-05T23:00:00Z'));
      writeJson(annReportPath, buildPassingAnnReport('2026-06-05T23:00:00Z'));
      const report = readJson<any>(sqliteReportPath);
      mutate(report);
      fs.writeFileSync(sqliteReportPath, JSON.stringify(report));
      const result = verifier.verifyFoundationReleaseEvidence({ artifactRoot: tempRoot, sqliteReportPath, annReportPath, now: new Date('2026-06-06T00:00:00Z') });
      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    } finally { fs.rmSync(tempRoot, { recursive: true, force: true }); }
  });

  test('an eligible recent failure is not masked by an older passing soak', () => {
    const verifier = require(scriptPath) as FoundationReleaseEvidenceModule;
    const tempRoot = createTempReportRoot();
    const sqliteReportPath = path.join(tempRoot, 'foundation-sqlite-runtime-report-latest.json');
    const annReportPath = path.join(tempRoot, 'foundation-ann-runtime-report-latest.json');
    try {
      const failed: any = buildPassingSqliteReport('2026-06-05T23:30:00.000Z');
      failed.profileRuns[0].modes[0].soak.pass = false;
      writeJson(sqliteReportPath, failed);
      writeJson(path.join(tempRoot, 'foundation-sqlite-runtime-report-earlier.json'), buildPassingSqliteReport('2026-06-05T23:00:00.000Z'));
      writeJson(annReportPath, buildPassingAnnReport('2026-06-05T23:00:00.000Z'));
      expect(verifier.verifyFoundationReleaseEvidence({ artifactRoot: tempRoot,  sqliteReportPath, annReportPath, now: new Date('2026-06-06T00:00:00Z') }).ok).toBe(false);
    } finally { fs.rmSync(tempRoot, { recursive: true, force: true }); }
  });

  test('accepts repeated sqlite and ANN release evidence when enough fresh history reports exist', () => {
    const verifier = require(scriptPath) as FoundationReleaseEvidenceModule;
    const tempRoot = createTempReportRoot();
    const sqliteReportPath = path.join(tempRoot, 'sqlite', 'foundation-sqlite-runtime-report-latest.json');
    const annReportPath = path.join(tempRoot, 'ann', 'foundation-ann-runtime-report-latest.json');
    const now = new Date('2026-06-06T00:00:00.000Z');

    try {
      writeJson(sqliteReportPath, buildPassingSqliteReport('2026-06-05T23:00:00.000Z'));
      writeJson(
        path.join(tempRoot, 'sqlite', 'foundation-sqlite-runtime-report-2026-06-05T22-30-00-000Z.json'),
        buildPassingSqliteReport('2026-06-05T22:30:00.000Z')
      );
      writeJson(annReportPath, buildPassingAnnReport('2026-06-05T22:00:00.000Z'));
      writeJson(
        path.join(tempRoot, 'ann', 'foundation-ann-runtime-report-2026-06-05T21-30-00-000Z.json'),
        buildPassingAnnReport('2026-06-05T21:30:00.000Z')
      );

      const result = verifier.verifyFoundationReleaseEvidence({ artifactRoot: tempRoot,
        sqliteReportPath,
        annReportPath,
        now,
        maxAgeHours: 24,
        minReportCount: 2,
      });

      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.summary.sqlite).toMatchObject({
        minimumReportCount: 2,
        reportCount: 2,
      });
      expect(result.summary.ann).toMatchObject({
        minimumReportCount: 2,
        reportCount: 2,
      });
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('accepts multi-host release evidence when enough fresh reports cover distinct hosts', () => {
    const verifier = require(scriptPath) as FoundationReleaseEvidenceModule;
    const tempRoot = createTempReportRoot();
    const sqliteReportPath = path.join(tempRoot, 'sqlite', 'foundation-sqlite-runtime-report-latest.json');
    const annReportPath = path.join(tempRoot, 'ann', 'foundation-ann-runtime-report-latest.json');
    const windowsHost = { platform: 'win32', arch: 'x64', evidenceHostId: 'windows-ci-a' };
    const linuxHost = { platform: 'linux', arch: 'x64', evidenceHostId: 'linux-ci-b' };
    const now = new Date('2026-06-06T00:00:00.000Z');

    try {
      writeJson(sqliteReportPath, buildPassingSqliteReport('2026-06-05T23:00:00.000Z', windowsHost));
      writeJson(
        path.join(tempRoot, 'sqlite', 'foundation-sqlite-runtime-report-2026-06-05T22-30-00-000Z.json'),
        buildPassingSqliteReport('2026-06-05T22:30:00.000Z', linuxHost)
      );
      writeJson(annReportPath, buildPassingAnnReport('2026-06-05T22:00:00.000Z', windowsHost));
      writeJson(
        path.join(tempRoot, 'ann', 'foundation-ann-runtime-report-2026-06-05T21-30-00-000Z.json'),
        buildPassingAnnReport('2026-06-05T21:30:00.000Z', linuxHost)
      );

      const result = verifier.verifyFoundationReleaseEvidence({ artifactRoot: tempRoot,
        sqliteReportPath,
        annReportPath,
        now,
        maxAgeHours: 24,
        minReportCount: 2,
        minHostCount: 2,
      });

      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.summary.sqlite).toMatchObject({
        minimumReportCount: 2,
        reportCount: 2,
        minimumHostCount: 2,
        hostCount: 2,
      });
      expect(result.summary.ann).toMatchObject({
        minimumReportCount: 2,
        reportCount: 2,
        minimumHostCount: 2,
        hostCount: 2,
      });
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('rejects multi-host release evidence when repeated reports come from one host', () => {
    const verifier = require(scriptPath) as FoundationReleaseEvidenceModule;
    const tempRoot = createTempReportRoot();
    const sqliteReportPath = path.join(tempRoot, 'sqlite', 'foundation-sqlite-runtime-report-latest.json');
    const annReportPath = path.join(tempRoot, 'ann', 'foundation-ann-runtime-report-latest.json');
    const windowsHost = { platform: 'win32', arch: 'x64', evidenceHostId: 'windows-ci-a' };
    const now = new Date('2026-06-06T00:00:00.000Z');

    try {
      writeJson(sqliteReportPath, buildPassingSqliteReport('2026-06-05T23:00:00.000Z', windowsHost));
      writeJson(
        path.join(tempRoot, 'sqlite', 'foundation-sqlite-runtime-report-2026-06-05T22-30-00-000Z.json'),
        buildPassingSqliteReport('2026-06-05T22:30:00.000Z', windowsHost)
      );
      writeJson(annReportPath, buildPassingAnnReport('2026-06-05T22:00:00.000Z', windowsHost));
      writeJson(
        path.join(tempRoot, 'ann', 'foundation-ann-runtime-report-2026-06-05T21-30-00-000Z.json'),
        buildPassingAnnReport('2026-06-05T21:30:00.000Z', windowsHost)
      );

      const result = verifier.verifyFoundationReleaseEvidence({ artifactRoot: tempRoot,
        sqliteReportPath,
        annReportPath,
        now,
        maxAgeHours: 24,
        minReportCount: 2,
        minHostCount: 2,
      });

      expect(result.ok).toBe(false);
      expect(result.errors.join('\n')).toContain('sqlite release evidence history covers 1 host(s), expected at least 2');
      expect(result.errors.join('\n')).toContain('ann release evidence history covers 1 host(s), expected at least 2');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('rejects strict repeated evidence when only latest reports exist', () => {
    const verifier = require(scriptPath) as FoundationReleaseEvidenceModule;
    const tempRoot = createTempReportRoot();
    const sqliteReportPath = path.join(tempRoot, 'sqlite', 'foundation-sqlite-runtime-report-latest.json');
    const annReportPath = path.join(tempRoot, 'ann', 'foundation-ann-runtime-report-latest.json');
    const now = new Date('2026-06-06T00:00:00.000Z');

    try {
      writeJson(sqliteReportPath, buildPassingSqliteReport('2026-06-05T23:00:00.000Z'));
      writeJson(annReportPath, buildPassingAnnReport('2026-06-05T22:00:00.000Z'));

      const result = verifier.verifyFoundationReleaseEvidence({ artifactRoot: tempRoot,
        sqliteReportPath,
        annReportPath,
        now,
        maxAgeHours: 24,
        minReportCount: 2,
      });

      expect(result.ok).toBe(false);
      expect(result.errors.join('\n')).toContain('sqlite release evidence history has 1 report(s), expected at least 2');
      expect(result.errors.join('\n')).toContain('ann release evidence history has 1 report(s), expected at least 2');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('does not fail default freshness verification because older non-release history reports exist', () => {
    const verifier = require(scriptPath) as FoundationReleaseEvidenceModule;
    const tempRoot = createTempReportRoot();
    const sqliteReportPath = path.join(tempRoot, 'sqlite', 'foundation-sqlite-runtime-report-latest.json');
    const annReportPath = path.join(tempRoot, 'ann', 'foundation-ann-runtime-report-latest.json');
    const now = new Date('2026-06-06T00:00:00.000Z');

    try {
      writeJson(sqliteReportPath, buildPassingSqliteReport('2026-06-05T23:00:00.000Z'));
      writeJson(
        path.join(tempRoot, 'sqlite', 'foundation-sqlite-runtime-report-2026-05-30T00-00-00-000Z.json'),
        buildPassingSqliteReport('2026-05-30T00:00:00.000Z')
      );
      writeJson(annReportPath, buildPassingAnnReport('2026-06-05T22:00:00.000Z'));
      writeJson(
        path.join(tempRoot, 'ann', 'foundation-ann-runtime-report-2026-06-05T21-00-00-000Z.json'),
        buildNonReleaseAnnReport('2026-06-05T21:00:00.000Z')
      );

      const result = verifier.verifyFoundationReleaseEvidence({ artifactRoot: tempRoot,
        sqliteReportPath,
        annReportPath,
        now,
        maxAgeHours: 24,
      });

      expect(result.ok).toBe(true);
      expect(result.summary.sqlite).toMatchObject({
        minimumReportCount: 1,
        reportCount: 1,
      });
      expect(result.summary.ann).toMatchObject({
        minimumReportCount: 1,
        reportCount: 1,
      });
      expect(result.warnings.join('\n')).toContain('ann release evidence history report ignored');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
