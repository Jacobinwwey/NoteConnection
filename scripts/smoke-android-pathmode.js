const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const androidAppDir = path.join(repoRoot, 'src-tauri', 'gen', 'android', 'app');
const buildGradlePath = path.join(androidAppDir, 'build.gradle.kts');
const requireDevice = process.env.NOTE_CONNECTION_ANDROID_SMOKE_REQUIRE_DEVICE === '1';

function resolvePackageName() {
  if (!fs.existsSync(buildGradlePath)) {
    throw new Error(
      `Missing Android Gradle project at ${buildGradlePath}. Run tauri Android init/build first.`
    );
  }

  const gradle = fs.readFileSync(buildGradlePath, 'utf8');
  const appIdMatch = gradle.match(/applicationId\s*=\s*"([^"]+)"/);
  if (appIdMatch) {
    return appIdMatch[1];
  }

  const namespaceMatch = gradle.match(/namespace\s*=\s*"([^"]+)"/);
  if (namespaceMatch) {
    return namespaceMatch[1];
  }

  throw new Error('Failed to resolve Android package name from app/build.gradle.kts');
}

function resolveAdbCommand() {
  const isWin = process.platform === 'win32';
  const executable = isWin ? 'adb.exe' : 'adb';
  const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;

  if (sdkRoot) {
    const candidate = path.join(sdkRoot, 'platform-tools', executable);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return executable;
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options
  });

  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

function parseConnectedDevices(adbOutput) {
  return adbOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('List of devices attached'))
    .map((line) => line.split(/\s+/))
    .filter((parts) => parts.length >= 2 && parts[1] === 'device')
    .map((parts) => parts[0]);
}

function adbShell(adbCommand, serial, shellCommand) {
  return runCommand(adbCommand, ['-s', serial, 'shell', ...shellCommand]);
}

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForActivity(adbCommand, serial, activityHint, shouldExist) {
  const maxAttempts = 15;
  for (let i = 0; i < maxAttempts; i += 1) {
    const probe = adbShell(adbCommand, serial, ['dumpsys', 'activity', 'activities']);
    if (probe.status === 0) {
      const hasActivity = probe.stdout.includes(activityHint);
      if (shouldExist ? hasActivity : !hasActivity) {
        return true;
      }
    }
    await delay(1000);
  }

  return false;
}

async function main() {
  const packageName = resolvePackageName();
  const adbCommand = resolveAdbCommand();

  const startServer = runCommand(adbCommand, ['start-server']);
  if (startServer.status !== 0) {
    throw new Error(`Failed to start adb server: ${startServer.stderr.trim()}`);
  }

  const devicesResult = runCommand(adbCommand, ['devices']);
  if (devicesResult.status !== 0) {
    throw new Error(`Failed to list adb devices: ${devicesResult.stderr.trim()}`);
  }

  const devices = parseConnectedDevices(devicesResult.stdout);
  if (devices.length === 0) {
    const message = '[Smoke] Android Pathmode smoke skipped: no adb device/emulator connected.';
    if (requireDevice) {
      throw new Error(`${message} (set NOTE_CONNECTION_ANDROID_SMOKE_REQUIRE_DEVICE=0 to allow skip)`);
    }
    console.log(message);
    return;
  }

  const serial = devices[0];
  const mainActivity = `${packageName}/${packageName}.MainActivity`;
  const pathmodeActivity = `${packageName}/${packageName}.PathmodeGodotActivity`;
  const payload = JSON.stringify({
    mode: 'domain',
    strategy: 'foundational',
    targetId: null
  });

  let result = adbShell(adbCommand, serial, ['am', 'start', '-n', mainActivity]);
  if (result.status !== 0) {
    throw new Error(`Failed to start MainActivity on ${serial}: ${result.stderr.trim()}`);
  }

  result = adbShell(adbCommand, serial, [
    'am',
    'start',
    '-n',
    pathmodeActivity,
    '--es',
    'noteconnection.pathmode.payload_json',
    payload
  ]);
  if (result.status !== 0) {
    throw new Error(`Failed to start PathmodeGodotActivity on ${serial}: ${result.stderr.trim()}`);
  }

  const enteredPathmode = await waitForActivity(
    adbCommand,
    serial,
    `${packageName}.PathmodeGodotActivity`,
    true
  );
  if (!enteredPathmode) {
    throw new Error('PathmodeGodotActivity did not appear in dumpsys activity output.');
  }

  result = adbShell(adbCommand, serial, ['input', 'keyevent', '4']);
  if (result.status !== 0) {
    throw new Error(`Failed to send back key event on ${serial}: ${result.stderr.trim()}`);
  }

  const exitedPathmode = await waitForActivity(
    adbCommand,
    serial,
    `${packageName}.PathmodeGodotActivity`,
    false
  );
  if (!exitedPathmode) {
    throw new Error('PathmodeGodotActivity did not exit after back key event.');
  }

  const returnedMain = await waitForActivity(
    adbCommand,
    serial,
    `${packageName}.MainActivity`,
    true
  );
  if (!returnedMain) {
    throw new Error('MainActivity was not observed after leaving Pathmode activity.');
  }

  console.log(
    `[Smoke] Android Pathmode lifecycle passed on ${serial}: MainActivity -> PathmodeGodotActivity -> MainActivity.`
  );
}

main().catch((err) => {
  console.error(`[Smoke] Android Pathmode lifecycle failed: ${err.message}`);
  process.exit(1);
});

