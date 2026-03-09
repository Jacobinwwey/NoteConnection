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
  const tauriAndroidRunnerPath = path.join(repoRoot, 'scripts', 'run-tauri-android.js');
  const tauriConfigPath = path.join(repoRoot, 'src-tauri', 'tauri.conf.json');
  const androidManifestPath = path.join(repoRoot, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

  test('keeps Capacitor and Tauri Android npm scripts together', () => {
    const pkg = readJson<PackageJson>(packageJsonPath);
    const scripts = pkg.scripts || {};

    expect(scripts['verify:android:env']).toContain('verify-tauri-android-prereqs.js');
    expect(scripts['tauri:android:patch:pathmode']).toContain('apply-tauri-android-pathmode.js');
    expect(scripts['smoke:android:pathmode']).toContain('smoke-android-pathmode.js');
    expect(scripts['mobile:build:capacitor']).toBe('build_apk.bat');
    expect(scripts['capture:capacitor:evidence']).toContain('capture-capacitor-device-evidence.js');
    expect(scripts['tauri:android:init']).toContain('verify:android:env');
    expect(scripts['tauri:android:dev']).toContain('verify:android:env');
    expect(scripts['tauri:android:build']).toContain('verify:android:env');
    expect(scripts['tauri:android:init']).toContain('run-tauri-android.js init');
    expect(scripts['tauri:android:dev']).toContain('run-tauri-android.js dev');
    expect(scripts['tauri:android:build']).toContain('run-tauri-android.js build');
    expect(scripts['tauri:android:dev:universal']).toContain('NOTE_CONNECTION_TAURI_ANDROID_TARGET=universal');
    expect(scripts['tauri:android:build:universal']).toContain('NOTE_CONNECTION_TAURI_ANDROID_TARGET=universal');
    expect(scripts['mobile:build:tauri-android']).toBe('npm run tauri:android:build');
    expect(scripts['mobile:build:both']).toContain('mobile:build:capacitor');
    expect(scripts['mobile:build:both']).toContain('mobile:build:tauri-android');
  });

  test('defaults tauri android build/dev to arm64 target with override support', () => {
    const runnerScript = fs.readFileSync(tauriAndroidRunnerPath, 'utf8');
    expect(runnerScript).toContain("NOTE_CONNECTION_TAURI_ANDROID_TARGET");
    expect(runnerScript).toContain("return 'aarch64'");
    expect(runnerScript).toContain("['default', 'universal', 'all'].includes");
    expect(runnerScript).toContain('apply-tauri-android-pathmode.js');
  });

  test('uses dist/src/frontend as the authoritative mobile web asset directory', () => {
    const capacitorConfig = fs.readFileSync(capacitorConfigPath, 'utf8');
    expect(capacitorConfig).toContain("webDir: 'dist/src/frontend'");

    const buildApkScript = fs.readFileSync(buildApkScriptPath, 'utf8');
    expect(buildApkScript).toContain('NOTE_CONNECTION_NO_PAUSE');
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
    expect(deps['@capacitor/filesystem']).toBeDefined();
    expect(devDeps['@tauri-apps/cli']).toBeDefined();
  });

  test('declares Android storage permissions required by filesystem runtime paths', () => {
    const manifest = fs.readFileSync(androidManifestPath, 'utf8');
    expect(manifest).toContain('android.permission.INTERNET');
    expect(manifest).toContain('android.permission.READ_EXTERNAL_STORAGE');
    expect(manifest).toContain('android.permission.WRITE_EXTERNAL_STORAGE');
    expect(manifest).toContain('android.permission.READ_MEDIA_IMAGES');
    expect(manifest).toContain('android.permission.READ_MEDIA_VIDEO');
    expect(manifest).toContain('android.permission.READ_MEDIA_AUDIO');
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
