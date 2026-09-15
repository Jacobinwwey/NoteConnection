import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

jest.mock('node:child_process', () => ({ ...jest.requireActual('node:child_process'), spawnSync: jest.fn() }));
const { verifyInstalledRuntime } = require('../scripts/verify-windows-installers');
const spawn = spawnSync as jest.Mock;

describe('installed runtime evidence verdict', () => {
  let directory: string;
  let run: string;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'installer-runtime-'));
    run = path.join(directory, 'runtime');
    fs.mkdirSync(run);
    spawn.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    fs.writeFileSync(path.join(run, 'report.json'), JSON.stringify({ passed: true, checks: { godotLayout: true, windowTransitions: true } }));
    fs.writeFileSync(path.join(run, 'native-debug-policy.json'), '\uFEFF' + JSON.stringify({ policyValuesRemoved: true }));
  });
  afterEach(() => { jest.resetAllMocks(); fs.rmSync(directory, { recursive: true, force: true }); });

  test('accepts completed runtime evidence only after temporary policies are removed', () => {
    expect(verifyInstalledRuntime(directory, run).passed).toBe(true);
    expect(spawn.mock.calls[0][0]).toBe('powershell.exe');
    expect(spawn.mock.calls[0][1]).toContain(path.resolve(__dirname, '../scripts/verify-elevated-desktop-runtime.ps1'));
  });

  test('rejects a successful runtime when machine policy cleanup did not complete', () => {
    fs.writeFileSync(path.join(run, 'native-debug-policy.json'), JSON.stringify({ policyValuesRemoved: false }));
    expect(() => verifyInstalledRuntime(directory, run)).toThrow(/policies must be removed/);
  });

  test('does not accept an empty successful process or lose its setup failure', () => {
    fs.unlinkSync(path.join(run, 'report.json'));
    spawn.mockReturnValue({ status: 1, stdout: '', stderr: 'Existing app policy cannot be overwritten' });
    expect(() => verifyInstalledRuntime(directory, run)).toThrow(/Existing app policy cannot be overwritten/);
  });
});
