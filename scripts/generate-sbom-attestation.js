#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repoRoot = path.resolve(__dirname, '..');
const defaultSbomPath = path.join(repoRoot, 'build', 'sbom', 'noteconnection-sbom.cdx.json');
const defaultOutputPath = path.join(repoRoot, 'build', 'sbom', 'noteconnection-sbom.attestation.json');
const defaultPackageJsonPath = path.join(repoRoot, 'package.json');
const defaultTransparencyLogPath = path.join(repoRoot, 'build', 'sbom', 'attestation-transparency-log.jsonl');
const ATTESTATION_VERSION = 1;
const ATTESTATION_SCHEMA = 'noteconnection/sbom-attestation/v1';
const TRANSPARENCY_SCHEMA = 'noteconnection/sbom-attestation-transparency/v1';
const TRANSPARENCY_VERSION = 1;
const SIGNATURE_SCHEME = 'sha256';
const SIGNATURE_ALGORITHM = 'RSA-SHA256';

function parseBoolean(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parseArgs(argv) {
  const options = {
    sbomPath: defaultSbomPath,
    outputPath: defaultOutputPath,
    packageJsonPath: defaultPackageJsonPath,
    enableTransparencyLog: parseBoolean(
      process.env.NOTE_CONNECTION_SBOM_ATTESTATION_ENABLE_TRANSPARENCY_LOG === undefined
        ? '0'
        : process.env.NOTE_CONNECTION_SBOM_ATTESTATION_ENABLE_TRANSPARENCY_LOG
    ),
    transparencyLogPath: path.resolve(
      repoRoot,
      String(process.env.NOTE_CONNECTION_SBOM_ATTESTATION_TRANSPARENCY_LOG_PATH || defaultTransparencyLogPath)
    ),
    includeProvenance: parseBoolean(
      process.env.NOTE_CONNECTION_SBOM_ATTESTATION_INCLUDE_PROVENANCE === undefined
        ? '1'
        : process.env.NOTE_CONNECTION_SBOM_ATTESTATION_INCLUDE_PROVENANCE
    ),
    keyId: String(process.env.NOTE_CONNECTION_SBOM_ATTESTATION_KEY_ID || '').trim(),
    signingKeyPem: String(process.env.NOTE_CONNECTION_SBOM_SIGNING_PRIVATE_KEY_PEM || '').trim(),
    signingKeyFile: String(process.env.NOTE_CONNECTION_SBOM_SIGNING_PRIVATE_KEY_FILE || '').trim(),
    repositoryUrl: String(process.env.NOTE_CONNECTION_RELEASE_REPOSITORY_URL || '').trim(),
    releaseCommitSha: String(
      process.env.NOTE_CONNECTION_RELEASE_COMMIT_SHA || process.env.GITHUB_SHA || ''
    ).trim(),
    releaseGitTag: String(
      process.env.NOTE_CONNECTION_RELEASE_GIT_TAG ||
        (String(process.env.GITHUB_REF_TYPE || '').trim().toLowerCase() === 'tag'
          ? String(process.env.GITHUB_REF_NAME || '')
          : '') ||
        ''
    ).trim(),
    releaseRef: String(process.env.NOTE_CONNECTION_RELEASE_REF || process.env.GITHUB_REF || '').trim(),
    releaseRunId: String(process.env.NOTE_CONNECTION_RELEASE_RUN_ID || process.env.GITHUB_RUN_ID || '').trim(),
    allowUnsigned: parseBoolean(
      process.env.NOTE_CONNECTION_SBOM_ATTESTATION_ALLOW_UNSIGNED === undefined
        ? '1'
        : process.env.NOTE_CONNECTION_SBOM_ATTESTATION_ALLOW_UNSIGNED
    ),
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
    if (arg === '--output' && index + 1 < argv.length) {
      options.outputPath = path.resolve(repoRoot, String(argv[index + 1]));
      index += 1;
      continue;
    }
    if (arg === '--package-json' && index + 1 < argv.length) {
      options.packageJsonPath = path.resolve(repoRoot, String(argv[index + 1]));
      index += 1;
      continue;
    }
    if (arg === '--include-provenance' && index + 1 < argv.length) {
      options.includeProvenance = parseBoolean(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--enable-transparency-log' && index + 1 < argv.length) {
      options.enableTransparencyLog = parseBoolean(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--transparency-log-path' && index + 1 < argv.length) {
      options.transparencyLogPath = path.resolve(repoRoot, String(argv[index + 1]));
      index += 1;
      continue;
    }
    if (arg === '--key-id' && index + 1 < argv.length) {
      options.keyId = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (arg === '--signing-key-file' && index + 1 < argv.length) {
      options.signingKeyFile = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (arg === '--allow-unsigned' && index + 1 < argv.length) {
      options.allowUnsigned = parseBoolean(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--release-commit' && index + 1 < argv.length) {
      options.releaseCommitSha = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (arg === '--release-tag' && index + 1 < argv.length) {
      options.releaseGitTag = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (arg === '--release-ref' && index + 1 < argv.length) {
      options.releaseRef = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (arg === '--release-run-id' && index + 1 < argv.length) {
      options.releaseRunId = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (arg === '--repository-url' && index + 1 < argv.length) {
      options.repositoryUrl = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
  }

  return options;
}

function normalizePathForManifest(targetPath) {
  return path.relative(repoRoot, targetPath).replace(/\\/g, '/');
}

function readSigningKeyPem(options) {
  if (options.signingKeyPem) {
    return options.signingKeyPem;
  }
  if (options.signingKeyFile) {
    const resolvedKeyPath = path.resolve(repoRoot, options.signingKeyFile);
    if (!fs.existsSync(resolvedKeyPath)) {
      throw new Error(`Signing key file not found: ${resolvedKeyPath}`);
    }
    return fs.readFileSync(resolvedKeyPath, 'utf8');
  }
  return '';
}

function computeFileSha256Hex(filePath) {
  const hash = crypto.createHash('sha256');
  const content = fs.readFileSync(filePath);
  hash.update(content);
  return hash.digest('hex');
}

function computeSha256HexUtf8(content) {
  return crypto.createHash('sha256').update(Buffer.from(content, 'utf8')).digest('hex');
}

function loadPackageMetadata(packageJsonPath) {
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`package.json not found: ${packageJsonPath}`);
  }
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
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
    `schema=${ATTESTATION_SCHEMA}`,
    `version=${String(ATTESTATION_VERSION)}`,
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

function buildTransparencyEntryHash(attestationBody, signature) {
  return computeSha256HexUtf8(
    [
      buildSigningPayload(attestationBody),
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

function loadTransparencyLogEntries(logPath) {
  if (!fs.existsSync(logPath)) {
    return [];
  }
  const raw = fs.readFileSync(logPath, 'utf8');
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const entries = [];
  for (const [lineIndex, line] of lines.entries()) {
    let parsed = null;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      throw new Error(`Transparency log line ${lineIndex + 1} is not valid JSON.`);
    }
    entries.push(parsed);
  }
  return entries;
}

function validateTransparencyLogChain(entries) {
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index] || {};
    if (String(entry.schema || '') !== TRANSPARENCY_SCHEMA) {
      throw new Error(`Transparency log entry ${index} has unexpected schema.`);
    }
    if (Number(entry.version) !== TRANSPARENCY_VERSION) {
      throw new Error(`Transparency log entry ${index} has unexpected version.`);
    }
    if (Number(entry.index) !== index) {
      throw new Error(`Transparency log entry index mismatch at ${index}.`);
    }
    const expectedPrevious = index === 0 ? '' : String(entries[index - 1].cumulativeHash || '');
    if (String(entry.previousCumulativeHash || '') !== expectedPrevious) {
      throw new Error(`Transparency log previous hash mismatch at index ${index}.`);
    }
    const expectedCumulative = deriveTransparencyCumulativeHash(
      index,
      expectedPrevious,
      String(entry.entryHash || '')
    );
    if (String(entry.cumulativeHash || '') !== expectedCumulative) {
      throw new Error(`Transparency log cumulative hash mismatch at index ${index}.`);
    }
  }
}

function appendTransparencyEntry(attestationBody, attestation, options) {
  if (!options.enableTransparencyLog) {
    return;
  }
  if (!attestation.signature) {
    throw new Error('Transparency log requires a signed attestation.');
  }

  const existingEntries = loadTransparencyLogEntries(options.transparencyLogPath);
  validateTransparencyLogChain(existingEntries);

  const index = existingEntries.length;
  const previousCumulativeHash = index === 0 ? '' : String(existingEntries[index - 1].cumulativeHash || '');
  const entryHash = buildTransparencyEntryHash(attestationBody, attestation.signature);
  const cumulativeHash = deriveTransparencyCumulativeHash(index, previousCumulativeHash, entryHash);

  const logEntry = {
    schema: TRANSPARENCY_SCHEMA,
    version: TRANSPARENCY_VERSION,
    index,
    generatedAt: attestation.generatedAt,
    keyId: String(attestation.signature.keyId || ''),
    entryHash,
    previousCumulativeHash,
    cumulativeHash,
  };

  fs.mkdirSync(path.dirname(options.transparencyLogPath), { recursive: true });
  fs.appendFileSync(options.transparencyLogPath, `${JSON.stringify(logEntry)}\n`, 'utf8');

  attestation.transparencyLog = {
    schema: TRANSPARENCY_SCHEMA,
    version: TRANSPARENCY_VERSION,
    logPath: normalizePathForManifest(options.transparencyLogPath),
    index,
    entryHash,
    previousCumulativeHash,
    cumulativeHash,
  };
}

function buildAttestationBody(options, sbomStats, sbomHashHex, pkgMeta) {
  const attestationBody = {
    schema: ATTESTATION_SCHEMA,
    version: ATTESTATION_VERSION,
    generatedAt: new Date().toISOString(),
    sbom: {
      path: normalizePathForManifest(options.sbomPath),
      sha256: sbomHashHex,
      sizeBytes: sbomStats.size,
    },
  };

  if (options.includeProvenance) {
    attestationBody.provenance = {
      repository: {
        url: options.repositoryUrl || pkgMeta.repositoryUrl || '',
      },
      package: {
        name: pkgMeta.name,
        version: pkgMeta.version,
      },
      release: {
        commitSha: options.releaseCommitSha,
        gitTag: options.releaseGitTag,
        ref: options.releaseRef,
        runId: options.releaseRunId,
      },
    };
  }

  return attestationBody;
}

function main() {
  const options = parseArgs(process.argv);
  if (!fs.existsSync(options.sbomPath)) {
    console.error(
      `[SBOM Attestation] SBOM not found: ${normalizePathForManifest(options.sbomPath)}. Run "npm run generate:sbom" first.`
    );
    process.exit(1);
    return;
  }

  const sbomStats = fs.statSync(options.sbomPath);
  const sbomHashHex = computeFileSha256Hex(options.sbomPath);
  const pkgMeta = loadPackageMetadata(options.packageJsonPath);
  const attestationBody = buildAttestationBody(options, sbomStats, sbomHashHex, pkgMeta);
  const signingPayload = buildSigningPayload(attestationBody);
  const signingKeyPem = readSigningKeyPem(options);

  const attestation = {
    ...attestationBody,
    signature: null,
  };

  if (signingKeyPem) {
    const signatureBuffer = crypto.sign(SIGNATURE_SCHEME, Buffer.from(signingPayload, 'utf8'), signingKeyPem);
    attestation.signature = {
      algorithm: SIGNATURE_ALGORITHM,
      keyId: options.keyId || 'unspecified',
      valueBase64: signatureBuffer.toString('base64'),
    };
  } else if (!options.allowUnsigned) {
    console.error(
      '[SBOM Attestation] Signing key is missing and unsigned attestations are disabled.'
    );
    process.exit(1);
    return;
  }

  appendTransparencyEntry(attestationBody, attestation, options);

  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, `${JSON.stringify(attestation, null, 2)}\n`, 'utf8');

  const outputPath = normalizePathForManifest(options.outputPath);
  const signedState = attestation.signature ? 'signed' : 'unsigned';
  const transparencyState = attestation.transparencyLog ? 'transparency-log:on' : 'transparency-log:off';
  console.log(
    `[SBOM Attestation] Wrote ${outputPath} (${signedState}, ${transparencyState}, sbomSha256=${sbomHashHex.slice(0, 16)}...)`
  );
}

main();
