#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function parseArgs(argv) {
  const args = {
    root: 'tmp/startup-logs',
    out: 'tmp/startup-logs/report-platform-matrix.md',
    intervalMs: 5000,
    singlePlatformLabel: 'default',
    minTtiImprove: 30,
    minTfsImprove: 20,
    strict: false,
    once: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === '--root' && next) {
      args.root = String(next).trim();
      i += 1;
      continue;
    }
    if (token.startsWith('--root=')) {
      args.root = String(token.slice('--root='.length)).trim();
      continue;
    }

    if (token === '--out' && next) {
      args.out = String(next).trim();
      i += 1;
      continue;
    }
    if (token.startsWith('--out=')) {
      args.out = String(token.slice('--out='.length)).trim();
      continue;
    }

    if (token === '--interval-ms' && next) {
      args.intervalMs = Number(next);
      i += 1;
      continue;
    }
    if (token.startsWith('--interval-ms=')) {
      args.intervalMs = Number(token.slice('--interval-ms='.length));
      continue;
    }

    if (token === '--single-platform-label' && next) {
      args.singlePlatformLabel = String(next).trim() || 'default';
      i += 1;
      continue;
    }
    if (token.startsWith('--single-platform-label=')) {
      args.singlePlatformLabel = String(token.slice('--single-platform-label='.length)).trim() || 'default';
      continue;
    }

    if (token === '--min-tti-improve' && next) {
      args.minTtiImprove = Number(next);
      i += 1;
      continue;
    }
    if (token.startsWith('--min-tti-improve=')) {
      args.minTtiImprove = Number(token.slice('--min-tti-improve='.length));
      continue;
    }

    if (token === '--min-tfs-improve' && next) {
      args.minTfsImprove = Number(next);
      i += 1;
      continue;
    }
    if (token.startsWith('--min-tfs-improve=')) {
      args.minTfsImprove = Number(token.slice('--min-tfs-improve='.length));
      continue;
    }

    if (token === '--strict') {
      args.strict = true;
      continue;
    }

    if (token === '--once') {
      args.once = true;
      continue;
    }
  }

  return args;
}

function isLikelyTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ['.log', '.txt', '.md', '.json', '.ndjson', '.csv'].includes(ext);
}

function collectFilesRecursive(targetDir, files) {
  if (!fs.existsSync(targetDir)) {
    return;
  }
  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      collectFilesRecursive(fullPath, files);
    } else if (entry.isFile() && isLikelyTextFile(fullPath)) {
      files.push(fullPath);
    }
  }
}

function buildFingerprint(rootDir) {
  const files = [];
  collectFilesRecursive(rootDir, files);
  files.sort();

  const parts = [];
  for (const filePath of files) {
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch {
      continue;
    }
    parts.push(`${filePath}|${stat.size}|${stat.mtimeMs}`);
  }
  return parts.join('\n');
}

function runMatrix(args, rootDir) {
  const matrixScriptPath = path.resolve(__dirname, 'compare-startup-perf-matrix.js');
  const commandArgs = [
    matrixScriptPath,
    '--root',
    rootDir,
    '--out',
    path.resolve(process.cwd(), args.out),
    '--single-platform-label',
    args.singlePlatformLabel,
    '--min-tti-improve',
    String(args.minTtiImprove),
    '--min-tfs-improve',
    String(args.minTfsImprove),
  ];
  if (args.strict) {
    commandArgs.push('--strict');
  }

  const result = spawnSync(process.execPath, commandArgs, {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  const stdout = String(result.stdout || '').trim();
  const stderr = String(result.stderr || '').trim();
  if (stdout) {
    console.log(stdout);
  }
  if (stderr) {
    console.error(stderr);
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    console.error(`[startup-perf-matrix-watch] Matrix run failed with exit code ${result.status}`);
    return false;
  }
  return true;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = path.resolve(process.cwd(), args.root);

  if (!fs.existsSync(rootDir)) {
    fs.mkdirSync(rootDir, { recursive: true });
  }
  if (!Number.isFinite(args.intervalMs) || args.intervalMs < 1000) {
    args.intervalMs = 5000;
  }

  console.log(`[startup-perf-matrix-watch] root=${rootDir}`);
  console.log(`[startup-perf-matrix-watch] out=${path.resolve(process.cwd(), args.out)}`);
  console.log(`[startup-perf-matrix-watch] intervalMs=${args.intervalMs}`);

  let previousFingerprint = buildFingerprint(rootDir);
  runMatrix(args, rootDir);

  if (args.once) {
    return;
  }

  console.log('[startup-perf-matrix-watch] Watching for startup-log changes...');
  setInterval(() => {
    const nextFingerprint = buildFingerprint(rootDir);
    if (nextFingerprint === previousFingerprint) {
      return;
    }
    previousFingerprint = nextFingerprint;
    console.log(`[startup-perf-matrix-watch] Change detected at ${new Date().toISOString()}`);
    runMatrix(args, rootDir);
  }, args.intervalMs);
}

main();
