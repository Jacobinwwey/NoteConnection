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
  console.error(`[startup-perf-compare] FAIL ${message}`);
  process.exit(1);
}

function warn(message) {
  console.warn(`[startup-perf-compare] WARN ${message}`);
}

function normalizePathList(rawValue) {
  if (!rawValue) {
    return [];
  }
  return String(rawValue)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const args = {
    baseline: [],
    pilot: [],
    format: 'markdown',
    out: '',
    minTtiImprove: DEFAULT_MIN_TTI_IMPROVE,
    minTfsImprove: DEFAULT_MIN_TFS_IMPROVE,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === '--baseline' && next) {
      args.baseline.push(...normalizePathList(next));
      i += 1;
      continue;
    }
    if (token.startsWith('--baseline=')) {
      args.baseline.push(...normalizePathList(token.slice('--baseline='.length)));
      continue;
    }

    if (token === '--pilot' && next) {
      args.pilot.push(...normalizePathList(next));
      i += 1;
      continue;
    }
    if (token.startsWith('--pilot=')) {
      args.pilot.push(...normalizePathList(token.slice('--pilot='.length)));
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

    if (token === '--help' || token === '-h') {
      return { ...args, help: true };
    }
  }

  return args;
}

function printHelp() {
  const lines = [
    'Startup Perf Log Compare (P50/P95)',
    '',
    'Usage:',
    '  node scripts/compare-startup-perf.js --baseline <path[,path2,...]> --pilot <path[,path2,...]> [options]',
    '',
    'Required:',
    '  --baseline    Baseline group logs (file or directory; comma-separated supported)',
    '  --pilot       Pilot group logs (file or directory; comma-separated supported)',
    '',
    'Options:',
    `  --min-tti-improve <n>  Target improvement (%) for TTI P50 (default: ${DEFAULT_MIN_TTI_IMPROVE})`,
    `  --min-tfs-improve <n>  Target improvement (%) for TFS P50 (default: ${DEFAULT_MIN_TFS_IMPROVE})`,
    '  --format <markdown|json>  Output format (default: markdown)',
    '  --out <path>            Write report to file (optional)',
    '',
    'Example:',
    '  node scripts/compare-startup-perf.js --baseline tmp/logs/baseline --pilot tmp/logs/pilot --out tmp/startup-compare.md',
  ];
  console.log(lines.join('\n'));
}

function isLikelyTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!ext) return false;
  return ['.log', '.txt', '.md', '.json', '.ndjson', '.csv'].includes(ext);
}

function walkDirForLogs(dirPath, files) {
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

function collectInputFiles(rawItems) {
  const files = [];
  for (const item of rawItems) {
    const resolved = path.resolve(process.cwd(), item);
    if (!fs.existsSync(resolved)) {
      warn(`Input path does not exist, skipped: ${resolved}`);
      continue;
    }

    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      walkDirForLogs(resolved, files);
      continue;
    }

    if (stat.isFile()) {
      files.push(resolved);
    }
  }
  return Array.from(new Set(files));
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

    const rawLabel = match[1];
    const ms = Number(match[2]);
    if (!Number.isFinite(ms)) {
      continue;
    }

    const checkpoint = normalizeCheckpointLabel(rawLabel);
    if (!checkpoint) {
      continue;
    }

    if (checkpoint === CHECKPOINT_ORDER[0]) {
      if (current && Object.keys(current.checkpoints).length > 0) {
        sessions.push(current);
      }
      current = {
        sourceFile,
        checkpoints: {},
      };
    }

    if (!current) {
      current = {
        sourceFile,
        checkpoints: {},
      };
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
      warn(`Failed to read file, skipped: ${filePath} (${detail})`);
      continue;
    }
    sessions.push(...extractSessionsFromText(content, filePath));
  }
  return sessions;
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function delta(checkpoints, fromKey, toKey) {
  if (!Object.prototype.hasOwnProperty.call(checkpoints, fromKey)) return null;
  if (!Object.prototype.hasOwnProperty.call(checkpoints, toKey)) return null;
  const from = checkpoints[fromKey];
  const to = checkpoints[toKey];
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return to - from;
}

function deriveSessionMetrics(session) {
  const c = session.checkpoints;
  return {
    tti: finiteOrNull(delta(c, 'T0 app_boot', 'T4 first_interactive_render')),
    tfs: finiteOrNull(delta(c, 'T0 app_boot', 'T5 stable_layout')),
    t_data_prepare: finiteOrNull(delta(c, 'T0 app_boot', 'T1 graph_preprocessed')),
    t_worker_init: finiteOrNull(delta(c, 'T1 graph_preprocessed', 'T2 worker_init_sent')),
    t_tick_transfer: finiteOrNull(delta(c, 'T2 worker_init_sent', 'T3 first_tick_received')),
    t_first_render: finiteOrNull(delta(c, 'T3 first_tick_received', 'T4 first_interactive_render')),
    t_settle: finiteOrNull(delta(c, 'T4 first_interactive_render', 'T5 stable_layout')),
    checkpointCount: CHECKPOINT_ORDER.reduce(
      (count, key) => count + (Object.prototype.hasOwnProperty.call(c, key) ? 1 : 0),
      0
    ),
  };
}

function round2(value) {
  if (!Number.isFinite(value)) return null;
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
  const safe = values.filter((value) => Number.isFinite(value));
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

function buildGroupSummary(groupName, files, sessions) {
  const metricBuckets = {
    tti: [],
    tfs: [],
    t_data_prepare: [],
    t_worker_init: [],
    t_tick_transfer: [],
    t_first_render: [],
    t_settle: [],
  };

  let completeSessionCount = 0;
  const derivedSessions = sessions.map((session) => {
    const metrics = deriveSessionMetrics(session);
    const hasComplete = metrics.checkpointCount === CHECKPOINT_ORDER.length;
    if (hasComplete) {
      completeSessionCount += 1;
    }
    Object.keys(metricBuckets).forEach((metricKey) => {
      if (Number.isFinite(metrics[metricKey])) {
        metricBuckets[metricKey].push(metrics[metricKey]);
      }
    });
    return {
      sourceFile: session.sourceFile,
      ...metrics,
    };
  });

  const stats = {};
  Object.keys(metricBuckets).forEach((metricKey) => {
    stats[metricKey] = computeStats(metricBuckets[metricKey]);
  });

  return {
    name: groupName,
    files,
    sessions: derivedSessions,
    sessionCount: derivedSessions.length,
    completeSessionCount,
    stats,
  };
}

function improvementPercent(baseline, candidate) {
  if (!Number.isFinite(baseline) || baseline <= 0 || !Number.isFinite(candidate)) {
    return null;
  }
  return round2(((baseline - candidate) / baseline) * 100);
}

function buildComparison(baselineGroup, pilotGroup, thresholds) {
  const comparison = {};
  for (const metricKey of Object.keys(METRIC_LABELS)) {
    const baselineStats = baselineGroup.stats[metricKey];
    const pilotStats = pilotGroup.stats[metricKey];
    comparison[metricKey] = {
      baseline: baselineStats,
      pilot: pilotStats,
      p50ImprovePct: improvementPercent(baselineStats.p50, pilotStats.p50),
      p95ImprovePct: improvementPercent(baselineStats.p95, pilotStats.p95),
    };
  }

  const ttiP50Improve = comparison.tti.p50ImprovePct;
  const tfsP50Improve = comparison.tfs.p50ImprovePct;
  const gates = {
    ttiP50: {
      threshold: thresholds.minTtiImprove,
      improvement: ttiP50Improve,
      pass: Number.isFinite(ttiP50Improve) ? ttiP50Improve >= thresholds.minTtiImprove : false,
    },
    tfsP50: {
      threshold: thresholds.minTfsImprove,
      improvement: tfsP50Improve,
      pass: Number.isFinite(tfsP50Improve) ? tfsP50Improve >= thresholds.minTfsImprove : false,
    },
  };

  return {
    comparison,
    gates,
  };
}

function numCell(value, suffix = '') {
  if (!Number.isFinite(value)) return 'n/a';
  return `${value.toFixed(2)}${suffix}`;
}

function buildComparisonTableRows(comp) {
  return [
    ['tti', METRIC_LABELS.tti],
    ['tfs', METRIC_LABELS.tfs],
    ['t_data_prepare', METRIC_LABELS.t_data_prepare],
    ['t_worker_init', METRIC_LABELS.t_worker_init],
    ['t_tick_transfer', METRIC_LABELS.t_tick_transfer],
    ['t_first_render', METRIC_LABELS.t_first_render],
    ['t_settle', METRIC_LABELS.t_settle],
  ].map(([metricKey, label]) => {
    const row = comp[metricKey];
    return `| ${label} | ${numCell(row.baseline.p50)} | ${numCell(row.pilot.p50)} | ${numCell(row.p50ImprovePct, '%')} | ${numCell(row.baseline.p95)} | ${numCell(row.pilot.p95)} | ${numCell(row.p95ImprovePct, '%')} |`;
  });
}

function buildGroupStatsRows(group) {
  return Object.keys(METRIC_LABELS).map((metricKey) => {
    const stats = group.stats[metricKey];
    return `| ${METRIC_LABELS[metricKey]} | ${stats.count} | ${numCell(stats.p50)} | ${numCell(stats.p95)} | ${numCell(stats.mean)} | ${numCell(stats.min)} | ${numCell(stats.max)} |`;
  });
}

function buildMarkdownReport(report) {
  const baseline = report.baseline;
  const pilot = report.pilot;
  const comp = report.compare.comparison;
  const gates = report.compare.gates;
  const generatedAt = report.generatedAt;

  const lines = [
    '# Startup Perf Compare Report',
    '',
    `Generated at: ${generatedAt}`,
    '',
    '## Input Summary',
    `- Baseline files: ${baseline.files.length}`,
    `- Baseline sessions parsed: ${baseline.sessionCount} (complete: ${baseline.completeSessionCount})`,
    `- Pilot files: ${pilot.files.length}`,
    `- Pilot sessions parsed: ${pilot.sessionCount} (complete: ${pilot.completeSessionCount})`,
    '',
    '## KPI Comparison (P50/P95)',
    '| Metric | Baseline P50 (ms) | Pilot P50 (ms) | P50 Improve | Baseline P95 (ms) | Pilot P95 (ms) | P95 Improve |',
    '|---|---:|---:|---:|---:|---:|---:|',
    ...buildComparisonTableRows(comp),
    '',
    '## Gate Check',
    `- TTI P50 improvement >= ${gates.ttiP50.threshold}%: ${gates.ttiP50.pass ? 'PASS' : 'FAIL'} (${numCell(gates.ttiP50.improvement, '%')})`,
    `- TFS P50 improvement >= ${gates.tfsP50.threshold}%: ${gates.tfsP50.pass ? 'PASS' : 'FAIL'} (${numCell(gates.tfsP50.improvement, '%')})`,
    '',
    '## Baseline Detail',
    '| Metric | Count | P50 (ms) | P95 (ms) | Mean (ms) | Min (ms) | Max (ms) |',
    '|---|---:|---:|---:|---:|---:|---:|',
    ...buildGroupStatsRows(baseline),
    '',
    '## Pilot Detail',
    '| Metric | Count | P50 (ms) | P95 (ms) | Mean (ms) | Min (ms) | Max (ms) |',
    '|---|---:|---:|---:|---:|---:|---:|',
    ...buildGroupStatsRows(pilot),
    '',
    '## Notes',
    '- Input parser extracts `[Startup Perf] T* ... +Xms` lines and auto-splits sessions by `T0 app_boot`.',
    '- Use at least 10 startup sessions per group for stable P95 decisions.',
  ];

  return lines.join('\n');
}

function buildJsonReport(report) {
  return JSON.stringify(report, null, 2);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (!['markdown', 'json'].includes(args.format)) {
    fail(`Unsupported --format "${args.format}". Use "markdown" or "json".`);
  }

  if (args.baseline.length === 0 || args.pilot.length === 0) {
    printHelp();
    fail('Both --baseline and --pilot are required.');
  }

  if (!Number.isFinite(args.minTtiImprove) || !Number.isFinite(args.minTfsImprove)) {
    fail('--min-tti-improve and --min-tfs-improve must be numbers.');
  }

  const baselineFiles = collectInputFiles(args.baseline);
  const pilotFiles = collectInputFiles(args.pilot);
  if (baselineFiles.length === 0) {
    fail('No readable baseline files found.');
  }
  if (pilotFiles.length === 0) {
    fail('No readable pilot files found.');
  }

  const baselineSessions = parseSessionsFromFiles(baselineFiles);
  const pilotSessions = parseSessionsFromFiles(pilotFiles);
  if (baselineSessions.length === 0) {
    fail('No startup sessions parsed from baseline logs.');
  }
  if (pilotSessions.length === 0) {
    fail('No startup sessions parsed from pilot logs.');
  }

  const baseline = buildGroupSummary('baseline', baselineFiles, baselineSessions);
  const pilot = buildGroupSummary('pilot', pilotFiles, pilotSessions);
  const compare = buildComparison(baseline, pilot, {
    minTtiImprove: args.minTtiImprove,
    minTfsImprove: args.minTfsImprove,
  });

  const report = {
    generatedAt: new Date().toISOString(),
    thresholds: {
      minTtiImprove: args.minTtiImprove,
      minTfsImprove: args.minTfsImprove,
    },
    baseline,
    pilot,
    compare,
  };

  const output = args.format === 'json' ? buildJsonReport(report) : buildMarkdownReport(report);
  if (args.out) {
    const outPath = path.resolve(process.cwd(), args.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, output, 'utf8');
    console.log(`[startup-perf-compare] Report written: ${outPath}`);
  } else {
    console.log(output);
  }

  const gateAllPass = report.compare.gates.ttiP50.pass && report.compare.gates.tfsP50.pass;
  console.log(
    `[startup-perf-compare] Summary: baselineSessions=${baseline.sessionCount}, ` +
      `pilotSessions=${pilot.sessionCount}, gates=${gateAllPass ? 'PASS' : 'FAIL'}`
  );
}

main();
