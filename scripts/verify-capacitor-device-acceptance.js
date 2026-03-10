const fs = require('fs');
const path = require('path');
const {
  runCommand,
  resolveAdbCommand,
  listAdbDevices,
  getOnlineDevices,
  formatDeviceStateSummary,
} = require('./capacitor-device-utils');

const apkPath = path.resolve(__dirname, '..', 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

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

const adbCommand = resolveAdbCommand();
if (!adbCommand) {
  fail([
    '[Capacitor Device Probe] Unable to locate a working `adb` executable.',
    '[Capacitor Device Probe] Configure ADB_PATH or install Android Platform Tools (PATH / ANDROID_SDK_ROOT).'
  ]);
}

const adbVersion = runCommand(adbCommand, ['version']);
if (adbVersion.error || adbVersion.status !== 0) {
  fail([
    '[Capacitor Device Probe] Failed to run `adb version`.',
    adbVersion.stderr ? `[Capacitor Device Probe] stderr: ${adbVersion.stderr.trim()}` : ''
  ].filter(Boolean));
}

let devices = [];
try {
  devices = listAdbDevices(adbCommand);
} catch (error) {
  fail([
    '[Capacitor Device Probe] Failed to run `adb devices`.',
    error && error.stderr ? `[Capacitor Device Probe] stderr: ${String(error.stderr).trim()}` : ''
  ].filter(Boolean));
}

const onlineDevices = getOnlineDevices(devices);
const requestedSerial = String(process.env.NOTE_CONNECTION_ANDROID_SERIAL || '').trim();
if (requestedSerial && !onlineDevices.some((device) => device.serial === requestedSerial)) {
  fail([
    `[Capacitor Device Probe] Requested serial is not online: ${requestedSerial}`,
    `[Capacitor Device Probe] Device states: ${formatDeviceStateSummary(devices)}`,
    '[Capacitor Device Probe] Use `adb devices` to inspect unauthorized/offline states.'
  ]);
}

if (onlineDevices.length === 0) {
  fail([
    '[Capacitor Device Probe] No online Android device detected.',
    `[Capacitor Device Probe] Device states: ${formatDeviceStateSummary(devices)}`,
    '[Capacitor Device Probe] Connect a device (USB debugging enabled), accept authorization prompts, and run again.'
  ]);
}

const selectedDevices = requestedSerial
  ? onlineDevices.filter((device) => device.serial === requestedSerial)
  : onlineDevices;

console.log(`[Capacitor Device Probe] APK ready: ${apkPath}`);
console.log(`[Capacitor Device Probe] Connected devices: ${selectedDevices.length}`);
selectedDevices.forEach((device, index) => {
  console.log(`  ${index + 1}. ${device.serial}`);
});
console.log('[Capacitor Device Probe] Probe passed. Physical-device acceptance can proceed.');
