#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DEFAULT_ASSET_BUDGET_BYTES = 25 * 1024 * 1024;
const DEFAULT_MAX_RESIDENT_BYTES = 256 * 1024 * 1024;
const DEFAULT_STAGING_DIR = path.resolve(__dirname, '..', 'dist', 'mobile-slim', 'frontend');
const ZIP_ENTRY_OVERHEAD_BYTES = 46;

const FORBIDDEN_MOBILE_PATTERNS = [
  /(^|\/)(server|godot|markdown-worker)(?:[-.]|$)/i,
  /(^|\/)libs\/(?:mermaid\.min\.js|gpu-browser\.min\.js)$/i,
  /(^|\/)(?:models?|weights?)(\/|$)/i,
  /\.(?:dll|dylib|exe|gguf|onnx|pck|so|svg)$/i,
];

function toPosixRelative(rootDir, filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, '/');
}

function listFiles(rootDir) {
  const resolvedRoot = path.resolve(rootDir);
  if (!fs.existsSync(resolvedRoot) || !fs.statSync(resolvedRoot).isDirectory()) {
    throw new Error(`Mobile staging directory does not exist: ${resolvedRoot}`);
  }

  const files = [];
  const queue = [resolvedRoot];
  while (queue.length > 0) {
    const current = queue.shift();
    const entries = fs.readdirSync(current, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Mobile staging must not contain symbolic links: ${toPosixRelative(resolvedRoot, absolutePath)}`);
      }
      if (entry.isDirectory()) {
        queue.push(absolutePath);
      } else if (entry.isFile()) {
        files.push(absolutePath);
      }
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function isForbiddenMobileArtifact(relativePath) {
  const normalized = String(relativePath || '').replace(/\\/g, '/');
  return FORBIDDEN_MOBILE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function measureMobileSlimDirectory(stagingDir) {
  const resolvedRoot = path.resolve(stagingDir);
  const files = listFiles(resolvedRoot).map((absolutePath) => {
    const relativePath = toPosixRelative(resolvedRoot, absolutePath);
    const content = fs.readFileSync(absolutePath);
    const compressedContentBytes = zlib.deflateRawSync(content, { level: 9 }).length;
    return {
      path: relativePath,
      bytes: content.length,
      compressedBytes: compressedContentBytes + ZIP_ENTRY_OVERHEAD_BYTES + Buffer.byteLength(relativePath),
      forbidden: isForbiddenMobileArtifact(relativePath),
    };
  });

  const largestFiles = [...files]
    .sort((left, right) => right.compressedBytes - left.compressedBytes || left.path.localeCompare(right.path))
    .slice(0, 20);

  return {
    stagingDir: resolvedRoot,
    fileCount: files.length,
    uncompressedBytes: files.reduce((total, file) => total + file.bytes, 0),
    compressedBytes: files.reduce((total, file) => total + file.compressedBytes, 0),
    forbiddenFiles: files.filter((file) => file.forbidden).map((file) => file.path),
    largestFiles,
  };
}

function readPeakResidentBytes(rssEvidencePath) {
  if (!rssEvidencePath) {
    return null;
  }
  const resolvedPath = path.resolve(rssEvidencePath);
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  } catch (error) {
    throw new Error(`Mobile RSS evidence is unreadable: ${resolvedPath}: ${String(error.message || error)}`);
  }
  const peakResidentBytes = Number(payload && payload.peakResidentBytes);
  if (!Number.isFinite(peakResidentBytes) || peakResidentBytes < 0) {
    throw new Error(`Mobile RSS evidence must contain a non-negative peakResidentBytes value: ${resolvedPath}`);
  }
  return peakResidentBytes;
}

function assertMobileSlimBudget(options) {
  const stagingDir = options && options.stagingDir ? options.stagingDir : DEFAULT_STAGING_DIR;
  const assetBudgetBytes = Number(options && options.assetBudgetBytes) || DEFAULT_ASSET_BUDGET_BYTES;
  const maxResidentBytes = Number(options && options.maxResidentBytes) || DEFAULT_MAX_RESIDENT_BYTES;
  const measurement = measureMobileSlimDirectory(stagingDir);

  if (measurement.forbiddenFiles.length > 0) {
    throw new Error(
      `Forbidden mobile artifact detected:\n${measurement.forbiddenFiles.map((file) => `  - ${file}`).join('\n')}`
    );
  }
  if (measurement.compressedBytes > assetBudgetBytes) {
    throw new Error(
      `Mobile compressed payload exceeds budget: ${measurement.compressedBytes}/${assetBudgetBytes} bytes.`
    );
  }

  const peakResidentBytes = readPeakResidentBytes(options && options.rssEvidencePath);
  if (peakResidentBytes !== null && peakResidentBytes > maxResidentBytes) {
    throw new Error(`Mobile peak RSS exceeds budget: ${peakResidentBytes}/${maxResidentBytes} bytes.`);
  }

  return {
    ...measurement,
    assetBudgetBytes,
    maxResidentBytes,
    peakResidentBytes,
    rssStatus: peakResidentBytes === null ? 'not-measured' : 'within-budget',
  };
}

function readOption(args, name) {
  const optionIndex = args.indexOf(name);
  return optionIndex >= 0 ? args[optionIndex + 1] : '';
}

function main() {
  const args = process.argv.slice(2);
  const stagingDir = readOption(args, '--staging-dir')
    || process.env.NOTE_CONNECTION_MOBILE_STAGING_DIR
    || DEFAULT_STAGING_DIR;
  const rssEvidencePath = readOption(args, '--rss-evidence')
    || process.env.NOTE_CONNECTION_MOBILE_RSS_EVIDENCE
    || '';
  const assetBudgetBytes = Number(readOption(args, '--asset-budget-bytes'))
    || DEFAULT_ASSET_BUDGET_BYTES;
  const maxResidentBytes = Number(readOption(args, '--max-resident-bytes'))
    || DEFAULT_MAX_RESIDENT_BYTES;

  try {
    const result = assertMobileSlimBudget({
      stagingDir,
      assetBudgetBytes,
      maxResidentBytes,
      rssEvidencePath,
    });
    console.log(`[Mobile Slim] Files: ${result.fileCount}`);
    console.log(`[Mobile Slim] Uncompressed bytes: ${result.uncompressedBytes}`);
    console.log(`[Mobile Slim] Estimated compressed bytes: ${result.compressedBytes}/${result.assetBudgetBytes}`);
    console.log(`[Mobile Slim] Peak RSS: ${result.peakResidentBytes === null ? 'not measured' : `${result.peakResidentBytes}/${result.maxResidentBytes}`}`);
    console.log('[Mobile Slim] Largest compressed entries:');
    result.largestFiles.slice(0, 10).forEach((file) => {
      console.log(`  - ${file.path}: ${file.compressedBytes} bytes`);
    });
  } catch (error) {
    console.error(`[Mobile Slim] FAIL: ${String(error.message || error)}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  DEFAULT_ASSET_BUDGET_BYTES,
  DEFAULT_MAX_RESIDENT_BYTES,
  FORBIDDEN_MOBILE_PATTERNS,
  assertMobileSlimBudget,
  isForbiddenMobileArtifact,
  measureMobileSlimDirectory,
  readPeakResidentBytes,
};
