const fs = require('fs');
const os = require('os');
const path = require('path');

const MIN_GODOT_BINARY_BYTES = 1 * 1024 * 1024;

const HOST_GODOT_BINARY = {
  windows_x64: 'godot-x86_64-pc-windows-msvc.exe',
  linux_x64: 'godot-x86_64-unknown-linux-gnu',
  macos_arm64: 'godot-aarch64-apple-darwin',
  macos_x64: 'godot-x86_64-apple-darwin',
};

function safeStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function hasContent(filePath) {
  const stat = safeStat(filePath);
  return !!stat && stat.isFile() && stat.size > 0;
}

function looksLikeGodotBinary(filePath) {
  const stat = safeStat(filePath);
  return !!stat && stat.isFile() && stat.size >= MIN_GODOT_BINARY_BYTES;
}

function copyFile(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  if (process.platform !== 'win32') {
    fs.chmodSync(target, 0o755);
  }
}

function addCandidate(list, filePath) {
  if (!filePath) return;
  if (!list.includes(filePath)) {
    list.push(filePath);
  }
}

function resolveHostGodotBinaryName() {
  if (process.platform === 'win32' && process.arch === 'x64') {
    return HOST_GODOT_BINARY.windows_x64;
  }
  if (process.platform === 'linux' && process.arch === 'x64') {
    return HOST_GODOT_BINARY.linux_x64;
  }
  if (process.platform === 'darwin' && process.arch === 'arm64') {
    return HOST_GODOT_BINARY.macos_arm64;
  }
  if (process.platform === 'darwin' && process.arch === 'x64') {
    return HOST_GODOT_BINARY.macos_x64;
  }
  return null;
}

function hostBinaryNames() {
  if (process.platform === 'win32') {
    return ['godot.exe', 'godot4.exe', 'Godot_v4.3-stable_win64.exe'];
  }
  if (process.platform === 'darwin') {
    return ['godot', 'godot4', 'Godot'];
  }
  return ['godot', 'godot4'];
}

function addBinariesFromDir(list, dirPath, hostNames) {
  if (!dirPath || !fs.existsSync(dirPath)) return;
  for (const binaryName of hostNames) {
    addCandidate(list, path.join(dirPath, binaryName));
  }

  let entries = [];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    const normalized = entry.name.toLowerCase();
    if (process.platform === 'win32') {
      if (/^godot.*\.exe$/.test(normalized)) {
        addCandidate(list, path.join(dirPath, entry.name));
      }
      continue;
    }

    if (/^godot($|[^a-z0-9].*)/.test(normalized) || /^godot4($|[^a-z0-9].*)/.test(normalized)) {
      addCandidate(list, path.join(dirPath, entry.name));
    }
  }
}

function addKnownMacAppCandidates(list) {
  if (process.platform !== 'darwin') {
    return;
  }
  addCandidate(list, '/Applications/Godot.app/Contents/MacOS/Godot');
  addCandidate(list, '/Applications/Godot_mono.app/Contents/MacOS/Godot');
}

function guessHostSearchDirs() {
  const dirs = [];
  const userHome = os.homedir();

  if (process.platform === 'win32') {
    ['Downloads', 'downloads', 'Desktop', '下载', '网页下载'].forEach((name) => {
      dirs.push(path.join(userHome, name));
    });
    for (let code = 67; code <= 90; code += 1) {
      const drive = String.fromCharCode(code);
      ['Downloads', 'downloads', '下载', '网页下载'].forEach((name) => {
        dirs.push(`${drive}:\\${name}`);
      });
    }
    return dirs;
  }

  dirs.push('/usr/local/bin', '/usr/bin', path.join(userHome, '.local', 'bin'));
  if (process.platform === 'darwin') {
    dirs.push('/opt/homebrew/bin', '/Applications');
  }
  return dirs;
}

function shouldFailOnMissing() {
  if (process.env.NOTE_CONNECTION_GODOT_REQUIRED === '1') {
    return true;
  }
  return process.platform === 'win32';
}

const repoRoot = path.resolve(__dirname, '..');
const sidecarDir = path.join(repoRoot, 'src-tauri', 'bin');
const hostGodotBinaryName = resolveHostGodotBinaryName();

if (!hostGodotBinaryName) {
  console.log(
    `[Godot] Skipping sidecar preparation: unsupported host platform/arch ${process.platform}/${process.arch}.`
  );
  process.exit(0);
}

const targetGodot = path.join(sidecarDir, hostGodotBinaryName);
const envGodot = process.env.NOTE_CONNECTION_GODOT_EXE;

if (looksLikeGodotBinary(targetGodot)) {
  console.log(`[Godot] Sidecar binary ready: ${targetGodot}`);
  process.exit(0);
}

if (hasContent(targetGodot) && !looksLikeGodotBinary(targetGodot)) {
  const size = safeStat(targetGodot)?.size || 0;
  console.warn(`[Godot] Existing sidecar binary looks invalid (${size} bytes): ${targetGodot}`);
}

const candidates = [];
if (envGodot && /_console\.exe$/i.test(envGodot)) {
  addCandidate(candidates, envGodot.replace(/_console\.exe$/i, '.exe'));
}
addCandidate(candidates, envGodot);
addCandidate(candidates, path.join(sidecarDir, hostGodotBinaryName));

const hostNames = hostBinaryNames();
addBinariesFromDir(candidates, sidecarDir, hostNames);

const customSearchDirs = (process.env.NOTE_CONNECTION_GODOT_SEARCH_DIRS || '')
  .split(path.delimiter)
  .map((segment) => segment.trim())
  .filter(Boolean);

for (const dirPath of customSearchDirs) {
  addBinariesFromDir(candidates, dirPath, hostNames);
}

for (const dirPath of guessHostSearchDirs()) {
  addBinariesFromDir(candidates, dirPath, hostNames);
}

addKnownMacAppCandidates(candidates);

const source = candidates.find((candidate) => looksLikeGodotBinary(candidate));
if (!source) {
  const strategyLines = [
    `[Godot] Missing usable host binary for ${process.platform}/${process.arch}.`,
    `[Godot] Expected target: ${targetGodot}`,
    '[Godot] Strategy:',
    '  1) Install a native Godot executable on this host.',
    `  2) Set NOTE_CONNECTION_GODOT_EXE to that executable, or place it at ${targetGodot}.`,
    '  3) Optionally set NOTE_CONNECTION_GODOT_SEARCH_DIRS for additional lookup directories.'
  ];
  strategyLines.forEach((line) => console.warn(line));

  if (shouldFailOnMissing()) {
    process.exit(1);
  }

  console.warn('[Godot] Continuing without a prepared host Godot sidecar binary.');
  process.exit(0);
}

copyFile(source, targetGodot);
if (!looksLikeGodotBinary(targetGodot)) {
  console.error(`[Godot] Failed to prepare a valid sidecar binary: ${targetGodot}`);
  process.exit(1);
}

console.log(`[Godot] Prepared sidecar binary: ${targetGodot}`);
