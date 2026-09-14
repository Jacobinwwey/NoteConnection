const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { stripVTControlCharacters } = require('node:util');

const REPO_ROOT = path.join(__dirname, '..');
const DEFAULT_TIMEOUT_MS = 180000;
const RUST_CONTRACT_TESTS = [
    {
        pattern: 'pathmode_window_toggle_plan',
        names: [
            'pathmode_window_toggle_plan_decouples_godot_signal_from_tauri_hide_restore_flags',
            'pathmode_window_toggle_plan_restores_tauri_focus_when_restore_policy_is_enabled',
        ],
    },
    {
        pattern: 'pathmode_window_toggled_event_payload',
        names: ['pathmode_window_toggled_event_payload_contains_config_and_execution_plan'],
    },
];
const REQUIRED_PKG_CONFIG_DEPS = [
    'webkit2gtk-4.1',
    'javascriptcoregtk-4.1',
    'libsoup-3.0',
];

function toFilenameTimestamp(isoText) {
    return String(isoText || '').replace(/[:.]/g, '-');
}

function ensureArtifactDir() {
    const artifactDir = path.join(REPO_ROOT, 'output', 'tauri', 'agent-workspace-rust-tests');
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

function detectMissingSystemDependencies() {
    if (process.platform !== 'linux') {
        return {
            missingDependencies: [],
            pkgConfigAvailable: false,
            probe: null,
            skippedForPlatform: process.platform,
        };
    }

    const probe = runCommand('pkg-config', ['--version'], { timeoutMs: 10000 });
    if (probe.exitCode !== 0) {
        return {
            missingDependencies: REQUIRED_PKG_CONFIG_DEPS.slice(),
            pkgConfigAvailable: false,
            probe,
        };
    }

    const missingDependencies = REQUIRED_PKG_CONFIG_DEPS.filter((dependency) => {
        const dependencyProbe = runCommand(
            'pkg-config',
            ['--exists', dependency],
            { timeoutMs: 10000 }
        );
        return dependencyProbe.exitCode !== 0;
    });

    return {
        missingDependencies,
        pkgConfigAvailable: true,
        probe,
    };
}

function evaluateRustTestExecution(execution, requiredTests) {
    // Cargo accepts an empty selection. A successful process is evidence only
    // when every required libtest verdict is present, including prefix groups.
    const output = stripVTControlCharacters(execution.stdout);
    const missingTests = requiredTests.filter((name) => {
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return !new RegExp(`^test (?:[^\\s]+::)?${escapedName} \\.\\.\\. ok\\s*$`, 'm').test(output);
    });
    return {
        ...execution,
        requiredTests,
        missingTests,
        passed: execution.exitCode === 0 && missingTests.length === 0,
        evidenceFailure: execution.exitCode !== 0
            ? 'cargo_failed'
            : missingTests.length > 0 ? 'required_test_did_not_pass' : null,
    };
}

function runRustContractTests(options = {}) {
    const timeoutMs = Number.isFinite(Number(options.timeoutMs))
        ? Math.max(1000, Math.floor(Number(options.timeoutMs)))
        : DEFAULT_TIMEOUT_MS;

    return RUST_CONTRACT_TESTS.map(({ pattern, names }) => {
        const result = runCommand(
            'cargo',
            [
                'test',
                '--manifest-path',
                'src-tauri/Cargo.toml',
                pattern,
                '--lib',
                '--locked',
                '--',
                '--show-output',
            ],
            {
                cwd: REPO_ROOT,
                timeoutMs,
            }
        );
        return evaluateRustTestExecution(result, names);
    });
}

function verifyAgentWorkspaceTauriRust(options = {}) {
    const generatedAt = new Date().toISOString();
    const fileTimestamp = toFilenameTimestamp(generatedAt);
    const artifactDir = ensureArtifactDir();
    const reportPath = path.join(artifactDir, `report-${fileTimestamp}.json`);
    const latestReportPath = path.join(artifactDir, 'report-latest.json');

    const strictSystemDeps = options.strictSystemDeps === true;
    const dependencyCheck = detectMissingSystemDependencies();
    const missingDependencies = dependencyCheck.missingDependencies;

    if (missingDependencies.length > 0) {
        const report = {
            generatedAt,
            artifacts: {
                artifactDir,
                reportPath,
                latestReportPath,
            },
            strictSystemDeps,
            skipped: !strictSystemDeps,
            dependencyCheck: {
                pkgConfigAvailable: dependencyCheck.pkgConfigAvailable,
                missingDependencies,
            },
            tests: [],
            summary: {
                passed: false,
                reason: `missing-system-dependencies:${missingDependencies.join(',')}`,
            },
        };
        fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
        fs.writeFileSync(latestReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

        if (strictSystemDeps) {
            throw new Error(
                '[agent-workspace-tauri-rust] Missing system dependencies for Tauri Rust tests: ' +
                `${missingDependencies.join(', ')}. ` +
                `Install platform packages that provide ${REQUIRED_PKG_CONFIG_DEPS.join(', ')}, then rerun.`
            );
        }

        return report;
    }

    const tests = runRustContractTests({
        timeoutMs: options.timeoutMs,
    });
    const failedTests = tests.filter((test) => !test.passed);

    const report = {
        generatedAt,
        artifacts: {
            artifactDir,
            reportPath,
            latestReportPath,
        },
        strictSystemDeps,
        skipped: false,
        dependencyCheck: {
            pkgConfigAvailable: dependencyCheck.pkgConfigAvailable,
            missingDependencies,
        },
        tests,
        summary: {
            passed: failedTests.length === 0,
            total: tests.length,
            failed: failedTests.length,
        },
    };

    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(latestReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    if (failedTests.length > 0) {
        throw new Error(
            `[agent-workspace-tauri-rust] Rust contract tests failed (${failedTests.length}/${tests.length}). ` +
            `See ${reportPath}`
        );
    }

    return report;
}

function main() {
    const strictArg = process.argv.includes('--strict');
    const strictFromCi = String(process.env.CI || '').toLowerCase() === 'true';
    const strictSystemDeps = strictArg || strictFromCi;

    try {
        const report = verifyAgentWorkspaceTauriRust({
            strictSystemDeps,
        });
        if (report.skipped) {
            console.warn('[agent-workspace-tauri-rust] SKIP', JSON.stringify(report, null, 2));
            return;
        }
        console.log('[agent-workspace-tauri-rust] PASS', JSON.stringify(report, null, 2));
    } catch (error) {
        console.error('[agent-workspace-tauri-rust] FAIL', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    verifyAgentWorkspaceTauriRust,
    detectMissingSystemDependencies,
    runRustContractTests,
    evaluateRustTestExecution,
};
