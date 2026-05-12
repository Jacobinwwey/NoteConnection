import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import type { Server } from 'http';

type JsonResponse = {
  status: number;
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

describe('NoteMD server integration', () => {
  let temp: TempDir;
  let envRestorers: Array<() => void>;
  let server: Server;
  let port: number;
  let kbFilePath: string;
  let runtimeDataDir: string;
  let appConfigPath: string;
  let originalArgv: string[];

  beforeAll(async () => {
    temp = new TempDir('noteconnection-notemd');
    const projectRoot = temp.mkdir('project');
    temp.mkdir(path.join('project', 'dist', 'src', 'frontend'));
    runtimeDataDir = temp.mkdir(path.join('project', 'runtime_data'));
    temp.mkdir(path.join('project', 'Knowledge_Base'));
    kbFilePath = temp.file(
      path.join('project', 'Knowledge_Base', 'science', 'topic.md'),
      '# Graph Theory\n\nGraph theory studies nodes and edges.\n\n$\nE = mc^2\n$'
    );
    appConfigPath = temp.file(
      path.join('project', 'config', 'app_config.toml'),
      [
        `knowledge_base_path = "${path.join(projectRoot, 'Knowledge_Base').replace(/\\/g, '\\\\')}"`,
        'user_language = "en"',
        '',
        '[notemd]',
        'developer_mode = true',
        'language = "en"',
        'chunk_word_count = 1234',
        'max_tokens = 2048',
        'auto_mermaid_fix_after_generate = true',
        '',
        '[notemd.api]',
        'provider = "OpenAI"',
        'base_url = "https://api.openai.com/v1"',
        'model = "gpt-4o-mini"',
        'api_key = "toml-openai-key"',
        'api_version = ""',
        'temperature = 0.25',
        '',
      ].join('\n')
    );

    envRestorers = [];
    envRestorers.push(setEnv('NOTE_CONNECTION_PROJECT_ROOT', projectRoot));
    envRestorers.push(setEnv('NOTE_CONNECTION_FRONTEND_DIR', path.join(projectRoot, 'dist', 'src', 'frontend')));
    envRestorers.push(setEnv('NOTE_CONNECTION_RUNTIME_DATA_DIR', runtimeDataDir));
    envRestorers.push(setEnv('NOTE_CONNECTION_KB_ROOT', path.join(projectRoot, 'Knowledge_Base')));
    envRestorers.push(setEnv('NOTE_CONNECTION_CONFIG_PATH', appConfigPath));
    envRestorers.push(setEnv('NOTE_CONNECTION_CONFIG_DIR', undefined));
    envRestorers.push(setEnv('NOTE_CONNECTION_AUTH_TOKEN', undefined));
    envRestorers.push(setEnv('npm_config_path', undefined));
    envRestorers.push(setEnv('npm_config_gpu', undefined));
    envRestorers.push(setEnv('npm_config_workers', undefined));
    envRestorers.push(setEnv('npm_config_static', undefined));

    port = await getFreePort();

    jest.resetModules();
    originalArgv = [...process.argv];
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
    process.argv = originalArgv;
    jest.dontMock('./index');
    jest.dontMock('./core/PathBridge');
    jest.dontMock('./reader_renderer');
    temp.cleanup();
  });

  test('GET/PUT settings roundtrip works', async () => {
    const readResponse = await requestJson(port, 'GET', '/api/notemd/settings');
    expect(readResponse.status).toBe(200);
    expect(readResponse.body.success).toBe(true);
    expect(Array.isArray(readResponse.body.settings.providers)).toBe(true);
    expect(readResponse.body.settings.activeProvider).toBe('OpenAI');
    const openAiProvider = readResponse.body.settings.providers.find((provider: any) => provider.name === 'OpenAI');
    expect(openAiProvider?.apiKey).toBe('toml-openai-key');
    expect(openAiProvider?.baseUrl).toBe('https://api.openai.com/v1');
    expect(readResponse.body.settings.chunkWordCount).toBe(1234);
    expect(readResponse.body.settings.autoMermaidFixAfterGenerate).toBe(true);

    const nextSettings = {
      ...readResponse.body.settings,
      maxRetries: 0,
      retryDelayMs: 0,
      activeProvider: 'DeepSeek',
      providers: readResponse.body.settings.providers.map((provider: any) =>
        provider.name === 'DeepSeek'
          ? { ...provider, baseUrl: 'http://127.0.0.1:9/v1', apiKey: 'x' }
          : provider
      ),
    };

    const writeResponse = await requestJson(port, 'PUT', '/api/notemd/settings', nextSettings);
    expect(writeResponse.status).toBe(200);
    expect(writeResponse.body.success).toBe(true);
    expect(writeResponse.body.settings.maxRetries).toBe(0);

    const appConfigContent = fs.readFileSync(appConfigPath, 'utf8');
    expect(appConfigContent).toContain('[notemd]');
    expect(appConfigContent).toContain('[notemd.api]');
    expect(appConfigContent).toContain('provider = "DeepSeek"');
    expect(appConfigContent).toContain('api_key = "x"');
  });

  test('GET/PUT path-mode settings roundtrip works', async () => {
    const readResponse = await requestJson(port, 'GET', '/api/path-mode/settings');
    expect(readResponse.status).toBe(200);
    expect(readResponse.body.success).toBe(true);
    expect(readResponse.body.settings).toEqual(
      expect.objectContaining({
        auto_reconstruct: true,
        reading_mode: 'window',
      })
    );

    const writeResponse = await requestJson(port, 'PUT', '/api/path-mode/settings', {
      auto_reconstruct: false,
      retain_history: false,
      focus_mode: false,
      reading_mode: 'fullscreen',
      reader_render_mode: 'source',
      reader_media_scale: 1.75,
      node_spacing: 300,
    });
    expect(writeResponse.status).toBe(200);
    expect(writeResponse.body.success).toBe(true);
    expect(writeResponse.body.settings.reading_mode).toBe('fullscreen');
    expect(writeResponse.body.settings.reader_render_mode).toBe('source');

    const appConfigContent = fs.readFileSync(appConfigPath, 'utf8');
    expect(appConfigContent).toContain('[path_mode]');
    expect(appConfigContent).toContain('auto_reconstruct = false');
    expect(appConfigContent).toContain('reader_render_mode = "source"');
  });

  test('GET/PUT frontend settings roundtrip works', async () => {
    const readResponse = await requestJson(port, 'GET', '/api/frontend/settings');
    expect(readResponse.status).toBe(200);
    expect(readResponse.body.success).toBe(true);
    expect(readResponse.body.settings).toEqual(
      expect.objectContaining({
        physics: expect.any(Object),
        visuals: expect.any(Object),
        performance: expect.any(Object),
        reading: expect.any(Object),
      })
    );
    expect(readResponse.body.settings.visuals.degreeMode).toBe('visible');

    const writeResponse = await requestJson(port, 'PUT', '/api/frontend/settings', {
      physics: {
        repulsionForce: -640,
        repulsionDAG: -980,
        linkDistance: 360,
        collisionRadius: 38,
      },
      visuals: {
        edgeOpacity: 0.35,
        baseNodeSize: 7,
        degreeMode: 'total',
      },
      performance: {
        maxWorkers: 6,
        enableGPU: true,
        gpuRendering: false,
        memorySavingMode: true,
        compactMode: true,
        staticMode: false,
        deepDebug: true,
      },
      reading: {
        mode: 'fullscreen',
        markdownEngine: 'pulldown',
        chunkBlockSize: 48,
        prefetchBlocks: 10,
        indexCacheTtlSec: 2400,
        maxDocBytes: 150994944,
      },
    });
    expect(writeResponse.status).toBe(200);
    expect(writeResponse.body.success).toBe(true);
    expect(writeResponse.body.settings.visuals.degreeMode).toBe('total');
    expect(writeResponse.body.settings.performance.maxWorkers).toBe(6);
    expect(writeResponse.body.settings.reading.mode).toBe('fullscreen');
    expect(writeResponse.body.settings.reading.markdownEngine).toBe('pulldown');
    expect(writeResponse.body.settings.reading.chunkBlockSize).toBe(48);
    expect(writeResponse.body.settings.reading.prefetchBlocks).toBe(10);
    expect(writeResponse.body.settings.reading.indexCacheTtlSec).toBe(2400);
    expect(writeResponse.body.settings.reading.maxDocBytes).toBe(150994944);

    const verifyResponse = await requestJson(port, 'GET', '/api/frontend/settings');
    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.settings.visuals.degreeMode).toBe('total');
    expect(verifyResponse.body.settings.performance.maxWorkers).toBe(6);
    expect(verifyResponse.body.settings.reading.mode).toBe('fullscreen');
    expect(verifyResponse.body.settings.reading.markdownEngine).toBe('pulldown');

    const appConfigContent = fs.readFileSync(appConfigPath, 'utf8');
    expect(appConfigContent).toContain('[frontend_settings.physics]');
    expect(appConfigContent).toContain('[frontend_settings.visuals]');
    expect(appConfigContent).toContain('[frontend_settings.performance]');
    expect(appConfigContent).toContain('[frontend_settings.reading]');
    expect(appConfigContent).toContain('degree_mode = "total"');
    expect(appConfigContent).toContain('max_workers = 6');
    expect(appConfigContent).toContain('markdown_engine = "pulldown"');
    expect(appConfigContent).toContain('chunk_block_size = 48');
  });

  test('markdown protocol endpoints index/chunk/resolve-node/resolve-wiki work with fallback-safe payloads', async () => {
    const indexResponse = await requestJson(port, 'POST', '/api/markdown/index', {
      filePath: kbFilePath,
      forceRebuild: true,
    });
    expect(indexResponse.status).toBe(200);
    expect(indexResponse.body.success).toBe(true);
    expect(typeof indexResponse.body.indexId).toBe('string');
    expect(indexResponse.body.filePath).toBe(kbFilePath);
    expect(indexResponse.body.blocksSummary.totalBlocks).toBeGreaterThan(0);
    expect(indexResponse.body.markdownProtocolVersion).toBe('1.0.0');

    const chunkResponse = await requestJson(port, 'POST', '/api/markdown/chunk', {
      indexId: indexResponse.body.indexId,
      startBlock: 0,
      blockCount: 8,
    });
    expect(chunkResponse.status).toBe(200);
    expect(chunkResponse.body.success).toBe(true);
    expect(Array.isArray(chunkResponse.body.blocks)).toBe(true);
    expect(chunkResponse.body.blocks.length).toBeGreaterThan(0);
    expect(typeof chunkResponse.body.blocks[0].text).toBe('string');

    const resolveNodeResponse = await requestJson(port, 'POST', '/api/markdown/resolve-node', {
      nodeId: 'topic',
      currentFilePath: kbFilePath,
    });
    expect(resolveNodeResponse.status).toBe(200);
    expect(resolveNodeResponse.body.success).toBe(true);
    expect(resolveNodeResponse.body.filePath).toBe(kbFilePath);
    expect(typeof resolveNodeResponse.body.targetBlockId).toBe('number');

    const resolveWikiResponse = await requestJson(port, 'POST', '/api/markdown/resolve-wiki', {
      wikiTarget: '[[topic]]',
      currentFilePath: kbFilePath,
    });
    expect(resolveWikiResponse.status).toBe(200);
    expect(resolveWikiResponse.body.success).toBe(true);
    expect(resolveWikiResponse.body.filePath).toBe(kbFilePath);
    expect(['exact', 'alias', 'heading', 'fallback']).toContain(resolveWikiResponse.body.matchType);
  });

  test('GET/POST NoteMD workspace roundtrip works and persists to app_config.toml', async () => {
    const readResponse = await requestJson(port, 'GET', '/api/notemd/workspace');
    expect(readResponse.status).toBe(200);
    expect(readResponse.body.success).toBe(true);
    expect(readResponse.body.workspace).toEqual(
      expect.objectContaining({
        filePath: '',
        folderPath: '',
        outputFilePath: '',
        outputFolderPath: '',
      })
    );

    const nextWorkspace = {
      filePath: kbFilePath,
      folderPath: path.dirname(kbFilePath),
      outputFilePath: path.join(path.dirname(kbFilePath), 'topic_processed.md'),
      outputFolderPath: path.join(path.dirname(kbFilePath), 'topic'),
    };
    const writeResponse = await requestJson(port, 'POST', '/api/notemd/workspace', {
      workspace: nextWorkspace,
    });
    expect(writeResponse.status).toBe(200);
    expect(writeResponse.body.success).toBe(true);
    expect(writeResponse.body.workspace).toEqual(expect.objectContaining(nextWorkspace));

    const verifyResponse = await requestJson(port, 'GET', '/api/notemd/workspace');
    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.workspace).toEqual(expect.objectContaining(nextWorkspace));

    const appConfigContent = fs.readFileSync(appConfigPath, 'utf8');
    expect(appConfigContent).toContain('workspace_file_path =');
    expect(appConfigContent).toContain('workspace_folder_path =');
    expect(appConfigContent).toContain('workspace_output_file_path =');
    expect(appConfigContent).toContain('workspace_output_folder_path =');
  });

  test('process-file and fix-formulas endpoints execute on a real file', async () => {
    const processResponse = await requestJson(port, 'POST', '/api/notemd/process-file', {
      filePath: kbFilePath,
    });
    expect(processResponse.status).toBe(200);
    expect(processResponse.body.success).toBe(true);
    expect(processResponse.body.result.outputPath).toContain('_processed');

    const fixFormulaResponse = await requestJson(port, 'POST', '/api/notemd/fix-formulas', {
      filePath: kbFilePath,
      inPlace: true,
    });
    expect(fixFormulaResponse.status).toBe(200);
    expect(fixFormulaResponse.body.success).toBe(true);

    const fileContent = fs.readFileSync(kbFilePath, 'utf8');
    expect(fileContent).toContain('$$');

    const workspaceResponse = await requestJson(port, 'GET', '/api/notemd/workspace');
    expect(workspaceResponse.status).toBe(200);
    expect(workspaceResponse.body.workspace.filePath).toBe(kbFilePath);
    expect(workspaceResponse.body.workspace.folderPath).toBe(path.dirname(kbFilePath));
  });

  test('extract-concepts and duplicate endpoints return structured results', async () => {
    const conceptsResponse = await requestJson(port, 'POST', '/api/notemd/extract-concepts', {
      filePath: kbFilePath,
    });
    expect(conceptsResponse.status).toBe(200);
    expect(conceptsResponse.body.success).toBe(true);
    expect(Array.isArray(conceptsResponse.body.result.concepts)).toBe(true);

    const duplicatesResponse = await requestJson(port, 'POST', '/api/notemd/check-duplicates', {
      filePath: kbFilePath,
    });
    expect(duplicatesResponse.status).toBe(200);
    expect(duplicatesResponse.body.success).toBe(true);
    expect(Array.isArray(duplicatesResponse.body.result.duplicateTerms)).toBe(true);
  });

  test('settings are persisted to app_config.toml instead of runtime_data/notemd_config.json', () => {
    expect(fs.existsSync(appConfigPath)).toBe(true);
    expect(fs.existsSync(path.join(runtimeDataDir, 'notemd_config.json'))).toBe(false);
  });

  test('foundation readiness and backend sufficiency reflect embedded sqlite graph runtime after ingest', async () => {
    const ingestResponse = await requestJson(port, 'POST', '/api/knowledge/ingest', {
      incremental: true,
      documents: [
        {
          documentId: 'doc_foundation_runtime',
          sourcePath: path.join(path.dirname(kbFilePath), 'foundation_runtime.md'),
          language: 'en',
          content: '# Foundation Runtime\n\nEmbedded graph backend readiness should be measurable after ingest.',
        },
      ],
    });
    expect(ingestResponse.status).toBe(200);
    expect(ingestResponse.body.success).toBe(true);

    const readinessResponse = await requestJson(port, 'GET', '/api/knowledge/foundation/readiness');
    expect(readinessResponse.status).toBe(200);
    expect(readinessResponse.body.success).toBe(true);
    expect(readinessResponse.body.readiness).toEqual(
      expect.objectContaining({
        status: 'integrated',
        decision: 'go',
        ready: true,
      })
    );
    expect(readinessResponse.body.readiness.baseline).toEqual(
      expect.objectContaining({
        storeType: 'sqlite',
        graphBackendStatus: 'independent',
        graphBackendSignalKind: 'embedded_graphdb',
        graphBackendIndependent: true,
        queryBackendDefaultMode: 'local_hybrid',
        vectorAdapterStatus: 'independent',
        vectorAdapterSignalKind: 'embedding_ann',
      })
    );
    expect(readinessResponse.body.readiness.promotionCriteriaPassed).toBe(
      readinessResponse.body.readiness.promotionCriteriaTotal
    );

    const sufficiencyResponse = await requestJson(port, 'GET', '/api/knowledge/backend/sufficiency');
    expect(sufficiencyResponse.status).toBe(200);
    expect(sufficiencyResponse.body.success).toBe(true);
    expect(sufficiencyResponse.body.sufficiency).toEqual(
      expect.objectContaining({
        sufficient: true,
      })
    );
    expect(sufficiencyResponse.body.sufficiency.checks.knowledgeGraph).toEqual(
      expect.objectContaining({
        passed: true,
        reason: 'embedded_graphdb',
      })
    );
    expect(sufficiencyResponse.body.sufficiency.checks.queryBackend).toEqual(
      expect.objectContaining({
        passed: true,
      })
    );
    expect(sufficiencyResponse.body.sufficiency.checks.vectorIndex).toEqual(
      expect.objectContaining({
        passed: true,
        reason: 'embedding_ann',
      })
    );
  });
});
