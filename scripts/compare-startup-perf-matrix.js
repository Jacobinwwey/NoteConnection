#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CHECKPOINT_ORDER = [
  'T0 app_boot',
  'T1 graph_preprocessed',
  'T2 worker_init_sent',
  'T3 first_tick_received',
  'T4 first_interactive_render',
  'T5 stable_layout',
];

const CHECKPOINT_BY_TAG = {
  T0: CHECKPOINT_ORDER[0],
  T1: CHECKPOINT_ORDER[1],
  T2: CHECKPOINT_ORDER[2],
  T3: CHECKPOINT_ORDER[3],
  T4: CHECKPOINT_ORDER[4],
  T5: CHECKPOINT_ORDER[5],
};

const METRIC_LABELS = {
  tti: 'TTI (T4-T0)',
  tfs: 'TFS (T5-T0)',
  t_data_prepare: 'T_data_prepare (T1-T0)',
  t_worker_init: 'T_worker_init (T2-T1)',
  t_tick_transfer: 'T_tick_transfer (T3-T2)',
  t_first_render: 'T_first_render (T4-T3)',
  t_settle: 'T_settle (T5-T4)',
};

const DEFAULT_MIN_TTI_IMPROVE = 30;
const DEFAULT_MIN_TFS_IMPROVE = 20;

function fail(message) {
  console.error(`[startup-perf-matrix] FAIL ${message}`);
  process.exit(1);
}

function warn(message) {
  console.warn(`[startup-perf-matrix] WARN ${message}`);
}

function parseArgs(argv) {
  const args = {
    root: 'tmp/startup-logs',
    out: '',
    format: 'markdown',
    minTtiImprove: DEFAULT_MIN_TTI_IMPROVE,
    minTfsImprove: DEFAULT_MIN_TFS_IMPROVE,
    singlePlatformLabel: 'default',
    strict: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === '--root' && next) {
      args.root = String(next).trim();
      i += 1;
      continue;
    }
    if (token.startsWith('--root=')) {
      args.root = String(token.slice('--root='.length)).trim();
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

    if (token === '--format' && next) {
      args.format = String(next).trim().toLowerCase();
      i += 1;
      continue;
    }
    if (token.startsWith('--format=')) {
      args.format = String(token.slice('--format='.length)).trim().toLowerCase();
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

    if (token === '--single-platform-label' && next) {
      args.singlePlatformLabel = String(next).trim() || 'default';
      i += 1;
      continue;
    }
    if (token.startsWith('--single-platform-label=')) {
      args.singlePlatformLabel = String(token.slice('--single-platform-label='.length)).trim() || 'default';
      continue;
    }

    if (token === '--strict') {
      args.strict = true;
      continue;
    }

    if (token === '--help' || token === '-h') {
      args.help = true;
      return args;
    }
  }

  return args;
}

function printHelp() {
  const text = [
    'Startup Perf Matrix Report (Multi-platform)',
    '',
    'Usage:',
    '  node scripts/compare-startup-perf-matrix.js [options]',
    '',
    'Default directory mode (recommended):',
    '  <root>/<platform>/baseline/*.log',
    '  <root>/<platform>/pilot/*.log',
    '',
    'Single-platform compatibility mode:',
    '  <root>/baseline/*.log',
    '  <root>/pilot/*.log',
    '',
    'Options:',
    '  --root <dir>                 Root directory (default: tmp/startup-logs)',
    '  --single-platform-label <s>  Label in single-platform mode (default: default)',
    `  --min-tti-improve <n>        TTI P50 gate threshold, percent (default: ${DEFAULT_MIN_TTI_IMPROVE})`,
    `  --min-tfs-improve <n>        TFS P50 gate threshold, percent (default: ${DEFAULT_MIN_TFS_IMPROVE})`,
    '  --format <markdown|json>     Output format (default: markdown)',
    '  --out <path>                 Write report to file',
    '  --strict                     Exit with code 1 when any platform gate fails',
  ];
  console.log(text.join('\n'));
}

function isLikelyTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ['.log', '.txt', '.md', '.json', '.ndjson', '.csv'].includes(ext);
}

function walkDirForLogs(dirPath, files) {
  if (!fs.existsSync(dirPath)) {
    return;
  }
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkDirForLogs(fullPath, files);
      continue;
    }
    if (entry.isFile() && isLikelyTextFile(fullPath)) {
      files.push(fullPath);
    }
  }
}

function normalizeCheckpointLabel(rawLabel) {
  const text = String(rawLabel || '').trim();
  const tagMatch = text.match(/^(T[0-5])\b/i);
  if (!tagMatch) {
    return null;
  }
  const tag = tagMatch[1].toUpperCase();
  return CHECKPOINT_BY_TAG[tag] || null;
}

function extractSessionsFromText(content, sourceFile) {
  const lines = String(content || '').split(/\r?\n/);
  const sessions = [];
  let current = null;

  const startupLinePattern = /\[Startup Perf\]\s*(T[0-5][^\+]*)\+([0-9]+(?:\.[0-9]+)?)ms/i;
  for (const line of lines) {
    const match = line.match(startupLinePattern);
    if (!match) {
      continue;
    }

    const checkpoint = normalizeCheckpointLabel(match[1]);
    const ms = Number(match[2]);
    if (!checkpoint || !Number.isFinite(ms)) {
      continue;
    }

    if (checkpoint === 'T0 app_boot') {
      if (current && Object.keys(current.checkpoints).length > 0) {
        sessions.push(current);
      }
      current = { sourceFile, checkpoints: {} };
    }

    if (!current) {
      current = { sourceFile, checkpoints: {} };
    }

    if (!Object.prototype.hasOwnProperty.call(current.checkpoints, checkpoint)) {
      current.checkpoints[checkpoint] = ms;
    }
  }

  if (current && Object.keys(current.checkpoints).length > 0) {
    sessions.push(current);
  }

  return sessions;
}

function parseSessionsFromFiles(files) {
  const sessions = [];
  for (const filePath of files) {
    let content = '';
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      warn(`Skip unreadable file: ${filePath} (${detail})`);
      continue;
    }
    sessions.push(...extractSessionsFromText(content, filePath));
  }
  return sessions;
}

function delta(checkpoints, fromKey, toKey) {
  const from = checkpoints[fromKey];
  const to = checkpoints[toKey];
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return null;
  }
  return to - from;
}

function deriveSessionMetrics(session) {
  const c = session.checkpoints;
  return {
    tti: delta(c, 'T0 app_boot', 'T4 first_interactive_render'),
    tfs: delta(c, 'T0 app_boot', 'T5 stable_layout'),
    t_data_prepare: delta(c, 'T0 app_boot', 'T1 graph_preprocessed'),
    t_worker_init: delta(c, 'T1 graph_preprocessed', 'T2 worker_init_sent'),
    t_tick_transfer: delta(c, 'T2 worker_init_sent', 'T3 first_tick_received'),
    t_first_render: delta(c, 'T3 first_tick_received', 'T4 first_interactive_render'),
    t_settle: delta(c, 'T4 first_interactive_render', 'T5 stable_layout'),
    checkpointCount: CHECKPOINT_ORDER.reduce(
      (count, key) => count + (Object.prototype.hasOwnProperty.call(c, key) ? 1 : 0),
      0
    ),
  };
}

function round2(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * 100) / 100;
}

function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  const index = Math.max(0, Math.min(sorted.length - 1, rank));
  return sorted[index];
}

function computeStats(values) {
  const safe = values.filter((item) => Number.isFinite(item));
  if (safe.length === 0) {
    return {
      count: 0,
      min: null,
      max: null,
      mean: null,
      p50: null,
      p95: null,
    };
  }
  const sorted = safe.slice().sort((a, b) => a - b);
  const sum = sorted.reduce((acc, item) => acc + item, 0);
  return {
    count: sorted.length,
    min: round2(sorted[0]),
    max: round2(sorted[sorted.length - 1]),
    mean: round2(sum / sorted.length),
    p50: round2(percentile(sorted, 50)),
    p95: round2(percentile(sorted, 95)),
  };
}

function buildGroupSummary(files, sessions) {
  const metricKeys = Object.keys(METRIC_LABELS);
  const buckets = Object.fromEntries(metricKeys.map((key) => [key, []]));
  let completeSessionCount = 0;

  const derivedSessions = sessions.map((session) => {
    const metrics = deriveSessionMetrics(session);
    if (metrics.checkpointCount === CHECKPOINT_ORDER.length) {
      completeSessionCount += 1;
    }
    metricKeys.forEach((metricKey) => {
      if (Number.isFinite(metrics[metricKey])) {
        buckets[metricKey].push(metrics[metricKey]);
      }
    });
    return {
      sourceFile: session.sourceFile,
      ...metrics,
    };
  });

  const stats = {};
  metricKeys.forEach((metricKey) => {
    stats[metricKey] = computeStats(buckets[metricKey]);
  });

  return {
    files,
    sessions: derivedSessions,
    sessionCount: derivedSessions.length,
    completeSessionCount,
    stats,
  };
}

function improvementPercent(baseline, pilot) {
  if (!Number.isFinite(baseline) || baseline <= 0 || !Number.isFinite(pilot)) {
    return null;
  }
  return round2(((baseline - pilot) / baseline) * 100);
}

function buildPlatformResult(platformName, baselineSummary, pilotSummary, thresholds) {
  const metricComparison = {};
  for (const metricKey of Object.keys(METRIC_LABELS)) {
    const baselineStats = baselineSummary.stats[metricKey];
    const pilotStats = pilotSummary.stats[metricKey];
    metricComparison[metricKey] = {
      baseline: baselineStats,
      pilot: pilotStats,
      p50ImprovePct: improvementPercent(baselineStats.p50, pilotStats.p50),
      p95ImprovePct: improvementPercent(baselineStats.p95, pilotStats.p95),
    };
  }

  const ttiImprove = metricComparison.tti.p50ImprovePct;
  const tfsImprove = metricComparison.tfs.p50ImprovePct;
  const gates = {
    ttiP50: {
      threshold: thresholds.minTtiImprove,
      improvement: ttiImprove,
      pass: Number.isFinite(ttiImprove) ? ttiImprove >= thresholds.minTtiImprove : false,
    },
    tfsP50: {
      threshold: thresholds.minTfsImprove,
      improvement: tfsImprove,
      pass: Number.isFinite(tfsImprove) ? tfsImprove >= thresholds.minTfsImprove : false,
    },
  };

  return {
    platform: platformName,
    baseline: baselineSummary,
    pilot: pilotSummary,
    metrics: metricComparison,
    gates,
    gatePass: gates.ttiP50.pass && gates.tfsP50.pass,
  };
}

function discoverPlatformDirs(rootDir, singlePlatformLabel) {
  const baselineRoot = path.join(rootDir, 'baseline');
  const pilotRoot = path.join(rootDir, 'pilot');
  if (fs.existsSync(baselineRoot) && fs.existsSync(pilotRoot)) {
    return [
      {
        name: singlePlatformLabel || 'default',
        baselineDir: baselineRoot,
        pilotDir: pilotRoot,
      },
    ];
  }

  const entries = fs.existsSync(rootDir)
    ? fs.readdirSync(rootDir, { withFileTypes: true }).filter((entry) => entry.isDirectory())
    : [];
  const platforms = [];
  for (const entry of entries) {
    const platformDir = path.join(rootDir, entry.name);
    const baselineDir = path.join(platformDir, 'baseline');
    const pilotDir = path.join(platformDir, 'pilot');
    if (fs.existsSync(baselineDir) && fs.existsSync(pilotDir)) {
      platforms.push({
        name: entry.name,
        baselineDir,
        pilotDir,
      });
    }
  }
  return platforms;
}

function numCell(value, suffix = '') {
  if (!Number.isFinite(value)) return 'n/a';
  return `${value.toFixed(2)}${suffix}`;
}

function buildMarkdownReport(report) {
  const lines = [
    '# Startup Perf Platform Matrix Report',
    '',
    `Generated at: ${report.generatedAt}`,
    `Root: ${report.root}`,
    '',
    '## Platform Gate Summary',
    '| Platform | Baseline Sessions | Pilot Sessions | TTI P50 Improve | TFS P50 Improve | Gate |',
    '|---|---:|---:|---:|---:|---|',
  ];

  for (const platform of report.platforms) {
    lines.push(
      `| ${platform.platform} | ${platform.baseline.sessionCount} | ${platform.pilot.sessionCount} | ` +
        `${numCell(platform.gates.ttiP50.improvement, '%')} | ${numCell(platform.gates.tfsP50.improvement, '%')} | ` +
        `${platform.gatePass ? 'PASS' : 'FAIL'} |`
    );
  }

  lines.push('');
  lines.push('## KPI Comparison by Platform (P50/P95)');
  for (const platform of report.platforms) {
    lines.push('');
    lines.push(`### ${platform.platform}`);
    lines.push('| Metric | Baseline P50 (ms) | Pilot P50 (ms) | P50 Improve | Baseline P95 (ms) | Pilot P95 (ms) | P95 Improve |');
    lines.push('|---|---:|---:|---:|---:|---:|---:|');
    for (const metricKey of Object.keys(METRIC_LABELS)) {
      const metric = platform.metrics[metricKey];
      lines.push(
        `| ${METRIC_LABELS[metricKey]} | ${numCell(metric.baseline.p50)} | ${numCell(metric.pilot.p50)} | ` +
          `${numCell(metric.p50ImprovePct, '%')} | ${numCell(metric.baseline.p95)} | ${numCell(metric.pilot.p95)} | ${numCell(metric.p95ImprovePct, '%')} |`
      );
    }
  }

  lines.push('');
  lines.push('## Overall');
  lines.push(`- Platforms analyzed: ${report.platforms.length}`);
  lines.push(`- Overall gate: ${report.allPass ? 'PASS' : 'FAIL'}`);
  lines.push(`- Gate thresholds: TTI P50 >= ${report.thresholds.minTtiImprove}%, TFS P50 >= ${report.thresholds.minTfsImprove}%`);
  lines.push('- Recommendation: collect >=10 sessions per platform cohort before release-go decisions.');

  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (!['markdown', 'json'].includes(args.format)) {
    fail(`Unsupported format "${args.format}". Use markdown or json.`);
  }
  if (!Number.isFinite(args.minTtiImprove) || !Number.isFinite(args.minTfsImprove)) {
    fail('Threshold arguments must be numeric.');
  }

  const rootDir = path.resolve(process.cwd(), args.root);
  if (!fs.existsSync(rootDir)) {
    fail(`Root path does not exist: ${rootDir}`);
  }

  const platformDirs = discoverPlatformDirs(rootDir, args.singlePlatformLabel);
  if (platformDirs.length === 0) {
    fail('No valid platform directories found. Expect <root>/<platform>/baseline|pilot or <root>/baseline|pilot.');
  }

  const platformResults = [];
  for (const platformDir of platformDirs) {
    const baselineFiles = [];
    const pilotFiles = [];
    walkDirForLogs(platformDir.baselineDir, baselineFiles);
    walkDirForLogs(platformDir.pilotDir, pilotFiles);

    if (baselineFiles.length === 0 || pilotFiles.length === 0) {
      warn(`Skip platform "${platformDir.name}" due to empty baseline/pilot files.`);
      continue;
    }

    const baselineSessions = parseSessionsFromFiles(baselineFiles);
    const pilotSessions = parseSessionsFromFiles(pilotFiles);
    if (baselineSessions.length === 0 || pilotSessions.length === 0) {
      warn(`Skip platform "${platformDir.name}" due to no parsable sessions.`);
      continue;
    }

    const baselineSummary = buildGroupSummary(baselineFiles, baselineSessions);
    const pilotSummary = buildGroupSummary(pilotFiles, pilotSessions);
    platformResults.push(
      buildPlatformResult(platformDir.name, baselineSummary, pilotSummary, {
        minTtiImprove: args.minTtiImprove,
        minTfsImprove: args.minTfsImprove,
      })
    );
  }

  if (platformResults.length === 0) {
    fail('No platform result generated.');
  }

  const report = {
    generatedAt: new Date().toISOString(),
    root: rootDir,
    thresholds: {
      minTtiImprove: args.minTtiImprove,
      minTfsImprove: args.minTfsImprove,
    },
    platforms: platformResults,
    allPass: platformResults.every((item) => item.gatePass),
  };

  const output = args.format === 'json'
    ? JSON.stringify(report, null, 2)
    : buildMarkdownReport(report);

  if (args.out) {
    const outPath = path.resolve(process.cwd(), args.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, output, 'utf8');
    console.log(`[startup-perf-matrix] Report written: ${outPath}`);
  } else {
    console.log(output);
  }

  console.log(
    `[startup-perf-matrix] Summary: platforms=${platformResults.length}, ` +
      `overallGate=${report.allPass ? 'PASS' : 'FAIL'}`
  );

  if (args.strict && !report.allPass) {
    process.exit(1);
  }
}

main();
