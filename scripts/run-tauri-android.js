const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

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

  const isWindows = process.platform === 'win32';
  const execCommand = isWindows ? 'cmd.exe' : 'npx';
  const execArgs = isWindows ? ['/d', '/s', '/c', 'npx', ...tauriArgs] : tauriArgs;
  console.log(`[Tauri Android Runner] SDK: ${sdkRoot}`);
  console.log(`[Tauri Android Runner] NDK: ${ndkHome}`);
  if (target) {
    console.log(`[Tauri Android Runner] Target: ${target}`);
  } else {
    console.log('[Tauri Android Runner] Target: default (tauri cli)');
  }
  console.log(`[Tauri Android Runner] Executing: npx ${tauriArgs.join(' ')}`);

  const result = spawnSync(execCommand, execArgs, {
    stdio: 'inherit',
    env: {
      ...process.env,
      ANDROID_HOME: sdkRoot,
      ANDROID_SDK_ROOT: sdkRoot,
      NDK_HOME: ndkHome,
      ANDROID_NDK_HOME: ndkHome
    }
  });

  if (result.error) {
    console.error(`[Tauri Android Runner] Failed to start command: ${result.error.message}`);
  }
  if (result.signal) {
    console.error(`[Tauri Android Runner] Command terminated by signal: ${result.signal}`);
  }

  process.exit(result.status === null ? 1 : result.status);
}

main();
