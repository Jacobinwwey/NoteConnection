import * as fs from 'fs';
import * as path from 'path';

type PackageJson = {
  scripts?: Record<string, string>;
};

type TauriConfig = {
  build?: {
    beforeBuildCommand?: string;
  };
};

type FrontendBuildWrapperModule = {
  resolveFrontendBuildCommand: (options?: {
    frontendBuildMode?: string;
  }) => string;
};

describe('tauri frontend build contracts', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const tauriConfigPath = path.join(repoRoot, 'src-tauri', 'tauri.conf.json');
  const wrapperScriptPath = path.join(repoRoot, 'scripts', 'run-tauri-frontend-build.js');
  const viteConfigPath = path.join(repoRoot, 'vite.config.ts');

  function readJson<T>(filePath: string): T {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  }

  test('tauri full build keeps explicit frontend full-mode through tauri beforeBuildCommand', () => {
    const packageJson = readJson<PackageJson>(packageJsonPath);
    const tauriConfig = readJson<TauriConfig>(tauriConfigPath);
    const scripts = packageJson.scripts || {};

    expect(tauriConfig.build?.beforeBuildCommand).toBe(
      'node scripts/run-tauri-frontend-build.js'
    );
    expect(scripts['tauri:build:full']).toContain(
      'node scripts/run-tauri-build.js --frontend-build-mode full'
    );
  });

  test('tauri frontend build wrapper defaults to runtime-first and supports explicit full mode', () => {
    const wrapper = require(wrapperScriptPath) as FrontendBuildWrapperModule;

    expect(wrapper.resolveFrontendBuildCommand()).toBe('npm run build');
    expect(
      wrapper.resolveFrontendBuildCommand({ frontendBuildMode: 'runtime-first' })
    ).toBe('npm run build');
    expect(
      wrapper.resolveFrontendBuildCommand({ frontendBuildMode: 'full' })
    ).toBe('npm run build:full');
    expect(() =>
      wrapper.resolveFrontendBuildCommand({ frontendBuildMode: 'legacy-full' })
    ).toThrow(/Unsupported tauri frontend build mode/i);
  });

  test('keeps Vite verification output separate from the Tauri runtime frontend directory', () => {
    const viteConfig = fs.readFileSync(viteConfigPath, 'utf8');

    expect(viteConfig).toContain("const viteVerificationDir = resolve(__dirname, 'dist', 'vite-verify')");
    expect(viteConfig).toContain('outDir: viteVerificationDir');
    expect(viteConfig).toContain('emptyOutDir: true');
    expect(viteConfig).not.toContain('emptyOutDir: false');
  });
});
