const { spawnSync } = require('child_process');
const path = require('path');
const { verifyDetoxPipeline } = require('./verify-detox-pipeline');

function runCommand(command, args, options = {}) {
  return spawnSync(command, args, {
    stdio: 'inherit',
    cwd: options.cwd || process.cwd(),
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      ...(options.env || {})
    }
  });
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  verifyDetoxPipeline(repoRoot);

  const args = process.argv.slice(2);
  const shouldRun = args.includes('--run') || String(process.env.NOTE_CONNECTION_RUN_DETOX || '').trim() === '1';
  if (!shouldRun) {
    console.log('[Detox] Pipeline contract verified. Skipping emulator run (use --run or NOTE_CONNECTION_RUN_DETOX=1 to execute).');
    return;
  }

  const detoxConfig = String(process.env.NOTE_CONNECTION_DETOX_CONFIGURATION || 'android.emu.debug').trim() || 'android.emu.debug';
  const buildResult = runCommand('npm', ['run', 'mobile:build:capacitor'], { cwd: repoRoot });
  if (buildResult.status !== 0) {
    process.exit(buildResult.status || 1);
  }

  const detoxArgs = ['detox', 'test', '--configuration', detoxConfig, '--headless'];
  if (String(process.env.CI || '').toLowerCase() === 'true') {
    detoxArgs.push('--record-logs', 'all');
  }

  const detoxResult = runCommand('npx', detoxArgs, { cwd: repoRoot });
  process.exit(detoxResult.status || 0);
}

try {
  main();
} catch (error) {
  console.error(`[Detox] ${error.message}`);
  process.exit(1);
}
