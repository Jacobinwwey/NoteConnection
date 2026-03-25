#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function printUsageAndExit() {
  console.error('[docs] Usage: node scripts/run-mkdocs.js <mkdocs args>');
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  printUsageAndExit();
}

const repoRoot = path.resolve(__dirname, '..');
const candidates = [
  path.join(repoRoot, '.venv-mkdocs', 'Scripts', 'mkdocs.exe'),
  path.join(repoRoot, '.venv-mkdocs', 'bin', 'mkdocs'),
  'mkdocs',
];

let attemptedAny = false;

for (const candidate of candidates) {
  const isPathCandidate = candidate.includes(path.sep) || candidate.includes('/');
  if (isPathCandidate && !fs.existsSync(candidate)) {
    continue;
  }

  attemptedAny = true;
  const result = spawnSync(candidate, args, {
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    if (result.error.code === 'ENOENT') {
      continue;
    }
    continue;
  }

  process.exit(result.status === null ? 1 : result.status);
}

if (!attemptedAny) {
  console.error('[docs] No mkdocs executable candidate found.');
} else {
  console.error('[docs] Failed to run mkdocs from all candidates.');
}

console.error('[docs] Preferred setup (Windows):');
console.error(
  '  python -m venv .venv-mkdocs && .\\.venv-mkdocs\\Scripts\\python.exe -m pip install -r docs\\requirements-mkdocs.txt'
);
process.exit(1);
