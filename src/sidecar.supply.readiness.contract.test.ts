import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

type PackageJson = {
  scripts?: Record<string, string>;
};

type SupplyReadinessResult = {
  offlineBootstrapReady: boolean;
  rating: 'offline-ready' | 'partial-local' | 'network-dependent';
  artifacts: {
    server: { ready: boolean };
    markdownWorker: { ready: boolean };
    godot: {
      ready: boolean;
      networkRequiredForBootstrap: boolean;
      downloadConfigured: boolean;
      pinnedDownload: boolean;
      sourceKindsAvailable: string[];
    };
  };
  ci: {
    releaseWorkflowMirrorFirstDownload: boolean;
    releaseWorkflowDirectUpstreamDownload: boolean;
    releaseWorkflowArchiveDigestPinned: boolean;
    releaseWorkflowMirrorOnlyModeAvailable: boolean;
    releaseWorkflowDefaultUpstreamFallbackEnabled: boolean;
  };
  legacyLfsProtectedPaths: string[];
  recommendations: string[];
};

type SupplyReadinessModule = {
  evaluateSidecarSupplyReadiness: (options: {
    repoRoot: string;
    env?: Record<string, string | undefined>;
    platform?: string;
    arch?: string;
  }) => SupplyReadinessResult;
};

class TempDir {
  readonly path: string;

  constructor(prefix: string) {
    this.path = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), `${prefix}-`));
  }

  child(relative: string): string {
    return path.join(this.path, relative);
  }

  mkdir(relative: string): string {
    const target = this.child(relative);
    fs.mkdirSync(target, { recursive: true });
    return target;
  }

  cleanup(): void {
    fs.rmSync(this.path, { recursive: true, force: true });
  }
}

describe('sidecar supply readiness contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const utilsPath = path.join(repoRoot, 'scripts', 'sidecar-supply-readiness-utils.js');
  let utils: SupplyReadinessModule;
  let temp: TempDir;

  beforeAll(() => {
    utils = require(utilsPath) as SupplyReadinessModule;
  });

  beforeEach(() => {
    temp = new TempDir('noteconnection-sidecar-supply');
  });

  afterEach(() => {
    temp.cleanup();
  });

  test('package exposes a local sidecar supply verifier command', () => {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as PackageJson;
    expect(pkg.scripts?.['verify:sidecar:supply']).toBe(
      'node scripts/verify-sidecar-supply-readiness.js'
    );
  });

  test('reports offline-ready when host artifacts already exist locally', () => {
    const fakeRepo = temp.mkdir('repo');
    const binDir = temp.mkdir(path.join('repo', 'src-tauri', 'bin'));
    temp.mkdir(path.join('repo', '.github', 'workflows'));
    fs.writeFileSync(path.join(fakeRepo, '.gitattributes'), '');
    fs.writeFileSync(path.join(binDir, 'server-x86_64-unknown-linux-gnu'), 'server');
    fs.writeFileSync(path.join(binDir, 'markdown-worker-x86_64-unknown-linux-gnu'), 'worker');
    fs.writeFileSync(
      path.join(binDir, 'godot-x86_64-unknown-linux-gnu'),
      Buffer.alloc(1024 * 1024 + 64, 7)
    );

    const result = utils.evaluateSidecarSupplyReadiness({
      repoRoot: fakeRepo,
      platform: 'linux',
      arch: 'x64',
      env: {},
    });

    expect(result.offlineBootstrapReady).toBe(true);
    expect(result.rating).toBe('offline-ready');
    expect(result.artifacts.server.ready).toBe(true);
    expect(result.artifacts.markdownWorker.ready).toBe(true);
    expect(result.artifacts.godot.ready).toBe(true);
    expect(result.artifacts.godot.networkRequiredForBootstrap).toBe(false);
    expect(result.ci.releaseWorkflowMirrorFirstDownload).toBe(false);
    expect(result.ci.releaseWorkflowDirectUpstreamDownload).toBe(false);
    expect(result.ci.releaseWorkflowArchiveDigestPinned).toBe(false);
    expect(result.ci.releaseWorkflowMirrorOnlyModeAvailable).toBe(false);
    expect(result.ci.releaseWorkflowDefaultUpstreamFallbackEnabled).toBe(false);
  });

  test('reports network-dependent when godot is only reachable through configured download fallback', () => {
    const fakeRepo = temp.mkdir('repo');
    const binDir = temp.mkdir(path.join('repo', 'src-tauri', 'bin'));
    temp.mkdir(path.join('repo', '.github', 'workflows'));
    fs.writeFileSync(path.join(fakeRepo, '.gitattributes'), '');
    fs.writeFileSync(path.join(binDir, 'server-x86_64-unknown-linux-gnu'), 'server');
    fs.writeFileSync(path.join(binDir, 'markdown-worker-x86_64-unknown-linux-gnu'), 'worker');

    const result = utils.evaluateSidecarSupplyReadiness({
      repoRoot: fakeRepo,
      platform: 'linux',
      arch: 'x64',
      env: {
        NOTE_CONNECTION_GODOT_DOWNLOAD_URL: 'https://mirror.example/godot.zip',
        NOTE_CONNECTION_GODOT_DOWNLOAD_SHA256: 'a'.repeat(64),
      },
    });

    expect(result.offlineBootstrapReady).toBe(false);
    expect(result.rating).toBe('network-dependent');
    expect(result.artifacts.godot.ready).toBe(false);
    expect(result.artifacts.godot.downloadConfigured).toBe(true);
    expect(result.artifacts.godot.pinnedDownload).toBe(true);
    expect(result.artifacts.godot.networkRequiredForBootstrap).toBe(true);
    expect(result.artifacts.godot.sourceKindsAvailable).toContain('download');
  });

  test('current repo pins archive digests and can disable upstream fallback for mirror-only release smoke runs', () => {
    const result = utils.evaluateSidecarSupplyReadiness({
      repoRoot,
      platform: 'linux',
      arch: 'x64',
      env: {},
    });

    expect(result.ci.releaseWorkflowMirrorFirstDownload).toBe(true);
    expect(result.ci.releaseWorkflowDirectUpstreamDownload).toBe(true);
    expect(result.ci.releaseWorkflowArchiveDigestPinned).toBe(true);
    expect(result.ci.releaseWorkflowMirrorOnlyModeAvailable).toBe(true);
    expect(result.ci.releaseWorkflowDefaultUpstreamFallbackEnabled).toBe(true);
    expect(result.legacyLfsProtectedPaths).toEqual([
      'src-tauri/bin/godot-x86_64-pc-windows-msvc.exe',
      'src-tauri/bin/server-aarch64-apple-darwin',
      'src-tauri/bin/server-x86_64-pc-windows-msvc.exe',
      'src-tauri/bin/server-x86_64-unknown-linux-gnu',
    ]);
    expect(result.recommendations).toContain(
      'Keep the release workflow mirror-first, keep archive digest pinning enforced, exercise mirror-only smoke runs regularly, and remove default upstream fallback reliance before strict no-LFS mode.'
    );
  });
});
