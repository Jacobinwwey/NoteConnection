#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const corpusManifestPath = path.join(repoRoot, 'config', 'identity-corpus.v1.json');
const corpusVerifierPath = path.join(repoRoot, 'scripts', 'verify-identity-corpus.js');
const corpusReportPath = path.join(repoRoot, 'output', 'verification', 'identity-corpus', 'report-latest.json');
const outputRoot = path.join(repoRoot, 'output', 'verification', 'canonical-id-readiness');
const reportPath = path.join(outputRoot, 'report-latest.json');
const strict = process.argv.includes('--strict');

const producerSources = [
  'src/backend/ResourceIdentity.ts',
  'src/backend/GraphBuilder.ts',
  'src/frontend/mobile_identity_contract.js',
  'scripts/verify-mobile-projection-replay.js',
  'src-tauri/src/lib.rs',
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function runCorpus() {
  const result = childProcess.spawnSync(process.execPath, [corpusVerifierPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`identity corpus failed: ${String(result.stderr || result.stdout).trim()}`);
  }
  return readJson(corpusReportPath);
}

function verifyProducerSurface() {
  const missing = producerSources.filter((relativePath) => {
    const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
    return !source.includes('canonicalId');
  });
  if (missing.length > 0) {
    throw new Error(`canonicalId is missing from producer surface: ${missing.join(', ')}`);
  }
  return producerSources.map((relativePath) => relativePath.replace(/\\/g, '/'));
}

function verifyCompatibilityContract(manifest) {
  const compatibility = manifest.compatibility || {};
  const changedKeys = Object.entries(compatibility)
    .filter(([, changed]) => changed === true)
    .map(([key]) => key);
  if (changedKeys.length > 0) {
    throw new Error(`canonical-ID readiness cannot run after compatibility changes: ${changedKeys.join(', ')}`);
  }
  const packageJson = readJson(path.join(repoRoot, 'package.json'));
  const scripts = Object.values(packageJson.scripts || {}).join('\n');
  if (/NOTE_CONNECTION[_-]CANONICAL[_-]?ID|--canonical[_-]?id|migratePublicIds|switchPublicIds/i.test(scripts)) {
    throw new Error('a public canonical-ID switch must not be hidden in package scripts');
  }
  return { publicIdsChanged: false, snapshotSchemaChanged: false, projectionSchemaChanged: false, mobileRuntimeChanged: false };
}

function main() {
  const manifest = readJson(corpusManifestPath);
  const corpus = runCorpus();
  if (corpus.status !== 'passed' || corpus.canonicalPublicIdCutover !== 'blocked') {
    throw new Error('identity corpus must pass while canonical public-ID cutover remains blocked');
  }
  const producers = verifyProducerSurface();
  const compatibility = verifyCompatibilityContract(manifest);
  const nativeEvidence = corpus.nativeDeviceEvidence === true;
  const blockers = nativeEvidence
    ? []
    : ['nativeDeviceEvidence=false; signed arm64 workload and measured RSS remain external gates'];
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    readiness: blockers.length === 0 ? 'ready_for_independent_review' : 'blocked',
    evidenceLevel: corpus.evidenceLevel,
    nativeDeviceEvidence: nativeEvidence,
    canonicalPublicIdCutover: 'blocked',
    independentReviewRequired: true,
    corpus: {
      corpusId: corpus.corpusId,
      resultHash: corpus.resultHash,
      caseCount: Object.keys(corpus.cases || {}).length,
      projectionHosts: corpus.projectionReplay?.hosts || [],
    },
    producerSources: producers,
    compatibility,
    blockers,
  };
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[Canonical ID Readiness] ${report.readiness}`);
  console.log(`[Canonical ID Readiness] Report: ${path.relative(repoRoot, reportPath).replace(/\\/g, '/')}`);
  if (strict && blockers.length > 0) {
    throw new Error(`strict canonical-ID readiness failed: ${blockers.join('; ')}`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[Canonical ID Readiness] FAIL: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

module.exports = { main, verifyCompatibilityContract, verifyProducerSurface };
