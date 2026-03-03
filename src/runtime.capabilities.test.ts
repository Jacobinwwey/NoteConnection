import * as fs from 'fs';
import * as path from 'path';

describe('runtime capability gating contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const sourceManagerPath = path.join(repoRoot, 'src', 'frontend', 'source_manager.js');
  const readerPath = path.join(repoRoot, 'src', 'frontend', 'reader.js');
  const tauriLibPath = path.join(repoRoot, 'src-tauri', 'src', 'lib.rs');

  test('source manager resolves capabilities via tauri command and exposes them globally', () => {
    const sourceManager = fs.readFileSync(sourceManagerPath, 'utf8');
    expect(sourceManager).toContain("invoke('get_runtime_capabilities')");
    expect(sourceManager).toContain("invoke('get_available_targets')");
    expect(sourceManager).toContain('window.__NC_RUNTIME_CAPS');
    expect(sourceManager).toContain('supports_sidecar');
    expect(sourceManager).toContain('supports_build');
  });

  test('source manager blocks build path when runtime does not support build', () => {
    const sourceManager = fs.readFileSync(sourceManagerPath, 'utf8');
    expect(sourceManager).toContain('if (!runtimeCaps.supports_build)');
    expect(sourceManager).toContain("alert(t('source.error.buildUnsupportedMobile'))");
  });

  test('reader supports tauri content command fallback and runtime fallback messaging', () => {
    const reader = fs.readFileSync(readerPath, 'utf8');
    expect(reader).toContain("invoke('read_node_content'");
    expect(reader).toContain('supports_content_api');
    expect(reader).toContain("window.i18n.t('source.error.contentUnavailableMobile')");
  });

  test('rust runtime capabilities command is registered and has android-safe defaults', () => {
    const tauriLib = fs.readFileSync(tauriLibPath, 'utf8');
    expect(tauriLib).toContain('fn get_runtime_capabilities()');
    expect(tauriLib).toContain('get_runtime_capabilities,');
    expect(tauriLib).toContain('supports_sidecar: false');
    expect(tauriLib).toContain('supports_build: false');
    expect(tauriLib).toContain('supports_content_api: true');
    expect(tauriLib).toContain('read_node_content');
  });
});
