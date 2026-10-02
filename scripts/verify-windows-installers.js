const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { sha256File, computeSidecarSourceFingerprint } = require('./sidecar-build-fingerprint');

const root = path.resolve(__dirname, '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function installedRegistrations() {
  // Win32_Product queries can repair installed MSI products. Read only the
  // uninstall registry instead, before allowing either installer to execute.
  const script = `
$ErrorActionPreference = 'Stop'
$entries = @()
foreach ($root in @('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall', 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall', 'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall')) {
  if (Test-Path -LiteralPath $root) {
    $entries += @(Get-ChildItem -LiteralPath $root | Get-ItemProperty | Where-Object { $_.DisplayName -eq 'NoteConnection' } | Select-Object PSChildName, DisplayName, DisplayVersion, InstallLocation)
  }
}
ConvertTo-Json -InputObject @($entries) -Depth 3
`;
  const execution = spawnSync('powershell.exe', ['-NoProfile', '-Command', script], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  if (execution.error || execution.status !== 0) throw new Error(execution.error?.message || execution.stderr);
  return JSON.parse(execution.stdout.replace(/^\uFEFF/, ''));
}

function verifyInstalledPayload(directory, expectedFiles) {
  return expectedFiles.map(expected => {
    const file = path.join(directory, expected.name);
    assert(fs.existsSync(file), `Installed payload is missing ${expected.name}`);
    const observed = { name: expected.name, bytes: fs.statSync(file).size, sha256: sha256File(file) };
    assert.equal(observed.bytes, expected.bytes, `Installed size differs for ${expected.name}`);
    assert.equal(observed.sha256, expected.sha256, `Installed hash differs for ${expected.name}`);
    return observed;
  });
}

function fingerprintTauriInstallerExecutable(executable, bundleCode) {
  assert(['NSS', 'MSI'].includes(bundleCode), 'Unsupported Tauri Windows bundle marker');
  const bytes = fs.readFileSync(executable);
  const marker = Buffer.from('__TAURI_BUNDLE_TYPE_VAR_UNK');
  const offset = bytes.indexOf(marker);
  assert(offset >= 0 && bytes.indexOf(marker, offset + marker.length) === -1, 'Expected exactly one unstamped Tauri bundle marker');
  // tauri-utils 2.8 replaces these three bytes while packaging, then restores
  // the build executable. Derive the exact packaged hash; every other byte is
  // still checked, including when two installer formats share one build.
  Buffer.from(bundleCode).copy(bytes, offset + marker.length - 3);
  return { name: 'npm.exe', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}

function runInstaller(executable, args, logPath, spawnOptions = {}) {
  const logDescriptor = fs.openSync(logPath, 'w');
  const startedAt = Date.now();
  let execution;
  try {
    console.log(`[windows-installers] Installer start: ${path.basename(logPath)} (${path.basename(executable)})`);
    // Write evidence as it arrives; inherited output handles must not keep a
    // completed installer waiting for captured pipes to close.
    execution = spawnSync(executable, args, { encoding: 'utf8', windowsHide: true, timeout: 600000, ...spawnOptions, stdio: ['ignore', logDescriptor, logDescriptor] });
  } finally {
    fs.closeSync(logDescriptor);
  }
  console.log(`[windows-installers] Installer exit: ${path.basename(logPath)} status=${execution.status} error=${execution.error?.code || 'none'} elapsedMs=${Date.now() - startedAt}`);
  assert(!execution.error, execution.error?.message);
  assert([0, 3010].includes(execution.status), `${path.basename(executable)} exited ${execution.status}; see ${logPath}`);
  return { exitCode: execution.status, rebootRequested: execution.status === 3010 };
}

function readMsiFailureContext(logPath) {
  if (!fs.existsSync(logPath)) return `MSI did not create its detailed log: ${logPath}`;
  const bytes = fs.readFileSync(logPath);
  // Windows Installer writes UTF-16LE logs. Keep diagnostics in the step output
  // as well as the artifact, whose upload may fail independently of uninstall.
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf16le' : 'utf8';
  return bytes.toString(encoding).replace(/^\uFEFF/, '').slice(-64 * 1024);
}

function verifyInstalledRuntime(installDirectory, runDirectory) {
  const startedAt = Date.now();
  console.log(`[windows-installers] Runtime start: ${path.basename(runDirectory)}`);
  const execution = spawnSync('powershell.exe', ['-NoProfile', '-File', path.join(__dirname, 'verify-elevated-desktop-runtime.ps1'), '-ExecutablePath', path.join(installDirectory, 'npm.exe'), '-ReportDirectory', runDirectory, '-NodeExecutablePath', process.execPath], {
    cwd: root, encoding: 'utf8', windowsHide: true, timeout: 300000, maxBuffer: 4 * 1024 * 1024,
  });
  console.log(`[windows-installers] Runtime exit: ${path.basename(runDirectory)} status=${execution.status} error=${execution.error?.code || 'none'} elapsedMs=${Date.now() - startedAt}`);
  fs.writeFileSync(`${runDirectory}.log`, `${execution.stdout || ''}\n${execution.stderr || ''}`);
  assert(!execution.error, execution.error?.message);
  const reportPath = path.join(runDirectory, 'report.json');
  assert(fs.existsSync(reportPath), `Installed runtime did not produce evidence: ${execution.stderr || execution.stdout}`);
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(execution.status, 0, `Installed desktop runtime failed: ${report.error || report.shutdownError || 'no successful verdict'}; see ${runDirectory}.log`);
  assert.equal(report.passed, true, 'A zero process exit without a passed runtime report is not acceptance');
  assert.equal(report.checks.godotLayout, true);
  assert.equal(report.checks.windowTransitions, true);
  const policy = JSON.parse(fs.readFileSync(path.join(runDirectory, 'native-debug-policy.json'), 'utf8').replace(/^\uFEFF/, ''));
  assert.equal(policy.policyValuesRemoved, true, 'Temporary WebView2 policies must be removed before acceptance');
  return { report: path.relative(root, path.join(runDirectory, 'report.json')).replace(/\\/g, '/'), passed: true };
}

async function verifyUninstalled(installDirectory, expectedFiles) {
  const deadline = Date.now() + 30000;
  do {
    const remaining = [...expectedFiles.map(file => file.name), 'uninstall.exe'].filter(name => fs.existsSync(path.join(installDirectory, name)));
    const registrations = installedRegistrations();
    if (remaining.length === 0 && registrations.length === 0) return { payloadRemoved: true, registrationRemoved: true };
    if (Date.now() >= deadline) throw new Error(`Uninstall incomplete: ${remaining.join(', ')}; registrations=${JSON.stringify(registrations)}`);
    await delay(500);
  } while (true);
}

async function qualifyNsisInstaller(installer, directory, expectedFiles) {
  assert.equal(installedRegistrations().length, 0, 'Refusing to replace an existing NoteConnection installation');
  const installDirectory = path.join(directory, 'NSIS installed');
  const runtimeDirectory = path.join(directory, 'nsis-runtime');
  const report = { installer, installerSha256: sha256File(installer), installDirectory };
  try {
    // NSIS requires /D last and unquoted, including paths containing spaces.
    report.install = runInstaller(installer, ['/S', `/D=${installDirectory}`], path.join(directory, 'nsis-install.log'), { windowsVerbatimArguments: true });
    report.payload = verifyInstalledPayload(installDirectory, expectedFiles);
    report.registrations = installedRegistrations();
    assert.equal(report.registrations.length, 1, 'NSIS must register one installed product');
    report.runtime = verifyInstalledRuntime(installDirectory, runtimeDirectory);
  } catch (error) { report.error = error.stack || String(error); }
  finally {
    try {
      const uninstaller = path.join(installDirectory, 'uninstall.exe');
      assert(fs.existsSync(uninstaller), 'NSIS did not install its uninstaller');
      report.uninstall = runInstaller(uninstaller, ['/S'], path.join(directory, 'nsis-uninstall.log'));
      report.removal = await verifyUninstalled(installDirectory, expectedFiles);
      if (report.runtime?.passed) {
        assert(fs.existsSync(path.join(runtimeDirectory, 'runtime/graph_data.json')), 'Uninstall must preserve external runtime data');
        report.removal.runtimeDataPreserved = true;
      }
    } catch (error) { report.uninstallError = error.stack || String(error); }
  }
  report.passed = !report.error && !report.uninstallError;
  return report;
}

async function qualifyMsiInstaller(installer, directory, expectedFiles) {
  assert.equal(installedRegistrations().length, 0, 'Refusing to replace an existing NoteConnection installation');
  const installDirectory = path.join(directory, 'MSI installed');
  const runtimeDirectory = path.join(directory, 'msi-runtime');
  const report = { installer, installerSha256: sha256File(installer), installDirectory };
  try {
    report.install = runInstaller('msiexec.exe', ['/i', `"${installer}"`, '/qn', '/norestart', `INSTALLDIR="${installDirectory}"`, '/l*v', `"${path.join(directory, 'msi-install-detail.log')}"`], path.join(directory, 'msi-install.log'), { windowsVerbatimArguments: true });
    report.payload = verifyInstalledPayload(installDirectory, expectedFiles);
    report.registrations = installedRegistrations();
    assert.equal(report.registrations.length, 1, 'MSI must register one installed product');
    report.runtime = verifyInstalledRuntime(installDirectory, runtimeDirectory);
  } catch (error) {
    report.error = error.stack || String(error);
    report.installDetail = readMsiFailureContext(path.join(directory, 'msi-install-detail.log'));
    console.error(report.installDetail);
  }
  finally {
    try {
      report.uninstall = runInstaller('msiexec.exe', ['/x', `"${installer}"`, '/qn', '/norestart', '/l*v', `"${path.join(directory, 'msi-uninstall-detail.log')}"`], path.join(directory, 'msi-uninstall.log'), { windowsVerbatimArguments: true });
      report.removal = await verifyUninstalled(installDirectory, expectedFiles);
      if (report.runtime?.passed) {
        assert(fs.existsSync(path.join(runtimeDirectory, 'runtime/graph_data.json')), 'Uninstall must preserve external runtime data');
        report.removal.runtimeDataPreserved = true;
      }
    } catch (error) {
      report.uninstallError = error.stack || String(error);
      report.uninstallDetail = readMsiFailureContext(path.join(directory, 'msi-uninstall-detail.log'));
      console.error(report.uninstallDetail);
    }
  }
  report.passed = !report.error && !report.uninstallError;
  return report;
}

function recordInstallerBuild(repoRoot = root, environment = process.env) {
  const version = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).version;
  const sidecarFiles = Object.entries({
    'server.exe': 'src-tauri/bin/server-x86_64-pc-windows-msvc.exe',
    'godot.exe': 'src-tauri/bin/godot-x86_64-pc-windows-msvc.exe',
    'markdown-worker.exe': 'src-tauri/bin/markdown-worker-x86_64-pc-windows-msvc.exe',
    'path_mode.pck': 'output/desktop/path_mode.pck',
  }).map(([name, relative]) => ({ name, bytes: fs.statSync(path.join(repoRoot, relative)).size, sha256: sha256File(path.join(repoRoot, relative)) }));
  const executable = path.join(repoRoot, 'src-tauri/target/release/npm.exe');
  const expectedFiles = {
    nsis: [fingerprintTauriInstallerExecutable(executable, 'NSS'), ...sidecarFiles],
    msi: [fingerprintTauriInstallerExecutable(executable, 'MSI'), ...sidecarFiles],
  };
  const installers = {};
  for (const [format, name] of Object.entries({ nsis: `NoteConnection_${version}_x64-setup.exe`, msi: `NoteConnection_${version}_x64_en-US.msi` })) {
    const relative = `src-tauri/target/release/bundle/${format}/${name}`;
    const file = path.join(repoRoot, relative);
    if (fs.existsSync(file)) installers[format] = { name, path: relative, bytes: fs.statSync(file).size, sha256: sha256File(file) };
  }
  assert(Object.keys(installers).length > 0, 'No built installer to record');
  const receipt = {
    schemaVersion: 1, sourceRevision: environment.GITHUB_SHA, runId: environment.GITHUB_RUN_ID,
    buildRunAttempt: environment.GITHUB_RUN_ATTEMPT, version,
    sourceFingerprint: computeSidecarSourceFingerprint(repoRoot), expectedFiles, installers,
  };
  const receiptPath = path.join(repoRoot, 'output/verification/windows-installer-build.json');
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}

function readInstallerBuild(format, repoRoot = root, environment = process.env) {
  assert(['nsis', 'msi'].includes(format), 'Unsupported installer format');
  const receipt = JSON.parse(fs.readFileSync(path.join(repoRoot, 'output/verification/windows-installer-build.json'), 'utf8'));
  assert.equal(receipt.schemaVersion, 1, 'Unsupported installer build receipt');
  assert(/^[a-f0-9]{40}$/i.test(environment.GITHUB_SHA || ''), 'Missing source revision');
  assert.equal(receipt.sourceRevision, environment.GITHUB_SHA, 'Installer source revision differs');
  assert(/^\d+$/.test(environment.GITHUB_RUN_ID || ''), 'Missing workflow run ID');
  assert.equal(receipt.runId, environment.GITHUB_RUN_ID, 'Installer workflow run differs');
  const buildAttempt = Number(receipt.buildRunAttempt);
  const qualificationAttempt = Number(environment.GITHUB_RUN_ATTEMPT);
  assert(Number.isSafeInteger(buildAttempt) && buildAttempt > 0 && Number.isSafeInteger(qualificationAttempt) && buildAttempt <= qualificationAttempt, 'Invalid installer build attempt');
  const version = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).version;
  assert.equal(receipt.version, version, 'Installer version differs');
  assert.deepEqual(receipt.sourceFingerprint, computeSidecarSourceFingerprint(repoRoot), 'Installer source fingerprint differs');
  const payloadNames = ['npm.exe', 'server.exe', 'godot.exe', 'markdown-worker.exe', 'path_mode.pck'];
  for (const bundle of ['nsis', 'msi']) {
    const files = receipt.expectedFiles?.[bundle];
    assert(Array.isArray(files), 'Missing installer payload expectations');
    assert.deepEqual(files.map(file => file.name), payloadNames, 'Unexpected installer payload names');
    for (const file of files) assert(Number.isSafeInteger(file.bytes) && file.bytes > 0 && /^[a-f0-9]{64}$/.test(file.sha256), 'Invalid installer payload identity');
  }
  const installer = receipt.installers?.[format];
  const name = format === 'nsis' ? `NoteConnection_${version}_x64-setup.exe` : `NoteConnection_${version}_x64_en-US.msi`;
  assert(installer, 'Missing installer identity');
  assert.equal(installer.name, name, 'Installer basename differs');
  assert.equal(installer.path, `src-tauri/target/release/bundle/${format}/${name}`, 'Installer path differs');
  const installerPath = path.join(repoRoot, installer.path);
  assert.equal(fs.statSync(installerPath).size, installer.bytes, 'Installer size differs');
  assert.equal(sha256File(installerPath), installer.sha256, 'Installer hash differs');
  return receipt;
}

function createInstallerQualification(format) {
  assert(process.platform === 'win32' && process.arch === 'x64', 'Windows x64 is required');
  assert(process.env.GITHUB_ACTIONS === 'true' && process.env.RUNNER_ENVIRONMENT === 'github-hosted', 'Installer qualification is restricted to disposable GitHub-hosted runners');
  // Validate provenance and bytes before querying registrations or executing installers.
  const receipt = readInstallerBuild(format);
  const directory = path.join(root, 'output/verification/windows-installers', `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`);
  assert(!fs.existsSync(directory), 'Installer evidence directory must be fresh');
  fs.mkdirSync(directory, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(), sourceRevision: receipt.sourceRevision,
    runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    buildRunAttempt: receipt.buildRunAttempt, sourceFingerprint: receipt.sourceFingerprint, expectedFiles: receipt.expectedFiles,
    signingScope: 'Installer behavior only; signing trust is not qualified.',
  };
  return { directory, installer: path.join(root, receipt.installers[format].path), expectedFiles: receipt.expectedFiles, report };
}

function writeInstallerQualification(directory, report) {
  fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  process.exitCode = report.passed ? 0 : 1;
}

async function qualifyNsisArtifact() {
  const { directory, installer, expectedFiles, report } = createInstallerQualification('nsis');
  try {
    report.nsis = await qualifyNsisInstaller(installer, directory, expectedFiles.nsis);
    report.passed = report.nsis.passed;
  } catch (error) { report.error = error.stack || String(error); report.passed = false; }
  writeInstallerQualification(directory, report);
}

async function qualifyMsiArtifact() {
  const { directory, installer, expectedFiles, report } = createInstallerQualification('msi');
  try {
    report.msi = await qualifyMsiInstaller(installer, directory, expectedFiles.msi);
    report.passed = report.msi.passed;
  } catch (error) { report.error = error.stack || String(error); report.passed = false; }
  writeInstallerQualification(directory, report);
}

if (require.main === module) throw new Error('Run qualifyNsisArtifact() or qualifyMsiArtifact() on separate disposable runners.');
module.exports = { recordInstallerBuild, readInstallerBuild, verifyInstalledPayload, fingerprintTauriInstallerExecutable, verifyInstalledRuntime, readMsiFailureContext, qualifyNsisArtifact, qualifyMsiArtifact };
