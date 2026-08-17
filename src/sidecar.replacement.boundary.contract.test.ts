import * as fs from 'fs';
import * as path from 'path';

type PackageJson = {
  scripts?: Record<string, string>;
};

type TauriConfig = {
  build?: {
    frontendDist?: string;
  };
  bundle?: {
    externalBin?: string[];
  };
};

describe('sidecar replacement boundary contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const tauriConfigPath = path.join(repoRoot, 'src-tauri', 'tauri.conf.json');
  const tauriAndroidConfigPath = path.join(repoRoot, 'src-tauri', 'tauri.android.conf.json');
  const tauriLibPath = path.join(repoRoot, 'src-tauri', 'src', 'lib.rs');
  const sourceManagerPath = path.join(repoRoot, 'src', 'frontend', 'source_manager.js');
  const pathAppPath = path.join(repoRoot, 'src', 'frontend', 'path_app.js');
  const serverPath = path.join(repoRoot, 'src', 'server.ts');
  const pathBridgePath = path.join(repoRoot, 'src', 'core', 'PathBridge.ts');
  const buildSidecarPath = path.join(repoRoot, 'scripts', 'build-sidecar.js');
  const buildMarkdownWorkerPath = path.join(repoRoot, 'scripts', 'build-markdown-worker.js');
  const ensureSidecarReadyPath = path.join(repoRoot, 'scripts', 'ensure-sidecar-ready.js');
  const ensureGodotSidecarPath = path.join(repoRoot, 'scripts', 'ensure-godot-sidecar.js');
  const markdownGatewayPath = path.join(repoRoot, 'src', 'markdown', 'MarkdownGateway.ts');

  function readText(filePath: string): string {
    return fs.readFileSync(filePath, 'utf8');
  }

  function readJson<T>(filePath: string): T {
    return JSON.parse(readText(filePath)) as T;
  }

  test('keeps node sidecar on the desktop build and startup path', () => {
    const pkg = readJson<PackageJson>(packageJsonPath);
    const tauriConfig = readJson<TauriConfig>(tauriConfigPath);
    const tauriLib = readText(tauriLibPath);
    const sourceManager = readText(sourceManagerPath);

    expect(pkg.scripts?.['build:sidecar']).toContain('node scripts/build-sidecar.js');
    expect(pkg.scripts?.['tauri:build']).toContain('npm run build:sidecar');
    expect(pkg.scripts?.['tauri:dev']).toContain('npm run ensure:sidecar:dev');
    expect(tauriConfig.bundle?.externalBin || []).toContain('bin/server');
    expect(tauriLib).toContain('let mut sidecar_command = app.shell().sidecar("server").unwrap();');
    expect(tauriLib).toContain('Failed to spawn Node.js sidecar');
    expect(sourceManager).toContain('if (runtimeCaps.supports_sidecar) {');
    expect(sourceManager).toContain('const sidecarData = await fetchFoldersViaSidecar();');
  });

  test('keeps Godot bootstrap and spawn flow as part of the desktop contract', () => {
    const pkg = readJson<PackageJson>(packageJsonPath);
    const tauriConfig = readJson<TauriConfig>(tauriConfigPath);
    const tauriLib = readText(tauriLibPath);
    const ensureSidecarReady = readText(ensureSidecarReadyPath);
    const ensureGodotSidecar = readText(ensureGodotSidecarPath);

    expect(pkg.scripts?.['prepare:godot:bin']).toBe('node scripts/ensure-godot-sidecar.js');
    expect(tauriConfig.bundle?.externalBin || []).toContain('bin/godot');
    expect(ensureSidecarReady).toContain("runNpmScript('prepare:godot:bin')");
    expect(ensureGodotSidecar).toContain('prepareGodotSidecar');
    expect(ensureGodotSidecar).toContain('resolveGodotBootstrapContext');
    expect(tauriLib).toContain('match resolve_godot_executable(&project_root)');
    expect(tauriLib).toContain('let mut godot_command = std::process::Command::new(&godot_exe);');
    expect(tauriLib).toContain('Successfully spawned local Godot application.');
  });

  test('keeps markdown worker as a sidecar-era desktop dependency', () => {
    const tauriConfig = readJson<TauriConfig>(tauriConfigPath);
    const buildSidecar = readText(buildSidecarPath);
    const buildMarkdownWorker = readText(buildMarkdownWorkerPath);
    const markdownGateway = readText(markdownGatewayPath);
    const server = readText(serverPath);

    expect(tauriConfig.bundle?.externalBin || []).toContain('bin/markdown-worker');
    expect(buildSidecar).toContain('runMarkdownWorkerBuild(');
    expect(buildMarkdownWorker).toContain("outputName: 'markdown-worker-x86_64-pc-windows-msvc.exe'");
    expect(buildMarkdownWorker).toContain("outputName: 'markdown-worker-x86_64-unknown-linux-gnu'");
    expect(markdownGateway).toContain("return 'markdown-worker-x86_64-pc-windows-msvc.exe';");
    expect(markdownGateway).toContain("return 'markdown-worker-x86_64-unknown-linux-gnu';");
    expect(server).toContain("if (postPathname === '/api/markdown/resolve-node') {");
    expect(server).toContain("if (postPathname === '/api/markdown/resolve-wiki') {");
  });

  test('keeps PathBridge as the desktop Godot synchronization boundary', () => {
    const server = readText(serverPath);
    const pathBridge = readText(pathBridgePath);
    const sourceManager = readText(sourceManagerPath);
    const pathApp = readText(pathAppPath);

    expect(server).toContain("import { PathBridge } from './core/PathBridge';");
    expect(server).toContain('pathBridge = new PathBridge({');
    expect(server).toContain('PathBridge initialized on ws://');
    expect(pathBridge).toContain("console.log('[PathBridge] Godot requested path data');");
    expect(sourceManager).toContain('const bootstrapDesktopPathProducer = () => {');
    expect(sourceManager).toContain('window.pathApp.setupEarlyWebSocket({');
    expect(pathApp).toContain("window.NoteConnectionRuntime.getBridgeWsUrl('frontend')");
    expect(pathApp).toContain("this._sendBridgeMessage('identify', this._getBridgeIdentifyPayload('frontend'))");
  });

  test('keeps the default Android build sidecar-free and makes Godot opt-in', () => {
    const pkg = readJson<PackageJson>(packageJsonPath);
    const tauriAndroidConfig = readJson<TauriConfig>(tauriAndroidConfigPath);
    const tauriLib = readText(tauriLibPath);

    expect(pkg.scripts?.['tauri:android:dev']).toContain('npm run mobile:prepare:slim');
    expect(pkg.scripts?.['tauri:android:build']).toContain('npm run mobile:prepare:slim');
    expect(pkg.scripts?.['tauri:android:dev']).not.toContain('npm run build:sidecar');
    expect(pkg.scripts?.['tauri:android:build']).not.toContain('npm run build:sidecar');
    expect(tauriAndroidConfig.bundle?.externalBin || []).toEqual([]);
    expect(tauriAndroidConfig.build?.frontendDist).toBe('../dist/mobile-slim/frontend');
    expect(tauriLib).toContain('supports_sidecar: false');
    expect(tauriLib).toContain('supports_build: true');
    expect(tauriLib).toContain('Android startup: desktop sidecar and Godot launch are intentionally disabled.');
  });
});
