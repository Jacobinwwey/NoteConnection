#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { sha256File } = require('./sidecar-build-fingerprint');
const { verifyAppImageUpdate } = require('./appimage-update');

function verifySquashfsPermissions(manifest) {
  const entries = manifest.split('\n').filter((line) => /^[dl-][rwxstST-]{9}\s/.test(line));
  if (entries.length === 0) throw new Error('SquashFS manifest contains no file modes');
  for (const entry of entries) {
    const mode = entry.slice(0, 10);
    if (mode[0] === 'l') continue;
    if (mode[7] !== 'r' || ((mode[0] === 'd' || /[xs]/.test(mode[3])) && !/[xt]/.test(mode[9]))) {
      throw new Error(`SquashFS entry is inaccessible to other users: ${entry}`);
    }
  }
}

function resolvePortableFile(appDir, entry) {
  let pending = entry.split(path.sep);
  let current = appDir;
  let links = 0;
  while (pending.length > 0) {
    current = path.resolve(current, pending.shift());
    const relative = path.relative(appDir, current);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error(`${entry}: path leaves the AppImage`);
    }
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) {
      const target = fs.readlinkSync(current);
      if (path.isAbsolute(target)) {
        throw new Error(`${entry}: absolute symlink is not portable: ${target}`);
      }
      links += 1;
      if (links > 40) throw new Error(`${entry}: symlink loop`);
      pending = [...path.relative(appDir, path.dirname(current)).split(path.sep), ...target.split(path.sep), ...pending];
      current = appDir;
    } else if (stat.isDirectory() && (stat.mode & 0o001) === 0) {
      throw new Error(`${entry}: directory is not traversable by other users: ${current}`);
    }
  }
  const stat = fs.statSync(current);
  if (!stat.isFile() || (stat.mode & 0o004) === 0) {
    throw new Error(`${entry}: expected a file readable by other users`);
  }
  fs.accessSync(current, fs.constants.R_OK);
  return current;
}

function verifyPortableExecutable(appDir, entry) {
  const executable = resolvePortableFile(appDir, entry);
  if ((fs.statSync(executable).mode & 0o001) === 0) {
    throw new Error(`${entry}: not executable by other users`);
  }
  fs.accessSync(executable, fs.constants.X_OK);
  return executable;
}

function verifyAppDir(appDirPath, sourceServerPath) {
  const appDir = fs.realpathSync(appDirPath);
  const iconPath = resolvePortableFile(appDir, '.DirIcon');
  verifyPortableExecutable(appDir, 'AppRun');
  // Tauri's linuxdeploy launcher delegates to this bundled executable.
  verifyPortableExecutable(appDir, 'AppRun.wrapped');
  const desktopEntries = fs.readdirSync(appDir).filter((entry) => entry.endsWith('.desktop'));
  if (desktopEntries.length !== 1) throw new Error('Expected exactly one root desktop entry');
  const desktopPath = resolvePortableFile(appDir, desktopEntries[0]);
  resolvePortableFile(appDir, `${path.basename(desktopEntries[0], '.desktop')}.png`);
  const desktopFields = new Map();
  let section = '';
  for (const line of fs.readFileSync(desktopPath, 'utf8').split(/\r?\n/)) {
    if (line.startsWith('[')) section = line;
    if (section !== '[Desktop Entry]' || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator > 0) desktopFields.set(line.slice(0, separator), line.slice(separator + 1));
  }
  for (const key of ['Name', 'Exec', 'Icon']) {
    if (!desktopFields.get(key)) throw new Error(`Desktop entry is missing ${key}`);
  }
  if (desktopFields.get('Type') !== 'Application') throw new Error('Desktop Type must be Application');
  // Tauri generates a basename, optionally followed by desktop field-code arguments.
  const command = desktopFields.get('Exec').match(/^([A-Za-z0-9._+-]+)(?:\s|$)/);
  if (!command) throw new Error('Desktop Exec must name a bundled executable');
  const executablePath = verifyPortableExecutable(appDir, path.join('usr', 'bin', command[1]));
  const serverPath = verifyPortableExecutable(appDir, path.join('usr', 'bin', 'server'));
  const serverSha256 = sha256File(serverPath);
  if (serverSha256 !== sha256File(sourceServerPath)) {
    throw new Error('Packaged server differs from the original pkg sidecar; packaging must preserve its appended payload');
  }
  const iconName = desktopFields.get('Icon');
  if (!/^[A-Za-z0-9._+-]+$/.test(iconName)) throw new Error('Desktop Icon must name a bundled theme icon');
  const iconTheme = path.join(appDir, 'usr', 'share', 'icons', 'hicolor');
  const themeIcons = fs.readdirSync(iconTheme).flatMap((size) => ['png', 'svg'].map((extension) =>
    path.join('usr', 'share', 'icons', 'hicolor', size, 'apps', `${iconName}.${extension}`)
  )).filter((entry) => fs.existsSync(path.join(appDir, entry)));
  if (themeIcons.length === 0) throw new Error(`Desktop Icon has no bundled theme image: ${iconName}`);
  for (const entry of themeIcons) resolvePortableFile(appDir, entry);
  return { desktopPath, iconPath, executablePath, serverSha256, name: desktopFields.get('Name') };
}

function verifyAppImage(artifactPath, sourceServerPath) {
  const artifact = fs.realpathSync(artifactPath);
  const sourceServer = fs.realpathSync(sourceServerPath);
  const update = verifyAppImageUpdate(artifact);
  const extractionDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-appimage-'));
  try {
    const offset = execFileSync(artifact, ['--appimage-offset'], { encoding: 'utf8', timeout: 30000 }).trim();
    if (!/^\d+$/.test(offset)) throw new Error('AppImage runtime returned an invalid SquashFS offset');
    verifySquashfsPermissions(execFileSync('unsquashfs', ['-lln', '-o', offset, artifact], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      timeout: 30000,
    }));
    // Runtime --appimage-extract can replace stored directory modes with 0700.
    // unsquashfs preserves them so relocation tests use the packaged permissions.
    const appDir = path.join(extractionDirectory, 'squashfs-root');
    execFileSync('unsquashfs', ['-no-progress', '-no-xattrs', '-d', appDir, '-o', offset, artifact], {
      stdio: ['ignore', 'ignore', 'pipe'],
      timeout: 120000,
    });
    const integration = verifyAppDir(appDir, sourceServer);
    execFileSync('desktop-file-validate', [integration.desktopPath], { stdio: 'pipe', timeout: 30000 });
    execFileSync('gdk-pixbuf-thumbnailer', ['-s', '64', integration.iconPath, path.join(extractionDirectory, 'icon.png')], {
      stdio: 'pipe',
      timeout: 30000,
    });
    return { artifact, name: integration.name, executable: path.basename(integration.executablePath), serverSha256: integration.serverSha256, ...update };
  } finally {
    fs.rmSync(extractionDirectory, { recursive: true, force: true });
  }
}

if (require.main === module) {
  try {
    if (process.argv.length !== 4) throw new Error('Usage: node scripts/verify-appimage.js <artifact.AppImage> <original-server-sidecar>');
    console.log(`[verify-appimage] Passed: ${JSON.stringify(verifyAppImage(process.argv[2], process.argv[3]))}`);
  } catch (error) {
    console.error(`[verify-appimage] ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { verifyAppDir, verifyAppImage, verifySquashfsPermissions };
