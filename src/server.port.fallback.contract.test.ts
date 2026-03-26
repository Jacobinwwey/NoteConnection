import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import type { Server } from 'http';

type StartServer = (options?: { port?: number; targetPath?: string }) => Promise<Server>;

jest.setTimeout(20000);

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

function makeTempProject(prefix: string): { root: string; cleanup: () => void } {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), `${prefix}-`));
  const projectRoot = path.join(root, 'project');
  const frontendDir = path.join(projectRoot, 'dist', 'src', 'frontend');
  const runtimeDataDir = path.join(projectRoot, 'runtime_data');
  const kbRoot = path.join(projectRoot, 'Knowledge_Base');
  fs.mkdirSync(frontendDir, { recursive: true });
  fs.mkdirSync(runtimeDataDir, { recursive: true });
  fs.mkdirSync(kbRoot, { recursive: true });
  fs.writeFileSync(path.join(frontendDir, 'index.html'), '<!doctype html><title>nc</title>', 'utf8');
  return {
    root,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true })
  };
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = http.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (!address || typeof address !== 'object') {
        probe.close(() => reject(new Error('Failed to allocate free port')));
        return;
      }
      probe.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(address.port);
      });
    });
  });
}

function listenOnPort(port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((_req, res) => {
      res.statusCode = 200;
      res.end('busy');
    });
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

async function closeServer(server: Server | null): Promise<void> {
  if (!server) {
    return;
  }
  if (typeof (server as any).closeAllConnections === 'function') {
    (server as any).closeAllConnections();
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function loadStartServer(): StartServer {
  jest.resetModules();
  jest.doMock('./index', () => ({
    buildGraph: jest.fn().mockResolvedValue(undefined)
  }));
  jest.doMock('./core/PathBridge', () => ({
    PathBridge: jest.fn().mockImplementation(() => ({}))
  }));
  jest.doMock('./reader_renderer', () => ({
    renderMathPng: jest.fn().mockResolvedValue({
      pngBase64: 'math',
      width: 1,
      height: 1
    }),
    renderMermaidPng: jest.fn().mockResolvedValue({
      pngBase64: 'mermaid',
      width: 1,
      height: 1
    })
  }));
  const serverModule = require('./server') as { startServer: StartServer };
  return serverModule.startServer;
}

describe('server ephemeral port fallback policy contract', () => {
  let tempProject: { root: string; cleanup: () => void } | null = null;
  let envRestorers: Array<() => void> = [];
  let originalArgv: string[] = [];

  test('server installs stdio broken-pipe guards before emitting fallback logs', () => {
    const serverSource = fs.readFileSync(path.join(__dirname, 'server.ts'), 'utf8');

    expect(serverSource).toContain('installBrokenPipeGuard(process.stdout');
    expect(serverSource).toContain('installBrokenPipeGuard(process.stderr');
    expect(serverSource).toContain("error?.code === 'EPIPE'");
  });

  beforeEach(() => {
    tempProject = makeTempProject('noteconnection-port-policy');
    const projectRoot = path.join(tempProject.root, 'project');
    const frontendDir = path.join(projectRoot, 'dist', 'src', 'frontend');
    const runtimeDataDir = path.join(projectRoot, 'runtime_data');
    const kbRoot = path.join(projectRoot, 'Knowledge_Base');
    envRestorers = [
      setEnv('NOTE_CONNECTION_PROJECT_ROOT', projectRoot),
      setEnv('NOTE_CONNECTION_FRONTEND_DIR', frontendDir),
      setEnv('NOTE_CONNECTION_RUNTIME_DATA_DIR', runtimeDataDir),
      setEnv('NOTE_CONNECTION_KB_ROOT', kbRoot),
      setEnv('NOTE_CONNECTION_AUTH_TOKEN', undefined),
      setEnv('NOTE_CONNECTION_PORT', undefined),
      setEnv('PORT', undefined)
    ];
    originalArgv = [...process.argv];
    process.argv = process.argv.slice(0, 2);
  });

  afterEach(async () => {
    process.argv = originalArgv;
    envRestorers.reverse().forEach((restore) => restore());
    envRestorers = [];
    jest.dontMock('./index');
    jest.dontMock('./core/PathBridge');
    jest.dontMock('./reader_renderer');
    jest.resetModules();
    if (tempProject) {
      tempProject.cleanup();
      tempProject = null;
    }
  });

  test('fails fast on EADDRINUSE when ephemeral fallback is not explicitly enabled', async () => {
    const blockedPort = await getFreePort();
    const blocker = await listenOnPort(blockedPort);
    envRestorers.push(setEnv('NOTE_CONNECTION_ALLOW_EPHEMERAL_PORT_FALLBACK', undefined));

    const startServer = loadStartServer();
    let thrown: NodeJS.ErrnoException | null = null;
    try {
      await startServer({ port: blockedPort });
    } catch (error) {
      thrown = error as NodeJS.ErrnoException;
    } finally {
      await closeServer(blocker);
    }

    expect(thrown).not.toBeNull();
    expect(thrown?.code).toBe('EADDRINUSE');
    expect(String(thrown?.message || '')).toContain('Ephemeral port fallback is disabled by default');
  });

  test('uses ephemeral fallback only when NOTE_CONNECTION_ALLOW_EPHEMERAL_PORT_FALLBACK=1', async () => {
    const blockedPort = await getFreePort();
    const blocker = await listenOnPort(blockedPort);
    envRestorers.push(setEnv('NOTE_CONNECTION_ALLOW_EPHEMERAL_PORT_FALLBACK', '1'));

    const startServer = loadStartServer();
    let appServer: Server | null = null;
    try {
      appServer = await startServer({ port: blockedPort });
      const address = appServer.address();
      expect(address && typeof address === 'object').toBe(true);
      if (address && typeof address === 'object') {
        expect(address.port).not.toBe(blockedPort);
      }
    } finally {
      await closeServer(appServer);
      await closeServer(blocker);
    }
  });
});
