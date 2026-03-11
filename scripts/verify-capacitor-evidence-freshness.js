#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const defaultEvidenceRoot = path.join(repoRoot, 'docs', 'mobile-evidence');
const MAX_AGE_DAYS_RANGE = {
  min: 1,
  max: 365,
  default: 30,
};
const LARGE_GRAPH_NODE_COUNT_RANGE = {
  min: 1000,
  max: 2000000,
  default: 10000,
};
const LARGE_GRAPH_EDGE_COUNT_RANGE = {
  min: 10000,
  max: 20000000,
  default: 1000000,
};

function parseBoundedInteger(value, { min, max, defaultValue }) {
  const parsed = Number(String(value || '').trim());
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }
  const normalized = Math.floor(parsed);
  if (normalized < min) {
    return min;
  }
  if (normalized > max) {
    return max;
  }
  return normalized;
}

function isTruthy(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function listEvidenceRunDirectories(evidenceRoot) {
  if (!fs.existsSync(evidenceRoot)) {
    return [];
  }
  return fs
    .readdirSync(evidenceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left));
}

function resolveLatestManifestPath(evidenceRoot) {
  const latestPointerPath = path.join(evidenceRoot, 'latest.json');
  if (fs.existsSync(latestPointerPath)) {
    const latestPointer = readJsonFile(latestPointerPath);
    const manifestRelative = String(latestPointer.manifestRelative || '').trim();
    if (manifestRelative) {
      const manifestPath = path.resolve(repoRoot, manifestRelative);
      if (fs.existsSync(manifestPath)) {
        return { manifestPath, via: 'latest-pointer', pointerPath: latestPointerPath };
      }
    }
  }

  const runDirs = listEvidenceRunDirectories(evidenceRoot);
  for (const runDirName of runDirs) {
    const manifestPath = path.join(evidenceRoot, runDirName, 'acceptance_evidence.json');
    if (fs.existsSync(manifestPath)) {
      return { manifestPath, via: 'directory-scan' };
    }
  }

  return null;
}

function validateChecklist(checklist, requireManualChecklist, requireLargeGraphEvidence) {
  const errors = [];
  const warnings = [];

  const requiredAutomated = [
    'deviceConnectionGateExecuted',
    'runtimeEvidenceArtifactsCollected',
  ];
  const requiredManual = [
    'appStartupManuallyVerified',
    'sourcePanelManuallyVerified',
    'readerManuallyVerified',
    'pathModeEnterExitManuallyVerified',
  ];

  for (const key of requiredAutomated) {
    if (checklist[key] !== true) {
      errors.push(`Checklist item must be true: ${key}`);
    }
  }

  if (requireLargeGraphEvidence) {
    if (checklist.largeGraphScenarioExecuted !== true) {
      errors.push('Checklist item must be true when large-graph evidence is required: largeGraphScenarioExecuted');
    }
  } else if (checklist.largeGraphScenarioExecuted !== true) {
    warnings.push('Large-graph scenario checklist is pending: largeGraphScenarioExecuted');
  }

  if (requireManualChecklist) {
    for (const key of requiredManual) {
      if (checklist[key] !== true) {
        errors.push(`Manual checklist item must be true when strict mode is enabled: ${key}`);
      }
    }
  } else {
    const pending = requiredManual.filter((key) => checklist[key] !== true);
    if (pending.length > 0) {
      warnings.push(`Manual checklist pending: ${pending.join(', ')}`);
    }
  }

  return { errors, warnings };
}

function validateLargeGraphWorkload(manifest, options) {
  const errors = [];
  const warnings = [];
  const workload = manifest && typeof manifest.workload === 'object' && manifest.workload !== null
    ? manifest.workload
    : {};
  const nodeCount = Number(workload.nodeCount || 0);
  const edgeCount = Number(workload.edgeCount || 0);
  const hasNodeCount = Number.isFinite(nodeCount) && nodeCount > 0;
  const hasEdgeCount = Number.isFinite(edgeCount) && edgeCount > 0;

  if (!options.requireLargeGraphEvidence) {
    if (!hasNodeCount || !hasEdgeCount) {
      warnings.push(
        'Workload evidence is missing node/edge counts. Set NOTE_CONNECTION_EVIDENCE_NODE_COUNT and NOTE_CONNECTION_EVIDENCE_EDGE_COUNT during capture.'
      );
    }
    return { errors, warnings };
  }

  if (!hasNodeCount || !hasEdgeCount) {
    errors.push('Manifest workload evidence is missing nodeCount/edgeCount while large-graph evidence is required.');
    return { errors, warnings };
  }

  if (Math.floor(nodeCount) < options.minimumLargeGraphNodeCount) {
    errors.push(
      `Manifest workload nodeCount (${Math.floor(nodeCount)}) is below required threshold (${options.minimumLargeGraphNodeCount}).`
    );
  }
  if (Math.floor(edgeCount) < options.minimumLargeGraphEdgeCount) {
    errors.push(
      `Manifest workload edgeCount (${Math.floor(edgeCount)}) is below required threshold (${options.minimumLargeGraphEdgeCount}).`
    );
  }

  return { errors, warnings };
}

function validateManifest(manifest, manifestPath, options) {
  const errors = [];
  const warnings = [];
  const nowMs = options.now.getTime();
  const maxAgeMs = options.maxAgeDays * 24 * 60 * 60 * 1000;
  const generatedAt = new Date(String(manifest.generatedAt || ''));

  if (!Number.isFinite(generatedAt.getTime())) {
    errors.push('Manifest generatedAt is missing or invalid.');
  }

  if (!manifest.schemaVersion || Number(manifest.schemaVersion) < 1) {
    errors.push('Manifest schemaVersion must be >= 1.');
  }

  if (Number.isFinite(generatedAt.getTime())) {
    const ageMs = nowMs - generatedAt.getTime();
    if (ageMs > maxAgeMs) {
      const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
      errors.push(`Evidence is stale (${ageDays} days old > allowed ${options.maxAgeDays} days).`);
    }
    if (ageMs < -5 * 60 * 1000) {
      warnings.push('Manifest timestamp is in the future relative to verifier clock.');
    }
  }

  const requiredPaths = [
    manifest?.artifacts?.screenshot?.relativePath,
    manifest?.artifacts?.logcat?.relativePath,
    manifest?.artifacts?.markdownReport?.relativePath,
    manifest?.apk?.relativePath,
  ];

  requiredPaths.forEach((relativePath, index) => {
    const keyName = ['screenshot', 'logcat', 'markdownReport', 'apk'][index];
    const normalized = String(relativePath || '').trim();
    if (!normalized) {
      errors.push(`Manifest missing relative path for ${keyName}.`);
      return;
    }
    const absolutePath = path.resolve(repoRoot, normalized);
    if (!fs.existsSync(absolutePath)) {
      errors.push(`Manifest artifact does not exist: ${normalized}`);
      return;
    }
    if (fs.statSync(absolutePath).size <= 0) {
      errors.push(`Manifest artifact is empty: ${normalized}`);
    }
  });

  const checklist = manifest.checklist || {};
  const checklistValidation = validateChecklist(
    checklist,
    options.requireManualChecklist,
    options.requireLargeGraphEvidence
  );
  errors.push(...checklistValidation.errors);
  warnings.push(...checklistValidation.warnings);

  const workloadValidation = validateLargeGraphWorkload(manifest, options);
  errors.push(...workloadValidation.errors);
  warnings.push(...workloadValidation.warnings);

  const result = {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      manifestPath,
      runId: String(manifest.runId || ''),
      generatedAt: String(manifest.generatedAt || ''),
      maxAgeDays: options.maxAgeDays,
      strictManualChecklist: options.requireManualChecklist,
      requireLargeGraphEvidence: options.requireLargeGraphEvidence,
      minimumLargeGraphNodeCount: options.minimumLargeGraphNodeCount,
      minimumLargeGraphEdgeCount: options.minimumLargeGraphEdgeCount,
    },
  };
  return result;
}

function verifyEvidence(options = {}) {
  const envEvidenceRootRaw = String(process.env.NOTE_CONNECTION_EVIDENCE_ROOT || '').trim();
  const envEvidenceRoot = envEvidenceRootRaw
    ? path.resolve(repoRoot, envEvidenceRootRaw)
    : '';
  const evidenceRoot = options.evidenceRoot || envEvidenceRoot || defaultEvidenceRoot;
  const now = options.now instanceof Date ? options.now : new Date();
  const maxAgeDays = Number.isFinite(options.maxAgeDays)
    ? options.maxAgeDays
    : parseBoundedInteger(process.env.NOTE_CONNECTION_EVIDENCE_MAX_AGE_DAYS, {
        min: MAX_AGE_DAYS_RANGE.min,
        max: MAX_AGE_DAYS_RANGE.max,
        defaultValue: MAX_AGE_DAYS_RANGE.default,
      });
  const requireManualChecklist = typeof options.requireManualChecklist === 'boolean'
    ? options.requireManualChecklist
    : isTruthy(process.env.NOTE_CONNECTION_REQUIRE_MANUAL_MOBILE_CHECKLIST);
  const requireLargeGraphEvidence = typeof options.requireLargeGraphEvidence === 'boolean'
    ? options.requireLargeGraphEvidence
    : isTruthy(process.env.NOTE_CONNECTION_REQUIRE_LARGE_GRAPH_EVIDENCE);
  const minimumLargeGraphNodeCount = Number.isFinite(options.minimumLargeGraphNodeCount)
    ? Number(options.minimumLargeGraphNodeCount)
    : parseBoundedInteger(process.env.NOTE_CONNECTION_MIN_EVIDENCE_NODE_COUNT, {
        min: LARGE_GRAPH_NODE_COUNT_RANGE.min,
        max: LARGE_GRAPH_NODE_COUNT_RANGE.max,
        defaultValue: LARGE_GRAPH_NODE_COUNT_RANGE.default,
      });
  const minimumLargeGraphEdgeCount = Number.isFinite(options.minimumLargeGraphEdgeCount)
    ? Number(options.minimumLargeGraphEdgeCount)
    : parseBoundedInteger(process.env.NOTE_CONNECTION_MIN_EVIDENCE_EDGE_COUNT, {
        min: LARGE_GRAPH_EDGE_COUNT_RANGE.min,
        max: LARGE_GRAPH_EDGE_COUNT_RANGE.max,
        defaultValue: LARGE_GRAPH_EDGE_COUNT_RANGE.default,
      });

  if (!fs.existsSync(evidenceRoot)) {
    return {
      ok: false,
      errors: [`Evidence root not found: ${evidenceRoot}`],
      warnings: [],
      summary: {
        evidenceRoot,
        maxAgeDays,
        strictManualChecklist: requireManualChecklist,
        requireLargeGraphEvidence,
        minimumLargeGraphNodeCount,
        minimumLargeGraphEdgeCount,
      },
    };
  }

  const resolved = resolveLatestManifestPath(evidenceRoot);
  if (!resolved) {
    return {
      ok: false,
      errors: [`No acceptance_evidence.json found under ${evidenceRoot}`],
      warnings: [],
      summary: {
        evidenceRoot,
        maxAgeDays,
        strictManualChecklist: requireManualChecklist,
        requireLargeGraphEvidence,
        minimumLargeGraphNodeCount,
        minimumLargeGraphEdgeCount,
      },
    };
  }

  const manifest = readJsonFile(resolved.manifestPath);
  const validated = validateManifest(manifest, resolved.manifestPath, {
    now,
    maxAgeDays,
    requireManualChecklist,
    requireLargeGraphEvidence,
    minimumLargeGraphNodeCount,
    minimumLargeGraphEdgeCount,
  });
  validated.summary.evidenceRoot = evidenceRoot;
  validated.summary.resolutionMode = resolved.via;
  if (resolved.pointerPath) {
    validated.summary.latestPointerPath = resolved.pointerPath;
  }
  return validated;
}

function printResult(result) {
  if (result.ok) {
    console.log('[Capacitor Evidence Verify] Evidence verification passed.');
    console.log(`[Capacitor Evidence Verify] Manifest: ${result.summary.manifestPath}`);
  } else {
    console.error('[Capacitor Evidence Verify] Evidence verification failed.');
  }
  if (result.warnings.length > 0) {
    result.warnings.forEach((warning) => {
      console.warn(`[Capacitor Evidence Verify] Warning: ${warning}`);
    });
  }
  if (result.errors.length > 0) {
    result.errors.forEach((error) => {
      console.error(`[Capacitor Evidence Verify] Error: ${error}`);
    });
  }
}

function main() {
  const result = verifyEvidence();
  printResult(result);
  if (!result.ok) {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  MAX_AGE_DAYS_RANGE,
  parseBoundedInteger,
  resolveLatestManifestPath,
  validateManifest,
  verifyEvidence,
};
