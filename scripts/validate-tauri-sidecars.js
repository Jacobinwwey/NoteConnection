const fs = require('fs');
const path = require('path');

function isValidBinary(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile() && fs.statSync(filePath).size > 0;
  } catch {
    return false;
  }
}

const repoRoot = path.resolve(__dirname, '..');
const binDir = path.join(repoRoot, 'src-tauri', 'bin');
const requiredBinaries = [
  path.join(binDir, 'server-x86_64-pc-windows-msvc.exe'),
  path.join(binDir, 'godot-x86_64-pc-windows-msvc.exe')
];

const invalid = requiredBinaries.filter((binary) => !isValidBinary(binary));

if (invalid.length > 0) {
  console.error('[Tauri Bin Validation] Missing or invalid binaries:');
  invalid.forEach((binary) => console.error(`  - ${binary}`));
  process.exit(1);
}

console.log('[Tauri Bin Validation] All required sidecar binaries are present and non-empty.');
