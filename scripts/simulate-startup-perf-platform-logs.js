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

const DEFAULT_PLATFORMS = [
  { name: 'macos', baselineFactor: 1.08, pilotFactor: 0.82 },
  { name: 'android', baselineFactor: 1.35, pilotFactor: 0.96 },
  { name: 'ios', baselineFactor: 1.42, pilotFactor: 1.01 },
];

function fail(message) {
  console.error(`[startup-perf-sim] FAIL ${message}`);
  process.exit(1);
}

function warn(message) {
  console.warn(`[startup-perf-sim] WARN ${message}`);
}

function parseArgs(argv) {
  const args = {
    seedRoot: 'tmp/startup-logs',
    outRoot: 'tmp/startup-logs-simulated',
    sessionsPerPlatform: 12,
    noisePct: 0.05,
    seed: 20260331,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === '--seed-root' && next) {
      args.seedRoot = String(next).trim();
      i += 1;
      continue;
    }
    if (token.startsWith('--seed-root=')) {
      args.seedRoot = String(token.slice('--seed-root='.length)).trim();
      continue;
    }

    if (token === '--out-root' && next) {
      args.outRoot = String(next).trim();
      i += 1;
      continue;
    }
    if (token.startsWith('--out-root=')) {
      args.outRoot = String(token.slice('--out-root='.length)).trim();
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

    if (token === '--noise-pct' && next) {
      args.noisePct = Number(next);
      i += 1;
      continue;
    }
    if (token.startsWith('--noise-pct=')) {
      args.noisePct = Number(token.slice('--noise-pct='.length));
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
  }

  return args;
}

function makeRng(seedValue) {
  let seed = (Number(seedValue) >>> 0) || 1;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function normalizeCheckpointLabel(rawLabel) {
  const text = String(rawLabel || '').trim();
  const tagMatch = text.match(/^(T[0-5])\b/i);
  if (!tagMatch) {
    return null;
  }
  const tag = tagMatch[1].toUpperCase();
  return CHECKPOINT_ORDER.find((label) => label.startsWith(`${tag} `)) || null;
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

function parseSessionsFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`Seed file not found: ${filePath}`);
  }
  const text = fs.readFileSync(filePath, 'utf8');
  const sessions = extractSessionsFromText(text, filePath);
  const complete = sessions.filter((session) =>
    CHECKPOINT_ORDER.every((key) => Number.isFinite(session.checkpoints[key]))
  );
  if (complete.length === 0) {
    fail(`No complete startup sessions found in seed file: ${filePath}`);
  }
  return complete;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function mutateSession(baseSession, factor, noisePct, random01) {
  const next = {};
  let previous = null;

  for (const key of CHECKPOINT_ORDER) {
    const baseValue = Number(baseSession.checkpoints[key]);
    const noise = (random01() * 2 - 1) * noisePct;
    const scaled = baseValue * factor * (1 + noise);
    let value = round2(Math.max(0, scaled));
    if (previous !== null && value <= previous) {
      value = round2(previous + 1 + random01() * 4);
    }
    next[key] = value;
    previous = value;
  }
  return next;
}

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function writeSessionLog(filePath, platformName, groupName, sessions, metadata) {
  const lines = [];
  lines.push(`# Simulated startup perf log`);
  lines.push(`# platform=${platformName}`);
  lines.push(`# cohort=${groupName}`);
  lines.push(`# note=SIMULATED_DATA_FOR_PIPELINE_VALIDATION_ONLY`);
  lines.push(`# seed=${metadata.seed}`);
  lines.push(`# noisePct=${metadata.noisePct}`);
  lines.push('');

  for (let i = 0; i < sessions.length; i += 1) {
    const session = sessions[i];
    lines.push(`[Startup Perf] Session#${i + 1} platform=${platformName} cohort=${groupName}`);
    for (const checkpoint of CHECKPOINT_ORDER) {
      const value = Number(session[checkpoint]);
      lines.push(`[Startup Perf] ${checkpoint} +${value.toFixed(2)}ms`);
    }
    lines.push('');
  }

  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!Number.isFinite(args.sessionsPerPlatform) || args.sessionsPerPlatform <= 0) {
    fail('sessions-per-platform must be a positive integer.');
  }
  if (!Number.isFinite(args.noisePct) || args.noisePct < 0 || args.noisePct > 0.5) {
    fail('noise-pct must be in range [0, 0.5].');
  }

  const seedRoot = path.resolve(process.cwd(), args.seedRoot);
  const outRoot = path.resolve(process.cwd(), args.outRoot);
  const baselineSeedPath = path.join(seedRoot, 'baseline', 'session.log');
  const pilotSeedPath = path.join(seedRoot, 'pilot', 'session.log');

  const baselineSeedSessions = parseSessionsFromFile(baselineSeedPath);
  const pilotSeedSessions = parseSessionsFromFile(pilotSeedPath);
  const random01 = makeRng(args.seed);

  ensureDir(outRoot);
  const indexLines = [];
  indexLines.push('# Simulated Startup Logs Index');
  indexLines.push('');
  indexLines.push('This dataset is generated from Windows seed logs and is only for pipeline verification.');
  indexLines.push('Do not use this file set for release-go performance decisions.');
  indexLines.push('');

  for (const platform of DEFAULT_PLATFORMS) {
    const platformRoot = path.join(outRoot, platform.name);
    const baselineDir = path.join(platformRoot, 'baseline');
    const pilotDir = path.join(platformRoot, 'pilot');
    ensureDir(baselineDir);
    ensureDir(pilotDir);

    const generatedBaselineSessions = [];
    const generatedPilotSessions = [];
    for (let i = 0; i < args.sessionsPerPlatform; i += 1) {
      const baselineSeed = baselineSeedSessions[i % baselineSeedSessions.length];
      const pilotSeed = pilotSeedSessions[i % pilotSeedSessions.length];
      generatedBaselineSessions.push(
        mutateSession(baselineSeed, platform.baselineFactor, args.noisePct, random01)
      );
      generatedPilotSessions.push(
        mutateSession(pilotSeed, platform.pilotFactor, args.noisePct, random01)
      );
    }

    writeSessionLog(
      path.join(baselineDir, 'session.log'),
      platform.name,
      'baseline',
      generatedBaselineSessions,
      { seed: args.seed, noisePct: args.noisePct }
    );
    writeSessionLog(
      path.join(pilotDir, 'session.log'),
      platform.name,
      'pilot',
      generatedPilotSessions,
      { seed: args.seed, noisePct: args.noisePct }
    );

    indexLines.push(
      `- ${platform.name}: baselineFactor=${platform.baselineFactor}, pilotFactor=${platform.pilotFactor}, sessions=${args.sessionsPerPlatform}`
    );
  }

  fs.writeFileSync(path.join(outRoot, 'README.simulated.md'), `${indexLines.join('\n')}\n`, 'utf8');

  console.log(`[startup-perf-sim] Generated simulated cohorts at: ${outRoot}`);
  console.log(
    `[startup-perf-sim] Platforms=${DEFAULT_PLATFORMS.length}, sessionsPerPlatform=${args.sessionsPerPlatform}, seed=${args.seed}`
  );
}

main();
