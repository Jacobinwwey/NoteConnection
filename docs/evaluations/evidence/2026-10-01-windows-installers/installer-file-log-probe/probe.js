const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../../..');
const sourcePath = path.join(root, 'scripts/verify-windows-installers.js');
const output = path.join(__dirname, `run-${Date.now()}`);
fs.mkdirSync(output);
const localRequire = createRequire(sourcePath);
const descriptors = [];
const trackedFs = Object.create(fs);
trackedFs.openSync = (...args) => {
  const descriptor = fs.openSync(...args);
  descriptors.push(descriptor);
  return descriptor;
};
const executions = [];
const trackedSpawnSync = (...args) => {
  const execution = spawnSync(...args);
  executions.push({ executable: args[0], options: args[2], execution });
  return execution;
};
const messages = [];
const context = vm.createContext({
  require: name => name === 'node:fs' ? trackedFs : name === 'node:child_process' ? { spawnSync: trackedSpawnSync } : localRequire(name),
  module: { exports: {} },
  __dirname: path.dirname(sourcePath),
  process,
  Buffer,
  console: { log: message => { messages.push(message); console.log(message); }, error: console.error },
  setTimeout,
});
vm.runInContext(fs.readFileSync(sourcePath, 'utf8'), context, { filename: sourcePath });
const child = path.join(output, 'child with spaces.js');
fs.writeFileSync(child, `const fs = require('node:fs');
const [mode, marker] = process.argv.slice(2);
fs.writeSync(1, 'stdout:' + mode + '\\n');
fs.writeSync(2, 'stderr:' + mode + '\\n');
if (mode === 'error') process.exitCode = 7;
if (mode === 'timeout') {
  fs.writeFileSync(marker, String(process.pid));
  setInterval(() => fs.writeSync(1, 'alive\\n'), 100);
}
`);

function assertClosed() {
  assert.throws(() => fs.fstatSync(descriptors.at(-1)), { code: 'EBADF' });
}

const successLog = path.join(output, 'success.log');
const success = context.runInstaller(process.execPath, [child, 'success'], successLog);
assert.equal(success.exitCode, 0);
assert.equal(success.rebootRequested, false);
assert.match(fs.readFileSync(successLog, 'utf8'), /stdout:success\r?\nstderr:success/);
assertClosed();

const errorLog = path.join(output, 'error.log');
assert.throws(() => context.runInstaller(process.execPath, [child, 'error'], errorLog), /exited 7/);
assert.match(fs.readFileSync(errorLog, 'utf8'), /stdout:error\r?\nstderr:error/);
assertClosed();

const timeoutLog = path.join(output, 'timeout.log');
const timeoutMarker = path.join(output, 'timeout.pid');
const timeoutStarted = Date.now();
assert.throws(() => context.runInstaller(process.execPath, [child, 'timeout', timeoutMarker], timeoutLog, { timeout: 1500 }), /ETIMEDOUT/);
const timeoutElapsedMs = Date.now() - timeoutStarted;
assert(timeoutElapsedMs >= 1400 && timeoutElapsedMs < 10000, `Unexpected timeout duration: ${timeoutElapsedMs}`);
assert.match(fs.readFileSync(timeoutLog, 'utf8'), /stdout:timeout\r?\nstderr:timeout\r?\nalive/);
assert.equal(executions.at(-1).execution.error.code, 'ETIMEDOUT');
const childPid = Number(fs.readFileSync(timeoutMarker, 'utf8'));
assert.throws(() => process.kill(childPid, 0), { code: 'ESRCH' });
assertClosed();

const invalidLog = path.join(output, 'invalid-options.log');
assert.throws(() => context.runInstaller(process.execPath, [child, 'success'], invalidLog, { timeout: -1 }), /timeout/);
assertClosed();

assert.equal(executions.length, 3);
assert.equal(executions[0].options.timeout, 600000);
for (const execution of executions) {
  assert.equal(execution.options.stdio[0], 'ignore');
  assert.equal(typeof execution.options.stdio[1], 'number');
  assert.equal(execution.options.stdio[1], execution.options.stdio[2]);
  assert.equal(execution.options.windowsHide, true);
}
assert.equal(messages.filter(message => message.includes('Installer exit:')).length, 3);
assert(messages.some(message => message.includes('status=7')));
assert(messages.some(message => message.includes('error=ETIMEDOUT')));
const report = { passed: true, output, node: process.version, platform: process.platform, successAndErrorOutputRetained: true, timeoutOutputRetained: true, timeoutElapsedMs, timedOutChildStopped: true, descriptorsClosedOnReturnAndThrow: true, messages };
fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
