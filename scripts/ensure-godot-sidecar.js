const fs = require('fs');
const path = require('path');

function hasContent(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile() && fs.statSync(filePath).size > 0;
  } catch {
    return false;
  }
}

function copyFile(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

const repoRoot = path.resolve(__dirname, '..');
const sidecarDir = path.join(repoRoot, 'src-tauri', 'bin');
const targetGodot = path.join(sidecarDir, 'godot-x86_64-pc-windows-msvc.exe');
const localGodot = path.join(sidecarDir, 'godot.exe');
const envGodot = process.env.NOTE_CONNECTION_GODOT_EXE;

if (hasContent(targetGodot)) {
  console.log(`[Godot] Sidecar binary ready: ${targetGodot}`);
  process.exit(0);
}

const candidates = [envGodot, localGodot].filter(Boolean);
const source = candidates.find((candidate) => hasContent(candidate));

if (!source) {
  console.error('[Godot] Missing usable Godot binary for Tauri sidecar.');
  console.error('[Godot] Provide NOTE_CONNECTION_GODOT_EXE or place a non-empty godot.exe in src-tauri/bin.');
  process.exit(1);
}

copyFile(source, targetGodot);
if (!hasContent(targetGodot)) {
  console.error(`[Godot] Failed to prepare sidecar binary: ${targetGodot}`);
  process.exit(1);
}

console.log(`[Godot] Prepared sidecar binary: ${targetGodot}`);
