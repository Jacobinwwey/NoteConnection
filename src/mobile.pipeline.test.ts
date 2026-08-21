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
  const alignCapacitorJavaCompatScriptPath = path.join(repoRoot, 'scripts', 'align-capacitor-java-compat.js');
  const tauriAndroidRunnerPath = path.join(repoRoot, 'scripts', 'run-tauri-android.js');
  const tauriConfigPath = path.join(repoRoot, 'src-tauri', 'tauri.conf.json');
  const androidManifestPath = path.join(repoRoot, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
  const androidBuildGradlePath = path.join(repoRoot, 'android', 'app', 'build.gradle');
  const androidStringsPath = path.join(repoRoot, 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml');
  const androidMainActivityPath = path.join(
    repoRoot,
    'android',
    'app',
    'src',
    'main',
    'java',
    'com',
    'jacob',
    'noteconnection',
    'pro',
    'MainActivity.java'
  );
  const androidLegacyMainActivityPath = path.join(
    repoRoot,
    'android',
    'app',
    'src',
    'main',
    'java',
    'com',
    'example',
    'noteconnection',
    'MainActivity.java'
  );
  const verifyCapacitorDeviceScriptPath = path.join(repoRoot, 'scripts', 'verify-capacitor-device-acceptance.js');
  const captureCapacitorEvidenceScriptPath = path.join(repoRoot, 'scripts', 'capture-capacitor-device-evidence.js');
  const verifyCapacitorEvidenceFreshnessScriptPath = path.join(repoRoot, 'scripts', 'verify-capacitor-evidence-freshness.js');

  test('keeps Capacitor and Tauri Android npm scripts together', () => {
    const pkg = readJson<PackageJson>(packageJsonPath);
    const scripts = pkg.scripts || {};

    expect(scripts['verify:android:env']).toContain('verify-tauri-android-prereqs.js');
    expect(scripts['tauri:android:patch:pathmode']).toContain('apply-tauri-android-pathmode.js');
    expect(scripts['configure:tauri:android:signing']).toContain('configure-tauri-android-signing.js');
    expect(scripts['smoke:android:pathmode']).toContain('smoke-android-pathmode.js');
    expect(scripts['mobile:build:capacitor']).toBe('build_apk.bat');
    expect(scripts['capture:capacitor:evidence']).toContain('capture-capacitor-device-evidence.js');
    expect(scripts['verify:capacitor:evidence']).toContain('verify-capacitor-evidence-freshness.js');
    expect(scripts['tauri:android:init']).toContain('verify:android:env');
    expect(scripts['tauri:android:dev']).toContain('verify:android:env');
    expect(scripts['tauri:android:build']).toContain('verify:android:env');
    expect(scripts['tauri:android:init']).toContain('run-tauri-android.js init');
    expect(scripts['tauri:android:dev']).toContain('run-tauri-android.js dev');
    expect(scripts['tauri:android:build']).toContain('run-tauri-android.js build');
    expect(scripts['tauri:android:dev:universal']).toContain('NOTE_CONNECTION_TAURI_ANDROID_TARGET=universal');
    expect(scripts['tauri:android:build:universal']).toContain('NOTE_CONNECTION_TAURI_ANDROID_TARGET=universal');
    expect(scripts['mobile:build:tauri-android']).toBe('npm run tauri:android:build');
    expect(scripts['mobile:build:release']).toBe('npm run mobile:build:tauri-android');
    expect(scripts['mobile:build:release']).not.toContain('capacitor');
    expect(scripts['mobile:build:compatibility']).toBe('npm run mobile:build:both');
    expect(scripts['mobile:build:both']).toContain('mobile:build:capacitor');
    expect(scripts['mobile:build:both']).toContain('mobile:build:tauri-android');
    expect(scripts['verify:mobile:artifact']).toContain('verify-mobile-artifact.js');
    expect(scripts['verify:mobile:artifact:release']).toContain('--require-rss');
    expect(scripts['verify:mobile:artifact:release']).toContain('--require-arm64');
    expect(scripts['verify:mobile:artifact:release']).toContain('--require-signed');
    expect(scripts['capture:tauri:android:evidence']).toContain('capture-tauri-android-rss-evidence.js');
    expect(fs.existsSync(path.join(repoRoot, 'scripts', 'verify-mobile-artifact.js'))).toBe(true);
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
    expect(capacitorConfig).toContain("hostname: 'localhost'");
    expect(capacitorConfig).toContain('cleartext: true');
    expect(capacitorConfig).toContain("allowNavigation: ['localhost', '127.0.0.1']");

    const buildApkScript = fs.readFileSync(buildApkScriptPath, 'utf8');
    expect(buildApkScript).toContain('NOTE_CONNECTION_NO_PAUSE');
    expect(buildApkScript).toContain("dist\\mobile-slim\\frontend");
    expect(buildApkScript).toContain('npx cap sync android');
    expect(buildApkScript).toContain('align-capacitor-java-compat.js');
    expect(buildApkScript).toContain('requires JDK 21 or newer.');
    expect(buildApkScript).toContain('major version 21+');
    expect(buildApkScript).toContain('gradlew.bat assembleDebug');
  });

  test('aligns generated Capacitor compile options to active JDK with a Java 21+ floor', () => {
    const alignScript = fs.readFileSync(alignCapacitorJavaCompatScriptPath, 'utf8');
    expect(alignScript).toContain('MIN_SUPPORTED_JAVA_MAJOR = 21');
    expect(alignScript).toContain('Math.max(MIN_SUPPORTED_JAVA_MAJOR');
    expect(alignScript).toContain('JavaVersion.toVersion(');
    expect(alignScript).toContain('sourceCompatibility');
    expect(alignScript).toContain('targetCompatibility');
  });

  test('uses a non-example Android app id consistently across Capacitor and native Android config', () => {
    const appId = 'com.jacob.noteconnection.pro';
    const capacitorConfig = fs.readFileSync(capacitorConfigPath, 'utf8');
    const androidBuildGradle = fs.readFileSync(androidBuildGradlePath, 'utf8');
    const androidStrings = fs.readFileSync(androidStringsPath, 'utf8');
    const mainActivity = fs.readFileSync(androidMainActivityPath, 'utf8');

    expect(capacitorConfig).toContain(`appId: '${appId}'`);
    expect(capacitorConfig).not.toContain('com.example.noteconnection');
    expect(androidBuildGradle).toContain(`namespace = "${appId}"`);
    expect(androidBuildGradle).toContain(`applicationId "${appId}"`);
    expect(androidStrings).toContain(`<string name="package_name">${appId}</string>`);
    expect(androidStrings).toContain(`<string name="custom_url_scheme">${appId}</string>`);
    expect(mainActivity).toContain(`package ${appId};`);
    expect(fs.existsSync(androidLegacyMainActivityPath)).toBe(false);
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

  test('keeps capacitor device acceptance scripts aligned with shared ADB diagnostics', () => {
    const verifyScript = fs.readFileSync(verifyCapacitorDeviceScriptPath, 'utf8');
    const captureScript = fs.readFileSync(captureCapacitorEvidenceScriptPath, 'utf8');
    const verifyEvidenceScript = fs.readFileSync(verifyCapacitorEvidenceFreshnessScriptPath, 'utf8');

    expect(verifyScript).toContain("require('./capacitor-device-utils')");
    expect(verifyScript).toContain('NOTE_CONNECTION_ANDROID_SERIAL');
    expect(verifyScript).toContain('Device states:');

    expect(captureScript).toContain("require('./capacitor-device-utils')");
    expect(captureScript).toContain('NOTE_CONNECTION_ANDROID_SERIAL');
    expect(captureScript).toContain('Device states:');
    expect(captureScript).toContain('NOTE_CONNECTION_EVIDENCE_NODE_COUNT');
    expect(captureScript).toContain('NOTE_CONNECTION_EVIDENCE_EDGE_COUNT');
    expect(captureScript).toContain('acceptance_evidence.json');
    expect(captureScript).toContain('latest.json');

    expect(verifyEvidenceScript).toContain('NOTE_CONNECTION_EVIDENCE_MAX_AGE_DAYS');
    expect(verifyEvidenceScript).toContain('NOTE_CONNECTION_REQUIRE_MANUAL_MOBILE_CHECKLIST');
    expect(verifyEvidenceScript).toContain('NOTE_CONNECTION_REQUIRE_LARGE_GRAPH_EVIDENCE');
    expect(verifyEvidenceScript).toContain('NOTE_CONNECTION_MIN_EVIDENCE_NODE_COUNT');
    expect(verifyEvidenceScript).toContain('NOTE_CONNECTION_MIN_EVIDENCE_EDGE_COUNT');
    expect(verifyEvidenceScript).toContain('NOTE_CONNECTION_EVIDENCE_ROOT');
    expect(verifyEvidenceScript).toContain('acceptance_evidence.json');
    expect(verifyEvidenceScript).toContain('latest.json');
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
