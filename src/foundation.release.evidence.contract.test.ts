import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

type PackageJson = {
  scripts?: Record<string, string>;
};

type FoundationReleaseEvidenceModule = {
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

  function readJson<T>(filePath: string): T {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T;
  }

  function createTempReportRoot(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-foundation-release-evidence-'));
  }

  function writeJson(filePath: string, value: unknown): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  }

  function buildPassingSqliteReport(verifiedAt: string): Record<string, unknown> {
    return {
      verifiedAt,
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

  function buildPassingAnnReport(verifiedAt: string): Record<string, unknown> {
    return {
      verifiedAt,
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

  test('keeps the release evidence verifier wired in package scripts and migration contracts', () => {
    const packageJson = readJson<PackageJson>(packageJsonPath);

    expect(packageJson.scripts?.['verify:foundation:release-evidence']).toBe(
      'node scripts/verify-foundation-release-evidence.js'
    );
    expect(packageJson.scripts?.['test:migration']).toContain('src/foundation.release.evidence.contract.test.ts');
  });

  test('verifier script validates latest sqlite soak and ANN release-gate reports with bounded freshness', () => {
    const source = fs.readFileSync(scriptPath, 'utf8');

    expect(source).toContain('foundation-sqlite-runtime-report-latest.json');
    expect(source).toContain('foundation-ann-runtime-report-latest.json');
    expect(source).toContain('foundation-release-evidence-report-latest.json');
    expect(source).toContain('NOTE_CONNECTION_FOUNDATION_RELEASE_EVIDENCE_MAX_AGE_HOURS');
    expect(source).toContain('verify:foundation:sqlite-runtime:release');
    expect(source).toContain('verify:foundation:ann-runtime:release');
    expect(source).toContain("suiteKind === 'soak'");
    expect(source).toContain("suiteKind === 'matrix'");
    expect(source).toContain('releaseGatesEnabled');
    expect(source).toContain('expectedRecall');
    expect(source).toContain('dist_node_runtime');
    expect(source).toContain('packaged_sidecar');
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

      const result = verifier.verifyFoundationReleaseEvidence({
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

      const result = verifier.verifyFoundationReleaseEvidence({
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
});
