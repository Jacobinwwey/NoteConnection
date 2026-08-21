#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  DEFAULT_ASSET_BUDGET_BYTES,
  DEFAULT_MAX_RESIDENT_BYTES,
  assertMobileSlimBudget,
  isForbiddenMobileArtifact,
} = require('./verify-mobile-slim-budget');
const { MOBILE_BUDGET_CONTRACT } = require('./mobile-budget-contract');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SOURCE_DIR = path.join(REPO_ROOT, 'dist', 'src', 'frontend');
const DEFAULT_STAGING_ROOT = path.join(REPO_ROOT, 'dist', 'mobile-slim');
const DEFAULT_STAGING_DIR = path.join(DEFAULT_STAGING_ROOT, 'frontend');
const DEFAULT_MANIFEST_PATH = path.join(DEFAULT_STAGING_ROOT, 'mobile-slim-manifest.json');

const EXCLUDED_SOURCE_PATTERNS = [
  /(^|\/)assets(\/|$)/i,
  /(^|\/)(?:README|User_Manual(?:_zh)?)\.md$/i,
  /(^|\/)(?:data|graph_data)(?:_[^/]+)?\.(?:js|json)$/i,
  /(^|\/)mobile_semantic_comparator\.js$/i,
  /\.map$/i,
];

const EXCLUDED_SCRIPT_SOURCES = [
  'libs/mermaid.min.js',
  'libs/gpu-browser.min.js',
];

function assertGeneratedPath(targetPath) {
  const resolvedTarget = path.resolve(targetPath);
  const generatedRoot = path.resolve(REPO_ROOT, 'dist');
  const relative = path.relative(generatedRoot, resolvedTarget);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Mobile staging target must stay below ${generatedRoot}: ${resolvedTarget}`);
  }
  return resolvedTarget;
}

function toPosixRelative(rootDir, filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, '/');
}

function shouldExcludeSourceAsset(relativePath) {
  const normalized = String(relativePath || '').replace(/\\/g, '/');
  return isForbiddenMobileArtifact(normalized)
    || EXCLUDED_SOURCE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function stripExcludedScriptTags(html) {
  return EXCLUDED_SCRIPT_SOURCES.reduce((current, scriptSource) => {
    const escapedSource = scriptSource.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const scriptPattern = new RegExp(`\\s*<script\\s+src=["']${escapedSource}["']\\s*><\\/script>`, 'gi');
    return current.replace(scriptPattern, '');
  }, html);
}

function collectSourceFiles(sourceDir) {
  const files = [];
  const queue = [sourceDir];
  while (queue.length > 0) {
    const current = queue.shift();
    const entries = fs.readdirSync(current, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(absolutePath);
      } else if (entry.isFile()) {
        files.push(absolutePath);
      }
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function copyMobileAssets(sourceDir, stagingDir) {
  const copiedFiles = [];
  const excludedFiles = [];
  for (const sourcePath of collectSourceFiles(sourceDir)) {
    const relativePath = toPosixRelative(sourceDir, sourcePath);
    if (shouldExcludeSourceAsset(relativePath)) {
      excludedFiles.push(relativePath);
      continue;
    }
    const targetPath = path.join(stagingDir, ...relativePath.split('/'));
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    if (/\.html$/i.test(relativePath)) {
      fs.writeFileSync(targetPath, stripExcludedScriptTags(fs.readFileSync(sourcePath, 'utf8')), 'utf8');
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
    copiedFiles.push(relativePath);
  }
  return { copiedFiles, excludedFiles };
}

function hashStagedFiles(stagingDir, files) {
  const digest = crypto.createHash('sha256');
  files.forEach((relativePath) => {
    digest.update(relativePath);
    digest.update('\0');
    digest.update(fs.readFileSync(path.join(stagingDir, ...relativePath.split('/'))));
    digest.update('\0');
  });
  return digest.digest('hex');
}

function stageMobileSlimAssets(options = {}) {
  const sourceDir = path.resolve(options.sourceDir || DEFAULT_SOURCE_DIR);
  const stagingDir = assertGeneratedPath(options.stagingDir || DEFAULT_STAGING_DIR);
  const manifestPath = assertGeneratedPath(options.manifestPath || DEFAULT_MANIFEST_PATH);
  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
    throw new Error(`Mobile source directory does not exist: ${sourceDir}`);
  }

  const temporaryDir = assertGeneratedPath(`${stagingDir}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`);
  fs.rmSync(temporaryDir, { recursive: true, force: true });
  fs.mkdirSync(temporaryDir, { recursive: true });

  try {
    const copied = copyMobileAssets(sourceDir, temporaryDir);
    const measurement = assertMobileSlimBudget({
      stagingDir: temporaryDir,
      assetBudgetBytes: options.assetBudgetBytes || DEFAULT_ASSET_BUDGET_BYTES,
      maxResidentBytes: options.maxResidentBytes || DEFAULT_MAX_RESIDENT_BYTES,
      rssEvidencePath: options.rssEvidencePath,
    });
    fs.rmSync(stagingDir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(stagingDir), { recursive: true });
    fs.renameSync(temporaryDir, stagingDir);

    const manifest = {
      schemaVersion: 1,
      profile: 'mobile-slim',
      platformTargets: ['capacitor-android', 'tauri-android'],
      capabilities: {
        supportsSidecar: false,
        supportsLocalIngest: true,
        supportsLocalExactQuery: true,
        supportsRemoteInference: true,
        requiresRemoteInference: false,
        supportsSvgArtifacts: false,
        supportsGodotPathmode: false,
      },
      budgets: {
        profile: 'mobile-low',
        assetBudgetBytes: measurement.assetBudgetBytes,
        maxResidentBytes: measurement.maxResidentBytes,
        maxDeviceRamBytes: MOBILE_BUDGET_CONTRACT.profiles['mobile-low'].maxDeviceRamBytes,
        contractSchemaVersion: MOBILE_BUDGET_CONTRACT.schemaVersion,
        contractSha256: MOBILE_BUDGET_CONTRACT.contractSha256,
        runtime: MOBILE_BUDGET_CONTRACT.runtime,
      },
      measurement: {
        fileCount: measurement.fileCount,
        uncompressedBytes: measurement.uncompressedBytes,
        compressedBytes: measurement.compressedBytes,
        peakResidentBytes: measurement.peakResidentBytes,
        rssStatus: measurement.rssStatus,
      },
      contentSha256: hashStagedFiles(stagingDir, copied.copiedFiles),
      includedFiles: copied.copiedFiles,
      excludedFiles: copied.excludedFiles,
    };
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    return manifest;
  } finally {
    fs.rmSync(temporaryDir, { recursive: true, force: true });
  }
}

function main() {
  try {
    const manifest = stageMobileSlimAssets({
      sourceDir: process.env.NOTE_CONNECTION_MOBILE_SOURCE_DIR || DEFAULT_SOURCE_DIR,
      stagingDir: process.env.NOTE_CONNECTION_MOBILE_STAGING_DIR || DEFAULT_STAGING_DIR,
      manifestPath: process.env.NOTE_CONNECTION_MOBILE_MANIFEST_PATH || DEFAULT_MANIFEST_PATH,
      rssEvidencePath: process.env.NOTE_CONNECTION_MOBILE_RSS_EVIDENCE || '',
    });
    console.log(`[Mobile Slim] Staged ${manifest.measurement.fileCount} files.`);
    console.log(`[Mobile Slim] Estimated compressed bytes: ${manifest.measurement.compressedBytes}/${manifest.budgets.assetBudgetBytes}`);
    console.log(`[Mobile Slim] Content SHA256: ${manifest.contentSha256}`);
  } catch (error) {
    console.error(`[Mobile Slim] Preparation failed: ${String(error.message || error)}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  EXCLUDED_SCRIPT_SOURCES,
  EXCLUDED_SOURCE_PATTERNS,
  copyMobileAssets,
  shouldExcludeSourceAsset,
  stageMobileSlimAssets,
  stripExcludedScriptTags,
};
