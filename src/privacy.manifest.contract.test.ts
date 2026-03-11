import * as fs from 'fs';
import * as path from 'path';

type PackageJson = {
  scripts?: Record<string, string>;
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

describe('privacy manifest compliance contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const verifyScriptPath = path.join(repoRoot, 'scripts', 'verify-privacy-manifest.js');
  const manifestPath = path.join(repoRoot, 'ios', 'App', 'PrivacyInfo.xcprivacy');

  test('provisions PrivacyInfo.xcprivacy baseline with required API reasons', () => {
    expect(fs.existsSync(manifestPath)).toBe(true);
    const xml = fs.readFileSync(manifestPath, 'utf8');

    expect(xml).toContain('<key>NSPrivacyTracking</key>');
    expect(xml).toContain('<key>NSPrivacyCollectedDataTypes</key>');
    expect(xml).toContain('<key>NSPrivacyAccessedAPITypes</key>');
    expect(xml).toContain('NSPrivacyAccessedAPICategoryFileTimestamp');
    expect(xml).toContain('C617.1');
    expect(xml).toContain('NSPrivacyAccessedAPICategoryDiskSpace');
    expect(xml).toContain('E174.1');
  });

  test('ships privacy manifest verifier and npm integration', () => {
    expect(fs.existsSync(verifyScriptPath)).toBe(true);
    const verifyScript = fs.readFileSync(verifyScriptPath, 'utf8');
    expect(verifyScript).toContain('verifyPrivacyManifest');
    expect(verifyScript).toContain('NSPrivacyAccessedAPICategoryFileTimestamp');
    expect(verifyScript).toContain('NSPrivacyAccessedAPICategoryDiskSpace');

    const pkg = readJson<PackageJson>(packageJsonPath);
    const scripts = pkg.scripts || {};
    expect(scripts['verify:privacy:manifest']).toBe('node scripts/verify-privacy-manifest.js');
    expect(scripts['test:mobile:contracts']).toContain('src/privacy.manifest.contract.test.ts');
  });
});
