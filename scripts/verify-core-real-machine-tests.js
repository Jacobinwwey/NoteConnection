#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const OUTPUT_ROOT = path.join(REPO_ROOT, 'output', 'verification', 'core-real-machine');
const SIDE_CAR_DIRSPEC = 'src-tauri/bin';

function toFilenameTimestamp(isoText) {
    return String(isoText || '').replace(/[:.]/g, '-');
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
    return dirPath;
}

function isWindowsCmd(command) {
    return process.platform === 'win32' && /\.cmd$/i.test(String(command || ''));
}

function resolveNpmCommand() {
    return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function parseCliOptions(argv) {
    const args = new Set(argv);
    return {
        includeBrowser: !args.has('--no-browser'),
        includeTauri: !args.has('--no-tauri'),
        includeManual: !args.has('--no-manual') && !args.has('--automated-only'),
        restoreSidecarBinaries: args.has('--restore-sidecar-binaries'),
        continueOnError: !args.has('--fail-fast'),
    };
}

function runCommand(command, args, options = {}) {
    const startedAt = new Date().toISOString();
    const timeoutMs = Number.isFinite(Number(options.timeoutMs))
        ? Math.max(1000, Math.floor(Number(options.timeoutMs)))
        : 0;
    const result = spawnSync(command, args, {
        cwd: options.cwd || REPO_ROOT,
        env: {
            ...process.env,
            ...(options.env || {}),
        },
        shell: isWindowsCmd(command),
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        timeout: timeoutMs || undefined,
    });
    const finishedAt = new Date().toISOString();
    const stdout = String(result.stdout || '');
    const stderr = String(result.stderr || '');
    const errorText = result.error
        ? String(result.error && result.error.stack ? result.error.stack : result.error)
        : '';
    const timedOut = errorText.toLowerCase().includes('etimedout')
        || errorText.toLowerCase().includes('timed out');
    const exitCode = typeof result.status === 'number' ? result.status : 1;

    return {
        displayCommand: [command].concat(args).join(' '),
        startedAt,
        finishedAt,
        durationMs: Date.parse(finishedAt) - Date.parse(startedAt),
        timeoutMs,
        exitCode,
        timedOut,
        stdout,
        stderr,
        errorText,
        passed: exitCode === 0,
    };
}

function safeJsonParse(text) {
    try {
        return JSON.parse(text);
    } catch (_error) {
        return null;
    }
}

function extractJsonRange(text) {
    const raw = String(text || '');
    const first = raw.indexOf('{');
    const last = raw.lastIndexOf('}');
    if (first < 0 || last < first) {
        return null;
    }
    return safeJsonParse(raw.slice(first, last + 1));
}

function extractJsonAfterMarker(text, marker) {
    const raw = String(text || '');
    const index = raw.indexOf(marker);
    if (index < 0) {
        return null;
    }
    return extractJsonRange(raw.slice(index + marker.length));
}

function extractJsonBeforeMarker(text, marker) {
    const raw = String(text || '');
    const index = raw.lastIndexOf(marker);
    if (index < 0) {
        return extractJsonRange(raw);
    }
    return extractJsonRange(raw.slice(0, index));
}

function parseStructuredReport(stepId, stdoutText) {
    if (stepId === 'foundation-sqlite-matrix') {
        return extractJsonBeforeMarker(stdoutText, '[foundation-sqlite-runtime] PASS');
    }
    if (stepId === 'foundation-ann-matrix') {
        return extractJsonBeforeMarker(stdoutText, '[foundation-ann-runtime] PASS');
    }
    if (stepId === 'agent-workspace-browser') {
        return extractJsonAfterMarker(stdoutText, '[agent-workspace-browser] PASS');
    }
    if (stepId === 'agent-workspace-tauri') {
        return extractJsonAfterMarker(stdoutText, '[agent-workspace-tauri] PASS');
    }
    return null;
}

function sanitizeSlug(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'step';
}

function writeLogFile(stepDir, baseName, suffix, content) {
    const filePath = path.join(stepDir, `${baseName}.${suffix}`);
    fs.writeFileSync(filePath, String(content || ''), 'utf8');
    return filePath;
}

function captureGitStatus() {
    const branch = runCommand('git', ['status', '--short', '--branch'], { timeoutMs: 20000 });
    const sidecarDirty = runCommand('git', ['diff', '--name-only', '--', SIDE_CAR_DIRSPEC], { timeoutMs: 20000 });
    const trackedDirty = runCommand('git', ['diff', '--name-only'], { timeoutMs: 20000 });
    return {
        branchStatus: String(branch.stdout || '').trim(),
        trackedDirtyPaths: String(trackedDirty.stdout || '')
            .split(/\r?\n/)
            .map((entry) => entry.trim())
            .filter(Boolean),
        sidecarDirtyPaths: String(sidecarDirty.stdout || '')
            .split(/\r?\n/)
            .map((entry) => entry.trim())
            .filter(Boolean),
    };
}

function restoreSidecarBinaries(pathsToRestore) {
    if (!Array.isArray(pathsToRestore) || pathsToRestore.length === 0) {
        return {
            attempted: false,
            restoredPaths: [],
            passed: true,
            command: '',
            stdout: '',
            stderr: '',
        };
    }
    const result = runCommand(
        'git',
        ['restore', '--worktree', '--staged', '--source=HEAD', '--'].concat(pathsToRestore),
        { timeoutMs: 120000 }
    );
    return {
        attempted: true,
        restoredPaths: pathsToRestore.slice(),
        passed: result.passed,
        command: result.displayCommand,
        stdout: result.stdout,
        stderr: result.stderr,
        errorText: result.errorText,
    };
}

function buildAutomatedSteps(options) {
    const steps = [
        {
            id: 'build',
            label: 'Build Dist Assets',
            category: 'prerequisite',
            command: resolveNpmCommand(),
            args: ['run', 'build'],
            timeoutMs: 20 * 60 * 1000,
            parser: null,
        },
        {
            id: 'ensure-sidecar-ready',
            label: 'Ensure Host Sidecar Ready',
            category: 'prerequisite',
            command: process.execPath,
            args: [path.join(REPO_ROOT, 'scripts', 'ensure-sidecar-ready.js')],
            timeoutMs: 20 * 60 * 1000,
            parser: null,
        },
        {
            id: 'foundation-sqlite-matrix',
            label: 'Foundation SQLite Runtime Matrix',
            category: 'foundation',
            command: process.execPath,
            args: [path.join(REPO_ROOT, 'scripts', 'verify-foundation-sqlite-runtime.js'), '--matrix'],
            timeoutMs: 20 * 60 * 1000,
            parser: parseStructuredReport,
        },
        {
            id: 'foundation-ann-matrix',
            label: 'Foundation ANN Runtime Matrix',
            category: 'foundation',
            command: process.execPath,
            args: [path.join(REPO_ROOT, 'scripts', 'verify-foundation-ann-runtime.js'), '--matrix'],
            timeoutMs: 20 * 60 * 1000,
            parser: parseStructuredReport,
        },
    ];
    if (options.includeBrowser) {
        steps.push({
            id: 'agent-workspace-browser',
            label: 'Agent Workspace Browser Smoke',
            category: 'browser',
            command: process.execPath,
            args: [path.join(REPO_ROOT, 'scripts', 'verify-agent-workspace-browser.js')],
            timeoutMs: 15 * 60 * 1000,
            parser: parseStructuredReport,
        });
    }
    if (options.includeTauri) {
        steps.push({
            id: 'agent-workspace-tauri',
            label: 'Agent Workspace Tauri Smoke',
            category: 'desktop',
            command: process.execPath,
            args: [path.join(REPO_ROOT, 'scripts', 'verify-agent-workspace-tauri.js')],
            timeoutMs: 15 * 60 * 1000,
            parser: parseStructuredReport,
        });
    }
    return steps;
}

function buildManualSteps() {
    return [
        {
            id: 'tauri-dev-mini-gpu',
            label: 'Desktop Manual Interactive Smoke',
            category: 'manual',
            command: `${resolveNpmCommand()} run tauri:dev:mini:gpu`,
            purpose: 'Use this to manually drive the mini GPU-enabled desktop shell and capture interactive evidence.',
        },
        {
            id: 'tauri-android-dev',
            label: 'Android Manual Interactive Smoke',
            category: 'manual',
            command: `${resolveNpmCommand()} run tauri:android:dev`,
            purpose: 'Use this to deploy the current build to a connected Android device for real-device interaction checks.',
        },
    ];
}

function renderMarkdownReport(report) {
    const automatedLines = report.automatedSteps.map((step) => {
        const status = step.passed ? 'PASS' : 'FAIL';
        const durationSeconds = (step.durationMs / 1000).toFixed(1);
        return `| ${step.label} | ${status} | ${durationSeconds}s | \`${step.displayCommand}\` |`;
    });
    const manualLines = report.manualSteps.map((step) => {
        return `- \`${step.command}\`\n  - ${step.purpose}`;
    });
    const dirtyAfter = report.git.after.sidecarDirtyPaths.length > 0
        ? report.git.after.sidecarDirtyPaths.map((entry) => `\`${entry}\``).join(', ')
        : '(none)';
    const introducedDirtyAfter = report.git.introducedSidecarDirtyPaths.length > 0
        ? report.git.introducedSidecarDirtyPaths.map((entry) => `\`${entry}\``).join(', ')
        : '(none)';
    const restoreSummary = report.sidecarRestore.attempted
        ? `attempted=${report.sidecarRestore.attempted}, passed=${report.sidecarRestore.passed}`
        : 'not requested';

    return [
        '# Core Real-Machine Verification Report',
        '',
        `- generatedAt: ${report.generatedAt}`,
        `- repoRoot: \`${REPO_ROOT}\``,
        `- automatedSummary: ${report.summary.passedAutomatedSteps}/${report.summary.totalAutomatedSteps} passed`,
        `- manualCommandCount: ${report.summary.manualCommandCount}`,
        `- gitBranchStatusBefore: ${report.git.before.branchStatus || '(empty)'}`,
        `- gitBranchStatusAfter: ${report.git.after.branchStatus || '(empty)'}`,
        `- sidecarDirtyPathsAfter: ${dirtyAfter}`,
        `- introducedSidecarDirtyPaths: ${introducedDirtyAfter}`,
        `- sidecarRestore: ${restoreSummary}`,
        '',
        '## Automated Steps',
        '',
        '| Step | Status | Duration | Command |',
        '| --- | --- | ---: | --- |',
    ].concat(
        automatedLines,
        [
            '',
            '## Manual Interactive Commands',
            '',
        ],
        manualLines.length > 0 ? manualLines : ['- (disabled by CLI option)'],
        [
            '',
            '## Notes',
            '',
            '- `verify:agent-workspace:browser` uses an isolated Playwright-managed session and should not be run concurrently with other Playwright-driven browser tasks.',
            '- If runtime verification dirties tracked `src-tauri/bin/server-*` files, restore them unless the current task is explicitly about sidecar build, supply, signing, or validation.',
        ]
    ).join('\n');
}

function main() {
    const options = parseCliOptions(process.argv.slice(2));
    const generatedAt = new Date().toISOString();
    const reportTimestamp = toFilenameTimestamp(generatedAt);
    const reportDir = ensureDir(path.join(OUTPUT_ROOT, reportTimestamp));
    const automatedSteps = buildAutomatedSteps(options);
    const manualSteps = options.includeManual ? buildManualSteps() : [];
    const gitBefore = captureGitStatus();
    const stepResults = [];
    const failures = [];

    for (let index = 0; index < automatedSteps.length; index += 1) {
        const step = automatedSteps[index];
        const baseName = `${String(index + 1).padStart(2, '0')}-${sanitizeSlug(step.id)}`;
        const stepDir = ensureDir(path.join(reportDir, baseName));
        const execution = runCommand(step.command, step.args, {
            timeoutMs: step.timeoutMs,
        });
        const stdoutPath = writeLogFile(stepDir, baseName, 'stdout.log', execution.stdout);
        const stderrPath = writeLogFile(stepDir, baseName, 'stderr.log', execution.stderr);
        const parsedReport = typeof step.parser === 'function'
            ? step.parser(step.id, execution.stdout)
            : null;
        const result = {
            id: step.id,
            label: step.label,
            category: step.category,
            displayCommand: execution.displayCommand,
            startedAt: execution.startedAt,
            finishedAt: execution.finishedAt,
            durationMs: execution.durationMs,
            timeoutMs: execution.timeoutMs,
            exitCode: execution.exitCode,
            timedOut: execution.timedOut,
            passed: execution.passed,
            stdoutPath,
            stderrPath,
            parsedReport,
        };
        if (execution.errorText) {
            result.errorText = execution.errorText;
        }
        stepResults.push(result);
        if (!result.passed) {
            failures.push(result);
            if (!options.continueOnError) {
                break;
            }
        }
    }

    const gitAfterBeforeRestore = captureGitStatus();
    const introducedSidecarDirtyPaths = gitAfterBeforeRestore.sidecarDirtyPaths.filter((entry) => {
        return !gitBefore.sidecarDirtyPaths.includes(entry);
    });
    const sidecarRestore = options.restoreSidecarBinaries
        ? restoreSidecarBinaries(introducedSidecarDirtyPaths)
        : {
            attempted: false,
            restoredPaths: [],
            passed: true,
            command: '',
            stdout: '',
            stderr: '',
        };
    const gitAfter = captureGitStatus();

    const report = {
        generatedAt,
        reportDir,
        options,
        automatedSteps: stepResults,
        manualSteps,
        summary: {
            totalAutomatedSteps: stepResults.length,
            passedAutomatedSteps: stepResults.filter((step) => step.passed).length,
            failedAutomatedSteps: stepResults.filter((step) => !step.passed).length,
            manualCommandCount: manualSteps.length,
        },
        git: {
            before: gitBefore,
            afterBeforeRestore: gitAfterBeforeRestore,
            after: gitAfter,
            introducedSidecarDirtyPaths,
        },
        sidecarRestore,
    };

    const reportJsonPath = path.join(reportDir, 'report.json');
    const reportMarkdownPath = path.join(reportDir, 'report.md');
    fs.writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(reportMarkdownPath, `${renderMarkdownReport(report)}\n`, 'utf8');

    const summaryText = JSON.stringify({
        reportJsonPath,
        reportMarkdownPath,
        automatedPassed: report.summary.passedAutomatedSteps,
        automatedTotal: report.summary.totalAutomatedSteps,
        introducedSidecarDirtyPaths,
        sidecarRestoreAttempted: sidecarRestore.attempted,
        sidecarRestorePassed: sidecarRestore.passed,
    }, null, 2);

    if (failures.length > 0) {
        console.error('[core-real-machine] FAIL', summaryText);
        process.exit(1);
    }

    console.log('[core-real-machine] PASS', summaryText);
}

main();
