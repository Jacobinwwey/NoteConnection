#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const options = {
    skipVerify: false,
    skipBuild: false,
    siteDir: path.join('build', 'mkdocs-site'),
    projectName: String(process.env.EDGEONE_PAGES_PROJECT_NAME || '').trim(),
    token: String(process.env.EDGEONE_PAGES_API_TOKEN || '').trim(),
    deployEnv: String(process.env.EDGEONE_PAGES_ENV || 'production').trim().toLowerCase(),
    area: String(process.env.EDGEONE_PAGES_AREA || 'global').trim().toLowerCase(),
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = String(argv[index] || '').trim();
    if (!arg) {
      continue;
    }
    if (arg === '--skip-verify') {
      options.skipVerify = true;
      continue;
    }
    if (arg === '--skip-build') {
      options.skipBuild = true;
      continue;
    }
    if (arg === '--dir' && index + 1 < argv.length) {
      options.siteDir = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (arg === '--name' && index + 1 < argv.length) {
      options.projectName = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (arg === '--token' && index + 1 < argv.length) {
      options.token = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (arg === '--env' && index + 1 < argv.length) {
      options.deployEnv = String(argv[index + 1]).trim().toLowerCase();
      index += 1;
      continue;
    }
    if (arg === '--area' && index + 1 < argv.length) {
      options.area = String(argv[index + 1]).trim().toLowerCase();
      index += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
      return null;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printUsage() {
  console.log('Usage: node scripts/deploy-docs-edgeone.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --skip-verify      Skip docs:diataxis:check');
  console.log('  --skip-build       Skip docs:site:build');
  console.log('  --dir <path>       MkDocs output directory (default: build/mkdocs-site)');
  console.log('  --name <project>   EdgeOne Pages project name');
  console.log('  --token <token>    EdgeOne API token (optional if local CLI login exists)');
  console.log('  --env <name>       Deploy environment: production|preview (default: production)');
  console.log('  --area <name>      Deploy area: global|overseas (default: global)');
  console.log('  -h, --help         Show this help');
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${String(result.status)}`);
  }
}

function resolveEdgeoneRunner() {
  const probe = spawnSync('edgeone', ['--version'], {
    cwd: repoRoot,
    stdio: 'ignore',
    shell: process.platform === 'win32',
  });
  if (probe.status === 0) {
    return { command: 'edgeone', baseArgs: [] };
  }
  return { command: 'npx', baseArgs: ['-y', 'edgeone@1.3.5'] };
}

function validateOptions(options) {
  if (!options.projectName) {
    throw new Error(
      'EDGEONE_PAGES_PROJECT_NAME is required. Set env var or pass --name <project>.'
    );
  }
  const allowedEnv = new Set(['production', 'preview']);
  if (!allowedEnv.has(options.deployEnv)) {
    throw new Error(`Invalid --env value "${options.deployEnv}". Use production or preview.`);
  }
  const allowedArea = new Set(['global', 'overseas']);
  if (!allowedArea.has(options.area)) {
    throw new Error(`Invalid --area value "${options.area}". Use global or overseas.`);
  }
}

function main() {
  const options = parseArgs(process.argv);
  if (!options) {
    return;
  }

  validateOptions(options);

  console.log(`[docs-edgeone] project=${options.projectName} env=${options.deployEnv} area=${options.area}`);
  console.log(`[docs-edgeone] siteDir=${options.siteDir}`);

  if (!options.skipVerify) {
    run('npm', ['run', 'docs:diataxis:check']);
  } else {
    console.log('[docs-edgeone] skip verify');
  }

  if (!options.skipBuild) {
    run('npm', ['run', 'docs:site:build']);
  } else {
    console.log('[docs-edgeone] skip build');
  }

  const runner = resolveEdgeoneRunner();
  const deployArgs = [
    ...runner.baseArgs,
    'pages',
    'deploy',
    options.siteDir,
    '-n',
    options.projectName,
    '-e',
    options.deployEnv,
    '-a',
    options.area,
  ];
  if (options.token) {
    deployArgs.push('-t', options.token);
  }

  run(runner.command, deployArgs);
}

try {
  main();
} catch (error) {
  console.error(`[docs-edgeone] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
