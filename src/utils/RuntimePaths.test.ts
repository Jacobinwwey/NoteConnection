import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveRuntimePaths } from './RuntimePaths';

class TempDir {
  readonly path: string;

  constructor(prefix: string) {
    this.path = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), `${prefix}-`));
  }

  child(relative: string): string {
    return path.join(this.path, relative);
  }

  mkdir(relative: string): string {
    const dir = this.child(relative);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  cleanup(): void {
    fs.rmSync(this.path, { recursive: true, force: true });
  }
}

function setEnv(key: string, value: string | undefined): () => void {
  const previous = process.env[key];
  if (typeof value === 'undefined') {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }

  return () => {
    if (typeof previous === 'undefined') {
      delete process.env[key];
    } else {
      process.env[key] = previous;
    }
  };
}

describe('resolveRuntimePaths', () => {
  let temp: TempDir;
  let restoreEnv: Array<() => void>;

  beforeEach(() => {
    temp = new TempDir('noteconnection-runtime-paths');
    restoreEnv = [];
  });

  afterEach(() => {
    restoreEnv.reverse().forEach((restore) => restore());
    temp.cleanup();
  });

  test('uses explicit environment overrides when they exist', () => {
    const projectRoot = temp.mkdir('project');
    temp.mkdir(path.join('project', 'Knowledge_Base'));
    const frontendDir = temp.mkdir('custom_frontend');
    const runtimeDataDir = temp.mkdir('custom_runtime_data');
    const kbRoot = temp.mkdir('custom_kb');

    restoreEnv.push(setEnv('NOTE_CONNECTION_PROJECT_ROOT', projectRoot));
    restoreEnv.push(setEnv('NOTE_CONNECTION_FRONTEND_DIR', frontendDir));
    restoreEnv.push(setEnv('NOTE_CONNECTION_RUNTIME_DATA_DIR', runtimeDataDir));
    restoreEnv.push(setEnv('NOTE_CONNECTION_KB_ROOT', kbRoot));

    const resolved = resolveRuntimePaths(temp.child('module'));

    expect(resolved.projectRoot).toBe(path.resolve(projectRoot));
    expect(resolved.frontendDir).toBe(path.resolve(frontendDir));
    expect(resolved.runtimeDataDir).toBe(path.resolve(runtimeDataDir));
    expect(resolved.kbRoot).toBe(path.resolve(kbRoot));
  });

  test('normalizes env kb path that points to a folder inside Knowledge_Base', () => {
    const projectRoot = temp.mkdir('project');
    const kbRoot = temp.mkdir(path.join('project', 'Knowledge_Base'));
    const financialFolder = temp.mkdir(path.join('project', 'Knowledge_Base', 'financial'));
    const frontendDir = temp.mkdir(path.join('project', 'dist', 'src', 'frontend'));

    restoreEnv.push(setEnv('NOTE_CONNECTION_PROJECT_ROOT', projectRoot));
    restoreEnv.push(setEnv('NOTE_CONNECTION_FRONTEND_DIR', frontendDir));
    restoreEnv.push(setEnv('NOTE_CONNECTION_RUNTIME_DATA_DIR', undefined));
    restoreEnv.push(setEnv('NOTE_CONNECTION_KB_ROOT', financialFolder));

    const resolved = resolveRuntimePaths(temp.child('module'));

    expect(resolved.kbRoot).toBe(path.resolve(kbRoot));
  });

  test('falls back to project dist frontend when env frontend path is invalid', () => {
    const projectRoot = temp.mkdir('project');
    const distFrontend = temp.mkdir(path.join('project', 'dist', 'src', 'frontend'));
    const kbRoot = temp.mkdir(path.join('project', 'Knowledge_Base'));

    restoreEnv.push(setEnv('NOTE_CONNECTION_PROJECT_ROOT', projectRoot));
    restoreEnv.push(setEnv('NOTE_CONNECTION_FRONTEND_DIR', temp.child('missing_frontend')));
    restoreEnv.push(setEnv('NOTE_CONNECTION_RUNTIME_DATA_DIR', undefined));
    restoreEnv.push(setEnv('NOTE_CONNECTION_KB_ROOT', undefined));

    const resolved = resolveRuntimePaths(temp.child('module'));

    expect(resolved.projectRoot).toBe(path.resolve(projectRoot));
    expect(resolved.frontendDir).toBe(path.resolve(distFrontend));
    expect(fs.existsSync(resolved.runtimeDataDir)).toBe(true);
    expect(resolved.kbRoot).toBe(path.resolve(kbRoot));
  });

  test('uses src frontend fallback when dist frontend is absent', () => {
    const projectRoot = temp.mkdir('project');
    const srcFrontend = temp.mkdir(path.join('project', 'src', 'frontend'));
    const kbRoot = temp.mkdir(path.join('project', 'Knowledge_Base'));

    restoreEnv.push(setEnv('NOTE_CONNECTION_PROJECT_ROOT', projectRoot));
    restoreEnv.push(setEnv('NOTE_CONNECTION_FRONTEND_DIR', undefined));
    restoreEnv.push(setEnv('NOTE_CONNECTION_RUNTIME_DATA_DIR', undefined));
    restoreEnv.push(setEnv('NOTE_CONNECTION_KB_ROOT', undefined));

    const resolved = resolveRuntimePaths(temp.child('module'));

    expect(resolved.frontendDir).toBe(path.resolve(srcFrontend));
    expect(fs.existsSync(resolved.runtimeDataDir)).toBe(true);
    expect(resolved.kbRoot).toBe(path.resolve(kbRoot));
  });

  test('ignores invalid env kb path and returns existing project Knowledge_Base', () => {
    const projectRoot = temp.mkdir('project');
    const kbRoot = temp.mkdir(path.join('project', 'Knowledge_Base'));
    temp.mkdir(path.join('project', 'dist', 'src', 'frontend'));

    restoreEnv.push(setEnv('NOTE_CONNECTION_PROJECT_ROOT', projectRoot));
    restoreEnv.push(setEnv('NOTE_CONNECTION_RUNTIME_DATA_DIR', undefined));
    restoreEnv.push(setEnv('NOTE_CONNECTION_KB_ROOT', temp.child('invalid_kb')));

    const resolved = resolveRuntimePaths(temp.child('module'));
    expect(resolved.kbRoot).toBe(path.resolve(kbRoot));
  });
});
