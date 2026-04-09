const path = require('path');
const {
  validateTauriSidecars,
} = require('./tauri-sidecar-utils');

const repoRoot = path.resolve(__dirname, '..');
const args = new Set(process.argv.slice(2));
const validateAll = args.has('--all');
const validation = validateTauriSidecars({ repoRoot, validateAll });
const invalid = validation.invalid;

if (invalid.length > 0) {
  console.error('[Tauri Bin Validation] Missing or invalid binaries:');
  invalid.forEach((binary) => console.error(`  - ${binary}`));
  process.exit(1);
}

console.log('[Tauri Bin Validation] All required sidecar binaries are present and valid.');
