#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const workerRoot = path.join(repoRoot, 'tools', 'markdown_worker');
const workerCargoToml = path.join(workerRoot, 'Cargo.toml');
const workerSrcDir = path.join(workerRoot, 'src');
const binDir = path.join(repoRoot, 'src-tauri', 'bin');

const TARGETS = {
  windows_x64: {
    binaryName: 'markdown_worker.exe',
    outputName: 'markdown-worker-x86_64-pc-windows-msvc.exe',
  },
  linux_x64: {
    binaryName: 'markdown_worker',
    outputName: 'markdown-worker-x86_64-unknown-linux-gnu',
  },
  macos_arm64: {
    binaryName: 'markdown_worker',
    outputName: 'markdown-worker-aarch64-apple-darwin',
  },
  macos_x64: {
    binaryName: 'markdown_worker',
    outputName: 'markdown-worker-x86_64-apple-darwin',
  },
};

function resolveHostTarget() {
  if (process.platform === 'win32' && process.arch === 'x64') return TARGETS.windows_x64;
  if (process.platform === 'linux' && process.arch === 'x64') return TARGETS.linux_x64;
  if (process.platform === 'darwin' && process.arch === 'arm64') return TARGETS.macos_arm64;
  if (process.platform === 'darwin' && process.arch === 'x64') return TARGETS.macos_x64;
  return null;
}

function listSourceFiles() {
  const files = [workerCargoToml];
  const stack = [workerSrcDir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !fs.existsSync(current)) continue;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

function latestMtime(filePaths) {
  let latest = 0;
  for (const filePath of filePaths) {
    try {
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs > latest) {
        latest = stat.mtimeMs;
      }
    } catch {
      // Ignore missing files.
    }
  }
  return latest;
}

function isWorkerBuildFresh(outputPath) {
  if (!fs.existsSync(outputPath)) return false;
  const outputStat = fs.statSync(outputPath);
  if (!outputStat.isFile() || outputStat.size <= 0) return false;
  const sourceMtime = latestMtime(listSourceFiles());
  return outputStat.mtimeMs >= sourceMtime;
}

function runCargoBuild() {
  const cargoArgs = [
    'build',
    '--manifest-path',
    workerCargoToml,
    '--release',
  ];
  console.log(`[Markdown Worker] Running cargo ${cargoArgs.join(' ')}`);
  const result = spawnSync('cargo', cargoArgs, {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  return typeof result.status === 'number' ? result.status : 1;
}

function copyWorkerBinary(hostTarget) {
  const builtBinaryPath = path.join(workerRoot, 'target', 'release', hostTarget.binaryName);
  if (!fs.existsSync(builtBinaryPath)) {
    throw new Error(`[Markdown Worker] Missing built binary: ${builtBinaryPath}`);
  }

  fs.mkdirSync(binDir, { recursive: true });
  const outputPath = path.join(binDir, hostTarget.outputName);
  fs.copyFileSync(builtBinaryPath, outputPath);
  if (process.platform !== 'win32') {
    fs.chmodSync(outputPath, 0o755);
  }
  console.log(`[Markdown Worker] Ready: ${outputPath}`);
}

function main() {
  if (!fs.existsSync(workerCargoToml)) {
    throw new Error(`[Markdown Worker] Missing Cargo.toml: ${workerCargoToml}`);
  }
  const hostTarget = resolveHostTarget();
  if (!hostTarget) {
    throw new Error(
      `[Markdown Worker] Unsupported host platform/arch: ${process.platform}/${process.arch}`
    );
  }

  const args = new Set(process.argv.slice(2));
  const forceBuild = args.has('--force') || process.env.NOTE_CONNECTION_FORCE_MARKDOWN_WORKER_BUILD === '1';
  const outputPath = path.join(binDir, hostTarget.outputName);
  if (!forceBuild && isWorkerBuildFresh(outputPath)) {
    console.log('[Markdown Worker] Binary is fresh. Skipping rebuild.');
    return;
  }

  const buildStatus = runCargoBuild();
  if (buildStatus !== 0) {
    process.exit(buildStatus);
  }
  copyWorkerBinary(hostTarget);
}

try {
  main();
} catch (error) {
  console.error(String(error && error.message ? error.message : error));
  process.exit(1);
}
