import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

type FrontendRuntimeAssetVerifier = {
  verifyFrontendRuntimeAssets: (frontendDir: string) => void;
};

type FrontendAssetCopier = {
  cleanGeneratedFrontendBundleDirectories: (frontendDir: string) => void;
};

describe('frontend runtime asset verifier', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const verifierPath = path.join(repoRoot, 'scripts', 'verify-frontend-runtime-assets.js');
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'noteconnection-frontend-assets-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('rejects an index that references a missing legacy runtime script', () => {
    fs.writeFileSync(
      path.join(tempDir, 'index.html'),
      '<script src="markdown_runtime.js"></script><script src="workspace_panes.js"></script>',
      'utf8'
    );
    fs.writeFileSync(path.join(tempDir, 'markdown_runtime.js'), 'window.runtime = true;', 'utf8');
    const { verifyFrontendRuntimeAssets } = require(verifierPath) as FrontendRuntimeAssetVerifier;

    expect(() => verifyFrontendRuntimeAssets(tempDir)).toThrow(/workspace_panes\.js/);
  });

  test('accepts an index when every local runtime script is present', () => {
    fs.writeFileSync(
      path.join(tempDir, 'index.html'),
      '<script src="markdown_runtime.js"></script><script src="workspace_panes.js"></script><script src="https://example.invalid/remote.js"></script>',
      'utf8'
    );
    fs.writeFileSync(path.join(tempDir, 'markdown_runtime.js'), 'window.runtime = true;', 'utf8');
    fs.writeFileSync(path.join(tempDir, 'workspace_panes.js'), 'window.panes = true;', 'utf8');
    const { verifyFrontendRuntimeAssets } = require(verifierPath) as FrontendRuntimeAssetVerifier;

    expect(() => verifyFrontendRuntimeAssets(tempDir)).not.toThrow();
  });

  test('rejects an index that references a missing local stylesheet or module preload', () => {
    fs.writeFileSync(
      path.join(tempDir, 'index.html'),
      '<link rel="stylesheet" href="styles.css"><link rel="modulepreload" href="assets/main.js"><script src="workspace_panes.js"></script>',
      'utf8'
    );
    fs.writeFileSync(path.join(tempDir, 'workspace_panes.js'), 'window.panes = true;', 'utf8');
    const { verifyFrontendRuntimeAssets } = require(verifierPath) as FrontendRuntimeAssetVerifier;

    expect(() => verifyFrontendRuntimeAssets(tempDir)).toThrow(/styles\.css.*assets\/main\.js|assets\/main\.js.*styles\.css/);
  });

  test('cleans only stale Vite-owned bundle directories from the runtime destination', () => {
    const copierPath = path.join(repoRoot, 'scripts', 'copy-assets.js');
    fs.mkdirSync(path.join(tempDir, 'assets'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'vite-assets'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'assets', 'stale.js'), 'stale', 'utf8');
    fs.writeFileSync(path.join(tempDir, 'vite-assets', 'stale.js'), 'stale', 'utf8');
    fs.writeFileSync(path.join(tempDir, 'workspace_panes.js'), 'runtime', 'utf8');
    const { cleanGeneratedFrontendBundleDirectories } = require(copierPath) as FrontendAssetCopier;

    cleanGeneratedFrontendBundleDirectories(tempDir);

    expect(fs.existsSync(path.join(tempDir, 'assets'))).toBe(false);
    expect(fs.existsSync(path.join(tempDir, 'vite-assets'))).toBe(false);
    expect(fs.readFileSync(path.join(tempDir, 'workspace_panes.js'), 'utf8')).toBe('runtime');
  });
});
