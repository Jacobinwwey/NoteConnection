#!/usr/bin/env node

require('ts-node/register/transpile-only');

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');

const { Graph } = require('../src/core/Graph');
const {
  createResourceIdentity,
  assertUniqueLegacyResourceIds,
  normalizeResourceRelativePath,
} = require('../src/backend/ResourceIdentity');
const { KnowledgeLearningPlatform } = require('../src/learning/KnowledgeLearningPlatform');
const { createFileBackedKnowledgeGraphStore } = require('../src/learning/store');

const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(repoRoot, 'config', 'identity-corpus.v1.json');
const outputRoot = path.join(repoRoot, 'output', 'verification', 'identity-corpus');
const reportPath = path.join(outputRoot, 'report-latest.json');
const nowIso = '2026-08-21T00:00:00.000Z';

function readManifest() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.requiredCases)) {
    throw new Error('identity-corpus manifest must use schemaVersion 1 and declare requiredCases');
  }
  if (!Array.isArray(manifest.requiredProjectionHosts) || manifest.requiredProjectionHosts.length !== 4) {
    throw new Error('identity-corpus manifest must declare all four projection hosts');
  }
  return manifest;
}

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function createTempStore() {
  const tempRoot = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'noteconnection-identity-corpus-'));
  const snapshotPath = path.join(tempRoot, 'runtime_data', 'knowledge_graph_store.v1.json');
  return {
    tempRoot,
    snapshotPath,
    store: createFileBackedKnowledgeGraphStore({ filePath: snapshotPath }),
  };
}

async function runCase(name, execute) {
  try {
    return { name, status: 'passed', result: await execute() };
  } catch (error) {
    return {
      name,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function runLegacySnapshotRestore() {
  const graph = Graph.fromJSON({
    nodes: [
      { id: 'legacy-a', label: 'A', inDegree: 0, outDegree: 1 },
      { id: 'legacy-b', label: 'B', inDegree: 1, outDegree: 0 },
    ],
    edges: [{ source: 'legacy-a', target: 'legacy-b', type: 'legacy-link', weight: 1 }],
  });
  if (!graph.hasNode('legacy-a') || graph.getOutgoingEdges('legacy-a').length !== 1) {
    throw new Error('legacy snapshot did not restore its declared edge');
  }
  try {
    graph.restore({
      nodes: [{ id: 'candidate', label: 'Candidate' }],
      edges: [{ source: 'candidate', target: 'missing' }],
    });
    throw new Error('corrupt candidate snapshot was accepted');
  } catch (error) {
    if (!/undeclared node/i.test(error instanceof Error ? error.message : String(error))) {
      throw error;
    }
  }
  if (!graph.hasNode('legacy-a') || graph.hasNode('candidate')) {
    throw new Error('failed graph restore changed the existing graph');
  }
  return { legacyNodeCount: 2, legacyEdgeCount: 1, corruptRestoreRejected: true };
}

function runSameContentIsolation() {
  const first = createResourceIdentity('notes/first.md', 'First', 'same body');
  const second = createResourceIdentity('notes/second.md', 'Second', 'same body');
  if (first.revision !== second.revision || first.sourceUri === second.sourceUri) {
    throw new Error('same-content resources lost workspace identity isolation');
  }
  return { sameRevision: true, distinctSourceUris: true };
}

function runCrossRootNfcIdentity() {
  const fromWindows = createResourceIdentity(
    normalizeResourceRelativePath(
      'C:\\workspace\\Knowledge_Base',
      'C:\\workspace\\Knowledge_Base\\Notes\\Cafe\u0301.md',
    ),
    'Cafe',
    'body',
  );
  const fromPosix = createResourceIdentity('notes/caf\u00e9.md', 'Cafe', 'body');
  if (fromWindows.sourceUri !== fromPosix.sourceUri || fromWindows.revision !== fromPosix.revision) {
    throw new Error('cross-root NFC identity is not stable');
  }
  return { sourceUriStable: true, revisionStable: true };
}

function runNfcCaseCollisionRejection() {
  try {
    assertUniqueLegacyResourceIds([
      { filename: 'Cafe\u0301', filepath: 'one/Cafe\u0301.md' },
      { filename: 'Caf\u00e9', filepath: 'two/Caf\u00e9.md' },
    ]);
    throw new Error('NFC/case collision was accepted');
  } catch (error) {
    if (!/ambiguous|duplicate/i.test(error instanceof Error ? error.message : String(error))) {
      throw error;
    }
  }
  return { collisionRejected: true };
}

async function runMoveJournalRestartAliasDelete() {
  const fixture = createTempStore();
  try {
    const platform = new KnowledgeLearningPlatform({
      nowProvider: () => new Date(nowIso),
      store: fixture.store,
    });
    await platform.ingestKnowledge({
      documents: [{
        documentId: 'corpus_move_restart',
        sourcePath: 'Knowledge_Base/corpus-old.md',
        sourceUri: 'note://workspace/v1/corpus-old.md',
        language: 'en',
        content: '# Corpus move\nLegacy aliases must survive restart.',
      }],
    });
    await platform.ingestKnowledge({
      operations: [{
        op: 'move',
        document: {
          documentId: 'corpus_move_restart',
          toSourcePath: 'Knowledge_Base/corpus-new.md',
          toSourceUri: 'note://workspace/v1/corpus-new.md',
        },
      }],
    });
    const restored = new KnowledgeLearningPlatform({
      nowProvider: () => new Date(nowIso),
      store: createFileBackedKnowledgeGraphStore({ filePath: fixture.snapshotPath }),
    });
    await restored.ensureReady();
    const deleted = await restored.ingestKnowledge({
      deletedDocuments: [{ sourcePath: 'Knowledge_Base/corpus-old.md' }],
    });
    if (deleted.summary.deletedDocuments !== 1 || restored.getKnowledgeState().documents !== 0) {
      throw new Error('move journal did not preserve old alias deletion after restart');
    }
    const persisted = JSON.parse(fs.readFileSync(fixture.snapshotPath, 'utf8'));
    return {
      journalRecords: Array.isArray(persisted.identityJournal) ? persisted.identityJournal.length : 0,
      restartDeleteByOldAlias: true,
    };
  } finally {
    fs.rmSync(fixture.tempRoot, { recursive: true, force: true });
  }
}

async function runMixedBatchRollback() {
  const fixture = createTempStore();
  try {
    const platform = new KnowledgeLearningPlatform({
      nowProvider: () => new Date(nowIso),
      store: fixture.store,
    });
    await platform.ingestKnowledge({
      documents: [
        {
          documentId: 'corpus_batch_first',
          sourcePath: 'Knowledge_Base/batch-first.md',
          language: 'en',
          content: '# First\nThe first move must roll back.',
        },
        {
          documentId: 'corpus_batch_second',
          sourcePath: 'Knowledge_Base/batch-second.md',
          language: 'en',
          content: '# Second\nThe second move creates a collision.',
        },
      ],
    });
    const before = fs.readFileSync(fixture.snapshotPath, 'utf8');
    try {
      await platform.ingestKnowledge({
        operations: [
          {
            op: 'move',
            document: {
              documentId: 'corpus_batch_first',
              toSourcePath: 'Knowledge_Base/batch-target.md',
            },
          },
          {
            op: 'move',
            document: {
              documentId: 'corpus_batch_second',
              toSourcePath: 'Knowledge_Base/batch-target.md',
            },
          },
        ],
      });
      throw new Error('mixed batch collision was accepted');
    } catch (error) {
      if (!/identity transition alias collision/i.test(error instanceof Error ? error.message : String(error))) {
        throw error;
      }
    }
    const after = fs.readFileSync(fixture.snapshotPath, 'utf8');
    if (before !== after) {
      throw new Error('mixed batch rollback changed persisted bytes');
    }
    await platform.ingestKnowledge({
      operations: [{
        op: 'move',
        document: {
          fromSourcePath: 'Knowledge_Base/batch-first.md',
          toSourcePath: 'Knowledge_Base/batch-recovered.md',
        },
      }],
    });
    return { persistedBytesStable: true, originalAliasStillUsable: true };
  } finally {
    fs.rmSync(fixture.tempRoot, { recursive: true, force: true });
  }
}

async function runFourOwnerConvergence() {
  const fixture = createTempStore();
  try {
    const platform = new KnowledgeLearningPlatform({
      nowProvider: () => new Date(nowIso),
      store: fixture.store,
    });
    await platform.ingestKnowledge({
      documents: [{
        documentId: 'corpus_owner_convergence',
        sourcePath: 'Knowledge_Base/owner-old.md',
        sourceUri: 'note://workspace/v1/owner-old.md',
        language: 'en',
        content: '# Owner convergence\nAll persistence owners move together.',
      }],
    });
    const before = JSON.parse(fs.readFileSync(fixture.snapshotPath, 'utf8'));
    await platform.ingestKnowledge({
      operations: [{
        op: 'move',
        document: {
          documentId: 'corpus_owner_convergence',
          toSourcePath: 'Knowledge_Base/owner-new.md',
          toSourceUri: 'note://workspace/v1/owner-new.md',
        },
      }],
    });
    const after = JSON.parse(fs.readFileSync(fixture.snapshotPath, 'utf8'));
    const projection = after.resourceRegistry.projections.find((item) => item.documentId === 'corpus_owner_convergence');
    const binding = after.workspaceRegistry.bindings.find((item) => item.documentId === 'corpus_owner_convergence');
    const unit = after.indexLifecycle.units.find((item) => item.documentId === 'corpus_owner_convergence');
    const document = after.documents.find((item) => item.documentId === 'corpus_owner_convergence');
    if (!document || !projection || !binding || !unit || new Set([
      document.sourcePath,
      projection.sourcePath,
      binding.sourcePath,
      unit.sourcePath,
    ]).size !== 1) {
      throw new Error('four persistence owners did not converge on the moved path');
    }
    const beforeProjection = before.resourceRegistry.projections.find((item) => item.documentId === 'corpus_owner_convergence');
    if (!beforeProjection || beforeProjection.projectionId !== projection.projectionId) {
      throw new Error('move allocated a new projection identity');
    }
    return { fourOwnerPathConvergence: true, projectionIdentityStable: true };
  } finally {
    fs.rmSync(fixture.tempRoot, { recursive: true, force: true });
  }
}

async function runUpsertAliasCollisionRejection() {
  const fixture = createTempStore();
  try {
    const platform = new KnowledgeLearningPlatform({
      nowProvider: () => new Date(nowIso),
      store: fixture.store,
    });
    await platform.ingestKnowledge({
      documents: [{
        documentId: 'corpus_existing_alias',
        sourcePath: 'Knowledge_Base/existing.md',
        language: 'en',
        content: '# Existing\nThe path is already owned.',
      }],
    });
    const before = fs.readFileSync(fixture.snapshotPath, 'utf8');
    try {
      await platform.ingestKnowledge({
        documents: [{
          documentId: 'corpus_duplicate_alias',
          sourcePath: 'Knowledge_Base/existing.md',
          language: 'en',
          content: '# Duplicate\nThis path must fail closed.',
        }],
      });
      throw new Error('upsert alias collision was accepted');
    } catch (error) {
      if (!/identity transition alias collision/i.test(error instanceof Error ? error.message : String(error))) {
        throw error;
      }
    }
    if (fs.readFileSync(fixture.snapshotPath, 'utf8') !== before) {
      throw new Error('upsert alias rejection changed persisted bytes');
    }
    return { collisionRejected: true, persistedBytesStable: true };
  } finally {
    fs.rmSync(fixture.tempRoot, { recursive: true, force: true });
  }
}

function runProjectionReplay(manifest) {
  const verifier = path.join(repoRoot, 'scripts', 'verify-mobile-projection-replay.js');
  const result = childProcess.spawnSync(process.execPath, [verifier], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`projection replay failed: ${String(result.stderr || result.stdout).trim()}`);
  }
  const projectionReportPath = path.join(repoRoot, 'output', 'verification', 'mobile-projection-replay', 'report-latest.json');
  const report = JSON.parse(fs.readFileSync(projectionReportPath, 'utf8'));
  const hosts = Array.isArray(report.hosts)
    ? report.hosts.map((host) => String(host.host || '')).filter(Boolean)
    : [];
  const missingHosts = manifest.requiredProjectionHosts.filter((host) => !hosts.includes(host));
  if (missingHosts.length > 0) {
    throw new Error(`projection replay report is missing hosts: ${missingHosts.join(', ')}`);
  }
  return {
    status: 'passed',
    hosts,
    reportPath: path.relative(repoRoot, projectionReportPath).replace(/\\/g, '/'),
  };
}

async function main() {
  const manifest = readManifest();
  const caseRunners = {
    legacy_snapshot_restore: () => runLegacySnapshotRestore(),
    same_content_isolation: () => runSameContentIsolation(),
    cross_root_nfc_identity: () => runCrossRootNfcIdentity(),
    nfc_case_collision_rejection: () => runNfcCaseCollisionRejection(),
    move_journal_restart_alias_delete: () => runMoveJournalRestartAliasDelete(),
    mixed_batch_rollback: () => runMixedBatchRollback(),
    four_owner_convergence: () => runFourOwnerConvergence(),
    upsert_alias_collision_rejection: () => runUpsertAliasCollisionRejection(),
  };
  const cases = {};
  for (const name of manifest.requiredCases) {
    if (typeof caseRunners[name] !== 'function') {
      throw new Error(`identity corpus has no runner for required case: ${name}`);
    }
    cases[name] = await runCase(name, caseRunners[name]);
  }
  const projectionReplay = runProjectionReplay(manifest);
  const stableResults = {
    schemaVersion: manifest.schemaVersion,
    corpusId: manifest.corpusId,
    cases: Object.fromEntries(Object.entries(cases).map(([name, entry]) => [name, {
      status: entry.status,
      result: entry.result || null,
      error: entry.error || null,
    }])),
    projectionHosts: projectionReplay.hosts,
    compatibility: manifest.compatibility,
  };
  const report = {
    schemaVersion: 1,
    corpusId: manifest.corpusId,
    generatedAt: new Date().toISOString(),
    evidenceLevel: 'host-code-replay',
    nativeDeviceEvidence: false,
    compatibility: manifest.compatibility,
    resultHash: stableHash(stableResults),
    cases,
    projectionReplay,
    canonicalPublicIdCutover: 'blocked',
    nativeGates: 'separate',
  };
  if (Object.values(cases).some((entry) => entry.status !== 'passed')) {
    report.status = 'failed';
  } else {
    report.status = 'passed';
  }
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (report.status !== 'passed') {
    throw new Error(`identity corpus failed; report: ${reportPath}`);
  }
  console.log(`[Identity Corpus] PASS: ${Object.keys(cases).length} cases, ${projectionReplay.hosts.length} projection hosts`);
  console.log(`[Identity Corpus] Report: ${path.relative(repoRoot, reportPath).replace(/\\/g, '/')}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[Identity Corpus] FAIL: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

module.exports = { main, readManifest };
