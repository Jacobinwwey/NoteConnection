#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const JOURNAL_SCHEMA = 1;
const JOURNAL_FILE = 'knowledge_base_import_journal.v1.json';
const RESULT_FILE = 'knowledge_base_picker_result.json';
const TARGET_NAME = 'Knowledge_Base';
const STAGING_PREFIX = '.Knowledge_Base.import-';
const BACKUP_PREFIX = '.Knowledge_Base.previous-';
const KNOWN_PHASES = new Set(['staging', 'target-backed-up', 'target-activated']);

function removeEntry(entry) {
  fs.rmSync(entry, { recursive: true, force: true });
}

function writeAtomic(fileName, content) {
  const temporary = `${fileName}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, content, 'utf8');
  fs.renameSync(temporary, fileName);
}

function writeJournal(root, journal) {
  writeAtomic(path.join(root, JOURNAL_FILE), JSON.stringify({ schema: JOURNAL_SCHEMA, ...journal }));
}

function isSafeTransactionName(name, prefix) {
  return typeof name === 'string'
    && name.startsWith(prefix)
    && !name.includes('/')
    && !name.includes('\\')
    && name.length > prefix.length;
}

function resolveTransactionPath(root, name, prefix) {
  if (!isSafeTransactionName(name, prefix)) {
    return null;
  }
  const rootPath = fs.realpathSync.native(path.resolve(root));
  const candidate = path.resolve(rootPath, name);
  let canonicalCandidate;
  try {
    canonicalCandidate = fs.realpathSync.native(candidate);
  } catch (error) {
    if (!error || error.code !== 'ENOENT') {
      return null;
    }
    canonicalCandidate = path.resolve(
      fs.realpathSync.native(path.dirname(candidate)),
      path.basename(candidate),
    );
  }
  const relative = path.relative(rootPath, canonicalCandidate);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  return candidate;
}

function readJournal(journalPath) {
  if (!fs.existsSync(journalPath)) {
    return null;
  }
  try {
    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
    if (!journal || journal.schema !== JOURNAL_SCHEMA) {
      return { invalid: true };
    }
    return journal;
  } catch (_error) {
    return { invalid: true };
  }
}

function recoverOrphanedTransactions(root) {
  const target = path.join(root, TARGET_NAME);
  const staging = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.name.startsWith(STAGING_PREFIX))
    .map((entry) => path.join(root, entry.name));
  staging.forEach(removeEntry);

  const backups = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.name.startsWith(BACKUP_PREFIX))
    .map((entry) => path.join(root, entry.name))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);

  if (fs.existsSync(target)) {
    backups.forEach(removeEntry);
    return 'target-preserved';
  }
  if (backups.length > 0) {
    fs.renameSync(backups[0], target);
    backups.slice(1).forEach(removeEntry);
    return 'orphan-backup-restored';
  }
  return 'nothing-to-recover';
}

function recoverImportTransaction(root) {
  const journalPath = path.join(root, JOURNAL_FILE);
  const resultPath = path.join(root, RESULT_FILE);
  const journal = readJournal(journalPath);
  if (!journal) {
    return { status: 'noop', action: recoverOrphanedTransactions(root) };
  }
  if (journal.invalid) {
    removeEntry(journalPath);
    writeAtomic(resultPath, JSON.stringify({ status: 'failed', detail: 'invalid_import_journal' }));
    return { status: 'failed', action: 'invalid_import_journal' };
  }

  const staging = resolveTransactionPath(root, journal.stagingName, STAGING_PREFIX);
  const backup = resolveTransactionPath(root, journal.backupName, BACKUP_PREFIX);
  if (!KNOWN_PHASES.has(journal.phase) || !staging || !backup) {
    removeEntry(journalPath);
    writeAtomic(resultPath, JSON.stringify({ status: 'failed', detail: 'unsafe_import_journal' }));
    return { status: 'failed', action: 'unsafe_import_journal' };
  }

  const target = path.join(root, TARGET_NAME);
  if (fs.existsSync(target)) {
    removeEntry(staging);
    removeEntry(backup);
    removeEntry(journalPath);
    writeAtomic(resultPath, JSON.stringify({ status: 'completed', detail: 'target-preserved' }));
    return { status: 'completed', action: 'target-preserved' };
  }
  if (fs.existsSync(backup)) {
    fs.renameSync(backup, target);
    removeEntry(staging);
    removeEntry(journalPath);
    writeAtomic(resultPath, JSON.stringify({ status: 'completed', detail: 'previous-restored' }));
    return { status: 'completed', action: 'previous-restored' };
  }

  removeEntry(staging);
  removeEntry(backup);
  removeEntry(journalPath);
  writeAtomic(resultPath, JSON.stringify({ status: 'failed', detail: 'recovered_empty' }));
  return { status: 'failed', action: 'recovered_empty' };
}

function createCorpus(root, name, content) {
  const directory = path.join(root, name);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'marker.md'), content, 'utf8');
  return directory;
}

function runScenario(name, setup, expectedAction, expectedTargetContent = null) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `noteconnection-mobile-recovery-${name}-`));
  try {
    setup(root);
    const result = recoverImportTransaction(root);
    assert.strictEqual(result.action, expectedAction, `${name}: unexpected recovery action`);
    const target = path.join(root, TARGET_NAME);
    assert.strictEqual(
      fs.existsSync(target),
      expectedTargetContent !== null,
      `${name}: unexpected target existence`,
    );
    if (expectedTargetContent !== null) {
      assert.strictEqual(
        fs.readFileSync(path.join(target, 'marker.md'), 'utf8'),
        expectedTargetContent,
        `${name}: unexpected target content`,
      );
    }
    assert.strictEqual(
      fs.existsSync(path.join(root, JOURNAL_FILE)),
      false,
      `${name}: journal was not cleared`,
    );
    return {
      name,
      action: result.action,
      status: result.status,
      targetExists: fs.existsSync(path.join(root, TARGET_NAME)),
      journalExists: fs.existsSync(path.join(root, JOURNAL_FILE)),
    };
  } finally {
    removeEntry(root);
  }
}

function runRecoveryVerification(options = {}) {
  const scenarios = [
    runScenario('staging-target-wins', (root) => {
      createCorpus(root, TARGET_NAME, 'active');
      createCorpus(root, `${STAGING_PREFIX}one`, 'staged');
      writeJournal(root, {
        phase: 'staging',
        stagingName: `${STAGING_PREFIX}one`,
        backupName: `${BACKUP_PREFIX}one`,
        treeUri: 'content://fixture/staging',
      });
    }, 'target-preserved', 'active'),
    runScenario('backup-restored', (root) => {
      createCorpus(root, `${BACKUP_PREFIX}one`, 'previous');
      createCorpus(root, `${STAGING_PREFIX}one`, 'staged');
      writeJournal(root, {
        phase: 'target-backed-up',
        stagingName: `${STAGING_PREFIX}one`,
        backupName: `${BACKUP_PREFIX}one`,
        treeUri: 'content://fixture/backup',
      });
    }, 'previous-restored', 'previous'),
    runScenario('activated-target-wins', (root) => {
      createCorpus(root, TARGET_NAME, 'new-active');
      createCorpus(root, `${BACKUP_PREFIX}one`, 'old-active');
      writeJournal(root, {
        phase: 'target-activated',
        stagingName: `${STAGING_PREFIX}one`,
        backupName: `${BACKUP_PREFIX}one`,
        treeUri: 'content://fixture/activated',
      });
    }, 'target-preserved', 'new-active'),
    runScenario('orphan-backup-restored', (root) => {
      createCorpus(root, `${BACKUP_PREFIX}orphan`, 'orphaned');
    }, 'orphan-backup-restored', 'orphaned'),
    runScenario('unsafe-journal-rejected', (root) => {
      writeJournal(root, {
        phase: 'target-backed-up',
        stagingName: '../outside',
        backupName: `${BACKUP_PREFIX}unsafe`,
        treeUri: 'content://fixture/unsafe',
      });
    }, 'unsafe_import_journal'),
    runScenario('unknown-schema-rejected', (root) => {
      writeAtomic(path.join(root, JOURNAL_FILE), JSON.stringify({ schema: 99 }));
    }, 'invalid_import_journal'),
  ];
  const evidence = {
    schemaVersion: 1,
    evidenceLevel: 'host-recovery-state-machine',
    nativeDeviceEvidence: false,
    scenarios,
    notes: [
      'The scenarios model the Kotlin journal phases and path checks in a deterministic host process.',
      'This evidence does not prove Android process death, SAF UI execution, or device RSS.',
    ],
  };
  const outputPath = options.outputPath
    ? path.resolve(options.outputPath)
    : path.resolve(__dirname, '..', 'output', 'verification', 'mobile-native-recovery', 'report-latest.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  writeAtomic(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  return { ...evidence, outputPath };
}

if (require.main === module) {
  try {
    const evidence = runRecoveryVerification();
    console.log(`[Mobile Native Recovery] PASS: ${evidence.scenarios.length} scenarios, report ${evidence.outputPath}`);
  } catch (error) {
    console.error(`[Mobile Native Recovery] FAIL: ${String(error && error.stack || error)}`);
    process.exitCode = 1;
  }
}

module.exports = { recoverImportTransaction, runRecoveryVerification };
