#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MANIFEST_FILENAME = '.noteconnection-sidecar-build-manifest.json';
const MANIFEST_SCHEMA_VERSION = 1;

function manifestPath(repoRoot) {
  return path.join(path.resolve(repoRoot), 'src-tauri', 'bin', MANIFEST_FILENAME);
}

function collectFiles(rootPath, relativeRoot, files) {
  if (!fs.existsSync(rootPath)) {
    return;
  }

  const entries = fs.readdirSync(rootPath, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const absolutePath = path.join(rootPath, entry.name);
    const relativePath = path.join(relativeRoot, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      collectFiles(absolutePath, relativePath, files);
    } else if (entry.isFile()) {
      files.push({ absolutePath, relativePath });
    }
  }
}

function resolveInputFiles(repoRoot) {
  const root = path.resolve(repoRoot);
  const files = [];
  const fixedInputs = [
    'package.json',
    'package-lock.json',
    'npm-shrinkwrap.json',
    'tsconfig.json',
    path.join('scripts', 'build-sidecar.js'),
    path.join('scripts', 'build-markdown-worker.js'),
    path.join('scripts', 'sidecar-build-fingerprint.js'),
  ];

  fixedInputs.forEach((relativePath) => {
    const absolutePath = path.join(root, relativePath);
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
      files.push({
        absolutePath,
        relativePath: relativePath.replace(/\\/g, '/'),
      });
    }
  });

  collectFiles(path.join(root, 'dist', 'src'), path.join('dist', 'src'), files);
  files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  return files;
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function computeSidecarInputFingerprint(repoRoot) {
  const files = resolveInputFiles(repoRoot).map(({ absolutePath, relativePath }) => {
    const stat = fs.statSync(absolutePath);
    return {
      path: relativePath,
      size: stat.size,
      sha256: sha256File(absolutePath),
    };
  });
  const digest = crypto.createHash('sha256');
  files.forEach((file) => {
    digest.update(`${file.path}\0${file.size}\0${file.sha256}\n`, 'utf8');
  });
  return {
    algorithm: 'sha256',
    digest: digest.digest('hex'),
    files,
  };
}

function writeSidecarBuildManifest(repoRoot, targets) {
  const payload = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    targets: Array.from(new Set((Array.isArray(targets) ? targets : []).map((target) => String(target))))
      .sort(),
    fingerprint: computeSidecarInputFingerprint(repoRoot),
  };
  const outputPath = manifestPath(repoRoot);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

function readSidecarBuildManifest(repoRoot) {
  const filePath = manifestPath(repoRoot);
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function isSidecarBuildManifestCurrent(repoRoot) {
  const manifest = readSidecarBuildManifest(repoRoot);
  if (
    !manifest
    || manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION
    || !manifest.fingerprint
    || typeof manifest.fingerprint.digest !== 'string'
  ) {
    return false;
  }
  return manifest.fingerprint.digest === computeSidecarInputFingerprint(repoRoot).digest;
}

module.exports = {
  MANIFEST_FILENAME,
  computeSidecarInputFingerprint,
  isSidecarBuildManifestCurrent,
  manifestPath,
  readSidecarBuildManifest,
  writeSidecarBuildManifest,
};
