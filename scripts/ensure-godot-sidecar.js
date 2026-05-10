const path = require('path');
const {
  prepareGodotSidecar,
  resolveGodotBootstrapContext,
  shouldFailOnMissing,
} = require('./tauri-sidecar-utils');

const repoRoot = path.resolve(__dirname, '..');

async function main() {
  const context = resolveGodotBootstrapContext({ repoRoot });
  if (!context) {
    console.log(
      `[Godot] Skipping sidecar preparation: unsupported host platform/arch ${process.platform}/${process.arch}.`
    );
    process.exit(0);
  }

  const result = await prepareGodotSidecar({
    repoRoot,
    logger: console,
  });

  if (result.outcome === 'ready') {
    console.log(`[Godot] Sidecar binary ready: ${result.targetPath}`);
    process.exit(0);
  }

  if (result.outcome === 'prepared') {
    console.log(
      `[Godot] Prepared sidecar binary (${result.sourceKind}) -> ${result.targetPath}`
    );
    if (result.sourceKind === 'download' || result.sourceKind === 'cache') {
      console.log(`[Godot] Cache path: ${result.cachePath}`);
    }
    process.exit(0);
  }

  const strategyLines = [
    `[Godot] Missing usable host binary for ${process.platform}/${process.arch}.`,
    `[Godot] Expected target: ${context.targetPath}`,
    '[Godot] Strategy:',
    '  1) Install a native Godot executable on this host.',
    `  2) Set NOTE_CONNECTION_GODOT_EXE to that executable, or place it at ${context.targetPath}.`,
    '  3) Optionally set NOTE_CONNECTION_GODOT_SEARCH_DIRS for additional lookup directories.',
    `  4) Optional bootstrap download: set NOTE_CONNECTION_GODOT_DOWNLOAD_URL and pin NOTE_CONNECTION_GODOT_DOWNLOAD_SHA256. Cache dir defaults to ${context.cacheDir}.`,
  ];
  strategyLines.forEach((line) => console.warn(line));

  if (shouldFailOnMissing()) {
    process.exit(1);
  }

  console.warn('[Godot] Continuing without a prepared host Godot sidecar binary.');
  process.exit(0);
}

main().catch((error) => {
  console.error(String(error && error.message ? error.message : error));
  process.exit(1);
});
