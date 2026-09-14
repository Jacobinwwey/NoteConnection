import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
const { verifyInstalledPayload, fingerprintTauriInstallerExecutable } = require('../scripts/verify-windows-installers');
const { sha256File } = require('../scripts/sidecar-build-fingerprint');

describe('installed Windows payload verification', () => {
  let directory: string;
  let expected: Array<{ name: string; bytes: number; sha256: string }>;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'installed payload '));
    fs.writeFileSync(path.join(directory, 'path_mode.pck'), 'GDPC fixture');
    expected = [{ name: 'path_mode.pck', bytes: 12, sha256: sha256File(path.join(directory, 'path_mode.pck')) }];
  });

  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  test('matches exact packaged bytes under paths containing spaces', () => {
    expect(verifyInstalledPayload(directory, expected)).toEqual(expected);
  });

  test('rejects missing resources even when the installer reported success', () => {
    fs.unlinkSync(path.join(directory, 'path_mode.pck'));
    expect(() => verifyInstalledPayload(directory, expected)).toThrow(/missing path_mode.pck/);
  });

  test('rejects same-sized stale resources', () => {
    fs.writeFileSync(path.join(directory, 'path_mode.pck'), 'GDPC altered');
    expect(() => verifyInstalledPayload(directory, expected)).toThrow(/hash differs/);
  });

  test.each(['NSS', 'MSI'])('checks the exact Tauri %s stamp without ignoring executable bytes', (bundleCode) => {
    const executable = path.join(directory, 'build.exe');
    fs.writeFileSync(executable, 'PE before\0__TAURI_BUNDLE_TYPE_VAR_UNK\0PE after');
    const fingerprint = fingerprintTauriInstallerExecutable(executable, bundleCode);
    fs.writeFileSync(path.join(directory, 'npm.exe'), `PE before\0__TAURI_BUNDLE_TYPE_VAR_${bundleCode}\0PE after`);
    expect(verifyInstalledPayload(directory, [fingerprint])).toEqual([fingerprint]);
    fs.writeFileSync(path.join(directory, 'npm.exe'), `PE edited\0__TAURI_BUNDLE_TYPE_VAR_${bundleCode}\0PE after`);
    expect(() => verifyInstalledPayload(directory, [fingerprint])).toThrow(/hash differs/);
    expect(fs.readFileSync(executable, 'utf8')).toContain('_VAR_UNK');
  });

  test.each(['missing marker', '__TAURI_BUNDLE_TYPE_VAR_UNK__TAURI_BUNDLE_TYPE_VAR_UNK'])('rejects missing or ambiguous bundle stamps (%s)', (contents) => {
    const executable = path.join(directory, 'build.exe');
    fs.writeFileSync(executable, contents);
    expect(() => fingerprintTauriInstallerExecutable(executable, 'NSS')).toThrow(/exactly one/);
  });
});
