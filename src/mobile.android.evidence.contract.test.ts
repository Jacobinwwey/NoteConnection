import * as fs from 'fs';
import * as path from 'path';

describe('Tauri Android device evidence contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const scriptPath = path.join(repoRoot, 'scripts', 'capture-tauri-android-rss-evidence.js');
  const releaseWorkflowPath = path.join(repoRoot, '.github', 'workflows', 'release-desktop-multi-os.yml');
  const script = require(scriptPath) as {
    requiredWorkloadSteps: string[];
    maskSerial: (serial: string) => string;
    parsePid: (output: string) => number;
    parseWorkloadSpec: (specPath: string) => {
      schemaVersion: number;
      requiredSteps: string[];
      steps: Array<{ name: string; adbArgs: string[] }>;
    };
    parseAbiList: (output: string) => string[];
    parseTotalRamBytes: (output: string) => number;
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

  test('requires measurable arm64 hardware budget inputs', () => {
    expect(script.parseAbiList('arm64-v8a, armeabi-v7a\n')).toEqual(['arm64-v8a', 'armeabi-v7a']);
    expect(script.parseAbiList('')).toEqual([]);
    expect(script.parseTotalRamBytes('MemTotal:       2097152 kB\n')).toBe(2097152 * 1024);
    expect(script.parseTotalRamBytes('MemTotal:       2097152 kB\r\n')).toBe(2097152 * 1024);
    expect(script.parseTotalRamBytes('')).toBe(0);
  });

  test('exposes signed artifact and RSS release gates in the package contract', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts?.['verify:mobile:artifact:release']).toContain('--require-signed');
    expect(packageJson.scripts?.['verify:mobile:artifact:release']).toContain('--require-arm64-only');
    expect(packageJson.scripts?.['capture:tauri:android:evidence']).toContain('capture-tauri-android-rss-evidence.js');
  });

  test('release workflow refuses unsigned Android uploads and verifies arm64 artifacts', () => {
    const workflow = fs.readFileSync(releaseWorkflowPath, 'utf8');

    expect(workflow).toContain('Materialize Android release signing key');
    expect(workflow).toContain('Build Android arm64 APK');
    expect(workflow).toContain('NOTE_CONNECTION_TAURI_ANDROID_TARGET=aarch64');
    expect(workflow).not.toContain('NOTE_CONNECTION_TAURI_ANDROID_TARGET=universal npm run tauri:android:build');
    expect(workflow).toContain('NOTE_CONNECTION_ANDROID_KEYSTORE_BASE64');
    expect(workflow).toContain('NOTE_CONNECTION_ANDROID_REQUIRE_SIGNING: "1"');
    expect(workflow).toContain('--require-arm64');
    expect(workflow).toContain('--require-arm64-only');
    expect(workflow).toContain('--require-signed');
    expect(workflow).toContain('verify-android-device-evidence');
    expect(workflow).toContain('self-hosted, android-arm64');
    expect(workflow).toContain('--require-rss');
    expect(workflow).toContain('publish-android-release-assets');
    expect(workflow).toContain('name: release-${{ needs.ensure-release.outputs.tag_name }}-android-evidence');
    expect(workflow).not.toContain('name: release-${{ github.event.inputs.tag }}-android-evidence');
    expect(workflow).toContain('noteconnection-arm64-release.apk');
    expect(workflow).toContain('noteconnection-arm64-release.aab');
    expect(workflow).toContain("! -name '*unsigned*'");
    expect(workflow).toContain('build/release/mobile/*');
    expect(workflow).not.toContain('src-tauri/gen/android/app/build/outputs/apk/**/*.apk');
    const androidBuildJob = workflow.split('  build-and-upload-android:')[1]
      .split('  verify-android-device-evidence:')[0];
    expect(androidBuildJob).not.toContain('softprops/action-gh-release@v2');
  });

  test('RSS harness keeps the release ABI contract strict', () => {
    const evidenceScript = fs.readFileSync(scriptPath, 'utf8');
    const verifierCalls = evidenceScript.match(/verifyMobileArtifact\(\{[\s\S]*?\}\);/g) || [];
    expect(verifierCalls.length).toBeGreaterThanOrEqual(2);
    verifierCalls.forEach((call) => {
      expect(call).toContain('requireArm64Only: true');
    });
  });
});
