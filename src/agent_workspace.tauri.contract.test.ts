import * as fs from 'fs';
import * as path from 'path';

type PackageJson = {
  scripts?: Record<string, string>;
};

type TauriSmokeModule = {
  verifyAgentWorkspaceTauri: (options?: {
    runtimeTimeoutMs?: number;
    lifecycleTimeoutMs?: number;
    logger?: Pick<Console, 'log' | 'warn' | 'error'>;
  }) => Promise<{
    generatedAt: string;
    artifacts: {
      artifactDir: string;
      reportPath: string;
      latestReportPath?: string;
      lifecycleLogPath: string;
    };
    runtimeChecks: {
      hasAgentWorkspaceShell: boolean;
      hasAgentChatPane: boolean;
      hasGraphFocusPane: boolean;
      hasLearningPathPane: boolean;
      hasAgentWorkspaceI18nKey: boolean;
    };
    localeChecks: {
      hasAgentWorkspaceNamespace: boolean;
      focusLabel: string;
      localNodeUnavailableTemplate: string;
      queryBackendDiagnosticsRolloutModeLabel: string;
      queryBackendDiagnosticsAccelerationProviderLabel: string;
      queryBackendDiagnosticsAccelerationFailureModeLabel: string;
      queryBackendDiagnosticsAccelerationRepresentationStrictLabel: string;
      queryBackendDiagnosticsAnnPrefilterLabel: string;
    };
    tauriConfig: {
      path: string;
      frontendDist: string;
      withGlobalTauri: boolean;
      windowCount: number;
      checks: {
        frontendDistMatchesDistFrontend: boolean;
        withGlobalTauriEnabled: boolean;
        hasAtLeastOneWindow: boolean;
        firstWindowHasTitle: boolean;
      };
    };
    sourceLifecycleChecks: {
      rustBuildsTogglePlan: boolean;
      rustBuildsToggleEventPayload: boolean;
      rustEmitsPathmodeWindowToggledEvent: boolean;
      frontendListensPathmodeWindowToggledEvent: boolean;
      frontendStoresPathmodeLifecycleTrace: boolean;
      frontendDispatchesPathmodeLifecycleDomEvent: boolean;
      frontendEnterInvokesShowToggle: boolean;
      frontendExitInvokesHideToggle: boolean;
    };
    lifecycleChecks: {
      passed: boolean;
      exitCode: number;
      timedOut: boolean;
      command: string;
      testNamePattern: string;
      coveredTestNames: string[];
    };
  }>;
};

type TauriWindowEvidenceModule = {
  verifyAgentWorkspaceTauriWindowEvidence: (options?: {
    strictWindowEvidence?: boolean;
    skipProxySmoke?: boolean;
    runtimeTimeoutMs?: number;
    lifecycleTimeoutMs?: number;
    windowEvidenceTimeoutMs?: number;
  }) => Promise<{
    generatedAt: string;
    artifacts: {
      artifactDir: string;
      reportPath: string;
      latestReportPath?: string;
    };
    strictWindowEvidence: boolean;
    proxySmoke: null | {
      lifecycleChecks: {
        passed: boolean;
      };
      sourceLifecycleChecks: Record<string, boolean>;
      reportPath: string;
    };
    prerequisites: {
      canAttempt: boolean;
      reasons: string[];
      dependencyCheck: {
        pkgConfigAvailable: boolean;
        missingDependencies: string[];
      };
    };
    windowEvidence: {
      attempted: boolean;
      tests: Array<{
        pattern: string;
        exitCode: number;
        logPath: string;
      }>;
    };
    summary: {
      status: 'passed' | 'degraded' | 'failed';
      passed: boolean;
    };
  }>;
};

type TauriEvidenceIndexModule = {
  EVIDENCE_INDEX_SCHEMA_PATH: string;
  EVIDENCE_INDEX_SCHEMA: string;
  EVIDENCE_INDEX_VERSION: number;
  verifyAgentWorkspaceTauriEvidenceIndex: (options?: {
    strict?: boolean;
  }) => {
    generatedAt: string;
    schema: string;
    version: number;
    evidenceSetId: string;
    strict: boolean;
    artifacts: {
      artifactDir: string;
      indexPath: string;
      latestIndexPath: string;
    };
    reports: {
      rust: { found: boolean; reportPath: string | null; passed: boolean; skipped: boolean };
      windowEvidence: {
        found: boolean;
        reportPath: string | null;
        passed: boolean;
        status: string;
      };
      proxySmoke: { found: boolean; reportPath: string | null; passed: boolean };
    };
    summary: {
      status: string;
      passed: boolean;
      missing: string[];
      reasons: string[];
    };
  };
};

type TauriEvidenceSummaryModule = {
  renderAgentWorkspaceTauriEvidenceSummary: (options?: {
    indexPath?: string;
    outputPath?: string;
    appendStepSummary?: boolean;
  }) => {
    indexPath: string;
    outputPath: string;
    markdown: string;
    summaryStatus: string;
  };
};

type TauriEvidenceManifestModule = {
  MANIFEST_SCHEMA_PATH: string;
  MANIFEST_SCHEMA: string;
  MANIFEST_VERSION: number;
  validateManifestReport?: (report: unknown) => void;
  renderAgentWorkspaceTauriEvidenceManifest: (options?: {
    indexPath?: string;
    outputDir?: string;
    strict?: boolean;
  }) => {
    manifestPath: string;
    latestManifestPath: string;
    manifest: {
      schema: string;
      version: number;
      strict: boolean;
      artifacts: Array<{
        id: string;
        exists: boolean;
        sha256: string | null;
      }>;
      summary: {
        totalArtifactCount: number;
        presentArtifactCount: number;
        missingArtifactCount: number;
      };
      strictValidation: {
        passed: boolean;
        reasons: string[];
      };
    };
  };
};

type TauriEvidenceReleaseFragmentModule = {
  renderAgentWorkspaceTauriEvidenceReleaseFragment: (options?: {
    indexPath?: string;
    outputPath?: string;
    appendStepSummary?: boolean;
  }) => {
    indexPath: string;
    outputPath: string;
    markdown: string;
    status: string;
  };
};

type TauriEvidenceReleaseNotesModule = {
  EVIDENCE_SECTION_START: string;
  EVIDENCE_SECTION_END: string;
  upsertReleaseEvidenceSection: (releaseBody: string, fragmentMarkdown: string) => string;
};

jest.setTimeout(180000);

describe('agent workspace tauri smoke contract', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const migrationWorkflowPath = path.join(repoRoot, '.github', 'workflows', 'migration-gates.yml');
  const releaseWorkflowPath = path.join(
    repoRoot,
    '.github',
    'workflows',
    'release-desktop-multi-os.yml'
  );
  const tauriSmokeScriptPath = path.join(repoRoot, 'scripts', 'verify-agent-workspace-tauri.js');
  const tauriRustSmokeScriptPath = path.join(
    repoRoot,
    'scripts',
    'verify-agent-workspace-tauri-rust.js'
  );
  const tauriWindowEvidenceScriptPath = path.join(
    repoRoot,
    'scripts',
    'verify-agent-workspace-tauri-window-evidence.js'
  );
  const tauriEvidenceIndexScriptPath = path.join(
    repoRoot,
    'scripts',
    'verify-agent-workspace-tauri-evidence-index.js'
  );
  const tauriEvidenceSummaryScriptPath = path.join(
    repoRoot,
    'scripts',
    'render-agent-workspace-tauri-evidence-summary.js'
  );
  const tauriEvidenceManifestScriptPath = path.join(
    repoRoot,
    'scripts',
    'render-agent-workspace-tauri-evidence-manifest.js'
  );
  const tauriEvidenceReleaseFragmentScriptPath = path.join(
    repoRoot,
    'scripts',
    'render-agent-workspace-tauri-evidence-release-fragment.js'
  );
  const tauriEvidenceReleaseNotesScriptPath = path.join(
    repoRoot,
    'scripts',
    'publish-agent-workspace-tauri-evidence-release-notes.js'
  );
  const tauriLibSourcePath = path.join(repoRoot, 'src-tauri', 'src', 'lib.rs');

  test('package exposes a dedicated agent-workspace tauri verification command', () => {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as PackageJson;
    expect(packageJson.scripts?.['test:agent-workspace:contracts']).toBe(
      'jest src/agent_workspace.contract.parity.test.ts src/agent_workspace.locale.contract.test.ts src/agent_workspace.frontend.test.ts src/agent_workspace.runtime.contract.test.ts src/agent_workspace.tauri.contract.test.ts --runInBand'
    );
    expect(packageJson.scripts?.['test:conversation-turn-cache:durability']).toBe(
      'jest src/notemd.server.integration.test.ts --runInBand --testNamePattern="turn-cache alert trend restart durability"'
    );
    expect(packageJson.scripts?.['verify:agent-workspace:tauri']).toBe(
      'node scripts/verify-agent-workspace-tauri.js'
    );
    expect(packageJson.scripts?.['verify:agent-workspace:tauri:window-evidence']).toBe(
      'node scripts/verify-agent-workspace-tauri-window-evidence.js'
    );
    expect(packageJson.scripts?.['verify:agent-workspace:tauri:window-evidence:strict']).toBe(
      'node scripts/verify-agent-workspace-tauri-window-evidence.js --strict'
    );
    expect(packageJson.scripts?.['verify:agent-workspace:tauri:rust']).toBe(
      'node scripts/verify-agent-workspace-tauri-rust.js'
    );
    expect(packageJson.scripts?.['verify:agent-workspace:tauri:rust:strict']).toBe(
      'node scripts/verify-agent-workspace-tauri-rust.js --strict'
    );
    expect(packageJson.scripts?.['verify:agent-workspace:tauri:evidence:index']).toBe(
      'node scripts/verify-agent-workspace-tauri-evidence-index.js'
    );
    expect(packageJson.scripts?.['verify:agent-workspace:tauri:evidence:index:strict']).toBe(
      'node scripts/verify-agent-workspace-tauri-evidence-index.js --strict'
    );
    expect(packageJson.scripts?.['verify:agent-workspace:tauri:evidence:summary']).toBe(
      'node scripts/render-agent-workspace-tauri-evidence-summary.js'
    );
    expect(packageJson.scripts?.['verify:agent-workspace:tauri:evidence:manifest']).toBe(
      'node scripts/render-agent-workspace-tauri-evidence-manifest.js'
    );
    expect(packageJson.scripts?.['verify:agent-workspace:tauri:evidence:manifest:strict']).toBe(
      'node scripts/render-agent-workspace-tauri-evidence-manifest.js --strict'
    );
    expect(packageJson.scripts?.['verify:agent-workspace:tauri:evidence:release-fragment']).toBe(
      'node scripts/render-agent-workspace-tauri-evidence-release-fragment.js'
    );
    expect(
      packageJson.scripts?.['verify:agent-workspace:tauri:evidence:publish-release-notes']
    ).toBe('node scripts/publish-agent-workspace-tauri-evidence-release-notes.js');
  });

  test('migration workflow enforces strict tauri rust and window evidence gates', () => {
    const workflow = fs.readFileSync(migrationWorkflowPath, 'utf8');
    expect(workflow).toContain('agent-workspace-contract-gates');
    expect(workflow).toContain('Run agent-workspace contract suites');
    expect(workflow).toContain('npm run test:agent-workspace:contracts');
    expect(workflow).toContain('npm run test:conversation-turn-cache:durability');
    expect(workflow).toContain('agent-workspace-tauri-strict-evidence');
    expect(workflow).toContain('npm run verify:agent-workspace:tauri:rust:strict');
    expect(workflow).toContain('npm run verify:agent-workspace:tauri:window-evidence:strict');
    expect(workflow).toContain('Build tauri evidence index (always)');
    expect(workflow).toContain('npm run verify:agent-workspace:tauri:evidence:index');
    expect(workflow).toContain('Enforce strict tauri evidence index gate');
    expect(workflow).toContain('npm run verify:agent-workspace:tauri:evidence:index:strict');
    expect(workflow).toContain('Render tauri evidence summary (always)');
    expect(workflow).toContain(
      'npm run verify:agent-workspace:tauri:evidence:summary -- --append-step-summary'
    );
    expect(workflow).toContain('Render tauri evidence release fragment (always)');
    expect(workflow).toContain(
      'node scripts/render-agent-workspace-tauri-evidence-release-fragment.js --append-step-summary'
    );
    expect(workflow).toContain('Render tauri evidence manifest (always)');
    expect(workflow).toContain('npm run verify:agent-workspace:tauri:evidence:manifest');
    expect(workflow).toContain('Enforce strict tauri evidence manifest gate');
    expect(workflow).toContain('npm run verify:agent-workspace:tauri:evidence:manifest:strict');
    expect(workflow).toContain('Upload strict tauri evidence artifacts');
    expect(workflow).toContain('if: always()');
    expect(workflow).toContain('output/tauri/agent-workspace-rust-tests/**');
    expect(workflow).toContain('output/tauri/agent-workspace-window-evidence/**');
    expect(workflow).toContain('output/tauri/agent-workspace-smoke/**');
    expect(workflow).toContain('output/tauri/agent-workspace-evidence-index/**');
    expect(workflow).toContain('retention-days: 30');
    expect(workflow).toContain('libjavascriptcoregtk-4.1-dev');
    expect(workflow).toContain('libsoup-3.0-dev');
  });

  test('release workflow keeps Linux strict tauri lifecycle evidence gate before desktop bundle build', () => {
    const workflow = fs.readFileSync(releaseWorkflowPath, 'utf8');
    expect(workflow).toContain('Install Linux strict tauri evidence dependencies');
    expect(workflow).toContain("if: runner.os == 'Linux'");
    expect(workflow).toContain('Run strict tauri lifecycle evidence gates (Linux release gate)');
    expect(workflow).toContain('npm run verify:agent-workspace:tauri:rust:strict');
    expect(workflow).toContain('npm run verify:agent-workspace:tauri:window-evidence:strict');
    expect(workflow).toContain('Build tauri evidence index (always, Linux release gate)');
    expect(workflow).toContain('npm run verify:agent-workspace:tauri:evidence:index');
    expect(workflow).toContain('Enforce strict tauri evidence index gate (Linux release gate)');
    expect(workflow).toContain('npm run verify:agent-workspace:tauri:evidence:index:strict');
    expect(workflow).toContain('Render tauri evidence summary (always, Linux release gate)');
    expect(workflow).toContain(
      'npm run verify:agent-workspace:tauri:evidence:summary -- --append-step-summary'
    );
    expect(workflow).toContain('Render tauri evidence release fragment (always, Linux release gate)');
    expect(workflow).toContain(
      'node scripts/render-agent-workspace-tauri-evidence-release-fragment.js --append-step-summary'
    );
    expect(workflow).toContain('Render tauri evidence manifest (always, Linux release gate)');
    expect(workflow).toContain('npm run verify:agent-workspace:tauri:evidence:manifest');
    expect(workflow).toContain('Enforce strict tauri evidence manifest gate (Linux release gate)');
    expect(workflow).toContain('npm run verify:agent-workspace:tauri:evidence:manifest:strict');
    expect(workflow).toContain(
      'Publish tauri evidence release fragment to GitHub release notes (always, Linux release gate)'
    );
    expect(workflow).toContain(
      'npm run verify:agent-workspace:tauri:evidence:publish-release-notes -- --tag "${{ needs.ensure-release.outputs.tag_name }}"'
    );
    expect(workflow).toContain('Upload strict tauri evidence artifacts (Linux release gate)');
    expect(workflow).toContain("if: always() && runner.os == 'Linux'");
    expect(workflow).toContain('output/tauri/agent-workspace-evidence-index/**');
    expect(workflow).toContain('retention-days: 30');
  });

  test('tauri verification script validates runtime shell, tauri config, and lifecycle promotion smoke', async () => {
    const tauriSmoke = require(tauriSmokeScriptPath) as TauriSmokeModule;
    expect(typeof tauriSmoke.verifyAgentWorkspaceTauri).toBe('function');

    const report = await tauriSmoke.verifyAgentWorkspaceTauri({
      runtimeTimeoutMs: 15000,
      lifecycleTimeoutMs: 120000,
      logger: {
        log: () => {},
        warn: () => {},
        error: () => {},
      },
    });

    expect(report.runtimeChecks).toEqual({
      hasAgentWorkspaceShell: true,
      hasAgentChatPane: true,
      hasGraphFocusPane: true,
      hasLearningPathPane: true,
      hasAgentWorkspaceI18nKey: true,
    });
    expect(report.localeChecks.hasAgentWorkspaceNamespace).toBe(true);
    expect(report.localeChecks.focusLabel).toBe('聚焦');
    expect(report.localeChecks.localNodeUnavailableTemplate).toContain('{nodeId}');
    expect(report.localeChecks.queryBackendDiagnosticsRolloutModeLabel).toBe('发布策略模式');
    expect(report.localeChecks.queryBackendDiagnosticsAccelerationProviderLabel).toBe('加速提供方配置');
    expect(report.localeChecks.queryBackendDiagnosticsAccelerationFailureModeLabel).toBe('加速失败模式配置');
    expect(report.localeChecks.queryBackendDiagnosticsAccelerationRepresentationStrictLabel)
      .toBe('加速表示一致性严格模式配置');
    expect(report.localeChecks.queryBackendDiagnosticsAnnPrefilterLabel).toBe('ANN 预筛选发布状态');
    expect(report.tauriConfig.checks.frontendDistMatchesDistFrontend).toBe(true);
    expect(report.tauriConfig.checks.withGlobalTauriEnabled).toBe(true);
    expect(report.tauriConfig.checks.hasAtLeastOneWindow).toBe(true);
    expect(report.tauriConfig.checks.firstWindowHasTitle).toBe(true);
    expect(report.sourceLifecycleChecks.rustBuildsTogglePlan).toBe(true);
    expect(report.sourceLifecycleChecks.rustBuildsToggleEventPayload).toBe(true);
    expect(report.sourceLifecycleChecks.rustEmitsPathmodeWindowToggledEvent).toBe(true);
    expect(report.sourceLifecycleChecks.frontendListensPathmodeWindowToggledEvent).toBe(true);
    expect(report.sourceLifecycleChecks.frontendStoresPathmodeLifecycleTrace).toBe(true);
    expect(report.sourceLifecycleChecks.frontendDispatchesPathmodeLifecycleDomEvent).toBe(true);
    expect(report.sourceLifecycleChecks.frontendEnterInvokesShowToggle).toBe(true);
    expect(report.sourceLifecycleChecks.frontendExitInvokesHideToggle).toBe(true);
    expect(report.lifecycleChecks.passed).toBe(true);
    expect(report.lifecycleChecks.timedOut).toBe(false);
    expect(report.lifecycleChecks.testNamePattern).toContain('supports parallel graph-focus');
    expect(Array.isArray(report.lifecycleChecks.coveredTestNames)).toBe(true);
    expect(report.lifecycleChecks.coveredTestNames).toContain(
      'supports parallel graph-focus and learning-path panes with exclusive workspace promotion state'
    );
    expect(report.lifecycleChecks.coveredTestNames).toContain(
      'mounts the existing path workspace into the learning-path pane and restores it on clear'
    );
    expect(report.lifecycleChecks.command).toContain('agent_workspace.frontend.test.ts');
    expect(fs.existsSync(report.artifacts.artifactDir)).toBe(true);
    expect(fs.existsSync(report.artifacts.reportPath)).toBe(true);
    expect(fs.existsSync(report.artifacts.lifecycleLogPath)).toBe(true);
  });

  test('rust source keeps pathmode lifecycle helper and event emission contract', () => {
    const rustSource = fs.readFileSync(tauriLibSourcePath, 'utf8');
    expect(rustSource).toMatch(/fn\s+resolve_pathmode_window_toggle_plan\s*\(/);
    expect(rustSource).toMatch(/fn\s+build_pathmode_window_toggled_event_payload\s*\(/);
    expect(rustSource).toMatch(/fn\s+toggle_pathmode_window_with_runtime\s*</);
    expect(rustSource).toMatch(/app\.emit\("pathmode-window-toggled"/);
    expect(rustSource).toMatch(/pathmode_window_real_app_window_lifecycle_emits_toggle_events/);
  });

  test('tauri rust verification script exports a callable verifier', () => {
    const rustSmoke = require(tauriRustSmokeScriptPath) as {
      verifyAgentWorkspaceTauriRust?: unknown;
    };
    expect(typeof rustSmoke.verifyAgentWorkspaceTauriRust).toBe('function');
    const rustSmokeSource = fs.readFileSync(tauriRustSmokeScriptPath, 'utf8');
    expect(rustSmokeSource).toContain('report-latest.json');
  });

  test('tauri evidence index script exports schema/versioned index and writes latest snapshot', () => {
    const evidenceIndex = require(tauriEvidenceIndexScriptPath) as TauriEvidenceIndexModule;
    expect(typeof evidenceIndex.verifyAgentWorkspaceTauriEvidenceIndex).toBe('function');
    expect(typeof evidenceIndex.EVIDENCE_INDEX_SCHEMA_PATH).toBe('string');
    expect(typeof evidenceIndex.EVIDENCE_INDEX_SCHEMA).toBe('string');
    expect(typeof evidenceIndex.EVIDENCE_INDEX_VERSION).toBe('number');
    expect(fs.existsSync(evidenceIndex.EVIDENCE_INDEX_SCHEMA_PATH)).toBe(true);

    const schemaDocument = JSON.parse(
      fs.readFileSync(evidenceIndex.EVIDENCE_INDEX_SCHEMA_PATH, 'utf8')
    ) as {
      properties?: {
        schema?: { const?: string };
        version?: { const?: number };
      };
    };
    expect(schemaDocument.properties?.schema?.const).toBe(evidenceIndex.EVIDENCE_INDEX_SCHEMA);
    expect(schemaDocument.properties?.version?.const).toBe(evidenceIndex.EVIDENCE_INDEX_VERSION);

    const report = evidenceIndex.verifyAgentWorkspaceTauriEvidenceIndex({
      strict: false,
    });

    expect(report.schema).toBe(evidenceIndex.EVIDENCE_INDEX_SCHEMA);
    expect(report.version).toBe(evidenceIndex.EVIDENCE_INDEX_VERSION);
    expect(report.evidenceSetId.length).toBeGreaterThan(0);
    expect(fs.existsSync(report.artifacts.indexPath)).toBe(true);
    expect(fs.existsSync(report.artifacts.latestIndexPath)).toBe(true);
    expect(report.reports.rust.found).toBe(true);
    expect(report.reports.windowEvidence.found).toBe(true);
    expect(report.reports.proxySmoke.found).toBe(true);
  });

  test('tauri evidence summary renderer emits stable markdown sections from latest evidence index', () => {
    const evidenceIndex = require(tauriEvidenceIndexScriptPath) as TauriEvidenceIndexModule;
    const summaryRenderer = require(tauriEvidenceSummaryScriptPath) as TauriEvidenceSummaryModule;
    expect(typeof summaryRenderer.renderAgentWorkspaceTauriEvidenceSummary).toBe('function');

    const indexReport = evidenceIndex.verifyAgentWorkspaceTauriEvidenceIndex({
      strict: false,
    });
    const summaryOutputPath = path.join(
      indexReport.artifacts.artifactDir,
      'evidence-summary-contract-test.md'
    );
    const summaryResult = summaryRenderer.renderAgentWorkspaceTauriEvidenceSummary({
      indexPath: indexReport.artifacts.latestIndexPath,
      outputPath: summaryOutputPath,
      appendStepSummary: false,
    });

    expect(fs.existsSync(summaryResult.outputPath)).toBe(true);
    expect(summaryResult.markdown).toContain('# Agent Workspace Tauri Evidence Summary');
    expect(summaryResult.markdown).toContain('## Evidence Reports');
    expect(summaryResult.markdown).toContain('## Strict Validation');
    expect(summaryResult.markdown).toContain('Schema: noteconnection.agent-workspace.tauri-evidence-index@1');
    expect(summaryResult.markdown).toContain(`Evidence Set ID: ${indexReport.evidenceSetId}`);
  });

  test('tauri evidence release fragment renderer emits release-note ready markdown', () => {
    const evidenceIndex = require(tauriEvidenceIndexScriptPath) as TauriEvidenceIndexModule;
    const fragmentRenderer = require(
      tauriEvidenceReleaseFragmentScriptPath
    ) as TauriEvidenceReleaseFragmentModule;
    expect(typeof fragmentRenderer.renderAgentWorkspaceTauriEvidenceReleaseFragment).toBe(
      'function'
    );

    const indexReport = evidenceIndex.verifyAgentWorkspaceTauriEvidenceIndex({
      strict: false,
    });
    const fragmentOutputPath = path.join(
      indexReport.artifacts.artifactDir,
      'release-fragment-contract-test.md'
    );
    const fragmentResult = fragmentRenderer.renderAgentWorkspaceTauriEvidenceReleaseFragment({
      indexPath: indexReport.artifacts.latestIndexPath,
      outputPath: fragmentOutputPath,
      appendStepSummary: false,
    });

    expect(fs.existsSync(fragmentResult.outputPath)).toBe(true);
    expect(fragmentResult.markdown).toContain('## Agent Workspace Tauri Evidence Gate');
    expect(fragmentResult.markdown).toContain('Overall Status:');
    expect(fragmentResult.markdown).toContain('Strict Validation Reasons:');
    expect(fragmentResult.markdown).toContain('Index Artifact:');
    expect(fragmentResult.markdown).toContain(
      `Evidence Set ID: ${indexReport.evidenceSetId}`
    );
  });

  test('tauri evidence manifest renderer emits digestable artifact manifest snapshot', () => {
    const evidenceIndex = require(tauriEvidenceIndexScriptPath) as TauriEvidenceIndexModule;
    const summaryRenderer = require(tauriEvidenceSummaryScriptPath) as TauriEvidenceSummaryModule;
    const fragmentRenderer = require(
      tauriEvidenceReleaseFragmentScriptPath
    ) as TauriEvidenceReleaseFragmentModule;
    const manifestRenderer = require(
      tauriEvidenceManifestScriptPath
    ) as TauriEvidenceManifestModule;
    expect(typeof manifestRenderer.renderAgentWorkspaceTauriEvidenceManifest).toBe('function');
    expect(typeof manifestRenderer.MANIFEST_SCHEMA_PATH).toBe('string');
    expect(fs.existsSync(manifestRenderer.MANIFEST_SCHEMA_PATH)).toBe(true);
    expect(typeof manifestRenderer.validateManifestReport).toBe('function');

    const indexReport = evidenceIndex.verifyAgentWorkspaceTauriEvidenceIndex({
      strict: false,
    });
    summaryRenderer.renderAgentWorkspaceTauriEvidenceSummary({
      indexPath: indexReport.artifacts.latestIndexPath,
    });
    fragmentRenderer.renderAgentWorkspaceTauriEvidenceReleaseFragment({
      indexPath: indexReport.artifacts.latestIndexPath,
    });

    const manifestResult = manifestRenderer.renderAgentWorkspaceTauriEvidenceManifest({
      indexPath: indexReport.artifacts.latestIndexPath,
      outputDir: indexReport.artifacts.artifactDir,
      strict: false,
    });

    const manifestSchemaDocument = JSON.parse(
      fs.readFileSync(manifestRenderer.MANIFEST_SCHEMA_PATH, 'utf8')
    ) as {
      properties?: {
        schema?: { const?: string };
        version?: { const?: number };
      };
    };
    expect(manifestSchemaDocument.properties?.schema?.const).toBe(manifestRenderer.MANIFEST_SCHEMA);
    expect(manifestSchemaDocument.properties?.version?.const).toBe(manifestRenderer.MANIFEST_VERSION);

    expect(manifestResult.manifest.schema).toBe(manifestRenderer.MANIFEST_SCHEMA);
    expect(manifestResult.manifest.version).toBe(manifestRenderer.MANIFEST_VERSION);
    expect(fs.existsSync(manifestResult.manifestPath)).toBe(true);
    expect(fs.existsSync(manifestResult.latestManifestPath)).toBe(true);
    expect(manifestResult.manifest.summary.totalArtifactCount).toBeGreaterThanOrEqual(6);
    expect(typeof manifestResult.manifest.strictValidation.passed).toBe('boolean');
    expect(Array.isArray(manifestResult.manifest.strictValidation.reasons)).toBe(true);
    expect(manifestResult.manifest.strictValidation.reasons).toContain('source-index-not-strict');

    const indexArtifact = manifestResult.manifest.artifacts.find(
      (artifact) => artifact.id === 'evidence-index'
    );
    expect(indexArtifact?.exists).toBe(true);
    expect(indexArtifact?.sha256).toMatch(/^[a-f0-9]{64}$/);

    expect(() =>
      manifestRenderer.renderAgentWorkspaceTauriEvidenceManifest({
        indexPath: indexReport.artifacts.latestIndexPath,
        outputDir: indexReport.artifacts.artifactDir,
        strict: true,
      })
    ).toThrow('Strict manifest validation failed');
  });

  test('tauri evidence release notes publisher supports idempotent marker-based section upsert', () => {
    const releaseNotes = require(
      tauriEvidenceReleaseNotesScriptPath
    ) as TauriEvidenceReleaseNotesModule;
    expect(typeof releaseNotes.upsertReleaseEvidenceSection).toBe('function');
    expect(typeof releaseNotes.EVIDENCE_SECTION_START).toBe('string');
    expect(typeof releaseNotes.EVIDENCE_SECTION_END).toBe('string');

    const existingBody = `Release baseline\n\n${releaseNotes.EVIDENCE_SECTION_START}\nold fragment\n${releaseNotes.EVIDENCE_SECTION_END}\n`;
    const fragmentMarkdown = '## Agent Workspace Tauri Evidence Gate\n\n- Overall Status: passed';
    const mergedBody = releaseNotes.upsertReleaseEvidenceSection(existingBody, fragmentMarkdown);

    expect(mergedBody).toContain('Release baseline');
    expect(mergedBody).toContain('## Agent Workspace Tauri Evidence Gate');
    expect(mergedBody).toContain('- Overall Status: passed');
    expect(mergedBody.match(new RegExp(releaseNotes.EVIDENCE_SECTION_START, 'g'))?.length).toBe(1);
    expect(mergedBody.match(new RegExp(releaseNotes.EVIDENCE_SECTION_END, 'g'))?.length).toBe(1);
    expect(mergedBody).not.toContain('old fragment');
  });

  test('tauri window evidence verification script exports callable verifier with degraded-friendly report', async () => {
    const windowEvidence = require(tauriWindowEvidenceScriptPath) as TauriWindowEvidenceModule;
    expect(typeof windowEvidence.verifyAgentWorkspaceTauriWindowEvidence).toBe('function');

    const report = await windowEvidence.verifyAgentWorkspaceTauriWindowEvidence({
      strictWindowEvidence: false,
      skipProxySmoke: true,
      windowEvidenceTimeoutMs: 120000,
    });

    expect(['passed', 'degraded']).toContain(report.summary.status);
    expect(fs.existsSync(report.artifacts.artifactDir)).toBe(true);
    expect(fs.existsSync(report.artifacts.reportPath)).toBe(true);
    expect(report.artifacts.latestReportPath).toBeTruthy();
    expect(fs.existsSync(String(report.artifacts.latestReportPath))).toBe(true);
    expect(typeof report.prerequisites.canAttempt).toBe('boolean');
    if (report.summary.status === 'passed') {
      expect(report.windowEvidence.attempted).toBe(true);
      expect(report.windowEvidence.tests.length).toBeGreaterThan(0);
    } else {
      expect(report.windowEvidence.attempted).toBe(false);
      expect(Array.isArray(report.prerequisites.reasons)).toBe(true);
      expect(report.prerequisites.reasons.length).toBeGreaterThan(0);
    }
  });
});
