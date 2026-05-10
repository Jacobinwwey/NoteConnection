const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawnSync } = require('child_process');

const { copyProjectAssets } = require('./copy-assets');
const {
    LOOPBACK_HOST,
    waitForServer,
    spawnRuntimeServer,
    stopRuntimeServer,
    makeTempProject,
    getFreePort,
} = require('./verify-agent-workspace-runtime');

const REPO_ROOT = path.join(__dirname, '..');
const DEFAULT_TIMEOUT_MS = 45000;

function createLogger(logger) {
    return logger || console;
}

function resolvePwcliPath() {
    const codexHome = process.env.CODEX_HOME || path.join(process.env.HOME || '', '.codex');
    return path.join(codexHome, 'skills', 'playwright', 'scripts', 'playwright_cli.sh');
}

function ensurePrerequisites() {
    const pwcli = resolvePwcliPath();
    if (!fs.existsSync(pwcli)) {
        throw new Error(`Playwright CLI wrapper not found at ${pwcli}`);
    }
    return pwcli;
}

function ensureArtifactDir() {
    const artifactRoot = path.join(REPO_ROOT, 'output', 'playwright', 'agent-workspace-browser');
    fs.mkdirSync(artifactRoot, { recursive: true });
    return artifactRoot;
}

function runPwcli(pwcli, args, options = {}) {
    const result = spawnSync(pwcli, args, {
        cwd: options.cwd || REPO_ROOT,
        env: {
            ...process.env,
            ...(options.env || {}),
        },
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
        timeout: typeof options.timeoutMs === 'number' ? options.timeoutMs : 120000,
    });

    if (result.error) {
        throw new Error(
            `[agent-workspace-browser] PWCLI error: ${[pwcli].concat(args).join(' ')}\n` +
            `${String(result.error && result.error.stack || result.error)}\n` +
            `stdout:\n${result.stdout || ''}\n` +
            `stderr:\n${result.stderr || ''}`
        );
    }

    if (result.status !== 0) {
        throw new Error(
            `[agent-workspace-browser] PWCLI failed: ${[pwcli].concat(args).join(' ')}\n` +
            `stdout:\n${result.stdout || ''}\n` +
            `stderr:\n${result.stderr || ''}`
        );
    }

    return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
    };
}

function normalizeRawValue(raw) {
    const trimmed = String(raw || '').trim();
    if (!trimmed) {
        return '';
    }
    try {
        return JSON.parse(trimmed);
    } catch (_error) {
        return trimmed;
    }
}

function parseMarkdownArtifactPath(output, extension) {
    const pattern = new RegExp(`\\((\\.playwright-cli\\/[^)]+\\.${extension})\\)`);
    const match = String(output || '').match(pattern);
    return match ? match[1] : '';
}

function parseConsoleArtifactPath(output) {
    const match = String(output || '').match(/New console entries:\s+(\.playwright-cli\/[^#\s]+\.log)/);
    return match ? match[1] : '';
}

function findLatestArtifactPath(artifactDir, predicate) {
    const runtimeDir = path.join(artifactDir, '.playwright-cli');
    if (!fs.existsSync(runtimeDir)) {
        return '';
    }
    const candidates = fs.readdirSync(runtimeDir)
        .filter((entry) => predicate(entry))
        .map((entry) => ({
            entry,
            fullPath: path.join(runtimeDir, entry),
            mtimeMs: fs.statSync(path.join(runtimeDir, entry)).mtimeMs,
        }))
        .sort((left, right) => right.mtimeMs - left.mtimeMs);
    return candidates.length > 0 ? candidates[0].fullPath : '';
}

function postJson(url, payload, timeoutMs) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(payload);
        const request = http.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
        }, (response) => {
            let text = '';
            response.setEncoding('utf8');
            response.on('data', (chunk) => {
                text += chunk;
            });
            response.on('end', () => {
                if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
                    try {
                        resolve(JSON.parse(text));
                    } catch (error) {
                        reject(error);
                    }
                    return;
                }
                reject(new Error(`HTTP ${response.statusCode || 0} for ${url}: ${text}`));
            });
        });
        request.setTimeout(timeoutMs, () => {
            request.destroy(new Error(`Timed out after ${timeoutMs}ms for ${url}`));
        });
        request.once('error', reject);
        request.write(body);
        request.end();
    });
}

function writeSeedGraphAsset(frontendDir) {
    const seededGraphData = {
        nodes: [
            {
                id: 'atom_2',
                label: 'Focus Node',
                summary: 'summary',
                content: 'summary',
                inDegree: 0,
                outDegree: 0,
                degree: 0,
                cluster: 0,
            },
        ],
        edges: [],
    };
    const assetSource = [
        `const graphData = ${JSON.stringify(seededGraphData, null, 2)};`,
        'window.graphData = graphData;',
        '',
    ].join('\n');
    fs.writeFileSync(path.join(frontendDir, 'data.js'), assetSource, 'utf8');
}

async function verifyAgentWorkspaceBrowser(options = {}) {
    const logger = createLogger(options.logger);
    const pwcli = ensurePrerequisites();
    const artifactRoot = ensureArtifactDir();
    const fixture = makeTempProject('noteconnection-agent-browser');
    const port = typeof options.port === 'number' ? options.port : await getFreePort();
    const bridgePort = typeof options.bridgePort === 'number' ? options.bridgePort : await getFreePort();
    const timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
    const sessionId = `ncsmoke${Date.now()}`;
    const artifactDir = path.join(artifactRoot, sessionId);
    fs.mkdirSync(artifactDir, { recursive: true });
    const baseUrl = `http://${LOOPBACK_HOST}:${port}`;

    copyProjectAssets({
        src: path.join(REPO_ROOT, 'src', 'frontend'),
        dest: fixture.frontendDir,
        logger: {
            log: (..._args) => {},
            warn: (..._args) => {},
            error: (..._args) => {},
        },
    });
    writeSeedGraphAsset(fixture.frontendDir);

    const runtime = spawnRuntimeServer({
        port,
        bridgePort,
        projectRoot: fixture.projectRoot,
        frontendDir: fixture.frontendDir,
        runtimeDataDir: fixture.runtimeDataDir,
        kbRoot: fixture.kbRoot,
        logger,
    });

    const sessionArgs = ['--session', sessionId];

    try {
        await waitForServer(`${baseUrl}/`, timeoutMs);
        const ingestResponse = await postJson(`${baseUrl}/api/knowledge/ingest`, {
            documents: [
                {
                    sourcePath: 'smoke/focus-node.md',
                    content: '# Focus Node\n\nFocus node depends on prerequisite evidence.',
                    language: 'en',
                },
            ],
            incremental: true,
            relationRecomputeMode: 'incremental',
        }, timeoutMs);
        if (!ingestResponse || ingestResponse.success !== true) {
            throw new Error('[agent-workspace-browser] Failed to seed knowledge ingest before browser smoke.');
        }

        runPwcli(pwcli, ['install-browser', 'chromium'], { cwd: artifactDir, timeoutMs: 180000 });
        runPwcli(pwcli, sessionArgs.concat(['open', baseUrl]), { cwd: artifactDir, timeoutMs: 90000 });
        runPwcli(pwcli, sessionArgs.concat(['resize', '1440', '960']), { cwd: artifactDir });
        const shellReady = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `Boolean(document.querySelector('#agent-workspace-shell') && window.NoteConnectionAgentWorkspace && window.NoteConnectionWorkspacePanes)`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        if (shellReady !== true) {
            throw new Error('[agent-workspace-browser] Agent workspace shell did not initialize in the browser.');
        }

        normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(() => {
                        if (window.NoteConnectionRuntime && typeof window.NoteConnectionRuntime.setRuntimeConfig === 'function') {
                            window.NoteConnectionRuntime.setRuntimeConfig({
                                host: '${LOOPBACK_HOST}',
                                port: ${port},
                                bridgePort: ${bridgePort},
                                baseUrl: '${baseUrl}',
                                bridgeWsUrl: 'ws://${LOOPBACK_HOST}:${bridgePort}'
                            });
                        }
                        return true;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );

        normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(() => {
                        if (window.__NC_AGENT_FETCH_TRACE_PATCHED === true) {
                            return true;
                        }
                        const originalFetch = window.fetch.bind(window);
                        const traces = [];
                        window.__NC_AGENT_FETCH_TRACES = traces;
                        window.fetch = async function (...args) {
                            const startedAt = performance.now();
                            const request = args[0];
                            const requestInit = args[1] || {};
                            const method = String(
                                requestInit.method
                                || (request && typeof request === 'object' && request.method)
                                || 'GET'
                            ).toUpperCase();
                            const url = String(
                                typeof request === 'string'
                                    ? request
                                    : (request && request.url) || ''
                            );
                            try {
                                const response = await originalFetch(...args);
                                traces.push({
                                    url,
                                    method,
                                    status: Number(response && response.status || 0),
                                    ok: Boolean(response && response.ok),
                                    durationMs: Number((performance.now() - startedAt).toFixed(3)),
                                });
                                return response;
                            } catch (error) {
                                traces.push({
                                    url,
                                    method,
                                    status: 0,
                                    ok: false,
                                    durationMs: Number((performance.now() - startedAt).toFixed(3)),
                                    error: String(error && error.message || error || 'unknown_error'),
                                });
                                throw error;
                            }
                        };
                        window.__NC_AGENT_FETCH_TRACE_PATCHED = true;
                        return true;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );

        normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => { await window.i18n.setLanguage('zh'); return window.i18n.currentLanguage; })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );

        const titleText = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `document.querySelector('[data-i18n="agentWorkspace.title"]').textContent.trim()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );

        const interactionReady = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const assistantMessages = Array.from(document.querySelectorAll('.agent-chat-message-assistant'));
                            const latestAssistant = assistantMessages.length > 0
                                ? assistantMessages[assistantMessages.length - 1].textContent.trim()
                                : '';
                            if (latestAssistant.length > 0) {
                                return true;
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return false;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        if (interactionReady !== true) {
            throw new Error('[agent-workspace-browser] Agent workspace interaction hooks did not finish initialization.');
        }

        const graphReady = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const node = window.NoteConnectionGraphView
                                && typeof window.NoteConnectionGraphView.resolveNodeById === 'function'
                                ? window.NoteConnectionGraphView.resolveNodeById('atom_2')
                                : null;
                            if (node && node.id === 'atom_2') {
                                return true;
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return false;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        if (graphReady !== true) {
            throw new Error('[agent-workspace-browser] Real graph runtime did not expose the seeded node.');
        }

        normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(() => {
                        const smokeState = {
                            learningPathInitId: null,
                            learningPathConfig: null,
                            learningPathTriggered: false,
                        };
                        window.__ncBrowserSmoke = smokeState;
                        const originalInit = window.pathApp && typeof window.pathApp.init === 'function'
                            ? window.pathApp.init.bind(window.pathApp)
                            : null;
                        const originalApply = window.pathApp && typeof window.pathApp.applyRemoteConfigure === 'function'
                            ? window.pathApp.applyRemoteConfigure.bind(window.pathApp)
                            : null;
                        const originalTrigger = window.pathApp && typeof window.pathApp.triggerUpdate === 'function'
                            ? window.pathApp.triggerUpdate.bind(window.pathApp)
                            : null;
                        if (originalInit) {
                            window.pathApp.init = function(id) {
                                smokeState.learningPathInitId = id;
                                return originalInit(id);
                            };
                        }
                        if (originalApply) {
                            window.pathApp.applyRemoteConfigure = function(config) {
                                smokeState.learningPathConfig = config;
                                return originalApply(config);
                            };
                        }
                        if (originalTrigger) {
                            window.pathApp.triggerUpdate = function() {
                                smokeState.learningPathTriggered = true;
                                return originalTrigger();
                            };
                        }
                        return true;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );

        normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const input = document.querySelector('#agent-workspace-chat-input');
                        input.value = 'focus node';
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        await window.NoteConnectionAgentWorkspace.sendConversation();
                        return true;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );

        const chatState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const buttons = Array.from(document.querySelectorAll('.agent-knowledge-actions button'));
                            const userMessages = Array.from(document.querySelectorAll('.agent-chat-message-user'));
                            const assistantMessages = Array.from(document.querySelectorAll('.agent-chat-message-assistant'));
                            if (buttons.length >= 18 && userMessages.length >= 1 && assistantMessages.length >= 2) {
                                const labelsByAction = {};
                                buttons.forEach((node) => {
                                    const actionId = node.getAttribute('data-capability-action-id') || '';
                                    if (actionId) {
                                        labelsByAction[actionId] = node.textContent.trim();
                                    }
                                });
                                return {
                                    userMessageText: userMessages[userMessages.length - 1].textContent.trim(),
                                    assistantMessageText: assistantMessages[assistantMessages.length - 1].textContent.trim(),
                                    labelsByAction
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return null;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const userMessageText = chatState && typeof chatState === 'object' ? chatState.userMessageText : '';
        const assistantMessageText = chatState && typeof chatState === 'object' ? chatState.assistantMessageText : '';
        const labelsByAction = chatState && typeof chatState === 'object' && chatState.labelsByAction && typeof chatState.labelsByAction === 'object'
            ? chatState.labelsByAction
            : {};
        const focusButtonLabelZh = labelsByAction.open_focus_mode || '';
        const learningPathButtonLabelZh = labelsByAction.open_learning_path || '';
        const studySessionButtonLabelZh = labelsByAction.build_study_session || '';
        const quizButtonLabelZh = labelsByAction.generate_quiz || '';
        const transferButtonLabelZh = labelsByAction.generate_transfer || '';
        const counterexampleButtonLabelZh = labelsByAction.generate_counterexample || '';
        const followUpButtonLabelZh = labelsByAction.follow_up || '';
        const compareQueryBackendsButtonLabelZh = labelsByAction.compare_query_backends || '';
        const queryBackendComparisonHistoryButtonLabelZh =
            labelsByAction.inspect_query_backend_comparison_history || '';
        const queryBackendComparisonTrendButtonLabelZh =
            labelsByAction.inspect_query_backend_comparison_trend || '';
        const learningQualityTrendButtonLabelZh =
            labelsByAction.inspect_learning_quality_trend || '';
        const learningQualityHistoryButtonLabelZh =
            labelsByAction.inspect_learning_quality_history || '';
        const sessionPlanQualityTrendButtonLabelZh =
            labelsByAction.inspect_session_plan_quality_trend || '';
        const sessionPlanQualityHistoryButtonLabelZh =
            labelsByAction.inspect_session_plan_quality_history || '';
        const sessionHistoryButtonLabelZh = labelsByAction.inspect_session_history || '';
        const runtimeRunbookChecksButtonLabelZh =
            labelsByAction.inspect_runtime_capability_runbook_checks || '';
        const runtimeRunbookActionQueueButtonLabelZh =
            labelsByAction.inspect_runtime_capability_runbook_action_queue || '';
        const conversationTurnCacheAlertTrendButtonLabelZh =
            labelsByAction.inspect_conversation_turn_cache_alert_trend || '';

        const focusOpenedId = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const focusButton = document.querySelector('.agent-knowledge-actions button[data-capability-action-id="open_focus_mode"]');
                        focusButton.click();
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const focusNode = window.NoteConnectionGraphView
                                && typeof window.NoteConnectionGraphView.getFocusNode === 'function'
                                ? window.NoteConnectionGraphView.getFocusNode()
                                : null;
                            if (focusNode && focusNode.id) {
                                return focusNode.id;
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return '';
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const focusNodeNameText = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `document.querySelector('#focus-node-name') ? document.querySelector('#focus-node-name').textContent.trim() : ''`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );

        const learningPathState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const pathButton = document.querySelector('.agent-knowledge-actions button[data-capability-action-id="open_learning_path"]');
                        pathButton.click();
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const paneOpenState = document.querySelector('#agent-learning-path-pane')?.getAttribute('data-open');
                            const initId = window.__ncBrowserSmoke && window.__ncBrowserSmoke.learningPathInitId;
                            const currentTargetId = window.pathApp && window.pathApp.currentTargetId;
                            const pathDisplay = document.querySelector('#path-container')?.style.display || '';
                            if (paneOpenState === 'true' && initId && currentTargetId) {
                                return {
                                    paneOpenState,
                                    learningPathInitId: initId,
                                    learningPathCurrentTargetId: currentTargetId,
                                    learningPathDisplay: pathDisplay
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return null;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const learningPathPaneOpenState =
            learningPathState && typeof learningPathState === 'object' ? learningPathState.paneOpenState : '';
        const learningPathInitId =
            learningPathState && typeof learningPathState === 'object' ? learningPathState.learningPathInitId : '';
        const learningPathCurrentTargetId =
            learningPathState && typeof learningPathState === 'object' ? learningPathState.learningPathCurrentTargetId : '';
        const learningPathDisplay =
            learningPathState && typeof learningPathState === 'object' ? learningPathState.learningPathDisplay : '';

        const studySessionState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const sessionButton = document.querySelector('.agent-knowledge-actions button[data-capability-action-id="build_study_session"]');
                        sessionButton.click();
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const card = document.querySelector('[data-agent-workspace-card-kind="study-session"]');
                            const title = card && card.querySelector('.agent-chat-card-title')
                                ? card.querySelector('.agent-chat-card-title').textContent.trim()
                                : '';
                            const summary = card && card.querySelector('.agent-chat-card-summary')
                                ? card.querySelector('.agent-chat-card-summary').textContent.trim()
                                : '';
                            if (card && title && summary) {
                                return {
                                    title,
                                    summary
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return null;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const studySessionCardTitleZh =
            studySessionState && typeof studySessionState === 'object' ? studySessionState.title : '';
        const studySessionCardSummaryZh =
            studySessionState && typeof studySessionState === 'object' ? studySessionState.summary : '';

        const tutorActionState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const tutorButton = document.querySelector('.agent-knowledge-actions button[data-capability-action-id="generate_quiz"]');
                        tutorButton.click();
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const cards = Array.from(document.querySelectorAll('[data-agent-workspace-card-kind="tutor-action"]'));
                            const card = cards.length > 0 ? cards[cards.length - 1] : null;
                            const title = card && card.querySelector('.agent-chat-card-title')
                                ? card.querySelector('.agent-chat-card-title').textContent.trim()
                                : '';
                            const evidenceHeading = card && card.querySelector('.agent-chat-card-section-title')
                                ? card.querySelector('.agent-chat-card-section-title').textContent.trim()
                                : '';
                            if (card && title && evidenceHeading) {
                                return {
                                    title,
                                    evidenceHeading
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return null;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const tutorCardTitleZh =
            tutorActionState && typeof tutorActionState === 'object' ? tutorActionState.title : '';
        const tutorCardEvidenceHeadingZh =
            tutorActionState && typeof tutorActionState === 'object' ? tutorActionState.evidenceHeading : '';

        const queryBackendComparisonState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const compareButton = document.querySelector('.agent-knowledge-actions button[data-capability-action-id="compare_query_backends"]');
                        compareButton.click();
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const cards = Array.from(document.querySelectorAll('[data-agent-workspace-card-kind="query-backend-comparison"]'));
                            const card = cards.length > 0 ? cards[cards.length - 1] : null;
                            const title = card && card.querySelector('.agent-chat-card-title')
                                ? card.querySelector('.agent-chat-card-title').textContent.trim()
                                : '';
                            const metricsHeading = card && card.querySelector('.agent-chat-card-section-title')
                                ? card.querySelector('.agent-chat-card-section-title').textContent.trim()
                                : '';
                            if (card && title && metricsHeading) {
                                return {
                                    title,
                                    metricsHeading
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return null;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const queryBackendComparisonCardTitleZh =
            queryBackendComparisonState && typeof queryBackendComparisonState === 'object' ? queryBackendComparisonState.title : '';
        const queryBackendComparisonCardMetricsHeadingZh =
            queryBackendComparisonState && typeof queryBackendComparisonState === 'object' ? queryBackendComparisonState.metricsHeading : '';

        const queryBackendComparisonHistoryState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const historyButton = document.querySelector('.agent-knowledge-actions button[data-capability-action-id="inspect_query_backend_comparison_history"]');
                        historyButton.click();
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const cards = Array.from(document.querySelectorAll('[data-agent-workspace-card-kind="query-backend-comparison-history"]'));
                            const card = cards.length > 0 ? cards[cards.length - 1] : null;
                            const title = card && card.querySelector('.agent-chat-card-title')
                                ? card.querySelector('.agent-chat-card-title').textContent.trim()
                                : '';
                            const metricsHeading = card && card.querySelector('.agent-chat-card-section-title')
                                ? card.querySelector('.agent-chat-card-section-title').textContent.trim()
                                : '';
                            if (card && title && metricsHeading) {
                                return {
                                    title,
                                    metricsHeading
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return null;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const queryBackendComparisonHistoryCardTitleZh =
            queryBackendComparisonHistoryState && typeof queryBackendComparisonHistoryState === 'object'
                ? queryBackendComparisonHistoryState.title
                : '';
        const queryBackendComparisonHistoryCardMetricsHeadingZh =
            queryBackendComparisonHistoryState && typeof queryBackendComparisonHistoryState === 'object'
                ? queryBackendComparisonHistoryState.metricsHeading
                : '';

        const queryBackendComparisonTrendState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const trendButton = document.querySelector('.agent-knowledge-actions button[data-capability-action-id="inspect_query_backend_comparison_trend"]');
                        trendButton.click();
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const cards = Array.from(document.querySelectorAll('[data-agent-workspace-card-kind="query-backend-comparison-trend"]'));
                            const card = cards.length > 0 ? cards[cards.length - 1] : null;
                            const title = card && card.querySelector('.agent-chat-card-title')
                                ? card.querySelector('.agent-chat-card-title').textContent.trim()
                                : '';
                            const metricsHeading = card && card.querySelector('.agent-chat-card-section-title')
                                ? card.querySelector('.agent-chat-card-section-title').textContent.trim()
                                : '';
                            if (card && title && metricsHeading) {
                                return {
                                    title,
                                    metricsHeading
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return null;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const queryBackendComparisonTrendCardTitleZh =
            queryBackendComparisonTrendState && typeof queryBackendComparisonTrendState === 'object'
                ? queryBackendComparisonTrendState.title
                : '';
        const queryBackendComparisonTrendCardMetricsHeadingZh =
            queryBackendComparisonTrendState && typeof queryBackendComparisonTrendState === 'object'
                ? queryBackendComparisonTrendState.metricsHeading
                : '';

        const learningQualityTrendState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const trendButton = document.querySelector('.agent-knowledge-actions button[data-capability-action-id="inspect_learning_quality_trend"]');
                        trendButton.click();
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const cards = Array.from(document.querySelectorAll('[data-agent-workspace-card-kind="learning-quality-trend"]'));
                            const card = cards.length > 0 ? cards[cards.length - 1] : null;
                            const title = card && card.querySelector('.agent-chat-card-title')
                                ? card.querySelector('.agent-chat-card-title').textContent.trim()
                                : '';
                            const metricsHeading = card && card.querySelector('.agent-chat-card-section-title')
                                ? card.querySelector('.agent-chat-card-section-title').textContent.trim()
                                : '';
                            if (card && title && metricsHeading) {
                                return {
                                    title,
                                    metricsHeading
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return null;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const learningQualityTrendCardTitleZh =
            learningQualityTrendState && typeof learningQualityTrendState === 'object'
                ? learningQualityTrendState.title
                : '';
        const learningQualityTrendCardMetricsHeadingZh =
            learningQualityTrendState && typeof learningQualityTrendState === 'object'
                ? learningQualityTrendState.metricsHeading
                : '';

        const learningQualityHistoryState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const historyButton = document.querySelector('.agent-knowledge-actions button[data-capability-action-id="inspect_learning_quality_history"]');
                        historyButton.click();
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const cards = Array.from(document.querySelectorAll('[data-agent-workspace-card-kind="learning-quality-history"]'));
                            const card = cards.length > 0 ? cards[cards.length - 1] : null;
                            const title = card && card.querySelector('.agent-chat-card-title')
                                ? card.querySelector('.agent-chat-card-title').textContent.trim()
                                : '';
                            const metricsHeading = card && card.querySelector('.agent-chat-card-section-title')
                                ? card.querySelector('.agent-chat-card-section-title').textContent.trim()
                                : '';
                            if (card && title && metricsHeading) {
                                return {
                                    title,
                                    metricsHeading
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return null;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const learningQualityHistoryCardTitleZh =
            learningQualityHistoryState && typeof learningQualityHistoryState === 'object'
                ? learningQualityHistoryState.title
                : '';
        const learningQualityHistoryCardMetricsHeadingZh =
            learningQualityHistoryState && typeof learningQualityHistoryState === 'object'
                ? learningQualityHistoryState.metricsHeading
                : '';

        const sessionPlanQualityTrendState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const trendButton = document.querySelector('.agent-knowledge-actions button[data-capability-action-id="inspect_session_plan_quality_trend"]');
                        trendButton.click();
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const cards = Array.from(document.querySelectorAll('[data-agent-workspace-card-kind="session-plan-quality-trend"]'));
                            const card = cards.length > 0 ? cards[cards.length - 1] : null;
                            const title = card && card.querySelector('.agent-chat-card-title')
                                ? card.querySelector('.agent-chat-card-title').textContent.trim()
                                : '';
                            const metricsHeading = card && card.querySelector('.agent-chat-card-section-title')
                                ? card.querySelector('.agent-chat-card-section-title').textContent.trim()
                                : '';
                            if (card && title && metricsHeading) {
                                return {
                                    title,
                                    metricsHeading
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return null;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const sessionPlanQualityTrendCardTitleZh =
            sessionPlanQualityTrendState && typeof sessionPlanQualityTrendState === 'object'
                ? sessionPlanQualityTrendState.title
                : '';
        const sessionPlanQualityTrendCardMetricsHeadingZh =
            sessionPlanQualityTrendState && typeof sessionPlanQualityTrendState === 'object'
                ? sessionPlanQualityTrendState.metricsHeading
                : '';

        const sessionPlanQualityHistoryState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const historyButton = document.querySelector('.agent-knowledge-actions button[data-capability-action-id="inspect_session_plan_quality_history"]');
                        if (!historyButton) {
                            return {
                                title: '',
                                metricsHeading: '',
                                debug: {
                                    buttonFound: false,
                                    historyCardCount: 0,
                                    historyCardTitles: [],
                                    recentCardKinds: Array.from(
                                        document.querySelectorAll('[data-agent-workspace-card-kind]')
                                    ).slice(-10).map((node) => node.getAttribute('data-agent-workspace-card-kind') || ''),
                                    lastAssistantMessage: (() => {
                                        const assistantMessages = Array.from(
                                            document.querySelectorAll('.agent-chat-message-assistant')
                                        );
                                        const latest = assistantMessages.length > 0
                                            ? assistantMessages[assistantMessages.length - 1]
                                            : null;
                                        return latest ? latest.textContent.trim() : '';
                                    })()
                                }
                            };
                        }
                        historyButton.click();
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const cards = Array.from(document.querySelectorAll('[data-agent-workspace-card-kind="session-plan-quality-history"]'));
                            const card = cards.length > 0 ? cards[cards.length - 1] : null;
                            const title = card && card.querySelector('.agent-chat-card-title')
                                ? card.querySelector('.agent-chat-card-title').textContent.trim()
                                : '';
                            const metricsHeading = card && card.querySelector('.agent-chat-card-section-title')
                                ? card.querySelector('.agent-chat-card-section-title').textContent.trim()
                                : '';
                            if (card && title && metricsHeading) {
                                return {
                                    title,
                                    metricsHeading,
                                    debug: {
                                        buttonFound: true,
                                        historyCardCount: cards.length,
                                        historyCardTitles: cards.map((node) => {
                                            const titleNode = node.querySelector('.agent-chat-card-title');
                                            return titleNode ? titleNode.textContent.trim() : '';
                                        }).slice(-5),
                                        recentCardKinds: Array.from(
                                            document.querySelectorAll('[data-agent-workspace-card-kind]')
                                        ).slice(-10).map((node) => node.getAttribute('data-agent-workspace-card-kind') || ''),
                                        lastAssistantMessage: (() => {
                                            const assistantMessages = Array.from(
                                                document.querySelectorAll('.agent-chat-message-assistant')
                                            );
                                            const latest = assistantMessages.length > 0
                                                ? assistantMessages[assistantMessages.length - 1]
                                                : null;
                                            return latest ? latest.textContent.trim() : '';
                                        })()
                                    }
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        const assistantMessages = Array.from(document.querySelectorAll('.agent-chat-message-assistant'));
                        const latestAssistant = assistantMessages.length > 0
                            ? assistantMessages[assistantMessages.length - 1]
                            : null;
                        const cardsAfterTimeout = Array.from(
                            document.querySelectorAll('[data-agent-workspace-card-kind="session-plan-quality-history"]')
                        );
                        return {
                            title: '',
                            metricsHeading: '',
                            debug: {
                                buttonFound: true,
                                historyCardCount: cardsAfterTimeout.length,
                                historyCardTitles: cardsAfterTimeout.map((node) => {
                                    const titleNode = node.querySelector('.agent-chat-card-title');
                                    return titleNode ? titleNode.textContent.trim() : '';
                                }).slice(-5),
                                recentCardKinds: Array.from(
                                    document.querySelectorAll('[data-agent-workspace-card-kind]')
                                ).slice(-10).map((node) => node.getAttribute('data-agent-workspace-card-kind') || ''),
                                lastAssistantMessage: latestAssistant ? latestAssistant.textContent.trim() : ''
                            }
                        };
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const sessionPlanQualityHistoryCardTitleZh =
            sessionPlanQualityHistoryState && typeof sessionPlanQualityHistoryState === 'object'
                ? sessionPlanQualityHistoryState.title
                : '';
        const sessionPlanQualityHistoryCardMetricsHeadingZh =
            sessionPlanQualityHistoryState && typeof sessionPlanQualityHistoryState === 'object'
                ? sessionPlanQualityHistoryState.metricsHeading
                : '';
        const sessionPlanQualityHistoryDebugJson =
            sessionPlanQualityHistoryState
            && typeof sessionPlanQualityHistoryState === 'object'
            && sessionPlanQualityHistoryState.debug
                ? JSON.stringify(sessionPlanQualityHistoryState.debug)
                : '';
        const shouldEmitSessionPlanQualityHistoryDebug =
            sessionPlanQualityHistoryCardTitleZh !== '会话计划质量历史'
            || sessionPlanQualityHistoryCardMetricsHeadingZh !== '关键指标';

        const sessionHistoryState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const historyButton = document.querySelector('.agent-knowledge-actions button[data-capability-action-id="inspect_session_history"]');
                        historyButton.click();
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const cards = Array.from(document.querySelectorAll('[data-agent-workspace-card-kind="session-history"]'));
                            const card = cards.length > 0 ? cards[cards.length - 1] : null;
                            const title = card && card.querySelector('.agent-chat-card-title')
                                ? card.querySelector('.agent-chat-card-title').textContent.trim()
                                : '';
                            const metricsHeading = card && card.querySelector('.agent-chat-card-section-title')
                                ? card.querySelector('.agent-chat-card-section-title').textContent.trim()
                                : '';
                            if (card && title && metricsHeading) {
                                return {
                                    title,
                                    metricsHeading
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return null;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const sessionHistoryCardTitleZh =
            sessionHistoryState && typeof sessionHistoryState === 'object' ? sessionHistoryState.title : '';
        const sessionHistoryCardMetricsHeadingZh =
            sessionHistoryState && typeof sessionHistoryState === 'object' ? sessionHistoryState.metricsHeading : '';

        const runtimeRunbookChecksState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const checksButton = document.querySelector('.agent-knowledge-actions button[data-capability-action-id="inspect_runtime_capability_runbook_checks"]');
                        checksButton.click();
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const cards = Array.from(document.querySelectorAll('[data-agent-workspace-card-kind="runtime-capability-runbook-checks"]'));
                            const card = cards.length > 0 ? cards[cards.length - 1] : null;
                            const title = card && card.querySelector('.agent-chat-card-title')
                                ? card.querySelector('.agent-chat-card-title').textContent.trim()
                                : '';
                            const metricsHeading = card && card.querySelector('.agent-chat-card-section-title')
                                ? card.querySelector('.agent-chat-card-section-title').textContent.trim()
                                : '';
                            if (card && title && metricsHeading) {
                                return {
                                    title,
                                    metricsHeading
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return null;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const runtimeRunbookChecksCardTitleZh =
            runtimeRunbookChecksState && typeof runtimeRunbookChecksState === 'object'
                ? runtimeRunbookChecksState.title
                : '';
        const runtimeRunbookChecksCardMetricsHeadingZh =
            runtimeRunbookChecksState && typeof runtimeRunbookChecksState === 'object'
                ? runtimeRunbookChecksState.metricsHeading
                : '';

        const runtimeRunbookActionQueueState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const actionQueueButton = document.querySelector('.agent-knowledge-actions button[data-capability-action-id="inspect_runtime_capability_runbook_action_queue"]');
                        actionQueueButton.click();
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const cards = Array.from(document.querySelectorAll('[data-agent-workspace-card-kind="runtime-capability-runbook-action-queue"]'));
                            const card = cards.length > 0 ? cards[cards.length - 1] : null;
                            const title = card && card.querySelector('.agent-chat-card-title')
                                ? card.querySelector('.agent-chat-card-title').textContent.trim()
                                : '';
                            const metricsHeading = card && card.querySelector('.agent-chat-card-section-title')
                                ? card.querySelector('.agent-chat-card-section-title').textContent.trim()
                                : '';
                            if (card && title && metricsHeading) {
                                return {
                                    title,
                                    metricsHeading
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return null;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const runtimeRunbookActionQueueCardTitleZh =
            runtimeRunbookActionQueueState && typeof runtimeRunbookActionQueueState === 'object'
                ? runtimeRunbookActionQueueState.title
                : '';
        const runtimeRunbookActionQueueCardMetricsHeadingZh =
            runtimeRunbookActionQueueState && typeof runtimeRunbookActionQueueState === 'object'
                ? runtimeRunbookActionQueueState.metricsHeading
                : '';

        const conversationTurnCacheAlertTrendState = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(async () => {
                        const trendButton = document.querySelector('.agent-knowledge-actions button[data-capability-action-id="inspect_conversation_turn_cache_alert_trend"]');
                        trendButton.click();
                        for (let attempt = 0; attempt < 50; attempt += 1) {
                            const cards = Array.from(document.querySelectorAll('[data-agent-workspace-card-kind="conversation-turn-cache-alert-trend"]'));
                            const card = cards.length > 0 ? cards[cards.length - 1] : null;
                            const title = card && card.querySelector('.agent-chat-card-title')
                                ? card.querySelector('.agent-chat-card-title').textContent.trim()
                                : '';
                            const metricsHeading = card && card.querySelector('.agent-chat-card-section-title')
                                ? card.querySelector('.agent-chat-card-section-title').textContent.trim()
                                : '';
                            if (card && title && metricsHeading) {
                                return {
                                    title,
                                    metricsHeading
                                };
                            }
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }
                        return null;
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const conversationTurnCacheAlertTrendCardTitleZh =
            conversationTurnCacheAlertTrendState && typeof conversationTurnCacheAlertTrendState === 'object'
                ? conversationTurnCacheAlertTrendState.title
                : '';
        const conversationTurnCacheAlertTrendCardMetricsHeadingZh =
            conversationTurnCacheAlertTrendState && typeof conversationTurnCacheAlertTrendState === 'object'
                ? conversationTurnCacheAlertTrendState.metricsHeading
                : '';

        const missingNodeMessageZh = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(() => {
                        window.NoteConnectionAgentWorkspace.openGraphFocus({
                            atomId: 'atom_missing',
                            title: 'Missing Node'
                        });
                        const nodes = Array.from(document.querySelectorAll('.agent-chat-message-assistant'));
                        return nodes[nodes.length - 1].textContent.trim();
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );

        const promotionStateAfterClick = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(() => {
                        window.NoteConnectionWorkspacePanes.openGraphFocusPane({
                            atomId: 'atom_focus',
                            title: 'Focus Node',
                            summary: 'summary'
                        });
                        document.querySelector('#btn-agent-graph-focus-fullscreen').click();
                        return document.body.getAttribute('data-agent-workspace-promotion');
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );

        runPwcli(pwcli, sessionArgs.concat(['press', 'Escape']), { cwd: artifactDir });

        const promotionStateAfterEscapeRaw = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `document.body.getAttribute('data-agent-workspace-promotion')`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const promotionStateAfterEscape =
            promotionStateAfterEscapeRaw === 'null' || promotionStateAfterEscapeRaw === null || promotionStateAfterEscapeRaw === ''
                ? null
                : promotionStateAfterEscapeRaw;

        const screenshotOutput = runPwcli(pwcli, sessionArgs.concat(['screenshot']), { cwd: artifactDir });
        const consoleOutput = runPwcli(pwcli, sessionArgs.concat(['console']), { cwd: artifactDir });
        const screenshotRelativePath = parseMarkdownArtifactPath(screenshotOutput.stdout, 'png');
        const consoleRelativePath = parseConsoleArtifactPath(consoleOutput.stdout) || parseConsoleArtifactPath(screenshotOutput.stdout);
        const screenshotPath = screenshotRelativePath
            ? path.join(artifactDir, screenshotRelativePath)
            : findLatestArtifactPath(artifactDir, (entry) => /^page-.*\.png$/i.test(entry));
        const consoleLogPath = consoleRelativePath
            ? path.join(artifactDir, consoleRelativePath)
            : findLatestArtifactPath(artifactDir, (entry) => /^console-.*\.log$/i.test(entry));
        const networkSummary = normalizeRawValue(
            runPwcli(
                pwcli,
                sessionArgs.concat([
                    '--raw',
                    'eval',
                    `(() => {
                        const resources = performance.getEntriesByType('resource').map((entry) => ({
                            name: entry.name,
                            initiatorType: entry.initiatorType || '',
                            transferSize: Number(entry.transferSize || 0),
                            duration: Number(entry.duration || 0)
                        }));
                        const traces = Array.isArray(window.__NC_AGENT_FETCH_TRACES)
                            ? window.__NC_AGENT_FETCH_TRACES.map((entry) => ({
                                url: String(entry && entry.url || ''),
                                method: String(entry && entry.method || 'GET').toUpperCase(),
                                status: Number(entry && entry.status || 0),
                                ok: Boolean(entry && entry.ok),
                                durationMs: Number(entry && entry.durationMs || 0),
                                error: String(entry && entry.error || ''),
                            }))
                            : [];
                        const summarizeByMatcher = (matcher) => {
                            const matched = traces.filter((entry) => matcher(entry.url));
                            const durations = matched.map((entry) => Number(entry.durationMs || 0));
                            const totalDurationMs = durations.reduce((sum, value) => sum + value, 0);
                            const non2xxCount = matched.filter((entry) => !(entry.status >= 200 && entry.status < 300)).length;
                            const statusCodes = Array.from(new Set(matched.map((entry) => Number(entry.status || 0))));
                            return {
                                requestCount: matched.length,
                                non2xxCount,
                                statusCodes,
                                averageDurationMs: matched.length > 0
                                    ? Number((totalDurationMs / matched.length).toFixed(3))
                                    : 0,
                                maxDurationMs: matched.length > 0
                                    ? Number(Math.max(...durations).toFixed(3))
                                    : 0,
                            };
                        };
                        const endpointStatusSummary = {
                            conversation: summarizeByMatcher((url) => url.includes('/api/knowledge/conversation')),
                            learningPath: summarizeByMatcher((url) => url.includes('/api/knowledge/path')),
                            studySession: summarizeByMatcher((url) => url.includes('/api/knowledge/session/plan') && !url.includes('/api/knowledge/session/plan/quality/')),
                            queryBackendComparison: summarizeByMatcher((url) => (
                                url.includes('/api/knowledge/query/compare-backends')
                                && !url.includes('/api/knowledge/query/compare-backends/history')
                                && !url.includes('/api/knowledge/query/compare-backends/trend')
                            )),
                            queryBackendComparisonHistory: summarizeByMatcher((url) => url.includes('/api/knowledge/query/compare-backends/history')),
                            queryBackendComparisonTrend: summarizeByMatcher((url) => url.includes('/api/knowledge/query/compare-backends/trend')),
                            learningQualityTrend: summarizeByMatcher((url) => url.includes('/api/knowledge/quality/trend')),
                            learningQualityHistory: summarizeByMatcher((url) => url.includes('/api/knowledge/quality/history')),
                            sessionPlanQualityTrend: summarizeByMatcher((url) => url.includes('/api/knowledge/session/plan/quality/trend')),
                            sessionPlanQualityHistory: summarizeByMatcher((url) => url.includes('/api/knowledge/session/plan/quality/history')),
                            sessionHistory: summarizeByMatcher((url) => url.includes('/api/knowledge/session/history')),
                            runtimeRunbookChecks: summarizeByMatcher((url) => url.includes('/api/knowledge/runtime-capability-runbook/history/checks')),
                            runtimeRunbookActionQueue: summarizeByMatcher((url) => url.includes('/api/knowledge/runtime-capability-runbook/history/action-queue')),
                            conversationTurnCacheAlertTrend: summarizeByMatcher((url) => url.includes('/api/knowledge/conversation/turn-cache/diagnostics/trend')),
                            tutorAction: summarizeByMatcher((url) => url.includes('/api/knowledge/tutor/action')),
                        };
                        const requiredEndpointKeys = [
                            'conversation',
                            'learningPath',
                            'studySession',
                            'queryBackendComparison',
                            'queryBackendComparisonHistory',
                            'queryBackendComparisonTrend',
                            'learningQualityTrend',
                            'learningQualityHistory',
                            'sessionPlanQualityTrend',
                            'sessionPlanQualityHistory',
                            'sessionHistory',
                            'runtimeRunbookChecks',
                            'runtimeRunbookActionQueue',
                            'conversationTurnCacheAlertTrend',
                            'tutorAction',
                        ];
                        const allTrackedRequestsSucceeded = requiredEndpointKeys.every((key) => {
                            const summary = endpointStatusSummary[key];
                            return summary && summary.requestCount > 0 && summary.non2xxCount === 0;
                        });
                        return {
                            hasDataJsRequest: resources.some((entry) => /\\/data\\.js(\\?|$)/.test(entry.name)),
                            hasConversationRequest: endpointStatusSummary.conversation.requestCount > 0,
                            hasLearningPathRequest: endpointStatusSummary.learningPath.requestCount > 0,
                            hasStudySessionRequest: endpointStatusSummary.studySession.requestCount > 0,
                            hasQueryBackendComparisonRequest: endpointStatusSummary.queryBackendComparison.requestCount > 0,
                            hasQueryBackendComparisonHistoryRequest: endpointStatusSummary.queryBackendComparisonHistory.requestCount > 0,
                            hasQueryBackendComparisonTrendRequest: endpointStatusSummary.queryBackendComparisonTrend.requestCount > 0,
                            hasLearningQualityTrendRequest: endpointStatusSummary.learningQualityTrend.requestCount > 0,
                            hasLearningQualityHistoryRequest: endpointStatusSummary.learningQualityHistory.requestCount > 0,
                            hasSessionPlanQualityTrendRequest: endpointStatusSummary.sessionPlanQualityTrend.requestCount > 0,
                            hasSessionPlanQualityHistoryRequest: endpointStatusSummary.sessionPlanQualityHistory.requestCount > 0,
                            hasSessionHistoryRequest: endpointStatusSummary.sessionHistory.requestCount > 0,
                            hasRuntimeRunbookChecksRequest: endpointStatusSummary.runtimeRunbookChecks.requestCount > 0,
                            hasRuntimeRunbookActionQueueRequest: endpointStatusSummary.runtimeRunbookActionQueue.requestCount > 0,
                            hasConversationTurnCacheAlertTrendRequest: endpointStatusSummary.conversationTurnCacheAlertTrend.requestCount > 0,
                            hasTutorActionRequest: endpointStatusSummary.tutorAction.requestCount > 0,
                            fetchTraceCount: traces.length,
                            allTrackedRequestsSucceeded,
                            endpointStatusSummary,
                            resources,
                            traces,
                        };
                    })()`,
                ]),
                { cwd: artifactDir }
            ).stdout
        );
        const networkSummaryPath = path.join(artifactDir, 'network-summary.json');
        fs.writeFileSync(networkSummaryPath, JSON.stringify(networkSummary, null, 2), 'utf8');

        const report = {
            port,
            bridgePort,
            artifacts: {
                artifactDir,
                screenshotPath,
                consoleLogPath,
                networkSummaryPath,
            },
            browserChecks: {
                backendMode: 'real_backend',
                graphMode: 'real_graph_runtime',
                pathMode: 'real_path_runtime',
                titleText: String(titleText || ''),
                userMessageText: String(userMessageText || ''),
                assistantMessageText: String(assistantMessageText || ''),
                focusButtonLabelZh: String(focusButtonLabelZh || ''),
                learningPathButtonLabelZh: String(learningPathButtonLabelZh || ''),
                studySessionButtonLabelZh: String(studySessionButtonLabelZh || ''),
                quizButtonLabelZh: String(quizButtonLabelZh || ''),
                transferButtonLabelZh: String(transferButtonLabelZh || ''),
                counterexampleButtonLabelZh: String(counterexampleButtonLabelZh || ''),
                followUpButtonLabelZh: String(followUpButtonLabelZh || ''),
                compareQueryBackendsButtonLabelZh: String(compareQueryBackendsButtonLabelZh || ''),
                queryBackendComparisonHistoryButtonLabelZh: String(queryBackendComparisonHistoryButtonLabelZh || ''),
                queryBackendComparisonTrendButtonLabelZh: String(queryBackendComparisonTrendButtonLabelZh || ''),
                learningQualityTrendButtonLabelZh: String(learningQualityTrendButtonLabelZh || ''),
                learningQualityHistoryButtonLabelZh: String(learningQualityHistoryButtonLabelZh || ''),
                sessionPlanQualityTrendButtonLabelZh: String(sessionPlanQualityTrendButtonLabelZh || ''),
                sessionPlanQualityHistoryButtonLabelZh: String(sessionPlanQualityHistoryButtonLabelZh || ''),
                sessionHistoryButtonLabelZh: String(sessionHistoryButtonLabelZh || ''),
                runtimeRunbookChecksButtonLabelZh: String(runtimeRunbookChecksButtonLabelZh || ''),
                runtimeRunbookActionQueueButtonLabelZh: String(runtimeRunbookActionQueueButtonLabelZh || ''),
                conversationTurnCacheAlertTrendButtonLabelZh: String(conversationTurnCacheAlertTrendButtonLabelZh || ''),
                focusOpenedId: String(focusOpenedId || ''),
                focusStateNodeId: String(focusOpenedId || ''),
                focusNodeNameText: String(focusNodeNameText || ''),
                learningPathPaneOpenState: String(learningPathPaneOpenState || ''),
                learningPathInitId: String(learningPathInitId || ''),
                learningPathCurrentTargetId: String(learningPathCurrentTargetId || ''),
                learningPathDisplay: String(learningPathDisplay || ''),
                studySessionCardTitleZh: String(studySessionCardTitleZh || ''),
                studySessionCardSummaryZh: String(studySessionCardSummaryZh || ''),
                tutorCardTitleZh: String(tutorCardTitleZh || ''),
                tutorCardEvidenceHeadingZh: String(tutorCardEvidenceHeadingZh || ''),
                queryBackendComparisonCardTitleZh: String(queryBackendComparisonCardTitleZh || ''),
                queryBackendComparisonCardMetricsHeadingZh: String(queryBackendComparisonCardMetricsHeadingZh || ''),
                queryBackendComparisonHistoryCardTitleZh: String(queryBackendComparisonHistoryCardTitleZh || ''),
                queryBackendComparisonHistoryCardMetricsHeadingZh: String(queryBackendComparisonHistoryCardMetricsHeadingZh || ''),
                queryBackendComparisonTrendCardTitleZh: String(queryBackendComparisonTrendCardTitleZh || ''),
                queryBackendComparisonTrendCardMetricsHeadingZh: String(queryBackendComparisonTrendCardMetricsHeadingZh || ''),
                learningQualityTrendCardTitleZh: String(learningQualityTrendCardTitleZh || ''),
                learningQualityTrendCardMetricsHeadingZh: String(learningQualityTrendCardMetricsHeadingZh || ''),
                learningQualityHistoryCardTitleZh: String(learningQualityHistoryCardTitleZh || ''),
                learningQualityHistoryCardMetricsHeadingZh: String(learningQualityHistoryCardMetricsHeadingZh || ''),
                sessionPlanQualityTrendCardTitleZh: String(sessionPlanQualityTrendCardTitleZh || ''),
                sessionPlanQualityTrendCardMetricsHeadingZh: String(sessionPlanQualityTrendCardMetricsHeadingZh || ''),
                sessionPlanQualityHistoryCardTitleZh: String(sessionPlanQualityHistoryCardTitleZh || ''),
                sessionPlanQualityHistoryCardMetricsHeadingZh: String(sessionPlanQualityHistoryCardMetricsHeadingZh || ''),
                sessionPlanQualityHistoryDebugJson: shouldEmitSessionPlanQualityHistoryDebug
                    ? String(sessionPlanQualityHistoryDebugJson || '')
                    : '',
                sessionHistoryCardTitleZh: String(sessionHistoryCardTitleZh || ''),
                sessionHistoryCardMetricsHeadingZh: String(sessionHistoryCardMetricsHeadingZh || ''),
                runtimeRunbookChecksCardTitleZh: String(runtimeRunbookChecksCardTitleZh || ''),
                runtimeRunbookChecksCardMetricsHeadingZh: String(runtimeRunbookChecksCardMetricsHeadingZh || ''),
                runtimeRunbookActionQueueCardTitleZh: String(runtimeRunbookActionQueueCardTitleZh || ''),
                runtimeRunbookActionQueueCardMetricsHeadingZh: String(runtimeRunbookActionQueueCardMetricsHeadingZh || ''),
                conversationTurnCacheAlertTrendCardTitleZh: String(conversationTurnCacheAlertTrendCardTitleZh || ''),
                conversationTurnCacheAlertTrendCardMetricsHeadingZh: String(conversationTurnCacheAlertTrendCardMetricsHeadingZh || ''),
                missingNodeMessageZh: String(missingNodeMessageZh || ''),
                promotionStateAfterClick: String(promotionStateAfterClick || ''),
                promotionStateAfterEscape,
            },
        };

        const failures = [];
        if (report.browserChecks.backendMode !== 'real_backend') {
            failures.push(`backendMode='${report.browserChecks.backendMode}'`);
        }
        if (report.browserChecks.graphMode !== 'real_graph_runtime') {
            failures.push(`graphMode='${report.browserChecks.graphMode}'`);
        }
        if (report.browserChecks.pathMode !== 'real_path_runtime') {
            failures.push(`pathMode='${report.browserChecks.pathMode}'`);
        }
        if (!report.artifacts.screenshotPath || !fs.existsSync(report.artifacts.screenshotPath)) {
            failures.push(`screenshotPath='${report.artifacts.screenshotPath}'`);
        }
        if (!report.artifacts.consoleLogPath || !fs.existsSync(report.artifacts.consoleLogPath)) {
            failures.push(`consoleLogPath='${report.artifacts.consoleLogPath}'`);
        }
        if (!report.artifacts.networkSummaryPath || !fs.existsSync(report.artifacts.networkSummaryPath)) {
            failures.push(`networkSummaryPath='${report.artifacts.networkSummaryPath}'`);
        }
        if (!networkSummary || networkSummary.hasDataJsRequest !== true) {
            failures.push(`networkSummary.hasDataJsRequest='${String(networkSummary && networkSummary.hasDataJsRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasConversationRequest !== true) {
            failures.push(`networkSummary.hasConversationRequest='${String(networkSummary && networkSummary.hasConversationRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasLearningPathRequest !== true) {
            failures.push(`networkSummary.hasLearningPathRequest='${String(networkSummary && networkSummary.hasLearningPathRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasStudySessionRequest !== true) {
            failures.push(`networkSummary.hasStudySessionRequest='${String(networkSummary && networkSummary.hasStudySessionRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasQueryBackendComparisonRequest !== true) {
            failures.push(`networkSummary.hasQueryBackendComparisonRequest='${String(networkSummary && networkSummary.hasQueryBackendComparisonRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasQueryBackendComparisonHistoryRequest !== true) {
            failures.push(`networkSummary.hasQueryBackendComparisonHistoryRequest='${String(networkSummary && networkSummary.hasQueryBackendComparisonHistoryRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasQueryBackendComparisonTrendRequest !== true) {
            failures.push(`networkSummary.hasQueryBackendComparisonTrendRequest='${String(networkSummary && networkSummary.hasQueryBackendComparisonTrendRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasLearningQualityTrendRequest !== true) {
            failures.push(`networkSummary.hasLearningQualityTrendRequest='${String(networkSummary && networkSummary.hasLearningQualityTrendRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasLearningQualityHistoryRequest !== true) {
            failures.push(`networkSummary.hasLearningQualityHistoryRequest='${String(networkSummary && networkSummary.hasLearningQualityHistoryRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasSessionPlanQualityTrendRequest !== true) {
            failures.push(`networkSummary.hasSessionPlanQualityTrendRequest='${String(networkSummary && networkSummary.hasSessionPlanQualityTrendRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasSessionPlanQualityHistoryRequest !== true) {
            failures.push(`networkSummary.hasSessionPlanQualityHistoryRequest='${String(networkSummary && networkSummary.hasSessionPlanQualityHistoryRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasSessionHistoryRequest !== true) {
            failures.push(`networkSummary.hasSessionHistoryRequest='${String(networkSummary && networkSummary.hasSessionHistoryRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasRuntimeRunbookChecksRequest !== true) {
            failures.push(`networkSummary.hasRuntimeRunbookChecksRequest='${String(networkSummary && networkSummary.hasRuntimeRunbookChecksRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasRuntimeRunbookActionQueueRequest !== true) {
            failures.push(`networkSummary.hasRuntimeRunbookActionQueueRequest='${String(networkSummary && networkSummary.hasRuntimeRunbookActionQueueRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasConversationTurnCacheAlertTrendRequest !== true) {
            failures.push(`networkSummary.hasConversationTurnCacheAlertTrendRequest='${String(networkSummary && networkSummary.hasConversationTurnCacheAlertTrendRequest)}'`);
        }
        if (!networkSummary || networkSummary.hasTutorActionRequest !== true) {
            failures.push(`networkSummary.hasTutorActionRequest='${String(networkSummary && networkSummary.hasTutorActionRequest)}'`);
        }
        if (!networkSummary || networkSummary.allTrackedRequestsSucceeded !== true) {
            failures.push(`networkSummary.allTrackedRequestsSucceeded='${String(networkSummary && networkSummary.allTrackedRequestsSucceeded)}'`);
        }
        const endpointStatusSummary = networkSummary && typeof networkSummary.endpointStatusSummary === 'object'
            ? networkSummary.endpointStatusSummary
            : {};
        [
            'conversation',
            'learningPath',
            'studySession',
            'queryBackendComparison',
            'queryBackendComparisonHistory',
            'queryBackendComparisonTrend',
            'learningQualityTrend',
            'learningQualityHistory',
            'sessionPlanQualityTrend',
            'sessionPlanQualityHistory',
            'sessionHistory',
            'runtimeRunbookChecks',
            'runtimeRunbookActionQueue',
            'conversationTurnCacheAlertTrend',
            'tutorAction',
        ].forEach((endpointKey) => {
            const entry = endpointStatusSummary[endpointKey];
            if (!entry || Number(entry.requestCount || 0) <= 0) {
                failures.push(`networkSummary.endpointStatusSummary.${endpointKey}.requestCount='${String(entry && entry.requestCount)}'`);
                return;
            }
            if (Number(entry.non2xxCount || 0) !== 0) {
                failures.push(`networkSummary.endpointStatusSummary.${endpointKey}.non2xxCount='${String(entry && entry.non2xxCount)}'`);
            }
        });
        if (report.browserChecks.titleText !== 'Agent 工作区') {
            failures.push(`titleText='${report.browserChecks.titleText}'`);
        }
        if (report.browserChecks.userMessageText !== 'focus node') {
            failures.push(`userMessageText='${report.browserChecks.userMessageText}'`);
        }
        if (
            report.browserChecks.assistantMessageText
            !== 'I found 1 local knowledge point(s) relevant to your request. Start with Focus Node and use the focus or learning path actions to inspect them.'
        ) {
            failures.push(`assistantMessageText='${report.browserChecks.assistantMessageText}'`);
        }
        if (report.browserChecks.focusButtonLabelZh !== '聚焦') {
            failures.push(`focusButtonLabelZh='${report.browserChecks.focusButtonLabelZh}'`);
        }
        if (report.browserChecks.learningPathButtonLabelZh !== '学习路径') {
            failures.push(`learningPathButtonLabelZh='${report.browserChecks.learningPathButtonLabelZh}'`);
        }
        if (report.browserChecks.studySessionButtonLabelZh !== '学习会话') {
            failures.push(`studySessionButtonLabelZh='${report.browserChecks.studySessionButtonLabelZh}'`);
        }
        if (report.browserChecks.quizButtonLabelZh !== '测验') {
            failures.push(`quizButtonLabelZh='${report.browserChecks.quizButtonLabelZh}'`);
        }
        if (report.browserChecks.transferButtonLabelZh !== '迁移挑战') {
            failures.push(`transferButtonLabelZh='${report.browserChecks.transferButtonLabelZh}'`);
        }
        if (report.browserChecks.counterexampleButtonLabelZh !== '反例挑战') {
            failures.push(`counterexampleButtonLabelZh='${report.browserChecks.counterexampleButtonLabelZh}'`);
        }
        if (report.browserChecks.followUpButtonLabelZh !== '追问') {
            failures.push(`followUpButtonLabelZh='${report.browserChecks.followUpButtonLabelZh}'`);
        }
        if (report.browserChecks.compareQueryBackendsButtonLabelZh !== '后端对比') {
            failures.push(`compareQueryBackendsButtonLabelZh='${report.browserChecks.compareQueryBackendsButtonLabelZh}'`);
        }
        if (report.browserChecks.queryBackendComparisonHistoryButtonLabelZh !== '对比历史') {
            failures.push(`queryBackendComparisonHistoryButtonLabelZh='${report.browserChecks.queryBackendComparisonHistoryButtonLabelZh}'`);
        }
        if (report.browserChecks.queryBackendComparisonTrendButtonLabelZh !== '对比趋势') {
            failures.push(`queryBackendComparisonTrendButtonLabelZh='${report.browserChecks.queryBackendComparisonTrendButtonLabelZh}'`);
        }
        if (report.browserChecks.learningQualityTrendButtonLabelZh !== '学习质量趋势') {
            failures.push(`learningQualityTrendButtonLabelZh='${report.browserChecks.learningQualityTrendButtonLabelZh}'`);
        }
        if (report.browserChecks.learningQualityHistoryButtonLabelZh !== '学习质量历史') {
            failures.push(`learningQualityHistoryButtonLabelZh='${report.browserChecks.learningQualityHistoryButtonLabelZh}'`);
        }
        if (report.browserChecks.sessionPlanQualityTrendButtonLabelZh !== '会话计划趋势') {
            failures.push(`sessionPlanQualityTrendButtonLabelZh='${report.browserChecks.sessionPlanQualityTrendButtonLabelZh}'`);
        }
        if (report.browserChecks.sessionPlanQualityHistoryButtonLabelZh !== '会话计划历史') {
            failures.push(`sessionPlanQualityHistoryButtonLabelZh='${report.browserChecks.sessionPlanQualityHistoryButtonLabelZh}'`);
        }
        if (report.browserChecks.sessionHistoryButtonLabelZh !== '会话历史') {
            failures.push(`sessionHistoryButtonLabelZh='${report.browserChecks.sessionHistoryButtonLabelZh}'`);
        }
        if (report.browserChecks.runtimeRunbookChecksButtonLabelZh !== '运行时检查') {
            failures.push(`runtimeRunbookChecksButtonLabelZh='${report.browserChecks.runtimeRunbookChecksButtonLabelZh}'`);
        }
        if (report.browserChecks.runtimeRunbookActionQueueButtonLabelZh !== '运行时队列') {
            failures.push(`runtimeRunbookActionQueueButtonLabelZh='${report.browserChecks.runtimeRunbookActionQueueButtonLabelZh}'`);
        }
        if (report.browserChecks.conversationTurnCacheAlertTrendButtonLabelZh !== '轮次缓存趋势') {
            failures.push(`conversationTurnCacheAlertTrendButtonLabelZh='${report.browserChecks.conversationTurnCacheAlertTrendButtonLabelZh}'`);
        }
        if (!/^atom_/.test(report.browserChecks.focusOpenedId)) {
            failures.push(`focusOpenedId='${report.browserChecks.focusOpenedId}'`);
        }
        if (report.browserChecks.focusStateNodeId !== report.browserChecks.focusOpenedId) {
            failures.push(`focusStateNodeId='${report.browserChecks.focusStateNodeId}'`);
        }
        if (report.browserChecks.focusNodeNameText !== 'Focus Node') {
            failures.push(`focusNodeNameText='${report.browserChecks.focusNodeNameText}'`);
        }
        if (report.browserChecks.learningPathPaneOpenState !== 'true') {
            failures.push(`learningPathPaneOpenState='${report.browserChecks.learningPathPaneOpenState}'`);
        }
        if (report.browserChecks.learningPathInitId !== report.browserChecks.focusOpenedId) {
            failures.push(`learningPathInitId='${report.browserChecks.learningPathInitId}'`);
        }
        if (report.browserChecks.learningPathCurrentTargetId !== report.browserChecks.focusOpenedId) {
            failures.push(`learningPathCurrentTargetId='${report.browserChecks.learningPathCurrentTargetId}'`);
        }
        if (report.browserChecks.learningPathDisplay !== 'block') {
            failures.push(`learningPathDisplay='${report.browserChecks.learningPathDisplay}'`);
        }
        if (report.browserChecks.studySessionCardTitleZh !== '学习会话计划') {
            failures.push(`studySessionCardTitleZh='${report.browserChecks.studySessionCardTitleZh}'`);
        }
        if (!/动作/.test(report.browserChecks.studySessionCardSummaryZh)) {
            failures.push(`studySessionCardSummaryZh='${report.browserChecks.studySessionCardSummaryZh}'`);
        }
        if (report.browserChecks.tutorCardTitleZh !== '测验提示') {
            failures.push(`tutorCardTitleZh='${report.browserChecks.tutorCardTitleZh}'`);
        }
        if (report.browserChecks.tutorCardEvidenceHeadingZh !== '证据') {
            failures.push(`tutorCardEvidenceHeadingZh='${report.browserChecks.tutorCardEvidenceHeadingZh}'`);
        }
        if (report.browserChecks.queryBackendComparisonCardTitleZh !== '检索后端对比') {
            failures.push(`queryBackendComparisonCardTitleZh='${report.browserChecks.queryBackendComparisonCardTitleZh}'`);
        }
        if (report.browserChecks.queryBackendComparisonCardMetricsHeadingZh !== '关键指标') {
            failures.push(`queryBackendComparisonCardMetricsHeadingZh='${report.browserChecks.queryBackendComparisonCardMetricsHeadingZh}'`);
        }
        if (report.browserChecks.queryBackendComparisonHistoryCardTitleZh !== '后端对比历史') {
            failures.push(`queryBackendComparisonHistoryCardTitleZh='${report.browserChecks.queryBackendComparisonHistoryCardTitleZh}'`);
        }
        if (report.browserChecks.queryBackendComparisonHistoryCardMetricsHeadingZh !== '关键指标') {
            failures.push(`queryBackendComparisonHistoryCardMetricsHeadingZh='${report.browserChecks.queryBackendComparisonHistoryCardMetricsHeadingZh}'`);
        }
        if (report.browserChecks.queryBackendComparisonTrendCardTitleZh !== '后端对比趋势') {
            failures.push(`queryBackendComparisonTrendCardTitleZh='${report.browserChecks.queryBackendComparisonTrendCardTitleZh}'`);
        }
        if (report.browserChecks.queryBackendComparisonTrendCardMetricsHeadingZh !== '关键指标') {
            failures.push(`queryBackendComparisonTrendCardMetricsHeadingZh='${report.browserChecks.queryBackendComparisonTrendCardMetricsHeadingZh}'`);
        }
        if (report.browserChecks.learningQualityTrendCardTitleZh !== '学习质量趋势') {
            failures.push(`learningQualityTrendCardTitleZh='${report.browserChecks.learningQualityTrendCardTitleZh}'`);
        }
        if (report.browserChecks.learningQualityTrendCardMetricsHeadingZh !== '关键指标') {
            failures.push(`learningQualityTrendCardMetricsHeadingZh='${report.browserChecks.learningQualityTrendCardMetricsHeadingZh}'`);
        }
        if (report.browserChecks.learningQualityHistoryCardTitleZh !== '学习质量历史') {
            failures.push(`learningQualityHistoryCardTitleZh='${report.browserChecks.learningQualityHistoryCardTitleZh}'`);
        }
        if (report.browserChecks.learningQualityHistoryCardMetricsHeadingZh !== '关键指标') {
            failures.push(`learningQualityHistoryCardMetricsHeadingZh='${report.browserChecks.learningQualityHistoryCardMetricsHeadingZh}'`);
        }
        if (report.browserChecks.sessionPlanQualityTrendCardTitleZh !== '会话计划质量趋势') {
            failures.push(`sessionPlanQualityTrendCardTitleZh='${report.browserChecks.sessionPlanQualityTrendCardTitleZh}'`);
        }
        if (report.browserChecks.sessionPlanQualityTrendCardMetricsHeadingZh !== '关键指标') {
            failures.push(`sessionPlanQualityTrendCardMetricsHeadingZh='${report.browserChecks.sessionPlanQualityTrendCardMetricsHeadingZh}'`);
        }
        if (report.browserChecks.sessionPlanQualityHistoryCardTitleZh !== '会话计划质量历史') {
            failures.push(`sessionPlanQualityHistoryCardTitleZh='${report.browserChecks.sessionPlanQualityHistoryCardTitleZh}'`);
        }
        if (report.browserChecks.sessionPlanQualityHistoryCardMetricsHeadingZh !== '关键指标') {
            failures.push(`sessionPlanQualityHistoryCardMetricsHeadingZh='${report.browserChecks.sessionPlanQualityHistoryCardMetricsHeadingZh}'`);
        }
        if (
            report.browserChecks.sessionPlanQualityHistoryCardTitleZh !== '会话计划质量历史'
            || report.browserChecks.sessionPlanQualityHistoryCardMetricsHeadingZh !== '关键指标'
        ) {
            failures.push(`sessionPlanQualityHistoryDebugJson='${report.browserChecks.sessionPlanQualityHistoryDebugJson}'`);
        }
        if (report.browserChecks.sessionHistoryCardTitleZh !== '会话历史') {
            failures.push(`sessionHistoryCardTitleZh='${report.browserChecks.sessionHistoryCardTitleZh}'`);
        }
        if (report.browserChecks.sessionHistoryCardMetricsHeadingZh !== '关键指标') {
            failures.push(`sessionHistoryCardMetricsHeadingZh='${report.browserChecks.sessionHistoryCardMetricsHeadingZh}'`);
        }
        if (report.browserChecks.runtimeRunbookChecksCardTitleZh !== '运行时 Runbook 检查') {
            failures.push(`runtimeRunbookChecksCardTitleZh='${report.browserChecks.runtimeRunbookChecksCardTitleZh}'`);
        }
        if (report.browserChecks.runtimeRunbookChecksCardMetricsHeadingZh !== '关键指标') {
            failures.push(`runtimeRunbookChecksCardMetricsHeadingZh='${report.browserChecks.runtimeRunbookChecksCardMetricsHeadingZh}'`);
        }
        if (report.browserChecks.runtimeRunbookActionQueueCardTitleZh !== '运行时动作队列') {
            failures.push(`runtimeRunbookActionQueueCardTitleZh='${report.browserChecks.runtimeRunbookActionQueueCardTitleZh}'`);
        }
        if (report.browserChecks.runtimeRunbookActionQueueCardMetricsHeadingZh !== '关键指标') {
            failures.push(`runtimeRunbookActionQueueCardMetricsHeadingZh='${report.browserChecks.runtimeRunbookActionQueueCardMetricsHeadingZh}'`);
        }
        if (report.browserChecks.conversationTurnCacheAlertTrendCardTitleZh !== '对话轮次缓存告警趋势') {
            failures.push(`conversationTurnCacheAlertTrendCardTitleZh='${report.browserChecks.conversationTurnCacheAlertTrendCardTitleZh}'`);
        }
        if (report.browserChecks.conversationTurnCacheAlertTrendCardMetricsHeadingZh !== '关键指标') {
            failures.push(`conversationTurnCacheAlertTrendCardMetricsHeadingZh='${report.browserChecks.conversationTurnCacheAlertTrendCardMetricsHeadingZh}'`);
        }
        if (report.browserChecks.missingNodeMessageZh !== '本地图中当前找不到节点 atom_missing。') {
            failures.push(`missingNodeMessageZh='${report.browserChecks.missingNodeMessageZh}'`);
        }
        if (report.browserChecks.promotionStateAfterClick !== 'graph-focus') {
            failures.push(`promotionStateAfterClick='${report.browserChecks.promotionStateAfterClick}'`);
        }
        if (report.browserChecks.promotionStateAfterEscape !== null) {
            failures.push(`promotionStateAfterEscape='${report.browserChecks.promotionStateAfterEscape}'`);
        }

        if (failures.length > 0) {
            throw new Error(
                `[agent-workspace-browser] Browser smoke verification failed: ${failures.join(', ')}\n` +
                runtime.getLogs()
            );
        }

        return report;
    } finally {
        try {
            runPwcli(pwcli, sessionArgs.concat(['close']), { cwd: artifactDir });
        } catch (_error) {
            // Ignore browser close failures during cleanup.
        }
        await stopRuntimeServer(runtime.child);
        fixture.cleanup();
    }
}

async function main() {
    try {
        const report = await verifyAgentWorkspaceBrowser();
        console.log('[agent-workspace-browser] PASS', JSON.stringify(report, null, 2));
    } catch (error) {
        console.error('[agent-workspace-browser] FAIL', error);
        process.exit(1);
    }
}

if (require.main === module) {
    void main();
}

module.exports = {
    verifyAgentWorkspaceBrowser,
};
