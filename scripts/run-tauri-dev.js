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

function appendBrowserArgument(existingArgs, nextArg) {
  const base = String(existingArgs || '').trim();
  if (!nextArg) {
    return base;
  }
  if (base.includes(nextArg)) {
    return base;
  }
  return `${base} ${nextArg}`.trim();
}

function resolveWebView2DebugPort() {
  const envPort = parsePositiveInt(process.env.NOTE_CONNECTION_WEBVIEW2_DEBUG_PORT, 1665);
  return envPort;
}

function buildWebView2AdditionalBrowserArguments() {
  const port = resolveWebView2DebugPort();
  let args = String(process.env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS || '').trim();
  args = appendBrowserArgument(args, `--remote-debugging-port=${port}`);
  args = appendBrowserArgument(args, '--remote-allow-origins=*');
  return { port, args };
}

function resolveDefaultTargetDir() {
  const explicitMode = String(process.env.NOTE_CONNECTION_TAURI_TARGET_MODE || '').trim().toLowerCase();
  const baseTargetDir = path.resolve(__dirname, '..', 'src-tauri', 'target-dev-lowmem');
  if (explicitMode === 'session' || explicitMode === 'ephemeral' || explicitMode === 'isolated') {
    const sessionToken = [
      process.pid,
      Date.now().toString(36),
    ].join('-');
    return `${baseTargetDir}-${sessionToken}`;
  }

  return baseTargetDir;
}

function describeTargetDirMode(targetDir) {
  const stableDir = path.resolve(__dirname, '..', 'src-tauri', 'target-dev-lowmem');
  if (path.resolve(targetDir) === stableDir) {
    return 'stable';
  }
  const sessionToken = [
    'ephemeral',
    process.pid,
  ].join(':');
  return sessionToken;
}

function main() {
  const cargoTargetDir = String(process.env.CARGO_TARGET_DIR || '').trim() || resolveDefaultTargetDir();
  const cargoBuildJobs = parsePositiveInt(process.env.CARGO_BUILD_JOBS, 1);
  const cargoIncremental = String(process.env.CARGO_INCREMENTAL || '0');
  const cargoProfileDevDebug = String(process.env.CARGO_PROFILE_DEV_DEBUG || '0');
  const rustflags = buildLowMemoryRustflags(process.env.RUSTFLAGS);
  const webview2Debug = buildWebView2AdditionalBrowserArguments();
  const isWindows = process.platform === 'win32';
  const tauriArgs = ['tauri', 'dev', ...process.argv.slice(2)];
  const execCommand = isWindows ? 'cmd.exe' : 'npx';
  const execArgs = isWindows ? ['/d', '/s', '/c', 'npx', ...tauriArgs] : tauriArgs;

  console.log(`[Tauri Dev Runner] Cargo target dir: ${cargoTargetDir}`);
  console.log(`[Tauri Dev Runner] Cargo target dir mode: ${describeTargetDirMode(cargoTargetDir)}`);
  console.log(`[Tauri Dev Runner] Cargo jobs: ${cargoBuildJobs}`);
  console.log(`[Tauri Dev Runner] Cargo incremental: ${cargoIncremental}`);
  console.log(`[Tauri Dev Runner] Cargo dev debug: ${cargoProfileDevDebug}`);
  console.log(`[Tauri Dev Runner] RUSTFLAGS: ${rustflags || '(empty)'}`);
  console.log(`[Tauri Dev Runner] WebView2 debug port: ${webview2Debug.port}`);
  console.log(`[Tauri Dev Runner] WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: ${webview2Debug.args || '(empty)'}`);
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
      NOTE_CONNECTION_WEBVIEW2_DEBUG_PORT: String(webview2Debug.port),
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: webview2Debug.args,
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
