#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const reportPath = path.join(repoRoot, 'build', 'fixrisk-ops-closure-latest.json');

function parseArgs(argv) {
  const options = {
    dryRun: false,
    skipTauriEnv: false,
    skipStrictFixrisk: false,
    nodeCount: Number.parseInt(process.env.NOTE_CONNECTION_EVIDENCE_NODE_COUNT || '10000', 10),
    edgeCount: Number.parseInt(process.env.NOTE_CONNECTION_EVIDENCE_EDGE_COUNT || '1000000', 10),
    serial: String(process.env.NOTE_CONNECTION_ANDROID_SERIAL || '').trim(),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--skip-tauri-env') {
      options.skipTauriEnv = true;
      continue;
    }
    if (arg === '--skip-strict-fixrisk') {
      options.skipStrictFixrisk = true;
      continue;
    }
    if (arg === '--node-count' && argv[index + 1]) {
      options.nodeCount = Number.parseInt(argv[index + 1], 10);
      index += 1;
      continue;
    }
    if (arg === '--edge-count' && argv[index + 1]) {
      options.edgeCount = Number.parseInt(argv[index + 1], 10);
      index += 1;
      continue;
    }
    if (arg === '--serial' && argv[index + 1]) {
      options.serial = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
  }

  if (!Number.isFinite(options.nodeCount) || options.nodeCount < 10000) {
    options.nodeCount = 10000;
  }
  if (!Number.isFinite(options.edgeCount) || options.edgeCount < 1000000) {
    options.edgeCount = 1000000;
  }

  return options;
}

function ensureReportDir(targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
}

function runNodeScript(scriptPath, args, env) {
  const startedAtMs = Date.now();
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
    stdio: 'pipe'
  });
  const finishedAtMs = Date.now();

  return {
    ok: (result.status || 0) === 0,
    exitCode: typeof result.status === 'number' ? result.status : 1,
    durationMs: finishedAtMs - startedAtMs,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
    error: result.error ? String(result.error.message || result.error) : '',
  };
}

function printStepResult(stepName, result) {
  const prefix = `[Fixrisk Ops] ${stepName}`;
  if (result.ok) {
    console.log(`${prefix}: OK (${result.durationMs}ms)`);
  } else {
    console.error(`${prefix}: FAILED (${result.durationMs}ms, exit=${result.exitCode})`);
  }
}

function buildCommonEnv(options) {
  const env = {
    ...process.env,
    NOTE_CONNECTION_REQUIRE_LARGE_GRAPH_EVIDENCE: '1',
    NOTE_CONNECTION_MIN_EVIDENCE_NODE_COUNT: String(options.nodeCount),
    NOTE_CONNECTION_MIN_EVIDENCE_EDGE_COUNT: String(options.edgeCount),
    NOTE_CONNECTION_EVIDENCE_NODE_COUNT: String(options.nodeCount),
    NOTE_CONNECTION_EVIDENCE_EDGE_COUNT: String(options.edgeCount),
  };

  if (options.serial) {
    env.NOTE_CONNECTION_ANDROID_SERIAL = options.serial;
  }

  return env;
}

function trimOutput(text, maxLength = 2400) {
  const normalized = String(text || '').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}\n...[truncated ${normalized.length - maxLength} chars]`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const commonEnv = buildCommonEnv(options);
  const steps = [];
  const startedAt = new Date().toISOString();

  const plannedSteps = [];
  if (!options.skipTauriEnv) {
    plannedSteps.push({
      name: 'verify-tauri-android-prereqs',
      script: path.join(repoRoot, 'scripts', 'verify-tauri-android-prereqs.js'),
      args: [],
    });
  }
  plannedSteps.push(
    {
      name: 'verify-capacitor-device-acceptance',
      script: path.join(repoRoot, 'scripts', 'verify-capacitor-device-acceptance.js'),
      args: [],
    },
    {
      name: 'capture-capacitor-device-evidence',
      script: path.join(repoRoot, 'scripts', 'capture-capacitor-device-evidence.js'),
      args: [],
    },
    {
      name: 'verify-capacitor-evidence-freshness',
      script: path.join(repoRoot, 'scripts', 'verify-capacitor-evidence-freshness.js'),
      args: [],
    }
  );
  if (!options.skipStrictFixrisk) {
    plannedSteps.push({
      name: 'verify-fixrisk-issues-strict',
      script: path.join(repoRoot, 'scripts', 'verify-fixrisk-issues.js'),
      args: ['--strict-pending'],
    });
  }

  if (options.dryRun) {
    console.log('[Fixrisk Ops] Dry run enabled. Planned closure steps:');
    plannedSteps.forEach((step, index) => {
      console.log(`  ${index + 1}. ${path.relative(repoRoot, step.script).replace(/\\/g, '/')} ${step.args.join(' ')}`.trim());
    });
    const report = {
      generatedAt: startedAt,
      completedAt: new Date().toISOString(),
      dryRun: true,
      options,
      steps: plannedSteps.map((step) => ({
        name: step.name,
        script: path.relative(repoRoot, step.script).replace(/\\/g, '/'),
        args: step.args,
      })),
      ok: true,
    };
    ensureReportDir(reportPath);
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`[Fixrisk Ops] Report written: ${path.relative(repoRoot, reportPath).replace(/\\/g, '/')}`);
    process.exit(0);
  }

  for (const step of plannedSteps) {
    const result = runNodeScript(step.script, step.args, commonEnv);
    printStepResult(step.name, result);
    steps.push({
      name: step.name,
      script: path.relative(repoRoot, step.script).replace(/\\/g, '/'),
      args: step.args,
      ok: result.ok,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      stdout: trimOutput(result.stdout),
      stderr: trimOutput(result.stderr),
      error: trimOutput(result.error),
    });

    if (!result.ok) {
      const report = {
        generatedAt: startedAt,
        completedAt: new Date().toISOString(),
        dryRun: false,
        options,
        ok: false,
        failedStep: step.name,
        steps,
      };
      ensureReportDir(reportPath);
      fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
      console.error('[Fixrisk Ops] Closure sequence aborted due to failure.');
      console.error(`[Fixrisk Ops] Report written: ${path.relative(repoRoot, reportPath).replace(/\\/g, '/')}`);
      process.exit(result.exitCode || 1);
    }
  }

  const report = {
    generatedAt: startedAt,
    completedAt: new Date().toISOString(),
    dryRun: false,
    options,
    ok: true,
    steps,
  };
  ensureReportDir(reportPath);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log('[Fixrisk Ops] All closure steps completed successfully.');
  console.log(`[Fixrisk Ops] Report written: ${path.relative(repoRoot, reportPath).replace(/\\/g, '/')}`);
}

main();
