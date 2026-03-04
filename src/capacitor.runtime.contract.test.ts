import * as fs from 'fs';
import * as path from 'path';

describe('capacitor runtime parity closure contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const sourceManagerPath = path.join(repoRoot, 'src', 'frontend', 'source_manager.js');
  const readerPath = path.join(repoRoot, 'src', 'frontend', 'reader.js');
  const enLocalePath = path.join(repoRoot, 'src', 'frontend', 'locales', 'en.json');
  const zhLocalePath = path.join(repoRoot, 'src', 'frontend', 'locales', 'zh.json');

  test('detects native Capacitor runtime and applies read-only capability profile', () => {
    const source = fs.readFileSync(sourceManagerPath, 'utf8');
    expect(source).toContain('resolveCapacitorPlatform');
    expect(source).toContain("platform: `capacitor-${capacitorPlatform}`");
    expect(source).toContain('supports_sidecar: false');
    expect(source).toContain('supports_build: false');
    expect(source).toContain('supports_content_api: false');
    expect(source).toContain('supports_kb_runtime_change: false');
  });

  test('uses deterministic source panel fallback for capacitor read-only mode', () => {
    const source = fs.readFileSync(sourceManagerPath, 'utf8');
    expect(source).toContain("kbPath = t('source.capacitor.bundlePath')");
    expect(source).toContain("packagedOption.value = 'PACKAGED_GRAPH'");
    expect(source).toContain("packagedOption.textContent = t('source.capacitor.packagedGraph')");
    expect(source).toContain("alert(t('source.error.capacitorReadOnly'))");
  });

  test('reader enforces capacitor read-only content strategy without sidecar APIs', () => {
    const source = fs.readFileSync(readerPath, 'utf8');
    expect(source).toContain('window.Capacitor.getPlatform');
    expect(source).toContain('runtimeSupportsContentApi');
    expect(source).toContain("window.i18n.t('source.error.contentUnavailableMobile')");
  });

  test('ships i18n messages for capacitor read-only runtime boundary', () => {
    const en = fs.readFileSync(enLocalePath, 'utf8');
    const zh = fs.readFileSync(zhLocalePath, 'utf8');
    expect(en).toContain('"capacitorReadOnly"');
    expect(en).toContain('"packagedGraph"');
    expect(zh).toContain('"capacitorReadOnly"');
    expect(zh).toContain('"packagedGraph"');
  });
});
