import * as fs from 'fs';
import * as path from 'path';

type VerifyEvidenceResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  summary: Record<string, unknown>;
};

type VerifyEvidenceModule = {
  verifyEvidence: (options?: {
    evidenceRoot?: string;
    now?: Date;
    maxAgeDays?: number;
    requireManualChecklist?: boolean;
  }) => VerifyEvidenceResult;
};

function writeFile(targetPath: string, content: string): void {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf8');
}

function writeBinaryFile(targetPath: string, content: Buffer): void {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content);
}

describe('capacitor evidence verifier contracts', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const verifierPath = path.join(repoRoot, 'scripts', 'verify-capacitor-evidence-freshness.js');
  const verifier = require(verifierPath) as VerifyEvidenceModule;
  let fixtureRoot: string;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(path.join(repoRoot, '.tmp-evidence-contract-'));
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  function createEvidenceFixture(options: {
    generatedAt: string;
    includeLatestPointer?: boolean;
    checklistOverrides?: Record<string, boolean>;
  }): { evidenceRoot: string } {
    const runId = '20260311-120000-AB__CD';
    const evidenceRoot = path.join(fixtureRoot, 'mobile-evidence');
    const runDir = path.join(evidenceRoot, runId);
    const screenshotPath = path.join(runDir, 'device-screenshot.png');
    const logcatPath = path.join(runDir, 'logcat-tail.txt');
    const reportPath = path.join(runDir, 'acceptance_evidence.md');
    const apkPath = path.join(runDir, 'app-debug.apk');
    const manifestPath = path.join(runDir, 'acceptance_evidence.json');

    writeBinaryFile(
      screenshotPath,
      Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+VwAAAABJRU5ErkJggg==', 'base64')
    );
    writeFile(logcatPath, '03-11 12:00:00.000 I NoteConnection: device accepted\n');
    writeFile(reportPath, '# acceptance evidence report\n');
    writeBinaryFile(apkPath, Buffer.from('apk-bytes'));

    const relative = (target: string) => path.relative(repoRoot, target).replace(/\\/g, '/');
    const checklist = {
      deviceConnectionGateExecuted: true,
      runtimeEvidenceArtifactsCollected: true,
      appStartupManuallyVerified: false,
      sourcePanelManuallyVerified: false,
      readerManuallyVerified: false,
      pathModeEnterExitManuallyVerified: false,
      ...(options.checklistOverrides || {}),
    };

    const manifest = {
      schemaVersion: 1,
      generatedAt: options.generatedAt,
      runId,
      apk: {
        relativePath: relative(apkPath),
      },
      artifacts: {
        screenshot: {
          relativePath: relative(screenshotPath),
        },
        logcat: {
          relativePath: relative(logcatPath),
        },
        markdownReport: {
          relativePath: relative(reportPath),
        },
      },
      checklist,
    };
    writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const includeLatestPointer = options.includeLatestPointer !== false;
    if (includeLatestPointer) {
      const latest = {
        schemaVersion: 1,
        generatedAt: options.generatedAt,
        runId,
        runDirRelative: relative(runDir),
        manifestRelative: relative(manifestPath),
      };
      writeFile(path.join(evidenceRoot, 'latest.json'), `${JSON.stringify(latest, null, 2)}\n`);
    }

    return { evidenceRoot };
  }

  test('accepts fresh evidence manifest when strict manual checklist is disabled', () => {
    const fixture = createEvidenceFixture({
      generatedAt: '2026-03-11T00:00:00.000Z',
      includeLatestPointer: true,
    });

    const result = verifier.verifyEvidence({
      evidenceRoot: fixture.evidenceRoot,
      now: new Date('2026-03-11T12:00:00.000Z'),
      maxAgeDays: 30,
      requireManualChecklist: false,
    });

    expect(result.ok).toBe(true);
    expect(result.warnings.join('\n')).toContain('Manual checklist pending');
  });

  test('fails when strict manual checklist is enabled and manual checks are not complete', () => {
    const fixture = createEvidenceFixture({
      generatedAt: '2026-03-11T00:00:00.000Z',
      includeLatestPointer: true,
    });

    const result = verifier.verifyEvidence({
      evidenceRoot: fixture.evidenceRoot,
      now: new Date('2026-03-11T12:00:00.000Z'),
      maxAgeDays: 30,
      requireManualChecklist: true,
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('Manual checklist item must be true');
  });

  test('fails stale evidence beyond allowed age and can resolve manifest by directory scan', () => {
    const fixture = createEvidenceFixture({
      generatedAt: '2026-01-01T00:00:00.000Z',
      includeLatestPointer: false,
      checklistOverrides: {
        appStartupManuallyVerified: true,
        sourcePanelManuallyVerified: true,
        readerManuallyVerified: true,
        pathModeEnterExitManuallyVerified: true,
      },
    });

    const result = verifier.verifyEvidence({
      evidenceRoot: fixture.evidenceRoot,
      now: new Date('2026-03-11T12:00:00.000Z'),
      maxAgeDays: 7,
      requireManualChecklist: true,
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('Evidence is stale');
    expect(String(result.summary.resolutionMode)).toBe('directory-scan');
  });
});

