const fs = require('fs');
const path = require('path');

const MIN_GODOT_BINARY_BYTES = 1 * 1024 * 1024;

function binarySize(filePath) {
  try {
    if (!fs.existsSync(filePath)) return 0;
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return 0;
    return stat.size;
  } catch {
    return 0;
  }
}

function isNonEmptyBinary(filePath) {
  return binarySize(filePath) > 0;
}

function isValidGodotBinary(filePath) {
  try {
    return binarySize(filePath) >= MIN_GODOT_BINARY_BYTES;
  } catch {
    return false;
  }
}

const repoRoot = path.resolve(__dirname, '..');
const binDir = path.join(repoRoot, 'src-tauri', 'bin');
const serverBinary = path.join(binDir, 'server-x86_64-pc-windows-msvc.exe');
const godotBinary = path.join(binDir, 'godot-x86_64-pc-windows-msvc.exe');

const invalid = [];
if (!isNonEmptyBinary(serverBinary)) {
  invalid.push(`${serverBinary} (missing or empty)`);
}
if (!isValidGodotBinary(godotBinary)) {
  invalid.push(
    `${godotBinary} (missing/too small; expected >= ${MIN_GODOT_BINARY_BYTES} bytes, actual ${binarySize(godotBinary)} bytes)`
  );
}

if (invalid.length > 0) {
  console.error('[Tauri Bin Validation] Missing or invalid binaries:');
  invalid.forEach((binary) => console.error(`  - ${binary}`));
  process.exit(1);
}

console.log('[Tauri Bin Validation] All required sidecar binaries are present and valid.');
