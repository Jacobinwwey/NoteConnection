import * as fs from 'fs';
import * as path from 'path';

type PackageJson = {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

describe('dual mobile pipeline configuration', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const capacitorConfigPath = path.join(repoRoot, 'capacitor.config.ts');
  const buildApkScriptPath = path.join(repoRoot, 'build_apk.bat');
  const tauriConfigPath = path.join(repoRoot, 'src-tauri', 'tauri.conf.json');

  test('keeps Capacitor and Tauri Android npm scripts together', () => {
    const pkg = readJson<PackageJson>(packageJsonPath);
    const scripts = pkg.scripts || {};

    expect(scripts['mobile:build:capacitor']).toBe('build_apk.bat');
    expect(scripts['tauri:android:init']).toContain('tauri android init');
    expect(scripts['tauri:android:dev']).toContain('tauri android dev');
    expect(scripts['tauri:android:build']).toContain('tauri android build');
    expect(scripts['mobile:build:tauri-android']).toBe('npm run tauri:android:build');
    expect(scripts['mobile:build:both']).toContain('mobile:build:capacitor');
    expect(scripts['mobile:build:both']).toContain('mobile:build:tauri-android');
  });

  test('uses dist/src/frontend as the authoritative mobile web asset directory', () => {
    const capacitorConfig = fs.readFileSync(capacitorConfigPath, 'utf8');
    expect(capacitorConfig).toContain("webDir: 'dist/src/frontend'");

    const buildApkScript = fs.readFileSync(buildApkScriptPath, 'utf8');
    expect(buildApkScript).toContain("dist\\src\\frontend");
    expect(buildApkScript).toContain('npx cap sync');
    expect(buildApkScript).toContain('gradlew.bat assembleDebug');
  });

  test('retains required dependencies for both mobile pipelines', () => {
    const pkg = readJson<PackageJson>(packageJsonPath);
    const deps = pkg.dependencies || {};
    const devDeps = pkg.devDependencies || {};

    expect(deps['@capacitor/core']).toBeDefined();
    expect(deps['@capacitor/android']).toBeDefined();
    expect(deps['@capacitor/cli']).toBeDefined();
    expect(devDeps['@tauri-apps/cli']).toBeDefined();
  });

  test('keeps both server and godot sidecars registered for tauri bundles', () => {
    const tauriConfig = readJson<{
      bundle?: { externalBin?: string[] };
    }>(tauriConfigPath);

    const externalBins = tauriConfig.bundle?.externalBin || [];
    expect(externalBins).toContain('bin/server');
    expect(externalBins).toContain('bin/godot');
  });
});
