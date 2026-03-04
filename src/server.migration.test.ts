import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import type { Server } from 'http';

type JsonResponse = {
  status: number;
  body: any;
};

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

jest.setTimeout(20000);

class TempDir {
  readonly path: string;

  constructor(prefix: string) {
    this.path = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), `${prefix}-`));
  }

  mkdir(relative: string): string {
    const target = path.join(this.path, relative);
    fs.mkdirSync(target, { recursive: true });
    return target;
  }

  file(relative: string, content: string): string {
    const target = path.join(this.path, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
    return target;
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

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = http.createServer();
    probe.once('error', reject);
    probe.listen(0, () => {
      const address = probe.address();
      if (address && typeof address === 'object') {
        const { port } = address;
        probe.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(port);
        });
        return;
      }
      reject(new Error('Failed to obtain a free port.'));
    });
  });
}

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function requestJson(port: number, method: 'GET' | 'POST', requestPath: string, body?: unknown): Promise<JsonResponse> {
  return new Promise((resolve, reject) => {
    const payload = typeof body === 'undefined' ? undefined : JSON.stringify(body);
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: requestPath,
        method,
        headers: payload
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload)
            }
          : undefined
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          text += chunk;
        });
        res.on('end', () => {
          let parsed: any = text;
          if (text.length > 0) {
            try {
              parsed = JSON.parse(text);
            } catch {
              parsed = text;
            }
          }
          resolve({
            status: res.statusCode || 0,
            body: parsed
          });
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

describe('server migration settings routes', () => {
  let temp: TempDir;
  let envRestorers: Array<() => void>;
  let server: Server;
  let port: number;
  let frontendDir: string;
  let runtimeDataDir: string;
  let kbRoot: string;
  let kbFilePath: string;
  let outsideFilePath: string;
  let buildGraphMock: jest.Mock;
  let originalArgv: string[];

  beforeAll(async () => {
    temp = new TempDir('noteconnection-server');
    const projectRoot = temp.mkdir('project');
    frontendDir = temp.mkdir(path.join('project', 'dist', 'src', 'frontend'));
    runtimeDataDir = temp.mkdir(path.join('project', 'runtime_data'));
    kbRoot = temp.mkdir(path.join('project', 'Knowledge_Base'));
    temp.mkdir(path.join('project', 'Knowledge_Base', 'financial'));
    temp.mkdir(path.join('project', 'Knowledge_Base', 'legal'));
    kbFilePath = temp.file(path.join('project', 'Knowledge_Base', 'financial', 'overview.md'), '# Financial Overview\nInside KB root');
    outsideFilePath = temp.file(path.join('outside', 'sensitive.md'), '# Sensitive\nOutside KB root');

    temp.file(path.join('project', 'dist', 'src', 'frontend', 'data_financial.js'), 'const graphData = {"nodes":[{"id":"F"}]};');
    temp.file(path.join('project', 'dist', 'src', 'frontend', 'graph_data_financial.json'), '{"nodes":[{"id":"F"}],"links":[]}');
    temp.file(path.join('project', 'runtime_data', 'data_robotics.js'), 'const graphData = {"nodes":[{"id":"R"}]};');
    temp.file(path.join('project', 'runtime_data', 'data.js'), 'const graphData = {"nodes":[{"id":"ACTIVE"}],"edges":[]}');

    envRestorers = [];
    envRestorers.push(setEnv('NOTE_CONNECTION_PROJECT_ROOT', projectRoot));
    envRestorers.push(setEnv('NOTE_CONNECTION_FRONTEND_DIR', frontendDir));
    envRestorers.push(setEnv('NOTE_CONNECTION_RUNTIME_DATA_DIR', runtimeDataDir));
    envRestorers.push(setEnv('NOTE_CONNECTION_KB_ROOT', kbRoot));
    envRestorers.push(setEnv('npm_config_path', undefined));
    envRestorers.push(setEnv('npm_config_gpu', undefined));
    envRestorers.push(setEnv('npm_config_workers', undefined));
    envRestorers.push(setEnv('npm_config_static', undefined));

    port = await getFreePort();

    buildGraphMock = jest.fn().mockResolvedValue(undefined);
    jest.resetModules();
    originalArgv = [...process.argv];
    process.argv = process.argv.slice(0, 2);
    jest.doMock('./index', () => ({
      buildGraph: buildGraphMock
    }));
    jest.doMock('./core/PathBridge', () => ({
      PathBridge: jest.fn().mockImplementation(() => ({}))
    }));

    const serverModule = require('./server') as {
      startServer: (options?: { port?: number; targetPath?: string }) => Promise<Server>;
    };
    server = await serverModule.startServer({ port });
    buildGraphMock.mockClear();
  });

  afterAll(async () => {
    if (server) {
      if (typeof (server as any).closeAllConnections === 'function') {
        (server as any).closeAllConnections();
      }
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    }

    envRestorers.reverse().forEach((restore) => restore());
    jest.dontMock('./index');
    jest.dontMock('./core/PathBridge');
    process.argv = originalArgv;
    temp.cleanup();
  });

  test('lists Knowledge_Base folders using configured runtime path', async () => {
    const response = await requestJson(port, 'GET', '/api/folders');
    expect(response.status).toBe(200);
    expect(response.body.folders).toEqual(['financial', 'legal']);
  });

  test('merges available targets from folders and cached graph artifacts', async () => {
    const response = await requestJson(port, 'GET', '/api/available-targets');
    expect(response.status).toBe(200);
    expect(response.body.targets).toEqual(['financial', 'legal', 'robotics']);
  });

  test('serves /api/content for files inside KB root via absolute path', async () => {
    const response = await requestJson(
      port,
      'GET',
      `/api/content?path=${encodeURIComponent(kbFilePath)}`
    );

    expect(response.status).toBe(200);
    expect(response.body.content).toContain('Inside KB root');
  });

  test('serves /api/content for legacy Knowledge_Base-style paths', async () => {
    const legacyPath = 'C:\\snapshot\\NoteConnection_app\\Knowledge_Base\\financial\\overview.md';
    const response = await requestJson(
      port,
      'GET',
      `/api/content?path=${encodeURIComponent(legacyPath)}`
    );

    expect(response.status).toBe(200);
    expect(response.body.content).toContain('Financial Overview');
  });

  test('rejects /api/content requests outside configured KB root', async () => {
    const response = await requestJson(
      port,
      'GET',
      `/api/content?path=${encodeURIComponent(outsideFilePath)}`
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('outside configured knowledge base')
      })
    );
  });

  test('check-cache and restore-cache endpoints work for named targets', async () => {
    const cacheResponse = await requestJson(port, 'GET', '/api/check-cache?target=financial');
    expect(cacheResponse.status).toBe(200);
    expect(cacheResponse.body).toEqual(
      expect.objectContaining({
        size: expect.any(Number)
      })
    );

    const restoreResponse = await requestJson(port, 'GET', '/api/restore-cache?target=financial');
    expect(restoreResponse.status).toBe(200);
    expect(restoreResponse.body).toEqual(expect.objectContaining({ success: true }));
    expect(fs.existsSync(path.join(runtimeDataDir, 'data.js'))).toBe(true);
    expect(fs.existsSync(path.join(runtimeDataDir, 'graph_data.json'))).toBe(true);

    const duplicateRestoreResponse = await requestJson(port, 'GET', '/api/restore-cache?target=financial');
    expect(duplicateRestoreResponse.status).toBe(200);
    expect(duplicateRestoreResponse.body).toEqual(expect.objectContaining({ success: true, deduped: true }));
  });

  test('serves generated data.js when cache-busting query string is present', async () => {
    const response = await requestJson(port, 'GET', '/data.js?v=12345');
    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
    expect(response.body).toContain('const graphData');
  });

  test('deduplicates same build request while first build is in-flight', async () => {
    const hold = deferred();
    buildGraphMock.mockImplementationOnce(() => hold.promise);

    const payload = {
      target: 'financial',
      maxWorkers: 4,
      enableGPU: true,
      enableGPULayout: true,
      memorySavingMode: false,
      deepDebug: false
    };

    const firstRequest = requestJson(port, 'POST', '/api/build', payload);
    await new Promise((resolve) => setTimeout(resolve, 40));
    const secondRequest = requestJson(port, 'POST', '/api/build', payload);

    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(buildGraphMock).toHaveBeenCalledTimes(1);

    hold.resolve();
    const [firstResponse, secondResponse] = await Promise.all([firstRequest, secondRequest]);

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body).toEqual(expect.objectContaining({ success: true }));
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body).toEqual(expect.objectContaining({ success: true, deduped: true }));
  });

  test('returns 409 when a different build request arrives during active build', async () => {
    const hold = deferred();
    buildGraphMock.mockImplementationOnce(() => hold.promise);

    const firstRequest = requestJson(port, 'POST', '/api/build', {
      target: 'financial',
      maxWorkers: 4
    });
    await new Promise((resolve) => setTimeout(resolve, 40));

    const secondResponse = await requestJson(port, 'POST', '/api/build', {
      target: 'legal',
      maxWorkers: 4
    });

    expect(secondResponse.status).toBe(409);
    expect(secondResponse.body).toEqual(
      expect.objectContaining({
        success: false
      })
    );

    hold.resolve();
    const firstResponse = await firstRequest;
    expect(firstResponse.status).toBe(200);
  });
});
