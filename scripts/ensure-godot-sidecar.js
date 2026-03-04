const fs = require('fs');
const os = require('os');
const path = require('path');

const MIN_GODOT_BINARY_BYTES = 1 * 1024 * 1024;

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
}

function addCandidate(list, filePath) {
  if (!filePath) return;
  if (!list.includes(filePath)) {
    list.push(filePath);
  }
}

function addGodotBinariesFromDir(list, dirPath) {
  if (!dirPath || !fs.existsSync(dirPath)) return;
  let entries = [];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  const files = entries
    .filter((entry) => entry.isFile() && /^godot.*\.exe$/i.test(entry.name))
    .map((entry) => path.join(dirPath, entry.name))
    .sort((a, b) => {
      const aName = path.basename(a).toLowerCase();
      const bName = path.basename(b).toLowerCase();
      const aConsole = aName.includes('console');
      const bConsole = bName.includes('console');
      if (aConsole !== bConsole) {
        return aConsole ? 1 : -1;
      }
      return aName.localeCompare(bName);
    });

  for (const file of files) {
    addCandidate(list, file);
  }
}

function guessWindowsGodotDirs() {
  if (process.platform !== 'win32') {
    return [];
  }

  const dirs = [];
  const userHome = os.homedir();
  ['Downloads', 'downloads', 'Desktop', '下载', '网页下载'].forEach((name) => {
    dirs.push(path.join(userHome, name));
  });

  // Try drive root download folders (for setups where downloads are moved to D:/E:).
  const rootNames = ['Downloads', 'downloads', '下载', '网页下载'];
  for (let code = 67; code <= 90; code += 1) { // C..Z
    const drive = String.fromCharCode(code);
    rootNames.forEach((name) => {
      dirs.push(`${drive}:\\${name}`);
    });
  }

  return dirs;
}

const repoRoot = path.resolve(__dirname, '..');
const sidecarDir = path.join(repoRoot, 'src-tauri', 'bin');
const targetGodot = path.join(sidecarDir, 'godot-x86_64-pc-windows-msvc.exe');
const localGodot = path.join(sidecarDir, 'godot.exe');
const envGodot = process.env.NOTE_CONNECTION_GODOT_EXE;

if (looksLikeGodotBinary(targetGodot)) {
  console.log(`[Godot] Sidecar binary ready: ${targetGodot}`);
  process.exit(0);
}

if (hasContent(targetGodot) && !looksLikeGodotBinary(targetGodot)) {
  const size = safeStat(targetGodot)?.size || 0;
  console.warn(
    `[Godot] Existing sidecar binary looks invalid (${size} bytes): ${targetGodot}`
  );
}

const candidates = [];
if (envGodot && /_console\.exe$/i.test(envGodot)) {
  addCandidate(candidates, envGodot.replace(/_console\.exe$/i, '.exe'));
}
addCandidate(candidates, envGodot);
addCandidate(candidates, localGodot);
addGodotBinariesFromDir(candidates, sidecarDir);

const customSearchDirs = (process.env.NOTE_CONNECTION_GODOT_SEARCH_DIRS || '')
  .split(path.delimiter)
  .map((segment) => segment.trim())
  .filter(Boolean);

customSearchDirs.forEach((dirPath) => addGodotBinariesFromDir(candidates, dirPath));
guessWindowsGodotDirs().forEach((dirPath) => addGodotBinariesFromDir(candidates, dirPath));

const source = candidates.find((candidate) => looksLikeGodotBinary(candidate));

if (!source) {
  console.error('[Godot] Missing usable Godot binary for Tauri sidecar.');
  console.error(
    `[Godot] The sidecar target must be a real Godot executable (>= ${MIN_GODOT_BINARY_BYTES} bytes).`
  );
  console.error('[Godot] Provide NOTE_CONNECTION_GODOT_EXE, NOTE_CONNECTION_GODOT_SEARCH_DIRS, or place a non-wrapper godot.exe in src-tauri/bin.');
  process.exit(1);
}

copyFile(source, targetGodot);
if (!looksLikeGodotBinary(targetGodot)) {
  console.error(`[Godot] Failed to prepare a valid sidecar binary: ${targetGodot}`);
  process.exit(1);
}

console.log(`[Godot] Prepared sidecar binary: ${targetGodot}`);
