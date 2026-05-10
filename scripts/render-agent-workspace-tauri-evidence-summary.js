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
const DEFAULT_SUMMARY_PATH = path.join(
    REPO_ROOT,
    'output',
    'tauri',
    'agent-workspace-evidence-index',
    'evidence-summary-latest.md'
);
const STEP_SUMMARY_ENV = 'GITHUB_STEP_SUMMARY';

function parseArgs(argv) {
    const options = {
        indexPath: DEFAULT_INDEX_PATH,
        outputPath: DEFAULT_SUMMARY_PATH,
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

function toMarkdownRow(columns) {
    return `| ${columns.map((value) => String(value || '').replace(/\|/g, '\\|')).join(' | ')} |`;
}

function renderAgentWorkspaceTauriEvidenceSummary(options = {}) {
    const indexPath = options.indexPath || DEFAULT_INDEX_PATH;
    const outputPath = options.outputPath || DEFAULT_SUMMARY_PATH;

    if (!fs.existsSync(indexPath)) {
        throw new Error(`[agent-workspace-tauri-evidence-summary] Missing evidence index: ${indexPath}`);
    }

    const indexReport = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    const reports = indexReport.reports || {};
    const summary = indexReport.summary || {};
    const ci = indexReport.ci || {};

    const rust = reports.rust || {};
    const windowEvidence = reports.windowEvidence || {};
    const proxySmoke = reports.proxySmoke || {};

    const lines = [
        '# Agent Workspace Tauri Evidence Summary',
        '',
        `- Generated At: ${indexReport.generatedAt || 'unknown'}`,
        `- Schema: ${indexReport.schema || 'unknown'}@${indexReport.version || 'unknown'}`,
        `- Evidence Set ID: ${indexReport.evidenceSetId || 'unknown'}`,
        `- Strict Mode: ${indexReport.strict === true ? 'true' : 'false'}`,
        `- Overall Status: ${summary.status || 'unknown'}`,
        `- Overall Passed: ${summary.passed === true ? 'true' : 'false'}`,
        '',
        '## CI Context',
        '',
        `- Workflow: ${ci.workflow || 'local'}`,
        `- Job: ${ci.job || 'local'}`,
        `- Run ID: ${ci.runId || 'local'}`,
        `- Run Attempt: ${ci.runAttempt || 'local'}`,
        `- SHA: ${ci.sha || 'local'}`,
        `- Ref: ${ci.ref || 'local'}`,
        '',
        '## Evidence Reports',
        '',
        toMarkdownRow(['report', 'found', 'passed', 'status', 'strict', 'path']),
        toMarkdownRow(['---', '---', '---', '---', '---', '---']),
        toMarkdownRow([
            'rust',
            rust.found === true,
            rust.passed === true,
            rust.skipped === true ? 'skipped' : (rust.passed === true ? 'passed' : 'failed'),
            rust.strictSystemDeps === true,
            rust.reportPath || '',
        ]),
        toMarkdownRow([
            'window-evidence',
            windowEvidence.found === true,
            windowEvidence.passed === true,
            windowEvidence.status || 'unknown',
            windowEvidence.strictWindowEvidence === true,
            windowEvidence.reportPath || '',
        ]),
        toMarkdownRow([
            'proxy-smoke',
            proxySmoke.found === true,
            proxySmoke.passed === true,
            proxySmoke.passed === true ? 'passed' : 'failed',
            'n/a',
            proxySmoke.reportPath || '',
        ]),
        '',
        '## Strict Validation',
        '',
        `- Missing: ${Array.isArray(summary.missing) && summary.missing.length > 0 ? summary.missing.join(', ') : 'none'}`,
        `- Reasons: ${Array.isArray(summary.reasons) && summary.reasons.length > 0 ? summary.reasons.join(', ') : 'none'}`,
        '',
        '## Index Artifact',
        '',
        `- Index Path: ${indexPath}`,
        `- Summary Path: ${outputPath}`,
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
        summaryStatus: summary.status || 'unknown',
    };
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    try {
        const result = renderAgentWorkspaceTauriEvidenceSummary(options);
        console.log('[agent-workspace-tauri-evidence-summary] PASS', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('[agent-workspace-tauri-evidence-summary] FAIL', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    renderAgentWorkspaceTauriEvidenceSummary,
};
