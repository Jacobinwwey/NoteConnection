#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const apkPath = path.join(repoRoot, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const evidenceRoot = path.join(repoRoot, 'docs', 'mobile-evidence');

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: options.encoding || 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

function fail(lines) {
  const normalized = Array.isArray(lines) ? lines : [String(lines)];
  normalized.forEach((line) => {
    if (line && String(line).trim().length > 0) {
      console.error(`[Capacitor Evidence] ${line}`);
    }
  });
  process.exit(1);
}

function assertAdbAvailable() {
  const version = run('adb', ['version']);
  if (version.error || version.status !== 0) {
    fail([
      '`adb` is not available in PATH.',
      'Install Android Platform Tools and ensure `adb` is resolvable.',
    ]);
  }
}

function listOnlineDevices() {
  const result = run('adb', ['devices']);
  if (result.error || result.status !== 0) {
    fail([
      'Failed to run `adb devices`.',
      result.stderr ? `stderr: ${result.stderr.trim()}` : '',
    ]);
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .slice(1)
    .filter((line) => /\tdevice$/.test(line))
    .map((line) => line.split('\t')[0]);
}

function getDeviceProperty(serial, propertyName) {
  const result = run('adb', ['-s', serial, 'shell', 'getprop', propertyName]);
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

function captureScreenshot(serial, screenshotPath) {
  const capture = run('adb', ['-s', serial, 'exec-out', 'screencap', '-p'], { encoding: 'buffer' });
  if (capture.error || capture.status !== 0 || !capture.stdout || capture.stdout.length === 0) {
    fail([
      'Failed to capture screenshot from device.',
      capture.stderr ? String(capture.stderr).trim() : '',
    ]);
  }

  fs.writeFileSync(screenshotPath, capture.stdout);
}

function captureLogcat(serial, logcatPath) {
  const logcat = run('adb', ['-s', serial, 'logcat', '-d', '-v', 'time']);
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

### Checklist Status
- [x] Device connection gate executed.
- [x] Runtime evidence artifacts collected.
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

### 验收清单状态
- [x] 已执行设备连接闸门检查。
- [x] 已采集运行时证据文件。
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

  assertAdbAvailable();
  const onlineDevices = listOnlineDevices();
  if (onlineDevices.length === 0) {
    fail([
      'No online Android device detected.',
      'Connect a device (USB debugging enabled) and run this command again.',
    ]);
  }

  const requestedSerial = String(process.env.NOTE_CONNECTION_ANDROID_SERIAL || '').trim();
  const serial = requestedSerial || onlineDevices[0];
  if (!onlineDevices.includes(serial)) {
    fail([
      `Requested serial is not online: ${serial}`,
      `Online devices: ${onlineDevices.join(', ')}`,
    ]);
  }

  const model = getDeviceProperty(serial, 'ro.product.model');
  const androidVersion = getDeviceProperty(serial, 'ro.build.version.release');
  const now = new Date();
  const runId = `${timestampKey(now)}-${sanitizeSegment(maskSerial(serial) || serial || 'device')}`;
  const runDir = path.join(evidenceRoot, runId);
  fs.mkdirSync(runDir, { recursive: true });

  const screenshotPath = path.join(runDir, 'device-screenshot.png');
  const logcatPath = path.join(runDir, 'logcat-tail.txt');
  const reportPath = path.join(runDir, 'acceptance_evidence.md');

  captureScreenshot(serial, screenshotPath);
  captureLogcat(serial, logcatPath);

  writeEvidenceReport(reportPath, {
    dateLabel: now.toISOString().slice(0, 10),
    isoTime: now.toISOString(),
    maskedSerial: maskSerial(serial),
    model,
    androidVersion,
    apkRelative: path.relative(repoRoot, apkPath).replace(/\\/g, '/'),
    screenshotPath,
    logcatPath,
  });

  console.log(`[Capacitor Evidence] Device: ${maskSerial(serial)}`);
  console.log(`[Capacitor Evidence] Output: ${path.relative(repoRoot, runDir).replace(/\\/g, '/')}`);
  console.log(`[Capacitor Evidence] Report: ${path.relative(repoRoot, reportPath).replace(/\\/g, '/')}`);
}

try {
  main();
} catch (error) {
  fail(String(error && error.message ? error.message : error));
}
