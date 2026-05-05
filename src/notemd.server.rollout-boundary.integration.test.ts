import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import type { Server } from 'http';

type JsonResponse = {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: any;
};

class TempDir {
  public readonly path: string;

  constructor(prefix: string) {
    this.path = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), `${prefix}-`));
  }

  public mkdir(relativePath: string): string {
    const target = path.join(this.path, relativePath);
    fs.mkdirSync(target, { recursive: true });
    return target;
  }

  public file(relativePath: string, content: string): string {
    const target = path.join(this.path, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
    return target;
  }

  public cleanup(): void {
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
      if (!address || typeof address !== 'object') {
        reject(new Error('No free port available.'));
        return;
      }
      const port = address.port;
      probe.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function startMockGraphDbSnapshotServer(): Promise<{
  endpoint: string;
  requests: Array<{ method: string; path: string; body: unknown }>;
  close: () => Promise<void>;
}> {
  let persistedSnapshot: Record<string, unknown> | null = null;
  const requests: Array<{ method: string; path: string; body: unknown }> = [];
  const server = http.createServer((req, res) => {
    const method = String(req.method || 'GET').toUpperCase();
    const requestPath = String(req.url || '');
    let rawBody = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      rawBody += chunk;
    });
    req.on('end', () => {
      let parsedBody: unknown = null;
      if (rawBody.trim().length > 0) {
        try {
          parsedBody = JSON.parse(rawBody);
        } catch {
          parsedBody = rawBody;
        }
      }
      requests.push({
        method,
        path: requestPath,
        body: parsedBody,
      });

      if (requestPath !== '/graphdb/snapshot') {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'not_found' }));
        return;
      }

      if (method === 'GET') {
        if (!persistedSnapshot) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'snapshot_not_found' }));
          return;
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, snapshot: persistedSnapshot }));
        return;
      }

      if (method === 'POST') {
        const snapshot = (
          parsedBody
          && typeof parsedBody === 'object'
          && !Array.isArray(parsedBody)
          && Object.prototype.hasOwnProperty.call(parsedBody, 'snapshot')
        )
          ? (parsedBody as { snapshot: Record<string, unknown> }).snapshot
          : null;
        if (!snapshot) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'snapshot_required' }));
          return;
        }
        persistedSnapshot = snapshot;
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true }));
        return;
      }

      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'method_not_allowed' }));
    });
  });

  const port = await new Promise<number>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address !== 'object') {
        reject(new Error('Failed to allocate graphdb mock port.'));
        return;
      }
      resolve(address.port);
    });
  });

  return {
    endpoint: `http://127.0.0.1:${port}/graphdb`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}

async function startMockVectorAccelerationServer(): Promise<{
  endpoint: string;
  requests: Array<{ method: string; path: string; body: unknown }>;
  close: () => Promise<void>;
}> {
  const requests: Array<{ method: string; path: string; body: unknown }> = [];
  const server = http.createServer((req, res) => {
    const method = String(req.method || 'GET').toUpperCase();
    const requestPath = String(req.url || '');
    let rawBody = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      rawBody += chunk;
    });
    req.on('end', () => {
      let parsedBody: unknown = null;
      if (rawBody.trim().length > 0) {
        try {
          parsedBody = JSON.parse(rawBody);
        } catch {
          parsedBody = rawBody;
        }
      }
      requests.push({
        method,
        path: requestPath,
        body: parsedBody,
      });

      if (requestPath !== '/ann/select-candidates') {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'not_found' }));
        return;
      }
      if (method !== 'POST') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'method_not_allowed' }));
        return;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Request-Id', 'ann-success-req');
      res.end(JSON.stringify({
        used: false,
        mode: 'full_scan',
        candidateAtomIds: [],
      }));
    });
  });

  const port = await new Promise<number>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address !== 'object') {
        reject(new Error('Failed to allocate vector acceleration mock port.'));
        return;
      }
      resolve(address.port);
    });
  });

  return {
    endpoint: `http://127.0.0.1:${port}/ann`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}

function requestJson(
  port: number,
  method: string,
  requestPath: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {}
): Promise<JsonResponse> {
  return new Promise((resolve, reject) => {
    const payload = typeof body === 'undefined' ? null : Buffer.from(JSON.stringify(body), 'utf8');
    const mergedHeaders: Record<string, string> = payload
      ? {
          'Content-Type': 'application/json',
          'Content-Length': String(payload.length),
          ...extraHeaders,
        }
      : { ...extraHeaders };

    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: requestPath,
        method,
        headers: Object.keys(mergedHeaders).length > 0 ? mergedHeaders : undefined,
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
            headers: res.headers,
            body: parsed,
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

type BootedServer = {
  port: number;
  server: Server;
  cleanup: () => Promise<void>;
};

async function bootIntegrationServer(envOverrides: Record<string, string | undefined> = {}): Promise<BootedServer> {
  const temp = new TempDir('noteconnection-rollout-boundary');
  const projectRoot = temp.mkdir('project');
  temp.mkdir(path.join('project', 'dist', 'src', 'frontend'));
  const runtimeDataDir = temp.mkdir(path.join('project', 'runtime_data'));
  temp.mkdir(path.join('project', 'Knowledge_Base'));
  temp.file(
    path.join('project', 'Knowledge_Base', 'seed', 'topic.md'),
    '# Seed Node\n\nSeed document for rollout integration tests.'
  );
  const appConfigPath = temp.file(
    path.join('project', 'config', 'app_config.toml'),
    [
      `knowledge_base_path = "${path.join(projectRoot, 'Knowledge_Base').replace(/\\/g, '\\\\')}"`,
      'user_language = "en"',
      '',
      '[notemd]',
      'developer_mode = true',
      'language = "en"',
      'chunk_word_count = 512',
      'max_tokens = 2048',
      'auto_mermaid_fix_after_generate = true',
      '',
      '[notemd.api]',
      'provider = "OpenAI"',
      'base_url = "https://api.openai.com/v1"',
      'model = "gpt-4o-mini"',
      'api_key = "integration-test-key"',
      'api_version = ""',
      'temperature = 0.25',
      '',
    ].join('\n')
  );

  const envRestorers: Array<() => void> = [];
  const baseEnv: Record<string, string | undefined> = {
    NOTE_CONNECTION_PROJECT_ROOT: projectRoot,
    NOTE_CONNECTION_FRONTEND_DIR: path.join(projectRoot, 'dist', 'src', 'frontend'),
    NOTE_CONNECTION_RUNTIME_DATA_DIR: runtimeDataDir,
    NOTE_CONNECTION_KB_ROOT: path.join(projectRoot, 'Knowledge_Base'),
    NOTE_CONNECTION_CONFIG_PATH: appConfigPath,
    NOTE_CONNECTION_CONFIG_DIR: undefined,
    NOTE_CONNECTION_AUTH_TOKEN: undefined,
    npm_config_path: undefined,
    npm_config_gpu: undefined,
    npm_config_workers: undefined,
    npm_config_static: undefined,
  };
  const finalEnv = {
    ...baseEnv,
    ...envOverrides,
  };
  Object.entries(finalEnv).forEach(([key, value]) => {
    envRestorers.push(setEnv(key, value));
  });

  let server: Server | undefined;
  const originalArgv = [...process.argv];
  const port = await getFreePort();
  try {
    jest.resetModules();
    process.argv = process.argv.slice(0, 2);
    jest.doMock('./index', () => ({
      buildGraph: jest.fn().mockResolvedValue(undefined),
    }));
    jest.doMock('./core/PathBridge', () => ({
      PathBridge: jest.fn().mockImplementation(() => ({})),
    }));
    jest.doMock('./reader_renderer', () => ({
      renderMathPng: jest.fn().mockResolvedValue({
        pngBase64: 'math',
        width: 100,
        height: 50,
      }),
      renderMermaidPng: jest.fn().mockResolvedValue({
        pngBase64: 'mermaid',
        width: 100,
        height: 50,
      }),
    }));
    const serverModule = require('./server') as {
      startServer: (options?: { port?: number; targetPath?: string }) => Promise<Server>;
    };
    server = await serverModule.startServer({ port });

    return {
      port,
      server,
      cleanup: async () => {
        if (server) {
          if (typeof (server as any).closeAllConnections === 'function') {
            (server as any).closeAllConnections();
          }
          await new Promise<void>((resolve, reject) => {
            server!.close((err) => {
              if (err) {
                reject(err);
                return;
              }
              resolve();
            });
          });
        }
        envRestorers.reverse().forEach((restore) => restore());
        process.argv = originalArgv;
        jest.dontMock('./index');
        jest.dontMock('./core/PathBridge');
        jest.dontMock('./reader_renderer');
        jest.resetModules();
        temp.cleanup();
      },
    };
  } catch (error) {
    if (server) {
      if (typeof (server as any).closeAllConnections === 'function') {
        (server as any).closeAllConnections();
      }
      await new Promise<void>((resolve) => {
        server!.close(() => resolve());
      });
    }
    envRestorers.reverse().forEach((restore) => restore());
    process.argv = originalArgv;
    jest.dontMock('./index');
    jest.dontMock('./core/PathBridge');
    jest.dontMock('./reader_renderer');
    jest.resetModules();
    temp.cleanup();
    throw error;
  }
}

describe('NoteMD server rollout boundary integration', () => {
  test('vector acceleration representation strict mode promotes rollout vector strictness even in fail_open mode', async () => {
    const booted = await bootIntegrationServer({
      NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_FAILURE_MODE: 'fail_open',
      NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_REPRESENTATION_STRICT: 'true',
    });

    try {
      const stateResponse = await requestJson(booted.port, 'GET', '/api/knowledge/state');
      expect(stateResponse.status).toBe(200);
      expect(stateResponse.body.success).toBe(true);
      expect(String(stateResponse.body.rolloutProfile?.vectorAcceleration?.failureMode || '')).toBe('fail_open');
      expect(stateResponse.body.rolloutProfile?.vectorAcceleration?.representationStrict).toBe(true);
      expect(stateResponse.body.rolloutProfile?.vectorAcceleration?.strict).toBe(true);
      expect(String(stateResponse.body.rolloutProfile?.mode || '')).toBe('mixed');

      const diagnosticsResponse = await requestJson(booted.port, 'GET', '/api/knowledge/query-backend-diagnostics');
      expect(diagnosticsResponse.status).toBe(200);
      expect(diagnosticsResponse.body.success).toBe(true);
      expect(diagnosticsResponse.body.configuredVectorAccelerationRepresentationStrict).toBe(true);

      const configResponse = await requestJson(booted.port, 'GET', '/api/knowledge/query-backend-config');
      expect(configResponse.status).toBe(200);
      expect(configResponse.body.success).toBe(true);
      expect(configResponse.body.configuredVectorAccelerationRepresentationStrict).toBe(true);
    } finally {
      await booted.cleanup();
    }
  });

  test('vector acceleration fail_closed surfaces strict adapter failure in query trace and diagnostics', async () => {
    const booted = await bootIntegrationServer({
      NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_PROVIDER: 'external_http',
      NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_HTTP_ENDPOINT: 'http://127.0.0.1:9/ann/select',
      NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_HTTP_TIMEOUT_MS: '120',
      NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_HTTP_MAX_RETRIES: '0',
      NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_HTTP_RETRY_DELAY_MS: '0',
      NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_HTTP_CIRCUIT_FAILURE_THRESHOLD: '1',
      NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_HTTP_CIRCUIT_COOLDOWN_MS: '60000',
      NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_FAILURE_MODE: 'fail_closed',
    });

    try {
      const documents = Array.from({ length: 110 }, (_, index) => ({
        documentId: `doc_vector_strict_${index}`,
        sourcePath: `Knowledge_Base/vector/strict_${index}.md`,
        language: 'en',
        content: `# Vector Strict ${index}\n\nVector acceleration strict mode retrieval token ${index}.`,
      }));
      const ingestResponse = await requestJson(booted.port, 'POST', '/api/knowledge/ingest', {
        incremental: true,
        documents,
      });
      expect(ingestResponse.status).toBe(200);
      expect(ingestResponse.body.success).toBe(true);
      expect(Number(ingestResponse.body.result?.summary?.activeAtoms || 0)).toBeGreaterThanOrEqual(96);

      const switchToVector = await requestJson(booted.port, 'PUT', '/api/knowledge/query-backend-config', {
        backend: 'vector',
      });
      expect(switchToVector.status).toBe(200);
      expect(switchToVector.body.success).toBe(true);
      expect(String(switchToVector.body.result?.configuredBackend || '')).toBe('local_vector');

      const queryResponse = await requestJson(booted.port, 'POST', '/api/knowledge/query', {
        query: 'vector acceleration strict mode retrieval',
        topK: 5,
      });
      expect(queryResponse.status).toBe(200);
      expect(queryResponse.body.success).toBe(true);
      expect(String(queryResponse.body.result?.trace?.queryBackendId || '')).toBe('local-vector-v1');
      expect(queryResponse.body.result?.trace?.backendFallbackUsed).toBe(true);
      expect(String(queryResponse.body.result?.trace?.backendError || '')).toContain(
        'vector_acceleration_adapter_failure'
      );
      expect(queryResponse.body.result?.trace?.retrievalModes).toContain('backend_fallback');

      const diagnosticsResponse = await requestJson(booted.port, 'GET', '/api/knowledge/query-backend-diagnostics');
      expect(diagnosticsResponse.status).toBe(200);
      expect(diagnosticsResponse.body.success).toBe(true);
      expect(String(diagnosticsResponse.body.diagnostics?.configuredBackend || '')).toBe('local_vector');
      expect(String(diagnosticsResponse.body.configuredVectorAccelerationProvider || '')).toBe('external_http');
      expect(String(diagnosticsResponse.body.configuredVectorAccelerationFailureMode || '')).toBe('fail_closed');
      expect(typeof diagnosticsResponse.body.configuredVectorAccelerationRepresentationStrict).toBe('boolean');
      expect(diagnosticsResponse.body.queryVectorAnnPrefilterEnabled).toBe(true);
      expect(String(diagnosticsResponse.body.diagnostics?.lastError || '')).toContain(
        'vector_acceleration_adapter_failure'
      );
      expect(
        String(diagnosticsResponse.body.diagnostics?.runtime?.vectorIndex?.acceleration?.failureMode || '')
      ).toBe('fail_closed');
      expect(Number(diagnosticsResponse.body.diagnostics?.fallbackCount || 0)).toBeGreaterThanOrEqual(1);
    } finally {
      await booted.cleanup();
    }
  });

  test('vector acceleration external_http success path keeps strict mode healthy without backend fallback', async () => {
    const mockVectorServer = await startMockVectorAccelerationServer();
    const booted = await bootIntegrationServer({
      NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_PROVIDER: 'external_http',
      NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_HTTP_ENDPOINT: mockVectorServer.endpoint,
      NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_HTTP_TIMEOUT_MS: '1200',
      NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_HTTP_MAX_RETRIES: '0',
      NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_HTTP_RETRY_DELAY_MS: '0',
      NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_FAILURE_MODE: 'fail_closed',
    });

    try {
      const documents = Array.from({ length: 104 }, (_, index) => ({
        documentId: `doc_vector_http_success_${index}`,
        sourcePath: `Knowledge_Base/vector/http_success_${index}.md`,
        language: 'en',
        content: `# Vector HTTP Success ${index}\n\nVector acceleration success mode retrieval token ${index}.`,
      }));
      const ingestResponse = await requestJson(booted.port, 'POST', '/api/knowledge/ingest', {
        incremental: true,
        documents,
      });
      expect(ingestResponse.status).toBe(200);
      expect(ingestResponse.body.success).toBe(true);
      expect(Number(ingestResponse.body.result?.summary?.activeAtoms || 0)).toBeGreaterThanOrEqual(96);

      const switchToVector = await requestJson(booted.port, 'PUT', '/api/knowledge/query-backend-config', {
        backend: 'vector',
      });
      expect(switchToVector.status).toBe(200);
      expect(switchToVector.body.success).toBe(true);
      expect(String(switchToVector.body.result?.configuredBackend || '')).toBe('local_vector');

      const queryResponse = await requestJson(booted.port, 'POST', '/api/knowledge/query', {
        query: 'vector acceleration success mode retrieval',
        topK: 5,
      });
      expect(queryResponse.status).toBe(200);
      expect(queryResponse.body.success).toBe(true);
      expect(String(queryResponse.body.result?.trace?.queryBackendId || '')).toBe('local-vector-v1');
      expect(queryResponse.body.result?.trace?.backendFallbackUsed).toBe(false);
      expect(String(queryResponse.body.result?.trace?.backendError || '')).toBe('');
      expect(
        String(queryResponse.body.result?.trace?.vectorAcceleration?.adapterId || '')
      ).toBe('external-http-vector-acceleration-v1');
      expect(
        String(queryResponse.body.result?.trace?.vectorAcceleration?.healthStatus || '')
      ).toBe('ready');
      expect(
        String(queryResponse.body.result?.trace?.vectorAcceleration?.lastRequestId || '')
      ).toBe('ann-success-req');

      const diagnosticsResponse = await requestJson(booted.port, 'GET', '/api/knowledge/query-backend-diagnostics');
      expect(diagnosticsResponse.status).toBe(200);
      expect(diagnosticsResponse.body.success).toBe(true);
      expect(String(diagnosticsResponse.body.diagnostics?.configuredBackend || '')).toBe('local_vector');
      expect(String(diagnosticsResponse.body.configuredVectorAccelerationProvider || '')).toBe('external_http');
      expect(String(diagnosticsResponse.body.configuredVectorAccelerationFailureMode || '')).toBe('fail_closed');
      expect(typeof diagnosticsResponse.body.configuredVectorAccelerationRepresentationStrict).toBe('boolean');
      expect(diagnosticsResponse.body.queryVectorAnnPrefilterEnabled).toBe(true);
      expect(String(diagnosticsResponse.body.diagnostics?.lastError || '')).toBe('');
      expect(
        String(diagnosticsResponse.body.diagnostics?.runtime?.vectorIndex?.acceleration?.failureMode || '')
      ).toBe('fail_closed');
      expect(
        String(diagnosticsResponse.body.diagnostics?.runtime?.vectorIndex?.acceleration?.healthStatus || '')
      ).toBe('ready');
      expect(
        String(diagnosticsResponse.body.diagnostics?.runtime?.vectorIndex?.acceleration?.lastRequestId || '')
      ).toBe('ann-success-req');
      expect(
        Number(diagnosticsResponse.body.diagnostics?.runtime?.vectorIndex?.acceleration?.failureCount || 0)
      ).toBe(0);
      expect(Number(diagnosticsResponse.body.diagnostics?.fallbackCount || 0)).toBe(0);

      expect(
        mockVectorServer.requests.some((item) => item.method === 'POST' && item.path === '/ann/select-candidates')
      ).toBe(true);
    } finally {
      await booted.cleanup();
      await mockVectorServer.close();
    }
  });

  test('vector acceleration fail_closed fails on external_http endpoint missing and surfaces fallback trace', async () => {
    const booted = await bootIntegrationServer({
      NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_PROVIDER: 'external_http',
      NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_HTTP_ENDPOINT: '',
      NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_FAILURE_MODE: 'fail_closed',
    });

    try {
      const documents = Array.from({ length: 96 }, (_, index) => ({
        documentId: `doc_vector_endpoint_missing_${index}`,
        sourcePath: `Knowledge_Base/vector/endpoint_missing_${index}.md`,
        language: 'en',
        content: `# Vector Endpoint Missing ${index}\n\nVector acceleration endpoint missing strict mode token ${index}.`,
      }));
      const ingestResponse = await requestJson(booted.port, 'POST', '/api/knowledge/ingest', {
        incremental: true,
        documents,
      });
      expect(ingestResponse.status).toBe(200);
      expect(ingestResponse.body.success).toBe(true);

      const switchToVector = await requestJson(booted.port, 'PUT', '/api/knowledge/query-backend-config', {
        backend: 'vector',
      });
      expect(switchToVector.status).toBe(200);
      expect(switchToVector.body.success).toBe(true);
      expect(String(switchToVector.body.result?.configuredBackend || '')).toBe('local_vector');

      const queryResponse = await requestJson(booted.port, 'POST', '/api/knowledge/query', {
        query: 'vector acceleration endpoint missing strict mode',
        topK: 5,
      });
      expect(queryResponse.status).toBe(200);
      expect(queryResponse.body.success).toBe(true);
      expect(String(queryResponse.body.result?.trace?.queryBackendId || '')).toBe('local-vector-v1');
      expect(queryResponse.body.result?.trace?.backendFallbackUsed).toBe(true);
      expect(String(queryResponse.body.result?.trace?.backendError || '')).toContain(
        'vector_acceleration_adapter_failure'
      );
      expect(String(queryResponse.body.result?.trace?.backendError || '')).toContain('external_http_endpoint_missing');
      expect(queryResponse.body.result?.trace?.retrievalModes).toContain('backend_fallback');

      const diagnosticsResponse = await requestJson(booted.port, 'GET', '/api/knowledge/query-backend-diagnostics');
      expect(diagnosticsResponse.status).toBe(200);
      expect(diagnosticsResponse.body.success).toBe(true);
      expect(String(diagnosticsResponse.body.diagnostics?.configuredBackend || '')).toBe('local_vector');
      expect(String(diagnosticsResponse.body.configuredVectorAccelerationProvider || '')).toBe('external_http');
      expect(String(diagnosticsResponse.body.configuredVectorAccelerationFailureMode || '')).toBe('fail_closed');
      expect(typeof diagnosticsResponse.body.configuredVectorAccelerationRepresentationStrict).toBe('boolean');
      expect(diagnosticsResponse.body.queryVectorAnnPrefilterEnabled).toBe(true);
      expect(String(diagnosticsResponse.body.diagnostics?.lastError || '')).toContain(
        'vector_acceleration_adapter_failure'
      );
      expect(String(diagnosticsResponse.body.diagnostics?.lastError || '')).toContain('external_http_endpoint_missing');
      expect(
        String(diagnosticsResponse.body.diagnostics?.runtime?.vectorIndex?.acceleration?.failureMode || '')
      ).toBe('fail_closed');
      expect(
        String(diagnosticsResponse.body.diagnostics?.runtime?.vectorIndex?.acceleration?.healthStatus || '')
      ).toBe('unavailable');
      expect(
        String(diagnosticsResponse.body.diagnostics?.runtime?.vectorIndex?.acceleration?.lastErrorCode || '')
      ).toBe('endpoint_missing');
      expect(Number(diagnosticsResponse.body.diagnostics?.fallbackCount || 0)).toBeGreaterThanOrEqual(1);
    } finally {
      await booted.cleanup();
    }
  });

  test('graphdb strict mode with no adapter fails closed on store APIs', async () => {
    const booted = await bootIntegrationServer({
      NOTE_CONNECTION_KNOWLEDGE_STORE_BACKEND: 'graphdb',
      NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_ADAPTER_PROVIDER: 'none',
      NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_FALLBACK_ENABLED: 'false',
    });

    try {
      const reloadResponse = await requestJson(booted.port, 'POST', '/api/knowledge/store/reload');
      expect(reloadResponse.status).toBe(500);
      expect(reloadResponse.body.success).toBe(false);
      expect(String(reloadResponse.body.errorCode || '')).toBe('internal_error');
      expect(String(reloadResponse.body.error || '')).toContain('graphdb_adapter_unavailable_no_fallback');

      const diagnosticsResponse = await requestJson(booted.port, 'GET', '/api/knowledge/store-diagnostics');
      expect(diagnosticsResponse.status).toBe(500);
      expect(diagnosticsResponse.body.success).toBe(false);
      expect(String(diagnosticsResponse.body.error || '')).toContain('graphdb_adapter_unavailable_no_fallback');
    } finally {
      await booted.cleanup();
    }
  });

  test('graphdb strict mode with external_http adapter serves reload and diagnostics success path', async () => {
    const mockGraphDbServer = await startMockGraphDbSnapshotServer();
    let booted: BootedServer | null = null;

    try {
      booted = await bootIntegrationServer({
        NOTE_CONNECTION_KNOWLEDGE_STORE_BACKEND: 'graphdb',
        NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_ADAPTER_PROVIDER: 'external_http',
        NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_ADAPTER_ID: 'integration-http-graphdb',
        NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_ENDPOINT: mockGraphDbServer.endpoint,
        NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_TIMEOUT_MS: '1200',
        NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_MAX_RETRIES: '0',
        NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_RETRY_DELAY_MS: '0',
        NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_FALLBACK_ENABLED: 'false',
      });

      const ingestResponse = await requestJson(booted.port, 'POST', '/api/knowledge/ingest', {
        incremental: true,
        documents: [
          {
            documentId: 'graphdb_http_seed_1',
            sourcePath: 'Knowledge_Base/graphdb/http_seed.md',
            language: 'en',
            content: '# GraphDB HTTP Seed\n\nseed document for graphdb http strict integration path.',
          },
        ],
      });
      expect(ingestResponse.status).toBe(200);
      expect(ingestResponse.body.success).toBe(true);

      const reloadResponse = await requestJson(booted.port, 'POST', '/api/knowledge/store/reload');
      expect(reloadResponse.status).toBe(200);
      expect(reloadResponse.body.success).toBe(true);
      expect(String(reloadResponse.body.configuredBackend || '')).toBe('graphdb');
      expect(String(reloadResponse.body.configuredGraphDbAdapterProvider || '')).toBe('http');
      expect(String(reloadResponse.body.configuredGraphDbAdapterId || '')).toBe('integration-http-graphdb');
      expect(reloadResponse.body.graphDbFallbackEnabled).toBe(false);
      expect(String(reloadResponse.body.configuredGraphDbOperationMode || '')).toBe('snapshot_only');
      expect(reloadResponse.body.restored).toBe(true);
      expect(String(reloadResponse.body.store?.storeType || '')).toBe('graphdb');
      expect(String(reloadResponse.body.store?.adapterId || '')).toBe('integration-http-graphdb');
      expect(reloadResponse.body.store?.backendReady).toBe(true);
      expect(reloadResponse.body.store?.fallbackEnabled).toBe(false);
      expect(reloadResponse.body.store?.usingFallback).toBe(false);
      expect(String(reloadResponse.body.store?.graphDbOperationMode || '')).toBe('snapshot_only');
      expect(String(reloadResponse.body.store?.graphDbAdapterCapabilityMode || '')).toBe('snapshot_only');
      expect(String(reloadResponse.body.store?.graphDbReadPath || '')).toBe('snapshot');
      expect(String(reloadResponse.body.store?.graphDbWritePath || '')).toBe('snapshot');

      const diagnosticsResponse = await requestJson(booted.port, 'GET', '/api/knowledge/store-diagnostics');
      expect(diagnosticsResponse.status).toBe(200);
      expect(diagnosticsResponse.body.success).toBe(true);
      expect(String(diagnosticsResponse.body.configuredBackend || '')).toBe('graphdb');
      expect(String(diagnosticsResponse.body.configuredGraphDbAdapterProvider || '')).toBe('http');
      expect(String(diagnosticsResponse.body.configuredGraphDbAdapterId || '')).toBe('integration-http-graphdb');
      expect(diagnosticsResponse.body.graphDbFallbackEnabled).toBe(false);
      expect(String(diagnosticsResponse.body.configuredGraphDbOperationMode || '')).toBe('snapshot_only');
      expect(String(diagnosticsResponse.body.store?.storeType || '')).toBe('graphdb');
      expect(String(diagnosticsResponse.body.store?.adapterId || '')).toBe('integration-http-graphdb');
      expect(String(diagnosticsResponse.body.store?.location || '')).toContain('/graphdb/snapshot');
      expect(diagnosticsResponse.body.store?.backendReady).toBe(true);
      expect(diagnosticsResponse.body.store?.exists).toBe(true);
      expect(diagnosticsResponse.body.store?.loaded).toBe(true);
      expect(diagnosticsResponse.body.store?.fallbackEnabled).toBe(false);
      expect(diagnosticsResponse.body.store?.usingFallback).toBe(false);
      expect(String(diagnosticsResponse.body.store?.graphDbOperationMode || '')).toBe('snapshot_only');
      expect(String(diagnosticsResponse.body.store?.graphDbAdapterCapabilityMode || '')).toBe('snapshot_only');
      expect(String(diagnosticsResponse.body.store?.graphDbReadPath || '')).toBe('snapshot');
      expect(String(diagnosticsResponse.body.store?.graphDbWritePath || '')).toBe('snapshot');
      expect(Array.isArray(diagnosticsResponse.body.store?.graphDbSupportedReadOperations)).toBe(true);
      expect(Array.isArray(diagnosticsResponse.body.store?.graphDbSupportedWriteOperations)).toBe(true);
      expect(String(diagnosticsResponse.body.store?.connector?.healthStatus || '')).toBe('ready');
      expect(String(diagnosticsResponse.body.store?.connector?.circuitState || '')).toBe('closed');
      expect(Number(diagnosticsResponse.body.store?.connector?.requestCount || 0)).toBeGreaterThanOrEqual(2);
      expect(String(diagnosticsResponse.body.store?.connector?.lastRequestId || '')).toContain('graphdb');

      expect(
        mockGraphDbServer.requests.some((item) => item.method === 'POST' && item.path === '/graphdb/snapshot')
      ).toBe(true);
      expect(
        mockGraphDbServer.requests.some((item) => item.method === 'GET' && item.path === '/graphdb/snapshot')
      ).toBe(true);
    } finally {
      if (booted) {
        await booted.cleanup();
      }
      await mockGraphDbServer.close();
    }
  });

  test('graphdb external_http adapter keeps snapshot path when operation mode requests ops_preferred', async () => {
    const mockGraphDbServer = await startMockGraphDbSnapshotServer();
    let booted: BootedServer | null = null;

    try {
      booted = await bootIntegrationServer({
        NOTE_CONNECTION_KNOWLEDGE_STORE_BACKEND: 'graphdb',
        NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_ADAPTER_PROVIDER: 'external_http',
        NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_ADAPTER_ID: 'integration-http-graphdb-ops-preferred',
        NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_ENDPOINT: mockGraphDbServer.endpoint,
        NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_TIMEOUT_MS: '1200',
        NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_MAX_RETRIES: '0',
        NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_RETRY_DELAY_MS: '0',
        NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_FALLBACK_ENABLED: 'false',
        NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_OPERATION_MODE: 'ops_preferred',
      });

      const ingestResponse = await requestJson(booted.port, 'POST', '/api/knowledge/ingest', {
        incremental: true,
        documents: [
          {
            documentId: 'graphdb_http_ops_requested_seed_1',
            sourcePath: 'Knowledge_Base/graphdb/http_ops_requested_seed.md',
            language: 'en',
            content: '# GraphDB HTTP Ops Requested Seed\n\nseed document for graphdb http adapter ops requested path.',
          },
        ],
      });
      expect(ingestResponse.status).toBe(200);
      expect(ingestResponse.body.success).toBe(true);

      const reloadResponse = await requestJson(booted.port, 'POST', '/api/knowledge/store/reload');
      expect(reloadResponse.status).toBe(200);
      expect(reloadResponse.body.success).toBe(true);
      expect(String(reloadResponse.body.configuredBackend || '')).toBe('graphdb');
      expect(String(reloadResponse.body.configuredGraphDbAdapterProvider || '')).toBe('http');
      expect(String(reloadResponse.body.configuredGraphDbAdapterId || '')).toBe('integration-http-graphdb-ops-preferred');
      expect(String(reloadResponse.body.configuredGraphDbOperationMode || '')).toBe('ops_preferred');
      expect(reloadResponse.body.graphDbFallbackEnabled).toBe(false);
      expect(String(reloadResponse.body.store?.graphDbOperationMode || '')).toBe('ops_preferred');
      expect(String(reloadResponse.body.store?.graphDbAdapterCapabilityMode || '')).toBe('snapshot_only');
      expect(String(reloadResponse.body.store?.graphDbReadPath || '')).toBe('snapshot');
      expect(String(reloadResponse.body.store?.graphDbWritePath || '')).toBe('snapshot');

      const diagnosticsResponse = await requestJson(booted.port, 'GET', '/api/knowledge/store-diagnostics');
      expect(diagnosticsResponse.status).toBe(200);
      expect(diagnosticsResponse.body.success).toBe(true);
      expect(String(diagnosticsResponse.body.configuredBackend || '')).toBe('graphdb');
      expect(String(diagnosticsResponse.body.configuredGraphDbAdapterProvider || '')).toBe('http');
      expect(String(diagnosticsResponse.body.configuredGraphDbAdapterId || '')).toBe('integration-http-graphdb-ops-preferred');
      expect(String(diagnosticsResponse.body.configuredGraphDbOperationMode || '')).toBe('ops_preferred');
      expect(String(diagnosticsResponse.body.store?.graphDbOperationMode || '')).toBe('ops_preferred');
      expect(String(diagnosticsResponse.body.store?.graphDbAdapterCapabilityMode || '')).toBe('snapshot_only');
      expect(String(diagnosticsResponse.body.store?.graphDbReadPath || '')).toBe('snapshot');
      expect(String(diagnosticsResponse.body.store?.graphDbWritePath || '')).toBe('snapshot');
      expect(String(diagnosticsResponse.body.store?.connector?.healthStatus || '')).toBe('ready');
      expect(String(diagnosticsResponse.body.store?.connector?.circuitState || '')).toBe('closed');
      expect(Number(diagnosticsResponse.body.store?.connector?.requestCount || 0)).toBeGreaterThanOrEqual(2);
      expect(String(diagnosticsResponse.body.store?.connector?.lastRequestId || '')).toContain('graphdb');

      expect(
        mockGraphDbServer.requests.some((item) => item.method === 'POST' && item.path === '/graphdb/snapshot')
      ).toBe(true);
      expect(
        mockGraphDbServer.requests.some((item) => item.method === 'GET' && item.path === '/graphdb/snapshot')
      ).toBe(true);
    } finally {
      if (booted) {
        await booted.cleanup();
      }
      await mockGraphDbServer.close();
    }
  });

  test('graphdb file adapter with ops_preferred exposes ops-capable diagnostics paths', async () => {
    const booted = await bootIntegrationServer({
      NOTE_CONNECTION_KNOWLEDGE_STORE_BACKEND: 'graphdb',
      NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_ADAPTER_PROVIDER: 'file',
      NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_ADAPTER_ID: 'integration-file-graphdb',
      NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_FALLBACK_ENABLED: 'false',
      NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_OPERATION_MODE: 'ops_preferred',
    });

    try {
      const ingestResponse = await requestJson(booted.port, 'POST', '/api/knowledge/ingest', {
        incremental: true,
        documents: [
          {
            documentId: 'graphdb_file_ops_seed_1',
            sourcePath: 'Knowledge_Base/graphdb/file_ops_seed.md',
            language: 'en',
            content: '# GraphDB File Ops Seed\n\nseed document for graphdb file ops integration path.',
          },
        ],
      });
      expect(ingestResponse.status).toBe(200);
      expect(ingestResponse.body.success).toBe(true);

      const reloadResponse = await requestJson(booted.port, 'POST', '/api/knowledge/store/reload');
      expect(reloadResponse.status).toBe(200);
      expect(reloadResponse.body.success).toBe(true);
      expect(String(reloadResponse.body.configuredBackend || '')).toBe('graphdb');
      expect(String(reloadResponse.body.configuredGraphDbAdapterProvider || '')).toBe('file');
      expect(String(reloadResponse.body.configuredGraphDbAdapterId || '')).toBe('integration-file-graphdb');
      expect(String(reloadResponse.body.configuredGraphDbOperationMode || '')).toBe('ops_preferred');
      expect(reloadResponse.body.graphDbFallbackEnabled).toBe(false);
      expect(String(reloadResponse.body.store?.graphDbOperationMode || '')).toBe('ops_preferred');
      expect(String(reloadResponse.body.store?.graphDbAdapterCapabilityMode || '')).toBe('ops_capable');
      expect(String(reloadResponse.body.store?.graphDbReadPath || '')).toBe('ops');
      expect(String(reloadResponse.body.store?.graphDbWritePath || '')).toBe('ops');
      expect(Array.isArray(reloadResponse.body.store?.graphDbSupportedReadOperations)).toBe(true);
      expect(Array.isArray(reloadResponse.body.store?.graphDbSupportedWriteOperations)).toBe(true);
      expect(String(reloadResponse.body.store?.location || '')).toContain('knowledge_graph_store.graphdb.v1.json');
      expect(Number(reloadResponse.body.store?.graphDbLastSnapshotMetadata?.schemaVersion || 0)).toBe(1);

      const diagnosticsResponse = await requestJson(booted.port, 'GET', '/api/knowledge/store-diagnostics');
      expect(diagnosticsResponse.status).toBe(200);
      expect(diagnosticsResponse.body.success).toBe(true);
      expect(String(diagnosticsResponse.body.configuredBackend || '')).toBe('graphdb');
      expect(String(diagnosticsResponse.body.configuredGraphDbAdapterProvider || '')).toBe('file');
      expect(String(diagnosticsResponse.body.configuredGraphDbAdapterId || '')).toBe('integration-file-graphdb');
      expect(String(diagnosticsResponse.body.configuredGraphDbOperationMode || '')).toBe('ops_preferred');
      expect(String(diagnosticsResponse.body.store?.graphDbOperationMode || '')).toBe('ops_preferred');
      expect(String(diagnosticsResponse.body.store?.graphDbAdapterCapabilityMode || '')).toBe('ops_capable');
      expect(String(diagnosticsResponse.body.store?.graphDbReadPath || '')).toBe('ops');
      expect(String(diagnosticsResponse.body.store?.graphDbWritePath || '')).toBe('ops');
      expect(Array.isArray(diagnosticsResponse.body.store?.graphDbSupportedReadOperations)).toBe(true);
      expect(Array.isArray(diagnosticsResponse.body.store?.graphDbSupportedWriteOperations)).toBe(true);
      expect(Number(diagnosticsResponse.body.store?.graphDbLastSnapshotMetadata?.schemaVersion || 0)).toBe(1);
    } finally {
      await booted.cleanup();
    }
  });

  test('graphdb strict mode with external_http adapter and missing endpoint fails closed on store APIs', async () => {
    const booted = await bootIntegrationServer({
      NOTE_CONNECTION_KNOWLEDGE_STORE_BACKEND: 'graphdb',
      NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_ADAPTER_PROVIDER: 'external_http',
      NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_HTTP_ENDPOINT: '',
      NOTE_CONNECTION_KNOWLEDGE_GRAPHDB_FALLBACK_ENABLED: 'false',
    });

    try {
      const reloadResponse = await requestJson(booted.port, 'POST', '/api/knowledge/store/reload');
      expect(reloadResponse.status).toBe(500);
      expect(reloadResponse.body.success).toBe(false);
      expect(String(reloadResponse.body.errorCode || '')).toBe('internal_error');
      expect(String(reloadResponse.body.error || '')).toContain('graphdb_http_endpoint_missing');

      const diagnosticsResponse = await requestJson(booted.port, 'GET', '/api/knowledge/store-diagnostics');
      expect(diagnosticsResponse.status).toBe(500);
      expect(diagnosticsResponse.body.success).toBe(false);
      expect(String(diagnosticsResponse.body.error || '')).toContain('graphdb_http_endpoint_missing');
    } finally {
      await booted.cleanup();
    }
  });
});
