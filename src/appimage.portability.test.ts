import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
const { verifyAppDir, verifySquashfsPermissions } = require('../scripts/verify-appimage');
const { sha256File } = require('../scripts/sidecar-build-fingerprint');

describe('stored AppImage permissions', () => {
  test('accepts portable files, directories, and symlinks regardless of stored owner', () => {
    expect(() => verifySquashfsPermissions([
      'drwxr-xr-x 0/0 64 2026-10-03 00:00 squashfs-root',
      '-rwxr-xr-x 0/0 64 2026-10-03 00:00 squashfs-root/AppRun.wrapped',
      '-rw-r--r-- 1001/1001 64 2026-10-03 00:00 squashfs-root/NoteConnection.png',
      'lrwxrwxrwx 0/0 18 2026-10-03 00:00 squashfs-root/.DirIcon -> NoteConnection.png',
    ].join('\n'))).not.toThrow();
  });

  test.each(['-rwxrwx---', '-rwxr--r--', '-rw-rw----', 'drwx------', 'drwxr--r--'])(
    'rejects stored mode %s even when the build owner could use it', (mode) => {
      expect(() => verifySquashfsPermissions(`${mode} 0/0 64 2026-10-03 00:00 squashfs-root/entry`))
        .toThrow(/inaccessible to other users/);
    }
  );

  test('rejects missing manifest output', () => {
    expect(() => verifySquashfsPermissions('')).toThrow(/contains no file modes/);
  });
});

const describeLinux = process.platform === 'linux' ? describe : describe.skip;

describeLinux('AppImage desktop integration portability', () => {
  let directory: string;
  let appDir: string;
  let sourceServer: string;
  const desktop = '[Desktop Entry]\nName=NoteConnection\nType=Application\nExec=npm %U\nIcon=npm\nTerminal=false\n';

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'appimage portability '));
    appDir = path.join(directory, 'NoteConnection.AppDir');
    fs.mkdirSync(path.join(appDir, 'usr/bin'), { recursive: true });
    fs.mkdirSync(path.join(appDir, 'usr/share/applications'), { recursive: true });
    fs.mkdirSync(path.join(appDir, 'usr/share/icons/hicolor/128x128/apps'), { recursive: true });
    fs.writeFileSync(path.join(appDir, 'AppRun'), '#!/bin/sh\nexec "$APPDIR/AppRun.wrapped" "$@"\n', { mode: 0o755 });
    fs.writeFileSync(path.join(appDir, 'AppRun.wrapped'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    fs.writeFileSync(path.join(appDir, 'usr/bin/npm'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    sourceServer = path.join(directory, 'original-server');
    fs.writeFileSync(sourceServer, Buffer.from('\x7fELF embedded offsets\0pkg payload'), { mode: 0o755 });
    fs.copyFileSync(sourceServer, path.join(appDir, 'usr/bin/server'));
    fs.writeFileSync(path.join(appDir, 'usr/share/applications/NoteConnection.desktop'), desktop);
    fs.writeFileSync(path.join(appDir, 'NoteConnection.png'), 'icon fixture');
    fs.symlinkSync('usr/share/applications/NoteConnection.desktop', path.join(appDir, 'NoteConnection.desktop'));
    fs.symlinkSync('NoteConnection.png', path.join(appDir, '.DirIcon'));
    fs.symlinkSync('../../../../../../NoteConnection.png', path.join(appDir, 'usr/share/icons/hicolor/128x128/apps/npm.png'));
  });

  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  test('accepts relative integration links after moving the complete image', () => {
    const relocated = path.join(directory, 'relocated image');
    fs.renameSync(appDir, relocated);
    expect(verifyAppDir(relocated, sourceServer)).toEqual({
      desktopPath: path.join(relocated, 'usr/share/applications/NoteConnection.desktop'),
      iconPath: path.join(relocated, 'NoteConnection.png'),
      executablePath: path.join(relocated, 'usr/bin/npm'),
      serverSha256: sha256File(sourceServer),
      name: 'NoteConnection',
    });
  });

  test('rejects the original absolute .DirIcon link even while its build-host target exists', () => {
    fs.unlinkSync(path.join(appDir, '.DirIcon'));
    fs.symlinkSync(path.join(appDir, 'NoteConnection.png'), path.join(appDir, '.DirIcon'));
    expect(fs.readFileSync(path.join(appDir, '.DirIcon'), 'utf8')).toBe('icon fixture');
    expect(() => verifyAppDir(appDir, sourceServer)).toThrow(/\.DirIcon: absolute symlink/);
  });

  test.each(['.DirIcon', 'NoteConnection.desktop', 'AppRun', 'AppRun.wrapped', 'usr/bin/npm', 'usr/bin/server'])(
    'rejects dangling integration entry %s', (entry) => {
      fs.unlinkSync(path.join(appDir, entry));
      fs.symlinkSync('missing-file', path.join(appDir, entry));
      expect(() => verifyAppDir(appDir, sourceServer)).toThrow(/ENOENT/);
    }
  );

  test('rejects a relative link outside the image even when the target exists', () => {
    fs.writeFileSync(path.join(directory, 'outside.png'), 'external icon');
    fs.unlinkSync(path.join(appDir, '.DirIcon'));
    fs.symlinkSync('../outside.png', path.join(appDir, '.DirIcon'));
    expect(() => verifyAppDir(appDir, sourceServer)).toThrow(/path leaves the AppImage/);
  });

  test('rejects an absolute link hidden in a relative icon chain', () => {
    fs.unlinkSync(path.join(appDir, 'NoteConnection.png'));
    fs.writeFileSync(path.join(directory, 'outside.png'), 'external icon');
    fs.symlinkSync(path.join(directory, 'outside.png'), path.join(appDir, 'NoteConnection.png'));
    expect(() => verifyAppDir(appDir, sourceServer)).toThrow(/absolute symlink/);
  });

  test('rejects a symlinked ancestor directory leading outside the image', () => {
    fs.renameSync(path.join(appDir, 'usr'), path.join(directory, 'usr'));
    fs.symlinkSync('../usr', path.join(appDir, 'usr'));
    expect(() => verifyAppDir(appDir, sourceServer)).toThrow(/path leaves the AppImage/);
  });

  test('rejects a symlink cycle', () => {
    fs.unlinkSync(path.join(appDir, '.DirIcon'));
    fs.symlinkSync('.DirIcon', path.join(appDir, '.DirIcon'));
    expect(() => verifyAppDir(appDir, sourceServer)).toThrow(/symlink loop/);
  });

  test.each(['AppRun', 'AppRun.wrapped', 'usr/bin/npm'])(
    'rejects %s when only the build owner and group can execute it', (entry) => {
      fs.chmodSync(path.join(appDir, entry), 0o770);
      expect(() => verifyAppDir(appDir, sourceServer)).toThrow(/readable by other users|executable by other users/);
    }
  );

  test('rejects an unreadable icon', () => {
    fs.chmodSync(path.join(appDir, 'NoteConnection.png'), 0o600);
    expect(() => verifyAppDir(appDir, sourceServer)).toThrow(/readable by other users/);
  });

  test('rejects a sidecar whose appended payload moved during packaging', () => {
    const bytes = fs.readFileSync(sourceServer);
    fs.writeFileSync(path.join(appDir, 'usr/bin/server'), Buffer.concat([bytes.subarray(0, 21), Buffer.alloc(4096), bytes.subarray(21)]));
    expect(() => verifyAppDir(appDir, sourceServer)).toThrow(/Packaged server differs/);
  });

  test('rejects same-size sidecar corruption', () => {
    const bytes = fs.readFileSync(sourceServer);
    bytes[bytes.length - 1] ^= 1;
    fs.writeFileSync(path.join(appDir, 'usr/bin/server'), bytes);
    expect(() => verifyAppDir(appDir, sourceServer)).toThrow(/Packaged server differs/);
  });

  test.each([
    ['Name=NoteConnection\n', '', /missing Name/],
    ['Type=Application', 'Type=Link', /Type must be Application/],
    ['Exec=npm %U', 'Exec=missing', /ENOENT/],
    ['Exec=npm %U', 'Exec=/usr/bin/npm', /must name a bundled executable/],
    ['Icon=npm', 'Icon=missing', /no bundled theme image/],
  ])('rejects invalid desktop metadata (%s)', (before, after, message) => {
    fs.writeFileSync(path.join(appDir, 'usr/share/applications/NoteConnection.desktop'), desktop.replace(before as string, after as string));
    expect(() => verifyAppDir(appDir, sourceServer)).toThrow(message as RegExp);
  });
});
