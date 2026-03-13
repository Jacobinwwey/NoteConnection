#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repoRoot = path.resolve(__dirname, '..');
const defaultSbomPath = path.join(repoRoot, 'build', 'sbom', 'noteconnection-sbom.cdx.json');
const defaultAttestationPath = path.join(repoRoot, 'build', 'sbom', 'noteconnection-sbom.attestation.json');
const defaultPackageJsonPath = path.join(repoRoot, 'package.json');
const defaultTransparencyLogPath = path.join(repoRoot, 'build', 'sbom', 'attestation-transparency-log.jsonl');
const EXPECTED_SCHEMA = 'noteconnection/sbom-attestation/v1';
const EXPECTED_VERSION = 1;
const EXPECTED_TRANSPARENCY_SCHEMA = 'noteconnection/sbom-attestation-transparency/v1';
const EXPECTED_TRANSPARENCY_VERSION = 1;
const EXPECTED_KEYRING_SCHEMA = 'noteconnection/sbom-keyring/v1';
const EXPECTED_KEYRING_VERSION = 1;
const EXPECTED_SIGNATURE_ALGORITHM = 'RSA-SHA256';
const SIGNATURE_SCHEME = 'sha256';
const DEFAULT_MAX_AGE_HOURS = 168;
const DEFAULT_MIN_RSA_BITS = 2048;

function parseBoolean(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseCsvList(value) {
  if (value === undefined || value === null) {
    return [];
  }
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseArgs(argv) {
  const options = {
    sbomPath: defaultSbomPath,
    attestationPath: defaultAttestationPath,
    packageJsonPath: defaultPackageJsonPath,
    strict: parseBoolean(
      process.env.NOTE_CONNECTION_REQUIRE_SBOM_ATTESTATION === undefined
        ? '0'
        : process.env.NOTE_CONNECTION_REQUIRE_SBOM_ATTESTATION
    ),
    requireSignature: parseBoolean(
      process.env.NOTE_CONNECTION_REQUIRE_SBOM_ATTESTATION_SIGNATURE === undefined
        ? '0'
        : process.env.NOTE_CONNECTION_REQUIRE_SBOM_ATTESTATION_SIGNATURE
    ),
    autoRequireSignatureWhenKeyAvailable: parseBoolean(
      process.env.NOTE_CONNECTION_SBOM_ATTESTATION_AUTO_REQUIRE_SIGNATURE_WHEN_KEY_AVAILABLE === undefined
        ? '1'
        : process.env.NOTE_CONNECTION_SBOM_ATTESTATION_AUTO_REQUIRE_SIGNATURE_WHEN_KEY_AVAILABLE
    ),
    requireSignedKeyId: parseBoolean(
      process.env.NOTE_CONNECTION_SBOM_ATTESTATION_REQUIRE_SIGNED_KEY_ID === undefined
        ? '1'
        : process.env.NOTE_CONNECTION_SBOM_ATTESTATION_REQUIRE_SIGNED_KEY_ID
    ),
    allowUnspecifiedKeyId: parseBoolean(
      process.env.NOTE_CONNECTION_SBOM_ATTESTATION_ALLOW_UNSPECIFIED_KEY_ID === undefined
        ? '0'
        : process.env.NOTE_CONNECTION_SBOM_ATTESTATION_ALLOW_UNSPECIFIED_KEY_ID
    ),
    requiredKeyId: String(process.env.NOTE_CONNECTION_SBOM_ATTESTATION_REQUIRED_KEY_ID || '').trim(),
    allowedKeyIds: parseCsvList(process.env.NOTE_CONNECTION_SBOM_ATTESTATION_ALLOWED_KEY_IDS),
    revokedKeyIds: parseCsvList(process.env.NOTE_CONNECTION_SBOM_ATTESTATION_REVOKED_KEY_IDS),
    requireTransparencyLog: parseBoolean(
      process.env.NOTE_CONNECTION_SBOM_ATTESTATION_REQUIRE_TRANSPARENCY_LOG === undefined
        ? '0'
        : process.env.NOTE_CONNECTION_SBOM_ATTESTATION_REQUIRE_TRANSPARENCY_LOG
    ),
    verifyTransparencyLogInclusion: parseBoolean(
      process.env.NOTE_CONNECTION_SBOM_ATTESTATION_VERIFY_TRANSPARENCY_LOG_INCLUSION === undefined
        ? '1'
        : process.env.NOTE_CONNECTION_SBOM_ATTESTATION_VERIFY_TRANSPARENCY_LOG_INCLUSION
    ),
    transparencyLogPath: String(process.env.NOTE_CONNECTION_SBOM_ATTESTATION_TRANSPARENCY_LOG_PATH || '').trim(),
    requireTransparencySchemaPin: parseBoolean(
      process.env.NOTE_CONNECTION_SBOM_ATTESTATION_TRANSPARENCY_REQUIRE_SCHEMA_PIN === undefined
        ? '1'
        : process.env.NOTE_CONNECTION_SBOM_ATTESTATION_TRANSPARENCY_REQUIRE_SCHEMA_PIN
    ),
    expectedTransparencySchema: String(
      process.env.NOTE_CONNECTION_SBOM_ATTESTATION_TRANSPARENCY_EXPECT_SCHEMA || EXPECTED_TRANSPARENCY_SCHEMA
    ).trim(),
    expectedTransparencyVersion: parseInteger(
      process.env.NOTE_CONNECTION_SBOM_ATTESTATION_TRANSPARENCY_EXPECT_VERSION,
      EXPECTED_TRANSPARENCY_VERSION
    ),
    requireProvenance: parseBoolean(
      process.env.NOTE_CONNECTION_SBOM_ATTESTATION_REQUIRE_PROVENANCE === undefined
        ? '0'
        : process.env.NOTE_CONNECTION_SBOM_ATTESTATION_REQUIRE_PROVENANCE
    ),
    expectedRepositoryUrl: String(process.env.NOTE_CONNECTION_SBOM_ATTESTATION_EXPECT_REPOSITORY_URL || '').trim(),
    expectedReleaseCommitSha: String(
      process.env.NOTE_CONNECTION_SBOM_ATTESTATION_EXPECT_RELEASE_COMMIT_SHA ||
        process.env.NOTE_CONNECTION_RELEASE_COMMIT_SHA ||
        process.env.GITHUB_SHA ||
        ''
    ).trim(),
    expectedReleaseGitTag: String(
      process.env.NOTE_CONNECTION_SBOM_ATTESTATION_EXPECT_RELEASE_GIT_TAG ||
        process.env.NOTE_CONNECTION_RELEASE_GIT_TAG ||
        (String(process.env.GITHUB_REF_TYPE || '').trim().toLowerCase() === 'tag'
          ? String(process.env.GITHUB_REF_NAME || '')
          : '') ||
        ''
    ).trim(),
    expectedReleaseRef: String(
      process.env.NOTE_CONNECTION_SBOM_ATTESTATION_EXPECT_RELEASE_REF ||
        process.env.NOTE_CONNECTION_RELEASE_REF ||
        process.env.GITHUB_REF ||
        ''
    ).trim(),
    expectedReleaseRunId: String(
      process.env.NOTE_CONNECTION_SBOM_ATTESTATION_EXPECT_RELEASE_RUN_ID ||
        process.env.NOTE_CONNECTION_RELEASE_RUN_ID ||
        process.env.GITHUB_RUN_ID ||
        ''
    ).trim(),
    allowMissing: parseBoolean(
      process.env.NOTE_CONNECTION_ALLOW_MISSING_SBOM_ATTESTATION === undefined
        ? '1'
        : process.env.NOTE_CONNECTION_ALLOW_MISSING_SBOM_ATTESTATION
    ),
    maxAgeHours: parseInteger(process.env.NOTE_CONNECTION_SBOM_ATTESTATION_MAX_AGE_HOURS, DEFAULT_MAX_AGE_HOURS),
    minRsaBits: parseInteger(
      process.env.NOTE_CONNECTION_SBOM_ATTESTATION_MIN_RSA_BITS,
      DEFAULT_MIN_RSA_BITS
    ),
    minRotationOverlapHours: parseInteger(
      process.env.NOTE_CONNECTION_SBOM_ATTESTATION_MIN_ROTATION_OVERLAP_HOURS,
      0
    ),
    requireKeyringSchemaPin: parseBoolean(
      process.env.NOTE_CONNECTION_SBOM_KEYRING_REQUIRE_SCHEMA_PIN === undefined
        ? '1'
        : process.env.NOTE_CONNECTION_SBOM_KEYRING_REQUIRE_SCHEMA_PIN
    ),
    expectedKeyringSchema: String(
      process.env.NOTE_CONNECTION_SBOM_KEYRING_EXPECT_SCHEMA || EXPECTED_KEYRING_SCHEMA
    ).trim(),
    expectedKeyringVersion: parseInteger(
      process.env.NOTE_CONNECTION_SBOM_KEYRING_EXPECT_VERSION,
      EXPECTED_KEYRING_VERSION
    ),
    publicKeyPem: String(process.env.NOTE_CONNECTION_SBOM_SIGNING_PUBLIC_KEY_PEM || '').trim(),
    publicKeyFile: String(process.env.NOTE_CONNECTION_SBOM_SIGNING_PUBLIC_KEY_FILE || '').trim(),
    publicKeyringFile: String(process.env.NOTE_CONNECTION_SBOM_SIGNING_PUBLIC_KEYRING_FILE || '').trim(),
    contractOnly: false,
    keyring: null,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = String(argv[index] || '').trim();
    if (!arg) {
      continue;
    }

    if (arg === '--sbom' && index + 1 < argv.length) {
      options.sbomPath = path.resolve(repoRoot, String(argv[index + 1]));
      index += 1;
      continue;
    }
    if (arg === '--attestation' && index + 1 < argv.length) {
      options.attestationPath = path.resolve(repoRoot, String(argv[index + 1]));
      index += 1;
      continue;
    }
    if (arg === '--package-json' && index + 1 < argv.length) {
      options.packageJsonPath = path.resolve(repoRoot, String(argv[index + 1]));
      index += 1;
      continue;
    }
    if (arg === '--strict' && index + 1 < argv.length) {
      options.strict = parseBoolean(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--require-signature' && index + 1 < argv.length) {
      options.requireSignature = parseBoolean(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--auto-require-signature-when-key-available' && index + 1 < argv.length) {
      options.autoRequireSignatureWhenKeyAvailable = parseBoolean(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--require-signed-key-id' && index + 1 < argv.length) {
      options.requireSignedKeyId = parseBoolean(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--allow-unspecified-key-id' && index + 1 < argv.length) {
      options.allowUnspecifiedKeyId = parseBoolean(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--required-key-id' && index + 1 < argv.length) {
      options.requiredKeyId = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (arg === '--require-transparency-log' && index + 1 < argv.length) {
      options.requireTransparencyLog = parseBoolean(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--verify-transparency-log-inclusion' && index + 1 < argv.length) {
      options.verifyTransparencyLogInclusion = parseBoolean(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--transparency-log-path' && index + 1 < argv.length) {
      options.transparencyLogPath = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (arg === '--require-transparency-schema-pin' && index + 1 < argv.length) {
      options.requireTransparencySchemaPin = parseBoolean(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--expected-transparency-schema' && index + 1 < argv.length) {
      options.expectedTransparencySchema = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (arg === '--expected-transparency-version' && index + 1 < argv.length) {
      options.expectedTransparencyVersion = parseInteger(argv[index + 1], options.expectedTransparencyVersion);
      index += 1;
      continue;
    }
    if (arg === '--require-provenance' && index + 1 < argv.length) {
      options.requireProvenance = parseBoolean(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--expected-repository-url' && index + 1 < argv.length) {
      options.expectedRepositoryUrl = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (arg === '--expected-release-commit' && index + 1 < argv.length) {
      options.expectedReleaseCommitSha = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (arg === '--expected-release-tag' && index + 1 < argv.length) {
      options.expectedReleaseGitTag = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (arg === '--expected-release-ref' && index + 1 < argv.length) {
      options.expectedReleaseRef = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (arg === '--expected-release-run-id' && index + 1 < argv.length) {
      options.expectedReleaseRunId = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (arg === '--allowed-key-ids' && index + 1 < argv.length) {
      options.allowedKeyIds = parseCsvList(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--revoked-key-ids' && index + 1 < argv.length) {
      options.revokedKeyIds = parseCsvList(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--allow-missing' && index + 1 < argv.length) {
      options.allowMissing = parseBoolean(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--max-age-hours' && index + 1 < argv.length) {
      options.maxAgeHours = parseInteger(argv[index + 1], options.maxAgeHours);
      index += 1;
      continue;
    }
    if (arg === '--public-key-file' && index + 1 < argv.length) {
      options.publicKeyFile = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (arg === '--public-keyring-file' && index + 1 < argv.length) {
      options.publicKeyringFile = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (arg === '--require-keyring-schema-pin' && index + 1 < argv.length) {
      options.requireKeyringSchemaPin = parseBoolean(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--expected-keyring-schema' && index + 1 < argv.length) {
      options.expectedKeyringSchema = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (arg === '--expected-keyring-version' && index + 1 < argv.length) {
      options.expectedKeyringVersion = parseInteger(argv[index + 1], options.expectedKeyringVersion);
      index += 1;
      continue;
    }
    if (arg === '--min-rsa-bits' && index + 1 < argv.length) {
      options.minRsaBits = parseInteger(argv[index + 1], options.minRsaBits);
      index += 1;
      continue;
    }
    if (arg === '--min-rotation-overlap-hours' && index + 1 < argv.length) {
      options.minRotationOverlapHours = parseInteger(argv[index + 1], options.minRotationOverlapHours);
      index += 1;
      continue;
    }
    if (arg === '--contract-only') {
      options.contractOnly = true;
      continue;
    }
  }

  return options;
}

function resolveEffectiveRequireSignature(options) {
  const keyConfigured =
    Boolean(options.publicKeyPem) || Boolean(options.publicKeyFile) || Boolean(options.publicKeyringFile);
  if (options.requireSignature) {
    return true;
  }
  if (options.autoRequireSignatureWhenKeyAvailable && keyConfigured) {
    return true;
  }
  return false;
}

function validateKeyPolicyConfiguration(options) {
  const overlap = options.allowedKeyIds.filter((id) => options.revokedKeyIds.includes(id));
  if (overlap.length > 0) {
    fail(`Allowed/revoked key-id policy conflict: ${overlap.join(', ')}`);
  }
  if (options.requiredKeyId) {
    if (options.allowedKeyIds.length > 0 && !options.allowedKeyIds.includes(options.requiredKeyId)) {
      fail(
        `required-key-id "${options.requiredKeyId}" is not included in allowed key IDs policy.`
      );
    }
    if (options.revokedKeyIds.includes(options.requiredKeyId)) {
      fail(`required-key-id "${options.requiredKeyId}" is marked as revoked.`);
    }
  }
}

function parseIsoTimestamp(value, fieldName) {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(String(value));
  if (!Number.isFinite(parsed)) {
    fail(`${fieldName} must be a valid ISO timestamp.`);
  }
  return parsed;
}

function normalizeKeyStatus(value) {
  const status = String(value || 'active').trim().toLowerCase();
  if (status === 'active' || status === 'retired' || status === 'revoked') {
    return status;
  }
  fail(`Unsupported key status "${String(value)}". Expected active|retired|revoked.`);
}

function loadPublicKeyring(options) {
  if (options.keyring) {
    return options.keyring;
  }
  if (!options.publicKeyringFile) {
    return null;
  }

  const resolvedPath = path.resolve(repoRoot, options.publicKeyringFile);
  if (!fs.existsSync(resolvedPath)) {
    fail(`Public keyring file not found: ${resolvedPath}`);
  }

  const keyringJson = loadJson(resolvedPath, 'SBOM public keyring');
  if (options.requireKeyringSchemaPin) {
    const schema = String(keyringJson.schema || '').trim();
    if (schema !== options.expectedKeyringSchema) {
      fail(
        `SBOM keyring schema mismatch. expected="${options.expectedKeyringSchema}" actual="${schema}".`
      );
    }
    const version = Number(keyringJson.version);
    if (version !== options.expectedKeyringVersion) {
      fail(
        `SBOM keyring version mismatch. expected="${options.expectedKeyringVersion}" actual="${String(
          keyringJson.version || ''
        )}".`
      );
    }
  }
  const keysRaw = keyringJson && Array.isArray(keyringJson.keys) ? keyringJson.keys : null;
  if (!keysRaw || keysRaw.length === 0) {
    fail('SBOM public keyring must contain a non-empty keys array.');
  }

  const byId = new Map();
  const keys = [];
  for (const keyEntry of keysRaw) {
    if (!keyEntry || typeof keyEntry !== 'object') {
      fail('SBOM public keyring keys entries must be objects.');
    }
    const keyId = String(keyEntry.keyId || '').trim();
    if (!keyId) {
      fail('SBOM public keyring key entry must include keyId.');
    }
    if (byId.has(keyId)) {
      fail(`SBOM public keyring contains duplicate keyId "${keyId}".`);
    }

    let publicKeyPem = String(keyEntry.publicKeyPem || '').trim();
    const publicKeyFile = String(keyEntry.publicKeyFile || '').trim();
    if (!publicKeyPem && publicKeyFile) {
      const resolvedKeyFile = path.resolve(repoRoot, publicKeyFile);
      if (!fs.existsSync(resolvedKeyFile)) {
        fail(`SBOM public key file not found for keyId "${keyId}": ${resolvedKeyFile}`);
      }
      publicKeyPem = fs.readFileSync(resolvedKeyFile, 'utf8');
    }
    if (!publicKeyPem) {
      fail(`SBOM public keyring keyId "${keyId}" is missing publicKeyPem/publicKeyFile.`);
    }

    const status = normalizeKeyStatus(keyEntry.status);
    const validFromMs = parseIsoTimestamp(keyEntry.validFrom, `keyId "${keyId}" validFrom`);
    const validToMs = parseIsoTimestamp(keyEntry.validTo, `keyId "${keyId}" validTo`);
    if (validFromMs !== null && validToMs !== null && validFromMs > validToMs) {
      fail(`keyId "${keyId}" has invalid validity window: validFrom > validTo.`);
    }

    const normalized = {
      keyId,
      status,
      publicKeyPem,
      validFromMs,
      validToMs,
    };
    byId.set(keyId, normalized);
    keys.push(normalized);
  }

  options.keyring = { path: resolvedPath, keys, byId };
  return options.keyring;
}

function validateRotationOverlapPolicy(options, keyring) {
  const minOverlapHours = options.minRotationOverlapHours;
  if (minOverlapHours <= 0) {
    return;
  }

  const minOverlapMs = minOverlapHours * 60 * 60 * 1000;
  const scheduledKeys = keyring.keys
    .filter((entry) => entry.status !== 'revoked' && entry.validFromMs !== null && entry.validToMs !== null)
    .sort((left, right) => left.validFromMs - right.validFromMs);

  if (scheduledKeys.length < 2) {
    fail(
      `Rotation overlap policy requires at least two scheduled non-revoked keys (found ${scheduledKeys.length}).`
    );
  }

  for (let index = 0; index < scheduledKeys.length - 1; index += 1) {
    const current = scheduledKeys[index];
    const next = scheduledKeys[index + 1];
    const overlapMs = Math.min(current.validToMs, next.validToMs) - Math.max(current.validFromMs, next.validFromMs);
    if (overlapMs < minOverlapMs) {
      fail(
        `Rotation overlap too small between keyId "${current.keyId}" and "${next.keyId}". ` +
          `Required >= ${minOverlapHours}h.`
      );
    }
  }
}

function normalizePathForLog(targetPath) {
  return path.relative(repoRoot, targetPath).replace(/\\/g, '/');
}

function fail(message) {
  console.error(`[SBOM Attestation Verify] FAIL ${message}`);
  process.exit(1);
}

function loadJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail(`Failed to parse ${label} (${normalizePathForLog(filePath)}): ${detail}`);
  }
}

function computeFileSha256Hex(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function computeSha256HexUtf8(content) {
  return crypto.createHash('sha256').update(Buffer.from(content, 'utf8')).digest('hex');
}

function loadPackageMetadata(packageJsonPath) {
  if (!fs.existsSync(packageJsonPath)) {
    fail(`package.json not found: ${packageJsonPath}`);
  }
  const pkg = loadJson(packageJsonPath, 'package.json');
  const repository =
    typeof pkg.repository === 'string'
      ? pkg.repository
      : pkg.repository && typeof pkg.repository.url === 'string'
        ? pkg.repository.url
        : '';
  return {
    name: String(pkg.name || '').trim(),
    version: String(pkg.version || '').trim(),
    repositoryUrl: String(repository || '').trim(),
  };
}

function normalizeProvenance(attestationBody) {
  const provenance = attestationBody && typeof attestationBody.provenance === 'object' ? attestationBody.provenance : {};
  const repository = provenance && typeof provenance.repository === 'object' ? provenance.repository : {};
  const pkg = provenance && typeof provenance.package === 'object' ? provenance.package : {};
  const release = provenance && typeof provenance.release === 'object' ? provenance.release : {};
  return {
    repositoryUrl: String(repository.url || '').trim(),
    packageName: String(pkg.name || '').trim(),
    packageVersion: String(pkg.version || '').trim(),
    releaseCommitSha: String(release.commitSha || '').trim(),
    releaseGitTag: String(release.gitTag || '').trim(),
    releaseRef: String(release.ref || '').trim(),
    releaseRunId: String(release.runId || '').trim(),
  };
}

function buildSigningPayload(attestationBody) {
  const provenance = normalizeProvenance(attestationBody);
  return [
    `schema=${EXPECTED_SCHEMA}`,
    `version=${String(EXPECTED_VERSION)}`,
    `generatedAt=${String(attestationBody.generatedAt)}`,
    `sbomPath=${String(attestationBody.sbom.path)}`,
    `sbomSha256=${String(attestationBody.sbom.sha256)}`,
    `sbomSizeBytes=${String(attestationBody.sbom.sizeBytes)}`,
    `provenanceRepositoryUrl=${provenance.repositoryUrl}`,
    `provenancePackageName=${provenance.packageName}`,
    `provenancePackageVersion=${provenance.packageVersion}`,
    `provenanceReleaseCommitSha=${provenance.releaseCommitSha}`,
    `provenanceReleaseGitTag=${provenance.releaseGitTag}`,
    `provenanceReleaseRef=${provenance.releaseRef}`,
    `provenanceReleaseRunId=${provenance.releaseRunId}`,
    '',
  ].join('\n');
}

function buildTransparencyEntryHash(attestation) {
  const signature = attestation && attestation.signature ? attestation.signature : {};
  return computeSha256HexUtf8(
    [
      buildSigningPayload(attestation),
      `signatureAlgorithm=${String(signature.algorithm || '')}`,
      `signatureKeyId=${String(signature.keyId || '')}`,
      `signatureValueBase64=${String(signature.valueBase64 || '')}`,
      '',
    ].join('\n')
  );
}

function deriveTransparencyCumulativeHash(index, previousCumulativeHash, entryHash) {
  return computeSha256HexUtf8(
    [
      `index=${String(index)}`,
      `previous=${String(previousCumulativeHash || '')}`,
      `entry=${String(entryHash || '')}`,
      '',
    ].join('\n')
  );
}

function resolveTransparencyLogPath(attestation, options) {
  const explicit = String(options.transparencyLogPath || '').trim();
  if (explicit) {
    return path.resolve(repoRoot, explicit);
  }
  const attestationPath =
    attestation &&
    attestation.transparencyLog &&
    typeof attestation.transparencyLog === 'object'
      ? String(attestation.transparencyLog.logPath || '').trim()
      : '';
  if (!attestationPath) {
    return defaultTransparencyLogPath;
  }
  return path.resolve(repoRoot, attestationPath);
}

function parseTransparencyLogEntries(logPath) {
  if (!fs.existsSync(logPath)) {
    fail(`Transparency log not found: ${normalizePathForLog(logPath)}.`);
  }
  const raw = fs.readFileSync(logPath, 'utf8');
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const entries = [];
  for (const [index, line] of lines.entries()) {
    let parsed = null;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      fail(`Transparency log line ${index + 1} is not valid JSON.`);
    }
    entries.push(parsed);
  }
  return entries;
}

function assertTransparencyEntrySchema(entry, options, label) {
  if (!options.requireTransparencySchemaPin) {
    return;
  }
  const schema = String(entry.schema || '').trim();
  if (schema !== options.expectedTransparencySchema) {
    fail(`${label} schema mismatch. expected="${options.expectedTransparencySchema}" actual="${schema}".`);
  }
  const version = Number(entry.version);
  if (version !== options.expectedTransparencyVersion) {
    fail(
      `${label} version mismatch. expected="${options.expectedTransparencyVersion}" actual="${String(entry.version || '')}".`
    );
  }
}

function verifyTransparencyLog(attestation, options) {
  const proof =
    attestation && attestation.transparencyLog && typeof attestation.transparencyLog === 'object'
      ? attestation.transparencyLog
      : null;
  if (!proof) {
    if (options.requireTransparencyLog) {
      fail('Attestation transparencyLog proof is required by policy but missing.');
    }
    return;
  }
  if (!attestation.signature || typeof attestation.signature !== 'object') {
    fail('Transparency log proof requires a signed attestation.');
  }

  assertTransparencyEntrySchema(proof, options, 'Attestation transparency proof');

  const index = Number(proof.index);
  if (!Number.isInteger(index) || index < 0) {
    fail('Attestation transparency proof index must be a non-negative integer.');
  }

  const previous = String(proof.previousCumulativeHash || '');
  const entryHash = String(proof.entryHash || '');
  const cumulativeHash = String(proof.cumulativeHash || '');
  if (!entryHash || !cumulativeHash) {
    fail('Attestation transparency proof entryHash/cumulativeHash must be non-empty.');
  }

  const expectedEntryHash = buildTransparencyEntryHash(attestation);
  if (entryHash !== expectedEntryHash) {
    fail(`Attestation transparency proof entryHash mismatch. expected=${expectedEntryHash} actual=${entryHash}`);
  }

  const expectedCumulative = deriveTransparencyCumulativeHash(index, previous, entryHash);
  if (cumulativeHash !== expectedCumulative) {
    fail('Attestation transparency proof cumulativeHash is invalid for the provided index/previous hash.');
  }

  if (!options.verifyTransparencyLogInclusion) {
    return;
  }

  const logPath = resolveTransparencyLogPath(attestation, options);
  if (!logPath) {
    fail('Transparency log inclusion verification requires a log path (env or attestation proof).');
  }

  const entries = parseTransparencyLogEntries(logPath);
  if (index >= entries.length) {
    fail(`Transparency log inclusion proof index ${index} is outside log bounds (${entries.length}).`);
  }

  for (let cursor = 0; cursor < entries.length; cursor += 1) {
    const entry = entries[cursor] || {};
    assertTransparencyEntrySchema(entry, options, `Transparency log entry ${cursor}`);
    if (Number(entry.index) !== cursor) {
      fail(`Transparency log entry index mismatch at ${cursor}.`);
    }
    const expectedPrevious = cursor === 0 ? '' : String(entries[cursor - 1].cumulativeHash || '');
    if (String(entry.previousCumulativeHash || '') !== expectedPrevious) {
      fail(`Transparency log previousCumulativeHash mismatch at index ${cursor}.`);
    }
    const expectedCursorCumulative = deriveTransparencyCumulativeHash(
      cursor,
      expectedPrevious,
      String(entry.entryHash || '')
    );
    if (String(entry.cumulativeHash || '') !== expectedCursorCumulative) {
      fail(`Transparency log cumulativeHash mismatch at index ${cursor}.`);
    }
  }

  const matchedEntry = entries[index] || {};
  if (String(matchedEntry.entryHash || '') !== entryHash) {
    fail('Transparency log inclusion entryHash mismatch.');
  }
  if (String(matchedEntry.cumulativeHash || '') !== cumulativeHash) {
    fail('Transparency log inclusion cumulativeHash mismatch.');
  }
  if (String(matchedEntry.previousCumulativeHash || '') !== previous) {
    fail('Transparency log inclusion previousCumulativeHash mismatch.');
  }

  const signatureKeyId = String((attestation.signature && attestation.signature.keyId) || '');
  if (String(matchedEntry.keyId || '') !== signatureKeyId) {
    fail(
      `Transparency log inclusion keyId mismatch. expected="${signatureKeyId}" actual="${String(matchedEntry.keyId || '')}".`
    );
  }
}

function verifyProvenance(attestation, options, packageMeta) {
  const hasProvenance = Boolean(attestation.provenance && typeof attestation.provenance === 'object');
  if (options.requireProvenance && !hasProvenance) {
    fail('Attestation provenance is required by policy but missing.');
  }
  if (!hasProvenance) {
    return;
  }

  const provenance = normalizeProvenance(attestation);
  if (!provenance.packageName || !provenance.packageVersion) {
    fail('Attestation provenance.package.name/version are required when provenance is present.');
  }

  if (packageMeta.name && provenance.packageName !== packageMeta.name) {
    fail(
      `Attestation provenance.package.name mismatch. expected="${packageMeta.name}" actual="${provenance.packageName}".`
    );
  }
  if (packageMeta.version && provenance.packageVersion !== packageMeta.version) {
    fail(
      `Attestation provenance.package.version mismatch. expected="${packageMeta.version}" actual="${provenance.packageVersion}".`
    );
  }

  if (options.expectedRepositoryUrl && provenance.repositoryUrl !== options.expectedRepositoryUrl) {
    fail(
      `Attestation provenance.repository.url mismatch. expected="${options.expectedRepositoryUrl}" actual="${provenance.repositoryUrl}".`
    );
  }
  if (options.expectedReleaseCommitSha && provenance.releaseCommitSha !== options.expectedReleaseCommitSha) {
    fail(
      `Attestation provenance.release.commitSha mismatch. expected="${options.expectedReleaseCommitSha}" actual="${provenance.releaseCommitSha}".`
    );
  }
  if (options.expectedReleaseGitTag && provenance.releaseGitTag !== options.expectedReleaseGitTag) {
    fail(
      `Attestation provenance.release.gitTag mismatch. expected="${options.expectedReleaseGitTag}" actual="${provenance.releaseGitTag}".`
    );
  }
  if (options.expectedReleaseRef && provenance.releaseRef !== options.expectedReleaseRef) {
    fail(
      `Attestation provenance.release.ref mismatch. expected="${options.expectedReleaseRef}" actual="${provenance.releaseRef}".`
    );
  }
  if (options.expectedReleaseRunId && provenance.releaseRunId !== options.expectedReleaseRunId) {
    fail(
      `Attestation provenance.release.runId mismatch. expected="${options.expectedReleaseRunId}" actual="${provenance.releaseRunId}".`
    );
  }
}

function resolvePublicKeyPem(options) {
  if (options.publicKeyPem) {
    return options.publicKeyPem;
  }
  if (options.publicKeyFile) {
    const resolvedKeyPath = path.resolve(repoRoot, options.publicKeyFile);
    if (!fs.existsSync(resolvedKeyPath)) {
      fail(`Public key file not found: ${resolvedKeyPath}`);
    }
    return fs.readFileSync(resolvedKeyPath, 'utf8');
  }
  return '';
}

function resolveVerifierPublicKey(attestation, options) {
  const keyring = loadPublicKeyring(options);
  if (keyring) {
    validateRotationOverlapPolicy(options, keyring);
    const signature = attestation.signature || {};
    const keyId = String(signature.keyId || '').trim();
    if (!keyId) {
      fail('Signed attestation must include signature.keyId when keyring policy is enabled.');
    }
    const keyEntry = keyring.byId.get(keyId);
    if (!keyEntry) {
      fail(`No matching keyId "${keyId}" found in public keyring policy.`);
    }
    if (keyEntry.status === 'revoked') {
      fail(`signature.keyId "${keyId}" is revoked in keyring policy.`);
    }

    const generatedAtMs = Date.parse(String(attestation.generatedAt || ''));
    if (Number.isFinite(generatedAtMs)) {
      const overlapMs = options.minRotationOverlapHours * 60 * 60 * 1000;
      const windowStart =
        keyEntry.validFromMs === null ? Number.NEGATIVE_INFINITY : keyEntry.validFromMs - overlapMs;
      const windowEnd =
        keyEntry.validToMs === null ? Number.POSITIVE_INFINITY : keyEntry.validToMs + overlapMs;
      if (generatedAtMs < windowStart || generatedAtMs > windowEnd) {
        fail(
          `Attestation generatedAt is outside keyId "${keyId}" validity window ` +
            `(with overlap tolerance ${options.minRotationOverlapHours}h).`
        );
      }
    }
    return keyEntry.publicKeyPem;
  }

  return resolvePublicKeyPem(options);
}

function enforceMinimumKeyStrength(publicKeyPem, options) {
  if (options.minRsaBits <= 0) {
    return;
  }

  let keyObject = null;
  try {
    keyObject = crypto.createPublicKey(publicKeyPem);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail(`Unable to parse public key for minimum strength check: ${detail}`);
  }

  if (String(keyObject.asymmetricKeyType || '').toLowerCase() !== 'rsa') {
    fail(`Attestation verification key must be RSA (received ${String(keyObject.asymmetricKeyType || 'unknown')}).`);
  }

  const keyDetails = keyObject.asymmetricKeyDetails || {};
  const modulusLength = Number(keyDetails.modulusLength || 0);
  if (!Number.isFinite(modulusLength) || modulusLength <= 0) {
    fail('Unable to determine RSA modulus length for key-strength policy.');
  }
  if (modulusLength < options.minRsaBits) {
    fail(`RSA key strength is too weak (${modulusLength} bits). Minimum required is ${options.minRsaBits} bits.`);
  }
}

function validateFreshness(attestation, maxAgeHours) {
  if (maxAgeHours <= 0) {
    return;
  }
  const generatedAtMs = Date.parse(String(attestation.generatedAt || ''));
  if (!Number.isFinite(generatedAtMs)) {
    fail('Attestation generatedAt must be a valid ISO timestamp.');
  }
  const ageHours = (Date.now() - generatedAtMs) / (1000 * 60 * 60);
  if (ageHours > maxAgeHours) {
    fail(`Attestation is stale (${ageHours.toFixed(2)}h), exceeding max age ${maxAgeHours}h.`);
  }
}

function validateSignedKeyId(signature, options) {
  const keyId = String(signature.keyId || '').trim();
  if (options.requireSignedKeyId && !keyId) {
    fail('Signed attestation must include signature.keyId.');
  }

  if (
    keyId &&
    !options.allowUnspecifiedKeyId &&
    keyId.toLowerCase() === 'unspecified'
  ) {
    fail('signature.keyId "unspecified" is forbidden by policy.');
  }

  if (options.requiredKeyId && keyId !== options.requiredKeyId) {
    fail(`signature.keyId mismatch. expected="${options.requiredKeyId}" actual="${keyId}"`);
  }

  if (keyId && options.revokedKeyIds.includes(keyId)) {
    fail(`signature.keyId "${keyId}" is revoked by policy.`);
  }

  if (options.allowedKeyIds.length > 0 && !options.allowedKeyIds.includes(keyId)) {
    fail(
      `signature.keyId "${keyId}" is not in allowed key IDs policy: ${options.allowedKeyIds.join(', ')}`
    );
  }
}

function verifySignatureIfPresent(attestation, options) {
  const signature = attestation.signature;
  if (!signature) {
    if (options.requireSignature) {
      fail('Signature is required but attestation.signature is missing.');
    }
    return;
  }

  if (signature.algorithm !== EXPECTED_SIGNATURE_ALGORITHM) {
    fail(`Unsupported signature algorithm "${String(signature.algorithm)}".`);
  }
  const valueBase64 = String(signature.valueBase64 || '').trim();
  if (!valueBase64) {
    fail('Attestation signature valueBase64 must be non-empty when signature is present.');
  }
  validateSignedKeyId(signature, options);

  const publicKeyPem = resolveVerifierPublicKey(attestation, options);
  if (!publicKeyPem) {
    if (options.requireSignature || options.strict) {
      fail('Signature verification requires a public key via NOTE_CONNECTION_SBOM_SIGNING_PUBLIC_KEY_*.');
    }
    console.warn(
      '[SBOM Attestation Verify] Public key is not provided; skipping signature verification in non-strict mode.'
    );
    return;
  }
  enforceMinimumKeyStrength(publicKeyPem, options);

  const payload = buildSigningPayload(attestation);
  const verified = crypto.verify(
    SIGNATURE_SCHEME,
    Buffer.from(payload, 'utf8'),
    publicKeyPem,
    Buffer.from(valueBase64, 'base64')
  );
  if (!verified) {
    fail('Attestation signature verification failed.');
  }
}

function main() {
  const options = parseArgs(process.argv);
  options.requireSignature = resolveEffectiveRequireSignature(options);
  validateKeyPolicyConfiguration(options);
  const packageMeta = loadPackageMetadata(options.packageJsonPath);

  if (options.contractOnly) {
    console.log('[SBOM Attestation Verify] Contract-only mode passed.');
    console.log(`[SBOM Attestation Verify] strict=${options.strict}`);
    console.log(`[SBOM Attestation Verify] requireSignature=${options.requireSignature}`);
    console.log(
      `[SBOM Attestation Verify] autoRequireSignatureWhenKeyAvailable=${options.autoRequireSignatureWhenKeyAvailable}`
    );
    console.log(`[SBOM Attestation Verify] requireSignedKeyId=${options.requireSignedKeyId}`);
    console.log(
      `[SBOM Attestation Verify] keyPolicy allowed=${options.allowedKeyIds.length} revoked=${options.revokedKeyIds.length}`
    );
    console.log(`[SBOM Attestation Verify] minRsaBits=${options.minRsaBits}`);
    console.log(`[SBOM Attestation Verify] minRotationOverlapHours=${options.minRotationOverlapHours}`);
    console.log(
      `[SBOM Attestation Verify] keyringConfigured=${options.publicKeyringFile ? '1' : '0'}`
    );
    console.log(`[SBOM Attestation Verify] requireProvenance=${options.requireProvenance}`);
    console.log(
      `[SBOM Attestation Verify] transparency require=${options.requireTransparencyLog} ` +
      `inclusion=${options.verifyTransparencyLogInclusion}`
    );
    console.log(
      `[SBOM Attestation Verify] expectedRelease commit=${options.expectedReleaseCommitSha ? '1' : '0'} ` +
      `tag=${options.expectedReleaseGitTag ? '1' : '0'} ref=${options.expectedReleaseRef ? '1' : '0'}`
    );
    console.log(
      `[SBOM Attestation Verify] keyringSchemaPin=${options.requireKeyringSchemaPin} ` +
      `schema=${options.expectedKeyringSchema} version=${options.expectedKeyringVersion}`
    );
    console.log(
      `[SBOM Attestation Verify] packageMeta name=${packageMeta.name} version=${packageMeta.version}`
    );
    return;
  }

  if (!fs.existsSync(options.attestationPath)) {
    if (!options.strict && options.allowMissing) {
      console.warn(
        `[SBOM Attestation Verify] Attestation missing at ${normalizePathForLog(options.attestationPath)} ` +
        'but allowed in non-strict mode.'
      );
      return;
    }
    fail(
      `Attestation not found: ${normalizePathForLog(options.attestationPath)}. ` +
      'Run "npm run generate:sbom:attestation" first.'
    );
  }

  if (!fs.existsSync(options.sbomPath)) {
    fail(`SBOM not found: ${normalizePathForLog(options.sbomPath)}.`);
  }

  const attestation = loadJson(options.attestationPath, 'SBOM attestation');
  if (String(attestation.schema || '') !== EXPECTED_SCHEMA) {
    fail(`Unexpected attestation schema "${String(attestation.schema || '')}".`);
  }
  if (Number(attestation.version) !== EXPECTED_VERSION) {
    fail(`Unexpected attestation version "${String(attestation.version || '')}".`);
  }
  if (!attestation.sbom || typeof attestation.sbom !== 'object') {
    fail('Attestation sbom object is required.');
  }

  validateFreshness(attestation, options.maxAgeHours);
  verifyProvenance(attestation, options, packageMeta);

  const expectedSbomHash = computeFileSha256Hex(options.sbomPath);
  if (String(attestation.sbom.sha256 || '').toLowerCase() !== expectedSbomHash.toLowerCase()) {
    fail(
      `Attestation sbom.sha256 mismatch. expected=${expectedSbomHash} actual=${String(attestation.sbom.sha256 || '')}`
    );
  }

  const actualSbomSize = fs.statSync(options.sbomPath).size;
  if (Number(attestation.sbom.sizeBytes) !== actualSbomSize) {
    fail(
      `Attestation sbom.sizeBytes mismatch. expected=${actualSbomSize} actual=${String(attestation.sbom.sizeBytes || '')}`
    );
  }

  verifySignatureIfPresent(attestation, options);
  verifyTransparencyLog(attestation, options);

  console.log(
    `[SBOM Attestation Verify] PASS ${normalizePathForLog(options.attestationPath)} ` +
    `(strict=${options.strict}, requireSignature=${options.requireSignature})`
  );
}

main();
