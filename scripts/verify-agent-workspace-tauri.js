const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { verifyAgentWorkspaceRuntime } = require('./verify-agent-workspace-runtime');

const REPO_ROOT = path.join(__dirname, '..');
const DEFAULT_TIMEOUT_MS = 20000;
const LIFECYCLE_SMOKE_TIMEOUT_MS = 120000;
const LIFECYCLE_TEST_NAME_PATTERNS = [
    'supports parallel graph-focus and learning-path panes with exclusive workspace promotion state',
    'mounts the existing path workspace into the learning-path pane and restores it on clear',
];

function toFilenameTimestamp(isoText) {
    return String(isoText || '').replace(/[:.]/g, '-');
}

function ensureArtifactDir() {
    const artifactDir = path.join(REPO_ROOT, 'output', 'tauri', 'agent-workspace-smoke');
    fs.mkdirSync(artifactDir, { recursive: true });
    return artifactDir;
}

function resolveJestCommand() {
    const localJestBin = path.join(REPO_ROOT, 'node_modules', 'jest', 'bin', 'jest.js');
    if (fs.existsSync(localJestBin)) {
        return {
            command: process.execPath,
            argsPrefix: [localJestBin],
        };
    }
    return {
        command: 'npx',
        argsPrefix: ['jest'],
    };
}

function escapeRegexLiteral(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildLifecycleTestNamePattern() {
    return LIFECYCLE_TEST_NAME_PATTERNS.map((pattern) => escapeRegexLiteral(pattern)).join('|');
}

function runLifecycleSmoke(options = {}) {
    const timeoutMs = Number.isFinite(Number(options.timeoutMs))
        ? Math.max(1000, Math.floor(Number(options.timeoutMs)))
        : LIFECYCLE_SMOKE_TIMEOUT_MS;
    const jestCommand = resolveJestCommand();
    const lifecycleTestNamePattern = buildLifecycleTestNamePattern();
    const args = jestCommand.argsPrefix.concat([
        'src/agent_workspace.frontend.test.ts',
        '--runInBand',
        '--testNamePattern',
        lifecycleTestNamePattern,
    ]);
    const execution = spawnSync(jestCommand.command, args, {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
        timeout: timeoutMs,
    });
    const errorMessage = execution.error
        ? String(execution.error && execution.error.stack || execution.error)
        : '';
    return {
        passed: execution.status === 0,
        command: [jestCommand.command].concat(args).join(' '),
        status: typeof execution.status === 'number' ? execution.status : 1,
        stdout: String(execution.stdout || ''),
        stderr: String(execution.stderr || ''),
        timedOut: errorMessage.toLowerCase().includes('etimedout'),
        errorMessage,
        timeoutMs,
        testNamePattern: lifecycleTestNamePattern,
        coveredTestNames: LIFECYCLE_TEST_NAME_PATTERNS.slice(),
    };
}

function readTauriConfig() {
    const configPath = path.join(REPO_ROOT, 'src-tauri', 'tauri.conf.json');
    const raw = fs.readFileSync(configPath, 'utf8');
    return {
        configPath,
        config: JSON.parse(raw),
    };
}

function evaluateTauriConfig(config) {
    const frontendDist = String(config && config.build && config.build.frontendDist || '').trim();
    const withGlobalTauri = Boolean(config && config.app && config.app.withGlobalTauri === true);
    const windows = Array.isArray(config && config.app && config.app.windows)
        ? config.app.windows
        : [];
    const firstWindow = windows[0] || {};
    const hasWindowConfig = windows.length > 0;
    const hasWindowTitle = String(firstWindow.title || '').trim().length > 0;
    return {
        frontendDist,
        withGlobalTauri,
        hasWindowConfig,
        hasWindowTitle,
        windowCount: windows.length,
        checks: {
            frontendDistMatchesDistFrontend: frontendDist === '../dist/src/frontend',
            withGlobalTauriEnabled: withGlobalTauri,
            hasAtLeastOneWindow: hasWindowConfig,
            firstWindowHasTitle: hasWindowTitle,
        },
    };
}

function evaluateWindowLifecycleSourceContracts() {
    const tauriLibSource = fs.readFileSync(
        path.join(REPO_ROOT, 'src-tauri', 'src', 'lib.rs'),
        'utf8'
    );
    const appSource = fs.readFileSync(
        path.join(REPO_ROOT, 'src', 'frontend', 'app.js'),
        'utf8'
    );
    const pathAppSource = fs.readFileSync(
        path.join(REPO_ROOT, 'src', 'frontend', 'path_app.js'),
        'utf8'
    );
    const hasLegacyPathmodeEventHooks = /pathmode-window-toggled/.test(appSource);
    const hasPathmodeToggleInvokeInApp = /invoke\('toggle_pathmode_window'/.test(appSource)
        || /invoke\("toggle_pathmode_window"/.test(appSource);
    return {
        rustBuildsTogglePlan: /fn\s+resolve_pathmode_window_toggle_plan\s*\(/.test(tauriLibSource),
        rustBuildsToggleEventPayload: /fn\s+build_pathmode_window_toggled_event_payload\s*\(/.test(tauriLibSource),
        rustEmitsPathmodeWindowToggledEvent: /app\.emit\("pathmode-window-toggled"/.test(tauriLibSource),
        frontendListensPathmodeWindowToggledEvent:
            /event\.listen\(['"]pathmode-window-toggled['"]/.test(appSource)
            || hasPathmodeToggleInvokeInApp,
        frontendStoresPathmodeLifecycleTrace:
            /__NC_TAURI_PATHMODE_LIFECYCLE__/.test(appSource)
            || !hasLegacyPathmodeEventHooks,
        frontendDispatchesPathmodeLifecycleDomEvent:
            /noteconnection:pathmode-window-toggled/.test(appSource)
            || !hasLegacyPathmodeEventHooks,
        frontendEnterInvokesShowToggle:
            /invoke\('toggle_pathmode_window',\s*\{\s*showGodot:\s*true\s*\}\)/.test(appSource),
        frontendExitInvokesHideToggle:
            /invoke\('toggle_pathmode_window',\s*\{\s*showGodot:\s*false\s*\}\)/.test(pathAppSource),
    };
}

async function verifyAgentWorkspaceTauri(options = {}) {
    const generatedAt = new Date().toISOString();
    const fileTimestamp = toFilenameTimestamp(generatedAt);
    const artifactDir = ensureArtifactDir();
    const lifecycleLogPath = path.join(artifactDir, `lifecycle-smoke-${fileTimestamp}.log`);
    const reportPath = path.join(artifactDir, `report-${fileTimestamp}.json`);

    const runtimeReport = await verifyAgentWorkspaceRuntime({
        timeoutMs: Number.isFinite(Number(options.runtimeTimeoutMs))
            ? Math.max(1000, Math.floor(Number(options.runtimeTimeoutMs)))
            : DEFAULT_TIMEOUT_MS,
        logger: {
            log: () => {},
            warn: () => {},
            error: () => {},
        },
    });

    const tauriConfigRaw = readTauriConfig();
    const tauriConfig = evaluateTauriConfig(tauriConfigRaw.config);
    const sourceLifecycleChecks = evaluateWindowLifecycleSourceContracts();
    const lifecycle = runLifecycleSmoke({
        timeoutMs: options.lifecycleTimeoutMs,
    });

    const lifecycleLogContent = [
        `# Agent Workspace Tauri Lifecycle Smoke`,
        `generatedAt=${generatedAt}`,
        `command=${lifecycle.command}`,
        `timeoutMs=${lifecycle.timeoutMs}`,
        `exitCode=${lifecycle.status}`,
        `timedOut=${lifecycle.timedOut}`,
        '',
        '## stdout',
        lifecycle.stdout || '(empty)',
        '',
        '## stderr',
        lifecycle.stderr || '(empty)',
        '',
        '## error',
        lifecycle.errorMessage || '(none)',
    ].join('\n');
    fs.writeFileSync(lifecycleLogPath, `${lifecycleLogContent}\n`, 'utf8');

    const report = {
        generatedAt,
        artifacts: {
            artifactDir,
            reportPath,
            lifecycleLogPath,
        },
        runtimeChecks: runtimeReport.rootHtmlChecks,
        localeChecks: runtimeReport.localeChecks,
        tauriConfig: {
            path: tauriConfigRaw.configPath,
            frontendDist: tauriConfig.frontendDist,
            withGlobalTauri: tauriConfig.withGlobalTauri,
            windowCount: tauriConfig.windowCount,
            checks: tauriConfig.checks,
        },
        sourceLifecycleChecks,
        lifecycleChecks: {
            passed: lifecycle.passed,
            exitCode: lifecycle.status,
            timedOut: lifecycle.timedOut,
            command: lifecycle.command,
            testNamePattern: lifecycle.testNamePattern,
            coveredTestNames: lifecycle.coveredTestNames,
        },
    };

    const failures = [];
    Object.entries(runtimeReport.rootHtmlChecks).forEach(([key, value]) => {
        if (value !== true) {
            failures.push(`runtimeChecks.${key}=false`);
        }
    });
    if (runtimeReport.localeChecks.hasAgentWorkspaceNamespace !== true) {
        failures.push('localeChecks.hasAgentWorkspaceNamespace=false');
    }
    if (runtimeReport.localeChecks.focusLabel !== '聚焦') {
        failures.push(`localeChecks.focusLabel='${runtimeReport.localeChecks.focusLabel}'`);
    }
    if (!runtimeReport.localeChecks.localNodeUnavailableTemplate.includes('{nodeId}')) {
        failures.push('localeChecks.localNodeUnavailableTemplate missing {nodeId}');
    }
    if (runtimeReport.localeChecks.queryBackendDiagnosticsRolloutModeLabel !== '发布策略模式') {
        failures.push(
            `localeChecks.queryBackendDiagnosticsRolloutModeLabel='${runtimeReport.localeChecks.queryBackendDiagnosticsRolloutModeLabel}'`
        );
    }
    if (runtimeReport.localeChecks.queryBackendDiagnosticsAccelerationProviderLabel !== '加速提供方配置') {
        failures.push(
            `localeChecks.queryBackendDiagnosticsAccelerationProviderLabel='${runtimeReport.localeChecks.queryBackendDiagnosticsAccelerationProviderLabel}'`
        );
    }
    if (runtimeReport.localeChecks.queryBackendDiagnosticsAccelerationFailureModeLabel !== '加速失败模式配置') {
        failures.push(
            `localeChecks.queryBackendDiagnosticsAccelerationFailureModeLabel='${runtimeReport.localeChecks.queryBackendDiagnosticsAccelerationFailureModeLabel}'`
        );
    }
    if (
        runtimeReport.localeChecks.queryBackendDiagnosticsAccelerationRepresentationStrictLabel
        !== '加速表示一致性严格模式配置'
    ) {
        failures.push(
            `localeChecks.queryBackendDiagnosticsAccelerationRepresentationStrictLabel='${runtimeReport.localeChecks.queryBackendDiagnosticsAccelerationRepresentationStrictLabel}'`
        );
    }
    if (runtimeReport.localeChecks.queryBackendDiagnosticsAnnPrefilterLabel !== 'ANN 预筛选发布状态') {
        failures.push(
            `localeChecks.queryBackendDiagnosticsAnnPrefilterLabel='${runtimeReport.localeChecks.queryBackendDiagnosticsAnnPrefilterLabel}'`
        );
    }
    Object.entries(tauriConfig.checks).forEach(([key, value]) => {
        if (value !== true) {
            failures.push(`tauriConfig.checks.${key}=false`);
        }
    });
    Object.entries(sourceLifecycleChecks).forEach(([key, value]) => {
        if (value !== true) {
            failures.push(`sourceLifecycleChecks.${key}=false`);
        }
    });
    if (lifecycle.passed !== true) {
        failures.push(`lifecycleChecks.exitCode=${lifecycle.status}`);
        if (lifecycle.timedOut) {
            failures.push('lifecycleChecks.timedOut=true');
        }
    }

    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    if (failures.length > 0) {
        throw new Error(
            `[agent-workspace-tauri] verification failed: ${failures.join(', ')}\n` +
            `lifecycleLogPath=${lifecycleLogPath}`
        );
    }

    return report;
}

async function main() {
    try {
        const report = await verifyAgentWorkspaceTauri();
        console.log('[agent-workspace-tauri] PASS', JSON.stringify(report, null, 2));
    } catch (error) {
        console.error('[agent-workspace-tauri] FAIL', error);
        process.exit(1);
    }
}

if (require.main === module) {
    void main();
}

module.exports = {
    verifyAgentWorkspaceTauri,
};
