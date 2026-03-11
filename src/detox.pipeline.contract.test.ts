import * as fs from 'fs';
import * as path from 'path';

type PackageJson = {
  scripts?: Record<string, string>;
};

type DetoxConfig = {
  testRunner?: {
    args?: Record<string, string>;
  };
  apps?: Record<string, { binaryPath?: string; build?: string }>;
  devices?: Record<string, unknown>;
  configurations?: Record<string, { app?: string; device?: string }>;
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

describe('detox mobile e2e pipeline contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const detoxConfigPath = path.join(repoRoot, '.detoxrc.json');
  const detoxVerifyScriptPath = path.join(repoRoot, 'scripts', 'verify-detox-pipeline.js');
  const detoxRunnerScriptPath = path.join(repoRoot, 'scripts', 'run-detox-e2e.js');
  const e2eJestConfigPath = path.join(repoRoot, 'e2e', 'jest.config.js');
  const e2eInitPath = path.join(repoRoot, 'e2e', 'init.js');
  const e2eSmokePath = path.join(repoRoot, 'e2e', 'smoke.e2e.js');

  test('ships detox configuration and e2e bootstrap files', () => {
    expect(fs.existsSync(detoxConfigPath)).toBe(true);
    expect(fs.existsSync(e2eJestConfigPath)).toBe(true);
    expect(fs.existsSync(e2eInitPath)).toBe(true);
    expect(fs.existsSync(e2eSmokePath)).toBe(true);
    expect(fs.existsSync(detoxVerifyScriptPath)).toBe(true);
    expect(fs.existsSync(detoxRunnerScriptPath)).toBe(true);
  });

  test('keeps android emulator debug configuration wired for capacitor APK builds', () => {
    const detoxConfig = readJson<DetoxConfig>(detoxConfigPath);
    const androidDebugApp = detoxConfig.apps?.['android.debug'];
    const androidEmuConfig = detoxConfig.configurations?.['android.emu.debug'];

    expect(detoxConfig.testRunner?.args?.config).toBe('e2e/jest.config.js');
    expect(androidDebugApp).toBeDefined();
    expect(androidDebugApp?.binaryPath).toBe('android/app/build/outputs/apk/debug/app-debug.apk');
    expect(androidDebugApp?.build).toContain('mobile:build:capacitor');
    expect(detoxConfig.devices?.['android.emulator']).toBeDefined();
    expect(androidEmuConfig?.app).toBe('android.debug');
    expect(androidEmuConfig?.device).toBe('android.emulator');
  });

  test('exposes detox verification and execution npm scripts', () => {
    const pkg = readJson<PackageJson>(packageJsonPath);
    const scripts = pkg.scripts || {};

    expect(scripts['verify:detox:pipeline']).toBe('node scripts/verify-detox-pipeline.js');
    expect(scripts['test:e2e:detox']).toBe('node scripts/run-detox-e2e.js');
    expect(scripts['test:e2e:detox:run']).toBe('node scripts/run-detox-e2e.js --run');
    expect(scripts['test:mobile:contracts']).toContain('src/detox.pipeline.contract.test.ts');
  });
});
