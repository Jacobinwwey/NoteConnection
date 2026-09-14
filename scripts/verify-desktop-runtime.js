const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { randomInt } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitFor(label, operation, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  do {
    try { const value = await operation(); if (value) return value; } catch (error) { lastError = error; }
    await delay(250);
  } while (Date.now() < deadline);
  throw new Error(`${label} timed out${lastError ? `: ${lastError.message}` : ''}`);
}

async function freeDebuggerPort() {
  for (let attempt = 0; attempt < 64; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(randomInt(49152, 65536), '127.0.0.1', () => {
          const port = server.address().port;
          server.close(error => error ? reject(error) : resolve(port));
        });
      });
    } catch (error) {
      if (!['EADDRINUSE', 'EACCES'].includes(error.code)) throw error;
    }
  }
  throw new Error('No browser-compatible debugger port is available');
}

async function connectWebView(port, authToken) {
  const page = await waitFor('native WebView debugger', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(2000) });
    return (await response.json()).find(entry => entry.type === 'page' && entry.webSocketDebuggerUrl);
  });
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.close(); reject(new Error('Debugger connection timed out')); }, 10000);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Debugger connection failed')); }, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  const errors = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(String(event.data));
    if (message.method === 'Runtime.exceptionThrown' || message.method === 'Network.webSocketFrameError'
      || (message.method === 'Log.entryAdded' && ['error', 'warning'].includes(message.params.entry.level))) {
      errors.push(JSON.stringify(message).split(authToken).join('[redacted]'));
    }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id); clearTimeout(request.timer);
    if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
  });
  socket.addEventListener('close', () => {
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('Debugger closed')); }
    pending.clear();
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 10000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
  for (const method of ['Runtime.enable', 'Log.enable', 'Network.enable']) await command(method);
  return {
    command, errors, close: () => socket.close(),
    evaluate: async expression => {
      const response = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, includeCommandLineAPI: true });
      if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
      return response.result?.value;
    },
  };
}

async function verifyDesktopRuntime(executablePath, reportDirectory) {
  assert.equal(process.platform, 'win32', 'Native desktop qualification requires Windows');
  const executable = fs.realpathSync(executablePath);
  const run = path.resolve(reportDirectory);
  assert(!fs.existsSync(run), 'Each qualification requires a fresh report directory');
  const launchRoot = path.join(run, 'unrelated launcher');
  const knowledge = path.join(run, 'knowledge');
  for (const directory of [launchRoot, path.join(knowledge, 'acceptance'), path.join(run, 'temp'), path.join(run, 'profile'), path.join(run, 'local')]) fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(knowledge, 'acceptance/Alpha.md'), '# Alpha\nAlpha depends on [[Beta]].\n');
  fs.writeFileSync(path.join(knowledge, 'acceptance/Beta.md'), '# Beta\nBeta supports the Alpha learning path.\n');
  const config = path.join(run, 'app_config.toml');
  fs.writeFileSync(config, `knowledge_base_path = '${knowledge}'\nuser_language = 'en'\n\n[multi_window]\nsingle_window_mode = true\nhide_tauri_when_pathmode_opens = true\nrestore_tauri_when_pathmode_exits = true\nconfirm_before_full_shutdown_from_godot = false\nsync_language = true\n`);
  const debugPort = await freeDebuggerPort();
  const env = { ...process.env,
    NOTE_CONNECTION_CONFIG_PATH: config, NOTE_CONNECTION_RUNTIME_DATA_DIR: path.join(run, 'runtime'),
    WEBVIEW2_USER_DATA_FOLDER: path.join(run, 'webview'), WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${debugPort} --remote-allow-origins=http://127.0.0.1:${debugPort}`,
    APPDATA: path.join(run, 'profile'), LOCALAPPDATA: path.join(run, 'local'), TEMP: path.join(run, 'temp'), TMP: path.join(run, 'temp'),
  };
  for (const key of ['NOTE_CONNECTION_GODOT_PROJECT', 'NOTE_CONNECTION_GODOT_EXE', 'NOTE_CONNECTION_FRONTEND_DIR', 'NOTE_CONNECTION_PROJECT_ROOT', 'NOTE_CONNECTION_KB_ROOT', 'NOTE_CONNECTION_ALLOW_EPHEMERAL_PORT_FALLBACK', 'NOTE_CONNECTION_ALLOW_EPHEMERAL_BRIDGE_PORT_FALLBACK']) delete env[key];
  const logPath = path.join(run, 'native.log');
  const log = fs.openSync(logPath, 'w');
  const child = spawn(executable, [], { cwd: launchRoot, env, stdio: ['ignore', log, log], windowsHide: true });
  let exitCode;
  let spawnError;
  child.on('exit', code => { exitCode = code; });
  child.on('error', error => { spawnError = error; });
  const report = { generatedAt: new Date().toISOString(), sourceRevision: process.env.GITHUB_SHA || null, run, executable, applicationPid: child.pid, launchRoot, checks: {} };
  let webview;
  const nativeCommand = (script, args) => {
    const result = spawnSync('powershell.exe', ['-NoProfile', '-File', path.join(__dirname, script), ...args], { env, encoding: 'utf8', windowsHide: true, timeout: 15000 });
    if (result.error || result.status !== 0) throw new Error(`${script}: ${result.error?.message || result.stderr}`);
    return JSON.parse(result.stdout.replace(/^\uFEFF/, ''));
  };
  const windows = () => nativeCommand('inspect-desktop-runtime-windows.ps1', ['-ApplicationProcessId', String(child.pid)]);
  const captureWebView = async name => {
    const screen = await webview.command('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(run, name), Buffer.from(screen.data, 'base64'));
  };
  try {
    const manifestPath = path.join(run, 'runtime/active-sidecar-runtime.json');
    await waitFor('writable runtime manifest', () => {
      if (spawnError) throw spawnError;
      return fs.existsSync(manifestPath);
    });
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert(manifest.authToken, 'Installed sidecar must require authentication');
    assert.equal(path.resolve(manifest.runtimeDataDir), path.join(run, 'runtime'));
    for (const port of [manifest.port, manifest.bridgePort]) assert(port >= 49152 && port <= 65535, `Browser-incompatible runtime port: ${port}`);
    assert.notEqual(manifest.port, manifest.bridgePort);
    report.runtimePorts = { http: manifest.port, bridge: manifest.bridgePort };
    report.checks.writableManifest = true;
    await waitFor('Godot resource pack connection', () => fs.readFileSync(logPath, 'utf8').includes('WsClient: Connected!'));
    report.checks.godotConnected = true;
    webview = await connectWebView(debugPort, manifest.authToken);
    await waitFor('source selector', () => webview.evaluate(`Array.from(document.querySelector('#folder-select')?.options || []).some(option => option.value === 'acceptance') && !document.querySelector('#btn-load-source').disabled`));
    await webview.evaluate(`document.querySelector('#folder-select').value='acceptance'; document.querySelector('#btn-load-source').click(); true`);
    await waitFor('native graph build', () => webview.evaluate(`(typeof graphData !== 'undefined' ? graphData : globalThis.graphData)?.nodes?.length === 2`));
    report.checks.graph = await webview.evaluate(`(() => { const graph = typeof graphData !== 'undefined' ? graphData : globalThis.graphData; return { nodes: graph.nodes.map(node => node.id), edges: (graph.edges || graph.links || []).length }; })()`);
    assert.deepEqual([...report.checks.graph.nodes].sort(), ['Alpha', 'Beta']);
    assert(report.checks.graph.edges > 0);
    await waitFor('main interface and path listener', () => webview.evaluate(`(() => { const button = document.querySelector('#btn-path-mode'); return document.readyState === 'complete' && button && !button.disabled && !!globalThis.pathApp && (getEventListeners(button).click || []).length > 0 && !document.querySelector('#btn-load-source')?.disabled; })()`));
    await webview.evaluate(`document.querySelector('#btn-explore')?.click(); true`);
    await waitFor('welcome dialog dismissed', () => webview.evaluate(`!document.querySelector('#welcome-modal')`));
    await captureWebView('native-graph.png');
    report.beforePathMode = windows();
    await webview.evaluate(`document.querySelector('#btn-path-mode').click(); true`);
    report.pathMode = await waitFor('Tauri hidden and Godot visible', () => {
      const snapshot = windows();
      return snapshot.windows.some(window => snapshot.godotPids.includes(window.processId) && window.visible)
        && snapshot.windows.some(window => window.processId === child.pid && !window.visible) ? snapshot : false;
    });
    await waitFor('Godot layout delivery', () => /treeLayout has\s+2\s+nodes/.test(fs.readFileSync(logPath, 'utf8')));
    report.checks.godotLayout = true;
    const godotWindow = report.pathMode.windows.find(window => report.pathMode.godotPids.includes(window.processId) && window.visible);
    report.capture = nativeCommand('capture-noteconnection-window.ps1', ['-TitleContains', 'NoteConnection Path Renderer', '-ProcessId', String(godotWindow.processId), '-OutputPath', path.join(run, 'native-godot.png')]);
    // This exercises the frontend's complete exit operation. A Godot-button
    // acceptance run is recorded separately; an IPC call is not a native click.
    await webview.evaluate('window.pathApp.exitPathMode(); true');
    report.exitTrigger = 'frontend-pathApp-exitPathMode';
    report.restored = await waitFor('Tauri restored and Godot hidden', () => {
      const snapshot = windows();
      return snapshot.windows.some(window => window.processId === child.pid && window.visible)
        && snapshot.windows.some(window => snapshot.godotPids.includes(window.processId) && !window.visible) ? snapshot : false;
    });
    report.checks.windowTransitions = true;
    await captureWebView('native-restored.png');
  } catch (error) {
    report.error = error.stack || String(error);
  } finally {
    webview?.close();
    try {
      if (exitCode === undefined && !spawnError) {
        report.close = nativeCommand('close-desktop-runtime-window.ps1', ['-ApplicationProcessId', String(child.pid), '-ExecutablePath', executable]);
        await waitFor('native application shutdown', () => exitCode !== undefined, 20000);
      }
      report.afterShutdown = windows();
      assert.equal(report.afterShutdown.childPids.length, 0, 'Owned native children must exit with the application');
    } catch (error) { report.shutdownError = error.stack || String(error); }
    fs.closeSync(log);
    report.exitCode = exitCode;
    report.webviewErrors = webview?.errors || [];
    report.passed = !report.error && !report.shutdownError && exitCode === 0;
    fs.writeFileSync(path.join(run, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  }
  return report;
}

if (require.main === module) {
  if (!process.argv[2] || !process.argv[3]) throw new Error('Usage: node verify-desktop-runtime.js <executable> <fresh-report-directory>');
  verifyDesktopRuntime(process.argv[2], process.argv[3]).then(report => {
    console.log(JSON.stringify(report));
    process.exitCode = report.passed ? 0 : 1;
  }).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { verifyDesktopRuntime };
