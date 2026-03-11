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

function validateChecklist(checklist, requireManualChecklist) {
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
  const checklistValidation = validateChecklist(checklist, options.requireManualChecklist);
  errors.push(...checklistValidation.errors);
  warnings.push(...checklistValidation.warnings);

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

  if (!fs.existsSync(evidenceRoot)) {
    return {
      ok: false,
      errors: [`Evidence root not found: ${evidenceRoot}`],
      warnings: [],
      summary: {
        evidenceRoot,
        maxAgeDays,
        strictManualChecklist: requireManualChecklist,
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
      },
    };
  }

  const manifest = readJsonFile(resolved.manifestPath);
  const validated = validateManifest(manifest, resolved.manifestPath, {
    now,
    maxAgeDays,
    requireManualChecklist,
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
