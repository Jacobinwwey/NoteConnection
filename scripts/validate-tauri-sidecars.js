const fs = require('fs');
const path = require('path');

const MIN_GODOT_BINARY_BYTES = 1 * 1024 * 1024;
const SERVER_BINARIES = {
  windows_x64: 'server-x86_64-pc-windows-msvc.exe',
  linux_x64: 'server-x86_64-unknown-linux-gnu',
  macos_arm64: 'server-aarch64-apple-darwin',
  macos_x64: 'server-x86_64-apple-darwin',
};

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

function resolveHostServerBinaryName() {
  if (process.platform === 'win32' && process.arch === 'x64') {
    return SERVER_BINARIES.windows_x64;
  }
  if (process.platform === 'linux' && process.arch === 'x64') {
    return SERVER_BINARIES.linux_x64;
  }
  if (process.platform === 'darwin' && process.arch === 'arm64') {
    return SERVER_BINARIES.macos_arm64;
  }
  if (process.platform === 'darwin' && process.arch === 'x64') {
    return SERVER_BINARIES.macos_x64;
  }
  return null;
}

const repoRoot = path.resolve(__dirname, '..');
const binDir = path.join(repoRoot, 'src-tauri', 'bin');
const godotBinary = path.join(binDir, 'godot-x86_64-pc-windows-msvc.exe');
const args = new Set(process.argv.slice(2));
const validateAll = args.has('--all');

const requiredServerBinaryNames = validateAll
  ? [SERVER_BINARIES.windows_x64, SERVER_BINARIES.linux_x64, SERVER_BINARIES.macos_arm64]
  : [resolveHostServerBinaryName()].filter(Boolean);

if (!requiredServerBinaryNames.length) {
  console.error(
    `[Tauri Bin Validation] Unsupported host platform/arch for host validation: ${process.platform}/${process.arch}`
  );
  process.exit(1);
}

const invalid = [];
for (const binaryName of requiredServerBinaryNames) {
  const serverBinary = path.join(binDir, binaryName);
  if (!isNonEmptyBinary(serverBinary)) {
    invalid.push(`${serverBinary} (missing or empty)`);
  }
}

if (process.platform === 'win32' && !isValidGodotBinary(godotBinary)) {
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
