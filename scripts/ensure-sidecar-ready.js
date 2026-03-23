#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(repoRoot, 'src');

const markerFiles = [
  path.join(repoRoot, 'package.json'),
  path.join(repoRoot, 'tsconfig.json'),
  path.join(repoRoot, 'scripts', 'build-sidecar.js'),
  path.join(repoRoot, 'scripts', 'ensure-godot-sidecar.js'),
  path.join(repoRoot, 'scripts', 'validate-tauri-sidecars.js'),
];

const serverBinaryByHost = {
  windows_x64: 'server-x86_64-pc-windows-msvc.exe',
  linux_x64: 'server-x86_64-unknown-linux-gnu',
  macos_arm64: 'server-aarch64-apple-darwin',
  macos_x64: 'server-x86_64-apple-darwin',
};

function resolveHostServerBinaryPath() {
  const binDir = path.join(repoRoot, 'src-tauri', 'bin');
  if (process.platform === 'win32' && process.arch === 'x64') {
    return path.join(binDir, serverBinaryByHost.windows_x64);
  }
  if (process.platform === 'linux' && process.arch === 'x64') {
    return path.join(binDir, serverBinaryByHost.linux_x64);
  }
  if (process.platform === 'darwin' && process.arch === 'arm64') {
    return path.join(binDir, serverBinaryByHost.macos_arm64);
  }
  if (process.platform === 'darwin' && process.arch === 'x64') {
    return path.join(binDir, serverBinaryByHost.macos_x64);
  }
  return '';
}

function getMtimeMs(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile() ? stat.mtimeMs : 0;
  } catch {
    return 0;
  }
}

function isRelevantSourceFile(filePath) {
  const relative = path.relative(srcRoot, filePath).replace(/\\/g, '/');
  if (!relative || relative.startsWith('..')) {
    return false;
  }
  if (relative.startsWith('frontend/')) {
    return false;
  }
  if (relative.startsWith('generated/')) {
    return false;
  }
  if (relative.endsWith('.d.ts')) {
    return false;
  }
  if (relative.endsWith('.test.ts') || relative.endsWith('.spec.ts')) {
    return false;
  }
  return /\.(ts|tsx|js|json)$/.test(relative);
}

function collectLatestSourceMtime(dirPath) {
  let latest = 0;
  if (!fs.existsSync(dirPath)) {
    return latest;
  }

  const stack = [dirPath];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (!isRelevantSourceFile(fullPath)) {
        continue;
      }
      const mtime = getMtimeMs(fullPath);
      if (mtime > latest) {
        latest = mtime;
      }
    }
  }

  return latest;
}

function latestInputMtimeMs() {
  let latest = collectLatestSourceMtime(srcRoot);
  for (const markerFile of markerFiles) {
    const mtime = getMtimeMs(markerFile);
    if (mtime > latest) {
      latest = mtime;
    }
  }
  return latest;
}

function runNodeScript(scriptFileName, args = []) {
  const scriptPath = path.join(repoRoot, 'scripts', scriptFileName);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit'
  });

  return typeof result.status === 'number' ? result.status : 1;
}

function runNpmScript(scriptName) {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath) {
    const result = spawnSync(process.execPath, [npmExecPath, 'run', scriptName], {
      cwd: repoRoot,
      env: process.env,
      stdio: 'inherit'
    });
    return typeof result.status === 'number' ? result.status : 1;
  }

  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(command, ['run', scriptName], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  return typeof result.status === 'number' ? result.status : 1;
}

function shouldForceRebuild(argv) {
  const args = new Set(argv);
  return args.has('--force') || process.env.NOTE_CONNECTION_FORCE_SIDECAR_REBUILD === '1';
}

function main() {
  const forceRebuild = shouldForceRebuild(process.argv.slice(2));
  const hostServerBinary = resolveHostServerBinaryPath();

  if (!hostServerBinary) {
    console.warn(
      `[Sidecar Ensure] Unsupported host platform/arch for sidecar caching: ${process.platform}/${process.arch}. Rebuilding sidecar.`
    );
  }

  const sidecarMtime = hostServerBinary ? getMtimeMs(hostServerBinary) : 0;
  const inputsMtime = latestInputMtimeMs();

  const validationStatus = runNodeScript('validate-tauri-sidecars.js');
  const sidecarIsValid = validationStatus === 0;
  const sidecarIsFresh = sidecarMtime > 0 && sidecarMtime >= inputsMtime;
  const shouldRebuild = forceRebuild || !sidecarIsValid || !sidecarIsFresh;

  if (!shouldRebuild) {
    console.log('[Sidecar Ensure] Sidecar binaries are valid and up-to-date. Skipping rebuild.');
    process.exit(0);
  }

  if (forceRebuild) {
    console.log('[Sidecar Ensure] Forced rebuild requested.');
  } else if (!sidecarIsValid) {
    console.log('[Sidecar Ensure] Sidecar validation failed. Rebuilding.');
  } else {
    console.log('[Sidecar Ensure] Sidecar is stale compared to source inputs. Rebuilding.');
  }

  const buildStatus = runNodeScript('build-sidecar.js');
  if (buildStatus !== 0) {
    process.exit(buildStatus);
  }

  const prepareStatus = runNpmScript('prepare:godot:bin');
  if (prepareStatus !== 0) {
    process.exit(prepareStatus);
  }

  const verifyStatus = runNodeScript('validate-tauri-sidecars.js');
  process.exit(verifyStatus);
}

main();
