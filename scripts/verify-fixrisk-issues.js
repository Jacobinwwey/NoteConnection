#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const buildDir = path.join(repoRoot, 'build');
const latestReportPath = path.join(buildDir, 'fixrisk-issue-check-latest.json');
const datedReportPath = path.join(buildDir, `fixrisk-issue-check-${new Date().toISOString().slice(0, 10)}.json`);
const jestJsonReportPath = path.join(buildDir, 'fixrisk-jest-contract-report.json');

const EN_DOC_PATH = path.join(repoRoot, 'docs', 'en', 'fixrisk_TODO.md');
const ZH_DOC_PATH = path.join(repoRoot, 'docs', 'zh', 'fixrisk_TODO.md');
const MIGRATION_GATES_WORKFLOW_PATH = path.join(repoRoot, '.github', 'workflows', 'migration-gates.yml');
const NPM_PUBLISH_WORKFLOW_PATH = path.join(repoRoot, '.github', 'workflows', 'npm-publish.yml');

const REQUIRED_FR_IDS = [
  'FR-001',
  'FR-002',
  'FR-003',
  'FR-004',
  'FR-005',
  'FR-006',
  'FR-007',
  'FR-008',
  'FR-009',
  'FR-010',
  'FR-011',
  'FR-012',
  'FR-013'
];

const CONTRACT_TEST_FILES = [
  'src/runtime.spool.policy.contract.test.ts',
  'src/pkg.sidecar.contract.test.ts',
  'src/mobile.pipeline.test.ts',
  'src/pkg.snapshot.safety.contract.test.ts',
  'src/runtime.heap.policy.contract.test.ts',
  'src/sidecar.signature.contract.test.ts',
  'src/graph.accessibility.contract.test.ts',
  'src/privacy.manifest.contract.test.ts',
  'src/server.port.fallback.contract.test.ts',
  'src/sbom.policy.contract.test.ts',
  'src/sbom.attestation.policy.contract.test.ts',
  'src/pathbridge.strict.policy.contract.test.ts',
  'src/capacitor.evidence.contract.test.ts',
  'src/tauri.test.runner.contract.test.ts'
];

function parseArgs(argv) {
  const options = {
    strictPending: false,
    writeDatedSnapshot: true,
    reportPath: latestReportPath
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--strict-pending') {
      options.strictPending = true;
      continue;
    }
    if (arg === '--no-dated-snapshot') {
      options.writeDatedSnapshot = false;
      continue;
    }
    if (arg === '--report' && argv[index + 1]) {
      options.reportPath = path.resolve(repoRoot, argv[index + 1]);
      index += 1;
      continue;
    }
  }

  return options;
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function runCommand(command, args, extra = {}) {
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd: extra.cwd || repoRoot,
    env: extra.env || process.env,
    encoding: 'utf8',
    stdio: 'pipe'
  });
  const finishedAt = Date.now();
  return {
    ok: (result.status || 0) === 0,
    exitCode: typeof result.status === 'number' ? result.status : 1,
    durationMs: finishedAt - startedAt,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
    error: result.error ? String(result.error.message || result.error) : '',
    command: [command, ...args].join(' ')
  };
}

function trimText(value, maxLength = 2400) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}\n...[truncated ${text.length - maxLength} chars]`;
}

function makeCheck(name, runResult, detailOnSuccess) {
  const detail = runResult.ok
    ? (detailOnSuccess || `Command passed in ${runResult.durationMs}ms`)
    : trimText(`${runResult.stderr}\n${runResult.stdout}\n${runResult.error}`);
  return {
    name,
    ok: runResult.ok,
    command: runResult.command,
    exitCode: runResult.exitCode,
    durationMs: runResult.durationMs,
    detail
  };
}

function makeCheckWithPending(name, runResult, detailOnSuccess, pendingMatch) {
  if (runResult.ok) {
    return makeCheck(name, runResult, detailOnSuccess);
  }
  if (pendingMatch && pendingMatch.pending) {
    return {
      name,
      ok: true,
      command: runResult.command,
      exitCode: runResult.exitCode,
      durationMs: runResult.durationMs,
      detail: `Accepted pending state: ${pendingMatch.pendingReason}. ${trimText(
        `${runResult.stderr}\n${runResult.stdout}`
      )}`
    };
  }
  return makeCheck(name, runResult, detailOnSuccess);
}

function makeStaticCheck(name, ok, detail) {
  return {
    name,
    ok,
    command: null,
    exitCode: ok ? 0 : 1,
    durationMs: 0,
    detail
  };
}

function hasSubstring(sourceText, requiredValue) {
  return sourceText.includes(requiredValue);
}

function parseFixriskIssueRows(docText) {
  const rows = {};
  const lines = docText.split(/\r?\n/);
  for (const line of lines) {
    const normalizedLine = line.replace(/\*\*/g, '');
    if (!normalizedLine.startsWith('| FR-')) {
      continue;
    }
    const cells = normalizedLine.split('|').map((cell) => cell.trim()).filter((cell) => cell.length > 0);
    if (cells.length < 4) {
      continue;
    }
    const id = cells[0];
    const status = cells[3];
    rows[id] = status;
  }
  return rows;
}

function canonicalStatusMarker(statusText) {
  const text = String(statusText || '').toLowerCase();
  const hasClosed = text.includes('closed');
  const hasPending = text.includes('pending');
  if (hasClosed && hasPending) {
    return 'closed+pending';
  }
  if (hasClosed) {
    return 'closed';
  }
  if (hasPending) {
    return 'pending';
  }
  return 'other';
}

function checkDocsParity() {
  const checks = [];

  const enExists = fs.existsSync(EN_DOC_PATH);
  const zhExists = fs.existsSync(ZH_DOC_PATH);
  checks.push(makeStaticCheck('docs/en/fixrisk_TODO.md exists', enExists, EN_DOC_PATH));
  checks.push(makeStaticCheck('docs/zh/fixrisk_TODO.md exists', zhExists, ZH_DOC_PATH));
  if (!enExists || !zhExists) {
    return { checks, enRows: {}, zhRows: {} };
  }

  const enRows = parseFixriskIssueRows(readText(EN_DOC_PATH));
  const zhRows = parseFixriskIssueRows(readText(ZH_DOC_PATH));
  const allIds = Array.from(new Set([...Object.keys(enRows), ...Object.keys(zhRows)])).sort();

  for (const issueId of REQUIRED_FR_IDS) {
    checks.push(
      makeStaticCheck(
        `EN issue row ${issueId} present`,
        Boolean(enRows[issueId]),
        enRows[issueId] ? enRows[issueId] : `Missing ${issueId} in EN issue table`
      )
    );
    checks.push(
      makeStaticCheck(
        `ZH issue row ${issueId} present`,
        Boolean(zhRows[issueId]),
        zhRows[issueId] ? zhRows[issueId] : `Missing ${issueId} in ZH issue table`
      )
    );

    if (enRows[issueId] && zhRows[issueId]) {
      const enMarker = canonicalStatusMarker(enRows[issueId]);
      const zhMarker = canonicalStatusMarker(zhRows[issueId]);
      checks.push(
        makeStaticCheck(
          `EN/ZH status marker parity ${issueId}`,
          enMarker === zhMarker,
          `EN=${enRows[issueId]} (${enMarker}) | ZH=${zhRows[issueId]} (${zhMarker})`
        )
      );
    }
  }

  const unknownIds = allIds.filter((id) => !REQUIRED_FR_IDS.includes(id));
  checks.push(
    makeStaticCheck(
      'No unexpected FR IDs in EN/ZH issue tables',
      unknownIds.length === 0,
      unknownIds.length === 0 ? 'No unexpected IDs found' : `Unexpected IDs: ${unknownIds.join(', ')}`
    )
  );

  return { checks, enRows, zhRows };
}

function runContractJestSuite() {
  const jestBin = path.join(repoRoot, 'node_modules', 'jest', 'bin', 'jest.js');
  if (!fs.existsSync(jestBin)) {
    return {
      commandResult: {
        ok: false,
        exitCode: 1,
        durationMs: 0,
        stdout: '',
        stderr: '',
        error: `Missing Jest binary at ${jestBin}. Install dependencies first.`,
        command: `${process.execPath} ${jestBin}`
      },
      statusByTest: {},
      aggregate: null
    };
  }

  ensureDir(jestJsonReportPath);
  const args = [
    jestBin,
    '--runInBand',
    '--json',
    `--outputFile=${jestJsonReportPath}`,
    ...CONTRACT_TEST_FILES
  ];
  const commandResult = runCommand(process.execPath, args);

  let aggregate = null;
  let statusByTest = {};
  if (fs.existsSync(jestJsonReportPath)) {
    try {
      aggregate = JSON.parse(readText(jestJsonReportPath));
      statusByTest = Object.fromEntries(
        (aggregate.testResults || []).map((entry) => {
          const relativePath = path.relative(repoRoot, entry.name).replace(/\\/g, '/');
          return [relativePath, String(entry.status || '').toLowerCase()];
        })
      );
    } catch (error) {
      statusByTest = {};
    }
  }

  return { commandResult, statusByTest, aggregate };
}

function makeJestExpectationCheck(testPath, contractRun) {
  const normalizedPath = testPath.replace(/\\/g, '/');
  const status = contractRun.statusByTest[normalizedPath];
  const ok = status === 'passed';
  const detail = status
    ? `Jest status: ${status}`
    : `Jest status missing for ${normalizedPath}; aggregate command exitCode=${contractRun.commandResult.exitCode}`;
  return makeStaticCheck(`Contract test ${normalizedPath}`, ok, detail);
}

function checkWorkflowNode24Migration() {
  const workflowsDir = path.join(repoRoot, '.github', 'workflows');
  if (!fs.existsSync(workflowsDir)) {
    return [
      makeStaticCheck('Workflow directory exists', false, `${workflowsDir} is missing`)
    ];
  }

  const workflowFiles = fs
    .readdirSync(workflowsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((fileName) => fileName.endsWith('.yml') || fileName.endsWith('.yaml'))
    .sort();

  const checks = [
    makeStaticCheck(
      'Workflow files discovered',
      workflowFiles.length > 0,
      workflowFiles.length > 0 ? workflowFiles.join(', ') : 'No workflow files discovered'
    )
  ];

  for (const workflowFile of workflowFiles) {
    const workflowPath = path.join(workflowsDir, workflowFile);
    const source = readText(workflowPath);

    const usesCheckout = source.includes('actions/checkout@');
    const usesSetupNode = source.includes('actions/setup-node@');
    const hasCheckoutV5 = source.includes('actions/checkout@v5');
    const hasSetupNodeV5 = source.includes('actions/setup-node@v5');
    const hasDeprecatedCheckoutV4 = source.includes('actions/checkout@v4');
    const hasDeprecatedSetupNodeV4 = source.includes('actions/setup-node@v4');
    const hasNode24ForceFlag = source.includes('FORCE_JAVASCRIPT_ACTIONS_TO_NODE24');

    if (usesCheckout) {
      checks.push(
        makeStaticCheck(
          `${workflowFile}: checkout action uses v5`,
          hasCheckoutV5 && !hasDeprecatedCheckoutV4,
          hasCheckoutV5 && !hasDeprecatedCheckoutV4
            ? 'actions/checkout@v5 configured'
            : 'Expected actions/checkout@v5 and no actions/checkout@v4'
        )
      );
    }
    if (usesSetupNode) {
      checks.push(
        makeStaticCheck(
          `${workflowFile}: setup-node action uses v5`,
          hasSetupNodeV5 && !hasDeprecatedSetupNodeV4,
          hasSetupNodeV5 && !hasDeprecatedSetupNodeV4
            ? 'actions/setup-node@v5 configured'
            : 'Expected actions/setup-node@v5 and no actions/setup-node@v4'
        )
      );
    }
    if (usesCheckout || usesSetupNode) {
      checks.push(
        makeStaticCheck(
          `${workflowFile}: Node24 force flag set`,
          hasNode24ForceFlag,
          hasNode24ForceFlag
            ? 'FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 present'
            : 'FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 is missing'
        )
      );
    }
  }

  return checks;
}

function checkPackageSidecarConflict() {
  const packagePath = path.join(repoRoot, 'package.json');
  const pkg = JSON.parse(readText(packagePath));
  const hasLegacyPkg =
    Boolean(pkg.dependencies && Object.prototype.hasOwnProperty.call(pkg.dependencies, 'pkg')) ||
    Boolean(pkg.devDependencies && Object.prototype.hasOwnProperty.call(pkg.devDependencies, 'pkg'));
  const hasYaoPkg = Boolean(pkg.devDependencies && pkg.devDependencies['@yao-pkg/pkg']);
  return [
    makeStaticCheck(
      'package.json excludes legacy pkg dependency',
      !hasLegacyPkg,
      !hasLegacyPkg ? 'No legacy pkg dependency found' : 'Found legacy pkg dependency'
    ),
    makeStaticCheck(
      'package.json includes @yao-pkg/pkg devDependency',
      hasYaoPkg,
      hasYaoPkg ? '@yao-pkg/pkg devDependency present' : 'Missing @yao-pkg/pkg devDependency'
    )
  ];
}

function checkCapacitorLoopbackPolicy() {
  const configPath = path.join(repoRoot, 'capacitor.config.ts');
  const source = readText(configPath);
  return [
    makeStaticCheck(
      'capacitor.config.ts sets hostname localhost',
      hasSubstring(source, "hostname: 'localhost'"),
      'hostname should be localhost'
    ),
    makeStaticCheck(
      'capacitor.config.ts enables cleartext',
      hasSubstring(source, 'cleartext: true'),
      'cleartext should be true for local loopback transport'
    ),
    makeStaticCheck(
      'capacitor.config.ts allowNavigation includes localhost/127.0.0.1',
      hasSubstring(source, "allowNavigation: ['localhost', '127.0.0.1']"),
      'allowNavigation should include localhost and 127.0.0.1'
    )
  ];
}

function checkMigrationGatesJava21Provisioning() {
  const checks = [];
  if (!fs.existsSync(MIGRATION_GATES_WORKFLOW_PATH)) {
    checks.push(
      makeStaticCheck(
        'migration-gates workflow exists',
        false,
        `${MIGRATION_GATES_WORKFLOW_PATH} is missing`
      )
    );
    return checks;
  }

  const source = readText(MIGRATION_GATES_WORKFLOW_PATH);
  checks.push(
    makeStaticCheck(
      'migration-gates tauri-rust-suite uses actions/setup-java@v5',
      source.includes('uses: actions/setup-java@v5'),
      source.includes('uses: actions/setup-java@v5')
        ? 'actions/setup-java@v5 detected'
        : 'actions/setup-java@v5 not found in migration-gates tauri-rust setup'
    )
  );
  checks.push(
    makeStaticCheck(
      'migration-gates tauri-rust-suite pins java-version 21',
      /java-version:\s*['"]?21['"]?/i.test(source),
      /java-version:\s*['"]?21['"]?/i.test(source)
        ? 'java-version 21 detected'
        : 'Expected java-version: 21 in migration-gates tauri-rust setup'
    )
  );
  checks.push(
    makeStaticCheck(
      'migration-gates Java setup is scoped to tauri-rust-suite',
      source.includes("if: matrix.suite == 'tauri-rust-suite'"),
      source.includes("if: matrix.suite == 'tauri-rust-suite'")
        ? 'Conditional suite scoping detected'
        : "Missing if: matrix.suite == 'tauri-rust-suite' scope"
    )
  );

  return checks;
}

function checkSbomAttestationReleaseSignaturePolicy() {
  const checks = [];
  if (!fs.existsSync(NPM_PUBLISH_WORKFLOW_PATH)) {
    checks.push(
      makeStaticCheck(
        'npm-publish workflow exists',
        false,
        `${NPM_PUBLISH_WORKFLOW_PATH} is missing`
      )
    );
    return checks;
  }

  const source = readText(NPM_PUBLISH_WORKFLOW_PATH);
  checks.push(
    makeStaticCheck(
      'npm-publish validates SBOM signing key pair configuration',
      source.includes('Validate SBOM signing key pair configuration'),
      source.includes('Validate SBOM signing key pair configuration')
        ? 'Signing key pair validation step detected'
        : 'Missing signing key pair validation step'
    )
  );
  checks.push(
    makeStaticCheck(
      'npm-publish verifier toggles signature requirement from key provisioning',
      source.includes('NOTE_CONNECTION_REQUIRE_SBOM_ATTESTATION_SIGNATURE'),
      source.includes('NOTE_CONNECTION_REQUIRE_SBOM_ATTESTATION_SIGNATURE')
        ? 'Signature requirement environment toggle detected'
        : 'Missing NOTE_CONNECTION_REQUIRE_SBOM_ATTESTATION_SIGNATURE in publish gate'
    )
  );
  checks.push(
    makeStaticCheck(
      'npm-publish verifier requires signed key-id when signing is enabled',
      source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_REQUIRE_SIGNED_KEY_ID'),
      source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_REQUIRE_SIGNED_KEY_ID')
        ? 'Signed key-id requirement environment toggle detected'
        : 'Missing NOTE_CONNECTION_SBOM_ATTESTATION_REQUIRE_SIGNED_KEY_ID in publish gate'
    )
  );
  checks.push(
    makeStaticCheck(
      'npm-publish exports allowed/revoked SBOM key-id policy env',
      source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_ALLOWED_KEY_IDS') &&
        source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_REVOKED_KEY_IDS'),
      source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_ALLOWED_KEY_IDS') &&
        source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_REVOKED_KEY_IDS')
        ? 'Allowed/revoked key-id policy environment configured'
        : 'Missing NOTE_CONNECTION_SBOM_ATTESTATION_ALLOWED_KEY_IDS or NOTE_CONNECTION_SBOM_ATTESTATION_REVOKED_KEY_IDS'
    )
  );
  checks.push(
    makeStaticCheck(
      'npm-publish validates signing key-id presence when signing keys are provisioned',
      source.includes('signing key-id is required when signing keys are set'),
      source.includes('signing key-id is required when signing keys are set')
        ? 'Signing key-id validation step detected'
        : 'Missing signing key-id validation guard in publish workflow'
    )
  );
  checks.push(
    makeStaticCheck(
      'npm-publish enforces minimum SBOM attestation RSA key strength policy',
      source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_MIN_RSA_BITS'),
      source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_MIN_RSA_BITS')
        ? 'Minimum RSA bits policy detected'
        : 'Missing NOTE_CONNECTION_SBOM_ATTESTATION_MIN_RSA_BITS policy in publish workflow'
    )
  );
  checks.push(
    makeStaticCheck(
      'npm-publish enforces SBOM key rotation overlap policy',
      source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_MIN_ROTATION_OVERLAP_HOURS'),
      source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_MIN_ROTATION_OVERLAP_HOURS')
        ? 'Rotation overlap policy detected'
        : 'Missing NOTE_CONNECTION_SBOM_ATTESTATION_MIN_ROTATION_OVERLAP_HOURS policy in publish workflow'
    )
  );
  checks.push(
    makeStaticCheck(
      'npm-publish supports optional keyring policy materialization',
      source.includes('Materialize SBOM signing keyring policy (optional)') &&
        source.includes('NOTE_CONNECTION_SBOM_SIGNING_PUBLIC_KEYRING_FILE'),
      source.includes('Materialize SBOM signing keyring policy (optional)') &&
        source.includes('NOTE_CONNECTION_SBOM_SIGNING_PUBLIC_KEYRING_FILE')
        ? 'Keyring materialization + verifier wiring detected'
        : 'Missing keyring materialization or NOTE_CONNECTION_SBOM_SIGNING_PUBLIC_KEYRING_FILE wiring'
    )
  );
  checks.push(
    makeStaticCheck(
      'npm-publish requires attestation provenance linkage in strict verification',
      source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_REQUIRE_PROVENANCE') &&
        source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_EXPECT_RELEASE_COMMIT_SHA') &&
        source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_EXPECT_RELEASE_GIT_TAG') &&
        source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_EXPECT_RELEASE_REF'),
      source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_REQUIRE_PROVENANCE') &&
        source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_EXPECT_RELEASE_COMMIT_SHA') &&
        source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_EXPECT_RELEASE_GIT_TAG') &&
        source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_EXPECT_RELEASE_REF')
        ? 'Provenance requirement and immutable release linkage env detected'
        : 'Missing provenance requirement or immutable release linkage env wiring in publish gate'
    )
  );
  checks.push(
    makeStaticCheck(
      'npm-publish pins keyring schema/version when keyring policy is enabled',
      source.includes('NOTE_CONNECTION_SBOM_KEYRING_REQUIRE_SCHEMA_PIN') &&
        source.includes('NOTE_CONNECTION_SBOM_KEYRING_EXPECT_SCHEMA') &&
        source.includes('NOTE_CONNECTION_SBOM_KEYRING_EXPECT_VERSION'),
      source.includes('NOTE_CONNECTION_SBOM_KEYRING_REQUIRE_SCHEMA_PIN') &&
        source.includes('NOTE_CONNECTION_SBOM_KEYRING_EXPECT_SCHEMA') &&
        source.includes('NOTE_CONNECTION_SBOM_KEYRING_EXPECT_VERSION')
        ? 'Keyring schema/version pin policy detected'
        : 'Missing keyring schema/version pin policy wiring in publish workflow'
    )
  );
  checks.push(
    makeStaticCheck(
      'npm-publish enables attestation transparency log generation',
      source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_ENABLE_TRANSPARENCY_LOG') &&
        source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_TRANSPARENCY_LOG_PATH'),
      source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_ENABLE_TRANSPARENCY_LOG') &&
        source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_TRANSPARENCY_LOG_PATH')
        ? 'Transparency log generation policy detected'
        : 'Missing attestation transparency log generation policy wiring'
    )
  );
  checks.push(
    makeStaticCheck(
      'npm-publish enforces attestation transparency inclusion verification',
      source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_REQUIRE_TRANSPARENCY_LOG') &&
        source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_VERIFY_TRANSPARENCY_LOG_INCLUSION'),
      source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_REQUIRE_TRANSPARENCY_LOG') &&
        source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_VERIFY_TRANSPARENCY_LOG_INCLUSION')
        ? 'Transparency inclusion verification policy detected'
        : 'Missing transparency inclusion verification policy wiring'
    )
  );
  checks.push(
    makeStaticCheck(
      'npm-publish pins transparency proof schema/version in strict gate',
      source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_TRANSPARENCY_REQUIRE_SCHEMA_PIN') &&
        source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_TRANSPARENCY_EXPECT_SCHEMA') &&
        source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_TRANSPARENCY_EXPECT_VERSION'),
      source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_TRANSPARENCY_REQUIRE_SCHEMA_PIN') &&
        source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_TRANSPARENCY_EXPECT_SCHEMA') &&
        source.includes('NOTE_CONNECTION_SBOM_ATTESTATION_TRANSPARENCY_EXPECT_VERSION')
        ? 'Transparency proof schema/version pin policy detected'
        : 'Missing transparency proof schema/version pin policy wiring'
    )
  );
  return checks;
}

function checkLocalhostPortFallbackPolicy() {
  const serverPath = path.join(repoRoot, 'src', 'server.ts');
  const source = readText(serverPath);
  return [
    makeStaticCheck(
      'server.ts gates ephemeral fallback behind explicit env opt-in',
      source.includes('NOTE_CONNECTION_ALLOW_EPHEMERAL_PORT_FALLBACK') &&
        source.includes('const allowEphemeralFallback = explicitEphemeralFallback'),
      source.includes('NOTE_CONNECTION_ALLOW_EPHEMERAL_PORT_FALLBACK') &&
        source.includes('const allowEphemeralFallback = explicitEphemeralFallback')
        ? 'Explicit opt-in fallback flag detected'
        : 'Missing explicit fallback opt-in policy'
    ),
    makeStaticCheck(
      'server.ts emits deterministic-origin guidance on EADDRINUSE without opt-in',
      source.includes('Ephemeral port fallback is disabled by default') &&
        source.includes('origin policy deterministic'),
      source.includes('Ephemeral port fallback is disabled by default') &&
        source.includes('origin policy deterministic')
        ? 'Deterministic-origin fallback guidance detected'
        : 'Missing deterministic-origin EADDRINUSE guidance'
    )
  ];
}

function collectIssueResult(issueId, checks, options = {}) {
  const allPassed = checks.every((check) => check.ok);
  const pendingReason = options.pendingReason ? String(options.pendingReason).trim() : '';

  let status = 'verification-failed';
  if (allPassed && pendingReason.length === 0) {
    status = 'verified-closed';
  } else if (allPassed && pendingReason.length > 0) {
    status = options.strictPending ? 'verification-failed-pending' : 'verified-pending';
  }

  return {
    id: issueId,
    status,
    pendingReason: pendingReason.length > 0 ? pendingReason : null,
    checks,
    verification: checks.map((check) => `${check.ok ? 'PASS' : 'FAIL'} ${check.name}${check.detail ? `: ${check.detail}` : ''}`),
    passedChecks: checks.filter((check) => check.ok).length,
    totalChecks: checks.length
  };
}

function checkCommandWithKnownPending(commandResult, pendingPatterns) {
  if (commandResult.ok) {
    return { pending: false, pendingReason: '' };
  }

  const combined = `${commandResult.stderr}\n${commandResult.stdout}`.toLowerCase();
  for (const pattern of pendingPatterns) {
    if (combined.includes(pattern.toLowerCase())) {
      return { pending: true, pendingReason: pattern };
    }
  }
  return { pending: false, pendingReason: '' };
}

function writeReport(paths, payload) {
  ensureDir(paths.latest);
  fs.writeFileSync(paths.latest, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  if (paths.dated) {
    ensureDir(paths.dated);
    fs.writeFileSync(paths.dated, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }
}

function printIssueSummary(issue) {
  const status = issue.status.toUpperCase();
  const summary = `[Fixrisk Verify] ${issue.id} -> ${status} (${issue.passedChecks}/${issue.totalChecks} checks passed)`;
  if (issue.status.startsWith('verified-pending') && issue.pendingReason) {
    console.warn(`${summary} pending=${issue.pendingReason}`);
  } else if (issue.status.startsWith('verification-failed')) {
    console.error(summary);
  } else {
    console.log(summary);
  }
}

function main() {
  const startedAtIso = new Date().toISOString();
  const options = parseArgs(process.argv.slice(2));

  const docsParity = checkDocsParity();
  const contractRun = runContractJestSuite();
  const workflowChecks = checkWorkflowNode24Migration();
  const java21ProvisioningChecks = checkMigrationGatesJava21Provisioning();
  const sbomAttestationReleaseChecks = checkSbomAttestationReleaseSignaturePolicy();
  const packageChecks = checkPackageSidecarConflict();
  const capacitorPolicyChecks = checkCapacitorLoopbackPolicy();
  const localhostPortFallbackChecks = checkLocalhostPortFallbackPolicy();

  const sidecarSignatureVerify = runCommand(process.execPath, [
    path.join(repoRoot, 'scripts', 'verify-sidecar-signatures.js'),
    '--contract-only'
  ]);
  const privacyManifestVerify = runCommand(process.execPath, [
    path.join(repoRoot, 'scripts', 'verify-privacy-manifest.js')
  ]);
  const detoxPipelineVerify = runCommand(process.execPath, [
    path.join(repoRoot, 'scripts', 'verify-detox-pipeline.js')
  ]);
  const sbomPolicyVerify = runCommand(process.execPath, [
    path.join(repoRoot, 'scripts', 'verify-sbom-policy.js'),
    '--contract-only'
  ]);
  const sbomAttestationPolicyVerify = runCommand(process.execPath, [
    path.join(repoRoot, 'scripts', 'verify-sbom-attestation.js'),
    '--contract-only'
  ]);
  const pathBridgeStrictSchemaVerify = runCommand(process.execPath, [
    path.join(repoRoot, 'scripts', 'verify-pathbridge-strict-schema.js'),
    '--contract-only'
  ]);
  const strictLargeGraphNodeCount = String(process.env.NOTE_CONNECTION_MIN_EVIDENCE_NODE_COUNT || '10000');
  const strictLargeGraphEdgeCount = String(process.env.NOTE_CONNECTION_MIN_EVIDENCE_EDGE_COUNT || '1000000');
  const strictLargeGraphEnv = {
    ...process.env,
    NOTE_CONNECTION_REQUIRE_LARGE_GRAPH_EVIDENCE: '1',
    NOTE_CONNECTION_MIN_EVIDENCE_NODE_COUNT: strictLargeGraphNodeCount,
    NOTE_CONNECTION_MIN_EVIDENCE_EDGE_COUNT: strictLargeGraphEdgeCount
  };
  const capacitorEvidenceVerify = runCommand(process.execPath, [
    path.join(repoRoot, 'scripts', 'verify-capacitor-evidence-freshness.js')
  ], {
    env: strictLargeGraphEnv
  });
  const tauriAndroidPrereqVerify = runCommand(process.execPath, [
    path.join(repoRoot, 'scripts', 'verify-tauri-android-prereqs.js')
  ]);

  const fr001 = collectIssueResult(
    'FR-001',
    [
      makeJestExpectationCheck('src/runtime.spool.policy.contract.test.ts', contractRun),
      ...docsParity.checks.filter((check) => check.name.includes('FR-001'))
    ],
    options
  );

  const fr002 = collectIssueResult(
    'FR-002',
    [
      makeJestExpectationCheck('src/pkg.sidecar.contract.test.ts', contractRun),
      ...packageChecks,
      ...docsParity.checks.filter((check) => check.name.includes('FR-002'))
    ],
    options
  );

  const fr003 = collectIssueResult(
    'FR-003',
    [
      makeJestExpectationCheck('src/mobile.pipeline.test.ts', contractRun),
      ...capacitorPolicyChecks,
      ...docsParity.checks.filter((check) => check.name.includes('FR-003'))
    ],
    options
  );

  const fr004 = collectIssueResult(
    'FR-004',
    [
      makeJestExpectationCheck('src/pkg.snapshot.safety.contract.test.ts', contractRun),
      ...docsParity.checks.filter((check) => check.name.includes('FR-004'))
    ],
    options
  );

  const fr005 = collectIssueResult(
    'FR-005',
    [
      makeJestExpectationCheck('src/runtime.heap.policy.contract.test.ts', contractRun),
      ...docsParity.checks.filter((check) => check.name.includes('FR-005'))
    ],
    options
  );

  const fr006 = collectIssueResult(
    'FR-006',
    [
      makeJestExpectationCheck('src/sidecar.signature.contract.test.ts', contractRun),
      makeCheck('verify-sidecar-signatures --contract-only', sidecarSignatureVerify, 'Contract-only sidecar signature gate passed'),
      ...docsParity.checks.filter((check) => check.name.includes('FR-006'))
    ],
    options
  );

  const fr007 = collectIssueResult(
    'FR-007',
    [
      makeJestExpectationCheck('src/graph.accessibility.contract.test.ts', contractRun),
      ...docsParity.checks.filter((check) => check.name.includes('FR-007'))
    ],
    options
  );

  const fr008 = collectIssueResult(
    'FR-008',
    [
      makeJestExpectationCheck('src/privacy.manifest.contract.test.ts', contractRun),
      makeCheck('verify-privacy-manifest', privacyManifestVerify, 'Privacy manifest verifier passed'),
      ...docsParity.checks.filter((check) => check.name.includes('FR-008'))
    ],
    options
  );

  const fr009Pending = checkCommandWithKnownPending(capacitorEvidenceVerify, [
    'evidence root not found',
    'no acceptance_evidence.json found',
    'evidence is stale',
    'manifest workload evidence is missing nodecount/edgecount',
    'manifest workload nodecount',
    'manifest workload edgecount',
    'checklist item must be true when large-graph evidence is required',
    'manifest missing device.runtime classification required for physical-device evidence',
    'evidence device is classified as emulator'
  ]);
  const fr009 = collectIssueResult(
    'FR-009',
    [
      makeJestExpectationCheck('src/capacitor.evidence.contract.test.ts', contractRun),
      makeCheckWithPending(
        'verify-capacitor-evidence-freshness',
        capacitorEvidenceVerify,
        'Capacitor evidence freshness verifier passed',
        fr009Pending
      ),
      ...docsParity.checks.filter((check) => check.name.includes('FR-009'))
    ],
    {
      ...options,
      pendingReason: fr009Pending.pending
        ? 'Operational evidence pending: large-graph physical-device evidence is missing, stale, or below threshold.'
        : ''
    }
  );

  const fr010 = collectIssueResult(
    'FR-010',
    [
      ...workflowChecks,
      ...docsParity.checks.filter((check) => check.name.includes('FR-010'))
    ],
    options
  );

  const fr011Pending = checkCommandWithKnownPending(tauriAndroidPrereqVerify, [
    'needs java 21 toolchain availability',
    'unsupported jdk detected',
    'java compiler (javac) not available on path'
  ]);
  const fr011 = collectIssueResult(
    'FR-011',
    [
      makeJestExpectationCheck('src/tauri.test.runner.contract.test.ts', contractRun),
      makeCheckWithPending(
        'verify-tauri-android-prereqs',
        tauriAndroidPrereqVerify,
        'Android prerequisite verifier passed',
        fr011Pending
      ),
      ...java21ProvisioningChecks,
      ...docsParity.checks.filter((check) => check.name.includes('FR-011'))
    ],
    {
      ...options,
      pendingReason: fr011Pending.pending
        ? 'Host provisioning pending: Java 21 toolchain availability is required.'
        : ''
    }
  );

  const fr012 = collectIssueResult(
    'FR-012',
    [
      makeJestExpectationCheck('src/privacy.manifest.contract.test.ts', contractRun),
      makeCheck('verify-privacy-manifest', privacyManifestVerify, 'Privacy manifest verifier passed'),
      ...docsParity.checks.filter((check) => check.name.includes('FR-012'))
    ],
    options
  );

  const fr013 = collectIssueResult(
    'FR-013',
    [
      makeJestExpectationCheck('src/server.port.fallback.contract.test.ts', contractRun),
      ...localhostPortFallbackChecks,
      ...docsParity.checks.filter((check) => check.name.includes('FR-013'))
    ],
    options
  );

  const issues = [fr001, fr002, fr003, fr004, fr005, fr006, fr007, fr008, fr009, fr010, fr011, fr012, fr013];
  const allChecks = issues.flatMap((issue) => issue.checks);
  const failedIssues = issues.filter((issue) => issue.status.startsWith('verification-failed')).map((issue) => issue.id);
  const pendingIssues = issues.filter((issue) => issue.status === 'verified-pending').map((issue) => issue.id);

  const nonIssueChecks = [
    makeCheck('verify-detox-pipeline', detoxPipelineVerify, 'Detox pipeline verifier passed'),
    makeCheck(
      'verify-sbom-policy --contract-only',
      sbomPolicyVerify,
      'SBOM policy verifier contract mode passed'
    ),
    makeCheck(
      'verify-sbom-attestation --contract-only',
      sbomAttestationPolicyVerify,
      'SBOM attestation verifier contract mode passed'
    ),
    makeCheck(
      'verify-pathbridge-strict-schema --contract-only',
      pathBridgeStrictSchemaVerify,
      'PathBridge strict schema verifier contract mode passed'
    ),
    ...sbomAttestationReleaseChecks,
    makeStaticCheck(
      'Fixrisk contract Jest aggregate command succeeded',
      contractRun.commandResult.ok,
      contractRun.commandResult.ok
        ? `Jest suite passed (${CONTRACT_TEST_FILES.length} files)`
        : trimText(`${contractRun.commandResult.stderr}\n${contractRun.commandResult.stdout}`)
    ),
    ...docsParity.checks.filter((check) => check.name.startsWith('No unexpected FR IDs'))
  ];

  const report = {
    generatedAt: startedAtIso,
    completedAt: new Date().toISOString(),
    source: [
      path.relative(repoRoot, EN_DOC_PATH).replace(/\\/g, '/'),
      path.relative(repoRoot, ZH_DOC_PATH).replace(/\\/g, '/')
    ],
    options: {
      strictPending: options.strictPending,
      writeDatedSnapshot: options.writeDatedSnapshot
    },
    contractSuite: {
      tests: CONTRACT_TEST_FILES,
      jestReportPath: path.relative(repoRoot, jestJsonReportPath).replace(/\\/g, '/'),
      command: contractRun.commandResult.command,
      ok: contractRun.commandResult.ok,
      exitCode: contractRun.commandResult.exitCode,
      durationMs: contractRun.commandResult.durationMs
    },
    issues,
    nonIssueChecks,
    overall: {
      issueCount: issues.length,
      passedIssueCount: issues.filter((issue) => issue.status === 'verified-closed').length,
      pendingIssueCount: pendingIssues.length,
      failedIssueCount: failedIssues.length,
      failedIssues,
      pendingIssues,
      allCodeLevelIssuesClosed: failedIssues.length === 0,
      pendingOperationalBlocker:
        pendingIssues.length > 0
          ? pendingIssues.join(', ')
          : null,
      totalChecks: allChecks.length + nonIssueChecks.length,
      passedChecks: [...allChecks, ...nonIssueChecks].filter((check) => check.ok).length
    }
  };

  const reportPaths = {
    latest: options.reportPath,
    dated: options.writeDatedSnapshot ? datedReportPath : null
  };
  writeReport(reportPaths, report);

  for (const issue of issues) {
    printIssueSummary(issue);
  }

  if (!nonIssueChecks.every((check) => check.ok)) {
    const failed = nonIssueChecks.filter((check) => !check.ok).map((check) => check.name);
    console.error(`[Fixrisk Verify] Non-issue checks failed: ${failed.join(', ')}`);
  }

  const shouldFail =
    failedIssues.length > 0 ||
    !nonIssueChecks.every((check) => check.ok) ||
    (options.strictPending && pendingIssues.length > 0);

  const latestOut = path.relative(repoRoot, options.reportPath).replace(/\\/g, '/');
  console.log(`[Fixrisk Verify] Report written: ${latestOut}`);
  if (options.writeDatedSnapshot) {
    console.log(
      `[Fixrisk Verify] Dated snapshot written: ${path.relative(repoRoot, datedReportPath).replace(/\\/g, '/')}`
    );
  }

  process.exit(shouldFail ? 1 : 0);
}

main();
