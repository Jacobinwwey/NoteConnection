#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const result = {
    url: 'http://127.0.0.1:1605/',
    waitMs: 2500,
    session: `nc-debug-${Date.now()}`,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '').trim();
    if (token === '--url' && argv[index + 1]) {
      result.url = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (token === '--wait-ms' && argv[index + 1]) {
      const value = Number(argv[index + 1]);
      if (Number.isFinite(value) && value >= 0) {
        result.waitMs = Math.floor(value);
      }
      index += 1;
      continue;
    }
    if (token === '--session' && argv[index + 1]) {
      result.session = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
  }

  return result;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

function resolveWindowsNpmCliPath() {
  if (process.platform !== 'win32') {
    return '';
  }
  const nodeDir = path.dirname(process.execPath || '');
  const candidates = [
    path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}

function runPwcli(args, artifactDir) {
  const cliArgs = ['exec', '--yes', '--package', '@playwright/cli', '--', 'playwright-cli']
    .concat(['-s', ARGS.session])
    .concat(args);
  const npmCliPath = resolveWindowsNpmCliPath();
  const invocation = (process.platform === 'win32' && npmCliPath)
    ? { command: process.execPath, commandArgs: [npmCliPath].concat(cliArgs), shell: false }
    : (process.platform === 'win32'
        ? { command: 'npm.cmd', commandArgs: cliArgs, shell: true }
        : { command: 'npm', commandArgs: cliArgs, shell: false });

  const result = spawnSync(invocation.command, invocation.commandArgs, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      PLAYWRIGHT_CLI_SESSION: ARGS.session,
    },
    maxBuffer: 16 * 1024 * 1024,
    timeout: 180000,
    shell: invocation.shell,
  });

  const joined = [
    `> ${invocation.command} ${invocation.commandArgs.join(' ')}`,
    result.stdout || '',
    result.stderr || '',
    result.error ? String(result.error.stack || result.error) : '',
  ].join('\n');
  fs.appendFileSync(path.join(artifactDir, 'commands.log'), `${joined}\n\n`, 'utf8');

  if (result.error) {
    throw new Error(joined);
  }
  if (result.status !== 0) {
    throw new Error(joined);
  }
  return result.stdout || '';
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function resolvePlaywrightArtifactPath(output, extension) {
  const normalized = String(output || '').replace(/\r/g, '');
  const patterns = [
    new RegExp(`\\((\\.playwright-cli[\\\\/][^)#\\s]+\\.${extension})\\)`),
    new RegExp(`(\\.playwright-cli[\\\\/][^#\\s]+\\.${extension})`),
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match || !match[1]) {
      continue;
    }
    const relativePath = match[1].replace(/[\\/]+/g, path.sep);
    return {
      relativePath,
      absolutePath: path.resolve(REPO_ROOT, relativePath),
    };
  }
  return null;
}

function copyIfExists(sourcePath, targetPath) {
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return false;
  }
  fs.copyFileSync(sourcePath, targetPath);
  return true;
}

const ARGS = parseArgs(process.argv.slice(2));
const artifactRoot = ensureDir(path.join(REPO_ROOT, 'output', 'playwright', 'runtime-debug', ARGS.session));

try {
  runPwcli(['open', ARGS.url], artifactRoot);
  if (ARGS.waitMs > 0) {
    runPwcli(['eval', `(async () => { await new Promise((resolve) => setTimeout(resolve, ${ARGS.waitMs})); return true; })()`], artifactRoot);
  }

  const debugStateRaw = runPwcli([
    '--raw',
    'eval',
    `(async () => (
      window.__NC_DEBUG__ && typeof window.__NC_DEBUG__.captureRuntimeState === 'function'
        ? await window.__NC_DEBUG__.captureRuntimeState()
        : { error: 'window.__NC_DEBUG__.captureRuntimeState unavailable' }
    ))()`,
  ], artifactRoot);

  let debugState;
  try {
    debugState = JSON.parse(String(debugStateRaw || '').trim());
  } catch (_error) {
    debugState = { raw: debugStateRaw };
  }
  writeJson(path.join(artifactRoot, 'runtime-debug-state.json'), debugState);

  const consoleOutput = runPwcli(['console'], artifactRoot);
  fs.writeFileSync(path.join(artifactRoot, 'console.txt'), consoleOutput, 'utf8');

  const screenshotOutput = runPwcli(['screenshot'], artifactRoot);
  fs.writeFileSync(path.join(artifactRoot, 'screenshot.txt'), screenshotOutput, 'utf8');
  const screenshotPathInfo = resolvePlaywrightArtifactPath(screenshotOutput, 'png');
  const screenshotArtifactPath = path.join(artifactRoot, 'screenshot.png');
  const screenshotCopied = screenshotPathInfo
    ? copyIfExists(screenshotPathInfo.absolutePath, screenshotArtifactPath)
    : false;

  const suppressionOutput = runPwcli([
    '--raw',
    'eval',
    `(async () => (
      window.__NC_DEBUG__ && typeof window.__NC_DEBUG__.suppressMermaidErrorArtifactsNow === 'function'
        ? await window.__NC_DEBUG__.suppressMermaidErrorArtifactsNow()
        : []
    ))()`,
  ], artifactRoot);
  let suppressionState;
  try {
    suppressionState = JSON.parse(String(suppressionOutput || '').trim());
  } catch (_error) {
    suppressionState = { raw: suppressionOutput };
  }
  writeJson(path.join(artifactRoot, 'suppressed-artifacts.json'), suppressionState);

  try {
    runPwcli(['close'], artifactRoot);
  } catch (_closeError) {
    // Best effort cleanup only.
  }

  console.log(JSON.stringify({
    success: true,
    session: ARGS.session,
    url: ARGS.url,
    artifactRoot,
    files: {
      debugState: path.join(artifactRoot, 'runtime-debug-state.json'),
      console: path.join(artifactRoot, 'console.txt'),
      screenshot: path.join(artifactRoot, 'screenshot.txt'),
      screenshotPng: screenshotCopied ? screenshotArtifactPath : null,
      screenshotSource: screenshotPathInfo ? screenshotPathInfo.absolutePath : null,
      suppressedArtifacts: path.join(artifactRoot, 'suppressed-artifacts.json'),
      commandLog: path.join(artifactRoot, 'commands.log'),
    },
  }, null, 2));
} catch (error) {
  console.error('[capture-noteconnection-runtime-debug] FAIL:', error && error.message ? error.message : String(error));
  process.exit(1);
}
