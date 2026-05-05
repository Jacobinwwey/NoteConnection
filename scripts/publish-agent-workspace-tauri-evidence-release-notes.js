const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const DEFAULT_FRAGMENT_PATH = path.join(
    REPO_ROOT,
    'output',
    'tauri',
    'agent-workspace-evidence-index',
    'release-fragment-latest.md'
);
const EVIDENCE_SECTION_START = '<!-- noteconnection:agent-workspace-tauri-evidence:start -->';
const EVIDENCE_SECTION_END = '<!-- noteconnection:agent-workspace-tauri-evidence:end -->';

function parseArgs(argv) {
    const options = {
        tag: '',
        fragmentPath: DEFAULT_FRAGMENT_PATH,
        repo: '',
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--tag' && argv[index + 1]) {
            options.tag = String(argv[index + 1]).trim();
            index += 1;
            continue;
        }
        if (arg === '--fragment' && argv[index + 1]) {
            options.fragmentPath = path.resolve(REPO_ROOT, argv[index + 1]);
            index += 1;
            continue;
        }
        if (arg === '--repo' && argv[index + 1]) {
            options.repo = String(argv[index + 1]).trim();
            index += 1;
            continue;
        }
    }

    return options;
}

function normalizeText(value) {
    return String(value || '').replace(/\r\n/g, '\n');
}

function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildEvidenceSection(fragmentMarkdown) {
    const normalizedFragment = normalizeText(fragmentMarkdown).trim();
    if (!normalizedFragment) {
        throw new Error(
            '[agent-workspace-tauri-release-notes] Release fragment is empty; cannot publish.'
        );
    }
    return `${EVIDENCE_SECTION_START}\n${normalizedFragment}\n${EVIDENCE_SECTION_END}`;
}

function stripExistingEvidenceSection(releaseBody) {
    const normalizedBody = normalizeText(releaseBody);
    const sectionPattern = new RegExp(
        `${escapeRegExp(EVIDENCE_SECTION_START)}[\\s\\S]*?${escapeRegExp(EVIDENCE_SECTION_END)}\\n?`,
        'g'
    );
    return normalizedBody.replace(sectionPattern, '').trim();
}

function upsertReleaseEvidenceSection(releaseBody, fragmentMarkdown) {
    const cleanedBody = stripExistingEvidenceSection(releaseBody);
    const section = buildEvidenceSection(fragmentMarkdown);
    if (!cleanedBody) {
        return `${section}\n`;
    }
    return `${cleanedBody}\n\n${section}\n`;
}

function runGhCommand(args, options = {}) {
    const fullArgs = [...args];
    if (options.repo) {
        fullArgs.push('--repo', options.repo);
    }
    return childProcess.execFileSync('gh', fullArgs, {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });
}

function publishAgentWorkspaceTauriEvidenceReleaseNotes(options = {}) {
    const tag = String(options.tag || '').trim();
    const fragmentPath = options.fragmentPath || DEFAULT_FRAGMENT_PATH;
    const repo = String(options.repo || '').trim();

    if (!tag) {
        throw new Error('[agent-workspace-tauri-release-notes] Missing required --tag argument.');
    }
    if (!fs.existsSync(fragmentPath)) {
        throw new Error(
            `[agent-workspace-tauri-release-notes] Missing release fragment file: ${fragmentPath}`
        );
    }

    const fragmentMarkdown = fs.readFileSync(fragmentPath, 'utf8');
    const existingBody = runGhCommand(
        ['release', 'view', tag, '--json', 'body', '--jq', '.body'],
        { repo }
    );
    const mergedBody = upsertReleaseEvidenceSection(existingBody, fragmentMarkdown);

    if (normalizeText(existingBody).trim() === normalizeText(mergedBody).trim()) {
        return {
            tag,
            repo: repo || null,
            fragmentPath,
            updated: false,
            reason: 'already-up-to-date',
        };
    }

    const tempDir = path.join(REPO_ROOT, 'output', 'tauri', 'agent-workspace-evidence-index');
    fs.mkdirSync(tempDir, { recursive: true });
    const tempNotesPath = path.join(tempDir, `release-notes-${Date.now()}.md`);
    fs.writeFileSync(tempNotesPath, mergedBody, 'utf8');

    try {
        runGhCommand(
            ['release', 'edit', tag, '--notes-file', tempNotesPath],
            { repo }
        );
    } finally {
        if (fs.existsSync(tempNotesPath)) {
            fs.unlinkSync(tempNotesPath);
        }
    }

    return {
        tag,
        repo: repo || null,
        fragmentPath,
        updated: true,
    };
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    try {
        const result = publishAgentWorkspaceTauriEvidenceReleaseNotes(options);
        console.log('[agent-workspace-tauri-release-notes] PASS', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('[agent-workspace-tauri-release-notes] FAIL', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    publishAgentWorkspaceTauriEvidenceReleaseNotes,
    upsertReleaseEvidenceSection,
    EVIDENCE_SECTION_START,
    EVIDENCE_SECTION_END,
};
