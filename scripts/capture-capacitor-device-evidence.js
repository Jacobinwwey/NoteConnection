#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  runCommand,
  resolveAdbCommand,
  listAdbDevices,
  getOnlineDevices,
  formatDeviceStateSummary,
} = require('./capacitor-device-utils');

const repoRoot = path.resolve(__dirname, '..');
const apkPath = path.join(repoRoot, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const evidenceRoot = path.join(repoRoot, 'docs', 'mobile-evidence');
const EVIDENCE_MANIFEST_SCHEMA_VERSION = 1;
const LARGE_GRAPH_NODE_THRESHOLD = 10000;
const LARGE_GRAPH_EDGE_THRESHOLD = 1000000;

function fail(lines) {
  const normalized = Array.isArray(lines) ? lines : [String(lines)];
  normalized.forEach((line) => {
    if (line && String(line).trim().length > 0) {
      console.error(`[Capacitor Evidence] ${line}`);
    }
  });
  process.exit(1);
}

function assertAdbAvailable(adbCommand) {
  const version = runCommand(adbCommand, ['version']);
  if (version.error || version.status !== 0) {
    fail([
      'Failed to run `adb version`.',
      'Configure ADB_PATH or install Android Platform Tools (PATH / ANDROID_SDK_ROOT).',
    ]);
  }
}

function getDeviceProperty(adbCommand, serial, propertyName) {
  const result = runCommand(adbCommand, ['-s', serial, 'shell', 'getprop', propertyName]);
  if (result.error || result.status !== 0) {
    return '';
  }
  return String(result.stdout || '').trim();
}

function sanitizeSegment(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function maskSerial(serial) {
  if (!serial || serial.length <= 4) {
    return serial;
  }
  return `${serial.slice(0, 2)}***${serial.slice(-2)}`;
}

function timestampKey(now = new Date()) {
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}

function captureScreenshot(adbCommand, serial, screenshotPath) {
  const capture = runCommand(adbCommand, ['-s', serial, 'exec-out', 'screencap', '-p'], { encoding: 'buffer' });
  if (capture.error || capture.status !== 0 || !capture.stdout || capture.stdout.length === 0) {
    fail([
      'Failed to capture screenshot from device.',
      capture.stderr ? String(capture.stderr).trim() : '',
    ]);
  }

  fs.writeFileSync(screenshotPath, capture.stdout);
}

function captureLogcat(adbCommand, serial, logcatPath) {
  const logcat = runCommand(adbCommand, ['-s', serial, 'logcat', '-d', '-v', 'time']);
  if (logcat.error || logcat.status !== 0) {
    fail([
      'Failed to capture logcat snapshot.',
      logcat.stderr ? logcat.stderr.trim() : '',
    ]);
  }

  const lines = String(logcat.stdout || '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  const tailLines = lines.slice(Math.max(0, lines.length - 400));
  fs.writeFileSync(logcatPath, `${tailLines.join('\n')}\n`, 'utf8');
}

function sha256File(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function fileLineCount(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
}

function parseOptionalPositiveInteger(rawValue) {
  const value = Number(String(rawValue || '').trim());
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
}

function resolveWorkloadEvidence() {
  const nodeCount = parseOptionalPositiveInteger(
    process.env.NOTE_CONNECTION_EVIDENCE_NODE_COUNT || process.env.NOTE_CONNECTION_EXPECTED_NODE_COUNT
  );
  const edgeCount = parseOptionalPositiveInteger(
    process.env.NOTE_CONNECTION_EVIDENCE_EDGE_COUNT || process.env.NOTE_CONNECTION_EXPECTED_EDGE_COUNT
  );
  const meetsLargeGraphThreshold =
    nodeCount >= LARGE_GRAPH_NODE_THRESHOLD && edgeCount >= LARGE_GRAPH_EDGE_THRESHOLD;

  return {
    nodeCount,
    edgeCount,
    thresholds: {
      nodeCount: LARGE_GRAPH_NODE_THRESHOLD,
      edgeCount: LARGE_GRAPH_EDGE_THRESHOLD,
    },
    meetsLargeGraphThreshold,
  };
}

function buildChecklist(workloadEvidence) {
  return {
    deviceConnectionGateExecuted: true,
    runtimeEvidenceArtifactsCollected: true,
    largeGraphScenarioExecuted: workloadEvidence.meetsLargeGraphThreshold,
    appStartupManuallyVerified: false,
    sourcePanelManuallyVerified: false,
    readerManuallyVerified: false,
    pathModeEnterExitManuallyVerified: false,
  };
}

function toRepoRelative(targetPath) {
  return path.relative(repoRoot, targetPath).replace(/\\/g, '/');
}

function writeEvidenceManifest(manifestPath, context) {
  const manifest = {
    schemaVersion: EVIDENCE_MANIFEST_SCHEMA_VERSION,
    generatedAt: context.isoTime,
    runId: context.runId,
    apk: {
      relativePath: context.apkRelative,
      sizeBytes: context.apkSizeBytes,
      sha256: context.apkSha256,
    },
    device: {
      serialMasked: context.maskedSerial,
      model: context.model || '',
      androidVersion: context.androidVersion || '',
    },
    artifacts: {
      screenshot: {
        relativePath: toRepoRelative(context.screenshotPath),
        sizeBytes: context.screenshotSizeBytes,
        sha256: context.screenshotSha256,
        mimeType: 'image/png',
      },
      logcat: {
        relativePath: toRepoRelative(context.logcatPath),
        sizeBytes: context.logcatSizeBytes,
        sha256: context.logcatSha256,
        lineCount: context.logcatLineCount,
      },
      markdownReport: {
        relativePath: toRepoRelative(context.reportPath),
      },
    },
    workload: context.workloadEvidence,
    checklist: context.checklist,
  };

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function writeLatestPointer(pointerPath, context) {
  const pointer = {
    schemaVersion: EVIDENCE_MANIFEST_SCHEMA_VERSION,
    generatedAt: context.isoTime,
    runId: context.runId,
    runDirRelative: toRepoRelative(context.runDir),
    manifestRelative: toRepoRelative(context.manifestPath),
    markdownReportRelative: toRepoRelative(context.reportPath),
    deviceSerialMasked: context.maskedSerial,
  };
  fs.writeFileSync(pointerPath, `${JSON.stringify(pointer, null, 2)}\n`, 'utf8');
}

function writeEvidenceReport(reportPath, context) {
  const report = `# ${context.dateLabel} v1.0.0 - Capacitor Device Acceptance Evidence

## English Document

### Device Snapshot
- Test time: ${context.isoTime}
- Device serial (masked): ${context.maskedSerial}
- Device model: ${context.model || 'Unknown'}
- Android version: ${context.androidVersion || 'Unknown'}
- APK path: ${context.apkRelative}

### Artifacts
- Screenshot: [${path.basename(context.screenshotPath)}](./${path.basename(context.screenshotPath)})
- Logcat tail: [${path.basename(context.logcatPath)}](./${path.basename(context.logcatPath)})
- Evidence manifest: [${path.basename(context.manifestPath)}](./${path.basename(context.manifestPath)})

### Workload Context
- Evidence nodes: ${context.workloadEvidence.nodeCount || 0}
- Evidence edges: ${context.workloadEvidence.edgeCount || 0}
- Large-graph threshold: nodes >= ${context.workloadEvidence.thresholds.nodeCount}, edges >= ${context.workloadEvidence.thresholds.edgeCount}
- Meets large-graph threshold: ${context.workloadEvidence.meetsLargeGraphThreshold ? 'yes' : 'no'}

### Checklist Status
- [x] Device connection gate executed.
- [x] Runtime evidence artifacts collected.
- [${context.workloadEvidence.meetsLargeGraphThreshold ? 'x' : ' '}] Large-graph scenario evidence captured (>=10k nodes and >=1M edges).
- [ ] App startup behavior manually verified on device.
- [ ] Source panel behavior manually verified on device.
- [ ] Reader behavior manually verified on device.
- [ ] Path mode entry/exit behavior manually verified on device.

---

## 中文文档

### 设备快照
- 测试时间: ${context.isoTime}
- 设备序列号（脱敏）: ${context.maskedSerial}
- 设备型号: ${context.model || '未知'}
- Android 版本: ${context.androidVersion || '未知'}
- APK 路径: ${context.apkRelative}

### 证据文件
- 截图: [${path.basename(context.screenshotPath)}](./${path.basename(context.screenshotPath)})
- Logcat 尾部日志: [${path.basename(context.logcatPath)}](./${path.basename(context.logcatPath)})
- 证据清单: [${path.basename(context.manifestPath)}](./${path.basename(context.manifestPath)})

### 负载上下文
- 证据节点数: ${context.workloadEvidence.nodeCount || 0}
- 证据边数: ${context.workloadEvidence.edgeCount || 0}
- 大图阈值: 节点 >= ${context.workloadEvidence.thresholds.nodeCount}，边 >= ${context.workloadEvidence.thresholds.edgeCount}
- 是否满足大图阈值: ${context.workloadEvidence.meetsLargeGraphThreshold ? '是' : '否'}

### 验收清单状态
- [x] 已执行设备连接闸门检查。
- [x] 已采集运行时证据文件。
- [${context.workloadEvidence.meetsLargeGraphThreshold ? 'x' : ' '}] 已采集大图场景证据（>=10k 节点且 >=1M 边）。
- [ ] 待人工确认设备启动行为。
- [ ] 待人工确认数据源面板行为。
- [ ] 待人工确认 Reader 行为。
- [ ] 待人工确认 Path mode 进入/退出行为。
`;

  fs.writeFileSync(reportPath, `${report.trim()}\n`, 'utf8');
}

function main() {
  if (!fs.existsSync(apkPath)) {
    fail([
      'APK not found.',
      `Expected: ${apkPath}`,
      'Run `npm run mobile:build:capacitor` first.',
    ]);
  }

  const adbCommand = resolveAdbCommand();
  if (!adbCommand) {
    fail([
      'Unable to locate a working `adb` executable.',
      'Configure ADB_PATH or install Android Platform Tools (PATH / ANDROID_SDK_ROOT).',
    ]);
  }

  assertAdbAvailable(adbCommand);
  let devices = [];
  try {
    devices = listAdbDevices(adbCommand);
  } catch (error) {
    fail([
      'Failed to run `adb devices`.',
      error && error.stderr ? String(error.stderr).trim() : '',
    ]);
  }

  const onlineDevices = getOnlineDevices(devices).map((device) => device.serial);
  if (onlineDevices.length === 0) {
    fail([
      'No online Android device detected.',
      `Device states: ${formatDeviceStateSummary(devices)}`,
      'Connect a device (USB debugging enabled), accept authorization prompts, and run this command again.',
    ]);
  }

  const requestedSerial = String(process.env.NOTE_CONNECTION_ANDROID_SERIAL || '').trim();
  const serial = requestedSerial || onlineDevices[0];
  if (!onlineDevices.includes(serial)) {
    fail([
      `Requested serial is not online: ${serial}`,
      `Device states: ${formatDeviceStateSummary(devices)}`,
      `Online devices: ${onlineDevices.join(', ')}`,
    ]);
  }

  const model = getDeviceProperty(adbCommand, serial, 'ro.product.model');
  const androidVersion = getDeviceProperty(adbCommand, serial, 'ro.build.version.release');
  const now = new Date();
  const runId = `${timestampKey(now)}-${sanitizeSegment(maskSerial(serial) || serial || 'device')}`;
  const runDir = path.join(evidenceRoot, runId);
  fs.mkdirSync(runDir, { recursive: true });

  const screenshotPath = path.join(runDir, 'device-screenshot.png');
  const logcatPath = path.join(runDir, 'logcat-tail.txt');
  const manifestPath = path.join(runDir, 'acceptance_evidence.json');
  const reportPath = path.join(runDir, 'acceptance_evidence.md');
  const workloadEvidence = resolveWorkloadEvidence();
  const checklist = buildChecklist(workloadEvidence);

  captureScreenshot(adbCommand, serial, screenshotPath);
  captureLogcat(adbCommand, serial, logcatPath);
  writeEvidenceReport(reportPath, {
    dateLabel: now.toISOString().slice(0, 10),
    isoTime: now.toISOString(),
    runId,
    maskedSerial: maskSerial(serial),
    model,
    androidVersion,
    apkRelative: path.relative(repoRoot, apkPath).replace(/\\/g, '/'),
    screenshotPath,
    logcatPath,
    manifestPath,
    workloadEvidence,
  });
  writeEvidenceManifest(manifestPath, {
    isoTime: now.toISOString(),
    runId,
    maskedSerial: maskSerial(serial),
    model,
    androidVersion,
    runDir,
    apkRelative: toRepoRelative(apkPath),
    apkSizeBytes: fs.statSync(apkPath).size,
    apkSha256: sha256File(apkPath),
    screenshotPath,
    screenshotSizeBytes: fs.statSync(screenshotPath).size,
    screenshotSha256: sha256File(screenshotPath),
    logcatPath,
    logcatSizeBytes: fs.statSync(logcatPath).size,
    logcatSha256: sha256File(logcatPath),
    logcatLineCount: fileLineCount(logcatPath),
    reportPath,
    workloadEvidence,
    checklist,
  });
  writeLatestPointer(path.join(evidenceRoot, 'latest.json'), {
    isoTime: now.toISOString(),
    runId,
    maskedSerial: maskSerial(serial),
    runDir,
    manifestPath,
    reportPath,
  });

  console.log(`[Capacitor Evidence] Device: ${maskSerial(serial)}`);
  console.log(`[Capacitor Evidence] Output: ${path.relative(repoRoot, runDir).replace(/\\/g, '/')}`);
  console.log(`[Capacitor Evidence] Manifest: ${path.relative(repoRoot, manifestPath).replace(/\\/g, '/')}`);
  console.log(`[Capacitor Evidence] Report: ${path.relative(repoRoot, reportPath).replace(/\\/g, '/')}`);
  console.log(
    `[Capacitor Evidence] Workload evidence: nodes=${workloadEvidence.nodeCount || 0}, edges=${workloadEvidence.edgeCount || 0}, largeGraph=${workloadEvidence.meetsLargeGraphThreshold}`
  );
}

try {
  main();
} catch (error) {
  fail(String(error && error.message ? error.message : error));
}
