const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { stripVTControlCharacters } = require('node:util');
const { resolveHostGodotBinaryName } = require('./tauri-sidecar-utils');
const { sha256File } = require('./sidecar-build-fingerprint');
const runtime = require('../config/godot-desktop-runtime.json');

function collectRuntimeFiles(directory, relative = '') {
  if (fs.lstatSync(directory).isSymbolicLink()) throw new Error(`Godot runtime source must not be a symlink: ${directory}`);
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const source = path.join(directory, entry.name);
    const name = path.join(relative, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Godot runtime source must not be a symlink: ${source}`);
    if (entry.isDirectory()) files.push(...collectRuntimeFiles(source, name));
    else if (entry.isFile()) {
      if (/\.svg$/i.test(entry.name)) throw new Error(`Godot cannot import SVG runtime assets: ${source}`);
      files.push({ source, relative: name });
    }
  }
  return files;
}

function collectProjectRuntimeSources(sourceRoot) {
  const files = ['project.godot', 'export_presets.cfg'].map(relative => {
    const source = path.join(sourceRoot, relative);
    if (fs.lstatSync(source).isSymbolicLink()) throw new Error(`Godot runtime source must not be a symlink: ${source}`);
    return { source, relative };
  });
  for (const directory of ['scenes', 'scripts', 'shaders', 'assets']) {
    files.push(...collectRuntimeFiles(path.join(sourceRoot, directory), directory));
  }
  return files;
}

function executeGodot(executable, args, cwd, env) {
  const execution = spawnSync(executable, args, {
    cwd, env, windowsHide: true, encoding: 'utf8', timeout: 600000, maxBuffer: 8 * 1024 * 1024,
  });
  const output = stripVTControlCharacters(`${execution.stdout || ''}\n${execution.stderr || ''}`);
  // Godot can finish with exit 0 after script/import errors. Packaging must not
  // turn a produced file or a successful process exit into runtime acceptance.
  if (execution.error || execution.status !== 0 || /^\s*(?:SCRIPT )?ERROR:/m.test(output)) {
    throw new Error(`Godot ${args.join(' ')} failed: ${execution.error?.message || execution.status}\n${output}`);
  }
  return output;
}

function prepareDesktopGodotPack(repoRoot = path.resolve(__dirname, '..')) {
  const sourceRoot = path.join(repoRoot, 'path_mode');
  const projectConfig = fs.readFileSync(path.join(sourceRoot, 'project.godot'), 'utf8');
  const projectVersion = /config\/features\s*=\s*PackedStringArray\("([^"]+)"/.exec(projectConfig)?.[1];
  if (projectVersion !== runtime.version) throw new Error(`Godot project ${projectVersion} does not match desktop runtime ${runtime.version}.`);
  const binaryName = resolveHostGodotBinaryName();
  if (!binaryName) throw new Error(`Unsupported desktop Godot host: ${process.platform}/${process.arch}`);
  const executable = path.join(repoRoot, 'src-tauri', 'bin', binaryName);
  const version = executeGodot(executable, ['--version'], repoRoot, process.env).trim();
  if (!version.startsWith(`${runtime.version}.stable.`)) throw new Error(`Desktop pack requires Godot ${runtime.version}.stable; found ${version}`);
  const engineSha256 = sha256File(executable);

  const sourceFiles = collectProjectRuntimeSources(sourceRoot);
  const outputRoot = path.resolve(repoRoot, 'output', 'desktop');
  fs.mkdirSync(outputRoot, { recursive: true });
  const staging = fs.mkdtempSync(path.join(outputRoot, '.pathmode-'));
  const project = path.join(staging, 'project');
  const env = {
    ...process.env,
    APPDATA: path.join(staging, 'profile'), LOCALAPPDATA: path.join(staging, 'local'),
    XDG_CONFIG_HOME: path.join(staging, 'config'), XDG_DATA_HOME: path.join(staging, 'data'),
    XDG_CACHE_HOME: path.join(staging, 'cache'), TEMP: path.join(staging, 'temp'), TMP: path.join(staging, 'temp'),
  };
  for (const key of ['APPDATA', 'LOCALAPPDATA', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME', 'TEMP']) fs.mkdirSync(env[key], { recursive: true });
  try {
    const inputs = [];
    for (const file of sourceFiles) {
      const destination = path.join(project, file.relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(file.source, destination);
      inputs.push({ path: file.relative.replace(/\\/g, '/'), sha256: sha256File(destination) });
    }
    const stagedPack = path.join(staging, 'path_mode.pck');
    const imported = executeGodot(executable, ['--headless', '--path', project, '--editor', '--import'], staging, env);
    fs.writeFileSync(path.join(outputRoot, 'godot-import.log'), imported);
    const exported = executeGodot(executable, ['--headless', '--path', project, '--export-pack', 'Windows Desktop', stagedPack], staging, env);
    fs.writeFileSync(path.join(outputRoot, 'godot-export.log'), exported);
    const descriptor = fs.openSync(stagedPack, 'r');
    const magic = Buffer.alloc(4);
    try { fs.readSync(descriptor, magic, 0, 4, 0); } finally { fs.closeSync(descriptor); }
    if (magic.toString('ascii') !== 'GDPC') throw new Error('Godot export did not produce a PCK resource pack.');
    const currentSources = collectProjectRuntimeSources(sourceRoot);
    if (sha256File(executable) !== engineSha256 || currentSources.length !== inputs.length || inputs.some((file, index) =>
      currentSources[index].relative.replace(/\\/g, '/') !== file.path || sha256File(currentSources[index].source) !== file.sha256)) {
      throw new Error('Godot engine or project inputs changed while the resource pack was built.');
    }
    const packPath = path.join(outputRoot, 'path_mode.pck');
    fs.renameSync(stagedPack, packPath);
    const report = {
      generatedAt: new Date().toISOString(), engineVersion: version, engineSha256,
      files: inputs,
      pack: { path: path.relative(repoRoot, packPath).replace(/\\/g, '/'), bytes: fs.statSync(packPath).size, sha256: sha256File(packPath) },
    };
    fs.writeFileSync(path.join(outputRoot, 'godot-pack.json'), JSON.stringify(report, null, 2) + '\n');
    return report;
  } finally {
    if (path.dirname(fs.realpathSync(staging)) !== fs.realpathSync(outputRoot)) throw new Error('Godot staging directory escaped the desktop output directory.');
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

if (require.main === module) console.log(JSON.stringify(prepareDesktopGodotPack(), null, 2));
module.exports = { prepareDesktopGodotPack };
