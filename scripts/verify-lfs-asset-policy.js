#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const {
  evaluateLfsAssetPolicy,
  parseLfsLsFilesOutput,
} = require('./lfs-asset-policy-utils');

const repoRoot = path.resolve(__dirname, '..');

function readGitattributesText() {
  const gitattributesPath = path.join(repoRoot, '.gitattributes');
  return fs.readFileSync(gitattributesPath, 'utf8');
}

function readGitLfsLsFilesText() {
  const result = spawnSync('git', ['lfs', 'ls-files'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if (result.error) {
    console.warn(
      `[LFS Policy] git lfs ls-files unavailable: ${String(result.error.message || result.error)}`
    );
    return '';
  }

  if (result.status !== 0) {
    const stderr = String(result.stderr || '').trim();
    if (stderr) {
      console.warn(`[LFS Policy] git lfs ls-files returned non-zero status: ${stderr}`);
    }
    return '';
  }

  return String(result.stdout || '');
}

function main() {
  const args = new Set(process.argv.slice(2));
  const mode = args.has('--strict') ? 'strict' : 'unexpected-only';
  const gitattributesText = readGitattributesText();
  const lfsLsFilesText = readGitLfsLsFilesText();
  const existingRepoPaths = parseLfsLsFilesOutput(lfsLsFilesText).filter((filePath) =>
    fs.existsSync(path.join(repoRoot, filePath))
  );
  const result = evaluateLfsAssetPolicy({
    gitattributesText,
    lfsLsFilesText,
    existingRepoPaths,
    mode,
  });

  console.log(`[LFS Policy] Mode: ${mode}`);
  console.log(`[LFS Policy] Protected tracked paths: ${result.protectedTrackedPaths.length}`);

  if (result.legacyProtectedPaths.length > 0) {
    console.log('[LFS Policy] Legacy protected paths still tracked at HEAD:');
    result.legacyProtectedPaths.forEach((filePath) => console.log(`  - ${filePath}`));
  }

  if (result.unexpectedProtectedPaths.length > 0) {
    console.error('[LFS Policy] Unexpected protected paths are tracked by Git LFS:');
    result.unexpectedProtectedPaths.forEach((filePath) => console.error(`  - ${filePath}`));
    process.exit(1);
  }

  if (result.strictViolations.length > 0) {
    console.error('[LFS Policy] Strict mode forbids all protected Git LFS paths:');
    result.strictViolations.forEach((filePath) => console.error(`  - ${filePath}`));
    process.exit(1);
  }

  if (mode === 'unexpected-only' && result.legacyProtectedPaths.length > 0) {
    console.log('[LFS Policy] PASS with legacy exemptions only. No new protected LFS drift detected.');
    process.exit(0);
  }

  console.log('[LFS Policy] PASS. No protected Git LFS paths violate the active policy.');
}

main();
