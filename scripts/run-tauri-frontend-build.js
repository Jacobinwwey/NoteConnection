#!/usr/bin/env node

const { spawnSync } = require('child_process');

function resolveFrontendBuildCommand(options = {}) {
  const frontendBuildMode = String(options.frontendBuildMode || '').trim().toLowerCase();

  if (!frontendBuildMode || frontendBuildMode === 'runtime-first' || frontendBuildMode === 'mini') {
    return 'npm run build';
  }

  if (frontendBuildMode === 'full') {
    return 'npm run build:full';
  }

  throw new Error(
    `Unsupported tauri frontend build mode: ${options.frontendBuildMode}`
  );
}

function main() {
  const command = resolveFrontendBuildCommand({
    frontendBuildMode: process.env.NOTE_CONNECTION_TAURI_FRONTEND_BUILD_MODE
  });

  const isWindows = process.platform === 'win32';
  const execCommand = isWindows ? 'cmd.exe' : 'npm';
  const execArgs = isWindows
    ? ['/d', '/s', '/c', command]
    : command.replace(/^npm\s+/, '').split(/\s+/);

  console.log(`[Tauri Frontend Build] Mode: ${process.env.NOTE_CONNECTION_TAURI_FRONTEND_BUILD_MODE || 'runtime-first'}`);
  console.log(`[Tauri Frontend Build] Executing: ${command}`);

  const result = spawnSync(execCommand, execArgs, {
    stdio: 'inherit',
    env: process.env
  });

  if (result.error) {
    console.error(`[Tauri Frontend Build] Failed to start command: ${result.error.message}`);
  }
  if (result.signal) {
    console.error(`[Tauri Frontend Build] Command terminated by signal: ${result.signal}`);
  }

  const statusCode = result.status === null ? 1 : result.status;
  process.exit(statusCode);
}

if (require.main === module) {
  main();
}

module.exports = {
  resolveFrontendBuildCommand
};
