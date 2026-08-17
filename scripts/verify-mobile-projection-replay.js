#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const projectionContract = require(path.join(__dirname, '..', 'src', 'frontend', 'knowledge_projection_contract.js'));
const projectionStore = require(path.join(__dirname, '..', 'src', 'frontend', 'knowledge_projection_store.js'));
const exactAnalyzer = require(path.join(__dirname, '..', 'src', 'frontend', 'mobile_exact_analyzer.js'));

const HOSTS = ['web', 'tauri', 'capacitor', 'android'];
const MAX_PROJECTION_BYTES = 48 * 1024 * 1024;

function createFixture() {
  return projectionContract.createKnowledgeProjection({
    workspaceId: 'mobile-replay-fixture',
    revision: 'sha256:mobile-replay-fixture',
    nodes: [
      { id: 'A', label: 'Algebra', sourceUri: 'note://workspace/v1/algebra.md', identityAliases: ['algebra.md'] },
      { id: 'B', label: 'Basics', sourceUri: 'note://workspace/v1/basics.md' },
      { id: 'C', label: 'Calculus', sourceUri: 'note://workspace/v1/calculus.md' },
    ],
    edges: [
      { source: 'A', target: 'B', type: 'explicit-prerequisite', evidenceRefs: ['span:a-b'] },
      { source: 'B', target: 'C', type: 'explicit-prerequisite', evidenceRefs: ['span:b-c'] },
    ],
  });
}

function writeAtomicFile(fileName, serialized) {
  const temporaryPath = `${fileName}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const backupPath = `${fileName}.previous-${process.pid}-${Date.now()}`;
  let movedExisting = false;
  try {
    fs.writeFileSync(temporaryPath, serialized, 'utf8');
    if (fs.existsSync(fileName)) {
      fs.renameSync(fileName, backupPath);
      movedExisting = true;
    }
    fs.renameSync(temporaryPath, fileName);
    if (movedExisting) {
      fs.rmSync(backupPath, { force: true });
    }
  } catch (error) {
    if (movedExisting && !fs.existsSync(fileName) && fs.existsSync(backupPath)) {
      fs.renameSync(backupPath, fileName);
    }
    throw error;
  } finally {
    fs.rmSync(temporaryPath, { force: true });
    if (fs.existsSync(backupPath) && fs.existsSync(fileName)) {
      fs.rmSync(backupPath, { force: true });
    }
  }
}

function createFileStore(fileName, writeAtomic) {
  const options = {
    fileName,
    maxBytes: MAX_PROJECTION_BYTES,
    readFile: (target) => fs.readFileSync(target, 'utf8'),
  };
  if (typeof writeAtomic === 'function') {
    options.writeAtomic = writeAtomic;
  }
  return projectionStore.createFileProjectionStore(options);
}

function createChunkedAtomicWriter(chunkBytes) {
  return (fileName, serialized) => {
    const temporaryPath = `${fileName}.tmp-${process.pid}-${Date.now()}`;
    const chunks = [];
    for (let offset = 0; offset < serialized.length; offset += chunkBytes) {
      chunks.push(serialized.slice(offset, offset + chunkBytes));
    }
    fs.writeFileSync(temporaryPath, chunks.join(''), 'utf8');
    fs.renameSync(temporaryPath, fileName);
  };
}

function createJournaledAtomicWriter(journalPath) {
  return (fileName, serialized) => {
    const temporaryPath = `${fileName}.tmp-${process.pid}-${Date.now()}`;
    const backupPath = `${fileName}.previous-${process.pid}-${Date.now()}`;
    fs.writeFileSync(journalPath, JSON.stringify({ schemaVersion: 1, phase: 'staging' }), 'utf8');
    try {
      fs.writeFileSync(temporaryPath, serialized, 'utf8');
      if (fs.existsSync(fileName)) {
        fs.renameSync(fileName, backupPath);
      }
      fs.renameSync(temporaryPath, fileName);
      if (fs.existsSync(backupPath)) {
        fs.rmSync(backupPath, { force: true });
      }
      fs.rmSync(journalPath, { force: true });
    } catch (error) {
      if (!fs.existsSync(fileName) && fs.existsSync(backupPath)) {
        fs.renameSync(backupPath, fileName);
      }
      throw error;
    } finally {
      fs.rmSync(temporaryPath, { force: true });
      if (fs.existsSync(fileName) && fs.existsSync(backupPath)) {
        fs.rmSync(backupPath, { force: true });
      }
    }
  };
}

function createHostAdapter(host, root) {
  if (host === 'web') {
    let serialized = '';
    return {
      adapterKind: 'web-storage',
      store: projectionStore.createProjectionStore({
        maxBytes: MAX_PROJECTION_BYTES,
        read: async () => serialized,
        write: async (next) => {
          serialized = next;
        },
      }),
      reopen: () => projectionStore.createProjectionStore({
        maxBytes: MAX_PROJECTION_BYTES,
        read: async () => serialized,
      }),
    };
  }

  const fileName = path.join(root, `${host}-graph_data.json`);
  const writer = host === 'capacitor'
    ? createChunkedAtomicWriter(64 * 1024)
    : host === 'android'
      ? createJournaledAtomicWriter(path.join(root, `${host}-import-journal.v1.json`))
      : writeAtomicFile;
  return {
    adapterKind: host === 'capacitor' ? 'capacitor-filesystem-chunked' : `${host}-atomic-file`,
    store: createFileStore(fileName, writer),
    reopen: () => createFileStore(fileName),
  };
}

function analysisSnapshot(projection) {
  const index = exactAnalyzer.createMobileExactIndex(projection);
  return {
    metadata: {
      schemaVersion: projection.schemaVersion,
      projectionVersion: projection.projectionVersion,
      workspaceId: projection.workspaceId,
      revision: projection.revision,
      nodeCount: projection.nodes.length,
      edgeCount: projection.edges.length,
    },
    search: index.searchExact('Algebra', 10),
    neighbors: index.neighbors('A', 10),
    path: index.shortestPath('A', 'C', 8, 100),
  };
}

async function main() {
  const fixture = createFixture();
  const expected = analysisSnapshot(fixture);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-mobile-replay-'));
  const evidence = {
    schemaVersion: projectionStore.storeVersion,
    generatedAt: new Date().toISOString(),
    maxProjectionBytes: MAX_PROJECTION_BYTES,
    hosts: [],
    failureModes: {},
    notes: [
      'Host adapters exercise separate boundary implementations in a deterministic host process.',
      'This report is not evidence of a signed artifact, Android process death, SAF UI execution, or RSS compliance.',
    ],
  };

  try {
    for (const host of HOSTS) {
      const hostRoot = path.join(tempRoot, host);
      fs.mkdirSync(hostRoot, { recursive: true });
      const adapter = createHostAdapter(host, hostRoot);
      await adapter.store.save(fixture);
      const reopened = adapter.reopen();
      const replayed = await reopened.load();
      const actual = analysisSnapshot(replayed);
      assert.deepStrictEqual(replayed, fixture, `${host}: projection mismatch after reopen`);
      assert.deepStrictEqual(actual, expected, `${host}: analysis mismatch after reopen`);
      evidence.hosts.push({
        host,
        adapterKind: adapter.adapterKind,
        evidenceLevel: 'host-boundary-contract',
        storeKind: reopened.kind,
        metadata: actual.metadata,
        searchCount: actual.search.length,
        neighborCount: actual.neighbors.length,
        pathLength: actual.path ? actual.path.length : 0,
        replay: 'pass',
      });
    }

    const failurePath = path.join(tempRoot, 'failure-graph_data.json');
    fs.writeFileSync(failurePath, '{"schemaVersion":1,"nodes":[', 'utf8');
    const truncatedStore = createFileStore(failurePath);
    await assert.rejects(
      () => truncatedStore.load(),
      /Knowledge projection JSON is invalid/
    );
    evidence.failureModes.truncatedJson = 'fail-closed';

    fs.writeFileSync(failurePath, JSON.stringify({ schemaVersion: 2, nodes: [], edges: [] }), 'utf8');
    const futureStore = createFileStore(failurePath);
    await assert.rejects(
      () => futureStore.load(),
      /Unsupported knowledge projection schema version/
    );
    evidence.failureModes.unknownSchema = 'fail-closed';

    const outputRoot = path.join(__dirname, '..', 'output', 'verification', 'mobile-projection-replay');
    fs.mkdirSync(outputRoot, { recursive: true });
    const reportPath = path.join(outputRoot, 'report-latest.json');
    fs.writeFileSync(`${reportPath}.tmp`, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    fs.renameSync(`${reportPath}.tmp`, reportPath);
    console.log(`[Mobile Projection Replay] PASS: ${HOSTS.length} hosts, report ${reportPath}`);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`[Mobile Projection Replay] FAIL: ${String(error && error.stack || error)}`);
  process.exitCode = 1;
});
