import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';

jest.mock('child_process', () => ({ ...jest.requireActual('child_process'), spawnSync: jest.fn() }));
const { prepareDesktopGodotPack } = require('../scripts/prepare-desktop-godot-pack');
const { resolveHostGodotBinaryName } = require('../scripts/tauri-sidecar-utils');
const runtime = require('../config/godot-desktop-runtime.json');
const spawn = spawnSync as jest.Mock;

describe('desktop Godot resource package', () => {
  let directory: string;

  const write = (relative: string, content: string) => {
    const file = path.join(directory, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'desktop-godot-pack-'));
    write('path_mode/project.godot', `config_version=5\nconfig/features=PackedStringArray("${runtime.version}", "Forward+")\n`);
    write('path_mode/export_presets.cfg', '[preset.0]\nname="Windows Desktop"\n');
    write('path_mode/scenes/main.tscn', '[gd_scene format=3]\n');
    write('path_mode/scripts/main.gd', 'extends Node\n');
    write('path_mode/shaders/main.gdshader', 'shader_type spatial;\n');
    write('path_mode/assets/background.exr', 'fixture');
    write(`src-tauri/bin/${resolveHostGodotBinaryName()}`, 'engine fixture');
    spawn.mockImplementation((_executable: string, args: string[]) => {
      if (args.includes('--version')) return { status: 0, stdout: `${runtime.version}.stable.official.fixture\n`, stderr: '' };
      if (args.includes('--export-pack')) fs.writeFileSync(args[args.length - 1], 'GDPC resource fixture');
      return { status: 0, stdout: 'done\n', stderr: '' };
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  test('exports only runtime roots and binds the pack to source and engine bytes', () => {
    write('path_mode/.godot/editor/state', 'private editor state');
    write('path_mode/tmp/debug.gd', 'debug fixture');
    const report = prepareDesktopGodotPack(directory);
    expect(report.engineVersion).toBe(`${runtime.version}.stable.official.fixture`);
    expect(report.pack.path).toBe('output/desktop/path_mode.pck');
    expect(report.pack.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.files.map((file: { path: string }) => file.path)).toEqual(expect.arrayContaining(['project.godot', 'scenes/main.tscn', 'assets/background.exr']));
    expect(report.files.some((file: { path: string }) => /editor|tmp/.test(file.path))).toBe(false);
    expect(fs.readdirSync(path.join(directory, 'output/desktop')).some(name => name.startsWith('.pathmode-'))).toBe(false);
  });

  test('rejects an engine version that cannot consume the declared project', () => {
    spawn.mockReturnValue({ status: 0, stdout: '4.3.stable.official.fixture\n', stderr: '' });
    expect(() => prepareDesktopGodotPack(directory)).toThrow(/requires Godot/);
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  test('rejects SVG before invoking Godot import', () => {
    write('path_mode/assets/unsupported.svg', '<svg/>');
    expect(() => prepareDesktopGodotPack(directory)).toThrow(/cannot import SVG/);
    expect(spawn.mock.calls.every(([, args]) => args.includes('--version'))).toBe(true);
  });

  test('does not accept zero exit after a Godot script error or replace an earlier pack', () => {
    write('output/desktop/path_mode.pck', 'GDPC previous pack');
    spawn.mockImplementation((_executable: string, args: string[]) => args.includes('--version')
      ? { status: 0, stdout: `${runtime.version}.stable.official.fixture`, stderr: '' }
      : { status: 0, stdout: '', stderr: '\u001b[31mSCRIPT ERROR: invalid exported script\u001b[0m\n' });
    expect(() => prepareDesktopGodotPack(directory)).toThrow(/invalid exported script/);
    expect(fs.readFileSync(path.join(directory, 'output/desktop/path_mode.pck'), 'utf8')).toBe('GDPC previous pack');
  });

  test('rejects successful export without a resource pack', () => {
    spawn.mockImplementation((_executable: string, args: string[]) => ({ status: 0, stdout: args.includes('--version') ? `${runtime.version}.stable.official.fixture` : '', stderr: '' }));
    expect(() => prepareDesktopGodotPack(directory)).toThrow(/ENOENT/);
  });

  test('rejects an invalid pack header', () => {
    spawn.mockImplementation((_executable: string, args: string[]) => {
      if (args.includes('--export-pack')) fs.writeFileSync(args[args.length - 1], 'not a pack');
      return { status: 0, stdout: args.includes('--version') ? `${runtime.version}.stable.official.fixture` : '', stderr: '' };
    });
    expect(() => prepareDesktopGodotPack(directory)).toThrow(/PCK resource pack/);
  });

  test('rejects source changes between staging and publication', () => {
    spawn.mockImplementation((_executable: string, args: string[]) => {
      if (args.includes('--export-pack')) {
        fs.writeFileSync(args[args.length - 1], 'GDPC resource fixture');
        write('path_mode/scripts/main.gd', 'extends Node\n# changed during export\n');
      }
      return { status: 0, stdout: args.includes('--version') ? `${runtime.version}.stable.official.fixture` : '', stderr: '' };
    });
    expect(() => prepareDesktopGodotPack(directory)).toThrow(/inputs changed/);
    expect(fs.existsSync(path.join(directory, 'output/desktop/path_mode.pck'))).toBe(false);
  });

  test('rejects files added between staging and publication', () => {
    spawn.mockImplementation((_executable: string, args: string[]) => {
      if (args.includes('--export-pack')) {
        fs.writeFileSync(args[args.length - 1], 'GDPC resource fixture');
        write('path_mode/scripts/added.gd', 'extends Node\n');
      }
      return { status: 0, stdout: args.includes('--version') ? `${runtime.version}.stable.official.fixture` : '', stderr: '' };
    });
    expect(() => prepareDesktopGodotPack(directory)).toThrow(/inputs changed/);
    expect(fs.existsSync(path.join(directory, 'output/desktop/path_mode.pck'))).toBe(false);
  });

  test('rejects a symlinked runtime root before importing external files', () => {
    fs.renameSync(path.join(directory, 'path_mode/assets'), path.join(directory, 'external-assets'));
    fs.symlinkSync(path.join(directory, 'external-assets'), path.join(directory, 'path_mode/assets'), process.platform === 'win32' ? 'junction' : 'dir');
    expect(() => prepareDesktopGodotPack(directory)).toThrow(/must not be a symlink/);
    expect(spawn.mock.calls.every(([, args]) => args.includes('--version'))).toBe(true);
  });
});
