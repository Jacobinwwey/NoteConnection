const PROTECTED_LFS_ROOTS = ['src/frontend/', 'src-tauri/bin/'];

const LEGACY_ALLOWED_PROTECTED_LFS_PATHS = [
  'src-tauri/bin/godot-x86_64-pc-windows-msvc.exe',
  'src-tauri/bin/server-aarch64-apple-darwin',
  'src-tauri/bin/server-x86_64-pc-windows-msvc.exe',
  'src-tauri/bin/server-x86_64-unknown-linux-gnu',
];

function normalizeRepoPath(filePath) {
  return String(filePath || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
}

function sortUnique(values) {
  return [...new Set(values.map(normalizeRepoPath).filter(Boolean))].sort();
}

function isProtectedLfsPath(filePath) {
  const normalized = normalizeRepoPath(filePath);
  return PROTECTED_LFS_ROOTS.some((root) => normalized.startsWith(root));
}

function parseLfsTrackedPathsFromGitattributes(text) {
  const tracked = [];
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('filter=lfs')) {
      continue;
    }
    const [pattern] = line.split(/\s+/, 1);
    if (pattern) {
      tracked.push(pattern);
    }
  }
  return sortUnique(tracked);
}

function parseLfsLsFilesOutput(text) {
  const tracked = [];
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    const delimiter = line.match(/\s[-*]\s/);
    if (!delimiter || typeof delimiter.index !== 'number') {
      continue;
    }
    tracked.push(line.slice(delimiter.index + delimiter[0].length));
  }
  return sortUnique(tracked);
}

function evaluateLfsAssetPolicy(options = {}) {
  const mode = options.mode === 'strict' ? 'strict' : 'unexpected-only';
  const allowlist = new Set(LEGACY_ALLOWED_PROTECTED_LFS_PATHS.map(normalizeRepoPath));
  const gitattributesPaths = parseLfsTrackedPathsFromGitattributes(options.gitattributesText);
  const existingRepoPaths = Array.isArray(options.existingRepoPaths)
    ? new Set(options.existingRepoPaths.map(normalizeRepoPath))
    : null;
  const lfsLsFilesPaths = parseLfsLsFilesOutput(options.lfsLsFilesText).filter((filePath) => {
    if (!existingRepoPaths) {
      return true;
    }
    return existingRepoPaths.has(filePath);
  });
  const protectedTrackedPaths = sortUnique([
    ...gitattributesPaths,
    ...lfsLsFilesPaths,
  ]).filter(isProtectedLfsPath);

  const unexpectedProtectedPaths = protectedTrackedPaths.filter((filePath) => !allowlist.has(filePath));
  const legacyProtectedPaths = protectedTrackedPaths.filter((filePath) => allowlist.has(filePath));
  const strictViolations = mode === 'strict' ? protectedTrackedPaths : [];

  return {
    protectedTrackedPaths,
    unexpectedProtectedPaths,
    legacyProtectedPaths,
    strictViolations,
  };
}

module.exports = {
  PROTECTED_LFS_ROOTS,
  LEGACY_ALLOWED_PROTECTED_LFS_PATHS,
  normalizeRepoPath,
  isProtectedLfsPath,
  parseLfsTrackedPathsFromGitattributes,
  parseLfsLsFilesOutput,
  evaluateLfsAssetPolicy,
};
