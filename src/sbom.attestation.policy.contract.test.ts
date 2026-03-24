import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawnSync } from 'child_process';

type PackageJson = {
  scripts?: Record<string, string>;
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

describe('sbom attestation policy contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const generatorPath = path.join(repoRoot, 'scripts', 'generate-sbom-attestation.js');
  const verifierPath = path.join(repoRoot, 'scripts', 'verify-sbom-attestation.js');
  const migrationWorkflowPath = path.join(repoRoot, '.github', 'workflows', 'migration-gates.yml');
  const npmPublishWorkflowPath = path.join(repoRoot, '.github', 'workflows', 'npm-publish.yml');
  let noteConnectionEnvSnapshot: Record<string, string | undefined>;

  beforeEach(() => {
    // Keep contract tests hermetic even when CI injects NOTE_CONNECTION_* policy env vars.
    noteConnectionEnvSnapshot = {};
    for (const key of Object.keys(process.env)) {
      if (!key.startsWith('NOTE_CONNECTION_')) {
        continue;
      }
      noteConnectionEnvSnapshot[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('NOTE_CONNECTION_')) {
        delete process.env[key];
      }
    }
    for (const [key, value] of Object.entries(noteConnectionEnvSnapshot || {})) {
      if (typeof value === 'undefined') {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  test('exports attestation generation/verification scripts and gate wiring', () => {
    const packageJson = readJson<PackageJson>(packageJsonPath);
    const scripts = packageJson.scripts || {};

    expect(scripts['generate:sbom:attestation']).toBe('node scripts/generate-sbom-attestation.js');
    expect(scripts['verify:sbom:attestation']).toBe('node scripts/verify-sbom-attestation.js');
    expect(scripts['test:gates']).toContain('verify:sbom:attestation -- --contract-only');
  });

  test('attestation scripts expose signature controls and contract mode', () => {
    const generator = fs.readFileSync(generatorPath, 'utf8');
    const verifier = fs.readFileSync(verifierPath, 'utf8');

    expect(generator).toContain('NOTE_CONNECTION_SBOM_SIGNING_PRIVATE_KEY');
    expect(generator).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_ALLOW_UNSIGNED');
    expect(generator).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_INCLUDE_PROVENANCE');
    expect(generator).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_ENABLE_TRANSPARENCY_LOG');
    expect(generator).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_TRANSPARENCY_LOG_PATH');
    expect(generator).toContain('NOTE_CONNECTION_RELEASE_COMMIT_SHA');
    expect(generator).toContain('NOTE_CONNECTION_RELEASE_GIT_TAG');
    expect(verifier).toContain('NOTE_CONNECTION_REQUIRE_SBOM_ATTESTATION');
    expect(verifier).toContain('NOTE_CONNECTION_REQUIRE_SBOM_ATTESTATION_SIGNATURE');
    expect(verifier).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_AUTO_REQUIRE_SIGNATURE_WHEN_KEY_AVAILABLE');
    expect(verifier).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_REQUIRE_SIGNED_KEY_ID');
    expect(verifier).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_ALLOWED_KEY_IDS');
    expect(verifier).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_REVOKED_KEY_IDS');
    expect(verifier).toContain('NOTE_CONNECTION_SBOM_SIGNING_PUBLIC_KEYRING_FILE');
    expect(verifier).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_MIN_RSA_BITS');
    expect(verifier).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_MIN_ROTATION_OVERLAP_HOURS');
    expect(verifier).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_REQUIRE_PROVENANCE');
    expect(verifier).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_EXPECT_RELEASE_COMMIT_SHA');
    expect(verifier).toContain('NOTE_CONNECTION_SBOM_KEYRING_EXPECT_SCHEMA');
    expect(verifier).toContain('NOTE_CONNECTION_SBOM_KEYRING_EXPECT_VERSION');
    expect(verifier).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_REQUIRE_TRANSPARENCY_LOG');
    expect(verifier).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_VERIFY_TRANSPARENCY_LOG_INCLUSION');
    expect(verifier).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_TRANSPARENCY_REQUIRE_SCHEMA_PIN');
    expect(verifier).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_TRANSPARENCY_EXPECT_SCHEMA');
    expect(verifier).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_TRANSPARENCY_EXPECT_VERSION');
    expect(verifier).toContain('--auto-require-signature-when-key-available');
    expect(verifier).toContain('--allowed-key-ids');
    expect(verifier).toContain('--revoked-key-ids');
    expect(verifier).toContain('--public-keyring-file');
    expect(verifier).toContain('--min-rsa-bits');
    expect(verifier).toContain('--min-rotation-overlap-hours');
    expect(verifier).toContain('--require-provenance');
    expect(verifier).toContain('--expected-release-commit');
    expect(verifier).toContain('--expected-keyring-schema');
    expect(verifier).toContain('--expected-keyring-version');
    expect(verifier).toContain('--require-transparency-log');
    expect(verifier).toContain('--verify-transparency-log-inclusion');
    expect(verifier).toContain('--expected-transparency-schema');
    expect(verifier).toContain('--expected-transparency-version');
    expect(verifier).toContain('--contract-only');
  });

  test('migration and publish workflows include SBOM attestation policy gates', () => {
    const migrationWorkflow = fs.readFileSync(migrationWorkflowPath, 'utf8');
    const npmPublishWorkflow = fs.readFileSync(npmPublishWorkflowPath, 'utf8');

    expect(migrationWorkflow).toContain('sbom-attestation-policy-contract-suite');
    expect(migrationWorkflow).toContain('npm run verify:sbom:attestation -- --contract-only');
    expect(npmPublishWorkflow).toContain('npm run generate:sbom:attestation');
    expect(npmPublishWorkflow).toContain('npm run verify:sbom:attestation -- --strict 1');
    expect(npmPublishWorkflow).toContain('Validate SBOM signing key pair configuration');
    expect(npmPublishWorkflow).toContain('NOTE_CONNECTION_REQUIRE_SBOM_ATTESTATION_SIGNATURE');
    expect(npmPublishWorkflow).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_ALLOWED_KEY_IDS');
    expect(npmPublishWorkflow).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_REVOKED_KEY_IDS');
    expect(npmPublishWorkflow).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_REQUIRE_SIGNED_KEY_ID');
    expect(npmPublishWorkflow).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_MIN_RSA_BITS');
    expect(npmPublishWorkflow).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_MIN_ROTATION_OVERLAP_HOURS');
    expect(npmPublishWorkflow).toContain('Materialize SBOM signing keyring policy (optional)');
    expect(npmPublishWorkflow).toContain('NOTE_CONNECTION_SBOM_SIGNING_PUBLIC_KEYRING_FILE');
    expect(npmPublishWorkflow).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_REQUIRE_PROVENANCE');
    expect(npmPublishWorkflow).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_EXPECT_RELEASE_COMMIT_SHA');
    expect(npmPublishWorkflow).toContain('NOTE_CONNECTION_SBOM_KEYRING_EXPECT_SCHEMA');
    expect(npmPublishWorkflow).toContain('NOTE_CONNECTION_SBOM_KEYRING_EXPECT_VERSION');
    expect(npmPublishWorkflow).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_ENABLE_TRANSPARENCY_LOG');
    expect(npmPublishWorkflow).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_REQUIRE_TRANSPARENCY_LOG');
    expect(npmPublishWorkflow).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_VERIFY_TRANSPARENCY_LOG_INCLUSION');
    expect(npmPublishWorkflow).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_TRANSPARENCY_EXPECT_SCHEMA');
    expect(npmPublishWorkflow).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_TRANSPARENCY_EXPECT_VERSION');
  });

  test('attestation generator and verifier work in unsigned strict policy mode', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-sbom-attestation-'));
    const sbomPath = path.join(tempDir, 'sample-sbom.cdx.json');
    const attestationPath = path.join(tempDir, 'sample-sbom.attestation.json');
    fs.writeFileSync(
      sbomPath,
      `${JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.5', version: 1 }, null, 2)}\n`,
      'utf8'
    );

    const generateResult = spawnSync(process.execPath, [
      generatorPath,
      '--sbom',
      sbomPath,
      '--output',
      attestationPath,
      '--allow-unsigned',
      '1',
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    expect(generateResult.status).toBe(0);

    const verifyResult = spawnSync(process.execPath, [
      verifierPath,
      '--sbom',
      sbomPath,
      '--attestation',
      attestationPath,
      '--strict',
      '1',
      '--allow-missing',
      '0',
      '--require-signature',
      '0',
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    expect(verifyResult.status).toBe(0);
    expect(String(verifyResult.stdout)).toContain('[SBOM Attestation Verify] PASS');
  });

  test('verifier enforces required provenance policy', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-sbom-attestation-provenance-required-'));
    const sbomPath = path.join(tempDir, 'sample-sbom.cdx.json');
    const attestationPath = path.join(tempDir, 'sample-sbom.attestation.json');
    fs.writeFileSync(
      sbomPath,
      `${JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.5', version: 1 }, null, 2)}\n`,
      'utf8'
    );

    const generateResult = spawnSync(process.execPath, [
      generatorPath,
      '--sbom',
      sbomPath,
      '--output',
      attestationPath,
      '--allow-unsigned',
      '1',
      '--include-provenance',
      '0',
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    expect(generateResult.status).toBe(0);

    const verifyResult = spawnSync(process.execPath, [
      verifierPath,
      '--sbom',
      sbomPath,
      '--attestation',
      attestationPath,
      '--strict',
      '1',
      '--allow-missing',
      '0',
      '--require-provenance',
      '1',
      '--require-signature',
      '0',
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    expect(verifyResult.status).not.toBe(0);
    expect(String(verifyResult.stderr)).toContain('Attestation provenance is required by policy but missing.');
  });

  test('verifier enforces immutable release metadata linkage', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-sbom-attestation-provenance-linkage-'));
    const sbomPath = path.join(tempDir, 'sample-sbom.cdx.json');
    const attestationPath = path.join(tempDir, 'sample-sbom.attestation.json');
    fs.writeFileSync(
      sbomPath,
      `${JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.5', version: 1 }, null, 2)}\n`,
      'utf8'
    );

    const generateResult = spawnSync(process.execPath, [
      generatorPath,
      '--sbom',
      sbomPath,
      '--output',
      attestationPath,
      '--allow-unsigned',
      '1',
      '--release-commit',
      'deadbeef',
      '--release-tag',
      'v9.9.9',
      '--release-ref',
      'refs/tags/v9.9.9',
      '--release-run-id',
      'run-1',
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    expect(generateResult.status).toBe(0);

    const verifyResult = spawnSync(process.execPath, [
      verifierPath,
      '--sbom',
      sbomPath,
      '--attestation',
      attestationPath,
      '--strict',
      '1',
      '--allow-missing',
      '0',
      '--require-signature',
      '0',
      '--require-provenance',
      '1',
      '--expected-release-commit',
      'feedface',
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    expect(verifyResult.status).not.toBe(0);
    expect(String(verifyResult.stderr)).toContain('Attestation provenance.release.commitSha mismatch.');
  });

  test('verifier auto-requires signature when a public key is configured', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-sbom-attestation-keyed-'));
    const sbomPath = path.join(tempDir, 'sample-sbom.cdx.json');
    const attestationPath = path.join(tempDir, 'sample-sbom.attestation.json');
    fs.writeFileSync(
      sbomPath,
      `${JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.5', version: 1 }, null, 2)}\n`,
      'utf8'
    );

    const generateResult = spawnSync(process.execPath, [
      generatorPath,
      '--sbom',
      sbomPath,
      '--output',
      attestationPath,
      '--allow-unsigned',
      '1',
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    expect(generateResult.status).toBe(0);

    const verifyResult = spawnSync(process.execPath, [
      verifierPath,
      '--sbom',
      sbomPath,
      '--attestation',
      attestationPath,
      '--strict',
      '1',
      '--allow-missing',
      '0',
      '--require-signature',
      '0',
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        NOTE_CONNECTION_SBOM_SIGNING_PUBLIC_KEY_PEM: 'placeholder',
      },
    });
    expect(verifyResult.status).not.toBe(0);
    expect(String(verifyResult.stderr)).toContain('Signature is required but attestation.signature is missing.');
  });

  test('signed attestation verifies when signing key pair is provided', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-sbom-attestation-signed-'));
    const sbomPath = path.join(tempDir, 'sample-sbom.cdx.json');
    const attestationPath = path.join(tempDir, 'sample-sbom.attestation.json');
    fs.writeFileSync(
      sbomPath,
      `${JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.5', version: 1 }, null, 2)}\n`,
      'utf8'
    );

    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privatePem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
    const publicPem = publicKey.export({ type: 'pkcs1', format: 'pem' }).toString();

    const generateResult = spawnSync(process.execPath, [
      generatorPath,
      '--sbom',
      sbomPath,
      '--output',
      attestationPath,
      '--allow-unsigned',
      '0',
      '--key-id',
      'contract-key',
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        NOTE_CONNECTION_SBOM_SIGNING_PRIVATE_KEY_PEM: privatePem,
      },
    });
    expect(generateResult.status).toBe(0);
    expect(String(generateResult.stdout)).toContain('(signed');

    const verifyResult = spawnSync(process.execPath, [
      verifierPath,
      '--sbom',
      sbomPath,
      '--attestation',
      attestationPath,
      '--strict',
      '1',
      '--allow-missing',
      '0',
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        NOTE_CONNECTION_SBOM_SIGNING_PUBLIC_KEY_PEM: publicPem,
      },
    });
    expect(verifyResult.status).toBe(0);
    expect(String(verifyResult.stdout)).toContain('[SBOM Attestation Verify] PASS');
  });

  test('signed attestation rejects unspecified key-id by default policy', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-sbom-attestation-keyid-required-'));
    const sbomPath = path.join(tempDir, 'sample-sbom.cdx.json');
    const attestationPath = path.join(tempDir, 'sample-sbom.attestation.json');
    fs.writeFileSync(
      sbomPath,
      `${JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.5', version: 1 }, null, 2)}\n`,
      'utf8'
    );

    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privatePem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
    const publicPem = publicKey.export({ type: 'pkcs1', format: 'pem' }).toString();

    const generateResult = spawnSync(process.execPath, [
      generatorPath,
      '--sbom',
      sbomPath,
      '--output',
      attestationPath,
      '--allow-unsigned',
      '0',
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        NOTE_CONNECTION_SBOM_SIGNING_PRIVATE_KEY_PEM: privatePem,
        NOTE_CONNECTION_SBOM_ATTESTATION_KEY_ID: '',
      },
    });
    expect(generateResult.status).toBe(0);

    const verifyResult = spawnSync(process.execPath, [
      verifierPath,
      '--sbom',
      sbomPath,
      '--attestation',
      attestationPath,
      '--strict',
      '1',
      '--allow-missing',
      '0',
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        NOTE_CONNECTION_SBOM_SIGNING_PUBLIC_KEY_PEM: publicPem,
      },
    });
    expect(verifyResult.status).not.toBe(0);
    expect(String(verifyResult.stderr)).toContain('signature.keyId "unspecified" is forbidden by policy.');
  });

  test('signed attestation enforces key rotation allowlist and revocation policy', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-sbom-attestation-key-policy-'));
    const sbomPath = path.join(tempDir, 'sample-sbom.cdx.json');
    const attestationPath = path.join(tempDir, 'sample-sbom.attestation.json');
    fs.writeFileSync(
      sbomPath,
      `${JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.5', version: 1 }, null, 2)}\n`,
      'utf8'
    );

    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privatePem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
    const publicPem = publicKey.export({ type: 'pkcs1', format: 'pem' }).toString();
    const keyId = 'rotation-key-v2';

    const generateResult = spawnSync(process.execPath, [
      generatorPath,
      '--sbom',
      sbomPath,
      '--output',
      attestationPath,
      '--allow-unsigned',
      '0',
      '--key-id',
      keyId,
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        NOTE_CONNECTION_SBOM_SIGNING_PRIVATE_KEY_PEM: privatePem,
      },
    });
    expect(generateResult.status).toBe(0);

    const allowVerifyResult = spawnSync(process.execPath, [
      verifierPath,
      '--sbom',
      sbomPath,
      '--attestation',
      attestationPath,
      '--strict',
      '1',
      '--allow-missing',
      '0',
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        NOTE_CONNECTION_SBOM_SIGNING_PUBLIC_KEY_PEM: publicPem,
        NOTE_CONNECTION_SBOM_ATTESTATION_ALLOWED_KEY_IDS: 'rotation-key-v1, rotation-key-v2',
      },
    });
    expect(allowVerifyResult.status).toBe(0);
    expect(String(allowVerifyResult.stdout)).toContain('[SBOM Attestation Verify] PASS');

    const revokeVerifyResult = spawnSync(process.execPath, [
      verifierPath,
      '--sbom',
      sbomPath,
      '--attestation',
      attestationPath,
      '--strict',
      '1',
      '--allow-missing',
      '0',
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        NOTE_CONNECTION_SBOM_SIGNING_PUBLIC_KEY_PEM: publicPem,
        NOTE_CONNECTION_SBOM_ATTESTATION_REVOKED_KEY_IDS: keyId,
      },
    });
    expect(revokeVerifyResult.status).not.toBe(0);
    expect(String(revokeVerifyResult.stderr)).toContain(`signature.keyId "${keyId}" is revoked by policy.`);
  });

  test('signed attestation rejects weak RSA keys under minimum key-strength policy', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-sbom-attestation-rsa-strength-'));
    const sbomPath = path.join(tempDir, 'sample-sbom.cdx.json');
    const attestationPath = path.join(tempDir, 'sample-sbom.attestation.json');
    fs.writeFileSync(
      sbomPath,
      `${JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.5', version: 1 }, null, 2)}\n`,
      'utf8'
    );

    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 1024 });
    const privatePem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
    const publicPem = publicKey.export({ type: 'pkcs1', format: 'pem' }).toString();

    const generateResult = spawnSync(process.execPath, [
      generatorPath,
      '--sbom',
      sbomPath,
      '--output',
      attestationPath,
      '--allow-unsigned',
      '0',
      '--key-id',
      'weak-rsa-key',
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        NOTE_CONNECTION_SBOM_SIGNING_PRIVATE_KEY_PEM: privatePem,
      },
    });
    expect(generateResult.status).toBe(0);

    const verifyResult = spawnSync(process.execPath, [
      verifierPath,
      '--sbom',
      sbomPath,
      '--attestation',
      attestationPath,
      '--strict',
      '1',
      '--allow-missing',
      '0',
      '--min-rsa-bits',
      '2048',
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        NOTE_CONNECTION_SBOM_SIGNING_PUBLIC_KEY_PEM: publicPem,
      },
    });
    expect(verifyResult.status).not.toBe(0);
    expect(String(verifyResult.stderr)).toContain('RSA key strength is too weak');
  });

  test('signed attestation enforces keyring rotation overlap policy', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-sbom-attestation-keyring-overlap-'));
    const sbomPath = path.join(tempDir, 'sample-sbom.cdx.json');
    const attestationPath = path.join(tempDir, 'sample-sbom.attestation.json');
    const goodKeyringPath = path.join(tempDir, 'good-keyring.json');
    const badKeyringPath = path.join(tempDir, 'bad-keyring.json');
    fs.writeFileSync(
      sbomPath,
      `${JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.5', version: 1 }, null, 2)}\n`,
      'utf8'
    );

    const primary = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const standby = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const primaryPrivatePem = primary.privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
    const primaryPublicPem = primary.publicKey.export({ type: 'pkcs1', format: 'pem' }).toString();
    const standbyPublicPem = standby.publicKey.export({ type: 'pkcs1', format: 'pem' }).toString();

    const generateResult = spawnSync(process.execPath, [
      generatorPath,
      '--sbom',
      sbomPath,
      '--output',
      attestationPath,
      '--allow-unsigned',
      '0',
      '--key-id',
      'rotation-key-v2',
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        NOTE_CONNECTION_SBOM_SIGNING_PRIVATE_KEY_PEM: primaryPrivatePem,
      },
    });
    expect(generateResult.status).toBe(0);

    const now = Date.now();
    const iso = (offsetHours: number): string => new Date(now + offsetHours * 60 * 60 * 1000).toISOString();

    const goodKeyring = {
      schema: 'noteconnection/sbom-keyring/v1',
      version: 1,
      keys: [
        {
          keyId: 'rotation-key-v1',
          status: 'retired',
          publicKeyPem: standbyPublicPem,
          validFrom: iso(-240),
          validTo: iso(48),
        },
        {
          keyId: 'rotation-key-v2',
          status: 'active',
          publicKeyPem: primaryPublicPem,
          validFrom: iso(-24),
          validTo: iso(240),
        },
      ],
    };
    fs.writeFileSync(goodKeyringPath, `${JSON.stringify(goodKeyring, null, 2)}\n`, 'utf8');

    const goodVerifyResult = spawnSync(process.execPath, [
      verifierPath,
      '--sbom',
      sbomPath,
      '--attestation',
      attestationPath,
      '--strict',
      '1',
      '--allow-missing',
      '0',
      '--public-keyring-file',
      goodKeyringPath,
      '--min-rotation-overlap-hours',
      '24',
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    expect(goodVerifyResult.status).toBe(0);
    expect(String(goodVerifyResult.stdout)).toContain('[SBOM Attestation Verify] PASS');

    const badKeyring = {
      schema: 'noteconnection/sbom-keyring/v1',
      version: 1,
      keys: [
        {
          keyId: 'rotation-key-v1',
          status: 'retired',
          publicKeyPem: standbyPublicPem,
          validFrom: iso(-240),
          validTo: iso(2),
        },
        {
          keyId: 'rotation-key-v2',
          status: 'active',
          publicKeyPem: primaryPublicPem,
          validFrom: iso(-1),
          validTo: iso(240),
        },
      ],
    };
    fs.writeFileSync(badKeyringPath, `${JSON.stringify(badKeyring, null, 2)}\n`, 'utf8');

    const badVerifyResult = spawnSync(process.execPath, [
      verifierPath,
      '--sbom',
      sbomPath,
      '--attestation',
      attestationPath,
      '--strict',
      '1',
      '--allow-missing',
      '0',
      '--public-keyring-file',
      badKeyringPath,
      '--min-rotation-overlap-hours',
      '24',
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    expect(badVerifyResult.status).not.toBe(0);
    expect(String(badVerifyResult.stderr)).toContain('Rotation overlap too small');
  });

  test('signed attestation enforces keyring schema/version pin policy', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-sbom-attestation-keyring-schema-'));
    const sbomPath = path.join(tempDir, 'sample-sbom.cdx.json');
    const attestationPath = path.join(tempDir, 'sample-sbom.attestation.json');
    const badSchemaKeyringPath = path.join(tempDir, 'bad-schema-keyring.json');
    fs.writeFileSync(
      sbomPath,
      `${JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.5', version: 1 }, null, 2)}\n`,
      'utf8'
    );

    const signing = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privatePem = signing.privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
    const publicPem = signing.publicKey.export({ type: 'pkcs1', format: 'pem' }).toString();

    const generateResult = spawnSync(process.execPath, [
      generatorPath,
      '--sbom',
      sbomPath,
      '--output',
      attestationPath,
      '--allow-unsigned',
      '0',
      '--key-id',
      'schema-key-v1',
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        NOTE_CONNECTION_SBOM_SIGNING_PRIVATE_KEY_PEM: privatePem,
      },
    });
    expect(generateResult.status).toBe(0);

    const badSchemaKeyring = {
      schema: 'noteconnection/sbom-keyring/v2',
      version: 2,
      keys: [
        {
          keyId: 'schema-key-v1',
          status: 'active',
          publicKeyPem: publicPem,
          validFrom: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          validTo: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
    };
    fs.writeFileSync(badSchemaKeyringPath, `${JSON.stringify(badSchemaKeyring, null, 2)}\n`, 'utf8');

    const verifyResult = spawnSync(process.execPath, [
      verifierPath,
      '--sbom',
      sbomPath,
      '--attestation',
      attestationPath,
      '--strict',
      '1',
      '--allow-missing',
      '0',
      '--public-keyring-file',
      badSchemaKeyringPath,
      '--expected-keyring-schema',
      'noteconnection/sbom-keyring/v1',
      '--expected-keyring-version',
      '1',
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    expect(verifyResult.status).not.toBe(0);
    expect(String(verifyResult.stderr)).toContain('SBOM keyring schema mismatch.');
  });

  test('signed attestation enforces transparency log inclusion proof', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-sbom-attestation-transparency-pass-'));
    const sbomPath = path.join(tempDir, 'sample-sbom.cdx.json');
    const attestationPath = path.join(tempDir, 'sample-sbom.attestation.json');
    const transparencyLogPath = path.join(tempDir, 'attestation-transparency-log.jsonl');
    fs.writeFileSync(
      sbomPath,
      `${JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.5', version: 1 }, null, 2)}\n`,
      'utf8'
    );

    const signing = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privatePem = signing.privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
    const publicPem = signing.publicKey.export({ type: 'pkcs1', format: 'pem' }).toString();

    const generateResult = spawnSync(process.execPath, [
      generatorPath,
      '--sbom',
      sbomPath,
      '--output',
      attestationPath,
      '--allow-unsigned',
      '0',
      '--key-id',
      'transparency-key-v1',
      '--enable-transparency-log',
      '1',
      '--transparency-log-path',
      transparencyLogPath,
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        NOTE_CONNECTION_SBOM_SIGNING_PRIVATE_KEY_PEM: privatePem,
      },
    });
    expect(generateResult.status).toBe(0);
    expect(fs.existsSync(transparencyLogPath)).toBe(true);

    const verifyResult = spawnSync(process.execPath, [
      verifierPath,
      '--sbom',
      sbomPath,
      '--attestation',
      attestationPath,
      '--strict',
      '1',
      '--allow-missing',
      '0',
      '--require-transparency-log',
      '1',
      '--verify-transparency-log-inclusion',
      '1',
      '--transparency-log-path',
      transparencyLogPath,
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        NOTE_CONNECTION_SBOM_SIGNING_PUBLIC_KEY_PEM: publicPem,
      },
    });
    expect(verifyResult.status).toBe(0);
    expect(String(verifyResult.stdout)).toContain('[SBOM Attestation Verify] PASS');
  });

  test('signed attestation rejects tampered transparency inclusion entry', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteconnection-sbom-attestation-transparency-fail-'));
    const sbomPath = path.join(tempDir, 'sample-sbom.cdx.json');
    const attestationPath = path.join(tempDir, 'sample-sbom.attestation.json');
    const transparencyLogPath = path.join(tempDir, 'attestation-transparency-log.jsonl');
    fs.writeFileSync(
      sbomPath,
      `${JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.5', version: 1 }, null, 2)}\n`,
      'utf8'
    );

    const signing = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privatePem = signing.privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
    const publicPem = signing.publicKey.export({ type: 'pkcs1', format: 'pem' }).toString();

    const generateResult = spawnSync(process.execPath, [
      generatorPath,
      '--sbom',
      sbomPath,
      '--output',
      attestationPath,
      '--allow-unsigned',
      '0',
      '--key-id',
      'transparency-key-v1',
      '--enable-transparency-log',
      '1',
      '--transparency-log-path',
      transparencyLogPath,
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        NOTE_CONNECTION_SBOM_SIGNING_PRIVATE_KEY_PEM: privatePem,
      },
    });
    expect(generateResult.status).toBe(0);

    const lines = fs
      .readFileSync(transparencyLogPath, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0);
    expect(lines.length).toBeGreaterThan(0);
    const firstEntry = JSON.parse(lines[0]) as Record<string, unknown>;
    const tamperedEntryHash = 'f'.repeat(64);
    const tamperedCumulative = crypto
      .createHash('sha256')
      .update(Buffer.from(`index=0\nprevious=\nentry=${tamperedEntryHash}\n`, 'utf8'))
      .digest('hex');
    firstEntry.entryHash = tamperedEntryHash;
    firstEntry.cumulativeHash = tamperedCumulative;
    fs.writeFileSync(transparencyLogPath, `${JSON.stringify(firstEntry)}\n`, 'utf8');

    const verifyResult = spawnSync(process.execPath, [
      verifierPath,
      '--sbom',
      sbomPath,
      '--attestation',
      attestationPath,
      '--strict',
      '1',
      '--allow-missing',
      '0',
      '--require-transparency-log',
      '1',
      '--verify-transparency-log-inclusion',
      '1',
      '--transparency-log-path',
      transparencyLogPath,
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        NOTE_CONNECTION_SBOM_SIGNING_PUBLIC_KEY_PEM: publicPem,
      },
    });
    expect(verifyResult.status).not.toBe(0);
    expect(String(verifyResult.stderr)).toContain('Transparency log inclusion entryHash mismatch.');
  });
});
