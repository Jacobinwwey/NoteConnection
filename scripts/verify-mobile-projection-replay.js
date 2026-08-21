#!/usr/bin/env node

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const projectionContract = require(path.join(__dirname, '..', 'src', 'frontend', 'knowledge_projection_contract.js'));
const projectionStore = require(path.join(__dirname, '..', 'src', 'frontend', 'knowledge_projection_store.js'));
const exactAnalyzer = require(path.join(__dirname, '..', 'src', 'frontend', 'mobile_exact_analyzer.js'));
const semanticComparator = require(path.join(__dirname, '..', 'src', 'frontend', 'mobile_semantic_comparator.js'));
const { MOBILE_BUDGET_CONTRACT } = require('./mobile-budget-contract');

global.window = {};
global.NoteConnectionMobileIdentity = require(path.join(__dirname, '..', 'src', 'frontend', 'mobile_identity_contract.js'));
const capacitorProvider = require(path.join(__dirname, '..', 'src', 'frontend', 'storage_provider.js'));

const HOSTS = ['web', 'tauri', 'capacitor', 'android'];
const MAX_PROJECTION_BYTES = MOBILE_BUDGET_CONTRACT.runtime.maxProjectionBytes;

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

const SEMANTIC_CORPUS = [
  {
    relativePath: 'algebra/index.md',
    content: '# Index\n',
  },
  {
    relativePath: 'algebra/intro.md',
    content: '---\nprerequisites:\n  - [[index]]\n---\n# Intro\n[Base](../shared/base.md)\n',
  },
  {
    relativePath: 'shared/base.md',
    content: '# Shared\n',
  },
  {
    relativePath: 'shared/copy.md',
    content: '# Shared\n',
  },
  {
    relativePath: 'unicode/Cafe\u0301.md',
    content: '# Cafe\n',
  },
  {
    relativePath: 'unicode/reader.md',
    content: '# Reader\n[ Cafe ](./Cafe%CC%81.md)\n',
  },
];

async function createSemanticCorpus(root) {
  const files = [];
  for (const entry of SEMANTIC_CORPUS) {
    const absolutePath = path.join(root, 'Knowledge_Base', ...entry.relativePath.split('/'));
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, entry.content, 'utf8');
    const legacyId = path.basename(entry.relativePath, path.extname(entry.relativePath));
    const identity = await global.NoteConnectionMobileIdentity.createResourceIdentity(
      entry.relativePath,
      legacyId,
      entry.content,
    );
    const metadata = {};
    if (entry.content.startsWith('---\n')) {
      metadata.prerequisites = ['index'];
    }
    files.push({
      id: legacyId,
      canonicalId: identity.canonicalId,
      label: legacyId,
      path: `Knowledge_Base/${entry.relativePath}`,
      sourceUri: identity.sourceUri,
      revision: identity.revision,
      identityAliases: identity.identityAliases,
      content: entry.content,
      metadata: {
        tags: [],
        prerequisites: metadata.prerequisites || [],
        next: [],
      },
      clusterId: 'root',
    });
  }
  return files;
}

function runRustSemanticProbe(corpusRoot, repoRoot) {
  const cargoExecutable = process.platform === 'win32' ? 'cargo.exe' : 'cargo';
  const result = childProcess.spawnSync(
    cargoExecutable,
    [
      'test',
      '--manifest-path',
      path.join(repoRoot, 'src-tauri', 'Cargo.toml'),
      '--lib',
      'mobile_semantic_parity_probe',
      '--',
      '--ignored',
      '--nocapture',
    ],
    {
      cwd: repoRoot,
      env: { ...process.env, NOTE_CONNECTION_MOBILE_PARITY_CORPUS: corpusRoot },
      encoding: 'utf8',
      timeout: 120000,
      maxBuffer: 32 * 1024 * 1024,
    },
  );
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Rust semantic parity probe failed:\n${result.stdout || ''}\n${result.stderr || ''}`);
  }
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  const match = output.match(/MOBILE_SEMANTIC_PARITY_JSON_BEGIN\r?\n([\s\S]*?)\r?\nMOBILE_SEMANTIC_PARITY_JSON_END/);
  if (!match) {
    throw new Error(`Rust semantic parity probe did not emit a projection.\n${output}`);
  }
  return JSON.parse(match[1]);
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
      'Semantic parity uses canonicalId, normalized sourceUri, directed endpoints, edge type, kind, and provenance; host-specific legacy ids are intentionally ignored.',
      'The Capacitor and Rust builders consume the same nested-path, relative-link, Markdown-link, duplicate-content, and NFC-normalized corpus. The Rust side is executed through an ignored cargo probe.',
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

    const semanticCorpusRoot = path.join(tempRoot, 'semantic-corpus');
    const semanticFiles = await createSemanticCorpus(semanticCorpusRoot);
    const capacitorProjection = projectionContract.createKnowledgeProjection(
      capacitorProvider.buildCapacitorGraphData(semanticFiles),
      { workspaceId: 'mobile-semantic-corpus', revision: 'sha256:semantic-corpus' },
    );
    const rustProjection = projectionContract.createKnowledgeProjection(
      runRustSemanticProbe(path.join(semanticCorpusRoot, 'Knowledge_Base'), path.join(__dirname, '..')),
      { workspaceId: 'mobile-semantic-corpus', revision: 'sha256:semantic-corpus' },
    );
    const semanticComparison = semanticComparator.assertSemanticParity(
      capacitorProjection,
      rustProjection,
      'Capacitor vs Rust semantic corpus',
    );
    evidence.semanticParity = {
      corpus: SEMANTIC_CORPUS.map((entry) => entry.relativePath),
      evidenceLevel: 'host-boundary-contract-plus-rust-probe',
      comparison: semanticComparison,
      replay: 'pass',
    };

    const collisionFiles = [
      { id: 'index', canonicalId: 'algebra/index', path: 'Knowledge_Base/algebra/index.md', sourceUri: 'note://workspace/v1/algebra/index.md', content: '# A', metadata: {} },
      { id: 'INDEX', canonicalId: 'physics/index', path: 'Knowledge_Base/physics/index.md', sourceUri: 'note://workspace/v1/physics/index.md', content: '# B', metadata: {} },
    ];
    assert.throws(
      () => capacitorProvider.buildCapacitorGraphData(collisionFiles),
      /ambiguous legacy basename/i,
    );
    evidence.failureModes.legacyBasenameCollision = 'fail-closed';

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
