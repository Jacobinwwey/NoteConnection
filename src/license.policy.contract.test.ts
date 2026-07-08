import * as fs from 'fs';
import * as path from 'path';

type PackageJson = {
  license?: string;
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

describe('license policy contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const tauriCargoTomlPath = path.join(repoRoot, 'src-tauri', 'Cargo.toml');
  const licensePath = path.join(repoRoot, 'LICENSE');
  const readmePath = path.join(repoRoot, 'README.md');
  const chineseReadmePath = path.join(repoRoot, 'README_zh.md');

  test('root package manifest is pinned to GPL-3.0-only', () => {
    const pkg = readJson<PackageJson>(packageJsonPath);
    expect(pkg.license).toBe('GPL-3.0-only');
  });

  test('tauri crate manifest is pinned to GPL-3.0-only', () => {
    const cargoToml = fs.readFileSync(tauriCargoTomlPath, 'utf8');
    expect(cargoToml).toContain('license = "GPL-3.0-only"');
  });

  test('repository license artifact ships GNU GPL v3 text', () => {
    const license = fs.readFileSync(licensePath, 'utf8');
    expect(license).toContain('GNU GENERAL PUBLIC LICENSE');
    expect(license).toContain('Version 3, 29 June 2007');
  });

  test('README license sections advertise GPL-3.0-only in both locales', () => {
    const readme = fs.readFileSync(readmePath, 'utf8');
    const chineseReadme = fs.readFileSync(chineseReadmePath, 'utf8');
    expect(readme).toContain('## License');
    expect(readme).toContain('GNU General Public License v3.0');
    expect(readme).toContain('GPL-3.0-only');
    expect(chineseReadme).toContain('## 开源许可');
    expect(chineseReadme).toContain('GNU General Public License v3.0');
    expect(chineseReadme).toContain('GPL-3.0-only');
  });
});
