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

describe('NoteMD API + CLI wrappers', () => {
  let temp: TempDir;
  let envRestorers: Array<() => void>;
  let server: Server;
  let port: number;
  let kbFilePath: string;
  let originalArgv: string[];
  let mockServiceState: {
    oneClickExtract: jest.Mock;
    batchFixMermaid: jest.Mock;
  };

  beforeAll(async () => {
    temp = new TempDir('noteconnection-notemd-cli-api');
    const projectRoot = temp.mkdir('project');
    temp.mkdir(path.join('project', 'dist', 'src', 'frontend'));
    temp.mkdir(path.join('project', 'runtime_data'));
    temp.mkdir(path.join('project', 'Knowledge_Base'));
    kbFilePath = temp.file(
      path.join('project', 'Knowledge_Base', 'science', 'topic.md'),
      '# Topic\n\nSource text'
    );
    const appConfigPath = temp.file(
      path.join('project', 'config', 'app_config.toml'),
      [
        `knowledge_base_path = "${path.join(projectRoot, 'Knowledge_Base').replace(/\\/g, '\\\\')}"`,
        'user_language = "en"',
        '',
        '[notemd]',
        'developer_mode = false',
        'language = "en"',
        'chunk_word_count = 1111',
        'max_tokens = 2222',
        'auto_mermaid_fix_after_generate = true',
        '',
        '[notemd.api]',
        'provider = "OpenAI"',
        'base_url = "https://api.openai.com/v1"',
        'model = "gpt-4o-mini"',
        'api_key = "cli-api-key"',
        'api_version = ""',
        'temperature = 0.3',
        '',
      ].join('\n')
    );

    envRestorers = [];
    envRestorers.push(setEnv('NOTE_CONNECTION_PROJECT_ROOT', projectRoot));
    envRestorers.push(setEnv('NOTE_CONNECTION_FRONTEND_DIR', path.join(projectRoot, 'dist', 'src', 'frontend')));
    envRestorers.push(setEnv('NOTE_CONNECTION_RUNTIME_DATA_DIR', path.join(projectRoot, 'runtime_data')));
    envRestorers.push(setEnv('NOTE_CONNECTION_KB_ROOT', path.join(projectRoot, 'Knowledge_Base')));
    envRestorers.push(setEnv('NOTE_CONNECTION_CONFIG_PATH', appConfigPath));
    envRestorers.push(setEnv('NOTE_CONNECTION_AUTH_TOKEN', undefined));
    envRestorers.push(setEnv('npm_config_path', undefined));
    envRestorers.push(setEnv('npm_config_gpu', undefined));
    envRestorers.push(setEnv('npm_config_workers', undefined));
    envRestorers.push(setEnv('npm_config_static', undefined));

    port = await getFreePort();
    mockServiceState = {
      oneClickExtract: jest.fn(async (filePath: string) => ({
        sourceFilePath: filePath,
        outputFolderPath: path.join(projectRoot, 'Knowledge_Base', 'topic'),
        concepts: ['Graph Theory', 'Node'],
        generated: {
          totalFiles: 2,
          generatedFiles: 2,
          failedFiles: 0,
          outputs: [
            path.join(projectRoot, 'Knowledge_Base', 'topic', 'Graph Theory.md'),
            path.join(projectRoot, 'Knowledge_Base', 'topic', 'Node.md'),
          ],
        },
        mermaid: {
          folderPath: path.join(projectRoot, 'Knowledge_Base', 'topic'),
          totalFiles: 2,
          fixedFiles: 2,
          results: [],
        },
      })),
      batchFixMermaid: jest.fn(async (folderPath: string) => ({
        folderPath,
        totalFiles: 1,
        fixedFiles: 1,
        results: [],
      })),
    };

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
    jest.doMock('./notemd', () => {
      const actual = jest.requireActual('./notemd');
      class MockNotemdService {
        public processFile = jest.fn();
        public processFolder = jest.fn();
        public translateFile = jest.fn();
        public translateFolder = jest.fn();
        public generateContent = jest.fn();
        public generateFolderContent = jest.fn();
        public fixMermaid = jest.fn();
        public fixFormulas = jest.fn();
        public checkDuplicates = jest.fn();
        public extractConcepts = jest.fn();
        public oneClickExtract = mockServiceState.oneClickExtract;
        public batchFixMermaid = mockServiceState.batchFixMermaid;
      }
      return {
        ...actual,
        NotemdService: MockNotemdService,
      };
    });

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
    jest.dontMock('./notemd');
    temp.cleanup();
  });

  test('POST /api/notemd/one-click-extract delegates to the shared NoteMD service', async () => {
    const response = await requestJson(port, 'POST', '/api/notemd/one-click-extract', {
      filePath: kbFilePath,
      operationId: 'workflow-1',
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.result.outputFolderPath).toContain(path.join('Knowledge_Base', 'topic'));
    expect(mockServiceState.oneClickExtract).toHaveBeenCalledTimes(1);
  });

  test('CLI wrapper exposes settings show and one-click extract commands', async () => {
    const serverModule = require('./server') as any;

    const settingsResult = await serverModule.executeNotemdCliCommand(['settings', 'show']);
    expect(settingsResult.settings.activeProvider).toBe('OpenAI');
    expect(settingsResult.settings.chunkWordCount).toBe(1111);

    const extractResult = await serverModule.executeNotemdCliCommand([
      'one-click-extract',
      '--file',
      kbFilePath,
    ]);
    expect(extractResult.result.outputFolderPath).toContain(path.join('Knowledge_Base', 'topic'));
    expect(mockServiceState.oneClickExtract).toHaveBeenCalledTimes(2);
  });
});
