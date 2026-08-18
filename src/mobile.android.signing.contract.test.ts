import * as path from 'path';
import * as fs from 'fs';

describe('Tauri Android signing configuration contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const signingScriptPath = path.join(repoRoot, 'scripts', 'configure-tauri-android-signing.js');
  const runnerScriptPath = path.join(repoRoot, 'scripts', 'run-tauri-android.js');
  const signing = require(signingScriptPath) as {
    addSigningConfig: (source: string) => string;
    removeExistingBlock: (source: string) => string;
    renderSigningBlock: () => string;
  };

  test('keeps signing opt-in and injects the config inside the Android DSL', () => {
    const source = `plugins { id("com.android.application") }\n\nandroid {\n    defaultConfig {\n        applicationId = "com.example"\n    }\n    buildTypes {\n        getByName("release") {\n            isMinifyEnabled = true\n        }\n    }\n}`;
    const configured = signing.addSigningConfig(source);

    expect(configured.indexOf('// NOTE_CONNECTION_ANDROID_SIGNING_START')).toBeGreaterThan(
      configured.indexOf('android {')
    );
    expect(configured).toContain('signingConfigs.create("noteConnectionRelease")');
    expect(configured).toContain('signingConfig = noteConnectionReleaseSigningConfig');
    expect(configured).toContain('NOTE_CONNECTION_ANDROID_KEYSTORE_PASSWORD');
    expect(configured).toContain('applicationId = "com.example"');
  });

  test('removes a stale generated signing block without touching unrelated Gradle code', () => {
    const source = `android {\n${signing.renderSigningBlock()}\n    defaultConfig {\n        applicationId = "com.example"\n    }\n}`;
    const cleaned = signing.removeExistingBlock(source);

    expect(cleaned).not.toContain('NOTE_CONNECTION_ANDROID_SIGNING_START');
    expect(cleaned).toContain('applicationId = "com.example"');
  });

  test('does not embed secret values and runner invokes the signer around generated builds', () => {
    const runner = fs.readFileSync(runnerScriptPath, 'utf8');
    const block = signing.renderSigningBlock();

    expect(block).toContain('System.getenv');
    expect(block).not.toContain('password123');
    expect(runner).toContain('configure-tauri-android-signing.js');
    expect(runner).toContain('Failed to synchronize Android release signing configuration');
  });
});
