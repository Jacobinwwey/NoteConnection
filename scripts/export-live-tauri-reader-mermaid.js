#!/usr/bin/env node

const fs = require('fs');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

const REPO_ROOT = path.resolve(__dirname, '..');

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'reader';
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`Failed to parse JSON from ${url}: ${error.message}\n${body.slice(0, 600)}`));
        }
      });
    });
    request.on('error', reject);
    request.setTimeout(10000, () => {
      request.destroy(new Error(`Timed out fetching ${url}`));
    });
  });
}

class CDPClient {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl;
    this.nextId = 0;
    this.pending = new Map();
    this.events = [];
    this.ws = null;
  }

  async connect() {
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(this.webSocketUrl, { perMessageDeflate: false });
      this.ws = ws;
      ws.on('open', resolve);
      ws.on('error', reject);
      ws.on('message', (payload) => {
        let message;
        try {
          message = JSON.parse(String(payload));
        } catch (_error) {
          return;
        }

        if (message.id) {
          const pending = this.pending.get(message.id);
          if (!pending) {
            return;
          }
          this.pending.delete(message.id);
          if (message.error) {
            pending.reject(new Error(`${message.error.message || 'CDP error'} (${message.error.code || 'unknown'})`));
            return;
          }
          pending.resolve(message.result || {});
          return;
        }

        if (message.method) {
          this.events.push(message);
        }
      });
      ws.on('close', () => {
        for (const pending of this.pending.values()) {
          pending.reject(new Error('CDP socket closed'));
        }
        this.pending.clear();
      });
    });
  }

  async send(method, params = {}) {
    const id = ++this.nextId;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(payload, (error) => {
        if (error) {
          this.pending.delete(id);
          reject(error);
        }
      });
    });
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

function parseArgs(argv) {
  const result = {
    host: '127.0.0.1',
    port: parsePositiveInt(process.env.NOTE_CONNECTION_WEBVIEW2_DEBUG_PORT, 1665),
    pageUrl: 'http://127.0.0.1:1605/',
    waitMs: 15000,
    minMermaidBlocks: 1,
    noteFile: '',
    nodeLabel: '',
    outputDir: path.join(REPO_ROOT, 'output', 'tauri-reader-mermaid'),
    session: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '').trim();
    if (token === '--host' && argv[index + 1]) {
      result.host = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (token === '--port' && argv[index + 1]) {
      result.port = parsePositiveInt(argv[index + 1], result.port);
      index += 1;
      continue;
    }
    if (token === '--page-url' && argv[index + 1]) {
      result.pageUrl = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (token === '--wait-ms' && argv[index + 1]) {
      result.waitMs = parsePositiveInt(argv[index + 1], result.waitMs);
      index += 1;
      continue;
    }
    if (token === '--min-mermaid-blocks' && argv[index + 1]) {
      result.minMermaidBlocks = parsePositiveInt(argv[index + 1], result.minMermaidBlocks);
      index += 1;
      continue;
    }
    if (token === '--note-file' && argv[index + 1]) {
      result.noteFile = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (token === '--node-label' && argv[index + 1]) {
      result.nodeLabel = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (token === '--session' && argv[index + 1]) {
      result.session = String(argv[index + 1]).trim();
      index += 1;
    }
  }

  if (!result.noteFile && !result.nodeLabel) {
    result.noteFile = path.join('Knowledge_Base', 'waterglass', 'Absorption.md');
  }
  if (!result.nodeLabel) {
    const labelFromFile = path.basename(result.noteFile || '', path.extname(result.noteFile || ''));
    result.nodeLabel = labelFromFile || 'Absorption';
  }
  if (!result.session) {
    result.session = `${slugify(result.nodeLabel)}-${Date.now()}`;
  }
  return result;
}

function pickTarget(targets, pageUrl) {
  const normalizedNeedle = String(pageUrl || '').trim();
  const pageTargets = Array.isArray(targets)
    ? targets.filter((target) => target && target.type === 'page')
    : [];

  for (const target of pageTargets) {
    if (String(target.url || '').trim() === normalizedNeedle) {
      return target;
    }
  }

  return pageTargets[0] || null;
}

async function evaluateJson(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Runtime.evaluate exception');
  }
  return result.result ? result.result.value : null;
}

async function captureClippedScreenshot(client, clip, outputPath) {
  if (!clip || !(clip.width > 0) || !(clip.height > 0)) {
    return false;
  }
  const screenshot = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: true,
    clip,
  });
  if (!screenshot || !screenshot.data) {
    return false;
  }
  fs.writeFileSync(outputPath, Buffer.from(screenshot.data, 'base64'));
  return true;
}

async function scrollMermaidBlockIntoView(client, blockIndex) {
  return evaluateJson(client, `(() => {
    const body = window.reader && window.reader.body ? window.reader.body : null;
    if (!body) {
      return null;
    }
    const wrappers = Array.from(body.querySelectorAll('.mermaid'));
    const wrapper = wrappers[${Math.max(0, Number(blockIndex) - 1)}];
    if (!wrapper) {
      return null;
    }
    wrapper.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    const rect = wrapper.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  })()`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputDir = ensureDir(path.join(args.outputDir, args.session));
  const noteFilePath = args.noteFile ? path.resolve(REPO_ROOT, args.noteFile) : '';
  const noteFileExists = noteFilePath ? fs.existsSync(noteFilePath) : false;
  const noteFileNormalized = noteFileExists ? noteFilePath.replace(/\//g, '\\') : '';
  const targetsUrl = `http://${args.host}:${args.port}/json/list`;
  const targets = await httpGetJson(targetsUrl);
  writeJson(path.join(outputDir, 'targets.json'), targets);

  const target = pickTarget(targets, args.pageUrl);
  if (!target || !target.webSocketDebuggerUrl) {
    throw new Error(`No suitable page target found at ${targetsUrl}.`);
  }

  const client = new CDPClient(target.webSocketDebuggerUrl);
  await client.connect();

  try {
    await client.send('Runtime.enable');
    await client.send('Page.enable');

    const openResult = await evaluateJson(client, `(() => {
      const filepathNeedle = ${JSON.stringify(noteFileNormalized)};
      const nodeNeedle = ${JSON.stringify(args.nodeLabel)};
      const nodes = Array.isArray(window.graphData?.nodes) ? window.graphData.nodes : [];
      const normalize = (value) => String(value || '').trim().toLowerCase();
      const normalizePath = (value) => String(value || '').replace(/\\//g, '\\\\').trim().toLowerCase();
      const node = nodes.find((candidate) => {
        if (!candidate || typeof candidate !== 'object') return false;
        const metadata = candidate.metadata && typeof candidate.metadata === 'object' ? candidate.metadata : {};
        const label = normalize(candidate.label);
        const id = normalize(candidate.id);
        const filepath = normalizePath(metadata.filepath || metadata.filePath || candidate.filepath || candidate.filePath || '');
        if (filepathNeedle && filepath === normalizePath(filepathNeedle)) return true;
        if (nodeNeedle && (label === normalize(nodeNeedle) || id === normalize(nodeNeedle))) return true;
        return false;
      });
      if (!node) {
        return {
          ok: false,
          reason: 'node-not-found',
          available: nodes.slice(0, 50).map((candidate) => ({
            id: String(candidate?.id || ''),
            label: String(candidate?.label || ''),
            filepath: String(candidate?.metadata?.filepath || candidate?.filepath || ''),
          })),
        };
      }
      if (!window.reader || typeof window.reader.open !== 'function') {
        return { ok: false, reason: 'reader-unavailable' };
      }
      window.reader.open(node);
      return {
        ok: true,
        node: {
          id: String(node.id || ''),
          label: String(node.label || ''),
          filepath: String(node?.metadata?.filepath || node?.filepath || ''),
        },
      };
    })()`);

    writeJson(path.join(outputDir, 'open-result.json'), openResult);
    if (!openResult || openResult.ok !== true) {
      throw new Error(`Unable to open reader note: ${JSON.stringify(openResult)}`);
    }

    const readerState = await evaluateJson(client, `(() => new Promise((resolve) => {
      const deadline = Date.now() + ${Math.max(1000, args.waitMs)};
      const tick = () => {
        const reader = window.reader;
        const win = document.getElementById('reading-window');
        const visible = !!(win && getComputedStyle(win).display !== 'none' && win.offsetWidth > 0 && win.offsetHeight > 0);
        const title = reader && reader.title ? String(reader.title.textContent || '').trim() : '';
        const body = reader && reader.body ? reader.body : null;
        const meta = reader && reader.contentBox ? String((document.getElementById('reader-filepath') || {}).textContent || '') : '';
        const mermaidBlocks = body ? Array.from(body.querySelectorAll('.mermaid')).map((wrapper, index) => {
          const svg = wrapper.querySelector('svg');
          const img = wrapper.querySelector('img.mermaid-fallback-image');
          const rect = wrapper.getBoundingClientRect();
          return {
            index: index + 1,
            renderSource: String(wrapper.dataset.renderSource || ''),
            kind: svg ? 'svg' : (img ? 'img' : 'html'),
            textSample: String(wrapper.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 200),
            svgOuterHTML: svg ? svg.outerHTML : '',
            imageDataUrl: img ? String(img.src || '') : '',
            bbox: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            },
          };
        }) : [];
        const ready = visible && mermaidBlocks.length >= ${Math.max(1, args.minMermaidBlocks)};
        if (ready || Date.now() >= deadline) {
          resolve({
            visible,
            title,
            meta,
            mermaidBlocks,
            timedOut: !ready,
            devicePixelRatio: window.devicePixelRatio || 1,
            bodyTextSample: body ? String(body.innerText || '').slice(0, 2000) : '',
          });
          return;
        }
        setTimeout(tick, 160);
      };
      tick();
    }))()`);

    writeJson(path.join(outputDir, 'reader-state.json'), readerState);
    if (!readerState || readerState.visible !== true) {
      throw new Error(`Reader did not become visible: ${JSON.stringify(readerState)}`);
    }
    if (!Array.isArray(readerState.mermaidBlocks) || readerState.mermaidBlocks.length === 0) {
      throw new Error(`Reader opened but no Mermaid blocks were found: ${JSON.stringify(readerState)}`);
    }

    const pageScreenshot = await client.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: true,
    });
    if (pageScreenshot && pageScreenshot.data) {
      fs.writeFileSync(path.join(outputDir, 'page-screenshot.png'), Buffer.from(pageScreenshot.data, 'base64'));
    }

    const dpr = Number(readerState.devicePixelRatio) > 0 ? Number(readerState.devicePixelRatio) : 1;
    const exportedBlocks = [];
    for (const block of readerState.mermaidBlocks) {
      const prefix = `block-${String(block.index).padStart(2, '0')}`;
      const bbox = block && block.bbox ? block.bbox : null;
      const blockOutput = {
        index: block.index,
        renderSource: block.renderSource,
        kind: block.kind,
        bbox,
        files: {},
      };

      if (block.kind === 'svg' && typeof block.svgOuterHTML === 'string' && block.svgOuterHTML.trim()) {
        const svgPath = path.join(outputDir, `${prefix}.svg`);
        fs.writeFileSync(svgPath, block.svgOuterHTML, 'utf8');
        blockOutput.files.svg = svgPath;
      }

      if (block.kind === 'img' && typeof block.imageDataUrl === 'string' && block.imageDataUrl.startsWith('data:image/png;base64,')) {
        const pngPath = path.join(outputDir, `${prefix}.png`);
        fs.writeFileSync(pngPath, Buffer.from(block.imageDataUrl.split(',')[1], 'base64'));
        blockOutput.files.png = pngPath;
      }

      if (bbox && bbox.width > 0 && bbox.height > 0) {
        const updatedBbox = await scrollMermaidBlockIntoView(client, block.index);
        const activeBbox = updatedBbox && updatedBbox.width > 0 && updatedBbox.height > 0
          ? updatedBbox
          : bbox;
        const clipPath = path.join(outputDir, `${prefix}-crop.png`);
        const clip = {
          x: Math.max(0, Number(activeBbox.x) || 0),
          y: Math.max(0, Number(activeBbox.y) || 0),
          width: Math.max(1, Number(activeBbox.width) || 1),
          height: Math.max(1, Number(activeBbox.height) || 1),
          scale: dpr,
        };
        const clipped = await captureClippedScreenshot(client, clip, clipPath);
        if (clipped) {
          blockOutput.files.crop = clipPath;
        }
      }

      exportedBlocks.push(blockOutput);
    }

    const summary = {
      success: true,
      session: args.session,
      pageUrl: args.pageUrl,
      target,
      note: {
        requestedLabel: args.nodeLabel,
        requestedFile: noteFileExists ? noteFilePath : args.noteFile,
        opened: openResult.node,
        readerTitle: readerState.title,
        readerMeta: readerState.meta,
      },
      mermaidBlocks: exportedBlocks,
      files: {
        targets: path.join(outputDir, 'targets.json'),
        openResult: path.join(outputDir, 'open-result.json'),
        readerState: path.join(outputDir, 'reader-state.json'),
        pageScreenshot: path.join(outputDir, 'page-screenshot.png'),
      },
    };

    writeJson(path.join(outputDir, 'summary.json'), summary);
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error('[export-live-tauri-reader-mermaid] FAIL:', error && error.stack ? error.stack : String(error));
  process.exit(1);
});
