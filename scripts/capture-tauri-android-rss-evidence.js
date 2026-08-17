#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  isTruthy,
  runCommand,
  resolveAdbCommand,
  listAdbDevices,
  getOnlineDevices,
  formatDeviceStateSummary,
  inspectDeviceRuntime,
} = require('./capacitor-device-utils');
const { verifyMobileArtifact } = require('./verify-mobile-artifact');

const repoRoot = path.resolve(__dirname, '..');
const defaultOutputRoot = path.join(repoRoot, 'output', 'verification', 'mobile-android');
const defaultPackageId = 'com.jacobinwwey.noteconnection';
const requiredWorkloadSteps = ['saf-import', 'graph-build', 'exact-query', 'path', 'continuity'];
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_SAMPLE_INTERVAL_MS = 250;
const DEFAULT_RESTART_TIMEOUT_MS = 10000;
const sleepBuffer = new SharedArrayBuffer(4);
const sleepView = new Int32Array(sleepBuffer);

function parseOption(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? String(args[index + 1] || '') : '';
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function sleepMs(durationMs) {
  const duration = Math.max(0, Math.floor(Number(durationMs) || 0));
  if (duration > 0) {
    Atomics.wait(sleepView, 0, 0, duration);
  }
}

function timestampKey(now = new Date()) {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z').replace('T', '-');
}

function maskSerial(serial) {
  const value = String(serial || '').trim();
  if (value.length <= 4) {
    return value;
  }
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function toRepoRelative(targetPath) {
  return path.relative(repoRoot, targetPath).replace(/\\/g, '/');
}

function redactLogcat(logcat, serial) {
  const masked = maskSerial(serial);
  return String(logcat || '')
    .replaceAll(String(serial || ''), masked)
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .slice(-500)
    .join('\n')
    .concat('\n');
}

function findArtifact(candidates) {
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      return resolved;
    }
  }
  return '';
}

function resolveArtifactPath(cliArtifact) {
  const explicit = cliArtifact || process.env.NOTE_CONNECTION_TAURI_ANDROID_ARTIFACT || '';
  if (explicit) {
    return path.resolve(explicit);
  }
  return findArtifact([
    path.join(repoRoot, 'src-tauri', 'gen', 'android', 'app', 'build', 'outputs', 'apk', 'aarch64', 'release', 'app-aarch64-release.apk'),
    path.join(repoRoot, 'src-tauri', 'gen', 'android', 'app', 'build', 'outputs', 'apk', 'universal', 'release', 'app-universal-release.apk'),
    path.join(repoRoot, 'src-tauri', 'gen', 'android', 'app', 'build', 'outputs', 'apk', 'universal', 'release', 'app-universal-release-unsigned.apk'),
  ]);
}

function readWorkloadSpec(specPath) {
  if (!specPath) {
    throw new Error(
      'Android workload spec is required. Set NOTE_CONNECTION_ANDROID_WORKLOAD_SPEC or pass --workload-spec.'
    );
  }
  const resolvedPath = path.resolve(specPath);
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read Android workload spec ${resolvedPath}: ${String(error.message || error)}`);
  }
  if (!payload || payload.schemaVersion !== 1 || !Array.isArray(payload.steps)) {
    throw new Error('Android workload spec must use schemaVersion 1 and contain a steps array.');
  }

  const steps = payload.steps.map((step, index) => {
    if (!step || typeof step !== 'object') {
      throw new Error(`Android workload step ${index} must be an object.`);
    }
    const name = String(step.name || '').trim();
    const adbArgs = Array.isArray(step.adbArgs) ? step.adbArgs : step.args;
    if (!name || !Array.isArray(adbArgs) || adbArgs.length === 0 || adbArgs.some((arg) => typeof arg !== 'string' || !arg)) {
      throw new Error(`Android workload step ${index} requires a name and non-empty string adbArgs.`);
    }
    return {
      name,
      adbArgs: [...adbArgs],
      timeoutMs: parsePositiveInteger(step.timeoutMs, DEFAULT_TIMEOUT_MS),
      expectedStdout: step.expectedStdout ? String(step.expectedStdout) : '',
    };
  });
  const names = steps.map((step) => step.name);
  const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index);
  if (duplicateNames.length > 0) {
    throw new Error(`Android workload step names must be unique: ${[...new Set(duplicateNames)].join(', ')}`);
  }
  const missing = requiredWorkloadSteps.filter((name) => !names.includes(name));
  if (missing.length > 0) {
    throw new Error(`Android workload spec is missing required steps: ${missing.join(', ')}`);
  }
  const unexpected = names.filter((name) => !requiredWorkloadSteps.includes(name));
  if (unexpected.length > 0) {
    throw new Error(`Android workload spec contains unsupported steps: ${unexpected.join(', ')}`);
  }
  const requiredOrder = requiredWorkloadSteps.map((name) => names.indexOf(name));
  if (requiredOrder.some((position, index) => index > 0 && position <= requiredOrder[index - 1])) {
    throw new Error(`Android workload steps must be ordered: ${requiredWorkloadSteps.join(' -> ')}`);
  }

  return {
    specPath: resolvedPath,
    schemaVersion: 1,
    steps,
    requiredSteps: requiredWorkloadSteps,
  };
}

function runAdb(adbCommand, serial, adbArgs, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const result = runCommand(adbCommand, ['-s', serial, ...adbArgs], { timeoutMs });
  return {
    ok: !result.error && result.status === 0,
    status: result.status,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
    error: result.error ? String(result.error.message || result.error) : '',
  };
}

function parsePid(output) {
  const match = String(output || '').match(/\b(\d+)\b/);
  return match ? Number(match[1]) : 0;
}

function resolvePid(adbCommand, serial, packageId) {
  const result = runAdb(adbCommand, serial, ['shell', 'pidof', packageId], 5000);
  if (!result.ok) {
    return 0;
  }
  return parsePid(result.stdout);
}

function waitForPid(adbCommand, serial, packageId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const pid = resolvePid(adbCommand, serial, packageId);
    if (pid > 0) {
      return pid;
    }
    sleepMs(100);
  }
  return 0;
}

function waitForNoPid(adbCommand, serial, packageId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (resolvePid(adbCommand, serial, packageId) === 0) {
      return true;
    }
    sleepMs(100);
  }
  return false;
}

function readRssBytes(adbCommand, serial, pid) {
  if (!pid) {
    return 0;
  }
  const result = runAdb(adbCommand, serial, ['shell', 'cat', `/proc/${pid}/status`], 5000);
  if (!result.ok) {
    return 0;
  }
  const match = result.stdout.match(/^VmRSS:\s+(\d+)\s+kB$/im);
  return match ? Number(match[1]) * 1024 : 0;
}

function sampleRss(adbCommand, serial, packageId, durationMs, intervalMs, samples) {
  const deadline = Date.now() + Math.max(0, durationMs);
  let sampleCount = 0;
  while (sampleCount === 0 || Date.now() <= deadline) {
    const pid = resolvePid(adbCommand, serial, packageId);
    const residentBytes = readRssBytes(adbCommand, serial, pid);
    if (residentBytes > 0) {
      samples.push({
        capturedAt: new Date().toISOString(),
        pid,
        residentBytes,
      });
    }
    sampleCount += 1;
    if (Date.now() > deadline) {
      break;
    }
    sleepMs(intervalMs);
  }
}

function runWorkloadStep(adbCommand, serial, packageId, step, samples, sampleIntervalMs) {
  sampleRss(adbCommand, serial, packageId, 0, sampleIntervalMs, samples);
  const result = runAdb(adbCommand, serial, step.adbArgs, step.timeoutMs);
  sampleRss(adbCommand, serial, packageId, sampleIntervalMs, sampleIntervalMs, samples);
  if (!result.ok) {
    throw new Error(
      `Android workload step '${step.name}' failed: ${result.error || result.stderr || `exit ${result.status}`}`
    );
  }
  if (step.expectedStdout) {
    let matcher;
    try {
      matcher = new RegExp(step.expectedStdout, 'i');
    } catch (error) {
      throw new Error(`Invalid expectedStdout regex for workload step '${step.name}': ${String(error.message || error)}`);
    }
    if (!matcher.test(result.stdout)) {
      throw new Error(`Android workload step '${step.name}' did not match expectedStdout.`);
    }
  }
  return {
    name: step.name,
    adbArgs: step.adbArgs,
    status: 'pass',
    exitCode: result.status,
    stdoutTail: result.stdout.trim().slice(-1000),
    stderrTail: result.stderr.trim().slice(-1000),
  };
}

function captureLogcat(adbCommand, serial) {
  const result = runAdb(adbCommand, serial, ['logcat', '-d', '-v', 'time'], 15000);
  if (!result.ok) {
    return '';
  }
  return redactLogcat(result.stdout, serial);
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function collectDevice(adbCommand, requestedSerial) {
  let devices;
  try {
    devices = listAdbDevices(adbCommand);
  } catch (error) {
    throw new Error(`Failed to enumerate Android devices: ${error.message || error}`);
  }
  const online = getOnlineDevices(devices).map((device) => device.serial);
  if (online.length === 0) {
    throw new Error(`No online Android device detected. Device states: ${formatDeviceStateSummary(devices)}`);
  }
  const serial = requestedSerial || online[0];
  if (!online.includes(serial)) {
    throw new Error(`Requested Android serial is not online: ${serial}. Device states: ${formatDeviceStateSummary(devices)}`);
  }
  return { serial, runtime: inspectDeviceRuntime(adbCommand, serial) };
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node scripts/capture-tauri-android-rss-evidence.js --artifact <signed-arm64.apk> --workload-spec <spec.json> [--package <id>] [--serial <serial>] [--output <dir>] [--allow-emulator] [--require-signed]');
    return;
  }

  const artifactPath = resolveArtifactPath(parseOption(args, '--artifact'));
  if (!artifactPath || !fs.existsSync(artifactPath)) {
    throw new Error(`Tauri Android artifact not found: ${artifactPath || '(missing --artifact)'}`);
  }
  const profile = parseOption(args, '--profile') || process.env.NOTE_CONNECTION_MOBILE_PROFILE || 'mobile-low';
  const requireSigned = !args.includes('--allow-unsigned');
  verifyMobileArtifact({
    artifactPath,
    profile,
    requireArm64: true,
    requireSigned,
  });
  const workloadSpec = readWorkloadSpec(
    parseOption(args, '--workload-spec') || process.env.NOTE_CONNECTION_ANDROID_WORKLOAD_SPEC
  );
  const adbCommand = resolveAdbCommand();
  if (!adbCommand) {
    throw new Error('Unable to locate adb. Configure ADB_PATH or ANDROID_SDK_ROOT.');
  }
  const requestedSerial = parseOption(args, '--serial') || process.env.NOTE_CONNECTION_ANDROID_SERIAL || '';
  const device = collectDevice(adbCommand, requestedSerial);
  const allowEmulator = args.includes('--allow-emulator') || isTruthy(process.env.NOTE_CONNECTION_ALLOW_EMULATOR_EVIDENCE);
  if (device.runtime.likelyEmulator && !allowEmulator) {
    throw new Error(
      `Selected device ${device.serial} is classified as emulator: ${(device.runtime.emulatorReasons || []).join(', ') || 'unknown'}. Set --allow-emulator only for non-production experiments.`
    );
  }

  const packageId = parseOption(args, '--package') || process.env.NOTE_CONNECTION_ANDROID_PACKAGE || defaultPackageId;
  const outputRoot = path.resolve(parseOption(args, '--output') || process.env.NOTE_CONNECTION_ANDROID_EVIDENCE_ROOT || defaultOutputRoot);
  const runId = `${timestampKey()}-${maskSerial(device.serial).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const runDir = path.join(outputRoot, runId);
  const manifestPath = path.join(runDir, 'tauri_android_rss_evidence.json');
  const rssEvidencePath = path.join(runDir, 'rss.json');
  const logcatPath = path.join(runDir, 'logcat-tail.txt');
  const samples = [];
  const sampleIntervalMs = parsePositiveInteger(
    parseOption(args, '--sample-interval-ms') || process.env.NOTE_CONNECTION_ANDROID_RSS_SAMPLE_INTERVAL_MS,
    DEFAULT_SAMPLE_INTERVAL_MS
  );
  const restartTimeoutMs = parsePositiveInteger(
    parseOption(args, '--restart-timeout-ms') || process.env.NOTE_CONNECTION_ANDROID_RESTART_TIMEOUT_MS,
    DEFAULT_RESTART_TIMEOUT_MS
  );
  const install = runAdb(adbCommand, device.serial, ['install', '-r', artifactPath], 120000);
  if (!install.ok) {
    throw new Error(`Android APK install failed: ${install.error || install.stderr || `exit ${install.status}`}`);
  }
  const launch = runAdb(adbCommand, device.serial, ['shell', 'monkey', '-p', packageId, '1'], 30000);
  if (!launch.ok) {
    throw new Error(`Android application launch failed: ${launch.error || launch.stderr || `exit ${launch.status}`}`);
  }
  const initialPid = waitForPid(adbCommand, device.serial, packageId, 30000);
  if (!initialPid) {
    throw new Error(`Android application did not expose a pid after launch: ${packageId}`);
  }

  const stepResults = [];
  const stepByName = new Map(workloadSpec.steps.map((step) => [step.name, step]));
  for (const name of ['saf-import', 'graph-build', 'exact-query', 'path']) {
    stepResults.push(runWorkloadStep(adbCommand, device.serial, packageId, stepByName.get(name), samples, sampleIntervalMs));
  }

  const stop = runAdb(adbCommand, device.serial, ['shell', 'am', 'force-stop', packageId], 10000);
  if (!stop.ok || !waitForNoPid(adbCommand, device.serial, packageId, restartTimeoutMs)) {
    throw new Error(`Android force-stop did not produce an observable process death for ${packageId}.`);
  }
  const restart = runAdb(adbCommand, device.serial, ['shell', 'monkey', '-p', packageId, '1'], 30000);
  if (!restart.ok) {
    throw new Error(`Android application restart failed: ${restart.error || restart.stderr || `exit ${restart.status}`}`);
  }
  const restartedPid = waitForPid(adbCommand, device.serial, packageId, 30000);
  if (!restartedPid) {
    throw new Error(`Android application did not expose a pid after restart: ${packageId}`);
  }
  stepResults.push(runWorkloadStep(adbCommand, device.serial, packageId, stepByName.get('continuity'), samples, sampleIntervalMs));
  if (samples.length === 0) {
    throw new Error('No VmRSS samples were captured; refusing to emit release evidence.');
  }

  const peakResidentBytes = Math.max(...samples.map((sample) => sample.residentBytes));
  const now = new Date();
  fs.mkdirSync(runDir, { recursive: true });
  writeJson(rssEvidencePath, {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    source: '/proc/<pid>/status:VmRSS',
    peakResidentBytes,
    sampleCount: samples.length,
  });
  const verifiedArtifact = verifyMobileArtifact({
    artifactPath,
    profile,
    requireArm64: true,
    requireSigned,
    rssEvidencePath,
    requireRss: true,
  });
  const manifest = {
    schemaVersion: 1,
    status: 'pass',
    generatedAt: now.toISOString(),
    runId,
    artifact: {
      path: toRepoRelative(artifactPath),
      kind: verifiedArtifact.artifactKind,
      profile: verifiedArtifact.profile,
      sizeBytes: fs.statSync(artifactPath).size,
      sha256: sha256File(artifactPath),
      compressedPayloadBytes: verifiedArtifact.compressedPayloadBytes,
      arm64: verifiedArtifact.hasArm64Payload,
      signature: verifiedArtifact.signature,
      rssEvidenceRelative: toRepoRelative(rssEvidencePath),
    },
    device: {
      serialMasked: maskSerial(device.serial),
      model: device.runtime.model || '',
      manufacturer: device.runtime.manufacturer || '',
      androidVersion: device.runtime.androidVersion || '',
      likelyEmulator: Boolean(device.runtime.likelyEmulator),
      emulatorReasons: device.runtime.emulatorReasons || [],
    },
    packageId,
    process: {
      initialPid,
      restartedPid,
      forceStopObserved: true,
    },
    workload: {
      spec: toRepoRelative(workloadSpec.specPath),
      requiredSteps: workloadSpec.requiredSteps,
      steps: stepResults,
      nativeProjectionContinuity: true,
    },
    rss: {
      source: '/proc/<pid>/status:VmRSS',
      sampleIntervalMs,
      peakResidentBytes,
      sampleCount: samples.length,
      samples,
    },
  };
  writeJson(manifestPath, manifest);
  fs.writeFileSync(logcatPath, captureLogcat(adbCommand, device.serial), 'utf8');
  writeJson(path.join(outputRoot, 'latest.json'), {
    schemaVersion: 1,
    status: 'pass',
    generatedAt: now.toISOString(),
    runId,
    manifestRelative: toRepoRelative(manifestPath),
  });
  console.log(`[Tauri Android Evidence] PASS device=${maskSerial(device.serial)} peakRss=${peakResidentBytes}`);
  console.log(`[Tauri Android Evidence] Manifest: ${toRepoRelative(manifestPath)}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[Tauri Android Evidence] FAIL: ${String(error && error.message ? error.message : error)}`);
    process.exit(1);
  }
}

module.exports = {
  requiredWorkloadSteps,
  maskSerial,
  parseWorkloadSpec: readWorkloadSpec,
  parsePid,
  readRssBytes,
  resolveArtifactPath,
};
