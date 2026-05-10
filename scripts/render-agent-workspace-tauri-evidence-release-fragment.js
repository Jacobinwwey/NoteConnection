const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const DEFAULT_INDEX_PATH = path.join(
    REPO_ROOT,
    'output',
    'tauri',
    'agent-workspace-evidence-index',
    'evidence-index-latest.json'
);
const DEFAULT_OUTPUT_PATH = path.join(
    REPO_ROOT,
    'output',
    'tauri',
    'agent-workspace-evidence-index',
    'release-fragment-latest.md'
);
const STEP_SUMMARY_ENV = 'GITHUB_STEP_SUMMARY';

function parseArgs(argv) {
    const options = {
        indexPath: DEFAULT_INDEX_PATH,
        outputPath: DEFAULT_OUTPUT_PATH,
        appendStepSummary: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--index' && argv[index + 1]) {
            options.indexPath = path.resolve(REPO_ROOT, argv[index + 1]);
            index += 1;
            continue;
        }
        if (arg === '--output' && argv[index + 1]) {
            options.outputPath = path.resolve(REPO_ROOT, argv[index + 1]);
            index += 1;
            continue;
        }
        if (arg === '--append-step-summary') {
            options.appendStepSummary = true;
            continue;
        }
    }

    return options;
}

function toBoolText(value) {
    return value === true ? 'true' : 'false';
}

function rustStatus(rust) {
    if (!rust || rust.found !== true) {
        return 'missing';
    }
    if (rust.skipped) {
        return 'skipped';
    }
    return rust.passed === true ? 'passed' : 'failed';
}

function renderAgentWorkspaceTauriEvidenceReleaseFragment(options = {}) {
    const indexPath = options.indexPath || DEFAULT_INDEX_PATH;
    const outputPath = options.outputPath || DEFAULT_OUTPUT_PATH;

    if (!fs.existsSync(indexPath)) {
        throw new Error(`[agent-workspace-tauri-evidence-release-fragment] Missing evidence index: ${indexPath}`);
    }

    const indexReport = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    const reports = indexReport.reports || {};
    const summary = indexReport.summary || {};
    const strictReasons = Array.isArray(summary.reasons) && summary.reasons.length > 0
        ? summary.reasons.join(', ')
        : 'none';

    const lines = [
        '## Agent Workspace Tauri Evidence Gate',
        '',
        `- Evidence Set ID: ${indexReport.evidenceSetId || 'unknown'}`,
        `- Generated At: ${indexReport.generatedAt || 'unknown'}`,
        `- Schema: ${indexReport.schema || 'unknown'}@${indexReport.version || 'unknown'}`,
        `- Strict Mode: ${toBoolText(indexReport.strict === true)}`,
        `- Overall Status: ${summary.status || 'unknown'}`,
        `- Overall Passed: ${toBoolText(summary.passed === true)}`,
        `- Rust Evidence: ${rustStatus(reports.rust)}`,
        `- Window Evidence: ${reports.windowEvidence ? reports.windowEvidence.status || 'unknown' : 'unknown'}`,
        `- Proxy Smoke: ${reports.proxySmoke && reports.proxySmoke.passed === true ? 'passed' : 'failed'}`,
        `- Strict Validation Reasons: ${strictReasons}`,
        `- Index Artifact: ${indexPath}`,
        '',
    ];

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');

    if (options.appendStepSummary === true && process.env[STEP_SUMMARY_ENV]) {
        fs.appendFileSync(process.env[STEP_SUMMARY_ENV], `${lines.join('\n')}\n`, 'utf8');
    }

    return {
        indexPath,
        outputPath,
        markdown: lines.join('\n'),
        status: summary.status || 'unknown',
    };
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    try {
        const result = renderAgentWorkspaceTauriEvidenceReleaseFragment(options);
        console.log('[agent-workspace-tauri-evidence-release-fragment] PASS', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('[agent-workspace-tauri-evidence-release-fragment] FAIL', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    renderAgentWorkspaceTauriEvidenceReleaseFragment,
};
