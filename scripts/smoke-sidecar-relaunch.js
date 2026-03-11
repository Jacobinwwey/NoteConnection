const http = require('http');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const serverEntry = path.join(repoRoot, 'dist', 'src', 'server.js');
const serverPort = Number(process.env.NOTE_CONNECTION_PORT || 3000);
const startupWaitMs = 20000;
const shutdownWaitMs = 5000;

function waitForServerStart(child) {
  return new Promise((resolve, reject) => {
    const startedPattern = new RegExp(`Server running at http://(?:127\\.0\\.0\\.1|localhost):${serverPort}/`, 'i');
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for server startup on port ${serverPort}.`));
    }, startupWaitMs);

    const onStdout = (chunk) => {
      const text = chunk.toString();
      if (startedPattern.test(text)) {
        cleanup();
        resolve();
      }
    };

    const onStderr = (chunk) => {
      const text = chunk.toString();
      if (/\berror\b/i.test(text)) {
        cleanup();
        reject(new Error(`Server stderr: ${text.trim()}`));
      }
    };

    const onExit = (code, signal) => {
      cleanup();
      reject(new Error(`Server exited before startup. code=${code ?? 'null'} signal=${signal ?? 'null'}`));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      child.stdout.off('data', onStdout);
      child.stderr.off('data', onStderr);
      child.off('exit', onExit);
    };

    child.stdout.on('data', onStdout);
    child.stderr.on('data', onStderr);
    child.on('exit', onExit);
  });
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    let done = false;
    const timeout = setTimeout(() => {
      if (done) {
        return;
      }
      done = true;
      reject(new Error(`Timed out waiting for server process ${child.pid} to exit.`));
    }, timeoutMs);

    child.once('exit', () => {
      if (done) {
        return;
      }
      done = true;
      clearTimeout(timeout);
      resolve();
    });
  });
}

function forceKillProcessTree(pid) {
  if (!Number.isFinite(pid) || pid <= 0) {
    return;
  }

  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true
    });
    return;
  }

  try {
    process.kill(pid, 'SIGKILL');
  } catch (_error) {
    // Process may already be gone.
  }
}

async function terminateChildProcess(child) {
  if (!child || child.killed) {
    return;
  }

  try {
    child.kill('SIGTERM');
  } catch (_error) {
    // Ignore and attempt forced kill below.
  }

  try {
    await waitForExit(child, shutdownWaitMs);
    return;
  } catch (_timeout) {
    forceKillProcessTree(child.pid);
    await waitForExit(child, shutdownWaitMs);
  }
}

function assertPortFree(port) {
  return new Promise((resolve, reject) => {
    const probe = http.createServer();
    probe.once('error', (err) => reject(err));
    probe.listen(port, '127.0.0.1', () => {
      probe.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  });
}

async function main() {
  const child = spawn(process.execPath, [serverEntry], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NOTE_CONNECTION_PORT: String(serverPort),
      npm_config_path: '',
      npm_config_gpu: '',
      npm_config_workers: '',
      npm_config_static: ''
    }
  });

  await waitForServerStart(child);
  await terminateChildProcess(child);
  await assertPortFree(serverPort);
  console.log(`[Smoke] Sidecar relaunch check passed: port ${serverPort} is free after shutdown.`);
}

main().catch((err) => {
  console.error(`[Smoke] Sidecar relaunch check failed: ${err.message}`);
  process.exit(1);
});
