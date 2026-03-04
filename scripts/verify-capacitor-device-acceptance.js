const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const apkPath = path.resolve(__dirname, '..', 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

function run(command, args) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function fail(lines) {
  lines.forEach((line) => console.error(line));
  process.exit(1);
}

if (!fs.existsSync(apkPath)) {
  fail([
    '[Capacitor Device Probe] APK not found.',
    `[Capacitor Device Probe] Expected: ${apkPath}`,
    '[Capacitor Device Probe] Run `npm run mobile:build:capacitor` first.'
  ]);
}

const adbVersion = run('adb', ['version']);
if (adbVersion.error || adbVersion.status !== 0) {
  fail([
    '[Capacitor Device Probe] `adb` is not available in PATH.',
    '[Capacitor Device Probe] Install Android Platform Tools and ensure `adb` is resolvable.'
  ]);
}

const adbDevices = run('adb', ['devices']);
if (adbDevices.error || adbDevices.status !== 0) {
  fail([
    '[Capacitor Device Probe] Failed to run `adb devices`.',
    adbDevices.stderr ? `[Capacitor Device Probe] stderr: ${adbDevices.stderr.trim()}` : ''
  ].filter(Boolean));
}

const lines = adbDevices.stdout
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.length > 0);

const deviceLines = lines
  .slice(1)
  .filter((line) => /\tdevice$/.test(line));

if (deviceLines.length === 0) {
  fail([
    '[Capacitor Device Probe] No online Android device detected.',
    '[Capacitor Device Probe] Connect a device (USB debugging enabled) and run again.'
  ]);
}

console.log(`[Capacitor Device Probe] APK ready: ${apkPath}`);
console.log(`[Capacitor Device Probe] Connected devices: ${deviceLines.length}`);
deviceLines.forEach((line, index) => {
  const serial = line.split('\t')[0];
  console.log(`  ${index + 1}. ${serial}`);
});
console.log('[Capacitor Device Probe] Probe passed. Physical-device acceptance can proceed.');
