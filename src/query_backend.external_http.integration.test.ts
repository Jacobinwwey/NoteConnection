import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import type { Server } from 'http';

type JsonResponse = {
  status: number;
  body: any;
};

type ReferenceAnnServiceState = {
  syncRequestCount: number;
  selectRequestCount: number;
  syncedIndexSignature: string;
  syncedAtomCount: number;
  representationVersion: string;
  embeddingModelId: string;
  embeddingDimension: number;
  tokenToAtomIds: Map<string, string[]>;
  signatureBuckets: Map<string, string[]>;
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

function requestJson(port: number, method: string, requestPath: string, body?: unknown): Promise<JsonResponse> {
  return new Promise((resolve, reject) => {
    const payload = typeof body === 'undefined' ? null : Buffer.from(JSON.stringify(body), 'utf8');
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: requestPath,
        method,
        headers: payload
          ? {
              'Content-Type': 'application/json',
              'Content-Length': String(payload.length),
            }
          : undefined,
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

function readJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function normalizeArrayMapEntries(rawValue: unknown): Map<string, string[]> {
  const normalized = new Map<string, string[]>();
  if (!Array.isArray(rawValue)) {
    return normalized;
  }
  rawValue.forEach((entry) => {
    if (!Array.isArray(entry) || entry.length < 2) {
      return;
    }
    const key = String(entry[0] || '').trim().toLowerCase();
    if (!key) {
      return;
    }
    const values = Array.isArray(entry[1])
      ? entry[1].map((item: unknown) => String(item || '').trim()).filter(Boolean)
      : [];
    normalized.set(key, values);
  });
  return normalized;
}

async function shutdownServerInstance(instance: Server | null | undefined): Promise<void> {
  if (!instance) {
    return;
  }
  if (typeof (instance as any).closeAllConnections === 'function') {
    (instance as any).closeAllConnections();
  }
  await new Promise<void>((resolve, reject) => {
    instance.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

async function startReferenceAnnService(
  port: number,
  state: ReferenceAnnServiceState
): Promise<Server> {
  const server = http.createServer(async (req, res) => {
    const method = String(req.method || 'GET').toUpperCase();
    const requestPath = String(req.url || '').split('?')[0];
    const requestId = String(req.headers['x-request-id'] || '').trim() || 'reference-ann-service';
    res.setHeader('x-request-id', requestId);

    if (method === 'POST' && requestPath === '/sync-index') {
      const payload = await readJsonBody(req);
      state.syncRequestCount += 1;
      state.syncedIndexSignature = String(payload.indexSignature || '').trim();
      state.syncedAtomCount = Math.max(0, Math.floor(Number(payload.atomCount || 0)));
      state.representationVersion = String(payload.representationVersion || '').trim();
      state.embeddingModelId = String(payload.embeddingModelId || '').trim();
      state.embeddingDimension = Math.max(0, Math.floor(Number(payload.embeddingDimension || 0)));
      state.tokenToAtomIds = normalizeArrayMapEntries(payload.tokenToAtomIds);
      state.signatureBuckets = normalizeArrayMapEntries(payload.signatureBuckets);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          synced: true,
          atomCount: state.syncedAtomCount,
          indexSignature: state.syncedIndexSignature,
          representationVersion: state.representationVersion,
          embeddingModelId: state.embeddingModelId,
          embeddingDimension: state.embeddingDimension,
          representationStatus: 'aligned',
        })
      );
      return;
    }

    if (method === 'POST' && requestPath === '/select-candidates') {
      const payload = await readJsonBody(req);
      state.selectRequestCount += 1;
      if (!state.syncedIndexSignature) {
        res.writeHead(409, {
          'Content-Type': 'application/json',
          'x-error-code': 'index_not_synced',
        });
        res.end(JSON.stringify({ error: 'index_not_synced' }));
        return;
      }

      const queryTokens = Array.isArray(payload.queryTokens)
        ? payload.queryTokens.map((item: unknown) => String(item || '').trim().toLowerCase()).filter(Boolean)
        : [];
      const topK = Math.max(1, Math.floor(Number(payload.topK || 1)));
      const targetCandidateCount = Math.max(64, topK * 32);
      const candidateAtomIds = new Set<string>();

      queryTokens.forEach((token: string) => {
        const postingList = state.tokenToAtomIds.get(token) || [];
        postingList.forEach((atomId: string) => {
          if (candidateAtomIds.size >= targetCandidateCount) {
            return;
          }
          candidateAtomIds.add(atomId);
        });
      });

      const used = candidateAtomIds.size > 0;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          used,
          mode: used ? 'token_prefilter' : 'full_scan',
          candidateAtomIds: used ? Array.from(candidateAtomIds) : [],
          representationVersion: state.representationVersion,
          embeddingModelId: state.embeddingModelId,
          embeddingDimension: state.embeddingDimension,
          indexSignature: state.syncedIndexSignature,
          representationStatus: 'aligned',
        })
      );
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      resolve();
    });
  });

  return server;
}

describe('external_http vector acceleration server integration', () => {
  let temp: TempDir;
  let envRestorers: Array<() => void>;
  let server: Server;
  let annService: Server;
  let port: number;
  let connectorPort: number;
  let kbRoot: string;
  let originalArgv: string[];
  const annState: ReferenceAnnServiceState = {
    syncRequestCount: 0,
    selectRequestCount: 0,
    syncedIndexSignature: '',
    syncedAtomCount: 0,
    representationVersion: '',
    embeddingModelId: '',
    embeddingDimension: 0,
    tokenToAtomIds: new Map<string, string[]>(),
    signatureBuckets: new Map<string, string[]>(),
  };

  function loadFreshServerModule(): {
    startServer: (options?: { port?: number; targetPath?: string }) => Promise<Server>;
  } {
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

    return require('./server') as {
      startServer: (options?: { port?: number; targetPath?: string }) => Promise<Server>;
    };
  }

  beforeAll(async () => {
    temp = new TempDir('noteconnection-external-ann');
    const projectRoot = temp.mkdir('project');
    temp.mkdir(path.join('project', 'dist', 'src', 'frontend'));
    temp.mkdir(path.join('project', 'runtime_data'));
    kbRoot = temp.mkdir(path.join('project', 'Knowledge_Base'));
    temp.file(
      path.join('project', 'config', 'app_config.toml'),
      [
        `knowledge_base_path = "${kbRoot.replace(/\\/g, '\\\\')}"`,
        'user_language = "en"',
        '',
        '[notemd]',
        'developer_mode = true',
        'language = "en"',
      ].join('\n')
    );

    connectorPort = await getFreePort();
    port = await getFreePort();
    annService = await startReferenceAnnService(connectorPort, annState);

    envRestorers = [];
    envRestorers.push(setEnv('NOTE_CONNECTION_PROJECT_ROOT', projectRoot));
    envRestorers.push(setEnv('NOTE_CONNECTION_FRONTEND_DIR', path.join(projectRoot, 'dist', 'src', 'frontend')));
    envRestorers.push(setEnv('NOTE_CONNECTION_RUNTIME_DATA_DIR', path.join(projectRoot, 'runtime_data')));
    envRestorers.push(setEnv('NOTE_CONNECTION_KB_ROOT', kbRoot));
    envRestorers.push(setEnv('NOTE_CONNECTION_CONFIG_PATH', path.join(projectRoot, 'config', 'app_config.toml')));
    envRestorers.push(setEnv('NOTE_CONNECTION_QUERY_BACKEND', 'local_vector'));
    envRestorers.push(setEnv('NOTE_CONNECTION_QUERY_VECTOR_ANN_PREFILTER', 'true'));
    envRestorers.push(setEnv('NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_PROVIDER', 'external_http'));
    envRestorers.push(setEnv('NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_HTTP_ENDPOINT', `http://127.0.0.1:${connectorPort}`));
    envRestorers.push(setEnv('NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_FAILURE_MODE', 'fail_closed'));
    envRestorers.push(setEnv('NOTE_CONNECTION_QUERY_VECTOR_ACCELERATION_REPRESENTATION_STRICT', 'true'));

    originalArgv = [...process.argv];
    const serverModule = loadFreshServerModule();
    server = await serverModule.startServer({ port });
  });

  afterAll(async () => {
    await shutdownServerInstance(server);
    await shutdownServerInstance(annService);
    envRestorers.reverse().forEach((restore) => restore());
    process.argv = originalArgv;
    jest.dontMock('./index');
    jest.dontMock('./core/PathBridge');
    jest.dontMock('./reader_renderer');
    temp.cleanup();
  });

  test('local_vector runtime can sync a remote external_http ANN index and use it for live queries', async () => {
    const documents = Array.from({ length: 140 }, (_value, index) => ({
      documentId: `doc_external_ann_${index}`,
      sourcePath: path.join(kbRoot, `external_ann_${index}.md`),
      language: 'en',
      content: [
        `# Retrieval Topic ${index}`,
        '',
        `retrieval mastery diagnostics semantic transfer loop ${index}`,
        index % 2 === 0 ? 'focus branch retrieval diagnostics depth' : 'mastery branch retrieval similarity depth',
      ].join('\n'),
    }));

    const ingestResponse = await requestJson(port, 'POST', '/api/knowledge/ingest', {
      incremental: true,
      documents,
    });
    expect(ingestResponse.status).toBe(200);
    expect(ingestResponse.body.success).toBe(true);

    const queryResponse = await requestJson(port, 'POST', '/api/knowledge/query', {
      query: 'retrieval mastery diagnostics semantic transfer',
      topK: 5,
    });
    expect(queryResponse.status).toBe(200);
    expect(queryResponse.body.success).toBe(true);
    expect(Array.isArray(queryResponse.body.result.items)).toBe(true);
    expect(queryResponse.body.result.items.length).toBeGreaterThan(0);

    const diagnosticsResponse = await requestJson(port, 'GET', '/api/knowledge/query-backend-diagnostics');
    expect(diagnosticsResponse.status).toBe(200);
    expect(diagnosticsResponse.body.success).toBe(true);
    const diagnostics = diagnosticsResponse.body.queryBackendDiagnostics;
    expect(diagnostics.configuredBackend).toBe('local_vector');
    expect(diagnostics.runtime.backendId).toBe('local-vector-v1');
    expect(diagnostics.runtime.vectorIndex.acceleration.mode).toBe('ann_prefilter');
    expect(diagnostics.runtime.vectorIndex.acceleration.lastSelectionMode).toBe('token_prefilter');
    expect(diagnostics.runtime.vectorIndex.acceleration.adapterId).toBe('external-http-vector-acceleration-v1');
    expect(diagnostics.runtime.vectorIndex.acceleration.healthStatus).toBe('ready');
    expect(diagnostics.runtime.vectorIndex.acceleration.indexSyncStatus).toBe('ready');
    expect(Number(diagnostics.runtime.vectorIndex.acceleration.syncRequestCount || 0)).toBeGreaterThanOrEqual(1);
    expect(Number(diagnostics.runtime.vectorIndex.acceleration.syncSuccessCount || 0)).toBeGreaterThanOrEqual(1);
    expect(Number(diagnostics.runtime.vectorIndex.acceleration.requestCount || 0)).toBeGreaterThanOrEqual(1);
    expect(String(diagnostics.runtime.vectorIndex.acceleration.syncedIndexSignature || '')).not.toBe('');
    expect(Number(diagnostics.runtime.vectorIndex.acceleration.syncedAtomCount || 0)).toBeGreaterThanOrEqual(140);
    expect(diagnostics.runtime.vectorIndex.acceleration.representationStatus).toBe('aligned');
    expect(String(diagnostics.runtime.vectorIndex.acceleration.lastRequestId || '')).toContain('nc-vector-accel-');

    expect(annState.syncRequestCount).toBeGreaterThanOrEqual(1);
    expect(annState.selectRequestCount).toBeGreaterThanOrEqual(1);
    expect(annState.syncedAtomCount).toBeGreaterThanOrEqual(140);
    expect(annState.syncedIndexSignature).toBe(String(diagnostics.runtime.vectorIndex.acceleration.syncedIndexSignature));
    expect(annState.tokenToAtomIds.size).toBeGreaterThan(0);
  });
});
