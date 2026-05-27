const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { verifyAgentWorkspaceTauri } = require('./verify-agent-workspace-tauri');
const {
    detectMissingSystemDependencies,
} = require('./verify-agent-workspace-tauri-rust');

const REPO_ROOT = path.join(__dirname, '..');
const DEFAULT_TIMEOUT_MS = 240000;
const RUST_WINDOW_EVIDENCE_TEST_PATTERNS = [
    'pathmode_window_real_app_window_requires_main_window',
    'pathmode_window_real_app_window_lifecycle_emits_toggle_events',
];

function toFilenameTimestamp(isoText) {
    return String(isoText || '').replace(/[:.]/g, '-');
}

function ensureArtifactDir() {
    const artifactDir = path.join(REPO_ROOT, 'output', 'tauri', 'agent-workspace-window-evidence');
    fs.mkdirSync(artifactDir, { recursive: true });
    return artifactDir;
}

function runCommand(command, args, options = {}) {
    const timeoutMs = Number.isFinite(Number(options.timeoutMs))
        ? Math.max(1000, Math.floor(Number(options.timeoutMs)))
        : DEFAULT_TIMEOUT_MS;
    const result = spawnSync(command, args, {
        cwd: options.cwd || REPO_ROOT,
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
        timeout: timeoutMs,
        env: {
            ...process.env,
            ...(options.env || {}),
        },
    });
    const errorMessage = result.error
        ? String(result.error && result.error.stack || result.error)
        : '';
    return {
        command: [command].concat(args).join(' '),
        exitCode: typeof result.status === 'number' ? result.status : 1,
        stdout: String(result.stdout || ''),
        stderr: String(result.stderr || ''),
        timedOut: errorMessage.toLowerCase().includes('etimedout'),
        errorMessage,
        timeoutMs,
    };
}

function toSafeToken(text) {
    return String(text || '')
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

function buildWindowEvidencePrerequisites() {
    const dependencyCheck = detectMissingSystemDependencies();
    const cargoProbe = runCommand('cargo', ['--version'], { timeoutMs: 10000 });

    const reasons = [];
    if (cargoProbe.exitCode !== 0) {
        reasons.push('cargo-unavailable');
    }
    if (process.platform === 'linux' && dependencyCheck.missingDependencies.length > 0) {
        reasons.push(
            `missing-system-dependencies:${dependencyCheck.missingDependencies.join(',')}`
        );
    }

    return {
        cargoProbe: {
            command: cargoProbe.command,
            exitCode: cargoProbe.exitCode,
            timedOut: cargoProbe.timedOut,
            errorMessage: cargoProbe.errorMessage,
        },
        dependencyCheck: {
            pkgConfigAvailable: dependencyCheck.pkgConfigAvailable,
            missingDependencies: dependencyCheck.missingDependencies,
        },
        canAttempt: reasons.length === 0,
        reasons,
    };
}

function runRustWindowEvidenceTests(options = {}) {
    const timeoutMs = Number.isFinite(Number(options.timeoutMs))
        ? Math.max(1000, Math.floor(Number(options.timeoutMs)))
        : DEFAULT_TIMEOUT_MS;

    return RUST_WINDOW_EVIDENCE_TEST_PATTERNS.map((pattern) => {
        const result = runCommand(
            'cargo',
            [
                'test',
                '--manifest-path',
                'src-tauri/Cargo.toml',
                pattern,
                '--',
                '--nocapture',
            ],
            {
                timeoutMs,
            }
        );
        return {
            pattern,
            ...result,
        };
    });
}

function writeExecutionLog(logPath, execution) {
    const content = [
        `command=${execution.command}`,
        `timeoutMs=${execution.timeoutMs}`,
        `exitCode=${execution.exitCode}`,
        `timedOut=${execution.timedOut}`,
        '',
        '## stdout',
        execution.stdout || '(empty)',
        '',
        '## stderr',
        execution.stderr || '(empty)',
        '',
        '## error',
        execution.errorMessage || '(none)',
        '',
    ].join('\n');
    fs.writeFileSync(logPath, content, 'utf8');
}

async function verifyAgentWorkspaceTauriWindowEvidence(options = {}) {
    const generatedAt = new Date().toISOString();
    const fileTimestamp = toFilenameTimestamp(generatedAt);
    const artifactDir = ensureArtifactDir();
    const reportPath = path.join(artifactDir, `report-${fileTimestamp}.json`);
    const latestReportPath = path.join(artifactDir, 'report-latest.json');

    const strictWindowEvidence = options.strictWindowEvidence === true;
    let proxySmoke = null;

    if (options.skipProxySmoke !== true) {
        proxySmoke = await verifyAgentWorkspaceTauri({
            runtimeTimeoutMs: options.runtimeTimeoutMs,
            lifecycleTimeoutMs: options.lifecycleTimeoutMs,
        });
    }

    const prerequisites = buildWindowEvidencePrerequisites();

    if (!prerequisites.canAttempt) {
        const report = {
            generatedAt,
            artifacts: {
                artifactDir,
                reportPath,
                latestReportPath,
            },
            strictWindowEvidence,
            proxySmoke: proxySmoke
                ? {
                    lifecycleChecks: proxySmoke.lifecycleChecks,
                    sourceLifecycleChecks: proxySmoke.sourceLifecycleChecks,
                    reportPath: proxySmoke.artifacts && proxySmoke.artifacts.reportPath,
                }
                : null,
            prerequisites,
            windowEvidence: {
                attempted: false,
                tests: [],
            },
            summary: {
                status: 'degraded',
                passed: false,
                reasons: prerequisites.reasons,
            },
        };
        fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
        fs.writeFileSync(latestReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

        if (strictWindowEvidence) {
            throw new Error(
                '[agent-workspace-tauri-window-evidence] Strict mode requires full window evidence, ' +
                `but prerequisites are missing: ${prerequisites.reasons.join(', ')}.`
            );
        }

        return report;
    }

    const tests = runRustWindowEvidenceTests({
        timeoutMs: options.windowEvidenceTimeoutMs,
    }).map((result) => {
        const logPath = path.join(
            artifactDir,
            `rust-window-evidence-${toSafeToken(result.pattern)}-${fileTimestamp}.log`
        );
        writeExecutionLog(logPath, result);
        return {
            pattern: result.pattern,
            command: result.command,
            exitCode: result.exitCode,
            timedOut: result.timedOut,
            errorMessage: result.errorMessage,
            logPath,
        };
    });

    const failedTests = tests.filter((test) => test.exitCode !== 0);
    const report = {
        generatedAt,
        artifacts: {
            artifactDir,
            reportPath,
            latestReportPath,
        },
        strictWindowEvidence,
        proxySmoke: proxySmoke
            ? {
                lifecycleChecks: proxySmoke.lifecycleChecks,
                sourceLifecycleChecks: proxySmoke.sourceLifecycleChecks,
                reportPath: proxySmoke.artifacts && proxySmoke.artifacts.reportPath,
            }
            : null,
        prerequisites,
        windowEvidence: {
            attempted: true,
            tests,
        },
        summary: {
            status: failedTests.length === 0 ? 'passed' : 'failed',
            passed: failedTests.length === 0,
            failedTests: failedTests.map((test) => test.pattern),
        },
    };

    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(latestReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    if (failedTests.length > 0) {
        throw new Error(
            '[agent-workspace-tauri-window-evidence] Rust window evidence tests failed: ' +
            failedTests.map((test) => test.pattern).join(', ') +
            `. See ${reportPath}`
        );
    }

    return report;
}

async function main() {
    const strictArg = process.argv.includes('--strict');
    const skipProxySmoke = process.argv.includes('--skip-proxy-smoke');
    const strictFromEnv = process.env.NOTE_CONNECTION_TAURI_WINDOW_EVIDENCE_STRICT === '1';

    try {
        const report = await verifyAgentWorkspaceTauriWindowEvidence({
            strictWindowEvidence: strictArg || strictFromEnv,
            skipProxySmoke,
        });

        if (report.summary && report.summary.status === 'degraded') {
            console.warn('[agent-workspace-tauri-window-evidence] DEGRADED', JSON.stringify(report, null, 2));
            return;
        }

        console.log('[agent-workspace-tauri-window-evidence] PASS', JSON.stringify(report, null, 2));
    } catch (error) {
        console.error('[agent-workspace-tauri-window-evidence] FAIL', error);
        process.exit(1);
    }
}

if (require.main === module) {
    void main();
}

module.exports = {
    verifyAgentWorkspaceTauriWindowEvidence,
    buildWindowEvidencePrerequisites,
    runRustWindowEvidenceTests,
};
