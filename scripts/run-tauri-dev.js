#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function appendRustflag(existingRustflags, flag) {
  const base = String(existingRustflags || '').trim();
  if (base.includes(flag)) {
    return base;
  }
  return `${base} ${flag}`.trim();
}

function buildLowMemoryRustflags(existingRustflags) {
  let rustflags = String(existingRustflags || '').trim();
  rustflags = appendRustflag(rustflags, '-C debuginfo=0');
  return rustflags;
}

function resolveDefaultTargetDir() {
  return path.resolve(__dirname, '..', 'src-tauri', 'target-dev-lowmem');
}

function main() {
  const cargoTargetDir = String(process.env.CARGO_TARGET_DIR || '').trim() || resolveDefaultTargetDir();
  const cargoBuildJobs = parsePositiveInt(process.env.CARGO_BUILD_JOBS, 1);
  const cargoIncremental = String(process.env.CARGO_INCREMENTAL || '0');
  const cargoProfileDevDebug = String(process.env.CARGO_PROFILE_DEV_DEBUG || '0');
  const rustflags = buildLowMemoryRustflags(process.env.RUSTFLAGS);
  const isWindows = process.platform === 'win32';
  const tauriArgs = ['tauri', 'dev', ...process.argv.slice(2)];
  const execCommand = isWindows ? 'cmd.exe' : 'npx';
  const execArgs = isWindows ? ['/d', '/s', '/c', 'npx', ...tauriArgs] : tauriArgs;

  console.log(`[Tauri Dev Runner] Cargo target dir: ${cargoTargetDir}`);
  console.log(`[Tauri Dev Runner] Cargo jobs: ${cargoBuildJobs}`);
  console.log(`[Tauri Dev Runner] Cargo incremental: ${cargoIncremental}`);
  console.log(`[Tauri Dev Runner] Cargo dev debug: ${cargoProfileDevDebug}`);
  console.log(`[Tauri Dev Runner] RUSTFLAGS: ${rustflags || '(empty)'}`);
  console.log(`[Tauri Dev Runner] Executing: npx ${tauriArgs.join(' ')}`);

  const result = spawnSync(execCommand, execArgs, {
    stdio: 'inherit',
    env: {
      ...process.env,
      CARGO_TARGET_DIR: cargoTargetDir,
      CARGO_BUILD_JOBS: String(cargoBuildJobs),
      CARGO_INCREMENTAL: cargoIncremental,
      CARGO_PROFILE_DEV_DEBUG: cargoProfileDevDebug,
      RUSTFLAGS: rustflags,
    }
  });

  if (result.error) {
    console.error(`[Tauri Dev Runner] Failed to start command: ${result.error.message}`);
  }
  if (result.signal) {
    console.error(`[Tauri Dev Runner] Command terminated by signal: ${result.signal}`);
  }

  process.exit(result.status === null ? 1 : result.status);
}

main();
