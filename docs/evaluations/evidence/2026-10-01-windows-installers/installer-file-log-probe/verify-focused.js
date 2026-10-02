const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../../..');
const temp = path.join(__dirname, 'temp');
fs.mkdirSync(temp, { recursive: true });
const args = [
  'node_modules/jest/bin/jest.js',
  'src/windows.installer.runtime.test.ts',
  'src/windows.installer.payload.test.ts',
  'src/desktop.godot.pack.test.ts',
  'src/desktop.runtime.graph.test.ts',
  '--runInBand', '--ci', '--cacheDirectory', path.join(__dirname, 'jest-cache'),
];
const startedAt = new Date().toISOString();
const execution = spawnSync(process.execPath, args, {
  cwd: root,
  env: { ...process.env, TEMP: temp, TMP: temp, TMPDIR: temp },
  encoding: 'utf8', windowsHide: true, timeout: 180000, maxBuffer: 8 * 1024 * 1024,
});
fs.writeFileSync(path.join(__dirname, 'focused-tests.log'), `${execution.stdout || ''}\n${execution.stderr || ''}`);
const receipt = { startedAt, completedAt: new Date().toISOString(), executable: process.execPath, args, temp, status: execution.status, error: execution.error?.message, passed: !execution.error && execution.status === 0 };
fs.writeFileSync(path.join(__dirname, 'focused-tests.json'), JSON.stringify(receipt, null, 2) + '\n');
process.stdout.write(execution.stdout || '');
process.stderr.write(execution.stderr || '');
console.log(JSON.stringify(receipt));
process.exitCode = receipt.passed ? 0 : 1;
