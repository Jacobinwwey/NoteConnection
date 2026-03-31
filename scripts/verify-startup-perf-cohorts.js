#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function fail(message) {
  console.error(`[startup-perf-cohorts] FAIL ${message}`);
  process.exit(1);
}

function warn(message) {
  console.warn(`[startup-perf-cohorts] WARN ${message}`);
}

function parseArgs(argv) {
  const args = {
    root: 'tmp/startup-logs-cohorts',
    cohorts: ['small', 'medium', 'large'],
    out: '',
    minTtiImprove: 30,
    minTfsImprove: 20,
    minSessionsPerPlatform: 10,
    strict: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === '--root' && next) {
      args.root = String(next).trim();
      index += 1;
      continue;
    }
    if (token.startsWith('--root=')) {
      args.root = String(token.slice('--root='.length)).trim();
      continue;
    }

    if (token === '--cohorts' && next) {
      args.cohorts = String(next)
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      index += 1;
      continue;
    }
    if (token.startsWith('--cohorts=')) {
      args.cohorts = String(token.slice('--cohorts='.length))
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      continue;
    }

    if (token === '--out' && next) {
      args.out = String(next).trim();
      index += 1;
      continue;
    }
    if (token.startsWith('--out=')) {
      args.out = String(token.slice('--out='.length)).trim();
      continue;
    }

    if (token === '--min-tti-improve' && next) {
      args.minTtiImprove = Number(next);
      index += 1;
      continue;
    }
    if (token.startsWith('--min-tti-improve=')) {
      args.minTtiImprove = Number(token.slice('--min-tti-improve='.length));
      continue;
    }

    if (token === '--min-tfs-improve' && next) {
      args.minTfsImprove = Number(next);
      index += 1;
      continue;
    }
    if (token.startsWith('--min-tfs-improve=')) {
      args.minTfsImprove = Number(token.slice('--min-tfs-improve='.length));
      continue;
    }

    if (token === '--min-sessions-per-platform' && next) {
      args.minSessionsPerPlatform = Number(next);
      index += 1;
      continue;
    }
    if (token.startsWith('--min-sessions-per-platform=')) {
      args.minSessionsPerPlatform = Number(token.slice('--min-sessions-per-platform='.length));
      continue;
    }

    if (token === '--strict') {
      args.strict = true;
      continue;
    }
  }

  return args;
}

function runMatrixForCohort(rootDir, cohortName, args) {
  const cohortRoot = path.join(rootDir, cohortName);
  if (!fs.existsSync(cohortRoot)) {
    return {
      cohort: cohortName,
      exists: false,
      error: `Missing cohort directory: ${cohortRoot}`
    };
  }

  const tempJsonPath = path.join(rootDir, `.cohort-${cohortName}-matrix.json`);
  const matrixScript = path.resolve(__dirname, 'compare-startup-perf-matrix.js');
  const matrixResult = spawnSync(
    process.execPath,
    [
      matrixScript,
      '--root',
      cohortRoot,
      '--format',
      'json',
      '--out',
      tempJsonPath,
      '--min-tti-improve',
      String(args.minTtiImprove),
      '--min-tfs-improve',
      String(args.minTfsImprove)
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8'
    }
  );

  if (matrixResult.stdout && matrixResult.stdout.trim().length > 0) {
    console.log(matrixResult.stdout.trim());
  }
  if (matrixResult.stderr && matrixResult.stderr.trim().length > 0) {
    console.error(matrixResult.stderr.trim());
  }

  if (matrixResult.status !== 0) {
    return {
      cohort: cohortName,
      exists: true,
      error: `Matrix run failed with exit code ${matrixResult.status}`
    };
  }

  if (!fs.existsSync(tempJsonPath)) {
    return {
      cohort: cohortName,
      exists: true,
      error: `Missing matrix json output: ${tempJsonPath}`
    };
  }

  let parsed = null;
  try {
    parsed = JSON.parse(fs.readFileSync(tempJsonPath, 'utf8'));
  } catch (error) {
    return {
      cohort: cohortName,
      exists: true,
      error: `Invalid matrix json: ${error instanceof Error ? error.message : String(error)}`
    };
  } finally {
    try {
      fs.unlinkSync(tempJsonPath);
    } catch {
      // Ignore temp cleanup failures.
    }
  }

  const minSessions = Math.max(1, Math.floor(args.minSessionsPerPlatform));
  const sessionFloorPass = Array.isArray(parsed.platforms) && parsed.platforms.every((platform) => (
    Number(platform?.baseline?.sessionCount || 0) >= minSessions &&
    Number(platform?.pilot?.sessionCount || 0) >= minSessions
  ));

  return {
    cohort: cohortName,
    exists: true,
    root: cohortRoot,
    matrix: parsed,
    sessionFloorPass,
    gatePass: Boolean(parsed.allPass) && sessionFloorPass
  };
}

function buildMarkdownReport(summary, args) {
  const lines = [
    '# Startup Perf Cohort Verification Report',
    '',
    `Generated at: ${summary.generatedAt}`,
    `Root: ${summary.root}`,
    '',
    '## Cohort Gate Summary',
    '| Cohort | Platforms | Matrix Gate | Session Floor Gate | Overall |',
    '|---|---:|---|---|---|'
  ];

  for (const item of summary.cohorts) {
    if (!item.exists) {
      lines.push(`| ${item.cohort} | 0 | FAIL | FAIL | FAIL |`);
      continue;
    }
    if (item.error) {
      lines.push(`| ${item.cohort} | 0 | FAIL | FAIL | FAIL |`);
      continue;
    }
    const platformCount = Array.isArray(item.matrix.platforms) ? item.matrix.platforms.length : 0;
    const matrixGate = item.matrix.allPass ? 'PASS' : 'FAIL';
    const sessionGate = item.sessionFloorPass ? 'PASS' : 'FAIL';
    const overall = item.gatePass ? 'PASS' : 'FAIL';
    lines.push(`| ${item.cohort} | ${platformCount} | ${matrixGate} | ${sessionGate} | ${overall} |`);
  }

  lines.push('');
  lines.push('## Cohort Details');
  for (const item of summary.cohorts) {
    lines.push('');
    lines.push(`### ${item.cohort}`);
    if (!item.exists) {
      lines.push(`- Status: FAIL (${item.error})`);
      continue;
    }
    if (item.error) {
      lines.push(`- Status: FAIL (${item.error})`);
      continue;
    }
    lines.push(`- Cohort root: ${item.root}`);
    lines.push(`- Matrix gate: ${item.matrix.allPass ? 'PASS' : 'FAIL'}`);
    lines.push(`- Session floor gate (>=${args.minSessionsPerPlatform} per platform baseline/pilot): ${item.sessionFloorPass ? 'PASS' : 'FAIL'}`);
    lines.push('| Platform | Baseline Sessions | Pilot Sessions | TTI P50 Improve | TFS P50 Improve | Gate |');
    lines.push('|---|---:|---:|---:|---:|---|');
    for (const platform of item.matrix.platforms) {
      const tti = Number(platform?.gates?.ttiP50?.improvement);
      const tfs = Number(platform?.gates?.tfsP50?.improvement);
      const ttiText = Number.isFinite(tti) ? `${tti.toFixed(2)}%` : 'n/a';
      const tfsText = Number.isFinite(tfs) ? `${tfs.toFixed(2)}%` : 'n/a';
      lines.push(
        `| ${platform.platform} | ${platform.baseline.sessionCount} | ${platform.pilot.sessionCount} | ${ttiText} | ${tfsText} | ${platform.gatePass ? 'PASS' : 'FAIL'} |`
      );
    }
  }

  lines.push('');
  lines.push('## Overall');
  lines.push(`- Cohorts checked: ${summary.cohorts.length}`);
  lines.push(`- Overall gate: ${summary.allPass ? 'PASS' : 'FAIL'}`);
  lines.push(`- Matrix thresholds: TTI P50 >= ${args.minTtiImprove}%, TFS P50 >= ${args.minTfsImprove}%`);
  lines.push(`- Session floor: baseline/pilot >= ${args.minSessionsPerPlatform} sessions per platform per cohort`);

  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!Number.isFinite(args.minTtiImprove) || !Number.isFinite(args.minTfsImprove)) {
    fail('Threshold arguments must be numeric.');
  }
  if (!Number.isFinite(args.minSessionsPerPlatform) || args.minSessionsPerPlatform <= 0) {
    fail('min-sessions-per-platform must be a positive integer.');
  }
  if (!Array.isArray(args.cohorts) || args.cohorts.length === 0) {
    fail('No cohorts provided.');
  }

  const rootDir = path.resolve(process.cwd(), args.root);
  if (!fs.existsSync(rootDir)) {
    fail(`Root path does not exist: ${rootDir}`);
  }

  const cohortResults = args.cohorts.map((cohortName) => runMatrixForCohort(rootDir, cohortName, args));
  for (const result of cohortResults) {
    if (result.error) {
      warn(`${result.cohort}: ${result.error}`);
    }
  }

  const allPass = cohortResults.every((result) => result.exists && !result.error && result.gatePass);
  const summary = {
    generatedAt: new Date().toISOString(),
    root: rootDir,
    cohorts: cohortResults,
    allPass
  };

  const markdown = buildMarkdownReport(summary, args);
  if (args.out && args.out.trim().length > 0) {
    const outPath = path.resolve(process.cwd(), args.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, markdown, 'utf8');
    console.log(`[startup-perf-cohorts] Report written: ${outPath}`);
  } else {
    console.log(markdown);
  }

  console.log(`[startup-perf-cohorts] Summary: cohorts=${cohortResults.length}, overallGate=${allPass ? 'PASS' : 'FAIL'}`);
  if (args.strict && !allPass) {
    process.exit(1);
  }
}

main();
