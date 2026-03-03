import * as fs from 'fs';
import * as path from 'path';

describe('android native pathmode contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const patchScriptPath = path.join(repoRoot, 'scripts', 'apply-tauri-android-pathmode.js');
  const bridgeTemplatePath = path.join(repoRoot, 'src-tauri', 'mobile', 'android', 'PathmodeBridge.kt');
  const activityTemplatePath = path.join(repoRoot, 'src-tauri', 'mobile', 'android', 'PathmodeGodotActivity.kt');
  const tauriLibPath = path.join(repoRoot, 'src-tauri', 'src', 'lib.rs');

  test('contains Android patch script for manifest/gradle/template sync', () => {
    const patchScript = fs.readFileSync(patchScriptPath, 'utf8');
    expect(patchScript).toContain('PathmodeGodotActivity');
    expect(patchScript).toContain('org.godotengine:godot:$godotAndroidVersion');
    expect(patchScript).toContain('copyPathmodeAssets');
    expect(patchScript).toContain('PathmodeBridge.kt');
  });

  test('kotlin templates define bridge launch and fullscreen godot activity', () => {
    const bridgeTemplate = fs.readFileSync(bridgeTemplatePath, 'utf8');
    const activityTemplate = fs.readFileSync(activityTemplatePath, 'utf8');

    expect(bridgeTemplate).toContain('object PathmodeBridge');
    expect(bridgeTemplate).toContain('fun openPathmode(context: Context, payloadJson: String?)');

    expect(activityTemplate).toContain('class PathmodeGodotActivity : GodotActivity');
    expect(activityTemplate).toContain('override fun getCommandLine(): MutableList<String>');
    expect(activityTemplate).toContain('/android_asset/path_mode');
  });

  test('rust layer exposes android native pathmode command and bridge invocation', () => {
    const tauriLib = fs.readFileSync(tauriLibPath, 'utf8');
    expect(tauriLib).toContain('fn open_native_pathmode');
    expect(tauriLib).toContain('supports_native_pathmode');
    expect(tauriLib).toContain('PathmodeBridge');
    expect(tauriLib).toContain('openPathmode');
  });
});
