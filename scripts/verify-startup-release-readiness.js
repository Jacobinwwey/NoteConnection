#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function parseArgs(argv) {
  const args = {
    windowsRoot: 'tmp/startup-logs',
    simulatedRoot: 'tmp/startup-logs-simulated',
    simulatedCohortsRoot: 'tmp/startup-logs-cohorts',
    realCohortsRoot: 'tmp/startup-logs-cohorts-real',
    out: 'tmp/startup-logs/report-startup-signoff.md',
    minTtiImprove: 30,
    minTfsImprove: 20,
    minSessionsPerPlatform: 10,
    sessionsPerPlatform: 12,
    seed: 20260331,
    strictEngineering: false,
    strictRelease: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === '--windows-root' && next) {
      args.windowsRoot = String(next).trim();
      i += 1;
      continue;
    }
    if (token.startsWith('--windows-root=')) {
      args.windowsRoot = String(token.slice('--windows-root='.length)).trim();
      continue;
    }

    if (token === '--simulated-root' && next) {
      args.simulatedRoot = String(next).trim();
      i += 1;
      continue;
    }
    if (token.startsWith('--simulated-root=')) {
      args.simulatedRoot = String(token.slice('--simulated-root='.length)).trim();
      continue;
    }

    if (token === '--simulated-cohorts-root' && next) {
      args.simulatedCohortsRoot = String(next).trim();
      i += 1;
      continue;
    }
    if (token.startsWith('--simulated-cohorts-root=')) {
      args.simulatedCohortsRoot = String(token.slice('--simulated-cohorts-root='.length)).trim();
      continue;
    }

    if (token === '--real-cohorts-root' && next) {
      args.realCohortsRoot = String(next).trim();
      i += 1;
      continue;
    }
    if (token.startsWith('--real-cohorts-root=')) {
      args.realCohortsRoot = String(token.slice('--real-cohorts-root='.length)).trim();
      continue;
    }

    if (token === '--out' && next) {
      args.out = String(next).trim();
      i += 1;
      continue;
    }
    if (token.startsWith('--out=')) {
      args.out = String(token.slice('--out='.length)).trim();
      continue;
    }

    if (token === '--min-tti-improve' && next) {
      args.minTtiImprove = Number(next);
      i += 1;
      continue;
    }
    if (token.startsWith('--min-tti-improve=')) {
      args.minTtiImprove = Number(token.slice('--min-tti-improve='.length));
      continue;
    }

    if (token === '--min-tfs-improve' && next) {
      args.minTfsImprove = Number(next);
      i += 1;
      continue;
    }
    if (token.startsWith('--min-tfs-improve=')) {
      args.minTfsImprove = Number(token.slice('--min-tfs-improve='.length));
      continue;
    }

    if (token === '--min-sessions-per-platform' && next) {
      args.minSessionsPerPlatform = Number(next);
      i += 1;
      continue;
    }
    if (token.startsWith('--min-sessions-per-platform=')) {
      args.minSessionsPerPlatform = Number(token.slice('--min-sessions-per-platform='.length));
      continue;
    }

    if (token === '--sessions-per-platform' && next) {
      args.sessionsPerPlatform = Number(next);
      i += 1;
      continue;
    }
    if (token.startsWith('--sessions-per-platform=')) {
      args.sessionsPerPlatform = Number(token.slice('--sessions-per-platform='.length));
      continue;
    }

    if (token === '--seed' && next) {
      args.seed = Number(next);
      i += 1;
      continue;
    }
    if (token.startsWith('--seed=')) {
      args.seed = Number(token.slice('--seed='.length));
      continue;
    }

    if (token === '--strict-engineering') {
      args.strictEngineering = true;
      continue;
    }
    if (token === '--strict-release') {
      args.strictRelease = true;
      continue;
    }
  }

  return args;
}

function runNodeScript(scriptPath, scriptArgs, options = {}) {
  const result = spawnSync(process.execPath, [scriptPath, ...scriptArgs], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });

  if (result.stdout && result.stdout.trim()) {
    console.log(result.stdout.trim());
  }
  if (result.stderr && result.stderr.trim()) {
    console.error(result.stderr.trim());
  }

  return {
    ok: result.status === 0,
    status: result.status,
    error: result.error ? result.error.message : '',
    command: `${path.basename(scriptPath)} ${scriptArgs.join(' ')}`.trim(),
    note: options.note || ''
  };
}

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function copyDirRecursive(sourceDir, targetDir) {
  ensureDir(targetDir);
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(sourcePath, targetPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function hasRealCohortData(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return false;
  }
  const cohortNames = ['small', 'medium', 'large'];
  for (const cohort of cohortNames) {
    const cohortRoot = path.join(rootDir, cohort);
    if (!fs.existsSync(cohortRoot)) {
      return false;
    }
  }
  return true;
}

function renderStatus(ok, blocked = false) {
  if (blocked) {
    return 'BLOCKED';
  }
  return ok ? 'PASS' : 'FAIL';
}

function buildReport(summary, args) {
  const lines = [
    '# Startup Plan B Signoff Report',
    '',
    `Generated at: ${summary.generatedAt}`,
    '',
    '## 中文',
    '',
    '### 分层签收结论',
    `- 工程签收（无多端硬件）: ${renderStatus(summary.engineeringGatePass)}`,
    `- 发布签收（真实多端硬件）: ${renderStatus(summary.releaseGatePass, summary.releaseGateBlocked)}`,
    '',
    '### 执行明细',
    '| Step | Status | Command |',
    '|---|---|---|'
  ];

  for (const step of summary.steps) {
    lines.push(`| ${step.name} | ${renderStatus(step.ok, step.blocked)} | \`${step.command}\` |`);
  }

  lines.push('');
  lines.push('### 说明');
  lines.push(`- Windows 根目录: \`${args.windowsRoot}\``);
  lines.push(`- 模拟多端目录: \`${args.simulatedRoot}\``);
  lines.push(`- 模拟三规模目录: \`${args.simulatedCohortsRoot}\``);
  lines.push(`- 真实三规模目录: \`${args.realCohortsRoot}\``);
  lines.push(`- 门禁阈值: TTI P50 >= ${args.minTtiImprove}%, TFS P50 >= ${args.minTfsImprove}%`);
  lines.push(`- 样本门槛: 每平台 baseline/pilot >= ${args.minSessionsPerPlatform}`);
  lines.push('- 说明: 无多端硬件时，发布签收会标记为 BLOCKED，不会误判为 PASS。');

  lines.push('');
  lines.push('## English');
  lines.push('');
  lines.push('### Signoff Summary');
  lines.push(`- Engineering gate (no multi-device hardware): ${renderStatus(summary.engineeringGatePass)}`);
  lines.push(`- Release gate (real multi-device hardware): ${renderStatus(summary.releaseGatePass, summary.releaseGateBlocked)}`);
  lines.push('');
  lines.push('### Details');
  lines.push('| Step | Status | Command |');
  lines.push('|---|---|---|');
  for (const step of summary.steps) {
    lines.push(`| ${step.name} | ${renderStatus(step.ok, step.blocked)} | \`${step.command}\` |`);
  }
  lines.push('');
  lines.push('### Notes');
  lines.push('- Release gate remains BLOCKED without real macOS/Android/iOS cohort datasets.');

  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const windowsRoot = path.resolve(process.cwd(), args.windowsRoot);
  const simulatedRoot = path.resolve(process.cwd(), args.simulatedRoot);
  const simulatedCohortsRoot = path.resolve(process.cwd(), args.simulatedCohortsRoot);
  const realCohortsRoot = path.resolve(process.cwd(), args.realCohortsRoot);
  const outPath = path.resolve(process.cwd(), args.out);

  const compareScript = path.resolve(__dirname, 'compare-startup-perf.js');
  const matrixScript = path.resolve(__dirname, 'compare-startup-perf-matrix.js');
  const simulateScript = path.resolve(__dirname, 'simulate-startup-perf-platform-logs.js');
  const cohortsScript = path.resolve(__dirname, 'verify-startup-perf-cohorts.js');

  const steps = [];

  // Step 1: Windows baseline/pilot compare gate
  const windowsCompareOut = path.join(windowsRoot, 'report-phase1-windows-compare.md');
  const stepWindowsCompare = runNodeScript(compareScript, [
    '--baseline', path.join(windowsRoot, 'baseline'),
    '--pilot', path.join(windowsRoot, 'pilot'),
    '--out', windowsCompareOut,
    '--min-tti-improve', String(args.minTtiImprove),
    '--min-tfs-improve', String(args.minTfsImprove)
  ]);
  steps.push({ name: 'windows-compare', ...stepWindowsCompare, blocked: false });

  // Step 2: Windows matrix strict gate
  const windowsMatrixOut = path.join(windowsRoot, 'report-phase1-windows-matrix.md');
  const stepWindowsMatrix = runNodeScript(matrixScript, [
    '--root', windowsRoot,
    '--single-platform-label', 'windows',
    '--out', windowsMatrixOut,
    '--min-tti-improve', String(args.minTtiImprove),
    '--min-tfs-improve', String(args.minTfsImprove),
    '--strict'
  ]);
  steps.push({ name: 'windows-matrix', ...stepWindowsMatrix, blocked: false });

  // Step 3: Simulated multi-platform matrix preparation
  const stepSimulate = runNodeScript(simulateScript, [
    '--seed-root', windowsRoot,
    '--out-root', simulatedRoot,
    '--sessions-per-platform', String(args.sessionsPerPlatform),
    '--seed', String(args.seed)
  ]);
  steps.push({ name: 'simulate-platform-logs', ...stepSimulate, blocked: false });

  // Step 4: Simulated cohorts gate
  let stepSimulatedCohorts = {
    ok: false,
    status: 1,
    error: '',
    command: `${path.basename(cohortsScript)} --root ${simulatedCohortsRoot}`,
    blocked: false
  };
  if (stepSimulate.ok) {
    ensureDir(simulatedCohortsRoot);
    for (const cohort of ['small', 'medium', 'large']) {
      const cohortDir = path.join(simulatedCohortsRoot, cohort);
      ensureDir(cohortDir);
      copyDirRecursive(simulatedRoot, cohortDir);
    }
    stepSimulatedCohorts = runNodeScript(cohortsScript, [
      '--root', simulatedCohortsRoot,
      '--cohorts', 'small,medium,large',
      '--out', path.join(simulatedCohortsRoot, 'report-cohorts.md'),
      '--min-tti-improve', String(args.minTtiImprove),
      '--min-tfs-improve', String(args.minTfsImprove),
      '--min-sessions-per-platform', String(args.minSessionsPerPlatform),
      '--strict'
    ]);
  } else {
    stepSimulatedCohorts.error = 'skip due to simulation generation failure';
  }
  steps.push({ name: 'simulated-cohorts-gate', ...stepSimulatedCohorts, blocked: false });

  // Step 5: Real cohorts gate (blocked when no hardware datasets)
  let stepRealCohorts = {
    ok: false,
    status: null,
    error: '',
    command: `${path.basename(cohortsScript)} --root ${realCohortsRoot}`,
    blocked: false
  };
  const realCohortsAvailable = hasRealCohortData(realCohortsRoot);
  if (realCohortsAvailable) {
    stepRealCohorts = runNodeScript(cohortsScript, [
      '--root', realCohortsRoot,
      '--cohorts', 'small,medium,large',
      '--out', path.join(realCohortsRoot, 'report-cohorts-real.md'),
      '--min-tti-improve', String(args.minTtiImprove),
      '--min-tfs-improve', String(args.minTfsImprove),
      '--min-sessions-per-platform', String(args.minSessionsPerPlatform),
      '--strict'
    ]);
  } else {
    stepRealCohorts = {
      ok: false,
      status: null,
      error: 'no real multi-device cohort dataset found',
      command: `${path.basename(cohortsScript)} --root ${realCohortsRoot}`,
      blocked: true
    };
  }
  steps.push({ name: 'real-cohorts-gate', ...stepRealCohorts });

  const engineeringGatePass = stepWindowsCompare.ok && stepWindowsMatrix.ok && stepSimulatedCohorts.ok;
  const releaseGateBlocked = stepRealCohorts.blocked === true;
  const releaseGatePass = !releaseGateBlocked && stepRealCohorts.ok;

  const summary = {
    generatedAt: new Date().toISOString(),
    steps,
    engineeringGatePass,
    releaseGatePass,
    releaseGateBlocked
  };

  const report = buildReport(summary, args);
  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, `${report}\n`, 'utf8');
  console.log(`[startup-signoff] Report written: ${outPath}`);
  console.log(
    `[startup-signoff] engineeringGate=${renderStatus(engineeringGatePass)}, ` +
      `releaseGate=${renderStatus(releaseGatePass, releaseGateBlocked)}`
  );

  if (args.strictEngineering && !engineeringGatePass) {
    process.exit(1);
  }
  if (args.strictRelease && !releaseGatePass) {
    process.exit(1);
  }
}

main();
