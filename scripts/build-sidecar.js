#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const entryFile = path.join(repoRoot, 'dist', 'src', 'server.js');
const outputDir = path.join(repoRoot, 'src-tauri', 'bin');
const pkgCli = path.join(repoRoot, 'node_modules', '@yao-pkg', 'pkg', 'lib-es5', 'bin.js');

const TARGETS = {
  windows_x64: {
    pkgTarget: 'node22-win-x64',
    outputFile: 'server-x86_64-pc-windows-msvc.exe',
  },
  linux_x64: {
    pkgTarget: 'node22-linux-x64',
    outputFile: 'server-x86_64-unknown-linux-gnu',
  },
  macos_arm64: {
    pkgTarget: 'node22-macos-arm64',
    outputFile: 'server-aarch64-apple-darwin',
  },
  macos_x64: {
    pkgTarget: 'node22-macos-x64',
    outputFile: 'server-x86_64-apple-darwin',
  },
};

function resolveHostTarget() {
  if (process.platform === 'win32' && process.arch === 'x64') {
    return TARGETS.windows_x64;
  }
  if (process.platform === 'linux' && process.arch === 'x64') {
    return TARGETS.linux_x64;
  }
  if (process.platform === 'darwin' && process.arch === 'arm64') {
    return TARGETS.macos_arm64;
  }
  if (process.platform === 'darwin' && process.arch === 'x64') {
    return TARGETS.macos_x64;
  }
  return null;
}

function runPkgBuild(targetConfig) {
  const outputPath = path.join(outputDir, targetConfig.outputFile);
  const pkgArgs = [
    pkgCli,
    entryFile,
    '--target',
    targetConfig.pkgTarget,
    '--compress',
    'Brotli',
    '--no-bytecode',
    '--public',
    '--output',
    outputPath,
  ];

  console.log(`[Sidecar Build] Building ${targetConfig.pkgTarget} -> ${outputPath}`);
  const result = spawnSync(process.execPath, pkgArgs, {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`[Sidecar Build] pkg failed for target ${targetConfig.pkgTarget}.`);
  }
}

function ensurePreconditions() {
  if (!fs.existsSync(entryFile)) {
    throw new Error(
      `[Sidecar Build] Missing entry file: ${entryFile}. Run TypeScript build first.`
    );
  }
  if (!fs.existsSync(pkgCli)) {
    throw new Error(`[Sidecar Build] Missing pkg CLI: ${pkgCli}. Run npm install first.`);
  }
  fs.mkdirSync(outputDir, { recursive: true });
}

function main() {
  ensurePreconditions();

  const args = new Set(process.argv.slice(2));
  const buildAll = args.has('--all');
  const targets = buildAll
    ? [TARGETS.windows_x64, TARGETS.linux_x64, TARGETS.macos_arm64]
    : [resolveHostTarget()].filter(Boolean);

  if (!targets.length) {
    throw new Error(
      `[Sidecar Build] Unsupported host platform/arch for --host mode: ${process.platform}/${process.arch}`
    );
  }

  targets.forEach((target) => runPkgBuild(target));
  console.log(`[Sidecar Build] Completed ${targets.length} target(s).`);
}

try {
  main();
} catch (error) {
  console.error(String(error && error.message ? error.message : error));
  process.exit(1);
}
