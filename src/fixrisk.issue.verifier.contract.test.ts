import * as fs from 'fs';
import * as path from 'path';

describe('fixrisk issue verifier contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const verifierScriptPath = path.join(repoRoot, 'scripts', 'verify-fixrisk-issues.js');

  test('package scripts expose consolidated fixrisk verification commands', () => {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    expect(pkg.scripts['verify:fixrisk:issues']).toBe('node scripts/verify-fixrisk-issues.js');
    expect(pkg.scripts['verify:fixrisk:issues:strict']).toBe(
      'node scripts/verify-fixrisk-issues.js --strict-pending'
    );
    expect(pkg.scripts['verify:fixrisk:issues:strict:evidence']).toBe(
      'node scripts/verify-fixrisk-issues.js --strict-pending --require-evidence-root'
    );
    expect(pkg.scripts['verify:pathbridge:strict']).toBe('node scripts/verify-pathbridge-strict-schema.js');
    expect(pkg.scripts['ops:fixrisk:close']).toBe('node scripts/run-fixrisk-ops-closure.js');
    expect(pkg.scripts['ops:fixrisk:close:dry']).toBe('node scripts/run-fixrisk-ops-closure.js --dry-run');
  });

  test('verifier script tracks all FR issues and emits latest report artifact', () => {
    const script = fs.readFileSync(verifierScriptPath, 'utf8');
    expect(script).toContain('fixrisk-issue-check-latest.json');
    expect(script).toContain('fixrisk-jest-contract-report.json');
    expect(script).toContain("'FR-001'");
    expect(script).toContain("'FR-011'");
    expect(script).toContain("'FR-013'");
    expect(script).toContain("'FR-014'");
    expect(script).toContain("'FR-015'");
    expect(script).toContain('actions/setup-java@v5');
    expect(script).toContain('java-version');
    expect(script).toContain('verify-capacitor-evidence-freshness.js');
    expect(script).toContain('NOTE_CONNECTION_REQUIRE_LARGE_GRAPH_EVIDENCE');
    expect(script).toContain('NOTE_CONNECTION_MIN_EVIDENCE_NODE_COUNT');
    expect(script).toContain('NOTE_CONNECTION_MIN_EVIDENCE_EDGE_COUNT');
    expect(script).toContain('verify-tauri-android-prereqs.js');
    expect(script).toContain('verify-sbom-policy.js');
    expect(script).toContain('verify-sbom-attestation.js');
    expect(script).toContain('checkSbomAttestationReleaseSignaturePolicy');
    expect(script).toContain('NOTE_CONNECTION_REQUIRE_SBOM_ATTESTATION_SIGNATURE');
    expect(script).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_REQUIRE_SIGNED_KEY_ID');
    expect(script).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_ALLOWED_KEY_IDS');
    expect(script).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_REVOKED_KEY_IDS');
    expect(script).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_MIN_RSA_BITS');
    expect(script).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_MIN_ROTATION_OVERLAP_HOURS');
    expect(script).toContain('NOTE_CONNECTION_SBOM_SIGNING_PUBLIC_KEYRING_FILE');
    expect(script).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_REQUIRE_PROVENANCE');
    expect(script).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_EXPECT_RELEASE_COMMIT_SHA');
    expect(script).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_EXPECT_RELEASE_GIT_TAG');
    expect(script).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_REQUIRE_PROVENANCE');
    expect(script).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_EXPECT_RELEASE_REF');
    expect(script).toContain('NOTE_CONNECTION_SBOM_KEYRING_EXPECT_SCHEMA');
    expect(script).toContain('NOTE_CONNECTION_SBOM_KEYRING_EXPECT_VERSION');
    expect(script).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_ENABLE_TRANSPARENCY_LOG');
    expect(script).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_REQUIRE_TRANSPARENCY_LOG');
    expect(script).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_VERIFY_TRANSPARENCY_LOG_INCLUSION');
    expect(script).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_TRANSPARENCY_EXPECT_SCHEMA');
    expect(script).toContain('NOTE_CONNECTION_SBOM_ATTESTATION_TRANSPARENCY_EXPECT_VERSION');
    expect(script).toContain('checkLocalhostPortFallbackPolicy');
    expect(script).toContain('NOTE_CONNECTION_ALLOW_EPHEMERAL_PORT_FALLBACK');
    expect(script).toContain('verify-pathbridge-strict-schema.js');
    expect(script).toContain('NOTE_CONNECTION_REQUIRE_EVIDENCE_ROOT');
    expect(script).toContain('checkMobileEvidenceRootAvailability');
    expect(script).toContain('requireEvidenceRoot');
    expect(script).toContain('codeStatus');
    expect(script).toContain('operationalStatus');
    expect(script).toContain('isCodeCheck');
    expect(script).toContain('allCodeChecksPassed');
    expect(script).toContain('checkCapacitorBridgeSerializationPolicy');
    expect(script).toContain('checkContentPathSandboxPolicy');
    expect(script).toContain('--contract-only');
    expect(script).toContain('src/server.port.fallback.contract.test.ts');
    expect(script).toContain('src/sbom.policy.contract.test.ts');
    expect(script).toContain('src/sbom.attestation.policy.contract.test.ts');
    expect(script).toContain('src/pathbridge.strict.policy.contract.test.ts');
    expect(script).toContain('src/capacitor.bridge.serialization.contract.test.ts');
    expect(script).toContain('src/content.path.sandbox.contract.test.ts');
  });

  test('ops closure orchestrator script exists with strict verification handoff', () => {
    const opsScriptPath = path.join(repoRoot, 'scripts', 'run-fixrisk-ops-closure.js');
    const script = fs.readFileSync(opsScriptPath, 'utf8');
    expect(script).toContain('verify-capacitor-device-acceptance.js');
    expect(script).toContain('capture-capacitor-device-evidence.js');
    expect(script).toContain('verify-capacitor-evidence-freshness.js');
    expect(script).toContain("['--strict-pending', '--require-evidence-root']");
    expect(script).toContain('fixrisk-ops-closure-latest.json');
  });
});
