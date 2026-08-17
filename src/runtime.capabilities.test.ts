import * as fs from 'fs';
import * as path from 'path';

describe('runtime capability gating contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const sourceManagerPath = path.join(repoRoot, 'src', 'frontend', 'source_manager.js');
  const storageProviderPath = path.join(repoRoot, 'src', 'frontend', 'storage_provider.js');
  const appPath = path.join(repoRoot, 'src', 'frontend', 'app.js');
  const readerPath = path.join(repoRoot, 'src', 'frontend', 'reader.js');
  const tauriLibPath = path.join(repoRoot, 'src-tauri', 'src', 'lib.rs');

  test('source manager resolves capabilities via tauri command and exposes them globally', () => {
    const sourceManager = fs.readFileSync(sourceManagerPath, 'utf8');
    const storageProvider = fs.readFileSync(storageProviderPath, 'utf8');
    expect(sourceManager).toContain("invoke('get_runtime_capabilities')");
    expect(storageProvider).toContain("this._invoke('get_available_targets')");
    expect(sourceManager).toContain('provider.listAvailableTargets()');
    expect(sourceManager).toContain('window.__NC_RUNTIME_CAPS');
    expect(sourceManager).toContain('supports_sidecar');
    expect(sourceManager).toContain('supports_build');
    expect(sourceManager).toContain('supports_kb_runtime_change');
    expect(sourceManager).toContain('supports_native_pathmode');
    expect(sourceManager).toContain('supports_mobile_wasm_compute');
    expect(sourceManager).toContain('mobile_wasm_reason');
    expect(sourceManager).toContain('detectMobileWasmCapability');
  });

  test('source manager blocks build path when runtime does not support build', () => {
    const sourceManager = fs.readFileSync(sourceManagerPath, 'utf8');
    expect(sourceManager).toContain('if (!runtimeCaps.supports_build)');
    expect(sourceManager).toContain("alert(t('source.error.buildUnsupportedMobile'))");
  });

  test('source manager uses tauri native build command when sidecar is unavailable', () => {
    const sourceManager = fs.readFileSync(sourceManagerPath, 'utf8');
    const storageProvider = fs.readFileSync(storageProviderPath, 'utf8');
    expect(sourceManager).toContain('window.NoteConnectionStorage.createProvider({ runtimeCaps })');
    expect(storageProvider).toContain("invoke('build_graph_runtime'");
    expect(storageProvider).toContain('if (this._supportsSidecar()) {');
    expect(sourceManager).toContain('Using mobile native build engine');
  });

  test('reader supports tauri content command fallback and runtime fallback messaging', () => {
    const reader = fs.readFileSync(readerPath, 'utf8');
    expect(reader).toContain("invoke('read_node_content'");
    expect(reader).toContain('supports_content_api');
    expect(reader).toContain("window.i18n.t('source.error.contentUnavailableMobile')");
  });

  test('rust runtime capabilities command is registered and keeps Godot Pathmode opt-in', () => {
    const tauriLib = fs.readFileSync(tauriLibPath, 'utf8');
    expect(tauriLib).toContain('fn get_runtime_capabilities()');
    expect(tauriLib).toContain('get_runtime_capabilities,');
    expect(tauriLib).toContain('choose_kb_path,');
    expect(tauriLib).toContain('reset_kb_path,');
    expect(tauriLib).toContain('open_native_pathmode,');
    expect(tauriLib).toContain('build_graph_runtime,');
    expect(tauriLib).toContain('supports_sidecar: false');
    expect(tauriLib).toContain('supports_build: true');
    expect(tauriLib).toContain('supports_content_api: true');
    expect(tauriLib).toContain('supports_native_pathmode: option_env!("NOTE_CONNECTION_ANDROID_INCLUDE_GODOT_PATHMODE")');
    expect(tauriLib).toContain('read_node_content');
  });

  test('path mode entry prefers native android activity when capability is enabled', () => {
    const appJs = fs.readFileSync(appPath, 'utf8');
    expect(appJs).toContain("invoke('open_native_pathmode'");
    expect(appJs).toContain("caps.platform === 'android'");
    expect(appJs).toContain('caps.supports_native_pathmode === true');
  });
});
