import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
const { sha256File } = require('../scripts/sidecar-build-fingerprint');

const describeLinux = process.platform === 'linux' ? describe : describe.skip;

describeLinux('AppImage pkg sidecar patchelf boundary', () => {
  let directory: string;
  let server: string;
  let transcript: string;
  let buildEnvironment: NodeJS.ProcessEnv;
  const adapter = path.resolve(__dirname, '../scripts/appimage-patchelf.js');

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'appimage patchelf '));
    server = path.join(directory, 'NoteConnection.AppDir/usr/bin/server');
    transcript = path.join(directory, 'patchelf-calls.jsonl');
    fs.mkdirSync(path.dirname(server), { recursive: true });
    fs.writeFileSync(server, Buffer.from('\x7fELF embedded offsets\0appended pkg payload'));
    const originalPatchelf = path.join(directory, 'actual-patchelf');
    fs.writeFileSync(originalPatchelf, `#!${process.execPath}\n
const fs = require('fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.APPIMAGE_PATCHELF_TEST_LOG, JSON.stringify(args) + '\\n');
if (args[0] === '--set-rpath') fs.appendFileSync(args[2], ' ELF rewrite');
process.stdout.write('original stdout\\n');
process.stderr.write('original stderr\\n');
process.exit(args[0] === '--fail' ? 23 : 0);
`, { mode: 0o755 });
    buildEnvironment = {
      ...process.env,
      NOTE_CONNECTION_APPIMAGE_PATCHELF: originalPatchelf,
      NOTE_CONNECTION_APPIMAGE_SERVER_SUFFIX: 'NoteConnection.AppDir/usr/bin/server',
      NOTE_CONNECTION_APPIMAGE_SERVER_SHA256: sha256File(server),
      APPIMAGE_PATCHELF_TEST_LOG: transcript,
    };
  });

  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  test('preserves the complete pkg sidecar through repeated RPATH writes', () => {
    for (let scan = 0; scan < 2; scan += 1) {
      const command = spawnSync(adapter, ['--set-rpath', '$ORIGIN/../lib', server], { env: buildEnvironment, encoding: 'utf8' });
      expect(command.status).toBe(0);
      expect(command.stderr).toBe('');
    }
    expect(sha256File(server)).toBe(buildEnvironment.NOTE_CONNECTION_APPIMAGE_SERVER_SHA256);
    expect(fs.existsSync(transcript)).toBe(false);
  });

  test('forwards read queries and preserves stdout, stderr, and argument boundaries', () => {
    const args = ['--print-rpath', server];
    const command = spawnSync(adapter, args, { env: buildEnvironment, encoding: 'utf8' });
    expect(command.status).toBe(0);
    expect(command.stdout).toBe('original stdout\n');
    expect(command.stderr).toBe('original stderr\n');
    expect(JSON.parse(fs.readFileSync(transcript, 'utf8'))).toEqual(args);
    expect(sha256File(server)).toBe(buildEnvironment.NOTE_CONNECTION_APPIMAGE_SERVER_SHA256);
  });

  test.each(['other.AppDir/usr/bin/server', 'usr/bin/server', 'NoteConnection.AppDir/usr/bin/npm', 'NoteConnection.AppDir/usr/lib/libexample.so'])(
    'forwards RPATH writes for %s', (relative) => {
      const executable = path.join(directory, relative);
      fs.mkdirSync(path.dirname(executable), { recursive: true });
      fs.writeFileSync(executable, 'other ELF');
      const args = ['--set-rpath', '$ORIGIN/path with spaces', executable];
      const command = spawnSync(adapter, args, { env: buildEnvironment, encoding: 'utf8' });
      expect(command.status).toBe(0);
      expect(JSON.parse(fs.readFileSync(transcript, 'utf8'))).toEqual(args);
      expect(fs.readFileSync(executable, 'utf8')).toBe('other ELF ELF rewrite');
    }
  );

  test('rejects an already changed packaged server without rewriting it again', () => {
    fs.appendFileSync(server, 'changed');
    const changedSha256 = sha256File(server);
    const command = spawnSync(adapter, ['--set-rpath', '$ORIGIN/../lib', server], { env: buildEnvironment, encoding: 'utf8' });
    expect(command.status).toBe(1);
    expect(command.stderr).toMatch(/differs from the original pkg sidecar/);
    expect(sha256File(server)).toBe(changedSha256);
    expect(fs.existsSync(transcript)).toBe(false);
  });

  test('preserves a delegated failure exit status', () => {
    expect(spawnSync(adapter, ['--fail'], { env: buildEnvironment }).status).toBe(23);
  });
});
