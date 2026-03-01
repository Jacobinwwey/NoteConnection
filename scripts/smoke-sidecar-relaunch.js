const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const serverEntry = path.join(repoRoot, 'dist', 'src', 'server.js');
const waitMs = 15000;

function waitForServerStart(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timed out waiting for server startup.'));
    }, waitMs);

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      if (text.includes('Server running at http://localhost:3000/')) {
        clearTimeout(timeout);
        resolve();
      }
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      if (text.toLowerCase().includes('error')) {
        clearTimeout(timeout);
        reject(new Error(`Server stderr: ${text.trim()}`));
      }
    });

    child.on('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Server exited before startup. code=${code}`));
    });
  });
}

function waitForExit(child) {
  return new Promise((resolve) => {
    child.once('exit', () => resolve());
  });
}

function assertPortFree(port) {
  return new Promise((resolve, reject) => {
    const probe = http.createServer();
    probe.once('error', (err) => reject(err));
    probe.listen(port, () => {
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
      npm_config_path: '',
      npm_config_gpu: '',
      npm_config_workers: '',
      npm_config_static: ''
    }
  });

  await waitForServerStart(child);
  child.kill();
  await waitForExit(child);
  await assertPortFree(3000);
  console.log('[Smoke] Sidecar relaunch check passed: port 3000 is free after shutdown.');
}

main().catch((err) => {
  console.error(`[Smoke] Sidecar relaunch check failed: ${err.message}`);
  process.exit(1);
});
