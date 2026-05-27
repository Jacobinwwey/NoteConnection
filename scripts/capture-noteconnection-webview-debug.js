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

function parseArgs(argv) {
  const result = {
    host: '127.0.0.1',
    port: parsePositiveInt(process.env.NOTE_CONNECTION_WEBVIEW2_DEBUG_PORT, 1665),
    waitMs: 1200,
    session: `nc-webview-debug-${Date.now()}`,
    outputDir: path.join(REPO_ROOT, 'output', 'webview-debug'),
    titleContains: 'NoteConnection',
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
    if (token === '--wait-ms' && argv[index + 1]) {
      result.waitMs = parsePositiveInt(argv[index + 1], result.waitMs);
      index += 1;
      continue;
    }
    if (token === '--session' && argv[index + 1]) {
      result.session = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (token === '--title-contains' && argv[index + 1]) {
      result.titleContains = String(argv[index + 1]).trim();
      index += 1;
    }
  }

  return result;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function writeText(filePath, value) {
  fs.writeFileSync(filePath, String(value || ''), 'utf8');
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickTarget(targets, titleContains) {
  const titleNeedle = String(titleContains || '').trim().toLowerCase();
  const pageTargets = Array.isArray(targets)
    ? targets.filter((target) => target && target.type === 'page')
    : [];

  const scoredTargets = pageTargets.map((target) => {
    const title = String(target.title || '');
    const url = String(target.url || '');
    let score = 0;
    if (titleNeedle && title.toLowerCase().includes(titleNeedle)) score += 50;
    if (url.includes('tauri.localhost')) score += 30;
    if (url.includes('tauri://localhost')) score += 30;
    if (url.includes('127.0.0.1') || url.includes('localhost')) score += 15;
    if (!url.startsWith('devtools://')) score += 10;
    return { target, score };
  });

  scoredTargets.sort((left, right) => right.score - left.score);
  return scoredTargets.length > 0 ? scoredTargets[0].target : null;
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
      const ws = new WebSocket(this.webSocketUrl, {
        perMessageDeflate: false,
      });
      this.ws = ws;
      ws.on('open', resolve);
      ws.on('error', reject);
      ws.on('message', (payload) => {
        let message;
        try {
          message = JSON.parse(String(payload));
        } catch (error) {
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const artifactRoot = ensureDir(path.join(args.outputDir, args.session));
  const endpointBase = `http://${args.host}:${args.port}`;
  const targetsUrl = `${endpointBase}/json/list`;

  const targets = await httpGetJson(targetsUrl);
  writeJson(path.join(artifactRoot, 'targets.json'), targets);

  const target = pickTarget(targets, args.titleContains);
  if (!target || !target.webSocketDebuggerUrl) {
    throw new Error(`No suitable page target found at ${targetsUrl}. Restart Tauri dev so WebView2 launches with remote debugging enabled.`);
  }

  const client = new CDPClient(target.webSocketDebuggerUrl);
  await client.connect();
  try {
    await client.send('Runtime.enable');
    await client.send('Log.enable');
    await client.send('Page.enable');
    await sleep(args.waitMs);

    const state = await evaluateJson(client, `(() => {
      const collectMermaidErrors = () => Array.from(document.querySelectorAll('svg, .mermaid, div, section, article, aside, img, foreignObject'))
        .map((node) => {
          const text = String(node.textContent || node.getAttribute?.('alt') || node.getAttribute?.('aria-label') || '').replace(/\\s+/g, ' ').trim();
          const hasErrorIcon = !!(node.classList?.contains('error-icon') || node.querySelector?.('.error-icon'));
          if (!hasErrorIcon && !/syntax error in text|lexical error on line|parse error on line|mermaid version|diagram syntax error/i.test(text)) {
            return null;
          }
          return {
            tag: node.tagName || '',
            id: node.id || '',
            className: node.className || '',
            text: text.slice(0, 320)
          };
        })
        .filter(Boolean)
        .slice(0, 20);

      const capture = (window.__NC_DEBUG__ && typeof window.__NC_DEBUG__.captureRuntimeState === 'function')
        ? window.__NC_DEBUG__.captureRuntimeState()
        : null;

      return Promise.resolve(capture).then((runtimeCapture) => ({
        href: location.href,
        title: document.title,
        readyState: document.readyState,
        bodyChildCount: document.body ? document.body.children.length : 0,
        bodyTextSample: document.body ? String(document.body.innerText || '').slice(0, 4000) : '',
        bodyHtmlSample: document.body ? String(document.body.innerHTML || '').slice(0, 4000) : '',
        hasReadingWindow: !!document.getElementById('reading-window'),
        activeMermaidErrors: collectMermaidErrors(),
        runtimeCapture
      }));
    })()`);

    writeJson(path.join(artifactRoot, 'runtime-state.json'), state);

    const screenshot = await client.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: true,
    });

    if (screenshot && screenshot.data) {
      fs.writeFileSync(path.join(artifactRoot, 'screenshot.png'), Buffer.from(screenshot.data, 'base64'));
    }

    const consoleEvents = client.events.filter((event) => (
      event.method === 'Runtime.consoleAPICalled' ||
      event.method === 'Runtime.exceptionThrown' ||
      event.method === 'Log.entryAdded'
    ));
    writeJson(path.join(artifactRoot, 'console-events.json'), consoleEvents);
    writeText(
      path.join(artifactRoot, 'console-summary.txt'),
      consoleEvents.map((event) => JSON.stringify(event)).join('\n\n')
    );

    const summary = {
      success: true,
      session: args.session,
      endpointBase,
      target: {
        id: target.id,
        title: target.title,
        type: target.type,
        url: target.url,
        webSocketDebuggerUrl: target.webSocketDebuggerUrl,
      },
      files: {
        targets: path.join(artifactRoot, 'targets.json'),
        runtimeState: path.join(artifactRoot, 'runtime-state.json'),
        screenshot: path.join(artifactRoot, 'screenshot.png'),
        consoleEvents: path.join(artifactRoot, 'console-events.json'),
        consoleSummary: path.join(artifactRoot, 'console-summary.txt'),
      },
      observations: {
        title: state && state.title ? state.title : '',
        href: state && state.href ? state.href : '',
        readyState: state && state.readyState ? state.readyState : '',
        bodyChildCount: state && Number.isFinite(Number(state.bodyChildCount)) ? Number(state.bodyChildCount) : 0,
        activeMermaidErrorCount: state && Array.isArray(state.activeMermaidErrors) ? state.activeMermaidErrors.length : 0,
      },
    };

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error('[capture-noteconnection-webview-debug] FAIL:', error && error.message ? error.message : String(error));
  process.exit(1);
});
