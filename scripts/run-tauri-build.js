#!/usr/bin/env node

const { spawnSync } = require('child_process');

function extractFrontendBuildMode(argv) {
  const passthroughArgs = [];
  let frontendBuildMode = '';

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--frontend-build-mode') {
      frontendBuildMode = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    passthroughArgs.push(arg);
  }

  return {
    frontendBuildMode,
    passthroughArgs
  };
}

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

function main() {
  const { frontendBuildMode, passthroughArgs } = extractFrontendBuildMode(process.argv.slice(2));
  const cargoBuildJobs = parsePositiveInt(process.env.CARGO_BUILD_JOBS, 1);
  const cargoReleaseOptLevel = String(process.env.CARGO_PROFILE_RELEASE_OPT_LEVEL || '0');
  const cargoReleaseCodegenUnits = parsePositiveInt(
    process.env.CARGO_PROFILE_RELEASE_CODEGEN_UNITS,
    256
  );
  const cargoReleaseDebug = String(process.env.CARGO_PROFILE_RELEASE_DEBUG || '0');
  const cargoReleaseLto = String(process.env.CARGO_PROFILE_RELEASE_LTO || 'off');
  const cargoReleasePanic = String(process.env.CARGO_PROFILE_RELEASE_PANIC || 'abort');
  const cargoIncremental = String(process.env.CARGO_INCREMENTAL || '0');
  const rustflags = buildLowMemoryRustflags(process.env.RUSTFLAGS);

  const tauriArgs = ['tauri', 'build', '--ci', ...passthroughArgs];
  const isWindows = process.platform === 'win32';
  const execCommand = isWindows ? 'cmd.exe' : 'npx';
  const execArgs = isWindows ? ['/d', '/s', '/c', 'npx', ...tauriArgs] : tauriArgs;

  console.log(`[Tauri Build Runner] Cargo jobs: ${cargoBuildJobs}`);
  console.log(`[Tauri Build Runner] Cargo release opt-level: ${cargoReleaseOptLevel}`);
  console.log(`[Tauri Build Runner] Cargo release codegen-units: ${cargoReleaseCodegenUnits}`);
  console.log(`[Tauri Build Runner] Cargo release debug: ${cargoReleaseDebug}`);
  console.log(`[Tauri Build Runner] Cargo release lto: ${cargoReleaseLto}`);
  console.log(`[Tauri Build Runner] Cargo release panic: ${cargoReleasePanic}`);
  console.log(`[Tauri Build Runner] Cargo incremental: ${cargoIncremental}`);
  console.log(`[Tauri Build Runner] RUSTFLAGS: ${rustflags || '(empty)'}`);
  console.log(`[Tauri Build Runner] Frontend build mode: ${frontendBuildMode || 'runtime-first'}`);
  console.log(`[Tauri Build Runner] Executing: npx ${tauriArgs.join(' ')}`);

  const result = spawnSync(execCommand, execArgs, {
    stdio: 'inherit',
    env: {
      ...process.env,
      NOTE_CONNECTION_TAURI_FRONTEND_BUILD_MODE: frontendBuildMode || process.env.NOTE_CONNECTION_TAURI_FRONTEND_BUILD_MODE || '',
      CARGO_BUILD_JOBS: String(cargoBuildJobs),
      CARGO_PROFILE_RELEASE_OPT_LEVEL: cargoReleaseOptLevel,
      CARGO_PROFILE_RELEASE_CODEGEN_UNITS: String(cargoReleaseCodegenUnits),
      CARGO_PROFILE_RELEASE_DEBUG: cargoReleaseDebug,
      CARGO_PROFILE_RELEASE_LTO: cargoReleaseLto,
      CARGO_PROFILE_RELEASE_PANIC: cargoReleasePanic,
      CARGO_INCREMENTAL: cargoIncremental,
      RUSTFLAGS: rustflags
    }
  });

  if (result.error) {
    console.error(`[Tauri Build Runner] Failed to start command: ${result.error.message}`);
  }
  if (result.signal) {
    console.error(`[Tauri Build Runner] Command terminated by signal: ${result.signal}`);
  }

  const statusCode = result.status === null ? 1 : result.status;
  process.exit(statusCode);
}

main();
