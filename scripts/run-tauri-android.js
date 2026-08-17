const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

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

function existsDir(targetPath) {
  try {
    return fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

function detectAndroidSdkRoot() {
  const explicit = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (explicit) {
    return explicit;
  }

  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk');
  }

  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) {
    return path.join(home, 'Android', 'Sdk');
  }

  return '';
}

function detectLatestNdk(sdkRoot) {
  const ndkRoot = path.join(sdkRoot, 'ndk');
  if (!existsDir(ndkRoot)) {
    return '';
  }

  const versions = fs
    .readdirSync(ndkRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (versions.length === 0) {
    return '';
  }

  return path.join(ndkRoot, versions[versions.length - 1]);
}

function resolveAndroidTarget(mode, cliTarget) {
  const explicitTarget = (cliTarget || process.env.NOTE_CONNECTION_TAURI_ANDROID_TARGET || '').trim();
  if (explicitTarget) {
    if (['default', 'universal', 'all'].includes(explicitTarget.toLowerCase())) {
      return '';
    }
    return explicitTarget;
  }

  // Default to arm64 to avoid OOM failures from universal/armv7 release builds on Windows hosts.
  if (mode === 'build' || mode === 'dev') {
    return 'aarch64';
  }

  return '';
}

function runPathmodePatch({ mode, allowMissing }) {
  const patchScript = path.join(__dirname, 'apply-tauri-android-pathmode.js');
  const args = [patchScript];
  if (mode === 'disable') {
    args.push('--disable');
  }
  if (allowMissing) {
    args.push('--allow-missing');
  }

  const patchResult = spawnSync(process.execPath, args, {
    stdio: 'inherit',
    env: process.env
  });

  return patchResult.status === 0;
}

function syncPathmodeIntegration({ includeGodotPathmode, allowMissing }) {
  if (includeGodotPathmode) {
    return runPathmodePatch({ mode: 'enable', allowMissing });
  }
  return runPathmodePatch({ mode: 'disable', allowMissing });
}

function spawnTauriCommand(tauriArgs, envOverrides) {
  const isWindows = process.platform === 'win32';
  const execCommand = isWindows ? 'cmd.exe' : 'npx';
  const execArgs = isWindows ? ['/d', '/s', '/c', 'npx', ...tauriArgs] : tauriArgs;

  return spawnSync(execCommand, execArgs, {
    stdio: 'inherit',
    env: envOverrides
  });
}

function ensureAndroidProjectScaffold(envOverrides) {
  const androidAppDir = path.resolve(__dirname, '..', 'src-tauri', 'gen', 'android', 'app');
  if (existsDir(androidAppDir)) {
    return true;
  }

  console.log('[Tauri Android Runner] Android scaffold is missing. Bootstrapping with: npx tauri android init --ci');
  const initResult = spawnTauriCommand(['tauri', 'android', 'init', '--ci'], envOverrides);

  if (initResult.error) {
    console.error(`[Tauri Android Runner] Failed to start android init: ${initResult.error.message}`);
    return false;
  }
  if (initResult.signal) {
    console.error(`[Tauri Android Runner] Android init terminated by signal: ${initResult.signal}`);
    return false;
  }

  const initStatus = initResult.status === null ? 1 : initResult.status;
  if (initStatus !== 0) {
    console.error(`[Tauri Android Runner] Android init failed with status ${initStatus}.`);
    return false;
  }

  if (!existsDir(androidAppDir)) {
    console.error(`[Tauri Android Runner] Android init completed but scaffold is still missing: ${androidAppDir}`);
    return false;
  }

  return true;
}

function main() {
  const mode = process.argv[2];
  const cliTarget = process.argv[3];
  if (!mode || !['init', 'dev', 'build'].includes(mode)) {
    console.error('[Tauri Android Runner] Usage: node scripts/run-tauri-android.js <init|dev|build>');
    process.exit(1);
  }

  const sdkRoot = detectAndroidSdkRoot();
  if (!sdkRoot || !existsDir(sdkRoot)) {
    console.error('[Tauri Android Runner] Android SDK root not found. Set ANDROID_HOME/ANDROID_SDK_ROOT.');
    process.exit(1);
  }

  const ndkHome = process.env.NDK_HOME || process.env.ANDROID_NDK_HOME || detectLatestNdk(sdkRoot);
  if (!ndkHome || !existsDir(ndkHome)) {
    console.error('[Tauri Android Runner] Android NDK not found. Install NDK and set NDK_HOME.');
    process.exit(1);
  }

  const tauriArgs = ['tauri', 'android', mode, '--ci'];
  const target = resolveAndroidTarget(mode, cliTarget);
  if (target) {
    tauriArgs.push('--target', target);
  }
  const cargoBuildJobs = String(parsePositiveInt(process.env.CARGO_BUILD_JOBS, 1));
  const cargoReleaseOptLevel = String(process.env.CARGO_PROFILE_RELEASE_OPT_LEVEL || '0');
  const cargoReleaseCodegenUnits = String(
    parsePositiveInt(process.env.CARGO_PROFILE_RELEASE_CODEGEN_UNITS, 256)
  );
  const cargoReleaseDebug = String(process.env.CARGO_PROFILE_RELEASE_DEBUG || '0');
  const cargoReleaseLto = String(process.env.CARGO_PROFILE_RELEASE_LTO || 'off');
  const cargoReleasePanic = String(process.env.CARGO_PROFILE_RELEASE_PANIC || 'abort');
  const cargoIncremental = String(process.env.CARGO_INCREMENTAL || '0');
  const rustflags = appendRustflag(process.env.RUSTFLAGS, '-C debuginfo=0');
  const includeGodotPathmode = process.env.NOTE_CONNECTION_ANDROID_INCLUDE_GODOT_PATHMODE === '1';
  const tauriEnv = {
    ...process.env,
    ANDROID_HOME: sdkRoot,
    ANDROID_SDK_ROOT: sdkRoot,
    NDK_HOME: ndkHome,
    ANDROID_NDK_HOME: ndkHome,
    CARGO_BUILD_JOBS: cargoBuildJobs,
    CARGO_PROFILE_RELEASE_OPT_LEVEL: cargoReleaseOptLevel,
    CARGO_PROFILE_RELEASE_CODEGEN_UNITS: cargoReleaseCodegenUnits,
    CARGO_PROFILE_RELEASE_DEBUG: cargoReleaseDebug,
    CARGO_PROFILE_RELEASE_LTO: cargoReleaseLto,
    CARGO_PROFILE_RELEASE_PANIC: cargoReleasePanic,
    CARGO_INCREMENTAL: cargoIncremental,
    RUSTFLAGS: rustflags,
    NOTE_CONNECTION_ANDROID_INCLUDE_GODOT_PATHMODE: includeGodotPathmode ? '1' : '0'
  };

  // Dev/build commands require the generated Android project before patching.
  if (mode === 'dev' || mode === 'build') {
    if (!ensureAndroidProjectScaffold(tauriEnv)) {
      console.error('[Tauri Android Runner] Failed to prepare Android scaffold before build/dev.');
      process.exit(1);
    }

    if (!syncPathmodeIntegration({ includeGodotPathmode, allowMissing: false })) {
      console.error('[Tauri Android Runner] Failed to synchronize Android Pathmode profile before build/dev.');
      process.exit(1);
    }
  } else {
    // init may run before the Android project exists; pre-patch is best-effort.
    syncPathmodeIntegration({ includeGodotPathmode, allowMissing: true });
  }

  console.log(`[Tauri Android Runner] SDK: ${sdkRoot}`);
  console.log(`[Tauri Android Runner] NDK: ${ndkHome}`);
  console.log(`[Tauri Android Runner] Cargo jobs: ${cargoBuildJobs}`);
  console.log(`[Tauri Android Runner] Cargo release opt-level: ${cargoReleaseOptLevel}`);
  console.log(`[Tauri Android Runner] Cargo release codegen-units: ${cargoReleaseCodegenUnits}`);
  console.log(`[Tauri Android Runner] Cargo release debug: ${cargoReleaseDebug}`);
  console.log(`[Tauri Android Runner] Cargo release lto: ${cargoReleaseLto}`);
  console.log(`[Tauri Android Runner] Cargo release panic: ${cargoReleasePanic}`);
  console.log(`[Tauri Android Runner] Cargo incremental: ${cargoIncremental}`);
  console.log(`[Tauri Android Runner] RUSTFLAGS: ${rustflags || '(empty)'}`);
  console.log(`[Tauri Android Runner] Godot Pathmode: ${includeGodotPathmode ? 'enabled (extended profile)' : 'disabled (mobile-slim)'}`);
  if (target) {
    console.log(`[Tauri Android Runner] Target: ${target}`);
  } else {
    console.log('[Tauri Android Runner] Target: default (tauri cli)');
  }
  console.log(`[Tauri Android Runner] Executing: npx ${tauriArgs.join(' ')}`);

  const result = spawnTauriCommand(tauriArgs, tauriEnv);

  if (result.error) {
    console.error(`[Tauri Android Runner] Failed to start command: ${result.error.message}`);
  }
  if (result.signal) {
    console.error(`[Tauri Android Runner] Command terminated by signal: ${result.signal}`);
  }

  const statusCode = result.status === null ? 1 : result.status;
  if (statusCode !== 0) {
    process.exit(statusCode);
  }

  // Keep project patched after successful init/dev/build.
  if (!syncPathmodeIntegration({ includeGodotPathmode, allowMissing: false })) {
    console.error('[Tauri Android Runner] Android command succeeded, but post-build profile synchronization failed.');
    process.exit(1);
  }

  process.exit(0);
}

main();
