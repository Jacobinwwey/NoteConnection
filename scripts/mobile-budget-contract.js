#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const contractPath = path.resolve(__dirname, '..', 'config', 'mobile-budget.v1.json');

function requirePositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Mobile budget ${label} must be a positive integer.`);
  }
  return value;
}

function loadMobileBudgetContract() {
  let payload;
  let sourceBytes;
  try {
    sourceBytes = fs.readFileSync(contractPath);
    payload = JSON.parse(sourceBytes.toString('utf8'));
  } catch (error) {
    throw new Error(`Unable to read mobile budget contract ${contractPath}: ${String(error.message || error)}`);
  }

  if (!payload || payload.schemaVersion !== 1 || !payload.profiles || !payload.runtime) {
    throw new Error(`Mobile budget contract must use schemaVersion 1: ${contractPath}`);
  }

  const profiles = {};
  for (const profileName of ['mobile-low', 'mobile-standard']) {
    const profile = payload.profiles[profileName];
    if (!profile) {
      throw new Error(`Mobile budget contract is missing profile ${profileName}.`);
    }
    profiles[profileName] = Object.freeze({
      artifactCompressedBytes: requirePositiveInteger(
        profile.artifactCompressedBytes,
        `${profileName}.artifactCompressedBytes`
      ),
      maxResidentBytes: requirePositiveInteger(
        profile.maxResidentBytes,
        `${profileName}.maxResidentBytes`
      ),
      maxDeviceRamBytes: requirePositiveInteger(
        profile.maxDeviceRamBytes,
        `${profileName}.maxDeviceRamBytes`
      ),
    });
  }

  const runtime = Object.freeze({
    maxDocuments: requirePositiveInteger(payload.runtime.maxDocuments, 'runtime.maxDocuments'),
    maxDocumentBytes: requirePositiveInteger(payload.runtime.maxDocumentBytes, 'runtime.maxDocumentBytes'),
    maxTotalInputBytes: requirePositiveInteger(payload.runtime.maxTotalInputBytes, 'runtime.maxTotalInputBytes'),
    maxEdges: requirePositiveInteger(payload.runtime.maxEdges, 'runtime.maxEdges'),
    maxDepth: requirePositiveInteger(payload.runtime.maxDepth, 'runtime.maxDepth'),
    maxProjectionBytes: requirePositiveInteger(payload.runtime.maxProjectionBytes, 'runtime.maxProjectionBytes'),
  });

  return Object.freeze({
    schemaVersion: 1,
    contractSha256: crypto.createHash('sha256').update(sourceBytes).digest('hex'),
    profiles: Object.freeze(profiles),
    runtime,
  });
}

const MOBILE_BUDGET_CONTRACT = loadMobileBudgetContract();

module.exports = {
  MOBILE_BUDGET_CONTRACT,
  contractPath,
  loadMobileBudgetContract,
};
