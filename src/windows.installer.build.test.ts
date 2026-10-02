import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

jest.mock('node:child_process', () => ({ ...jest.requireActual('node:child_process'), spawnSync: jest.fn() }));
const { recordInstallerBuild, readInstallerBuild } = require('../scripts/verify-windows-installers');

describe('installer build provenance across fresh runners', () => {
  let directory: string;
  let receiptPath: string;
  const environment = { GITHUB_SHA: 'a'.repeat(40), GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1' };
  const write = (relative: string, contents: string) => {
    const file = path.join(directory, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
  };

  beforeEach(() => {
    const temporaryRoot = path.resolve(__dirname, '../output/verification/installer-build-tests');
    fs.mkdirSync(temporaryRoot, { recursive: true });
    directory = fs.mkdtempSync(path.join(temporaryRoot, 'receipt-'));
    receiptPath = path.join(directory, 'output/verification/windows-installer-build.json');
    write('package.json', JSON.stringify({ version: '1.8.0' }));
    write('src/fixture.ts', 'export const source = 1;');
    write('src-tauri/target/release/npm.exe', 'PE __TAURI_BUNDLE_TYPE_VAR_UNK fixture');
    for (const name of ['server', 'godot', 'markdown-worker']) write(`src-tauri/bin/${name}-x86_64-pc-windows-msvc.exe`, name);
    write('output/desktop/path_mode.pck', 'GDPC fixture');
    write('src-tauri/target/release/bundle/nsis/NoteConnection_1.8.0_x64-setup.exe', 'NSIS fixture');
    write('src-tauri/target/release/bundle/msi/NoteConnection_1.8.0_x64_en-US.msi', 'MSI fixture');
    recordInstallerBuild(directory, environment);
  });
  afterEach(() => {
    expect(spawnSync).not.toHaveBeenCalled();
    jest.clearAllMocks();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  test.each(['nsis', 'msi'])('accepts %s without build dependencies, including failed-only retries', format => {
    // A qualification runner has only source, the receipt and its installer.
    fs.rmSync(path.join(directory, 'src-tauri/bin'), { recursive: true });
    fs.unlinkSync(path.join(directory, 'src-tauri/target/release/npm.exe'));
    fs.rmSync(path.join(directory, 'output/desktop'), { recursive: true });
    const receipt = readInstallerBuild(format, directory, { ...environment, GITHUB_RUN_ATTEMPT: '2' });
    expect(receipt.buildRunAttempt).toBe('1');
    expect(receipt.expectedFiles[format]).toHaveLength(5);
    expect(readInstallerBuild(format, directory, environment)).toEqual(receipt);
  });

  test.each([
    ['sourceRevision', 'b'.repeat(40), /source revision differs/],
    ['runId', '456', /workflow run differs/],
    ['version', '9.0.0', /version differs/],
    ['buildRunAttempt', '0', /build attempt/],
    ['buildRunAttempt', '2', /build attempt/],
    ['sourceFingerprint', {}, /source fingerprint differs/],
  ])('rejects tampered %s before executing anything', (field, replacement, message) => {
    const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    receipt[field as string] = replacement;
    fs.writeFileSync(receiptPath, JSON.stringify(receipt));
    expect(() => readInstallerBuild('msi', directory, environment)).toThrow(message as RegExp);
  });

  test.each(['name', 'path'])('rejects redirected installer %s', field => {
    const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    receipt.installers.msi[field] = '../other.msi';
    fs.writeFileSync(receiptPath, JSON.stringify(receipt));
    expect(() => readInstallerBuild('msi', directory, environment)).toThrow(/Installer (basename|path) differs/);
  });

  test.each(['MSI altered', 'truncated'])('rejects altered installer bytes (%s)', contents => {
    write('src-tauri/target/release/bundle/msi/NoteConnection_1.8.0_x64_en-US.msi', contents);
    expect(() => readInstallerBuild('msi', directory, environment)).toThrow(/Installer (size|hash) differs/);
  });

  test('rejects changed source and missing receipts without recomputing build expectations', () => {
    write('src/fixture.ts', 'export const source = 2;');
    expect(() => readInstallerBuild('msi', directory, environment)).toThrow(/source fingerprint differs/);
    fs.unlinkSync(receiptPath);
    expect(() => readInstallerBuild('msi', directory, environment)).toThrow(/ENOENT/);
  });
});
