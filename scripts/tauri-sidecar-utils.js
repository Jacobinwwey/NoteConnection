const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');
const { pipeline } = require('stream/promises');
const { fileURLToPath, URL } = require('url');

const MIN_GODOT_BINARY_BYTES = 1 * 1024 * 1024;
const LFS_POINTER_PREFIX = 'version https://git-lfs.github.com/spec/v1';

const HOST_GODOT_BINARY = {
  windows_x64: 'godot-x86_64-pc-windows-msvc.exe',
  linux_x64: 'godot-x86_64-unknown-linux-gnu',
  macos_arm64: 'godot-aarch64-apple-darwin',
  macos_x64: 'godot-x86_64-apple-darwin',
};

const SERVER_BINARIES = {
  windows_x64: 'server-x86_64-pc-windows-msvc.exe',
  linux_x64: 'server-x86_64-unknown-linux-gnu',
  macos_arm64: 'server-aarch64-apple-darwin',
  macos_x64: 'server-x86_64-apple-darwin',
};

const MARKDOWN_WORKER_BINARIES = {
  windows_x64: 'markdown-worker-x86_64-pc-windows-msvc.exe',
  linux_x64: 'markdown-worker-x86_64-unknown-linux-gnu',
  macos_arm64: 'markdown-worker-aarch64-apple-darwin',
  macos_x64: 'markdown-worker-x86_64-apple-darwin',
};

function safeStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function binarySize(filePath) {
  const stat = safeStat(filePath);
  return stat && stat.isFile() ? stat.size : 0;
}

function isNonEmptyBinary(filePath) {
  return binarySize(filePath) > 0;
}

function isLfsPointerContent(content) {
  if (typeof content !== 'string') {
    return false;
  }

  return content.startsWith(LFS_POINTER_PREFIX)
    && content.includes('\noid sha256:')
    && content.includes('\nsize ');
}

function isLfsPointerFile(filePath) {
  const stat = safeStat(filePath);
  if (!stat || !stat.isFile() || stat.size > 1024) {
    return false;
  }

  try {
    return isLfsPointerContent(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return false;
  }
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function isValidGodotBinary(filePath, expectedSha256) {
  if (binarySize(filePath) < MIN_GODOT_BINARY_BYTES) {
    return false;
  }
  if (expectedSha256) {
    return sha256File(filePath).toLowerCase() === String(expectedSha256).trim().toLowerCase();
  }
  return true;
}

function resolveBinaryName(map, options = {}) {
  const platform = options.platform || process.platform;
  const arch = options.arch || process.arch;

  if (platform === 'win32' && arch === 'x64') {
    return map.windows_x64;
  }
  if (platform === 'linux' && arch === 'x64') {
    return map.linux_x64;
  }
  if (platform === 'darwin' && arch === 'arm64') {
    return map.macos_arm64;
  }
  if (platform === 'darwin' && arch === 'x64') {
    return map.macos_x64;
  }
  return null;
}

function resolveHostGodotBinaryName(options = {}) {
  return resolveBinaryName(HOST_GODOT_BINARY, options);
}

function resolveHostServerBinaryName(options = {}) {
  return resolveBinaryName(SERVER_BINARIES, options);
}

function resolveHostMarkdownWorkerBinaryName(options = {}) {
  return resolveBinaryName(MARKDOWN_WORKER_BINARIES, options);
}

function copyExecutableFile(source, target, platform = process.platform) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  if (platform !== 'win32') {
    fs.chmodSync(target, 0o755);
  }
}

function addCandidate(list, filePath) {
  if (!filePath) return;
  if (!list.includes(filePath)) {
    list.push(filePath);
  }
}

function hostBinaryNames(platform = process.platform) {
  if (platform === 'win32') {
    return ['godot.exe', 'godot4.exe', 'Godot_v4.3-stable_win64.exe'];
  }
  if (platform === 'darwin') {
    return ['godot', 'godot4', 'Godot'];
  }
  return ['godot', 'godot4'];
}

function addBinariesFromDir(list, dirPath, hostNames, platform = process.platform) {
  if (!dirPath || !fs.existsSync(dirPath)) return;
  for (const binaryName of hostNames) {
    addCandidate(list, path.join(dirPath, binaryName));
  }

  let entries = [];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    const normalized = entry.name.toLowerCase();
    if (platform === 'win32') {
      if (/^godot.*\.exe$/.test(normalized)) {
        addCandidate(list, path.join(dirPath, entry.name));
      }
      continue;
    }

    if (/^godot($|[^a-z0-9].*)/.test(normalized) || /^godot4($|[^a-z0-9].*)/.test(normalized)) {
      addCandidate(list, path.join(dirPath, entry.name));
    }
  }
}

function addKnownMacAppCandidates(list, platform = process.platform) {
  if (platform !== 'darwin') {
    return;
  }
  addCandidate(list, '/Applications/Godot.app/Contents/MacOS/Godot');
  addCandidate(list, '/Applications/Godot_mono.app/Contents/MacOS/Godot');
}

function guessHostSearchDirs(platform = process.platform, userHome = os.homedir()) {
  const dirs = [];

  if (platform === 'win32') {
    ['Downloads', 'downloads', 'Desktop', '下载', '网页下载'].forEach((name) => {
      dirs.push(path.join(userHome, name));
    });
    for (let code = 67; code <= 90; code += 1) {
      const drive = String.fromCharCode(code);
      ['Downloads', 'downloads', '下载', '网页下载'].forEach((name) => {
        dirs.push(`${drive}:\\${name}`);
      });
    }
    return dirs;
  }

  dirs.push('/usr/local/bin', '/usr/bin', path.join(userHome, '.local', 'bin'));
  if (platform === 'darwin') {
    dirs.push('/opt/homebrew/bin', '/Applications');
  }
  return dirs;
}

function shouldFailOnMissing(options = {}) {
  const platform = options.platform || process.platform;
  const env = options.env || process.env;
  if (env.NOTE_CONNECTION_GODOT_REQUIRED === '1') {
    return true;
  }
  return platform === 'win32';
}

function resolveDefaultGodotCacheDir(options = {}) {
  const platform = options.platform || process.platform;
  const env = options.env || process.env;
  const userHome = env.HOME || env.USERPROFILE || os.homedir();

  if (env.NOTE_CONNECTION_GODOT_CACHE_DIR) {
    return env.NOTE_CONNECTION_GODOT_CACHE_DIR;
  }

  if (platform === 'win32') {
    const localAppData = env.LOCALAPPDATA || path.join(userHome, 'AppData', 'Local');
    return path.join(localAppData, 'NoteConnection', 'cache', 'godot');
  }

  const xdgCacheHome = env.XDG_CACHE_HOME || path.join(userHome, '.cache');
  return path.join(xdgCacheHome, 'noteconnection', 'godot');
}

function resolveGodotBootstrapContext(options = {}) {
  const repoRoot = options.repoRoot || path.resolve(__dirname, '..');
  const env = options.env || process.env;
  const platform = options.platform || process.platform;
  const arch = options.arch || process.arch;
  const hostGodotBinaryName = resolveHostGodotBinaryName({ platform, arch });
  if (!hostGodotBinaryName) {
    return null;
  }

  const sidecarDir = path.join(repoRoot, 'src-tauri', 'bin');
  const targetPath = path.join(sidecarDir, hostGodotBinaryName);
  const cacheDir = resolveDefaultGodotCacheDir({ platform, env });
  const cachePath = path.join(cacheDir, hostGodotBinaryName);
  const expectedSha256 = env.NOTE_CONNECTION_GODOT_DOWNLOAD_SHA256
    ? String(env.NOTE_CONNECTION_GODOT_DOWNLOAD_SHA256).trim().toLowerCase()
    : '';

  const hostNames = hostBinaryNames(platform);
  const candidates = [];
  const envGodot = env.NOTE_CONNECTION_GODOT_EXE;

  if (envGodot && /_console\.exe$/i.test(envGodot)) {
    addCandidate(candidates, envGodot.replace(/_console\.exe$/i, '.exe'));
  }
  addCandidate(candidates, envGodot);
  addCandidate(candidates, targetPath);
  addBinariesFromDir(candidates, sidecarDir, hostNames, platform);

  const customSearchDirs = String(env.NOTE_CONNECTION_GODOT_SEARCH_DIRS || '')
    .split(path.delimiter)
    .map((segment) => segment.trim())
    .filter(Boolean);
  for (const dirPath of customSearchDirs) {
    addBinariesFromDir(candidates, dirPath, hostNames, platform);
  }

  for (const dirPath of guessHostSearchDirs(platform, env.HOME || env.USERPROFILE || os.homedir())) {
    addBinariesFromDir(candidates, dirPath, hostNames, platform);
  }
  addKnownMacAppCandidates(candidates, platform);

  return {
    repoRoot,
    env,
    platform,
    arch,
    sidecarDir,
    hostGodotBinaryName,
    targetPath,
    cacheDir,
    cachePath,
    downloadUrl: String(env.NOTE_CONNECTION_GODOT_DOWNLOAD_URL || '').trim(),
    expectedSha256,
    candidates,
  };
}

async function downloadFile(downloadUrl, targetPath) {
  const parsedUrl = new URL(downloadUrl);
  if (parsedUrl.protocol === 'file:') {
    fs.copyFileSync(fileURLToPath(parsedUrl), targetPath);
    return;
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error(`Unsupported Godot download URL protocol: ${parsedUrl.protocol}`);
  }

  const client = parsedUrl.protocol === 'https:' ? https : http;
  const response = await new Promise((resolve, reject) => {
    const request = client.get(parsedUrl, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode || 0) && res.headers.location) {
        res.resume();
        resolve({
          redirectUrl: new URL(res.headers.location, parsedUrl).toString(),
        });
        return;
      }
      if ((res.statusCode || 0) >= 400) {
        reject(new Error(`Godot download failed with status ${res.statusCode}`));
        res.resume();
        return;
      }
      resolve(res);
    });
    request.on('error', reject);
  });

  if (response && response.redirectUrl) {
    await downloadFile(response.redirectUrl, targetPath);
    return;
  }

  await pipeline(response, fs.createWriteStream(targetPath));
}

async function materializeDownloadedGodot(context, logger) {
  if (!context.downloadUrl) {
    return false;
  }

  fs.mkdirSync(context.cacheDir, { recursive: true });
  const temporaryPath = `${context.cachePath}.download`;
  try {
    if (/^https?:/i.test(context.downloadUrl) && !context.expectedSha256) {
      logger.warn('[Godot] Downloading without NOTE_CONNECTION_GODOT_DOWNLOAD_SHA256. Integrity is not pinned.');
    }

    logger.log(`[Godot] Downloading host binary from ${context.downloadUrl}`);
    await downloadFile(context.downloadUrl, temporaryPath);
    if (!isValidGodotBinary(temporaryPath, context.expectedSha256)) {
      throw new Error(
        `Downloaded Godot binary failed size/sha256 validation: ${temporaryPath}`
      );
    }
    fs.renameSync(temporaryPath, context.cachePath);
    return true;
  } finally {
    if (fs.existsSync(temporaryPath)) {
      fs.rmSync(temporaryPath, { force: true });
    }
  }
}

async function prepareGodotSidecar(options = {}) {
  const logger = options.logger || console;
  const context = resolveGodotBootstrapContext(options);
  if (!context) {
    return {
      outcome: 'skipped',
      sourceKind: 'unsupported',
      targetPath: '',
      cachePath: '',
    };
  }

  if (isValidGodotBinary(context.targetPath, context.expectedSha256)) {
    return {
      outcome: 'ready',
      sourceKind: 'existing-target',
      targetPath: context.targetPath,
      cachePath: context.cachePath,
    };
  }

  if (isNonEmptyBinary(context.targetPath) && !isValidGodotBinary(context.targetPath, context.expectedSha256)) {
    logger.warn(
      `[Godot] Existing sidecar binary looks invalid (${binarySize(context.targetPath)} bytes): ${context.targetPath}`
    );
  }

  const candidateSource = context.candidates.find((candidate) =>
    isValidGodotBinary(candidate, context.expectedSha256)
  );
  if (candidateSource) {
    copyExecutableFile(candidateSource, context.targetPath, context.platform);
    return {
      outcome: 'prepared',
      sourceKind: 'candidate',
      targetPath: context.targetPath,
      cachePath: context.cachePath,
    };
  }

  if (isValidGodotBinary(context.cachePath, context.expectedSha256)) {
    copyExecutableFile(context.cachePath, context.targetPath, context.platform);
    return {
      outcome: 'prepared',
      sourceKind: 'cache',
      targetPath: context.targetPath,
      cachePath: context.cachePath,
    };
  }

  const downloaded = await materializeDownloadedGodot(context, logger);
  if (downloaded && isValidGodotBinary(context.cachePath, context.expectedSha256)) {
    copyExecutableFile(context.cachePath, context.targetPath, context.platform);
    return {
      outcome: 'prepared',
      sourceKind: 'download',
      targetPath: context.targetPath,
      cachePath: context.cachePath,
    };
  }

  return {
    outcome: 'missing',
    sourceKind: 'missing',
    targetPath: context.targetPath,
    cachePath: context.cachePath,
  };
}

function validateTauriSidecars(options = {}) {
  const repoRoot = options.repoRoot || path.resolve(__dirname, '..');
  const platform = options.platform || process.platform;
  const arch = options.arch || process.arch;
  const env = options.env || process.env;
  const validateAll = options.validateAll === true;
  const binDir = path.join(repoRoot, 'src-tauri', 'bin');

  const requiredServerBinaryNames = validateAll
    ? [SERVER_BINARIES.windows_x64, SERVER_BINARIES.linux_x64, SERVER_BINARIES.macos_arm64]
    : [resolveHostServerBinaryName({ platform, arch })].filter(Boolean);
  const requiredMarkdownWorkerBinaryNames = [resolveHostMarkdownWorkerBinaryName({ platform, arch })].filter(Boolean);
  const requiredGodotBinaryNames = validateAll
    ? [HOST_GODOT_BINARY.windows_x64].filter(Boolean)
    : shouldFailOnMissing({ platform, env })
      ? [resolveHostGodotBinaryName({ platform, arch })].filter(Boolean)
      : [];

  const invalid = [];

  if (!requiredServerBinaryNames.length) {
    invalid.push(
      `Unsupported host platform/arch for sidecar validation: ${platform}/${arch}`
    );
    return {
      invalid,
      requiredServerBinaryNames,
      requiredMarkdownWorkerBinaryNames,
      requiredGodotBinaryNames,
    };
  }

  for (const binaryName of requiredServerBinaryNames) {
    const serverBinary = path.join(binDir, binaryName);
    if (!isNonEmptyBinary(serverBinary)) {
      invalid.push(`${serverBinary} (missing or empty)`);
    } else if (isLfsPointerFile(serverBinary)) {
      invalid.push(`${serverBinary} (git-lfs pointer placeholder)`);
    }
  }

  for (const binaryName of requiredMarkdownWorkerBinaryNames) {
    const workerBinary = path.join(binDir, binaryName);
    if (!isNonEmptyBinary(workerBinary)) {
      invalid.push(`${workerBinary} (missing or empty)`);
    } else if (isLfsPointerFile(workerBinary)) {
      invalid.push(`${workerBinary} (git-lfs pointer placeholder)`);
    }
  }

  for (const binaryName of requiredGodotBinaryNames) {
    const godotBinary = path.join(binDir, binaryName);
    if (!isValidGodotBinary(godotBinary)) {
      invalid.push(
        `${godotBinary} (missing/too small; expected >= ${MIN_GODOT_BINARY_BYTES} bytes, actual ${binarySize(godotBinary)} bytes)`
      );
    }
  }

  return {
    invalid,
    requiredServerBinaryNames,
    requiredMarkdownWorkerBinaryNames,
    requiredGodotBinaryNames,
  };
}

module.exports = {
  MIN_GODOT_BINARY_BYTES,
  HOST_GODOT_BINARY,
  SERVER_BINARIES,
  MARKDOWN_WORKER_BINARIES,
  binarySize,
  isNonEmptyBinary,
  isValidGodotBinary,
  resolveHostGodotBinaryName,
  resolveHostServerBinaryName,
  resolveHostMarkdownWorkerBinaryName,
  resolveDefaultGodotCacheDir,
  resolveGodotBootstrapContext,
  shouldFailOnMissing,
  prepareGodotSidecar,
  validateTauriSidecars,
  sha256File,
  isLfsPointerContent,
  isLfsPointerFile,
};
