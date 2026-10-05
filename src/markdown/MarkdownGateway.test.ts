import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { MarkdownGateway } from './MarkdownGateway';
const { resolveHostMarkdownWorkerBinaryName } = require('../../scripts/tauri-sidecar-utils');

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

type TestContext = {
  temp: TempDir;
  projectRoot: string;
  kbRoot: string;
  gateway: MarkdownGateway;
};

function createGateway(kbRoot: string, projectRoot: string): MarkdownGateway {
  const kbRootNormalized = path.resolve(kbRoot);
  return new MarkdownGateway({
    projectRoot,
    getKnowledgeBaseRoot: () => kbRootNormalized,
    resolveMarkdownPath: async (rawPath: string) => {
      const candidate = path.isAbsolute(rawPath)
        ? path.resolve(rawPath)
        : path.resolve(kbRootNormalized, rawPath);
      const relative = path.relative(kbRootNormalized, candidate);
      if (!relative || relative === '.') {
        throw new Error('Expected a markdown file path, got knowledge base root.');
      }
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error('Access denied.');
      }
      const stat = await fs.promises.stat(candidate).catch(() => null);
      if (!stat || !stat.isFile()) {
        throw new Error('Markdown file not found.');
      }
      return candidate;
    },
  });
}

describe('MarkdownGateway', () => {
  let ctx: TestContext;

  beforeEach(() => {
    const temp = new TempDir('noteconnection-markdown-gateway');
    const projectRoot = temp.mkdir('project');
    const kbRoot = temp.mkdir(path.join('project', 'Knowledge_Base'));
    const gateway = createGateway(kbRoot, projectRoot);
    ctx = { temp, projectRoot, kbRoot, gateway };
  });

  afterEach(() => {
    ctx.temp.cleanup();
  });

  test('buildIndex + getChunk returns stable protocol fields in legacy mode', async () => {
    const filePath = ctx.temp.file(
      path.join('project', 'Knowledge_Base', 'topic.md'),
      [
        '# Graph Theory',
        '',
        'Graphs connect nodes and edges.',
        '',
        'Visit [[other-topic|Related Topic]].',
      ].join('\n')
    );

    const index = await ctx.gateway.buildIndex(
      { filePath },
      {
        markdownEngine: 'legacy',
        chunkBlockSize: 4,
        prefetchBlocks: 4,
        indexCacheTtlSec: 1800,
        maxDocBytes: 32 * 1024 * 1024,
      }
    );

    expect(index.filePath).toBe(filePath);
    expect(index.engine).toBe('legacy');
    expect(index.blocksSummary.totalBlocks).toBeGreaterThan(0);
    expect(index.anchorsSummary.count).toBeGreaterThan(0);
    expect(index.wikiLinksSummary.count).toBeGreaterThan(0);

    const chunk = await ctx.gateway.getChunk({
      indexId: index.indexId,
      startBlock: 0,
      blockCount: 4,
    });
    expect(chunk.markdownProtocolVersion).toBe('1.0.0');
    expect(Array.isArray(chunk.blocks)).toBe(true);
    expect(chunk.blocks.length).toBeGreaterThan(0);
    expect(typeof chunk.blocks[0].text).toBe('string');
  });

  test('resolveWiki applies exact > alias > heading > fallback strategy', async () => {
    const currentPath = ctx.temp.file(
      path.join('project', 'Knowledge_Base', 'current.md'),
      [
        '# Current',
        '',
        'This points to [[ExactDoc|AliasDoc]].',
        '',
        '## Local Anchor',
      ].join('\n')
    );
    const exactPath = ctx.temp.file(
      path.join('project', 'Knowledge_Base', 'ExactDoc.md'),
      '# Exact Doc\n\nBody'
    );
    const fallbackPath = ctx.temp.file(
      path.join('project', 'Knowledge_Base', 'rough-topic.md'),
      '# Rough Topic'
    );

    const runtime = {
      markdownEngine: 'legacy' as const,
      chunkBlockSize: 8,
      prefetchBlocks: 2,
      indexCacheTtlSec: 1800,
      maxDocBytes: 32 * 1024 * 1024,
    };

    await ctx.gateway.buildIndex({ filePath: currentPath }, runtime);

    const exact = await ctx.gateway.resolveWiki(
      {
        wikiTarget: '[[ExactDoc]]',
        currentFilePath: currentPath,
      },
      runtime
    );
    expect(exact.matchType).toBe('exact');
    expect(exact.filePath).toBe(exactPath);

    const alias = await ctx.gateway.resolveWiki(
      {
        wikiTarget: '[[AliasDoc]]',
        currentFilePath: currentPath,
      },
      runtime
    );
    expect(alias.matchType).toBe('alias');
    expect(alias.filePath).toBe(exactPath);

    const heading = await ctx.gateway.resolveWiki(
      {
        wikiTarget: '[[#Local Anchor]]',
        currentFilePath: currentPath,
      },
      runtime
    );
    expect(heading.matchType).toBe('heading');
    expect(heading.filePath).toBe(currentPath);
    expect(heading.anchorId).toBe('local-anchor');

    const fallback = await ctx.gateway.resolveWiki(
      {
        wikiTarget: '[[rough]]',
        currentFilePath: currentPath,
      },
      runtime
    );
    expect(fallback.matchType).toBe('fallback');
    expect(fallback.filePath).toBe(fallbackPath);
    expect(Array.isArray(fallback.candidates)).toBe(true);
    expect(fallback.candidates && fallback.candidates.length).toBeGreaterThan(0);
  });

  test('pulldown mode automatically degrades to legacy when worker is unavailable', async () => {
    const restoreWorkerPath = process.env.NOTE_CONNECTION_MARKDOWN_WORKER_PATH;
    process.env.NOTE_CONNECTION_MARKDOWN_WORKER_PATH = path.join(ctx.projectRoot, 'bin', 'missing-worker');
    try {
      const filePath = ctx.temp.file(
        path.join('project', 'Knowledge_Base', 'fallback.md'),
        '# Worker fallback\n\ncontent'
      );
      const index = await ctx.gateway.buildIndex(
        { filePath, forceRebuild: true },
        {
          markdownEngine: 'pulldown',
          chunkBlockSize: 8,
          prefetchBlocks: 2,
          indexCacheTtlSec: 1800,
          maxDocBytes: 32 * 1024 * 1024,
        }
      );
      expect(index.engine).toBe('legacy');
      expect(String(index.fallbackReason || '').length).toBeGreaterThan(0);
    } finally {
      if (typeof restoreWorkerPath === 'undefined') {
        delete process.env.NOTE_CONNECTION_MARKDOWN_WORKER_PATH;
      } else {
        process.env.NOTE_CONNECTION_MARKDOWN_WORKER_PATH = restoreWorkerPath;
      }
    }
  });

  const testUnix = process.platform === 'win32' ? test.skip : test;
  testUnix.each(['beside-server', 'Resources', 'explicit-override', 'build-filename'])(
    'buildIndex discovers the %s worker and preserves lookup priority', async (location) => {
      const installedDirectory = ctx.temp.mkdir('installed/bin');
      const originalExecPath = process.execPath;
      const originalWorkerPath = process.env.NOTE_CONNECTION_MARKDOWN_WORKER_PATH;
      const writeWorker = (workerPath: string, anchorId: string) => {
        fs.mkdirSync(path.dirname(workerPath), { recursive: true });
        fs.writeFileSync(workerPath, `#!/usr/bin/env node
const fs = require('fs');
let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const request = JSON.parse(input);
  if (request.kind !== 'build_index') process.exit(1);
  const content = fs.readFileSync(request.filePath);
  const block = { id: 0, type: 'heading', startByte: 0, endByte: content.length, startLine: 1, endLine: 1, anchorId: ${JSON.stringify(anchorId)} };
  process.stdout.write(JSON.stringify({ ok: true, index: { totalBytes: content.length, totalLines: 1, blocks: [block], anchors: [], wikiLinks: [] } }));
});
`, { mode: 0o755 });
      };
      try {
        process.execPath = path.join(installedDirectory, 'server');
        delete process.env.NOTE_CONNECTION_MARKDOWN_WORKER_PATH;
        const installedWorker = location === 'Resources'
          ? path.join(installedDirectory, '..', 'Resources', 'markdown-worker')
          : path.join(installedDirectory, 'markdown-worker');
        writeWorker(installedWorker, 'installed-worker');
        if (location === 'explicit-override' || location === 'build-filename') {
          writeWorker(path.join(ctx.projectRoot, 'src-tauri', 'bin', resolveHostMarkdownWorkerBinaryName()), 'build-worker');
        }
        if (location === 'explicit-override') {
          const explicitWorker = path.join(ctx.temp.path, 'explicit-worker');
          writeWorker(explicitWorker, 'explicit-worker');
          process.env.NOTE_CONNECTION_MARKDOWN_WORKER_PATH = explicitWorker;
        }
        const filePath = ctx.temp.file(path.join('project', 'Knowledge_Base', 'installed.md'), '# Installed markdown worker');
        const index = await ctx.gateway.buildIndex({ filePath }, {
          markdownEngine: 'pulldown',
          chunkBlockSize: 8,
          prefetchBlocks: 2,
          indexCacheTtlSec: 1800,
          maxDocBytes: 32 * 1024 * 1024,
        });
        expect(index.engine).toBe('pulldown');
        expect(index.fallbackReason).toBeUndefined();
        const chunk = await ctx.gateway.getChunk({ indexId: index.indexId, startBlock: 0, blockCount: 1 });
        const expectedAnchor = location === 'explicit-override' ? 'explicit-worker'
          : location === 'build-filename' ? 'build-worker' : 'installed-worker';
        expect(chunk.blocks[0].anchorId).toBe(expectedAnchor);
      } finally {
        process.execPath = originalExecPath;
        if (originalWorkerPath === undefined) delete process.env.NOTE_CONNECTION_MARKDOWN_WORKER_PATH;
        else process.env.NOTE_CONNECTION_MARKDOWN_WORKER_PATH = originalWorkerPath;
      }
    }
  );
});
