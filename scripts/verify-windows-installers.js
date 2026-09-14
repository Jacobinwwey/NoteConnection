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
  const execution = spawnSync(executable, args, { encoding: 'utf8', windowsHide: true, timeout: 600000, ...spawnOptions });
  fs.writeFileSync(logPath, `${execution.stdout || ''}\n${execution.stderr || ''}`);
  assert(!execution.error, execution.error?.message);
  assert([0, 3010].includes(execution.status), `${path.basename(executable)} exited ${execution.status}; see ${logPath}`);
  return { exitCode: execution.status, rebootRequested: execution.status === 3010 };
}

function verifyInstalledRuntime(installDirectory, runDirectory) {
  const execution = spawnSync(process.execPath, [path.join(__dirname, 'verify-desktop-runtime.js'), path.join(installDirectory, 'npm.exe'), runDirectory], {
    cwd: root, encoding: 'utf8', windowsHide: true, timeout: 300000, maxBuffer: 4 * 1024 * 1024,
  });
  fs.writeFileSync(`${runDirectory}.log`, `${execution.stdout || ''}\n${execution.stderr || ''}`);
  assert(!execution.error, execution.error?.message);
  assert.equal(execution.status, 0, `Installed desktop runtime failed; see ${runDirectory}.log`);
  const report = JSON.parse(fs.readFileSync(path.join(runDirectory, 'report.json'), 'utf8'));
  assert.equal(report.passed, true, 'A zero process exit without a passed runtime report is not acceptance');
  assert.equal(report.checks.godotLayout, true);
  assert.equal(report.checks.windowTransitions, true);
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
  } catch (error) { report.error = error.stack || String(error); }
  finally {
    try {
      report.uninstall = runInstaller('msiexec.exe', ['/x', `"${installer}"`, '/qn', '/norestart', '/l*v', `"${path.join(directory, 'msi-uninstall-detail.log')}"`], path.join(directory, 'msi-uninstall.log'), { windowsVerbatimArguments: true });
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

async function main() {
  assert(process.platform === 'win32' && process.arch === 'x64', 'Windows x64 is required');
  assert(process.env.GITHUB_ACTIONS === 'true' && process.env.RUNNER_ENVIRONMENT === 'github-hosted', 'Installer qualification is restricted to disposable GitHub-hosted runners');
  const directory = path.join(root, 'output/verification/windows-installers', `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`);
  assert(!fs.existsSync(directory), 'Installer evidence directory must be fresh');
  fs.mkdirSync(directory, { recursive: true });
  const version = require('../package.json').version;
  const sidecarFiles = Object.entries({
    'server.exe': 'src-tauri/bin/server-x86_64-pc-windows-msvc.exe',
    'godot.exe': 'src-tauri/bin/godot-x86_64-pc-windows-msvc.exe',
    'markdown-worker.exe': 'src-tauri/bin/markdown-worker-x86_64-pc-windows-msvc.exe',
    'path_mode.pck': 'output/desktop/path_mode.pck',
  }).map(([name, relative]) => ({ name, bytes: fs.statSync(path.join(root, relative)).size, sha256: sha256File(path.join(root, relative)) }));
  const executable = path.join(root, 'src-tauri/target/release/npm.exe');
  const expectedFiles = {
    nsis: [fingerprintTauriInstallerExecutable(executable, 'NSS'), ...sidecarFiles],
    msi: [fingerprintTauriInstallerExecutable(executable, 'MSI'), ...sidecarFiles],
  };
  const report = {
    generatedAt: new Date().toISOString(), sourceRevision: process.env.GITHUB_SHA,
    runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    sourceFingerprint: computeSidecarSourceFingerprint(root), expectedFiles,
    signingScope: 'Installer behavior only; signing trust is not qualified.',
  };
  try {
    report.nsis = await qualifyNsisInstaller(path.join(root, `src-tauri/target/release/bundle/nsis/NoteConnection_${version}_x64-setup.exe`), directory, expectedFiles.nsis);
    report.msi = await qualifyMsiInstaller(path.join(root, `src-tauri/target/release/bundle/msi/NoteConnection_${version}_x64_en-US.msi`), directory, expectedFiles.msi);
    report.passed = report.nsis.passed && report.msi.passed;
  } catch (error) { report.error = error.stack || String(error); report.passed = false; }
  fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  process.exitCode = report.passed ? 0 : 1;
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { verifyInstalledPayload, fingerprintTauriInstallerExecutable };
