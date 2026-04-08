import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';

type PrepareGodotSidecarResult = {
  outcome: 'ready' | 'prepared';
  sourceKind: 'existing-target' | 'candidate' | 'cache' | 'download';
  targetPath: string;
  cachePath: string;
};

type ValidateSidecarsResult = {
  invalid: string[];
};

type SidecarUtilsModule = {
  MIN_GODOT_BINARY_BYTES: number;
  resolveHostGodotBinaryName: (options?: { platform?: string; arch?: string }) => string | null;
  resolveGodotBootstrapContext: (options: {
    repoRoot: string;
    env?: Record<string, string | undefined>;
    platform?: string;
    arch?: string;
  }) => {
    targetPath: string;
    cachePath: string;
    downloadUrl: string;
    expectedSha256: string;
  } | null;
  prepareGodotSidecar: (options: {
    repoRoot: string;
    env?: Record<string, string | undefined>;
    platform?: string;
    arch?: string;
    logger?: Pick<Console, 'log' | 'warn' | 'error'>;
  }) => Promise<PrepareGodotSidecarResult>;
  validateTauriSidecars: (options: {
    repoRoot: string;
    platform?: string;
    arch?: string;
    validateAll?: boolean;
  }) => ValidateSidecarsResult;
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

function sha256File(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

describe('godot sidecar bootstrap contracts', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const sidecarUtilsPath = path.join(repoRoot, 'scripts', 'tauri-sidecar-utils.js');
  let sidecarUtils: SidecarUtilsModule;
  let temp: TempDir;

  beforeAll(() => {
    sidecarUtils = require(sidecarUtilsPath) as SidecarUtilsModule;
  });

  beforeEach(() => {
    temp = new TempDir('noteconnection-godot-bootstrap');
  });

  afterEach(() => {
    if (temp) {
      temp.cleanup();
    }
  });

  test('downloads and caches a host godot binary when a pinned file URL is configured', async () => {
    const fakeRepoRoot = temp.mkdir('repo');
    const downloadRoot = temp.mkdir('downloads');
    const cacheRoot = temp.mkdir('cache');
    const sourceBinaryPath = path.join(downloadRoot, 'godot-linux-x64');
    const sourceBinary = Buffer.alloc(sidecarUtils.MIN_GODOT_BINARY_BYTES + 64, 7);
    fs.writeFileSync(sourceBinaryPath, sourceBinary);

    const result = await sidecarUtils.prepareGodotSidecar({
      repoRoot: fakeRepoRoot,
      platform: 'linux',
      arch: 'x64',
      env: {
        NOTE_CONNECTION_GODOT_DOWNLOAD_URL: pathToFileURL(sourceBinaryPath).href,
        NOTE_CONNECTION_GODOT_DOWNLOAD_SHA256: sha256File(sourceBinaryPath),
        NOTE_CONNECTION_GODOT_CACHE_DIR: cacheRoot,
      },
      logger: console,
    });

    expect(result.outcome).toBe('prepared');
    expect(result.sourceKind).toBe('download');
    expect(fs.existsSync(result.targetPath)).toBe(true);
    expect(fs.existsSync(result.cachePath)).toBe(true);
    expect(fs.readFileSync(result.targetPath)).toEqual(sourceBinary);
    expect(fs.readFileSync(result.cachePath)).toEqual(sourceBinary);
  });

  test('accepts GitHub Releases URLs as pinned bootstrap sources without provider-specific branching', () => {
    const fakeRepoRoot = temp.mkdir('repo');
    const cacheRoot = temp.mkdir('cache');
    const githubReleaseUrl =
      'https://github.com/Jacobinwwey/NoteConnection/releases/download/v1.7.0/godot-x86_64-unknown-linux-gnu';

    const context = sidecarUtils.resolveGodotBootstrapContext({
      repoRoot: fakeRepoRoot,
      platform: 'linux',
      arch: 'x64',
      env: {
        NOTE_CONNECTION_GODOT_DOWNLOAD_URL: githubReleaseUrl,
        NOTE_CONNECTION_GODOT_DOWNLOAD_SHA256: 'abc123',
        NOTE_CONNECTION_GODOT_CACHE_DIR: cacheRoot,
      },
    });

    expect(context).not.toBeNull();
    expect(context?.downloadUrl).toBe(githubReleaseUrl);
    expect(context?.expectedSha256).toBe('abc123');
    expect(context?.cachePath).toBe(path.join(cacheRoot, 'godot-x86_64-unknown-linux-gnu'));
    expect(context?.targetPath).toBe(
      path.join(fakeRepoRoot, 'src-tauri', 'bin', 'godot-x86_64-unknown-linux-gnu')
    );
  });

  test('accepts generic object-storage mirror URLs through the same bootstrap contract', () => {
    const fakeRepoRoot = temp.mkdir('repo');
    const cacheRoot = temp.mkdir('cache');
    const objectStorageUrl =
      'https://mirror.example.invalid/noteconnection/godot/godot-x86_64-unknown-linux-gnu';

    const context = sidecarUtils.resolveGodotBootstrapContext({
      repoRoot: fakeRepoRoot,
      platform: 'linux',
      arch: 'x64',
      env: {
        NOTE_CONNECTION_GODOT_DOWNLOAD_URL: objectStorageUrl,
        NOTE_CONNECTION_GODOT_DOWNLOAD_SHA256: 'def456',
        NOTE_CONNECTION_GODOT_CACHE_DIR: cacheRoot,
      },
    });

    expect(context).not.toBeNull();
    expect(context?.downloadUrl).toBe(objectStorageUrl);
    expect(context?.expectedSha256).toBe('def456');
    expect(context?.cachePath).toBe(path.join(cacheRoot, 'godot-x86_64-unknown-linux-gnu'));
  });

  test('reuses cached godot binary when the original download source is gone', async () => {
    const fakeRepoRoot = temp.mkdir('repo');
    const downloadRoot = temp.mkdir('downloads');
    const cacheRoot = temp.mkdir('cache');
    const sourceBinaryPath = path.join(downloadRoot, 'godot-linux-x64');
    fs.writeFileSync(
      sourceBinaryPath,
      Buffer.alloc(sidecarUtils.MIN_GODOT_BINARY_BYTES + 32, 3)
    );

    const env = {
      NOTE_CONNECTION_GODOT_DOWNLOAD_URL: pathToFileURL(sourceBinaryPath).href,
      NOTE_CONNECTION_GODOT_DOWNLOAD_SHA256: sha256File(sourceBinaryPath),
      NOTE_CONNECTION_GODOT_CACHE_DIR: cacheRoot,
    };

    const first = await sidecarUtils.prepareGodotSidecar({
      repoRoot: fakeRepoRoot,
      platform: 'linux',
      arch: 'x64',
      env,
      logger: console,
    });
    expect(first.sourceKind).toBe('download');

    fs.rmSync(sourceBinaryPath, { force: true });
    fs.rmSync(first.targetPath, { force: true });

    const second = await sidecarUtils.prepareGodotSidecar({
      repoRoot: fakeRepoRoot,
      platform: 'linux',
      arch: 'x64',
      env,
      logger: console,
    });

    expect(second.outcome).toBe('prepared');
    expect(second.sourceKind).toBe('cache');
    expect(fs.existsSync(second.targetPath)).toBe(true);
  });

  test('rejects downloaded godot binaries when sha256 does not match the pinned value', async () => {
    const fakeRepoRoot = temp.mkdir('repo');
    const downloadRoot = temp.mkdir('downloads');
    const cacheRoot = temp.mkdir('cache');
    const sourceBinaryPath = path.join(downloadRoot, 'godot-linux-x64');
    fs.writeFileSync(
      sourceBinaryPath,
      Buffer.alloc(sidecarUtils.MIN_GODOT_BINARY_BYTES + 16, 9)
    );

    await expect(
      sidecarUtils.prepareGodotSidecar({
        repoRoot: fakeRepoRoot,
        platform: 'linux',
        arch: 'x64',
        env: {
          NOTE_CONNECTION_GODOT_DOWNLOAD_URL: pathToFileURL(sourceBinaryPath).href,
          NOTE_CONNECTION_GODOT_DOWNLOAD_SHA256: 'deadbeef',
          NOTE_CONNECTION_GODOT_CACHE_DIR: cacheRoot,
        },
        logger: console,
      })
    ).rejects.toThrow(/sha256/i);
  });

  test('validates the host-specific godot binary name together with server and markdown worker sidecars', () => {
    const fakeRepoRoot = temp.mkdir('repo');
    const binDir = temp.mkdir(path.join('repo', 'src-tauri', 'bin'));
    fs.writeFileSync(path.join(binDir, 'server-x86_64-unknown-linux-gnu'), 'server');
    fs.writeFileSync(path.join(binDir, 'markdown-worker-x86_64-unknown-linux-gnu'), 'worker');
    fs.writeFileSync(
      path.join(binDir, 'godot-x86_64-unknown-linux-gnu'),
      Buffer.alloc(sidecarUtils.MIN_GODOT_BINARY_BYTES + 8, 5)
    );

    const result = sidecarUtils.validateTauriSidecars({
      repoRoot: fakeRepoRoot,
      platform: 'linux',
      arch: 'x64',
    });

    expect(sidecarUtils.resolveHostGodotBinaryName({ platform: 'linux', arch: 'x64' })).toBe(
      'godot-x86_64-unknown-linux-gnu'
    );
    expect(result.invalid).toEqual([]);
  });

  test('treats git-lfs pointer placeholders as invalid server and markdown-worker sidecars', () => {
    const fakeRepoRoot = temp.mkdir('repo');
    const binDir = temp.mkdir(path.join('repo', 'src-tauri', 'bin'));
    const lfsPointer = [
      'version https://git-lfs.github.com/spec/v1',
      'oid sha256:deadbeef',
      'size 12345678',
    ].join('\n');

    fs.writeFileSync(path.join(binDir, 'server-x86_64-unknown-linux-gnu'), lfsPointer);
    fs.writeFileSync(path.join(binDir, 'markdown-worker-x86_64-unknown-linux-gnu'), lfsPointer);
    fs.writeFileSync(
      path.join(binDir, 'godot-x86_64-unknown-linux-gnu'),
      Buffer.alloc(sidecarUtils.MIN_GODOT_BINARY_BYTES + 8, 5)
    );

    const result = sidecarUtils.validateTauriSidecars({
      repoRoot: fakeRepoRoot,
      platform: 'linux',
      arch: 'x64',
    });

    expect(result.invalid).toEqual([
      expect.stringContaining('server-x86_64-unknown-linux-gnu'),
      expect.stringContaining('markdown-worker-x86_64-unknown-linux-gnu'),
    ]);
  });
});
