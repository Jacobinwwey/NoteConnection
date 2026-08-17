import * as fs from 'fs';
import * as path from 'path';

describe('Tauri Android device evidence contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const scriptPath = path.join(repoRoot, 'scripts', 'capture-tauri-android-rss-evidence.js');
  const script = require(scriptPath) as {
    requiredWorkloadSteps: string[];
    maskSerial: (serial: string) => string;
    parsePid: (output: string) => number;
    parseWorkloadSpec: (specPath: string) => {
      schemaVersion: number;
      requiredSteps: string[];
      steps: Array<{ name: string; adbArgs: string[] }>;
    };
  };
  let fixtureRoot: string;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(path.join(repoRoot, '.tmp-tauri-android-evidence-'));
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  test('requires an ordered native workload with restart continuity', () => {
    const specPath = path.join(fixtureRoot, 'workload.json');
    fs.writeFileSync(specPath, JSON.stringify({
      schemaVersion: 1,
      steps: script.requiredWorkloadSteps.map((name) => ({
        name,
        adbArgs: ['shell', 'echo', name],
      })),
    }), 'utf8');

    const parsed = script.parseWorkloadSpec(specPath);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.requiredSteps).toEqual(['saf-import', 'graph-build', 'exact-query', 'path', 'continuity']);
    expect(parsed.steps.map((step) => step.name)).toEqual(parsed.requiredSteps);
  });

  test('fails closed when a required workload phase is absent or reordered', () => {
    const missingPath = path.join(fixtureRoot, 'missing.json');
    fs.writeFileSync(missingPath, JSON.stringify({
      schemaVersion: 1,
      steps: script.requiredWorkloadSteps.slice(0, 4).map((name) => ({
        name,
        adbArgs: ['shell', 'echo', name],
      })),
    }), 'utf8');
    expect(() => script.parseWorkloadSpec(missingPath)).toThrow(/missing required steps.*continuity/i);

    const reorderedPath = path.join(fixtureRoot, 'reordered.json');
    fs.writeFileSync(reorderedPath, JSON.stringify({
      schemaVersion: 1,
      steps: [...script.requiredWorkloadSteps].reverse().map((name) => ({
        name,
        adbArgs: ['shell', 'echo', name],
      })),
    }), 'utf8');
    expect(() => script.parseWorkloadSpec(reorderedPath)).toThrow(/must be ordered/i);

    const extraPath = path.join(fixtureRoot, 'extra.json');
    fs.writeFileSync(extraPath, JSON.stringify({
      schemaVersion: 1,
      steps: [
        ...script.requiredWorkloadSteps.map((name) => ({ name, adbArgs: ['shell', 'echo', name] })),
        { name: 'unrecorded-helper', adbArgs: ['shell', 'echo', 'ignored'] },
      ],
    }), 'utf8');
    expect(() => script.parseWorkloadSpec(extraPath)).toThrow(/unsupported steps/i);
  });

  test('keeps device identity private and parses proc pid output deterministically', () => {
    expect(script.maskSerial('R58M123456789')).toBe('R5***89');
    expect(script.maskSerial('1234')).toBe('1234');
    expect(script.parsePid('12345\n')).toBe(12345);
    expect(script.parsePid('')).toBe(0);
  });

  test('exposes signed artifact and RSS release gates in the package contract', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts?.['verify:mobile:artifact:release']).toContain('--require-signed');
    expect(packageJson.scripts?.['capture:tauri:android:evidence']).toContain('capture-tauri-android-rss-evidence.js');
  });
});
