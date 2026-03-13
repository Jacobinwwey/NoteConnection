const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ADB_EXECUTABLE = process.platform === 'win32' ? 'adb.exe' : 'adb';
const DEFAULT_TIMEOUT_MS = 15000;

function isTruthy(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function runCommand(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: options.encoding || 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: Number.isFinite(options.timeoutMs) ? options.timeoutMs : DEFAULT_TIMEOUT_MS,
    ...options,
  });
}

function hasExecutableCandidate(candidate) {
  if (!candidate || candidate === ADB_EXECUTABLE || candidate === 'adb') {
    return true;
  }
  return fs.existsSync(candidate);
}

function buildAdbCandidates() {
  const candidates = [];
  const push = (value) => {
    const normalized = String(value || '').trim();
    if (!normalized || candidates.includes(normalized)) {
      return;
    }
    candidates.push(normalized);
  };

  push(process.env.ADB_PATH);
  push(ADB_EXECUTABLE);
  push('adb');

  const sdkRoot = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME;
  if (sdkRoot) {
    push(path.join(sdkRoot, 'platform-tools', ADB_EXECUTABLE));
  }

  return candidates;
}

function resolveAdbCommand() {
  const candidates = buildAdbCandidates();
  for (const candidate of candidates) {
    if (!hasExecutableCandidate(candidate)) {
      continue;
    }
    const probe = runCommand(candidate, ['version']);
    if (!probe.error && probe.status === 0) {
      return candidate;
    }
  }
  return null;
}

function parseAdbDevicesOutput(stdoutText) {
  const lines = String(stdoutText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const result = [];
  for (const line of lines) {
    if (line.toLowerCase().startsWith('list of devices attached')) {
      continue;
    }

    const serialAndStatus = line.split(/\s+/);
    const serial = serialAndStatus[0] || '';
    const status = serialAndStatus[1] || '';
    if (!serial || !status) {
      continue;
    }

    result.push({
      serial,
      status,
      raw: line,
    });
  }

  return result;
}

function listAdbDevices(adbCommand) {
  const output = runCommand(adbCommand, ['devices']);
  if (output.error || output.status !== 0) {
    const error = new Error('Failed to run `adb devices`.');
    error.stderr = String(output.stderr || '').trim();
    throw error;
  }
  return parseAdbDevicesOutput(output.stdout);
}

function getOnlineDevices(devices) {
  return (devices || []).filter((device) => String(device.status || '').trim() === 'device');
}

function summarizeDeviceStates(devices) {
  const summary = {};
  (devices || []).forEach((device) => {
    const status = String((device && device.status) || 'unknown').trim() || 'unknown';
    summary[status] = (summary[status] || 0) + 1;
  });
  return summary;
}

function formatDeviceStateSummary(devices) {
  const summary = summarizeDeviceStates(devices);
  const orderedStates = Object.keys(summary).sort((left, right) => left.localeCompare(right));
  if (orderedStates.length === 0) {
    return 'none';
  }
  return orderedStates.map((state) => `${state}:${summary[state]}`).join(', ');
}

function getDeviceProperty(adbCommand, serial, propertyName) {
  const output = runCommand(adbCommand, ['-s', serial, 'shell', 'getprop', propertyName]);
  if (output.error || output.status !== 0) {
    return '';
  }
  return String(output.stdout || '').trim();
}

function classifyDeviceRuntime(serial, runtime = {}) {
  const reasons = [];
  const normalizedSerial = String(serial || '').trim().toLowerCase();
  if (normalizedSerial.startsWith('emulator-')) {
    reasons.push('serial-prefix-emulator');
  }

  const qemu = String(runtime.roKernelQemu || '').trim();
  if (qemu === '1') {
    reasons.push('ro.kernel.qemu=1');
  }

  const combinedFingerprint = [
    runtime.model,
    runtime.device,
    runtime.hardware,
    runtime.fingerprint,
    runtime.manufacturer,
    runtime.brand,
    runtime.product,
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter((value) => value.length > 0)
    .join(' ');

  if (
    /(emulator|sdk|generic|goldfish|ranchu|genymotion|vbox|virtualbox|simulator)/i.test(
      combinedFingerprint
    )
  ) {
    reasons.push('runtime-fingerprint-emulator-marker');
  }

  return {
    likelyEmulator: reasons.length > 0,
    reasons,
  };
}

function inspectDeviceRuntime(adbCommand, serial) {
  const runtime = {
    roKernelQemu: getDeviceProperty(adbCommand, serial, 'ro.kernel.qemu'),
    model: getDeviceProperty(adbCommand, serial, 'ro.product.model'),
    manufacturer: getDeviceProperty(adbCommand, serial, 'ro.product.manufacturer'),
    brand: getDeviceProperty(adbCommand, serial, 'ro.product.brand'),
    product: getDeviceProperty(adbCommand, serial, 'ro.product.name'),
    device: getDeviceProperty(adbCommand, serial, 'ro.product.device'),
    hardware: getDeviceProperty(adbCommand, serial, 'ro.hardware'),
    fingerprint: getDeviceProperty(adbCommand, serial, 'ro.build.fingerprint'),
    androidVersion: getDeviceProperty(adbCommand, serial, 'ro.build.version.release'),
  };

  const classification = classifyDeviceRuntime(serial, runtime);
  return {
    ...runtime,
    likelyEmulator: classification.likelyEmulator,
    emulatorReasons: classification.reasons,
  };
}

module.exports = {
  isTruthy,
  runCommand,
  buildAdbCandidates,
  resolveAdbCommand,
  parseAdbDevicesOutput,
  listAdbDevices,
  getOnlineDevices,
  summarizeDeviceStates,
  formatDeviceStateSummary,
  getDeviceProperty,
  classifyDeviceRuntime,
  inspectDeviceRuntime,
};
