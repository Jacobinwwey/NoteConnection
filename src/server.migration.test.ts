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

function requestRaw(
  port: number,
  method: 'GET' | 'POST',
  requestPath: string,
  payload?: string,
  extraHeaders?: Record<string, string>
): Promise<JsonResponse> {
  return new Promise((resolve, reject) => {
    const hasPayload = typeof payload === 'string';
    const headers: Record<string, string> = {
      ...(extraHeaders || {})
    };

    if (hasPayload) {
      headers['Content-Length'] = String(Buffer.byteLength(payload as string));
    }

    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: requestPath,
        method,
        headers: Object.keys(headers).length > 0 ? headers : undefined
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
    if (hasPayload) {
      req.write(payload as string);
    }
    req.end();
  });
}

function requestBinary(
  port: number,
  method: 'GET' | 'POST',
  requestPath: string,
  payload: Buffer,
  extraHeaders?: Record<string, string>
): Promise<JsonResponse> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      ...(extraHeaders || {}),
      'Content-Length': String(payload.length)
    };

    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: requestPath,
        method,
        headers
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
    req.write(payload);
    req.end();
  });
}

describe('server migration settings routes', () => {
  const TEST_CLIPBOARD_LIMIT_MB = 4;
  const TEST_CLIPBOARD_LIMIT_BYTES = TEST_CLIPBOARD_LIMIT_MB * 1024 * 1024;
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
  let renderMathPngMock: jest.Mock;
  let renderMermaidPngMock: jest.Mock;
  let copyPngToClipboardMock: jest.Mock;
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
    envRestorers.push(setEnv('NOTE_CONNECTION_CLIPBOARD_BODY_LIMIT_MB', String(TEST_CLIPBOARD_LIMIT_MB)));
    // Keep migration route tests hermetic even when CI injects auth env vars.
    envRestorers.push(setEnv('NOTE_CONNECTION_AUTH_TOKEN', undefined));
    envRestorers.push(setEnv('npm_config_path', undefined));
    envRestorers.push(setEnv('npm_config_gpu', undefined));
    envRestorers.push(setEnv('npm_config_workers', undefined));
    envRestorers.push(setEnv('npm_config_static', undefined));

    port = await getFreePort();

    buildGraphMock = jest.fn().mockResolvedValue(undefined);
    renderMathPngMock = jest.fn().mockResolvedValue({
      pngBase64: 'math-png-base64',
      width: 320,
      height: 120
    });
    renderMermaidPngMock = jest.fn().mockResolvedValue({
      pngBase64: 'mermaid-png-base64',
      svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      width: 640,
      height: 360
    });
    copyPngToClipboardMock = jest.fn().mockResolvedValue(undefined);
    jest.resetModules();
    originalArgv = [...process.argv];
    process.argv = process.argv.slice(0, 2);
    jest.doMock('./index', () => ({
      buildGraph: buildGraphMock
    }));
    jest.doMock('./core/PathBridge', () => ({
      PathBridge: jest.fn().mockImplementation(() => ({}))
    }));
    jest.doMock('./reader_renderer', () => ({
      renderMathPng: renderMathPngMock,
      renderMermaidPng: renderMermaidPngMock
    }));
    jest.doMock('./native_clipboard', () => ({
      copyPngToClipboard: copyPngToClipboardMock
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
    jest.dontMock('./reader_renderer');
    jest.dontMock('./native_clipboard');
    process.argv = originalArgv;
    temp.cleanup();
  });

  test('lists Knowledge_Base folders using configured runtime path', async () => {
    const response = await requestJson(port, 'GET', '/api/folders');
    expect(response.status).toBe(200);
    expect(response.body.folders).toEqual(['financial', 'legal']);
  });

  test.skip('returns runtime diagnostics with wasm parity state and no auth token exposure', async () => {
    const response = await requestJson(port, 'GET', '/api/runtime-diagnostics');
    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        runtime: expect.objectContaining({
          host: '127.0.0.1',
          port,
          bridgePort: expect.any(Number),
          kbRoot: expect.any(String),
          frontendDir: expect.any(String),
          runtimeDataDir: expect.any(String),
          authRequired: false
        }),
        ingress: expect.objectContaining({
          jsonBodyLimitBytes: 512 * 1024,
          requestBodySpoolThresholdBytes: expect.any(Number),
          requestBodySpoolThresholdKb: expect.any(Number),
          requestBodySpoolThresholdSource: expect.any(String),
          requestBodySpoolThresholdRecommendedKb: expect.any(Number),
          requestBodySpoolThresholdStrictMode: expect.any(Boolean),
          requestBodySpoolThresholdRangeKb: expect.objectContaining({
            min: expect.any(Number),
            max: expect.any(Number)
          }),
          clipboardBodyLimitBytes: TEST_CLIPBOARD_LIMIT_BYTES,
          clipboardBodyLimitMb: TEST_CLIPBOARD_LIMIT_MB,
          clipboardBodyLimitRangeMb: expect.objectContaining({
            min: expect.any(Number),
            max: expect.any(Number)
          })
        }),
        wasmParity: expect.objectContaining({
          enabled: expect.any(Boolean),
          hasCachedInstancePromise: expect.any(Boolean),
          nextRetryAtMs: expect.any(Number),
          lastExecutionMode: expect.any(String)
        }),
        computeModes: expect.objectContaining({
          layoutEngine: expect.objectContaining({
            mode: expect.any(String),
            nodeCount: expect.any(Number),
            edgeCount: expect.any(Number),
            durationMs: expect.any(Number),
            updatedAtMs: expect.any(Number)
          }),
          graphMetrics: expect.objectContaining({
            mode: expect.any(String),
            nodeCount: expect.any(Number),
            edgeCount: expect.any(Number),
            durationMs: expect.any(Number),
            updatedAtMs: expect.any(Number)
          })
        }),
        pathBridge: expect.any(Object)
      })
    );
    expect(response.body.wasmParity).toHaveProperty('artifactPath');
    expect(response.body.wasmParity).toHaveProperty('lastLoadError');
    expect(response.body.runtime.authToken).toBeUndefined();
  });

  test('server runtime path avoids synchronous filesystem APIs', () => {
    const serverSourcePath = path.join(__dirname, 'server.ts');
    const serverSource = fs.readFileSync(serverSourcePath, 'utf8');
    expect(serverSource).not.toMatch(/fs\.(existsSync|mkdirSync|readdirSync|writeFileSync|readFileSync|statSync|accessSync)\b/);
  });

  test.skip('merges available targets from folders and cached graph artifacts', async () => {
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

  test.skip('serves /api/content for legacy Knowledge_Base-style paths', async () => {
    const legacyPath = 'C:\\snapshot\\NoteConnection_app\\Knowledge_Base\\financial\\overview.md';
    const response = await requestJson(
      port,
      'GET',
      `/api/content?path=${encodeURIComponent(legacyPath)}`
    );

    expect(response.status).toBe(200);
    expect(response.body.content).toContain('Financial Overview');
  });

  test.skip('rejects /api/content requests outside configured KB root', async () => {
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

  test.skip('check-cache and restore-cache endpoints work for named targets', async () => {
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

  test('rejects static traversal attempts with raw parent-segment path', async () => {
    const response = await requestJson(port, 'GET', '/../../outside/sensitive.md');
    expect(response.status).toBe(403);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('Invalid static file path')
      })
    );
  });

  test('rejects static traversal attempts with encoded parent-segment path', async () => {
    const response = await requestJson(port, 'GET', '/%2e%2e/%2e%2e/outside/sensitive.md');
    expect(response.status).toBe(403);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('Invalid static file path')
      })
    );
  });

  test.skip('deduplicates same build request while first build is in-flight', async () => {
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
    expect(firstResponse.body).toEqual(
      expect.objectContaining({
        success: true,
        computeModes: expect.objectContaining({
          layoutEngine: expect.any(Object),
          graphMetrics: expect.any(Object)
        })
      })
    );
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body).toEqual(
      expect.objectContaining({
        success: true,
        deduped: true,
        computeModes: expect.objectContaining({
          layoutEngine: expect.any(Object),
          graphMetrics: expect.any(Object)
        })
      })
    );
  });

  test.skip('returns 409 when a different build request arrives during active build', async () => {
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

  test.skip('returns 413 when /api/build request body exceeds size limit', async () => {
    const oversizedPayload = {
      target: 'financial',
      pad: 'x'.repeat(700 * 1024)
    };
    const response = await requestJson(port, 'POST', '/api/build', oversizedPayload);

    expect(response.status).toBe(413);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('too large')
      })
    );
  });

  test.skip('returns 400 when /api/build request body contains invalid json', async () => {
    const response = await requestRaw(
      port,
      'POST',
      '/api/build',
      '{"target":',
      {
        'Content-Type': 'application/json'
      }
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('Invalid JSON')
      })
    );
  });

  test.skip('omits svg from /api/render/mermaid by default to keep payloads PNG-focused', async () => {
    const response = await requestJson(port, 'POST', '/api/render/mermaid', {
      source: 'graph TD; A-->B',
      renderer: 'local'
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        pngBase64: 'mermaid-png-base64',
        width: 640,
        height: 360,
        renderer: 'local-resvg'
      })
    );
    expect(response.body.svg).toBeUndefined();
    expect(renderMermaidPngMock).toHaveBeenCalled();
  });

  test.skip('returns svg from /api/render/mermaid when includeSvg is explicitly enabled', async () => {
    const response = await requestJson(port, 'POST', '/api/render/mermaid', {
      source: 'graph TD; A-->B',
      renderer: 'local',
      includeSvg: true
    });

    expect(response.status).toBe(200);
    expect(response.body.svg).toContain('<svg');
  });

  test.skip('auto-includes svg when includeStages is enabled for diagnostics compatibility', async () => {
    const response = await requestJson(port, 'POST', '/api/render/mermaid', {
      source: 'graph TD; A-->B',
      renderer: 'local',
      includeStages: true
    });

    expect(response.status).toBe(200);
    expect(response.body.svg).toContain('<svg');
  });

  test.skip('returns 415 when /api/kb-path request content type is not json', async () => {
    const response = await requestRaw(
      port,
      'POST',
      '/api/kb-path',
      'kbPath=/tmp',
      {
        'Content-Type': 'text/plain'
      }
    );

    expect(response.status).toBe(415);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('Unsupported Content-Type')
      })
    );
  });

  test.skip('accepts binary PNG upload for clipboard copy without base64 JSON payload', async () => {
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+VwAAAABJRU5ErkJggg==',
      'base64'
    );
    const response = await requestBinary(
      port,
      'POST',
      '/api/clipboard/image-binary',
      tinyPng,
      {
        'Content-Type': 'image/png'
      }
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        ok: true,
        transport: 'binary'
      })
    );
  });

  test.skip('returns 415 for unsupported binary clipboard content type', async () => {
    const response = await requestRaw(
      port,
      'POST',
      '/api/clipboard/image-binary',
      'not-a-png',
      {
        'Content-Type': 'text/plain'
      }
    );

    expect(response.status).toBe(415);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('Unsupported Content-Type')
      })
    );
  });

  test.skip('returns 413 when binary clipboard payload exceeds limit', async () => {
    const oversized = Buffer.alloc(TEST_CLIPBOARD_LIMIT_BYTES + 1, 0x00);
    const response = await requestBinary(
      port,
      'POST',
      '/api/clipboard/image-binary',
      oversized,
      {
        'Content-Type': 'application/octet-stream'
      }
    );

    expect(response.status).toBe(413);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('too large')
      })
    );
  });
});
