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
});
