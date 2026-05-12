#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const entryFile = path.join(repoRoot, 'dist', 'src', 'server.js');
const outputDir = path.join(repoRoot, 'src-tauri', 'bin');
const pkgCli = path.join(repoRoot, 'node_modules', '@yao-pkg', 'pkg', 'lib-es5', 'bin.js');
const KNOWN_BENIGN_WARNING_PATTERNS = [
  /esbuild transform returned no code for .*[@\\/]iconify[@\\/]types[@\\/]types\.js/i,
];
const PKG_NO_BYTECODE_RETRY_PATTERN = /--no-bytecode and no source breaks final executable/i;

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
  const basePkgArgs = [
    pkgCli,
    entryFile,
    '--target',
    targetConfig.pkgTarget,
    '--compress',
    'Brotli',
    '--public-packages',
    '*',
    '--output',
    outputPath,
  ];
  const executePkg = (args) => spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  console.log(`[Sidecar Build] Building ${targetConfig.pkgTarget} -> ${outputPath}`);
  let result = executePkg([
    ...basePkgArgs.slice(0, 6),
    '--no-bytecode',
    ...basePkgArgs.slice(6),
  ]);

  writeFilteredOutput(result.stdout, process.stdout);
  writeFilteredOutput(result.stderr, process.stderr);

  const firstAttemptOutput = `${String(result.stdout || '')}\n${String(result.stderr || '')}`;
  if (
    result.status !== 0
    && PKG_NO_BYTECODE_RETRY_PATTERN.test(firstAttemptOutput)
  ) {
    console.warn(
      `[Sidecar Build] Retrying ${targetConfig.pkgTarget} without --no-bytecode because pkg requires bytecode for the current dependency graph.`
    );
    result = executePkg(basePkgArgs);
    writeFilteredOutput(result.stdout, process.stdout);
    writeFilteredOutput(result.stderr, process.stderr);
  }

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`[Sidecar Build] pkg failed for target ${targetConfig.pkgTarget}.`);
  }
}

function runMarkdownWorkerBuild(args) {
  const scriptPath = path.join(repoRoot, 'scripts', 'build-markdown-worker.js');
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error('[Sidecar Build] Markdown worker build failed.');
  }
}

function isKnownBenignWarningLine(line) {
  const normalizedLine = String(line || '').trim();
  if (!normalizedLine) {
    return false;
  }
  return KNOWN_BENIGN_WARNING_PATTERNS.some((pattern) => pattern.test(normalizedLine));
}

function writeFilteredOutput(rawOutput, targetStream) {
  const output = String(rawOutput || '');
  if (!output) {
    return;
  }
  const lines = output.split(/\r?\n/);
  const filtered = lines.filter((line) => !isKnownBenignWarningLine(line));
  const hasTrailingNewline = /\r?\n$/.test(output);
  const joined = filtered.join('\n');
  if (!joined) {
    return;
  }
  targetStream.write(hasTrailingNewline ? `${joined}\n` : joined);
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
  const forceBuild = args.has('--force') || process.env.NOTE_CONNECTION_FORCE_SIDECAR_REBUILD === '1';
  const targets = buildAll
    ? [TARGETS.windows_x64, TARGETS.linux_x64, TARGETS.macos_arm64, TARGETS.macos_x64]
    : [resolveHostTarget()].filter(Boolean);

  if (!targets.length) {
    throw new Error(
      `[Sidecar Build] Unsupported host platform/arch for --host mode: ${process.platform}/${process.arch}`
    );
  }

  targets.forEach((target) => runPkgBuild(target));
  runMarkdownWorkerBuild(forceBuild ? ['--force'] : []);
  console.log(`[Sidecar Build] Completed ${targets.length} target(s).`);
}

try {
  main();
} catch (error) {
  console.error(String(error && error.message ? error.message : error));
  process.exit(1);
}
