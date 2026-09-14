import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
const { verifyInstalledPayload } = require('../scripts/verify-windows-installers');
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
});
